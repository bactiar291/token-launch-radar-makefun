# Fieldnote — token launch research

[![make.fun bounty](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![Live rank](https://make.fun/badge/token-radar-01/bactiar291/token-launch-radar-makefun/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard)
[![Live reward](https://make.fun/badge/token-radar-01/bactiar291/token-launch-radar-makefun/reward.svg)](https://make.fun/bounty/token-radar-01)

Offline protocol research using the sealed snapshot. No token record is not proof that a token does not exist. No launch, eligibility, reward or personal allocation is predicted. Values are market-cap proxies in whole USD, not FDV or token prices. Badges are live site values, not asserted results.

## Candidate status

Local uncommitted continuation of accepted commit `50b5e2ab84c91ecf8be469b64eb6a8bf55386c27`, ready for parent review. Final Node22 regression suite: 22 passed, zero failures. Browser QA passed and four fresh, unedited browser screenshots replaced the inherited captures. Both final packages are byte-identical; all seven locally replicated published structural gates pass. Final evidence: `../artifacts/finish-report.json`. No official score is claimed.

## Run

Node 22.18+; standard library only, no installation or network at runtime:

    /tmp/makefun/runtime/node-v22.23.5-linux-x64/bin/node main.ts --input /tmp/makefun/campaign-20261117/kits/token-radar-01/verified/token-radar-01-kit/input/snapshot.json --output /tmp/makefun/campaign-20261117/token-radar-01/artifacts/output-local

Default sandbox paths remain `/input/snapshot.json` and `/output`; host checks must explicitly use candidate artifact paths. `--prepare` omits screenshot/dossier packaging for capture bootstrap. Open the generated `dashboard/index.html`, not the source page. Outputs include board.json, research.json, data.js, dashboard, screenshots and the vendored buildDossier output. The input hash and exact source string accompany the data.

## Coverage and identity

The snapshot has 758 records. All 342 records lacking both symbol and CoinGecko ID remain candidates, including every one of 40 watchlist records. The 416 records with either identifier remain separate token references, even when market cap is unknown. Structure/access flags do not remove rows. Initial filters show fewer-flag candidates; watchlist filtering includes flagged records. Global rank covers all candidates; view position follows active filtering and sorting. Sliders recalculate every candidate and global rank without changing the exported baseline.

Shared case-normalized CoinGecko IDs OR tickers join into transitive components, including aliases with unusable caps. Each component supplies its largest-TVL eligible record (slug breaks ties). Eligible records have positive cap and TVL and are outside the existing asset/custody exclusions. This yields 89 groups. Conservative ticker linkage can merge unrelated assets; unseen aliases and overlapping TVL remain possible. This is not verified token identity resolution.

## Measurement and selection

`lib/research.js` deterministically sorts eligible group IDs by SHA-256 of `fieldnote-group-audit-v1:` plus the ID. The lowest floor(30% × N) groups are audit; the rest are development. On this snapshot: 63 development and 26 audit groups. This is a cross-sectional split, never a temporal test.

Each development group is held out in full. Every preprocessing statistic, category set, winsorization cutoff and fitted coefficient comes only from that fold's training groups. Audit groups never enter development training or model selection. Tests change every audit group's cap and confirm that development metrics, selection, calibration radius and audit predictions stay identical.

Three fixed candidates:

1. Original formula: winsorized P10/P90 mcap/TVL ratios, category median log-shrunk to the global median by n/(n+8) for n>=5, growth factor `1+0.35*clamp(change_7d,-50,100)/100`, and tenure factor `1+0.20*(min(days,1095)/1095-0.5)`. Missing growth/tenure factors are neutral.
2. Robust category ratio: same ratio/shrinkage without the authored growth and tenure tilts.
3. Ridge: least squares for ln(mcap), with standardized ln(TVL), clipped growth divided by 100, capped tracking days divided by 1095, missing growth/date indicators, and category intercepts. Ridge penalty is fixed at 10 for every coefficient except the intercept; no hyperparameter search. Missing numeric features use zero before standardization plus their missing indicators. Unknown categories have zero category effect. Training scaling uses population standard deviations, with constant columns scaled by 1.

Selection uses development LOO only. Untilting must not worsen mean absolute log error or median error factor. Ridge must lower mean absolute log error by at least 10% and not worsen median error factor against the selected simpler comparator. The audit is reported without retuning. Final deployment refits the selected family on all eligible peers.

Actual results (natural-log error; lower is better):

| Model | Development mean absolute log error | Audit mean absolute log error | Audit median error factor |
| --- | ---: | ---: | ---: |
| Original tilted ratios | 1.806260 | 1.685640 | 5.271064× |
| Untilited category ratios | 1.808283 | 1.686055 | 5.422530× |
| Log-space ridge | 1.521943 | 1.593610 | 3.227035× |

Ridge met the predefined selection rule. Audit within-2× accuracy is unchanged at 30.77%; audit RMS log error is virtually unchanged (2.06698 versus 2.06665). This is limited evidence of improved cross-sectional accuracy, not general predictive validation. Exact metrics, every prediction, training-group IDs and fitted coefficients are in research.json and artifacts/research-metrics.json. The UI exposes the comparison and all audit predictions.

## Residual range and interpretation

For the selected model, sort development LOO absolute log residuals and take order ceil((n+1)*0.90), capped at n. Here it is residual 58 of 63: log radius 4.293430392, multiplicative factor 73.217201904. Low/high are unrounded predicted cap divided/multiplied by that factor, then rounded and capped to [1, 100000000000000] USD. Separate audit coverage was 25/26 (96.15%).

This enormous range is disclosed as a limitation. It is empirical calibration, not a conformal coverage guarantee: LOO training sets overlap and model selection uses the development residuals. The final all-peer refit and no-record candidates are not independently validated. No evidence here validates future launches, airdrop returns or activity-farming profitability. Catastrophic loss can be zero. Survivorship, small audit size, cap quality, dilution, category mismatch, custody structures, overlapping TVL and domain shift remain.

`dashboard/model.js` shares scoring arithmetic between Node and browser. It factors the fitted log predictor into an effective core/TVL multiple and separate growth/tracking contributions. Missing values stay visibly unknown with neutral growth/tracking factors and fitted missing indicators. Category sensitivity scales the fitted category coefficient; growth/tenure sliders scale their contributions (baseline 100%). These are scenario assumptions, not causal effects. Changed scenarios have no measured coverage. The original ratio comparator remains visible in each candidate detail.

## Research and budget utility

Six existing category-aware conditional plan steps retain prerequisites, completion evidence, exit rules, fee allocation and reused capital. Supported unflagged records can receive an assumed $100–300 pilot envelope after independent verification. Restricted/ambiguous records stay $0 research-only. Chain fees are authored assumptions; unknown fees remain unknown. Capital is reused, fees allocated once, and four weekly reviews are included in active-time totals. Settlement and lockups are unknown.

The new detail calculator takes pilot capital, total quoted fees and an optional hourly value of time. It applies the existing 5% fee cap and computes fees plus active hours × hourly rate. Blank quotes/time rates remain unknown, rather than zero. Capital is not counted as spent; capital loss, bridging, funding and opportunity cost are excluded. Protocol valuation is never converted into an expected personal reward.

## Verification and remaining commands

From this candidate repository, the helper acquires an exclusive advisory flock on `/tmp/makefun/campaign-20261117/verification.lock` before executing the named task:

    /tmp/makefun/runtime/python/cpython-3.13-linux-x86_64-gnu/bin/python3.13 tests/locked.py tests
    /tmp/makefun/runtime/python/cpython-3.13-linux-x86_64-gnu/bin/python3.13 tests/locked.py measure
    /tmp/makefun/runtime/python/cpython-3.13-linux-x86_64-gnu/bin/python3.13 tests/locked.py preview
    /tmp/makefun/runtime/python/cpython-3.13-linux-x86_64-gnu/bin/python3.13 tests/locked.py browser
    /tmp/makefun/runtime/python/cpython-3.13-linux-x86_64-gnu/bin/python3.13 tests/locked.py determinism
    /root/venv/bin/python3 tests/validate.py /tmp/makefun/campaign-20261117/token-radar-01/artifacts/output-a

Preview, browser, final tests, determinism and Pillow structural validation completed successfully. Browser QA used Playwright, an owned loopback server and local-only routing; real controls, fitted baseline equality, budget arithmetic, evidence text, focus and responsive overflow checks passed with no console errors or external requests. Four unedited 1440×900 JPEGs range from 114,790 to 170,528 bytes. They are below the official 512 KiB cap; the rules' 300–350 KB guidance is not a minimum. The 847,527-byte dossier exactly matches unchanged-vendor rebuilding and includes all source (64,180 text bytes). Dashboard source is 63,839 bytes: the local validator additionally enforces an optional stricter 64,000-byte source budget; the published structural dashboard cap is 4 MiB / 400 files and dossier text cap is 65,536 bytes. Both final runs produced identical bytes across all 12 output files. Coverage is 40/40 exactly once, with 342 uniquely ranked candidates. Structural validation replicates published checks, not the private scorer. Automated browser geometry was checked; independent human visual review remains with the parent.

Tests cover identity linkage, group leakage, audit-label isolation, input permutation, missing/zero/outlier values, independent prediction and residual arithmetic for every row, rank consistency, budget arithmetic and existing farm-plan contracts. Explicit synthetic unit fixtures are never used for model evidence or screenshots. The full final suite completed with 22 passing tests, zero failures.

Vendor SHA-256 remains `9ca51b6e5cd84fe46cb0efa61e2ea99365a1fb0e21f2b75e6007f977f0dc326e`. No CLI/gateway, paid APIs, credential reads, network fetching, child agents, transcript modifications, commits or publishing were performed. Parent handles review, remaining validation, real native transcript packaging, publishing and submission. MIT licensed.
