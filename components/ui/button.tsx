import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "premium" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
	primary:
		"bg-brand text-white shadow-lg shadow-brand/25 hover:bg-brand-hover focus-visible:ring-brand",
	secondary:
		"border border-glass-border bg-glass text-foreground hover:bg-glass-strong focus-visible:ring-brand",
	premium:
		"bg-premium text-premium-foreground shadow-lg shadow-premium/20 hover:bg-premium-hover focus-visible:ring-premium",
	danger: "bg-error text-white shadow-lg shadow-error/20 hover:bg-error/90 focus-visible:ring-error",
	ghost: "bg-transparent text-muted hover:bg-glass focus-visible:ring-brand",
};

const sizes: Record<ButtonSize, string> = {
	sm: "h-9 gap-2 px-3 text-sm",
	md: "h-11 gap-2 px-4 text-sm",
	lg: "h-12 gap-2 px-5 text-base",
	icon: "h-11 w-11 justify-center p-0",
};

type BaseProps = {
	variant?: ButtonVariant;
	size?: ButtonSize;
	children: ReactNode;
	className?: string;
};

type ButtonProps = BaseProps & ComponentPropsWithoutRef<"button">;

export function Button({
	variant = "secondary",
	size = "md",
	className,
	children,
	...props
}: ButtonProps) {
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center rounded-lg font-medium transition duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
				variants[variant],
				sizes[size],
				className,
			)}
			{...props}
		>
			{children}
		</button>
	);
}

type ButtonLinkProps = BaseProps & ComponentPropsWithoutRef<typeof Link>;

export function ButtonLink({
	variant = "secondary",
	size = "md",
	className,
	children,
	...props
}: ButtonLinkProps) {
	return (
		<Link
			className={cn(
				"inline-flex items-center justify-center rounded-lg font-medium transition duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				variants[variant],
				sizes[size],
				className,
			)}
			{...props}
		>
			{children}
		</Link>
	);
}
