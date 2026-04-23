---
title: 'Build Guards from Values'
description: 'Derive guards automatically from sample data with is.from.'
---

`is.from` reflects on a runtime value and returns a fully typed guard that validates structurally equivalent data. Use it to build validation schemas directly from sample data, mock objects, or API response fixtures (no manual guard composition required).

```typescript
import { is } from 'ts-chas/guard';

const UserGuard = is.from({ name: 'Alice', age: 30 });
// Equivalent to: is.object({ name: is.string, age: is.number })

UserGuard({ name: 'Bob', age: 25 }); // true
UserGuard({ name: 'Bob' }); // false — missing `age`
```

---

## Two modes

`is.from` supports two inference strategies controlled by the `literal` option:

| Mode                | Syntax                              | Primitives                      | Arrays                       | Objects                               |
| ------------------- | ----------------------------------- | ------------------------------- | ---------------------------- | ------------------------------------- |
| **Broad** (default) | `is.from(value)`                    | Widened (`string`, `number`, …) | `is.array(…)` — any length   | `is.object(…)` — extra keys allowed   |
| **Literal**         | `is.from(value, { literal: true })` | Exact (`'hello'`, `42`, …)      | `is.tuple(…)` — fixed length | `is.object(…).strict` — no extra keys |

---

## Broad inference (default)

Without options, `is.from` widens primitive types and produces flexible collection guards. Any value of the same _type_ passes, not just the same _value_.

### Primitives

```typescript
const strGuard = is.from('hello');
strGuard('world'); // true  — any string passes
strGuard(42); // false — not a string

const numGuard = is.from(42);
numGuard(100); // true  — any number passes

const boolGuard = is.from(true);
boolGuard(false); // true  — any boolean passes
```

### Objects

Object keys are required but extra keys are allowed by default. Nested values are recursively reflected.

```typescript
const guard = is.from({ name: 'Alice', age: 30 });
// Inferred as Guard<{ name: string; age: number }>

guard({ name: 'Bob', age: 25 }); // true
guard({ name: 'Bob' }); // false — missing `age`
guard({ name: 'Bob', age: 25, extra: true }); // true  — extra keys OK
```

### Arrays

Arrays produce element-typed guards of any length:

```typescript
const guard = is.from(['hello', 'world']);
// Inferred as Guard<string[]>

guard(['test']); // true  — any string array
guard(['a', 'b', 'c']); // true  — any length
guard(['a', 1]); // false — mixed types
```

---

## Strict literal inference

Pass `{ literal: true }` to preserve exact values. Primitives become literal guards, arrays become fixed-length tuples, and objects reject extra keys.

### Primitives

```typescript
const strGuard = is.from('hello', { literal: true });
// Inferred as Guard<'hello'>

strGuard('hello'); // true
strGuard('world'); // false — only 'hello' passes

const numGuard = is.from(42, { literal: true });
numGuard(42); // true
numGuard(100); // false
```

### Objects (strict)

Literal objects apply `.strict` — extra keys are rejected:

```typescript
const guard = is.from({ status: 'active', meta: 'data' }, { literal: true });
// Inferred as Guard<{ status: 'active'; meta: 'data' }>

guard({ status: 'active', meta: 'data' }); // true
guard({ status: 'pending', meta: 'data' }); // false — wrong value
guard({ status: 'active', meta: 'data', extra: 1 }); // false — extra key
```

### Tuples (fixed-length arrays)

Literal arrays become tuples — each position is validated independently:

```typescript
const guard = is.from(['vip', 1], { literal: true });
// Inferred as Guard<['vip', 1]>

guard(['vip', 1]); // true
guard(['vip', 2]); // false — index 1 must be exactly 1
guard(['vip', 1, 2]); // false — too many elements
guard(['vip']); // false — too few elements
```

### Nested structures

Both modes recurse into nested arrays and objects. In literal mode, every level is strict:

```typescript
const guard = is.from(
	{
		env: 'prod',
		ports: [80, 443],
		options: { secure: true },
	},
	{ literal: true }
);
// Inferred as Guard<{ env: 'prod'; ports: [80, 443]; options: { secure: true } }>

guard({ env: 'prod', ports: [80, 443], options: { secure: true } });
// true

guard({ env: 'dev', ports: [80, 443], options: { secure: true } });
// false — env must be 'prod'

guard({ env: 'prod', ports: [80, 443, 8080], options: { secure: true } });
// false — ports is a fixed [80, 443] tuple

guard({ env: 'prod', ports: [80, 443], options: { secure: true, extra: 1 } });
// false — nested objects are also strict
```

