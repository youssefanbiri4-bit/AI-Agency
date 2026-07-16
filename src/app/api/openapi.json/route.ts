import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'AgentFlow Public API',
    version: '1.0.0',
    description:
      'REST API for managing agents, prompts, team members, usage, and API keys. ' +
      'Authenticated with workspace-scoped API keys (prefixed `af_pub_`). Pass the key via ' +
      '`Authorization: Bearer af_pub_...` or the `x-api-key` header. API-key management ' +
      'endpoints require an authenticated browser session with the workspace Admin role.',
  },
  servers: [{ url: '/', description: 'This deployment' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Workspace API key (af_pub_...).',
      },
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'sb-access-token',
        description: 'Supabase session cookie (browser admin only).',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
          message: { type: 'string' },
          requestId: { type: 'string' },
          meta: { type: 'object' },
        },
      },
      Agent: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string' },
          description: { type: 'string', nullable: true },
          category: { type: 'string' },
          instructions: { type: 'string' },
          inputs: { type: 'array', items: { type: 'string' } },
          outputs: { type: 'array', items: { type: 'string' } },
          safety_level: { type: 'string' },
          execution_mode: { type: 'string' },
          visibility: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          usage_count: { type: 'integer' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Prompt: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          category: { type: 'string' },
          target_tool: { type: 'string', nullable: true },
          prompt_text: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          usage_count: { type: 'integer' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          keyPrefix: { type: 'string' },
          scopes: { type: 'array', items: { type: 'string' } },
          rateLimit: { type: 'integer' },
          status: { type: 'string' },
          expiresAt: { type: 'string', nullable: true },
          lastUsedAt: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Agents' },
    { name: 'Prompts' },
    { name: 'Team' },
    { name: 'Usage' },
    { name: 'API Keys' },
  ],
  paths: {
    '/api/v1/agents': {
      get: {
        tags: ['Agents'],
        summary: 'List agents',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'List of agents' },
          401: { description: 'Unauthorized', $ref: '#/components/schemas/Error' },
          403: { description: 'Insufficient scope' },
        },
      },
      post: {
        tags: ['Agents'],
        summary: 'Create an agent',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Agent created' }, 400: { description: 'Validation error' } },
      },
    },
    '/api/v1/agents/{id}': {
      get: {
        tags: ['Agents'],
        summary: 'Get an agent by id',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Agent' }, 404: { description: 'Not found' } },
      },
    },
    '/api/v1/prompts': {
      get: {
        tags: ['Prompts'],
        summary: 'List prompts',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'List of prompts' } },
      },
      post: {
        tags: ['Prompts'],
        summary: 'Create a prompt',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Prompt created' } },
      },
    },
    '/api/v1/prompts/{id}': {
      get: {
        tags: ['Prompts'],
        summary: 'Get a prompt by id',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Prompt' }, 404: { description: 'Not found' } },
      },
    },
    '/api/v1/team/members': {
      get: {
        tags: ['Team'],
        summary: 'List workspace team members',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'List of members' } },
      },
    },
    '/api/v1/usage': {
      get: {
        tags: ['Usage'],
        summary: 'Get workspace usage counts',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Usage counts' } },
      },
    },
    '/api/v1/api-keys': {
      get: {
        tags: ['API Keys'],
        summary: 'List API keys (admin session)',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'List of API keys' } },
      },
      post: {
        tags: ['API Keys'],
        summary: 'Create an API key (admin session)',
        security: [{ sessionCookie: [] }],
        responses: { 201: { description: 'API key created; secret returned once' } },
      },
    },
    '/api/v1/api-keys/{id}': {
      delete: {
        tags: ['API Keys'],
        summary: 'Revoke an API key (admin session)',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'API key revoked' } },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(SPEC, {
    headers: { 'cache-control': 'no-store' },
  });
}
