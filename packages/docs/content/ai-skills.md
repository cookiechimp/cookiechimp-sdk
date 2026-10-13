# AI skills

The repo ships [Agent Skills](https://agentskills.io) for coding agents. Each is
a `SKILL.md` with instructions an agent loads when the task matches. They are
also published on this site under `/skills/<name>/SKILL.md`.

| Skill | Use it to |
|---|---|
| `install-banner` | Add CookieChimp and a consent banner to a Next.js, React or plain JavaScript app. |
| `gate-scripts` | Make analytics and advertising tags wait for consent, with presets and Consent Mode v2. |
| `test-consent` | Write unit and Playwright tests that prove nothing loads before consent. |
| `connect-cookiechimp` | Switch from local mode to a CookieChimp project with the CLI. |

To use them, copy the folders from
[`skills/`](../../../skills/install-banner/SKILL.md) into your agent's skills
directory (for example `.claude/skills/` or `.agents/skills/`), or point the
agent at this site's [llms.txt](https://llmstxt.org) index.

The repo also has a `context7.json` so [Context7](https://context7.com) can
index these docs.
