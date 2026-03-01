from __future__ import annotations

import argparse
import ast
from pathlib import Path

import pandas as pd


def parse_themes(value: object) -> list[str]:
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return []
        try:
            parsed = ast.literal_eval(value)
            if isinstance(parsed, list):
                return [str(v) for v in parsed]
        except Exception:
            return [t.strip(" []'\"") for t in value.split(",") if t.strip(" []'\"")]
    return []


def summarize(df: pd.DataFrame, window_label: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    df = df.copy()
    df["themes"] = df["themes"].apply(parse_themes)
    df["call_to_action"] = df["call_to_action"].astype(bool)

    user_metrics = (
        df.groupby(["platform", "handle", "group_label"], as_index=False)
        .agg(
            posts_count=("post_id", "count"),
            factual_score_avg=("factual_score", "mean"),
            emotion_score_avg=("emotion_score", "mean"),
            aggression_score_avg=("aggression_score", "mean"),
            cta_rate=("call_to_action", "mean"),
        )
    )
    user_metrics["window"] = window_label

    theme_rows = []
    for row in df.itertuples(index=False):
        for theme in row.themes:
            theme_rows.append(
                {
                    "platform": row.platform,
                    "handle": row.handle,
                    "group_label": row.group_label,
                    "theme": theme,
                    "window": window_label,
                }
            )
    theme_metrics = pd.DataFrame(theme_rows)
    return user_metrics, theme_metrics


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare current window vs previous week")
    parser.add_argument("--current", required=True, help="analyzed_posts.csv for current window")
    parser.add_argument("--previous", required=True, help="analyzed_posts.csv for previous week")
    parser.add_argument("--output-user-delta", required=True)
    parser.add_argument("--output-theme-delta", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    current_df = pd.read_csv(args.current)
    previous_df = pd.read_csv(args.previous)

    current_user, current_theme = summarize(current_df, "current")
    prev_user, prev_theme = summarize(previous_df, "previous")

    merged = current_user.merge(
        prev_user,
        on=["platform", "handle", "group_label"],
        suffixes=("_current", "_previous"),
        how="outer",
    ).fillna(0)

    for metric in ["posts_count", "factual_score_avg", "emotion_score_avg", "aggression_score_avg", "cta_rate"]:
        merged[f"delta_{metric}"] = merged[f"{metric}_current"] - merged[f"{metric}_previous"]

    current_theme_counts = (
        current_theme.groupby(["group_label", "theme"], as_index=False)
        .size()
        .rename(columns={"size": "count_current"})
    )
    prev_theme_counts = (
        prev_theme.groupby(["group_label", "theme"], as_index=False)
        .size()
        .rename(columns={"size": "count_previous"})
    )
    theme_delta = current_theme_counts.merge(prev_theme_counts, on=["group_label", "theme"], how="outer").fillna(0)
    theme_delta["delta_count"] = theme_delta["count_current"] - theme_delta["count_previous"]

    Path(args.output_user_delta).parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(args.output_user_delta, index=False)
    theme_delta.to_csv(args.output_theme_delta, index=False)

    print(f"Saved user deltas -> {args.output_user_delta}")
    print(f"Saved theme deltas -> {args.output_theme_delta}")


if __name__ == "__main__":
    main()
