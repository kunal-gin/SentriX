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
    FILE *fp = fopen("/proc/net/dev", "r");
    if (!fp) return -1;

    char line[512];
    uint64_t total_rx = 0;
    uint64_t total_tx = 0;

    // Skip the first two header lines
    if (!fgets(line, sizeof(line), fp)) { fclose(fp); return -1; }
    if (!fgets(line, sizeof(line), fp)) { fclose(fp); return -1; }

    while (fgets(line, sizeof(line), fp)) {
        char *colon = strchr(line, ':');
        if (!colon) continue;

        *colon = '\0';
        char *iface = line;
        while (*iface == ' ') iface++;

        // Ignore loopback interface
        if (strcmp(iface, "lo") == 0) continue;

        uint64_t r_bytes = 0, t_bytes = 0;
        if (sscanf(colon + 1, "%lu %*u %*u %*u %*u %*u %*u %*u %lu", &r_bytes, &t_bytes) >= 2) {
            total_rx += r_bytes;
            total_tx += t_bytes;
        }
    }

    fclose(fp);
    *rx = total_rx;
    *tx = total_tx;
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
