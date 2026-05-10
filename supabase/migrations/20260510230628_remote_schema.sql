


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."set_site_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_site_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_total_price"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.total_price IS NULL THEN
    IF NEW.total_eur_cents IS NOT NULL THEN
      NEW.total_price := (NEW.total_eur_cents::numeric / 100);
    ELSE
      NEW.total_price := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_total_price"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_users_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "price" integer NOT NULL,
    "image" "text" NOT NULL,
    "category" "text" NOT NULL,
    "price_eur_cents" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "customer_name" "text" DEFAULT ''::"text" NOT NULL,
    "customer_phone" "text" NOT NULL,
    "customer_address" "text" NOT NULL,
    "items" "jsonb" NOT NULL,
    "total_price" numeric NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text",
    "total_eur_cents" bigint,
    "fx_rsd_per_eur" numeric,
    "payment_method" "text",
    "payment_status" "text",
    "payment_provider" "text",
    "payment_reference" "text",
    "payment_meta" "jsonb",
    CONSTRAINT "orders_payment_method_check" CHECK ((("payment_method" IS NULL) OR ("payment_method" = ANY (ARRAY['cash'::"text", 'card'::"text"])))),
    CONSTRAINT "orders_payment_status_check" CHECK ((("payment_status" IS NULL) OR ("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'cancelled'::"text", 'refunded'::"text"]))))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_settings" (
    "id" integer NOT NULL,
    "phone_display" "text" DEFAULT ''::"text" NOT NULL,
    "phone_e164" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "address_line" "text" DEFAULT ''::"text" NOT NULL,
    "hours_display" "text" DEFAULT ''::"text" NOT NULL,
    "maps_url" "text" DEFAULT ''::"text" NOT NULL,
    "instagram_url" "text" DEFAULT ''::"text" NOT NULL,
    "whatsapp_url" "text" DEFAULT ''::"text" NOT NULL,
    "viber_url" "text" DEFAULT ''::"text" NOT NULL,
    "default_city" "text" DEFAULT 'Budva'::"text" NOT NULL,
    "default_postcode" "text" DEFAULT '85310'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "site_settings_id_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."site_settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("email");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id");



CREATE INDEX "orders_created_at_desc_idx" ON "public"."orders" USING "btree" ("created_at" DESC);



CREATE INDEX "orders_payment_reference_idx" ON "public"."orders" USING "btree" ("payment_reference");



CREATE INDEX "orders_payment_status_idx" ON "public"."orders" USING "btree" ("payment_status");



CREATE INDEX "orders_status_created_at_desc_idx" ON "public"."orders" USING "btree" ("status", "created_at" DESC);



CREATE OR REPLACE TRIGGER "orders_set_total_price" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_total_price"();



CREATE OR REPLACE TRIGGER "telegram-new-order" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://padrino-pizzeria.vercel.app/api/telegram-new-order', 'POST', '{"Content-type":"application/json"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "trg_site_settings_updated_at" BEFORE UPDATE ON "public"."site_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_site_settings_updated_at"();



CREATE POLICY "Allow insert orders for anon+authenticated" ON "public"."orders" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "allow_admin_delete_by_email" ON "public"."orders" FOR DELETE TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") = 'pavlemitrovic01@gmail.com'::"text"));



CREATE POLICY "allow_admin_select_by_email" ON "public"."orders" FOR SELECT TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") = 'pavlemitrovic01@gmail.com'::"text"));



CREATE POLICY "allow_admin_update_by_email" ON "public"."orders" FOR UPDATE TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") = 'pavlemitrovic01@gmail.com'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'email'::"text") = 'pavlemitrovic01@gmail.com'::"text"));



CREATE POLICY "menu" ON "public"."menu_items" FOR SELECT USING (true);



ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "site_settings_public_read" ON "public"."site_settings" FOR SELECT TO "authenticated", "anon" USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."set_site_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_site_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_site_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_total_price"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_total_price"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_total_price"() TO "service_role";


















GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items" TO "anon";
GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."site_settings" TO "anon";
GRANT ALL ON TABLE "public"."site_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."site_settings" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop trigger if exists "orders_set_total_price" on "public"."orders";

drop trigger if exists "trg_site_settings_updated_at" on "public"."site_settings";

drop policy "Allow insert orders for anon+authenticated" on "public"."orders";

drop policy "site_settings_public_read" on "public"."site_settings";

alter table "public"."orders" alter column "id" set default uuid_generate_v4();


  create policy "Allow insert orders for anon+authenticated"
  on "public"."orders"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "site_settings_public_read"
  on "public"."site_settings"
  as permissive
  for select
  to anon, authenticated
using (true);


CREATE TRIGGER orders_set_total_price BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION set_total_price();

CREATE TRIGGER trg_site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION set_site_settings_updated_at();


