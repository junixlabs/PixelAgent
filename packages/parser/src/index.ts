import type { Scene, ValidationWarning } from '@pixelagent/dsl-spec';
import type { ParseResult } from './types.js';
import { tokenize } from './tokenizer.js';
import { buildScene } from './parser.js';
import { validate } from './validator.js';

export function parse(input: string): ParseResult {
  const { tokens, errors: lexErrors } = tokenize(input);
  if (lexErrors.some((w) => w.severity === 'error')) {
    return { scene: null, warnings: lexErrors };
  }

  const { scene, errors: parseErrors } = buildScene(tokens);
  const errSoFar: ValidationWarning[] = [...lexErrors, ...parseErrors];
  if (errSoFar.some((w) => w.severity === 'error') || !scene) {
    return { scene: null, warnings: errSoFar };
  }

  const semanticWarnings = validate(scene);
  const all: ValidationWarning[] = [...errSoFar, ...semanticWarnings];
  const out: Scene = { ...scene, warnings: all };
  return { scene: out, warnings: all };
}

export { tokenize } from './tokenizer.js';
export { validate } from './validator.js';
export { buildScene } from './parser.js';
export type {
  Scene,
  Node,
  ScreenNode,
  TokenNode,
  ValidationWarning,
  ParseResult,
  Token,
} from './types.js';
