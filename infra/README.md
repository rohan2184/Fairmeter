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

## Security headers

A single `ResponseHeadersPolicy` on the default behaviour sends:

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | see below |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` — never `preload`, because a `*.cloudfront.net` name is not ours to pin |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` (belt and braces alongside `frame-ancestors`) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | geolocation, camera, microphone, payment, usb, midi all denied |
| `Cross-Origin-Opener-Policy` | `same-origin` |

`X-XSS-Protection` is deliberately absent: it is obsolete, and its filtering modes have been
a vulnerability in their own right. The CSP is the control.

The CSP allows **no `'unsafe-inline'` and no `'unsafe-eval'` for scripts**. The product has
exactly one inline script — the pre-paint theme pin, which must run before first paint and
so cannot move into the bundle — and `inlineScriptHashes()` **computes its `sha256` from the
built HTML at synth time**. That matters: a hand-copied hash silently stops matching the
moment someone edits the script, and the symptom is a blank site. Deriving it makes that
impossible.

`style-src` does keep `'unsafe-inline'`. `Rail.tsx` sets an element's `flex-grow` from
computed data, the status pages carry their stylesheet inline so they can render when
nothing else loads, and a hash list would not cover style *attributes* in any case.

## Error pages

Not the usual SPA rewrite of every path to `index.html` with a 200. Fairmeter has no
client-side router — it is a single page — so a path that does not exist is genuinely not
found, and says so (D-16):

| From the origin | Served | As |
|-----------------|--------|-----|
| 403 (S3's answer for a missing key under OAC, since `s3:ListBucket` is not granted) | `/404.html` | **404**, translated back |
| 404 | `/404.html` | 404 |
| 500 / 502 / 503 / 504 | `/50x.html` | the same 5xx, cached 10s |

Both pages are self-contained — no bundle, no external CSS, no webfont — because whatever
broke may be the thing that stops an external file loading.

## Serve from a domain root

`app/vite.config.ts` pins `base: '/'`. The build emits absolute asset URLs and the status
pages link to `/`, so the site must be served from the root of its domain. Putting it under
a prefix (an S3 sub-path, an `/app/` route) 404s every asset until `base` matches that
prefix. This is why the bucket has no other content in it.

## Still to come

- **A custom domain.** An ACM certificate *in us-east-1*, plus `domainNames` and
  `certificate` on the existing `Distribution` — an in-place update, not a recreate, so
  nothing here has to be thrown away. Set `minimumProtocolVersion: TLS_V1_2_2021` at the
  same time: until there is a custom certificate, AWS fixes the security policy and the
  setting is silently ignored, so it is left out rather than stated falsely.
- **Access logs and alarms.** Neither is free, and neither is worth it before the site has
  users.

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
