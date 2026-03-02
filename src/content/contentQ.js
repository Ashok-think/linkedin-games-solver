function detectCurrentGame() {
  const url = window.location.href.toLowerCase();

  console.log(`Current URL: ${url}`);

  if (url.includes('/games/queens')) return 'queens';
  if (url.includes('/tango')) return 'tango';
  if (url.includes('/mini-sudoku') || url.includes('/sudoku')) return 'sudoku';

  // Fallback to DOM-based heuristics
  if (document.querySelector('[data-cell-idx]')) return 'queens';
  if (document.querySelector('button[data-test-id="tango-cell"]')) return 'tango';
  if (document.querySelector('.sudoku-cell')) return 'sudoku';

  return 'none';
}

// Single listener for all incoming messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (!request || !request.action) return;

    if (request.action === 'detect_game') {
      const game = detectCurrentGame();
      sendResponse({ game });
      return; // synchronous response
    }

    // Handle solver commands (ids like solve_queens_step, solve_queens_full, ...)
    if (request.action.startsWith('solve_')) {
      // Acknowledge immediately so the message port is closed cleanly
      sendResponse({ status: 'ack' });

      // Run the solver asynchronously to avoid blocking the message port
      setTimeout(() => {
        try {
          if (request.action.includes('queens')) {
            solveQueensGame();
            return;
          } else if (request.action.includes('tango')) {
              solveTangoGame(request.action.includes('_full'));
              return;
          } else if (request.action.includes('sudoku')) {
            console.log('Sudoku solver not implemented yet');
          }
        } catch (err) {
          console.error('Solver execution error:', err);
        }
      }, 0);

      return; // we've sent a response synchronously
    }
  } catch (err) {
    console.error('Message handler error:', err);
  }
});

// Debug: enable an overlay to help identify Tango selectors and capture hovered element
function createDebugOverlay() {
  if (window.__tango_debug_overlay) return window.__tango_debug_overlay;

  const overlay = document.createElement('div');
  overlay.id = '__tango_debug_overlay';
  overlay.style.position = 'fixed';
  overlay.style.right = '12px';
  overlay.style.top = '12px';
  overlay.style.zIndex = 2147483647;
  overlay.style.background = 'rgba(0,0,0,0.6)';
  overlay.style.color = 'white';
  overlay.style.padding = '8px';
  overlay.style.borderRadius = '8px';
  overlay.style.fontSize = '12px';
  overlay.style.fontFamily = 'sans-serif';
  overlay.style.pointerEvents = 'auto';

  const title = document.createElement('div');
  title.textContent = 'Tango Debug';
  title.style.fontWeight = '700';
  title.style.marginBottom = '6px';
  overlay.appendChild(title);

  const btnCapture = document.createElement('button');
  btnCapture.textContent = 'Capture hovered element';
  btnCapture.style.display = 'block';
  btnCapture.style.marginBottom = '6px';
  btnCapture.addEventListener('click', () => {
    try {
      const m = window.__tango_last_mouse || { x: window.innerWidth/2, y: window.innerHeight/2 };
      const el = document.elementsFromPoint(m.x, m.y)[0];
      if (!el) {
        console.warn('No element under mouse');
        return;
      }
      const html = el.outerHTML;
      console.log('Captured element under mouse:', el);
      console.log(html);
      // try to copy to clipboard (requires user gesture, this click is a user gesture)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(html).then(() => console.log('OuterHTML copied to clipboard'))
          .catch(() => console.warn('Clipboard copy failed'));
      }
    } catch (e) {
      console.error('Capture failed', e);
    }
  });
  overlay.appendChild(btnCapture);

  const btnOutline = document.createElement('button');
  btnOutline.textContent = 'Outline candidates';
  btnOutline.style.display = 'block';
  btnOutline.style.marginBottom = '6px';
  btnOutline.addEventListener('click', () => {
    outlineTangoCandidates();
  });
  overlay.appendChild(btnOutline);

  const btnClear = document.createElement('button');
  btnClear.textContent = 'Clear outlines';
  btnClear.style.display = 'block';
  btnClear.addEventListener('click', () => {
    clearOutlines();
  });
  overlay.appendChild(btnClear);

  document.body.appendChild(overlay);

  // track mouse for capture
  window.__tango_last_mouse = { x: 0, y: 0 };
  window.addEventListener('mousemove', (e) => { window.__tango_last_mouse = { x: e.clientX, y: e.clientY }; });

  window.__tango_debug_overlay = overlay;
  return overlay;
}

function outlineTangoCandidates() {
  clearOutlines();
  const selectors = [
    'button[data-test-id]',
    'button[data-test-id*="tango"]',
    '[data-cell-idx]',
    '[data-index]',
    '.cell',
    '.tile',
    '.board',
    '[role="button"]'
  ];
  const outlined = [];
  selectors.forEach((sel) => {
    const els = Array.from(document.querySelectorAll(sel));
    els.slice(0, 200).forEach((e, i) => {
      e.__tango_prevOutline = e.style.outline || '';
      e.style.outline = '3px dashed rgba(255,165,0,0.9)';
      e.style.outlineOffset = '2px';
      outlined.push(e);
    });
  });
  window.__tango_outlined = outlined;
  console.log('Outlined', outlined.length, 'elements for candidate selectors');
}

