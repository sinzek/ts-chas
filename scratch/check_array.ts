import { is } from '../src/guard/guard-v2.js';

console.log('is.array(is.number, is.string)([1, "a", 2]):', is.array(is.number, is.string)([1, 'a', 2]));
console.log('is.array()([]):', is.array()([]));
console.log('is.array()([1]):', is.array()([1]));
