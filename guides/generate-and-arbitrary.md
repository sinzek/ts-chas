# Test Data Generation: `.generate()` and `.arbitrary()`

Every guard in `ts-chas` exposes two async methods for producing valid test data: `.generate()` for quick sampling and `.arbitrary()` for deep integration with [fast-check](https://fast-check.dev). Both are derived directly from the guard's constraint chain, so the same guard that validates your data also drives its generation. No separate schemas or factory functions to maintain.

`fast-check` is a peer dependency and must be installed separately:

```sh
npm install --save-dev fast-check
# or
pnpm add -D fast-check
```

---

## `.generate()`

```ts
// Single value
const value = await guard.generate();

// Multiple values
const values = await guard.generate(n);
```

Returns a `Promise<T>` when called with no argument, or `Promise<T[]>` when called with a count. Generated values are guaranteed to pass the guard's predicate.

### Quick examples

```ts
// Primitives
await is.string.generate()                        // 'hello'
await is.number.int.gte(0).lte(100).generate()   // 42
await is.boolean.generate()                       // true
await is.bigint.positive.generate()               // 1000n

// Multiple values
await is.string.email.generate(5)
// ['a@b.com', 'x@y.net', ...]

// Objects
await is.object({ name: is.string.min(1), age: is.number.int.gte(0) }).generate()
// { name: 'abc', age: 7 }

// Arrays
await is.array(is.number.positive).nonEmpty.generate(3)
// [[1.2, 5], [0.3], [9, 0.1, 4]]
```

### Data-driven tests with `it.each`

A common pattern is to generate a batch of valid inputs and feed them to parameterized tests:

```ts
const users = await is.object({
  name: is.string.min(1).max(50),
  email: is.string.email,
  age:   is.number.int.between(18, 120),
}).generate(20);

it.each(users)('processes user %o', user => {
  expect(processUser(user)).not.toThrow();
});
```

---

## `.arbitrary()`

```ts
const arb = await guard.arbitrary();
```

Returns a `Promise<Arbitrary<T>>` -- a fully configured fast-check `Arbitrary` that you can compose, transform, and use directly in `fc.assert` property tests.

### Property-based testing

```ts
import * as fc from 'fast-check';

const emailGuard = is.string.email;
const arb = await emailGuard.arbitrary();

fc.assert(
  fc.property(arb, email => {
    const result = parseEmail(email);
    return result.domain.length > 0;
  })
);
```

### Composing arbitraries

Because `.arbitrary()` returns a standard fast-check `Arbitrary`, you can use `.map()`, `.filter()`, and `.chain()` on it:

```ts
const idArb = await is.string.uuid().arbitrary();

// Map: derive a related shape from the valid input
const userArb = idArb.map(id => ({ id, createdAt: new Date() }));

// Filter: post-hoc narrowing (prefer guard constraints where possible)
const evenArb = (await is.number.int.arbitrary()).filter(n => n % 2 === 0);

// Chain: dependent generation
const arrayArb = await is.array(is.string.min(1)).nonEmpty.arbitrary();
const firstElementArb = arrayArb.chain(arr => fc.constant(arr[0]));
```

### Combining multiple guards

```ts
const nameArb  = await is.string.min(1).max(50).arbitrary();
const emailArb = await is.string.email.arbitrary();
const ageArb   = await is.number.int.between(18, 120).arbitrary();

fc.assert(
  fc.property(nameArb, emailArb, ageArb, (name, email, age) => {
    const user = createUser({ name, email, age });
    return is.string.email(user.email);
  })
);
```

---

## Constraint coverage

The generator reads constraints from the guard's accumulated metadata and translates them to tight arbitraries. What follows is a full reference for every supported helper.

### Strings

| Helper | Generated values |
|---|---|
| `.email` | `user@domain.tld` format |
| `.url` | WHATWG-valid URL strings |
| `.uuid()` | UUID v4 by default |
| `.hostname` | RFC 1123 hostnames (`foo.example.com`) |
| `.ipv4` | Dotted-quad IPv4 addresses |
| `.ipv6` | Normalized IPv6 addresses |
| `.cidrv4` | IPv4 CIDR blocks (`10.0.0.0/8`) |
| `.cidrv6` | IPv6 CIDR blocks (normalized via URL parser) |
| `.mac()` | MAC addresses; delimiter respected |
| `.ulid` | 26-character Crockford Base32 ULIDs |
| `.cuid` | `c` + 24 alphanumeric characters |
| `.cuid2` | Lowercase alphanumeric starting with a letter |
| `.nanoid()` | NanoID using correct alphabet; length respected |
| `.base64()` | Base64-encoded byte arrays |
| `.hex()` | Hex strings; `case`, `prefix`, and `evenLength` respected |
| `.hash()` | Correct byte-length output for each algorithm and encoding |
| `.jwt()` | Structurally valid three-part JWT strings |
| `.emoji` | Strings containing at least one emoji |
| `.boolStr` | One of: `'true'`, `'false'`, `'1'`, `'0'`, `'yes'`, `'no'`, `'on'`, `'off'` |
| `.json()` | Valid JSON strings |
| `.iso` | Full ISO 8601 datetime strings |
| `.iso.date` | `YYYY-MM-DD` strings |
| `.iso.datetime()` | Full datetime; `offset`, `local`, and `precision` respected |
| `.min(n)` | Strings of at least `n` characters |
| `.max(n)` | Strings of at most `n` characters |
| `.length(n)` | Strings of exactly `n` characters |
| `.regex(re)` | Strings matching the regex (via `fc.stringMatching`) |
| `.includes(sub)` | Strings containing the substring |
| `.startsWith(pfx)` | Strings with the given prefix |
| `.endsWith(sfx)` | Strings with the given suffix |

### Numbers

| Helper | Generated values |
|---|---|
| `.int` | Safe integers |
| `.int32` | Integers in `[-2147483648, 2147483647]` |
| `.positive` | Numbers strictly greater than 0 |
| `.nonnegative` | Numbers `>= 0` |
| `.negative` | Numbers strictly less than 0 |
| `.nonpositive` | Numbers `<= 0` |
| `.gt(n)` / `.gte(n)` | Numbers above the bound |
| `.lt(n)` / `.lte(n)` | Numbers below the bound |
| `.between(min, max)` | Numbers within the range |
| `.port` | Integers in `[0, 65535]` |
| `.unit` | Floats in `[0, 1]` |
| `.multipleOf(n)` | Multiples of `n` |
| `.even` | Even integers (via `multipleOf: 2`) |
| `.odd` | Odd integers |
| `.digits(n)` | Integers with exactly `n` digits |
| `.precision(n)` | Numbers with at most `n` decimal places |

### BigInts

BigInt has no native JSON Schema representation, so constraints are stored as internal markers.

| Helper | Generated values |
|---|---|
| `.positive` | BigInts `> 0n` |
| `.nonnegative` | BigInts `>= 0n` |
| `.negative` | BigInts `< 0n` |
| `.nonpositive` | BigInts `<= 0n` |
| `.gt(n)` / `.gte(n)` | BigInts above the bound |
| `.lt(n)` / `.lte(n)` | BigInts below the bound |
| `.between(min, max)` | BigInts within the range |
| `.even` | Even bigints |
| `.odd` | Odd bigints |
| `.multipleOf(n)` | Multiples of `n` |
| `.digits(n)` | BigInts with exactly `n` digits |
| `.int32` | BigInts in the 32-bit signed integer range |
| `.int64` | BigInts in the 64-bit signed integer range |

### Booleans

| Helper | Generated values |
|---|---|
| `.true` | Always `true` |
| `.false` | Always `false` |
| `.asString` | Always `'true'` or `'false'` |

### Dates

| Helper | Generated values |
|---|---|
| `.after(d)` | Dates strictly after `d` |
| `.before(d)` | Dates strictly before `d` |
| `.between(min, max)` | Dates within the range |
| `.future` | Dates after `Date.now()` at generation time |
| `.past` | Dates before `Date.now()` at generation time |
| `.year(n)` | Dates within the given calendar year |
| `.weekend` | Saturdays and Sundays |
| `.weekday` | Monday through Friday |
| `.day('monday')` | The specific day of the week |
| `.month(n)` | The specific month (0-indexed) |
| `.dayOfMonth(n)` | The specific day of the month |
| `.hour(n)` | Dates with the specific hour |
| `.minute(n)` | Dates with the specific minute |
| `.second(n)` | Dates with the specific second |
| `.millisecond(n)` | Dates with the specific millisecond |

Dates are always generated within the year range 1000-9000 by default, so `.toISOString()` never throws.

### URLs

`is.url()` returns a URL guard (not a string guard). Constraints from URL helpers are reflected in generation:

| Helper | Generated values |
|---|---|
| (base `is.url()`) | Valid `http://` or `https://` URLs |
| `.http` | `http://` URLs with real domain hostnames |
| `.https` / `.secure` | `https://` URLs with real domain hostnames |
| `.local` | `http://localhost:PORT` URLs |
| `.port(n)` | URLs with the specified port |
| `.hasSearch` | URLs with a query string |
| `.hasHash` | URLs with a hash fragment |

### Arrays

| Helper | Generated values |
|---|---|
| `.nonEmpty` | Arrays with at least one element |
| `.empty` | Zero-element arrays |
| `.min(n)` | Arrays with at least `n` elements |
| `.max(n)` | Arrays with at most `n` elements |
| `.size(n)` | Arrays with exactly `n` elements |
| `.unique` | Arrays with no duplicate elements (uses `fc.uniqueArray`) |
| `.includes(item)` | Arrays that always contain `item` as the first element |

### Tuples

Fixed-position tuples generate the correct type at each index:

```ts
const guard = is.tuple([is.string, is.number, is.boolean]);
await guard.generate()
// ['hello', 42, true]
```

Variadic tuples append rest elements after the fixed positions:

```ts
const guard = is.tuple([is.string], is.number);
await guard.generate()
// ['hello', 1, 5, 2]
```

### Objects

Shaped objects generate a value for every key in the schema. Optional and nullable fields are handled automatically:

```ts
const guard = is.object({
  id:    is.string.uuid(),
  name:  is.string.min(1),
  score: is.number.nonnegative.optional,
  tag:   is.string.nullable,
});
await guard.generate()
// { id: 'a1b2...', name: 'x', score: undefined, tag: null }
```

| Helper | Effect on generation |
|---|---|
| `.minSize(n)` | Object has at least `n` keys (shapeless objects only) |
| `.maxSize(n)` | Object has at most `n` keys (shapeless objects only) |
| `.size(n)` | Object has exactly `n` keys (shapeless objects only) |

### Records

`is.record(keyGuard, valueGuard)` generates plain objects whose keys satisfy `keyGuard` and whose values satisfy `valueGuard`:

```ts
const guard = is.record(is.string, is.number);
await guard.generate()
// { foo: 1.2, bar: -3 }
```

When the key guard has a finite value set (literals or enums), those exact keys are used.

### Maps and Sets

```ts
await is.map(is.string, is.number).generate()
// Map { 'key' => 1 }

await is.set(is.number).minSize(2).generate()
// Set { 4, 9 }
```

Sets use `fc.uniqueArray` internally so size constraints are always satisfied even after deduplication.

### Unions, intersections, and discriminated unions

```ts
// Union: values from either branch
await is.union(is.string, is.number).generate(10)
// mix of strings and numbers

// Discriminated union: correct discriminant on every value
const shape = is.discriminatedUnion('kind', {
  circle: is.object({ radius: is.number.positive }),
  square: is.object({ side: is.number.positive }),
});
await shape.generate()
// { kind: 'circle', radius: 3.5 }
```

Intersections generate from the first branch (exact intersection generation is not tractable in the general case).

---

## Fallback behavior

Guards that cannot be mapped to a specific arbitrary fall back to `fc.anything()`. This covers custom guards created with `.where()`, `.and()`, lazy guards, and any other guard whose structure is opaque to the generator. These will produce values that may or may not pass the guard; use `.arbitrary()` and add a `.filter(guard)` step if you need guaranteed correctness for custom predicates:

```ts
const myGuard = is.number.where(n => someComplexCheck(n));
const arb = (await myGuard.arbitrary()).filter(myGuard);
```

---

## Combining with property-based testing

`.arbitrary()` slots directly into `fc.property` for full property-based test suites:

```ts
import * as fc from 'fast-check';
import { is } from 'ts-chas/guard';

const invoiceArb = await is.object({
  id:       is.string.uuid(),
  amount:   is.number.positive,
  currency: is.literal('USD', 'EUR', 'GBP'),
  lines:    is.array(is.object({
    description: is.string.min(1),
    quantity:    is.number.int.gte(1),
    unitPrice:   is.number.positive,
  })).nonEmpty,
}).arbitrary();

fc.assert(
  fc.property(invoiceArb, invoice => {
    const total = computeTotal(invoice);
    return total > 0 && is.number.positive(total);
  }),
  { numRuns: 200 }
);
```

---

## Implementation notes

- `fast-check` is loaded lazily on the first call to `.generate()` or `.arbitrary()`. If it is not installed, a clear error is thrown with installation instructions.
- The generator reads from `guard.meta.jsonSchema`, the same accumulated metadata object that drives `.toJsonSchema()`. Adding a constraint to a guard automatically affects both JSON Schema output and data generation.
- Constraint chaining composes correctly: `is.number.int.positive.lte(100)` generates integers in `[1, 100]` because each helper merges its contribution into the shared metadata object.
- Dates are clamped to the year range 1000-9000 by default to prevent `toISOString()` from throwing on extreme values. Explicit `.after()` or `.before()` bounds override the defaults.
