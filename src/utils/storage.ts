import type { QuizData, Usuario, Intento } from '../types';
import { ApiError, apiRequest, withParticipant } from './api';
import type { ServerAttempt } from './quizSession';

const STORAGE_KEY = 'bisa-quiz-data';
// Participant of the Nuevo Ingreso flow (stored by NuevoIngresoPage in this tab).
export interface NuevoIngresoUsuario {
  nombre: string; dni: string; cargo: string; correo?: string;
  unidadNegocio?: string; unidad_negocio?: string; disciplina?: string;
}
export function readNuevoIngresoUser(): NuevoIngresoUsuario | null {
  try {
    const value = JSON.parse(sessionStorage.getItem('bisa-nuevo-ingreso') ?? 'null');
    return value && typeof value.dni === 'string' && typeof value.cargo === 'string' && typeof value.nombre === 'string' ? value : null;
  } catch { return null; }
}
// Records saved before "cargo" replaced "area".
type LegacyArea = { area?: string };

function normalizeIntentos(intentos: Intento[]): Intento[] {
  const seen = new Set<string>();
  const result: Intento[] = [];

  for (const intento of intentos) {
    const logicalKey = `${intento.dni}|${intento.estandarCodigo}|${intento.fecha}`;
    const idKey = intento.id ? `id:${intento.id}` : logicalKey;

    if (seen.has(idKey) || seen.has(logicalKey)) {
      continue;
    }

    seen.add(idKey);
    seen.add(logicalKey);
    result.push(intento);
  }

  return result;
}

function getData(): QuizData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { currentUser: null, intentos: [] };

  try {
    const parsed = JSON.parse(raw) as Partial<QuizData>;
    return {
      currentUser: parsed.currentUser ?? null,
      intentos: normalizeIntentos((parsed.intentos ?? []) as Intento[]),
    };
  } catch {
    return { currentUser: null, intentos: [] };
  }
}

function saveData(data: QuizData): void {
  const normalizedData = {
    ...data,
    intentos: normalizeIntentos(data.intentos),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedData));
}

export function getCurrentUser(): Usuario | null {
  const user = getData().currentUser as (Usuario & LegacyArea) | null;
  if (user && user.area && !user.cargo) {
    user.cargo = user.area;
  }
  return user;
}

export function setCurrentUser(user: Usuario): void {
  const data = getData();
  const legacy = user as Usuario & LegacyArea;
  if (legacy.area && !user.cargo) {
    user.cargo = legacy.area;
  }
  data.currentUser = user;
  saveData(data);
}

export function clearCurrentUser(): void {
  const data = getData();
  data.currentUser = null;
  saveData(data);
}

// Local copy of an attempt: replaces the same id (initial -> final score) or the same logical attempt.
export function saveIntento(intento: Intento): void {
  const data = getData();
  const legacy = intento as Intento & LegacyArea;
  if (legacy.area && !intento.cargo) {
    intento.cargo = legacy.area;
  }

  const existingIndex = data.intentos.findIndex(i => i.id === intento.id);
  if (existingIndex >= 0) {
    data.intentos[existingIndex] = intento;
  } else {
    const logicalKey = `${intento.dni}|${intento.estandarCodigo}|${intento.fecha}`;
    const duplicateIndex = data.intentos.findIndex(i => `${i.dni}|${i.estandarCodigo}|${i.fecha}` === logicalKey);
    if (duplicateIndex >= 0) {
      data.intentos[duplicateIndex] = intento;
    } else {
      data.intentos.push(intento);
    }
  }

  saveData(data);
}

