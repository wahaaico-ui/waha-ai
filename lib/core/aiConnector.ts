import OpenAI from "openai";

interface AIConnectorResponse {
  [key: string]: unknown;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class AIConnector {
  /**
   * دالة الاتصال الرسمية والمصححة لهيكل استجابة مصفوفة OpenAI
   */
  public async callOpenAI(systemPrompt: string, userPrompt: string): Promise<AIConnectorResponse> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      // التصحيح البرمجي الصارم: الوصول للمصفوفة choices[0] لضمان عدم حدوث undefined
      const responseText = response.choices[0]?.message?.content;
      
      if (!responseText) {
        throw new Error("AI Connector: استجابة فارغة أو غير مقروءة من خوادم OpenAI.");
      }

      return JSON.parse(responseText);
    } catch (error: unknown) {
      console.error("AI Connector Error:", error);
      const message = error instanceof Error ? error.message : "فشل معالجة وقراءة استجابة الحزمة";
      throw new Error(`AI Connector Fail: ${message}`);
    }
  }

  public async callClaude(systemPrompt: string, userPrompt: string): Promise<AIConnectorResponse> {
    throw new Error("تكامل Anthropic Claude سيتم ربطه لاحقاً.");
  }
}
