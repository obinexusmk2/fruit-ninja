import {
  bladeAnchor,
  landmarkToCanvas,
  rotateNormalized,
  uprightSize,
  type FrameGeometry,
  type ViewGeometry,
} from '../../src/input/transforms';

// An upright portrait analysis frame (as native emits it): 480 x 640 (3:4).
const portraitFrame: FrameGeometry = {width: 480, height: 640, mirror: false};
const phone = (over: Partial<ViewGeometry> = {}): ViewGeometry => ({
  width: 360,
  height: 800,
  fit: 'cover',
  ...over,
});

const close = (a: {x: number; y: number}, b: {x: number; y: number}) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
};

describe('rotateNormalized', () => {
  test.each([
    [0, {x: 0.2, y: 0.7}, {x: 0.2, y: 0.7}],
    [90, {x: 0.2, y: 0.7}, {x: 0.3, y: 0.2}],
    [180, {x: 0.2, y: 0.7}, {x: 0.8, y: 0.3}],
    [270, {x: 0.2, y: 0.7}, {x: 0.7, y: 0.8}],
  ] as const)('%d degrees clockwise', (deg, input, expected) => {
    close(rotateNormalized(input, deg), expected);
  });

  test('four quarter turns return to the start', () => {
    let p = {x: 0.13, y: 0.61};
    for (let i = 0; i < 4; i++) {
      p = rotateNormalized(p, 90);
    }
    close(p, {x: 0.13, y: 0.61});
  });

  test('uprightSize swaps width and height for 90/270 only', () => {
    expect(uprightSize({width: 640, height: 480, mirror: false, rotationDegrees: 90})).toEqual({width: 480, height: 640});
    expect(uprightSize({width: 640, height: 480, mirror: false, rotationDegrees: 270})).toEqual({width: 480, height: 640});
    expect(uprightSize({width: 640, height: 480, mirror: false, rotationDegrees: 180})).toEqual({width: 640, height: 480});
    expect(uprightSize({width: 640, height: 480, mirror: false})).toEqual({width: 640, height: 480});
  });
});

describe('landmarkToCanvas: portrait view, cover (centre crop)', () => {
  // scale = max(360/480, 800/640) = 1.25 => shown 600 x 800, horizontal crop -120.
  test('the frame centre maps to the view centre', () => {
    close(landmarkToCanvas({x: 0.5, y: 0.5}, portraitFrame, phone()), {x: 180, y: 400});
  });

  test('the visible edges are cropped horizontally, not squeezed', () => {
    close(landmarkToCanvas({x: 0, y: 0}, portraitFrame, phone()), {x: -120, y: 0});
    close(landmarkToCanvas({x: 1, y: 1}, portraitFrame, phone()), {x: 480, y: 800});
    // x = 0.2 => -120 + 0.2*600 = 0
    close(landmarkToCanvas({x: 0.2, y: 0.5}, portraitFrame, phone()), {x: 0, y: 400});
    // x = 0.8 => -120 + 0.8*600 = 360
    close(landmarkToCanvas({x: 0.8, y: 0.5}, portraitFrame, phone()), {x: 360, y: 400});
  });

  test('a raw (1-x)*width mapping is NOT equivalent for a cropped preview', () => {
    const lm = {x: 0.25, y: 0.5};
    const naive = {x: (1 - lm.x) * 360, y: lm.y * 800};
    const proper = landmarkToCanvas(lm, {...portraitFrame, mirror: true}, phone());
    // proper: mirror 0.75 => -120 + 0.75*600 = 330; naive: 270.
    expect(proper.x).toBeCloseTo(330, 6);
    expect(naive.x).toBeCloseTo(270, 6);
    expect(Math.abs(proper.x - naive.x)).toBeGreaterThan(50);
  });
});

describe('landmarkToCanvas: contain (letterbox)', () => {
  // scale = min(0.75, 1.25) = 0.75 => shown 360 x 480, vertical bars of 160.
  test('centre and letterbox offsets', () => {
    const v = phone({fit: 'contain'});
    close(landmarkToCanvas({x: 0.5, y: 0.5}, portraitFrame, v), {x: 180, y: 400});
    close(landmarkToCanvas({x: 0, y: 0}, portraitFrame, v), {x: 0, y: 160});
    close(landmarkToCanvas({x: 1, y: 1}, portraitFrame, v), {x: 360, y: 640});
  });
});

describe('landmarkToCanvas: mirror is applied exactly once', () => {
  test('front camera mirrors x only', () => {
    const v = phone({fit: 'contain'});
    const front = landmarkToCanvas({x: 0.25, y: 0.3}, {...portraitFrame, mirror: true}, v);
    const back = landmarkToCanvas({x: 0.25, y: 0.3}, portraitFrame, v);
    expect(front.y).toBeCloseTo(back.y, 6);
    // back: 0.25*360 = 90; front: 0.75*360 = 270
    expect(back.x).toBeCloseTo(90, 6);
    expect(front.x).toBeCloseTo(270, 6);
    // mirroring a mirrored coordinate is the identity: front(x) == back(1 - x)
    const viaFlip = landmarkToCanvas({x: 0.75, y: 0.3}, portraitFrame, v);
    close(front, viaFlip);
  });

  test('the centre is unaffected by the mirror', () => {
    close(
      landmarkToCanvas({x: 0.5, y: 0.5}, {...portraitFrame, mirror: true}, phone()),
      landmarkToCanvas({x: 0.5, y: 0.5}, portraitFrame, phone()),
    );
  });
});

