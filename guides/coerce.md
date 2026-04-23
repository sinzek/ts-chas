# Type Coercion: `.coerce`

Guards for the core coercible types -- `string`, `number`, `boolean`, `date`, `bigint`, `object`, `array`, and `result` -- expose a `.coerce` property that adds automatic type conversion before validation. When a value does not satisfy the guard's predicate, `.coerce` first converts it to the target type and then re-validates. If the value already passes without coercion, it is returned unchanged.

---

## Basic usage

```ts
import { is } from 'ts-chas/guard';

// Without coercion: fails
is.number.parse('42').isOk(); // false

// With coercion: parses '42' → 42, then validates
is.number.coerce.parse('42').unwrap(); // 42
```

`.coerce` slots naturally into the chain. Any helpers added after it constrain the coerced value:

```ts
is.number.coerce.gt(10).multipleOf(2).parse('12').unwrap(); // 12
is.number.coerce.gt(10).multipleOf(2).parse('8').isOk(); // false
```

---

## When coercion runs

Coercion takes effect in the operations that return or transform values:

- **`.parse(v)`** -- returns `Result<T, ChasErr>` after coercing and validating
- **`.assert(v)`** -- throws if invalid, returns the coerced value if valid
- **Standard Schema validation** -- used by integrations that call the Standard Schema interface

Coercion does NOT run in predicate (function-call) mode:

```ts
const guard = is.number.coerce;
guard('42'); // true  -- the "type lie"; see below
guard.parse('42').unwrap(); // 42   -- actual coercion happens here
```

---

## The type lie

When you call a `.coerce` guard as a plain predicate (`guard(v)`), it returns `true` if the value is coercible to the target type, but it does not actually perform the conversion. TypeScript's type narrowing therefore reflects the coerced type in narrowing position even though the runtime value is still the original.

This is an intentional design trade-off: predicates must be synchronous and allocation-free, while coercion sometimes allocates (new `Date`, `JSON.parse`, etc.). Use `.parse()` or `.assert()` whenever you need the converted value.

```ts
const guard = is.number.coerce;

// Predicate: reports feasibility only
if (guard('42')) {
	// TypeScript says this is `number`, but at runtime it is still '42'
	// If you need the number, use parse() instead
}

// Parse: performs the actual coercion
const result = guard.parse('42');
if (result.isOk()) {
	const n = result.unwrap(); // 42 as a number
}
```

---

## Coercion rules by type

### `is.string.coerce`

| Input type    | Result                                                |
| ------------- | ----------------------------------------------------- |
| `number`      | `String(n)` -- e.g. `123` → `'123'`                   |
| `boolean`     | `String(b)` -- `true` → `'true'`, `false` → `'false'` |
| `Date`        | `date.toISOString()`                                  |
| `null`        | `'null'`                                              |
| `undefined`   | `'undefined'`                                         |
| Anything else | `String(v)` (always succeeds)                         |

String coercion is total: any value can become a string, so `is.string.coerce` only fails when downstream helpers (`.min`, `.email`, etc.) reject the result.

```ts
const guard = is.string.coerce;
guard.parse(123).unwrap(); // '123'
guard.parse(true).unwrap(); // 'true'
guard.parse(new Date('2023-01-01T00:00:00Z')).unwrap(); // '2023-01-01T00:00:00.000Z'

is.string.coerce.trim().min(5).parse('  hello  ').unwrap(); // 'hello'
is.string.coerce.trim().min(5).parse(12345).unwrap(); // '12345'
```

---

### `is.number.coerce`

| Input type                             | Result                                      |
| -------------------------------------- | ------------------------------------------- |
| `string` (trimmable to a valid number) | `Number(trimmed)`                           |
| `string` (empty after trim)            | `0`                                         |
| `string` (not a number)                | passes original through (validation fails)  |
| `boolean`                              | `true` → `1`, `false` → `0`                 |
| `Date`                                 | `date.getTime()` (milliseconds since epoch) |
| `null` / `undefined`                   | passes original through (validation fails)  |

```ts
const guard = is.number.coerce;
guard.parse('42').unwrap(); // 42
guard.parse('12.3').unwrap(); // 12.3
guard.parse('').unwrap(); // 0
guard.parse(true).unwrap(); // 1
guard.parse(false).unwrap(); // 0

guard.parse('abc').isOk(); // false -- not a number, passes through, base guard rejects
guard.parse(null).isOk(); // false
```

---

### `is.boolean.coerce`

Boolean coercion uses an explicit list of recognized patterns rather than JavaScript's built-in truthiness, so strings like `'false'`, `'0'`, and `'no'` correctly become `false`.

