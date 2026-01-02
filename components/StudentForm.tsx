
import React, { useState } from 'react';
import { Student } from '../types';
import { blobService } from '../services/blobService';

interface StudentFormProps {
  onSave: (student: Student) => void;
  onCancel: () => void;
  initialStudent?: Student;
}

const StudentForm: React.FC<StudentFormProps> = ({ onSave, onCancel, initialStudent }) => {
  const [name, setName] = useState(initialStudent?.name || '');
  const [email, setEmail] = useState(initialStudent?.email || '');
  const [photoUrl, setPhotoUrl] = useState(initialStudent?.photo || '');
  const [isUploading, setIsUploading] = useState(false);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const fileName = `student_${crypto.randomUUID()}_${file.name}`;
        const url = await blobService.uploadImage(file, fileName);
        setPhotoUrl(url);
      } catch (err) {
        alert("Erro ao carregar imagem para a cloud.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;
    
    onSave({
      id: initialStudent?.id || crypto.randomUUID(),
      name,
      email,
      photo: photoUrl,
    });
  };

  return (
    <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-200">
      <h3 className="text-xl font-black mb-6 text-slate-900">{initialStudent ? 'Editar Aluno' : 'Novo Aluno'}</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-[32px] bg-slate-50 flex items-center justify-center overflow-hidden border-2 border-slate-100 relative group">
            {photoUrl ? (
              <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <i className="fas fa-user text-3xl text-slate-200"></i>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                <i className="fas fa-spinner fa-spin text-blue-600"></i>
              </div>
            )}
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fotografia Aluno</label>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nome Completo</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email Institucional</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
          />
        </div>
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isUploading}
            className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50"
          >
            Guardar Aluno
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default StudentForm;
