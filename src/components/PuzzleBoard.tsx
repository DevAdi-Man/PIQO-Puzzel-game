import { View, useWindowDimensions, StyleSheet } from 'react-native';
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
    Canvas,
    Group,
    Path,
    RoundedRect,
    Skia,
    Image as SkImage,
    Rect,
    LinearGradient,
    vec,
    Mask,
    CornerPathEffect,
    PathOp,
} from '@shopify/react-native-skia';
import {
    useDerivedValue,
    useSharedValue,
    withTiming,
    withDelay,
    useAnimatedReaction,
    withSpring,
    interpolateColor,
    makeMutable,
} from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import type { SharedValue } from 'react-native-reanimated';
import type { SkImage as SkImageType } from '@shopify/react-native-skia';
import { soundManager } from '../utils/soundManager';

// ── Types ─────────────────────────────────────────────────────────
export interface Cell {
    x: number;
    y: number;
}

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

export interface PieceState {
    posX: SharedValue<number>;
    posY: SharedValue<number>;
    entranceY: SharedValue<number>;
    isLandedSV: SharedValue<boolean>;
}

// ── Constants ─────────────────────────────────────────────────────
const GAP = 16;
const BLEED = 50;

// ── Subcomponent for dynamic piece transform ──────────────────────
interface PieceGroupProps {
    state: PieceState;
    children: React.ReactNode;
}

const PieceGroup = ({ state, children }: PieceGroupProps) => {
    const transform = useDerivedValue(() => [
        { translateX: state.posX.value },
        { translateY: state.posY.value + state.entranceY.value },
    ]);

    return <Group transform={transform}>{children}</Group>;
};

