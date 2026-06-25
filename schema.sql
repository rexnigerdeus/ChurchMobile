


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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."role_level" AS ENUM (
    'COMMUNITY_ADMIN',
    'REGION_MANAGER',
    'CHURCH_LEADER',
    'DEPT_MANAGER',
    'SUPER_ADMIN',
    'LOCAL_ADMIN',
    'FINANCE_MANAGER',
    'SECRETARY',
    'DEPARTMENT_LEADER'
);


ALTER TYPE "public"."role_level" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_is_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('CHURCH_LEADER', 'SECRETARY')
  );
$$;


ALTER FUNCTION "public"."check_is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_church_departments"("p_church_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result json := '[]'::json;
  v_community_id UUID;
BEGIN
  -- Vérification : l'appelant doit avoir un rôle sur cette église
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (ur.role IN ('CHURCH_LEADER', 'SECRETARY', 'FINANCE_MANAGER') AND ur.entity_id = p_church_id)
        OR
        (ur.role = 'DEPARTMENT_LEADER' AND ur.entity_id IN (
          SELECT cd_inner.id FROM church_departments cd_inner WHERE cd_inner.church_id = p_church_id
        ))
      )
  ) THEN
    RAISE EXCEPTION 'Accès refusé : vous n''avez pas de rôle sur cette église.';
  END IF;

  -- Récupérer la communauté de l'église
  SELECT c.community_id INTO v_community_id FROM churches c WHERE c.id = p_church_id;

  -- Construire le résultat en JSON (évite toute ambiguïté de colonnes)
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO v_result
  FROM (
    -- 1) Instances church_departments déjà créées
    SELECT
      cd.id AS id,
      cd.custom_name AS custom_name,
      cd.community_dept_id AS community_dept_id,
      COALESCE(gd.default_name, 'Département') AS default_name,
      TRUE AS has_instance
    FROM church_departments cd
    LEFT JOIN community_departments cmd ON cmd.id = cd.community_dept_id
    LEFT JOIN global_departments gd ON gd.id = cmd.global_dept_id
    WHERE cd.church_id = p_church_id

    UNION ALL

    -- 2) community_departments non instanciés
    SELECT
      cmd2.id AS id,
      NULL::TEXT AS custom_name,
      cmd2.id AS community_dept_id,
      COALESCE(gd2.default_name, 'Département') AS default_name,
      FALSE AS has_instance
    FROM community_departments cmd2
    JOIN global_departments gd2 ON gd2.id = cmd2.global_dept_id
    WHERE cmd2.community_id = v_community_id
    AND cmd2.id NOT IN (
      SELECT cd3.community_dept_id FROM church_departments cd3 WHERE cd3.church_id = p_church_id
    )
  ) t;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_church_departments"("p_church_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_community_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT community_id 
    FROM public.user_profiles 
    WHERE id = auth.uid() 
    LIMIT 1;
$$;


ALTER FUNCTION "public"."get_current_user_community_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("target_role" "public"."role_level") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = target_role
    );
$$;


ALTER FUNCTION "public"."has_role"("target_role" "public"."role_level") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_email_registered"("p_email" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE email ILIKE p_email);
$$;


ALTER FUNCTION "public"."is_email_registered"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_member_to_auth"("p_email" "text", "p_user_id" "uuid", "p_church_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_member_id UUID;
BEGIN
  -- Cherche une fiche existante avec cet email dans cette église
  SELECT id INTO v_member_id 
  FROM public.church_members 
  WHERE church_id = p_church_id AND email ILIKE p_email
  LIMIT 1;

  IF v_member_id IS NOT NULL THEN
    -- Met à jour la fiche existante pour lier le compte Auth
    UPDATE public.church_members 
    SET user_id = p_user_id, status = 'APPROVED'
    WHERE id = v_member_id;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;


ALTER FUNCTION "public"."link_member_to_auth"("p_email" "text", "p_user_id" "uuid", "p_church_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."broadcast_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "community_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "sender_role" character varying(50) NOT NULL,
    "subject" character varying(255) NOT NULL,
    "body" "text" NOT NULL,
    "targeting" "jsonb" DEFAULT '{"audience": "ALL"}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."broadcast_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broadcast_reads" (
    "user_id" "uuid" NOT NULL,
    "message_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."broadcast_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."church_announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid",
    "title" character varying(255) NOT NULL,
    "body" "text" NOT NULL,
    "image_url" "text",
    "is_pinned" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."church_announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."church_departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid",
    "region_dept_id" "uuid",
    "community_dept_id" "uuid",
    "custom_name" character varying(255),
    "manager_member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "assistant_manager_id" "uuid"
);


ALTER TABLE "public"."church_departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."church_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "full_name" character varying(255) NOT NULL,
    "email" character varying(255),
    "phone" character varying(50),
    "address" "text",
    "birth_date" "date",
    "gender" character varying(20),
    "marital_status" character varying(50),
    "is_baptized_water" boolean DEFAULT false,
    "baptism_date" "date",
    "is_baptized_spirit" boolean DEFAULT false,
    "join_date" "date" DEFAULT CURRENT_DATE,
    "photo_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "status" character varying(20) DEFAULT 'APPROVED'::character varying,
    "dob" "date",
    "profession" character varying(255)
);


ALTER TABLE "public"."church_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."church_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid",
    "amount" numeric DEFAULT 20000 NOT NULL,
    "months_paid" integer DEFAULT 1 NOT NULL,
    "status" character varying(50) DEFAULT 'PENDING'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "validated_at" timestamp with time zone,
    "validated_by" "uuid",
    "proof_url" "text"
);


ALTER TABLE "public"."church_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."church_programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid",
    "title" character varying(255) NOT NULL,
    "description" "text",
    "category" character varying(50),
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone,
    "location" character varying(255) DEFAULT 'Temple principal'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."church_programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."churches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "region_id" "uuid" NOT NULL,
    "community_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "is_active" boolean DEFAULT true,
    "branding_logo_url" "text",
    "branding_color" character varying(7),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "subscription_status" character varying(50) DEFAULT 'ACTIVE'::character varying,
    "subscription_end_date" timestamp with time zone DEFAULT ("now"() + '1 mon'::interval),
    "church_code" character varying(20),
    "declared_member_count" integer DEFAULT 0
);


