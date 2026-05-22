# Security & Performance Hardening Guide

هذا الملف يوضح التحسينات الأمنية والأداء المضافة إلى مشروع AI Agency.

## 🔒 الميزات الأمنية المضافة

### 1. Content Security Policy (CSP)

تم تفعيل CSP header في `next.config.ts`:
- **Production**: تم حظر `unsafe-eval` وجميع inline scripts
- **Development**: يسمح بـ `unsafe-inline` للحرارة الفورية

```typescript
// في next.config.ts
{
  key: 'Content-Security-Policy',
  value: process.env.NODE_ENV === 'development'
    ? "default-src 'self'; ..."
    : "default-src 'self'; script-src 'self'; ..."
}
```

### 2. Rate Limiting

تم إضافة rate limiting شامل لـ API endpoints:
- الحد الأقصى: 100 طلب / 15 دقيقة لكل IP
- يدعم التخزين المؤقت في الذاكرة أو Upstash Redis
- يعيد `429 Too Many Requests` عند تجاوز الحد

```typescript
// في route handlers
const rateLimitResult = await checkRateLimit({
  key: `api:endpoint:${clientIp}`,
  limit: 100,
  windowMs: 15 * 60 * 1000,
});
```

### 3. معالجة الأخطاء المركزية

تم إنشاء `error-handler.ts` مع:
- **AppError**: فئة مخصصة للأخطاء التطبيقية
- **ErrorLevel**: تصنيف الأخطاء (LOW, MEDIUM, HIGH, CRITICAL)
- **Sentry integration**: تقرير تلقائي للأخطاء

```typescript
// الاستخدام
throw new AppError(
  'Not found',
  404,
  ErrorLevel.LOW,
  { resource: 'user' }
);
```

### 4. التحقق من الصحة مع Zod

جميع API endpoints الآن تتحقق من صحة الـ payload:

```typescript
const schema = z.object({
  taskExecutionId: z.string().uuid('Invalid UUID format'),
  workspaceId: z.string().uuid(),
});

const validation = schema.safeParse(body);
if (!validation.success) {
  throw new AppError('Validation failed', 400, ErrorLevel.LOW);
}
```

### 5. Logging المنظم

استبدال جميع `console.log` برسائل logger منظمة:

```typescript
import { logger } from '@/lib/logger';

logger.info('Request received', { userId, action });
logger.error('Operation failed', { error: error.message });
logger.warn('Rate limit approaching', { remaining });
```

**الميزات الإضافية:**
- إعادة تعريف البيانات الحساسة (tokens, passwords, emails)
- Request ID و Trace ID للتتبع
- دعم السياق العام والأطفال

### 6. Sentry Integration

تتبع الأخطاء والأداء تلقائياً:
- الأخطاء غير المعالجة
- أداء الطلبات
- تتبع المستخدمين

```bash
# إعداد متغيرات البيئة
SENTRY_DSN=https://your-sentry-dsn
```

## 🧪 الاختبارات

تم إضافة Vitest مع اختبارات شاملة:

```bash
# تشغيل الاختبارات
npm run test

# المراقبة المستمرة
npm run test:watch

# تغطية الكود
npm run test:coverage
```

### الملفات المختبرة:
- `src/app/api/tasks/execute/route.test.ts` - اختبارات API
- `src/lib/error-handler.test.ts` - معالجة الأخطاء
- `src/lib/logger.test.ts` - نظام السجلات
- `src/lib/rate-limit.test.ts` - تحديد المعدل

## 📚 توثيق API

تم إضافة توثيق Swagger في `src/lib/swagger-docs.ts`.

**للمستقبل:** تثبيت `swagger-ui-express` و `swagger-jsdoc` لتوليد واجهة Swagger التفاعلية.

## 🚀 الاستخدام السريع

### API Handler Wrapper

استخدام wrapper موحد لجميع API endpoints:

```typescript
import { createApiHandler } from '@/lib/api-handler';

export const POST = createApiHandler(
  async (req, data) => {
    // معالجة الطلب
    return new Response(JSON.stringify({ success: true }));
  },
  {
    method: 'POST',
    schema: validationSchema,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
    },
  }
);
```

### معالجة الأخطاء في Route Handlers

```typescript
import { createErrorResponse } from '@/lib/error-handler';

try {
  // ... العملية
} catch (error) {
  return createErrorResponse(error, {
    endpoint: '/api/tasks/execute',
    requestId: req.id,
  });
}
```

## 📋 متطلبات المتصفح

- **Security Headers**: HSTS, X-Frame-Options, X-Content-Type-Options
- **CSP**: تحديد الموارد المسموح بها
- **Permissions Policy**: إلغاء الأجهزة الحساسة

## 🔍 المراقبة والتتبع

### في Production:
```bash
SENTRY_DSN=your-dsn
NODE_ENV=production
RATE_LIMIT_STORE=upstash
UPSTASH_REDIS_REST_URL=your-url
UPSTASH_REDIS_REST_TOKEN=your-token
```

### في Development:
```bash
NODE_ENV=development
# CSP يسمح بـ unsafe-inline
# Sentry logs في console
```

## 🛠️ الخطوات التالية

1. **إضافة ARIA Labels** - تحسين إمكانية الوصول
2. **تقسيم المكونات الكبيرة** - ContentStudioClient وغيرها
3. **اختبارات E2E** - مع Playwright
4. **مراقبة الأداء** - مع Datadog أو مشابه
5. **توثيق API كامل** - Swagger UI

## 📖 المراجع

- [Zod Documentation](https://zod.dev)
- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Vitest](https://vitest.dev)
- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [MDN CSP Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
