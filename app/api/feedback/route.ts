import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { feedbackSchema, submitFeedback } from "@/lib/user/data";

export const runtime = "nodejs";

export async function POST(request: Request) {
	const user = await getCurrentUser();

	try {
		const input = feedbackSchema.parse(await request.json());
		if (input.kind === "feature" && !user) {
			return NextResponse.json(
				{ error: "Sign in to submit feature requests." },
				{ status: 401 },
			);
		}

		const result = await submitFeedback(user, input);

		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Feedback submission failed.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
