export class MeaningfulnessValidator {
  static validate(idea: string): { isValid: boolean; reason?: string } {
    if (!idea || idea.trim().length < 10) {
      return {
        isValid: false,
        reason: 'المدخل قصير جداً ولا يمثل فكرة بحثية صالحة للتحليل.'
      };
    }
    return { isValid: true };
  }
}
