import { is } from './src/guard/index.js';

const guard = is.number.coerce;
console.log('Guard name:', guard.meta.name);
console.log('Has transform:', !!guard.meta.transform);
const result = guard.parse('123');
console.log('Parse result:', result.isOk() ? 'Ok' : 'Err');
if (result.isOk()) {
    console.log('Value type:', typeof result.unwrap());
    console.log('Value:', result.unwrap());
}

const objGuard = is.object({ id: is.number.coerce });
const objResult = objGuard.parse({ id: '123' });
console.log('Object Parse Result:', objResult.isOk() ? 'Ok' : 'Err');
if (objResult.isOk()) {
    console.log('ID type:', typeof objResult.unwrap().id);
    console.log('ID value:', objResult.unwrap().id);
}
