import { Bell, BookOpen, FileText, GraduationCap, HelpCircle, Settings } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const publicLinks = [
	{ href: "/pricing", label: "Pricing" },
	{ href: "/roadmap", label: "Roadmap" },
	{ href: "/changelog", label: "Changelog" },
	{ href: "/support", label: "Support" },
] as const;

const appLinks = [
	{ href: "/dashboard", label: "Dashboard", icon: BookOpen },
	{ href: "/classes", label: "Classes", icon: GraduationCap },
	{ href: "/exams", label: "Exams", icon: FileText },
	{ href: "/notifications", label: "Alerts", icon: Bell },
	{ href: "/settings", label: "Settings", icon: Settings },
] as const;

export function PublicNav() {
	return (
		<header className="sticky top-0 z-40 border-b border-glass-border bg-background/80 backdrop-blur-xl">
			<nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
				<a href="/" className="flex items-center gap-2 font-semibold text-foreground">
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
						Generate exam
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
}: {
	children: React.ReactNode;
	active?: string;
	unreadNotificationCount?: number;
}) {
	const unreadLabel =
		unreadNotificationCount > 99 ? "99+" : String(Math.max(0, unreadNotificationCount));

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="sticky top-0 z-40 border-b border-glass-border bg-background/85 backdrop-blur-xl">
				<nav
					className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6"
					aria-label="Application"
				>
					<a href="/dashboard" className="flex items-center gap-2 font-semibold">
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
										active === link.label.toLowerCase() &&
											"bg-glass-strong text-foreground",
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
			<main id="main-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
				{children}
			</main>
			<button
				type="button"
				aria-label="Open help and feedback"
				className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-glass-border bg-glass-strong text-foreground shadow-glass"
			>
				<HelpCircle aria-hidden="true" size={20} />
			</button>
		</div>
	);
}
