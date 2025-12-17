/**
 * Sudoku Game - Complete Implementation
 * Features: Generation, Solving, Hints, Undo/Redo, Notes, Save/Load
 */

// ========================================
// Game State Management
// ========================================

const GameState = {
    board: [],              // Current board state (9x9 array)
    solution: [],           // Complete solution
    initial: [],            // Initial puzzle (prefilled cells)
    notes: [],              // Notes for each cell (9x9 array of Sets)
    selected: null,         // Currently selected cell {row, col}
    difficulty: 'medium',   // Current difficulty
    hintsRemaining: 3,      // Hints left
    isNotesMode: false,     // Notes mode toggle
    isPaused: false,        // Game paused state
    isComplete: false,      // Game completion state
    showErrors: true,       // Error highlighting toggle
    history: [],            // Undo history
    historyIndex: -1,       // Current position in history
    timer: {
        seconds: 0,
        interval: null,
        isRunning: false
    }
};

// Difficulty settings (number of clues to keep)
const DIFFICULTY_CLUES = {
    easy: { min: 40, max: 45 },
    medium: { min: 30, max: 39 },
    hard: { min: 25, max: 29 }
};

// ========================================
// DOM Elements
// ========================================

const DOM = {
    board: document.getElementById('board'),
    timer: document.getElementById('timer'),
    hintsLeft: document.getElementById('hints-left'),
    message: document.getElementById('message'),
    difficulty: document.getElementById('difficulty'),
    pauseOverlay: document.getElementById('pause-overlay'),
    winModal: document.getElementById('win-modal'),
    solveModal: document.getElementById('solve-modal'),
    finalTime: document.getElementById('final-time'),
    finalDifficulty: document.getElementById('final-difficulty')
};

// ========================================
// Sudoku Generation Algorithm
// ========================================

/**
 * Creates an empty 9x9 grid
 */
function createEmptyGrid() {
    return Array(9).fill(null).map(() => Array(9).fill(0));
}

/**
 * Checks if placing a number at position is valid
 */
function isValidPlacement(grid, row, col, num) {
    // Check row
    for (let c = 0; c < 9; c++) {
        if (grid[row][c] === num) return false;
    }

    // Check column
    for (let r = 0; r < 9; r++) {
        if (grid[r][col] === num) return false;
    }

    // Check 3x3 box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) {
            if (grid[r][c] === num) return false;
        }
    }

    return true;
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Generates a complete valid Sudoku solution using backtracking
 */
function generateSolution(grid, row = 0, col = 0) {
    // Move to next row if we've filled the current row
    if (col === 9) {
        row++;
        col = 0;
    }

    // If we've filled all rows, we're done
    if (row === 9) return true;

    // If cell is already filled, move to next
    if (grid[row][col] !== 0) {
        return generateSolution(grid, row, col + 1);
    }

    // Try numbers 1-9 in random order for variety
    const numbers = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    for (const num of numbers) {
        if (isValidPlacement(grid, row, col, num)) {
            grid[row][col] = num;

            if (generateSolution(grid, row, col + 1)) {
                return true;
            }

            grid[row][col] = 0;
        }
    }

    return false;
}

/**
 * Counts the number of solutions for a puzzle (stops at 2)
 */
function countSolutions(grid, count = { value: 0 }) {
    // Find first empty cell
    let emptyCell = null;
    for (let r = 0; r < 9 && !emptyCell; r++) {
        for (let c = 0; c < 9 && !emptyCell; c++) {
            if (grid[r][c] === 0) {
                emptyCell = { row: r, col: c };
            }
        }
    }

    // No empty cells means we found a solution
    if (!emptyCell) {
        count.value++;
        return count.value;
    }

    const { row, col } = emptyCell;

    for (let num = 1; num <= 9; num++) {
        if (isValidPlacement(grid, row, col, num)) {
            grid[row][col] = num;

            countSolutions(grid, count);

            // Stop early if we found more than one solution
            if (count.value > 1) {
                grid[row][col] = 0;
                return count.value;
            }

            grid[row][col] = 0;
        }
    }

    return count.value;
}

