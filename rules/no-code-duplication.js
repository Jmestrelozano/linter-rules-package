/**
 * ESLint rule to detect code duplication.
 * This rule checks for repeated code blocks of significant length.
 *
 * Note: This is a simplified version. For more complex duplication detection,
 * consider using tools like jscpd or code-clone-detector.
 */

import { shouldExcludeFile } from "../utils/linter-utils.js";

const MIN_DUPLICATION_LINES = 10;
const MIN_SIMILARITY = 80;

/**
 * Normalizes identifiers (variables, functions, parameters) to placeholders
 * This allows detecting structural duplication even when variable names differ
 */
function normalizeIdentifiers(code) {
	// Limit code size to prevent ReDoS attacks
	const MAX_CODE_SIZE = 1 * 1024 * 1024; // 1MB limit for identifier normalization
	if (code.length > MAX_CODE_SIZE) {
		return code; // Return original if too large
	}

	// Extract all identifiers (variable names, function names, etc.)
	// Pattern: word characters that are not keywords
	const identifierPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
	const keywords = new Set([
		"if", "else", "for", "while", "do", "switch", "case", "break", "continue",
		"return", "function", "const", "let", "var", "class", "extends", "implements",
		"import", "export", "from", "default", "async", "await", "try", "catch", "finally",
		"throw", "new", "this", "super", "typeof", "instanceof", "in", "of", "true", "false",
		"null", "undefined", "void", "any", "string", "number", "boolean", "object",
		"interface", "type", "enum", "namespace", "module", "declare", "as", "is"
	]);

	const identifiers = new Map();
	let counter = 0;
	const seen = new Set();
	const MAX_IDENTIFIERS = 10000; // Limit number of identifiers to prevent DoS

	// First pass: collect all identifiers and assign placeholders
	const matches = [...code.matchAll(identifierPattern)];
	for (const match of matches) {
		if (identifiers.size >= MAX_IDENTIFIERS) {
			break; // Stop if too many identifiers
		}
		
		const identifier = match[1];
		// Limit identifier length to prevent ReDoS
		if (identifier.length > 100) {
			continue;
		}
		
		if (!keywords.has(identifier) && !seen.has(identifier)) {
			seen.add(identifier);
			identifiers.set(identifier, `__VAR${counter++}__`);
		}
	}

	// Second pass: replace identifiers with placeholders
	let normalized = code;
	for (const [identifier, placeholder] of identifiers) {
		// Escape special regex characters to prevent ReDoS
		const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		// Use word boundaries to avoid partial matches
		const regex = new RegExp(`\\b${escapedIdentifier}\\b`, "g");
		normalized = normalized.replace(regex, placeholder);
	}

	return normalized;
}

/**
 * Normalizes code by removing whitespace, comments, and normalizing identifiers
 */
function normalizeCode(code) {
	const lines = code.split("\n");
	const normalized = [];
	for (const line of lines) {
		// Remove comments
		const withoutComments = line.split("//")[0].split("/*")[0];
		// Normalize whitespace
		const normalizedLine = withoutComments.trim().replace(/\s+/g, " ");
		if (normalizedLine.length > 0) {
			normalized.push(normalizedLine);
		}
	}
	const codeWithoutWhitespace = normalized.join("\n");
	
	// Normalize identifiers to detect structural duplication
	return normalizeIdentifiers(codeWithoutWhitespace);
}

/**
 * Calculates similarity percentage between two code blocks
 */
function calculateSimilarity(code1, code2) {
	const normalized1 = normalizeCode(code1);
	const normalized2 = normalizeCode(code2);

	if (normalized1 === normalized2) return 100;

	const lines1 = normalized1.split("\n");
	const lines2 = normalized2.split("\n");

	const maxLen = Math.max(lines1.length, lines2.length);
	if (maxLen === 0) return 0;

	let matches = 0;
	const minLen = Math.min(lines1.length, lines2.length);

	for (let i = 0; i < minLen; i++) {
		if (lines1[i] === lines2[i]) {
			matches++;
		}
	}

	return (matches / maxLen) * 100;
}

/**
 * Extracts code blocks from file content
 */
