---
title: "Guard Overview"
description: "The is namespace, universal helpers, and how guards work."
---

Guards are chainable, immutable TypeScript type predicates. Every guard is callable as `(value: unknown) => value is T`, so it narrows types in `if` blocks. Each property access or method call returns a **new** guard — nothing is mutated.

```typescript
import { is } from 'ts-chas/guard';

// Direct type predicate — narrows in if blocks
const input: unknown = '  hello@example.com  ';
if (is.string.trim().email(input)) {
  input; // string
}

// .parse() for Result-based validation
const guard = is.string.trim().email.min(5).max(100);
const result = guard.parse(input);
if (result.isOk()) {
  console.log(result.value); // 'hello@example.com' (trimmed)
} else {
  console.log(result.error.message); // GuardErr
}

// .assert() throws if invalid, otherwise returns the typed value
const email = guard.assert(input); // string — throws GuardErr if invalid
```

---

## The `is` object

Import `is` from `ts-chas/guard`. It is the single entry point for all built-in guards.

```typescript
import { is } from 'ts-chas/guard';
```

Every member of `is` is itself a guard (or a factory that produces one). You chain helpers by accessing properties or calling methods directly on the guard:

```typescript
// Property access — no parentheses needed
const positiveInt = is.number.int.positive;

// Method call — takes arguments
const shortEmail = is.string.trim().email.max(50);

// Mixed chain
const apiKey = is.string.trim().min(32).max(64).regex(/^[A-Za-z0-9_-]+$/);
```

---

## How chaining works

Each step in a chain applies **left to right**. Transformers (like `.trim()`) mutate the value flowing through the chain, while validators (like `.email`) refine it.

```typescript
// Evaluation order for is.string.trim().toLowerCase().email
// 1. Validate: typeof value === 'string'
// 2. Transform: value = value.trim()
// 3. Transform: value = value.toLowerCase()
// 4. Validate: isEmail(value)

const guard = is.string.trim().toLowerCase().email;
guard.parse('  Contact@Example.COM  ');
// Ok('contact@example.com')
```

Every chain step returns a new, independent guard. Storing intermediate guards is safe:

```typescript
const base = is.string.trim().email;
const short = base.max(50);  // new guard
const long  = base.min(10);  // different new guard — base is unchanged
```

---

## Universal helpers

Every guard, regardless of type, exposes the following methods:

### `.parse(value)`

Validates `value` and returns `Result<T, GuardErr>`. If the guard has a transform pipeline (e.g., `.trim()`), the transformed value is returned on success.

```typescript
const result = is.number.int.positive.parse(42);
// Ok(42)

const result2 = is.number.int.positive.parse(-5);
// Err(GuardErr { message: 'Value -5 failed validation', ... })
```

### `.assert(value)`

Like `.parse()`, but throws a `GuardErr` on failure instead of returning an `Err`. Returns the typed value on success.

```typescript
const age = is.number.int.gte(18).assert(userAge);
// Throws GuardErr if userAge < 18 or is not a safe integer
```

### `.error(msg)` / `.error(fn)`

Overrides the default error message. Accepts a static string or a function receiving `{ meta, value }`.

```typescript
const guard = is.number.gte(18).error('Must be 18 or older');
guard.parse(15);
// Err(GuardErr { message: 'Must be 18 or older', ... })

const dynamic = is.string.min(3).error(({ value }) => `"${value}" is too short`);
dynamic.parse('hi');
// Err(GuardErr { message: '"hi" is too short', ... })
```

### `.nullable`

Widens the guard to also accept `null`. Returns `Guard<T | null>`.

```typescript
const guard = is.string.email.nullable;
guard(null);     // true — typed as string | null
guard('a@b.co'); // true
guard(undefined); // false
```

### `.optional`

Widens the guard to also accept `undefined`. Returns `Guard<T | undefined>`.

```typescript
const guard = is.number.int.optional;
guard(undefined); // true
guard(42);        // true
guard(null);      // false
```

### `.nullish`

Widens the guard to also accept `null` or `undefined`. Returns `Guard<T | null | undefined>`.

