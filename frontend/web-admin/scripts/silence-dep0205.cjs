// Dev-only: mute the single benign DEP0205 warning that Next.js 15 emits on
// Node >= 23 from its internal `module.register()` ESM-loader hook. This is an
// upstream Next.js issue, not project code (no instrumentation/OTel hooks exist
// in this app). All other deprecation warnings are left untouched.
//
// Remove this preload (and the NODE_OPTIONS flag in package.json `dev`) once
// Next.js ships a release that no longer calls the deprecated API.
const originalEmit = process.emitWarning;

process.emitWarning = function (warning, ...args) {
  const code = typeof args[0] === 'object' && args[0] !== null ? args[0].code : args[1];
  if (code === 'DEP0205') {
    return;
  }
  return originalEmit.call(process, warning, ...args);
};
