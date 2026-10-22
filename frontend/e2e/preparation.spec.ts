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
  await page.getByRole("link", { name: "Resume & role", exact: true }).click();
  await page.getByLabel("Choose resume file").setInputFiles({
    name: "student.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    // Synthetic DOCX containing Java, SQL joins and an object-oriented project.
    buffer: Buffer.from(
      "UEsDBBQAAAAIAGh4Vl1Tgq98uAAAAAIBAAARAAAAd29yZC9kb2N1bWVudC54bWxFjzFuwzAMRa9CZG8UdOgguN5bdAlyAlpSbQWiKFB01dy+kjN0eQRB8v/PqVnPbqeQFX4p5Wrb+2lTLdaY6rZAWM9cQu6zbxZC7a2sprH4IuxCrTGvlMzr5fJmCGM+zVOzC/vHqGVABnS+6e6HSz+7B6cWPvEHAbOH2/UL7hxzPcMHlRRGmOABIcVFUB7gUDHxugdoUTfgZQi8sMTnYldcBYl6kkNPQ+0xJzNcB+VgOfhMZv6/nv8AUEsBAhQDFAAAAAgAaHhWXVOCr3y4AAAAAgEAABEAAAAAAAAAAAAAAIABAAAAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAABAAEAPwAAAOcAAAAAAA==",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Upload & extract text" }).click();
  await expect(page.getByLabel("Compare with resume")).not.toHaveValue("");
  await page
    .getByLabel("Job title", { exact: true })
    .fill("Demo Java Developer");
  await page
    .getByLabel("Job description", { exact: true })
    .fill(
      "We require Java, object-oriented programming, SQL joins and HTTP for building backend services.",
    );
  await page
    .getByRole("button", { name: "Save & compare", exact: true })
    .click();
  await expect(
    page.getByText("Job saved and catalogue comparison ready."),
  ).toBeVisible();
  await expect(
    page.getByText("Resume mention found", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Not mentioned in resume", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Analyze with AI" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("Resume mention found", { exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel("Resume for this comparison").selectOption("");
  await page.getByRole("button", { name: "Update comparison" }).click();
  await expect(
    page.getByText("No resume selected", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Not mentioned in resume", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Resume for this comparison")
    .selectOption({ label: "student.docx" });
  await page.getByRole("button", { name: "Update comparison" }).click();
  await expect(
    page.getByText("Resume mention found", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/resume-comparison-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Use for my roadmap" }).click();
  await expect(
    page.getByText(/Your roadmap now prioritizes this target job/),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Open my roadmap", exact: true })
    .click();
  await expect(
    page.getByText("Target job: Demo Java Developer", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: completedLabel, exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Resume & role", exact: true }).click();
  await page.getByRole("button", { name: "Delete student.docx" }).click();
  await expect(
    page.getByText("Resume and its derived analysis deleted."),
  ).toBeVisible();
  await expect(
    page.getByText("Resume mention found", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Compare catalogue skills", exact: true })
    .click();
  await expect(
    page.getByText("No resume selected", { exact: true }).first(),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Resume & role", exact: true }).click();
  await expect(page.locator("#navigation")).not.toBeInViewport();
  await expect(
    page.getByText("No resume selected", { exact: true }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/resume-comparison-mobile.png",
    fullPage: true,
  });
  expect(consoleErrors).toEqual([]);
});
