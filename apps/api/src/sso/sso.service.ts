import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type UpsertSsoConfig = {
  provider?: string;
  enabled?: boolean;
  entryPoint?: string;
  issuer?: string;
  certificate?: string;
  metadataUrl?: string;
  domains?: string[];
};

@Injectable()
export class SsoService {
  constructor(private prisma: PrismaService) {}

  async getConfig(tenantId: string) {
    const config = await this.prisma.ssoConfig.findUnique({ where: { tenantId } });
    return (
      config ?? {
        tenantId,
        provider: 'saml',
        enabled: false,
        entryPoint: null,
        issuer: null,
        certificate: null,
        metadataUrl: null,
        domains: [],
      }
    );
  }

  async upsertConfig(tenantId: string, dto: UpsertSsoConfig) {
    const data = {
      provider: dto.provider ?? 'saml',
      enabled: dto.enabled ?? false,
      entryPoint: dto.entryPoint,
      issuer: dto.issuer,
      certificate: dto.certificate,
      metadataUrl: dto.metadataUrl,
      domains: (dto.domains ?? []) as any,
    };
    return this.prisma.ssoConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
  }

  /** Service Provider metadata XML for IdP configuration. */
  async getSpMetadata(subdomain: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { subdomain } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const entityId = `${apiUrl}/api/v1/sso/${subdomain}`;
    const acsUrl = `${apiUrl}/api/v1/sso/${subdomain}/acs`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="0" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
  }

  /** Used by the login page to decide whether to show an SSO button. */
  async getLoginHint(subdomain: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { subdomain } });
    if (!tenant) return { ssoEnabled: false };
    const config = await this.prisma.ssoConfig.findUnique({ where: { tenantId: tenant.id } });
    return {
      ssoEnabled: Boolean(config?.enabled && config.entryPoint),
      provider: config?.provider ?? null,
      entryPoint: config?.enabled ? config.entryPoint : null,
    };
  }
}
