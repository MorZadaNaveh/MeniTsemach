'use strict';


/* ═════ DATA ═════ */
const BIDDER = {
  name:'',
  subtitle:'',
  address:'',
  phone:'',fax:'',
  email:'',
  vat:'',
  signatory:''
};

let TENDERS = [];

let teamMembers = [];

let vaultDocs = [];

const EXPERT_AREAS = ['ביקורת פנימית','ביקורת שכר','ביקורת רכש','חשבות שכר','הנהלת חשבונות','ניהול כספים','תמיכות ומענקים','גביית ארנונה','תקציב עירוני','מכרזים ורכש ציבורי','ביקורת IT','בקרת מלאי','ניהול סיכונים','ציות ורגולציה','IFRS ציבורי','ייעוץ כלכלי','חשבונאות ממשלתית','בקרת פרויקטים','ניהול חוזים','ביקורת תמיכות'];
const EXCEL_COLS = ['שם','ת.ז','תפקיד','שנות ניסיון','טלפון','מייל','הסמכות','תחומי ניסיון'];
const SYS_FIELDS = ['שם מלא','תעודת זהות','תפקיד','שנות ניסיון','טלפון','מייל','הסמכות','תחומי ניסיון','— לא לייבא —'];
const PAGE_META = {
  home:{t:'עמוד הבית',s:'סקירה כללית'},
  dashboard:{t:'לוח מחוונים',s:'סקירה כללית ועדכונים שוטפים'},
  tenders:{t:'מכרזים פעילים',s:'לחץ לפרטים, נספחים וייצוא ZIP'},
  analysis:{t:'העלאת מכרז',s:'ניתוח AI — חילוץ מידע אוטומטי'},
  team:{t:'מאגר צוות',s:'ניהול עובדים — ניקוד מחושב בזמן אמת'},
  simulator:{t:'סימולטור זכייה',s:'AI ממפה צוות ומחשב סיכוי'},
  vault:{t:'תיקיית המציע',s:'מסמכי יסוד — נשלפים לכל הגשה'},
  import:{t:'ייבוא עובדים',s:'קליטת Excel/CSV עם מיפוי שדות'},
  settings:{t:'הגדרות',s:'פרופיל המשרד, אבטחה ומשתמשים'}
};

let currentPage = 'home';
let tmId = 0, tmTab = 'overview', tmAppTab = 'exp';
let selectedAreas = [];
let tenderFilter = 'all';
let currentAnalysisIdx = -1;
let uploadedFileContent = '';
let uploadedFileName = '';
let currentAIResult = null;
let isMobile = false;
