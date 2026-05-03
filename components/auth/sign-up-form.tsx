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
import { useRouter } from "next/navigation";
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
	const router = useRouter();
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
	}

	async function onEmailSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setError(null);

		try {
			await sendCode();
		} catch (cause) {
			setError(signupMessage(cause));
		} finally {
			setIsSubmitting(false);
		}
	}

	async function onGoogle() {
		setIsSubmitting(true);
		setError(null);

		try {
			const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
			const hasVerifiedPhone = credential.user.providerData.some(
				(provider) => provider.providerId === "phone",
			);

			if (displayName.trim()) {
				await updateProfile(credential.user, { displayName: displayName.trim() });
			}

			if (hasVerifiedPhone) {
				const session = await createSession({
					idToken: await credential.user.getIdToken(true),
					displayName,
					testSignupToken,
					referralCode,
					previewId,
				});
				if (session.claimedExamId) {
					window.localStorage.removeItem("exampull_preview_id");
				}
				router.push(
					session.claimedExamId ? `/exams/${session.claimedExamId}` : "/dashboard",
				);
				router.refresh();
				return;
			}

			await sendCode(credential.user);
		} catch (cause) {
			await signOut(firebaseAuth).catch(() => undefined);
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
		setPhase("details");
		await signOut(firebaseAuth).catch(() => undefined);
	}

	async function onVerify(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setError(null);
		let transientUser: User | null = null;
		let sessionCreated = false;
		let phoneLinked = false;

		try {
			const credential = PhoneAuthProvider.credential(verificationId, code);
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
			const idToken = await user.getIdToken(true);
			const session = await createSession({
				idToken,
				displayName,
				testSignupToken,
				referralCode,
				previewId,
			});
			sessionCreated = true;
			if (session.claimedExamId) {
				window.localStorage.removeItem("exampull_preview_id");
			}
			router.push(session.claimedExamId ? `/exams/${session.claimedExamId}` : "/dashboard");
			router.refresh();
		} catch (cause) {
			if (transientUser && !sessionCreated) {
				await deleteTransientUser(transientUser);
			} else if (phoneLinked && !sessionCreated) {
				await signOut(firebaseAuth).catch(() => undefined);
			}
			setError(signupMessage(cause));
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div>
			{phase === "details" ? (
				<form className="space-y-5" onSubmit={onEmailSubmit}>
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
						disabled={isSubmitting || !phone}
					>
						Continue with Google
					</Button>
				</form>
			) : (
				<form className="space-y-5" onSubmit={onVerify}>
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
					No account record is written until the OTP succeeds. One phone number maps to
					one account.
				</p>
			</div>
		</div>
	);
}
