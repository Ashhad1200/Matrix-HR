import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

function run(exception: any, requestId: string | undefined = 'req-1234abcd') {
  const json = jest.fn();
  const res = { status: jest.fn().mockReturnValue({ json }) };
  const host: any = { switchToHttp: () => ({ getRequest: () => ({ requestId, method: 'GET', originalUrl: '/api/v1/x?token=secret' }), getResponse: () => res }) };
  const filter = new AllExceptionsFilter();
  jest.spyOn((filter as any).logger, 'error').mockImplementation(() => undefined);
  filter.catch(exception, host);
  return { status: res.status.mock.calls[0][0], body: json.mock.calls[0][0], logger: (filter as any).logger };
}

describe('AllExceptionsFilter', () => {
  it('keeps the message of HTTP exceptions and adds the request id', () => {
    const { status, body } = run(new ForbiddenException('No access'));
    expect(status).toBe(403);
    expect(body).toMatchObject({ statusCode: 403, message: 'No access', requestId: 'req-1234abcd' });
  });

  it('preserves validation message arrays', () => {
    const { body } = run(new BadRequestException(['email must be an email', 'password too short']));
    expect(body.message).toEqual(['email must be an email', 'password too short']);
  });

  it('never leaks stack traces or the raw message of an unexpected error', () => {
    const boom = Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=hunter2'), { stack: 'Error: at /app/secret/path.ts:1' });
    const { status, body, logger } = run(boom);
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toMatch(/hunter2|ECONNREFUSED|secret\/path|stack/);
    expect(body.message).toBe('Internal server error');
    // ...but it IS logged server-side, with the request id and without the query string
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('req-1234abcd'), expect.stringContaining('secret/path'));
    expect((logger.error as jest.Mock).mock.calls[0][0]).not.toContain('token=secret');
  });

  it.each([
    ['P2002', 409],
    ['P2025', 404],
    ['P2003', 400],
  ])('maps Prisma %s to %i without exposing table/column names', (code, expected) => {
    const prismaErr = { name: 'PrismaClientKnownRequestError', code, message: 'Unique constraint failed on the fields: (`email`) on table "User"', meta: { target: ['email'] } };
    const { status, body } = run(prismaErr);
    expect(status).toBe(expected);
    expect(JSON.stringify(body)).not.toMatch(/email|User|constraint|meta/i);
  });

  it('treats Prisma validation errors as a generic 400', () => {
    const { status, body } = run({ name: 'PrismaClientValidationError', message: 'Unknown argument `tenantId` ...' });
    expect(status).toBe(400);
    expect(body.message).toBe('Invalid request');
  });

  it('reports oversized and malformed bodies clearly', () => {
    expect(run({ type: 'entity.too.large' }).status).toBe(413);
    expect(run({ type: 'entity.parse.failed' }).status).toBe(400);
  });
});
