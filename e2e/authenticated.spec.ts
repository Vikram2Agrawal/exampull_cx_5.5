import { expect, type Page, test } from "@playwright/test";
import Stripe from "stripe";
import {
	createTestAuthUser,
	envValue,
	idTokenForCustomToken,
	seedExam,
	seedVisualAttempt,
	signInAsTestUser,
	testSignupToken,
} from "./test-auth";

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

function blankPdfBuffer() {
	return Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Root 1 0 R /Size 4 >>
startxref
186
%%EOF`);
}

async function postSignedStripeEvent(page: Page, event: Record<string, unknown>) {
	const secret = envValue("STRIPE_WEBHOOK_SECRET");
	expect(secret, "STRIPE_WEBHOOK_SECRET must be set for billing E2E").toBeTruthy();
	const payload = JSON.stringify(event);
	const signature = Stripe.webhooks.generateTestHeaderString({
		payload,
		secret: secret ?? "",
	});

	return page.context().request.post("/api/webhooks/stripe", {
		headers: {
			"Content-Type": "application/json",
			"stripe-signature": signature,
		},
		data: payload,
	});
}

async function resumeExistingTestUser(page: Page, email: string) {
	const createPayload = await createTestAuthUser(page, email, {
		writeUserDoc: false,
	});
	const idToken = await idTokenForCustomToken(createPayload);
	const sessionResponse = await page.context().request.put("/api/test/session", {
		data: { token: testSignupToken(), idToken },
	});
	expect(sessionResponse.status()).toBe(200);

	return createPayload.uid;
}

async function signUpWithReferral(page: Page, email: string, referralCode: string) {
	const createPayload = await createTestAuthUser(page, email, {
		authPhoneNumber: true,
		writeUserDoc: false,
	});
	const idToken = await idTokenForCustomToken(createPayload);
	const response = await page.context().request.post("/api/auth/session", {
		data: {
			idToken,
			mode: "signup",
			displayName: "Referral Friend",
			testSignupToken: testSignupToken(),
			referralCode,
		},
	});
	expect(response.status()).toBe(200);

	return createPayload.uid;
}

async function signInAsAdminAgent(page: Page) {
	const password = adminAgentPassword();
	const response = await page.context().request.post("/api/admin/auth/agent", {
		data: { password },
	});
	expect(response.status()).toBe(200);
}

function adminAgentPassword() {
	const password = envValue("ADMIN_AGENT_PASSWORD");
	expect(password, "ADMIN_AGENT_PASSWORD must be set for admin E2E").toBeTruthy();

	return password ?? "";
}

async function adminCsrfTokenFromPage(page: Page) {
	const token = await page
		.locator("[data-admin-csrf-token]")
		.first()
		.getAttribute("data-admin-csrf-token");
	expect(token, "Admin shell must expose a CSRF token for write APIs.").toBeTruthy();

	return token ?? "";
}

async function queueOneQuestionExam(page: Page, title: string) {
	const response = await page.context().request.post("/api/exams", {
		data: {
			title,
			className: "Referral Biology",
			topics: ["Mitosis checkpoints"],
			questionCount: 1,
			mode: "standard",
		},
	});
	expect(response.status()).toBe(201);
}

async function seedNotification(
	page: Page,
	input: {
		title: string;
		body: string;
		kind: string;
		href: string | null;
		read?: boolean;
	},
) {
	const response = await page.context().request.post("/api/test/seed", {
		data: {
			token: testSignupToken(),
			kind: "notification",
			title: input.title,
			body: input.body,
			notificationKind: input.kind,
			href: input.href,
			read: input.read ?? false,
		},
	});
	expect(response.status()).toBe(200);
	const payload = (await response.json()) as { notificationId: string };

	return payload.notificationId;
}

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

test("settings shows synced linked auth sources without duplicate account state", async ({
	page,
}) => {
	const email = `linked-sources-${Date.now()}@exampull.test`;
	await signInAsTestUser(page, email, {
		tier: "free",
		credits: 40,
	});

	await page.goto("/settings");
	await expect(page.getByRole("heading", { name: "Profile and linked accounts" })).toBeVisible();
	await expect(page.getByText("Linked sign-in sources")).toBeVisible();
	await expect(page.getByText("Email/password")).toBeVisible();
	await expect(page.getByText(email).first()).toBeVisible();
	await expect(page.getByText("Phone")).toBeVisible();
	await expect(page.getByRole("button", { name: "Link Google" })).toBeVisible();
	await expect(page.getByLabel("Payment failure SMS")).toBeChecked();
	await page.getByLabel("Payment failure SMS").uncheck();
	await page.getByLabel("Low credits email").check();
	await page.getByRole("button", { name: "Save notifications" }).click();
	await expect(page.getByText("Settings saved.")).toBeVisible();

	const exportResponse = await page.context().request.get("/api/settings/export");
	expect(exportResponse.status()).toBe(200);
	const exportPayload = (await exportResponse.json()) as {
		profile: {
			email?: string | null;
			emails?: string[];
			linkedAuthProviders?: {
				type?: string;
				identifier?: string;
				label?: string;
			}[];
			notificationPreferences?: {
				payment_failure?: { sms?: boolean };
				low_credits?: { email?: boolean };
			};
		} | null;
	};
	expect(exportPayload.profile?.email).toBe(email);
	expect(exportPayload.profile?.emails).toEqual([email]);
	expect(exportPayload.profile?.linkedAuthProviders).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				type: "email",
				identifier: email,
				label: "Email/password",
			}),
			expect.objectContaining({
				type: "phone",
				label: "Phone",
			}),
		]),
	);
	expect(exportPayload.profile?.notificationPreferences?.payment_failure?.sms).toBe(false);
	expect(exportPayload.profile?.notificationPreferences?.low_credits?.email).toBe(true);
});

test("Featurebase customer voice surfaces use signed SSO and feed the admin inbox", async ({
	page,
}) => {
	const organization = envValue("NEXT_PUBLIC_FEATUREBASE_ORGANIZATION");
	expect(organization, "NEXT_PUBLIC_FEATUREBASE_ORGANIZATION must be set").toBeTruthy();
	await page.route("https://do.featurebase.app/js/sdk.js", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/javascript",
			body: "window.Featurebase=function(){window.__featurebaseCalls=(window.__featurebaseCalls||0)+1};",
		});
	});
	await page.route("**://*.featurebase.app/**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "text/html",
			body: "<html><body>Featurebase test portal</body></html>",
		});
	});

	await signInAsTestUser(page, `featurebase-${Date.now()}@exampull.test`, {
		tier: "guru",
		credits: 100,
	});

	const sessionResponse = await page.context().request.get("/api/featurebase/session");
	expect(sessionResponse.status()).toBe(200);
	const session = (await sessionResponse.json()) as {
		organization?: string;
		featurebaseJwt?: string;
		hasUnreadChangelog?: boolean;
	};
	expect(session.organization).toBe(organization);
	expect(session.featurebaseJwt?.split(".")).toHaveLength(3);
	expect(session.hasUnreadChangelog).toBe(true);

	await page.goto("/dashboard");
	await expect(
		page.getByRole("button", { name: /Open help and feedback, unread changelog/ }),
	).toBeVisible();
	await page.getByRole("button", { name: /Open help and feedback/ }).click();
	await expect(page.getByRole("heading", { name: "Send a note" })).toBeVisible();
	const widgetTitle = `Widget request ${Date.now()}`;
	await page.getByPlaceholder("Title").fill(widgetTitle);
	await page
		.getByPlaceholder("What should change?")
		.fill("Please add a customer-voice regression marker for this in-app widget.");
	await page.getByRole("button", { name: "Submit" }).click();
	await expect(page.getByText("Feedback submitted.")).toBeVisible();

	await page.goto("/feedback");
	let frameSrc = await page.getByTestId("featurebase-embed").getAttribute("src");
	expect(frameSrc).toContain(`https://${organization}.featurebase.app/`);
	expect(frameSrc).toContain("hideMenu=true");
	expect(frameSrc).toContain("jwt=");

	await page.goto("/roadmap");
	frameSrc = await page.getByTestId("featurebase-embed").getAttribute("src");
	expect(frameSrc).toContain(`https://${organization}.featurebase.app/roadmap`);

	await page.goto("/changelog");
	frameSrc = await page.getByTestId("featurebase-embed").getAttribute("src");
	expect(frameSrc).toContain(`https://${organization}.featurebase.app/changelog`);
	await expect
		.poll(async () => {
			const updated = await page.context().request.get("/api/featurebase/session");
			const payload = (await updated.json()) as { hasUnreadChangelog?: boolean };

			return payload.hasUnreadChangelog;
		})
		.toBe(false);

	await signInAsAdminAgent(page);
	await page.goto("/admin/communications");
	await expect(page.getByText(widgetTitle)).toBeVisible();
	await expect(
		page.locator("tr").filter({ hasText: widgetTitle }).getByText("in_app_widget"),
	).toBeVisible();
});

