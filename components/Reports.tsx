
import React, { useMemo, useState } from 'react';
import { AppData, Student, Lesson, SchoolClass, SchoolTerm, Measure, Assessment } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts';

interface ReportsProps {
  data: AppData;
  initialClassId?: string;
}

type PeriodType = 'all' | 'term1' | 'term2' | 'term3' | 'custom';
type ViewMode = 'performance' | 'measures';

const Reports: React.FC<ReportsProps> = ({ data, initialClassId }) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId || (data.classes[0]?.id || ''));
  const [reportType, setReportType] = useState<'class' | 'student'>('class');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('performance');
  
  const [activePeriod, setActivePeriod] = useState<PeriodType>('all');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  const selectedClass = useMemo(() => 
    data.classes.find(c => c.id === selectedClassId), 
    [data.classes, selectedClassId]
  );

  const SYSTEM_DEFAULT_TERMS = useMemo(() => {
    const startYear = new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    return [
      { name: "1º Período", startDate: `${startYear}-09-08`, endDate: `${startYear}-12-16` },
      { name: "2º Período", startDate: `${startYear + 1}-01-05`, endDate: `${startYear + 1}-03-27` },
      { name: "3º Período", startDate: `${startYear + 1}-04-13`, endDate: `${startYear + 1}-06-05` }
    ];
  }, []);

  const activeRange = useMemo(() => {
    const terms = data.config?.calendar?.terms || SYSTEM_DEFAULT_TERMS;
    const yearStart = data.config?.calendar?.yearStart || `${new Date().getFullYear()-1}-09-08`;
    const yearEnd = data.config?.calendar?.yearEnd || `${new Date().getFullYear()}-06-30`;

    if (activePeriod === 'all') return { start: yearStart, end: yearEnd, label: "Todo o Ano Letivo" };
    if (activePeriod === 'custom') return { ...customRange, label: "Intervalo Personalizado" };
    
    const termMap: Record<string, string> = { 'term1': '1º', 'term2': '2º', 'term3': '3º' };
    const termPrefix = termMap[activePeriod];
    const term = terms.find(t => t.name.startsWith(termPrefix));
    
    return term 
      ? { start: term.startDate, end: term.endDate, label: term.name } 
      : { start: '', end: '', label: "Período não configurado" };
  }, [activePeriod, customRange, data.config?.calendar, SYSTEM_DEFAULT_TERMS]);

  const assessmentsChartData = useMemo(() => {
    if (!selectedClass || !selectedClass.assessments || selectedClass.assessments.length === 0) return [];

    let assessments = selectedClass.assessments.filter(a => {
      const d = a.date;
      const startOk = activeRange.start ? d >= activeRange.start : true;
      const endOk = activeRange.end ? d <= activeRange.end : true;
      return startOk && endOk;
    });

    if (assessments.length === 0) {
      assessments = selectedClass.assessments;
    }

    assessments = [...assessments].sort((a, b) => a.date.localeCompare(b.date));

    if (reportType === 'student' && selectedStudentId !== 'all') {
      const student = selectedClass.students.find(s => s.id === selectedStudentId);
      return assessments.map(a => {
        const grade = student?.grades?.[a.id];
        return {
          name: a.name,
          nota: (grade !== undefined && grade !== null) ? grade : null
        };
      }).filter(d => d.nota !== null);
    } else {
      return assessments.map(a => {
        const grades = selectedClass.students
          .map(s => s.grades?.[a.id])
          .filter(g => g !== undefined && g !== null) as number[];
        
        const avg = grades.length > 0 
          ? grades.reduce((acc, curr) => acc + curr, 0) / grades.length 
          : 0;
          
        return {
          name: a.name,
          nota: avg > 0 ? parseFloat(avg.toFixed(1)) : null
        };
      }).filter(d => d.nota !== null);
    }
  }, [selectedClass, reportType, selectedStudentId, activeRange]);

  const stats = useMemo(() => {
    if (!selectedClass) return null;
    
    const filteredL = selectedClass.lessons.filter(lesson => {
        const d = lesson.date;
        const startOk = activeRange.start ? d >= activeRange.start : true;
        const endOk = activeRange.end ? d <= activeRange.end : true;
        return startOk && endOk;
    });

    const allRecords = filteredL.flatMap(l => l.records);
    const targetRecords = (reportType === 'student' && selectedStudentId !== 'all')
      ? allRecords.filter(r => r.studentId === selectedStudentId)
      : allRecords;

    if (!targetRecords.length) return { avgParticipation: '0.0', avgTpc: '0.0', presenceRate: '0', totalLessons: 0 };
    
    const avgParticipation = targetRecords.reduce((acc, r) => acc + r.participation, 0) / targetRecords.length;
    const avgTpc = targetRecords.reduce((acc, r) => acc + r.tpc, 0) / targetRecords.length;
    const presenceCount = targetRecords.filter(r => r.status === 'Presente').length;
    const presenceRate = (presenceCount / targetRecords.length) * 100;

    return {
      avgParticipation: avgParticipation.toFixed(1),
      avgTpc: avgTpc.toFixed(1),
      presenceRate: presenceRate.toFixed(0),
      totalLessons: reportType === 'class' ? filteredL.length : targetRecords.length
    };
  }, [selectedClass, activeRange, reportType, selectedStudentId]);

  const participationChartData = useMemo(() => {
    if (!selectedClass) return [];
    
    const filteredL = selectedClass.lessons.filter(lesson => {
        const d = lesson.date;
        const startOk = activeRange.start ? d >= activeRange.start : true;
        const endOk = activeRange.end ? d <= activeRange.end : true;
        return startOk && endOk;
    }).sort((a,b) => a.date.localeCompare(b.date));

    return filteredL.map(lesson => {
      if (reportType === 'class') {
        const avgP = lesson.records.reduce((acc, r) => acc + r.participation, 0) / (lesson.records.length || 1);
        const avgT = lesson.records.reduce((acc, r) => acc + r.tpc, 0) / (lesson.records.length || 1);
        return { name: lesson.date, participação: parseFloat(avgP.toFixed(1)), tpc: parseFloat(avgT.toFixed(1)) };
      } else {
        const rec = lesson.records.find(r => r.studentId === selectedStudentId);
        return { name: lesson.date, participação: rec?.participation || 0, tpc: rec?.tpc || 0 };
      }
    });
  }, [selectedClass, activeRange, reportType, selectedStudentId]);

  const filteredMeasuresReport = useMemo(() => {
    if (!selectedClass) return [];
    const studentsToProcess = (reportType === 'student' && selectedStudentId !== 'all')
      ? selectedClass.students.filter(s => s.id === selectedStudentId)
      : selectedClass.students;

    return studentsToProcess.map(student => ({
      student,
      measures: (student.measures || []).filter(m => {
        const startOk = activeRange.start ? m.date >= activeRange.start : true;
        const endOk = activeRange.end ? m.date <= activeRange.end : true;
        return startOk && endOk;
      }).sort((a, b) => b.date.localeCompare(a.date))
    })).filter(item => item.measures.length > 0);
  }, [selectedClass, reportType, selectedStudentId, activeRange]);

  const getMeasureTypeColor = (type: string) => {
    switch(type) {
      case 'Universal': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Seletiva': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Adicional': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Adaptação': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-[40px] shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest">Visualização</label>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setViewMode('performance')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${viewMode === 'performance' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Performance</button>
              <button onClick={() => setViewMode('measures')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${viewMode === 'measures' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400'}`}>Medidas</button>
            </div>
          </div>
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest">Turma</label>
            <select value={selectedClassId} onChange={(e) => { setSelectedClassId(e.target.value); setSelectedStudentId('all'); }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500">
              {data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest">Âmbito</label>
            <select value={reportType} onChange={(e) => { setReportType(e.target.value as 'class' | 'student'); if(e.target.value === 'class') setSelectedStudentId('all'); }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500">
              <option value="class">Turma Completa</option>
              <option value="student">Aluno Individual</option>
            </select>
          </div>
          {reportType === 'student' && (
            <div>
              <label className="block text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest">Selecionar Aluno</label>
              <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">Escolher Aluno...</option>
                {selectedClass?.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest">Intervalo Temporal</label>
            <select value={activePeriod} onChange={(e) => setActivePeriod(e.target.value as PeriodType)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">Todo o Ano</option>
              <option value="term1">1º Período</option>
              <option value="term2">2º Período</option>
              <option value="term3">3º Período</option>
              <option value="custom">Personalizado...</option>
            </select>
          </div>
        </div>

        {viewMode === 'performance' && stats && (
          <div className="animate-in fade-in duration-300 space-y-6">
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-5 bg-blue-50/50 rounded-3xl border border-blue-100 flex flex-col items-center">
                <p className="text-blue-600 text-[9px] font-black uppercase tracking-widest mb-1.5">Participação</p>
                <p className="text-3xl font-black text-blue-900">{stats.avgParticipation}</p>
              </div>
              <div className="p-5 bg-purple-50/50 rounded-3xl border border-purple-100 flex flex-col items-center">
                <p className="text-purple-600 text-[9px] font-black uppercase tracking-widest mb-1.5">TPC</p>
                <p className="text-3xl font-black text-purple-900">{stats.avgTpc}</p>
              </div>
              <div className="p-5 bg-emerald-50/50 rounded-3xl border border-emerald-100 flex flex-col items-center">
                <p className="text-emerald-600 text-[9px] font-black uppercase tracking-widest mb-1.5">Assiduidade</p>
                <p className="text-3xl font-black text-emerald-900">{stats.presenceRate}%</p>
              </div>
              <div className="p-5 bg-slate-900 text-white rounded-3xl flex flex-col items-center">
                <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1.5">Nº Aulas</p>
                <p className="text-3xl font-black">{stats.totalLessons}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-5 w-1.5 bg-blue-500 rounded-full"></div>
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Monitorização de Aula</h4>
              </div>
              <div className="h-56 w-full bg-slate-50/30 rounded-[32px] p-6 border border-slate-100/50">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={participationChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9}} dy={10} />
                    <YAxis domain={[0, 5]} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9}} />
                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="participação" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={14} name="Participação" />
                    <Bar dataKey="tpc" fill="#a855f7" radius={[6, 6, 0, 0]} barSize={14} name="TPC" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-5 pt-4 border-t border-slate-100">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
                <div className="space-y-0.5">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Análise de Performance</p>
                  <h4 className="text-2xl font-black text-slate-900 leading-none">
                    {reportType === 'class' ? 'Desempenho em Avaliações (Média)' : 'Desempenho em Avaliações'}
                  </h4>
                </div>
                <div className="flex gap-5 pb-1 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase">Positiva</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase">Negativa</span>
                  </div>
                </div>
              </div>
              
              <div className="h-80 w-full bg-white rounded-[48px] p-8 border border-slate-100 shadow-inner overflow-hidden">
                {assessmentsChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={assessmentsChartData} margin={{ top: 40, right: 30, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} 
                        dy={15}
                      />
                      <YAxis 
                        domain={[0, 20]} 
                        ticks={[0, 5, 10, 15, 20]}
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} 
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '28px', border: 'none', boxShadow: '0 25px 30px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                        cursor={{fill: '#f8fafc', radius: 20}}
                      />
                      <Bar dataKey="nota" radius={[15, 15, 6, 6]} barSize={70}>
                        <LabelList 
                          dataKey="nota" 
                          position="top" 
                          offset={18} 
                          style={{ fill: '#0f172a', fontSize: '15px', fontWeight: '900' }} 
                        />
                        {assessmentsChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.nota! >= 10 ? '#10b981' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 shadow-sm">
                      <i className="fas fa-file-invoice text-2xl opacity-20"></i>
                    </div>
                    <p className="font-black text-[11px] uppercase tracking-widest">Sem dados de avaliação disponíveis</p>
                    <p className="text-[9px] text-slate-400 mt-2">Certifique-se que o aluno tem notas lançadas no separador "Avaliação"</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'measures' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-8">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-widest">Histórico de Medidas (DL 54/2018)</h3>
              <button onClick={() => window.print()} className="px-5 py-2.5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-lg">
                <i className="fas fa-print mr-2"></i> Exportar Relatório
              </button>
            </div>

            {filteredMeasuresReport.length > 0 ? (
              <div className="space-y-8">
                {filteredMeasuresReport.map(({ student, measures }) => (
                  <div key={student.id} className="bg-slate-50/50 p-8 rounded-[40px] border border-slate-100 transition-all hover:bg-white hover:shadow-xl group">
                    <div className="flex items-center gap-5 mb-6">
                      <img src={student.photo} className="w-16 h-16 rounded-[24px] object-cover shadow-lg border-4 border-white transition-transform group-hover:scale-105" />
                      <div>
                        <h4 className="text-base font-black text-slate-800 uppercase tracking-tight">{student.name}</h4>
                        <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest">{measures.length} medidas ativas</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4 pl-20">
                      {measures.map(m => (
                        <div key={m.id} className="flex gap-6 text-xs border-l-2 border-slate-200 pl-6 py-2 hover:border-purple-300 transition-colors">
                          <div className="w-24 shrink-0 flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 mb-1.5">{m.date}</span>
                            <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-xl inline-block w-fit border ${getMeasureTypeColor(m.type)}`}>
                              {m.type}
                            </span>
                          </div>
                          <p className="text-slate-600 font-bold text-[12px] leading-relaxed flex-1">{m.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-24 text-center text-slate-300 border-2 border-dashed border-slate-100 rounded-[48px]">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-search text-xl opacity-20"></i>
                </div>
                <p className="font-black text-[11px] uppercase tracking-widest">Nenhuma medida encontrada neste período</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
