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
    levelStars: Record<number, number>; // Maps levelId to stars earned (1-3)
    completeLevel: (starsEarned?: number) => void;
    playLevel: (id: number) => void;
    resetProgress: () => void;
}

export const useLevelStore = create<LevelState>()(
    persist(
        (set, get) => ({
            currentLevelId: 1, // Currently active level
            maxUnlockedLevel: 1, // Highest unlocked level
            levelStars: {}, // Track earned stars per level
            completeLevel: (starsEarned = 0) => {
                const { currentLevelId, maxUnlockedLevel, levelStars } = get();
                const nextLevel = currentLevelId + 1;
                
                // Save the highest star count achieved for this level
                const currentStars = levelStars[currentLevelId] || 0;
                const newStars = Math.max(currentStars, starsEarned);
                
                set({
                    currentLevelId: nextLevel,
                    maxUnlockedLevel: Math.max(maxUnlockedLevel, nextLevel),
                    levelStars: {
                        ...levelStars,
                        [currentLevelId]: newStars
                    }
                });
            },
            playLevel: (id: number) => set({ currentLevelId: id }),
            resetProgress: () => set({ currentLevelId: 1, maxUnlockedLevel: 1, levelStars: {} }),
        }),
        {
            name: 'level-progress',
            storage: createJSONStorage(() => zustandStorage),
        }
    )
)
