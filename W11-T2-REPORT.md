# W11-T2 — White Label, Custom Domains + SSO Foundation

**Status:** ✅ Complete  
**Date:** 2026-07-15

## Summary

Implemented White Label customization (company name, logo, colors, favicon), Custom Domains management with CNAME verification, SSO Foundation for Google Workspace / Microsoft Entra / Okta, and a unified Workspace Branding Settings UI. All settings are stored in `integration_settings.settings` JSON following existing patterns.

---

## Changes

### New Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/types/white-label.ts` | 139 | Types: `WhiteLabelConfig`, `CustomDomain`, `SSOProviderConfig`, `WorkspaceBrandingSettings`, color defaults, provider info |
| `src/lib/data/workspace-branding.ts` | 435 | Data access: CRUD for white-label config, custom domains, SSO providers in `integration_settings.settings.workspace_branding` |
| `src/lib/data/white-label.ts` | 121 | Server-side loader: `getWhiteLabelForWorkspace()` with service-role client + 30s in-memory cache for layout-level reads |
| `src/app/(dashboard)/dashboard/settings/actions/white-label.ts` | 373 | Server actions: `saveWhiteLabelAction`, `addCustomDomainAction`, `removeCustomDomainAction`, `saveSSOProviderAction`, `removeSSOProviderAction` |
| `src/app/(dashboard)/dashboard/settings/WhiteLabelSettings.tsx` | 262 | UI: Toggle enable, company name, tagline, 7 color pickers, logo/favicon URLs, custom CSS, live preview |
| `src/app/(dashboard)/dashboard/settings/CustomDomainsSettings.tsx` | 145 | UI: Add/remove domains, DNS instructions (CNAME → cname.agentflow.ai), domain status display |
| `src/app/(dashboard)/dashboard/settings/SSOSettings.tsx` | 286 | UI: Provider cards for Google/Microsoft/Okta, Client ID/Tenant ID/Issuer URL fields, allowed domains, enable toggle |

### Modified Files

| File | Change |
|------|--------|
| `src/components/brand/BrandMark.tsx` | Added `whiteLabel` prop — overrides company name, logo, tagline, alt text when white-label is enabled |
| `src/app/(dashboard)/dashboard/settings/SettingsNavRail.tsx` | Added 3 nav items: White Label (Wand2), Custom Domains (Globe), SSO (Key) |
| `src/app/(dashboard)/dashboard/settings/actions/index.ts` | Re-exports all new white-label server actions and `WorkspaceBrandingSettingsState` type |
| `src/app/(dashboard)/dashboard/settings/page.tsx` | Added state loading for `getWhiteLabelAction()`, 3 new section renderings (white-label, custom-domains, sso) |

---

## Features Implemented

### 1. White Label Configuration
- **Enable/Disable toggle**: Master switch for white-label mode
- **Company Name**: Replaces "AgentFlow AI" across the platform
- **Tagline**: Custom tagline below company name
- **Custom Logo URL**: Logo image URL for login, sidebar, and header
- **Logo Alt Text**: Accessibility text for custom logo
- **Favicon URL**: Custom favicon for browser tabs
- **7 Brand Colors**: Primary, Secondary, Accent, Background, Text, Sidebar, Header — each with color picker + hex input
- **Hide AgentFlow Branding**: Option to remove all AgentFlow AI references
- **Custom CSS**: Advanced CSS overrides for pixel-perfect branding
- **Live Preview**: Real-time preview of color and branding changes

### 2. Custom Domains (CNAME)
- **Add Domain**: Enter a fully qualified domain name (e.g., `app.yourcompany.com`)
- **Domain Validation**: Regex validation for proper domain format
- **DNS Instructions**: Clear CNAME record instructions (Host: `@`, Value: `cname.agentflow.ai`)
- **Status Tracking**: pending → verifying → verified/failed lifecycle
- **Remove Domain**: One-click domain removal
- **Domain List**: Visual display of all configured domains with status indicators

### 3. SSO Foundation
- **Google Workspace**: Client ID, allowed email domains, enable/disable
- **Microsoft Entra ID**: Tenant ID, Client ID, allowed domains
- **Okta**: Issuer URL, domain, Client ID, allowed domains
- **Per-Provider Toggle**: Enable/disable each provider independently
- **Allowed Email Domains**: Restrict SSO to specific email domains
- **Callback URL**: Configurable OAuth callback endpoint
- **Environment Variables Guide**: Documents required env vars for each provider

