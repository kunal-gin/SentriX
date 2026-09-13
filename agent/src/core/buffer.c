#include "buffer.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int buffer_init(DiskBuffer *buf, const char *path, size_t max_bytes) {
    if (!buf) return -1;
    strncpy(buf->file_path, path ? path : DEFAULT_BUFFER_FILE, sizeof(buf->file_path) - 1);
    buf->file_path[sizeof(buf->file_path) - 1] = '\0';
    buf->max_bytes = max_bytes > 0 ? max_bytes : DEFAULT_MAX_BUFFER_BYTES;
    buf->current_bytes = 0;
    buf->items_queued = 0;

    // Check if buffer file exists and count queued records
    FILE *fp = fopen(buf->file_path, "rb");
    if (fp) {
        uint32_t record_len = 0;
        while (fread(&record_len, sizeof(uint32_t), 1, fp) == 1) {
            if (fseek(fp, record_len, SEEK_CUR) != 0) break;
            buf->items_queued++;
            buf->current_bytes += sizeof(uint32_t) + record_len;
        }
        fclose(fp);
    }
    return 0;
}

int buffer_push(DiskBuffer *buf, const char *payload, size_t length) {
    if (!buf || !payload || length == 0) return -1;

    // Check max buffer limit
    if (buf->current_bytes + sizeof(uint32_t) + length > buf->max_bytes) {
        // Drop oldest record by popping
        buffer_pop(buf);
    }

    FILE *fp = fopen(buf->file_path, "ab");
    if (!fp) return -1;

    uint32_t len32 = (uint32_t)length;
    fwrite(&len32, sizeof(uint32_t), 1, fp);
    fwrite(payload, 1, length, fp);
    fclose(fp);

    buf->items_queued++;
    buf->current_bytes += sizeof(uint32_t) + length;
    return 0;
}

int buffer_peek(DiskBuffer *buf, char *out_payload, size_t max_out_len, size_t *out_len) {
    if (!buf || !out_payload || buf->items_queued == 0) return -1;

    FILE *fp = fopen(buf->file_path, "rb");
    if (!fp) return -1;

    uint32_t len32 = 0;
    if (fread(&len32, sizeof(uint32_t), 1, fp) != 1) {
        fclose(fp);
        return -1;
    }

    if (len32 >= max_out_len) {
        fclose(fp);
        return -2; // Buffer too small
    }

    size_t read_bytes = fread(out_payload, 1, len32, fp);
    fclose(fp);

    if (read_bytes != len32) return -1;
    out_payload[read_bytes] = '\0';
    if (out_len) *out_len = read_bytes;

    return 0;
}

int buffer_pop(DiskBuffer *buf) {
    if (!buf || buf->items_queued == 0) return -1;

    FILE *fp = fopen(buf->file_path, "rb");
    if (!fp) return -1;

    uint32_t len32 = 0;
    if (fread(&len32, sizeof(uint32_t), 1, fp) != 1) {
        fclose(fp);
        return -1;
    }

    // Skip the first record and read the rest into temp file
    char temp_path[300];
    snprintf(temp_path, sizeof(temp_path), "%s.tmp", buf->file_path);
    FILE *out = fopen(temp_path, "wb");
    if (!out) {
        fclose(fp);
        return -1;
    }

    fseek(fp, len32, SEEK_CUR);

    char copy_buf[4096];
    size_t n;
    size_t remaining_bytes = 0;
    while ((n = fread(copy_buf, 1, sizeof(copy_buf), fp)) > 0) {
        fwrite(copy_buf, 1, n, out);
        remaining_bytes += n;
    }

    fclose(fp);
    fclose(out);

    remove(buf->file_path);
    rename(temp_path, buf->file_path);

    buf->items_queued--;
    buf->current_bytes = remaining_bytes;
    return 0;
}

int buffer_size(const DiskBuffer *buf) {
    return buf ? buf->items_queued : 0;
}

void buffer_cleanup(DiskBuffer *buf) {
    if (buf) {
        remove(buf->file_path);
        buf->items_queued = 0;
        buf->current_bytes = 0;
    }
}
