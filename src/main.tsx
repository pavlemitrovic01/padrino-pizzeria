import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CartProvider } from "./context/CartProvider";
import { AuthProvider } from "./auth/AuthProvider";
import "./index.css";
import { initClientMonitoring, logError } from "./lib/logger";
import { initAnalytics } from "./lib/analytics";

/**
 * Hash scroll (SPA-friendly)
 * - radi na initial load: /#kontakt
 * - radi na hashchange i back/forward
 * - retry par puta dok se sekcije ne mountuju
 */
function getHashId(): string {
  const raw = window.location.hash ?? "";
  const noHash = raw.startsWith("#") ? raw.slice(1) : raw;

  // Bezbedan decode (ako je hash URL-encoded)
  try {
    return decodeURIComponent(noHash).trim();
  } catch {
    return noHash.trim();
  }
}

function tryScrollToId(id: string, behavior: ScrollBehavior): boolean {
  if (!id) return true;

  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior, block: "start" });
    return true;
  }

  const byData = document.querySelector(`[data-section="${id}"]`);
  if (byData instanceof HTMLElement) {
    byData.scrollIntoView({ behavior, block: "start" });
    return true;
  }

  return false;
}

function runHashScrollWithRetry(opts?: { behavior?: ScrollBehavior }) {
  const id = getHashId();
  if (!id) return;

  const behavior: ScrollBehavior = opts?.behavior ?? "auto";

  let tries = 0;
  const maxTries = 24; // ~ 24 * 80ms = ~1.9s max retry

  const tick = () => {
    tries += 1;

    const ok = tryScrollToId(id, behavior);
    if (ok) return;

    if (tries < maxTries) {
      // Kombinacija rAF + timeout radi stabilnije dok se React mountuje
      window.requestAnimationFrame(() => {
        window.setTimeout(tick, 80);
      });
    }
  };

  // Mali delay da React mount krene
  window.setTimeout(() => {
    window.requestAnimationFrame(tick);
  }, 60);
}

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

// Hash listeners (single place)
window.addEventListener("hashchange", () => runHashScrollWithRetry({ behavior: "smooth" }));
window.addEventListener("popstate", () => runHashScrollWithRetry({ behavior: "smooth" }));

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

// Initial load hash scroll (bez smooth da ne izgleda kao glitch)
runHashScrollWithRetry({ behavior: "auto" });