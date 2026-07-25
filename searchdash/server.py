"""FastAPI app factory: read-only ``/api`` routes plus optional static SPA mount.

The same process that launches the dashboard serves the API. In production the
prebuilt ``frontend/dist/`` is mounted so the whole app is served from one port;
in dev the static mount is skipped because Vite serves the UI and proxies
``/api`` back here.
"""

from __future__ import annotations

import mimetypes
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .datadir import ArtifactNotFoundError, DataDir, Iteration, RunMeta, load_default_run


class BrowseEntry(BaseModel):
    """One child directory surfaced by ``/api/browse`` for path autocomplete."""

    path: str
    """Path of the directory, relative to the served root."""
    name: str
    """Base name (final path component)."""
    isDatadir: bool
    """Whether the directory looks like a datadir (has an ``iterations/`` subdir)."""


class ValidateResult(BaseModel):
    """Outcome of validating a candidate datadir via ``/api/validate``."""

    valid: bool
    """Whether the path resolves to a directory under the served root."""
    isDatadir: bool
    """Whether that directory looks like a datadir."""
    name: str | None
    """Base name of the path, or None when invalid."""


class DatadirResolver:
    """Resolves URL-supplied datadir paths to confined ``DataDir`` views.

    Holds the served ``root`` and the optional run-record fallback, and owns all
    path-confinement logic so every route shares one safe resolution path.
    """

    def __init__(self, root: Path, run_config_fallback: Path | None, default_run: dict | None = None) -> None:
        """Bind the resolver to ``root`` with an optional ``run`` record fallback.

        Args:
            root: Subtree all resolved paths are confined to.
            run_config_fallback: Fallback run record reused when a datadir has none.
            default_run: Bundled default-run mapping deep-merged under each datadir's
                own record; ``None`` disables the bundled default.
        """
        self.root = root.resolve()
        self.run_config_fallback = run_config_fallback
        self.default_run = default_run

    def resolve_under_root(self, path: str) -> Path:
        """Resolve ``path`` (absolute or relative to ``root``) and confine it.

        Raises:
            HTTPException: 400 if the resolved path escapes ``root``.
        """
        target = Path(path).resolve() if os.path.isabs(path) else (self.root / path).resolve()
        if not target.is_relative_to(self.root):
            raise HTTPException(status_code=400, detail=f"path is outside the served root: {path!r}")
        return target

    def relative_to_root(self, target: Path) -> str:
        """Render ``target`` as a path relative to ``root`` (``"."`` for the root itself).

        Datadirs are surfaced and stored relative to ``root`` so the picker, URL,
        and header all show clean root-relative paths rather than long absolutes.
        """
        return str(target.relative_to(self.root))

    def resolve_datadir(self, datadir: str) -> DataDir:
        """Resolve a ``datadir`` query param to a confined ``DataDir``.

        Raises:
            HTTPException: 400 if the path escapes ``root``, 404 if not a directory.
        """
        target = self.resolve_under_root(datadir)
        if not target.is_dir():
            raise HTTPException(status_code=404, detail=f"datadir is not a directory: {datadir!r}")
        return DataDir(target, run_config_fallback=self.run_config_fallback, default_run=self.default_run)

    def browse(self, path: str) -> list[BrowseEntry]:
        """List child directories for autocomplete, confined to ``root``.

        ``path`` is interpreted leniently: if it names an existing directory its
        children are listed; otherwise its parent is listed filtered to the typed
        leaf prefix, so partial input still suggests matches.
        """
        try:
            raw = self.resolve_under_root(path) if path else self.root
        except HTTPException:
            return []
        parent, prefix = (raw, "") if raw.is_dir() else (raw.parent, raw.name)
        if not parent.is_dir() or not parent.is_relative_to(self.root):
            return []
        return [
            BrowseEntry(
                path=self.relative_to_root(child),
                name=child.name,
                isDatadir=(child / "iterations").is_dir(),
            )
            for child in sorted(parent.iterdir(), key=lambda p: p.name)
            if child.is_dir() and child.name.startswith(prefix)
        ]

    def validate(self, datadir: str) -> ValidateResult:
        """Report whether ``datadir`` is a valid, confined directory and a datadir."""
        try:
            resolved = self.resolve_datadir(datadir)
        except HTTPException:
            return ValidateResult(valid=False, isDatadir=False, name=None)
        return ValidateResult(valid=True, isDatadir=resolved.is_datadir, name=resolved.root.name)


