import { describe, it, expect } from 'vitest';
import { is, type Guard, type InferGuard } from '../../src/guard/index.js';

describe('is.lazy()', () => {
	it('validates a non-recursive guard via thunk', () => {
		const guard = is.lazy(() => is.string);
		expect(guard('hello')).toBe(true);
		expect(guard(123)).toBe(false);
	});

	it('resolves the thunk lazily (not at construction time)', () => {
		let called = 0;
		const _guard = is.lazy(() => {
			called++;
			return is.number;
		});
		expect(called).toBe(0); // thunk not yet called
		_guard(42);
		expect(called).toBe(1);
		_guard(99);
		expect(called).toBe(1); // cached — not called again
	});

	it('supports recursive types (tree)', () => {
		type Node = { value: number; children: Node[] };

		const NodeGuard: Guard<Node> = is.object({
			value: is.number,
			children: is.lazy(() => is.array(NodeGuard)),
		});

		expect(NodeGuard({ value: 1, children: [] })).toBe(true);
		expect(NodeGuard({ value: 1, children: [{ value: 2, children: [] }] })).toBe(true);
		expect(
			NodeGuard({ value: 1, children: [{ value: 2, children: [{ value: 3, children: [] }] }] })
		).toBe(true);
		// Invalid: leaf has wrong type in children
		expect(NodeGuard({ value: 1, children: [{ value: 'bad', children: [] }] })).toBe(false);
		// Invalid: not an array
		expect(NodeGuard({ value: 1, children: 'nope' })).toBe(false);
	});

	it('infers the correct type from the thunk return', () => {
		const guard = is.lazy(() => is.number.positive);
		type T = InferGuard<typeof guard>;
		const n: T = 5; // should be number
		expect(guard(n)).toBe(true);
	});

	it('works with .parse()', () => {
		type Node = { value: number; children: Node[] };

		const NodeGuard: Guard<Node> = is.object({
			value: is.number,
			children: is.lazy(() => is.array(NodeGuard)),
		});

		const result = NodeGuard.parse({ value: 1, children: [] });
		expect(result.isOk()).toBe(true);

		const bad = NodeGuard.parse({ value: 'x', children: [] });
		expect(bad.isErr()).toBe(true);
	});
});
