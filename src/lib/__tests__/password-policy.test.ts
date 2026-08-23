import { passwordStrength } from '../password-policy';

describe('password policy', () => {
  test('marks weak passwords as not strong', () => expect(passwordStrength('short').isStrong).toBe(false));
  test('requires all five rules for a strong password', () => expect(passwordStrength('WahaSecure9!').isStrong).toBe(true));
  test('requires a symbol even when other rules pass', () => expect(passwordStrength('WahaSecure9').isStrong).toBe(false));
});
