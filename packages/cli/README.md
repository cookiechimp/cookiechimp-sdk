# @cookiechimp/cli

Set up and check CookieChimp in an existing project.

```sh
npx @cookiechimp/cli init
npx @cookiechimp/cli doctor
```

## init

Detects the framework (Next.js App Router, Next.js Pages Router, React, or vanilla) and the package manager, installs the matching CookieChimp packages, and writes starter files:

- Next.js App Router: `cookiechimp.config.ts` and `components/cookiechimp-banner.tsx`
- React and Next.js Pages Router: `components/cookiechimp-provider.tsx`
- Vanilla: `cookiechimp.ts`

`init` never edits files you already have. It skips existing files unless you pass `--force`, and it prints the one manual step left, such as wrapping your root layout.

Options:

- `--cwd <dir>`: project root (default: the current directory)
- `--pm <npm|pnpm|yarn|bun>`: package manager override
- `--framework <next-app|next-pages|react|vanilla>`: framework override
- `--no-install`: write files only and print the install command
- `--force`: overwrite generated files
- `--dry-run`: show what would happen without installing or writing

## doctor

Runs static checks and exits with 1 when any check fails:

- CookieChimp packages are installed and on matching versions
- React and Next.js meet the supported minimums
- A config file exists
- The provider or `createConsent` is wired into an entry file
- No known tracking script tag is loaded without consent gating

Pass `--json` for machine-readable output.

## Safety

- No network access of its own. Only the package manager you chose runs, without a shell, and only with fixed arguments.
- Writes stay inside the project: absolute paths, `..`, and symlinks that leave the root are refused.
- On Windows, the install command is printed for you to run instead of being spawned.
