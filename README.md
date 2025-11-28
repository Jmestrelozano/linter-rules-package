# Linter Rules Package

ESLint rules and validation scripts package to maintain code quality. Includes:

- **no-inline-interfaces**: Prevents interfaces, types, enums, and other TypeScript declarations from being defined inline in components or functions
- **no-code-duplication**: Detects code duplication that should be refactored

## Installation

```bash
npm install --save-dev linter-rules-package
```

Or if you're using the package locally:

```bash
npm install --save-dev ./path/to/linter-rules-package
```

## Usage with ESLint

### Basic configuration

Add the plugin to your ESLint configuration:

```javascript
// eslint.config.js or .eslintrc.js
import linterRules from "linter-rules-package";

export default {
  plugins: {
    "linter-rules-package": linterRules,
  },
  rules: {
    "linter-rules-package/no-inline-interfaces": "error",
    "linter-rules-package/no-code-duplication": "warn",
  },
};
```

### Advanced configuration

You can configure excluded paths and other parameters:

```javascript
export default {
  plugins: {
    "linter-rules-package": linterRules,
  },
  rules: {
    "linter-rules-package/no-inline-interfaces": [
      "error",
      {
        excludedPaths: [
          "src/components/shadcn/ui/",
          "src/interfaces/",
        ],
      },
    ],
    "linter-rules-package/no-code-duplication": [
      "warn",
      {
        minLines: 10,
        minSimilarity: 80,
        excludedPaths: [
          "src/components/shadcn/ui/",
        ],
      },
    ],
  },
};
```

## Usage with Biome

Biome does not support ESLint plugins directly, but you can use the validation scripts alongside Biome:

### Integration with Biome

Add the scripts to your npm scripts and run them before or after Biome:

```json
{
  "scripts": {
    "lint": "biome check . && check-inline-interfaces && check-code-duplication",
    "lint:fix": "biome check --write . && check-inline-interfaces && check-code-duplication"
  }
}
```

Or use them in git hooks:

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx @biomejs/biome check --staged .
npx check-inline-interfaces
npx check-code-duplication
```

## Usage with Validation Scripts

Scripts can be executed directly or as part of a git hook (pre-commit).

### Manual execution

```bash
# Check for inline interfaces
npx check-inline-interfaces

# Check for code duplication
npx check-code-duplication
```

### Configuration with environment variables

Scripts can be configured via environment variables:

```bash
# Exclude specific paths
EXCLUDED_PATHS="src/components/shadcn/ui/,src/interfaces/" npx check-inline-interfaces

# Configure duplication parameters
MIN_DUPLICATION_LINES=15 MIN_SIMILARITY=85 npx check-code-duplication

# Specify project root directory
PROJECT_ROOT=/path/to/project npx check-inline-interfaces
```

### Integration with Husky (pre-commit)

Add the scripts to your pre-commit hook:

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx check-inline-interfaces
npx check-code-duplication
```

Or using `lint-staged`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "check-inline-interfaces",
      "check-code-duplication"
    ]
  }
}
```

## Rules

### no-inline-interfaces

This rule prevents interfaces, complex types, enums, and other TypeScript declarations from being defined directly in components or functions. They should be in a dedicated interfaces folder.

**Allows:**
- Simple primitive types: `type Id = string`
- Unions of primitive types: `type Id = string | number | boolean`
- Interfaces, types, and enums in excluded folders

**Rejects:**
- Inline defined interfaces: `interface User { name: string }`
- Inline defined complex types: `type User = { name: string; age: number }`
- Inline defined enums: `enum Status { Active, Inactive }`
- Types with literals: `type RefundErrorCode = "1900" | "1901" | "1902"`
- Unions with literal types: `type Status = "active" | "inactive"`
- Types with numeric literals: `type Code = 1 | 2 | 3`

**Examples:**

✅ **Allowed:**
```typescript
type Id = string;
type Value = number;
type Flag = boolean;
type Primitive = string | number | boolean;
type Mixed = string | number;
```

❌ **Rejected:**
```typescript
// Types with string literals
type RefundErrorCode = "1900" | "1901" | "1902";
type Status = "active" | "inactive" | "pending";

