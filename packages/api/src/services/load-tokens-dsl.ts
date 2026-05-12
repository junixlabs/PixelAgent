import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const tokenIdRe = /^\s*TOKEN\s+([A-Za-z_][A-Za-z0-9_-]*)\b/;
const screenLineRe = /^\s*SCREEN\b/;

/**
 * If a `tokens.dsl` file exists in `cwd`, return `userDsl` with its TOKEN
 * lines injected immediately after the SCREEN command (the parser requires
 * SCREEN to be the first command). Tokens redefined in `userDsl` are
 * filtered out so the user wins. Returns `userDsl` unchanged on missing
 * file or unreadable contents.
 */
export const mergeProjectTokens = async (
  userDsl: string,
  cwd: string = process.cwd(),
): Promise<string> => {
  let raw: string;
  try {
    raw = await readFile(resolve(cwd, 'tokens.dsl'), 'utf8');
  } catch {
    return userDsl;
  }
  const userIds = new Set<string>();
  for (const line of userDsl.split(/\r?\n/)) {
    const m = tokenIdRe.exec(line);
    if (m) userIds.add(m[1]);
  }
  const keptLines = raw
    .split(/\r?\n/)
    .filter((line) => {
      const m = tokenIdRe.exec(line);
      return m && !userIds.has(m[1]);
    });
  if (keptLines.length === 0) return userDsl;

  const userLines = userDsl.split(/\r?\n/);
  const screenIdx = userLines.findIndex((l) => screenLineRe.test(l));
  if (screenIdx === -1) {
    // No SCREEN in user DSL — let parser surface its own error; don't inject.
    return userDsl;
  }
  const before = userLines.slice(0, screenIdx + 1);
  const after = userLines.slice(screenIdx + 1);
  return [...before, ...keptLines, ...after].join('\n');
};
