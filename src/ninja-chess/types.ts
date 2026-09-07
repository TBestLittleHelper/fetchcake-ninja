import type { Key } from '@lichess-org/chessground/types';

export type CupName = 'fish' | 'camel' | 'frog' | 'mite' | 'rhino';

export type PuzzleID = string;

export interface Puzzle {
	puzzleId: PuzzleID;
	fen: string;
	moves: string;
	rating: number;
	ratingDeviation: number;
	popularity: number;
	nbPlays: number;
	themes: string;
	gameUrl: string;
	openingTags: string;
}

export interface PuzzleStats {
	squares: number;
	time: number;
}

export interface GameState {
	solvedPuzzles: number;
	currentPuzzle: Puzzle;
	currentPuzzleTotalSquares: number;
	moves: string[];
	moveUci: string;
	solution: string[];
	attemptSquares: Key[];
	status: string;
}
