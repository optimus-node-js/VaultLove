const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Set the environment variable
process.env.EXPO_ROUTER_APP_ROOT = './app';

/** @type {import('expo/metro-config').MetroConfig} */
const defaultConfig = getDefaultConfig(__dirname);

// Fix for Firebase Auth "Component auth has not been registered yet" error
// This is required for Expo SDK 53+ due to Metro package exports enabling
defaultConfig.resolver.unstable_enablePackageExports = false;

// Add support for .cjs files (needed for Firebase Auth with Hermes)
defaultConfig.resolver.sourceExts.push('cjs');

// Configure the Metro configuration
const config = {
  ...defaultConfig,
  resolver: {
    ...defaultConfig.resolver,
    extraNodeModules: {
      app: path.resolve(__dirname, 'app'),
    },
  },
};

module.exports = config; 