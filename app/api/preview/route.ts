import { NextResponse } from "next/server";
import { z } from "zod";
import { buildExamLatex } from "@/lib/exams/latex";
import { compileLatex } from "@/lib/latex/client";

export const runtime = "nodejs";

const requestSchema = z.object({
	title: z.string().trim().min(3).max(120),
	topics: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
	questionCount: z.number().int().min(1).max(5).default(3),
});

export async function POST(request: Request) {
	try {
		const input = requestSchema.parse(await request.json());
		const latex = buildExamLatex({
			title: input.title,
			topics: input.topics,
			questionCount: input.questionCount,
			answerKey: false,
		});
		const compiled = await compileLatex({ latex });

		return NextResponse.json({
			pdfBase64: compiled.pdfBase64,
			pageCount: compiled.pages.length,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Preview generation failed.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
