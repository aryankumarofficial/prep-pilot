import { expect, test } from "@playwright/test";

test("a student can assess, plan, revisit saved progress and practice an interview", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto("/login");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Asha Demo");
  await page.getByLabel("Email address").fill(`asha-${Date.now()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("A synthetic demo password 123!");
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "First, let’s make a little space." }),
  ).toBeVisible();
  await page.getByLabel("Minutes per day").fill("45");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("Preferences saved");
  await page.getByRole("link", { name: "Assessments", exact: true }).click();
  await page
    .locator(".assessment-card")
    .filter({ hasText: "Your placement diagnostic" })
    .getByRole("button")
    .click();
  await expect(
    page.getByRole("heading", { name: "Your placement diagnostic" }),
  ).toBeVisible();
  const firstQuestion = await page.locator(".question-title").innerText();
  await page.locator(".answer-option").nth(0).click();
  await expect(page.getByRole("radio").nth(0)).toBeChecked();
  await page.reload();
  await expect(page.locator(".question-title")).toHaveText(firstQuestion);
  await expect(page.getByRole("radio").nth(0)).toBeChecked();
  await page
    .getByRole("button", { name: "Submit assessment", exact: true })
    .click();
  await page.getByRole("button", { name: "Submit saved answers" }).click();
  await expect(
    page.getByRole("heading", { name: "Your assessment, explained." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "See my updated plan" }).click();
  await expect(page.getByText("VERSION 1", { exact: true })).toBeVisible();
  const completedLabel = (await page
    .getByRole("button", { name: /Mark complete:/ })
    .first()
    .getAttribute("aria-label"))!.replace("Mark complete:", "Mark incomplete:");
  await page
    .getByRole("button", { name: /Mark complete:/ })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: completedLabel, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Why this task?" }).first().click();
  await expect(page.locator(".task-reason").first()).toContainText(
    "role relevance",
  );
  await page.getByRole("link", { name: "Assessments", exact: true }).click();
  await page
    .locator(".assessment-card")
    .filter({ hasText: "DBMS / SQL milestone" })
    .getByRole("button")
    .click();
  await page.locator(".answer-option").nth(0).click();
  await expect(page.getByRole("radio").nth(0)).toBeChecked();
  await page
    .getByRole("button", { name: "Submit assessment", exact: true })
    .click();
  await page.getByRole("button", { name: "Submit saved answers" }).click();
  await expect(
    page.getByRole("heading", { name: "Your assessment, explained." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "See my updated plan" }).click();
  await expect(page.getByText("VERSION 2", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: completedLabel, exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Resource library" }).click();
  await page
    .getByRole("button", { name: "Bookmark Java language basics", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Remove bookmark for Java language basics",
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Remove bookmark for Java language basics",
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Interview studio" }).click();
  await page.getByRole("button", { name: "Start or resume a session" }).click();
  await page
    .getByLabel("Your answer", { exact: true })
    .fill(
      "I would explain the concept with a concrete example, then describe one tradeoff.",
    );
  await page.getByRole("button", { name: "Save answer & continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Question 2 of 5" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(
    page.getByText("Unscored — AI feedback unavailable"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "You’ve got this, Asha." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Toggle navigation" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "My roadmap", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A plan that moves with you." }),
  ).toBeVisible();
  await expect(page.locator("#navigation")).not.toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/roadmap-mobile.png",
    fullPage: true,
  });
  expect(consoleErrors).toEqual([]);
});
