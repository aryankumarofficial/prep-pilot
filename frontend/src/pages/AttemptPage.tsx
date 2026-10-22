import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { errorMessage, post } from "../api";
import { useLoad } from "../hooks";
import type { Attempt } from "../types";
import {
  Button,
  ErrorNotice,
  Loading,
  Notice,
  PageHeader,
  Panel,
  Progress,
} from "../components/ui";

export default function AttemptPage() {
  const { id } = useParams();
  const {
    data,
    setData,
    error: loadError,
    loading,
    reload,
  } = useLoad<Attempt>(`/attempts/${id}`);
  const [index, setIndex] = useState(0),
    [remaining, setRemaining] = useState(0),
    [saving, setSaving] = useState(false),
    [submitting, setSubmitting] = useState(false),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  const autoSubmitted = useRef(false);
  useEffect(() => {
    setIndex(0);
    autoSubmitted.current = false;
  }, [id]);
  useEffect(() => {
    if (!data || data.status !== "in_progress") return;
    const ends =
      performance.now() +
      Math.max(0, Date.parse(data.expires_at) - Date.parse(data.server_now));
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((ends - performance.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        setSubmitting(true);
        post<Attempt>(`/attempts/${id}/submit`)
          .then(setData)
          .catch((e) => setError(errorMessage(e)))
          .finally(() => setSubmitting(false));
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [id, data?.id, data?.expires_at, data?.server_now, data?.status, setData]);
  async function save(option: string) {
    if (!data) return;
    setSaving(true);
    setError("");
    const question = data.questions[index];
    try {
      await post(`/attempts/${id}/answers`, {
        question_id: question.id,
        selected_option: option,
      });
      setData((old) =>
        old
          ? {
              ...old,
              questions: old.questions.map((q) =>
                q.id === question.id ? { ...q, selected_option: option } : q,
              ),
            }
          : old,
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }
  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      setData(await post<Attempt>(`/attempts/${id}/submit`));
      setConfirm(false);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }
  if (loading) return <Loading text="Restoring your saved assessment…" />;
  if (loadError) return <ErrorNotice message={loadError} retry={reload} />;
  if (!data) return null;
  if (data.status !== "in_progress")
    return (
      <>
        <PageHeader
          eyebrow="ONE MORE STEP FORWARD"
          title="Your assessment, explained."
        >
          Your results have been saved and your study plan has been updated.
        </PageHeader>
        <Panel className="result-summary">
          <div className="result-ring">
            <span>{data.score}%</span>
          </div>
          <div>
            <span className="pill">
              <CheckCircle2 size={14} />
              RESULT SAVED
            </span>
            <h2>{data.title}</h2>
            <p>
              {data.correct_count} of {data.total_count} correct
              {data.status === "expired"
                ? " · Time elapsed; saved answers were scored."
                : ""}
            </p>
            <Link to="/roadmap" className="button primary">
              See my updated plan
              <ArrowRight size={16} />
            </Link>
          </div>
        </Panel>
        <Notice>
          Review the reasoning, then try the topic milestone. Familiarity with
          repeated questions can increase practice scores.
        </Notice>
        <div className="answer-review">
          {data.questions.map((q, i) => (
            <Panel key={q.id}>
              <span className={`pill ${q.is_correct ? "" : "amber"}`}>
                {q.is_correct
                  ? "Correct"
                  : q.selected_option
                    ? "Review this one"
                    : "Unanswered"}
              </span>
              <h3>
                {i + 1}. {q.prompt}
              </h3>
              <p className="small">
                Your answer:{" "}
                {q.options.find((o) => o.id === q.selected_option)?.text ??
                  "Not answered"}
              </p>
              <p className="correct-answer">
                <Check size={16} />
                Correct answer:{" "}
                {q.options.find((o) => o.id === q.correct_option)?.text}
              </p>
              <p className="muted">{q.explanation}</p>
              <a
                className="text-link"
                href={q.source_url}
                target="_blank"
                rel="noreferrer"
              >
                Read the source
                <ArrowRight size={14} />
              </a>
            </Panel>
          ))}
        </div>
      </>
    );
  const question = data.questions[index];
  const answered = data.questions.filter((q) => q.selected_option).length;
  return (
    <>
      <PageHeader
        eyebrow="FOCUS MODE"
        title={data.title}
        action={
          <div
            className={`timer ${remaining < 60 ? "urgent" : ""}`}
            role="timer"
            aria-label="Time remaining"
          >
            <Clock3 size={18} />
            {Math.floor(remaining / 60)
              .toString()
              .padStart(2, "0")}
            :{(remaining % 60).toString().padStart(2, "0")}
          </div>
        }
      >
        Your answers save after each selection. You can return before the
        deadline.
      </PageHeader>
      {error ? <ErrorNotice message={error} /> : null}
      <div className="test-layout">
        <Panel className="question-panel">
          <div className="section-heading">
            <span className="eyebrow">
              QUESTION {index + 1} OF {data.total_count}
            </span>
            <span className="small muted" role="status">
              {saving ? "Saving…" : "Answer changes save automatically"}
            </span>
          </div>
          <Progress
            value={(answered / data.total_count) * 100}
            label="Questions answered"
          />
          <h2 className="question-title">{question.prompt}</h2>
          <fieldset className="options">
            <legend className="sr-only">Choose one answer</legend>
            {question.options.map((option, i) => (
              <label
                key={option.id}
                className={`answer-option ${question.selected_option === option.id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={question.selected_option === option.id}
                  disabled={saving || submitting || remaining === 0}
                  onChange={() => {
                    void save(option.id);
                  }}
                />
                <span className="option-letter">
                  {String.fromCharCode(65 + i)}
                </span>
                <span>{option.text}</span>
                {question.selected_option === option.id ? (
                  <Check size={16} />
                ) : null}
              </label>
            ))}
          </fieldset>
          <div className="question-actions">
            <Button
              variant="ghost"
              disabled={index === 0 || saving}
              onClick={() => setIndex((i) => i - 1)}
            >
              <ArrowLeft size={16} />
              Previous
            </Button>
            {index < data.questions.length - 1 ? (
              <Button
                variant="secondary"
                disabled={saving}
                onClick={() => setIndex((i) => i + 1)}
              >
                Next question
                <ArrowRight size={16} />
              </Button>
            ) : (
              <Button onClick={() => setConfirm(true)} disabled={saving}>
                Review & submit
              </Button>
            )}
          </div>
        </Panel>
        <Panel className="question-navigator">
          <h3>Your question map</h3>
          <p className="small muted">
            {answered}/{data.total_count} answered
          </p>
          <div className="question-grid">
            {data.questions.map((q, i) => (
              <button
                key={q.id}
                className={`${q.selected_option ? "answered" : ""} ${index === i ? "current" : ""}`}
                aria-label={`Question ${i + 1}${q.selected_option ? ", answered" : ""}`}
                aria-current={index === i ? "step" : undefined}
                onClick={() => setIndex(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={() => setConfirm(true)}
            disabled={saving}
          >
            Submit assessment
          </Button>
          <p className="small muted">
            The deadline is enforced by the server. Refreshing keeps the same
            attempt.
          </p>
        </Panel>
      </div>
      {confirm || remaining === 0 ? (
        <Panel className="submit-confirm">
          <h3>
            {remaining === 0
              ? "The assessment time has ended."
              : "Ready to finish?"}
          </h3>
          <p>
            {answered} answers saved. {data.total_count - answered} questions
            unanswered. Submitting will calculate your result and update your
            plan.
          </p>
          <div className="inline-actions">
            <Button
              busy={submitting}
              disabled={saving}
              onClick={() => {
                void submit();
              }}
            >
              Submit saved answers
            </Button>
            {remaining > 0 ? (
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Keep working
              </Button>
            ) : null}
          </div>
        </Panel>
      ) : null}
    </>
  );
}