ALTER TABLE "public"."churches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."communities" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "branding_logo_url" "text",
    "branding_color" character varying(7),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."communities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "community_id" "uuid" NOT NULL,
    "global_department_id" "uuid" NOT NULL,
    "custom_name" character varying(255),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "manager_id" "uuid"
);


ALTER TABLE "public"."community_departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_announcement_groups" (
    "announcement_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL
);


ALTER TABLE "public"."department_announcement_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "title" character varying(255) NOT NULL,
    "content" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "concerns_all" boolean DEFAULT true,
    "group_id" "uuid"
);


ALTER TABLE "public"."department_announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_children" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "first_name" character varying(255) NOT NULL,
    "last_name" character varying(255) NOT NULL,
    "class_name" character varying(100) NOT NULL,
    "parent_name" character varying(255),
    "parent_phone" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "class_id" "uuid"
);


ALTER TABLE "public"."department_children" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_equipment_needs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "item_name" character varying(255) NOT NULL,
    "priority" character varying(50) DEFAULT 'MOYENNE'::character varying,
    "status" character varying(50) DEFAULT 'DEMANDÉ'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."department_equipment_needs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_equipments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "name" character varying(255) NOT NULL,
    "category" character varying(100),
    "condition" character varying(50) DEFAULT 'BON'::character varying,
    "is_available" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."department_equipments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_finances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "type" character varying(20) NOT NULL,
    "category" character varying(50) NOT NULL,
    "amount" numeric NOT NULL,
    "motif" "text",
    "member_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "group_id" "uuid"
);


ALTER TABLE "public"."department_finances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "name" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "leader_id" "uuid"
);


ALTER TABLE "public"."department_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_headcounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "event_title" character varying(255) NOT NULL,
    "event_date" "date" NOT NULL,
    "men_count" integer DEFAULT 0,
    "women_count" integer DEFAULT 0,
    "children_count" integer DEFAULT 0,
    "total_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "church_program_id" "uuid"
);


ALTER TABLE "public"."department_headcounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "community_id" "uuid" NOT NULL,
    "dept_instance_id" "uuid" NOT NULL,
    "level" character varying(20) NOT NULL,
    "title" character varying(255) NOT NULL,
    "meeting_date" "date" NOT NULL,
    "attendance_count" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."department_meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "department_id" "uuid",
    "user_id" "uuid",
    "status" character varying(20) DEFAULT 'PENDING'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sub_group_id" "uuid"
);


ALTER TABLE "public"."department_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_planning_groups" (
    "planning_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL
);


ALTER TABLE "public"."department_planning_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_planning_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "planning_id" "uuid",
    "user_id" "uuid",
    "role_name" character varying(255) NOT NULL
);


ALTER TABLE "public"."department_planning_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_plannings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "title" character varying(255) NOT NULL,
    "event_date" timestamp with time zone NOT NULL,
    "description" "text",
    "is_church_event" boolean DEFAULT false,
    "concerns_all" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "church_program_id" "uuid",
    "group_id" "uuid"
);


ALTER TABLE "public"."department_plannings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "name" character varying(255) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."department_projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_songs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "title" character varying(255) NOT NULL,
    "musical_key" character varying(10),
    "video_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "group_id" "uuid"
);


ALTER TABLE "public"."department_songs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_souls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "first_name" character varying(255) NOT NULL,
    "last_name" character varying(255) NOT NULL,
    "phone" character varying(50),
    "address" "text",
    "profession" character varying(255),
    "photo_url" "text",
    "assigned_to" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "is_baptized_candidate" boolean DEFAULT false,
    "regularity" character varying(50) DEFAULT 'Faible'::character varying,
    "observations" "text",
    "is_called" boolean DEFAULT false,
    "is_visited" boolean DEFAULT false,
    "integration_status" character varying(20) DEFAULT 'NONE'::character varying,
    "integration_notes" "text"
);


ALTER TABLE "public"."department_souls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "title" character varying(255) NOT NULL,
    "status" character varying(50) DEFAULT 'TODO'::character varying,
    "assigned_to" "uuid",
    "deadline" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."department_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_departments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "community_id" "uuid" NOT NULL,
    "community_department_id" "uuid" NOT NULL,
    "entity_type" character varying(50),
    "entity_id" "uuid" NOT NULL,
    "custom_name" character varying(255),
    "branding_logo_url" "text",
    "branding_color" character varying(7),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "entity_departments_entity_type_check" CHECK ((("entity_type")::"text" = ANY ((ARRAY['REGION'::character varying, 'CHURCH'::character varying])::"text"[])))
);


ALTER TABLE "public"."entity_departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_id" "uuid",
    "changed_by" "uuid",
    "old_amount" numeric,
    "new_amount" numeric,
    "old_data" "jsonb",
    "action_type" character varying(20),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."financial_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid",
    "amount" numeric NOT NULL,
    "type" character varying(20),
    "category" character varying(50),
    "event_name" character varying(255),
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_at" timestamp with time zone,
    "updated_by" "uuid",
    "is_modified" boolean DEFAULT false,
    CONSTRAINT "financial_entries_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['INCOME'::character varying, 'EXPENSE'::character varying])::"text"[])))
);


ALTER TABLE "public"."financial_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."global_departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "default_name" character varying(255) NOT NULL,
    "default_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."global_departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."master_departments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code_name" character varying(50) NOT NULL,
    "default_name" character varying(255) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."master_departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pastoral_appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid",
    "member_id" "uuid",
    "appointment_date" "date" NOT NULL,
    "appointment_time" time without time zone NOT NULL,
    "type" character varying(50),
    "status" character varying(20) DEFAULT 'PENDING'::character varying,
    "member_note" "text",
    "pastor_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pastoral_appointments_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'RESCHEDULED'::character varying, 'COMPLETED'::character varying])::"text"[])))
);


