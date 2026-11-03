import {toByteArray} from 'base64-js';
import {strFromU8} from 'fflate';

// linkedom expects a binary string: each character represents one byte.
export function decodeBase64String(input) {
  let data = String(input).replace(/[\t\n\f\r ]/g, '');
  if (data.length % 4 === 0) data = data.replace(/={1,2}$/, '');
  if (data.length % 4 === 1 || /[^A-Za-z0-9+/]/.test(data)) {
    throw new Error('Invalid Base64 data');
  }
  const padding = (4 - data.length % 4) % 4;
  return strFromU8(toByteArray(data + '='.repeat(padding)), true);
}
