import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadDataset, loadDatasetVersion } from '../utils/datasets';
import { QUESTION_MS, clearQuizState, drawKeys, entriesFor, newQuizState, preparing, questionPool, readQuizState, remainingSeconds, resumeQuiz, saveQuizState } from '../utils/quizSession';
import type { PoolEntry, QuizState } from '../utils/quizSession';
import { assignedCodes } from '../utils/matrices';
import type { Pregunta, RespuestaQuiz } from '../types';

// Persistencia local y sincronización mediante la API del servidor.
import { getIntentosByDniAsync, readNuevoIngresoUser, saveIntentoAsync, startAttemptAsync } from '../utils/storage';

const OPCIONES = ['A', 'B', 'C', 'D', 'E'] as const;
const TIEMPO_POR_PREGUNTA = QUESTION_MS / 1000;
const TOTAL_PREGUNTAS = 20;
const MAX_INTENTOS = 2;
const LS_KEY_RESULTADOS = 'bisa-nuevo-ingreso-resultados';
// Attempts are counted from the stored records (server; local copy when offline). The server
// enforces the same limit when the evaluation starts.
const EVALUACION = 'EVALUACION-GLOBAL';

type Prepared = { kind: 'pool'; pool: PoolEntry[]; bankVersion: string; codigos: string[]; previos: number } | { kind: 'resume'; state: QuizState; entries: PoolEntry[] } | { kind: 'empty' };

