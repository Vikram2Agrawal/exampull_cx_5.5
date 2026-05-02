export type LinkedAuthProviderType = "email" | "google" | "phone";

export type LinkedAuthProvider = {
	type: LinkedAuthProviderType;
	identifier: string;
	label: string;
};

type FirebaseProvider = {
	providerId?: string;
	uid?: string;
	email?: string;
	phoneNumber?: string;
};

export function normalizeAuthEmail(email: string | null | undefined) {
	const trimmed = email?.trim().toLowerCase();

	return trimmed?.includes("@") ? trimmed : null;
}

export function linkedAuthProviderKey(provider: LinkedAuthProvider) {
	return `${provider.type}:${provider.identifier.trim().toLowerCase()}`;
}

function addProvider(
	providers: LinkedAuthProvider[],
	seen: Set<string>,
	provider: LinkedAuthProvider,
) {
	const identifier = provider.identifier.trim();

	if (!identifier) {
		return;
	}

	const cleanProvider = {
		...provider,
		identifier,
	};
	const key = linkedAuthProviderKey(cleanProvider);

	if (seen.has(key)) {
		return;
	}

	seen.add(key);
	providers.push(cleanProvider);
}

export function linkedAuthProvidersFromFirebase({
	providerData,
	email,
	phoneNumber,
	signInProvider,
}: {
	providerData: FirebaseProvider[];
	email?: string | null;
	phoneNumber?: string | null;
	signInProvider?: string | null;
}): LinkedAuthProvider[] {
	const providers: LinkedAuthProvider[] = [];
	const seen = new Set<string>();

	for (const provider of providerData) {
		if (provider.providerId === "password") {
			const identifier = normalizeAuthEmail(provider.email ?? email);
			if (identifier) {
				addProvider(providers, seen, {
					type: "email",
					identifier,
					label: "Email/password",
				});
			}
		}

		if (provider.providerId === "google.com") {
			const identifier = normalizeAuthEmail(provider.email) ?? provider.uid ?? "";
			addProvider(providers, seen, {
				type: "google",
				identifier,
				label: "Google",
			});
		}

		if (provider.providerId === "phone") {
			addProvider(providers, seen, {
				type: "phone",
				identifier: provider.phoneNumber ?? phoneNumber ?? "",
				label: "Phone",
			});
		}
	}

	const fallbackEmail = normalizeAuthEmail(email);
	const hasPasswordProvider = providers.some((provider) => provider.type === "email");
	const hasOAuthProvider = providers.some((provider) => provider.type === "google");

	if (
		fallbackEmail &&
		!hasPasswordProvider &&
		(!hasOAuthProvider || signInProvider === "password" || providerData.length === 0)
	) {
		addProvider(providers, seen, {
			type: "email",
			identifier: fallbackEmail,
			label: "Email/password",
		});
	}

	if (phoneNumber && !providers.some((provider) => provider.type === "phone")) {
		addProvider(providers, seen, {
			type: "phone",
			identifier: phoneNumber,
			label: "Phone",
		});
	}

	return providers.sort((left, right) => {
		const order: Record<LinkedAuthProviderType, number> = {
			email: 0,
			google: 1,
			phone: 2,
		};

		return (
			order[left.type] - order[right.type] || left.identifier.localeCompare(right.identifier)
		);
	});
}

export function emailIdentifiersFromProviders(
	providers: LinkedAuthProvider[],
	fallbackEmail?: string | null,
) {
	const emails = new Set<string>();
	const fallback = normalizeAuthEmail(fallbackEmail);

	if (fallback) {
		emails.add(fallback);
	}

	for (const provider of providers) {
		if (provider.type === "email" || provider.type === "google") {
			const email = normalizeAuthEmail(provider.identifier);
			if (email) {
				emails.add(email);
			}
		}
	}

	return [...emails].sort();
}

export function linkedAuthProvidersFromDocument(value: unknown): LinkedAuthProvider[] {
	if (!Array.isArray(value)) {
		return [];
	}

	const providers: LinkedAuthProvider[] = [];
	const seen = new Set<string>();

	for (const item of value) {
		if (typeof item !== "object" || item === null) {
			continue;
		}

		const type = "type" in item ? item.type : null;
		const identifier = "identifier" in item ? item.identifier : null;
		const label = "label" in item ? item.label : null;

		if (type !== "email" && type !== "google" && type !== "phone") {
			continue;
		}

		if (typeof identifier !== "string" || !identifier.trim()) {
			continue;
		}

		addProvider(providers, seen, {
			type,
			identifier,
			label: typeof label === "string" && label.trim() ? label.trim() : type,
		});
	}

	return providers;
}
