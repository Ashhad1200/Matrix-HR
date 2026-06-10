import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CatalogApp = {
  id: string;
  name: string;
  category: string;
  pillar: string;
  description: string;
  scopes: string[];
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';
  status: 'available' | 'coming_soon';
};

const CATALOG: CatalogApp[] = [
  // Global Payroll & PEO
  { id: 'deel', name: 'Deel', category: 'payroll', pillar: 'Global Payroll & PEO', description: 'Push localized payroll additions, banking details, and tax forms to 150+ countries', scopes: ['employees:read', 'payroll:write', 'banking:write'], syncDirection: 'bidirectional', status: 'available' },
  { id: 'remote', name: 'Remote', category: 'payroll', pillar: 'Global Payroll & PEO', description: 'Global EOR sync for contracts and country-specific compliance', scopes: ['employees:read', 'payroll:write'], syncDirection: 'bidirectional', status: 'available' },
  { id: 'papaya-global', name: 'Papaya Global', category: 'payroll', pillar: 'Global Payroll & PEO', description: 'Workforce payments and cross-border payroll data packets', scopes: ['employees:read', 'payroll:write'], syncDirection: 'outbound', status: 'coming_soon' },
  // Identity & Productivity
  { id: 'okta', name: 'Okta', category: 'identity', pillar: 'Identity Management', description: 'Provision accounts and app licenses when employees switch to Active', scopes: ['employees:read', 'lifecycle:subscribe'], syncDirection: 'outbound', status: 'available' },
  { id: 'azure-ad', name: 'Microsoft Entra ID', category: 'identity', pillar: 'Identity Management', description: 'SCIM user provisioning and SSO group mapping', scopes: ['employees:read', 'lifecycle:subscribe'], syncDirection: 'outbound', status: 'available' },
  { id: 'slack', name: 'Slack', category: 'productivity', pillar: 'Productivity', description: 'PTO lookup shortcuts and approval notifications in channels', scopes: ['leave:read', 'notifications:write'], syncDirection: 'outbound', status: 'available' },
  { id: 'google-workspace', name: 'Google Workspace', category: 'productivity', pillar: 'Productivity', description: 'SSO, shared leave calendar sync', scopes: ['calendar:write'], syncDirection: 'outbound', status: 'available' },
  { id: 'zoom', name: 'Zoom', category: 'productivity', pillar: 'Productivity', description: 'Interview scheduling links inside the ATS', scopes: ['recruitment:read'], syncDirection: 'outbound', status: 'available' },
  // Learning
  { id: 'talentlms', name: 'TalentLMS', category: 'learning', pillar: 'Learning Management', description: 'Sync course certificates and training logs back to employee records', scopes: ['employees:read', 'training:write'], syncDirection: 'inbound', status: 'available' },
  { id: 'absorb', name: 'Absorb LMS', category: 'learning', pillar: 'Learning Management', description: 'Course completion audit history on employee profiles', scopes: ['training:write'], syncDirection: 'inbound', status: 'coming_soon' },
  // Screening
  { id: 'checkr', name: 'Checkr', category: 'screening', pillar: 'Background Screening', description: 'Order background checks from the ATS candidate card with live status', scopes: ['recruitment:read', 'screening:write'], syncDirection: 'bidirectional', status: 'available' },
  { id: 'verified-first', name: 'Verified First', category: 'screening', pillar: 'Background Screening', description: 'Embedded verification orders and adjudication results', scopes: ['recruitment:read'], syncDirection: 'bidirectional', status: 'coming_soon' },
  // Benefits & Finance
  { id: 'human-interest', name: 'Human Interest', category: 'benefits', pillar: 'Financial Planning & Benefits', description: '401(k) allocations synced with monthly payroll deductions', scopes: ['payroll:read', 'benefits:write'], syncDirection: 'bidirectional', status: 'available' },
  { id: 'ease', name: 'Ease', category: 'benefits', pillar: 'Financial Planning & Benefits', description: 'Medical deductions and eligibility changes into payroll calc', scopes: ['payroll:read', 'benefits:write'], syncDirection: 'inbound', status: 'coming_soon' },
  { id: 'quickbooks', name: 'QuickBooks', category: 'accounting', pillar: 'Accounting', description: 'Payroll journal export to your general ledger', scopes: ['payroll:read'], syncDirection: 'outbound', status: 'available' },
  { id: 'tally', name: 'Tally', category: 'accounting', pillar: 'Accounting', description: 'Payroll journal export for Tally ERP', scopes: ['payroll:read'], syncDirection: 'outbound', status: 'available' },
  // Job boards
  { id: 'indeed', name: 'Indeed', category: 'recruitment', pillar: 'Job Syndication', description: 'Syndicate open roles to Indeed via XML feed', scopes: ['jobs:read'], syncDirection: 'outbound', status: 'available' },
  { id: 'ziprecruiter', name: 'ZipRecruiter', category: 'recruitment', pillar: 'Job Syndication', description: 'Push job postings to ZipRecruiter aggregator', scopes: ['jobs:read'], syncDirection: 'outbound', status: 'available' },
  { id: 'rozee', name: 'Rozee.pk', category: 'recruitment', pillar: 'Job Syndication', description: 'Pakistan job board posting sync', scopes: ['jobs:read'], syncDirection: 'outbound', status: 'coming_soon' },
  // Local & hardware
  { id: 'nadra-verisys', name: 'NADRA Verisys', category: 'local', pillar: 'Local Compliance', description: 'CNIC verification for Pakistani employees', scopes: ['employees:read'], syncDirection: 'outbound', status: 'coming_soon' },
  { id: 'zkteco', name: 'ZKTeco Biometric', category: 'hardware', pillar: 'Time Hardware', description: 'Biometric attendance devices and kiosk pairing', scopes: ['attendance:write'], syncDirection: 'inbound', status: 'available' },
  { id: 'careem', name: 'Careem Business', category: 'lifestyle', pillar: 'Lifestyle', description: 'Corporate rides for employees', scopes: [], syncDirection: 'outbound', status: 'coming_soon' },
];

