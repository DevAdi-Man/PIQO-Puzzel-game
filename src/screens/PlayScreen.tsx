import { View, Text, StyleSheet } from 'react-native'
import React, { useCallback, useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Canvas, Group, Path, RoundedRect, Skia, useImage } from '@shopify/react-native-skia'
import Animated, { FadeIn, ZoomInUp } from 'react-native-reanimated'
import { Pressable } from 'react-native-gesture-handler'

import { useLevelStore } from '../store/useLevelStore'
import { PuzzleBoard, LevelData } from '../components/PuzzleBoard'
import levelsDataJson from '../assets/levels.json'

// Cast the JSON to our LevelData interface
const levelsData = levelsDataJson as LevelData[]

// ── Image Asset Mapping ───────────────────────────────────────────
// React Native requires static strings for require().
// This map makes it incredibly easy to swap out images in the future
// while dynamically choosing them based on levels.json.
const ImageAssets: Record<string, any> = {
    'puzzle1': require('../assets/images/puzzle.jpg'),
    'puzzle2': require('../assets/images/puzzle.jpg'), // Using the same image for now
    'puzzle3': require('../assets/images/puzzle.jpg'), // Using the same image for now
}

// ── Icons ─────────────────────────────────────────────────────────
const resetIconPath = Skia.Path.MakeFromSVGString(
    "M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
)
const nextIconPath = Skia.Path.MakeFromSVGString(
    "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"
)

export const PlayScreen = () => {
    // ── Persistent State ──────────────────────────────────────────
    const { currentLevelId, completeLevel } = useLevelStore()
    
    // Find the level config from the JSON file
    const levelData = levelsData.find(l => l.level_id === currentLevelId) || levelsData[0]

    // Load the correct mapped image
    const imageResource = ImageAssets[levelData.image] || ImageAssets['puzzle1']
    const image = useImage(imageResource)

    // ── Timer State ───────────────────────────────────────────────
    const [timeLeft, setTimeLeft] = useState(300) // 5:00 minutes
    const [isSolved, setIsSolved] = useState(false)
    const [showOverlay, setShowOverlay] = useState(false)
    const [resetKey, setResetKey] = useState(0) // Forces a full remount on "reset"

    // Reset timer state when a new level mounts or user taps "Reset"
    useEffect(() => {
        setTimeLeft(300)
        setIsSolved(false)
        setShowOverlay(false)
    }, [currentLevelId, resetKey])

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (isSolved || prev <= 0) return prev;
                return prev - 1;
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [isSolved])

    const mins = Math.floor(timeLeft / 60)
    const secs = (timeLeft % 60).toString().padStart(2, '0')
    const timeString = `${mins}:${secs}`

    // ── Handlers ──────────────────────────────────────────────────
    const handlePuzzleSolved = useCallback(() => {
        setIsSolved(true)
        setTimeout(() => {
            setShowOverlay(true)
        }, 1500)
    }, [])

    const handleLevelComplete = useCallback(() => {
        completeLevel() // Proceed to the next level in MMKV state
    }, [completeLevel])

    const handleResetLevel = useCallback(() => {
        setResetKey(k => k + 1) // Updating this key causes PuzzleBoard to completely remount!
    }, [])

    if (!image) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#f7e5d0', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={styles.headerText}>Loading Image...</Text>
            </SafeAreaView>
        )
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#e4dccf' }}>
            <SafeAreaView style={{ flex: 1 }}>
                {/* ── UI Header ── */}
                <View style={styles.headerContainer}>
                    <View style={styles.headerCenter}>
                        <Text style={styles.levelText}>LEVEL {currentLevelId}</Text>
                        <View style={{ width: 100, height: 44, marginTop: 6, justifyContent: 'center', alignItems: 'center' }}>
                            <Canvas style={{ ...StyleSheet.absoluteFill }}>
                                <RoundedRect x={0} y={6} width={100} height={38} r={18} color="rgba(0,0,0,0.15)" />
                                <RoundedRect x={0} y={4} width={100} height={36} r={18} color="#d8cfb8" />
                                <RoundedRect x={0} y={0} width={100} height={36} r={18} color="#f8f4e6" />
                            </Canvas>
                            <Text style={{ fontSize: 20, fontWeight: '900', color: '#5a4230' }}>{timeString}</Text>
                        </View>
                    </View>
                    <Pressable onPress={handleResetLevel} style={{ position: 'absolute', right: 20, top: 16, width: 48, height: 48 }}>
                        <Canvas style={{ flex: 1 }}>
                            <RoundedRect x={0} y={6} width={48} height={42} r={12} color="rgba(0,0,0,0.15)" />
                            <RoundedRect x={0} y={4} width={48} height={40} r={12} color="#d8cfb8" />
                            <RoundedRect x={0} y={0} width={48} height={40} r={12} color="#f8f4e6" />
                            {resetIconPath && (
                                <Group transform={[{ translateX: 10.5 }, { translateY: 6.5 }, { scale: 1.15 }]}>
                                    <Path path={resetIconPath} color="#5a4230" />
                                </Group>
                            )}
                        </Canvas>
                    </Pressable>
                </View>

                {/* ── Puzzle Engine ── */}
                {/* Using key={currentLevelId + resetKey} causes React to completely tear down and safely rebuild the entire puzzle engine */}
                <PuzzleBoard 
                    key={`level-${currentLevelId}-reset-${resetKey}`}
                    levelData={levelData}
                    image={image}
                    onPuzzleSolved={handlePuzzleSolved}
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
                    <View style={{ alignItems: 'center' }}>
                        <Animated.Text 
                            entering={ZoomInUp.duration(500)} 
                            style={styles.completionText}
                        >
                            WELL DONE!
                        </Animated.Text>
                        
                        <Animated.View entering={ZoomInUp.duration(500).delay(200)}>
                            <Pressable onPress={handleLevelComplete} style={{ width: 120, height: 60, marginTop: 32 }}>
                                <Canvas style={{ flex: 1 }}>
                                    <RoundedRect x={0} y={10} width={120} height={50} r={16} color="rgba(0,0,0,0.15)" />
                                    <RoundedRect x={0} y={6} width={120} height={48} r={16} color="#3d2a1d" />
                                    <RoundedRect x={0} y={0} width={120} height={48} r={16} color="#5a4230" />
                                    {nextIconPath && (
                                        <Group transform={[{ translateX: 42 }, { translateY: 6 }, { scale: 1.5 }]}>
                                            <Path path={nextIconPath} color="white" />
                                        </Group>
                                    )}
                                </Canvas>
                            </Pressable>
                        </Animated.View>
                    </View>
                </Animated.View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    headerText: {
        fontSize: 16,
        fontWeight: '700',
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
    headerCenter: {
        alignItems: 'center',
    },
    levelText: {
        fontSize: 18,
        fontWeight: '900',
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
        fontWeight: '800',
        color: '#5a4230',
        textAlign: 'center',
        lineHeight: 28,
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
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 2,
        textShadowColor: 'rgba(0, 0, 0, 0.4)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 8,
    },
})
