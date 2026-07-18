# MindBridge demo deployment

The root [`render.yaml`](../render.yaml) deploys the monorepo as two Render web
services plus managed PostgreSQL:

- `mindbridge-demo-web`: TanStack Start UI.
- `mindbridge-demo-api`: Hono, Better Auth, oRPC and OpenAPI.
- `mindbridge-demo-db`: PostgreSQL used through its private connection string.

This configuration is intended for a short-lived hackathon demo, not a
production availability or disaster-recovery setup.

## Deploy with Render

1. Connect the repository in Render and create a Blueprint from `render.yaml`.
2. Review the generated service names before applying it. If you rename either
   service, update every matching `fromService.name` reference.
3. Wait for the API migration startup gate and both health checks to pass.
4. Optionally run `pnpm db:seed` once from an API service shell if the demo needs
   sample accounts. Do not add seeding to every deploy.
5. Verify the web URL, then check the API URL returns `OK` at `/`.

Render generates `BETTER_AUTH_SECRET`, injects `DATABASE_URL` from managed
PostgreSQL, and derives the public web/API hostnames from service metadata. The
blueprint disables preview environments so demo credentials and data are not
silently copied into pull-request deployments.

## Environment variables

| Variable | Location | Required | Handling |
| --- | --- | --- | --- |
| `DATABASE_URL` | API | Yes | Render database reference; never copy into source. |
| `BETTER_AUTH_SECRET` | API | Yes | Provider-generated; rotate after exposure or demo handoff. |
| `BETTER_AUTH_URL` | API | Yes | Built at runtime from the API's HTTPS hostname. |
| `CORS_ORIGIN` | API | Yes | Built at runtime from the web service's HTTPS hostname. |
| `VITE_SERVER_URL` | Web build | Yes | Built from the API hostname; this value is public. |
| `OPENAI_COMPATIBLE_API_KEY` | API | No | Add as a secret in the Render dashboard. |
| `OPENAI_COMPATIBLE_BASE_URL` | API | No | Add with its matching model and key. |
| `OPENAI_COMPATIBLE_MODEL` | API | No | Add with its matching base URL and key. |
| `TUTOR_LLM_API_KEY` | API | No | Add as a secret in the Render dashboard. |
| `TUTOR_LLM_BASE_URL` | API | No | Add with its matching model and key. |
| `TUTOR_LLM_MODEL` | API | No | Add with its matching base URL and key. |

Never put secrets in `VITE_*` variables: Vite embeds them in browser assets.
Do not enable `SKIP_ENV_VALIDATION` in a deployment; a missing required value
should fail the deploy instead of creating a partially configured demo.

## Build, start and health behavior

- API build: `pnpm --filter server baml:generate`
- API startup gate: `pnpm db:migrate`
- API start: `pnpm --filter server exec node --import tsx src/index.ts` on port `3000`
- Web build: `pnpm --filter web build`
- Web start: `pnpm --filter web serve --host 0.0.0.0 --port $PORT`
- Health checks: `GET /` on both services; a healthy response is HTTP 2xx.

The free demo service runs migrations before binding its HTTP port, so a failed
migration also fails the health gate. Paid Render services should move this step
to `preDeployCommand` for zero-downtime migration handling. If migration or
health checks fail, inspect the Render event logs and do not bypass the gate.

The demo API intentionally runs its TypeScript entrypoint with Node and the
repository's pinned `tsx` loader. This avoids coupling the demo deployment to a
separate server bundle artifact while keeping the same checked source used locally.

The local Python ingestion worker is not provisioned by this Node Blueprint.
Document conversion therefore requires a separate worker image or provider
with Python 3.11+ and the dependencies from `apps/ingestion-worker/pyproject.toml`.
All other server features can run without configuring optional LLM credentials.

## Local deployment smoke test

1. Copy `apps/server/.env.example` to the ignored `apps/server/.env` and replace
   every placeholder. Generate the auth secret with a password generator or
   `openssl rand -base64 32`.
2. Copy `apps/web/.env.example` to the ignored `apps/web/.env`.
3. Run `pnpm install --frozen-lockfile`, `pnpm db:migrate`,
   `pnpm --filter server baml:generate`, and `pnpm --filter web build`.
4. Start the API with `pnpm --filter server exec node --import tsx src/index.ts`
   and the web build with
   `pnpm --filter web serve --host 127.0.0.1`.
5. Confirm `curl --fail http://localhost:3000/` returns `OK`, sign in through
   `http://localhost:4173`, and exercise the critical demo flow.

Before sharing logs or screenshots, redact database URLs, authorization headers,
cookies, generated secrets, API keys, and learner data.
