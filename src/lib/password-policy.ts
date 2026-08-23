export type PasswordRequirement = { id: 'length' | 'lowercase' | 'uppercase' | 'number' | 'symbol'; label: string; met: boolean };

export function passwordRequirements(password: string): PasswordRequirement[] {
  return [
    { id: 'length', label: '8 أحرف على الأقل', met: password.length >= 8 },
    { id: 'lowercase', label: 'حرف صغير واحد على الأقل', met: /[a-z]/.test(password) },
    { id: 'uppercase', label: 'حرف كبير واحد على الأقل', met: /[A-Z]/.test(password) },
    { id: 'number', label: 'رقم واحد على الأقل', met: /\d/.test(password) },
    { id: 'symbol', label: 'رمز خاص واحد على الأقل (!@#$...)', met: /[^A-Za-z0-9\s]/.test(password) },
  ];
}

export function passwordStrength(password: string) {
  const requirements = passwordRequirements(password);
  const score = requirements.filter((requirement) => requirement.met).length;
  if (score <= 2) return { score, label: 'ضعيفة', color: 'rose' as const, isStrong: false, requirements };
  if (score <= 4) return { score, label: 'متوسطة', color: 'amber' as const, isStrong: false, requirements };
  return { score, label: 'قوية', color: 'emerald' as const, isStrong: true, requirements };
}
