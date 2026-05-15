import type { DayCoachMemory } from "@/lib/analytics";

const COACH_DISPATCH_STORAGE_KEY = "logfocus.coachDispatchedCues";
const COACH_DISPATCH_KEY_LIMIT = 50;

export type CoachDispatchStore = Pick<Storage, "getItem" | "setItem">;

export type CoachDispatchLedger = {
  dateKey: string;
  keys: string[];
};

export function getCoachCueDispatchKey(evaluation: {
  cueEvent: string | null;
  spokenMessage: string | null;
  memory: DayCoachMemory;
}) {
  if (!evaluation.cueEvent) return null;
  return [
    evaluation.memory.dateKey,
    evaluation.cueEvent,
    evaluation.memory.lastCueAtMs ?? "no-time",
    evaluation.spokenMessage ?? "no-message",
  ].join("::");
}

export function createCoachDispatchGate(memoryKeys = new Set<string>()) {
  let runtimeDateKey: string | null = null;

  return {
    shouldDispatch(params: {
      dateKey: string;
      dispatchKey: string | null;
      storage?: CoachDispatchStore | null;
    }) {
      const { dateKey, dispatchKey, storage } = params;
      if (!dispatchKey) return false;

      if (runtimeDateKey !== dateKey) {
        memoryKeys.clear();
        runtimeDateKey = dateKey;
      }

      const ledger = readCoachDispatchLedger(storage, dateKey);
      if (memoryKeys.has(dispatchKey) || ledger.keys.includes(dispatchKey)) {
        return false;
      }

      memoryKeys.add(dispatchKey);
      writeCoachDispatchLedger(storage, {
        dateKey,
        keys: [...ledger.keys, dispatchKey].slice(-COACH_DISPATCH_KEY_LIMIT),
      });
      return true;
    },
    _memoryKeys: memoryKeys,
  };
}

export function readCoachDispatchLedger(storage: CoachDispatchStore | null | undefined, dateKey: string): CoachDispatchLedger {
  if (!storage) return { dateKey, keys: [] };

  try {
    const raw = storage.getItem(COACH_DISPATCH_STORAGE_KEY);
    if (!raw) return { dateKey, keys: [] };

    const parsed = JSON.parse(raw) as Partial<CoachDispatchLedger>;
    if (parsed.dateKey !== dateKey || !Array.isArray(parsed.keys)) {
      return { dateKey, keys: [] };
    }

    return {
      dateKey,
      keys: parsed.keys.filter((key): key is string => typeof key === "string").slice(-COACH_DISPATCH_KEY_LIMIT),
    };
  } catch {
    return { dateKey, keys: [] };
  }
}

function writeCoachDispatchLedger(storage: CoachDispatchStore | null | undefined, ledger: CoachDispatchLedger) {
  if (!storage) return;

  try {
    storage.setItem(COACH_DISPATCH_STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    // In-memory dispatch still protects this tab if storage is unavailable.
  }
}
