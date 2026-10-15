import { View, useWindowDimensions, StyleSheet } from 'react-native';
import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
    Canvas,
    Group,
    Path,
    Skia,
    ImageShader,
    Rect,
    LinearGradient,
    vec,
    CornerPathEffect,
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
import type { SkImage as SkImageType, SkPath } from '@shopify/react-native-skia';
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
    /** Grid cell the piece occupies (or is snapping to). Updated the moment it is dropped. */
    gridX: SharedValue<number>;
    gridY: SharedValue<number>;
    entranceY: SharedValue<number>;
    isLandedSV: SharedValue<boolean>;
}

// ── Constants ─────────────────────────────────────────────────────
const BLEED = 50;
const EDGE_COLOR = '#3d2a1d';
const SHADOW_COLOR = 'rgba(0,0,0,0.18)';

// ── Geometry helpers ──────────────────────────────────────────────
interface Metrics {
    STEP: number;
    GAP: number;
    cellSize: number;
    /** How far a piece's surface reaches past its cell into the gap. Less than GAP / 2,
     *  so two unrelated pieces sitting side by side keep a visible seam between them. */
    ext: number;
}

/**
 * Outline of a set of grid cells. Gaps are bridged only between cells that are in the set,
 * so the shape never fills holes or spills into gaps next to cells it does not own.
 */
const buildCellsPath = (cells: Cell[], m: Metrics): SkPath => {
    const owned = new Set(cells.map((c) => `${c.x},${c.y}`));
    const has = (x: number, y: number) => owned.has(`${x},${y}`);
    const { STEP, GAP, cellSize, ext } = m;
    const path = Skia.Path.Make();

    for (const { x, y } of cells) {
        const left = x * STEP;
        const top = y * STEP;
        path.addRect(Skia.XYWHRect(left - ext, top - ext, cellSize + ext * 2, cellSize + ext * 2));
        const right = has(x + 1, y);
        const down = has(x, y + 1);
        if (right) {
            path.addRect(Skia.XYWHRect(left + cellSize, top - ext, GAP, cellSize + ext * 2));
        }
        if (down) {
            path.addRect(Skia.XYWHRect(left - ext, top + cellSize, cellSize + ext * 2, GAP));
        }
        if (right && down && has(x + 1, y + 1)) {
            path.addRect(Skia.XYWHRect(left + cellSize, top + cellSize, GAP, GAP));
        }
    }
    // Merge the overlapping rects into one outline so CornerPathEffect rounds only the real corners.
    path.simplify();
    return path;
};

/**
 * Groups resting pieces that should look merged: pieces that touch along a side AND sit in
 * their correct position relative to each other. Pieces that merely touch stay separate.
 */
export const groupRestingPieces = (pieces: PieceDef[], grid: Cell[], resting: number[]): number[][] => {
    const parent = new Map<number, number>();
    const find = (i: number): number => {
        let root = i;
        while (parent.get(root) !== root) root = parent.get(root)!;
        parent.set(i, root);
        return root;
    };
    resting.forEach((i) => parent.set(i, i));

    const offsetKey = (i: number) => `${grid[i].x - pieces[i].target.x},${grid[i].y - pieces[i].target.y}`;

    const owner = new Map<string, number>();
    for (const i of resting) {
        for (const c of pieces[i].cells) owner.set(`${grid[i].x + c.x},${grid[i].y + c.y}`, i);
    }
    for (const i of resting) {
        for (const c of pieces[i].cells) {
            const ax = grid[i].x + c.x;
            const ay = grid[i].y + c.y;
            for (const key of [`${ax + 1},${ay}`, `${ax},${ay + 1}`]) {
                const j = owner.get(key);
                if (j !== undefined && j !== i && offsetKey(i) === offsetKey(j)) {
                    parent.set(find(i), find(j));
                }
            }
        }
    }

    const byRoot = new Map<number, number[]>();
    for (const i of resting) {
        const root = find(i);
        byRoot.set(root, [...(byRoot.get(root) ?? []), i]);
    }
    return Array.from(byRoot.values());
};

// ── Subcomponents ─────────────────────────────────────────────────
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

