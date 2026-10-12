import { costUsdToMc, creditsToMc, mcToCredits } from './credits.service';

describe('credit pricing', () => {
  it('prices a call at provider cost x 4 with 1 credit = $0.01', () => {
    // $0.0025 provider cost -> $0.01 billed -> exactly 1 credit
    expect(costUsdToMc(0.0025)).toBe(1000);
    // $1 provider cost -> $4 -> 400 credits
    expect(costUsdToMc(1)).toBe(400_000);
    expect(mcToCredits(costUsdToMc(1))).toBe(400);
  });
  it('never bills zero for a real call', () => {
    expect(costUsdToMc(0)).toBe(1);
    expect(costUsdToMc(1e-9)).toBe(1);
  });
  it('round-trips whole credits', () => {
    expect(creditsToMc(100)).toBe(100_000);
    expect(mcToCredits(creditsToMc(0.123))).toBe(0.123);
  });
});
