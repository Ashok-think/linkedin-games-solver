function detectCurrentGame() {
  const url = window.location.href.toLowerCase();

  console.log(`Current URL: ${url}`);

  if (url.includes('/queens')) return 'queens';
  if (url.includes('/tango')) return 'tango';
  if (url.includes('/mini-sudoku')) return 'sudoku';
  if (url.includes('/zip')) return 'zip';
  if (url.includes('/pinpoint')) return 'pinpoint';

  // Fallback to DOM-based heuristics
  // if (document.querySelector('[data-cell-idx]')) return 'queens';
  // if (document.querySelector('div[data-testid^="cell-"]')) return 'tango';
  // if (document.querySelector('.sudoku-cell')) return 'sudoku';
  // if (document.querySelector('[data-cell-idx]')) return 'zip';
  // if (document.querySelector('[role="grid"] [data-cell-idx]')) return 'pinpoint';
  return 'none';
}

// Single listener for all incoming messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (!request || !request.action) return;
    if (request.action === 'detect_game') {
      const game = detectCurrentGame();
      sendResponse({ game });
      console.log(`Current game: ${game}`);
      return;
    }

    if (request.action.startsWith('solve_')) {
      sendResponse({ status: 'ack' });
      setTimeout(() => {
        try {
          if(request.action.includes("queens")) solveQueensGame();
          else if(request.action.includes("tango")) solveTangoGame();
          else if(request.action.includes("sudoku")) solveSudokuGame();
          else if(request.action.includes("pinpoint")) solvePinpointGame();
          else if(request.action.includes("zip")) solveZipGame();
          else console.log("Unknown action");
        } catch (err) {
          console.error('Solver execution error:', err);
        }
      }, 0);

      return;
    }
  } catch (err) {
    console.error('Message handler error:', err);
  }
});

async function solvePinpointGame() {
    
  // 1. go to the site
    async function fetchHtml(url) {
        try {
            const res = await fetch(url, { method: "GET" });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const html = await res.text();
            console.log(html); // this is the full HTML of the page
            return html;
        } catch (err) {
            console.error("Failed to fetch HTML:", err);
            return null;
        }
    }

    // 2. find the reveal button
    function extractRevealButton(html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const btn = doc.querySelector('button[data-umami-event="Reveal-answer"]');
      console.log("reveal btn:", btn);
      return btn;
    }

    // 3. wait for the revealed answer <p> to appear
    function waitFor(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();

            function check() {
                const el = document.querySelector(selector);
                if (el) return resolve(el);
                if (Date.now() - start > timeout) return reject("Timeout");
                requestAnimationFrame(check);
            }

            check();
        });
    }

    (async () => {
      console.log("Fetching HTML...");
      const html = await fetchHtml("https://pinpointanswer.today/");
      console.log("html found!");

      console.log("Extracting reveal button...");
      const revealBtn = extractRevealButton(html);
      if (!revealBtn) {
          console.error("Reveal button not found");
          return;
      }
      revealBtn.click();

      const answerElement = await waitFor(
      'p.text-primary.font-bold.text-xl.flex-1.text-center'
      );
      console.log("Answer element found:", answerElement);

      
    })();    





    // 5. extract the text
    const answerText = answerElement.textContent.trim();
    console.log("Extracted answer:", answerText);

    // 6. find the input box
    const input = document.querySelector('input.pinpoint__input');
    if (!input) {
        console.error("Input box not found");
        return;
    }

    // 7. write the answer
    input.value = answerText;

    // trigger input event so the game sees the change
    input.dispatchEvent(new Event("input", { bubbles: true }));

    console.log("Answer written into the input box");
}

async function solveZipGame(){
  const zipAPI = new zipGameManager();
  zipAPI.autoSolveZip();
}

async function solveSudokuGame(){
  const sudokuAPI = new sudokuGameManager();
  sudokuAPI.autoSolveSudoku();
}

async function solveQueensGame() {
  const queensAPI = new queensGameManager();
  queensAPI.autoSolveQueens();
}

async function solveTangoGame() {
  const tangoAPI = new tangoGameManager();
  tangoAPI.autoSolveTango();
}

//---------------------queens-----------------------------------------------

class queensGameManager {

  async autoSolveQueens(){

    console.log("Queen Starting Solver...");

    //find queens game board
    const data_cell = document.querySelectorAll('[data-cell-idx]');   
    //if (data_cell.length === 0) return;

    //calculate game board : row \ line size
    const row_size = Math.sqrt(data_cell.length);
    
    //matrix that represent the areas
    const game_board = []; 
    for (let i = 0; i < row_size; i++) {
      game_board[i] = [];
      for (let j = 0; j < row_size; j++) {
        const index = i * row_size + j;
        const cell = data_cell[index];
        //check area-lable
        const aria_label = cell.getAttribute('aria-label') || '';
        //// For example, extract "Soft Blue" from: "Empty cell of color Soft Blue, row 2, column 7"
        const colorMatch = aria_label.match(/color\s+(.+?),/);
        const region = colorMatch ? colorMatch[1] : 'Unknown';
        // const region = colorClass;
        game_board[i][j] = { region: region, element: cell, hasQueen: false };
      }
    }

    //backtracking algorithm 
    if (this.solveBacktracking(game_board, row_size, 0)) {
      console.log("Solution found!");
      
      // apply solution
      for (let i = 0; i < row_size; i++) {
        for (let j = 0; j < row_size; j++) {
          if (game_board[i][j].hasQueen) {
              // Dispatch complete mouse events from the content script.
              // If page handlers don't respond (some frameworks ignore synthetic events),
              // inject a script into the page's main world to perform clicks natively.
              const index = i * row_size + j;
              try {
                this.dispatchMouseEvents(game_board[i][j].element);
                await new Promise(r => setTimeout(r, 50));
                this.dispatchMouseEvents(game_board[i][j].element);
                await new Promise(r => setTimeout(r, 100));
              } catch (err) {
                console.warn('Content-world dispatch failed, trying page injection', err);
                await this.dispatchMouseEventsInPage('[data-cell-idx]', index);
              }
          }
        }
      }
    } else {
      alert("solution was not found.");
    }

  }

  solveBacktracking(board, size, row) {
    if (row === size) return true; //recursion ended succesfully 

    for (let col = 0; col < size; col++) {
      if (this.isValid(board, size, row, col)) {
        //queen
        board[row][col].hasQueen = true;

        //next line
        if (this.solveBacktracking(board, size, row + 1)) return true;

        //cancle if failed
        board[row][col].hasQueen = false;
      }
    }
    return false;
  }

  isValid(board, size, row, col) {
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

  dispatchMouseEvents(element) {
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
}

//---------------------tango------------------------------------------------

class tangoGameManager {
  
  async autoSolveTango() {
    const prioritizedApis = [new TangoDomApiV0()];
    for (let i = 0; i < prioritizedApis.length; ) {
      const api = prioritizedApis[i];
      try {
        await api.autoSolve();
        return;
      } catch (e) {
        console.error(e);
        if (++i !== prioritizedApis.length) {
          console.info('Will reattempt autoSolve() via a prior API');
        } else {
          console.error('All APIs exhausted');
        }
      }
    }
  }

}

class TangoDomApi {

  async autoSolve() {
    console.log("autoSolve getTangoGridDiv");
    const gridDiv = this.getTangoGridDiv();
    console.log("autoSolve getCellDivsFromGridDiv");
    const cellDivs = this.getCellDivsFromGridDiv(gridDiv);
    console.log("autoSolve learnMarkStrategy");
    const markStrategy = await TangoUtils.learnMarkStrategy(cellDivs, this.cellDivIsLocked, this.cellDivIsBlank);
    console.log("autoSolve transformTangoGridDiv");
    const tangoGridArgs = this.transformTangoGridDiv(cellDivs, markStrategy);
    console.log("autoSolve solveTango");
    const markSequence = TangoUtils.solveTango(...tangoGridArgs);
    console.log("autoSolve markCells");
    this.markCells(cellDivs, markStrategy, markSequence);
    console.log("autoSolve end");
  }

  getCellDivsFromGridDiv(gridDiv) {
    const filtered = Array.from(gridDiv.children)
      .filter(c => this.gridDivChildIsCellDiv(c));
    if (filtered.length === 0) {
      this.orElseThrow(null, 'getCellDivsFromGridDiv', 'gridDiv contained no '
          + 'children that matched cellDiv filter');
    }
    const cellDivs = new Array(filtered.length);
    for (const cellDiv of filtered) {
      cellDivs[this.getCellDivIdx(cellDiv)] = cellDiv;
    }
    return cellDivs;
  }

  transformTangoGridDiv(cellDivs, markStrategy) {
    const initialYellows = [];
    const initialBlues = [];
    const downEqualSigns = [];
    const downCrosses = [];
    const rightEqualSigns = [];
    const rightCrosses = [];
    for (let i = 0; i < cellDivs.length; i++) {
      const cellDiv = cellDivs[i];
      this.#checkLocked(markStrategy, cellDiv, i, initialYellows, initialBlues);
      this.#checkSignage(cellDiv, i, downEqualSigns, downCrosses,
          rightEqualSigns, rightCrosses);
    }
    return [initialYellows, initialBlues, downEqualSigns, downCrosses,
        rightEqualSigns, rightCrosses];
  }

  #checkLocked(markStrategy, cellDiv, idx, initialYellows, initialBlues) {
    const markExtractor = this.#getMarkExtractor(markStrategy);
    if (this.cellDivIsLocked(cellDiv)) {
      markStrategy.onInitialCell(cellDiv, idx, initialYellows, initialBlues,
          markExtractor);
    }
  }

  #checkSignage(cellDiv, idx, downEqualSigns, downCrosses, rightEqualSigns,
      rightCrosses) {
    let sign;
    if ((sign = this.getCellDivDownSign(cellDiv))) {
      if ('Equal' === sign) {
        downEqualSigns.push(idx);
      } else if ('Cross' === sign) {
        downCrosses.push(idx);
      }
    }
    if ((sign = this.getCellDivRightSign(cellDiv))) {
      if ('Equal' === sign) {
        rightEqualSigns.push(idx);
      } else if ('Cross' === sign) {
        rightCrosses.push(idx);
      }
    }
  }

  markCells(cellDivs, markStrategy, markSequence) {
    const markExtractor = this.#getMarkExtractor(markStrategy);
    for (const mark of markSequence) {
      const cell = cellDivs[mark.idx];
      const target = mark.color;
      for (let i = markStrategy.getCellDivMark(cell, markExtractor);
          i !== target; i = (i + 1) % 3) {
        TangoUtils.doOneMouseCycle(cell);
      }
    }
  }

  #getMarkExtractor(markStrategy) {
    const markStrategyType = markStrategy.getMarkStrategyType();
    if ('svgTitle' === markStrategyType) {
      return this.getCellDivSvgTitle;
    } else if ('imgSrc' === markStrategyType) {
      return this.getCellDivImgSrc;
    } else {
      throw new Error('Invalid markStrategyType: ' + markStrategyType);
    }
  }

  
}

class TangoDomApiV0 extends TangoDomApi {

  getTangoGridDiv() {
    return this.orElseThrow(this.getGridDiv(d => d.querySelector('.lotka-grid')),
        'getTangoGridDiv', 'TangoGridDiv selector yielded nothing');
  }

  gridDivChildIsCellDiv(gridDivChild) {
    return gridDivChild.attributes?.getNamedItem('data-cell-idx');
  }

  cellDivIsBlank(cellDiv) {
    return !cellDiv.classList.contains('lotka-cell--locked')
        && cellDiv.querySelector('.lotka-cell-content')
            ?.querySelector('svg')
            ?.classList
            ?.contains('lotka-cell-empty');
  }

  cellDivIsLocked(cellDiv) {
    return cellDiv.classList.contains('lotka-cell--locked');
  }

