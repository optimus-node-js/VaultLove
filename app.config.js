const path = require('path');
const { readFileSync } = require('fs');
const appJson = JSON.parse(readFileSync('./app.json', 'utf8'));

// Set environment variable for Expo Router
process.env.EXPO_ROUTER_APP_ROOT = './app';

module.exports = {
  ...appJson,
  extra: {
    ...appJson.extra,
    EXPO_ROUTER_APP_ROOT: './app',
  },
}; 