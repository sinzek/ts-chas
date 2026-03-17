# chas

`chas` is a production-grade functional error handling library for TypeScript, inspired by Rust's `Result` and `fp-ts`. It provides a robust alternative to `try/catch` by treating errors as values, enabling explicit, type-safe error handling for both synchronous and asynchronous workflows.

## Overview

`chas` combines the power of the `Result` monad with a modern **Tagged Error system**. This allows you to define rich, discriminated error unions that are real `Error` instances at runtime, complete with stack traces and exhaustive pattern matching.

- **Unified Async Control**: Full support for `ResultAsync` and concurrency utilities like `allAsync` and `shapeAsync` to coordinate complex parallel operations.
    ```ts
    const data = await chas.shapeAsync({
    	user: fetchUser(),
    	config: fetchConfig(),
    }); // Returns Ok({ user, config }) or the first Err
    ```
- **Tagged Error System**: Define typed error unions with `chas.errors()` and handle them safely with `matchError()` or `catchTag()`. These errors are native `Error` instances, ensuring compatibility with standard logging and monitoring tools.
- **Resilient Patterns**: Built-in support for retry, delay, and timeouts via `withRetryAsync` out of the box.
- To enable more ergonomic chaining, it provides a generator-based do-notation (`chas.go`) that mimics Rust’s `?` operator, allowing linear handling of results without deeply nested logic. It supports both synchronous and asynchronous operations cleanly, and returns a fully typed `Result` or `ResultAsync`.
    ```ts
    const result = await chas.go(async function* () {
    	const user = yield* fetchUserAsync(1); // Short-circuits returning Err if fetch fails
    	const profile = yield* fetchProfile(user); // Sync Result mixes seamlessly
    	return { user, profile }; // Automatically wrapped in Ok
    });
    ```
- For frontend applications, it integrates directly with React by supporting Suspense and Error Boundaries through `readSuspense()`.
    ```tsx
    // Suspends if pending, returns value if Ok, throws to ErrorBoundary if Err
    const data = myResultAsync.readSuspense();
    ```
- Developers can also perform side-effects within pipelines using utilities like `finally()` and `tap()` without breaking method chains.
    ```ts
    chas.ok(5)
    	.tap(console.log)
    	.map(v => v * 2)
    	.finally(closeConnection);
    ```
- Additional helpers provide advanced functionality such as nested result unwrapping with `flatten()`, conditional execution using `filter()`, and structured object resolution.
    ```ts
    chas.ok(chas.ok(5)).flatten(); // Ok(5)
    chas.ok(15).filter(
    	v => v >= 18,
    	() => 'Too young'
    ); // Err("Too young")
    ```

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
  `chas.ok(42);`
- `chas.err(error)`: Creates an `Err` result.
  `chas.err("Not found");`
- `chas.okAsync(value)`: Creates a `ResultAsync` resolving to `Ok`.
  `chas.okAsync(42);`
- `chas.errAsync(error)`: Creates a `ResultAsync` resolving to `Err`.
  `chas.errAsync("Not found");`
- `chas.fromSafePromise(promise)`: Creates a `ResultAsync` from a Promise that is guaranteed not to reject. Skips the `onRejected` mapper.
  `chas.fromSafePromise(Promise.resolve(42));`

### Utility Wrappers

- `chas.go(generator)`: Do-notation simulator using sync/async generators. Automatically unwraps yielded `Ok` values and `ResultAsync`, but immediately short-circuits and skips remaining code if it yields an `Err`.
    ```ts
    chas.go(async function* () {
    	const a = yield* myResultAsync;
    	return a;
    });
    ```
- `chas.tryCatch(fn, onThrow)`: Executes a synchronous function that may throw and returns a `Result`.
    ```ts
    chas.tryCatch(
    	() => JSON.parse(str),
    	e => 'Invalid JSON'
    );
    ```
- `chas.fromPromise(promise, onRejected)`: Evaluates a Promise and returns a `ResultAsync`.
    ```ts
    chas.fromPromise(fetch('/api'), e => new Error('Fetch failed'));
    ```
- `chas.withResult(fn, onThrow)`: Wraps a synchronous function to return a `Result` instead of throwing.
    ```ts
    const safeParse = chas.withResult(JSON.parse, () => 'Failed');
    ```
- `chas.withResultAsync(fn, onThrow)`: Wraps an async function to return a `ResultAsync`.
    ```ts
    const safeFetch = chas.withResultAsync(fetch, () => 'Failed');
    ```
- `chas.withRetryAsync(fn, options)`: Wraps an async function with resilience logic including retries and timeouts. Options configure `retries`, `delayMs`, `timeoutMs`, `onTimeout`, and `onThrow`.
    ```ts
    chas.withRetryAsync(fetchData, { retries: 3, delayMs: 1000 });
    ```
