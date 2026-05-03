import type { PowerQuestionSlot, QuestionDifficulty, QuestionStyle } from "@/lib/billing/credits";
import { sanitizeLatex } from "@/lib/latex/sanitize";

export type GeneratedExamQuestion = {
	prompt: string;
	answer: string;
	points: number;
};

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

function styleLabel(style: QuestionStyle) {
	switch (style) {
		case "multiple_choice":
			return "Multiple choice";
		case "short_answer":
			return "Short answer";
		case "calculation":
			return "Calculation";
		case "essay":
			return "Essay";
		case "proof":
			return "Proof";
	}
}

function difficultyInstruction(difficulty: QuestionDifficulty) {
	switch (difficulty) {
		case "light":
			return "Define the central idea, then apply it to a familiar case.";
		case "balanced":
			return "Connect the concept to a worked application and explain the reasoning.";
		case "hardcore":
			return "Work through a multi-step case and justify each assumption.";
	}
}

function slotPrompt(slot: PowerQuestionSlot) {
	const topic = latexEscape(slot.topic);
	const style = styleLabel(slot.style);
	const difficulty = difficultyInstruction(slot.difficulty);

	if (slot.style === "multiple_choice") {
		return `\\question[${slot.points}] (${latexEscape(style)}; ${latexEscape(slot.difficulty)}) Which statement best captures ${topic}?\\begin{choices}\\choice It is only a notation convention and has no effect on problem solving.\\choice It identifies the governing relationship and determines which assumptions are valid.\\choice It can be ignored once numerical values are available.\\choice It applies only when every variable is constant.\\end{choices} Briefly justify your choice.`;
	}

	if (slot.style === "proof") {
		return `\\question[${slot.points}] (${latexEscape(style)}; ${latexEscape(slot.difficulty)}) Prove a central claim involving ${topic}. State the assumptions, identify the result to be shown, and write a complete argument.`;
	}

	if (slot.style === "essay") {
		return `\\question[${slot.points}] (${latexEscape(style)}; ${latexEscape(slot.difficulty)}) Write a structured response explaining ${topic}. Include a definition, one concrete example, and a concise conclusion.`;
	}

	if (slot.style === "calculation") {
		return `\\question[${slot.points}] (${latexEscape(style)}; ${latexEscape(slot.difficulty)}) Solve a quantitative problem involving ${topic}. ${difficulty} Show setup, intermediate work, units where relevant, and a final answer.`;
	}

	return `\\question[${slot.points}] (${latexEscape(style)}; ${latexEscape(slot.difficulty)}) Explain ${topic} clearly enough for partial credit. ${difficulty}`;
}

function slotSolution(slot: PowerQuestionSlot) {
	const topic = latexEscape(slot.topic);

	return `\n\\begin{solution}\nA complete answer should address ${topic}, match the requested ${latexEscape(styleLabel(slot.style).toLowerCase())} format, show the key reasoning steps, and earn up to ${slot.points} points with partial credit for correct setup and justified intermediate work.\n\\end{solution}`;
}

export function buildExamLatex({
	title,
	topics,
	questionCount,
	answerKey,
	powerSlots,
	generatedQuestions,
}: {
	title: string;
	topics: string[];
	questionCount: number;
	answerKey: boolean;
	powerSlots?: PowerQuestionSlot[];
	generatedQuestions?: GeneratedExamQuestion[];
}) {
	const questions =
		generatedQuestions && generatedQuestions.length > 0
			? generatedQuestions
					.map((question) => {
						const prompt = `\\question[${question.points}] ${latexEscape(question.prompt)}`;
						const solution = answerKey
							? `\n\\begin{solution}\n${latexEscape(question.answer)}\n\\end{solution}`
							: "\n\\vspace{2.2in}";

						return `${prompt}${solution}`;
					})
					.join("\n\n")
			: (powerSlots && powerSlots.length > 0
					? powerSlots
					: Array.from({ length: questionCount }, (_, index) => ({
							topic: questionTopic(topics, index),
							style: "short_answer" as const,
							difficulty: "balanced" as const,
							points: 10,
						}))
				)
					.map((slot) => {
						const prompt = slotPrompt(slot);
						const solution = answerKey ? slotSolution(slot) : "\n\\vspace{2.2in}";

						return `${prompt}${solution}`;
					})
					.join("\n\n");

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
