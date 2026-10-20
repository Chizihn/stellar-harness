type SummaryPart = { type: string; state: string };

const PHRASES: [tools: string[], one: string, many: string][] = [
  [['getAccount'], 'checked 1 account', 'checked {n} accounts'],
  [['getContractTtl'], 'checked 1 contract', 'checked {n} contracts'],
  [['buildPaymentPreflight'], 'checked 1 payment', 'checked {n} payments'],
  [['simulateExtendTtl', 'simulateRestore'], 'simulated 1 fix', 'simulated {n} fixes'],
  [['proposeAction'], 'proposed 1 fix', 'proposed {n} fixes'],
  [['getMainnetReport'], 'read the mainnet report', 'read the mainnet report'],
];

const toolName = (part: SummaryPart): string => part.type.replace(/^tool-/, '');

export const summarizeToolParts = (parts: SummaryPart[]): string => {
  const names = parts.map(toolName);
  const phrases = PHRASES.flatMap(([tools, one, many]) => {
    const n = names.filter((name) => tools.includes(name)).length;
    if (n === 0) return [];
    return [n === 1 ? one : many.replace('{n}', String(n))];
  });
  if (phrases.length === 0 && names.includes('getOrg')) phrases.push('read the demo company');
  const failed = parts.filter((part) => part.state === 'output-error').length;
  if (failed > 0) phrases.push(`${failed} failed`);
  return phrases.join(', ');
};

export const isToolRunning = (parts: SummaryPart[]): boolean =>
  parts.some((part) => part.state === 'input-streaming' || part.state === 'input-available');
