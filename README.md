# Fieldnote — token launch research

[![make.fun bounty](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![Live rank](https://make.fun/badge/token-radar-01/bactiar291/token-launch-radar-makefun/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard)
[![Live reward](https://make.fun/badge/token-radar-01/bactiar291/token-launch-radar-makefun/reward.svg)](https://make.fun/bounty/token-radar-01)

An original offline research workstation for [make.fun](https://make.fun), built for token-radar-01. Frozen evidence, robust peer valuation, explicit uncertainty, and category-aware research plans. No launch, airdrop, eligibility or reward is promised. Badges are live site values, not an asserted score.

## Run

Requires Node 22.18 or later. Runtime uses only Node's standard library; no install, build, network or browser is needed to produce the final artifact.

    node main.ts --input /path/to/snapshot.json --output /tmp/makefun/radar-test-local

Input defaults to `/input/snapshot.json`; `--input` accepts a file or directory. Output precedence is `--output`, then `MAKEFUN_OUTPUT_DIR`, then `/output`. Use explicit temporary output paths when testing on the host. Open `/tmp/makefun/radar-test-local/dashboard/index.html` directly in a browser. Classic scripts work over `file://` without a server. Source `dashboard/index.html` needs the generated `../data.js`; open the output copy.

Outputs: `board.json`, `data.js`, `dashboard/`, `screenshots/`, and `dossier.json`. The exact unmodified vendored `buildDossier` is used with 65,536 text bytes, four images maximum, 512 KiB per image and the dashboard caps; main also enforces the tighter bounty dossier limit of 1.5 MiB. `--prepare` writes data and dashboard only for first screenshot capture; final builds must omit it.

The supplied snapshot is not committed. All displayed source figures, names and derived sample views come from the actual supplied snapshot. Four real Chrome screenshots are included in `screenshots/`: board, valuation with plan summary, filtered board, and the operational pilot/review/exit steps. They are unedited browser captures, not visual stand-ins.

## What the register covers

The sealed snapshot dated 2026-11-14 contains 758 protocols. Fieldnote exports every record with neither symbol nor CoinGecko ID: 342 rows, including all 40 mandatory watchlist entries exactly once. A further 416 token-bearing records are separate references, including those with unknown market caps. There are 112 records with no structure/access flags and 230 flagged records. The initial board shows the former; the status selector reveals all, flagged-only, or token references. The watchlist filter expands status to all candidates so flags do not hide required records. Rank always refers to the entire candidate export and may have gaps in filtered views.

Flags identify version markers, possible asset receipts, bridges, custody, exchange association, institutional access, missing category and inconsistent cap/identifier records. They are screening heuristics, not verified token status. Parent-protocol relationships are absent. A no-record row is not proof of no token, independent token rights or a future launch. High-value custodial records remain in the export for completeness and receive monitor-only plans.

Search, category/chain/status/watchlist filters, ascending/descending sorts, pagination, empty/reset states, keyboard-accessible details, source fields, comparable tables and three live sensitivity controls all operate on generated data. The native modal traps focus, Escape restores it, and `/` focuses search outside input controls. At small widths the compact register hides secondary columns; the detail file retains all evidence.

## Reproducible model

`dashboard/model.js` is original authored code shared verbatim by Node and the browser. No hardcoded name rankings. Inputs are TVL, seven-day TVL change, UTC tracking tenure, category and observed peer caps. Values are modeled market-cap proxies, not FDV, token unit price, expected reward or enterprise value.

1. Use token-bearing records with positive observed caps. Exclude asset/custody categories from governance-proxy calibration. Retain the largest-TVL record per CoinGecko ID (ticker fallback), avoiding repeated caps across versions without summing overlapping TVL. The sealed input yields 90 peers.
2. Compute raw mcap/TVL. Winsorize at global P10/P90 using linear interpolation `(n−1)q`. Use the resulting median and quartiles. Global median is approximately 0.234345×.
3. Categories need at least 5 peers. With n peers, category weight is `n/(n+8)`; smaller cohorts use zero. Blend category/global medians in log space. Category-influence sensitivity multiplies this weight by 0–1.
4. `G = 1 + 0.35 × clamp(change_7d, -50, 100)/100`. Outlier growth is bounded. Unknown growth uses a neutral factor, remains unknown, and expands uncertainty.
5. `T = 1 + 0.20 × (min(tracking_days,1095)/1095 − 0.5)`. Dates are anchored to snapshot `as_of`, never the runtime clock. Missing/invalid/future listing dates use a neutral factor. Listed date is index tracking tenure, not founding date or verified time without a token.
6. `base = clamp(round(TVL × blended_multiple × G × T), 1, 100000000000000)`. Round only at the final dollar. Sort by value descending; slug provides a deterministic tie break.
7. Low/high use the similarly blended Q25/Q75 multiplied by G and T, then divided/multiplied by uncertainty U. `U = 1.25 + 0.35 if sparse + 0.20 per missing growth/tenure/category + 0.25 if flagged`. This is an authored scenario envelope, not a probability interval. Catastrophic loss is not bounded by its low case.

Sliders recompute all candidate values and global ranks, explicitly labeling scenarios as not exported. Baseline values remain visible in each detail file and restore exactly. Formula components, full-precision multiplication, cohort size/weight, raw fields, missingness reasons, and all selected-cohort peers are inspectable. Tables order peers by TVL proximity; the whole chosen cohort is listed in a scroll area.

Caveats: TVL is not revenue or token-holder cash flow. Categories hide different economics; stablecoin/receipt capitalizations are not governance value. Filters cannot perfectly resolve token identities or eliminate asset-backed peers. TVL can overlap among protocols, liquidity can leave, depegs can distort values, market-cap reporting may be incomplete, and live-market selection creates survivorship bias. No token supply, dilution, fee history, audit, or reward terms are in this input. No historical charts are fabricated from the single snapshot.

Plans are authored conditional research proposals, not current protocol instructions. `farmPlan()` returns six structured `steps`, each with an action, title, capital-at-risk range, fee range, active-minute range, prerequisite, completion evidence, optional exit condition, and an assumption label. `stepText()` generates the backward-compatible `farm_steps` strings from those same fields; the detail UI renders the structure directly.

Unflagged Lending, Dexs, Liquidity Manager, Yield, Yield Aggregator and Farm records with a reported chain can receive a conditional $100–300 pilot envelope. All flagged records, missing chains, restricted products and other categories receive $0 monitor-only plans. The selected planning chain is the first alphabetically, solely for reproducibility; it is not a preferred route or evidence of where TVL is concentrated. The reader must independently verify public access, supported assets, audit scope, contracts and withdrawal terms. No specific address, route or reward qualification is asserted.

Capital is reused across the pilot, reviews and exit; it is never added per step. Fees are separate and allocated once: 20% setup/approval, 40% entry and 40% exit. Chain-dependent fee ranges are assumptions, not quotes; unrecognized-chain fees remain `null` and require a quote before proceeding. Research and monitoring have explicit zero capital and fees. No bridging or asset-acquisition costs are included: use existing assets on the selected chain or stop and re-budget. Skip if total quoted fees exceed 5% of pilot capital.

Totals distinguish active work (140–215 minutes for a conditional pilot; 130–195 for monitoring) from a four-week review horizon. Four 10–15 minute reviews are included in those totals, not added again. Lockup and settlement duration remain unknown. The UI shows each step's budget, prerequisite, evidence and stop/exit rule. Loss/depeg thresholds are review triggers, never executable stop-loss guarantees. All costs, time ranges and thresholds are authored planning assumptions, not snapshot facts or returns. No wallet, signature or execution UI exists.

## Local verification

Model tests use only Node. Browser/structural QA uses the available Python environment with Playwright and Pillow; these are development tools, never runtime dependencies.

    /tmp/makefun/runtime/node-v22.23.5-linux-x64/bin/node --test tests/model.test.mjs tests/plan.test.mjs
    /tmp/makefun/runtime/node-v22.23.5-linux-x64/bin/node main.ts --input /tmp/makefun/radar-improvement/snapshot.json --output /tmp/makefun/radar-improvement/output-preview --prepare
    /root/venv/bin/python3 tests/browser.py /tmp/makefun/radar-improvement/output-preview
    /root/venv/bin/python3 tests/determinism.py
    /root/venv/bin/python3 tests/validate.py /tmp/makefun/radar-improvement/output-a /tmp/makefun/radar-improvement/snapshot.json

The commands above use a real snapshot copy in the task directory. `FIELD_SNAPSHOT` overrides the model/determinism input; `FIELD_NODE` overrides the validation/determinism Node executable. Tests write only inside that task directory or the repository screenshots directory.

Browser QA uses `/usr/bin/google-chrome` and an owned ephemeral loopback server, shuts that server down afterward, records a Playwright trace, and blocks external requests. It captures actual 1440×900 JPEGs at quality 86 and checks page/modal overflow at 390, 768, 1440, search/filter/sort/reset, token-status handling, baseline arithmetic, keyboard focus, sensitivity, structured plan rendering, and visible budget/time fields. The four screenshots are regenerated from the final page/data, then the final main run copies all of them into the dossier. These automated checks are objective browser evidence, not a visual design review.

`tests/validate.py` independently replicates all seven published structural gates: dashboard names/limits/offline references, board validity, rank/value ordering, watchlist coverage, farm-step bounds, fully decoded screenshot format/dimensions/size, and byte-exact dossier rebuild. It is not the private server scorer or an official eligibility verdict. `tests/determinism.py` runs main twice in separate output paths and compares every byte by SHA-256.

Model tests cover missing data, symbol/ID classification, leap-day/future/invalid dates, bounded outliers, cohort shrinkage, independent arithmetic reproduction, name neutrality, input permutation, concrete access plans, and a changed input processed through main that changes ranking. Added plan tests cover structured/string equality, null fee assumptions, zero-cost research, reused capital, single fee allocation, review accounting, all-record range/text bounds and no NaN. A snapshot without usable observed peers still fails explicitly; no unsupported valuation fallback is invented. Null optional facts are supported; omitted required schema fields remain validation errors.

## Authorship and submission boundary

This native continuation builds on accepted commit `eb9f94f4d38fefc43e2284400333f0e05fc07886` from original session `20261115_064915_c5e6f4`. It changes farm-plan modeling, detail rendering, tests, screenshots and documentation while preserving the valuation formulas and calibration. The original `vendor/makefun-board.ts` remains unchanged (SHA-256 `9ca51b6e5cd84fe46cb0efa61e2ea99365a1fb0e21f2b75e6007f977f0dc326e`). The downloaded make.fun CLI was not executed. Native session records were not accessed, altered, synthesized or exported. No subagents were used. The parent retains the complete original and continuation records.

Continuation changes remain local and uncommitted. Repository: `bactiar291/token-launch-radar-makefun`. Publishing, transcript packaging, official eligibility checks and submission belong to the parent workflow. Local runs do not reproduce the production container's CPU, memory, process or filesystem isolation limits. No official score, win rate or reward is claimed here. MIT licensed.
