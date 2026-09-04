import { View, Text, useWindowDimensions, StyleSheet, Image } from 'react-native'
import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { Canvas, Group, Path, RoundedRect, Skia, Image as SkImage, Shadow, Rect, LinearGradient, vec, Mask, CornerPathEffect, PathOp } from '@shopify/react-native-skia'
import { useDerivedValue, useSharedValue, withTiming, withDelay, useAnimatedReaction, withSpring, interpolateColor } from 'react-native-reanimated'
import { GestureDetector, usePanGesture, Pressable } from 'react-native-gesture-handler'
import { scheduleOnRN } from 'react-native-worklets'
import type { SharedValue } from 'react-native-reanimated'
import type { SkImage as SkImageType } from '@shopify/react-native-skia'
import Sound from 'react-native-sound'

// ── Audio Globals ──────────────────────────────────────────────────
Sound.setCategory('Playback')

const whooshSound = new Sound(Image.resolveAssetSource(require('../assets/sounds/whoosh.mp3'))?.uri ?? '', '', (error) => {
    if (error) console.log('failed to load whoosh sound', error);
});

const popSound = new Sound(Image.resolveAssetSource(require('../assets/sounds/pop.mp3'))?.uri ?? '', '', (error) => {
    if (error) console.log('failed to load pop sound', error);
    popSound?.setVolume(0.3);
});

const correctSound = new Sound(Image.resolveAssetSource(require('../assets/sounds/correct.mp3'))?.uri ?? '', '', (error) => {
    if (error) console.log('failed to load correct sound', error);
});

const playWhoosh = () => {
    whooshSound?.stop(() => {
        whooshSound?.play();
    });
};

const playPop = () => {
    popSound?.stop(() => {
        popSound?.play();
    });
};

const playCorrect = () => {
    correctSound?.stop(() => {
        correctSound?.play();
    });
};

// ── Types ─────────────────────────────────────────────────────────
export interface Cell { x: number; y: number }
export interface PieceDef {
    id: string;
    cells: Cell[];
    target: Cell;
    spawn: Cell;
    color: string;
}
export interface LevelData {
    level_id: number;
    board_size: { cols: number; rows: number };
    puzzle_size: { cols: number; rows: number };
    image: string;
    pieces: PieceDef[];
}

export interface PuzzleBoardProps {
    levelData: LevelData;
    image: SkImageType | null;
    onPuzzleSolved: () => void;
    timeShared?: SharedValue<number>;
}

// ── Constants ─────────────────────────────────────────────────────
const GAP = 16
const BLEED = 50

// ── Per-piece state hook ──────────────────────────────────────────
function usePieceState(
    initialX: number,
    initialY: number,
    isPuzzleCompleted: SharedValue<boolean>,
    index: number,
    isActive: boolean
) {
    const posX = useSharedValue(initialX)
    const posY = useSharedValue(initialY)
    const entranceY = useSharedValue(-1200)

    const [isLanded, setIsLanded] = useState(false)
    const isLandedSV = useSharedValue(false)

    useEffect(() => {
        entranceY.value = -1200;
        isLandedSV.value = false;
        setIsLanded(false);
        const timeout = setTimeout(() => {
            entranceY.value = withSpring(0, { damping: 14, stiffness: 80, mass: 1 })
            setTimeout(() => {
                isLandedSV.value = true;
                setIsLanded(true);
            }, 1000)
        }, 1200 + index * 180)
        return () => clearTimeout(timeout)
    }, [index, entranceY, isLandedSV])

    const transform = useDerivedValue(() => [
        { translateX: posX.value },
        { translateY: posY.value + entranceY.value },
    ])

    return { posX, posY, entranceY, transform, isLanded, isLandedSV }
}

