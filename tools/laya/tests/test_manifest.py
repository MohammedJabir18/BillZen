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
    """The tracked project asset_manifest.json and onnx_asset_manifest.json must pass all validation checks."""
    is_valid, errors = validate_asset_manifest(valid_manifest_data)
    assert is_valid is True, f"Manifest errors: {errors}"
    assert len(errors) == 0

    onnx_manifest_path = Path(__file__).resolve().parent.parent / "onnx_asset_manifest.json"
    with onnx_manifest_path.open("r", encoding="utf-8") as f:
        onnx_data = json.load(f)
    is_valid_onnx, errors_onnx = validate_asset_manifest(onnx_data)
    assert is_valid_onnx is True, f"ONNX Manifest errors: {errors_onnx}"
    assert len(errors_onnx) == 0



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
        assert any("path" in err.lower() or "traversal" in err.lower() for err in errors)


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


def test_reject_windows_drive_and_unc_paths(valid_manifest_data):
    """Filenames with Windows drive letters, drive-relative paths, or UNC shares must be rejected."""
    drive_cases = [
        "C:/outside/model.onnx",
        "D:\\models\\weights.bin",
        "c:file.safetensors",
        "\\\\server\\share\\model.onnx",
        "//server/share/model.onnx",
    ]
    for bad_name in drive_cases:
        data = copy.deepcopy(valid_manifest_data)
        data["assets"][0]["filename"] = bad_name
        is_valid, errors = validate_asset_manifest(data)
        assert is_valid is False, f"Expected rejection for: '{bad_name}'"
        assert any("path" in err.lower() or "traversal" in err.lower() for err in errors)


def test_reject_empty_required_strings(valid_manifest_data):
    """Empty strings for license, role, or filename must be rejected."""
    # Empty license
    data = copy.deepcopy(valid_manifest_data)
    data["license"] = "   "
    is_valid, errors = validate_asset_manifest(data)
    assert is_valid is False
    assert any("license" in err.lower() for err in errors)

    # Empty filename
    data = copy.deepcopy(valid_manifest_data)
    data["assets"][0]["filename"] = ""
    is_valid, errors = validate_asset_manifest(data)
    assert is_valid is False
    assert any("filename" in err.lower() for err in errors)

    # Empty role
    data = copy.deepcopy(valid_manifest_data)
    data["assets"][0]["role"] = ""
    is_valid, errors = validate_asset_manifest(data)
    assert is_valid is False
    assert any("role" in err.lower() for err in errors)


def test_reject_bool_as_size_bytes(valid_manifest_data):
    """Python bool (True/False) must be strictly rejected as size_bytes."""
    for b in [True, False]:
        data = copy.deepcopy(valid_manifest_data)
        data["assets"][0]["size_bytes"] = b
        is_valid, errors = validate_asset_manifest(data)
        assert is_valid is False
        assert any("size_bytes" in err for err in errors)


def test_reject_duplicate_asset_paths(valid_manifest_data):
    """Manifest must reject duplicate normalized asset paths."""
    data = copy.deepcopy(valid_manifest_data)
    dup = copy.deepcopy(data["assets"][0])
    # Add identical or normalized duplicate
    dup["filename"] = f"./{dup['filename']}"
    data["assets"].append(dup)
    is_valid, errors = validate_asset_manifest(data)
    assert is_valid is False
    assert any("duplicate" in err.lower() for err in errors)


def test_verify_asset_file_integrity_with_synthetic_fixture(valid_manifest_data, tmp_path):
    """Synthetic local asset files must match declared sha256 and size_bytes."""
    from tools.laya.validator import verify_asset_file_integrity

    content = b"hello billzen assistant tiny synthetic model fixture\n"
    import hashlib
    sha256_hash = hashlib.sha256(content).hexdigest()
    size = len(content)

    test_file = tmp_path / "tiny_model.bin"
    test_file.write_bytes(content)

    manifest = copy.deepcopy(valid_manifest_data)
    manifest["assets"] = [
        {
            "filename": "tiny_model.bin",
            "sha256": sha256_hash,
            "size_bytes": size,
            "role": "model_config",
            "provenance": "synthetic_calibration",
        }
    ]

    ok, errors = verify_asset_file_integrity(manifest, tmp_path)
    assert ok is True
    assert len(errors) == 0

    # Tamper with content
    test_file.write_bytes(b"corrupted content")
    ok, errors = verify_asset_file_integrity(manifest, tmp_path)
    assert ok is False
    assert any("sha256 mismatch" in err.lower() or "size mismatch" in err.lower() for err in errors)


