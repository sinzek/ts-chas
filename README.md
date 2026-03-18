# chas

`chas` is a production-grade functional programming and utility library for TypeScript. It provides a robust set of tools for explicitly handling errors, defining runtime types, managing asynchronous operations, and composing functions.

[**View the full API documentation here!**](https://sinzek.github.io/chas/)

## Overview

Unlike other utility libraries that attempt to do everything, `chas` focuses heavily on creating a cohesive and tightly-integrated ecosystem. Its modules are built to work perfectly together, giving you type-safety, intelligent errors, and incredibly ergonomic APIs.

At a high level, the `chas` ecosystem provides:
- **Result & Option**: explicit and type-safe error handling and null-safety without relying on `try/catch`. 
- **Task**: resilient and lazy asynchronous operations.
- **Guard**: chainable validation and schema parsing.
- **Tagged Errors**: typed, discriminated error unions.
- **Pipe & Flow**: intuitive function composition.

---

## The Modules

### 1. Result API (`chas/result`)
Inspired by Rust and `fp-ts`, `Result<T, E>` and `ResultAsync<T, E>` replace implicit `try...catch` blocks with explicit, monadic error handling.

```ts
import { chas } from 'chas';

// Predictable error typing
function fetchUser(id: number): chas.ResultAsync<User, string> {
	return chas.fromPromise(
		fetch(`/users/${id}`).then(res => res.json()),
		() => 'Failed to fetch user'
	);
}

// Ergonomic chaining and transformation
const finalResult = await fetchUser(1)
	.map(user => user.name)
	.mapErr(err => err.toUpperCase());

if (finalResult.isOk()) {
	console.log(`Hello, ${finalResult.value}`);
}
```

### 2. Guard API (`chas/guard`)
A highly expressive, chainable validation and schema parsing system.

```ts
import { is, defineSchemas } from 'chas';

// Simple, chainable runtime validation
const isValidEmail = is.string.email.length(5, 100);
if (isValidEmail(someInput)) {
	// someInput is correctly inferred as `string` here
}

// Schema parsing
const schemas = defineSchemas({
	User: {
		id: is.string.uuid('v4'),
		age: is.number.gte(18),
		tags: is.array(is.string).min(1),
	}
});

// Parses unknown data into a Result!
const result = schemas.User.parse(unknownData);
if (result.isErr()) {
	console.error(result.error); // Formatted GuardErr[]
}
```

### 3. Task API (`chas/task`)
A lazy, promise-like wrapper that empowers async operations with functional chaining, retries, and resilience logic limiters. Under the hood, a Task always resolves to a `ResultAsync`.

```ts
import { Task } from 'chas';

// Create a task
const fetchTask = Task.from(() => fetch('/data'), e => new Error('Fetch failed'));

// Attach resilience patterns seamlessly
const resilientTask = fetchTask
	.retry(3, { delay: 1000, factor: 2 }) // Exponential backoff!
	.timeout(5000, () => new Error('Timeout'))
	.circuitBreaker({ threshold: 5, resetTimeout: 30000 });

// Execute it when you're ready
const result = await resilientTask.execute();
```

### 4. Tagged Errors (`chas/tagged-errs`)
Define discriminated unions of native `Error` instances, allowing exhaustive pattern matching on errors with `Result`.

```ts
import { chas } from 'chas';

const AppError = chas.errors({
	NotFound: (resource: string) => ({ resource }),
	Unauthorized: () => ({}),
});

const myResult = chas.err(AppError.NotFound('user'));

// Exhaustive error matching!
const message = chas.matchError(myResult.unwrapErr(), {
	NotFound: e => `Could not find ${e.resource}`,
	Unauthorized: () => 'You lack permissions.',
});
```

### 5. Option API (`chas/option`)
A functional equivalent to nullable values (`T | null | undefined`). An `Option<T>` is effectively an alias for `Result<T, never>`, tightly integrating with the rest of the library.

```ts
import { Option } from 'chas';

const maybeUser = Option.fromNullable(getUserOrNull());

// Easily map over valid values
const userName = maybeUser
	.map(user => user.name)
	.unwrapOr('Anonymous');
```

---

## Designed for Cross-Compatibility

`chas` is structured so that its modules communicate deeply with one another. Whether you're moving between `Option`, `Result`, `Guard`, or `Task`, there are ergonomic pathways built-in.

**Converting a Result to an Option:**
```ts
const maybeData = chas.ok(5).toOption(); // Option<number>
const safelyEmpty = chas.err('fail').toOption(); // Option::None
```

**Guard validations directly to Results:**
```ts
import { is } from 'chas';

// Convert any guard to a validator that returns a Result
const validateAge = is.toValidator(is.number.gte(18), 'Must be 18+');

const result = validateAge(20); // Result.Ok(20)
const errResult = validateAge(15); // Result.Err('Must be 18+')
```

**Options into Tasks:**
```ts
import { Option, Task } from 'chas';

const optionalConfig = Option.fromNullable(readConfig());

// Upgrade an Option to an asynchronous Task, providing an error fallback if it was None
const configTask = Task.fromOption(optionalConfig, () => new Error('Config missing'));
```

**Generators mapping everything:**
With `chas.go`, you can mix and match `Result` and `ResultAsync` calls in a clean, imperative-looking flow without infinite `.andThen` chains.

```ts
const userProfileResult = await chas.go(async function* () {
	// Yield a ResultAsync
	const user = yield* fetchUserAsync(); 
	
	// Yield a synchronous Result
	const config = yield* parseConfig(user.prefs); 

	return { user, config };
});
```

## Installation

```bash
npm install chas
# or
yarn add chas
# or
pnpm add chas
```
