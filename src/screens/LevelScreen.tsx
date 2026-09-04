import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown, withSpring, useSharedValue } from 'react-native-reanimated'
import { useNavigation } from '@react-navigation/native'
import { Canvas, RoundedRect, LinearGradient, vec, Skia, Path } from '@shopify/react-native-skia'
import Sound from 'react-native-sound'

import { useLevelStore } from '../store/useLevelStore'
import levelsDataJson from '../assets/levels.json'

const popSound = new Sound(Image.resolveAssetSource(require('../assets/sounds/pop.mp3'))?.uri ?? '', '', (error) => {
    if (error) console.log('failed to load pop sound', error);
    popSound?.setVolume(0.3);
});

const playPop = () => {
    popSound?.stop(() => {
        popSound?.play();
    });
};

const backIconPath = Skia.Path.MakeFromSVGString(
    "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
)!

const lockIconPath = Skia.Path.MakeFromSVGString(
    "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"
)!


export const LevelScreen = () => {
    const navigation = useNavigation<any>()
    const maxUnlockedLevel = useLevelStore(state => state.maxUnlockedLevel)
    const playLevel = useLevelStore(state => state.playLevel)
    const backScale = useSharedValue(1)

    const totalLevels = levelsDataJson.length

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        onPressIn={() => {
                            playPop();
                            backScale.value = withSpring(0.8, { damping: 14, stiffness: 200 })
                        }}
                        onPressOut={() => backScale.value = withSpring(1, { damping: 14, stiffness: 200 })}
                    >
                        <Animated.View style={[styles.backButton, { transform: [{ scale: backScale }] }]}>
                            <Canvas style={StyleSheet.absoluteFill}>
                                <RoundedRect x={0} y={0} width={44} height={44} r={22} color="rgba(255,255,255,0.15)" />
                                <Path path={backIconPath} color="white" transform={[{ translateX: 10 }, { translateY: 10 }]} />
                            </Canvas>
                        </Animated.View>
                    </Pressable>
                    <Text style={styles.headerTitle}>Select Level</Text>
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView contentContainerStyle={styles.gridContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.grid}>
                        {Array.from({ length: totalLevels }).map((_, index) => {
                            const levelId = index + 1
                            const isUnlocked = levelId <= maxUnlockedLevel
                            const delay = Math.min(index * 15, 600)

                            return (
                                <Animated.View 
                                    key={levelId}
                                    entering={FadeInDown.delay(delay).springify().damping(12).stiffness(150)}
                                >
                                    <LevelButton 
                                        levelId={levelId} 
                                        isUnlocked={isUnlocked} 
                                        onPress={() => {
                                            playLevel(levelId)
                                            navigation.navigate('Play')
                                        }} 
                                    />
                                </Animated.View>
                            )
                        })}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    )
}

const LevelButton = ({ levelId, isUnlocked, onPress }: { levelId: number, isUnlocked: boolean, onPress: () => void }) => {
    const scale = useSharedValue(1)

    return (
        <Pressable
            disabled={!isUnlocked}
            onPress={onPress}
            onPressIn={() => {
                if (isUnlocked) {
                    playPop();
                    scale.value = withSpring(0.85, { damping: 14, stiffness: 200 })
                }
            }}
            onPressOut={() => scale.value = withSpring(1, { damping: 14, stiffness: 200 })}
        >
            <Animated.View style={[styles.levelButton, { transform: [{ scale }] }, !isUnlocked && styles.levelButtonLocked]}>
                <Canvas style={StyleSheet.absoluteFill}>
                    <RoundedRect x={0} y={0} width={76} height={76} r={20} color="rgba(255,255,255,0.05)">
                        {isUnlocked ? (
                            <LinearGradient
                                start={vec(0, 0)}
                                end={vec(76, 76)}
                                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.05)']}
                            />
                        ) : null}
                    </RoundedRect>
                    
                    {!isUnlocked ? (
                        <Path path={lockIconPath} color="rgba(255,255,255,0.3)" transform={[{ scale: 0.8 }, { translateX: 26 }, { translateY: 26 }]} />
                    ) : null}
                </Canvas>
                {isUnlocked ? <Text style={styles.levelText}>{levelId}</Text> : null}
            </Animated.View>
        </Pressable>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1E1B2E', // Premium dark purple/blue background
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    backButton: {
        width: 44,
        height: 44,
    },
    headerTitle: {
        fontSize: 24,
        fontFamily: 'System',
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    gridContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 10,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
    },
    levelButton: {
        width: 76,
        height: 76,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    levelButtonLocked: {
        backgroundColor: 'transparent',
        borderColor: 'rgba(255,255,255,0.02)',
        shadowOpacity: 0,
    },
    levelText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
    }
})
