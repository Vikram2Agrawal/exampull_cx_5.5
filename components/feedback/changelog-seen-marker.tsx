"use client";

import { useEffect } from "react";

export function ChangelogSeenMarker() {
	useEffect(() => {
		void fetch("/api/featurebase/changelog-seen", { method: "POST" });
	}, []);

	return null;
}
