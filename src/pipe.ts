import type { MaybePromise } from './utils.js';

/**
 * Why are these functions so long, and why are they capped at 10 arguments?
 *
 * Although TypeScript supports variadic tuple types, recursive conditional types can be tricky (and very slow).
 * If we didn't have these overloads, we would need to use a recursive conditional type, which would collapse the type of each
 * function argument to `any`.
 *
 * Regardless, if you need more than 10 functions in your pipe, you're probably doing something wrong.
 *
 * - chase
 */

/**
 * A pipe that works with synchronous functions. Each function is called synchronously and the result is passed to the next function.
 * @param value The initial value.
 * @param f1 The first function to apply.
 * @param ...fns The rest of the functions to apply.
 * @returns The result of applying the functions to the value.
 */
export function pipe<T, A>(value: T, f1: (arg: T) => A): A;
export function pipe<T, A, B>(value: T, f1: (arg: T) => A, f2: (arg: A) => B): B;
export function pipe<T, A, B, C>(value: T, f1: (arg: T) => A, f2: (arg: A) => B, f3: (arg: B) => C): C;
export function pipe<T, A, B, C, D>(
	value: T,
	f1: (arg: T) => A,
	f2: (arg: A) => B,
	f3: (arg: B) => C,
	f4: (arg: C) => D
): D;
export function pipe<T, A, B, C, D, E>(
	value: T,
	f1: (arg: T) => A,
	f2: (arg: A) => B,
	f3: (arg: B) => C,
	f4: (arg: C) => D,
	f5: (arg: D) => E
): E;
export function pipe<T, A, B, C, D, E, F>(
	value: T,
	f1: (arg: T) => A,
	f2: (arg: A) => B,
	f3: (arg: B) => C,
	f4: (arg: C) => D,
	f5: (arg: D) => E,
	f6: (arg: E) => F
): F;
export function pipe<T, A, B, C, D, E, F, G>(
	value: T,
	f1: (arg: T) => A,
	f2: (arg: A) => B,
	f3: (arg: B) => C,
	f4: (arg: C) => D,
	f5: (arg: D) => E,
	f6: (arg: E) => F,
	f7: (arg: F) => G
): G;
export function pipe<T, A, B, C, D, E, F, G, H>(
	value: T,
	f1: (arg: T) => A,
	f2: (arg: A) => B,
	f3: (arg: B) => C,
	f4: (arg: C) => D,
	f5: (arg: D) => E,
	f6: (arg: E) => F,
	f7: (arg: F) => G,
	f8: (arg: G) => H
): H;
export function pipe<T, A, B, C, D, E, F, G, H, I>(
	value: T,
	f1: (arg: T) => A,
	f2: (arg: A) => B,
	f3: (arg: B) => C,
	f4: (arg: C) => D,
	f5: (arg: D) => E,
	f6: (arg: E) => F,
	f7: (arg: F) => G,
	f8: (arg: G) => H,
	f9: (arg: H) => I
): I;
export function pipe<T, A, B, C, D, E, F, G, H, I, J>(
	value: T,
	f1: (arg: T) => A,
	f2: (arg: A) => B,
	f3: (arg: B) => C,
	f4: (arg: C) => D,
	f5: (arg: D) => E,
	f6: (arg: E) => F,
	f7: (arg: F) => G,
	f8: (arg: G) => H,
	f9: (arg: H) => I,
	f10: (arg: I) => J
): J;
export function pipe(value: any, ...fns: ((arg: any) => any)[]): any {
	return fns.reduce((acc, fn) => fn(acc), value);
}

/**
 * A pipe that works with async functions. Each function can return a Promise or a value, and each function is awaited synchronously before being called.
 * @param v The initial value.
 * @param f1 The first function to apply.
 * @param ...fns The rest of the functions to apply.
 * @returns The result of applying the functions to the value.
 */