ALTER TABLE "public"."pastoral_appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pastoral_availabilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid",
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "slot_duration_minutes" integer DEFAULT 30,
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."pastoral_availabilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pastoral_prayer_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid",
    "member_id" "uuid",
    "subject" character varying(255) NOT NULL,
    "body" "text" NOT NULL,
    "is_anonymous" boolean DEFAULT false,
    "status" character varying(20) DEFAULT 'PENDING'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pastoral_prayer_requests_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['PENDING'::character varying, 'PRAYED'::character varying, 'ANSWERED'::character varying])::"text"[])))
);


ALTER TABLE "public"."pastoral_prayer_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pastoral_spiritual_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid",
    "member_id" "uuid",
    "pastor_id" "uuid",
    "note_body" "text" NOT NULL,
    "category" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pastoral_spiritual_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."region_departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "region_id" "uuid" NOT NULL,
    "community_dept_id" "uuid" NOT NULL,
    "custom_name" character varying(255),
    "manager_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."region_departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."regions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "community_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "branding_logo_url" "text",
    "branding_color" character varying(7),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."regions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "community_id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "full_name" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."role_level" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "department_id" "uuid"
);

ALTER TABLE ONLY "public"."user_roles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."broadcast_messages"
    ADD CONSTRAINT "broadcast_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."broadcast_reads"
    ADD CONSTRAINT "broadcast_reads_pkey" PRIMARY KEY ("user_id", "message_id");



ALTER TABLE ONLY "public"."church_announcements"
    ADD CONSTRAINT "church_announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."church_departments"
    ADD CONSTRAINT "church_departments_church_id_community_dept_id_key" UNIQUE ("church_id", "community_dept_id");



ALTER TABLE ONLY "public"."church_departments"
    ADD CONSTRAINT "church_departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."church_members"
    ADD CONSTRAINT "church_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."church_payments"
    ADD CONSTRAINT "church_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."church_programs"
    ADD CONSTRAINT "church_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."churches"
    ADD CONSTRAINT "churches_church_code_key" UNIQUE ("church_code");



ALTER TABLE ONLY "public"."churches"
    ADD CONSTRAINT "churches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."communities"
    ADD CONSTRAINT "communities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_departments"
    ADD CONSTRAINT "community_departments_community_id_global_department_id_key" UNIQUE ("community_id", "global_department_id");



ALTER TABLE ONLY "public"."community_departments"
    ADD CONSTRAINT "community_departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_announcement_groups"
    ADD CONSTRAINT "department_announcement_groups_pkey" PRIMARY KEY ("announcement_id", "group_id");



ALTER TABLE ONLY "public"."department_announcements"
    ADD CONSTRAINT "department_announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_children"
    ADD CONSTRAINT "department_children_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_equipment_needs"
    ADD CONSTRAINT "department_equipment_needs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_equipments"
    ADD CONSTRAINT "department_equipments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_finances"
    ADD CONSTRAINT "department_finances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_groups"
    ADD CONSTRAINT "department_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_headcounts"
    ADD CONSTRAINT "department_headcounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_meetings"
    ADD CONSTRAINT "department_meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_members"
    ADD CONSTRAINT "department_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_planning_groups"
    ADD CONSTRAINT "department_planning_groups_pkey" PRIMARY KEY ("planning_id", "group_id");



ALTER TABLE ONLY "public"."department_planning_roles"
    ADD CONSTRAINT "department_planning_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_planning_roles"
    ADD CONSTRAINT "department_planning_roles_planning_id_user_id_role_name_key" UNIQUE ("planning_id", "user_id", "role_name");



ALTER TABLE ONLY "public"."department_plannings"
    ADD CONSTRAINT "department_plannings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_projects"
    ADD CONSTRAINT "department_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_songs"
    ADD CONSTRAINT "department_songs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_souls"
    ADD CONSTRAINT "department_souls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_tasks"
    ADD CONSTRAINT "department_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_departments"
    ADD CONSTRAINT "entity_departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_audit_logs"
    ADD CONSTRAINT "financial_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_entries"
    ADD CONSTRAINT "financial_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."global_departments"
    ADD CONSTRAINT "global_departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."master_departments"
    ADD CONSTRAINT "master_departments_code_name_key" UNIQUE ("code_name");



ALTER TABLE ONLY "public"."master_departments"
    ADD CONSTRAINT "master_departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pastoral_appointments"
    ADD CONSTRAINT "pastoral_appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pastoral_availabilities"
    ADD CONSTRAINT "pastoral_availabilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pastoral_prayer_requests"
    ADD CONSTRAINT "pastoral_prayer_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pastoral_spiritual_notes"
    ADD CONSTRAINT "pastoral_spiritual_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."region_departments"
    ADD CONSTRAINT "region_departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."region_departments"
    ADD CONSTRAINT "region_departments_region_id_community_dept_id_key" UNIQUE ("region_id", "community_dept_id");



ALTER TABLE ONLY "public"."regions"
    ADD CONSTRAINT "regions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_entity_id_key" UNIQUE ("user_id", "role", "entity_id");



CREATE INDEX "idx_church_members_user_id" ON "public"."church_members" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_unique_church_member_email" ON "public"."church_members" USING "btree" ("church_id", "email") WHERE ("email" IS NOT NULL);



