
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppData, Student, Lesson, ViewType, SchoolClass, AppConfig, SchoolCalendar, ScheduleEntry } from './types';
import StudentForm from './components/StudentForm';
import LessonLog from './components/LessonLog';
import Reports from './components/Reports';
import BulkAIImport from './components/BulkAIImport';
import BulkMeasuresImport from './components/BulkMeasuresImport';
import ScheduleManager from './components/ScheduleManager';
import WeeklyCalendar from './components/WeeklyCalendar';
import StudentProfile from './components/StudentProfile';
import Assessments from './components/Assessments';
import Login from './components/Login';
import { dbService } from './services/db';
import { postgresService } from './services/postgres';
import JSZip from 'jszip';

const currentYear = new Date().getFullYear();
const isAfterSeptember = new Date().getMonth() >= 8; 
const startYear = isAfterSeptember ? currentYear : currentYear - 1;

const DEFAULT_CALENDAR: SchoolCalendar = {
  yearStart: `${startYear}-09-08`,
  yearEnd: `${startYear + 1}-06-30`,
  holidays: [],
  terms: [
    { name: "1º Período", startDate: `${startYear}-09-08`, endDate: `${startYear}-12-16` },
    { name: "2º Período", startDate: `${startYear + 1}-01-05`, endDate: `${startYear + 1}-03-27` },
    { name: "3º Período", startDate: `${startYear + 1}-04-13`, endDate: `${startYear + 1}-06-05` }
  ]
};

