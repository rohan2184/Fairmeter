import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as deployment from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';

/** Built output of the Vite app — `npm --prefix ../app run build` produces this. */
const DIST = path.resolve(__dirname, '..', '..', 'app', 'dist');

/** Pages that must exist in a build before it is worth deploying. */
const REQUIRED_PAGES = ['index.html', '404.html', '50x.html'];

/**
 * CSP hashes for the inline `<script>` in each page — the pre-paint theme pin, which has
 * to run before first paint and therefore cannot be moved into the bundle.
 *
 * Computed from the built HTML at synth time rather than pasted in, so editing that script
 * can never silently leave the policy behind and blank the site. If the hash and the page
 * disagree the browser blocks the script, and the only safe way to keep them in agreement
 * is to derive one from the other.
 */
function inlineScriptHashes(): string[] {
  const hashes = new Set<string>();
  for (const page of REQUIRED_PAGES) {
    const html = fs.readFileSync(path.join(DIST, page), 'utf8');
    // Inline only: a tag carrying src= is an external script and is covered by 'self'.
    for (const [, body] of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
      hashes.add(`'sha256-${crypto.createHash('sha256').update(body, 'utf8').digest('base64')}'`);
    }
  }
  return [...hashes].sort();
}

/**
 * Fairmeter is a pure client-side SPA (D-03: persistence is browser-local), so the whole
 * deployment is a private bucket behind CloudFront. No compute, no VPC, no database.
 */
export class FairmeterStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const missing = REQUIRED_PAGES.filter((p) => !fs.existsSync(path.join(DIST, p)));
    if (missing.length > 0) {
      throw new Error(
        `Incomplete build at ${DIST} — missing ${missing.join(', ')}. ` +
          'Run `npm --prefix ../app run build` first (or use `npm run deploy`, which builds for you).',
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

    // --- security headers (point 5) ----------------------------------------------------
    const csp = [
      // The app talks to nothing. Everything below is a narrowing of this.
      "default-src 'self'",
      // No inline scripts beyond the pre-paint theme pin, whose hash is derived above.
      // Notably absent: 'unsafe-inline' and 'unsafe-eval'.
      `script-src 'self' ${inlineScriptHashes().join(' ')}`,
      // 'unsafe-inline' is unavoidable for styles: Rail.tsx sets an element's flex-grow
      // from computed data, and the status pages carry their stylesheet inline so they can
      // render when nothing else loads. A hash list would not cover style *attributes*
      // anyway — allowing them requires 'unsafe-inline' either way.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "manifest-src 'self'",
      // Nothing is posted, framed, or navigated away by the app.
      "form-action 'none'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "object-src 'none'",
      'upgrade-insecure-requests',
    ].join('; ');

    const securityHeaders = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      comment: 'Fairmeter — CSP, HSTS and the usual hardening headers',
      securityHeadersBehavior: {
        contentSecurityPolicy: { contentSecurityPolicy: csp, override: true },
        contentTypeOptions: { override: true },
        // frame-ancestors above already covers modern browsers; this is for the old ones.
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          // Never preload from a *.cloudfront.net name — that domain is not ours to pin.
          preload: false,
          override: true,
        },
        // X-XSS-Protection is deliberately not set: it is obsolete, and in its filtering
        // modes it has been a vulnerability in its own right. The CSP is the control.
      },
      customHeadersBehavior: {
        customHeaders: [
          {
            header: 'Permissions-Policy',
            value: 'geolocation=(), camera=(), microphone=(), payment=(), usb=(), midi=()',
            override: true,
          },
          {
            header: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
            override: true,
          },
        ],
      },
    });

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      comment: 'Fairmeter — electricity bill split',
      defaultRootObject: 'index.html',
      // Viewers are in India (Torrent Power, Ahmedabad). PRICE_CLASS_100 is cheaper but
      // excludes the Indian edges entirely; 200 buys the ones that actually serve users.
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // No `minimumProtocolVersion` here on purpose: while the distribution uses the
      // default *.cloudfront.net certificate, its security policy is fixed by AWS and the
      // setting is silently ignored. Set it to TLS_V1_2_2021 at the same time as adding a
      // custom domain and ACM certificate — that is the point at which it starts to mean
      // something.
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        // Honours the Cache-Control the deployments below stamp on each object, within
        // its own min/max bounds — which is what makes the two-tier policy work.
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        responseHeadersPolicy: securityHeaders,
      },

      // --- error pages (point 6) -------------------------------------------------------
      // Deliberately NOT the usual SPA rewrite of everything to index.html with a 200.
      // Fairmeter has no client-side router — it is one page — so a path that does not
      // exist is genuinely not found, and saying so is both honest and better for crawlers
      // than serving the app under a wrong URL with a success code.
      errorResponses: [
        {
          // With OAC and no s3:ListBucket grant, S3 answers a missing key with 403, not
          // 404. Translating it back is what keeps the status code truthful.
          httpStatus: 403,
          responseHttpStatus: 404,
          responsePagePath: '/404.html',
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: '/404.html',
          ttl: Duration.minutes(5),
        },
        // Origin-side failures keep their own status. Cached only briefly, so recovery is
        // not held behind a stale error.
        { httpStatus: 500, responseHttpStatus: 500, responsePagePath: '/50x.html', ttl: Duration.seconds(10) },
        { httpStatus: 502, responseHttpStatus: 502, responsePagePath: '/50x.html', ttl: Duration.seconds(10) },
        { httpStatus: 503, responseHttpStatus: 503, responsePagePath: '/50x.html', ttl: Duration.seconds(10) },
        { httpStatus: 504, responseHttpStatus: 504, responsePagePath: '/50x.html', ttl: Duration.seconds(10) },
      ],
    });

    // --- cache tiers (point 7) ---------------------------------------------------------
    // Two deployments so the headers can differ. The split is not cosmetic: publishing the
    // shell with a long TTL strands viewers on an index.html that references bundles the
    // next deploy deleted, and publishing the bundles with a short one throws away the
    // whole benefit of content hashing.
    new deployment.BucketDeployment(this, 'DeployHashedAssets', {
      sources: [deployment.Source.asset(path.join(DIST, 'assets'))],
      destinationBucket: bucket,
      destinationKeyPrefix: 'assets',
      // Vite puts a content hash in every filename here, so the bytes behind a given URL
      // can never change. A year is the maximum any browser will honour.
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
      // index.html, the status pages and the icons keep stable names, so their contents
      // change under the same URL. They must be revalidated on every visit.
      cacheControl: [
        deployment.CacheControl.setPublic(),
        deployment.CacheControl.mustRevalidate(),
        deployment.CacheControl.maxAge(Duration.seconds(0)),
      ],
      // Unprefixed: pruning here would delete everything the assets deployment just wrote.
      prune: false,
      distribution,
      distributionPaths: [
        '/',
        '/index.html',
        '/404.html',
        '/50x.html',
        '/favicon.svg',
        '/icons.svg',
        '/apple-touch-icon.png',
      ],
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
