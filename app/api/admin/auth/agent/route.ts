import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSessionToken } from "@/lib/admin/session";

export const runtime = "nodejs";

const requestSchema = z.object({
	password: z.string().min(1),
});

export async function POST(request: Request) {
	if (process.env.ADMIN_AGENT_AUTH_ENABLED === "false" || !process.env.ADMIN_AGENT_PASSWORD) {
		return NextResponse.json({ error: "Agent auth disabled" }, { status: 404 });
	}

	const body = requestSchema.safeParse(await request.json());

	if (!body.success || body.data.password !== process.env.ADMIN_AGENT_PASSWORD) {
		return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
	}

	const token = await createAdminSessionToken();
	const cookieStore = await cookies();

	cookieStore.set("admin_session", token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		path: "/",
		maxAge: 4 * 60 * 60,
	});

	return NextResponse.json({ ok: true, authMethod: "agent_password" });
}
