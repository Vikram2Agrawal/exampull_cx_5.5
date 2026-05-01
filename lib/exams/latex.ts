import { sanitizeLatex } from "@/lib/latex/sanitize";

function questionTopic(topics: string[], index: number) {
	if (topics.length === 0) {
		return "the selected course material";
	}

	return topics[index % topics.length] ?? topics[0];
}

function latexEscape(value: string) {
	return value
		.replaceAll("\\", "\\textbackslash{}")
		.replaceAll("&", "\\&")
		.replaceAll("%", "\\%")
		.replaceAll("$", "\\$")
		.replaceAll("#", "\\#")
		.replaceAll("_", "\\_")
		.replaceAll("{", "\\{")
		.replaceAll("}", "\\}")
		.replaceAll("~", "\\textasciitilde{}")
		.replaceAll("^", "\\textasciicircum{}");
}

export function buildExamLatex({
	title,
	topics,
	questionCount,
	answerKey,
}: {
	title: string;
	topics: string[];
	questionCount: number;
	answerKey: boolean;
}) {
	const questions = Array.from({ length: questionCount }, (_, index) => {
		const topic = latexEscape(questionTopic(topics, index));
		const prompt = `\\question[10] Explain the central idea behind ${topic}, then solve a representative problem that uses it.`;
		const solution = answerKey
			? `\n\\begin{solution}\nA complete answer should define ${topic}, identify the relevant assumptions, show each step of the reasoning, and end with the final result in context.\n\\end{solution}`
			: "\n\\vspace{2.2in}";

		return `${prompt}${solution}`;
	}).join("\n\n");

	return sanitizeLatex(String.raw`
\documentclass[11pt,addpoints]{exam}
\usepackage{amsmath,amssymb,geometry}
\geometry{margin=1in}
${answerKey ? "\\printanswers" : "\\noprintanswers"}
\pagestyle{headandfoot}
\firstpageheader{ExamPull}{${latexEscape(title)}}{\today}
\runningheader{ExamPull}{${latexEscape(title)}}{Page \thepage\ of \numpages}
\firstpagefooter{}{}{}
\runningfooter{}{}{}
\begin{document}
\begin{center}
{\Large\bfseries ${latexEscape(title)}}\\
\vspace{0.2in}
${answerKey ? "Answer Key" : "Practice Exam"}
\end{center}
\vspace{0.15in}
\makebox[\textwidth]{Name:\enspace\hrulefill}
\vspace{0.25in}
\begin{questions}
${questions}
\end{questions}
\end{document}
`);
}
