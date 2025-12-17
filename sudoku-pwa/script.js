/**
 * Sudoku Master PWA - Complete Game Implementation
 * Features: Generation, Solving, PWA Support, Statistics, Full Offline Support
 */

// ===== CONFIGURATION =====
const CONFIG = {
    DIFFICULTY: {
        easy: { min: 40, max: 45, label: 'Easy' },
        medium: { min: 30, max: 39, label: 'Medium' },
        hard: { min: 25, max: 29, label: 'Hard' }
    },
    MAX_HINTS: 3,
    STORAGE_KEYS: {
        GAME: 'sudoku_currentGame',
        PREFERENCES: 'sudoku_preferences',
        STATISTICS: 'sudoku_statistics'
    },
    TOAST_DURATION: 3000
};

// ===== GAME STATE =====
let gameState = {
    board: [],
    solution: [],
    initial: [],
    notes: [],
    selected: null,
    difficulty: 'medium',
    hintsRemaining: CONFIG.MAX_HINTS,
    hintsUsed: 0,
    isNotesMode: false,
    isPaused: false,
    isComplete: false,
    moveHistory: [],
    redoStack: [],
    timer: {
        seconds: 0,
        interval: null,
        isRunning: false
    },
    startedAt: null,
    lastPlayedAt: null
};

// User preferences
let preferences = {
    theme: 'light',
    highlightErrors: true,
    highlightRelated: true,
    highlightSame: true,
    sound: true,
    vibration: true,
    autoRemoveNotes: true
};

// Statistics
let statistics = {
    easy: { played: 0, won: 0, bestTime: null },
    medium: { played: 0, won: 0, bestTime: null },
    hard: { played: 0, won: 0, bestTime: null },
    currentStreak: 0,
    bestStreak: 0,
    totalPlayTime: 0
};

// ===== DOM ELEMENTS =====
const DOM = {};

// ===== SUDOKU GENERATOR CLASS =====
class SudokuGenerator {
    /**
     * Creates an empty 9x9 grid
     */
    static createEmptyGrid() {
        return Array(9).fill(null).map(() => Array(9).fill(0));
    }

    /**
     * Shuffles an array using Fisher-Yates algorithm
     */
    static shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /**
     * Checks if a number can be placed at the given position
     */
    static isValid(grid, row, col, num) {
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
     * Generates a complete Sudoku solution using backtracking
     */
    static generateSolution(grid = null, row = 0, col = 0) {
        if (!grid) grid = this.createEmptyGrid();

        if (col === 9) {
            row++;
            col = 0;
        }

        if (row === 9) return true;

        if (grid[row][col] !== 0) {
            return this.generateSolution(grid, row, col + 1);
        }

        const numbers = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

        for (const num of numbers) {
            if (this.isValid(grid, row, col, num)) {
                grid[row][col] = num;
                if (this.generateSolution(grid, row, col + 1)) {
                    return true;
                }
                grid[row][col] = 0;
            }
        }

        return false;
    }

    /**
     * Counts solutions for a puzzle (stops at 2)
     */
    static countSolutions(grid, count = { value: 0 }) {
        // Find empty cell
        let empty = null;
        for (let r = 0; r < 9 && !empty; r++) {
            for (let c = 0; c < 9 && !empty; c++) {
                if (grid[r][c] === 0) empty = { row: r, col: c };
            }
        }

        if (!empty) {
            count.value++;
            return count.value;
        }

        const { row, col } = empty;

        for (let num = 1; num <= 9; num++) {
            if (this.isValid(grid, row, col, num)) {
                grid[row][col] = num;
                this.countSolutions(grid, count);
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
     * Creates a puzzle by removing numbers from solution
     */
    static createPuzzle(solution, difficulty) {
        const puzzle = solution.map(row => [...row]);
        const { min, max } = CONFIG.DIFFICULTY[difficulty];
        const targetClues = min + Math.floor(Math.random() * (max - min + 1));
        const cellsToRemove = 81 - targetClues;

        // Create shuffled list of positions
        const positions = [];
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                positions.push({ row: r, col: c });
            }
        }
        this.shuffle(positions);

        let removed = 0;

        for (const { row, col } of positions) {
            if (removed >= cellsToRemove) break;

            const backup = puzzle[row][col];
            puzzle[row][col] = 0;

            // Check unique solution
            const testGrid = puzzle.map(r => [...r]);
            if (this.countSolutions(testGrid) !== 1) {
                puzzle[row][col] = backup;
            } else {
                removed++;
            }
        }

        return puzzle;
    }

    /**
     * Generates a new puzzle with solution
     */
    static generate(difficulty = 'medium') {
        const solution = this.createEmptyGrid();
        this.generateSolution(solution);
        const puzzle = this.createPuzzle(solution, difficulty);
        return { puzzle, solution };
    }
}

// ===== SUDOKU SOLVER CLASS =====
class SudokuSolver {
    /**
     * Solves a Sudoku puzzle using backtracking
     */
    static solve(grid) {
        const copy = grid.map(row => [...row]);

        const backtrack = (row = 0, col = 0) => {
            if (col === 9) {
                row++;
                col = 0;
            }
            if (row === 9) return true;
            if (copy[row][col] !== 0) return backtrack(row, col + 1);

            for (let num = 1; num <= 9; num++) {
                if (SudokuGenerator.isValid(copy, row, col, num)) {
                    copy[row][col] = num;
                    if (backtrack(row, col + 1)) return true;
                    copy[row][col] = 0;
                }
            }
            return false;
        };

        return backtrack() ? copy : null;
    }

    /**
     * Checks if a specific cell has a conflict
     */
    static hasConflict(board, row, col) {
        const value = board[row][col];
        if (value === 0) return false;

        // Check row
        for (let c = 0; c < 9; c++) {
            if (c !== col && board[row][c] === value) return true;
        }

        // Check column
        for (let r = 0; r < 9; r++) {
            if (r !== row && board[r][col] === value) return true;
        }

        // Check 3x3 box
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                if ((r !== row || c !== col) && board[r][c] === value) return true;
            }
        }

        return false;
    }

