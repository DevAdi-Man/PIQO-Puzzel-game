import { View, Text, StyleSheet, Pressable, Dimensions, FlatList, ListRenderItem, Image } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Canvas, Group, Path, RoundedRect, Skia } from '@shopify/react-native-skia'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { useNavigation } from '@react-navigation/native'
import Sound from 'react-native-sound'
import { useLevelStore } from '../store/useLevelStore'
import levelsDataJson from '../assets/levels.json'
import { Star } from '../components/Star'

const { width } = Dimensions.get('window')
const numColumns = 4
const boxSize = (width - 60) / numColumns

// Setup pop sound
const popSound = new Sound(Image.resolveAssetSource(require('../assets/sounds/pop.mp3'))?.uri ?? '', '', (error) => {
    if (error) console.log('failed to load pop sound', error);
    popSound?.setVolume(0.3);
});

const playPop = () => {
    popSound?.stop(() => {
        popSound?.play();
    });
};

// SVG Paths
const lockIconPath = Skia.Path.MakeFromSVGString(
    "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"
)!

const backIconPath = Skia.Path.MakeFromSVGString(
    "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
)!

const LevelBox = ({ levelId, isUnlocked, isCurrent, starsEarned, onPress }: { levelId: number, isUnlocked: boolean, isCurrent: boolean, starsEarned: number, onPress: () => void }) => {
    const scale = useSharedValue(1)
    
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }))

    return (
        <View style={{ width: boxSize, height: boxSize, marginBottom: 15, overflow: 'visible' }}>
            <Pressable
                disabled={!isUnlocked}
                onPress={onPress}
                onPressIn={() => {
                    if (isUnlocked) {
                        playPop()
                        scale.value = withSpring(0.9, { damping: 14 })
                    }
                }}
                onPressOut={() => scale.value = withSpring(1, { damping: 14 })}
                style={{ flex: 1 }}
            >
                <Animated.View style={[styles.box, animatedStyle]}>
                    <Canvas style={StyleSheet.absoluteFill}>
                        {/* Drop Shadow */}
                        <RoundedRect x={0} y={6} width={boxSize} height={boxSize - 6} r={16} color="rgba(0,0,0,0.15)" />
                        
                        {/* Base Extrusion */}
                        <RoundedRect x={0} y={4} width={boxSize} height={boxSize - 6} r={16} color={isUnlocked ? (isCurrent ? "#1e8449" : "#c27d0e") : "#b5ad9a"} />
                        
                        {/* Top Surface */}
                        <RoundedRect x={0} y={0} width={boxSize} height={boxSize - 6} r={16} color={isUnlocked ? (isCurrent ? "#27ae60" : "#f39c12") : "#d8cfb8"} />
                        
                        {/* Current Level Outline Highlight */}
                        {isCurrent && (
                            <RoundedRect x={0} y={0} width={boxSize} height={boxSize - 6} r={16} color="white" style="stroke" strokeWidth={4} />
                        )}
                    </Canvas>
                    
                    <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', paddingBottom: 4 }]}>
                        {isUnlocked ? (
                            <Text style={[styles.boxText]}>{levelId}</Text>
                        ) : (
                            <Canvas style={{ width: 24, height: 24 }}>
                                <Path path={lockIconPath} color="rgba(0,0,0,0.2)" />
                            </Canvas>
                        )}
                    </View>
                </Animated.View>
            </Pressable>
            
            {isUnlocked && !isCurrent && (
                <View style={{ position: 'absolute', top: -28, left: -10, right: -10, height: 48 }} pointerEvents="none">
                    <Canvas style={{ flex: 1 }}>
                        <Group transform={[{ translateX: (boxSize / 2) + 10 }, { translateY: 28 }]}>
                            <Star x={-30} y={6} scale={1.0} isEmpty={starsEarned < 1} />
                            <Star x={0} y={-6} scale={1.2} isEmpty={starsEarned < 2} />
                            <Star x={30} y={6} scale={1.0} isEmpty={starsEarned < 3} />
                        </Group>
                    </Canvas>
                </View>
            )}
        </View>
    )
}

export const LevelScreen = () => {
    const navigation = useNavigation<any>()
    const maxUnlockedLevel = useLevelStore(state => state.maxUnlockedLevel)
    const playLevel = useLevelStore(state => state.playLevel)
    const levelStars = useLevelStore(state => state.levelStars)
    const backScale = useSharedValue(1)

    // Fallback if levels array is missing
    const levelsArray = Array.isArray(levelsDataJson) ? levelsDataJson : Array.from({ length: 75 })

    const renderItem: ListRenderItem<any> = ({ item, index }) => {
        const levelId = index + 1
        const isUnlocked = levelId <= maxUnlockedLevel
        const isCurrent = levelId === maxUnlockedLevel
        const starsEarned = levelStars[levelId] || 0

        return (
            <LevelBox
                levelId={levelId}
                isUnlocked={isUnlocked}
                isCurrent={isCurrent}
                starsEarned={starsEarned}
                onPress={() => {
                    playLevel(levelId)
                    navigation.navigate('Play')
                }}
            />
        )
    }

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        onPressIn={() => {
                            playPop();
                            backScale.value = withSpring(0.8, { damping: 14 })
                        }}
                        onPressOut={() => backScale.value = withSpring(1, { damping: 14 })}
                    >
                        <Animated.View style={[styles.backButton, { transform: [{ scale: backScale }] }]}>
                            <Canvas style={StyleSheet.absoluteFill}>
                                <RoundedRect x={0} y={6} width={48} height={42} r={16} color="rgba(0,0,0,0.15)" />
                                <RoundedRect x={0} y={4} width={48} height={40} r={16} color="#d8cfb8" />
                                <RoundedRect x={0} y={0} width={48} height={40} r={16} color="#f8f4e6" />
                                <Path path={backIconPath} color="#5a4230" transform={[{ translateX: 12 }, { translateY: 8 }]} />
                            </Canvas>
                        </Animated.View>
                    </Pressable>
                    <Text style={styles.headerTitle}>Select Level</Text>
                    <View style={{ width: 48 }} />
                </View>
                
                <FlatList
                    data={levelsArray}
                    renderItem={renderItem}
                    keyExtractor={(_, i) => i.toString()}
                    numColumns={numColumns}
                    contentContainerStyle={styles.listContent}
                    columnWrapperStyle={styles.columnWrapper}
                    showsVerticalScrollIndicator={false}
                />
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
    header: {
        height: 60,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        marginBottom: 10,
    },
    backButton: {
        width: 48,
        height: 48,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#4a4a4a',
    },
    listContent: {
        padding: 15,
        paddingTop: 40, // Increased extra padding for larger top stars
        paddingBottom: 40,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    box: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    boxText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: {width: 0, height: 2},
        textShadowRadius: 2,
    },
})
