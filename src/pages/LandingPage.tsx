import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import bisaLogo from '../assets/bisa_fondo_negro.png';

export default function LandingPage() {
  const navigate = useNavigate();
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === 'admin123') {
      sessionStorage.setItem('bisa-admin-auth', 'true');
      navigate('/admin');
    } else {
      setError('Contraseña incorrecta');
    }
  }

  return (
    <div className="landing">
      <div className="landing__content">
        <div className="landing__logo">
          <img src={bisaLogo} alt="BISA" style={{ height: 128, objectFit: 'contain' }} />
          <p>Evaluación de Estándares de Gestión</p>
        </div>

        <div className="landing__cards">
          {/* Nuevo Ingreso */}
          <div className="landing__card" onClick={() => navigate('/nuevo-ingreso')}>
            <div className="landing__card-icon">🆕</div>
            <h2>Nuevo Ingreso</h2>
            <p>Primera vez en la plataforma</p>
          </div>

          {/* Usuario Antiguo */}
          <div className="landing__card" onClick={() => navigate('/register')}>
            <div className="landing__card-icon">👤</div>
            <h2>Usuario Antiguo</h2>
            <p>Ya tengo cuenta registrada</p>
          </div>

          {/* Administrador */}
          <div className="landing__card" onClick={() => setShowAdminModal(true)}>
            <div className="landing__card-icon">⚙️</div>
            <h2>Administrador</h2>
            <p>Ver resultados y reportes</p>
          </div>
        </div>
      </div>

      {showAdminModal && (
        <div className="modal-overlay" onClick={() => setShowAdminModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Acceso Administrador</h3>
            <form onSubmit={handleAdminSubmit}>
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Ingrese contraseña"
                  autoFocus
                />
                {error && <div className="error">{error}</div>}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" className="btn btn--primary" style={{ flex: 1 }}>Ingresar</button>
                <button type="button" className="btn btn--secondary" onClick={() => setShowAdminModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
