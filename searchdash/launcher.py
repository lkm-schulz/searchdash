"""Process orchestration: build the frontend if needed, then serve.

Production serves the prebuilt ``dist/`` and the API from a single uvicorn
process. Dev runs the API in a background thread and spawns the Vite dev server,
which proxies ``/api`` back to the API port for HMR.
"""

from __future__ import annotations

import os
import subprocess
import threading
import webbrowser
from pathlib import Path

import uvicorn

from .ports import ensure_port_free, find_free_port
from .server import create_app

DEFAULT_PORT = 8123
"""Port auto-resolution starts from when no explicit ``--port`` is given."""

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
"""Location of the Vite project bundled with the package."""

DIST_DIR = FRONTEND_DIR / "dist"
"""Prebuilt frontend bundle served in production."""


def _ensure_built(rebuild: bool) -> None:
    """Build the frontend if ``dist/`` is missing or ``rebuild`` is requested.

    Runs ``npm install`` first when ``node_modules`` is absent.
    """
    if DIST_DIR.is_dir() and not rebuild:
        return
    if not (FRONTEND_DIR / "node_modules").is_dir():
        print("[searchdash] installing frontend dependencies (npm install)...")
        subprocess.run(["npm", "install"], cwd=FRONTEND_DIR, check=True)
    print("[searchdash] building frontend (npm run build)...")
    subprocess.run(["npm", "run", "build"], cwd=FRONTEND_DIR, check=True)


def run_prod(
    root: Path,
    initial_datadir: Path | None,
    run_config_fallback: Path | None,
    port: int | None,
    rebuild: bool,
    interval_ms: int,
    no_default_config: bool = False,
) -> None:
    """Serve API + prebuilt SPA from one uvicorn process.

    Args:
        root: Subtree datadirs are browsed/resolved under at runtime.
        initial_datadir: Datadir to open on startup, or None for the home picker.
        run_config_fallback: Fallback run record reused when a datadir has none.
        port: Exact port to serve on, or None to auto-pick a free one from ``DEFAULT_PORT``.
        rebuild: Force a frontend rebuild even if ``dist/`` exists.
        interval_ms: Default client poll interval surfaced via ``/api/config``.
        no_default_config: Disable the bundled ``default_run.yaml`` deep-merge.
    """
    _ensure_built(rebuild)
    free_port = ensure_port_free(port) if port is not None else find_free_port(DEFAULT_PORT)
    app = create_app(
        root,
        dist_dir=DIST_DIR,
        poll_interval_ms=interval_ms,
        initial_datadir=initial_datadir,
        run_config_fallback=run_config_fallback,
        use_default_run=not no_default_config,
    )
    url = f"http://127.0.0.1:{free_port}"
    print(f"[searchdash] serving datadirs under {root} at {url}")
    _open_browser_later(url)
    # timeout_keep_alive=0 disables HTTP keep-alive so the browser never pools idle
    # sockets to this origin; otherwise, after a stop/restart on the same port, it
    # reuses a now-dead pooled socket and the next load stalls ~30s before retrying.
    uvicorn.run(app, host="127.0.0.1", port=free_port, log_level="info", timeout_keep_alive=0)


def run_dev(
    root: Path,
    initial_datadir: Path | None,
    run_config_fallback: Path | None,
    port: int | None,
    interval_ms: int,
    no_default_config: bool = False,
) -> None:
    """Run the API in a thread and spawn the Vite dev server with HMR.

    The UI port is the one the user opens, so an explicit ``--port`` pins it (with
    the API on the next port); both are required exactly and fail loudly if busy.

    Args:
        root: Subtree datadirs are browsed/resolved under at runtime.
        initial_datadir: Datadir to open on startup, or None for the home picker.
        run_config_fallback: Fallback run record reused when a datadir has none.
        port: Exact UI port to serve on, or None to auto-pick free ports from ``DEFAULT_PORT``.
        interval_ms: Default client poll interval surfaced via ``/api/config``.
        no_default_config: Disable the bundled ``default_run.yaml`` deep-merge.
    """
    if port is not None:
        ui_port = ensure_port_free(port)
        api_port = ensure_port_free(port + 1)
    else:
        ui_port = find_free_port(DEFAULT_PORT)
        api_port = find_free_port(ui_port + 1)

    app = create_app(
        root,
        dist_dir=None,
        poll_interval_ms=interval_ms,
        initial_datadir=initial_datadir,
        run_config_fallback=run_config_fallback,
        use_default_run=not no_default_config,
    )
    config = uvicorn.Config(app, host="127.0.0.1", port=api_port, log_level="info", timeout_keep_alive=0)
    server = uvicorn.Server(config)
    api_thread = threading.Thread(target=server.run, daemon=True)
    api_thread.start()

    env = {**os.environ, "API_PORT": str(api_port)}
    url = f"http://127.0.0.1:{ui_port}"
    print(f"[searchdash] dev: API on :{api_port}, Vite UI at {url}")
    _open_browser_later(url)
    vite = subprocess.Popen(
        ["npm", "run", "dev", "--", "--port", str(ui_port), "--strictPort"],
        cwd=FRONTEND_DIR,
        env=env,
    )
    try:
        vite.wait()
    except KeyboardInterrupt:
        pass
    finally:
        vite.terminate()
        server.should_exit = True


def _open_browser_later(url: str, delay: float = 1.5) -> None:
    """Open ``url`` in the default browser after a short startup delay."""
    timer = threading.Timer(delay, lambda: webbrowser.open(url))
    timer.daemon = True
    timer.start()
