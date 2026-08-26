import { View, Text, useWindowDimensions, StyleSheet } from 'react-native'
import React, { useCallback, useMemo, useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Canvas, Group, Path, RoundedRect, Skia, Image as SkImage, useImage, Shadow, Rect, LinearGradient, vec } from '@shopify/react-native-skia'
import { useDerivedValue, useSharedValue, withTiming, withDelay, useAnimatedReaction } from 'react-native-reanimated'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import { scheduleOnRN } from 'react-native-worklets'
import type { SharedValue } from 'react-native-reanimated'

// ── Constants ─────────────────────────────────────────────────────
const COLS = 8
const ROWS = 8
const GAP = 16

// ── Piece definitions (all coordinates are in grid units) ─────────
// These 4 pieces tile a 4×4 region. Target coordinates are relative to each other.
const PIECES = [
    {
        id: 'piece-a',
        cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }],
        target: { x: 0, y: 0 },
        spawn: { x: 5, y: 1 },
        color: '#8ecf73',
    },
    {
        id: 'piece-b',
        cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],
        target: { x: 3, y: 0 },
        spawn: { x: 6, y: 3 },
        color: '#73a9cf',
    },
    {
        id: 'piece-c',
        cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
        target: { x: 1, y: 1 },
        spawn: { x: 4, y: 5 },
        color: '#cf8e73',
    },
    {
        id: 'piece-d',
        cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
        target: { x: 0, y: 2 },
        spawn: { x: 1, y: 5 },
        color: '#b573cf',
    },
]

// Pre-computed piece dimensions in cells (for boundary clamping)
const PIECE_DIMS = PIECES.map(p => ({
    w: Math.max(...p.cells.map(c => c.x)) + 1,
    h: Math.max(...p.cells.map(c => c.y)) + 1,
}))



// ── Per-piece state hook ──────────────────────────────────────────
function usePieceState(
    initialX: number,
    initialY: number,
    isPuzzleCompleted: SharedValue<boolean>
) {
    const posX = useSharedValue(initialX)
    const posY = useSharedValue(initialY)

    const transform = useDerivedValue(() => [
        { translateX: posX.value },
        { translateY: posY.value },
    ])

    return { posX, posY, transform }
}

