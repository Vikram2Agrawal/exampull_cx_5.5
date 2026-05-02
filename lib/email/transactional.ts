import { Resend } from "resend";
import { env } from "@/lib/env";

export type EmailStatus =
	| "sent"
	| "failed"
	| "skipped_test"
	| "skipped_unconfigured"
	| "skipped_no_recipient"
	| "skipped_preferences";

type TransactionalEmailInput = {
	to: string | null;
	subject: string;
	text: string;
	html?: string;
	testMode?: boolean;
	enabled?: boolean;
};

type TransactionalEmailResult = {
	status: EmailStatus;
	providerId: string | null;
};

function textToHtml(value: string) {
	return `<div>${value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("\n", "<br />")}</div>`;
}

export async function sendTransactionalEmail({
	to,
	subject,
	text,
	html,
	testMode = false,
	enabled = true,
}: TransactionalEmailInput): Promise<TransactionalEmailResult> {
	if (!to) {
		return { status: "skipped_no_recipient", providerId: null };
	}

	if (testMode) {
		return { status: "skipped_test", providerId: null };
	}

	if (enabled === false) {
		return { status: "skipped_preferences", providerId: null };
	}

	if (!env.RESEND_API_KEY || !env.RESEND_FROM_ADDRESS) {
		return { status: "skipped_unconfigured", providerId: null };
	}

	const resend = new Resend(env.RESEND_API_KEY);
	const response = await resend.emails.send({
		from: env.RESEND_FROM_ADDRESS,
		to,
		subject,
		text,
		html: html ?? textToHtml(text),
	});

	if (response.error) {
		throw new Error(response.error.message);
	}

	return { status: "sent", providerId: response.data?.id ?? null };
}
