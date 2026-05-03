"use client";

import { FirebaseError } from "firebase/app";
import {
	createUserWithEmailAndPassword,
	deleteUser,
	GoogleAuthProvider,
	linkWithCredential,
	PhoneAuthProvider,
	RecaptchaVerifier,
	signInWithPopup,
	signOut,
	type User,
	updateProfile,
} from "firebase/auth";
import { Phone, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { normalizePhoneNumberInput, phonePreview } from "@/lib/auth/phone-format";
import { firebaseAuth } from "@/lib/firebase/client";

type Phase = "details" | "code";

function signupMessage(error: unknown) {
	if (error instanceof FirebaseError) {
		if (error.code === "auth/email-already-in-use") {
			return "That email is already registered. Sign in to the existing account instead.";
		}

		if (error.code === "auth/credential-already-in-use") {
			return "That phone number is already attached to an ExamPull account. Sign in with a previously linked email or Google account before using it.";
		}

		if (error.code === "auth/invalid-verification-code") {
			return "The verification code is not correct.";
		}

		if (error.code === "auth/operation-not-allowed") {
			return "Phone sign-up is not enabled on this deployment. This is a configuration issue, not a problem with your number.";
		}

		if (
			error.code === "auth/invalid-app-credential" ||
			error.code === "auth/captcha-check-failed"
		) {
			return "Phone verification could not be confirmed. Refresh the page and request a new code.";
		}

		if (error.code === "auth/too-many-requests") {
			return "Too many verification attempts. Wait a few minutes, then request a new code.";
		}
	}

	if (error instanceof Error) {
		return error.message;
	}

	return "Signup failed. Check the details and try again.";
}

async function createSession({
	idToken,
	displayName,
	testSignupToken,
	referralCode,
	previewId,
}: {
	idToken: string;
	displayName: string;
	testSignupToken: string;
	referralCode: string;
	previewId: string;
}) {
	const response = await fetch("/api/auth/session", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			idToken,
			mode: "signup",
			displayName,
			testSignupToken,
			referralCode,
			previewId,
		}),
	});

	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as { error?: string } | null;
		throw new Error(payload?.error ?? "ExamPull could not create the account.");
	}

	return (await response.json()) as { claimedExamId?: string };
}

