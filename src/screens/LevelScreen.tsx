import {
    View,
    Text,
    StyleSheet,
    Pressable,
    FlatList,
    ListRenderItem,
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
    useWindowDimensions,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Canvas, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import Animated, {
    FadeIn,
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useLevelStore } from '../store/useLevelStore';
import levelsDataJson from '../assets/levels.json';
import type { LevelData } from '../components/PuzzleBoard';
import { soundManager } from '../utils/soundManager';

const levelsData = levelsDataJson as LevelData[];

// ── Layout ────────────────────────────────────────────────────────
const LEVELS_PER_CHAPTER = 15;
const GRID_COLS = 3;
const GRID_ROWS = LEVELS_PER_CHAPTER / GRID_COLS;
const PAGE_PADDING = 24;
const TILE_GAP = 14;
const TILE_DEPTH = 6;
const CHAPTER_HEADER_HEIGHT = 92;
const MAX_STARS = 3;

// ── Palette ───────────────────────────────────────────────────────
const COLORS = {
    background: '#e4dccf',
    text: '#5a4230',
    textMuted: '#9a8670',
    card: '#f8f4e6',
    cardEdge: '#d8cfb8',
    unlockedFace: '#f39c12',
    unlockedEdge: '#c27d0e',
    currentFace: '#27ae60',
    currentEdge: '#1e8449',
    lockedFace: '#d8cfb8',
    lockedEdge: '#b5ad9a',
    lock: 'rgba(90,66,48,0.35)',
    starOn: '#ffd23f',
    starOff: 'rgba(0,0,0,0.18)',
    progressTrack: '#e7dfcc',
    progressFill: '#f39c12',
};

const CHAPTER_NAMES = ['Warm Up', 'Getting Tricky', 'Brain Teaser', 'Expert', 'Master'];

interface Chapter {
    index: number;
    name: string;
    firstLevel: number;
    lastLevel: number;
    boardLabel: string;
}

const CHAPTERS: Chapter[] = Array.from({ length: Math.ceil(levelsData.length / LEVELS_PER_CHAPTER) }, (_, index) => {
    const firstLevel = index * LEVELS_PER_CHAPTER + 1;
    const lastLevel = Math.min(firstLevel + LEVELS_PER_CHAPTER - 1, levelsData.length);
    const board = levelsData[firstLevel - 1].board_size;
    return {
        index,
        name: CHAPTER_NAMES[index] ?? `Chapter ${index + 1}`,
        firstLevel,
        lastLevel,
        boardLabel: `${board.cols}×${board.rows}`,
    };
});

const TOTAL_STARS = levelsData.length * MAX_STARS;

const backIconPath = Skia.Path.MakeFromSVGString(
    'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'
)!;

const chapterStars = (chapter: Chapter, levelStars: Record<number, number>) => {
    let total = 0;
    for (let id = chapter.firstLevel; id <= chapter.lastLevel; id++) total += levelStars[id] || 0;
    return total;
};

// ── Small pieces ──────────────────────────────────────────────────
const LockIcon = ({ size }: { size: number }) => (
    <View style={styles.lockIcon}>
        <View
            style={[
                styles.lockShackle,
                {
                    width: size * 0.52,
                    height: size * 0.42,
                    borderWidth: size * 0.12,
                    borderTopLeftRadius: size * 0.26,
                    borderTopRightRadius: size * 0.26,
                },
            ]}
        />
        <View style={[styles.lockBody, { width: size * 0.8, height: size * 0.58, borderRadius: size * 0.14 }]} />
    </View>
);

const StarRow = ({ earned, size }: { earned: number; size: number }) => (
    <View style={styles.starRow}>
        {Array.from({ length: MAX_STARS }, (_, i) => (
            <Text
                key={i}
                style={[
                    styles.star,
                    { fontSize: size, lineHeight: size * 1.15, color: i < earned ? COLORS.starOn : COLORS.starOff },
                ]}
            >
                ★
            </Text>
        ))}
    </View>
);

// ── Level tile ────────────────────────────────────────────────────
interface LevelTileProps {
    levelId: number;
    size: number;
    isUnlocked: boolean;
    isCurrent: boolean;
    starsEarned: number;
    onPress: (levelId: number) => void;
}

const LevelTile = React.memo(({ levelId, size, isUnlocked, isCurrent, starsEarned, onPress }: LevelTileProps) => {
    const pressScale = useSharedValue(1);
    const pulse = useSharedValue(1);

    useEffect(() => {
        if (!isCurrent) return;
        pulse.value = withRepeat(
            withSequence(withTiming(1.05, { duration: 700 }), withTiming(1, { duration: 700 })),
            -1
        );
        return () => cancelAnimation(pulse);
    }, [isCurrent, pulse]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pressScale.value * pulse.value }],
    }));

    const face = !isUnlocked ? COLORS.lockedFace : isCurrent ? COLORS.currentFace : COLORS.unlockedFace;
    const edge = !isUnlocked ? COLORS.lockedEdge : isCurrent ? COLORS.currentEdge : COLORS.unlockedEdge;
    const faceHeight = size - TILE_DEPTH;

    return (
        <Pressable
            disabled={!isUnlocked}
            onPress={() => onPress(levelId)}
            onPressIn={() => {
                soundManager.playPop();
                pressScale.value = withSpring(0.9, { damping: 14 });
            }}
            onPressOut={() => {
                pressScale.value = withSpring(1, { damping: 14 });
            }}
            accessibilityRole="button"
            accessibilityLabel={isUnlocked ? `Level ${levelId}, ${starsEarned} stars` : `Level ${levelId}, locked`}
        >
            <Animated.View style={[{ width: size, height: size }, animatedStyle]}>
                <View style={[styles.tileShadow, { height: faceHeight, top: TILE_DEPTH + 3 }]} />
                <View style={[styles.tileEdge, { height: faceHeight, top: TILE_DEPTH, backgroundColor: edge }]} />
                <View style={[styles.tileFace, { height: faceHeight, backgroundColor: face }, isCurrent && styles.tileCurrent]}>
                    {isUnlocked ? (
                        <>
                            <Text style={[styles.tileNumber, { fontSize: size * 0.34 }]}>{levelId}</Text>
                            {isCurrent ? (
                                <Text style={[styles.tilePlay, { fontSize: size * 0.13 }]}>PLAY</Text>
                            ) : (
                                <StarRow earned={starsEarned} size={size * 0.17} />
                            )}
                        </>
                    ) : (
                        <LockIcon size={size * 0.32} />
                    )}
                </View>
            </Animated.View>
        </Pressable>
    );
});

