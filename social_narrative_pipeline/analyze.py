from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

import pandas as pd
from openai import OpenAI

SYSTEM_PROMPT = """
You analyze political/social posts.
Return strict JSON only.
For every post provide:
- style: one of ["factual", "opinion", "emotional", "mixed"]
- factual_score: float 0..1
- emotion_score: float 0..1
- aggression_score: float 0..1
- toxicity_level: one of ["low", "medium", "high"]
- call_to_action: boolean
- audience_focus: one of ["domestic", "international", "mixed", "unclear"]
- themes: subset of ["economy", "security_military", "religion_morality", "foreign_policy", "human_rights", "governance", "other"]
- summary_he: short Hebrew summary
""".strip()


def build_user_prompt(posts: list[dict[str, Any]]) -> str:
    return (
        "Analyze the following posts and return JSON in this format: "
        "{\"results\": [{\"post_id\": ..., \"style\": ..., \"factual_score\": ..., \"emotion_score\": ..., "
        "\"aggression_score\": ..., \"toxicity_level\": ..., \"call_to_action\": ..., "
        "\"audience_focus\": ..., \"themes\": [...], \"summary_he\": ...}]}.\n\n"
        f"POSTS:\n{json.dumps(posts, ensure_ascii=False)}"
    )


def classify_posts(client: OpenAI, posts: list[dict[str, Any]], model: str) -> dict[str, Any]:
    response = client.responses.create(
        model=model,
        input=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(posts)},
        ],
        temperature=0,
    )
    raw = response.output_text.strip()
    return json.loads(raw)


def profile_user(user_df: pd.DataFrame) -> dict[str, Any]:
    avg_factual = float(user_df["factual_score"].mean())
    avg_emotion = float(user_df["emotion_score"].mean())
    avg_aggression = float(user_df["aggression_score"].mean())
    cta_rate = float(user_df["call_to_action"].mean())

    theme_counts = Counter(t for themes in user_df["themes"] for t in themes)
    top_theme = theme_counts.most_common(1)[0][0] if theme_counts else "other"

    if avg_factual >= 0.7 and avg_emotion <= 0.4:
        action_profile = "שופר תעמולה ממוסד"
    elif avg_emotion >= 0.65 and cta_rate >= 0.3:
        action_profile = "אקטיביסט שטח"
    else:
        action_profile = "פרשן פוליטי"

    return {
        "handle": user_df["handle"].iloc[0],
        "platform": user_df["platform"].iloc[0],
        "group_label": user_df["group_label"].iloc[0],
        "posts_count": len(user_df),
        "avg_factual_score": round(avg_factual, 3),
        "avg_emotion_score": round(avg_emotion, 3),
        "avg_aggression_score": round(avg_aggression, 3),
        "call_to_action_rate": round(cta_rate, 3),
        "top_theme": top_theme,
        "action_profile": action_profile,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--user-profiles", required=True)
    parser.add_argument("--model", default="gpt-4o-mini")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    df = pd.read_csv(args.input)
    if df.empty:
        raise ValueError("Input file has no rows")

    client = OpenAI()
    analyzed_chunks: list[pd.DataFrame] = []

    for (platform, handle), user_df in df.groupby(["platform", "handle"], sort=False):
        payload = [
            {"post_id": row.post_id, "text": row.text, "published_at": row.published_at}
            for row in user_df.itertuples(index=False)
        ]
        model_out = classify_posts(client, payload, args.model)
        pred_df = pd.DataFrame(model_out.get("results", []))
        merged = user_df.merge(pred_df, on="post_id", how="left")
        analyzed_chunks.append(merged)
        print(f"Analyzed {platform}/{handle}: {len(merged)} posts")

    analyzed = pd.concat(analyzed_chunks, ignore_index=True)

    analyzed["themes"] = analyzed["themes"].apply(lambda x: x if isinstance(x, list) else [])
    analyzed["call_to_action"] = analyzed["call_to_action"].fillna(False).astype(bool)

    profiles = pd.DataFrame(profile_user(g) for _, g in analyzed.groupby(["platform", "handle"], sort=False))

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    analyzed.to_csv(args.output, index=False)
    profiles.to_csv(args.user_profiles, index=False)

    print(f"Saved analyzed posts -> {args.output}")
    print(f"Saved user profiles -> {args.user_profiles}")


if __name__ == "__main__":
    main()
