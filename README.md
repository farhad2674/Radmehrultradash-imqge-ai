# RadmehrAI Studio — aimaxmode

**Development version:** `aimaxmode` (`0.1.0-aimaxmode.0`).

A React and Node.js dashboard for appliance image generation, reusable templates, and team governance. This version connects login, server authorization, sessions, and provider quotas to PostgreSQL using Drizzle.

## Run locally

Requires Node.js 22 or newer and PostgreSQL.

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and configure `DATABASE_URL`. Set `OPENROUTER_API_KEY` for image generation and prompt optimization; it is the only AI key required. Keep it in server configuration. Login does not require an AI key.
3. Run `npm run db:migrate`.
4. Run `npm run admin:provision` in an interactive terminal to create the first admin. Password entry is hidden.
5. Run `npm run dev` and open `http://localhost:3000`.
6. Sign in as admin and assign finite quotas and API access to approved accounts. New members start with the `USER` role, zero quota, and API access disabled.

## Production

Run `npm run build`, then `NODE_ENV=production npm start`. Configure an HTTPS `APP_URL`, verified PostgreSQL TLS, and separate private persistent directories for uploads and application data. The backend bundle is in `build/`; the frontend is in `dist/`.

`OPENROUTER_IMAGE_MODEL=latest` and `OPENROUTER_TEXT_MODEL=latest` select the newest compatible image and text models from OpenRouter's catalog, refreshed hourly. Reference-image requests select a model that accepts image input. Either setting can instead pin a specific OpenRouter model ID. Generation jobs record the exact selected model.

See [SECURITY.md](SECURITY.md) for the deployment steps, reverse-proxy configuration, and migration of legacy demo data. Private database files must never live under publicly served uploads. Admin MFA, secure recovery, and durable generation-worker reconciliation remain follow-up milestones.

## Validation

- `npm run check`: type checks, lint, tests, build, and secret scanning.
- `npm run test`: includes security tests using an isolated temporary real PostgreSQL instance.
- `npm run db:check`: validate migration consistency.

The latest workspace checks passed all 65 tests, including isolated PostgreSQL security integration and OpenRouter model selection, plus type checks, lint, build, migration consistency, and secret scanning. OpenRouter responses are mocked in tests; live AI requests require a configured server-side OpenRouter key.