/**
 * Creates a puzzle by removing numbers from a complete solution
 * Ensures unique solution
 */
function createPuzzle(solution, difficulty) {
    const puzzle = solution.map(row => [...row]);
    const { min, max } = DIFFICULTY_CLUES[difficulty];
    const targetClues = min + Math.floor(Math.random() * (max - min + 1));
    const cellsToRemove = 81 - targetClues;

    // Create list of all positions and shuffle
    const positions = [];
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            positions.push({ row: r, col: c });
        }
    }
    shuffleArray(positions);

    let removed = 0;

    for (const { row, col } of positions) {
        if (removed >= cellsToRemove) break;

        const backup = puzzle[row][col];
        puzzle[row][col] = 0;

        // Check if puzzle still has unique solution
        const testGrid = puzzle.map(r => [...r]);
        if (countSolutions(testGrid) !== 1) {
            // Restore cell if removing it creates multiple solutions
            puzzle[row][col] = backup;
        } else {
            removed++;
        }
    }

    return puzzle;
}

/**
 * Generates a new Sudoku puzzle
 */
function generatePuzzle(difficulty) {
    const solution = createEmptyGrid();
    generateSolution(solution);

    const puzzle = createPuzzle(solution, difficulty);

    return { puzzle, solution };
}

// ========================================
// Solver Algorithm
// ========================================

/**
 * Solves a Sudoku puzzle using backtracking
 * Returns the solved grid or null if unsolvable
 */
function solveSudoku(grid) {
    const copy = grid.map(row => [...row]);

    function solve(row = 0, col = 0) {
        if (col === 9) {
            row++;
            col = 0;
        }

        if (row === 9) return true;

        if (copy[row][col] !== 0) {
            return solve(row, col + 1);
        }

        for (let num = 1; num <= 9; num++) {
            if (isValidPlacement(copy, row, col, num)) {
                copy[row][col] = num;

                if (solve(row, col + 1)) {
                    return true;
                }

                copy[row][col] = 0;
            }
        }

        return false;
    }

    return solve() ? copy : null;
}

// ========================================
// UI Rendering
// ========================================

/**
 * Creates the board cells in the DOM
 */
function createBoardCells() {
    DOM.board.innerHTML = '';

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.setAttribute('role', 'gridcell');
            cell.setAttribute('tabindex', '0');
            cell.setAttribute('aria-label', `Row ${r + 1}, Column ${c + 1}`);
            DOM.board.appendChild(cell);
        }
    }
}

/**
 * Renders the current game state to the board
 */
function renderBoard() {
    const cells = DOM.board.querySelectorAll('.cell');

    cells.forEach((cell, index) => {
        const row = Math.floor(index / 9);
        const col = index % 9;
        const value = GameState.board[row][col];
        const isPrefilled = GameState.initial[row][col] !== 0;
        const notes = GameState.notes[row][col];

        // Reset classes
        cell.className = 'cell';

        // Set prefilled state
        if (isPrefilled) {
            cell.classList.add('prefilled');
        } else if (value !== 0) {
            cell.classList.add('user-input');
        }

        // Set cell content
        if (value !== 0) {
            cell.textContent = value;
            cell.setAttribute('aria-label', `Row ${row + 1}, Column ${col + 1}, value ${value}`);
        } else if (notes.size > 0) {
            cell.innerHTML = createNotesHTML(notes);
            cell.setAttribute('aria-label', `Row ${row + 1}, Column ${col + 1}, notes: ${Array.from(notes).join(', ')}`);
        } else {
            cell.textContent = '';
            cell.setAttribute('aria-label', `Row ${row + 1}, Column ${col + 1}, empty`);
        }
    });

    updateHighlights();
    updateNumberPadCompletion();
}

/**
 * Creates HTML for notes display
 */
function createNotesHTML(notes) {
    let html = '<div class="notes">';
    for (let i = 1; i <= 9; i++) {
        html += `<span>${notes.has(i) ? i : ''}</span>`;
    }
    html += '</div>';
    return html;
}

