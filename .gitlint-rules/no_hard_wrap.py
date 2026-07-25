"""Custom gitlint rule: forbid fixed-column hard-wrapping in commit bodies.

Repo commit convention: never hard-wrap commit bodies at a fixed column. Break
only at sentence or paragraph boundaries — so each paragraph (and each bullet)
is a single physical line, however long, and the renderer soft-wraps.

This rule fires when a body line looks like it was cut mid-sentence and the next
line continues it: a substantial line that does not end at a sentence boundary
and is followed by a non-blank, non-bullet line.
"""

from __future__ import annotations

from gitlint.rules import CommitRule, RuleViolation

_SENTENCE_TERMINATORS = (".", "!", "?", ":", ";")
_BULLET_PREFIXES = ("- ", "* ", "+ ")
_MIN_WRAP_LENGTH = 50
"""Only flag lines at least this long: a genuine fixed-column wrap sits near the
margin, so its first physical line is long. Avoids false positives on short labels."""


def _is_list_item(line: str) -> bool:
    """Whether ``line`` starts a new bullet or numbered list item."""
    stripped = line.lstrip()
    if stripped.startswith(_BULLET_PREFIXES):
        return True
    return len(stripped) >= 2 and stripped[0].isdigit() and stripped[1] in ".)"


class BodyNoHardWrap(CommitRule):
    """Reject commit bodies hard-wrapped at a fixed column."""

    name = "body-no-hard-wrap"
    id = "UC1"

    def validate(self, commit) -> list[RuleViolation]:  # noqa: ANN001
        lines = commit.message.body
        violations: list[RuleViolation] = []
        for index, line in enumerate(lines):
            if not line.strip():
                continue
            next_line = lines[index + 1] if index + 1 < len(lines) else ""
            if not next_line.strip() or _is_list_item(next_line):
                continue
            stripped = line.rstrip()
            if stripped.endswith(_SENTENCE_TERMINATORS):
                continue
            if len(stripped) < _MIN_WRAP_LENGTH:
                continue
            violations.append(
                RuleViolation(
                    self.id,
                    "Body line appears hard-wrapped mid-sentence; break only at sentence/"
                    "paragraph boundaries (one line per paragraph/bullet, no fixed-column wrap)",
                    line,
                    index + 1,
                )
            )
        return violations
