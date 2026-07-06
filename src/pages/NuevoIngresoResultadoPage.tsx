import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function NuevoIngresoResultadoPage() {
  const navigate = useNavigate();
  const [resultado, setResultado] = useState<any>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('bisa-ni-resultado');
    if (!raw) { navigate('/nuevo-ingreso/standards'); return; }
    setResultado(JSON.parse(raw));
  }, [navigate]);

  if (!resultado) return null;

  const aprobado = resultado.puntaje > 13;

  return (
    <div style={{ maxWidth: 520, margin: '60px auto', padding: '0 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>{aprobado ? '🎉' : '😔'}</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1D262B', marginBottom: 8 }}>
        {aprobado ? '¡Felicitaciones!' : 'No aprobaste esta vez'}
      </h1>
      <p style={{ fontSize: 15, color: '#8C9093', marginBottom: 32 }}>{resultado.estandarNombre}</p>

      <div style={{ background: aprobado ? '#dcfce7' : '#fee2e2', borderRadius: 16, padding: 32, marginBottom: 32 }}>
        <div style={{ fontSize: 56, fontWeight: 800, color: aprobado ? '#16a34a' : '#dc2626' }}>
          {resultado.puntaje}/{resultado.total}
        </div>
        <div style={{ fontSize: 16, color: aprobado ? '#16a34a' : '#dc2626', fontWeight: 600, marginTop: 8 }}>
          {aprobado ? 'APROBADO' : 'DESAPROBADO'}
        </div>
        <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>
          Intento {resultado.intentoNum} de 2 — Nota mínima para aprobar: 14/20
        </div>
      </div>

      {!aprobado && resultado.intentoNum < 2 && (
        <div style={{ background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 10, padding: 16, marginBottom: 24, fontSize: 14, color: '#7B5800' }}>
          📚 Tienes 1 intento más. Te recomendamos revisar el material antes de intentarlo de nuevo.
        </div>
      )}

      <button
        className="btn btn--primary"
        style={{ width: '100%', marginBottom: 12 }}
        onClick={() => navigate('/nuevo-ingreso/standards')}
      >
        Volver a mis estándares
      </button>
    </div>
  );
}
