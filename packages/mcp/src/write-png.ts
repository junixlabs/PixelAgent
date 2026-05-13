import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, sep } from 'node:path';

export const writePng = async (
  png: Buffer,
  outPath: string,
): Promise<string> => {
  if (!isAbsolute(outPath)) {
    throw new Error(`outPath must be absolute, got: ${outPath}`);
  }
  if (outPath.split(sep).includes('..')) {
    throw new Error(`outPath must not contain '..' segments: ${outPath}`);
  }
  if (!outPath.toLowerCase().endsWith('.png')) {
    throw new Error(`outPath must end with .png: ${outPath}`);
  }
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, png);
  return outPath;
};
