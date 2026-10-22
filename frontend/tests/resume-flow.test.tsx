import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ResumePage from "../src/pages/ResumePage";
import type { Job, Resume } from "../src/types";

afterEach(() => vi.unstubAllGlobals());

const resume: Resume = {
  id: "resume-one",
  filename: "student.pdf",
  created_at: "2026-10-22T12:00:00Z",
  characters: 140,
};
const draft: Job = {
  id: "job-one",
  title: "Junior Java Developer",
  raw_text: "Java and SQL joins are required for building backend services.",
  resume_id: null,
  created_at: "2026-10-22T12:00:00Z",
  analysis: null,
};
const analysis = {
  method: "catalogue" as const,
  required_skills: [{ skill_id: "java-types", evidence: "Java" }],
  resume_skills: [{ skill_id: "java-types", evidence: "Java" }],
};

function server({ saved = false, ai = false, capabilityError = false } = {}) {
  let jobs: Job[] = saved ? [{ ...draft, resume_id: resume.id, analysis }] : [];
  let resumes: Resume[] = saved ? [resume] : [];
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    const method = options?.method ?? "GET";
    const reply = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status });
    if (url.endsWith("/capabilities"))
      return capabilityError
        ? reply({ error: { message: "AI status could not be loaded" } }, 503)
        : reply({
            ai_enabled: ai,
            ai_status: ai ? "ready" : "missing_key",
            roles: ["Java Developer"],
            max_upload_mb: 5,
            resume_retention_days: 30,
          });
    if (url.endsWith("/skills"))
      return reply([
        { id: "java-types", name: "Java fundamentals", score: null },
      ]);
    if (url.endsWith("/resumes") && method === "POST") {
      resumes = [resume];
      return reply(resume, 201);
    }
    if (url.endsWith("/resumes")) return reply(resumes);
    if (url.endsWith("/job-descriptions") && method === "POST") {
      const payload = JSON.parse(String(options?.body));
      const job = { ...draft, ...payload };
      jobs = [job];
      return reply(job, 201);
    }
    if (url.endsWith("/analyze")) {
      const payload = JSON.parse(String(options?.body));
      if (payload.method === "ai")
        return reply(
          {
            error: {
              message: "The AI provider rejected the server credentials.",
            },
          },
          503,
        );
      const compared = {
        ...jobs[0],
        resume_id:
          payload.resume_id === undefined
            ? jobs[0].resume_id
            : payload.resume_id,
        analysis,
      };
      jobs = [compared];
      return reply(compared);
    }
    if (url.endsWith("/job-descriptions")) return reply(jobs);
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetcher);
  render(
    <MemoryRouter>
      <ResumePage />
    </MemoryRouter>,
  );
  return fetcher;
}

it("uploads a resume, selects it and compares a saved job without AI", async () => {
  const fetcher = server();
  const input = await screen.findByLabelText("Choose resume file");
  fireEvent.change(input, {
    target: {
      files: [
        new File(["synthetic resume"], "student.pdf", {
          type: "application/pdf",
        }),
      ],
    },
  });
  // jsdom does not update native file-input validity from a synthetic files list.
  fireEvent.submit(input.closest("form")!);
  await waitFor(() =>
    expect(screen.getByLabelText("Compare with resume")).toHaveValue(resume.id),
  );
  fireEvent.change(screen.getByLabelText("Job title"), {
    target: { value: draft.title },
  });
  fireEvent.change(screen.getByLabelText("Job description"), {
    target: { value: draft.raw_text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save & compare" }));
  expect(
    await screen.findByText("Job saved and catalogue comparison ready."),
  ).toBeInTheDocument();
  expect(screen.getByText("Resume mention found")).toBeInTheDocument();
  expect(screen.getByText("Test score: Not assessed")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Use for my roadmap" }),
  ).toBeEnabled();
  expect(
    screen.queryByText(/Run analysis when AI is available/),
  ).not.toBeInTheDocument();
  const saved = fetcher.mock.calls.find(
    ([url, options]) =>
      url.endsWith("/job-descriptions") && options?.method === "POST",
  );
  expect(JSON.parse(String(saved?.[1]?.body)).resume_id).toBe(resume.id);
  const compared = fetcher.mock.calls.find(([url]) => url.endsWith("/analyze"));
  expect(JSON.parse(String(compared?.[1]?.body)).method).toBe("catalogue");
});

it("preserves a working catalogue comparison when optional AI fails", async () => {
  server({ saved: true, ai: true });
  fireEvent.click(
    await screen.findByRole("button", { name: "Analyze with AI" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("credentials");
  expect(screen.getByText("Resume mention found")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Compare catalogue skills" }),
  ).toBeEnabled();
});

it("keeps catalogue comparison available when the AI status request fails", async () => {
  server({ saved: true, capabilityError: true });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "AI status could not be loaded",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Compare catalogue skills" }),
  );
  expect(
    await screen.findByText("Catalogue comparison ready."),
  ).toBeInTheDocument();
});