/**
 * Updates cell highlighting based on selection
 */
function updateHighlights() {
    const cells = DOM.board.querySelectorAll('.cell');

    cells.forEach((cell, index) => {
        const row = Math.floor(index / 9);
        const col = index % 9;

        // Remove highlight classes
        cell.classList.remove('selected', 'related', 'error', 'same-number');

        if (GameState.selected) {
            const { row: selRow, col: selCol } = GameState.selected;
            const selectedValue = GameState.board[selRow][selCol];

            // Highlight selected cell
            if (row === selRow && col === selCol) {
                cell.classList.add('selected');
            }
            // Highlight related cells (same row, column, or box)
            else if (row === selRow || col === selCol ||
                (Math.floor(row / 3) === Math.floor(selRow / 3) &&
                    Math.floor(col / 3) === Math.floor(selCol / 3))) {
                cell.classList.add('related');
            }

            // Highlight same numbers
            if (selectedValue !== 0 && GameState.board[row][col] === selectedValue) {
                cell.classList.add('same-number');
            }
        }

        // Check for errors
        if (GameState.showErrors && hasConflict(row, col)) {
            cell.classList.add('error');
        }
    });
}

/**
 * Checks if a cell has a conflict
 */
function hasConflict(row, col) {
    const value = GameState.board[row][col];
    if (value === 0) return false;

    // Check row
    for (let c = 0; c < 9; c++) {
        if (c !== col && GameState.board[row][c] === value) return true;
    }

    // Check column
    for (let r = 0; r < 9; r++) {
        if (r !== row && GameState.board[r][col] === value) return true;
    }

    // Check 3x3 box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) {
            if ((r !== row || c !== col) && GameState.board[r][c] === value) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Updates number pad to show which numbers are complete
 */
function updateNumberPadCompletion() {
    const counts = Array(10).fill(0);

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const value = GameState.board[r][c];
            if (value !== 0) counts[value]++;
        }
    }

    document.querySelectorAll('.num-btn').forEach(btn => {
        const num = parseInt(btn.dataset.num);
        btn.classList.toggle('completed', counts[num] >= 9);
    });
}

// ========================================
// Game Actions
// ========================================

/**
 * Starts a new game
 */
function startNewGame(difficulty = GameState.difficulty) {
    showMessage('Generating puzzle...', 'info');

    // Use setTimeout to allow UI update
    setTimeout(() => {
        const { puzzle, solution } = generatePuzzle(difficulty);

        GameState.board = puzzle.map(row => [...row]);
        GameState.solution = solution;
        GameState.initial = puzzle.map(row => [...row]);
        GameState.notes = Array(9).fill(null).map(() =>
            Array(9).fill(null).map(() => new Set())
        );
        GameState.selected = null;
        GameState.difficulty = difficulty;
        GameState.hintsRemaining = 3;
        GameState.isNotesMode = false;
        GameState.isPaused = false;
        GameState.isComplete = false;
        GameState.history = [];
        GameState.historyIndex = -1;

        // Reset timer
        stopTimer();
        GameState.timer.seconds = 0;
        updateTimerDisplay();
        startTimer();

        // Update UI
        DOM.hintsLeft.textContent = GameState.hintsRemaining;
        document.getElementById('notes-btn').classList.remove('active');
        DOM.pauseOverlay.classList.add('hidden');
        DOM.winModal.classList.add('hidden');

        renderBoard();
        saveGame();
        showMessage('Good luck!', 'success');

        // Clear message after delay
        setTimeout(() => showMessage(''), 2000);
    }, 50);
}

/**
 * Selects a cell
 */
function selectCell(row, col) {
    if (GameState.isPaused || GameState.isComplete) return;

    GameState.selected = { row, col };
    updateHighlights();
}

/**
 * Inputs a number into the selected cell
 */
