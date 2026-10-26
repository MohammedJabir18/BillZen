# Laya foundation re-review: c021767

Date:2026-10-26, Asia/Kolkata. Reviewed commit `c0217678706ffca84605b15ebd93bca2b43a68d2`. Owner requested verification of Antigravity's correction output and the next action. This review changes documentation only; no model installation/inference/training or application implementation.

## Recommendation

The correction is a useful improvement. **Accept the repaired development tooling as a research foundation, with remaining validation/report gaps; do not approve production runtime/UI or declare every R1–R7 item closed.** Given the owner's actual goal is Laya integration, recommend **Option B as a bounded model-feasibility pilot**, after the small validation/report corrections below. This is not a promise the model fits the laptop or outperforms rules. Rules mode is a legitimate separate option if explicitly chosen; it must not silently replace Laya.

The pilot can prepare model-free evaluation interfaces without loading weights. Actual model preparation/reference/native experiments run only where a documented resource budget can safely be enforced. A no-go is useful evidence. Do not buy/rent hardware, bulk-tune a model or build a sidecar/UI before resolving the model question.

## Verified improvement and current product state

- Working tree clean at review start. Local and origin/main match the exact target SHA.
- `python3 -m pytest tools/laya/tests/ -q`: **30 passed in0.07s**.
- Dataset generator run into an isolated temporary directory: **all generated artifacts byte-identical** to tracked files. No tracked dataset rewritten by review.
- [CI40354662285](https://github.com/MohammedJabir18/BillZen/actions/runs/40354662285) independently checked **completed/success** for exactc021767. AI Tooling, Rust and Frontend jobs all passed. Python tests are now genuinely included in CI.
- Previously reproduced bill/payment and bank-method/transfer errors now pass; the if/gift regression and candidate ties are corrected. UUID/label/direction candidate support exists. Actual group-based splitting and additional tests exist. Cross-platform path, bool-size and local tiny-asset integrity tests are improved.
- Existing financial/B1 application source was not changed by this correction. No production assistant provider/UI/IPC/ONNX session is implemented; no Laya performance has been measured. Published/installed releases remain distinct from source.
- Graphify evidence inspected:2365nodes/5117links,108 relevant nodes; SQL/semantic coverage remains partial.

## Fresh metric results and interpretation

| Metric | Development59 | Held-out snapshot23 |
|---|---:|---:|
| Raw correct |58/59 |17/23 |
| Raw accuracy |.9831 |.7391 |
| Macro-F1 |.9866 |.6400 |
| Threshold-accepted decision precision |1.0000 |17/18=.9444 |
| Threshold-accepted coverage |.9831 |18/23=.7826 |
| Actionable suggestion coverage |.8136 |16/23=.6957 |
| Binary correctness Brier |.0089 |.0946 |
| ECE over heuristic scores |.0708 |.1283 |

The held-out report's numbers reproduce. The development table's100%/.005/.0661 values are stale relative to current code. Its error is Arabic `nav_ar_02` (receipt expected; clarify returned). Update tables from a saved machine-readable report, not manual transcription.

Be fair about what the23-case result means: five missed routes returned low-score clarification, and one category returned `none` at.90 instead of maintenance. Of16 actionable suggestions,16 were correct on this set. Neither this16/16 nor the aggregate17/18 establishes production reliability. Approximate95% Wilson intervals are80.6%–100% for16/16 actionable precision and74.2%–99.0% for17/18 threshold-accepted decision precision. Future reports must distinguish these quantities and give counts/uncertainty.

The23 cases cover all four language labels but only1–5 observations in each task×language cell. Category rows are all payments except three refund receipts; they cannot certify all categories/merchant taxonomies. The prior macro-F1/precision targets have not been demonstrated on a sufficiently sized independent set. Holdout was inspected during review; freeze/version this result, and do not retune against these failures while continuing to call it blind. Independently authored/held-out collection procedure should be recorded rather than inferred from disjoint IDs alone.

## Remaining actionable gaps

### V1 — Metadata validity is still not a fail-closed boundary

At `tools/laya/validator.py:150`, hardware/resource values lack strict finite positive types/ranges. Reproduced on otherwise valid manifest:

- `max_rss_mb=-1`, `True` and `NaN`: accepted;
- `max_rss_mb="500"`: uncontrolled TypeError;
- `verify_asset_file_integrity({}, root)`: returns success because it iterates an empty default asset list.

Either the integrity function must validate the full manifest or expose a clearly named validated asset-list contract with tests, never success for an invalid empty input. Its current test deliberately supplies an incomplete manifest, so change contract and test together. Validate max_load_timeout/min_ram/warm latency too; schema/runtime must agree, including minimums and JSON nonfinite rejection. Streaming hash/size checks are preferable before real weights, since read_bytes loads a large file into RAM. No downloader exists yet; these are preparation gates, not claims of an active product exploit.

At `prepare_dataset.py:33`, `validate_dataset_case` still accepts an invalid navigation expected label and boolean group_id; a null text raises AttributeError. Validate concrete field/candidate types, allowed labels, unique IDs and unsupported task behavior before benchmarking/exporting. The benchmark currently silently skips unknown tasks and lacks a tested upstream training/evaluation export path; native provider preparation must not assume its internal fixture schema is already Laya's state/questions/expected format.

### V2 — Category/route policies need the host boundary before exposure

The structured candidate matcher drops `is_active` and ignores archival status. In a fresh probe, archived-style `{id:'uuid-1',label:'Rent',direction:'payment',is_active:false}` still returns uuid-1/.98. This is not an already shipped app bug: a validated host shortlist should remove archived/incompatible records and revalidate live state. Add that contract/test before product UI. Do not claim R4's full active-candidate acceptance gate passed from direction/UUID tests alone.

`none_cand_id` defaults to a literal none even when no such candidate exists; a tie returns literal clarify. Define reserved non-action outcomes separately from candidate IDs, so unknown IDs cannot pass as valid choices. Add duplicate/malformed/archived candidates and conflict/late-edit tests at the future host boundary.

Routing remains a prototype: `Show products` maps to Reports due generic show priority; `Pay rent and record customer receipt` maps to one payment instead of clarifying a compound request. The scope need not expand to unsupported navigation, but it must return clarification for conflicting/unsupported intents. No need to seek100% on arbitrary paraphrases before a feasibility pilot; avoid promoting the rules as production-safe from existing regression passes.

### V3 — Evidence/reporting and scope claims still need correction

- Refresh the stale development metric table and remove "zero memory overhead"/unmeasured sub-ms claims. Every implementation has a footprint; latency/RSS need instrumentation.
- Host policy is not yet implemented:500MiB target and750MiB hard watchdog in docs are proposed budgets, not enforced or demonstrated limits. Keep current ceilings explicit; do not widen them to get a pass. Distinguish export/reference measurement budget from intended end-user inference ceiling.
- Generalization is a hypothesis for pretrained Laya, not an observed advantage. INT8 may or may not be necessary/sufficient; select it only after baseline/resource evidence.
- The current compute_metrics separates actionable coverage but still gives one precision including clarify/none, no uncertainty interval and no task×language cross-table. Add actionable precision/counts plus intervals and per-cell evidence sufficiency.
- Unsupported gold examples need domain review: routing a profit-and-loss printing request to Reports does not establish a P&L feature or profit accounting. Preserve current Cashbook-versus-profit/B2/B3 boundaries.

## Review disposition

R1: substantially corrected, model evidence intentionally absent. R2: true splitter/holdout improved; sparse samples/export validation/independence evidence remain. R3: listed regressions fixed; general ambiguity still a prototype. R4: ties/UUID/direction fixed, active-candidate host contract pending. R5: old path/size findings fixed, V1 strictness/integrity contract pending. R6: improved labels/coverage, stale table/intervals remain. R7: verified closed at this snapshot.

Do not restart the entire plan or demand a large training run. Fix V1/V3 in the next narrow tooling section, carry V2 into explicit host-policy tests, then run a bounded Laya research pilot. The [next Antigravity prompt](../prompts/2026-10-26-antigravity-laya-feasibility-next.md) keeps those boundaries. Runtime/UI remains gated on real model resources, parity and useful quality, or an explicit owner choice to ship a clearly identified rules-only feature.
