# @cookiechimp/cli

## 1.2.0

No changes in this release.

## 1.1.0

Version alignment for the coordinated SDK 1.1.0 release.

## 1.0.0

### Major Changes

- Prepare the first coordinated 1.0 release of the CookieChimp Consent SDK. Publication remains gated on review, external prerequisites and explicit approval.

### Minor Changes

- c3bc017: Add the `cookiechimp` CLI with `init` (framework detection, package install, starter files) and `doctor` (static setup checks).
- d56d475: Add `link` (dashboard API token from env or stdin, writes the project id to `.env.local`) and `pull` (downloads the public dashboard config to `cookiechimp.config.json` for offline builds).

### Patch Changes

- a1ef889: Keep React-owned gated script nodes stable through activation and reconciliation. Prevent duplicate execution across gate controllers and recheck consent before queued scripts execute. Generate CLI configurations that pass TypeScript.

  Decode filesystem URLs when generating Next.js critical CSS so builds work in paths with spaces.
