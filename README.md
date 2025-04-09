# WhatsApp Real Estate Bot

בוט וואטסאפ לניהול עסקאות נדל"ן עם אינטגרציית DocuSign לחתימה דיגיטלית.

## תכונות עיקריות

- חיבור לממשק API של WhatsApp Business
- אינטגרציה עם DocuSign לחתימה דיגיטלית
- אחסון נתונים ב-Firebase Firestore
- התראות שבועיות על עסקאות חדשות
- ממשק לניהול הסכמי תיווך

## התקנה

```bash
# התקנת תלויות
npm install

# הגדרת משתני סביבה (העתק מקובץ הדוגמה)
cp .env.example .env

# בנייה
npm run build

# הפעלת אמולטור מקומי
npm run emulate

# פריסה לשרתי Firebase
npm run deploy:functions
```

## הגדרה

1. צור פרויקט Firebase
2. הגדר את המשתנים בקובץ `.env`
3. הגדר את ה-webhook של WhatsApp והתחבר ל-API
4. הגדר את ה-webhook של DocuSign

## פיתוח

```bash
# הפעלת סביבת פיתוח עם אמולטור Firebase
npm run emulate
``` 