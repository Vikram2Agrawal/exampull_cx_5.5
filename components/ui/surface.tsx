import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
	children: ReactNode;
	interactive?: boolean;
};

export function GlassPanel({ children, className, interactive = false, ...props }: SurfaceProps) {
	return (
		<div
			className={cn(
				"rounded-xl border border-glass-border bg-glass text-foreground shadow-glass",
				interactive &&
					"transition duration-200 hover:-translate-y-0.5 hover:bg-glass-strong",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export function Paper({ children, className, interactive = false, ...props }: SurfaceProps) {
	return (
		<div
			className={cn(
				"rounded-paper border border-paper-border bg-paper text-ink shadow-paper",
				"font-serif",
				interactive &&
					"transition duration-200 hover:-translate-y-0.5 hover:shadow-paper-hover",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export function SectionHeader({
	eyebrow,
	title,
	children,
	className,
}: {
	eyebrow?: string;
	title: string;
	children?: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("space-y-3", className)}>
			{eyebrow ? (
				<p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
					{eyebrow}
				</p>
			) : null}
			<h1 className="max-w-4xl text-4xl font-semibold tracking-normal text-foreground md:text-6xl">
				{title}
			</h1>
			{children ? (
				<div className="max-w-2xl text-base leading-7 text-muted">{children}</div>
			) : null}
		</div>
	);
}