test("admin write APIs reject missing or invalid CSRF tokens and destructive writes require reauth", async ({
	page,
}) => {
	const { uid } = await signInAsTestUser(page, `admin-reauth-${Date.now()}@exampull.test`, {
		tier: "free",
		credits: 10,
	});
	await signInAsAdminAgent(page);
	const missingTokenResponse = await page
		.context()
		.request.patch("/api/admin/triage/feedback/csrf-probe", {
			data: { status: "reviewing" },
		});
	expect(missingTokenResponse.status()).toBe(403);

	await page.goto("/admin/abuse");
	await adminCsrfTokenFromPage(page);
	const invalidTokenResponse = await page
		.context()
		.request.patch("/api/admin/triage/feedback/csrf-probe", {
			headers: { "x-admin-csrf-token": "invalid" },
			data: { status: "reviewing" },
		});
	expect(invalidTokenResponse.status()).toBe(403);

	const previewConfigMissingReauth = await page
		.context()
		.request.patch("/api/admin/configuration/preview", {
			headers: { "x-admin-csrf-token": await adminCsrfTokenFromPage(page) },
			data: {
				disabled: false,
				reason: "Keep preview enabled during CSRF regression.",
			},
		});
	expect(previewConfigMissingReauth.status()).toBe(403);

	const missingReauthResponse = await page
		.context()
		.request.post(`/api/admin/users/${uid}/credits`, {
			headers: { "x-admin-csrf-token": await adminCsrfTokenFromPage(page) },
			data: {
				amount: 5,
				reason: "Support adjustment after failed generation.",
			},
		});
	expect(missingReauthResponse.status()).toBe(403);

	const invalidReauthResponse = await page
		.context()
		.request.post(`/api/admin/users/${uid}/credits`, {
			headers: {
				"x-admin-csrf-token": await adminCsrfTokenFromPage(page),
				"x-admin-reauth-password": "not-the-admin-password",
			},
			data: {
				amount: 5,
				reason: "Support adjustment after failed generation.",
			},
		});
	expect(invalidReauthResponse.status()).toBe(403);

	const validReauthResponse = await page
		.context()
		.request.post(`/api/admin/users/${uid}/credits`, {
			headers: {
				"x-admin-csrf-token": await adminCsrfTokenFromPage(page),
				"x-admin-reauth-password": adminAgentPassword(),
			},
			data: {
				amount: 5,
				reason: "Support adjustment after failed generation.",
			},
		});
	expect(validReauthResponse.status()).toBe(200);

	const previewConfigResponse = await page
		.context()
		.request.patch("/api/admin/configuration/preview", {
			headers: {
				"x-admin-csrf-token": await adminCsrfTokenFromPage(page),
				"x-admin-reauth-password": adminAgentPassword(),
			},
			data: {
				disabled: false,
				reason: "Keep preview enabled during admin regression.",
			},
		});
	expect(previewConfigResponse.status()).toBe(200);
	const previewConfig = (await previewConfigResponse.json()) as {
		previewGenerationDisabled?: boolean;
	};
	expect(previewConfig.previewGenerationDisabled).toBe(false);

	const exportResponse = await page.context().request.get("/api/settings/export");
	expect(exportResponse.status()).toBe(200);
	const exported = (await exportResponse.json()) as { profile: { credits?: number } | null };
	expect(exported.profile?.credits).toBe(15);
});

test("admin communications composer sends audited single-user messages", async ({ page }) => {
	const { uid } = await signInAsTestUser(page, `admin-message-${Date.now()}@exampull.test`, {
		tier: "scholar",
		credits: 42,
	});
	await signInAsAdminAgent(page);
	await page.goto("/admin/communications");
	await expect(page.getByRole("heading", { name: "Compose message" })).toBeVisible();
	const csrfToken = await adminCsrfTokenFromPage(page);
	const blockedUrlResponse = await page.context().request.post("/api/admin/communications/send", {
		headers: {
			"x-admin-csrf-token": csrfToken,
			"x-admin-reauth-password": adminAgentPassword(),
		},
		data: {
			mode: "single",
			userId: uid,
			channels: ["email"],
			subject: "Blocked URL test",
			body: "Please visit https://malicious.example/phish for details.",
		},
	});
	expect(blockedUrlResponse.status()).toBe(400);

	const singleSubject = `Admin note ${Date.now().toString()} for {{display_name}}`;
	const renderedSingleSubject = singleSubject.replace("{{display_name}}", "ExamPull E2E");
	await page.getByPlaceholder("User ID").fill(uid);
	await page.getByPlaceholder("Subject").fill(singleSubject);
	await page
		.getByPlaceholder("Message body")
		.fill("Hi {{display_name}}, your {{tier}} account has {{credit_balance}} credits.");
	await page.getByPlaceholder("Re-auth password").fill(adminAgentPassword());
	await page.getByRole("button", { name: "Send" }).click();
	await expect(page.getByText("Sent 2 message(s) to 1 recipient(s).")).toBeVisible();

	const row = page.locator("tr").filter({ hasText: renderedSingleSubject });
	await expect(row).toHaveCount(2);
	await expect(row.filter({ hasText: "skipped_test" })).toHaveCount(1);
	await expect(row.filter({ hasText: "sent" })).toHaveCount(1);

	const broadcastSubject = `Broadcast test ${Date.now().toString()}`;
	const broadcastResponse = await page.context().request.post("/api/admin/communications/send", {
		headers: {
			"x-admin-csrf-token": csrfToken,
			"x-admin-reauth-password": adminAgentPassword(),
		},
		data: {
			mode: "broadcast",
			channels: ["email"],
			subject: broadcastSubject,
			body: "A bounded test-account broadcast from the communications composer.",
			audience: {
				tier: "scholar",
				testAccounts: "only",
				limit: 1,
			},
		},
	});
	expect(broadcastResponse.status()).toBe(200);
	const broadcastPayload = (await broadcastResponse.json()) as {
		broadcastId?: string;
		recipientCount?: number;
		communicationCount?: number;
	};
	expect(broadcastPayload.broadcastId).toBeTruthy();
	expect(broadcastPayload.recipientCount).toBe(1);
	expect(broadcastPayload.communicationCount).toBe(1);
	await page.goto("/admin/communications");
	await expect(page.locator("tr").filter({ hasText: broadcastSubject })).toHaveCount(1);

	await page.goto("/notifications");
	await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
	await expect(page.getByText(renderedSingleSubject)).toBeVisible();
	await expect(page.getByText("your scholar account has 42 credits")).toBeVisible();
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

test("expired anonymous preview data is purged by the worker", async ({ page }) => {
	test.setTimeout(90_000);
	await signInAsTestUser(page, `preview-purge-${Date.now()}@exampull.test`, {
		tier: "free",
		credits: 40,
	});
	const previewId = `expired-preview-${Date.now()}`;
	const seedResponse = await page.context().request.post("/api/test/seed", {
		data: {
			token: testSignupToken(),
			kind: "expired_preview",
			previewId,
		},
	});
	expect(seedResponse.status()).toBe(200);

	const purgeResponse = await page.context().request.post("/api/workers/purge-expired-previews", {
		data: { limit: 500 },
	});
	expect(purgeResponse.status()).toBe(200);
	const purgePayload = (await purgeResponse.json()) as {
		anonymousPreviewsDeleted?: number;
		anonymousPreviewIdsDeleted?: string[];
		previewRateLimitsDeleted?: number;
		previewRateLimitIdsDeleted?: string[];
		storageObjectsDeleted?: number;
	};
	expect(purgePayload.anonymousPreviewsDeleted).toBeGreaterThanOrEqual(1);
	expect(purgePayload.anonymousPreviewIdsDeleted).toContain(previewId);
	expect(purgePayload.previewRateLimitsDeleted).toBeGreaterThanOrEqual(1);
	expect(purgePayload.previewRateLimitIdsDeleted).toContain(`expired-${previewId}`);
	expect(purgePayload.storageObjectsDeleted).toBeGreaterThanOrEqual(4);
});

test("phone conflict blocks an active prior account during session creation", async ({ page }) => {
	const phoneNumber = `+1${String(Date.now()).slice(-10).padStart(10, "5")}`;
	await createTestAuthUser(page, `active-phone-owner-${Date.now()}@exampull.test`, {
		tier: "free",
		credits: 40,
		phoneNumber,
		authPhoneNumber: false,
		writeUserDoc: true,
	});
	const incoming = await createTestAuthUser(
		page,
		`active-phone-incoming-${Date.now()}@exampull.test`,
		{
			phoneNumber,
			authPhoneNumber: true,
			writeUserDoc: false,
		},
	);
	const idToken = await idTokenForCustomToken(incoming);

	const response = await page.context().request.post("/api/auth/session", {
		data: {
			idToken,
			mode: "signup",
			displayName: "Phone Conflict E2E",
			testSignupToken: testSignupToken(),
		},
	});
	expect(response.status()).toBe(409);
	const payload = (await response.json()) as { code?: string; error?: string };
	expect(payload.code).toBe("phone_prior_auth_required");
	expect(payload.error).toContain("previously linked email or Google account");
});

test("signup session rejects auth tokens without verified phone", async ({ page }) => {
	const incoming = await createTestAuthUser(
		page,
		`unverified-phone-signup-${Date.now()}@exampull.test`,
		{
			authPhoneNumber: false,
			writeUserDoc: false,
		},
	);
	const idToken = await idTokenForCustomToken(incoming);

	const response = await page.context().request.post("/api/auth/session", {
		data: {
			idToken,
			mode: "signup",
			displayName: "Unverified Phone E2E",
			testSignupToken: testSignupToken(),
		},
	});
	expect(response.status()).toBe(400);
	const payload = (await response.json()) as { error?: string };
	expect(payload.error).toContain("Phone verification is required");
});

test("dormant phone conflict releases the number without inheriting old data", async ({ page }) => {
	const phoneNumber = `+1${String(Date.now() + 17)
		.slice(-10)
		.padStart(10, "6")}`;
	await createTestAuthUser(page, `dormant-phone-owner-${Date.now()}@exampull.test`, {
		tier: "guru",
		credits: 777,
		phoneNumber,
		authPhoneNumber: false,
		writeUserDoc: true,
		ageDays: 181,
	});
	const incoming = await createTestAuthUser(
		page,
		`dormant-phone-incoming-${Date.now()}@exampull.test`,
		{
			phoneNumber,
			authPhoneNumber: true,
			writeUserDoc: false,
		},
	);
	const idToken = await idTokenForCustomToken(incoming);

	const response = await page.context().request.post("/api/auth/session", {
		data: {
			idToken,
			mode: "signup",
			displayName: "Dormant Reclaim E2E",
			testSignupToken: testSignupToken(),
		},
	});
	expect(response.status()).toBe(200);

	const exportResponse = await page.context().request.get("/api/settings/export");
	expect(exportResponse.status()).toBe(200);
	const exportPayload = (await exportResponse.json()) as {
		profile: {
			email?: string | null;
			phoneNumber?: string;
			tier?: string;
			credits?: number;
			totalCreditsConsumed?: number;
			isTestAccount?: boolean;
		} | null;
		exams: unknown[];
	};
	expect(exportPayload.profile?.email).toContain("dormant-phone-incoming");
	expect(exportPayload.profile?.phoneNumber).toBe(phoneNumber);
	expect(exportPayload.profile?.tier).toBe("free");
	expect(exportPayload.profile?.credits).toBe(40);
	expect(exportPayload.profile?.totalCreditsConsumed).toBe(0);
	expect(exportPayload.profile?.isTestAccount).toBe(true);
	expect(exportPayload.exams).toHaveLength(0);
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

test("scholar share link can include answer key until creator downgrade", async ({ page }) => {
	const email = `share-answer-${Date.now()}@exampull.test`;
	await signInAsTestUser(page, email, {
		tier: "scholar",
		credits: 100,
	});
	const examId = await seedExam(page, "Shared answer key exam");

	const shareResponse = await page.context().request.post(`/api/exams/${examId}/share`, {
		data: { includeAnswerKey: true },
	});
	expect(shareResponse.status()).toBe(201);
	const sharePayload = (await shareResponse.json()) as { shareId: string; shareUrl: string };
	const sharePath = new URL(sharePayload.shareUrl).pathname;

	await page.goto(sharePath);
	await expect(page.getByRole("link", { name: "Download shared exam" })).toBeVisible();
	await expect(page.getByRole("link", { name: "Download answer key" })).toBeVisible();
	const answerResponse = await page
		.context()
		.request.get(`/api/share/${sharePayload.shareId}/download?type=answer`);
	expect(answerResponse.status()).toBe(200);
	expect(answerResponse.headers()["content-type"]).toContain("application/pdf");

	await createTestAuthUser(page, email, {
		tier: "free",
		credits: 40,
	});
	const freeShareResponse = await page.context().request.post(`/api/exams/${examId}/share`, {
		data: { includeAnswerKey: false },
	});
	expect(freeShareResponse.status()).toBe(403);

	await page.goto(sharePath);
	await expect(page.getByRole("link", { name: "Download shared exam" })).toBeVisible();
	await expect(page.getByRole("link", { name: "Download answer key" })).toHaveCount(0);
	const downgradedAnswerResponse = await page
		.context()
		.request.get(`/api/share/${sharePayload.shareId}/download?type=answer`);
	expect(downgradedAnswerResponse.status()).toBe(404);
	const examResponse = await page
		.context()
		.request.get(`/api/share/${sharePayload.shareId}/download`);
	expect(examResponse.status()).toBe(200);
});

test("share viewers can flag defective public exams", async ({ page, browser, baseURL }) => {
	const email = `share-report-${Date.now()}@exampull.test`;
	await signInAsTestUser(page, email, {
		tier: "scholar",
		credits: 100,
	});
	const examId = await seedExam(page, `Shared viewer report exam ${Date.now()}`);
	const shareResponse = await page.context().request.post(`/api/exams/${examId}/share`, {
		data: { includeAnswerKey: false },
	});
	expect(shareResponse.status()).toBe(201);
	const sharePayload = (await shareResponse.json()) as { shareId: string; shareUrl: string };
	const sharePath = new URL(sharePayload.shareUrl).pathname;
	const reportContext = `The final integration prompt is missing bounds for ${examId}.`;
	const viewerContext = await browser.newContext({ baseURL });

	try {
		const viewerPage = await viewerContext.newPage();
		await viewerPage.goto(sharePath);
		await viewerPage.getByRole("button", { name: "Something wrong with this exam?" }).click();
		await viewerPage.getByLabel("What looked wrong?").fill(reportContext);
		await viewerPage.getByRole("button", { name: "Flag shared exam" }).click();
		await expect(viewerPage.getByText("Thanks. The creator has been notified.")).toBeVisible();
	} finally {
		await viewerContext.close();
	}

	const exportResponse = await page.context().request.get("/api/settings/export");
	expect(exportResponse.status()).toBe(200);
	const exportPayload = (await exportResponse.json()) as {
		notifications: { title?: string; body?: string; kind?: string; href?: string }[];
		exams: { id?: string; shareViewerReportCount?: number }[];
	};
	expect(exportPayload.notifications).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				title: "Shared exam flagged",
				kind: "share",
				href: `/exams/${examId}`,
			}),
		]),
	);
	expect(exportPayload.exams.find((exam) => exam.id === examId)?.shareViewerReportCount).toBe(1);

	await signInAsAdminAgent(page);
	await page.goto("/admin/abuse");
	const reportRow = page.getByRole("row").filter({ hasText: reportContext });
	await expect(reportRow).toHaveCount(1);
	await expect(reportRow.getByText("share_viewer_report")).toBeVisible();
	await expect(reportRow.getByText(reportContext)).toBeVisible();
});