function clearOutlines() {
  if (!window.__tango_outlined) return;
  window.__tango_outlined.forEach(e => {
    try { e.style.outline = e.__tango_prevOutline || ''; delete e.__tango_prevOutline; } catch (e) {}
  });
  window.__tango_outlined = null;
}

// Listen for enable_debug action
chrome.runtime.onMessage.addListener((req, s, sendResp) => {
  if (req && req.action === 'enable_debug') {
    createDebugOverlay();
    sendResp({ status: 'debug_enabled' });
  }
});

async function solveQueensGame() {
  console.log("Starting Solver...");

  // 1. זיהוי הלוח והנתונים (יש לעדכן סלקטורים אלו לפי המצב באתר בפועל)
  // טיפ: חפש את האלמנט שמכיל את ה-Grid
  const cells = document.querySelectorAll('[data-cell-idx]'); // דוגמה לשם קלאס (צריך לעדכן)
  
  if (cells.length === 0) {
    alert("לא נמצא לוח משחק. אנא בדוק את ה-Selectors בקוד.");
    return; 
  }

  // חישוב גודל הלוח (שורש כמות התאים)
  const size = Math.sqrt(cells.length);
  const board = []; // מטריצה שתייצג את האזורים (צבעים)

  // המרת ה-DOM למטריצת נתונים
  for (let i = 0; i < size; i++) {
    board[i] = [];
    for (let j = 0; j < size; j++) {
      const index = i * size + j;
      const cell = cells[index];
      
      // זיהוי האזור/צבע לפי data-attribute או צבע רקע
      // לינקדאין משתמשים לעיתים ב data-region-id או background-color
      // קוד קודם (ניסיון כללי):
    // const region = cell.getAttribute('data-region') || getComputedStyle(cell).backgroundColor;

      // קוד מעודכן: חילוץ הצבע מתוך aria-label (מאוד יציב)
      const ariaLabel = cell.getAttribute('aria-label') || '';
      // לדוגמה, חלץ את "Soft Blue" מתוך: "Empty cell of color Soft Blue, row 2, column 7"
      const colorMatch = ariaLabel.match(/color\s+(.+?),/);
      const region = colorMatch ? colorMatch[1] : 'Unknown';

      // אם אתה מעדיף את ה-Class (יותר מהיר):
      // const classList = cell.className.split(/\s+/); // פיצול הקלאסים
      // const colorClass = classList.find(c => c.startsWith('cell-color-'));
      // const region = colorClass;
      board[i][j] = { region: region, element: cell, hasQueen: false };
    }
  }

  // 2. הפעלת אלגוריתם Backtracking לפתרון
  if (solveBacktracking(board, size, 0)) {
    console.log("Solution found! Clicking...");
    
    // 3. ביצוע הפתרון ויזואלית
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (board[i][j].hasQueen) {
            // Try to dispatch more complete mouse events from the content script
            // If that doesn't trigger the page handlers (frameworks sometimes ignore synthetic events),
            // also inject a small script into the page's MAIN world to perform the clicks there.
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

async function solveTangoGame() {
    // 1. Get all cell elements using the stable selector
    const cellElements = document.querySelectorAll('div[data-testid^="cell-"]');
    
    if (cellElements.length === 0) {
        alert("Tango board not found.");
        return;
    }
    
    // ... (rest of the logic) ...

    // 2. Reading the state within the loop:
    cellElements.forEach(cell => {
        const row = parseInt(cell.getAttribute('data-cell-idx')); // You'll need to calculate row/col from this
        
        // Find the inner SVG element to check the state
        const svgElement = cell.querySelector('svg'); 
        const stateTestId = svgElement ? svgElement.getAttribute('data-testid') : 'unknown';

        let val = 0; // 0 = Empty

        if (stateTestId === 'cell-sun') {
            val = 1; // 1 = Sun
        } else if (stateTestId === 'cell-moon') {
            val = 2; // 2 = Moon
        }
        
        // ... store val in your board array ...
    });
}

function dispatchMouseEvents(element) {
    // Attempt to simulate a full mouse sequence
    ['mousedown', 'mouseup', 'click'].forEach(eventType => {
        const event = new MouseEvent(eventType, {
            view: window,
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(event);
    });
}

async function dispatchClickInPageContext(selector, index) {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.textContent = `
            (() => {
                const cells = document.querySelectorAll('${selector}');
                if (cells.length > ${index}) {
                    const targetElement = cells[${index}];
                    // Use a timeout to simulate a human double-click/robust click
                    targetElement.click();
                    setTimeout(() => { 
                        targetElement.click(); 
                        window.postMessage('click_done', '*'); 
                    }, 50); 
                } else {
                    window.postMessage('click_fail', '*'); 
                }
            })();
        `;
        document.head.appendChild(script);
        script.remove(); // Clean up the script tag after execution

        // Communication back from the injected script to the content script
        const listener = (event) => {
            if (event.source === window && (event.data === 'click_done' || event.data === 'click_fail')) {
                window.removeEventListener('message', listener);
                console.log('Page injection status:', event.data);
                resolve(true); // Resolve the promise regardless of success/fail to allow loop continuation
            }
        };
        window.addEventListener('message', listener);
    });
}
// --- האלגוריתם ---

function solveBacktracking(board, size, row) {
  if (row === size) return true; // הגענו לסוף בהצלחה

  for (let col = 0; col < size; col++) {
    if (isValid(board, size, row, col)) {
      // הנח מלכה
      board[row][col].hasQueen = true;

      // נסה להמשיך לשורה הבאה
      if (solveBacktracking(board, size, row + 1)) return true;

      // Backtrack - בטל את ההצבה אם נכשלנו
      board[row][col].hasQueen = false;
    }
  }
  return false;
}

function isValid(board, size, row, col) {
  const currentRegion = board[row][col].region;

  // בדיקה 1: האם יש מלכה באותה שורה? (מטופל מעצם הריצה שורה-שורה, אבל נבדוק ליתר ביטחון)
  // בדיקה 2: האם יש מלכה באותו טור?
  for (let i = 0; i < row; i++) {
    if (board[i][col].hasQueen) return false;
  }

  // בדיקה 3: האם יש מלכה באותו אזור צבע (Region)?
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (board[i][j].hasQueen && board[i][j].region === currentRegion) return false;
    }
  }

  // בדיקה 4: האם יש מלכה באלכסון או נוגעת (חוק ה-Queens של לינקדאין אומר שאסור למלכות לגעת גם באלכסון)
  const directions = [
    [-1, -1], [-1, 0], [-1, 1] // בודקים רק למעלה כי למטה עוד אין מלכות
  ];

  for (let [dx, dy] of directions) {
    const newRow = row + dx;
    const newCol = col + dy;
    if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
      if (board[newRow][newCol].hasQueen) return false;
    }
  }

  return true;
}

