"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function TriageAction({
	collectionName,
	itemId,
	currentStatus,
}: {
	collectionName: "feedback" | "abuseReports";
	itemId: string;
	currentStatus: string;
}) {
	const router = useRouter();
	const [status, setStatus] = useState(currentStatus);
	const [isPending, startTransition] = useTransition();

	function update(nextStatus: string) {
		setStatus(nextStatus);
		startTransition(async () => {
			await fetch(`/api/admin/triage/${collectionName}/${itemId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: nextStatus }),
			});
			router.refresh();
		});
	}

	return (
		<select
			className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
			disabled={isPending}
			value={status}
			onChange={(event) => update(event.target.value)}
		>
			<option value="open">open</option>
			<option value="reviewing">reviewing</option>
			<option value="resolved">resolved</option>
			<option value="dismissed">dismissed</option>
		</select>
	);
}
