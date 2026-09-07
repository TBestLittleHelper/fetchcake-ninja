import type { Puzzle, CupName } from './types';

const CupPuzzleLength = 30;

const puzzleCache: Partial<Record<CupName, Puzzle[]>> = {};

async function loadPuzzleData(cup: CupName): Promise<Puzzle[]> {
	switch (cup) {
		case 'camel':
			return (await import('../assets/camel.json')).default.puzzles as Puzzle[];
		case 'frog':
			return (await import('../assets/frog.json')).default.puzzles as Puzzle[];
		case 'mite':
			return (await import('../assets/mite.json')).default.puzzles as Puzzle[];
		case 'rhino':
			return (await import('../assets/rhino.json')).default.puzzles as Puzzle[];
		case 'fish':
		default:
			return (await import('../assets/fish.json')).default.puzzles as Puzzle[];
	}
}

export async function getPuzzleBatch(cup: CupName = 'fish') {
	if (!puzzleCache[cup]) {
		puzzleCache[cup] = await loadPuzzleData(cup);
	}

	const puzzleDatabase = puzzleCache[cup]!;
	const selected = new Set<number>();
	const puzzleDatabaseLength = puzzleDatabase.length;

	while (selected.size < CupPuzzleLength) {
		selected.add(Math.floor(Math.random() * puzzleDatabaseLength));
	}
	const indices = [...selected];
	return indices.map((index) => puzzleDatabase[index]);
}

export function getnbPuzzles() {
	return CupPuzzleLength;
}