// Dispatch a sequence of mouse events from the content script (isolated world)
function dispatchMouseEvents(el) {
  if (!el) throw new Error('element not found');
  const types = ['mouseover', 'mousedown', 'mouseup', 'click'];
  for (const t of types) {
    const ev = new MouseEvent(t, { bubbles: true, cancelable: true, view: window });
    el.dispatchEvent(ev);
  }
}

// Inject a small script into the page (main world) that will dispatch mouse events
// on the element matching selector at the given index. Returns a Promise that
// resolves after injection.
function dispatchMouseEventsInPage(selector, index) {
  return new Promise((resolve) => {
    const code = `(function(){
      try {
        const els = document.querySelectorAll(${JSON.stringify(selector)});
        const el = els[${index}];
        if (!el) return console.warn('Solver inject: element not found', ${JSON.stringify(selector)}, ${index});
        ['mouseover','mousedown','mouseup','click'].forEach(function(t){
          el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
        });
        // small delay then second click
        setTimeout(function(){
          ['mouseover','mousedown','mouseup','click'].forEach(function(t){
            el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
          });
        }, 60);
      } catch(e) { console.error('Injected click error', e); }
    })();`;

    const s = document.createElement('script');
    s.textContent = code;
    (document.head || document.documentElement).appendChild(s);
    // remove after a tick to keep DOM clean
    setTimeout(() => { s.remove(); resolve(); }, 150);
  });
}

// ------------------ Tango helpers ------------------
function isVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
}

async function solveTangoStep(clickAll = false) {
  try {
    console.log('Tango helper: locating cells');
    const selector = 'button[data-test-id="tango-cell"]';
    const nodes = Array.from(document.querySelectorAll(selector)).filter(isVisible);
    if (!nodes || nodes.length === 0) {
      console.warn('Tango: no cells found with selector', selector);
      return;
    }

    if (clickAll) {
      console.log('Tango: full solve (clicking all visible cells)');
      for (let i = 0; i < nodes.length; i++) {
        try {
          dispatchMouseEvents(nodes[i]);
          await new Promise(r => setTimeout(r, 60));
        } catch (e) {
          // fallback to page injection for this cell
          await dispatchMouseEventsInPage(selector, i);
          await new Promise(r => setTimeout(r, 80));
        }
      }
      return;
    }

    // Step: highlight and click the first available cell
    const target = nodes[0];
    console.log('Tango: clicking cell', target);
    // visual cue
    const prevOutline = target.style.outline;
    target.style.outline = '3px solid rgba(0,200,0,0.7)';

    try {
      dispatchMouseEvents(target);
    } catch (err) {
      console.warn('Tango content dispatch failed, injecting into page', err);
      // find index among all matched elements (including invisible) to preserve mapping
      const all = Array.from(document.querySelectorAll(selector));
      const idx = all.indexOf(target);
      await dispatchMouseEventsInPage(selector, idx);
    }

    await new Promise(r => setTimeout(r, 120));
    target.style.outline = prevOutline;
    console.log('Tango: step complete');
  } catch (err) {
    console.error('Tango helper error:', err);
  }
}