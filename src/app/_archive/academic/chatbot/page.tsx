'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ChatbotPage() {
  const [projectContext, setProjectContext] = useState('أثر الذكاء الاصطناعي التوليدي على كفاءة البحث العلمي لطلبة الدراسات العليا');
  const [messages, setMessages] = useState<any[]>([
    { role: 'model', content: 'مرحباً بك! أنا مساعدك الأكاديمي الذكي في منصة WAHA. اسألني أي شيء يتعلق بمشروعك البحثي، المنهجية، أو صياغة الفقرات.' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    const newMessages = [...messages, { role: 'user', content: inputMessage }];
    setMessages(newMessages);
    setInputMessage('');
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/academic/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, projectContext }),
      });

      const data = await res.json();
      if (data.success) {
        setMessages([...newMessages, { role: 'model', content: data.reply }]);
      } else {
        setError(data.error || 'فشل الرد');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6 md:p-10">

      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-semibold rounded-full">
            Sprint 12 - AI Project Research Assistant
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">المساعد الذكي التفاعلي للمشروع</h1>
          <p className="text-slate-400 mt-1">نافذة محادثة ذكية متخصصة لمراجعة وتطوير بحثك لحظياً عبر Gemini</p>
        </div>
        <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
          العودة للرئيسية
        </Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center gap-3">
        <label className="text-xs font-bold text-slate-300 shrink-0">سياق المشروع:</label>
        <input
          type="text"
          value={projectContext}
          onChange={(e) => setProjectContext(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* صندوق المحادثة */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col h-[500px] justify-between">

        {/* الرسائل */}
        <div className="overflow-y-auto space-y-4 pr-2 flex-1">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xl p-4 rounded-2xl text-xs leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none'}`}>
                <p className="font-bold mb-1 text-[10px] opacity-70">{m.role === 'user' ? 'أنت' : 'مساعد WAHA الذكي'}</p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs text-slate-400 animate-pulse">
                جارٍ التفكير وصياغة الإجابة الأكاديمية...
              </div>
            </div>
          )}
        </div>

        {error && <div className="p-3 my-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">{error}</div>}

        {/* إدخال الرسالة */}
        <form onSubmit={sendMessage} className="mt-4 flex gap-2 pt-4 border-t border-slate-800">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="اكتب سؤالك أو طلبك للمساعد الذكي..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={loading || !inputMessage.trim()}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 shadow-lg shadow-cyan-600/20"
          >
            إرسال 🚀
          </button>
        </form>

      </div>

    </div>
  );
}
