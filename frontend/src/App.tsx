import {
  Component,
  lazy,
  Suspense,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Shell from "./components/Shell";
import { Button, Empty, ErrorNotice, Loading } from "./components/ui";

const AuthPage = lazy(() => import("./pages/AuthPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const RoadmapPage = lazy(() => import("./pages/RoadmapPage"));
const AssessmentsPage = lazy(() => import("./pages/AssessmentsPage"));
const AttemptPage = lazy(() => import("./pages/AttemptPage"));
const ResourcesPage = lazy(() => import("./pages/ResourcesPage"));
const ResumePage = lazy(() => import("./pages/ResumePage"));
const InterviewsPage = lazy(() => import("./pages/InterviewsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* No private component data is sent to logs. */
  }
  render() {
    return this.state.failed ? (
      <div className="loading">
        <h1>This page needs a fresh start.</h1>
        <p>Your saved work is still on the server.</p>
        <Button onClick={() => window.location.reload()}>
          Reload workspace
        </Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Protected() {
  const { user } = useAuth();
  return user ? <Shell /> : <Navigate to="/login" replace />;
}
function ApplicationRoutes() {
  const auth = useAuth();
  if (auth.loading) return <Loading text="Opening your workspace…" />;
  if (auth.error)
    return (
      <div className="loading">
        <ErrorNotice
          message={auth.error}
          retry={() => {
            void auth.refresh();
          }}
        />
      </div>
    );
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route element={<Protected />}>
          <Route index element={<Dashboard />} />
          <Route path="roadmap" element={<RoadmapPage />} />
          <Route path="assessments" element={<AssessmentsPage />} />
          <Route path="assessments/:id" element={<AttemptPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="resume" element={<ResumePage />} />
          <Route path="interviews" element={<InterviewsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route
            path="*"
            element={
              <Empty
                title="This page has taken a different route."
                to="/"
                label="Back to my workspace"
              >
                Your preparation is waiting on the overview.
              </Empty>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ApplicationRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
