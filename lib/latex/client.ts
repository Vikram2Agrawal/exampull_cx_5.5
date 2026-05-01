import { GoogleAuth } from "google-auth-library";
import { z } from "zod";
import { env } from "@/lib/env";

const compileResponseSchema = z.object({
	pdf: z.string(),
	pages: z.array(z.string()).default([]),
});

const auth = new GoogleAuth();

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number) {
	return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export async function compileLatex({
	latex,
	engine = "pdflatex",
}: {
	latex: string;
	engine?: "pdflatex" | "xelatex";
}) {
	if (!env.LATEX_SERVICE_URL) {
		return {
			pdfBase64: Buffer.from(`PDF fallback for:\n${latex}`).toString("base64"),
			pages: [],
		};
	}

	const url = `${env.LATEX_SERVICE_URL}/compile-and-render`;
	const headers = new Headers({ "Content-Type": "application/json" });

	if (process.env.LATEX_SERVICE_AUTH_DISABLED !== "true") {
		const client = await auth.getIdTokenClient(env.LATEX_SERVICE_URL);
		const requestHeaders = await client.getRequestHeaders(url);
		const authorization = requestHeaders.get("authorization");

		if (authorization) {
			headers.set("Authorization", authorization);
		}
	}

	let lastStatus = 0;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const response = await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify({ latex, engine, dpi: 200 }),
		});

		if (response.ok) {
			const parsed = compileResponseSchema.parse(await response.json());

			return {
				pdfBase64: parsed.pdf,
				pages: parsed.pages,
			};
		}

		lastStatus = response.status;
		if (!shouldRetry(response.status) || attempt === 2) {
			break;
		}

		await delay(500 * 2 ** attempt);
	}

	throw new Error(`LaTeX service failed with ${lastStatus}`);
}
