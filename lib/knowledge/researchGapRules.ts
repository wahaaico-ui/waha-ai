export class ResearchGapRulesProcessor {
  public static getStrictPrompt(): string {
    return `
      قواعد فحص الفجوة والمشكلة الحقيقية (Research Gap & Problem Rules):
      - التحقق من أن المقترح يعالج مشكلة حقيقية ملموسة في الواقع العلمي أو الميداني (Real-world Problem Anchor).
      - فحص التداخل التاريخي: إذا كان الموضوع مستهلكاً وتم رصده في دراسات سابقة بكثافة دون إدخال بيئة جديدة، أو متغير جديد، أو أداة مستحدثة؛ يوضع له تقييم فجوة منخفض جداً ويُصنف كـ "تكرار معرفي".
    `;
  }
}
