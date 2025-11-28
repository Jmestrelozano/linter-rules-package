# Security Policy

## Supported Versions

We currently support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please **DO NOT** create a public issue. Instead, please:

1. Send an email to [your-email@example.com] with details of the vulnerability
2. Include detailed information on how to reproduce the issue
3. Wait for a response before making the vulnerability public

We commit to:
- Responding within 48 hours
- Providing an update on progress within 7 days
- Publishing a security patch as soon as possible

## Implemented Security Measures

This library implements the following security measures:

### Path Traversal Protection
- Validation and normalization of all file paths
- Prevention of access to files outside the project directory
- Validation of absolute and relative paths

### Resource Limits
- Maximum file size limit: 10MB
- Maximum files processed: 1000 files
- Maximum path length: 4096 characters
- Maximum code comparisons: 10000 comparisons
- Maximum normalized identifiers: 10000 identifiers

### Input Validation
- Validation of all configuration options
- Sanitization of exclusion paths
- Validation of types and ranges of numeric values
- Limits on configuration arrays (maximum 100 excluded paths)

### ReDoS (Regular Expression Denial of Service) Protection
- Escaping of special characters in regex
- Limits on the size of processed code for normalization
- Limits on identifier length

### DoS (Denial of Service) Protection
- Limits on processed content size
- Limits on the number of analyzed code blocks
- Limits on the number of comparisons performed

## Best Practices

1. **Validate User Input**: If your application accepts user configuration, validate and sanitize input before passing it to ESLint rules.

2. **Limit File Access**: Ensure that rules only have access to files within your project.

3. **Review Configuration**: Regularly review ESLint configuration to ensure excluded paths are appropriate.

4. **Keep Updated**: Keep the library updated to the latest version to receive security patches.

## Dependencies

This library has minimal dependencies and only uses `peerDependencies` for ESLint. It does not include production dependencies that could introduce vulnerabilities.

## Security Audit

It is recommended to regularly run:
```bash
npm audit
```

To check for vulnerabilities in development dependencies.

## Security History

All fixed vulnerabilities will be documented in the release notes of the corresponding versions.

