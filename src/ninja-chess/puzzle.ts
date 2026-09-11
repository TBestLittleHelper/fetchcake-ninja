import type { Puzzle, CupName } from './types';

export const PuzzleBatchSize = 30;
const BatchesPerCup = 3;

const puzzleCache: Partial<Record<string, Puzzle[]>> = {};

async function loadPuzzleData(cup: CupName, batch: number): Promise<Puzzle[]> {
	const cacheKey = `${cup}-${batch}`;
	if (puzzleCache[cacheKey]) {
		return puzzleCache[cacheKey]!;
	}

	const puzzles = (await import(`../assets/${cup}-${batch}.json`)).default.puzzles as Puzzle[];

	puzzleCache[cacheKey] = puzzles;
	return puzzles;
}

export async function getPuzzleBatch(cup: CupName = 'fish') {
	const batch = Math.floor(Math.random() * BatchesPerCup) + 1;
	const puzzleDatabase = await loadPuzzleData(cup, batch);
	const selected = new Set<number>();

	while (selected.size < PuzzleBatchSize) {
		selected.add(Math.floor(Math.random() * puzzleDatabase.length));
	}
	return [...selected].map((index) => puzzleDatabase[index]);
}
