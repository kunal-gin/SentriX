#define _GNU_SOURCE

#include "checks.h"
#include "cJSON.h"

#include <arpa/inet.h>
#include <ctype.h>
#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <netdb.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/select.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

extern int http_request(
    const char *method,
    const char *host,
    int port,
    const char *path,
    const char *auth_token,
    const char *body,
    char *response_body,
    size_t response_size
);

#define MAX_CHECKS 64
#define RESPONSE_BUFFER_SIZE 65536

static const char *json_string(const cJSON *object, const char *key, const char *fallback) {
    const cJSON *item = cJSON_GetObjectItemCaseSensitive(object, key);

    if (cJSON_IsString(item) && item->valuestring != NULL) {
        return item->valuestring;
    }

    return fallback;
}

static int json_int(const cJSON *object, const char *key, int fallback) {
    const cJSON *item = cJSON_GetObjectItemCaseSensitive(object, key);

    if (cJSON_IsNumber(item)) {
        return item->valueint;
    }

    return fallback;
}

static void current_utc(char *buffer, size_t size) {
    time_t now = time(NULL);
    struct tm *tm_info = gmtime(&now);
    strftime(buffer, size, "%Y-%m-%dT%H:%M:%SZ", tm_info);
}

static int valid_unit_name(const char *unit) {
    if (unit == NULL || unit[0] == '\0') {
        return 0;
    }

    for (const char *p = unit; *p != '\0'; p++) {
        unsigned char c = (unsigned char)*p;

        if (
            !isalnum(c) &&
            c != '.' &&
            c != '-' &&
            c != '_' &&
            c != '@' &&
            c != ':'
        ) {
            return 0;
        }
    }

    return 1;
}

static int wait_for_pid(pid_t pid, int timeout_seconds) {
    int status;
    time_t start = time(NULL);

    while (1) {
        pid_t result = waitpid(pid, &status, WNOHANG);

        if (result == pid) {
            if (WIFEXITED(status)) {
                return WEXITSTATUS(status);
            }

            return -1;
        }

        if (time(NULL) - start >= timeout_seconds) {
            kill(pid, SIGKILL);
            waitpid(pid, &status, 0);
            return -1;
        }

        usleep(100000);
    }
}

static int cmdline_contains(const char *pid, const char *needle) {
    char path[280];
    snprintf(path, sizeof(path), "/proc/%s/cmdline", pid);

    FILE *fp = fopen(path, "rb");
    if (!fp) {
        return 0;
    }

    char buffer[4096];
    size_t n = fread(buffer, 1, sizeof(buffer) - 1, fp);
    fclose(fp);

    if (n == 0) {
        return 0;
    }

    for (size_t i = 0; i < n; i++) {
        if (buffer[i] == '\0') {
            buffer[i] = ' ';
        }
    }

    buffer[n] = '\0';

    return strstr(buffer, needle) != NULL;
}

static int process_exists(const char *name, char *message, size_t message_size) {
    DIR *proc = opendir("/proc");

    if (!proc) {
        snprintf(message, message_size, "cannot open /proc");
        return 0;
    }

    struct dirent *entry;
    int found = 0;

    while ((entry = readdir(proc)) != NULL) {
        if (!isdigit((unsigned char)entry->d_name[0])) {
            continue;
        }

        char path[280];
        snprintf(path, sizeof(path), "/proc/%s/comm", entry->d_name);

        FILE *fp = fopen(path, "r");
        if (!fp) {
            continue;
        }

        char comm[256];
        memset(comm, 0, sizeof(comm));

        if (fgets(comm, sizeof(comm), fp)) {
            comm[strcspn(comm, "\n")] = '\0';

            if (strcmp(comm, name) == 0) {
                found = 1;
            }
        }

        fclose(fp);

        if (!found && cmdline_contains(entry->d_name, name)) {
            found = 1;
        }

        if (found) {
            break;
        }
    }

    closedir(proc);

    if (found) {
        snprintf(message, message_size, "process found");
    } else {
        snprintf(message, message_size, "process not found");
    }

    return found;
}

