#ifndef SENTRIX_BUFFER_H
#define SENTRIX_BUFFER_H

#include <stdint.h>
#include <stddef.h>

#define DEFAULT_MAX_BUFFER_BYTES (50 * 1024 * 1024) // 50 MB
#define DEFAULT_BUFFER_FILE "sentrix_spool.bin"

typedef struct {
    char file_path[256];
    size_t max_bytes;
    size_t current_bytes;
    int items_queued;
} DiskBuffer;

int buffer_init(DiskBuffer *buf, const char *path, size_t max_bytes);
int buffer_push(DiskBuffer *buf, const char *payload, size_t length);
int buffer_peek(DiskBuffer *buf, char *out_payload, size_t max_out_len, size_t *out_len);
int buffer_pop(DiskBuffer *buf);
int buffer_size(const DiskBuffer *buf);
void buffer_cleanup(DiskBuffer *buf);

#endif
