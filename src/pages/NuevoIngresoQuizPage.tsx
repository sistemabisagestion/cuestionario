import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEstandares } from '../data';
import { getEstandaresByCargo as getNuevoIngresoCargos } from '../data/nuevoIngresoMapping';
import { pickRandomQuestions } from '../utils/randomize';
import type { Pregunta, RespuestaQuiz } from '../types';

// Conexión oficial con tu archivo de configuración de Supabase
import { supabase } from '../utils/supabase';

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
    if (idx >= 0) {
      data[idx].count += 1;
    } else {
      data.push({ dni, count: 1 });
    }
    localStorage.setItem(LS_KEY_INTENTOS_GLOBAL, JSON.stringify(data));
  } catch (e) {
    console.error('Error al guardar intentos', e);
  }
}

export default function NuevoIngresoQuizPage() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<any>(null);
  const [questions, setQuestions] = useState<Pregunta[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [quizStarted, setQuizStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIEMPO_POR_PREGUNTA);

  const [categoriasMap, setCategoriasMap] = useState<Record<number, string>>({});

  const timerRef = useRef<any>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('bisa-nuevo-ingreso');
    if (!raw) { navigate('/nuevo-ingreso'); return; }
    const user = JSON.parse(raw);
    setUsuario(user);

    const codigos = getNuevoIngresoCargos(user.cargo);
    const todos = getEstandares();
    const filtrados = codigos.length > 0
      ? todos.filter(e => codigos.includes(e.estandar_codigo))
      : todos;

    const poolPreguntas: Pregunta[] = [];
    const tempCategorias: string[] = [];

    filtrados.forEach(est => {
      if (est.preguntas && Array.isArray(est.preguntas)) {
        est.preguntas.forEach(p => {
          poolPreguntas.push(p);
          tempCategorias.push(est.estandar_nombre || est.estandar_codigo);
        });
      }
    });

    if (poolPreguntas.length === 0) {
      alert('No hay preguntas disponibles para los estándares de este cargo.');
      navigate('/nuevo-ingreso/standards');
      return;
    }

    const seleccionadas = pickRandomQuestions(poolPreguntas, TOTAL_PREGUNTAS);
    setQuestions(seleccionadas);

    const mapFinal: Record<number, string> = {};
    seleccionadas.forEach((selQuestion, index) => {
      const originalIdx = poolPreguntas.findIndex(p => p.id === selQuestion.id);
      if (originalIdx !== -1) {
        mapFinal[index] = tempCategorias[originalIdx];
      }
    });
    setCategoriasMap(mapFinal);
  }, [navigate]);

  const finishQuiz = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    let buenas = 0;
    const respuestasDetalle: RespuestaQuiz[] = [];

    questions.forEach((p, idx) => {
      const elegida = answers[idx] || '';
      const esCorrecta = elegida === p.respuesta_correcta;
      if (esCorrecta) buenas++;

      respuestasDetalle.push({
        pregunta: p.pregunta,
        respuesta_usuario: elegida,
        respuesta_correcta: p.respuesta_correcta,
        es_correcta: esCorrecta
      } as unknown as RespuestaQuiz);
    });

    incrementarIntentosGlobal(usuario.dni);
    const nuevoIntentoNum = getIntentosGlobal(usuario.dni);

    // Enviar datos en tiempo real a Supabase
    try {
      const uuidUnico = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
      
      const { error } = await supabase
        .from('intentos')
        .insert([
          {
            id: uuidUnico,
            tipo: 'NUEVO INGRESO',
            fecha: new Date().toISOString(),
            nombre: usuario.nombre,
            dni: usuario.dni,
            unidad_negocio: usuario.unidadNegocio || usuario.unidad_negocio || '-',
            disciplina: usuario.disciplina || '-',
            cargo: usuario.cargo,
            estandar_codigo: 'EVALUACION-GLOBAL',
            estandar_nombre: 'Evaluación de Diagnóstico General',
            intento_num: nuevoIntentoNum,
            puntaje: buenas,
            total_preguntas: questions.length,
            respuestas: respuestasDetalle
          }
        ]);

      if (error) {
        console.error('❌ Error al guardar en Supabase:', error.message, error.details);
      } else {
        console.log('✅ ¡Registro insertado exitosamente en Supabase!');
      }
    } catch (supabaseError) {
      console.error('❌ Error de conexión con Supabase:', supabaseError);
    }

    // Mantener almacenamiento local secundario
    try {
      const rawRes = localStorage.getItem(LS_KEY_RESULTADOS);
      const dataRes = rawRes ? JSON.parse(rawRes) : [];
      dataRes.push({
        dni: usuario.dni,
        nombre: usuario.nombre,
        cargo: usuario.cargo,
        puntaje: buenas,
        total: questions.length,
        fecha: new Date().toISOString()
      });
      localStorage.setItem(LS_KEY_RESULTADOS, JSON.stringify(dataRes));
    } catch (e) {
      console.error(e);
    }

    sessionStorage.setItem('bisa-ni-resultado', JSON.stringify({
      puntaje: buenas,
      total: questions.length,
      intentoNum: nuevoIntentoNum,
      estandarNombre: 'Evaluación de Diagnóstico General',
      respuestas: respuestasDetalle
    }));

    navigate('/nuevo-ingreso/resultado');
  }, [questions, answers, usuario, navigate]);

  const handleTimeOut = useCallback(() => {
    setAnswers(prev => ({ ...prev, [current]: '' }));
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
    } else {
      finishQuiz();
    }
  }, [current, questions.length, finishQuiz]);

  useEffect(() => {
    if (!quizStarted) return;

    setTimeLeft(TIEMPO_POR_PREGUNTA);

    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleTimeOut();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [current, quizStarted, handleTimeOut]);

  if (!usuario || questions.length === 0) return null;

  if (!quizStarted) {
    const intentosGlobales = getIntentosGlobal(usuario.dni);
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
            <strong>Cantidad de reactivos:</strong> {questions.length} preguntas aleatorias
          </div>
          <div style={{ fontSize: 14, color: '#4A5568' }}>
            <strong>Intento actual:</strong> Intento {intentosGlobales + 1} de {MAX_INTENTOS}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn btn--secondary" onClick={() => navigate('/nuevo-ingreso/standards')}>
            Volver
          </button>
          <button className="btn btn--primary" disabled={bloqueado} onClick={() => setQuizStarted(true)}>
            Comenzar Evaluación
          </button>
        </div>
      </div>
    );
  }

  const pregunta = questions[current];
  const categoriaTexto = categoriasMap[current] || 'Estándar Técnico';
  const isLast = current === questions.length - 1;

  const selectOption = (letra: string) => {
    setAnswers(prev => ({ ...prev, [current]: letra }));
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
              <button key={letra} className={`option-btn ${answers[current] === letra ? 'option-btn--selected' : ''}`}
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
            if (timerRef.current) clearInterval(timerRef.current);
            setCurrent(c => c + 1);
          }}>
            Siguiente
          </button>
        ) : (
          <button className="btn btn--primary" onClick={finishQuiz}>
            Finalizar Evaluación
          </button>
        )}
      </div>
    </div>
  );
}
