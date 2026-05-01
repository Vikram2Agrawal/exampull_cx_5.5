import baseConfig from "./playwright.config";

export default {
	...baseConfig,
	webServer: undefined,
	use: {
		...baseConfig.use,
		baseURL: process.env.TEST_BASE_URL || process.env.WEB_URL,
	},
};
