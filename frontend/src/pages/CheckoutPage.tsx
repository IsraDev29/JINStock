import React, { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ShieldCheck,
  CreditCard,
  Lock,
  Building,
  Phone,
  Mail,
  User,
  Sparkles,
  CheckCircle2,
  Copy,
  QrCode,
  Printer,
  ChevronRight,
  Landmark,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './LandingPage.css';

interface PlanDefinition {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  badge?: string;
  features: string[];
}

const CHECKOUT_PLANS: Record<string, PlanDefinition> = {
  basico: {
    id: 'basico',
    name: 'Básico',
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Para librerías y papelerías que inician su digitalización sin inversión inicial.',
    features: [
      'Hasta 200 productos en catálogo',
      '1 usuario administrador',
      'Punto de venta (POS) esencial',
      'Reportes mensuales de ventas',
      'Modo sin conexión a internet',
      'Actualizaciones automáticas',
    ],
  },
  profesional: {
    id: 'profesional',
    name: 'Profesional',
    monthlyPrice: 499,
    annualPrice: 4790, // Ahorro ~20% (C$ 1,198 de ahorro)
    description: 'El plan más elegido por librerías en crecimiento para control total de stock y equipo.',
    badge: 'Recomendado',
    features: [
      'Catálogo de productos ilimitados',
      'Hasta 5 usuarios con permisos y roles',
      'Gestión avanzada de compras y proveedores',
      'Reportes de rotación y analítica avanzada',
      'Modo sin conexión offline real',
      'Soporte prioritario por WhatsApp y ticket',
      'Cierre de caja inteligente por turnos',
    ],
  },
  empresarial: {
    id: 'empresarial',
    name: 'Empresarial',
    monthlyPrice: 999,
    annualPrice: 9590, // Ahorro ~20% (C$ 2,398 de ahorro)
    description: 'Para cadenas con múltiples sucursales, almacenes y alto volumen de transacciones.',
    badge: 'Cadenas',
    features: [
      'Todo lo del plan Profesional',
      'Usuarios y cajeros ilimitados',
      'Múltiples sucursales y bodegas',
      'API de integración contable y facturación',
      'Análisis predictivo de inventario',
      'Soporte técnico 24/7 con gerente dedicado',
      'Capacitación inicial para todo tu personal',
    ],
  },
};

const BANK_ACCOUNTS = [
  {
    id: 'bac',
    bank: 'BAC Credomatic',
    color: '#D32F2F',
    accountCordobas: '365-829104-1',
    accountDollars: '365-829105-8',
    holder: 'JINStock Soluciones S.A.',
    ruc: 'J0310000123456',
  },
  {
    id: 'banpro',
    bank: 'Banpro Grupo Promerica',
    color: '#00693E',
    accountCordobas: '1002-384910-2',
    accountDollars: '1002-384911-0',
    holder: 'JINStock Soluciones S.A.',
    ruc: 'J0310000123456',
  },
  {
    id: 'lafise',
    bank: 'Banco LAFISE Bancentro',
    color: '#004B87',
    accountCordobas: '109-284910-3',
    accountDollars: '109-284911-1',
    holder: 'JINStock Soluciones S.A.',
    ruc: 'J0310000123456',
  },
];

export const CheckoutPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // Plan selection from query param
  const planQuery = (searchParams.get('plan') || 'profesional').toLowerCase();
  const initialPlan = CHECKOUT_PLANS[planQuery] ? planQuery : 'profesional';

  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlan);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer' | 'qr'>('card');

  // Customer details form
  const [formData, setFormData] = useState({
    nombre: user?.nombre || '',
    email: user?.email || '',
    libreria: '',
    telefono: '',
    ciudad: 'Managua',
    cedulaRuc: '',
  });

  // Credit Card details
  const [cardData, setCardData] = useState({
    number: '',
    holder: user?.nombre ? user.nombre.toUpperCase() : '',
    expiry: '',
    cvc: '',
  });

  // Bank Transfer details
  const [selectedBankId, setSelectedBankId] = useState('bac');
  const [transferReference, setTransferReference] = useState('');
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  // Discount code
  const [couponInput, setCouponInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [couponMessage, setCouponMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Process / Submission state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const currentPlan = CHECKOUT_PLANS[selectedPlanId] || CHECKOUT_PLANS.profesional;
  const isFreePlan = currentPlan.id === 'basico';

  // Calculate pricing
  const basePrice = billingCycle === 'annual' ? currentPlan.annualPrice : currentPlan.monthlyPrice;
  const discountAmount = Math.round(basePrice * appliedDiscount);
  const finalPrice = Math.max(0, basePrice - discountAmount);
  const usdEstimate = (finalPrice / 36.62).toFixed(2);

  // Format Card Number (with spaces 4-4-4-4)
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardData((prev) => ({ ...prev, number: formatted }));
  };

  // Format Expiry (MM/AA)
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      raw = `${raw.slice(0, 2)}/${raw.slice(2, 4)}`;
    }
    setCardData((prev) => ({ ...prev, expiry: raw }));
  };

  // Detect card network
  const cardBrand = useMemo(() => {
    const cleanNum = cardData.number.replace(/\s/g, '');
    if (cleanNum.startsWith('4')) return 'VISA';
    if (cleanNum.startsWith('51') || cleanNum.startsWith('52') || cleanNum.startsWith('53') || cleanNum.startsWith('54') || cleanNum.startsWith('55')) return 'MASTERCARD';
    if (cleanNum.startsWith('34') || cleanNum.startsWith('37')) return 'AMEX';
    return 'TARJETA';
  }, [cardData.number]);

  // Copy account to clipboard
  const handleCopyAccount = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(text);
    setTimeout(() => setCopiedAccount(null), 2200);
  };

  // Coupon validator
  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    if (code === 'JIN2026' || code === 'LIBRERIA' || code === 'SIGEL10') {
      const discountRate = code === 'JIN2026' ? 0.2 : 0.1;
      setAppliedDiscount(discountRate);
      setCouponMessage({
        text: `¡Cupón ${code} aplicado exitosamente! (${discountRate * 100}% de descuento adicional)`,
        type: 'success',
      });
    } else {
      setCouponMessage({
        text: 'El código de cupón no es válido o ha expirado.',
        type: 'error',
      });
    }
  };

  // Validate form
  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.nombre.trim()) errors.nombre = 'El nombre es obligatorio';
    if (!formData.email.trim() || !formData.email.includes('@')) errors.email = 'Ingresa un correo electrónico válido';
    if (!formData.libreria.trim()) errors.libreria = 'Indica el nombre de tu librería o negocio';
    if (!formData.telefono.trim()) errors.telefono = 'Ingresa un teléfono o WhatsApp de contacto';

    if (!isFreePlan) {
      if (paymentMethod === 'card') {
        const cleanCard = cardData.number.replace(/\s/g, '');
        if (cleanCard.length < 15) errors.cardNumber = 'Ingresa un número de tarjeta válido (16 dígitos)';
        if (!cardData.holder.trim()) errors.cardHolder = 'Nombre en la tarjeta es requerido';
        if (cardData.expiry.length < 5) errors.cardExpiry = 'Fecha de expiración inválida (MM/AA)';
        if (cardData.cvc.length < 3) errors.cardCvc = 'Código CVC inválido (3-4 dígitos)';
      } else if (paymentMethod === 'transfer') {
        if (!transferReference.trim()) {
          errors.transferReference = 'Ingresa el número de referencia de la transferencia o depósito';
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit payment / checkout
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      window.scrollTo({ top: 300, behavior: 'smooth' });
      return;
    }

    setIsProcessing(true);
    setProcessingStep('Validando datos de la librería...');
    await new Promise((r) => setTimeout(r, 600));

    if (!isFreePlan) {
      if (paymentMethod === 'card') {
        setProcessingStep('Conectando con la pasarela bancaria segura...');
        await new Promise((r) => setTimeout(r, 800));
        setProcessingStep('Autorizando transacción con el emisor...');
        await new Promise((r) => setTimeout(r, 800));
      } else if (paymentMethod === 'transfer') {
        setProcessingStep('Registrando comprobante de transferencia bancaria...');
        await new Promise((r) => setTimeout(r, 900));
      } else {
        setProcessingStep('Confirmando recepción de pago móvil...');
        await new Promise((r) => setTimeout(r, 900));
      }
    } else {
      setProcessingStep('Activando espacio de trabajo gratuito para tu librería...');
      await new Promise((r) => setTimeout(r, 800));
    }

    setProcessingStep('Generando credenciales y factura de suscripción...');
    await new Promise((r) => setTimeout(r, 700));

    const receipt = {
      orderId: `ORD-${Date.now().toString().slice(-7)}`,
      invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      date: new Date().toLocaleDateString('es-NI', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      plan: currentPlan.name,
      cycle: billingCycle === 'annual' ? 'Facturación Anual' : 'Facturación Mensual',
      amount: finalPrice,
      paymentMethodName: isFreePlan
        ? 'Plan Gratuito'
        : paymentMethod === 'card'
        ? `Tarjeta ${cardBrand} finalizada en ${cardData.number.slice(-4) || '••••'}`
        : paymentMethod === 'transfer'
        ? `Transferencia ${BANK_ACCOUNTS.find((b) => b.id === selectedBankId)?.bank}`
        : 'Billetera Móvil / QR',
      customer: formData,
    };

    setReceiptData(receipt);
    setIsProcessing(false);
    setIsSuccess(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="landing-root" style={{ minHeight: '100vh', paddingBottom: 80 }}>
      {/* Header Bar */}
      <header
        style={{
          borderBottom: '1px solid rgba(167, 136, 244, 0.16)',
          background: 'rgba(17, 17, 17, 0.85)',
          backdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 60,
        }}
      >
        <div
          className="landing-wrap"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 70,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: '#b0a9bf',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#b0a9bf')}
            >
              <ArrowLeft size={16} /> Volver a la portada
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/JINSTOCK.png" alt="JINStock" style={{ height: 32, width: 'auto' }} />
              <span style={{ fontWeight: 800, fontSize: 18, color: '#f8f7fc', letterSpacing: '-0.03em' }}>
                JINStock <span style={{ fontSize: 13, fontWeight: 500, color: '#a788f4' }}>· Cobro Seguro</span>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: '#FDDB35',
                background: 'rgba(253, 219, 53, 0.1)',
                padding: '6px 12px',
                borderRadius: 999,
                border: '1px solid rgba(253, 219, 53, 0.25)',
              }}
            >
              <Lock size={13} />
              <span style={{ fontWeight: 700 }}>Encriptación SSL 256-Bit</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="landing-wrap" style={{ marginTop: 36 }}>
        {/* If payment was successful, show Receipt View */}
        {isSuccess && receiptData ? (
          <div
            className="landing-card"
            style={{
              maxWidth: 760,
              margin: '0 auto',
              padding: '40px 32px',
              background: '#19171e',
              border: '1px solid rgba(167, 136, 244, 0.3)',
              boxShadow: '0 30px 80px rgba(74, 20, 140, 0.4)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'rgba(253, 219, 53, 0.16)',
                  border: '2px solid #FDDB35',
                  color: '#FDDB35',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  boxShadow: '0 0 35px rgba(253, 219, 53, 0.35)',
                }}
              >
                <CheckCircle2 size={40} />
              </div>
              <h1 className="landing-serif" style={{ fontSize: 32, margin: '0 0 8px', color: '#fff' }}>
                {isFreePlan ? '¡Plan Básico Activado con Éxito!' : '¡Cobro Confirmado y Suscripción Lista!'}
              </h1>
              <p style={{ color: '#b0a9bf', margin: 0, fontSize: 15 }}>
                Hemos configurado tu espacio de trabajo para <strong>{receiptData.customer.libreria}</strong>. Te enviamos los detalles a{' '}
                <strong style={{ color: '#a788f4' }}>{receiptData.customer.email}</strong>.
              </p>
            </div>

            {/* Receipt Box */}
            <div
              style={{
                background: '#100f14',
                borderRadius: 16,
                border: '1px solid rgba(167, 136, 244, 0.16)',
                padding: 24,
                marginBottom: 28,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px dashed rgba(255, 255, 255, 0.15)',
                  paddingBottom: 16,
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: '#a788f4', fontWeight: 800, letterSpacing: '0.06em' }}>
                    RECIBO DE COBRO
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                    {receiptData.invoiceNumber}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#b0a9bf' }}>Fecha y hora</div>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{receiptData.date}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, fontSize: 13 }}>
                <div>
                  <div style={{ color: '#b0a9bf', fontSize: 12 }}>Titular / Cliente</div>
                  <div style={{ fontWeight: 700, color: '#fff', marginTop: 2 }}>{receiptData.customer.nombre}</div>
                  <div style={{ color: '#a788f4' }}>{receiptData.customer.libreria}</div>
                </div>

                <div>
                  <div style={{ color: '#b0a9bf', fontSize: 12 }}>Plan Contratado</div>
                  <div style={{ fontWeight: 700, color: '#FDDB35', marginTop: 2 }}>Plan {receiptData.plan}</div>
                  <div style={{ color: '#b0a9bf' }}>{receiptData.cycle}</div>
                </div>

                <div>
                  <div style={{ color: '#b0a9bf', fontSize: 12 }}>Forma de Cobro</div>
                  <div style={{ fontWeight: 600, color: '#fff', marginTop: 2 }}>{receiptData.paymentMethodName}</div>
                  <div style={{ color: '#5f8fff', fontSize: 12 }}>Transacción: {receiptData.orderId}</div>
                </div>

                <div>
                  <div style={{ color: '#b0a9bf', fontSize: 12 }}>Total Pagado</div>
                  <div className="landing-serif" style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                    {isFreePlan ? 'Gratis (C$ 0.00)' : `C$ ${receiptData.amount.toLocaleString()}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Link
                to="/auth"
                className="landing-btn landing-btn-primary"
                style={{
                  flex: 1,
                  padding: '16px 24px',
                  fontSize: 16,
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #6a2bc4, #4A148C)',
                }}
              >
                Comenzar a usar JINStock ahora <ChevronRight size={18} />
              </Link>

              <button
                type="button"
                onClick={handlePrint}
                className="landing-btn landing-btn-ghost"
                style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Printer size={18} /> Imprimir Comprobante
              </button>
            </div>
          </div>
        ) : (
          /* Checkout Main Flow */
          <div>
            {/* Header Title */}
            <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 36px' }}>
              <div className="landing-chip" style={{ background: 'rgba(167,136,244,0.18)', color: '#a788f4' }}>
                <Sparkles size={14} /> Facturación y Suscripción
              </div>
              <h1 className="landing-serif" style={{ fontSize: 'clamp(28px, 4vw, 42px)', margin: '14px 0 10px', fontWeight: 700 }}>
                Completa tu suscripción a JINStock
              </h1>
              <p style={{ color: '#b0a9bf', fontSize: 16, margin: 0 }}>
                Elige tu método de cobro favorito. Sin contratos forzosos, cancela cuando quieras con 1 solo clic.
              </p>
            </div>

            {/* Grid: Left Form & Right Summary */}
            <div className="checkout-main-grid">
              {/* LEFT COLUMN: Steps & Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* STEP 1: Select Plan */}
                <div
                  className="landing-card"
                  style={{
                    padding: 24,
                    background: '#19171e',
                    border: '1px solid rgba(167, 136, 244, 0.2)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#4A148C',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        1
                      </span>
                      <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Plan Seleccionado</h2>
                    </div>

                    {/* Billing cycle switch */}
                    <div
                      style={{
                        display: 'flex',
                        background: '#100f14',
                        padding: 3,
                        borderRadius: 10,
                        border: '1px solid rgba(167, 136, 244, 0.15)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setBillingCycle('monthly')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 8,
                          border: 'none',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: billingCycle === 'monthly' ? '#4A148C' : 'transparent',
                          color: billingCycle === 'monthly' ? '#fff' : '#b0a9bf',
                          transition: 'all 0.2s',
                        }}
                      >
                        Mensual
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingCycle('annual')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 8,
                          border: 'none',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: billingCycle === 'annual' ? '#FDDB35' : 'transparent',
                          color: billingCycle === 'annual' ? '#111' : '#b0a9bf',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        Anual <span style={{ fontSize: 10, background: '#111', color: '#FDDB35', padding: '2px 6px', borderRadius: 6, fontWeight: 800 }}>-20%</span>
                      </button>
                    </div>
                  </div>

                  {/* 3 Plans selectable cards */}
                  <div className="checkout-plan-grid">
                    {Object.values(CHECKOUT_PLANS).map((p) => {
                      const isSelected = selectedPlanId === p.id;
                      const price = billingCycle === 'annual' ? p.annualPrice : p.monthlyPrice;
                      const period = p.id === 'basico' ? '' : billingCycle === 'annual' ? '/ año' : '/ mes';

                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedPlanId(p.id)}
                          style={{
                            border: isSelected ? '2px solid #FDDB35' : '1px solid rgba(167, 136, 244, 0.16)',
                            background: isSelected
                              ? 'linear-gradient(180deg, rgba(74, 20, 140, 0.4) 0%, rgba(25, 23, 30, 0.95) 100%)'
                              : 'rgba(255, 255, 255, 0.02)',
                            borderRadius: 14,
                            padding: '16px 14px',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                            transform: isSelected ? 'translateY(-2px)' : 'none',
                            boxShadow: isSelected ? '0 12px 30px rgba(74, 20, 140, 0.4)' : 'none',
                          }}
                        >
                          {p.badge && (
                            <span
                              style={{
                                position: 'absolute',
                                top: -9,
                                right: 12,
                                background: '#FDDB35',
                                color: '#111',
                                fontSize: 10,
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 99,
                              }}
                            >
                              {p.badge}
                            </span>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: isSelected ? '#fff' : '#b0a9bf' }}>
                              {p.name}
                            </span>
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                border: isSelected ? '5px solid #FDDB35' : '2px solid #5c5868',
                                background: '#fff',
                              }}
                            />
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <div className="landing-serif" style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>
                              {p.id === 'basico' ? 'Gratis' : `C$ ${price.toLocaleString()}`}
                            </div>
                            {period && <div style={{ fontSize: 11, color: '#a788f4', fontWeight: 600 }}>{period}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* STEP 2: Customer / Bookstore Details */}
                <div
                  className="landing-card"
                  style={{
                    padding: 24,
                    background: '#19171e',
                    border: '1px solid rgba(167, 136, 244, 0.2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: '#4A148C',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      2
                    </span>
                    <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Datos de la Librería</h2>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cfc9db', marginBottom: 6 }}>
                        Nombre del Propietario / Administrador *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <User size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#a788f4' }} />
                        <input
                          type="text"
                          value={formData.nombre}
                          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                          placeholder="Ej. Juan Pérez Robleto"
                          style={{
                            width: '100%',
                            padding: '10px 12px 10px 38px',
                            borderRadius: 10,
                            background: '#100f14',
                            border: formErrors.nombre ? '1px solid #FF6B6B' : '1px solid rgba(167, 136, 244, 0.2)',
                            color: '#fff',
                            fontSize: 14,
                            outline: 'none',
                          }}
                        />
                      </div>
                      {formErrors.nombre && <span style={{ color: '#FF6B6B', fontSize: 11 }}>{formErrors.nombre}</span>}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cfc9db', marginBottom: 6 }}>
                        Nombre de la Librería o Negocio *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Building size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#a788f4' }} />
                        <input
                          type="text"
                          value={formData.libreria}
                          onChange={(e) => setFormData({ ...formData, libreria: e.target.value })}
                          placeholder="Ej. Librería El Pensador"
                          style={{
                            width: '100%',
                            padding: '10px 12px 10px 38px',
                            borderRadius: 10,
                            background: '#100f14',
                            border: formErrors.libreria ? '1px solid #FF6B6B' : '1px solid rgba(167, 136, 244, 0.2)',
                            color: '#fff',
                            fontSize: 14,
                            outline: 'none',
                          }}
                        />
                      </div>
                      {formErrors.libreria && <span style={{ color: '#FF6B6B', fontSize: 11 }}>{formErrors.libreria}</span>}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cfc9db', marginBottom: 6 }}>
                        Correo Electrónico (Acceso y Factura) *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#a788f4' }} />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="contacto@libreria.com"
                          style={{
                            width: '100%',
                            padding: '10px 12px 10px 38px',
                            borderRadius: 10,
                            background: '#100f14',
                            border: formErrors.email ? '1px solid #FF6B6B' : '1px solid rgba(167, 136, 244, 0.2)',
                            color: '#fff',
                            fontSize: 14,
                            outline: 'none',
                          }}
                        />
                      </div>
                      {formErrors.email && <span style={{ color: '#FF6B6B', fontSize: 11 }}>{formErrors.email}</span>}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cfc9db', marginBottom: 6 }}>
                        Teléfono / WhatsApp *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Phone size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#a788f4' }} />
                        <input
                          type="tel"
                          value={formData.telefono}
                          onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                          placeholder="+505 8888-9999"
                          style={{
                            width: '100%',
                            padding: '10px 12px 10px 38px',
                            borderRadius: 10,
                            background: '#100f14',
                            border: formErrors.telefono ? '1px solid #FF6B6B' : '1px solid rgba(167, 136, 244, 0.2)',
                            color: '#fff',
                            fontSize: 14,
                            outline: 'none',
                          }}
                        />
                      </div>
                      {formErrors.telefono && <span style={{ color: '#FF6B6B', fontSize: 11 }}>{formErrors.telefono}</span>}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cfc9db', marginBottom: 6 }}>
                        Ciudad / Departamento
                      </label>
                      <select
                        value={formData.ciudad}
                        onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: '#100f14',
                          border: '1px solid rgba(167, 136, 244, 0.2)',
                          color: '#fff',
                          fontSize: 14,
                          outline: 'none',
                        }}
                      >
                        <option value="Managua">Managua</option>
                        <option value="León">León</option>
                        <option value="Granada">Granada</option>
                        <option value="Estelí">Estelí</option>
                        <option value="Matagalpa">Matagalpa</option>
                        <option value="Masaya">Masaya</option>
                        <option value="Chinandega">Chinandega</option>
                        <option value="Chontales">Chontales</option>
                        <option value="Rivas">Rivas</option>
                        <option value="Otro">Otro Departamento / Región</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cfc9db', marginBottom: 6 }}>
                        RUC o Cédula (Opcional para Factura Fiscal)
                      </label>
                      <input
                        type="text"
                        value={formData.cedulaRuc}
                        onChange={(e) => setFormData({ ...formData, cedulaRuc: e.target.value })}
                        placeholder="Ej. J0310000000000"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: '#100f14',
                          border: '1px solid rgba(167, 136, 244, 0.2)',
                          color: '#fff',
                          fontSize: 14,
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* STEP 3: Payment Method (Interfaz para el Cobro) */}
                <div
                  className="landing-card"
                  style={{
                    padding: 24,
                    background: '#19171e',
                    border: '1px solid rgba(167, 136, 244, 0.2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: '#4A148C',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      3
                    </span>
                    <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>
                      {isFreePlan ? 'Confirmación de Activación' : 'Método de Cobro'}
                    </h2>
                  </div>

                  {isFreePlan ? (
                    /* Free plan banner */
                    <div
                      style={{
                        background: 'rgba(95, 143, 255, 0.08)',
                        border: '1px solid rgba(95, 143, 255, 0.3)',
                        borderRadius: 14,
                        padding: 20,
                        display: 'flex',
                        gap: 16,
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          background: 'rgba(95, 143, 255, 0.18)',
                          color: '#5F8FFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Sparkles size={24} />
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                          ¡Plan Básico 100% Gratuito!
                        </div>
                        <div style={{ fontSize: 13, color: '#cfc9db', marginTop: 4 }}>
                          No requieres tarjeta de crédito ni pago alguno. Al pulsar el botón inferior tu cuenta se creará y habilitará al instante.
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Paid plans: Selection tabs */
                    <div>
                      {/* Tabs */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: 10,
                          marginBottom: 20,
                        }}
                      >
                        {[
                          { id: 'card', label: 'Tarjeta de Crédito / Débito', icon: CreditCard },
                          { id: 'transfer', label: 'Transferencia Bancaria (NI)', icon: Landmark },
                          { id: 'qr', label: 'Billetera Móvil / QR', icon: QrCode },
                        ].map((tab) => {
                          const Icon = tab.icon;
                          const active = paymentMethod === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setPaymentMethod(tab.id as any)}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 6,
                                padding: '12px 8px',
                                borderRadius: 12,
                                border: active ? '2px solid #a788f4' : '1px solid rgba(167, 136, 244, 0.16)',
                                background: active ? 'rgba(74, 20, 140, 0.35)' : '#100f14',
                                color: active ? '#fff' : '#b0a9bf',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                            >
                              <Icon size={20} color={active ? '#FDDB35' : '#a788f4'} />
                              <span style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
                                {tab.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* TAB 1: Tarjeta de Crédito / Débito con Tarjeta Virtual Interactiva */}
                      {paymentMethod === 'card' && (
                        <div>
                          {/* Virtual Credit Card View */}
                          <div
                            style={{
                              maxWidth: 380,
                              margin: '0 auto 24px',
                              padding: 22,
                              borderRadius: 18,
                              background: 'linear-gradient(135deg, #4A148C 0%, #2f0d5c 50%, #15062c 100%)',
                              border: '1px solid rgba(167, 136, 244, 0.4)',
                              boxShadow: '0 18px 45px rgba(74, 20, 140, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                              color: '#fff',
                              position: 'relative',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                right: -30,
                                top: -30,
                                width: 140,
                                height: 140,
                                borderRadius: '50%',
                                background: 'radial-gradient(circle, rgba(253, 219, 53, 0.25) 0%, transparent 70%)',
                              }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 34, height: 26, background: '#e0b83a', borderRadius: 6, opacity: 0.9 }} />
                                <span style={{ fontSize: 10, letterSpacing: '0.08em', color: '#FDDB35', fontWeight: 800 }}>
                                  PAGO SEGURO
                                </span>
                              </div>
                              <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: '0.06em', color: '#FDDB35' }}>
                                {cardBrand}
                              </span>
                            </div>

                            <div
                              style={{
                                fontFamily: 'monospace',
                                fontSize: 18,
                                letterSpacing: '0.14em',
                                color: '#fff',
                                marginBottom: 20,
                                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                              }}
                            >
                              {cardData.number || '•••• •••• •••• ••••'}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 11 }}>
                              <div>
                                <div style={{ fontSize: 9, opacity: 0.7, textTransform: 'uppercase' }}>Titular</div>
                                <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase' }}>
                                  {cardData.holder || 'NOMBRE DEL TITULAR'}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 9, opacity: 0.7, textTransform: 'uppercase' }}>Vence</div>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{cardData.expiry || 'MM/AA'}</div>
                              </div>
                            </div>
                          </div>

                          {/* Card Inputs */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                            <div style={{ gridColumn: 'span 2' }}>
                              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cfc9db', marginBottom: 6 }}>
                                Número de Tarjeta *
                              </label>
                              <div style={{ position: 'relative' }}>
                                <CreditCard size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#a788f4' }} />
                                <input
                                  type="text"
                                  value={cardData.number}
                                  onChange={handleCardNumberChange}
                                  placeholder="1234 5678 9012 3456"
                                  maxLength={19}
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px 10px 38px',
                                    borderRadius: 10,
                                    background: '#100f14',
                                    border: formErrors.cardNumber ? '1px solid #FF6B6B' : '1px solid rgba(167, 136, 244, 0.2)',
                                    color: '#fff',
                                    fontSize: 14,
                                    outline: 'none',
                                    fontFamily: 'monospace',
                                  }}
                                />
                              </div>
                              {formErrors.cardNumber && <span style={{ color: '#FF6B6B', fontSize: 11 }}>{formErrors.cardNumber}</span>}
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cfc9db', marginBottom: 6 }}>
                                Nombre en la Tarjeta *
                              </label>
                              <input
                                type="text"
                                value={cardData.holder}
                                onChange={(e) => setCardData({ ...cardData, holder: e.target.value.toUpperCase() })}
                                placeholder="COMO APARECE EN LA TARJETA"
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  borderRadius: 10,
                                  background: '#100f14',
                                  border: formErrors.cardHolder ? '1px solid #FF6B6B' : '1px solid rgba(167, 136, 244, 0.2)',
                                  color: '#fff',
                                  fontSize: 14,
                                  outline: 'none',
                                }}
                              />
                              {formErrors.cardHolder && <span style={{ color: '#FF6B6B', fontSize: 11 }}>{formErrors.cardHolder}</span>}
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cfc9db', marginBottom: 6 }}>
                                  Vence (MM/AA) *
                                </label>
                                <input
                                  type="text"
                                  value={cardData.expiry}
                                  onChange={handleExpiryChange}
                                  placeholder="12/28"
                                  maxLength={5}
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    background: '#100f14',
                                    border: formErrors.cardExpiry ? '1px solid #FF6B6B' : '1px solid rgba(167, 136, 244, 0.2)',
                                    color: '#fff',
                                    fontSize: 14,
                                    outline: 'none',
                                    textAlign: 'center',
                                  }}
                                />
                                {formErrors.cardExpiry && <span style={{ color: '#FF6B6B', fontSize: 11 }}>{formErrors.cardExpiry}</span>}
                              </div>

                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cfc9db', marginBottom: 6 }}>
                                  CVC / CVV *
                                </label>
                                <input
                                  type="password"
                                  value={cardData.cvc}
                                  onChange={(e) => setCardData({ ...cardData, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                                  placeholder="•••"
                                  maxLength={4}
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    background: '#100f14',
                                    border: formErrors.cardCvc ? '1px solid #FF6B6B' : '1px solid rgba(167, 136, 244, 0.2)',
                                    color: '#fff',
                                    fontSize: 14,
                                    outline: 'none',
                                    textAlign: 'center',
                                    letterSpacing: '0.2em',
                                  }}
                                />
                                {formErrors.cardCvc && <span style={{ color: '#FF6B6B', fontSize: 11 }}>{formErrors.cardCvc}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 2: Transferencia Bancaria Local (Nicaragua) */}
                      {paymentMethod === 'transfer' && (
                        <div>
                          <div style={{ fontSize: 13, color: '#cfc9db', marginBottom: 14 }}>
                            Transfiere desde tu banca en línea a cualquiera de nuestras cuentas oficiales en Nicaragua:
                          </div>

                          {/* Bank selector */}
                          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                            {BANK_ACCOUNTS.map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => setSelectedBankId(b.id)}
                                style={{
                                  padding: '8px 14px',
                                  borderRadius: 10,
                                  border: selectedBankId === b.id ? '2px solid #FDDB35' : '1px solid rgba(167, 136, 244, 0.2)',
                                  background: selectedBankId === b.id ? 'rgba(74, 20, 140, 0.4)' : '#100f14',
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: 13,
                                  cursor: 'pointer',
                                }}
                              >
                                {b.bank}
                              </button>
                            ))}
                          </div>

                          {/* Bank Account Info Card */}
                          {(() => {
                            const b = BANK_ACCOUNTS.find((x) => x.id === selectedBankId) || BANK_ACCOUNTS[0];
                            return (
                              <div
                                style={{
                                  background: '#100f14',
                                  borderRadius: 14,
                                  padding: 18,
                                  border: '1px solid rgba(167, 136, 244, 0.16)',
                                  marginBottom: 20,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                  <strong style={{ color: '#FDDB35', fontSize: 15 }}>{b.bank}</strong>
                                  <span style={{ fontSize: 11, color: '#b0a9bf' }}>RUC: {b.ruc}</span>
                                </div>

                                <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      background: 'rgba(255, 255, 255, 0.03)',
                                      padding: '8px 12px',
                                      borderRadius: 8,
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontSize: 11, color: '#b0a9bf' }}>Cuenta en Córdobas (C$)</div>
                                      <div style={{ fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                                        {b.accountCordobas}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyAccount(b.accountCordobas)}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: copiedAccount === b.accountCordobas ? '#5F8FFF' : '#a788f4',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        fontSize: 12,
                                        fontWeight: 700,
                                      }}
                                    >
                                      {copiedAccount === b.accountCordobas ? <Check size={14} /> : <Copy size={14} />}
                                      {copiedAccount === b.accountCordobas ? 'Copiado' : 'Copiar'}
                                    </button>
                                  </div>

                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      background: 'rgba(255, 255, 255, 0.03)',
                                      padding: '8px 12px',
                                      borderRadius: 8,
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontSize: 11, color: '#b0a9bf' }}>Cuenta en Dólares (US$)</div>
                                      <div style={{ fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                                        {b.accountDollars}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyAccount(b.accountDollars)}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: copiedAccount === b.accountDollars ? '#5F8FFF' : '#a788f4',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        fontSize: 12,
                                        fontWeight: 700,
                                      }}
                                    >
                                      {copiedAccount === b.accountDollars ? <Check size={14} /> : <Copy size={14} />}
                                      {copiedAccount === b.accountDollars ? 'Copiado' : 'Copiar'}
                                    </button>
                                  </div>

                                  <div style={{ fontSize: 12, color: '#b0a9bf', marginTop: 4 }}>
                                    Beneficiario: <strong style={{ color: '#fff' }}>{b.holder}</strong>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Reference Number Field */}
                          <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cfc9db', marginBottom: 6 }}>
                              Número de Referencia o Minuta Bancaria *
                            </label>
                            <input
                              type="text"
                              value={transferReference}
                              onChange={(e) => setTransferReference(e.target.value)}
                              placeholder="Ej. REF-83920194"
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: 10,
                                background: '#100f14',
                                border: formErrors.transferReference ? '1px solid #FF6B6B' : '1px solid rgba(167, 136, 244, 0.2)',
                                color: '#fff',
                                fontSize: 14,
                                outline: 'none',
                              }}
                            />
                            {formErrors.transferReference && (
                              <span style={{ color: '#FF6B6B', fontSize: 11 }}>{formErrors.transferReference}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* TAB 3: Billetera Móvil / QR */}
                      {paymentMethod === 'qr' && (
                        <div style={{ textAlign: 'center', padding: '14px 0' }}>
                          <div
                            style={{
                              background: '#fff',
                              padding: 16,
                              borderRadius: 16,
                              display: 'inline-block',
                              boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
                              marginBottom: 16,
                            }}
                          >
                            {/* Stylized QR representation */}
                            <div
                              style={{
                                width: 170,
                                height: 170,
                                background: 'url("https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=JINSTOCK-COBRO-SUSCRIPCION") center/contain no-repeat, #fff',
                                borderRadius: 8,
                              }}
                            />
                          </div>

                          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                            Escanea con tu app bancaria o billetera móvil
                          </div>
                          <p style={{ color: '#b0a9bf', fontSize: 13, maxWidth: 360, margin: '6px auto 16px' }}>
                            Compatible con <strong>BAC Móvil</strong>, <strong>Banpro Billetera</strong>, <strong>LAFISE Móvil</strong> y <strong>Kash</strong>.
                          </p>

                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              background: 'rgba(255, 255, 255, 0.05)',
                              padding: '8px 16px',
                              borderRadius: 999,
                              fontSize: 13,
                              color: '#FDDB35',
                              border: '1px solid rgba(253, 219, 53, 0.2)',
                            }}
                          >
                            <span>Número oficial de cobro: <strong>+505 8888-0000</strong></span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Order Summary & Action */}
              <div style={{ position: 'sticky', top: 90 }}>
                <div
                  className="landing-card"
                  style={{
                    padding: 28,
                    background: '#19171e',
                    border: '1px solid rgba(167, 136, 244, 0.25)',
                    boxShadow: '0 24px 60px rgba(74, 20, 140, 0.35)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ fontSize: 18, margin: 0, fontWeight: 700, color: '#fff' }}>Resumen del Cobro</h3>
                    <span
                      style={{
                        fontSize: 11,
                        background: 'rgba(167, 136, 244, 0.14)',
                        color: '#a788f4',
                        padding: '4px 10px',
                        borderRadius: 99,
                        fontWeight: 700,
                      }}
                    >
                      {billingCycle === 'annual' ? 'Ciclo Anual' : 'Ciclo Mensual'}
                    </span>
                  </div>

                  {/* Selected Plan Details Box */}
                  <div
                    style={{
                      background: 'rgba(74, 20, 140, 0.25)',
                      border: '1px solid rgba(167, 136, 244, 0.2)',
                      borderRadius: 14,
                      padding: 16,
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#FDDB35', fontWeight: 800, textTransform: 'uppercase' }}>
                          Plan
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{currentPlan.name}</div>
                      </div>
                      <div className="landing-serif" style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>
                        {isFreePlan ? 'C$ 0' : `C$ ${basePrice.toLocaleString()}`}
                      </div>
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: '#cfc9db', lineHeight: 1.5 }}>
                      {currentPlan.description}
                    </p>
                  </div>

                  {/* Features list */}
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#b0a9bf', marginBottom: 10, textTransform: 'uppercase' }}>
                      Incluido en este plan:
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                      {currentPlan.features.slice(0, 5).map((f) => (
                        <li key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#cfc9db', alignItems: 'center' }}>
                          <Check size={14} color="#FDDB35" style={{ flexShrink: 0 }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Coupon input */}
                  {!isFreePlan && (
                    <form onSubmit={handleApplyCoupon} style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          placeholder="Cupón (ej. JIN2026)"
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: 10,
                            background: '#100f14',
                            border: '1px solid rgba(167, 136, 244, 0.2)',
                            color: '#fff',
                            fontSize: 13,
                            outline: 'none',
                          }}
                        />
                        <button
                          type="submit"
                          style={{
                            background: 'rgba(167, 136, 244, 0.16)',
                            border: '1px solid rgba(167, 136, 244, 0.3)',
                            color: '#fff',
                            padding: '8px 14px',
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Aplicar
                        </button>
                      </div>
                      {couponMessage && (
                        <div
                          style={{
                            fontSize: 11,
                            marginTop: 6,
                            color: couponMessage.type === 'success' ? '#FDDB35' : '#FF6B6B',
                            fontWeight: 600,
                          }}
                        >
                          {couponMessage.text}
                        </div>
                      )}
                    </form>
                  )}

                  {/* Price breakdown */}
                  <div style={{ borderTop: '1px solid rgba(167, 136, 244, 0.16)', paddingTop: 16, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#cfc9db' }}>
                      <span>Subtotal</span>
                      <span>{isFreePlan ? 'C$ 0.00' : `C$ ${basePrice.toLocaleString()}`}</span>
                    </div>

                    {appliedDiscount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#FDDB35' }}>
                        <span>Descuento aplicado ({appliedDiscount * 100}%)</span>
                        <span>- C$ {discountAmount.toLocaleString()}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#cfc9db' }}>
                      <span>IVA (Exento Ley del Libro)</span>
                      <span>C$ 0.00</span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        borderTop: '1px solid rgba(167, 136, 244, 0.16)',
                        paddingTop: 14,
                        marginTop: 4,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>TOTAL A COBRAR</div>
                        {!isFreePlan && <div style={{ fontSize: 11, color: '#a788f4' }}>Aprox. US$ {usdEstimate}</div>}
                      </div>
                      <div className="landing-serif" style={{ fontSize: 32, fontWeight: 700, color: '#FDDB35' }}>
                        {isFreePlan ? 'C$ 0' : `C$ ${finalPrice.toLocaleString()}`}
                      </div>
                    </div>
                  </div>

                  {/* Main Action Button */}
                  <button
                    type="button"
                    onClick={handleSubmitPayment}
                    disabled={isProcessing}
                    className="landing-btn"
                    style={{
                      width: '100%',
                      marginTop: 24,
                      padding: '16px 20px',
                      fontSize: 15,
                      fontWeight: 800,
                      background: isFreePlan
                        ? '#5F8FFF'
                        : 'linear-gradient(135deg, #FDDB35, #ffcc00)',
                      color: isFreePlan ? '#fff' : '#111',
                      borderRadius: 14,
                      boxShadow: isFreePlan
                        ? '0 12px 30px rgba(95, 143, 255, 0.35)'
                        : '0 12px 30px rgba(253, 219, 53, 0.35)',
                      opacity: isProcessing ? 0.7 : 1,
                      cursor: isProcessing ? 'wait' : 'pointer',
                    }}
                  >
                    {isProcessing ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            border: '2px solid currentColor',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            display: 'inline-block',
                            animation: 'spin 0.8s linear infinite',
                          }}
                        />
                        {processingStep || 'Procesando cobro seguro...'}
                      </span>
                    ) : isFreePlan ? (
                      'Activar Plan Básico Gratis Ahora'
                    ) : (
                      `Pagar C$ ${finalPrice.toLocaleString()} y Activar Suscripción`
                    )}
                  </button>

                  {/* Guarantees */}
                  <div style={{ marginTop: 20, display: 'grid', gap: 8, fontSize: 12, color: '#b0a9bf' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck size={16} color="#FDDB35" />
                      <span>Garantía de satisfacción de 30 días sin compromiso</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Check size={16} color="#5F8FFF" />
                      <span>Cancela tu suscripción en cualquier momento</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
