export function detectCurrentGame() {
    const url = window.location.href.toLowerCase();

    if (url.includes('/games/queens')) return 'queens';
    if (url.includes('/tango')) return 'tango';
    if (url.includes('/mini-sudoku') || url.includes('/sudoku')) return 'sudoku';

    if (document.querySelector('[data-cell-idx]')) return 'queens';
    if (document.querySelector('div[data-testid^="cell-"]')) return 'tango';
    if (document.querySelector('.sudoku-cell')) return 'sudoku';

    return 'none';
}
