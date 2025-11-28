#!/usr/bin/env node

/**
 * Common utilities for validation scripts
 */

import { execSync } from "node:child_process";
import { dirname, join, resolve, normalize, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { statSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get project root - can be overridden via environment variable
// Defaults to current working directory
export const projectRoot = process.env.PROJECT_ROOT || process.cwd();

// Security limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES_TO_PROCESS = 1000; // Maximum number of files to process
const MAX_PATH_LENGTH = 4096;

// Default paths to exclude
const DEFAULT_EXCLUDED_PATHS = [
	"node_modules/",
	".husky/",
	"scripts/",
	"dist/",
	"build/",
];

/**
 * Validates that a path pattern is safe (no path traversal attempts)
 * @param {string} pattern - The path pattern to validate
 * @returns {boolean} - True if the pattern is safe
 */
function isValidPathPattern(pattern) {
	if (!pattern || typeof pattern !== "string") {
		return false;
	}

	// Reject patterns with path traversal attempts
	if (pattern.includes("..") || pattern.includes("~")) {
		return false;
	}

	// Reject absolute paths
	if (isAbsolute(pattern)) {
		return false;
	}

	return true;
}

/**
 * Validates and normalizes a file path to prevent path traversal attacks
 * @param {string} filePath - The file path to validate
 * @param {string} basePath - The base directory to resolve against
 * @returns {string|null} - Normalized absolute path, or null if invalid
 */
export function validateAndResolvePath(filePath, basePath = projectRoot) {
	if (!filePath || typeof filePath !== "string") {
		return null;
	}

	// Check path length
	if (filePath.length > MAX_PATH_LENGTH) {
		return null;
	}

	try {
		// Normalize the path to resolve .. and . segments
		const normalized = normalize(filePath);
		
		// Resolve against base path to prevent traversal
		const resolved = resolve(basePath, normalized);
		const baseResolved = resolve(basePath);
		
		// Ensure resolved path is within base directory
		if (!resolved.startsWith(baseResolved)) {
			return null;
		}

		return resolved;
	} catch (error) {
		// Invalid path
		return null;
	}
}

/**
 * Gets staged files in git with security limits
 */
export function getStagedFiles() {
	try {
		const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
			encoding: "utf-8",
			cwd: projectRoot,
			maxBuffer: 10 * 1024 * 1024, // 10MB buffer limit
		});
		
		const files = output
			.split("\n")
			.filter((line) => line.trim())
			.filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
			.slice(0, MAX_FILES_TO_PROCESS); // Limit number of files
		
		return files;
	} catch (error) {
		console.error("Error getting staged files:", error.message);
		return [];
	}
}

/**
 * Checks if a file should be excluded
 * Can be configured via environment variable EXCLUDED_PATHS (comma-separated)
 */
export function shouldExcludeFile(filePath) {
	if (!filePath || typeof filePath !== "string") {
		return false;
	}

	const customExcludedPaths =
		process.env.EXCLUDED_PATHS?.split(",")
			.map((p) => p.trim())
			.filter(isValidPathPattern) || [];
	
	const allExcludedPaths = [...DEFAULT_EXCLUDED_PATHS, ...customExcludedPaths];
	
	// Use normalized path comparison
	const normalizedPath = normalize(filePath);
	return allExcludedPaths.some((excludedPath) => {
		if (!isValidPathPattern(excludedPath)) {
			return false;
		}
		return normalizedPath.includes(normalize(excludedPath));
	});
}

/**
 * Validates file size to prevent DoS attacks
 * @param {string} filePath - Path to the file
 * @returns {boolean} - True if file size is within limits
 */
export function isValidFileSize(filePath) {
	try {
		const resolvedPath = validateAndResolvePath(filePath);
		if (!resolvedPath) {
			return false;
		}
		
		const stats = statSync(resolvedPath);
		return stats.size > 0 && stats.size <= MAX_FILE_SIZE;
	} catch (error) {
		return false;
	}
}

