"use client";

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!ctor) {
    return null;
  }
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new ctor();
  }
  return sharedAudioCtx;
}

export function playRestCompleteFeedback(params: {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}): void {
  if (params.hapticsEnabled && typeof navigator !== "undefined") {
    try {
      navigator.vibrate?.([120, 60, 120]);
    } catch {
      // ignore unsupported vibrate APIs
    }
  }

  if (!params.soundEnabled) {
    return;
  }

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const notes = [880, 1174.66]; // A5 -> D6 subtle clean chime

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.14;
      const duration = 0.22;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.14, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    });
  } catch {
    // ignore Web Audio restrictions
  }
}
