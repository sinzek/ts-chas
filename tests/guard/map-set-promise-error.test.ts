/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect } from 'vitest';
import { is, type InferGuard } from '../../src/guard/index.js';

// ===========================================================================
// is.map
// ===========================================================================

describe('is.map', () => {
	describe('runtime', () => {
		it('accepts Map instances', () => {
			expect(is.map()(new Map())).toBe(true);
			expect(is.map()(new Map([['a', 1]]))).toBe(true);
		});

		it('rejects non-Maps', () => {
			expect(is.map()({})).toBe(false);
			expect(is.map()(null)).toBe(false);
			expect(is.map()([])).toBe(false);
			expect(is.map()('string')).toBe(false);
		});

		it('validates key types', () => {
			const guard = is.map(is.string, is.number);
			expect(
				guard(
					new Map([
						['a', 1],
						['b', 2],
					])
				)
			).toBe(true);
			expect(guard(new Map([[1, 2] as any]))).toBe(false); // number key
		});

		it('validates value types', () => {
			const guard = is.map(is.string, is.number);
			expect(guard(new Map([['a', 1]]))).toBe(true);
			expect(guard(new Map([['a', 'one'] as any]))).toBe(false); // string value
		});

		it('validates both key and value types', () => {
			const guard = is.map(is.number, is.string);
			const valid = new Map([
				[1, 'a'],
				[2, 'b'],
			]);
			const badKey = new Map([['a', 'b'] as any]);
			const badVal = new Map([[1, 2] as any]);
			expect(guard(valid)).toBe(true);
			expect(guard(badKey)).toBe(false);
			expect(guard(badVal)).toBe(false);
		});

		it('works with refined key guards (the motivating use case)', () => {
			const guard = is.map(is.number.lte(10), is.string);
			expect(
				guard(
					new Map([
						[1, 'a'],
						[5, 'b'],
					])
				)
			).toBe(true);
			expect(
				guard(
					new Map([
						[1, 'a'],
						[11, 'b'],
					])
				)
			).toBe(false);
		});
	});

	describe('helpers', () => {
		it('nonEmpty / empty', () => {
			expect(is.map().nonEmpty(new Map([['a', 1]]))).toBe(true);
			expect(is.map().nonEmpty(new Map())).toBe(false);
			expect(is.map().empty(new Map())).toBe(true);
			expect(is.map().empty(new Map([['a', 1]]))).toBe(false);
		});

		it('size / minSize / maxSize', () => {
			const m2 = new Map([
				['a', 1],
				['b', 2],
			]);
			expect(is.map().size(2)(m2)).toBe(true);
			expect(is.map().size(3)(m2)).toBe(false);
			expect(is.map().minSize(1)(m2)).toBe(true);
			expect(is.map().minSize(3)(m2)).toBe(false);
			expect(is.map().maxSize(3)(m2)).toBe(true);
			expect(is.map().maxSize(1)(m2)).toBe(false);
		});

		it('hasKey', () => {
			const m = new Map([
				['a', 1],
				['b', 2],
			]);
			expect(is.map().hasKey('a')(m)).toBe(true);
			expect(is.map().hasKey('c')(m)).toBe(false);
		});

		it('hasValue', () => {
			const m = new Map([
				['a', 1],
				['b', 2],
			]);
			expect(is.map().hasValue(1)(m)).toBe(true);
			expect(is.map().hasValue(3)(m)).toBe(false);
		});
	});

	describe('type narrowing', () => {
		it('narrows to Map<K, V>', () => {
			const guard = is.map(is.string, is.number);
			const value: unknown = new Map([['a', 1]]);
			if (guard(value)) {
				const narrowed: Map<string, number> = value;
				expect(narrowed.get('a')).toBe(1);
			}
		});

		it('InferGuard extracts Map type', () => {
			const guard = is.map(is.string, is.boolean);
			type T = InferGuard<typeof guard>;
			const check: T = new Map([['a', true]]);
			expect(check.get('a')).toBe(true);
		});
	});

	describe('universal helpers', () => {
		it('.parse() returns a Result', () => {
			const guard = is.map(is.string, is.number);
			expect(guard.parse(new Map([['a', 1]])).isOk()).toBe(true);
			expect(guard.parse('not a map').isErr()).toBe(true);
		});

		it('.nullable allows null', () => {
			const guard = is.map().nullable;
			expect(guard(null)).toBe(true);
			expect(guard(new Map())).toBe(true);
		});
	});

	describe('readonly', () => {
		it('narrows to readonly Map', () => {
			const guard = is.map(is.string, is.number).readonly;
			const value: unknown = new Map([['a', 1]]);
			if (guard(value)) {
				const narrowed: ReadonlyMap<string, number> = value;
				expect(narrowed.get('a')).toBe(1);
			}
		});
	});
});

