import { Controller, Get, Header, NotFoundException, Param, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Public careers feed — JSON for career sites, XML for Indeed/ZipRecruiter syndication. */
@Controller('careers')
export class CareersController {
  constructor(private prisma: PrismaService) {}

  @Get(':subdomain/jobs')
  async getJobs(@Param('subdomain') subdomain: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { subdomain } });
    if (!tenant) throw new NotFoundException('Company not found');

    const jobs = await this.prisma.jobPosting.findMany({
      where: { tenantId: tenant.id, status: 'open' },
      select: {
        id: true,
        title: true,
        description: true,
        department: true,
        requirements: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { company: { name: tenant.name, logoUrl: tenant.logoUrl }, jobs };
  }

  @Get(':subdomain/feed.xml')
  @Header('Content-Type', 'application/xml')
  async getXmlFeed(@Param('subdomain') subdomain: string, @Query('board') board?: string) {
    const { company, jobs } = await this.getJobs(subdomain);
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';

    const items = jobs
      .map(
        (j) => `  <job>
    <title><![CDATA[${j.title}]]></title>
    <date><![CDATA[${j.createdAt.toUTCString()}]]></date>
    <referencenumber><![CDATA[${j.id}]]></referencenumber>
    <url><![CDATA[${webUrl}/careers/${subdomain}/${j.id}]]></url>
    <company><![CDATA[${company.name}]]></company>
    <department><![CDATA[${j.department ?? 'General'}]]></department>
    <jobtype><![CDATA[fulltime]]></jobtype>
    <description><![CDATA[${j.description ?? ''}]]></description>
  </job>`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>
<source>
  <publisher>${company.name} via MatrixHR${board ? ` (${board})` : ''}</publisher>
  <publisherurl>${webUrl}</publisherurl>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</source>`;
  }
}
