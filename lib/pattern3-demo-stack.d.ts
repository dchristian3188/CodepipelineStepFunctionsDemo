import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
export interface PipelineStackProps extends cdk.StackProps {
    readonly lambdaTestCode: lambda.CfnParametersCode;
    readonly repoName: string;
}
export declare class Pattern3DemoStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: PipelineStackProps);
}
