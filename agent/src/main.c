#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include "collector.h"

extern void build_telemetry_json(char *buffer, size_t size, const char *agent_id, uint64_t seq, SystemMetrics *m);
extern int send_telemetry(const char *host, int port, const char *path, const char *json_payload, const char *auth_token);

int main() {
    printf("SentriX Agent v0.1.0 starting...\n");
    
    // Hardcoded for V1 MVP demo (Will be loaded from config/enrollment later)
    const char *agent_id = "00000000-0000-0000-0000-000000000001"; 
    const char *server_host = "127.0.0.1";
    int server_port = 8080;
    const char *auth_token = "agent_secret_credential";
    uint64_t sequence = 1;

    char json_buffer[2048];
    SystemMetrics metrics;

    while (1) {
        printf("Collecting metrics...\n");
        
        collect_cpu(&metrics.cpu_utilization);
        collect_memory(&metrics.mem_total_bytes, &metrics.mem_used_bytes);
        collect_disk(&metrics.disk_total_bytes, &metrics.disk_used_bytes);
        collect_network(&metrics.net_rx_bytes, &metrics.net_tx_bytes);
        collect_system_load(&metrics.load_avg_1m);
        collect_uptime(&metrics.uptime_seconds);

        build_telemetry_json(json_buffer, sizeof(json_buffer), agent_id, sequence, &metrics);
        
        printf("Sending payload (seq %lu)...\n", sequence);
        if (send_telemetry(server_host, server_port, "/api/v1/agent/telemetry", json_buffer, auth_token) == 0) {
            printf("Success.\n");
        } else {
            printf("Failed to send. Will retry next cycle.\n");
        }

        sequence++;
        sleep(10); // 10 second collection interval
    }
    return 0;
}
