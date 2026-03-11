# chas

`chas` brings functional/monadic error handling to your TypeScript projects, inspired by Rust's `Result` type. It handles both synchronous and asynchronous operations cleanly without throwing exceptions.

## Installation

```bash
npm install chas
# or
yarn add chas
# or
pnpm add chas
```

## Why use a Result type?

Instead of relying on `try...catch` blocks and throwing errors which are implicitly typed as `unknown` or `any`, this pattern allows you to define explicit error types. This forces callers to handle errors at compile-time, explicitly avoiding unhandled exceptions.

## Monadic Error Handling

There are three main reasons for using monads for error handling:

- In most programming languages, there is no way to type hint the exceptions a method can throw.
- Errors are not the same as exceptions: a validation error should not be thrown since it is part of our domain, and not an exceptional behaviour. Treat errors as values, not exceptions.
- Throwing exceptions impacts performance.

[Source](https://www.sverdejot.dev/blog/monadic-error-handling/)

## Basic Usage

```ts
import { chas } from 'chas';

// Defining a function that returns a Result
function divide(a: number, b: number): chas.Result<number, string> {
	if (b === 0) {
		return chas.err('Cannot divide by zero');
	}
	return chas.ok(a / b);
}

// Handling the Result
const result = divide(10, 2);

// Checking the status
if (result.isOk()) {
	console.log('Result is', result.value); // TypeScript knows `value` is `number`
} else {
	console.error('Failed:', result.error); // TypeScript knows `error` is `string`
}

// Or using functional methods
const doubled = result.map(v => v * 2).unwrapOr(0);
```

## Asynchronous Usage (`ResultAsync`)

`chas` provides support for asynchronous operations using `ResultAsync`.
It can be awaited directly, unwrapping into `Result<T, E>`.

```ts
import { chas } from 'chas';

async function fetchUser(id: number): Promise<chas.Result<User, Error>> {
	const resultAsync = chas.fromPromise(
		fetch(`/api/users/${id}`).then(res => res.json()),
		e => new Error(`API failed: ${String(e)}`)
	);

	// You can chain async operations
	const finalAsync = resultAsync.andThen(user => saveToDbAsync(user));

	// Await the ResultAsync to get the inner synchronous Result<T, E>
	const finalResult = await finalAsync;

	return finalResult;
}
```

## API Reference

### Types

- `Result<T, E>`: Union of `Ok<T, E>` and `Err<T, E>`.
- `Ok<T>`: Contains `ok: true` and the `value: T`.
- `Err<E>`: Contains `ok: false` and the `error: E`.

### Creating Results

- `chas.ok(value)`: Creates an `Ok` result.
- `chas.err(error)`: Creates an `Err` result.
- `chas.okAsync(value)`: Creates a `ResultAsync` resolving to `Ok`.
- `chas.errAsync(error)`: Creates a `ResultAsync` resolving to `Err`.

### Utility Wrappers

- `chas.tryCatch(fn, onThrow)`: Executes a synchronous function that may throw and returns a `Result`.
- `chas.fromPromise(promise, onRejected)`: Evaluates a Promise and returns a `ResultAsync`.
- `chas.withResult(fn, onThrow)`: Wraps a synchronous function to return a `Result` instead of throwing.
- `chas.withResultAsync(fn, onThrow)`: Wraps an async function to return a `ResultAsync`.

### Working with Multiple Results

- `chas.all(iterable)`: Takes an iterable of `Result`s. Returns an `Ok` of an array of all values if strictly all are `Ok`, otherwise short-circuits returning the first `Err`.
- `chas.allAsync(iterable)`: Takes an iterable of `ResultAsync`s or Promises of Results. Resolves to an array of values if all are `Ok`, or the first resolved `Err`.
- `chas.partition(iterable)`: Evaluates an iterable of `Result`s and separates them into an object `{ oks: T[], errs: E[] }`.
- `chas.partitionAsync(iterable)`: Awaits an iterable of `Result` promises and partitions them.

### Methods on `Result<T, E>`

All `Result` objects have the following methods available:

#### Querying

- `isOk()`: Returns `true` if `Ok`.
- `isErr()`: Returns `true` if `Err`.
- `isOkAnd(predicate)`: Returns `true` if `Ok` and the value satisfies the predicate.
- `isErrAnd(predicate)`: Returns `true` if `Err` and the error satisfies the predicate.

#### Mapping

- `map(f)`: Applies `f` to the contained value if `Ok`.
- `mapErr(f)`: Applies `f` to the contained error if `Err`.
- `mapOr(defaultValue, f)`: Applies `f` if `Ok`, or returns `defaultValue` if `Err`.
- `mapOrElse(fallbackFn, f)`: Applies `f` if `Ok`, or computes a fallback by executing `fallbackFn(error)`.

#### Chaining

- `and(other)`: Returns `other` if `this` is `Ok`, otherwise returns `this`.
- `or(other)`: Returns `this` if `Ok`, otherwise returns `other`.
- `andThen(f)`: Calls `f(value)` if `Ok`, returning a new `Result`.
- `orElse(f)`: Calls `f(error)` if `Err`, returning a new `Result`.

#### Unwrapping

- `unwrap()`: Returns the contained value if `Ok`, or throws the contained error if `Err`.
- `unwrapErr()`: Returns the contained error if `Err`, or throws an error if `Ok`.
- `unwrapOr(defaultValue)`: Returns the contained value or a default.
- `unwrapOrElse(f)`: Returns the contained value or computes a fallback from the error.
- `unwrapOrNull()`: Returns the value or `null`.
- `unwrapOrUndefined()`: Returns the value or `undefined`.
- `expect(message)`: Unwraps the value, or throws an error with the given message if `Err`.
- `expectErr(message)`: Unwraps the error, or throws an error with the given message if `Ok`.

#### Side Effects & Matching

- `match({ ok: f, err: g })`: Evaluates the `ok` branch if `Ok`, or the `err` branch if `Err`, mapping straight to a union type.
- `inspect(f)`: Calls `f` with the contained value if `Ok`, and returns the `Result` unmodified.
- `inspectErr(f)`: Calls `f` with the contained error if `Err`, and returns the `Result` unmodified.
