import { appendAdminAudit } from "@/lib/admin/audit";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { env, publicBaseUrl } from "@/lib/env";
import { featurebasePortalBaseUrl } from "@/lib/featurebase/sso";
import { adminDb, FieldValue, Timestamp } from "@/lib/firebase/admin";
import { sendTransactionalSms } from "@/lib/sms/transactional";
import { createUserNotification } from "@/lib/user/data";

export type AdminCommunicationChannel = "email" | "sms" | "in_app";
export type AdminCommunicationMode = "single" | "test" | "broadcast";
export type AdminBroadcastAudience = {
	tier: "any" | "free" | "scholar" | "guru";
	testAccounts: "only" | "exclude" | "include";
	limit: number;
};

export type AdminCommunicationSendInput = {
	mode: AdminCommunicationMode;
	userId?: string;
	testEmail?: string;
	testPhoneNumber?: string;
	channels: AdminCommunicationChannel[];
	subject: string;
	body: string;
	audience: AdminBroadcastAudience;
};

export type AdminCommunicationSendResult = {
	broadcastId: string | null;
	recipientCount: number;
	communicationCount: number;
	statuses: Record<string, number>;
};

type Recipient = {
	userId: string | null;
	email: string | null;
	phoneNumber: string | null;
	displayName: string;
	tier: string;
	credits: number;
	isTestAccount: boolean;
};

type RenderedMessage = {
	subject: string;
	body: string;
};

