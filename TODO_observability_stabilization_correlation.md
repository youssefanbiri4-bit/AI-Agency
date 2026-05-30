# Stabilization Pass: correlation_id propagation + metrics normalization

- [ ] execute route: define correlation_id canonical field (correlation_id = requestId ?? generated UUID); do NOT overwrite requestId
- [ ] execute route: include correlation_id in BullMQ job payload (keep requestId)
- [ ] task-worker: validate correlation_id in job data; use correlation_id for logging labels; pass correlation_id into executeTask; emit ONLY worker metrics
- [ ] n8n worker executeTask: include correlation_id in n8n execution payload
- [ ] /api/n8n/callback: extract correlation_id from payload; emit ONLY callback metrics; include correlation_id in logs/labels
- [ ] /api/tasks/callback: extract correlation_id from payload; emit ONLY callback metrics; include correlation_id in logs/labels
- [ ] maybe-dlq: DLQ payload correlation_id propagation with fallback chain:
  - correlation_id
  - fallback requestId
  - fallback jobId (last resort)
  ; emit ONLY dlq metrics
- [ ] stale-recovery: emit stale metrics only; MUST NOT set correlation_id = task_id; generate safe fallback like `stale-${task_id}` or reuse available job metadata
- [ ] metrics naming: normalize all touched metrics names to convention ending with `_total`:
  - worker_job_received_total / worker_job_success_total / worker_job_failed_total
  - dlq_inserted_total
  - stale_marked_total (and ensure stale_detected_total usage is consistent with convention if present)
  - callback_received_total / callback_success_total / callback_ignored_total
- [ ] update unit tests to match payload + metric name changes
- [ ] run tests
