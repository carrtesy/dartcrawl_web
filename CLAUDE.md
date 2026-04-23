# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Local development (Worker + static assets at http://127.0.0.1:8787)
wrangler dev
# or
npm run dev

# Deploy to Cloudflare
wrangler deploy
# or
npm run deploy

# Static-only preview (no /api/* routes)
py -m http.server 8000
```

There is no build step, no linter, and no test suite.

## Architecture

This is a Cloudflare Workers app that serves a static frontend and Worker API together using the [Static Assets](https://developers.cloudflare.com/workers/static-assets/) feature.

**Routing** (set in [wrangler.toml](wrangler.toml)):
- `/api/*` → Worker handles first (`run_worker_first`)
- Everything else → static assets from `public/`

**Entry point**: [src/index.js](src/index.js) simply re-exports from [worker/index.js](worker/index.js), which contains all logic.

### Data flow

1. On page load, the frontend fetches [public/data/company-index.csv](public/data/company-index.csv) — a pre-built list of companies with their DART report URLs.
2. User types a keyword → frontend filters the CSV index locally (no network call).
3. User selects a company and clicks download → frontend POSTs `{ reportUrl }` to `POST /api/export`.
4. The Worker scrapes three DART pages in sequence:
   - `SEARCH_URL` — find the company (also used by the legacy `POST /api/search-companies` endpoint)
   - `MAIN_URL?rcpNo=...` — the report TOC page, parsed with regex to find the "XII.상세표" node
   - `VIEWER_URL` — the detail tables page, scraped for three specific sections (`TARGET_SECTIONS`)
5. Worker returns a SpreadsheetML `.xls` file (no library, raw XML) with one sheet per extracted table.

### Key design constraints

- **No DOM API in Workers**: all HTML parsing uses regex, not `DOMParser`. If DART's HTML structure changes, the regex in `worker/index.js` needs updating.
- **Excel output is SpreadsheetML XML** (`.xls`), not `.xlsx`. No dependency on any spreadsheet library.
- **`public/data/company-index.csv`** must be kept up to date manually; it is not auto-generated at build time.
- The `POST /api/search-companies` Worker endpoint exists but is not called by the current frontend (the frontend does local CSV filtering instead).

### CI/CD

GitHub Actions ([.github/workflows/deploy-worker.yml](.github/workflows/deploy-worker.yml)) deploys on every push to `main` that touches `public/`, `src/`, `worker/`, `wrangler.toml`, or the workflow file itself. Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets.