test("completed exam rating captures feedback and hides on incomplete exams", async ({ page }) => {
	await signInAsTestUser(page, `exam-rating-${Date.now()}@exampull.test`, {
		tier: "scholar",
		credits: 80,
	});
	const ratingExamTitle = `Rating fixture exam ${Date.now()}`;
	const ratingFeedback = `The notation looked realistic for ${ratingExamTitle}, but one prompt needed clearer limits.`;
	const examId = await seedExam(page, ratingExamTitle);

	await page.goto(`/exams/${examId}`);
	await expect(page.getByText("Artifact rating")).toBeVisible();
	await expect(
		page.getByText("Your feedback helps us improve. We may follow up via email."),
	).toBeVisible();
	await page.getByRole("button", { name: "Rate 4" }).click();
	await page.getByLabel("Optional feedback").fill(ratingFeedback);
	await page.getByRole("button", { name: "Submit rating" }).click();
	await expect(page.getByText("Thanks for your feedback!")).toBeVisible();

	const dismissExamId = await seedExam(page, "Dismiss rating fixture");
	await page.goto(`/exams/${dismissExamId}`);
	await page.getByRole("button", { name: "Don't ask again" }).click();
	await expect(page.getByText("Rating prompt dismissed.")).toBeVisible();

	const queuedResponse = await page.context().request.post("/api/exams", {
		data: {
			title: "Queued rating guard",
			topics: ["Limits", "Continuity"],
			questionCount: 2,
			mode: "standard",
		},
	});
	expect(queuedResponse.status()).toBe(201);
	const queuedPayload = (await queuedResponse.json()) as { examId: string };

	await page.goto(`/exams/${queuedPayload.examId}`);
	await expect(
		page.getByRole("heading", { level: 1, name: "Queued rating guard" }),
	).toBeVisible();
	await expect(page.getByText("Manual topics - 2 questions - queued")).toBeVisible();
	await expect(page.getByText("Artifact rating")).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Report issue" })).toHaveCount(0);

	const rejectedRatingResponse = await page
		.context()
		.request.patch(`/api/exams/${queuedPayload.examId}`, {
			data: {
				rating: 5,
				feedbackText: "Queued exams cannot be rated.",
			},
		});
	expect(rejectedRatingResponse.status()).toBe(400);
	const rejectedRatingPayload = (await rejectedRatingResponse.json()) as { error?: string };
	expect(rejectedRatingPayload.error).toContain("completed exams");

	const rejectedReportResponse = await page
		.context()
		.request.patch(`/api/exams/${queuedPayload.examId}`, {
			data: {
				reportReason: "Queued exams should not enter abuse review before completion.",
			},
		});
	expect(rejectedReportResponse.status()).toBe(400);
	const rejectedReportPayload = (await rejectedReportResponse.json()) as { error?: string };
	expect(rejectedReportPayload.error).toContain("completed exams");

	const exportResponse = await page.context().request.get("/api/settings/export");
	expect(exportResponse.status()).toBe(200);
	const exportPayload = (await exportResponse.json()) as {
		exams?: {
			id?: string;
			rating?: number;
			feedbackText?: string | null;
			ratedAt?: unknown;
			ratingDismissedAt?: unknown;
		}[];
	};
	const ratedExam = exportPayload.exams?.find((exam) => exam.id === examId);
	expect(ratedExam?.rating).toBe(4);
	expect(ratedExam?.feedbackText).toBe(ratingFeedback);
	expect(ratedExam?.ratedAt).toBeTruthy();
	const dismissedExam = exportPayload.exams?.find((exam) => exam.id === dismissExamId);
	expect(dismissedExam?.ratingDismissedAt).toBeTruthy();

	await signInAsAdminAgent(page);
	await page.goto("/admin/communications");
	await expect(page.getByText(`Exam rating: ${ratingExamTitle}`)).toBeVisible();
	await expect(page.getByText(ratingFeedback)).toBeVisible();
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
				visualFeedbackLatex?: string;
				visualFeedbackSourceMode?: string;
				visualFeedbackSourceExcerpt?: string;
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
	expect(completedAttempt?.visualFeedbackSourceMode).toBe("submission_overlay");
	expect(completedAttempt?.visualFeedbackSourceExcerpt).toContain("Question 1");
	expect(completedAttempt?.visualFeedbackLatex).toContain("Annotated submitted work");
	expect(completedAttempt?.visualFeedbackLatex).toContain("Question 1");
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

	const reportResponse = await page
		.context()
		.request.patch(`/api/exams/${createPayload.examId}`, {
			data: { reportReason: "Generated exam refund regression coverage." },
		});
	expect(reportResponse.status()).toBe(200);
	const refundExportResponse = await page.context().request.get("/api/settings/export");
	expect(refundExportResponse.status()).toBe(200);
	const refundPayload = (await refundExportResponse.json()) as {
		profile: {
			credits?: number;
			reservedCredits?: number;
			totalCreditsConsumed?: number;
			totalCreditsRefunded?: number;
		} | null;
		exams: {
			id: string;
			status?: string;
			creditsConsumed?: number;
			creditsRefundedAmount?: number;
			creditsRefundedAt?: unknown;
		}[];
		notifications: { title?: string; kind?: string }[];
	};
	expect(refundPayload.profile?.credits).toBe(24);
	expect(refundPayload.profile?.reservedCredits).toBe(0);
	expect(refundPayload.profile?.totalCreditsConsumed).toBe(24);
	expect(refundPayload.profile?.totalCreditsRefunded).toBe(24);
	const reportedExam = refundPayload.exams.find((exam) => exam.id === createPayload.examId);
	expect(reportedExam?.status).toBe("reported");
	expect(reportedExam?.creditsConsumed).toBe(24);
	expect(reportedExam?.creditsRefundedAmount).toBe(24);
	expect(reportedExam?.creditsRefundedAt).toBeTruthy();
	expect(refundPayload.notifications).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ title: "Credits refunded", kind: "exam" }),
		]),
	);

	const duplicateReportResponse = await page
		.context()
		.request.patch(`/api/exams/${createPayload.examId}`, {
			data: { reportReason: "Second report should not double-refund credits." },
		});
	expect(duplicateReportResponse.status()).toBe(200);
	const duplicateRefundExport = await page.context().request.get("/api/settings/export");
	expect(duplicateRefundExport.status()).toBe(200);
	const duplicateRefundPayload = (await duplicateRefundExport.json()) as {
		profile: {
			credits?: number;
			totalCreditsRefunded?: number;
		} | null;
	};
	expect(duplicateRefundPayload.profile?.credits).toBe(24);
	expect(duplicateRefundPayload.profile?.totalCreditsRefunded).toBe(24);
});

