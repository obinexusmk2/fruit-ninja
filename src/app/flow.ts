import type {Difficulty} from '../game/constants';
import type {GameOverReason} from '../game/types';
import type {InputMode} from '../input/types';

/**
 * Compact flow:
 *   home -> boot (once) -> [hand: setup -> calibrating] -> playing
 *        -> paused | gameover -> (restart | home)
 */
export type Screen =
  | 'home'
  | 'boot'
  | 'setup'
  | 'calibrating'
  | 'playing'
  | 'paused'
  | 'gameover'
  | 'privacy';

export type PauseReason = 'user' | 'background' | 'tracking-lost' | 'camera-error';

export interface CameraErrorInfo {
  /** Native error code, e.g. E_CAMERA_IN_USE, E_MODEL. */
  code: string;
  message: string;
}

export interface FlowState {
  screen: Screen;
  mode: InputMode;
  /** One-hand accessibility mode: one blade, one required hand. */
  oneHand: boolean;
  /** Casual (15 lives), Challenge (3 lives) or Practice (no bombs). */
  difficulty: Difficulty;
  /** Identifies the current game; a change remounts the game screen. */
  gameId: number;
  bootSeen: boolean;
  pauseReason: PauseReason | null;
  /** True while calibrating only to resume an in-progress game. */
  resuming: boolean;
  finalScore: number;
  gameOverReason: GameOverReason | null;
  /** Last camera failure, shown on the setup screen / pause overlay. */
  cameraError: CameraErrorInfo | null;
}

export type FlowAction =
  | {type: 'START'; mode: InputMode}
  | {type: 'BOOT_DONE'}
  | {type: 'CAMERA_READY'}
  | {type: 'CAMERA_ERROR'; error: CameraErrorInfo}
  | {type: 'PERMISSION_LOST'}
  | {type: 'SWITCH_TO_TOUCH'}
  | {type: 'CALIBRATED'}
  | {type: 'PAUSE'; reason: PauseReason}
  | {type: 'TRACKING_LOST'}
  | {type: 'RESUME'}
  | {type: 'GAME_OVER'; score: number; reason: GameOverReason}
  /** New game; optionally with another difficulty (e.g. "try the 3-life challenge"). */
  | {type: 'RESTART'; difficulty?: Difficulty}
  | {type: 'HOME'}
  | {type: 'SET_DIFFICULTY'; value: Difficulty}
  | {type: 'SET_ONE_HAND'; value: boolean}
  | {type: 'OPEN_PRIVACY'}
  | {type: 'CLOSE_PRIVACY'};

export const initialFlow: FlowState = {
  screen: 'home',
  mode: 'touch',
  oneHand: false,
  difficulty: 'casual',
  gameId: 0,
  bootSeen: false,
  pauseReason: null,
  resuming: false,
  finalScore: 0,
  gameOverReason: null,
  cameraError: null,
};

