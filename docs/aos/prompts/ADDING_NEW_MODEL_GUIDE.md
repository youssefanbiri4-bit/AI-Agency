# AgentFlow-AI — Adding New AI Models Guide

**دليل:** إضافة نموذج AI جديد إلى نظام AOS  
**النظام:** AgentFlow-AI Multi-Agent Operating System (AOS)

---

## 1. المقدمة

نظام AOS مصمم ليكون **قابلاً للتوسع** بحيث يمكن إضافة أي نموذج AI جديد (مثل Grok, FreeBuff, GLM, Claude, Gemini, Codex, GPT-5, إلخ) دون الحاجة إلى إعادة تصميم النظام الأساسي.

## 2. الهندسة المعمارية

```
[AgentFlow-AI AOS]
       │
       ▼
[Agent Interface Layer] ←── Abstraction Layer
       │
       ├── [Model Adapter: OpenAI]
       ├── [Model Adapter: Anthropic]
       ├── [Model Adapter: Grok]
       ├── [Model Adapter: FreeBuff]
       └── [Future Models...]
```

## 3. خطوات إضافة نموذج جديد

### الخطوة 1: إنشاء Model Adapter
```typescript
// src/lib/ai/models/[model-name]-adapter.ts
import type { AIModelAdapter, ModelConfig, ModelResponse } from './types';

export class [ModelName]Adapter implements AIModelAdapter {
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  async generate(prompt: string, options?: ModelOptions): Promise<ModelResponse> {
    // تنفيذ خاص بكل نموذج
    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.modelName,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens,
        temperature: options?.temperature,
      }),
    });

    return response.json();
  }
}
```

### الخطوة 2: إضافة الـ Adapter إلى الـ Registry
```typescript
// src/lib/ai/models/registry.ts
export const MODEL_REGISTRY: Record<string, AIModelAdapterConstructor> = {
  'openai': OpenAIAdapter,
  'anthropic': AnthropicAdapter,
  'grok': GrokAdapter,
  'freebuff': FreeBuffAdapter,
  'glm': GLMAdapter,
  'gemini': GeminiAdapter,
};
```

### الخطوة 3: إضافة Environment Variables
```bash
# .env.example
[UPPERCASE_MODEL]_API_KEY=
[UPPERCASE_MODEL]_API_URL=
[UPPERCASE_MODEL]_MODEL_NAME=
```

### الخطوة 4: إضافة تعريف الوكيل
```yaml
# docs/aos/agents/[MODEL]_AGENT.md
agent:
  id: [model-name]-agent
  name: [Model Name] Agent
  model: [model-name]
  capabilities: [...]
```

### الخطوة 5: إضافة إلى نظام المراجعة
أضف الـ model الجديد إلى قائمة المراجعة الأمنية للتأكد من:
- API key آمن
- Rate limits مناسبة
- Data privacy محترمة
- Cost tracking مفعل

## 4. قائمة النماذج المدعومة حالياً

| النموذج | الحالة | المحول (Adapter) | التاريخ |
|---------|--------|-------------------|---------|
| OpenAI GPT-4o | ✅ مدعوم | openai-adapter | موجود |
| DeepSeek V4 Flash | ✅ مدعوم (FreeBuff) | freebuff-adapter | 2026-07-11 |
| Anthropic Claude | 🔧 قيد الإعداد | — | مستقبلاً |
| Google Gemini | 📋 مخطط له | — | مستقبلاً |
| xAI Grok | 📋 مخطط له | — | مستقبلاً |
| GLM (Zhipu) | 📋 مخطط له | — | مستقبلاً |
| GitHub Copilot/Codex | 📋 مخطط له | — | مستقبلاً |

## 5. واجهة الـ Adapter الموحدة

```typescript
// src/lib/ai/models/types.ts

interface AIModelAdapter {
  name: string;
  model: string;
  
  generate(prompt: string, options?: ModelOptions): Promise<ModelResponse>;
  stream?(prompt: string, options?: ModelOptions): AsyncIterable<ModelChunk>;
  embed?(text: string): Promise<number[]>;
}

interface ModelConfig {
  apiUrl: string;
  apiKey: string;
  modelName: string;
  maxTokens: number;
  temperature: number;
}

interface ModelResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

interface ModelOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}
```

## 6. قواعد إضافة نموذج جديد

1. **Adapter Pattern** — كل نموذج يحتاج محول (Adapter) ينفذ الواجهة الموحدة
2. **لا تكرار** — استخدم الـ adapter الموجود كنموذج
3. **اختبار** — اختبر الـ adapter مع prompt اختباري قبل الاستخدام
4. **Cost Tracking** — أضف tracking لاستخدام API tokens
5. **Secrets** — API keys تبقى server-side فقط
6. **Fallback** — أضف fallback mechanism إذا فشل النموذج الأساسي

## 7. اختبار الـ Adapter الجديد

```bash
# اختبار أن الـ adapter يعمل
npm run test -- --grep "[ModelName] Adapter"

# اختبار التكامل مع النظام
npm run test

# التحقق من عدم تسريب API keys
npm run security:audit
```
