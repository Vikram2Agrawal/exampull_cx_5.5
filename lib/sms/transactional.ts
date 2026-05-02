import twilio from "twilio";
import { env } from "@/lib/env";

export type SmsStatus =
	| "sent"
	| "failed"
	| "skipped_test"
	| "skipped_unconfigured"
	| "skipped_no_recipient";

type TransactionalSmsInput = {
	to: string | null;
	body: string;
	testMode?: boolean;
};

type TransactionalSmsResult = {
	status: SmsStatus;
	providerId: string | null;
};

export async function sendTransactionalSms({
	to,
	body,
	testMode = false,
}: TransactionalSmsInput): Promise<TransactionalSmsResult> {
	if (!to) {
		return { status: "skipped_no_recipient", providerId: null };
	}

	if (testMode) {
		return { status: "skipped_test", providerId: null };
	}

	if (
		!env.TWILIO_ACCOUNT_SID ||
		!env.TWILIO_AUTH_TOKEN ||
		(!env.TWILIO_PHONE_NUMBER && !env.TWILIO_MESSAGING_SERVICE_SID)
	) {
		return { status: "skipped_unconfigured", providerId: null };
	}

	const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
	const response = await client.messages.create({
		to,
		body,
		...(env.TWILIO_MESSAGING_SERVICE_SID
			? { messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID }
			: { from: env.TWILIO_PHONE_NUMBER }),
	});

	return { status: "sent", providerId: response.sid };
}
