# Azure VM deployment

MindBridge runs on one Linux VM through Docker Compose. The deployment stack is in [`deploy/`](../deploy/): Caddy terminates TLS and routes traffic, `web` serves TanStack Start SSR and static assets, `server` exposes Hono/oRPC and Better Auth, and PostgreSQL persists in a Docker-managed volume.

## Prerequisites

- Ubuntu 24.04 VM with a public IP.
- DNS `A` record for the application domain pointing to that IP.
- Azure Network Security Group and host firewall allow TCP `80` and `443`. Restrict SSH `22` to administrator IPs.
- Docker Engine and Docker Compose plugin installed on the VM.

Caddy obtains and renews HTTPS certificates automatically when DNS resolves to the VM and ports `80` and `443` are publicly reachable.

## First deployment

1. Clone the repository on the VM:

   ```bash
   sudo install -d -o "$USER" -g "$USER" /opt/mindbridge
   git clone https://github.com/pngocthach/MindBridge /opt/mindbridge
   cd /opt/mindbridge
   ```

2. Create the production environment file without committing it:

   ```bash
   cp deploy/.env.production.example deploy/.env.production
   chmod 600 deploy/.env.production
   ```

3. Set these values in `deploy/.env.production`:

   - `PUBLIC_ORIGIN`, `BETTER_AUTH_URL`, and `CORS_ORIGIN`: `https://<your-domain>`.
   - `CADDY_SITE`: `<your-domain>` without a scheme.
   - `POSTGRES_PASSWORD` and the same password in `DATABASE_URL`.
   - `BETTER_AUTH_SECRET`: a random value at least 32 characters long. Generate it with `openssl rand -base64 48`.
   - Optional LLM credentials if generation features are needed.

4. Build, migrate, and start the stack:

   ```bash
   cd deploy
   docker compose --env-file .env.production up --build -d
   ```

The `migrate` container waits for PostgreSQL and applies Drizzle migrations before the API starts. PostgreSQL data is stored in the `mindbridge_postgres-data` named volume; never use `docker compose down -v` in production.

## Verify deployment

Replace `mindbridge.lol` with the configured domain:

```bash
curl --fail --silent --show-error --output /dev/null \
  --write-out 'home %{http_code} %{content_type}\n' \
  https://mindbridge.lol/

curl --fail --silent --show-error --output /dev/null \
  --write-out 'auth %{http_code} %{content_type}\n' \
  https://mindbridge.lol/api/auth/get-session
```

Both requests must return `200`. In a browser, confirm that `/assets/*.css` returns `text/css` and the homepage is styled.

## Updates and operations

Pull the approved branch, then rebuild the stack:

```bash
cd /opt/mindbridge
git pull --ff-only origin main
cd deploy
docker compose --env-file .env.production up --build -d
```

Useful commands:

```bash
# Running containers and health
cd /opt/mindbridge/deploy
docker compose --env-file .env.production ps

# Service logs
docker compose --env-file .env.production logs --follow server

# PostgreSQL backup
docker compose --env-file .env.production exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > mindbridge-$(date +%F).sql
```
