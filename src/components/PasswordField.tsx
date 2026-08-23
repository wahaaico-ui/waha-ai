'use client';

import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { passwordStrength } from '@/lib/password-policy';

type Props = { value: string; onChange: (value: string) => void; id?: string; label?: string; required?: boolean; autoComplete?: string; showRequirements?: boolean; showGuardian?: boolean };

const meter = { rose: 'bg-rose-500', amber: 'bg-amber-500', emerald: 'bg-emerald-500' };
const text = { rose: 'text-rose-600', amber: 'text-amber-600', emerald: 'text-emerald-600' };

function PasswordGuardian({ covering }: { covering: boolean }) {
  return <div aria-hidden="true" className="relative mx-auto mb-4 h-20 w-20"><div className="absolute inset-x-2 bottom-0 h-14 rounded-[1.4rem] bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg shadow-blue-600/20" /><div className="absolute left-1/2 top-1 h-12 w-12 -translate-x-1/2 rounded-full border-4 border-white bg-blue-100"><span className={`absolute top-4 h-2 w-2 rounded-full bg-slate-800 transition-all duration-300 ${covering ? 'left-2 opacity-0' : 'left-2'}`} /><span className={`absolute top-4 h-2 w-2 rounded-full bg-slate-800 transition-all duration-300 ${covering ? 'right-2 opacity-0' : 'right-2'}`} /><span className={`absolute top-3 h-px w-3 bg-slate-800 transition-all duration-300 ${covering ? 'left-1' : 'left-2 opacity-0'}`} /><span className={`absolute top-3 h-px w-3 bg-slate-800 transition-all duration-300 ${covering ? 'right-1' : 'right-2 opacity-0'}`} /></div><span className={`absolute top-8 h-5 w-7 rounded-full border-4 border-blue-600 bg-blue-500 transition-all duration-300 ${covering ? 'left-0 rotate-[-18deg]' : 'left-[-1.1rem] translate-y-8'}`} /><span className={`absolute top-8 h-5 w-7 rounded-full border-4 border-blue-600 bg-blue-500 transition-all duration-300 ${covering ? 'right-0 rotate-[18deg]' : 'right-[-1.1rem] translate-y-8'}`} /></div>;
}

export default function PasswordField({ value, onChange, id = 'password', label = 'كلمة المرور', required = true, autoComplete = 'new-password', showRequirements = true, showGuardian = true }: Props) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const strength = passwordStrength(value);
  return <div className="space-y-3">{showGuardian && <PasswordGuardian covering={focused || value.length > 0} />}<div><div className="mb-1.5 flex items-center justify-between"><label htmlFor={id} className="text-sm font-bold text-slate-700">{label}</label>{value && <span className={`inline-flex items-center gap-1 text-xs font-bold ${text[strength.color]}`}><ShieldCheck className="h-3.5 w-3.5" />{strength.label}</span>}</div><div className="relative"><input id={id} type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} autoComplete={autoComplete} minLength={8} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pe-12 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" required={required} /><button type="button" onClick={() => setVisible((current) => !current)} className="absolute inset-y-0 end-0 grid w-11 place-items-center text-slate-400 hover:text-blue-600" aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>{visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></div>{showRequirements && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="mb-3 flex gap-1" aria-label={`قوة كلمة المرور: ${strength.label}`}>{[1, 2, 3, 4, 5].map((part) => <span key={part} className={`h-1.5 flex-1 rounded-full ${part <= strength.score ? meter[strength.color] : 'bg-slate-200'}`} />)}</div><ul className="grid gap-1 text-xs sm:grid-cols-2">{strength.requirements.map((requirement) => <li key={requirement.id} className={requirement.met ? 'text-emerald-700' : 'text-slate-500'}>{requirement.met ? '✓' : '○'} {requirement.label}</li>)}</ul></div>}</div>;
}
