import { DEFAULT_NETWORK, type Network } from '@harness/schema';

const EXPLORER: Record<Network, string> = {
  mainnet: 'https://stellar.expert/explorer/public',
  testnet: 'https://stellar.expert/explorer/testnet',
};

const CONTRACT_ID = /^C[A-Z2-7]{55}$/;
const RAW_CONTRACT_HEX = /^[0-9a-f]{64}$/i;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const CONTRACT_VERSION_BYTE = 2 << 3;

const crc16Xmodem = (bytes: number[]): number => {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
};

const base32 = (bytes: number[]): string => {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return bits > 0 ? out + BASE32[(value << (5 - bits)) & 31] : out;
};

/** Returns the C... contract address for a C... id or a raw 32-byte hex id; undefined otherwise. */
export const toContractId = (value: string): string | undefined => {
  if (CONTRACT_ID.test(value)) return value;
  if (!RAW_CONTRACT_HEX.test(value)) return undefined;
  const payload = [
    CONTRACT_VERSION_BYTE,
    ...(value.match(/../g) ?? []).map((h) => Number.parseInt(h, 16)),
  ];
  const crc = crc16Xmodem(payload);
  return base32([...payload, crc & 0xff, crc >> 8]);
};

export type ExplorerKind = 'account' | 'tx' | 'contract' | 'ledger' | 'asset';

export const explorerUrl = (
  kind: ExplorerKind,
  id: string | number,
  network: Network = DEFAULT_NETWORK,
): string => {
  const segment = kind === 'contract' ? (toContractId(String(id)) ?? String(id)) : String(id);
  return `${EXPLORER[network]}/${kind}/${encodeURIComponent(segment)}`;
};

export const subjectHref = (
  subjectKind: string,
  subject: string,
  network: Network = DEFAULT_NETWORK,
): string | undefined => {
  if (subjectKind === 'account') return explorerUrl('account', subject, network);
  if (subjectKind === 'contract') {
    return toContractId(subject) ? explorerUrl('contract', subject, network) : undefined;
  }
  if (subjectKind === 'repo' && subject.startsWith('https://')) return subject;
  return undefined;
};

export const REPO_URL = 'https://github.com/devodii/stellar-harness';
