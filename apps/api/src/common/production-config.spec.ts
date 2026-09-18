import { productionConfigProblems } from './production-config';

const good = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@db:5432/x',
  JWT_SECRET: 'k3Jf9sLq2XvB8nRt5YwZ1aCdE7gHiM0o',
  JWT_REFRESH_SECRET: 'Zp4Tq8VbN2mKx6JdS1yFhU9cAeW3rGl7',
  CREDENTIAL_KEY: 'Qw3Er5Ty7Ui9Op1As2Df4Gh6Jk8Lz0Xc',
  WEB_URL: 'https://app.matrixhr.example.org',
} as unknown as NodeJS.ProcessEnv;

describe('productionConfigProblems', () => {
  it('is silent outside production so local development is unaffected', () => {
    expect(productionConfigProblems({ NODE_ENV: 'development' } as any)).toEqual([]);
  });

  it('accepts a proper production configuration', () => {
    expect(productionConfigProblems(good)).toEqual([]);
  });

  it('rejects the development defaults this repo ships with', () => {
    const problems = productionConfigProblems({
      ...good,
      JWT_SECRET: 'dev-secret-change-in-production-32chars',
      JWT_REFRESH_SECRET: 'dev-refresh-secret-change-in-prod',
      CREDENTIAL_KEY: undefined,
      WEB_URL: 'http://localhost:3000',
    } as any);
    expect(problems).toHaveLength(4);
  });

  it('rejects reused secrets and test-only overrides', () => {
    const problems = productionConfigProblems({ ...good, JWT_REFRESH_SECRET: good.JWT_SECRET, THROTTLE_LIMIT: '100000', WEBHOOK_ALLOW_PRIVATE_TARGETS: 'true' } as any);
    expect(problems.join(' ')).toMatch(/must differ/);
    expect(problems.join(' ')).toMatch(/THROTTLE_LIMIT/);
    expect(problems.join(' ')).toMatch(/WEBHOOK_ALLOW_PRIVATE_TARGETS/);
  });
});
