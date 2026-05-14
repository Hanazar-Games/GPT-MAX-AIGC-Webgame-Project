# Deployment

Lumen Drift is a static browser game. It ships without runtime dependencies, so the production artifact is the repository root.

## Local Operations

```sh
python3 -m http.server 4173
```

The local server defaults to `http://localhost:4173`.

On machines with Node/npm available:

```sh
npm run verify:static
npm run verify:http
npm run lint
npm test
npm start
```

## GitHub Pages

The workflow at `.github/workflows/ci.yml` runs JavaScript checks and gameplay tests. Pushes to `main` deploy the static site to GitHub Pages after the test job succeeds.

Repository Pages should be configured to use **GitHub Actions** as its source.

## Release Checklist

1. Run `python3 tools/verify_static.py`.
2. Run `python3 tools/smoke_http.py`.
3. Run `npm run lint`.
4. Run `npm test`.
5. Start the local server and verify the canvas renders.
6. Commit with the project commit name.
7. Push `main` and let the `ci` workflow publish Pages.
