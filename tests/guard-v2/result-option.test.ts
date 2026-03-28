import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/guard-v2.js';
import { ok, err } from '../../src/result.js';
import { some, none } from '../../src/option.js';

// ---------------------------------------------------------------------------
// is.result
// ---------------------------------------------------------------------------

describe('is.result', () => {
	it('accepts Ok results', () => {
		expect(is.result(ok(42))).toBe(true);
		expect(is.result(ok('hello'))).toBe(true);
		expect(is.result(ok(null))).toBe(true);
	});

	it('accepts Err results', () => {
		expect(is.result(err('fail'))).toBe(true);
		expect(is.result(err(new Error('oops')))).toBe(true);
	});

	it('rejects non-results', () => {
		expect(is.result('hello')).toBe(false);
		expect(is.result(42)).toBe(false);
		expect(is.result(null)).toBe(false);
		expect(is.result(undefined)).toBe(false);
		expect(is.result({})).toBe(false);
		expect(is.result({ ok: true })).toBe(false); // structural mimic but no methods
		expect(is.result({ ok: true, value: 42 })).toBe(false);
	});

	it('has correct meta', () => {
		expect(is.result.meta.name).toBe('result');
		expect(is.result.meta.id).toBe('result');
	});

	it('.parse() returns Ok for valid results', () => {
		const r = is.result.parse(ok(42));
		expect(r.isOk()).toBe(true);
	});

	it('.parse() returns Err for non-results', () => {
		const r = is.result.parse('nope');
		expect(r.isErr()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// is.result.ok
// ---------------------------------------------------------------------------

describe('is.result.ok', () => {
	it('accepts Ok results', () => {
		expect(is.result.ok(ok(42))).toBe(true);
		expect(is.result.ok(ok('hello'))).toBe(true);
	});

	it('rejects Err results', () => {
		expect(is.result.ok(err('fail'))).toBe(false);
	});

	it('rejects non-results', () => {
		expect(is.result.ok('hello')).toBe(false);
		expect(is.result.ok(42)).toBe(false);
		expect(is.result.ok(null)).toBe(false);
	});

	it('has correct meta', () => {
		expect(is.result.ok.meta.name).toBe('result.ok');
	});
});

// ---------------------------------------------------------------------------
// is.result.err
// ---------------------------------------------------------------------------

describe('is.result.err', () => {
	it('accepts Err results', () => {
		expect(is.result.err(err('fail'))).toBe(true);
		expect(is.result.err(err(42))).toBe(true);
	});

	it('rejects Ok results', () => {
		expect(is.result.err(ok(42))).toBe(false);
	});

	it('rejects non-results', () => {
		expect(is.result.err('hello')).toBe(false);
		expect(is.result.err(null)).toBe(false);
	});

	it('has correct meta', () => {
		expect(is.result.err.meta.name).toBe('result.err');
	});
});

// ---------------------------------------------------------------------------
// is.result.okOf
// ---------------------------------------------------------------------------

describe('is.result.okOf', () => {
	it('validates the inner value type', () => {
		expect(is.result.okOf(is.number)(ok(42))).toBe(true);
		expect(is.result.okOf(is.string)(ok(42))).toBe(false);
		expect(is.result.okOf(is.string)(ok('hello'))).toBe(true);
	});

	it('rejects Err results regardless of error type', () => {
		expect(is.result.okOf(is.number)(err(42))).toBe(false);
	});

	it('rejects non-results', () => {
		expect(is.result.okOf(is.number)(42)).toBe(false);
	});

	it('works with complex guards', () => {
		const guard = is.result.okOf(is.object({ name: is.string }));
		expect(guard(ok({ name: 'Chase' }))).toBe(true);
		expect(guard(ok({ name: 123 }))).toBe(false);
		expect(guard(ok('hello'))).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// is.result.errOf
// ---------------------------------------------------------------------------

describe('is.result.errOf', () => {
	it('validates the inner error type', () => {
		expect(is.result.errOf(is.string)(err('fail'))).toBe(true);
		expect(is.result.errOf(is.number)(err('fail'))).toBe(false);
		expect(is.result.errOf(is.number)(err(42))).toBe(true);
	});

	it('rejects Ok results regardless of value type', () => {
		expect(is.result.errOf(is.string)(ok('hello'))).toBe(false);
	});

	it('rejects non-results', () => {
		expect(is.result.errOf(is.string)('fail')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// is.result.of
// ---------------------------------------------------------------------------

describe('is.result.of', () => {
	it('validates both Ok value and Err error types', () => {
		const guard = is.result.of(is.number, is.string);
		expect(guard(ok(42))).toBe(true);
		expect(guard(err('fail'))).toBe(true);
		expect(guard(ok('hello'))).toBe(false);
		expect(guard(err(42))).toBe(false);
	});

	it('rejects non-results', () => {
		const guard = is.result.of(is.number, is.string);
		expect(guard(42)).toBe(false);
		expect(guard('hello')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// is.result.ok.valueIs
// ---------------------------------------------------------------------------

describe('is.result.ok.valueIs', () => {
	it('validates the inner value after narrowing to Ok', () => {
		expect(is.result.ok.valueIs(is.number)(ok(42))).toBe(true);
		expect(is.result.ok.valueIs(is.string)(ok(42))).toBe(false);
	});

	it('rejects Err results', () => {
		expect(is.result.ok.valueIs(is.number)(err(42))).toBe(false);
	});

	it('rejects non-results', () => {
		expect(is.result.ok.valueIs(is.number)(42)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// is.result.err.errorIs
// ---------------------------------------------------------------------------

describe('is.result.err.errorIs', () => {
	it('validates the inner error after narrowing to Err', () => {
		expect(is.result.err.errorIs(is.string)(err('fail'))).toBe(true);
		expect(is.result.err.errorIs(is.number)(err('fail'))).toBe(false);
	});

	it('rejects Ok results', () => {
		expect(is.result.err.errorIs(is.string)(ok('hello'))).toBe(false);
	});

	it('rejects non-results', () => {
		expect(is.result.err.errorIs(is.string)('fail')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// is.result universal helpers
// ---------------------------------------------------------------------------

describe('is.result universal helpers', () => {
	it('.where() works on result guards', () => {
		const okWithValue = is.result.where(r => (r as any).ok === true);
		expect(okWithValue(ok(42))).toBe(true);
		expect(okWithValue(err('x'))).toBe(false);
	});

	it('.nullable works', () => {
		expect(is.result.nullable(null)).toBe(true);
		expect(is.result.nullable(ok(42))).toBe(true);
		expect(is.result.nullable('nope')).toBe(false);
	});

	it('.optional works', () => {
		expect(is.result.optional(undefined)).toBe(true);
		expect(is.result.optional(ok(42))).toBe(true);
	});
});

// ===========================================================================
// is.option
// ===========================================================================

describe('is.option', () => {
	it('accepts Some options', () => {
		expect(is.option(some(42))).toBe(true);
		expect(is.option(some('hello'))).toBe(true);
	});

	it('accepts None options', () => {
		expect(is.option(none())).toBe(true);
	});

	it('accepts ok/err as Options (structural compatibility)', () => {
		// Options are Results under the hood, ok() and err() have isSome/isNone
		expect(is.option(ok(42))).toBe(true);
	});

	it('rejects non-options', () => {
		expect(is.option('hello')).toBe(false);
		expect(is.option(42)).toBe(false);
		expect(is.option(null)).toBe(false);
		expect(is.option(undefined)).toBe(false);
		expect(is.option({})).toBe(false);
	});

	it('has correct meta', () => {
		expect(is.option.meta.name).toBe('option');
		expect(is.option.meta.id).toBe('option');
	});

	it('.parse() works', () => {
		expect(is.option.parse(some(42)).isOk()).toBe(true);
		expect(is.option.parse('nope').isErr()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// is.option.some
// ---------------------------------------------------------------------------

describe('is.option.some', () => {
	it('accepts Some options', () => {
		expect(is.option.some(some(42))).toBe(true);
		expect(is.option.some(some('hello'))).toBe(true);
	});

	it('rejects None options', () => {
		expect(is.option.some(none())).toBe(false);
	});

	it('rejects non-options', () => {
		expect(is.option.some('hello')).toBe(false);
		expect(is.option.some(42)).toBe(false);
	});

	it('has correct meta', () => {
		expect(is.option.some.meta.name).toBe('option.some');
	});
});

// ---------------------------------------------------------------------------
// is.option.none
// ---------------------------------------------------------------------------

describe('is.option.none', () => {
	it('accepts None options', () => {
		expect(is.option.none(none())).toBe(true);
	});

	it('rejects Some options', () => {
		expect(is.option.none(some(42))).toBe(false);
	});

	it('rejects non-options', () => {
		expect(is.option.none('hello')).toBe(false);
		expect(is.option.none(null)).toBe(false);
	});

	it('has correct meta', () => {
		expect(is.option.none.meta.name).toBe('option.none');
	});
});

// ---------------------------------------------------------------------------
// is.option.someOf
// ---------------------------------------------------------------------------

describe('is.option.someOf', () => {
	it('validates the inner value type', () => {
		expect(is.option.someOf(is.number)(some(42))).toBe(true);
		expect(is.option.someOf(is.string)(some(42))).toBe(false);
		expect(is.option.someOf(is.string)(some('hello'))).toBe(true);
	});

	it('rejects None regardless of guard', () => {
		expect(is.option.someOf(is.number)(none())).toBe(false);
	});

	it('rejects non-options', () => {
		expect(is.option.someOf(is.number)(42)).toBe(false);
	});

	it('works with complex guards', () => {
		const guard = is.option.someOf(is.object({ x: is.number }));
		expect(guard(some({ x: 1 }))).toBe(true);
		expect(guard(some({ x: 'nope' }))).toBe(false);
		expect(guard(none())).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// is.option.some.valueIs
// ---------------------------------------------------------------------------

describe('is.option.some.valueIs', () => {
	it('validates the inner value after narrowing to Some', () => {
		expect(is.option.some.valueIs(is.number)(some(42))).toBe(true);
		expect(is.option.some.valueIs(is.string)(some(42))).toBe(false);
	});

	it('rejects None', () => {
		expect(is.option.some.valueIs(is.number)(none())).toBe(false);
	});

	it('rejects non-options', () => {
		expect(is.option.some.valueIs(is.number)(42)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// is.option universal helpers
// ---------------------------------------------------------------------------

describe('is.option universal helpers', () => {
	it('.nullable works', () => {
		expect(is.option.nullable(null)).toBe(true);
		expect(is.option.nullable(some(42))).toBe(true);
		expect(is.option.nullable('nope')).toBe(false);
	});

	it('.optional works', () => {
		expect(is.option.optional(undefined)).toBe(true);
		expect(is.option.optional(some(42))).toBe(true);
	});

	it('.or() composes with other guards', () => {
		const guard = is.option.or(is.string);
		expect(guard(some(42))).toBe(true);
		expect(guard(none())).toBe(true);
		expect(guard('hello')).toBe(true);
		expect(guard(42)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Cross-compatibility: Result and Option
// ---------------------------------------------------------------------------

describe('Result/Option cross-compatibility', () => {
	it('ok() is detected as both result and option', () => {
		const val = ok(42);
		expect(is.result(val)).toBe(true);
		expect(is.option(val)).toBe(true);
	});

	it('some() is detected as both result and option', () => {
		const val = some(42);
		expect(is.result(val)).toBe(true);
		expect(is.option(val)).toBe(true);
	});

	it('err() is detected as result but also as option (structural)', () => {
		const val = err('fail');
		expect(is.result(val)).toBe(true);
		// err() has isSome/isNone methods from ResultMethodsProto
		expect(is.option(val)).toBe(true);
	});

	it('none() is detected as both result and option', () => {
		const val = none();
		expect(is.result(val)).toBe(true);
		expect(is.option(val)).toBe(true);
	});

	it('result.ok narrows correctly for Some values', () => {
		expect(is.result.ok(some(42))).toBe(true);
		expect(is.result.ok(none())).toBe(false);
	});

	it('option.some narrows correctly for Ok values', () => {
		expect(is.option.some(ok(42))).toBe(true);
		expect(is.option.some(ok(null))).toBe(false); // null is not Some
	});
});
