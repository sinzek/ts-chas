import { is } from '../src/guard/guard-v2.js';

console.log('--- Property Access (.nullable) ---');
const nullableString = is.string.nullable;
console.log('Name:', nullableString.meta.name);
console.log('Test "foo":', nullableString('foo'));
console.log('Test null:', nullableString(null));

console.log('\n--- Method Call (.err) ---');
const customErr = is.string.err('OH NO');
console.log('Name:', customErr.meta.name);
console.log('Error meta:', customErr.meta.error);

console.log('\n--- Terminal Method (.parse) ---');
const parseResult = is.string.parse(123);
console.log('Parse 123 Result:', parseResult);

console.log('\n--- Union + Helper Reset (.or) ---');
// is.string has email helper, but is.string.or(is.number) should NOT have it
const stringOrNumber = is.string.or(is.number);
console.log('Name:', stringOrNumber.meta.name);
// email should be dropped
console.log('Has email helper?', 'email' in stringOrNumber);

console.log(stringOrNumber('foo'));

console.log('\n--- Factory Helper (.json) ---');
const jsonGuard = is.string.json({ type: 'object' });
console.log('Name:', jsonGuard.meta.name);
console.log('Test \'{"a":1}\':', jsonGuard('{"a":1}'));
console.log("Test '[1,2]':", jsonGuard('[1,2]'));

console.log('\n--- Transformer Helper (.parsedJson) ---');
const parsedJsonGuard = is.string.parsedJson({ schema: is.object({ a: is.number }) });
console.log('Name:', parsedJsonGuard.meta.name);
console.log('Test \'{"a":1}\':', parsedJsonGuard('{"a":1}'));
console.log('Test \'{"a":1}\':', parsedJsonGuard('{"a":1}'));
// @ts-expect-error - email should be dropped after transformation
console.log(parsedJsonGuard.email);

const unknown: unknown = 'foo';
if (is.string.jwt()(unknown)) {
	console.log(unknown);
}

if (is.string.hex({ prefix: true })(unknown)) {
	console.log(unknown);
}

// --- Literal Guard (Mixed Types) ---
const mixedLiteral = is.literal(2n, 'hello', true);
console.log('Name:', mixedLiteral.meta.name);
console.log("Test 'hello':", mixedLiteral('hello'));
console.log('Test 2n:', mixedLiteral(2n));
console.log('Test 0 vs -0:', is.literal(0)(-0)); // Should be false with Object.is

// --- Logical Guards (Union / Intersection) ---
const emailOrAge = is.union([is.string.email, is.number.min(18)]);
console.log('Union Name:', emailOrAge.meta.name);
console.log("Test 'test@example.com':", emailOrAge('test@example.com'));
console.log('Test 20:', emailOrAge(20));
console.log('Test 10:', emailOrAge(10));

const intersected = is.intersection([is.object({ a: is.string }), is.object({ b: is.number })]);
console.log('Intersection Name:', intersected.meta.name);
console.log("Test {a: 'hi', b: 1}:", intersected({ a: 'hi', b: 1 }));
console.log("Test {a: 'hi'}:", intersected({ a: 'hi' }));

if (is.number.min(18)(unknown)) {
	console.log(unknown);
}

if (is.union([is.string, is.number])(unknown)) {
	console.log(unknown);
}

if (is.intersection([is.object({ a: is.string }), is.object({ b: is.number })])(unknown)) {
	console.log(unknown);
}
