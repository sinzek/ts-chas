import { makeGuard, type Guard, factory, transformer } from '../shared.js';

export interface DateHelpers {
	/** Validates that the date is before the specified date. */
	before: (date: Date) => Guard<Date, DateHelpers>;
	/** Validates that the date is after the specified date. */
	after: (date: Date) => Guard<Date, DateHelpers>;
	/** Validates that the date is between the specified dates (inclusive). */
	between: (min: Date, max: Date) => Guard<Date, DateHelpers>;
	/** Validates that the date is a weekend (Saturday or Sunday). */
	weekend: Guard<Date, DateHelpers>;
	/** Validates that the date is a weekday (Monday through Friday). */
	weekday: Guard<Date, DateHelpers>;
	/** Validates that the date is a specific day of the week. */
	day: (
		day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
	) => Guard<Date, DateHelpers>;
	/** Validates that the date is a specific year. */
	year: (year: number) => Guard<Date, DateHelpers>;
	/** Validates that the date is a specific month (0-indexed: January is 0, December is 11). */
	month: (month: number) => Guard<Date, DateHelpers>;
	/** Validates that the date is a specific day of the month (1-31). */
	dayOfMonth: (day: number) => Guard<Date, DateHelpers>;
	/** Validates that the date has a specific timezone offset (in minutes). */
	timezoneOffset: (offset: number) => Guard<Date, DateHelpers>;
	/** Validates that the date is a specific hour (0-23). */
	hour: (hour: number) => Guard<Date, DateHelpers>;
	/** Validates that the date is a specific minute (0-59). */
	minute: (minute: number) => Guard<Date, DateHelpers>;
	/** Validates that the date is a specific second (0-59). */
	second: (second: number) => Guard<Date, DateHelpers>;
	/** Validates that the date is a specific millisecond (0-999). */
	millisecond: (ms: number) => Guard<Date, DateHelpers>;
	/** Validates that the date is in the future. */
	future: Guard<Date, DateHelpers>;
	/** Validates that the date is in the past. */
	past: Guard<Date, DateHelpers>;
	/** Validates that the date is today (same calendar day). */
	today: Guard<Date, DateHelpers>;
	/** Validates that the date is tomorrow (same calendar day). */
	tomorrow: Guard<Date, DateHelpers>;
	/** Validates that the date is yesterday (same calendar day). */
	yesterday: Guard<Date, DateHelpers>;
	/** Validates that the date is on the same calendar day as the provided date. */
	sameDayAs: (date: Date) => Guard<Date, DateHelpers>;
	/** Validates that the date is in the same month as the provided date. */
	sameMonthAs: (date: Date) => Guard<Date, DateHelpers>;
	/** Validates that the date is in the same year as the provided date. */
	sameYearAs: (date: Date) => Guard<Date, DateHelpers>;
	/** Adjusts the date to the start of the specified unit before further validation. */
	startOf: (unit: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second') => Guard<Date, DateHelpers>;
	/** Adjusts the date to the end of the specified unit before further validation. */
	endOf: (unit: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second') => Guard<Date, DateHelpers>;
}

export interface DateGuard extends Guard<Date, DateHelpers> {}

const DAY_MAP = {
	sunday: 0,
	monday: 1,
	tuesday: 2,
	wednesday: 3,
	thursday: 4,
	friday: 5,
	saturday: 6,
};

const isSameDay = (a: Date, b: Date) =>
	a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const dateHelpers: DateHelpers = {
	before: factory((date: Date) => (v: Date) => v.getTime() < date.getTime()),
	after: factory((date: Date) => (v: Date) => v.getTime() > date.getTime()),
	between: factory(
		(min: Date, max: Date) => (v: Date) => v.getTime() >= min.getTime() && v.getTime() <= max.getTime()
	),
	weekend: ((v: Date) => v.getDay() === 0 || v.getDay() === 6) as any,
	weekday: ((v: Date) => v.getDay() > 0 && v.getDay() < 6) as any,
	day: factory((day: keyof typeof DAY_MAP) => (v: Date) => v.getDay() === DAY_MAP[day]),
	year: factory((year: number) => (v: Date) => v.getFullYear() === year),
	month: factory((month: number) => (v: Date) => v.getMonth() === month),
	dayOfMonth: factory((day: number) => (v: Date) => v.getDate() === day),
	timezoneOffset: factory((offset: number) => (v: Date) => v.getTimezoneOffset() === offset),
	hour: factory((hour: number) => (v: Date) => v.getHours() === hour),
	minute: factory((minute: number) => (v: Date) => v.getMinutes() === minute),
	second: factory((second: number) => (v: Date) => v.getSeconds() === second),
	millisecond: factory((ms: number) => (v: Date) => v.getMilliseconds() === ms),

	future: ((v: Date) => v.getTime() > Date.now()) as any,
	past: ((v: Date) => v.getTime() < Date.now()) as any,
	today: ((v: Date) => isSameDay(v, new Date())) as any,
	tomorrow: ((v: Date) => {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		return isSameDay(v, tomorrow);
	}) as any,
	yesterday: ((v: Date) => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		return isSameDay(v, yesterday);
	}) as any,

	sameDayAs: factory((date: Date) => (v: Date) => isSameDay(v, date)),
	sameMonthAs: factory(
		(date: Date) => (v: Date) => v.getFullYear() === date.getFullYear() && v.getMonth() === date.getMonth()
	),
	sameYearAs: factory((date: Date) => (v: Date) => v.getFullYear() === date.getFullYear()),

	startOf: transformer((target, unit: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second') => ({
		fn: (v: unknown): v is Date => {
			if (!(v instanceof Date)) return false;
			const d = new Date(v);
			if (unit === 'year') d.setMonth(0, 1);
			if (unit === 'year' || unit === 'month') d.setDate(1);
			if (unit === 'year' || unit === 'month' || unit === 'day') d.setHours(0, 0, 0, 0);
			if (unit === 'hour') d.setMinutes(0, 0, 0);
			if (unit === 'minute') d.setSeconds(0, 0);
			if (unit === 'second') d.setMilliseconds(0);
			return target(d);
		},
		transform: (v: Date) => {
			const d = new Date(v);
			if (unit === 'year') d.setMonth(0, 1);
			if (unit === 'year' || unit === 'month') d.setDate(1);
			if (unit === 'year' || unit === 'month' || unit === 'day') d.setHours(0, 0, 0, 0);
			if (unit === 'hour') d.setMinutes(0, 0, 0);
			if (unit === 'minute') d.setSeconds(0, 0);
			if (unit === 'second') d.setMilliseconds(0);
			return d;
		},
		meta: { name: `start of ${unit} ${target.meta.name}` },
	})),