export const PuzzleBoard = ({ levelData, image, onPuzzleSolved, timeShared }: PuzzleBoardProps) => {
    const { width } = useWindowDimensions();

    const COLS = levelData.board_size.cols;
    const ROWS = levelData.board_size.rows;
    const PIECES = levelData.pieces;

    const cellColor = useDerivedValue(() => {
        if (!timeShared) return '#f0cca3';
        return interpolateColor(timeShared.value, [0, 300], ['#8a3b30', '#f0cca3']);
    });

    // ── Board dimensions ──────────────────────────────────────────
    const boardSize = width * 0.9;
    const cellSize = (boardSize - GAP * (COLS - 1)) / COLS;
    const STEP = cellSize + GAP;

    const PIECE_DIMS = useMemo(
        () =>
            PIECES.map((p) => ({
                w: Math.max(...p.cells.map((c) => c.x)) + 1,
                h: Math.max(...p.cells.map((c) => c.y)) + 1,
            })),
        [PIECES]
    );

    // ── Global state ──────────────────────────────────────────────
    const isPuzzleCompleted = useSharedValue(false);
    const activePieceIndex = useSharedValue(-1);
    const start = useSharedValue({ x: 0, y: 0 });

    const completedOpacity = useDerivedValue(() =>
        withTiming(isPuzzleCompleted.value ? 1 : 0, { duration: 400 })
    );

    const shineX = useSharedValue(-boardSize * 1.5);
    useAnimatedReaction(
        () => isPuzzleCompleted.value,
        (completed, wasCompleted) => {
            if (completed && !wasCompleted) {
                shineX.value = withDelay(400, withTiming(boardSize * 1.5, { duration: 1000 }));
            }
        }
    );
    const shineStart = useDerivedValue(() => vec(shineX.value - 120, -GAP / 2));
    const shineEnd = useDerivedValue(() => vec(shineX.value + 120, 4 * STEP));

    // ── Spawn positions calculation ───────────────────────────────
    const spawnPositions = useMemo(() => {
        const positions: { x: number; y: number }[] = [];
        const N = PIECES.length;
        if (N === 0) return positions;

        let seed = levelData.level_id * 1337 + 42;
        const random = () => {
            const x = Math.sin(seed++) * 10000;
            return x - Math.floor(x);
        };

        const occupied: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

        for (let i = 0; i < N; i++) {
            const cells = PIECES[i].cells;
            const w = PIECE_DIMS[i].w;
            const h = PIECE_DIMS[i].h;

            let bestX = 0;
            let bestY = 0;
            let placed = false;

            // Try 200 random positions to find a spot with no overlapping cells
            for (let attempt = 0; attempt < 200; attempt++) {
                const randX = Math.floor(random() * Math.max(1, COLS - w + 1));
                const randY = Math.floor(random() * Math.max(1, ROWS - h + 1));

                let collision = false;
                for (const cell of cells) {
                    const cy = randY + cell.y;
                    const cx = randX + cell.x;
                    if (cy >= 0 && cy < ROWS && cx >= 0 && cx < COLS && occupied[cy][cx]) {
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

            // If we couldn't find a random spot, systematically search the grid
            if (!placed) {
                for (let r = 0; r <= Math.max(0, ROWS - h); r++) {
                    for (let c = 0; c <= Math.max(0, COLS - w); c++) {
                        let collision = false;
                        for (const cell of cells) {
                            const cy = r + cell.y;
                            const cx = c + cell.x;
                            if (cy >= 0 && cy < ROWS && cx >= 0 && cx < COLS && occupied[cy][cx]) {
                                collision = true;
                                break;
                            }
                        }
                        if (!collision) {
                            bestX = c;
                            bestY = r;
                            placed = true;
                            break;
                        }
                    }
                    if (placed) break;
                }
            }

            if (!placed) {
                bestX = Math.floor(random() * Math.max(1, COLS - w + 1));
                bestY = Math.floor(random() * Math.max(1, ROWS - h + 1));
            }

            // Mark cells as occupied
            for (const cell of cells) {
                const cy = bestY + cell.y;
                const cx = bestX + cell.x;
                if (cy >= 0 && cy < ROWS && cx >= 0 && cx < COLS) {
                    occupied[cy][cx] = true;
                }
            }

            positions.push({ x: bestX, y: bestY });
        }
        return positions;
    }, [PIECES, PIECE_DIMS, COLS, ROWS, levelData.level_id]);

    // ── Dynamic piece state management ────────────────────────────
    const pieceStates: PieceState[] = useMemo(() => {
        return PIECES.map((_, index) => {
            const initialX = (spawnPositions[index]?.x || 0) * STEP;
            const initialY = (spawnPositions[index]?.y || 0) * STEP;
            return {
                posX: makeMutable(initialX),
                posY: makeMutable(initialY),
                entranceY: makeMutable(-1200),
                isLandedSV: makeMutable(false),
            };
        });
    }, [PIECES, spawnPositions, STEP]);

    const [landedIndices, setLandedIndices] = useState<number[]>([]);
    const [frontPiece, setFrontPiece] = useState(-1);

    const bringToFront = useCallback((i: number) => setFrontPiece(i), []);
    const dropToLayer = useCallback(() => setFrontPiece(-1), []);

    // Staggered entrance animation
    useEffect(() => {
        const timeouts: ReturnType<typeof setTimeout>[] = [];
        setLandedIndices([]);

        pieceStates.forEach((piece, index) => {
            piece.entranceY.value = -1200;
            piece.isLandedSV.value = false;

            const t1 = setTimeout(() => {
                piece.entranceY.value = withSpring(0, { damping: 14, stiffness: 80, mass: 1 });
                const t2 = setTimeout(() => {
                    piece.isLandedSV.value = true;
                    setLandedIndices((prev) => (prev.includes(index) ? prev : [...prev, index]));
                }, 1000);
                timeouts.push(t2);
            }, 1200 + index * 180);
            timeouts.push(t1);
        });

        return () => {
            timeouts.forEach((t) => clearTimeout(t));
        };
    }, [pieceStates]);

    const targetX0 = PIECES[0]?.target.x || 0;
    const targetY0 = PIECES[0]?.target.y || 0;

    const puzzleTransform = useDerivedValue(() => {
        if (!pieceStates[0]) return [{ translateX: 0 }, { translateY: 0 }];
        return [
            { translateX: pieceStates[0].posX.value - targetX0 * STEP },
            { translateY: pieceStates[0].posY.value - targetY0 * STEP },
        ];
    }, [STEP, targetX0, targetY0, pieceStates]);

    const handlePuzzleSolved = useCallback(() => {
        onPuzzleSolved();
    }, [onPuzzleSolved]);

    const piecePaths = useMemo(() => {
        return PIECES.map((piece) => {
            const path = Skia.Path.Make();
            let first = true;
            for (const cell of piece.cells) {
                const cellP = Skia.Path.Make();
                cellP.addRect(
                    Skia.XYWHRect(
                        cell.x * STEP - GAP / 2 - 0.5,
                        cell.y * STEP - GAP / 2 - 0.5,
                        STEP + 1,
                        STEP + 1
                    )
                );
                if (first) {
                    path.addPath(cellP);
                    first = false;
                } else {
                    path.op(cellP, PathOp.Union);
                }
            }
            return path;
        });
    }, [STEP, PIECES]);

    const pieceMaskPaths = useMemo(() => {
        return PIECES.map((piece) => {
            const path = Skia.Path.Make();
            let first = true;
            for (const cell of piece.cells) {
                const cellP = Skia.Path.Make();
                cellP.addRect(
                    Skia.XYWHRect(
                        cell.x * STEP - GAP / 2 - 8,
                        cell.y * STEP - GAP / 2 - 8,
                        STEP + 16,
                        STEP + 16
                    )
                );
                if (first) {
                    path.addPath(cellP);
                    first = false;
                } else {
                    path.op(cellP, PathOp.Union);
                }
            }
            return path;
        });
    }, [STEP, PIECES]);

    const basePiecesUnion = useDerivedValue(() => {
        const union = Skia.Path.Make();
        let first = true;
        for (let i = 0; i < PIECES.length; i++) {
            if (i === activePieceIndex.value) continue;
            if (!pieceStates[i]?.isLandedSV.value) continue;

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
    }, [PIECES, pieceStates, STEP, activePieceIndex]);

    // ── Grid validation ───────────────────────────────────────────
    const canPlacePiece = (pieceIdx: number, gridX: number, gridY: number) => {
        'worklet';
        for (let j = 0; j < PIECES[pieceIdx].cells.length; j++) {
            const cell = PIECES[pieceIdx].cells[j];
            const cx = gridX + cell.x;
            const cy = gridY + cell.y;
            if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return false;
        }
        return true;
    };

    const isOccupied = (pieceIdx: number, gridX: number, gridY: number) => {
        'worklet';
        for (let idx = 0; idx < PIECES.length; idx++) {
            if (idx === pieceIdx) continue;

            const otherX = Math.round(pieceStates[idx].posX.value / STEP);
            const otherY = Math.round(pieceStates[idx].posY.value / STEP);

            for (let j = 0; j < PIECES[pieceIdx].cells.length; j++) {
                const cx1 = gridX + PIECES[pieceIdx].cells[j].x;
                const cy1 = gridY + PIECES[pieceIdx].cells[j].y;

                for (let k = 0; k < PIECES[idx].cells.length; k++) {
                    const cx2 = otherX + PIECES[idx].cells[k].x;
                    const cy2 = otherY + PIECES[idx].cells[k].y;
                    if (cx1 === cx2 && cy1 === cy2) {
                        return true;
                    }
                }
            }
        }
        return false;
    };

    const findNearestEmptySpace = (pieceIdx: number, startX: number, startY: number) => {
        'worklet';
        if (canPlacePiece(pieceIdx, startX, startY) && !isOccupied(pieceIdx, startX, startY)) {
            return { x: startX, y: startY };
        }

        const maxDist = Math.max(COLS, ROWS);
        for (let radius = 1; radius <= maxDist; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

                    const testX = startX + dx;
                    const testY = startY + dy;

                    if (canPlacePiece(pieceIdx, testX, testY) && !isOccupied(pieceIdx, testX, testY)) {
                        return { x: testX, y: testY };
                    }
                }
            }
        }
        return { x: startX, y: startY };
    };

    // ── Gesture ───────────────────────────────────────────────────
    const panGesture = usePanGesture({
        onActivate: (e) => {
            'worklet';
            if (isPuzzleCompleted.value) return;

            const touchX = e.x - BLEED;
            const touchY = e.y - BLEED;
            activePieceIndex.value = -1;

            for (let i = PIECES.length - 1; i >= 0; i--) {
                const px = pieceStates[i].posX.value;
                const py = pieceStates[i].posY.value;

                const hitLeft = px - GAP / 2;
                const hitRight = px - GAP / 2 + PIECE_DIMS[i].w * STEP;
                const hitTop = py - GAP / 2;
                const hitBottom = py - GAP / 2 + PIECE_DIMS[i].h * STEP;

                if (
                    touchX >= hitLeft &&
                    touchX <= hitRight &&
                    touchY >= hitTop &&
                    touchY <= hitBottom
                ) {
                    activePieceIndex.value = i;
                    start.value = { x: px, y: py };
                    scheduleOnRN(bringToFront, i);
                    scheduleOnRN(soundManager.playPop);
                    return;
                }
            }
        },

        onUpdate: (e) => {
            'worklet';
            const i = activePieceIndex.value;
            if (i < 0) return;

            const newX = start.value.x + e.translationX;
            const newY = start.value.y + e.translationY;

            const maxPosX = (COLS - PIECE_DIMS[i].w) * STEP;
            const maxPosY = (ROWS - PIECE_DIMS[i].h) * STEP;

            pieceStates[i].posX.value = Math.max(0, Math.min(newX, maxPosX));
            pieceStates[i].posY.value = Math.max(0, Math.min(newY, maxPosY));
        },

        onDeactivate: () => {
            'worklet';
            const i = activePieceIndex.value;
            if (i < 0) return;

            scheduleOnRN(soundManager.playWhoosh);

            const intendedX = Math.round(pieceStates[i].posX.value / STEP);
            const intendedY = Math.round(pieceStates[i].posY.value / STEP);

            const bestSpot = findNearestEmptySpace(i, intendedX, intendedY);
            const gridX = bestSpot.x;
            const gridY = bestSpot.y;

            const snappedX = gridX * STEP;
            const snappedY = gridY * STEP;

            const gridPositions = PIECES.map((_, idx) => {
                if (idx === i) return { x: gridX, y: gridY };
                return {
                    x: Math.round(pieceStates[idx].posX.value / STEP),
                    y: Math.round(pieceStates[idx].posY.value / STEP),
                };
            });

            const dx = gridPositions[0].x - PIECES[0].target.x;
            const dy = gridPositions[0].y - PIECES[0].target.y;
            const isComplete = gridPositions.every((pos, idx) => {
                return pos.x === PIECES[idx].target.x + dx && pos.y === PIECES[idx].target.y + dy;
            });

            pieceStates[i].posX.value = withTiming(snappedX, { duration: 150 });
            pieceStates[i].posY.value = withTiming(snappedY, { duration: 150 }, () => {
                activePieceIndex.value = -1;
                scheduleOnRN(dropToLayer);
                if (isComplete) {
                    isPuzzleCompleted.value = true;
                    scheduleOnRN(handlePuzzleSolved);
                    scheduleOnRN(soundManager.playCorrect);
                }
            });
        },
    });

    const basePieces = useMemo(
        () => Array.from({ length: PIECES.length }, (_, i) => i).filter((i) => i !== frontPiece),
        [PIECES.length, frontPiece]
    );
    const snappedPieces = useMemo(
        () => basePieces.filter((i) => landedIndices.includes(i)),
        [basePieces, landedIndices]
    );
    const floatingPieces = useMemo(() => {
        const list = basePieces.filter((i) => !landedIndices.includes(i));
        if (frontPiece !== -1) list.push(frontPiece);
        return list;
    }, [basePieces, landedIndices, frontPiece]);

    return (
        <View style={styles.boardContainer}>
            <View style={{ width: boardSize, height: boardSize }}>
                <GestureDetector gesture={panGesture}>
                    <Canvas style={[styles.canvas, { width: boardSize + BLEED * 2, height: boardSize + BLEED * 2 }]}>
                        <Group transform={[{ translateX: BLEED }, { translateY: BLEED }]}>
                            <Group color={cellColor}>
                                {Array.from({ length: ROWS }, (r, row) =>
                                    Array.from({ length: COLS }, (c, col) => (
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

                            {/* Floating Pieces Shadows & Edges */}
                            {floatingPieces.map((i) => (
                                <PieceGroup key={`floating-shadow-${PIECES[i].id}`} state={pieceStates[i]}>
                                    <Path
                                        path={piecePaths[i]}
                                        color="rgba(0,0,0,0.2)"
                                        transform={[{ translateY: i === frontPiece ? 14 : 10 }]}
                                    >
                                        <CornerPathEffect r={6} />
                                    </Path>
                                    <Path
                                        path={piecePaths[i]}
                                        color="#3d2a1d"
                                        transform={[{ translateY: i === frontPiece ? 8 : 5 }]}
                                    >
                                        <CornerPathEffect r={6} />
                                    </Path>
                                </PieceGroup>
                            ))}

                            {/* Snapped Pieces Images */}
                            <Mask mask={<Path path={basePiecesUnion} color="white"><CornerPathEffect r={6} /></Path>}>
                                <Group>
                                    {snappedPieces.map((i) => (
                                        <PieceGroup key={`image-${PIECES[i].id}`} state={pieceStates[i]}>
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
                                        </PieceGroup>
                                    ))}
                                </Group>
                            </Mask>

                            {/* Floating Pieces Images */}
                            {floatingPieces.map((i) => (
                                <PieceGroup key={`floating-image-${PIECES[i].id}`} state={pieceStates[i]}>
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
                                </PieceGroup>
                            ))}

                            <Group transform={puzzleTransform} opacity={completedOpacity}>
                                <Group
                                    clip={Skia.RRectXY(
                                        Skia.XYWHRect(-GAP / 2, -GAP / 2, levelData.puzzle_size.cols * STEP, levelData.puzzle_size.rows * STEP),
                                        12,
                                        12
                                    )}
                                    blendMode="screen"
                                >
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
                                                'rgba(255, 255, 255, 0)',
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
    );
};

const styles = StyleSheet.create({
    boardContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    canvas: {
        position: 'absolute',
        left: -BLEED,
        top: -BLEED,
    },
});
