/** Browser-only helpers for the gym: end-of-rest alert and keeping the screen on. */

let audio: AudioContext | null = null;

/** Call from a user gesture (e.g. confirming a set) so iOS allows sound later. */
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    // No Web Audio: vibration only
  }
}

/** Three short beeps + vibration when a rest ends. */
export function restDoneAlert() {
  navigator.vibrate?.([200, 100, 200, 100, 400]);
  if (!audio) return;
  const t0 = audio.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = i === 2 ? 1320 : 880;
    gain.gain.setValueAtTime(0.0001, t0 + i * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.3 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.3 + 0.2);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0 + i * 0.3);
    osc.stop(t0 + i * 0.3 + 0.22);
  }
}

/** Keep the screen awake during a session. Returns a cleanup. */
export function keepScreenOn(): () => void {
  let lock: WakeLockSentinel | null = null;
  let cancelled = false;
  const acquire = async () => {
    try {
      if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
      lock = await navigator.wakeLock.request("screen");
      if (cancelled) void lock.release();
    } catch {
      // Denied or unsupported: not critical
    }
  };
  const onVisible = () => void acquire();
  void acquire();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    cancelled = true;
    document.removeEventListener("visibilitychange", onVisible);
    void lock?.release();
  };
}
