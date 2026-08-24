import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('Sanity check', () => {
  it('should run a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should verify addition is commutative (property-based)', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
      })
    );
  });

  it('should verify addition is associative (property-based)', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), fc.integer(), (a, b, c) => {
        expect((a + b) + c).toBe(a + (b + c));
      })
    );
  });
});
