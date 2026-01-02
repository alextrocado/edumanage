
import React, { useState, useEffect, useRef } from 'react';
import { Student, Lesson, AttendanceRecord, PresenceStatus } from '../types';
import StarRating from './StarRating';

interface LessonLogProps {
  students: Student[];
  onSave: (lesson: Lesson) => void;
  onCancel: () => void;
  initialLesson?: Lesson;
}

const LessonLog: React.FC<LessonLogProps> = ({ students, onSave, onCancel, initialLesson }) => {
  const [date, setDate] = useState(initialLesson?.date || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(initialLesson?.time || '08:00');
  const [duration, setDuration] = useState<number>(initialLesson?.duration || 50);
  const [description, setDescription] = useState(initialLesson?.description || '');
  const durationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Foco automático no campo de duração para facilitar a edição rápida solicitada
    if (initialLesson && durationInputRef.current) {
      durationInputRef.current.focus();
      durationInputRef.current.select();
    }
  }, [initialLesson]);

  const [records, setRecords] = useState<Record<string, AttendanceRecord>>(
    initialLesson?.records.reduce((acc, rec) => ({ ...acc, [rec.studentId]: rec }), {}) ||
    students.reduce((acc, student) => ({
      ...acc,
      [student.id]: {
        studentId: student.id,
        status: 'Presente',
        participation: 0,
        tpc: 0,
        occurrence: ''
      }
    }), {})
  );

  const updateRecord = (studentId: string, updates: Partial<AttendanceRecord>) => {
    setRecords(prev => ({ ...prev, [studentId]: { ...prev[studentId], ...updates } }));
  };

  const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialLesson?.id || crypto.randomUUID(),
      date,
      time,
      duration,
      description,
      records: Object.values(records)
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-200">
        <h3 className="text-2xl font-black mb-6 text-slate-900">Registo de Aula</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
          </div>
          <div className="md:col-span-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Hora Início</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
          </div>
          <div className="md:col-span-1">
            <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Duração (minutos)</label>
            <input 
              ref={durationInputRef}
              type="number" 
              value={duration} 
              onChange={(e) => setDuration(Number(e.target.value))} 
              className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-blue-900" 
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sumário</label>
            <input type="text" placeholder="Ex: Frações" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aluno</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Presença</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Participação</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">TPC</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ocorrência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedStudents.map(student => {
                const rec = records[student.id];
                return (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={student.photo} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                        <span className="font-bold text-slate-700 text-sm">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select value={rec?.status || 'Presente'} onChange={(e) => updateRecord(student.id, { status: e.target.value as PresenceStatus })} className={`text-xs font-black rounded-xl px-3 py-2 border outline-none uppercase transition-all ${rec?.status === 'Ausente' ? 'bg-red-50 border-red-200 text-red-700' : rec?.status === 'Atraso' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                        <option value="Presente">Presente</option>
                        <option value="Ausente">Ausente</option>
                        <option value="Atraso">Atraso</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 flex justify-center"><StarRating value={rec?.participation || 0} onChange={(val) => updateRecord(student.id, { participation: val })} /></td>
                    <td className="px-6 py-4 text-center"><StarRating value={rec?.tpc || 0} onChange={(val) => updateRecord(student.id, { tpc: val })} /></td>
                    <td className="px-6 py-4">
                      <input type="text" placeholder="Nota rápida..." value={rec?.occurrence || ''} onChange={(e) => updateRecord(student.id, { occurrence: e.target.value })} className="w-full text-sm border-b-2 border-transparent hover:border-slate-100 focus:border-blue-500 outline-none bg-transparent py-1 transition-all font-medium text-slate-600" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-3 sticky bottom-4 z-10">
        <button onClick={onCancel} className="bg-white border border-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-black shadow-xl hover:bg-slate-50 transition-all uppercase text-xs tracking-widest">Descartar</button>
        <button onClick={handleSubmit} className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-black shadow-xl hover:bg-black transition-all uppercase text-xs tracking-widest">Guardar Registo</button>
      </div>
    </div>
  );
};

export default LessonLog;
