# Social Narrative Pipeline (X + Telegram)

מימוש ראשוני לפרויקט ניתוח נרטיבים בין שתי קבוצות מקוטבות, על אותו חלון זמן + השוואה מול שבוע קודם.

## מה כלול

1. `scrape.py` – איסוף פוסטים פומביים מ-X וטלגרם לפי רשימת משתמשים וטווח תאריכים.
2. `analyze.py` – ניתוח AI ברמת פוסט + אגרגציה לפרופיל משתמש.
3. `compare_windows.py` – השוואת חלון נוכחי מול אותו פרק זמן בשבוע הקודם.
4. `dashboard.py` – דאשבורד Streamlit להצגת ההבדלים בין הקבוצות.
5. `shortlist_targets.py` – סינון אוטומטי של longlist לפי קריטריונים.
6. `prompt_template.md` – תבנית Prompt עם פלט JSON קשיח.
7. `targets_template.csv` – תבנית מינימלית למטרות.
8. `targets_longlist_template.csv` – רשימת עבודה גדולה לבחירה משותפת (30 X + 30 Telegram לכל צד).

> ⚠️ חשוב: יש לפעול בהתאם לתנאי השימוש של X/Telegram והחוק המקומי. מומלץ לעבוד רק עם תוכן ציבורי.

---

## איך להריץ? (צעד-אחר-צעד)

### 0) התקנה

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r social_narrative_pipeline/requirements.txt
python -m playwright install chromium
```

### 1) בחירת משתמשים לפי הקריטריונים שלך

ערוך את הקובץ:

- `social_narrative_pipeline/targets_longlist_template.csv`

הקובץ כבר מוכן עם 120 שורות:

- 30 X תומכי משטר
- 30 Telegram תומכי משטר
- 30 X אופוזיציה
- 30 Telegram אופוזיציה

לכל שורה מלא:

- `handle` אמיתי
- `is_verified` (yes/no)
- `followers_estimate`
- `is_active` (yes/no)
- `agenda_tag`
- `priority_score` (0-100)
- `notes`


אופציונלי (מומלץ): הפעל סינון אוטומטי לפי הקריטריונים (מאומת, פעיל, מספיק עוקבים, פחות רשמי):

```bash
python social_narrative_pipeline/shortlist_targets.py   --input social_narrative_pipeline/targets_longlist_template.csv   --output social_narrative_pipeline/targets_final.csv   --min-followers 50000   --max-official-score 40
```

לאחר סינון ידני/אוטומטי, שמור את הרשימה הסופית לקובץ:

- `social_narrative_pipeline/targets_final.csv`

### 2) איסוף חלון נוכחי (למשל 28/2–1/3)

```bash
python social_narrative_pipeline/scrape.py \
  --targets social_narrative_pipeline/targets_final.csv \
  --start-date 2025-02-28 \
  --end-date 2025-03-01 \
  --output social_narrative_pipeline/raw_posts_current.csv
```

### 3) איסוף חלון שבוע קודם (למשל 21/2–22/2)

```bash
python social_narrative_pipeline/scrape.py \
  --targets social_narrative_pipeline/targets_final.csv \
  --start-date 2025-02-21 \
  --end-date 2025-02-22 \
  --output social_narrative_pipeline/raw_posts_previous.csv
```

### 4) ניתוח AI לשני החלונות

```bash
export OPENAI_API_KEY=...

python social_narrative_pipeline/analyze.py \
  --input social_narrative_pipeline/raw_posts_current.csv \
  --output social_narrative_pipeline/analyzed_posts.csv \
  --user-profiles social_narrative_pipeline/user_profiles.csv

python social_narrative_pipeline/analyze.py \
  --input social_narrative_pipeline/raw_posts_previous.csv \
  --output social_narrative_pipeline/analyzed_posts_previous.csv \
  --user-profiles social_narrative_pipeline/user_profiles_previous.csv
```

### 5) חישוב דלתא מול שבוע קודם

```bash
python social_narrative_pipeline/compare_windows.py \
  --current social_narrative_pipeline/analyzed_posts.csv \
  --previous social_narrative_pipeline/analyzed_posts_previous.csv \
  --output-user-delta social_narrative_pipeline/user_weekly_delta.csv \
  --output-theme-delta social_narrative_pipeline/theme_weekly_delta.csv
```

### 6) הרצת הדאשבורד

```bash
streamlit run social_narrative_pipeline/dashboard.py
```

---

## מה תראה בדאשבורד

- Scatter: `emotion_score` מול `factual_score`
- Heatmap: פעילות לפי שעה וקבוצה
- השוואת Themes בין קבוצות
- נפח פעילות ממוצע למשתמש
- שינוי מול שבוע קודם:
  - דלתא בכמות פוסטים
  - דלתא בהתפלגות Themes
