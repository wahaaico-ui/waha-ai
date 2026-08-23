import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { ownsProject } from '@/lib/supabase/authorization';

interface GenerateOptions {
  prompt: string;
  projectId?: string;
  userId?: string;
  supabase?: Awaited<ReturnType<typeof createServerClient>>;
  feature: string;
}

interface GenerateResult {
  output: string;
  confidenceLabel: string;
}

export async function generateStructured({
  prompt,
  projectId,
  userId,
  supabase: callerSupabase,
  feature,
}: GenerateOptions): Promise<GenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables.');
  }

  if (projectId) {
    if (!userId || !callerSupabase) {
      throw new Error('generateStructured: projectId requires userId and supabase to verify project ownership.');
    }
    if (!(await ownsProject(projectId, userId, callerSupabase))) {
      throw new Error('generateStructured: caller does not own the referenced project.');
    }
  }

const modelName = 'gemini-flash-latest';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const output = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // منطق بسيط لتحديد مستوى الثقة (confidenceLabel)
  let confidenceLabel = 'منخفض';
  const lowerPrompt = prompt.toLowerCase();
  if (
    lowerPrompt.includes('source') ||
    lowerPrompt.includes('citation') ||
    lowerPrompt.includes('مرجع') ||
    lowerPrompt.includes('سياق') ||
    lowerPrompt.includes('context')
  ) {
    confidenceLabel = 'عالي';
  } else if (prompt.length > 150) {
    confidenceLabel = 'متوسط';
  }

  // تسجيل العملية في جدول ai_generations_log إذا تم تمرير projectId
  if (projectId) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase.from('ai_generations_log').insert({
        project_id: projectId,
        feature,
        model: modelName,
        output,
        confidence_label: confidenceLabel,
        prompt_hash: Buffer.from(prompt).toString('base64').substring(0, 32),
      });
    }
  }

  return {
    output,
    confidenceLabel,
  };
}
