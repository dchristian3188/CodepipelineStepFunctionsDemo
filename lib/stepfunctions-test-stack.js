"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepFunctionsTestStack = void 0;
const cdk = require("@aws-cdk/core");
const lambda = require("@aws-cdk/aws-lambda");
const sfn = require("@aws-cdk/aws-stepfunctions");
const tasks = require("@aws-cdk/aws-stepfunctions-tasks");
const iam = require("@aws-cdk/aws-iam");
// This stack defines Lambda tests to be deployed as a part of the Pattern 2 CodePipeline
class StepFunctionsTestStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Define Lambda Test Defaults
        this.lambdaTestCode = lambda.Code.fromCfnParameters();
        const lambdaTestDefaults = new lambda.Function(this, 'LambdaTestDefaults', {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'index.handler',
            timeout: cdk.Duration.minutes(3),
            retryAttempts: 0,
            memorySize: 128,
            code: this.lambdaTestCode,
        });
        // Allow this lambda to get S3 config info it needs
        let defaultsRole = new iam.PolicyStatement();
        defaultsRole.addActions('cloudformation:DescribeStackResource', 'cloudformation:DescribeStackResources', 'cloudformation:DescribeStacks', 'cloudformation:ListStackResources', 's3:GetBucketTagging', 's3:GetBucketVersioning');
        defaultsRole.addResources('*');
        lambdaTestDefaults.addToRolePolicy(defaultsRole);
        // Define Lambda Test Networking
        const lambdaTestNetworking = new lambda.Function(this, 'LambdaTestNetworking', {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'index.handler',
            timeout: cdk.Duration.minutes(3),
            retryAttempts: 0,
            memorySize: 512,
            code: this.lambdaTestCode,
        });
        // Allow this lambda to get S3 config info it needs
        let networkingRole = new iam.PolicyStatement();
        networkingRole.addActions('cloudformation:DescribeStackResource', 'cloudformation:DescribeStackResources', 'cloudformation:DescribeStacks', 'cloudformation:ListStackResources', 'ec2:DescribeVpcs', 'ec2:DescribeSubnets');
        networkingRole.addResources('*');
        lambdaTestNetworking.addToRolePolicy(networkingRole);
        // Define Lambda Test Security
        const lambdaTestSecurity = new lambda.Function(this, 'LambdaTestSecurity', {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'index.handler',
            timeout: cdk.Duration.minutes(3),
            retryAttempts: 0,
            memorySize: 512,
            code: this.lambdaTestCode
        });
        // Allow thie lambda to get S3 config info it needs
        let securityRole = new iam.PolicyStatement();
        securityRole.addActions('cloudformation:DescribeStackResource', 'cloudformation:DescribeStackResources', 'cloudformation:DescribeStacks', 'cloudformation:ListStackResources', 's3:GetBucketAcl', 'ec2:DescribeRouteTables');
        securityRole.addResources('*');
        lambdaTestSecurity.addToRolePolicy(securityRole);
        // Create Step Functions Lambda Invocations for each test suite 
        const invokeDefaults = new tasks.LambdaInvoke(this, 'Invoke Default Tests', {
            lambdaFunction: lambdaTestDefaults,
            invocationType: tasks.LambdaInvocationType.REQUEST_RESPONSE,
            payload: {
                type: sfn.InputType.TEXT,
                value: {
                    "suite": "default"
                },
            },
            outputPath: '$.Payload'
        });
        const invokeNetworking = new tasks.LambdaInvoke(this, 'Invoke Networking Tests', {
            lambdaFunction: lambdaTestNetworking,
            invocationType: tasks.LambdaInvocationType.REQUEST_RESPONSE,
            payload: {
                type: sfn.InputType.TEXT,
                value: {
                    "suite": "networking"
                },
            },
            outputPath: '$.Payload'
        });
        const invokeSecurity = new tasks.LambdaInvoke(this, 'Invoke Security Tests', {
            lambdaFunction: lambdaTestSecurity,
            invocationType: tasks.LambdaInvocationType.REQUEST_RESPONSE,
            payload: {
                type: sfn.InputType.TEXT,
                value: {
                    "suite": "security"
                },
            },
            outputPath: '$.Payload'
        });
        // Define Lambda to consolidate test results
        const lambdaConsolidateResults = new lambda.Function(this, 'LambdaConsolidateResults', {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'consolidate.handler',
            timeout: cdk.Duration.minutes(3),
            retryAttempts: 0,
            memorySize: 512,
            code: this.lambdaTestCode
        });
        const invokeConsolidateResults = new tasks.LambdaInvoke(this, 'Invoke Consolidate Results', {
            lambdaFunction: lambdaConsolidateResults,
            invocationType: tasks.LambdaInvocationType.REQUEST_RESPONSE,
            outputPath: '$.Payload',
        });
        // Create Step Functions start, failure, and success states
        const startState = new sfn.Pass(this, 'StartState');
        const success = new sfn.Pass(this, 'All tests passed');
        const fail = new sfn.Fail(this, 'At least one test failed', {
            cause: 'States.StringToJson($.failures)',
            error: '$.failures',
        });
        // Chain the invocation tasks in parallel
        const stepChain = new sfn.Parallel(this, 'Run tests in parallel');
        stepChain.branch(invokeDefaults);
        stepChain.branch(invokeNetworking);
        stepChain.branch(invokeSecurity);
        // Catch failures or report success
        // TODO: Add state to check and consolidate output of Lambdas 
        stepChain.next(invokeConsolidateResults)
            .next(new sfn.Choice(this, 'Did any tests fail')
            .when(sfn.Condition.numberGreaterThan('$.testsFailed', 0), fail)
            .otherwise(success));
        const definition = startState
            .next(stepChain);
        const machine = new sfn.StateMachine(this, 'TestMachine', {
            definition: definition,
        });
        // Publish State Machine ARN as an output - it's needed to invoke the Lmabda later in the pipeline
        new cdk.CfnOutput(this, 'StateMachineArn', { value: machine.stateMachineArn });
    }
}
exports.StepFunctionsTestStack = StepFunctionsTestStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RlcGZ1bmN0aW9ucy10ZXN0LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic3RlcGZ1bmN0aW9ucy10ZXN0LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFDQUFxQztBQUNyQyw4Q0FBOEM7QUFFOUMsa0RBQWtEO0FBQ2xELDBEQUEwRDtBQUMxRCx3Q0FBd0M7QUFFeEMseUZBQXlGO0FBQ3pGLE1BQWEsc0JBQXVCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFNbkQsWUFBWSxLQUFjLEVBQUUsRUFBVSxFQUFFLEtBQTBCO1FBQ2hFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLDhCQUE4QjtRQUM5QixJQUFJLENBQUMsY0FBYyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUN0RCxNQUFNLGtCQUFrQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDekUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBVTtZQUNsQyxPQUFPLEVBQUUsZUFBZTtZQUN4QixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLGFBQWEsRUFBRSxDQUFDO1lBQ2hCLFVBQVUsRUFBRSxHQUFHO1lBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxjQUFjO1NBQzFCLENBQUMsQ0FBQTtRQUVGLG1EQUFtRDtRQUNuRCxJQUFJLFlBQVksR0FBRyxJQUFJLEdBQUcsQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUM3QyxZQUFZLENBQUMsVUFBVSxDQUNyQixzQ0FBc0MsRUFDdEMsdUNBQXVDLEVBQ3ZDLCtCQUErQixFQUMvQixtQ0FBbUMsRUFDbkMscUJBQXFCLEVBQ3JCLHdCQUF3QixDQUN2QixDQUFDO1FBQ0osWUFBWSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FB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QyxLQUFLLEVBQUUsWUFBWTtTQUNwQixDQUFDLENBQUM7UUFFSCx5Q0FBeUM7UUFDekMsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx1QkFBdUIsQ0FBQyxDQUFDO1FBQ2xFLFNBQVMsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDakMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ25DLFNBQVMsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUM7UUFFakMsbUNBQW1DO1FBQ25DLDhEQUE4RDtRQUM5RCxTQUFTLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDO2FBQ3ZDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLG9CQUFvQixDQUFDO2FBQzdDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGlCQUFpQixDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUM7YUFDL0QsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFFdkIsTUFBTSxVQUFVLEdBQUcsVUFBVTthQUM1QixJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFakIsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDeEQsVUFBVSxFQUFFLFVBQVU7U0FDdkIsQ0FBQyxDQUFDO1FBRUgsa0dBQWtHO1FBQ2xHLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUM7SUFFakYsQ0FBQztDQUVGO0FBcktELHdEQXFLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdAYXdzLWNkay9hd3MtbGFtYmRhJztcbmltcG9ydCB7UGlwZWxpbmVTdGFja1Byb3BzfSBmcm9tICcuL3BhdHRlcm4zLWRlbW8tc3RhY2snO1xuaW1wb3J0ICogYXMgc2ZuIGZyb20gJ0Bhd3MtY2RrL2F3cy1zdGVwZnVuY3Rpb25zJztcbmltcG9ydCAqIGFzIHRhc2tzIGZyb20gJ0Bhd3MtY2RrL2F3cy1zdGVwZnVuY3Rpb25zLXRhc2tzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdAYXdzLWNkay9hd3MtaWFtJztcblxuLy8gVGhpcyBzdGFjayBkZWZpbmVzIExhbWJkYSB0ZXN0cyB0byBiZSBkZXBsb3llZCBhcyBhIHBhcnQgb2YgdGhlIFBhdHRlcm4gMiBDb2RlUGlwZWxpbmVcbmV4cG9ydCBjbGFzcyBTdGVwRnVuY3Rpb25zVGVzdFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcblxuICAvLyBQYXJhbWV0ZXJzIHBhc3NlZCBpbnRvIHRoZSBzdGFjayBmcm9tIHRoZSBDb2RlUGlwZWxpbmUgYnVpbGQgc3RlcFxuICAvLyBQb2ludCB0byB0aGUgUzMgbG9jYXRpb24gb2YgdGhlIGNvZGUgZm9yIHRoZSBsYW1iZGFzXG4gIHB1YmxpYyByZWFkb25seSBsYW1iZGFUZXN0Q29kZTogbGFtYmRhLkNmblBhcmFtZXRlcnNDb2RlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQXBwLCBpZDogc3RyaW5nLCBwcm9wcz86IFBpcGVsaW5lU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuICAgIFxuICAgIC8vIERlZmluZSBMYW1iZGEgVGVzdCBEZWZhdWx0c1xuICAgIHRoaXMubGFtYmRhVGVzdENvZGUgPSBsYW1iZGEuQ29kZS5mcm9tQ2ZuUGFyYW1ldGVycygpO1xuICAgIGNvbnN0IGxhbWJkYVRlc3REZWZhdWx0cyA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0xhbWJkYVRlc3REZWZhdWx0cycsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzgsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygzKSxcbiAgICAgIHJldHJ5QXR0ZW1wdHM6IDAsXG4gICAgICBtZW1vcnlTaXplOiAxMjgsXG4gICAgICBjb2RlOiB0aGlzLmxhbWJkYVRlc3RDb2RlLFxuICAgIH0pXG5cbiAgICAvLyBBbGxvdyB0aGlzIGxhbWJkYSB0byBnZXQgUzMgY29uZmlnIGluZm8gaXQgbmVlZHNcbiAgICBsZXQgZGVmYXVsdHNSb2xlID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoKTtcbiAgICBkZWZhdWx0c1JvbGUuYWRkQWN0aW9ucyhcbiAgICAgICdjbG91ZGZvcm1hdGlvbjpEZXNjcmliZVN0YWNrUmVzb3VyY2UnLFxuICAgICAgJ2Nsb3VkZm9ybWF0aW9uOkRlc2NyaWJlU3RhY2tSZXNvdXJjZXMnLFxuICAgICAgJ2Nsb3VkZm9ybWF0aW9uOkRlc2NyaWJlU3RhY2tzJyxcbiAgICAgICdjbG91ZGZvcm1hdGlvbjpMaXN0U3RhY2tSZXNvdXJjZXMnLFxuICAgICAgJ3MzOkdldEJ1Y2tldFRhZ2dpbmcnLFxuICAgICAgJ3MzOkdldEJ1Y2tldFZlcnNpb25pbmcnXG4gICAgICApO1xuICAgIGRlZmF1bHRzUm9sZS5hZGRSZXNvdXJjZXMoJyonKTtcbiAgICBsYW1iZGFUZXN0RGVmYXVsdHMuYWRkVG9Sb2xlUG9saWN5KGRlZmF1bHRzUm9sZSk7XG5cbiAgICAvLyBEZWZpbmUgTGFtYmRhIFRlc3QgTmV0d29ya2luZ1xuICAgIGNvbnN0IGxhbWJkYVRlc3ROZXR3b3JraW5nID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTGFtYmRhVGVzdE5ldHdvcmtpbmcnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM184LFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMyksXG4gICAgICByZXRyeUF0dGVtcHRzOiAwLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgY29kZTogdGhpcy5sYW1iZGFUZXN0Q29kZSxcbiAgICB9KVxuXG4gICAgLy8gQWxsb3cgdGhpcyBsYW1iZGEgdG8gZ2V0IFMzIGNvbmZpZyBpbmZvIGl0IG5lZWRzXG4gICAgbGV0IG5ldHdvcmtpbmdSb2xlID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoKTtcbiAgICBuZXR3b3JraW5nUm9sZS5hZGRBY3Rpb25zKFxuICAgICAgJ2Nsb3VkZm9ybWF0aW9uOkRlc2NyaWJlU3RhY2tSZXNvdXJjZScsXG4gICAgICAnY2xvdWRmb3JtYXRpb246RGVzY3JpYmVTdGFja1Jlc291cmNlcycsXG4gICAgICAnY2xvdWRmb3JtYXRpb246RGVzY3JpYmVTdGFja3MnLFxuICAgICAgJ2Nsb3VkZm9ybWF0aW9uOkxpc3RTdGFja1Jlc291cmNlcycsXG4gICAgICAnZWMyOkRlc2NyaWJlVnBjcycsXG4gICAgICAnZWMyOkRlc2NyaWJlU3VibmV0cydcbiAgICAgICk7XG4gICAgICBuZXR3b3JraW5nUm9sZS5hZGRSZXNvdXJjZXMoJyonKTtcbiAgICAgIGxhbWJkYVRlc3ROZXR3b3JraW5nLmFkZFRvUm9sZVBvbGljeShuZXR3b3JraW5nUm9sZSk7XG5cbiAgICAvLyBEZWZpbmUgTGFtYmRhIFRlc3QgU2VjdXJpdHlcbiAgICBjb25zdCBsYW1iZGFUZXN0U2VjdXJpdHkgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdMYW1iZGFUZXN0U2VjdXJpdHknLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM184LFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMyksXG4gICAgICByZXRyeUF0dGVtcHRzOiAwLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgY29kZTogdGhpcy5sYW1iZGFUZXN0Q29kZVxuICAgIH0pXG5cbiAgICAvLyBBbGxvdyB0aGllIGxhbWJkYSB0byBnZXQgUzMgY29uZmlnIGluZm8gaXQgbmVlZHNcbiAgICBsZXQgc2VjdXJpdHlSb2xlID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoKTtcbiAgICBzZWN1cml0eVJvbGUuYWRkQWN0aW9ucyhcbiAgICAgICdjbG91ZGZvcm1hdGlvbjpEZXNjcmliZVN0YWNrUmVzb3VyY2UnLFxuICAgICAgJ2Nsb3VkZm9ybWF0aW9uOkRlc2NyaWJlU3RhY2tSZXNvdXJjZXMnLFxuICAgICAgJ2Nsb3VkZm9ybWF0aW9uOkRlc2NyaWJlU3RhY2tzJyxcbiAgICAgICdjbG91ZGZvcm1hdGlvbjpMaXN0U3RhY2tSZXNvdXJjZXMnLFxuICAgICAgJ3MzOkdldEJ1Y2tldEFjbCcsXG4gICAgICAnZWMyOkRlc2NyaWJlUm91dGVUYWJsZXMnXG4gICAgICApO1xuICAgIHNlY3VyaXR5Um9sZS5hZGRSZXNvdXJjZXMoJyonKTtcbiAgICBsYW1iZGFUZXN0U2VjdXJpdHkuYWRkVG9Sb2xlUG9saWN5KHNlY3VyaXR5Um9sZSk7XG5cbiAgICAvLyBDcmVhdGUgU3RlcCBGdW5jdGlvbnMgTGFtYmRhIEludm9jYXRpb25zIGZvciBlYWNoIHRlc3Qgc3VpdGUgXG4gICAgY29uc3QgaW52b2tlRGVmYXVsdHMgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdJbnZva2UgRGVmYXVsdCBUZXN0cycsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBsYW1iZGFUZXN0RGVmYXVsdHMsXG4gICAgICBpbnZvY2F0aW9uVHlwZTogdGFza3MuTGFtYmRhSW52b2NhdGlvblR5cGUuUkVRVUVTVF9SRVNQT05TRSxcbiAgICAgIHBheWxvYWQ6IHtcbiAgICAgICAgdHlwZTogc2ZuLklucHV0VHlwZS5URVhULFxuICAgICAgICB2YWx1ZTogeyBcbiAgICAgICAgICBcInN1aXRlXCI6XCJkZWZhdWx0XCIgXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgb3V0cHV0UGF0aDogJyQuUGF5bG9hZCdcbiAgICB9KTtcblxuICAgIGNvbnN0IGludm9rZU5ldHdvcmtpbmcgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdJbnZva2UgTmV0d29ya2luZyBUZXN0cycsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBsYW1iZGFUZXN0TmV0d29ya2luZyxcbiAgICAgIGludm9jYXRpb25UeXBlOiB0YXNrcy5MYW1iZGFJbnZvY2F0aW9uVHlwZS5SRVFVRVNUX1JFU1BPTlNFLFxuICAgICAgcGF5bG9hZDoge1xuICAgICAgICB0eXBlOiBzZm4uSW5wdXRUeXBlLlRFWFQsXG4gICAgICAgIHZhbHVlOiB7IFxuICAgICAgICAgIFwic3VpdGVcIjpcIm5ldHdvcmtpbmdcIiBcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBvdXRwdXRQYXRoOiAnJC5QYXlsb2FkJ1xuICAgIH0pO1xuXG4gICAgY29uc3QgaW52b2tlU2VjdXJpdHkgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdJbnZva2UgU2VjdXJpdHkgVGVzdHMnLCB7XG4gICAgICBsYW1iZGFGdW5jdGlvbjogbGFtYmRhVGVzdFNlY3VyaXR5LFxuICAgICAgaW52b2NhdGlvblR5cGU6IHRhc2tzLkxhbWJkYUludm9jYXRpb25UeXBlLlJFUVVFU1RfUkVTUE9OU0UsXG4gICAgICBwYXlsb2FkOiB7XG4gICAgICAgIHR5cGU6IHNmbi5JbnB1dFR5cGUuVEVYVCxcbiAgICAgICAgdmFsdWU6IHsgXG4gICAgICAgICAgXCJzdWl0ZVwiOlwic2VjdXJpdHlcIiBcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBvdXRwdXRQYXRoOiAnJC5QYXlsb2FkJ1xuICAgIH0pO1xuICBcbiAgICAvLyBEZWZpbmUgTGFtYmRhIHRvIGNvbnNvbGlkYXRlIHRlc3QgcmVzdWx0c1xuICAgIGNvbnN0IGxhbWJkYUNvbnNvbGlkYXRlUmVzdWx0cyA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0xhbWJkYUNvbnNvbGlkYXRlUmVzdWx0cycsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzgsXG4gICAgICBoYW5kbGVyOiAnY29uc29saWRhdGUuaGFuZGxlcicsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygzKSxcbiAgICAgIHJldHJ5QXR0ZW1wdHM6IDAsXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBjb2RlOiB0aGlzLmxhbWJkYVRlc3RDb2RlXG4gICAgfSlcblxuICAgIGNvbnN0IGludm9rZUNvbnNvbGlkYXRlUmVzdWx0cyA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2UodGhpcywgJ0ludm9rZSBDb25zb2xpZGF0ZSBSZXN1bHRzJywge1xuICAgICAgbGFtYmRhRnVuY3Rpb246IGxhbWJkYUNvbnNvbGlkYXRlUmVzdWx0cyxcbiAgICAgIGludm9jYXRpb25UeXBlOiB0YXNrcy5MYW1iZGFJbnZvY2F0aW9uVHlwZS5SRVFVRVNUX1JFU1BPTlNFLFxuICAgICAgb3V0cHV0UGF0aDogJyQuUGF5bG9hZCcsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgU3RlcCBGdW5jdGlvbnMgc3RhcnQsIGZhaWx1cmUsIGFuZCBzdWNjZXNzIHN0YXRlc1xuICAgIGNvbnN0IHN0YXJ0U3RhdGUgPSBuZXcgc2ZuLlBhc3ModGhpcywgJ1N0YXJ0U3RhdGUnKTtcbiAgICBjb25zdCBzdWNjZXNzID0gbmV3IHNmbi5QYXNzKHRoaXMsICdBbGwgdGVzdHMgcGFzc2VkJyk7XG4gICAgY29uc3QgZmFpbCA9IG5ldyBzZm4uRmFpbCh0aGlzLCAnQXQgbGVhc3Qgb25lIHRlc3QgZmFpbGVkJywge1xuICAgICAgY2F1c2U6ICdTdGF0ZXMuU3RyaW5nVG9Kc29uKCQuZmFpbHVyZXMpJyxcbiAgICAgIGVycm9yOiAnJC5mYWlsdXJlcycsXG4gICAgfSk7XG5cbiAgICAvLyBDaGFpbiB0aGUgaW52b2NhdGlvbiB0YXNrcyBpbiBwYXJhbGxlbFxuICAgIGNvbnN0IHN0ZXBDaGFpbiA9IG5ldyBzZm4uUGFyYWxsZWwodGhpcywgJ1J1biB0ZXN0cyBpbiBwYXJhbGxlbCcpO1xuICAgIHN0ZXBDaGFpbi5icmFuY2goaW52b2tlRGVmYXVsdHMpO1xuICAgIHN0ZXBDaGFpbi5icmFuY2goaW52b2tlTmV0d29ya2luZyk7XG4gICAgc3RlcENoYWluLmJyYW5jaChpbnZva2VTZWN1cml0eSk7XG5cbiAgICAvLyBDYXRjaCBmYWlsdXJlcyBvciByZXBvcnQgc3VjY2Vzc1xuICAgIC8vIFRPRE86IEFkZCBzdGF0ZSB0byBjaGVjayBhbmQgY29uc29saWRhdGUgb3V0cHV0IG9mIExhbWJkYXMgXG4gICAgc3RlcENoYWluLm5leHQoaW52b2tlQ29uc29saWRhdGVSZXN1bHRzKVxuICAgIC5uZXh0KG5ldyBzZm4uQ2hvaWNlKHRoaXMsICdEaWQgYW55IHRlc3RzIGZhaWwnKVxuICAgICAgLndoZW4oc2ZuLkNvbmRpdGlvbi5udW1iZXJHcmVhdGVyVGhhbignJC50ZXN0c0ZhaWxlZCcsIDApLCBmYWlsKVxuICAgICAgLm90aGVyd2lzZShzdWNjZXNzKSk7XG5cbiAgICBjb25zdCBkZWZpbml0aW9uID0gc3RhcnRTdGF0ZVxuICAgIC5uZXh0KHN0ZXBDaGFpbik7XG5cbiAgICBjb25zdCBtYWNoaW5lID0gbmV3IHNmbi5TdGF0ZU1hY2hpbmUodGhpcywgJ1Rlc3RNYWNoaW5lJywge1xuICAgICAgZGVmaW5pdGlvbjogZGVmaW5pdGlvbixcbiAgICB9KTtcblxuICAgIC8vIFB1Ymxpc2ggU3RhdGUgTWFjaGluZSBBUk4gYXMgYW4gb3V0cHV0IC0gaXQncyBuZWVkZWQgdG8gaW52b2tlIHRoZSBMbWFiZGEgbGF0ZXIgaW4gdGhlIHBpcGVsaW5lXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1N0YXRlTWFjaGluZUFybicsIHsgdmFsdWU6IG1hY2hpbmUuc3RhdGVNYWNoaW5lQXJuIH0pO1xuICAgIFxuICB9XG5cbn1cbiJdfQ==