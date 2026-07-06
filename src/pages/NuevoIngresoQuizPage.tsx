import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEstandares } from '../data';
import { getEstandaresByCargo as getNuevoIngresoCargos } from '../data/nuevoIngresoMapping';
import { pickRandomQuestions } from '../utils/randomize';
import type { Pregunta, RespuestaQuiz } from '../types';

const OPCIONES = ['A', 'B', 'C', 'D', 'E'] as const;
const TIEMPO_POR_PREGUNTA = 45;
const TOTAL_PREGUNTAS = 20;
const MAX_INTENTOS = 2;
const LS_KEY_INTENTOS_GLOBAL = 'bisa-nuevo-ingreso-intentos-global';
const LS_KEY_RESULTADOS = 'bisa-nuevo-ingreso-resultados';

function getIntentosGlobal(dni: string): number {
  try {
    const raw = localStorage.getItem(LS_KEY_INTENTOS_GLOBAL);
    if (!raw) return 0;
    const data = JSON.parse(raw) as { dni: string; count: number }[];
    return data.find(d => d.dni === dni)?.count ?? 0;
  } catch { return 0; }
}

function incrementarIntentosGlobal(dni: string): void {
  try {
    const raw = localStorage.getItem(LS_KEY_INTENTOS_GLOBAL);
    const data: { dni: string; count: number }[] = raw ? JSON.parse(raw) : [];
    const idx = data.findIndex(d => d.dni === dni);
    if (idx >= 0) data[idx].count++;
    else data.push({ dni, count: 1 });
    localStorage.setItem(LS_KEY_INTENTOS_GLOBAL, JSON.stringify(data));
  } catch { }
}

function guardarResultado(usuario: any, puntaje: number, totalPreguntas: number, respuestas: RespuestaQuiz[], intentoNum: number): void {
  const registro = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    dni: usuario.dni,
    nombre: usuario.nombre,
    cargo: usuario.cargo,
    unidadNegocio: usuario.unidadNegocio || '',
    disciplina: usuario.disciplina || '',
    estandar: 'EVALUACION-GLOBAL',
    estandarNombre: 'Evaluación Global de Nuevo Ingreso',
    puntaje,
    totalPreguntas,
    respuestas,
    fecha: new Date().toISOString(),
    intentoNum,
    tipo: 'NUEVO INGRESO',
  };

  // Guardar en localStorage
  try {
    const raw = localStorage.getItem(LS_KEY_RESULTADOS);
    const data = raw ? JSON.parse(raw) : [];
    data.push(registro);
    localStorage.setItem(LS_KEY_RESULTADOS, JSON.stringify(data));
  } catch { }

  // Intentar guardar en Supabase (si está disponible)
  try {
    import('../utils/supabase').then(({ supabase }) => {
      if (!supabase) return;
      supabase.from('intentos').insert({
        id: registro.id,
        dni: registro.dni,
        nombre: registro.nombre,
        cargo: registro.cargo,
        unidad_negocio: registro.unidadNegocio,
        disciplina: registro.disciplina,
        estandar_codigo: registro.estandar,
        estandar_nombre: registro.estandarNombre,
        puntaje: registro.puntaje,
        total_preguntas: registro.totalPreguntas,
        respuestas: registro.respuestas,
        fecha: registro.fecha,
        tipo: registro.tipo,
      }).then(({ error }) => {
        if (error) console.warn('Supabase insert nuevo ingreso:', error.message);
      });
    });
  } catch { }
}

function getOptionText(pregunta: Pregunta, letra: string): string {
  const map: Record<string, keyof Pregunta> = { A: 'opcion_a', B: 'opcion_b', C: 'opcion_c', D: 'opcion_d', E: 'opcion_e' };
  return pregunta[map[letra]] as string;
}

function SegundoIntentoModal({ onConfirmar }: { onConfirmar: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%', padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚠️</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1D262B', marginBottom: 8 }}>Segundo y último intento</h2>
          <p style={{ fontSize: 15, color: '#555', lineHeight: 1.6 }}>
            Este es tu <strong>segundo y último intento</strong>. No habrá posibilidad de volver a intentarlo.
          </p>
        </div>
        <div style={{ background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 10, padding: '14px 16px', marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: '#7B5800', margin: 0, lineHeight: 1.6 }}>
            📚 <strong>Antes de continuar</strong>, revisa el material de capacitación en el <strong>SharePoint de BISA</strong> y los videos de los estándares.
          </p>
        </div>
        <button onClick={onConfirmar} style={{ padding: '12px 24px', background: '#E6007E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
          Entendido, iniciar segundo intento
        </button>
      </div>
    </div>
  );
}

