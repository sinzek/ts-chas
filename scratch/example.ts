/* eslint-disable @typescript-eslint/no-unused-vars */
import { chas } from '../src/index';

const AppError = chas.errors(
	{
		NotFound: (resource: string, id: string) => ({ resource, id }),
		Validation: (field: string, message: string) => ({ field, message }),
	},
	{
		exampleProp: 'this is a test',
	}
);

type User = {
	name: string;
	id: string;
};

type AppErr = chas.InferErrors<typeof AppError>;
type NotFoundErr = chas.ExtractError<AppErr, 'NotFound'>;

// Create instances - they are real Error objects with a `_tag` discriminant
const err = AppError.NotFound('user', '123');
// → Error { _tag: "NotFound", resource: "user", id: "123", stack: "...", name: "NotFound" }

// Use with Result
function getUser(id: string | null): chas.Result<User, AppErr> {
	if (!id) return AppError.Validation.err('id', 'required');

	const user = {
		name: 'John Doe',
		id: id,
	};

	return chas.ok(user);
}

const test = AppError.NotFound('user', '123');

const result = getUser('hello')
	.catchTag('Validation', e => {
		console.log(e.field, e.message);
		return chas.ok({ name: 'test', id: 'test' });
	})
	.inspectErr(e =>
		chas.matchErrorPartial(e as AppErr | Error, {
			NotFound: e => {
				console.log(e.resource, e.id);
			},
			_: e => {
				console.log(e.message);
			},
		})
	)
	.orElse(e => {
		console.log(e.resource, e.id);
		return chas.ok({ name: 'test', id: 'test' });
	})
	.okOr('error');

const matched = chas.matchErrorPartial(err, {
	NotFound: e => {
		console.log(e.resource, e.id);
		return chas.ok(e.exampleProp);
	},
	_: e => {
		console.log(e.message);
		return chas.ok(e.exampleProp);
	},
});

if (AppError.NotFound.is(err)) {
	console.log(err.resource, err.id);
}

const json = err.toJSON();

console.log(err.toString());

const test2: chas.Result<number, NotFoundErr> = AppError.NotFound.try(
	() => {
		if (Math.random() > 0.5) {
			throw AppError.NotFound('user', '123');
		}
		return 1;
	},
	() => ['user', '123']
).inspectErr(e => console.log(e.resource));

const val = test2.unwrap();

const test3 = test2
	.mapErr(e => {
		return {
			...e,
			y: 1,
		};
	})
	.inspectErr(e => e.y);

const test4 = chas.ok(1).toOption();

const egg = chas
	.none()
	.toResult('error')
	.orElse(() => chas.ok(1))
	.toOption();

if (egg.isSome()) {
	const value = egg.value;
}

console.log(egg);

const test5 = chas.ok<number, string>(1).match({
	ok: val => {
		return val;
	},
	err: err => {
		console.log(err);
		return 0;
	},
});

const eggs = chas.err<string, number>('error').toOption();

const j = chas.some(1).unwrap();

const k = chas.fromNullable(5);
const bruh = chas.fromNullable<number | null>(null);

if (bruh.isNone()) {
	console.log('bruh is none');
}

const x: number | null = Math.random() > 0.5 ? 1 : null;
const xOption = chas.fromNullable(x);

if (xOption.isNone()) {
	const value = xOption.unwrap();
}

const result111 = xOption.matchSome({
	Some: val => {
		return `got val: ${val}`;
	},
	None: () => {
		return 0;
	},
});

const eggzample: number | null | undefined = undefined;

const bruh2 = chas.fromNullable(eggzample).matchSome({
	Some: val => {
		return val;
	},
	None: () => {
		return 0;
	},
});

const test6: unknown = 1;

if (chas.is.result(chas.is.number, chas.is.tagged('NotFound'))(test6)) {
	console.log(test6);
}
