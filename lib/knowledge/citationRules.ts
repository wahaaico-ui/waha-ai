export interface CitationRule {
  style: string;
  formattingFormat: string;
  recencyRule: string;
}

export class CitationRulesProcessor {
  public static getRule(style: string): CitationRule {
    if (style === "APA" || style === "APA7") {
      return {
        style: "APA 7th Edition",
        formattingFormat: "نظام السرد والتوثيق (المؤلف، السنة) داخل المتن، مع قائمة مراجع أبجدية معزولة في النهاية تحتوي على الـ DOI للمراجع الرقمية.",
        recencyRule: "قانون الحداثة: يجب أن تكون 80% من مراجع الإطار النظري والدراسات السابقة منشورة في آخر 5 سنوات (من 2021 إلى 2026)."
      };
    }
    if (style === "IEEE") {
      return {
        style: "IEEE Documentation Style",
        formattingFormat: "نظام الأرقام المتسلسلة المحصورة بين أقواس مربعة [1] تبعاً لظهورها في النص، وقائمة مراجع مرقمة عددياً في النهاية.",
        recencyRule: "حداثة تقنية: التركيز على الأوراق البحثية والمؤتمرات لآخر 3 سنوات في التخصصات الهندسية والتكنولوجية."
      };
    }
    return {
      style: `معيار التوثيق القياسي: ${style}`,
      formattingFormat: "الاتساق في حصر المصادر والمراجع وتطابق المتن مع القائمة الختامية.",
      recencyRule: "يفضل ألا تتجاوز مراجع الدراسات السابقة 5 إلى 7 سنوات كحد أقصى."
    };
  }
}
