import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import { PipelineStackProps } from './pattern3-demo-stack';
export declare class StepFunctionsTestStack extends cdk.Stack {
    readonly lambdaTestCode: lambda.CfnParametersCode;
    constructor(scope: cdk.App, id: string, props?: PipelineStackProps);
}
