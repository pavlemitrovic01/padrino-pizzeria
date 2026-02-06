import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CartProvider } from "./context/CartProvider";
import { AuthProvider } from "./auth/AuthProvider";
import "./index.css";
import { initClientMonitoring, logError } from "./lib/logger";

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

  componentDidCatch(err: unknown, info: unknown) {
    // Centralizovano logovanje (console + localStorage ring buffer)
    logError("ErrorBoundary.componentDidCatch", err, {
      reactComponentStack:
        typeof info === "object" && info !== null && "componentStack" in (info as any)
          ? (info as any).componentStack
          : undefined,
    });

    // eslint-disable-next-line no-console
    console.error("Unhandled UI error:", err, info);
  }

  private onReload = () => {
    window.location.reload();
  };

  private onTryAgain = () => {
    this.setState({ hasError: false, message: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121212] p-6">
            <h1 className="text-xl font-extrabold">Došlo je do greške</h1>
            <p className="text-sm text-gray-400 mt-2">
              Aplikacija je naišla na neočekivan problem. Možeš da pokušaš ponovo ili da osvežiš
              stranicu.
            </p>

            {this.state.message ? (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3">
                <p className="text-xs font-bold text-red-200">Detalji</p>
                <p className="text-xs text-red-200/80 mt-1 break-words">{this.state.message}</p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={this.onTryAgain}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-black"
              >
                Pokušaj ponovo
              </button>
              <button
                type="button"
                onClick={this.onReload}
                className="rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm font-extrabold text-white hover:border-white/25"
              >
                Osveži stranicu
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Monitoring inicijalizujemo TAČNO JEDNOM, pre render-a.
// Ne vezujemo ga za komponente/providere da se ne bi duplirao u StrictMode re-renderima.
initClientMonitoring({
  appTag: "padrino-web",
  version: "unknown",
});

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
