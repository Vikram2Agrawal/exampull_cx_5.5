import {
	Activity,
	BarChart3,
	FileText,
	Flag,
	MessageSquare,
	Network,
	RefreshCw,
	Settings,
	ShieldCheck,
	Users,
} from "lucide-react";
import { cookies } from "next/headers";
import { AdminCsrfProvider } from "@/components/admin/admin-csrf";
import { AdminGlobalSearch } from "@/components/admin/admin-global-search";
import { AdminMobileReadOnly } from "@/components/admin/admin-mobile-readonly";
import { createAdminCsrfToken } from "@/lib/admin/session";
import { cn } from "@/lib/utils";

const nav = [
	{ href: "/admin", label: "Overview", icon: Activity },
	{ href: "/admin/users", label: "Users", icon: Users },
	{ href: "/admin/exams", label: "Exams", icon: FileText },
	{ href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
	{ href: "/admin/operations", label: "Operations", icon: RefreshCw },
	{ href: "/admin/communications", label: "Communications", icon: MessageSquare },
	{ href: "/admin/abuse", label: "Abuse", icon: Flag },
	{ href: "/admin/referrals", label: "Referrals", icon: Network },
	{ href: "/admin/configuration", label: "Configuration", icon: Settings },
	{ href: "/admin/audit-log", label: "Audit Log", icon: ShieldCheck },
] as const;

async function currentAdminCsrfToken() {
	const cookieStore = await cookies();
	const sessionToken = cookieStore.get("admin_session")?.value;

	return sessionToken ? createAdminCsrfToken(sessionToken) : "";
}

export async function AdminShell({
	children,
	active,
}: {
	children: React.ReactNode;
	active: string;
}) {
	const csrfToken = await currentAdminCsrfToken();

	return (
		<AdminCsrfProvider token={csrfToken}>
			<div
				className="min-h-screen bg-slate-50 text-slate-950"
				data-admin-csrf-token={csrfToken}
			>
				<aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
					<div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5 font-semibold">
						<span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-white">
							E
						</span>
						Admin
					</div>
					<nav className="space-y-1 p-3" aria-label="Admin sections">
						{nav.map((item) => {
							const Icon = item.icon;

							return (
								<a
									key={item.href}
									href={item.href}
									className={cn(
										"flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-950",
										active === item.label && "bg-slate-100 text-slate-950",
									)}
								>
									<Icon aria-hidden="true" size={16} />
									{item.label}
								</a>
							);
						})}
					</nav>
				</aside>
				<div className="lg:pl-64">
					<header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
						<div className="flex min-w-0 flex-1 items-center gap-3">
							<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white lg:hidden">
								E
							</span>
							<AdminGlobalSearch />
						</div>
						<span className="ml-4 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
							Agent session
						</span>
					</header>
					<nav
						className="sticky top-16 z-20 flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 lg:hidden"
						aria-label="Admin mobile sections"
					>
						{nav.map((item) => (
							<a
								key={item.href}
								href={item.href}
								className={cn(
									"whitespace-nowrap rounded-md px-3 py-2 text-sm text-slate-600",
									active === item.label && "bg-slate-950 text-white",
								)}
							>
								{item.label}
							</a>
						))}
					</nav>
					<div
						className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 lg:hidden"
						role="status"
					>
						Mobile admin is read-only. Review data here, then switch to desktop for
						credits, refunds, triage, broadcasts, and account changes.
					</div>
					<main
						id="main-content"
						className="p-4 max-lg:[&_button]:pointer-events-none max-lg:[&_button]:cursor-not-allowed max-lg:[&_button]:opacity-60 max-lg:[&_form]:pointer-events-none max-lg:[&_form]:select-none max-lg:[&_form]:opacity-60 max-lg:[&_input]:pointer-events-none max-lg:[&_input]:cursor-not-allowed max-lg:[&_select]:pointer-events-none max-lg:[&_select]:cursor-not-allowed max-lg:[&_textarea]:pointer-events-none max-lg:[&_textarea]:cursor-not-allowed lg:p-6"
					>
						{children}
					</main>
					<AdminMobileReadOnly rootId="main-content" />
				</div>
			</div>
		</AdminCsrfProvider>
	);
}

export function AdminTable({
	title,
	description,
	headers,
	rows,
	empty,
}: {
	title: string;
	description?: string;
	headers: string[];
	rows: Array<{ key: string; cells: React.ReactNode[] }>;
	empty: string;
}) {
	return (
		<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
			<div className="border-b border-slate-200 p-5">
				<h1 className="text-2xl font-semibold">{title}</h1>
				{description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
			</div>
			<div className="overflow-x-auto">
				<table className="w-full text-left text-sm">
					<thead className="bg-slate-50 text-slate-500">
						<tr>
							{headers.map((header) => (
								<th
									key={header}
									className="whitespace-nowrap px-4 py-3 font-medium"
								>
									{header}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{rows.length > 0 ? (
							rows.map((row) => (
								<tr key={row.key}>
									{row.cells.map((cell, cellIndex) => (
										<td
											key={`${row.key}-${cellIndex.toString()}`}
											className="max-w-[320px] px-4 py-3 align-top"
										>
											{cell}
										</td>
									))}
								</tr>
							))
						) : (
							<tr>
								<td
									className="px-4 py-10 text-center text-slate-500"
									colSpan={headers.length}
								>
									{empty}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</section>
	);
}

export function AdminCard({
	title,
	value,
	description,
}: {
	title: string;
	value: string;
	description: string;
}) {
	return (
		<div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
			<p className="text-sm text-slate-500">{title}</p>
			<p className="mt-2 text-3xl font-semibold">{value}</p>
			<p className="mt-2 text-sm text-slate-500">{description}</p>
		</div>
	);
}
