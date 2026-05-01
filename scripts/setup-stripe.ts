import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
	throw new Error("STRIPE_SECRET_KEY is required.");
}

const stripe = new Stripe(stripeSecretKey, {
	apiVersion: "2025-10-29.clover",
});

const products = [
	{
		key: "scholar",
		name: "ExamPull Scholar",
		prices: [
			{ env: "STRIPE_PRICE_SCHOLAR_MONTHLY", amount: 500, recurring: "month" },
			{ env: "STRIPE_PRICE_SCHOLAR_ANNUAL", amount: 3000, recurring: "year" },
		],
	},
	{
		key: "guru",
		name: "ExamPull Guru",
		prices: [
			{ env: "STRIPE_PRICE_GURU_MONTHLY", amount: 2000, recurring: "month" },
			{ env: "STRIPE_PRICE_GURU_ANNUAL", amount: 12000, recurring: "year" },
		],
	},
	{
		key: "credits",
		name: "ExamPull Credit Packs",
		prices: [
			{ env: "STRIPE_PRICE_CREDITS_20", amount: 100, credits: 20 },
			{ env: "STRIPE_PRICE_CREDITS_100", amount: 400, credits: 100 },
			{ env: "STRIPE_PRICE_CREDITS_240", amount: 800, credits: 240 },
		],
	},
] as const;

async function findOrCreateProduct(product: (typeof products)[number]) {
	const existing = await stripe.products.search({
		query: `metadata["exampull_key"]:"${product.key}"`,
		limit: 1,
	});

	if (existing.data[0]) {
		return existing.data[0];
	}

	return stripe.products.create({
		name: product.name,
		metadata: { exampull_key: product.key },
	});
}

async function findOrCreatePrice({
	productId,
	envName,
	amount,
	recurring,
	credits,
}: {
	productId: string;
	envName: string;
	amount: number;
	recurring?: "month" | "year";
	credits?: number;
}) {
	const existing = await stripe.prices.search({
		query: `metadata["exampull_env"]:"${envName}"`,
		limit: 1,
	});

	if (existing.data[0]) {
		return existing.data[0];
	}

	return stripe.prices.create({
		product: productId,
		currency: "usd",
		unit_amount: amount,
		recurring: recurring ? { interval: recurring } : undefined,
		metadata: {
			exampull_env: envName,
			...(credits ? { credits: String(credits) } : {}),
		},
	});
}

const outputs: string[] = [];

for (const product of products) {
	const stripeProduct = await findOrCreateProduct(product);

	for (const price of product.prices) {
		const stripePrice = await findOrCreatePrice({
			productId: stripeProduct.id,
			envName: price.env,
			amount: price.amount,
			recurring: "recurring" in price ? price.recurring : undefined,
			credits: "credits" in price ? price.credits : undefined,
		});

		outputs.push(`${price.env}=${stripePrice.id}`);
	}
}

console.log(outputs.join("\n"));
