import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { IntegrationSyncService } from '../integrations/integration-sync.service';

export type CatalogApp = {
  id: string;
  name: string;
  category: string;
  pillar: string;
  description: string;
  scopes: string[];
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';
  /** available = production-proven, beta = works end to end but not yet proven with real customers/hardware, planned = nothing behind it yet. */
  maturity: 'available' | 'beta' | 'planned';
  /** push = the external system calls us, export = we produce a file, undefined = nothing built. */
  mode?: 'push' | 'export';
  requiredFeature?: string;
};

const CATALOG: CatalogApp[] = [
  // Global Payroll & PEO
  { id: 'deel', name: 'Deel', category: 'payroll', pillar: 'Global Payroll & PEO', description: 'Push localized payroll additions, banking details, and tax forms to 150+ countries', scopes: ['employees:read', 'payroll:write', 'banking:write'], syncDirection: 'bidirectional', maturity: 'planned' },
  { id: 'remote', name: 'Remote', category: 'payroll', pillar: 'Global Payroll & PEO', description: 'Global EOR sync for contracts and country-specific compliance', scopes: ['employees:read', 'payroll:write'], syncDirection: 'bidirectional', maturity: 'planned' },
  { id: 'papaya-global', name: 'Papaya Global', category: 'payroll', pillar: 'Global Payroll & PEO', description: 'Workforce payments and cross-border payroll data packets', scopes: ['employees:read', 'payroll:write'], syncDirection: 'outbound', maturity: 'planned' },
  // Identity & Productivity
  { id: 'okta', name: 'Okta', category: 'identity', pillar: 'Identity Management', description: 'Provision accounts and app licenses when employees switch to Active', scopes: ['employees:read', 'lifecycle:subscribe'], syncDirection: 'outbound', maturity: 'planned' },
  { id: 'azure-ad', name: 'Microsoft Entra ID', category: 'identity', pillar: 'Identity Management', description: 'SCIM user provisioning and SSO group mapping', scopes: ['employees:read', 'lifecycle:subscribe'], syncDirection: 'outbound', maturity: 'planned' },
  { id: 'slack', name: 'Slack', category: 'productivity', pillar: 'Productivity', description: 'PTO lookup shortcuts and approval notifications in channels', scopes: ['leave:read', 'notifications:write'], syncDirection: 'outbound', maturity: 'planned' },
  { id: 'google-workspace', name: 'Google Workspace', category: 'productivity', pillar: 'Productivity', description: 'SSO, shared leave calendar sync', scopes: ['calendar:write'], syncDirection: 'outbound', maturity: 'planned' },
  { id: 'zoom', name: 'Zoom', category: 'productivity', pillar: 'Productivity', description: 'Interview scheduling links inside the ATS', scopes: ['recruitment:read'], syncDirection: 'outbound', maturity: 'planned' },
  // Learning
  { id: 'talentlms', name: 'TalentLMS', category: 'learning', pillar: 'Learning Management', description: 'Sync course certificates and training logs back to employee records', scopes: ['employees:read', 'training:write'], syncDirection: 'inbound', maturity: 'planned' },
  { id: 'absorb', name: 'Absorb LMS', category: 'learning', pillar: 'Learning Management', description: 'Course completion audit history on employee profiles', scopes: ['training:write'], syncDirection: 'inbound', maturity: 'planned' },
  // Screening
  { id: 'checkr', name: 'Checkr', category: 'screening', pillar: 'Background Screening', description: 'Order background checks from the ATS candidate card with live status', scopes: ['recruitment:read', 'screening:write'], syncDirection: 'bidirectional', maturity: 'planned' },
  { id: 'verified-first', name: 'Verified First', category: 'screening', pillar: 'Background Screening', description: 'Embedded verification orders and adjudication results', scopes: ['recruitment:read'], syncDirection: 'bidirectional', maturity: 'planned' },
  // Benefits & Finance
  { id: 'human-interest', name: 'Human Interest', category: 'benefits', pillar: 'Financial Planning & Benefits', description: '401(k) allocations synced with monthly payroll deductions', scopes: ['payroll:read', 'benefits:write'], syncDirection: 'bidirectional', maturity: 'planned' },
  { id: 'ease', name: 'Ease', category: 'benefits', pillar: 'Financial Planning & Benefits', description: 'Medical deductions and eligibility changes into payroll calc', scopes: ['payroll:read', 'benefits:write'], syncDirection: 'inbound', maturity: 'planned' },
  { id: 'quickbooks', name: 'QuickBooks', category: 'accounting', pillar: 'Accounting', description: 'Download a balanced payroll journal CSV for QuickBooks Online journal import. File export — not a live API connection.', scopes: ['payroll:read'], syncDirection: 'outbound', maturity: 'beta', mode: 'export', requiredFeature: 'accounting.export' },
  { id: 'tally', name: 'Tally', category: 'accounting', pillar: 'Accounting', description: 'Payroll journal export for Tally ERP', scopes: ['payroll:read'], syncDirection: 'outbound', maturity: 'planned' },
  // Job boards
  { id: 'indeed', name: 'Indeed', category: 'recruitment', pillar: 'Job Syndication', description: 'Syndicate open roles to Indeed via XML feed', scopes: ['jobs:read'], syncDirection: 'outbound', maturity: 'planned' },
  { id: 'ziprecruiter', name: 'ZipRecruiter', category: 'recruitment', pillar: 'Job Syndication', description: 'Push job postings to ZipRecruiter aggregator', scopes: ['jobs:read'], syncDirection: 'outbound', maturity: 'planned' },
  { id: 'rozee', name: 'Rozee.pk', category: 'recruitment', pillar: 'Job Syndication', description: 'Pakistan job board posting sync', scopes: ['jobs:read'], syncDirection: 'outbound', maturity: 'planned' },
  // Local & hardware
  { id: 'nadra-verisys', name: 'NADRA Verisys', category: 'local', pillar: 'Local Compliance', description: 'CNIC verification for Pakistani employees', scopes: ['employees:read'], syncDirection: 'outbound', maturity: 'planned' },
  { id: 'zkteco', name: 'ZKTeco Biometric', category: 'hardware', pillar: 'Time Hardware', description: 'Terminals push punches to MatrixHR over the ZKTeco ADMS protocol; punches become attendance records with a visible sync log.', scopes: ['attendance:write'], syncDirection: 'inbound', maturity: 'beta', mode: 'push', requiredFeature: 'attendance.biometric' },
  { id: 'careem', name: 'Careem Business', category: 'lifestyle', pillar: 'Lifestyle', description: 'Corporate rides for employees', scopes: [], syncDirection: 'outbound', maturity: 'planned' },
];

