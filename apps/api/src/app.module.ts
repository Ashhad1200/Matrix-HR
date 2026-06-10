import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { EmployeesModule } from './employees/employees.module';
import { LeaveModule } from './leave/leave.module';
import { AttendanceModule } from './attendance/attendance.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { PayrollModule } from './payroll/payroll.module';
import { RecruitmentModule } from './recruitment/recruitment.module';
import { PerformanceModule } from './performance/performance.module';
import { LmsModule } from './lms/lms.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { AiModule } from './ai/ai.module';
import { ReportsModule } from './reports/reports.module';
import { DevModule } from './dev/dev.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { FormulasModule } from './formulas/formulas.module';
import { PreboardingModule } from './preboarding/preboarding.module';
import { EsignModule } from './esign/esign.module';
import { EnpsModule } from './enps/enps.module';
import { PeerReviewsModule } from './peer-reviews/peer-reviews.module';
import { ExtensionsModule } from './extensions/extensions.module';
import { ReportsBuilderModule } from './reports-builder/reports-builder.module';
import { OneOnOnesModule } from './oneonones/oneonones.module';
import { TimesheetsModule } from './timesheets/timesheets.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { EorModule } from './eor/eor.module';
import { SsoModule } from './sso/sso.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuditModule,
    NotificationsModule,
    AuthModule,
    TenantsModule,
    EmployeesModule,
    LeaveModule,
    AttendanceModule,
    OnboardingModule,
    WhatsAppModule,
    PayrollModule,
    RecruitmentModule,
    PerformanceModule,
    LmsModule,
    DashboardModule,
    ReportsModule,
    AiModule,
    MarketplaceModule,
    DevModule,
    ApprovalsModule,
    CustomFieldsModule,
    WorkflowsModule,
    WebhooksModule,
    IntegrationsModule,
    FormulasModule,
    PreboardingModule,
    EsignModule,
    EnpsModule,
    PeerReviewsModule,
    ExtensionsModule,
    ReportsBuilderModule,
    OneOnOnesModule,
    TimesheetsModule,
    ApiKeysModule,
    EorModule,
    SsoModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