function inputNumber(num) {
    if (!GameState.selected || GameState.isPaused || GameState.isComplete) return;

    const { row, col } = GameState.selected;

    // Can't modify prefilled cells
    if (GameState.initial[row][col] !== 0) return;

    if (GameState.isNotesMode) {
        // Toggle note
        const notes = GameState.notes[row][col];
        const oldNotes = new Set(notes);

        if (notes.has(num)) {
            notes.delete(num);
        } else {
            notes.add(num);
        }

        // Only add to history if notes changed
        if (!setsEqual(oldNotes, notes)) {
            addToHistory({
                type: 'note',
                row,
                col,
                oldNotes,
                newNotes: new Set(notes)
            });
        }

        // Clear the cell value if we're adding notes
        if (GameState.board[row][col] !== 0) {
            const oldValue = GameState.board[row][col];
            GameState.board[row][col] = 0;
            addToHistory({
                type: 'value',
                row,
                col,
                oldValue,
                newValue: 0
            });
        }
    } else {
        // Input number
        const oldValue = GameState.board[row][col];

        if (oldValue === num) {
            // Same number - clear it
            GameState.board[row][col] = 0;
            addToHistory({
                type: 'value',
                row,
                col,
                oldValue,
                newValue: 0
            });
        } else {
            // Different number - set it
            GameState.board[row][col] = num;
            GameState.notes[row][col].clear();

            addToHistory({
                type: 'value',
                row,
                col,
                oldValue,
                newValue: num
            });
        }
    }

    renderBoard();
    saveGame();
    checkWinCondition();
}

/**
 * Erases the selected cell
 */
function eraseCell() {
    if (!GameState.selected || GameState.isPaused || GameState.isComplete) return;

    const { row, col } = GameState.selected;

    if (GameState.initial[row][col] !== 0) return;

    const oldValue = GameState.board[row][col];
    const oldNotes = new Set(GameState.notes[row][col]);

    if (oldValue !== 0 || oldNotes.size > 0) {
        GameState.board[row][col] = 0;
        GameState.notes[row][col].clear();

        addToHistory({
            type: 'erase',
            row,
            col,
            oldValue,
            oldNotes
        });

        renderBoard();
        saveGame();
    }
}

/**
 * Toggles notes mode
 */
function toggleNotesMode() {
    GameState.isNotesMode = !GameState.isNotesMode;
    document.getElementById('notes-btn').classList.toggle('active', GameState.isNotesMode);
}

/**
 * Provides a hint
 */
function giveHint() {
    if (GameState.hintsRemaining <= 0 || GameState.isPaused || GameState.isComplete) {
        showMessage('No hints remaining!', 'error');
        return;
    }

    // Find all empty or incorrect cells
    const candidates = [];
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (GameState.board[r][c] !== GameState.solution[r][c]) {
                candidates.push({ row: r, col: c });
            }
        }
    }

    if (candidates.length === 0) {
        showMessage('Puzzle is already complete!', 'info');
        return;
    }

    // Pick a random cell
    const { row, col } = candidates[Math.floor(Math.random() * candidates.length)];
    const correctValue = GameState.solution[row][col];
    const oldValue = GameState.board[row][col];

    GameState.board[row][col] = correctValue;
    GameState.notes[row][col].clear();
    GameState.hintsRemaining--;

    addToHistory({
        type: 'hint',
        row,
        col,
        oldValue,
        newValue: correctValue
    });

    DOM.hintsLeft.textContent = GameState.hintsRemaining;

    // Animate the hint cell
    const cellIndex = row * 9 + col;
    const cell = DOM.board.children[cellIndex];
    cell.classList.add('hint-reveal');
    setTimeout(() => cell.classList.remove('hint-reveal'), 500);

    renderBoard();
    saveGame();
    checkWinCondition();
}

/**
 * Solves the puzzle automatically
 */
function autoSolve() {
    if (GameState.isPaused || GameState.isComplete) return;

    // Copy solution to board
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            GameState.board[r][c] = GameState.solution[r][c];
            GameState.notes[r][c].clear();
        }
    }

    stopTimer();
    GameState.isComplete = true;
    renderBoard();
    showMessage('Puzzle solved!', 'info');
    clearSavedGame();
}

