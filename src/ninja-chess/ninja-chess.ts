import './ninja-chess.css'
import './dialog.css'
import './chessground.base.css'
import './chessground.brown.css'
import './chessground.cburnett.css'
import '../assets/cssUtil/checkbox.css'

import { Chessground } from '@lichess-org/chessground';
import { uciToMove } from '@lichess-org/chessground/util';
import type { Config } from "@lichess-org/chessground/config";

import { Chess } from 'chessops/chess';
import { parseFen, makeFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';

import { PuzzleBatchSize, getPuzzleBatch } from './puzzle';
import { initSound, playSound, resumeAudioContext } from './sound';
import { initShapeColor, getShapeColor } from './shape-color';
import { showRunDialog } from './run-dialog';
import { openLeaderboard, loadRunHistory, saveRunHistory, clearRunHistory } from './leaderboard';
import type { Key } from '@lichess-org/chessground/types';
import type { Puzzle, PuzzleStats, CupName, GameState, LocalSavedRun } from './types';
import type { DrawShape } from '@lichess-org/chessground/draw';

initSound();

function openRun(record: LocalSavedRun): void {
  showRunDialog(record.puzzles, record.cup, record.stats, record.date);
}

const leaderboardButton = document.querySelector<HTMLButtonElement>('#leaderboardButton');
leaderboardButton?.addEventListener('click', () => openLeaderboard(openRun));

const COMPLETED_CUPS_KEY = 'completedCups';

const maxSquaresAttempt = 9;

const resetRunsButton = document.querySelector<HTMLButtonElement>('#resetRunsButton');

if (resetRunsButton) {
  resetRunsButton.addEventListener('click', () => {
    if (!confirm('Are you sure you want to permanently erase all run history?')) {
      return;
    }
    try {
      localStorage.removeItem(COMPLETED_CUPS_KEY);
      clearRunHistory();
    } catch {
      console.error('Failed to clear completed runs from localStorage');
    }
    completedCups.clear();
    cupButtons.forEach((button) => {
      button.classList.remove('completed');
    });
  });
}

const boardElement = document.querySelector<HTMLElement>('#board')
const progressElement = document.querySelector<HTMLProgressElement>("#ninjaGameProgress")

if (!boardElement || !progressElement) {
  throw new Error('Board or status element is missing from ninja-chess.html.')
}

progressElement.max = PuzzleBatchSize;

// Initialize game state
let selectedCup: CupName = 'fish';
let puzzleBatch: Puzzle[] = [];
puzzleBatch = await getPuzzleBatch(selectedCup);
const initialPuzzle = puzzleBatch[0];
const initialMoves = initialPuzzle.moves.split(" ")

const gameState: GameState = {
  solvedPuzzles: 0,
  currentPuzzle: initialPuzzle,
  currentPuzzleTotalSquares: 0,
  moves: initialMoves,
  moveUci: initialMoves[0],
  solution: initialMoves.slice(1),
  attemptSquares: [],
}


function loadPuzzle() {
  const setup = parseFen(gameState.currentPuzzle.fen).unwrap()
  const move = parseUci(gameState.moveUci)
  if (!move) {
    throw new Error(`Could not parse move: ${gameState.moveUci}`)
  }
  const chess = Chess.fromSetup(setup).unwrap()
  chess.play(move)
  const fen = makeFen(chess.toSetup())
  return { chess, fen }
}

function setPuzzle(index: number): void {
  gameState.currentPuzzle = puzzleBatch[index];
  gameState.currentPuzzleTotalSquares = 0;
  gameState.moves = gameState.currentPuzzle.moves.split(' ');
  gameState.moveUci = gameState.moves[0];
  gameState.solution = gameState.moves.slice(1);
  gameState.attemptSquares = [];
  const puzzle = loadPuzzle();
  ground.setShapes([]);
  ground.set({
    fen: puzzle.fen,
    orientation: puzzle.chess.turn,
    lastMove: uciToMove(gameState.moveUci),
  });
}


const addAttempt = (square: Key): void => {
  if (puzzleStartTime === 0) {
    puzzleStartTime = Date.now();
  }
  gameState.currentPuzzleTotalSquares++;
  gameState.attemptSquares.push(square);

  // Remove oldest attempts
  while (gameState.attemptSquares.length > maxSquaresAttempt) {
    gameState.attemptSquares.shift();
  }

  const updatedShapes: DrawShape[] = gameState.attemptSquares.map(sq => ({
    orig: sq,
    brush: getShapeColor(),
  }));

  ground.setShapes(updatedShapes);
};

const puzzle = loadPuzzle()

const config: Config = {
  coordinates: true,
  /*
   * viewOnly false lets chessground keep its own bounds cache updated on resize/scroll;
   * However, we actually don't want any user interactions, therefore we disable every
   * interaction the player could perform with other config options.
   */
  viewOnly: false,
  disableContextMenu: true,
  highlight: {
    lastMove: true,
  },
  fen: puzzle.fen,
  orientation: puzzle.chess.turn,
  lastMove: uciToMove(gameState.moveUci),
  movable: { color: undefined },
  draggable: { enabled: false },
  selectable: { enabled: false },
  premovable: { enabled: false },
  predroppable: { enabled: false },
  drawable: { enabled: false },
}
const ground = Chessground(boardElement, config)

initShapeColor(ground.state.drawable.brushes);

const cupButtons = Array.from(document.querySelectorAll<SVGSVGElement>('#cupContainer svg.cup-icon'));

const cupNames: CupName[] = ['fish', 'camel', 'frog', 'spider', 'rhino'];

const completedCups = loadCompletedCups();
const puzzleStats: PuzzleStats[] = [];
let puzzleStartTime = Date.now();

function loadCompletedCups(): Set<CupName> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(COMPLETED_CUPS_KEY) ?? '[]');
    if (!Array.isArray(stored)) {
      return new Set();
    }
    return new Set(stored.filter((cup): cup is CupName => cupNames.includes(cup as CupName)));
  } catch {
    return new Set();
  }
}

