const fs = require('fs');
const path = require('path');

const ctxWebJsPath = path.resolve(__dirname, 'node_modules/expo-router/_ctx.web.js');
const appPath = path.resolve(__dirname, 'app');

const newContent = 'export const ctx = require.context("' + appPath.replace(/\\/g, '/') + '", true, /^(?:\\.\\/)(?!(?:(?:(?:.*\\+api)|(?:\\+(html|native-intent))))\\.[tj]sx?$).*(?:\\.android|\\.ios|\\.native)?\\.[tj]sx?$/, process.env.EXPO_ROUTER_APP_ROOT);';

fs.writeFileSync(ctxWebJsPath, newContent);
console.log('Successfully patched expo-router/_ctx.web.js');