import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { getEstandarByCodigo } from '../data';
import { getLinksByCodigo } from '../data/estandarLinks';
import { getIntentosByDni } from '../utils/storage';

const MAX_INTENTOS = 2;

type PanelType = 'none' | 'sharepoint' | 'quiz';

export default function EstandarDetailPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const { user } = useUser();

  // Estados para controlar qué panel se abre
  const [panelType, setPanelType] = useState<PanelType>('none');
  const [pendingUrl, setPendingUrl] = useState<string>('');

  const codigoDecoded = decodeURIComponent(codigo || '');
  const estandar = getEstandarByCodigo(codigoDecoded);
  const links = getLinksByCodigo(codigoDecoded);

  if (!estandar) {
    navigate('/standards');
    return null;
  }

  const intentos = user ? getIntentosByDni(user.dni).filter(i => i.estandarCodigo === codigoDecoded) : [];
  const numIntentos = intentos.length;
  const bloqueado = numIntentos >= MAX_INTENTOS && !intentos.some(i => i.puntaje > 12);

  // Funciones para abrir y cerrar paneles
  const openSharepointPanel = (url: string) => {
    setPendingUrl(url);
    setPanelType('sharepoint');
  };

  const openQuizPanel = () => {
    setPanelType('quiz');
  };

  const closePanel = () => {
    setPanelType('none');
    setPendingUrl('');
  };

  const confirmAndOpenLink = () => {
    closePanel();
    if (pendingUrl) {
      window.open(pendingUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const confirmAndStartQuiz = () => {
    closePanel();
    navigate(`/quiz/${encodeURIComponent(codigoDecoded)}`);
  };

  // ESTILOS DEL PANEL
  const overlayStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(29, 38, 43, 0.7)', zIndex: 1000,
    opacity: panelType !== 'none' ? 1 : 0, pointerEvents: panelType !== 'none' ? 'auto' : 'none',
    transition: 'opacity 0.4s ease-in-out', display: 'flex', justifyContent: 'flex-end',
  };

  const panelStyle: React.CSSProperties = {
    width: '450px', maxWidth: '85vw', height: '100%', backgroundColor: '#fff',
    boxShadow: '-8px 0 30px rgba(0,0,0,0.2)', padding: '48px 32px',
    display: 'flex', flexDirection: 'column',
    transform: panelType !== 'none' ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.4s ease-out', boxSizing: 'border-box', overflowY: 'auto'
  };

  return (
    <>
      {/* PANEL LATERAL DINÁMICO */}
      <div style={overlayStyle} onClick={closePanel}>
        <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
          <button onClick={closePanel} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', fontSize: 24, color: '#8C9093', cursor: 'pointer', padding: 0, marginBottom: 20 }}>✕</button>
          
          {/* CONTENIDO 1: AVISO SHAREPOINT */}
          {panelType === 'sharepoint' && (
            <>
              <div style={{ fontSize: 64, marginBottom: 24, textAlign: 'center' }}>⚠️</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1D262B', marginBottom: 16, textAlign: 'center', lineHeight: 1.3 }}>Se requiere iniciar sesión en Microsoft</h2>
              <p style={{ fontSize: 15, color: '#555', lineHeight: 1.6, textAlign: 'center', marginBottom: 48, flexGrow: 1 }}>Estás a punto de abrir un material en SharePoint. Es **necesario** tener iniciada tu sesión con la cuenta de <strong>BISA en Microsoft</strong> para poder visualizar el material y realizar el examen con éxito.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button onClick={confirmAndOpenLink} style={{ padding: '14px 24px', background: '#E6007E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Entendido, continuar</button>
                <button onClick={closePanel} style={{ padding: '14px 24px', background: 'none', color: '#8C9093', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>Cancelar</button>
              </div>
            </>
          )}

          {/* CONTENIDO 2: INSTRUCCIONES DEL CUESTIONARIO */}
          {panelType === 'quiz' && (
            <>
              <div style={{ fontSize: 56, marginBottom: 16, textAlign: 'center' }}>📝</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1D262B', marginBottom: 24, textAlign: 'center', lineHeight: 1.3 }}>Instrucciones del Cuestionario</h2>
              
              <div style={{ fontSize: 15, color: '#444', lineHeight: 1.6, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div style={{ background: '#f5f6f7', padding: '16px', borderRadius: '12px', border: '1px solid #eaeaea' }}>
                  <p style={{ margin: '0 0 8px 0' }}><strong> ⚠️ Reglas de Evaluación:</strong></p>
                  <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <li><strong>1° Intento:</strong> 10 preguntas (2 puntos c/u).</li>
                    <li><strong>2° Intento (Recuperación):</strong> 20 preguntas (1 punto c/u).</li>
                    <li>Para aprobar necesitas una nota <strong>mayor a 12</strong>.</li>
                    <li>Tienes <strong>45 segundos</strong> para responder cada pregunta.</li>
                  </ul>
                </div>

                <div style={{ background: '#FFF8E1', padding: '16px', borderRadius: '12px', borderLeft: '4px solid #FFC107' }}>
                  <p style={{ margin: '0 0 8px 0', color: '#B28600' }}><strong>💡 Recomendación importante:</strong></p>
                  <p style={{ margin: 0, fontSize: 14 }}>Se recomienda <strong>ver el video</strong> antes de dar el primer intento. En caso de no aprobar (jalar), te sugerimos ver el video nuevamente y <strong>leer el documento</strong> del estándar correspondiente antes de usar tu último intento.</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
                <button onClick={confirmAndStartQuiz} style={{ padding: '14px 24px', background: '#E6007E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Entendido, Iniciar cuestionario</button>
                <button onClick={closePanel} style={{ padding: '14px 24px', background: 'none', color: '#8C9093', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>Cancelar</button>
              </div>
            </>
          )}

        </div>
      </div>

      {/* CONTENIDO PRINCIPAL DE LA PÁGINA */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#E6007E', letterSpacing: 1 }}>{estandar.estandar_codigo}</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1D262B', marginBottom: 8, lineHeight: 1.3 }}>{estandar.estandar_nombre}</h1>
        <p style={{ fontSize: 14, color: '#8C9093', marginBottom: 32 }}>
          {numIntentos === 0 ? '2 intentos disponibles' : numIntentos === 1 ? '1 intento restante' : bloqueado ? 'Sin intentos disponibles' : 'Aprobado ✓'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 40 }}>

          {/* 1. BOTÓN DE VIDEO */}
          <button
            onClick={() => links?.video && openSharepointPanel(links.video)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', borderRadius: 12,
              background: links?.video ? '#1D262B' : '#f0f0f0', color: links?.video ? '#fff' : '#999',
              border: 'none', width: '100%', cursor: links?.video ? 'pointer' : 'not-allowed',
              opacity: links?.video ? 1 : 0.5, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontFamily: 'inherit'
            }}
          >
            <span style={{ fontSize: 28 }}>▶️</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Ver video del estándar</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>Se abrirá en SharePoint</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 18, opacity: 0.6 }}>↗</span>
          </button>

          {/* 2. BOTÓN DE CUESTIONARIO */}
          <button
            disabled={bloqueado}
            onClick={() => !bloqueado && openQuizPanel()}
            style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', borderRadius: 12,
              background: bloqueado ? '#f0f0f0' : '#E6007E', color: bloqueado ? '#999' : '#fff',
              border: 'none', cursor: bloqueado ? 'not-allowed' : 'pointer',
              boxShadow: bloqueado ? 'none' : '0 4px 14px rgba(230,0,126,0.3)', width: '100%', textAlign: 'left', fontFamily: 'inherit'
            }}
          >
            <span style={{ fontSize: 28 }}>📝</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{bloqueado ? 'Cuestionario no disponible' : 'Iniciar cuestionario'}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                {bloqueado ? 'Has agotado tus intentos' : numIntentos === 0 ? `10 preguntas — Intento 1 de ${MAX_INTENTOS}` : `20 preguntas — Intento 2 de ${MAX_INTENTOS} (último)`}
              </div>
            </div>
            {!bloqueado && <span style={{ marginLeft: 'auto', fontSize: 20 }}>→</span>}
          </button>

          {/* 3. BOTÓN DE DOCUMENTO */}
          <button
            onClick={() => links?.documento && openSharepointPanel(links.documento)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', borderRadius: 12,
              background: links?.documento ? '#fff' : '#f0f0f0', color: links?.documento ? '#1D262B' : '#999',
              width: '100%', cursor: links?.documento ? 'pointer' : 'not-allowed', border: '1.5px solid #E0E0E0',
              opacity: links?.documento ? 1 : 0.5, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', fontFamily: 'inherit'
            }}
          >
            <span style={{ fontSize: 28 }}>📄</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Leer documento del estándar</div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>Se abrirá en SharePoint</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 18, opacity: 0.4 }}>↗</span>
          </button>
        </div>

        <button onClick={() => navigate('/standards')} style={{ background: 'none', border: 'none', color: '#8C9093', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontFamily: 'inherit' }}>← Volver a estándares</button>
      </div>
    </>
  );
}