async function loadCup(cup: CupName) {
  selectedCup = cup;
  runActive = true;
  puzzleBatch = await getPuzzleBatch(selectedCup);
  cupButtons.forEach((button) => {
    button.classList.toggle('selected', button.dataset.cup === cup);
  });

  puzzleStats.length = 0;
  puzzleStartTime = 0;
  gameState.solvedPuzzles = 0;
  if (progressElement) {
    progressElement.value = 0;
  }
  setPuzzle(0);
}

for (const cupButton of cupButtons) {
  const cup = cupButton.dataset.cup as CupName | undefined;
  if (!cup) {
    continue;
  }

  if (completedCups.has(cup)) {
    cupButton.classList.add('completed');
  }

  cupButton.addEventListener('click', () => {
    void loadCup(cup);
  });
}

let lastSquare: Key | null = null
let runActive = true
const logSquareAtPos = (x: number, y: number) => {
  if (!runActive) {
    return
  }
  const square = ground.getKeyAtDomPos([x, y])
  if (!square || square === lastSquare) {
    return
  }
  lastSquare = square
  addAttempt(square)
  if (isSolved()) {
    playSound()
    puzzleStats.push({
      squares: gameState.currentPuzzleTotalSquares,
      time: (Date.now() - puzzleStartTime) / 1000,
    });
    gameState.solvedPuzzles++;
    progressElement.value = gameState.solvedPuzzles;
    console.log("Puzzle solved! nb solved puzzles:", gameState.solvedPuzzles)
    if (gameState.solvedPuzzles >= PuzzleBatchSize) {
      endRun();
      return;
    }
    nextPuzzle(gameState.solvedPuzzles)
  }
}

// Log square on touch down, mouse press or pen touch
boardElement.addEventListener('pointerdown', (event: PointerEvent) => {
  resumeAudioContext()
  logSquareAtPos(event.clientX, event.clientY)
})

// Log square on pointer move (mouse, touch or pen)
boardElement.addEventListener('pointermove', (event: PointerEvent) => {
  resumeAudioContext()
  logSquareAtPos(event.clientX, event.clientY)
})

function isSolved(): boolean {
  const move = uciToMove(gameState.solution[0]);
  // Solved when the player has both the start and the end square of the first move in the solution.
  // We only care about the first move being solved, in our game.
  return move !== undefined && move.every((square) => gameState.attemptSquares.includes(square));
}

function nextPuzzle(nextIndex: number): void {
  lastSquare = null;
  puzzleStartTime = Date.now();

  if (nextIndex >= puzzleBatch.length) {
    nextIndex = 0;
  }
  setPuzzle(nextIndex);

  console.log("Play " + gameState.solution[0].toString())
}

function endRun(): void {
  runActive = false;
  completedCups.add(selectedCup);
  try {
    localStorage.setItem(COMPLETED_CUPS_KEY, JSON.stringify([...completedCups]));
  } catch {
    console.error('Failed to save completed cups to localStorage');
  }
  const totalTime = puzzleStats.reduce((sum, s) => sum + s.time, 0);
  const totalSquares = puzzleStats.reduce((sum, s) => sum + s.squares, 0);
  const records = loadRunHistory();
  records.push({
    cup: selectedCup,
    time: totalTime,
    squares: totalSquares,
    date: new Date().toISOString(),
    puzzles: puzzleBatch,
    stats: puzzleStats,
  });
  saveRunHistory(records);
  const cupButton = cupButtons.find((button) => button.dataset.cup === selectedCup);
  cupButton?.classList.add('completed');
  showRunDialog(puzzleBatch, selectedCup, puzzleStats, new Date().toISOString());
};
