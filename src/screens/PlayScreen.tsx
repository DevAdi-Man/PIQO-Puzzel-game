import { View, Text, StyleSheet, Pressable } from 'react-native';
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Canvas, Group, Path, RoundedRect, Skia, useImage } from '@shopify/react-native-skia';
import Animated, {
    FadeIn,
    ZoomInUp,
    FadeInDown,
    useSharedValue,
    useDerivedValue,
    withSpring,
    interpolateColor,
    withTiming,
    useAnimatedStyle,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';

import { useLevelStore } from '../store/useLevelStore';
import { PuzzleBoard, LevelData } from '../components/PuzzleBoard';
import levelsDataJson from '../assets/levels.json';
import { ImageAssets } from '../assets/images';
import { soundManager } from '../utils/soundManager';

// Cast the JSON to our LevelData interface
const levelsData = levelsDataJson as LevelData[];

// ── Icons ─────────────────────────────────────────────────────────
const resetIconPath = Skia.Path.MakeFromSVGString(
    'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z'
)!;
const nextIconPath = Skia.Path.MakeFromSVGString(
    'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z'
)!;
const backIconPath = Skia.Path.MakeFromSVGString(
    'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'
)!;

export const PlayScreen = () => {
    const navigation = useNavigation<any>();
    // ── Persistent State ──────────────────────────────────────────
    const { currentLevelId, completeLevel, saveLevelStars, resetProgress } = useLevelStore();

    // Find the level config from the JSON file
    const levelData = levelsData.find((l) => l.level_id === currentLevelId) || levelsData[0];

    // Load the correct mapped image
    const imageResource = ImageAssets[levelData.image] || ImageAssets.img1;
    const image = useImage(imageResource);

    // ── Timer State ───────────────────────────────────────────────
    const [timeLeft, setTimeLeft] = useState(300); // 5:00 minutes
    const timeLeftRef = useRef(timeLeft);
    timeLeftRef.current = timeLeft;

    const [earnedStars, setEarnedStars] = useState(0);
    const [isSolved, setIsSolved] = useState(false);
    const [showOverlay, setShowOverlay] = useState(false);
    const [isGameOver, setIsGameOver] = useState(false);
    const [resetKey, setResetKey] = useState(0); // Forces a full remount on "reset"

    // ── Button Animation ──────────────────────────────────────────
    const buttonPressY = useSharedValue(0);
    const buttonTransform = useDerivedValue(() => [{ translateY: buttonPressY.value }]);

    const topResetPressY = useSharedValue(0);
    const topResetTransform = useDerivedValue(() => [{ translateY: topResetPressY.value }]);

    const topBackPressY = useSharedValue(0);
    const topBackTransform = useDerivedValue(() => [{ translateY: topBackPressY.value }]);

    // Reset timer state when a new level mounts or user taps "Reset"
    useEffect(() => {
        setTimeLeft(300);
        setIsSolved(false);
        setShowOverlay(false);
        setIsGameOver(false);

        // Auto-correct invalid level states
        if (currentLevelId > levelsData.length) {
            resetProgress();
        }
    }, [currentLevelId, resetKey, resetProgress]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (isSolved || prev <= 0) return prev;
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [isSolved]);

    const timeShared = useSharedValue(timeLeft);
    useEffect(() => {
        timeShared.value = withTiming(timeLeft, { duration: 1000 });
    }, [timeLeft, timeShared]);

    const animatedBgStyle = useAnimatedStyle(() => {
        const bg = interpolateColor(
            timeShared.value,
            [0, 300],
            ['#7a3229', '#e4dccf']
        );
        return { backgroundColor: bg };
    });

    useEffect(() => {
        if (timeLeft === 0 && !isSolved && !isGameOver) {
            setIsGameOver(true);
            setTimeout(() => {
                navigation.navigate('Start');
            }, 2500);
        }
    }, [timeLeft, isSolved, isGameOver, navigation]);

    const mins = Math.floor(timeLeft / 60);
    const secs = (timeLeft % 60).toString().padStart(2, '0');
    const timeString = `${mins}:${secs}`;

    // ── Handlers ──────────────────────────────────────────────────
    const handlePuzzleSolved = useCallback(() => {
        setIsSolved(true);

        const currentTime = timeLeftRef.current;
        let stars = 1;
        if (currentTime >= 180) stars = 3;
        else if (currentTime >= 90) stars = 2;
        setEarnedStars(stars);

        setTimeout(() => {
            setShowOverlay(true);
        }, 1500);
    }, []);

    const isFinalLevel = currentLevelId >= levelsData.length;

    const handleLevelComplete = useCallback(() => {
        if (isFinalLevel) {
            saveLevelStars(currentLevelId, earnedStars);
            resetProgress();
        } else {
            completeLevel(earnedStars, levelsData.length);
        }
    }, [completeLevel, saveLevelStars, resetProgress, isFinalLevel, currentLevelId, earnedStars]);

    const handleResetLevel = useCallback(() => {
        setResetKey((k) => k + 1);
    }, []);

    if (!image) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <Text style={styles.headerText}>Loading Image...</Text>
            </SafeAreaView>
        );
    }

    return (
        <Animated.View style={[styles.mainContainer, animatedBgStyle]}>
            <SafeAreaView style={styles.mainContainer}>
                {/* ── UI Header ── */}
                <View style={styles.headerContainer}>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        onPressIn={() => {
                            soundManager.playPop();
                            topBackPressY.value = withSpring(4, { damping: 12, stiffness: 200 });
                        }}
                        onPressOut={() => {
                            topBackPressY.value = withSpring(0, { damping: 12, stiffness: 200 });
                        }}
                        style={styles.backButton}
                    >
                        <Canvas style={styles.fullFlex}>
                            <RoundedRect x={0} y={6} width={48} height={42} r={12} color="rgba(0,0,0,0.15)" />
                            <RoundedRect x={0} y={4} width={48} height={40} r={12} color="#d8cfb8" />
                            <Group transform={topBackTransform}>
                                <RoundedRect x={0} y={0} width={48} height={40} r={12} color="#f8f4e6" />
                                {backIconPath && (
                                    <Group transform={[{ translateX: 10.5 }, { translateY: 6.5 }, { scale: 1.15 }]}>
                                        <Path path={backIconPath} color="#5a4230" />
                                    </Group>
                                )}
                            </Group>
                        </Canvas>
                    </Pressable>
                    <View style={styles.headerCenter}>
                        <Text style={styles.levelText}>LEVEL {currentLevelId}</Text>
                        <View style={styles.timerContainer}>
                            <Canvas style={StyleSheet.absoluteFill}>
                                <RoundedRect x={0} y={6} width={100} height={38} r={18} color="rgba(0,0,0,0.15)" />
                                <RoundedRect x={0} y={4} width={100} height={36} r={18} color="#d8cfb8" />
                                <RoundedRect x={0} y={0} width={100} height={36} r={18} color="#f8f4e6" />
                            </Canvas>
                            <Text style={styles.timerText}>{timeString}</Text>
                        </View>
                    </View>
                    <Pressable
                        onPress={handleResetLevel}
                        onPressIn={() => {
                            soundManager.playPop();
                            topResetPressY.value = withSpring(4, { damping: 12, stiffness: 200 });
                        }}
                        onPressOut={() => {
                            topResetPressY.value = withSpring(0, { damping: 12, stiffness: 200 });
                        }}
                        style={styles.resetButton}
                    >
                        <Canvas style={styles.fullFlex}>
                            <RoundedRect x={0} y={6} width={48} height={42} r={12} color="rgba(0,0,0,0.15)" />
                            <RoundedRect x={0} y={4} width={48} height={40} r={12} color="#d8cfb8" />
                            <Group transform={topResetTransform}>
                                <RoundedRect x={0} y={0} width={48} height={40} r={12} color="#f8f4e6" />
                                {resetIconPath && (
                                    <Group transform={[{ translateX: 10.5 }, { translateY: 6.5 }, { scale: 1.15 }]}>
                                        <Path path={resetIconPath} color="#5a4230" />
                                    </Group>
                                )}
                            </Group>
                        </Canvas>
                    </Pressable>
                </View>

                {/* ── Puzzle Engine ── */}
                <PuzzleBoard
                    key={`level-${currentLevelId}-reset-${resetKey}`}
                    levelData={levelData}
                    image={image}
                    onPuzzleSolved={handlePuzzleSolved}
                    timeShared={timeShared}
                />

                {/* ── UI Footer ── */}
                <View style={styles.footerContainer}>
                    <Text style={styles.footerText}>
                        DRAG THE BLOCKS TO COMPLETE{'\n'}THE PICTURE
                    </Text>
                </View>
            </SafeAreaView>

            {/* ── Full Screen Completion Overlay ── */}
            {showOverlay && (
                <Animated.View style={styles.completionOverlay} entering={FadeIn.duration(400)}>
                    <View style={styles.centerAlign}>
                        <Animated.Text
                            entering={ZoomInUp.duration(500)}
                            style={styles.completionText}
                        >
                            WELL DONE!
                        </Animated.Text>

                        <Animated.View entering={ZoomInUp.duration(500).delay(200)}>
                            <Pressable
                                onPress={handleLevelComplete}
                                onPressIn={() => {
                                    buttonPressY.value = withSpring(6, { damping: 12, stiffness: 200 });
                                }}
                                onPressOut={() => {
                                    buttonPressY.value = withSpring(0, { damping: 12, stiffness: 200 });
                                }}
                                style={styles.completeButton}
                            >
                                <Canvas style={styles.fullFlex}>
                                    <RoundedRect x={0} y={10} width={120} height={50} r={16} color="rgba(0,0,0,0.15)" />
                                    <RoundedRect x={0} y={6} width={120} height={48} r={16} color="#3d2a1d" />
                                    <Group transform={buttonTransform}>
                                        <RoundedRect x={0} y={0} width={120} height={48} r={16} color="#5a4230" />
                                        {nextIconPath && (
                                            <Group
                                                transform={[
                                                    { translateX: isFinalLevel ? 44 : 42 },
                                                    { translateY: isFinalLevel ? 8 : 6 },
                                                    { scale: isFinalLevel ? 1.2 : 1.5 },
                                                ]}
                                            >
                                                <Path path={isFinalLevel ? resetIconPath : nextIconPath} color="white" />
                                            </Group>
                                        )}
                                    </Group>
                                </Canvas>
                            </Pressable>
                        </Animated.View>
                    </View>
                </Animated.View>
            )}

            {/* ── Full Screen Game Over Overlay ── */}
            {isGameOver && (
                <Animated.View style={styles.completionOverlay} entering={FadeIn.duration(400)}>
                    <View style={styles.centerAlign}>
                        <Animated.Text
                            entering={FadeInDown.duration(600).springify().damping(12).stiffness(150)}
                            style={styles.completionText}
                        >
                            GAME OVER
                        </Animated.Text>
                    </View>
                </Animated.View>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
    },
    fullFlex: {
        flex: 1,
    },
    centerAlign: {
        alignItems: 'center',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#f7e5d0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerText: {
        fontSize: 16,
        fontFamily: 'Nunito-ExtraBold',
        color: '#5a4230',
        letterSpacing: 1,
        textAlign: 'center',
    },
    headerContainer: {
        width: '100%',
        paddingTop: 16,
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-start',
        position: 'relative',
        zIndex: 10,
    },
    backButton: {
        position: 'absolute',
        left: 20,
        top: 16,
        width: 48,
        height: 48,
        zIndex: 10,
    },
    resetButton: {
        position: 'absolute',
        right: 20,
        top: 16,
        width: 48,
        height: 48,
    },
    timerContainer: {
        width: 100,
        height: 44,
        marginTop: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerText: {
        fontSize: 20,
        fontFamily: 'Nunito-ExtraBold',
        color: '#5a4230',
    },
    headerCenter: {
        alignItems: 'center',
    },
    levelText: {
        fontSize: 18,
        fontFamily: 'Nunito-ExtraBold',
        color: '#5a4230',
        letterSpacing: 1,
    },
    footerContainer: {
        paddingBottom: 40,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 20,
        fontFamily: 'Nunito-ExtraBold',
        color: '#5a4230',
        textAlign: 'center',
        lineHeight: 28,
    },
    completeButton: {
        width: 120,
        height: 60,
        marginTop: 32,
    },
    completionOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
    },
    completionText: {
        fontSize: 48,
        fontFamily: 'Fredoka-Bold',
        color: '#fff',
        letterSpacing: 2,
        textShadowColor: 'rgba(0, 0, 0, 0.4)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 8,
    },
});
