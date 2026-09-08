import type { CupName, RunRecord, LocalSavedRun } from './types';

const RUN_HISTORY_KEY = 'runHistory';
let onOpenRun: (record: LocalSavedRun) => void = () => { };
let initialized = false;

function isSavedRun(record: unknown): record is LocalSavedRun {
  if (typeof record !== 'object' || record === null) {
    return false;
  }
  const candidate = record as Record<string, unknown>;
  return (
    typeof candidate.cup === 'string' &&
    typeof candidate.time === 'number' &&
    typeof candidate.squares === 'number' &&
    typeof candidate.date === 'string' &&
    Array.isArray(candidate.puzzles) &&
    Array.isArray(candidate.stats) &&
    typeof candidate.isLichess === 'boolean'
  );
}

export function loadRunHistory(): LocalSavedRun[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(RUN_HISTORY_KEY) ?? '[]');
    if (!Array.isArray(stored)) {
      return [];
    }
    return stored.filter(isSavedRun);
  } catch {
    return [];
  }
}

export function saveRunHistory(records: LocalSavedRun[]): void {
  try {
    localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(records));
  } catch {
    console.error('Failed to save run history to localStorage');
  }
}

export function clearRunHistory(): void {
  try {
    localStorage.removeItem(RUN_HISTORY_KEY);
  } catch {
    console.error('Failed to clear run history from localStorage');
  }
}

function displayCupName(cup: CupName): string {
  return cup.charAt(0).toUpperCase() + cup.slice(1);
}

const authorRecords: RunRecord[] = [
  { cup: 'fish', time: 32.4, squares: 102 },
  { cup: 'camel', time: 68.1, squares: 475 },
  { cup: 'frog', time: 38.7, squares: 115 },
  { cup: 'spider', time: 33.9, squares: 87 },
  { cup: 'rhino', time: 39.2, squares: 121 },
];

const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.leaderboardTab'));
const leaderboardHead = document.querySelector<HTMLTableRowElement>('#leaderboardHead');
const leaderboardBody = document.querySelector<HTMLTableSectionElement>('#leaderboardBody');

function setLeaderboardHeaders(headers: string[]): void {
  if (!leaderboardHead) {
    return;
  }
  const row = document.createElement('tr');
  for (const header of headers) {
    const th = document.createElement('th');
    th.textContent = header;
    row.appendChild(th);
  }
  leaderboardHead.replaceChildren(row);
}

function renderAuthorRecords(): void {
  if (!leaderboardBody) {
    return;
  }
  setLeaderboardHeaders(['Cup', 'Time', 'Squares']);
  leaderboardBody.innerHTML = '';
  for (const record of authorRecords) {
    const row = document.createElement('tr');
    const cup = document.createElement('td');
    cup.textContent = displayCupName(record.cup);
    const time = document.createElement('td');
    time.textContent = `${record.time.toFixed(1)}s`;
    const squares = document.createElement('td');
    squares.textContent = record.squares.toString();
    row.append(cup, time, squares);
    leaderboardBody.appendChild(row);
  }
}

function renderRunHistory(): void {
  if (!leaderboardBody) {
    return;
  }
  setLeaderboardHeaders(['Cup', 'Time', 'Squares', 'Date']);
  const records = loadRunHistory();
  leaderboardBody.innerHTML = '';
  if (records.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = 'No completed runs yet';
    row.appendChild(cell);
    leaderboardBody.appendChild(row);
    return;
  }
  for (const record of records) {
    const row = document.createElement('tr');
    row.classList.add('runRow');
    row.title = `Open ${displayCupName(record.cup)} run recap`;
    row.addEventListener('click', () => onOpenRun(record));
    const cup = document.createElement('td');
    cup.textContent = displayCupName(record.cup);
    const time = document.createElement('td');
    time.textContent = `${record.time.toFixed(1)}s`;
    const squares = document.createElement('td');
    squares.textContent = record.squares.toString();
    const date = document.createElement('td');
    date.textContent = new Date(record.date).toLocaleDateString();
    row.append(cup, time, squares, date);
    leaderboardBody.appendChild(row);
  }
}

function selectLeaderboardTab(tab: string): void {
  tabButtons.forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active.toString());
  });
  rerenderLeaderboard();
}

function rerenderLeaderboard(): void {
  const activeTab = tabButtons.find((button) => button.classList.contains('active'))?.dataset.tab ?? 'author';
  if (activeTab === 'history') {
    renderRunHistory();
  } else {
    renderAuthorRecords();
  }
}

export function openLeaderboard(onRunOpen: (record: LocalSavedRun) => void): void {
  if (!initialized) {
    initialized = true;
    onOpenRun = onRunOpen;
    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        selectLeaderboardTab(button.dataset.tab ?? 'author');
      });
    });
    selectLeaderboardTab('author');
    return;
  }
  rerenderLeaderboard();
}
