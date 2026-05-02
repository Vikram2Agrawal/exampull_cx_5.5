export type AdminSearchResultType = "user" | "exam" | "class" | "feedback" | "abuse" | "share";

export type AdminSearchResult = {
	id: string;
	type: AdminSearchResultType;
	label: string;
	description: string;
	meta: string;
	href: string;
	anchor: string;
	createdAt: string;
};
