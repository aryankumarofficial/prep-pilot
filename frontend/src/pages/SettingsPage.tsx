import { Check, Clock3, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { api, errorMessage } from "../api";
import {
  Button,
  ErrorNotice,
  Notice,
  PageHeader,
  Panel,
} from "../components/ui";

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const [search] = useSearchParams();
  const [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: form.get("full_name"),
          target_role: "Java Developer",
          target_date: form.get("target_date"),
          daily_minutes: Number(form.get("daily_minutes")),
          timezone: form.get("timezone"),
        }),
      });
      await refresh();
      setSaved(true);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="MAKE THIS YOURS"
        title={
          search.has("welcome")
            ? "First, let’s make a little space."
            : "Your study preferences."
        }
      >
        A realistic plan starts with the time you actually have.
      </PageHeader>
      <div className="settings-layout">
        <Panel>
          <form onSubmit={save} className="form-stack">
            <label>
              Full name
              <input
                name="full_name"
                defaultValue={user?.full_name}
                minLength={2}
                maxLength={80}
                required
                autoComplete="name"
              />
            </label>
            <label>
              Target role
              <select name="target_role" defaultValue="Java Developer">
                <option>Java Developer</option>
              </select>
              <small>
                We’re starting with one focused role and a maintained topic
                catalogue.
              </small>
            </label>
            <div className="form-row">
              <label>
                Target date
                <input
                  name="target_date"
                  type="date"
                  defaultValue={user?.target_date}
                  required
                />
              </label>
              <label>
                Minutes per day
                <input
                  name="daily_minutes"
                  type="number"
                  min={15}
                  max={480}
                  step={1}
                  defaultValue={user?.daily_minutes}
                  required
                />
              </label>
            </div>
            <label>
              Timezone
              <input
                name="timezone"
                defaultValue={user?.timezone}
                placeholder="Asia/Kolkata"
                required
              />
              <small>
                Use an IANA timezone. Your plan’s dates follow this timezone.
              </small>
            </label>
            {error ? <ErrorNotice message={error} /> : null}
            {saved ? (
              <p className="success" role="status">
                <Check size={16} />
                Preferences saved. Your existing plan has been refreshed.
              </p>
            ) : null}
            <Button type="submit" busy={busy}>
              <Save size={16} />
              Save preferences
            </Button>
          </form>
        </Panel>
        <div>
          <div className="icon-tile">
            <Clock3 size={23} />
          </div>
          <h2>Consistency beats a crowded calendar.</h2>
          <p className="muted">
            Your daily budget includes learning, revision and milestone
            assessments. We leave work unscheduled when it will not fit.
          </p>
          <Notice>
            Completed learning tasks stay completed when your plan changes.
            Skill scores change through assessments.
          </Notice>
          <p className="small muted">
            Account email: {user?.email}. Email verification and password
            recovery are planned before a public pilot.
          </p>
        </div>
      </div>
    </>
  );
}
