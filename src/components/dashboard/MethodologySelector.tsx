export default function MethodologySelector({ selected, onSelect }: { selected: string, onSelect: (m: string) => void }) {
  const methods = [
    { id: 'gap-analysis', title: 'Gap Analysis', desc: 'تحليل الفجوات البحثية' },
    { id: 'systematic-review', title: 'Systematic Review', desc: 'مراجعة منهجية (PRISMA)' },
    { id: 'lit-review', title: 'Literature Review', desc: 'تحليل الدراسات السابقة' },
  ];

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-400 mb-3">اختر المنهجية البحثية:</label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {methods.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={`p-4 rounded-xl border text-right transition-all ${selected === m.id ? 'bg-blue-900/20 border-blue-600 text-white' : 'bg-[#1F2937] border-gray-700 text-gray-400 hover:border-gray-500'}`}
          >
            <div className="font-bold text-sm">{m.title}</div>
            <div className="text-[10px] opacity-75">{m.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
