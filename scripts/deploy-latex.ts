import { spawnSync } from "node:child_process";

const project = process.env.GOOGLE_CLOUD_PROJECT;
const region = process.env.GOOGLE_CLOUD_REGION || "us-central1";

if (!project) {
	throw new Error("GOOGLE_CLOUD_PROJECT is required.");
}

const invoker =
	process.env.CLOUD_TASKS_INVOKER_SA || `exampull-tasks@${project}.iam.gserviceaccount.com`;
const server =
	process.env.APP_RUNTIME_SERVICE_ACCOUNT || `exampull-server@${project}.iam.gserviceaccount.com`;

function run(command: string, args: string[]) {
	const result = spawnSync(command, args, { stdio: "inherit" });

	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed.`);
	}
}

const image = `gcr.io/${project}/latex-service`;

run("gcloud", ["builds", "submit", "latex-service", "--tag", image, "--project", project]);
run("gcloud", [
	"run",
	"deploy",
	"latex-service",
	"--image",
	image,
	"--region",
	region,
	"--min-instances",
	"1",
	"--max-instances",
	"10",
	"--memory",
	"2Gi",
	"--cpu",
	"2",
	"--timeout",
	"120",
	"--no-allow-unauthenticated",
	"--project",
	project,
	"--quiet",
]);

for (const serviceAccount of [invoker, server]) {
	run("gcloud", [
		"run",
		"services",
		"add-iam-policy-binding",
		"latex-service",
		"--member",
		`serviceAccount:${serviceAccount}`,
		"--role",
		"roles/run.invoker",
		"--region",
		region,
		"--project",
		project,
		"--quiet",
	]);
}

const urlResult = spawnSync(
	"gcloud",
	[
		"run",
		"services",
		"describe",
		"latex-service",
		"--region",
		region,
		"--project",
		project,
		"--format=value(status.url)",
	],
	{ encoding: "utf8" },
);

if (urlResult.status !== 0) {
	throw new Error(urlResult.stderr || "Failed to read LaTeX service URL.");
}

console.log(`LaTeX service deployed at ${urlResult.stdout.trim()}.`);
