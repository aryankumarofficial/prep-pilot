import { ArrowRight, FileText, Sparkles, Trash2, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, errorMessage, post } from "../api";
import JobComparison from "../components/JobComparison";
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
  const resumes = useLoad<Resume[]>("/resumes");
  const jobs = useLoad<Job[]>("/job-descriptions");
  const capabilities = useLoad<Capabilities>("/capabilities");
  const skills = useLoad<Skill[]>("/skills");
  const [selected, setSelected] = useState("");
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [comparisonResumes, setComparisonResumes] = useState<
    Record<string, string>
  >({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const job = jobs.data?.find((item) => item.id === selected) ?? jobs.data?.[0];

  function start(action: string) {
    setBusy(action);
    setError("");
    setMessage("");
  }
  function updateJob(result: Job) {
    jobs.setData((previous) => [
      result,
      ...(previous ?? []).filter((item) => item.id !== result.id),
    ]);
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    start("upload");
    try {
      const resume = await api<Resume>("/resumes", {
        method: "POST",
        body: new FormData(form),
      });
      resumes.setData((previous) => [resume, ...(previous ?? [])]);
      setResumeId(resume.id);
      form.reset();
      setMessage(
        "Resume ready. It is selected for your next job comparison, or you can choose it for a saved job below.",
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy("");
    }
  }
  async function saveJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    start("job");
    let saved = false;
    try {
      const result = await post<Job>("/job-descriptions", {
        title: form.get("title"),
        raw_text: form.get("raw_text"),
        resume_id: form.get("resume_id") || null,
      });
      saved = true;
      setSelected(result.id);
      updateJob(result);
      element.reset();
      const compared = await post<Job>(
        `/job-descriptions/${result.id}/analyze`,
        { method: "catalogue" },
      );
      updateJob(compared);
      setMessage("Job saved and catalogue comparison ready.");
    } catch (caught) {
      setError(
        `${saved ? "Your job was saved, but comparison failed. Retry using Compare catalogue skills below. " : ""}${errorMessage(caught)}`,
      );
    } finally {
      setBusy("");
    }
  }
  async function analyze(
    id: string,
    method: "catalogue" | "ai",
    comparisonResume: string,
  ) {
    start(method);
    try {
      const result = await post<Job>(`/job-descriptions/${id}/analyze`, {
        method,
        resume_id: comparisonResume || null,
      });
      updateJob(result);
      setComparisonResumes((previous) => ({
        ...previous,
        [id]: result.resume_id ?? "",
      }));
      setMessage(
        method === "ai"
          ? "AI comparison ready."
          : "Catalogue comparison ready.",
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy("");
    }
  }
  async function target(id: string) {
    start("target");
    try {
      await post(`/job-descriptions/${id}/target`);
      setMessage(
        "Your roadmap now prioritizes this target job. Open the roadmap to see the new version.",
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy("");
    }
  }
  async function remove(id: string) {
    start(id);
    try {
      await api(`/resumes/${id}`, { method: "DELETE" });
      resumes.setData((previous) =>
        previous?.filter((resume) => resume.id !== id),
      );
      jobs.setData((previous) =>
        previous?.map((item) =>
          item.resume_id === id
            ? { ...item, resume_id: null, analysis: null }
            : item,
        ),
      );
      setComparisonResumes((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([, value]) => value !== id),
        ),
      );
      if (resumeId === id) setResumeId(null);
      setMessage("Resume and its derived analysis deleted.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy("");
    }
  }
  if (
    (resumes.loading && !resumes.data) ||
    (jobs.loading && !jobs.data) ||
    (skills.loading && !skills.data)
  )
    return <Loading />;
  if (resumes.error || jobs.error || skills.error)
    return (
      <ErrorNotice
        message={resumes.error || jobs.error || skills.error}
        retry={() => {
          resumes.reload();
          jobs.reload();
          skills.reload();
        }}
      />
    );
  return (
    <>
      <PageHeader
        eyebrow="CONNECT YOUR STORY TO THE ROLE"
        title="See the fit. Find the next step."
      >
        Upload your resume, paste a job description, and compare it with the
        Java Developer catalogue.
      </PageHeader>
      {error ? <ErrorNotice message={error} /> : null}
      {message ? (
        <p className="success" role="status">
          {message}
        </p>
      ) : null}
      <Notice>
        Catalogue comparison works on this server without AI. It identifies
        explicit document mentions across 12 Java Developer topics; it does not
        measure proficiency.
      </Notice>
      {capabilities.error ? (
        <ErrorNotice message={capabilities.error} retry={capabilities.reload} />
      ) : null}
      {capabilities.data?.ai_enabled ? (
        <Notice>
          Optional AI analysis sends relevant text to the configured provider
          only when you choose Analyze with AI. Contact details are removed
          automatically; omit other personal information that is not needed.
        </Notice>
      ) : capabilities.data ? (
        <Notice>
          {capabilities.data.ai_status === "missing_model"
            ? "AI enhancement needs a model configured by the server administrator. "
            : "AI enhancement has not been enabled on this server. "}
          Standard comparison remains available.
          <Button variant="ghost" onClick={capabilities.reload}>
            Check AI availability
          </Button>
        </Notice>
      ) : null}
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
                PDF or DOCX · up to {capabilities.data?.max_upload_mb ?? 5} MB ·
                text-based PDF, up to 10 pages
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
                    {resume.characters.toLocaleString()} characters extracted
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
              <select
                name="resume_id"
                value={resumeId ?? resumes.data?.[0]?.id ?? ""}
                onChange={(event) => setResumeId(event.target.value)}
              >
                <option value="">No resume · job requirements only</option>
                {resumes.data?.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.filename}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" busy={busy === "job"} disabled={!!busy}>
              Save & compare <ArrowRight size={16} />
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
                disabled={!!busy}
                onChange={(event) => setSelected(event.target.value)}
              >
                {jobs.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        {job ? (
          <JobComparison
            job={job}
            resumes={resumes.data ?? []}
            skills={skills.data ?? []}
            resumeId={comparisonResumes[job.id] ?? job.resume_id ?? ""}
            aiEnabled={!!capabilities.data?.ai_enabled}
            busy={busy}
            onResumeChange={(id) =>
              setComparisonResumes((previous) => ({
                ...previous,
                [job.id]: id,
              }))
            }
            onAnalyze={(method) => {
              void analyze(
                job.id,
                method,
                comparisonResumes[job.id] ?? job.resume_id ?? "",
              );
            }}
            onTarget={() => {
              void target(job.id);
            }}
          />
        ) : (
          <Empty title="A role gives your preparation context">
            Save a job description above. Your comparison will appear here
            automatically.
          </Empty>
        )}
      </Panel>
    </>
  );
}
