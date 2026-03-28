import { is } from '../src/guard/guard-v2';
const val: unknown = 'hello';

if (
	is.object({
		name: is.string,
		age: is.number.err('age is not a number').or(is.string),
	})(val)
) {
	console.log(val.name);
	console.log(val.age);
}

if (is.array(is.string, is.number, is.boolean)(val)) {
	console.log(val);
}

if (is.tuple(is.string, is.number, is.boolean)(val)) {
	console.log(val);
}
