import { assignedCodes } from '../utils/matrices';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../context/useUser';
import { loadDataset, loadDatasetVersion } from '../utils/datasets';
import { QUESTION_MS, clearQuizState, drawKeys, entriesFor, newQuizState, preparing, questionPool, readQuizState, remainingSeconds, resumeQuiz, saveQuizState } from '../utils/quizSession';
import type { QuizState } from '../utils/quizSession';
import { saveIntentoAsync, getIntentosByDniAsync, startAttemptAsync } from '../utils/storage';
import type { Pregunta, RespuestaQuiz } from '../types';


const OPCIONES = ['A', 'B', 'C', 'D', 'E'] as const;
const TIEMPO_POR_PREGUNTA = QUESTION_MS / 1000;
const MAX_INTENTOS = 2;

function getPreguntasPorIntento(intentoNum: number): number {
  return intentoNum <= 1 ? 10 : 20;
}

function getOptionText(pregunta: Pregunta, letra: string): string {
  const map: Record<string, keyof Pregunta> = {
    A: 'opcion_a', B: 'opcion_b', C: 'opcion_c', D: 'opcion_d', E: 'opcion_e',
  };
  return pregunta[map[letra]] as string;
}

type Prepared = { kind: 'ok'; state: QuizState; nombre: string; questions: Pregunta[] } | { kind: 'redirect' } | { kind: 'error'; message: string };

