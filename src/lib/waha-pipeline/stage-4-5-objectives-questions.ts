export function getStageObjectives(idea: string): string[] {
  return [
    `سّد الفجوة المعرفية المتعلقة بـ (${idea}) وتحليل أبعادها المختلفة.`,
    `تقييم الأثر المباشر وغير المباشر للمتغيرات الأساسية ضمن الإطار البحثي المحدد.`,
    `تقديم إطار مقترح أو توصيات علمية مبنية على الأدلة المستخلصة.`
  ];
}

export function getStageQuestions(idea: string): string[] {
  return [
    `إلى أي مدى تؤثر المعطيات الحالية على تطوير إطار العمل الخاص بـ (${idea})؟`,
    `ما هي التحديات الرئيسية التي تعرقل معالجة هذه الفجوة المعرفية؟`,
    `كيف يمكن بناء نموذج علمي محكم يسهم في سد هذه الفجوة بكفاءة عالية؟`
  ];
}

export async function executeStage4And5_ObjectivesAndQuestions(idea: string) {
  return {
    objectives: getStageObjectives(idea),
    questions: getStageQuestions(idea)
  };
}