@Injectable()
export class MarketplaceService {
  constructor(private prisma: PrismaService) {}

  async getIntegrations(tenantId: string, category?: string) {
    const installed = await this.prisma.tenantIntegration.findMany({ where: { tenantId } });
    const installedMap = new Map(installed.map((i) => [i.provider, i]));

    const apps = CATALOG.filter((a) => !category || a.category === category).map((app) => {
      const record = installedMap.get(app.id);
      return {
        ...app,
        connected: record?.status === 'connected',
        installedAt: record?.installedAt ?? null,
        lastSync: (record?.config as any)?.lastSync ?? null,
      };
    });
    return apps;
  }

  getCategories() {
    return [...new Set(CATALOG.map((i) => i.category))];
  }

  async connect(tenantId: string, appId: string) {
    const app = CATALOG.find((a) => a.id === appId);
    if (!app) throw new NotFoundException('App not found in marketplace');
    if (app.status !== 'available') throw new BadRequestException(`${app.name} is coming soon`);

    return this.prisma.tenantIntegration.upsert({
      where: { tenantId_provider: { tenantId, provider: appId } },
      create: {
        tenantId,
        provider: appId,
        status: 'connected',
        installedAt: new Date(),
        config: { scopes: app.scopes, syncDirection: app.syncDirection },
      },
      update: { status: 'connected', installedAt: new Date() },
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
    });
  }

  /** Simulated provider sync: counts synced records by scope and stamps lastSync. */
  async sync(tenantId: string, appId: string) {
    const app = CATALOG.find((a) => a.id === appId);
    if (!app) throw new NotFoundException('App not found in marketplace');

    const existing = await this.prisma.tenantIntegration.findUnique({
      where: { tenantId_provider: { tenantId, provider: appId } },
    });
    if (!existing || existing.status !== 'connected') {
      throw new BadRequestException(`${app.name} is not connected`);
    }

    const synced: Record<string, number> = {};
    if (app.scopes.some((s) => s.startsWith('employees'))) {
      synced.employees = await this.prisma.employee.count({ where: { tenantId, status: 'ACTIVE' } });
    }
    if (app.scopes.some((s) => s.startsWith('payroll'))) {
      synced.payrollItems = await this.prisma.payrollItem.count({ where: { employee: { tenantId } } });
    }
    if (app.scopes.some((s) => s.startsWith('jobs') || s.startsWith('recruitment'))) {
      synced.openJobs = await this.prisma.jobPosting.count({ where: { tenantId, status: 'open' } });
    }
    if (app.scopes.some((s) => s.startsWith('leave'))) {
      synced.leaveRequests = await this.prisma.leaveRequest.count({ where: { tenantId } });
    }
    if (app.scopes.some((s) => s.startsWith('training'))) {
      synced.enrollments = await this.prisma.courseEnrollment.count({ where: { employee: { tenantId } } });
    }

    const lastSync = new Date().toISOString();
    await this.prisma.tenantIntegration.update({
      where: { id: existing.id },
      data: { config: { ...((existing.config as object) ?? {}), lastSync, lastSyncCounts: synced } },
    });

    return { app: app.id, syncedAt: lastSync, records: synced };
  }
}
