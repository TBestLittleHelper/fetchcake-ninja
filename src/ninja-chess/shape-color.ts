import type { DrawBrushes } from '@lichess-org/chessground/draw';

const SHAPE_COLOR_KEY = 'shapeColor';
const CUSTOM_BRUSH = 'custom';
const DEFAULT_COLOR = '#B0D9FF';

export function initShapeColor(brushes: DrawBrushes): void {
  const input = document.querySelector<HTMLInputElement>('#shapeColorInput');
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  input.value = loadColor();
  registerCustomBrush(brushes, input.value);

  input.addEventListener('input', () => registerCustomBrush(brushes, input.value));
}

export function getShapeColor(): string {
  return CUSTOM_BRUSH;
}

function registerCustomBrush(brushes: DrawBrushes, color: string): void {
  brushes[CUSTOM_BRUSH] = { key: CUSTOM_BRUSH, color, opacity: 1, lineWidth: 10 };
  try {
    localStorage.setItem(SHAPE_COLOR_KEY, color);
  } catch {
    console.error('Failed to save brush color to localStorage');
  }
}

function loadColor(): string {
  try {
    const stored = localStorage.getItem(SHAPE_COLOR_KEY);
    if (stored !== null && /^#[0-9a-fA-F]{6}$/.test(stored)) {
      return stored;
    }
  } catch {
  }
  return DEFAULT_COLOR;
}