import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("@/")) {
    return { url: resolveLocalPath(path.join(repoRoot, specifier.slice(2))), shortCircuit: true };
  }

  if (specifier === "next/server") {
    return { url: pathToFileURL(path.join(repoRoot, "node_modules/next/server.js")).href, shortCircuit: true };
  }

  if (specifier === "server-only") {
    return { url: pathToFileURL(path.join(repoRoot, "tests/server-only-stub.mjs")).href, shortCircuit: true };
  }

  return defaultResolve(specifier, context, defaultResolve);
}

function resolveLocalPath(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.js"),
  ];

  const match = candidates.find((candidate) => fs.existsSync(candidate));
  return pathToFileURL(match ?? basePath).href;
}
