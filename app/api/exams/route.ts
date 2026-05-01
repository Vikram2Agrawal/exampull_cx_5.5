import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createExamForUser, createExamRequestSchema } from "@/lib/exams/create";
import { listUserExams } from "@/lib/exams/data";

export const runtime = "nodejs";

export async function GET() {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const exams = await listUserExams(user.uid);
	return NextResponse.json({ exams });
}

export async function POST(request: Request) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	try {
		const input = createExamRequestSchema.parse(await request.json());
		const result = await createExamForUser({ user, input });

		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Exam creation failed.";
		const status = message.includes("Insufficient") ? 402 : 400;

		return NextResponse.json({ error: message }, { status });
	}
}