    /**
     * Gets all errors on the board
     */
    static getErrors(board) {
        const errors = [];
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (this.hasConflict(board, r, c)) {
                    errors.push({ row: r, col: c });
                }
            }
        }
        return errors;
    }
}

// ===== STORAGE MANAGER CLASS =====
class StorageManager {
    static save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Storage save error:', e);
            return false;
        }
    }

    static load(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Storage load error:', e);
            return null;
        }
    }

    static remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage remove error:', e);
            return false;
        }
    }

    // Game state
    static saveGame() {
        const data = {
            board: gameState.board,
            solution: gameState.solution,
            initial: gameState.initial,
            notes: gameState.notes.map(row => row.map(set => Array.from(set))),
            difficulty: gameState.difficulty,
            hintsRemaining: gameState.hintsRemaining,
            hintsUsed: gameState.hintsUsed,
            timer: gameState.timer.seconds,
            moveHistory: gameState.moveHistory,
            redoStack: gameState.redoStack,
            startedAt: gameState.startedAt,
            lastPlayedAt: new Date().toISOString()
        };
        return this.save(CONFIG.STORAGE_KEYS.GAME, data);
    }

    static loadGame() {
        return this.load(CONFIG.STORAGE_KEYS.GAME);
    }

    static clearGame() {
        return this.remove(CONFIG.STORAGE_KEYS.GAME);
    }

    // Preferences
    static savePreferences() {
        return this.save(CONFIG.STORAGE_KEYS.PREFERENCES, preferences);
    }

    static loadPreferences() {
        const data = this.load(CONFIG.STORAGE_KEYS.PREFERENCES);
        if (data) {
            preferences = { ...preferences, ...data };
        }
        return preferences;
    }

    // Statistics
    static saveStatistics() {
        return this.save(CONFIG.STORAGE_KEYS.STATISTICS, statistics);
    }

    static loadStatistics() {
        const data = this.load(CONFIG.STORAGE_KEYS.STATISTICS);
        if (data) {
            statistics = { ...statistics, ...data };
        }
        return statistics;
    }

    static resetStatistics() {
        statistics = {
            easy: { played: 0, won: 0, bestTime: null },
            medium: { played: 0, won: 0, bestTime: null },
            hard: { played: 0, won: 0, bestTime: null },
            currentStreak: 0,
            bestStreak: 0,
            totalPlayTime: 0
        };
        return this.saveStatistics();
    }
}

// ===== UI MANAGER CLASS =====
class UIManager {
    /**
     * Caches DOM elements
     */
    static cacheDOM() {
        DOM.board = document.getElementById('board');
        DOM.timer = document.getElementById('timer');
        DOM.hintCount = document.getElementById('hint-count');
        DOM.difficulty = document.getElementById('difficulty');
        DOM.pauseOverlay = document.getElementById('pause-overlay');
        DOM.toast = document.getElementById('toast');

        // Modals
        DOM.newGameModal = document.getElementById('new-game-modal');
        DOM.winModal = document.getElementById('win-modal');
        DOM.solveModal = document.getElementById('solve-modal');
        DOM.statsModal = document.getElementById('stats-modal');
        DOM.settingsModal = document.getElementById('settings-modal');

        // Buttons
        DOM.pauseBtn = document.getElementById('pause-btn');
        DOM.notesBtn = document.getElementById('notes-btn');
        DOM.undoBtn = document.getElementById('undo-btn');
        DOM.redoBtn = document.getElementById('redo-btn');
        DOM.installBtn = document.getElementById('install-btn');

        // Banners
        DOM.connectionBanner = document.getElementById('connection-banner');
        DOM.updateBanner = document.getElementById('update-banner');
    }

