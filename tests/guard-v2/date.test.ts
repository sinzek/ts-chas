import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/guard-v2.js';

describe('is.date (v2)', () => {
	it('basic date validation', () => {
		expect(is.date(new Date())).toBe(true);
		expect(is.date(new Date('invalid'))).toBe(false);
		expect(is.date('2024-01-01')).toBe(false);
	});

	describe('Comparisons', () => {
		const now = new Date();
		const past = new Date(now.getTime() - 1000);
		const future = new Date(now.getTime() + 1000);

		it('before', () => {
			expect(is.date.before(now)(past)).toBe(true);
			expect(is.date.before(now)(future)).toBe(false);
		});

		it('after', () => {
			expect(is.date.after(now)(future)).toBe(true);
			expect(is.date.after(now)(past)).toBe(false);
		});

		it('between', () => {
			expect(is.date.between(past, future)(now)).toBe(true);
			expect(is.date.between(past, now)(future)).toBe(false);
		});
	});

	describe('Calendar', () => {
		it('weekend / weekday', () => {
			const saturday = new Date(2024, 0, 20); // Saturday
			const monday = new Date(2024, 0, 22);   // Monday
			
			expect(is.date.weekend(saturday)).toBe(true);
			expect(is.date.weekend(monday)).toBe(false);
			expect(is.date.weekday(monday)).toBe(true);
			expect(is.date.weekday(saturday)).toBe(false);
		});

		it('day (of week)', () => {
			const monday = new Date(2024, 0, 22);
			expect(is.date.day('monday')(monday)).toBe(true);
			expect(is.date.day('tuesday')(monday)).toBe(false);
		});

		it('year / month / dayOfMonth', () => {
			const date = new Date(2024, 2, 15); // Month is 0-indexed: March is 2
			expect(is.date.year(2024)(date)).toBe(true);
			expect(is.date.month(2)(date)).toBe(true);
			expect(is.date.dayOfMonth(15)(date)).toBe(true);
		});
	});

	describe('Time Components', () => {
		it('hour / minute / second / millisecond', () => {
			const date = new Date(2024, 2, 15, 14, 30, 45, 500);
			expect(is.date.hour(14)(date)).toBe(true);
			expect(is.date.minute(30)(date)).toBe(true);
			expect(is.date.second(45)(date)).toBe(true);
			expect(is.date.millisecond(500)(date)).toBe(true);
		});
	});

	describe('Advanced Helpers', () => {
		it('future / past', () => {
			const future = new Date(Date.now() + 10000);
			const past = new Date(Date.now() - 10000);
			expect(is.date.future(future)).toBe(true);
			expect(is.date.future(past)).toBe(false);
			expect(is.date.past(past)).toBe(true);
			expect(is.date.past(future)).toBe(false);
		});

		it('today / tomorrow / yesterday', () => {
			const today = new Date();
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);

			expect(is.date.today(today)).toBe(true);
			expect(is.date.tomorrow(tomorrow)).toBe(true);
			expect(is.date.yesterday(yesterday)).toBe(true);
			expect(is.date.today(tomorrow)).toBe(false);
		});

		it('sameDayAs / sameMonthAs / sameYearAs', () => {
			const d1 = new Date(2024, 5, 15, 10, 0, 0);
			const d2 = new Date(2024, 5, 15, 20, 0, 0);
			const d3 = new Date(2024, 6, 15);
			const d4 = new Date(2025, 5, 15);

			expect(is.date.sameDayAs(d1)(d2)).toBe(true);
			expect(is.date.sameDayAs(d1)(d3)).toBe(false);
			expect(is.date.sameMonthAs(d1)(d2)).toBe(true);
			expect(is.date.sameMonthAs(d1)(d3)).toBe(false);
			expect(is.date.sameYearAs(d1)(d4)).toBe(false);
			expect(is.date.sameYearAs(d1)(d2)).toBe(true);
		});

		it('startOf / endOf', () => {
			const date = new Date(2024, 5, 15, 14, 30, 45, 500);
			
			// startOf('day') should set time to 00:00:00.000
			expect(is.date.startOf('day').hour(0)(date)).toBe(true);
			expect(is.date.startOf('day').millisecond(0)(date)).toBe(true);
			
			// endOf('month') should set date to last day of month and time to 23:59:59.999
			expect(is.date.endOf('month').dayOfMonth(30)(date)).toBe(true); // June has 30 days
			expect(is.date.endOf('month').hour(23)(date)).toBe(true);
			
			// startOf('year')
			expect(is.date.startOf('year').month(0)(date)).toBe(true);
			expect(is.date.startOf('year').dayOfMonth(1)(date)).toBe(true);
		});
	});
});
