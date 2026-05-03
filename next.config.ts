import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	allowedDevOrigins: ["127.0.0.1", "localhost"],
	devIndicators: false,
	serverExternalPackages: ["@napi-rs/canvas", "pdf-parse", "pdfjs-dist", "protobufjs"],
	outputFileTracingIncludes: {
		"/*": [
			"./node_modules/@napi-rs/canvas/**/*",
			"./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
			"./node_modules/pdf-parse/**/*",
			"./node_modules/pdfjs-dist/**/*",
		],
	},
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
