import * as cdk from 'aws-cdk-lib/core';
import { RemovalPolicy } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'node:path';

// Step 1 scope only: serve the already-built PWA from a real HTTPS URL.
// No DynamoDB/Lambda/SSM yet — those arrive in Step 2 together with the
// sync code that actually needs them, so nothing here sits unused waiting
// for a consumer (see the "AWS backend plan" conversation this stack came
// out of for why the steps were split this way).
export class InfraStack extends cdk.Stack {
  public readonly siteUrl: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Private bucket, no public access of any kind — CloudFront is the
    // only allowed reader, via Origin Access Control. RETAIN + no
    // autoDeleteObjects: this holds the built app only (no user data yet),
    // but there's no reason to let a stack teardown silently destroy it.
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });

    new s3deploy.BucketDeployment(this, 'SiteDeployment', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../web/dist'))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    this.siteUrl = `https://${distribution.distributionDomainName}`;

    new cdk.CfnOutput(this, 'SiteUrl', {
      value: this.siteUrl,
    });
  }
}
