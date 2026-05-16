import type { AgentTemplate } from './templates';
import type { AgentWorkflowDraft } from './workflow-builder';

export interface WorkflowDiagramNode {
  id: string;
  label: string;
  category: string;
  description: string;
  status: string;
  safety_level: string;
  execution_mode: string;
}

export interface WorkflowDiagramEdge {
  from: string;
  to: string;
  label: string;
}

export interface WorkflowDiagramModel {
  nodes: WorkflowDiagramNode[];
  edges: WorkflowDiagramEdge[];
  mermaid: string;
  markdownDiagram: string;
  plainTextDiagram: string;
}

function mermaidId(index: number) {
  return String.fromCharCode(65 + index);
}

function escapeMermaidLabel(value: string) {
  return value.replace(/"/g, "'");
}

function buildEdges(nodes: WorkflowDiagramNode[]): WorkflowDiagramEdge[] {
  return nodes.slice(0, -1).map((node, index) => ({
    from: node.id,
    to: nodes[index + 1].id,
    label: `Step ${index + 1} to ${index + 2}`,
  }));
}

function buildMermaid(nodes: WorkflowDiagramNode[], edges: WorkflowDiagramEdge[]) {
  if (nodes.length === 0) {
    return 'flowchart TD\n  A["No workflow steps selected"]';
  }

  const nodeLines = nodes.map((node, index) => `  ${mermaidId(index)}["${escapeMermaidLabel(node.label)}"]`);
  const edgeLines = edges.map((edge) => {
    const fromIndex = nodes.findIndex((node) => node.id === edge.from);
    const toIndex = nodes.findIndex((node) => node.id === edge.to);
    return `  ${mermaidId(fromIndex)} --> ${mermaidId(toIndex)}`;
  });

  return ['flowchart TD', ...nodeLines, ...edgeLines].join('\n');
}

function buildPlainText(nodes: WorkflowDiagramNode[]) {
  if (nodes.length === 0) return 'No workflow steps selected';
  return nodes.map((node, index) => `${index + 1}. ${node.label}`).join(' -> ');
}

export function buildWorkflowDiagramFromTemplates(templates: AgentTemplate[]): WorkflowDiagramModel {
  const nodes = templates.map<WorkflowDiagramNode>((template) => ({
    id: template.id,
    label: template.name,
    category: template.category,
    description: template.description,
    status: 'draft',
    safety_level: template.safety_level,
    execution_mode: template.execution_mode,
  }));
  const edges = buildEdges(nodes);
  const mermaid = buildMermaid(nodes, edges);

  return {
    nodes,
    edges,
    mermaid,
    markdownDiagram: ['```mermaid', mermaid, '```'].join('\n'),
    plainTextDiagram: buildPlainText(nodes),
  };
}

export function buildWorkflowDiagramFromDraft(workflow: AgentWorkflowDraft): WorkflowDiagramModel {
  return buildWorkflowDiagramFromTemplates(workflow.steps.map((step) => step.template));
}

export function buildWorkflowDiagramFromLabels(labels: string[], category = 'n8n plan'): WorkflowDiagramModel {
  const nodes = labels.map<WorkflowDiagramNode>((label, index) => ({
    id: `node-${index + 1}`,
    label,
    category,
    description: label,
    status: 'reference_only',
    safety_level: 'safe',
    execution_mode: 'manual',
  }));
  const edges = buildEdges(nodes);
  const mermaid = buildMermaid(nodes, edges);

  return {
    nodes,
    edges,
    mermaid,
    markdownDiagram: ['```mermaid', mermaid, '```'].join('\n'),
    plainTextDiagram: buildPlainText(nodes),
  };
}
