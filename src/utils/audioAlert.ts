// Web Audio API based alert sound player for new orders
// Plays a looping ringtone chime until stopped

let audioCtx: AudioContext | null = null;
let loopTimer: any = null;
let isLooping = false;
let isMuted = false;
let isAudioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Auto-unlock audio upon any user interaction on document
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state !== 'suspended') {
      isAudioUnlocked = true;
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
}

export function ensureAudioUnlocked() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().then(() => {
      isAudioUnlocked = true;
    }).catch(() => {});
  }
}

function doPlayTones(ctx: AudioContext) {
  try {
    const now = ctx.currentTime;

    // First tone (pleasant chime)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); // D6
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second tone (harmonic bell follow-up)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1318.51, now + 0.18); // E6
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.45); // A6
    gain2.gain.setValueAtTime(0.45, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.85);
  } catch (err) {
    console.warn('Audio alert playback error:', err);
  }
}

function playChimeBeep() {
  const ctx = getAudioContext();
  if (!ctx || isMuted) return;

  if (ctx.state === 'suspended') {
    ctx.resume().then(() => {
      doPlayTones(ctx);
    }).catch(() => {});
  } else {
    doPlayTones(ctx);
  }
}

export function startNewOrderAlarm() {
  isMuted = false;
  ensureAudioUnlocked();
  if (isLooping) return;
  isLooping = true;
  
  // Play immediately
  playChimeBeep();

  // Loop every 2.0 seconds until explicitly stopped
  if (loopTimer) clearInterval(loopTimer);
  loopTimer = setInterval(() => {
    if (isLooping) {
      playChimeBeep();
    } else {
      clearInterval(loopTimer);
    }
  }, 2000);
}

export function stopNewOrderAlarm() {
  isLooping = false;
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
}

export function isAlarmRunning(): boolean {
  return isLooping;
}

export function toggleMuteAlert(muted?: boolean) {
  if (muted !== undefined) {
    isMuted = muted;
  } else {
    isMuted = !isMuted;
  }
  if (isMuted) {
    stopNewOrderAlarm();
  }
  return isMuted;
}

export function isAlertMuted(): boolean {
  return isMuted;
}

export function previewAlertSound() {
  playChimeBeep();
}
