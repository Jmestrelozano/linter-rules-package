/**
 * ESLint plugin for code quality rules
 * - no-inline-interfaces: Prevents interfaces/types from being defined inline
 * - no-code-duplication: Detects code duplication that should be refactored
 */

import noCodeDuplication from "./rules/no-code-duplication.js";
import noInlineInterfaces from "./rules/no-inline-interfaces.js";

export default {
	rules: {
		"no-inline-interfaces": noInlineInterfaces,
		"no-code-duplication": noCodeDuplication,
	},
	configs: {
		recommended: {
			rules: {
				"linter-rules-package/no-inline-interfaces": "error",
				"linter-rules-package/no-code-duplication": "warn",
			},
		},
	},
};