    /**
     * Creates the board cells
     */
    static createBoard() {
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
     * Renders the current game state
     */
    static renderBoard() {
        const cells = DOM.board.querySelectorAll('.cell');

        cells.forEach((cell, index) => {
            const row = Math.floor(index / 9);
            const col = index % 9;
            const value = gameState.board[row][col];
            const isPrefilled = gameState.initial[row][col] !== 0;
            const notes = gameState.notes[row][col];

            // Reset classes
            cell.className = 'cell';

            // Set states
            if (isPrefilled) {
                cell.classList.add('prefilled');
            } else if (value !== 0) {
                cell.classList.add('user-input');
            }

            // Set content
            if (value !== 0) {
                cell.textContent = value;
                cell.setAttribute('aria-label',
                    `Row ${row + 1}, Column ${col + 1}, value ${value}${isPrefilled ? ', given' : ''}`);
            } else if (notes && notes.size > 0) {
                cell.innerHTML = this.createNotesHTML(notes);
                cell.setAttribute('aria-label',
                    `Row ${row + 1}, Column ${col + 1}, notes: ${Array.from(notes).sort().join(', ')}`);
            } else {
                cell.textContent = '';
                cell.setAttribute('aria-label', `Row ${row + 1}, Column ${col + 1}, empty`);
            }
        });

        this.updateHighlights();
        this.updateNumberPad();
        this.updateActionButtons();
    }

    /**
     * Creates HTML for notes
     */
    static createNotesHTML(notes) {
        let html = '<div class="notes">';
        for (let i = 1; i <= 9; i++) {
            html += `<span>${notes.has(i) ? i : ''}</span>`;
        }
        html += '</div>';
        return html;
    }

    /**
     * Updates cell highlights
     */
    static updateHighlights() {
        const cells = DOM.board.querySelectorAll('.cell');

        cells.forEach((cell, index) => {
            const row = Math.floor(index / 9);
            const col = index % 9;

            // Remove all highlight classes
            cell.classList.remove('selected', 'related', 'same-number', 'error');

            if (gameState.selected) {
                const { row: selRow, col: selCol } = gameState.selected;
                const selectedValue = gameState.board[selRow][selCol];

                // Selected cell
                if (row === selRow && col === selCol) {
                    cell.classList.add('selected');
                }
                // Related cells
                else if (preferences.highlightRelated) {
                    const sameRow = row === selRow;
                    const sameCol = col === selCol;
                    const sameBox = Math.floor(row / 3) === Math.floor(selRow / 3) &&
                                    Math.floor(col / 3) === Math.floor(selCol / 3);
                    if (sameRow || sameCol || sameBox) {
                        cell.classList.add('related');
                    }
                }

                // Same number highlight
                if (preferences.highlightSame && selectedValue !== 0 &&
                    gameState.board[row][col] === selectedValue) {
                    cell.classList.add('same-number');
                }
            }

            // Error highlight
            if (preferences.highlightErrors && SudokuSolver.hasConflict(gameState.board, row, col)) {
                cell.classList.add('error');
            }
        });
    }

    /**
     * Updates number pad completion status
     */
    static updateNumberPad() {
        const counts = Array(10).fill(0);
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const val = gameState.board[r][c];
                if (val !== 0) counts[val]++;
            }
        }