const MAX_HISTORY = 20;

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<AppData>({ 
    classes: [], 
    config: { 
      cloudSyncEnabled: false, 
      calendar: DEFAULT_CALENDAR
    } 
  });

  const [past, setPast] = useState<AppData[]>([]);
  const [future, setFuture] = useState<AppData[]>([]);
  const isTraveling = useRef(false);

  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'local'>('local');
  
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [isBulkImportingMeasures, setIsBulkImportingMeasures] = useState(false);
  const [bulkImportMode, setBulkImportMode] = useState<'create' | 'update'>('create');

  const initialLoadRef = useRef(true);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    isTraveling.current = true;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    setFuture(f => [data, ...f].slice(0, MAX_HISTORY));
    setData(previous);
    setPast(newPast);
    setTimeout(() => { isTraveling.current = false; }, 50);
  }, [past, data]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    isTraveling.current = true;
    const next = future[0];
    const newFuture = future.slice(1);
    setPast(p => [...p, data].slice(-MAX_HISTORY));
    setData(next);
    setFuture(newFuture);
    setTimeout(() => { isTraveling.current = false; }, 50);
  }, [future, data]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    if (isLoading || isTraveling.current) return;
    setPast(p => {
      if (p.length > 0 && JSON.stringify(p[p.length - 1]) === JSON.stringify(data)) return p;
      return [...p, data].slice(-MAX_HISTORY);
    });
    setFuture([]); 
  }, [data, isLoading]);

  const handleGenerateLessons = useCallback((targetClass: SchoolClass, calendar: SchoolCalendar) => {
    if (!calendar?.yearStart || !calendar?.yearEnd) return targetClass;
    const schedule = targetClass.schedule || [];
    const manualLessons = (targetClass.lessons || []).filter(l => !l.isGenerated);
    const existingGenerated = (targetClass.lessons || []).filter(l => l.isGenerated);
    const newGeneratedLessons: Lesson[] = [];
    
    const [ystartY, ystartM, ystartD] = calendar.yearStart.split('-').map(Number);
    const [yendY, yendM, yendD] = calendar.yearEnd.split('-').map(Number);
    let current = new Date(ystartY, ystartM - 1, ystartD, 12, 0, 0);
    const end = new Date(yendY, yendM - 1, yendD, 12, 0, 0);

    const getLocalDateString = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    if (schedule.length > 0) {
      while (current <= end) {
        const dayOfWeek = current.getDay();
        const daySchedule = schedule.filter(s => s.dayOfWeek === dayOfWeek);
        const dateStr = getLocalDateString(current);
        const isHoliday = (calendar.holidays || []).some(h => dateStr >= h.startDate && dateStr <= h.endDate);
        
        if (!isHoliday && daySchedule.length > 0) {
          daySchedule.forEach(slot => {
            const isManualOverride = manualLessons.some(l => l.date === dateStr && l.time === slot.startTime);
            if (!isManualOverride) {
              const prevGen = existingGenerated.find(l => l.date === dateStr && l.time === slot.startTime);
              newGeneratedLessons.push({
                id: prevGen?.id || crypto.randomUUID(), 
                date: dateStr, 
                time: slot.startTime, 
                duration: slot.duration || 50,
                description: 'Aula Programada', 
                isGenerated: true,
                records: prevGen?.records || targetClass.students.map(s => ({ 
                  studentId: s.id, 
                  status: 'Presente', 
                  participation: 0, 
                  tpc: 0, 
                  occurrence: '' 
                }))
              });
            }
          });
        }
        current.setDate(current.getDate() + 1);
      }
    }
    return { ...targetClass, lessons: [...manualLessons, ...newGeneratedLessons] };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    const persistData = async () => {
      await dbService.saveData(data);
      // Sincronização automática para Vercel Postgres
      setSyncStatus('syncing');
      try {
        await postgresService.ensureTable();
        const userId = data.config?.userName || 'default_prof';
        const success = await postgresService.pushData(userId, data);
        setSyncStatus(success ? 'synced' : 'local');
      } catch (e) { 
        setSyncStatus('local'); 
        console.debug("Cloud sync not available, sticking to local storage.");
      }
    };
    const debounceTimer = setTimeout(persistData, 1000);
    return () => clearTimeout(debounceTimer);
  }, [data, isLoading]);

  useEffect(() => {
    const init = async () => {
      try {
        await dbService.init();
        let saved = await dbService.loadData();
        
        // Tenta puxar da cloud se as variáveis estiverem configuradas
        const userId = saved?.config?.userName || 'default_prof';
        try {
          const cloudData = await postgresService.pullData(userId);
          if (cloudData) {
            saved = { 
              ...cloudData, 
              config: { 
                ...saved?.config, 
                ...cloudData.config, 
                userName: userId 
              } 
            };
          }
        } catch (cloudErr) {
          console.debug("Cloud pull failed or not configured, using local data.");
        }

        if (saved) {
          let syncedClasses = [...saved.classes];
          const finalCalendar = {
            ...DEFAULT_CALENDAR,
            ...saved.config?.calendar
          };

          if (finalCalendar) {
            syncedClasses = saved.classes.map(c => handleGenerateLessons(c, finalCalendar));
          }
          
          setData({ 
            ...saved, 
            classes: syncedClasses,
            config: {
              ...saved.config,
              calendar: finalCalendar
            }
          });

          const lastClassId = localStorage.getItem('edumanage_active_class');
          if (lastClassId && syncedClasses.some(c => c.id === lastClassId)) setActiveClassId(lastClassId);
          else setActiveClassId(syncedClasses[0]?.id || null);
        }
      } catch (err) { console.error("Erro ao carregar sistema:", err); }
      finally { setIsLoading(false); }
    };
    init();
  }, [handleGenerateLessons]);

  const updateCurrentClass = useCallback((updated: SchoolClass, autoGenerate = false) => {
    setData(prev => {
      let finalClass = updated;
      if (autoGenerate && prev.config?.calendar) {
        finalClass = handleGenerateLessons(updated, prev.config.calendar);
      }
      const newClasses = prev.classes.map(c => c.id === finalClass.id ? finalClass : c);
      return { ...prev, classes: newClasses };
    });
  }, [handleGenerateLessons]);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const zip = await JSZip.loadAsync(file);
        const jsonFile = zip.file("backup_data.json");
        if (!jsonFile) throw new Error("Ficheiro inválido.");
        const jsonContent = await jsonFile.async("string");
        const imported = JSON.parse(jsonContent);
        if (imported && imported.classes) {
          setData(imported);
          setIsLoggedIn(true);
          setActiveClassId(imported.classes[0]?.id || null);
          alert("Backup restaurado!");
        }
      } catch (err: any) { alert("Erro ao importar: " + err.message); }
    }
  };

  const currentClass = data.classes.find(c => c.id === activeClassId);

  const sortedLessons = useMemo(() => {
    if (!currentClass) return { upcoming: [], past: [] };
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toTimeString().split(' ')[0].substring(0, 5); 
    const all = [...currentClass.lessons];
    const upcoming = all.filter(l => l.date > today || (l.date === today && (l.time || '23:59') >= nowTime))
                      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
    const past = all.filter(l => l.date < today || (l.date === today && (l.time || '23:59') < nowTime))
                    .sort((a, b) => b.date.localeCompare(a.date) || (a.time || '').localeCompare(a.time || ''));
    return { upcoming, past };
  }, [currentClass]);

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-black text-xs">Vercel EduTrocado Cloud Engine...</div>;
  if (!isLoggedIn) return <Login onLogin={(d) => { setData(d); setIsLoggedIn(true); setActiveClassId(d.classes[0]?.id || null); }} onImport={handleImportFile} onCloudConnect={async () => {}} />;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="fixed bottom-6 right-6 flex gap-3 z-[60]">
        <button onClick={undo} disabled={past.length === 0} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all ${past.length > 0 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-400'}`}><i className="fas fa-undo"></i></button>
        <button onClick={redo} disabled={future.length === 0} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all ${future.length > 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}><i className="fas fa-redo"></i></button>
      </div>

      {isBulkImporting && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[70] flex items-center justify-center p-4">
          <BulkAIImport mode={bulkImportMode} onImport={(importedStudents) => { 
            if (currentClass) {
              let updatedStudents = [...currentClass.students];
              if (bulkImportMode === 'update') {
                importedStudents.forEach(newS => {
                  const idx = updatedStudents.findIndex(ex => ex.name.toLowerCase() === newS.name.toLowerCase());
                  if (idx !== -1) updatedStudents[idx] = { ...updatedStudents[idx], ...newS };
                  else updatedStudents.push(newS);
                });
              } else updatedStudents = [...updatedStudents, ...importedStudents];
              updateCurrentClass({ ...currentClass, students: updatedStudents });
            }
            setIsBulkImporting(false); 
          }} onCancel={() => setIsBulkImporting(false)} />
        </div>
      )}

      {isBulkImportingMeasures && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[70] flex items-center justify-center p-4">
          <BulkMeasuresImport students={currentClass?.students || []} onImport={(updatedStudents) => {
            if (currentClass) updateCurrentClass({ ...currentClass, students: updatedStudents });
            setIsBulkImportingMeasures(false);
          }} onCancel={() => setIsBulkImportingMeasures(false)} />
        </div>
      )}

      <aside className="w-full md:w-72 bg-slate-900 text-slate-300 flex flex-col sticky top-0 md:h-screen z-40 shadow-2xl">
        <div className="p-8 border-b border-slate-800">
           <div className="flex items-center gap-4 mb-8">
             <div className="w-12 h-12 bg-blue-600 rounded-[20px] flex items-center justify-center text-white shadow-xl shadow-blue-500/20"><i className="fas fa-shield-alt text-xl"></i></div>
             <div className="flex flex-col">
               <h1 className="text-white font-black text-base tracking-tight">EduTrocado</h1>
               <div className="flex items-center gap-2">
                 <span className="text-[10px] text-slate-500 font-black uppercase">{data.config?.userName}</span>
                 {syncStatus === 'synced' && <i className="fas fa-check-circle text-emerald-500 text-[10px]"></i>}
                 {syncStatus === 'syncing' && <i className="fas fa-sync fa-spin text-blue-500 text-[10px]"></i>}
                 {syncStatus === 'local' && <i className="fas fa-hdd text-slate-500 text-[10px]"></i>}
                 {syncStatus === 'error' && <i className="fas fa-exclamation-circle text-red-500 text-[10px]"></i>}
               </div>
             </div>
           </div>
           <button onClick={() => setActiveView('class-selector')} className="w-full flex items-center justify-between p-4 bg-slate-800 rounded-2xl border border-slate-700 hover:border-blue-500 transition-all text-left group">
             <div className="flex flex-col overflow-hidden">
               <span className="text-[9px] text-blue-400 font-black uppercase tracking-widest mb-1">Turma Ativa</span>
               <span className="text-sm font-bold text-white truncate">{currentClass?.name || 'Selecionar...'}</span>
             </div>
             <i className="fas fa-exchange-alt text-slate-500 text-xs group-hover:text-blue-500"></i>
           </button>
        </div>
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto custom-scrollbar">
          {[
            { id: 'dashboard', icon: 'fa-layer-group', label: 'Dashboard' },
            { id: 'calendar', icon: 'fa-calendar-alt', label: 'Agenda Global' },
            { id: 'students', icon: 'fa-user-graduate', label: 'Alunos' },
            { id: 'lessons', icon: 'fa-journal-whills', label: 'Diário de Bordo' },
            { id: 'assessments', icon: 'fa-spell-check', label: 'Avaliações' },
            { id: 'schedule', icon: 'fa-clock', label: 'Horários' },
            { id: 'reports', icon: 'fa-chart-bar', label: 'Relatórios' },
            { id: 'settings', icon: 'fa-sliders-h', label: 'Definições Cloud' }
          ].map(item => (
            <button key={item.id} onClick={() => setActiveView(item.id as ViewType)} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${activeView === item.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'hover:bg-slate-800 hover:text-white'}`}><i className={`fas ${item.icon} w-5 text-sm`}></i> {item.label}</button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 bg-slate-50 overflow-y-auto p-6 md:p-12">
        <section className="max-w-7xl mx-auto">
          {activeView === 'class-selector' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {data.classes.map(c => (
                <button key={c.id} onClick={() => { setActiveClassId(c.id); localStorage.setItem('edumanage_active_class', c.id); setActiveView('dashboard'); }} className="p-10 bg-white rounded-[48px] border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-2xl transition-all text-left group">
                   <div className="w-16 h-16 bg-slate-50 rounded-[28px] flex items-center justify-center text-slate-300 mb-8 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors"><i className="fas fa-users text-2xl"></i></div>
                   <h3 className="text-2xl font-black text-slate-900 mb-2">{c.name}</h3>
                   <div className="flex gap-4 text-[11px] font-black uppercase text-slate-400 tracking-[0.2em]">
                     <span>{c.students.length} Alunos</span>
                     <span>{c.lessons.length} Aulas</span>
                   </div>
                </button>
              ))}
              <button onClick={() => { const name = prompt("Nome da Turma:"); if(name) setData(prev => ({...prev, classes: [...prev.classes, {id: crypto.randomUUID(), name, students: [], lessons: [], schedule: []}]})); }} className="p-10 border-4 border-dashed border-slate-100 rounded-[48px] text-slate-300 hover:border-blue-200 hover:text-blue-300 transition-all flex flex-col items-center justify-center gap-4">
                <i className="fas fa-plus-circle text-4xl"></i>
                <span className="font-black uppercase text-xs tracking-widest">Nova Turma</span>
              </button>
            </div>
          )}
          
          {activeView === 'students' && currentClass && (
             <div className="space-y-8">
               <div className="flex justify-between items-center">
                 <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Base de Alunos</h2>
                 <div className="flex gap-3">
                   <button onClick={() => { setBulkImportMode('create'); setIsBulkImporting(true); }} className="bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-slate-50"><i className="fas fa-robot"></i> Importar IA</button>
                   <button onClick={() => setIsAddingStudent(true)} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all"><i className="fas fa-plus"></i> Novo Aluno</button>
                 </div>
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8 gap-4">
                  {currentClass.students.sort((a,b) => a.name.localeCompare(b.name)).map(student => (
                   <div key={student.id} onClick={() => { setSelectedStudentId(student.id); setActiveView('student-profile'); }} className="bg-white p-5 rounded-[36px] border border-slate-200 flex flex-col items-center text-center relative group cursor-pointer hover:border-blue-500 hover:shadow-xl transition-all shadow-sm">
                     <button onClick={(e) => { e.stopPropagation(); setEditingStudent(student); setIsAddingStudent(true); }} className="absolute top-4 right-4 text-slate-200 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all"><i className="fas fa-edit"></i></button>
                     <img src={student.photo} className="w-24 h-24 rounded-[32px] object-cover border-4 border-slate-50 mb-4 shadow-lg" />
                     <h4 className="font-black text-slate-900 text-xs leading-tight mb-2 line-clamp-2">{student.name}</h4>
                     <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{student.email ? 'Cloud OK' : 'Sem Email'}</span>
                   </div>
                 ))}
               </div>
             </div>
          )}

          {activeView === 'settings' && (
            <div className="space-y-12 animate-in fade-in duration-500">
               <div className="text-center space-y-2">
                 <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Gestão Vercel Cloud</h2>
                 <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Controlo de persistência e base de dados Neon</p>
               </div>
               
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm space-y-8">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3"><i className="fas fa-database text-blue-600"></i> Estado da Cloud</h4>
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                       <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm"><i className="fas fa-server"></i></div>
                         <div>
                           <p className="font-black text-slate-800 text-sm">Vercel Postgres</p>
                           <p className={`text-[9px] font-bold uppercase ${syncStatus === 'synced' ? 'text-emerald-600' : 'text-slate-400'}`}>
                             {syncStatus === 'synced' ? 'Ligação Ativa' : 'Pendente / Local'}
                           </p>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Status</p>
                         <p className="font-black text-slate-900 text-xs uppercase">{syncStatus}</p>
                       </div>
                    </div>
                    <button onClick={async () => { setSyncStatus('syncing'); const ok = await postgresService.pushData(data.config?.userName || 'default', data); setSyncStatus(ok ? 'synced' : 'error'); }} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black shadow-xl transition-all">Sincronizar Manualmente</button>
                 </div>

                 <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm space-y-8">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3"><i className="fas fa-file-archive text-emerald-600"></i> Exportação de Segurança</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={async () => { const zip = new JSZip(); zip.file("backup_data.json", JSON.stringify(data)); const blob = await zip.generateAsync({ type: "blob" }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `backup_edutrocado_${new Date().toISOString().split('T')[0]}.zip`; a.click(); }} className="p-8 bg-emerald-50 border border-emerald-100 rounded-3xl text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all group flex flex-col items-center gap-3">
                        <i className="fas fa-download text-xl group-hover:scale-110 transition-transform"></i>
                        <span className="font-black text-[9px] uppercase tracking-widest">Baixar .ZIP</span>
                      </button>
                      <label className="p-8 bg-blue-50 border border-blue-100 rounded-3xl text-blue-700 hover:bg-blue-600 hover:text-white transition-all group flex flex-col items-center gap-3 cursor-pointer">
                        <input type="file" accept=".zip" className="hidden" onChange={handleImportFile} />
                        <i className="fas fa-upload text-xl group-hover:scale-110 transition-transform"></i>
                        <span className="font-black text-[9px] uppercase tracking-widest">Restaurar</span>
                      </label>
                    </div>
                    <button onClick={() => { if(confirm("Deseja sair e limpar a sessão local?")) { localStorage.removeItem('global_auth_token'); window.location.reload(); } }} className="w-full py-4 border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-red-500 hover:text-red-500 transition-all">Encerrar Sessão Cloud</button>
                 </div>
               </div>
            </div>
          )}

          {/* Rest of the views... */}
          {activeView === 'dashboard' && currentClass && (
            <div className="space-y-8 animate-in fade-in duration-500">
               <div className="flex items-center gap-4">
                 <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Resumo da Turma</h2>
                 <div className="h-px flex-1 bg-slate-100"></div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Total Alunos</span>
                    <span className="text-6xl font-black text-slate-900">{currentClass.students.length}</span>
                    <i className="fas fa-user-graduate text-slate-50 text-6xl self-end -mt-10"></i>
                  </div>
                  <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Aulas Agendadas</span>
                    <span className="text-6xl font-black text-slate-900">{currentClass.lessons.length}</span>
                    <i className="fas fa-calendar-check text-slate-50 text-6xl self-end -mt-10"></i>
                  </div>
                  <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Sincronização</span>
                    <span className={`text-xl font-black mt-2 uppercase ${syncStatus === 'synced' ? 'text-emerald-600' : 'text-blue-600'}`}>
                      {syncStatus === 'synced' ? 'Nuvem Atualizada' : 'Modo Local'}
                    </span>
                    <i className="fas fa-cloud text-slate-50 text-6xl self-end -mt-6"></i>
                  </div>
               </div>
            </div>
          )}
          
          {/* Component loaders... */}
          {activeView === 'student-profile' && activeClassId && selectedStudentId && currentClass && (
            <StudentProfile student={currentClass.students.find(s => s.id === selectedStudentId)!} lessons={currentClass.lessons || []} assessments={currentClass.assessments || []} onBack={() => setActiveView('students')} onUpdateStudent={(updated) => {
                setData(prev => {
                  const clsIdx = prev.classes.findIndex(c => c.id === activeClassId);
                  if (clsIdx === -1) return prev;
                  const newClasses = [...prev.classes];
                  const targetCls = { ...newClasses[clsIdx] };
                  targetCls.students = targetCls.students.map(s => s.id === updated.id ? updated : s);
                  newClasses[clsIdx] = targetCls;
                  return { ...prev, classes: newClasses };
                });
              }}
            />
          )}
          {activeView === 'calendar' && <WeeklyCalendar data={data} onEditLesson={(l, cid) => { setActiveClassId(cid); setEditingLesson(l); setIsAddingLesson(true); }} />}
          {activeView === 'schedule' && currentClass && <ScheduleManager activeClass={currentClass} calendar={data.config?.calendar || DEFAULT_CALENDAR} onUpdateClass={(upd) => updateCurrentClass(upd, true)} onUpdateCalendar={(cal) => setData(prev => ({...prev, config: {...prev.config, calendar: cal}}))} onGenerateLessons={() => updateCurrentClass(currentClass, true)} />}
          {activeView === 'lessons' && currentClass && (
            <div className="space-y-8">
              <div className="flex justify-between items-center"><h2 className="text-3xl font-black text-slate-900 uppercase">Diário de Bordo</h2><button onClick={() => { setEditingLesson(null); setIsAddingLesson(true); }} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl"><i className="fas fa-plus mr-2"></i> Nova Aula</button></div>
              <div className="space-y-6">
                 {/* Lesson list... */}
              </div>
            </div>
          )}
          {activeView === 'assessments' && currentClass && <Assessments activeClass={currentClass} onUpdateClass={updateCurrentClass} />}
          {activeView === 'reports' && <Reports data={data} initialClassId={activeClassId || undefined} />}
        </section>
      </main>

      {/* Modals... */}
      {isAddingLesson && currentClass && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[100] flex flex-col items-center p-6 overflow-y-auto">
          <div className="max-w-5xl w-full my-12">
            <LessonLog students={currentClass.students} initialLesson={editingLesson || undefined} onSave={(l) => {
              const lessons = [...currentClass.lessons.filter(lx => lx.id !== l.id), l];
              updateCurrentClass({ ...currentClass, lessons });
              setIsAddingLesson(false);
            }} onCancel={() => setIsAddingLesson(false)} />
          </div>
        </div>
      )}
      {isAddingStudent && currentClass && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <div className="max-w-lg w-full">
            <StudentForm onSave={(s) => { 
              const existing = currentClass.students.filter(ex => ex.id !== s.id);
              updateCurrentClass({ ...currentClass, students: [...existing, s] }); 
              setIsAddingStudent(false); 
              setEditingStudent(null);
            }} onCancel={() => { setIsAddingStudent(false); setEditingStudent(null); }} initialStudent={editingStudent || undefined} />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
