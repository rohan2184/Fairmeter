# infra — AWS hosting for Fairmeter

Fairmeter is a pure client-side SPA: the calculation engine runs in the browser and history
lives in `localStorage` (D-03). There is no API, no database and no server-side rendering, so
the entire production deployment is **a private S3 bucket behind CloudFront**.

```
viewer ──https──▶ CloudFront ──OAC-signed──▶ S3 (BlockPublicAccess: ALL)
```

## One-time setup

CDK needs a staging bucket and roles in the target account/region before its first deploy:

```bash
cd infra
npm install
npm run bootstrap        # cdk bootstrap — once per account+region, ever
```

## Deploying

```bash
npm run deploy           # ci + test + vite build, then cdk deploy
```

`deploy` refuses to run if `app/dist/index.html` is missing, so a stale or absent build can
never be published silently. Use `npm run deploy:only` to push the current `app/dist` without
rebuilding, and `npm run diff` to see what a deploy would change first.

The stack prints three outputs:

| Output | Use |
|--------|-----|
| `SiteUrl` | the public `https://d….cloudfront.net` address |
| `DistributionId` | for manual `aws cloudfront create-invalidation` |
| `BucketName` | the private origin |

`npm run destroy` tears everything down; the bucket is `RemovalPolicy.DESTROY` with
`autoDeleteObjects`, because the repo — not the bucket — is the source of truth for every
object in it.

## What the stack does, and why

- **Private origin, OAC not OAI.** The bucket blocks all public access; the bucket policy
  grants `s3:GetObject` to the `cloudfront.amazonaws.com` service principal, conditioned on
  this distribution's ARN. The bucket has no website endpoint and is not reachable directly.
- **`PRICE_CLASS_200`.** `PRICE_CLASS_100` is cheaper but serves only North America and
  Europe — it excludes the Indian edge locations, which is where the users actually are.
- **Two `BucketDeployment`s.** Files under `assets/` are content-hashed by Vite and go up
  `immutable, max-age=31536000`; the root shell (`index.html`, icons) is not hashed and goes
  up `no-cache`, or a deploy would leave viewers on a cached `index.html` referencing bundles
  that no longer exist. The `assets/` deployment prunes within its prefix; the root one does
  not prune, so it cannot delete what the first just wrote.
- **HTTP/3, TLS 1.2_2021, redirect-to-HTTPS, compression on.**

Each `cdk deploy` issues its own CloudFront invalidation, so there is no separate
invalidation step to remember.

## Costs

A static site of this size sits inside the CloudFront perpetual free tier (1 TB egress and
10M requests per month). Expected steady-state spend is the S3 storage of a ~300 kB bundle —
cents per month. There is no always-on compute in this stack.

## Deliberately not here yet

- **Security response headers** (CSP, HSTS, `X-Content-Type-Options`) — marked `TODO(point 5)`
  in `lib/fairmeter-stack.ts`. Note the CSP must allow `fonts.googleapis.com` and
  `fonts.gstatic.com`, which `index.html` loads.
- **403/404 → `/index.html`** — `TODO(point 6)`. Not strictly required (the app uses hash
  routing, so there are no server-side deep links) but a mistyped path currently returns a
  raw S3 error.
- **Cache-policy review** — `TODO(point 7)`.
- **A custom domain.** Adding one later means an ACM certificate *in us-east-1*, plus
  `domainNames` and `certificate` on the existing `Distribution` — an in-place update, not a
  recreate, so nothing here has to be thrown away.

## Future: automating the deploy

Deploys are manual on purpose while the project is small. Two paths when that stops being
true, in order of preference:

1. **GitHub Actions on push to `main`.** Add `.github/workflows/deploy.yml` that runs
   `npm ci && npm test && npm run build`, then assumes an AWS role via **OIDC**
   (`aws-actions/configure-aws-credentials` with `permissions: id-token: write`) and runs
   `cdk deploy --require-approval never`. Use OIDC rather than long-lived access keys stored
   as secrets. The IAM role needs permission to assume the CDK bootstrap roles.
2. **CodePipeline + CodeBuild.** Keeps delivery entirely inside AWS with a `buildspec.yml`
   (`runtime-versions: nodejs: 24`). More moving parts and a per-pipeline monthly charge;
   worth it mainly if GitHub is not where the repo ends up living.

Either way the stack itself does not change — only what invokes `cdk deploy`.
