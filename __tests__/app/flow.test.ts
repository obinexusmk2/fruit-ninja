import {
  bladeOwner,
  cameraShouldRun,
  flowReducer,
  initialFlow,
  type FlowAction,
  type FlowState,
} from '../../src/app/flow';

const run = (actions: FlowAction[], from: FlowState = initialFlow) =>
  actions.reduce(flowReducer, from);

describe('touch flow (no camera involved)', () => {
  test('home -> boot on first start, then straight into play', () => {
    const s1 = run([{type: 'START', mode: 'touch'}]);
    expect(s1.screen).toBe('boot');
    const s2 = flowReducer(s1, {type: 'BOOT_DONE'});
    expect(s2.screen).toBe('playing');
    expect(s2.mode).toBe('touch');
    expect(s2.bootSeen).toBe(true);
    expect(cameraShouldRun(s2)).toBe(false);
  });

  test('the boot presentation is shown once per app session', () => {
    const s = run([
      {type: 'START', mode: 'touch'},
      {type: 'BOOT_DONE'},
      {type: 'GAME_OVER', score: 4, reason: 'lives'},
      {type: 'HOME'},
      {type: 'START', mode: 'touch'},
    ]);
    expect(s.screen).toBe('playing');
  });

  test('game over records the score/reason and restart begins a new game', () => {
    const playing = run([{type: 'START', mode: 'touch'}, {type: 'BOOT_DONE'}]);
    const over = flowReducer(playing, {type: 'GAME_OVER', score: 12, reason: 'bomb'});
    expect(over).toMatchObject({screen: 'gameover', finalScore: 12, gameOverReason: 'bomb'});
    const again = flowReducer(over, {type: 'RESTART'});
    expect(again.screen).toBe('playing');
    expect(again.gameId).toBe(over.gameId + 1);
    expect(again.finalScore).toBe(0);
  });

  test('a duplicate game-over is ignored (single terminal transition)', () => {
    const over = run([
      {type: 'START', mode: 'touch'},
      {type: 'BOOT_DONE'},
      {type: 'GAME_OVER', score: 5, reason: 'bomb'},
    ]);
    const dup = flowReducer(over, {type: 'GAME_OVER', score: 99, reason: 'lives'});
    expect(dup).toBe(over);
    expect(dup.finalScore).toBe(5);
  });

  test('pause and resume keep the same game', () => {
    const playing = run([{type: 'START', mode: 'touch'}, {type: 'BOOT_DONE'}]);
    const paused = flowReducer(playing, {type: 'PAUSE', reason: 'user'});
    expect(paused).toMatchObject({screen: 'paused', pauseReason: 'user'});
    const resumed = flowReducer(paused, {type: 'RESUME'});
    expect(resumed.screen).toBe('playing');
    expect(resumed.gameId).toBe(playing.gameId);
  });

  test('tracking loss does not pause touch mode', () => {
    const playing = run([{type: 'START', mode: 'touch'}, {type: 'BOOT_DONE'}]);
    expect(flowReducer(playing, {type: 'TRACKING_LOST'})).toBe(playing);
  });
});

