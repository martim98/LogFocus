"use client";

type SoundKind = "start" | "stop";
type SoundType = "bell" | "chime" | "none";

let audioContext: AudioContext | null = null;

function getContext() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!audioContext) {
    const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) {
      return null;
    }

    audioContext = new Context();
  }

  return audioContext;
}

export async function playSound(type: SoundType, kind: SoundKind = "start") {
  if (type === "none") {
    return;
  }

  const context = getContext();
  if (!context) {
    return;
  }

  await context.resume();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);

  const now = context.currentTime;
  const pattern =
    kind === "start"
      ? type === "bell"
        ? [
            [784, 0.08],
            [988, 0.1],
            [1174.66, 0.12],
          ]
        : [
            [523.25, 0.08],
            [659.25, 0.08],
            [783.99, 0.12],
          ]
      : type === "bell"
        ? [
            [880, 0.08],
            [659.25, 0.1],
            [523.25, 0.16],
          ]
        : [
            [392, 0.1],
            [311.13, 0.1],
            [261.63, 0.16],
          ];

  let cursor = now;
  for (const [frequency, duration] of pattern) {
    oscillator.frequency.setValueAtTime(frequency, cursor);
    gain.gain.setValueAtTime(0.0001, cursor);
    gain.gain.exponentialRampToValueAtTime(kind === "start" ? 0.18 : 0.14, cursor + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, cursor + duration);
    cursor += duration + 0.02;
  }

  oscillator.start(now);
  oscillator.stop(cursor + 0.02);
}
