import { create } from 'zustand'
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware'
import { createMMKV } from 'react-native-mmkv'

const storage = createMMKV({ id: 'level-storage' })

const zustandStorage: StateStorage = {
    setItem: (name, value) => {
        return storage.set(name, value)
    },
    getItem: (name) => {
        const value = storage.getString(name)
        return value ?? null
    },
    removeItem: (name) => {
        return storage.remove(name)
    },
}

interface LevelState {
    currentLevelId: number;
    maxUnlockedLevel: number;
    completeLevel: () => void;
    playLevel: (id: number) => void;
    resetProgress: () => void;
}

export const useLevelStore = create<LevelState>()(
    persist(
        (set, get) => ({
            currentLevelId: 1, // Currently active level
            maxUnlockedLevel: 1, // Highest unlocked level
            completeLevel: () => {
                const { currentLevelId, maxUnlockedLevel } = get();
                const nextLevel = currentLevelId + 1;
                set({
                    currentLevelId: nextLevel,
                    maxUnlockedLevel: Math.max(maxUnlockedLevel, nextLevel)
                });
            },
            playLevel: (id: number) => set({ currentLevelId: id }),
            resetProgress: () => set({ currentLevelId: 1, maxUnlockedLevel: 1 }),
        }),
        {
            name: 'level-progress',
            storage: createJSONStorage(() => zustandStorage),
        }
    )
)
