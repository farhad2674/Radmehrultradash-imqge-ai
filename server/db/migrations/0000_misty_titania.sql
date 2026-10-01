CREATE TYPE "public"."account_status" AS ENUM('PENDING', 'ACTIVE', 'DISABLED');--> statement-breakpoint
CREATE TYPE "public"."account_token_purpose" AS ENUM('ACTIVATE_ACCOUNT', 'RESET_PASSWORD');--> statement-breakpoint
CREATE TYPE "public"."asset_visibility" AS ENUM('OWNER_ONLY', 'COMPANY');--> statement-breakpoint
CREATE TYPE "public"."audit_outcome" AS ENUM('SUCCESS', 'FAILURE', 'DENIED');--> statement-breakpoint
CREATE TYPE "public"."generation_status" AS ENUM('RESERVED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."storage_backend" AS ENUM('LOCAL', 'OBJECT', 'EXTERNAL_URL');--> statement-breakpoint
CREATE TYPE "public"."template_status" AS ENUM('DRAFT', 'ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."template_visibility" AS ENUM('ALL_USERS', 'RESTRICTED', 'ADMIN_ONLY');--> statement-breakpoint
CREATE TYPE "public"."usage_event_type" AS ENUM('RESERVATION_CREATED', 'RESERVATION_CONSUMED', 'RESERVATION_RELEASED', 'ADMIN_ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SUPER_ADMIN', 'USER');--> statement-breakpoint
CREATE TABLE "account_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "account_token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"workspace_name" text NOT NULL,
	"company_timezone" text NOT NULL,
	"session_idle_seconds" integer DEFAULT 28800 NOT NULL,
	"session_absolute_seconds" integer DEFAULT 604800 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "application_settings_singleton" CHECK ("application_settings"."id" = 1),
	CONSTRAINT "application_settings_idle_positive" CHECK ("application_settings"."session_idle_seconds" > 0),
	CONSTRAINT "application_settings_absolute_positive" CHECK ("application_settings"."session_absolute_seconds" > 0),
	CONSTRAINT "application_settings_expiry_order" CHECK ("application_settings"."session_idle_seconds" <= "application_settings"."session_absolute_seconds")
);
--> statement-breakpoint
CREATE TABLE "asset_bookmarks" (
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_bookmarks_user_id_asset_id_pk" PRIMARY KEY("user_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"generation_job_id" uuid,
	"owner_user_id" uuid NOT NULL,
	"template_id" uuid,
	"provider" text NOT NULL,
	"provider_model" text NOT NULL,
	"prompt_snapshot" text NOT NULL,
	"aspect_ratio" text NOT NULL,
	"storage_backend" "storage_backend" NOT NULL,
	"storage_location" text NOT NULL,
	"mime_type" text,
	"byte_size" bigint,
	"width" integer,
	"height" integer,
	"checksum_sha256" text,
	"visibility" "asset_visibility" DEFAULT 'OWNER_ONLY' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "assets_byte_size_positive" CHECK ("assets"."byte_size" is null OR "assets"."byte_size" > 0),
	CONSTRAINT "assets_width_positive" CHECK ("assets"."width" is null OR "assets"."width" > 0),
	CONSTRAINT "assets_height_positive" CHECK ("assets"."height" is null OR "assets"."height" > 0),
	CONSTRAINT "assets_delete_actor_consistency" CHECK (("assets"."deleted_at" is null) = ("assets"."deleted_by" is null))
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"subject_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"outcome" "audit_outcome" NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"template_id" uuid,
	"quota_period_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider" text NOT NULL,
	"provider_model" text NOT NULL,
	"provider_request_id" text,
	"prompt_snapshot" text NOT NULL,
	"aspect_ratio" text NOT NULL,
	"resolution" text,
	"reference_location" text,
	"request_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "generation_status" DEFAULT 'RESERVED' NOT NULL,
	"reservation_units" integer DEFAULT 1 NOT NULL,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "generation_jobs_one_unit" CHECK ("generation_jobs"."reservation_units" = 1)
);
--> statement-breakpoint
CREATE TABLE "quota_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"quota_units" integer NOT NULL,
	"reserved_units" integer DEFAULT 0 NOT NULL,
	"consumed_units" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quota_periods_date_order" CHECK ("quota_periods"."period_end" > "quota_periods"."period_start"),
	CONSTRAINT "quota_periods_quota_nonnegative" CHECK ("quota_periods"."quota_units" >= 0),
	CONSTRAINT "quota_periods_reserved_nonnegative" CHECK ("quota_periods"."reserved_units" >= 0),
	CONSTRAINT "quota_periods_consumed_nonnegative" CHECK ("quota_periods"."consumed_units" >= 0),
	CONSTRAINT "quota_periods_balance" CHECK ("quota_periods"."reserved_units" + "quota_periods"."consumed_units" <= "quota_periods"."quota_units")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"session_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_address" "inet",
	"user_agent" text,
	CONSTRAINT "sessions_expiry_order" CHECK ("sessions"."idle_expires_at" <= "sessions"."absolute_expires_at")
);
--> statement-breakpoint
CREATE TABLE "template_user_permissions" (
	"template_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"can_view" boolean DEFAULT true NOT NULL,
	"can_generate" boolean DEFAULT true NOT NULL,
	"granted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_user_permissions_template_id_user_id_pk" PRIMARY KEY("template_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"execution_model" text NOT NULL,
	"description" text NOT NULL,
	"base_prompt" text NOT NULL,
	"variable_mode" text,
	"prompt_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"field_permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"default_variable_value" text,
	"default_appliance_object" text,
	"default_title_overlay" text,
	"default_environment" text,
	"default_mood_lighting" text,
	"default_color_material" text,
	"reference_location" text,
	"resolution" text,
	"thumbnail_location" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"visibility" "template_visibility" DEFAULT 'ADMIN_ONLY' NOT NULL,
	"require_approval" boolean DEFAULT false NOT NULL,
	"status" "template_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "templates_archive_state" CHECK ("templates"."status" <> 'ARCHIVED' OR "templates"."archived_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "usage_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quota_period_id" uuid NOT NULL,
	"generation_job_id" uuid,
	"event_type" "usage_event_type" NOT NULL,
	"reserved_delta" integer DEFAULT 0 NOT NULL,
	"consumed_delta" integer DEFAULT 0 NOT NULL,
	"actor_user_id" uuid,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_ledger_nonzero_delta" CHECK ("usage_ledger"."reserved_delta" <> 0 OR "usage_ledger"."consumed_delta" <> 0),
	CONSTRAINT "usage_ledger_admin_adjustment_actor" CHECK ("usage_ledger"."event_type" <> 'ADMIN_ADJUSTMENT' OR ("usage_ledger"."actor_user_id" is not null AND "usage_ledger"."reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"department" text,
	"avatar_location" text,
	"password_hash" text,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"api_access" boolean DEFAULT false NOT NULL,
	"monthly_quota" integer DEFAULT 0 NOT NULL,
	"status" "account_status" DEFAULT 'PENDING' NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"legacy_id" text,
	CONSTRAINT "users_monthly_quota_nonnegative" CHECK ("users"."monthly_quota" >= 0),
	CONSTRAINT "users_session_version_positive" CHECK ("users"."session_version" >= 1),
	CONSTRAINT "users_active_requires_password" CHECK ("users"."status" <> 'ACTIVE' OR "users"."password_hash" is not null)
);
--> statement-breakpoint
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_settings" ADD CONSTRAINT "application_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_bookmarks" ADD CONSTRAINT "asset_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_bookmarks" ADD CONSTRAINT "asset_bookmarks_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_generation_job_id_generation_jobs_id_fk" FOREIGN KEY ("generation_job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_quota_period_id_quota_periods_id_fk" FOREIGN KEY ("quota_period_id") REFERENCES "public"."quota_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_periods" ADD CONSTRAINT "quota_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_user_permissions" ADD CONSTRAINT "template_user_permissions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_user_permissions" ADD CONSTRAINT "template_user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_user_permissions" ADD CONSTRAINT "template_user_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_quota_period_id_quota_periods_id_fk" FOREIGN KEY ("quota_period_id") REFERENCES "public"."quota_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_generation_job_id_generation_jobs_id_fk" FOREIGN KEY ("generation_job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_tokens_token_hash_unique" ON "account_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "account_tokens_user_purpose_consumed_idx" ON "account_tokens" USING btree ("user_id","purpose","consumed_at");--> statement-breakpoint
CREATE INDEX "account_tokens_expires_idx" ON "account_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "asset_bookmarks_asset_created_idx" ON "asset_bookmarks" USING btree ("asset_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_legacy_id_unique" ON "assets" USING btree ("legacy_id") WHERE "assets"."legacy_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_generation_job_unique" ON "assets" USING btree ("generation_job_id") WHERE "assets"."generation_job_id" is not null;--> statement-breakpoint
CREATE INDEX "assets_owner_created_active_idx" ON "assets" USING btree ("owner_user_id","created_at") WHERE "assets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "assets_visibility_created_active_idx" ON "assets" USING btree ("visibility","created_at") WHERE "assets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "assets_template_idx" ON "assets" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "assets_deleted_at_idx" ON "assets" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_created_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_subject_created_idx" ON "audit_logs" USING btree ("subject_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_created_idx" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_jobs_user_idempotency_unique" ON "generation_jobs" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_jobs_provider_request_unique" ON "generation_jobs" USING btree ("provider","provider_request_id") WHERE "generation_jobs"."provider_request_id" is not null;--> statement-breakpoint
CREATE INDEX "generation_jobs_user_created_idx" ON "generation_jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "generation_jobs_status_expires_idx" ON "generation_jobs" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "generation_jobs_template_idx" ON "generation_jobs" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "generation_jobs_quota_period_idx" ON "generation_jobs" USING btree ("quota_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quota_periods_user_start_unique" ON "quota_periods" USING btree ("user_id","period_start");--> statement-breakpoint
CREATE INDEX "quota_periods_user_start_idx" ON "quota_periods" USING btree ("user_id","period_start");--> statement-breakpoint
CREATE INDEX "quota_periods_end_idx" ON "quota_periods" USING btree ("period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_revoked_idx" ON "sessions" USING btree ("user_id","revoked_at");--> statement-breakpoint
CREATE INDEX "sessions_idle_expires_idx" ON "sessions" USING btree ("idle_expires_at");--> statement-breakpoint
CREATE INDEX "sessions_absolute_expires_idx" ON "sessions" USING btree ("absolute_expires_at");--> statement-breakpoint
CREATE INDEX "template_user_permissions_user_idx" ON "template_user_permissions" USING btree ("user_id","can_view","can_generate");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_legacy_id_unique" ON "templates" USING btree ("legacy_id") WHERE "templates"."legacy_id" is not null;--> statement-breakpoint
CREATE INDEX "templates_status_visibility_idx" ON "templates" USING btree ("status","visibility");--> statement-breakpoint
CREATE INDEX "templates_category_idx" ON "templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "templates_execution_model_idx" ON "templates" USING btree ("execution_model");--> statement-breakpoint
CREATE INDEX "templates_created_at_idx" ON "templates" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_ledger_job_event_unique" ON "usage_ledger" USING btree ("generation_job_id","event_type") WHERE "usage_ledger"."generation_job_id" is not null;--> statement-breakpoint
CREATE INDEX "usage_ledger_user_created_idx" ON "usage_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_ledger_period_created_idx" ON "usage_ledger" USING btree ("quota_period_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_ledger_job_idx" ON "usage_ledger" USING btree ("generation_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_unique" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_legacy_id_unique" ON "users" USING btree ("legacy_id") WHERE "users"."legacy_id" is not null;--> statement-breakpoint
CREATE INDEX "users_status_role_idx" ON "users" USING btree ("status","role");--> statement-breakpoint
CREATE INDEX "users_api_access_status_idx" ON "users" USING btree ("api_access","status");--> statement-breakpoint
CREATE INDEX "users_created_by_idx" ON "users" USING btree ("created_by");
--> statement-breakpoint
CREATE FUNCTION "protect_last_super_admin"() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('radmehr_ai_super_admin_membership'));

  IF OLD.role = 'SUPER_ADMIN' AND OLD.status = 'ACTIVE'
     AND (NEW.role <> 'SUPER_ADMIN' OR NEW.status <> 'ACTIVE')
     AND NOT EXISTS (
       SELECT 1
       FROM users
       WHERE id <> OLD.id
         AND role = 'SUPER_ADMIN'
         AND status = 'ACTIVE'
     ) THEN
    RAISE EXCEPTION 'The last active SUPER_ADMIN cannot be disabled or demoted.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "users_protect_last_super_admin"
BEFORE UPDATE OF role, status ON users
FOR EACH ROW EXECUTE FUNCTION "protect_last_super_admin"();
--> statement-breakpoint
CREATE FUNCTION "prevent_user_hard_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Users cannot be deleted; disable the account instead.';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "users_prevent_hard_delete"
BEFORE DELETE ON users
FOR EACH ROW EXECUTE FUNCTION "prevent_user_hard_delete"();
--> statement-breakpoint
CREATE FUNCTION "prevent_append_only_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only and cannot be updated or deleted.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "usage_ledger_append_only"
BEFORE UPDATE OR DELETE ON usage_ledger
FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
--> statement-breakpoint
CREATE TRIGGER "audit_logs_append_only"
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
