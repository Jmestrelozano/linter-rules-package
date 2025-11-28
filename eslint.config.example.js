/**
 * ESLint configuration example with linter-rules-package
 * 
 * Copy this file to your project and adjust according to your needs.
 */

import linterRules from "linter-rules-package";

export default {
	plugins: {
		"linter-rules-package": linterRules,
	},
	rules: {
		// Rule to prevent inline interfaces
		"linter-rules-package/no-inline-interfaces": [
			"error",
			{
				excludedPaths: [
					"src/components/shadcn/ui/", // Exclude shadcn/ui components
					"src/interfaces/", // Interfaces in this folder are fine
				],
			},
		],
		// Rule to detect code duplication
		"linter-rules-package/no-code-duplication": [
			"warn",
			{
				minLines: 10, // Minimum lines to consider duplication
				minSimilarity: 80, // Minimum similarity percentage
				excludedPaths: [
					"src/components/shadcn/ui/",
				],
			},
		],
	},
};

