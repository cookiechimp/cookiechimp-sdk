# SDK documentation on Mintlify

The canonical SDK documentation belongs in
[IdentitySquare/CookieChimp-Docs](https://github.com/IdentitySquare/CookieChimp-Docs),
under the Consent SDK navigation section. Its public entry point is
https://docs.cookiechimp.com/docs/sdk/overview after the docs PR is deployed.
The existing React/Next.js widget installation guides link to the SDK guides.

## Source and export

Guide sources remain beside the implementation in `packages/docs/content` and
package READMEs. The SDK repository also owns the runnable examples, Agent Skills,
Context7 manifest and snippet checks. `@cookiechimp/docs` exports MDX and navigation
for Mintlify; it no longer builds or serves a separate HTML website.

From a clean, committed SDK checkout:

```sh
pnpm install --frozen-lockfile
pnpm --filter @cookiechimp/docs build
```

The export is `packages/docs/dist/`: `sdk/*.mdx`, `navigation.json` and
`source.json`. CI retains it as `mintlify-sdk-docs`. The source record includes
the exact SDK commit and a dirty flag. The docs build is uncached because it
reads package READMEs outside its own directory and records the current commit.
Mintlify provides search, Markdown views and the documentation's llms indexes;
no second search service, domain or hosting pipeline is needed.

## Update the documentation repo

Import the export using `scripts/import-sdk-docs.mjs` in CookieChimp-Docs.
The importer requires clean committed source, updates the SDK pages/navigation
and records the source SHA. It does not write to the platform repository.
Run the pinned Mintlify validation and link checks described in that repo's
README, inspect the preview, and open a documentation PR for Daniel's review.
Do not hand-edit generated MDX pages: change their SDK sources and regenerate.

## Merge and deployment order

1. Review and merge the companion CookieChimp-Docs PR.
2. Verify the new public overview, getting-started and reference routes on the
   existing Mintlify deployment, including search and internal links.
3. Merge the SDK PR that changes README/package links and retires the standalone
   website. SDK checks must be green on its current head.

Documentation publication does not publish npm packages, register the CMP or
prove connected platform delivery. Those remain separate launch requirements.
