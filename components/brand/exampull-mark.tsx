import { cn } from "@/lib/utils";

export function ExamPullMark({ className }: { className?: string }) {
	return (
		<svg
			className={cn("h-6 w-6", className)}
			viewBox="0 0 260 390"
			role="img"
			aria-label="ExamPull"
		>
			<path
				d="M219 30H78C59.22 30 44 45.22 44 64v252c0 18.78 15.22 34 34 34h141c-3.04-10.24-12.38-17-25-17H94c-11.6 0-21-9.4-21-21V68c0-11.6 9.4-21 21-21h100c12.62 0 21.96-6.76 25-17Z"
				fill="currentColor"
			/>
			<rect x="104" y="108" width="114" height="14" rx="7" fill="currentColor" />
			<rect x="104" y="188" width="114" height="14" rx="7" fill="currentColor" />
			<rect x="104" y="264" width="114" height="14" rx="7" fill="currentColor" />
		</svg>
	);
}
