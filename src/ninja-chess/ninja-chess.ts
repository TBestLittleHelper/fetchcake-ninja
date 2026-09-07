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

import { getnbPuzzles, getPuzzleBatch } from './puzzle';
import { fetchLichessPuzzles } from './lichess-puzzles';
import type { Difficulty } from './lichess-puzzles';
import { initSound, playSound, resumeAudioContext } from './sound';
import { showWinDialog } from './win-dialog';
import type { Key } from '@lichess-org/chessground/types';
import type { Puzzle, PuzzleStats, CupName, GameState } from './types';
import type { DrawShape } from '@lichess-org/chessground/draw';

initSound();

const nbPuzzles = getnbPuzzles();
const maxSquaresAttempt = 9;

const puzzlesToggle = document.querySelector<HTMLInputElement>('#puzzlesToggle');

function loadPuzzlesEnabled(): boolean {
  try {
    return localStorage.getItem('lichessPuzzles') === 'true';
  } catch {
    return false;
  }
}

if (puzzlesToggle) {
  puzzlesToggle.checked = loadPuzzlesEnabled();
  puzzlesToggle.addEventListener('change', () => {
    try {
      localStorage.setItem('lichessPuzzles', puzzlesToggle.checked.toString());
    } catch {
      console.error('Failed to save lichessPuzzles to localStorage');
    }
  });
}

function isLichessEnabled(): boolean {
  return puzzlesToggle?.checked ?? false;
}

function fenFromPgn(pgn: string, initialPly: number): string {
  const moves = pgn.split(' ');
  const chess = Chess.default();
  for (let i = 0; i <= initialPly && i < moves.length; i++) {
    const move = parseSan(chess, moves[i]);
    if (!move) break;
    chess.play(move);
  }
  return makeFen(chess.toSetup());
}

async function fetchPuzzles(cup: CupName): Promise<Puzzle[]> {
  if (isLichessEnabled()) {
    const difficultyMap: Record<CupName, Difficulty> = {
      fish: 'easiest',
      camel: 'easier',
      frog: 'normal',
      mite: 'harder',
      rhino: 'hardest',
    };
    const batch = await fetchLichessPuzzles(nbPuzzles as 10 | 20 | 30 | 40 | 50, difficultyMap[cup]);
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

progressElement.max = nbPuzzles;

// Initialize game state
let selectedCup: CupName = 'fish';
let puzzleBatch: Puzzle[] = [];
puzzleBatch = await getPuzzleBatch(selectedCup);
const initialPuzzle = puzzleBatch[0];
const initialMoves = initialPuzzle.moves.split(" ")

const gamestate: GameState = {
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
  const setup = parseFen(gamestate.currentPuzzle.fen).unwrap()
  const move = parseUci(gamestate.moveUci)
  if (!move) {
    throw new Error(`Could not parse move: ${gamestate.moveUci}`)
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
  gamestate.currentPuzzleTotalSquares++;
  gamestate.attemptSquares.push(square);

  // Remove oldest attempts
  while (gamestate.attemptSquares.length > maxSquaresAttempt) {
    gamestate.attemptSquares.shift();
  }

  const updatedShapes: DrawShape[] = gamestate.attemptSquares.map(sq => ({
    orig: sq,
    brush: 'paleBlue',
  }));

  ground.setShapes(updatedShapes);
};

const puzzle = loadPuzzle()

gamestate.status = "Playing"

const config: Config = {
  coordinates: true,
  viewOnly: true,
  disableContextMenu: true,
  highlight: {
    lastMove: true,
  },
  fen: puzzle.fen,
  orientation: puzzle.chess.turn,
  lastMove: [gamestate.moveUci.substring(0, 2), gamestate.moveUci.substring(2, 4)] as Key[]

}
const ground = Chessground(boardElement, config)
ground.set(config)

// Initialize Ninja Chess page
const container = document.querySelector<HTMLElement>('#ninjaChessContainer')

if (!container) {
  throw new Error('Ninja Chess markup is missing from ninja-chess.html.')
}

const cupButtons = Array.from(document.querySelectorAll<SVGSVGElement>('#cupContainer svg.cup-icon'));

const cupNames: CupName[] = ['fish', 'camel', 'frog', 'mite', 'rhino'];

const completedCups = loadCompletedCups();
const puzzleStats: PuzzleStats[] = [];
let puzzleStartTime = Date.now();

function loadCompletedCups(): Set<CupName> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem('completedCups') ?? '[]');
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
  gamestate.solvedPuzzles = 0;
  gamestate.currentPuzzle = puzzleBatch[0];
  gamestate.currentPuzzleTotalSquares = 0;
  gamestate.moves = gamestate.currentPuzzle.moves.split(' ');
  gamestate.moveUci = gamestate.moves[0];
  gamestate.solution = gamestate.moves.slice(1);
  gamestate.attemptSquares = [];
  gamestate.status = 'Playing';
  if (progressElement) {
    progressElement.value = 0;
  }

  const puzzle = loadPuzzle();
  ground.setShapes([]);
  ground.set({
    fen: puzzle.fen,
    orientation: puzzle.chess.turn,
    lastMove: [gamestate.moveUci.substring(0, 2), gamestate.moveUci.substring(2, 4)] as Key[],
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
      squares: gamestate.currentPuzzleTotalSquares,
      time: (Date.now() - puzzleStartTime) / 1000,
    });
    gamestate.solvedPuzzles++;
    progressElement.value = gamestate.solvedPuzzles;
    console.log("Puzzle solved! nb solved puzzles:", gamestate.solvedPuzzles)
    if (gamestate.solvedPuzzles >= nbPuzzles) {
      endGame();
      return;
    }
    nextPuzzle(puzzleBatch, gamestate.solvedPuzzles)
  }
}

// Log square on pointermove ( mouse, touch or pen )
boardElement.addEventListener('pointermove', (event: PointerEvent) => {
  resumeAudioContext()
  logSquareAtPos(event.clientX, event.clientY)
})

function isSolved(): boolean {
  if (gamestate.solution.length === 0) return false;

  // Get first move and convert to squares
  const firstMove = gamestate.solution[0];
  const fromSquare = firstMove.substring(0, 2) as Key;
  const toSquare = firstMove.substring(2, 4) as Key;

  // Check if attempt matches the two squares from the first move
  if (gamestate.attemptSquares.includes(fromSquare) && gamestate.attemptSquares.includes(toSquare)) {
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
  gamestate.currentPuzzle = puzzleBatch[nextIndex];
  gamestate.currentPuzzleTotalSquares = 0;
  gamestate.moves = gamestate.currentPuzzle.moves.split(" ");
  gamestate.moveUci = gamestate.moves[0]
  gamestate.solution = gamestate.moves.slice(1)
  gamestate.attemptSquares = []

  const puzzle = loadPuzzle()

  console.log("Play " + gamestate.solution[0].toString())

  ground.setShapes([]);
  ground.set({
    fen: puzzle.fen,
    orientation: puzzle.chess.turn,
    lastMove: [gamestate.moveUci.substring(0, 2),
    gamestate.moveUci.substring(2, 4)] as Key[]
  })
}

function endGame(): void {
  completedCups.add(selectedCup);
  try {
    localStorage.setItem('completedCups', JSON.stringify([...completedCups]));
  } catch {
  }
  const cupButton = cupButtons.find((button) => button.dataset.cup === selectedCup);
  cupButton?.classList.add('completed');
  showWinDialog(puzzleBatch, selectedCup, puzzleStats);
};