// ===========================================================================
// is.set
// ===========================================================================

describe('is.set', () => {
	describe('runtime', () => {
		it('accepts Set instances', () => {
			expect(is.set()(new Set())).toBe(true);
			expect(is.set()(new Set([1, 2, 3]))).toBe(true);
		});

		it('rejects non-Sets', () => {
			expect(is.set()([])).toBe(false);
			expect(is.set()({})).toBe(false);
			expect(is.set()(null)).toBe(false);
		});

		it('validates value types', () => {
			const guard = is.set(is.number);
			expect(guard(new Set([1, 2, 3]))).toBe(true);
			expect(guard(new Set([1, 'two']))).toBe(false);
		});

		it('accepts empty sets with value guard', () => {
			const guard = is.set(is.string);
			expect(guard(new Set())).toBe(true);
		});
	});

	describe('helpers', () => {
		it('nonEmpty / empty', () => {
			expect(is.set().nonEmpty(new Set([1]))).toBe(true);
			expect(is.set().nonEmpty(new Set())).toBe(false);
			expect(is.set().empty(new Set())).toBe(true);
			expect(is.set().empty(new Set([1]))).toBe(false);
		});

		it('size / minSize / maxSize', () => {
			const s = new Set([1, 2, 3]);
			expect(is.set().size(3)(s)).toBe(true);
			expect(is.set().size(2)(s)).toBe(false);
			expect(is.set().minSize(2)(s)).toBe(true);
			expect(is.set().minSize(4)(s)).toBe(false);
			expect(is.set().maxSize(5)(s)).toBe(true);
			expect(is.set().maxSize(2)(s)).toBe(false);
		});

		it('has', () => {
			const s = new Set([1, 2, 3]);
			expect(is.set().has(1)(s)).toBe(true);
			expect(is.set().has(4)(s)).toBe(false);
		});

		it('subsetOf', () => {
			expect(is.set().subsetOf([1, 2, 3, 4])(new Set([1, 2]))).toBe(true);
			expect(is.set().subsetOf([1, 2])(new Set([1, 2, 3]))).toBe(false);
			// also works with Set as superset
			expect(is.set().subsetOf(new Set([1, 2, 3]))(new Set([1, 2]))).toBe(true);
		});

		it('supersetOf', () => {
			expect(is.set().supersetOf([1, 2])(new Set([1, 2, 3]))).toBe(true);
			expect(is.set().supersetOf([1, 2, 3])(new Set([1, 2]))).toBe(false);
		});

		it('disjointFrom', () => {
			expect(is.set().disjointFrom([4, 5])(new Set([1, 2, 3]))).toBe(true);
			expect(is.set().disjointFrom([2, 5])(new Set([1, 2, 3]))).toBe(false);
		});
	});

	describe('type narrowing', () => {
		it('narrows to Set<T>', () => {
			const guard = is.set(is.string);
			const value: unknown = new Set(['a', 'b']);
			if (guard(value)) {
				const narrowed: Set<string> = value;
				expect(narrowed.has('a')).toBe(true);
			}
		});
	});

	describe('universal helpers', () => {
		it('.parse() returns a Result', () => {
			const guard = is.set(is.number);
			expect(guard.parse(new Set([1, 2])).isOk()).toBe(true);
			expect(guard.parse([1, 2]).isErr()).toBe(true);
		});

		it('.nullable allows null', () => {
			const guard = is.set().nullable;
			expect(guard(null)).toBe(true);
			expect(guard(new Set())).toBe(true);
		});
	});

	describe('readonly', () => {
		it('narrows to readonly Set', () => {
			const guard = is.set(is.string).readonly;
			const value: unknown = new Set(['a', 'b']);
			if (guard(value)) {
				const narrowed: ReadonlySet<string> = value;
				expect(narrowed.has('a')).toBe(true);
			}
		});
	});
});

