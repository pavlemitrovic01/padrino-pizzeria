const BANKART_PAYMENT_JS_DATA_MAIN = "payment-js";
const BANKART_PAYMENT_JS_SRC = "https://gateway.bankart.si/js/integrated/payment.1.3.min.js";
const DEFAULT_SCRIPT_TIMEOUT_MS = 15000;

type BankartPaymentJsEventName = string;
type BankartPaymentJsEventHandler = (data?: unknown) => void;
type BankartPaymentJsStyle = Record<string, string>;

type BankartPaymentJsCardData = Record<string, unknown>;

type BankartPaymentJsTokenizeSuccess = (token: string, cardData: BankartPaymentJsCardData) => void;
type BankartPaymentJsErrorCallback = (errors: BankartPaymentJsError[]) => void;

export type BankartPaymentJsError = {
  attribute: string;
  key: string;
  message: string;
};

export type BankartPaymentJsTokenizePayload = {
  first_name?: string;
  last_name?: string;
  card_holder?: string;
  month: string;
  year: string;
  email?: string;
};

export type BankartPaymentJsCreateOptions = {
  publicIntegrationKey: string;
  numberDivId: string;
  cvvDivId: string;
  scriptSrc?: string;
  timeoutMs?: number;
};

interface PaymentJsInstance {
  init(
    integrationKey: string,
    numberDivId: string,
    cvvDivId: string,
    callback: (payment: PaymentJsInstance) => void,
  ): void;
  tokenize(
    data: BankartPaymentJsTokenizePayload,
    success: BankartPaymentJsTokenizeSuccess,
    error: BankartPaymentJsErrorCallback,
  ): void;
  setNumberStyle?(styles: BankartPaymentJsStyle): void;
  setCvvStyle?(styles: BankartPaymentJsStyle): void;
  numberOn?(eventName: BankartPaymentJsEventName, handler: BankartPaymentJsEventHandler): void;
  cvvOn?(eventName: BankartPaymentJsEventName, handler: BankartPaymentJsEventHandler): void;
}

type PaymentJsConstructor = new () => PaymentJsInstance;

declare global {
  interface Window {
    PaymentJs?: PaymentJsConstructor;
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeError(value: unknown): BankartPaymentJsError {
  if (!value || typeof value !== "object") {
    return {
      attribute: "payment",
      key: "errors.unknown",
      message: "Greška pri obradi kartice.",
    };
  }

  const rec = value as Record<string, unknown>;

  return {
    attribute: normalizeString(rec.attribute) || "payment",
    key: normalizeString(rec.key) || "errors.unknown",
    message: normalizeString(rec.message) || "Greška pri obradi kartice.",
  };
}

function ensureArrayOfErrors(value: unknown): BankartPaymentJsError[] {
  if (!Array.isArray(value)) {
    return [
      {
        attribute: "payment",
        key: "errors.unknown",
        message: "Greška pri obradi kartice.",
      },
    ];
  }

  const normalized = value.map(normalizeError).filter((err) => err.message.length > 0);
  return normalized.length
    ? normalized
    : [
        {
          attribute: "payment",
          key: "errors.unknown",
          message: "Greška pri obradi kartice.",
        },
      ];
}

function getExistingScript(scriptSrc: string): HTMLScriptElement | null {
  const allScripts = Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"));
  return allScripts.find((script) => normalizeString(script.src) === scriptSrc) ?? null;
}

function loadPaymentJsScript(scriptSrc: string, timeoutMs: number): Promise<void> {
  if (!isBrowser()) {
    return Promise.reject(new Error("Bankart payment.js je dostupan samo u browser okruženju."));
  }

  if (window.PaymentJs) {
    return Promise.resolve();
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = getExistingScript(scriptSrc);
    const script = existing ?? document.createElement("script");

    let timeoutId: number | null = window.setTimeout(() => {
      timeoutId = null;
      reject(new Error("Bankart payment.js nije učitan na vreme."));
    }, timeoutMs);

    const cleanup = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const onReady = () => {
      cleanup();
      if (!window.PaymentJs) {
        reject(new Error("Bankart payment.js je učitan, ali PaymentJs nije dostupan."));
        return;
      }
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Neuspešno učitavanje Bankart payment.js skripte."));
    };

    if (existing) {
      existing.addEventListener("load", onReady, { once: true });
      existing.addEventListener("error", onError, { once: true });

      if (existing.dataset.loaded === "true" || window.PaymentJs) {
        onReady();
      }
      return;
    }

    script.async = true;
    script.defer = true;
    script.src = scriptSrc;
    script.dataset.main = BANKART_PAYMENT_JS_DATA_MAIN;

    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        onReady();
      },
      { once: true },
    );

    script.addEventListener("error", onError, { once: true });

    const head = document.head || document.body || document.documentElement;
    head.appendChild(script);
  }).catch((error) => {
    scriptLoadPromise = null;
    throw error;
  });

  return scriptLoadPromise;
}