| Input                                                         | Result                                     |
| ------------------------------------------------------------- | ------------------------------------------ |
| `'true'`, `'1'`, `'yes'`, `'on'`, `'active'`, `'enabled'`     | `true`                                     |
| `'false'`, `'0'`, `'no'`, `'off'`, `'inactive'`, `'disabled'` | `false`                                    |
| Number `1`                                                    | `true`                                     |
| Number `0`                                                    | `false`                                    |
| Any other string or number                                    | passes original through (validation fails) |
| Other types                                                   | passes original through (validation fails) |

Matching is case-insensitive and whitespace-trimmed.

```ts
const guard = is.boolean.coerce;
guard.parse('true').unwrap(); // true
guard.parse('false').unwrap(); // false
guard.parse('on').unwrap(); // true
guard.parse('off').unwrap(); // false
guard.parse(1).unwrap(); // true
guard.parse(0).unwrap(); // false

guard.parse('maybe').isOk(); // false -- not a recognized pattern
guard.parse('TRUE').unwrap(); // true  -- case-insensitive
```

---

### `is.date.coerce`

| Input type               | Result                                        |
| ------------------------ | --------------------------------------------- |
| ISO 8601 string          | `new Date(string)`                            |
| Numeric timestamp string | `new Date(string)` (milliseconds)             |
| `number`                 | `new Date(number)` (milliseconds since epoch) |
| Invalid string           | passes original through (validation fails)    |
| Other types              | passes original through (validation fails)    |

```ts
const guard = is.date.coerce;
const now = Date.now();
guard.parse(now).unwrap().getTime(); // now

guard.parse('2023-01-01').unwrap().toISOString(); // '2023-01-01T00:00:00.000Z'

// Chain with date helpers -- coercion happens first, then constraint checks
is.date.coerce.after(new Date('2020-01-01')).parse('2023-06-15').isOk(); // true
is.date.coerce.after(new Date('2020-01-01')).parse('2019-01-01').isOk(); // false
```

---

### `is.bigint.coerce`

| Input type                  | Result                                     |
| --------------------------- | ------------------------------------------ |
| Integer string              | `BigInt(string)`                           |
| Integer `number`            | `BigInt(number)`                           |
| Float string / float number | throws internally, passes original through |
| Other types                 | passes original through (validation fails) |

```ts
const guard = is.bigint.coerce;
guard.parse('123').unwrap(); // 123n
guard.parse(123).unwrap(); // 123n

guard.parse('12.5').isOk(); // false -- BigInt() rejects non-integers
guard.parse('abc').isOk(); // false
```

---

### `is.object(shape).coerce` and `is.array(guard).coerce`

Both object and array coercion parse JSON strings. The string must begin with `{` or `[` respectively after trimming; any other string is passed through unchanged.

```ts
// Object from JSON
is.object({ a: is.number }).coerce.parse('{"a": 123}').unwrap();
// { a: 123 }

// Array from JSON
is.array(is.number).coerce.parse('[1, 2, 3]').unwrap();
// [1, 2, 3]

// Invalid JSON string passes through, validation fails
is.object({ a: is.number }).coerce.parse('not json').isOk(); // false
```

---

### `is.result().coerce`

Result coercion revives a plain object (`{ ok: true, value: X }` or `{ ok: false, error: E }`) back into a fully-featured `Result` instance, restoring all methods (`.map`, `.mapErr`, `.unwrap`, `.unwrapErr`, etc.).

This is useful when a `Result` has been serialized to JSON and then deserialized: the round-trip strips the prototype methods, and `.coerce` restores them.

```ts
// Simulate a round-tripped Ok Result
const raw = { ok: true, value: 42 };
const guard = is.result(is.number, is.unknown).coerce;

const outer = guard.parse(raw);
// outer is Result<Result<number, unknown>, ChasErr>
const revived = outer.unwrap();
// revived is a Result<number, unknown> class instance with all methods
revived.isOk(); // true
revived.unwrap(); // 42
typeof revived.map; // 'function'

// Err Results work the same way
const rawErr = { ok: false, error: 'something went wrong' };
const guardErr = is.result(is.unknown, is.string).coerce;
const revivedErr = guardErr.parse(rawErr).unwrap();
revivedErr.isErr(); // true
revivedErr.unwrapErr(); // 'something went wrong'

// Non-objects fall back and fail validation
guard.parse('not an object').isOk(); // false
guard.parse(null).isOk(); // false
```

---

### `is.uint8Array.coerce`, `is.buffer.coerce`, `is.arrayBuffer.coerce`

