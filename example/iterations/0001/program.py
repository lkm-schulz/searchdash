"""Baseline per-engine time head: a plain linear projection over the backbone."""

import torch
from torch import nn


class TimeHead(nn.Module):
    """Predicts wall-clock seconds for one engine from a shared embedding."""

    def __init__(self, embed_dim: int) -> None:
        super().__init__()
        self.proj = nn.Linear(embed_dim, 1)

    def forward(self, embedding: torch.Tensor) -> torch.Tensor:
        """Map the embedding to a scalar time prediction (seconds)."""
        return self.proj(embedding).squeeze(-1)
