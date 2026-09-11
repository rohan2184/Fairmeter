#!/usr/bin/env node
import { App } from 'aws-cdk-lib';

import { FairmeterStack } from '../lib/fairmeter-stack';

const app = new App();

new FairmeterStack(app, 'FairmeterStack', {
  // Falls back to whatever `aws configure` has set. The bucket lives in this region;
  // CloudFront itself is global, so the choice only affects origin-fetch latency on a
  // cache miss and the (marginal) per-GB storage price.
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.AWS_REGION ?? process.env.CDK_DEFAULT_REGION,
  },
  description: 'Static hosting for Fairmeter: private S3 origin behind CloudFront.',
});
