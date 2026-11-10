import {
  LEVEL_OPTIONS,
  SPECIALTY_OPTIONS,
  optionalText,
  parseProfileUpdate,
  researcherProfileFromMetadata,
  routingSpecialty,
  specialtyLabel,
} from '@/lib/researcher-profile';

const valid = {
  fullName: ' سارة أحمد ',
  specialty: 'العلوم الشرعية والإسلامية',
  specialtyDetail: '  أصول الفقه ',
  university: ' جامعة النجاح الوطنية ',
  level: 'masters',
  country: 'PS',
};

describe('researcher profile kept in the account', () => {
  test('reads every field from the account metadata, trimmed, with the provider name as fallback', () => {
    expect(researcherProfileFromMetadata({
      name: ' سارة ', specialty: ' التربية وعلم النفس ', specialty_detail: ' تعليم العربية للناطقين بغيرها ',
      university: 'جامعة بيرزيت', level: 'phd', country: 'ps',
    })).toEqual({
      fullName: 'سارة', specialty: 'التربية وعلم النفس', specialtyDetail: 'تعليم العربية للناطقين بغيرها',
      university: 'جامعة بيرزيت', level: 'phd', country: 'PS',
    });
    expect(researcherProfileFromMetadata({ full_name: 'سارة أحمد', name: 'Sara' }).fullName).toBe('سارة أحمد');
  });

  test('ignores missing, non-text, blank and oversized values instead of passing them on', () => {
    const empty = { fullName: null, specialty: null, specialtyDetail: null, university: null, level: null, country: null };
    expect(researcherProfileFromMetadata(null)).toEqual(empty);
    expect(researcherProfileFromMetadata(['x'])).toEqual(empty);
    expect(researcherProfileFromMetadata({ specialty: 42, specialty_detail: 'ف'.repeat(161), university: '   ' }))
      .toMatchObject({ specialty: null, specialtyDetail: null, university: null });
  });

  test('routing uses the broad and the precise specialty together', () => {
    expect(routingSpecialty({ specialty: 'العلوم الشرعية والإسلامية', specialtyDetail: 'أصول الفقه' })).toBe('العلوم الشرعية والإسلامية أصول الفقه');
    expect(routingSpecialty({ specialty: 'الهندسة والتقنية', specialtyDetail: null })).toBe('الهندسة والتقنية');
    expect(routingSpecialty({ specialty: null, specialtyDetail: undefined })).toBe('');
  });

  test('the label shows the precise specialty beside the broad one', () => {
    expect(specialtyLabel({ specialty: 'العلوم الشرعية والإسلامية', specialtyDetail: 'أصول الفقه' })).toBe('العلوم الشرعية والإسلامية — أصول الفقه');
    expect(specialtyLabel({ specialty: 'الهندسة والتقنية', specialtyDetail: null })).toBe('الهندسة والتقنية');
    expect(specialtyLabel({ specialty: null, specialtyDetail: 'أصول الفقه' })).toBe('أصول الفقه');
    expect(specialtyLabel({ specialty: null, specialtyDetail: null })).toBeNull();
  });

  test('an optional text is null when empty and rejected when it is not text or too long', () => {
    expect(optionalText(undefined, 10)).toBeNull();
    expect(optionalText('   ', 10)).toBeNull();
    expect(optionalText(' نص ', 10)).toBe('نص');
    expect(optionalText(5, 10)).toBeUndefined();
    expect(optionalText('ن'.repeat(11), 10)).toBeUndefined();
  });
});

describe('profile update', () => {
  test('turns a complete form into the account fields', () => {
    expect(parseProfileUpdate(valid)).toEqual({
      ok: true,
      data: {
        full_name: 'سارة أحمد', specialty: 'العلوم الشرعية والإسلامية', specialty_detail: 'أصول الفقه',
        university: 'جامعة النجاح الوطنية', level: 'masters', country: 'PS',
      },
    });
  });

  test('an emptied precise specialty is removed from the account', () => {
    const result = parseProfileUpdate({ ...valid, specialtyDetail: '' });
    expect(result.ok && result.data.specialty_detail).toBeNull();
  });

  test.each([
    ['name', { fullName: '' }],
    ['broad specialty', { specialty: '' }],
    ['long precise specialty', { specialtyDetail: 'ف'.repeat(161) }],
    ['university', { university: '  ' }],
    ['level', { level: 'dean' }],
    ['country', { country: 'XX' }],
  ])('rejects a missing or invalid %s with a message', (_field, change) => {
    const result = parseProfileUpdate({ ...valid, ...change });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/[؀-ۿ]/);
  });

  test('rejects a body that is not a form', () => {
    expect(parseProfileUpdate(null).ok).toBe(false);
    expect(parseProfileUpdate('x').ok).toBe(false);
  });

  test('the lists offered in the forms are the lists the update accepts', () => {
    expect(SPECIALTY_OPTIONS).toContain('العلوم الشرعية والإسلامية');
    expect(SPECIALTY_OPTIONS.at(-1)).toBe('تخصص آخر');
    for (const level of LEVEL_OPTIONS) expect(parseProfileUpdate({ ...valid, level: level.value }).ok).toBe(true);
  });
});