        document.querySelectorAll('.num-btn').forEach(btn => {
            const num = parseInt(btn.dataset.num);
            btn.classList.toggle('completed', counts[num] >= 9);
        });
    }

    /**
     * Updates action button states
     */
    static updateActionButtons() {
        DOM.undoBtn.disabled = gameState.moveHistory.length === 0;
        DOM.redoBtn.disabled = gameState.redoStack.length === 0;
        DOM.notesBtn.classList.toggle('active', gameState.isNotesMode);
    }

    /**
     * Updates timer display
     */
    static updateTimer() {
        DOM.timer.textContent = this.formatTime(gameState.timer.seconds);
    }

    /**
     * Formats seconds to MM:SS
     */
    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Formats seconds to human readable
     */
    static formatTimeReadable(seconds) {
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        return `${Math.floor(seconds / 3600)}h`;
    }

    /**
     * Shows a toast notification
     */
    static showToast(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
        DOM.toast.querySelector('.toast-message').textContent = message;
        DOM.toast.className = `toast ${type}`;
        DOM.toast.classList.remove('hidden');

        // Clear any existing timeout
        if (this.toastTimeout) clearTimeout(this.toastTimeout);

        this.toastTimeout = setTimeout(() => {
            DOM.toast.classList.add('hidden');
        }, duration);
    }

    /**
     * Shows a modal
     */
    static showModal(modal) {
        modal.classList.remove('hidden');
        modal.querySelector('button')?.focus();
    }

    /**
     * Hides a modal
     */
    static hideModal(modal) {
        modal.classList.add('hidden');
    }

    /**
     * Updates hints display
     */
    static updateHints() {
        DOM.hintCount.textContent = `(${gameState.hintsRemaining})`;
        document.getElementById('hint-btn').disabled = gameState.hintsRemaining <= 0;
    }

    /**
     * Shows win modal with stats
     */
    static showWinModal() {
        document.getElementById('win-time').textContent = this.formatTime(gameState.timer.seconds);
        document.getElementById('win-difficulty').textContent = CONFIG.DIFFICULTY[gameState.difficulty].label;
        document.getElementById('win-hints').textContent = gameState.hintsUsed;
        this.showModal(DOM.winModal);
        this.createConfetti();
    }

    /**
     * Creates confetti animation
     */
    static createConfetti() {
        const confetti = document.querySelector('.confetti');
        confetti.innerHTML = '';

        const colors = ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590'];

        for (let i = 0; i < 50; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = Math.random() * 2 + 's';
            piece.style.animationDuration = (2 + Math.random() * 2) + 's';
            confetti.appendChild(piece);
        }
    }

    /**
     * Updates statistics display
     */
    static updateStatisticsDisplay() {
        // Per difficulty stats
        ['easy', 'medium', 'hard'].forEach(diff => {
            document.getElementById(`stat-${diff}-played`).textContent = statistics[diff].played;
            document.getElementById(`stat-${diff}-won`).textContent = statistics[diff].won;
            document.getElementById(`stat-${diff}-best`).textContent =
                statistics[diff].bestTime ? this.formatTime(statistics[diff].bestTime) : '--:--';
        });

        // Overall stats
        document.getElementById('stat-streak').textContent = statistics.currentStreak;
        document.getElementById('stat-best-streak').textContent = statistics.bestStreak;
        document.getElementById('stat-total-time').textContent = this.formatTimeReadable(statistics.totalPlayTime);
    }

    /**
     * Updates settings UI from preferences
     */
    static updateSettingsUI() {
        document.getElementById('setting-errors').checked = preferences.highlightErrors;
        document.getElementById('setting-related').checked = preferences.highlightRelated;
        document.getElementById('setting-same').checked = preferences.highlightSame;
        document.getElementById('setting-sound').checked = preferences.sound;
        document.getElementById('setting-vibration').checked = preferences.vibration;
        document.getElementById('setting-auto-notes').checked = preferences.autoRemoveNotes;
    }

    /**
     * Applies theme
     */
    static applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const themeColor = theme === 'dark' ? '#0f172a' : '#4a90d9';
        document.getElementById('theme-color-meta').setAttribute('content', themeColor);
        preferences.theme = theme;
        StorageManager.savePreferences();
    }

    /**
     * Toggles theme
     */
    static toggleTheme() {
        const newTheme = preferences.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
    }

    /**
     * Shows connection status
     */
    static setOnlineStatus(online) {
        if (online) {
            DOM.connectionBanner.classList.add('hidden');
        } else {
            DOM.connectionBanner.classList.remove('hidden');
        }
    }

    /**
     * Shows update available banner
     */
    static showUpdateBanner() {
        DOM.updateBanner.classList.remove('hidden');
    }

    /**
     * Shows install button
     */
    static showInstallButton() {
        DOM.installBtn.classList.remove('hidden');
    }

    /**
     * Hides install button
     */
    static hideInstallButton() {
        DOM.installBtn.classList.add('hidden');
    }
}

// ===== GAME CONTROLLER CLASS =====
class GameController {
    /**
     * Starts a new game
     */
    static newGame(difficulty = gameState.difficulty, skipConfirm = false) {
        // Check if there's an ongoing game
        if (!skipConfirm && !gameState.isComplete && gameState.board.length > 0) {
            const hasProgress = gameState.board.some((row, r) =>
                row.some((val, c) => val !== 0 && gameState.initial[r][c] === 0)
            );
            if (hasProgress) {
                UIManager.showModal(DOM.newGameModal);
                return;
            }
        }

        UIManager.showToast('Generating puzzle...', 'info', 1500);

        setTimeout(() => {
            const { puzzle, solution } = SudokuGenerator.generate(difficulty);

            gameState = {
                board: puzzle.map(row => [...row]),
                solution,
                initial: puzzle.map(row => [...row]),
                notes: Array(9).fill(null).map(() => Array(9).fill(null).map(() => new Set())),
                selected: null,
                difficulty,
                hintsRemaining: CONFIG.MAX_HINTS,
                hintsUsed: 0,
                isNotesMode: false,
                isPaused: false,
                isComplete: false,
                moveHistory: [],
                redoStack: [],
                timer: { seconds: 0, interval: null, isRunning: false },
                startedAt: new Date().toISOString(),
                lastPlayedAt: new Date().toISOString()
            };

            // Update statistics
            statistics[difficulty].played++;
            StorageManager.saveStatistics();

            // Update UI
            DOM.difficulty.value = difficulty;
            UIManager.updateHints();
            UIManager.updateTimer();
            UIManager.renderBoard();

            // Reset pause state
            this.setPaused(false);

            // Start timer
            this.startTimer();

            // Save game
            StorageManager.saveGame();

            UIManager.showToast('Good luck!', 'success');
        }, 100);
    }

    /**
     * Loads a saved game
     */
    static loadSavedGame() {
        const data = StorageManager.loadGame();
        if (!data) return false;

        try {
            gameState.board = data.board;
            gameState.solution = data.solution;
            gameState.initial = data.initial;
            gameState.notes = data.notes.map(row => row.map(arr => new Set(arr)));
            gameState.difficulty = data.difficulty;
            gameState.hintsRemaining = data.hintsRemaining;
            gameState.hintsUsed = data.hintsUsed || 0;
            gameState.timer.seconds = data.timer;
            gameState.moveHistory = data.moveHistory || [];
            gameState.redoStack = data.redoStack || [];
            gameState.startedAt = data.startedAt;
            gameState.lastPlayedAt = data.lastPlayedAt;

            DOM.difficulty.value = gameState.difficulty;
            UIManager.updateHints();
            UIManager.updateTimer();
            UIManager.renderBoard();

            return true;
        } catch (e) {
            console.error('Failed to load saved game:', e);
            return false;
        }
    }

