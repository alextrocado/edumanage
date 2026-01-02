
import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Student } from '../types';
import { blobService } from '../services/blobService';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

interface BulkAIImportProps {
  onImport: (students: Student[]) => void;
  onCancel: () => void;
  mode?: 'create' | 'update';
}

const BulkAIImport: React.FC<BulkAIImportProps> = ({ onImport, onCancel, mode = 'create' }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);

  const processPDFs = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setProgress(0);
    const allStudents: Student[] = [];

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      for (let fIndex = 0; fIndex < files.length; fIndex++) {
        const file = files[fIndex];
        setStatus(`Analisando ${file.name}...`);
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const viewport = page.getViewport({ scale: 2.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;

          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({ canvasContext: context, viewport, canvas }).promise;

          const pageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
          
          const overallProgress = ((fIndex / files.length) + (p / (pdf.numPages * files.length))) * 100;
          setProgress(Math.round(overallProgress));

          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
              {
                parts: [
                  { inlineData: { mimeType: "image/jpeg", data: pageBase64 } },
                  { text: `Identifica os alunos na pauta. Extrai Nome, Número de aluno (4+ dígitos) e coordenadas da foto [ymin, xmin, ymax, xmax]. Retorna JSON.` }
                ]
              }
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  students: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        studentNumber: { type: Type.STRING },
                        box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER } }
                      },
                      required: ["name", "box_2d", "studentNumber"]
                    }
                  }
                },
                required: ["students"]
              }
            }
          });

          const data = JSON.parse(response.text || '{}');
          for (const sData of data.students) {
            const [ymin, xmin, ymax, xmax] = sData.box_2d;
            const x = (xmin / 1000) * canvas.width;
            const y = (ymin / 1000) * canvas.height;
            const w = ((xmax - xmin) / 1000) * canvas.width;
            const h = ((ymax - ymin) / 1000) * canvas.height;

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = w;
            cropCanvas.height = h;
            const cropCtx = cropCanvas.getContext('2d');
            if (cropCtx) {
              cropCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
              
              const cropBase64 = cropCanvas.toDataURL('image/jpeg', 0.9).split(',')[1];
              const blob = blobService.base64ToBlob(cropBase64);
              const fileName = `student_${sData.studentNumber || crypto.randomUUID()}.jpg`;
              
              // Upload direto para o Vercel Blob
              const photoUrl = await blobService.uploadImage(blob, fileName);

              const generatedEmail = sData.studentNumber ? `ac${sData.studentNumber}@alunos.ribadouro.com` : undefined;

              allStudents.push({
                id: crypto.randomUUID(),
                name: sData.name,
                photo: photoUrl,
                email: generatedEmail
              });
            }
          }
        }
      }

      setProgress(100);
      setStatus("Vercel Blob Sync: OK!");
      setTimeout(() => onImport(allStudents), 1000);
    } catch (e) {
      console.error(e);
      alert("Erro no processamento IA ou Blob.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white p-10 rounded-[48px] shadow-2xl max-w-xl w-full border border-slate-100">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-sm">
           <i className="fas fa-robot text-3xl"></i>
        </div>
        <h3 className="text-2xl font-black text-slate-900">Importação Inteligente Vercel</h3>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Fotos guardadas via @vercel/blob</p>
      </div>
      
      {!isProcessing ? (
        <div className="space-y-6">
          <div className="border-4 border-dashed border-slate-50 p-12 text-center rounded-[36px] group hover:border-blue-400 transition-all cursor-pointer relative bg-slate-50/30">
            <input type="file" multiple accept=".pdf" onChange={e => setFiles(Array.from(e.target.files || []))} className="absolute inset-0 opacity-0 cursor-pointer" />
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
               <i className="fas fa-cloud-upload-alt text-slate-300 group-hover:text-blue-500"></i>
            </div>
            <p className="font-bold text-slate-500 text-sm">
              {files.length > 0 ? `${files.length} PDFs selecionados` : 'Arraste as listagens em PDF'}
            </p>
          </div>
          <div className="flex gap-4">
            <button onClick={processPDFs} disabled={files.length === 0} className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all">
              Começar Processamento
            </button>
            <button onClick={onCancel} className="px-8 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest">Sair</button>
          </div>
        </div>
      ) : (
        <div className="text-center py-10">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 border-4 border-slate-50 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center font-black text-lg text-blue-600">{progress}%</div>
          </div>
          <p className="font-black text-slate-800 text-lg animate-pulse">{status}</p>
          <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-[0.2em]">Não feche esta janela</p>
        </div>
      )}
    </div>
  );
};

export default BulkAIImport;
