-- v029: Webhook idempotency key for deduplication
ALTER TABLE webhook_delivery_logs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_idempotency ON webhook_delivery_logs(idempotency_key) WHERE idempotency_key IS NOT NULL;
