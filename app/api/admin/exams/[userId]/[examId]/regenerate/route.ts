import { NextResponse } from "next/server";
import { z } from "zod";
import { forceRegenerateExam } from "@/lib/admin/data";
import { requireAdminApiSession } from "@/lib/admin/request";

export const runtime = "nodejs";

const requestSchema = z.object({
	reason: z.string().trim().min(4).max(500),
});

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ userId: string; examId: string }> },
) {
	const authError = await requireAdminApiSession(request, {
		requireCsrf: true,
		requireReauth: true,
	});

	if (authError) {
		return authError;
	}

	const { userId, examId } = await params;

	try {
		const input = requestSchema.parse(await request.json());
		const result = await forceRegenerateExam({ userId, examId, reason: input.reason });

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Regeneration failed.";

		return NextResponse.json({ error: message }, { status: 400 });
	}
}
