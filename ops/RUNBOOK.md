# Runbook

## Current Operating State

- Local branch: `main`
- Local preview: `python3 -m http.server 4173`
- Verification without Node:
  - `python3 tools/verify_static.py`
  - `python3 tools/smoke_http.py`
- Verification with Node:
  - `npm run lint`
  - `npm test`

## Release Flow

1. Run the Python checks.
2. Run Node checks when Node is available.
3. Open the local preview and confirm the game shell loads.
4. Commit with `hanazarochikawa`.
5. Push `main`.
6. Let GitHub Actions deploy Pages.

## Known Environment Blocker

This machine currently cannot push to `origin` over HTTPS:

```text
fatal: could not read Username for 'https://github.com': Device not configured
```

`gh` is also not installed, and no GitHub credential is available in the macOS keychain for this shell session. Local commits are safe and queued on `main` until credentials are restored.

## Recovery Steps

Once credentials are available:

```sh
git status --short --branch
git push origin main
```

After push, watch the `ci` workflow. GitHub Pages should deploy only after checks pass.
