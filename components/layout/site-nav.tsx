import { Bell, BookOpen, FileText, GraduationCap, Settings } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { FeaturebaseHelpButton } from "@/components/feedback/featurebase-help-button";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const publicLinks = [
	{ href: "/pricing", label: "Pricing" },
	{ href: "/roadmap", label: "Roadmap" },
	{ href: "/changelog", label: "Changelog" },
	{ href: "/support", label: "Support" },
] as const;

const appLinks = [
	{ id: "dashboard", href: "/dashboard", label: "Dashboard", icon: BookOpen },
	{ id: "classes", href: "/classes", label: "Classes", icon: GraduationCap },
	{ id: "exams", href: "/exams", label: "Exams", icon: FileText },
	{ id: "notifications", href: "/notifications", label: "Alerts", icon: Bell },
	{ id: "settings", href: "/settings", label: "Settings", icon: Settings },
] as const;

export function PublicNav() {
	return (
		<header className="sticky top-0 z-40 border-b border-glass-border bg-background/80 backdrop-blur-xl">
			<nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
				<a
					href="/"
					className="flex min-h-11 items-center gap-2 font-semibold text-foreground"
				>
					<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
						E
					</span>
					<span>ExamPull</span>
				</a>
				<div className="hidden items-center gap-6 md:flex">
					{publicLinks.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="text-sm text-muted hover:text-foreground"
						>
							{link.label}
						</a>
					))}
				</div>
				<div className="flex items-center gap-2">
					<ButtonLink href="/sign-in" variant="ghost" className="hidden sm:inline-flex">
						Sign in
					</ButtonLink>
					<ButtonLink href="/sign-up" variant="primary">
						Start free
					</ButtonLink>
				</div>
			</nav>
		</header>
	);
}

export function AppShell({
	children,
	active,
	unreadNotificationCount = 0,
	theme = "system",
}: {
	children: React.ReactNode;
	active?: string;
	unreadNotificationCount?: number;
	theme?: "system" | "light" | "dark";
}) {
	const unreadLabel =
		unreadNotificationCount > 99 ? "99+" : String(Math.max(0, unreadNotificationCount));

	return (
		<div
			className={cn(
				"min-h-screen bg-background text-foreground",
				theme === "light" && "light",
				theme === "dark" && "dark",
			)}
		>
			<header className="sticky top-0 z-40 border-b border-glass-border bg-background/85 backdrop-blur-xl">
				<nav
					className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6"
					aria-label="Application"
				>
					<a href="/dashboard" className="flex min-h-11 items-center gap-2 font-semibold">
						<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
							E
						</span>
						<span>ExamPull</span>
					</a>
					<div className="hidden items-center gap-1 md:flex">
						{appLinks.map((link) => {
							const Icon = link.icon;

							return (
								<a
									key={link.href}
									href={link.href}
									aria-label={
										link.label === "Alerts" && unreadNotificationCount > 0
											? `Alerts, ${unreadLabel} unread notifications`
											: undefined
									}
									className={cn(
										"relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-glass hover:text-foreground",
										active === link.id && "bg-glass-strong text-foreground",
									)}
								>
									<Icon aria-hidden="true" size={16} />
									{link.label}
									{link.label === "Alerts" && unreadNotificationCount > 0 ? (
										<span className="ml-1 min-w-5 rounded-full bg-premium px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-premium-foreground">
											{unreadLabel}
										</span>
									) : null}
								</a>
							);
						})}
					</div>
					<ButtonLink href="/exams/new" variant="primary">
						New exam
					</ButtonLink>
					<div className="hidden lg:block">
						<SignOutButton />
					</div>
				</nav>
			</header>
			<main id="main-content" className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 md:pb-8">
				{children}
			</main>
			<nav
				className="fixed inset-x-0 bottom-0 z-40 border-t border-glass-border bg-background/90 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl md:hidden"
				aria-label="Mobile application"
			>
				<div className="mx-auto grid max-w-md grid-cols-5 gap-1">
					{appLinks.map((link) => {
						const Icon = link.icon;

						return (
							<a
								key={link.href}
								href={link.href}
								aria-label={
									link.label === "Alerts" && unreadNotificationCount > 0
										? `Alerts, ${unreadLabel} unread notifications`
										: link.label
								}
								className={cn(
									"relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium text-muted transition hover:bg-glass hover:text-foreground",
									active === link.id && "bg-glass-strong text-foreground",
								)}
							>
								<Icon aria-hidden="true" size={18} />
								<span>{link.label}</span>
								{link.label === "Alerts" && unreadNotificationCount > 0 ? (
									<span className="absolute right-2 top-1 min-w-5 rounded-full bg-premium px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-premium-foreground">
										{unreadLabel}
									</span>
								) : null}
							</a>
						);
					})}
				</div>
			</nav>
			<FeaturebaseHelpButton theme={theme} />
		</div>
	);
}
