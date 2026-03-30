import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('is.symbol (v2)', () => {
	it('basic symbol validation', () => {
		expect(is.symbol(Symbol())).toBe(true);
		expect(is.symbol(Symbol('foo'))).toBe(true);
		expect(is.symbol('foo')).toBe(false);
		expect(is.symbol(123)).toBe(false);
	});

	it('is.symbol.description', () => {
		expect(is.symbol.description('foo')(Symbol('foo'))).toBe(true);
		expect(is.symbol.description('foo')(Symbol('bar'))).toBe(false);
		expect(is.symbol.description(/fo/)(Symbol('foo'))).toBe(true);
		expect(is.symbol.description(/ba/)(Symbol('foo'))).toBe(false);
		expect(is.symbol.description('foo')(Symbol())).toBe(false);
	});

	it('is.symbol.registered', () => {
		const sym = Symbol.for('foo');
		const localSym = Symbol('foo');
		expect(is.symbol.registered(sym)).toBe(true);
		expect(is.symbol.registered(localSym)).toBe(false);
	});

	it('is.symbol.key', () => {
		const sym = Symbol.for('foo');
		expect(is.symbol.key('foo')(sym)).toBe(true);
		expect(is.symbol.key('bar')(sym)).toBe(false);
		expect(is.symbol.key('foo')(Symbol('foo'))).toBe(false);
	});

	it('is.symbol.wellKnown', () => {
		expect(is.symbol.wellKnown(Symbol.iterator)).toBe(true);
		expect(is.symbol.wellKnown(Symbol.asyncIterator)).toBe(true);
		expect(is.symbol.wellKnown(Symbol.toStringTag)).toBe(true);
		expect(is.symbol.wellKnown(Symbol('iterator'))).toBe(false);
	});
});
