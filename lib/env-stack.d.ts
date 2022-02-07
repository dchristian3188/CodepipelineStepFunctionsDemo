import * as cdk from '@aws-cdk/core';
interface MultiStackProps extends cdk.StackProps {
    production?: boolean;
}
export declare class EnvStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: MultiStackProps);
}
export {};
