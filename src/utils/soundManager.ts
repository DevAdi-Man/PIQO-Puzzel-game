import { Image } from 'react-native';
import Sound from 'react-native-sound';

Sound.setCategory('Playback');

const SOUND_SOURCES = {
    pop: { asset: require('../assets/sounds/pop.mp3'), volume: 0.2 },
    drop: { asset: require('../assets/sounds/drop.mp3'), volume: 0.7 },
    merge: { asset: require('../assets/sounds/merge.mp3'), volume: 0.8 },
    correct: { asset: require('../assets/sounds/correct.mp3'), volume: 1.0 },
} as const;

type SoundName = keyof typeof SOUND_SOURCES;

// Singleton sound instances. Loading is async, so a sound only plays once it is ready.
const sounds: Partial<Record<SoundName, Sound>> = {};
const ready: Partial<Record<SoundName, boolean>> = {};

const load = (name: SoundName) => {
    const existing = sounds[name];
    if (existing) return existing;

    const { asset, volume } = SOUND_SOURCES[name];
    const uri = Image.resolveAssetSource(asset)?.uri ?? '';
    const sound = new Sound(uri, '', (error) => {
        if (error) {
            console.warn(`Failed to load sound "${name}":`, error);
            return;
        }
        sound.setVolume(volume);
        ready[name] = true;
    });
    sounds[name] = sound;
    return sound;
};

const play = (name: SoundName) => {
    const sound = load(name);
    if (!ready[name]) return;
    // Rewind instead of stop(cb) → play: avoids an extra native round trip before the sound starts.
    sound.setCurrentTime(0);
    sound.play();
};

export const soundManager = {
    /** Load every sound up front so the first pick-up / drop is not silent. */
    preload: () => {
        (Object.keys(SOUND_SOURCES) as SoundName[]).forEach(load);
    },
    /** UI taps and picking up a piece. */
    playPop: () => play('pop'),
    /** A piece lands on a cell without joining a correct neighbour. */
    playDrop: () => play('drop'),
    /** A piece lands next to a piece it belongs with. */
    playMerge: () => play('merge'),
    playCorrect: () => play('correct'),
    releaseAll: () => {
        (Object.keys(sounds) as SoundName[]).forEach((name) => {
            sounds[name]?.release();
            delete sounds[name];
            delete ready[name];
        });
    },
};
