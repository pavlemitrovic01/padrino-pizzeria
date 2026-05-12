// Test-only environment stubs.
// Loaded BEFORE test modules so that side-effectful module loads
// (e.g. buildSupabaseAdmin() at module top level) do not crash.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";
process.env.BANKART_SHARED_SECRET =
  process.env.BANKART_SHARED_SECRET || "test-bankart-secret";
