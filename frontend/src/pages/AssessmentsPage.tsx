import { ArrowRight, ClipboardCheck, Clock3, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { errorMessage, post } from "../api";
import { useLoad } from "../hooks";
import type { Assessment, Attempt, AttemptHistory } from "../types";
import {
  Button,
  Empty,
  ErrorNotice,
  formatDate,
  Loading,
  Notice,
  PageHeader,
  Panel,
} from "../components/ui";

export default function AssessmentsPage() {
  const tests = useLoad<Assessment[]>("/assessments");
  const history = useLoad<AttemptHistory[]>("/attempts");
  const navigate = useNavigate();
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function begin(id: string) {
    setBusy(id);
    setError("");
    try {
      const attempt = await post<Attempt>(`/assessments/${id}/attempts`, {
        request_key: crypto.randomUUID(),
      });
      navigate(`/assessments/${attempt.id}`);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  if (tests.loading) return <Loading />;
  if (tests.error)
    return <ErrorNotice message={tests.error} retry={tests.reload} />;
  return (
    <>
      <PageHeader
        eyebrow="KNOW WHERE YOU STAND"
        title="Practice with a purpose."
      >
        Find your starting point, then check what’s changing.
      </PageHeader>
      {error ? <ErrorNotice message={error} /> : null}
      <Notice>
        The starter bank contains 48 original MCQs. Diagnostics and milestones
        use different items; repeated practice can still become familiar. Scores
        are preparation signals.
      </Notice>
      <div className="assessment-grid">
        {tests.data?.map((test) => (
          <Panel
            key={test.id}
            className={`assessment-card ${test.kind === "diagnostic" ? "featured" : ""}`}
          >
            <div
              className={`icon-tile ${test.kind === "diagnostic" ? "" : "purple"}`}
            >
              <ClipboardCheck size={23} />
            </div>
            <span className="subtle-badge">
              {test.kind === "diagnostic"
                ? "START HERE"
                : test.kind === "mock"
                  ? "MIXED PRACTICE"
                  : "MILESTONE"}
            </span>
            <h2>{test.title}</h2>
            <p>
              {test.kind === "diagnostic"
                ? "A broad starting point across six placement subjects. Your results build the first version of your roadmap."
                : test.kind === "mock"
                  ? "Bring the subjects together in one timed practice session."
                  : `Check your ${test.category} foundations with a fresh practice set.`}
            </p>
            <div className="assessment-meta">
              <span>{test.question_count} questions</span>
              <span>
                <Clock3 size={14} />
                {test.duration_seconds / 60} minutes
              </span>
            </div>
            <Button
              variant={test.kind === "diagnostic" ? "primary" : "secondary"}
              busy={busy === test.id}
              disabled={!!busy}
              onClick={() => {
                void begin(test.id);
              }}
            >
              Start or resume
              <ArrowRight size={16} />
            </Button>
          </Panel>
        ))}
      </div>
      <Panel>
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR PRACTICE LOG</p>
            <h2>Recent attempts</h2>
          </div>
          <RotateCcw size={18} />
        </div>
        {history.error ? (
          <ErrorNotice message={history.error} retry={history.reload} />
        ) : history.loading ? (
          <Loading text="Loading your attempts…" />
        ) : history.data?.length ? (
          <div className="history-list">
            {history.data.map((attempt) => (
              <Link
                key={attempt.id}
                to={`/assessments/${attempt.id}`}
                className="history-row"
              >
                <div>
                  <strong>{attempt.title}</strong>
                  <span>
                    {formatDate(attempt.started_at)} · {attempt.total_count}{" "}
                    questions
                  </span>
                </div>
                <span
                  className={`pill ${attempt.status === "in_progress" ? "purple" : ""}`}
                >
                  {attempt.status === "in_progress"
                    ? "Resume"
                    : `${attempt.score}%`}
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="Your first attempt is waiting">
            Start the diagnostic above. Your work is saved as you answer.
          </Empty>
        )}
      </Panel>
    </>
  );
}
