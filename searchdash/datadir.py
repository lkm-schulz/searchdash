"""Read-only scanner that parses a ``<datadir>`` into typed records.

The on-disk contract is documented in ``README.md``. A datadir holds an optional
run-level ``run`` record plus an ``iterations/`` tree with one subdirectory per
iteration, each carrying a required ``iteration`` record and optional nested
artifact files (diffs, code, configs) referenced by relative path. Records may be
written as either JSON (``.json``) or YAML (``.yaml``/``.yml``).

Every read re-scans the directory; the JSON payloads are small so no caching is
applied.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

logger = logging.getLogger(__name__)

STRUCTURED_SUFFIXES = (".yaml", ".yml", ".json")
"""Recognized record extensions, in precedence order; YAML wins over JSON when
both are present for the same stem."""


def parse_structured_file(path: Path) -> object:
    """Parse a JSON or YAML record file, branching on its extension.

    Args:
        path: File to read; must end in one of ``STRUCTURED_SUFFIXES``.

    Returns:
        The decoded Python object (typically a ``dict``).

    Raises:
        ValueError: If the extension is not a recognized structured format.
        json.JSONDecodeError: If a ``.json`` file is malformed.
        yaml.YAMLError: If a ``.yaml``/``.yml`` file is malformed.
    """
    suffix = path.suffix.lower()
    if suffix == ".json":
        return json.loads(path.read_text())
    if suffix in (".yaml", ".yml"):
        return yaml.safe_load(path.read_text())
    raise ValueError(f"unsupported structured-data extension: {path.suffix!r}")


def find_structured_file(directory: Path, stem: str) -> Path | None:
    """Locate ``<stem>`` in ``directory`` across the supported extensions.

    Args:
        directory: Directory to search.
        stem: Filename without extension (e.g. ``"run"`` or ``"iteration"``).

    Returns:
        The highest-precedence existing file, or ``None`` if none exist. When more
        than one extension is present for the same stem, the winner is returned and
        the shadowed files are logged as a warning.
    """
    matches = [candidate for suffix in STRUCTURED_SUFFIXES if (candidate := directory / f"{stem}{suffix}").is_file()]
    if not matches:
        return None
    if len(matches) > 1:
        shadowed = ", ".join(path.name for path in matches[1:])
        logger.warning(
            "Multiple '%s' records in %s; using %s, ignoring %s",
            stem,
            directory,
            matches[0].name,
            shadowed,
        )
    return matches[0]


DEFAULT_RUN_PATH = Path(__file__).parent / "default_run.yaml"
"""Bundled curated run defaults, deep-merged under each datadir's own ``run`` record."""

_default_run_cache: dict | None = None


def load_default_run() -> dict:
    """Parse the bundled ``default_run.yaml`` once and cache the result.

    Returns:
        The decoded default-run mapping (a fresh deep copy is *not* made — callers
        treat it as read-only and always merge a datadir override on top of it).
    """
    global _default_run_cache
    if _default_run_cache is None:
        parsed = parse_structured_file(DEFAULT_RUN_PATH)
        if not isinstance(parsed, dict):
            raise ValueError(f"bundled default run is not a mapping: {DEFAULT_RUN_PATH}")
        _default_run_cache = parsed
    return _default_run_cache


def deep_merge(base: dict, override: dict) -> dict:
    """Recursively merge ``override`` onto ``base``, returning a new dict.

    Dict values are merged key-by-key (override wins per key); scalars and lists
    are replaced wholesale. Notably ``totals`` is a list, so a datadir that
    defines ``totals`` replaces the bundled default's totals entirely rather than
    appending to them.
    """
    merged = dict(base)
    for key, value in override.items():
        existing = merged.get(key)
        if isinstance(existing, dict) and isinstance(value, dict):
            merged[key] = deep_merge(existing, value)
        else:
            merged[key] = value
    return merged


class MetricMeta(BaseModel):
    """Display metadata for a single metric key."""

    label: str | None = None
    """Human-facing name; falls back to the metric key when absent."""

    higher_is_better: bool | None = Field(default=None, alias="higherIsBetter")
    """Whether larger values are better; ``None`` disables good/bad coloring."""

    format: str | None = None
    """Optional Python format spec (e.g. ``.3f``) for value rendering."""

    model_config = {"populate_by_name": True}


