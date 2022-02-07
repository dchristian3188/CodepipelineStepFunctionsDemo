#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { Pattern3DemoStack } from '../lib/pattern3-demo-stack';
import { StepFunctionsTestStack } from '../lib/stepfunctions-test-stack';
import { EnvStack } from '../lib/env-stack';

const app = new cdk.App();

// Create two environment stacks, one for Test and one for Prod
const testEnvStack = new EnvStack(app, 'Pattern3TestEnvStack', {
    production: false
});
const prodEnvSttack = new EnvStack(app, 'Pattern3ProdEnvStack', {
    production: true
})

// Create the Lambda Test Stack
const lambdaStack = new StepFunctionsTestStack(app, 'StepFunctionsTestStack');

// Create the Pattern 3 Pipeline Stack
new Pattern3DemoStack(app, 'Pattern3DemoStack', {
    lambdaTestCode: lambdaStack.lambdaTestCode,
    repoName: 'CodePipelineStepFunctions'
});
