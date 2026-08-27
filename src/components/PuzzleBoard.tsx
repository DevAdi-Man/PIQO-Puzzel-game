import { View, Text, useWindowDimensions, StyleSheet } from 'react-native'
import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { Canvas, Group, Path, RoundedRect, Skia, Image as SkImage, Shadow, Rect, LinearGradient, vec, Mask, CornerPathEffect } from '@shopify/react-native-skia'
import { useDerivedValue, useSharedValue, withTiming, withDelay, useAnimatedReaction, withSpring } from 'react-native-reanimated'
import Animated, { FadeIn, ZoomInUp } from 'react-native-reanimated'
import { GestureDetector, usePanGesture, Pressable } from 'react-native-gesture-handler'
import { scheduleOnRN } from 'react-native-worklets'
import type { SharedValue } from 'react-native-reanimated'
import type { SkImage as SkImageType } from '@shopify/react-native-skia'

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
}

// ── Constants ─────────────────────────────────────────────────────
const GAP = 16

// ── Per-piece state hook ──────────────────────────────────────────
function usePieceState(
    initialX: number,
    initialY: number,
    isPuzzleCompleted: SharedValue<boolean>,
    index: number
) {
    const posX = useSharedValue(initialX)
    const posY = useSharedValue(initialY)
    const entranceY = useSharedValue(-1200)

    useEffect(() => {
        entranceY.value = -1200;
        const timeout = setTimeout(() => {
            entranceY.value = withSpring(0, { damping: 14, stiffness: 80, mass: 1 })
        }, 1200 + index * 180)
        return () => clearTimeout(timeout)
    }, [index, entranceY])

    const transform = useDerivedValue(() => [
        { translateX: posX.value },
        { translateY: posY.value + entranceY.value },
    ])

    return { posX, posY, transform }
}