export default function NuevoIngresoQuizPage() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<any>(null);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [intentoNum, setIntentoNum] = useState(1);
  const [timeLeft, setTimeLeft] = useState(TIEMPO_POR_PREGUNTA);
  const [quizStarted, setQuizStarted] = useState(false);
  const [showSegundoModal, setShowSegundoModal] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('bisa-nuevo-ingreso');
    if (!raw) { navigate('/nuevo-ingreso'); return; }
    const user = JSON.parse(raw);
    setUsuario(user);

    const numIntentos = getIntentosGlobal(user.dni);
    const numIntento = numIntentos + 1;
    setIntentoNum(numIntento);

    if (numIntentos >= MAX_INTENTOS) { navigate('/nuevo-ingreso/standards'); return; }

    // Obtener todos los estándares asignados al cargo
    const codigos = getNuevoIngresoCargos(user.cargo);
    const todos = getEstandares();
    const asignados = codigos.length > 0
      ? todos.filter(e => codigos.includes(e.estandar_codigo))
      : todos;

    // Juntar todas las preguntas de todos los estándares asignados
    const todasLasPreguntas: Pregunta[] = asignados.flatMap(e => e.preguntas);

    // Tomar 20 al azar del pool combinado
    setPreguntas(pickRandomQuestions(todasLasPreguntas, TOTAL_PREGUNTAS));

    if (numIntento === 2) setShowSegundoModal(true);
    else setQuizStarted(true);
  }, [navigate]);

  const finishQuiz = useCallback(async () => {
    if (finishedRef.current || !usuario) return;
    finishedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);

    const respuestas: RespuestaQuiz[] = preguntas.map((p, i) => {
      const userAnswer = answers[i] || '';
      return {
        preguntaId: p.id,
        pregunta: p.pregunta,
        respuestaUsuario: userAnswer,
        respuestaCorrecta: p.respuesta_correcta,
        esCorrecta: userAnswer === p.respuesta_correcta,
      };
    });

    const correctas = respuestas.filter(r => r.esCorrecta).length;
    // 1 punto por pregunta, máximo 20
    const puntaje = correctas;

    incrementarIntentosGlobal(usuario.dni);
    guardarResultado(usuario, puntaje, preguntas.length, respuestas, intentoNum);

    sessionStorage.setItem('bisa-ni-resultado', JSON.stringify({
      puntaje,
      total: preguntas.length,
      estandarNombre: 'Evaluación Global de Nuevo Ingreso',
      estandarCodigo: 'EVALUACION-GLOBAL',
      intentoNum,
      aprobado: puntaje > 13,
    }));
    navigate('/nuevo-ingreso/resultado');
  }, [usuario, preguntas, answers, intentoNum, navigate]);

  // Temporizador por pregunta
  useEffect(() => {
    if (!quizStarted || preguntas.length === 0) return;
    setTimeLeft(TIEMPO_POR_PREGUNTA);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setCurrent(c => {
            const next = c + 1;
            if (next >= preguntas.length) { finishQuiz(); return c; }
            return next;
          });
          return TIEMPO_POR_PREGUNTA;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current, quizStarted, preguntas.length, finishQuiz]);

  const selectOption = useCallback((letra: string) => {
    setAnswers(prev => ({ ...prev, [current]: letra }));
  }, [current]);

  if (showSegundoModal) {
    return <SegundoIntentoModal onConfirmar={() => { setShowSegundoModal(false); setQuizStarted(true); }} />;
  }

  if (!quizStarted || preguntas.length === 0) return null;

  const pregunta = preguntas[current];
  const progress = ((current + 1) / preguntas.length) * 100;
  const isLast = current === preguntas.length - 1;
  const timerColor = timeLeft <= 10 ? '#E6007E' : timeLeft <= 20 ? '#FF8C00' : '#1D262B';

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--color-gray)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 500 }}>Evaluación Global — Nuevo Ingreso</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: '#E6007E' }}>
            Intento #{intentoNum} de {MAX_INTENTOS}
          </span>
          <span style={{ fontSize: 12 }}>{preguntas.length} preguntas — 1 punto c/u — aprueba con 14+</span>
        </div>
      </div>

      {/* Barra de progreso + temporizador */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: 'var(--color-gray)' }}>Pregunta {current + 1} de {preguntas.length}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: timerColor }}>⏱ {timeLeft}s</span>
        </div>
        <div className="progress-bar" style={{ marginBottom: 6 }}>
          <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
        </div>
        <div style={{ height: 4, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 4, width: `${(timeLeft / TIEMPO_POR_PREGUNTA) * 100}%`, background: timerColor, transition: 'width 1s linear, background 0.3s' }} />
        </div>
      </div>

      {/* Pregunta */}
      <div className="question-card">
        <div className="question-card__category">{pregunta.categoria}</div>
        <div className="question-card__text">{pregunta.pregunta}</div>
        <div className="question-card__options">
          {OPCIONES.map(letra => (
            <button key={letra} className={`option-btn ${answers[current] === letra ? 'option-btn--selected' : ''}`}
              onClick={() => selectOption(letra)}>
              <span className="option-btn__letter">{letra}</span>
              <span>{getOptionText(pregunta, letra)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Navegación — sin retroceso */}
      <div className="quiz-nav" style={{ justifyContent: 'flex-end' }}>
        {!isLast ? (
          <button className="btn btn--primary" onClick={() => {
            if (timerRef.current) clearInterval(timerRef.current);
            setCurrent(c => c + 1);
          }}>
            Siguiente →
          </button>
        ) : (
          <button className="btn btn--primary" onClick={finishQuiz}>
            Finalizar
          </button>
        )}
      </div>
    </div>
  );
}
