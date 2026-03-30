/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';
import type { InferGuard } from '../../src/guard/shared.js';

// ===========================================================================
// is.literal
// ===========================================================================

describe('is.literal', () => {
	describe('runtime', () => {
		it('accepts matching string literals', () => {
			const guard = is.literal('a', 'b', 'c');
			expect(guard('a')).toBe(true);
			expect(guard('b')).toBe(true);
			expect(guard('c')).toBe(true);
		});

		it('rejects non-matching strings', () => {
			const guard = is.literal('a', 'b', 'c');
			expect(guard('d')).toBe(false);
			expect(guard('')).toBe(false);
		});

		it('accepts matching number literals', () => {
			const guard = is.literal(1, 2, 3);
			expect(guard(1)).toBe(true);
			expect(guard(2)).toBe(true);
			expect(guard(3)).toBe(true);
		});

		it('rejects non-matching numbers', () => {
			const guard = is.literal(1, 2, 3);
			expect(guard(4)).toBe(false);
			expect(guard(0)).toBe(false);
		});

		it('supports mixed types', () => {
			const guard = is.literal(1, 'hello', true, null, undefined);
			expect(guard(1)).toBe(true);
			expect(guard('hello')).toBe(true);
			expect(guard(true)).toBe(true);
			expect(guard(null)).toBe(true);
			expect(guard(undefined)).toBe(true);
			expect(guard(false)).toBe(false);
			expect(guard(2)).toBe(false);
			expect(guard('world')).toBe(false);
		});

		it('supports bigint literals', () => {
			const guard = is.literal(1n, 2n);
			expect(guard(1n)).toBe(true);
			expect(guard(2n)).toBe(true);
			expect(guard(3n)).toBe(false);
			expect(guard(1)).toBe(false); // number 1 !== bigint 1n
		});

		it('uses Object.is for strict comparison (NaN)', () => {
			const guard = is.literal(NaN);
			expect(guard(NaN)).toBe(true);
			expect(guard(0)).toBe(false);
		});

		it('uses Object.is for strict comparison (0 vs -0)', () => {
			const guard = is.literal(0);
			expect(guard(0)).toBe(true);
			expect(guard(-0)).toBe(false);
		});

		it('rejects objects and arrays', () => {
			const guard = is.literal('a', 1);
			expect(guard({})).toBe(false);
			expect(guard([])).toBe(false);
			expect(guard({ a: 1 })).toBe(false);
		});
	});

	describe('type narrowing', () => {
		it('narrows to the union of provided string literals', () => {
			const guard = is.literal('a', 'b', 'c');
			const value: unknown = 'a';
			if (guard(value)) {
				const narrowed: 'a' | 'b' | 'c' = value;
				expect(narrowed).toBe('a');
			}
		});

		it('narrows to the union of provided number literals', () => {
			const guard = is.literal(1, 2, 3);
			const value: unknown = 2;
			if (guard(value)) {
				const narrowed: 1 | 2 | 3 = value;
				expect(narrowed).toBe(2);
			}
		});

		it('narrows to a mixed literal union', () => {
			const guard = is.literal(1, 'hello', true, null);
			const value: unknown = 'hello';
			if (guard(value)) {
				const narrowed: 1 | 'hello' | true | null = value;
				expect(narrowed).toBe('hello');
			}
		});

		it('narrows to bigint literal union', () => {
			const guard = is.literal(1n, 2n);
			const value: unknown = 1n;
			if (guard(value)) {
				const narrowed: 1n | 2n = value;
				expect(narrowed).toBe(1n);
			}
		});

		it('narrows a single literal to its exact type', () => {
			const guard = is.literal('only');
			const value: unknown = 'only';
			if (guard(value)) {
				const narrowed: 'only' = value;
				expect(narrowed).toBe('only');
			}
		});

		it('InferGuard extracts the literal union type', () => {
			const guard = is.literal('a', 'b', 42);
			type Narrowed = InferGuard<typeof guard>;
			const check: Narrowed = 'a' as 'a' | 'b' | 42;
			expect(check).toBe('a');
		});
	});

	describe('universal helpers', () => {
		it('.parse() returns a Result', () => {
			const guard = is.literal('a', 'b');
			expect(guard.parse('a').isOk()).toBe(true);
			expect(guard.parse('c').isErr()).toBe(true);
		});

		it('.or() composes with another guard', () => {
			const guard = is.literal('a', 'b').or(is.literal('c', 'd'));
			expect(guard('a')).toBe(true);
			expect(guard('c')).toBe(true);
			expect(guard('e')).toBe(false);
		});

		it('.nullable allows null', () => {
			const guard = is.literal('a', 'b').nullable;
			expect(guard(null)).toBe(true);
			expect(guard('a')).toBe(true);
			expect(guard('c')).toBe(false);
		});

		it('.optional allows undefined', () => {
			const guard = is.literal('a', 'b').optional;
			expect(guard(undefined)).toBe(true);
			expect(guard('a')).toBe(true);
			expect(guard('c')).toBe(false);
		});
	});
});