ALTER TABLE ONLY "public"."broadcast_messages"
    ADD CONSTRAINT "broadcast_messages_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."broadcast_messages"
    ADD CONSTRAINT "broadcast_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."broadcast_reads"
    ADD CONSTRAINT "broadcast_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."broadcast_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."broadcast_reads"
    ADD CONSTRAINT "broadcast_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_announcements"
    ADD CONSTRAINT "church_announcements_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_announcements"
    ADD CONSTRAINT "church_announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."church_departments"
    ADD CONSTRAINT "church_departments_assistant_manager_id_fkey" FOREIGN KEY ("assistant_manager_id") REFERENCES "public"."church_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."church_departments"
    ADD CONSTRAINT "church_departments_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_departments"
    ADD CONSTRAINT "church_departments_community_dept_id_fkey" FOREIGN KEY ("community_dept_id") REFERENCES "public"."community_departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_departments"
    ADD CONSTRAINT "church_departments_manager_member_id_fkey" FOREIGN KEY ("manager_member_id") REFERENCES "public"."church_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."church_departments"
    ADD CONSTRAINT "church_departments_region_dept_id_fkey" FOREIGN KEY ("region_dept_id") REFERENCES "public"."region_departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_members"
    ADD CONSTRAINT "church_members_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_members"
    ADD CONSTRAINT "church_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."church_payments"
    ADD CONSTRAINT "church_payments_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_payments"
    ADD CONSTRAINT "church_payments_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."church_programs"
    ADD CONSTRAINT "church_programs_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."churches"
    ADD CONSTRAINT "churches_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."churches"
    ADD CONSTRAINT "churches_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_departments"
    ADD CONSTRAINT "community_departments_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_departments"
    ADD CONSTRAINT "community_departments_global_department_id_fkey" FOREIGN KEY ("global_department_id") REFERENCES "public"."global_departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_departments"
    ADD CONSTRAINT "community_departments_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."department_announcement_groups"
    ADD CONSTRAINT "department_announcement_groups_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "public"."department_announcements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_announcement_groups"
    ADD CONSTRAINT "department_announcement_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."department_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_announcements"
    ADD CONSTRAINT "department_announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."department_announcements"
    ADD CONSTRAINT "department_announcements_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."church_departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_announcements"
    ADD CONSTRAINT "department_announcements_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."department_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_children"
    ADD CONSTRAINT "department_children_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."department_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_children"
    ADD CONSTRAINT "department_children_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."department_children"
    ADD CONSTRAINT "department_children_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."church_departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_equipment_needs"
    ADD CONSTRAINT "department_equipment_needs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."church_departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_equipments"
    ADD CONSTRAINT "department_equipments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."church_departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_finances"
    ADD CONSTRAINT "department_finances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."department_finances"
    ADD CONSTRAINT "department_finances_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."church_departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_finances"
    ADD CONSTRAINT "department_finances_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."department_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_finances"
    ADD CONSTRAINT "department_finances_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."department_groups"
    ADD CONSTRAINT "department_groups_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."church_departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_groups"
    ADD CONSTRAINT "department_groups_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."department_headcounts"
    ADD CONSTRAINT "department_headcounts_church_program_id_fkey" FOREIGN KEY ("church_program_id") REFERENCES "public"."church_programs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."department_headcounts"
    ADD CONSTRAINT "department_headcounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."department_headcounts"
    ADD CONSTRAINT "department_headcounts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."church_departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_meetings"
    ADD CONSTRAINT "department_meetings_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id");



ALTER TABLE ONLY "public"."department_members"
    ADD CONSTRAINT "department_members_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."church_departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_members"
    ADD CONSTRAINT "department_members_sub_group_id_fkey" FOREIGN KEY ("sub_group_id") REFERENCES "public"."department_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."department_members"
    ADD CONSTRAINT "department_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_planning_groups"
    ADD CONSTRAINT "department_planning_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."department_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_planning_groups"
    ADD CONSTRAINT "department_planning_groups_planning_id_fkey" FOREIGN KEY ("planning_id") REFERENCES "public"."department_plannings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_planning_roles"
    ADD CONSTRAINT "department_planning_roles_planning_id_fkey" FOREIGN KEY ("planning_id") REFERENCES "public"."department_plannings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_planning_roles"
    ADD CONSTRAINT "department_planning_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_plannings"
    ADD CONSTRAINT "department_plannings_church_program_id_fkey" FOREIGN KEY ("church_program_id") REFERENCES "public"."church_programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_plannings"
    ADD CONSTRAINT "department_plannings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."department_plannings"
    ADD CONSTRAINT "department_plannings_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."church_departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_plannings"
    ADD CONSTRAINT "department_plannings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."department_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_projects"
    ADD CONSTRAINT "department_projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."department_projects"
    ADD CONSTRAINT "department_projects_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."church_departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_songs"
    ADD CONSTRAINT "department_songs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."church_departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_songs"
    ADD CONSTRAINT "department_songs_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."department_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_souls"
    ADD CONSTRAINT "department_souls_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."department_souls"
    ADD CONSTRAINT "department_souls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."department_souls"
    ADD CONSTRAINT "department_souls_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."church_departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_tasks"
    ADD CONSTRAINT "department_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."department_tasks"
    ADD CONSTRAINT "department_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."department_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_departments"
    ADD CONSTRAINT "entity_departments_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_audit_logs"
    ADD CONSTRAINT "financial_audit_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."financial_audit_logs"
    ADD CONSTRAINT "financial_audit_logs_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."financial_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_entries"
    ADD CONSTRAINT "financial_entries_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_entries"
    ADD CONSTRAINT "financial_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."financial_entries"
    ADD CONSTRAINT "financial_entries_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."pastoral_appointments"
    ADD CONSTRAINT "pastoral_appointments_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pastoral_appointments"
    ADD CONSTRAINT "pastoral_appointments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."pastoral_availabilities"
    ADD CONSTRAINT "pastoral_availabilities_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pastoral_prayer_requests"
    ADD CONSTRAINT "pastoral_prayer_requests_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pastoral_prayer_requests"
    ADD CONSTRAINT "pastoral_prayer_requests_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."pastoral_spiritual_notes"
    ADD CONSTRAINT "pastoral_spiritual_notes_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pastoral_spiritual_notes"
    ADD CONSTRAINT "pastoral_spiritual_notes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."church_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pastoral_spiritual_notes"
    ADD CONSTRAINT "pastoral_spiritual_notes_pastor_id_fkey" FOREIGN KEY ("pastor_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."region_departments"
    ADD CONSTRAINT "region_departments_community_dept_id_fkey" FOREIGN KEY ("community_dept_id") REFERENCES "public"."community_departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."region_departments"
    ADD CONSTRAINT "region_departments_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."region_departments"
    ADD CONSTRAINT "region_departments_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."regions"
    ADD CONSTRAINT "regions_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."church_departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Acces meetings" ON "public"."department_meetings" FOR SELECT TO "authenticated" USING (("community_id" = "public"."get_current_user_community_id"()));



CREATE POLICY "Acces membres eglise" ON "public"."church_members" TO "authenticated" USING (("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'CHURCH_LEADER'::"public"."role_level")))));



CREATE POLICY "Accès exclusif leader notes" ON "public"."pastoral_spiritual_notes" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'CHURCH_LEADER'::"public"."role_level"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'CHURCH_LEADER'::"public"."role_level")))));



