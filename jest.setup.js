/* eslint-env jest */
// Native modules that have no JS-only implementation are mocked here so that
// component tests can render. Game/input logic tests do not depend on any of
// these: that code is pure TypeScript with no React Native imports.

import 'react-native-gesture-handler/jestSetup';

// The package's own jest mock ships as untranspiled ESM, so a small local mock
// is used instead. Tests can override insets with `global.__TEST_INSETS__`.
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const zero = {top: 0, right: 0, bottom: 0, left: 0};
  const getInsets = () => global.__TEST_INSETS__ || zero;
  return {
    SafeAreaProvider: ({children}) => children,
    SafeAreaView: ({children}) => children,
    SafeAreaInsetsContext: React.createContext(zero),
    useSafeAreaInsets: () => getInsets(),
    useSafeAreaFrame: () => ({x: 0, y: 0, width: 360, height: 800}),
    initialWindowMetrics: {
      frame: {x: 0, y: 0, width: 360, height: 800},
      insets: zero,
    },
  };
});
