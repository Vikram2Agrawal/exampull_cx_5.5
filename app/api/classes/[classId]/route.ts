import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
	classUpdateSchema,
	deleteClassForUser,
	getUserClass,
	updateClassForUser,
} from "@/lib/classes/data";

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
	const course = await getUserClass(user.uid, classId);

	if (!course) {
		return NextResponse.json({ error: "Class not found." }, { status: 404 });
	}

	return NextResponse.json({ class: course });
}

export async function PATCH(request: Request, context: Context) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	try {
		const { classId } = await context.params;
		const input = classUpdateSchema.parse(await request.json());
		const result = await updateClassForUser(user.uid, classId, input);

		if (!result) {
			return NextResponse.json({ error: "Class not found." }, { status: 404 });
		}

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Class update failed.";

		return NextResponse.json({ error: message }, { status: 400 });
	}
}

export async function DELETE(_request: Request, context: Context) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	try {
		const { classId } = await context.params;
		const result = await deleteClassForUser(user.uid, classId);

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Class deletion failed.";

		return NextResponse.json({ error: message }, { status: 409 });
	}
}
