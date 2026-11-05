'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import { useEffect, useState } from 'react';

type Report = { id: string; fileName: string; reading: { totalPages: number; processedPages: number; maxPages: number; complete: boolean; method: string } };

export default function PdfReadingHistory({ projectId, refreshKey }: { projectId: string; refreshKey: number }) {
  const { text: ui } = useUiTranslation();

  const [state, setState] = useState<{ projectId: string; reports: Report[]; error: string } | null>(null);
  const reports = state?.projectId === projectId ? state.reports : [];
  const error = state?.projectId === projectId ? state.error : '';
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/academic/parse-pdf?projectId=${encodeURIComponent(projectId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((body) => { if (!controller.signal.aborted) setState({ projectId, reports: body.reports || [], error: '' }); })
      .catch(() => { if (!controller.signal.aborted) setState({ projectId, reports: [], error: 'تعذر استرجاع تقارير القراءة؛ أعد تحميل الصفحة للمحاولة.' }); });
    return () => controller.abort();
  }, [projectId, refreshKey]);
  return <section aria-label={ui("تقارير استخراج PDF المحفوظة")} className="mb-4 space-y-3">
    <h3 className="font-semibold">{ui("تقارير القراءة المحفوظة")}</h3>
    <p className="text-sm leading-7">{ui("التقرير يصف الاستخراج فقط؛ ليس تحليلًا علميًا ولا إضافة دراسة إلى مكتبة المراجع. التحليلات المحفوظة تظهر مع نصوصها أعلاه.")}</p>
    {error && <p role="alert" className="text-sm text-red-700">{ui(error)}</p>}
    {reports.map((report) => <div key={report.id} className="rounded-lg border p-3 text-sm leading-7 break-words">
      <p>{report.fileName}</p>
      <p>{ui("عولجت")}{' '}{report.reading.processedPages} {ui("من")}{' '}{report.reading.totalPages} {ui("صفحة؛ الحد")}{' '}{report.reading.maxPages} {ui("صفحة.")}</p>
      <p>{report.reading.complete ? ui("اكتمل استخراج طبقة النص؛ ليس ضمانًا لاكتمال المحتوى العلمي.") : ui("القراءة غير مكتملة أو تحتاج مراجعة.")} {report.reading.method === 'external-ocr' ? ui("نسخ خارجي؛ دقته تحتاج مراجعتك.") : ui("استخراج طبقة النص.")}</p>
    </div>)}
  </section>;
}
