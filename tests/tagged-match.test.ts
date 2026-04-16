import { describe, it, expect, expectTypeOf } from 'vitest';
import { defineErrs } from '../src/tagged-errs.js';
import { ok, err, errAsync } from '../src/result/result.js';
import { Task } from '../src/task.js';

const AppError = defineErrs({
	NotFound: (resource: string) => ({ resource }),
	Unauthorized: () => ({}),
});

type AppError = ReturnType<typeof AppError.NotFound> | ReturnType<typeof AppError.Unauthorized>;

// Single-tag error type used in compile tests.
type NotFoundErr = ReturnType<typeof AppError.NotFound>;

describe('Tagged Error Enhancements', () => {
	it('factory.throw() throws the error instance', () => {
		expect(() => AppError.NotFound.throw('User')).toThrow('NotFound');
		try {
			AppError.NotFound.throw('User');
		} catch (e: any) {
			expect(e._tag).toBe('NotFound');
			expect(e.resource).toBe('User');
			expect(e instanceof Error).toBe(true);
		}
	});

	describe('Result.matchTag', () => {
		it('matches Ok branch', () => {
			const res = ok<number, AppError>(42);
			const val = res.matchTag({
				ok: v => v,
				NotFound: () => 0,
				Unauthorized: () => 0,
			});
			expect(val).toBe(42);
		});

		it('matches specific tag', () => {
			const res = err<AppError, number>(AppError.NotFound('User'));
			const val = res.matchTag({
				ok: () => 'ok',
				NotFound: e => `Not found: ${e.resource}`,
				Unauthorized: () => 'unauthorized',
			});
			expect(val).toBe('Not found: User');
		});

		it('requires exhaustive matching (compilation check)', () => {
			const res = err<AppError, number>(AppError.NotFound('User'));
			// @ts-expect-error - Missing Unauthorized tag
			res.matchTag({
				ok: () => 1,
				NotFound: () => 2,
			});
		});

		it('err handler is required and typed correctly for non-tagged members', () => {
			// `err` parameter is typed as `Error` — no cast needed.
			const res = err<AppError | Error, number>(new Error('base'));
			const val = res.matchTag({
				ok: () => 0,
				NotFound: () => 1,
				Unauthorized: () => 1,
				err: e => e.message,
			});
			expect(val).toBe('base');
		});
	});

	describe('Result.matchTagPartial', () => {
		it('matches with wildcard fallback', () => {
			const res = err<AppError, number>(AppError.Unauthorized());
			const val = res.matchTagPartial({
				ok: () => 'ok',
				NotFound: () => 'not found',
				_: e => `fallback: ${e._tag}`,
			});
			expect(val).toBe('fallback: Unauthorized');
		});
	});

	describe('ResultAsync.matchTag', () => {
		it('matches asynchronously', async () => {
			const res = errAsync<AppError, number>(AppError.NotFound('User'));
			const val = await res.matchTag({
				ok: () => 'ok',
				NotFound: e => `async: ${e.resource}`,
				Unauthorized: () => 'unauthorized',
			});
			expect(val).toBe('async: User');
		});
	});

	describe('Task — matching via .execute()', () => {
		it('executes the task and matchTags on the resulting Result', async () => {
			const task = Task.from<number, AppError>(() => AppError.NotFound.err('User'));
			const res = await task.execute();
			const val = res.matchTag({
				ok: v => `ok ${v}`,
				NotFound: e => `task ${e.resource}`,
				Unauthorized: () => 'unauth',
			});
			expect(val).toBe('task User');
		});
	});

	describe('Type Tests', () => {
		it('narrows error types correctly in tag handlers', () => {
			const res = err<AppError, number>(AppError.NotFound('User'));
			res.matchTag({
				ok: v => {
					expectTypeOf(v).toBeNumber();
					return v;
				},
				NotFound: e => {
					expectTypeOf(e).toEqualTypeOf<ReturnType<typeof AppError.NotFound>>();
					return 0;
				},
				Unauthorized: e => {
					expectTypeOf(e).toEqualTypeOf<ReturnType<typeof AppError.Unauthorized>>();
					return 0;
				},
			});
		});

		it('infers union return type from all handlers, not just ok', () => {
			const res = ok<number, AppError>(42);
			const val = res.matchTag({
				ok: () => 'string' as const,
				NotFound: () => 123 as const,
				Unauthorized: () => true as const,
			});
			expectTypeOf(val).toEqualTypeOf<'string' | 123 | true>();
		});

		it('works with async handlers via .execute() on a Task', async () => {
			const task = Task.from<number, AppError>(() => 42);
			const val = (await task.execute()).matchTag({
				ok: async v => v.toString(),
				NotFound: () => Promise.resolve('not found'),
				Unauthorized: () => 'unauthorized',
			});
			expectTypeOf(val).toEqualTypeOf<Promise<string> | string>();
		});

		// --- err handler requirement & excess-key rules ---

		it('[compile] rejects extraneous keys (e.g. bruh) that are not in the error union', () => {
			const res = ok<number, NotFoundErr>(42);
			// Valid — only expected keys.
			res.matchTag({ ok: () => 0, NotFound: () => 1 });
			// @ts-expect-error - 'bruh' is not a tag in NotFoundErr
			res.matchTag({ ok: () => 0, NotFound: () => 1, bruh: () => 3 });
		});

		it('[compile] single-tag union: only ok + that tag required, err forbidden', () => {
			const res = ok<number, NotFoundErr>(42);
			// Valid — only ok + NotFound.
			res.matchTag({ ok: () => 0, NotFound: () => 1 });
			// @ts-expect-error - err is forbidden when all members are tagged
			res.matchTag({ ok: () => 0, NotFound: () => 1, err: () => 2 });
		});

		it('[compile] multi-tag all-tagged union: all tags required, err forbidden', () => {
			const res = ok<number, AppError>(42);
			// Valid — full set of tags.
			res.matchTag({ ok: () => 0, NotFound: () => 1, Unauthorized: () => 2 });
			// @ts-expect-error - err is forbidden when all members are tagged
			res.matchTag({ ok: () => 0, NotFound: () => 1, Unauthorized: () => 2, err: () => 3 });
		});

		it('[compile+runtime] mixed union: err required, narrows to non-tagged remainder only', () => {
			const res = err<NotFoundErr | Error, number>(new Error('x'));
			// Valid — err receives `Error`, not the full union.
			const val = res.matchTag({
				ok: () => 0,
				NotFound: e => {
					expectTypeOf(e).toEqualTypeOf<NotFoundErr>();
					return 1;
				},
				err: e => {
					expectTypeOf(e).toEqualTypeOf<Error>();
					return e.message.length;
				},
			});
			expect(typeof val).toBe('number');

			// @ts-expect-error - missing required err handler
			ok<number, NotFoundErr | Error>(42).matchTag({ ok: () => 0, NotFound: () => 1 });
		});
	});
});
