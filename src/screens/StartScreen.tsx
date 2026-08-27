import { View, Text, StyleSheet, Pressable, Image } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Canvas, Group, RoundedRect } from '@shopify/react-native-skia'
import Animated, { ZoomIn, FadeInDown, useSharedValue, useDerivedValue, withSpring } from 'react-native-reanimated'
import { useNavigation } from '@react-navigation/native'

import { useLevelStore } from '../store/useLevelStore'
import Sound from 'react-native-sound'

Sound.setCategory('Playback')
const popSound = new Sound(Image.resolveAssetSource(require('../assets/sounds/pop.mp3'))?.uri ?? '', '', (error) => {
    if (error) console.log('failed to load pop sound', error);
});

const playPop = () => {
    popSound?.stop(() => {
        popSound?.play();
    });
};
export const StartScreen = () => {
    const navigation = useNavigation<any>()
    const { currentLevelId, resetProgress } = useLevelStore()

    // ── Button Animations ──────────────────────────────────────────
    const playPressY = useSharedValue(0)
    const playTransform = useDerivedValue(() => [{ translateY: playPressY.value }])

    const resetPressY = useSharedValue(0)
    const resetTransform = useDerivedValue(() => [{ translateY: resetPressY.value }])

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    
                    {/* ── Logo/Title ── */}
                    <View style={[styles.titleContainer, { flexDirection: 'row' }]}>
                        {"Piqo".toUpperCase().split('').map((char, index) => (
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
                                onPressIn={() => {
                                    playPop();
                                    playPressY.value = withSpring(8, { damping: 14, stiffness: 200 })
                                }}
                                onPressOut={() => playPressY.value = withSpring(0, { damping: 14, stiffness: 200 })}
                                style={styles.mainButton}
                            >
                                <Canvas style={StyleSheet.absoluteFill}>
                                    <RoundedRect x={0} y={12} width={240} height={68} r={20} color="rgba(0,0,0,0.15)" />
                                    <RoundedRect x={0} y={8} width={240} height={64} r={20} color="#3d2a1d" />
                                    <Group transform={playTransform}>
                                        <RoundedRect x={0} y={0} width={240} height={64} r={20} color="#5a4230" />
                                    </Group>
                                </Canvas>
                                <Animated.View style={[{ transform: playTransform, width: '100%', height: 64, justifyContent: 'center', alignItems: 'center' }]}>
                                    <Text style={styles.mainButtonText}>
                                        {currentLevelId > 1 ? `RESUME LEVEL ${currentLevelId}` : 'NEW GAME'}
                                    </Text>
                                </Animated.View>
                            </Pressable>
                        </Animated.View>

                        {/* Reset All Levels Button */}
                        <Animated.View entering={FadeInDown.duration(600).delay(450).springify()}>
                            <Pressable 
                                onPress={() => resetProgress()}
                                onPressIn={() => {
                                    playPop();
                                    resetPressY.value = withSpring(6, { damping: 14, stiffness: 200 })
                                }}
                                onPressOut={() => resetPressY.value = withSpring(0, { damping: 14, stiffness: 200 })}
                                style={styles.secondaryButton}
                            >
                                <Canvas style={StyleSheet.absoluteFill}>
                                    <RoundedRect x={0} y={8} width={240} height={56} r={16} color="rgba(0,0,0,0.1)" />
                                    <RoundedRect x={0} y={6} width={240} height={52} r={16} color="#c2b5a1" />
                                    <Group transform={resetTransform}>
                                        <RoundedRect x={0} y={0} width={240} height={52} r={16} color="#d8cfb8" />
                                    </Group>
                                </Canvas>
                                <Animated.View style={[{ transform: resetTransform, width: '100%', height: 52, justifyContent: 'center', alignItems: 'center' }]}>
                                    <Text style={styles.secondaryButtonText}>RESET ALL LEVELS</Text>
                                </Animated.View>
                            </Pressable>
                        </Animated.View>

                    </View>
                </View>
            </SafeAreaView>
        </View>
    )
}

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
    secondaryButtonText: {
        fontSize: 16,
        fontFamily: 'Nunito-ExtraBold',
        color: '#5a4230',
        letterSpacing: 1,
    },
})
