# PADRINO PIZZERIA — DEPLOYMENT CHECKLIST (Vercel + Supabase)

> Fokus: stabilnost, predvidljivost, build-safe.  
> Pravilo: posle svake promjene obavezno `npm run build`.  
> Ovo je “runbook” da deployment bude ponovljiv i bez nagađanja.

---

## 0) Pre-flight (lokalno)

### 0.1 Build mora proći lokalno
```bash
npm ci
npm run build
