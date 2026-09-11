import * as path from 'node:path';
import * as fs from 'node:fs';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as deployment from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';

/** Built output of the Vite app — `npm --prefix ../app run build` produces this. */
const DIST = path.resolve(__dirname, '..', '..', 'app', 'dist');

/**
 * Fairmeter is a pure client-side SPA (D-03: persistence is browser-local), so the whole
 * deployment is a private bucket behind CloudFront. No compute, no VPC, no database.
 */
export class FairmeterStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    if (!fs.existsSync(path.join(DIST, 'index.html'))) {
      throw new Error(
        `No build found at ${DIST}. Run \`npm --prefix ../app run build\` first (or use \`npm run deploy\`, which builds for you).`,
      );
    }

    // Private origin. Nothing is world-readable on the bucket itself; CloudFront reads it
    // through an Origin Access Control signature.
    const bucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // The repo is the source of truth for every object here, so a destroyed stack should
      // not leave an orphaned bucket behind that still bills for storage.
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      comment: 'Fairmeter — electricity bill split',
      defaultRootObject: 'index.html',
      // Viewers are in India (Torrent Power, Ahmedabad). PRICE_CLASS_100 is cheaper but
      // excludes the Indian edges entirely; 200 buys the ones that actually serve users.
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        // TODO(point 5): attach a ResponseHeadersPolicy — CSP (must allow
        // fonts.googleapis.com / fonts.gstatic.com), HSTS, X-Content-Type-Options.
      },
      // TODO(point 6): map 403/404 to /index.html with a 200 so a mistyped path lands on
      // the app rather than an XML S3 error.
    });

    // Two deployments so the cache headers can differ. Content-hashed files under assets/
    // are immutable; everything at the root is the mutable shell and must not be cached,
    // or a deploy leaves viewers on a stale index.html pointing at deleted bundles.
    // TODO(point 7): revisit these values when we do the caching pass.
    new deployment.BucketDeployment(this, 'DeployHashedAssets', {
      sources: [deployment.Source.asset(path.join(DIST, 'assets'))],
      destinationBucket: bucket,
      destinationKeyPrefix: 'assets',
      cacheControl: [
        deployment.CacheControl.setPublic(),
        deployment.CacheControl.maxAge(Duration.days(365)),
        deployment.CacheControl.immutable(),
      ],
      // Scoped to the assets/ prefix, so this clears out superseded bundles safely.
      prune: true,
      distribution,
      distributionPaths: ['/assets/*'],
    });

    new deployment.BucketDeployment(this, 'DeployShell', {
      sources: [deployment.Source.asset(DIST, { exclude: ['assets/**'] })],
      destinationBucket: bucket,
      cacheControl: [
        deployment.CacheControl.setPublic(),
        deployment.CacheControl.mustRevalidate(),
        deployment.CacheControl.maxAge(Duration.seconds(0)),
      ],
      // Unprefixed: pruning here would delete everything the assets deployment just wrote.
      prune: false,
      distribution,
      distributionPaths: ['/', '/index.html', '/favicon.svg', '/icons.svg', '/apple-touch-icon.png'],
    });

    new CfnOutput(this, 'SiteUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Public URL of the deployed app',
    });
    new CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution id (for manual invalidations)',
    });
    new CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'Private origin bucket',
    });
  }
}
