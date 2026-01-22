// @ts-ignore
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

serve(async (req: Request) => {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const method = req.method;

  // ======================
  // GET – list all orders
  // ======================
  if (method === "GET") {
    const { data, error } = await sb
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // ======================
  // PATCH – update status
  // ======================
  if (method === "PATCH") {
    let body: any;

    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { id, status } = body;

    if (!id || typeof id !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or missing id" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!status || typeof status !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or missing status" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await sb
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select("*");

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Order not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // ======================
  // METHOD NOT ALLOWED
  // ======================
  return new Response(
    JSON.stringify({ success: false, error: "Method not allowed" }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
});
