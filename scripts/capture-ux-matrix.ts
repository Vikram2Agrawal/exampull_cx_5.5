import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { type APIResponse, type BrowserContext, chromium, type Page } from "@playwright/test";
import { z } from "zod";

const envSchema = z.object({
	TEST_SIGNUP_TOKEN: z.string().min(1),
	ADMIN_AGENT_PASSWORD: z.string().min(1).optional(),
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

const classCreateResponseSchema = z.object({
	classId: z.string().min(1),
});

const viewports = [
	{
		name: "desktop",
		width: 1440,
		height: 1000,
	},
	{
		name: "mobile",
		width: 390,
		height: 844,
	},
] as const;

const publicRoutes = [
	{ name: "landing", path: "/" },
	{ name: "pricing", path: "/pricing" },
	{ name: "signin", path: "/sign-in" },
	{ name: "signup", path: "/sign-up" },
	{ name: "support", path: "/support" },
] as const;

const studentRouteTemplates = [
	{ name: "dashboard", path: "/dashboard" },
	{ name: "classes", path: "/classes" },
	{ name: "classes-new", path: "/classes/new" },
	{ name: "class-detail", path: (state: StudentState) => `/classes/${state.classId}` },
	{ name: "exams", path: "/exams" },
	{ name: "exams-new", path: "/exams/new" },
	{ name: "exam-detail", path: (state: StudentState) => `/exams/${state.examId}` },
	{ name: "notifications", path: "/notifications" },
	{ name: "settings", path: "/settings" },
	{ name: "billing", path: "/billing" },
] as const;

const adminRoutes = [
	{ name: "admin-overview", path: "/admin" },
	{ name: "admin-users", path: "/admin/users" },
	{ name: "admin-exams", path: "/admin/exams" },
	{ name: "admin-communications", path: "/admin/communications" },
	{ name: "admin-operations", path: "/admin/operations" },
	{ name: "admin-referrals", path: "/admin/referrals" },
	{ name: "admin-configuration", path: "/admin/configuration" },
	{ name: "admin-audit-log", path: "/admin/audit-log" },
	{ name: "admin-abuse", path: "/admin/abuse" },
	{ name: "admin-search", path: "/admin/search?q=exampull" },
] as const;

type Env = z.infer<typeof envSchema>;

type StudentState = {
	classId: string;
	examId: string;
};

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

function readEnv(): Env {
	return envSchema.parse({
		...envFromLocalFile(),
		...process.env,
	});
}

async function expectOk(response: APIResponse, label: string) {
	if (!response.ok()) {
		throw new Error(`${label} failed with ${response.status()}: ${await response.text()}`);
	}
}

async function createSignedInTestUser(context: BrowserContext, env: Env) {
	const email = `ux-audit-${Date.now()}@exampull.test`;
	const createResponse = await context.request.post("/api/test/session", {
		data: {
			token: env.TEST_SIGNUP_TOKEN,
			email,
			displayName: "Emily Chen",
			tier: "guru",
			credits: 900,
			phoneNumber: "+15555550123",
		},
	});
	await expectOk(createResponse, "Create test user");
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
		throw new Error(`Identity Toolkit exchange failed: ${await identityResponse.text()}`);
	}
	const identityPayload = idTokenResponseSchema.parse(await identityResponse.json());
	const sessionResponse = await context.request.put("/api/test/session", {
		data: {
			token: env.TEST_SIGNUP_TOKEN,
			idToken: identityPayload.idToken,
		},
	});
	await expectOk(sessionResponse, "Open test session");
}

async function seedStudentState(context: BrowserContext, env: Env): Promise<StudentState> {
	const classResponse = await context.request.post("/api/classes", {
		data: {
			name: "BISC 220 Molecular Biology",
			institution: "University of Southern California",
			educationLevel: 60,
			description: "Lecture slides, recitation notes, and midterm-style practice materials.",
		},
	});
	await expectOk(classResponse, "Create class");
	const classPayload = classCreateResponseSchema.parse(await classResponse.json());
	const examResponse = await context.request.post("/api/test/seed", {
		data: {
			token: env.TEST_SIGNUP_TOKEN,
			kind: "exam",
			title: "Molecular Biology Midterm Practice",
			classId: classPayload.classId,
			className: "BISC 220 Molecular Biology",
		},
	});
	await expectOk(examResponse, "Seed exam");
	const examPayload = seedExamResponseSchema.parse(await examResponse.json());
	await context.request.post("/api/test/seed", {
		data: {
			token: env.TEST_SIGNUP_TOKEN,
			kind: "visual_attempt",
			examId: examPayload.examId,
			filename: "annotated-practice-attempt.pdf",
		},
	});
	await context.request.post("/api/test/seed", {
		data: {
			token: env.TEST_SIGNUP_TOKEN,
			kind: "notification",
			title: "Your practice exam is ready",
			body: "Molecular Biology Midterm Practice has finished quality review.",
			notificationKind: "exam_complete",
			href: `/exams/${examPayload.examId}`,
			read: false,
		},
	});

	return {
		classId: classPayload.classId,
		examId: examPayload.examId,
	};
}

async function signInAsAdmin(context: BrowserContext, env: Env) {
	if (!env.ADMIN_AGENT_PASSWORD) {
		return false;
	}

	const response = await context.request.post("/api/admin/auth/agent", {
		data: { password: env.ADMIN_AGENT_PASSWORD },
	});
	await expectOk(response, "Admin agent sign-in");

	return true;
}

async function captureRoute(
	page: Page,
	root: string,
	viewportName: string,
	name: string,
	path: string,
) {
	await page.goto(path, { waitUntil: "domcontentloaded" });
	await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
	await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
	await page.screenshot({
		path: join(root, `${viewportName}-${name}.png`),
		fullPage: true,
	});
}

async function main() {
	const env = readEnv();
	const baseURL = process.env.TEST_BASE_URL ?? process.argv[2] ?? "http://127.0.0.1:3102";
	const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
	const root = join("artifacts", "ux-audit", "full-product", timestamp);
	await mkdir(root, { recursive: true });

	const browser = await chromium.launch({ headless: true });
	for (const viewport of viewports) {
		const context = await browser.newContext({
			baseURL,
			viewport: {
				width: viewport.width,
				height: viewport.height,
			},
		});
		const page = await context.newPage();
		for (const route of publicRoutes) {
			await captureRoute(page, root, viewport.name, route.name, route.path);
		}
		await createSignedInTestUser(context, env);
		const state = await seedStudentState(context, env);
		for (const route of studentRouteTemplates) {
			const path = typeof route.path === "function" ? route.path(state) : route.path;
			await captureRoute(page, root, viewport.name, route.name, path);
		}
		await context.close();
	}

	const adminContext = await browser.newContext({
		baseURL,
		viewport: {
			width: 1440,
			height: 1000,
		},
	});
	if (await signInAsAdmin(adminContext, env)) {
		const adminPage = await adminContext.newPage();
		for (const route of adminRoutes) {
			await captureRoute(adminPage, root, "desktop", route.name, route.path);
		}
	}
	await adminContext.close();
	await browser.close();

	console.log(`Saved UX screenshot matrix to ${root}`);
}

await main();
