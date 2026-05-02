import { spawnSync } from "node:child_process";

const project = process.env.GOOGLE_CLOUD_PROJECT;
const region = process.env.GOOGLE_CLOUD_REGION || "us-central1";

if (!project) {
	throw new Error("GOOGLE_CLOUD_PROJECT is required.");
}

const apis = [
	"firebase.googleapis.com",
	"firestore.googleapis.com",
	"run.googleapis.com",
	"cloudtasks.googleapis.com",
	"cloudscheduler.googleapis.com",
	"cloudfunctions.googleapis.com",
	"cloudbuild.googleapis.com",
	"storage.googleapis.com",
	"iamcredentials.googleapis.com",
	"secretmanager.googleapis.com",
];

function commandLine(command: string, args: string[]) {
	return `${command} ${args.join(" ")}`;
}

function run(command: string, args: string[], { allowExists = false } = {}) {
	const result = spawnSync(command, args, { encoding: "utf8" });

	if (result.stdout) {
		process.stdout.write(result.stdout);
	}

	if (result.stderr) {
		process.stderr.write(result.stderr);
	}

	if (result.status !== 0) {
		const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
		if (
			allowExists &&
			(output.includes("already exists") || output.includes("already_exists"))
		) {
			return;
		}

		throw new Error(`${commandLine(command, args)} failed.`);
	}
}

function read(command: string, args: string[]) {
	const result = spawnSync(command, args, { encoding: "utf8" });

	if (result.status !== 0) {
		throw new Error(`${commandLine(command, args)} failed.\n${result.stderr}`);
	}

	return result.stdout.trim();
}

run("gcloud", ["config", "set", "project", project]);
run("gcloud", ["services", "enable", ...apis, "--project", project]);

const databases = read("gcloud", [
	"firestore",
	"databases",
	"list",
	"--project",
	project,
	"--format=value(name)",
]);

if (!databases.includes("/databases/(default)")) {
	run("gcloud", [
		"firestore",
		"databases",
		"create",
		"--location=nam5",
		"--project",
		project,
		"--quiet",
	]);
}

run(
	"gcloud",
	[
		"iam",
		"service-accounts",
		"create",
		"exampull-server",
		"--display-name=ExamPull Server Runtime",
		"--project",
		project,
	],
	{ allowExists: true },
);

run(
	"gcloud",
	[
		"iam",
		"service-accounts",
		"create",
		"exampull-tasks",
		"--display-name=ExamPull Cloud Tasks Invoker",
		"--project",
		project,
	],
	{ allowExists: true },
);

const invoker = `exampull-tasks@${project}.iam.gserviceaccount.com`;
const server = `exampull-server@${project}.iam.gserviceaccount.com`;
const appHostingCompute = `firebase-app-hosting-compute@${project}.iam.gserviceaccount.com`;

const runtimeServiceAccounts = [server, appHostingCompute];
const runtimeRoles = [
	"roles/datastore.user",
	"roles/storage.objectAdmin",
	"roles/cloudtasks.enqueuer",
	"roles/secretmanager.secretAccessor",
];

for (const serviceAccount of runtimeServiceAccounts) {
	for (const role of runtimeRoles) {
		run("gcloud", [
			"projects",
			"add-iam-policy-binding",
			project,
			`--member=serviceAccount:${serviceAccount}`,
			`--role=${role}`,
			"--condition=None",
			"--quiet",
		]);
	}
}

run("gcloud", [
	"projects",
	"add-iam-policy-binding",
	project,
	`--member=serviceAccount:${invoker}`,
	"--role=roles/run.invoker",
	"--condition=None",
	"--quiet",
]);

for (const serviceAccount of runtimeServiceAccounts) {
	run("gcloud", [
		"iam",
		"service-accounts",
		"add-iam-policy-binding",
		invoker,
		`--member=serviceAccount:${serviceAccount}`,
		"--role=roles/iam.serviceAccountUser",
		"--project",
		project,
		"--quiet",
	]);
}

run(
	"gcloud",
	[
		"tasks",
		"queues",
		"create",
		"exampull-jobs",
		"--location",
		region,
		"--max-attempts",
		"5",
		"--min-backoff",
		"10s",
		"--max-backoff",
		"300s",
		"--max-doublings",
		"4",
		"--max-dispatches-per-second",
		"50",
		"--max-concurrent-dispatches",
		"200",
		"--project",
		project,
	],
	{ allowExists: true },
);

console.log("Project bootstrap commands completed.");
