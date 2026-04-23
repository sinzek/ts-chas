import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

enum Direction {
	Up,
	Down,
}

describe('is.enum (v2)', () => {
	it('validates from array', () => {
		const guard = is.enum(['red', 'green', 'blue']);
		expect(guard('red')).toBe(true);
		expect(guard('yellow')).toBe(false);
		expect(guard.meta.name).toBe('enum<"red" | "green" | "blue">');
	});

	it('validates from plain object (using keys for name)', () => {
		const Fish = { Salmon: 0, Tuna: 1 } as const;
		const guard = is.enum(Fish);
		expect(guard(0)).toBe(true);
		expect(guard(1)).toBe(true);
		expect(guard(2)).toBe(false);
		expect(guard.meta.name).toBe('enum<Salmon | Tuna>');
	});

	it('validates from TS numeric enum (filtering reverse mapping)', () => {
		// Direction = { Up: 0, Down: 1, 0: 'Up', 1: 'Down' }
		const guard = is.enum(Direction);
		expect(guard(0)).toBe(true);
		expect(guard(1)).toBe(true);
		expect(guard('Up')).toBe(false); // Should NOT include reverse mapping values
		expect(guard.meta.name).toBe('enum<Up | Down>');
	});

	it('validates from TS string enum', () => {
		enum Color {
			Red = 'RED',
			Blue = 'BLUE',
		}
		const guard = is.enum(Color);
		expect(guard('RED')).toBe(true);
		expect(guard('BLUE')).toBe(true);
		expect(guard('Red')).toBe(false);
		expect(guard.meta.name).toBe('enum<Red | Blue>');
	});

	describe('helpers', () => {
		it('exclude', () => {
			const guard = is.enum(['a', 'b', 'c']).exclude('a', 'b');
			expect(guard('c')).toBe(true);
			expect(guard('a')).toBe(false);
			expect(guard.meta.name).toBe('enum<"a" | "b" | "c">.exclude("a", "b")');
		});

		it('extract', () => {
			const guard = is.enum(['a', 'b', 'c']).extract('a', 'b');
			expect(guard('a')).toBe(true);
			expect(guard('c')).toBe(false);
			expect(guard.meta.name).toBe('enum<"a" | "b" | "c">.extract("a", "b")');
		});
	});

	it('works with objects', () => {
		const example = is.enum([1, 2, 3]);
		const example2 = is.object({
			example: is.enum([1, 2, 3]),
			example2: is.enum(Direction),
			example3: is.enum({ a: 1, b: 2 }),
		});
		expect(example2({ example: 1, example2: Direction.Up, example3: 1 })).toBe(true);
		expect(example2({ example: 1, example2: 0, example3: 2 })).toBe(true);
	});
});
