const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');
const webpack = require('webpack');

process.env.EXPO_ROUTER_APP_ROOT = './app';

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  if (!config.resolve) config.resolve = {};
  if (!config.resolve.alias) config.resolve.alias = {};

  config.resolve.alias.app = path.resolve(__dirname, 'app');
  config.resolve.alias['../../../../app'] = path.resolve(__dirname, 'app');
  config.resolve.alias['@'] = path.resolve(__dirname);
  config.resolve.alias['nanoid'] = path.resolve(__dirname, 'node_modules/nanoid');

  if (!config.plugins) config.plugins = [];
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env.EXPO_ROUTER_APP_ROOT': JSON.stringify(path.resolve(__dirname, 'app'))
    })
  );

  return config;
};