// ===========================================================================
// is.union
// ===========================================================================

describe('is.union', () => {
	describe('runtime', () => {
		it('accepts values matching any guard', () => {
			const guard = is.union(is.string, is.number, is.boolean);
			expect(guard('hello')).toBe(true);
			expect(guard(42)).toBe(true);
			expect(guard(true)).toBe(true);
			expect(guard(false)).toBe(true);
		});

		it('rejects values matching no guard', () => {
			const guard = is.union(is.string, is.number);
			expect(guard(null)).toBe(false);
			expect(guard(undefined)).toBe(false);
			expect(guard(true)).toBe(false);
			expect(guard({})).toBe(false);
			expect(guard([])).toBe(false);
		});

		it('works with object guards', () => {
			const guard = is.union(
				is.object({ type: is.literal('a'), value: is.string }),
				is.object({ type: is.literal('b'), value: is.number })
			);
			expect(guard({ type: 'a', value: 'hello' })).toBe(true);
			expect(guard({ type: 'b', value: 42 })).toBe(true);
			expect(guard({ type: 'a', value: 42 })).toBe(false);
			expect(guard({ type: 'c', value: 'x' })).toBe(false);
		});

		it('works with a single guard', () => {
			const guard = is.union(is.string);
			expect(guard('hello')).toBe(true);
			expect(guard(42)).toBe(false);
		});

		it('works with many guards', () => {
			const guard = is.union(is.string, is.number, is.boolean, is.null, is.undefined);
			expect(guard('a')).toBe(true);
			expect(guard(1)).toBe(true);
			expect(guard(true)).toBe(true);
			expect(guard(null)).toBe(true);
			expect(guard(undefined)).toBe(true);
			expect(guard({})).toBe(false);
		});
	});

	describe('type narrowing', () => {
		it('narrows to a union of primitive types', () => {
			const guard = is.union(is.string, is.number);
			const value: unknown = 'hello';
			if (guard(value)) {
				const narrowed: string | number = value;
				expect(narrowed).toBe('hello');
			}
		});

		it('narrows to a union of object types', () => {
			const guard = is.union(is.object({ a: is.string }), is.object({ b: is.number }));
			const value: unknown = { a: 'hello' };
			if (guard(value)) {
				// narrowed to { a: string } | { b: number }
				const narrowed: { a: string } | { b: number } = value;
				expect(narrowed).toEqual({ a: 'hello' });
			}
		});

		it('narrows to string | number | boolean', () => {
			const guard = is.union(is.string, is.number, is.boolean);
			const value: unknown = true;
			if (guard(value)) {
				const narrowed: string | number | boolean = value;
				expect(narrowed).toBe(true);
			}
		});

		it('InferGuard extracts the union type', () => {
			const guard = is.union(is.string, is.number);
			type Narrowed = InferGuard<typeof guard>;
			const check: Narrowed = 'hello' as string | number;
			expect(check).toBe('hello');
		});

		it('narrows discriminated union of objects', () => {
			const guard = is.union(
				is.object({ type: is.literal('circle'), radius: is.number }),
				is.object({ type: is.literal('rect'), width: is.number, height: is.number })
			);
			const value: unknown = { type: 'circle', radius: 5 };
			if (guard(value)) {
				const narrowed: { type: 'circle'; radius: number } | { type: 'rect'; width: number; height: number } =
					value;
				expect(narrowed).toEqual({ type: 'circle', radius: 5 });
			}
		});
	});

	describe('universal helpers', () => {
		it('.parse() returns a Result', () => {
			const guard = is.union(is.string, is.number);
			expect(guard.parse('hello').isOk()).toBe(true);
			expect(guard.parse(true).isErr()).toBe(true);
		});

		it('.nullable allows null', () => {
			const guard = is.union(is.string, is.number).nullable;
			expect(guard(null)).toBe(true);
			expect(guard('a')).toBe(true);
			expect(guard(true)).toBe(false);
		});

		it('.and() composes with another guard', () => {
			const guard = is.union(is.string, is.number).and(is.string);
			expect(guard('hello')).toBe(true);
			expect(guard(42)).toBe(false);
		});
	});
});

