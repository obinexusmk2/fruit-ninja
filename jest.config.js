module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Only *.test.ts(x) are suites, so shared helpers can live next to them.
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  // Native build output and the browser prototype are not test inputs; ignoring
  // them keeps jest-haste-map from indexing Gradle/CMake output trees.
  modulePathIgnorePatterns: [
    '<rootDir>/android/',
    '<rootDir>/ios/',
    '<rootDir>/www/',
  ],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/android/', '<rootDir>/ios/'],
};