static int service_active(const char *unit, int timeout_seconds, char *message, size_t message_size) {
    if (!valid_unit_name(unit)) {
        snprintf(message, message_size, "invalid systemd unit name");
        return 0;
    }

    pid_t pid = fork();

    if (pid < 0) {
        snprintf(message, message_size, "fork failed");
        return 0;
    }

    if (pid == 0) {
        execlp(
            "systemctl",
            "systemctl",
            "is-active",
            "--quiet",
            unit,
            (char *)NULL
        );

        _exit(127);
    }

    int exit_code = wait_for_pid(pid, timeout_seconds);

    if (exit_code == 0) {
        snprintf(message, message_size, "service active");
        return 1;
    }

    if (exit_code == 127) {
        snprintf(message, message_size, "systemctl not found");
    } else if (exit_code < 0) {
        snprintf(message, message_size, "service check timed out");
    } else {
        snprintf(message, message_size, "service inactive");
    }

    return 0;
}

static int tcp_port_open(
    const char *host,
    int port,
    int timeout_seconds,
    char *message,
    size_t message_size
) {
    struct addrinfo hints, *res = NULL, *rp;

    memset(&hints, 0, sizeof(hints));
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;

    char port_str[8];
    snprintf(port_str, sizeof(port_str), "%d", port);

    int gai = getaddrinfo(host, port_str, &hints, &res);

    if (gai != 0) {
        snprintf(message, message_size, "dns resolution failed");
        return 0;
    }

    int ok = 0;

    for (rp = res; rp != NULL; rp = rp->ai_next) {
        int sock = socket(rp->ai_family, rp->ai_socktype, rp->ai_protocol);

        if (sock < 0) {
            continue;
        }

        int flags = fcntl(sock, F_GETFL, 0);
        fcntl(sock, F_SETFL, flags | O_NONBLOCK);

        int rc = connect(sock, rp->ai_addr, rp->ai_addrlen);

        if (rc == 0) {
            ok = 1;
            close(sock);
            break;
        }

        if (errno == EINPROGRESS) {
            fd_set write_fds;
            FD_ZERO(&write_fds);
            FD_SET(sock, &write_fds);

            struct timeval tv;
            tv.tv_sec = timeout_seconds;
            tv.tv_usec = 0;

            int selected = select(sock + 1, NULL, &write_fds, NULL, &tv);

            if (selected > 0) {
                int socket_error = 0;
                socklen_t len = sizeof(socket_error);

                getsockopt(sock, SOL_SOCKET, SO_ERROR, &socket_error, &len);

                if (socket_error == 0) {
                    ok = 1;
                }
            }
        }

        close(sock);

        if (ok) {
            break;
        }
    }

    freeaddrinfo(res);

    if (ok) {
        snprintf(message, message_size, "port open");
    } else {
        snprintf(message, message_size, "port unreachable");
    }

    return ok;
}

static int command_ok(const cJSON *config, int timeout_seconds, char *message, size_t message_size) {
    const cJSON *command_item = cJSON_GetObjectItemCaseSensitive(config, "command");

    if (!cJSON_IsString(command_item) || command_item->valuestring == NULL) {
        snprintf(message, message_size, "command missing");
        return 0;
    }

    char *argv[32];
    int argc = 0;

    argv[argc++] = command_item->valuestring;

    const cJSON *args = cJSON_GetObjectItemCaseSensitive(config, "args");

    if (cJSON_IsArray(args)) {
        const cJSON *arg = NULL;

        cJSON_ArrayForEach(arg, args) {
            if (cJSON_IsString(arg) && argc < 31) {
                argv[argc++] = arg->valuestring;
            }
        }
    }

    argv[argc] = NULL;

    pid_t pid = fork();

    if (pid < 0) {
        snprintf(message, message_size, "fork failed");
        return 0;
    }

    if (pid == 0) {
        execvp(argv[0], argv);
        _exit(127);
    }

    int exit_code = wait_for_pid(pid, timeout_seconds);

    if (exit_code == 0) {
        snprintf(message, message_size, "command succeeded");
        return 1;
    }

    if (exit_code == 127) {
        snprintf(message, message_size, "command not found");
    } else if (exit_code < 0) {
        snprintf(message, message_size, "command timed out");
    } else {
        snprintf(message, message_size, "command failed");
    }

    return 0;
}

