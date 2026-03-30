import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';
import type { InferGuard } from '../../src/guard/shared.js';

// ===========================================================================
// is.templateLiteral
// ===========================================================================

describe('is.templateLiteral', () => {
	describe('string + is.string interpolation', () => {
		it('matches a simple prefix + string pattern', () => {
			const guard = is.templateLiteral('hello, ', is.string, '!');
			expect(guard('hello, world!')).toBe(true);
			expect(guard('hello, !')).toBe(true); // empty string matches
			expect(guard('hello, anyone!')).toBe(true);
		});

		it('rejects non-matching strings', () => {
			const guard = is.templateLiteral('hello, ', is.string, '!');
			expect(guard('goodbye, world!')).toBe(false);
			expect(guard('hello, world')).toBe(false); // missing !
			expect(guard('hello world!')).toBe(false); // missing comma+space
		});

		it('rejects non-string values', () => {
			const guard = is.templateLiteral('id-', is.string);
			expect(guard(42)).toBe(false);
			expect(guard(null)).toBe(false);
			expect(guard(undefined)).toBe(false);
			expect(guard({})).toBe(false);
			expect(guard(true)).toBe(false);
		});
	});

	describe('string + is.number interpolation', () => {
		it('matches number interpolations', () => {
			const guard = is.templateLiteral('id-', is.number);
			expect(guard('id-42')).toBe(true);
			expect(guard('id-0')).toBe(true);
			expect(guard('id-3.14')).toBe(true);
			expect(guard('id--5')).toBe(true); // negative
		});

		it('rejects non-numeric interpolations', () => {
			const guard = is.templateLiteral('id-', is.number);
			expect(guard('id-abc')).toBe(false);
			expect(guard('id-')).toBe(false);
		});

		it('validates number refinements', () => {
			const guard = is.templateLiteral('port:', is.number.positive.int);
			expect(guard('port:8080')).toBe(true);
			expect(guard('port:0')).toBe(false); // not positive
			expect(guard('port:-1')).toBe(false); // negative
			expect(guard('port:3.14')).toBe(false); // not integer
		});
	});

	describe('string + is.boolean interpolation', () => {
		it('matches boolean interpolations', () => {
			const guard = is.templateLiteral('debug=', is.boolean);
			expect(guard('debug=true')).toBe(true);
			expect(guard('debug=false')).toBe(true);
		});

		it('rejects non-boolean strings', () => {
			const guard = is.templateLiteral('debug=', is.boolean);
			expect(guard('debug=yes')).toBe(false);
			expect(guard('debug=1')).toBe(false);
			expect(guard('debug=')).toBe(false);
		});
	});

	describe('string + is.bigint interpolation', () => {
		it('matches bigint interpolations', () => {
			const guard = is.templateLiteral('big-', is.bigint);
			expect(guard('big-42')).toBe(true);
			expect(guard('big-0')).toBe(true);
			expect(guard('big--99')).toBe(true);
		});

		it('rejects non-bigint strings', () => {
			const guard = is.templateLiteral('big-', is.bigint);
			expect(guard('big-3.14')).toBe(false);
			expect(guard('big-abc')).toBe(false);
		});
	});

	describe('string + is.literal interpolation', () => {
		it('matches literal values', () => {
			const guard = is.templateLiteral(is.literal('get', 'post'), '://', is.string);
			expect(guard('get://example.com')).toBe(true);
			expect(guard('post://api.test')).toBe(true);
		});

		it('rejects non-matching literals', () => {
			const guard = is.templateLiteral(is.literal('get', 'post'), '://', is.string);
			expect(guard('delete://example.com')).toBe(false);
			expect(guard('put://example.com')).toBe(false);
		});
	});

	describe('string + is.enum interpolation', () => {
		it('matches enum values', () => {
			const methods = is.enum(['GET', 'POST', 'PUT'] as const);
			const guard = is.templateLiteral(methods, ' /api/', is.string);
			expect(guard('GET /api/users')).toBe(true);
			expect(guard('POST /api/items')).toBe(true);
			expect(guard('PUT /api/data')).toBe(true);
		});

		it('rejects non-matching enum values', () => {
			const methods = is.enum(['GET', 'POST'] as const);
			const guard = is.templateLiteral(methods, ' /api/', is.string);
			expect(guard('DELETE /api/users')).toBe(false);
		});
	});

	describe('is.null and is.undefined interpolation', () => {
		it('matches null interpolation', () => {
			const guard = is.templateLiteral('value:', is.null);
			expect(guard('value:null')).toBe(true);
			expect(guard('value:undefined')).toBe(false);
		});

		it('matches undefined interpolation', () => {
			const guard = is.templateLiteral('value:', is.undefined);
			expect(guard('value:undefined')).toBe(true);
			expect(guard('value:null')).toBe(false);
		});
	});

	describe('multiple interpolations', () => {
		it('matches multiple guards in sequence', () => {
			const guard = is.templateLiteral(is.string, ':', is.number);
			expect(guard('host:8080')).toBe(true);
			expect(guard('localhost:3000')).toBe(true);
			expect(guard(':42')).toBe(true); // empty string prefix
		});

		it('matches three interpolations', () => {
			const guard = is.templateLiteral(is.number, '.', is.number, '.', is.number);
			expect(guard('1.2.3')).toBe(true);
			expect(guard('10.20.30')).toBe(true);
		});

		it('static-only template (no guards)', () => {
			const guard = is.templateLiteral('exact-match');
			expect(guard('exact-match')).toBe(true);
			expect(guard('other')).toBe(false);
		});

		it('guard-only template (no static strings)', () => {
			const guard = is.templateLiteral(is.number);
			expect(guard('42')).toBe(true);
			expect(guard('abc')).toBe(false);
		});
	});

	describe('type narrowing', () => {
		it('narrows to template literal type with string interpolation', () => {
			const guard = is.templateLiteral('hello, ', is.string, '!');
			type T = InferGuard<typeof guard>;
			// T should be `hello, ${string}!`
			const value: unknown = 'hello, world!';
			if (guard(value)) {
				const narrowed: T = value;
				expect(narrowed).toBe('hello, world!');
			}
		});

		it('narrows to template literal type with number interpolation', () => {
			const guard = is.templateLiteral('id-', is.number);
			type T = InferGuard<typeof guard>;
			// T should be `id-${number}`
			const value: unknown = 'id-42';
			if (guard(value)) {
				const narrowed: T = value;
				expect(narrowed).toBe('id-42');
			}
		});

		it('narrows to template literal type with boolean interpolation', () => {
			const guard = is.templateLiteral('flag=', is.boolean);
			type T = InferGuard<typeof guard>;
			// T should be `flag=${boolean}`
			const value: unknown = 'flag=true';
			if (guard(value)) {
				const narrowed: T = value;
				expect(narrowed).toBe('flag=true');
			}
		});

		it('narrows to template literal type with literal interpolation', () => {
			const guard = is.templateLiteral(is.literal('a', 'b'), '-suffix');
			type T = InferGuard<typeof guard>;
			// T should be `a-suffix` | `b-suffix`
			const value: unknown = 'a-suffix';
			if (guard(value)) {
				const narrowed: T = value;
				expect(narrowed).toBe('a-suffix');
			}
		});

		it('narrows static-only template to the literal string', () => {
			const guard = is.templateLiteral('exact');
			type T = InferGuard<typeof guard>;
			// T should be `exact`
			const value: unknown = 'exact';
			if (guard(value)) {
				const narrowed: T = value;
				expect(narrowed).toBe('exact');
			}
		});
	});

	describe('universal helpers', () => {
		it('.parse() returns a Result', () => {
			const guard = is.templateLiteral('id-', is.number);
			expect(guard.parse('id-42').isOk()).toBe(true);
			expect(guard.parse('id-abc').isErr()).toBe(true);
		});

		it('.nullable allows null', () => {
			const guard = is.templateLiteral('id-', is.number).nullable;
			expect(guard(null)).toBe(true);
			expect(guard('id-42')).toBe(true);
		});

		it('.optional allows undefined', () => {
			const guard = is.templateLiteral('id-', is.number).optional;
			expect(guard(undefined)).toBe(true);
			expect(guard('id-42')).toBe(true);
		});

		it('.error() customizes error message', () => {
			const guard = is.templateLiteral('id-', is.number).error('must be an id');
			const result = guard.parse('bad');
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.message).toContain('must be an id');
			}
		});

		it('.or() composes with another guard', () => {
			const guard = is.templateLiteral('id-', is.number).or(is.null);
			expect(guard('id-42')).toBe(true);
			expect(guard(null)).toBe(true);
			expect(guard('bad')).toBe(false);
		});
	});

	describe('meta', () => {
		it('has correct meta name', () => {
			const guard = is.templateLiteral('hello, ', is.string, '!');
			expect(guard.meta.name).toContain('templateLiteral');
			expect(guard.meta.id).toBe('templateLiteral');
		});
	});

	describe('edge cases', () => {
		it('handles special regex characters in static parts', () => {
			const guard = is.templateLiteral('price: $', is.number, '.00');
			expect(guard('price: $42.00')).toBe(true);
			expect(guard('price: $0.00')).toBe(true);
			expect(guard('price: 42.00')).toBe(false);
		});

		it('handles parentheses and brackets in static parts', () => {
			const guard = is.templateLiteral('[', is.number, ']');
			expect(guard('[42]')).toBe(true);
			expect(guard('[0]')).toBe(true);
			expect(guard('42')).toBe(false);
		});

		it('empty template matches empty string', () => {
			const guard = is.templateLiteral();
			expect(guard('')).toBe(true);
			expect(guard('anything')).toBe(false);
		});
	});
});
