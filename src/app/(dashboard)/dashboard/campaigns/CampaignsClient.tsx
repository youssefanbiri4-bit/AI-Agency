'use client';

import { useActionState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  Clock,
  FileText,
  Send,
  TrendingUp,
} from 'lucide-react';
import {
  createCampaignPlannerTask,
  createManualCampaignTrackerTask,
  createPerformanceAnalyzerTask,
  type CampaignTaskState,
} from './actions';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';

export interface CampaignReportItem {
  taskId: string;
  title: string;
  status: 'completed' | 'needs_review';
  agentName: string;
  updatedAt: string;
  updatedLabel: string;
  summaryPreview: string;
  href: string;
}

export interface PendingCampaignTaskItem {
  taskId: string;
  title: string;
  status: 'pending';
  agentName: string;
  updatedLabel: string;
  href: string;
}

interface CampaignsClientProps {
  campaignReports: CampaignReportItem[];
  pendingCampaignTasks: PendingCampaignTaskItem[];
  preferredAgentName: string;
}

const initialState: CampaignTaskState = {
  error: null,
};

function Field({
  id,
  label,
  required = false,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-[#F55477]"> *</span>}
      </Label>
      {children}
    </div>
  );
}

export function CampaignsClient({
  campaignReports,
  pendingCampaignTasks,
  preferredAgentName,
}: CampaignsClientProps) {
  const [plannerState, plannerAction, isPlannerPending] = useActionState(
    createCampaignPlannerTask,
    initialState
  );
  const [analyzerState, analyzerAction, isAnalyzerPending] = useActionState(
    createPerformanceAnalyzerTask,
    initialState
  );
  const [trackerState, trackerAction, isTrackerPending] = useActionState(
    createManualCampaignTrackerTask,
    initialState
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Campaign Planner"
            description={`Create a pending task for ${preferredAgentName} with a complete campaign brief.`}
            action={<StatusBadge status="Ready" type="system" size="sm" />}
          />

          <form action={plannerAction} className="space-y-5">
            {plannerState?.error && (
              <Notice tone="danger" title="Campaign planner task was not created">
                {plannerState.error}
              </Notice>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <Field id="serviceOrOffer" label="Service or offer" required>
                <Input
                  id="serviceOrOffer"
                  name="serviceOrOffer"
                  placeholder="AI automation audit, landing page build, coaching offer"
                  required
                  disabled={isPlannerPending}
                />
              </Field>

              <Field id="targetAudience" label="Target audience" required>
                <Input
                  id="targetAudience"
                  name="targetAudience"
                  placeholder="B2B founders, local clinics, ecommerce brands"
                  required
                  disabled={isPlannerPending}
                />
              </Field>

              <Field id="campaignGoal" label="Campaign goal" required>
                <div className="relative">
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
                  <Select id="campaignGoal" name="campaignGoal" required disabled={isPlannerPending} defaultValue="">
                    <option value="" disabled>Select goal</option>
                    <option value="Lead generation">Lead generation</option>
                    <option value="Booked calls">Booked calls</option>
                    <option value="Sales">Sales</option>
                    <option value="Brand awareness">Brand awareness</option>
                    <option value="Retargeting">Retargeting</option>
                    <option value="Content growth">Content growth</option>
                  </Select>
                </div>
              </Field>

              <Field id="platforms" label="Platforms" required>
                <Input
                  id="platforms"
                  name="platforms"
                  placeholder="Meta Ads, TikTok, LinkedIn, Google Search"
                  required
                  disabled={isPlannerPending}
                />
              </Field>

              <Field id="budget" label="Budget">
                <Input id="budget" name="budget" placeholder="$1,500/month" disabled={isPlannerPending} />
              </Field>

              <Field id="marketOrCountry" label="Market or country">
                <Input
                  id="marketOrCountry"
                  name="marketOrCountry"
                  placeholder="United States, Morocco, GCC"
                  disabled={isPlannerPending}
                />
              </Field>

              <Field id="tone" label="Tone">
                <Input id="tone" name="tone" placeholder="Premium, direct, friendly" disabled={isPlannerPending} />
              </Field>

              <Field id="duration" label="Duration">
                <Input id="duration" name="duration" placeholder="14 days, 30 days, 6 weeks" disabled={isPlannerPending} />
              </Field>

              <div className="lg:col-span-2">
                <Field id="extraNotes" label="Extra notes">
                  <Textarea
                    id="extraNotes"
                    name="extraNotes"
                    rows={4}
                    placeholder="Constraints, proof points, competitors, offer details, required channels"
                    disabled={isPlannerPending}
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="lg" disabled={isPlannerPending}>
                {isPlannerPending ? (
                  <>
                    <Clock className="h-5 w-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Create Planner Task
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Performance Analyzer"
            description="Turn ad metrics and observed problems into a pending analysis task."
            action={<StatusBadge status="Prepared" type="system" size="sm" />}
          />

          <form action={analyzerAction} className="space-y-5">
            {analyzerState?.error && (
              <Notice tone="danger" title="Performance analyzer task was not created">
                {analyzerState.error}
              </Notice>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <Field id="platform" label="Platform" required>
                <Input id="platform" name="platform" placeholder="Meta Ads, TikTok, LinkedIn" required disabled={isAnalyzerPending} />
              </Field>

              <Field id="analyzerCampaignGoal" label="Campaign goal" required>
                <Input
                  id="analyzerCampaignGoal"
                  name="campaignGoal"
                  placeholder="Lead generation, sales, booked calls"
                  required
                  disabled={isAnalyzerPending}
                />
              </Field>

              <Field id="budgetSpent" label="Budget spent">
                <Input id="budgetSpent" name="budgetSpent" placeholder="$740" disabled={isAnalyzerPending} />
              </Field>

              <Field id="impressions" label="Impressions">
                <Input id="impressions" name="impressions" type="number" min="0" placeholder="25000" disabled={isAnalyzerPending} />
              </Field>

              <Field id="clicks" label="Clicks">
                <Input id="clicks" name="clicks" type="number" min="0" placeholder="480" disabled={isAnalyzerPending} />
              </Field>

              <Field id="ctr" label="CTR">
                <Input id="ctr" name="ctr" placeholder="1.9%" disabled={isAnalyzerPending} />
              </Field>

              <Field id="cpc" label="CPC">
                <Input id="cpc" name="cpc" placeholder="$1.54" disabled={isAnalyzerPending} />
              </Field>

              <Field id="leads" label="Leads">
                <Input id="leads" name="leads" type="number" min="0" placeholder="32" disabled={isAnalyzerPending} />
              </Field>

              <Field id="conversions" label="Conversions">
                <Input id="conversions" name="conversions" type="number" min="0" placeholder="7" disabled={isAnalyzerPending} />
              </Field>

              <Field id="creativeType" label="Creative type">
                <Input id="creativeType" name="creativeType" placeholder="UGC video, carousel, static image" disabled={isAnalyzerPending} />
              </Field>

              <div className="lg:col-span-2">
                <Field id="audience" label="Audience">
                  <Textarea
                    id="audience"
                    name="audience"
                    rows={3}
                    placeholder="Audience targeting, exclusions, lookalikes, interests, geo"
                    disabled={isAnalyzerPending}
                  />
                </Field>
              </div>

              <div className="lg:col-span-2">
                <Field id="problemObserved" label="Problem observed" required>
                  <Textarea
                    id="problemObserved"
                    name="problemObserved"
                    rows={3}
                    placeholder="Low CTR, expensive leads, no conversions, weak creative engagement"
                    required
                    disabled={isAnalyzerPending}
                  />
                </Field>
              </div>

              <div className="lg:col-span-2">
                <Field id="analyzerExtraNotes" label="Extra notes">
                  <Textarea
                    id="analyzerExtraNotes"
                    name="extraNotes"
                    rows={3}
                    placeholder="Landing page notes, offer notes, tests already tried"
                    disabled={isAnalyzerPending}
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="lg" disabled={isAnalyzerPending}>
                {isAnalyzerPending ? (
                  <>
                    <Clock className="h-5 w-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-5 w-5" />
                    Create Analyzer Task
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Manual Campaign Tracker"
          description="Log live ad performance and create a pending campaign analysis task."
          action={<StatusBadge status="Prepared" type="system" size="sm" />}
        />

        <form action={trackerAction} className="space-y-5">
          {trackerState?.error && (
            <Notice tone="danger" title="Tracking analysis task was not created">
              {trackerState.error}
            </Notice>
          )}

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
            <Field id="trackerCampaignName" label="Campaign name" required>
              <Input
                id="trackerCampaignName"
                name="campaignName"
                placeholder="Spring booked calls test"
                required
                disabled={isTrackerPending}
              />
            </Field>

            <Field id="trackerPlatform" label="Platform" required>
              <Input
                id="trackerPlatform"
                name="platform"
                placeholder="Meta Ads, TikTok, Google Search"
                required
                disabled={isTrackerPending}
              />
            </Field>

            <Field id="trackerCampaignGoal" label="Campaign goal" required>
              <Input
                id="trackerCampaignGoal"
                name="campaignGoal"
                placeholder="Lead generation, sales, booked calls"
                required
                disabled={isTrackerPending}
              />
            </Field>

            <Field id="trackerBudgetSpent" label="Budget spent">
              <Input id="trackerBudgetSpent" name="budgetSpent" placeholder="$740" disabled={isTrackerPending} />
            </Field>

            <Field id="trackerImpressions" label="Impressions">
              <Input
                id="trackerImpressions"
                name="impressions"
                type="number"
                min="0"
                placeholder="25000"
                disabled={isTrackerPending}
              />
            </Field>

            <Field id="trackerClicks" label="Clicks">
              <Input
                id="trackerClicks"
                name="clicks"
                type="number"
                min="0"
                placeholder="480"
                disabled={isTrackerPending}
              />
            </Field>

            <Field id="trackerCtr" label="CTR">
              <Input id="trackerCtr" name="ctr" placeholder="1.9%" disabled={isTrackerPending} />
            </Field>

            <Field id="trackerCpc" label="CPC">
              <Input id="trackerCpc" name="cpc" placeholder="$1.54" disabled={isTrackerPending} />
            </Field>

            <Field id="trackerLeads" label="Leads">
              <Input
                id="trackerLeads"
                name="leads"
                type="number"
                min="0"
                placeholder="32"
                disabled={isTrackerPending}
              />
            </Field>

            <Field id="trackerConversions" label="Conversions">
              <Input
                id="trackerConversions"
                name="conversions"
                type="number"
                min="0"
                placeholder="7"
                disabled={isTrackerPending}
              />
            </Field>

            <Field id="trackerCreativeType" label="Creative type">
              <Input
                id="trackerCreativeType"
                name="creativeType"
                placeholder="UGC video, carousel, static image"
                disabled={isTrackerPending}
              />
            </Field>

            <Field id="trackerOffer" label="Offer">
              <Input
                id="trackerOffer"
                name="offer"
                placeholder="Free audit, discount, consultation"
                disabled={isTrackerPending}
              />
            </Field>

            <div className="lg:col-span-2">
              <Field id="trackerAudience" label="Audience">
                <Textarea
                  id="trackerAudience"
                  name="audience"
                  rows={3}
                  placeholder="Targeting, interests, lookalikes, geo, exclusions"
                  disabled={isTrackerPending}
                />
              </Field>
            </div>

            <div className="lg:col-span-2">
              <Field id="trackerLandingPage" label="Landing page">
                <Textarea
                  id="trackerLandingPage"
                  name="landingPage"
                  rows={3}
                  placeholder="Landing page URL, conversion path, page notes"
                  disabled={isTrackerPending}
                />
              </Field>
            </div>

            <div className="lg:col-span-2">
              <Field id="trackerProblemObserved" label="Problem observed" required>
                <Textarea
                  id="trackerProblemObserved"
                  name="problemObserved"
                  rows={3}
                  placeholder="Low CTR, expensive leads, no conversions, weak hook"
                  required
                  disabled={isTrackerPending}
                />
              </Field>
            </div>

            <div className="lg:col-span-2">
              <Field id="trackerNotes" label="Notes">
                <Textarea
                  id="trackerNotes"
                  name="notes"
                  rows={3}
                  placeholder="Tests already tried, context, constraints, hypotheses"
                  disabled={isTrackerPending}
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={isTrackerPending}>
              {isTrackerPending ? (
                <>
                  <Clock className="h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <ClipboardList className="h-5 w-5" />
                  Create Tracking Analysis Task
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Recent Campaign Reports"
          description="Completed and review-ready campaign tasks with generated report output."
          action={
            <Link href="/dashboard/reports" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
              <FileText className="h-4 w-4" />
              All Reports
            </Link>
          }
        />

        {campaignReports.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No generated campaign reports yet"
            description="Create a planner, tracker, or analyzer task, run it from Task Details, then review the generated report."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {campaignReports.map((report) => (
              <article key={report.taskId} className="muted-panel min-w-0 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words font-bold text-black">{report.title}</h3>
                    <p className="mt-1 text-sm text-black/52">
                      {report.agentName} · Updated {report.updatedLabel}
                    </p>
                  </div>
                  <StatusBadge status={report.status} type="task" size="sm" />
                </div>
                <p className="mt-4 text-sm leading-6 text-black/62">{report.summaryPreview}</p>
                <div className="mt-4">
                  <Link href={report.href} className={buttonStyles({ variant: 'soft', size: 'sm' })}>
                    Open Report
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      {pendingCampaignTasks.length > 0 && (
        <Card>
          <CardHeader
            title="Draft/Pending Campaign Tasks"
            description="Campaign briefs and tracking analyses created as normal pending tasks."
          />

          <div className="grid gap-3 md:grid-cols-2">
            {pendingCampaignTasks.map((task) => (
              <div key={task.taskId} className="muted-panel flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-bold text-black">{task.title}</h3>
                  <p className="mt-1 text-xs text-black/52">
                    {task.agentName} · Updated {task.updatedLabel}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={task.status} type="task" size="sm" />
                  <Link href={task.href} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