    /**
     * Starts the timer
     */
    static startTimer() {
        if (gameState.timer.isRunning) return;

        gameState.timer.isRunning = true;
        gameState.timer.interval = setInterval(() => {
            if (!gameState.isPaused && !gameState.isComplete) {
                gameState.timer.seconds++;
                UIManager.updateTimer();

                // Periodic save
                if (gameState.timer.seconds % 30 === 0) {
                    StorageManager.saveGame();
                }
            }
        }, 1000);
    }

    /**
     * Stops the timer
     */
    static stopTimer() {
        gameState.timer.isRunning = false;
        if (gameState.timer.interval) {
            clearInterval(gameState.timer.interval);
            gameState.timer.interval = null;
        }
    }

    /**
     * Toggles pause state
     */
    static togglePause() {
        if (gameState.isComplete) return;
        this.setPaused(!gameState.isPaused);
    }

    /**
     * Sets pause state
     */
    static setPaused(paused) {
        gameState.isPaused = paused;

        if (paused) {
            DOM.pauseOverlay.classList.remove('hidden');
            DOM.pauseBtn.querySelector('.pause-icon').classList.add('hidden');
            DOM.pauseBtn.querySelector('.play-icon').classList.remove('hidden');
        } else {
            DOM.pauseOverlay.classList.add('hidden');
            DOM.pauseBtn.querySelector('.pause-icon').classList.remove('hidden');
            DOM.pauseBtn.querySelector('.play-icon').classList.add('hidden');
        }
    }

    /**
     * Selects a cell
     */
    static selectCell(row, col) {
        if (gameState.isPaused || gameState.isComplete) return;

        gameState.selected = { row, col };
        UIManager.updateHighlights();

        // Haptic feedback
        if (preferences.vibration && navigator.vibrate) {
            navigator.vibrate(10);
        }
    }

    /**
     * Inputs a number
     */
    static inputNumber(num) {
        if (!gameState.selected || gameState.isPaused || gameState.isComplete) return;

        const { row, col } = gameState.selected;

        // Can't modify prefilled cells
        if (gameState.initial[row][col] !== 0) {
            this.animateCell(row, col, 'shake');
            return;
        }

        // Save to history
        const historyEntry = {
            type: gameState.isNotesMode ? 'note' : 'value',
            row,
            col,
            oldValue: gameState.board[row][col],
            oldNotes: new Set(gameState.notes[row][col]),
            newValue: null,
            newNotes: null
        };

        if (gameState.isNotesMode) {
            // Toggle note
            const notes = gameState.notes[row][col];
            if (notes.has(num)) {
                notes.delete(num);
            } else {
                notes.add(num);
            }
            historyEntry.newNotes = new Set(notes);

            // Clear value if adding notes
            if (gameState.board[row][col] !== 0) {
                historyEntry.oldValue = gameState.board[row][col];
                gameState.board[row][col] = 0;
            }
            historyEntry.newValue = 0;
        } else {
            // Input value
            const oldValue = gameState.board[row][col];

            if (oldValue === num) {
                // Toggle off
                gameState.board[row][col] = 0;
                historyEntry.newValue = 0;
            } else {
                // Set new value
                gameState.board[row][col] = num;
                gameState.notes[row][col].clear();
                historyEntry.newValue = num;
                historyEntry.newNotes = new Set();

                // Auto-remove notes from related cells
                if (preferences.autoRemoveNotes) {
                    this.removeRelatedNotes(row, col, num);
                }

                this.animateCell(row, col, 'pop');
            }
        }

        // Add to history
        gameState.moveHistory.push(historyEntry);
        gameState.redoStack = [];

        UIManager.renderBoard();
        StorageManager.saveGame();
        this.checkWin();
    }

