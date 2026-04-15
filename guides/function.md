# Function Guards: `is.function`

`is.function` creates a guard that validates function signatures at runtime. It checks that a value is a callable, and optionally validates both the arguments passed to it and the value it returns without any changes to the function's own source code.

The primary use case is wrapping an existing function with a validated shell using `.impl` (or one of its async/Result variants). The shell enforces the declared contract every time the function is called.

---

## Creating a function guard

```ts
import { is } from 'ts-chas/guard';

const guard = is.function({
	input: [is.number, is.number],
	output: is.number,
});
```

- **`input`** (required) -- an ordered tuple of guards, one per argument position.
- **`output`** (optional) -- a guard for the return value. Omit it to allow any return type.

The guard itself is a standard guard: calling it as a predicate (`guard(v)`) returns `true` if `v` is any function, and `false` otherwise. The input and output guards are not invoked during the predicate check.

```ts
guard(() => {}); // true
guard(42); // false
```

The inferred TypeScript type of the guard reflects the declared signature:

```ts
// typeof guard is Guard<(a: number, b: number) => number>
```

---

## `.impl` -- synchronous validated wrapper

`.impl` wraps a function so that every call validates arguments first and the return value second. If validation fails, an `AggregateGuardError` is thrown.

```ts
const add = guard.impl((a, b) => a + b);

add(2, 3); // 5
add(2, '3' as any); // throws AggregateGuardError: args[1]: Expected number
```

Error paths use `args[N]` for argument positions and `return` for the output:

```ts
const badAdd = guard.impl((_a, _b) => 'oops' as any);
badAdd(2, 3); // throws: return: Expected number
```

The wrapper is transparent: the return type, arity, and parameter names are preserved by TypeScript.

---

## `.implAsync` -- async validated wrapper

Use `.implAsync` when the function returns a `Promise`. Inputs are validated synchronously (before the function runs). The resolved value is validated after the promise settles.

```ts
const fetchUser = is
	.function({
		input: [is.string],
		output: is.object({ id: is.string, name: is.string }),
	})
	.implAsync(async id => {
		const res = await fetch(`/users/${id}`);
		return res.json();
	});

await fetchUser('u1'); // { id: 'u1', name: 'Alice' }
await fetchUser(42 as any); // throws AggregateGuardError: args[0]: Expected string
```

---

## `.implResult` and `.implResultAsync` -- non-throwing variants

If you prefer not to use exceptions for validation failures, use the Result-returning variants. They wrap the same logic but return `Result<T, AggregateGuardError>` instead of throwing.

```ts
const add = is
	.function({
		input: [is.number, is.number],
		output: is.number,
	})
	.implResult((a, b) => a + b);

const ok = add(2, 3);
ok.isOk(); // true
ok.unwrap(); // 5

const err = add(2, '3' as any);
err.isErr(); // true
err.unwrapErr().message; // '...: args[1]: Expected number'
```

The async equivalent returns `ResultAsync<T, AggregateGuardError>`:

```ts
const fetchUser = is
	.function({
		input: [is.string],
		output: is.string,
	})
	.implResultAsync(async id => `data for ${id}`);

const res = await fetchUser('abc');
res.isOk(); // true
res.unwrap(); // 'data for abc'

const bad = await fetchUser(123 as any);
bad.isErr(); // true
```

---

## Omitting `output`

When `output` is omitted, the return value is not validated and TypeScript infers its type from the implementation:

```ts
const logger = is.function({ input: [is.string] }).impl(msg => {
	console.log(msg);
});

logger('hello'); // ok
logger(42 as any); // throws: args[0]: Expected string
```

---

## Using complex guards for inputs and outputs

Any guard expression works, including objects, arrays, unions, and chained helpers:

```ts
const processInvoice = is
	.function({
		input: [
			is.object({
				id: is.string.uuid(),
				amount: is.number.positive,
				lines: is.array(
					is.object({
						description: is.string.min(1),
						quantity: is.number.int.gte(1),
					})
				).nonEmpty,
			}),
		],
		output: is.object({
			total: is.number.positive,
			tax: is.number.nonnegative,
		}),
	})
	.impl(invoice => {
		const total = invoice.lines.reduce((acc, l) => acc + l.quantity * invoice.amount, 0);
		return { total, tax: total * 0.1 };
	});
```

---

## Using `is.function` as a predicate

Because `is.function` produces a standard guard, it composes with all other guards. You can use it to validate that a field on an object is a function of a specific shape:

```ts
const handlerGuard = is.object({
	name: is.string,
	execute: is.function({ input: [is.string], output: is.boolean }),
});

handlerGuard({ name: 'ping', execute: (s: string) => s === 'ping' }); // true
handlerGuard({ name: 'ping', execute: 'not a function' }); // false
```

---

## Error shape: `AggregateGuardError`

Thrown by `.impl` and `.implAsync` when validation fails. It is an `Error` subclass with two extra properties:

| Property      | Type         | Description                     |
| ------------- | ------------ | ------------------------------- |
| `.errors`     | `GuardErr[]` | All collected validation errors |
| `.schemaName` | `string`     | The guard's inferred name       |

The `.message` property summarizes the first three errors inline. For structured error reporting you can iterate `.errors` directly:

```ts
import { AggregateGuardError } from 'ts-chas/guard';

try {
	add(2, '3' as any);
} catch (e) {
	if (e instanceof AggregateGuardError) {
		for (const err of e.errors) {
			console.log(err.path.join('.'), err.message);
			// 'args[1]'  'Expected number, got string'
		}
	}
}
```

---

## Summary

| Method                 | Returns                               | Throws on failure           |
| ---------------------- | ------------------------------------- | --------------------------- |
| `.impl(fn)`            | `ReturnType<fn>`                      | Yes (`AggregateGuardError`) |
| `.implAsync(fn)`       | `Promise<ReturnType<fn>>`             | Yes (rejected promise)      |
| `.implResult(fn)`      | `Result<T, AggregateGuardError>`      | No                          |
| `.implResultAsync(fn)` | `ResultAsync<T, AggregateGuardError>` | No                          |

All four variants:

1. Validate each argument against its position's guard before calling the function
2. Call the original function only if inputs pass
3. Validate the return value against `output` (if provided) before returning to the caller
