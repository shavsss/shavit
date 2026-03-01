from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build shortlist from longlist by explicit criteria")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--min-followers", type=int, default=50000)
    parser.add_argument("--max-official-score", type=int, default=40, help="Prefer less official/formal accounts")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    df = pd.read_csv(args.input)

    required_cols = {
        "platform",
        "handle",
        "group_label",
        "is_verified",
        "followers_estimate",
        "is_active",
        "agenda_tag",
        "priority_score",
    }
    missing = sorted(required_cols - set(df.columns))
    if missing:
        raise ValueError(f"Missing columns: {missing}")

    if "official_score" not in df.columns:
        df["official_score"] = 50

    shortlisted = df[
        (df["is_verified"].astype(str).str.lower() == "yes")
        & (pd.to_numeric(df["followers_estimate"], errors="coerce").fillna(0) >= args.min_followers)
        & (df["is_active"].astype(str).str.lower() == "yes")
        & (pd.to_numeric(df["official_score"], errors="coerce").fillna(50) <= args.max_official_score)
    ].copy()

    # Keep top 30 per side/platform by priority score
    shortlisted["priority_score"] = pd.to_numeric(shortlisted["priority_score"], errors="coerce").fillna(0)
    shortlisted = shortlisted.sort_values(["group_label", "platform", "priority_score"], ascending=[True, True, False])
    shortlisted = shortlisted.groupby(["group_label", "platform"], group_keys=False).head(30)

    out_cols = ["platform", "handle", "group_label", "source_type", "is_verified", "followers_estimate", "is_active", "agenda_tag", "priority_score", "notes"]
    for c in out_cols:
        if c not in shortlisted.columns:
            shortlisted[c] = ""

    result = shortlisted[out_cols]

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(args.output, index=False)
    print(f"Saved shortlist with {len(result)} rows -> {args.output}")


if __name__ == "__main__":
    main()