CREATE POLICY "Admin Communauté peut insérer des régions" ON "public"."regions" FOR INSERT WITH CHECK ("public"."has_role"('COMMUNITY_ADMIN'::"public"."role_level"));



CREATE POLICY "Admin Communauté peut modifier ses régions" ON "public"."regions" FOR UPDATE USING ("public"."has_role"('COMMUNITY_ADMIN'::"public"."role_level"));



CREATE POLICY "Admin Communauté peut supprimer ses régions" ON "public"."regions" FOR DELETE USING ("public"."has_role"('COMMUNITY_ADMIN'::"public"."role_level"));



CREATE POLICY "Autoriser l'insertion pour les utilisateurs connectés" ON "public"."financial_audit_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Autoriser la lecture pour les utilisateurs connectés" ON "public"."financial_audit_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Church leaders can manage their departments" ON "public"."church_departments" TO "authenticated" USING (("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['CHURCH_LEADER'::"public"."role_level", 'SECRETARY'::"public"."role_level"])))))) WITH CHECK (("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['CHURCH_LEADER'::"public"."role_level", 'SECRETARY'::"public"."role_level"]))))));



CREATE POLICY "Church staff can view their departments" ON "public"."church_departments" FOR SELECT TO "authenticated" USING ((("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['CHURCH_LEADER'::"public"."role_level", 'SECRETARY'::"public"."role_level", 'FINANCE_MANAGER'::"public"."role_level"]))))) OR ("id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'DEPARTMENT_LEADER'::"public"."role_level"))))));



CREATE POLICY "Creation propre fiche membre" ON "public"."church_members" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Creation propre profil" ON "public"."user_profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Dept Leader read members" ON "public"."church_members" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'DEPARTMENT_LEADER'::"public"."role_level") AND ("user_roles"."entity_id" = "church_members"."church_id")))));



CREATE POLICY "Dept Leader update members" ON "public"."department_members" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'DEPARTMENT_LEADER'::"public"."role_level") AND ("user_roles"."department_id" = "department_members"."department_id")))));



CREATE POLICY "Eglises voient et creent paiements" ON "public"."church_payments" TO "authenticated" USING (("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'CHURCH_LEADER'::"public"."role_level")))));



CREATE POLICY "Enable all for authenticated users" ON "public"."department_children" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Envoi de messages" ON "public"."broadcast_messages" FOR INSERT TO "authenticated" WITH CHECK (("community_id" = "public"."get_current_user_community_id"()));



CREATE POLICY "Fideles peuvent postuler" ON "public"."department_members" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Fideles peuvent voir leurs groupes" ON "public"."department_members" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Fidèles lisent leur fiche" ON "public"."church_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Fidèles modifient leur fiche" ON "public"."church_members" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Fidèles voient agenda" ON "public"."pastoral_availabilities" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Fidèles voient departements" ON "public"."church_departments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Fidèles voient les annonces" ON "public"."church_announcements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Fidèles voient les programmes" ON "public"."church_programs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Gestion Planning Groups" ON "public"."department_planning_groups" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Gestion Plannings" ON "public"."department_plannings" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Gestion RDV personnel" ON "public"."pastoral_appointments" TO "authenticated" USING ((("member_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'CHURCH_LEADER'::"public"."role_level"))))));



CREATE POLICY "Gestion complète annonces pasteur" ON "public"."church_announcements" TO "authenticated" USING (("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'CHURCH_LEADER'::"public"."role_level")))));



CREATE POLICY "Gestion complète programmes pasteur" ON "public"."church_programs" TO "authenticated" USING (("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'CHURCH_LEADER'::"public"."role_level")))));



CREATE POLICY "Gestion dept comm" ON "public"."community_departments" TO "authenticated" USING (("community_id" = "public"."get_current_user_community_id"())) WITH CHECK (("community_id" = "public"."get_current_user_community_id"()));



CREATE POLICY "Gestion des ames" ON "public"."department_souls" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Gestion disponibilités pasteur" ON "public"."pastoral_availabilities" TO "authenticated" USING (("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'CHURCH_LEADER'::"public"."role_level"))))) WITH CHECK (("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'CHURCH_LEADER'::"public"."role_level")))));



CREATE POLICY "Gestion finance eglise" ON "public"."financial_entries" TO "authenticated" USING (("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['CHURCH_LEADER'::"public"."role_level", 'FINANCE_MANAGER'::"public"."role_level"]))))));



CREATE POLICY "Gestion financiere dept" ON "public"."department_finances" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Gestion globale" ON "public"."global_departments" TO "authenticated" USING ("public"."has_role"('SUPER_ADMIN'::"public"."role_level"));



CREATE POLICY "Gestion meetings" ON "public"."department_meetings" TO "authenticated" USING (("community_id" = "public"."get_current_user_community_id"()));



CREATE POLICY "Gestion prières personnelles" ON "public"."pastoral_prayer_requests" TO "authenticated" USING ((("member_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'CHURCH_LEADER'::"public"."role_level"))))));



CREATE POLICY "Gestion region_dept" ON "public"."region_departments" TO "authenticated" USING (("region_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'REGION_MANAGER'::"public"."role_level")))));



CREATE POLICY "Insertion annonces pasteur" ON "public"."church_announcements" FOR INSERT TO "authenticated" WITH CHECK (("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'CHURCH_LEADER'::"public"."role_level")))));



CREATE POLICY "Insertion demande RDV" ON "public"."pastoral_appointments" FOR INSERT TO "authenticated" WITH CHECK ((("member_id" = "auth"."uid"()) AND ("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Insertion programmes pasteur" ON "public"."church_programs" FOR INSERT TO "authenticated" WITH CHECK (("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'CHURCH_LEADER'::"public"."role_level")))));



CREATE POLICY "Leader create announcements" ON "public"."department_announcements" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'DEPARTMENT_LEADER'::"public"."role_level") AND ("user_roles"."department_id" = "department_announcements"."department_id")))));



CREATE POLICY "Leader create groups" ON "public"."department_groups" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'DEPARTMENT_LEADER'::"public"."role_level") AND ("user_roles"."department_id" = "department_groups"."department_id")))));



CREATE POLICY "Leader create songs" ON "public"."department_songs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'DEPARTMENT_LEADER'::"public"."role_level") AND ("user_roles"."department_id" = "department_songs"."department_id")))));



CREATE POLICY "Leader delete groups" ON "public"."department_groups" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'DEPARTMENT_LEADER'::"public"."role_level") AND ("user_roles"."department_id" = "department_groups"."department_id")))));



CREATE POLICY "Leader delete songs" ON "public"."department_songs" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'DEPARTMENT_LEADER'::"public"."role_level") AND ("user_roles"."department_id" = "department_songs"."department_id")))));