// ===========================================================================
// is.promise
// ===========================================================================

describe('is.promise', () => {
	it('accepts Promise instances', () => {
		expect(is.promise(Promise.resolve(42))).toBe(true);
		expect(is.promise(new Promise(() => {}))).toBe(true);
	});

	it('accepts thenables', () => {
		const thenable = { then: () => {}, catch: () => {} };
		expect(is.promise(thenable)).toBe(true);
	});

	it('rejects non-promises', () => {
		expect(is.promise(42)).toBe(false);
		expect(is.promise('string')).toBe(false);
		expect(is.promise(null)).toBe(false);
		expect(is.promise({})).toBe(false);
		expect(is.promise({ then: 'not a function' })).toBe(false);
	});

	it('narrows to Promise<unknown>', () => {
		const value: unknown = Promise.resolve('hello');
		if (is.promise(value)) {
			const narrowed: Promise<unknown> = value;
			expect(narrowed).toBeInstanceOf(Promise);
		}
	});

	it('.parse() returns a Result', () => {
		expect(is.promise.parse(Promise.resolve(1)).isOk()).toBe(true);
		expect(is.promise.parse(42).isErr()).toBe(true);
	});
});

// ===========================================================================
// is.error
// ===========================================================================

describe('is.error', () => {
	describe('runtime', () => {
		it('accepts Error instances', () => {
			expect(is.error(new Error('oops'))).toBe(true);
			expect(is.error(new TypeError('bad'))).toBe(true);
			expect(is.error(new RangeError('out'))).toBe(true);
		});

		it('rejects non-errors', () => {
			expect(is.error('string')).toBe(false);
			expect(is.error(null)).toBe(false);
			expect(is.error({})).toBe(false);
			expect(is.error({ message: 'fake' })).toBe(false);
		});
	});

	describe('helpers', () => {
		it('message (string contains)', () => {
			expect(is.error.message('oops')(new Error('oops happened'))).toBe(true);
			expect(is.error.message('oops')(new Error('all good'))).toBe(false);
		});

		it('message (regex)', () => {
			expect(is.error.message(/^oops/)(new Error('oops happened'))).toBe(true);
			expect(is.error.message(/^oops/)(new Error('it oops'))).toBe(false);
		});

		it('name', () => {
			expect(is.error.name('TypeError')(new TypeError('bad'))).toBe(true);
			expect(is.error.name('TypeError')(new Error('bad'))).toBe(false);
			expect(is.error.name('RangeError')(new RangeError('out'))).toBe(true);
		});

		it('hasCause', () => {
			const withCause = new Error('outer', { cause: new Error('inner') });
			const withoutCause = new Error('plain');
			expect(is.error.hasCause(withCause)).toBe(true);
			expect(is.error.hasCause(withoutCause)).toBe(false);
		});
	});

	describe('type narrowing', () => {
		it('narrows to Error', () => {
			const value: unknown = new TypeError('bad');
			if (is.error(value)) {
				const narrowed: Error = value;
				expect(narrowed.message).toBe('bad');
			}
		});
	});

	describe('universal helpers', () => {
		it('.parse() returns a Result', () => {
			expect(is.error.parse(new Error('oops')).isOk()).toBe(true);
			expect(is.error.parse('not error').isErr()).toBe(true);
		});

		it('.nullable allows null', () => {
			expect(is.error.nullable(null)).toBe(true);
			expect(is.error.nullable(new Error('oops'))).toBe(true);
		});
	});
});

// ===========================================================================
// is.map as solution to the record + number key problem
// ===========================================================================

describe('is.map solves the number key problem', () => {
	it('validates numeric keys (unlike is.record)', () => {
		const guard = is.map(is.number.lte(10), is.string);
		const valid = new Map([
			[1, 'hello'],
			[5, 'world'],
		]);
		const invalid = new Map([
			[1, 'hello'],
			[11, 'too high'],
		]);
		expect(guard(valid)).toBe(true);
		expect(guard(invalid)).toBe(false);
	});

	it('validates object keys', () => {
		const keyGuard = is.object({ id: is.number });
		const guard = is.map(keyGuard, is.string);
		const valid = new Map([[{ id: 1 }, 'a']]);
		expect(guard(valid)).toBe(true);
	});
});
