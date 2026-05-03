import { GoogleAuth } from "google-auth-library";
import { env, publicBaseUrl } from "@/lib/env";

const cloudPlatformScope = "https://www.googleapis.com/auth/cloud-platform";

let authPromise: Promise<GoogleAuth> | null = null;

function cloudTasksParent(project: string, location: string, queue: string) {
	return `projects/${project}/locations/${location}/queues/${queue}`;
}

async function cloudTasksAccessToken() {
	authPromise ??= Promise.resolve(new GoogleAuth({ scopes: [cloudPlatformScope] }));
	const auth = await authPromise;
	const client = await auth.getClient();
	const token = await client.getAccessToken();
	const accessToken = typeof token === "string" ? token : token.token;

	if (!accessToken) {
		throw new Error("Cloud Tasks auth did not return an access token.");
	}

	return accessToken;
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

	const parent = cloudTasksParent(project, location, queue);
	const url = new URL(route, publicBaseUrl()).toString();
	const response = await fetch(`https://cloudtasks.googleapis.com/v2/${parent}/tasks`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${await cloudTasksAccessToken()}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
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
				dispatchDeadline: "1800s",
			},
		}),
	});

	if (!response.ok) {
		throw new Error(
			`Cloud Tasks enqueue failed with ${response.status.toString()}: ${await response.text()}`,
		);
	}

	const task = (await response.json()) as { name?: string };

	return { queued: true, name: task.name ?? "unknown" };
}
