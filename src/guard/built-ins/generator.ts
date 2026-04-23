import { makeGuard, transformer, terminal, type Guard, type InferGuard } from '../shared.js';
import { AsyncGuard } from '../async.js';

export interface GeneratorHelpers {
	/**
	 * Iterates over the generator to dynamically validate every element.
	 *
	 * **Warning**: Generators are stateful! This completely consumes the generator.
	 * If the generator is infinite, this guard will hang indefinitely.
	 */
	of: <G extends Guard<any>>(
		innerGuard: G
	) => Guard<Generator<InferGuard<G>, unknown, unknown>, GeneratorHelpers>;
}

const generatorHelpers: GeneratorHelpers = {
	of: transformer((target: Guard<any>, innerGuard: Guard<any>) => ({
		fn: (v: unknown): v is Generator<any, unknown, unknown> => {
			if (!target(v)) return false;
			for (const item of v as Generator<any, unknown, unknown>) {
				if (!innerGuard(item)) return false;
			}
			return true;
		},
		meta: { name: `${target.meta.name}.of(${innerGuard.meta.name})` },
	})) as any,
};

export interface GeneratorGuard extends Guard<Generator<unknown, unknown, unknown>, GeneratorHelpers> {}

export const GeneratorGuard: GeneratorGuard = makeGuard(
	(v: unknown): v is Generator<unknown, unknown, unknown> =>
		v != null &&
		typeof (v as any).next === 'function' &&
		typeof (v as any).throw === 'function' &&
		typeof (v as any)[Symbol.iterator] === 'function',
	{ name: 'generator', id: 'generator' },
	generatorHelpers as any
);

export interface AsyncGeneratorHelpers {
	/**
	 * Iterates over the async generator to dynamically validate every element.
	 *
	 * Returns an `AsyncGuard` requiring `.parseAsync()`.
	 *
	 * **Warning**: Generators are stateful! This completely consumes the generator.
	 * If the generator is infinite, this guard will hang indefinitely.
	 */
	of: <G extends Guard<any>>(
		innerGuard: G
	) => AsyncGuard<AsyncGenerator<InferGuard<G>, unknown, unknown>>;
}

const asyncGeneratorHelpers: AsyncGeneratorHelpers = {
	of: terminal((target: Guard<any>, innerGuard: Guard<any>) => {
		return new AsyncGuard(target, []).whereAsync(async (v: unknown) => {
			for await (const item of v as AsyncGenerator<any, unknown, unknown>) {
				if (!innerGuard(item)) return false;
			}
			return true;
		});
	}) as any,
};

export interface AsyncGeneratorGuard extends Guard<AsyncGenerator<unknown, unknown, unknown>, AsyncGeneratorHelpers> {}

export const AsyncGeneratorGuard: AsyncGeneratorGuard = makeGuard(
	(v: unknown): v is AsyncGenerator<unknown, unknown, unknown> =>
		v != null &&
		typeof (v as any).next === 'function' &&
		typeof (v as any).throw === 'function' &&
		typeof (v as any)[Symbol.asyncIterator] === 'function',
	{ name: 'asyncGenerator', id: 'asyncGenerator' },
	asyncGeneratorHelpers as any
);
