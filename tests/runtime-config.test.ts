import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { runtimeConfigFromData } from "@/lib/config/runtime";

describe("runtime config parser", () => {
	it("defaults preview generation to enabled", () => {
		expect(runtimeConfigFromData(undefined)).toMatchObject({
			previewGenerationDisabled: false,
			previewDisabledMessage:
				"Preview generation is temporarily paused. Sign up free to generate a full exam.",
			updatedAt: null,
		});
	});

	it("reads preview kill-switch state and message", () => {
		const updatedAt = Timestamp.now();

		expect(
			runtimeConfigFromData({
				previewGenerationDisabled: true,
				previewDisabledMessage: "Paused while queue latency recovers.",
				updatedAt,
			}),
		).toEqual({
			previewGenerationDisabled: true,
			previewDisabledMessage: "Paused while queue latency recovers.",
			updatedAt,
		});
	});
});
