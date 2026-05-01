import fs from "node:fs/promises";
import path from "node:path";
import { buildExamLatex } from "@/lib/exams/latex";
import { compileLatex } from "@/lib/latex/client";

type EvalCase = {
	id: string;
	title: string;
	topics: string[];
	questionCount: number;
};

const smokeCases: EvalCase[] = [
	{
		id: "thermo-undergrad",
		title: "Thermodynamics and Entropy",
		topics: ["Second law", "Isothermal expansion", "Entropy statements"],
		questionCount: 6,
	},
];

const suiteCases: EvalCase[] = [
	...smokeCases,
	{
		id: "calculus-ap",
		title: "Applications of Derivatives",
		topics: ["Related rates", "Optimization", "Mean value theorem"],
		questionCount: 8,
	},
	{
		id: "organic-scholar",
		title: "Organic Chemistry Mechanisms",
		topics: ["SN1 and SN2", "E1 and E2", "Carbonyl additions"],
		questionCount: 8,
	},
];

function timestamp() {
	return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function runCase(outputDir: string, testCase: EvalCase) {
	const latex = buildExamLatex({
		title: testCase.title,
		topics: testCase.topics,
		questionCount: testCase.questionCount,
		answerKey: false,
	});
	const answerKeyLatex = buildExamLatex({
		title: testCase.title,
		topics: testCase.topics,
		questionCount: testCase.questionCount,
		answerKey: true,
	});
	const caseDir = path.join(outputDir, testCase.id);

	await fs.mkdir(caseDir, { recursive: true });
	await fs.writeFile(path.join(caseDir, "exam.tex"), latex);
	await fs.writeFile(path.join(caseDir, "answer-key.tex"), answerKeyLatex);

	const manifest: Record<string, unknown> = {
		...testCase,
		createdAt: new Date().toISOString(),
		artifacts: ["exam.tex", "answer-key.tex"],
	};

	if (process.env.LATEX_SERVICE_URL) {
		const [examPdf, answerKeyPdf] = await Promise.all([
			compileLatex({ latex }),
			compileLatex({ latex: answerKeyLatex }),
		]);
		await fs.writeFile(path.join(caseDir, "exam.pdf.base64"), examPdf.pdfBase64);
		await fs.writeFile(path.join(caseDir, "answer-key.pdf.base64"), answerKeyPdf.pdfBase64);
		manifest.artifacts = [
			"exam.tex",
			"answer-key.tex",
			"exam.pdf.base64",
			"answer-key.pdf.base64",
		];
		manifest.renderedPages = {
			exam: examPdf.pages.length,
			answerKey: answerKeyPdf.pages.length,
		};
	}

	await fs.writeFile(
		path.join(caseDir, "manifest.json"),
		`${JSON.stringify(manifest, null, 2)}\n`,
	);
	return manifest;
}

async function main() {
	const runSuite = process.argv.includes("--suite");
	const cases = runSuite ? suiteCases : smokeCases;
	const outputDir = path.join(process.cwd(), "artifacts", "eval", timestamp());

	await fs.mkdir(outputDir, { recursive: true });
	const results = [];

	for (const testCase of cases) {
		results.push(await runCase(outputDir, testCase));
	}

	await fs.writeFile(
		path.join(outputDir, "run.json"),
		`${JSON.stringify({ createdAt: new Date().toISOString(), cases: results }, null, 2)}\n`,
	);
	console.log(`Wrote eval artifacts to ${outputDir}`);
}

await main();
