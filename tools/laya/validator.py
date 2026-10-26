"""Manifest validator for BillZen AI assistant assets."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple


class ManifestValidationError(ValueError):
    """Raised when an asset manifest fails verification."""


def validate_asset_manifest(manifest_dict: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validate asset manifest structure, types, security invariants and provenance."""
    errors: List[str] = []

    required_top = [
        "schema_version",
        "model_id",
        "checkpoint_revision",
        "base_encoder",
        "upstream_source_commit",
        "license",
        "assets",
        "hardware_target",
        "resource_ceiling",
    ]
    for key in required_top:
        if key not in manifest_dict:
            errors.append(f"Missing required top-level field: '{key}'")

    if errors:
        return False, errors

    # Schema version
    if manifest_dict["schema_version"] != "1.0.0":
        errors.append(f"Unsupported schema_version: {manifest_dict['schema_version']}")

    # Revisions / hashes: must be 40-char hex
    sha1_pattern = re.compile(r"^[0-9a-f]{40}$")
    if not sha1_pattern.match(str(manifest_dict["checkpoint_revision"])):
        errors.append(
            f"Invalid checkpoint_revision: '{manifest_dict['checkpoint_revision']}' (must be 40-char hex)"
        )

    if not sha1_pattern.match(str(manifest_dict["upstream_source_commit"])):
        errors.append(
            f"Invalid upstream_source_commit: '{manifest_dict['upstream_source_commit']}' (must be 40-char hex)"
        )

    # Base encoder
    be = manifest_dict.get("base_encoder")
    if not isinstance(be, dict) or "id" not in be or "license" not in be:
        errors.append("base_encoder must be an object with 'id' and 'license'")

    # Assets
    assets = manifest_dict.get("assets")
    if not isinstance(assets, list) or len(assets) == 0:
        errors.append("assets must be a non-empty list")
    else:
        sha256_pattern = re.compile(r"^[0-9a-f]{64}$")
        for idx, asset in enumerate(assets):
            if not isinstance(asset, dict):
                errors.append(f"Asset at index {idx} must be an object")
                continue

            for req in ["filename", "sha256", "size_bytes", "role", "provenance"]:
                if req not in asset:
                    errors.append(f"Asset at index {idx} missing required field '{req}'")

            fname = str(asset.get("filename", ""))
            # Path traversal rejection
            if ".." in fname or fname.startswith("/") or fname.startswith("\\"):
                errors.append(
                    f"Asset at index {idx} contains dangerous path traversal in filename: '{fname}'"
                )

            sha = str(asset.get("sha256", ""))
            if not sha256_pattern.match(sha):
                errors.append(
                    f"Asset at index {idx} has invalid sha256 format: '{sha}'"
                )

            size = asset.get("size_bytes")
            if not isinstance(size, int) or size <= 0:
                errors.append(
                    f"Asset at index {idx} size_bytes must be a positive integer, got: {size}"
                )

    # Hardware target & Resource ceiling
    hw = manifest_dict.get("hardware_target")
    if not isinstance(hw, dict) or "min_ram_mb" not in hw:
        errors.append("hardware_target must contain min_ram_mb")

    rc = manifest_dict.get("resource_ceiling")
    if not isinstance(rc, dict) or "max_rss_mb" not in rc or "max_warm_latency_ms" not in rc:
        errors.append("resource_ceiling must contain max_rss_mb and max_warm_latency_ms")
    elif rc.get("max_rss_mb", 0) > 1024:
        errors.append("resource_ceiling.max_rss_mb exceeds safe limit of 1024 MB")

    return (len(errors) == 0), errors


def load_and_validate_manifest(path: Path) -> Dict[str, Any]:
    """Load JSON file and validate against manifest rules."""
    if not path.is_file():
        raise ManifestValidationError(f"Manifest file not found: {path}")

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    is_valid, errors = validate_asset_manifest(data)
    if not is_valid:
        raise ManifestValidationError(f"Manifest validation failed: {'; '.join(errors)}")

    return data