// ── Chapter page ──────────────────────────────────────────────────
interface ChapterPageProps {
    chapter: Chapter;
    width: number;
    height: number;
    maxUnlockedLevel: number;
    levelStars: Record<number, number>;
    onPlay: (levelId: number) => void;
}

const ChapterPage = React.memo(({ chapter, width, height, maxUnlockedLevel, levelStars, onPlay }: ChapterPageProps) => {
    const isLocked = chapter.firstLevel > maxUnlockedLevel;
    const stars = chapterStars(chapter, levelStars);
    const maxStars = (chapter.lastLevel - chapter.firstLevel + 1) * MAX_STARS;

    const gridHeight = height - CHAPTER_HEADER_HEIGHT;
    const tileSize = Math.floor(
        Math.min(
            (width - PAGE_PADDING * 2 - TILE_GAP * (GRID_COLS - 1)) / GRID_COLS,
            (gridHeight - TILE_GAP * (GRID_ROWS - 1)) / GRID_ROWS
        )
    );

    const levelIds = Array.from({ length: chapter.lastLevel - chapter.firstLevel + 1 }, (_, i) => chapter.firstLevel + i);

    return (
        <View style={[styles.page, { width, height }]}>
            <View style={styles.chapterHeader}>
                <View style={styles.chapterTitleRow}>
                    <View style={styles.chapterTitles}>
                        <Text style={styles.chapterLabel}>
                            CHAPTER {chapter.index + 1} · {chapter.boardLabel}
                        </Text>
                        <Text style={styles.chapterName}>{chapter.name}</Text>
                    </View>
                    <Text style={styles.chapterStars}>
                        <Text style={styles.starOnText}>★ </Text>
                        {stars}/{maxStars}
                    </Text>
                </View>
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${(stars / maxStars) * 100}%` }]} />
                </View>
            </View>

            <View style={[styles.grid, { width: tileSize * GRID_COLS + TILE_GAP * (GRID_COLS - 1) }]}>
                {levelIds.map((levelId) => (
                    <LevelTile
                        key={levelId}
                        levelId={levelId}
                        size={tileSize}
                        isUnlocked={levelId <= maxUnlockedLevel}
                        isCurrent={levelId === maxUnlockedLevel}
                        starsEarned={levelStars[levelId] || 0}
                        onPress={onPlay}
                    />
                ))}
            </View>

            {isLocked && (
                <View style={styles.lockedBanner} pointerEvents="none">
                    <Text style={styles.lockedBannerText}>Finish chapter {chapter.index} to unlock</Text>
                </View>
            )}
        </View>
    );
});

// ── Screen ────────────────────────────────────────────────────────
export const LevelScreen = () => {
    const navigation = useNavigation<any>();
    const { width } = useWindowDimensions();
    const maxUnlockedLevel = useLevelStore((state) => state.maxUnlockedLevel);
    const playLevel = useLevelStore((state) => state.playLevel);
    const levelStars = useLevelStore((state) => state.levelStars);
    const backScale = useSharedValue(1);
    const backStyle = useAnimatedStyle(() => ({ transform: [{ scale: backScale.value }] }));

    const currentChapter = Math.min(Math.floor((maxUnlockedLevel - 1) / LEVELS_PER_CHAPTER), CHAPTERS.length - 1);
    const [page, setPage] = useState(currentChapter);
    const [pagerHeight, setPagerHeight] = useState(0);
    const listRef = useRef<FlatList<Chapter>>(null);

    const totalStars = useMemo(() => Object.values(levelStars).reduce((sum, s) => sum + (s || 0), 0), [levelStars]);

    const handlePlay = useCallback(
        (levelId: number) => {
            playLevel(levelId);
            navigation.navigate('Play');
        },
        [playLevel, navigation]
    );

    const goToPage = useCallback(
        (index: number) => {
            const clamped = Math.max(0, Math.min(index, CHAPTERS.length - 1));
            soundManager.playPop();
            setPage(clamped);
            listRef.current?.scrollToIndex({ index: clamped, animated: true });
        },
        []
    );

    const handleMomentumEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            setPage(Math.round(e.nativeEvent.contentOffset.x / width));
        },
        [width]
    );

    const handlePagerLayout = useCallback((e: LayoutChangeEvent) => {
        setPagerHeight(e.nativeEvent.layout.height);
    }, []);

    const renderItem: ListRenderItem<Chapter> = useCallback(
        ({ item }) => (
            <ChapterPage
                chapter={item}
                width={width}
                height={pagerHeight}
                maxUnlockedLevel={maxUnlockedLevel}
                levelStars={levelStars}
                onPlay={handlePlay}
            />
        ),
        [width, pagerHeight, maxUnlockedLevel, levelStars, handlePlay]
    );

    const getItemLayout = useCallback(
        (_: ArrayLike<Chapter> | null | undefined, index: number) => ({ length: width, offset: width * index, index }),
        [width]
    );

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        onPressIn={() => {
                            soundManager.playPop();
                            backScale.value = withSpring(0.85, { damping: 14 });
                        }}
                        onPressOut={() => {
                            backScale.value = withSpring(1, { damping: 14 });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                    >
                        <Animated.View style={[styles.backButton, backStyle]}>
                            <Canvas style={StyleSheet.absoluteFill}>
                                <RoundedRect x={0} y={6} width={48} height={42} r={14} color="rgba(0,0,0,0.15)" />
                                <RoundedRect x={0} y={4} width={48} height={40} r={14} color={COLORS.cardEdge} />
                                <RoundedRect x={0} y={0} width={48} height={40} r={14} color={COLORS.card} />
                                <Path path={backIconPath} color={COLORS.text} transform={[{ translateX: 12 }, { translateY: 8 }]} />
                            </Canvas>
                        </Animated.View>
                    </Pressable>
                    <Text style={styles.headerTitle}>LEVELS</Text>
                    <View style={styles.starsPill}>
                        <Text style={styles.starsPillText}>
                            <Text style={styles.starOnText}>★ </Text>
                            {totalStars}
                            <Text style={styles.starsPillTotal}>/{TOTAL_STARS}</Text>
                        </Text>
                    </View>
                </View>

                <View style={styles.pager} onLayout={handlePagerLayout}>
                    {pagerHeight > 0 && (
                        <Animated.View entering={FadeIn.duration(250)} style={styles.pagerInner}>
                            <FlatList
                                ref={listRef}
                                data={CHAPTERS}
                                renderItem={renderItem}
                                keyExtractor={(item) => `chapter-${item.index}`}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                initialScrollIndex={currentChapter}
                                getItemLayout={getItemLayout}
                                onMomentumScrollEnd={handleMomentumEnd}
                                windowSize={3}
                                initialNumToRender={1}
                            />
                        </Animated.View>
                    )}
                </View>

                <View style={styles.footer}>
                    <Pressable
                        onPress={() => goToPage(page - 1)}
                        disabled={page === 0}
                        style={[styles.arrowButton, page === 0 && styles.arrowDisabled]}
                        accessibilityRole="button"
                        accessibilityLabel="Previous chapter"
                    >
                        <Text style={styles.arrowText}>‹</Text>
                    </Pressable>
                    <View style={styles.dots}>
                        {CHAPTERS.map((chapter) => (
                            <Pressable
                                key={chapter.index}
                                onPress={() => goToPage(chapter.index)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={`Chapter ${chapter.index + 1}`}
                            >
                                <View style={[styles.dot, chapter.index === page && styles.dotActive]} />
                            </Pressable>
                        ))}
                    </View>
                    <Pressable
                        onPress={() => goToPage(page + 1)}
                        disabled={page === CHAPTERS.length - 1}
                        style={[styles.arrowButton, page === CHAPTERS.length - 1 && styles.arrowDisabled]}
                        accessibilityRole="button"
                        accessibilityLabel="Next chapter"
                    >
                        <Text style={styles.arrowText}>›</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        height: 64,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    backButton: {
        width: 48,
        height: 48,
    },
    headerTitle: {
        fontSize: 26,
        fontFamily: 'Fredoka-Bold',
        color: COLORS.text,
        letterSpacing: 2,
    },
    starsPill: {
        minWidth: 48,
        height: 36,
        paddingHorizontal: 12,
        borderRadius: 18,
        backgroundColor: COLORS.card,
        borderBottomWidth: 4,
        borderBottomColor: COLORS.cardEdge,
        justifyContent: 'center',
        alignItems: 'center',
    },
    starsPillText: {
        fontSize: 15,
        fontFamily: 'Nunito-ExtraBold',
        color: COLORS.text,
    },
    starsPillTotal: {
        color: COLORS.textMuted,
        fontSize: 12,
    },
    starOnText: {
        color: COLORS.starOn,
    },
    pager: {
        flex: 1,
    },
    pagerInner: {
        flex: 1,
    },
    page: {
        paddingHorizontal: PAGE_PADDING,
        alignItems: 'center',
    },
    chapterHeader: {
        height: CHAPTER_HEADER_HEIGHT - 16,
        width: '100%',
        marginTop: 4,
        marginBottom: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 18,
        backgroundColor: COLORS.card,
        borderBottomWidth: 5,
        borderBottomColor: COLORS.cardEdge,
        justifyContent: 'space-between',
    },
    chapterTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    chapterTitles: {
        flexShrink: 1,
    },
    chapterLabel: {
        fontSize: 11,
        fontFamily: 'Nunito-ExtraBold',
        color: COLORS.textMuted,
        letterSpacing: 1.5,
    },
    chapterName: {
        fontSize: 22,
        fontFamily: 'Fredoka-Bold',
        color: COLORS.text,
    },
    chapterStars: {
        fontSize: 15,
        fontFamily: 'Nunito-ExtraBold',
        color: COLORS.text,
    },
    progressTrack: {
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.progressTrack,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
        backgroundColor: COLORS.progressFill,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: TILE_GAP,
    },
    tileShadow: {
        position: 'absolute',
        left: 0,
        right: 0,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.12)',
    },
    tileEdge: {
        position: 'absolute',
        left: 0,
        right: 0,
        borderRadius: 18,
    },
    tileFace: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tileCurrent: {
        borderWidth: 3,
        borderColor: 'white',
    },
    tileNumber: {
        fontFamily: 'Fredoka-Bold',
        color: 'white',
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 2,
    },
    tilePlay: {
        fontFamily: 'Nunito-ExtraBold',
        color: 'white',
        letterSpacing: 1.5,
        marginTop: -2,
    },
    starRow: {
        flexDirection: 'row',
        marginTop: -2,
    },
    star: {
        marginHorizontal: 1,
    },
    lockIcon: {
        alignItems: 'center',
    },
    lockShackle: {
        borderColor: COLORS.lock,
        borderBottomWidth: 0,
        marginBottom: -1,
    },
    lockBody: {
        backgroundColor: COLORS.lock,
    },
    lockedBanner: {
        position: 'absolute',
        bottom: 8,
        alignSelf: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 14,
        backgroundColor: 'rgba(90,66,48,0.85)',
    },
    lockedBannerText: {
        fontSize: 14,
        fontFamily: 'Nunito-ExtraBold',
        color: COLORS.card,
    },
    footer: {
        height: 72,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: PAGE_PADDING,
    },
    arrowButton: {
        width: 48,
        height: 44,
        borderRadius: 14,
        backgroundColor: COLORS.card,
        borderBottomWidth: 4,
        borderBottomColor: COLORS.cardEdge,
        justifyContent: 'center',
        alignItems: 'center',
    },
    arrowDisabled: {
        opacity: 0.35,
    },
    arrowText: {
        fontSize: 30,
        lineHeight: 34,
        fontFamily: 'Fredoka-Bold',
        color: COLORS.text,
    },
    dots: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.cardEdge,
    },
    dotActive: {
        width: 26,
        backgroundColor: COLORS.progressFill,
    },
});
