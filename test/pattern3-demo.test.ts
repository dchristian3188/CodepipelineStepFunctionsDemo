import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as Pattern3Demo from '../lib/pattern3-demo-stack';
import * as lambda from '@aws-cdk/aws-lambda';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Pattern3Demo.Pattern3DemoStack(app, 'MyTestStack', {
      lambdaTestCode: new lambda.CfnParametersCode(),
      repoName: 'pattern2'
    });
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
