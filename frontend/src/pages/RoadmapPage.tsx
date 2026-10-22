import { ArrowRight, Check, ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage, post } from "../api";
import { useLoad } from "../hooks";
import type { Plan } from "../types";
import {
  Button,
  Empty,
  ErrorNotice,
  formatDate,
  Loading,
  Notice,
  PageHeader,
  Panel,
  Progress,
} from "../components/ui";

export default function RoadmapPage() {
  const [version, setVersion] = useState("");
  const {
    data,
    loading,
    error: loadError,
    reload,
  } = useLoad<Plan | null>(
    `/roadmaps/current${version ? `?version=${version}` : ""}`,
  );
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [expanded, setExpanded] = useState("");
  async function recalculate() {
    setBusy("refresh");
    setError("");
    try {
      await post("/roadmaps/recalculate", { request_key: crypto.randomUUID() });
      setVersion("");
      reload();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function complete(id: string, completed: boolean) {
    setBusy(id);
    setError("");
    try {
      await api(`/roadmap-tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      });
      reload();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  if (loading) return <Loading text="Finding your next steps…" />;
  if (loadError) return <ErrorNotice message={loadError} retry={reload} />;
  if (!data)
    return (
      <>
        <PageHeader
          eyebrow="DIRECTION, MADE PERSONAL"
          title="Your roadmap starts with evidence."
        />
        <Panel>
          <Empty
            title="Let’s find your starting point"
            to="/assessments"
            label="Take my diagnostic"
          >
            A short assessment will help us choose useful topics and fit them
            into your available time.
          </Empty>
        </Panel>
      </>
    );
  const completed = data.tasks.filter((t) => t.completed).length;
  const dates = Array.from(
    new Set(data.tasks.map((t) => t.planned_date)),
  ).sort();
  const historical = data.version !== data.current_version;
  return (
    <>
      <PageHeader
        eyebrow="SMALL STEPS, CLEAR DIRECTION"
        title="A plan that moves with you."
        action={
          <Button
            variant="secondary"
            busy={busy === "refresh"}
            disabled={!!busy}
            onClick={() => {
              void recalculate();
            }}
          >
            <RefreshCw size={15} />
            Refresh plan
          </Button>
        }
      >
        Learning, practice and review, fitted to your day.
      </PageHeader>
      {error ? <ErrorNotice message={error} /> : null}
      <Panel className="plan-summary">
        <div>
          <span className="pill">VERSION {data.version}</span>
          <h2>{data.daily_minutes} minutes a day. A little more ready.</h2>
          <p>{data.change_reason}</p>
          {data.job_title ? (
            <p className="small">Target job: {data.job_title}</p>
          ) : null}
          <span className="small muted">
            Target:{" "}
            {formatDate(data.target_date, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            · {completed}/{data.tasks.length} tasks complete
          </span>
          <Progress
            value={
              data.tasks.length ? (completed / data.tasks.length) * 100 : 0
            }
            label="Plan completion"
          />
        </div>
        <label className="version-select">
          Plan history
          <select value={version} onChange={(e) => setVersion(e.target.value)}>
            <option value="">Current · v{data.current_version}</option>
            {data.versions.map((v) => (
              <option key={v.version} value={v.version}>
                Version {v.version} · {formatDate(v.created_at)}
              </option>
            ))}
          </select>
        </label>
      </Panel>
      {historical ? (
        <Notice>
          You’re viewing a saved schedule. Task completion reflects your current
          progress.
        </Notice>
      ) : null}
      {data.unscheduled.length ? (
        <details className="notice unscheduled">
          <summary>
            {data.unscheduled.length} tasks need more time ·{" "}
            {data.unscheduled.reduce((n, t) => n + t.minutes, 0)} minutes
            outside your current capacity
          </summary>
          <p>
            We kept your daily limit. Adjust your date or study time to make
            more room.
          </p>
          <Link to="/settings" className="text-link">
            Adjust preferences
            <ArrowRight size={14} />
          </Link>
          <ul>
            {data.unscheduled.map((t) => (
              <li key={t.key}>
                {t.title} · {t.minutes} min
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className="roadmap-timeline">
        {dates.map((date, dayIndex) => (
          <section className="roadmap-day" key={date}>
            <div className="day-marker">
              <span>{String(dayIndex + 1).padStart(2, "0")}</span>
              <div>
                <h3>
                  {formatDate(date, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </h3>
                <p>
                  {data.tasks
                    .filter((t) => t.planned_date === date)
                    .reduce((n, t) => n + t.planned_minutes, 0)}{" "}
                  minutes planned
                </p>
              </div>
            </div>
            <div className="day-tasks">
              {data.tasks
                .filter((t) => t.planned_date === date)
                .map((task) => (
                  <Panel
                    key={task.id}
                    className={`roadmap-task ${task.completed ? "completed" : ""}`}
                  >
                    <div className="task-main">
                      <button
                        className={`task-checkbox ${task.completed ? "checked" : ""}`}
                        disabled={historical || !!busy || !!task.assessment_id}
                        aria-label={`${task.completed ? "Mark incomplete" : "Mark complete"}: ${task.title}`}
                        aria-pressed={task.completed}
                        onClick={() => {
                          void complete(task.id, !task.completed);
                        }}
                      >
                        {task.completed ? <Check size={16} /> : null}
                      </button>
                      <div>
                        <span
                          className={`task-kind ${task.task_type !== "learn" ? "purple-text" : ""}`}
                        >
                          {task.task_type === "learn"
                            ? "LEARN & PRACTICE"
                            : task.task_type === "mock"
                              ? "MIXED MOCK"
                              : "MILESTONE"}
                        </span>
                        <h3>{task.title}</h3>
                        <span className="small muted">
                          {task.planned_minutes} minutes
                        </span>
                      </div>
                    </div>
                    <div className="task-links">
                      {task.resource ? (
                        <a
                          className="text-link"
                          href={task.resource.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open resource
                          <ExternalLink size={14} />
                        </a>
                      ) : null}
                      {task.assessment_id ? (
                        <Link to="/assessments" className="text-link">
                          Take milestone
                          <ArrowRight size={14} />
                        </Link>
                      ) : null}
                      <button
                        className="why-button"
                        aria-expanded={expanded === task.id}
                        onClick={() =>
                          setExpanded((v) => (v === task.id ? "" : task.id))
                        }
                      >
                        Why this task?
                      </button>
                    </div>
                    {expanded === task.id ? (
                      <p className="task-reason">{task.reason}</p>
                    ) : null}
                  </Panel>
                ))}
            </div>
          </section>
        ))}
      </div>
      <p className="small muted">
        Learning checkmarks track completion. Assessments provide the evidence
        used to update skill scores.
      </p>
    </>
  );
}
