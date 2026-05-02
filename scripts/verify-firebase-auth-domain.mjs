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

function accessToken() {
	try {
		return execFileSync("gcloud", ["auth", "print-access-token"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch {
		return firebaseCliAccessToken();
	}
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

	return { authorizedDomains };
}

async function writeAuthConfig(projectId, token, authorizedDomains) {
	const response = await fetch(
		`https://identitytoolkit.googleapis.com/v2/projects/${encodeURIComponent(projectId)}/config?updateMask=authorizedDomains`,
		{
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ authorizedDomains }),
		},
	);

	if (!response.ok) {
		throw new Error(`Identity Toolkit config patch failed with ${response.status}.`);
	}
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
	const token = accessToken();
	const config = await readAuthConfig(resolvedProjectId, token);

	if (config.authorizedDomains.includes(hostname)) {
		console.log(`Firebase Auth domain verified: ${hostname}`);
		process.exit(0);
	}

	if (!shouldWrite) {
		console.error(`Firebase Auth authorizedDomains is missing ${hostname}.`);
		process.exit(1);
	}

	await writeAuthConfig(resolvedProjectId, token, [
		...new Set([...config.authorizedDomains, hostname]),
	]);
	console.log(`Firebase Auth domain added: ${hostname}`);
} catch (cause) {
	console.error(cause instanceof Error ? cause.message : "Firebase Auth domain check failed.");
	process.exit(1);
}
