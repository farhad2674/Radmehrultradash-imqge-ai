import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

export const userRoleEnum = pgEnum('user_role', ['SUPER_ADMIN', 'USER']);
export const authRateLimits = pgTable('auth_rate_limits', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, table => [index('auth_rate_limits_expires_idx').on(table.expiresAt)]);
export const accountStatusEnum = pgEnum('account_status', ['PENDING', 'ACTIVE', 'DISABLED']);
export const accountTokenPurposeEnum = pgEnum('account_token_purpose', ['ACTIVATE_ACCOUNT', 'RESET_PASSWORD']);
export const templateVisibilityEnum = pgEnum('template_visibility', ['ALL_USERS', 'RESTRICTED', 'ADMIN_ONLY']);
export const templateStatusEnum = pgEnum('template_status', ['DRAFT', 'ACTIVE', 'ARCHIVED']);
export const generationStatusEnum = pgEnum('generation_status', [
  'RESERVED',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
]);
export const usageEventTypeEnum = pgEnum('usage_event_type', [
  'RESERVATION_CREATED',
  'RESERVATION_CONSUMED',
  'RESERVATION_RELEASED',
  'ADMIN_ADJUSTMENT',
]);
export const assetVisibilityEnum = pgEnum('asset_visibility', ['OWNER_ONLY', 'COMPANY']);
export const storageBackendEnum = pgEnum('storage_backend', ['LOCAL', 'OBJECT', 'EXTERNAL_URL']);
export const auditOutcomeEnum = pgEnum('audit_outcome', ['SUCCESS', 'FAILURE', 'DENIED']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: text('username').notNull(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  department: text('department'),
  avatarLocation: text('avatar_location'),
  passwordHash: text('password_hash'),
  role: userRoleEnum('role').default('USER').notNull(),
  apiAccess: boolean('api_access').default(false).notNull(),
  monthlyQuota: integer('monthly_quota').default(0).notNull(),
  status: accountStatusEnum('status').default('PENDING').notNull(),
  mustChangePassword: boolean('must_change_password').default(true).notNull(),
  sessionVersion: integer('session_version').default(1).notNull(),
  createdBy: uuid('created_by').references((): AnyPgColumn => users.id, { onDelete: 'restrict' }),
  ...timestamps,
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  legacyId: text('legacy_id'),
}, (table) => [
  uniqueIndex('users_username_lower_unique').on(sql`lower(${table.username})`),
  uniqueIndex('users_email_lower_unique').on(sql`lower(${table.email})`),
  uniqueIndex('users_legacy_id_unique').on(table.legacyId).where(sql`${table.legacyId} is not null`),
  index('users_status_role_idx').on(table.status, table.role),
  index('users_api_access_status_idx').on(table.apiAccess, table.status),
  index('users_created_by_idx').on(table.createdBy),
  check('users_monthly_quota_nonnegative', sql`${table.monthlyQuota} >= 0`),
  check('users_session_version_positive', sql`${table.sessionVersion} >= 1`),
  check('users_active_requires_password', sql`${table.status} <> 'ACTIVE' OR ${table.passwordHash} is not null`),
]);

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tokenHash: text('token_hash').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionVersion: integer('session_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  idleExpiresAt: timestamp('idle_expires_at', { withTimezone: true }).notNull(),
  absoluteExpiresAt: timestamp('absolute_expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
}, (table) => [
  uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
  index('sessions_user_revoked_idx').on(table.userId, table.revokedAt),
  index('sessions_idle_expires_idx').on(table.idleExpiresAt),
  index('sessions_absolute_expires_idx').on(table.absoluteExpiresAt),
  check('sessions_expiry_order', sql`${table.idleExpiresAt} <= ${table.absoluteExpiresAt}`),
]);

export const accountTokens = pgTable('account_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: accountTokenPurposeEnum('purpose').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('account_tokens_token_hash_unique').on(table.tokenHash),
  index('account_tokens_user_purpose_consumed_idx').on(table.userId, table.purpose, table.consumedAt),
  index('account_tokens_expires_idx').on(table.expiresAt),
]);

export const applicationSettings = pgTable('application_settings', {
  id: smallint('id').default(1).primaryKey(),
  workspaceName: text('workspace_name').notNull(),
  companyTimezone: text('company_timezone').notNull(),
  sessionIdleSeconds: integer('session_idle_seconds').default(28_800).notNull(),
  sessionAbsoluteSeconds: integer('session_absolute_seconds').default(604_800).notNull(),
  ...timestamps,
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'restrict' }),
}, (table) => [
  check('application_settings_singleton', sql`${table.id} = 1`),
  check('application_settings_idle_positive', sql`${table.sessionIdleSeconds} > 0`),
  check('application_settings_absolute_positive', sql`${table.sessionAbsoluteSeconds} > 0`),
  check('application_settings_expiry_order', sql`${table.sessionIdleSeconds} <= ${table.sessionAbsoluteSeconds}`),
]);

