// Stub for 'module' that works in both Node.js and browser
// In Node.js, re-export the real module; in browser, provide empty stubs

let createRequire;

if (typeof process !== "undefined" && process.versions?.node) {
  // Node.js environment - use the real module
  const nodeModule = await import("node:module");
  createRequire = nodeModule.createRequire;
} else {
  // Browser environment - stub that won't be called
  createRequire = () => {
    throw new Error("createRequire is not available in browser");
  };
}

export { createRequire };
export default { createRequire };
