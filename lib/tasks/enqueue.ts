import type { CloudTasksClient } from "@google-cloud/tasks";
import { env, publicBaseUrl } from "@/lib/env";

let clientPromise: Promise<CloudTasksClient> | null = null;

async function cloudTasksClient() {
	clientPromise ??= import("@google-cloud/tasks").then(
		({ CloudTasksClient }) => new CloudTasksClient(),
	);

	return clientPromise;
}

export async function enqueueWorkerTask({
	route,
	payload,
}: {
	route: `/api/workers/${string}`;
	payload: Record<string, unknown>;
}) {
	const project = env.GOOGLE_CLOUD_PROJECT;
	const location = process.env.CLOUD_TASKS_LOCATION || env.GOOGLE_CLOUD_REGION;
	const queue = process.env.CLOUD_TASKS_QUEUE || "exampull-jobs";
	const invoker = process.env.CLOUD_TASKS_INVOKER_SA;

	if (!project || !invoker || !env.WEB_URL) {
		return { queued: false, reason: "Cloud Tasks env missing" };
	}

	const client = await cloudTasksClient();
	const parent = client.queuePath(project, location, queue);
	const url = new URL(route, publicBaseUrl()).toString();
	const [task] = await client.createTask({
		parent,
		task: {
			httpRequest: {
				httpMethod: "POST",
				url,
				headers: { "Content-Type": "application/json" },
				body: Buffer.from(JSON.stringify(payload)).toString("base64"),
				oidcToken: {
					serviceAccountEmail: invoker,
					audience: publicBaseUrl(),
				},
			},
			dispatchDeadline: { seconds: 1800 },
		},
	});

	return { queued: true, name: task.name ?? "unknown" };
}