- `chas.revive(parsedJson)`: Re-attaches methods to a `Result` instance that was parsed directly from JSON `{ok: ..., value/error: ...}`.
    ```ts
    const result = chas.revive(JSON.parse(jsonString));
    ```

### Working with Multiple Results

- `chas.all(iterable)`: Takes an iterable of `Result`s. Returns an `Ok` of an array of all values if strictly all are `Ok`, otherwise short-circuits returning the first `Err`.

    ```ts
    chas.all([chas.ok(1), chas.ok(2)]); // Ok([1, 2])
    ```

    > **Note:** When passing a tuple containing results with `never`-typed parameters (e.g. bare `chas.ok()` or `chas.err()`), the inferred types may degrade to `any`. This is a known TypeScript limitation with complex recursive types. Results with concrete `T` and `E` types infer correctly.

- `chas.allAsync(iterable)`: Takes an iterable of `ResultAsync`s or Promises of Results. Resolves to an array of values if all are `Ok`, or the first resolved `Err`.

    ```ts
    await chas.allAsync([fetch1(), fetch2()]);
    ```

    > **Note:** Same `never`-type inference limitation as `chas.all` applies to the tuple overload.

- `chas.shape(record)`: Takes an object where values are `Result`s. Returns a single `Result` wrapping an object with the same keys mapped to their `Ok` values, or short-circuits to the first `Err`.

    ```ts
    chas.shape({ a: getUser(), b: getConfig() }); // Ok({ a: User, b: Config })
    ```

    > **Note:** Same `never`-type inference limitation as `chas.all` applies to the error union type.

- `chas.shapeAsync(record)`: Concurrently awaits an object mapping strings to `ResultAsync`s. Returns a single `ResultAsync` wrapping an object with the same keys strictly mapped to their resolved `Ok` values, or short-circuits to the first `Err`.

    ```ts
    await chas.shapeAsync({ a: chas.okAsync(1), b: chas.okAsync(2) }); // Ok({ a: 1, b: 2 })
    ```

    > **Note:** Same `never`-type inference limitation as `chas.all` applies to the error union type.

- `chas.any(iterable)`: Returns the first `Ok` result from an iterable, or `Err` with an array of all errors if every result fails. The inverse of `all`.

    ```ts
    chas.any([chas.err('a'), chas.ok(2), chas.err('c')]); // Ok(2)
    chas.any([chas.err('a'), chas.err('b')]); // Err(['a', 'b'])
    ```

- `chas.anyAsync(iterable)`: Async version of `any`. Awaits all promises and returns the first `Ok`, or `Err` of all errors.

    ```ts
    await chas.anyAsync([chas.errAsync('a'), chas.okAsync(2)]); // Ok(2)
    ```

- `chas.collect(iterable)`: Like `all`, but does not short-circuit. Returns `Ok` with all values if all pass, or `Err` with an array of **all** errors encountered. Ideal for validation.

    ```ts
    chas.collect([chas.ok(1), chas.err('a'), chas.err('b')]); // Err(['a', 'b'])
    ```

- `chas.collectAsync(iterable)`: Async version of `collect`. Awaits all promises and collects all errors.

    ```ts
    await chas.collectAsync([chas.okAsync(1), chas.errAsync('a')]); // Err(['a'])
    ```

- `chas.partition(iterable)`: Evaluates an iterable of `Result`s and separates them into an object `{ oks: T[], errs: E[] }`.

    ```ts
    chas.partition([chas.ok(1), chas.err('e')]); // { oks: [1], errs: ['e'] }
    ```

- `chas.partitionAsync(iterable)`: Awaits an iterable of `Result` promises and partitions them.

    ```ts
    await chas.partitionAsync([fetch1(), fetch2()]);
    ```

### Methods on `Result<T, E>`

All `Result` objects have the following methods available:

#### Querying

- `isOk()`: Returns `true` if `Ok`.
  `chas.ok(1).isOk(); // true`
- `isErr()`: Returns `true` if `Err`.
  `chas.err('e').isErr(); // true`
- `isOkAnd(predicate)`: Returns `true` if `Ok` and the value satisfies the predicate.
  `chas.ok(5).isOkAnd(v => v > 0); // true`
- `isErrAnd(predicate)`: Returns `true` if `Err` and the error satisfies the predicate.
  `chas.err('e').isErrAnd(e => e === 'e'); // true`

#### Mapping

- `map(f)`: Applies `f` to the contained value if `Ok`.
  `chas.ok(5).map(v => v * 2); // Ok(10)`
- `asyncMap(f)`: Asynchronously applies `f` to the Ok value, returning a `ResultAsync`.
  `await chas.ok(5).asyncMap(async v => v * 2); // Ok(10)`
