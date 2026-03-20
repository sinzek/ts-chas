/* eslint-disable @typescript-eslint/no-unused-vars */
import { is, guardToValidator, Result } from '../src/index.js';

const password = 'Hello world!';

// ---- Quick password validation w/ guard chaining ----

// Password must be at least 8 characters long, contain at least one uppercase letter,
// one lowercase letter, one number, and one symbol
const validatePassword = guardToValidator(
	is.string.length(8, 24).letters('lowercase', 6).letters('uppercase', 1).numbers(1).symbols(1),
	'Password is invalid'
);

const result = validatePassword(password); // Result<string, string>
if (!result.ok) {
	console.error(result.error);
}

// Alternative without a separate function
if (!is.string.length(8, 24).letters('lowercase', 6).letters('uppercase', 1).numbers(1).symbols(1)(password)) {
	console.error('Password is invalid');
}

const validatePassword2 = guardToValidator(
	is.date.where(d => d > new Date()),
	'Password is invalid'
);

const validateObject = guardToValidator(
	is.object({
		name: is.string.nonEmpty,
		age: is.number.positive,
		email: is.string.email,
	}),
	'Invalid object'
);

const validateObject2 = guardToValidator(
	is
		.object({
			name: is.string.nonEmpty,
			age: is.number.positive,
			email: is.string.email,
		})
		.has('name')
		.has('age')
		.has('email')
		.hasOnly(['name', 'age', 'email']),
	'Invalid object'
);

const example = is.string.length(8, 24).setErrMsg('Password is too short or too long');

const validateExample = guardToValidator(example, 'Invalid example');

console.log(validateExample('hello'));

const strictTest = is.object({
	name: is.string,
	age: is.number,
}).strict;

console.log(strictTest({ name: 'John', age: 25 }));

if (!is.object.eq({ name: 'John', age: 25 })({ name: 'John' })) {
	console.log('Object is equal to the specified value');
}

const validatePassword3 = guardToValidator(
	is.string.length(8, 24).letters('lowercase', 6).letters('uppercase').numbers().symbols()
);

const result3 = validatePassword3(password); // Result<string, string>
if (!result3.ok) {
	console.error(result3.error.msg);
}
// password now has min 1 uppercase, 6 lowercase, min 1 symbol, and min 1 number

function fetchUser(id: number): Result<{ name: string; age: number }, string> {
	if (id === 1) {
		return Result.ok({ name: 'John', age: 25 });
	}
	return Result.err('User not found');
}

const answer = fetchUser(1).match({
	ok: user => `Hello, ${user.name}`,
	err: err => `Error: ${err}`,
});

type User = {
	id: string;
	name: string;
};

const myIs = is.extend('app', {
	validUser: (v: unknown): v is User => is.object({ id: is.string, name: is.string })(v),
});

const data: unknown = { id: '1', name: 'John' };

if (myIs.app.validUser(data)) {
	// value is now typed as User
}

if (is.record(is.string, is.string).hasOnly(['a', 'b'])(data)) {
	console.log(data.a);
}
