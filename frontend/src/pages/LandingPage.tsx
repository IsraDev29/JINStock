import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  Menu,
  MonitorSmartphone,
  Receipt,
  ShieldCheck,
  Truck,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import './LandingPage.css';

const NAV = [
  { href: '#funciones', label: 'Producto' },
  { href: '#flujo', label: 'Cómo funciona' },
  { href: '#precios', label: 'Planes' },
  { href: '#faq', label: 'Preguntas' },
];

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Inventario pensado para librerías',
    desc: 'Kardex por título, editorial y presentación. Alertas de reposición antes de que se agote el bestseller de la semana.',
    accent: '#4A148C',
    wide: true,
  },
  {
    icon: Receipt,
    title: 'Cobro en segundos',
    desc: 'POS táctil con efectivo, tarjeta y transferencia. Ticket listo sin fricción en hora pico.',
    accent: '#5F8FFF',
  },
  {
    icon: BarChart3,
    title: 'Analítica que se entiende',
    desc: 'Ventas del día, rotación y productos estrella en un tablero que un dueño puede leer en 30 segundos.',
    accent: '#A788F4',
  },
  {
    icon: Truck,
    title: 'Compras y proveedores',
    desc: 'Pedidos, costos y recepción en un solo flujo. El stock se actualiza al confirmar la compra.',
    accent: '#FF6B6B',
  },
  {
    icon: Users,
    title: 'Roles claros',
    desc: 'Administrador y cajero con permisos distintos. El equipo trabaja sin pisarse ni ver de más.',
    accent: '#4A148C',
  },
  {
    icon: WifiOff,
    title: 'Sigue vendiendo sin internet',
    desc: 'Modo offline real: las ventas quedan guardadas y se sincronizan al reconectar.',
    accent: '#FDDB35',
    wide: true,
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Carga tu catálogo',
    desc: 'Importa productos o créalos en minutos. Categorías, precios y stock inicial quedan listos para vender.',
  },
  {
    n: '02',
    title: 'Cobra en el mostrador',
    desc: 'El cajero busca, cobra y emite ticket. Si se va la luz o el wifi, la venta no se pierde.',
  },
  {
    n: '03',
    title: 'Decide con números',
    desc: 'Cierra el día con ventas, márgenes y qué reponer. Menos intuición, más control.',
  },
];

const PLANS = [
  {
    id: 'basico',
    plan: 'Básico',
    price: 'Gratis',
    period: '',
    desc: 'Para empezar a operar una librería pequeña sin compromiso.',
    features: [
      'Hasta 200 productos',
      '1 usuario administrador',
      'Punto de venta esencial',
      'Reportes mensuales',
      'Modo sin conexión',
    ],
    cta: 'Empezar gratis',
  },
  {
    id: 'profesional',
    plan: 'Profesional',
    price: 'C$ 499',
    period: 'mes',
    desc: 'El plan que usan librerías en crecimiento que ya no pueden improvisar el stock.',
    features: [
      'Productos ilimitados',
      'Hasta 5 usuarios',
      'Gestión de proveedores',
      'Reportes avanzados',
      'Modo sin conexión',
      'Soporte prioritario',
    ],
    highlighted: true,
    badge: 'Recomendado',
    cta: 'Probar Profesional',
  },
  {
    id: 'empresarial',
    plan: 'Empresarial',
    price: 'C$ 999',
    period: 'mes',
    desc: 'Para cadenas con sucursales, control central y necesidades de integración.',
    features: [
      'Todo lo del plan Profesional',
      'Usuarios ilimitados',
      'Múltiples sucursales',
      'API de integración',
      'Análisis avanzado',
      'Soporte 24/7 dedicado',
    ],
    cta: 'Hablar con ventas',
  },
];

const FAQS = [
  {
    q: '¿Puedo vender si se cae el internet?',
    a: 'Sí. JINStock guarda las ventas en el dispositivo y las sincroniza cuando vuelve la conexión. El mostrador no se detiene.',
  },
  {
    q: '¿Sirve para una sola sucursal o para varias?',
    a: 'Ambos. El plan Básico y Profesional cubren una operación concentrada. Empresarial añade sucursales, usuarios ilimitados y API.',
  },
  {
    q: '¿Necesito instalar algo en cada caja?',
    a: 'No. Funciona en el navegador de computadora, tablet o laptop. Lo abres, inicias sesión y cobras.',
  },
  {
    q: '¿Hay contrato o permanencia?',
    a: 'No. Empiezas gratis, subes de plan cuando lo necesites y cancelas cuando quieras.',
  },
];