- `mapErr(f)`: Applies `f` to the contained error if `Err`.
  `chas.err('e').mapErr(e => e.toUpperCase()); // Err('E')`
- `mapOr(defaultValue, f)`: Applies `f` if `Ok`, or returns `defaultValue` if `Err`.
  `chas.ok(5).mapOr(0, v => v * 2); // 10`
- `mapOrElse(fallbackFn, f)`: Applies `f` if `Ok`, or computes a fallback by executing `fallbackFn(error)`.
  `chas.err('e').mapOrElse(e => e.length, v => v * 2); // 1`
- `filter(predicate, errorFn)`: If `Ok`, tests the value against the predicate. If false, returns a new `Err` mapped by `errorFn`.
  `chas.ok(15).filter(v => v >= 18, () => 'Too young'); // Err('Too young')`
- `swap()`: Swaps `Ok` and `Err` branches. An `Ok<T>` becomes `Err<T>`, an `Err<E>` becomes `Ok<E>`.
  `chas.ok(5).swap(); // Err(5)`

#### Chaining

- `and(other)`: Returns `other` if `this` is `Ok`, otherwise returns `this`.
  `chas.ok(1).and(chas.ok(2)); // Ok(2)`
- `or(other)`: Returns `this` if `Ok`, otherwise returns `other`.
  `chas.err('e').or(chas.ok(2)); // Ok(2)`
- `andThen(f)`: Calls `f(value)` if `Ok`, returning a new `Result`.
  `chas.ok(1).andThen(v => chas.ok(v * 2)); // Ok(2)`
- `asyncAndThen(f)`: Calls async `f(value)` if `Ok`, returning a `ResultAsync`.
  `await chas.ok(1).asyncAndThen(async v => chas.okAsync(v * 2)); // Ok(2)`
- `orElse(f)`: Calls `f(error)` if `Err`, returning a new `Result`.
  `chas.err('e').orElse(e => chas.ok(e.length)); // Ok(1)`
- `flatten()`: If the result is an `Ok` containing another nested `Result`, structurally unwraps the inner `Result` one layer deep.
  `chas.ok(chas.ok(5)).flatten(); // Ok(5)`

#### Unwrapping

- `unwrap()`: Returns the contained value if `Ok`, or throws the contained error if `Err`.
  `chas.ok(5).unwrap(); // 5`
- `unwrapErr()`: Returns the contained error if `Err`, or throws an error if `Ok`.
  `chas.err('e').unwrapErr(); // 'e'`
- `unwrapOr(defaultValue)`: Returns the contained value or a default.
  `chas.err('e').unwrapOr(5); // 5`
- `unwrapOrElse(f)`: Returns the contained value or computes a fallback from the error.
  `chas.err('e').unwrapOrElse(e => e.length); // 1`
- `unwrapOrNull()`: Returns the value or `null`.
  `chas.err('e').unwrapOrNull(); // null`
- `unwrapOrUndefined()`: Returns the value or `undefined`.
  `chas.err('e').unwrapOrUndefined(); // undefined`
- `expect(message, error?)`: Unwraps the value, or throws an error with the given message if `Err`. If `error` is specified (which must extend the Error object), then that would be thrown instead.
  `chas.err('e').expect('Should be Ok'); // throws Error('Should be Ok')`
- `expectErr(message, error?)`: Unwraps the error, or throws an error with the given message if `Ok`. If `error` is specified (which must extend the Error object), then that would be thrown instead.
  `chas.ok(5).expectErr('Should be Err'); // throws Error('Should be Err')`

#### Side Effects & Matching

- `match({ ok, err })`: Executes `ok` if `Ok`, or `err` if `Err`, returning the result.
  `chas.ok(5).match({ ok: v => v * 2, err: () => 0 }); // 10`
- `tap(f)`: Calls `f(value)` if `Ok`, returning `this` unchanged.
  `chas.ok(5).tap(console.log); // Ok(5)`
- `asynctap(f)`: Asynchronously calls `f(value)` if `Ok`, returning `ResultAsync<T, E>`.
  `await chas.ok(5).asynctap(async v => await logToDb(v)); // Ok(5)`
- `tapErr(f)`: Calls `f(error)` if `Err`, returning `this` unchanged.
  `chas.err('e').tapErr(console.error); // Err('e')`
- `asynctapErr(f)`: Asynchronously calls `f(error)` if `Err`, returning `ResultAsync<T, E>`.
  `await chas.err('e').asynctapErr(async e => await submitError(e)); // Err('e')`
- `finally(f)`: Calls `f()` regardless of `Ok` or `Err`, returning `this` unchanged.
  `chas.ok(5).finally(closeConnection); // Ok(5)`

### Methods on `ResultAsync<T, E>`

`ResultAsync` is Promise-like and provides methods specifically designed for async pipelines:

