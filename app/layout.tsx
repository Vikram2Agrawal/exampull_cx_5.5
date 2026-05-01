import type { Metadata } from "next";
import { Geist, Source_Serif_4 } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
	display: "swap",
});

const sourceSerif = Source_Serif_4({
	subsets: ["latin"],
	variable: "--font-source-serif",
	display: "swap",
});

export const metadata: Metadata = {
	title: "ExamPull - Exam-ready PDFs from your course materials",
	description:
		"Generate professional, LaTeX-typeset practice exams, answer keys, grading, and visual feedback from your own course materials.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`${geistSans.variable} ${sourceSerif.variable}`}>
			<body>
				{children}
				<Toaster richColors position="top-right" />
			</body>
		</html>
	);
}
