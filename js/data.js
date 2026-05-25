'use strict';


/* ═════ DATA ═════ */
const BIDDER = {
  name:'משרד כהן ואסוציינטים',
  subtitle:'רואי חשבון ומבקרים פנימיים',
  address:"רח' אחוזה 15, רעננה 4309603",
  phone:'09-7403000',fax:'09-7403001',
  email:'info@cohen-audit.co.il',
  vat:'123456789',
  signatory:'יוסי כהן רו"ח — שותף מנהל'
};

let TENDERS = [
  {id:0,name:'ביקורת פנימית שוטפת',org:'עיריית פתח תקווה',
   number:'מכרז 2025/פ"ת/041',type:'ביקורת פנימית',
   status:'urgent',daysLeft:3,score:91,value:'₪320,000/שנה',
   duration:'3 שנים + אופציה ל-2',winners:'זוכה יחיד',
   submitDeadline:'05.03.2025 | 12:00',questionsDeadline:'20.02.2025',
   tourDate:'15.02.2025 | 10:00',openDate:'06.03.2025 | 14:00',
   tenderBond:'₪20,000 — תוקף 90 יום',performanceBond:'5% מהחוזה',
   liabilityBond:'10% — שנה לאחר סיום',insurance:'ביטוח מקצועי ₪3M + צד ג׳ ₪1M',
   scope:'ביקורת שוטפת כל יחידות העירייה: שכר, רכש, תמיכות, גביה, בקרת פרויקטים',
   thresholds:['רישיון רו"ח פעיל','ניסיון 10+ שנים ברשויות מקומיות','5 ביקורות ב-5 שנים ברשות מעל 50K נפש','מחזור שנתי ₪1.5M לפחות','ללא ניגוד עניינים ב-3 שנים'],
   qualityScoring:[{l:'ניסיון המשרד',w:30,m:30},{l:'ניסיון מנהל הביקורת',w:25,m:25},{l:'כישורי הצוות',w:20,m:20},{l:'תוכנית עבודה',w:15,m:15},{l:'מחיר',w:10,m:10}],
   teamReq:[{role:'מנהל ביקורת ראשי',req:'רו"ח + 12 שנות ניסיון'},{role:'מבקר בכיר',req:'רו"ח + 7 שנות ניסיון'},{role:'מבקר',req:'השכלה רלוונטית + 3 שנות ניסיון'}],
   highlights:['נוכחות פיזית 3 ימים/שבוע','הגשה אלקטרונית + 3 עותקים','מחיר 10% בלבד'],
   flags:['ערבות ביצוע 5% — גבוהה מהרגיל','נוכחות חובה 3 ימים/שבוע'],
   appExp:[
     {client:'עיריית ראשון לציון',years:'2020–2024',scope:'₪280,000/שנה',area:'ביקורת פנימית מלאה',contact:"גב' שרית אבני",phone:'03-9541200',mobile:'054-2341200',email:'savni@rishon.muni.il',hours:'1,200 שע/שנה'},
     {client:'עיריית בת ים',years:'2017–2020',scope:'₪195,000/שנה',area:'ביקורת פנימית + שכר',contact:'מר יוסי מלכה',phone:'03-6529000',mobile:'052-3219000',email:'ymalka@bat-yam.muni.il',hours:'900 שע/שנה'},
     {client:'מועצה מקומית יהוד',years:'2015–2017',scope:'₪120,000/שנה',area:'ביקורת שכר ורכש',contact:'ד"ר אבי שמש',phone:'03-9393000',mobile:'050-9393001',email:'ashemesh@yehud.muni.il',hours:'600 שע/שנה'}
   ],
   appTeam:[
     {name:'יוסי כהן רו"ח',role:'מנהל ביקורת ראשי',id:'012345678',years:18,certs:'רו"ח, מבקר פנימי מוסמך (CIPA)',areas:'ביקורת פנימית, שכר, רכש'},
     {name:'מירי לוי רו"ח',role:'מבקרת בכירה',id:'023456789',years:12,certs:'רו"ח',areas:'ביקורת פנים, גביה'},
     {name:'דניאל ברק',role:'מבקר',id:'034567890',years:7,certs:'BA חשבונאות, CPA',areas:'ביקורת כספים'}
   ]
  },
  {id:1,name:'ביקורת שכר ורכש',org:'מועצה אזורית חוף הכרמל',
   number:"מכרז 2025/כ\"ח/017",type:'ביקורת שכר ורכש',
   status:'soon',daysLeft:14,score:78,value:'₪140,000/שנה',
   duration:'2 שנים + אופציה ל-1',winners:'זוכה יחיד',
   submitDeadline:'20.03.2025 | 14:00',questionsDeadline:'05.03.2025',
   tourDate:'לא נדרש',openDate:'21.03.2025 | 10:00',
   tenderBond:'₪8,000 — תוקף 60 יום',performanceBond:'3% מהחוזה',
   liabilityBond:'5% — שנה לאחר סיום',insurance:'ביטוח מקצועי ₪1M',
   scope:'ביקורת תהליכי שכר, רכש וספקים, בקרת הסכמי שכר מיוחדים',
   thresholds:['ניסיון 5 שנים בביקורת שכר/רכש','הכרות מערכות שכר ממשלתיות','אישור ניהול תקין'],
   qualityScoring:[{l:'ניסיון שכר ורכש',w:40,m:40},{l:'כישורי הצוות',w:30,m:30},{l:'תוכנית ביקורת',w:20,m:20},{l:'מחיר',w:10,m:10}],
   teamReq:[{role:'ראש הצוות',req:'ניסיון 5+ שנים בביקורת שכר ורכש'},{role:'מבקר',req:'ניסיון 2+ שנים'}],
   highlights:['הגשה אלקטרונית בלבד','שאלות הבהרה בכתב','ביקורת הסכמים ייחודיים'],
   flags:['גישה למידע שכר רגיש — נדרשת הצהרת סודיות'],
   appExp:[
     {client:'מועצה אזורית מנשה',years:'2021–2024',scope:'₪110,000/שנה',area:'ביקורת שכר מלאה',contact:'מר דרור כהן',phone:'04-6395100',mobile:'052-6395100',email:'dcohen@menashe.org.il',hours:'480 שע/שנה'},
     {client:'עיריית נהריה',years:'2019–2021',scope:'₪95,000/שנה',area:'ביקורת רכש',contact:"גב' רחל גולד",phone:'04-9109000',mobile:'054-9109001',email:'rgold@nahariya.muni.il',hours:'400 שע/שנה'}
   ],
   appTeam:[
     {name:'מירי לוי רו"ח',role:'ראש הצוות',id:'023456789',years:12,certs:'רו"ח',areas:'ביקורת שכר, רכש'},
     {name:'שיר אברהם',role:'מבקרת',id:'045678901',years:6,certs:'תעודת רכש ציבורי',areas:'רכש, ספקים'}
   ]
  },
  {id:2,name:'ייעוץ כלכלי ובקרת תקציב',org:'עיריית נתניה',
   number:'מכרז 2025/נ/088',type:'ייעוץ כלכלי',
   status:'ok',daysLeft:38,score:85,value:'₪220,000/שנה',
   duration:'3 שנים',winners:'2 זוכים — מסגרת',
   submitDeadline:'18.04.2025 | 12:00',questionsDeadline:'01.04.2025',
   tourDate:'20.03.2025 | 09:00',openDate:'19.04.2025 | 14:00',
   tenderBond:'₪15,000 — תוקף 90 יום',performanceBond:'4% מהחוזה',
   liabilityBond:'7% — שנה לאחר סיום',insurance:'ביטוח מקצועי ₪2M',
   scope:'ייעוץ כלכלי לאגפי העירייה, בקרת תקציב שנתי, ניתוח חריגות',
   thresholds:['תואר שני בכלכלה/חשבונאות/MBA','ניסיון 8 שנים בייעוץ כלכלי לרשויות','הכרות תקנות ניהול תקציב'],
   qualityScoring:[{l:'ניסיון בייעוץ כלכלי',w:35,m:35},{l:'כישורי הצוות',w:25,m:25},{l:'הצעה מתודולוגית',w:25,m:25},{l:'מחיר',w:15,m:15}],
   teamReq:[{role:'כלכלן ראשי',req:'תואר שני + 8 שנות ניסיון'},{role:'אנליסט',req:'תואר ראשון + 3 שנות ניסיון'},{role:'חשב מלווה',req:'רו"ח + 5 שנות ניסיון'}],
   highlights:['2 זוכים — עירייה תחלק עבודה','2 ישיבות חודשיות חובה','דוח בקרה רבעוני'],
   flags:['2 זוכים — מחיר שקוף לזוכה השני','תנאי תואר שני — חובה לבדוק'],
   appExp:[
     {client:'עיריית אשדוד',years:'2022–2024',scope:'₪185,000/שנה',area:'ייעוץ כלכלי',contact:'מר ערן מזרחי',phone:'08-8545000',mobile:'053-8545001',email:'emazrahi@ashdod.muni.il',hours:'700 שע/שנה'},
     {client:'עיריית חולון',years:'2019–2022',scope:'₪160,000/שנה',area:'ייעוץ לאגפים',contact:"גב' דנה שרון",phone:'03-5027000',mobile:'050-5027001',email:'dsharon@holon.muni.il',hours:'600 שע/שנה'},
     {client:'מועצה אזורית שפיר',years:'2017–2019',scope:'₪90,000/שנה',area:'בקרת תקציב',contact:'מר בני אדרי',phone:'08-6821000',mobile:'054-6821002',email:'badri@shafir.org.il',hours:'350 שע/שנה'}
   ],
   appTeam:[
     {name:'דניאל ברק רו"ח',role:'כלכלן ראשי',id:'034567890',years:9,certs:'MBA, רו"ח',areas:'ייעוץ כלכלי, תקציב'},
     {name:'אמיר נחום',role:'אנליסט',id:'056789012',years:5,certs:'BA כלכלה',areas:'ניתוח נתונים'},
     {name:'יוסי כהן רו"ח',role:'חשב מלווה',id:'012345678',years:18,certs:'רו"ח, CIPA',areas:'ביקורת, כספים'}
   ]
  }
];