/**
 * Checks if the puzzle is complete
 */
function checkWinCondition() {
    // Check if board matches solution
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (GameState.board[r][c] !== GameState.solution[r][c]) {
                return false;
            }
        }
    }

    // Puzzle complete!
    stopTimer();
    GameState.isComplete = true;

    // Show win modal
    DOM.finalTime.textContent = formatTime(GameState.timer.seconds);
    DOM.finalDifficulty.textContent = GameState.difficulty.charAt(0).toUpperCase() +
        GameState.difficulty.slice(1);
    DOM.winModal.classList.remove('hidden');

    clearSavedGame();
    return true;
}

/**
 * Checks the current solution
 */
function checkSolution() {
    if (GameState.isPaused || GameState.isComplete) return;

    let errors = 0;
    let empty = 0;

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (GameState.board[r][c] === 0) {
                empty++;
            } else if (GameState.board[r][c] !== GameState.solution[r][c]) {
                errors++;
            }
        }
    }

    if (errors === 0 && empty === 0) {
        showMessage('Perfect! The solution is correct!', 'success');
    } else if (errors === 0) {
        showMessage(`Looking good! ${empty} cells remaining.`, 'info');
    } else {
        showMessage(`Found ${errors} incorrect cell${errors > 1 ? 's' : ''}.`, 'error');
    }
}

// ========================================
// Undo/Redo System
// ========================================

/**
 * Adds an action to history
 */
function addToHistory(action) {
    // Remove any redo history
    GameState.history = GameState.history.slice(0, GameState.historyIndex + 1);

    GameState.history.push(action);
    GameState.historyIndex++;

    updateUndoRedoButtons();
}

/**
 * Undoes the last action
 */
function undo() {
    if (GameState.historyIndex < 0 || GameState.isPaused || GameState.isComplete) return;

    const action = GameState.history[GameState.historyIndex];
    GameState.historyIndex--;

    applyAction(action, true);
    updateUndoRedoButtons();
    renderBoard();
    saveGame();
}

/**
 * Redoes the last undone action
 */
function redo() {
    if (GameState.historyIndex >= GameState.history.length - 1 ||
        GameState.isPaused || GameState.isComplete) return;

    GameState.historyIndex++;
    const action = GameState.history[GameState.historyIndex];

    applyAction(action, false);
    updateUndoRedoButtons();
    renderBoard();
    saveGame();
}

/**
 * Applies or reverses an action
 */
function applyAction(action, reverse) {
    const { row, col } = action;

    switch (action.type) {
        case 'value':
        case 'hint':
            GameState.board[row][col] = reverse ? action.oldValue : action.newValue;
            break;
        case 'note':
            GameState.notes[row][col] = new Set(reverse ? action.oldNotes : action.newNotes);
            break;
        case 'erase':
            if (reverse) {
                GameState.board[row][col] = action.oldValue;
                GameState.notes[row][col] = new Set(action.oldNotes);
            } else {
                GameState.board[row][col] = 0;
                GameState.notes[row][col].clear();
            }
            break;
    }
}

/**
 * Updates undo/redo button states
 */
function updateUndoRedoButtons() {
    document.getElementById('undo-btn').disabled = GameState.historyIndex < 0;
    document.getElementById('redo-btn').disabled = GameState.historyIndex >= GameState.history.length - 1;
}

/**
 * Compares two Sets for equality
 */
function setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const item of a) {
        if (!b.has(item)) return false;
    }
    return true;
}

// ========================================
// Timer Functions
// ========================================

/**
 * Starts the timer
 */
function startTimer() {
    if (GameState.timer.isRunning) return;

    GameState.timer.isRunning = true;
    GameState.timer.interval = setInterval(() => {
        GameState.timer.seconds++;
        updateTimerDisplay();
    }, 1000);
}

/**
 * Stops the timer
 */
function stopTimer() {
    GameState.timer.isRunning = false;
    if (GameState.timer.interval) {
        clearInterval(GameState.timer.interval);
        GameState.timer.interval = null;
    }
}