const urlPattern = /\bhttps?:\/\/[^\s<>"')]+/g;

function recipientFromUserDoc(doc: FirebaseFirestore.DocumentSnapshot): Recipient {
	return {
		userId: doc.id,
		email: typeof doc.get("email") === "string" ? doc.get("email") : null,
		phoneNumber: typeof doc.get("phoneNumber") === "string" ? doc.get("phoneNumber") : null,
		displayName:
			typeof doc.get("displayName") === "string" && doc.get("displayName").trim()
				? doc.get("displayName")
				: "Student",
		tier: typeof doc.get("tier") === "string" ? doc.get("tier") : "free",
		credits: Number(doc.get("credits") ?? 0),
		isTestAccount: doc.get("isTestAccount") === true,
	};
}

function testRecipient(input: AdminCommunicationSendInput): Recipient {
	return {
		userId: null,
		email: input.testEmail?.trim() || null,
		phoneNumber: input.testPhoneNumber?.trim() || null,
		displayName: "Test recipient",
		tier: "free",
		credits: 0,
		isTestAccount: true,
	};
}

function interpolate(template: string, recipient: Recipient) {
	return template
		.replaceAll("{{display_name}}", recipient.displayName)
		.replaceAll("{{email}}", recipient.email ?? "")
		.replaceAll("{{credit_balance}}", recipient.credits.toString())
		.replaceAll("{{tier}}", recipient.tier);
}

function renderMessage(input: AdminCommunicationSendInput, recipient: Recipient): RenderedMessage {
	return {
		subject: interpolate(input.subject, recipient),
		body: interpolate(input.body, recipient),
	};
}

function defaultAllowedOrigins() {
	return [publicBaseUrl(), env.NEXT_PUBLIC_WEB_URL, env.WEB_URL, featurebasePortalBaseUrl()]
		.filter((value): value is string => Boolean(value))
		.map((value) => new URL(value).origin);
}

async function allowedOrigins() {
	const snapshot = await adminDb.collection("config").doc("url_allowlist").get();
	const configured = snapshot.get("origins");

	if (!Array.isArray(configured)) {
		return new Set(defaultAllowedOrigins());
	}

	return new Set(
		[...defaultAllowedOrigins(), ...configured]
			.filter(
				(value): value is string => typeof value === "string" && value.trim().length > 0,
			)
			.map((value) => {
				try {
					return new URL(value).origin;
				} catch {
					return null;
				}
			})
			.filter((value): value is string => Boolean(value)),
	);
}

export async function validateAdminMessageUrls(value: string) {
	const allowed = await allowedOrigins();
	const urls = value.match(urlPattern) ?? [];
	const blocked = urls.filter((rawUrl) => {
		try {
			return !allowed.has(new URL(rawUrl).origin);
		} catch {
			return true;
		}
	});

	if (blocked.length > 0) {
		throw new Error(`Message contains non-allowlisted URL: ${blocked[0]}`);
	}
}

async function singleRecipient(userId: string) {
	const snapshot = await adminDb.collection("users").doc(userId).get();

	if (!snapshot.exists) {
		throw new Error("User not found.");
	}

	return recipientFromUserDoc(snapshot);
}

async function broadcastRecipients(audience: AdminBroadcastAudience) {
	let query: FirebaseFirestore.Query = adminDb.collection("users");

	if (audience.tier !== "any") {
		query = query.where("tier", "==", audience.tier);
	}

	if (audience.testAccounts === "only") {
		query = query.where("isTestAccount", "==", true);
	} else if (audience.testAccounts === "exclude") {
		query = query.where("isTestAccount", "==", false);
	}

	const snapshot = await query.limit(audience.limit).get();

	return snapshot.docs.map(recipientFromUserDoc);
}

async function recipientsForInput(input: AdminCommunicationSendInput) {
	if (input.mode === "test") {
		return [testRecipient(input)];
	}

	if (input.mode === "single") {
		if (!input.userId) {
			throw new Error("User ID is required for single-user messages.");
		}

		return [await singleRecipient(input.userId)];
	}

	return broadcastRecipients(input.audience);
}

async function logCommunication({
	broadcastId,
	input,
	recipient,
	channel,
	message,
	status,
	providerId,
	errorMessage,
}: {
	broadcastId: string | null;
	input: AdminCommunicationSendInput;
	recipient: Recipient;
	channel: AdminCommunicationChannel;
	message: RenderedMessage;
	status: string;
	providerId: string | null;
	errorMessage: string | null;
}) {
	await adminDb.collection("communications").add({
		kind:
			input.mode === "broadcast"
				? "admin_broadcast"
				: input.mode === "test"
					? "admin_test"
					: "admin_message",
		channel,
		subject: message.subject,
		body: message.body,
		status,
		userId: recipient.userId,
		email: recipient.email,
		phoneNumber: recipient.phoneNumber,
		providerId,
		errorMessage,
		broadcastId,
		isTestData: recipient.isTestAccount,
		createdAt: Timestamp.now(),
		sentAt: Timestamp.now(),
		source: "admin_composer",
		idempotencyKey: `${broadcastId ?? "single"}:${recipient.userId ?? recipient.email ?? recipient.phoneNumber}:${channel}`,
	});
}

function incrementStatus(counts: Record<string, number>, status: string) {
	counts[status] = (counts[status] ?? 0) + 1;
}

async function sendChannel({
	input,
	recipient,
	channel,
	message,
}: {
	input: AdminCommunicationSendInput;
	recipient: Recipient;
	channel: AdminCommunicationChannel;
	message: RenderedMessage;
}) {
	if (channel === "email") {
		try {
			const result = await sendTransactionalEmail({
				to: recipient.email,
				subject: message.subject,
				text: message.body,
				testMode: recipient.isTestAccount || input.mode === "test",
			});

			return { status: result.status, providerId: result.providerId, errorMessage: null };
		} catch (error) {
			return {
				status: "failed",
				providerId: null,
				errorMessage: error instanceof Error ? error.message : "Email send failed.",
			};
		}
	}

	if (channel === "sms") {
		try {
			const result = await sendTransactionalSms({
				to: recipient.phoneNumber,
				body: message.body,
				testMode: recipient.isTestAccount || input.mode === "test",
			});

			return { status: result.status, providerId: result.providerId, errorMessage: null };
		} catch (error) {
			return {
				status: "failed",
				providerId: null,
				errorMessage: error instanceof Error ? error.message : "SMS send failed.",
			};
		}
	}

	if (!recipient.userId) {
		return {
			status: "skipped_no_recipient",
			providerId: null,
			errorMessage: "Test recipients do not have in-app notification inboxes.",
		};
	}

	await createUserNotification({
		userId: recipient.userId,
		title: message.subject,
		body: message.body,
		kind: "admin_message",
		href: "/notifications",
	});

	return { status: "sent", providerId: null, errorMessage: null };
}

export async function sendAdminCommunication(input: AdminCommunicationSendInput) {
	await validateAdminMessageUrls(`${input.subject}\n${input.body}`);
	const recipients = await recipientsForInput(input);
	const broadcastRef =
		input.mode === "broadcast" ? adminDb.collection("communication_broadcasts").doc() : null;
	const broadcastId = broadcastRef?.id ?? null;
	const statuses: Record<string, number> = {};
	let communicationCount = 0;

	if (broadcastRef) {
		await broadcastRef.set({
			audience: input.audience,
			channels: input.channels,
			subjectTemplate: input.subject,
			bodyTemplate: input.body,
			recipientCount: recipients.length,
			status: recipients.length > 10_000 ? "cooling_off" : "sending",
			createdAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
		});
	}

	for (const recipient of recipients) {
		const message = renderMessage(input, recipient);

		for (const channel of input.channels) {
			const result = await sendChannel({ input, recipient, channel, message });
			await logCommunication({
				broadcastId,
				input,
				recipient,
				channel,
				message,
				status: result.status,
				providerId: result.providerId,
				errorMessage: result.errorMessage,
			});
			incrementStatus(statuses, result.status);
			communicationCount += 1;
		}
	}

	if (broadcastRef) {
		await broadcastRef.set(
			{
				status: "complete",
				statuses,
				communicationCount,
				updatedAt: Timestamp.now(),
				completedAt: Timestamp.now(),
			},
			{ merge: true },
		);
	}

	await appendAdminAudit({
		action:
			input.mode === "broadcast"
				? "send_broadcast"
				: input.mode === "test"
					? "send_test_communication"
					: "send_user_communication",
		target: broadcastId ? `communication_broadcasts/${broadcastId}` : "communications",
		details: `${input.channels.join(",")} to ${recipients.length.toString()} recipient(s): ${input.subject}`,
	});

	if (input.mode === "broadcast") {
		await adminDb
			.collection("admin_metrics")
			.doc("communications")
			.set(
				{
					broadcastCount: FieldValue.increment(1),
					recipientSendCount: FieldValue.increment(communicationCount),
					updatedAt: Timestamp.now(),
				},
				{ merge: true },
			);
	}

	return {
		broadcastId,
		recipientCount: recipients.length,
		communicationCount,
		statuses,
	} satisfies AdminCommunicationSendResult;
}
