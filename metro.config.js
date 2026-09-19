const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  resolver: {
    assetExts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bin', 'sksl'],
    // Gradle and CMake rewrite tens of thousands of files under these folders
    // during a native build. Metro has no use for them, and watching them made a
    // long-running Metro process spin at 100% CPU and stop serving bundles.
    blockList: [
      /[\\/]android[\\/]app[\\/]build[\\/].*/,
      /[\\/]android[\\/]app[\\/]\.cxx[\\/].*/,
      /[\\/]android[\\/]build[\\/].*/,
      /[\\/]android[\\/]\.gradle[\\/].*/,
      /[\\/]node_modules[\\/].*[\\/]android[\\/](build|\.cxx)[\\/].*/,
      /[\\/]modules[\\/].*[\\/]android[\\/](build|\.cxx)[\\/].*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
