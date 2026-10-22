# PrepPilot AI implementation phases

The first release targets a college demonstration with one role, Java Developer. Every phase has a persisted, reviewable result. PostgreSQL is the deployment database; SQLite is an explicit local-test option. AI credentials are optional for the core journey.

## Phase 1 Foundation
- [x] React TypeScript application shell, responsive navigation, accessible forms
- [x] FastAPI settings, SQLAlchemy schema, Alembic migration
- [x] Argon2 passwords, opaque sessions, CSRF, ownership checks, logout
- [x] Target date, IANA timezone, daily study capacity
- [x] Reviewed starter content and repeatable seed command

## Phase 2 Diagnostic assessments
- [x] Versioned question bank and assessment mappings
- [x] Persisted randomized attempts and option snapshots
- [x] Server-enforced expiry, save/resume, idempotent submission
- [x] Server scoring, explanations, skill evidence, attempt history

## Phase 3 Adaptive study plan
- [x] Role relevance and prerequisite graph
- [x] One documented priority rule with hard prerequisite ordering
- [x] Daily capacity including revision, quizzes and mocks
- [x] Explicit unscheduled work when time is insufficient
- [x] Stable task identities, version history, change reasons
- [x] Milestone results update the plan transactionally

## Phase 4 Resume and job descriptions
- [x] Bounded PDF/DOCX extraction in a separate process
- [x] Private file access, deletion and retention maintenance
- [x] Saved job descriptions and evidence-backed skill mapping
- [x] OpenRouter structured outputs, semantic validation, quotas, usage metadata
- [x] Clear unavailable states without substituted AI results

## Phase 5 Text interview practice
- [x] Stored question bank, recent-question avoidance
- [x] Persisted turns, follow-ups, duplicate-answer protection
- [x] Optional rubric feedback, retry and honest unscored transcripts
- [x] Final transcript and summary based on evaluated answers

## Phase 6 Verification and delivery
- [x] Dashboard and resource bookmarking backed by the API
- [x] Cross-user, deadline, repeat-submission and capacity tests
- [x] Model error/invalid-output contract tests
- [x] Frontend typecheck, component checks, production build
- [x] PostgreSQL CI, container configuration, setup and demo instructions
- [ ] Browser verification of core journey and small-screen layout

## Later releases
Password recovery and email verification need an email provider before a public pilot. Add an editorial admin interface, a larger independently reviewed question bank, calibrated assessments, more roles, weekly availability/exclusions, and public-pilot retention/consent operations. Voice, arbitrary code execution, college administration, billing, company scraping, and multi-agent workflows remain outside this MVP.

## Acceptance journey
Register a student, set a deadline and time budget, complete a diagnostic, open a plan with curated resources, take a fresh milestone assessment, observe a versioned plan update, and inspect the evidence on the dashboard. Repeat after a browser reload. A second student must not be able to access the first student's records. This journey must work with OpenRouter disabled.

## Verification status

Local API/algorithm/contract checks and frontend component checks pass. Migration upgrade/downgrade/schema checks pass on temporary SQLite. PostgreSQL and full browser validation run in GitHub Actions; managed browser preview cannot run the Python API in this execution environment. Live model quality/availability requires operator-provided AI configuration and synthetic test data.
