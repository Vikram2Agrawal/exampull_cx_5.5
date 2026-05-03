import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { signInAsTestUser } from "./test-auth";

const fixtureRoot = "/Users/vikram/class_uploadables";

test.skip(
	Boolean(process.env.TEST_BASE_URL) && process.env.TEST_SESSION_API_ENABLED !== "true",
	"Real-material authenticated upload tests require the locked local test-session API.",
);

const fixtures = {
	cs270Homework: join(fixtureRoot, "Undergrad - CS 270, USC", "PDFs", "HW 9.pdf"),
	buad312Stats: join(
		fixtureRoot,
		"Undergrad - BUAD 312 - Data Science And Statistics, USC",
		"PDFs",
		"BUAD312_ Hypothesis testing wrap-up.pdf",
	),
	writ150Reading: join(
		fixtureRoot,
		"Undergrad - WRIT 150, USC",
		"PDFs",
		"Covid impact survey.pdf.pdf",
	),
	econ351Image: join(
		fixtureRoot,
		"Undergrad - ECON 351, USC",
		"Images",
		"Discussion 9 - Game Theory Part 1.pdf",
		"Discussion 9 - Game Theory Part 1.pdf-02.jpg",
	),
} as const;

function skipIfMissing(paths: string[]) {
	const missing = paths.filter((path) => !existsSync(path));
	test.skip(missing.length > 0, `Missing upload fixtures: ${missing.join(", ")}`);
}

test("real USC source files can ground a one-time exam upload", async ({ page }) => {
	skipIfMissing([fixtures.cs270Homework, fixtures.econ351Image]);
	await signInAsTestUser(page, `real-upload-exam-${Date.now()}@exampull.test`, {
		tier: "guru",
		credits: 200,
	});

	await page.goto("/exams/new");
	await page.getByLabel("Exam title").fill("Real fixture grounded exam");
	await page.getByLabel("Course or class").fill("CS and economics benchmark");
	await page
		.getByLabel("What should ExamPull focus on?")
		.fill("dynamic programming and game theory practice problems");
	await page
		.getByLabel("Upload files")
		.setInputFiles([fixtures.cs270Homework, fixtures.econ351Image]);

	await expect(page.getByText("HW 9.pdf")).toBeVisible({ timeout: 30_000 });
	await expect(page.getByText("Discussion 9 - Game Theory Part 1.pdf-02.jpg")).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText(/KB - Ready/)).toHaveCount(2, { timeout: 30_000 });
	await expect(page.getByText(/topics extracted/)).toHaveCount(2, { timeout: 30_000 });

	await page
		.getByRole("textbox", { name: "Topics to include" })
		.fill("Dynamic programming recurrence design\nGame theory payoff matrices");
	await page.getByRole("button", { name: "Generate", exact: true }).click();

	await expect(
		page.getByRole("heading", { level: 1, name: "Real fixture grounded exam" }),
	).toBeVisible({ timeout: 20_000 });
	await expect(
		page.getByText("CS and economics benchmark - 12 questions - queued"),
	).toBeVisible();
	await expect(page.getByText("HW 9.pdf")).toBeVisible();
	await expect(page.getByText("Discussion 9 - Game Theory Part 1.pdf-02.jpg")).toBeVisible();
});

test("real USC class fixtures upload as course materials and style references", async ({
	page,
}) => {
	skipIfMissing([fixtures.buad312Stats, fixtures.writ150Reading]);
	await signInAsTestUser(page, `real-upload-class-${Date.now()}@exampull.test`, {
		tier: "guru",
		credits: 200,
	});
	const classResponse = await page.context().request.post("/api/classes", {
		data: {
			name: "USC benchmark course",
			institution: "USC",
			educationLevel: 72,
			description: "Real fixture coverage for statistics and writing materials.",
		},
	});
	expect(classResponse.status()).toBe(201);
	const classPayload = (await classResponse.json()) as { classId: string };

	await page.goto(`/classes/${classPayload.classId}`);
	await page.getByLabel("Focus").fill("hypothesis testing, survey interpretation");
	await page.getByLabel("Material file").setInputFiles(fixtures.buad312Stats);
	await page.getByRole("button", { name: "Upload material" }).click();
	await expect(page.getByText("BUAD312_ Hypothesis testing wrap-up.pdf")).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText(/KB - ready/)).toBeVisible({ timeout: 30_000 });

	await page.getByLabel("Focus").fill("writing prompt tone and reading-comprehension style");
	await page.getByLabel("Instructor style reference").check();
	await page.getByLabel("Material file").setInputFiles(fixtures.writ150Reading);
	await page.getByRole("button", { name: "Upload material" }).click();
	await expect(page.getByText("Covid impact survey.pdf.pdf", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText(/KB - style ready/)).toBeVisible({ timeout: 30_000 });
	await expect(
		page.getByText("Instructor style guide inferred from Covid impact survey.pdf.pdf."),
	).toBeVisible();

	await page.goto("/exams/new");
	await page.getByLabel("Exam title").fill("Stored real fixture exam");
	await page.getByLabel("Stored class").selectOption(classPayload.classId);
	await page.getByLabel(/BUAD312_ Hypothesis testing wrap-up\.pdf/).check();
	await page
		.getByRole("textbox", { name: "Topics to include" })
		.fill("Hypothesis testing\nSurvey interpretation");
	await page.getByRole("button", { name: "Generate", exact: true }).click();

	await expect(
		page.getByRole("heading", { level: 1, name: "Stored real fixture exam" }),
	).toBeVisible({ timeout: 20_000 });
	await expect(page.getByText("USC benchmark course - 12 questions - queued")).toBeVisible();
});
