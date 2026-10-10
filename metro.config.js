const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite usa WebAssembly no browser — adiciona .wasm às extensões de asset
config.resolver.assetExts.push('wasm');

module.exports = config;
