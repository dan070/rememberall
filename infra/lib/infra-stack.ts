import * as cdk from 'aws-cdk-lib/core';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import * as path from 'node:path';

const BEARER_TOKEN_PARAM = '/rememberall/bearer-token';

// Step 2: adds the sync backend (DynamoDB + Lambda Function URL) behind
// the same CloudFront distribution Step 1 stood up — see the "AWS backend
// plan" conversation this stack came out of for why Step 1 shipped
// static-site-only first.
export class InfraStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly api: lambda.FunctionUrl;
  public readonly siteUrl: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Single-table design (see api/src/stacks.ts): pk/sk cover stacks;
    // GSI1 serves delta sync, keyed on updatedAt so last-write-wins merge
    // works client-side — same pattern as weightwatcher's table.
    //
    // RETAIN on delete: this is personal data for one user — never
    // destroy it as a side effect of a stack teardown.
    this.table = new dynamodb.Table(this, 'Table', {
      tableName: 'rememberall',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: 'gsi1',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Created out-of-band (AWS CLI), not by CDK — a secret value must
    // never sit in a CloudFormation template or this source tree. We only
    // reference it by name here, and only to grant read access; CDK never
    // sees or handles the value.
    const bearerTokenParam = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      'BearerTokenParam',
      { parameterName: BEARER_TOKEN_PARAM },
    );

    // api/ is a sibling of infra/ (monorepo layout), not nested under it —
    // NodejsFunction needs an explicit projectRoot + lockfile path or it
    // assumes the entry lives under infra/ and fails with PathNotUnderRoot.
    const apiDir = path.join(__dirname, '../../api');

    const apiFn = new NodejsFunction(this, 'ApiFunction', {
      entry: path.join(apiDir, 'src/handler.ts'),
      projectRoot: apiDir,
      depsLockFilePath: path.join(apiDir, 'package-lock.json'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      // Bounds concurrent invocations so a burst against the endpoint
      // can't fan out arbitrarily — matches weightwatcher's cost-abuse
      // safeguard. Harmless at this app's actual (single-user) traffic.
      reservedConcurrentExecutions: 2,
      environment: {
        TABLE_NAME: this.table.tableName,
        BEARER_TOKEN_PARAM,
      },
      bundling: {
        // esbuild bundling, no Docker required — matches this
        // environment's constraints (no Docker available).
        minify: true,
        sourceMap: true,
      },
    });

    this.table.grantReadWriteData(apiFn);
    bearerTokenParam.grantRead(apiFn);

    // AWS_IAM (not NONE): required for the Function URL to sit behind
    // CloudFront's Origin Access Control below — direct requests to the
    // Function URL itself are rejected by AWS before they ever reach our
    // code. Traffic must come through CloudFront.
    this.api = apiFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.GET, lambda.HttpMethod.POST],
        allowedHeaders: ['authorization', 'content-type', 'x-rmb-token', 'x-amz-content-sha256'],
      },
    });

    // Private bucket, no public access of any kind — CloudFront is the
    // only allowed reader, via Origin Access Control.
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Same CloudFront distribution serves both the app shell and /api/* —
    // this makes API calls same-origin from the browser's perspective, so
    // there's no CORS preflight on the hot path (putStack/sync). /api/*
    // must never be cached: CachePolicy.CACHING_DISABLED, and
    // ALL_VIEWER_EXCEPT_HOST_HEADER so the Authorization header (and every
    // other client header) actually reaches the Lambda — the default
    // origin request policy for custom origins strips most headers.
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: origins.FunctionUrlOrigin.withOriginAccessControl(this.api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });

    // AWS added a second required permission for Function URL invocations
    // in October 2025 (lambda:InvokeFunction, alongside the pre-existing
    // lambda:InvokeFunctionUrl) — this CDK version's OAC helper predates
    // that change and only grants the first one, which silently 403s every
    // request at the AWS layer before it ever reaches our code (same fix
    // weightwatcher needed). Add the second grant explicitly, scoped the
    // same way: only this distribution, only via the function URL.
    apiFn.addPermission('AllowCloudFrontInvokeFunction', {
      principal: new iam.ServicePrincipal('cloudfront.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
      invokedViaFunctionUrl: true,
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
