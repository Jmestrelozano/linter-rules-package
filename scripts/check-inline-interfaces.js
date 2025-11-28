#!/usr/bin/env node

/**
 * Script to verify that there are no interfaces, types, enums, or other TypeScript declarations
 * defined directly in components or functions. They should be in a dedicated interfaces folder.
 *
 * Can be configured via environment variables:
 * - EXCLUDED_PATHS: comma-separated list of paths to exclude
 * - PROJECT_ROOT: root directory of the project (defaults to current working directory)
 */

import { readFileSync } from "node:fs";
import {
	getStagedFiles,
	projectRoot,
	shouldExcludeFile,
	validateAndResolvePath,
	isValidFileSize,
} from "./utils/common.js";

/**
 * Checks if a file has inline interfaces, types, enums, or other TypeScript declarations
 */
function checkInlineInterfaces(filePath) {
	try {
		// Validate and resolve path to prevent path traversal
		const fullPath = validateAndResolvePath(filePath, projectRoot);
		if (!fullPath) {
			console.error(`Invalid or unsafe path: ${filePath}`);
			return [];
		}

		// Validate file size before reading
		if (!isValidFileSize(filePath)) {
			console.error(`File too large or invalid: ${filePath}`);
			return [];
		}

		const content = readFileSync(fullPath, "utf-8");

		const issues = [];
		const lines = content.split("\n");

		// Search for defined interfaces (export interface or interface)
		for (let index = 0; index < lines.length; index++) {
			const line = lines[index];
			const lineNumber = index + 1;
			const trimmedLine = line.trim();

			// Detect interfaces: "interface Name" or "export interface Name"
			const interfaceMatch = trimmedLine.match(
				/^(export\s+)?interface\s+(\w+)/,
			);
			if (interfaceMatch) {
				const interfaceName = interfaceMatch[2];

				// Verify it's not an import
				if (!trimmedLine.includes("from") && !trimmedLine.includes("import")) {
					issues.push({
						line: lineNumber,
						type: "interface",
						name: interfaceName,
						content: trimmedLine,
					});
				}
			}

			// Detect defined types (export type or type)
			// Only allow simple primitives and unions of primitives (not literals)
			const typeMatch = trimmedLine.match(/^(export\s+)?type\s+(\w+)\s*=/);
			if (typeMatch) {
				const typeName = typeMatch[2];

				// Verify it's not an import
				if (!trimmedLine.includes("from") && !trimmedLine.includes("import")) {
					// Extract the type definition part (after the =)
					const typeDef = trimmedLine.split("=").slice(1).join("=").trim();

					// Check if it contains string literal types (quoted strings)
					const hasStringLiterals = /["'`][^"'`]+["'`]/.test(typeDef);
					
					// Check if it contains number literals (standalone numbers, not part of keywords)
					// Match numbers that are not preceded/followed by word characters (like in "number")
					const hasNumberLiterals = /(?:^|[^a-zA-Z_])\d+(?:[^a-zA-Z_]|$)/.test(typeDef);
					
					// Check if it's a simple primitive type (string, number, boolean, etc.)
					const isPrimitiveType = /^(string|number|boolean|null|undefined|void|any)\s*;?$/.test(
						typeDef,
					);

					// Check if it's a union of primitives only (string | number | boolean)
					// Must contain only primitive keywords, no literals, no objects, etc.
					const isUnionOfPrimitives =
						/\|\s*/.test(typeDef) &&
						!hasStringLiterals &&
						!hasNumberLiterals &&
						!typeDef.includes("{") &&
						!typeDef.includes("<") &&
						/^(string|number|boolean)(\s*\|\s*(string|number|boolean))*\s*;?$/.test(
							typeDef.replace(/\s/g, ""),
						);

					// If it's not a simple primitive or union of primitives, report it
					// This includes: literal types, unions with literals, objects, generics, etc.
					if (!isPrimitiveType && !isUnionOfPrimitives) {
						issues.push({
							line: lineNumber,
							type: "type",
							name: typeName,
							content: trimmedLine.substring(0, 100),
						});
					}
				}
			}

			// Detect enums: "enum Name" or "export enum Name"
			const enumMatch = trimmedLine.match(/^(export\s+)?enum\s+(\w+)/);
			if (enumMatch) {
				const enumName = enumMatch[2];

				// Verify it's not an import
				if (!trimmedLine.includes("from") && !trimmedLine.includes("import")) {
					issues.push({
						line: lineNumber,
						type: "enum",
						name: enumName,
						content: trimmedLine,
					});
				}
			}
		}

		return issues;
	} catch (error) {
		console.error(`Error reading file ${filePath}:`, error.message);
		return [];
	}
}

/**
 * Main function
 */
function main() {
	const stagedFiles = getStagedFiles();

	if (stagedFiles.length === 0) {
		return; // No files to check
	}

	const allIssues = [];

	for (const file of stagedFiles) {
		if (shouldExcludeFile(file)) {
			continue; // Skip excluded files
		}

		// Check inline interfaces/types/enums
		const interfaceIssues = checkInlineInterfaces(file);
		if (interfaceIssues.length > 0) {
			allIssues.push({
				file,
				issues: interfaceIssues,
			});
		}
	}

	if (allIssues.length > 0) {
		console.error(
			"\n❌ Error: Found interfaces, types, enums, or other TypeScript declarations defined directly in components/functions:\n",
		);

		for (const { file, issues } of allIssues) {
			console.error(`\n📄 ${file}:`);
			for (const { line, type, name, content } of issues) {
				console.error(
					`   Line ${line}: ${type.toUpperCase()} "${name}" defined inline`,
				);
				console.error(
					`   ${content.substring(0, 100)}${content.length > 100 ? "..." : ""}`,
				);
			}
		}

		console.error("\n💡 Solution:");
		console.error(
			"   Interfaces, types, enums, and other TypeScript declarations should be in a dedicated interfaces folder",
		);
		console.error("   following the pattern established in the project.");
		console.error(
			"\n   Configure excluded paths via EXCLUDED_PATHS environment variable.\n",
		);

		process.exit(1);
	}
}

main();

