#include "collector.h"
#include <stdio.h>
#include <sys/statvfs.h>

int collect_disk(uint64_t *total, uint64_t *used) {
    struct statvfs stat;
    if (statvfs("/", &stat) != 0) return -1;
    
    *total = (uint64_t)stat.f_blocks * stat.f_frsize;
    uint64_t free_space = (uint64_t)stat.f_bfree * stat.f_frsize;
    *used = *total - free_space;
    return 0;
}

int collect_network(uint64_t *rx, uint64_t *tx) {
    // Simplified: reads eth0. In production, loop through /proc/net/dev
    FILE *fp = fopen("/proc/net/dev", "r");
    if (!fp) return -1;
    char line[256];
    *rx = 0; *tx = 0;
    while (fgets(line, sizeof(line), fp)) {
        if (strstr(line, "eth0") || strstr(line, "ens")) {
            char *colon = strchr(line, ':');
            if (colon) {
                sscanf(colon + 1, "%lu %*u %*u %*u %*u %*u %*u %*u %lu", rx, tx);
                break;
            }
        }
    }
    fclose(fp);
    return 0;
}

int collect_system_load(double *load_1m) {
    FILE *fp = fopen("/proc/loadavg", "r");
    if (!fp) return -1;
    fscanf(fp, "%lf", load_1m);
    fclose(fp);
    return 0;
}

int collect_uptime(uint64_t *seconds) {
    FILE *fp = fopen("/proc/uptime", "r");
    if (!fp) return -1;
    double up;
    fscanf(fp, "%lf", &up);
    *seconds = (uint64_t)up;
    fclose(fp);
    return 0;
}
