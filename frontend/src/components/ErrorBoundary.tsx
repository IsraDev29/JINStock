import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error no controlado en JINStock:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoOffline = () => {
    localStorage.removeItem('jinstock_token');
    sessionStorage.removeItem('jinstock_token');
    window.location.href = '/pos';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#100f14] text-white flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6 text-purple-400">
            <span className="material-symbols-outlined text-3xl">cloud_off</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Ha ocurrido un problema al cargar la aplicación
          </h1>
          <p role="alert" aria-live="assertive" className="text-sm text-gray-400 max-w-md mb-6">
            No pudimos cargar esta pantalla. Puedes intentarlo de nuevo o continuar en el Punto de Venta offline. Si el problema persiste, contacta al administrador.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={this.handleReload}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-colors shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Recargar Aplicación
            </button>
            <button
              onClick={this.handleGoOffline}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">point_of_sale</span>
              Ir a POS Offline
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
