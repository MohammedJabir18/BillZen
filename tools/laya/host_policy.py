"""Host-side candidate filtering, context safety, and compound navigation policies for BillZen."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set, Tuple


COMPOUND_INTENT_PATTERNS = [
    re.compile(r"\b(and|also)\b", re.IGNORECASE),
    re.compile(r"(കൂടാതെ|ഒപ്പം|പിന്നെ)"),
    re.compile(r"\s+و\s*"),
]

CONFLICTING_ACTION_PAIRS = [
    # (payment, receipt)
    (
        re.compile(r"\b(pay|paid|payment)\b|കൊടുത്തു|നൽകി|ادفع|دفع", re.IGNORECASE),
        re.compile(r"\b(received?|receipt)\b|വാങ്ങി|തന്നു|استلم|قبض", re.IGNORECASE),
    ),
    # (transfer, receipt)
    (
        re.compile(r"\b(transfer|transferred)\b|നിക്ഷേപിച്ചു|മാറ്റി|حوالة|تحويل", re.IGNORECASE),
        re.compile(r"\b(received?|receipt)\b|വാങ്ങി|തന്നു|استلم|قبض", re.IGNORECASE),
    ),
]


def filter_candidates_for_host(
    candidates: List[Dict[str, Any]],
    direction: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Filter raw host candidates to active, unarchived, matching-direction candidates.
    
    Drops inactive or archived categories, malformed candidate dictionaries,
    and duplicate candidate IDs.
    """
    valid: List[Dict[str, Any]] = []
    dropped: List[str] = []
    seen_ids: Set[str] = set()

    for idx, c in enumerate(candidates):
        if not isinstance(c, dict):
            dropped.append(f"Candidate at index {idx} is not a dictionary")
            continue

        cid = c.get("id")
        if not isinstance(cid, str) or not cid.strip():
            dropped.append(f"Candidate at index {idx} missing valid non-empty id")
            continue

        if cid in seen_ids:
            dropped.append(f"Candidate '{cid}' is a duplicate ID")
            continue

        # Inactive or archived checks
        if c.get("is_active") is False:
            dropped.append(f"Candidate '{cid}' is marked is_active=False")
            continue
        if c.get("archived") is True:
            dropped.append(f"Candidate '{cid}' is marked archived=True")
            continue

        # Direction check (if direction is specified)
        c_dir = c.get("direction")
        if direction is not None and c_dir is not None and c_dir != direction:
            dropped.append(f"Candidate '{cid}' direction '{c_dir}' does not match expected '{direction}'")
            continue

        seen_ids.add(cid)
        valid.append(c)

    return valid, dropped


def validate_assistant_result_against_host(
    result: Dict[str, Any],
    allowed_candidate_ids: Set[str],
    host_context: Dict[str, Any],
) -> Dict[str, Any]:
    """Validate assistant prediction against live host state and candidate constraints.
    
    Guarantees:
    1. Unknown IDs are never returned as actionable suggestions.
    2. Stale currency or context forces abstention.
    3. Compound or conflicting navigation intents force clarification.
    4. Reserved non-action tokens ('clarify', 'none_of_the_above', 'none') are explicitly tagged.
    """
    out = dict(result)
    pred = out.get("pred", "clarify")

    # 1. Stale context check
    if "currency" in out and "expected_currency" in host_context:
        if out["currency"] != host_context["expected_currency"]:
            out["is_actionable"] = False
            out["pred"] = "clarify"
            out["reason"] = "stale_context"
            return out

    # 2. Compound intent check
    text = out.get("text", "")
    if text:
        is_compound = False
        for pat in COMPOUND_INTENT_PATTERNS:
            if pat.search(text):
                is_compound = True
                break
        if not is_compound:
            for act_a, act_b in CONFLICTING_ACTION_PAIRS:
                if act_a.search(text) and act_b.search(text):
                    is_compound = True
                    break

        if is_compound:
            out["is_actionable"] = False
            out["pred"] = "clarify"
            out["reason"] = "compound_intent"
            return out

    # 3. Reserved abstention tokens
    if pred in ["clarify", "none", "none_of_the_above"]:
        out["is_actionable"] = False
        out["reason"] = "abstention"
        return out

    # 4. Unknown candidate ID
    if pred not in allowed_candidate_ids:
        out["is_actionable"] = False
        out["pred"] = "clarify"
        out["reason"] = "unknown_candidate_id"
        return out

    out["is_actionable"] = True
    out["reason"] = "valid_candidate"
    return out
