export type ParsedTopicExtraction = {
	topics: string[];
	extractedContext: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringItems(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((item): item is string => typeof item === "string");
}

function extractJsonObject(value: string) {
	const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
	const candidate = fenced ?? value;
	const start = candidate.indexOf("{");
	const end = candidate.lastIndexOf("}");

	if (start < 0 || end <= start) {
		return null;
	}

	try {
		const decoded: unknown = JSON.parse(candidate.slice(start, end + 1));
		return isRecord(decoded) ? decoded : null;
	} catch {
		return null;
	}
}

function normalizedContext(value: string) {
	return value.replace(/\s+/g, " ").trim().slice(0, 12000);
}

export function parseTopicLines(content: string, fallback: string, limit = 12) {
	const candidates = content
		.split(/\n|;/)
		.flatMap((line) => line.split(/,(?=\s*[A-Z0-9])/))
		.map((line) => line.replace(/^\s*[-*\u2022\d.)]+/, "").trim())
		.filter((line) => line.length > 2 && line.length <= 120)
		.slice(0, limit);

	if (candidates.length > 0) {
		return Array.from(new Set(candidates));
	}

	return fallback
		.split(/[-_.,\s]+/)
		.map((piece) => piece.trim())
		.filter((piece) => piece.length > 3)
		.slice(0, Math.min(8, limit));
}

export function parseTopicExtractionResponse(
	content: string,
	fallback: string,
	limit = 12,
): ParsedTopicExtraction {
	const decoded = extractJsonObject(content);

	if (decoded) {
		const topicText = stringItems(decoded.topics).join("\n");
		const extractedContext =
			typeof decoded.extractedContext === "string"
				? decoded.extractedContext
				: typeof decoded.sourceContext === "string"
					? decoded.sourceContext
					: "";

		return {
			topics: parseTopicLines(topicText, fallback, limit),
			extractedContext: normalizedContext(extractedContext),
		};
	}

	return {
		topics: parseTopicLines(content, fallback, limit),
		extractedContext: normalizedContext(content),
	};
}