- `await`: Await the instance directly to extract the inner synchronous `Result<T, E>`.
- `map(f)`: Asynchronously maps an `Ok` value. Returns a `ResultAsync`.
  `chas.okAsync(5).map(v => v * 2);`
- `mapErr(f)`: Asynchronously maps an `Err` error. Returns a `ResultAsync`.
- `andThen(f)`: Chains another `Result` or `ResultAsync` if `Ok`. Returns a `ResultAsync`.
  `fetchUser().andThen(u => fetchProfile(u.id));`
- `match({ ok: f, err: g })`: Asynchronously evaluates a match handler. Returns a `Promise<U | F>`.
- `unwrap()`: Unwraps the instance, returning a native `Promise<T>` that resolves on `Ok` or rejects on `Err`.
- `readSuspense()`: Synchronous unwrap designed strictly for React Suspense contexts. Throws the internal Promise if pending, throws the `E` error to the nearest Error Boundary if `Err`, or perfectly returns `T` if `Ok`.
- `tap(f)`: Validates an `Ok` value and executes a side-effect (can be synchronous or asynchronous), retaining the original type constraint without throwing `Promise` state away.
  `fetchUser().tap(u => logSync(u));`
  `fetchUser().tap(async u => await logToDb(u));`
- `tapErr(f)`: Validates an `Err` error and executes a side-effect (can be synchronous or asynchronous). Psses `ResultAsync<T, E>` through untouched.
  `fetchUser().tapErr(e => console.error(e));`
  `fetchUser().tapErr(async e => await submitErrorToSentry(e));`
- `finally(f)`: Executes an asynchronous side-effect regardless of outcome, returning the original `ResultAsync`.
- `swap()`: Swaps the `Ok` and `Err` branches asynchronously.
  `await chas.okAsync(5).swap(); // Err(5)`
- `ResultAsync.fromSafePromise(promise)`: Static method. Creates a `ResultAsync` from a Promise guaranteed not to reject.
  `chas.ResultAsync.fromSafePromise(Promise.resolve(42));`
- `ResultAsync.defer(fn)`: Static method. Defers execution of `fn` to the next microtask. The function is not called synchronously during construction.
  `chas.ResultAsync.defer(() => expensiveFetchAsync());`

### Tagged Errors

Define typed, discriminated error unions and match on them with full type safety:

```ts
// Define error types with factories
const AppError = chas.errors({
	NotFound: (resource: string, id: string) => ({ resource, id }),
	Validation: (field: string, message: string) => ({ field, message }),
	Unauthorized: () => ({}),
});

// Extract the union type
type AppErr = chas.InferErrors<typeof AppError>;

// Create instances — they are real Error objects with a `_tag` discriminant
const err = AppError.NotFound('user', '123');
// → Error { _tag: "NotFound", resource: "user", id: "123", stack: "...", name: "NotFound" }

// Use with Result
function getUser(id: string): chas.Result<User, AppErr> {
	if (!id) return chas.err(AppError.Validation('id', 'required'));
	return chas.ok(user);
}
```

- `chas.errors(definitions)`: Creates tagged error factory functions. Each key becomes a `_tag` discriminant. The resulting objects are real `Error` instances with stack traces.
- `chas.InferErrors<typeof factories>`: Extracts the discriminated union type from factories.
- `chas.matchError(error, handlers)`: Exhaustively matches on `_tag`. TypeScript enforces every variant is handled and infers the return type from your handlers.
- `chas.matchErrorPartial(error, handlers)`: Matches a subset of tags. Requires a `_` fallback.

    ```ts
    const message = chas.matchErrorPartial(error, {
    	Validation: e => `Bad field ${e.field}`,
    	_: e => `Unexpected error: ${e._tag}`,
    });
    ```

- `chas.isErrorTag(error, tag)`: Type guard that narrows to a specific variant.

    ```ts
    if (chas.isErrorTag(error, 'NotFound')) {
    	error.resource; // Narrowed to NotFound (resource, id are accessible)
    }
    ```

- `result.catchTag(tag, handler)`: Catches a specific error by tag, handles it (returning a recovery `Result`), and **removes it from the error union**.

    ```ts
    const result = await fetchUser(id).catchTag('NotFound', e => chas.ok(GUEST_USER));
    // result type is now Result<User, DbError | Unauthorized> (NotFound is gone!)
    ```

#### Native Error Support

Errors created with `chas.errors()` are real `Error` instances. They include native stack traces and support standard properties like `name` and `message`.

They also support **Error Wrapping** via the native `cause` property:

```ts
const AppError = chas.errors({
	Database: (query: string) => ({ query }),
	Http: (status: number, cause: Error) => ({ status, cause }),
});

const err = AppError.Http(500, AppError.Database('SELECT *'));
// err.cause correctly references the low-level Database error instance
```