/**
 * Toggles pause state
 */
function togglePause() {
    if (GameState.isComplete) return;

    GameState.isPaused = !GameState.isPaused;

    if (GameState.isPaused) {
        stopTimer();
        DOM.pauseOverlay.classList.remove('hidden');
        document.getElementById('pause-btn').textContent = '▶️';
    } else {
        startTimer();
        DOM.pauseOverlay.classList.add('hidden');
        document.getElementById('pause-btn').textContent = '⏸️';
    }
}

/**
 * Updates the timer display
 */
function updateTimerDisplay() {
    DOM.timer.textContent = formatTime(GameState.timer.seconds);
}

/**
 * Formats seconds to MM:SS
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ========================================
// Save/Load System
// ========================================

/**
 * Saves game state to localStorage
 */
function saveGame() {
    const saveData = {
        board: GameState.board,
        solution: GameState.solution,
        initial: GameState.initial,
        notes: GameState.notes.map(row =>
            row.map(notes => Array.from(notes))
        ),
        difficulty: GameState.difficulty,
        hintsRemaining: GameState.hintsRemaining,
        timerSeconds: GameState.timer.seconds,
        history: GameState.history,
        historyIndex: GameState.historyIndex
    };

    localStorage.setItem('sudoku_save', JSON.stringify(saveData));
}

/**
 * Loads game state from localStorage
 */
function loadGame() {
    const saveData = localStorage.getItem('sudoku_save');
    if (!saveData) return false;

    try {
        const data = JSON.parse(saveData);

        GameState.board = data.board;
        GameState.solution = data.solution;
        GameState.initial = data.initial;
        GameState.notes = data.notes.map(row =>
            row.map(notes => new Set(notes))
        );
        GameState.difficulty = data.difficulty;
        GameState.hintsRemaining = data.hintsRemaining;
        GameState.timer.seconds = data.timerSeconds;
        GameState.history = data.history || [];
        GameState.historyIndex = data.historyIndex !== undefined ? data.historyIndex : -1;

        DOM.difficulty.value = GameState.difficulty;
        DOM.hintsLeft.textContent = GameState.hintsRemaining;
        updateTimerDisplay();
        updateUndoRedoButtons();

        return true;
    } catch (e) {
        console.error('Failed to load saved game:', e);
        return false;
    }
}

/**
 * Clears saved game
 */
function clearSavedGame() {
    localStorage.removeItem('sudoku_save');
}

// ========================================
// Theme System
// ========================================

/**
 * Toggles dark/light theme
 */
function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('sudoku_theme', newTheme);

    // Update icon
    document.querySelector('.theme-icon').textContent = isDark ? '🌙' : '☀️';
}

/**
 * Loads saved theme preference
 */
