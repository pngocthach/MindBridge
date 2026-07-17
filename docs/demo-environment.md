# MindBridge demo environment

The server and browser environment are validated by `@MindBridge/env`. Keep real
credentials in deployment secrets or ignored `.env` files; never commit them.

## Local demo

1. Copy `apps/server/.env.example` to `apps/server/.env` and fill in the database,
   auth secret, CORS origin and optional LLM values.
2. Copy `apps/web/.env.example` to `apps/web/.env`.
3. Start the database, seed demo data, then run `pnpm dev`.
4. Open `http://localhost:3001` and verify sign-in, Content Studio, admin review,
   learner recommendations and the tutor chatbox.

For a hosted demo, configure the same variables in the hosting provider's secret
store and set `BETTER_AUTH_URL`, `CORS_ORIGIN` and `VITE_SERVER_URL` to the hosted
URLs. Do not put API keys in browser variables.