def create_app(
    root: Path,
    dist_dir: Path | None = None,
    poll_interval_ms: int = 5000,
    initial_datadir: Path | None = None,
    run_config_fallback: Path | None = None,
    use_default_run: bool = True,
) -> FastAPI:
    """Build the FastAPI app serving any datadir under ``root``.

    Data routes take a ``datadir`` query param resolved per request under ``root``
    (a cheap re-scan each time, matching the no-cache design), so one instance
    serves every experiment in the subtree.

    Args:
        root: Subtree datadirs are resolved/browsed under; paths outside it are refused.
        dist_dir: Prebuilt frontend bundle to serve; omitted in dev mode.
        poll_interval_ms: Default client poll interval surfaced at ``/api/config``.
        initial_datadir: Datadir the client opens on startup, or None for the home picker.
        run_config_fallback: Fallback run record reused when a datadir has none.
        use_default_run: Deep-merge the bundled ``default_run.yaml`` under each
            datadir's own record; ``False`` disables it (``--no-default-config``).

    Returns:
        The configured FastAPI application.
    """
    default_run = load_default_run() if use_default_run else None
    resolver = DatadirResolver(root, run_config_fallback, default_run)
    app = FastAPI(title="searchdash", docs_url="/api/docs", openapi_url="/api/openapi.json")
    _register_meta_routes(app, resolver, poll_interval_ms, initial_datadir)
    _register_data_routes(app, resolver)
    if dist_dir is not None:
        _mount_spa(app, dist_dir)
    return app


def _register_meta_routes(
    app: FastAPI,
    resolver: DatadirResolver,
    poll_interval_ms: int,
    initial_datadir: Path | None,
) -> None:
    """Register the non-data routes: client config, directory browse, validation."""

    @app.get("/api/config")
    def get_config() -> dict[str, object]:
        """Return launcher-provided client defaults (poll interval, root, initial datadir)."""
        return {
            "pollIntervalMs": poll_interval_ms,
            "root": str(resolver.root),
            "initialDatadir": (
                resolver.relative_to_root(initial_datadir.resolve()) if initial_datadir is not None else None
            ),
        }

    @app.get("/api/browse", response_model=list[BrowseEntry])
    def browse(path: str = Query("")) -> list[BrowseEntry]:
        """List child directories under ``path`` for path autocomplete."""
        return resolver.browse(path)

    @app.get("/api/validate", response_model=ValidateResult)
    def validate(datadir: str = Query(...)) -> ValidateResult:
        """Report whether ``datadir`` is a valid, confined directory and a datadir."""
        return resolver.validate(datadir)


def _register_data_routes(app: FastAPI, resolver: DatadirResolver) -> None:
    """Register the per-datadir data routes: run, iterations, single iteration, artifact."""

    @app.get("/api/run", response_model=RunMeta)
    def get_run(datadir: str = Query(...)) -> RunMeta:
        """Return resolved run metadata for ``datadir``."""
        return resolver.resolve_datadir(datadir).load_run()

    @app.get("/api/iterations", response_model=list[Iteration])
    def get_iterations(datadir: str = Query(...)) -> list[Iteration]:
        """Return all iteration records for ``datadir``, sorted by id."""
        return resolver.resolve_datadir(datadir).load_iterations()

    @app.get("/api/iterations/{iteration_id}", response_model=Iteration)
    def get_iteration(iteration_id: str, datadir: str = Query(...)) -> Iteration:
        """Return one full iteration record, including its artifact descriptors."""
        iteration = resolver.resolve_datadir(datadir).load_iteration(iteration_id)
        if iteration is None:
            raise HTTPException(status_code=404, detail=f"iteration not found: {iteration_id}")
        return iteration

    @app.get("/api/iterations/{iteration_id}/artifact")
    def get_artifact(iteration_id: str, path: str = Query(...), datadir: str = Query(...)) -> FileResponse:
        """Return raw artifact bytes for ``path`` within the iteration subdir."""
        try:
            target = resolver.resolve_datadir(datadir).resolve_artifact(iteration_id, path)
        except ArtifactNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        media_type, _ = mimetypes.guess_type(target.name)
        return FileResponse(target, media_type=media_type or "text/plain")


def _mount_spa(app: FastAPI, dist_dir: Path) -> None:
    """Serve the built SPA from ``dist_dir`` with client-side-routing fallback.

    Static assets resolve directly; any other non-API path falls back to
    ``index.html`` so deep links like ``/iteration/0001`` work on reload.
    """
    index_file = dist_dir / "index.html"
    app.mount("/assets", StaticFiles(directory=dist_dir / "assets"), name="assets")

    def _index_response() -> FileResponse:
        """Serve the SPA entry point, never cached so rebuilds are picked up.

        The HTML references content-hashed asset filenames; caching the HTML
        would pin the browser to a previous build whose assets no longer exist,
        leaving the app stuck on load after a server restart.
        """
        return FileResponse(index_file, headers={"Cache-Control": "no-store"})

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str) -> FileResponse:
        """Serve a matching static file, else the SPA entry point."""
        candidate = (dist_dir / full_path).resolve()
        if full_path and candidate.is_relative_to(dist_dir.resolve()) and candidate.is_file():
            return FileResponse(candidate)
        return _index_response()