function extractCodeBlocks(content, minLines = MIN_DUPLICATION_LINES) {
	const lines = content.split("\n");
	const blocks = [];
	const step = Math.max(1, Math.floor(minLines / 2));

	for (let i = 0; i <= lines.length - minLines; i += step) {
		const block = lines.slice(i, i + minLines).join("\n");
		const blockLines = block.split("\n");
		const nonEmptyLines = [];

		for (const line of blockLines) {
			const trimmed = line.trim();
			if (
				trimmed.length > 0 &&
				!trimmed.startsWith("//") &&
				!trimmed.startsWith("/*") &&
				!trimmed.startsWith("*") &&
				!trimmed.startsWith("*/")
			) {
				nonEmptyLines.push(line);
			}
		}

		if (nonEmptyLines.length >= minLines * 0.7) {
			blocks.push({
				startLine: i + 1,
				endLine: i + minLines,
				content: block,
				normalized: normalizeCode(block),
			});
		}
	}

	return blocks;
}

export default {
	meta: {
		type: "suggestion",
		docs: {
			description: "detect code duplication that should be refactored",
			category: "Best Practices",
			recommended: false, // This rule can be performance-intensive
		},
		messages: {
			codeDuplication:
				"Found duplicated code ({{similarity}}% similar) at lines {{startLine}}-{{endLine}}. Consider extracting into a shared utility, hook, or component.",
		},
		schema: [
			{
				type: "object",
				properties: {
					minLines: {
						type: "number",
						default: MIN_DUPLICATION_LINES,
					},
					minSimilarity: {
						type: "number",
						default: MIN_SIMILARITY,
					},
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
		
		// Validate and sanitize minLines input
		let minLines = MIN_DUPLICATION_LINES;
		if (typeof options.minLines === "number" && options.minLines > 0 && options.minLines <= 1000) {
			minLines = Math.floor(options.minLines);
		}
		
		// Validate and sanitize minSimilarity input
		let minSimilarity = MIN_SIMILARITY;
		if (typeof options.minSimilarity === "number" && options.minSimilarity >= 0 && options.minSimilarity <= 100) {
			minSimilarity = Math.max(0, Math.min(100, options.minSimilarity));
		}
		
		// Validate and sanitize excludedPaths input
		let customExcludedPaths = [];
		if (Array.isArray(options.excludedPaths)) {
			customExcludedPaths = options.excludedPaths
				.filter((path) => typeof path === "string" && path.length > 0 && path.length <= 4096)
				.filter((path) => !path.includes("..") && !path.includes("~"))
				.slice(0, 100); // Limit to 100 excluded paths
		}

		const filename = context.getFilename();
		if (!filename || typeof filename !== "string" || filename.length > 4096) {
			return {};
		}
		
		if (shouldExcludeFile(filename, customExcludedPaths)) {
			return {};
		}

		const sourceCode = context.sourceCode || context.getSourceCode();
		const content = sourceCode.getText();
		
		// Limit content size to prevent DoS (10MB limit)
		const MAX_CONTENT_SIZE = 10 * 1024 * 1024;
		if (content.length > MAX_CONTENT_SIZE) {
			// Skip analysis for very large files
			return {};
		}

		// Extract code blocks
		const blocks = extractCodeBlocks(content, minLines);
		
		// Limit number of blocks to prevent DoS (O(n²) comparison)
		const MAX_BLOCKS = 1000;
		const limitedBlocks = blocks.slice(0, MAX_BLOCKS);

		// Find duplicates within the same file
		const duplicates = [];
		const MAX_COMPARISONS = 10000; // Limit total comparisons
		let comparisonCount = 0;
		
		for (let i = 0; i < limitedBlocks.length; i++) {
			if (comparisonCount >= MAX_COMPARISONS) {
				break;
			}
			
			for (let j = i + 1; j < limitedBlocks.length; j++) {
				comparisonCount++;
				if (comparisonCount >= MAX_COMPARISONS) {
					break;
				}
				const block1 = limitedBlocks[i];
				const block2 = limitedBlocks[j];

				// Skip if blocks are too close (likely overlapping)
				const lineDistance = Math.abs(block1.startLine - block2.startLine);
				if (lineDistance < minLines) {
					continue;
				}

				const similarity = calculateSimilarity(
					block1.normalized,
					block2.normalized,
				);

				if (similarity >= minSimilarity) {
					duplicates.push({
						block: block1,
						similarBlock: block2,
						similarity: Math.round(similarity),
					});
				}
			}
		}

		// Report duplicates
		if (duplicates.length > 0) {
			// Report only the first occurrence to avoid too many reports
			const firstDuplicate = duplicates[0];
			const block = firstDuplicate.block;

			return {
				Program(node) {
					context.report({
						node,
						messageId: "codeDuplication",
						data: {
							similarity: firstDuplicate.similarity,
							startLine: block.startLine,
							endLine: block.endLine,
						},
					});
				},
			};
		}

		return {};
	},
};

