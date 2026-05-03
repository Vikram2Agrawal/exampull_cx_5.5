import { existsSync, readFileSync } from "node:fs";
import { Storage } from "@google-cloud/storage";

type EnvMap = Record<string, string>;

function parseEnvFile(path: string): EnvMap {
	if (!existsSync(path)) {
		return {};
	}

	return Object.fromEntries(
		readFileSync(path, "utf8")
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#") && line.includes("="))
			.map((line) => {
				const equalsIndex = line.indexOf("=");
				const key = line.slice(0, equalsIndex).trim();
				let value = line.slice(equalsIndex + 1).trim();

				if (
					(value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))
				) {
					value = value.slice(1, -1);
				}

				return [key, value];
			}),
	);
}

function originFromValue(value: string | undefined) {
	if (!value) {
		return null;
	}

	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
}

const env = {
	...parseEnvFile(".env.local"),
	...process.env,
};

const bucketName = env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const verifyOnly = process.argv.includes("--verify");

if (!bucketName) {
	throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is required.");
}

const configuredOrigins = [
	originFromValue(env.WEB_URL),
	originFromValue(env.NEXT_PUBLIC_WEB_URL),
	originFromValue(env.TEST_BASE_URL),
	"http://localhost:3000",
	"http://127.0.0.1:3000",
	"http://localhost:3100",
	"http://127.0.0.1:3100",
	"http://localhost:3101",
	"http://127.0.0.1:3101",
	"http://localhost:3102",
	"http://127.0.0.1:3102",
	"http://localhost:3103",
	"http://127.0.0.1:3103",
].filter((origin): origin is string => Boolean(origin));

const origin = Array.from(new Set(configuredOrigins));

const cors = [
	{
		origin,
		method: ["GET", "HEAD", "PUT", "POST", "OPTIONS"],
		responseHeader: [
			"Content-Type",
			"Content-Length",
			"Content-Range",
			"ETag",
			"x-goog-resumable",
		],
		maxAgeSeconds: 3600,
	},
];

const storage = new Storage({
	projectId:
		env.GOOGLE_CLOUD_PROJECT ?? env.GCLOUD_PROJECT ?? env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
	keyFilename: env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH ?? env.GOOGLE_APPLICATION_CREDENTIALS,
});

function stringSet(value: unknown) {
	return new Set(
		Array.isArray(value)
			? value.filter((item): item is string => typeof item === "string")
			: [],
	);
}

if (verifyOnly) {
	const [metadata] = await storage.bucket(bucketName).getMetadata();
	const rules = Array.isArray(metadata.cors) ? metadata.cors : [];
	const missingOrigins = origin.filter(
		(expectedOrigin) =>
			!rules.some((rule) => {
				const origins = stringSet(rule.origin);
				return origins.has("*") || origins.has(expectedOrigin);
			}),
	);
	const requiredMethods = ["GET", "HEAD", "PUT", "POST", "OPTIONS"];
	const missingMethods = requiredMethods.filter(
		(method) =>
			!rules.some((rule) => {
				const methods = stringSet(rule.method);
				return methods.has(method);
			}),
	);

	if (missingOrigins.length > 0 || missingMethods.length > 0) {
		throw new Error(
			[
				"Firebase Storage CORS is incomplete.",
				missingOrigins.length > 0 ? `Missing origins: ${missingOrigins.join(", ")}` : null,
				missingMethods.length > 0 ? `Missing methods: ${missingMethods.join(", ")}` : null,
				"Run `pnpm setup:storage-cors`.",
			]
				.filter((line): line is string => Boolean(line))
				.join("\n"),
		);
	}

	console.log(`Verified CORS on gs://${bucketName} for ${origin.length.toString()} origins.`);
} else {
	await storage.bucket(bucketName).setCorsConfiguration(cors);

	console.log(`Updated CORS on gs://${bucketName} for ${origin.length.toString()} origins.`);
}
