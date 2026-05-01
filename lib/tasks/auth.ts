import { OAuth2Client } from "google-auth-library";
import { NextResponse } from "next/server";
import { publicBaseUrl } from "@/lib/env";

const oauthClient = new OAuth2Client();

export async function requireWorkerRequest(request: Request) {
	if (process.env.CLOUD_TASKS_AUTH_REQUIRED !== "true" && process.env.NODE_ENV !== "production") {
		return null;
	}

	const invoker = process.env.CLOUD_TASKS_INVOKER_SA;
	if (!invoker) {
		return NextResponse.json(
			{ error: "Worker invoker service account is not configured." },
			{ status: 500 },
		);
	}

	const header = request.headers.get("authorization");
	const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
	if (!token) {
		return NextResponse.json({ error: "Worker auth token missing." }, { status: 401 });
	}

	try {
		const ticket = await oauthClient.verifyIdToken({
			idToken: token,
			audience: publicBaseUrl(),
		});
		const payload = ticket.getPayload();

		if (payload?.email !== invoker || payload.email_verified !== true) {
			return NextResponse.json({ error: "Worker auth token rejected." }, { status: 403 });
		}
	} catch {
		return NextResponse.json({ error: "Worker auth token invalid." }, { status: 401 });
	}

	return null;
}
