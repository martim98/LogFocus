import "server-only";

import { dirname, join } from "path";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import {
  createDefaultFocusRewardLedger,
  defaultProject,
  defaultSettings,
  focusRewardLedgerSchema,
  focusSessionSchema,
  planItemSchema,
  projectSchema,
  taskSchema,
  todoItemSchema,
  timerSettingsSchema,
} from "@/lib/domain";
import type { FocusRewardLedger, FocusSession, PlanItem, Project, TodoItem, Task, TimerSettings } from "@/lib/domain";

const STORE_PATH = join(process.cwd(), ".data", "local-store.json");

export type StoredPlanItem = PlanItem & {
  date: string;
};

type LocalAuthOwner = {
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  updatedAt: string;
};

type LocalAuthSession = {
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
};

type LocalStore = {
  auth: {
    owner: LocalAuthOwner | null;
    sessions: LocalAuthSession[];
  };
  data: {
    projects: Project[];
    tasks: Task[];
    todoItems: TodoItem[];
    plans: StoredPlanItem[];
    sessions: FocusSession[];
    settings: TimerSettings | null;
    focusRewards: FocusRewardLedger | null;
  };
};

const DEFAULT_STORE: LocalStore = {
  auth: {
    owner: null,
    sessions: [],
  },
  data: {
    projects: [],
    tasks: [],
    todoItems: [],
    plans: [],
    sessions: [],
    settings: null,
    focusRewards: null,
  },
};

let writeChain: Promise<unknown> = Promise.resolve();

export function isMissingFileError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}

async function readStoreFile(): Promise<LocalStore> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    return normalizeStore(JSON.parse(raw) as Partial<LocalStore>);
  } catch (error) {
    if (isMissingFileError(error)) {
      return structuredClone(DEFAULT_STORE);
    }
    throw error;
  }
}

async function writeStoreFile(store: LocalStore) {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  const tmpPath = `${STORE_PATH}.${Date.now()}.tmp`;
  await writeFile(tmpPath, JSON.stringify(store, null, 2), "utf8");
  await rename(tmpPath, STORE_PATH);
}

function normalizeStore(store: Partial<LocalStore>): LocalStore {
  return {
    auth: {
      owner: store.auth?.owner ?? null,
      sessions: Array.isArray(store.auth?.sessions) ? store.auth!.sessions : [],
    },
    data: {
      projects: Array.isArray(store.data?.projects) ? store.data!.projects : [],
      tasks: Array.isArray(store.data?.tasks) ? store.data!.tasks : [],
      todoItems: Array.isArray(store.data?.todoItems)
        ? store.data!.todoItems.map((item) => todoItemSchema.parse(item))
        : [],
      plans: Array.isArray(store.data?.plans) ? store.data!.plans : [],
      sessions: Array.isArray(store.data?.sessions)
        ? store.data!.sessions.map((session) => focusSessionSchema.parse(session))
        : [],
      settings: normalizeSettings(store.data?.settings),
      focusRewards: normalizeFocusRewards(store.data?.focusRewards),
    },
  };
}

function normalizeSettings(settings: unknown): TimerSettings {
  if (!settings) {
    return structuredClone(defaultSettings);
  }

  const parsed = timerSettingsSchema.partial().safeParse(settings);
  if (!parsed.success) {
    return structuredClone(defaultSettings);
  }

  return {
    ...structuredClone(defaultSettings),
    ...parsed.data,
  };
}

function normalizeFocusRewards(focusRewards: unknown): FocusRewardLedger {
  const defaults = createDefaultFocusRewardLedger();
  if (!focusRewards) {
    return defaults;
  }

  const parsed = focusRewardLedgerSchema.partial().safeParse(focusRewards);
  if (!parsed.success) {
    return defaults;
  }

  return focusRewardLedgerSchema.parse({
    ...defaults,
    ...parsed.data,
    awardedSessions: parsed.data.awardedSessions ?? {},
  });
}

function cloneStore(store: LocalStore): LocalStore {
  return structuredClone(store);
}

export async function getStore() {
  return cloneStore(await readStoreFile());
}

export async function updateStore(updater: (store: LocalStore) => Promise<void> | void) {
  writeChain = writeChain.then(async () => {
    const store = await readStoreFile();
    await updater(store);
    await writeStoreFile(store);
  });

  await writeChain;
}

export function parseAndValidateProject(input: unknown) {
  return projectSchema.parse(input);
}

export function parseAndValidateTask(input: unknown) {
  return taskSchema.parse(input);
}

export function parseAndValidateTodoItem(input: unknown) {
  return todoItemSchema.parse(input);
}

export function parseAndValidatePlan(input: unknown) {
  return planItemSchema.parse(input);
}

export function parseAndValidateSession(input: unknown) {
  return focusSessionSchema.parse(input);
}

export function parseAndValidateSettings(input: unknown) {
  return timerSettingsSchema.parse(input);
}

export function parseAndValidateFocusRewards(input: unknown) {
  return focusRewardLedgerSchema.parse(input);
}

export function getDefaultSettings() {
  return structuredClone(defaultSettings);
}

export function getDefaultProject() {
  return structuredClone(defaultProject);
}

export function getDefaultFocusRewards() {
  return createDefaultFocusRewardLedger();
}
