# PrepPilot AI

A placement preparation workspace connecting reviewed assessments, measured gaps, a realistic study plan, curated resources, resume/JD analysis and text interviews.

The MVP starts with **Java Developer**, **12 topics across six subjects**, **48 original MCQs**, **eight assessments** and **12 primary-source resources**. [Development phases and tasks](docs/IMPLEMENTATION_PLAN.md) follow the supplied blueprints.

## Implemented journey

Register, save a deadline/timezone/daily budget, take a timed diagnostic, receive a prerequisite-aware plan, use its learning resources, take a fresh milestone assessment, and see a versioned plan update. Answers survive reloads; submission is server-scored and idempotent. Completed work survives schedule changes, and insufficient time produces explicit unscheduled work.

Students can bookmark resources, privately upload/delete PDF or DOCX resumes, and save job descriptions. Saving a job immediately compares explicit terms against the Java Developer catalogue without AI. Each comparison shows source quotes, its method and separate assessment evidence. Students can change the attached resume, optionally request AI analysis, and apply matching job requirements to plan priorities. Text interviews store turns, avoid recent questions, support AI follow-ups and rubric feedback, and remain usable as unscored practice without AI credentials. The dashboard shows real stored progress and evidence coverage.

## Stack

React 19, TypeScript, Vite, Tailwind, React Router; Python FastAPI/Pydantic; SQLAlchemy 2, Alembic, PostgreSQL; OpenRouter behind a replaceable adapter. One backend owns authentication, database writes, scoring and scheduling. The LLM has no database or tool access.

## Docker start

With Docker and Compose 2.24+ installed, run from the repository root:

```bash
docker compose up --build
```

Open **http://localhost:8000** and register a local student account. Compose starts PostgreSQL, runs migrations and the repeatable catalogue seed, then serves the built frontend and API together. Volumes retain database records and private uploads. Compose defaults are for local development.

### Slow or interrupted package downloads

If a build reports `ReadTimeoutError` for `files.pythonhosted.org`, the package download stalled before the application could start. The image uses pip 26.2.2 with a 120-second socket timeout, 10 connection retries and 10 interrupted-download resume/restart attempts. BuildKit keeps pip's download cache between builds without adding it to the image. Keep that cache when retrying a failed build.

For a slower connection, increase the build timeout for both application services:

```bash
docker compose build --build-arg PIP_DEFAULT_TIMEOUT=300
docker compose up -d
```

These build arguments apply inside Docker; changing pip in your host virtual environment does not change the image. An ongoing network outage or blocked access to PyPI still needs to be resolved on the host or Docker Desktop network.

## Development setup

Requirements: **Node 22.12+**, **Python 3.11+** (3.12 tested), PostgreSQL 16+.

```bash
python -m venv backend/.venv
# macOS / Linux
source backend/.venv/bin/activate
# Windows PowerShell
backend\.venv\Scripts\Activate.ps1
```

With the virtual environment activated:

```bash
pip install -r backend/requirements.lock
npm --prefix frontend ci
```

Copy `backend/.env.example` to `backend/.env` and configure your local `DATABASE_URL`. To run only PostgreSQL using Docker: `docker compose up -d db`.

From `backend/`:

```bash
alembic upgrade head
python -m app.seed
```

Then from the repository root:

```bash
npm run dev
```

Open **http://localhost:4173**. The runner starts Vite and FastAPI together; the browser uses Vite's API proxy. Development API explorer: **http://localhost:8000/docs**.

For an explicit local smoke run without PostgreSQL, create `backend/.data/` and set `DATABASE_URL=sqlite:///.data/development.db` before migrating/seeding. SQLite supports quick local tests; PostgreSQL CI verifies deployment behavior and row-lock concurrency. Production configuration rejects SQLite.

## Optional AI

Resume/job comparison works without a model using explicitly labelled catalogue term matching. It covers the starter Java Developer topics, can miss wording/context, and does not produce an ATS or proficiency score. AI enhancement requires your own provider configuration.

Copy `backend/.env.example` to `backend/.env` if needed, then set these values there:

```dotenv
OPENROUTER_API_KEY=your-own-key
OPENROUTER_MODEL=an-explicit-compatible-model-id
OPENROUTER_REQUIRE_ZDR=true
AI_REQUESTS_PER_DAY=20
```

