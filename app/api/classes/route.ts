import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { classCreateSchema, createClassForUser, listUserClasses } from "@/lib/classes/data";

export const runtime = "nodejs";

export async function GET() {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const classes = await listUserClasses(user.uid);
	return NextResponse.json({ classes });
}

export async function POST(request: Request) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	try {
		const input = classCreateSchema.parse(await request.json());
		const result = await createClassForUser(user, input);

		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Class creation failed.";

		return NextResponse.json({ error: message }, { status: 400 });
	}
}
