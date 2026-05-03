import { expect, test } from "@playwright/test";
import { signInAsTestUser } from "./test-auth";

test.skip(
	Boolean(process.env.TEST_BASE_URL) && process.env.TEST_SESSION_API_ENABLED !== "true",
	"Authenticated test-session API is disabled for this target.",
);

test("desktop Safari scholar persona can drag Power Mode slots and queue an exam", async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name !== "desktop-safari", "Desktop Safari persona coverage.");

	await signInAsTestUser(page, `safari-scholar-${Date.now()}@exampull.test`, {
		tier: "scholar",
		credits: 100,
	});

	await page.goto("/exams/new");
	await page.getByLabel("Exam title").fill("Safari Scholar Power Exam");
	await page.getByLabel("Course or class").fill("Safari Organic Chemistry");
	await page.getByRole("button", { name: "Next: Choose topics" }).click();
	await page
		.getByRole("textbox", { name: "Topics to include" })
		.fill("SN1 reactions\nSN2 reactions");
	await page.getByRole("button", { name: "Next: Set length" }).click();
	await page.getByRole("button", { name: "Power" }).click();
	await page.getByLabel("Question 1 topic").fill("SN1 reactions");
	await page.getByRole("button", { name: "Add slot" }).click();
	await page.getByLabel("Question 2 topic").fill("SN2 reactions");
	await page
		.getByRole("button", { name: "Drag question 2" })
		.dragTo(page.getByTestId("power-slot-1"));
	await expect(page.getByLabel("Question 1 topic")).toHaveValue("SN2 reactions");
	await expect(page.getByLabel("Question 2 topic")).toHaveValue("SN1 reactions");

	await page.getByRole("button", { name: "Generate", exact: true }).click();
	await expect(
		page.getByRole("heading", { level: 1, name: "Safari Scholar Power Exam" }),
	).toBeVisible();
	await expect(page.getByText("Safari Organic Chemistry - 2 questions - queued")).toBeVisible();
});

test("mobile Android free persona can queue a standard exam", async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== "mobile-android", "Mobile Android persona coverage.");

	await signInAsTestUser(page, `android-free-${Date.now()}@exampull.test`, {
		tier: "free",
		credits: 30,
	});

	await page.goto("/exams/new");
	await page.getByLabel("Exam title").fill("Android Free Practice Exam");
	await page.getByLabel("Course or class").fill("Android Algebra");
	await page.getByRole("button", { name: "Next: Choose topics" }).click();
	await page
		.getByRole("textbox", { name: "Topics to include" })
		.fill("Linear equations\nInequalities");
	await page.getByRole("button", { name: "Next: Set length" }).click();
	await page.getByLabel("Questions").fill("8");
	await page.getByRole("button", { name: "Generate", exact: true }).click();
	await expect(
		page.getByRole("heading", { level: 1, name: "Android Free Practice Exam" }),
	).toBeVisible();
	await expect(page.getByText("Android Algebra - 8 questions - queued")).toBeVisible();
});

test("mobile Safari guru persona can upload source material and queue a grounded exam", async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name !== "mobile-safari", "Mobile Safari Guru coverage.");

	await signInAsTestUser(page, `mobile-guru-source-${Date.now()}@exampull.test`, {
		tier: "guru",
		credits: 100,
	});

	await page.goto("/exams/new");
	await page.getByLabel("Exam title").fill("Mobile Guru Source Exam");
	await page.getByLabel("Course or class").fill("Mobile Neuroscience");
	await page.getByLabel("What should ExamPull focus on?").fill("axon membrane potentials");
	await page.getByLabel("Upload files").setInputFiles({
		name: "axon-notes.txt",
		mimeType: "text/plain",
		buffer: Buffer.from("Resting potential\nAction potential\nRefractory period"),
	});
	await expect(page.getByText("axon-notes.txt")).toBeVisible({ timeout: 20000 });
	await expect(page.getByText(/KB - Ready/)).toBeVisible({ timeout: 20000 });
	await expect(page.getByText(/topics extracted/)).toBeVisible();

	await page.getByRole("button", { name: "Next: Choose topics" }).click();
	await page.getByRole("textbox", { name: "Topics to include" }).fill("Action potentials");
	await page.getByRole("button", { name: "Next: Set length" }).click();
	await page.getByRole("button", { name: "Generate", exact: true }).click();
	await expect(
		page.getByRole("heading", { level: 1, name: "Mobile Guru Source Exam" }),
	).toBeVisible();
	await expect(page.getByText("Mobile Neuroscience - 12 questions - queued")).toBeVisible();
	await expect(page.getByText("axon-notes.txt")).toBeVisible();
});