describe('landmarkToCanvas: rotation of raw sensor-space input', () => {
  // A landscape sensor frame 640x480 that must be rotated 90 degrees clockwise.
  const sensor: FrameGeometry = {width: 640, height: 480, mirror: false, rotationDegrees: 90};

  test('rotation makes the frame upright before scaling', () => {
    // raw (0.2, 0.7) -> upright (0.3, 0.2) in a 480x640 frame; cover in 360x800:
    // x = -120 + 0.3*600 = 60 ; y = 0.2*800 = 160
    close(landmarkToCanvas({x: 0.2, y: 0.7}, sensor, phone()), {x: 60, y: 160});
  });

  test('already-upright data must not be rotated again (rotation 0 == native contract)', () => {
    const upright = landmarkToCanvas({x: 0.3, y: 0.2}, portraitFrame, phone());
    const fromSensor = landmarkToCanvas({x: 0.2, y: 0.7}, sensor, phone());
    close(upright, fromSensor);
  });

  test('90 then mirror equals rotate-first-then-flip (order matters and is fixed)', () => {
    const v = phone({fit: 'contain'});
    const a = landmarkToCanvas({x: 0.2, y: 0.7}, {...sensor, mirror: true}, v);
    // by hand: upright (0.3, 0.2) -> mirror x=0.7 -> contain 360x480 offset y 160
    close(a, {x: 0.7 * 360, y: 160 + 0.2 * 480});
  });
});

describe('landmarkToCanvas: orientations and insets', () => {
  test('landscape view (tablet / rotated window) keeps the centre and crops vertically', () => {
    // upright portrait frame 480x640 covering an 800x360 view: scale = max(1.667, 0.5625) = 1.667
    const v: ViewGeometry = {width: 800, height: 360, fit: 'cover'};
    close(landmarkToCanvas({x: 0.5, y: 0.5}, portraitFrame, v), {x: 400, y: 180});
    // shown 800 x 1066.67 => vertical crop of -353.33
    const top = landmarkToCanvas({x: 0.5, y: 0}, portraitFrame, v);
    expect(top.y).toBeCloseTo(-353.3333, 3);
  });

  test('a landscape upright frame in a portrait view crops horizontally hard', () => {
    const wide: FrameGeometry = {width: 640, height: 480, mirror: false};
    // cover in 360x800: scale = max(0.5625, 1.667) = 1.667 => shown 1066.7 x 800
    const left = landmarkToCanvas({x: 0, y: 0.5}, wide, phone());
    expect(left.x).toBeCloseTo((360 - 1066.6667) / 2, 3);
  });

  test('view offsets (safe-area insets / split window) shift canvas coordinates', () => {
    const base = landmarkToCanvas({x: 0.5, y: 0.5}, portraitFrame, phone());
    const inset = landmarkToCanvas(
      {x: 0.5, y: 0.5},
      portraitFrame,
      phone({offsetX: 24, offsetY: 40}),
    );
    close(inset, {x: base.x + 24, y: base.y + 40});
  });

  test('the back camera is not mirrored', () => {
    const v = phone({fit: 'contain'});
    const p = landmarkToCanvas({x: 0.1, y: 0.5}, {...portraitFrame, mirror: false}, v);
    expect(p.x).toBeCloseTo(36, 6);
  });
});

describe('bladeAnchor (landmarks 8 and 12)', () => {
  function hand(i8: [number, number], i12: [number, number]) {
    const a = new Array(42).fill(0);
    a[8 * 2] = i8[0];
    a[8 * 2 + 1] = i8[1];
    a[12 * 2] = i12[0];
    a[12 * 2 + 1] = i12[1];
    return a;
  }

  test('is the midpoint of the index and middle fingertips', () => {
    const p = bladeAnchor(hand([0.2, 0.4], [0.4, 0.6]), 0)!;
    expect(p.x).toBeCloseTo(0.3, 9);
    expect(p.y).toBeCloseTo(0.5, 9);
  });

  test('addresses the second hand block', () => {
    const both = [...hand([0.1, 0.1], [0.1, 0.1]), ...hand([0.8, 0.6], [0.6, 0.4])];
    const p = bladeAnchor(both, 1)!;
    expect(p.x).toBeCloseTo(0.7, 9);
    expect(p.y).toBeCloseTo(0.5, 9);
  });

  test('returns null for a missing hand block or non-finite data', () => {
    expect(bladeAnchor(hand([0, 0], [0, 0]), 1)).toBeNull();
    expect(bladeAnchor([], 0)).toBeNull();
    expect(bladeAnchor(hand([NaN, 0], [0, 0]), 0)).toBeNull();
  });
});
