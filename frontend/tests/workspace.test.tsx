import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "../src/pages/Dashboard";
import ResourcesPage from "../src/pages/ResourcesPage";

afterEach(() => vi.unstubAllGlobals());
const resource = {
  id: "java-types",
  skill_id: "java-types",
  title: "Java language basics",
  publisher: "Dev.java",
  url: "https://dev.java/learn/language-basics/",
  resource_type: "Documentation",
  difficulty: "Foundation",
  reviewed_on: "2026-10-22",
  bookmarked: false,
};

describe("student workspace", () => {
  it("shows an honest empty dashboard without fabricated scores", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              profile: {
                full_name: "Asha Student",
                target_role: "Java Developer",
                daily_minutes: 60,
                target_date: "2026-11-22",
              },
              stats: {
                coverage: 0,
                completed_tasks: 0,
                total_tasks: 0,
                assessments: 0,
                interviews: 0,
                days_remaining: 30,
              },
              plan: null,
              skills: [
                {
                  id: "java-types",
                  name: "Java fundamentals",
                  score: null,
                  evidence_level: "Not assessed",
                  unique_questions: 0,
                },
              ],
              recent_results: [],
              next_action: {
                title: "Find your starting point",
                description: "Take a diagnostic",
                path: "/assessments",
              },
            }),
            { status: 200 },
          ),
        ),
    );
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(
      await screen.findByText("You’ve got this, Asha."),
    ).toBeInTheDocument();
    expect(screen.getByText("Not assessed")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Take my diagnostic/ }),
    ).toHaveAttribute("href", "/assessments");
  });
  it("reports a failed request and offers retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not reach the server",
    );
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
  it("persists a bookmark through the API and filters saved resources", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              url.endsWith("/skills")
                ? [
                    {
                      id: "java-types",
                      name: "Java fundamentals",
                      category: "Java / OOP",
                    },
                  ]
                : url.endsWith("/bookmark")
                  ? { bookmarked: true }
                  : [resource],
            ),
            { status: 200 },
          ),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    render(<ResourcesPage />);
    await screen.findByText("Java language basics");
    fireEvent.click(
      screen.getByRole("button", { name: "Bookmark Java language basics" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Remove bookmark for Java language basics",
        }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Saved resources" }));
    expect(screen.getByText("Java language basics")).toBeInTheDocument();
    expect(
      fetcher.mock.calls.some(
        ([url, options]) =>
          String(url).endsWith("/bookmark") && options.method === "POST",
      ),
    ).toBe(true);
  });
});
