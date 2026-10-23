// Historical template retained for migration only. Evaluations use the server API.
// Changes are published from the admin panel through /api/datos.
import { assignedCodes } from '../utils/matrices';
// Original Nuevo Ingreso matrix (cargo → standards). scripts/recover-matrices.mjs reads this literal.

export interface NuevoIngresoLink {
  cargo: string;
  estandares: string[];
}

// ── 1. MATRIZ PREDETERMINADA FIJA COMPLETA ────────────────────────────────────
// Todos los cargos extraídos automáticamente del archivo de capacitación de BISA
export const LEGACY_MATRIZ_NUEVO_INGRESO: NuevoIngresoLink[] = [
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


export function getEstandaresByCargo(cargo: string): Promise<string[]> {
  return assignedCodes('nuevo-ingreso', cargo);
}
