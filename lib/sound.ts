"use client";

type SoundKind = "start" | "stop" | "focus75" | "rawFocusDone" | "billableDone" | "finishSlip" | "idle" | "breakRecommended";
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
  const pattern = getSoundPattern(type, kind);

  let cursor = now;
  for (const [frequency, duration] of pattern) {
    oscillator.frequency.setValueAtTime(frequency, cursor);
    gain.gain.setValueAtTime(0.0001, cursor);
    gain.gain.exponentialRampToValueAtTime(kind === "finishSlip" || kind === "idle" ? 0.1 : kind === "start" ? 0.18 : 0.14, cursor + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, cursor + duration);
    cursor += duration + 0.02;
  }

  oscillator.start(now);
  oscillator.stop(cursor + 0.02);
}

function getSoundPattern(type: Exclude<SoundType, "none">, kind: SoundKind): Array<[number, number]> {
  const patterns: Record<SoundKind, { bell: Array<[number, number]>; chime: Array<[number, number]> }> = {
    start: {
      bell: [[784, 0.08], [988, 0.1], [1174.66, 0.12]],
      chime: [[523.25, 0.08], [659.25, 0.08], [783.99, 0.12]],
    },
    stop: {
      bell: [[880, 0.08], [659.25, 0.1], [523.25, 0.16]],
      chime: [[392, 0.1], [311.13, 0.1], [261.63, 0.16]],
    },
    focus75: {
      bell: [[659.25, 0.07], [783.99, 0.08]],
      chime: [[523.25, 0.08], [659.25, 0.1]],
    },
    rawFocusDone: {
      bell: [[783.99, 0.08], [987.77, 0.08], [1318.51, 0.14]],
      chime: [[659.25, 0.08], [783.99, 0.08], [1046.5, 0.14]],
    },
    billableDone: {
      bell: [[587.33, 0.08], [880, 0.08], [1174.66, 0.14]],
      chime: [[440, 0.08], [659.25, 0.08], [880, 0.14]],
    },
    finishSlip: {
      bell: [[523.25, 0.12], [493.88, 0.14]],
      chime: [[392, 0.12], [369.99, 0.14]],
    },
    idle: {
      bell: [[440, 0.08], [440, 0.08]],
      chime: [[329.63, 0.08], [392, 0.08]],
    },
    breakRecommended: {
      bell: [[659.25, 0.1], [523.25, 0.14]],
      chime: [[523.25, 0.1], [392, 0.14]],
    },
  };

  return patterns[kind][type];
}
