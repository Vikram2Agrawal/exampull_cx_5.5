export const referralVelocityWindowMs = 10 * 60 * 1000;

function normalizedEmail(value: unknown) {
	if (typeof value !== "string") {
		return null;
	}

	const email = value.trim().toLowerCase();
	return email.includes("@") ? email : null;
}

function emailAliasRoot(value: unknown) {
	const email = normalizedEmail(value);
	if (!email) {
		return null;
	}

	const [localPart, domain] = email.split("@");
	if (!localPart || !domain) {
		return null;
	}

	const root = localPart.split("+")[0]?.trim();
	return root ? `${root}@${domain}` : email;
}

function normalizedPhone(value: unknown) {
	if (typeof value !== "string") {
		return null;
	}

	const digits = value.replace(/\D/g, "");
	return digits.length >= 10 ? digits.slice(-10) : null;
}

export function referralSuspicionReasons({
	referrerEmail,
	referredEmail,
	referrerPhoneNumber,
	referredPhoneNumber,
	recentReferralCount,
}: {
	referrerEmail: unknown;
	referredEmail: unknown;
	referrerPhoneNumber: unknown;
	referredPhoneNumber: unknown;
	recentReferralCount: number;
}) {
	const reasons: string[] = [];
	const referrerAlias = emailAliasRoot(referrerEmail);
	const referredAlias = emailAliasRoot(referredEmail);
	const referrerNormalizedEmail = normalizedEmail(referrerEmail);
	const referredNormalizedEmail = normalizedEmail(referredEmail);

	if (
		referrerAlias &&
		referredAlias &&
		referrerAlias === referredAlias &&
		referrerNormalizedEmail !== referredNormalizedEmail
	) {
		reasons.push("same_email_alias");
	}

	const referrerPhone = normalizedPhone(referrerPhoneNumber);
	const referredPhone = normalizedPhone(referredPhoneNumber);
	if (referrerPhone && referredPhone && referrerPhone === referredPhone) {
		reasons.push("same_phone_number");
	}

	if (recentReferralCount >= 5) {
		reasons.push("rapid_referral_velocity");
	}

	return reasons;
}
