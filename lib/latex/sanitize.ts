const blockedPatterns = [
	/\\write18\b/u,
	/\\immediate\s*\\write\b/u,
	/\\input\s*\{/u,
	/\\include\s*\{/u,
	/\\openin\b/u,
	/\\openout\b/u,
	/\\read\b/u,
	/\\catcode\b/u,
	/\\directlua\b/u,
	/\\latelua\b/u,
	/\\ShellEscape\b/u,
	/\\[A-Za-z]+\s*\{(?:\/|~|\.\.|\$)/u,
];

export function sanitizeLatex(latex: string) {
	const blocked = blockedPatterns.find((pattern) => pattern.test(latex));

	if (blocked) {
		throw new Error("Generated LaTeX contained a blocked command.");
	}

	return latex;
}