class TotalMeta(BaseModel):
    """One total displayed in the Totals card.

    Three flavors, distinguished by which field is set:
    - **aggregated**: `metric` set — the per-iteration metric is combined across
      iterations via `aggregation`.
    - **static**: `value` set — a standalone run-level figure entered directly in
      `run.yaml` (e.g. total cluster cost tallied after the fact), independent of
      any per-iteration metric. `label` is required since there is no metric key
      to fall back to.
    - **count-all**: neither `metric` nor `value` set — counts every iteration
      regardless of which metrics it carries. Requires `aggregation == "count"`
      and a `label` (there is no metric key to fall back to).
    At most one of `metric` / `value` may be set.
    """

    metric: str | None = None
    """Metric key (from iteration `metrics`) to aggregate across iterations; omit for a static total."""

    value: float | None = None
    """Standalone run-level value displayed verbatim; omit for an aggregated total."""

    label: str | None = None
    """Display label. Aggregated: falls back to metric's `MetricMeta.label` then key. Required for static totals."""

    aggregation: Literal["sum", "mean", "max", "min", "last", "count"] = "sum"
    """How to combine per-iteration values (aggregated only). `count` counts iterations with the metric present."""

    format: str | None = None
    """Python float spec (e.g. `.2f`); falls back to the metric's `MetricMeta.format`."""

    unit: str | None = None
    """Unit attached verbatim to the value; include any spacing yourself (e.g. `$`, ` USD`). Omit for a bare number."""

    unit_position: Literal["prefix", "suffix"] = Field(default="suffix", alias="unitPosition")
    """`unit` prepended (`prefix`, `$312.40`) or appended (`suffix`, `312.40 USD`). Ignored when `unit` absent."""

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def _check_metric_or_value(self) -> TotalMeta:
        """Allow at most one source — aggregated `metric` or static `value`.

        With neither set this is the count-all total: it counts every iteration,
        so it requires `aggregation == "count"` and a `label`. Static `value`
        totals likewise require a `label` (no metric key to fall back to).
        """
        if self.metric is not None and self.value is not None:
            raise ValueError("TotalMeta accepts at most one of `metric` or `value`")
        if self.metric is None and self.value is None:
            if self.aggregation != "count":
                raise ValueError("a total with neither `metric` nor `value` must use `aggregation: count`")
            if self.label is None:
                raise ValueError("count-all total (no `metric`/`value`) requires a `label`")
        if self.value is not None and self.label is None:
            raise ValueError("static total (with `value`) requires a `label`")
        return self


class GroupMeta(BaseModel):
    """Display metadata for a prefix group (the metric-key segment before the
    first ``.``)."""

    label: str | None = None
    """Human-facing group name; falls back to the prefix (or "General" for the
    unprefixed group) when absent."""

    model_config = {"populate_by_name": True}


class RunMeta(BaseModel):
    """Resolved run-level metadata driving labels, formatting, and metric sets."""

    name: str = "Experiment run"
    """Display name for the run."""

    metrics: dict[str, MetricMeta] = Field(default_factory=dict)
    """Per-metric display metadata keyed by metric key."""

    metric_sets: dict[str, list[str]] = Field(default_factory=dict, alias="metricSets")
    """Named presets mapping a set name to an ordered list of metric keys."""

    default_metric_set: str | None = Field(default=None, alias="defaultMetricSet")
    """Name of the metric set selected on first load."""

    groups: dict[str, GroupMeta] = Field(default_factory=dict)
    """Per-prefix display metadata keyed by prefix; the reserved key ``""`` names
    the unprefixed group."""

    totals: list[TotalMeta] = Field(default_factory=list)
    """Run-level aggregated totals shown in the Totals card; empty hides the card."""

    model_config = {"populate_by_name": True}


class Artifact(BaseModel):
    """Descriptor for a file artifact attached to an iteration."""

    type: str
    """Artifact kind: ``diff``, ``code``, or ``file``."""

    path: str
    """Path relative to the iteration subdirectory."""

    label: str | None = None
    """Human-facing label; falls back to the path when absent."""

    language: str | None = None
    """Optional syntax-highlighting language hint for ``code``/``file``."""


class Iteration(BaseModel):
    """One iteration record parsed from an ``iteration`` JSON/YAML file."""

    id: str
    """Iteration identifier; defaults to the subdirectory name when omitted."""

    parent: str | None = None
    """Identifier of the parent iteration, if any."""

    timestamp: str | None = None
    """ISO-8601 timestamp string, if recorded."""

    title: str | None = None
    """Short title for the change."""

    summary: str | None = None
    """One-line summary (markdown allowed)."""

    description: str | None = None
    """Longer markdown body for the detail page."""

    metrics: dict[str, float] = Field(default_factory=dict)
    """Metric key to numeric value mapping; null values are treated as unrecorded."""

    @field_validator("metrics", mode="before")
    @classmethod
    def _drop_null_metrics(cls, value: object) -> object:
        """Drop metrics whose value is null (a metric not available for this
        iteration), so they read as absent downstream rather than failing
        validation."""
        if isinstance(value, dict):
            return {key: val for key, val in value.items() if val is not None}
        return value

    island: int | None = None
    """Island this program belongs to, if recorded (for the deferred graph view)."""

    inspirations: list[str] = Field(default_factory=list)
    """Ids of iterations that inspired this one (for the deferred graph view)."""

    artifacts: list[Artifact] = Field(default_factory=list)
    """File artifacts attached to this iteration."""

    tags: list[str] = Field(default_factory=list)
    """Optional free-form tags."""


class ArtifactNotFoundError(Exception):
    """Raised when a requested artifact path is missing or escapes the subdir."""


