const fs = require('fs');
const path = require('path');

// Path to the problematic file
const ctxWebJsPath = path.resolve(__dirname, 'node_modules/expo-router/_ctx.web.js');

// Get the absolute path to the app directory
const appPath = path.resolve(__dirname, 'app');

// New content for the file with correct path
const newContent = `export const ctx = require.context(
  "${appPath.replace(/\\/g, '/')}",
  true,
  /^(?:\\.\\/)(?!(?:(?:(?:.*\\+api)|(?:\\+(html|native-intent))))\\.[tj]sx?$).*(?:\\.android|\\.ios|\\.native)?\\.[tj]sx?$/,
  process.env.EXPO_ROUTER_IMPORT_MODE
);
`;

// Write the patched file
fs.writeFileSync(ctxWebJsPath, newContent);
console.log('Successfully patched expo-router/_ctx.web.js with path:', appPath); 