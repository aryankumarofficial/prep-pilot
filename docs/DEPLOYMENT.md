# Deployment tasks

Deploy the supplied container behind HTTPS on a Python-capable host, with frontend and API on one origin. Separate frontend hosting needs an explicit API reverse proxy because the client uses relative `/api/v1` URLs.

1. Provision a dedicated PostgreSQL database/user with TLS and backups. Separate development, test and production databases.
2. Build the Dockerfile. Mount a durable private volume at `/app/backend/.data/uploads`, owned by UID 10001.
3. Set `APP_ENV=production`, `COOKIE_SECURE=true`, a TLS-enabled `DATABASE_URL`, and an exact `FRONTEND_ORIGINS` JSON list containing your real HTTPS app origin through the host's config/secret manager.
4. Run `alembic upgrade head` as a single release task, followed by `python -m app.seed`. Do not run migrations independently in every API worker.
5. Start the image. `/health/live` checks the process; `/health/ready` checks the database and published catalogue.
6. Schedule `python -m app.maintenance` daily with the same database environment and upload volume.
7. Verify the actual deployed flow, ownership checks, duplicate submission, reload behavior, resume deletion and provider outages before inviting students.

The Compose example uses local bindings and development cookies. PostgreSQL row locks and database rate counters support multiple API workers. AI calls currently run synchronously within bounded requests; measure a small pilot before adding a durable job queue.

## AI verification

The operator must supply an OpenRouter key and compatible model ID. Test a real extraction and interview answer with synthetic, non-sensitive data. Automated provider tests use mocked responses; they do not establish live-model availability or grading quality. Set provider-side spending limits.

## Data lifecycle

Maintenance removes expired resume files/text and clears derived resume analysis. Job descriptions and interview transcripts persist until an account/data lifecycle policy is implemented. Before a public pilot, define account export/deletion, transcript/JD retention, consent wording and backup retention. Keep resumes, answers, tokens and passwords out of logs.
