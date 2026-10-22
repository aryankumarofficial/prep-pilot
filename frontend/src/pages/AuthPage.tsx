import { ArrowRight, Check, Compass, Plane, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { errorMessage, post } from "../api";
import type { User } from "../types";
import { Button, ErrorNotice } from "../components/ui";

export default function AuthPage() {
  const { user, accept } = useAuth();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const payload = {
      email: values.get("email"),
      password: values.get("password"),
      ...(register ? { full_name: values.get("full_name") } : {}),
    };
    try {
      const result = await post<{ user: User; csrf_token: string }>(
        `/auth/${register ? "register" : "login"}`,
        payload,
      );
      accept(result);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  if (user)
    return <Navigate to={register ? "/settings?welcome=1" : "/"} replace />;
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <a className="brand" href="/">
          <span className="brand-symbol">
            <Plane size={25} />
          </span>
          <span>
            PrepPilot<span className="brand-ai">AI</span>
          </span>
        </a>
        <div className="auth-story-content">
          <span className="pill">
            <Sparkles size={14} />A clearer way to prepare
          </span>
          <h1>
            Big ambitions.
            <br />
            <span>A clear next step.</span>
          </h1>
          <p>
            Turn placement preparation into a plan you can actually follow.
            Understand where you are, focus your practice, and see what changes.
          </p>
          <div className="journey-preview">
            {[
              [
                "01",
                "Know your starting point",
                "A diagnostic grounded in reviewed questions.",
              ],
              ["02", "Make the time count", "A study plan that fits your day."],
              [
                "03",
                "Keep moving forward",
                "Fresh evidence shapes your next milestone.",
              ],
            ].map(([number, title, text]) => (
              <div key={number}>
                <span>{number}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
                <Check size={16} />
              </div>
            ))}
          </div>
          <p className="auth-footnote">
            <Compass size={17} />
            Your preparation, with a little more direction.
          </p>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-form-box">
          <p className="eyebrow">LET’S GET YOU READY</p>
          <h2>
            {register ? "Your next chapter starts here." : "Welcome back."}
          </h2>
          <p className="muted">
            {register
              ? "Create your personal preparation workspace."
              : "Pick up where you left off."}
          </p>
          {error ? <ErrorNotice message={error} /> : null}
          <form onSubmit={submit} className="form-stack">
            {register ? (
              <label>
                Full name
                <input
                  name="full_name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={80}
                  required
                  placeholder="Your name"
                />
              </label>
            ) : null}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                minLength={register ? 12 : 1}
                maxLength={128}
                required
                placeholder={
                  register ? "At least 12 characters" : "Your password"
                }
              />
            </label>
            <Button type="submit" busy={busy}>
              {register ? "Create my workspace" : "Sign in"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <p className="auth-switch">
            {register ? "Already have a workspace?" : "New to PrepPilot?"}{" "}
            <button
              onClick={() => {
                setRegister((v) => !v);
                setError("");
              }}
            >
              {register ? "Sign in" : "Create an account"}
            </button>
          </p>
          <p className="small muted">
            Your resume stays private to your account. You can start with a
            diagnostic and add a resume later.
          </p>
        </div>
        <p className="auth-bottom">
          A thoughtful plan. Consistent practice. Your own pace.
        </p>
      </div>
    </div>
  );
}
