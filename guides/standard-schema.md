---
title: 'Standard Schema Interoperability'
description: 'Using Zod, Valibot, and other Standard Schema V1 libraries with chas.'
---

`is.standard` allows you to wrap any [Standard Schema V1](https://github.com/standard-schema/standard-schema) compliant object and use it as a native `chas` guard. This is ideal for incremental migrations or using specialized libraries for specific leaf nodes while keeping `chas` at the root for object structure and deep error paths.

```typescript
import { is } from 'ts-chas/guard';
import { z } from 'zod';

// Wrap a Zod schema
const email = is.standard(z.string().email());

// Use it like any other chas guard
if (email(input)) {
	input; // string
}

const result = email.parse('not-an-email');
if (result.isErr()) {
	console.log(result.error.issues); // Standard Schema issues are surfaced
}
```

---

## Migration Pattern: "chas root, foreign leaves"

The recommended way to integrate foreign schemas is to let `chas` own the object structure (the "root") and use foreign schemas at the "leaves".

This gives you:

1. **Deep Error Paths**: `chas`'s `defineSchemas` can walk the object and report nested error paths (`address.street`, `user.name`) just like native guards.
2. **Standard Error Format**: `chas` returns `GuardErr` objects with its standard metadata, but surfaces the foreign library's specific issues in the `.issues` property.
3. **Incremental Migration**: Replace one leaf at a time as you rewrite your validation logic.

```typescript
import { is } from 'ts-chas/guard';
import { z } from 'zod';

// chas owns the object structure
const { User } = is.defineSchemas({
	User: {
		// chas native guard
		id: is.string.uuid(),

		// Zod leaf via is.standard
		email: is.standard(z.string().email().min(5)),

		// Nested chas object
		profile: {
			// Another foreign leaf
			bio: is.standard(z.string().max(160)),
			age: is.number.int.positive,
		},
	},
});

const result = User.parse({
	id: 'not-a-uuid',
	email: 'bad',
	profile: { bio: 'too long...'.repeat(100) },
});

if (result.isErr()) {
	const errors = result.error; // GuardErr[]

	// email error has full path and Zod issues
	const emailErr = errors.find(e => e.path.includes('email'));
	console.log(emailErr?.issues); // [{ message: 'Invalid email', ... }]
}
```

---

## Supported Libraries

`is.standard` works with any library that implements the Standard Schema V1 spec, including:

- **Zod** (via `@standard-schema/spec`)
- **Valibot**
- **ArkType**
- **Standard Schema** native implementations

---

## Technical Details

### Synchronous vs Asynchronous

`is.standard` detects if the underlying schema's `validate` method returns a `Promise`.

- If the schema is **synchronous**, the resulting guard works with all `chas` methods (`is()`, `.parse()`, `.assert()`, etc.).
- If the schema is **asynchronous**, calling it synchronously will throw an error. You must use `.parseAsync()` or `.whereAsync()` as with any other async logic in `chas`.

```typescript
const AsyncSchema = is.standard(someAsyncSchema);

// ❌ Throws: "returned a Promise during synchronous validation"
AsyncSchema.parse(input);

// ✅ Works
await AsyncSchema.parseAsync(input);
```

### Error Surface

When a `standard` guard fails, it produces a `GuardErr` where:

- `name` is set to `standard(<vendor>)` (e.g., `standard(zod)`).
- `issues` contains the raw array of `StandardSchemaV1.Issue` objects from the foreign library.

This allows your error reporting UI to either use the generic `chas` message or drill down into the vendor-specific issues when available.
