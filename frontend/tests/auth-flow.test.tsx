import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../src/auth";
import AuthPage from "../src/pages/AuthPage";

afterEach(() => vi.unstubAllGlobals());

it("takes a newly registered student to study preferences before the dashboard", async () => {
  const user = {
    id: "student",
    email: "asha@example.com",
    full_name: "Asha Demo",
    target_role: "Java Developer",
    target_date: "2026-11-22",
    daily_minutes: 60,
    timezone: "Asia/Kolkata",
  };
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith("/auth/session")
            ? new Response(JSON.stringify({ error: { message: "Sign in" } }), {
                status: 401,
              })
            : new Response(
                JSON.stringify({ user, csrf_token: "synthetic-test-token" }),
                { status: 201 },
              ),
        ),
      ),
  );
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/settings" element={<h1>Set study preferences</h1>} />
          <Route path="/" element={<h1>Dashboard</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Create an account" }),
  );
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "Asha Demo" },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "asha@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "A synthetic test password 123!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create my workspace" }));
  expect(
    await screen.findByRole("heading", { name: "Set study preferences" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Dashboard" }),
  ).not.toBeInTheDocument();
});
