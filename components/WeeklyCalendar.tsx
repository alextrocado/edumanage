
import React, { useState, useMemo } from 'react';
import { AppData, Lesson, SchoolClass } from '../types';

interface WeeklyCalendarProps {
  data: AppData;
  onEditLesson: (lesson: Lesson, classId: string) => void;
}

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const TIME_SLOTS = Array.from({ length: 11 }, (_, i) => `${i + 8}:00`);
const SLOT_HEIGHT = 64;

const CLASS_COLORS = [
  'bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 
  'bg-amber-600', 'bg-rose-600', 'bg-indigo-600',
  'bg-cyan-600', 'bg-orange-600'
];

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({ data, onEditLesson }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekRange = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 5);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, [currentDate]);

  const classColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    (data.classes || []).forEach((cls, index) => {
      map[cls.id] = CLASS_COLORS[index % CLASS_COLORS.length];
    });
    return map;
  }, [data.classes]);

  const weekLessons = useMemo(() => {
    const lessonsMap: Record<number, { lesson: Lesson; classId: string; className: string }[]> = {};
    
    const parseLocalDate = (dateStr: string) => {
      if (!dateStr) return null;
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d, 12, 0, 0);
    };

    (data.classes || []).forEach(cls => {
      (cls.lessons || []).forEach(lesson => {
        const lessonDate = parseLocalDate(lesson.date);
        if (!lessonDate) return;
        
        if (lessonDate >= weekRange.start && lessonDate <= weekRange.end) {
          const dayKey = lessonDate.getDay();
          if (!lessonsMap[dayKey]) lessonsMap[dayKey] = [];
          lessonsMap[dayKey].push({ lesson, classId: cls.id, className: cls.name });
        }
      });
    });

    return lessonsMap;
  }, [data, weekRange]);

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  return (
    <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full min-h-[700px]">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-black text-slate-900">Agenda Global</h3>
          <span className="px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase">
            {weekRange.start.toLocaleDateString('pt-PT')} — {weekRange.end.toLocaleDateString('pt-PT')}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigateWeek(-1)} className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-white"><i className="fas fa-chevron-left"></i></button>
          <button onClick={() => setCurrentDate(new Date())} className="px-4 h-10 rounded-xl border border-slate-200 font-bold text-xs">Hoje</button>
          <button onClick={() => navigateWeek(1)} className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-white"><i className="fas fa-chevron-right"></i></button>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="grid grid-cols-7 border-b border-slate-100 sticky top-0 bg-white z-30 shadow-sm">
          <div className="p-4 border-r border-slate-100 bg-slate-50"></div>
          {DAYS.map((day, i) => {
            const date = new Date(weekRange.start.getTime() + i * 24 * 60 * 60 * 1000);
            return (
              <div key={day} className="p-4 text-center border-r border-slate-100 bg-slate-50">
                <span className="block text-[10px] font-black uppercase text-slate-400 tracking-widest">{day}</span>
                <span className="text-sm font-black text-slate-700">{date.getDate()}</span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-7 relative">
          <div className="col-span-1 border-r border-slate-100">
            {TIME_SLOTS.map(time => (
              <div key={time} className="h-16 p-2 text-right border-b border-slate-100">
                <span className="text-[10px] font-black text-slate-300">{time}</span>
              </div>
            ))}
          </div>

          {DAYS.map((_, dayIndex) => {
            const dayNum = dayIndex + 1;
            const lessons = weekLessons[dayNum] || [];
            
            return (
              <div key={dayIndex} className="col-span-1 border-r border-slate-100 relative min-h-[704px]">
                {lessons.map(({ lesson, classId, className }) => {
                  const [hour, minute] = (lesson.time || '08:00').split(':').map(Number);
                  const topOffset = (hour - 8) * SLOT_HEIGHT + (minute / 60) * SLOT_HEIGHT;
                  const height = ((lesson.duration || 50) / 60) * SLOT_HEIGHT - 4;

                  return (
                    <div
                      key={lesson.id}
                      onDoubleClick={() => onEditLesson(lesson, classId)}
                      className={`absolute left-0.5 right-0.5 p-2 rounded-xl text-white text-left shadow-md z-20 overflow-hidden cursor-pointer flex flex-col ${classColorMap[classId] || 'bg-blue-600'}`}
                      style={{ top: `${topOffset}px`, height: `${height}px` }}
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[7px] font-black uppercase truncate bg-black/10 px-1 rounded">{className}</span>
                        <span className="text-[7px] font-bold">{lesson.time}</span>
                      </div>
                      <span className="text-[9px] font-bold leading-tight line-clamp-2 mt-1">{lesson.description}</span>
                    </div>
                  );
                })}
                {TIME_SLOTS.map((_, tIdx) => <div key={tIdx} className="h-16 border-b border-slate-50"></div>)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeeklyCalendar;
