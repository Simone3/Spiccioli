---
description: Run lint, typecheck, and tests, then fix every failure
allowed-tools: Bash(npm run lint), Bash(npm run typecheck), Bash(npm test), Read, Edit, Glob, Grep
---

Run the full validation suite for Spiccioli:

```sh
npm run lint
npm run typecheck
npm test
```

Run all three even if an earlier one fails, so the full picture is visible in one pass.

Then fix every failure, respecting the conventions in `CLAUDE.md`. Re-run only the checks that failed until they pass. Do not weaken a test, disable an ESLint rule, or add a type assertion just to make a check pass — fix the underlying cause instead. If a failure looks pre-existing and unrelated to recent work, say so instead of silently fixing it.

Report a one-line pass/fail summary per check at the end.
