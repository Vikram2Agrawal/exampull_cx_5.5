const encoder = new TextEncoder();

type AdminSessionPayload = {
	sub: "agent";
	authMethod: "agent_password";
	issuedAt: number;
	expiresAt: number;
};

function base64UrlEncode(input: string | Uint8Array) {
	const bytes = typeof input === "string" ? encoder.encode(input) : input;
	const binary = String.fromCharCode(...bytes);

	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(input: string) {
	const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
	const binary = atob(padded);

	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(secret: string, data: string) {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));

	return new Uint8Array(signature);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
	if (left.length !== right.length) {
		return false;
	}

	let diff = 0;
	for (let index = 0; index < left.length; index += 1) {
		diff |= left[index] ^ right[index];
	}

	return diff === 0;
}

export function adminSecret() {
	return (
		process.env.ADMIN_SECRET || process.env.ADMIN_AGENT_PASSWORD || "build-phase-admin-secret"
	);
}

export async function createAdminSessionToken(secret = adminSecret()) {
	const now = Date.now();
	const payload: AdminSessionPayload = {
		sub: "agent",
		authMethod: "agent_password",
		issuedAt: now,
		expiresAt: now + 4 * 60 * 60 * 1000,
	};
	const encodedPayload = base64UrlEncode(JSON.stringify(payload));
	const signature = await hmac(secret, encodedPayload);

	return `${encodedPayload}.${base64UrlEncode(signature)}`;
}

export async function createAdminCsrfToken(sessionToken: string, secret = adminSecret()) {
	const signature = await hmac(secret, `admin-csrf:${sessionToken}`);

	return base64UrlEncode(signature);
}

export async function verifyAdminCsrfToken({
	sessionToken,
	csrfToken,
	secret = adminSecret(),
}: {
	sessionToken: string;
	csrfToken: string | null;
	secret?: string;
}) {
	if (!csrfToken) {
		return false;
	}

	try {
		const expected = await hmac(secret, `admin-csrf:${sessionToken}`);
		const actual = base64UrlDecode(csrfToken);

		return constantTimeEqual(expected, actual);
	} catch {
		return false;
	}
}

export async function verifyAdminSessionToken(token: string | undefined, secret = adminSecret()) {
	if (!token) {
		return null;
	}

	const [encodedPayload, encodedSignature] = token.split(".");

	if (!encodedPayload || !encodedSignature) {
		return null;
	}

	const expected = await hmac(secret, encodedPayload);
	const actual = base64UrlDecode(encodedSignature);

	if (expected.length !== actual.length) {
		return null;
	}

	if (!constantTimeEqual(expected, actual)) {
		return null;
	}

	const payloadText = new TextDecoder().decode(base64UrlDecode(encodedPayload));
	const payload = JSON.parse(payloadText) as AdminSessionPayload;

	if (payload.expiresAt < Date.now()) {
		return null;
	}

	return payload;
}
