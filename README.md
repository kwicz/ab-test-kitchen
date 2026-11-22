# A/B Test Kitchen

One dashboard for every A/B test an agency runs, across every client and every testing platform. It shows which tests are still cooking, which are ready to call, and what each one taught you.

Styled as a Copenhagen test kitchen on a soft-summer palette (sage and teal).

## What it does

- **Tickets.** A board of every test, grouped by stage:
  - **Draft**: drafted, not live yet
  - **Running**: live and collecting data
  - **Ready**: ready to call
  - **Called**: called and documented
- **One rule for every platform.** Each platform reports significance its own way (frequentist, Bayesian, sequential). The app recomputes results from raw visitors and conversions with a two-sided two-proportion z-test, so every test is judged the same way.
- **Call rules.** A test is ready to call after at least **14 days** and either **90% confidence** or its full planned sample. The planned sample is set by a minimum detectable effect you choose per test (default 10% lift, 80% power).
- **Peeking switch.** One global switch in the header, saved per viewer:
  - **On:** live lift and confidence everywhere.
  - **Off:** results stay "under the lid" and the board ignores significance, so it cannot leak results. A test becomes ready once it reaches its planned sample after 14 days (fixed horizon); its results unlock then.
  - Any single test can still be opened with **Peek** or **Lift the lid**.
- **Menu.** A spreadsheet with one row per test, sortable. While peeking is off, result columns are blurred; click a value to peek at that test, or show all for the visit.
- **Call it.** Mark a winner, loser or inconclusive, and keep chef's notes on what you learned.
- **Pantry.** Connectors for every platform, plus a CSV importer that accepts the platforms' own export column names.

## Platforms

| Platform | Connection | Status |
| --- | --- | --- |
| Optimizely | REST API v2, personal access token | Written from public docs, not yet run against a live account |
| Convert | Management API v2, Bearer secret key | Endpoint and auth checked against Convert's API reference; report field names not yet checked live |
| VWO | REST API v2, API token | Campaign list from public docs; report endpoint is a best guess |
| Intelligems | External API, per-store token | Written from public docs, not yet run live |
| Shoplift | CSV export | No public results API |
| Shopify Rollouts | CSV export | No public results API |

Without credentials, each connector serves sample data **in that platform's own response or export format** and runs it through the same normalizer a live connection uses. Set a platform's env vars (see `.env.example`) and its next sync pulls real tests instead. Expect small field-name fixes the first time each live API is connected.

## Run it locally

Needs Node 22.12 or newer (`nvm use`).

```bash
npm install
```

```bash
npm run dev
```

- Web: http://localhost:5173 (Vite; picks the next port if that one is taken)
- API: http://localhost:8787 (Hono)
- With no `DATABASE_URL`, the API uses embedded Postgres (PGlite) in `./.pglite` and loads the demo kitchen on first start.

Other scripts:

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run build && npm start
```

## Deploy on Railway

1. Create a project from this repo. `railway.json` sets the build (`npm run build`), start (`npm start`) and health check (`/api/health`).
2. Add a Postgres service and set `DATABASE_URL=${{Postgres.DATABASE_URL}}` on the app service. Migrations run on boot.
3. Optional: add platform credentials from `.env.example`. Set `DEMO_MODE=off` once real data is in, which hides the demo reset.

Without Postgres the app still runs on Railway with PGlite, but data resets on every deploy. That is fine for a portfolio demo.

## Stack

- **Client:** Vite, React 19, TypeScript, Tailwind CSS v4, TanStack Query, wouter, Recharts
- **Server:** Hono on Node, Drizzle ORM, Postgres (PGlite locally)
- **Type:** Bodoni Moda (display), Inter (text, tabular numbers), Caveat (handwritten notes)

```
shared/            types and the stats engine (shared by client and server, unit tested)
server/
  db/              Drizzle schema and connection (Postgres or PGlite)
  platforms/       one connector per platform, CSV importer, demo kitchen simulator
  repo.ts          database reads and writes
  index.ts         API routes and static hosting
src/
  pages/           Tickets (board), Menu (sheet), test detail, Pantry
  components/      cards, badges, meters, chart, peeking switch
public/art/        single-line artwork (placeholders; swap in final files by name)
drizzle/           SQL migrations
```

## Artwork slots

Single-line stroke drawings live in `public/art/`. Replace any file with final artwork under the same name and it appears everywhere that slot is used. Use a square viewBox (48 x 48 works), strokes only, no fill.

| File | Where it shows |
| --- | --- |
| `logo.svg` | Header logo and favicon |
| `draft.svg` | Draft column and badge |
| `running.svg` | Running column and badge |
| `ready.svg` | Ready column and badge |
| `called.svg` | Called column and badge, not-found page |
| `lid.svg` | "Under the lid" state when peeking is off |

## Demo data

All clients (Ashgrove Home, Brine & Barrel, Mosswood Outfitters, Kelp & Co. Skincare, Fennel Pet Supply) are fictional. Traffic is simulated day by day from a fixed seed, with start dates relative to today, so the board always shows a mix of stages.
