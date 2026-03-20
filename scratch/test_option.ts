import { chas } from '../src/index.js';

const { some, none, nullable, someAsync, noneAsync } = chas;

async function run() {
	console.log('Testing Option...');

	const s = some(5);
	console.log('some(5).isSome():', s.isSome()); // true
	console.log('some(5).unwrap():', s.unwrap()); // 5

	const n = none();
	console.log('none().isNone():', n.isNone()); // true
	console.log('none().unwrapOr(10):', n.unwrapOr(10)); // 10

	const opt = nullable(null);
	console.log('nullable(null).isNone():', opt.isNone()); // true

	const opt2 = nullable(42);
	console.log('nullable(42).isSome():', opt2.isSome()); // true

	const res = s.toOption();
	console.log('some(5).toOption().isOk():', res.isOk()); // true

	const res2 = chas.err('error').toOption();
	console.log("err('error').toOption().isNone():", res2.isNone()); // true

	const converted = none().isOkAnd(() => true);
	console.log('none().isOkAnd(() => true):', converted); // false

	const asyncSome = await someAsync(10);
	console.log('someAsync(10).isSome():', asyncSome.isOk()); // true

	const asyncNone = await noneAsync();
	console.log('noneAsync().isErr():', asyncNone.isErr()); // true

	console.log('Option verification complete!');
}

run().catch(console.error);
