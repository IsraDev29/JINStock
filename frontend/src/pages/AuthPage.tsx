import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const AuthPage: React.FC = () => {
  const { login, register, loginOffline } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state (creates standard Cajero / Staff; Admins created via seed or admin panel)
  const [regName, setRegName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regStore, setRegStore] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Verificación de correo
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await login(loginEmail, loginPassword, rememberDevice) as any;
      if (res.success) {
        setSuccessMessage('¡Acceso exitoso! Redirigiendo...');
        setTimeout(() => {
          const user = res.usuario || (localStorage.getItem('jinstock_user') ? JSON.parse(localStorage.getItem('jinstock_user')!) : null);
          if (user?.rol === 'CAJERO') {
            navigate('/pos');
          } else {
            navigate('/dashboard');
          }
        }, 500);
      } else if (res.requireVerification) {
        setVerificationEmail(res.email || loginEmail);
        setIsVerifying(true);
        setErrorMessage(res.message);
      } else {
        setErrorMessage(res.message || 'Error al iniciar sesión. Intente de nuevo.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de red. Verifique su servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (regPassword.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const fullName = [regName, regLastName].filter(Boolean).join(' ') || regStore || 'Cajero Librería';
      const res = await register({
        nombre: fullName,
        email: regEmail,
        password: regPassword,
        rol: 'CAJERO',
      });

      if (res.success) {
        if (res.requireVerification) {
          setSuccessMessage(res.message || 'Código de verificación enviado.');
          setVerificationEmail(res.email || regEmail);
          setIsVerifying(true);
        } else {
          setSuccessMessage('¡Cuenta de cajero creada exitosamente! Redirigiendo...');
          setTimeout(() => {
            navigate('/pos');
          }, 600);
        }
      } else {
        setErrorMessage(res.message || 'Error al crear la cuenta.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de comunicación con el backend.');
    } finally {
      setLoading(false);
    }
  };

  const Logo = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: activeTab === 'login' ? 16 : 32, justifyContent: activeTab === 'login' ? 'center' : 'flex-start' }}>
      <img src="/JINSTOCK.png" alt="JINSTOCK" style={{ height: 42, width: 'auto', objectFit: 'contain' }} />
      <span style={{ fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: 0.5 }}>JINStock</span>
    </div>
  );

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail, code: verificationCode })
      });
      const res = await response.json();
      
      if (res.success && res.data) {
        setSuccessMessage('Verificación exitosa. Iniciando sesión...');
        // Store token and user data
        localStorage.setItem('jinstock_token', res.data.token);
        localStorage.setItem('jinstock_user', JSON.stringify(res.data.usuario));
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 600);
      } else {
        setErrorMessage(res.message || 'Error al verificar el código.');
      }
    } catch (err) {
      setErrorMessage('Error de conexión al verificar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell app-theme-coral" style={{ fontFamily: "'Inter', sans-serif", minHeight: '100vh', display: 'flex', position: 'relative', overflow: 'hidden' }}>
      {activeTab === 'login' && !isVerifying ? (
        // --- LOGIN VIEW ---
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1 }}>
          <Logo />
          <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 24, textAlign: 'center' }}>Gestiona tu pasión, escala tu negocio.</p>
          
          <div className="w-full max-w-[420px] bg-[#24232b] border border-[#33323c] rounded-3xl p-6 sm:p-9 shadow-2xl">
            <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Bienvenido</h2>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>Ingresa tus credenciales para acceder</p>
            
            {typeof navigator !== 'undefined' && !navigator.onLine && (
              <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', color: '#fef08a', padding: 14, borderRadius: 12, fontSize: 13, marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#facc15' }}>wifi_off</span>
                  <span>Sin conexión a Internet</span>
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: 12, color: '#d1d5db', lineHeight: 1.4 }}>
                  El sistema puede operar sin internet. Puedes acceder al Punto de Venta (POS) con el catálogo local y facturar normalmente.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    loginOffline('CAJERO', rememberDevice);
                    navigate('/pos');
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: '#facc15',
                    color: '#000',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>point_of_sale</span>
                  Entrar al POS en Modo Offline
                </button>
              </div>
            )}

            {errorMessage && <div role="alert" aria-live="assertive" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 16 }}>{errorMessage}</div>}
            {successMessage && <div role="status" aria-live="polite" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 16 }}>{successMessage}</div>}

            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor="login-email" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</label>
                <div style={{ position: 'relative' }}>
                  <span className="material-symbols-outlined" style={{ position: 'absolute', left: 16, top: 14, color: '#6b7280', fontSize: 20 }}>mail</span>
                  <input id="login-email" type="email" autoComplete="username" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="nombre@libreria.com" style={{ width: '100%', padding: '14px 16px 14px 48px', background: '#1c1b22', border: '1px solid #33323c', borderRadius: 12, color: '#fff', outline: 'none', fontSize: 15 }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label htmlFor="login-password" style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>Contraseña</label>
                  <button type="button" onClick={() => { setSuccessMessage(null); setErrorMessage('La recuperación de contraseña no está disponible todavía. Contacta al administrador de tu cuenta.'); }} style={{ background: 'none', border: 0, padding: 0, fontSize: 12, color: '#8b5cf6', cursor: 'pointer' }}>¿Olvidaste la clave?</button>
                </div>
                <div style={{ position: 'relative' }}>
                  <span className="material-symbols-outlined" style={{ position: 'absolute', left: 16, top: 14, color: '#6b7280', fontSize: 20 }}>lock</span>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    id="login-password"
                    autoComplete="current-password"
                    required
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder={showLoginPassword ? 'Ingresa tu contraseña' : '••••••••'}
                    style={{
                      width: '100%',
                      padding: '14px 44px 14px 48px',
                      background: '#1c1b22',
                      border: '1px solid #33323c',
                      borderRadius: 12,
                      color: '#fff',
                      outline: 'none',
                      fontSize: 15,
                      letterSpacing: showLoginPassword ? 'normal' : 2
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    title={showLoginPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    aria-label={showLoginPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: showLoginPassword ? '#a78bfa' : '#9ca3af',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 6,
                      borderRadius: 8,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                      {showLoginPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={e => setRememberDevice(e.target.checked)}
                    style={{ accentColor: '#8b5cf6', width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: '#9ca3af' }}>Recordarme en este dispositivo</span>
                </label>
              </div>

              <button disabled={loading} style={{ width: '100%', padding: 16, borderRadius: 12, background: 'linear-gradient(90deg, #4A148C, #A788F4)', color: '#fff', fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer', marginTop: 8 }}>
                {loading ? 'Cargando...' : 'Entrar al Sistema'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: '#9ca3af' }}>
              ¿No tienes una cuenta? <button onClick={() => { setActiveTab('register'); setErrorMessage(null); }} style={{ background: 'none', border: 'none', color: '#FDDB35', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Regístrate gratis</button>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 24, marginTop: 32, fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
            <span style={{ cursor: 'pointer' }}>Soporte</span>
            <span style={{ cursor: 'pointer' }}>Privacidad</span>
            <span style={{ cursor: 'pointer' }}>Estado</span>
          </div>

        </div>
      ) : isVerifying ? (
        // --- VERIFY VIEW ---
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1 }}>
          <Logo />
          <div className="w-full max-w-[420px] bg-[#24232b] border border-[#33323c] rounded-3xl p-6 sm:p-9 shadow-2xl">
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Verifica tu correo</h2>
            <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 20 }}>Hemos enviado un código de 6 dígitos a <strong>{verificationEmail}</strong>.</p>
            
            {errorMessage && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 16 }}>{errorMessage}</div>}
            {successMessage && <div style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 16 }}>{successMessage}</div>}

            <form onSubmit={handleVerifySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Código de Verificación</label>
                <input type="text" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} placeholder="123456" maxLength={6} style={{ width: '100%', padding: '14px 16px', background: '#1c1b22', border: '1px solid #33323c', borderRadius: 12, color: '#fff', outline: 'none', fontSize: 24, letterSpacing: 8, textAlign: 'center' }} required />
              </div>
              <button disabled={loading} style={{ width: '100%', padding: 16, borderRadius: 12, background: 'linear-gradient(90deg, #4A148C, #A788F4)', color: '#fff', fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer', marginTop: 8 }}>
                {loading ? 'Verificando...' : 'Verificar y Entrar'}
              </button>
              <button type="button" onClick={() => setIsVerifying(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: 14, cursor: 'pointer', marginTop: 8, textDecoration: 'underline' }}>Volver</button>
            </form>
          </div>
        </div>
      ) : (
        // --- REGISTER VIEW ---
        <div style={{ flex: 1, display: 'flex', zIndex: 1 }} className="flex-col lg:flex-row">
          
          {/* Left Column */}
          <div className="flex-1 p-6 sm:p-10 lg:p-16 flex flex-col justify-center">
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              <Logo />
              <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: '#fff', lineHeight: 1.15, marginBottom: 32, letterSpacing: '-0.02em' }}>
                Únete a la nueva<br/>era de la <span style={{ color: '#ef4444' }}>gestión<br/>literaria.</span>
              </h1>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ color: '#3b82f6', fontSize: 20 }}>rocket_launch</span>
                  </div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: '0 0 4px 0' }}>Escala sin límites</h3>
                    <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>Nuestra plataforma crece con tu librería, desde un solo local hasta cadenas nacionales.</p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(234,179,8,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ color: '#eab308', fontSize: 20 }}>shield</span>
                  </div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: '0 0 4px 0' }}>Seguridad Total</h3>
                    <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>Tus datos de inventario y ventas protegidos con encriptación de nivel bancario.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: 20 }}>sentiment_satisfied</span>
                  </div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: '0 0 4px 0' }}>Soporte 24/7</h3>
                    <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>Equipo humano dedicado a resolver cualquier duda en minutos, no días.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (Form) */}
          <div className="flex-1 p-4 sm:p-8 flex items-center justify-center">
            <div className="w-full max-w-[500px] bg-[#24232b] border border-[#33323c] rounded-3xl p-6 sm:p-10 shadow-2xl relative">
              
              <div style={{ position: 'absolute', top: 24, right: 24, display: 'flex', gap: 6 }}>
                 <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffbd2e' }} />
                 <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4b5563' }} />
                 <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4b5563' }} />
              </div>

              <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Crear Cuenta</h2>
              <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24 }}>Comienza tu prueba de 14 días gratis</p>
              
              {errorMessage && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 16 }}>{errorMessage}</div>}
              {successMessage && <div style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 16 }}>{successMessage}</div>}

              <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nombre</label>
                    <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="Ej. Juan" style={{ width: '100%', padding: '14px 16px', background: '#1c1b22', border: '1px solid #33323c', borderRadius: 12, color: '#fff', outline: 'none', fontSize: 15 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Apellido</label>
                    <input type="text" value={regLastName} onChange={e => setRegLastName(e.target.value)} placeholder="Ej. Pérez" style={{ width: '100%', padding: '14px 16px', background: '#1c1b22', border: '1px solid #33323c', borderRadius: 12, color: '#fff', outline: 'none', fontSize: 15 }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nombre de la librería</label>
                  <input type="text" value={regStore} onChange={e => setRegStore(e.target.value)} placeholder="Mi Librería Ideal" style={{ width: '100%', padding: '14px 16px', background: '#1c1b22', border: '1px solid #33323c', borderRadius: 12, color: '#fff', outline: 'none', fontSize: 15 }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email profesional</label>
                  <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="hola@tuempresa.com" style={{ width: '100%', padding: '14px 16px', background: '#1c1b22', border: '1px solid #33323c', borderRadius: 12, color: '#fff', outline: 'none', fontSize: 15 }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder={showRegPassword ? 'Ingresa tu contraseña' : 'Mínimo 8 caracteres'}
                      style={{
                        width: '100%',
                        padding: '14px 44px 14px 16px',
                        background: '#1c1b22',
                        border: '1px solid #33323c',
                        borderRadius: 12,
                        color: '#fff',
                        outline: 'none',
                        fontSize: 15,
                        letterSpacing: showRegPassword ? 'normal' : 1
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      title={showRegPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      aria-label={showRegPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: showRegPassword ? '#a78bfa' : '#9ca3af',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 6,
                        borderRadius: 8,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                        {showRegPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div style={{ background: 'rgba(167, 136, 244, 0.08)', border: '1px solid rgba(167, 136, 244, 0.2)', padding: '12px 16px', borderRadius: 12, fontSize: 13, color: '#c4b5fd' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 6 }}>badge</span>
                  Registro habilitado para personal de ventas (Cajero). Las cuentas de Administrador se crean desde el panel de control o mediante CLI.
                </div>

                <button disabled={loading} style={{ width: '100%', padding: '16px', borderRadius: 12, background: 'linear-gradient(90deg, #4A148C, #A788F4, #5F8FFF)', color: '#fff', fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading ? 'Procesando...' : 'Siguiente Paso'} 
                  {!loading && <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#9ca3af' }}>
                ¿Ya tienes cuenta? <br/>
                <button onClick={() => { setActiveTab('login'); setErrorMessage(null); }} style={{ background: 'none', border: 'none', color: '#60a5fa', fontWeight: 600, cursor: 'pointer', padding: 4, marginTop: 4 }}>Inicia sesión</button>
              </div>

              <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
                Al registrarte, aceptas nuestros<br/>
                <a href="#" style={{ color: '#d1d5db', textDecoration: 'underline' }}>Términos de Servicio</a> y <a href="#" style={{ color: '#d1d5db', textDecoration: 'underline' }}>Política de Privacidad</a>.
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
