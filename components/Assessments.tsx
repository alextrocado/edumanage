
import React, { useState, useEffect, useMemo } from 'react';
import { SchoolClass, Student, Assessment } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

interface AssessmentsProps {
  activeClass: SchoolClass;
  onUpdateClass: (updated: SchoolClass) => void;
}

const Assessments: React.FC<AssessmentsProps> = ({ activeClass, onUpdateClass }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isImportingIA, setIsImportingIA] = useState(false);
  const [importStatus, setStatus] = useState("");
  const [newAssessment, setNewAssessment] = useState({ name: '', date: new Date().toISOString().split('T')[0] });
  
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearId, setConfirmClearId] = useState<string | null>(null);

  const assessments = useMemo(() => activeClass.assessments || [], [activeClass.assessments]);
  const students = useMemo(() => [...activeClass.students].sort((a, b) => a.name.localeCompare(b.name)), [activeClass.students]);

  useEffect(() => {
    if (confirmDeleteId || confirmClearId) {
      const timer = setTimeout(() => {
        setConfirmDeleteId(null);
        setConfirmClearId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmDeleteId, confirmClearId]);

  const normalizeName = (name: string) => {
    return name.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const isStudentMatch = (inputName: string, targetName: string) => {
    const partsA = normalizeName(inputName).split(' ').filter(p => p.length > 2);
    const partsB = normalizeName(targetName).split(' ').filter(p => p.length > 2);
    const matches = partsA.filter(part => partsB.includes(part)).length;
    return matches >= 2 || (partsA.length === 1 && partsB.includes(partsA[0]));
  };

  const handleAddAssessment = () => {
    if (!newAssessment.name) return;
    const assessment: Assessment = {
      id: crypto.randomUUID(),
      name: newAssessment.name,
      date: newAssessment.date
    };
    onUpdateClass({
      ...activeClass,
      assessments: [...assessments, assessment]
    });
    setIsAdding(false);
    setNewAssessment({ name: '', date: new Date().toISOString().split('T')[0] });
  };

  const handleUpdateGrade = (studentId: string, assessmentId: string, value: string) => {
    let numValue = value === '' ? undefined : parseFloat(value.replace(',', '.'));
    
    // Regra solicitada: Se a nota for inserida na escala 0-200, divide por 10 para passar a 0-20
    if (numValue !== undefined && !isNaN(numValue) && numValue > 20) {
      numValue = numValue / 10;
    }

    const updatedStudents = activeClass.students.map(s => {
      if (s.id === studentId) {
        const newGrades = { ...(s.grades || {}) };
        if (numValue === undefined || isNaN(numValue)) delete newGrades[assessmentId];
        else newGrades[assessmentId] = numValue;
        return { ...s, grades: newGrades };
      }
      return s;
    });
    onUpdateClass({ ...activeClass, students: updatedStudents });
  };

  const handleClearAction = (id: string) => {
    if (confirmClearId === id) {
      const updatedStudents = activeClass.students.map(student => {
        const grades = { ...(student.grades || {}) };
        delete grades[id];
        return { ...student, grades };
      });
      onUpdateClass({ ...activeClass, students: updatedStudents });
      setConfirmClearId(null);
    } else {
      setConfirmClearId(id);
      setConfirmDeleteId(null);
    }
  };

  const handleDeleteAction = (id: string) => {
    if (confirmDeleteId === id) {
      const updatedAssessments = assessments.filter(a => a.id !== id);
      const updatedStudents = activeClass.students.map(student => {
        const grades = { ...(student.grades || {}) };
        delete grades[id];
        return { ...student, grades };
      });
      onUpdateClass({
        ...activeClass,
        assessments: updatedAssessments,
        students: updatedStudents
      });
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setConfirmClearId(null);
    }
  };

  const handleBulkImportIA = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingIA(true);
    setStatus("Analisando pauta...");
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let imageBase64 = '';
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          imageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        }
      } else {
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
      }
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
            { text: "Analise esta pauta. Retorne JSON: { assessments: [{ name, date, grades: [{ studentName, grade }] }] }." }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              assessments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    date: { type: Type.STRING },
                    grades: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: { studentName: { type: Type.STRING }, grade: { type: Type.NUMBER } },
                        required: ["studentName", "grade"]
                      }
                    }
                  },
                  required: ["name", "date", "grades"]
                }
              }
            }
          }
        }
      });
      const data = JSON.parse(response.text || '{}');
      if (data.assessments) {
        let currentAssessments = [...assessments];
        let currentStudents = [...activeClass.students];
        for (const imp of data.assessments) {
          const id = crypto.randomUUID();
          currentAssessments.push({ id, name: imp.name, date: imp.date });
          for (const g of imp.grades) {
            const idx = currentStudents.findIndex(s => isStudentMatch(g.studentName, s.name));
            if (idx !== -1) {
              // Também aplicamos a normalização na importação por segurança
              let finalGrade = g.grade;
              if (finalGrade > 20) finalGrade = finalGrade / 10;
              
              currentStudents[idx] = { ...currentStudents[idx], grades: { ...(currentStudents[idx].grades || {}), [id]: finalGrade } };
            }
          }
        }
        onUpdateClass({ ...activeClass, assessments: currentAssessments, students: currentStudents });
      }
    } catch (err) { alert("Erro na IA."); } finally { setIsImportingIA(false); if (e.target) e.target.value = ""; }
  };

  const calculateStudentAvg = (student: Student) => {
    const activeAssIds = assessments.map(a => a.id);
    const validGrades = activeAssIds
      .map(id => student.grades?.[id])
      .filter(g => g !== undefined && g !== null) as number[];

    if (validGrades.length === 0) return '-';

    if (validGrades.length >= 5) {
      const lastGrade = validGrades[validGrades.length - 1];
      const otherGrades = validGrades.slice(0, -1);
      const minOther = Math.min(...otherGrades);
      const minIndex = otherGrades.indexOf(minOther);
      const remainingOthers = [...otherGrades];
      remainingOthers.splice(minIndex, 1);
      const finalGrades = [...remainingOthers, lastGrade];
      const sum = finalGrades.reduce((a, b) => a + b, 0);
      return (sum / finalGrades.length).toFixed(1);
    }

    const sum = validGrades.reduce((a, b) => a + b, 0);
    return (sum / validGrades.length).toFixed(1);
  };

  const calculateClassAvg = (assessmentId: string) => {
    const grades = students
      .map(s => s.grades?.[assessmentId])
      .filter(g => g !== undefined) as number[];
    if (grades.length === 0) return '-';
    return (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="bg-white p-4 md:p-6 rounded-[32px] shadow-sm border border-slate-200 relative overflow-hidden">
        {isImportingIA && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-black text-slate-900 uppercase text-[10px] tracking-widest">{importStatus}</p>
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase leading-none">Pauta de Avaliação</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Normalização: > 20 divide por 10</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <label className="flex-1 cursor-pointer px-4 py-2 bg-purple-600 text-white rounded-xl font-black text-[10px] hover:bg-purple-700 transition-all flex items-center justify-center gap-2">
              <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleBulkImportIA} />
              <i className="fas fa-magic"></i> PAUTA IA
            </label>
            <button type="button" onClick={() => setIsAdding(true)} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-black text-[10px] hover:bg-blue-700 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
              <i className="fas fa-plus"></i> NOVO TESTE
            </button>
          </div>
        </div>

        {isAdding && (
          <div className="mb-6 p-4 bg-slate-900 rounded-2xl text-white animate-in zoom-in-95 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <input type="text" placeholder="Nome" value={newAssessment.name} onChange={e => setNewAssessment({...newAssessment, name: e.target.value})} className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 text-white font-bold text-xs" />
              <input type="date" value={newAssessment.date} onChange={e => setNewAssessment({...newAssessment, date: e.target.value})} className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 text-white font-bold text-xs" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleAddAssessment} className="flex-1 py-2 bg-blue-600 rounded-lg font-black text-[10px] uppercase">Criar</button>
              <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 bg-white/10 rounded-lg font-black text-[10px] uppercase">Sair</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="py-2 px-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-white z-20 w-48 border-b border-slate-100">Aluno</th>
                {assessments.map((a) => (
                  <th key={a.id} className="py-2 px-1 text-center min-w-[100px] border-b border-slate-100">
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center">
                      <span className="text-[9px] font-black text-slate-900 uppercase truncate w-full px-1">{a.name}</span>
                      <span className="text-[8px] text-slate-400 font-bold mb-2">{a.date}</span>
                      
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex gap-1 w-full">
                          <button 
                            type="button"
                            title="Limpar notas"
                            onClick={() => handleClearAction(a.id)}
                            className={`flex-1 py-1 rounded-md transition-all border ${
                              confirmClearId === a.id 
                                ? 'bg-amber-600 text-white border-amber-700' 
                                : 'bg-amber-50 text-amber-600 border-amber-100'
                            }`}
                          >
                            <i className="fas fa-eraser text-[10px]"></i>
                          </button>
                          <button 
                            type="button"
                            title="Apagar coluna"
                            onClick={() => handleDeleteAction(a.id)}
                            className={`flex-1 py-1 rounded-md transition-all border ${
                              confirmDeleteId === a.id 
                                ? 'bg-red-600 text-white border-red-700' 
                                : 'bg-red-50 text-red-600 border-red-100'
                            }`}
                          >
                            <i className="fas fa-trash-alt text-[10px]"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </th>
                ))}
                <th className="py-2 px-3 text-center text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50/50 rounded-t-xl border-b border-blue-100">Média</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {students.map(student => (
                <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3 sticky left-0 bg-white z-10 border-r border-slate-50">
                    <div className="flex items-center gap-2">
                      <img src={student.photo} className="w-6 h-6 rounded-full object-cover border border-slate-200" />
                      <span className="text-xs font-bold text-slate-700 truncate max-w-[140px]">{student.name}</span>
                    </div>
                  </td>
                  {assessments.map(a => (
                    <td key={a.id} className="py-2 px-1 text-center">
                      <input 
                        type="text" 
                        placeholder="-"
                        value={student.grades?.[a.id] ?? ''}
                        onChange={e => handleUpdateGrade(student.id, a.id, e.target.value)}
                        className={`w-12 px-1 py-1 rounded-lg border text-center font-black text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-all ${
                          (student.grades?.[a.id] ?? 0) < 10 && student.grades?.[a.id] !== undefined ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-100 text-slate-900'
                        }`}
                      />
                    </td>
                  ))}
                  <td className="py-2 px-3 text-center font-black text-blue-600 bg-blue-50/30 text-sm">
                    {calculateStudentAvg(student)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-30">
               <tr className="bg-slate-900 text-white">
                  <td className="py-3 px-3 font-black text-[9px] uppercase tracking-widest sticky left-0 bg-slate-900 rounded-bl-[24px]">Média Turma</td>
                  {assessments.map(a => (
                    <td key={a.id} className="py-3 px-1 text-center font-black text-[10px]">{calculateClassAvg(a.id)}</td>
                  ))}
                  <td className="py-3 px-3 text-center font-black text-[11px] bg-blue-600 rounded-br-[24px]">-</td>
               </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Assessments;
