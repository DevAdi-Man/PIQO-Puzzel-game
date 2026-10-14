import { Image } from 'react-native';
import Sound from 'react-native-sound';

Sound.setCategory('Playback');

const loadSound = (asset: any, volume = 1.0) => {
    const resolved = Image.resolveAssetSource(asset)?.uri ?? '';
    const sound = new Sound(resolved, '', (error) => {
        if (error) {
            console.warn('Failed to load sound:', error);
        } else {
            sound.setVolume(volume);
        }
    });
    return sound;
};

// Singleton sound instances
let popSound: Sound | null = null;
let whooshSound: Sound | null = null;
let correctSound: Sound | null = null;

const getPopSound = () => {
    if (!popSound) {
        popSound = loadSound(require('../assets/sounds/pop.mp3'), 0.3);
    }
    return popSound;
};

const getWhooshSound = () => {
    if (!whooshSound) {
        whooshSound = loadSound(require('../assets/sounds/whoosh.mp3'), 1.0);
    }
    return whooshSound;
};

const getCorrectSound = () => {
    if (!correctSound) {
        correctSound = loadSound(require('../assets/sounds/correct.mp3'), 1.0);
    }
    return correctSound;
};

export const soundManager = {
    playPop: () => {
        const sound = getPopSound();
        sound?.stop(() => {
            sound?.play();
        });
    },
    playWhoosh: () => {
        const sound = getWhooshSound();
        sound?.stop(() => {
            sound?.play();
        });
    },
    playCorrect: () => {
        const sound = getCorrectSound();
        sound?.stop(() => {
            sound?.play();
        });
    },
    releaseAll: () => {
        if (popSound) {
            popSound.release();
            popSound = null;
        }
        if (whooshSound) {
            whooshSound.release();
            whooshSound = null;
        }
        if (correctSound) {
            correctSound.release();
            correctSound = null;
        }
    },
};
