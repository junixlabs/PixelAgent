import { describe, it, expect } from 'vitest';
import { parse } from '../src/index.js';

function rules(input: string) {
  const { warnings } = parse(input);
  return warnings.map((w) => w.rule);
}

describe('validator — happy path', () => {
  it('no errors/warnings for a clean SCREEN-only scene', () => {
    const { warnings } = parse('SCREEN 100 100\n');
    expect(warnings).toHaveLength(0);
  });
});

describe('validator — rule coverage (8 negative cases)', () => {
  it('1. screen-first — missing SCREEN', () => {
    expect(rules('LAYER l 0 0 10 10\nEND\n')).toContain('screen-first');
  });

  it('2. stack-no-coords — child of STACK has non-zero x/y', () => {
    expect(
      rules(
        [
          'SCREEN 100 100',
          'STACK s 0 0',
          '  RECT a 10 0 10 10',
          'END',
          '',
        ].join('\n'),
      ),
    ).toContain('stack-no-coords');
  });

  it('3. id-uniqueness — two BUTTONs with the same id', () => {
    expect(
      rules(
        [
          'SCREEN 100 100',
          'BUTTON b 0 0 100 48 "Go"',
          'BUTTON b 0 60 100 48 "Go again"',
          '',
        ].join('\n'),
      ),
    ).toContain('id-uniqueness');
  });

  it('4. block-end-required — LAYER without END', () => {
    expect(rules('SCREEN 100 100\nLAYER l 0 0 10 10\n')).toContain(
      'block-end-required',
    );
  });

  it('5. border-inline-only — EFFECT … border …', () => {
    expect(
      rules(
        [
          'SCREEN 100 100',
          'LAYER l 0 0 100 100',
          'END',
          'EFFECT l border width:1 color:#ccc',
          '',
        ].join('\n'),
      ),
    ).toContain('border-inline-only');
  });

  it('6. text-center-needs-maxwidth — align:center without max-width or x≠0', () => {
    expect(
      rules(
        'SCREEN 100 100\nTEXT t 50 0 "hi" align:center\n',
      ),
    ).toContain('text-center-needs-maxwidth');
  });

  it('7. input-label-clearance — INPUT with label and y < 20', () => {
    expect(
      rules(
        'SCREEN 100 100\nINPUT i 0 10 200 44 label:"Email"\n',
      ),
    ).toContain('input-label-clearance');
  });

  it('8. tap-target-min-height — BUTTON with h < 36', () => {
    expect(
      rules(
        'SCREEN 100 100\nBUTTON b 0 0 100 30 "Go"\n',
      ),
    ).toContain('tap-target-min-height');
  });

  it('9. fill-no-id — FILL with extra id token', () => {
    expect(
      rules(
        'SCREEN 100 100\nFILL bg 0 0 100 100 #fff\n',
      ),
    ).toContain('fill-no-id');
  });
});

describe('validator — severity per SPEC', () => {
  it('errors are errors, warnings are warnings', () => {
    const { warnings } = parse(
      [
        'SCREEN 100 100',
        'BUTTON b 0 0 100 30 "Go"', // warning: tap-target-min-height
        'BUTTON b 0 60 100 48 "Go"', // error: id-uniqueness
        '',
      ].join('\n'),
    );
    const tap = warnings.find((w) => w.rule === 'tap-target-min-height');
    const dup = warnings.find((w) => w.rule === 'id-uniqueness');
    expect(tap?.severity).toBe('warning');
    expect(dup?.severity).toBe('error');
  });
});
