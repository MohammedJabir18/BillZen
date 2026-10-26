"""Host-side candidate filtering, context safety, and compound navigation policies for BillZen.

Note: This module implements host-level safety policies for assistive ML prototypes.
It is not a substitute for a full production accounting engine or user confirmation.
"""

from __future__ import annotations

import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple


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
    # (payment, transfer)
    (
        re.compile(r"\b(pay|paid|payment)\b|കൊടുത്തു|നൽകി|ادفع|دفع", re.IGNORECASE),
        re.compile(r"\b(transfer|transferred)\b|നിക്ഷേപിച്ചു|മാറ്റി|حوالة|تحويل", re.IGNORECASE),
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
    1. Fail-closed: missing, empty, or unconfigured host context forces abstention.
    2. Finite probabilities: non-finite or out-of-range confidence forces abstention.
    3. Stale currency or context forces abstention.
    4. Compound or conflicting navigation intents force clarification, while
       harmless item conjunctions (e.g. 'electricity and water') are preserved.
    5. Unknown IDs are never returned as actionable suggestions.
    6. Reserved non-action tokens ('clarify', 'none_of_the_above', 'none') are explicitly tagged.
    """
    out = dict(result)
    pred = out.get("pred", "clarify")

    # 1. Fail-closed on missing or invalid host context
    if not isinstance(host_context, dict) or not host_context.get("expected_currency"):
        out["is_actionable"] = False
        out["pred"] = "clarify"
        out["reason"] = "missing_context"
        return out

    # 2. Finite confidence validation
    conf = out.get("confidence")
    if (
        conf is None
        or isinstance(conf, bool)
        or not isinstance(conf, (int, float))
        or math.isnan(conf)
        or math.isinf(conf)
        or not (0.0 <= float(conf) <= 1.0)
    ):
        out["is_actionable"] = False
        out["pred"] = "clarify"
        out["reason"] = "invalid_confidence"
        return out

    # 3. Stale context / currency check
    if "currency" in out and out["currency"] != host_context["expected_currency"]:
        out["is_actionable"] = False
        out["pred"] = "clarify"
        out["reason"] = "stale_context"
        return out

    # 4. Compound / conflicting intent check
    text = out.get("text", "")
    if text:
        is_compound = False
        for act_a, act_b in CONFLICTING_ACTION_PAIRS:
            if act_a.search(text) and act_b.search(text):
                is_compound = True
                break

        if is_compound:
            out["is_actionable"] = False
            out["pred"] = "clarify"
            out["reason"] = "compound_intent"
            return out

    # 5. Reserved abstention tokens
    if pred in ["clarify", "none", "none_of_the_above"]:
        out["is_actionable"] = False
        out["reason"] = "abstention"
        return out

    # 6. Unknown candidate ID
    if pred not in allowed_candidate_ids:
        out["is_actionable"] = False
        out["pred"] = "clarify"
        out["reason"] = "unknown_candidate_id"
        return out

    out["is_actionable"] = True
    out["reason"] = "valid_candidate"
    return out
