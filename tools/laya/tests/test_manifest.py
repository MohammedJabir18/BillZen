"""Automated tests for asset manifest validation and security invariants."""

from __future__ import annotations

import copy
import json
from pathlib import Path
import pytest

from tools.laya.validator import (
    ManifestValidationError,
    load_and_validate_manifest,
    validate_asset_manifest,
)


@pytest.fixture
def valid_manifest_data() -> dict:
    manifest_path = Path(__file__).resolve().parent.parent / "asset_manifest.json"
    with manifest_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def test_concrete_manifest_passes_validation(valid_manifest_data):
    """The tracked project asset_manifest.json must pass all validation checks."""
    is_valid, errors = validate_asset_manifest(valid_manifest_data)
    assert is_valid is True, f"Manifest errors: {errors}"
    assert len(errors) == 0


def test_reject_missing_required_fields(valid_manifest_data):
    """Manifest missing required top-level fields must be rejected."""
    for required in ["checkpoint_revision", "upstream_source_commit", "assets", "resource_ceiling"]:
        data = copy.deepcopy(valid_manifest_data)
        del data[required]
        is_valid, errors = validate_asset_manifest(data)
        assert is_valid is False
        assert any(required in err for err in errors)


def test_reject_path_traversal_in_asset_filename(valid_manifest_data):
    """Filenames with path traversal like ../ or absolute paths must be strictly rejected."""
    traversal_cases = [
        "../etc/passwd",
        "/usr/local/bin/model.onnx",
        "nested/../../secret.safetensors",
        "\\windows\\system32\\model.bin",
    ]
    for bad_name in traversal_cases:
        data = copy.deepcopy(valid_manifest_data)
        data["assets"][0]["filename"] = bad_name
        is_valid, errors = validate_asset_manifest(data)
        assert is_valid is False
        assert any("path traversal" in err for err in errors)


def test_reject_invalid_sha256_format(valid_manifest_data):
    """Assets with malformed or truncated sha256 hashes must be rejected."""
    bad_hashes = [
        "not-a-hash",
        "12345",
        "g" * 64,  # non-hex
        "a" * 63,  # 63 chars instead of 64
        "A" * 64,  # uppercase (we require lowercase hex)
    ]
    for bad_hash in bad_hashes:
        data = copy.deepcopy(valid_manifest_data)
        data["assets"][0]["sha256"] = bad_hash
        is_valid, errors = validate_asset_manifest(data)
        assert is_valid is False
        assert any("invalid sha256" in err for err in errors)


def test_reject_invalid_or_negative_asset_size(valid_manifest_data):
    """Asset sizes must be strictly positive integers."""
    bad_sizes = [0, -100, "643835514", None]
    for bad_size in bad_sizes:
        data = copy.deepcopy(valid_manifest_data)
        data["assets"][0]["size_bytes"] = bad_size
        is_valid, errors = validate_asset_manifest(data)
        assert is_valid is False
        assert any("size_bytes" in err for err in errors)


def test_reject_excessive_resource_ceiling(valid_manifest_data):
    """Resource ceiling above safe desktop limits must be rejected."""
    data = copy.deepcopy(valid_manifest_data)
    data["resource_ceiling"]["max_rss_mb"] = 4096  # Exceeds 1024MB limit
    is_valid, errors = validate_asset_manifest(data)
    assert is_valid is False
    assert any("resource_ceiling" in err for err in errors)
