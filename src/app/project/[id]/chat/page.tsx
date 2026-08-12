'use client';

import { useState, use } from 'react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ProjectChatPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'مرحباً بك! أنا مساعدك الأكاديمي الذكي. كيف يمكنني مساعدتك في تطوير وتحليل هذا المشروع اليوم؟'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          message: userMessage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء الاتصال بالمساعد');
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090D16] text-white p-8 md:p-12 flex flex-col justify-between" dir="rtl">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
        
        <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/project/${projectId}`}
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors inline-flex items-center gap-1"
            >
              &larr; العودة لتفاصيل المشروع
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-sm text-gray-400">مساعد الذكاء الاصطناعي التفاعلي (API)</span>
          </div>
          <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            متصل بالخلفية
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
            {error}
          </div>
        )}

        <div className="flex-1 bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between mb-6">
          
          <div className="space-y-4 overflow-y-auto max-h-[500px] mb-6 pr-2">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-gray-950 font-medium rounded-bl-none'
                      : 'bg-[#090D16] text-gray-200 border border-gray-800 rounded-br-none'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-start">
                <div className="bg-[#090D16] text-gray-400 border border-gray-800 p-4 rounded-2xl rounded-br-none text-xs animate-pulse">
                  جاري معالجة الرد عبر الخادم...
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-3 pt-4 border-t border-gray-800">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب سؤالك أو استفسارك حول البحث..."
              className="flex-1 px-4 py-3 rounded-xl border border-gray-800 bg-[#090D16] text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/10 disabled:opacity-50 text-sm shrink-0"
            >
              إرسال
            </button>
          </form>

        </div>
      </div>
    </main>
  );
}
