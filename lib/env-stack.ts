import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import { Tags } from '@aws-cdk/core';

// Create a custom property that determines whether the stack is a test env or prod env
interface MultiStackProps extends cdk.StackProps {
  production?: boolean
}

export class EnvStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: MultiStackProps) {
    super(scope, id, props);

    const isProd = (props && props.production)
    const bucketName = isProd ? 'MyPattern3ProductionBucket' : 'MyPattern3TestBucket';
    const vpcName = isProd ? 'MyPattern3ProductionVpc' : 'MyPattern3TestVpc';

    const bucket = new s3.Bucket(this, bucketName, {
      encryption: s3.BucketEncryption.KMS_MANAGED, 
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    
    Tags.of(bucket).add('myDefaultTag', 'hooray-for-tagging')

    // Create a vpc
    const vpc = new ec2.Vpc(this, vpcName, { maxAzs: 2 });

  }
}
