import type { AdminSearchResult, AdminSearchResultType } from "@/lib/admin/search-types";
import { adminDb, Timestamp } from "@/lib/firebase/admin";

type RankedResult = AdminSearchResult & {
	rank: number;
	typeOrder: number;
};

const maxScan = 450;
const typeOrder: Record<AdminSearchResultType, number> = {
	user: 0,
	exam: 1,
	class: 2,
	feedback: 3,
	abuse: 4,
	share: 5,
};

function normalize(value: string) {
	return value.trim().toLowerCase();
}

function text(value: unknown, fallback = "") {
	return typeof value === "string" && value.trim() ? value : fallback;
}

function firestoreCode(error: unknown) {
	if (!error || typeof error !== "object" || !("code" in error)) {
		return null;
	}

	const code = (error as { code?: unknown }).code;

	return typeof code === "number" ? code : null;
}

function stringList(value: unknown) {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
		: [];
}

function isoDate(value: unknown) {
	if (value instanceof Timestamp) {
		return value.toDate().toISOString();
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	return new Date().toISOString();
}

function matchRank(query: string, values: string[]) {
	const normalizedValues = values
		.map((value) => normalize(value))
		.filter((value) => value.length > 0);

	if (normalizedValues.some((value) => value === query)) {
		return 0;
	}

	if (normalizedValues.some((value) => value.startsWith(query))) {
		return 1;
	}

	if (normalizedValues.some((value) => value.includes(query))) {
		return 2;
	}

	return null;
}

function anchorFor(type: AdminSearchResultType, id: string) {
	const safeId = id.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");

	return `admin-search-${type}-${safeId || "result"}`;
}

function addResult(
	results: RankedResult[],
	seen: Set<string>,
	input: Omit<AdminSearchResult, "anchor"> & { rank: number },
) {
	const key = `${input.type}:${input.id}`;

	if (seen.has(key)) {
		return;
	}

	seen.add(key);
	results.push({
		...input,
		anchor: anchorFor(input.type, input.id),
		typeOrder: typeOrder[input.type],
	});
}

function ownerIdFromCollectionGroupDoc(doc: FirebaseFirestore.QueryDocumentSnapshot) {
	return doc.ref.parent.parent?.id ?? "unknown";
}

function sectionHref(path: string, query: string) {
	const params = new URLSearchParams({ search: query });

	return `${path}?${params.toString()}`;
}

async function recentCollectionGroup(name: string) {
	try {
		return await adminDb
			.collectionGroup(name)
			.orderBy("createdAt", "desc")
			.limit(maxScan)
			.get();
	} catch (error) {
		if (firestoreCode(error) !== 9) {
			throw error;
		}

		return adminDb.collectionGroup(name).limit(maxScan).get();
	}
}

export async function searchAdmin(query: string, limit = 12): Promise<AdminSearchResult[]> {
	const normalizedQuery = normalize(query).slice(0, 120);

	if (normalizedQuery.length < 2) {
		return [];
	}

	const [exactUser, users, exams, classes, feedback, abuseReports, exactShare, shareLinks] =
		await Promise.all([
			adminDb.collection("users").doc(query.trim()).get(),
			adminDb.collection("users").orderBy("createdAt", "desc").limit(maxScan).get(),
			recentCollectionGroup("exams"),
			recentCollectionGroup("classes"),
			adminDb.collection("feedback").orderBy("createdAt", "desc").limit(maxScan).get(),
			adminDb.collection("abuseReports").orderBy("createdAt", "desc").limit(maxScan).get(),
			adminDb.collection("share_links").doc(query.trim()).get(),
			adminDb.collection("share_links").orderBy("createdAt", "desc").limit(maxScan).get(),
		]);

	const results: RankedResult[] = [];
	const seen = new Set<string>();

	if (exactUser.exists) {
		addResult(results, seen, {
			id: exactUser.id,
			type: "user",
			label: text(exactUser.get("email"), exactUser.id),
			description: `${text(exactUser.get("displayName"), "User")} · ${text(exactUser.get("tier"), "free")} · ${Number(exactUser.get("credits") ?? 0).toString()} credits`,
			meta: exactUser.id,
			href: sectionHref("/admin/users", query),
			createdAt: isoDate(exactUser.get("createdAt")),
			rank: 0,
		});
	}

	for (const doc of users.docs) {
		const values = [
			doc.id,
			text(doc.get("email")),
			text(doc.get("displayName")),
			text(doc.get("phoneNumber")),
			text(doc.get("stripeCustomerId")),
			text(doc.get("referralCode")),
		];
		const rank = matchRank(normalizedQuery, values);

		if (rank === null) {
			continue;
		}

		addResult(results, seen, {
			id: doc.id,
			type: "user",
			label: text(doc.get("email"), doc.id),
			description: `${text(doc.get("displayName"), "User")} · ${text(doc.get("tier"), "free")} · ${Number(doc.get("credits") ?? 0).toString()} credits`,
			meta: doc.id,
			href: sectionHref("/admin/users", query),
			createdAt: isoDate(doc.get("createdAt")),
			rank,
		});
	}

	for (const doc of exams.docs) {
		const ownerId = ownerIdFromCollectionGroupDoc(doc);
		const topics = stringList(doc.get("topics"));
		const values = [
			doc.id,
			ownerId,
			text(doc.get("title")),
			text(doc.get("className")),
			...topics,
		];
		const rank = matchRank(normalizedQuery, values);

		if (rank === null) {
			continue;
		}

		addResult(results, seen, {
			id: `${ownerId}:${doc.id}`,
			type: "exam",
			label: text(doc.get("title"), "Untitled exam"),
			description: `${text(doc.get("status"), "queued").replaceAll("_", " ")} · ${Number(doc.get("questionCount") ?? 0).toString()} questions · ${text(doc.get("className"), "No class")}`,
			meta: `users/${ownerId}/exams/${doc.id}`,
			href: sectionHref("/admin/exams", query),
			createdAt: isoDate(doc.get("createdAt")),
			rank,
		});
	}

	for (const doc of classes.docs) {
		const ownerId = ownerIdFromCollectionGroupDoc(doc);
		const values = [
			doc.id,
			ownerId,
			text(doc.get("name")),
			text(doc.get("institution")),
			text(doc.get("description")),
		];
		const rank = matchRank(normalizedQuery, values);

		if (rank === null) {
			continue;
		}

		addResult(results, seen, {
			id: `${ownerId}:${doc.id}`,
			type: "class",
			label: text(doc.get("name"), "Untitled class"),
			description: `${text(doc.get("institution"), "No institution")} · ${Number(doc.get("materialCount") ?? 0).toString()} materials`,
			meta: `users/${ownerId}/classes/${doc.id}`,
			href: sectionHref("/admin/users", query),
			createdAt: isoDate(doc.get("createdAt")),
			rank,
		});
	}

	for (const doc of feedback.docs) {
		const values = [
			doc.id,
			text(doc.get("title")),
			text(doc.get("body")),
			text(doc.get("email")),
			text(doc.get("userId")),
			text(doc.get("examId")),
			text(doc.get("shareId")),
		];
		const rank = matchRank(normalizedQuery, values);

		if (rank === null) {
			continue;
		}

		addResult(results, seen, {
			id: doc.id,
			type: "feedback",
			label: text(doc.get("title"), "Feedback"),
			description: `${text(doc.get("kind"), "general")} · ${text(doc.get("status"), "open")} · ${text(doc.get("source"), "feedback_page")}`,
			meta: doc.id,
			href: sectionHref("/admin/communications", query),
			createdAt: isoDate(doc.get("createdAt")),
			rank,
		});
	}

	for (const doc of abuseReports.docs) {
		const values = [
			doc.id,
			text(doc.get("title")),
			text(doc.get("body")),
			text(doc.get("reason")),
			text(doc.get("userId")),
			text(doc.get("examId")),
			text(doc.get("shareId")),
			text(doc.get("reporterEmail")),
		];
		const rank = matchRank(normalizedQuery, values);

		if (rank === null) {
			continue;
		}

		addResult(results, seen, {
			id: doc.id,
			type: "abuse",
			label: text(doc.get("title"), text(doc.get("examId"), "Abuse report")),
			description: `${text(doc.get("kind"), "report")} · ${text(doc.get("status"), "open")} · ${text(doc.get("source"), "exam_report")}`,
			meta: doc.id,
			href: sectionHref("/admin/abuse", query),
			createdAt: isoDate(doc.get("createdAt")),
			rank,
		});
	}

	if (exactShare.exists) {
		addResult(results, seen, {
			id: exactShare.id,
			type: "share",
			label: `Share link ${exactShare.id}`,
			description: `${text(exactShare.get("examId"), "unknown exam")} · ${text(exactShare.get("ownerUid"), "unknown owner")}`,
			meta: exactShare.id,
			href: sectionHref("/admin/exams", query),
			createdAt: isoDate(exactShare.get("createdAt")),
			rank: 0,
		});
	}

	for (const doc of shareLinks.docs) {
		const values = [doc.id, text(doc.get("ownerUid")), text(doc.get("examId"))];
		const rank = matchRank(normalizedQuery, values);

		if (rank === null) {
			continue;
		}

		addResult(results, seen, {
			id: doc.id,
			type: "share",
			label: `Share link ${doc.id}`,
			description: `${text(doc.get("examId"), "unknown exam")} · ${text(doc.get("ownerUid"), "unknown owner")}`,
			meta: doc.id,
			href: sectionHref("/admin/exams", query),
			createdAt: isoDate(doc.get("createdAt")),
			rank,
		});
	}

	return results
		.sort((left, right) => {
			if (left.rank !== right.rank) {
				return left.rank - right.rank;
			}

			if (left.typeOrder !== right.typeOrder) {
				return left.typeOrder - right.typeOrder;
			}

			return left.label.localeCompare(right.label);
		})
		.slice(0, limit)
		.map(({ rank: _rank, typeOrder: _typeOrder, ...result }) => result);
}
