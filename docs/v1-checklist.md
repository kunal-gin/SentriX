# SentriX v1.0 Release Checklist

## Functional Core

- [ ] Agent can enroll
- [ ] Agent sends heartbeat/telemetry
- [ ] Server marks server online/offline
- [ ] Dashboard overview loads
- [ ] Server detail shows charts
- [ ] Alert rule can fire
- [ ] Incident appears
- [ ] Incident can be acknowledged
- [ ] Incident can be resolved
- [ ] Timeline records lifecycle
- [ ] Notification webhook delivers
- [ ] WebSocket updates dashboard live
- [ ] Polling fallback works

## Checks

- [ ] Process check works
- [ ] Service check works
- [ ] Port check works
- [ ] Command check works

## Security

- [ ] Login rate limit works
- [ ] Account lockout works
- [ ] Security headers present
- [ ] CORS restricted in production
- [ ] Telemetry payload limit works
- [ ] Replay protection works
- [ ] Agent credential rotation works
- [ ] Agent revocation works
- [ ] Enrollment tokens expire
- [ ] Audit log records sensitive actions

## Operations

- [ ] Backup script tested
- [ ] Restore script tested
- [ ] Upgrade path tested
- [ ] Docker image builds
- [ ] Agent binary packages
- [ ] systemd unit works
- [ ] Version endpoint reports correct release

## Performance

- [ ] 100 simulated agents supported in staging
- [ ] Dashboard p95 < 250ms
- [ ] Ingest acknowledgement p95 < 200ms
- [ ] No goroutine leaks over 24h soak test

## Documentation

- [ ] README updated
- [ ] Deployment guide updated
- [ ] Security guide updated
- [ ] Upgrade guide updated
- [ ] Backup/restore guide updated
- [ ] CHANGELOG written
