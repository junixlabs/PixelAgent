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

describe('validator — low-contrast', () => {
  it('warns when TEXT color is too close to the enclosing LAYER bg', () => {
    const { warnings } = parse(
      [
        'SCREEN 800 600',
        'LAYER card 0 0 400 200 bg:#111111',
        '  TEXT t 16 16 "dim" color:#222222',
        'END',
        '',
      ].join('\n'),
    );
    const w = warnings.find((x) => x.rule === 'low-contrast');
    expect(w).toBeDefined();
    expect(w!.severity).toBe('warning');
    expect(w!.nodeId).toBe('t');
    expect(w!.message).toContain('contrast ratio');
  });

  it('stays silent for sufficient contrast', () => {
    expect(
      rules(
        [
          'SCREEN 800 600',
          'LAYER card 0 0 400 200 bg:#111111',
          '  TEXT t 16 16 "bright" color:#ffffff',
          'END',
          '',
        ].join('\n'),
      ),
    ).not.toContain('low-contrast');
  });

  it('resolves token references before measuring', () => {
    expect(
      rules(
        [
          'SCREEN 800 600',
          'TOKEN ink #131826',
          'LAYER card 0 0 400 200 bg:#111111',
          '  TEXT t 16 16 "dim" color:$ink',
          'END',
          '',
        ].join('\n'),
      ),
    ).toContain('low-contrast');
  });

  it('skips TEXT with no enclosing explicit bg or no explicit color', () => {
    expect(
      rules(
        [
          'SCREEN 800 600',
          'TEXT loose 16 16 "no bg context" color:#222222',
          'LAYER plain 0 0 400 200 bg:#111111',
          '  TEXT silent 16 16 "no explicit color"',
          'END',
          '',
        ].join('\n'),
      ),
    ).not.toContain('low-contrast');
  });

  it('token-coverage: raw hex duplicating a TOKEN value warns, $ref stays silent', () => {
    const dup = rules(
      [
        'SCREEN 800 600',
        'TOKEN primary #185FA5',
        'RECT a 0 0 100 40 bg:#185fa5',
        '',
      ].join('\n'),
    );
    expect(dup).toContain('token-coverage');
    const ok = rules(
      [
        'SCREEN 800 600',
        'TOKEN primary #185FA5',
        'RECT a 0 0 100 40 bg:$primary',
        'RECT b 0 60 100 40 bg:#222222',
        '',
      ].join('\n'),
    );
    expect(ok).not.toContain('token-coverage');
  });

  it('hover-coverage: warns for the uncovered button only when some hover exists', () => {
    const partial = parse(
      [
        'SCREEN 800 600',
        'BUTTON a 0 0 100 40 "A"',
        'BUTTON b 0 60 100 40 "B"',
        'STATE a hover',
        '  bg: #0C447C',
        'END',
        '',
      ].join('\n'),
    );
    const w = partial.warnings.find((x) => x.rule === 'hover-coverage');
    expect(w?.nodeId).toBe('b');

    const draft = rules(
      [
        'SCREEN 800 600',
        'BUTTON a 0 0 100 40 "A"',
        'BUTTON b 0 60 100 40 "B"',
        '',
      ].join('\n'),
    );
    expect(draft).not.toContain('hover-coverage');
  });

  it('spacing-rhythm: flags near-equal gap drift, ignores deliberate jumps', () => {
    const drift = parse(
      [
        'SCREEN 800 600',
        'LAYER card 0 0 400 400',
        '  TEXT r1 16 20 "one"',
        '  TEXT r2 16 60 "two"',
        '  TEXT r3 16 98 "three"',
        'END',
        '',
      ].join('\n'),
    );
    const w = drift.warnings.find((x) => x.rule === 'spacing-rhythm');
    expect(w).toBeDefined();
    expect(w!.message).toContain('off by 2px');

    const even = rules(
      [
        'SCREEN 800 600',
        'LAYER card 0 0 400 400',
        '  TEXT r1 16 20 "one"',
        '  TEXT r2 16 60 "two"',
        '  TEXT r3 16 100 "three"',
        'END',
        '',
      ].join('\n'),
    );
    expect(even).not.toContain('spacing-rhythm');

    const deliberate = rules(
      [
        'SCREEN 800 600',
        'LAYER card 0 0 400 400',
        '  TEXT r1 16 20 "one"',
        '  TEXT r2 16 60 "two"',
        '  TEXT r3 16 160 "three"',
        'END',
        '',
      ].join('\n'),
    );
    expect(deliberate).not.toContain('spacing-rhythm');
  });

  it('low-contrast skips TEXT painted over a sibling RECT (visible bg unknown)', () => {
    expect(
      rules(
        [
          'SCREEN 800 600',
          'LAYER card 0 0 400 200 bg:#ffffff',
          '  RECT avatar 10 10 32 32 bg:#185FA5 r:16',
          '  TEXT initials 12 16 "JL" color:#ffffff',
          'END',
          '',
        ].join('\n'),
      ),
    ).not.toContain('low-contrast');
  });

  it('nested LAYER without bg inherits the outer bg context', () => {
    expect(
      rules(
        [
          'SCREEN 800 600',
          'LAYER outer 0 0 400 400 bg:#111111',
          '  LAYER inner 16 16 200 200',
          '    TEXT t 8 8 "dim" color:#222222',
          '  END',
          'END',
          '',
        ].join('\n'),
      ),
    ).toContain('low-contrast');
  });
});
