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

export async function signInAsTestUser(
	page: Page,
	email: string,
	options: { tier?: "free" | "scholar" | "guru"; credits?: number } = {},
) {
	const token = testSignupToken();
	const createResponse = await page.context().request.post("/api/test/session", {
		data: {
			token,
			email,
			displayName: "ExamPull E2E",
			tier: options.tier ?? "guru",
			credits: options.credits ?? 500,
		},
	});
	expect(createResponse.status()).toBe(200);
	const createPayload = (await createResponse.json()) as {
		customToken: string;
		apiKey: string;
	};
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
	expect(identityResponse.status).toBe(200);
	const identityPayload = (await identityResponse.json()) as { idToken: string };
	const sessionResponse = await page.context().request.put("/api/test/session", {
		data: { token, idToken: identityPayload.idToken },
	});
	expect(sessionResponse.status()).toBe(200);
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
