export interface Pregunta {
  id: number;
  categoria: string;
  pregunta: string;
  opcion_a: string;
  opcion_b: string;
  opcion_c: string;
  opcion_d: string;
  opcion_e: string;
  respuesta_correcta: string;
}

export interface Estandar {
  estandar_codigo: string;
  estandar_nombre: string;
  preguntas: Pregunta[];
}

export interface Usuario {
  nombre: string;
  unidadNegocio?: string;
  disciplina?: string;
  cargo: string;
  correo?: string;
  dni: string;
}

export interface RespuestaQuiz {
  preguntaId: number;
  pregunta: string;
  respuestaUsuario: string;
  respuestaCorrecta: string;
  esCorrecta: boolean;
}

export interface Intento {
  id: string;
  dni: string;
  nombre: string;
  correo?: string;
  unidadNegocio?: string;
  disciplina?: string;
  cargo: string;
  estandarCodigo: string;
  estandarNombre: string;
  fecha: string;
  puntaje: number;
  totalPreguntas: number;
  respuestas: RespuestaQuiz[];
}

export interface QuizData {
  currentUser: Usuario | null;
  intentos: Intento[];
}