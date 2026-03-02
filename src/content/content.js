import { detectCurrentGame } from "./detectGame.js";
import { createDebugOverlay } from "./shared/debugOverlay.js";
import { solveQueensGame } from "./games/queens/solverQueens.js";
import { solveTangoGame } from "./games/tango/solverTango.js";
import { solveSudokuGame } from "./games/sudoku/solverSudoku.js";
import puppeteer from "puppeteer";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (!request?.action) return;

        if (request.action === "detect_game") {
            sendResponse({ game: detectCurrentGame() });
            return;
        }

        if (request.action === "enable_debug") {
            createDebugOverlay();
            sendResponse({ status: "debug_enabled" });
            return;
        }

        if (request.action.startsWith("solve_")) {
            sendResponse({ status: "ack" });

            setTimeout(() => {
                try {
                    if (request.action.includes("queens")) {
                        solveQueensGame();
                    } else if (request.action.includes("tango")) {
                        solveTangoGame(request.action.includes("_full"));
                    } else if (request.action.includes("sudoku")) {
                        solveSudokuGame();
                    }
                } catch (err) {
                    console.error("Solver execution error:", err);
                }
            }, 0);
        }
    } catch (err) {
        console.error("Message handler error:", err);
    }
});
