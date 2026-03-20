`chas` is a functional programming and utility library for TypeScript. It provides an ergonomic set of tools and [monads](<https://en.wikipedia.org/wiki/Monad_(computer_science)>) for explicitly handling errors, defining runtime types, input validation, managing asynchronous operations, and composing functions.

[**View the full API documentation here!**](https://sinzek.github.io/chas/)

## Overview

Unlike other utility libraries with disparate modules, `chas` focuses heavily on creating a cohesive and tightly-integrated ecosystem. Its modules are built to work well together, giving you type-safety, intelligent errors, and clean APIs.

At a high level, the `chas` ecosystem provides:

- **Result & Option**: explicit and type-safe error handling and null-safety without relying on `try/catch` or `null` checks.
- **Task**: resilient and lazy asynchronous operations.
- **Guard**: chainable validation and schema parsing.
- **Tagged Errors**: typed, discriminated error unions & error matching.
- **Pipe & Flow**: intuitive function composition.

---

## Modules

### 1. Result API (`chas/result`)

Inspired by Rust and `fp-ts`, `Result<T, E>` and `ResultAsync<T, E>` replace implicit `try...catch` blocks with explicit, monadic error handling. ResultAsync is also PromiseLike, so it can be awaited or .then()'d directly.

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
	.mapErr(err => err.toUpperCase())
	.tap(user => console.log(`Hello, ${user}`)) // side effect on Ok
	.tapErr(err => console.log(`Error: ${err}`)) // side effect on Err
	.orElse(err => chas.ok(`Using default value: ${err}`));

if (finalResult.isOk()) {
	console.log(`Hello, ${finalResult.value}`);
}

// Wrap any function that might throw
const result = chas.tryCatch(
	() => JSON.parse('invalid'),
	e => e.message
);
const asyncResult = chas.fromPromise(
	() => fetch('/data'),
	e => e.message
);

// Result matching
const result = await fetchUser(1).match({
	ok: user => `Hello, ${user.name}`,
	err: err => `Error: ${err}`,
}); // result is typed as `string`

// Data formatting
const result = await chas.shapeAsync({
	user: fetchUser(1), // ResultAsync<User, Error>
	config: chas.ok({ theme: 'dark' }), // Result<Config, Error>
}); // result is typed as `Result<{ user: User, config: Config }, Error>`

// ResultAsync can be awaited or .then()'d directly since it is a PromiseLike
const result = fetchUser(1); // ResultAsync<User, string>
const thenResult = result.then(user => user.name); // ResultAsync<string, string>
const awaitedResult = await result; // Result<User, string>

// Evaluate multiple ResultAsyncs in parallel
const results1 = await chas.allAsync([fetchUser(1), fetchUser(2)]); // Result<[User, User], Error>
const results2 = await chas.collectAsync([fetchUser(1), fetchUser(2)]); // Result<[User, User], Error[]>
const results3 = await chas.anyAsync([fetchUser(1), fetchUser(2)]); // Result<User, Error[]>
const results4 = await chas.raceAsync([fetchUser(1), fetchUser(2)]); // Result<User, Error>
// ^^^ Each of these has a non-async counterpart that operates on Results instead of ResultAsyncs

// Result and ResultAsync have a built-in pipe method!
const result = chas.ok(1).pipe(add5, double); // Ok(12)
const asyncResult = chas.okAsync(1).pipe(add5, double); // ResultAsync<12, never>
```

### 2. Guard API (`chas/guard`)

A highly expressive, chainable validation and schema parsing system. Heavily inspired by [Zod](https://zod.dev/), but with a focus on type inference and integration with the `chas` ecosystem.

```ts
import { is, defineSchemas } from 'chas';

// Simple, chainable runtime validation
const isValidEmail = is.string.email.length(5, 100);
if (isValidEmail(someInput)) {
	// someInput is correctly inferred as `string` here
}

// Easy object and array validation
const isValidUser = is.object({
	name: is.string,
	age: is.number.gte(18),
	email: is.string.email,
});
const isValidUsers = is.array(isValidUser);
const isValid = isValidUsers(data);
if (isValid) {
	// data is correctly inferred as `User[]` here
}

// Schema parsing
const schemas = defineSchemas({
	User: {
		id: is.string.uuid('v4'),
		age: is.number.gte(18).setErrMsg('Not old enough!'),
		tags: is.array(is.string).min(1),
	},
});

// Easily infer a schema's type
type User = chas.InferSchema<typeof schemas.User>;

// Parses unknown data into a Result<{ id: string, age: number, tags: string[] }, GuardErr[]>
const result = schemas.User.parse(unknownData);
if (result.isErr()) {
	console.error(result.error.map(e => e.message).join('\n'));
}

// Expressive errors with optional custom messages
const result = schemas.User.parse(unknownData);
if (result.isErr()) {
	console.error(result.error); // GuardErr[]
	// [{ msg: 'User.name failed validation: expected string.uuid('v4'), but got number (123)', path: ['User', 'name'], expected: 'string', schema: 'User' },
	// { msg: 'Not old enough!', path: ['User', 'age'], expected: 'number', schema: 'User' },
	// { msg: 'User.email failed validation: expected string.email, but got undefined (undefined)', path: ['User', 'email'], expected: 'string', schema: 'User' }]
}
```

#### `is` Namespace Extensions

The Guard API also allows for namespace extensions, allowing you to create custom validators on your own `is` instance.

```ts
const myIs = is.extend('app', {
	positiveEven: (v: unknown): v is number => is.number.positive(v) && is.number.even(v),
});

myIs.app.positiveEven(4); // true
myIs.app.positiveEven(3); // false
```

### 3. Task API (`chas/task`)

A lazy, promise-like wrapper that empowers async operations with functional chaining, retries, dependency injection, and resilience logic limiters. Under the hood, a Task always resolves to a `ResultAsync`.

```ts
import { Task } from 'chas';

// Create a task
const fetchTask = Task.from(
	() => fetch('/data'),
	e => new Error('Fetch failed')
);

// Attach resilience patterns seamlessly
const resilientTask = fetchTask
	.retry(3, { delay: 1000, factor: 2 }) // Exponential backoff!
	.timeout(5000, () => new Error('Timeout'))
	.circuitBreaker({ threshold: 5, resetTimeout: 30000 });

// Execute it when you're ready
const result = await resilientTask.execute();

// Create a task that requires context
interface AppContext {
	dbUrl: string;
}
const taskWithContext = Task.ask<AppContext>().chain(ctx =>
	Task.from(
		() => fetch(`${ctx.dbUrl}/data`),
		e => new Error('Failed')
	)
);

// Provide the context later (dependency injection)
const readyTask = taskWithContext.provide({ dbUrl: 'https://db.example.com' });
await readyTask.execute();
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

// Catch a specific error type from a Result chain, removing it from the error union
// fetchUser returns Result<User, NotFound | Unauthorized>
const result = await fetchUser(1).catchTag(AppError.NotFound, e => {
	console.log(`Could not find ${e.resource}`);
	return chas.ok(null);
}); // Result<User | null, Unauthorized>, also works: .catchTag('NotFound', e => ...)

// Tap into a tagged error from a Result chain without modifying the Result
const result = await fetchUser(1).tapTag(AppError.NotFound, e => {
	console.log(`Could not find ${e.resource}`);
}); // Result<User, NotFound | Unauthorized>, also works: .tapTag('NotFound', e => ...)

// Check if an unknown value is a tagged error with Guard
const value: unknown = { _tag: 'NotFound', resource: 'user' };
const isNotFoundErr = chas.is.taggedErr(AppError.NotFound)(value);
// also works: chas.is.taggedErr('NotFound')(value);
```

### 5. Option API (`chas/option`)

A functional equivalent to nullable values (`T | null | undefined`). An `Option<T>` is effectively an alias for `Result<NonNullable<T>, never>`, tightly integrating with the rest of the library.

```ts
import { Option } from 'chas';

const maybeUser = Option.fromNullable(getUserOrNull());

// Easily map over valid values
const userName = maybeUser.map(user => user.name).unwrapOr('Anonymous');
```

### 6. Pipe and Flow (`chas/pipe`)

Pipe and Flow are utility functions that allow you to chain functions together in a more readable way. Pipe lets you move data through a pipeline of functions, while Flow lets you compose functions together for later use.

```ts
import { pipe, flow } from 'chas';

const add5 = (x: number) => x + 5;
const double = (x: number) => x * 2;

// Pipe
const result = pipe(1, add5, double); // 12

// Flow
const add5ThenDouble = flow(add5, double);
const result = add5ThenDouble(1); // 12
```

---

## Designed for Cross-Compatibility

`chas` is structured so that its modules communicate deeply with one another. Whether you're moving between `Option`, `Result`, `Guard`, or `Task`, there are simple pathways built-in.

**Converting between types**

```ts
// ResultAsync to Result
const result = await fetchUser(1); // awaiting a ResultAsync returns a Result

// Result to ResultAsync
const resultAsync = ResultAsync.fromResult(result); // ResultAsync<T, E>

// Result to Option
const maybeData = chas.ok(5).toOption(); // Option<number>
const safelyEmpty = chas.err('fail').toOption(); // Option::None

// Option to Result
const result = Option.toResult(maybeData, () => 'fail'); // Result<number, string>

// Guard to Option
const maybeNumber = Option.fromGuard(value, is.number); // Option<number>

// Option to Task
const task = Task.fromOption(maybeData, () => 'fail'); // Task<number, string>

// Guard to Result-returning function
const validateAge = guardToValidator(is.number.gte(18), 'Must be 18+'); // (value: number) => Result<number, string>

// Guard to Task-returning function
const validateAgeTask = guardToTask(is.number.gte(18), 'Must be 18+'); // (value: number) => Task<number, string>
```

**Guard validations directly to Results:**

```ts
import { is, guardToValidator } from 'chas/guard';

// Convert any guard to a validator that returns a Result
const validateAge = guardToValidator(is.number.gte(18), 'Must be 18+');

const result = validateAge(20); // Result.Ok(20)
const errResult = validateAge(15); // Result.Err('Must be 18+')

const validateAgeWithGuardErr = guardToValidator(is.number.gte(18));
const errResult = validateAgeWithGuardErr(15); // Result.Err(GuardErr), msg: 'Value failed validation: expected number.gte(18), but got number (15)'
```

**Options into Tasks:**

Options are frequently used for synchronous, optional values (such as checking a local cache or reading an environment variable). But when you need to integrate this optional data into a larger, asynchronous pipeline powered by `Task`s, converting it directly allows the entire flow to remain linear and cleanly composable without writing clunky `.isSome()` branches.

```ts
import { Option, Task } from 'chas';

const checkCache = () => Option.fromNullable(localStorage.getItem('user'));

// Upgrade the synchronous Option into an asynchronous Task!
// We provide an error fallback in case the cache (Option) was empty.
const cacheTask = Task.fromOption(checkCache(), () => new Error('Cache miss'));

// We can now seamlessly compose it with other Tasks
const fetchTask = Task.from(
	() => fetch('/user'),
	() => new Error('Fetch failed')
);

// If it's not in the cache, fallback to fetching it
const userTask = cacheTask.orElse(() => fetchTask);
const userResult = await userTask.execute();
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
}); // if ok, data is typed as { user, config }, if err, it's typed as the union of all possible errors

// Also possible with Task! (orchestrates Task instances)
const userProfileTask = Task.go(async function* () {
	const user = yield* fetchUserTask();
	const config = yield* parseConfigTask(user.prefs);
	return { user, config };
});
const userProfileResult = await userProfileTask.execute();
```

## Installation

```bash
npm install ts-chas
# or
yarn add ts-chas
# or
pnpm add ts-chas
```

## Contributions

I'm always open to contributions! Feel free to open an issue or submit a PR.
