# AgentFlow-AI — Security Policy

**سياسة:** الأمان وحماية البيانات  
**تاريخ التفعيل:** 2026-07-11  
**المراجعة الدورية:** شهرياً

---

## 1. الهدف

ضمان أمان التطبيق وحماية بيانات المستخدمين من خلال تطبيق ممارسات أمنية صارمة في كل مرحلة من مراحل التطوير.

## 2. المبادئ الأساسية

1. **الأمان المدمج (Security by Design)** — الأمان جزء من كل مرحلة وليس إضافة لاحقة
2. **الحد الأدنى من الصلاحيات (Least Privilege)** — كل وكيل لديه فقط ما يحتاجه
3. **الدفاع في العمق (Defense in Depth)** — طبقات متعددة من الأمان
4. **لا تثق أحداً (Zero Trust)** — تحقق من كل شيء

## 3. القواعد الإلزامية

### 3.1 المفاتيح والأسرار (Secrets)
- ❌ لا تضع secrets في client-side code
- ❌ لا تضع secrets في git commits
- ❌ لا تشارك secrets في logs أو errors
- ❌ لا ترسل secrets في API responses
- ✅ استخدم server-only environment variables
- ✅ استخدم encryption للـ tokens المخزنة

### 3.2 قاعدة البيانات
- RLS policies على جميع الجداول
- workspace scoping على جميع البيانات
- service role فقط في server-side code
- encrypt sensitive data (tokens, PII)

### 3.3 APIs
- Zod validation على جميع الـ endpoints
- Rate limiting على جميع الـ routes
- Input sanitization
- CSRF protection على forms
- Secure cookies (HttpOnly, Secure, SameSite)

### 3.4 Authentication
- MFA متاحة لجميع المستخدمين
- Session timeout (45 دقيقة idle)
- Brute force protection
- Signup allowlist للـ beta

### 3.5 Frontend
- CSP headers
- لا inline scripts (حيثما أمكن)
- Sanitize user-generated content
- No secret exposure in client components

## 4. قائمة المراجعة الأمنية الإلزامية

```markdown
# Security Review Checklist

## Data Protection
- [ ] No secrets in client code
- [ ] RLS policies on all tables
- [ ] Input validation on all endpoints
- [ ] Output sanitization

## Authentication & Authorization
- [ ] RBAC enforced
- [ ] MFA available
- [ ] Session management secure
- [ ] Brute force protection active

## Infrastructure
- [ ] CSP headers configured
- [ ] Rate limiting active
- [ ] HTTPS enforced
- [ ] Secure cookies set

## Code Security
- [ ] No SQL injection vectors
- [ ] No XSS vectors
- [ ] No SSRF vectors
- [ ] Safe file upload handling
```

## 5. إجراءات أمنية إضافية

### 5.1 الأسبوع الأمني (Weekly Security Review)
- مراجعة جميع الـ PRs المعلقة
- فحص Sentry alerts
- تحديث dependencies (dependabot)
- مراجعة logs

### 5.2 الشهر الأمني (Monthly Security Audit)
- فحص شامل لـ RLS policies
- مراجعة جميع access tokens
- اختبار brute force protections
- تحديث rate limits حسب الحاجة

### 5.3 الإبلاغ عن ثغرة
- أي وكيل يكتشف ثغرة يجب:
  1. إشعار Security Agent فوراً
  2. إشعار CTO في نفس الوقت
  3. تعطيل الميزة المتأثرة إذا كانت شديدة الخطورة
  4. توثيق الثغرة

## 6. انتهاكات السياسة

| الانتهاك | الإجراء | المسؤول |
|----------|---------|---------|
| Secret في git commit | إزالة فورية + تدوير secret | DevOps |
| RLS policy مفقودة | إضافة فورية + مراجعة | Database + Security |
| تخطي security review | إعادة PR + توثيق | Architect |
| انتهاك متعمد | رفع إلى CTO | CTO |