	endOf: transformer((target, unit: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second') => ({
		fn: (v: unknown): v is Date => {
			if (!(v instanceof Date)) return false;
			const d = new Date(v);
			if (unit === 'year') d.setMonth(11, 31);
			if (unit === 'month') {
				d.setMonth(d.getMonth() + 1, 0);
			}
			if (unit === 'year' || unit === 'month' || unit === 'day') d.setHours(23, 59, 59, 999);
			if (unit === 'hour') d.setMinutes(59, 59, 999);
			if (unit === 'minute') d.setSeconds(59, 999);
			if (unit === 'second') d.setMilliseconds(999);
			return target(d);
		},
		transform: (v: Date) => {
			const d = new Date(v);
			if (unit === 'year') d.setMonth(11, 31);
			if (unit === 'month') d.setMonth(d.getMonth() + 1, 0);
			if (unit === 'year' || unit === 'month' || unit === 'day') d.setHours(23, 59, 59, 999);
			if (unit === 'hour') d.setMinutes(59, 59, 999);
			if (unit === 'minute') d.setSeconds(59, 999);
			if (unit === 'second') d.setMilliseconds(999);
			return d;
		},
		meta: { name: `end of ${unit} ${target.meta.name}` },
	})),
};

export const DateGuard: DateGuard = makeGuard(
	(v: unknown): v is Date => v instanceof Date && !isNaN(v.getTime()),
	{
		name: 'date',
		id: 'Date',
	},
	dateHelpers
);
