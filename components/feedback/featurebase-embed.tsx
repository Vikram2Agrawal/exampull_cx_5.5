import { ExternalLink } from "lucide-react";
import { GlassPanel } from "@/components/ui/surface";

export function FeaturebaseEmbed({
	src,
	title,
	fallbackTitle,
}: {
	src: string | null;
	title: string;
	fallbackTitle: string;
}) {
	if (!src) {
		return (
			<GlassPanel className="p-6">
				<h2 className="text-xl font-semibold">{fallbackTitle}</h2>
				<p className="mt-2 text-sm leading-6 text-muted">
					The customer-voice portal is not configured in this environment. Feedback
					submissions still route into the operator inbox.
				</p>
			</GlassPanel>
		);
	}

	return (
		<section className="overflow-hidden rounded-lg border border-glass-border bg-glass shadow-glass">
			<div className="flex min-h-14 items-center justify-between gap-4 border-b border-glass-border px-4">
				<h2 className="text-sm font-semibold">{title}</h2>
				<a
					href={src}
					target="_blank"
					rel="noreferrer"
					className="inline-flex min-h-11 items-center gap-2 text-sm text-secondary"
				>
					Open
					<ExternalLink aria-hidden="true" size={16} />
				</a>
			</div>
			<iframe
				className="h-[720px] w-full bg-white"
				data-testid="featurebase-embed"
				src={src}
				title={title}
			/>
		</section>
	);
}
