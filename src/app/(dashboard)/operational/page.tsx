import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { reportAppError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export default async function OperationalDashboardPage() {
  let caughtError: unknown;
  let metrics:
    | {
        taskCounts: {
          pending: number;
          processing: number;
          failed: number;
          completed: number;
          needs_review: number;
        };
        staleTasksCount: number;
        executionMetrics: {
          avgExecutionDuration: string;
          retryCounts: string;
          callbackLatency: string;
          executionSuccessRate: string;
        };
        providerMetrics: {
          n8nFailures: string;
          timeoutRates: string;
          callbackFailures: string;
        };
        workspaceMetrics: {
          activeWorkspaces: number;
          taskVolume: number;
        };
      }
    | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const workspaceResult = await getCurrentUserWorkspace(supabase, undefined);

    if (workspaceResult.error) {
      throw workspaceResult.error;
    }

    if (!workspaceResult.data) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Operational Dashboard</h1>
          <p className="text-red-500">No active workspace found. Please select a workspace.</p>
          <a href="/dashboard" className="text-blue-500 underline">
            Go to Dashboard
          </a>
        </div>
      );
    }

    const { data: workspace, error: workspaceError } = workspaceResult;
    if (workspaceError) throw workspaceError;

    // Fetch task metrics
    const tasksResult = await supabase
      .from('tasks')
      .select('status')
      .eq('workspace_id', workspace.id);

    if (tasksResult.error) throw tasksResult.error;

    const tasks = tasksResult.data || [];

    // Count tasks by status
    const taskCounts = {
      pending: tasks.filter(t => t.status === 'pending').length,
      processing: tasks.filter(t => t.status === 'processing').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      needs_review: tasks.filter(t => t.status === 'needs_review').length,
    };

    // Calculate stale tasks (processing tasks older than threshold)
    const STALE_PROCESSING_THRESHOLD_MS = 12 * 60 * 1000; // 12 minutes
    const staleBefore = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS).toISOString();

    const staleTasksResult = await supabase
      .from('tasks')
      .select('id, updated_at')
      .eq('workspace_id', workspace.id)
      .eq('status', 'processing')
      .lt('updated_at', staleBefore);

    if (staleTasksResult.error) throw staleTasksResult.error;
    const staleTasksCount = staleTasksResult.data?.length || 0;

    // For simplicity, we'll set some mock values for execution metrics.
    // In a real system, we would have an execution_logs table or similar.
    const executionMetrics = {
      avgExecutionDuration: 'N/A', // Placeholder
      retryCounts: 'N/A', // Placeholder
      callbackLatency: 'N/A', // Placeholder
      executionSuccessRate: 'N/A', // Placeholder
    };

    // Provider metrics (mock)
    const providerMetrics = {
      n8nFailures: 'N/A',
      timeoutRates: 'N/A',
      callbackFailures: 'N/A',
    };

    // Workspace metrics
    const workspaceMetrics = {
      activeWorkspaces: 1, // We only have the current workspace in this query
      taskVolume: tasks.length,
    };

    metrics = {
      taskCounts,
      staleTasksCount,
      executionMetrics,
      providerMetrics,
      workspaceMetrics,
    };
  } catch (e) {
    caughtError = e;
  }

  if (caughtError) {
    reportAppError('Operational dashboard page error', caughtError);
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Operational Dashboard</h1>
        <p className="text-red-500">Error loading operational dashboard. Please try again later.</p>
        <a href="/dashboard" className="text-blue-500 underline">
          Go to Dashboard
        </a>
      </div>
    );
  }

  if (!metrics) {
    reportAppError(
      'Operational dashboard page error',
      new Error('Operational dashboard page returned no metrics')
    );
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Operational Dashboard</h1>
        <p className="text-red-500">Error loading operational dashboard. Please try again later.</p>
        <a href="/dashboard" className="text-blue-500 underline">
          Go to Dashboard
        </a>
      </div>
    );
  }

  const { taskCounts, staleTasksCount, executionMetrics, providerMetrics, workspaceMetrics } = metrics;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Operational Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Task Metrics</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Pending:</span>
              <span className="font-medium">{taskCounts.pending}</span>
            </div>
            <div className="flex justify-between">
              <span>Processing:</span>
              <span className="font-medium">{taskCounts.processing}</span>
            </div>
            <div className="flex justify-between">
              <span>Failed:</span>
              <span className="font-medium text-red-500">{taskCounts.failed}</span>
            </div>
            <div className="flex justify-between">
              <span>Completed:</span>
              <span className="font-medium text-green-500">{taskCounts.completed}</span>
            </div>
            <div className="flex justify-between">
              <span>Needs Review:</span>
              <span className="font-medium text-yellow-500">{taskCounts.needs_review}</span>
            </div>
            <div className="flex justify-between">
              <span>Stale Processing:</span>
              <span className="font-medium text-orange-500">{staleTasksCount}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Execution Metrics</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Avg Duration:</span>
              <span className="font-medium">{executionMetrics.avgExecutionDuration}</span>
            </div>
            <div className="flex justify-between">
              <span>Retry Counts:</span>
              <span className="font-medium">{executionMetrics.retryCounts}</span>
            </div>
            <div className="flex justify-between">
              <span>Callback Latency:</span>
              <span className="font-medium">{executionMetrics.callbackLatency}</span>
            </div>
            <div className="flex justify-between">
              <span>Success Rate:</span>
              <span className="font-medium">{executionMetrics.executionSuccessRate}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Provider Metrics</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>n8n Failures:</span>
              <span className="font-medium">{providerMetrics.n8nFailures}</span>
            </div>
            <div className="flex justify-between">
              <span>Timeout Rates:</span>
              <span className="font-medium">{providerMetrics.timeoutRates}</span>
            </div>
            <div className="flex justify-between">
              <span>Callback Failures:</span>
              <span className="font-medium">{providerMetrics.callbackFailures}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Workspace Metrics</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Active Workspaces:</span>
              <span className="font-medium">{workspaceMetrics.activeWorkspaces}</span>
            </div>
            <div className="flex justify-between">
              <span>Task Volume:</span>
              <span className="font-medium">{workspaceMetrics.taskVolume}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Notes</h2>
        <p className="text-sm text-gray-500">
          This is a basic operational dashboard. For production use, consider:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-500 mt-2 space-y-1">
          <li>Adding execution duration tracking via an execution_logs table</li>
          <li>Implementing retry counters in tasks or a separate table</li>
          <li>Tracking callback latency and success rates</li>
          <li>Adding real-time updates via WebSockets or polling</li>
          <li>Including provider-specific metrics from n8n logs</li>
        </ul>
      </div>
    </div>
  );
}