export const PuzzleBoard = ({ levelData, image, onPuzzleSolved, timeShared }: PuzzleBoardProps) => {
    const { width } = useWindowDimensions()

    const COLS = levelData.board_size.cols
    const ROWS = levelData.board_size.rows
    const PIECES = levelData.pieces

    const cellColor = useDerivedValue(() => {
        if (!timeShared) return '#f0cca3';
        return interpolateColor(
            timeShared.value,
            [0, 300],
            ['#8a3b30', '#f0cca3']
        );
    });

    // ── Board dimensions ──────────────────────────────────────────
    const boardSize = width * 0.9
    const cellSize = (boardSize - GAP * (COLS - 1)) / COLS
    const STEP = cellSize + GAP

    const PIECE_DIMS = useMemo(() => PIECES.map(p => ({
        w: Math.max(...p.cells.map(c => c.x)) + 1,
        h: Math.max(...p.cells.map(c => c.y)) + 1,
    })), [PIECES])

    // ── Global state ──────────────────────────────────────────────
    const isPuzzleCompleted = useSharedValue(false)
    const activePieceIndex = useSharedValue(-1)
    const start = useSharedValue({ x: 0, y: 0 })

    const borderOpacity = useDerivedValue(() =>
        withTiming(isPuzzleCompleted.value ? 0 : 1, { duration: 400 })
    )
    const completedOpacity = useDerivedValue(() =>
        withTiming(isPuzzleCompleted.value ? 1 : 0, { duration: 400 })
    )
    
    const shineX = useSharedValue(-boardSize * 1.5)
    useAnimatedReaction(
        () => isPuzzleCompleted.value,
        (completed, wasCompleted) => {
            if (completed && !wasCompleted) {
                shineX.value = withDelay(400, withTiming(boardSize * 1.5, { duration: 1000 }))
            }
        }
    )
    const shineStart = useDerivedValue(() => vec(shineX.value - 120, -GAP / 2))
    const shineEnd = useDerivedValue(() => vec(shineX.value + 120, 4 * STEP))

    // ── Create state for each piece ───────────────────────────────
    // Calculate non-overlapping random spawn positions using collision detection
    const spawnPositions = useMemo(() => {
        const positions: {x: number, y: number}[] = [];
        const N = PIECES.length;
        if (N === 0) return positions;

        let seed = levelData.level_id * 1337 + 42;
        const random = () => {
            const x = Math.sin(seed++) * 10000;
            return x - Math.floor(x);
        };

        const placedBoxes: {x: number, y: number, w: number, h: number}[] = [];

        for (let i = 0; i < N; i++) {
            const w = PIECE_DIMS[i].w;
            const h = PIECE_DIMS[i].h;

            let bestX = 0;
            let bestY = 0;
            let placed = false;

            // Try 50 random positions to find a spot with no overlapping bounding boxes
            for (let attempt = 0; attempt < 50; attempt++) {
                const randX = Math.floor(random() * Math.max(1, COLS - w + 1));
                const randY = Math.floor(random() * Math.max(1, ROWS - h + 1));

                let collision = false;
                for (const box of placedBoxes) {
                    if (
                        randX < box.x + box.w &&
                        randX + w > box.x &&
                        randY < box.y + box.h &&
                        randY + h > box.y
                    ) {
                        collision = true;
                        break;
                    }
                }

                if (!collision) {
                    bestX = randX;
                    bestY = randY;
                    placed = true;
                    break;
                }
            }

            // If the board is too crowded and we couldn't find a clean spot, fallback to a random spot
            if (!placed) {
                bestX = Math.floor(random() * Math.max(1, COLS - w + 1));
                bestY = Math.floor(random() * Math.max(1, ROWS - h + 1));
            }

            placedBoxes.push({ x: bestX, y: bestY, w, h });
            positions.push({ x: bestX, y: bestY });
        }
        return positions;
    }, [PIECES, PIECE_DIMS, COLS, ROWS, levelData.level_id])

    const getInitialX = (index: number) => {
        return (spawnPositions[index]?.x || 0) * STEP
    }

    const getInitialY = (index: number) => {
        return (spawnPositions[index]?.y || 0) * STEP
    }

        // We must call the exact same number of hooks every render. 40 is our max pieces bound.
    const allStates = [
        usePieceState(getInitialX(0), getInitialY(0), isPuzzleCompleted, 0, 0 < PIECES.length),
        usePieceState(getInitialX(1), getInitialY(1), isPuzzleCompleted, 1, 1 < PIECES.length),
        usePieceState(getInitialX(2), getInitialY(2), isPuzzleCompleted, 2, 2 < PIECES.length),
        usePieceState(getInitialX(3), getInitialY(3), isPuzzleCompleted, 3, 3 < PIECES.length),
        usePieceState(getInitialX(4), getInitialY(4), isPuzzleCompleted, 4, 4 < PIECES.length),
        usePieceState(getInitialX(5), getInitialY(5), isPuzzleCompleted, 5, 5 < PIECES.length),
        usePieceState(getInitialX(6), getInitialY(6), isPuzzleCompleted, 6, 6 < PIECES.length),
        usePieceState(getInitialX(7), getInitialY(7), isPuzzleCompleted, 7, 7 < PIECES.length),
        usePieceState(getInitialX(8), getInitialY(8), isPuzzleCompleted, 8, 8 < PIECES.length),
        usePieceState(getInitialX(9), getInitialY(9), isPuzzleCompleted, 9, 9 < PIECES.length),
        usePieceState(getInitialX(10), getInitialY(10), isPuzzleCompleted, 10, 10 < PIECES.length),
        usePieceState(getInitialX(11), getInitialY(11), isPuzzleCompleted, 11, 11 < PIECES.length),
        usePieceState(getInitialX(12), getInitialY(12), isPuzzleCompleted, 12, 12 < PIECES.length),
        usePieceState(getInitialX(13), getInitialY(13), isPuzzleCompleted, 13, 13 < PIECES.length),
        usePieceState(getInitialX(14), getInitialY(14), isPuzzleCompleted, 14, 14 < PIECES.length),
        usePieceState(getInitialX(15), getInitialY(15), isPuzzleCompleted, 15, 15 < PIECES.length),
        usePieceState(getInitialX(16), getInitialY(16), isPuzzleCompleted, 16, 16 < PIECES.length),
        usePieceState(getInitialX(17), getInitialY(17), isPuzzleCompleted, 17, 17 < PIECES.length),
        usePieceState(getInitialX(18), getInitialY(18), isPuzzleCompleted, 18, 18 < PIECES.length),
        usePieceState(getInitialX(19), getInitialY(19), isPuzzleCompleted, 19, 19 < PIECES.length),
        usePieceState(getInitialX(20), getInitialY(20), isPuzzleCompleted, 20, 20 < PIECES.length),
        usePieceState(getInitialX(21), getInitialY(21), isPuzzleCompleted, 21, 21 < PIECES.length),
        usePieceState(getInitialX(22), getInitialY(22), isPuzzleCompleted, 22, 22 < PIECES.length),
        usePieceState(getInitialX(23), getInitialY(23), isPuzzleCompleted, 23, 23 < PIECES.length),
        usePieceState(getInitialX(24), getInitialY(24), isPuzzleCompleted, 24, 24 < PIECES.length),
        usePieceState(getInitialX(25), getInitialY(25), isPuzzleCompleted, 25, 25 < PIECES.length),
        usePieceState(getInitialX(26), getInitialY(26), isPuzzleCompleted, 26, 26 < PIECES.length),
        usePieceState(getInitialX(27), getInitialY(27), isPuzzleCompleted, 27, 27 < PIECES.length),
        usePieceState(getInitialX(28), getInitialY(28), isPuzzleCompleted, 28, 28 < PIECES.length),
        usePieceState(getInitialX(29), getInitialY(29), isPuzzleCompleted, 29, 29 < PIECES.length),
        usePieceState(getInitialX(30), getInitialY(30), isPuzzleCompleted, 30, 30 < PIECES.length),
        usePieceState(getInitialX(31), getInitialY(31), isPuzzleCompleted, 31, 31 < PIECES.length),
        usePieceState(getInitialX(32), getInitialY(32), isPuzzleCompleted, 32, 32 < PIECES.length),
        usePieceState(getInitialX(33), getInitialY(33), isPuzzleCompleted, 33, 33 < PIECES.length),
        usePieceState(getInitialX(34), getInitialY(34), isPuzzleCompleted, 34, 34 < PIECES.length),
        usePieceState(getInitialX(35), getInitialY(35), isPuzzleCompleted, 35, 35 < PIECES.length),
        usePieceState(getInitialX(36), getInitialY(36), isPuzzleCompleted, 36, 36 < PIECES.length),
        usePieceState(getInitialX(37), getInitialY(37), isPuzzleCompleted, 37, 37 < PIECES.length),
        usePieceState(getInitialX(38), getInitialY(38), isPuzzleCompleted, 38, 38 < PIECES.length),
        usePieceState(getInitialX(39), getInitialY(39), isPuzzleCompleted, 39, 39 < PIECES.length),
    ]

    const pieceStates = useMemo(() => allStates.slice(0, PIECES.length), [PIECES.length])

    const [frontPiece, setFrontPiece] = useState(-1)
    const bringToFront = useCallback((i: number) => setFrontPiece(i), [])
    const dropToLayer = useCallback(() => setFrontPiece(-1), [])

    const targetX0 = PIECES[0]?.target.x || 0
    const targetY0 = PIECES[0]?.target.y || 0

    const puzzleTransform = useDerivedValue(() => {
        if (!pieceStates[0]) return [{ translateX: 0 }, { translateY: 0 }]
        return [
            { translateX: pieceStates[0].posX.value - targetX0 * STEP },
            { translateY: pieceStates[0].posY.value - targetY0 * STEP },
        ]
    }, [STEP, targetX0, targetY0])

    // ── Completion callback ───────────────────────────────────────
    const handlePuzzleSolved = useCallback(() => {
        onPuzzleSolved()
    }, [onPuzzleSolved])

    // ── External Expose Reset (Optional) ──────────────────────────
    useEffect(() => {
        // Expose logic to reset if parent changes key
    }, [])

    const piecePaths = useMemo(() => {
        return PIECES.map((piece) => {
            const path = Skia.Path.Make()
            let first = true
            for (const cell of piece.cells) {
                const cellP = Skia.Path.Make()
                cellP.addRect(
                    Skia.XYWHRect(
                        cell.x * STEP - GAP / 2 - 0.5,
                        cell.y * STEP - GAP / 2 - 0.5,
                        STEP + 1,
                        STEP + 1
                    )
                )
                if (first) {
                    path.addPath(cellP)
                    first = false
                } else {
                    path.op(cellP, PathOp.Union)
                }
            }
            return path
        })
    }, [STEP, PIECES])

    const pieceMaskPaths = useMemo(() => {
        return PIECES.map((piece) => {
            const path = Skia.Path.Make()
            let first = true
            for (const cell of piece.cells) {
                const cellP = Skia.Path.Make()
                cellP.addRect(
                    Skia.XYWHRect(
                        cell.x * STEP - GAP / 2 - 8,
                        cell.y * STEP - GAP / 2 - 8,
                        STEP + 16,
                        STEP + 16
                    )
                )
                if (first) {
                    path.addPath(cellP)
                    first = false
                } else {
                    path.op(cellP, PathOp.Union)
                }
            }
            return path
        })
    }, [STEP, PIECES])

    const basePiecesUnion = useDerivedValue(() => {
        const union = Skia.Path.Make();
        let first = true;
        for (let i = 0; i < PIECES.length; i++) {
            if (i === activePieceIndex.value) continue;
            if (!pieceStates[i].isLandedSV.value) continue;
            
            const gridX = Math.round(pieceStates[i].posX.value / STEP);
            const gridY = Math.round(pieceStates[i].posY.value / STEP);

            for (const cell of PIECES[i].cells) {
                const absX = gridX + cell.x;
                const absY = gridY + cell.y;
                
                const cellP = Skia.Path.Make();
                cellP.addRect(
                    Skia.XYWHRect(
                        absX * STEP - GAP / 2 - 1,
                        absY * STEP - GAP / 2 - 1,
                        STEP + 2,
                        STEP + 2
                    )
                );

                if (first) {
                    union.addPath(cellP);
                    first = false;
                } else {
                    union.op(cellP, PathOp.Union);
                }
            }
        }
        return union;
    }, [PIECES, piecePaths]);

    // ── Grid validation ───────────────────────────────────────────
    const canPlacePiece = (pieceIdx: number, gridX: number, gridY: number) => {
        'worklet'
        for (let j = 0; j < PIECES[pieceIdx].cells.length; j++) {
            const cell = PIECES[pieceIdx].cells[j]
            const cx = gridX + cell.x
            const cy = gridY + cell.y
            if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return false
        }
        return true
    }

    // ── Gesture ───────────────────────────────────────────────────
    const panGesture = usePanGesture({
        onActivate: (e) => {
            'worklet'
            if (isPuzzleCompleted.value) return

            const touchX = e.x - BLEED
            const touchY = e.y - BLEED
            activePieceIndex.value = -1
            
            for (let i = PIECES.length - 1; i >= 0; i--) {
                const px = pieceStates[i].posX.value
                const py = pieceStates[i].posY.value

                const hitLeft = px - GAP / 2
                const hitRight = px - GAP / 2 + PIECE_DIMS[i].w * STEP
                const hitTop = py - GAP / 2
                const hitBottom = py - GAP / 2 + PIECE_DIMS[i].h * STEP

                if (
                    touchX >= hitLeft && touchX <= hitRight &&
                    touchY >= hitTop && touchY <= hitBottom
                ) {
                    activePieceIndex.value = i
                    start.value = { x: px, y: py }
                    scheduleOnRN(bringToFront, i)
                    scheduleOnRN(playPop)
                    return
                }
            }
        },

        onUpdate: (e) => {
            'worklet'
            const i = activePieceIndex.value
            if (i < 0) return

            const newX = start.value.x + e.translationX
            const newY = start.value.y + e.translationY

            const maxPosX = (COLS - PIECE_DIMS[i].w) * STEP
            const maxPosY = (ROWS - PIECE_DIMS[i].h) * STEP

            pieceStates[i].posX.value = Math.max(0, Math.min(newX, maxPosX))
            pieceStates[i].posY.value = Math.max(0, Math.min(newY, maxPosY))
        },

        onDeactivate: () => {
            'worklet'
            const i = activePieceIndex.value
            if (i < 0) return

            scheduleOnRN(playWhoosh)

            const gridX = Math.round(pieceStates[i].posX.value / STEP)
            const gridY = Math.round(pieceStates[i].posY.value / STEP)

            if (canPlacePiece(i, gridX, gridY)) {
                const snappedX = gridX * STEP
                const snappedY = gridY * STEP

                const gridPositions = PIECES.map((_, idx) => {
                    if (idx === i) return { x: gridX, y: gridY }
                    return {
                        x: Math.round(pieceStates[idx].posX.value / STEP),
                        y: Math.round(pieceStates[idx].posY.value / STEP),
                    }
                })

                const dx = gridPositions[0].x - PIECES[0].target.x
                const dy = gridPositions[0].y - PIECES[0].target.y
                const isComplete = gridPositions.every((pos, idx) => {
                    return pos.x === PIECES[idx].target.x + dx && pos.y === PIECES[idx].target.y + dy
                })

                pieceStates[i].posX.value = withTiming(snappedX, { duration: 150 })
                pieceStates[i].posY.value = withTiming(snappedY, { duration: 150 }, () => {
                    activePieceIndex.value = -1
                    scheduleOnRN(dropToLayer)
                    if (isComplete) {
                        isPuzzleCompleted.value = true
                        scheduleOnRN(handlePuzzleSolved)
                        scheduleOnRN(playCorrect)
                    }
                })
            } else {
                activePieceIndex.value = -1
                scheduleOnRN(dropToLayer)
            }
        },
    })

    const basePieces = Array.from({ length: PIECES.length }, (_, i) => i).filter(i => i !== frontPiece)
    const snappedPieces = basePieces.filter(i => pieceStates[i].isLanded)
    const floatingPieces = basePieces.filter(i => !pieceStates[i].isLanded)
    if (frontPiece !== -1) floatingPieces.push(frontPiece)

    return (
        <View style={styles.boardContainer}>
            <View style={{ width: boardSize, height: boardSize }}>
                <GestureDetector gesture={panGesture}>
                    <Canvas style={{ width: boardSize + BLEED * 2, height: boardSize + BLEED * 2, position: 'absolute', left: -BLEED, top: -BLEED }}>
                        <Group transform={[{ translateX: BLEED }, { translateY: BLEED }]}>
                            <Group color={cellColor}>
                        {Array.from({ length: ROWS }, (_, row) =>
                            Array.from({ length: COLS }, (_, col) => (
                                <RoundedRect
                                    key={`${row}-${col}`}
                                    x={col * STEP}
                                    y={row * STEP}
                                    width={cellSize}
                                    height={cellSize}
                                    r={6}
                                />
                            ))
                        )}
                    </Group>

                    <Path path={basePiecesUnion} color="rgba(0,0,0,0.15)" transform={[{ translateY: 10 }]}>
                        <CornerPathEffect r={6} />
                    </Path>

                    <Path path={basePiecesUnion} color="#3d2a1d" transform={[{ translateY: 5 }]}>
                        <CornerPathEffect r={6} />
                    </Path>

                    {/* Floating Pieces Shadows & Edges (Underneath snapped images) */}
                    {floatingPieces.map(i => (
                        <Group key={`floating-shadow-${PIECES[i].id}`} transform={pieceStates[i].transform}>
                            <Path path={piecePaths[i]} color="rgba(0,0,0,0.2)" transform={[{ translateY: i === frontPiece ? 14 : 10 }]}>
                                <CornerPathEffect r={6} />
                            </Path>
                            <Path path={piecePaths[i]} color="#3d2a1d" transform={[{ translateY: i === frontPiece ? 8 : 5 }]}>
                                <CornerPathEffect r={6} />
                            </Path>
                        </Group>
                    ))}

                    {/* Snapped Pieces Images */}
                    <Mask mask={<Path path={basePiecesUnion} color="white"><CornerPathEffect r={6} /></Path>}>
                        <Group>
                            {snappedPieces.map((i) => (
                                <Group key={`image-${PIECES[i].id}`} transform={pieceStates[i].transform}>
                                    <Mask mask={<Path path={pieceMaskPaths[i]} color="white" />}>
                                        {image && (
                                            <SkImage
                                                image={image}
                                                x={-PIECES[i].target.x * STEP - GAP / 2}
                                                y={-PIECES[i].target.y * STEP - GAP / 2}
                                                width={levelData.puzzle_size.cols * STEP}
                                                height={levelData.puzzle_size.rows * STEP}
                                                fit="fill"
                                            />
                                        )}
                                    </Mask>
                                </Group>
                            ))}
                        </Group>
                    </Mask>

                    {/* Floating Pieces Images (On top of everything) */}
                    {floatingPieces.map(i => (
                        <Group key={`floating-image-${PIECES[i].id}`} transform={pieceStates[i].transform}>
                            <Mask mask={<Path path={piecePaths[i]} color="white"><CornerPathEffect r={6} /></Path>}>
                                {image && (
                                    <SkImage
                                        image={image}
                                        x={-PIECES[i].target.x * STEP - GAP / 2}
                                        y={-PIECES[i].target.y * STEP - GAP / 2}
                                        width={levelData.puzzle_size.cols * STEP}
                                        height={levelData.puzzle_size.rows * STEP}
                                        fit="fill"
                                    />
                                )}
                            </Mask>
                        </Group>
                    ))}

                    <Group transform={puzzleTransform} opacity={completedOpacity}>
                        <Group clip={Skia.RRectXY(Skia.XYWHRect(-GAP / 2, -GAP / 2, levelData.puzzle_size.cols * STEP, levelData.puzzle_size.rows * STEP), 12, 12)} blendMode="screen">
                            <Rect
                                x={-GAP / 2}
                                y={-GAP / 2}
                                width={levelData.puzzle_size.cols * STEP}
                                height={levelData.puzzle_size.rows * STEP}
                            >
                                <LinearGradient
                                    start={shineStart}
                                    end={shineEnd}
                                    colors={[
                                        'rgba(255, 255, 255, 0)',
                                        'rgba(255, 255, 255, 0.3)',
                                        'rgba(255, 255, 255, 0.9)',
                                        'rgba(255, 255, 255, 0.3)',
                                        'rgba(255, 255, 255, 0)'
                                    ]}
                                    positions={[0, 0.4, 0.5, 0.6, 1]}
                                />
                            </Rect>
                        </Group>
                    </Group>
                    </Group>
                </Canvas>
            </GestureDetector>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    boardContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
    },
})
