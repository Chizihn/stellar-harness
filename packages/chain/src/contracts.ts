import {
  Account,
  Address,
  Networks,
  Operation,
  SorobanDataBuilder,
  StrKey,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { z } from 'zod';
import { getJson } from './http';
import type { Rpc } from './rpc';

export type ActiveContract = { contract: string; invocations: number; scfProject: string | null };

export type ContractCheck = {
  contract: string;
  status: 'archived' | 'expiring';
  invocations: number;
  liveUntilLedger: number | null;
  daysLeft: number | null;
  fixCostXlm: number | null;
  scfProject: string | null;
};

const STELLAR_EXPERT_URL = 'https://api.stellar.expert/explorer/public';
const STELLARLIGHT_URL = 'https://stellarlight.xyz';
const COINGECKO_XLM_USD_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd&include_last_updated_at=true';

const MIN_INVOCATIONS = 100;
const EXPIRING_DAYS = 30;
const KEYS_PER_CALL = 200;
const STROOPS_PER_XLM = 10_000_000;
const SECONDS_PER_DAY = 86_400;
const CLOSE_SAMPLE_LEDGERS = 100;

const isContractId = (value: unknown): value is string =>
  typeof value === 'string' && StrKey.isValidContract(value);

const ExpertPage = z.object({
  _links: z.object({ next: z.object({ href: z.string() }).optional() }),
  _embedded: z.object({
    records: z.array(z.looseObject({ contract: z.string(), invocations: z.number().optional() })),
  }),
});

const Counts = z.object({ returned: z.number().int(), total: z.number().int().nullable() });

const ProjectsPage = z.object({
  meta: z.object({ counts: Counts }),
  projects: z.array(
    z.looseObject({
      slug: z.string(),
      name: z.string(),
      scfAwarded: z.boolean().optional(),
      onchain: z
        .looseObject({
          contracts: z
            .array(z.looseObject({ address: z.string() }))
            .nullable()
            .optional(),
        })
        .nullable()
        .optional(),
    }),
  ),
});

const ReposPage = z.object({
  meta: z.object({ counts: Counts }),
  repos: z.array(
    z.looseObject({
      scfAwarded: z.boolean().optional(),
      project: z.object({ slug: z.string(), name: z.string().nullable() }).nullable().optional(),
      codeVerified: z
        .looseObject({ mainnetContractId: z.string().nullable().optional() })
        .nullable()
        .optional(),
    }),
  ),
});

type ListOptions = { fetchImpl?: typeof fetch; log?: (m: string) => void };

const pageAll = async <T extends { meta: { counts: z.infer<typeof Counts> } }>(
  fetchImpl: typeof fetch,
  urlFor: (offset: number) => string,
  schema: z.ZodType<T>,
  each: (page: T) => void,
): Promise<void> => {
  let offset = 0;
  for (;;) {
    const page = await getJson(fetchImpl, urlFor(offset), schema);
    each(page);
    const { returned, total } = page.meta.counts;
    offset += returned;
    if (returned === 0 || total === null || offset >= total) return;
  }
};

const scfContracts = async (fetchImpl: typeof fetch): Promise<Map<string, string>> => {
  const projects = new Map<string, string>();
  const byContract = new Map<string, string>();
  await pageAll(
    fetchImpl,
    (offset) => `${STELLARLIGHT_URL}/api/projects/search?scfAwarded=1&limit=50&offset=${offset}`,
    ProjectsPage,
    (page) => {
      for (const project of page.projects) {
        if (project.scfAwarded === false) continue;
        projects.set(project.slug, project.name);
        for (const { address } of project.onchain?.contracts ?? []) {
          if (isContractId(address) && !byContract.has(address))
            byContract.set(address, project.name);
        }
      }
    },
  );
  await pageAll(
    fetchImpl,
    (offset) => `${STELLARLIGHT_URL}/api/repos/search?minScore=0&limit=100&offset=${offset}`,
    ReposPage,
    (page) => {
      for (const repo of page.repos) {
        const contract = repo.codeVerified?.mainnetContractId;
        const linked = repo.project;
        if (!isContractId(contract) || !linked || byContract.has(contract)) continue;
        const name =
          projects.get(linked.slug) ?? (repo.scfAwarded ? (linked.name ?? linked.slug) : null);
        if (name) byContract.set(contract, name);
      }
    },
  );
  return byContract;
};

export const listActiveContracts = async (opts: ListOptions = {}): Promise<ActiveContract[]> => {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? (() => {});
  const scf = await scfContracts(fetchImpl);
  log(`stellarlight: ${scf.size} SCF-funded contracts`);
  const invocations = new Map<string, number>();
  let url: string | null = `${STELLAR_EXPERT_URL}/contract?limit=200&order=desc`;
  let pages = 0;
  while (url) {
    const page: z.infer<typeof ExpertPage> = await getJson(fetchImpl, url, ExpertPage);
    pages += 1;
    for (const record of page._embedded.records) {
      const count = record.invocations ?? 0;
      if (count >= MIN_INVOCATIONS || scf.has(record.contract))
        invocations.set(record.contract, count);
    }
    const next = page._links.next?.href;
    const nextUrl: string | null =
      next && page._embedded.records.length > 0
        ? new URL(next, STELLAR_EXPERT_URL).toString()
        : null;
    url = nextUrl === url ? null : nextUrl;
    if (pages % 100 === 0) log(`stellar.expert: ${pages} pages, ${invocations.size} active`);
  }
  for (const contract of scf.keys()) if (!invocations.has(contract)) invocations.set(contract, 0);
  log(`stellar.expert: ${pages} pages, ${invocations.size} active`);
  return [...invocations.entries()]
    .map(([contract, count]) => ({
      contract,
      invocations: count,
      scfProject: scf.get(contract) ?? null,
    }))
    .sort((a, b) => b.invocations - a.invocations || a.contract.localeCompare(b.contract));
};

export const measureCloseSeconds = async (rpc: Rpc): Promise<number> => {
  const latest = (await rpc.latestLedger()) - 1;
  const [[first], [last]] = await Promise.all([
    rpc.ledgers({ startLedger: latest - CLOSE_SAMPLE_LEDGERS, limit: 1 }),
    rpc.ledgers({ startLedger: latest, limit: 1 }),
  ]);
  if (!first || !last || last.sequence <= first.sequence) {
    throw new Error('getLedgers returned no ledgers to measure close time');
  }
  return (last.closeTime - first.closeTime) / (last.sequence - first.sequence);
};

const stateArchivalKey = (): string =>
  xdr.LedgerKey.configSetting(
    new xdr.LedgerKeyConfigSetting({
      configSettingId: xdr.ConfigSettingId.configSettingStateArchival,
    }),
  ).toXdr('base64');

export const readMaxExtendLedgers = async (rpc: Rpc): Promise<number> => {
  const [entry] = await rpc.ledgerEntries([stateArchivalKey()]);
  if (!entry) throw new Error('CONFIG_SETTING stateArchival entry not found');
  const data = xdr.LedgerEntryData.fromXdr(entry.xdr, 'base64');
  if (data.type !== 'configSetting' || data.configSetting.type !== 'configSettingStateArchival') {
    throw new Error('CONFIG_SETTING entry is not stateArchival');
  }
  return data.configSetting.stateArchivalSettings.maxEntryTtl - 1;
};

const instanceKey = (contract: string): xdr.LedgerKey =>
  xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: Address.fromString(contract).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
    }),
  );