export function getIntentos(): Intento[] {
  return getData().intentos.map(i => ({
    ...i,
    cargo: i.cargo || (i as Intento & LegacyArea).area || '',
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

// Server API; keep local attempts and a durable retry queue when offline.

const OUTBOX_KEY = 'bisa-neon-pending';
function pendingIntentos(): Intento[] {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { return []; }
}
function toRow(intento: Intento): Record<string, unknown> {
  return {
    id: intento.id, dni: intento.dni, nombre: intento.nombre, correo: intento.correo || '',
    unidad_negocio: intento.unidadNegocio || '', disciplina: intento.disciplina || '', cargo: intento.cargo,
    estandar_codigo: intento.estandarCodigo, estandar_nombre: intento.estandarNombre,
    fecha: intento.fecha, puntaje: intento.puntaje, total_preguntas: intento.totalPreguntas,
    respuestas: intento.respuestas, tipo: intento.tipo, intento_num: intento.intentoNum,
    // Signed by the server when the attempt started; required for final results.
    ...(intento.ticket ? { ticket: intento.ticket } : {}),
  };
}
// Results the server refused for good (e.g. time exceeded) are kept here, never silently dropped.
const REJECTED_KEY = 'bisa-intentos-rechazados';
function keepRejected(intento: Intento, error: ApiError) {
  try {
    const rejected = JSON.parse(localStorage.getItem(REJECTED_KEY) || '[]');
    rejected.push({ intento, motivo: error.message, codigo: error.code, fecha: new Date().toISOString() });
    localStorage.setItem(REJECTED_KEY, JSON.stringify(rejected));
  } catch { console.error('No se pudo conservar el resultado rechazado.'); }
}
const isPermanent = (error: unknown): error is ApiError => error instanceof ApiError && (error.status === 400 || error.status === 403 || error.status === 409);
let syncQueue: Promise<void> = Promise.resolve();
export function syncPendingIntentos(): Promise<void> {
  syncQueue = syncQueue.catch(() => {}).then(async () => {
    for (const intento of pendingIntentos()) {
      try {
        await withParticipant(intento.dni, () => apiRequest('intentos', { method: 'POST', body: JSON.stringify(toRow(intento)) }));
      } catch (error) {
        // Network or server failures keep the queue for a later retry; a definitive refusal
        // is recorded apart so it does not block the attempts queued after it.
        if (!isPermanent(error)) throw error;
        keepRejected(intento, error);
        console.warn(`El servidor rechazó el intento ${intento.id}: ${error.message}`);
      }
      // A final score may have replaced the initial score while the request was in flight.
      const pending = pendingIntentos().filter(i => i.id !== intento.id || JSON.stringify(i) !== JSON.stringify(intento));
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(pending));
    }
  });
  return syncQueue;
}
if (typeof window !== 'undefined') {
  const retry = () => { void syncPendingIntentos().catch(() => console.warn('Sincronización pendiente: los intentos siguen guardados en este navegador.')); };
  window.addEventListener('online', retry);
  retry();
}

// The server enforces the two-attempt limit, assigns the attempt id and starts its clock (signed
// ticket). `intentoNum`, when given, is the attempt the page prepared its questions for.
export function startAttemptAsync(dni: string, estandarCodigo: string, totalPreguntas: number, intentoNum?: number): Promise<ServerAttempt> {
  return withParticipant(dni, () => apiRequest<ServerAttempt>('intentos', {
    method: 'POST', body: JSON.stringify({ accion: 'iniciar', dni, estandar_codigo: estandarCodigo, total_preguntas: totalPreguntas, intento_num: intentoNum }),
  }));
}

export async function saveIntentoAsync(intento: Intento): Promise<void> {
  saveIntento(intento);
  const pending = pendingIntentos().filter(i => i.id !== intento.id);
  pending.push(intento);
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(pending));
  try {
    await syncPendingIntentos();
  } catch {
    console.warn('Guardado local; sincronización con el servidor pendiente.');
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
    tipo: typeof row.tipo === 'string' ? row.tipo : undefined,
    intentoNum: row.intento_num == null ? undefined : Number(row.intento_num),
  };
}

export async function getAllIntentosAsync(): Promise<Intento[]> {
  const data = await apiRequest<Record<string, unknown>[]>('intentos');
  return normalizeIntentos(data.map(rowToIntento));
}

export async function getIntentosByDniAsync(dni: string): Promise<Intento[]> {
  try {
    await syncPendingIntentos();
    const data = await withParticipant(dni, () => apiRequest<Record<string, unknown>[]>(`intentos?dni=${encodeURIComponent(dni)}`));
    return normalizeIntentos(data.map(rowToIntento));
  } catch {
    return getIntentosByDni(dni);
  }
}

export async function getIntentosByEstandarAsync(dni: string, estandarCodigo: string): Promise<Intento[]> {
  try {
    await syncPendingIntentos();
    const data = await withParticipant(dni, () => apiRequest<Record<string, unknown>[]>(`intentos?dni=${encodeURIComponent(dni)}&estandar_codigo=${encodeURIComponent(estandarCodigo)}`));
    return normalizeIntentos(data.map(rowToIntento));
  } catch {
    return getIntentosByEstandar(dni, estandarCodigo);
  }
}
