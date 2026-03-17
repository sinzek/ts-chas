import { is } from '../src/guard';

const value: unknown = 'hello world';

if (is.string.where(v => v.length > 5)(value)) {
	const s: string = value; // Should be narrowed to string
	console.log('Narrowed to string:', s);
}

if (is.number.where(v => v > 10)(value)) {
	const n: number = value; // Should be narrowed to number
	console.log('Narrowed to number:', n);
}

if (is.boolean.where(v => v === true)(value)) {
	const b: boolean = value; // Should be narrowed to boolean
	console.log('Narrowed to boolean:', b);
}

if (is.function.where(v => v.name === 'test')(value)) {
	const f: Function = value;
	console.log('Narrowed to function:', f);
}