export function pipeAsync<T, A>(v: MaybePromise<T>, f1: (arg: Awaited<T>) => MaybePromise<A>): Promise<A>;
export function pipeAsync<T, A, B>(
	v: MaybePromise<T>,
	f1: (arg: Awaited<T>) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>
): Promise<B>;
export function pipeAsync<T, A, B, C>(
	v: MaybePromise<T>,
	f1: (arg: Awaited<T>) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>,
	f3: (arg: Awaited<B>) => MaybePromise<C>
): Promise<C>;
export function pipeAsync<T, A, B, C, D>(
	v: MaybePromise<T>,
	f1: (arg: Awaited<T>) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>,
	f3: (arg: Awaited<B>) => MaybePromise<C>,
	f4: (arg: Awaited<C>) => MaybePromise<D>
): Promise<D>;
export function pipeAsync<T, A, B, C, D, E>(
	v: MaybePromise<T>,
	f1: (arg: Awaited<T>) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>,
	f3: (arg: Awaited<B>) => MaybePromise<C>,
	f4: (arg: Awaited<C>) => MaybePromise<D>,
	f5: (arg: Awaited<D>) => MaybePromise<E>
): Promise<E>;
export function pipeAsync<T, A, B, C, D, E, F>(
	v: MaybePromise<T>,
	f1: (arg: Awaited<T>) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>,
	f3: (arg: Awaited<B>) => MaybePromise<C>,
	f4: (arg: Awaited<C>) => MaybePromise<D>,
	f5: (arg: Awaited<D>) => MaybePromise<E>,
	f6: (arg: Awaited<E>) => MaybePromise<F>
): Promise<F>;
export function pipeAsync<T, A, B, C, D, E, F, G>(
	v: MaybePromise<T>,
	f1: (arg: Awaited<T>) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>,
	f3: (arg: Awaited<B>) => MaybePromise<C>,
	f4: (arg: Awaited<C>) => MaybePromise<D>,
	f5: (arg: Awaited<D>) => MaybePromise<E>,
	f6: (arg: Awaited<E>) => MaybePromise<F>,
	f7: (arg: Awaited<F>) => MaybePromise<G>
): Promise<G>;
export function pipeAsync<T, A, B, C, D, E, F, G, H>(
	v: MaybePromise<T>,
	f1: (arg: Awaited<T>) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>,
	f3: (arg: Awaited<B>) => MaybePromise<C>,
	f4: (arg: Awaited<C>) => MaybePromise<D>,
	f5: (arg: Awaited<D>) => MaybePromise<E>,
	f6: (arg: Awaited<E>) => MaybePromise<F>,
	f7: (arg: Awaited<F>) => MaybePromise<G>,
	f8: (arg: Awaited<G>) => MaybePromise<H>
): Promise<H>;
export function pipeAsync<T, A, B, C, D, E, F, G, H, I>(
	v: MaybePromise<T>,
	f1: (arg: Awaited<T>) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>,
	f3: (arg: Awaited<B>) => MaybePromise<C>,
	f4: (arg: Awaited<C>) => MaybePromise<D>,
	f5: (arg: Awaited<D>) => MaybePromise<E>,
	f6: (arg: Awaited<E>) => MaybePromise<F>,
	f7: (arg: Awaited<F>) => MaybePromise<G>,
	f8: (arg: Awaited<G>) => MaybePromise<H>,
	f9: (arg: Awaited<H>) => MaybePromise<I>
): Promise<I>;
export function pipeAsync<T, A, B, C, D, E, F, G, H, I, J>(
	v: MaybePromise<T>,
	f1: (arg: Awaited<T>) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>,
	f3: (arg: Awaited<B>) => MaybePromise<C>,
	f4: (arg: Awaited<C>) => MaybePromise<D>,
	f5: (arg: Awaited<D>) => MaybePromise<E>,
	f6: (arg: Awaited<E>) => MaybePromise<F>,
	f7: (arg: Awaited<F>) => MaybePromise<G>,
	f8: (arg: Awaited<G>) => MaybePromise<H>,
	f9: (arg: Awaited<H>) => MaybePromise<I>,
	f10: (arg: Awaited<I>) => MaybePromise<J>
): Promise<J>;
export async function pipeAsync(value: any, ...fns: ((arg: any) => any)[]): Promise<any> {
	let result = await value;
	for (const fn of fns) {
		result = await fn(result);
	}
	return result;
}

