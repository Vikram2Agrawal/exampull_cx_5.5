"use client";

import { Mail, MessageSquare, Send, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useAdminCsrfToken } from "@/components/admin/admin-csrf";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const templates = {
	custom: {
		label: "Custom",
		subject: "",
		body: "",
	},
	apology: {
		label: "Apology",
		subject: "A note from ExamPull",
		body: "Hi {{display_name}},\n\nWe found an issue that may have affected your experience. I added a note to your account and will follow up if anything else is needed.\n\nYour current credit balance is {{credit_balance}}.",
	},
	"refund-confirmed": {
		label: "Refund confirmed",
		subject: "Your ExamPull refund is confirmed",
		body: "Hi {{display_name}},\n\nYour refund/credit adjustment has been recorded. Your account is currently on {{tier}} with {{credit_balance}} credits available.",
	},
	maintenance: {
		label: "Maintenance",
		subject: "ExamPull maintenance notice",
		body: "Hi {{display_name}},\n\nExamPull has scheduled maintenance. You can still view your saved exams, but new generations may pause briefly.",
	},
} as const;

type ComposerMode = "single" | "test" | "broadcast";
type Channel = "email" | "sms" | "in_app";
type TemplateKey = keyof typeof templates;

const channels = [
	{ value: "email", label: "Email", icon: Mail },
	{ value: "sms", label: "SMS", icon: Smartphone },
	{ value: "in_app", label: "In-app", icon: MessageSquare },
] as const;

function interpolatePreview(value: string) {
	return value
		.replaceAll("{{display_name}}", "Avery Student")
		.replaceAll("{{email}}", "avery@example.edu")
		.replaceAll("{{credit_balance}}", "42")
		.replaceAll("{{tier}}", "scholar");
}

