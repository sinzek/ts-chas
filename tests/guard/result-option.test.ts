import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';
import { ok, err } from '../../src/result/index.js';
import { some, none } from '../../src/option.js';

// ===========================================================================
// is.result
// ===========================================================================

// ---------------------------------------------------------------------------
// is.result() — unnarrowed
// ---------------------------------------------------------------------------

describe('is.result()', () => {
	const guard = is.result();

	it('accepts Ok results', () => {
		expect(guard(ok(42))).toBe(true);
		expect(guard(ok('hello'))).toBe(true);
		expect(guard(ok(null))).toBe(true);
	});

	it('accepts Err results', () => {
		expect(guard(err('fail'))).toBe(true);
		expect(guard(err(new Error('oops')))).toBe(true);
	});

	it('rejects non-results', () => {
		expect(guard('hello')).toBe(false);
		expect(guard(42)).toBe(false);
		expect(guard(null)).toBe(false);
		expect(guard(undefined)).toBe(false);
		expect(guard({})).toBe(false);
		expect(guard({ ok: true })).toBe(false); // structural mimic but no methods
		expect(guard({ ok: true, value: 42 })).toBe(false);
	});

	it('has correct meta', () => {
		expect(guard.meta.name).toBe('result');
		expect(guard.meta.id).toBe('result');
	});

	it('.parse() returns Ok for valid results', () => {
		const r = guard.parse(ok(42));
		expect(r.isOk()).toBe(true);
	});

	it('.parse() returns Err for non-results', () => {
		const r = guard.parse('nope');
		expect(r.isErr()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// is.result(okGuard, errGuard) — narrowed
// ---------------------------------------------------------------------------

describe('is.result(okGuard, errGuard)', () => {
	const guard = is.result(is.number, is.string);

	it('validates both Ok value and Err error types', () => {
		expect(guard(ok(42))).toBe(true);
		expect(guard(err('fail'))).toBe(true);
		expect(guard(ok('hello'))).toBe(false);
		expect(guard(err(42))).toBe(false);
	});

	it('rejects non-results', () => {
		expect(guard(42)).toBe(false);
		expect(guard('hello')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// is.result().ok() — Ok variant
// ---------------------------------------------------------------------------

describe('is.result().ok()', () => {
	const guard = is.result().ok();

	it('accepts Ok results', () => {
		expect(guard(ok(42))).toBe(true);
		expect(guard(ok('hello'))).toBe(true);
	});

	it('rejects Err results', () => {
		expect(guard(err('fail'))).toBe(false);
	});

	it('rejects non-results', () => {
		expect(guard('hello')).toBe(false);
		expect(guard(42)).toBe(false);
		expect(guard(null)).toBe(false);
	});

	it('has correct meta', () => {
		expect(guard.meta.name).toBe('result.ok<unknown>');
	});
});

// ---------------------------------------------------------------------------
// is.result().ok(innerGuard) — narrowed Ok
// ---------------------------------------------------------------------------

describe('is.result().ok(innerGuard)', () => {
	it('validates the inner value type', () => {
		expect(is.result().ok(is.number)(ok(42))).toBe(true);
		expect(is.result().ok(is.string)(ok(42))).toBe(false);
		expect(is.result().ok(is.string)(ok('hello'))).toBe(true);
	});

	it('rejects Err results regardless of error type', () => {
		expect(is.result().ok(is.number)(err(42))).toBe(false);
	});

	it('rejects non-results', () => {
		expect(is.result().ok(is.number)(42)).toBe(false);
	});

	it('works with complex guards', () => {
		const guard = is.result().ok(is.object({ name: is.string }));
		expect(guard(ok({ name: 'Chase' }))).toBe(true);
		expect(guard(ok({ name: 123 }))).toBe(false);
		expect(guard(ok('hello'))).toBe(false);
	});

	it('has correct meta with inner guard name', () => {
		const guard = is.result().ok(is.number);
		expect(guard.meta.name).toBe('result.ok<number>');
	});
});

// ---------------------------------------------------------------------------
// is.result().err() — Err variant
// ---------------------------------------------------------------------------

describe('is.result().err()', () => {
	const guard = is.result().err();

	it('accepts Err results', () => {
		expect(guard(err('fail'))).toBe(true);
		expect(guard(err(42))).toBe(true);
	});

	it('rejects Ok results', () => {
		expect(guard(ok(42))).toBe(false);
	});

	it('rejects non-results', () => {
		expect(guard('hello')).toBe(false);
		expect(guard(null)).toBe(false);
	});

	it('has correct meta', () => {
		expect(guard.meta.name).toBe('result.err<unknown>');
	});
});

// ---------------------------------------------------------------------------
// is.result().err(innerGuard) — narrowed Err
// ---------------------------------------------------------------------------

describe('is.result().err(innerGuard)', () => {
	it('validates the inner error type', () => {
		expect(is.result().err(is.string)(err('fail'))).toBe(true);
		expect(is.result().err(is.number)(err('fail'))).toBe(false);
		expect(is.result().err(is.number)(err(42))).toBe(true);
	});

	it('rejects Ok results regardless of value type', () => {
		expect(is.result().err(is.string)(ok('hello'))).toBe(false);
	});

	it('rejects non-results', () => {
		expect(is.result().err(is.string)('fail')).toBe(false);
	});

	it('has correct meta with inner guard name', () => {
		const guard = is.result().err(is.string);
		expect(guard.meta.name).toBe('result.err<string>');
	});
});

// ---------------------------------------------------------------------------
// is.result() universal helpers
// ---------------------------------------------------------------------------

describe('is.result() universal helpers', () => {
	it('.where() works on result guards', () => {
		const okWithValue = is.result().where(r => (r as any).ok === true);
		expect(okWithValue(ok(42))).toBe(true);
		expect(okWithValue(err('x'))).toBe(false);
	});

	it('.nullable works', () => {
		expect(is.result().nullable(null)).toBe(true);
		expect(is.result().nullable(ok(42))).toBe(true);
		expect(is.result().nullable('nope')).toBe(false);
	});

	it('.optional works', () => {
		expect(is.result().optional(undefined)).toBe(true);
		expect(is.result().optional(ok(42))).toBe(true);
	});
});

// ===========================================================================
// is.option
// ===========================================================================

// ---------------------------------------------------------------------------
// is.option() — unnarrowed
// ---------------------------------------------------------------------------

describe('is.option()', () => {
	const guard = is.option();

	it('accepts Some options', () => {
		expect(guard(some(42))).toBe(true);
		expect(guard(some('hello'))).toBe(true);
	});

	it('accepts None options', () => {
		expect(guard(none())).toBe(true);
	});

	it('accepts ok/err as Options (structural compatibility)', () => {
		// Options are Results under the hood, ok() and err() have isSome/isNone
		expect(guard(ok(42))).toBe(true);
	});

	it('rejects non-options', () => {
		expect(guard('hello')).toBe(false);
		expect(guard(42)).toBe(false);
		expect(guard(null)).toBe(false);
		expect(guard(undefined)).toBe(false);
		expect(guard({})).toBe(false);
	});

	it('has correct meta', () => {
		expect(guard.meta.name).toBe('option');
		expect(guard.meta.id).toBe('option');
	});

	it('.parse() works', () => {
		expect(guard.parse(some(42)).isOk()).toBe(true);
		expect(guard.parse('nope').isErr()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// is.option(innerGuard) — narrowed
// ---------------------------------------------------------------------------

describe('is.option(innerGuard)', () => {
	it('validates Some inner value type', () => {
		expect(is.option(is.number)(some(42))).toBe(true);
		expect(is.option(is.number)(some('hello'))).toBe(false);
		expect(is.option(is.string)(some('hello'))).toBe(true);
	});

	it('always accepts None regardless of guard', () => {
		expect(is.option(is.number)(none())).toBe(true);
	});

	it('rejects non-options', () => {
		expect(is.option(is.number)(42)).toBe(false);
	});

	it('works with complex guards', () => {
		const guard = is.option(is.object({ x: is.number }));
		expect(guard(some({ x: 1 }))).toBe(true);
		expect(guard(some({ x: 'nope' }))).toBe(false);
		expect(guard(none())).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// is.option().some() — Some variant
// ---------------------------------------------------------------------------

describe('is.option().some()', () => {
	const guard = is.option().some();

	it('accepts Some options', () => {
		expect(guard(some(42))).toBe(true);
		expect(guard(some('hello'))).toBe(true);
	});

	it('rejects None options', () => {
		expect(guard(none())).toBe(false);
	});

	it('rejects non-options', () => {
		expect(guard('hello')).toBe(false);
		expect(guard(42)).toBe(false);
	});

	it('has correct meta', () => {
		expect(guard.meta.name).toBe('option.some');
	});
});

// ---------------------------------------------------------------------------
// is.option().some(innerGuard) — narrowed Some
// ---------------------------------------------------------------------------

describe('is.option().some(innerGuard)', () => {
	it('validates the inner value type', () => {
		expect(is.option().some(is.number)(some(42))).toBe(true);
		expect(is.option().some(is.string)(some(42))).toBe(false);
		expect(is.option().some(is.string)(some('hello'))).toBe(true);
	});

	it('rejects None regardless of guard', () => {
		expect(is.option().some(is.number)(none())).toBe(false);
	});

	it('rejects non-options', () => {
		expect(is.option().some(is.number)(42)).toBe(false);
	});

	it('works with complex guards', () => {
		const guard = is.option().some(is.object({ x: is.number }));
		expect(guard(some({ x: 1 }))).toBe(true);
		expect(guard(some({ x: 'nope' }))).toBe(false);
		expect(guard(none())).toBe(false);
	});

	it('has correct meta with inner guard name', () => {
		const guard = is.option().some(is.number);
		expect(guard.meta.name).toBe('option.some<number>');
	});
});

// ---------------------------------------------------------------------------
// is.option().none — None variant (property, no parens)
// ---------------------------------------------------------------------------

describe('is.option().none', () => {
	const guard = is.option().none;

	it('accepts None options', () => {
		expect(guard(none())).toBe(true);
	});

	it('rejects Some options', () => {
		expect(guard(some(42))).toBe(false);
	});

	it('rejects non-options', () => {
		expect(guard('hello')).toBe(false);
		expect(guard(null)).toBe(false);
	});

	it('has correct meta', () => {
		expect(guard.meta.name).toBe('option.none');
	});
});

// ---------------------------------------------------------------------------
// is.option() universal helpers
// ---------------------------------------------------------------------------

describe('is.option() universal helpers', () => {
	it('.nullable works', () => {
		expect(is.option().nullable(null)).toBe(true);
		expect(is.option().nullable(some(42))).toBe(true);
		expect(is.option().nullable('nope')).toBe(false);
	});

	it('.optional works', () => {
		expect(is.option().optional(undefined)).toBe(true);
		expect(is.option().optional(some(42))).toBe(true);
	});

	it('.or() composes with other guards', () => {
		const guard = is.option().or(is.string);
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
		expect(is.result()(val)).toBe(true);
		expect(is.option()(val)).toBe(true);
	});

	it('some() is detected as both result and option', () => {
		const val = some(42);
		expect(is.result()(val)).toBe(true);
		expect(is.option()(val)).toBe(true);
	});

	it('err() is detected as result but also as option (structural)', () => {
		const val = err('fail');
		expect(is.result()(val)).toBe(true);
		// err() has isSome/isNone methods from ResultMethodsProto
		expect(is.option()(val)).toBe(true);
	});

	it('none() is detected as both result and option', () => {
		const val = none();
		expect(is.result()(val)).toBe(true);
		expect(is.option()(val)).toBe(true);
	});

	it('result().ok() narrows correctly for Some values', () => {
		expect(is.result().ok()(some(42))).toBe(true);
		expect(is.result().ok()(none())).toBe(false);
	});

	it('option().some() narrows correctly for Ok values', () => {
		expect(is.option().some()(ok(42))).toBe(true);
		expect(is.option().some()(ok(null))).toBe(false); // null is not Some
	});
});