/**
 * Like pipe, but returns a function that can be called later with the initial value.
 * @param f1 The first function to apply.
 * @param ...fns The rest of the functions to apply.
 * @returns A function that will execute the pipe when called with the initial value.
 */
export function flow<T, A>(f1: (arg: T) => A): (arg: T) => A;
export function flow<T, A, B>(f1: (arg: T) => A, f2: (arg: A) => B): (arg: T) => B;
export function flow<T, A, B, C>(f1: (arg: T) => A, f2: (arg: A) => B, f3: (arg: B) => C): (arg: T) => C;
export function flow<T, A, B, C, D>(
	f1: (arg: T) => A,
	f2: (arg: A) => B,
	f3: (arg: B) => C,
	f4: (arg: C) => D
): (arg: T) => D;
export function flow<T, A, B, C, D, E>(
	f1: (arg: T) => A,
	f2: (arg: A) => B,
	f3: (arg: B) => C,
	f4: (arg: C) => D,
	f5: (arg: D) => E
): (arg: T) => E;
export function flow<T, A, B, C, D, E, F>(
	f1: (arg: T) => A,
	f2: (arg: A) => B,
	f3: (arg: B) => C,
	f4: (arg: C) => D,
	f5: (arg: D) => E,
	f6: (arg: E) => F
): (arg: T) => F;
export function flow<T, A, B, C, D, E, F, G>(
	f1: (arg: T) => A,
	f2: (arg: A) => B,
	f3: (arg: B) => C,
	f4: (arg: C) => D,
	f5: (arg: D) => E,
	f6: (arg: E) => F,
	f7: (arg: F) => G
): (arg: T) => G;
export function flow<T, A, B, C, D, E, F, G, H>(
	f1: (arg: T) => A,
	f2: (arg: A) => B,
	f3: (arg: B) => C,
	f4: (arg: C) => D,
	f5: (arg: D) => E,
	f6: (arg: E) => F,
	f7: (arg: F) => G,
	f8: (arg: G) => H
): (arg: T) => H;
export function flow<T, A, B, C, D, E, F, G, H, I>(
	f1: (arg: T) => A,
	f2: (arg: A) => B,
	f3: (arg: B) => C,
	f4: (arg: C) => D,
	f5: (arg: D) => E,
	f6: (arg: E) => F,
	f7: (arg: F) => G,
	f8: (arg: G) => H,
	f9: (arg: H) => I
): (arg: T) => I;
export function flow<T, A, B, C, D, E, F, G, H, I, J>(
	f1: (arg: T) => A,
	f2: (arg: A) => B,
	f3: (arg: B) => C,
	f4: (arg: C) => D,
	f5: (arg: D) => E,
	f6: (arg: E) => F,
	f7: (arg: F) => G,
	f8: (arg: G) => H,
	f9: (arg: H) => I,
	f10: (arg: I) => J
): (arg: T) => J;
export function flow(...fns: ((arg: any) => any)[]): (arg: any) => any {
	return (initialValue: any) => fns.reduce((acc, fn) => fn(acc), initialValue);
}

/**
 * Like flow, but for async functions.
 * @param f1 The first function to apply.
 * @param ...fns The rest of the functions to apply.
 * @returns A function that will execute the flow when called with the initial value.
 */
