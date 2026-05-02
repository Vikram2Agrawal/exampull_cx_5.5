import { AdminShell, AdminTable } from "@/components/admin/admin-shell";
import { PreviewKillSwitch } from "@/components/admin/preview-kill-switch";
import { getAdminConfiguration } from "@/lib/admin/data";
import { getRuntimeConfig } from "@/lib/config/runtime";
import { CREDIT_COSTS, TIER_MONTHLY_CREDITS } from "@/lib/product/constants";

export const dynamic = "force-dynamic";

export default async function AdminConfigurationPage() {
	const configuration = getAdminConfiguration();
	const runtimeConfig = await getRuntimeConfig();
	const configurationRows = [
		...configuration,
		{
			name: "PREVIEW_GENERATION",
			configured: true,
			value: runtimeConfig.previewGenerationDisabled ? "disabled" : "enabled",
		},
	];
	const pricingRows = [
		["Free credits", TIER_MONTHLY_CREDITS.free.toString()],
		["Scholar credits", TIER_MONTHLY_CREDITS.scholar.toString()],
		["Guru credits", TIER_MONTHLY_CREDITS.guru.toString()],
		["Generate question", CREDIT_COSTS.GENERATE_QUESTION.toString()],
		["Grade question", CREDIT_COSTS.GRADE_QUESTION.toString()],
		["Annotate question", CREDIT_COSTS.ANNOTATE_QUESTION.toString()],
		["Style guide upload", CREDIT_COSTS.STYLE_GUIDE_UPLOAD.toString()],
	];

	return (
		<AdminShell active="Configuration">
			<div className="space-y-6">
				<AdminTable
					title="Configuration"
					description="Runtime setup, secret presence, feature flags, and public endpoints."
					headers={["Name", "State", "Value"]}
					empty="No configuration entries."
					rows={configurationRows.map((item) => ({
						key: item.name,
						cells: [
							<p key="name" className="font-medium text-slate-950">
								{item.name}
							</p>,
							item.configured ? (
								<span key="set" className="text-emerald-700">
									set
								</span>
							) : (
								<span key="missing" className="text-red-700">
									missing
								</span>
							),
							item.value || "--",
						],
					}))}
				/>
				<PreviewKillSwitch
					initialDisabled={runtimeConfig.previewGenerationDisabled}
					initialMessage={runtimeConfig.previewDisabledMessage}
				/>
				<AdminTable
					title="Credit constants"
					headers={["Name", "Value"]}
					empty="No pricing constants."
					rows={pricingRows.map(([name, value]) => ({
						key: name,
						cells: [name, value],
					}))}
				/>
			</div>
		</AdminShell>
	);
}