### 4. BrandMark White-Label Support
- **Dynamic Company Name**: Overrides "AgentFlow AI" when `whiteLabel.companyName` is set
- **Dynamic Logo**: Uses `whiteLabel.logoUrl` when available
- **Dynamic Tagline**: Uses `whiteLabel.tagline` when available
- **Backward Compatible**: All existing `customLogoUrl`/`customLogoAlt` props still work

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Settings UI Layer                      │
│  WhiteLabelSettings.tsx | CustomDomainsSettings.tsx      │
│  SSOSettings.tsx | SettingsNavRail.tsx (3 new nav items) │
├──────────────────────────────────────────────────────────┤
│                  Server Actions Layer                     │
│  actions/white-label.ts                                  │
│  - saveWhiteLabelAction()                                │
│  - addCustomDomainAction() / removeCustomDomainAction()  │
│  - saveSSOProviderAction() / removeSSOProviderAction()   │
├──────────────────────────────────────────────────────────┤
│                   Data Access Layer                       │
│  lib/data/workspace-branding.ts                          │
│  - getWorkspaceBrandingSettings()                        │
│  - saveWhiteLabelConfig()                                │
│  - addCustomDomain() / removeCustomDomain()              │
│  - saveSSOProvider() / removeSSOProvider()               │
├──────────────────────────────────────────────────────────┤
│              Storage: integration_settings                │
│  settings.workspace_branding = {                         │
│    whiteLabel: { enabled, companyName, colors, ... },    │
│    customDomains: [{ domain, status, cnameTarget }],     │
│    ssoProviders: [{ type, clientId, domains, ... }]      │
│  }                                                       │
├──────────────────────────────────────────────────────────┤
│              Server-Side Loader                           │
│  lib/data/white-label.ts                                 │
│  - getWhiteLabelForWorkspace() [cached 30s]              │
│  - For BrandMark / layout rendering                      │
└──────────────────────────────────────────────────────────┘
```

---

## Verification

1. **Settings Navigation**: `/dashboard/settings` → 3 new nav items visible (White Label, Custom Domains, SSO)
2. **White Label**: Toggle enable → set company name + colors → preview updates in real-time → save persists to DB
3. **Custom Domains**: Add domain → DNS instructions shown → domain appears in list with "Pending" status → remove works
4. **SSO**: Expand provider card → enter Client ID/Tenant ID → toggle enable → save persists to DB
5. **BrandMark**: When white-label is enabled with custom company name + logo, BrandMark renders the custom branding
6. **Audit Logging**: All settings changes logged to `security_audit_logs` with event type `sensitive_settings_updated`
7. **RBAC**: All settings actions require `admin` role (owner/admin), enforced via `hasPermission(role, 'admin')`

---

## Storage Schema

All data is stored in `integration_settings.settings` JSON column under the key `workspace_branding`:

```json
{
  "workspace_branding": {
    "whiteLabel": {
      "enabled": true,
      "companyName": "Acme Agency",
      "tagline": "Your AI Partner",
      "logoUrl": "https://cdn.acme.com/logo.png",
      "faviconUrl": "https://cdn.acme.com/favicon.ico",
      "colors": {
        "primary": "#1E40AF",
        "secondary": "#3B82F6",
        "accent": "#60A5FA",
        "background": "#FFFFFF",
        "text": "#111827",
        "sidebar": "#F3F4F6",
        "header": "#FFFFFF"
      },
      "hideAgentFlowBranding": true,
      "customCss": null
    },
    "customDomains": [
      {
        "id": "dom_1234567890_abc123",
        "domain": "app.acme.com",
        "status": "verified",
        "cnameTarget": "cname.agentflow.ai",
        "dnsRecords": [{ "type": "CNAME", "host": "app.acme.com", "value": "cname.agentflow.ai", "required": true }]
      }
    ],
    "ssoProviders": [
      {
        "type": "google_workspace",
        "enabled": true,
        "clientId": "123456789.apps.googleusercontent.com",
        "domains": ["acme.com"],
        "allowSignUp": true
      }
    ]
  }
}
```
