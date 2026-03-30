import { describe, it, expect } from 'vitest';
import { ok, err, ResultAsync, okAsync, errAsync } from '../src/result/index.js';
import { defineErrs } from '../src/tagged-errs.js';
import { Task } from '../src/task.js';

const TestErrs = defineErrs({
	NotFound: (resource: string) => ({ resource }),
	Validation: (field: string) => ({ field }),
});

describe('Error Context', () => {
	describe('Result.context', () => {
		it('should attach context to an Err', () => {
			const result = err(TestErrs.NotFound('user')).context('fetching user');
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect((result.error as any)._context).toEqual(['fetching user']);
			}
		});

		it('should not affect Ok results', () => {
			const result = ok(42).context('some step');
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe(42);
			}
		});

		it('should chain multiple contexts (most recent first)', () => {
			const result = err(TestErrs.NotFound('user')).context('step 1').context('step 2').context('step 3');

			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect((result.error as any)._context).toEqual(['step 3', 'step 2', 'step 1']);
			}
		});

		it('should support metadata objects as context', () => {
			const result = err(TestErrs.NotFound('user')).context({ step: 'loading dashboard', userId: '123' });

			if (result.isErr()) {
				expect((result.error as any)._context).toEqual([{ step: 'loading dashboard', userId: '123' }]);
			}
		});

		it('should work in andThen chains', () => {
			const step1 = () => ok(1).context('step 1');
			const step2 = () => err(TestErrs.Validation('email')).context('step 2');

			const result = step1().andThen(step2).context('pipeline');

			if (result.isErr()) {
				expect((result.error as any)._context).toEqual(['pipeline', 'step 2']);
			}
		});

		it('should not attach context to primitive errors', () => {
			const result = err('simple string error').context('some step');
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error).toBe('simple string error');
			}
		});

		it('should not attach context to null errors', () => {
			const result = err(null).context('some step');
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error).toBe(null);
			}
		});
	});

	describe('ResultAsync.context', () => {
		it('should attach context to an async Err', async () => {
			const result = await errAsync(TestErrs.NotFound('user')).context('async step');

			if (result.isErr()) {
				expect((result.error as any)._context).toEqual(['async step']);
			}
		});

		it('should not affect async Ok results', async () => {
			const result = await okAsync(42).context('some step');
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe(42);
			}
		});

		it('should chain multiple async contexts', async () => {
			const result = await errAsync(TestErrs.NotFound('user')).context('step 1').context('step 2');

			if (result.isErr()) {
				expect((result.error as any)._context).toEqual(['step 2', 'step 1']);
			}
		});
	});

	describe('Task.context', () => {
		it('should attach context to a Task error', async () => {
			const task = new Task(() => ResultAsync.fromResult(err(TestErrs.NotFound('user')))).context('task step');

			const result = await task.execute();
			if (result.isErr()) {
				expect((result.error as any)._context).toEqual(['task step']);
			}
		});

		it('should not affect Task Ok results', async () => {
			const task = new Task(() => ResultAsync.fromResult(ok(42))).context('task step');

			const result = await task.execute();
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe(42);
			}
		});
	});
});