---

## Supported types

`is.from` handles the following types out of the box. Built-in class instances map to their corresponding guard without recursion:

| Value           | Broad mode         | Literal mode              |
| --------------- | ------------------ | ------------------------- |
| `string`        | `is.string`        | `is.literal(value)`       |
| `number`        | `is.number`        | `is.literal(value)`       |
| `boolean`       | `is.boolean`       | `is.literal(value)`       |
| `bigint`        | `is.bigint`        | `is.literal(value)`       |
| `null`          | `is.null`          | `is.null`                 |
| `undefined`     | `is.undefined`     | `is.undefined`            |
| `symbol`        | `is.symbol`        | `is.symbol`               |
| Plain object    | `is.object({ … })` | `is.object({ … }).strict` |
| Array           | `is.array(…)`      | `is.tuple([…])`           |
| `Date`          | `is.date`          | `is.date`                 |
| `RegExp`        | `is.regexp()`      | `is.regexp()`             |
| `URL`           | `is.url()`         | `is.url()`                |
| `File`          | `is.file`          | `is.file`                 |
| `Error`         | `is.error`         | `is.error`                |
| `Promise`       | `is.promise`       | `is.promise`              |
| `FormData`      | `is.formData`      | `is.formData`             |
| `Uint8Array`    | `is.uint8Array`    | `is.uint8Array`           |
| `Buffer`        | `is.buffer`        | `is.buffer`               |
| `ArrayBuffer`   | `is.arrayBuffer`   | `is.arrayBuffer`          |
| `DataView`      | `is.dataView`      | `is.dataView`             |
| Everything else | `is.unknown`       | Falls back to broad       |

---

## Type inference

The returned guard carries full type information. Use `InferGuard` or `.$infer` to extract it:

```typescript
import { is, type InferGuard } from 'ts-chas/guard';

const Config = is.from({
	host: 'localhost',
	port: 8080,
	debug: true,
});

// Extract the type
type Config = InferGuard<typeof Config>;
// { host: string; port: number; debug: boolean }

// Or use $infer
type Config2 = typeof Config.$infer;
```

In literal mode, the extracted type preserves exact values:

```typescript
const Config = is.from({ env: 'prod', port: 443 }, { literal: true });

type Config = typeof Config.$infer;
// { env: 'prod'; port: 443 }
```

---

## Chaining helpers

The guard returned by `is.from` is a regular guard — all universal helpers work on it:

```typescript
const guard = is.from({ name: 'Alice', age: 30 });

// Parse with error reporting
const result = guard.parse(input);

// Assert with throw on failure
const config = guard.assert(input);

// Generate test data
const samples = await guard.generate(10);

// JSON Schema
const schema = guard.toJsonSchema();
```

---

## Common patterns

### Deriving guards from API responses

```typescript
// Use a sample response to build the guard
const ApiResponse = is.from({
	id: 1,
	name: 'Widget',
	price: 9.99,
	tags: ['sale'],
	metadata: {
		createdAt: '2024-01-01',
		updatedAt: '2024-06-15',
	},
});

// Validate incoming data against the derived schema
function handleResponse(data: unknown) {
	const result = ApiResponse.parse(data);
	if (result.isOk()) {
		return result.value; // fully typed
	}
}
```

### Config validation with exact values

```typescript
const ALLOWED_CONFIG = is.from(
	{
		env: 'production',
		features: ['analytics', 'logging'],
		limits: { maxRetries: 3, timeout: 5000 },
	},
	{ literal: true }
);

// Only exactly this config shape passes
ALLOWED_CONFIG.assert(loadedConfig);
```

### Quick test fixtures

```typescript
const UserShape = is.from({ name: 'test', email: 'a@b.com', age: 25 });

// Generate valid users matching the same shape
const users = await UserShape.generate(20);
it.each(users)('processes user %o', user => {
	expect(processUser(user)).not.toThrow();
});
```