// --- COMPONENTE DEL MODAL MODERNO ---
function WarningModal({ visible, onStay, onLeave }: { visible: boolean; onStay: () => void; onLeave: () => void }) {
  return (
    <div id="leave-warning-modal" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(29, 38, 43, 0.85)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', backdropFilter: 'blur(5px)',
      opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease'
    }}>
      <div style={{
        background: '#fff', padding: '40px 32px', borderRadius: '16px',
        maxWidth: '420px', width: '100%', textAlign: 'center',
        boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'transform 0.3s ease'
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ margin: '0 0 16px', color: '#1D262B', fontSize: 24, fontWeight: 700 }}>¡Examen en curso!</h2>

        <div style={{ background: '#FFF8E1', padding: '16px', borderRadius: '10px', borderLeft: '4px solid #FFC107', marginBottom: 24 }}>
          <p style={{ margin: 0, color: '#B28600', fontSize: 15, lineHeight: 1.5, textAlign: 'left' }}>
            Si sales de esta página ahora, tu intento se guardará permanentemente con <strong>nota CERO (0)</strong>.
          </p>
        </div>

        <p style={{ color: '#555', fontSize: 15, marginBottom: 32 }}>
          ¿Estás completamente seguro de que quieres abandonar?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={onStay}
            style={{ padding: '14px 24px', borderRadius: '8px', border: '1px solid #E0E0E0', background: '#fff', color: '#1D262B', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}
          >
            Volver al examen
          </button>
          <button
            onClick={onLeave}
            style={{ padding: '14px 24px', borderRadius: '8px', border: 'none', background: '#E6007E', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}
          >
            Sí, abandonar con 0
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QuizPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const [matrixError, setMatrixError] = useState('');
  const { user } = useUser();

  // Persisted attempt (sessionStorage): questions by key, answers, position and deadline.
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [estandarNombre, setEstandarNombre] = useState('');
  const [now, setNow] = useState(() => Date.now());

  // Estados para controlar el modal moderno de abandono
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveAction, setLeaveAction] = useState<(() => void) | null>(null);

  const isFinishing = useRef(false);

  const codigoDecoded = decodeURIComponent(codigo || '');
  // Determinar el tipo de usuario de forma dinámica
  const userTipo = user?.tipo || (codigoDecoded === 'EVALUACION-GLOBAL' ? 'NUEVO INGRESO' : 'USUARIO ANTIGUO');

  // Determinar el nombre correcto del examen según las reglas de negocio
  const nombreExamenFinal = userTipo === 'NUEVO INGRESO' ? 'Evaluación de Diagnóstico General' : estandarNombre;

  const attemptKey = user && codigo ? `bisa-quiz-attempt-${user.dni}-${codigoDecoded}` : '';
  const quizStarted = !!quiz && preguntas.length > 0;
  const current = quiz?.actual ?? 0;
  const answers = quiz?.respuestas ?? {};
  const intentoNum = quiz?.intentoNum ?? 0;
  const timeLeft = quiz ? remainingSeconds(quiz, now) : TIEMPO_POR_PREGUNTA;

  // Every change of the attempt is stored before it is shown.
  const update = useCallback((next: QuizState) => { saveQuizState(attemptKey, next); setQuiz(next); }, [attemptKey]);

  const finishQuiz = useCallback(async (state: QuizState, questions: Pregunta[]) => {
    // One submission per attempt (double click, timer and click at once, reload while saving).
    if (!user || isFinishing.current) return;
    isFinishing.current = true;
    saveQuizState(attemptKey, { ...state, estado: 'finalizando' });

    const respuestas: RespuestaQuiz[] = questions.map((p, i) => {
      const userAnswer = state.respuestas[i] || '';
      return {
        preguntaId: p.id, pregunta: p.pregunta,
        respuestaUsuario: userAnswer, respuestaCorrecta: p.respuesta_correcta,
        esCorrecta: userAnswer === p.respuesta_correcta,
      };
    });

    const correctas = respuestas.filter(r => r.esCorrecta).length;
    const puntaje = Math.round((correctas / questions.length) * 20);

    // Guardado final local y sincronización mediante la API del servidor. Si la red falla,
    // queda en la cola local y se reintenta con el mismo id (sin duplicados).
    await saveIntentoAsync({
      id: state.attemptId, ticket: state.ticket, dni: user.dni, nombre: user.nombre, correo: user.correo || '',
      unidadNegocio: user.unidadNegocio || '', disciplina: user.disciplina || '', cargo: user.cargo,
      estandarCodigo: codigoDecoded, estandarNombre: nombreExamenFinal,
      fecha: new Date().toISOString(), puntaje, totalPreguntas: questions.length, respuestas,
      tipo: userTipo, intentoNum: state.intentoNum || 1,
    });
    // Released only once the result is stored locally and queued: the next attempt gets a new id.
    clearQuizState(attemptKey);

    navigate(`/results/${state.attemptId}`);
  }, [user, attemptKey, codigoDecoded, nombreExamenFinal, userTipo, navigate]);

  useEffect(() => {
    if (!user || !codigo) return;
    let active = true;
    // A reload resumes the stored attempt with the exact bank version it started with. Otherwise
    // the server starts a new attempt (id + clock) and its questions are drawn once.
    const prepare = preparing(attemptKey, async (): Promise<Prepared> => {
      const saved = readQuizState(attemptKey, user.dni);
      if (saved) {
        const bank = await loadDatasetVersion('preguntas', saved.bankVersion);
        const est = bank.data.find(e => e.estandar_codigo === codigoDecoded);
        const entries = est ? entriesFor(questionPool([est]), saved.keys) : null;
        if (!est || !entries) throw new Error('No se pudo recuperar la evaluación en curso.');
        return { kind: 'ok', state: saved, nombre: est.estandar_nombre, questions: entries.map(entry => entry.pregunta) };
      }
      const [bank, codes, intentos] = await Promise.all([
        loadDataset('preguntas'), assignedCodes('personal-antiguo', user.cargo), getIntentosByDniAsync(user.dni),
      ]);
      const est = bank.data.find(e => e.estandar_codigo === codigoDecoded);
      if (!est) return { kind: 'redirect' };
      if (!codes.includes(codigoDecoded)) return { kind: 'error', message: 'Este estándar no está asignado a tu cargo en la Matriz de Personal Antiguo.' };
      const numIntento = intentos.filter(i => i.estandarCodigo === codigoDecoded).length + 1;
      if (numIntento > MAX_INTENTOS) return { kind: 'redirect' };

      const pool = questionPool([est]);
      const keys = drawKeys(pool, getPreguntasPorIntento(numIntento));
      // The server refuses a third attempt and confirms the attempt number from its records.
      const attempt = await startAttemptAsync(user.dni, codigoDecoded, keys.length, numIntento);
      const state = newQuizState({ dni: user.dni, tipo: 'USUARIO ANTIGUO', cargo: user.cargo, estandares: [codigoDecoded], bankVersion: bank.version, intentoNum: attempt.intento_num, keys }, attempt);
      saveQuizState(attemptKey, state);
      // Guardado inicial con nota 0: el intento cuenta aunque se abandone.
      void saveIntentoAsync({
        id: attempt.id, dni: user.dni, nombre: user.nombre, correo: user.correo || '',
        unidadNegocio: user.unidadNegocio || '', disciplina: user.disciplina || '', cargo: user.cargo,
        estandarCodigo: codigoDecoded, estandarNombre: userTipo === 'NUEVO INGRESO' ? 'Evaluación de Diagnóstico General' : est.estandar_nombre,
        fecha: new Date().toISOString(), puntaje: 0, totalPreguntas: keys.length, respuestas: [],
        tipo: userTipo, intentoNum: attempt.intento_num,
      });
      return { kind: 'ok', state, nombre: est.estandar_nombre, questions: entriesFor(pool, keys)!.map(entry => entry.pregunta) };
    });
    prepare.then(result => {
      if (!active) return;
      if (result.kind === 'redirect') { navigate('/standards'); return; }
      if (result.kind === 'error') { setMatrixError(result.message); return; }
      // Time that passed while the page was closed counts: expired questions keep their marked answer.
      const resumed = resumeQuiz(result.state);
      setEstandarNombre(result.nombre);
      setPreguntas(result.questions);
      update(resumed.state);
      if (resumed.finished) void finishQuiz(resumed.state, result.questions);
    }).catch(error => {
      if (active) setMatrixError(error instanceof Error && error.message ? `No se pudo preparar la evaluación: ${error.message}` : 'No se pudo consultar la matriz vigente o el Banco de Preguntas. Vuelve al listado e intenta nuevamente.');
    });
    return () => { active = false; };
  }, [codigo, user, attemptKey, codigoDecoded, userTipo, navigate, update, finishQuiz]);

  // Alerta del navegador si intenta presionar F5 o cerrar pestaña
  useEffect(() => {
    if (!quizStarted) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isFinishing.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [quizStarted]);

  // Interceptar clics en el menú superior con Modal Moderno
  useEffect(() => {
    if (!quizStarted) return;
    const handleGlobalClick = (e: MouseEvent) => {
      if (isFinishing.current) return;

      const target = e.target as HTMLElement;
      const quizContainer = document.getElementById('quiz-container');
      const leaveModal = document.getElementById('leave-warning-modal');

      if ((quizContainer && quizContainer.contains(target)) || (leaveModal && leaveModal.contains(target))) {
        return;
      }

      const clickable = target.closest('a') || target.closest('button');
      if (clickable) {
        e.preventDefault();
        e.stopPropagation();

        setLeaveAction(() => () => {
          isFinishing.current = true;
          clearQuizState(attemptKey); // abandoned: stays recorded with score 0
          clickable.click();
        });
        setShowLeaveModal(true);
      }
    };

    document.addEventListener('click', handleGlobalClick, { capture: true });
    return () => document.removeEventListener('click', handleGlobalClick, { capture: true });
  }, [quizStarted, attemptKey]);

  // Interceptar el botón de "Atrás" del navegador con Modal Moderno
  useEffect(() => {
    if (!quizStarted) return;

    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      if (isFinishing.current) return;

      window.history.pushState(null, '', window.location.href);

      setLeaveAction(() => () => {
        isFinishing.current = true;
        clearQuizState(attemptKey); // abandoned: stays recorded with score 0
        window.history.back();
      });
      setShowLeaveModal(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [quizStarted, attemptKey]);

  // Temporizador: el tiempo restante se calcula con la hora límite guardada, no con un contador.
  useEffect(() => {
    if (!quiz || quiz.estado !== 'en-curso' || !preguntas.length) return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (time < quiz.vencePregunta || isFinishing.current) return;
      if (quiz.actual >= preguntas.length - 1) void finishQuiz(quiz, preguntas);
      // Tiempo agotado: la respuesta marcada se conserva y se pasa a la siguiente pregunta.
      else update({ ...quiz, actual: quiz.actual + 1, vencePregunta: Math.min(quiz.vencePregunta + QUESTION_MS, quiz.limite) });
    };
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [quiz, preguntas, update, finishQuiz]);

  function selectOption(letra: string) {
    if (!quiz || isFinishing.current) return;
    update({ ...quiz, respuestas: { ...quiz.respuestas, [quiz.actual]: letra } });
  }

  function goNext() {
    if (!quiz || isFinishing.current || quiz.actual >= preguntas.length - 1) return;
    update({ ...quiz, actual: quiz.actual + 1, vencePregunta: Math.min(Date.now() + QUESTION_MS, quiz.limite) });
  }

  function handleFinishManual() {
    if (quiz) void finishQuiz(quiz, preguntas);
  }

  if (matrixError) return <p role="alert">{matrixError}</p>;
  if (preguntas.length === 0 || !quizStarted) return null;

  const pregunta = preguntas[current];
  const progress = ((current + 1) / preguntas.length) * 100;
  const isLastQuestion = current === preguntas.length - 1;
  const timerColor = timeLeft <= 10 ? '#E6007E' : timeLeft <= 20 ? '#FF8C00' : '#1D262B';
  const timerPercent = (timeLeft / TIEMPO_POR_PREGUNTA) * 100;

  return (
    <>
      {showLeaveModal && <WarningModal visible={showLeaveModal} onStay={() => setShowLeaveModal(false)} onLeave={() => leaveAction && leaveAction()} />}

      <div id="quiz-container" style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--color-gray)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 500 }}>{nombreExamenFinal}</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            {intentoNum > 0 && (
              <span style={{ fontWeight: 700, fontSize: 18, color: '#E6007E' }}>
                Intento #{intentoNum} de {MAX_INTENTOS}
              </span>
            )}
            <span style={{ fontSize: 12 }}>{preguntas.length} preguntas</span>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--color-gray)' }}>Pregunta {current + 1} de {preguntas.length}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: timerColor, transition: 'color 0.3s' }}>⏱ {timeLeft}s</span>
          </div>
          <div className="progress-bar" style={{ marginBottom: 6 }}><div className="progress-bar__fill" style={{ width: `${progress}%` }} /></div>
          <div style={{ height: 4, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 4, width: `${timerPercent}%`, background: timerColor, transition: 'width 1s linear, background 0.3s' }} />
          </div>
        </div>

        <div className="question-card">
          <div className="question-card__category">{pregunta.categoria}</div>
          <div className="question-card__text">{pregunta.pregunta}</div>
          <div className="question-card__options">
            {OPCIONES.map(letra => (
              <button
                key={letra}
                className={`option-btn ${answers[current] === letra ? 'option-btn--selected' : ''}`}
                onClick={() => selectOption(letra)}
              >
                <span className="option-btn__letter">{letra}</span>
                <span>{getOptionText(pregunta, letra)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="quiz-nav" style={{ justifyContent: 'flex-end' }}>
          {!isLastQuestion ? (
            <button className="btn btn--primary" onClick={goNext}>Siguiente →</button>
          ) : (
            <button className="btn btn--primary" onClick={handleFinishManual}>Finalizar</button>
          )}
        </div>
      </div>
    </>
  );
}