function requiredTokenizeFieldMessage(payload: BankartPaymentJsTokenizePayload): string | null {
  const month = normalizeString(payload.month);
  const year = normalizeString(payload.year);
  const cardHolder = normalizeString(payload.card_holder);
  const firstName = normalizeString(payload.first_name);
  const lastName = normalizeString(payload.last_name);

  if (!month) return "Unesite mesec isteka kartice.";
  if (!year) return "Unesite godinu isteka kartice.";
  if (!cardHolder && (!firstName || !lastName)) {
    return "Unesite ime vlasnika kartice ili ime i prezime.";
  }

  return null;
}

export function formatBankartPaymentJsErrors(errors: BankartPaymentJsError[]): string {
  const parts = ensureArrayOfErrors(errors)
    .map((error) => error.message.trim())
    .filter(Boolean);

  return parts.length ? parts.join("\n") : "Greška pri obradi kartice.";
}

export class BankartPaymentJsController {
  private readonly payment: PaymentJsInstance;
  private readonly numberDivId: string;
  private readonly cvvDivId: string;
  private disposed = false;

  constructor(payment: PaymentJsInstance, numberDivId: string, cvvDivId: string) {
    this.payment = payment;
    this.numberDivId = numberDivId;
    this.cvvDivId = cvvDivId;
  }

  setNumberStyle(styles: BankartPaymentJsStyle) {
    if (this.disposed) return;
    this.payment.setNumberStyle?.(styles);
  }

  setCvvStyle(styles: BankartPaymentJsStyle) {
    if (this.disposed) return;
    this.payment.setCvvStyle?.(styles);
  }

  numberOn(eventName: BankartPaymentJsEventName, handler: BankartPaymentJsEventHandler) {
    if (this.disposed) return;
    this.payment.numberOn?.(eventName, handler);
  }

  cvvOn(eventName: BankartPaymentJsEventName, handler: BankartPaymentJsEventHandler) {
    if (this.disposed) return;
    this.payment.cvvOn?.(eventName, handler);
  }

  tokenize(payload: BankartPaymentJsTokenizePayload): Promise<{ token: string; cardData: BankartPaymentJsCardData }> {
    if (this.disposed) {
      return Promise.reject(new Error("Bankart payment.js instanca je ugašena."));
    }

    const validationMessage = requiredTokenizeFieldMessage(payload);
    if (validationMessage) {
      return Promise.reject(new Error(validationMessage));
    }

    return new Promise((resolve, reject) => {
      this.payment.tokenize(
        payload,
        (token, cardData) => {
          const normalizedToken = normalizeString(token);
          if (!normalizedToken) {
            reject(new Error("Bankart nije vratio transaction token."));
            return;
          }

          resolve({ token: normalizedToken, cardData });
        },
        (errors) => {
          reject(ensureArrayOfErrors(errors));
        },
      );
    });
  }

  dispose() {
    if (this.disposed || !isBrowser()) {
      this.disposed = true;
      return;
    }

    this.disposed = true;

    const numberDiv = document.getElementById(this.numberDivId);
    const cvvDiv = document.getElementById(this.cvvDivId);

    if (numberDiv) numberDiv.innerHTML = "";
    if (cvvDiv) cvvDiv.innerHTML = "";
  }
}

export async function createBankartPaymentJs(
  options: BankartPaymentJsCreateOptions,
): Promise<BankartPaymentJsController> {
  const publicIntegrationKey = normalizeString(options.publicIntegrationKey);
  const numberDivId = normalizeString(options.numberDivId);
  const cvvDivId = normalizeString(options.cvvDivId);
  const scriptSrc = normalizeString(options.scriptSrc) || BANKART_PAYMENT_JS_SRC;
  const timeoutMs = options.timeoutMs ?? DEFAULT_SCRIPT_TIMEOUT_MS;

  if (!publicIntegrationKey) {
    throw new Error("Nedostaje Bankart public integration key.");
  }

  if (!numberDivId || !cvvDivId) {
    throw new Error("Nedostaju Bankart mount element ID-jevi.");
  }

  await loadPaymentJsScript(scriptSrc, timeoutMs);

  const PaymentJsCtor = window.PaymentJs;
  if (!PaymentJsCtor) {
    throw new Error("Bankart payment.js nije dostupan nakon učitavanja skripte.");
  }

  return await new Promise<BankartPaymentJsController>((resolve, reject) => {
    try {
      const payment = new PaymentJsCtor();
      payment.init(publicIntegrationKey, numberDivId, cvvDivId, (readyPayment) => {
        resolve(new BankartPaymentJsController(readyPayment, numberDivId, cvvDivId));
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Greška pri inicijalizaciji Bankart payment.js."));
    }
  });
}

export { BANKART_PAYMENT_JS_SRC };