test("LaTeX 503 retry completes generation without duplicate credits or QA budget", async ({
	page,
}) => {
	test.setTimeout(180_000);
	const title = `LATEX_RETRY_CHAOS worker exam ${Date.now()}`;
	const { uid } = await signInAsTestUser(page, `latex-chaos-${Date.now()}@exampull.test`, {
		tier: "free",
		credits: 6,
	});
	const createResponse = await page.context().request.post("/api/exams", {
		data: {
			title,
			className: "Chaos Biology",
			topics: ["Feedback loops"],
			questionCount: 1,
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
	await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
	await expect(page.getByText("Chaos Biology - 1 questions - Complete")).toBeVisible();
	await expect(page.getByRole("link", { name: "Exam PDF" })).toBeVisible();

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
			qaIterations?: { exam?: number; answerKey?: number };
			examPdfStoragePath?: string;
			answerKeyPdfStoragePath?: string;
			examPdfBase64?: string;
			answerKeyPdfBase64?: string;
		}[];
	};
	expect(exportPayload.profile?.credits).toBe(4);
	expect(exportPayload.profile?.reservedCredits).toBe(0);
	expect(exportPayload.profile?.totalCreditsConsumed).toBe(2);
	const completedExam = exportPayload.exams.find((exam) => exam.id === createPayload.examId);
	expect(completedExam?.status).toBe("complete");
	expect(completedExam?.creditsReserved).toBe(0);
	expect(completedExam?.creditsConsumed).toBe(2);
	expect(completedExam?.qaIterations).toEqual({ exam: 1, answerKey: 1 });
	expect(completedExam?.examPdfStoragePath).toContain("/artifacts/exam.pdf");
	expect(completedExam?.answerKeyPdfStoragePath).toContain("/artifacts/answer.pdf");
	expect(completedExam?.examPdfBase64?.length).toBeGreaterThan(100);
	expect(completedExam?.answerKeyPdfBase64?.length).toBeGreaterThan(100);
});

test("scholar user can complete a full worker generation with answer key", async ({ page }) => {
	test.setTimeout(180_000);
	const { uid } = await signInAsTestUser(page, `worker-scholar-${Date.now()}@exampull.test`, {
		tier: "scholar",
		credits: 50,
	});
	const createResponse = await page.context().request.post("/api/exams", {
		data: {
			title: "Worker completed scholar exam",
			className: "Worker Calculus",
			topics: ["Taylor series", "Convergence", "Power series"],
			questionCount: 8,
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
		page.getByRole("heading", { level: 1, name: "Worker completed scholar exam" }),
	).toBeVisible();
	await expect(page.getByText("Worker Calculus - 8 questions - Complete")).toBeVisible();
	await expect(page.getByRole("link", { name: "Exam PDF" })).toBeVisible();
	await expect(page.getByRole("link", { name: "Answer key" })).toBeVisible();
	const answerResponse = await page
		.context()
		.request.get(`/api/exams/${createPayload.examId}/download?type=answer`);
	expect(answerResponse.status()).toBe(200);
	expect(answerResponse.headers()["content-type"]).toContain("application/pdf");

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
			answerKeyUnlocked?: boolean;
			examPdfBase64?: string;
			answerKeyPdfBase64?: string;
		}[];
	};
	expect(exportPayload.profile?.credits).toBe(34);
	expect(exportPayload.profile?.reservedCredits).toBe(0);
	expect(exportPayload.profile?.totalCreditsConsumed).toBe(16);
	const completedExam = exportPayload.exams.find((exam) => exam.id === createPayload.examId);
	expect(completedExam?.status).toBe("complete");
	expect(completedExam?.creditsReserved).toBe(0);
	expect(completedExam?.creditsConsumed).toBe(16);
	expect(completedExam?.answerKeyUnlocked).toBe(true);
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
	await page
		.getByRole("button", { name: "Drag question 2" })
		.dragTo(page.getByTestId("power-slot-1"));
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

test("mobile user can tap reorder and bulk edit Power Mode slots", async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== "mobile-safari", "Mobile Power Mode coverage.");

	await signInAsTestUser(page, `mobile-power-${Date.now()}@exampull.test`, {
		tier: "scholar",
		credits: 100,
	});

	await page.goto("/exams/new");
	await page.getByLabel("Exam title").fill("Mobile Power Mode exam");
	await page.getByLabel("Class label").fill("AP Biology Mobile");
	await page
		.getByRole("textbox", { name: "Topics" })
		.fill("Photosynthesis\nCalvin cycle\nCellular respiration");
	await page.getByRole("button", { name: "Power" }).click();
	await page.getByLabel("Question 1 topic").fill("Photosynthesis");
	await page.getByRole("button", { name: "Add slot" }).click();
	await page.getByLabel("Question 2 topic").fill("Calvin cycle");
	const moveButtonBox = await page
		.getByRole("button", { name: "Move question 2 up" })
		.boundingBox();
	if (!moveButtonBox) {
		throw new Error("Mobile Power Mode move button did not render.");
	}
	expect(moveButtonBox.width).toBeGreaterThanOrEqual(44);
	expect(moveButtonBox.height).toBeGreaterThanOrEqual(44);
	await page.getByRole("button", { name: "Move question 2 up" }).click();
	await expect(page.getByLabel("Question 1 topic")).toHaveValue("Calvin cycle");
	await expect(page.getByLabel("Question 2 topic")).toHaveValue("Photosynthesis");

	await page.getByLabel("Range start").fill("1");
	await page.getByLabel("Range end").fill("2");
	await page.getByLabel("Range style").selectOption("essay");
	await page.getByLabel("Range difficulty").selectOption("hardcore");
	await page.getByLabel("Range points").fill("9");
	await page.getByRole("button", { name: "Apply range" }).click();
	await expect(page.getByLabel("Question 1 style")).toHaveValue("essay");
	await expect(page.getByLabel("Question 2 style")).toHaveValue("essay");
	await expect(page.getByLabel("Question 1 difficulty")).toHaveValue("hardcore");
	await expect(page.getByLabel("Question 2 points")).toHaveValue("9");

	await page.getByRole("button", { name: "Generate", exact: true }).click();
	await expect(
		page.getByRole("heading", { level: 1, name: "Mobile Power Mode exam" }),
	).toBeVisible();
	await expect(page.getByText("AP Biology Mobile - 2 questions - queued")).toBeVisible();
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

test("long PDF upload shows TOC progress and extracts focused topics", async ({ page }) => {
	const { uid } = await signInAsTestUser(page, `long-pdf-${Date.now()}@exampull.test`, {
		tier: "guru",
		credits: 100,
	});
	const focus = "synaptic plasticity";
	const pages = [
		"Table of Contents\n1 Neural signaling\n2 Synaptic plasticity\n3 Memory consolidation",
		"Neural signaling overview\nAction potentials and neurotransmitter release",
		"Synaptic plasticity\nLong-term potentiation\nHebbian learning\nAMPA receptor trafficking",
		"Memory consolidation\nSystems consolidation and retrieval practice",
		"Practice prompts\nExplain synaptic plasticity mechanisms with worked examples",
	];
	const pdf = textPdfBuffer(pages);
	const startResponse = await page.context().request.post("/api/exam-uploads", {
		data: {
			filename: "neuroscience-long-unit.pdf",
			contentType: "application/pdf",
			sizeBytes: pdf.byteLength,
			focus,
			styleReference: false,
		},
	});
	expect(startResponse.status()).toBe(201);
	const startPayload = (await startResponse.json()) as { uploadId: string; uploadUrl: string };
	const uploadResponse = await page.context().request.put(startPayload.uploadUrl, {
		headers: { "Content-Type": "application/pdf" },
		data: pdf.toString("utf8"),
	});
	expect(uploadResponse.status()).toBe(200);

	const progressResponse = await page.context().request.post("/api/test/seed", {
		data: {
			token: testSignupToken(),
			kind: "exam_upload_progress",
			uploadId: startPayload.uploadId,
			stage: "reading_toc",
			detail: "Reading table of contents and document headings",
			percent: 35,
			pagesRead: 2,
			totalPages: pages.length,
		},
	});
	expect(progressResponse.status()).toBe(200);

	await page.addInitScript(
		({ uploadId, sizeBytes, uploadFocus }) => {
			window.localStorage.setItem(
				"exampull:new-exam-draft",
				JSON.stringify({
					title: "Long PDF focused exam",
					className: "Neuroscience",
					sourceUploads: [
						{
							id: uploadId,
							filename: "neuroscience-long-unit.pdf",
							contentType: "application/pdf",
							sizeBytes,
							focus: uploadFocus,
							status: "extracting_topics",
							styleReference: false,
							extractedTopics: [],
							extractionProgress: {
								stage: "reading_toc",
								detail: "Reading table of contents and document headings",
								percent: 35,
								pagesRead: 2,
								totalPages: 5,
							},
							createdAt: new Date().toISOString(),
							uploadedAt: new Date().toISOString(),
						},
					],
					topicsText: "",
					sourceNotes: "",
					questionCount: 12,
					mode: "standard",
					powerSlots: [],
					mirrorInstructorStyle: true,
					useScholarBoost: false,
				}),
			);
		},
		{ uploadId: startPayload.uploadId, sizeBytes: pdf.byteLength, uploadFocus: focus },
	);

	await page.goto("/exams/new");
	await expect(page.getByText("neuroscience-long-unit.pdf")).toBeVisible();
	await expect(page.getByText("Reading table of contents and document headings")).toBeVisible();
	await expect(page.getByText("2 of 5 pages read")).toBeVisible();
	await expect(
		page.getByRole("progressbar", { name: "neuroscience-long-unit.pdf extraction progress" }),
	).toHaveAttribute("aria-valuenow", "35");

	const workerResponse = await page.context().request.post("/api/workers/extract-upload-topics", {
		data: { userId: uid, uploadId: startPayload.uploadId, tier: "guru" },
	});
	expect(workerResponse.status()).toBe(200);
	const workerPayload = (await workerResponse.json()) as {
		topics?: string[];
		warning?: string;
		error?: string;
	};
	expect(workerPayload.warning, workerPayload.error).toBeUndefined();
	expect(workerPayload.topics).toEqual(
		expect.arrayContaining([
			focus,
			`${focus} worked examples`,
			`${focus} application problems`,
		]),
	);

	await expect(page.getByText("Topic extraction complete")).toBeVisible({ timeout: 15000 });
	await expect(page.getByText("5 of 5 pages read")).toBeVisible();
	await expect(page.getByText(/topics extracted/)).toBeVisible();
	await expect(page.getByText("5 topics ready")).toBeVisible();
});

test("scanned PDF upload renders page images for multimodal topic extraction", async ({ page }) => {
	const { uid } = await signInAsTestUser(page, `scanned-pdf-${Date.now()}@exampull.test`, {
		tier: "guru",
		credits: 100,
	});
	const focus = "histology slide interpretation";
	const pdf = blankPdfBuffer();
	const startResponse = await page.context().request.post("/api/exam-uploads", {
		data: {
			filename: "scanned-histology-notes.pdf",
			contentType: "application/pdf",
			sizeBytes: pdf.byteLength,
			focus,
			styleReference: false,
		},
	});
	expect(startResponse.status()).toBe(201);
	const startPayload = (await startResponse.json()) as { uploadId: string; uploadUrl: string };
	const uploadResponse = await page.context().request.put(startPayload.uploadUrl, {
		headers: { "Content-Type": "application/pdf" },
		data: pdf,
	});
	expect(uploadResponse.status()).toBe(200);
	const completeResponse = await page
		.context()
		.request.patch(`/api/exam-uploads/${startPayload.uploadId}`, {
			data: { status: "uploaded" },
		});
	expect(completeResponse.status()).toBe(200);

	const workerResponse = await page.context().request.post("/api/workers/extract-upload-topics", {
		data: { userId: uid, uploadId: startPayload.uploadId, tier: "guru" },
	});
	expect(workerResponse.status()).toBe(200);
	const workerPayload = (await workerResponse.json()) as {
		topics?: string[];
		extractedContext?: string;
		warning?: string;
	};
	expect(workerPayload.warning).toBeUndefined();
	expect(workerPayload.extractedContext).toContain(focus);
	expect(workerPayload.topics).toEqual(
		expect.arrayContaining([
			focus,
			`${focus} worked examples`,
			`${focus} application problems`,
		]),
	);

	const uploadsResponse = await page
		.context()
		.request.get(`/api/exam-uploads?ids=${startPayload.uploadId}`);
	expect(uploadsResponse.status()).toBe(200);
	const uploadsPayload = (await uploadsResponse.json()) as {
		uploads: {
			id: string;
			status?: string;
			extractedContextExcerpt?: string | null;
			renderedImagePageCount?: number | null;
			extractionProgress?: {
				pagesRead?: number | null;
				totalPages?: number | null;
			} | null;
		}[];
	};
	const upload = uploadsPayload.uploads.find((item) => item.id === startPayload.uploadId);
	expect(upload?.status).toBe("ready");
	expect(upload?.extractedContextExcerpt).toContain(focus);
	expect(upload?.renderedImagePageCount).toBe(1);
	expect(upload?.extractionProgress?.pagesRead).toBe(1);
	expect(upload?.extractionProgress?.totalPages).toBe(1);

	const exportResponse = await page.context().request.get("/api/settings/export");
	expect(exportResponse.status()).toBe(200);
	const exportPayload = (await exportResponse.json()) as {
		examUploads?: {
			id?: string;
			extractedContext?: string;
		}[];
	};
	const exportedUpload = exportPayload.examUploads?.find(
		(item) => item.id === startPayload.uploadId,
	);
	expect(exportedUpload?.extractedContext).toContain(focus);
});

test("new exam wizard preserves source topic and configure drafts across refresh", async ({
	page,
}) => {
	await signInAsTestUser(page, `wizard-refresh-${Date.now()}@exampull.test`, {
		tier: "guru",
		credits: 500,
	});

	await page.goto("/exams/new");
	await page.getByLabel("Exam title").fill("Refresh preserved exam");
	await page.getByLabel("Class label").fill("Chaos Biology");
	await page.getByLabel("Focus for next upload").fill("Chapters 4-6 only");
	await page.getByLabel("Style reference").check();
	await page.reload();
	await expect(page.getByLabel("Exam title")).toHaveValue("Refresh preserved exam");
	await expect(page.getByLabel("Class label")).toHaveValue("Chaos Biology");
	await expect(page.getByLabel("Focus for next upload")).toHaveValue("Chapters 4-6 only");
	await expect(page.getByLabel("Style reference")).toBeChecked();

	await page
		.getByRole("textbox", { name: "Topics" })
		.fill("Cell signaling\nSignal transduction\nSecond messengers");
	await page
		.getByLabel("Source notes")
		.fill("Favor diagram interpretation and multi-step pathway reasoning.");
	await page.reload();
	await expect(page.getByRole("textbox", { name: "Topics" })).toHaveValue(
		"Cell signaling\nSignal transduction\nSecond messengers",
	);
	await expect(page.getByLabel("Source notes")).toHaveValue(
		"Favor diagram interpretation and multi-step pathway reasoning.",
	);

	await page.getByRole("button", { name: "Power" }).click();
	await page.getByLabel("Quick-add topic").fill("Signal transduction");
	await page.getByLabel("Quick-add count").fill("2");
	await page.getByLabel("Quick-add style").selectOption("calculation");
	await page.getByLabel("Quick-add difficulty").selectOption("hardcore");
	await page.getByLabel("Quick-add points").fill("12");
	await page.getByLabel("Range topic").fill("Second messengers");
	await page.getByLabel("Range points").fill("9");
	await page.reload();
	await expect(page.getByLabel("Quick-add topic")).toHaveValue("Signal transduction");
	await expect(page.getByLabel("Quick-add count")).toHaveValue("2");
	await expect(page.getByLabel("Quick-add style")).toHaveValue("calculation");
	await expect(page.getByLabel("Quick-add difficulty")).toHaveValue("hardcore");
	await expect(page.getByLabel("Quick-add points")).toHaveValue("12");
	await expect(page.getByLabel("Range topic")).toHaveValue("Second messengers");
	await expect(page.getByLabel("Range points")).toHaveValue("9");

	await page.getByRole("button", { name: "Remove question 1" }).click();
	await page.getByRole("button", { name: "Quick-add" }).click();
	await expect(page.getByLabel("Question 1 topic")).toHaveValue("Signal transduction");
	await page.getByLabel("Question 1 topic").fill("Receptor tyrosine kinase signaling");
	await page.reload();
	await expect(page.getByLabel("Question 1 topic")).toHaveValue(
		"Receptor tyrosine kinase signaling",
	);
	await expect(page.getByLabel("Question 2 points")).toHaveValue("12");

	await page.getByRole("button", { name: "Generate", exact: true }).click();
	await expect(
		page.getByRole("heading", { level: 1, name: "Refresh preserved exam" }),
	).toBeVisible();
	await expect(page.getByText("Chaos Biology - 2 questions - queued")).toBeVisible();
	const storedDraft = await page.evaluate(() =>
		window.localStorage.getItem("exampull:new-exam-draft"),
	);
	expect(storedDraft).toBeNull();
});

test("topic extraction failure keeps best-effort source topics available", async ({ page }) => {
	const { uid } = await signInAsTestUser(page, `fallback-source-${Date.now()}@exampull.test`, {
		tier: "free",
		credits: 24,
	});
	const startResponse = await page.context().request.post("/api/exam-uploads", {
		data: {
			filename: "missing extraction source.txt",
			contentType: "text/plain",
			sizeBytes: 128,
			focus: "eigenvalue stability",
			styleReference: false,
		},
	});
	expect(startResponse.status()).toBe(201);
	const startPayload = (await startResponse.json()) as { uploadId: string };

	const completeResponse = await page
		.context()
		.request.patch(`/api/exam-uploads/${startPayload.uploadId}`, {
			data: { status: "uploaded" },
		});
	expect(completeResponse.status()).toBe(200);

	const workerResponse = await page.context().request.post("/api/workers/extract-upload-topics", {
		data: { userId: uid, uploadId: startPayload.uploadId, tier: "free" },
	});
	expect(workerResponse.status()).toBe(200);
	const workerPayload = (await workerResponse.json()) as {
		topics?: string[];
		warning?: string;
	};
	expect(workerPayload.warning).toBe("best_effort");
	expect(workerPayload.topics).toEqual(
		expect.arrayContaining(["missing", "extraction", "source", "eigenvalue", "stability"]),
	);

	const uploadsResponse = await page
		.context()
		.request.get(`/api/exam-uploads?ids=${startPayload.uploadId}`);
	expect(uploadsResponse.status()).toBe(200);
	const uploadsPayload = (await uploadsResponse.json()) as {
		uploads: {
			id: string;
			status?: string;
			extractedTopics?: string[];
		}[];
	};
	const upload = uploadsPayload.uploads.find((item) => item.id === startPayload.uploadId);
	expect(upload?.status).toBe("ready_with_warnings");
	expect(upload?.extractedTopics).toEqual(workerPayload.topics);

	const createResponse = await page.context().request.post("/api/exams", {
		data: {
			title: "Fallback extraction exam",
			topics: ["Manual fallback synthesis"],
			questionCount: 12,
			mode: "standard",
			adHocUploadIds: [startPayload.uploadId],
		},
	});
	expect(createResponse.status()).toBe(201);
	const createPayload = (await createResponse.json()) as { examId: string };

	await page.goto(`/exams/${createPayload.examId}`);
	await expect(
		page.getByRole("heading", { level: 1, name: "Fallback extraction exam" }),
	).toBeVisible();
	const detailText = await page.locator("body").innerText();
	expect(detailText).toContain("missing extraction source.txt");
	expect(detailText).toContain("5 extracted topics");
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

test("Scholar Boost is atomically consumed across two tabs and restored on report", async ({
	page,
}) => {
	await signInAsTestUser(page, `boost-race-${Date.now()}@exampull.test`, {
		tier: "free",
		credits: 40,
	});
	await seedExam(page, "Prior exam unlocks boost");
	const secondTab = await page.context().newPage();
	const boostPayload = {
		title: "Two-tab Scholar Boost exam",
		className: "Boost Race",
		topics: ["Limits", "Continuity", "Derivatives"],
		questionCount: 25,
		mode: "standard",
		useScholarBoost: true,
	};

	await page.goto("/exams/new");
	await secondTab.goto("/exams/new");
	await expect(page.getByText("Boost this exam to Scholar for free")).toBeVisible();
	await expect(secondTab.getByText("Boost this exam to Scholar for free")).toBeVisible();

	const [firstResponse, secondResponse] = await Promise.all([
		page.context().request.post("/api/exams", { data: boostPayload }),
		secondTab.context().request.post("/api/exams", { data: boostPayload }),
	]);
	const responses = [
		{ status: firstResponse.status(), payload: await firstResponse.json() },
		{ status: secondResponse.status(), payload: await secondResponse.json() },
	] as {
		status: number;
		payload: { examId?: string; error?: string };
	}[];
	const winning = responses.find((response) => response.status === 201);
	const rejected = responses.find((response) => response.status !== 201);

	expect(winning?.payload.examId).toBeTruthy();
	expect(rejected?.status).toBe(400);
	expect(rejected?.payload.error).toContain("Scholar Boost has already been used");

	const examId = winning?.payload.examId ?? "";
	const startAttempt = await page.context().request.post(`/api/exams/${examId}/attempts`, {
		data: {
			filename: "boost-covered-attempt.txt",
			contentType: "text/plain",
			sizeBytes: 64,
			visualAnnotations: false,
		},
	});
	expect(startAttempt.status()).toBe(201);
	const attemptPayload = (await startAttempt.json()) as { attemptId: string; uploadUrl: string };
	const uploadAttempt = await page.context().request.put(attemptPayload.uploadUrl, {
		headers: { "Content-Type": "text/plain" },
		data: "I attempted each question and showed the main derivative steps.",
	});
	expect(uploadAttempt.status()).toBe(200);
	const completeAttempt = await page
		.context()
		.request.patch(`/api/exams/${examId}/attempts/${attemptPayload.attemptId}`, {
			data: { status: "uploaded" },
		});
	expect(completeAttempt.status()).toBe(200);
	const completeAttemptPayload = (await completeAttempt.json()) as { creditsReserved?: number };
	expect(completeAttemptPayload.creditsReserved).toBe(0);

	const exportBeforeReport = await page.context().request.get("/api/settings/export");
	expect(exportBeforeReport.status()).toBe(200);
	const beforePayload = (await exportBeforeReport.json()) as {
		profile: {
			credits?: number;
			reservedCredits?: number;
			boostExamId?: string;
			boostGradingAttemptId?: string;
		} | null;
		exams: {
			id: string;
			boostedScholar?: boolean;
			answerKeyUnlocked?: boolean;
			boostGradingIncluded?: boolean;
			creditsReserved?: number;
		}[];
	};
	expect(beforePayload.profile?.credits).toBe(40);
	expect(beforePayload.profile?.reservedCredits).toBe(0);
	expect(beforePayload.profile?.boostExamId).toBe(examId);
	expect(beforePayload.profile?.boostGradingAttemptId).toBe(attemptPayload.attemptId);
	const boostedExam = beforePayload.exams.find((exam) => exam.id === examId);
	expect(boostedExam?.boostedScholar).toBe(true);
	expect(boostedExam?.answerKeyUnlocked).toBe(true);
	expect(boostedExam?.boostGradingIncluded).toBe(true);
	expect(boostedExam?.creditsReserved).toBe(0);

	const completeBoostResponse = await page.context().request.post("/api/test/seed", {
		data: {
			token: testSignupToken(),
			kind: "complete_exam",
			examId,
		},
	});
	expect(completeBoostResponse.status()).toBe(200);

	const reportResponse = await page.context().request.patch(`/api/exams/${examId}`, {
		data: { reportReason: "Boost regret recovery E2E report reason." },
	});
	expect(reportResponse.status()).toBe(200);

	const retryBoost = await page.context().request.post("/api/exams", {
		data: {
			...boostPayload,
			title: "Recovered Scholar Boost exam",
			topics: ["Integrals", "Area", "Accumulation"],
		},
	});
	expect(retryBoost.status()).toBe(201);
	const retryPayload = (await retryBoost.json()) as { examId: string };

	const exportAfterReport = await page.context().request.get("/api/settings/export");
	expect(exportAfterReport.status()).toBe(200);
	const afterPayload = (await exportAfterReport.json()) as {
		profile: {
			credits?: number;
			boostExamId?: string;
		} | null;
		exams: {
			id: string;
			status?: string;
			boostRefundedAt?: unknown;
			boostedScholar?: boolean;
		}[];
	};
	expect(afterPayload.profile?.credits).toBe(40);
	expect(afterPayload.profile?.boostExamId).toBe(retryPayload.examId);
	const reportedExam = afterPayload.exams.find((exam) => exam.id === examId);
	const recoveredExam = afterPayload.exams.find((exam) => exam.id === retryPayload.examId);
	expect(reportedExam?.status).toBe("reported");
	expect(reportedExam?.boostRefundedAt).toBeTruthy();
	expect(recoveredExam?.boostedScholar).toBe(true);

	await secondTab.close();
});

test("signed Stripe billing webhooks grant credits, change tiers, and remain idempotent", async ({
	page,
}) => {
	const { uid } = await signInAsTestUser(page, `billing-webhook-${Date.now()}@exampull.test`, {
		tier: "free",
		credits: 40,
	});
	const suffix = Date.now();
	const unsignedResponse = await page.context().request.post("/api/webhooks/stripe", {
		headers: { "Content-Type": "application/json" },
		data: JSON.stringify({ id: `evt_unsigned_${suffix}`, type: "checkout.session.completed" }),
	});
	expect(unsignedResponse.status()).toBe(400);

	const subscriptionCheckout = {
		id: `evt_sub_checkout_${suffix}`,
		object: "event",
		type: "checkout.session.completed",
		data: {
			object: {
				id: `cs_sub_${suffix}`,
				object: "checkout.session",
				customer: `cus_${suffix}`,
				subscription: `sub_${suffix}`,
				metadata: {
					userId: uid,
					purchaseType: "subscription",
					tier: "guru",
					interval: "month",
				},
			},
		},
	};
	expect((await postSignedStripeEvent(page, subscriptionCheckout)).status()).toBe(200);

	const creditCheckout = {
		id: `evt_credit_checkout_${suffix}`,
		object: "event",
		type: "checkout.session.completed",
		data: {
			object: {
				id: `cs_credit_${suffix}`,
				object: "checkout.session",
				customer: `cus_${suffix}`,
				metadata: {
					userId: uid,
					purchaseType: "credits",
					credits: "100",
				},
			},
		},
	};
	expect((await postSignedStripeEvent(page, creditCheckout)).status()).toBe(200);
	expect((await postSignedStripeEvent(page, creditCheckout)).status()).toBe(200);

	const invoicePaid = {
		id: `evt_invoice_${suffix}`,
		object: "event",
		type: "invoice.paid",
		data: {
			object: {
				id: `in_${suffix}`,
				object: "invoice",
				billing_reason: "subscription_cycle",
				parent: {
					subscription_details: {
						metadata: {
							userId: uid,
							tier: "guru",
						},
					},
				},
			},
		},
	};
	expect((await postSignedStripeEvent(page, invoicePaid)).status()).toBe(200);
	expect((await postSignedStripeEvent(page, invoicePaid)).status()).toBe(200);

	const downgrade = {
		id: `evt_sub_downgrade_${suffix}`,
		object: "event",
		type: "customer.subscription.updated",
		data: {
			object: {
				id: `sub_${suffix}`,
				object: "subscription",
				status: "active",
				metadata: {
					userId: uid,
					tier: "scholar",
				},
			},
		},
	};
	expect((await postSignedStripeEvent(page, downgrade)).status()).toBe(200);
	const sharedExamId = await seedExam(page, `Downgrade grace shared exam ${suffix}`);
	const shareResponse = await page.context().request.post(`/api/exams/${sharedExamId}/share`, {
		data: { includeAnswerKey: true },
	});
	expect(shareResponse.status()).toBe(201);
	const sharePayload = (await shareResponse.json()) as { shareId: string };
	const answerKeyBeforePaymentFailure = await page
		.context()
		.request.get(`/api/share/${sharePayload.shareId}/download?type=answer`);
	expect(answerKeyBeforePaymentFailure.status()).toBe(200);

	const paymentFailed = {
		id: `evt_sub_past_due_${suffix}`,
		object: "event",
		type: "customer.subscription.updated",
		data: {
			object: {
				id: `sub_${suffix}`,
				object: "subscription",
				status: "past_due",
				latest_invoice: `in_failed_${suffix}`,
				metadata: {
					userId: uid,
					tier: "scholar",
				},
			},
		},
	};
	expect((await postSignedStripeEvent(page, paymentFailed)).status()).toBe(200);
	await page.goto("/billing");
	await expect(page.getByText("Payment needs attention before")).toBeVisible();
	const answerKeyDuringPaymentGrace = await page
		.context()
		.request.get(`/api/share/${sharePayload.shareId}/download?type=answer`);
	expect(answerKeyDuringPaymentGrace.status()).toBe(200);
	const graceExportResponse = await page.context().request.get("/api/settings/export");
	expect(graceExportResponse.status()).toBe(200);
	const graceExportPayload = (await graceExportResponse.json()) as {
		profile: {
			tier?: string;
			subscriptionStatus?: string;
			paymentFailureGraceUntil?: unknown;
		} | null;
		communications: { kind?: string; status?: string; channel?: string }[];
	};
	expect(graceExportPayload.profile?.tier).toBe("scholar");
	expect(graceExportPayload.profile?.subscriptionStatus).toBe("grace_period");
	expect(graceExportPayload.profile?.paymentFailureGraceUntil).toBeTruthy();
	expect(graceExportPayload.communications).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				kind: "payment_failure",
				channel: "email",
				status: "skipped_test",
			}),
			expect.objectContaining({
				kind: "payment_failure",
				channel: "sms",
				status: "skipped_test",
			}),
		]),
	);

	const expirePaymentGraceResponse = await page.context().request.post("/api/test/seed", {
		data: {
			token: testSignupToken(),
			kind: "expire_payment_failure_grace",
		},
	});
	expect(expirePaymentGraceResponse.status()).toBe(200);
	const expireWorkerResponse = await page
		.context()
		.request.post("/api/workers/expire-payment-grace", { data: { limit: 100 } });
	expect(expireWorkerResponse.status()).toBe(200);
	const expireWorkerPayload = (await expireWorkerResponse.json()) as {
		expired?: number;
		reminded?: number;
	};
	expect(expireWorkerPayload.expired).toBe(1);
	const answerKeyDuringShareGrace = await page
		.context()
		.request.get(`/api/share/${sharePayload.shareId}/download?type=answer`);
	expect(answerKeyDuringShareGrace.status()).toBe(200);

	const cancelled = {
		id: `evt_sub_cancel_${suffix}`,
		object: "event",
		type: "customer.subscription.deleted",
		data: {
			object: {
				id: `sub_${suffix}`,
				object: "subscription",
				status: "canceled",
				metadata: {
					userId: uid,
					tier: "scholar",
				},
			},
		},
	};
	expect((await postSignedStripeEvent(page, cancelled)).status()).toBe(200);
	const expireGraceResponse = await page.context().request.post("/api/test/seed", {
		data: {
			token: testSignupToken(),
			kind: "expire_share_answer_key_grace",
			shareId: sharePayload.shareId,
		},
	});
	expect(expireGraceResponse.status()).toBe(200);
	const answerKeyAfterGrace = await page
		.context()
		.request.get(`/api/share/${sharePayload.shareId}/download?type=answer`);
	expect(answerKeyAfterGrace.status()).toBe(404);

	const exportResponse = await page.context().request.get("/api/settings/export");
	expect(exportResponse.status()).toBe(200);
	const exportPayload = (await exportResponse.json()) as {
		profile: {
			tier?: string;
			credits?: number;
			subscriptionStatus?: string;
			stripeCustomerId?: string;
			stripeSubscriptionId?: string;
			paymentFailureDowngradedAt?: unknown;
		} | null;
		notifications: { title?: string; kind?: string }[];
		communications: {
			kind?: string;
			status?: string;
			shareIds?: string[];
			channel?: string;
		}[];
	};
	expect(exportPayload.profile?.tier).toBe("free");
	expect(exportPayload.profile?.credits).toBe(8100);
	expect(exportPayload.profile?.subscriptionStatus).toBe("canceled");
	expect(exportPayload.profile?.stripeCustomerId).toBe(`cus_${suffix}`);
	expect(exportPayload.profile?.stripeSubscriptionId).toBe(`sub_${suffix}`);
	expect(exportPayload.profile?.paymentFailureDowngradedAt).toBeTruthy();
	expect(exportPayload.notifications).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ title: "guru is active", kind: "billing" }),
			expect.objectContaining({ title: "Credits added", kind: "billing" }),
			expect.objectContaining({ title: "Monthly credits refreshed", kind: "billing" }),
			expect.objectContaining({ title: "Subscription updated", kind: "billing" }),
			expect.objectContaining({
				title: "Payment issue - grace period started",
				kind: "billing",
			}),
			expect.objectContaining({ title: "Payment grace expired", kind: "billing" }),
			expect.objectContaining({ title: "Share answer keys changing", kind: "share" }),
		]),
	);
	expect(exportPayload.communications).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				kind: "share_link_feature_change",
				status: "skipped_test",
				shareIds: [sharePayload.shareId],
			}),
			expect.objectContaining({
				kind: "payment_failure",
				channel: "email",
				status: "skipped_test",
			}),
			expect.objectContaining({
				kind: "payment_failure",
				channel: "sms",
				status: "skipped_test",
			}),
			expect.objectContaining({
				kind: "payment_failure_grace_expired",
				channel: "email",
				status: "skipped_test",
			}),
			expect.objectContaining({
				kind: "payment_failure_grace_expired",
				channel: "sms",
				status: "skipped_test",
			}),
		]),
	);

	await signInAsAdminAgent(page);
	await page.goto("/admin/communications");
	await expect(page.getByRole("heading", { name: "Outbound Communications" })).toBeVisible();
	await expect(page.getByText("Payment issue - grace period started").first()).toBeVisible();
	await expect(page.getByText("payment_failure").first()).toBeVisible();
	await expect(page.getByText("sms").first()).toBeVisible();
});

