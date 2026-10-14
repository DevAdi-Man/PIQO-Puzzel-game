import { View, Text, StyleSheet, Pressable } from 'react-native';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Canvas, Group, RoundedRect } from '@shopify/react-native-skia';
import Animated, { FadeInDown, useSharedValue, useDerivedValue, withSpring } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useLevelStore } from '../store/useLevelStore';
import { soundManager } from '../utils/soundManager';

const TITLE_LETTERS = 'PIQO'.split('');

export const StartScreen = () => {
    const navigation = useNavigation<any>();
    const { currentLevelId, resetProgress } = useLevelStore();

    // ── Button Animations ──────────────────────────────────────────
    const playPressY = useSharedValue(0);
    const playTransform = useDerivedValue(() => [{ translateY: playPressY.value }]);

    const levelsPressY = useSharedValue(0);
    const levelsTransform = useDerivedValue(() => [{ translateY: levelsPressY.value }]);

    const resetPressY = useSharedValue(0);
    const resetTransform = useDerivedValue(() => [{ translateY: resetPressY.value }]);

    const handlePlayPressIn = () => {
        soundManager.playPop();
        playPressY.value = withSpring(8, { damping: 14, stiffness: 200 });
    };

    const handlePlayPressOut = () => {
        playPressY.value = withSpring(0, { damping: 14, stiffness: 200 });
    };

    const handleLevelsPressIn = () => {
        soundManager.playPop();
        levelsPressY.value = withSpring(8, { damping: 14, stiffness: 200 });
    };

    const handleLevelsPressOut = () => {
        levelsPressY.value = withSpring(0, { damping: 14, stiffness: 200 });
    };

    const handleResetPressIn = () => {
        soundManager.playPop();
        resetPressY.value = withSpring(6, { damping: 14, stiffness: 200 });
    };

    const handleResetPressOut = () => {
        resetPressY.value = withSpring(0, { damping: 14, stiffness: 200 });
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    {/* ── Logo/Title ── */}
                    <View style={styles.titleContainer}>
                        {TITLE_LETTERS.map((char, index) => (
                            <Animated.Text
                                key={index}
                                entering={FadeInDown.delay(index * 80).springify().damping(12).stiffness(150)}
                                style={styles.titleText}
                            >
                                {char}
                            </Animated.Text>
                        ))}
                    </View>

                    {/* ── Action Buttons ── */}
                    <View style={styles.buttonsContainer}>
                        {/* Play / Resume Button */}
                        <Animated.View entering={FadeInDown.duration(600).delay(300).springify()}>
                            <Pressable
                                onPress={() => navigation.navigate('Play')}
                                onPressIn={handlePlayPressIn}
                                onPressOut={handlePlayPressOut}
                                style={styles.mainButton}
                            >
                                <Canvas style={StyleSheet.absoluteFill}>
                                    <RoundedRect x={0} y={12} width={240} height={68} r={20} color="rgba(0,0,0,0.15)" />
                                    <RoundedRect x={0} y={8} width={240} height={64} r={20} color="#3d2a1d" />
                                    <Group transform={playTransform}>
                                        <RoundedRect x={0} y={0} width={240} height={64} r={20} color="#5a4230" />
                                    </Group>
                                </Canvas>
                                <Animated.View style={[styles.mainButtonInner, { transform: playTransform }]}>
                                    <Text style={styles.mainButtonText}>
                                        {currentLevelId > 1 ? `RESUME LEVEL ${currentLevelId}` : 'NEW GAME'}
                                    </Text>
                                </Animated.View>
                            </Pressable>
                        </Animated.View>

                        {/* Levels Button */}
                        <Animated.View entering={FadeInDown.duration(600).delay(400).springify()}>
                            <Pressable
                                onPress={() => navigation.navigate('Levels')}
                                onPressIn={handleLevelsPressIn}
                                onPressOut={handleLevelsPressOut}
                                style={styles.mainButton}
                            >
                                <Canvas style={StyleSheet.absoluteFill}>
                                    <RoundedRect x={0} y={12} width={240} height={68} r={20} color="rgba(0,0,0,0.15)" />
                                    <RoundedRect x={0} y={8} width={240} height={64} r={20} color="#3d2a1d" />
                                    <Group transform={levelsTransform}>
                                        <RoundedRect x={0} y={0} width={240} height={64} r={20} color="#5a4230" />
                                    </Group>
                                </Canvas>
                                <Animated.View style={[styles.mainButtonInner, { transform: levelsTransform }]}>
                                    <Text style={styles.mainButtonText}>LEVELS</Text>
                                </Animated.View>
                            </Pressable>
                        </Animated.View>

                        {/* Reset All Levels Button */}
                        <Animated.View entering={FadeInDown.duration(600).delay(450).springify()}>
                            <Pressable
                                onPress={() => resetProgress()}
                                onPressIn={handleResetPressIn}
                                onPressOut={handleResetPressOut}
                                style={styles.secondaryButton}
                            >
                                <Canvas style={StyleSheet.absoluteFill}>
                                    <RoundedRect x={0} y={8} width={240} height={56} r={16} color="rgba(0,0,0,0.1)" />
                                    <RoundedRect x={0} y={6} width={240} height={52} r={16} color="#c2b5a1" />
                                    <Group transform={resetTransform}>
                                        <RoundedRect x={0} y={0} width={240} height={52} r={16} color="#d8cfb8" />
                                    </Group>
                                </Canvas>
                                <Animated.View style={[styles.secondaryButtonInner, { transform: resetTransform }]}>
                                    <Text style={styles.secondaryButtonText}>RESET ALL LEVELS</Text>
                                </Animated.View>
                            </Pressable>
                        </Animated.View>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#e4dccf',
    },
    safeArea: {
        flex: 1,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 80,
    },
    titleText: {
        fontSize: 64,
        fontFamily: 'Nunito-ExtraBold',
        color: '#3d2a1d',
        letterSpacing: 4,
    },
    buttonsContainer: {
        width: 240,
        gap: 24,
    },
    mainButton: {
        width: 240,
        height: 80,
    },
    mainButtonInner: {
        width: '100%',
        height: 64,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainButtonText: {
        fontSize: 20,
        fontFamily: 'Nunito-ExtraBold',
        color: '#f8f4e6',
        letterSpacing: 1,
    },
    secondaryButton: {
        width: 240,
        height: 64,
    },
    secondaryButtonInner: {
        width: '100%',
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
    },
    secondaryButtonText: {
        fontSize: 16,
        fontFamily: 'Nunito-ExtraBold',
        color: '#5a4230',
        letterSpacing: 1,
    },
});
