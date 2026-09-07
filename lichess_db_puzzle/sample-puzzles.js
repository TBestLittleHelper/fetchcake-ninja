#!/usr/bin/env node

import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { Chess } from 'chessops';
import { parseFen } from 'chessops/fen';

const inputFile = path.join('lichess_db_puzzle', 'lichess_db_puzzle.csv');
const outputDirectory = path.join('src', 'assets');
const numberOfPuzzles = 300;

export const cupFilters = {
	fish: { rating: 1200, maxRating: 1400, nbPlays: 10000, popularity: 80 },
	camel: { rating: 1400, maxRating: 1600, nbPlays: 10000, popularity: 80 },
	frog: { rating: 1600, maxRating: 1800, nbPlays: 10000, popularity: 80 },
	mite: { rating: 1800, maxRating: 2000, nbPlays: 10000, popularity: 80 },
	rhino: { rating: 2000, maxRating: 3000, nbPlays: 10000, popularity: 80 },
};

function matchesCupFilters(puzzle, filter) {
	return puzzle.rating >= filter.rating
		&& puzzle.rating < filter.maxRating
		&& puzzle.nbPlays >= filter.nbPlays
		&& puzzle.popularity >= filter.popularity;
}

function filterPuzzlesForCup(puzzles, filter) {
	return puzzles.filter((puzzle) => matchesCupFilters(puzzle, filter));
}

async function samplePuzzles() {
	const puzzlesByCup = Object.fromEntries(
		Object.keys(cupFilters).map((cupName) => [cupName, []]),
	);
	let headerLine = null;

	const fileStream = fs.createReadStream(inputFile);
	const rl = readline.createInterface({
		input: fileStream,
	});

	console.log('Reading and filtering puzzles...');

	for await (const line of rl) {
		if (headerLine === null) {
			headerLine = line;
			continue;
		}

		const parts = line.split(',');
		if (parts.length < 7) continue;

		try {
			const puzzleId = parts[0];
			const fen = parts[1];
			const moves = parts[2];
			const rating = parseInt(parts[3], 10);
			const ratingDeviation = parseInt(parts[4], 10);
			const popularity = parseInt(parts[5], 10);
			const nbPlays = parseInt(parts[6], 10);
			const themes = parts[7] || '';
			const gameUrl = parts[8] || '';
			const openingTags = parts[9] || '';

			const puzzle = {
				puzzleId,
				fen,
				moves,
				rating,
				ratingDeviation,
				popularity,
				nbPlays,
				themes,
				gameUrl,
				openingTags,
			};

			const setup = parseFen(fen).unwrap();
			const chess = Chess.fromSetup(setup).unwrap();
			if (chess.turn === 'white') {
				continue;
			}

			for (const [cupName, filter] of Object.entries(cupFilters)) {
				if (matchesCupFilters(puzzle, filter)) {
					puzzlesByCup[cupName].push(puzzle);
				}
			}
		} catch {
			continue;
		}
	}

	fs.mkdirSync(outputDirectory, { recursive: true });

	for (const [cupName, puzzles] of Object.entries(puzzlesByCup)) {
		const topPuzzles = puzzles
			.sort((a, b) => b.popularity - a.popularity)
			.slice(0, numberOfPuzzles);

		const outputFile = path.join(outputDirectory, `${cupName}.json`);
		const jsonOutput = JSON.stringify({ puzzles: topPuzzles }, null, 2);
		fs.writeFileSync(outputFile, jsonOutput);
		console.log(`Wrote ${topPuzzles.length} puzzles to ${outputFile}`);
	}
}

samplePuzzles().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
