export {resourceEntries} from './resource-stream.mjs';
export {restoreSprite} from './sprite-png.mjs';

export function decodeBrotli(bytes, rawSize) {
  // Load the JS decoder only when the WeChat native decompressor is unavailable.
  return require('brotli/decompress')(bytes,rawSize);
}
