import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { completeExamSourceUpload, deleteExamSourceUpload } from "@/lib/exams/source-uploads";

export const runtime = "nodejs";

type RouteContext = {
	params: Promise<{ uploadId: string }>;
};

export async function PATCH(_request: Request, context: RouteContext) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	try {
		const { uploadId } = await context.params;
		const result = await completeExamSourceUpload(user, uploadId);

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Source upload failed.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}

export async function DELETE(_request: Request, context: RouteContext) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const { uploadId } = await context.params;
	const result = await deleteExamSourceUpload(user.uid, uploadId);

	if (!result) {
		return NextResponse.json({ error: "Source upload not found." }, { status: 404 });
	}

	return NextResponse.json(result);
}