  getCellDivIdx(cellDiv) {
    const dataCellIdx = cellDiv.attributes
        ?.getNamedItem('data-cell-idx')?.value;
    return parseInt(this.orElseThrow(dataCellIdx, 'getCellDivIdx',
        `Failed to parse an integer data cell ID from ${dataCellIdx}`));
  }

  getCellDivSvgTitle(cellDiv) {
    return cellDiv.querySelector('.lotka-cell-content')
        ?.querySelector('svg')
        ?.querySelector('title')
        ?.textContent
        ?.toLowerCase();
  }

  getCellDivImgSrc(cellDiv) {
    return cellDiv.querySelector('.lotka-cell-content')
        ?.querySelector('img')
        ?.src;
  }

  getCellDivDownSign(cellDiv) {
    return cellDiv.querySelector('.lotka-cell-edge--down')
        ?.querySelector('svg')
        ?.ariaLabel;
  }

  getCellDivRightSign(cellDiv) {
    return cellDiv.querySelector('.lotka-cell-edge--right')
        ?.querySelector('svg')
        ?.ariaLabel;
  }

  orElseThrow(result, fname, cause) {
    if (result != null) {
      return result;
    }
    throw new Error(`${fname} failed using QueensDomApiV0: ${cause}`);
  }

  getGridDiv(extractFromDocument) {
    console.log("getGridDiv function--");
    console.log("Current URL:", window.location.href);
    console.log("Is in iframe:", window !== window.top);
    
    let gridDiv = extractFromDocument.call(null, document);//err

    if (gridDiv) {
      console.log("Found in current document");
      return gridDiv;
    }
    if (window === window.top) {
      const frame = document.querySelector('iframe');
      if (frame) {
        try {
          const frameDoc = frame.contentDocument || frame.contentWindow.document;
          gridDiv = extractFromDocument.call(null, frameDoc);
          if (gridDiv) {
            console.log("Found in iframe");
            return gridDiv;
          }
        } catch (e) {
          console.warn('Cannot access iframe (cross-origin):', e.message);
          // This is expected for cross-origin iframes
          // The content script running IN the iframe will handle it
        }
      }
    }
    
    throw new Error('Could not extract div corresponding to grid');

    return gridDiv;
  } 

}

class TangoGrid {

  // TangoLine[]
  #lines;
  // TangoLineQueue
  #taskQueue;

