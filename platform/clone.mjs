// Profiles and run results have the same JSON shape as the desktop save.
export const cloneData = typeof globalThis.structuredClone === 'function'
  ? globalThis.structuredClone.bind(globalThis)
  : value => JSON.parse(JSON.stringify(value));
