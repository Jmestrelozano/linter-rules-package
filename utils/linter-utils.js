/**
 * Common utilities for lint rules and validation scripts
 */

import { resolve, relative, isAbsolute, normalize } from "node:path";

// Default paths to exclude from validation
const DEFAULT_EXCLUDED_PATHS = [
	"node_modules/",
	".husky/",
	"scripts/",
	"dist/",
	"build/",
];

// Security limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PATH_LENGTH = 4096; // Maximum path length on most systems

/**
 * Validates and normalizes a file path to prevent path traversal attacks
 * @param {string} filePath - The file path to validate
 * @param {string} basePath - The base directory to resolve against
 * @returns {string|null} - Normalized path relative to base, or null if invalid
 */
export function validatePath(filePath, basePath) {
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

		// Return relative path
		return relative(baseResolved, resolved);
	} catch (error) {
		// Invalid path
		return null;
	}
}

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
 * Checks if a file should be excluded based on path patterns
 * @param {string} filePath - The file path to check
 * @param {string[]} customExcludedPaths - Additional paths to exclude
 * @returns {boolean} - True if the file should be excluded
 */
export function shouldExcludeFile(filePath, customExcludedPaths = []) {
	if (!filePath || typeof filePath !== "string") {
		return false;
	}

	// Validate custom excluded paths
	const validCustomPaths = Array.isArray(customExcludedPaths)
		? customExcludedPaths.filter(isValidPathPattern)
		: [];

	const allExcludedPaths = [...DEFAULT_EXCLUDED_PATHS, ...validCustomPaths];
	
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
 * @param {number} size - File size in bytes
 * @returns {boolean} - True if size is within limits
 */
export function isValidFileSize(size) {
	return typeof size === "number" && size > 0 && size <= MAX_FILE_SIZE;
}

