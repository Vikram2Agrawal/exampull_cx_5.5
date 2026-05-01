import { GoogleAuth } from "google-auth-library";
import { z } from "zod";
import { env } from "@/lib/env";

const compileResponseSchema = z.object({
	pdf: z.string(),
	pages: z.array(z.string()).default([]),
});

const auth = new GoogleAuth();

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

	const response = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify({ latex, engine, dpi: 200 }),
	});

	if (!response.ok) {
		throw new Error(`LaTeX service failed with ${response.status}`);
	}

	const parsed = compileResponseSchema.parse(await response.json());

	return {
		pdfBase64: parsed.pdf,
		pages: parsed.pages,
	};
}
