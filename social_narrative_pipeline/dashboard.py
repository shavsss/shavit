from __future__ import annotations

import pandas as pd
import plotly.express as px
import streamlit as st

st.set_page_config(page_title="Narrative Control Dashboard", layout="wide")
st.title("מי שולט בנרטיב? – השוואה בין קבוצות")

posts_path = st.sidebar.text_input("Analyzed posts CSV", "social_narrative_pipeline/analyzed_posts.csv")
profiles_path = st.sidebar.text_input("User profiles CSV", "social_narrative_pipeline/user_profiles.csv")
user_delta_path = st.sidebar.text_input("User delta CSV (optional)", "social_narrative_pipeline/user_weekly_delta.csv")
theme_delta_path = st.sidebar.text_input("Theme delta CSV (optional)", "social_narrative_pipeline/theme_weekly_delta.csv")

try:
    posts = pd.read_csv(posts_path)
    profiles = pd.read_csv(profiles_path)
except FileNotFoundError:
    st.error("לא נמצאו קבצי CSV. יש להריץ קודם scrape.py ואז analyze.py")
    st.stop()

for col in ["factual_score", "emotion_score", "aggression_score"]:
    posts[col] = pd.to_numeric(posts[col], errors="coerce")

st.subheader("Scatter: עובדתיות מול רגש")
scatter_df = posts.groupby(["platform", "handle", "group_label"], as_index=False)[["factual_score", "emotion_score"]].mean()
fig = px.scatter(
    scatter_df,
    x="factual_score",
    y="emotion_score",
    color="group_label",
    hover_data=["platform", "handle"],
    title="מיקום משתמשים: כמה עובדתי מול כמה אמוציונלי",
)
st.plotly_chart(fig, use_container_width=True)

st.subheader("Heatmap: שעות פעילות")
posts["published_at"] = pd.to_datetime(posts["published_at"], errors="coerce")
posts["hour"] = posts["published_at"].dt.hour
heat = posts.groupby(["group_label", "hour"]).size().reset_index(name="count")
fig2 = px.density_heatmap(
    heat,
    x="hour",
    y="group_label",
    z="count",
    color_continuous_scale="Viridis",
    title="אינטנסיביות ציוצים/פוסטים לפי שעה",
)
st.plotly_chart(fig2, use_container_width=True)

st.subheader("השוואת Themes")
posts["themes"] = posts["themes"].fillna("[]")
flat = []
for row in posts.itertuples(index=False):
    raw = str(row.themes).strip()
    tokens = [t.strip(" []'\"") for t in raw.split(",") if t.strip(" []'\"")]
    for token in tokens:
        flat.append({"group_label": row.group_label, "theme": token})

themes_df = pd.DataFrame(flat)
if not themes_df.empty:
    bars = themes_df.groupby(["group_label", "theme"]).size().reset_index(name="count")
    fig3 = px.bar(bars, x="theme", y="count", color="group_label", barmode="group")
    st.plotly_chart(fig3, use_container_width=True)
else:
    st.info("לא זוהו Themes להצגה")

st.subheader("נפח פעילות ממוצע למשתמש")
volume = profiles.groupby("group_label", as_index=False)["posts_count"].mean()
fig4 = px.bar(volume, x="group_label", y="posts_count", title="ממוצע פוסטים למשתמש")
st.plotly_chart(fig4, use_container_width=True)

st.subheader("השוואה מול שבוע קודם (אופציונלי)")
try:
    user_delta = pd.read_csv(user_delta_path)
    theme_delta = pd.read_csv(theme_delta_path)

    group_delta = user_delta.groupby("group_label", as_index=False)["delta_posts_count"].mean()
    fig5 = px.bar(group_delta, x="group_label", y="delta_posts_count", title="שינוי ממוצע בכמות פוסטים לעומת שבוע קודם")
    st.plotly_chart(fig5, use_container_width=True)

    if not theme_delta.empty:
        fig6 = px.bar(theme_delta, x="theme", y="delta_count", color="group_label", barmode="group", title="שינוי Themes לעומת שבוע קודם")
        st.plotly_chart(fig6, use_container_width=True)
except FileNotFoundError:
    st.info("לא נמצאו קבצי delta. להרצה: compare_windows.py")

st.dataframe(profiles, use_container_width=True)
