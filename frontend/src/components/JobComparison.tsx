import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import type { Job, Resume, Skill } from "../types";
import { Button, Empty } from "./ui";

type Props = {
  job: Job;
  resumes: Resume[];
  skills: Skill[];
  resumeId: string;
  aiEnabled: boolean;
  busy: string;
  onResumeChange: (id: string) => void;
  onAnalyze: (method: "catalogue" | "ai") => void;
  onTarget: () => void;
};

export default function JobComparison({
  job,
  resumes,
  skills,
  resumeId,
  aiEnabled,
  busy,
  onResumeChange,
  onAnalyze,
  onTarget,
}: Props) {
  const changed = resumeId !== (job.resume_id ?? "");
  const analysis = changed ? null : job.analysis;
  const skillMap = new Map(skills.map((skill) => [skill.id, skill]));
  const catalogue = analysis?.method === "catalogue";
  return (
    <>
      <h3>{job.title}</h3>
      <p className="small muted">
        Compare explicit job and resume mentions with the Java Developer
        catalogue. This is separate from your assessment results.
      </p>
      <label className="form-stack">
        Resume for this comparison
        <select
          value={resumeId}
          disabled={!!busy}
          onChange={(event) => onResumeChange(event.target.value)}
        >
          <option value="">No resume · job requirements only</option>
          {resumes.map((resume) => (
            <option key={resume.id} value={resume.id}>
              {resume.filename}
            </option>
          ))}
        </select>
      </label>
      <div className="comparison-actions">
        <Button
          variant="secondary"
          busy={busy === "catalogue"}
          disabled={!!busy}
          onClick={() => onAnalyze("catalogue")}
        >
          {changed ? "Update comparison" : "Compare catalogue skills"}
        </Button>
        {aiEnabled ? (
          <Button
            variant="secondary"
            busy={busy === "ai"}
            disabled={!!busy}
            onClick={() => onAnalyze("ai")}
          >
            <Sparkles size={16} /> Analyze with AI
          </Button>
        ) : null}
        {analysis?.required_skills.length ? (
          <Button busy={busy === "target"} disabled={!!busy} onClick={onTarget}>
            Use for my roadmap <ArrowRight size={15} />
          </Button>
        ) : null}
      </div>
      {analysis ? (
        <>
          <p className="small muted" role="status">
            {catalogue
              ? "Catalogue comparison · exact term matching on this server. Review the quoted context; wording and implied skills may be missed."
              : "AI comparison · source quotes verified against the saved documents."}
          </p>
          {analysis.required_skills.length ? (
            <div className="gap-list">
              {analysis.required_skills.map((match) => {
                const resumeMatch = analysis.resume_skills.find(
                  (item) => item.skill_id === match.skill_id,
                );
                const measured = skillMap.get(match.skill_id);
                return (
                  <div key={match.skill_id} className="gap-row">
                    <div>
                      <h3>{measured?.name ?? match.skill_id}</h3>
                      <p className="small muted">
                        Job text: “{match.evidence}”
                      </p>
                      {resumeMatch ? (
                        <p className="small">
                          Resume text: “{resumeMatch.evidence}”
                        </p>
                      ) : null}
                    </div>
                    <div className="gap-status">
                      <span
                        className={`pill ${resumeMatch || !job.resume_id ? "" : "amber"}`}
                      >
                        {!job.resume_id
                          ? "No resume selected"
                          : resumeMatch
                            ? "Resume mention found"
                            : "Not mentioned in resume"}
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
          ) : (
            <Empty title="No catalogue skills matched">
              This starter catalogue covers 12 Java Developer topics. Try a more
              detailed job description mentioning relevant skills such as Java,
              SQL, OOP or HTTP. Other roles and skills may be outside its scope.
            </Empty>
          )}
          <p className="small muted">
            A document mention does not prove proficiency, and an absent mention
            does not prove a weakness. Take an assessment to measure your
            skills.
          </p>
          <Link to="/roadmap" className="text-link">
            Open my roadmap <ArrowRight size={15} />
          </Link>
        </>
      ) : (
        <p className="muted">
          {changed
            ? "Your resume selection changed. Update the comparison to save it and refresh the results."
            : "Your job is saved. Compare catalogue skills now; no AI setup is required."}
        </p>
      )}
    </>
  );
}
