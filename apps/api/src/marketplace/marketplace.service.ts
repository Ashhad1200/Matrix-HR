import { Injectable } from '@nestjs/common';

const INTEGRATIONS = [
  { id: 'slack', name: 'Slack', category: 'productivity', status: 'available', description: 'Leave bot, attendance notifications' },
  { id: 'google-workspace', name: 'Google Workspace', category: 'productivity', status: 'available', description: 'SSO, calendar sync' },
  { id: 'zoom', name: 'Zoom', category: 'productivity', status: 'available', description: 'Interview scheduling' },
  { id: 'quickbooks', name: 'QuickBooks', category: 'accounting', status: 'available', description: 'Payroll journal export' },
  { id: 'tally', name: 'Tally', category: 'accounting', status: 'available', description: 'Payroll journal export' },
  { id: 'nadra-verisys', name: 'NADRA Verisys', category: 'local', status: 'coming_soon', description: 'CNIC verification' },
  { id: 'rozee', name: 'Rozee.pk', category: 'recruitment', status: 'coming_soon', description: 'Job posting sync' },
  { id: 'foodpanda', name: 'Foodpanda for Business', category: 'lifestyle', status: 'coming_soon', description: 'Office meal credits' },
  { id: 'careem', name: 'Careem Business', category: 'lifestyle', status: 'coming_soon', description: 'Corporate rides' },
  { id: 'zkteco', name: 'ZKTeco Biometric', category: 'hardware', status: 'available', description: 'Biometric attendance devices' },
];

@Injectable()
export class MarketplaceService {
  getIntegrations(category?: string) {
    if (category) return INTEGRATIONS.filter((i) => i.category === category);
    return INTEGRATIONS;
  }

  getCategories() {
    return [...new Set(INTEGRATIONS.map((i) => i.category))];
  }
}
