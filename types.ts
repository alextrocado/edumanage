
export type PresenceStatus = 'Presente' | 'Ausente' | 'Atraso';

export interface Measure {
  id: string;
  date: string;
  type: string;
  description: string;
  sourceFile?: string;
}

export interface Assessment {
  id: string;
  name: string;
  date: string;
  weight?: number;
}

export interface Student {
  id: string;
  name: string;
  photo?: string;
  email?: string;
  birthDate?: string;
  notes?: string;
  measures?: Measure[];
  grades?: Record<string, number>; // key is assessmentId, value is the grade
}

export interface AttendanceRecord {
  studentId: string;
  status: PresenceStatus;
  participation: number;
  tpc: number;
  occurrence: string;
}

export interface Lesson {
  id: string;
  date: string; // ISO string YYYY-MM-DD
  time?: string; // HH:mm
  duration?: number; // minutos
  description: string;
  records: AttendanceRecord[];
  isGenerated?: boolean; 
}

export interface ScheduleEntry {
  dayOfWeek: number; // 0 (Dom) a 6 (Sab)
  startTime: string;
  endTime: string;
  duration?: number; // minutos
}

export interface SchoolHoliday {
  name: string;
  startDate: string;
  endDate: string;
}

export interface SchoolTerm {
  name: string;
  startDate: string;
  endDate: string;
}

export interface SchoolCalendar {
  yearStart: string;
  yearEnd: string;
  holidays: SchoolHoliday[];
  terms?: SchoolTerm[];
}

export interface SchoolClass {
  id: string;
  name: string;
  students: Student[];
  lessons: Lesson[];
  schedule: ScheduleEntry[];
  assessments?: Assessment[];
  defaultDuration?: number; 
}

export interface AppConfig {
  cloudSyncEnabled: boolean;
  cloudEndpoint?: string;
  cloudToken?: string;
  postgresConnectionString?: string; 
  lastSync?: string;
  calendar?: SchoolCalendar;
  userName?: string;
  appPassword?: string; 
}

export interface AppData {
  classes: SchoolClass[];
  config?: AppConfig;
}

export type ViewType = 'dashboard' | 'students' | 'lessons' | 'reports' | 'settings' | 'class-selector' | 'schedule' | 'calendar' | 'student-profile' | 'assessments';
