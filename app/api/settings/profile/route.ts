import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { profileSettingsSchema, updateProfileSettings } from "@/lib/user/data";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	try {
		const input = profileSettingsSchema.parse(await request.json());
		const result = await updateProfileSettings(user, input);

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Profile update failed.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
