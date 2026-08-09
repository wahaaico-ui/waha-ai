export class MethodologyRulesProcessor {
  public static getRule(type: string): string {
    return `محددات المنهجية المعتمدة لـ (${type}): إلزام الباحث بالربط بين أدوات جمع البيانات (استبيان، مقابلة، بطاقة ملاحظة) وبين أسلوب التحليل الرياضي أو الاستقرائي.`;
  }
}
