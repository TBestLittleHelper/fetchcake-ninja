import { PuzzleBatchSize } from './puzzle';

const API_URL = 'https://lichess.org/api/puzzle/batch';

export type Difficulty = 'easiest' | 'easier' | 'normal' | 'harder' | 'hardest';

export interface LichessPuzzleData {
  id: string;
  initialPly: number;
  plays: number;
  rating: number;
  fen: string;
  lastMove: string;
  solution: string[];
  themes: string[];
}

export interface LichessGame {
  clock: string;
  id: string;
  perf: { key: string; name: string };
  pgn: string;
  players: { color: string; id: string; name: string; rating: number }[];
  rated: boolean;
}

export interface LichessPuzzleAndGame {
  game: LichessGame;
  puzzle: LichessPuzzleData;
}

export interface LichessPuzzleBatch {
  puzzles: LichessPuzzleAndGame[];
}

export async function fetchLichessPuzzles(
  { difficulty }: { difficulty: Difficulty }
): Promise<LichessPuzzleBatch> {
  const url = `${API_URL}/mix?=${PuzzleBatchSize}&difficulty=${difficulty}`;
  const response = await fetch(url);
  if (!response.ok) {
    alert("Failed to call Lichess API. Turn off the API option in settings to play locally");
    throw new Error(`Failed to fetch puzzles: ${response.status}`);
  }
  return response.json();
}
