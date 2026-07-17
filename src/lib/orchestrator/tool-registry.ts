import 'server-only';

import { AGENTS } from '@/lib/agents';
import type { AgentType } from '@/types';
import type {
  ToolDefinition,
  ToolCategory,
  ToolRiskLevel,
  ToolParameter,
} from './types';

const agentCategoryMap: Record<string, ToolCategory> = {
  // Research & Strategy
  market_research: 'research',
  competitor_analysis: 'research',
  audience_persona: 'research',
  product_idea: 'research',
  seo_keyword: 'research',
  strategy_planner: 'research',
  // Content & Growth
  social_media_content: 'content',
  copywriting: 'content',
  ads_script: 'content',
  email_marketing: 'content',
  blog_seo_article: 'content',
  visual_brief: 'content',
  // Sales & Operations
  lead_finder: 'sales',
  lead_qualifier: 'sales',
  outreach_message: 'sales',
  crm_update: 'sales',
  customer_support: 'sales',
  analytics_report: 'analytics',
  // Development & Engineering
  'code-review-agent': 'development',
  'bug-fix-agent': 'development',
  'architecture-agent': 'development',
  'testing-agent': 'development',
  'documentation-agent': 'development',
  'deployment-agent': 'development',
  'security-review-agent': 'development',
  'database-agent': 'development',
  'ui-ux-review-agent': 'development',
  // Legacy
  offer_builder: 'content',
  content_creator: 'content',
  outreach: 'sales',
  report: 'analytics',
};

const agentEngineMap: Record<string, 'openai' | 'claude'> = {
  // Development & Engineering — routed through Anthropic Claude API
  'code-review-agent': 'claude',
  'bug-fix-agent': 'claude',
  'architecture-agent': 'claude',
  'testing-agent': 'claude',
  'documentation-agent': 'claude',
  'deployment-agent': 'claude',
  'security-review-agent': 'claude',
  'database-agent': 'claude',
  'ui-ux-review-agent': 'claude',
};

const agentRiskMap: Record<string, ToolRiskLevel> = {
  // Research tools — read only
  market_research: 'read_only',
  competitor_analysis: 'read_only',
  audience_persona: 'read_only',
  product_idea: 'draft_only',
  seo_keyword: 'read_only',
  strategy_planner: 'draft_only',
  // Content tools — draft only
  social_media_content: 'draft_only',
  copywriting: 'draft_only',
  ads_script: 'draft_only',
  email_marketing: 'draft_only',
  blog_seo_article: 'draft_only',
  visual_brief: 'draft_only',
  // Sales tools — requires confirmation
  lead_finder: 'requires_confirmation',
  lead_qualifier: 'requires_confirmation',
  outreach_message: 'requires_confirmation',
  crm_update: 'requires_confirmation',
  customer_support: 'requires_confirmation',
  analytics_report: 'read_only',
  // Dev tools — draft only
  'code-review-agent': 'read_only',
  'bug-fix-agent': 'draft_only',
  'architecture-agent': 'draft_only',
  'testing-agent': 'draft_only',
  'documentation-agent': 'draft_only',
  'deployment-agent': 'requires_confirmation',
  'security-review-agent': 'read_only',
  'database-agent': 'requires_confirmation',
  'ui-ux-review-agent': 'read_only',
  // Legacy
  offer_builder: 'draft_only',
  content_creator: 'draft_only',
  outreach: 'requires_confirmation',
  report: 'read_only',
};

