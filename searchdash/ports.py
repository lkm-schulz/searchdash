"""Free-port discovery so multiple dashboard instances can coexist."""

from __future__ import annotations

import socket


def find_free_port(start: int, host: str = "127.0.0.1", max_scan: int = 200) -> int:
    """Scan upward from ``start`` and return the first bindable TCP port.

    Args:
        start: First port to try.
        host: Interface to bind-test against.
        max_scan: Maximum number of consecutive ports to probe.

    Returns:
        The first free port found.

    Raises:
        RuntimeError: If no free port is found within ``max_scan`` attempts.
    """
    for port in range(start, start + max_scan):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((host, port))
            except OSError:
                continue
            return port
    raise RuntimeError(f"no free port in range [{start}, {start + max_scan})")


def ensure_port_free(port: int, host: str = "127.0.0.1") -> int:
    """Return ``port`` if bindable on ``host``, else raise loudly.

    Used for an explicitly requested port: a busy port fails with a clear error
    instead of silently scanning upward to a different one.

    Raises:
        RuntimeError: If ``port`` cannot be bound on ``host``.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError as exc:
            raise RuntimeError(f"port {port} on {host} is already in use") from exc
    return port