export function flowAsync<T, A>(f1: (arg: T) => MaybePromise<A>): (arg: T) => Promise<A>;
export function flowAsync<T, A, B>(
	f1: (arg: T) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>
): (arg: T) => Promise<B>;
export function flowAsync<T, A, B, C>(
	f1: (arg: T) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>,
	f3: (arg: Awaited<B>) => MaybePromise<C>
): (arg: T) => Promise<C>;
export function flowAsync<T, A, B, C, D>(
	f1: (arg: T) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>,
	f3: (arg: Awaited<B>) => MaybePromise<C>,
	f4: (arg: Awaited<C>) => MaybePromise<D>
): (arg: T) => Promise<D>;
export function flowAsync<T, A, B, C, D, E>(
	f1: (arg: T) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>,
	f3: (arg: Awaited<B>) => MaybePromise<C>,
	f4: (arg: Awaited<C>) => MaybePromise<D>,
	f5: (arg: Awaited<D>) => MaybePromise<E>
): (arg: T) => Promise<E>;
export function flowAsync<T, A, B, C, D, E, F>(
	f1: (arg: T) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>,
	f3: (arg: Awaited<B>) => MaybePromise<C>,
	f4: (arg: Awaited<C>) => MaybePromise<D>,
	f5: (arg: Awaited<D>) => MaybePromise<E>,
	f6: (arg: Awaited<E>) => MaybePromise<F>
): (arg: T) => Promise<F>;
export function flowAsync<T, A, B, C, D, E, F, G>(
	f1: (arg: T) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>,
	f3: (arg: Awaited<B>) => MaybePromise<C>,
	f4: (arg: Awaited<C>) => MaybePromise<D>,
	f5: (arg: Awaited<D>) => MaybePromise<E>,
	f6: (arg: Awaited<E>) => MaybePromise<F>,
	f7: (arg: Awaited<F>) => MaybePromise<G>
): (arg: T) => Promise<G>;
export function flowAsync<T, A, B, C, D, E, F, G, H>(
	f1: (arg: T) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>,
	f3: (arg: Awaited<B>) => MaybePromise<C>,
	f4: (arg: Awaited<C>) => MaybePromise<D>,
	f5: (arg: Awaited<D>) => MaybePromise<E>,
	f6: (arg: Awaited<E>) => MaybePromise<F>,
	f7: (arg: Awaited<F>) => MaybePromise<G>,
	f8: (arg: Awaited<G>) => MaybePromise<H>
): (arg: T) => Promise<H>;
export function flowAsync<T, A, B, C, D, E, F, G, H, I>(
	f1: (arg: T) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>,
	f3: (arg: Awaited<B>) => MaybePromise<C>,
	f4: (arg: Awaited<C>) => MaybePromise<D>,
	f5: (arg: Awaited<D>) => MaybePromise<E>,
	f6: (arg: Awaited<E>) => MaybePromise<F>,
	f7: (arg: Awaited<F>) => MaybePromise<G>,
	f8: (arg: Awaited<G>) => MaybePromise<H>,
	f9: (arg: Awaited<H>) => MaybePromise<I>
): (arg: T) => Promise<I>;
export function flowAsync<T, A, B, C, D, E, F, G, H, I, J>(
	f1: (arg: T) => MaybePromise<A>,
	f2: (arg: Awaited<A>) => MaybePromise<B>,
	f3: (arg: Awaited<B>) => MaybePromise<C>,
	f4: (arg: Awaited<C>) => MaybePromise<D>,
	f5: (arg: Awaited<D>) => MaybePromise<E>,
	f6: (arg: Awaited<E>) => MaybePromise<F>,
	f7: (arg: Awaited<F>) => MaybePromise<G>,
	f8: (arg: Awaited<G>) => MaybePromise<H>,
	f9: (arg: Awaited<H>) => MaybePromise<I>,
	f10: (arg: Awaited<I>) => MaybePromise<J>
): (arg: T) => Promise<J>;
export function flowAsync(...fns: ((arg: any) => any)[]): (arg: any) => Promise<any> {
	return async (initialValue: any) => {
		let result = initialValue;
		for (const fn of fns) {
			result = await fn(result);
		}
		return result;
	};
}
