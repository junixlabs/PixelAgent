import type { Token, ValidationWarning } from './types.js';

const COMMAND_NAMES = new Set([
  'SCREEN',
  'TOKEN',
  'FILL',
  'RECT',
  'TEXT',
  'ICON',
  'IMAGE',
  'INPUT',
  'BUTTON',
  'LAYER',
  'STACK',
  'GRID',
  'STATE',
  'REPEAT',
  'EFFECT',
]);

const IDENT_START = /[a-zA-Z_]/;
const IDENT_REST = /[a-zA-Z0-9_-]/;
const HEX = /[0-9a-fA-F]/;

export type TokenizeResult = { tokens: Token[]; errors: ValidationWarning[] };

export function tokenize(input: string): TokenizeResult {
  const tokens: Token[] = [];
  const errors: ValidationWarning[] = [];
  const lines = input.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNo = lineIdx + 1;
    const line = lines[lineIdx];

    let p = 0;
    while (p < line.length && (line[p] === ' ' || line[p] === '\t')) p++;
    if (p >= line.length) continue;
    if (line[p] === '#') continue;

    let firstTokenOnLine = true;
    let lineHadTokens = false;

    while (p < line.length) {
      while (p < line.length && (line[p] === ' ' || line[p] === '\t')) p++;
      if (p >= line.length) break;

      const startCol = p + 1;
      const ch = line[p];

      if (ch === '"') {
        let q = p + 1;
        while (q < line.length && line[q] !== '"') q++;
        if (q >= line.length) {
          errors.push({
            rule: 'lex-error',
            line: lineNo,
            message: 'unterminated string',
            severity: 'error',
          });
          break;
        }
        tokens.push({
          kind: 'string',
          value: line.slice(p + 1, q),
          line: lineNo,
          column: startCol,
        });
        p = q + 1;
        firstTokenOnLine = false;
        lineHadTokens = true;
        continue;
      }

      if (ch === '$') {
        let q = p + 1;
        if (q >= line.length || !IDENT_START.test(line[q])) {
          errors.push({
            rule: 'lex-error',
            line: lineNo,
            message: 'invalid token reference',
            severity: 'error',
          });
          p++;
          continue;
        }
        while (q < line.length && IDENT_REST.test(line[q])) q++;
        tokens.push({
          kind: 'tokenref',
          value: line.slice(p + 1, q),
          line: lineNo,
          column: startCol,
        });
        p = q;
        firstTokenOnLine = false;
        lineHadTokens = true;
        continue;
      }

      if (ch === '#') {
        let q = p + 1;
        while (q < line.length && HEX.test(line[q])) q++;
        const len = q - p - 1;
        if (len !== 3 && len !== 6 && len !== 8) {
          errors.push({
            rule: 'lex-error',
            line: lineNo,
            message: `invalid color literal '${line.slice(p, q)}' (expected #RGB, #RRGGBB, or #RRGGBBAA)`,
            severity: 'error',
          });
          break;
        }
        tokens.push({
          kind: 'color',
          value: line.slice(p, q),
          line: lineNo,
          column: startCol,
        });
        p = q;
        firstTokenOnLine = false;
        lineHadTokens = true;
        continue;
      }

      if (ch >= '0' && ch <= '9') {
        let q = p;
        while (q < line.length && line[q] >= '0' && line[q] <= '9') q++;
        if (
          q < line.length &&
          line[q] === '.' &&
          q + 1 < line.length &&
          line[q + 1] >= '0' &&
          line[q + 1] <= '9'
        ) {
          let r = q + 1;
          while (r < line.length && line[r] >= '0' && line[r] <= '9') r++;
          errors.push({
            rule: 'lex-error',
            line: lineNo,
            message: `decimal numbers not allowed (got '${line.slice(p, r)}')`,
            severity: 'error',
          });
          p = r;
          firstTokenOnLine = false;
          continue;
        }
        const value = parseInt(line.slice(p, q), 10);
        tokens.push({
          kind: 'number',
          value,
          line: lineNo,
          column: startCol,
        });
        p = q;
        firstTokenOnLine = false;
        lineHadTokens = true;
        continue;
      }

      if (IDENT_START.test(ch)) {
        let q = p;
        while (q < line.length && IDENT_REST.test(line[q])) q++;
        const ident = line.slice(p, q);

        if (q < line.length && line[q] === ':') {
          const r = q + 1;
          if (r >= line.length || line[r] === ' ' || line[r] === '\t') {
            // kvspaced — consume rest of line
            let s = r;
            while (s < line.length && (line[s] === ' ' || line[s] === '\t'))
              s++;
            const rest = line.slice(s).replace(/[ \t]+$/, '');
            tokens.push({
              kind: 'kvspaced',
              key: ident,
              raw: rest,
              line: lineNo,
              column: startCol,
            });
            p = line.length;
            firstTokenOnLine = false;
            lineHadTokens = true;
            continue;
          }
          // kvinline
          let raw: string;
          let s: number;
          if (line[r] === '"') {
            let qq = r + 1;
            while (qq < line.length && line[qq] !== '"') qq++;
            if (qq >= line.length) {
              errors.push({
                rule: 'lex-error',
                line: lineNo,
                message: 'unterminated string in kv value',
                severity: 'error',
              });
              break;
            }
            raw = line.slice(r, qq + 1);
            s = qq + 1;
          } else {
            let qq = r;
            while (
              qq < line.length &&
              line[qq] !== ' ' &&
              line[qq] !== '\t'
            )
              qq++;
            raw = line.slice(r, qq);
            s = qq;
          }
          tokens.push({
            kind: 'kvinline',
            key: ident,
            raw,
            line: lineNo,
            column: startCol,
          });
          p = s;
          firstTokenOnLine = false;
          lineHadTokens = true;
          continue;
        }

        // bare ident
        const upper = ident.toUpperCase();
        if (firstTokenOnLine && upper === 'END') {
          tokens.push({ kind: 'end', line: lineNo, column: startCol });
        } else if (firstTokenOnLine && COMMAND_NAMES.has(upper)) {
          tokens.push({
            kind: 'command',
            value: upper,
            line: lineNo,
            column: startCol,
          });
        } else {
          tokens.push({
            kind: 'ident',
            value: ident,
            line: lineNo,
            column: startCol,
          });
        }
        p = q;
        firstTokenOnLine = false;
        lineHadTokens = true;
        continue;
      }

      errors.push({
        rule: 'lex-error',
        line: lineNo,
        message:
          ch === '%'
            ? "'%' is not a valid token. PixelAgent DSL uses integer px values only (e.g., use '1440' instead of '100%')."
            : `unexpected character '${ch}'`,
        severity: 'error',
      });
      p++;
    }

    if (lineHadTokens) {
      tokens.push({
        kind: 'newline',
        line: lineNo,
        column: line.length + 1,
      });
    }
  }

  return { tokens, errors };
}
