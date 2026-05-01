import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { attemptUploadSchema, createAttemptUpload, listExamAttempts } from "@/lib/exams/attempts";

export const runtime = "nodejs";

type Context = {
	params: Promise<{ examId: string }>;
};

export async function GET(_request: Request, context: Context) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const { examId } = await context.params;
	const attempts = await listExamAttempts(user.uid, examId);

	return NextResponse.json({ attempts });
}

export async function POST(request: Request, context: Context) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	try {
		const { examId } = await context.params;
		const input = attemptUploadSchema.parse(await request.json());
		const result = await createAttemptUpload({ user, examId, input });

		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Attempt upload failed.";
		const status = message.includes("Insufficient") ? 402 : 400;

		return NextResponse.json({ error: message }, { status });
	}
}