// ===========================================================================
// is.intersection
// ===========================================================================

describe('is.intersection', () => {
	describe('runtime', () => {
		it('accepts values matching all guards', () => {
			const guard = is.intersection(is.object({ a: is.string }), is.object({ b: is.number }));
			expect(guard({ a: 'hello', b: 42 })).toBe(true);
		});

		it('rejects values missing properties from any guard', () => {
			const guard = is.intersection(is.object({ a: is.string }), is.object({ b: is.number }));
			expect(guard({ a: 'hello' })).toBe(false);
			expect(guard({ b: 42 })).toBe(false);
			expect(guard({})).toBe(false);
		});

		it('rejects non-objects', () => {
			const guard = is.intersection(is.object({ a: is.string }), is.object({ b: is.number }));
			expect(guard(null)).toBe(false);
			expect(guard(undefined)).toBe(false);
			expect(guard('string')).toBe(false);
			expect(guard(42)).toBe(false);
		});

		it('works with three or more guards', () => {
			const guard = is.intersection(
				is.object({ a: is.string }),
				is.object({ b: is.number }),
				is.object({ c: is.boolean })
			);
			expect(guard({ a: 'x', b: 1, c: true })).toBe(true);
			expect(guard({ a: 'x', b: 1 })).toBe(false);
		});

		it('works with overlapping property guards', () => {
			const guard = is.intersection(is.object({ x: is.number }), is.object({ x: is.number, y: is.number }));
			expect(guard({ x: 1, y: 2 })).toBe(true);
			expect(guard({ x: 1 })).toBe(false);
		});

		it('accepts extra properties on the value', () => {
			const guard = is.intersection(is.object({ a: is.string }), is.object({ b: is.number }));
			expect(guard({ a: 'hello', b: 42, c: true })).toBe(true);
		});
	});

	describe('type narrowing', () => {
		it('narrows to the intersection of two object types', () => {
			const guard = is.intersection(is.object({ a: is.string }), is.object({ b: is.number }));
			const value: unknown = { a: 'hello', b: 42 };
			if (guard(value)) {
				const a: string = value.a;
				const b: number = value.b;
				expect(a).toBe('hello');
				expect(b).toBe(42);
			}
		});

		it('narrows to the intersection of three object types', () => {
			const guard = is.intersection(
				is.object({ a: is.string }),
				is.object({ b: is.number }),
				is.object({ c: is.boolean })
			);
			const value: unknown = { a: 'x', b: 1, c: true };
			if (guard(value)) {
				const a: string = value.a;
				const b: number = value.b;
				const c: boolean = value.c;
				expect(a).toBe('x');
				expect(b).toBe(1);
				expect(c).toBe(true);
			}
		});

		it('InferGuard extracts the intersection type', () => {
			const guard = is.intersection(is.object({ x: is.number }), is.object({ y: is.string }));
			type Narrowed = InferGuard<typeof guard>;
			const check: Narrowed = { x: 1, y: 'a' } as { x: number } & { y: string };
			expect(check.x).toBe(1);
			expect(check.y).toBe('a');
		});

		it('intersection with overlapping keys preserves the tighter type', () => {
			const guard = is.intersection(
				is.object({ x: is.number, label: is.string }),
				is.object({ x: is.number, y: is.number })
			);
			const value: unknown = { x: 1, y: 2, label: 'point' };
			if (guard(value)) {
				const x: number = value.x;
				const y: number = value.y;
				const label: string = value.label;
				expect(x).toBe(1);
				expect(y).toBe(2);
				expect(label).toBe('point');
			}
		});
	});

	describe('universal helpers', () => {
		it('.parse() returns a Result', () => {
			const guard = is.intersection(is.object({ a: is.string }), is.object({ b: is.number }));
			expect(guard.parse({ a: 'hello', b: 42 }).isOk()).toBe(true);
			expect(guard.parse({ a: 'hello' }).isErr()).toBe(true);
		});

		it('.nullable allows null', () => {
			const guard = is.intersection(is.object({ a: is.string }), is.object({ b: is.number })).nullable;
			expect(guard(null)).toBe(true);
			expect(guard({ a: 'x', b: 1 })).toBe(true);
			expect(guard({ a: 'x' })).toBe(false);
		});

		it('.or() composes with another guard', () => {
			const guard = is.intersection(is.object({ a: is.string }), is.object({ b: is.number })).or(is.null);
			expect(guard({ a: 'x', b: 1 })).toBe(true);
			expect(guard(null)).toBe(true);
			expect(guard('string')).toBe(false);
		});
	});
});

