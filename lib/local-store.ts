import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { dirname, join } from "path";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import {
  defaultProject,
  defaultSettings,
  FocusSession,
  PlanItem,
  Project,
  TodoItem,
  Task,
  TimerSettings,
  focusSessionSchema,
  planItemSchema,
  projectSchema,
  taskSchema,
  todoItemSchema,
  timerSettingsSchema,
} from "@/lib/domain";

export const LOCAL_OWNER_ID = "local-owner";
export const LOCAL_SESSION_COOKIE = "sister_focus_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const STORE_PATH = join(process.cwd(), ".data", "local-store.json");

export type LocalUser = {
  id: string;
  email: string;
};

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
  },
};

let writeChain: Promise<unknown> = Promise.resolve();

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createPasswordHash(password: string, salt = randomBytes(16).toString("hex")) {
  return {
    salt,
    passwordHash: scryptSync(password, salt, 64).toString("hex"),
  };
}

export function verifyPassword(password: string, salt: string, passwordHash: string) {
  const derived = Buffer.from(createPasswordHash(password, salt).passwordHash, "hex");
  const expected = Buffer.from(passwordHash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function createSessionToken() {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createLocalUser(email: string): LocalUser {
  return {
    id: LOCAL_OWNER_ID,
    email: normalizeEmail(email),
  };
}

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
      todoItems: Array.isArray(store.data?.todoItems) ? store.data!.todoItems : [],
      plans: Array.isArray(store.data?.plans) ? store.data!.plans : [],
      sessions: Array.isArray(store.data?.sessions) ? store.data!.sessions : [],
      settings: store.data?.settings ?? null,
    },
  };
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

export async function getAuthenticatedUser(token?: string | null) {
  if (!token) {
    return null;
  }

  const store = await readStoreFile();
  const tokenHash = hashSessionToken(token);
  const now = Date.now();
  const session = store.auth.sessions.find((item) => item.tokenHash === tokenHash && Date.parse(item.expiresAt) > now);

  if (!session || !store.auth.owner) {
    return null;
  }

  return createLocalUser(store.auth.owner.email);
}

export async function authenticateLocalAccount(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const store = await readStoreFile();
  const owner = store.auth.owner;

  if (!owner) {
    const { salt, passwordHash } = createPasswordHash(password);
    store.auth.owner = {
      email: normalizedEmail,
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } else {
    if (normalizeEmail(owner.email) !== normalizedEmail) {
      throw new Error("A different local account is already configured for this workspace.");
    }

    if (!verifyPassword(password, owner.salt, owner.passwordHash)) {
      throw new Error("Invalid email or password.");
    }
  }

  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const now = new Date().toISOString();
  store.auth.sessions = store.auth.sessions.filter((item) => Date.parse(item.expiresAt) > Date.now());
  store.auth.sessions.push({
    tokenHash,
    createdAt: now,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });

  await writeStoreFile(store);

  return {
    user: createLocalUser(normalizedEmail),
    token,
  };
}

export async function revokeSession(token: string) {
  await updateStore((store) => {
    const tokenHash = hashSessionToken(token);
    store.auth.sessions = store.auth.sessions.filter((item) => item.tokenHash !== tokenHash);
  });
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

export function getDefaultSettings() {
  return structuredClone(defaultSettings);
}

export function getDefaultProject() {
  return structuredClone(defaultProject);
}
