#!/usr/bin/env node

/**
 * Script to detect code duplication that should be refactored.
 * Detects repeated code blocks of significant length (10+ lines) that appear
 * in multiple files or multiple times in the same file.
 *
 * Can be configured via environment variables:
 * - EXCLUDED_PATHS: comma-separated list of paths to exclude
 * - PROJECT_ROOT: root directory of the project (defaults to current working directory)
 * - MIN_DUPLICATION_LINES: minimum lines to consider duplication (default: 10)
 * - MIN_SIMILARITY: minimum similarity percentage (default: 80)
 */

import { readFileSync } from "node:fs";
import {
	getStagedFiles,
	projectRoot,
	shouldExcludeFile,
	validateAndResolvePath,
	isValidFileSize,
} from "./utils/common.js";

// Minimum number of consecutive lines to consider a duplication
const MIN_DUPLICATION_LINES =
	parseInt(process.env.MIN_DUPLICATION_LINES, 10) || 10;
// Minimum similarity percentage to consider code duplicated
const MIN_SIMILARITY = parseInt(process.env.MIN_SIMILARITY, 10) || 80;

/**
 * Normalizes identifiers (variables, functions, parameters) to placeholders
 * This allows detecting structural duplication even when variable names differ
 */
function normalizeIdentifiers(code) {
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

	// First pass: collect all identifiers and assign placeholders
	const matches = [...code.matchAll(identifierPattern)];
	for (const match of matches) {
		const identifier = match[1];
		if (!keywords.has(identifier) && !seen.has(identifier)) {
			seen.add(identifier);
			identifiers.set(identifier, `__VAR${counter++}__`);
		}
	}

	// Second pass: replace identifiers with placeholders
	let normalized = code;
	for (const [identifier, placeholder] of identifiers) {
		// Use word boundaries to avoid partial matches
		const regex = new RegExp(`\\b${identifier}\\b`, "g");
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

	// Simple similarity: count matching lines
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
 * Extracts blocks at intervals to avoid overlapping comparisons
 */
function extractCodeBlocks(content, minLines = MIN_DUPLICATION_LINES) {
	const lines = content.split("\n");
	const blocks = [];

	// Extract blocks with gaps to avoid overlapping (every 5 lines)
	const step = Math.max(1, Math.floor(minLines / 2));

	for (let i = 0; i <= lines.length - minLines; i += step) {
		const block = lines.slice(i, i + minLines).join("\n");

		// Skip blocks that are mostly empty or comments
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

		// Only consider blocks with at least 70% non-empty lines
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

/**
 * Checks for code duplication in staged files
 */
function checkCodeDuplication() {
	const stagedFiles = getStagedFiles();

	if (stagedFiles.length === 0) {
		return; // No files to check
	}

	const allBlocks = [];
	const fileContents = new Map();

	// Read all staged files and extract code blocks
	for (const file of stagedFiles) {
		if (shouldExcludeFile(file)) {
			continue; // Skip excluded files
		}

		try {
			// Validate and resolve path to prevent path traversal
			const fullPath = validateAndResolvePath(file, projectRoot);
			if (!fullPath) {
				console.error(`Invalid or unsafe path: ${file}`);
				continue;
			}

			// Validate file size before reading
			if (!isValidFileSize(file)) {
				console.error(`File too large or invalid: ${file}`);
				continue;
			}

			const content = readFileSync(fullPath, "utf-8");
			fileContents.set(file, content);

			const blocks = extractCodeBlocks(content);
			for (const block of blocks) {
				allBlocks.push({
					file,
					...block,
				});
			}
		} catch (error) {
			// Skip files that can't be read
		}
	}

	// Find duplicates using a hash map for better performance
	const blockMap = new Map();
	const duplicates = [];
	const processed = new Set();

	// First pass: group blocks by normalized content hash
	for (const block of allBlocks) {
		const hash = block.normalized.substring(0, 50); // Use first part as quick hash
		if (!blockMap.has(hash)) {
			blockMap.set(hash, []);
		}
		blockMap.get(hash).push(block);
	}

	// Second pass: check similarity within hash groups
	blockMap.forEach((blocks, hash) => {
		if (blocks.length < 2) return;

		for (let i = 0; i < blocks.length; i++) {
			const block1 = blocks[i];
			const key1 = `${block1.file}:${block1.startLine}`;

			if (processed.has(key1)) continue;

			const similar = [block1];

			for (let j = i + 1; j < blocks.length; j++) {
				const block2 = blocks[j];
				const key2 = `${block2.file}:${block2.startLine}`;

				if (processed.has(key2)) continue;

				// Skip if blocks are too close in the same file (likely overlapping)
				if (block1.file === block2.file) {
					const lineDistance = Math.abs(block1.startLine - block2.startLine);
					if (lineDistance < MIN_DUPLICATION_LINES) {
						continue;
					}
				}

				const similarity = calculateSimilarity(
					block1.normalized,
					block2.normalized,
				);

				if (similarity >= MIN_SIMILARITY) {
					similar.push(block2);
					processed.add(key2);
				}
			}

			if (similar.length > 1) {
				// Check if it's in the same file (internal duplication) or different files
				const uniqueFiles = new Set(similar.map((b) => b.file));

				duplicates.push({
					blocks: similar,
					isSameFile: uniqueFiles.size === 1,
					fileCount: uniqueFiles.size,
				});

				processed.add(key1);
			}
		}
	});

	// Report duplicates
	if (duplicates.length > 0) {
		console.error(
			"\n⚠️  Warning: Found code duplication that should be refactored:\n",
		);

		for (let index = 0; index < duplicates.length; index++) {
			const duplicate = duplicates[index];
			const { blocks, isSameFile, fileCount } = duplicate;
			const firstBlock = blocks[0];

			console.error(`\n🔴 Duplication ${index + 1}:`);

			if (isSameFile) {
				console.error(`   Same file: ${firstBlock.file}`);
				console.error(
					`   Found ${blocks.length} similar blocks in the same file`,
				);
				for (let idx = 0; idx < blocks.length; idx++) {
					const block = blocks[idx];
					console.error(
						`   Block ${idx + 1}: Lines ${block.startLine}-${block.endLine}`,
					);
				}
			} else {
				console.error(`   Multiple files (${fileCount} files):`);
				const filesMap = new Map();
				for (const block of blocks) {
					if (!filesMap.has(block.file)) {
						filesMap.set(block.file, []);
					}
					filesMap.get(block.file).push(block);
				}

				for (const [file, fileBlocks] of filesMap) {
					console.error(`   📄 ${file}:`);
					for (const block of fileBlocks) {
						console.error(`      Lines ${block.startLine}-${block.endLine}`);
					}
				}
			}

			// Show a preview of the duplicated code
			const previewLines = firstBlock.content.split("\n").slice(0, 5);
			console.error("   Preview:");
			for (let idx = 0; idx < previewLines.length; idx++) {
				const line = previewLines[idx];
				console.error(
					`   ${firstBlock.startLine + idx}: ${line.substring(0, 80)}${line.length > 80 ? "..." : ""}`,
				);
			}
			if (firstBlock.content.split("\n").length > 5) {
				console.error("   ...");
			}
		}

		console.error("\n💡 Solution:");
		console.error("   Consider extracting the duplicated code into:");
		console.error("   - A shared utility function");
		console.error("   - A custom hook");
		console.error("   - A shared component");
		console.error("   - A shared service method if it's API-related");
		console.error(
			"\n   Configure via environment variables: EXCLUDED_PATHS, MIN_DUPLICATION_LINES, MIN_SIMILARITY\n",
		);

		// Exit with error code to block commit
		process.exit(1);
	}
}

/**
 * Main function
 */
function main() {
	checkCodeDuplication();
}

main();