interface PuzzleImageFillProps {
    image: SkImageType;
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Paints the puzzle picture into the parent shape — no Mask / saveLayer needed. */
const PuzzleImageFill = ({ image, x, y, width, height }: PuzzleImageFillProps) => (
    <ImageShader image={image} fit="fill" x={x} y={y} width={width} height={height} />
);

export const PuzzleBoard = React.memo(({ levelData, image, onPuzzleSolved, timeShared }: PuzzleBoardProps) => {
    const { width } = useWindowDimensions();

    const COLS = levelData.board_size.cols;
    const ROWS = levelData.board_size.rows;
    const PIECES = levelData.pieces;

    const cellColor = useDerivedValue(() => {
        if (!timeShared) return '#f0cca3';
        return interpolateColor(timeShared.value, [0, 300], ['#8a3b30', '#f0cca3']);
    });

    // ── Board dimensions ──────────────────────────────────────────
    // Gap, corner radius and depth scale with the cell size so big boards (11×11) don't
    // end up with gaps as wide as the cells themselves.
    const boardSize = width * 0.9;
    const GAP = Math.min(16, Math.round((boardSize / COLS) * 0.22));
    const cellSize = (boardSize - GAP * (COLS - 1)) / COLS;
    const STEP = cellSize + GAP;
    const RADIUS = Math.max(3, Math.min(6, GAP * 0.4));
    const DEPTH = Math.max(3, Math.round(GAP * 0.33));
    const SEAM = Math.max(2, GAP * 0.25);

    const metrics: Metrics = useMemo(
        () => ({ STEP, GAP, cellSize, ext: GAP / 2 - SEAM / 2 }),
        [STEP, GAP, cellSize, SEAM]
    );

    const imageWidth = levelData.puzzle_size.cols * STEP;
    const imageHeight = levelData.puzzle_size.rows * STEP;

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

    // ── Piece positions (JS side mirror, drives the static layer) ─
    const [grid, setGrid] = useState(spawnPositions);
    const gridRef = useRef(grid);
    gridRef.current = grid;

    // ── Dynamic piece state management ────────────────────────────
    const pieceStates: PieceState[] = useMemo(() => {
        return PIECES.map((_, index) => {
            const cell = gridRef.current[index] ?? { x: 0, y: 0 };
            return {
                posX: makeMutable(cell.x * STEP),
                posY: makeMutable(cell.y * STEP),
                gridX: makeMutable(cell.x),
                gridY: makeMutable(cell.y),
                entranceY: makeMutable(-1200),
                isLandedSV: makeMutable(false),
            };
        });
    }, [PIECES, STEP]);

    const [landedIndices, setLandedIndices] = useState<number[]>([]);
    /** Pieces lifted off the board (being dragged or snapping into place), last = topmost. */
    const [liftedPieces, setLiftedPieces] = useState<number[]>([]);

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

    const handlePickUp = useCallback((i: number) => {
        soundManager.playPop();
        setLiftedPieces((prev) => [...prev.filter((p) => p !== i), i]);
    }, []);

    const handleDropped = useCallback(
        (i: number, gx: number, gy: number, merged: boolean, isComplete: boolean) => {
            if (isComplete) {
                soundManager.playCorrect();
            } else if (merged) {
                soundManager.playMerge();
            } else {
                soundManager.playDrop();
            }
            setGrid((prev) => {
                const next = prev.slice();
                next[i] = { x: gx, y: gy };
                return next;
            });
            setLiftedPieces((prev) => prev.filter((p) => p !== i));
            if (isComplete) onPuzzleSolved();
        },
        [onPuzzleSolved]
    );

    // ── Static geometry ───────────────────────────────────────────
    const cellsPath = useMemo(() => {
        const path = Skia.Path.Make();
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                path.addRRect(Skia.RRectXY(Skia.XYWHRect(col * STEP, row * STEP, cellSize, cellSize), RADIUS, RADIUS));
            }
        }
        return path;
    }, [ROWS, COLS, STEP, cellSize, RADIUS]);

    const piecePaths = useMemo(() => PIECES.map((piece) => buildCellsPath(piece.cells, metrics)), [PIECES, metrics]);

