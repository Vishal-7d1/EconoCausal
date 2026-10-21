"""
dml_service.py (02_Causal_ML Adapter)
=====================================
Part of EconoCausal: Dynamic Pricing via Double Machine Learning
Module: 02_Causal_ML

This module provides a clean import bridge to the production CausalDMLService.

Architecture Note:
    Standard Python syntax forbids importing from directories whose names begin with digits
    (e.g., `import 02_Causal_ML.dml_service` raises `SyntaxError: invalid decimal literal`).
    To ensure reliable, idiomatic imports across both the FastAPI backend and test runners,
    the primary service implementation resides in `04_Frontend_Dashboard/backend/dml_service.py`.
    This file imports and re-exports all classes, schemas, and exceptions for parity.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "04_Frontend_Dashboard" / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from dml_service import (
        CausalDMLService,
        CATEBatchResponse,
        SinglePredictionResult,
        CausalInferenceError,
        ModelArtifactError,
        FeatureValidationError,
        DataLeakageError,
        UnsupportedInferenceError,
        PREVET_FEATURE_COLS,
        PROHIBITED_COLUMNS,
    )
except ImportError as e:
    raise ImportError(
        f"Failed to import CausalDMLService from backend directory {BACKEND_DIR}: {e}"
    ) from e

__all__ = [
    "CausalDMLService",
    "CATEBatchResponse",
    "SinglePredictionResult",
    "CausalInferenceError",
    "ModelArtifactError",
    "FeatureValidationError",
    "DataLeakageError",
    "UnsupportedInferenceError",
    "PREVET_FEATURE_COLS",
    "PROHIBITED_COLUMNS",
]
