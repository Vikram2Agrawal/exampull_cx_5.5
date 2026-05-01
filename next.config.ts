import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	serverExternalPackages: ["@google-cloud/tasks", "google-gax", "protobufjs"],
	experimental: {
		serverActions: {
			bodySizeLimit: "100mb",
		},
	},
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "*.googleusercontent.com" },
			{ protocol: "https", hostname: "firebasestorage.googleapis.com" },
			{ protocol: "https", hostname: "*.run.app" },
			{ protocol: "https", hostname: "*.hosted.app" },
		],
	},
};

export default nextConfig;