CREATE POLICY "Leader link announcements" ON "public"."department_announcement_groups" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Leader read announcements" ON "public"."department_announcements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Leader update groups" ON "public"."department_groups" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'DEPARTMENT_LEADER'::"public"."role_level") AND ("user_roles"."department_id" = "department_groups"."department_id")))));



CREATE POLICY "Leader update songs" ON "public"."department_songs" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'DEPARTMENT_LEADER'::"public"."role_level") AND ("user_roles"."department_id" = "department_songs"."department_id")))));



CREATE POLICY "Lecture Planning Groups" ON "public"."department_planning_groups" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture Plannings" ON "public"."department_plannings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture church_departments" ON "public"."church_departments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture community_departments" ON "public"."community_departments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture dept comm" ON "public"."community_departments" FOR SELECT TO "authenticated" USING (("community_id" = "public"."get_current_user_community_id"()));



CREATE POLICY "Lecture des messages de ma communauté" ON "public"."broadcast_messages" FOR SELECT TO "authenticated" USING (("community_id" = "public"."get_current_user_community_id"()));



CREATE POLICY "Lecture globale" ON "public"."global_departments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture libre des ames" ON "public"."department_souls" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture libre des rôles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture pour les membres du dept" ON "public"."department_announcements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture pour les membres du dept" ON "public"."department_groups" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture pour les membres du dept" ON "public"."department_songs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture publique des profils" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture publique onboarding communautés" ON "public"."communities" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Lecture publique onboarding régions" ON "public"."regions" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Lecture region_dept" ON "public"."region_departments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Les admins peuvent modifier leur communauté" ON "public"."communities" FOR UPDATE TO "authenticated" USING ((("id" = "public"."get_current_user_community_id"()) AND "public"."has_role"('COMMUNITY_ADMIN'::"public"."role_level")));



CREATE POLICY "Les utilisateurs gèrent leurs propres lectures" ON "public"."broadcast_reads" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Les utilisateurs voient les départements entités de leur comm" ON "public"."entity_departments" FOR SELECT USING (("community_id" = "public"."get_current_user_community_id"()));



CREATE POLICY "Les utilisateurs voient les membres de leur communauté" ON "public"."user_profiles" FOR SELECT USING (("community_id" = "public"."get_current_user_community_id"()));



CREATE POLICY "Les utilisateurs voient les régions de leur communauté" ON "public"."regions" FOR SELECT USING (("community_id" = "public"."get_current_user_community_id"()));



CREATE POLICY "Les utilisateurs voient les églises de leur communauté" ON "public"."churches" FOR SELECT USING (("community_id" = "public"."get_current_user_community_id"()));



CREATE POLICY "Libre_Equipments" ON "public"."department_equipments" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Libre_Headcounts" ON "public"."department_headcounts" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Libre_Needs" ON "public"."department_equipment_needs" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Libre_Projects" ON "public"."department_projects" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Libre_Roles" ON "public"."department_planning_roles" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Libre_Tasks" ON "public"."department_tasks" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Members add group songs" ON "public"."department_songs" FOR INSERT TO "authenticated" WITH CHECK ((("group_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."department_members"
  WHERE (("department_members"."user_id" = "auth"."uid"()) AND ("department_members"."sub_group_id" = "department_songs"."group_id"))))));



CREATE POLICY "Modif church_departments" ON "public"."church_departments" TO "authenticated" USING (("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'CHURCH_LEADER'::"public"."role_level")))));



CREATE POLICY "Modification par les admins" ON "public"."user_roles" TO "authenticated" USING ("public"."check_is_admin"()) WITH CHECK ("public"."check_is_admin"());



CREATE POLICY "Public read church depts" ON "public"."church_departments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Public read church programs" ON "public"."church_programs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Public read for church codes" ON "public"."churches" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public read groups" ON "public"."department_groups" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Read link announcements" ON "public"."department_announcement_groups" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Secretariat gestion departements" ON "public"."church_departments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['CHURCH_LEADER'::"public"."role_level", 'SECRETARY'::"public"."role_level"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['CHURCH_LEADER'::"public"."role_level", 'SECRETARY'::"public"."role_level"]))))));



CREATE POLICY "Secretariat gestion membres" ON "public"."church_members" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['CHURCH_LEADER'::"public"."role_level", 'SECRETARY'::"public"."role_level"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['CHURCH_LEADER'::"public"."role_level", 'SECRETARY'::"public"."role_level"]))))));



CREATE POLICY "Secretariat update RDV" ON "public"."pastoral_appointments" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['CHURCH_LEADER'::"public"."role_level", 'SECRETARY'::"public"."role_level"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['CHURCH_LEADER'::"public"."role_level", 'SECRETARY'::"public"."role_level"]))))));



