# shichabot — פריסה ל-Vercel

## מבנה הקבצים
```
/
├── api/
│   └── index.py          ← Flask backend (כל ה-API endpoints)
├── public/
│   ├── index.html
│   ├── style.css
│   └── index.js
├── requirements.txt      ← תלויות Python
└── vercel.json           ← הגדרות Vercel
```

## שלבי הפריסה

### 1. GitHub
- צור repository חדש ב-GitHub
- העלה את כל הקבצים (כולם מהתיקייה הזו)

### 2. Vercel
1. היכנס ל-[vercel.com](https://vercel.com) והתחבר עם GitHub
2. לחץ "Add New Project" → בחר את ה-repository
3. Vercel יזהה אוטומטית את `vercel.json`
4. לחץ "Deploy" — זהו!

### 3. משתני סביבה (אופציונלי)
אם תרצה לשמור מפתח HF קבוע בשרת:
- ב-Vercel → Settings → Environment Variables
- הוסף: `HF_API_KEY` = המפתח שלך

## הגבלות Vercel (חשוב!)
- **Timeout**: 60 שניות לבקשה בחינם (Pro: 300 שניות)
  - שיחות רגילות: בסדר גמור
  - פודקאסט ארוך: עלול להיחתך — מומלץ Vercel Pro
- **אין tkinter**: הורדות קבצים עובדות דרך הדפדפן
- **אין AppData**: ההגדרות נשמרות ב-localStorage של הדפדפן

## הבדלים בין גרסת EXE לגרסת Web
| פיצ'ר | EXE | Web (Vercel) |
|---|---|---|
| שמירת קבצים | חלון Windows | הורדה דרך דפדפן |
| שמירת הגדרות | AppData | localStorage |
| Gemini Podcast | ✅ | ✅ (עד 60 שניות) |
| עבודה offline | ❌ | ❌ |