function buildToolParameters(agentType: AgentType): ToolParameter[] {
  const config = AGENTS[agentType];
  if (!config) return [];

  return config.inputFields.map((field) => {
    const param: ToolParameter = {
      name: field.name,
      label: field.label,
      type: field.type === 'textarea' ? 'string' : field.type === 'number' ? 'number' : field.type === 'email' ? 'string' : field.type === 'checkbox' ? 'boolean' : field.type === 'select' ? 'select' : 'string',
      required: field.required,
      description: field.label,
      default: field.options?.length ? field.options[0].value : undefined,
    };

    if (field.options) {
      param.options = field.options.map((o) => ({
        value: o.value,
        label: o.label,
      }));
    }

    if (field.placeholder) {
      param.validation = { pattern: undefined };
    }

    return param;
  });
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private categoryIndex: Map<ToolCategory, string[]> = new Map();
  private riskIndex: Map<ToolRiskLevel, string[]> = new Map();

  constructor() {
    this.registerAllAgents();
  }

  private registerAllAgents(): void {
    const agentIds = Object.keys(AGENTS) as AgentType[];

    for (const agentId of agentIds) {
      const config = AGENTS[agentId];
      if (!config) continue;

      const definition: ToolDefinition = {
        id: agentId,
        name: config.name,
        description: config.description,
        category: agentCategoryMap[agentId] ?? 'custom',
        riskLevel: agentRiskMap[agentId] ?? 'draft_only',
        agentType: agentId,
        parameters: buildToolParameters(agentId),
        timeoutMs: 30_000,
        maxRetries: 2,
        enabled: true,
        metadata: {
          department: config.department,
          role: config.role,
          icon: config.icon,
          color: config.color,
        },
        engine: agentEngineMap[agentId] ?? 'openai',
      };

      this.register(definition);
    }
  }

  register(def: ToolDefinition): void {
    if (this.tools.has(def.id)) {
      throw new Error(`Tool "${def.id}" is already registered`);
    }

    this.tools.set(def.id, def);

    const catList = this.categoryIndex.get(def.category) ?? [];
    catList.push(def.id);
    this.categoryIndex.set(def.category, catList);

    const riskList = this.riskIndex.get(def.riskLevel) ?? [];
    riskList.push(def.id);
    this.riskIndex.set(def.riskLevel, riskList);
  }

  get(id: string): ToolDefinition | null {
    return this.tools.get(id) ?? null;
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getEnabled(): ToolDefinition[] {
    return this.getAll().filter((t) => t.enabled);
  }

  getByCategory(category: ToolCategory): ToolDefinition[] {
    const ids = this.categoryIndex.get(category) ?? [];
    return ids.map((id) => this.tools.get(id)!).filter(Boolean);
  }

  getByRiskLevel(riskLevel: ToolRiskLevel): ToolDefinition[] {
    const ids = this.riskIndex.get(riskLevel) ?? [];
    return ids.map((id) => this.tools.get(id)!).filter(Boolean);
  }

  getByDepartment(department: string): ToolDefinition[] {
    return this.getAll().filter(
      (t) => t.metadata?.department === department,
    );
  }

  search(query: string): ToolDefinition[] {
    const lower = query.toLowerCase();
    return this.getAll().filter(
      (t) =>
        t.id.toLowerCase().includes(lower) ||
        t.name.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower),
    );
  }

  enable(id: string): boolean {
    const tool = this.tools.get(id);
    if (!tool) return false;
    tool.enabled = true;
    return true;
  }

  disable(id: string): boolean {
    const tool = this.tools.get(id);
    if (!tool) return false;
    tool.enabled = false;
    return true;
  }

  unregister(id: string): boolean {
    const tool = this.tools.get(id);
    if (!tool) return false;

    this.tools.delete(id);

    const catList = this.categoryIndex.get(tool.category);
    if (catList) {
      const idx = catList.indexOf(id);
      if (idx >= 0) catList.splice(idx, 1);
    }

    const riskList = this.riskIndex.get(tool.riskLevel);
    if (riskList) {
      const idx = riskList.indexOf(id);
      if (idx >= 0) riskList.splice(idx, 1);
    }

    return true;
  }

  count(): number {
    return this.tools.size;
  }

  getCategories(): ToolCategory[] {
    return Array.from(this.categoryIndex.keys());
  }

  getCategoryCounts(): Record<ToolCategory, number> {
    const counts: Partial<Record<ToolCategory, number>> = {};
    for (const [cat, ids] of this.categoryIndex) {
      counts[cat] = ids.length;
    }
    return counts as Record<ToolCategory, number>;
  }

  async validateParameters(
    toolId: string,
    params: Record<string, unknown>,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const tool = this.get(toolId);
    if (!tool) {
      return { valid: false, errors: [`Tool "${toolId}" not found`] };
    }

    const errors: string[] = [];

    for (const param of tool.parameters) {
      const value = params[param.name];

      if (param.required && (value === undefined || value === null || value === '')) {
        errors.push(`Missing required parameter: "${param.name}" (${param.label})`);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (param.type === 'select' && param.options) {
        const validValues = param.options.map((o) => o.value);
        if (!validValues.includes(String(value))) {
          errors.push(
            `Invalid value for "${param.name}": "${String(value)}". Must be one of: ${validValues.join(', ')}`,
          );
        }
      }

      if (param.validation?.enum && !param.validation.enum.includes(String(value))) {
        errors.push(
          `Invalid value for "${param.name}": "${String(value)}". Must be one of: ${param.validation.enum.join(', ')}`,
        );
      }

      if (param.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`Invalid number for "${param.name}": "${String(value)}"`);
        } else {
          if (param.validation?.min !== undefined && num < param.validation.min) {
            errors.push(`"${param.name}" must be >= ${param.validation.min}`);
          }
          if (param.validation?.max !== undefined && num > param.validation.max) {
            errors.push(`"${param.name}" must be <= ${param.validation.max}`);
          }
        }
      }

      if (param.validation?.pattern && typeof value === 'string') {
        const regex = new RegExp(param.validation.pattern);
        if (!regex.test(value)) {
          errors.push(`"${param.name}" does not match pattern: ${param.validation.pattern}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export const globalToolRegistry = new ToolRegistry();