const codeKey = (wasmHash: Uint8Array): xdr.LedgerKey =>
  xdr.LedgerKey.contractCode(new xdr.LedgerKeyContractCode({ hash: Buffer.from(wasmHash) }));

const wasmHashOf = (entryXdr: string): Uint8Array | null => {
  try {
    const data = xdr.LedgerEntryData.fromXdr(entryXdr, 'base64');
    if (data.type !== 'contractData' || data.contractData.val.type !== 'scvContractInstance') {
      return null;
    }
    const executable = data.contractData.val.instance.executable;
    return executable.type === 'contractExecutableWasm' ? executable.wasmHash.value : null;
  } catch {
    return null;
  }
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    out.push(items.slice(index, index + size));
  return out;
};

const pool = async <T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
};

type Entry = { liveUntilLedgerSeq?: number; xdr: string };

const fetchEntries = async (
  rpc: Rpc,
  keys: string[],
  concurrency: number,
): Promise<{ entries: Map<string, Entry>; failed: Set<string> }> => {
  const entries = new Map<string, Entry>();
  const failed = new Set<string>();
  await pool(chunk([...new Set(keys)], KEYS_PER_CALL), concurrency, async (batch) => {
    try {
      for (const entry of await rpc.ledgerEntries(batch)) entries.set(entry.key, entry);
    } catch {
      for (const key of batch) failed.add(key);
    }
  });
  return { entries, failed };
};

const simulationTx = (
  source: string,
  keys: xdr.LedgerKey[],
  action: { kind: 'restore' } | { kind: 'extend'; ledgers: number },
): string => {
  const data =
    action.kind === 'restore'
      ? new SorobanDataBuilder().setReadWrite(keys).build()
      : new SorobanDataBuilder().setReadOnly(keys).build();
  return new TransactionBuilder(new Account(source, '0'), {
    fee: '100',
    networkPassphrase: Networks.PUBLIC,
    sorobanData: data,
  })
    .addOperation(
      action.kind === 'restore'
        ? Operation.restoreFootprint({})
        : Operation.extendFootprintTtl({ extendTo: action.ledgers }),
    )
    .setTimeout(0)
    .build()
    .toXdr();
};

