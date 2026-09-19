module.exports = {
  root: true,
  extends: '@react-native',
  // Generated Gradle/CMake output (test reports, intermediates) is not source.
  ignorePatterns: ['**/android/build/**', '**/android/app/build/**', '**/.cxx/**'],
};
