// Mapping de cargo → estándares para usuarios de Nuevo Ingreso
// Editable desde el panel de administración (subir Excel) o hardcodeado por defecto

export interface NuevoIngresoLink {
  cargo: string;
  estandares: string[];
}

// ── 1. MATRIZ PREDETERMINADA FIJA COMPLETA ────────────────────────────────────
// Todos los cargos extraídos automáticamente del archivo de capacitación de BISA
const MATRIZ_PREDETERMINADA: NuevoIngresoLink[] = [
  {
    cargo: "Gerente de proyecto",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-22",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-24",
      "CL-ES-GOP-SGI-26",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Jefe Proyecto",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-22",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-24",
      "CL-ES-GOP-SGI-26",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Coordinador proyecto",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-22",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-24",
      "CL-ES-GOP-SGI-26",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Jefe CQA",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-18",
      "CL-ES-GOP-SGI-19",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-24",
      "CL-ES-GOP-SGI-26",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-28",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Ing. Supervisor CQA Sr.",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-18",
      "CL-ES-GOP-SGI-19",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-24",
      "CL-ES-GOP-SGI-26",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-28",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Ing. Supervisor CQA",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-18",
      "CL-ES-GOP-SGI-19",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-24",
      "CL-ES-GOP-SGI-26",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-28",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Ing. Superv. CQA Jr.",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-18",
      "CL-ES-GOP-SGI-19",
      "CL-ES-GOP-SGI-24",
      "CL-ES-GOP-SGI-26",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-28",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Ing. Control Proyectos Sr.",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-22",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-24",
      "CL-ES-GOP-SGI-26"
    ]
  },
  {
    cargo: "Ing. Control Proyectos",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-22",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-24",
      "CL-ES-GOP-SGI-26"
    ]
  },
  {
    cargo: "Ing. Control Proyectos Jr.",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-13",
      "CL-ES-GOP-SGI-22",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-24",
      "CL-ES-GOP-SGI-26"
    ]
  },
  {
    cargo: "Arquitecto supervisor",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-18",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Ing. Supervisor Sr.",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-13",
      "CL-ES-GOP-SGI-17",
      "CL-ES-GOP-SGI-18",
      "CL-ES-GOP-SGI-19",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-24",
      "CL-ES-GOP-SGI-26",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Ing. Supervisor",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-13",
      "CL-ES-GOP-SGI-17",
      "CL-ES-GOP-SGI-18",
      "CL-ES-GOP-SGI-19",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-24",
      "CL-ES-GOP-SGI-26",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Ing. Superv. Jr.",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-17",
      "CL-ES-GOP-SGI-18",
      "CL-ES-GOP-SGI-19",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-26",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Ing. Proyectos Campo Sr.",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-17",
      "CL-ES-GOP-SGI-18",
      "CL-ES-GOP-SGI-19",
      "CL-ES-GOP-SGI-20",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-27"
    ]
  },
  {
    cargo: "Ing. Proyectos Sr.",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-17",
      "CL-ES-GOP-SGI-18",
      "CL-ES-GOP-SGI-19",
      "CL-ES-GOP-SGI-20",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-27"
    ]
  },
  {
    cargo: "Ing. Proyectos campo",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-17",
      "CL-ES-GOP-SGI-18",
      "CL-ES-GOP-SGI-19",
      "CL-ES-GOP-SGI-20",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-27"
    ]
  },
  {
    cargo: "Ing. Proyectos Jr.",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-17",
      "CL-ES-GOP-SGI-18",
      "CL-ES-GOP-SGI-19",
      "CL-ES-GOP-SGI-20",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-27"
    ]
  },
  {
    cargo: "Supervisor Campo (Téc.)",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-13",
      "CL-ES-GOP-SGI-17",
      "CL-ES-GOP-SGI-18",
      "CL-ES-GOP-SGI-19",
      "CL-ES-GOP-SGI-20",
      "CL-ES-GOP-SGI-27"
    ]
  },
  {
    cargo: "Superv. Cadista (Téc.)",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-13",
      "CL-ES-GOP-SGI-17",
      "CL-ES-GOP-SGI-18",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Asistente Cadista",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-13",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "admin. Contratos",
    estandares: [
      "CL-ES-GOP-SGI-04",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-24",
      "CL-ES-GOP-SGI-26"
    ]
  },
  {
    cargo: "Asist. To pagrafia",
    estandares: [
      "CL-ES-GOP-SGI-17",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Ayudante",
    estandares: [
      "CL-ES-GOP-SGI-17",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Topógrafo Supervisor",
    estandares: [
      "CL-ES-GOP-SGI-17",
      "CL-ES-GOP-SGI-23",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Jefe SSOMA",
    estandares: [
      "CL-ES-GOP-SGI-26",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-28",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Ing. Supervisor SSOMA Sr.",
    estandares: [
      "CL-ES-GOP-SGI-26",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-28",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Ing. Supervisor SSOMA",
    estandares: [
      "CL-ES-GOP-SGI-26",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-28",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Ing. Superv. SSOMA Jr.",
    estandares: [
      "CL-ES-GOP-SGI-26",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-28",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Asist. Control Doc.",
    estandares: [
      "CL-ES-GOP-SGI-26",
      "CL-ES-GOP-SGI-27",
      "CL-ES-GOP-SGI-28",
      "CL-ES-GOP-SGI-29"
    ]
  },
  {
    cargo: "Asist. Topografía",
    estandares: [
      "CL-ES-GOP-SGI-29"
    ]
  }
];

const LS_KEY = 'bisa-nuevo-ingreso-mapping';

export function getNuevoIngresoMapping(): NuevoIngresoLink[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* fallback */ }
  
  return MATRIZ_PREDETERMINADA;
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
