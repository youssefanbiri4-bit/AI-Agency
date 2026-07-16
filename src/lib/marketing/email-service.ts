/**
 * Marketing Email Service
 *
 * Sends transactional marketing emails via Resend.
 * Separate from the alerting system in src/lib/alerts/email.ts
 * because these are user-facing marketing emails, not operational alerts.
 */

import { logger } from '@/lib/logger';
import { safeFetch } from '@/lib/network/safeFetch';
import { trackMarketingEvent } from '@/lib/marketing/experiments';

const emailLog = logger.child('marketing:email');

const RESEND_API_URL = 'https://api.resend.com/emails';

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

interface WelcomeEmailData {
  fullName: string;
  dashboardUrl: string;
}

interface OnboardingEmailData {
  fullName: string;
  step: number;
  totalSteps: number;
  stepTitle: string;
  actionUrl: string;
}

/**
 * Base email HTML wrapper with consistent branding
 */
function buildEmailWrapper(content: string, previewText?: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${previewText ? `<meta name="description" content="${previewText}">` : ''}
</head>
<body style="margin: 0; padding: 0; background-color: #f1f7f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f7f7;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding: 40px 32px 32px;">
              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="font-size: 24px; font-weight: 900; color: #5D6B6B;">AgentFlow</span>
                <span style="font-size: 24px; font-weight: 300; color: #F7CBCA;">AI</span>
              </div>
              ${content}
              <!-- Footer -->
              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #f0f0f0; text-align: center;">
                <p style="font-size: 12px; color: #999; line-height: 1.5;">
                  AgentFlow AI — AI Agency Operations Platform<br>
                  This is an automated message from your workspace.
                </p>
              </div>
            </td>
          </tr>
        </table>
        <p style="font-size: 11px; color: #aaa; margin-top: 16px;">
          If you did not sign up for AgentFlow AI, please ignore this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build welcome email HTML
 */
function buildWelcomeEmail(data: WelcomeEmailData): string {
  const content = `
    <div style="text-align: center;">
      <h1 style="font-size: 24px; font-weight: 900; color: #1a1a1a; margin: 0 0 8px;">
        Welcome to AgentFlow AI, ${data.fullName}! 👋
      </h1>
      <p style="font-size: 16px; color: #666; line-height: 1.6; margin: 0 0 24px;">
        Your AI agency operations workspace is ready. Here's how to get started:
      </p>
    </div>

    <div style="margin: 24px 0;">
      <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; padding: 12px 16px; background: #f8f9fa; border-radius: 8px;">
        <div style="width: 28px; height: 28px; background: #D5E5E5; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #F7CBCA; font-weight: 900; font-size: 14px;">1</div>
        <div>
          <p style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin: 0;">Set up your workspace</p>
          <p style="font-size: 13px; color: #666; margin: 2px 0 0;">Choose your workspace name and configure your team.</p>
        </div>
      </div>

      <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; padding: 12px 16px; background: #f8f9fa; border-radius: 8px;">
        <div style="width: 28px; height: 28px; background: #D5E5E5; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #F7CBCA; font-weight: 900; font-size: 14px;">2</div>
        <div>
          <p style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin: 0;">Create your first task</p>
          <p style="font-size: 13px; color: #666; margin: 2px 0 0;">Assign an AI agent to your first project or campaign.</p>
        </div>
      </div>

      <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; background: #f8f9fa; border-radius: 8px;">
        <div style="width: 28px; height: 28px; background: #D5E5E5; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #F7CBCA; font-weight: 900; font-size: 14px;">3</div>
        <div>
          <p style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin: 0;">Connect your providers</p>
          <p style="font-size: 13px; color: #666; margin: 2px 0 0;">Link OpenAI, Meta, Google Ads, and more.</p>
        </div>
      </div>
    </div>

    <div style="text-align: center; margin: 32px 0 16px;">
      <a href="${data.dashboardUrl}"
         style="display: inline-block; padding: 14px 32px; background: #F7CBCA; color: #fff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 700;">
        Go to Dashboard
      </a>
    </div>
  `;

  return buildEmailWrapper(content, `${data.fullName}, your AgentFlow AI workspace is ready!`);
}

/**
 * Build onboarding sequence email
 */
function buildOnboardingEmail(data: OnboardingEmailData): string {
  const steps = [
    { title: 'Set Up Your Workspace', description: 'Configure your workspace name, brand kit, and team settings.' },
    { title: 'Create Your First Task', description: 'Assign AI agents to your first project or campaign.' },
    { title: 'Explore the Agent Catalog', description: 'Browse 27 specialized AI agents for your workflows.' },
    { title: 'Connect Your Providers', description: 'Link OpenAI, social media, and ad platforms.' },
  ];

  const stepListHtml = steps
    .map(
      (s, i) => `
    <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; padding: 8px 12px; background: ${i + 1 <= data.step ? '#f0fdf4' : '#f8f9fa'}; border-radius: 6px; ${i + 1 <= data.step ? 'border: 1px solid #bbf7d0;' : ''}">
      <span style="width: 22px; height: 22px; border-radius: 50%; background: ${i + 1 <= data.step ? '#22c55e' : '#e5e7eb'}; color: ${i + 1 <= data.step ? '#fff' : '#999'}; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0;">
        ${i + 1 <= data.step ? '✓' : i + 1}
      </span>
      <div>
        <p style="font-size: 13px; font-weight: 600; color: #1a1a1a; margin: 0;">${s.title}</p>
        <p style="font-size: 12px; color: #666; margin: 1px 0 0;">${s.description}</p>
      </div>
    </div>`
    )
    .join('');

  const content = `
    <div style="text-align: center;">
      <h1 style="font-size: 22px; font-weight: 900; color: #1a1a1a; margin: 0 0 8px;">
        ${data.step <= 1 ? `Hi ${data.fullName}, let's get started! 🚀` : `Great progress, ${data.fullName}!`}
      </h1>
      <p style="font-size: 15px; color: #666; line-height: 1.6; margin: 0 0 20px;">
        Step ${data.step} of ${data.totalSteps}: <strong>${data.stepTitle}</strong>
      </p>
    </div>

    <div style="margin-bottom: 24px;">
      <div style="height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden; margin-bottom: 16px;">
        <div style="height: 100%; width: ${(data.step / data.totalSteps) * 100}%; background: #F7CBCA; border-radius: 3px; transition: width 0.5s;" />
      </div>

      ${stepListHtml}
    </div>

    <div style="text-align: center; margin: 32px 0 16px;">
      <a href="${data.actionUrl}"
         style="display: inline-block; padding: 14px 32px; background: #F7CBCA; color: #fff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 700;">
        ${data.step <= 1 ? 'Go to Dashboard' : 'Continue Setup'}
      </a>
    </div>

    <div style="text-align: center;">
      <p style="font-size: 13px; color: #999;">
        Complete all ${data.totalSteps} steps to unlock your workspace's full potential.
      </p>
    </div>
  `;

  return buildEmailWrapper(content);
}

/**
 * Send an email via Resend
 */
async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    emailLog.warn('RESEND_API_KEY is not set; cannot send marketing emails');
    return false;
  }

  const defaultFrom = process.env.EMAIL_ALERTS_FROM || 'AgentFlow AI <onboarding@agentflow-ai.com>';
  const to = Array.isArray(options.to) ? options.to : [options.to];

  if (to.length === 0) {
    emailLog.warn('No recipients for marketing email');
    return false;
  }

  const result = await safeFetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: options.from || defaultFrom,
      to,
      subject: options.subject,
      html: options.html,
      reply_to: options.replyTo,
    }),
    retryOptions: { maxRetries: 1, baseDelayMs: 500 },
  });

  if (result.error) {
    emailLog.error('Failed to send marketing email', {
      error: result.error.message,
      statusCode: result.statusCode,
      subject: options.subject,
    });
    return false;
  }

  emailLog.info('Marketing email sent', {
    subject: options.subject,
    to: to.length,
  });
  return true;
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(
  email: string,
  data: WelcomeEmailData
): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: 'Welcome to AgentFlow AI! 🚀',
    html: buildWelcomeEmail(data),
  });
}

/**
 * Send onboarding sequence email
 */
export async function sendOnboardingEmail(
  email: string,
  data: OnboardingEmailData
): Promise<boolean> {
  const subject = `Step ${data.step}/${data.totalSteps}: ${data.stepTitle}`;

  return sendEmail({
    to: email,
    subject,
    html: buildOnboardingEmail(data),
  });
}

/**
 * Schedule a delayed onboarding email.
 * In production, this would use a job queue (BullMQ) or n8n.
 * For now, we log the intent so the scheduling system can pick it up.
 */
export function scheduleOnboardingEmail(
  email: string,
  data: { nextStep: number; fullName: string; actionUrl: string }
): void {
  emailLog.info('Onboarding email scheduled', {
    email,
    nextStep: data.nextStep,
  });
}

// ─── Email Campaign System (W16-T2) ──────────────────────────────────────────

export type CampaignType = 'newsletter' | 'promotion' | 'referral_invite' | 'product_update';

export interface CampaignEmailData {
  fullName: string;
  subject: string;
  /** Pre-header / preview text */
  previewText?: string;
  /** Primary headline shown in the email body */
  headline: string;
  /** Body paragraphs (rendered in order) */
  body: string[];
  /** Primary CTA */
  ctaLabel: string;
  ctaUrl: string;
  /** Optional secondary line for unsubscribe / footer context */
  campaignId?: string;
  /** Referral-specific: the shareable link */
  referralLink?: string;
  /** Promo-specific: a discount code to surface */
  promoCode?: string;
}

/**
 * Build a generic, on-brand campaign email.
 */
function buildCampaignEmail(data: CampaignEmailData): string {
  const paragraphs = data.body
    .map((p) => `<p style="font-size: 15px; color: #444; line-height: 1.7; margin: 0 0 16px;">${p}</p>`)
    .join('');

  const referralBlock = data.referralLink
    ? `<div style="margin: 20px 0; padding: 16px; background: #f8f9fa; border-radius: 8px; text-align: center;">
         <p style="font-size: 13px; color: #666; margin: 0 0 8px;">Your referral link</p>
         <code style="font-size: 13px; color: #1a1a1a; word-break: break-all;">${data.referralLink}</code>
       </div>`
    : '';

  const promoBlock = data.promoCode
    ? `<div style="margin: 20px 0; padding: 16px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; text-align: center;">
         <p style="font-size: 13px; color: #9a3412; margin: 0 0 4px;">Use code at checkout</p>
         <p style="font-size: 20px; font-weight: 900; color: #c2410c; margin: 0; letter-spacing: 1px;">${data.promoCode}</p>
       </div>`
    : '';

  const content = `
    <div style="text-align: center;">
      <h1 style="font-size: 24px; font-weight: 900; color: #1a1a1a; margin: 0 0 8px;">
        ${data.headline}
      </h1>
      <p style="font-size: 15px; color: #666; margin: 0 0 24px;">Hi ${data.fullName},</p>
    </div>
    ${paragraphs}
    ${referralBlock}
    ${promoBlock}
    <div style="text-align: center; margin: 32px 0 16px;">
      <a href="${data.ctaUrl}"
         style="display: inline-block; padding: 14px 32px; background: #F7CBCA; color: #fff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 700;">
        ${data.ctaLabel}
      </a>
    </div>
  `;

  return buildEmailWrapper(
    content,
    data.previewText || `${data.fullName}, ${data.headline}`
  );
}

/**
 * Send a campaign email to one or more recipients.
 * Records a marketing_events row (best-effort) for campaign analytics.
 */
export async function sendCampaignEmail(
  to: string | string[],
  data: CampaignEmailData,
  options?: { from?: string; replyTo?: string }
): Promise<boolean> {
  const sent = await sendEmail({
    to,
    subject: data.subject,
    html: buildCampaignEmail(data),
    from: options?.from,
    replyTo: options?.replyTo,
  });

  if (sent && data.campaignId) {
    await trackMarketingEvent('campaign_sent', {
      campaignId: data.campaignId,
      type: 'email',
      recipients: Array.isArray(to) ? to.length : 1,
    });
  }

  return sent;
}

/**
 * Convenience: send a referral invite email containing the shareable link.
 */
export async function sendReferralInviteEmail(
  email: string,
  data: { fullName: string; inviterName: string; referralLink: string; signupUrl: string }
): Promise<boolean> {
  return sendCampaignEmail(email, {
    fullName: data.fullName,
    subject: `${data.inviterName} invited you to AgentFlow AI`,
    previewText: 'Run your AI agency from one workspace',
    headline: `You're invited to AgentFlow AI`,
    body: [
      `${data.inviterName} thinks you'd love running your AI agency from one disciplined workspace.`,
      'AgentFlow AI gives you configured agents, structured task intake, and client-ready reporting — all in one place.',
    ],
    ctaLabel: 'Accept the invite',
    ctaUrl: data.signupUrl,
    referralLink: data.referralLink,
  });
}
