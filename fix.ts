import { chas } from './src/index.js';

const x: chas.Result<number, string> = chas.ok(1);

x.isOk();
x.map(n => n + 1);
x.mapErr(e => e.length);
x.orElse(e => chas.err(e.length));
x.unwrap();
x.unwrapOr(0);
x.unwrapOrElse(e => e.length);
x.expect('Expected a number');
x.match({
	ok: n => n + 1,
	err: e => e.length,
});

const z: chas.ResultAsync<number, string> = chas.okAsync(1);

z.map(n => n + 1);
const k = z.match({
	ok: val => {
		if (val === 0) return 3;
		return 2;
	},
	err: err => {
		return err;
	},
});