test("Stripe downgrade during generation preserves the exam tier snapshot", async ({ page }) => {
	test.setTimeout(180_000);
	const suffix = Date.now();
	const title = `Tier snapshot exam ${suffix}`;
	const { uid } = await signInAsTestUser(page, `tier-snapshot-${suffix}@exampull.test`, {
		tier: "scholar",
		credits: 20,
	});
	const createResponse = await page.context().request.post("/api/exams", {
		data: {
			title,
			className: "Snapshot Physics",
			topics: ["Damped oscillators", "Resonance"],
			questionCount: 2,
			mode: "standard",
		},
	});
	expect(createResponse.status()).toBe(201);
	const createPayload = (await createResponse.json()) as { examId: string };

	const downgrade = {
		id: `evt_snapshot_cancel_${suffix}`,
		object: "event",
		type: "customer.subscription.deleted",
		data: {
			object: {
				id: `sub_snapshot_${suffix}`,
				object: "subscription",
				status: "canceled",
				metadata: {
					userId: uid,
					tier: "scholar",
				},
			},
		},
	};
	expect((await postSignedStripeEvent(page, downgrade)).status()).toBe(200);

	const workerResponse = await page.context().request.post("/api/workers/generate-exam", {
		data: { userId: uid, examId: createPayload.examId },
	});
	expect(workerResponse.status()).toBe(200);

	await page.goto(`/exams/${createPayload.examId}`);
	await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
	await expect(page.getByText("Snapshot Physics - 2 questions - Complete")).toBeVisible();
	await expect(page.getByRole("link", { name: "Answer key" })).toBeVisible();
	const answerResponse = await page
		.context()
		.request.get(`/api/exams/${createPayload.examId}/download?type=answer`);
	expect(answerResponse.status()).toBe(200);
	expect(answerResponse.headers()["content-type"]).toContain("application/pdf");

	const exportResponse = await page.context().request.get("/api/settings/export");
	expect(exportResponse.status()).toBe(200);
	const exportPayload = (await exportResponse.json()) as {
		profile: {
			tier?: string;
			credits?: number;
			reservedCredits?: number;
			totalCreditsConsumed?: number;
			subscriptionStatus?: string;
		} | null;
		exams: {
			id: string;
			status?: string;
			tierAtGen?: string;
			answerKeyUnlocked?: boolean;
			creditsReserved?: number;
			creditsConsumed?: number;
		}[];
	};
	expect(exportPayload.profile?.tier).toBe("free");
	expect(exportPayload.profile?.subscriptionStatus).toBe("canceled");
	expect(exportPayload.profile?.credits).toBe(16);
	expect(exportPayload.profile?.reservedCredits).toBe(0);
	expect(exportPayload.profile?.totalCreditsConsumed).toBe(4);
	const completedExam = exportPayload.exams.find((exam) => exam.id === createPayload.examId);
	expect(completedExam?.status).toBe("complete");
	expect(completedExam?.tierAtGen).toBe("scholar");
	expect(completedExam?.answerKeyUnlocked).toBe(true);
	expect(completedExam?.creditsReserved).toBe(0);
	expect(completedExam?.creditsConsumed).toBe(4);
});