    /**
     * Pieces resting on the board. Only correctly-joined pieces share one slab (see
     * groupRestingPieces); everything else keeps its own outline and the seam between them.
     */
    const restingGroups = useMemo(() => {
        const lifted = new Set(liftedPieces);
        const resting = landedIndices.filter((i) => !lifted.has(i));

        const allShapes = Skia.Path.Make();
        const groups = groupRestingPieces(PIECES, grid, resting).map((members) => {
            const cells: Cell[] = [];
            for (const i of members) {
                for (const c of PIECES[i].cells) cells.push({ x: grid[i].x + c.x, y: grid[i].y + c.y });
            }
            const path = buildCellsPath(cells, metrics);
            allShapes.addPath(path);
            const first = members[0];
            const offset = { x: grid[first].x - PIECES[first].target.x, y: grid[first].y - PIECES[first].target.y };
            return { key: PIECES[first].id, path, offset };
        });

        return { groups, allShapes };
    }, [landedIndices, liftedPieces, grid, PIECES, metrics]);

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

    /** True when any cell of piece `a` at (ax, ay) is the same as (or 4-adjacent to, if `touch`) a cell of `b`. */
    const cellsMeet = (a: number, ax: number, ay: number, b: number, bx: number, by: number, touch: boolean) => {
        'worklet';
        for (let j = 0; j < PIECES[a].cells.length; j++) {
            const cx1 = ax + PIECES[a].cells[j].x;
            const cy1 = ay + PIECES[a].cells[j].y;
            for (let k = 0; k < PIECES[b].cells.length; k++) {
                const dist = Math.abs(cx1 - (bx + PIECES[b].cells[k].x)) + Math.abs(cy1 - (by + PIECES[b].cells[k].y));
                if (touch ? dist === 1 : dist === 0) return true;
            }
        }
        return false;
    };