```typescript
const guard = is.string.nullish;
guard(null);      // true
guard(undefined); // true
guard('hello');   // true
```

### `.and(otherGuard)`

Logical AND: both guards must pass. The value is typed as `T & U`.

```typescript
const hasName = is.object({ name: is.string });
const hasAge  = is.object({ age: is.number });
const guard = hasName.and(hasAge);

guard({ name: 'Alice', age: 30 }); // true — typed as { name: string } & { age: number }
guard({ name: 'Alice' });          // false
```

### `.or(otherGuard)`

Logical OR: either guard can pass. The value is typed as `T | U`. Type-specific helpers are dropped on the result since the type is now a union.

```typescript
const guard = is.string.or(is.number);
guard('hello'); // true — typed as string | number
guard(42);      // true
guard(true);    // false
```

### `.where(predicate)`

Adds a custom inline validation rule. The predicate receives the (possibly transformed) value.

```typescript
const even = is.number.int.where(n => n % 2 === 0);
even.parse(4); // Ok(4)
even.parse(3); // Err(...)

const noSpaces = is.string.where(s => !s.includes(' '));
noSpaces.parse('hello'); // Ok('hello')
noSpaces.parse('hello world'); // Err(...)
```

### `.brand(tag)`

Adds a compile-time brand to the output type. Has no runtime effect — use it to distinguish semantically different values of the same primitive type.

```typescript
const UserId = is.string.uuid().brand('UserId');
type UserId = typeof UserId.$infer; // string & { readonly __brand: 'UserId' }

const id = UserId.assert('550e8400-e29b-41d4-a716-446655440000');
// id is typed as UserId — cannot be used where a plain string is expected without casting
```

### `.fallback(value)`

Sets a fallback value returned by `.parse()` and `.assert()` when validation fails, instead of producing an error. **Does not affect the boolean type predicate.**

```typescript
const guard = is.number.int.positive.fallback(1);
guard.parse('not a number'); // Ok(1)
guard.parse(-5);             // Ok(1)
if (guard('hello')) {
  // never reaches here — predicate still returns false
}
```

### `.transform(fn)`

Applies a type-changing transformation to the validated value. The guard still validates the original input; `.parse()` / `.assert()` return the transformed value. Drops type-specific helpers since the output type may differ.

```typescript
const toLength = is.string.transform(s => s.length);
toLength.parse('hello'); // Ok(5)

const parseNum = is.string.transform(s => Number(s)).where(n => !isNaN(n));
parseNum.parse('42'); // Ok(42)
```

### `.refine(fn)`

Like `.transform()`, but the output type stays `T` and type-specific helpers are preserved.

```typescript
const guard = is.string.refine(s => s.trim().toLowerCase()).email;
guard.parse('  ALICE@EXAMPLE.COM  '); // Ok('alice@example.com')
```

### `.not`

Inverts the guard. Passes when the original fails; typed as `Guard<unknown>`.

```typescript
const notString = is.string.not;
notString(42);      // true
notString('hello'); // false
```

### `.array`

Wraps the guard as an element guard for arrays. Equivalent to `is.array(thisGuard)`.

```typescript
const guard = is.string.email.array;
guard(['a@b.co', 'c@d.co']);  // true — typed as string[]
guard(['not-an-email']);      // false
```

### `.coerce`

Adds coercion support to the guard. When enabled, the guard attempts to cast "loose" inputs (like numeric strings or truthy values) into the target type before validation.

> Coercion happens during `.parse()`, `.assert()`, and Standard Schema validation.

```typescript
is.number.coerce.parse("123");       // Ok(123)
is.boolean.coerce.parse("true");     // Ok(true)
is.date.coerce.parse("2021-01-01");  // Ok(Date)
```

### `.arbitrary()`

Returns a Promise that resolves to a fast-check `Arbitrary<T>` for the guard. Requires `fast-check` to be installed (`npm install fast-check`). The arbitrary reflects all constraints accumulated through the helper chain.

