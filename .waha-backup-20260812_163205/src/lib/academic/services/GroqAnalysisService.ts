export class GroqAnalysisService {
  public static async analyzeResearchGaps(papers: { title: string; abstract: string; year: number }[]): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('مفتاح GROQ_API_KEY غير موجود في ملف البيئة');
    }

    const papersContext = papers.map((p, i) => `
[الورقة ${i + 1}]
العنوان: ${p.title}
السنة: ${p.year}
المستخلص: ${p.abstract}
    `).join('\n');

    const prompt = `أنت محقق أكاديمي وخبير في مراجعة الأدبيات العلمية. بناءً على الأوراق البحثية التالية، قم بتحليلها بدقة واستخرج ما يلي:
1. الملخص العام للاتجاه الحالي لهذه الأبحاث.
2. نقاط القوة والضعف المشتركة.
3. **الفجوات البحثية (Research Gaps)** التي لم تطرق لها هذه الدراسات وتستحق البحث المستقبلي.

الأوراق:
${papersContext}
`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'أنت مساعد بحث علمي أكاديمي محترف ودقيق.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`فشل استدعاء محرك Groq: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'فشل توليد التحليل';
  }
}
