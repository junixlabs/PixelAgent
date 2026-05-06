import type {
  Border,
  Node,
  Scene,
  ScreenNode,
  TokenNode,
  ValidationWarning,
} from '@pixelagent/dsl-spec';

export type {
  Border,
  Node,
  Scene,
  ScreenNode,
  TokenNode,
  ValidationWarning,
};

/**
 * Lexer output. `kvinline.raw` is the unparsed value text (no quotes for
 * plain values; quotes preserved for quoted-string values). The parser
 * coerces it per command schema. Compound border values (`border:1 #ccc`)
 * are reassembled at the parser layer by looking ahead for a trailing color.
 */
export type Token =
  | { kind: 'command'; value: string; line: number; column: number }
  | { kind: 'end'; line: number; column: number }
  | { kind: 'ident'; value: string; line: number; column: number }
  | { kind: 'number'; value: number; line: number; column: number }
  | { kind: 'string'; value: string; line: number; column: number }
  | { kind: 'color'; value: string; line: number; column: number }
  | { kind: 'tokenref'; value: string; line: number; column: number }
  | {
      kind: 'kvinline';
      key: string;
      raw: string;
      line: number;
      column: number;
    }
  | {
      kind: 'kvspaced';
      key: string;
      raw: string;
      line: number;
      column: number;
    }
  | { kind: 'newline'; line: number; column: number };

export type ParseResult = {
  scene: Scene | null;
  warnings: ValidationWarning[];
};
