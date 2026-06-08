import { NotFoundException } from '@nestjs/common';
import { EmployeesService } from './employees.service';

describe('EmployeesService tenant isolation', () => {
  const tenantA = 'tenant-a-id';
  const tenantB = 'tenant-b-id';

  const prisma = {
    employee: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const audit = { log: jest.fn() };
  const service = new EmployeesService(prisma as never, audit as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scopes findAll queries to the requesting tenant', async () => {
    prisma.employee.findMany.mockResolvedValue([]);
    prisma.employee.count.mockResolvedValue(0);

    await service.findAll(tenantA, { page: 1, limit: 10 });

    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantA }),
      }),
    );
    expect(prisma.employee.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantA }),
      }),
    );
  });

  it('rejects cross-tenant employee access via findOne', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(service.findOne(tenantA, 'employee-from-tenant-b')).rejects.toThrow(
      NotFoundException,
    );

    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'employee-from-tenant-b', tenantId: tenantA },
      }),
    );
  });

  it('returns employee only when tenant matches', async () => {
    const employee = {
      id: 'emp-1',
      tenantId: tenantA,
      firstName: 'Sara',
      lastName: 'Ahmed',
    };
    prisma.employee.findFirst.mockResolvedValue(employee);

    const result = await service.findOne(tenantA, 'emp-1');

    expect(result).toEqual(employee);
    expect(prisma.employee.findFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantB }),
      }),
    );
  });
});
