
import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Student, Measure } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

// Configuração do worker do PDF.js via CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

interface BulkMeasuresImportProps {
  students: Student[];
  onImport: (updatedStudents: Student[]) => void;
  onCancel: () => void;
}

const BulkMeasuresImport: React.FC<BulkMeasuresImportProps> = ({ students, onImport, onCancel }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);

  const normalizeName = (name: string) => {
    return name.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const isStudentMatch = (inputName: string, targetName: string) => {
    const s1 = normalizeName(inputName);
    const s2 = normalizeName(targetName);
    if (s1 === s2) return true;
    const parts1 = s1.split(' ').filter(p => p.length > 2);
    const parts2 = s2.split(' ').filter(p => p.length > 2);
    const matches = parts1.filter(part => parts2.includes(part)).length;
    return matches >= 2 || (parts1.length === 1 && parts2.includes(parts1[0]));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processMeasures = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setProgress(0);
    
    const updatedStudentsMap = new Map<string, Student>(
      students.map(s => [s.id, { ...s, measures: [...(s.measures || [])] }])
    );

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      for (let fIndex = 0; fIndex < files.length; fIndex++) {
        const file = files[fIndex];
        const isPDF = file.type === 'application/pdf';
        setStatus(`A processar: ${file.name}...`);

        if (isPDF) {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          
          for (let p = 1; p <= pdf.numPages; p++) {
            setStatus(`Lendo página ${p}/${pdf.numPages} de ${file.name}...`);
            const page = await pdf.getPage(p);
            const viewport = page.getViewport({ scale: 2.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) continue;
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport, canvas }).promise;
            const pageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            await analyzeContent(ai, pageBase64, updatedStudentsMap);
            setProgress(Math.round(((fIndex + (p / pdf.numPages)) / files.length) * 100));
          }
        } else {
          // É uma imagem direta
          const imageBase64 = await fileToBase64(file);
          await analyzeContent(ai, imageBase64, updatedStudentsMap);
          setProgress(Math.round(((fIndex + 1) / files.length) * 100));
        }
      }

      setStatus("Integração concluída!");
      setProgress(100);
      
      const finalResult = Array.from(updatedStudentsMap.values());
      setTimeout(() => {
        onImport(finalResult);
      }, 1000);

    } catch (e: any) {
      console.error("Erro no processamento:", e);
      setStatus("Erro: " + (e.message || "Falha técnica"));
      setIsProcessing(false);
    }
  };

  const analyzeContent = async (ai: any, base64Data: string, studentsMap: Map<string, Student>) => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Data } },
          { text: `Analise este documento e extraia Medidas de Suporte à Aprendizagem (DL 54/2018).
            Para cada aluno, extraia:
            1. Nome completo (exatamente como aparece).
            2. Lista de medidas:
               - date (YYYY-MM-DD, hoje se omitido: ${new Date().toISOString().split('T')[0]}).
               - type (Universal, Seletiva, Adicional, Adaptação).
               - description (Texto detalhado).
            Retorne JSON.` }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  studentName: { type: Type.STRING },
                  measures: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        date: { type: Type.STRING },
                        type: { type: Type.STRING },
                        description: { type: Type.STRING }
                      },
                      required: ["date", "type", "description"]
                    }
                  }
                },
                required: ["studentName", "measures"]
              }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || '{"results":[]}');
    if (data.results) {
      for (const res of data.results) {
        const student = Array.from(studentsMap.values()).find(s => isStudentMatch(res.studentName, s.name));
        if (student) {
          const newMeasures: Measure[] = res.measures.map((m: any) => ({
            ...m,
            id: crypto.randomUUID()
          }));
          student.measures = [...(student.measures || []), ...newMeasures];
          studentsMap.set(student.id, student);
        }
      }
    }
  };

  return (
    <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-xl w-full border border-slate-200">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="fas fa-magic text-2xl"></i>
        </div>
        <h3 className="text-2xl font-black text-slate-900">Importação de Medidas</h3>
        <p className="text-sm text-slate-500 font-medium mt-2">PDFs de relatórios ou fotos de pautas. A IA integra tudo.</p>
      </div>
      
      {!isProcessing ? (
        <div className="space-y-6">
          <div className="border-4 border-dashed border-slate-100 p-12 text-center rounded-[32px] group hover:border-purple-400 transition-all cursor-pointer relative bg-slate-50/50">
            <input type="file" multiple accept=".pdf,image/*" onChange={e => setFiles(Array.from(e.target.files || []))} className="absolute inset-0 opacity-0 cursor-pointer" />
            <p className="font-bold text-slate-500">{files.length > 0 ? `${files.length} ficheiros prontos` : 'PDF ou Imagem (JPG/PNG)'}</p>
          </div>
          <div className="flex gap-4">
            <button onClick={processMeasures} disabled={files.length === 0} className="flex-1 py-4 bg-purple-600 text-white rounded-2xl font-black shadow-xl disabled:bg-slate-200 transition-all hover:bg-purple-700 active:scale-95">Começar Processamento</button>
            <button onClick={onCancel} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all">Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="text-center py-10">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center font-black text-lg text-purple-600">{progress}%</div>
          </div>
          <p className="font-black text-slate-800 text-lg animate-pulse">{status}</p>
        </div>
      )}
    </div>
  );
};

export default BulkMeasuresImport;
