import {
  ArrowRight,
  Check,
  MessageSquare,
  MicOff,
  Sparkles,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, errorMessage, post } from "../api";
import { useLoad } from "../hooks";
import type { Capabilities, Interview, Job } from "../types";
import {
  Button,
  ErrorNotice,
  formatDate,
  Notice,
  PageHeader,
  Panel,
} from "../components/ui";

type History = Pick<Interview, "id" | "status" | "started_at">;
export default function InterviewsPage() {
  const capabilities = useLoad<Capabilities>("/capabilities"),
    history = useLoad<History[]>("/interviews"),
    jobs = useLoad<Job[]>("/job-descriptions");
  const [session, setSession] = useState<Interview | null>(null),
    [jobId, setJobId] = useState(""),
    [answer, setAnswer] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const current = session?.turns.find((t) => t.answer === null);
  async function begin() {
    setBusy("start");
    setError("");
    try {
      setSession(
        await post<Interview>("/interviews", {
          job_description_id: jobId || null,
        }),
      );
      history.reload();
      setAnswer("");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function open(id: string) {
    setBusy(id);
    setError("");
    try {
      setSession(await api<Interview>(`/interviews/${id}`));
      setAnswer("");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!session || !current) return;
    setBusy("answer");
    setError("");
    try {
      setSession(
        await post<Interview>(`/interviews/${session.id}/turns`, {
          turn_id: current.id,
          answer,
        }),
      );
      setAnswer("");
      history.reload();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function finish() {
    if (!session) return;
    setBusy("finish");
    setError("");
    try {
      setSession(await post<Interview>(`/interviews/${session.id}/finish`));
      history.reload();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function retry(turnId: string) {
    if (!session) return;
    setBusy(turnId);
    setError("");
    try {
      setSession(
        await post<Interview>(
          `/interviews/${session.id}/turns/${turnId}/evaluate`,
        ),
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE PRACTICE. A CLEARER ANSWER."
        title="Your interview studio."
        action={
          <span className="pill purple">
            <MicOff size={14} />
            Text practice
          </span>
        }
      >
        Work through technical questions, build your examples, and reflect on
        your answers.
      </PageHeader>
      {error ? <ErrorNotice message={error} /> : null}
      {!capabilities.data?.ai_enabled ? (
        <Notice>
          Question practice and transcripts are available. AI feedback will
          become available when the server is configured; answers remain
          unscored until evaluated.
        </Notice>
      ) : (
        <Notice>
          AI feedback is an approximate coaching signal about your written
          answer. It does not assess spoken fluency or predict interview
          outcomes.
        </Notice>
      )}
      <div className="interview-layout">
        <div>
          {!session ? (
            <Panel className="interview-start">
              <div className="studio-icon">
                <MessageSquare size={32} strokeWidth={1.4} />
                <Sparkles size={17} />
              </div>
              <p className="eyebrow">ROOM TO THINK, SPACE TO PRACTICE</p>
              <h2>Your next interview starts with one answer.</h2>
              <p className="muted">
                Up to five questions, chosen from a maintained bank using your
                target role and assessed gaps. When AI is available, a relevant
                follow-up can explore your first answer.
              </p>
              <label>
                Optional target job
                <select
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                >
                  <option value="">Java Developer · general preparation</option>
                  {jobs.data
                    ?.filter((j) => j.analysis)
                    .map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                      </option>
                    ))}
                </select>
              </label>
              <Button
                busy={busy === "start"}
                disabled={!!busy}
                onClick={() => {
                  void begin();
                }}
              >
                Start or resume a session
                <ArrowRight size={16} />
              </Button>
              <p className="small muted">
                Take your time. Your submitted answers are saved to your
                account.
              </p>
            </Panel>
          ) : (
            <>
              <Panel className="session-header">
                <div>
                  <span className="eyebrow">
                    {session.status === "finished"
                      ? "SESSION COMPLETE"
                      : "INTERVIEW IN PROGRESS"}
                  </span>
                  <h2>
                    {session.status === "finished"
                      ? "Good practice leaves you something to work on."
                      : `Question ${session.turns.length} of ${session.maximum_questions}`}
                  </h2>
                  <p className="muted">
                    {session.turns.filter((t) => t.answer !== null).length}{" "}
                    answers saved · {session.evaluated_answers} evaluated
                  </p>
                  {session.status === "finished" ? (
                    <p className="session-score">
                      {session.score === null
                        ? "Unscored — AI feedback unavailable"
                        : `${session.score}% coaching score · evaluated answers only`}
                    </p>
                  ) : null}
                </div>
                {session.status === "active" ? (
                  <Button
                    variant="ghost"
                    busy={busy === "finish"}
                    disabled={!!busy}
                    onClick={() => {
                      void finish();
                    }}
                  >
                    Finish session
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setSession(null)}>
                    New session
                  </Button>
                )}
              </Panel>
              {session.turns
                .filter((t) => t.answer !== null)
                .map((turn, index) => (
                  <Panel key={turn.id} className="interview-turn">
                    <span className="pill">
                      <Check size={13} />
                      ANSWER {index + 1} SAVED
                    </span>
                    <h3>{turn.question}</h3>
                    <details open={session.status === "finished"}>
                      <summary>Your answer & feedback</summary>
                      <p className="transcript">{turn.answer}</p>
                      {turn.feedback ? (
                        <>
                          <div className="feedback-metrics">
                            {(
                              [
                                "correctness",
                                "clarity",
                                "completeness",
                                "examples",
                              ] as const
                            ).map((metric) => (
                              <div key={metric}>
                                <span>{metric}</span>
                                <strong>
                                  {turn.feedback![metric]}
                                  <small>/4</small>
                                </strong>
                              </div>
                            ))}
                          </div>
                          <div className="feedback-columns">
                            <div>
                              <h4>Keep doing this</h4>
                              <ul>
                                {turn.feedback.strengths.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h4>Try this next</h4>
                              <ul>
                                {turn.feedback.improvements.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div>
                          <p className="small muted">
                            Your answer is saved. AI feedback is currently
                            unavailable, so no score has been assigned.
                          </p>
                          <Button
                            variant="secondary"
                            busy={busy === turn.id}
                            disabled={!!busy || !capabilities.data?.ai_enabled}
                            onClick={() => {
                              void retry(turn.id);
                            }}
                          >
                            Retry feedback
                          </Button>
                        </div>
                      )}
                    </details>
                  </Panel>
                ))}
              {current && session.status === "active" ? (
                <Panel className="interview-question">
                  <span className="eyebrow">YOUR NEXT QUESTION</span>
                  <h2>{current.question}</h2>
                  <form onSubmit={send} className="form-stack">
                    <label>
                      Your answer
                      <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        minLength={3}
                        maxLength={6000}
                        rows={7}
                        required
                        placeholder="Explain your thinking. A concrete example can help."
                        disabled={!!busy}
                      />
                    </label>
                    <div className="inline-actions">
                      <Button
                        type="submit"
                        busy={busy === "answer"}
                        disabled={!!busy || answer.trim().length < 3}
                      >
                        Save answer & continue
                        <ArrowRight size={16} />
                      </Button>
                      <span className="small muted">{answer.length}/6,000</span>
                    </div>
                    <p className="small muted" role="status">
                      {busy === "answer"
                        ? "Saving your answer and preparing the next step…"
                        : "Answers are saved when you submit them."}
                    </p>
                  </form>
                </Panel>
              ) : null}
            </>
          )}
        </div>
        <aside>
          <Panel>
            <div className="section-heading">
              <h3>Your sessions</h3>
              <MessageSquare size={17} />
            </div>
            {history.error ? (
              <ErrorNotice message={history.error} retry={history.reload} />
            ) : history.data?.length ? (
              <div className="session-list">
                {history.data.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      void open(item.id);
                    }}
                    disabled={!!busy}
                    className={session?.id === item.id ? "active" : ""}
                  >
                    <span>
                      {formatDate(item.started_at, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <small>
                      {item.status === "active"
                        ? "Resume session"
                        : "View transcript"}
                    </small>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="small muted">
                Your saved sessions will appear here.
              </p>
            )}
          </Panel>
          <div className="interview-tip">
            <span className="eyebrow">A USEFUL ANSWER</span>
            <h3>Explain. Illustrate. Reflect.</h3>
            <p>
              Start with the idea, add a concrete example, and explain the
              tradeoff. For project questions, make your own contribution clear.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
