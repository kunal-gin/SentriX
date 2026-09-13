int http_request(
    const char *method,
    const char *host,
    int port,
    const char *path,
    const char *auth_token,
    const char *body,
    char *response_body,
    size_t response_size
) {
    struct addrinfo hints, *res;
    memset(&hints, 0, sizeof(hints));

    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;

    char port_str[8];
    snprintf(port_str, sizeof(port_str), "%d", port);

    if (getaddrinfo(host, port_str, &hints, &res) != 0) {
        return 0;
    }

    int sock = socket(res->ai_family, res->ai_socktype, res->ai_protocol);
    if (sock < 0) {
        freeaddrinfo(res);
        return 0;
    }

    if (connect(sock, res->ai_addr, res->ai_addrlen) < 0) {
        close(sock);
        freeaddrinfo(res);
        return 0;
    }

    freeaddrinfo(res);

    char request[8192];
    int body_len = body ? (int)strlen(body) : 0;

    if (auth_token && auth_token[0] != '\0') {
        snprintf(
            request,
            sizeof(request),
            "%s %s HTTP/1.1\r\n"
            "Host: %s\r\n"
            "Authorization: Bearer %s\r\n"
            "Content-Type: application/json\r\n"
            "Content-Length: %d\r\n"
            "Connection: close\r\n\r\n"
            "%s",
            method,
            path,
            host,
            auth_token,
            body_len,
            body ? body : ""
        );
    } else {
        snprintf(
            request,
            sizeof(request),
            "%s %s HTTP/1.1\r\n"
            "Host: %s\r\n"
            "Content-Type: application/json\r\n"
            "Content-Length: %d\r\n"
            "Connection: close\r\n\r\n"
            "%s",
            method,
            path,
            host,
            body_len,
            body ? body : ""
        );
    }

    send(sock, request, strlen(request), 0);

    char buffer[8192];
    size_t total = 0;
    ssize_t n;

    while ((n = recv(sock, buffer, sizeof(buffer), 0)) > 0) {
        if (total + n < response_size) {
            memcpy(response_body + total, buffer, n);
        }

        total += n;

        if (total >= response_size) {
            break;
        }
    }

    close(sock);

    if (response_size > 0) {
        response_body[total < response_size ? total : response_size - 1] = '\0';
    }

    int status = 0;
    sscanf(response_body, "HTTP/1.%*d %d", &status);

    char *header_end = strstr(response_body, "\r\n\r\n");

    if (header_end) {
        size_t header_len = (size_t)(header_end - response_body) + 4;
        size_t body_received = total > header_len ? total - header_len : 0;

        if (body_received > 0) {
            memmove(response_body, response_body + header_len, body_received);
        }

        if (body_received < response_size) {
            response_body[body_received] = '\0';
        }
    }

    return status;
}
