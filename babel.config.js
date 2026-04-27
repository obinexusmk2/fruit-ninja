module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@boot': './src/boot',
          '@game': './src/game',
          '@skia': './src/skia',
          '@ui': './src/ui',
        },
      },
    ],
    'react-native-reanimated/plugin',
  ],
};
