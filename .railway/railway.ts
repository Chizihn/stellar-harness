import { defineRailway, project, service } from 'railway/iac';
export const partial = 'worker';

export default defineRailway(() => {
  const worker = service('worker', {
    build: 'pnpm --filter worker build',
    start: 'pnpm --filter worker start',
    healthcheck: '/health',
    healthcheckTimeout: 300,
    replicas: { 'us-east4-eqdc4a': 1 },
  });

  return project('stellar-harness', {
    variables: { managed: false },
    resources: [worker],
  });
});
