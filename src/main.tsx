import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CartProvider } from "./context/CartProvider";
import { AuthProvider } from "./auth/AuthProvider";
import "./index.css";
import { initClientMonitoring, logError } from "./lib/logger";
import { initAnalytics } from "./lib/analytics";

// Minimal ErrorBoundary: bez novih biblioteka, TS strict-safe.
// Cilj: spreči "white screen" na runtime greškama i da admin/kupac dobije recovery UI.
type ErrorBoundaryProps = { children: React.ReactNode };
type ErrorBoundaryState = { hasError: boolean; message?: string };

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(err: unknown): ErrorBoundaryState {
    const msg = err instanceof Error ? err.message : "Nepoznata greška";
    return { hasError: true, message: msg };
  }

  componentDidCatch(err: unknown): void {
    logError("ErrorBoundary", err);
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-xl font-semibold">Došlo je do greške</div>
          <div className="mt-2 text-sm text-white/70">
            Pokušaj osvežavanje stranice. Ako problem ostane, javi nam.
          </div>
          {this.state.message ? (
            <pre className="mt-4 text-xs text-white/50 whitespace-pre-wrap break-words">
              {this.state.message}
            </pre>
          ) : null}
          <button
            className="mt-6 w-full rounded-xl bg-white text-black font-semibold py-2"
            onClick={() => window.location.reload()}
          >
            Osveži stranicu
          </button>
        </div>
      </div>
    );
  }
}

// Client monitoring init: koristi se i za error log i za operativnu dijagnostiku.
// Ovo je pozvano ovde pre svih komponente/providere da se ne bi duplirao u StrictMode re-renderima.
initClientMonitoring({
  appTag: "padrino-web",
  version: "unknown",
});

initAnalytics();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <CartProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </CartProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