/** Where a mode goes after the boot presentation / on restart. */
function entryScreen(mode: InputMode): Screen {
  return mode === 'hand' ? 'setup' : 'playing';
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'START': {
      if (state.screen !== 'home') {
        return state;
      }
      const next: FlowState = {
        ...state,
        mode: action.mode,
        gameId: state.gameId + 1,
        resuming: false,
        pauseReason: null,
        finalScore: 0,
        gameOverReason: null,
        cameraError: null,
      };
      return {
        ...next,
        screen: state.bootSeen ? entryScreen(action.mode) : 'boot',
      };
    }

    case 'BOOT_DONE':
      if (state.screen !== 'boot') {
        return state;
      }
      return {...state, bootSeen: true, screen: entryScreen(state.mode)};

    case 'CAMERA_READY':
      if (state.screen !== 'setup') {
        return state;
      }
      return {...state, screen: 'calibrating', cameraError: null};

    case 'CAMERA_ERROR':
      if (state.mode !== 'hand') {
        return state;
      }
      // The camera failed while starting: back to setup, which explains why.
      if (state.screen === 'calibrating') {
        return {...state, screen: 'setup', cameraError: action.error};
      }
      // The camera failed mid-game: pause (touch is offered as a fallback).
      if (state.screen === 'playing') {
        return {
          ...state,
          screen: 'paused',
          pauseReason: 'camera-error',
          cameraError: action.error,
        };
      }
      return state;

    case 'PERMISSION_LOST':
      // Revoked in Settings, or a one-time grant expired. Ask again; a game that
      // was in progress continues (same gameId) after re-calibration.
      if (
        state.mode !== 'hand' ||
        (state.screen !== 'calibrating' &&
          state.screen !== 'playing' &&
          state.screen !== 'paused')
      ) {
        return state;
      }
      return {
        ...state,
        screen: 'setup',
        pauseReason: null,
        resuming: state.screen === 'calibrating' ? state.resuming : true,
      };

    case 'SWITCH_TO_TOUCH':
      // Available from setup (camera declined/unavailable) and from a pause
      // (camera failed mid-game): the running game, if any, continues.
      if (state.screen !== 'setup' && state.screen !== 'paused' && state.screen !== 'calibrating') {
        return state;
      }
      return {
        ...state,
        mode: 'touch',
        screen: 'playing',
        resuming: false,
        pauseReason: null,
        cameraError: null,
      };

    case 'CALIBRATED':
      if (state.screen !== 'calibrating') {
        return state;
      }
      return {...state, screen: 'playing', resuming: false, pauseReason: null};

    case 'PAUSE':
      if (state.screen !== 'playing') {
        return state;
      }
      return {...state, screen: 'paused', pauseReason: action.reason};

    case 'TRACKING_LOST':
      if (state.screen !== 'playing' || state.mode !== 'hand') {
        return state;
      }
      return {...state, screen: 'paused', pauseReason: 'tracking-lost'};

    case 'RESUME':
      if (state.screen !== 'paused') {
        return state;
      }
      // Hand mode always recalibrates deliberately before play continues.
      return state.mode === 'hand'
        ? {...state, screen: 'calibrating', resuming: true}
        : {...state, screen: 'playing', pauseReason: null};

    case 'GAME_OVER':
      if (state.screen !== 'playing') {
        return state; // a single terminal transition: ignore late duplicates
      }
      return {
        ...state,
        screen: 'gameover',
        finalScore: action.score,
        gameOverReason: action.reason,
      };

    case 'RESTART':
      if (state.screen !== 'gameover' && state.screen !== 'paused') {
        return state;
      }
      return {
        ...state,
        difficulty: action.difficulty ?? state.difficulty,
        gameId: state.gameId + 1,
        screen: entryScreen(state.mode) === 'setup' ? 'calibrating' : 'playing',
        resuming: false,
        pauseReason: null,
        finalScore: 0,
        gameOverReason: null,
        cameraError: null,
      };

    case 'HOME':
      return {
        ...state,
        screen: 'home',
        resuming: false,
        pauseReason: null,
      };

    case 'SET_DIFFICULTY':
      // Chosen on the home screen; it applies to the next game that starts.
      return state.screen === 'home' ? {...state, difficulty: action.value} : state;

    case 'SET_ONE_HAND':
      return {...state, oneHand: action.value};

    case 'OPEN_PRIVACY':
      return state.screen === 'home' ? {...state, screen: 'privacy'} : state;

    case 'CLOSE_PRIVACY':
      return state.screen === 'privacy' ? {...state, screen: 'home'} : state;

    default:
      return state;
  }
}

/** The camera may run only while hand mode is calibrating or playing. */
export function cameraShouldRun(state: FlowState): boolean {
  return (
    state.mode === 'hand' &&
    (state.screen === 'calibrating' || state.screen === 'playing')
  );
}

/** Which input mode owns the blades right now (null = nobody). */
export function bladeOwner(state: FlowState): InputMode | null {
  if (state.screen === 'playing') {
    return state.mode;
  }
  return null;
}
