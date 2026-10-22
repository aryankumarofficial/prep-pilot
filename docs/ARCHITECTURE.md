# Architecture and boundaries

The React client renders API data and keeps a CSRF token in memory. An opaque session token lives in an HTTP-only cookie; only its hash is stored in PostgreSQL. Protected mutations check CSRF and reject foreign browser origins. Student-owned records require an authenticated ownership check.

FastAPI uses synchronous handlers and one SQLAlchemy session per request. Domain services own database writes. PostgreSQL row locks serialize student, attempt and interview transitions; unique constraints guard duplicates. Scores, scheduling and ownership never depend on browser-supplied scores or model instructions.

Assessments reference versioned questions. Each attempt snapshots exact question content, shuffled options, explanations and answer keys. Only public question fields are exposed before submission. Server deadlines survive reloads. Submission saves skill evidence and a versioned plan in one transaction.

Roadmaps separate stable tasks from per-version schedules. Completion survives new versions; dates, effort, evidence and reasons remain inspectable. Historical schedules display current task completion, as labeled in the UI. Insufficient time produces explicit unscheduled work.

The LLM has no tools, database connection or authority to alter state. Structured outputs are shape-validated and source snippets/skill IDs are checked separately. Contact data is minimized before transmission. Scored test questions use the stored starter bank, never live generated answer keys.

Resumes use private files and bounded extraction with a minimal subprocess environment. Deletion clears the source and derived analysis. Retention requires the documented maintenance job. Interview/JD lifecycle and backup retention remain public-pilot tasks.

Unavailable AI is explicit. Question practice and transcripts still work; only evaluated turns contribute to an approximate coaching score. No evaluated turns means no score.

## API modules

| Area | Main routes under `/api/v1` |
| --- | --- |
| Sessions/profile | `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/session`, `/users/me` |
| Assessments | `/assessments`, `/assessments/{id}/attempts`, `/attempts/{id}`, `/answers`, `/submit` |
| Planning | `/roadmaps/current?version=...`, `/roadmaps/recalculate`, `/roadmap-tasks/{id}` |
| Resources | `/resources`, `/resources/{id}/bookmark` |
| Resume/JD | `/resumes`, `/resumes/{id}`, `/job-descriptions`, `/job-descriptions/{id}/analyze`, `/target` |
| Interviews | `/interviews`, `/interviews/{id}`, `/turns`, `/finish`, `/turns/{id}/evaluate` |
| Dashboard | `/dashboard/summary`, `/skills`, `/capabilities` |

The development API explorer provides full schemas/routes. JSONB holds bounded snapshots and validated model metadata; ownership, identity and core relationships remain relational.
