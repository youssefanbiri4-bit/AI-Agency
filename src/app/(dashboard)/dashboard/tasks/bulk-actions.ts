'use server';

import {
  bulkSetTaskStatus as runBulkSetTaskStatus,
  bulkDeleteTasks as runBulkDeleteTasks,
  bulkDuplicateTasks as runBulkDuplicateTasks,
  bulkAssignTasks as runBulkAssignTasks,
  bulkExportTasks as runBulkExportTasks,
} from '@/actions/tasks';
import type { TaskStatus } from '@/types';

export async function bulkSetTaskStatus(taskIds: string[], status: TaskStatus) {
  return runBulkSetTaskStatus(taskIds, status);
}

export async function bulkDeleteTasks(taskIds: string[]) {
  return runBulkDeleteTasks(taskIds);
}

export async function bulkDuplicateTasks(taskIds: string[]) {
  return runBulkDuplicateTasks(taskIds);
}

export async function bulkAssignTasks(taskIds: string[], agentType: string) {
  return runBulkAssignTasks(taskIds, agentType);
}

export async function bulkExportTasks(taskIds: string[], format: 'csv' | 'json') {
  return runBulkExportTasks(taskIds, format);
}
