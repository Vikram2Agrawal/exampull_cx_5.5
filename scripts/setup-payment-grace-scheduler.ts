import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function loadEnvLocal() {
	if (!existsSync(".env.local")) {
		return;
	}

	const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
			continue;
		}

		const separator = trimmed.indexOf("=");
		const key = trimmed.slice(0, separator).trim();
		const rawValue = trimmed.slice(separator + 1).trim();
		if (process.env[key]) {
			continue;
		}

		process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
	}
}

function requiredEnv(name: string) {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is required.`);
	}

	return value;
}

function trimmedUrl(value: string) {
	return value.replace(/\/+$/, "");
}

function gcloudCommand() {
	const localSdk = join(homedir(), "google-cloud-sdk", "bin", "gcloud");

	return existsSync(localSdk) ? localSdk : "gcloud";
}

function commandLine(command: string, args: string[]) {
	return `${command} ${args.join(" ")}`;
}

function run(command: string, args: string[]) {
	const result = spawnSync(command, args, { encoding: "utf8" });

	if (result.stdout) {
		process.stdout.write(result.stdout);
	}

	if (result.stderr) {
		process.stderr.write(result.stderr);
	}

	if (result.status !== 0) {
		throw new Error(`${commandLine(command, args)} failed.`);
	}
}

function schedulerJobExists(command: string, args: string[]) {
	const result = spawnSync(command, args, { encoding: "utf8" });

	if (result.status === 0) {
		return true;
	}

	const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
	if (output.includes("not found") || output.includes("not_found")) {
		return false;
	}

	if (result.stdout) {
		process.stdout.write(result.stdout);
	}

	if (result.stderr) {
		process.stderr.write(result.stderr);
	}

	throw new Error(`${commandLine(command, args)} failed.`);
}

loadEnvLocal();

const project = requiredEnv("GOOGLE_CLOUD_PROJECT");
const region = process.env.GOOGLE_CLOUD_REGION?.trim() || "us-central1";
const webUrl = trimmedUrl(requiredEnv("WEB_URL"));
const invoker =
	process.env.CLOUD_TASKS_INVOKER_SA?.trim() ||
	`exampull-tasks@${project}.iam.gserviceaccount.com`;
const jobName = process.env.PAYMENT_GRACE_SCHEDULER_JOB?.trim() || "expire-payment-grace";
const schedule = process.env.PAYMENT_GRACE_SCHEDULE?.trim() || "23 */6 * * *";
const timeZone = process.env.PAYMENT_GRACE_TIME_ZONE?.trim() || "Etc/UTC";
const limit = Number.parseInt(process.env.PAYMENT_GRACE_LIMIT?.trim() || "500", 10);

if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
	throw new Error("PAYMENT_GRACE_LIMIT must be an integer from 1 to 500.");
}

const gcloud = gcloudCommand();

run(gcloud, ["config", "set", "project", project]);
run(gcloud, ["services", "enable", "cloudscheduler.googleapis.com", "--project", project]);
run(gcloud, [
	"projects",
	"add-iam-policy-binding",
	project,
	`--member=serviceAccount:${invoker}`,
	"--role=roles/run.invoker",
	"--condition=None",
	"--format=none",
	"--quiet",
]);

const exists = schedulerJobExists(gcloud, [
	"scheduler",
	"jobs",
	"describe",
	jobName,
	"--location",
	region,
	"--project",
	project,
	"--format=value(name)",
]);
const action = exists ? "update" : "create";
const headersFlag = exists ? "--update-headers" : "--headers";

run(gcloud, [
	"scheduler",
	"jobs",
	action,
	"http",
	jobName,
	"--location",
	region,
	"--schedule",
	schedule,
	"--time-zone",
	timeZone,
	"--uri",
	`${webUrl}/api/workers/expire-payment-grace`,
	"--http-method",
	"POST",
	headersFlag,
	"Content-Type=application/json",
	"--message-body",
	JSON.stringify({ limit }),
	"--oidc-service-account-email",
	invoker,
	"--oidc-token-audience",
	webUrl,
	"--attempt-deadline",
	"180s",
	"--project",
	project,
	"--quiet",
]);

console.log(
	`Payment grace scheduler ${exists ? "updated" : "created"}: ${jobName} (${schedule} ${timeZone}).`,
);