function loadTheme() {
    const savedTheme = localStorage.getItem('sudoku_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.querySelector('.theme-icon').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}

// ========================================
// Message System
// ========================================

/**
 * Shows a message to the user
 */
function showMessage(text, type = '') {
    DOM.message.textContent = text;
    DOM.message.className = 'message';
    if (type) {
        DOM.message.classList.add(type);
    }
}

// ========================================
// Event Handlers
// ========================================

/**
 * Initializes all event listeners
 */
function initEventListeners() {
    // Board click delegation
    DOM.board.addEventListener('click', (e) => {
        const cell = e.target.closest('.cell');
        if (cell) {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            selectCell(row, col);
        }
    });

    // Keyboard navigation on board
    DOM.board.addEventListener('keydown', (e) => {
        const cell = e.target.closest('.cell');
        if (!cell) return;

        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        switch (e.key) {
            case 'ArrowUp':
                if (row > 0) selectAndFocusCell(row - 1, col);
                e.preventDefault();
                break;
            case 'ArrowDown':
                if (row < 8) selectAndFocusCell(row + 1, col);
                e.preventDefault();
                break;
            case 'ArrowLeft':
                if (col > 0) selectAndFocusCell(row, col - 1);
                e.preventDefault();
                break;
            case 'ArrowRight':
                if (col < 8) selectAndFocusCell(row, col + 1);
                e.preventDefault();
                break;
            case '1': case '2': case '3': case '4': case '5':
            case '6': case '7': case '8': case '9':
                inputNumber(parseInt(e.key));
                e.preventDefault();
                break;
            case 'Backspace':
            case 'Delete':
                eraseCell();
                e.preventDefault();
                break;
        }
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Only handle if not in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        // Number keys (when cell is selected)
        if (GameState.selected && /^[1-9]$/.test(e.key)) {
            inputNumber(parseInt(e.key));
            e.preventDefault();
        }

        // Backspace/Delete
        if ((e.key === 'Backspace' || e.key === 'Delete') && GameState.selected) {
            eraseCell();
            e.preventDefault();
        }

        // Ctrl+Z for undo
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            undo();
            e.preventDefault();
        }

        // Ctrl+Shift+Z or Ctrl+Y for redo
        if ((e.ctrlKey && e.key === 'z' && e.shiftKey) ||
            (e.ctrlKey && e.key === 'y')) {
            redo();
            e.preventDefault();
        }

        // N for notes toggle
        if (e.key === 'n' || e.key === 'N') {
            toggleNotesMode();
            e.preventDefault();
        }

        // P for pause
        if (e.key === 'p' || e.key === 'P') {
            togglePause();
            e.preventDefault();
        }

        // H for hint
        if (e.key === 'h' || e.key === 'H') {
            giveHint();
            e.preventDefault();
        }
    });

    // Number pad clicks
    document.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            inputNumber(parseInt(btn.dataset.num));
        });
    });

    // Control buttons
    document.getElementById('new-game').addEventListener('click', () => {
        startNewGame(DOM.difficulty.value);
    });

    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('resume-btn').addEventListener('click', togglePause);
    document.getElementById('hint-btn').addEventListener('click', giveHint);
    document.getElementById('undo-btn').addEventListener('click', undo);
    document.getElementById('redo-btn').addEventListener('click', redo);
    document.getElementById('erase-btn').addEventListener('click', eraseCell);
    document.getElementById('notes-btn').addEventListener('click', toggleNotesMode);
    document.getElementById('check-btn').addEventListener('click', checkSolution);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Solve button - show confirmation modal
    document.getElementById('solve-btn').addEventListener('click', () => {
        if (!GameState.isPaused && !GameState.isComplete) {
            DOM.solveModal.classList.remove('hidden');
        }
    });

    document.getElementById('confirm-solve').addEventListener('click', () => {
        DOM.solveModal.classList.add('hidden');
        autoSolve();
    });

    document.getElementById('cancel-solve').addEventListener('click', () => {
        DOM.solveModal.classList.add('hidden');
    });

    // Win modal
    document.getElementById('play-again').addEventListener('click', () => {
        DOM.winModal.classList.add('hidden');
        startNewGame(DOM.difficulty.value);
    });

    // Error checking toggle
    document.getElementById('error-check').addEventListener('change', (e) => {
        GameState.showErrors = e.target.checked;
        updateHighlights();
    });

    // Close modals on backdrop click
    [DOM.winModal, DOM.solveModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });

    // Difficulty change
    DOM.difficulty.addEventListener('change', (e) => {
        GameState.difficulty = e.target.value;
    });
}

/**
 * Selects a cell and focuses it
 */
function selectAndFocusCell(row, col) {
    selectCell(row, col);
    const cellIndex = row * 9 + col;
    DOM.board.children[cellIndex].focus();
}

// ========================================
// Initialization
// ========================================

/**
 * Initializes the game
 */
function init() {
    loadTheme();
    createBoardCells();
    initEventListeners();
    updateUndoRedoButtons();

    // Try to load saved game
    if (loadGame()) {
        renderBoard();
        startTimer();
        showMessage('Game restored!', 'success');
        setTimeout(() => showMessage(''), 2000);
    } else {
        // Start new game
        startNewGame('medium');
    }
}

// Start the game when DOM is ready
document.addEventListener('DOMContentLoaded', init);