test("referrals reward real conversions, flag suspicious aliases, and allow admin overrides", async ({
	page,
}) => {
	const suffix = Date.now();
	const aliasBase = `referral-alias-${suffix}`;
	const referrerEmail = `${aliasBase}+owner@exampull.test`;
	const { uid: referrerUid } = await signInAsTestUser(page, referrerEmail, {
		tier: "free",
		credits: 40,
	});

	const initialExportResponse = await page.context().request.get("/api/settings/export");
	expect(initialExportResponse.status()).toBe(200);
	const initialExport = (await initialExportResponse.json()) as {
		profile: { referralCode?: string; credits?: number; tier?: string } | null;
	};
	const referralCode = initialExport.profile?.referralCode;
	expect(referralCode).toBeTruthy();

	const happyReferredUid = await signUpWithReferral(
		page,
		`referral-friend-${suffix}@exampull.test`,
		referralCode ?? "",
	);
	await queueOneQuestionExam(page, "Referral first exam reward");
	expect(
		(
			await postSignedStripeEvent(page, {
				id: `evt_referral_paid_${suffix}`,
				object: "event",
				type: "checkout.session.completed",
				data: {
					object: {
						id: `cs_referral_paid_${suffix}`,
						object: "checkout.session",
						customer: `cus_referral_${suffix}`,
						subscription: `sub_referral_${suffix}`,
						metadata: {
							userId: happyReferredUid,
							purchaseType: "subscription",
							tier: "guru",
							interval: "month",
						},
					},
				},
			})
		).status(),
	).toBe(200);

	await resumeExistingTestUser(page, referrerEmail);
	const rewardedExportResponse = await page.context().request.get("/api/settings/export");
	expect(rewardedExportResponse.status()).toBe(200);
	const rewardedExport = (await rewardedExportResponse.json()) as {
		profile: {
			credits?: number;
			tier?: string;
			referralScholarMonthsEarned?: number;
			referralGuruMonthsEarned?: number;
		} | null;
		notifications: { title?: string; kind?: string }[];
	};
	expect(rewardedExport.profile?.tier).toBe("guru");
	expect(rewardedExport.profile?.credits).toBe(4440);
	expect(rewardedExport.profile?.referralScholarMonthsEarned).toBe(1);
	expect(rewardedExport.profile?.referralGuruMonthsEarned).toBe(1);
	expect(rewardedExport.notifications).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ title: "Referral signed up", kind: "referral" }),
			expect.objectContaining({ title: "Referral reward earned", kind: "referral" }),
			expect.objectContaining({ title: "Referral upgraded", kind: "referral" }),
		]),
	);

	const suspiciousReferredUid = await signUpWithReferral(
		page,
		`${aliasBase}+friend@exampull.test`,
		referralCode ?? "",
	);
	await queueOneQuestionExam(page, "Suspicious referral held for review");
	await resumeExistingTestUser(page, referrerEmail);
	const heldExportResponse = await page.context().request.get("/api/settings/export");
	expect(heldExportResponse.status()).toBe(200);
	const heldExport = (await heldExportResponse.json()) as {
		profile: { credits?: number; referralScholarMonthsEarned?: number } | null;
		notifications: { title?: string; kind?: string }[];
	};
	expect(heldExport.profile?.credits).toBe(4440);
	expect(heldExport.profile?.referralScholarMonthsEarned).toBe(1);
	expect(heldExport.notifications).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ title: "Referral under review", kind: "referral" }),
		]),
	);

	await signInAsAdminAgent(page);
	await page.goto("/admin/referrals");
	const adminCsrfToken = await adminCsrfTokenFromPage(page);
	const suspiciousReferralRow = page.getByRole("row").filter({ hasText: suspiciousReferredUid });
	await expect(suspiciousReferralRow).toBeVisible();
	await expect(suspiciousReferralRow.getByText("same_email_alias")).toBeVisible();

	const suspiciousReferralId = `${referrerUid}_${suspiciousReferredUid}`;
	const grantResponse = await page
		.context()
		.request.patch(`/api/admin/referrals/${suspiciousReferralId}/override`, {
			headers: { "x-admin-csrf-token": adminCsrfToken },
			data: {
				action: "grant_scholar",
				reason: "Verified as a real classmate after review.",
			},
		});
	expect(grantResponse.status()).toBe(403);

	const reauthedGrantResponse = await page
		.context()
		.request.patch(`/api/admin/referrals/${suspiciousReferralId}/override`, {
			headers: {
				"x-admin-csrf-token": adminCsrfToken,
				"x-admin-reauth-password": adminAgentPassword(),
			},
			data: {
				action: "grant_scholar",
				reason: "Verified as a real classmate after review.",
			},
		});
	expect(reauthedGrantResponse.status()).toBe(200);
	const grantedExportResponse = await page.context().request.get("/api/settings/export");
	expect(grantedExportResponse.status()).toBe(200);
	const grantedExport = (await grantedExportResponse.json()) as {
		profile: { credits?: number; tier?: string; referralScholarMonthsEarned?: number } | null;
		notifications: { title?: string; kind?: string }[];
	};
	expect(grantedExport.profile?.tier).toBe("guru");
	expect(grantedExport.profile?.credits).toBe(4840);
	expect(grantedExport.profile?.referralScholarMonthsEarned).toBe(2);
	expect(grantedExport.notifications).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				title: "Referral reward manually granted",
				kind: "referral",
			}),
		]),
	);

	const revokeResponse = await page
		.context()
		.request.patch(`/api/admin/referrals/${suspiciousReferralId}/override`, {
			headers: {
				"x-admin-csrf-token": adminCsrfToken,
				"x-admin-reauth-password": adminAgentPassword(),
			},
			data: {
				action: "revoke_scholar",
				reason: "Confirmed referral abuse after manual review.",
			},
		});
	expect(revokeResponse.status()).toBe(200);
	const revokedExportResponse = await page.context().request.get("/api/settings/export");
	expect(revokedExportResponse.status()).toBe(200);
	const revokedExport = (await revokedExportResponse.json()) as {
		profile: { credits?: number; tier?: string; referralScholarMonthsEarned?: number } | null;
		notifications: { title?: string; kind?: string }[];
	};
	expect(revokedExport.profile?.tier).toBe("guru");
	expect(revokedExport.profile?.credits).toBe(4440);
	expect(revokedExport.profile?.referralScholarMonthsEarned).toBe(1);
	expect(revokedExport.notifications).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ title: "Referral reward revoked", kind: "referral" }),
		]),
	);
});

