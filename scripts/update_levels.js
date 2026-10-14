const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./src/assets/levels.json', 'utf8'));

// Helper to check if a set of cells is connected
function isConnected(cells) {
    if (cells.length === 0) return true;
    const visited = new Set();
    const queue = [cells[0]];
    visited.add(`${cells[0].x},${cells[0].y}`);
    
    let count = 1;
    while (queue.length > 0) {
        const curr = queue.shift();
        const neighbors = [
            {x: curr.x + 1, y: curr.y},
            {x: curr.x - 1, y: curr.y},
            {x: curr.x, y: curr.y + 1},
            {x: curr.x, y: curr.y - 1}
        ];
        
        for (const n of neighbors) {
            const key = `${n.x},${n.y}`;
            if (!visited.has(key) && cells.some(c => c.x === n.x && c.y === n.y)) {
                visited.add(key);
                queue.push(n);
                count++;
            }
        }
    }
    return count === cells.length;
}

// Split a piece into two if possible
function splitPiece(piece) {
    const cells = piece.cells;
    // Try horizontal line
    for (let i = 1; i < 6; i++) {
        const left = cells.filter(c => c.x < i);
        const right = cells.filter(c => c.x >= i);
        if (left.length > 0 && right.length > 0 && isConnected(left) && isConnected(right)) {
            return [left, right];
        }
    }
    // Try vertical line
    for (let i = 1; i < 6; i++) {
        const top = cells.filter(c => c.y < i);
        const bottom = cells.filter(c => c.y >= i);
        if (top.length > 0 && bottom.length > 0 && isConnected(top) && isConnected(bottom)) {
            return [top, bottom];
        }
    }
    // If simple line cut fails, just peel off one valid cell
    for (let i = 0; i < cells.length; i++) {
        const single = [cells[i]];
        const rest = cells.filter((_, idx) => idx !== i);
        if (isConnected(rest)) {
            return [single, rest];
        }
    }
    return null;
}

data.forEach(level => {
    // 1. Constrain board size to limit image scale
    // By keeping the ratio of puzzle to board roughly equal, the image physical size stays constant
    const puzzleCols = level.puzzle_size.cols;
    const puzzleRows = level.puzzle_size.rows;
    
    // We want the puzzle to take up roughly 60-70% of the board cells
    // e.g. 3x3 puzzle -> 5x5 board. 4x4 puzzle -> 6x6 board. 6x6 puzzle -> 9x9 board.
    level.board_size.cols = Math.ceil(puzzleCols * 1.5);
    level.board_size.rows = Math.ceil(puzzleRows * 1.5);
    
    // 2. Cut pieces into more pieces for higher levels
    // Target piece count increases with level_id
    const targetPieces = Math.min(level.puzzle_size.cols * level.puzzle_size.rows, level.level_id * 2 + 2);
    
    let newPieces = [...level.pieces];
    
    while (newPieces.length < targetPieces) {
        // Find the largest piece that can be split
        newPieces.sort((a, b) => b.cells.length - a.cells.length);
        const toSplit = newPieces.find(p => p.cells.length >= 2);
        if (!toSplit) break; // Cannot split further
        
        const splitResult = splitPiece(toSplit);
        if (splitResult) {
            const [cellsA, cellsB] = splitResult;
            
            // Remove old piece
            newPieces = newPieces.filter(p => p.id !== toSplit.id);
            
            // Generate distinct colors based on old color roughly
            // Add two new pieces
            newPieces.push({
                id: toSplit.id + "-A",
                cells: cellsA,
                target: toSplit.target,
                spawn: toSplit.spawn,
                color: toSplit.color
            });
            newPieces.push({
                id: toSplit.id + "-B",
                cells: cellsB,
                target: toSplit.target,
                spawn: toSplit.spawn,
                color: toSplit.color
            });
        } else {
            break;
        }
    }
    
    // Re-index IDs so they are clean
    level.pieces = newPieces.map((p, i) => {
        // Recalculate target properly. The target of the cells must be adjusted so local cells are relative to 0,0
        // Our split algorithm preserved the global coordinate cells relative to the OLD target.
        // We need to normalize them so the bounding box top-left is 0,0
        const minX = Math.min(...p.cells.map(c => c.x));
        const minY = Math.min(...p.cells.map(c => c.y));
        
        const normalizedCells = p.cells.map(c => ({
            x: c.x - minX,
            y: c.y - minY
        }));
        
        return {
            ...p,
            id: `piece-${i}`,
            cells: normalizedCells,
            target: {
                x: p.target.x + minX,
                y: p.target.y + minY
            }
            // spawn will be ignored by our new algorithm anyway
        };
    });
});

fs.writeFileSync('./src/assets/levels.json', JSON.stringify(data, null, 4));
console.log("Updated levels.json");
