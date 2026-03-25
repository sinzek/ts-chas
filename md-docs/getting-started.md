---
title: Getting Started
group: Guides
---

# Getting Started with `ts-chas`

Welcome to `ts-chas`! This library is designed to bring powerful, ergonomic functional programming concepts to TypeScript, focusing on explicit error handling, robust validation, and composable async workflows.

Unlike many utility libraries that provide a scattered collection of unrelated tools, `ts-chas` is a cohesive ecosystem. Its modules—Result, Option, Task, Guard, Tagged Errors, and Pipe/Flow—are built to work beautifully together.

This guide will walk you through the core concepts and show you how to start using `ts-chas` effectively.

---

## 1. Explicit Error Handling with `Result`

In standard JavaScript/TypeScript, errors are often handled using `try...catch` blocks, which can lead to implicit control flow and loss of type information (errors are typed as `unknown` or `any`).

`ts-chas` provides the `Result<T, E>` and `ResultAsync<T, E>` types to make error handling explicit, type-safe, and composable.

### The Problem

```ts
function getUser(id: string) {
	// We don't know from the signature if this throws, or what it throws!
	const data = fetchUserFromDb(id);
	if (!data) throw new Error('User not found');
	return data;
}

try {
	const user = getUser('123');
	// Do something with user
} catch (error) {
	// error is of type `unknown`
	console.error(error);
}
```

### The `chas` Solution

```ts
import { chas } from 'ts-chas';

interface User {
	name: string;
	age: number;
}

// Now the signature explicitly states what can go wrong!
function getUser(id: string): chas.ResultAsync<User, string> {
	return chas
		.fromPromise(fetchUserFromDbAsync(id), e => `Database error: ${e}`)
		.andThen(data => {
			if (!data) return chas.errAsync('User not found');
			return chas.okAsync(data);
		});
}

// Ergonomic, chainable handling without try/catch
const result = await getUser('123')
	.map(user => user.name)
	.mapErr(err => err.toUpperCase())
	.tap(name => console.log(`Found ${name}`))
	.tapErr(err => console.error(err));

// Exhaustive matching
const finalOutput = result.match({
	ok: name => `Hello, ${name}`,
	err: error => `Failed: ${error}`,
});
```

> If a function can fail, it should return a `Result` or `ResultAsync`. This forces the caller to explicitly handle the potential failure, preventing unexpected runtime crashes.

---

## 2. Strong Typing for Errors: `TaggedErrs`

While `Result<T, string>` is a good start, complex applications often have many different reasons for failure. `ts-chas` provides `TaggedErrs` to create typed, discriminated unions of native `Error` objects.

This allows you to leverage TypeScript's type system for error matching.

```ts
import { chas } from 'ts-chas';

// 1. Define your error catalog
// Each will extend a base Error object with a `_tag` field, so props like `message` and `stack` are automatically included.
const AppError = chas.defineErrs(
	{
		NotFound: (resource: string, id?: string) => ({ resource, id }),
		Unauthorized: (userId: string) => ({ userId }),
		ValidationError: (field: string) => ({ field }),
	},
	{
		// Add optional base properties to all errors
		code: string,
	}
);

// 2. Infer your error types
type AppErr = chas.InferErrs<typeof AppError>; // A union of all errors
type NotFoundErr = chas.InferErr<typeof AppError.NotFound>; // Just the NotFound error

// 2. Use them in your functions
function fetchProfile(id: string): chas.ResultAsync<Profile, AppErr> {
	if (id === '123') {
		return AppError.NotFound.err('profile');
		// .err() is a helper on each error factory that returns a Result<T, E> where E is the error's inferred type
	}
	if (id === '456') {
		return AppError.Unauthorized.err(id);
	}
	return chas.ok({ name: 'John Doe', age: 30 });
}

// 3. Exhaustive (or partial) matching with full type inference!
const profileResult = await fetchProfile('user_1');

if (profileResult.isErr()) {
	const message = chas.matchErr(profileResult.unwrapErr(), {
		NotFound: e => `Could not find ${e.resource}`,
		Unauthorized: e => `User ${e.userId} lacks permissions`,
	});
	// OR
	const message = chas.matchErrPartial(profileResult.unwrapErr(), {
		NotFound: e => `Could not find ${e.resource}`,
		_: e => `An error occurred: ${e.message}`,
		// `_` matches any error that isn't explicitly matched, and its parameter `e` is a union of the remaining error types
	});
}

// 4. Or selectively catch specific errors mid-chain to recover
const recoveredResult = await fetchProfile('user_1').catchTag(AppError.NotFound, e => {
	// We handle the NotFound error and return a default profile
	// `e` will be correctly inferred as NotFoundErr if the AppError.NotFound factory is passed.

	// The resulting Result type will no longer include the NotFound error!
	return chas.ok(defaultProfile);
});
```

