import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, sep } from 'node:path';

const writeArtifact = async (
  data: Buffer | string,
  outPath: string,
  ext: '.png' | '.html',
): Promise<string> => {
  if (!isAbsolute(outPath)) {
    throw new Error(`outPath must be absolute, got: ${outPath}`);
  }
  if (outPath.split(sep).includes('..')) {
    throw new Error(`outPath must not contain '..' segments: ${outPath}`);
  }
  if (!outPath.toLowerCase().endsWith(ext)) {
    throw new Error(`outPath must end with ${ext}: ${outPath}`);
  }
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, data);
  return outPath;
};

export const writePng = (png: Buffer, outPath: string): Promise<string> =>
  writeArtifact(png, outPath, '.png');

export const writeHtml = (html: string, outPath: string): Promise<string> =>
  writeArtifact(html, outPath, '.html');
