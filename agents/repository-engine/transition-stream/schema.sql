-- QuantaPhi / Moltnook robot inspection telemetry (separate from monetary ledgers).
-- Apply to a dedicated D1 database. Never alter the authoritative Infinity/Quant
-- wallet tables to store code-inspection counts.
CREATE TABLE IF NOT EXISTS token_state_transitions (
  transition_id TEXT PRIMARY KEY NOT NULL CHECK(length(transition_id) = 64),
  quant_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  iteration_id TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  commit_sha TEXT NOT NULL CHECK(length(commit_sha) = 40),
  full_file_sha256 TEXT NOT NULL CHECK(length(full_file_sha256) = 64),
  snippet_sha256 TEXT NOT NULL CHECK(length(snippet_sha256) = 64),
  current_lifecycle_stage TEXT NOT NULL CHECK(current_lifecycle_stage IN ('RED','BLUE','YELLOW','BLACK')),
  outcome TEXT NOT NULL CHECK(outcome IN ('observed','accepted','rejected','blocked','failed')),
  assessment TEXT NOT NULL CHECK(assessment IN ('code_inspection','regex','layout','syntax','ci','review')),
  rule_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  website_scope_identifier TEXT NOT NULL,
  line_start INTEGER NOT NULL CHECK(line_start > 0),
  line_end INTEGER NOT NULL CHECK(line_end >= line_start AND line_end - line_start < 15),
  iteration_weight_type TEXT NOT NULL DEFAULT 'INSPECTION' CHECK(iteration_weight_type = 'INSPECTION'),
  system_credit_value INTEGER NOT NULL DEFAULT 1 CHECK(system_credit_value BETWEEN 0 AND 5),
  observed_at_ms INTEGER NOT NULL,
  hour_bucket INTEGER NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transitions_repository_hour ON token_state_transitions(repository_name, hour_bucket);
CREATE INDEX IF NOT EXISTS idx_transitions_resume ON token_state_transitions(repository_name, quant_id, observed_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_transitions_report ON token_state_transitions(repository_name, observed_at_ms DESC);

-- "system_credit_value" is a unit of inspection workload, not a mint.
-- Never convert this counter to StarCoins, Quant, Music Quant or Infinity
-- without separate authenticated wallet settlement + durable receipt readback.