export default function NuevoIngresoQuizPage() {
  const navigate = useNavigate();
  const [matrixError, setMatrixError] = useState('');
  const [usuario] = useState(readNuevoIngresoUser);
  // Bank of the assigned standards (questions are drawn only when the evaluation starts).
  const [prepared, setPrepared] = useState<Extract<Prepared, { kind: 'pool' }> | null>(null);
  // Persisted attempt (sessionStorage): questions by key, answers, position and deadline.
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [entries, setEntries] = useState<PoolEntry[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [enviando, setEnviando] = useState(false); // Estado para bloquear doble envío
  const finishing = useRef(false);

  const sessionKey = usuario ? `bisa-ni-quiz-${usuario.dni}` : '';
  const questions: Pregunta[] = entries.map(entry => entry.pregunta);
  const quizStarted = !!quiz && entries.length > 0;
  const current = quiz?.actual ?? 0;
  const answers = quiz?.respuestas ?? {};
  const timeLeft = quiz ? remainingSeconds(quiz, now) : TIEMPO_POR_PREGUNTA;

  const update = useCallback((next: QuizState) => { saveQuizState(sessionKey, next); setQuiz(next); }, [sessionKey]);

  const finishQuiz = useCallback(async (state: QuizState, selected: PoolEntry[]) => {
    // Si ya se está procesando un envío, bloqueamos ejecuciones duplicadas
    if (!usuario || finishing.current) return;
    finishing.current = true;
    setEnviando(true);
    // The attempt number was assigned by the server when the evaluation started.
    const finalState = state;
    saveQuizState(sessionKey, { ...finalState, estado: 'finalizando' });

    let buenas = 0;
    const respuestasDetalle: RespuestaQuiz[] = [];

    selected.forEach(({ pregunta: p }, idx) => {
      const elegida = finalState.respuestas[idx] || '';
      const esCorrecta = elegida === p.respuesta_correcta;
      if (esCorrecta) buenas++;

      respuestasDetalle.push({
        pregunta: p.pregunta,
        respuesta_usuario: elegida,
        respuesta_correcta: p.respuesta_correcta,
        es_correcta: esCorrecta
      } as unknown as RespuestaQuiz);
    });

    // Mismo id del intento en cada reintento: sin duplicados si la red falla.
    await saveIntentoAsync({
      id: finalState.attemptId, ticket: finalState.ticket, tipo: 'NUEVO INGRESO', fecha: new Date().toISOString(),
      nombre: usuario.nombre, dni: usuario.dni, correo: usuario.correo || '',
      unidadNegocio: usuario.unidadNegocio || usuario.unidad_negocio || '-',
      disciplina: usuario.disciplina || '-', cargo: usuario.cargo,
      estandarCodigo: EVALUACION, estandarNombre: 'Evaluación de Diagnóstico General',
      intentoNum: finalState.intentoNum || 1, puntaje: buenas, totalPreguntas: selected.length,
      respuestas: respuestasDetalle,
    });

    // Mantener almacenamiento local secundario
    try {
      const rawRes = localStorage.getItem(LS_KEY_RESULTADOS);
      const dataRes = rawRes ? JSON.parse(rawRes) : [];
      dataRes.push({
        dni: usuario.dni,
        nombre: usuario.nombre,
        cargo: usuario.cargo,
        puntaje: buenas,
        total: selected.length,
        fecha: new Date().toISOString()
      });
      localStorage.setItem(LS_KEY_RESULTADOS, JSON.stringify(dataRes));
    } catch (e) {
      console.error(e);
    }

    sessionStorage.setItem('bisa-ni-resultado', JSON.stringify({
      puntaje: buenas,
      total: selected.length,
      intentoNum: finalState.intentoNum || 1,
      estandarNombre: 'Evaluación de Diagnóstico General',
      respuestas: respuestasDetalle
    }));

    // Released only once the result is stored locally and queued: the next attempt gets a new id.
    clearQuizState(sessionKey);
    navigate('/nuevo-ingreso/resultado');
  }, [usuario, sessionKey, navigate]);

  useEffect(() => {
    if (!usuario) { navigate('/nuevo-ingreso'); return; }
    let active = true;
    // A reload resumes the stored attempt with the exact bank version it started with.
    const prepare = preparing(sessionKey, async (): Promise<Prepared> => {
      const saved = readQuizState(sessionKey, usuario.dni);
      if (saved) {
        const bank = await loadDatasetVersion('preguntas', saved.bankVersion);
        const restored = entriesFor(questionPool(bank.data.filter(e => saved.estandares.includes(e.estandar_codigo))), saved.keys);
        if (!restored) throw new Error('No se pudo recuperar la evaluación en curso.');
        return { kind: 'resume', state: saved, entries: restored };
      }
      const [codigos, bank, registros] = await Promise.all([assignedCodes('nuevo-ingreso', usuario.cargo), loadDataset('preguntas'), getIntentosByDniAsync(usuario.dni)]);
      const pool = questionPool(bank.data.filter(e => codigos.includes(e.estandar_codigo)));
      const previos = registros.filter(i => i.estandarCodigo === EVALUACION).length;
      return pool.length ? { kind: 'pool', pool, bankVersion: bank.version, codigos, previos } : { kind: 'empty' };
    });
    prepare.then(result => {
      if (!active) return;
      if (result.kind === 'empty') {
        alert('No hay preguntas disponibles para los estándares de este cargo.');
        navigate('/nuevo-ingreso/standards');
      } else if (result.kind === 'pool') {
        setPrepared(result);
      } else {
        // Time that passed while the page was closed counts: an expired question stays unanswered.
        const resumed = resumeQuiz(result.state);
        const respuestas = { ...resumed.state.respuestas };
        for (const index of resumed.expired) respuestas[index] = '';
        const state = { ...resumed.state, respuestas };
        setEntries(result.entries);
        update(state);
        if (resumed.finished) void finishQuiz(state, result.entries);
      }
    }).catch(error => {
      if (active) setMatrixError(error instanceof Error && error.message ? `No se pudo preparar la evaluación: ${error.message}` : 'No se pudo consultar la Matriz de Nuevo Ingreso o el Banco de Preguntas. Vuelve al listado e intenta nuevamente.');
    });
    return () => { active = false; };
  }, [usuario, sessionKey, navigate, update, finishQuiz]);

  // Starting: the questions are drawn once and the server starts the attempt (id + clock).
  async function startQuiz() {
    if (!usuario || !prepared || enviando) return;
    setEnviando(true);
    try {
      const keys = drawKeys(prepared.pool, TOTAL_PREGUNTAS);
      // The server refuses a third attempt and assigns the attempt number from its records.
      const attempt = await startAttemptAsync(usuario.dni, EVALUACION, keys.length);
      const state = newQuizState({ dni: usuario.dni, tipo: 'NUEVO INGRESO', cargo: usuario.cargo, estandares: prepared.codigos, bankVersion: prepared.bankVersion, intentoNum: attempt.intento_num, keys }, attempt);
      setEntries(entriesFor(prepared.pool, keys)!);
      update(state);
    } catch (error) {
      setMatrixError(error instanceof Error && error.message ? `No se pudo iniciar la evaluación: ${error.message}` : 'No se pudo iniciar la evaluación. Intenta nuevamente.');
    } finally { setEnviando(false); }
  }

  // Temporizador: el tiempo restante se calcula con la hora límite guardada, no con un contador.
  useEffect(() => {
    if (!quiz || quiz.estado !== 'en-curso' || !entries.length) return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (time < quiz.vencePregunta || finishing.current) return;
      // Tiempo agotado: la pregunta queda sin responder.
      const timedOut = { ...quiz, respuestas: { ...quiz.respuestas, [quiz.actual]: '' } };
      if (quiz.actual >= entries.length - 1) void finishQuiz(timedOut, entries);
      else update({ ...timedOut, actual: quiz.actual + 1, vencePregunta: Math.min(quiz.vencePregunta + QUESTION_MS, quiz.limite) });
    };
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [quiz, entries, update, finishQuiz]);

  if (matrixError) return <p role="alert">{matrixError}</p>;
  if (!usuario || (!quizStarted && !prepared)) return <p role="status">Consultando matriz vigente…</p>;

  if (!quizStarted) {
    const intentosGlobales = prepared?.previos ?? 0;
    const bloqueado = intentosGlobales >= MAX_INTENTOS;

    return (
      <div style={{ maxWidth: 600, margin: '60px auto', padding: '0 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1D262B', marginBottom: 12 }}>
          Confirmación de Inicio
        </h1>
        <p style={{ fontSize: 15, color: '#4A5568', marginBottom: 32, lineHeight: 1.5 }}>
          Está por comenzar la evaluación general unificada. Una vez iniciada, el temporizador correrá de forma continua para cada pregunta.
        </p>

        <div style={{ background: '#F7FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 24, marginBottom: 32, textAlign: 'left' }}>
          <div style={{ fontSize: 14, color: '#4A5568', marginBottom: 8 }}>
            <strong>Evaluación:</strong> Diagnóstico de Competencias Técnicas
          </div>
          <div style={{ fontSize: 14, color: '#4A5568', marginBottom: 8 }}>
            <strong>Cantidad de reactivos:</strong> {Math.min(TOTAL_PREGUNTAS, prepared?.pool.length ?? 0)} preguntas aleatorias
          </div>
          <div style={{ fontSize: 14, color: '#4A5568' }}>
            <strong>Intento actual:</strong> Intento {intentosGlobales + 1} de {MAX_INTENTOS}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn btn--secondary" disabled={enviando} onClick={() => navigate('/nuevo-ingreso/standards')}>
            Volver
          </button>
          <button className="btn btn--primary" disabled={bloqueado || enviando} onClick={() => void startQuiz()}>
            Comenzar Evaluación
          </button>
        </div>
      </div>
    );
  }

  const pregunta = questions[current];
  // Category of this exact question (standard code + id), not of another one with the same number.
  const categoriaTexto = entries[current]?.categoria || 'Estándar Técnico';
  const isLast = current === questions.length - 1;

  const selectOption = (letra: string) => {
    if (enviando || !quiz) return; // Bloquear cambios si ya está guardando
    update({ ...quiz, respuestas: { ...quiz.respuestas, [quiz.actual]: letra } });
  };

  const getOptionText = (p: Pregunta, letra: string) => {
    if (letra === 'A') return p.opcion_a;
    if (letra === 'B') return p.opcion_b;
    if (letra === 'C') return p.opcion_c;
    if (letra === 'D') return p.opcion_d;
    return p.opcion_e;
  };

  const timerColor = timeLeft <= 10 ? '#dc2626' : '#E6007E';

  return (
    <div className="layout layout--quiz">
      <header className="quiz-header">
        <div className="quiz-header__progress">
          Pregunta <strong>{current + 1}</strong> de {questions.length}
        </div>
        <div className="quiz-header__title" style={{ maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {categoriaTexto}
        </div>
        <div className="quiz-header__user">{usuario.nombre}</div>
      </header>

      <div style={{ background: '#fff', padding: '12px 24px', borderBottom: '1px solid #eee' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 4, color: timerColor }}>
          <span>Tiempo disponible para esta pregunta</span>
          <span>{timeLeft} segundos</span>
        </div>
        <div style={{ height: 4, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 4, width: `${(timeLeft / TIEMPO_POR_PREGUNTA) * 100}%`, background: timerColor, transition: 'width 1s linear, background 0.3s' }} />
        </div>
      </div>

      <div className="question-card">
        <div className="question-card__category">{categoriaTexto}</div>
        <div className="question-card__text">{pregunta.pregunta}</div>
        <div className="question-card__options">
          {OPCIONES.map(letra => (
            getOptionText(pregunta, letra) && (
              <button key={letra} disabled={enviando} className={`option-btn ${answers[current] === letra ? 'option-btn--selected' : ''}`}
                onClick={() => selectOption(letra)}>
                <span className="option-btn__letter">{letra}</span>
                <span>{getOptionText(pregunta, letra)}</span>
              </button>
            )
          ))}
        </div>
      </div>

      <div className="quiz-nav" style={{ justifyContent: 'flex-end' }}>
        {!isLast ? (
          <button className="btn btn--primary" onClick={() => {
            if (quiz && !enviando) update({ ...quiz, actual: quiz.actual + 1, vencePregunta: Math.min(Date.now() + QUESTION_MS, quiz.limite) });
          }}>
            Siguiente
          </button>
        ) : (
          <button className="btn btn--primary" disabled={enviando} onClick={() => quiz && void finishQuiz(quiz, entries)}>
            {enviando ? 'Guardando...' : 'Finalizar Evaluación'}
          </button>
        )}
      </div>
    </div>
  );
}