    /**
     * Removes notes from related cells
     */
    static removeRelatedNotes(row, col, num) {
        // Row and column
        for (let i = 0; i < 9; i++) {
            gameState.notes[row][i].delete(num);
            gameState.notes[i][col].delete(num);
        }

        // Box
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                gameState.notes[r][c].delete(num);
            }
        }
    }

    /**
     * Erases the selected cell
     */
    static erase() {
        if (!gameState.selected || gameState.isPaused || gameState.isComplete) return;

        const { row, col } = gameState.selected;

        if (gameState.initial[row][col] !== 0) return;

        const oldValue = gameState.board[row][col];
        const oldNotes = new Set(gameState.notes[row][col]);

        if (oldValue === 0 && oldNotes.size === 0) return;

        // Save to history
        gameState.moveHistory.push({
            type: 'erase',
            row,
            col,
            oldValue,
            oldNotes,
            newValue: 0,
            newNotes: new Set()
        });
        gameState.redoStack = [];

        gameState.board[row][col] = 0;
        gameState.notes[row][col].clear();

        UIManager.renderBoard();
        StorageManager.saveGame();
    }

    /**
     * Toggles notes mode
     */
    static toggleNotes() {
        gameState.isNotesMode = !gameState.isNotesMode;
        UIManager.updateActionButtons();
    }

    /**
     * Undoes last move
     */
    static undo() {
        if (gameState.moveHistory.length === 0 || gameState.isPaused || gameState.isComplete) return;

        const move = gameState.moveHistory.pop();
        gameState.redoStack.push(move);

        gameState.board[move.row][move.col] = move.oldValue;
        gameState.notes[move.row][move.col] = new Set(move.oldNotes);

        UIManager.renderBoard();
        StorageManager.saveGame();
    }

    /**
     * Redoes last undone move
     */
    static redo() {
        if (gameState.redoStack.length === 0 || gameState.isPaused || gameState.isComplete) return;

        const move = gameState.redoStack.pop();
        gameState.moveHistory.push(move);

        gameState.board[move.row][move.col] = move.newValue;
        gameState.notes[move.row][move.col] = new Set(move.newNotes || []);

        UIManager.renderBoard();
        StorageManager.saveGame();
    }

    /**
     * Gives a hint
     */
    static hint() {
        if (gameState.hintsRemaining <= 0 || gameState.isPaused || gameState.isComplete) {
            UIManager.showToast('No hints remaining!', 'error');
            return;
        }

        // Find empty or incorrect cells
        const candidates = [];
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (gameState.board[r][c] !== gameState.solution[r][c]) {
                    candidates.push({ row: r, col: c });
                }
            }
        }

        if (candidates.length === 0) {
            UIManager.showToast('Puzzle is already complete!', 'info');
            return;
        }

        // Pick random cell
        const { row, col } = candidates[Math.floor(Math.random() * candidates.length)];
        const correctValue = gameState.solution[row][col];
        const oldValue = gameState.board[row][col];

        // Save to history
        gameState.moveHistory.push({
            type: 'hint',
            row,
            col,
            oldValue,
            oldNotes: new Set(gameState.notes[row][col]),
            newValue: correctValue,
            newNotes: new Set()
        });
        gameState.redoStack = [];

        gameState.board[row][col] = correctValue;
        gameState.notes[row][col].clear();
        gameState.hintsRemaining--;
        gameState.hintsUsed++;

        UIManager.updateHints();
        this.animateCell(row, col, 'hint-reveal');
        UIManager.renderBoard();
        StorageManager.saveGame();
        this.checkWin();
    }

    /**
     * Auto-solves the puzzle
     */
    static autoSolve() {
        if (gameState.isPaused || gameState.isComplete) return;

        // Copy solution to board
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                gameState.board[r][c] = gameState.solution[r][c];
                gameState.notes[r][c].clear();
            }
        }

        this.stopTimer();
        gameState.isComplete = true;

        // Don't count as win for statistics
        UIManager.renderBoard();
        StorageManager.clearGame();
        UIManager.showToast('Puzzle solved!', 'info');
    }

    /**
     * Checks current solution
     */
    static checkSolution() {
        if (gameState.isPaused || gameState.isComplete) return;

        let errors = 0;
        let empty = 0;

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (gameState.board[r][c] === 0) {
                    empty++;
                } else if (gameState.board[r][c] !== gameState.solution[r][c]) {
                    errors++;
                }
            }
        }

        if (errors === 0 && empty === 0) {
            UIManager.showToast('Perfect! The solution is correct!', 'success');
        } else if (errors === 0) {
            UIManager.showToast(`Looking good! ${empty} cells remaining.`, 'info');
        } else {
            UIManager.showToast(`Found ${errors} incorrect cell${errors !== 1 ? 's' : ''}.`, 'error');
        }
    }

    /**
     * Checks for win condition
     */
    static checkWin() {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (gameState.board[r][c] !== gameState.solution[r][c]) {
                    return false;
                }
            }
        }

        // Win!
        this.stopTimer();
        gameState.isComplete = true;

        // Update statistics
        const diff = gameState.difficulty;
        statistics[diff].won++;
        if (!statistics[diff].bestTime || gameState.timer.seconds < statistics[diff].bestTime) {
            statistics[diff].bestTime = gameState.timer.seconds;
        }
        statistics.currentStreak++;
        if (statistics.currentStreak > statistics.bestStreak) {
            statistics.bestStreak = statistics.currentStreak;
        }
        statistics.totalPlayTime += gameState.timer.seconds;
        StorageManager.saveStatistics();

        // Clear saved game
        StorageManager.clearGame();

        // Show win modal
        setTimeout(() => UIManager.showWinModal(), 500);

        return true;
    }

    /**
     * Animates a cell
     */
    static animateCell(row, col, animation) {
        const index = row * 9 + col;
        const cell = DOM.board.children[index];
        cell.classList.add(animation);
        setTimeout(() => cell.classList.remove(animation), 600);
    }

    /**
     * Shares result
     */
    static shareResult() {
        const text = `🎉 I solved a ${CONFIG.DIFFICULTY[gameState.difficulty].label} Sudoku puzzle in ${UIManager.formatTime(gameState.timer.seconds)}! Play at: ${window.location.href}`;

        if (navigator.share) {
            navigator.share({ text }).catch(() => {});
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                UIManager.showToast('Result copied to clipboard!', 'success');
            });
        }
    }
}

