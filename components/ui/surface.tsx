import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
	children: ReactNode;
	interactive?: boolean;
};

type SurfaceVariant = "panel" | "card" | "inset" | "toolbar" | "danger";
type SurfaceDensity = "compact" | "normal" | "spacious";

const surfaceVariants: Record<SurfaceVariant, string> = {
	panel: "border-glass-border bg-glass shadow-glass",
	card: "border-glass-border bg-glass-strong shadow-glass",
	inset: "border-glass-border bg-background/55 shadow-none",
	toolbar: "border-glass-border bg-background/70 shadow-none backdrop-blur-xl",
	danger: "border-error/35 bg-error/10 shadow-none",
};

const surfaceDensities: Record<SurfaceDensity, string> = {
	compact: "p-3",
	normal: "p-5",
	spacious: "p-6 md:p-7",
};

type ComposedSurfaceProps = SurfaceProps & {
	variant?: SurfaceVariant;
	density?: SurfaceDensity;
};

export function Surface({
	children,
	className,
	interactive = false,
	variant = "panel",
	density = "normal",
	...props
}: ComposedSurfaceProps) {
	return (
		<div
			className={cn(
				"rounded-xl border text-foreground",
				surfaceVariants[variant],
				surfaceDensities[density],
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
			<h1 className="max-w-4xl text-3xl font-semibold tracking-normal text-foreground md:text-4xl">
				{title}
			</h1>
			{children ? (
				<div className="max-w-2xl text-base leading-7 text-muted">{children}</div>
			) : null}
		</div>
	);
}

export function StatusMessage({
	children,
	variant = "info",
	className,
}: {
	children: ReactNode;
	variant?: "success" | "info" | "warning" | "error";
	className?: string;
}) {
	const styles = {
		success: "border-success/30 bg-success/10 text-success",
		info: "border-secondary/25 bg-secondary/10 text-foreground",
		warning: "border-warning/35 bg-warning/12 text-foreground",
		error: "border-error/35 bg-error/10 text-error",
	};

	return (
		<div
			className={cn(
				"rounded-lg border px-3 py-2 text-sm leading-6",
				styles[variant],
				className,
			)}
			role={variant === "error" ? "alert" : "status"}
		>
			{children}
		</div>
	);
}
