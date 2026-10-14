import { soundManager } from '../src/utils/soundManager';

describe('soundManager', () => {
  afterEach(() => {
    soundManager.releaseAll();
  });

  test('calls playPop without errors', () => {
    expect(() => soundManager.playPop()).not.toThrow();
  });

  test('calls playWhoosh without errors', () => {
    expect(() => soundManager.playWhoosh()).not.toThrow();
  });

  test('calls playCorrect without errors', () => {
    expect(() => soundManager.playCorrect()).not.toThrow();
  });

  test('releases sound resources without errors', () => {
    soundManager.playPop();
    soundManager.playWhoosh();
    soundManager.playCorrect();
    expect(() => soundManager.releaseAll()).not.toThrow();
  });
});
