import Sound from 'react-native-sound';
import { soundManager } from '../src/utils/soundManager';

const SoundMock = Sound as unknown as jest.Mock;

const flushLoad = () => new Promise<void>((resolve) => setImmediate(resolve));

const lastInstance = () => SoundMock.mock.results[SoundMock.mock.results.length - 1].value;

describe('soundManager', () => {
  beforeEach(() => {
    SoundMock.mockClear();
  });

  afterEach(() => {
    soundManager.releaseAll();
  });

  test('preload creates every sound once', () => {
    soundManager.preload();
    soundManager.preload();
    expect(SoundMock).toHaveBeenCalledTimes(4);
  });

  test('does not try to play a sound that has not finished loading', () => {
    soundManager.playPop();
    expect(lastInstance().play).not.toHaveBeenCalled();
  });

  test.each([
    ['playPop', soundManager.playPop],
    ['playDrop', soundManager.playDrop],
    ['playMerge', soundManager.playMerge],
    ['playCorrect', soundManager.playCorrect],
  ])('%s rewinds and plays once loaded', async (_name, playFn) => {
    playFn();
    const sound = lastInstance();
    await flushLoad();
    playFn();
    expect(sound.setCurrentTime).toHaveBeenCalledWith(0);
    expect(sound.play).toHaveBeenCalledTimes(1);
  });

  test('releaseAll releases loaded sounds and allows reloading', async () => {
    soundManager.preload();
    await flushLoad();
    const instances = SoundMock.mock.results.map((r) => r.value);
    soundManager.releaseAll();
    instances.forEach((s) => expect(s.release).toHaveBeenCalled());

    soundManager.playPop();
    expect(SoundMock).toHaveBeenCalledTimes(5);
  });
});
