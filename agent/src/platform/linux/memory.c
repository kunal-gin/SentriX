#include "collector.h"
#include <stdio.h>
#include <string.h>

int collect_memory(uint64_t *total, uint64_t *used) {
    FILE *fp = fopen("/proc/meminfo", "r");
    if (!fp) return -1;

    char line[256];
    uint64_t mem_total = 0, mem_free = 0, buffers = 0, cached = 0;

    while (fgets(line, sizeof(line), fp)) {
        if (sscanf(line, "MemTotal: %lu kB", &mem_total) == 1) continue;
        if (sscanf(line, "MemFree: %lu kB", &mem_free) == 1) continue;
        if (sscanf(line, "Buffers: %lu kB", &buffers) == 1) continue;
        if (sscanf(line, "Cached: %lu kB", &cached) == 1) continue;
    }
    fclose(fp);

    *total = mem_total * 1024; // Convert to bytes
    uint64_t available = mem_free + buffers + cached;
    *used = (mem_total - available) * 1024;

    return 0;
}