let teamMembers = [
  {name:'יוסי כהן',title:'רו"ח',role:'שותף מנהל',years:18,color:'#1a5c4a',ini:'יכ',areas:['ביקורת פנימית','ביקורת שכר','ניהול סיכונים','רגולציה'],certs:['רו"ח','מבקר פנימי מוסמך (CIPA)']},
  {name:'מירי לוי',title:'רו"ח',role:'מנהלת ביקורת בכירה',years:12,color:'#2d6a4f',ini:'מל',areas:['ביקורת פנימית','ביקורת שכר','ביקורת רכש'],certs:['רו"ח','הסמכה בביקורת שכר']},
  {name:'דניאל ברק',title:'רו"ח',role:'כלכלן ומנהל כספים',years:9,color:'#7c3d12',ini:'דב',areas:['ייעוץ כלכלי','חשבות שכר','תקציב','IFRS'],certs:['MBA','רו"ח','CPA']},
  {name:'שיר אברהם',title:'',role:'מנהלת רכש',years:7,color:'#5b21b6',ini:'שא',areas:['ביקורת רכש','מכרזים','ניהול חוזים'],certs:['תעודת רכש ציבורי']},
  {name:'אמיר נחום',title:'',role:'מנתח נתונים',years:5,color:'#1e5c9a',ini:'אנ',areas:['ביקורת IT','אנליטיקס','אבטחת מידע'],certs:['CISA','BA כלכלה']}
];

