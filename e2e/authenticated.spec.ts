import { expect, test } from "@playwright/test";
import { seedExam, signInAsTestUser } from "./test-auth";

test.skip(
	Boolean(process.env.TEST_BASE_URL) && process.env.TEST_SESSION_API_ENABLED !== "true",
	"Authenticated test-session API is disabled for this target.",
);

test("authenticated test user can view own seeded exam", async ({ page }) => {
	await signInAsTestUser(page, `owner-${Date.now()}@exampull.test`);
	const examId = await seedExam(page, "Authenticated ownership exam");

	await page.goto(`/exams/${examId}`);
	await expect(page.getByRole("heading", { name: "Authenticated ownership exam" })).toBeVisible();
	await expect(page.getByRole("link", { name: "Exam PDF" })).toBeVisible();
});

test("scholar user can open answer key action for a completed paid exam", async ({ page }) => {
	await signInAsTestUser(page, `scholar-answer-${Date.now()}@exampull.test`, {
		tier: "scholar",
		credits: 100,
	});
	const examId = await seedExam(page, "Scholar answer key exam");

	await page.goto(`/exams/${examId}`);
	await expect(
		page.getByRole("heading", { level: 1, name: "Scholar answer key exam" }),
	).toBeVisible();
	await expect(page.getByRole("link", { name: "Answer key" })).toBeVisible();
});

test("free user can queue a 12-question Standard exam from manual topics", async ({ page }) => {
	await signInAsTestUser(page, `free-manual-${Date.now()}@exampull.test`, {
		tier: "free",
		credits: 24,
	});

	await page.goto("/exams/new");
	await page.getByLabel("Exam title").fill("Free manual topics exam");
	await page.getByLabel("Topics").fill("Implicit differentiation\nRelated rates\nOptimization");
	await page.getByRole("button", { name: "Generate", exact: true }).click();

	await expect(
		page.getByRole("heading", { level: 1, name: "Free manual topics exam" }),
	).toBeVisible();
	await expect(page.getByText("Manual topics - 12 questions - queued")).toBeVisible();
});

test("credit reservation is atomic across parallel exam requests", async ({ page }) => {
	await signInAsTestUser(page, `credit-race-${Date.now()}@exampull.test`, {
		tier: "free",
		credits: 24,
	});

	const requestBody = {
		title: "Parallel credit race",
		topics: ["Limits", "Continuity"],
		questionCount: 12,
		mode: "standard",
	};
	const [firstResponse, secondResponse] = await Promise.all([
		page.context().request.post("/api/exams", { data: requestBody }),
		page.context().request.post("/api/exams", { data: requestBody }),
	]);
	const statuses = [firstResponse.status(), secondResponse.status()].sort();

	expect(statuses).toEqual([201, 402]);
});

test("user-scoped exam APIs deny another user's exam id", async ({ browser }) => {
	const ownerContext = await browser.newContext();
	const ownerPage = await ownerContext.newPage();
	await signInAsTestUser(ownerPage, `owner-${Date.now()}@exampull.test`);
	const examId = await seedExam(ownerPage, "Private owner exam");

	const attackerContext = await browser.newContext();
	const attackerPage = await attackerContext.newPage();
	await signInAsTestUser(attackerPage, `attacker-${Date.now()}@exampull.test`);

	const patchResponse = await attackerPage.context().request.patch(`/api/exams/${examId}`, {
		data: { archived: true },
	});
	expect(patchResponse.status()).toBe(404);

	const downloadResponse = await attackerPage
		.context()
		.request.get(`/api/exams/${examId}/download?type=exam`);
	expect(downloadResponse.status()).toBe(404);

	await ownerContext.close();
	await attackerContext.close();
});

test("user-scoped class APIs deny another user's class id", async ({ browser }) => {
	const ownerContext = await browser.newContext();
	const ownerPage = await ownerContext.newPage();
	await signInAsTestUser(ownerPage, `class-owner-${Date.now()}@exampull.test`);
	const createResponse = await ownerPage.context().request.post("/api/classes", {
		data: {
			name: "Private Calculus",
			institution: "ExamPull",
			educationLevel: 75,
			description: "Synthetic class fixture.",
		},
	});
	expect(createResponse.status()).toBe(201);
	const createPayload = (await createResponse.json()) as { classId: string };

	const attackerContext = await browser.newContext();
	const attackerPage = await attackerContext.newPage();
	await signInAsTestUser(attackerPage, `class-attacker-${Date.now()}@exampull.test`);

	const getResponse = await attackerPage
		.context()
		.request.get(`/api/classes/${createPayload.classId}`);
	expect(getResponse.status()).toBe(404);

	const patchResponse = await attackerPage
		.context()
		.request.patch(`/api/classes/${createPayload.classId}`, {
			data: { name: "Stolen class" },
		});
	expect(patchResponse.status()).toBe(404);

	await ownerContext.close();
	await attackerContext.close();
});
