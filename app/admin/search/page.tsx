import { ArrowUpRight } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { searchAdmin } from "@/lib/admin/search";

export const dynamic = "force-dynamic";

type AdminSearchPageProps = {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function paramValue(value: string | string[] | undefined) {
	if (Array.isArray(value)) {
		return value[0] ?? "";
	}

	return value ?? "";
}

function dateLabel(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value));
}

export default async function AdminSearchPage({ searchParams }: AdminSearchPageProps) {
	const params = (await searchParams) ?? {};
	const query = paramValue(params.q).trim();
	const results = query.length >= 2 ? await searchAdmin(query, 50) : [];

	return (
		<AdminShell active="">
			<section className="space-y-6">
				<div>
					<p className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
						Global Search
					</p>
					<h1 className="mt-2 text-3xl font-semibold">Global Search</h1>
					<p className="mt-2 text-sm text-slate-500">
						{query.length >= 2
							? `${results.length.toString()} result${results.length === 1 ? "" : "s"} for "${query}".`
							: "Enter at least two characters in the admin search bar."}
					</p>
				</div>
				<div className="space-y-3">
					{results.map((result) => (
						<article
							className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
							id={result.anchor}
							key={`${result.type}-${result.id}`}
						>
							<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
											{result.type}
										</span>
										<span className="text-xs text-slate-400">
											{dateLabel(result.createdAt)}
										</span>
									</div>
									<h2 className="mt-2 text-lg font-semibold text-slate-950">
										{result.label}
									</h2>
									<p className="mt-1 text-sm text-slate-600">
										{result.description}
									</p>
									<p className="mt-2 break-all font-mono text-xs text-slate-400">
										{result.meta}
									</p>
								</div>
								<a
									className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
									href={result.href}
								>
									Open section
									<ArrowUpRight aria-hidden="true" size={15} />
								</a>
							</div>
						</article>
					))}
					{query.length >= 2 && results.length === 0 ? (
						<div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
							No matching users, exams, classes, feedback, abuse reports, or share
							links.
						</div>
					) : null}
				</div>
			</section>
		</AdminShell>
	);
}
