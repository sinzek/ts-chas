/* eslint-disable @typescript-eslint/no-unused-vars */
import { ok, err, okAsync, errAsync, fromPromise, ResultAsync, go, type Result } from '../src/result';

// ─────────────────────────────────────────────────────────────────────────────
// 1. The simplest: okAsync / errAsync
//    Just wrap a value. This is the async equivalent of ok() / err().
// ─────────────────────────────────────────────────────────────────────────────

function getUser(id: number): ResultAsync<{ name: string }, 'NOT_FOUND'> {
	if (id === 1) return okAsync({ name: 'Alice' });
	return errAsync('NOT_FOUND');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. fromPromise — wrapping a Promise that might reject
//    The most common real-world pattern: you have a Promise-based API
//    and want to convert rejections into typed Err results.
// ─────────────────────────────────────────────────────────────────────────────

function fetchTodo(id: number): ResultAsync<{ title: string }, string> {
	return fromPromise(
		fetch(`https://jsonplaceholder.typicode.com/todos/${id}`).then(r => r.json()),
		e => `Fetch failed: ${e}`
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. new ResultAsync(...) — wrapping your own async logic inside a Promise<Result>
//    Full control: you build a Promise<Result<T, E>> yourself.
// ─────────────────────────────────────────────────────────────────────────────

function readFile(path: string): ResultAsync<string, 'READ_ERROR'> {
	return new ResultAsync(
		(async () => {
			try {
				// pretend this is fs.readFile
				if (path === '/etc/hosts') return ok('127.0.0.1 localhost');
				return err('READ_ERROR');
			} catch {
				return err('READ_ERROR');
			}
		})()
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Chaining with andThen — composing multiple ResultAsync-returning functions
//    andThen on a ResultAsync automatically accepts both Result and ResultAsync
//    return types from the callback.
// ─────────────────────────────────────────────────────────────────────────────

function getUserProfile(id: number): ResultAsync<{ name: string; bio: string }, 'NOT_FOUND' | 'PROFILE_ERROR'> {
	return getUser(id).andThen(user => {
		if (user.name === 'Alice') return okAsync({ name: user.name, bio: 'Loves TypeScript' });
		return errAsync('PROFILE_ERROR' as const);
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. go() with async generators — do-notation style
//    The most ergonomic way to write sequential async logic.
//    yield* unwraps Ok values; any Err short-circuits the whole block.
// ─────────────────────────────────────────────────────────────────────────────

function loadDashboard(userId: number) {
	return go(async function* () {
		const user = yield* getUser(userId); // short-circuits if NOT_FOUND
		const profile = yield* getUserProfile(userId); // short-circuits if PROFILE_ERROR
		const file = yield* readFile('/etc/hosts'); // short-circuits if READ_ERROR

		return {
			user,
			profile,
			hosts: file,
		};
	});
	// Return type is automatically inferred:
	// ResultAsync<{ user: ..., profile: ..., hosts: string }, 'NOT_FOUND' | 'PROFILE_ERROR' | 'READ_ERROR'>
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ResultAsync.fromSafePromise — when the promise is guaranteed not to reject
//    The error type is `never`, so you can't accidentally handle a rejection.
// ─────────────────────────────────────────────────────────────────────────────

function getTimestamp(): ResultAsync<number, never> {
	return ResultAsync.fromSafePromise(Promise.resolve(Date.now()));
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Lifting a sync Result into ResultAsync with ResultAsync.fromResult
//    Useful when you need to return a ResultAsync but your logic is synchronous.
// ─────────────────────────────────────────────────────────────────────────────

function parseAge(input: string): ResultAsync<number, 'INVALID_AGE'> {
	const n = parseInt(input, 10);
	const syncResult: Result<number, 'INVALID_AGE'> = isNaN(n) ? err('INVALID_AGE') : ok(n);
	return ResultAsync.fromResult(syncResult);
}
