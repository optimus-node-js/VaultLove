const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Set the environment variable
process.env.EXPO_ROUTER_APP_ROOT = './app';

// Get the default Metro configuration
const defaultConfig = getDefaultConfig(__dirname);

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