# Deployment

Lumen Drift is a static browser game. It ships without runtime dependencies, so the production artifact is the repository root.

## Local Operations

```sh
python3 -m http.server 4173
```

The local server defaults to `http://localhost:4173`.

On machines with Node/npm available:

```sh
npm run lint
npm test
npm start
```

## GitHub Pages

The workflow at `.github/workflows/ci.yml` runs JavaScript checks and gameplay tests. Pushes to `main` deploy the static site to GitHub Pages after the test job succeeds.

Repository Pages should be configured to use **GitHub Actions** as its source.

## Release Checklist

1. Run `npm run lint`.
2. Run `npm test`.
3. Start the local server and verify the canvas renders.
4. Commit with the project commit name.
5. Push `main` and let the `ci` workflow publish Pages.
