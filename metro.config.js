const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  resolver: {
    assetExts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bin', 'sksl'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
