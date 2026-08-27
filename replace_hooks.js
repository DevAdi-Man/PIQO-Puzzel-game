const fs = require('fs');

const filePath = './src/components/PuzzleBoard.tsx';
let data = fs.readFileSync(filePath, 'utf8');

const hookCalls = [];
for (let i = 0; i < 40; i++) {
    hookCalls.push(`        usePieceState(getInitialX(${i}), getInitialY(${i}), isPuzzleCompleted, ${i}),`);
}

const replacement = `    // We must call the exact same number of hooks every render. 40 is our max pieces bound.
    const allStates = [
${hookCalls.join('\n')}
    ]`;

data = data.replace(
    /\/\/ We must call the exact same number of hooks every render\. 20 is our max pieces bound\.\n    const allStates = \[\n([\s\S]*?)\n    \]/g,
    replacement
);

fs.writeFileSync(filePath, data);
