import { describe, expect, it } from "vitest";
import { canUseDeterministicAiFallback } from "@/lib/ai/client";
import { canUseDeterministicLatexFallback } from "@/lib/latex/client";

describe("production deterministic fallbacks", () => {
	it("blocks AI fallback in production unless the explicit mock gate is active", () => {
		expect(
			canUseDeterministicAiFallback({
				nodeEnv: "production",
				mockEnabled: false,
			}),
		).toBe(false);
		expect(
			canUseDeterministicAiFallback({
				nodeEnv: "production",
				mockEnabled: true,
			}),
		).toBe(true);
		expect(
			canUseDeterministicAiFallback({
				nodeEnv: "test",
				mockEnabled: false,
			}),
		).toBe(true);
	});

	it("blocks LaTeX PDF fallback in production", () => {
		expect(canUseDeterministicLatexFallback("production")).toBe(false);
		expect(canUseDeterministicLatexFallback("test")).toBe(true);
		expect(canUseDeterministicLatexFallback(undefined)).toBe(true);
	});
});
