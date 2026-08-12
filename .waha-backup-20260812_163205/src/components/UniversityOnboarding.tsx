'use client';
import React, { useState } from 'react';

const UNIVERSITIES = [
  'الجامعة الأردنية (University of Jordan)',
  'جامعة القاهرة (Cairo University)',
  'جامعة الملك سعود (King Saud University)',
  'الجامعة الأمريكية في بيروت (AUB)',
  'جامعة قطر (Qatar University)',
  'جامعة محمد الخامس (Mohammed V University)',
  'جامعة بغداد (Baghdad University)',
  'جامعة دمشق (Damascus University)',
  'جامعة عين شمس (Ain Shams University)',
  'جامعة الملك عبدالعزيز (King Abdulaziz University)',
  'جامعة الإمارات العربية المتحدة (UAEU)',
  'جامعة النجاح الوطنية (An-Najah National University)',
];

export default function UniversityOnboarding({
  projectId,
  onComplete,
}: {
  projectId: string;
  onComplete: (policy: string) => void;
}) {
  const [selectedUni, setSelectedUni] = useState(UNIVERSITIES[0]);
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let policyValue = selectedUni;
      if (manualFile) {
        policyValue = `Manual PDF Upload: ${manualFile.name}`;
      }

      const res = await fetch('/api/academic/projects/policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, universityPolicy: policyValue }),
      });

      if (res.ok) {
        onComplete(policyValue);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
        <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
          إعدادات سياسة الجامعة (University Onboarding)
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          يرجى اختيار جامعتك أو رفع دليل الجامعة المعتمد لضبط معايير البحث والتوثيق بدقة قبل البدء بالمشروع.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              اختر الجامعة
            </label>
            <select
              value={selectedUni}
              onChange={(e) => {
                setSelectedUni(e.target.value);
                setManualFile(null);
              }}
              className="w-full p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
            >
              {UNIVERSITIES.map((uni) => (
                <option key={uni} value={uni}>
                  {uni}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t pt-4 border-gray-200 dark:border-gray-800">
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              أو ارفع دليل الجامعة يدويًا (PDF)
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => e.target.files?.[0] && setManualFile(e.target.files[0])}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {manualFile && (
              <p className="text-xs text-green-600 mt-1">تم اختيار الملف: {manualFile.name}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition duration-200 disabled:opacity-50 mt-4"
          >
            {loading ? 'جاري الحفظ...' : 'حفظ ومتابعة المشروع'}
          </button>
        </form>
      </div>
    </div>
  );
}
