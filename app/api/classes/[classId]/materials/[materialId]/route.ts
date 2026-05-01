import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { completeMaterialUpload, deleteMaterialForUser } from "@/lib/classes/data";

export const runtime = "nodejs";

type Context = {
	params: Promise<{ classId: string; materialId: string }>;
};

const updateSchema = z.object({
	status: z.literal("uploaded"),
});

export async function PATCH(request: Request, context: Context) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	try {
		updateSchema.parse(await request.json());
		const { classId, materialId } = await context.params;
		const result = await completeMaterialUpload(user, classId, materialId);

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Material update failed.";

		return NextResponse.json({ error: message }, { status: 400 });
	}
}

export async function DELETE(_request: Request, context: Context) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const { classId, materialId } = await context.params;
	const result = await deleteMaterialForUser(user.uid, classId, materialId);

	if (!result) {
		return NextResponse.json({ error: "Material not found." }, { status: 404 });
	}

	return NextResponse.json(result);
}