export const PuzzleBoard = ({ levelData, image, onPuzzleSolved }: PuzzleBoardProps) => {
    const { width } = useWindowDimensions()

    const COLS = levelData.board_size.cols
    const ROWS = levelData.board_size.rows
    const PIECES = levelData.pieces

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
    // We must call the exact same number of hooks every render. 20 is our max pieces bound.
    const allStates = [
        usePieceState(PIECES[0]?.spawn.x * STEP || 0, PIECES[0]?.spawn.y * STEP || 0, isPuzzleCompleted, 0),
        usePieceState(PIECES[1]?.spawn.x * STEP || 0, PIECES[1]?.spawn.y * STEP || 0, isPuzzleCompleted, 1),
        usePieceState(PIECES[2]?.spawn.x * STEP || 0, PIECES[2]?.spawn.y * STEP || 0, isPuzzleCompleted, 2),
        usePieceState(PIECES[3]?.spawn.x * STEP || 0, PIECES[3]?.spawn.y * STEP || 0, isPuzzleCompleted, 3),
        usePieceState(PIECES[4]?.spawn.x * STEP || 0, PIECES[4]?.spawn.y * STEP || 0, isPuzzleCompleted, 4),
        usePieceState(PIECES[5]?.spawn.x * STEP || 0, PIECES[5]?.spawn.y * STEP || 0, isPuzzleCompleted, 5),
        usePieceState(PIECES[6]?.spawn.x * STEP || 0, PIECES[6]?.spawn.y * STEP || 0, isPuzzleCompleted, 6),
        usePieceState(PIECES[7]?.spawn.x * STEP || 0, PIECES[7]?.spawn.y * STEP || 0, isPuzzleCompleted, 7),
        usePieceState(PIECES[8]?.spawn.x * STEP || 0, PIECES[8]?.spawn.y * STEP || 0, isPuzzleCompleted, 8),
        usePieceState(PIECES[9]?.spawn.x * STEP || 0, PIECES[9]?.spawn.y * STEP || 0, isPuzzleCompleted, 9),
        usePieceState(PIECES[10]?.spawn.x * STEP || 0, PIECES[10]?.spawn.y * STEP || 0, isPuzzleCompleted, 10),
        usePieceState(PIECES[11]?.spawn.x * STEP || 0, PIECES[11]?.spawn.y * STEP || 0, isPuzzleCompleted, 11),
        usePieceState(PIECES[12]?.spawn.x * STEP || 0, PIECES[12]?.spawn.y * STEP || 0, isPuzzleCompleted, 12),
        usePieceState(PIECES[13]?.spawn.x * STEP || 0, PIECES[13]?.spawn.y * STEP || 0, isPuzzleCompleted, 13),
        usePieceState(PIECES[14]?.spawn.x * STEP || 0, PIECES[14]?.spawn.y * STEP || 0, isPuzzleCompleted, 14),
        usePieceState(PIECES[15]?.spawn.x * STEP || 0, PIECES[15]?.spawn.y * STEP || 0, isPuzzleCompleted, 15),
        usePieceState(PIECES[16]?.spawn.x * STEP || 0, PIECES[16]?.spawn.y * STEP || 0, isPuzzleCompleted, 16),
        usePieceState(PIECES[17]?.spawn.x * STEP || 0, PIECES[17]?.spawn.y * STEP || 0, isPuzzleCompleted, 17),
        usePieceState(PIECES[18]?.spawn.x * STEP || 0, PIECES[18]?.spawn.y * STEP || 0, isPuzzleCompleted, 18),
        usePieceState(PIECES[19]?.spawn.x * STEP || 0, PIECES[19]?.spawn.y * STEP || 0, isPuzzleCompleted, 19),
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

    // ── Build piece paths ─────────────────────────────────────────
    const piecePaths = useMemo(() => {
        return PIECES.map((piece) => {
            const path = Skia.Path.Make()
            for (const cell of piece.cells) {
                path.addRect(
                    Skia.XYWHRect(
                        cell.x * STEP - GAP / 2 - 0.5,
                        cell.y * STEP - GAP / 2 - 0.5,
                        STEP + 1,
                        STEP + 1
                    )
                )
            }
            path.simplify()
            return path
        })
    }, [STEP, PIECES])

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

            const touchX = e.x
            const touchY = e.y
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

            const gridX = Math.round(pieceStates[i].posX.value / STEP)
            const gridY = Math.round(pieceStates[i].posY.value / STEP)

            if (canPlacePiece(i, gridX, gridY)) {
                const snappedX = gridX * STEP
                const snappedY = gridY * STEP

                pieceStates[i].posX.value = withTiming(snappedX, { duration: 150 })
                pieceStates[i].posY.value = withTiming(snappedY, { duration: 150 })

                const gridPositions = PIECES.map((_, idx) => {
                    if (idx === i) return { x: gridX, y: gridY }
                    return {
                        x: Math.round(pieceStates[idx].posX.value / STEP),
                        y: Math.round(pieceStates[idx].posY.value / STEP),
                    }
                })

                const dx = gridPositions[0].x - PIECES[0].target.x
                const dy = gridPositions[0].y - PIECES[0].target.y
                let isComplete = true

                for (let j = 1; j < PIECES.length; j++) {
                    if (
                        gridPositions[j].x - PIECES[j].target.x !== dx ||
                        gridPositions[j].y - PIECES[j].target.y !== dy
                    ) {
                        isComplete = false
                        break
                    }
                }

                if (isComplete) {
                    isPuzzleCompleted.value = true
                    scheduleOnRN(handlePuzzleSolved)
                }
            }

            activePieceIndex.value = -1
            scheduleOnRN(dropToLayer)
        },
    })

    const basePieces = Array.from({ length: PIECES.length }, (_, i) => i).filter(i => i !== frontPiece)

    return (
        <View style={styles.boardContainer}>
            <GestureDetector gesture={panGesture}>
                <Canvas style={{ width: boardSize, height: boardSize }}>
                    <Group color="#f0cca3">
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

                    <Group>
                        {basePieces.map((i) => (
                            <Group key={`drop-shadow-${PIECES[i].id}`} transform={pieceStates[i].transform}>
                                <Path
                                    path={piecePaths[i]}
                                    color="rgba(0,0,0,0.15)"
                                    transform={[{ translateY: 10 }]}
                                >
                                    <CornerPathEffect r={6} />
                                </Path>
                            </Group>
                        ))}
                        {basePieces.map((i) => (
                            <Group key={`edge-${PIECES[i].id}`} transform={pieceStates[i].transform}>
                                <Path
                                    path={piecePaths[i]}
                                    color="#3d2a1d"
                                    transform={[{ translateY: 5 }]}
                                >
                                    <CornerPathEffect r={6} />
                                </Path>
                            </Group>
                        ))}
                        {basePieces.map((i) => (
                            <Group key={`image-${PIECES[i].id}`} transform={pieceStates[i].transform}>
                                <Mask
                                    mask={
                                        <Path path={piecePaths[i]} color="white">
                                            <CornerPathEffect r={6} />
                                        </Path>
                                    }
                                >
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

                    {frontPiece !== -1 && (
                        <Group transform={pieceStates[frontPiece].transform}>
                            <Path
                                path={piecePaths[frontPiece]}
                                color="rgba(0,0,0,0.2)"
                                transform={[{ translateY: 14 }]}
                            >
                                <CornerPathEffect r={6} />
                            </Path>
                            <Path
                                path={piecePaths[frontPiece]}
                                color="#3d2a1d"
                                transform={[{ translateY: 8 }]}
                            >
                                <CornerPathEffect r={6} />
                            </Path>
                            <Mask
                                mask={
                                    <Path path={piecePaths[frontPiece]} color="white">
                                        <CornerPathEffect r={6} />
                                    </Path>
                                }
                            >
                                {image && (
                                    <SkImage
                                        image={image}
                                        x={-PIECES[frontPiece].target.x * STEP - GAP / 2}
                                        y={-PIECES[frontPiece].target.y * STEP - GAP / 2}
                                        width={levelData.puzzle_size.cols * STEP}
                                        height={levelData.puzzle_size.rows * STEP}
                                        fit="fill"
                                    />
                                )}
                            </Mask>
                        </Group>
                    )}

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
                </Canvas>
            </GestureDetector>
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
