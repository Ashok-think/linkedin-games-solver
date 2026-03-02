import { dispatchMouseEvents, runPageClickCode } from "../../shared/clickUtils.js";

export async function solveTangoGame(isFullSolve) {
    // === your full Tango solver code unchanged ===


        const selector = 'div[data-testid^="cell-"]';
    const cellElements = document.querySelectorAll(selector);
    
    if (cellElements.length === 0) {
        alert("Tango board not found.");
        return;
    }
    
    const totalCells = cellElements.length;
    const size = Math.sqrt(totalCells); 

    if (!Number.isInteger(size)) {
        console.error("Error: Tango Board size is not a perfect square.");
        return;
    }

    // --- CRITICAL FIX: Step 1: Initialize every spot in the N x N grid ---
    const board = [];
    for (let i = 0; i < size; i++) {
        board[i] = [];
        for (let j = 0; j < size; j++) {
             // Initialize every cell with a safe, empty default object
             board[i][j] = { val: 0, fixed: false, element: null }; 
        }
    }
    
    // --- Step 2: Read state and map to coordinates (overwriting defaults) ---
    cellElements.forEach(cell => {
        const cellIdx = parseInt(cell.getAttribute('data-cell-idx'));
        
        const row = Math.floor(cellIdx / size);
        const col = cellIdx % size;
        
        const svgElement = cell.querySelector('svg'); 
        const stateTestId = svgElement ? svgElement.getAttribute('data-testid') : 'unknown';

        let val = 0; // 0 = Empty (default)
        if (stateTestId === 'cell-sun' || stateTestId === 'sun-icon') {
            val = 1; // 1 = Sun
        } else if (stateTestId === 'cell-moon' || stateTestId === 'moon-icon') {
            val = 2; // 2 = Moon
        }
        
        // Overwrite the default object with the actual cell data
        board[row][col] = { 
            val: val, 
            fixed: (val !== 0), 
            element: cell 
        };
    });
    
    // 3. Run the Solver 
    const solutionFound = solveTangoBacktracking(board, size); 

    if (solutionFound) {
        console.log("Tango Solution found! Clicking moves...");
        
        // 4. Executing the moves visually with correct click count
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const requiredVal = board[i][j].val;
                const element = board[i][j].element;

                if (requiredVal !== 0 && !board[i][j].fixed) { 
                    
                    // The clicks needed: 1 for Sun (1), 2 for Moon (2)
                    const clicksNeeded = (requiredVal === 1) ? 1 : 2; 
                    const index = i * size + j; // 1D index

                    let clicksSuccessful = true;
                    
                    // Attempt 1: Isolated World Clicks (Try a robust click first)
                    for (let k = 0; k < clicksNeeded; k++) {
                        try {
                            dispatchMouseEvents(element); 
                            await new Promise(r => setTimeout(r, 60)); 
                        } catch (err) {
                            clicksSuccessful = false;
                            break; 
                        }
                    }

                    // Attempt 2: Main World Injection Fallback (Only if Isolated failed)
                    if (!clicksSuccessful) {
                        console.warn(`Isolated clicks failed for cell (${i}, ${j}). Falling back to main world injection.`);
                        
                        // Use the flexible runPageClickCode helper
                        await runPageClickCode(selector, index, clicksNeeded);
                        await new Promise(r => setTimeout(r, 100));
                    }
                }
            }
        }
    } else {
        alert("Could not find a solution for Tango.");
    }
}