test("notification center handles event matrix read delete and clear actions", async ({ page }) => {
	await signInAsTestUser(page, `notification-matrix-${Date.now()}@exampull.test`, {
		tier: "guru",
		credits: 500,
	});
	const fixtures = [
		{
			title: "Exam ready notification",
			body: "Your generated exam is ready.",
			kind: "exam",
			href: "/exams",
		},
		{
			title: "Grading complete notification",
			body: "Your attempt feedback is ready.",
			kind: "grading",
			href: "/exams",
		},
		{
			title: "Payment receipt notification",
			body: "Your billing receipt is available.",
			kind: "billing",
			href: "/billing",
		},
		{
			title: "Referral milestone notification",
			body: "A referred friend generated an exam.",
			kind: "referral",
			href: "/settings",
		},
		{
			title: "Share-link flag notification",
			body: "A shared exam was reported by a viewer.",
			kind: "share",
			href: "/exams",
		},
		{
			title: "Account security notification",
			body: "A new sign-in source was linked.",
			kind: "account",
			href: "/settings",
		},
		{
			title: "Feedback reply notification",
			body: "The operator replied to your feedback.",
			kind: "feedback",
			href: "/feedback",
		},
	];

	for (const fixture of fixtures) {
		await seedNotification(page, fixture);
	}

	await page.goto("/dashboard");
	await expect(page.getByRole("link", { name: "Alerts, 7 unread notifications" })).toBeVisible();

	await page.goto("/notifications");
	for (const fixture of fixtures) {
		await expect(page.getByText(fixture.title)).toBeVisible();
	}

	await page.getByText("Exam ready notification").click();
	await expect(page).toHaveURL(/\/exams$/);
	let exportResponse = await page.context().request.get("/api/settings/export");
	expect(exportResponse.status()).toBe(200);
	let exportPayload = (await exportResponse.json()) as {
		profile: { unreadNotificationCount?: number } | null;
		notifications: { title?: string; read?: boolean }[];
	};
	expect(exportPayload.profile?.unreadNotificationCount).toBe(6);
	expect(
		exportPayload.notifications.find(
			(notification) => notification.title === "Exam ready notification",
		)?.read,
	).toBe(true);

	await page.goto("/notifications");
	await page.getByRole("button", { name: "Delete Referral milestone notification" }).click();
	await expect(page.getByText("Referral milestone notification")).toBeHidden();
	exportResponse = await page.context().request.get("/api/settings/export");
	expect(exportResponse.status()).toBe(200);
	exportPayload = (await exportResponse.json()) as {
		profile: { unreadNotificationCount?: number } | null;
		notifications: { title?: string; read?: boolean }[];
	};
	expect(exportPayload.profile?.unreadNotificationCount).toBe(5);
	expect(
		exportPayload.notifications.some(
			(notification) => notification.title === "Referral milestone notification",
		),
	).toBe(false);

	await page.getByRole("button", { name: "Mark all as read" }).click();
	await expect(page.getByText("Notifications marked read.")).toBeVisible();
	exportResponse = await page.context().request.get("/api/settings/export");
	expect(exportResponse.status()).toBe(200);
	exportPayload = (await exportResponse.json()) as {
		profile: { unreadNotificationCount?: number } | null;
		notifications: { title?: string; read?: boolean }[];
	};
	expect(exportPayload.profile?.unreadNotificationCount).toBe(0);
	expect(exportPayload.notifications.every((notification) => notification.read === true)).toBe(
		true,
	);

	await page.getByRole("button", { name: "Clear all" }).click();
	await expect(page.getByText("No notifications")).toBeVisible();
	exportResponse = await page.context().request.get("/api/settings/export");
	expect(exportResponse.status()).toBe(200);
	exportPayload = (await exportResponse.json()) as {
		profile: { unreadNotificationCount?: number } | null;
		notifications: { title?: string; read?: boolean }[];
	};
	expect(exportPayload.profile?.unreadNotificationCount).toBe(0);
	expect(exportPayload.notifications).toEqual([]);
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

test("deleted source class blocks cloning a completed exam", async ({ page }) => {
	await signInAsTestUser(page, `class-clone-block-${Date.now()}@exampull.test`);
	const className = "Deleted Clone Source";
	const createResponse = await page.context().request.post("/api/classes", {
		data: {
			name: className,
			institution: "ExamPull",
			educationLevel: 72,
			description: "Completed exams from this class should not clone after deletion.",
		},
	});
	expect(createResponse.status()).toBe(201);
	const createPayload = (await createResponse.json()) as { classId: string };
	const examId = await seedExam(page, "Class-backed complete exam", {
		classId: createPayload.classId,
		className,
	});

	const deleteResponse = await page
		.context()
		.request.delete(`/api/classes/${createPayload.classId}`);
	expect(deleteResponse.status()).toBe(200);

	await page.goto(`/exams/${examId}`);
	await expect(page.getByText("Manual topics - 2 questions - complete")).toBeVisible();
	await expect(
		page.getByText(
			"The class used to create this exam has been deleted, so it can't be cloned. You can create a new exam from scratch.",
		),
	).toBeVisible();
	await expect(page.getByRole("button", { name: "Create another like this" })).toHaveCount(0);

	const cloneResponse = await page.context().request.post(`/api/exams/${examId}/clone`);
	expect(cloneResponse.status()).toBe(400);
	const clonePayload = (await cloneResponse.json()) as { error?: string };
	expect(clonePayload.error).toContain("class used to create this exam has been deleted");
});

test("class deletion is blocked while a queued exam references it", async ({ page }) => {
	await signInAsTestUser(page, `class-delete-block-${Date.now()}@exampull.test`, {
		tier: "free",
		credits: 40,
	});
	const createResponse = await page.context().request.post("/api/classes", {
		data: {
			name: "In-flight Class",
			institution: "ExamPull",
			educationLevel: 70,
			description: "Deletion should wait for queued work.",
		},
	});
	expect(createResponse.status()).toBe(201);
	const createPayload = (await createResponse.json()) as { classId: string };
	const examResponse = await page.context().request.post("/api/exams", {
		data: {
			title: "Queued class-backed exam",
			classId: createPayload.classId,
			className: "In-flight Class",
			topics: ["Continuity", "Derivatives"],
			questionCount: 2,
			mode: "standard",
		},
	});
	expect(examResponse.status()).toBe(201);

	const deleteResponse = await page
		.context()
		.request.delete(`/api/classes/${createPayload.classId}`);
	expect(deleteResponse.status()).toBe(409);
	const deletePayload = (await deleteResponse.json()) as { error?: string };
	expect(deletePayload.error).toContain("still generating");

	const classResponse = await page.context().request.get(`/api/classes/${createPayload.classId}`);
	expect(classResponse.status()).toBe(200);
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
	await page.getByRole("button", { name: "Delete" }).click();
	await expect(page.getByRole("alertdialog", { name: "Delete selected exams?" })).toBeVisible();
	await page.getByRole("button", { name: "Confirm delete" }).click();
	await expect(page.getByLabel("Select Library entropy exam")).toHaveCount(0);
});
