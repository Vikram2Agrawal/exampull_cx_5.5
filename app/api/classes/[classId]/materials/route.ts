import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createMaterialUpload, listClassMaterials, materialUploadSchema } from "@/lib/classes/data";

export const runtime = "nodejs";

type Context = {
	params: Promise<{ classId: string }>;
};

export async function GET(_request: Request, context: Context) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const { classId } = await context.params;
	const materials = await listClassMaterials(user.uid, classId);

	return NextResponse.json({ materials });
}

export async function POST(request: Request, context: Context) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	try {
		const { classId } = await context.params;
		const input = materialUploadSchema.parse(await request.json());
		const result = await createMaterialUpload({ user, classId, input });

		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Material upload failed.";
		const status = message.includes("Insufficient") ? 402 : 400;

		return NextResponse.json({ error: message }, { status });
	}
}
