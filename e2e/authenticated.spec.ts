import { expect, test } from "@playwright/test";
import { seedExam, seedVisualAttempt, signInAsTestUser } from "./test-auth";

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

test("anonymous preview can be claimed by a verified test account", async ({ page }) => {
	test.setTimeout(180_000);
	const fingerprint = `preview-claim-${Date.now()}`;
	await page.route("**/api/preview", async (route) => {
		await route.continue({
			headers: {
				...route.request().headers(),
				"x-preview-fingerprint": fingerprint,
			},
		});
	});

	await page.goto("/");
	await page.getByLabel("Preview title").fill("Claimed anonymous preview exam");
	await page.getByLabel("Topics").fill("Limits and continuity\nDerivative rules\nOptimization");
	const previewResponsePromise = page.waitForResponse(
		(response) =>
			response.url().includes("/api/preview") && response.request().method() === "POST",
	);
	await page.getByRole("button", { name: "Generate preview" }).click();
	const previewResponse = await previewResponsePromise;
	expect(previewResponse.status()).toBe(200);
	const previewPayload = (await previewResponse.json()) as {
		previewId?: string;
		previewImageBase64?: string;
		pdfBase64?: string;
	};
	expect(previewPayload.previewId).toBeTruthy();
	expect(previewPayload.previewImageBase64?.length).toBeGreaterThan(100);
	expect(previewPayload.pdfBase64).toBeUndefined();
	await expect(page.getByText("Preview ready.")).toBeVisible();
	const signUpLink = page.getByRole("link", { name: "Sign up free" });
	await expect(signUpLink).toBeVisible();
	const href = await signUpLink.getAttribute("href");
	expect(href).toContain("/sign-up?preview=");
	const previewId = new URL(href ?? "", "http://localhost:3100").searchParams.get("preview");
	expect(previewId).toBe(previewPayload.previewId);

	const { claimedExamId } = await signInAsTestUser(
		page,
		`preview-claim-${Date.now()}@exampull.test`,
		{
			tier: "free",
			credits: 40,
			previewId: previewId ?? undefined,
		},
	);
	expect(claimedExamId).toBeTruthy();

	await page.goto(`/exams/${claimedExamId}`);
	await expect(
		page.getByRole("heading", { level: 1, name: "Claimed anonymous preview exam" }),
	).toBeVisible();
	await expect(page.getByText("No-account preview - 3 questions - Complete")).toBeVisible();
	await expect(page.getByRole("link", { name: "Exam PDF" })).toBeVisible();
	const pdfResponse = await page
		.context()
		.request.get(`/api/exams/${claimedExamId}/download?type=exam`);
	expect(pdfResponse.status()).toBe(200);
	expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");

	const exportResponse = await page.context().request.get("/api/settings/export");
	expect(exportResponse.status()).toBe(200);
	const exportPayload = (await exportResponse.json()) as {
		profile: {
			credits?: number;
			reservedCredits?: number;
			totalCreditsConsumed?: number;
		} | null;
		exams: {
			id: string;
			status?: string;
			creditsReserved?: number;
			creditsConsumed?: number;
			anonymousPreviewId?: string;
			examPdfBase64?: string;
		}[];
	};
	expect(exportPayload.profile?.credits).toBe(40);
	expect(exportPayload.profile?.reservedCredits).toBe(0);
	expect(exportPayload.profile?.totalCreditsConsumed).toBe(0);
	const claimedExam = exportPayload.exams.find((exam) => exam.id === claimedExamId);
	expect(claimedExam?.status).toBe("complete");
	expect(claimedExam?.creditsReserved).toBe(0);
	expect(claimedExam?.creditsConsumed).toBe(0);
	expect(claimedExam?.anonymousPreviewId).toBe(previewId);
	expect(claimedExam?.examPdfBase64?.length).toBeGreaterThan(100);
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

test("guru user can download completed visual feedback PDF", async ({ page }) => {
	await signInAsTestUser(page, `guru-visual-${Date.now()}@exampull.test`, {
		tier: "guru",
		credits: 100,
	});
	const examId = await seedExam(page, "Guru visual feedback exam");
	await seedVisualAttempt(page, examId);

	await page.goto(`/exams/${examId}`);
	const download = page.getByRole("link", { name: "Download visual feedback" });
	await expect(download).toBeVisible();
	const response = await page.context().request.get((await download.getAttribute("href")) ?? "");

	expect(response.status()).toBe(200);
	expect(response.headers()["content-type"]).toContain("application/pdf");
});

test("guru user can upload an attempt and complete visual feedback worker", async ({ page }) => {
	test.setTimeout(180_000);
	const { uid } = await signInAsTestUser(page, `guru-worker-visual-${Date.now()}@exampull.test`, {
		tier: "guru",
		credits: 100,
	});
	const examId = await seedExam(page, "Guru worker visual feedback exam");
	const attemptBody = Buffer.from(
		"Question 1: I set up the derivative and solved the critical point. Question 2: I checked the endpoints and estimate this earns 82%.",
	);

	const startResponse = await page.context().request.post(`/api/exams/${examId}/attempts`, {
		data: {
			filename: "guru-worker-attempt.txt",
			contentType: "text/plain",
			sizeBytes: attemptBody.byteLength,
			visualAnnotations: true,
		},
	});
	expect(startResponse.status()).toBe(201);
	const startPayload = (await startResponse.json()) as {
		attemptId: string;
		uploadUrl: string;
	};

	const uploadResponse = await page.context().request.put(startPayload.uploadUrl, {
		headers: { "Content-Type": "text/plain" },
		data: attemptBody,
	});
	expect(uploadResponse.status()).toBe(200);

	const completeResponse = await page
		.context()
		.request.patch(`/api/exams/${examId}/attempts/${startPayload.attemptId}`, {
			data: { status: "uploaded" },
		});
	expect(completeResponse.status()).toBe(200);

	const gradeResponse = await page.context().request.post("/api/workers/grade-attempt", {
		data: { userId: uid, examId, attemptId: startPayload.attemptId },
	});
	expect(gradeResponse.status()).toBe(200);

	await page.goto(`/exams/${examId}`);
	await expect(
		page.getByRole("heading", { level: 1, name: "Guru worker visual feedback exam" }),
	).toBeVisible();
	await expect(page.getByText("guru-worker-attempt.txt")).toBeVisible();
	await expect(page.getByText("Visual annotations: complete")).toBeVisible();
	const download = page.getByRole("link", { name: "Download visual feedback" });
	await expect(download).toBeVisible();
	const feedbackResponse = await page
		.context()
		.request.get((await download.getAttribute("href")) ?? "");
	expect(feedbackResponse.status()).toBe(200);
	expect(feedbackResponse.headers()["content-type"]).toContain("application/pdf");

	const exportResponse = await page.context().request.get("/api/settings/export");
	expect(exportResponse.status()).toBe(200);
	const exportPayload = (await exportResponse.json()) as {
		profile: {
			credits?: number;
			reservedCredits?: number;
			totalCreditsConsumed?: number;
		} | null;
		attempts: {
			examId: string;
			attempts: {
				id: string;
				status?: string;
				visualAnnotationStatus?: string;
				creditsReserved?: number;
				creditsConsumed?: number;
				visualFeedbackPdfBase64?: string;
				visualFeedbackPdfStoragePath?: string;
			}[];
		}[];
	};
	expect(exportPayload.profile?.credits).toBe(90);
	expect(exportPayload.profile?.reservedCredits).toBe(0);
	expect(exportPayload.profile?.totalCreditsConsumed).toBe(10);
	const attemptGroup = exportPayload.attempts.find((group) => group.examId === examId);
	const completedAttempt = attemptGroup?.attempts.find(
		(attempt) => attempt.id === startPayload.attemptId,
	);
	expect(completedAttempt?.status).toBe("graded");
	expect(completedAttempt?.visualAnnotationStatus).toBe("complete");
	expect(completedAttempt?.creditsReserved).toBe(0);
	expect(completedAttempt?.creditsConsumed).toBe(10);
	expect(completedAttempt?.visualFeedbackPdfStoragePath).toContain("/visual-feedback.pdf");
	expect(completedAttempt?.visualFeedbackPdfBase64?.length).toBeGreaterThan(100);
});

test("free user can queue a 12-question Standard exam from manual topics", async ({ page }) => {
	await signInAsTestUser(page, `free-manual-${Date.now()}@exampull.test`, {
		tier: "free",
		credits: 24,
	});

	await page.goto("/exams/new");
	await page.getByLabel("Exam title").fill("Free manual topics exam");
	await page
		.getByRole("textbox", { name: "Topics" })
		.fill("Implicit differentiation\nRelated rates\nOptimization");
	await page.getByRole("button", { name: "Generate", exact: true }).click();

	await expect(
		page.getByRole("heading", { level: 1, name: "Free manual topics exam" }),
	).toBeVisible();
	await expect(page.getByText("Manual topics - 12 questions - queued")).toBeVisible();
});

test("free user can complete a full 12-question worker generation", async ({ page }) => {
	test.setTimeout(180_000);
	const { uid } = await signInAsTestUser(page, `worker-free-${Date.now()}@exampull.test`, {
		tier: "free",
		credits: 24,
	});
	const createResponse = await page.context().request.post("/api/exams", {
		data: {
			title: "Worker completed free exam",
			className: "Worker Biology",
			topics: ["Cell membranes", "Osmosis", "Diffusion"],
			questionCount: 12,
			mode: "standard",
		},
	});
	expect(createResponse.status()).toBe(201);
	const createPayload = (await createResponse.json()) as { examId: string };

	const workerResponse = await page.context().request.post("/api/workers/generate-exam", {
		data: { userId: uid, examId: createPayload.examId },
	});
	expect(workerResponse.status()).toBe(200);

	await page.goto(`/exams/${createPayload.examId}`);
	await expect(
		page.getByRole("heading", { level: 1, name: "Worker completed free exam" }),
	).toBeVisible();
	await expect(page.getByText("Worker Biology - 12 questions - Complete")).toBeVisible();
	await expect(page.getByRole("link", { name: "Exam PDF" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Answer key locked" })).toBeVisible();
	const pdfResponse = await page
		.context()
		.request.get(`/api/exams/${createPayload.examId}/download?type=exam`);
	expect(pdfResponse.status()).toBe(200);
	expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");

	const exportResponse = await page.context().request.get("/api/settings/export");
	expect(exportResponse.status()).toBe(200);
	const exportPayload = (await exportResponse.json()) as {
		profile: {
			credits?: number;
			reservedCredits?: number;
			totalCreditsConsumed?: number;
		} | null;
		exams: {
			id: string;
			status?: string;
			creditsReserved?: number;
			creditsConsumed?: number;
			examPdfBase64?: string;
			answerKeyPdfBase64?: string;
		}[];
	};
	expect(exportPayload.profile?.credits).toBe(0);
	expect(exportPayload.profile?.reservedCredits).toBe(0);
	expect(exportPayload.profile?.totalCreditsConsumed).toBe(24);
	const completedExam = exportPayload.exams.find((exam) => exam.id === createPayload.examId);
	expect(completedExam?.status).toBe("complete");
	expect(completedExam?.creditsReserved).toBe(0);
	expect(completedExam?.creditsConsumed).toBe(24);
	expect(completedExam?.examPdfBase64?.length).toBeGreaterThan(100);
	expect(completedExam?.answerKeyPdfBase64?.length).toBeGreaterThan(100);
});

test("scholar user can configure and queue a reordered Power Mode exam", async ({ page }) => {
	await signInAsTestUser(page, `power-${Date.now()}@exampull.test`, {
		tier: "scholar",
		credits: 100,
	});

	await page.goto("/exams/new");
	await page.getByLabel("Exam title").fill("Power Mode orchestration exam");
	await page.getByLabel("Class label").fill("Physical Chemistry");
	await page
		.getByRole("textbox", { name: "Topics" })
		.fill("Entropy\nReaction kinetics\nElectrochemistry");
	await page.getByRole("button", { name: "Power" }).click();
	await expect(page.getByRole("heading", { name: "Power Mode slots" })).toBeVisible();
	await page.getByLabel("Question 1 topic").fill("Entropy");
	await page.getByRole("button", { name: "Add slot" }).click();
	await page.getByLabel("Question 2 topic").fill("Reaction kinetics");
	await page.getByLabel("Question 1 style").selectOption("proof");
	await page.getByLabel("Question 2 style").selectOption("calculation");
	await page.getByLabel("Question 2 difficulty").selectOption("hardcore");
	await page.getByLabel("Question 2 points").fill("12");
	await page.getByRole("button", { name: "Move question 2 up" }).click();
	await expect(page.getByLabel("Question 1 topic")).toHaveValue("Reaction kinetics");
	await expect(page.getByLabel("Question 2 topic")).toHaveValue("Entropy");

	await page.getByLabel("Range start").fill("1");
	await page.getByLabel("Range end").fill("2");
	await page.getByLabel("Range style").selectOption("calculation");
	await page.getByLabel("Range difficulty").selectOption("hardcore");
	await page.getByLabel("Range points").fill("14");
	await page.getByRole("button", { name: "Apply range" }).click();
	await expect(page.getByLabel("Question 1 style")).toHaveValue("calculation");
	await expect(page.getByLabel("Question 2 difficulty")).toHaveValue("hardcore");
	await expect(page.getByLabel("Question 1 points")).toHaveValue("14");
	await expect(page.getByText("2 configured of 25 available.")).toBeVisible();

	await page.getByRole("button", { name: "Generate", exact: true }).click();
	await expect(
		page.getByRole("heading", { level: 1, name: "Power Mode orchestration exam" }),
	).toBeVisible();
	await expect(page.getByText("Physical Chemistry - 2 questions - queued")).toBeVisible();

	const examsResponse = await page.context().request.get("/api/exams");
	expect(examsResponse.status()).toBe(200);
	const examsPayload = (await examsResponse.json()) as {
		exams: {
			title: string;
			mode: string;
			questionCount: number;
			questionStyles: string[];
			difficulties: string[];
		}[];
	};
	const createdExam = examsPayload.exams.find(
		(exam) => exam.title === "Power Mode orchestration exam",
	);
	if (!createdExam) {
		throw new Error("Created Power Mode exam was not returned by /api/exams.");
	}
	expect(createdExam.mode).toBe("power");
	expect(createdExam.questionCount).toBe(2);
	expect(createdExam.questionStyles).toContain("calculation");
	expect(createdExam.difficulties).toContain("hardcore");
});

test("authenticated user can upload one-time source material and queue a grounded exam", async ({
	page,
}) => {
	await signInAsTestUser(page, `source-upload-${Date.now()}@exampull.test`, {
		tier: "guru",
		credits: 100,
	});

	await page.goto("/exams/new");
	await page.getByLabel("Exam title").fill("Ad hoc upload grounded exam");
	await page.getByLabel("Class label").fill("Chemistry source upload");
	await page.getByLabel("Focus for next upload").fill("rate laws and Arrhenius equation");
	await page.getByLabel("Upload files").setInputFiles({
		name: "rate-laws-notes.txt",
		mimeType: "text/plain",
		buffer: Buffer.from(
			"Rate laws\nIntegrated rate laws\nArrhenius equation\nActivation energy",
		),
	});
	await expect(page.getByText("rate-laws-notes.txt")).toBeVisible({ timeout: 20000 });
	await expect(page.getByText(/KB - Ready/)).toBeVisible({ timeout: 20000 });
	await expect(page.getByText("Focus: rate laws and Arrhenius equation")).toBeVisible();
	await expect(page.getByText(/topics extracted/)).toBeVisible();

	await page.getByRole("textbox", { name: "Topics" }).fill("Activation energy");
	await page.getByRole("button", { name: "Generate", exact: true }).click();

	await expect(
		page.getByRole("heading", { level: 1, name: "Ad hoc upload grounded exam" }),
	).toBeVisible();
	await expect(page.getByText("Chemistry source upload - 12 questions - queued")).toBeVisible();
	await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
	await expect(page.getByText("rate-laws-notes.txt")).toBeVisible();
	await expect(page.getByText("Focus: rate laws and Arrhenius equation")).toBeVisible();
});

test("authenticated user can upload a class style reference and see credit accounting", async ({
	page,
}) => {
	await signInAsTestUser(page, `style-ref-${Date.now()}@exampull.test`, {
		tier: "guru",
		credits: 40,
	});
	const classResponse = await page.context().request.post("/api/classes", {
		data: {
			name: "Style Reference Chemistry",
			institution: "ExamPull",
			educationLevel: 68,
			description: "Past exam style reference coverage.",
		},
	});
	expect(classResponse.status()).toBe(201);
	const classPayload = (await classResponse.json()) as { classId: string };

	await page.goto(`/classes/${classPayload.classId}`);
	await page.getByLabel("Focus").fill("short constructed-response kinetics questions");
	await page.getByLabel("Instructor style reference").check();
	await page.getByLabel("Material file").setInputFiles({
		name: "instructor-style-reference.txt",
		mimeType: "text/plain",
		buffer: Buffer.from(
			"Past exam style\nUse compact prompts\nRequire short constructed-response explanations",
		),
	});
	await page.getByRole("button", { name: "Upload material" }).click();

	await expect(page.getByText("instructor-style-reference.txt", { exact: true })).toBeVisible({
		timeout: 20000,
	});
	await expect(page.getByText(/KB - style ready/)).toBeVisible({ timeout: 20000 });
	await expect(page.getByText("Style reference", { exact: true }).last()).toBeVisible();
	await expect(page.getByText("ready", { exact: true })).toBeVisible();
	await expect(
		page.getByText("Instructor style guide inferred from instructor-style-reference.txt."),
	).toBeVisible();

	const exportResponse = await page.context().request.get("/api/settings/export");
	expect(exportResponse.status()).toBe(200);
	const exportPayload = (await exportResponse.json()) as {
		profile: {
			credits?: number;
			reservedCredits?: number;
			totalCreditsConsumed?: number;
		} | null;
		classes: {
			id: string;
			styleGuideStatus?: string;
			styleGuide?: string;
		}[];
		classMaterials: {
			classId: string;
			materials: {
				id: string;
				filename?: string;
				status?: string;
				styleReference?: boolean;
				extractedTopics?: string[];
			}[];
		}[];
	};
	expect(exportPayload.profile?.credits).toBe(38);
	expect(exportPayload.profile?.reservedCredits).toBe(0);
	expect(exportPayload.profile?.totalCreditsConsumed).toBe(2);
	const exportedClass = exportPayload.classes.find(
		(course) => course.id === classPayload.classId,
	);
	expect(exportedClass?.styleGuideStatus).toBe("ready");
	expect(exportedClass?.styleGuide).toContain("instructor-style-reference.txt");
	const exportedMaterial = exportPayload.classMaterials
		.find((course) => course.classId === classPayload.classId)
		?.materials.find((material) => material.filename === "instructor-style-reference.txt");
	if (!exportedMaterial) {
		throw new Error("Uploaded class material was not returned by export.");
	}
	expect(exportedMaterial?.status).toBe("style_ready");
	expect(exportedMaterial?.styleReference).toBe(true);
	expect(exportedMaterial?.extractedTopics?.length).toBeGreaterThan(0);

	await page.goto("/exams/new");
	await page.getByLabel("Exam title").fill("Combined stored and ad hoc sources exam");
	await page.getByLabel("Stored class").selectOption(classPayload.classId);
	await page.getByLabel(/instructor-style-reference\.txt/).check();
	await page.getByLabel("Focus for next upload").fill("activation energy supplement");
	await page.getByLabel("Upload files").setInputFiles({
		name: "activation-energy-supplement.txt",
		mimeType: "text/plain",
		buffer: Buffer.from("Activation energy\nCollision theory\nTemperature effects"),
	});
	await expect(page.getByText("activation-energy-supplement.txt")).toBeVisible({
		timeout: 20000,
	});
	await page.getByRole("textbox", { name: "Topics" }).fill("Collision theory");
	await page.getByRole("button", { name: "Generate", exact: true }).click();

	await expect(
		page.getByRole("heading", { level: 1, name: "Combined stored and ad hoc sources exam" }),
	).toBeVisible();
	await expect(page.getByText("Style Reference Chemistry - 12 questions - queued")).toBeVisible();
	await expect(page.getByText("activation-energy-supplement.txt")).toBeVisible();
	await expect(page.getByText("Collision theory", { exact: true })).toBeVisible();

	const combinedExportResponse = await page.context().request.get("/api/settings/export");
	expect(combinedExportResponse.status()).toBe(200);
	const combinedExport = (await combinedExportResponse.json()) as {
		exams: {
			title?: string;
			sourceMaterialIds?: string[];
			adHocSources?: { filename?: string }[];
			topics?: string[];
		}[];
	};
	const combinedExam = combinedExport.exams.find(
		(exam) => exam.title === "Combined stored and ad hoc sources exam",
	);
	if (!combinedExam) {
		throw new Error("Combined source exam was not returned by export.");
	}
	expect(combinedExam.sourceMaterialIds).toContain(exportedMaterial.id);
	expect(
		combinedExam.adHocSources?.some(
			(source) => source.filename === "activation-energy-supplement.txt",
		),
	).toBe(true);
	expect(combinedExam.topics).toContain("Collision theory");
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

test("authenticated user can create edit archive restore and delete a class", async ({ page }) => {
	await signInAsTestUser(page, `class-life-${Date.now()}@exampull.test`);
	const createResponse = await page.context().request.post("/api/classes", {
		data: {
			name: "Lifecycle Calculus",
			institution: "ExamPull",
			educationLevel: 80,
			description: "Initial fixture.",
		},
	});
	expect(createResponse.status()).toBe(201);
	const createPayload = (await createResponse.json()) as { classId: string };

	const editResponse = await page
		.context()
		.request.patch(`/api/classes/${createPayload.classId}`, {
			data: {
				name: "Lifecycle Calculus II",
				institution: "ExamPull Lab",
				description: "Edited fixture.",
				archived: true,
			},
		});
	expect(editResponse.status()).toBe(200);

	const archivedResponse = await page
		.context()
		.request.get(`/api/classes/${createPayload.classId}`);
	expect(archivedResponse.status()).toBe(200);
	const archivedPayload = (await archivedResponse.json()) as {
		class: { name: string; archived: boolean };
	};
	expect(archivedPayload.class.name).toBe("Lifecycle Calculus II");
	expect(archivedPayload.class.archived).toBe(true);

	const restoreResponse = await page
		.context()
		.request.patch(`/api/classes/${createPayload.classId}`, {
			data: { archived: false },
		});
	expect(restoreResponse.status()).toBe(200);

	const deleteResponse = await page
		.context()
		.request.delete(`/api/classes/${createPayload.classId}`);
	expect(deleteResponse.status()).toBe(200);

	const missingResponse = await page
		.context()
		.request.get(`/api/classes/${createPayload.classId}`);
	expect(missingResponse.status()).toBe(404);
});

test("authenticated user can search and bulk manage the exam library", async ({ page }) => {
	await signInAsTestUser(page, `library-${Date.now()}@exampull.test`);
	await seedExam(page, "Library entropy exam");
	await seedExam(page, "Library kinetics exam");
	const classResponse = await page.context().request.post("/api/classes", {
		data: {
			name: "Library Target Class",
			institution: "ExamPull",
			educationLevel: 70,
			description: "Bulk move target.",
		},
	});
	expect(classResponse.status()).toBe(201);
	const classPayload = (await classResponse.json()) as { classId: string };

	await page.goto("/exams");
	await page.getByRole("button", { name: "List view" }).click();
	await expect(page.getByLabel("Select Library entropy exam")).toBeVisible();
	await page.getByRole("button", { name: "Grid view" }).click();

	await page.getByPlaceholder("Search title, topic, or class").fill("entropy");
	await expect(page.getByLabel("Select Library entropy exam")).toBeVisible();
	await expect(page.getByLabel("Select Library kinetics exam")).toHaveCount(0);

	await page.getByPlaceholder("Search title, topic, or class").fill("");
	await page.getByLabel("Select Library entropy exam").check();
	await page.getByRole("button", { name: "Bookmark", exact: true }).click();
	await expect(page.getByText("Library updated.")).toBeVisible();

	await page.getByLabel("Bookmark filter").selectOption("bookmarked");
	await expect(page.getByLabel("Select Library entropy exam")).toBeVisible();
	await expect(page.getByLabel("Select Library kinetics exam")).toHaveCount(0);

	await page.getByLabel("Bookmark filter").selectOption("all");
	await page.getByLabel("Select Library entropy exam").check();
	await page.getByRole("button", { name: "Archive" }).click();
	await expect(page.getByLabel("Select Library entropy exam")).toHaveCount(0);

	await page.getByLabel("Archive filter").selectOption("archived");
	await expect(page.getByLabel("Select Library entropy exam")).toBeVisible();
	await page.getByLabel("Select Library entropy exam").check();
	await page.getByRole("button", { name: "Restore" }).click();
	await expect(page.getByLabel("Select Library entropy exam")).toHaveCount(0);

	await page.getByLabel("Archive filter").selectOption("active");
	await page.getByLabel("Select Library entropy exam").check();
	await page.getByLabel("Move selected to class").selectOption(classPayload.classId);
	await page.getByRole("button", { name: "Move" }).click();
	await page.getByLabel("Class filter").selectOption(classPayload.classId);
	await expect(page.getByLabel("Select Library entropy exam")).toBeVisible();
	await expect(page.getByLabel("Select Library kinetics exam")).toHaveCount(0);

	await page.getByLabel("Select Library entropy exam").check();
	page.once("dialog", (dialog) => {
		void dialog.accept();
	});
	await page.getByRole("button", { name: "Delete" }).click();
	await expect(page.getByLabel("Select Library entropy exam")).toHaveCount(0);
});
