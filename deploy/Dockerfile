FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/env/package.json packages/env/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS build

ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL

COPY . .

RUN pnpm build

FROM dependencies AS server

ENV NODE_ENV=production
COPY --from=ghcr.io/astral-sh/uv:0.11.28 /uv /uvx /usr/local/bin/

RUN apt-get update \
	&& apt-get install --yes --no-install-recommends ffmpeg python3 python3-venv \
	&& rm -rf /var/lib/apt/lists/*

COPY apps/ingestion-worker apps/ingestion-worker

RUN uv sync --locked --no-dev --project apps/ingestion-worker


COPY apps/server apps/server
COPY --from=build /app/apps/server/dist apps/server/dist

WORKDIR /app/apps/server

EXPOSE 3000


CMD ["node", "dist/index.mjs"]

FROM dependencies AS web

ENV NODE_ENV=production
COPY apps/web apps/web
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=dependencies /app/apps/web/node_modules apps/web/node_modules
COPY deploy/web-server.mjs apps/web/production-server.mjs

WORKDIR /app/apps/web

EXPOSE 3001

CMD ["pnpm", "start"]

FROM dependencies AS migrate

COPY packages/db packages/db

CMD ["pnpm", "--filter", "@MindBridge/db", "db:migrate"]
