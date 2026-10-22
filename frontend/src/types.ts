export type User = {
  id: string;
  email: string;
  full_name: string;
  target_role: string;
  target_date: string;
  daily_minutes: number;
  timezone: string;
};
export type Capabilities = {
  ai_enabled: boolean;
  ai_status: "ready" | "missing_key" | "missing_model";
  max_upload_mb: number;
  roles: string[];
  resume_retention_days: number;
  starter_bank: boolean;
};
export type Skill = {
  id: string;
  name: string;
  category: string;
  score: number | null;
  unique_questions: number;
  attempts: number;
  evidence_level: string;
  reliable: boolean;
};
export type Task = {
  id: string;
  title: string;
  skill_id: string | null;
  task_type: string;
  planned_date: string;
  planned_minutes: number;
  reason: string;
  completed: boolean;
  assessment_id: string | null;
  resource: { title: string; url: string } | null;
};
export type Plan = {
  job_title: string | null;
  id: string;
  version: number;
  current_version: number;
  change_reason: string;
  target_date: string;
  daily_minutes: number;
  tasks: Task[];
  evidence: Skill[];
  created_at: string;
  unscheduled: { key: string; title: string; minutes: number }[];
  versions: { version: number; change_reason: string; created_at: string }[];
};
export type DashboardData = {
  profile: User;
  skills: Skill[];
  plan: Plan | null;
  today: string;
  next_action: { title: string; description: string; path: string };
  stats: {
    assessments: number;
    interviews: number;
    coverage: number;
    completed_tasks: number;
    total_tasks: number;
    days_remaining: number;
  };
  recent_results: {
    id: string;
    score: number;
    assessment_id: string;
    date: string;
  }[];
};
export type Assessment = {
  id: string;
  title: string;
  kind: string;
  category: string | null;
  duration_seconds: number;
  question_count: number;
};
export type Question = {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  skill_id: string;
  selected_option: string | null;
  correct_option?: string;
  explanation?: string;
  source_url?: string;
  is_correct?: boolean;
};
export type Attempt = {
  id: string;
  assessment_id: string;
  title: string;
  status: string;
  started_at: string;
  expires_at: string;
  server_now: string;
  plan_update_version: number | null;
  score: number | null;
  correct_count: number | null;
  total_count: number;
  questions: Question[];
};
export type AttemptHistory = Pick<
  Attempt,
  | "id"
  | "title"
  | "assessment_id"
  | "status"
  | "score"
  | "started_at"
  | "total_count"
>;
export type Resource = {
  id: string;
  skill_id: string;
  title: string;
  url: string;
  resource_type: string;
  difficulty: string;
  publisher: string;
  reviewed_on: string;
  bookmarked: boolean;
};
export type Resume = {
  id: string;
  filename: string;
  created_at: string;
  characters: number;
};
export type Match = { skill_id: string; evidence: string };
export type Job = {
  id: string;
  title: string;
  resume_id: string | null;
  raw_text: string;
  created_at: string;
  analysis: {
    required_skills: Match[];
    resume_skills: Match[];
    method?: "catalogue" | "ai";
    analyzed_at?: string;
  } | null;
};
export type Feedback = {
  correctness: number;
  clarity: number;
  completeness: number;
  examples: number;
  strengths: string[];
  improvements: string[];
  follow_up: string | null;
};
export type Interview = {
  id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  score: number | null;
  evaluated_answers: number;
  maximum_questions: number;
  turns: {
    id: string;
    question: string;
    answer: string | null;
    feedback: Feedback | null;
    feedback_status: string;
  }[];
};