```typescript
import * as fc from 'fast-check';
const arb = await is.object({ name: is.string.min(1), age: is.number.int.gte(0) }).arbitrary();
fc.assert(fc.property(arb, user => myFn(user) !== null));
```

### `.generate(n?)`

Generates `n` valid values that satisfy this guard (default: 1, returns a single value). Requires `fast-check` to be installed (`npm install fast-check`). Generated values are guaranteed to pass the guard's predicate.

```typescript
await is.string.email.generate()                // 'x@example.com'
await is.number.int.between(1,100).generate(5)  // [7, 42, 3, 88, 15]

// Pair with it.each for data-driven tests
const samples = await is.object({ name: is.string.min(1) }).generate(10);
it.each(samples)('processes %o', obj => expect(process(obj)).toBeTruthy());
```

### `.toJsonSchema()`

Serializes the guard to a JSON Schema Draft-07 compatible object. Captures constraints accumulated through the helper chain (min/max/email/etc.), recursively resolves object shapes and array element types, and handles nullable/optional variants.

> Best-effort: exotic guards (lazy, custom functions) fall back to `{}`.

```typescript
is.string.email.min(5).toJsonSchema()
// { type: 'string', format: 'email', minLength: 5 }

is.object({ name: is.string, age: is.number.int.gte(0).optional }).toJsonSchema()
// { type: 'object', properties: { name: { type: 'string' }, age: { type: 'integer', minimum: 0 } }, required: ['name'] }

is.array(is.string.email).toJsonSchema()
// { type: 'array', items: { type: 'string', format: 'email' } }
```

### `.whereAsync(predicate)`

Appends an async predicate check, switching to async mode. The returned `AsyncGuard<T>` has `.parseAsync()` returning a `ResultAsync<T, GuardErr>` with the full monadic API.

```typescript
const UniqueEmail = is.string.email.whereAsync(async v => {
	return !(await db.users.exists({ email: v }));
});
UniqueEmail.parseAsync(input).match({ ok: v => v, err: e => e.message });
```

### `.refineAsync(fn)`

Appends an async same-type transformation, switching to async mode. The resolved value replaces the current value and is passed to subsequent steps.

### `.transformAsync(fn)`

Appends an async type-changing transformation, switching to async mode.

```typescript
const Parsed = is.string.transformAsync(async raw => JSON.parse(raw) as User);
// AsyncGuard<User>
```

---

## Type coercion

`.coerce` is available on guards for the core coercible types: `string`, `number`, `boolean`, `date`, `bigint`, `object`, `array`, and `result`. It adds an automatic conversion step that runs before validation whenever `.parse()`, `.assert()`, or Standard Schema validation is called.

If the value already satisfies the guard without coercion, it passes through unchanged. If coercion produces a value that still fails the guard, the result is an ordinary validation error.

```typescript
// string
is.string.coerce.parse(42).unwrap();             // '42'
is.string.coerce.parse(new Date('2023-01-01')).unwrap(); // '2023-01-01T00:00:00.000Z'

// number
is.number.coerce.parse('42').unwrap();   // 42
is.number.coerce.parse(true).unwrap();   // 1
is.number.coerce.parse('').unwrap();     // 0

// boolean — uses explicit truthy/falsy patterns, not JavaScript truthiness
is.boolean.coerce.parse('true').unwrap();  // true
is.boolean.coerce.parse('false').unwrap(); // false — correctly false, unlike Boolean('false')
is.boolean.coerce.parse('on').unwrap();    // true
is.boolean.coerce.parse(1).unwrap();       // true

// date
is.date.coerce.parse('2023-06-15').unwrap();  // Date object
is.date.coerce.parse(1687824000000).unwrap(); // Date object

// bigint
is.bigint.coerce.parse('123').unwrap(); // 123n
is.bigint.coerce.parse(123).unwrap();   // 123n

// object / array — JSON.parse on strings that start with { or [
is.object({ a: is.number }).coerce.parse('{"a": 1}').unwrap(); // { a: 1 }
is.array(is.number).coerce.parse('[1, 2, 3]').unwrap();        // [1, 2, 3]
```

