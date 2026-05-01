import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { bulkUpdateExamsForUser, examBulkActionSchema } from "@/lib/exams/library";

export const runtime = "nodejs";

export async function POST(request: Request) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	try {
		const input = examBulkActionSchema.parse(await request.json());
		const result = await bulkUpdateExamsForUser({ user, input });

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Bulk update failed.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
