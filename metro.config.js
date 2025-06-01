const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

process.env.EXPO_ROUTER_APP_ROOT = './app';

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  ...defaultConfig,
  resolver: {
    ...defaultConfig.resolver,
    extraNodeModules: {
      app: path.resolve(__dirname, 'app')
    }
  }
};

module.exports = config;