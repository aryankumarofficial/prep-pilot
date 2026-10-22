import { ArrowRight, FileText, Sparkles, Trash2, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage, post } from "../api";
import { useLoad } from "../hooks";
import type { Capabilities, Job, Resume, Skill } from "../types";
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

export default function ResumePage() {
  const resumes = useLoad<Resume[]>("/resumes"),
    jobs = useLoad<Job[]>("/job-descriptions");
  const capabilities = useLoad<Capabilities>("/capabilities"),
    skills = useLoad<Skill[]>("/skills");
  const [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const job = jobs.data?.find((j) => j.id === selected) ?? jobs.data?.[0];
  const skillMap = new Map(skills.data?.map((s) => [s.id, s]));
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy("upload");
    setError("");
    try {
      await api("/resumes", { method: "POST", body: new FormData(form) });
      resumes.reload();
      form.reset();
      setMessage("Resume uploaded and text extracted.");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function saveJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("job");
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await post<Job>("/job-descriptions", {
        title: form.get("title"),
        raw_text: form.get("raw_text"),
        resume_id: form.get("resume_id") || null,
      });
      setSelected(result.id);
      jobs.reload();
      setMessage(
        "Target job saved. You can now analyze its skill requirements.",
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function analyze(id: string) {
    setBusy("analyze");
    setError("");
    try {
      await post(`/job-descriptions/${id}/analyze`);
      jobs.reload();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function target(id: string) {
    setBusy("target");
    setError("");
    try {
      await post(`/job-descriptions/${id}/target`);
      setMessage(
        "Your roadmap now prioritizes this target job. Open the roadmap to see the new version.",
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function remove(id: string) {
    setBusy(id);
    setError("");
    try {
      await api(`/resumes/${id}`, { method: "DELETE" });
      resumes.reload();
      jobs.reload();
      setMessage("Resume and its derived analysis deleted.");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  if (resumes.loading || jobs.loading) return <Loading />;
  if (resumes.error || jobs.error)
    return (
      <ErrorNotice
        message={resumes.error || jobs.error}
        retry={() => {
          resumes.reload();
          jobs.reload();
        }}
      />
    );
  return (
    <>
      <PageHeader
        eyebrow="CONNECT YOUR STORY TO THE ROLE"
        title="See the fit. Find the next step."
      >
        Compare written evidence with a target job, alongside your measured
        assessment results.
      </PageHeader>
      {error ? <ErrorNotice message={error} /> : null}
      {message ? (
        <p className="success" role="status">
          {message}
        </p>
      ) : null}
      {!capabilities.data?.ai_enabled ? (
        <Notice>
          AI analysis is awaiting server configuration. You can upload your
          resume, save a job, and continue using assessments and roadmaps.
        </Notice>
      ) : (
        <Notice>
          AI analysis sends relevant text to the configured model provider.
          Contact details are removed automatically; omit other personal
          information that is not needed.
        </Notice>
      )}
      <div className="two-columns resume-inputs">
        <Panel>
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR EXPERIENCE</p>
              <h2>A little context helps.</h2>
            </div>
            <FileText size={21} />
          </div>
          <form onSubmit={upload} className="form-stack">
            <label className="upload-zone">
              <Upload size={26} />
              <strong>Choose your resume</strong>
              <span>
                PDF or DOCX · up to 5 MB · text-based PDF, up to 10 pages
              </span>
              <input
                type="file"
                name="file"
                accept=".pdf,.docx"
                required
                aria-label="Choose resume file"
              />
            </label>
            <Button
              variant="secondary"
              type="submit"
              busy={busy === "upload"}
              disabled={!!busy}
            >
              Upload & extract text
            </Button>
          </form>
          <p className="small muted">
            Private to your account. Retained for up to{" "}
            {capabilities.data?.resume_retention_days ?? 30} days when scheduled
            maintenance runs. Delete it at any time.
          </p>
          <div className="resume-files">
            {resumes.data?.map((resume) => (
              <div key={resume.id}>
                <FileText size={17} />
                <span>
                  <strong>{resume.filename}</strong>
                  <small>
                    {formatDate(resume.created_at)} ·{" "}
                    {resume.characters.toLocaleString()} characters
                  </small>
                </span>
                <button
                  className="icon-button"
                  disabled={!!busy}
                  aria-label={`Delete ${resume.filename}`}
                  onClick={() => {
                    void remove(resume.id);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR DESTINATION</p>
              <h2>What role are you aiming for?</h2>
            </div>
            <Sparkles size={21} />
          </div>
          <form onSubmit={saveJob} className="form-stack">
            <label>
              Job title
              <input
                name="title"
                placeholder="e.g. Junior Java Developer"
                minLength={3}
                maxLength={160}
                required
              />
            </label>
            <label>
              Job description
              <textarea
                name="raw_text"
                placeholder="Paste the responsibilities and required skills…"
                minLength={40}
                maxLength={12000}
                rows={5}
                required
              />
            </label>
            <label>
              Compare with resume
              <select name="resume_id">
                <option value="">
                  No resume · extract job requirements only
                </option>
                {resumes.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.filename}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" busy={busy === "job"} disabled={!!busy}>
              Save target job
              <ArrowRight size={16} />
            </Button>
          </form>
        </Panel>
      </div>
      <Panel>
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR SKILL EVIDENCE</p>
            <h2>A clearer picture of the gap.</h2>
          </div>
          {jobs.data?.length ? (
            <label className="compact-select">
              <span className="sr-only">Saved job</span>
              <select
                value={job?.id ?? ""}
                onChange={(e) => setSelected(e.target.value)}
              >
                {jobs.data.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        {job ? (
          <>
            <div className="section-heading">
              <div>
                <h3>{job.title}</h3>
                <p className="small muted">
                  {job.resume_id
                    ? "Resume evidence and role requirements"
                    : "Role requirements · no resume selected"}
                </p>
              </div>
              {!job.analysis ? (
                <Button
                  busy={busy === "analyze"}
                  disabled={!!busy || !capabilities.data?.ai_enabled}
                  onClick={() => {
                    void analyze(job.id);
                  }}
                >
                  <Sparkles size={16} />
                  Analyze skills
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  busy={busy === "target"}
                  disabled={!!busy}
                  onClick={() => {
                    void target(job.id);
                  }}
                >
                  Use for my roadmap
                  <ArrowRight size={15} />
                </Button>
              )}
            </div>
            {job.analysis ? (
              <>
                <div className="gap-list">
                  {job.analysis.required_skills.map((match) => {
                    const resumeMatch = job.analysis?.resume_skills.find(
                      (s) => s.skill_id === match.skill_id,
                    );
                    const measured = skillMap.get(match.skill_id);
                    return (
                      <div key={match.skill_id} className="gap-row">
                        <div>
                          <h3>{measured?.name ?? match.skill_id}</h3>
                          <p className="small muted">
                            Job evidence: “{match.evidence}”
                          </p>
                          {resumeMatch ? (
                            <p className="small">
                              Resume evidence: “{resumeMatch.evidence}”
                            </p>
                          ) : null}
                        </div>
                        <div className="gap-status">
                          <span
                            className={`pill ${resumeMatch ? "" : "amber"}`}
                          >
                            {resumeMatch
                              ? "Resume evidence found"
                              : "Missing resume evidence"}
                          </span>
                          <span className="small muted">
                            Test score:{" "}
                            {measured?.score == null
                              ? "Not assessed"
                              : `${measured.score}%`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="small muted">
                  A missing resume mention does not establish a skill weakness.
                  Assessment results provide separate evidence.
                </p>
                <Link to="/roadmap" className="text-link">
                  Open my roadmap
                  <ArrowRight size={15} />
                </Link>
              </>
            ) : (
              <p className="muted">
                Your job is saved. Run analysis when AI is available to identify
                supported catalogue skills.
              </p>
            )}
          </>
        ) : (
          <Empty title="A role gives your preparation context">
            Save a job description above. Your analysis will appear here.
          </Empty>
        )}
      </Panel>
    </>
  );
}
