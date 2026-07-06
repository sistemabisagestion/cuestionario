import { useParams, useNavigate } from 'react-router-dom';
import { getIntentoById } from '../utils/storage';

function getScoreMessage(puntaje: number): string {
  if (puntaje >= 18) return 'Excelente dominio del estándar';
  if (puntaje >= 14) return 'Buen conocimiento, sigue mejorando';
  if (puntaje > 12) return 'Aprobado, te recomendamos seguir repasando';
  return 'Necesitas repasar este estándar';
}

function getOptionText(respuesta: { respuestaUsuario: string; respuestaCorrecta: string }): { userLabel: string; correctLabel: string } {
  return {
    userLabel: respuesta.respuestaUsuario || 'Sin respuesta',
    correctLabel: respuesta.respuestaCorrecta,
  };
}

export default function ResultsPage() {
  const { intentoId } = useParams<{ intentoId: string }>();
  const navigate = useNavigate();

  const intento = intentoId ? getIntentoById(intentoId) : null;

  if (!intento) {
    return (
      <div className="empty-state">
        <p className="empty-state__text">No se encontró el resultado.</p>
        <button className="btn btn--primary" onClick={() => navigate('/standards')} style={{ marginTop: 16 }}>
          Volver a estándares
        </button>
      </div>
    );
  }

  const codigoCorto = intento.estandarCodigo.replace('CL-ES-GOP-', '');

  return (
    <>
      <div className="results-summary">
        <div className="results-summary__score">{intento.puntaje}</div>
        <div className="results-summary__total">de 20 puntos</div>
        <div style={{ marginTop: 12 }}>
          <span className={`badge ${intento.puntaje > 12 ? 'badge--aprobado' : 'badge--desaprobado'}`}>
            {intento.puntaje > 12 ? 'APROBADO' : 'DESAPROBADO'}
          </span>
        </div>
        <div className="results-summary__message">
          {getScoreMessage(intento.puntaje)}
        </div>
        <div style={{ fontSize: 14, color: 'var(--color-gray)', marginTop: 8 }}>
          {codigoCorto} — {intento.estandarNombre}
        </div>

        <div className="results-summary__actions">
          {intento.puntaje > 12 ? (
            <button
              className="btn btn--primary"
              onClick={() => navigate(`/quiz/${encodeURIComponent(intento.estandarCodigo)}`)}
            >
              Repetir estándar
            </button>
          ) : (
            <button
              className="btn btn--secondary"
              disabled
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            >
              Pendiente de aprobación
            </button>
          )}
          <button
            className="btn btn--secondary"
            onClick={() => navigate('/standards')}
          >
            Otro estándar
          </button>
          <button
            className="btn btn--dark"
            onClick={() => navigate('/history')}
          >
            Ver historial
          </button>
        </div>
      </div>

      <h2 style={{ marginBottom: 16, fontSize: 20 }}>Detalle de respuestas</h2>
      <div className="result-detail">
        {intento.respuestas.map((r, i) => {
          const { userLabel, correctLabel } = getOptionText(r);
          return (
            <div
              key={i}
              className={`result-item ${r.esCorrecta ? 'result-item--correct' : 'result-item--incorrect'}`}
            >
              <div className="result-item__header">
                <span className="result-item__number">Pregunta {i + 1}</span>
                <span className={`result-item__badge ${r.esCorrecta ? 'result-item__badge--correct' : 'result-item__badge--incorrect'}`}>
                  {r.esCorrecta ? 'Correcto' : 'Incorrecto'}
                </span>
              </div>
              <div className="result-item__question">{r.pregunta}</div>
              <div className="result-item__answers">
                {!r.esCorrecta && (
                  <span className="user-answer--wrong">Tu respuesta: {userLabel}</span>
                )}
                <span className="correct-answer">Respuesta correcta: {correctLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
