import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
	createExamSourceUpload,
	examSourceUploadSchema,
	listExamSourceUploads,
} from "@/lib/exams/source-uploads";

export const runtime = "nodejs";

export async function GET(request: Request) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const url = new URL(request.url);
	const ids = (url.searchParams.get("ids") ?? "")
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
	const uploads = await listExamSourceUploads(user.uid, ids);

	return NextResponse.json({ uploads });
}

export async function POST(request: Request) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	try {
		const input = examSourceUploadSchema.parse(await request.json());
		const result = await createExamSourceUpload({ user, input });

		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Source upload failed.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
