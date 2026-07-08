import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { getEstandarByCodigo } from '../data';
import { pickRandomQuestions } from '../utils/randomize';
import { saveIntentoAsync, generateId, getIntentosByDniAsync } from '../utils/storage';
import type { Pregunta, RespuestaQuiz } from '../types';

// Conexión oficial directa con Supabase
import { supabase } from '../utils/supabase';

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
  
  // Estados para controlar el modal moderno de abandono
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveAction, setLeaveAction] = useState<(() => void) | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intentoIdRef = useRef<string>(generateId());
  const initialSaveDone = useRef(false);
  const isFinishing = useRef(false);

  // Determinar el tipo de usuario de forma dinámica
  const userTipo = user?.tipo || (decodeURIComponent(codigo || '') === 'EVALUACION-GLOBAL' ? 'NUEVO INGRESO' : 'USUARIO ANTIGUO');

  // Determinar el nombre correcto del examen según las reglas de negocio
  const nombreExamenFinal = userTipo === 'NUEVO INGRESO' ? 'Evaluación de Diagnóstico General' : estandarNombre;

  useEffect(() => {
    if (!codigo || !user) return;

    const attemptKey = `bisa-quiz-attempt-${user.dni}-${decodeURIComponent(codigo)}`;
    const existingId = window.sessionStorage.getItem(attemptKey);

    if (existingId) {
      intentoIdRef.current = existingId;
      return;
    }

    const freshId = generateId();
    intentoIdRef.current = freshId;
    window.sessionStorage.setItem(attemptKey, freshId);
  }, [codigo, user]);

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

  // Bloque de guardado inicial con "Nota 0" apenas inicia la prueba (Sincronizado directo a Supabase)
  useEffect(() => {
    if (quizStarted && preguntas.length > 0 && user && !initialSaveDone.current && estandarNombre) {
      const attemptKey = `bisa-quiz-attempt-${user.dni}-${decodeURIComponent(codigo!)}`;
      const savedKey = `${attemptKey}:saved`;

      if (window.sessionStorage.getItem(savedKey)) {
        initialSaveDone.current = true;
        return;
      }

      initialSaveDone.current = true;
      window.sessionStorage.setItem(savedKey, '1');

      // 1. Guardado Local Secundario
      saveIntentoAsync({
        id: intentoIdRef.current, dni: user.dni, nombre: user.nombre, correo: user.correo || '',
        unidadNegocio: user.unidadNegocio || '', disciplina: user.disciplina || '', cargo: user.cargo,
        estandarCodigo: decodeURIComponent(codigo!), estandarNombre: nombreExamenFinal,
        fecha: new Date().toISOString(), puntaje: 0, totalPreguntas: preguntas.length, respuestas: [],
        tipo: userTipo, 
      });

      // 2. Inserción directa en tiempo real a Supabase (Formato snake_case correcto)
      supabase
        .from('intentos')
        .upsert([
          {
            id: intentoIdRef.current,
            tipo: userTipo,
            fecha: new Date().toISOString(),
            nombre: user.nombre,
            dni: user.dni,
            unidad_negocio: user.unidadNegocio || (user as any).unidad_negocio || '-',
            disciplina: user.disciplina || '-',
            cargo: user.cargo,
            estandar_codigo: decodeURIComponent(codigo!),
            estandar_nombre: nombreExamenFinal,
            intento_num: intentoNum || 1,
            puntaje: 0,
            total_preguntas: preguntas.length,
            respuestas: []
          }
        ])
        .then(({ error }) => {
          if (error) console.error('❌ Error Supabase (Nota 0):', error.message);
          else console.log('✅ Supabase: Intento inicial registrado con Nota 0');
        });
    }
  }, [quizStarted, preguntas, user, codigo, estandarNombre, userTipo, nombreExamenFinal, intentoNum]);

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
          clickable.click(); 
        });
        setShowLeaveModal(true);
      }
    };
    
    document.addEventListener('click', handleGlobalClick, { capture: true });
    return () => document.removeEventListener('click', handleGlobalClick, { capture: true });
  }, [quizStarted]);

  // Interceptar el botón de "Atrás" del navegador con Modal Moderno
  useEffect(() => {
    if (!quizStarted) return;
    
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      if (isFinishing.current) return;

      window.history.pushState(null, '', window.location.href); 

      setLeaveAction(() => () => {
        isFinishing.current = true;
        window.history.back(); 
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
    
    isFinishing.current = true; 

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

    // Mapeo adaptado con llaves snake_case idénticas a Supabase
    const respuestasDetalleSupabase = respuestas.map(r => ({
      pregunta: r.pregunta,
      respuesta_usuario: r.respuestaUsuario,
      respuesta_correcta: r.respuestaCorrecta,
      es_correcta: r.esCorrecta
    }));

    // 1. Guardado Final Local
    await saveIntentoAsync({
      id: intentoIdRef.current, dni: user.dni, nombre: user.nombre, correo: user.correo || '',
      unidadNegocio: user.unidadNegocio || '', disciplina: user.disciplina || '', cargo: user.cargo,
      estandarCodigo: decodeURIComponent(codigo!), estandarNombre: nombreExamenFinal,
      fecha: new Date().toISOString(), puntaje, totalPreguntas: preguntas.length, respuestas,
      tipo: userTipo, 
    });

    // 2. Guardado Final Directo en Supabase (Sobreescribe la nota 0 inicial gracias al id único)
    try {
      const { error } = await supabase
        .from('intentos')
        .upsert([
          {
            id: intentoIdRef.current,
            tipo: userTipo,
            fecha: new Date().toISOString(),
            nombre: user.nombre,
            dni: user.dni,
            unidad_negocio: user.unidadNegocio || (user as any).unidad_negocio || '-',
            disciplina: user.disciplina || '-',
            cargo: user.cargo,
            estandar_codigo: decodeURIComponent(codigo!),
            estandar_nombre: nombreExamenFinal,
            intento_num: intentoNum || 1,
            puntaje: puntaje,
            total_preguntas: preguntas.length,
            respuestas: respuestasDetalleSupabase
          }
        ]);

      if (error) {
        console.error('❌ Error al actualizar puntuación final en Supabase:', error.message);
      } else {
        console.log('✅ ¡Examen de Usuario Antiguo guardado con éxito en Supabase!');
      }
    } catch (supabaseError) {
      console.error('❌ Error crítico de conexión con Supabase:', supabaseError);
    }

    navigate(`/results/${intentoIdRef.current}`);
  }

  // --- COMPONENTE DEL MODAL MODERNO ---
  const WarningModal = () => (
    <div id="leave-warning-modal" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(29, 38, 43, 0.85)', zIndex: 9999, 
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
      {showLeaveModal && <WarningModal />}

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
