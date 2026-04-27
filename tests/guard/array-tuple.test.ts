import { describe, it, expect, expectTypeOf } from 'vitest';
import { is, type InferGuard, type Guard } from '../../src/guard/index.js';

describe('is.array (v2)', () => {
	it('basic array validation', () => {
		const example = is.array(is.number, is.string);
		expect(example([1, 2, 3, 'a'])).toBe(true);
		expect(is.array()([])).toBe(true);
		expect(is.array()({})).toBe(false);
		expect(is.array()(null)).toBe(false);
	});

	it('array with element guard', () => {
		const guard = is.array(is.string);
		expect(guard(['a', 'b'])).toBe(true);
		expect(guard(['a', 1])).toBe(false);
	});

	describe('Refinements', () => {
		it('nonEmpty / empty', () => {
			expect(is.array().nonEmpty([1])).toBe(true);
			expect(is.array().nonEmpty([])).toBe(false);
			expect(is.array().empty([])).toBe(true);
			expect(is.array().empty([1])).toBe(false);
		});

		it('unique', () => {
			expect(is.array(is.number).unique([1, 2, 3])).toBe(true);
			expect(is.array(is.number).unique([1, 2, 1])).toBe(false);
		});

		it('min / max / size', () => {
			expect(is.array(is.number, is.string).min(2)([1, 2])).toBe(true);
			expect(is.array(is.number).min(2)([1])).toBe(false);
			expect(is.array(is.number).max(2)([1, 2])).toBe(true);
			expect(is.array(is.number).max(2)([1, 2, 3])).toBe(false);
			expect(is.array(is.number).size(2)([1, 2])).toBe(true);
			expect(is.array(is.number).size(2)([1, 2, 3])).toBe(false);
		});

		it('includes / excludes', () => {
			expect(is.array(is.number).includes(1)([1, 2])).toBe(true);
			expect(is.array().includes(3)([1, 2])).toBe(false);
			expect(is.array().excludes(3)([1, 2])).toBe(true);
			expect(is.array().excludes(1)([1, 2])).toBe(false);
		});
	});

	describe('.array universal helper', () => {
		it('is.string.array validates string arrays', () => {
			expect(is.string.array(['a', 'b', 'c'])).toBe(true);
			expect(is.string.array(['a', 1])).toBe(false);
			expect(is.string.array([])).toBe(true);
			expect(is.string.array('not array')).toBe(false);
		});

		it('is.number.array validates number arrays', () => {
			expect(is.number.array([1, 2, 3])).toBe(true);
			expect(is.number.array([1, 'two'])).toBe(false);
		});

		it('chains with refinements', () => {
			expect(is.number.positive.array([1, 2, 3])).toBe(true);
			expect(is.number.positive.array([1, -2, 3])).toBe(false);
		});

		it('is.boolean.array validates boolean arrays', () => {
			expect(is.boolean.array([true, false])).toBe(true);
			expect(is.boolean.array([true, 1])).toBe(false);
		});

		it('narrows to T[]', () => {
			const value: unknown = ['a', 'b'];
			if (is.string.array(value)) {
				const narrowed: string[] = value;
				expect(narrowed).toEqual(['a', 'b']);
			}
		});

		it('.parse() works', () => {
			expect(is.string.array.parse(['a', 'b']).isOk()).toBe(true);
			expect(is.string.array.parse([1, 2]).isErr()).toBe(true);
		});

		it('has array helpers (min, max, nonEmpty, etc.)', () => {
			expect(is.string.array.nonEmpty(['a'])).toBe(true);
			expect(is.string.array.nonEmpty([])).toBe(false);
			expect(is.string.array.min(2)(['a', 'b', 'c'])).toBe(true);
			expect(is.string.array.min(2)(['a'])).toBe(false);
			expect(is.string.array.max(2)(['a'])).toBe(true);
			expect(is.string.array.max(2)(['a', 'b', 'c'])).toBe(false);
			expect(is.string.array.size(2)(['a', 'b'])).toBe(true);
			expect(is.string.array.unique(['a', 'b'])).toBe(true);
			expect(is.string.array.unique(['a', 'a'])).toBe(false);
			expect(is.number.array.includes(1)([1, 2, 3])).toBe(true);
			expect(is.number.array.excludes(4)([1, 2, 3])).toBe(true);
		});

		it('works on object guards', () => {
			const guard = is.object({ x: is.number }).array;
			expect(guard([{ x: 1 }, { x: 2 }])).toBe(true);
			expect(guard([{ x: 1 }, { x: 'two' }])).toBe(false);
			expect(guard({ x: 1 })).toBe(false); // not an array
		});
	});

	describe('Chaining & Universal', () => {
		it('should chain refinements', () => {
			const guard = is.array(is.number).min(2).unique;
			expect(guard([1, 2])).toBe(true);
			expect(guard([1, 2, 1])).toBe(false); // not unique
			expect(guard([1])).toBe(false); // too short
		});

		it('nullable / optional', () => {
			expect(is.array().nullable(null)).toBe(true);
			expect(is.array().optional(undefined)).toBe(true);
		});

		it('or', () => {
			expect(is.array().or(is.string)([])).toBe(true);
			expect(is.array().or(is.string)('foo')).toBe(true);
		});

		it('parse', () => {
			const res = is.array().min(2).parse([1]);
			expect(res.isErr()).toBe(true);
			if (res.isErr()) {
				expect(res.error._tag).toBe('GuardErr');
				expect(res.error.actual).toBe('array');
			}
		});
	});

	describe('readonly', () => {
		it('basic readonly array validation', () => {
			const guard = is.array().readonly;
			expect(guard([1, 2, 3])).toBe(true);
			expect(guard([1, 2, 3])).toBe(true);
		});

		it('narrows to readonly T[]', () => {
			const value: unknown = [1, 2, 3];
			if (is.array(is.number).readonly(value)) {
				const narrowed: readonly number[] = value;
				expect(narrowed).toEqual([1, 2, 3]);
			}
		});
	});

	describe('is.tuple', () => {
		it('basic tuple validation', () => {
			const guard = is.tuple([is.string, is.number]);
			expect(guard(['a', 1])).toBe(true);
			expect(guard(['a', 1, 2])).toBe(false);
			expect(guard(['a'])).toBe(false);
			expect(guard([1, 'a'])).toBe(false);
			expect(guard(null)).toBe(false);
			expect(guard(undefined)).toBe(false);
			expect(guard({})).toBe(false);
		});
	});

	describe('is.tuple array helpers', () => {
		it('supports .nonEmpty()', () => {
			const guard = is.tuple([is.string]).nonEmpty;
			expect(guard(['a'])).toBe(true);
			// Note: is.tuple([]) would already fail on length, so .nonEmpty is mostly useful for variadic tuples
			const variadic = is.tuple([], is.string).nonEmpty;
			expect(variadic(['a'])).toBe(true);
			expect(variadic([])).toBe(false);
		});

		it('supports .min() / .max()', () => {
			const guard = is.tuple([is.string], is.number).min(3);
			expect(guard(['a', 1, 2])).toBe(true);
			expect(guard(['a', 1])).toBe(false);

			const capped = is.tuple([is.string], is.number).max(2);
			expect(capped(['a', 1])).toBe(true);
			expect(capped(['a', 1, 2])).toBe(false);
		});

		it('supports .unique', () => {
			const guard = is.tuple([is.number, is.number]).unique;
			expect(guard([1, 2])).toBe(true);
			expect(guard([1, 1])).toBe(false);
		});

		it('supports .includes() / .excludes()', () => {
			const guard = is.tuple([is.string, is.number]).includes('a');
			expect(guard(['a', 1])).toBe(true);
			expect(guard(['b', 1])).toBe(false);

			const ex = is.tuple([is.string, is.number]).excludes(1);
			expect(ex(['a', 2])).toBe(true);
			expect(ex(['a', 1])).toBe(false);
		});

		it('preserves tuple type after refinements (type check)', () => {
			const guard = is.tuple([is.string, is.number]).min(1);
			const value: unknown = ['a', 1];
			if (guard(value)) {
				// This line would fail to compile if the type collapsed to (string | number)[]
				const [s, n]: [string, number] = value;
				expect(typeof s).toBe('string');
				expect(typeof n).toBe('number');
			}
		});
	});

	describe('Type-level inference', () => {
		it('is.array() infers unknown[]', () => {
			const g = is.array();
			expectTypeOf<InferGuard<typeof g>>().toEqualTypeOf<unknown[]>();
		});

		it('is.array(is.number) infers number[]', () => {
			const g = is.array(is.number);
			expectTypeOf<InferGuard<typeof g>>().toEqualTypeOf<number[]>();
		});

		it('is.array(is.string, is.number) infers (string | number)[]', () => {
			const g = is.array(is.string, is.number);
			expectTypeOf<InferGuard<typeof g>>().toEqualTypeOf<(string | number)[]>();
		});

		it('is.string.array infers string[] with array helpers', () => {
			expectTypeOf<InferGuard<typeof is.string.array>>().toEqualTypeOf<string[]>();
			expectTypeOf<InferGuard<typeof is.number.array>>().toEqualTypeOf<number[]>();
			expectTypeOf<InferGuard<typeof is.boolean.array>>().toEqualTypeOf<boolean[]>();
		});

		it('refinements on element guards persist through .array', () => {
			const g = is.number.positive.array;
			expectTypeOf<InferGuard<typeof g>>().toEqualTypeOf<number[]>();
			expect(g([1, 2, 3])).toBe(true);
			expect(g([1, -2, 3])).toBe(false);
		});

		it('is.array(...).readonly infers readonly T[]', () => {
			const g = is.array(is.number).readonly;
			type T = InferGuard<typeof g>;
			const v: T = [1, 2, 3] as const;
			expectTypeOf(v).toMatchTypeOf<readonly number[]>();
		});

		it('is.tuple infers exact positional types', () => {
			const g = is.tuple([is.string, is.number, is.boolean]);
			expectTypeOf<InferGuard<typeof g>>().toEqualTypeOf<[string, number, boolean]>();
		});

		it('is.tuple with rest infers [...fixed, ...rest[]]', () => {
			const g = is.tuple([is.string, is.number], is.boolean);

			type G = typeof g.$infer;

			expectTypeOf<InferGuard<typeof g>>().toEqualTypeOf<[string, number, ...boolean[]]>();
		});

		it('is.tuple([]) is the empty tuple', () => {
			const g = is.tuple([]);
			expectTypeOf<InferGuard<typeof g>>().toEqualTypeOf<[]>();
		});

		it('is.tuple([], rest) is variadic with no fixed prefix', () => {
			const g = is.tuple([], is.string);
			expectTypeOf<InferGuard<typeof g>>().toEqualTypeOf<string[]>();
		});

		it('refinements preserve tuple type (no collapse to T[number][])', () => {
			const g = is.tuple([is.string, is.number]).min(1).unique;
			type T = InferGuard<typeof g>;
			expectTypeOf<T>().toEqualTypeOf<[string, number]>();
			const v: T = ['x', 1];
			const [s, n] = v;
			expectTypeOf(s).toEqualTypeOf<string>();
			expectTypeOf(n).toEqualTypeOf<number>();
		});

		it('Guard.parse returns Result<T[], GuardErr> for arrays', () => {
			const g: Guard<number[]> = is.array(is.number);
			const result = g.parse([1, 2, 3]);
			if (result.isOk()) {
				expectTypeOf(result.value).toEqualTypeOf<number[]>();
			}
		});

		it('nested array of objects infers correctly', () => {
			const g = is.array(is.object({ id: is.string, count: is.number }));
			type T = InferGuard<typeof g>;
			const v: T = [
				{ id: 'a', count: 1 },
				{ id: 'b', count: 2 },
			];
			expectTypeOf(v[0]!.id).toEqualTypeOf<string>();
			expectTypeOf(v[0]!.count).toEqualTypeOf<number>();
		});

		it('array of arrays infers nested element type', () => {
			const g = is.array(is.array(is.number));
			type T = InferGuard<typeof g>;
			expectTypeOf<T>().toEqualTypeOf<number[][]>();
		});
	});

	describe('Complex array runtime cases', () => {
		it('validates array of objects with deep refinements', () => {
			const guard = is
				.array(
					is.object({
						id: is.string.uuid(),
						tags: is.array(is.string).max(5),
						meta: is.object({ score: is.number.between(0, 100) }).optional,
					})
				)
				.min(1);

			expect(
				guard([
					{
						id: '11111111-1111-4111-8111-111111111111',
						tags: ['a', 'b'],
						meta: { score: 50 },
					},
				])
			).toBe(true);

			expect(
				guard([
					{
						id: 'not-a-uuid',
						tags: ['a'],
					},
				])
			).toBe(false);

			expect(
				guard([
					{
						id: '11111111-1111-4111-8111-111111111111',
						tags: ['a', 'b'],
						meta: { score: 150 }, // out of range
					},
				])
			).toBe(false);

			expect(guard([])).toBe(false); // min(1)
		});

		it('supports recursive array shapes via is.lazy', () => {
			type Node = { name: string; children: Node[] };
			const NodeGuard: Guard<Node> = is.object({
				name: is.string,
				children: is.lazy(() => is.array(NodeGuard)),
			});

			expect(
				NodeGuard({
					name: 'root',
					children: [
						{ name: 'a', children: [] },
						{ name: 'b', children: [{ name: 'c', children: [] }] },
					],
				})
			).toBe(true);

			expect(
				NodeGuard({
					name: 'root',
					children: [{ name: 42 as any, children: [] }],
				})
			).toBe(false);
		});

		it('.unique on primitives rejects duplicates', () => {
			expect(is.array(is.number).unique([1, 2, 3])).toBe(true);
			expect(is.array(is.number).unique([1, 2, 1])).toBe(false);
			expect(is.array(is.string).unique(['a', 'a'])).toBe(false);
			expect(is.array().unique([true, false, 1, 'x'])).toBe(true);
		});

		it('.includes / .excludes work with primitives', () => {
			const includes = is.array(is.number).includes(42);
			expect(includes([1, 42, 3])).toBe(true);
			expect(includes([1, 2, 3])).toBe(false);

			const excludes = is.array(is.number).excludes(0);
			expect(excludes([1, 2, 3])).toBe(true);
			expect(excludes([0, 1, 2])).toBe(false);
		});

		it('.min().max() compose and reject out-of-range lengths', () => {
			const guard = is.array(is.number).min(2).max(4);
			expect(guard([1])).toBe(false);
			expect(guard([1, 2])).toBe(true);
			expect(guard([1, 2, 3, 4])).toBe(true);
			expect(guard([1, 2, 3, 4, 5])).toBe(false);
		});

		it('chained refinement order does not affect result', () => {
			const a = is.array(is.number).min(2).unique.includes(1);
			const b = is.array(is.number).includes(1).min(2).unique;
			const probes: unknown[] = [[1, 2], [1, 1], [2, 3], [1], [1, 2, 3]];
			for (const v of probes) expect(a(v)).toBe(b(v));
		});

		it('coerce on the element guard transforms each element on parse', () => {
			// Element-level coerce is the right place: is.array(is.number.coerce)
			// transforms each element; is.array(is.number).coerce only coerces the
			// array container itself (which doesn't apply to a real array input).
			const guard = is.array(is.number.coerce);
			const result = guard.parse(['1', '2', '3']);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toEqual([1, 2, 3]);
			}
		});

		it('rejects non-arrays uniformly', () => {
			const guard = is.array(is.number);
			for (const v of [null, undefined, 0, 'arr', { 0: 1, 1: 2, length: 2 }, new Set([1, 2])]) {
				expect(guard(v)).toBe(false);
			}
		});

		it('.readonly narrows to readonly at the type level (does not freeze at runtime)', () => {
			// .readonly is a type-level guarantee — the runtime value is the parsed
			// array, unfrozen. Callers who need a frozen runtime value must wrap
			// with `Object.freeze()` themselves.
			const guard = is.array(is.number).readonly;
			const result = guard.parse([1, 2, 3]);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toEqual([1, 2, 3]);
				expectTypeOf(result.value).toEqualTypeOf<readonly number[]>();
			}
		});
	});

	describe('Complex tuple runtime cases', () => {
		it('rejects tuples of wrong length', () => {
			const guard = is.tuple([is.string, is.number]);
			expect(guard(['a', 1])).toBe(true);
			expect(guard(['a'])).toBe(false);
			expect(guard(['a', 1, 'extra'])).toBe(false);
			expect(guard([])).toBe(false);
		});

		it('rejects tuples of wrong positional types', () => {
			const guard = is.tuple([is.string, is.number, is.boolean]);
			expect(guard(['a', 1, true])).toBe(true);
			expect(guard([1, 'a', true])).toBe(false);
			expect(guard(['a', 1, 'true'])).toBe(false);
		});

		it('variadic tuple accepts trailing rest of correct type', () => {
			const guard = is.tuple([is.string], is.number);
			expect(guard(['a'])).toBe(true);
			expect(guard(['a', 1])).toBe(true);
			expect(guard(['a', 1, 2, 3])).toBe(true);
			expect(guard(['a', 1, 'x'])).toBe(false); // last is not a number
			expect(guard([])).toBe(false); // missing fixed prefix
		});

		it('variadic with empty fixed prefix behaves like an open-ended array', () => {
			const guard = is.tuple([], is.string);
			expect(guard([])).toBe(true);
			expect(guard(['a', 'b'])).toBe(true);
			expect(guard(['a', 1])).toBe(false);
		});

		it('nested tuples of objects', () => {
			const guard = is.tuple([is.object({ name: is.string }), is.tuple([is.number, is.number])]);
			expect(guard([{ name: 'p' }, [1, 2]])).toBe(true);
			expect(guard([{ name: 'p' }, [1, '2']])).toBe(false);
			expect(guard([{ name: 1 }, [1, 2]])).toBe(false);
		});

		it('tuple with refined element guards (e.g. is.string.email)', () => {
			const guard = is.tuple([is.string.email, is.number.positive]);
			expect(guard(['a@b.com', 1])).toBe(true);
			expect(guard(['not-email', 1])).toBe(false);
			expect(guard(['a@b.com', 0])).toBe(false);
		});

		it('.size on a tuple is redundant but consistent with declared length', () => {
			const t = is.tuple([is.string, is.number]).size(2);
			expect(t(['x', 1])).toBe(true);
			// size(3) on a length-2 tuple can never pass.
			const impossible = is.tuple([is.string, is.number]).size(3);
			expect(impossible(['x', 1])).toBe(false);
			expect(impossible(['x', 1, 'y'] as any)).toBe(false);
		});

		it('.unique on a tuple rejects duplicate elements', () => {
			const guard = is.tuple([is.number, is.number, is.number]).unique;
			expect(guard([1, 2, 3])).toBe(true);
			expect(guard([1, 1, 2])).toBe(false);
		});

		it('.includes / .excludes apply to tuple elements', () => {
			const inc = is.tuple([is.string, is.string]).includes('admin');
			expect(inc(['user', 'admin'])).toBe(true);
			expect(inc(['user', 'guest'])).toBe(false);

			const exc = is.tuple([is.number, is.number]).excludes(0);
			expect(exc([1, 2])).toBe(true);
			expect(exc([0, 2])).toBe(false);
		});

		it('rejects non-arrays uniformly', () => {
			const guard = is.tuple([is.string, is.number]);
			for (const v of [null, undefined, 'a', 1, {}, { 0: 'a', 1: 1, length: 2 }]) {
				expect(guard(v)).toBe(false);
			}
		});

		it('parse() returns the typed tuple unchanged', () => {
			const guard = is.tuple([is.string, is.number]);
			const result = guard.parse(['a', 1]);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				const [s, n] = result.value;
				expect(s).toBe('a');
				expect(n).toBe(1);
				expectTypeOf(result.value).toEqualTypeOf<[string, number]>();
			}
		});
	});

	describe('JSON Schema export sanity', () => {
		it('is.array(T) emits {type: array, items: T}', () => {
			const schema = is.array(is.number).toJsonSchema();
			expect(schema).toMatchObject({ type: 'array', items: { type: 'number' } });
		});

		it('is.array(...).min().max() emits length bounds', () => {
			const schema = is.array(is.string).min(1).max(10).toJsonSchema();
			expect(schema).toMatchObject({ type: 'array', minItems: 1, maxItems: 10 });
		});

		it('is.tuple emits prefixItems with fixed length bounds', () => {
			const schema = is.tuple([is.string, is.number]).toJsonSchema();
			expect(schema).toMatchObject({
				type: 'array',
				minItems: 2,
				maxItems: 2,
			});
			expect((schema as any).prefixItems).toHaveLength(2);
		});

		it('variadic tuple emits prefixItems + items for the rest type', () => {
			const schema = is.tuple([is.string], is.number).toJsonSchema();
			expect(schema).toMatchObject({
				type: 'array',
				minItems: 1,
				items: { type: 'number' },
			});
			expect((schema as any).prefixItems).toHaveLength(1);
			// No maxItems on variadic tuples.
			expect((schema as any).maxItems).toBeUndefined();
		});
	});
});