// ══════════════════════════════════════════════════════════════════
export const PlayScreen = () => {
    const { width } = useWindowDimensions()
    const [isCompleted, setIsCompleted] = useState(false)

    const image = useImage(require('../assets/images/puzzle.jpg'))

    // ── Board dimensions ──────────────────────────────────────────
    const boardSize = width * 0.9
    const cellSize = (boardSize - GAP * (COLS - 1)) / COLS
    const STEP = cellSize + GAP

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
                // Sweep the shine across the puzzle after a slight delay
                shineX.value = withDelay(400, withTiming(boardSize * 1.5, { duration: 1000 }, (finished) => {
                    if (finished) {
                        scheduleOnRN(onPuzzleComplete)
                    }
                }))
            }
        }
    )
    const shineStart = useDerivedValue(() => vec(shineX.value - 120, -GAP / 2))
    const shineEnd = useDerivedValue(() => vec(shineX.value + 120, 4 * STEP))


    // ── Create state for each piece ───────────────────────────────
    const s0 = usePieceState(PIECES[0].spawn.x * STEP, PIECES[0].spawn.y * STEP, isPuzzleCompleted)
    const s1 = usePieceState(PIECES[1].spawn.x * STEP, PIECES[1].spawn.y * STEP, isPuzzleCompleted)
    const s2 = usePieceState(PIECES[2].spawn.x * STEP, PIECES[2].spawn.y * STEP, isPuzzleCompleted)
    const s3 = usePieceState(PIECES[3].spawn.x * STEP, PIECES[3].spawn.y * STEP, isPuzzleCompleted)

    const pieceStates = [s0, s1, s2, s3]

    // Flat arrays for worklet closure access
    const allPosX = [s0.posX, s1.posX, s2.posX, s3.posX]
    const allPosY = [s0.posY, s1.posY, s2.posY, s3.posY]

    const [frontPiece, setFrontPiece] = useState(-1)
    const bringToFront = useCallback((i: number) => setFrontPiece(i), [])
    const dropToLayer = useCallback(() => setFrontPiece(-1), [])

    const puzzleTransform = useDerivedValue(() => {
        // Assume piece A (index 0) is always the top-left (target 0,0)
        return [
            { translateX: allPosX[0].value },
            { translateY: allPosY[0].value },
        ]
    })

    // ── Completion callback ───────────────────────────────────────
    const onPuzzleComplete = useCallback(() => {
        setIsCompleted(true)
    }, [])

    // ── Build piece paths ─────────────────────────────────────────
    const piecePaths = useMemo(() => {
        return PIECES.map((piece) => {
            const path = Skia.Path.Make()

            // Expand each cell by GAP/2 in all directions so they touch seamlessly.
            // We add an extra 0.5px to guarantee overlap and prevent sub-pixel seams.
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
    }, [STEP])

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
            if (isPuzzleCompleted.value) return // Disable dragging if completed

            const touchX = e.x
            const touchY = e.y
            activePieceIndex.value = -1

            for (let i = PIECES.length - 1; i >= 0; i--) {
                const px = allPosX[i].value
                const py = allPosY[i].value

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

            allPosX[i].value = Math.max(0, Math.min(newX, maxPosX))
            allPosY[i].value = Math.max(0, Math.min(newY, maxPosY))
        },

        onDeactivate: () => {
            'worklet'
            const i = activePieceIndex.value
            if (i < 0) return

            const gridX = Math.round(allPosX[i].value / STEP)
            const gridY = Math.round(allPosY[i].value / STEP)

            if (canPlacePiece(i, gridX, gridY)) {
                const snappedX = gridX * STEP
                const snappedY = gridY * STEP

                allPosX[i].value = withTiming(snappedX, { duration: 150 })
                allPosY[i].value = withTiming(snappedY, { duration: 150 })

                // ── Relative Completion Check ──
                // If all pieces have the exact same offset (dx, dy) from their targets,
                // they are perfectly assembled relative to each other.
                
                // Collect grid coordinates for all pieces (using the new target for the active piece)
                const gridPositions = PIECES.map((_, idx) => {
                    if (idx === i) return { x: gridX, y: gridY }
                    return {
                        x: Math.round(allPosX[idx].value / STEP),
                        y: Math.round(allPosY[idx].value / STEP),
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
                }
            }

            activePieceIndex.value = -1
            scheduleOnRN(dropToLayer)
        },
    })

    // ══════════════════════════════════════════════════════════════
    if (!image) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#f7e5d0', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={styles.headerText}>Loading Image...</Text>
            </SafeAreaView>
        )
    }

    const basePieces = [0, 1, 2, 3].filter(i => i !== frontPiece)

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f7e5d0' }}>
            <View style={styles.header}>
                <Text style={styles.headerText}>
                    DRAG THE BLOCKS TO COMPLETE THE PICTURE
                </Text>
            </View>

            <View style={styles.boardContainer}>
                <GestureDetector gesture={panGesture}>
                    <Canvas style={{ width: boardSize, height: boardSize }}>
                        {/* ── Board grid (8×8) ── */}
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



                        {/* ── Base Layer (Inactive Pieces) ── */}
                        <Group>
                            {/* Pass 1: Base Shadows */}
                            {basePieces.map((i) => (
                                <Group key={`shadow-${PIECES[i].id}`} transform={pieceStates[i].transform}>
                                    <Path
                                        path={piecePaths[i]}
                                        color="#3d2a1d"
                                        transform={[{ translateY: 6 }]}
                                    />
                                </Group>
                            ))}
                            {/* Pass 2: Base Images */}
                            {basePieces.map((i) => (
                                <Group key={`image-${PIECES[i].id}`} transform={pieceStates[i].transform}>
                                    <Group clip={piecePaths[i]}>
                                        <SkImage
                                            image={image}
                                            x={-PIECES[i].target.x * STEP - GAP / 2}
                                            y={-PIECES[i].target.y * STEP - GAP / 2}
                                            width={4 * STEP}
                                            height={4 * STEP}
                                            fit="fill"
                                        />
                                    </Group>
                                </Group>
                            ))}
                        </Group>

                        {/* ── Lifted Layer (Active Piece) ── */}
                        {frontPiece !== -1 && (
                            <Group transform={pieceStates[frontPiece].transform}>
                                {/* Lifted Shadow (Casts over base layer) */}
                                <Path
                                    path={piecePaths[frontPiece]}
                                    color="#3d2a1d"
                                    transform={[{ translateY: 8 }]}
                                />
                                {/* Lifted Image */}
                                <Group clip={piecePaths[frontPiece]}>
                                    <SkImage
                                        image={image}
                                        x={-PIECES[frontPiece].target.x * STEP - GAP / 2}
                                        y={-PIECES[frontPiece].target.y * STEP - GAP / 2}
                                        width={4 * STEP}
                                        height={4 * STEP}
                                        fit="fill"
                                    />
                                </Group>
                            </Group>
                        )}

                        {/* ── Completion Shine ── */}
                        <Group transform={puzzleTransform} opacity={completedOpacity}>
                            <Group clip={Skia.XYWHRect(-GAP / 2, -GAP / 2, 4 * STEP, 4 * STEP)} blendMode="screen">
                                <Rect
                                    x={-GAP / 2}
                                    y={-GAP / 2}
                                    width={4 * STEP}
                                    height={4 * STEP}
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

            {/* Completion overlay */}
            {isCompleted && (
                <View style={styles.completionOverlay}>
                    <Text style={styles.completionText}>
                        🎉 Puzzle Complete!
                    </Text>
                </View>
            )}
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        alignItems: 'center',
    },
    headerText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#5a4230',
        letterSpacing: 1,
        textAlign: 'center',
    },
    boardContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    completionOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    completionText: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
    },
})
