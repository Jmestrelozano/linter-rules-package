/**
 * ESLint rule to prevent interfaces, types, enums, and other TypeScript declarations
 * from being defined inline in components or functions.
 * They should be in a dedicated interfaces folder.
 *
 * This rule can be configured with excluded paths via ESLint options.
 */

import { shouldExcludeFile } from "../utils/linter-utils.js";

export default {
	meta: {
		type: "problem",
		docs: {
			description:
				"disallow interfaces, types, enums, and other TypeScript declarations defined directly in components/functions",
			category: "Best Practices",
			recommended: true,
		},
		messages: {
			inlineInterface:
				"Interface '{{name}}' should be defined in interfaces folder, not inline.",
			inlineType:
				"Type '{{name}}' should be defined in interfaces folder, not inline.",
			inlineEnum:
				"Enum '{{name}}' should be defined in interfaces folder, not inline.",
		},
		schema: [
			{
				type: "object",
				properties: {
					excludedPaths: {
						type: "array",
						items: {
							type: "string",
						},
						description: "Array of path patterns to exclude from this rule",
					},
				},
				additionalProperties: false,
			},
		],
	},
	create(context) {
		const options = context.options[0] || {};
		
		// Validate and sanitize excludedPaths input
		let customExcludedPaths = [];
		if (Array.isArray(options.excludedPaths)) {
			customExcludedPaths = options.excludedPaths
				.filter((path) => typeof path === "string" && path.length > 0 && path.length <= 4096)
				.filter((path) => !path.includes("..") && !path.includes("~"))
				.slice(0, 100); // Limit to 100 excluded paths
		}

		// Create a custom shouldExclude function that uses both default and custom paths
		const shouldExclude = (filePath) => {
			if (!filePath || typeof filePath !== "string") {
				return false;
			}
			return shouldExcludeFile(filePath, customExcludedPaths);
		};

		return {
			TSInterfaceDeclaration(node) {
				const filename = context.getFilename();
				if (shouldExclude(filename)) {
					return;
				}

				context.report({
					node,
					messageId: "inlineInterface",
					data: {
						name: node.id.name,
					},
				});
			},
			TSTypeAliasDeclaration(node) {
				const filename = context.getFilename();
				if (shouldExclude(filename)) {
					return;
				}

				// Check if it's a simple type (should be allowed)
				const typeNode = node.typeAnnotation;
				if (!typeNode) {
					return;
				}

				// Allow only simple primitive types and unions of primitives (not literals)
				const isSimpleType =
					typeNode.type === "TSStringKeyword" ||
					typeNode.type === "TSNumberKeyword" ||
					typeNode.type === "TSBooleanKeyword" ||
					typeNode.type === "TSNullKeyword" ||
					typeNode.type === "TSUndefinedKeyword" ||
					typeNode.type === "TSVoidKeyword" ||
					typeNode.type === "TSAnyKeyword" ||
					// Allow unions of primitive types only (string | number | boolean)
					// But NOT unions with literal types (like "1900" | "1901")
					(typeNode.type === "TSUnionType" &&
						typeNode.types.every(
							(t) =>
								t.type === "TSStringKeyword" ||
								t.type === "TSNumberKeyword" ||
								t.type === "TSBooleanKeyword",
						)) ||
					(typeNode.type === "TSFunctionType" &&
						!typeNode.typeAnnotation?.typeAnnotation?.type?.includes("Object"));

				// Report if it's NOT a simple type (includes literal types, unions with literals, objects, etc.)
				if (!isSimpleType) {
					context.report({
						node,
						messageId: "inlineType",
						data: {
							name: node.id.name,
						},
					});
				}
			},
			TSEnumDeclaration(node) {
				const filename = context.getFilename();
				if (shouldExclude(filename)) {
					return;
				}

				context.report({
					node,
					messageId: "inlineEnum",
					data: {
						name: node.id.name,
					},
				});
			},
		};
	},
};

