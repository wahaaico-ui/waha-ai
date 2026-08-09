interface ClaudeMessage {
  role: string;
  content: string;
}

interface AIProvider {
  name: string;
  generateText: (messages: ClaudeMessage[]) => Promise<{ success: boolean; text: string }>;
}

const claudeProvider: AIProvider = {
  name: "claude",
  generateText: async (_messages: ClaudeMessage[]) => ({
    success: true,
    text: "محتوى مستقبلي مولد عبر هندسة Claude المفتوحة."
  })
};

export default claudeProvider;