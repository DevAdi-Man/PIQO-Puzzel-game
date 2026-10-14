import { useLevelStore } from '../src/store/useLevelStore';

describe('useLevelStore', () => {
  beforeEach(() => {
    useLevelStore.getState().resetProgress();
  });

  test('initial state is level 1 with 0 stars and max unlocked 1', () => {
    const state = useLevelStore.getState();
    expect(state.currentLevelId).toBe(1);
    expect(state.maxUnlockedLevel).toBe(1);
    expect(state.levelStars).toEqual({});
  });

  test('completing a level unlocks next level and saves stars', () => {
    useLevelStore.getState().completeLevel(3, 30);
    const state = useLevelStore.getState();
    expect(state.currentLevelId).toBe(2);
    expect(state.maxUnlockedLevel).toBe(2);
    expect(state.levelStars[1]).toBe(3);
  });

  test('completing the final level caps currentLevelId and preserves stars', () => {
    useLevelStore.getState().playLevel(30);
    useLevelStore.getState().completeLevel(2, 30);
    const state = useLevelStore.getState();
    expect(state.currentLevelId).toBe(30);
    expect(state.maxUnlockedLevel).toBe(30);
    expect(state.levelStars[30]).toBe(2);
  });

  test('saveLevelStars records stars independently without changing currentLevelId', () => {
    useLevelStore.getState().saveLevelStars(5, 3);
    const state = useLevelStore.getState();
    expect(state.levelStars[5]).toBe(3);
    expect(state.currentLevelId).toBe(1);
  });

  test('resetProgress resets level progress and stars', () => {
    useLevelStore.getState().completeLevel(3, 30);
    useLevelStore.getState().resetProgress();
    const state = useLevelStore.getState();
    expect(state.currentLevelId).toBe(1);
    expect(state.maxUnlockedLevel).toBe(1);
    expect(state.levelStars).toEqual({});
  });
});