---

## 3. Resilient Workflows with `Task`

Promises execute immediately upon creation and lack built-in mechanisms for retries, timeouts, or complex recovery.

A `Task` is a lazy, promise-like wrapper that empowers async operations with functional chaining, retries, and resilience logic limiters. Under the hood, a `Task` always resolves to a `ResultAsync`.

```ts
import { Task } from 'ts-chas';

// The function is NOT executed yet
const fetchTask = Task.from(
	() => fetch('https://api.example.com/data'),
	error => new Error('Network failure')
);

// We can build complex resilience pipelines easily
const resilientTask = fetchTask
	.retry(3, { delay: 1000, factor: 2 }) // Exponential backoff retries
	.timeout(5000, () => new Error('Request timed out')) // 5-second timeout
	.circuitBreaker({ threshold: 5, resetTimeout: 30000 }) // Circuit breaker pattern
	.fallback(Task.from(() => fetch('https://backup.example.com/data'))); // Fallback on total failure

// Finally, execute the task when ready
const result = await resilientTask.execute();
```

---

## 4. Null-Safety with `Option`

`Option<T>` is the functional equivalent to nullable values (`T | null | undefined`). It explicitly models the presence (`Some`) or absence (`None`) of a value.

In `ts-chas`, an `Option<T>` is effectively an alias for `Result<NonNullable<T>, never>`, meaning it shares the exact same rich API methods as `Result`!

```ts
import { Option } from 'ts-chas';

// Converting unsafe nullable values into safe Options
const maybeUser = Option.nullable(getUserFromCache('123')); // Option<User>

// Map safely over the value if it exists; does nothing if it's None.
const greeting = maybeUser
	.map(user => user.firstName)
	.map(name => `Hello, ${name}!`)
	.unwrapOr('Hello, Guest!');

// If you need to integrate an Option into an async pipeline, upgrade it to a Task
const cacheTask = Task.fromOption(maybeUser, () => new Error('Cache miss'));
```

---

## 5. Validation and Parsing with `Guard`

The Guard API provides chainable validation and schema parsing. It ensures that data entering your system exactly matches the types your code expects.

```ts
import { is, defineSchemas } from 'ts-chas';

// 1. Simple runtime type guards
const isPositiveEven = is.number.positive.even;

if (isPositiveEven(myVar)) {
	// myVar is typed as number here
}

// 2. Complex schemas with parsing
const schemas = defineSchemas({
	UserPayload: {
		id: is.string.uuid('v4'),
		email: is.string.email,
		age: is.number.gte(18).setErrMsg('User must be an adult'),
		tags: is.array(is.string).min(1),
	},
});

// Infer the TypeScript type from the schema!
type UserPayload = chas.InferSchema<typeof schemas.UserPayload>;

// Parse unknown data. Returns a Result containing either the strongly-typed data
// or an array of detailed GuardErr validation errors.
const parsed = schemas.UserPayload.parse(incomingJson);

if (parsed.isOk()) {
	// parsed.value is safely typed as UserPayload
	saveUser(parsed.value);
} else {
	console.error('Validation failed:', parsed.error);
}
```

---

## 6. Composition with `Pipe` and `Flow`

`ts-chas` provides `pipe` and `flow` utility functions to compose small, focused functions into larger pipelines, making your code highly readable.

```ts
import { pipe, flow } from 'ts-chas';

const add5 = (x: number) => x + 5;
const double = (x: number) => x * 2;

// Pipe executes the pipeline immediately with the provided initial value
const pipedResult = pipe(10, add5, double); // (10 + 5) * 2 = 30

// Flow creates a new reusable function representing the pipeline
const calculate = flow(add5, double);
const flowResult1 = calculate(10); // 30
const flowResult2 = calculate(5); // 20

// Note: Both Result and ResultAsync have built-in .pipe() methods too!
const res = chas.ok(10).pipe(add5, double); // Ok(30)
```

---

## Next Steps

Now that you've seen the core pieces, dive into the individual API references in the sidebar to understand the full power of each module. We recommend starting with the **Result API**, as it forms the foundational error-handling model for the rest of the library.