Docker Compose now reads `backend/.env` for both `api` and `migrate`. An optional repository-root `.env` is read afterwards and overrides duplicate settings, so remove stale blank AI values there. The container database/origin settings remain set by Compose. After changing configuration, recreate the API:

```bash
docker compose up -d --force-recreate api
curl http://localhost:8000/api/v1/capabilities
```

`ai_status` is `missing_key`, `missing_model` or `ready`. `ready` means both settings are present, not that a live provider request has succeeded. Secrets are never returned by that endpoint. Native development reads `backend/.env` when the API runs from the backend directory.

Choose a model/provider endpoint supporting JSON Schema output and the required privacy policy. No free model is hardcoded. Requests require parameter support, disallow data collection and default to zero-retention routing. If no compatible endpoint is available, analysis reports unavailable; privacy rules are not silently relaxed and paid fallbacks are not automatically selected.

Daily quotas count AI operations per student. Each operation makes at most two bounded provider attempts. Provider/account quotas and spending limits are separate; configure an account/key cap before a real pilot. Usage records retain model, prompt version, status and token counts without logging private prompts.

Resume/JD analysis validates catalogue IDs and exact source snippets. Resume mentions remain distinct from assessment evidence. Interview feedback is approximate coaching about written content; no evaluated answers means no session score. Core assessments and study plans require no AI credential.

## Scheduling rules

- Unanswered items lower the overall test score. Skill accuracy and coverage use saved answers only; a blank attempt saves a result without inventing skill evidence.
- Recent skill evidence uses the latest three test results with relative weights 3, 2 and 1. Distinct-question coverage is shown; the starter bank is not statistically calibrated.
- Priority is `0.50 × normalized_gap + 0.35 × role_relevance + 0.15 × prerequisite_urgency`. Topological ordering also enforces prerequisites.
- An applied JD promotes explicit requirements and their prerequisites while retaining general role foundations.
- Learning uses 15-minute blocks and up to 78% of remaining capacity; review/mocks use the reserve. Whole blocks can leave spare minutes.
- Dates follow the student's timezone and include the target date. Completed work is retained; only remaining capacity is assigned to future incomplete work. Lowering a budget cannot erase work already completed.
- Scoring and the resulting plan update share a transaction. Retrying submission returns the existing result. Lesson checkmarks never increase skill scores.

## Verification

```bash
# backend directory, activated environment
pytest -q
# repository root
npm --prefix frontend test
npm --prefix frontend run build
```

Backend tests default to temporary SQLite databases. For PostgreSQL, set `TEST_DATABASE_URL` to a **disposable database whose name ends in `_test`**. Tests clear its application tables; never point tests at real student data.

GitHub Actions runs PostgreSQL checks, frontend component tests/builds, Chromium end-to-end checks covering registration, saved/reloaded diagnostics, adaptation, bookmarks, interviews and phone layouts, and a Docker Compose build/startup smoke check. The container check verifies database migrations, catalogue readiness and the served frontend. Screenshots/traces are retained in the `browser-verification` workflow artifact.

For local Playwright runs, build the frontend, migrate/seed a disposable database, configure its backend environment, run `npx playwright install chromium` inside `frontend/`, then `npm run test:e2e`. The config starts the API on Unix. On Windows, start the API yourself and set `PREPPILOT_E2E_URL=http://127.0.0.1:8000`, including that exact origin in `FRONTEND_ORIGINS`.

## Deployment and operations

Use a Python/container host with managed PostgreSQL, TLS, backups and a durable private upload volume. The image serves frontend and API on one origin. [Deployment tasks](docs/DEPLOYMENT.md) and [architecture boundaries](docs/ARCHITECTURE.md) describe the release sequence. No cloud infrastructure has been provisioned by this repository.

Uploads have opaque names/restricted permissions and no public route. Extraction uses a subprocess with byte, page, expansion, memory, CPU and time bounds. This is a defensive demo parser, not a general-purpose hostile-file sandbox. Scans need OCR and are rejected with an explanation.

Students can delete a resume and its derived analysis. Schedule `python -m app.maintenance` daily to enforce configured resume retention and remove expired sessions/rate counters. Timed deletion requires that hosting job to actually run.

## Before a public pilot

Add email verification/password recovery, account export/deletion, interview/JD retention, a larger independently reviewed bank, an editorial admin UI, additional roles, stronger file isolation and wider accessibility/load testing. Voice, arbitrary code execution, hiring predictions, company scraping, billing and college-wide administration are outside this MVP. Follow the deployment checklist before inviting students.
