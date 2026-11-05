import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  timestamp: string;
}

const renderCopilotText = (text: string) =>
  text.split(/(\*\*.+?\*\*)/gs).map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>
      : part
  );

interface ProductAnalysis {
  id: string;
  nombre: string;
  sku?: string;
  stock: number;
  stockMinimo: number;
  precioVenta: number;
  costo: number;
  totalVendido: number;
  consumoDiario: number;
  diasCobertura: number;
  cantidadSugerida: number;
  categoriaNombre?: string;
}

export const CopilotPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState<ProductAnalysis[]>([]);
  const [salesList, setSalesList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [thinking, setThinking] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // M-07 & F-10: Cargar catálogo y ventas reales para calcular rotación y días de cobertura sin datos ficticios
  const loadRealAnalytics = async () => {
    setLoading(true);
    try {
      const [prodRes, saleRes] = await Promise.all([
        apiFetch<any[]>('/products?includeInactive=true'),
        apiFetch<any[]>('/sales?limit=100'),
      ]);

      const rawProducts = prodRes.success && prodRes.data ? prodRes.data : [];
      const rawSales = saleRes.success && saleRes.data ? saleRes.data : [];
      setSalesList(rawSales);

      // Calcular ventas por producto
      const soldMap = new Map<string, number>();
      for (const sale of rawSales) {
        if (sale.detalles && Array.isArray(sale.detalles)) {
          for (const det of sale.detalles) {
            const current = soldMap.get(det.productoId) || 0;
            soldMap.set(det.productoId, current + (Number(det.cantidad) || 0));
          }
        }
      }

      // Analizar cobertura de cada producto (M-07 Opción 2 / F-10)
      const analyzed: ProductAnalysis[] = rawProducts.map((p: any) => {
        const totalVendido = soldMap.get(p.id) || 0;
        // Consumo diario estimado sobre 30 días
        const consumoDiario = totalVendido > 0 ? Number((totalVendido / 30).toFixed(2)) : 0;
        // Días de cobertura = stock ÷ consumo diario
        const diasCobertura =
          consumoDiario > 0
            ? Number((p.stock / consumoDiario).toFixed(1))
            : p.stock > 0
            ? 90
            : 0;

        // Cantidad sugerida para alcanzar cobertura mínima de 15 días o satisfacer stock mínimo
        let cantidadSugerida = 0;
        if (p.stock <= p.stockMinimo) {
          const neededForStockMin = (p.stockMinimo * 2) - p.stock;
          const neededFor15Days = Math.ceil(consumoDiario * 15) - p.stock;
          cantidadSugerida = Math.max(neededForStockMin, neededFor15Days, 5);
        }

        return {
          id: p.id,
          nombre: p.nombre,
          sku: p.sku,
          stock: p.stock,
          stockMinimo: p.stockMinimo,
          precioVenta: p.precioVenta,
          costo: p.costo,
          totalVendido,
          consumoDiario,
          diasCobertura,
          cantidadSugerida,
          categoriaNombre: p.categoriaNombre || p.categoria?.nombre || 'General',
        };
      });

      setProducts(analyzed);

      // Mensaje de bienvenida inicial fundamentado en datos reales
      const lowStockCount = analyzed.filter((p) => p.stock <= p.stockMinimo).length;
      setMessages([
        {
          id: 'welcome',
          sender: 'copilot',
          text: `Hola ${user?.nombre || 'Administrador'}, he analizado **${analyzed.length} productos** del catálogo y **${rawSales.length} transacciones recientes**.

Actualmente hay **${lowStockCount} productos** en nivel crítico o bajo stock mínimo. ¿Desea revisar sugerencias de reabastecimiento o rotación?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (e) {
      console.error('Error calculando analíticas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRealAnalytics();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  // Generador de respuestas analíticas con datos reales verificables (M-07 Opción 2)
  const generateRealAnswer = (prompt: string): string => {
    const lower = prompt.toLowerCase();
    const criticalItems = products.filter((p) => p.stock <= p.stockMinimo);

    if (lower.includes('comprar') || lower.includes('reabastecer') || lower.includes('orden') || lower.includes('reposición')) {
      if (criticalItems.length === 0) {
        return `✅ **Diagnóstico de Inventario**:
Todo el catálogo de la librería supera actualmente el umbral de stock mínimo. No se requieren órdenes de compra urgentes hoy.`;
      }

      const itemsList = criticalItems
        .slice(0, 5)
        .map(
          (p) =>
            `• **${p.nombre}**: Stock actual **${p.stock}** (Mínimo: ${p.stockMinimo}). Cobertura estimada: **${p.diasCobertura} días**. Cantidad sugerida a pedir: **+${p.cantidadSugerida} u.**`
        )
        .join('\n');

      return `📦 **Sugerencia de Reabastecimiento con Datos Reales**:
Basado en las existencias y ritmo de consumo diario, se recomienda pedir:

${itemsList}

💡 Puede pulsar el botón **"Generar Orden"** en las tarjetas de alerta para abrir el formulario de compras.`;
    }

    if (lower.includes('ventas') || lower.includes('ticket') || lower.includes('promedio') || lower.includes('rotación')) {
      const totalIngreso = salesList.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
      const ticketPromedio = salesList.length > 0 ? Number((totalIngreso / salesList.length).toFixed(2)) : 0;
      const topRotation = [...products].sort((a, b) => b.totalVendido - a.totalVendido).slice(0, 3);

      return `📊 **Análisis Comercial de Ventas**:
• Transacciones analizadas: **${salesList.length} ventas**.
• Ticket promedio real en caja: **C$ ${ticketPromedio}**.
• Artículos con mayor rotación:
${topRotation.map((p, i) => `  ${i + 1}. **${p.nombre}** (${p.totalVendido} u. vendidas)`).join('\n')}`;
    }

    if (lower.includes('riesgo') || lower.includes('agotado') || lower.includes('quiebre')) {
      const outOfStock = products.filter((p) => p.stock === 0);
      if (outOfStock.length === 0) {
        return `🟢 **Estado de Quiebre**: No hay productos totalmente agotados (stock = 0).`;
      }
      return `⚠️ **Productos Agotados**:
Hay **${outOfStock.length} artículos** con existencia 0:
${outOfStock.map((p) => `• ${p.nombre}`).join('\n')}`;
    }

    return `Entendido. Puede consultarme sobre:
1. **Reabastecimiento sugerido**: "¿Qué productos debo comprar?"
2. **Rotación y ventas**: "¿Cuál es el ticket promedio y los más vendidos?"
3. **Riesgo de agotamiento**: "¿Qué productos están agotados?"`;
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || thinking) return;

    const userText = inputValue.trim();
    setInputValue('');

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setThinking(true);

    setTimeout(() => {
      const reply = generateRealAnswer(userText);
      setMessages((prev) => [
        ...prev,
        {
          id: `reply-${Date.now()}`,
          sender: 'copilot',
          text: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setThinking(false);
    }, 400);
  };

  // Productos con necesidad de reposición real
  const replenishmentAlerts = products
    .filter((p) => p.stock <= p.stockMinimo)
    .sort((a, b) => a.diasCobertura - b.diasCobertura);

  return (
    <div className="flex flex-col gap-5 sm:gap-6 max-w-7xl mx-auto font-body text-white pb-24 md:pb-16">
      {/* Header (M-07: Rotulación honesta con datos reales verificables) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-purple-400 text-2xl sm:text-3xl">smart_toy</span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">JIN Copilot · Asistente Analítico</h1>
          </div>
          <p className="text-xs text-gray-400">
            Reglas de negocio y análisis predictivo de rotación con días de cobertura (Datos Reales de Inventario).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* M-07: Rótulo honesto */}
          <span className="bg-purple-500/10 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
            Motor Analítico Activo
          </span>
          <Link
            to="/compras"
            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">local_shipping</span>
            Compras
          </Link>
        </div>
      </div>

      {/* Main Layout: Alert Cards + Chat Assistant */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Real Replenishment Recommendations (F-10) (col-span-7) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400">notification_important</span>
              Sugerencias de Reposición Calculadas ({replenishmentAlerts.length})
            </h2>
            <span className="text-xs text-gray-400">Fórmula: Stock ÷ Consumo Diario</span>
          </div>

          {loading ? (
            <div className="py-20 text-center text-gray-400 flex flex-col items-center gap-2 bg-[#1c1b22] border border-[#2d2c35] rounded-2xl">
              <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Calculando cobertura y rotación...</span>
            </div>
          ) : replenishmentAlerts.length === 0 ? (
            <div className="bg-[#1c1b22] border border-[#2d2c35] rounded-2xl p-8 text-center text-gray-400">
              <span className="material-symbols-outlined text-4xl text-emerald-400 mb-2">check_circle</span>
              <p className="text-sm font-semibold text-white">Inventario Abastecido</p>
              <p className="text-xs text-gray-500 mt-1">
                Todos los productos se encuentran por encima de su nivel de stock de seguridad.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {replenishmentAlerts.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-[#1c1b22] border border-[#2d2c35] p-4 rounded-2xl shadow-md hover:border-purple-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          prod.stock === 0
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {prod.stock === 0 ? 'Agotado (0 u.)' : 'Stock Crítico'}
                      </span>
                      <span className="text-[11px] text-gray-500">{prod.categoriaNombre}</span>
                      {prod.sku && <span className="text-[11px] text-gray-500">• SKU: {prod.sku}</span>}
                    </div>

                    <h3 className="text-sm font-bold text-white truncate" title={prod.nombre}>
                      {prod.nombre}
                    </h3>

                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      <div className="bg-[#100f14] p-2 rounded-xl border border-white/5">
                        <span className="text-gray-500 text-[10px] block">Stock Actual</span>
                        <span className={`font-bold ${prod.stock === 0 ? 'text-red-400' : 'text-white'}`}>
                          {prod.stock} u.
                        </span>
                      </div>
                      <div className="bg-[#100f14] p-2 rounded-xl border border-white/5">
                        <span className="text-gray-500 text-[10px] block">Vendido Reciente</span>
                        <span className="font-bold text-purple-300">{prod.totalVendido} u.</span>
                      </div>
                      <div className="bg-[#100f14] p-2 rounded-xl border border-white/5">
                        <span className="text-gray-500 text-[10px] block">Cobertura</span>
                        <span className="font-bold text-amber-400">
                          {prod.consumoDiario > 0 ? `~${prod.diasCobertura} d.` : 'Baja rotación'}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 mt-2">
                      Sugerencia: Pedir al menos{' '}
                      <strong className="text-emerald-400 font-bold">+{prod.cantidadSugerida} unidades</strong> para
                      restablecer reserva.
                    </p>
                  </div>

                  {/* F-10: Botón directo para generar orden */}
                  <div className="shrink-0 w-full sm:w-auto">
                    <button
                      onClick={() => navigate('/compras')}
                      className="w-full sm:w-auto px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <span className="material-symbols-outlined text-sm">post_add</span>
                      Generar Orden
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Chat (col-span-5) */}
        <div className="lg:col-span-5 bg-[#1c1b22] border border-[#2d2c35] rounded-2xl p-3.5 sm:p-4 flex flex-col h-[460px] sm:h-[580px] shadow-xl">
          <div className="pb-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-base">forum</span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Consulta Analítica en Tiempo Real</h3>
                <span className="text-[10px] text-gray-500">Respuestas calculadas sobre el catálogo real</span>
              </div>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 whitespace-pre-line leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-purple-600 text-white rounded-tr-sm'
                      : 'bg-[#100f14] text-gray-200 border border-[#2d2c35] rounded-tl-sm'
                  }`}
                >
                  {m.sender === 'copilot' ? renderCopilotText(m.text) : m.text}
                </div>
                <span className="text-[10px] text-gray-500 mt-1 px-1">{m.timestamp}</span>
              </div>
            ))}

            {thinking && (
              <div className="flex items-center gap-2 text-purple-400 text-xs py-1">
                <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                <span>Analizando métricas de catálogo...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Suggestions Pill Bar */}
          <div className="flex flex-wrap gap-1.5 py-2 border-t border-white/5">
            {[
              '¿Qué productos debo reabastecer?',
              '¿Cuáles son los más vendidos?',
              '¿Qué productos están agotados?',
            ].map((sugg, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInputValue(sugg);
                }}
                className="text-[11px] bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-full px-2.5 py-1 transition-colors text-left truncate"
              >
                {sugg}
              </button>
            ))}
          </div>

          {/* Chat Form */}
          <form onSubmit={handleSendMessage} className="flex gap-2 pt-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Pregunte sobre cobertura, ventas, compras..."
              className="flex-1 bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || thinking}
              className="p-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-40 transition-colors"
            >
              <span className="material-symbols-outlined text-base">send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