export function SignUpForm() {
	const verifierRef = useRef<RecaptchaVerifier | null>(null);
	const pendingUserRef = useRef<User | null>(null);
	const [phase, setPhase] = useState<Phase>("details");
	const [displayName, setDisplayName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [phone, setPhone] = useState("");
	const [testSignupToken, setTestSignupToken] = useState("");
	const [referralCode, setReferralCode] = useState("");
	const [previewId, setPreviewId] = useState("");
	const [verificationId, setVerificationId] = useState("");
	const [code, setCode] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const code = params.get("ref") ?? window.localStorage.getItem("exampull_referral_code");
		if (code) {
			const cleanCode = code.trim().slice(0, 80);
			setReferralCode(cleanCode);
			window.localStorage.setItem("exampull_referral_code", cleanCode);
		}
		const preview = params.get("preview") ?? window.localStorage.getItem("exampull_preview_id");
		if (preview) {
			const cleanPreview = preview.trim().slice(0, 120);
			setPreviewId(cleanPreview);
			window.localStorage.setItem("exampull_preview_id", cleanPreview);
		}
		const testToken = params.get("testToken");
		if (testToken) {
			setTestSignupToken(testToken.trim().slice(0, 512));
			firebaseAuth.settings.appVerificationDisabledForTesting = true;
		}
	}, []);

	function verifier() {
		if (!verifierRef.current) {
			verifierRef.current = new RecaptchaVerifier(firebaseAuth, "signup-recaptcha", {
				size: "invisible",
			});
		}

		return verifierRef.current;
	}

	function validateDetails() {
		const cleanEmail = email.trim();

		if (!cleanEmail || !password || !phone.trim()) {
			return "Enter your email, password, and phone number.";
		}

		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
			return "Enter a valid email address.";
		}

		if (password.length < 12) {
			return "Use a password with at least 12 characters.";
		}

		return null;
	}

	async function sendCode(user?: User) {
		const normalizedPhone = normalizePhoneNumberInput(phone);
		if (!normalizedPhone.ok) {
			throw new Error(normalizedPhone.message);
		}

		setPhone(normalizedPhone.value);
		pendingUserRef.current = user ?? null;
		const provider = new PhoneAuthProvider(firebaseAuth);
		const id = await provider.verifyPhoneNumber(normalizedPhone.value, verifier());
		setVerificationId(id);
		setPhase("code");
		setStatus("Code sent. Enter the six digits to finish creating your account.");
	}

	async function onEmailSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setError(null);
		setStatus("Sending verification code...");

		try {
			const validationError = validateDetails();
			if (validationError) {
				throw new Error(validationError);
			}

			await sendCode();
		} catch (cause) {
			setStatus(null);
			setError(signupMessage(cause));
		} finally {
			setIsSubmitting(false);
		}
	}

	function openDestination(session: { claimedExamId?: string }) {
		const destination = session.claimedExamId
			? `/exams/${session.claimedExamId}`
			: "/dashboard";
		if (session.claimedExamId) {
			window.localStorage.removeItem("exampull_preview_id");
		}
		setStatus("Account created. Opening your workspace...");
		window.location.assign(destination);
	}

	async function onGoogle() {
		setIsSubmitting(true);
		setError(null);
		setStatus("Opening Google sign-in...");

		try {
			const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
			const hasVerifiedPhone = credential.user.providerData.some(
				(provider) => provider.providerId === "phone",
			);

			if (displayName.trim()) {
				await updateProfile(credential.user, { displayName: displayName.trim() });
			}

			if (hasVerifiedPhone) {
				setStatus("Creating your ExamPull session...");
				const session = await createSession({
					idToken: await credential.user.getIdToken(true),
					displayName,
					testSignupToken,
					referralCode,
					previewId,
				});
				openDestination(session);
				return;
			}

			await sendCode(credential.user);
		} catch (cause) {
			await signOut(firebaseAuth).catch(() => undefined);
			setStatus(null);
			setError(signupMessage(cause));
		} finally {
			setIsSubmitting(false);
		}
	}

	async function deleteTransientUser(user: User) {
		await deleteUser(user).catch(async () => {
			await signOut(firebaseAuth).catch(() => undefined);
		});
	}

	async function onEditDetails() {
		pendingUserRef.current = null;
		setVerificationId("");
		setCode("");
		setStatus(null);
		setPhase("details");
		await signOut(firebaseAuth).catch(() => undefined);
	}

	async function onVerify(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setError(null);
		setStatus("Checking verification code...");
		let transientUser: User | null = null;
		let sessionCreated = false;
		let phoneLinked = false;

		try {
			if (!/^\d{6}$/.test(code.trim())) {
				throw new Error("Enter the 6-digit code from the text message.");
			}

			const credential = PhoneAuthProvider.credential(verificationId, code.trim());
			const pendingUser = pendingUserRef.current ?? firebaseAuth.currentUser;
			const user =
				pendingUser ??
				(await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password)).user;
			transientUser = pendingUser ? null : user;

			if (displayName.trim() && user.displayName !== displayName.trim()) {
				await updateProfile(user, { displayName: displayName.trim() });
			}

			await linkWithCredential(user, credential);
			phoneLinked = true;
			setStatus("Creating your ExamPull session...");
			const idToken = await user.getIdToken(true);
			const session = await createSession({
				idToken,
				displayName,
				testSignupToken,
				referralCode,
				previewId,
			});
			sessionCreated = true;
			openDestination(session);
		} catch (cause) {
			if (transientUser && !sessionCreated) {
				await deleteTransientUser(transientUser);
			} else if (phoneLinked && !sessionCreated) {
				await signOut(firebaseAuth).catch(() => undefined);
			}
			setStatus(null);
			setError(signupMessage(cause));
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div>
			{phase === "details" ? (
				<form className="space-y-5" onSubmit={onEmailSubmit} noValidate>
					<div>
						<label className="text-sm font-medium" htmlFor="display-name">
							Name
						</label>
						<input
							id="display-name"
							value={displayName}
							onChange={(event) => setDisplayName(event.target.value)}
							className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 text-foreground outline-none focus:ring-2 focus:ring-brand"
							placeholder="Ada Lovelace"
						/>
					</div>
					<div>
						<label className="text-sm font-medium" htmlFor="email">
							Email
						</label>
						<input
							id="email"
							name="email"
							type="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							required
							className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 text-foreground outline-none focus:ring-2 focus:ring-brand"
							placeholder="you@example.com"
						/>
					</div>
					<div>
						<label className="text-sm font-medium" htmlFor="password">
							Password
						</label>
						<input
							id="password"
							name="password"
							type="password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							required
							minLength={12}
							className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 text-foreground outline-none focus:ring-2 focus:ring-brand"
							placeholder="12+ characters"
						/>
					</div>
					<div>
						<label className="text-sm font-medium" htmlFor="phone">
							Phone number
						</label>
						<input
							id="phone"
							name="phone"
							type="tel"
							value={phone}
							onChange={(event) => setPhone(event.target.value)}
							required
							className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 text-foreground outline-none focus:ring-2 focus:ring-brand"
							placeholder="650-555-0123"
						/>
						<p className="mt-2 text-xs leading-5 text-muted">
							{phonePreview(phone)
								? `We will send the code to ${phonePreview(phone)}.`
								: "US numbers can be typed as 650-555-0123. Add +country code for international numbers."}
						</p>
					</div>
					{error ? (
						<div className="rounded-lg bg-error/10 p-3 text-sm text-error" role="alert">
							<p>{error}</p>
							{error.includes("already registered") ? (
								<a
									className="mt-2 block text-secondary"
									href={`/sign-in${previewId ? `?preview=${encodeURIComponent(previewId)}` : ""}`}
								>
									Sign in to this account
								</a>
							) : null}
						</div>
					) : null}
					{status ? (
						<p className="rounded-lg bg-glass p-3 text-sm text-muted" role="status">
							{status}
						</p>
					) : null}
					<div id="signup-recaptcha" />
					<Button
						type="submit"
						variant="primary"
						className="w-full"
						disabled={isSubmitting}
					>
						<Phone aria-hidden="true" size={18} />
						{isSubmitting ? "Sending code" : "Send verification code"}
					</Button>
					<Button
						type="button"
						variant="secondary"
						className="w-full"
						onClick={onGoogle}
						aria-describedby="google-signup-note"
						disabled={isSubmitting || !phone}
					>
						Continue with Google
					</Button>
					<p id="google-signup-note" className="-mt-2 text-xs leading-5 text-muted">
						Enter your phone number first. Google signup still finishes with the same
						SMS check before your workspace opens.
					</p>
				</form>
			) : (
				<form className="space-y-5" onSubmit={onVerify} noValidate>
					<div>
						<label className="text-sm font-medium" htmlFor="otp">
							6-digit code
						</label>
						<input
							id="otp"
							inputMode="numeric"
							value={code}
							onChange={(event) => setCode(event.target.value)}
							className="mt-2 h-12 w-full rounded-lg border border-glass-border bg-background/70 px-3 text-center text-2xl tracking-[0.4em] outline-none focus:ring-2 focus:ring-brand"
							maxLength={6}
							required
						/>
					</div>
					{error ? (
						<p className="rounded-lg bg-error/10 p-3 text-sm text-error" role="alert">
							{error}
						</p>
					) : null}
					{status ? (
						<p className="rounded-lg bg-glass p-3 text-sm text-muted" role="status">
							{status}
						</p>
					) : null}
					<Button
						type="submit"
						variant="primary"
						className="w-full"
						disabled={isSubmitting}
					>
						<ShieldCheck aria-hidden="true" size={18} />
						{isSubmitting ? "Creating account" : "Verify and create account"}
					</Button>
					<Button type="button" className="w-full" onClick={() => void onEditDetails()}>
						Edit details
					</Button>
				</form>
			)}
			<div className="mt-6 flex gap-3 rounded-lg border border-glass-border bg-glass p-4 text-sm text-muted">
				<ShieldCheck aria-hidden="true" className="mt-0.5 text-success" size={18} />
				<p>
					We use phone verification to protect free exam credits and keep your account
					recoverable.
				</p>
			</div>
		</div>
	);
}
