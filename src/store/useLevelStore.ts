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
    completeLevel: () => void;
    resetProgress: () => void;
}

export const useLevelStore = create<LevelState>()(
    persist(
        (set) => ({
            currentLevelId: 1, // Start at level 1
            completeLevel: () => set((state) => ({ currentLevelId: state.currentLevelId + 1 })),
            resetProgress: () => set({ currentLevelId: 1 }),
        }),
        {
            name: 'level-progress',
            storage: createJSONStorage(() => zustandStorage),
        }
    )
)
