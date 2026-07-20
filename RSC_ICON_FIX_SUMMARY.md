# RSC Serialization Crash Fix — Icon Prop Violations

**Date:** 2026-07-20
**Digest:** 3173807121
**Error:** "Functions cannot be passed directly to Client Components... {$$typeof: ..., render: function, displayName: 'CircleCheck'}"

## Root Cause

Components accepted Lucide icons as raw component references (`icon={CheckCircle2}`) instead of rendered JSX elements (`icon={<CheckCircle2 />}`). When these were serialized across the React Server Component boundary, the RSC serializer crashed because functions (component constructors) cannot be serialized.

## Changes Made

### 1. `src/app/(dashboard)/dashboard/reports/analytics-components.tsx`

**MetricTile component (lines 7-31)**

```diff
- import { Layers3 } from 'lucide-react';
+ import type { ReactNode } from 'react';

  icon: typeof Layers3;
+ icon: ReactNode;

- <Icon className="h-5 w-5" />
+ {icon}
```

### 2. `src/app/(dashboard)/dashboard/reports/AdvancedAnalyticsClient.tsx`

**57 MetricTile call sites (lines 221-442)**

All icon props changed from component reference to rendered JSX:

```diff
- icon={Layers3}
+ icon={<Layers3 className="h-5 w-5" />}

- icon={CheckCircle2}
+ icon={<CheckCircle2 className="h-5 w-5" />}

- icon={CalendarClock}
+ icon={<CalendarClock className="h-5 w-5" />}

- icon={AlertTriangle}
+ icon={<AlertTriangle className="h-5 w-5" />}

- icon={Clipboard}
+ icon={<Clipboard className="h-5 w-5" />}

- icon={Gauge}
+ icon={<Gauge className="h-5 w-5" />}

- icon={FolderKanban}
+ icon={<FolderKanban className="h-5 w-5" />}

- icon={ExternalLink}
+ icon={<ExternalLink className="h-5 w-5" />}

- icon={RadioTower}
+ icon={<RadioTower className="h-5 w-5" />}

- icon={ShieldCheck}
+ icon={<ShieldCheck className="h-5 w-5" />}

- icon={Sparkles}
+ icon={<Sparkles className="h-5 w-5" />}

- icon={Library}
+ icon={<Library className="h-5 w-5" />}

- icon={GitPullRequest}
+ icon={<GitPullRequest className="h-5 w-5" />}
```

### 3. `src/components/marketing/MarketingAnalytics.tsx`

**MetricCard component (lines 35-87)**

```diff
- icon: React.ComponentType<{ className?: string }>;
+ icon: React.ReactNode;

- icon: Icon
+ icon

- <Icon className="h-5 w-5 text-primary" />
+ {icon}
```

**4 call sites:**

```diff
- icon={BarChart3}
+ icon={<BarChart3 className="h-5 w-5 text-primary" />}

- icon={Users}
+ icon={<Users className="h-5 w-5 text-primary" />}

- icon={MousePointerClick}
+ icon={<MousePointerClick className="h-5 w-5 text-primary" />}

- icon={Share2}
+ icon={<Share2 className="h-5 w-5 text-primary" />}
```

### 4. `src/components/marketplace/PublisherAnalytics.tsx`

**StatCard component (lines 132-161)**

```diff
- icon: React.ComponentType<{ className?: string }>;
+ icon: React.ReactNode;

- icon: Icon
+ icon

- <Icon className="h-5 w-5" />
+ {icon}
```

**4 StatCard call sites:**

```diff
- icon={Users}
+ icon={<Users className="h-5 w-5" />}

- icon={Download}
+ icon={<Download className="h-5 w-5" />}

- icon={DollarSign}
+ icon={<DollarSign className="h-5 w-5" />}

- icon={Star}
+ icon={<Star className="h-5 w-5" />}
```

**Tip component (lines 165-179)**

```diff
- icon: React.ComponentType<{ className?: string }>;
+ icon: React.ReactNode;

- icon: Icon
+ icon

- <Icon className="h-4 w-4 text-primary" />
+ {icon}
```

**3 Tip call sites:**

```diff
- icon={TrendingUp}
+ icon={<TrendingUp className="h-4 w-4 text-primary" />}

- icon={Star}
+ icon={<Star className="h-4 w-4 text-primary" />}

- icon={BarChart3}
+ icon={<BarChart3 className="h-4 w-4 text-primary" />}
```

### 5. `src/components/growth/GrowthPlaybook.tsx`

**MetricCardProps interface (lines 35-42) + MetricCard function (lines 44-121)**

```diff
- icon: React.ComponentType<{ className?: string }>;
+ icon: React.ReactNode;

- icon: Icon
+ icon

- <Icon className={cn('h-5 w-5', ...)} />
+ {icon}
```

**6 call sites:**

```diff
- icon={Users}
+ icon={<Users className="h-5 w-5 text-primary" />}

- icon={CheckCircle2}
+ icon={<CheckCircle2 className="h-5 w-5 text-primary" />}

- icon={Target}
+ icon={<Target className="h-5 w-5 text-primary" />}

- icon={TrendingUp}
+ icon={<TrendingUp className="h-5 w-5 text-primary" />}

- icon={BarChart3}
+ icon={<BarChart3 className="h-5 w-5 text-primary" />}
```

### 6. `src/components/launch/LaunchMetricsDashboard.tsx`

**MetricCard inline type (lines 37-49) + MetricCard function (lines 37-91)**

```diff
- icon: React.ComponentType<{ className?: string }>;
+ icon: React.ReactNode;

- icon: Icon
+ icon

- <Icon className="h-5 w-5 text-primary" />
+ {icon}
```

**8 call sites:**

```diff
- icon={Users}
+ icon={<Users className="h-5 w-5 text-primary" />}

- icon={Target}
+ icon={<Target className="h-5 w-5 text-primary" />}

- icon={TrendingUp}
+ icon={<TrendingUp className="h-5 w-5 text-primary" />}

- icon={BarChart3}
+ icon={<BarChart3 className="h-5 w-5 text-primary" />}

- icon={Clock}
+ icon={<Clock className="h-5 w-5 text-primary" />}

- icon={Zap}
+ icon={<Zap className="h-5 w-5 text-primary" />}
```

## Verification

- `npm run typecheck` — **PASSES** (0 errors)
- `npm run build` — **PASSES** (compiled successfully, 129 pages generated)
- `rg 'icon={[A-Z]' src/` — **0 remaining violations**
- `EmptyState.tsx` and `StatCard.tsx` — already had `icon: ReactNode`, no changes needed

## Pattern Rule

Every `icon` prop across the codebase must now be:

```tsx
// CORRECT — rendered JSX element
icon={<IconName className="h-5 w-5" />}

// WRONG — raw component reference (RSC crash)
icon={IconName}
```