export const templates = pgTable('templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  legacyId: text('legacy_id'),
  name: text('name').notNull(),
  category: text('category').notNull(),
  executionModel: text('execution_model').notNull(),
  description: text('description').notNull(),
  basePrompt: text('base_prompt').notNull(),
  variableMode: text('variable_mode'),
  promptConfig: jsonb('prompt_config').$type<Record<string, unknown>>().default({}).notNull(),
  fieldPermissions: jsonb('field_permissions').$type<Record<string, unknown>>().default({}).notNull(),
  defaultVariableValue: text('default_variable_value'),
  defaultApplianceObject: text('default_appliance_object'),
  defaultTitleOverlay: text('default_title_overlay'),
  defaultEnvironment: text('default_environment'),
  defaultMoodLighting: text('default_mood_lighting'),
  defaultColorMaterial: text('default_color_material'),
  referenceLocation: text('reference_location'),
  resolution: text('resolution'),
  thumbnailLocation: text('thumbnail_location'),
  tags: text('tags').array().default(sql`'{}'::text[]`).notNull(),
  visibility: templateVisibilityEnum('visibility').default('ADMIN_ONLY').notNull(),
  requireApproval: boolean('require_approval').default(false).notNull(),
  status: templateStatusEnum('status').default('DRAFT').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  updatedBy: uuid('updated_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  ...timestamps,
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('templates_legacy_id_unique').on(table.legacyId).where(sql`${table.legacyId} is not null`),
  index('templates_status_visibility_idx').on(table.status, table.visibility),
  index('templates_category_idx').on(table.category),
  index('templates_execution_model_idx').on(table.executionModel),
  index('templates_created_at_idx').on(table.createdAt),
  check('templates_archive_state', sql`${table.status} <> 'ARCHIVED' OR ${table.archivedAt} is not null`),
]);

