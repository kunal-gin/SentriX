#include "collector.h"
#include <stdio.h>
#include <string.h>
#include <unistd.h>

int collect_cpu(double *utilization) {
    FILE *fp = fopen("/proc/stat", "r");
    if (!fp) return -1;

    char line[256];
    uint64_t user1, nice1, system1, idle1, iowait1, irq1, softirq1, steal1;
    uint64_t user2, nice2, system2, idle2, iowait2, irq2, softirq2, steal2;

    // First read
    fgets(line, sizeof(line), fp);
    sscanf(line, "cpu  %lu %lu %lu %lu %lu %lu %lu %lu", 
           &user1, &nice1, &system1, &idle1, &iowait1, &irq1, &softirq1, &steal1);
    fclose(fp);

    sleep(1); // Wait 1 second for delta calculation

    fp = fopen("/proc/stat", "r");
    if (!fp) return -1;
    
    // Second read
    fgets(line, sizeof(line), fp);
    sscanf(line, "cpu  %lu %lu %lu %lu %lu %lu %lu %lu", 
           &user2, &nice2, &system2, &idle2, &iowait2, &irq2, &softirq2, &steal2);
    fclose(fp);

    uint64_t total1 = user1 + nice1 + system1 + idle1 + iowait1 + irq1 + softirq1 + steal1;
    uint64_t total2 = user2 + nice2 + system2 + idle2 + iowait2 + irq2 + softirq2 + steal2;
    
    uint64_t total_delta = total2 - total1;
    uint64_t idle_delta = idle2 - idle1;

    if (total_delta == 0) {
        *utilization = 0.0;
    } else {
        *utilization = 100.0 * (1.0 - ((double)idle_delta / total_delta));
    }

    return 0;
}
