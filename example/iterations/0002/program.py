"""Per-engine time head predicting log1p(seconds) to tame the heavy tail."""

import torch
from torch import nn


class TimeHead(nn.Module):
    """Predicts log1p wall-clock seconds for one engine from a shared embedding."""

    def __init__(self, embed_dim: int) -> None:
        super().__init__()
        self.proj = nn.Linear(embed_dim, 1)

    def forward(self, embedding: torch.Tensor) -> torch.Tensor:
        """Map the embedding to a log1p-time prediction; invert with expm1 at eval."""
        return self.proj(embedding).squeeze(-1)

    def to_seconds(self, prediction: torch.Tensor) -> torch.Tensor:
        """Invert the log1p transform back to seconds."""
        return torch.expm1(prediction)
