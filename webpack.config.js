const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');
const webpack = require('webpack');

// Set the EXPO_ROUTER_APP_ROOT environment variable
process.env.EXPO_ROUTER_APP_ROOT = './app';

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Add alias for "../../../../app" to resolve to ./app
  if (!config.resolve) {
    config.resolve = {};
  }
  
  if (!config.resolve.alias) {
    config.resolve.alias = {};
  }
  
  // Add the app directory aliases
  config.resolve.alias.app = path.resolve(__dirname, 'app');
  config.resolve.alias['../../../../app'] = path.resolve(__dirname, 'app');
  config.resolve.alias['@'] = path.resolve(__dirname);
  config.resolve.alias['nanoid'] = path.resolve(__dirname, 'node_modules/nanoid');
  
  // Add fallbacks for React Native Firebase packages (web compatibility)
  if (!config.resolve.fallback) {
    config.resolve.fallback = {};
  }
  
  // Provide fallbacks for React Native Firebase modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    '@react-native-firebase/auth': false,
    '@react-native-firebase/app': false,
    'react-native/Libraries/vendor/emitter/EventEmitter': false,
    // Add other RN-specific modules that might cause issues
    'react-native': false,
  };
  
  // Add DefinePlugin to hardcode the environment variable in the compiled JavaScript
  if (!config.plugins) {
    config.plugins = [];
  }
  
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env.EXPO_ROUTER_APP_ROOT': JSON.stringify(path.resolve(__dirname, 'app'))
    })
  );
  
  // Add IgnorePlugin to prevent React Native Firebase from being bundled
  config.plugins.push(
    new webpack.IgnorePlugin({
      checkResource(resource) {
        // Ignore React Native Firebase modules for web builds
        return /^@react-native-firebase/.test(resource);
      },
    })
  );
  
  return config;
}; 