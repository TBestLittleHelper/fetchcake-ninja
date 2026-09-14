import { Chessground } from '@lichess-org/chessground'
import { uciToMove } from '@lichess-org/chessground/util'
import type { Config } from '@lichess-org/chessground/config'
import { Chess } from 'chessops/chess'
import { parseFen, makeFen } from 'chessops/fen'
import { parseUci } from 'chessops/util'
import type { Puzzle, PuzzleStats } from './types'

export function showRunDialog(puzzles: Puzzle[], cupName: string, stats: PuzzleStats[], date?: string): void {
  const dialog = document.querySelector<HTMLDialogElement>('#runDialog')!
  const [title, statsElement, dateElement, grid] = ['runDialogTitle', 'runDialogStats', 'runDialogDate', 'runDialogGrid']
    .map((id) => document.getElementById(id)!)

  const totalTime = stats.reduce((sum, s) => sum + s.time, 0)
  const totalSquares = stats.reduce((sum, s) => sum + s.squares, 0)

  title.textContent = `${cupName.charAt(0).toUpperCase()}${cupName.slice(1)} Cup Winner!`
  statsElement.textContent = `${totalSquares} squares in ${totalTime.toFixed(1)}s`
  dateElement.textContent = date ? new Date(date).toLocaleString() : ''
  grid.innerHTML = ''

  puzzles.forEach((puzzle, index) => {
    const puzzleEntry = document.createElement('div')
    puzzleEntry.className = 'runPuzzleCard'

    const puzzleLink = document.createElement('a')
    puzzleLink.className = 'runPuzzleNum'
    puzzleLink.textContent = `#${index + 1}`
    puzzleLink.href = puzzle.gameUrl
    puzzleLink.target = '_blank'
    puzzleLink.rel = 'noopener noreferrer'

    const boardContainer = document.createElement('div')
    boardContainer.className = 'runBoard'

    const firstMove = puzzle.moves.split(' ')[0]
    const move = parseUci(firstMove)!

    const setup = parseFen(puzzle.fen).unwrap()
    const chess = Chess.fromSetup(setup).unwrap()
    chess.play(move)

    const fen = makeFen(chess.toSetup())

    const config: Config = {
      coordinates: false,
      viewOnly: true,
      disableContextMenu: true,
      fen,
      orientation: chess.turn,
      lastMove: uciToMove(firstMove),
    }

    Chessground(boardContainer, config)

    const stat = stats[index]
    const puzzleStatLabel = document.createElement('span')
    puzzleStatLabel.className = 'runPuzzleStat'
    puzzleStatLabel.textContent = stat
      ? `${stat.squares} squares in ${Math.round(stat.time)}s`
      : '—'

    puzzleEntry.appendChild(puzzleLink)
    puzzleEntry.appendChild(boardContainer)
    puzzleEntry.appendChild(puzzleStatLabel)
    grid.appendChild(puzzleEntry)
  })

  dialog.showModal()
}
