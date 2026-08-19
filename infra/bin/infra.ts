#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { Tags } from 'aws-cdk-lib';
import { InfraStack } from '../lib/infra-stack';

// Guard against accidentally deploying to the wrong AWS account (e.g. a
// Schibsted profile left active in the shell instead of the rememberall
// one). Same account as WeightWatcher (kept together for billing
// simplicity), but a distinct IAM user (rememberall-cli) and project tag —
// see the AWS-setup conversation this stack came out of for why.
const EXPECTED_ACCOUNT = '493501040701';
const REGION = 'eu-north-1';

const account = process.env.CDK_DEFAULT_ACCOUNT;
if (account && account !== EXPECTED_ACCOUNT) {
  throw new Error(
    `Refusing to deploy: active AWS account is ${account}, expected ${EXPECTED_ACCOUNT} (rememberall profile). ` +
      `Check AWS_PROFILE / --profile before running cdk commands.`,
  );
}

const app = new cdk.App();

const stack = new InfraStack(app, 'RememberallStack', {
  env: { account: EXPECTED_ACCOUNT, region: REGION },
});

// Applied to every resource in every stack under this app — this is how
// we'll identify Rememberall's AWS footprint later (billing, cleanup,
// audits), kept fully distinct from WeightWatcher's `project: weightwatcher`
// tag even though both live in the same AWS account.
Tags.of(app).add('project', 'rememberall');
Tags.of(app).add('managed-by', 'cdk');

void stack;