Binary coercion converts **base64 strings** and **number arrays** into typed binary data. These cover the two most common wire formats: base64 (JSON payloads, JWTs, data URIs) and byte arrays (typed array serialization).

| Input                              | `uint8Array`              | `buffer`                           | `arrayBuffer`                   |
| ---------------------------------- | ------------------------- | ---------------------------------- | ------------------------------- |
| Base64 string                      | via `atob()` decode       | via `Buffer.from(str, 'base64')`   | via `atob()` → `.buffer`        |
| Data URI (`data:...;base64,...`)    | prefix stripped, then ↑   | prefix stripped, then ↑            | prefix stripped, then ↑         |
| `number[]`                         | `new Uint8Array(arr)`     | `Buffer.from(arr)`                 | `new Uint8Array(arr).buffer`    |
| `ArrayBuffer`                      | `new Uint8Array(buf)`     | `Buffer.from(new Uint8Array(buf))` | pass-through                    |
| `Uint8Array`                       | pass-through              | `Buffer.from(view)`                | `.buffer` extracted             |
| Other types                        | rejected                  | rejected                           | rejected                        |

```ts
const guard = is.uint8Array.coerce;

// Base64 string
guard.parse('SGVsbG8=').unwrap();
// Uint8Array [72, 101, 108, 108, 111]

// Data URI — prefix is stripped automatically
guard.parse('data:application/octet-stream;base64,SGVsbG8=').unwrap();
// Uint8Array [72, 101, 108, 108, 111]

// Number array
guard.parse([72, 101, 108, 108, 111]).unwrap();
// Uint8Array [72, 101, 108, 108, 111]

// Chain with size constraints
is.uint8Array.coerce.size(5).parse('SGVsbG8=').isOk();  // true — 5 bytes
is.uint8Array.coerce.size(5).parse(btoa('Hi')).isOk();  // false — 2 bytes

// Buffer (Node.js only)
is.buffer.coerce.parse('SGVsbG8=').unwrap().toString(); // 'Hello'

// ArrayBuffer
is.arrayBuffer.coerce.parse([72, 101]).unwrap(); // ArrayBuffer { byteLength: 2 }
```

<Warning>
**Encoding ambiguity.** Binary coercion assumes standard base64 encoding (RFC 4648). Base64url, hex, and other encodings are not detected automatically. If you need a different encoding, use `.transform()` with an explicit decoder instead:

```ts
const fromHex = is.string.transform(s => {
	const bytes = new Uint8Array(s.length / 2);
	for (let i = 0; i < s.length; i += 2) {
		bytes[i / 2] = parseInt(s.slice(i, i + 2), 16);
	}
	return bytes;
});
```
</Warning>

---

## Chaining: coerce position matters

`.coerce` should appear directly after the base guard (before any constraint helpers). Constraint helpers added after `.coerce` run against the coerced value:

```ts
// Correct: coerce first, then constrain
is.number.coerce.gt(0).lte(100).parse('42').unwrap(); // 42

// This also works: coerce and int together
is.number.int.coerce.parse('7').unwrap(); // 7
```

---

## Nested coercion

Coercion composes across nested guards. If an object's field guards also use `.coerce`, the inner coercions run after the outer coercion produces the object:

```ts
const guard = is.object({
	a: is.number.coerce,
}).coerce;

// Outer .coerce: string → { a: "123" }
// Inner .coerce: "123" → 123
guard.parse('{"a": "123"}').unwrap();
// { a: 123 }
```

---

## Failure semantics

If a value cannot be coerced, the coercer returns the original value and lets the base guard reject it normally. There are no special coercion errors: a failed coercion produces the same `Result<never, ChasErr>` as any other validation failure.

```ts
is.number.coerce.parse('abc').isOk(); // false
is.boolean.coerce.parse('maybe').isOk(); // false
is.date.coerce.parse({}).isOk(); // false
```

---

## Summary

| Type         | Converts from                                         |
| ------------ | ----------------------------------------------------- |
| `string`     | any value via `String()`, dates via `.toISOString()`  |
| `number`     | numeric strings, booleans, dates                      |
| `boolean`    | recognized truthy/falsy string patterns, `1`/`0`      |
| `date`       | ISO strings, timestamp numbers                        |
| `bigint`     | integer strings and integer numbers                   |
| `object`     | JSON strings starting with `{`                        |
| `array`      | JSON strings starting with `[`                        |
| `result`     | plain `{ ok, value/error }` objects (revives methods) |
| `uint8Array` | base64 strings, number arrays, ArrayBuffer            |
| `buffer`     | base64 strings, number arrays, ArrayBuffer, Uint8Array|
| `arrayBuffer`| base64 strings, number arrays, Uint8Array             |
