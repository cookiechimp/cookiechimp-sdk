# Deployment and release status

The SDK is being prepared for its first npm release. Registry installation commands
in these docs apply once the packages are published. Until then, clone the repository,
run `pnpm install --frozen-lockfile`, and use the workspace examples.

## Build the docs

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @cookiechimp/docs build
pnpm --filter @cookiechimp/docs start
```

Preview at `http://127.0.0.1:3103`. Deploy the contents of
`packages/docs/dist` as a static site when hosting and a domain have been chosen.
The preview server is for local testing. No runtime Node service is needed for
production. CI uploads a `docs-site` artifact after the unit job builds and tests it.

The default build uses relative HTML links and root-relative llms.txt links.
Deploy at the domain root. Once the domain is known, set `DOCS_BASE_URL` to its
HTTPS origin when building to make llms.txt links absolute. It cannot contain
credentials, a path, query parameters or a fragment. Serve Markdown
and text files with their appropriate content types and enable `nosniff`.
The generated `_headers` file contains suggested security headers; configure the
same headers explicitly if the chosen host does not support that file.

## Verify the artifact

```sh
pnpm test:unit
pnpm test:e2e
```

The browser suite serves all examples and the docs locally, checks navigation
and internal links, resolves llms.txt and skill files, and checks for external
requests. Re-run those checks against the deployment URL before calling it live.
The docs include no client-side JavaScript.

## Connected mode dependencies

Website accounts need platform PR
[#2773](https://github.com/IdentitySquare/CookieChimp/pull/2773) for idempotent
consent ingestion, followed by
[#2772](https://github.com/IdentitySquare/CookieChimp/pull/2772) for shared
config endpoints. Daniel reviews and merges platform changes. Before those
changes ship, connected mode can fall back to cached or in-code config; that
fallback does not prove the platform received consent records.

## Compliance and publication gates

TCF production use requires a real IAB CMP ID and a valid vendor list. CookieChimp
registration, platform entitlement enforcement and the vendor-list service remain
external prerequisites. Current US state coverage and unreviewed locale status
are documented in the [reference](../../../README.md) and
[translations](translations.md).

Native speakers must review draft translations before launch. npm publication
requires Daniel's explicit go-ahead and npm organization access. Hosting, npm
publication, registry submission and IAB validation are separate completion steps.
The [remaining-work checklist](../../../docs/remaining-work.md) records their status.