export function CommunicationComposer() {
	const csrfToken = useAdminCsrfToken();
	const router = useRouter();
	const [mode, setMode] = useState<ComposerMode>("single");
	const [selectedChannels, setSelectedChannels] = useState<Channel[]>(["email", "in_app"]);
	const [template, setTemplate] = useState<TemplateKey>("custom");
	const [userId, setUserId] = useState("");
	const [testEmail, setTestEmail] = useState("");
	const [testPhoneNumber, setTestPhoneNumber] = useState("");
	const [audienceTier, setAudienceTier] = useState("any");
	const [testAccounts, setTestAccounts] = useState("only");
	const [limit, setLimit] = useState("100");
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");
	const [reauthPassword, setReauthPassword] = useState("");
	const [status, setStatus] = useState("");
	const [isPending, startTransition] = useTransition();
	const preview = useMemo(
		() => ({
			subject: interpolatePreview(subject || templates[template].subject),
			body: interpolatePreview(body || templates[template].body),
		}),
		[subject, body, template],
	);

	function toggleChannel(channel: Channel) {
		setSelectedChannels((current) =>
			current.includes(channel)
				? current.filter((item) => item !== channel)
				: [...current, channel],
		);
	}

	function applyTemplate(nextTemplate: TemplateKey) {
		setTemplate(nextTemplate);
		setSubject(templates[nextTemplate].subject);
		setBody(templates[nextTemplate].body);
	}

	function submit() {
		startTransition(async () => {
			try {
				const response = await fetch("/api/admin/communications/send", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-admin-csrf-token": csrfToken,
						"x-admin-reauth-password": reauthPassword,
					},
					body: JSON.stringify({
						mode,
						userId: userId || undefined,
						testEmail: testEmail || undefined,
						testPhoneNumber: testPhoneNumber || undefined,
						channels: selectedChannels,
						subject,
						body,
						audience: {
							tier: audienceTier,
							testAccounts,
							limit: Number.parseInt(limit, 10),
						},
					}),
				});
				const result = (await response.json().catch(() => ({}))) as {
					error?: string;
					recipientCount?: number;
					communicationCount?: number;
				};

				if (!response.ok) {
					throw new Error(result.error ?? "Communication send failed.");
				}

				setStatus(
					`Sent ${String(result.communicationCount ?? 0)} message(s) to ${String(
						result.recipientCount ?? 0,
					)} recipient(s).`,
				);
				setReauthPassword("");
				router.refresh();
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Communication send failed.");
			}
		});
	}

	return (
		<section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
			<div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
				<div>
					<h2 className="text-lg font-semibold">Compose message</h2>
					<p className="mt-1 text-sm text-slate-500">
						Send audited email, SMS, and in-app messages with a rendered preview.
					</p>
				</div>
				<select
					className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
					value={template}
					onChange={(event) => applyTemplate(event.target.value as TemplateKey)}
				>
					{Object.entries(templates).map(([key, value]) => (
						<option key={key} value={key}>
							{value.label}
						</option>
					))}
				</select>
			</div>
			<div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
				<div className="space-y-4">
					<div className="grid gap-2 sm:grid-cols-3">
						{(["single", "test", "broadcast"] as const).map((item) => (
							<button
								key={item}
								type="button"
								className={cn(
									"min-h-10 rounded-md border border-slate-200 px-3 text-sm font-medium capitalize hover:bg-slate-50",
									mode === item && "border-slate-950 bg-slate-950 text-white",
								)}
								onClick={() => setMode(item)}
							>
								{item}
							</button>
						))}
					</div>
					{mode === "single" ? (
						<input
							className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
							placeholder="User ID"
							value={userId}
							onChange={(event) => setUserId(event.target.value)}
						/>
					) : null}
					{mode === "test" ? (
						<div className="grid gap-3 sm:grid-cols-2">
							<input
								className="h-10 rounded-md border border-slate-200 px-3 text-sm"
								placeholder="Test email"
								value={testEmail}
								onChange={(event) => setTestEmail(event.target.value)}
							/>
							<input
								className="h-10 rounded-md border border-slate-200 px-3 text-sm"
								placeholder="Test phone"
								value={testPhoneNumber}
								onChange={(event) => setTestPhoneNumber(event.target.value)}
							/>
						</div>
					) : null}
					{mode === "broadcast" ? (
						<div className="grid gap-3 sm:grid-cols-3">
							<select
								className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
								aria-label="Broadcast tier"
								value={audienceTier}
								onChange={(event) => setAudienceTier(event.target.value)}
							>
								<option value="any">Any tier</option>
								<option value="free">Free</option>
								<option value="scholar">Scholar</option>
								<option value="guru">Guru</option>
							</select>
							<select
								className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
								aria-label="Broadcast test accounts"
								value={testAccounts}
								onChange={(event) => setTestAccounts(event.target.value)}
							>
								<option value="only">Test accounts only</option>
								<option value="exclude">Exclude test accounts</option>
								<option value="include">Include all accounts</option>
							</select>
							<input
								className="h-10 rounded-md border border-slate-200 px-3 text-sm"
								placeholder="Limit"
								value={limit}
								onChange={(event) => setLimit(event.target.value)}
							/>
						</div>
					) : null}
					<div className="grid gap-2 sm:grid-cols-3">
						{channels.map((channel) => {
							const Icon = channel.icon;
							const selected = selectedChannels.includes(channel.value);

							return (
								<button
									key={channel.value}
									type="button"
									className={cn(
										"flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50",
										selected && "border-slate-950 bg-slate-950 text-white",
									)}
									onClick={() => toggleChannel(channel.value)}
								>
									<Icon aria-hidden="true" size={16} />
									{channel.label}
								</button>
							);
						})}
					</div>
					<input
						className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
						placeholder="Subject"
						value={subject}
						onChange={(event) => setSubject(event.target.value)}
					/>
					<textarea
						className="min-h-40 w-full rounded-md border border-slate-200 p-3 text-sm"
						placeholder="Message body"
						value={body}
						onChange={(event) => setBody(event.target.value)}
					/>
					<div className="grid gap-3 sm:grid-cols-[1fr_auto]">
						<input
							className="h-10 rounded-md border border-slate-200 px-3 text-sm"
							placeholder="Re-auth password"
							type="password"
							value={reauthPassword}
							onChange={(event) => setReauthPassword(event.target.value)}
						/>
						<Button
							type="button"
							disabled={
								isPending ||
								selectedChannels.length === 0 ||
								!subject ||
								!body ||
								!reauthPassword
							}
							onClick={submit}
						>
							<Send aria-hidden="true" size={16} />
							Send
						</Button>
					</div>
					{status ? <p className="text-sm text-slate-500">{status}</p> : null}
				</div>
				<div className="rounded-md border border-slate-200 bg-slate-50 p-4">
					<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
						Preview
					</p>
					<h3 className="mt-3 font-semibold text-slate-950">{preview.subject}</h3>
					<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
						{preview.body}
					</p>
				</div>
			</div>
		</section>
	);
}
