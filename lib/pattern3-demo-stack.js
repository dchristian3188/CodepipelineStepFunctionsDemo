"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pattern3DemoStack = void 0;
const cdk = require("@aws-cdk/core");
const iam = require("@aws-cdk/aws-iam");
const lambda = require("@aws-cdk/aws-lambda");
const codecommit = require("@aws-cdk/aws-codecommit");
const codebuild = require("@aws-cdk/aws-codebuild");
const codepipeline = require("@aws-cdk/aws-codepipeline");
const codepipeline_actions = require("@aws-cdk/aws-codepipeline-actions");
const path = require("path");
class Pattern3DemoStack extends cdk.Stack {
    constructor(scope, id, props) {
        if (!props) {
            console.log('Props are null - this should never happen!');
            return;
        }
        super(scope, id, props);
        // This is the pipeline stack, need a separate stack for the 
        // environment and lambda deployment steps
        const code = new codecommit.Repository(this, 'Pattern3Repo', {
            repositoryName: props.repoName
        });
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
                            files: [' **/*'],
                        },
                        'LambdaBuildOutput': {
                            'base-directory': '$CODEBUILD_SRC_DIR/lambda-test',
                            files: [' **/*'],
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
            actions: [
                "states:StartExecution",
                "states:DescribeExecution",
                "states:GetExecutionHistory"
            ],
            resources: ['*']
        }));
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
                            variablesNamespace: 'StepFunctions_CFN_Deploy',
                            actionName: 'StepFunctions_CFN_Deploy',
                            templatePath: buildOutput.atPath('StepFunctionsTestStack.template.json'),
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
                                "StateMachineArn": "#{StepFunctions_CFN_Deploy.StateMachineArn}",
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
exports.Pattern3DemoStack = Pattern3DemoStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF0dGVybjMtZGVtby1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInBhdHRlcm4zLWRlbW8tc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUNBQXFDO0FBQ3JDLHdDQUF3QztBQUN4Qyw4Q0FBOEM7QUFDOUMsc0RBQXNEO0FBQ3RELG9EQUFvRDtBQUNwRCwwREFBMEQ7QUFDMUQsMEVBQTBFO0FBQzFFLDZCQUE2QjtBQU83QixNQUFhLGlCQUFrQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzlDLFlBQVksS0FBYyxFQUFFLEVBQVUsRUFBRSxLQUEwQjtRQUVoRSxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ1YsT0FBTyxDQUFDLEdBQUcsQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDO1lBQzFELE9BQU87U0FDUjtRQUVELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLDZEQUE2RDtRQUM3RCwwQ0FBMEM7UUFFMUMsTUFBTSxJQUFJLEdBQUcsSUFBSSxVQUFVLENBQUMsVUFBVSxDQUFDLElBQUksRUFBQyxjQUFjLEVBQUM7WUFDekQsY0FBYyxFQUFFLEtBQUssQ0FBQyxRQUFRO1NBQy9CLENBQUMsQ0FBQTtRQUVGLE1BQU0sS0FBSyxHQUFHLElBQUksU0FBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ2pFLFNBQVMsRUFBRSxTQUFTLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQztnQkFDeEMsT0FBTyxFQUFFLEtBQUs7Z0JBQ2QsTUFBTSxFQUFFO29CQUNOLE9BQU8sRUFBRTt3QkFDUCxRQUFRLEVBQUU7NEJBQ1IsYUFBYTt5QkFDZDtxQkFDRjtvQkFDRCxLQUFLLEVBQUU7d0JBQ0wsUUFBUSxFQUFFOzRCQUNSLGVBQWU7NEJBQ2YsOEJBQThCO3lCQUMvQjtxQkFDRjtpQkFDRjtnQkFDRCxTQUFTLEVBQUU7b0JBQ1QscUJBQXFCLEVBQUU7d0JBQ3JCLGFBQWEs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SkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnQGF3cy1jZGsvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnQGF3cy1jZGsvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBjb2RlY29tbWl0IGZyb20gJ0Bhd3MtY2RrL2F3cy1jb2RlY29tbWl0JztcbmltcG9ydCAqIGFzIGNvZGVidWlsZCBmcm9tICdAYXdzLWNkay9hd3MtY29kZWJ1aWxkJztcbmltcG9ydCAqIGFzIGNvZGVwaXBlbGluZSBmcm9tICdAYXdzLWNkay9hd3MtY29kZXBpcGVsaW5lJztcbmltcG9ydCAqIGFzIGNvZGVwaXBlbGluZV9hY3Rpb25zIGZyb20gJ0Bhd3MtY2RrL2F3cy1jb2RlcGlwZWxpbmUtYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFBpcGVsaW5lU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgcmVhZG9ubHkgbGFtYmRhVGVzdENvZGU6IGxhbWJkYS5DZm5QYXJhbWV0ZXJzQ29kZTtcbiAgcmVhZG9ubHkgcmVwb05hbWU6IHN0cmluZ1xufVxuXG5leHBvcnQgY2xhc3MgUGF0dGVybjNEZW1vU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkFwcCwgaWQ6IHN0cmluZywgcHJvcHM/OiBQaXBlbGluZVN0YWNrUHJvcHMpIHtcblxuICAgIGlmICghcHJvcHMpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdQcm9wcyBhcmUgbnVsbCAtIHRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbiEnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIFRoaXMgaXMgdGhlIHBpcGVsaW5lIHN0YWNrLCBuZWVkIGEgc2VwYXJhdGUgc3RhY2sgZm9yIHRoZSBcbiAgICAvLyBlbnZpcm9ubWVudCBhbmQgbGFtYmRhIGRlcGxveW1lbnQgc3RlcHNcbiAgICBcbiAgICBjb25zdCBjb2RlID0gbmV3IGNvZGVjb21taXQuUmVwb3NpdG9yeSh0aGlzLCdQYXR0ZXJuM1JlcG8nLHtcbiAgICAgIHJlcG9zaXRvcnlOYW1lOiBwcm9wcy5yZXBvTmFtZVxuICAgIH0pXG5cbiAgICBjb25zdCBidWlsZCA9IG5ldyBjb2RlYnVpbGQuUGlwZWxpbmVQcm9qZWN0KHRoaXMsICdQYXR0ZXJuM0J1aWxkJywge1xuICAgICAgYnVpbGRTcGVjOiBjb2RlYnVpbGQuQnVpbGRTcGVjLmZyb21PYmplY3Qoe1xuICAgICAgICB2ZXJzaW9uOiAnMC4yJyxcbiAgICAgICAgcGhhc2VzOiB7XG4gICAgICAgICAgaW5zdGFsbDoge1xuICAgICAgICAgICAgY29tbWFuZHM6IFsgXG4gICAgICAgICAgICAgICducG0gaW5zdGFsbCdcbiAgICAgICAgICAgIF1cbiAgICAgICAgICB9LFxuICAgICAgICAgIGJ1aWxkOiB7XG4gICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAnbnBtIHJ1biBidWlsZCcsXG4gICAgICAgICAgICAgICducG0gcnVuIGNkayBzeW50aCAtLSAtbyBkaXN0J1xuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBhcnRpZmFjdHM6IHtcbiAgICAgICAgICAnc2Vjb25kYXJ5LWFydGlmYWN0cyc6IHtcbiAgICAgICAgICAgICdCdWlsZE91dHB1dCc6IHtcbiAgICAgICAgICAgICAgJ2Jhc2UtZGlyZWN0b3J5JzogJyRDT0RFQlVJTERfU1JDX0RJUi9kaXN0JyxcbiAgICAgICAgICAgICAgZmlsZXM6IFsgJyAqKi8qJyBdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICdMYW1iZGFCdWlsZE91dHB1dCc6IHtcbiAgICAgICAgICAgICAgJ2Jhc2UtZGlyZWN0b3J5JzogJyRDT0RFQlVJTERfU1JDX0RJUi9sYW1iZGEtdGVzdCcsXG4gICAgICAgICAgICAgIGZpbGVzOiBbICcgKiovKicgXSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIGJ1aWxkSW1hZ2U6IGNvZGVidWlsZC5MaW51eEJ1aWxkSW1hZ2UuQU1BWk9OX0xJTlVYXzJfMyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXQgdmFyaWFibGVzXG4gICAgY29uc3Qgc291cmNlT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgpO1xuICAgIGNvbnN0IGJ1aWxkT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgnQnVpbGRPdXRwdXQnKTtcbiAgICBjb25zdCBsYW1iZGFCdWlsZE91dHB1dCA9IG5ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoJ0xhbWJkYUJ1aWxkT3V0cHV0Jyk7XG4gICAgY29uc3QgdGVzdEVudkRlcGxveU91dHB1dCA9IG5ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoJ1Rlc3RFbnZEZXBsb3lPdXRwdXQnKTtcbiAgICBjb25zdCBwcm9kRW52RGVwbG95T3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgnUHJvZEVudkRlcGxveU91dHB1dCcpO1xuICAgIFxuICAgIGNvbnN0IGxhbWJkYVByb3h5ID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTGFtYmRhVGVzdFByb3h5Jywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfOCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDMpLFxuICAgICAgcmV0cnlBdHRlbXB0czogMCxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhLXByb3h5JykpXG4gICAgfSk7XG5cbiAgICBsYW1iZGFQcm94eS5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9ucyA6IFtcbiAgICAgICAgXCJzdGF0ZXM6U3RhcnRFeGVjdXRpb25cIixcbiAgICAgICAgXCJzdGF0ZXM6RGVzY3JpYmVFeGVjdXRpb25cIixcbiAgICAgICAgXCJzdGF0ZXM6R2V0RXhlY3V0aW9uSGlzdG9yeVwiXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzIDogWycqJ11cbiAgICB9KSlcblxuICAgIG5ldyBjb2RlcGlwZWxpbmUuUGlwZWxpbmUodGhpcywgJ1BpcGVsaW5lJywge1xuICAgICAgc3RhZ2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzdGFnZU5hbWU6ICdTb3VyY2UnLFxuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgIG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5Db2RlQ29tbWl0U291cmNlQWN0aW9uKHtcbiAgICAgICAgICAgICAgYWN0aW9uTmFtZTogJ0NvZGVDb21taXRfU291cmNlJyxcbiAgICAgICAgICAgICAgcmVwb3NpdG9yeTogY29kZSxcbiAgICAgICAgICAgICAgb3V0cHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICAgICAgICAgIGJyYW5jaDogJ2Jhc2VsaW5lJ1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHN0YWdlTmFtZTogJ0J1aWxkJyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuQ29kZUJ1aWxkQWN0aW9uKHtcbiAgICAgICAgICAgICAgYWN0aW9uTmFtZTogJ0J1aWxkJyxcbiAgICAgICAgICAgICAgcHJvamVjdDogYnVpbGQsXG4gICAgICAgICAgICAgIGlucHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICAgICAgICAgIG91dHB1dHM6IFtidWlsZE91dHB1dCwgbGFtYmRhQnVpbGRPdXRwdXRdLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3RhZ2VOYW1lOiAnRGVwbG95VGVzdEVudkxhbWJkYXNBbmRTdGF0ZU1hY2hpbmUnLFxuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgIG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5DbG91ZEZvcm1hdGlvbkNyZWF0ZVVwZGF0ZVN0YWNrQWN0aW9uKHtcbiAgICAgICAgICAgICAgYWN0aW9uTmFtZTogJ1Rlc3RFbnZfQ0ZOX0RlcGxveScsXG4gICAgICAgICAgICAgIHRlbXBsYXRlUGF0aDogYnVpbGRPdXRwdXQuYXRQYXRoKCdQYXR0ZXJuM1Rlc3RFbnZTdGFjay50ZW1wbGF0ZS5qc29uJyksXG4gICAgICAgICAgICAgIHN0YWNrTmFtZTogJ1BhdHRlcm4zVGVzdEVudlN0YWNrJyxcbiAgICAgICAgICAgICAgYWRtaW5QZXJtaXNzaW9uczogdHJ1ZSxcbiAgICAgICAgICAgICAgb3V0cHV0OiB0ZXN0RW52RGVwbG95T3V0cHV0XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5DbG91ZEZvcm1hdGlvbkNyZWF0ZVVwZGF0ZVN0YWNrQWN0aW9uKHtcbiAgICAgICAgICAgICAgLy8gYXNzaWduIHRoZSB2YXJpYWJsZXMgdG8gYSBuYW1lc3BhY2UsIGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9jb2RlcGlwZWxpbmUvbGF0ZXN0L3VzZXJndWlkZS9yZWZlcmVuY2UtdmFyaWFibGVzLmh0bWwjcmVmZXJlbmNlLXZhcmlhYmxlcy13b3JrZmxvd1xuICAgICAgICAgICAgICB2YXJpYWJsZXNOYW1lc3BhY2UgOiAnU3RlcEZ1bmN0aW9uc19DRk5fRGVwbG95JywgXG4gICAgICAgICAgICAgIGFjdGlvbk5hbWU6ICdTdGVwRnVuY3Rpb25zX0NGTl9EZXBsb3knLFxuICAgICAgICAgICAgICB0ZW1wbGF0ZVBhdGg6ICBidWlsZE91dHB1dC5hdFBhdGgoJ1N0ZXBGdW5jdGlvbnNUZXN0U3RhY2sudGVtcGxhdGUuanNvbicpLFxuICAgICAgICAgICAgICBzdGFja05hbWU6ICdTdGVwRnVuY3Rpb25zVGVzdFN0YWNrJyxcbiAgICAgICAgICAgICAgYWRtaW5QZXJtaXNzaW9uczogdHJ1ZSxcbiAgICAgICAgICAgICAgcGFyYW1ldGVyT3ZlcnJpZGVzOiB7XG4gICAgICAgICAgICAgICAgLi4uKHByb3BzKSA/IHByb3BzLmxhbWJkYVRlc3RDb2RlLmFzc2lnbihsYW1iZGFCdWlsZE91dHB1dC5zM0xvY2F0aW9uKSA6IG51bGwsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIGV4dHJhSW5wdXRzOiBbYnVpbGRPdXRwdXQsIGxhbWJkYUJ1aWxkT3V0cHV0XSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIC8vIENhbGwgYSBsYW1iZGEgcHJveHkgYW5kIHBhc3MgaW4gdGhlIHN0YXRlIG1hY2hpbmUgQ0ZOIG91dHB1dCBhcyB2YXJpYWJsZXMuIFRoZSBMYW1iZGEgcHJveHkgd2lsbCBpbnZva2UgdGhlIHVuZGVybHlpbmcgZGVwbG95ZWQgU3RhdGUgTWFjaGluZSBkeW5hbWljYWxseVxuICAgICAgICB7XG4gICAgICAgICAgc3RhZ2VOYW1lOiAnVGVzdCcsXG4gICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkxhbWJkYUludm9rZUFjdGlvbih7XG4gICAgICAgICAgICAgIGFjdGlvbk5hbWU6ICdUZXN0SW52b2tlU3RhdGVNYWNoaW5lJyxcbiAgICAgICAgICAgICAgdXNlclBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAvLyByZXNvbHZlIG5hbWVzcGFjZSBvdXRwdXQgdmFyaWFibGVzLCBodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vY29kZXBpcGVsaW5lL2xhdGVzdC91c2VyZ3VpZGUvcmVmZXJlbmNlLXZhcmlhYmxlcy5odG1sI3JlZmVyZW5jZS12YXJpYWJsZXMtcmVzb2x1dGlvbiBcbiAgICAgICAgICAgICAgICBcIlN0YXRlTWFjaGluZUFyblwiIDogXCIje1N0ZXBGdW5jdGlvbnNfQ0ZOX0RlcGxveS5TdGF0ZU1hY2hpbmVBcm59XCIsIFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBsYW1iZGE6IGxhbWJkYVByb3h5LFxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgXVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3RhZ2VOYW1lOiAnRGVwbG95UHJvZEVudicsXG4gICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkNsb3VkRm9ybWF0aW9uQ3JlYXRlVXBkYXRlU3RhY2tBY3Rpb24oe1xuICAgICAgICAgICAgICBhY3Rpb25OYW1lOiAnUHJvZEVudl9DRk5fRGVwbG95JyxcbiAgICAgICAgICAgICAgdGVtcGxhdGVQYXRoOiBidWlsZE91dHB1dC5hdFBhdGgoJ1BhdHRlcm4zUHJvZEVudlN0YWNrLnRlbXBsYXRlLmpzb24nKSxcbiAgICAgICAgICAgICAgc3RhY2tOYW1lOiAnUGF0dGVybjNQcm9kRW52U3RhY2snLFxuICAgICAgICAgICAgICBhZG1pblBlcm1pc3Npb25zOiB0cnVlLFxuICAgICAgICAgICAgICBvdXRwdXQ6IHByb2RFbnZEZXBsb3lPdXRwdXRcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF1cbiAgICAgICAgfVxuICAgICAgXSxcbiAgICB9KTtcbiAgfVxufSJdfQ==