import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { cleanupFirebaseTestPhoneAccount } from "./firebase-cleanup";
import { envValue, testSignupToken } from "./test-auth";

const smokeArtifactRoot = join(process.cwd(), "artifacts", "smoke");

async function assertNoHorizontalOverflow(page: Page) {
	const overflow = await page.evaluate(
		() =>
			Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
			window.innerWidth,
	);
	expect(Math.round(overflow)).toBeLessThanOrEqual(2);
}

async function attachSmokeScreenshot(page: Page, testInfo: TestInfo, name: string) {
	mkdirSync(smokeArtifactRoot, { recursive: true });
	const path = join(smokeArtifactRoot, `${name}.png`);
	await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
	await page.screenshot({ fullPage: true, path });
	await testInfo.attach(name, { path, contentType: "image/png" });
}

function humanPhoneEntry(phoneNumber: string) {
	const digits = phoneNumber.replace(/\D/g, "");

	if (digits.length === 11 && digits.startsWith("1")) {
		return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
	}

	return phoneNumber;
}

test("landing page shows artifact-first CTA", async ({ page }, testInfo) => {
	await page.goto("/");
	await expect(page.getByRole("link", { name: "Start with a free exam" })).toBeVisible();
	await expect(page.getByTestId("exam-artifact-preview")).toBeVisible();
	await expect(
		page
			.getByTestId("exam-artifact-preview")
			.getByRole("heading", { name: "Thermodynamics Midterm" }),
	).toBeVisible();
	const colorScheme = await page.evaluate(
		() => getComputedStyle(document.documentElement).colorScheme,
	);
	expect(colorScheme).toContain("dark");
	await assertNoHorizontalOverflow(page);
	await attachSmokeScreenshot(page, testInfo, "landing-desktop");
});

test("landing page keeps the paper artifact visible on mobile", async ({ page }, testInfo) => {
	await page.setViewportSize({ width: 390, height: 720 });
	await page.goto("/");
	await expect(
		page.getByTestId("mobile-artifact-signal").getByText("Generated Practice Examination", {
			exact: true,
		}),
	).toBeVisible();
	await expect(page.getByRole("link", { name: "Start with a free exam" })).toBeVisible();
	await assertNoHorizontalOverflow(page);
	await attachSmokeScreenshot(page, testInfo, "landing-mobile");
});

test("Firebase browser auth accepts the current origin", async ({ page }) => {
	await page.goto("/sign-in");
	await expect(page.getByTestId("exam-artifact-preview")).toBeVisible();
	await page
		.getByLabel("Email")
		.fill(`auth-smoke-${Date.now()}@missing-account.exampull.invalid`);
	await page.getByLabel("Password").fill("MissingAccountPassword123!");
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page.getByText("The email or password is not correct.")).toBeVisible();
	await expect(page.getByText(/unauthorized-domain/i)).toHaveCount(0);
});

test("protected app routes redirect instead of server-erroring", async ({ page }) => {
	for (const path of [
		"/dashboard",
		"/classes",
		"/exams",
		"/exams/new",
		"/settings",
		"/billing",
	]) {
		const response = await page.context().request.get(path, { maxRedirects: 0 });
		expect(response.status(), `${path} should redirect to sign-up`).toBe(307);
		expect(response.headers().location).toBe("/sign-up");
	}
});

test("Firebase phone signup verifies through the browser form and queues an exam", async ({
	page,
}, testInfo) => {
	const phoneNumber = envValue("FIREBASE_TEST_PHONE_NUMBER");
	const phoneCode = envValue("FIREBASE_TEST_PHONE_CODE");
	test.skip(
		!phoneNumber || !phoneCode,
		"Firebase phone signup smoke requires FIREBASE_TEST_PHONE_NUMBER and FIREBASE_TEST_PHONE_CODE.",
	);

	const email = `phone-smoke-${Date.now()}@exampull.test`;
	await cleanupFirebaseTestPhoneAccount(phoneNumber ?? "");

	try {
		await page.goto(`/sign-up?testToken=${encodeURIComponent(testSignupToken())}`);
		await page.getByLabel("Name").fill("Phone Smoke");
		await page.getByLabel("Email").fill(email);
		await page.getByLabel("Password").fill("PhoneSmokePassword123!");
		await page.getByLabel("Phone number").fill(humanPhoneEntry(phoneNumber ?? ""));
		await page.getByRole("button", { name: "Send verification code" }).click();
		await expect(page.getByLabel("6-digit code")).toBeVisible({ timeout: 20_000 });
		await expect(page.getByText(/operation-not-allowed/i)).toHaveCount(0);
		await page.getByLabel("6-digit code").fill(phoneCode ?? "");
		await page.getByRole("button", { name: "Verify and create account" }).click();
		await expect(
			page.getByRole("heading", { name: "Your practice exam workspace" }),
		).toBeVisible({
			timeout: 20_000,
		});
		await attachSmokeScreenshot(page, testInfo, "phone-signup-dashboard");
		await page.goto("/exams/new");
		await expect(page.getByRole("heading", { name: "Build a practice exam" })).toBeVisible();
		await attachSmokeScreenshot(page, testInfo, "phone-signup-new-exam-builder");
		await page.getByLabel("Exam title").fill("Hosted phone signup canary");
		await page.getByRole("button", { name: "Next: Choose topics" }).click();
		await page
			.getByRole("textbox", { name: "Topics to include" })
			.fill("Cell membranes\nDiffusion\nOsmosis");
		await page.getByRole("button", { name: "Next: Set length" }).click();
		await page.getByRole("button", { name: "Generate", exact: true }).click();
		await expect(
			page.getByRole("heading", { level: 1, name: "Hosted phone signup canary" }),
		).toBeVisible({ timeout: 20_000 });
		await expect(page.getByText("Manual topics - 12 questions - queued")).toBeVisible();
		await attachSmokeScreenshot(page, testInfo, "phone-signup-queued-exam");

		const cleanupResponse = await page.context().request.post("/api/settings/delete");
		expect(cleanupResponse.status()).toBe(200);
	} finally {
		await cleanupFirebaseTestPhoneAccount(phoneNumber ?? "");
	}
});

test("admin routes are hidden without admin session", async ({ page }) => {
	const response = await page.goto("/admin");
	expect(response?.status()).toBe(404);
});
