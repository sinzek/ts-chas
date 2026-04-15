import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';
import { Prettify } from '../../src/utils.js';

describe('is.discriminatedUnion()', () => {
	const ShapeGuard = is.discriminatedUnion('kind', {
		circle: is.object({ radius: is.number }),
		square: is.object({ side: is.number }),
		rectangle: is.object({ width: is.number, height: is.number }),
	});

	// ---- basic acceptance ---------------------------------------------------

	it('accepts valid circle', () => {
		expect(ShapeGuard({ kind: 'circle', radius: 5 })).toBe(true);
	});

	it('accepts valid square', () => {
		expect(ShapeGuard({ kind: 'square', side: 10 })).toBe(true);
	});

	it('accepts valid rectangle', () => {
		expect(ShapeGuard({ kind: 'rectangle', width: 4, height: 6 })).toBe(true);
	});

	// ---- rejection ---------------------------------------------------------

	it('rejects a value with an unknown discriminant', () => {
		expect(ShapeGuard({ kind: 'triangle', base: 3, height: 4 })).toBe(false);
	});

	it('rejects a value with a missing discriminant key', () => {
		expect(ShapeGuard({ radius: 5 })).toBe(false);
	});

	it('rejects a value where the variant shape is invalid', () => {
		expect(ShapeGuard({ kind: 'circle', radius: 'big' })).toBe(false);
	});

	it('rejects non-objects', () => {
		expect(ShapeGuard(null)).toBe(false);
		expect(ShapeGuard(42)).toBe(false);
		expect(ShapeGuard('circle')).toBe(false);
		expect(ShapeGuard(undefined)).toBe(false);
	});

	it('rejects when variant shape has missing required fields', () => {
		expect(ShapeGuard({ kind: 'rectangle', width: 4 })).toBe(false); // height missing
	});

	// ---- meta ---------------------------------------------------------------

	it('stores variant keys in meta.values', () => {
		expect(ShapeGuard.meta.values).toEqual(new Set(['circle', 'square', 'rectangle']));
	});

	it('has a descriptive meta.name', () => {
		expect(ShapeGuard.meta.name).toBe('discriminatedUnion<kind: circle | square | rectangle>');
	});

	it('has id = "discriminatedUnion"', () => {
		expect(ShapeGuard.meta.id).toBe('discriminatedUnion');
	});

	// ---- composition -------------------------------------------------------

	it('works with .parse()', () => {
		const ok = ShapeGuard.parse({ kind: 'circle', radius: 5 });
		expect(ok.isOk()).toBe(true);
		expect(ok.unwrap()).toEqual({ kind: 'circle', radius: 5 });

		const bad = ShapeGuard.parse({ kind: 'circle', radius: 'big' });
		expect(bad.isErr()).toBe(true);
	});

	it('works with .nullable', () => {
		const guard = ShapeGuard.nullable;
		expect(guard(null)).toBe(true);
		expect(guard({ kind: 'circle', radius: 1 })).toBe(true);
		expect(guard({ kind: 'unknown' })).toBe(false);
	});

	it('works with .or()', () => {
		const guard = ShapeGuard.or(is.string);
		expect(guard('hello')).toBe(true);
		expect(guard({ kind: 'square', side: 3 })).toBe(true);
		expect(guard(42)).toBe(false);
	});

	// ---- type inference ----------------------------------------------------

	it('infers the correct discriminated union type', () => {
		type Shape = Prettify<typeof ShapeGuard.$infer>;

		// TypeScript should narrow correctly in switch
		const val = { kind: 'circle', radius: 5 } as Shape;
		if (val.kind === 'circle') {
			const _r: number = val.radius; // should compile
			expect(_r).toBe(5);
		}
	});

	// ---- edge cases --------------------------------------------------------

	it('handles a single variant', () => {
		const guard = is.discriminatedUnion('type', {
			only: is.object({ name: is.string }),
		});
		expect(guard({ type: 'only', name: 'Alice' })).toBe(true);
		expect(guard({ type: 'other', name: 'Alice' })).toBe(false);
	});

	it('ignores extra keys on the value (non-strict variants)', () => {
		// Extra keys beyond the variant shape are allowed since guards are non-strict by default
		expect(ShapeGuard({ kind: 'circle', radius: 5, extra: true })).toBe(true);
	});
});
