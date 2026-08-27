const fs = require('fs');

const filePath = './src/components/PuzzleBoard.tsx';
let data = fs.readFileSync(filePath, 'utf8');

// 1. Add runOnJS import
if (!data.includes('runOnJS')) {
    data = data.replace(/import \{.*?\} from 'react-native-reanimated'/, match => {
        return match.replace('{', '{ runOnJS,');
    });
}

// 2. Modify onDeactivate in usePanGesture
const onDeactivateRegex = /onDeactivate:\s*\(\)\s*=>\s*\{[\s\S]*?scheduleOnRN\(dropToLayer\)\s*\}/g;

const newOnDeactivate = `onDeactivate: () => {
            'worklet'
            const i = activePieceIndex.value
            if (i < 0) return

            const gridX = Math.round(pieceStates[i].posX.value / STEP)
            const gridY = Math.round(pieceStates[i].posY.value / STEP)

            if (canPlacePiece(i, gridX, gridY)) {
                const snappedX = gridX * STEP
                const snappedY = gridY * STEP

                pieceStates[i].posX.value = withTiming(snappedX, { duration: 150 })
                pieceStates[i].posY.value = withTiming(snappedY, { duration: 150 }, () => {
                    activePieceIndex.value = -1
                    runOnJS(dropToLayer)()
                })

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

                if (isComplete) {
                    isPuzzleCompleted.value = true
                    runOnJS(handlePuzzleSolved)()
                }
            } else {
                activePieceIndex.value = -1
                runOnJS(dropToLayer)()
            }
        }`;

data = data.replace(onDeactivateRegex, newOnDeactivate);

// 3. Remove activePieceIndex.value = -1 from onActivate
data = data.replace(/activePieceIndex\.value\s*=\s*-1\n/g, '');

// 4. Add basePiecesUnion useDerivedValue before piecePaths
const unionBlock = `
    const basePiecesUnion = useDerivedValue(() => {
        const union = Skia.Path.Make();
        let first = true;
        for (let i = 0; i < PIECES.length; i++) {
            if (i === activePieceIndex.value) continue;
            
            const px = pieceStates[i].posX.value;
            const py = pieceStates[i].posY.value;

            const p = Skia.Path.Make();
            p.addPath(piecePaths[i]);
            
            const m = Skia.Matrix();
            m.translate(px, py);
            p.transform(m);
            
            if (first) {
                union.addPath(p);
                first = false;
            } else {
                union.op(p, Skia.PathOp.Union);
            }
        }
        return union;
    }, [PIECES, piecePaths]);

    // ── Build piece paths ─────────────────────────────────────────`;

data = data.replace(/\/\/ ── Build piece paths ─────────────────────────────────────────/g, unionBlock);

// 5. Wrap base pieces in a Mask using basePiecesUnion, and restore CornerPathEffect to the active piece
const renderBlock = `<Mask
                            mask={
                                <Path path={basePiecesUnion} color="white">
                                    <CornerPathEffect r={6} />
                                </Path>
                            }
                        >
                            <Group>
                                {basePieces.map((i) => (
                                    <Group key={\`drop-shadow-\${PIECES[i].id}\`} transform={pieceStates[i].transform}>
                                        <Path
                                            path={piecePaths[i]}
                                            color="rgba(0,0,0,0.15)"
                                            transform={[{ translateY: 10 }]}
                                        >
                                            
                                        </Path>
                                    </Group>
                                ))}
                                {basePieces.map((i) => (
                                    <Group key={\`edge-\${PIECES[i].id}\`} transform={pieceStates[i].transform}>
                                        <Path
                                            path={piecePaths[i]}
                                            color="#3d2a1d"
                                            transform={[{ translateY: 5 }]}
                                        >
                                            
                                        </Path>
                                    </Group>
                                ))}
                                {basePieces.map((i) => (
                                    <Group key={\`image-\${PIECES[i].id}\`} transform={pieceStates[i].transform}>
                                        <Mask
                                            mask={
                                                <Path path={piecePaths[i]} color="white">
                                                    
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
                        </Mask>

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
                        )}`;

const oldRenderBlockRegex = /<Group>\s*\{basePieces\.map\(\(i\) => \([\s\S]*?\{frontPiece !== -1 && \([\s\S]*?<\/Group>\s*\)\}/;
data = data.replace(oldRenderBlockRegex, renderBlock);

fs.writeFileSync(filePath, data);
