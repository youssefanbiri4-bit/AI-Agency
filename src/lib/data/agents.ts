import type { SupabaseClient } from '@supabase/supabase-js';
import { agentCatalog } from '@/data/agents';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import { DEPARTMENTS } from '@/lib/agents';
import type { Agent, AgentType, Department } from '@/types';
import type { AgentRecord, Database, DepartmentRecord } from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

type DepartmentId = DepartmentRecord['id'];
type CatalogSource = 'supabase' | 'fallback';
type AgentCatalogRecord = Pick<
  AgentRecord,
  'id' | 'department_id' | 'name' | 'role' | 'description' | 'capabilities' | 'example_tasks' | 'icon' | 'color'
>;

export interface AgentCatalogData {
  agents: Agent[];
  departments: Department[];
  source: CatalogSource;
}

const departmentIdsByName: Record<Department['name'], DepartmentId> = {
  'Research & Strategy': 'research_strategy',
  'Content & Growth': 'content_growth',
  'Sales & Operations': 'sales_operations',
  'Development & Engineering': 'development_engineering',
};

export function mapDepartmentRecordToDepartment(record: DepartmentRecord): Department {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    color: record.color,
    agentCount: 0,
  };
}

export function mapAgentRecordToAgent(
  record: AgentCatalogRecord,
  departments: DepartmentRecord[]
): Agent {
  const department = departments.find((item) => item.id === record.department_id);

  return {
    id: record.id,
    name: record.name,
    role: record.role,
    department: department?.name ?? 'Research & Strategy',
    description: record.description,
    capabilities: record.capabilities,
    exampleTasks: record.example_tasks,
    status: 'Not Connected',
    icon: record.icon,
    color: record.color,
  };
}

export function getDepartmentIdByName(name: Department['name']): DepartmentId {
  return departmentIdsByName[name];
}

function mapAgentCatalogData(
  departments: DepartmentRecord[],
  agents: AgentCatalogRecord[],
  source: CatalogSource
): AgentCatalogData {
  return {
    agents: agents.map((agent) => mapAgentRecordToAgent(agent, departments)),
    departments: departments.map(mapDepartmentRecordToDepartment),
    source,
  };
}

export async function listDepartments(
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<Department[]>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult([], false);
  }

  const { data, error } = await client
    .from('departments')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    return errorDataResult([], error.message);
  }

  return emptyDataResult((data ?? []).map(mapDepartmentRecordToDepartment), true);
}

export async function listAgents(
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<Agent[]>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult([], false);
  }

  const [{ data: departments, error: departmentError }, { data: agents, error: agentError }] =
    await Promise.all([
      client.from('departments').select('*').order('sort_order', { ascending: true }),
      client
        .from('agents')
        .select('id, department_id, name, role, description, capabilities, example_tasks, icon, color')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ]);

  if (departmentError) {
    return errorDataResult([], departmentError.message);
  }

  if (agentError) {
    return errorDataResult([], agentError.message);
  }

  return emptyDataResult(
    (agents ?? []).map((agent) => mapAgentRecordToAgent(agent, departments ?? [])),
    true
  );
}

export async function listAgentCatalog(
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<AgentCatalogData>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(
      {
        agents: agentCatalog,
        departments: DEPARTMENTS,
        source: 'fallback',
      },
      false
    );
  }

  const [{ data: departments, error: departmentError }, { data: agents, error: agentError }] =
    await Promise.all([
      client.from('departments').select('*').order('sort_order', { ascending: true }),
      client
        .from('agents')
        .select('id, department_id, name, role, description, capabilities, example_tasks, icon, color')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ]);

  if (departmentError) {
    return errorDataResult(
      { agents: [], departments: [], source: 'supabase' },
      departmentError.message
    );
  }

  if (agentError) {
    return errorDataResult(
      { agents: [], departments: departments?.map(mapDepartmentRecordToDepartment) ?? [], source: 'supabase' },
      agentError.message
    );
  }

  return emptyDataResult(
    mapAgentCatalogData(departments ?? [], agents ?? [], 'supabase'),
    true
  );
}

export async function getAgentById(
  agentId: AgentType,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<Agent | null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  const [{ data: departments, error: departmentError }, { data: agent, error: agentError }] =
    await Promise.all([
      client.from('departments').select('*'),
      client.from('agents').select('*').eq('id', agentId).eq('is_active', true).maybeSingle(),
    ]);

  if (departmentError) {
    return errorDataResult(null, departmentError.message);
  }

  if (agentError) {
    return errorDataResult(null, agentError.message);
  }

  return emptyDataResult(agent ? mapAgentRecordToAgent(agent, departments ?? []) : null, true);
}