// ===== PWA MANAGER CLASS =====
class PWAManager {
    static deferredPrompt = null;
    static registration = null;

    /**
     * Initializes PWA features
     */
    static init() {
        this.registerServiceWorker();
        this.setupInstallPrompt();
        this.setupConnectionStatus();
    }

    /**
     * Registers service worker
     */
    static async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.log('Service workers not supported');
            return;
        }

        try {
            this.registration = await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker registered:', this.registration.scope);

            // Check for updates
            this.registration.addEventListener('updatefound', () => {
                const newWorker = this.registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        UIManager.showUpdateBanner();
                    }
                });
            });

            // Periodic update check
            setInterval(() => {
                this.registration.update();
            }, 60 * 60 * 1000); // Every hour

        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }

    /**
     * Sets up install prompt handling
     */
    static setupInstallPrompt() {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('App is already installed');
            return;
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            UIManager.showInstallButton();
        });

        window.addEventListener('appinstalled', () => {
            console.log('App installed');
            UIManager.hideInstallButton();
            UIManager.showToast('App installed successfully!', 'success');
            this.deferredPrompt = null;
        });
    }

    /**
     * Prompts user to install
     */
    static async promptInstall() {
        if (!this.deferredPrompt) return;

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log('Install prompt outcome:', outcome);
        this.deferredPrompt = null;
    }

    /**
     * Applies update
     */
    static applyUpdate() {
        if (this.registration && this.registration.waiting) {
            this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
    }

    /**
     * Sets up connection status monitoring
     */
    static setupConnectionStatus() {
        UIManager.setOnlineStatus(navigator.onLine);

        window.addEventListener('online', () => {
            UIManager.setOnlineStatus(true);
            UIManager.showToast('Back online!', 'success');
        });

        window.addEventListener('offline', () => {
            UIManager.setOnlineStatus(false);
            UIManager.showToast('You are offline. Game is still playable!', 'info');
        });
    }
}

