import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { UserProvider, useUser } from './context/UserContext';
import LandingPage from './pages/LandingPage';
import RegistrationPage from './pages/RegistrationPage';
import SelectStandardPage from './pages/SelectStandardPage';
import QuizPage from './pages/QuizPage';
import ResultsPage from './pages/ResultsPage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';
import EstandarDetailPage from './pages/EstandarDetailPage';
import NuevoIngresoPage from './pages/NuevoIngresoPage';
import NuevoIngresoStandardsPage from './pages/NuevoIngresoStandardsPage';
import NuevoIngresoDetailPage from './pages/NuevoIngresoDetailPage';
import NuevoIngresoQuizPage from './pages/NuevoIngresoQuizPage';
import NuevoIngresoResultadoPage from './pages/NuevoIngresoResultadoPage';
import bisaLogoBlanco from './assets/bisa_fondo_negro.png';
import type { ReactNode } from 'react';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useUser();
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RedirectIfAuth({ children }: { children: ReactNode }) {
  const { user } = useUser();
  if (user) return <Navigate to="/standards" replace />;
  return <>{children}</>;
}

function Header() {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user || location.pathname === '/' || location.pathname === '/register' || location.pathname === '/admin') return null;

  return (
    <header className="header">
      <div className="header__brand" onClick={() => navigate('/standards')}>
        <img src={bisaLogoBlanco} alt="BISA" style={{ height: 56, objectFit: 'contain' }} />
      </div>
      <div className="header__nav">
        <span className="header__user">{user.nombre}</span>
        <button className="header__link" onClick={() => navigate('/standards')}>Estándares</button>
        <button className="header__link" onClick={() => navigate('/history')}>Historial</button>
        <button className="header__link header__link--logout" onClick={() => { logout(); navigate('/'); }}>Salir</button>
      </div>
    </header>
  );
}

function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="layout">
      <Header />
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <Routes>
          {/* Rutas comunes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RedirectIfAuth><RegistrationPage /></RedirectIfAuth>} />
          <Route path="/admin" element={<AdminPage />} />

          {/* Rutas usuario antiguo */}
          <Route path="/standards" element={<RequireAuth><AppLayout><SelectStandardPage /></AppLayout></RequireAuth>} />
          <Route path="/estandar/:codigo" element={<RequireAuth><AppLayout><EstandarDetailPage /></AppLayout></RequireAuth>} />
          <Route path="/quiz/:codigo" element={<RequireAuth><AppLayout><QuizPage /></AppLayout></RequireAuth>} />
          <Route path="/results/:intentoId" element={<RequireAuth><AppLayout><ResultsPage /></AppLayout></RequireAuth>} />
          <Route path="/history" element={<RequireAuth><AppLayout><HistoryPage /></AppLayout></RequireAuth>} />

          {/* Rutas nuevo ingreso */}
          <Route path="/nuevo-ingreso" element={<NuevoIngresoPage />} />
          <Route path="/nuevo-ingreso/standards" element={<NuevoIngresoStandardsPage />} />
          <Route path="/nuevo-ingreso/estandar/:codigo" element={<NuevoIngresoDetailPage />} />
          <Route path="/nuevo-ingreso/quiz/:codigo" element={<NuevoIngresoQuizPage />} />
          <Route path="/nuevo-ingreso/quiz-global" element={<NuevoIngresoQuizPage />} />
          <Route path="/nuevo-ingreso/resultado" element={<NuevoIngresoResultadoPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </UserProvider>
    </BrowserRouter>
  );
}