describe('hand flow', () => {
  const atSetup = run([
    {type: 'START', mode: 'hand'},
    {type: 'BOOT_DONE'},
  ]);

  test('hand mode goes through camera setup then calibration before play', () => {
    expect(atSetup.screen).toBe('setup');
    expect(cameraShouldRun(atSetup)).toBe(false); // no camera until permission is handled
    const cal = flowReducer(atSetup, {type: 'CAMERA_READY'});
    expect(cal.screen).toBe('calibrating');
    expect(cameraShouldRun(cal)).toBe(true);
    const playing = flowReducer(cal, {type: 'CALIBRATED'});
    expect(playing.screen).toBe('playing');
    expect(cameraShouldRun(playing)).toBe(true);
  });

  test('declining the camera offers touch immediately', () => {
    const s = flowReducer(atSetup, {type: 'SWITCH_TO_TOUCH'});
    expect(s).toMatchObject({screen: 'playing', mode: 'touch'});
    expect(cameraShouldRun(s)).toBe(false);
  });

  test('sustained tracking loss pauses; resuming requires recalibration', () => {
    const playing = run(
      [{type: 'CAMERA_READY'}, {type: 'CALIBRATED'}],
      atSetup,
    );
    const lost = flowReducer(playing, {type: 'TRACKING_LOST'});
    expect(lost).toMatchObject({screen: 'paused', pauseReason: 'tracking-lost'});
    expect(cameraShouldRun(lost)).toBe(false); // camera released while paused

    const cal = flowReducer(lost, {type: 'RESUME'});
    expect(cal).toMatchObject({screen: 'calibrating', resuming: true});
    expect(cal.gameId).toBe(playing.gameId); // same game continues

    const back = flowReducer(cal, {type: 'CALIBRATED'});
    expect(back).toMatchObject({screen: 'playing', resuming: false, pauseReason: null});
  });

  test('a user pause in hand mode also recalibrates on resume', () => {
    const playing = run([{type: 'CAMERA_READY'}, {type: 'CALIBRATED'}], atSetup);
    const paused = flowReducer(playing, {type: 'PAUSE', reason: 'user'});
    expect(flowReducer(paused, {type: 'RESUME'}).screen).toBe('calibrating');
  });

  test('backgrounding while playing pauses and releases the camera', () => {
    const playing = run([{type: 'CAMERA_READY'}, {type: 'CALIBRATED'}], atSetup);
    const paused = flowReducer(playing, {type: 'PAUSE', reason: 'background'});
    expect(cameraShouldRun(paused)).toBe(false);
  });

  test('a camera failure mid-game can continue the same game with touch', () => {
    const playing = run([{type: 'CAMERA_READY'}, {type: 'CALIBRATED'}], atSetup);
    const paused = flowReducer(playing, {type: 'TRACKING_LOST'});
    const touch = flowReducer(paused, {type: 'SWITCH_TO_TOUCH'});
    expect(touch).toMatchObject({screen: 'playing', mode: 'touch', gameId: playing.gameId});
  });

  test('leaving to home stops the camera', () => {
    const playing = run([{type: 'CAMERA_READY'}, {type: 'CALIBRATED'}], atSetup);
    expect(cameraShouldRun(playing)).toBe(true);
    expect(cameraShouldRun(flowReducer(playing, {type: 'HOME'}))).toBe(false);
  });

  test('restart from game over in hand mode recalibrates', () => {
    const over = run(
      [{type: 'CAMERA_READY'}, {type: 'CALIBRATED'}, {type: 'GAME_OVER', score: 3, reason: 'lives'}],
      atSetup,
    );
    const again = flowReducer(over, {type: 'RESTART'});
    expect(again.screen).toBe('calibrating');
    expect(again.resuming).toBe(false);
    expect(again.gameId).toBe(over.gameId + 1);
  });
});

describe('guards and ownership', () => {
  test('actions that do not apply to the current screen are ignored', () => {
    expect(flowReducer(initialFlow, {type: 'CALIBRATED'})).toBe(initialFlow);
    expect(flowReducer(initialFlow, {type: 'RESUME'})).toBe(initialFlow);
    expect(flowReducer(initialFlow, {type: 'GAME_OVER', score: 1, reason: 'bomb'})).toBe(initialFlow);
  });

  test('only the playing screen owns the blades, and only for the selected mode', () => {
    const touchPlay = run([{type: 'START', mode: 'touch'}, {type: 'BOOT_DONE'}]);
    expect(bladeOwner(touchPlay)).toBe('touch');
    expect(bladeOwner(flowReducer(touchPlay, {type: 'PAUSE', reason: 'user'}))).toBeNull();
    expect(bladeOwner(initialFlow)).toBeNull();
  });

  test('one-hand mode is an explicit setting', () => {
    const s = flowReducer(initialFlow, {type: 'SET_ONE_HAND', value: true});
    expect(s.oneHand).toBe(true);
    expect(flowReducer(s, {type: 'START', mode: 'hand'}).oneHand).toBe(true);
  });

  test('privacy opens and closes from home only', () => {
    const p = flowReducer(initialFlow, {type: 'OPEN_PRIVACY'});
    expect(p.screen).toBe('privacy');
    expect(flowReducer(p, {type: 'CLOSE_PRIVACY'}).screen).toBe('home');
    const playing = run([{type: 'START', mode: 'touch'}, {type: 'BOOT_DONE'}]);
    expect(flowReducer(playing, {type: 'OPEN_PRIVACY'})).toBe(playing);
  });
});
