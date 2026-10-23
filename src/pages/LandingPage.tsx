import { loginAdmin } from '../utils/api';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import bisaLogo from '../assets/bisa_fondo_negro.png';

// Line icons drawn on a 24px grid (1.8px stroke, round caps) so all of them share one visual weight.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
const UserPlusIcon = () => <Icon><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" /><path d="M19 8v6M16 11h6" /></Icon>;
const UserCheckIcon = () => <Icon><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" /><path d="m16 11.5 2 2 4-4" /></Icon>;
const ReportsIcon = () => <Icon><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 16v-4M12 16V8M16 16v-6" /></Icon>;
const ArrowIcon = () => <Icon><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;

interface ProfileCardProps { icon: ReactNode; title: string; description: string; onSelect: () => void; wide?: boolean }
function ProfileCard({ icon, title, description, onSelect, wide = false }: ProfileCardProps) {
  return (
    <button type="button" className={`landing-card${wide ? ' landing-card--wide' : ''}`} onClick={onSelect}>
      <span className="landing-card__icon">{icon}</span>
      <span className="landing-card__body">
        <span className="landing-card__title">{title}</span>
        <span className="landing-card__text">{description}</span>
      </span>
      <span className="landing-card__arrow"><ArrowIcon /></span>
    </button>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await loginAdmin(password);
      navigate('/admin');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error interno del servidor de autenticación. Intenta nuevamente.');
    }
  }

  return (
    <div className="landing">
      <main className="landing__content">
        <header className="landing__header">
          <img className="landing__logo" src={bisaLogo} alt="BISA" />
          <h1 className="landing__title">Evaluación de Estándares de Gestión</h1>
          <p className="landing__subtitle">Selecciona tu perfil para continuar</p>
        </header>

        <nav className="landing__grid" aria-label="Perfiles de acceso">
          <ProfileCard icon={<UserPlusIcon />} title="Nuevo Ingreso" description="Nuevos colaboradores." onSelect={() => navigate('/nuevo-ingreso')} />
          <ProfileCard icon={<UserCheckIcon />} title="Usuario Antiguo" description="Colaboradores vigentes." onSelect={() => navigate('/register')} />
          <ProfileCard icon={<ReportsIcon />} title="Administrador" description="Resultados, reportes y gestión de datos." onSelect={() => setShowAdminModal(true)} wide />
        </nav>
      </main>

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
