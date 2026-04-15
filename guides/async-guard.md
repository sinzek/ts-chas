# Async Guards: `.whereAsync`, `.refineAsync`, `.transformAsync`

Every guard in `ts-chas` runs synchronously by default. When a validation step requires I/O (a database lookup, an API call, a file read) you need async mode. Calling `.whereAsync()`, `.refineAsync()`, or `.transformAsync()` on any guard switches it into async mode and returns an `AsyncGuard<T>`.

`AsyncGuard` is not a `Guard`. It does not have `.parse()`, `.assert()`, or the helper chain. Its sole output method is `.parseAsync()`, which returns a `ResultAsync<T, GuardErr>`.

---

## Entering async mode

Any of the three async methods can start the chain. You can add sync helpers to the base guard first -- those run before any async step.

```ts
import { is } from 'ts-chas/guard';

// Start with a sync constraint, then add an async check
const UniqueEmail = is.string.email.whereAsync(async email => {
	return !(await db.users.exists({ email }));
});
```

Once you are in async mode you can continue chaining with the same three methods. You cannot re-enter sync mode after switching.

---

## `.whereAsync(fn)`

Appends an async predicate. Resolving `false` fails validation. The current value is passed to `fn` and must pass for the chain to continue.

```ts
const UniqueUsername = is.string.min(3).whereAsync(async name => {
	const taken = await db.users.exists({ username: name });
	return !taken;
});
```

If a `whereAsync` step returns `false`, subsequent steps are not called:

```ts
const second = vi.fn(async () => true);
const guard = is.string
	.whereAsync(async () => false) // fails here
	.whereAsync(second); // never called

await guard.parseAsync('hello');
expect(second).not.toHaveBeenCalled();
```

---

## `.refineAsync(fn)`

Appends an async same-type transformation. The resolved value replaces the current value and is passed to subsequent steps. The type parameter stays `T`.

```ts
// Normalize by loading the canonical form from a lookup service
const NormalizedCountry = is.string.refineAsync(async code => {
	return await lookupCanonicalCode(code.toUpperCase());
});

// Multiple refines compose in order
const guard = is.string.refineAsync(async v => v.trim()).refineAsync(async v => v.toLowerCase());

await guard.parseAsync('  HELLO  ');
// ok, value is 'hello'
```

---

## `.transformAsync(fn)`

Appends an async type-changing transformation. The return type of `fn` becomes the new `T` of the returned `AsyncGuard<U>`.

```ts
// Parse a raw JSON string into a typed object
const ParsedConfig = is.string.transformAsync(async raw => {
	const parsed = JSON.parse(raw);
	return parsed as Config;
});
// AsyncGuard<Config>

// Convert an integer ID to a full user record
const UserFromId = is.number.int.transformAsync(async id => {
	return await db.users.findById(id);
});
// AsyncGuard<User>
```

---

## Chaining steps in order

All three methods can be mixed freely. Steps execute in declaration order. Each step receives the value produced by the step before it.

```ts
const guard = is.string
	.refineAsync(async v => v.trim()) // step 1: normalize
	.whereAsync(async v => v.length > 0) // step 2: check trimmed result
	.transformAsync(async v => ({ raw: v })); // step 3: reshape

await guard.parseAsync('  hello  ');
// ok, value is { raw: 'hello' }

await guard.parseAsync('     ');
// err — step 2 rejects the empty trimmed string
```

---

## `.parseAsync(value, errMsg?)`

The only way to run an `AsyncGuard`. Returns a `ResultAsync<T, GuardErr>`.

```ts
const result = await guard.parseAsync(input);

if (result.ok) {
	console.log(result.value);
} else {
	console.error(result.error.message);
}
```

Pass a second argument to override the error message on failure:

```ts
const result = await guard.parseAsync(input, 'Username is already taken');
// result.error.message === 'Username is already taken' if it fails
```

### Execution order

1. The sync base guard runs first (`is.string.email`, etc.)
2. If the sync guard fails, all async steps are skipped and an error is returned immediately
3. Any sync transform on the base guard runs (e.g. from `.transform()` or `.trim()`)
4. Async steps execute in declaration order

```ts
const asyncFn = vi.fn(async () => true);
const guard = is.string.email.whereAsync(asyncFn);

await guard.parseAsync('not-an-email');
// asyncFn is never called — sync check short-circuits first
expect(asyncFn).not.toHaveBeenCalled();
```

---

## `ResultAsync` API

`.parseAsync()` returns a `ResultAsync<T, GuardErr>`, which is a promise-like with a full monadic API. You can chain operations without awaiting intermediate steps:

```ts
const value = await guard
	.parseAsync(input)
	.map(v => v.toUpperCase()) // transform ok value
	.andThen(v => anotherAsyncGuard.parseAsync(v)) // flatMap
	.match({
		ok: v => `got: ${v}`,
		err: e => `failed: ${e.message}`,
	});
```

`.unwrap()` resolves to the value on success and rejects on failure:

```ts
const user = await UserFromId.parseAsync(42).unwrap();
// throws GuardErr if invalid or async step fails
```

---

## Accessing `.meta`

`AsyncGuard` exposes the `.meta` of the underlying sync guard, which is useful for introspection and error reporting:

```ts
const guard = is.string.email.whereAsync(async () => true);
guard.meta.id; // 'string'
guard.meta.name; // 'string.email'
```

---

## Common patterns

### Database uniqueness check

```ts
const UniqueEmail = is.string.email.whereAsync(async email => {
	return !(await db.users.exists({ email }));
});

const result = await UniqueEmail.parseAsync(formData.email, 'Email already in use');
if (result.ok) {
	await db.users.create({ email: result.value });
}
```

### Fetch and validate an external resource

```ts
const ValidatedProfile = is.string.uuid().transformAsync(async id => {
	const res = await fetch(`/api/profiles/${id}`);
	if (!res.ok) throw new Error('Not found');
	return res.json() as Promise<Profile>;
});

await ValidatedProfile.parseAsync(id).match({
	ok: profile => renderProfile(profile),
	err: e => renderError(e.message),
});
```

### Normalize then re-validate

```ts
// Trim, lowercase, then check existence
const CanonicalTag = is.string
	.refineAsync(async v => v.trim().toLowerCase())
	.whereAsync(async tag => await db.tags.exists({ slug: tag }));

const result = await CanonicalTag.parseAsync(userInput);
```

### Composing with sync transforms

Sync transforms on the base guard are applied before any async step. This means you can use `.transform()` (or helpers like `.trim()`) to pre-process the value synchronously, then do the async work on the clean result:

```ts
const guard = is.string
	.transform(v => v.split(',')) // sync: string → string[]
	.whereAsync(async arr => {
		// arr is already string[] here
		return arr.every(tag => validTags.has(tag));
	});
```

---

## Summary

| Method                 | Effect                                            | Returns                     |
| ---------------------- | ------------------------------------------------- | --------------------------- |
| `.whereAsync(fn)`      | Async predicate; `false` fails the guard          | `AsyncGuard<T>` (same type) |
| `.refineAsync(fn)`     | Async same-type transform; replaces current value | `AsyncGuard<T>` (same type) |
| `.transformAsync(fn)`  | Async type-changing transform                     | `AsyncGuard<U>` (new type)  |
| `.parseAsync(v, msg?)` | Runs the full chain                               | `ResultAsync<T, GuardErr>`  |

Key behaviors to remember:

- Sync guard runs first; async steps are skipped entirely on sync failure
- Steps execute in declaration order; each step receives the value from the previous step
- `.parseAsync()` is the only output method -- there is no `.assert()` or predicate equivalent on `AsyncGuard`
