import { z } from "zod";

const envSchema = z.object({
	NEXT_PUBLIC_FIREBASE_API_KEY: z.string().optional(),
	NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),
	NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
	NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
	NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
	NEXT_PUBLIC_FIREBASE_APP_ID: z.string().optional(),
	NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: z.string().optional(),
	WEB_URL: z.string().optional(),
	NEXT_PUBLIC_WEB_URL: z.string().optional(),
	FIREBASE_SERVICE_ACCOUNT_KEY_PATH: z.string().optional(),
	GOOGLE_CLOUD_PROJECT: z.string().optional(),
	GOOGLE_CLOUD_REGION: z.string().default("us-central1"),
	OPENROUTER_API_KEY: z.string().optional(),
	OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
	LATEX_SERVICE_URL: z.string().optional(),
	CLOUD_TASKS_QUEUE: z.string().default("exampull-jobs"),
	CLOUD_TASKS_LOCATION: z.string().optional(),
	CLOUD_TASKS_INVOKER_SA: z.string().optional(),
	CLOUD_TASKS_AUTH_REQUIRED: z.string().optional(),
	LATEX_SERVICE_AUTH_DISABLED: z.string().optional(),
	STRIPE_SECRET_KEY: z.string().optional(),
	NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
	STRIPE_WEBHOOK_SECRET: z.string().optional(),
	STRIPE_RESTRICTED_KEY_REFUNDS: z.string().optional(),
	STRIPE_PRICE_SCHOLAR_MONTHLY: z.string().optional(),
	STRIPE_PRICE_SCHOLAR_ANNUAL: z.string().optional(),
	STRIPE_PRICE_GURU_MONTHLY: z.string().optional(),
	STRIPE_PRICE_GURU_ANNUAL: z.string().optional(),
	STRIPE_PRICE_CREDITS_20: z.string().optional(),
	STRIPE_PRICE_CREDITS_100: z.string().optional(),
	STRIPE_PRICE_CREDITS_240: z.string().optional(),
	RESEND_API_KEY: z.string().optional(),
	RESEND_FROM_ADDRESS: z.string().optional(),
	RESEND_DOMAIN_ID: z.string().optional(),
	TWILIO_ACCOUNT_SID: z.string().optional(),
	TWILIO_AUTH_TOKEN: z.string().optional(),
	TWILIO_PHONE_NUMBER: z.string().optional(),
	TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
	TWILIO_USER_SID: z.string().optional(),
	ADMIN_AGENT_PASSWORD: z.string().optional(),
	ADMIN_AGENT_AUTH_ENABLED: z.string().default("true"),
	ADMIN_SECRET: z.string().optional(),
	AUDIT_ARCHIVE_BUCKET: z.string().optional(),
	AUDIT_ARCHIVE_PREFIX: z.string().default("admin-audit-archive/v1"),
	TEST_SIGNUP_TOKEN: z.string().optional(),
	TEST_SESSION_API_ENABLED: z.string().default("false"),
});

const parsed = envSchema.safeParse(process.env);
const fallbackEnv: z.output<typeof envSchema> = {
	GOOGLE_CLOUD_REGION: "us-central1",
	OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
	CLOUD_TASKS_QUEUE: "exampull-jobs",
	ADMIN_AGENT_AUTH_ENABLED: "true",
	AUDIT_ARCHIVE_PREFIX: "admin-audit-archive/v1",
	TEST_SESSION_API_ENABLED: "false",
};

export const env: z.output<typeof envSchema> = parsed.success ? parsed.data : fallbackEnv;

export function publicBaseUrl() {
	return env.NEXT_PUBLIC_WEB_URL || env.WEB_URL || "http://localhost:3000";
}
