"""Command-line entry point: ``searchdash [datadir] [options]``."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer

from .launcher import run_dev, run_prod

app = typer.Typer(add_completion=False, help="Watch per-iteration experiment progress in a read-only web dashboard.")


@app.command()
def launch(
    datadir: Annotated[
        Path | None,
        typer.Argument(help="Datadir to open on startup; omit to land on the home picker."),
    ] = None,
    root: Annotated[
        Path | None,
        typer.Option("--root", help="Confine browsing/autocomplete to this subtree (default: cwd)."),
    ] = None,
    port: Annotated[
        int | None,
        typer.Option(help="Port to serve on (the one you open); omit to auto-pick a free port from 8123 upward."),
    ] = None,
    dev: Annotated[
        bool, typer.Option("--dev", help="Run Vite dev server with HMR instead of the prebuilt bundle.")
    ] = False,
    interval: Annotated[float, typer.Option(help="Default client poll interval in seconds.")] = 5.0,
    rebuild: Annotated[
        bool, typer.Option("--rebuild", help="Force a frontend rebuild before serving (prod only).")
    ] = False,
    run_config: Annotated[
        Path | None,
        typer.Option("--run-config", help="Fallback run record (JSON or YAML) reused when a datadir has none."),
    ] = None,
    no_default_config: Annotated[
        bool,
        typer.Option(
            "--no-default-config", help="Disable the bundled default run record deep-merged under each datadir."
        ),
    ] = False,
) -> None:
    """Launch the dashboard, browsing datadirs under ``root`` on an auto-selected free port.

    With ``datadir`` the dashboard opens that experiment directly; without it the
    home picker is shown. Either way any datadir under ``root`` is reachable at
    runtime via the URL ``?datadir=`` query, so a single instance serves every
    experiment.
    """
    root_resolved = (root or Path.cwd()).expanduser().resolve()
    if not root_resolved.is_dir():
        raise typer.BadParameter(f"root is not a directory: {root_resolved}")

    initial_datadir = datadir.expanduser().resolve() if datadir is not None else None
    if initial_datadir is not None:
        if not initial_datadir.is_dir():
            raise typer.BadParameter(f"datadir is not a directory: {initial_datadir}")
        if not initial_datadir.is_relative_to(root_resolved):
            raise typer.BadParameter(f"datadir {initial_datadir} is outside --root {root_resolved}")

    run_config_resolved = run_config.expanduser().resolve() if run_config is not None else None
    interval_ms = int(interval * 1000)
    if dev:
        run_dev(root_resolved, initial_datadir, run_config_resolved, port, interval_ms, no_default_config)
    else:
        run_prod(root_resolved, initial_datadir, run_config_resolved, port, rebuild, interval_ms, no_default_config)


def main() -> None:
    """Console-script entry point."""
    app()


if __name__ == "__main__":
    main()
