#ifndef COLLECTOR_H
#define COLLECTOR_H

#include <stdint.h>

#define MAX_TOP_PROCESSES 10

typedef struct {
    int pid;
    char name[64];
    char user[32];
    double cpu_percent;
    uint64_t mem_rss_bytes;
    char state[16];
} ProcessInfo;

typedef struct {
    double cpu_utilization;
    uint64_t mem_total_bytes;
    uint64_t mem_used_bytes;
    uint64_t disk_total_bytes;
    uint64_t disk_used_bytes;
    uint64_t net_rx_bytes;
    uint64_t net_tx_bytes;
    double load_avg_1m;
    uint64_t uptime_seconds;
    int process_count;
    ProcessInfo top_processes[MAX_TOP_PROCESSES];
} SystemMetrics;

// Collectors return 0 on success, -1 on error
int collect_cpu(double *utilization);
int collect_memory(uint64_t *total, uint64_t *used);
int collect_disk(uint64_t *total, uint64_t *used);
int collect_network(uint64_t *rx, uint64_t *tx);
int collect_system_load(double *load_1m);
int collect_uptime(uint64_t *seconds);
int collect_top_processes(ProcessInfo *procs, int max_count, int *out_count);

#endif
