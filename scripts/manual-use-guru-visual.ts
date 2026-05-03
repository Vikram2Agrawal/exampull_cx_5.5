import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { type APIRequestContext, chromium, expect, type Page } from "@playwright/test";
import { z } from "zod";

const envSchema = z.object({
	TEST_SIGNUP_TOKEN: z.string().min(1),
});

const createUserResponseSchema = z.object({
	uid: z.string().min(1),
	customToken: z.string().min(1),
	apiKey: z.string().min(1),
});

const idTokenResponseSchema = z.object({
	idToken: z.string().min(1),
});

const seedExamResponseSchema = z.object({
	examId: z.string().min(1),
});

function envFromLocalFile() {
	const result: Record<string, string> = {};
	try {
		const contents = readFileSync(".env.local", "utf8");
		for (const line of contents.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
				continue;
			}
			const [name, ...valueParts] = trimmed.split("=");
			result[name] = valueParts.join("=").replace(/^["']|["']$/g, "");
		}
	} catch {
		return result;
	}

	return result;
}

function readEnv() {
	return envSchema.parse({
		...envFromLocalFile(),
		...process.env,
	});
}

function pdfText(value: string) {
	return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function textPdfBuffer(pages: string[]) {
	const objects = new Map<number, string>();
	const pageObjectIds = pages.map((_, index) => 4 + index * 2);
	objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
	objects.set(
		2,
		`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
	);
	objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

	pages.forEach((page, index) => {
		const pageObjectId = 4 + index * 2;
		const contentObjectId = pageObjectId + 1;
		const lines = page
			.split("\n")
			.map((line) => `(${pdfText(line)}) Tj T*`)
			.join("\n");
		const stream = `BT /F1 12 Tf 72 740 Td 16 TL\n${lines}\nET`;
		objects.set(
			pageObjectId,
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
		);
		objects.set(
			contentObjectId,
			`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
		);
	});

	const orderedIds = [...objects.keys()].sort((left, right) => left - right);
	let pdf = "%PDF-1.4\n";
	const offsets = new Map<number, number>();

	for (const objectId of orderedIds) {
		offsets.set(objectId, Buffer.byteLength(pdf, "utf8"));
		pdf += `${objectId} 0 obj\n${objects.get(objectId) ?? ""}\nendobj\n`;
	}

	const xrefOffset = Buffer.byteLength(pdf, "utf8");
	pdf += `xref\n0 ${orderedIds.length + 1}\n0000000000 65535 f \n`;
	for (const objectId of orderedIds) {
		pdf += `${String(offsets.get(objectId) ?? 0).padStart(10, "0")} 00000 n \n`;
	}
	pdf += `trailer\n<< /Size ${orderedIds.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

	return Buffer.from(pdf, "utf8");
}

async function expectOk(response: Awaited<ReturnType<APIRequestContext["post"]>>, label: string) {
	if (!response.ok()) {
		throw new Error(
			`${label} failed with ${response.status().toString()}: ${await response.text()}`,
		);
	}
}

async function captureState(page: Page, root: string, name: string) {
	await page.waitForTimeout(150);
	await page.screenshot({ path: join(root, `${name}.png`) });
	await page.screenshot({ path: join(root, `${name}-full-page.png`), fullPage: true });
}

async function main() {
	const env = readEnv();
	const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3103";
	const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
	const root = join("artifacts", "manual-use", "guru-visual", timestamp);
	await mkdir(root, { recursive: true });

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		baseURL,
		viewport: { width: 1440, height: 1000 },
		acceptDownloads: true,
	});

	const email = `manual-guru-${Date.now().toString()}@exampull.test`;
	const createResponse = await context.request.post("/api/test/session", {
		data: {
			token: env.TEST_SIGNUP_TOKEN,
			email,
			displayName: "Manual Guru Student",
			tier: "guru",
			credits: 100,
			phoneNumber: "+15555550123",
		},
	});
	await expectOk(createResponse, "Create manual test user");
	const createPayload = createUserResponseSchema.parse(await createResponse.json());
	const identityResponse = await fetch(
		`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${createPayload.apiKey}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				token: createPayload.customToken,
				returnSecureToken: true,
			}),
		},
	);
	if (!identityResponse.ok) {
		throw new Error(`Identity exchange failed: ${await identityResponse.text()}`);
	}
	const identityPayload = idTokenResponseSchema.parse(await identityResponse.json());
	const sessionResponse = await context.request.put("/api/test/session", {
		data: { token: env.TEST_SIGNUP_TOKEN, idToken: identityPayload.idToken },
	});
	await expectOk(sessionResponse, "Open manual browser session");

	const examResponse = await context.request.post("/api/test/seed", {
		data: {
			token: env.TEST_SIGNUP_TOKEN,
			kind: "exam",
			title: "Manual Guru Visual Feedback Check",
			className: "MATH 301 Optimization",
		},
	});
	await expectOk(examResponse, "Seed completed exam");
	const { examId } = seedExamResponseSchema.parse(await examResponse.json());

	const page = await context.newPage();
	await page.goto(`/exams/${examId}`);
	await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
	await captureState(page, root, "01-exam-detail-before-upload");

	const attemptPdf = textPdfBuffer([
		"Question 1: I used the derivative test to find critical points.",
		"Question 2: I checked endpoints but forgot the second derivative sign change.",
	]);
	await page.getByLabel("Attempt file").setInputFiles({
		name: "manual-guru-attempt.pdf",
		mimeType: "application/pdf",
		buffer: attemptPdf,
	});
	await expect(page.getByRole("button", { name: "Upload and grade" })).toBeEnabled();
	await captureState(page, root, "02-attempt-file-selected");
	const uploadCompleted = page.waitForResponse(
		(response) =>
			response.url().includes(`/api/exams/${examId}/attempts/`) &&
			response.request().method() === "PATCH",
	);
	await page.getByRole("button", { name: "Upload and grade" }).click();
	const uploadCompletedResponse = await uploadCompleted;
	if (!uploadCompletedResponse.ok()) {
		throw new Error(
			`Visible upload completion failed: ${uploadCompletedResponse.status().toString()} ${await uploadCompletedResponse.text()}`,
		);
	}
	await expect(page.getByText("grading queued")).toBeVisible({ timeout: 30_000 });

	const attemptsResponse = await context.request.get(`/api/exams/${examId}/attempts`);
	await expectOk(attemptsResponse, "Read attempts after visible upload");
	const attemptsPayload = (await attemptsResponse.json()) as {
		attempts: { id: string; filename: string }[];
	};
	const attempt = attemptsPayload.attempts.find(
		(candidate) => candidate.filename === "manual-guru-attempt.pdf",
	);
	if (!attempt) {
		throw new Error("Visible upload did not create the expected attempt.");
	}

	const gradeResponse = await context.request.post("/api/workers/grade-attempt", {
		data: { userId: createPayload.uid, examId, attemptId: attempt.id },
	});
	await expectOk(gradeResponse, "Complete background grading");
	await page.reload();
	await expect(page.getByRole("button", { name: "Generate visual annotations" })).toBeVisible();
	await page
		.getByRole("button", { name: "Generate visual annotations" })
		.scrollIntoViewIfNeeded();
	await captureState(page, root, "03-graded-before-annotations");

	await page.getByRole("button", { name: "Generate visual annotations" }).click();
	await expect(page.getByText("Visual annotations: complete")).toBeVisible({
		timeout: 60_000,
	});
	await page.getByRole("link", { name: "Download visual feedback" }).scrollIntoViewIfNeeded();
	await captureState(page, root, "04-visual-annotations-ready");

	const [download] = await Promise.all([
		page.waitForEvent("download"),
		page.getByRole("link", { name: "Download visual feedback" }).click(),
	]);
	await download.saveAs(join(root, "visual-feedback.pdf"));

	await browser.close();
	console.log(`Manual Guru visual-feedback run saved to ${root}`);
}

await main();
