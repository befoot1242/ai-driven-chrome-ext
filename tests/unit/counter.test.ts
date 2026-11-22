// @trace TS-001
import { describe, expect, it } from 'vitest';
import { increment, MAX_COUNT } from '../../src/shared/counter';

describe('TS-001 カウンターの加算', () => {
  it('正常: 0 に 1 を加算すると 1 になる', () => {
    expect(increment(0)).toBe(1);
  });

  it('境界: 上限では上限のまま', () => {
    expect(increment(MAX_COUNT)).toBe(MAX_COUNT);
  });

  it('境界: 上限-1 では上限になる', () => {
    expect(increment(MAX_COUNT - 1)).toBe(MAX_COUNT);
  });

  it('異常: 負の値は RangeError', () => {
    expect(() => increment(-1)).toThrow(RangeError);
  });
});
