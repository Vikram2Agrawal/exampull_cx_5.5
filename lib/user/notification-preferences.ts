import { z } from "zod";

export const notificationEventDefinitions = [
	{
		key: "welcome",
		label: "Welcome",
		description: "Account creation confirmation.",
		emailDefault: true,
		smsDefault: false,
	},
	{
		key: "exam_ready",
		label: "Exam ready",
		description: "A generated exam is ready to download.",
		emailDefault: true,
		smsDefault: false,
	},
	{
		key: "grading_complete",
		label: "Grading complete",
		description: "Attempt grading or visual feedback finished.",
		emailDefault: false,
		smsDefault: false,
	},
	{
		key: "payment_receipt",
		label: "Payment receipt",
		description: "Subscription and credit-pack receipts.",
		emailDefault: true,
		smsDefault: false,
	},
	{
		key: "low_credits",
		label: "Low credits",
		description: "Credit balance warnings.",
		emailDefault: false,
		smsDefault: false,
	},
	{
		key: "payment_failure",
		label: "Payment failure",
		description: "Grace-period payment reminders.",
		emailDefault: true,
		smsDefault: true,
	},
	{
		key: "share_link_feature_change",
		label: "Share-link feature change",
		description: "Shared answer-key downgrade notices.",
		emailDefault: true,
		smsDefault: false,
	},
	{
		key: "subscription_change",
		label: "Subscription change",
		description: "Upgrade, downgrade, cancellation, and plan changes.",
		emailDefault: true,
		smsDefault: false,
	},
] as const;

export type NotificationEventType = (typeof notificationEventDefinitions)[number]["key"];
export type NotificationChannel = "email" | "sms";

export type NotificationEventPreference = {
	email: boolean;
	sms: boolean;
	inApp: true;
};

export type NotificationPreferences = Record<NotificationEventType, NotificationEventPreference>;

const eventPreferenceSchema = z.object({
	email: z.boolean(),
	sms: z.boolean(),
	inApp: z.literal(true).default(true),
});

export const notificationPreferencesSchema = z.object({
	welcome: eventPreferenceSchema,
	exam_ready: eventPreferenceSchema,
	grading_complete: eventPreferenceSchema,
	payment_receipt: eventPreferenceSchema,
	low_credits: eventPreferenceSchema,
	payment_failure: eventPreferenceSchema,
	share_link_feature_change: eventPreferenceSchema,
	subscription_change: eventPreferenceSchema,
});

export function defaultNotificationPreferences(): NotificationPreferences {
	return Object.fromEntries(
		notificationEventDefinitions.map((event) => [
			event.key,
			{
				email: event.emailDefault,
				sms: event.smsDefault,
				inApp: true,
			},
		]),
	) as NotificationPreferences;
}

function legacyBoolean(value: unknown, fallback: boolean) {
	return typeof value === "boolean" ? value : fallback;
}

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
	const defaults = defaultNotificationPreferences();

	if (!value || typeof value !== "object") {
		return defaults;
	}

	const record = value as Record<string, unknown>;
	const legacyEmail = "email" in record ? legacyBoolean(record.email, true) : null;
	const legacySms = "sms" in record ? legacyBoolean(record.sms, false) : null;
	const merged: NotificationPreferences = { ...defaults };

	for (const event of notificationEventDefinitions) {
		const rawPreference = event.key in record ? record[event.key] : null;
		const defaultPreference = defaults[event.key];

		if (rawPreference && typeof rawPreference === "object") {
			const rawRecord = rawPreference as Record<string, unknown>;
			merged[event.key] = {
				email:
					"email" in rawRecord
						? legacyBoolean(rawRecord.email, defaultPreference.email)
						: defaultPreference.email,
				sms:
					"sms" in rawRecord
						? legacyBoolean(rawRecord.sms, defaultPreference.sms)
						: defaultPreference.sms,
				inApp: true,
			};
			continue;
		}

		merged[event.key] = {
			email: legacyEmail ?? defaultPreference.email,
			sms: legacySms ?? defaultPreference.sms,
			inApp: true,
		};
	}

	return merged;
}

export function notificationChannelEnabled({
	preferences,
	eventType,
	channel,
}: {
	preferences: unknown;
	eventType: NotificationEventType;
	channel: NotificationChannel;
}) {
	return normalizeNotificationPreferences(preferences)[eventType][channel];
}
