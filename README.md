# SmartStock

Stock ordering and inventory management for a retail and warehouse distribution business.
ICT305 Software Development Project 2, Group <number>.

Four roles (administrator, inventory staff, operations manager, supplier contact) share one
product catalogue, one stock ledger and one purchase-order workflow.

| | |
|---|---|
| Project board | <link> |
| Staging | <set after the first deploy> |
| Working agreement | [docs/WORKING_AGREEMENT.md](docs/WORKING_AGREEMENT.md) |
| Definition of Done | [docs/DEFINITION_OF_DONE.md](docs/DEFINITION_OF_DONE.md) |

## Stack
React 18 + TypeScript + Vite, Express 4 + TypeScript, PostgreSQL 17, zod (shared
validation), Vitest + Supertest, GitHub Actions.

## Run it locally
Prerequisites: Node.js 20+, Docker Desktop.

```bash
cp server/.env.example server/.env
npm ci && npm ci --prefix server
npm run db:up        # PostgreSQL 17 in Docker on port 5433
npm run db:setup     # schema + demo data
npm test
```

## Staging
One Render web service, one Supabase database. In production Express serves the built React app
as well as the API, so the site and the API share a single origin and the session cookie needs no
cross-site set-up. There is no separate front-end host.

| | |
|---|---|
| URL | <set after the first deploy> |
| Deploys from | `main`, automatically |
| Regions | Render: Singapore · Supabase: Sydney |

Build command:

```bash
npm ci --include=dev && npm ci --include=dev --prefix server && npm ci --include=dev --prefix client && npm run build --prefix client
```

Start command:

```bash
npm start --prefix server
```

`--include=dev` is not optional: `NODE_ENV=production` makes npm skip devDependencies, and the
client build needs Vite while the server starts through tsx.

Environment variables live in the Render dashboard and are never committed — `NODE_ENV`,
`DATABASE_URL`, `DATABASE_SSL`, `DATABASE_MAX_CONNECTIONS`, `SESSION_SECRET`, `CLIENT_ORIGIN`,
`NODE_VERSION`. Render supplies `PORT` itself.

Step-by-step instructions: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Branching
`main` is protected. Work on `feature/<story-id>-<name>` or `chore/<id>-<name>` branches and
merge by pull request with one approval and passing CI.

## Releases
| Tag | Milestone |
|---|---|
| v0.1.0-mvp | Sprint 1, MVP (A2) |
| v0.9.0-rc | Sprint 2, release candidate (A3) |
| v1.0.0 | Final release and handover (A4) |
