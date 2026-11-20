-- Additive evidence tables only: Brain Clock work_tickets remains authoritative.
CREATE TABLE IF NOT EXISTS bubbles_program_receipts (
 receipt_id TEXT PRIMARY KEY CHECK(length(receipt_id)=64),
 owner_hash TEXT NOT NULL CHECK(length(owner_hash)=64),
 job_id TEXT NOT NULL,
 program TEXT NOT NULL,
 source_sha TEXT NOT NULL CHECK(length(source_sha)=40),
 lease_id TEXT NOT NULL,
 fence INTEGER NOT NULL CHECK(fence>0),
 status TEXT NOT NULL,
 content_sha256 TEXT NOT NULL CHECK(length(content_sha256)=64),
 receipt_json TEXT NOT NULL CHECK(length(receipt_json)<=64000),
 recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bubbles_receipts_owner_job ON bubbles_program_receipts(owner_hash,job_id,recorded_at DESC);
CREATE TRIGGER IF NOT EXISTS bubbles_receipts_no_update BEFORE UPDATE ON bubbles_program_receipts
BEGIN SELECT RAISE(ABORT,'immutable_receipt'); END;
CREATE TRIGGER IF NOT EXISTS bubbles_receipts_no_delete BEFORE DELETE ON bubbles_program_receipts
BEGIN SELECT RAISE(ABORT,'immutable_receipt'); END;
CREATE TABLE IF NOT EXISTS bubbles_raw_quant_staging (
 quant_hash TEXT NOT NULL CHECK(length(quant_hash)=64),
 owner_hash TEXT NOT NULL CHECK(length(owner_hash)=64),
 kind TEXT NOT NULL CHECK(kind IN ('raw_quant','code','media','telemetry','market')),
 source_url TEXT NOT NULL,
 observed_at TEXT NOT NULL,
 payload_json TEXT NOT NULL CHECK(length(payload_json)<=64000),
 verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)),
 PRIMARY KEY(owner_hash,quant_hash)
);
CREATE TABLE IF NOT EXISTS bubbles_context_proposals (
 owner_hash TEXT NOT NULL CHECK(length(owner_hash)=64),
 version_hash TEXT NOT NULL CHECK(length(version_hash)=64),
 source_sha TEXT NOT NULL CHECK(length(source_sha)=40),
 proposal_json TEXT NOT NULL CHECK(length(proposal_json)<=64000),
 status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','reviewed','rejected')),
 PRIMARY KEY(owner_hash,version_hash)
);
-- Never use these tables as authoritative wallet balances or a competing queue.