@Injectable()
export class MarketplaceService {
  constructor(
    private prisma: PrismaService,
    private entitlements: EntitlementsService,
    private syncLogs: IntegrationSyncService,
  ) {}

  async getIntegrations(tenantId: string, category?: string) {
    const [installed, latest] = await Promise.all([
      this.prisma.tenantIntegration.findMany({ where: { tenantId } }),
      this.syncLogs.latestByProvider(tenantId),
    ]);
    const installedMap = new Map(installed.map((i) => [i.provider, i]));

    return Promise.all(
      CATALOG.filter((a) => !category || a.category === category).map(async (app) => {
        const record = installedMap.get(app.id);
        const run = latest.get(app.id);
        const included = app.requiredFeature ? await this.entitlements.hasFeature(tenantId, app.requiredFeature) : true;
        return {
          ...app,
          // Kept so older clients that only know available/coming_soon still render sensibly.
          status: app.maturity === 'planned' ? 'coming_soon' : 'available',
          includedInPlan: included,
          connected: record?.status === 'connected',
          installedAt: record?.installedAt ?? null,
          lastRun: run
            ? {
                status: run.status,
                direction: run.direction,
                at: run.startedAt,
                processed: run.recordsProcessed,
                failed: run.recordsFailed,
                message: run.message,
              }
            : null,
        };
      }),
    );
  }

  getCategories() {
    return [...new Set(CATALOG.map((i) => i.category))];
  }

  async connect(tenantId: string, appId: string) {
    const app = CATALOG.find((a) => a.id === appId);
    if (!app) throw new NotFoundException('App not found in marketplace');
    if (app.maturity === 'planned') {
      throw new BadRequestException(`${app.name} is planned but not built yet — it cannot be connected`);
    }
    if (app.requiredFeature && !(await this.entitlements.hasFeature(tenantId, app.requiredFeature))) {
      throw new ForbiddenException(`${app.name} is not included in your current plan`);
    }

    return this.prisma.tenantIntegration.upsert({
      where: { tenantId_provider: { tenantId, provider: appId } },
      create: {
        tenantId,
        provider: appId,
        status: 'connected',
        installedAt: new Date(),
        config: { scopes: app.scopes, syncDirection: app.syncDirection, mode: app.mode },
      },
      update: { status: 'connected', installedAt: new Date() },
      select: { id: true, provider: true, status: true, installedAt: true },
    });
  }

  async disconnect(tenantId: string, appId: string) {
    const existing = await this.prisma.tenantIntegration.findUnique({
      where: { tenantId_provider: { tenantId, provider: appId } },
    });
    if (!existing) throw new NotFoundException('App is not connected');
    return this.prisma.tenantIntegration.update({
      where: { id: existing.id },
      data: { status: 'disconnected' },
      select: { id: true, provider: true, status: true },
    });
  }

  async logs(tenantId: string, appId: string) {
    if (!CATALOG.some((a) => a.id === appId)) throw new NotFoundException('App not found in marketplace');
    return this.syncLogs.list(tenantId, appId);
  }

  /** Providers call this before doing work so a disconnected integration can't be used. */
  async assertConnected(tenantId: string, appId: string) {
    const row = await this.prisma.tenantIntegration.findUnique({
      where: { tenantId_provider: { tenantId, provider: appId } },
    });
    const app = CATALOG.find((a) => a.id === appId);
    if (!row || row.status !== 'connected') {
      throw new BadRequestException(`${app?.name ?? appId} is not connected — connect it in the Marketplace first`);
    }
    return row;
  }
}
