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

/** Source line per Node (and ScreenNode/TokenNode). Validator uses it for diagnostics. */
export type LineMap = WeakMap<object, number>;

export type BuildResult = {
  scene: Scene | null;
  errors: ValidationWarning[];
  lineMap: LineMap;
};

export type ParseResult = {
  scene: Scene | null;
  warnings: ValidationWarning[];
};
