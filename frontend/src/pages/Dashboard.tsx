import {
  ArrowRight,
  CalendarDays,
  CheckCheck,
  ClipboardCheck,
  Clock3,
  Crosshair,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useLoad } from "../hooks";
import type { DashboardData } from "../types";
import {
  Empty,
  ErrorNotice,
  formatDate,
  Loading,
  PageHeader,
  Panel,
  Progress,
} from "../components/ui";

export default function Dashboard() {
  const { data, error, loading, reload } =
    useLoad<DashboardData>("/dashboard/summary");
  if (loading) return <Loading />;
  if (error) return <ErrorNotice message={error} retry={reload} />;
  if (!data) return null;
  const { profile, stats, plan } = data;
  const upcoming =
    plan?.tasks
      .filter((t) => !t.completed)
      .sort((a, b) => a.planned_date.localeCompare(b.planned_date))
      .slice(0, 3) ?? [];
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE PROGRESS, EVERY DAY"
        title={`You’ve got this, ${profile.full_name.split(" ")[0]}.`}
      >
        Here’s where you are, and where to go next.
      </PageHeader>
      <div className="dashboard-intro">
        <section className="next-step">
          <div>
            <span className="pill">
              <Sparkles size={13} />
              YOUR NEXT MOVE
            </span>
            <h2>{data.next_action.title}</h2>
            <p>{data.next_action.description}</p>
            <Link to={data.next_action.path} className="button primary">
              {stats.assessments ? "Open my roadmap" : "Take my diagnostic"}
              <ArrowRight size={17} />
            </Link>
          </div>
          <div className="orbit-art" aria-hidden="true">
            <span className="orbit one" />
            <span className="orbit two" />
            <span className="orbit three" />
            <div className="orbit-core">
              <Crosshair size={42} strokeWidth={1.2} />
            </div>
            <span className="orbit-spark">✦</span>
            <span className="orbit-point" />
          </div>
        </section>
        <Panel className="target-panel">
          <span className="icon-tile purple">
            <CalendarDays size={21} />
          </span>
          <p className="eyebrow">YOUR HORIZON</p>
          <div className="days-count">
            {stats.days_remaining}
            <span>days to prepare</span>
          </div>
          <p className="target-role">{profile.target_role}</p>
          <div className="target-details">
            <span>
              <Clock3 size={15} />
              {profile.daily_minutes} min / day
            </span>
            <span>
              {formatDate(profile.target_date, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <Link to="/settings" className="text-link">
            Adjust my preferences
            <ArrowRight size={14} />
          </Link>
        </Panel>
      </div>
      <div className="stats-grid">
        {[
          {
            icon: Crosshair,
            value: `${stats.coverage}%`,
            title: "Skills assessed",
            detail: "Catalogue coverage",
          },
          {
            icon: CheckCheck,
            value: `${stats.completed_tasks}/${stats.total_tasks}`,
            title: "Tasks completed",
            detail: "In your current plan",
          },
          {
            icon: ClipboardCheck,
            value: stats.assessments,
            title: "Assessments taken",
            detail: "Reviewed question bank",
          },
          {
            icon: MessageSquare,
            value: stats.interviews,
            title: "Interview sessions",
            detail: "Practice, at your pace",
          },
        ].map(({ icon: Icon, value, title, detail }) => (
          <Panel key={title} className="stat">
            <Icon size={19} />
            <strong>{value}</strong>
            <span>{title}</span>
            <small>{detail}</small>
          </Panel>
        ))}
      </div>
      <div className="two-columns">
        <Panel>
          <div className="section-heading">
            <div>
              <p className="eyebrow">MAKE A LITTLE ROOM</p>
              <h2>Coming up in your plan</h2>
            </div>
            <Link to="/roadmap" className="text-link">
              View plan
              <ArrowRight size={14} />
            </Link>
          </div>
          {upcoming.length ? (
            <div className="task-preview-list">
              {upcoming.map((task, i) => (
                <Link to="/roadmap" key={task.id} className="task-preview">
                  <span className="step-number">0{i + 1}</span>
                  <div>
                    <strong>{task.title}</strong>
                    <span>
                      {formatDate(task.planned_date)} · {task.planned_minutes}{" "}
                      min ·{" "}
                      {task.task_type === "learn"
                        ? "Learn & practice"
                        : "Milestone"}
                    </span>
                  </div>
                  <ArrowRight size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="A plan built around you"
              to="/assessments"
              label="Find my starting point"
            >
              Your first diagnostic gives us the evidence to choose useful next
              steps.
            </Empty>
          )}
        </Panel>
        <Panel>
          <div className="section-heading">
            <div>
              <p className="eyebrow">ONE SESSION AT A TIME</p>
              <h2>Your recent assessments</h2>
            </div>
            <span className="subtle-badge">Actual results</span>
          </div>
          {data.recent_results.length ? (
            <>
              <div className="result-bars">
                {data.recent_results.map((r) => (
                  <Link
                    to={`/assessments/${r.id}`}
                    key={r.id}
                    className="result-bar"
                    aria-label={`${r.assessment_id}, ${r.score}%, ${formatDate(r.date)}`}
                  >
                    <strong>{r.score}%</strong>
                    <div>
                      <span style={{ height: `${Math.max(2, r.score)}%` }} />
                    </div>
                    <small>{formatDate(r.date)}</small>
                  </Link>
                ))}
              </div>
              <p className="small muted">
                Each score describes that assessment. Different tests cover
                different topics.
              </p>
            </>
          ) : (
            <Empty title="Your progress starts with one test">
              Your results will appear here after you finish an assessment.
            </Empty>
          )}
        </Panel>
      </div>
      <Panel>
        <div className="section-heading">
          <div>
            <p className="eyebrow">EVIDENCE BEFORE ASSUMPTIONS</p>
            <h2>Your skill landscape</h2>
          </div>
          <span className="small muted">
            Recent test evidence · {data.skills.length} topics
          </span>
        </div>
        <div className="skill-grid">
          {data.skills.map((skill) => (
            <div className="skill-row" key={skill.id}>
              <div>
                <span>{skill.name}</span>
                <strong>
                  {skill.score === null ? "—" : `${skill.score}%`}
                </strong>
              </div>
              <Progress value={skill.score} label={skill.name} />
              <small>
                {skill.evidence_level}
                {skill.unique_questions
                  ? ` · ${skill.unique_questions} distinct questions`
                  : ""}
              </small>
            </div>
          ))}
        </div>
        <p className="small muted bottom-note">
          These starter scores help prioritize practice. They do not predict
          hiring outcomes.
        </p>
      </Panel>
    </>
  );
}
