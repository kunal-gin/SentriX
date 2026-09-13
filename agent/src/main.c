#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <ctype.h>
#include "collector.h"
#include "checks.h"

extern void build_telemetry_json(char *buffer, size_t size, const char *agent_id, uint64_t seq, const SystemMetrics *m);
extern int send_telemetry(const char *host, int port, const char *path, const char *json_payload, const char *auth_token);

#define CONFIG_MAX_LEN 256

typedef struct {
    char server_host[CONFIG_MAX_LEN];
    int server_port;
    char agent_id[CONFIG_MAX_LEN];
    char auth_token[CONFIG_MAX_LEN];
} AgentConfig;

static void trim_inplace(char *str) {
    if (!str) return;
    char *end;
    while (isspace((unsigned char)*str)) str++;
    if (*str == 0) return;
    end = str + strlen(str) - 1;
    while (end > str && isspace((unsigned char)*end)) end--;
    end[1] = '\0';
}

static void load_config_file(const char *filepath, AgentConfig *cfg) {
    FILE *fp = fopen(filepath, "r");
    if (!fp) return;

    char line[512];
    while (fgets(line, sizeof(line), fp)) {
        // Strip comments and empty lines
        char *p = strchr(line, '#');
        if (p) *p = '\0';
        trim_inplace(line);
        if (line[0] == '\0') continue;

        char *eq = strchr(line, '=');
        if (!eq) continue;

        *eq = '\0';
        char *key = line;
        char *val = eq + 1;
        trim_inplace(key);
        trim_inplace(val);

        // Remove quotes if present
        if ((val[0] == '"' || val[0] == '\'') && val[strlen(val) - 1] == val[0]) {
            val[strlen(val) - 1] = '\0';
            val++;
        }

        if (strcmp(key, "SENTRIX_SERVER_HOST") == 0 && val[0] != '\0') {
            strncpy(cfg->server_host, val, sizeof(cfg->server_host) - 1);
        } else if (strcmp(key, "SENTRIX_SERVER_PORT") == 0 && val[0] != '\0') {
            cfg->server_port = atoi(val);
        } else if (strcmp(key, "SENTRIX_AGENT_ID") == 0 && val[0] != '\0') {
            strncpy(cfg->agent_id, val, sizeof(cfg->agent_id) - 1);
        } else if (strcmp(key, "SENTRIX_AGENT_CREDENTIAL") == 0 && val[0] != '\0') {
            strncpy(cfg->auth_token, val, sizeof(cfg->auth_token) - 1);
        }
    }

    fclose(fp);
    printf("Loaded configuration from %s\n", filepath);
}

static void load_env_vars(AgentConfig *cfg) {
    const char *env_host = getenv("SENTRIX_SERVER_HOST");
    if (env_host && env_host[0] != '\0') {
        strncpy(cfg->server_host, env_host, sizeof(cfg->server_host) - 1);
    }

    const char *env_port = getenv("SENTRIX_SERVER_PORT");
    if (env_port && env_port[0] != '\0') {
        cfg->server_port = atoi(env_port);
    }

    const char *env_id = getenv("SENTRIX_AGENT_ID");
    if (env_id && env_id[0] != '\0') {
        strncpy(cfg->agent_id, env_id, sizeof(cfg->agent_id) - 1);
    }

    const char *env_cred = getenv("SENTRIX_AGENT_CREDENTIAL");
    if (env_cred && env_cred[0] != '\0') {
        strncpy(cfg->auth_token, env_cred, sizeof(cfg->auth_token) - 1);
    }
}

static void print_usage(const char *prog) {
    printf("Usage: %s [OPTIONS]\n", prog);
    printf("Options:\n");
    printf("  -c <file>      Path to config file (default: /etc/sentrix/agent.env)\n");
    printf("  -h <host>      SentriX server host\n");
    printf("  -p <port>      SentriX server port (default: 8080)\n");
    printf("  -i <agent_id>  Agent UUID\n");
    printf("  -t <token>     Agent authorization credential token\n");
    printf("  --help         Show this help message\n");
}

int main(int argc, char *argv[]) {
    printf("SentriX Agent v1.0.0 starting...\n");

    AgentConfig config;
    memset(&config, 0, sizeof(config));

    // Default values (fallback)
    strncpy(config.server_host, "127.0.0.1", sizeof(config.server_host) - 1);
    config.server_port = 8080;
    strncpy(config.agent_id, "00000000-0000-0000-0000-000000000001", sizeof(config.agent_id) - 1);
    strncpy(config.auth_token, "agent_secret_credential", sizeof(config.auth_token) - 1);

    const char *config_file = "/etc/sentrix/agent.env";

    // 1. Scan command line for custom config file first
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-c") == 0 && i + 1 < argc) {
            config_file = argv[++i];
        } else if (strcmp(argv[i], "--help") == 0) {
            print_usage(argv[0]);
            return 0;
        }
    }

    // 2. Load from file if accessible
    load_config_file(config_file, &config);

    // 3. Override from environment variables
    load_env_vars(&config);

    // 4. Override from CLI flags
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-h") == 0 && i + 1 < argc) {
            strncpy(config.server_host, argv[++i], sizeof(config.server_host) - 1);
        } else if (strcmp(argv[i], "-p") == 0 && i + 1 < argc) {
            config.server_port = atoi(argv[++i]);
        } else if (strcmp(argv[i], "-i") == 0 && i + 1 < argc) {
            strncpy(config.agent_id, argv[++i], sizeof(config.agent_id) - 1);
        } else if (strcmp(argv[i], "-t") == 0 && i + 1 < argc) {
            strncpy(config.auth_token, argv[++i], sizeof(config.auth_token) - 1);
        }
    }

    printf("Target Server: %s:%d\n", config.server_host, config.server_port);
    printf("Agent ID:      %s\n", config.agent_id);

    uint64_t sequence = 1;
    char json_buffer[2048];
    SystemMetrics metrics;

    while (1) {
        printf("Collecting metrics (seq %lu)...\n", (unsigned long)sequence);

        collect_cpu(&metrics.cpu_utilization);
        collect_memory(&metrics.mem_total_bytes, &metrics.mem_used_bytes);
        collect_disk(&metrics.disk_total_bytes, &metrics.disk_used_bytes);
        collect_network(&metrics.net_rx_bytes, &metrics.net_tx_bytes);
        collect_system_load(&metrics.load_avg_1m);
        collect_uptime(&metrics.uptime_seconds);

        build_telemetry_json(json_buffer, sizeof(json_buffer), config.agent_id, sequence, &metrics);

        if (send_telemetry(config.server_host, config.server_port, "/api/v1/agent/telemetry", json_buffer, config.auth_token) == 0) {
            printf("Telemetry sent successfully.\n");
        } else {
            printf("Telemetry dispatch failed. Will retry next interval.\n");
        }

        // Execute synthetic checks cycle every 3 intervals (30 seconds)
        if (sequence % 3 == 0) {
            printf("Running synthetic checks cycle...\n");
            run_checks_cycle(config.server_host, config.server_port, config.agent_id, config.auth_token);
        }

        sequence++;
        sleep(10); // 10 second telemetry cycle
    }

    return 0;
}
