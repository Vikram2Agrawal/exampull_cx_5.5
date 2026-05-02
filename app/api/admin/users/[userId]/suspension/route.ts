import { NextResponse } from "next/server";
import { z } from "zod";
import { setUserSuspension } from "@/lib/admin/data";
import { requireAdminApiSession } from "@/lib/admin/request";

export const runtime = "nodejs";

const requestSchema = z.object({
	action: z.enum(["suspend", "unsuspend"]),
	reason: z.string().trim().min(4).max(500),
});

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
	const authError = await requireAdminApiSession(request, {
		requireCsrf: true,
		requireReauth: true,
	});

	if (authError) {
		return authError;
	}

	const { userId } = await params;

	try {
		const input = requestSchema.parse(await request.json());
		const result = await setUserSuspension({ userId, ...input });

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Suspension update failed.";

		return NextResponse.json({ error: message }, { status: 400 });
	}
}
