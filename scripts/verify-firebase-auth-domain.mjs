#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function parseEnvFile(path) {
	if (!existsSync(path)) {
		return {};
	}

	return Object.fromEntries(
		readFileSync(path, "utf8")
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#") && line.includes("="))
			.map((line) => {
				const equalsIndex = line.indexOf("=");
				const key = line.slice(0, equalsIndex).trim();
				let value = line.slice(equalsIndex + 1).trim();

				if (
					(value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))
				) {
					value = value.slice(1, -1);
				}

				return [key, value];
			}),
	);
}

function readRequiredEnv(env, key) {
	const value = env[key];

	if (!value) {
		throw new Error(`${key} is required.`);
	}

	return value;
}

async function serviceAccountAccessToken(env) {
	const keyPath = env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH ?? env.GOOGLE_APPLICATION_CREDENTIALS;

	if (!keyPath || !existsSync(keyPath)) {
		return null;
	}

	const { GoogleAuth } = await import("google-auth-library");
	const auth = new GoogleAuth({
		keyFilename: keyPath,
		scopes: ["https://www.googleapis.com/auth/cloud-platform"],
	});
	const client = await auth.getClient();
	const token = await client.getAccessToken();

	if (!token.token) {
		throw new Error("Could not obtain an access token from the service account key.");
	}

	return token.token;
}

async function accessToken(env) {
	const serviceAccountToken = await serviceAccountAccessToken(env);

	if (serviceAccountToken) {
		return serviceAccountToken;
	}

	const gcloudCandidates = ["gcloud", join(homedir(), "google-cloud-sdk", "bin", "gcloud")];

	for (const gcloudCommand of gcloudCandidates) {
		try {
			return execFileSync(gcloudCommand, ["auth", "print-access-token"], {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			}).trim();
		} catch {
			// Try the next local credential source.
		}
	}

	return firebaseCliAccessToken();
}

function readFirebaseCliTokenConfig() {
	const tokenPath = join(homedir(), ".config", "configstore", "firebase-tools.json");

	if (!existsSync(tokenPath)) {
		throw new Error("Could not find Firebase CLI token config.");
	}

	const payload = JSON.parse(readFileSync(tokenPath, "utf8"));

	if (
		typeof payload !== "object" ||
		payload === null ||
		!("tokens" in payload) ||
		typeof payload.tokens !== "object" ||
		payload.tokens === null
	) {
		throw new Error("Firebase CLI token config is malformed.");
	}

	return payload.tokens;
}

function firebaseCliAccessToken() {
	let tokens = readFirebaseCliTokenConfig();
	const expiresAt = Number(tokens.expires_at ?? 0);

	if (Number.isFinite(expiresAt) && expiresAt < Date.now() + 60_000) {
		execFileSync("pnpm", ["exec", "firebase", "login:list", "--json"], {
			stdio: ["ignore", "ignore", "ignore"],
		});
		tokens = readFirebaseCliTokenConfig();
	}

	if (typeof tokens.access_token !== "string" || !tokens.access_token) {
		throw new Error("Could not read an access token from gcloud or Firebase CLI.");
	}

	return tokens.access_token;
}

async function readAuthConfig(projectId, token) {
	const response = await fetch(
		`https://identitytoolkit.googleapis.com/v2/projects/${encodeURIComponent(projectId)}/config`,
		{
			headers: { Authorization: `Bearer ${token}` },
		},
	);

	if (!response.ok) {
		throw new Error(`Identity Toolkit config read failed with ${response.status}.`);
	}

	const payload = await response.json();
	const authorizedDomains = Array.isArray(payload.authorizedDomains)
		? payload.authorizedDomains.filter((domain) => typeof domain === "string")
		: [];
	const phoneNumber = payload.signIn?.phoneNumber;
	const testPhoneNumbers =
		typeof phoneNumber?.testPhoneNumbers === "object" && phoneNumber.testPhoneNumbers !== null
			? phoneNumber.testPhoneNumbers
			: {};

	return {
		authorizedDomains,
		phoneNumberEnabled: phoneNumber?.enabled === true,
		testPhoneNumbers,
	};
}

async function writeAuthConfig(projectId, token, payload, updateMask) {
	const response = await fetch(
		`https://identitytoolkit.googleapis.com/v2/projects/${encodeURIComponent(projectId)}/config?updateMask=${encodeURIComponent(updateMask)}`,
		{
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		},
	);

	if (!response.ok) {
		throw new Error(`Identity Toolkit config patch failed with ${response.status}.`);
	}
}

function testPhoneConfig(env) {
	const phoneNumber = env.FIREBASE_TEST_PHONE_NUMBER;
	const code = env.FIREBASE_TEST_PHONE_CODE;

	if (!phoneNumber && !code) {
		return null;
	}

	if (!phoneNumber || !code) {
		throw new Error(
			"FIREBASE_TEST_PHONE_NUMBER and FIREBASE_TEST_PHONE_CODE must be set together.",
		);
	}

	return { phoneNumber, code };
}

const env = {
	...parseEnvFile(".env.local"),
	...process.env,
};
const projectId =
	env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
	env.FIREBASE_PROJECT_ID ??
	env.GCLOUD_PROJECT ??
	env.GOOGLE_CLOUD_PROJECT;
const webUrl = env.WEB_URL ?? env.NEXT_PUBLIC_WEB_URL;
const shouldWrite = process.argv.includes("--write");

try {
	const resolvedProjectId = projectId ?? readRequiredEnv(env, "NEXT_PUBLIC_FIREBASE_PROJECT_ID");
	const resolvedWebUrl = webUrl ?? readRequiredEnv(env, "WEB_URL");
	const hostname = new URL(resolvedWebUrl).hostname;
	const token = await accessToken(env);
	const config = await readAuthConfig(resolvedProjectId, token);
	const missingChecks = [];
	const phoneTest = testPhoneConfig(env);

	if (!config.authorizedDomains.includes(hostname)) {
		missingChecks.push(`authorized domain ${hostname}`);
	}

	if (!config.phoneNumberEnabled) {
		missingChecks.push("Phone Auth provider");
	}

	if (phoneTest && config.testPhoneNumbers[phoneTest.phoneNumber] !== phoneTest.code) {
		missingChecks.push(`test phone number ${phoneTest.phoneNumber}`);
	}

	if (missingChecks.length === 0) {
		console.log(`Firebase Auth config verified for ${hostname}`);
		process.exit(0);
	}

	if (!shouldWrite) {
		console.error(`Firebase Auth config missing: ${missingChecks.join(", ")}.`);
		process.exit(1);
	}

	if (!config.authorizedDomains.includes(hostname)) {
		await writeAuthConfig(
			resolvedProjectId,
			token,
			{ authorizedDomains: [...new Set([...config.authorizedDomains, hostname])] },
			"authorizedDomains",
		);
		console.log(`Firebase Auth domain added: ${hostname}`);
	}

	if (!config.phoneNumberEnabled || phoneTest) {
		const nextTestPhoneNumbers = {
			...config.testPhoneNumbers,
			...(phoneTest ? { [phoneTest.phoneNumber]: phoneTest.code } : {}),
		};
		await writeAuthConfig(
			resolvedProjectId,
			token,
			{
				signIn: {
					phoneNumber: {
						enabled: true,
						testPhoneNumbers: nextTestPhoneNumbers,
					},
				},
			},
			"signIn.phoneNumber",
		);
		console.log("Firebase Phone Auth provider verified.");
	}
} catch (cause) {
	console.error(cause instanceof Error ? cause.message : "Firebase Auth domain check failed.");
	process.exit(1);
}