  constructor(initialYellows, initialBlues,
      downEqualSigns, downCrosses,
      rightEqualSigns, rightCrosses) {

    // Initialize buffers for local fields.
    this.#lines = new Array(12);
    this.#taskQueue = new TangoLineQueue();

    // Initialize argument builders for TangoLines, and add any lines that
    // contain a colored cell to #taskQueue.
    const rowYellows = newEmptyGroup();
    const rowBlues = newEmptyGroup();
    const colYellows = newEmptyGroup();
    const colBlues = newEmptyGroup();
    const rowEqualSigns = newEmptyGroup();
    const colEqualSigns = newEmptyGroup();
    const rowCrosses = newEmptyGroup();
    const colCrosses = newEmptyGroup();
    feedGroups(initialYellows, rowYellows, colYellows, this.#taskQueue);
    feedGroups(initialBlues, rowBlues, colBlues, this.#taskQueue);
    feedGroups(downEqualSigns, undefined, colEqualSigns, this.#taskQueue);
    feedGroups(rightEqualSigns, rowEqualSigns, undefined, this.#taskQueue);
    feedGroups(downCrosses, undefined, colCrosses, this.#taskQueue);
    feedGroups(rightCrosses, rowCrosses, undefined, this.#taskQueue);

    // Initialize the TangoLines.
    for (let i = 0; i < 6; i++) {
      this.#lines[i] = new TangoLine(i, rowYellows[i], rowBlues[i],
          rowEqualSigns[i], rowCrosses[i]);
      this.#lines[i + 6] = new TangoLine(i + 6, colYellows[i], colBlues[i],
          colEqualSigns[i], colCrosses[i]);
    }

    function newEmptyGroup() {
      return [[], [], [], [], [], []];
    }

    function feedGroups(seed, rowGroup, columnGroup, queue) {
      const shouldQueue = rowGroup && columnGroup;
      for (const idx of seed) {
        const c = idx % 6;
        const r = (idx - c) / 6;
        if (rowGroup) {
          rowGroup[r].push(c);
          if (shouldQueue) {
            queue.offer(r);
          }
        }
        if (columnGroup) {
          columnGroup[c].push(r);
          if (shouldQueue) {
            queue.offer(c + 6);
          }
        }
      }
    }

  }

  solve() {
    const markSequence = [];
    while (!this.#taskQueue.isEmpty()) {
      const poll = this.#taskQueue.poll();
      const line = this.#lines[poll];
      const changeList = line.consolidate();
      for (const delta of changeList) {
        this.#onDelta(line, delta, markSequence);
      }
    }
    return markSequence;
  }

  #onDelta(line, delta, markSequence) {
    const isRow = line.getId() < 6;
    // Unpack idx, color from delta, and choose appropriate output list.
    let idx, color;
    if (delta >= 0) {
      idx = delta;
      color = 1;
    } else {
      idx = -(delta + 1);
      color = 2;
    }
    // Update the perpendicular TangoLine.
    const crossLineId = isRow ? 6 + idx : idx;
    const crossLineIdx = isRow ? line.getId() : line.getId() - 6;
    this.#lines[crossLineId].assignColor(crossLineIdx, color);
    // Determine what values to push to the solve() output and taskQueue.
    let resultIdx, offer;
    if (isRow) {
      resultIdx = 6 * crossLineIdx + idx;
      offer = 6 + idx;
    } else {
      resultIdx = 6 * idx + crossLineIdx;
      offer = idx;
    }
    // Update the task queue.
    this.#taskQueue.offer(offer);
    // Perform the push to the solve() output.
    markSequence.push({'color': color, 'idx': resultIdx});
  }

}

class TangoLineQueue {

  static #CAPACITY = 12;

  #bufferLittle; // bits 0-31
  #bufferBig; // bits 32-47
  #linePresences;
  #size;

  constructor() {
    this.#bufferLittle = 0;
    this.#bufferBig = 0;
    this.#linePresences = 0;
    this.#size = 0;
  }

  // Prerequisite: 0 <= line < CAPACITY
  offer(line) {
    const lineBit = (1 << line);
    if ((this.#linePresences & lineBit) !== 0) {
      return;
    }
    if (this.#size < 8) {
      this.#bufferLittle |= ((line + 1) << (this.#size << 2));
    } else {
      this.#bufferBig |= ((line + 1) << ((this.#size - 8) << 2));
    }
    this.#linePresences |= lineBit;
    this.#size++;
  }

  poll() {
    if (this.isEmpty()) {
      throw new Error("Can't call poll() on empty TangoLineQueue");
    }
    const result = (this.#bufferLittle & 15) - 1;
    this.#bufferLittle = (this.#bufferLittle >>> 4);
    if (this.#size > 8) {
      const carry = this.#bufferBig & 15;
      this.#bufferLittle |= (carry << 28);
      this.#bufferBig = (this.#bufferBig >>> 4);
    }
    // this.#linePresences -= (1 << result); // works, since bit must be set
    this.#linePresences &= ~(1 << result); // pure bitwise alternative
    this.#size--;
    return result;
  }

  isEmpty() {
    return this.#size === 0;
  }

}

class TangoSvgTitleStrategy {
  
  #yellowTitle;
  #blueTitle;

  constructor(yellowTitle, blueTitle) {
    this.#yellowTitle = yellowTitle;
    this.#blueTitle = blueTitle;
  }

  getMarkStrategyType() {
    return 'svgTitle';
  }

  onInitialCell(cellDiv, id, initialYellows, initialBlues,
      doGetCellDivSvgTitle) {
    const mark = this.getCellDivMark(cellDiv, doGetCellDivSvgTitle);
    if (mark === 1) {
      initialYellows.push(id);
    } else if (mark === 2) {
      initialBlues.push(id);
    } else {
      console.warn('Ignored initial cell with unexpected title '
          + doGetCellDivSvgTitle.call(null, cellDiv));
    }
  }

  getCellDivMark(cellDiv, doGetCellDivSvgTitle) {
    const title = doGetCellDivSvgTitle.call(null, cellDiv);
    if (this.#yellowTitle === title) {
      return 1;
    } else if (this.#blueTitle === title) {
      return 2;
    } else {
      return 0;
    }
  }

}

class TangoLine {

  static #EMPTY_COLOR = 0;
  static #YELLOW_COLOR = 1;
  static #BLUE_COLOR = 2;
  static #COMPLEMENT_COLOR = 3;
  static #DIMENSION = 6;

  #id;
  #cellColors;
  #equalSigns;
  #equalSignEntanglements
  #crosses;
  #crossEntanglements;
  #yellowCount;
  #blueCount;

  constructor(id, yellowCells, blueCells, equalSigns, crosses) {
    this.#id = id;
    this.#cellColors = new Array(TangoLine.#DIMENSION)
        .fill(TangoLine.#EMPTY_COLOR);

    // Validate input array values.
    assertInRange(yellowCells, 0, TangoLine.#DIMENSION - 1, "yellowCells");
    assertInRange(blueCells, 0, TangoLine.#DIMENSION - 1, "blueCells");
    assertInRange(equalSigns, 0, TangoLine.#DIMENSION - 2, "equalSigns");
    assertInRange(crosses, 0, TangoLine.#DIMENSION - 2, "crosses");

    // 3+ equals never valid; 2 valid only in specific placements.
    this.#equalSigns = [...new Set(equalSigns)].sort((a, b) => a - b);
    if (this.#equalSigns.length > 2) {
      throw new Error("Too many equal signs: " + this.#equalSigns
          + "( id=" + id + ")");
    } else if (this.#equalSigns.length === 2) {
      const first = this.#equalSigns[0];
      const last = this.#equalSigns[1];
      const diff = this.#equalSigns[1] - this.#equalSigns[0];
      if (diff !== 4 && diff !== -4 && diff !== 2 && diff !== -2) {
        throw new Error("Too close equal signs: " + this.#equalSigns
            + " (id=" + id + ")");
      }
    }

    this.#crosses = [...new Set(crosses)].sort((a, b) => a - b);
    this.#yellowCount = 0;
    this.#blueCount = 0;

    // Check for invalid overlaps.
    assertDisjoint(yellowCells, blueCells, "yellowCells/blueCells");
    assertDisjoint(this.#equalSigns, this.#crosses, "equalSigns/crosses");

    // Assign color-related fields.
    assignColor(this, yellowCells, "Yellow", TangoLine.#YELLOW_COLOR, () => {
      this.#yellowCount++;
    });
    assignColor(this, blueCells, "Blue", TangoLine.#BLUE_COLOR, () => {
      this.#blueCount++;
    });

    // Ensure that we haven't already failed.
    this.validate();

    // Compute a small handful of "if cell a is marked with foo, then mark b
    // with bar" relationships in advance.
    this.#equalSignEntanglements =
        computeEqualSignEntanglements(this.#equalSigns);
    this.#crossEntanglements = computeCrossEntanglements(this.#crosses);

    function assertInRange(arr, low, high, prefix) {
      for (const a of arr) {
        if (a < low || a > high) {
          throw new Error(prefix + " out of expected range [" + low + ", "
              + high + "]: " + arr);
        }
      }
    }

    function assertDisjoint(arr1, arr2, prefix) {
      // Don't bother with hashing, the arrays should be tiny
      for (const a of arr2) {
        if (arr1.includes(a)) {
          throw new Error(prefix + " contain overlapping element " + a);
        }
      }
    }

    function assignColor(context, cells, colorStr, colorEnum, increment) {
      for (const cell of cells) {
        if (cell < 0 || cell >= TangoLine.#DIMENSION) {
          throw new Error(colorStr + " cell " + cell + " out of bounds "
              + "(id=" + id + ")");
        }
        if (context.#cellColors[cell] === TangoLine.#EMPTY_COLOR) {
          context.#cellColors[cell] = colorEnum;
          increment.call(context);
        }
      }
    }

    function computeEqualSignEntanglements(equalSigns) {
      const result = [];
      if (equalSigns.length === 1) {
        if (equalSigns[0] === 0) {
          result.push(3);
          result.push(4);
        } else if (equalSigns[0] === 4) {
          result.push(1);
          result.push(2);
        } else if (equalSigns[0] === 1) {
          result.push(4);
          result.push(5);
        } else if (equalSigns[0] === 3) {
          result.push(0);
          result.push(1);
        }
      }
      return result;
    }

    function computeCrossEntanglements(crosses) {
      const result = [];
      // Determine the number of cells that are not part of a cross.
      const free = crossFreeCells(crosses);
      if (free.length === 1) {
        // The entangled cells are the free cell and the longest chain head.
        result.push(free[0]);
        result.push(longestChainHead(crosses));
      } else if (free.length === 2) {
        // The entangled cells are the two free cells.
        result.push(free[0]);
        result.push(free[1]);
      }
      return result;

      function crossFreeCells(crosses) {
        const free = [];
        for (let i = 0; i < TangoLine.#DIMENSION; i++) {
          if (!crosses.includes(i) && !crosses.includes(i - 1)) {
            free.push(i);
          }
        }
        return free;
      }

      function longestChainHead(crosses) {
        let curLen = 1;
        let curHead = 0;
        let bestLen = curLen;
        let bestHead = curHead;
        for (let i = 1; i < crosses.length; i++) {
          if (crosses[i] === crosses[i - 1] + 1) {
            curLen++;
          } else {
            if (curLen > bestLen) {
              bestLen = curLen;
              bestHead = curHead;
            }
            curLen = 1;
            curHead = i;
          }
        }
        if (curLen > bestLen) {
          bestHead = curHead;
        }
        return crosses[bestHead];
      }
    }

  }

  getId() {
    return this.#id;
  }

  assignColor(idx, color) {
    this.#assignColor(idx, color, []);
  }

  /** Marks as many cells as possible, and returns all newly marked cells. */
  consolidate() {
    const result = [];
    let didChange;
    do {
      didChange = this.#consolidateOnce(result);
    } while (didChange === 1);
    return result;
  }

  #consolidateOnce(changeList) {
    let result = 0;
    result = Math.max(result, this.#checkThreeOfColor(changeList));
    result = Math.max(result, this.#checkConsecutivePairs(changeList));
    result = Math.max(result, this.#checkEngulfing(changeList));
    result = Math.max(result, this.#checkBorderNeighborPigeonhole(changeList));
    result = Math.max(result, this.#checkExtendedBorderPigeonhole(changeList));
    result = Math.max(result, this.#checkPureBorderPigeonhole(changeList));
    result = Math.max(result, this.#checkBasicEquals(changeList));
    result = Math.max(result, this.#checkEqualTangentPigeonhole(changeList))
    result = Math.max(result, this.#checkEqualBorderPigeonhole(changeList));
    result = Math.max(result, this.#checkMiddleEqual(changeList));
    result = Math.max(result, this.#checkBasicCross(changeList));
    result = Math.max(result, this.#checkEmptySingleDoubleCross(changeList));
    result = Math.max(result, this.#checkEqualSignEntangledCells(changeList));
    result = Math.max(result, this.#checkCrossEntangledCells(changeList));
    return result;
  }

  // If a line contains three cells of COLOR, then marks all remaining cells
  // as OTHER_COLOR.
  #checkThreeOfColor(changeList) {
    if (this.#yellowCount === 3) {
      for (let i = 0; i < this.#cellColors.length; i++) {
        if (this.#cellColors[i] === TangoLine.#EMPTY_COLOR) {
          this.#assignColor(i, TangoLine.#BLUE_COLOR, changeList);
        }
      }
      return 2;
    } else if (this.#blueCount === 3) {
      for (let i = 0; i < this.#cellColors.length; i++) {
        if (this.#cellColors[i] === TangoLine.#EMPTY_COLOR) {
          this.#assignColor(i, TangoLine.#YELLOW_COLOR, changeList);
        }
      }
      return 2;
    } else {
      return 0;
    }
  }

  // If an unmarked cell is either followed by or preceeded by two cells of
  // COLOR, then marks it as OTHER_COLOR.
  #checkConsecutivePairs(changeList) {
    let result = 0;
    for (let i = 0; i < TangoLine.#DIMENSION - 2; i++) {
      const color = this.#cellColors[i];
      const nextColor = this.#cellColors[i+1];
      const thenColor = this.#cellColors[i+2];
      if (color === TangoLine.#EMPTY_COLOR
          && nextColor !== TangoLine.#EMPTY_COLOR
          && nextColor === thenColor) {
        result = this.#assignColor(i, this.#otherColor(nextColor), changeList);
      }
    }
    for (let i = 5; i > 1; i--) {
      const color = this.#cellColors[i];
      const nextColor = this.#cellColors[i-1];
      const thenColor = this.#cellColors[i-2];
      if (color === TangoLine.#EMPTY_COLOR
          && nextColor !== TangoLine.#EMPTY_COLOR
          && nextColor === thenColor) {
        result = this.#assignColor(i, this.#otherColor(nextColor), changeList);
      }
    }
    return result;
  }

  // If an unmarked non-border cell's neighbors are both of COLOR, then marks
  // the cell as OTHER_COLOR.
  #checkEngulfing(changeList) {
    let result = 0;
    for (let i = 1; i < 5; i++) {
      const color = this.#cellColors[i];
      const prevColor = this.#cellColors[i-1];
      const nextColor = this.#cellColors[i+1];
      if (color === TangoLine.#EMPTY_COLOR
          && prevColor !== TangoLine.#EMPTY_COLOR
          && prevColor === nextColor) {
        result = this.#assignColor(i, this.#otherColor(prevColor), changeList);
      }
    }
    return result;
  }

  // If an unmarked border cell neighbors a COLOR cell and the other border
  // cell is also of COLOR, then marks this border cell as OTHER_COLOR.
  #checkBorderNeighborPigeonhole(changeList) {
    const firstBorder = 0;
    const lastBorder = TangoLine.#DIMENSION - 1;
    const firstColor = this.#cellColors[firstBorder];
    const lastColor = this.#cellColors[lastBorder];
    if (firstColor === TangoLine.#EMPTY_COLOR
        && lastColor !== TangoLine.#EMPTY_COLOR
        && this.#cellColors[firstBorder + 1] === lastColor) {
      return this.#assignColor(firstBorder, this.#otherColor(lastColor),
          changeList);
    } else if (lastColor === TangoLine.#EMPTY_COLOR
        && firstColor !== TangoLine.#EMPTY_COLOR
        && this.#cellColors[lastBorder - 1] === firstColor) {
      return this.#assignColor(lastBorder, this.#otherColor(firstColor),
          changeList);
    }
    return 0;
  }

  // If a border cell is unmarked, and the other border cell and its neighbor
  // are both of COLOR, then mark the original border cell as OTHER_COLOR. Note
  // that this setup is also separately guaranteed to trigger
  // #checkConsecutivePairs().
  #checkExtendedBorderPigeonhole(changeList) {
    const firstBorder = 0;
    const lastBorder = TangoLine.#DIMENSION - 1;
    const firstColor = this.#cellColors[firstBorder];
    const lastColor = this.#cellColors[lastBorder];
    if (firstColor === TangoLine.#EMPTY_COLOR
        && lastColor !== TangoLine.#EMPTY_COLOR
        && this.#cellColors[lastBorder - 1] === lastColor) {
      return this.#assignColor(firstBorder, this.#otherColor(lastColor),
          changeList);
    } else if (lastColor === TangoLine.#EMPTY_COLOR
        && firstColor !== TangoLine.#EMPTY_COLOR
        && this.#cellColors[firstBorder + 1] === firstColor) {
      return this.#assignColor(lastBorder, this.#otherColor(firstColor),
          changeList);
    }
    return 0;
  }

  // If an unmarked cell neighbors a marked border cell and both border cells
  // are of COLOR, then mark this cell as OTHER_COLOR.
  #checkPureBorderPigeonhole(changeList) {
    let result = 0;
    const firstBorder = 0;
    const lastBorder = TangoLine.#DIMENSION - 1;
    const firstColor = this.#cellColors[firstBorder];
    const lastColor = this.#cellColors[lastBorder];
    if (firstColor !== TangoLine.#EMPTY_COLOR
        && lastColor === firstColor) {
      const firstNeighbor = firstBorder + 1;
      const lastNeighbor = lastBorder - 1;
      if (this.#cellColors[firstNeighbor] === TangoLine.#EMPTY_COLOR) {
        result = this.#assignColor(firstNeighbor, this.#otherColor(firstColor),
            changeList);
      }
      if (this.#cellColors[lastNeighbor] === TangoLine.#EMPTY_COLOR) {
        result = this.#assignColor(lastNeighbor, this.#otherColor(firstColor),
            changeList);
      }
    }
    return result;
  }

  // If an unmarked cell is part of an = and its counterpart is of COLOR, then
  // mark the cell as COLOR.
  #checkBasicEquals(changeList) {
    let result = 0;
    for (const sign of this.#equalSigns) {
      const firstColor = this.#cellColors[sign];
      const nextColor = this.#cellColors[sign + 1];
      if (firstColor === TangoLine.#EMPTY_COLOR
          && nextColor !== TangoLine.#EMPTY_COLOR) {
        result = this.#assignColor(sign, nextColor, changeList);
      } else if (nextColor === TangoLine.#EMPTY_COLOR
          && firstColor !== TangoLine.#EMPTY_COLOR) {
        result = this.#assignColor(sign + 1, firstColor, changeList);
      }
    }
    return result;
  }

  // If an unmarked cell that is part of an = touches a COLOR cell, then mark
  // this cell as OTHER_COLOR. Note that for simplicity, we do not mark the
  // other side of the equal; the next iteration of consolidateOnce() will
  // catch this anyway.
  #checkEqualTangentPigeonhole(changeList) {
    let result = 0;
    for (const sign of this.#equalSigns) {
      const firstColor = this.#cellColors[sign];
      if (firstColor === TangoLine.#EMPTY_COLOR && sign !== 0) {
        const leftColor = this.#cellColors[sign - 1];
        if (leftColor !== TangoLine.#EMPTY_COLOR) {
          result = this.#assignColor(sign, this.#otherColor(leftColor),
              changeList);
        }
      }
      const nextColor = this.#cellColors[sign + 1];
      if (nextColor === TangoLine.#EMPTY_COLOR
          && sign !== TangoLine.#DIMENSION - 2) {
        const rightColor = this.#cellColors[sign + 2];
        if (rightColor !== TangoLine.#EMPTY_COLOR) {
          result = this.#assignColor(sign + 1, this.#otherColor(rightColor),
              changeList);
        }
      }
    }
    return result;
  }

  // If an unmarked border cell is part of an = and the other border cell is of
  // COLOR, then mark this cell as OTHER_COLOR.
  #checkEqualBorderPigeonhole(changeList) {
    let result = 0;
    const first = 0;
    const last = TangoLine.#DIMENSION - 1;
    for (const sign of this.#equalSigns) {
      if (sign === 0
          && this.#cellColors[first] === TangoLine.#EMPTY_COLOR) {
        const lastColor = this.#cellColors[last];
        if (lastColor !== TangoLine.#EMPTY_COLOR) {
          result = this.#assignColor(first, this.#otherColor(lastColor),
              changeList);
        }
      } else if (sign === TangoLine.#DIMENSION - 2
          && this.#cellColors[last] === TangoLine.#EMPTY_COLOR) {
        const firstColor = this.#cellColors[first];
        if (firstColor !== TangoLine.#EMPTY_COLOR) {
          result = this.#assignColor(last, this.#otherColor(firstColor),
              changeList);
        }
      }
    }
    return result;
  }

  // If an = is in the middle and a border cell is of COLOR, then mark the other
  // border cell as OTHER_COLOR.
  #checkMiddleEqual(changeList) {
    let result = 0;
    if (this.#equalSigns.includes(2)) {
      const firstColor = this.#cellColors[0];
      const lastColor = this.#cellColors[TangoLine.#DIMENSION - 1];
      if (firstColor === TangoLine.#EMPTY_COLOR
          && lastColor !== firstColor) {
        result = this.#assignColor(0, this.#otherColor(lastColor), changeList);
      } else if (lastColor === TangoLine.#EMPTY_COLOR
          && firstColor !== lastColor) {
        result = this.#assignColor(TangoLine.#DIMENSION - 1,
            this.#otherColor(firstColor), changeList);
        return 1;
      }
    }
    return result;
  }

  // If an unmarked cell is part of a cross and its counterpart is of COLOR,
  // then mark the cell as OTHER_COLOR.
  #checkBasicCross(changeList) {
    let result = 0;
    for (const sign of this.#crosses) {
      const firstColor = this.#cellColors[sign];
      const nextColor = this.#cellColors[sign + 1];
      if (firstColor === TangoLine.#EMPTY_COLOR
          && nextColor !== TangoLine.#EMPTY_COLOR) {
        result = this.#assignColor(sign, this.#otherColor(nextColor),
            changeList);
      } else if (nextColor === TangoLine.#EMPTY_COLOR
          && firstColor !== TangoLine.#EMPTY_COLOR) {
        result = this.#assignColor(sign + 1, this.#otherColor(firstColor),
            changeList);
      }
    }
    return result;
  }