CREATE POLICY "Secretariat voir RDV" ON "public"."pastoral_appointments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['CHURCH_LEADER'::"public"."role_level", 'SECRETARY'::"public"."role_level"]))))));



CREATE POLICY "Sub-leader read members" ON "public"."department_members" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Sub-leader recruit members" ON "public"."department_members" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."department_groups"
  WHERE (("department_groups"."leader_id" = "auth"."uid"()) AND ("department_groups"."department_id" = "department_members"."department_id")))));



CREATE POLICY "SubLeader create announcements" ON "public"."department_announcements" FOR INSERT TO "authenticated" WITH CHECK (("group_id" IN ( SELECT "department_groups"."id"
   FROM "public"."department_groups"
  WHERE ("department_groups"."leader_id" = "auth"."uid"()))));



CREATE POLICY "SubLeader create plannings" ON "public"."department_plannings" FOR INSERT TO "authenticated" WITH CHECK (("group_id" IN ( SELECT "department_groups"."id"
   FROM "public"."department_groups"
  WHERE ("department_groups"."leader_id" = "auth"."uid"()))));



CREATE POLICY "SubLeader manage finances" ON "public"."department_finances" TO "authenticated" USING (("group_id" IN ( SELECT "department_groups"."id"
   FROM "public"."department_groups"
  WHERE ("department_groups"."leader_id" = "auth"."uid"())))) WITH CHECK (("group_id" IN ( SELECT "department_groups"."id"
   FROM "public"."department_groups"
  WHERE ("department_groups"."leader_id" = "auth"."uid"()))));



CREATE POLICY "SubLeader manage songs" ON "public"."department_songs" TO "authenticated" USING (("group_id" IN ( SELECT "department_groups"."id"
   FROM "public"."department_groups"
  WHERE ("department_groups"."leader_id" = "auth"."uid"())))) WITH CHECK (("group_id" IN ( SELECT "department_groups"."id"
   FROM "public"."department_groups"
  WHERE ("department_groups"."leader_id" = "auth"."uid"()))));



CREATE POLICY "Super Admin peut insérer des communautés" ON "public"."communities" FOR INSERT WITH CHECK ("public"."has_role"('SUPER_ADMIN'::"public"."role_level"));



CREATE POLICY "Super Admin peut modifier les communautés" ON "public"."communities" FOR UPDATE USING ("public"."has_role"('SUPER_ADMIN'::"public"."role_level"));



CREATE POLICY "Super Admin peut modifier les églises (suspension)" ON "public"."churches" FOR UPDATE USING ("public"."has_role"('SUPER_ADMIN'::"public"."role_level"));



CREATE POLICY "Super Admin peut supprimer des communautés" ON "public"."communities" FOR DELETE USING ("public"."has_role"('SUPER_ADMIN'::"public"."role_level"));



CREATE POLICY "Super Admin voit tout, les autres voient leur communauté" ON "public"."communities" FOR SELECT USING ((("id" = "public"."get_current_user_community_id"()) OR "public"."has_role"('SUPER_ADMIN'::"public"."role_level")));



CREATE POLICY "Super Admins gerent paiements" ON "public"."church_payments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'SUPER_ADMIN'::"public"."role_level")))));



CREATE POLICY "Supervision pastorale audit" ON "public"."financial_audit_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'CHURCH_LEADER'::"public"."role_level")))));



CREATE POLICY "Tout le monde peut voir les départements master" ON "public"."master_departments" FOR SELECT USING (true);



CREATE POLICY "Update church info for leaders" ON "public"."churches" FOR UPDATE TO "authenticated" USING (("id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'CHURCH_LEADER'::"public"."role_level"))))) WITH CHECK (("id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'CHURCH_LEADER'::"public"."role_level")))));



