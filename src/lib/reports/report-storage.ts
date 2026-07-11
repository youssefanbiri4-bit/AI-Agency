import 'server-only';

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { JsonObject } from '@/types';
import type { ClientReportTemplate } from '@/lib/reports/report-types';

export const REPORTS_BUCKET = 'workspace-reports';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SHARE_TOKEN_BYTES = 32;

export type SavedReportRecord = Database['public']['Tables']['saved_reports']['Row'];
export type ReportShareLinkRecord = Database['public']['Tables']['report_share_links']['Row'];

export interface SavedReportWithShares extends SavedReportRecord {
  share_links: ReportShareLinkRecord[];
}

export interface SaveReportInput {
  workspaceId: string;
  userId: string;
  title: string;
  template: ClientReportTemplate;
  periodLabel?: string | null;
  filename: string;
  pdfBuffer: Buffer;
  metadata?: JsonObject;
}

export interface CreateShareLinkInput {
  reportId: string;
  workspaceId: string;
  userId: string;
  expiresInDays?: number;
  password?: string;
  maxAccessCount?: number;
}

export interface ShareLinkAccessResult {
  ok: boolean;
  error?: string;
  signedUrl?: string;
  filename?: string;
  title?: string;
  expiresAt?: string;
  requiresPassword?: boolean;
}

function hashSharePassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifySharePassword(password: string, storedHash: string): boolean {
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) {
    return false;
  }

  const computed = scryptSync(password, salt, 32);
  const expected = Buffer.from(expectedHex, 'hex');

  if (computed.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(computed, expected);
}

function generateShareToken(): string {
  return randomBytes(SHARE_TOKEN_BYTES).toString('base64url');
}

function buildStoragePath(workspaceId: string, reportId: string, filename: string) {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `${workspaceId}/${reportId}/${safeFilename}`;
}