  // If a single-cross region is unmarked and two other cells share a color,
  // then all unmarked cells outside this region must be of the other color.
  // Also, if an unmarked double-cross is in a line that contains two elements
  // of a color, then mark the outside of this double-cross as the other color.
  //
  // It may not be obvious why this method handles both cases at once. The check
  // inside the innermost for-loop invokes assignColor() only on an index i such
  // that i is 1) unmarked and 2) either not part of a cross run, or the end of
  // a double-cross run. The "leapfrogging" strategy upon encountering an empty
  // cell that's to the left of a cross sign (no leapfrogging on rights),
  // combined with the restrictions on totalMarked, guarantees this.
  #checkEmptySingleDoubleCross(changeList) {
    // This strategy won't help if we've marked too many or too few cells.
    const totalMarked = this.#blueCount + this.#yellowCount;
    if (totalMarked >= 4 || totalMarked < 2) {
      return 0;
    }
    // It also won't help if we don't have enough cells of a color.
    let targetColor = TangoLine.#EMPTY_COLOR;
    if (this.#blueCount === 2) {
      targetColor = TangoLine.#YELLOW_COLOR;
    } else if (this.#yellowCount === 2) {
      targetColor = TangoLine.#BLUE_COLOR;
    } else {
      return 0;
    }
    // Or if there is no empty cross to begin with.)
    let hasEmptyCross = false;
    for (const cross of this.#crosses) {
      const firstColor = this.#cellColors[cross];
      const nextColor = this.#cellColors[cross + 1];
      if (firstColor === nextColor && firstColor === TangoLine.#EMPTY_COLOR) {
        hasEmptyCross = true;
        break;  
      }
    }
    if (!hasEmptyCross) {
      return 0;
    }
    // Finally, seek a qualified cell.
    for (let i = 0; i < TangoLine.#DIMENSION; i++) {
      if (this.#crosses.includes(i)) {
        i++;
        continue;
      }
      if (this.#cellColors[i] === TangoLine.#EMPTY_COLOR) {
        this.#assignColor(i, targetColor, changeList);
        return 1;
      }
    }
    return 0;
  }

  // If this line has exactly two non-cross cells and one is of COLOR, then the
  // other must be of OTHER_COLOR. Also, if a marked cell is the only non-cross
  // cell, then the outer cell of the longer cross region (it'll either be a
  // double or a quadruple) must be of OTHER_COLOR.
  //
  // Note that such "entangled" relationships are known at construction time.
  #checkCrossEntangledCells(changeList) {
    if (this.#crossEntanglements.length === 2) {
      const first = this.#crossEntanglements[0];
      const firstColor = this.#cellColors[first];
      const last = this.#crossEntanglements[1];
      const lastColor = this.#cellColors[last];
      if (firstColor === TangoLine.#EMPTY_COLOR
          && lastColor !== TangoLine.#EMPTY_COLOR) {
        this.#assignColor(first, this.#otherColor(lastColor), changeList);
        return 1;
      } else if (firstColor !== TangoLine.#EMPTY_COLOR
          && lastColor === TangoLine.#EMPTY_COLOR) {
        this.#assignColor(last, this.#otherColor(firstColor), changeList);
        return 1;
      }
    }
    return 0;
  }

  // If an equal sign is present at index 1 and either 4 or 5 is of COLOR, then
  // 5 or 4 respectively is of OTHER_COLOR. The same goes for 3 and 0/1.
  //
  // Note that this "entangled" relationship is known at construction time.
  #checkEqualSignEntangledCells(changeList) {
    if (this.#equalSignEntanglements.length === 2) {
      const first = this.#equalSignEntanglements[0];
      const firstColor = this.#cellColors[first];
      const last = this.#equalSignEntanglements[1];
      const lastColor = this.#cellColors[last];
      if (firstColor === TangoLine.#EMPTY_COLOR
          && lastColor !== TangoLine.#EMPTY_COLOR) {
        this.#assignColor(first, this.#otherColor(lastColor), changeList);
        return 1;
      } else if (firstColor !== TangoLine.#EMPTY_COLOR
          && lastColor === TangoLine.#EMPTY_COLOR) {
        this.#assignColor(last, this.#otherColor(firstColor), changeList);
        return 1;
      }
    }
    return 0;
  }

  #assignColor(idx, color, changeList) {
    if (this.#cellColors[idx] !== TangoLine.#EMPTY_COLOR) {
      throw new Error("TangoLine " + this.#id + " attempted to assign "
          + this.#cellColors[idx] + " cell " + idx + " to " + color);
    }
    this.#cellColors[idx] = color;
    if (color === TangoLine.#YELLOW_COLOR) {
      changeList.push(idx);
      this.#yellowCount++;
    } else if (color === TangoLine.#BLUE_COLOR) {
      changeList.push(-(idx + 1));
      this.#blueCount++;
    } else {
      throw new Error("TangoLine " + this.#id + " attempted to clear "
          + this.#cellColors[idx] + " cell");
    }
    this.validate();
    return this.#yellowCount + this.#blueCount === TangoLine.#DIMENSION
        ? 2 : 1;
  }

  #otherColor(color) {
    return TangoLine.#COMPLEMENT_COLOR - color;
  }

  // TODO: Less obvious cases where we are destined to fail include:
  // - Two same color on border, one more same color touching border
  // - Cases involving x, = and some already present colors.
  // By knowing how to identify all such cases immediately, we can catch
  // potential failures early enough to lay the groundwork for Tango
  // experience with real-time feedback. But not knowing this immediately is
  // fine in the meantime; we'll just discover things later.
  validate() {
    // Validate color counts
    if (this.#yellowCount > 3) {
      throw new Error("Too many yellow: " + this.#cellColors
          + " (id=" + this.#id + ")");
    }
    if (this.#blueCount > 3) {
      throw new Error("Too many blue: " + this.#cellColors
          + " (id=" + this.#id + ")");
    }
    // Validate run lengths < 3
    for (let i = 0; i < this.#cellColors.length - 2; i++) {
      const color = this.#cellColors[i];
      if (color !== TangoLine.#EMPTY_COLOR
          && color === this.#cellColors[i + 1]
          && color === this.#cellColors[i + 2]) {
        throw new Error("Too many same-color consecutives: " + this.#cellColors
            + " (id=" + this.#id + ")");
      }
    }
    // Vaidate equalSigns
    for (const e of this.#equalSigns) {
      const before = this.#cellColors[e];
      const after = this.#cellColors[e + 1];
      if (before * after === 2) {
        throw new Error("Equal sign condition not upheld at index " + e
            + " (id=" + this.#id + ")");
      }
    }
    // Validate crosses
    for (const e of this.#crosses) {
      const before = this.#cellColors[e];
      const after = this.#cellColors[e + 1];
      if (before * after === 1 || before * after === 4) {
        throw new Error("Cross sign condition not upheld at index " + e
            + " (id=" + this.#id + ")");
      }
    }
  }

  // debug() {
  //   console.log('strategic:', JSON.stringify({
  //     cellColors: this.#cellColors,
  //     equalSigns: this.#equalSigns,
  //     crosses: this.#crosses
  //   }));
  // }

}

class TangoUtils{

  static learnMarkStrategy(cellDivs, doCellDivIsLocked,
    doCellDivIsBlank) {
    return new Promise(async (resolve, reject) => {
    // Prerequisite: at least one blank cell.
    let blankCell;
    try {
      blankCell = await TangoUtils.getBlankCell(cellDivs, doCellDivIsLocked,
        doCellDivIsBlank);
    } catch (e) {
      return reject(e);
    }

    // The strategy to return.
    let strategy = undefined;
    // Variables that will determine the strategy to return.
    let yellowTitle, blueTitle, yellowUrl, blueUrl;

    // Instantiate the strategy learner.
    const observer = new MutationObserver(observerCallback);
    // Timeout-based safeguard to prevent hanging if DOM mutations break.
    const timeoutRef = setTimeout(() => {
      observer.disconnect();
      console.error('Timed out learning strategy; fallback to default. Dump:',
          yellowTitle, blueTitle, yellowUrl, blueUrl);
      resolve(new TangoSvgTitleStrategy('Sun', 'Moon'));
    }, 10000);
    // The number of times observerCallback() has been invoked.
    let callCount = 0;
    observer.observe(blankCell, {
      attributes: true,
      attributeFilter: ['src'],
      subtree: true,
      childList: true
    });

    // Kickoff!
    TangoUtils.doOneMouseCycle(blankCell);

    function observerCallback(mutations, observer) {
      // Bound the number of times we click the div, even if we learned nothing.
      // 10 cycles should be plenty.
      if (++callCount >= 30) {
        console.error('Failed to learn strategy; fallback to default. Dump:',
            yellowTitle, blueTitle, yellowUrl, blueUrl);
        resolveStrategy(new TangoSvgTitleStrategy('Sun', 'Moon'));
        return;
      }
      if (strategy) {
        resolveStrategy(strategy);
        return;
      }
      for (const mutation of mutations) {
        if (mutation.type !== 'childList') {
          continue;
        }
        // Look for newly added IMG or SVG nodes.
        for (const node of mutation.addedNodes) {
          tryProcessNode(node);
          // Don't resolve yet! Notice how in tryProcessNode, we trigger another
          // mutation (via mouse) just before updating strategy. Ensure that
          // this mutation takes place prior to resolving by invoking resolve()
          // in the next callback iteration instead.
          if (strategy) {
            return;
          }
        }
      }

      function tryProcessNode(node) {
        if (node.nodeName === 'IMG') {
          const src = node.src;
          if (src) {
            if (!yellowUrl) {
              yellowUrl = src;
              // Hopefully trigger yellow -> blue.
              TangoUtils.doOneMouseCycle(blankCell);
            } else if (src !== yellowUrl) {
              blueUrl = src;
              // Hopefully trigger blue -> blank.
              TangoUtils.doOneMouseCycle(blankCell);
              strategy = new ImgSrcStrategy(yellowUrl, blueUrl);
            }
          }
        } else if (node.nodeType === Node.ELEMENT_NODE
            && node.namespaceURI === 'http://www.w3.org/2000/svg') {
          let title = node.querySelector('title')?.textContent;
          if (title) {
            title = title.toLowerCase();
            if (!yellowTitle) {
              yellowTitle = title;
              // Hopefully trigger yellow -> blue.
              TangoUtils.doOneMouseCycle(blankCell);
            } else if (title !== yellowTitle) {
              blueTitle = title;
              // Hopefully trigger blue -> blank.
              TangoUtils.doOneMouseCycle(blankCell);
              strategy = new TangoSvgTitleStrategy(yellowTitle, blueTitle);
            }
          }
        }
      }

      function resolveStrategy(strategy) {
        observer.disconnect();
        clearTimeout(timeoutRef);
        resolve(strategy);
      }
    }
  });

  }

  static solveTango(initialYellows, initialBlues, downEqualSigns,
      downCrosses, rightEqualSigns, rightCrosses) {
    return new TangoGrid(initialYellows, initialBlues, downEqualSigns,
          downCrosses, rightEqualSigns, rightCrosses)
        .solve();
  }

  static doOneMouseCycle(clickTarget) {
    const commonClickArgs = { bubbles: true, cancelable: true, view: window};
    clickTarget.dispatchEvent(new MouseEvent('mousedown', commonClickArgs));
    clickTarget.dispatchEvent(new MouseEvent('mouseup', commonClickArgs));
  }

  static getBlankCell(cellDivs, doCellDivIsLocked, doCellDivIsBlank) {
    return new Promise((resolve, reject) => {
      let blankableCellDiv;
      for (const cellDiv of cellDivs) {
        if (!doCellDivIsLocked.call(null, cellDiv)) {
          if (doCellDivIsBlank.call(null, cellDiv)) {
            return resolve(cellDiv);
          } else {
            blankableCellDiv = cellDiv;
            break;
          }
        }
      }
      if (!blankableCellDiv) {
        return reject(new Error('All cells locked, nothing is clickable'));
      }

      const observer = new MutationObserver(observerCallback);
      const timeoutRef = setTimeout(() => {
        observer.disconnect();
        reject(new Error('Timed out trying to clear cell'));
      }, 10000);
      let callCount = 0;
      observer.observe(blankableCellDiv, {
        attributes: true,
        attributeFilter: ['src'],
        subtree: true,
        childList: true
      });
      TangoUtils.doOneMouseCycle(blankableCellDiv);

      function observerCallback(mutations, observer) {
        if (++callCount >= 30) {
          clearTimeout(timeoutRef);
          observer.disconnect();
          return reject(new Error('Failed to clear cell after several clicks'));
        }
        for (const mutation of mutations) {
          if (doCellDivIsBlank.call(null, blankableCellDiv)) {
            clearTimeout(timeoutRef);
            observer.disconnect();
            return resolve(blankableCellDiv);
          }
        }
        TangoUtils.doOneMouseCycle(blankableCellDiv);
      }

    });
  }

  static doOneClick(clickTarget) {
    const commonClickArgs = { bubbles: true, cancelable: true, view: window};
    clickTarget.dispatchEvent(new MouseEvent('mousedown', commonClickArgs));
    clickTarget.dispatchEvent(new MouseEvent('mouseup', commonClickArgs));
    clickTarget.dispatchEvent(new MouseEvent('click', commonClickArgs));
  }
}

//---------------------sudoku-----------------------------------------------

class sudokuGameManager{

  autoSolveSudoku() {
    console.log("autoSolveSudoku function");
    const prioritizedApis = [new SudokuDomApiV0()];
    for (let i = 0; i < prioritizedApis.length; ) {
      console.log("loop index: ", i)
      const api = prioritizedApis[i];
      try {
        api.autoSolve();
        return;
      } catch (e) {
        console.error(e);
        if (++i !== prioritizedApis.length) {
          console.info('Will reattempt autoSolve() via a prior API');
        } else {
          console.error('All APIs exhausted');
        }
      }
  }
  }

}

class SudokuDomApi {

  autoSolve() {
    console.log("auto solve function-");
    const gameBoardDiv = this.getGameBoardDiv();
    const gridDiv = this.getSudokuGridDiv();
    const numberDivs = this.getNumberDivs();
    const [cellDivs, sudokuGrid] = this.transformSudokuGridDiv(gridDiv);
    const solution = sudokuGrid.solve();
    this.doSolve(gameBoardDiv, cellDivs, numberDivs, solution);
  }

  transformSudokuGridDiv(gridDiv) {
    const filtered = Array.from(gridDiv.children)
        .filter(c => this.gridDivChildIsCellDiv(c));
    if (filtered.length === 0) {
      this.orElseThrow(null, 'transformSudokuGridDiv', 'gridDiv contained no '
          + 'children that matched cellDiv filter');
    }
    const cellDivs = new Array(filtered.length);
    const sudokuGrid = new SudokuGrid(6, 3, 2);
    for (const cellDiv of filtered) {
      const idx = this.getCellDivIdx(cellDiv);
      cellDivs[idx] = cellDiv;
      const lockedContent = this.getLockedContent(cellDiv);
      if (lockedContent > 0) {
        sudokuGrid.mark(idx, lockedContent);
      }
    }
    return [cellDivs, sudokuGrid];
  }

  doSolve(gameBoardDiv, cellDivs, numberDivs, solution) {
    // First, attempt to grab the "Notes" on/off switch.
    let syncNotesDiv;
    try {
      syncNotesDiv = this.getNotesDiv();
    } catch (e) {
      // If it isn't present, retry after clearing any "Use a hint" popovers.
      const annoyingPopup = this.getAnnoyingPopupDiv();

      let timeoutRef;
      // Define the observer callback.
      const observerCallback = (mutations, observer) => {
        for (const mutation of mutations) {
          if (this.mutationCreatesNotesToggle(mutation)) {
            clearTimeout(timeoutRef);
            observer.disconnect();
            const notesDiv = this.getNotesDiv();
            this.disableNotes(notesDiv);
            this.#clickCells(cellDivs, numberDivs, solution);
            return;
          }
        }
      }
      // Bind callback to observer.
      const observer = new MutationObserver(observerCallback);
      timeoutRef = setTimeout(() => {
        observer.disconnect();
        console.error('Timed out awaiting Notes toggle mutation');
      }, 10000);
      observer.observe(gameBoardDiv, {
        attributes: true,
        attributeFilter: ['class'],
        subtree: true,
        childList: true
      });

      // Trigger potential mutations.
      this.clearAnnoyingPopup(annoyingPopup);
    }
    if (syncNotesDiv) {
      this.disableNotes(syncNotesDiv);
      this.#clickCells(cellDivs, numberDivs, solution);
    }
  }

  #clickCells(cellDivs, numberDivs, solution) {
    for (const packed of solution) {
      const idx = packed.idx;
      const val = packed.val;
      utils.doOneClick(cellDivs[idx]);
      utils.doOneClick(numberDivs[val - 1]);
    }
  }

}

class SudokuDomApiV0 extends SudokuDomApi {



  getGameBoardDiv() {
    console.log("getGameBoardDiv function--")
    return this.orElseThrow(
        getGridDiv(d => d.querySelector('.game-board.grid-board-wrapper')),
        'getGameBoardDiv', 'SudokuGameBoardDiv selector yielded nothing');
  }

  getSudokuGridDiv() {
    return this.orElseThrow(
        this.getGridDiv(d => d.querySelector('.grid-game-board')),
        'getSudokuGridDiv', 'SudokuGridDiv selector yielded nothing');
  }

  getRowsFromGridDiv(gridDiv) {
    const prop = this.orElseThrow(gridDiv.style?.getPropertyValue('--rows'),
        'getRowFromGridDiv', 'No --rows property found in style');
    const rows = parseInt(prop);
    return this.orElseThrow(Number.isNaN(rows) ? null : rows,
        'getRowFromGridDiv', `--rows property ${prop} is not a number`);
  }

  getColsFromGridDiv(gridDiv) {
    const prop = this.orElseThrow(gridDiv.style?.getPropertyValue('--cols'),
        'getColFromGridDiv', 'No --cols property found in style');
    const rows = parseInt(prop);
    return this.orElseThrow(Number.isNaN(rows) ? null : rows,
        'getColFromGridDiv', `--cols property ${prop} is not a number`);
  }

  gridDivChildIsCellDiv(childDiv) {
    return childDiv.attributes?.getNamedItem('data-cell-idx');
  }

  getCellDivIdx(cellDiv) {
    const dataCellIdx = cellDiv.attributes
        ?.getNamedItem('data-cell-idx')?.value;
    return parseInt(this.orElseThrow(dataCellIdx, 'getIdFromCellDiv',
        `Failed to parse an integer data cell ID from ${dataCellIdx}`));
  }

  getLockedContent(cellDiv) {
    if (this.cellDivIsLocked(cellDiv)) {
      const content = cellDiv.querySelector('.sudoku-cell-content');
      if (content && content.textContent) {
        const parsed = parseInt(content.textContent);
        return this.orElseThrow(Number.isNaN(parsed) ? null : parsed,
            'getLockedContent', `Expected number, found ${content.textContent}`);
      }
    }
    return -1;
  }

  cellDivIsLocked(cellDiv) {
    return cellDiv.classList.contains('sudoku-cell-prefilled');
  }

  getNumberDivs() {
    const wrapper = this.orElseThrow(
        getGridDiv(d => d.querySelector('.sudoku-input-buttons__numbers')),
        'getNumberDivs', 'SudokuNumberDiv selector yielded nothing');
    const result = new Array(6).fill(null);
    for (let i = 0; i < 6; i++) {
      const button = this.orElseThrow(wrapper.querySelector(`button[data-number="${i+1}"]`),
        'getNumberDivs', 'Numeric button selector yielded nothing for i=' + i);
      result[i] = button;
    }
    return result;
  }

  mutationCreatesNotesToggle(mutation) {
    return mutation.target.classList.contains('sudoku-under-board-controls-container');
  }

  getNotesDiv() {
    return this.orElseThrow(
        getGridDiv(d => d.querySelector('.sudoku-under-board-controls-container')),
        'getNotesDiv', 'NotesDiv selector yielded nothing');
  }

  disableNotes(notesDiv) {
    const activeSpan = this.orElseThrow(notesDiv.querySelector('span'),
        'disableNotes', 'NotesStatus selector yielded nothing');
    const text = activeSpan.textContent.trim().toLowerCase();
    this.orElseThrow(text, 'disableNotes', 'Could not determine Notes mode status');
    if ('on' === text) {
      const toggle = this.orElseThrow(notesDiv.querySelector('div[aria-label*="notes" i]'),
          'disableNotes', 'NotesToggle selector yielded nothing');
      doOneClick(toggle);
    }
  }

  getAnnoyingPopupDiv() {
    return this.orElseThrow(
        getGridDiv(d => d.querySelector('.sudoku-under-board-scrim-message')),
        'getAnnoyingPopupDiv', 'AnnoyingPopupDiv selector yielded nothing');
  }

  clearAnnoyingPopup(popupDiv) {
    const button = popupDiv.querySelector('button[aria-label*="close" i]');
    doOneClick(this.orElseThrow(button, 'clearAnnoyingPopup',
        'Could not extract hint popup close button'));
  }

  orElseThrow(result, fname, cause) {
    if (result != null) {
      return result;
    }
    throw new Error(`${fname} failed using SudokuDomApiV0: ${cause}`);
  }

  getGridDiv(extractFromDocument) {
    console.log("getGridDiv function--");
    console.log("Current URL:", window.location.href);
    console.log("Is in iframe:", window !== window.top);
    
    let gridDiv = extractFromDocument.call(null, document);//err

    if (gridDiv) {
      console.log("Found in current document");
      return gridDiv;
    }
    if (window === window.top) {
      const frame = document.querySelector('iframe');
      if (frame) {
        try {
          const frameDoc = frame.contentDocument || frame.contentWindow.document;
          gridDiv = extractFromDocument.call(null, frameDoc);
          if (gridDiv) {
            console.log("Found in iframe");
            return gridDiv;
          }
        } catch (e) {
          console.warn('Cannot access iframe (cross-origin):', e.message);
        }
      }
    }
    
    throw new Error('Could not extract div corresponding to grid');
    return gridDiv;
  } 

}

//------------------------pinpoint-------------------------------------------
class pinpointGameManager {

}

//----------------------------zip--------------------------------------------
class zipGameManager {
  async autoSolveZip(){
    const prioritizedApis = [new ZipDomApiV1(), new ZipDomApiV0()];
    for (let i = 0; i < prioritizedApis.length; ) {
      const api = prioritizedApis[i];
      try {
        api.autoSolve();
        return;
      } catch (e) {
        console.error(e);
        if (++i !== prioritizedApis.length) {
          console.info('Will reattempt autoSolve() via a prior API');
        } else {
          console.error('All APIs exhausted');
        }
      }
    }
  }
}

//----------------------------utils-----------------------------------------

//--------------------------------------------------------------------------

class debug{
  createDebugOverlay() {
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

}

class utils{

  static dispatchMouseEvents(element) {
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

  static doOneClick(clickTarget) {
    const commonClickArgs = { bubbles: true, cancelable: true, view: window};
    clickTarget.dispatchEvent(new MouseEvent('mousedown', commonClickArgs));
    clickTarget.dispatchEvent(new MouseEvent('mouseup', commonClickArgs));
    clickTarget.dispatchEvent(new MouseEvent('click', commonClickArgs));
  }

  

  static getBlankCell(cellDivs, doCellDivIsLocked, doCellDivIsBlank) {
    return new Promise((resolve, reject) => {
      let blankableCellDiv;
      for (const cellDiv of cellDivs) {
        if (!doCellDivIsLocked.call(null, cellDiv)) {
          if (doCellDivIsBlank.call(null, cellDiv)) {
            return resolve(cellDiv);
          } else {
            blankableCellDiv = cellDiv;
            break;
          }
        }
      }
      if (!blankableCellDiv) {
        return reject(new Error('All cells locked, nothing is clickable'));
      }

      const observer = new MutationObserver(observerCallback);
      const timeoutRef = setTimeout(() => {
        observer.disconnect();
        reject(new Error('Timed out trying to clear cell'));
      }, 10000);
      let callCount = 0;
      observer.observe(blankableCellDiv, {
        attributes: true,
        attributeFilter: ['src'],
        subtree: true,
        childList: true
      });
      utils.doOneMouseCycle(blankableCellDiv);

      function observerCallback(mutations, observer) {
        if (++callCount >= 30) {
          clearTimeout(timeoutRef);
          observer.disconnect();
          return reject(new Error('Failed to clear cell after several clicks'));
        }
        for (const mutation of mutations) {
          if (doCellDivIsBlank.call(null, blankableCellDiv)) {
            clearTimeout(timeoutRef);
            observer.disconnect();
            return resolve(blankableCellDiv);
          }
        }
        utils.doOneMouseCycle(blankableCellDiv);
      }

    });
  }


  static doOneMouseCycle(clickTarget) {
    const commonClickArgs = { bubbles: true, cancelable: true, view: window};
    clickTarget.dispatchEvent(new MouseEvent('mousedown', commonClickArgs));
    clickTarget.dispatchEvent(new MouseEvent('mouseup', commonClickArgs));
  }

  static doOneClick(clickTarget) {
    const commonClickArgs = { bubbles: true, cancelable: true, view: window};
    clickTarget.dispatchEvent(new MouseEvent('mousedown', commonClickArgs));
    clickTarget.dispatchEvent(new MouseEvent('mouseup', commonClickArgs));
    clickTarget.dispatchEvent(new MouseEvent('click', commonClickArgs));
  }

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

// Dispatch a sequence of mouse events from the content script (isolated world)
function dispatchMouseEvents(el) {
  if (!el) throw new Error('element not found');
  const types = ['mouseover', 'mousedown', 'mouseup', 'click'];
  for (const t of types) {
    const ev = new MouseEvent(t, { bubbles: true, cancelable: true, view: window });
    el.dispatchEvent(ev);
  }
}

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

class SudokuGrid {

  /** The row=column=region count of this grid. */
  #n;
  /** The number of cells in this grid. */
  #n2;
  /** The width of each of this grid's regions, in cells. */
  #regionWidth;
  /** The height of each of this grid's regions, in cells. */
  #regionHeight;
  /** The number of regions per in this grid. */
  #regionsPerRow;
  /** The number of regions per column in this grid. */
  #regionsPerCol;
  /** The numbers marked so far in this grid, with 0 indicating empty. */
  #values;
  /** The count of nonempty cells in grid. */
  #markCount;

  /** TODO: document how these work. */
  #rowMasks;
  #colMasks;
  #regMasks;

  constructor(n, regionWidth, regionHeight) {
    if (n < 0 || n > 31) {
      throw new Error('Invalid Sudoku dimension size ' + n);
    }
    this.#n = n;
    this.#n2 = n * n;

    if (n % regionWidth !== 0) {
      throw new Error('regionWidth ' + regionWidth + ' does not evenly divide dimension ' + n);
    }
    this.#regionWidth = regionWidth;
    this.#regionsPerCol = n / regionWidth;

    if (n % regionHeight !== 0) {
      throw new Error('regionHeight ' + regionHeight + ' does not evenly divide dimension ' + n);
    }
    this.#regionHeight = regionHeight;
    this.#regionsPerRow = n / regionHeight;

    if (this.#regionsPerRow * this.#regionsPerCol !== n) {
      throw new Error('Region count must be ' + n + ', provided ' + (this.#regionsPerRow * this.#regionsPerCol));
    }
    this.#values = new Array(this.#n2).fill(0);
    this.#markCount = 0;
    this.#rowMasks = new Array(this.#n).fill(0);
    this.#colMasks = new Array(this.#n).fill(0);
    this.#regMasks = new Array(this.#n).fill(0);
  }

  solve() {
    const result = [];
    if (this.#markCount === this.#n2) {
      return result;
    }
    const sequence = this.#getAttemptSequence();
    const maxDepth = this.#n2 - this.#markCount;
    if (this.#backtrack(maxDepth, 0, sequence, result)) {
      return result;
    } else {
      throw new Error("No solutions found");
    }
  }

  #getAttemptSequence() {
    return Array.from({ length: this.#n2 },
            (_, i) => [i, this.#getPossibleMarkCount(i)])
        .filter(([_, fanout]) => fanout !== 0)
        .sort((a, b) => a[1] - b[1]);
  }

  #getPossibleMarkCount(idx) {
    if (this.#values[idx] !== 0) {
      return 0;
    }
    const col = idx % this.#n;
    const row = (idx - col) / this.#n;
    const reg = this.#getRegionForRowCol(row, col);
    let mask = (this.#colMasks[col] | this.#rowMasks[row] | this.#regMasks[reg]);
    let count = 0;
    while (mask !== 0) {
      mask &= mask - 1;
      count++;
    }
    return this.#n - count;
  }

  #backtrack(maxDepth, curDepth, sequence, result) {
    if (curDepth === maxDepth) {
      return true;
    }
    const [idx, _] = sequence[curDepth];
    const col = idx % this.#n;
    const row = (idx - col) / this.#n;
    const reg = this.#getRegionForRowCol(row, col);
    let mask = (this.#colMasks[col] | this.#rowMasks[row] | this.#regMasks[reg]);
    let pos = 0;
    while (pos < this.#n) {
      if ((mask & 1) === 0) {
        const val = pos + 1;
        const filter = 1 << pos;
        this.#doMark(idx, col, row, reg, val, filter);
        result.push({idx: idx, val: val});
        const shortCircuit = this.#backtrack(maxDepth, curDepth + 1, sequence, result);
        this.unmark(idx);
        if (shortCircuit) {
          return true;
        } else {
          result.pop();
        }
      }
      mask = (mask >> 1);
      pos++;
    }
    return false;
  }

  getMark(idx) {
    this.#validateIdx(idx);
    return this.#values[idx];
  }

  mark(idx, val) {
    this.#validateIdx(idx, val);
    if (val < 1 || val > this.#n) {
      throw new Error('Invalid val ' + val);
    }
    if (this.#values[idx] !== 0) {
      throw new Error("Can't mark already-marked cell at idx " + idx);
    }
    this.#tryMark(idx, val);
  }

  unmark(idx) {
    this.#validateIdx(idx);
    const val = this.#values[idx];
    if (val !== 0) {
      const filter = 1 << (val - 1);
      const col = idx % this.#n;
      this.#colMasks[col] ^= filter;
      const row = (idx - col) / this.#n;
      this.#rowMasks[row] ^= filter;
      const reg = this.#getRegionForRowCol(row, col);
      this.#regMasks[reg] ^= filter;
      this.#values[idx] = 0;
      this.#markCount--;
      return true;
    } else {
      return false;
    }
  }

  #validateIdx(idx) {
    if (idx < 0 || idx >= this.#n2) {
      throw new Error('Invalid idx ' + idx);
    }
  }

  #tryMark(idx, val) {
    const filter = 1 << (val - 1);
    const col = idx % this.#n;
    if ((this.#colMasks[col] & filter) !== 0) {
      throw new Error('Value ' + val + ' already present in col ' + col);
    }
    const row = (idx - col) / this.#n;
    if ((this.#rowMasks[row] & filter) !== 0) {
      throw new Error('Value ' + val + ' already present in row ' + row);
    }
    const reg = this.#getRegionForRowCol(row, col);
    if ((this.#regMasks[reg] & filter) !== 0) {
      throw new Error('Value ' + val + ' already present in region ' + reg);
    }
    this.#doMark(idx, col, row, reg, val, filter);
  }

  #doMark(idx, col, row, reg, val, filter) {
    this.#values[idx] = val;
    this.#colMasks[col] |= filter;
    this.#rowMasks[row] |= filter;
    this.#regMasks[reg] |= filter;
    this.#markCount++;
  }

  #getRegionForRowCol(row, col) {
    const regionRow = Math.floor(row / this.#regionHeight);
    const regionCol = Math.floor(col / this.#regionWidth);
    return regionRow * this.#regionsPerRow + regionCol;
  }
  
}

class ZipGrid {

  /** The number of rows in this grid. */
  #m;
  /** The number of columns in this grid. */
  #n;
  /** The number of elements in this grid. */
  #size;
  /** The index of the starting square. */
  #head;
  /** The index of the terminal square. */
  #foot;
  /** The current marked number that we have reached. */
  #current;
  /** The explored path so far. */
  #path;
  /** The number of moves made so far. */
  #visitedCells;
  /** Bookkeeping stack of degree changes, used by a pruning strategy. */
  #degreeModifications;

  /**
   * Stores the following for each cell:
   * 0. Whether it is visited
   * 1. The circled number that it includes if present, otherwise -1
   * 2. (Used by a pruning strategy) If this cell is unvisited, then the number
   *    of unvisited neighbors that are not wall-blocked; otherwise, undefined
   *    behavior
   * 3. Whether its right neighbor is blocked by a wall
   * 4. Whether its down neighbor is blocked by a wall.
   */
  #cellStatuses;

  constructor(m, n, numberedCells, downWalls, rightWalls) {
    this.#m = m;
    this.#n = n;
    this.#size = m * n;
    this.#head = numberedCells[0];
    this.#foot = numberedCells[numberedCells.length - 1];
    this.#current = 1;

    this.#path = new Array(this.#size).fill(-1);
    this.#path[0] = this.#head;
    this.#visitedCells = 1;
    this.#degreeModifications = Array.from({length: this.#size - 1},
      () => []);

    this.#constructCellStatuses(m, n, this.#size,
        numberedCells, downWalls, rightWalls);
    this.#setVisited(this.#head, true);
  }

  #constructCellStatuses(m, n, size, numberedCells, downWalls, rightWalls) {
    if (numberedCells.length > (1 << 25) - 1) {
      throw new Error("Too many numbered cells: " + this.numberedCells.length);
    }
    this.#cellStatuses = new Array(size).fill(4 << 0x1);
    // Decrement top and bottom border degrees once
    for (let i = 0; i < n; i++) {
      this.#decrementDegree(i);
      this.#decrementDegree(size - n + i);
    }
    // Decrement left and right border degrees once (thus each corner twice)
    for (let i = 0; i < m; i++) {
      this.#decrementDegree(n * i);
      this.#decrementDegree(n * i + n - 1);
    }
    // Down walls
    for (const walledCell of downWalls) {
      this.#addDownWall(walledCell);
      this.#decrementDegree(walledCell);
      if (walledCell < size - n) {
        this.#decrementDegree(walledCell + n);
      }
    }
    // Right walls
    for (const walledCell of rightWalls) {
      this.#addRightWall(walledCell);
      this.#decrementDegree(walledCell);
      if (walledCell % n !== n - 1) {
        this.#decrementDegree(walledCell + 1);
      }
    }
    // Numbered cells
    for (let i = 0; i < numberedCells.length; i++) {
      this.#label(numberedCells[i], i + 1);
    }
  }

  /**
   * Returns some sequence (in official puzzles, the the only sequence) in which
   * grid cells may be visited to solve the puzzle.
   */
  solve() {
    let callStack = [];
    let path;
    this.#stackPushValidMoves(callStack, this.#head);
    while (callStack.length !== 0) {
      const [from, to, doVisit] = callStack.pop();
      while (this.lastMove() !== from) {
        this.unvisit();
      }
      doVisit.call(this, to, from);
      if (this.#visitedCells === this.#size) {
        path = [...this.#path];
        break;
      }
      this.#stackPushValidMoves(callStack, to);
    }
    // Clean up grid state prior to leaving this function.
    while (this.#visitedCells > 1) {
      this.unvisit();
    }
    if (!path) {
      throw new Error("No solutions found");
    }
    return path;
  }

  #stackPushValidMoves(stack, from) {
    if (this.canVisitRight()) {
      stack.push([from, from + 1, this.#doVisitRight]);
    }
    if (this.canVisitLeft()) {
      stack.push([from, from - 1, this.#doVisitLeft]);
    }
    if (this.canVisitDown()) {
      stack.push([from, from + this.#n, this.#doVisitDown]);
    }
    if (this.canVisitUp()) {
      stack.push([from, from - this.#n, this.#doVisitUp]);
    }
  }

  /**
   * Returns whether it is possible to extend the current path to move up once.
   *
   * This method checks whether (let "src" be the last visited cell in #path):
   *
   * - The "above cell" (hereafter "dst") exists in this grid
   * - dst has already been visited
   * - There is a wall between src and dst
   * - dst contains a circled number that we cannot reach yet
   * - Visiting dst would "cut off" any unvisited non-terminal cells by leaving
   *   only 1 unvisited cell attached to them, and similarly for the terminal
   *   cell except the check condition is 0 not 1.
   *
   * The last of these is only relevant for pruning purposes. The backtracking
   * algorithm works completely fine without it, and official puzzles are small
   * enough that there is no noticeable performance benefit to its inclusion. We
   * keep around for academic purposes, and it's simple enough (albeit verbose).
   *
   * For extremely large puzzles, however, the pruning strategy is invaluable--
   * and likely to even be insufficient. Consider an in-progress path that began
   * by going up 5 cells, then right 5 cells, then down 3, then left until it
   * reencountered the upward leg. Assuming that this all happens far away from
   * any grid boundaries, none of these cells will have degree 0/1 whether we go
   * up or down, but going up or down at this point makes the other direction's
   * cells unreachable.
   *
   * Recognizing such isues requires global awareness whereas our simple degree
   * strategy counting is inherently local. Maintaining global state effectively
   * is complicated to reason about and implement; the bookkeeping required for
   * achieving this could well even have *negative* impact for small puzzles. It
   * has been left out for now, but we are open to reconsidering.
   */
  canVisitUp() {
    return this.#canVisitDirection(s => s - this.#n,
        (d, s) => d >= 0,
        (ds, ss) => this.maskHasDownWall(ds),
        [this.#visitIsolatesDown, this.#visitIsolatesLeft,
            this.#visitIsolatesRight]);
  }

  /** Same as #canVisitUp, but for moving down. */
  canVisitDown() {
    return this.#canVisitDirection(s => s + this.#n,
        (d, s) => d < this.#size,
        (ds, ss) => this.maskHasDownWall(ss),
        [this.#visitIsolatesUp, this.#visitIsolatesLeft,
            this.#visitIsolatesRight]);
  }

  /** Same as #canVisitUp, but for moving left. */
  canVisitLeft() {
    return this.#canVisitDirection(s => s - 1,
        (d, s) => s % this.#n !== 0,
        (ds, ss) => this.maskHasRightWall(ds),
        [this.#visitIsolatesUp, this.#visitIsolatesDown,
            this.#visitIsolatesRight]);
  }

  /** Same as #canVisitUp, but for moving right. */
  canVisitRight() {
    return this.#canVisitDirection(s => s + 1,
        (d, s) => s % this.#n !== this.#n - 1,
        (ds, ss) => this.maskHasRightWall(ss),
        [this.#visitIsolatesUp, this.#visitIsolatesDown,
            this.#visitIsolatesLeft]);
  }

  #canVisitDirection(computeDst, checkDstSrcBounds, checkDstSrcWall,
      willIsolateFns) {
    const src = this.lastMove();
    const dst = computeDst.call(this, src);
    const dstStatus = this.#cellStatuses[dst];
    const srcStatus = this.#cellStatuses[src];
    let withoutIsolation = checkDstSrcBounds.call(this, dst, src)
        && !this.maskIsVisited(dstStatus)
        && !checkDstSrcWall.call(this, dstStatus, srcStatus)
        && !(this.getMaskLabel(dstStatus) > this.#current + 1);
    if (!withoutIsolation) {
      return false;
    }
    for (const willIsolateFn of willIsolateFns) {
      if (willIsolateFn.call(this, src)) {
        return false;
      }
    }
    return true;
  }

  #visitIsolatesUp(src) {
    return this.#visitIsolates(this.#visitImpactsUpDegree(src));
  }

  #visitIsolatesDown(src) {
    return this.#visitIsolates(this.#visitImpactsDownDegree(src));
  }

  #visitIsolatesLeft(src) {
    return this.#visitIsolates(this.#visitImpactsLeftDegree(src));
  }

  #visitIsolatesRight(src) {
    return this.#visitIsolates(this.#visitImpactsRightDegree(src));
  }

  #visitIsolates(cell) {
    if (cell < 0) {
      return false;
    }
    const degree = this.#getDegree(cell);
    return (cell === this.#foot && degree === 1)
        || (cell !== this.#foot && degree === 2);
  }

  visitUp() {
    if (this.canVisitUp()) {
      const lastMove = this.lastMove();
      this.#doVisitUp(lastMove - this.#n, lastMove);
      return true;
    }
    return false;
  }

  #doVisitUp(dst, src) {
    this.#visitDirection(dst, src, [this.#visitImpactsDownDegree,
        this.#visitImpactsLeftDegree, this.#visitImpactsRightDegree]);
  }

  visitDown() {
    if (this.canVisitDown()) {
      const lastMove = this.lastMove();
      this.#doVisitDown(lastMove + this.#n, lastMove);
      return true;
    }
    return false;
  }

  #doVisitDown(dst, src) {
    this.#visitDirection(dst, src, [this.#visitImpactsUpDegree,
        this.#visitImpactsLeftDegree, this.#visitImpactsRightDegree]);
  }

  visitLeft() {
    if (this.canVisitLeft()) {
      const lastMove = this.lastMove();
      this.#doVisitLeft(lastMove - 1, lastMove);
      return true;
    }
    return false;
  }

  #doVisitLeft(dst, src) {
    this.#visitDirection(dst, src, [this.#visitImpactsUpDegree,
        this.#visitImpactsDownDegree, this.#visitImpactsRightDegree]);
  }

  visitRight() {
    if (this.canVisitRight()) {
      const lastMove = this.lastMove();
      this.#doVisitRight(lastMove + 1, lastMove);
      return true;
    }
    return false;
  }

  #doVisitRight(dst, src) {
    this.#visitDirection(dst, src,[this.#visitImpactsUpDegree,
        this.#visitImpactsDownDegree, this.#visitImpactsLeftDegree]);
  }

  #visitDirection(dst, src, impactFns) {
    // Mark cell as visited.
    this.#setVisited(dst, true);
    // If dst is a circled number, update bookkeeping.
    const dstContent = this.#getLabel(dst);
    if (dstContent > 0) {
      this.#current = dstContent; 
    }
    // Modify degrees as needed.
    const newModifications = this.#degreeModifications[this.#visitedCells - 1];
    for (const impactFn of impactFns) {
      const cell = impactFn.call(this, src);
      if (cell >= 0) {
        this.#decrementDegree(cell);
        newModifications.push(cell);
      }
    }
    // Update path, visitedCells
    this.#path[this.#visitedCells++] = dst;
  }

  #visitImpactsUpDegree(src) {
    if (src >= this.#n) {
      const up = src - this.#n;
      const upStatus = this.#cellStatuses[up];
      if (!this.maskIsVisited(upStatus) && !this.maskHasDownWall(upStatus)) {
        return up;
      }
    }
    return -1;
  }

  #visitImpactsDownDegree(src) {
    if (src < this.#size - this.#n) {
      const down = src + this.#n;
      if (!this.#isVisited(down) && !this.#hasDownWall(src)) {
        return down;
      }
    }
    return -1;
  }

  #visitImpactsLeftDegree(src) {
    if (src % this.#n !== 0) {
      const left = src - 1;
      const leftStatus = this.#cellStatuses[left];
      if (!this.maskIsVisited(leftStatus)
          && !this.maskHasRightWall(leftStatus)) {
        return left;
      }
    }
    return -1;
  }

  #visitImpactsRightDegree(src) {
    if (src % this.#n !== this.#n - 1) {
      const right = src + 1;
      if (!this.#isVisited(right) && !this.#hasRightWall(src)) {
        return right;
      }
    }
    return -1;
  }

  unvisit() {
    if (this.#visitedCells == 1) {
      return false;
    }
    const lastMove = this.lastMove();
    // Remove last move from path and update visitedCells value.
    this.#path[(this.#visitedCells--) - 1] = -1;
    // Possibly revert degree modifications.
    const modifications = this.#degreeModifications[this.#visitedCells - 1];
    while (modifications.length !== 0) {
      this.#incrementDegree(modifications.pop());
    }
    // Possibly revert last-found circled number, 
    const lastMoveLabel = this.#getLabel(lastMove);
    if (lastMoveLabel > 0) {
      this.#current = lastMoveLabel - 1;
    }
    // Mark cell as unvisited.
    this.#setVisited(lastMove, false);
    return true;
  }

  lastMove() {
    return this.#path[this.#visitedCells - 1];
  }

  // All methods below bitfield operations that could be extracted into a new
  // class, but JS doesn't have low-cost abstractions. :(

  // Bit 0.
  #isVisited(cell) {
    return this.maskIsVisited(this.#cellStatuses[cell]);
  }

  maskIsVisited(mask) {
    return (mask & 1) === 1;
  }

  #setVisited(cell, visited) {
    if (visited) {
      this.#cellStatuses[cell] |= 0x1;
    } else {
      this.#cellStatuses[cell] &= ~0x1;
    }
  }

  // Bits 1-3.
  #getDegree(cell) {
    return this.getMaskDegree(this.#cellStatuses[cell]);
  }

  getMaskDegree(mask) {
    return (mask & 0xE) >>> 1;
  }

  #decrementDegree(cell) {
    this.#cellStatuses[cell] -= 0x2;
  }

  #incrementDegree(cell) {
    this.#cellStatuses[cell] += 0x2;
  }

  // Bit 4.
  #hasDownWall(cell) {
    return this.maskHasDownWall(this.#cellStatuses[cell]);
  }

  maskHasDownWall(mask) {
    return (mask & 0x10) !== 0;
  }

  #addDownWall(cell) {
    this.#cellStatuses[cell] |= 0x10;
  }

  // Bit 5.
  #hasRightWall(cell) {
    return this.maskHasRightWall(this.#cellStatuses[cell]);
  }

  maskHasRightWall(mask) {
    return (mask & 0x20) !== 0;
  }

  #addRightWall(cell) {
    this.#cellStatuses[cell] |= 0x20;
  }

  // Bits 6-30 (avoid 31 due to negative number annoyances).
  #getLabel(cell) {
    return this.getMaskLabel(this.#cellStatuses[cell]);
  }

  getMaskLabel(mask) {
    return mask >>> 6;
  }

  #label(cell, number) {
    this.#cellStatuses[cell] |= (number << 6);
  }

}

class solveZip{
  static compressSequence(sequence) {
    const result = [];
    if (sequence.length === 0) {
      return result;
    }
    result.push(sequence[0]);
    let i = 1;
    while (i < sequence.length) {
      const runStart = i - 1;
      let diff = sequence[i] - sequence[runStart];
      // Seek i to the last element where sequence[i] - sequence[i-1] === diff.
      while (i + 1 < sequence.length && sequence[i + 1] - sequence[i] === diff) {
        i++;
      }
      result.push(sequence[i]);
      i++;
    }
    return result;
  }


  static solve(m, n, numberedCells, downWalls, rightWalls) {
    const zipGrid = new ZipGrid(m, n, numberedCells, downWalls, rightWalls);
    const sequence = zipGrid.solve();
    return this.compressSequence(sequence);
  }

}

class ZipDomApi {

  autoSolve() {
    const gridDiv = this.getZipGridDiv();
    const [cellDivs, zipGridArgs] = this.transformZipGridDiv(gridDiv);
    const clickSequence = solveZip.solve(...zipGridArgs);
    this.clickCells(cellDivs, clickSequence);
  }

  transformZipGridDiv(gridDiv) {
    const rows = this.getRowsFromGridDiv(gridDiv);
    const cols = this.getColsFromGridDiv(gridDiv);
    const filtered = Array.from(gridDiv.children)
        .filter(c => this.gridDivChildIsCellDiv(c));
    if (filtered.length === 0) {
      this.orElseThrow(null, 'transformZipGridDiv', 'gridDiv contained no '
          + 'children that matched cellDiv filter');
    }
    const cellDivs = new Array(filtered.length);
    const numberedCells = [], downWalls = [], rightWalls = [];
    for (const cellDiv of filtered) {
      const idx = this.getCellDivIdx(cellDiv);
      cellDivs[idx] = cellDiv;
      const content = this.getCellDivContent(cellDiv);
      if (content > 0) {
        numberedCells[content - 1] = idx;
      }
      if (this.cellDivHasDownWall(cellDiv)) {
        downWalls.push(idx);
      }
      if (this.cellDivHasRightWall(cellDiv)) {
        rightWalls.push(idx);
      }
    }
    return [cellDivs, [rows, cols, numberedCells, downWalls, rightWalls]];
  }

  // Synchronously dispatches the computed click events one by one. In-progress
  // puzzles are automatically reset by the click sequence unlike with the other
  // games, so there's no extra check to do here.
  clickCells(clickTargets, cellSequence) {
    for (const loc of cellSequence) {
      const clickTarget = clickTargets[loc];
      utils.doOneMouseCycle(clickTarget);
    }
  }

}

class ZipDomApiV0 extends ZipDomApi {

  getZipGridDiv() {
    return this.orElseThrow(
        getGridDiv(d => d.querySelector(".grid-game-board")),
        'getZipGridDiv', 'ZipGridDiv selector yielded nothing');
  }

  getRowsFromGridDiv(gridDiv) {
    const prop = this.orElseThrow(gridDiv.style?.getPropertyValue('--rows'),
        'getRowFromGridDiv', 'No --rows property found in style');
    const rows = parseInt(prop);
    return this.orElseThrow(Number.isNaN(rows) ? null : rows,
        'getRowFromGridDiv', `--rows property ${prop} is not a number`);
  }

  getColsFromGridDiv(gridDiv) {
    const prop = this.orElseThrow(gridDiv.style?.getPropertyValue('--cols'),
        'getColFromGridDiv', 'No --cols property found in style');
    const rows = parseInt(prop);
    return this.orElseThrow(Number.isNaN(rows) ? null : rows,
        'getColFromGridDiv', `--cols property ${prop} is not a number`);
  }

  gridDivChildIsCellDiv(gridDivChild) {
    return gridDivChild.attributes?.getNamedItem('data-cell-idx');
  }

  getCellDivIdx(cellDiv) {
    const dataCellIdx = cellDiv.attributes
        ?.getNamedItem('data-cell-idx')?.value;
    return parseInt(this.orElseThrow(dataCellIdx, 'getIdFromCellDiv',
        `Failed to parse an integer data cell ID from ${dataCellIdx}`));
  }

  getCellDivContent(cellDiv) {
    const content = cellDiv.querySelector('.trail-cell-content');
    if (content && content.textContent) {
      const parsed = parseInt(content.textContent);
      return this.orElseThrow(Number.isNaN(parsed) ? null : parsed,
          'getCellDivContent', `Expected number, found ${content.textContent}`);
    }
    return -1;
  }

  cellDivHasDownWall(cellDiv) {
    return cellDiv.querySelector('.trail-cell-wall--down') != null;
  }

  cellDivHasRightWall(cellDiv) {
    return cellDiv.querySelector('.trail-cell-wall--right') != null;
  }

  orElseThrow(result, fname, cause) {
    if (result != null) {
      return result;
    }
    throw new Error(`${fname} failed using ZipDomApiV0: ${cause}`);
  }

}

class ZipDomApiV1 extends ZipDomApi {

  autoSolve() {
    const cellSequence = solveZip.compressSequence(this.getSolution());
    const gridDiv = this.getZipGridDiv();
    const cellDivs = this.transformZipGridDiv(gridDiv)[0];
    this.clickCellsWithFeedback(cellDivs, cellSequence);
  }

  getSolution() {
      const hydrationScript = this.orElseThrow(
          getGridDiv(d => d.getElementById('rehydrate-data')), // trail-board
          'getSolution',
          'No script with id rehydrate-data found'
      );
      
      const scriptContent = hydrationScript.textContent;
      const indicator = '\\"solution\\"';
      const anchor = scriptContent.indexOf(indicator);
      
      if (anchor < 0) {
          this.orElseThrow(null, 'getSolution', 'Failed to locate indicator');
      }
      
      const start = scriptContent.indexOf('[', anchor + indicator.length);
      const end = scriptContent.indexOf(']', start);
      
      return JSON.parse(scriptContent.substring(start, end + 1));
  }

  getZipGridDiv() {
    return this.orElseThrow(
        getGridDiv(d => d.querySelector('[data-testid="interactive-grid"]')),
        'getZipGridDiv', 'ZipGridDiv selector yielded nothing');
  }

  getRowsFromGridDiv(gridDiv) {
    return this.getColsFromGridDiv(gridDiv);
  }

  getColsFromGridDiv(gridDiv) {
    const candidates = Object.fromEntries(
      Array.from(gridDiv.style)
        .filter(p => p.startsWith("--") && /^\d+$/.test(gridDiv.style.getPropertyValue(p).trim()))
        .map(p => [p, parseInt(gridDiv.style.getPropertyValue(p))])
    );
    const candidateCount = Object.keys(candidates).length;
    if (candidateCount === 0) {
      orElseThrow(null, 'getDimensionFromGridDiv', 'No appropriate dimension in gridDiv');
    } else if (candidateCount > 1) {
      console.warn('Multiple dimension candidates found in style; dump:', candidates);
    }
    const elem = candidates[Object.keys(candidates)[0]];
    return parseInt(elem);
  }

  gridDivChildIsCellDiv(gridDivChild) {
    return gridDivChild.attributes?.getNamedItem('data-cell-idx');
  }

  getCellDivIdx(cellDiv) {
    const dataCellIdx = cellDiv.attributes
        ?.getNamedItem('data-cell-idx')?.value;
    return parseInt(this.orElseThrow(dataCellIdx, 'getIdFromCellDiv',
        `Failed to parse an integer data cell ID from ${dataCellIdx}`));
  }

  getCellDivContent(cellDiv) {
    const subCellDiv = cellDiv.querySelector('[data-cell-content="true"]');
    if (subCellDiv) {
      const parsed = parseInt(subCellDiv.textContent);
      return this.orElseThrow(Number.isNaN(parsed) ? null : parsed,
          'getCellDivContent', `Expected number, found ${subCellDiv.textContent}`);
    }
    return -1;
  }

  // TODO: refactor (unused in V1)
  cellDivHasDownWall(cellDiv) {
    return false;
  }

  // TODO: refactor (unused in V1)
  cellDivHasRightWall(cellDiv) {
    return false;
  }

  orElseThrow(result, fname, cause) {
    if (result != null) {
      return result;
    }
    throw new Error(`${fname} failed using ZipDomApiV1: ${cause}`);
  }

  // Dispatching clicks blindly is inconsistent in dom V1.
  async clickCellsWithFeedback(cellDivs, clickSequence) {
    for (const loc of clickSequence) {
      await anticipateOneMutation(cellDivs[loc], loc);
    }

    function anticipateOneMutation(cellDiv, loc) {
      return new Promise((resolve, reject) => {
        // Timeout-based cleanup (in case no mutations are observed)
        let timeoutRef = setTimeout(() => {
          observer.disconnect();
          console.error('Timed out anticipating mutation on', cellDiv);
          return reject(new Error('Timed out trying to clear cell ' + loc));
        }, 10000);
        // Clean up (including aforementioned timeout) if mutation is observed
        const observer = new MutationObserver(() => {
          clearTimeout(timeoutRef);
          observer.disconnect();
          return resolve();
        });
        // Register the observer
        observer.observe(cellDiv, { attributes: true, childList: true, subtree: true });
        // Kickoff!
        utils.doOneMouseCycle(cellDiv);
      });
    }
  }

}

function getGridDiv(extractFromDocument) {
  console.log("getGridDiv function--");
  console.log("Current URL:", window.location.href);
  console.log("Is in iframe:", window !== window.top);
  
  let gridDiv = extractFromDocument.call(null, document);//err

  if (gridDiv) {
    console.log("Found in current document");
    return gridDiv;
  }
  if (window === window.top) {
    const frame = document.querySelector('iframe');
    if (frame) {
      try {
        const frameDoc = frame.contentDocument || frame.contentWindow.document;
        gridDiv = extractFromDocument.call(null, frameDoc);
        if (gridDiv) {
          console.log("Found in iframe");
          return gridDiv;
        }
      } catch (e) {
        console.warn('Cannot access iframe (cross-origin):', e.message);
        // This is expected for cross-origin iframes
        // The content script running IN the iframe will handle it
      }
    }
  }
  
  throw new Error('Could not extract div corresponding to grid');
  // if (!gridDiv) {
  //   const frame = document.querySelector('iframe');
  //   const frameDoc = frame.contentDocument || frame.contentWindow.document;
  //   gridDiv = extractFromDocument.call(null, frameDoc);
  //   if (!gridDiv) {
  //     throw new Error('Could not extract div corresponding to grid');
  //   }
  // }
  return gridDiv;
} 