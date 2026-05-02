import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

function envValue(name: string) {
	if (process.env[name]) {
		return process.env[name];
	}

	try {
		const envFile = readFileSync(".env.local", "utf8");
		const line = envFile
			.split("\n")
			.find((candidate) => candidate.trim().startsWith(`${name}=`));

		if (!line) {
			return undefined;
		}

		return line
			.slice(line.indexOf("=") + 1)
			.trim()
			.replace(/^["']|["']$/g, "");
	} catch {
		return undefined;
	}
}

export function testSignupToken() {
	const token = envValue("TEST_SIGNUP_TOKEN");
	expect(token, "TEST_SIGNUP_TOKEN must be set for authenticated E2E").toBeTruthy();

	return token ?? "";
}

export async function createTestAuthUser(
	page: Page,
	email: string,
	options: {
		tier?: "free" | "scholar" | "guru";
		credits?: number;
		phoneNumber?: string;
		authPhoneNumber?: boolean;
		writeUserDoc?: boolean;
		ageDays?: number;
	} = {},
) {
	const token = testSignupToken();
	const response = await page.context().request.post("/api/test/session", {
		data: {
			token,
			email,
			displayName: "ExamPull E2E",
			tier: options.tier ?? "guru",
			credits: options.credits ?? 500,
			phoneNumber: options.phoneNumber,
			authPhoneNumber: options.authPhoneNumber,
			writeUserDoc: options.writeUserDoc,
			ageDays: options.ageDays,
		},
	});
	expect(response.status()).toBe(200);

	return (await response.json()) as {
		uid: string;
		customToken: string;
		apiKey: string;
	};
}

export async function idTokenForCustomToken({
	customToken,
	apiKey,
}: {
	customToken: string;
	apiKey: string;
}) {
	const identityResponse = await fetch(
		`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				token: customToken,
				returnSecureToken: true,
			}),
		},
	);
	expect(identityResponse.status).toBe(200);
	const identityPayload = (await identityResponse.json()) as { idToken: string };

	return identityPayload.idToken;
}

export async function signInAsTestUser(
	page: Page,
	email: string,
	options: { tier?: "free" | "scholar" | "guru"; credits?: number; previewId?: string } = {},
) {
	const token = testSignupToken();
	const createPayload = await createTestAuthUser(page, email, {
		tier: options.tier,
		credits: options.credits,
	});
	const idToken = await idTokenForCustomToken(createPayload);
	const sessionResponse = await page.context().request.put("/api/test/session", {
		data: { token, idToken, previewId: options.previewId },
	});
	expect(sessionResponse.status()).toBe(200);
	const sessionPayload = (await sessionResponse.json()) as { claimedExamId?: string };

	return { uid: createPayload.uid, claimedExamId: sessionPayload.claimedExamId };
}

export async function seedExam(page: Page, title: string) {
	const response = await page.context().request.post("/api/test/seed", {
		data: {
			token: testSignupToken(),
			kind: "exam",
			title,
		},
	});
	expect(response.status()).toBe(200);
	const payload = (await response.json()) as { examId: string };

	return payload.examId;
}

export async function seedVisualAttempt(page: Page, examId: string) {
	const response = await page.context().request.post("/api/test/seed", {
		data: {
			token: testSignupToken(),
			kind: "visual_attempt",
			examId,
			filename: "guru-attempt.pdf",
		},
	});
	expect(response.status()).toBe(200);
	const payload = (await response.json()) as { attemptId: string };

	return payload.attemptId;
}
