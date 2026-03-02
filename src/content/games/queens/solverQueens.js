import { dispatchMouseEvents, dispatchMouseEventsInPage } from "../../shared/clickUtils.js";

export async function solveQueensGame() {
    // === your entire queens solver code unchanged ===

    // ... (All original solveQueensGame code)
    console.log("Starting Solver...");
    const cells = document.querySelectorAll('[data-cell-idx]'); 
    
    if (cells.length === 0) {
        alert("לא נמצא לוח משחק. אנא בדוק את ה-Selectors בקוד.");
        return; 
    }

    const size = Math.sqrt(cells.length);
    const board = []; 

    for (let i = 0; i < size; i++) {
        board[i] = [];
        for (let j = 0; j < size; j++) {
            const index = i * size + j;
            const cell = cells[index];
            
            const ariaLabel = cell.getAttribute('aria-label') || '';
            const colorMatch = ariaLabel.match(/color\s+(.+?),/);
            const region = colorMatch ? colorMatch[1] : 'Unknown';
            board[i][j] = { region: region, element: cell, hasQueen: false };
        }
    }

        if (solveBacktracking(board, size, 0)) {
        console.log("Solution found! Clicking...");
        
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                if (board[i][j].hasQueen) {
                    const index = i * size + j;
                    try {
                        dispatchMouseEvents(board[i][j].element);
                        await new Promise(r => setTimeout(r, 50));
                        dispatchMouseEvents(board[i][j].element);
                        await new Promise(r => setTimeout(r, 100));
                    } catch (err) {
                        console.warn('Content-world dispatch failed, trying page injection', err);
                        await dispatchMouseEventsInPage('[data-cell-idx]', index);
                    }
                }
            }
        }
    } else {
        alert("לא נמצא פתרון. ייתכן שיש טעות בזיהוי האזורים.");
    }


}
