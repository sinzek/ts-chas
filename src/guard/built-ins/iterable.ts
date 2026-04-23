import { makeGuard, transformer, terminal, type Guard, type InferGuard } from '../shared.js';
import { AsyncGuard } from '../async.js';

export interface IterableHelpers {
	/**
	 * Iterates over the iterable to dynamically validate every element.
	 *
	 * **Warning**: This consumes generic generator streams, and if the iterable is infinite,
	 * this guard will hang indefinitely. Use with caution on unstructured iterables.
	 */
	of: <G extends Guard<any>>(innerGuard: G) => Guard<Iterable<InferGuard<G>>>;
}

const iterableHelpers: IterableHelpers = {
	of: transformer((target: Guard<any>, innerGuard: Guard<any>) => ({
		fn: (v: unknown): v is Iterable<any> => {
			if (!target(v)) return false;
			for (const item of v as Iterable<any>) {
				if (!innerGuard(item)) return false;
			}
			return true;
		},
		meta: { name: `${target.meta.name}.of(${innerGuard.meta.name})` },
		replaceHelpers: true,
		helpers: {},
	})) as any,
};

export interface IterableGuard extends Guard<Iterable<unknown>, IterableHelpers> {}

export const IterableGuard: IterableGuard = makeGuard(
	(v: unknown): v is Iterable<unknown> => v != null && typeof (v as any)[Symbol.iterator] === 'function',
	{ name: 'iterable', id: 'iterable' },
	iterableHelpers
);

export interface AsyncIterableHelpers {
	/**
	 * Iterates over the async iterable to validate every element asynchronously.
	 *
	 * Returns an `AsyncGuard` that requires calling `.parseAsync()`.
	 *
	 * **Warning**: This consumes generator streams, and if the iterable is infinite,
	 * this guard will hang indefinitely. Use with caution.
	 */
	of: <G extends Guard<any>>(innerGuard: G) => AsyncGuard<AsyncIterable<InferGuard<G>>>;
}

const asyncIterableHelpers: AsyncIterableHelpers = {
	of: terminal((target: Guard<any>, innerGuard: Guard<any>) => {
		// target is already bound to AsyncIterable via sync predicate wrapper.
		// We add whereAsync via AsyncGuard instantiation to consume the underlying stream asynchronously.
		return new AsyncGuard(target, []).whereAsync(async (v: unknown) => {
			for await (const item of v as AsyncIterable<any>) {
				if (!innerGuard(item)) return false;
			}
			return true;
		});
	}) as any,
};

export interface AsyncIterableGuard extends Guard<AsyncIterable<unknown>, AsyncIterableHelpers> {}

export const AsyncIterableGuard: AsyncIterableGuard = makeGuard(
	(v: unknown): v is AsyncIterable<unknown> => v != null && typeof (v as any)[Symbol.asyncIterator] === 'function',
	{ name: 'asyncIterable', id: 'asyncIterable' },
	asyncIterableHelpers as any
);