static void run_single_check(const cJSON *check, CheckResult *result) {
    memset(result, 0, sizeof(*result));

    const char *id = json_string(check, "id", "");
    const char *type = json_string(check, "type", "");
    int timeout = json_int(check, "timeout_seconds", 5);

    snprintf(result->check_id, sizeof(result->check_id), "%s", id);

    const cJSON *config = cJSON_GetObjectItemCaseSensitive(check, "config");

    struct timespec start, end;
    clock_gettime(CLOCK_MONOTONIC, &start);

    if (strcasecmp(type, "PROCESS") == 0) {
        const char *name = json_string(config, "name", "");
        result->ok = process_exists(name, result->message, sizeof(result->message));
    } else if (strcasecmp(type, "SERVICE") == 0) {
        const char *unit = json_string(config, "unit", "");
        result->ok = service_active(unit, timeout, result->message, sizeof(result->message));
    } else if (strcasecmp(type, "PORT") == 0) {
        const char *host = json_string(config, "host", "127.0.0.1");
        int port = json_int(config, "port", 0);
        result->ok = tcp_port_open(host, port, timeout, result->message, sizeof(result->message));
    } else if (strcasecmp(type, "COMMAND") == 0) {
        result->ok = command_ok(config, timeout, result->message, sizeof(result->message));
    } else {
        result->ok = 0;
        snprintf(result->message, sizeof(result->message), "unsupported check type");
    }

    clock_gettime(CLOCK_MONOTONIC, &end);

    long ms = (end.tv_sec - start.tv_sec) * 1000L +
              (end.tv_nsec - start.tv_nsec) / 1000000L;

    if (ms < 0) {
        ms = 0;
    }

    result->latency_ms = (int)ms;
}

static void post_check_results(
    const char *host,
    int port,
    const char *agent_id,
    const char *auth_token,
    const CheckResult *results,
    int count
) {
    cJSON *root = cJSON_CreateObject();

    cJSON_AddStringToObject(root, "agent_id", agent_id);

    char timestamp[32];
    current_utc(timestamp, sizeof(timestamp));
    cJSON_AddStringToObject(root, "timestamp", timestamp);

    cJSON *results_array = cJSON_AddArrayToObject(root, "results");

    for (int i = 0; i < count; i++) {
        cJSON *item = cJSON_CreateObject();

        cJSON_AddStringToObject(item, "check_id", results[i].check_id);
        cJSON_AddStringToObject(item, "status", results[i].ok ? "OK" : "FAIL");
        cJSON_AddNumberToObject(item, "latency_ms", results[i].latency_ms);
        cJSON_AddStringToObject(item, "message", results[i].message);

        cJSON_AddItemToArray(results_array, item);
    }

    char *payload = cJSON_PrintUnformatted(root);

    char response[4096];
    int status = http_request(
        "POST",
        host,
        port,
        "/api/v1/agent/check-results",
        auth_token,
        payload,
        response,
        sizeof(response)
    );

    if (status >= 200 && status < 300) {
        printf("Sent %d check results\n", count);
    } else {
        printf("Failed to send check results, HTTP status %d\n", status);
    }

    free(payload);
    cJSON_Delete(root);
}

void run_checks_cycle(
    const char *host,
    int port,
    const char *agent_id,
    const char *auth_token
) {
    char response[RESPONSE_BUFFER_SIZE];

    int status = http_request(
        "GET",
        host,
        port,
        "/api/v1/agent/checks",
        auth_token,
        NULL,
        response,
        sizeof(response)
    );

    if (status != 200) {
        printf("Failed to fetch checks, HTTP status %d\n", status);
        return;
    }

    cJSON *root = cJSON_Parse(response);

    if (!root) {
        printf("Failed to parse check response\n");
        return;
    }

    cJSON *checks = cJSON_GetObjectItemCaseSensitive(root, "checks");

    if (!cJSON_IsArray(checks)) {
        cJSON_Delete(root);
        return;
    }

    int count = cJSON_GetArraySize(checks);

    if (count <= 0) {
        cJSON_Delete(root);
        return;
    }

    if (count > MAX_CHECKS) {
        count = MAX_CHECKS;
    }

    CheckResult results[MAX_CHECKS];
    int result_count = 0;

    for (int i = 0; i < count; i++) {
        cJSON *check = cJSON_GetArrayItem(checks, i);

        if (!cJSON_IsObject(check)) {
            continue;
        }

        run_single_check(check, &results[result_count]);
        result_count++;
    }

    if (result_count > 0) {
        post_check_results(
            host,
            port,
            agent_id,
            auth_token,
            results,
            result_count
        );
    }

    cJSON_Delete(root);
}
