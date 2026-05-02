import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteNotification, markNotificationRead } from "@/lib/user/data";

export const runtime = "nodejs";

export async function PATCH(
	_request: Request,
	{ params }: { params: Promise<{ notificationId: string }> },
) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	try {
		const { notificationId } = await params;
		const result = await markNotificationRead(user.uid, notificationId);

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Notification update failed.";
		return NextResponse.json({ error: message }, { status: 404 });
	}
}

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ notificationId: string }> },
) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	try {
		const { notificationId } = await params;
		const result = await deleteNotification(user.uid, notificationId);

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Notification deletion failed.";
		return NextResponse.json({ error: message }, { status: 404 });
	}
}
