import { describe, expect, it } from "vitest";
import { sanitizeLatex } from "@/lib/latex/sanitize";

describe("LaTeX sanitizer", () => {
	it("allows ordinary exam content", () => {
		expect(sanitizeLatex("\\begin{questions}\\item Solve $x^2=4$.\\end{questions}")).toContain(
			"Solve",
		);
	});

	it("blocks shell escape", () => {
		expect(() => sanitizeLatex("\\write18{rm -rf /}")).toThrow("blocked command");
	});
});
