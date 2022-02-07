import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as path from 'path';

export interface PipelineStackProps extends cdk.StackProps {
  readonly lambdaTestCode: lambda.CfnParametersCode;
  readonly repoName: string
}

export class Pattern3DemoStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: PipelineStackProps) {

    if (!props) {
      console.log('Props are null - this should never happen!');
      return;
    }

    super(scope, id, props);

    // This is the pipeline stack, need a separate stack for the 
    // environment and lambda deployment steps
    
    const code = new codecommit.Repository(this,'Pattern3Repo',{
      repositoryName: props.repoName
    })

    const build = new codebuild.PipelineProject(this, 'Pattern3Build', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: [ 
              'npm install'
            ]
          },
          build: {
            commands: [
              'npm run build',
              'npm run cdk synth -- -o dist'
            ],
          },
        },
        artifacts: {
          'secondary-artifacts': {
            'BuildOutput': {
              'base-directory': '$CODEBUILD_SRC_DIR/dist',
              files: [ ' **/*' ],
            },
            'LambdaBuildOutput': {
              'base-directory': '$CODEBUILD_SRC_DIR/lambda-test',
              files: [ ' **/*' ],
            }
          }
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
      },
    });

    // Output variables
    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact('BuildOutput');
    const lambdaBuildOutput = new codepipeline.Artifact('LambdaBuildOutput');
    const testEnvDeployOutput = new codepipeline.Artifact('TestEnvDeployOutput');
    const prodEnvDeployOutput = new codepipeline.Artifact('ProdEnvDeployOutput');
    
    const lambdaProxy = new lambda.Function(this, 'LambdaTestProxy', {
      runtime: lambda.Runtime.PYTHON_3_8,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(3),
      retryAttempts: 0,
      memorySize: 512,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-proxy'))
    });

    lambdaProxy.addToRolePolicy(new iam.PolicyStatement({
      actions : [
        "states:StartExecution",
        "states:DescribeExecution",
        "states:GetExecutionHistory"
      ],
      resources : ['*']
    }))

    new codepipeline.Pipeline(this, 'Pipeline', {
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.CodeCommitSourceAction({
              actionName: 'CodeCommit_Source',
              repository: code,
              output: sourceOutput,
              branch: 'baseline'
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Build',
              project: build,
              input: sourceOutput,
              outputs: [buildOutput, lambdaBuildOutput],
            })
          ],
        },
        {
          stageName: 'DeployTestEnvLambdasAndStateMachine',
          actions: [
            new codepipeline_actions.CloudFormationCreateUpdateStackAction({
              actionName: 'TestEnv_CFN_Deploy',
              templatePath: buildOutput.atPath('Pattern3TestEnvStack.template.json'),
              stackName: 'Pattern3TestEnvStack',
              adminPermissions: true,
              output: testEnvDeployOutput
            }),
            new codepipeline_actions.CloudFormationCreateUpdateStackAction({
              // assign the variables to a namespace, https://docs.aws.amazon.com/codepipeline/latest/userguide/reference-variables.html#reference-variables-workflow
              variablesNamespace : 'StepFunctions_CFN_Deploy', 
              actionName: 'StepFunctions_CFN_Deploy',
              templatePath:  buildOutput.atPath('StepFunctionsTestStack.template.json'),
              stackName: 'StepFunctionsTestStack',
              adminPermissions: true,
              parameterOverrides: {
                ...(props) ? props.lambdaTestCode.assign(lambdaBuildOutput.s3Location) : null,
              },
              extraInputs: [buildOutput, lambdaBuildOutput],
            }),
          ],
        },
        // Call a lambda proxy and pass in the state machine CFN output as variables. The Lambda proxy will invoke the underlying deployed State Machine dynamically
        {
          stageName: 'Test',
          actions: [
            new codepipeline_actions.LambdaInvokeAction({
              actionName: 'TestInvokeStateMachine',
              userParameters: {
                // resolve namespace output variables, https://docs.aws.amazon.com/codepipeline/latest/userguide/reference-variables.html#reference-variables-resolution 
                "StateMachineArn" : "#{StepFunctions_CFN_Deploy.StateMachineArn}", 
              },
              lambda: lambdaProxy,
              
            })
          ]
        },
        {
          stageName: 'DeployProdEnv',
          actions: [
            new codepipeline_actions.CloudFormationCreateUpdateStackAction({
              actionName: 'ProdEnv_CFN_Deploy',
              templatePath: buildOutput.atPath('Pattern3ProdEnvStack.template.json'),
              stackName: 'Pattern3ProdEnvStack',
              adminPermissions: true,
              output: prodEnvDeployOutput
            }),
          ]
        }
      ],
    });
  }
}