// Types with numeric literals
type Code = 1 | 2 | 3;
type Priority = 0 | 1 | 2;

// Complex types
type User = { name: string; age: number };
type Config = Record<string, string>;

// Interfaces
interface User { name: string; }

// Enums
enum Status { Active, Inactive }
```

### no-code-duplication

This rule detects duplicated code blocks that should be refactored. It compares normalized code blocks (without comments or extra spaces) within the same file (ESLint rule) or across multiple files (script).

**Configurable parameters:**
- `minLines`: Minimum number of lines to consider duplication (default: 10)
- `minSimilarity`: Minimum similarity percentage (default: 80)
- `excludedPaths`: Paths to exclude from checking

**How it works:**
- Normalizes code by removing comments and extra spaces
- Extracts code blocks of at least `minLines` lines
- Compares blocks and calculates similarity line by line
- Only reports if similarity is >= `minSimilarity`
- Ignores blocks that are too close (less than `minLines` distance apart)
- Ignores blocks that are mostly comments or empty lines

**Examples:**

✅ **Detects (covers):**

```typescript
// Example 1: Exact duplication (100% similar)
function processUser(user) {
  const name = user.name.trim();
  const email = user.email.toLowerCase();
  const age = parseInt(user.age, 10);
  if (age < 18) return null;
  return { name, email, age };
}

// ... more code ...

function processAdmin(admin) {
  const name = admin.name.trim();
  const email = admin.email.toLowerCase();
  const age = parseInt(admin.age, 10);
  if (age < 18) return null;
  return { name, email, age };
}

// Example 2: Duplication with small differences (80%+ similar)
function validateEmail(email) {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function checkEmail(email) {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Example 3: Duplicated blocks of 10+ lines
function handleSubmit() {
  setLoading(true);
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    setSuccess(true);
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
}

// ... more code ...

function handleUpdate() {
  setLoading(true);
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    setSuccess(true);
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
}
```

❌ **Does NOT detect (does not cover):**

```typescript
// Example 1: Very short blocks (< 10 lines by default)
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

// Example 2: Low similarity (< 80% by default)
function processUser(user) {
  const name = user.name.trim();
  const email = user.email.toLowerCase();
  return { name, email };
}

function processAdmin(admin) {
  const role = admin.role.toUpperCase();
  const permissions = admin.permissions.join(',');
  const active = admin.status === 'active';
  return { role, permissions, active };
}

// Example 3: Only differs in variable names (NOW detects this)
function calculateTotal(items) {
  let sum = 0;
  for (const item of items) {
    sum += item.price;
  }
  return sum;
}

function calculateSum(products) {
  let total = 0;
  for (const product of products) {
    total += product.cost;
  }
  return total;
}
// ✅ Now DOES detect this case because it normalizes variable names

// Example 4: Blocks too close (less than minLines distance apart)
function first() {
  // 10 lines of code
}

function second() {
  // 10 lines of identical code
}

// Example 5: Mostly comments
function example() {
  // This is a long comment
  // that takes up many lines
  // but is not real code
  // ... more comments ...
  return true;
}

// Example 6: Structural duplication but different logic
function validateEmail(email) {
  if (!email) return false;
  return email.includes('@');
}

function validatePhone(phone) {
  if (!phone) return false;
  return phone.length === 10;
}
```

**Limitations:**
- Does not detect structural duplication with different logic
- Only compares lines in the same order (does not detect reordered code)
- Requires blocks of at least 10 lines (configurable)
- Requires similarity of at least 80% (configurable)
- Identifier normalization may have false positives in complex cases

## Excluded Paths Configuration

By default, the following are excluded:
- `node_modules/`
- `.husky/`
- `scripts/`
- `dist/`
- `build/`

You can add more paths via:
- ESLint options (for rules)
- `EXCLUDED_PATHS` environment variable (for scripts)

## License

MIT