let vaultDocs = [
  {id:1,name:'אישור ניהול תקין',icon:'⚖️',expiry:'2025-12-31',days:303,required:true,file:'nihal_takin_2025.pdf'},
  {id:2,name:'ניכוי במקור',icon:'🧾',expiry:'2025-04-15',days:44,required:true,file:'nkoi_bemakor_2025.pdf'},
  {id:3,name:'ניהול ספרים',icon:'🧾',expiry:'2025-06-30',days:120,required:true,file:'nihul_sfraim_2025.pdf'},
  {id:4,name:'ביטוח מקצועי',icon:'🛡️',expiry:'2025-11-01',days:244,required:true,file:'bituach_miktzoyi.pdf'},
  {id:5,name:"ביטוח צד ג'",icon:'🛡️',expiry:'2025-11-01',days:244,required:true,file:'bituach_tzad_g.pdf'},
  {id:6,name:'תעודת רישום עוסק',icon:'📜',expiry:null,days:999,required:true,file:'teuda_rishum.pdf'},
  {id:7,name:'רישיון עסק',icon:'📜',expiry:'2025-08-31',days:182,required:true,file:'rishayon_esek.pdf'},
  {id:8,name:'אישור רואה חשבון',icon:'💰',expiry:null,days:999,required:false,file:'ishur_roeh.pdf'}
];

const EXPERT_AREAS = ['ביקורת פנימית','ביקורת שכר','ביקורת רכש','חשבות שכר','הנהלת חשבונות','ניהול כספים','תמיכות ומענקים','גביית ארנונה','תקציב עירוני','מכרזים ורכש ציבורי','ביקורת IT','בקרת מלאי','ניהול סיכונים','ציות ורגולציה','IFRS ציבורי','ייעוץ כלכלי','חשבונאות ממשלתית','בקרת פרויקטים','ניהול חוזים','ביקורת תמיכות'];
const EXCEL_COLS = ['שם','ת.ז','תפקיד','שנות ניסיון','טלפון','מייל','הסמכות','תחומי ניסיון'];
const SYS_FIELDS = ['שם מלא','תעודת זהות','תפקיד','שנות ניסיון','טלפון','מייל','הסמכות','תחומי ניסיון','— לא לייבא —'];
const PAGE_META = {
  dashboard:{t:'לוח מחוונים',s:'סקירה כללית ועדכונים שוטפים'},
  tenders:{t:'מכרזים פעילים',s:'לחץ לפרטים, נספחים וייצוא ZIP'},
  analysis:{t:'העלאת מכרז',s:'ניתוח AI — חילוץ מידע אוטומטי'},
  team:{t:'מאגר צוות',s:'ניהול עובדים — ניקוד מחושב בזמן אמת'},
  simulator:{t:'סימולטור זכייה',s:'AI ממפה צוות ומחשב סיכוי'},
  vault:{t:'תיקיית המציע',s:'מסמכי יסוד — נשלפים לכל הגשה'},
  import:{t:'ייבוא עובדים',s:'קליטת Excel/CSV עם מיפוי שדות'},
  settings:{t:'הגדרות',s:'פרופיל המשרד, אבטחה ומשתמשים'}
};

let currentPage = 'dashboard';
let tmId = 0, tmTab = 'overview', tmAppTab = 'exp';
let selectedAreas = [];
let tenderFilter = 'all';
let currentAnalysisIdx = -1;
let uploadedFileContent = '';
let uploadedFileName = '';
let currentAIResult = null;
let isMobile = false;

