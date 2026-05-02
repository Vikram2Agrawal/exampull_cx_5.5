import { NextResponse } from "next/server";
import { z } from "zod";
import { overrideUserTier } from "@/lib/admin/data";
import { requireAdminApiSession } from "@/lib/admin/request";

export const runtime = "nodejs";

const requestSchema = z.object({
	tier: z.enum(["free", "scholar", "guru"]),
	expiresAt: z.string().trim().max(40).nullable().default(null),
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
		const result = await overrideUserTier({ userId, ...input });

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Tier override failed.";

		return NextResponse.json({ error: message }, { status: 400 });
	}
}
