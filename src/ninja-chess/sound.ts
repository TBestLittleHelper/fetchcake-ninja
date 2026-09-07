const soundUrl = "./sound/chessClock.m4a";

let soundBuffer: AudioBuffer | null = null;
let audioContext: AudioContext | null = null;
let soundEnabled = true;

function getAudioContext(): AudioContext | null {
  if (audioContext === null) {
    try {
      audioContext = new AudioContext();
    } catch {
      console.error('Could not create AudioContext');
      return null;
    }
  }
  return audioContext;
}

async function loadSoundBuffer() {
  const context = getAudioContext();
  if (!context) {
    return;
  }
  try {
    const response = await fetch(soundUrl);
    const arrayBuffer = await response.arrayBuffer();
    soundBuffer = await context.decodeAudioData(arrayBuffer);
  } catch {
    soundBuffer = null;
    console.error('Failed to load sound buffer');
  }
}

function loadSoundEnabled(): boolean {
  try {
    return localStorage.getItem('soundEnabled') !== 'false';
  } catch {
    return true;
  }
}

export function initSound() {
  soundEnabled = loadSoundEnabled();

  const soundToggle = document.querySelector('#soundToggle');
  if (soundToggle instanceof HTMLInputElement) {
    soundToggle.checked = soundEnabled;
    soundToggle.addEventListener('change', () => {
      soundEnabled = soundToggle.checked;
      try {
        localStorage.setItem('soundEnabled', soundEnabled.toString());
      } catch {
        console.error('Failed to save soundEnabled to localStorage');
      }
    });
  }

  void loadSoundBuffer();
}

export function resumeAudioContext() {
  const context = getAudioContext();
  if (context && context.state === 'suspended') {
    void context.resume();
  }
}

export function playSound() {
  if (!soundEnabled) {
    return;
  }
  const context = getAudioContext();
  if (!soundBuffer || !context) {
    return;
  }
  if (context.state === 'suspended') {
    void context.resume();
  }
  const source = context.createBufferSource();
  source.buffer = soundBuffer;
  source.connect(context.destination);
  source.start();
}
