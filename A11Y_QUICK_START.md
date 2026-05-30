# 🎯 Accessibility Testing Quick Start Guide

تم إعداد أدوات اختبار شاملة لـ WCAG 2.1 AA compliance.

## ⚡ الخطوات السريعة

### 1️⃣ تثبيت الأدوات

```bash
# تثبيت pa11y و axe-core
npm install

# أو يدويًا:
npm install --save-dev pa11y pa11y-ci @axe-core/react
```

### 2️⃣ تثبيت متصفح الأدوات

#### Chrome Extensions:
1. **axe DevTools**: https://chrome.google.com/webstore/detail/axe-devtools-web-accessib/lhdoppojpmngadmnkpklempisson
2. **WAVE**: https://wave.webaim.org/extension/
3. **Lighthouse**: بالفعل مُضمن في Chrome DevTools

#### Screen Readers:
- **Windows**: [NVDA](https://www.nvaccess.org/) (مجاني)
- **Mac**: VoiceOver (بالفعل مُضمن - Cmd+F5)
- **Linux**: [Orca](https://help.gnome.org/users/orca/stable/)

---

## 🚀 تشغيل الاختبارات

### طريقة 1: الاختبار الآلي (Automated)

```bash
# تشغيل pa11y-ci على جميع URLs
npm run a11y:test

# أو على صفحة محددة
npm run a11y:audit
```

**النتيجة:** تقرير مفصل بجميع مشاكل الـ accessibility

### طريقة 2: Lighthouse (Chrome DevTools)

1. افتح الصفحة في Chrome
2. اضغط F12 لفتح DevTools
3. اذهب إلى tab **Lighthouse**
4. اختر **Accessibility**
5. اضغط **Analyze page load**

**النتيجة:** نقاط + توصيات

### طريقة 3: axe DevTools (Chrome Extension)

1. افتح الصفحة
2. اضغط على axe Extension
3. اضغط **Scan this page**
4. راجع النتائج

**النتيجة:** تصنيف Violations (مهم جداً) + Passes

### طريقة 4: WAVE (Chrome Extension)

1. افتح الصفحة
2. اضغط على WAVE Extension
3. اعرض **Statistics**

**النتيجة:** عدد الأخطاء والتحذيرات

---

## ⌨️ اختبار Keyboard Navigation

### Windows/Linux:
```
Tab            → التنقل للأمام
Shift + Tab    → التنقل للخلف
Enter          → تفعيل الزر
Space          → تفعيل Checkbox/Radio
Arrow Keys     → التنقل في القوائم
Escape         → إغلاق Modal
```

### Checklist:
- [ ] جميع العناصر التفاعلية قابلة للوصول عبر Tab
- [ ] مؤشر التركيز مرئي دائماً
- [ ] ترتيب Tab منطقي
- [ ] لا توجد "keyboard traps"

---

## 🔊 اختبار Screen Reader (NVDA)

### التثبيت:
```bash
# Windows: https://www.nvaccess.org/
# بعد التثبيت، اضغط Ctrl+Alt+N لبدء NVDA
```

### الاختصارات الأساسية:
```
Ctrl+Alt+N         → بدء NVDA
Insert+H          → عرض المساعدة
Insert+Down       → قراءة العنصر الحالي
Insert+Up Arrow   → قراءة العنوان
Insert+F7         → قائمة الروابط
Insert+F5         → معلومات الصفحة
Insert+Home       → ما قبل اختبار الروابط
```

### ماذا تفحص:
- [ ] عنوان الصفحة يُعلن عند التحميل
- [ ] تسلسل العناوين منطقي (h1 → h2 → h3)
- [ ] تسميات الحقول مرتبطة بـ inputs
- [ ] رسائل الخطأ معلنة
- [ ] أزرار قائمة الألعاب مسماة

---

## 🎨 اختبار Color Contrast

### أداة WebAIM Checker:
https://webaim.org/resources/contrastchecker/

### النسب المطلوبة:
- **Normal text**: 4.5:1
- **Large text** (18pt+): 3:1
- **UI components**: 3:1

### مثال:
```
Foreground: #FFFFFF (white)
Background: #F7CBCA (pink)
Contrast: 4.5:1 ✅ PASS
```

---

## 📋 الملفات الجديدة

```
A11Y_TESTING_CHECKLIST.md    # قائمة اختبار شاملة
.pa11yci.json                # إعدادات pa11y-ci
scripts/setup-a11y-testing.sh # سكريبت الإعداد
```

---

## 🔧 Commands المتاحة

```bash
npm run a11y:setup      # إعداد أدوات الاختبار
npm run a11y:test       # تشغيل pa11y-ci
npm run a11y:audit      # فحص صفحة واحدة
npm run test            # تشغيل الاختبارات العامة
npm run test:coverage   # تغطية الكود
```

---

## 📊 نموذج التقرير

عند إيجاد مشاكل:

```markdown
### Issue #1
- **الوصف:** غياب aria-label على زر الحذف
- **الشدة:** Medium
- **التأثير:** مستخدمو screen reader لا يعرفون ما يفعل الزر
- **الحل:** إضافة aria-label="Delete item"
- **الملف:** src/components/ui/Button.tsx
- **الأولوية:** High

### Issue #2
- **الوصف:** نسبة تباين لون غير كافية للنص الثانوي
- **الشدة:** Medium
- **النسبة الحالية:** 3:1 (مطلوبة 4.5:1)
- **الحل:** تغيير اللون من #5D6B6B إلى #3D4B4B
- **الأولوية:** High
```

---

## 🎓 موارد تعليمية

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Blog](https://webaim.org/blog/)

---

## ✅ Checklist قبل البدء

- [ ] npm install (لتثبيت pa11y)
- [ ] تثبيت Chrome Extensions (axe + WAVE)
- [ ] تثبيت NVDA (للـ Screen Reader)
- [ ] بدء `npm run dev`
- [ ] فتح `A11Y_TESTING_CHECKLIST.md`
- [ ] بدء الاختبارات!

---

**🎉 هيا نبدأ الاختبار!**

نقترح البدء بـ:
1. صفحة Login (أبسط)
2. صفحة Dashboard (المتوسطة)
3. Content Studio (الأكثر تعقيداً)
