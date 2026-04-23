CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  descriptor TEXT NOT NULL,
  operational_story TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  logo_text TEXT NOT NULL,
  primary_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  public_domain TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  internal_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS invites (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  tenant_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invite_roles (
  invite_token TEXT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (invite_token, role)
);

CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  owner_title TEXT NOT NULL,
  obligation_focus TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS source_systems (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  system_type TEXT NOT NULL,
  owner TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS obligations (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  operational_label TEXT NOT NULL,
  module_id TEXT NOT NULL,
  readiness INTEGER NOT NULL,
  maturity INTEGER NOT NULL,
  owner_present INTEGER NOT NULL,
  evidence_present INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  profile_mode TEXT NOT NULL,
  status TEXT NOT NULL,
  field_count INTEGER NOT NULL,
  approved_field_count INTEGER NOT NULL,
  warnings_json TEXT NOT NULL,
  uploaded_at TEXT,
  sheet_name TEXT,
  pushed_to_register INTEGER NOT NULL DEFAULT 0,
  linked_register_entry_ids_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS source_profiles (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  source_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  mapped_category TEXT NOT NULL,
  identifier_type TEXT NOT NULL,
  confidence REAL NOT NULL,
  purpose TEXT NOT NULL,
  legal_basis TEXT NOT NULL,
  retention_label TEXT NOT NULL,
  requires_review INTEGER NOT NULL,
  warnings_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS register_entries (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  system_name TEXT NOT NULL,
  data_category TEXT NOT NULL,
  purpose TEXT NOT NULL,
  legal_basis TEXT NOT NULL,
  retention_label TEXT NOT NULL,
  linked_notice_id TEXT,
  linked_processor_ids_json TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  source_trace TEXT NOT NULL,
  completeness TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  audience TEXT NOT NULL,
  language TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL,
  content TEXT NOT NULL,
  acknowledgements INTEGER NOT NULL DEFAULT 0,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS rights_cases (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  type TEXT NOT NULL,
  requestor TEXT NOT NULL,
  status TEXT NOT NULL,
  sla TEXT NOT NULL,
  evidence_linked INTEGER NOT NULL DEFAULT 0,
  linked_deletion_task_id TEXT
);

CREATE TABLE IF NOT EXISTS deletion_tasks (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  label TEXT NOT NULL,
  system_name TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL,
  proof_linked INTEGER NOT NULL DEFAULT 0,
  processor_acknowledged INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  severity TEXT NOT NULL,
  board_deadline TEXT NOT NULL,
  remediation_owner TEXT NOT NULL,
  evidence_linked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS processors (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  service TEXT NOT NULL,
  dpa_status TEXT NOT NULL,
  purge_ack_status TEXT NOT NULL,
  sub_processor_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS evidence_artifacts (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  label TEXT NOT NULL,
  classification TEXT NOT NULL,
  linked_record TEXT NOT NULL,
  created_at TEXT NOT NULL,
  file_name TEXT,
  content_type TEXT,
  size_bytes INTEGER,
  storage_key TEXT,
  encrypted_blob BLOB
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  created_at TEXT NOT NULL,
  actor TEXT NOT NULL,
  module_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT NOT NULL,
  summary TEXT NOT NULL
);
