import { carryOver } from './leave-balances';

describe('carryOver', () => {
  it('carries what is left, capped by the policy maximum', () => {
    expect(carryOver({ entitled: 14, carried: 0, used: 4, pending: 0 }, 5)).toBe(5);
    expect(carryOver({ entitled: 14, carried: 0, used: 11, pending: 0 }, 5)).toBe(3);
  });
  it('carries nothing when the policy has no carry-forward, or nothing is left', () => {
    expect(carryOver({ entitled: 14, carried: 0, used: 2, pending: 0 }, null)).toBe(0);
    expect(carryOver({ entitled: 14, carried: 0, used: 14, pending: 0 }, 5)).toBe(0);
    expect(carryOver({ entitled: 10, carried: 0, used: 12, pending: 0 }, 5)).toBe(0); // negative balances do not carry
  });
  it('counts earlier carry-forward as part of what is left, and treats pending as spoken for', () => {
    expect(carryOver({ entitled: 10, carried: 4, used: 3, pending: 2 }, 20)).toBe(9);
  });
  it('has nothing to carry for a new joiner', () => expect(carryOver(undefined, 5)).toBe(0));
});