class DataDir:
    """Read-only view over a per-iteration experiment artifact directory.

    Holds the datadir root plus an optional fallback ``run`` record path used when
    the datadir itself does not contain one.
    """

    def __init__(
        self,
        root: Path,
        run_config_fallback: Path | None = None,
        default_run: dict | None = None,
    ) -> None:
        """Bind the scanner to ``root`` with an optional ``run`` record fallback.

        Args:
            root: The datadir to scan.
            run_config_fallback: Path to a canonical ``run`` record (JSON or YAML)
                reused when the datadir has none of its own.
            default_run: Bundled default-run mapping deep-merged *under* the
                datadir's own record (datadir wins per key); ``None`` disables it.
        """
        self.root = root
        self.run_config_fallback = run_config_fallback
        self.default_run = default_run

    @property
    def iterations_dir(self) -> Path:
        """Directory holding the per-iteration subdirectories."""
        return self.root / "iterations"

    @property
    def is_datadir(self) -> bool:
        """Whether ``root`` looks like a datadir (has an ``iterations/`` subdir)."""
        return self.iterations_dir.is_dir()

    def load_run(self) -> RunMeta:
        """Resolve run metadata.

        The *override* is the datadir's own ``run`` record if present, else the
        ``run_config_fallback`` if present, else ``None``. When a bundled
        ``default_run`` is configured (or an override exists), the result is the
        override deep-merged onto the default (override wins per key). When both
        are absent, metadata is inferred from the metric keys across iterations.
        Records may be JSON or YAML.
        """
        override = self._load_override()
        if self.default_run is None and override is None:
            return self._infer_run()
        return RunMeta.model_validate(deep_merge(self.default_run or {}, override or {}))

    def _load_override(self) -> dict | None:
        """Resolve the datadir's run override: own ``run`` record, else the fallback."""
        run_path = find_structured_file(self.root, "run")
        if run_path is None and self.run_config_fallback is not None and self.run_config_fallback.is_file():
            run_path = self.run_config_fallback
        if run_path is None:
            return None
        parsed = parse_structured_file(run_path)
        if not isinstance(parsed, dict):
            raise ValueError(f"run record is not a mapping: {run_path}")
        return parsed

    def _infer_run(self) -> RunMeta:
        """Build default run metadata from the keys present in the iterations."""
        keys: list[str] = []
        seen: set[str] = set()
        for iteration in self.load_iterations():
            for key in iteration.metrics:
                if key not in seen:
                    seen.add(key)
                    keys.append(key)
        return RunMeta(
            name=self.root.name,
            metrics={key: MetricMeta() for key in keys},
            metricSets={"All": keys},
            defaultMetricSet="All",
        )

    def _iteration_dirs(self) -> list[Path]:
        """Return iteration subdirectories sorted by name."""
        if not self.iterations_dir.is_dir():
            return []
        dirs = [p for p in self.iterations_dir.iterdir() if p.is_dir()]
        return sorted(dirs, key=lambda p: p.name)

    def load_iterations(self) -> list[Iteration]:
        """Parse every iteration record, sorted by id, skipping malformed dirs."""
        iterations: list[Iteration] = []
        for subdir in self._iteration_dirs():
            iteration = self._load_iteration_dir(subdir)
            if iteration is not None:
                iterations.append(iteration)
        return iterations

    def load_iteration(self, iteration_id: str) -> Iteration | None:
        """Parse a single iteration by id, or ``None`` if absent/malformed."""
        subdir = self.iterations_dir / iteration_id
        if not subdir.is_dir():
            return None
        return self._load_iteration_dir(subdir)

    def _load_iteration_dir(self, subdir: Path) -> Iteration | None:
        """Parse one iteration subdirectory, defaulting ``id`` to the dir name.

        The record may be JSON or YAML; the first match in ``STRUCTURED_SUFFIXES``
        precedence wins.
        """
        record_path = find_structured_file(subdir, "iteration")
        if record_path is None:
            return None
        try:
            data = parse_structured_file(record_path)
            if not isinstance(data, dict):
                raise ValueError("record is not a mapping")
            data.setdefault("id", subdir.name)
            return Iteration.model_validate(data)
        except (json.JSONDecodeError, yaml.YAMLError, ValidationError, ValueError) as error:
            logger.warning("Skipping malformed iteration %s: %s", record_path, error)
            return None

    def resolve_artifact(self, iteration_id: str, rel_path: str) -> Path:
        """Resolve an artifact path, refusing anything escaping the iteration dir.

        Args:
            iteration_id: The iteration subdirectory name.
            rel_path: Path relative to that subdirectory.

        Returns:
            The resolved absolute path to the artifact file.

        Raises:
            ArtifactNotFoundError: If the path escapes the subdir or is missing.
        """
        subdir = (self.iterations_dir / iteration_id).resolve()
        target = (subdir / rel_path).resolve()
        if not target.is_relative_to(subdir):
            raise ArtifactNotFoundError(f"path escapes iteration dir: {rel_path!r}")
        if not target.is_file():
            raise ArtifactNotFoundError(f"artifact not found: {rel_path!r}")
        return target
