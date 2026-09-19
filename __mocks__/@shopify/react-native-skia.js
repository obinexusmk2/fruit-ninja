/* eslint-env jest */
// Lightweight stand-in for @shopify/react-native-skia so component tests can
// render without the native module or a CanvasKit WASM environment.
// It records nothing and draws nothing: rendering correctness is verified on a
// device/emulator, not in Jest.
const React = require('react');

const noop = () => undefined;

const makePathBuilder = () => {
  const b = {
    moveTo: () => b,
    lineTo: () => b,
    close: () => b,
    detach: () => ({}),
    build: () => ({}),
  };
  return b;
};

const makePaint = () => ({
  setStyle: noop,
  setColor: noop,
  setAlphaf: noop,
  setStrokeWidth: noop,
  setStrokeCap: noop,
  setStrokeJoin: noop,
});

const Skia = {
  PathBuilder: {Make: makePathBuilder},
  Paint: makePaint,
  Color: c => c,
};

module.exports = {
  Skia,
  PaintStyle: {Fill: 0, Stroke: 1},
  StrokeCap: {Butt: 0, Round: 1, Square: 2},
  StrokeJoin: {Miter: 0, Round: 1, Bevel: 2},
  Canvas: props => React.createElement('Canvas', props),
  Picture: props => React.createElement('Picture', props),
  createPicture: () => ({}),
  // A loaded image by default so the game's sprite gate opens in tests.
  useImage: jest.fn(() => ({width: () => 1, height: () => 1})),
};