// ===========================================================================
// is.xor
// ===========================================================================

describe('is.xor', () => {
	describe('runtime', () => {
		it('accepts values matching exactly one guard', () => {
			const guard = is.xor(is.object({ a: is.string }), is.object({ b: is.number }));
			expect(guard({ a: 'hello' })).toBe(true);
			expect(guard({ b: 42 })).toBe(true);
		});

		it('rejects values matching multiple guards', () => {
			const guard = is.xor(is.object({ a: is.string }), is.object({ b: is.number }));
			expect(guard({ a: 'hello', b: 42 })).toBe(false);
		});

		it('rejects values matching no guards', () => {
			const guard = is.xor(is.object({ a: is.string }), is.object({ b: is.number }));
			expect(guard({ c: true })).toBe(false);
			expect(guard(null)).toBe(false);
			expect(guard('string')).toBe(false);
		});

		it('works with primitive guards', () => {
			const guard = is.xor(is.string, is.number, is.boolean);
			expect(guard('hello')).toBe(true);
			expect(guard(42)).toBe(true);
			expect(guard(true)).toBe(true);
			expect(guard(null)).toBe(false);
			expect(guard(undefined)).toBe(false);
		});

		it('works with two guards', () => {
			const guard = is.xor(is.string, is.number);
			expect(guard('a')).toBe(true);
			expect(guard(1)).toBe(true);
			expect(guard(true)).toBe(false);
		});

		it('rejects when overlapping object guards both match', () => {
			const guard = is.xor(is.object({ x: is.number }), is.object({ x: is.number, y: is.number }));
			// { x: 1, y: 2 } matches both guards
			expect(guard({ x: 1, y: 2 })).toBe(false);
			// { x: 1 } matches only the first (second requires y)
			expect(guard({ x: 1 })).toBe(true);
		});

		it('works with discriminated unions via literal fields', () => {
			const guard = is.xor(
				is.object({ type: is.literal('a'), value: is.string }),
				is.object({ type: is.literal('b'), value: is.number })
			);
			expect(guard({ type: 'a', value: 'hello' })).toBe(true);
			expect(guard({ type: 'b', value: 42 })).toBe(true);
			expect(guard({ type: 'c', value: true })).toBe(false);
		});

		it('short-circuits after second match', () => {
			let thirdCalled = false;
			const third = is.string.where(() => {
				thirdCalled = true;
				return true;
			});
			const guard = is.xor(is.string, is.string, third);
			expect(guard('hello')).toBe(false);
			expect(thirdCalled).toBe(false);
		});
	});

	describe('type narrowing', () => {
		it('narrows to the union of guard types', () => {
			const guard = is.xor(is.string, is.number);
			const value: unknown = 'hello';
			if (guard(value)) {
				const narrowed: string | number = value;
				expect(narrowed).toBe('hello');
			}
		});

		it('narrows to a union of object types', () => {
			const guard = is.xor(is.object({ a: is.string }), is.object({ b: is.number }));
			const value: unknown = { a: 'hello' };
			if (guard(value)) {
				const narrowed: { a: string } | { b: number } = value;
				expect(narrowed).toEqual({ a: 'hello' });
			}
		});

		it('InferGuard extracts the union type', () => {
			const guard = is.xor(is.string, is.number, is.boolean);
			type Narrowed = InferGuard<typeof guard>;
			const check: Narrowed = 'hello' as string | number | boolean;
			expect(check).toBe('hello');
		});
	});

	describe('universal helpers', () => {
		it('.parse() returns a Result', () => {
			const guard = is.xor(is.string, is.number);
			expect(guard.parse('hello').isOk()).toBe(true);
			expect(guard.parse(true).isErr()).toBe(true);
		});

		it('.nullable allows null', () => {
			const guard = is.xor(is.string, is.number).nullable;
			expect(guard(null)).toBe(true);
			expect(guard('a')).toBe(true);
			expect(guard(true)).toBe(false);
		});

		it('.optional allows undefined', () => {
			const guard = is.xor(is.string, is.number).optional;
			expect(guard(undefined)).toBe(true);
			expect(guard(42)).toBe(true);
			expect(guard(true)).toBe(false);
		});

		it('.error() customizes error message', () => {
			const guard = is.xor(is.string, is.number).error('must be exactly one');
			const result = guard.parse(true);
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.message).toContain('must be exactly one');
			}
		});
	});
});

