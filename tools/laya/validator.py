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


def _is_strict_int(val: Any) -> bool:
    """Check that value is a finite integer, disallowing booleans, floats, and strings."""
    return isinstance(val, int) and not isinstance(val, bool)


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

    # Hardware target & Resource ceiling strict finite validation
    hw = manifest_dict.get("hardware_target")
    if not isinstance(hw, dict) or "min_ram_mb" not in hw:
        errors.append("hardware_target must contain min_ram_mb")
    else:
        min_ram = hw.get("min_ram_mb")
        if not _is_strict_int(min_ram) or min_ram < 512:
            errors.append(f"hardware_target.min_ram_mb must be a finite integer >= 512, got: {min_ram}")
        cpu = hw.get("cpu")
        if not isinstance(cpu, str) or not cpu.strip():
            errors.append("hardware_target.cpu must be a non-empty string")
        if not isinstance(hw.get("has_accelerator"), bool):
            errors.append("hardware_target.has_accelerator must be a boolean")

    rc = manifest_dict.get("resource_ceiling")
    if not isinstance(rc, dict) or "max_rss_mb" not in rc or "max_warm_latency_ms" not in rc or "max_load_timeout_ms" not in rc:
        errors.append("resource_ceiling must contain max_rss_mb, max_warm_latency_ms, and max_load_timeout_ms")
    else:
        max_rss = rc.get("max_rss_mb")
        if not _is_strict_int(max_rss) or max_rss < 64 or max_rss > 1024:
            errors.append(f"resource_ceiling.max_rss_mb must be a finite integer between 64 and 1024 MB, got: {max_rss}")

        max_lat = rc.get("max_warm_latency_ms")
        if not _is_strict_int(max_lat) or max_lat < 1 or max_lat > 2000:
            errors.append(f"resource_ceiling.max_warm_latency_ms must be a finite integer between 1 and 2000 ms, got: {max_lat}")

        max_timeout = rc.get("max_load_timeout_ms")
        if not _is_strict_int(max_timeout) or max_timeout < 1 or max_timeout > 15000:
            errors.append(f"resource_ceiling.max_load_timeout_ms must be a finite integer between 1 and 15000 ms, got: {max_timeout}")

    return (len(errors) == 0), errors


def verify_asset_file_integrity(
    manifest_dict: Dict[str, Any], root_dir: Path | str
) -> Tuple[bool, List[str]]:
    """Verify that physical asset files match their declared sha256 and size_bytes.
    
    Streams file bytes in 64 KiB chunks to avoid large memory allocations during verification.
    Rejects invalid, missing, or empty asset manifests.
    Accepts root_dir as Path or str.
    """
    errors: List[str] = []
    if not isinstance(manifest_dict, dict):
        return False, ["Manifest must be a dictionary"]

    assets = manifest_dict.get("assets")
    if not isinstance(assets, list) or len(assets) == 0:
        return False, ["Manifest assets list must be non-empty"]

    root = Path(root_dir).resolve()

    for idx, asset in enumerate(assets):
        if not isinstance(asset, dict):
            errors.append(f"Asset at index {idx} must be a dictionary")
            continue

        fname = asset.get("filename", "")
        if not isinstance(fname, str) or not fname.strip():
            errors.append(f"Asset at index {idx} missing valid filename")
            continue

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

        expected_size = asset.get("size_bytes")
        if not _is_strict_int(expected_size) or expected_size <= 0:
            errors.append(f"Asset '{fname}' has invalid expected size_bytes: {expected_size}")
            continue

        # Stream file in 64 KiB chunks
        sha256 = hashlib.sha256()
        actual_size = 0
        with file_path.open("rb") as f:
            while True:
                chunk = f.read(65536)
                if not chunk:
                    break
                sha256.update(chunk)
                actual_size += len(chunk)

        if actual_size != expected_size:
            errors.append(
                f"Asset '{fname}' size mismatch: expected {expected_size}, got {actual_size}"
            )

        actual_sha = sha256.hexdigest().lower()
        expected_sha = str(asset.get("sha256", "")).lower()
        if actual_sha != expected_sha:
            errors.append(
                f"Asset '{fname}' sha256 mismatch: expected {expected_sha}, got {actual_sha}"
            )

    return (len(errors) == 0), errors


def load_and_validate_manifest(path: Path | str) -> Dict[str, Any]:
    """Load JSON file and validate against manifest rules. Accepts path as Path or str."""
    p = Path(path)
    if not p.is_file():
        raise ManifestValidationError(f"Manifest file not found: {p}")

    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)

    is_valid, errors = validate_asset_manifest(data)
    if not is_valid:
        raise ManifestValidationError(f"Manifest validation failed: {'; '.join(errors)}")

    return data
