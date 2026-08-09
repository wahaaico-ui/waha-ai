// Local type definitions to avoid relying on an exported AIProvider from './provider'
// (fixes: Module './provider' has no exported member 'AIProvider')
interface IMessage { role: string; content: string }
interface AIProviderResponse { success: boolean; text?: string }
interface AIProvider { name: string; generateText: (messages: IMessage[]) => Promise<AIProviderResponse> }

// تم تحويل OpenAI إلى مجرد Implementation مستقل تماماً ومجهز للمستقبل
export const OpenAIProvider: AIProvider = {
  name: 'OpenAI',
  generateText: async (messages: IMessage[]): Promise<AIProviderResponse> => {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || "";
    try {
      const res = await fetch(`https://openai.com`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: messages.map((item) => ({ role: item.role, content: item.content })),
          temperature: 0.6,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return { success: true, text: data.choices[0].message.content };
    } catch (error: unknown) {
      console.error("OpenAI Execution Error:", error);
      throw error;
    }
  }
};

