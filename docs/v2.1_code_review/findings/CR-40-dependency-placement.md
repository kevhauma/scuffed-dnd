# CR-40 — Dependency placement: one unused, one misfiled

**Severity:** Low · **Area:** package.json · **Type:** cleanup

## Summary

Fallow's dependency graph reports two placement issues:

1. `@tanstack/react-router-ssr-query` (`dependencies`) — never imported anywhere.
2. `@tailwindcss/vite` (`dependencies`) — imported only by config/test files; belongs in
   `devDependencies`.

## Evidence

`package.json:19,23`; fallow `dead-code` run 2026-08-21 (`unused_dependencies`,
`test_only_dependencies`). Verify with `fallow dead-code --trace-dependency <name>` before
removing — the ssr-query package may be a leftover from the TanStack Start scaffold.

## Impact

No runtime impact (the app is browser-only and bundled); it's inventory hygiene and install
weight.

## Suggested direction

Remove `@tanstack/react-router-ssr-query` after a trace confirms; move `@tailwindcss/vite` to
`devDependencies`. Re-run the full verification suite afterward since vite config imports are
easy to miss statically.