    const isOccupied = (pieceIdx: number, gridX: number, gridY: number) => {
        'worklet';
        for (let idx = 0; idx < PIECES.length; idx++) {
            if (idx === pieceIdx) continue;
            if (cellsMeet(pieceIdx, gridX, gridY, idx, pieceStates[idx].gridX.value, pieceStates[idx].gridY.value, false)) {
                return true;
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

            // Hit-test the actual cells (not the bounding box), so the empty corner of an
            // L-shaped piece doesn't steal the touch from the piece underneath it.
            for (let i = PIECES.length - 1; i >= 0; i--) {
                if (!pieceStates[i].isLandedSV.value) continue;
                const px = pieceStates[i].posX.value;
                const py = pieceStates[i].posY.value;

                for (let j = 0; j < PIECES[i].cells.length; j++) {
                    const left = px + PIECES[i].cells[j].x * STEP - GAP / 2;
                    const top = py + PIECES[i].cells[j].y * STEP - GAP / 2;
                    if (touchX >= left && touchX <= left + STEP && touchY >= top && touchY <= top + STEP) {
                        activePieceIndex.value = i;
                        start.value = { x: px, y: py };
                        scheduleOnRN(handlePickUp, i);
                        return;
                    }
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
            activePieceIndex.value = -1;

            const intendedX = Math.round(pieceStates[i].posX.value / STEP);
            const intendedY = Math.round(pieceStates[i].posY.value / STEP);

            const bestSpot = findNearestEmptySpace(i, intendedX, intendedY);
            const gridX = bestSpot.x;
            const gridY = bestSpot.y;
            pieceStates[i].gridX.value = gridX;
            pieceStates[i].gridY.value = gridY;

            // Did it land next to a piece it belongs with?
            const offX = gridX - PIECES[i].target.x;
            const offY = gridY - PIECES[i].target.y;
            let merged = false;
            for (let idx = 0; idx < PIECES.length && !merged; idx++) {
                if (idx === i || !pieceStates[idx].isLandedSV.value) continue;
                const ox = pieceStates[idx].gridX.value;
                const oy = pieceStates[idx].gridY.value;
                if (ox - PIECES[idx].target.x !== offX || oy - PIECES[idx].target.y !== offY) continue;
                merged = cellsMeet(i, gridX, gridY, idx, ox, oy, true);
            }

            const dx = pieceStates[0].gridX.value - PIECES[0].target.x;
            const dy = pieceStates[0].gridY.value - PIECES[0].target.y;
            let isComplete = true;
            for (let idx = 0; idx < PIECES.length; idx++) {
                if (
                    pieceStates[idx].gridX.value !== PIECES[idx].target.x + dx ||
                    pieceStates[idx].gridY.value !== PIECES[idx].target.y + dy
                ) {
                    isComplete = false;
                    break;
                }
            }
            if (isComplete) isPuzzleCompleted.value = true;

            pieceStates[i].posX.value = withTiming(gridX * STEP, { duration: 150 });
            pieceStates[i].posY.value = withTiming(gridY * STEP, { duration: 150 }, (finished) => {
                // Not finished = the piece was grabbed again mid-snap; that drag will land it.
                if (!finished) return;
                // Sound and re-layering happen when the piece actually lands.
                scheduleOnRN(handleDropped, i, gridX, gridY, merged, isComplete);
            });
        },
    });

    const floatingPieces = useMemo(() => {
        const landed = new Set(landedIndices);
        const lifted = new Set(liftedPieces);
        const entering = PIECES.map((_, i) => i).filter((i) => !landed.has(i) && !lifted.has(i));
        return [...entering, ...liftedPieces];
    }, [PIECES, landedIndices, liftedPieces]);

    return (
        <View style={styles.boardContainer}>
            <View style={{ width: boardSize, height: boardSize }}>
                <GestureDetector gesture={panGesture}>
                    <Canvas style={[styles.canvas, { width: boardSize + BLEED * 2, height: boardSize + BLEED * 2 }]}>
                        <Group transform={[{ translateX: BLEED }, { translateY: BLEED }]}>
                            <Path path={cellsPath} color={cellColor} />

                            {/* Resting pieces: shadow + edge for all, then each merged group's picture */}
                            <Path path={restingGroups.allShapes} color={SHADOW_COLOR} transform={[{ translateY: DEPTH * 2 }]}>
                                <CornerPathEffect r={RADIUS} />
                            </Path>
                            <Path path={restingGroups.allShapes} color={EDGE_COLOR} transform={[{ translateY: DEPTH }]}>
                                <CornerPathEffect r={RADIUS} />
                            </Path>
                            {image &&
                                restingGroups.groups.map((g) => (
                                    <Path key={g.key} path={g.path}>
                                        <CornerPathEffect r={RADIUS} />
                                        <PuzzleImageFill
                                            image={image}
                                            x={g.offset.x * STEP - GAP / 2}
                                            y={g.offset.y * STEP - GAP / 2}
                                            width={imageWidth}
                                            height={imageHeight}
                                        />
                                    </Path>
                                ))}

                            {/* Falling / dragged pieces are drawn last, each with its own shadow,
                                so a lifted piece's shadow always sits on top of the board. */}
                            {floatingPieces.map((i) => {
                                const isLifted = liftedPieces.includes(i);
                                return (
                                    <PieceGroup key={`floating-${PIECES[i].id}`} state={pieceStates[i]}>
                                        <Path
                                            path={piecePaths[i]}
                                            color={SHADOW_COLOR}
                                            transform={[{ translateY: isLifted ? DEPTH * 3 : DEPTH * 2 }]}
                                        >
                                            <CornerPathEffect r={RADIUS} />
                                        </Path>
                                        <Path
                                            path={piecePaths[i]}
                                            color={EDGE_COLOR}
                                            transform={[{ translateY: isLifted ? DEPTH * 1.6 : DEPTH }]}
                                        >
                                            <CornerPathEffect r={RADIUS} />
                                        </Path>
                                        {image && (
                                            <Path path={piecePaths[i]}>
                                                <CornerPathEffect r={RADIUS} />
                                                <PuzzleImageFill
                                                    image={image}
                                                    x={-PIECES[i].target.x * STEP - GAP / 2}
                                                    y={-PIECES[i].target.y * STEP - GAP / 2}
                                                    width={imageWidth}
                                                    height={imageHeight}
                                                />
                                            </Path>
                                        )}
                                    </PieceGroup>
                                );
                            })}

                            <Group transform={puzzleTransform} opacity={completedOpacity}>
                                <Group
                                    clip={Skia.RRectXY(Skia.XYWHRect(-GAP / 2, -GAP / 2, imageWidth, imageHeight), 12, 12)}
                                    blendMode="screen"
                                >
                                    <Rect x={-GAP / 2} y={-GAP / 2} width={imageWidth} height={imageHeight}>
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
});

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