def test_reject_non_finite_and_invalid_resource_values(valid_manifest_data):
    """Resource values like NaN, Inf, bool, negative, strings must be strictly rejected."""
    bad_rss = [-1, 0, True, False, float("nan"), float("inf"), "500", None]
    for bad in bad_rss:
        data = copy.deepcopy(valid_manifest_data)
        data["resource_ceiling"]["max_rss_mb"] = bad
        is_valid, errors = validate_asset_manifest(data)
        assert is_valid is False, f"Expected rejection for max_rss_mb={bad}"
        assert any("max_rss_mb" in err for err in errors)

    bad_ram = [-1, 0, 256, True, "512", float("nan"), None]
    for bad in bad_ram:
        data = copy.deepcopy(valid_manifest_data)
        data["hardware_target"]["min_ram_mb"] = bad
        is_valid, errors = validate_asset_manifest(data)
        assert is_valid is False, f"Expected rejection for min_ram_mb={bad}"
        assert any("min_ram_mb" in err for err in errors)

    bad_lat = [0, -10, True, "200", float("nan"), None]
    for bad in bad_lat:
        data = copy.deepcopy(valid_manifest_data)
        data["resource_ceiling"]["max_warm_latency_ms"] = bad
        is_valid, errors = validate_asset_manifest(data)
        assert is_valid is False, f"Expected rejection for max_warm_latency_ms={bad}"
        assert any("max_warm_latency_ms" in err for err in errors)

    bad_timeout = [0, -1, True, "5000", float("nan"), None]
    for bad in bad_timeout:
        data = copy.deepcopy(valid_manifest_data)
        data["resource_ceiling"]["max_load_timeout_ms"] = bad
        is_valid, errors = validate_asset_manifest(data)
        assert is_valid is False, f"Expected rejection for max_load_timeout_ms={bad}"
        assert any("max_load_timeout_ms" in err for err in errors)


def test_verify_asset_file_integrity_rejects_empty_or_invalid_manifest(tmp_path):
    """verify_asset_file_integrity must not report success for empty or invalid manifests."""
    from tools.laya.validator import verify_asset_file_integrity

    ok, errors = verify_asset_file_integrity({}, tmp_path)
    assert ok is False
    assert any("empty" in err.lower() or "invalid" in err.lower() or "missing" in err.lower() for err in errors)

    ok, errors = verify_asset_file_integrity({"assets": []}, tmp_path)
    assert ok is False
    assert any("empty" in err.lower() or "invalid" in err.lower() or "missing" in err.lower() for err in errors)


def test_validator_accepts_both_string_and_path_objects(tmp_path):
    """load_and_validate_manifest and verify_asset_file_integrity must accept string paths or Path objects without AttributeError."""
    from tools.laya.validator import load_and_validate_manifest, verify_asset_file_integrity

    manifest_file = tmp_path / "test_manifest.json"
    manifest_data = {
        "schema_version": "1.0.0",
        "model_id": "test/model",
        "checkpoint_revision": "1720e3e3357cfe1e281542e223f8273b0890ca34",
        "base_encoder": {"id": "enc", "license": "MIT"},
        "upstream_source_commit": "b9fe351ce81e2d974bca2bf219c1e4030c0a05ea",
        "license": "Apache-2.0",
        "assets": [
            {
                "filename": "model.onnx",
                "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "size_bytes": 5,
                "role": "weights_onnx",
                "provenance": "locally_exported_onnx",
            }
        ],
        "hardware_target": {"cpu": "Generic CPU", "min_ram_mb": 4096, "has_accelerator": False},
        "resource_ceiling": {"max_rss_mb": 500, "max_warm_latency_ms": 750, "max_load_timeout_ms": 5000},
    }
    target_file = tmp_path / "model.onnx"
    target_file.write_bytes(b"hello")
    import hashlib
    manifest_data["assets"][0]["size_bytes"] = 5
    manifest_data["assets"][0]["sha256"] = hashlib.sha256(b"hello").hexdigest()

    manifest_file.write_text(json.dumps(manifest_data), encoding="utf-8")

    # 1. Test load_and_validate_manifest with str
    loaded = load_and_validate_manifest(str(manifest_file))
    assert loaded["model_id"] == "test/model"

    # 2. Test verify_asset_file_integrity with str root_dir
    ok, errors = verify_asset_file_integrity(loaded, root_dir=str(tmp_path))
    assert ok is True, f"Integrity errors: {errors}"