const resourceFee = async (rpc: Rpc, txXdr: string): Promise<number | null> => {
  try {
    const result = await rpc.simulate(txXdr);
    if (result.error || !result.minResourceFee || !/^\d+$/.test(result.minResourceFee)) return null;
    return Number(result.minResourceFee);
  } catch {
    return null;
  }
};

export const checkContracts = async (
  rpc: Rpc,
  active: ActiveContract[],
  opts: { simulationSource: string; concurrency?: number },
): Promise<{
  rows: ContractCheck[];
  simulated: number;
  simulationFailed: number;
  closeSeconds: number;
  latestLedger: number;
}> => {
  const concurrency = opts.concurrency ?? 8;
  const [latestLedger, closeSeconds, maxExtend] = await Promise.all([
    rpc.latestLedger(),
    measureCloseSeconds(rpc),
    readMaxExtendLedgers(rpc),
  ]);
  const instances = new Map(active.map((row) => [row.contract, instanceKey(row.contract)]));
  const instanceXdr = new Map(
    [...instances].map(([contract, key]) => [contract, key.toXdr('base64')]),
  );
  const first = await fetchEntries(rpc, [...instanceXdr.values()], concurrency);

  const codes = new Map<string, xdr.LedgerKey>();
  for (const [contract, keyXdr] of instanceXdr) {
    const entry = first.entries.get(keyXdr);
    const hash = entry ? wasmHashOf(entry.xdr) : null;
    if (hash) codes.set(contract, codeKey(hash));
  }
  const codeXdr = new Map([...codes].map(([contract, key]) => [contract, key.toXdr('base64')]));
  const second = await fetchEntries(rpc, [...codeXdr.values()], concurrency);

  type Pending = { row: ContractCheck; keys: xdr.LedgerKey[] };
  const pending: Pending[] = [];
  for (const contract of active) {
    const iKey = instanceXdr.get(contract.contract) as string;
    const cKey = codeXdr.get(contract.contract);
    if (first.failed.has(iKey) || (cKey && second.failed.has(cKey))) continue;
    const found = [first.entries.get(iKey), cKey ? second.entries.get(cKey) : undefined];
    const expected = cKey ? 2 : 1;
    const lives = found.flatMap((entry) => (entry ? [entry.liveUntilLedgerSeq ?? 0] : []));
    const liveUntil = lives.length > 0 ? Math.min(...lives) : null;
    const archived = lives.length < expected || liveUntil === null || liveUntil < latestLedger;
    const daysLeft =
      archived || liveUntil === null
        ? null
        : Math.round((((liveUntil - latestLedger) * closeSeconds) / SECONDS_PER_DAY) * 100) / 100;
    if (!archived && (daysLeft === null || daysLeft > EXPIRING_DAYS)) continue;
    const keys = [instances.get(contract.contract) as xdr.LedgerKey];
    const code = codes.get(contract.contract);
    if (code) keys.push(code);
    pending.push({
      keys,
      row: {
        contract: contract.contract,
        status: archived ? 'archived' : 'expiring',
        invocations: contract.invocations,
        liveUntilLedger: liveUntil !== null && liveUntil > 0 ? liveUntil : null,
        daysLeft,
        fixCostXlm: null,
        scfProject: contract.scfProject,
      },
    });
  }

  const rows = await pool(pending, concurrency, async ({ row, keys }) => {
    const extend = simulationTx(opts.simulationSource, keys, {
      kind: 'extend',
      ledgers: maxExtend,
    });
    const fees =
      row.status === 'archived'
        ? await Promise.all([
            resourceFee(rpc, simulationTx(opts.simulationSource, keys, { kind: 'restore' })),
            resourceFee(rpc, extend),
          ])
        : [await resourceFee(rpc, extend)];
    const total = fees.every((fee) => fee !== null)
      ? fees.reduce<number>((sum, fee) => sum + (fee ?? 0), 0)
      : null;
    return { ...row, fixCostXlm: total === null ? null : total / STROOPS_PER_XLM };
  });

  const simulationFailed = rows.filter((row) => row.fixCostXlm === null).length;
  return {
    rows,
    simulated: rows.length - simulationFailed,
    simulationFailed,
    closeSeconds,
    latestLedger,
  };
};

const Price = z.object({
  stellar: z.object({ usd: z.number().positive(), last_updated_at: z.number().int().optional() }),
});

export const fetchXlmUsd = async (
  fetchImpl: typeof fetch = fetch,
): Promise<{ price: number; source: string; time: string }> => {
  const body = await getJson(fetchImpl, COINGECKO_XLM_USD_URL, Price);
  const at = body.stellar.last_updated_at;
  return {
    price: body.stellar.usd,
    source: 'coingecko:simple/price',
    time: new Date(at === undefined ? Date.now() : at * 1000).toISOString(),
  };
};