export const templateUserPermissions = pgTable('template_user_permissions', {
  templateId: uuid('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  canView: boolean('can_view').default(true).notNull(),
  canGenerate: boolean('can_generate').default(true).notNull(),
  grantedBy: uuid('granted_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.templateId, table.userId] }),
  index('template_user_permissions_user_idx').on(table.userId, table.canView, table.canGenerate),
]);

export const quotaPeriods = pgTable('quota_periods', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  periodStart: date('period_start', { mode: 'string' }).notNull(),
  periodEnd: date('period_end', { mode: 'string' }).notNull(),
  quotaUnits: integer('quota_units').notNull(),
  reservedUnits: integer('reserved_units').default(0).notNull(),
  consumedUnits: integer('consumed_units').default(0).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex('quota_periods_user_start_unique').on(table.userId, table.periodStart),
  index('quota_periods_user_start_idx').on(table.userId, table.periodStart),
  index('quota_periods_end_idx').on(table.periodEnd),
  check('quota_periods_date_order', sql`${table.periodEnd} > ${table.periodStart}`),
  check('quota_periods_quota_nonnegative', sql`${table.quotaUnits} >= 0`),
  check('quota_periods_reserved_nonnegative', sql`${table.reservedUnits} >= 0`),
  check('quota_periods_consumed_nonnegative', sql`${table.consumedUnits} >= 0`),
  check('quota_periods_balance', sql`${table.reservedUnits} + ${table.consumedUnits} <= ${table.quotaUnits}`),
]);

export const generationJobs = pgTable('generation_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  templateId: uuid('template_id').references(() => templates.id, { onDelete: 'set null' }),
  quotaPeriodId: uuid('quota_period_id').notNull().references(() => quotaPeriods.id, { onDelete: 'restrict' }),
  idempotencyKey: text('idempotency_key').notNull(),
  provider: text('provider').notNull(),
  providerModel: text('provider_model').notNull(),
  providerRequestId: text('provider_request_id'),
  promptSnapshot: text('prompt_snapshot').notNull(),
  aspectRatio: text('aspect_ratio').notNull(),
  resolution: text('resolution'),
  referenceLocation: text('reference_location'),
  requestMetadata: jsonb('request_metadata').$type<Record<string, unknown>>().default({}).notNull(),
  status: generationStatusEnum('status').default('RESERVED').notNull(),
  reservationUnits: integer('reservation_units').default(1).notNull(),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => [
  uniqueIndex('generation_jobs_user_idempotency_unique').on(table.userId, table.idempotencyKey),
  uniqueIndex('generation_jobs_provider_request_unique')
    .on(table.provider, table.providerRequestId)
    .where(sql`${table.providerRequestId} is not null`),
  index('generation_jobs_user_created_idx').on(table.userId, table.createdAt),
  index('generation_jobs_status_expires_idx').on(table.status, table.expiresAt),
  index('generation_jobs_template_idx').on(table.templateId),
  index('generation_jobs_quota_period_idx').on(table.quotaPeriodId),
  check('generation_jobs_one_unit', sql`${table.reservationUnits} = 1`),
]);

export const assets = pgTable('assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  legacyId: text('legacy_id'),
  generationJobId: uuid('generation_job_id').references(() => generationJobs.id, { onDelete: 'restrict' }),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  templateId: uuid('template_id').references(() => templates.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  providerModel: text('provider_model').notNull(),
  promptSnapshot: text('prompt_snapshot').notNull(),
  aspectRatio: text('aspect_ratio').notNull(),
  storageBackend: storageBackendEnum('storage_backend').notNull(),
  storageLocation: text('storage_location').notNull(),
  mimeType: text('mime_type'),
  byteSize: bigint('byte_size', { mode: 'number' }),
  width: integer('width'),
  height: integer('height'),
  checksumSha256: text('checksum_sha256'),
  visibility: assetVisibilityEnum('visibility').default('OWNER_ONLY').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by').references(() => users.id, { onDelete: 'restrict' }),
}, (table) => [
  uniqueIndex('assets_legacy_id_unique').on(table.legacyId).where(sql`${table.legacyId} is not null`),
  uniqueIndex('assets_generation_job_unique').on(table.generationJobId).where(sql`${table.generationJobId} is not null`),
  index('assets_owner_created_active_idx').on(table.ownerUserId, table.createdAt).where(sql`${table.deletedAt} is null`),
  index('assets_visibility_created_active_idx').on(table.visibility, table.createdAt).where(sql`${table.deletedAt} is null`),
  index('assets_template_idx').on(table.templateId),
  index('assets_deleted_at_idx').on(table.deletedAt),
  check('assets_byte_size_positive', sql`${table.byteSize} is null OR ${table.byteSize} > 0`),
  check('assets_width_positive', sql`${table.width} is null OR ${table.width} > 0`),
  check('assets_height_positive', sql`${table.height} is null OR ${table.height} > 0`),
  check('assets_delete_actor_consistency', sql`(${table.deletedAt} is null) = (${table.deletedBy} is null)`),
]);

export const assetBookmarks = pgTable('asset_bookmarks', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.assetId] }),
  index('asset_bookmarks_asset_created_idx').on(table.assetId, table.createdAt),
]);

export const usageLedger = pgTable('usage_ledger', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  quotaPeriodId: uuid('quota_period_id').notNull().references(() => quotaPeriods.id, { onDelete: 'restrict' }),
  generationJobId: uuid('generation_job_id').references(() => generationJobs.id, { onDelete: 'restrict' }),
  eventType: usageEventTypeEnum('event_type').notNull(),
  reservedDelta: integer('reserved_delta').default(0).notNull(),
  consumedDelta: integer('consumed_delta').default(0).notNull(),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
  reason: text('reason'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('usage_ledger_job_event_unique')
    .on(table.generationJobId, table.eventType)
    .where(sql`${table.generationJobId} is not null`),
  index('usage_ledger_user_created_idx').on(table.userId, table.createdAt),
  index('usage_ledger_period_created_idx').on(table.quotaPeriodId, table.createdAt),
  index('usage_ledger_job_idx').on(table.generationJobId),
  check('usage_ledger_nonzero_delta', sql`${table.reservedDelta} <> 0 OR ${table.consumedDelta} <> 0`),
  check(
    'usage_ledger_admin_adjustment_actor',
    sql`${table.eventType} <> 'ADMIN_ADJUSTMENT' OR (${table.actorUserId} is not null AND ${table.reason} is not null)`,
  ),
]);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
  subjectUserId: uuid('subject_user_id').references(() => users.id, { onDelete: 'restrict' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  outcome: auditOutcomeEnum('outcome').notNull(),
  beforeState: jsonb('before_state').$type<Record<string, unknown>>(),
  afterState: jsonb('after_state').$type<Record<string, unknown>>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  requestId: text('request_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('audit_logs_created_idx').on(table.createdAt),
  index('audit_logs_actor_created_idx').on(table.actorUserId, table.createdAt),
  index('audit_logs_subject_created_idx').on(table.subjectUserId, table.createdAt),
  index('audit_logs_entity_created_idx').on(table.entityType, table.entityId, table.createdAt),
  index('audit_logs_action_idx').on(table.action),
]);
