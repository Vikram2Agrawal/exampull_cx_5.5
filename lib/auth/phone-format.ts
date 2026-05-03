export type PhoneNumberNormalization = { ok: true; value: string } | { ok: false; message: string };

export function normalizePhoneNumberInput(input: string): PhoneNumberNormalization {
	const trimmed = input.trim();

	if (!trimmed) {
		return { ok: false, message: "Enter a phone number." };
	}

	const digits = trimmed.replace(/\D/g, "");

	if (trimmed.startsWith("+")) {
		if (digits.length < 8 || digits.length > 15) {
			return {
				ok: false,
				message: "Enter a complete phone number with country code.",
			};
		}

		return { ok: true, value: `+${digits}` };
	}

	if (digits.length === 10) {
		return { ok: true, value: `+1${digits}` };
	}

	if (digits.length === 11 && digits.startsWith("1")) {
		return { ok: true, value: `+${digits}` };
	}

	return {
		ok: false,
		message:
			"Use a 10-digit US number, or include a country code like +44 for international numbers.",
	};
}

export function phonePreview(input: string) {
	const normalized = normalizePhoneNumberInput(input);

	return normalized.ok ? normalized.value : null;
}
