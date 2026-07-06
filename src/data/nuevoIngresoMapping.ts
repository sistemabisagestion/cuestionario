// Mapping de cargo → estándares para usuarios de Nuevo Ingreso
// Editable desde el panel de administración (subir Excel)

export interface NuevoIngresoLink {
  cargo: string;
  estandares: string[];
}

const LS_KEY = 'bisa-nuevo-ingreso-mapping';

export function getNuevoIngresoMapping(): NuevoIngresoLink[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* fallback */ }
  return [];
}

export function saveNuevoIngresoMapping(mapping: NuevoIngresoLink[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(mapping));
}

export function resetNuevoIngresoMapping(): void {
  localStorage.removeItem(LS_KEY);
}

export function getEstandaresByCargo(cargo: string): string[] {
  const mapping = getNuevoIngresoMapping();
  const found = mapping.find(m => m.cargo.trim().toLowerCase() === cargo.trim().toLowerCase());
  return found ? found.estandares : [];
}

// Parsear Excel con formato: Cargo | Estándar
export async function parseMappingExcel(file: File): Promise<NuevoIngresoLink[]> {
  const XLSX = await import('xlsx-js-style');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        const map = new Map<string, Set<string>>();
        for (const row of rows) {
          const cargo = String(row['Cargo'] || '').trim();
          const estandar = String(row['Estándar'] || row['Estandar'] || '').trim();
          if (!cargo || !estandar) continue;
          // Extraer solo el código (ej: "CL-ES-GOP-SGI-03 - Nombre" → "CL-ES-GOP-SGI-03")
          const codigo = estandar.split(' - ')[0].trim();
          if (!map.has(cargo)) map.set(cargo, new Set());
          map.get(cargo)!.add(codigo);
        }
        const result: NuevoIngresoLink[] = [];
        map.forEach((estandares, cargo) => {
          result.push({ cargo, estandares: Array.from(estandares) });
        });
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
