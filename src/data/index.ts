import type { Estandar } from '../types';

import sgi03 from './SGI-03.json';
import sgi04 from './SGI-04.json';
import sgi05 from './SGI-05.json';
import sgi06 from './SGI-06.json';
import sgi07 from './SGI-07.json';
import sgi08 from './SGI-08.json';
import sgi09 from './SGI-09.json';
import sgi10 from './SGI-10.json';
import sgi11 from './SGI-11.json';
import sgi12 from './SGI-12.json';
import sgi13 from './SGI-13.json';
import sgi14 from './SGI-14.json';
import sgi15 from './SGI-15.json';
import sgi16 from './SGI-16.json';
import sgi17 from './SGI-17.json';
import sgi18 from './SGI-18.json';
import sgi19 from './SGI-19.json';
import sgi20 from './SGI-20.json';
import sgi21 from './SGI-21.json';
import sgi22 from './SGI-22.json';
import sgi23 from './SGI-23.json';
import sgi24 from './SGI-24.json';
import sgi25 from './SGI-25.json';
import sgi26 from './SGI-26.json';
import sgi27 from './SGI-27.json';
import sgi28 from './SGI-28.json';
import sgi29 from './SGI-29.json';
import sgi30 from './SGI-30.json';
import sgi32 from './SGI-32.json';
import sgi34 from './SGI-34.json';
import sgi35 from './SGI-35.json';
import sgi36 from './SGI-36.json';

const PREGUNTAS_KEY = 'bisa-quiz-preguntas';

const estandaresBase: Estandar[] = [
  sgi03, sgi04, sgi05, sgi06, sgi07, sgi08, sgi09, sgi10,
  sgi11, sgi12, sgi13, sgi14, sgi15, sgi16, sgi17, sgi18,
  sgi19, sgi20, sgi21, sgi22, sgi23, sgi24, sgi25, sgi26,
  sgi27, sgi28, sgi29, sgi30, sgi32, sgi34, sgi35, sgi36,
] as Estandar[];

export const cargoEstandarMapping: Record<string, string[]> = {
  "Gerente de proyecto": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-06", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-09", "CL-ES-GOP-SGI-10", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-24", "CL-ES-GOP-SGI-25", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-28", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-34", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Jefe Proyecto": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-06", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-09", "CL-ES-GOP-SGI-10", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-24", "CL-ES-GOP-SGI-25", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-28", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-34", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Coordinador proyecto": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-06", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-09", "CL-ES-GOP-SGI-10", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-24", "CL-ES-GOP-SGI-25", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-28", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-34", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Ing. Control Proyectos Sr": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-24", "CL-ES-GOP-SGI-25", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-36"],
  "Ing. Control Proyectos": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-24", "CL-ES-GOP-SGI-25", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-36"],
  "Ing. Control Proyectos Jr.": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-24", "CL-ES-GOP-SGI-25", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-36"],
  "Arquitecto supervisor": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Ing. Supervisor Sr.": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Ing. Supervisor": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Ing. Superv. Jr.": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Ing. Proyectos Campo Sr.": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Ing. Proyectos Sr.": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Ing. Proyectos campo": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Ing. Producción": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Supervisor Campo (Téc.)": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Superv. Cadista (Téc.)": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Estimador Costos": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-24", "CL-ES-GOP-SGI-25", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Admin. Contratos": ["CL-ES-GOP-SGI-03", "CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-22", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-24", "CL-ES-GOP-SGI-25", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Jefe CQA": ["CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-06", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-09", "CL-ES-GOP-SGI-10", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-24", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-28", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Ing. Supervisor CQA Sr.": ["CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-06", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-09", "CL-ES-GOP-SGI-10", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-24", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-28", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Ing. Supervisor CQA": ["CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-06", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-09", "CL-ES-GOP-SGI-10", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-24", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-28", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Ing. Superv. CQA Jr.": ["CL-ES-GOP-SGI-04", "CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-06", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-08", "CL-ES-GOP-SGI-09", "CL-ES-GOP-SGI-10", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-14", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-16", "CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-23", "CL-ES-GOP-SGI-24", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-28", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-30", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-35", "CL-ES-GOP-SGI-36"],
  "Jefe SSOMA": ["CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-28", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-34", "CL-ES-GOP-SGI-36"],
  "Ing. SSTMA": ["CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-28", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-34", "CL-ES-GOP-SGI-36"],
  "Ing. Supervisor SSOMA Sr.": ["CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-28", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-34", "CL-ES-GOP-SGI-36"],
  "Ing. Supervisor SSOMA": ["CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-28", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-34", "CL-ES-GOP-SGI-36"],
  "Ing. Superv. SSOMA Jr.": ["CL-ES-GOP-SGI-05", "CL-ES-GOP-SGI-07", "CL-ES-GOP-SGI-11", "CL-ES-GOP-SGI-12", "CL-ES-GOP-SGI-13", "CL-ES-GOP-SGI-15", "CL-ES-GOP-SGI-18", "CL-ES-GOP-SGI-19", "CL-ES-GOP-SGI-20", "CL-ES-GOP-SGI-21", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-28", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-32", "CL-ES-GOP-SGI-34", "CL-ES-GOP-SGI-36"],
  "Asist. Topografía": ["CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-28", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-36"],
  "Ayudante": ["CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-28", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-36"],
  "Topógrafo Supervisor": ["CL-ES-GOP-SGI-17", "CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-28", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-36"],
  "Asist. Control Doc.": ["CL-ES-GOP-SGI-26", "CL-ES-GOP-SGI-27", "CL-ES-GOP-SGI-28", "CL-ES-GOP-SGI-29", "CL-ES-GOP-SGI-36"],
};

export const LISTA_CARGOS = Object.keys(cargoEstandarMapping);
export const CARGOS = LISTA_CARGOS;

function normalizarTexto(valor: string): string {
  return valor.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getCustomPreguntas(): Estandar[] | null {
  const raw = localStorage.getItem(PREGUNTAS_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Estandar[];
  } catch {
    return null;
  }
}

export function getEstandares(): Estandar[] {
  return getCustomPreguntas() || estandaresBase;
}

export function getEstandaresByCargo(cargo: string): Estandar[] {
  if (!cargo) return [];

  const cargoNormalizado = normalizarTexto(cargo);

  const entrada = Object.entries(cargoEstandarMapping).find(
    ([nombreCargo]) => normalizarTexto(nombreCargo) === cargoNormalizado
  );

  if (!entrada) {
    console.warn('Cargo no encontrado en cargoEstandarMapping:', cargo);
    return [];
  }

  const codigos = entrada[1];
  const todos = getEstandares();

  return todos.filter(e => codigos.includes(e.estandar_codigo));
}

export function saveCustomPreguntas(data: Estandar[]): void {
  localStorage.setItem(PREGUNTAS_KEY, JSON.stringify(data));
}

export function resetPreguntas(): void {
  localStorage.removeItem(PREGUNTAS_KEY);
}

export function hasCustomPreguntas(): boolean {
  return localStorage.getItem(PREGUNTAS_KEY) !== null;
}

export const estandares = estandaresBase;

export function getEstandarByCodigo(codigo: string): Estandar | undefined {
  return getEstandares().find(e => e.estandar_codigo === codigo);
}