const ProductPreview: React.FC = () => (
  <div
    className="landing-card"
    style={{
      padding: 12,
      background: '#fff',
      boxShadow: '0 28px 60px rgba(74, 20, 140, 0.14)',
      position: 'relative',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px 14px',
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF6B6B' }} />
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FDDB35' }} />
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#5F8FFF' }} />
      <span style={{ marginLeft: 8, fontSize: 12, color: '#5c5868', fontWeight: 600 }}>
        POS · Sucursal Centro
      </span>
    </div>

    <div
      className="landing-pos-grid"
      style={{
        background: '#f7f4ff',
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#4A148C', letterSpacing: '0.06em' }}>
          VENTA EN CURSO
        </div>
        {[
          ['Cien años de soledad', 'C$ 420'],
          ['Cuaderno profesional', 'C$ 120'],
          ['Resma carta', 'C$ 185'],
        ].map(([name, price]) => (
          <div
            key={name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '1px solid rgba(17,17,17,0.08)',
              fontSize: 13,
            }}
          >
            <span style={{ fontWeight: 600 }}>{name}</span>
            <span style={{ color: '#4A148C', fontWeight: 700 }}>{price}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          background: '#4A148C',
          color: '#fff',
          borderRadius: 14,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 180,
        }}
      >
        <div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>Total a cobrar</div>
          <div className="landing-serif" style={{ fontSize: 32, fontWeight: 700, marginTop: 4 }}>
            C$ 725
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div
            style={{
              flex: 1,
              background: '#FDDB35',
              color: '#111',
              borderRadius: 10,
              padding: '10px 0',
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            Cobrar
          </div>
          <div
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.12)',
              borderRadius: 10,
              padding: '10px 0',
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Ticket
          </div>
        </div>
      </div>
    </div>

    <div
      className="landing-float-chip"
      style={{
        position: 'absolute',
        left: -18,
        bottom: 36,
        background: '#fff',
        border: '1px solid rgba(17,17,17,0.08)',
        borderRadius: 14,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 12px 28px rgba(17,17,17,0.08)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#5F8FFF',
          boxShadow: '0 0 0 4px rgba(95,143,255,0.2)',
        }}
      />
      <div>
        <div style={{ fontSize: 11, fontWeight: 800 }}>Offline listo</div>
        <div style={{ fontSize: 11, color: '#5c5868' }}>3 ventas en cola</div>
      </div>
    </div>

    <div
      className="landing-float-chip"
      style={{
        position: 'absolute',
        right: -12,
        top: 28,
        background: '#FDDB35',
        color: '#111',
        borderRadius: 14,
        padding: '10px 12px',
        boxShadow: '0 12px 28px rgba(253,219,53,0.35)',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700 }}>Ventas hoy</div>
      <div className="landing-serif" style={{ fontSize: 20, fontWeight: 700 }}>
        C$ 38,450
      </div>
    </div>
  </div>
);

export const LandingPage: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <div className="landing-root">
      <a className="landing-skip" href="#contenido">
        Saltar al contenido
      </a>

      <header className={`landing-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div
          className="landing-wrap"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 72,
          }}
        >
          <a href="#contenido" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/JINSTOCK.png" alt="" style={{ height: 36, width: 'auto' }} />
            <span style={{ fontWeight: 800, fontSize: 18, color: '#111111', letterSpacing: '-0.03em' }}>
              JINStock
            </span>
          </a>

          <nav className="landing-desktop-nav" aria-label="Principal" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="landing-nav-link">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="landing-desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/auth" className="landing-btn landing-btn-ghost">
              Ingresar
            </Link>
            <Link to="/auth" className="landing-btn landing-btn-primary">
              Comenzar gratis
            </Link>
          </div>

          <button
            type="button"
            className="landing-menu-btn"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              display: 'none',
              width: 42,
              height: 42,
              borderRadius: 12,
              border: '1px solid rgba(17,17,17,0.08)',
              background: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {menuOpen && (
          <div
            style={{
              background: '#fff',
              borderTop: '1px solid rgba(17,17,17,0.08)',
              padding: '16px 20px 24px',
            }}
          >
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  style={{ textDecoration: 'none', color: '#111', fontWeight: 700, padding: '12px 8px' }}
                >
                  {item.label}
                </a>
              ))}
              <Link to="/auth" className="landing-btn landing-btn-primary" style={{ marginTop: 8 }}>
                Comenzar gratis
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main id="contenido">
        <section className="landing-wrap landing-hero-grid">
          <div>
            <div className="landing-chip" style={{ background: 'rgba(167,136,244,0.18)', color: '#4A148C' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4A148C' }} />
              Software para librerías
            </div>
            <h1
              className="landing-serif"
              style={{
                fontSize: 'clamp(40px, 6vw, 64px)',
                lineHeight: 1.08,
                letterSpacing: '-0.03em',
                margin: '18px 0 16px',
                fontWeight: 600,
              }}
            >
              El mostrador en orden.
              <br />
              El inventario, también.
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.65, color: '#5c5868', maxWidth: 520, margin: 0 }}>
              JINStock reúne ventas, stock y proveedores en una interfaz clara para librerías independientes y cadenas. Menos papel, menos sorpresas al cierre.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 28 }}>
              <Link to="/auth" className="landing-btn landing-btn-primary">
                Crear cuenta gratis <ArrowRight size={16} />
              </Link>
              <a href="#precios" className="landing-btn landing-btn-ghost">
                Ver planes
              </a>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 22, fontSize: 13, color: '#5c5868' }}>
              {['Sin tarjeta', 'Listo en el navegador', 'Offline incluido'].map((item) => (
                <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Check size={15} color="#4A148C" />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <ProductPreview />
        </section>

        <section className="landing-wrap" style={{ padding: '12px 0 56px' }}>
          <div
            className="landing-card"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              padding: '8px 8px',
            }}
          >
            {[
              { k: 'Cierre diario', v: 'en 2 minutos', tone: '#4A148C' },
              { k: 'Factura', v: 'en 3 toques', tone: '#5F8FFF' },
              { k: 'Stock', v: 'siempre al día', tone: '#A788F4' },
              { k: 'Internet', v: 'opcional', tone: '#111111' },
            ].map((stat) => (
              <div key={stat.k} style={{ padding: '18px 22px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#5c5868', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {stat.k}
                </div>
                <div className="landing-serif" style={{ fontSize: 26, fontWeight: 600, color: stat.tone, marginTop: 4 }}>
                  {stat.v}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="funciones" className="landing-wrap" style={{ padding: '24px 0 72px' }}>
          <div style={{ maxWidth: 640, marginBottom: 28 }}>
            <div className="landing-chip" style={{ background: 'rgba(95,143,255,0.14)', color: '#5F8FFF' }}>
              Producto
            </div>
            <h2 className="landing-serif" style={{ fontSize: 'clamp(30px, 4vw, 44px)', margin: '14px 0 10px', fontWeight: 600 }}>
              Lo que el mostrador pide, sin ruido visual
            </h2>
            <p style={{ margin: 0, color: '#5c5868', fontSize: 16, lineHeight: 1.6 }}>
              Seis capacidades, una sola operación. Cada módulo está pensado para el ritmo de una librería, no para un ERP genérico.
            </p>
          </div>

          <div className="landing-bento">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className={`landing-card ${feature.wide ? 'span-2' : ''}`}
                  style={{ padding: 24, minHeight: 180 }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: `${feature.accent}1A`,
                      color: feature.accent === '#FDDB35' ? '#111' : feature.accent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{feature.title}</h3>
                  <p style={{ margin: 0, color: '#5c5868', lineHeight: 1.6, fontSize: 14 }}>{feature.desc}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="flujo" style={{ background: '#111111', color: '#fff', padding: '72px 0' }}>
          <div className="landing-wrap">
            <div style={{ maxWidth: 560, marginBottom: 36 }}>
              <div className="landing-chip" style={{ background: 'rgba(253,219,53,0.16)', color: '#FDDB35' }}>
                Cómo funciona
              </div>
              <h2 className="landing-serif" style={{ fontSize: 'clamp(30px, 4vw, 44px)', margin: '14px 0 10px', fontWeight: 600 }}>
                Tres pasos. El resto es vender.
              </h2>
            </div>
            <div className="landing-steps">
              {STEPS.map((step) => (
                <article
                  key={step.n}
                  style={{
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 20,
                    padding: 24,
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div style={{ color: '#A788F4', fontWeight: 800, fontSize: 13, letterSpacing: '0.08em' }}>{step.n}</div>
                  <h3 className="landing-serif" style={{ fontSize: 26, margin: '12px 0 10px', fontWeight: 600 }}>
                    {step.title}
                  </h3>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.72)', lineHeight: 1.65 }}>{step.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-wrap landing-split" style={{ padding: '80px 0' }}>
          <div>
            <div className="landing-chip" style={{ background: 'rgba(255,107,107,0.14)', color: '#FF6B6B' }}>
              Para quién
            </div>
            <h2 className="landing-serif" style={{ fontSize: 'clamp(30px, 4vw, 44px)', margin: '14px 0 14px', fontWeight: 600 }}>
              De la librería de barrio a la cadena con sucursales
            </h2>
            <p style={{ color: '#5c5868', lineHeight: 1.65, marginTop: 0 }}>
              JINStock escala sin obligarte a cambiar de herramienta. Empiezas solo y sumas cajeros, reportes y sucursales cuando el negocio lo pida.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '28px 0 0', display: 'grid', gap: 14 }}>
              {[
                { icon: ShieldCheck, text: 'Configuración guiada en menos de 24 horas' },
                { icon: Users, text: 'Soporte en horario comercial' },
                { icon: MonitorSmartphone, text: 'Cualquier dispositivo con navegador' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.text} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: 'rgba(74,20,140,0.1)',
                        color: '#4A148C',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={18} />
                    </span>
                    <span style={{ fontWeight: 600 }}>{item.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="landing-card" style={{ padding: 28, background: '#fff' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#5F8FFF', letterSpacing: '0.06em' }}>CIERRE DE CAJA</div>
            <div className="landing-serif" style={{ fontSize: 40, margin: '8px 0 20px' }}>C$ 38,450</div>
            <div style={{ height: 10, borderRadius: 99, background: '#f0ecf8', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: '72%', background: '#4A148C' }} />
              <div style={{ width: '18%', background: '#A788F4' }} />
              <div style={{ width: '10%', background: '#FDDB35' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: '#5c5868' }}>
              <span>Efectivo 72%</span>
              <span>Tarjeta 18%</span>
              <span>Transfer. 10%</span>
            </div>
            <div style={{ marginTop: 28, display: 'grid', gap: 12 }}>
              {[
                ['Productos activos', '1,204'],
                ['Tickets hoy', '86'],
                ['Alerta de stock', '12 títulos'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                    borderTop: '1px solid rgba(17,17,17,0.08)',
                  }}
                >
                  <span style={{ color: '#5c5868' }}>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="precios" className="landing-wrap" style={{ padding: '12px 0 72px' }}>
          <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 36px' }}>
            <div className="landing-chip" style={{ background: 'rgba(167,136,244,0.18)', color: '#4A148C' }}>
              Planes
            </div>
            <h2 className="landing-serif" style={{ fontSize: 'clamp(30px, 4vw, 44px)', margin: '14px 0 10px', fontWeight: 600 }}>
              Elige según el tamaño de tu librería
            </h2>
            <p style={{ margin: 0, color: '#5c5868' }}>Sin contratos. Sin letra chica. Cancela cuando quieras.</p>
          </div>

          <div className="landing-pricing">
            {PLANS.map((plan) => (
              <article
                key={plan.plan}
                className={`landing-card landing-plan-card ${plan.highlighted ? 'landing-plan-card-featured' : ''}`}
                style={{
                  padding: 28,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                  border: plan.highlighted ? '2px solid #4A148C' : '1px solid rgba(17,17,17,0.08)',
                  background: plan.highlighted ? '#4A148C' : '#fff',
                  color: plan.highlighted ? '#fff' : '#111',
                  position: 'relative',
                }}
              >
                {plan.badge && (
                  <span
                    className="landing-plan-badge"
                    style={{
                      position: 'absolute',
                      top: -12,
                      left: 24,
                      background: '#FDDB35',
                      color: '#111',
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: 999,
                    }}
                  >
                    {plan.badge}
                  </span>
                )}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7 }}>
                    {plan.plan}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
                    <span className="landing-serif" style={{ fontSize: 40, fontWeight: 600 }}>
                      {plan.price}
                    </span>
                    {plan.period && <span style={{ fontSize: 14, opacity: 0.7 }}>/ {plan.period}</span>}
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.55, opacity: plan.highlighted ? 0.82 : 1, color: plan.highlighted ? '#fff' : '#5c5868' }}>
                    {plan.desc}
                  </p>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10, flex: 1 }}>
                  {plan.features.map((feature) => (
                    <li key={feature} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14 }}>
                      <Check size={16} color={plan.highlighted ? '#FDDB35' : '#4A148C'} style={{ marginTop: 2, flexShrink: 0 }} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  to={`/checkout?plan=${plan.id}`}
                  className="landing-btn landing-plan-btn"
                  style={{
                    background: plan.highlighted ? '#FDDB35' : '#4A148C',
                    color: plan.highlighted ? '#111' : '#fff',
                    padding: '12px 16px',
                    width: '100%',
                  }}
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section id="faq" className="landing-wrap" style={{ padding: '12px 0 72px' }}>
          <div className="landing-faq-grid">
            <div>
              <h2 className="landing-serif" style={{ fontSize: 'clamp(30px, 4vw, 44px)', margin: '0 0 10px', fontWeight: 600 }}>
                Preguntas antes de empezar
              </h2>
              <p style={{ color: '#5c5868', margin: 0 }}>Si algo no está aquí, entra y pruébalo: el plan básico no pide tarjeta.</p>
            </div>
            <div>
              {FAQS.map((faq) => (
                <details
                  key={faq.q}
                  className="landing-faq-item"
                  style={{ borderBottom: '1px solid rgba(17,17,17,0.08)', padding: '16px 0' }}
                >
                  <summary
                    style={{
                      listStyle: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 16,
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {faq.q}
                    <ChevronDown className="chevron" size={18} style={{ transition: 'transform 0.2s' }} />
                  </summary>
                  <p style={{ color: '#5c5868', lineHeight: 1.65, margin: '10px 0 4px' }}>{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-wrap" style={{ padding: '0 0 80px' }}>
          <div
            className="landing-card is-sky landing-cta landing-ledger"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 32,
              padding: '44px 48px',
            }}
          >
            <div style={{ maxWidth: 640 }}>
              <h2 className="landing-serif" style={{ margin: '0 0 10px', fontSize: 'clamp(24px, 3.2vw, 36px)', lineHeight: 1.15 }}>
                ¿Listo para dejar el cuaderno de ventas?
              </h2>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--muted)' }}>
                Empieza gratis hoy. Si te encaja, subes de plan. Si no, cancelas.
              </p>
            </div>
            <div style={{ flexShrink: 0 }}>
              <button
                className="landing-btn landing-btn-sky"
                style={{ border: 'none', cursor: 'pointer' }}
                onClick={() => {
                  document.getElementById('precios')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                Comenzar ahora — es gratis
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: '1px solid rgba(17,17,17,0.08)', padding: '28px 0 40px' }}>
        <div
          className="landing-wrap"
          style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5c5868', fontSize: 13 }}>
            <img src="/JINSTOCK.png" alt="" style={{ height: 22 }} />
            © 2026 JINStock. Todos los derechos reservados.
          </div>
          <nav style={{ display: 'flex', gap: 18, fontSize: 13 }}>
            <a href="#funciones" style={{ color: '#5c5868', textDecoration: 'none' }}>
              Producto
            </a>
            <a href="#precios" style={{ color: '#5c5868', textDecoration: 'none' }}>
              Planes
            </a>
            <a href="#faq" style={{ color: '#5c5868', textDecoration: 'none' }}>
              Preguntas
            </a>
            <Link to="/auth" style={{ color: '#4A148C', textDecoration: 'none', fontWeight: 700 }}>
              Ingresar
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};