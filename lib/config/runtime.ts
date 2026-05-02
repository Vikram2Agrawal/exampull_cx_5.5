import { adminDb, Timestamp } from "@/lib/firebase/admin";

export type RuntimeConfig = {
	previewGenerationDisabled: boolean;
	previewDisabledMessage: string;
	updatedAt: FirebaseFirestore.Timestamp | null;
};

const defaultPreviewDisabledMessage =
	"Preview generation is temporarily paused. Sign up free to generate a full exam.";

function text(value: unknown, fallback: string) {
	return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function runtimeConfigFromData(data: FirebaseFirestore.DocumentData | undefined) {
	return {
		previewGenerationDisabled: data?.previewGenerationDisabled === true,
		previewDisabledMessage: text(data?.previewDisabledMessage, defaultPreviewDisabledMessage),
		updatedAt: data?.updatedAt instanceof Timestamp ? data.updatedAt : null,
	} satisfies RuntimeConfig;
}

export async function getRuntimeConfig() {
	const snapshot = await adminDb.collection("config").doc("runtime").get();

	return runtimeConfigFromData(snapshot.data());
}

export async function setPreviewGenerationDisabled({
	disabled,
	message,
}: {
	disabled: boolean;
	message?: string;
}) {
	const now = Timestamp.now();
	const previewDisabledMessage = text(message, defaultPreviewDisabledMessage);

	await adminDb.collection("config").doc("runtime").set(
		{
			previewGenerationDisabled: disabled,
			previewDisabledMessage,
			updatedAt: now,
		},
		{ merge: true },
	);

	return {
		previewGenerationDisabled: disabled,
		previewDisabledMessage,
		updatedAt: now,
	} satisfies RuntimeConfig;
}
