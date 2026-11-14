# Get Rural America Done — website

Static site for **Get Rural America Done** (@GetRural56Done): rural health and Critical Access Hospital modernization across all 56 U.S. states and territories.

- No build step. Plain HTML, CSS, and JS; deploys on Vercel as a static site.
- `index.html` — home page. `brand.html` — logo downloads, palette, type (served at `/brand`).
- `assets/brand/` — the Furrow & Star mark and wordmark lockups (outlined SVG, no font dependency) plus social avatar PNGs.
- `assets/fonts/` — self-hosted Newsreader and Geist (SIL Open Font License).

## Local preview

```
npx serve .
```

## Deploy

Every push to `main` deploys to production on Vercel; every other branch gets a preview URL.
