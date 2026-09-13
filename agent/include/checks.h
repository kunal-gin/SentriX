#ifndef SENTRIX_CHECKS_H
#define SENTRIX_CHECKS_H

typedef struct {
    char check_id[64];
    int ok;
    int latency_ms;
    char message[256];
} CheckResult;

void run_checks_cycle(
    const char *host,
    int port,
    const char *agent_id,
    const char *auth_token
);

#endif
