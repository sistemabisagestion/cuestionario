import type { QuizData, Usuario, Intento } from '../types';
import { supabase } from './supabase';

const STORAGE_KEY = 'bisa-quiz-data';

function getData(): QuizData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { currentUser: null, intentos: [] };

  try {
    return JSON.parse(raw);
  } catch {
    return { currentUser: null, intentos: [] };
  }
}

function saveData(data: QuizData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getCurrentUser(): Usuario | null {
  const user = getData().currentUser;
  if (user && (user as any).area && !user.cargo) {
    user.cargo = (user as any).area;
  }
  return user;
}

export function setCurrentUser(user: Usuario): void {
  const data = getData();
  if ((user as any).area && !user.cargo) {
    user.cargo = (user as any).area;
  }
  data.currentUser = user;
  saveData(data);
}

export function findUserByDni(dni: string): Usuario | null {
  const data = getData();
  if (data.currentUser?.dni === dni) {
    return getCurrentUser();
  }
  const intento = data.intentos.find(i => i.dni === dni);
  if (intento) {
    return {
      dni: intento.dni,
      nombre: intento.nombre,
      correo: intento.correo || '',
      cargo: intento.cargo,
      unidadNegocio: intento.unidadNegocio || '',
      disciplina: intento.disciplina || '',
    } as Usuario;
  }
  return null;
}

export function clearCurrentUser(): void {
  const data = getData();
  data.currentUser = null;
  saveData(data);
}

// NUEVO: Ahora busca si el intento existe para actualizarlo, si no, lo crea
export function saveIntento(intento: Intento): void {
  const data = getData();
  if ((intento as any).area && !intento.cargo) {
    intento.cargo = (intento as any).area;
  }
  
  const existingIndex = data.intentos.findIndex(i => i.id === intento.id);
  if (existingIndex >= 0) {
    data.intentos[existingIndex] = intento;
  } else {
    data.intentos.push(intento);
  }
  
  saveData(data);
}

export function getIntentos(): Intento[] {
  return getData().intentos.map(i => ({
    ...i,
    cargo: i.cargo || (i as any).area || '',
  }));
}

export function getIntentosByDni(dni: string): Intento[] {
  return getIntentos().filter(i => i.dni === dni);
}

export function getIntentoById(id: string): Intento | null {
  return getIntentos().find(i => i.id === id) ?? null;
}

export function getIntentosByEstandar(dni: string, estandarCodigo: string): Intento[] {
  return getIntentos().filter(
    i => i.dni === dni && i.estandarCodigo === estandarCodigo
  );
}

export function getBestScore(dni: string, estandarCodigo: string): number | null {
  const intentos = getIntentosByEstandar(dni, estandarCodigo);
  if (intentos.length === 0) return null;
  return Math.max(...intentos.map(i => i.puntaje));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Supabase async functions ───

export async function saveIntentoAsync(intento: Intento): Promise<void> {
  saveIntento(intento);

  if (!supabase) return;

  try {
    // NUEVO: Usamos UPSERT en lugar de INSERT para poder actualizar la nota al final
    await supabase.from('intentos').upsert({
      id: intento.id,
      dni: intento.dni,
      nombre: intento.nombre,
      correo: intento.correo || '',
      unidad_negocio: intento.unidadNegocio || '', 
      disciplina: intento.disciplina || '',        
      cargo: intento.cargo || (intento as any).area || '',
      estandar_codigo: intento.estandarCodigo,
      estandar_nombre: intento.estandarNombre,
      fecha: intento.fecha,
      puntaje: intento.puntaje,
      total_preguntas: intento.totalPreguntas,
      respuestas: intento.respuestas,
    });
  } catch {
    // Offline o error — localStorage ya lo tiene
  }
}

function rowToIntento(row: Record<string, unknown>): Intento {
  return {
    id: String(row.id),
    dni: String(row.dni),
    nombre: String(row.nombre ?? ''),
    correo: String(row.correo ?? ''),
    cargo: String(row.cargo ?? row.area ?? ''),
    unidadNegocio: String(row.unidad_negocio ?? row.unidadNegocio ?? ''),
    disciplina: String(row.disciplina ?? ''),
    estandarCodigo: String(row.estandar_codigo),
    estandarNombre: String(row.estandar_nombre),
    fecha: String(row.fecha),
    puntaje: Number(row.puntaje),
    totalPreguntas: Number(row.total_preguntas),
    respuestas: (row.respuestas as Intento['respuestas']) ?? [],
  };
}

export async function getAllIntentosAsync(): Promise<Intento[]> {
  if (!supabase) return getIntentos();
  try {
    const { data, error } = await supabase.from('intentos').select('*').order('fecha', { ascending: false });
    if (error || !data) return getIntentos();
    return data.map(rowToIntento);
  } catch {
    return getIntentos();
  }
}

export async function getIntentosByDniAsync(dni: string): Promise<Intento[]> {
  if (!supabase) return getIntentosByDni(dni);
  try {
    const { data, error } = await supabase.from('intentos').select('*').eq('dni', dni).order('fecha', { ascending: false });
    if (error || !data) return getIntentosByDni(dni);
    return data.map(rowToIntento);
  } catch {
    return getIntentosByDni(dni);
  }
}

export async function getIntentosByEstandarAsync(dni: string, estandarCodigo: string): Promise<Intento[]> {
  if (!supabase) return getIntentosByEstandar(dni, estandarCodigo);
  try {
    const { data, error } = await supabase.from('intentos').select('*').eq('dni', dni).eq('estandar_codigo', estandarCodigo);
    if (error || !data) return getIntentosByEstandar(dni, estandarCodigo);
    return data.map(rowToIntento);
  } catch {
    return getIntentosByEstandar(dni, estandarCodigo);
  }
}

export async function getBestScoreAsync(dni: string, estandarCodigo: string): Promise<number | null> {
  const intentos = await getIntentosByEstandarAsync(dni, estandarCodigo);
  if (intentos.length === 0) return null;
  return Math.max(...intentos.map(i => i.puntaje));
}

export async function exportToExcelAsync(): Promise<void> {
  const intentos = await getAllIntentosAsync();
  const XLSX = await import('xlsx-js-style');

  const rows = intentos.map(i => ({
    ID: i.id,
    Fecha: new Date(i.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    Nombre: i.nombre || '',
    Correo: i.correo || '',
    DNI: i.dni,
    'Unidad de Negocio': i.unidadNegocio || '',
    Disciplina: i.disciplina || '',             
    Cargo: i.cargo || '',
    'Código Estándar': i.estandarCodigo,
    'Nombre Estándar': i.estandarNombre,
    'Nota (/20)': i.puntaje,
    'Total Preguntas': i.totalPreguntas,
    Estado: i.puntaje > 12 ? 'Aprobado' : 'Desaprobado',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = [
    { wch: 14 }, { wch: 18 }, { wch: 25 }, { wch: 25 }, { wch: 10 }, { wch: 20 },
    { wch: 20 }, { wch: 25 }, { wch: 18 }, { wch: 40 }, { wch: 10 }, { wch: 15 }, { wch: 12 },
  ];

  addTableFormat(ws, rows.length, 13);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Evaluaciones');
  XLSX.writeFile(wb, `bisa-evaluaciones-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function colLetter(c: number): string {
  let s = '';
  let n = c;
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export function addTableFormat(ws: import('xlsx-js-style').WorkSheet, rowCount: number, colCount: number): void {
  const lastCol = colLetter(colCount - 1);
  const ref = `A1:${lastCol}${rowCount + 1}`;
  ws['!ref'] = ref;
  ws['!autofilter'] = { ref };

  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
    fill: { fgColor: { rgb: '1D262B' } },
    border: { top: { style: 'thin' as const, color: { rgb: '999999' } }, bottom: { style: 'thin' as const, color: { rgb: '999999' } }, left: { style: 'thin' as const, color: { rgb: '999999' } }, right: { style: 'thin' as const, color: { rgb: '999999' } } },
    alignment: { vertical: 'center' as const, horizontal: 'center' as const, wrapText: true },
  };

  const borderStyle = {
    top: { style: 'thin' as const, color: { rgb: 'CCCCCC' } }, bottom: { style: 'thin' as const, color: { rgb: 'CCCCCC' } }, left: { style: 'thin' as const, color: { rgb: 'CCCCCC' } }, right: { style: 'thin' as const, color: { rgb: 'CCCCCC' } },
  };

  for (let r = 0; r <= rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const cellRef = `${colLetter(c)}${r + 1}`;
      const cell = ws[cellRef];
      if (!cell) continue;
      if (r === 0) {
        cell.s = headerStyle;
      } else {
        cell.s = { border: borderStyle, alignment: { vertical: 'center' as const, wrapText: true }, fill: r % 2 === 0 ? { fgColor: { rgb: 'F2F2F2' } } : { fgColor: { rgb: 'FFFFFF' } }, font: { name: 'Calibri', sz: 10 } };
      }
    }
  }
}

export function exportToExcel(): void {
  import('xlsx-js-style').then(XLSX => {
    const intentos = getIntentos();
    const rows = intentos.map(i => ({
      ID: i.id,
      Fecha: new Date(i.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      Nombre: i.nombre || '', Correo: i.correo || '', DNI: i.dni,
      'Unidad de Negocio': i.unidadNegocio || '', Disciplina: i.disciplina || '', Cargo: i.cargo || '',
      'Código Estándar': i.estandarCodigo, 'Nombre Estándar': i.estandarNombre,
      'Nota (/20)': i.puntaje, 'Total Preguntas': i.totalPreguntas,
      Estado: i.puntaje > 12 ? 'Aprobado' : 'Desaprobado',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [ { wch: 14 }, { wch: 18 }, { wch: 25 }, { wch: 25 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 18 }, { wch: 40 }, { wch: 10 }, { wch: 15 }, { wch: 12 } ];
    addTableFormat(ws, rows.length, 13);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Evaluaciones');
    XLSX.writeFile(wb, `bisa-evaluaciones-${new Date().toISOString().slice(0, 10)}.xlsx`);
  });
}

const LS_RETAKE_KEY = 'bisa_retake_approvals';

interface RetakeApproval { id: string; dni: string; estandar_codigo: string; created_at: string; }

function getRetakeApprovalsFromLS(): RetakeApproval[] {
  try { return JSON.parse(localStorage.getItem(LS_RETAKE_KEY) || '[]'); } catch { return []; }
}

function saveRetakeApprovalToLS(approval: RetakeApproval): void {
  const all = getRetakeApprovalsFromLS();
  all.push(approval);
  localStorage.setItem(LS_RETAKE_KEY, JSON.stringify(all));
}

export async function getRetakeApprovalsByDniAsync(dni: string): Promise<RetakeApproval[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('retake_approvals').select('*').eq('dni', dni);
      if (!error && data) return data as RetakeApproval[];
    } catch { }
  }
  return getRetakeApprovalsFromLS().filter(a => a.dni === dni);
}

export async function approveRetakeAsync(dni: string, estandarCodigo: string): Promise<boolean> {
  const approval: RetakeApproval = { id: crypto.randomUUID(), dni, estandar_codigo: estandarCodigo, created_at: new Date().toISOString() };
  saveRetakeApprovalToLS(approval);
  if (supabase) {
    try { await supabase.from('retake_approvals').insert({ dni, estandar_codigo: estandarCodigo, created_at: approval.created_at }); } catch { }
  }
  return true;
}

export function importFromExcel(file: File): Promise<{ success: boolean; count: number }> {
  return new Promise(resolve => {
    import('xlsx-js-style').then(XLSX => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
          const current = getData();
          const existingIds = new Set(current.intentos.map(i => i.id));
          let count = 0;
          for (const row of rows) {
            const id = String(row['ID'] || '');
            if (!id || existingIds.has(id)) continue;
            const intento: Intento = {
              id, dni: String(row['DNI'] || ''), nombre: String(row['Nombre'] || ''),
              correo: String(row['Correo'] || row['correo'] || ''),
              cargo: String(row['Cargo'] || row['Area'] || row['Área'] || ''),
              unidadNegocio: String(row['Unidad de Negocio'] || row['Unidad de negocio'] || ''), 
              disciplina: String(row['Disciplina'] || ''),                                       
              estandarCodigo: String(row['Código Estándar'] || row['Codigo Estandar'] || ''),
              estandarNombre: String(row['Nombre Estándar'] || row['Nombre Estandar'] || ''),
              fecha: String(row['Fecha'] || new Date().toISOString()),
              puntaje: Number(row['Nota (/20)'] || row['Nota'] || 0),
              totalPreguntas: Number(row['Total Preguntas'] || 10), respuestas: [],
            };
            current.intentos.push(intento); existingIds.add(id); count++;
          }
          saveData(current); resolve({ success: true, count });
        } catch { resolve({ success: false, count: 0 }); }
      };
      reader.readAsArrayBuffer(file);
    });
  });
}