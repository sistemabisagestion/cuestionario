import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { getEstandarByCodigo } from '../data';
import { pickRandomQuestions } from '../utils/randomize';
import { saveIntentoAsync, generateId, getIntentosByDniAsync } from '../utils/storage';
import type { Pregunta, RespuestaQuiz } from '../types';

const OPCIONES = ['A', 'B', 'C', 'D', 'E'] as const;
const TIEMPO_POR_PREGUNTA = 45;
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

export default function QuizPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const { user } = useUser();

  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [estandarNombre, setEstandarNombre] = useState('');
  const [intentoNum, setIntentoNum] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIEMPO_POR_PREGUNTA);
  const [quizStarted, setQuizStarted] = useState(false);
  
  // NUEVO: Estados para controlar el modal moderno de abandono
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveAction, setLeaveAction] = useState<(() => void) | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intentoIdRef = useRef<string>(generateId()); 
  const initialSaveDone = useRef(false);
  const isFinishing = useRef(false);

  useEffect(() => {
    if (!codigo) return;
    const est = getEstandarByCodigo(decodeURIComponent(codigo));
    if (!est) { navigate('/standards'); return; }
    setEstandarNombre(est.estandar_nombre);

    if (user) {
      getIntentosByDniAsync(user.dni).then(intentos => {
        const count = intentos.filter(i => i.estandarCodigo === decodeURIComponent(codigo!)).length;
        const numIntento = count + 1;
        setIntentoNum(numIntento);

        if (numIntento > MAX_INTENTOS) {
          navigate('/standards');
          return;
        }

        const cantPreguntas = getPreguntasPorIntento(numIntento);
        setPreguntas(pickRandomQuestions(est.preguntas, cantPreguntas));
        setQuizStarted(true);
      });
    } else {
      setPreguntas(pickRandomQuestions(est.preguntas, 10));
      setQuizStarted(true);
    }
  }, [codigo, navigate, user]);

  // 1. Quemar el intento con "Nota 0" apenas inicie
  useEffect(() => {
    if (quizStarted && preguntas.length > 0 && user && !initialSaveDone.current) {
      initialSaveDone.current = true;
      saveIntentoAsync({
        id: intentoIdRef.current, dni: user.dni, nombre: user.nombre, correo: user.correo || '',
        unidadNegocio: user.unidadNegocio || '', disciplina: user.disciplina || '', cargo: user.cargo,
        estandarCodigo: decodeURIComponent(codigo!), estandarNombre,
        fecha: new Date().toISOString(), puntaje: 0, totalPreguntas: preguntas.length, respuestas: [],
      });
    }
  }, [quizStarted, preguntas, user, codigo, estandarNombre]);

  // 2. Alerta del navegador si intenta presionar F5 o cerrar pestaña (obligatorio por seguridad del navegador)
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

  // 3. Interceptar clics en el menú superior con Modal Moderno
  useEffect(() => {
    if (!quizStarted) return;
    const handleGlobalClick = (e: MouseEvent) => {
      if (isFinishing.current) return;

      const target = e.target as HTMLElement;
      const quizContainer = document.getElementById('quiz-container');
      const leaveModal = document.getElementById('leave-warning-modal');

      // Si hace clic dentro del examen o dentro del modal, lo ignoramos
      if ((quizContainer && quizContainer.contains(target)) || (leaveModal && leaveModal.contains(target))) {
        return;
      }

      const clickable = target.closest('a') || target.closest('button');
      if (clickable) {
        e.preventDefault();
        e.stopPropagation();

        // Guardamos la acción que el usuario intentaba hacer y abrimos el modal
        setLeaveAction(() => () => {
          isFinishing.current = true; // Apagamos los escudos
          clickable.click(); // Ejecutamos su clic original
        });
        setShowLeaveModal(true);
      }
    };
    
    document.addEventListener('click', handleGlobalClick, { capture: true });
    return () => document.removeEventListener('click', handleGlobalClick, { capture: true });
  }, [quizStarted]);

  // 4. Interceptar el botón de "Atrás" del navegador con Modal Moderno
  useEffect(() => {
    if (!quizStarted) return;
    
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      if (isFinishing.current) return;

      window.history.pushState(null, '', window.location.href); // Frenamos el retroceso

      setLeaveAction(() => () => {
        isFinishing.current = true;
        window.history.back(); // Si acepta, lo dejamos ir
      });
      setShowLeaveModal(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [quizStarted]);

  // Temporizador
  useEffect(() => {
    if (!quizStarted || preguntas.length === 0) return;
    setTimeLeft(TIEMPO_POR_PREGUNTA);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setCurrent(c => {
            const next = c + 1;
            if (next >= preguntas.length) {
              clearInterval(timerRef.current!);
              handleFinishAuto();
            }
            return next < preguntas.length ? next : c;
          });
          return TIEMPO_POR_PREGUNTA;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current, quizStarted, preguntas.length]);

  const selectOption = useCallback((letra: string) => {
    setAnswers(prev => ({ ...prev, [current]: letra }));
  }, [current]);

  function goNext() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (current < preguntas.length - 1) {
      setCurrent(c => c + 1);
    }
  }

  async function handleFinishAuto() {
    await finishQuiz();
  }

  async function handleFinishManual() {
    if (timerRef.current) clearInterval(timerRef.current);
    await finishQuiz();
  }

  async function finishQuiz() {
    if (!user || !codigo) return;
    
    isFinishing.current = true; // Desactivar alarmas

    const respuestas: RespuestaQuiz[] = preguntas.map((p, i) => {
      const userAnswer = answers[i] || '';
      return {
        preguntaId: p.id, pregunta: p.pregunta,
        respuestaUsuario: userAnswer, respuestaCorrecta: p.respuesta_correcta,
        esCorrecta: userAnswer === p.respuesta_correcta,
      };
    });

    const correctas = respuestas.filter(r => r.esCorrecta).length;
    const puntaje = Math.round((correctas / preguntas.length) * 20);

    await saveIntentoAsync({
      id: intentoIdRef.current, dni: user.dni, nombre: user.nombre, correo: user.correo || '',
      unidadNegocio: user.unidadNegocio || '', disciplina: user.disciplina || '', cargo: user.cargo,
      estandarCodigo: decodeURIComponent(codigo!), estandarNombre,
      fecha: new Date().toISOString(), puntaje, totalPreguntas: preguntas.length, respuestas,
    });

    navigate(`/results/${intentoIdRef.current}`);
  }

  // --- COMPONENTE DEL MODAL MODERNO ---
  const WarningModal = () => (
    <div id="leave-warning-modal" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(29, 38, 43, 0.85)', zIndex: 9999, // Fondo oscuro estilo BISA
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', backdropFilter: 'blur(5px)',
      opacity: showLeaveModal ? 1 : 0, transition: 'opacity 0.3s ease'
    }}>
      <div style={{
        background: '#fff', padding: '40px 32px', borderRadius: '16px', 
        maxWidth: '420px', width: '100%', textAlign: 'center', 
        boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        transform: showLeaveModal ? 'translateY(0)' : 'translateY(20px)',
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
            onClick={() => setShowLeaveModal(false)} 
            style={{ padding: '14px 24px', borderRadius: '8px', border: '1px solid #E0E0E0', background: '#fff', color: '#1D262B', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}
          >
            Volver al examen
          </button>
          <button 
            onClick={() => leaveAction && leaveAction()} 
            style={{ padding: '14px 24px', borderRadius: '8px', border: 'none', background: '#E6007E', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}
          >
            Sí, abandonar con 0
          </button>
        </div>
      </div>
    </div>
  );

  if (preguntas.length === 0 || !quizStarted) return null;

  const pregunta = preguntas[current];
  const progress = ((current + 1) / preguntas.length) * 100;
  const isLastQuestion = current === preguntas.length - 1;
  const timerColor = timeLeft <= 10 ? '#E6007E' : timeLeft <= 20 ? '#FF8C00' : '#1D262B';
  const timerPercent = (timeLeft / TIEMPO_POR_PREGUNTA) * 100;

  return (
    <>
      {/* SE RENDERIZA EL MODAL SI SE ACTIVA */}
      {showLeaveModal && <WarningModal />}

      <div id="quiz-container" style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--color-gray)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 500 }}>{estandarNombre}</span>
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