// ===== EVENT HANDLERS =====
function setupEventListeners() {
    // Board interactions
    DOM.board.addEventListener('click', (e) => {
        const cell = e.target.closest('.cell');
        if (cell) {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            GameController.selectCell(row, col);
        }
    });

    // Keyboard navigation
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
                GameController.inputNumber(parseInt(e.key));
                e.preventDefault();
                break;
            case 'Backspace':
            case 'Delete':
                GameController.erase();
                e.preventDefault();
                break;
        }
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        // Number keys
        if (/^[1-9]$/.test(e.key) && gameState.selected) {
            GameController.inputNumber(parseInt(e.key));
            e.preventDefault();
        }

        // Backspace/Delete
        if ((e.key === 'Backspace' || e.key === 'Delete') && gameState.selected) {
            GameController.erase();
            e.preventDefault();
        }

        // Ctrl+Z: Undo
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            GameController.undo();
            e.preventDefault();
        }

        // Ctrl+Y or Ctrl+Shift+Z: Redo
        if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
            GameController.redo();
            e.preventDefault();
        }

        // N: Notes
        if (e.key.toLowerCase() === 'n' && !e.ctrlKey) {
            GameController.toggleNotes();
            e.preventDefault();
        }

        // P: Pause
        if (e.key.toLowerCase() === 'p' && !e.ctrlKey) {
            GameController.togglePause();
            e.preventDefault();
        }

        // H: Hint
        if (e.key.toLowerCase() === 'h' && !e.ctrlKey) {
            GameController.hint();
            e.preventDefault();
        }

        // Escape: Close modals / deselect
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal:not(.hidden)');
            if (openModal) {
                UIManager.hideModal(openModal);
            } else if (gameState.isPaused) {
                GameController.setPaused(false);
            } else {
                gameState.selected = null;
                UIManager.updateHighlights();
            }
            e.preventDefault();
        }
    });

    // Number pad
    document.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            GameController.inputNumber(parseInt(btn.dataset.num));
        });
    });

    // Action buttons
    document.getElementById('undo-btn').addEventListener('click', () => GameController.undo());
    document.getElementById('redo-btn').addEventListener('click', () => GameController.redo());
    document.getElementById('erase-btn').addEventListener('click', () => GameController.erase());
    document.getElementById('notes-btn').addEventListener('click', () => GameController.toggleNotes());
    document.getElementById('hint-btn').addEventListener('click', () => GameController.hint());
    document.getElementById('check-btn').addEventListener('click', () => GameController.checkSolution());

    // New game
    document.getElementById('new-game-btn').addEventListener('click', () => {
        GameController.newGame(DOM.difficulty.value);
    });

    document.getElementById('confirm-new-game').addEventListener('click', () => {
        UIManager.hideModal(DOM.newGameModal);
        GameController.newGame(DOM.difficulty.value, true);
    });

    document.getElementById('cancel-new-game').addEventListener('click', () => {
        UIManager.hideModal(DOM.newGameModal);
    });

    // Pause
    document.getElementById('pause-btn').addEventListener('click', () => GameController.togglePause());
    document.getElementById('resume-btn').addEventListener('click', () => GameController.setPaused(false));

    // Solve
    document.getElementById('solve-btn').addEventListener('click', () => {
        if (!gameState.isPaused && !gameState.isComplete) {
            UIManager.showModal(DOM.solveModal);
        }
    });

    document.getElementById('confirm-solve').addEventListener('click', () => {
        UIManager.hideModal(DOM.solveModal);
        GameController.autoSolve();
    });

    document.getElementById('cancel-solve').addEventListener('click', () => {
        UIManager.hideModal(DOM.solveModal);
    });

    // Win modal
    document.getElementById('play-again-btn').addEventListener('click', () => {
        UIManager.hideModal(DOM.winModal);
        GameController.newGame(DOM.difficulty.value, true);
    });

    document.getElementById('share-btn').addEventListener('click', () => {
        GameController.shareResult();
    });

    // Statistics modal
    document.getElementById('stats-btn').addEventListener('click', () => {
        UIManager.updateStatisticsDisplay();
        UIManager.showModal(DOM.statsModal);
    });

    document.getElementById('reset-stats-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all statistics?')) {
            StorageManager.resetStatistics();
            UIManager.updateStatisticsDisplay();
            UIManager.showToast('Statistics reset', 'success');
        }
    });

    // Settings modal
    document.getElementById('settings-btn').addEventListener('click', () => {
        UIManager.updateSettingsUI();
        UIManager.showModal(DOM.settingsModal);
    });

    // Settings changes
    document.getElementById('setting-errors').addEventListener('change', (e) => {
        preferences.highlightErrors = e.target.checked;
        StorageManager.savePreferences();
        UIManager.updateHighlights();
    });

    document.getElementById('setting-related').addEventListener('change', (e) => {
        preferences.highlightRelated = e.target.checked;
        StorageManager.savePreferences();
        UIManager.updateHighlights();
    });

    document.getElementById('setting-same').addEventListener('change', (e) => {
        preferences.highlightSame = e.target.checked;
        StorageManager.savePreferences();
        UIManager.updateHighlights();
    });

    document.getElementById('setting-sound').addEventListener('change', (e) => {
        preferences.sound = e.target.checked;
        StorageManager.savePreferences();
    });

    document.getElementById('setting-vibration').addEventListener('change', (e) => {
        preferences.vibration = e.target.checked;
        StorageManager.savePreferences();
    });

    document.getElementById('setting-auto-notes').addEventListener('change', (e) => {
        preferences.autoRemoveNotes = e.target.checked;
        StorageManager.savePreferences();
    });

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
        UIManager.toggleTheme();
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('modal-backdrop')) {
                UIManager.hideModal(modal);
            }
        });
    });

    // Close buttons in modals
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            UIManager.hideModal(modal);
        });
    });

    // Install button
    document.getElementById('install-btn').addEventListener('click', () => {
        PWAManager.promptInstall();
    });

    // Update button
    document.getElementById('update-btn').addEventListener('click', () => {
        PWAManager.applyUpdate();
    });

    // Difficulty change
    DOM.difficulty.addEventListener('change', () => {
        gameState.difficulty = DOM.difficulty.value;
    });

    // Page visibility
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            StorageManager.saveGame();
        }
    });

    // Before unload
    window.addEventListener('beforeunload', () => {
        StorageManager.saveGame();
    });

    // Handle URL parameters for shortcuts
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('difficulty')) {
        const diff = urlParams.get('difficulty');
        if (CONFIG.DIFFICULTY[diff]) {
            gameState.difficulty = diff;
            DOM.difficulty.value = diff;
        }
    }
}

/**
 * Selects and focuses a cell
 */
function selectAndFocusCell(row, col) {
    GameController.selectCell(row, col);
    const index = row * 9 + col;
    DOM.board.children[index].focus();
}

// ===== INITIALIZATION =====
function init() {
    console.log('Initializing Sudoku Master...');

    // Cache DOM elements
    UIManager.cacheDOM();

    // Create board
    UIManager.createBoard();

    // Load preferences
    StorageManager.loadPreferences();
    UIManager.applyTheme(preferences.theme);

    // Load statistics
    StorageManager.loadStatistics();

    // Setup event listeners
    setupEventListeners();

    // Initialize PWA
    PWAManager.init();

    // Try to load saved game or start new
    if (!GameController.loadSavedGame()) {
        // Check URL params for difficulty
        const urlParams = new URLSearchParams(window.location.search);
        const diff = urlParams.get('difficulty') || 'medium';
        GameController.newGame(CONFIG.DIFFICULTY[diff] ? diff : 'medium', true);
    } else {
        GameController.startTimer();
        UIManager.showToast('Game restored!', 'success');
    }

    console.log('Sudoku Master initialized!');
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