// ===========================================================================
// Cross-guard composition
// ===========================================================================

describe('composition across literal, union, intersection', () => {
	it('literal inside union', () => {
		const guard = is.union(is.literal('a', 'b'), is.number);
		expect(guard('a')).toBe(true);
		expect(guard('b')).toBe(true);
		expect(guard(42)).toBe(true);
		expect(guard('c')).toBe(false);

		const value: unknown = 'a';
		if (guard(value)) {
			const narrowed: 'a' | 'b' | number = value;
			expect(narrowed).toBe('a');
		}
	});

	it('intersection with literal fields', () => {
		const guard = is.intersection(
			is.object({ type: is.literal('user') }),
			is.object({ name: is.string, age: is.number })
		);
		expect(guard({ type: 'user', name: 'Alice', age: 30 })).toBe(true);
		expect(guard({ type: 'admin', name: 'Bob', age: 25 })).toBe(false);

		const value: unknown = { type: 'user', name: 'Alice', age: 30 };
		if (guard(value)) {
			const type: 'user' = value.type;
			const name: string = value.name;
			const age: number = value.age;
			expect(type).toBe('user');
			expect(name).toBe('Alice');
			expect(age).toBe(30);
		}
	});

	it('union of intersections (tagged union pattern)', () => {
		const guard = is.union(
			is.intersection(is.object({ kind: is.literal('circle') }), is.object({ radius: is.number })),
			is.intersection(is.object({ kind: is.literal('rect') }), is.object({ width: is.number, height: is.number }))
		);

		expect(guard({ kind: 'circle', radius: 5 })).toBe(true);
		expect(guard({ kind: 'rect', width: 10, height: 20 })).toBe(true);
		expect(guard({ kind: 'circle', width: 10 })).toBe(false);
		expect(guard({ kind: 'rect', radius: 5 })).toBe(false);
	});
});
