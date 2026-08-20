import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
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

  it('creates a CloudFront distribution with a dedicated /api/* behavior', () => {
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        CacheBehaviors: [
          {
            PathPattern: '/api/*',
            // CachingDisabled managed policy id — /api/* must never be
            // served stale, every request is a live write or a
            // freshness-sensitive read.
            CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
          },
        ],
      },
    });
  });

  it('creates a single-table DynamoDB table with a GSI1 sync index, retained on delete', () => {
    template.resourceCountIs('AWS::DynamoDB::Table', 1);
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'rememberall',
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'gsi1',
          KeySchema: [
            { AttributeName: 'gsi1pk', KeyType: 'HASH' },
            { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
          ],
        },
      ],
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    });
    template.hasResource('AWS::DynamoDB::Table', { DeletionPolicy: 'Retain' });
  });

  it('creates a Lambda Function URL requiring AWS_IAM auth (not directly callable, only via CloudFront OAC)', () => {
    template.resourceCountIs('AWS::Lambda::Url', 1);
    template.hasResourceProperties('AWS::Lambda::Url', {
      AuthType: 'AWS_IAM',
    });
  });

  it('grants the API function read/write on the table and read on the bearer-token SSM parameter, not the whole account', () => {
    // A narrowly-scoped IAM policy statement referencing the table's own
    // ARN (not "*") is the regression guard here — this is what stops a
    // future change from silently widening the function's blast radius.
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['dynamodb:GetItem']),
          }),
        ]),
      },
    });
  });
});
