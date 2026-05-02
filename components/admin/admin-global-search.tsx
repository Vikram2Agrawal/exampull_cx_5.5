"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminSearchResult } from "@/lib/admin/search-types";

function resultHref(query: string, result: AdminSearchResult) {
	const params = new URLSearchParams({ q: query.trim() });

	return `/admin/search?${params.toString()}#${result.anchor}`;
}

export function AdminGlobalSearch() {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<AdminSearchResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [open, setOpen] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	const trimmedQuery = query.trim();
	const searchPageHref = useMemo(() => {
		const params = new URLSearchParams({ q: trimmedQuery });

		return `/admin/search?${params.toString()}`;
	}, [trimmedQuery]);

	useEffect(() => {
		abortRef.current?.abort();

		if (trimmedQuery.length < 2) {
			setResults([]);
			setLoading(false);
			return;
		}

		const controller = new AbortController();
		abortRef.current = controller;
		setLoading(true);
		const timer = window.setTimeout(() => {
			fetch(`/api/admin/search?q=${encodeURIComponent(trimmedQuery)}`, {
				signal: controller.signal,
			})
				.then(async (response) => {
					if (!response.ok) {
						throw new Error("Admin search failed.");
					}

					const payload = (await response.json()) as { results?: AdminSearchResult[] };
					setResults(Array.isArray(payload.results) ? payload.results : []);
				})
				.catch((error: unknown) => {
					if (error instanceof DOMException && error.name === "AbortError") {
						return;
					}

					setResults([]);
				})
				.finally(() => {
					if (!controller.signal.aborted) {
						setLoading(false);
					}
				});
		}, 160);

		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [trimmedQuery]);

	return (
		<form
			className="relative w-full max-w-lg"
			action="/admin/search"
			onSubmit={(event) => {
				if (trimmedQuery.length < 2) {
					event.preventDefault();
				}
			}}
		>
			<Search
				aria-hidden="true"
				className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
				size={16}
			/>
			<input
				aria-label="Admin search"
				autoComplete="off"
				className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-10 text-sm outline-none focus:ring-2 focus:ring-slate-950"
				name="q"
				onBlur={() => {
					window.setTimeout(() => setOpen(false), 120);
				}}
				onChange={(event) => {
					setQuery(event.target.value);
					setOpen(true);
				}}
				onFocus={() => setOpen(true)}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						setOpen(false);
					}
				}}
				placeholder="Search users, exams, share links"
				value={query}
			/>
			{loading ? (
				<Loader2
					aria-hidden="true"
					className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
					size={16}
				/>
			) : null}
			{open && trimmedQuery.length >= 2 ? (
				<div
					className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
					data-testid="admin-global-search-results"
				>
					<div className="max-h-[420px] overflow-y-auto p-2">
						{results.length > 0 ? (
							results.map((result) => (
								<a
									className="block rounded-md px-3 py-2 text-sm hover:bg-slate-50"
									data-testid="admin-global-search-result"
									href={resultHref(trimmedQuery, result)}
									key={`${result.type}-${result.id}`}
								>
									<div className="flex items-center justify-between gap-3">
										<p className="min-w-0 truncate font-medium text-slate-950">
											{result.label}
										</p>
										<span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
											{result.type}
										</span>
									</div>
									<p className="mt-1 truncate text-xs text-slate-500">
										{result.description}
									</p>
									<p className="mt-1 truncate text-[11px] text-slate-400">
										{result.meta}
									</p>
								</a>
							))
						) : (
							<p className="px-3 py-4 text-sm text-slate-500">
								{loading ? "Searching..." : "No matches found."}
							</p>
						)}
					</div>
					<a
						className="block border-t border-slate-100 px-4 py-3 text-sm font-medium text-slate-950 hover:bg-slate-50"
						href={searchPageHref}
					>
						View all results
					</a>
				</div>
			) : null}
		</form>
	);
}
