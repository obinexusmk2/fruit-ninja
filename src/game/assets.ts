// Static require() map — all paths must be literals for Metro to resolve them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SPRITES: Record<string, any> = {
  apple: require('../../assets/apple.png'),
  apple_half_1: require('../../assets/apple_half_1.png'),
  apple_half_2: require('../../assets/apple_half_2.png'),
  banana: require('../../assets/banana.png'),
  banana_half_1: require('../../assets/banana_half_1.png'),
  banana_half_2: require('../../assets/banana_half_2.png'),
  orange: require('../../assets/orange.png'),
  orange_half_1: require('../../assets/orange_half_1.png'),
  orange_half_2: require('../../assets/orange_half_2.png'),
  coconut: require('../../assets/coconut.png'),
  coconut_half_1: require('../../assets/coconut_half_1.png'),
  coconut_half_2: require('../../assets/coconut_half_2.png'),
  pineapple: require('../../assets/pineapple.png'),
  pineapple_half_1: require('../../assets/pineapple_half_1.png'),
  pineapple_half_2: require('../../assets/pineapple_half_2.png'),
  watermelon: require('../../assets/watermelon.png'),
  watermelon_half_1: require('../../assets/watermelon_half_1.png'),
  watermelon_half_2: require('../../assets/watermelon_half_2.png'),
  bomb: require('../../assets/bomb.png'),
  explosion: require('../../assets/explosion.png'),
  splash_red: require('../../assets/splash_red.png'),
  splash_orange: require('../../assets/splash_orange.png'),
  splash_yellow: require('../../assets/splash_yellow.png'),
  background: require('../../assets/background.png'),
};

import type {FruitKind} from './types';

export const FRUIT_SPLASH_KEY: Record<FruitKind, string> = {
  apple: 'splash_red',
  banana: 'splash_yellow',
  orange: 'splash_orange',
  coconut: 'splash_red',
  pineapple: 'splash_yellow',
  watermelon: 'splash_red',
};
