"use client";

import { FirebaseError } from "firebase/app";
import {
	createUserWithEmailAndPassword,
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
import { firebaseAuth } from "@/lib/firebase/client";

type Phase = "details" | "code";

function signupMessage(error: unknown) {
	if (error instanceof FirebaseError) {
		if (error.code === "auth/email-already-in-use") {
			return "That email is already registered. Sign in instead.";
		}

		if (error.code === "auth/credential-already-in-use") {
			return "That phone number is already attached to another account.";
		}

		if (error.code === "auth/invalid-verification-code") {
			return "The verification code is not correct.";
		}
	}

	return "Signup failed. Check the details and try again.";
}

async function createSession({
	idToken,
	displayName,
	testSignupToken,
	referralCode,
}: {
	idToken: string;
	displayName: string;
	testSignupToken: string;
	referralCode: string;
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
		}),
	});

	if (!response.ok) {
		await signOut(firebaseAuth);
		const payload = (await response.json().catch(() => null)) as { error?: string } | null;
		throw new Error(payload?.error ?? "ExamPull could not create the account.");
	}
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
	}, []);

	function verifier() {
		if (!verifierRef.current) {
			verifierRef.current = new RecaptchaVerifier(firebaseAuth, "signup-recaptcha", {
				size: "invisible",
			});
		}

		return verifierRef.current;
	}

	async function sendCode(user: User) {
		pendingUserRef.current = user;
		const provider = new PhoneAuthProvider(firebaseAuth);
		const id = await provider.verifyPhoneNumber(phone, verifier());
		setVerificationId(id);
		setPhase("code");
	}

	async function onEmailSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setError(null);

		try {
			const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);

			if (displayName.trim()) {
				await updateProfile(credential.user, { displayName: displayName.trim() });
			}

			await sendCode(credential.user);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : signupMessage(cause));
		} finally {
			setIsSubmitting(false);
		}
	}

	async function onGoogle() {
		setIsSubmitting(true);
		setError(null);

		try {
			const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
			if (displayName.trim()) {
				await updateProfile(credential.user, { displayName: displayName.trim() });
			}
			await sendCode(credential.user);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : signupMessage(cause));
		} finally {
			setIsSubmitting(false);
		}
	}

	async function onVerify(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setError(null);

		try {
			const user = pendingUserRef.current ?? firebaseAuth.currentUser;
			if (!user) {
				throw new Error("Signup session expired. Start again.");
			}

			const credential = PhoneAuthProvider.credential(verificationId, code);
			await linkWithCredential(user, credential);
			const idToken = await user.getIdToken(true);
			await createSession({ idToken, displayName, testSignupToken, referralCode });
			router.push("/dashboard");
			router.refresh();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : signupMessage(cause));
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
							placeholder="+1 555 555 0100"
						/>
					</div>
					<div>
						<label className="text-sm font-medium" htmlFor="test-token">
							Test signup token
						</label>
						<input
							id="test-token"
							value={testSignupToken}
							onChange={(event) => setTestSignupToken(event.target.value)}
							className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 text-foreground outline-none focus:ring-2 focus:ring-brand"
							placeholder="Optional"
						/>
					</div>
					{error ? (
						<p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>
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
						<p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>
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
					<Button type="button" className="w-full" onClick={() => setPhase("details")}>
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
