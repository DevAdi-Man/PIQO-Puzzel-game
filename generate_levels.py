import json
import random

def slice_grid(w, h, num_pieces):
    # Initialize grid
    grid = [[-1 for _ in range(w)] for _ in range(h)]
    
    # Place seeds
    seeds = []
    while len(seeds) < num_pieces:
        r, c = random.randint(0, h-1), random.randint(0, w-1)
        if (r, c) not in seeds:
            seeds.append((r, c))
            grid[r][c] = len(seeds) - 1
            
    # Grow regions
    unassigned = [(r, c) for r in range(h) for c in range(w) if grid[r][c] == -1]
    random.shuffle(unassigned)
    
    while unassigned:
        progress = False
        for r, c in list(unassigned):
            neighbors = []
            if r > 0 and grid[r-1][c] != -1: neighbors.append(grid[r-1][c])
            if r < h-1 and grid[r+1][c] != -1: neighbors.append(grid[r+1][c])
            if c > 0 and grid[r][c-1] != -1: neighbors.append(grid[r][c-1])
            if c < w-1 and grid[r][c+1] != -1: neighbors.append(grid[r][c+1])
            
            if neighbors:
                grid[r][c] = random.choice(neighbors)
                unassigned.remove((r, c))
                progress = True
        
        if not progress:
            # Fallback if disconnected (rare in grid but possible)
            r, c = unassigned[0]
            grid[r][c] = random.choice(range(num_pieces))
            unassigned.remove((r, c))
            
    # Extract pieces
    pieces = []
    colors = ['#8ecf73', '#73a9cf', '#cf8e73', '#b573cf', '#cf7399', '#cfc873', '#73cfb7', '#7773cf', '#a2cf73', '#cf9f73']
    
    # We must assign spawns so they don't overlap. We have an 8x8 board.
    # Let's just place them semi-randomly in an 8x8 grid.
    # For a robust non-overlapping spawn, we can just pack them using a simple greedy approach.
    spawn_grid = [[-1]*8 for _ in range(8)]
    
    for i in range(num_pieces):
        cells = []
        for r in range(h):
            for c in range(w):
                if grid[r][c] == i:
                    cells.append({"x": c, "y": r})
                    
        # Normalize cells to top-left being 0,0 and find target
        min_x = min(c["x"] for c in cells)
        min_y = min(c["y"] for c in cells)
        
        norm_cells = [{"x": c["x"] - min_x, "y": c["y"] - min_y} for c in cells]
        target = {"x": min_x, "y": min_y}
        
        pw = max(c["x"] for c in norm_cells) + 1
        ph = max(c["y"] for c in norm_cells) + 1
        
        # Find spawn
        spawn_x, spawn_y = 0, 0
        found = False
        for sr in range(8 - ph + 1):
            for sc in range(8 - pw + 1):
                # Check fit
                fit = True
                for c in norm_cells:
                    if spawn_grid[sr + c["y"]][sc + c["x"]] != -1:
                        fit = False
                        break
                if fit:
                    # Place
                    for c in norm_cells:
                        spawn_grid[sr + c["y"]][sc + c["x"]] = i
                    spawn_x, spawn_y = sc, sr
                    found = True
                    break
            if found: break
            
        if not found:
            # Fallback
            spawn_x, spawn_y = random.randint(0, 8-pw), random.randint(0, 8-ph)
            
        pieces.append({
            "id": f"piece-{i}",
            "cells": norm_cells,
            "target": target,
            "spawn": {"x": spawn_x, "y": spawn_y},
            "color": colors[i % len(colors)]
        })
        
    return pieces

random.seed(42) # For reproducible levels

levels = []
configs = [
    (3, 3, 3), # L1
    (3, 3, 4), # L2
    (4, 4, 4), # L3
    (4, 4, 5), # L4
    (4, 4, 6), # L5
    (5, 5, 5), # L6
    (5, 5, 6), # L7
    (5, 5, 7), # L8
    (5, 5, 8), # L9
    (6, 6, 9), # L10
]

for idx, (w, h, pieces) in enumerate(configs):
    levels.append({
        "level_id": idx + 1,
        "board_size": {"cols": 8, "rows": 8},
        "puzzle_size": {"cols": w, "rows": h},
        "image": f"puzzle{idx % 3 + 1}", # Cycle between puzzle1, puzzle2, puzzle3
        "pieces": slice_grid(w, h, pieces)
    })

with open("src/assets/levels.json", "w") as f:
    json.dump(levels, f, indent=4)

print("Levels generated successfully!")