CREATE POLICY "Voir annonces eglise" ON "public"."church_announcements" FOR SELECT TO "authenticated" USING (("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Voir disponibilités eglise" ON "public"."pastoral_availabilities" FOR SELECT TO "authenticated" USING (("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Voir programmes eglise" ON "public"."church_programs" FOR SELECT TO "authenticated" USING (("church_id" IN ( SELECT "user_roles"."entity_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."broadcast_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."broadcast_reads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."church_announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."church_departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."church_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."church_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."church_programs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."churches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."communities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_announcement_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_children" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_equipment_needs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_equipments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_finances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_headcounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_meetings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_planning_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_planning_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_plannings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_songs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_souls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."global_departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."master_departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pastoral_appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pastoral_availabilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pastoral_prayer_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pastoral_spiritual_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."region_departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."regions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."check_is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_church_departments"("p_church_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_church_departments"("p_church_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_church_departments"("p_church_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_community_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_community_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_community_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("target_role" "public"."role_level") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("target_role" "public"."role_level") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("target_role" "public"."role_level") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_email_registered"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_email_registered"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_email_registered"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_member_to_auth"("p_email" "text", "p_user_id" "uuid", "p_church_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."link_member_to_auth"("p_email" "text", "p_user_id" "uuid", "p_church_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_member_to_auth"("p_email" "text", "p_user_id" "uuid", "p_church_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON TABLE "public"."broadcast_messages" TO "anon";
GRANT ALL ON TABLE "public"."broadcast_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcast_messages" TO "service_role";



GRANT ALL ON TABLE "public"."broadcast_reads" TO "anon";
GRANT ALL ON TABLE "public"."broadcast_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcast_reads" TO "service_role";



GRANT ALL ON TABLE "public"."church_announcements" TO "anon";
GRANT ALL ON TABLE "public"."church_announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."church_announcements" TO "service_role";



GRANT ALL ON TABLE "public"."church_departments" TO "anon";
GRANT ALL ON TABLE "public"."church_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."church_departments" TO "service_role";



GRANT ALL ON TABLE "public"."church_members" TO "anon";
GRANT ALL ON TABLE "public"."church_members" TO "authenticated";
GRANT ALL ON TABLE "public"."church_members" TO "service_role";



GRANT ALL ON TABLE "public"."church_payments" TO "anon";
GRANT ALL ON TABLE "public"."church_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."church_payments" TO "service_role";



GRANT ALL ON TABLE "public"."church_programs" TO "anon";
GRANT ALL ON TABLE "public"."church_programs" TO "authenticated";
GRANT ALL ON TABLE "public"."church_programs" TO "service_role";



GRANT ALL ON TABLE "public"."churches" TO "anon";
GRANT ALL ON TABLE "public"."churches" TO "authenticated";
GRANT ALL ON TABLE "public"."churches" TO "service_role";



GRANT ALL ON TABLE "public"."communities" TO "anon";
GRANT ALL ON TABLE "public"."communities" TO "authenticated";
GRANT ALL ON TABLE "public"."communities" TO "service_role";



GRANT ALL ON TABLE "public"."community_departments" TO "anon";
GRANT ALL ON TABLE "public"."community_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."community_departments" TO "service_role";



GRANT ALL ON TABLE "public"."department_announcement_groups" TO "anon";
GRANT ALL ON TABLE "public"."department_announcement_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."department_announcement_groups" TO "service_role";



GRANT ALL ON TABLE "public"."department_announcements" TO "anon";
GRANT ALL ON TABLE "public"."department_announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."department_announcements" TO "service_role";



GRANT ALL ON TABLE "public"."department_children" TO "anon";
GRANT ALL ON TABLE "public"."department_children" TO "authenticated";
GRANT ALL ON TABLE "public"."department_children" TO "service_role";



GRANT ALL ON TABLE "public"."department_equipment_needs" TO "anon";
GRANT ALL ON TABLE "public"."department_equipment_needs" TO "authenticated";
GRANT ALL ON TABLE "public"."department_equipment_needs" TO "service_role";



GRANT ALL ON TABLE "public"."department_equipments" TO "anon";
GRANT ALL ON TABLE "public"."department_equipments" TO "authenticated";
GRANT ALL ON TABLE "public"."department_equipments" TO "service_role";



GRANT ALL ON TABLE "public"."department_finances" TO "anon";
GRANT ALL ON TABLE "public"."department_finances" TO "authenticated";
GRANT ALL ON TABLE "public"."department_finances" TO "service_role";



GRANT ALL ON TABLE "public"."department_groups" TO "anon";
GRANT ALL ON TABLE "public"."department_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."department_groups" TO "service_role";



GRANT ALL ON TABLE "public"."department_headcounts" TO "anon";
GRANT ALL ON TABLE "public"."department_headcounts" TO "authenticated";
GRANT ALL ON TABLE "public"."department_headcounts" TO "service_role";



GRANT ALL ON TABLE "public"."department_meetings" TO "anon";
GRANT ALL ON TABLE "public"."department_meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."department_meetings" TO "service_role";



GRANT ALL ON TABLE "public"."department_members" TO "anon";
GRANT ALL ON TABLE "public"."department_members" TO "authenticated";
GRANT ALL ON TABLE "public"."department_members" TO "service_role";



GRANT ALL ON TABLE "public"."department_planning_groups" TO "anon";
GRANT ALL ON TABLE "public"."department_planning_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."department_planning_groups" TO "service_role";



GRANT ALL ON TABLE "public"."department_planning_roles" TO "anon";
GRANT ALL ON TABLE "public"."department_planning_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."department_planning_roles" TO "service_role";



GRANT ALL ON TABLE "public"."department_plannings" TO "anon";
GRANT ALL ON TABLE "public"."department_plannings" TO "authenticated";
GRANT ALL ON TABLE "public"."department_plannings" TO "service_role";



GRANT ALL ON TABLE "public"."department_projects" TO "anon";
GRANT ALL ON TABLE "public"."department_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."department_projects" TO "service_role";



GRANT ALL ON TABLE "public"."department_songs" TO "anon";
GRANT ALL ON TABLE "public"."department_songs" TO "authenticated";
GRANT ALL ON TABLE "public"."department_songs" TO "service_role";



GRANT ALL ON TABLE "public"."department_souls" TO "anon";
GRANT ALL ON TABLE "public"."department_souls" TO "authenticated";
GRANT ALL ON TABLE "public"."department_souls" TO "service_role";



GRANT ALL ON TABLE "public"."department_tasks" TO "anon";
GRANT ALL ON TABLE "public"."department_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."department_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."entity_departments" TO "anon";
GRANT ALL ON TABLE "public"."entity_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_departments" TO "service_role";



GRANT ALL ON TABLE "public"."financial_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."financial_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."financial_entries" TO "anon";
GRANT ALL ON TABLE "public"."financial_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_entries" TO "service_role";



GRANT ALL ON TABLE "public"."global_departments" TO "anon";
GRANT ALL ON TABLE "public"."global_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."global_departments" TO "service_role";



GRANT ALL ON TABLE "public"."master_departments" TO "anon";
GRANT ALL ON TABLE "public"."master_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."master_departments" TO "service_role";



GRANT ALL ON TABLE "public"."pastoral_appointments" TO "anon";
GRANT ALL ON TABLE "public"."pastoral_appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."pastoral_appointments" TO "service_role";



GRANT ALL ON TABLE "public"."pastoral_availabilities" TO "anon";
GRANT ALL ON TABLE "public"."pastoral_availabilities" TO "authenticated";
GRANT ALL ON TABLE "public"."pastoral_availabilities" TO "service_role";



GRANT ALL ON TABLE "public"."pastoral_prayer_requests" TO "anon";
GRANT ALL ON TABLE "public"."pastoral_prayer_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."pastoral_prayer_requests" TO "service_role";



GRANT ALL ON TABLE "public"."pastoral_spiritual_notes" TO "anon";
GRANT ALL ON TABLE "public"."pastoral_spiritual_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."pastoral_spiritual_notes" TO "service_role";



GRANT ALL ON TABLE "public"."region_departments" TO "anon";
GRANT ALL ON TABLE "public"."region_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."region_departments" TO "service_role";



GRANT ALL ON TABLE "public"."regions" TO "anon";
GRANT ALL ON TABLE "public"."regions" TO "authenticated";
GRANT ALL ON TABLE "public"."regions" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



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







