"""Manifest validator for BillZen AI assistant assets."""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple


ALLOWED_ROLES = {
    "weights_safetensors",
    "weights_onnx",
    "tokenizer_config",
    "tokenizer_vocabulary",
    "model_config",
    "calibration_bins",
}

ALLOWED_PROVENANCE = {
    "upstream_huggingface",
    "locally_exported_onnx",
    "synthetic_calibration",
}


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

    # License
    lic = manifest_dict.get("license")
    if not isinstance(lic, str) or not lic.strip():
        errors.append("license must be a non-empty string")

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
    else:
        if not isinstance(be["id"], str) or not be["id"].strip():
            errors.append("base_encoder.id must be a non-empty string")
        if not isinstance(be["license"], str) or not be["license"].strip():
            errors.append("base_encoder.license must be a non-empty string")

    # Assets
    assets = manifest_dict.get("assets")
    if not isinstance(assets, list) or len(assets) == 0:
        errors.append("assets must be a non-empty list")
    else:
        sha256_pattern = re.compile(r"^[0-9a-f]{64}$")
        seen_paths: Set[str] = set()

        for idx, asset in enumerate(assets):
            if not isinstance(asset, dict):
                errors.append(f"Asset at index {idx} must be an object")
                continue

            for req in ["filename", "sha256", "size_bytes", "role", "provenance"]:
                if req not in asset:
                    errors.append(f"Asset at index {idx} missing required field '{req}'")

            # Filename validation
            fname = str(asset.get("filename", "")).strip()
            if not fname:
                errors.append(f"Asset at index {idx} has an empty filename")
            else:
                # Path traversal / escape rejection
                if ".." in fname:
                    errors.append(f"Asset at index {idx} contains dangerous path traversal in filename: '{fname}'")
                if fname.startswith("/") or fname.startswith("\\"):
                    errors.append(f"Asset at index {idx} contains absolute path in filename: '{fname}'")
                if re.match(r"^[a-zA-Z]:", fname):
                    errors.append(f"Asset at index {idx} contains Windows drive letter path in filename: '{fname}'")
                if fname.startswith("//") or fname.startswith("\\\\"):
                    errors.append(f"Asset at index {idx} contains UNC share path in filename: '{fname}'")
                if "\\" in fname:
                    errors.append(f"Asset at index {idx} contains backslash path separator in filename: '{fname}'")

                # Normalize path and check duplicates
                norm_fname = os.path.normpath(fname).replace("\\", "/")
                if norm_fname in seen_paths:
                    errors.append(f"Duplicate asset filename: '{norm_fname}'")
                seen_paths.add(norm_fname)

            # Role validation
            role = asset.get("role")
            if not isinstance(role, str) or not role.strip():
                errors.append(f"Asset at index {idx} role must be a non-empty string")
            elif role not in ALLOWED_ROLES:
                errors.append(f"Asset at index {idx} has unsupported role: '{role}'")

            # Provenance validation
            prov = asset.get("provenance")
            if not isinstance(prov, str) or not prov.strip():
                errors.append(f"Asset at index {idx} provenance must be a non-empty string")
            elif prov not in ALLOWED_PROVENANCE:
                errors.append(f"Asset at index {idx} has unsupported provenance: '{prov}'")

            # SHA256 validation
            sha = str(asset.get("sha256", ""))
            if not sha256_pattern.match(sha):
                errors.append(f"Asset at index {idx} has invalid sha256 format: '{sha}'")

            # Size bytes validation: Python bool is an int subclass, so type check must disallow bool!
            size = asset.get("size_bytes")
            if isinstance(size, bool) or not isinstance(size, int) or size <= 0:
                errors.append(f"Asset at index {idx} size_bytes must be a positive integer (not boolean), got: {size}")

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


def verify_asset_file_integrity(
    manifest_dict: Dict[str, Any], root_dir: Path
) -> Tuple[bool, List[str]]:
    """Verify that physical asset files match their declared sha256 and size_bytes."""
    errors: List[str] = []
    root = root_dir.resolve()

    for idx, asset in enumerate(manifest_dict.get("assets", [])):
        fname = asset.get("filename", "")
        file_path = (root / fname).resolve()

        # Security check: must remain within root_dir
        try:
            file_path.relative_to(root)
        except ValueError:
            errors.append(f"Asset at index {idx} escapes root directory: '{fname}'")
            continue

        if not file_path.is_file():
            errors.append(f"Asset file not found on disk: '{fname}'")
            continue

        content = file_path.read_bytes()
        actual_size = len(content)
        expected_size = asset.get("size_bytes")
        if actual_size != expected_size:
            errors.append(
                f"Asset '{fname}' size mismatch: expected {expected_size}, got {actual_size}"
            )

        actual_sha = hashlib.sha256(content).hexdigest()
        expected_sha = asset.get("sha256", "").lower()
        if actual_sha != expected_sha:
            errors.append(
                f"Asset '{fname}' sha256 mismatch: expected {expected_sha}, got {actual_sha}"
            )

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
