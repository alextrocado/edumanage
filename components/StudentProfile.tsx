
import React, { useState, useMemo } from 'react';
import { Student, Lesson, Measure, Assessment } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LabelList } from 'recharts';

interface StudentProfileProps {
  student: Student;
  lessons: Lesson[];
  assessments: Assessment[];
  onBack: () => void;
  onUpdateStudent: (updated: Student) => void;
}

const StudentProfile: React.FC<StudentProfileProps> = ({ student, lessons, assessments, onBack, onUpdateStudent }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'measures' | 'grades' | 'behavior'>('overview');
  const [editingMeasureId, setEditingMeasureId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formMeasure, setFormMeasure] = useState<Partial<Measure>>({
    date: new Date().toISOString().split('T')[0],
    type: 'Seletiva',
    description: ''
  });

  const studentLessons = useMemo(() => {
    return lessons
      .map(l => ({
        ...l,
        record: l.records.find(r => r.studentId === student.id)
      }))
      .filter(l => l.record !== undefined)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [lessons, student.id]);

  const stats = useMemo(() => {
    if (studentLessons.length === 0) return null;

    const validRecords = studentLessons.map(l => l.record!).filter(r => r !== undefined);
    const participationAvg = validRecords.reduce((acc, r) => acc + r.participation, 0) / (validRecords.length || 1);
    const tpcAvg = validRecords.reduce((acc, r) => acc + r.tpc, 0) / (validRecords.length || 1);
    
    const presenceCount = validRecords.filter(r => r.status === 'Presente').length;
    const absenceCount = validRecords.filter(r => r.status === 'Ausente').length;
    const delayCount = validRecords.filter(r => r.status === 'Atraso').length;
    const occurrences = studentLessons.filter(l => l.record?.occurrence).map(l => ({
        date: l.date,
        text: l.record!.occurrence,
        status: l.record!.status
    }));

    return {
      participationAvg: participationAvg.toFixed(1),
      tpcAvg: tpcAvg.toFixed(1),
      presenceRate: ((presenceCount / (validRecords.length || 1)) * 100).toFixed(0),
      occurrenceCount: occurrences.length,
      occurrences,
      presenceData: [
        { name: 'Presenças', value: presenceCount, color: '#10b981' },
        { name: 'Faltas', value: absenceCount, color: '#ef4444' },
        { name: 'Atrasos', value: delayCount, color: '#f59e0b' }
      ],
      chartData: studentLessons.map(l => ({
        date: l.date,
        participação: l.record?.participation || 0,
        tpc: l.record?.tpc || 0
      }))
    };
  }, [studentLessons]);

  const gradeHistory = useMemo(() => {
    return assessments
      .map(a => ({
        name: a.name,
        nota: student.grades?.[a.id],
        id: a.id,
        date: a.date
      }))
      .filter(g => g.nota !== undefined && g.nota !== null) as { name: string; nota: number; id: string; date: string }[];
  }, [assessments, student.grades]);

  const handleSaveMeasure = () => {
    if (!formMeasure.description || !formMeasure.date) return;
    const currentMeasures = student.measures ? [...student.measures] : [];
    let updatedMeasures;
    if (editingMeasureId) {
      updatedMeasures = currentMeasures.map(m => m.id === editingMeasureId ? { ...m, ...formMeasure } as Measure : m);
    } else {
      updatedMeasures = [...currentMeasures, {
        id: crypto.randomUUID(),
        date: formMeasure.date!,
        type: formMeasure.type!,
        description: formMeasure.description!,
      }];
    }
    onUpdateStudent({ ...student, measures: updatedMeasures });
    setEditingMeasureId(null);
    setShowAddForm(false);
    setFormMeasure({ date: new Date().toISOString().split('T')[0], type: 'Seletiva', description: '' });
  };

  const removeMeasure = (id: string) => {
    const updatedMeasures = (student.measures || []).filter(m => m.id !== id);
    onUpdateStudent({ ...student, measures: updatedMeasures });
    setDeletingId(null);
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 pb-24 max-w-7xl mx-auto">
      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row items-center gap-8">
        <div className="relative group">
          <img src={student.photo} className="w-32 h-32 rounded-[40px] object-cover border-4 border-slate-50 shadow-xl transition-transform group-hover:scale-105" />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-black border-2 border-white shadow-lg">ID</div>
        </div>
        <div className="flex-1 text-center md:text-left">
          <h3 className="text-3xl font-black text-slate-900 mb-1">{student.name}</h3>
          <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
            <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full">{student.email || 'Sem Email'}</span>
            <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-4 py-1.5 rounded-full">Turma Ativa</span>
          </div>
        </div>
        <button onClick={onBack} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-black transition-all shadow-lg hover:shadow-slate-200">
          <i className="fas fa-arrow-left mr-2"></i> Voltar
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-[28px] border border-slate-200 shadow-sm w-fit">
        <button onClick={() => setActiveTab('overview')} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Resumo</button>
        <button onClick={() => setActiveTab('grades')} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'grades' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Avaliações</button>
        <button onClick={() => setActiveTab('behavior')} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'behavior' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Comportamento</button>
        <button onClick={() => setActiveTab('measures')} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'measures' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Medidas</button>
      </div>

      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest block mb-2">Participação Média</span>
                <div className="flex items-end gap-1">
                    <span className="text-3xl font-black text-slate-900">{stats.participationAvg}</span>
                    <span className="text-xs text-slate-400 font-bold mb-1">/ 5.0</span>
                </div>
                <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${(parseFloat(stats.participationAvg)/5)*100}%` }}></div>
                </div>
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                <span className="text-[9px] font-black text-purple-500 uppercase tracking-widest block mb-2">Realização TPC</span>
                <div className="flex items-end gap-1">
                    <span className="text-3xl font-black text-slate-900">{stats.tpcAvg}</span>
                    <span className="text-xs text-slate-400 font-bold mb-1">/ 5.0</span>
                </div>
                <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500" style={{ width: `${(parseFloat(stats.tpcAvg)/5)*100}%` }}></div>
                </div>
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block mb-2">Assiduidade</span>
                <div className="flex items-end gap-1">
                    <span className="text-3xl font-black text-slate-900">{stats.presenceRate}%</span>
                </div>
                <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${stats.presenceRate}%` }}></div>
                </div>
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block mb-2">Ocorrências</span>
                <div className="flex items-end gap-1">
                    <span className="text-3xl font-black text-slate-900">{stats.occurrenceCount}</span>
                    <span className="text-xs text-slate-400 font-bold mb-1">registadas</span>
                </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm h-[400px]">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evolução em Aula</h4>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span><span className="text-[9px] font-bold text-slate-400 uppercase">Participação</span></div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-purple-500"></span><span className="text-[9px] font-bold text-slate-400 uppercase">TPC</span></div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height="80%">
                <AreaChart data={stats.chartData}>
                  <defs>
                    <linearGradient id="colorPart" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                  <YAxis domain={[0, 5]} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                  <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="participação" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPart)" strokeWidth={3} />
                  <Area type="monotone" dataKey="tpc" stroke="#a855f7" fillOpacity={0} strokeWidth={3} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col items-center">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest self-start mb-4">Resumo Assiduidade</h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.presenceData} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value">
                      {stats.presenceData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4 w-full mt-6">
                {stats.presenceData.map(d => (
                    <div key={d.name} className="text-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase block">{d.name}</span>
                        <span className="text-lg font-black text-slate-800">{d.value}</span>
                    </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'grades' && (
        <div className="animate-in fade-in duration-500">
           <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm min-h-[500px] flex flex-col">
              <div className="flex justify-between items-center mb-12">
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Análise de Performance</h4>
                  <p className="text-lg font-black text-slate-900">Desempenho em Avaliações</p>
                </div>
                <div className="flex gap-4">
                   <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                     <span className="text-[9px] font-black text-slate-400 uppercase">Positiva</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-red-500"></div>
                     <span className="text-[9px] font-black text-slate-400 uppercase">Negativa</span>
                   </div>
                </div>
              </div>

              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={gradeHistory} margin={{ top: 40, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} 
                      dy={10}
                    />
                    <YAxis 
                      domain={[0, 20]} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} 
                    />
                    <Tooltip 
                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                        cursor={{fill: '#f8fafc', radius: 12}}
                    />
                    <Bar dataKey="nota" radius={[12, 12, 4, 4]} barSize={60}>
                        <LabelList 
                          dataKey="nota" 
                          position="top" 
                          offset={15} 
                          style={{ fill: '#0f172a', fontSize: '14px', fontWeight: '900' }} 
                        />
                        {gradeHistory.map((entry, index) => (
                            <Cell key={index} fill={entry.nota >= 10 ? '#10b981' : '#ef4444'} />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {gradeHistory.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 py-20">
                    <i className="fas fa-chart-bar text-6xl mb-4 opacity-10"></i>
                    <p className="font-black text-xs uppercase tracking-[0.2em]">Nenhuma avaliação registada para este aluno</p>
                </div>
              )}
           </div>
        </div>
      )}

      {activeTab === 'behavior' && stats && (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Diário de Comportamento e Observações</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stats.occurrences.length > 0 ? (
                        stats.occurrences.sort((a,b) => b.date.localeCompare(a.date)).map((occ, idx) => (
                            <div key={idx} className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 hover:border-amber-200 transition-all">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-[10px] font-black text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100">{occ.date}</span>
                                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${
                                        occ.status === 'Presente' ? 'text-emerald-600 bg-emerald-50' : 
                                        occ.status === 'Atraso' ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
                                    }`}>{occ.status}</span>
                                </div>
                                <p className="text-slate-700 font-bold text-sm leading-relaxed">{occ.text}</p>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-2 py-20 text-center text-slate-300">
                            <i className="fas fa-comments text-5xl mb-4 opacity-10"></i>
                            <p className="font-black text-xs uppercase tracking-[0.2em]">Sem observações registadas em aula</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {activeTab === 'measures' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
             <div>
               <h4 className="font-black text-slate-900 uppercase text-sm tracking-tight">Medidas de Suporte à Aprendizagem</h4>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controlo de registos individuais (DL 54/2018)</p>
             </div>
             <button onClick={() => { setEditingMeasureId(null); setFormMeasure({ date: new Date().toISOString().split('T')[0], type: 'Seletiva', description: '' }); setShowAddForm(true); }} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
                <i className="fas fa-plus"></i> Adicionar Medida
             </button>
          </div>

          {showAddForm && (
            <div className="bg-slate-900 p-8 rounded-[40px] text-white animate-in zoom-in-95 duration-300 shadow-2xl">
               <h5 className="font-black mb-6 uppercase text-[10px] tracking-widest text-slate-400">{editingMeasureId ? 'Editar Medida' : 'Nova Medida'}</h5>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                 <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-2">Data da Medida</label>
                    <input type="date" value={formMeasure.date} onChange={e => setFormMeasure({...formMeasure, date: e.target.value})} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 text-white font-bold" />
                 </div>
                 <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-2">Tipo de Medida</label>
                    <select value={formMeasure.type} onChange={e => setFormMeasure({...formMeasure, type: e.target.value})} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 text-white font-bold">
                        <option value="Universal" className="bg-slate-900">Universal</option>
                        <option value="Seletiva" className="bg-slate-900">Seletiva</option>
                        <option value="Adicional" className="bg-slate-900">Adicional</option>
                        <option value="Adaptação" className="bg-slate-900">Adaptação Curricular</option>
                    </select>
                 </div>
               </div>
               <div className="mb-6">
                 <label className="block text-[9px] font-black text-slate-500 uppercase mb-2">Descrição e Objetivos</label>
                 <textarea value={formMeasure.description} onChange={e => setFormMeasure({...formMeasure, description: e.target.value})} placeholder="Descreva aqui a intervenção ou medida aplicada..." className="w-full bg-white/10 border border-white/10 rounded-2xl px-5 py-5 h-40 outline-none focus:ring-2 focus:ring-purple-500 font-medium text-slate-100" />
               </div>
               <div className="flex gap-3">
                 <button onClick={handleSaveMeasure} className="flex-1 py-4 bg-purple-600 rounded-2xl font-black text-sm hover:bg-purple-500 shadow-xl shadow-purple-900/20 transition-all">Guardar Registo</button>
                 <button onClick={() => setShowAddForm(false)} className="px-8 py-4 bg-white/10 rounded-2xl font-bold text-sm hover:bg-white/20 transition-all">Cancelar</button>
               </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {(student.measures || []).sort((a,b) => b.date.localeCompare(a.date)).map(m => (
               <div key={m.id} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative group hover:border-purple-500 transition-all flex flex-col min-h-[180px]">
                 <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    {deletingId === m.id ? (
                      <div className="flex gap-1">
                         <button onClick={() => removeMeasure(m.id)} className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black">CONFIRMAR</button>
                         <button onClick={() => setDeletingId(null)} className="bg-slate-100 text-slate-500 px-4 py-2 rounded-xl text-[10px] font-black">SAIR</button>
                      </div>
                    ) : (
                      <>
                         <button onClick={() => { setFormMeasure(m); setEditingMeasureId(m.id); setShowAddForm(true); }} className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><i className="fas fa-edit text-xs"></i></button>
                         <button onClick={() => setDeletingId(m.id)} className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all"><i className="fas fa-trash-alt text-xs"></i></button>
                      </>
                    )}
                 </div>
                 <div className="flex items-center gap-3 mb-6">
                   <span className="text-[10px] font-black bg-purple-50 text-purple-600 px-4 py-1.5 rounded-full border border-purple-100 uppercase">{m.date}</span>
                   <span className="text-[10px] font-black bg-slate-900 text-white px-4 py-1.5 rounded-full uppercase tracking-widest">{m.type}</span>
                 </div>
                 <p className="text-slate-700 font-bold text-sm leading-relaxed pr-8 whitespace-pre-wrap">{m.description}</p>
               </div>
             ))}
             {(!student.measures || student.measures.length === 0) && (
                <div className="col-span-full py-24 text-center text-slate-300 border-2 border-dashed border-slate-100 rounded-[40px]">
                    <i className="fas fa-folder-open text-5xl mb-4 opacity-10"></i>
                    <p className="font-black text-xs uppercase tracking-[0.2em]">Sem medidas de suporte registadas</p>
                </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentProfile;
