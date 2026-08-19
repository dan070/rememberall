import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { InfraStack } from '../lib/infra-stack';

describe('RememberallStack', () => {
  const app = new cdk.App();
  const stack = new InfraStack(app, 'TestStack', { env: { account: '493501040701', region: 'eu-north-1' } });
  const template = Template.fromStack(stack);

  it('creates a private S3 bucket with no public access', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it('creates a CloudFront distribution', () => {
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  });

  it('does not create a DynamoDB table or a Lambda Function URL (Step 1 is static-site-only)', () => {
    // A Lambda DOES show up here — CDK's BucketDeployment construct uses
    // one internally (a custom resource that copies files into S3 and
    // triggers the CloudFront invalidation) — that's plumbing, not an
    // application function, so it's not asserted against. What Step 1
    // must NOT have is a table or an app-facing Lambda Function URL;
    // those arrive in Step 2 with the sync code that uses them.
    template.resourceCountIs('AWS::DynamoDB::Table', 0);
    template.resourceCountIs('AWS::Lambda::Url', 0);
  });
});
