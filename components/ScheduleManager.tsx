
import React, { useState } from 'react';
import { SchoolClass, ScheduleEntry, SchoolCalendar, SchoolHoliday, SchoolTerm } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

interface ScheduleManagerProps {
  activeClass: SchoolClass;
  calendar: SchoolCalendar;
  onUpdateClass: (updated: SchoolClass) => void;
  onUpdateCalendar: (updated: SchoolCalendar) => void;
  onGenerateLessons: () => void;
}

const DAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const ScheduleManager: React.FC<ScheduleManagerProps> = ({ activeClass, calendar, onUpdateClass, onUpdateCalendar, onGenerateLessons }) => {
  const [isProcessing, setIsProcessing] = useState<'schedule' | 'calendar' | null>(null);
  const [status, setStatus] = useState("");

  const processPDF = async (file: File, type: 'schedule' | 'calendar') => {
    setIsProcessing(type);
    setStatus("A ler documento...");
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // FIX: Added 'canvas' property to RenderParameters as required by pdfjs-dist 4.x types
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

      if (type === 'schedule') {
        setStatus("IA a analisar horários...");
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: base64Image } },
              { text: "Extrai os tempos letivos de MATEMÁTICA. Retorna JSON: { schedule: [{dayOfWeek, startTime, endTime}] }." }
            ]
          }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                schedule: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      dayOfWeek: { type: Type.INTEGER },
                      startTime: { type: Type.STRING },
                      endTime: { type: Type.STRING }
                    },
                    required: ["dayOfWeek", "startTime", "endTime"]
                  }
                }
              }
            }
          }
        });
        
        const result = JSON.parse(response.text || '{}');
        const newSchedule = (result.schedule || []).map((s: any) => {
            const [sh, sm] = s.startTime.split(':').map(Number);
            const [eh, em] = s.endTime.split(':').map(Number);
            const dur = (eh * 60 + em) - (sh * 60 + sm);
            return { ...s, duration: dur > 0 ? dur : 50 };
        });
        
        onUpdateClass({ ...activeClass, schedule: newSchedule });
        setStatus("Horário importado!");
      } else {
        setStatus("IA a analisar calendário...");
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: base64Image } },
              { text: "Extrai yearStart, yearEnd, holidays e terms (startDate, endDate). Retorna JSON." }
            ]
          }],
          config: { responseMimeType: "application/json" }
        });

        const result = JSON.parse(response.text || '{}');
        onUpdateCalendar(result);
        setStatus("Calendário configurado!");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao processar PDF.");
    } finally {
      setTimeout(() => setIsProcessing(null), 1000);
    }
  };

  const removeScheduleEntry = (index: number) => {
    const updated = [...(activeClass.schedule || [])];
    updated.splice(index, 1);
    onUpdateClass({ ...activeClass, schedule: updated });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={onGenerateLessons} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs shadow-xl flex items-center gap-2 hover:bg-black transition-all">
          <i className="fas fa-sync-alt"></i> Sincronizar Diário de Bordo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <i className="fas fa-clock text-blue-500"></i> Horário Base
            </h3>
            <label className="relative overflow-hidden group">
              <input type="file" accept=".pdf" className="hidden" disabled={!!isProcessing} onChange={(e) => e.target.files?.[0] && processPDF(e.target.files[0], 'schedule')} />
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs cursor-pointer hover:bg-blue-600 hover:text-white transition-all">
                <i className="fas fa-file-pdf"></i> Importar PDF
              </div>
            </label>
          </div>

          <div className="space-y-3 mb-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar flex-1">
            {activeClass.schedule?.sort((a,b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)).map((entry, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm border border-slate-100"><i className="fas fa-calendar-day text-xs"></i></div>
                  <div>
                    <span className="font-black text-slate-700 block text-sm">{DAYS[entry.dayOfWeek]}</span>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{entry.startTime} - {entry.endTime} ({entry.duration}m)</p>
                  </div>
                </div>
                <button onClick={() => removeScheduleEntry(i)} className="w-8 h-8 rounded-lg bg-red-50 text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:text-white flex items-center justify-center"><i className="fas fa-trash-alt text-xs"></i></button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <i className="fas fa-calendar-alt text-purple-500"></i> Calendário Letivo
            </h3>
            <label className="relative overflow-hidden group">
              <input type="file" accept=".pdf" className="hidden" disabled={!!isProcessing} onChange={(e) => e.target.files?.[0] && processPDF(e.target.files[0], 'calendar')} />
              <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-xl font-bold text-xs cursor-pointer hover:bg-purple-600 hover:text-white transition-all">
                <i className="fas fa-calendar-day"></i> Config. Calendário
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Início</span>
              <span className="font-black text-slate-700">{calendar.yearStart || '---'}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Fim</span>
              <span className="font-black text-slate-700">{calendar.yearEnd || '---'}</span>
            </div>
          </div>
          
          <div className="space-y-3 mb-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {(calendar.terms || []).map((t, i) => (
              <div key={i} className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100 text-[10px] font-bold">
                <span className="text-blue-900 uppercase block">{t.name}</span>
                {t.startDate} até {t.endDate}
              </div>
            ))}
            {(calendar.holidays || []).map((h, i) => (
              <div key={i} className="p-3 bg-purple-50/50 rounded-2xl border border-purple-100 text-[10px] font-bold">
                <span className="text-purple-900 uppercase block">{h.name}</span>
                {h.startDate} até {h.endDate}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleManager;