export async function uploadSavedReportPdf(
  client: SupabaseClient<Database>,
  input: SaveReportInput
): Promise<{ report: SavedReportRecord | null; error: string | null }> {
  const reportId = crypto.randomUUID();
  const storagePath = buildStoragePath(input.workspaceId, reportId, input.filename);

  const { error: uploadError } = await client.storage
    .from(REPORTS_BUCKET)
    .upload(storagePath, input.pdfBuffer, {
      cacheControl: '3600',
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    return { report: null, error: uploadError.message };
  }

  const { data, error } = await client
    .from('saved_reports')
    .insert({
      id: reportId,
      workspace_id: input.workspaceId,
      created_by: input.userId,
      title: input.title,
      template: input.template,
      period_label: input.periodLabel ?? null,
      filename: input.filename,
      storage_path: storagePath,
      file_size_bytes: input.pdfBuffer.byteLength,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();

  if (error || !data) {
    await client.storage.from(REPORTS_BUCKET).remove([storagePath]).catch(() => {});
    return { report: null, error: error?.message ?? 'Failed to save report metadata.' };
  }

  return { report: data, error: null };
}

export async function listSavedReportsForWorkspace(
  client: SupabaseClient<Database>,
  workspaceId: string
): Promise<{ data: SavedReportWithShares[]; error: string | null }> {
  const { data: reports, error } = await client
    .from('saved_reports')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: error.message };
  }

  const reportRows = reports ?? [];
  if (reportRows.length === 0) {
    return { data: [], error: null };
  }

  const reportIds = reportRows.map((row) => row.id);
  const { data: shareLinks, error: shareError } = await client
    .from('report_share_links')
    .select('*')
    .in('report_id', reportIds)
    .order('created_at', { ascending: false });

  if (shareError) {
    return { data: [], error: shareError.message };
  }

  const linksByReport = new Map<string, ReportShareLinkRecord[]>();
  for (const link of shareLinks ?? []) {
    const existing = linksByReport.get(link.report_id) ?? [];
    existing.push(link);
    linksByReport.set(link.report_id, existing);
  }

  return {
    data: reportRows.map((report) => ({
      ...report,
      share_links: linksByReport.get(report.id) ?? [],
    })),
    error: null,
  };
}

export async function createReportSignedUrl(
  client: SupabaseClient<Database>,
  storagePath: string,
  ttlSeconds = SIGNED_URL_TTL_SECONDS
): Promise<{ signedUrl: string | null; error: string | null }> {
  const { data, error } = await client.storage
    .from(REPORTS_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);

  return {
    signedUrl: data?.signedUrl ?? null,
    error: error?.message ?? null,
  };
}

export async function createReportShareLink(
  client: SupabaseClient<Database>,
  input: CreateShareLinkInput
): Promise<{ link: ReportShareLinkRecord | null; shareUrl: string | null; error: string | null }> {
  const expiresInDays = Math.min(Math.max(input.expiresInDays ?? 7, 1), 90);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const token = generateShareToken();

  const { data, error } = await client
    .from('report_share_links')
    .insert({
      report_id: input.reportId,
      workspace_id: input.workspaceId,
      created_by: input.userId,
      token,
      expires_at: expiresAt,
      password_hash: input.password?.trim() ? hashSharePassword(input.password.trim()) : null,
      max_access_count: input.maxAccessCount ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    return { link: null, shareUrl: null, error: error?.message ?? 'Failed to create share link.' };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
  const shareUrl = baseUrl ? `${baseUrl}/reports/share/${token}` : `/reports/share/${token}`;

  return { link: data, shareUrl, error: null };
}

export async function revokeReportShareLink(
  client: SupabaseClient<Database>,
  linkId: string,
  workspaceId: string
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await client
    .from('report_share_links')
    .update({ is_revoked: true, updated_at: new Date().toISOString() })
    .eq('id', linkId)
    .eq('workspace_id', workspaceId);

  return { ok: !error, error: error?.message ?? null };
}

export async function getShareLinkPublicMeta(
  adminClient: SupabaseClient<Database>,
  token: string
): Promise<{
  link: ReportShareLinkRecord | null;
  report: SavedReportRecord | null;
  error: string | null;
}> {
  const { data: link, error } = await adminClient
    .from('report_share_links')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    return { link: null, report: null, error: error.message };
  }

  if (!link) {
    return { link: null, report: null, error: 'Share link not found.' };
  }

  const { data: report, error: reportError } = await adminClient
    .from('saved_reports')
    .select('*')
    .eq('id', link.report_id)
    .maybeSingle();

  if (reportError) {
    return { link: null, report: null, error: reportError.message };
  }

  if (!report) {
    return { link: null, report: null, error: 'Report not found.' };
  }

  return { link, report, error: null };
}

function isShareLinkExpired(link: ReportShareLinkRecord): boolean {
  return Date.parse(link.expires_at) <= Date.now();
}

function isShareLinkAccessExceeded(link: ReportShareLinkRecord): boolean {
  return typeof link.max_access_count === 'number' && link.access_count >= link.max_access_count;
}

export async function accessSharedReport(
  adminClient: SupabaseClient<Database>,
  token: string,
  password?: string
): Promise<ShareLinkAccessResult> {
  const { link, report, error } = await getShareLinkPublicMeta(adminClient, token);

  if (error || !link || !report) {
    return { ok: false, error: error ?? 'Share link not found.' };
  }

  if (link.is_revoked) {
    return { ok: false, error: 'This share link has been revoked.' };
  }

  if (isShareLinkExpired(link)) {
    return { ok: false, error: 'This share link has expired.' };
  }

  if (isShareLinkAccessExceeded(link)) {
    return { ok: false, error: 'This share link has reached its access limit.' };
  }

  if (link.password_hash) {
    if (!password?.trim()) {
      return {
        ok: false,
        requiresPassword: true,
        title: report.title,
        expiresAt: link.expires_at,
        error: 'Password required.',
      };
    }

    if (!verifySharePassword(password.trim(), link.password_hash)) {
      return { ok: false, error: 'Incorrect password.' };
    }
  }

  const signed = await createReportSignedUrl(adminClient, report.storage_path);
  if (!signed.signedUrl) {
    return { ok: false, error: signed.error ?? 'Failed to create download URL.' };
  }

  await adminClient
    .from('report_share_links')
    .update({
      access_count: link.access_count + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', link.id);

  return {
    ok: true,
    signedUrl: signed.signedUrl,
    filename: report.filename,
    title: report.title,
    expiresAt: link.expires_at,
  };
}