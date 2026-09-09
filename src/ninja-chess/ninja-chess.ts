import './ninja-chess.css'
import './dialog.css'
import './chessground.base.css'
import './chessground.brown.css'
import './chessground.cburnett.css'
import '../assets/cssUtil/checkbox.css'

import { Chessground } from '@lichess-org/chessground';
import type { Config } from "@lichess-org/chessground/config";

import { Chess } from 'chessops/chess';
import { parseFen, makeFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';
import { parseSan } from 'chessops/san';

import { PuzzleBatchSize, getPuzzleBatch } from './puzzle';
import { fetchLichessPuzzles } from './lichess-puzzles';
import type { Difficulty } from './lichess-puzzles';
import { initSound, playSound, resumeAudioContext } from './sound';
import { showRunDialog } from './run-dialog';
import { openLeaderboard, loadRunHistory, saveRunHistory, clearRunHistory } from './leaderboard';
import type { Key } from '@lichess-org/chessground/types';
import type { Puzzle, PuzzleStats, CupName, GameState, LocalSavedRun } from './types';
import type { DrawShape } from '@lichess-org/chessground/draw';

initSound();

function openRun(record: LocalSavedRun): void {
  showRunDialog(record.puzzles, record.cup, record.stats, record.date, record.isLichessAPI);
}

const leaderboardButton = document.querySelector<HTMLButtonElement>('#leaderboardButton');
leaderboardButton?.addEventListener('click', () => openLeaderboard(openRun));

const COMPLETED_CUPS_KEY = 'completedCups';
const LICHESS_PUZZLES_KEY = 'lichessPuzzles';

const maxSquaresAttempt = 9;

const puzzlesToggle = document.querySelector<HTMLInputElement>('#puzzlesToggle');

function loadPuzzlesEnabled(): boolean {
  try {
    return localStorage.getItem(LICHESS_PUZZLES_KEY) === 'true';
  } catch {
    return false;
  }
}

if (puzzlesToggle) {
  puzzlesToggle.checked = loadPuzzlesEnabled();
  puzzlesToggle.addEventListener('change', () => {
    try {
      localStorage.setItem(LICHESS_PUZZLES_KEY, puzzlesToggle.checked.toString());
    } catch {
      console.error('Failed to save lichessPuzzles to localStorage');
    }
  });
}

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

function isLichessEnabled(): boolean {
  return puzzlesToggle?.checked ?? false;
}

function fenFromPgn(pgn: string, initialPly: number): string {
  const moves = pgn.split(' ');
  const chess = Chess.default();
  const move = parseSan(chess, moves[initialPly]);
  if (!move) {
    throw new Error(`Could not parse move: ${moves[initialPly]}`);
  }

  chess.play(move);
  return makeFen(chess.toSetup());
}

async function fetchPuzzles(cup: CupName): Promise<Puzzle[]> {
  if (isLichessEnabled()) {
    const difficultyMap: Record<CupName, Difficulty> = {
      fish: 'easiest',
      camel: 'easier',
      frog: 'normal',
      spider: 'harder',
      rhino: 'hardest',
    };
    const batch = await fetchLichessPuzzles({ difficulty: difficultyMap[cup] });
    return batch.puzzles.map(entry => ({
      puzzleId: entry.puzzle.id,
      fen: fenFromPgn(entry.game.pgn, entry.puzzle.initialPly),
      moves: entry.puzzle.solution.join(' '),
      rating: entry.puzzle.rating,
      ratingDeviation: 0,
      popularity: 0,
      nbPlays: entry.puzzle.plays,
      themes: entry.puzzle.themes.join(' '),
      gameUrl: '',
      openingTags: '',
    }));
  }
  return getPuzzleBatch(cup);
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
  status: ''
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
    brush: 'paleBlue',
  }));

  ground.setShapes(updatedShapes);
};

const puzzle = loadPuzzle()

gameState.status = "Playing"

const config: Config = {
  coordinates: true,
  viewOnly: true,
  disableContextMenu: true,
  highlight: {
    lastMove: true,
  },
  fen: puzzle.fen,
  orientation: puzzle.chess.turn,
  lastMove: [gameState.moveUci.substring(0, 2), gameState.moveUci.substring(2, 4)] as Key[]

}
const ground = Chessground(boardElement, config)
ground.set(config)

// Initialize Ninja Chess page
const container = document.querySelector<HTMLElement>('#ninjaChessContainer')

if (!container) {
  throw new Error('Ninja Chess markup is missing from ninja-chess.html.')
}

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
  puzzleBatch = await fetchPuzzles(selectedCup);
  cupButtons.forEach((button) => {
    button.classList.toggle('selected', button.dataset.cup === cup);
  });

  puzzleStats.length = 0;
  puzzleStartTime = 0;
  gameState.solvedPuzzles = 0;
  gameState.currentPuzzle = puzzleBatch[0];
  gameState.currentPuzzleTotalSquares = 0;
  gameState.moves = gameState.currentPuzzle.moves.split(' ');
  gameState.moveUci = gameState.moves[0];
  gameState.solution = gameState.moves.slice(1);
  gameState.attemptSquares = [];
  gameState.status = 'Playing';
  if (progressElement) {
    progressElement.value = 0;
  }

  const puzzle = loadPuzzle();
  ground.setShapes([]);
  ground.set({
    fen: puzzle.fen,
    orientation: puzzle.chess.turn,
    lastMove: [gameState.moveUci.substring(0, 2), gameState.moveUci.substring(2, 4)] as Key[],
  });
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
const logSquareAtPos = (x: number, y: number) => {
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
    nextPuzzle(puzzleBatch, gameState.solvedPuzzles)
  }
}

// Log square on pointermove ( mouse, touch or pen )
boardElement.addEventListener('pointermove', (event: PointerEvent) => {
  resumeAudioContext()
  logSquareAtPos(event.clientX, event.clientY)
})

function isSolved(): boolean {
  if (gameState.solution.length === 0) return false;

  // Get first move and convert to squares
  const firstMove = gameState.solution[0];
  const fromSquare = firstMove.substring(0, 2) as Key;
  const toSquare = firstMove.substring(2, 4) as Key;

  // Check if attempt matches the two squares from the first move
  if (gameState.attemptSquares.includes(fromSquare) && gameState.attemptSquares.includes(toSquare)) {
    return true;
  }

  return false;
}

function nextPuzzle(puzzleBatch: Puzzle[], nextIndex: number): void {
  lastSquare = null;
  puzzleStartTime = Date.now();

  if (nextIndex >= puzzleBatch.length) {
    nextIndex = 0;
  }
  gameState.currentPuzzle = puzzleBatch[nextIndex];
  gameState.currentPuzzleTotalSquares = 0;
  gameState.moves = gameState.currentPuzzle.moves.split(" ");
  gameState.moveUci = gameState.moves[0]
  gameState.solution = gameState.moves.slice(1)
  gameState.attemptSquares = []

  const puzzle = loadPuzzle()

  console.log("Play " + gameState.solution[0].toString())

  ground.setShapes([]);
  ground.set({
    fen: puzzle.fen,
    orientation: puzzle.chess.turn,
    lastMove: [gameState.moveUci.substring(0, 2),
    gameState.moveUci.substring(2, 4)] as Key[]
  })
}

function endRun(): void {
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
    isLichessAPI: isLichessEnabled(),
  });
  saveRunHistory(records);
  const cupButton = cupButtons.find((button) => button.dataset.cup === selectedCup);
  cupButton?.classList.add('completed');
  showRunDialog(puzzleBatch, selectedCup, puzzleStats, new Date().toISOString(), isLichessEnabled());
};