Constraint helpers chained after `.coerce` run against the coerced value:

```typescript
is.number.coerce.gt(10).multipleOf(2).parse('12').unwrap(); // 12
is.number.coerce.gt(10).multipleOf(2).parse('8').isOk();    // false
```

Coercion does not run in predicate mode (`guard(v)`). Calling a `.coerce` guard as a plain predicate returns `true` if the value is coercible -- but the runtime value is not converted. Use `.parse()` or `.assert()` to get the transformed value.

Nested guards compose naturally: if an object's fields also use `.coerce`, inner coercions run after the outer one resolves the object:

```typescript
is.object({ n: is.number.coerce }).coerce.parse('{"n": "42"}').unwrap();
// { n: 42 } — outer coerce: string → object, inner coerce: string → number
```

For the full coercion rules per type, see the [coerce guide](./coerce.md).

---

## Test data generation

`.generate()` and `.arbitrary()` let you produce valid test data from the same guard that validates it. No separate factory functions or schemas to maintain.

Both require [`fast-check`](https://fast-check.dev) as a peer dependency:

```sh
npm install --save-dev fast-check
```

### `.generate(n?)`

Returns a single valid value (`Promise<T>`) or an array of `n` valid values (`Promise<T[]>`). Every generated value is guaranteed to pass the guard's predicate.

```typescript
await is.string.email.generate()                     // 'a@b.com'
await is.number.int.between(1, 100).generate(5)      // [7, 42, 3, 88, 15]
await is.boolean.generate()                          // true
await is.object({ name: is.string.min(1), age: is.number.int.gte(0) }).generate()
// { name: 'abc', age: 7 }
```

A common testing pattern is generating a batch with `.generate(n)` and feeding it to `it.each`:

```typescript
const users = await is.object({
  name:  is.string.min(1).max(50),
  email: is.string.email,
  age:   is.number.int.between(18, 120),
}).generate(20);

it.each(users)('processes user %o', user => {
  expect(processUser(user)).not.toThrow();
});
```

### `.arbitrary()`

Returns a `Promise<Arbitrary<T>>` -- a fully configured fast-check `Arbitrary`. Use it for property-based tests with `fc.assert` and `fc.property`, or compose it with `.map()`, `.filter()`, and `.chain()`:

```typescript
import * as fc from 'fast-check';

const emailArb = await is.string.email.arbitrary();

fc.assert(
  fc.property(emailArb, email => {
    const result = parseEmail(email);
    return result.domain.length > 0;
  })
);

// Compose multiple arbitraries
const nameArb  = await is.string.min(1).max(50).arbitrary();
const ageArb   = await is.number.int.between(18, 120).arbitrary();

fc.assert(
  fc.property(nameArb, emailArb, ageArb, (name, email, age) => {
    const user = createUser({ name, email, age });
    return is.string.email(user.email);
  })
);
```

The generator reads from the guard's accumulated constraint metadata, so chained helpers are reflected automatically: `is.number.int.positive.lte(100)` produces integers in `[1, 100]`. Guards that cannot be mapped to a specific arbitrary fall back to `fc.anything()`. For the full constraint coverage reference, see the [generate and arbitrary guide](./generate-and-arbitrary.md).

---

## Async validation

When a validation step requires I/O, use `.whereAsync()`, `.refineAsync()`, or `.transformAsync()` to switch a guard into async mode. These return an `AsyncGuard<T>`, which is not a `Guard` -- it does not have `.parse()` or the helper chain. Its only output is `.parseAsync()`.

### Entering async mode

Any of the three methods can start the async chain. Sync helpers added to the base guard before the async call run first:

```typescript
// Sync validation (email format) runs before the async database check
const UniqueEmail = is.string.email.whereAsync(async email => {
  return !(await db.users.exists({ email }));
});
```

### `.whereAsync(fn)` -- async predicate

Resolving `false` fails validation. Subsequent steps are not called if a predicate fails.

```typescript
const UniqueUsername = is.string.min(3).whereAsync(async name => {
  return !(await db.users.exists({ username: name }));
});
```

### `.refineAsync(fn)` -- async same-type transform

The resolved value replaces the current value. The type stays `T`.

```typescript
const Normalized = is.string.refineAsync(async code => {
  return await lookupCanonicalCode(code.toUpperCase());
});
```

### `.transformAsync(fn)` -- async type-changing transform

The return type of `fn` becomes the new type of the `AsyncGuard<U>`.

```typescript
const UserFromId = is.number.int.transformAsync(async id => {
  return await db.users.findById(id);
});
// AsyncGuard<User>
```

### `.parseAsync(value, errMsg?)`

Runs the full chain and returns `ResultAsync<T, GuardErr>`. The sync guard runs first; async steps are skipped entirely on sync failure.

```typescript
const result = await UniqueEmail.parseAsync(formData.email, 'Email already in use');

if (result.ok) {
  await db.users.create({ email: result.value });
} else {
  console.error(result.error.message);
}
```

`ResultAsync` exposes the full monadic API (`.map()`, `.andThen()`, `.match()`, `.unwrap()`):

```typescript
const value = await guard
  .parseAsync(input)
  .map(v => v.toUpperCase())
  .andThen(v => anotherGuard.parseAsync(v))
  .match({
    ok:  v => `got: ${v}`,
    err: e => `failed: ${e.message}`,
  });
```

Steps chain in declaration order and each step receives the value produced by the previous one. For a full reference, see the [async guard guide](./async-guard.md).

---

## Standard Schema (`~standard`)

Every guard implements the [Standard Schema v1](https://github.com/standard-schema/standard-schema) specification via the `~standard` property. This makes guards compatible with tRPC, react-hook-form, Drizzle, and any other library that consumes the spec — no adapter needed.

```typescript
import { is } from 'ts-chas/guard';

// Directly usable anywhere Standard Schema v1 is accepted
const emailGuard = is.string.trim().email;
emailGuard['~standard'].validate('hello@example.com');
// { value: 'hello@example.com' }

emailGuard['~standard'].validate('not-an-email');
// { issues: [{ message: '...', path: [...] }] }
```

---

## Extending the `is` namespace

Use `is.extend({ ... })` to add custom guards to a new `is` instance. The base guards remain available on the returned object.

```typescript
import { is } from 'ts-chas/guard';

const myIs = is.extend({
  email:   is.string.trim().email.max(255),
  posInt:  is.number.int.positive,
  slug:    is.string.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

myIs.email('hello@example.com'); // true
myIs.posInt(42);                  // true
myIs.slug('my-post-title');       // true
myIs.string('still works');       // true — base guards preserved
```

You can pass any value (not just guards) to `extend` — it performs a shallow merge with `baseIs`.

---

## Type utilities

### `InferGuard<T>`

Extracts the validated type from a guard.

```typescript
import type { InferGuard } from 'ts-chas/guard';

const UserGuard = is.object({ name: is.string, age: is.number });
type User = InferGuard<typeof UserGuard>;
// { name: string; age: number }

type Email = InferGuard<typeof is.string.email>;
// string
```

Another easy way to infer the type of a guard is by using its `.$infer` property:

```typescript
const UserGuard = is.object({ name: is.string, age: is.number });
type User = typeof UserGuard.$infer;
```

### `Guard<T, H>`

The guard interface itself. `T` is the validated type; `H` is the type-specific helpers object.

```typescript
import type { Guard } from 'ts-chas/guard';

function validateAndLog<T>(guard: Guard<T>, value: unknown): T | null {
  const result = guard.parse(value);
  if (result.isOk()) return result.value;
  console.error(result.error.message);
  return null;
}
```

### `GuardErr`

The error type returned by `.parse()` on failure.

```typescript
import type { GuardErr } from 'ts-chas/guard';

const result = is.string.email.parse(123);
if (result.isErr()) {
  const e: GuardErr = result.error;
  e.message;  // 'Expected string, but got number (123)'
  e.expected; // 'string'
  e.actual;   // 'number'
  e.name;     // 'string.email'
  e.path;     // []
}
```
