import { is, guardToValidator } from '../src';

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
