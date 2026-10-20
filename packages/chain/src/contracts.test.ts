import { Address, StrKey, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import stateArchival from './__fixtures__/rpc-state-archival.json';
import {
  checkContracts,
  fetchXlmUsd,
  listActiveContracts,
  measureCloseSeconds,
  readMaxExtendLedgers,
} from './contracts';
import type { Rpc } from './rpc';
import { fakeFetch } from './testing';

const contractId = (n: number) => StrKey.encodeContract(Buffer.alloc(32, n));
const SOURCE = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 9));
const LATEST = 10_000;

const instanceKey = (contract: string) =>
  xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: Address.fromString(contract).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
    }),
  ).toXdr('base64');

const codeKey = (wasm: number) =>
  xdr.LedgerKey.contractCode(new xdr.LedgerKeyContractCode({ hash: Buffer.alloc(32, wasm) })).toXdr(
    'base64',
  );

const instanceEntry = (contract: string, wasm: number) =>
  xdr.LedgerEntryData.contractData(
    new xdr.ContractDataEntry({
      ext: xdr.ExtensionPoint.v0(),
      contract: Address.fromString(contract).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
      val: xdr.ScVal.scvContractInstance(
        new xdr.ScContractInstance({
          executable: xdr.ContractExecutable.contractExecutableWasm(Buffer.alloc(32, wasm)),
          storage: null,
        }),
      ),
    }),
  ).toXdr('base64');

type Entry = { key: string; xdr: string; liveUntilLedgerSeq?: number };

const fakeRpc = (entries: Entry[], failKeys: string[] = []) => {
  const simulations: { op: string; keys: number }[] = [];
  const entryCalls: number[] = [];
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const rpc: Rpc = {
    latestLedger: async () => LATEST,
    transactions: async () => {
      throw new Error('unused');
    },
    ledgers: async ({ startLedger }) => [{ sequence: startLedger, closeTime: startLedger * 6 }],
    ledgerEntries: async (keys) => {
      entryCalls.push(keys.length);
      if (keys.some((key) => failKeys.includes(key))) throw new Error('rpc down');
      if (keys[0] === stateArchival.entries[0]?.key) return stateArchival.entries;
      return keys.flatMap((key) => {
        const entry = byKey.get(key);
        return entry ? [entry] : [];
      });
    },
    simulate: async (txXdr) => {
      const tx = TransactionBuilder.fromXdr(
        txXdr,
        'Public Global Stellar Network ; September 2015',
      );
      const op = tx.operations[0];
      const data = xdr.TransactionEnvelope.fromXdr(txXdr, 'base64');
      const resources =
        data.type === 'envelopeTypeTx' && data.v1.tx.ext.type === 'sorobanData'
          ? data.v1.tx.ext.sorobanData.resources.footprint
          : null;
      const keys = (resources?.readOnly.length ?? 0) + (resources?.readWrite.length ?? 0);
      simulations.push({ op: op?.type ?? '', keys });
      if (op?.type === 'extendFootprintTtl' && op.extendTo !== 3_110_399)
        return { error: 'wrong extendTo' };
      return op?.type === 'restoreFootprint'
        ? { minResourceFee: '20000000' }
        : { minResourceFee: '5000000' };
    },
  };
  return { rpc, simulations, entryCalls };
};

describe('network settings', () => {
  it('reads the longest extension from the state archival setting', async () => {
    const { rpc } = fakeRpc([]);
    expect(await readMaxExtendLedgers(rpc)).toBe(3_110_399);
  });

  it('measures ledger close time from recent ledgers', async () => {
    const { rpc } = fakeRpc([]);
    expect(await measureCloseSeconds(rpc)).toBe(6);
  });
});

describe('checkContracts', () => {
  const archived = contractId(1);
  const expiring = contractId(2);
  const healthy = contractId(3);
  const codeArchived = contractId(4);
  const missing = contractId(5);
  const closeSeconds = 6;
  const ledgersFor = (days: number) => Math.round((days * 86_400) / closeSeconds);

  const entries: Entry[] = [
    { key: instanceKey(archived), xdr: instanceEntry(archived, 11), liveUntilLedgerSeq: 0 },
    { key: codeKey(11), xdr: 'AAAA', liveUntilLedgerSeq: LATEST + ledgersFor(400) },
    {
      key: instanceKey(expiring),
      xdr: instanceEntry(expiring, 12),
      liveUntilLedgerSeq: LATEST + ledgersFor(10),
    },
    { key: codeKey(12), xdr: 'AAAA', liveUntilLedgerSeq: LATEST + ledgersFor(200) },
    {
      key: instanceKey(healthy),
      xdr: instanceEntry(healthy, 12),
      liveUntilLedgerSeq: LATEST + ledgersFor(90),
    },
    {
      key: instanceKey(codeArchived),
      xdr: instanceEntry(codeArchived, 13),
      liveUntilLedgerSeq: LATEST + ledgersFor(90),
    },
  ];
  const active = [archived, expiring, healthy, codeArchived, missing].map((contract, n) => ({
    contract,
    invocations: 1000 - n,
    scfProject: n === 1 ? 'Demo' : null,
  }));

  it('keeps archived and expiring contracts with their fix cost', async () => {
    const { rpc, simulations } = fakeRpc(entries);
    const result = await checkContracts(rpc, active, { simulationSource: SOURCE, concurrency: 2 });
    expect(result.latestLedger).toBe(LATEST);
    expect(result.closeSeconds).toBe(6);
    expect(result.rows).toEqual([
      {
        contract: archived,
        status: 'archived',
        invocations: 1000,
        liveUntilLedger: null,
        daysLeft: null,
        fixCostXlm: 2.5,
        scfProject: null,
      },
      {
        contract: expiring,
        status: 'expiring',
        invocations: 999,
        liveUntilLedger: LATEST + ledgersFor(10),
        daysLeft: 10,
        fixCostXlm: 0.5,
        scfProject: 'Demo',
      },
      {
        contract: codeArchived,
        status: 'archived',
        invocations: 997,
        liveUntilLedger: LATEST + ledgersFor(90),
        daysLeft: null,
        fixCostXlm: 2.5,
        scfProject: null,
      },
      {
        contract: missing,
        status: 'archived',
        invocations: 996,
        liveUntilLedger: null,
        daysLeft: null,
        fixCostXlm: 2.5,
        scfProject: null,
      },
    ]);
    expect(result.simulated).toBe(4);
    expect(result.simulationFailed).toBe(0);
    expect(simulations.filter((s) => s.op === 'restoreFootprint')).toHaveLength(3);
    expect(simulations.filter((s) => s.op === 'extendFootprintTtl')).toHaveLength(4);
    expect(simulations.map((s) => s.keys).sort()).toEqual([1, 1, 2, 2, 2, 2, 2]);
  });

  it('stores null for a failed simulation and skips contracts whose lookup failed', async () => {
    const { rpc } = fakeRpc(entries);
    const failing: Rpc = { ...rpc, simulate: async () => ({ error: 'boom' }) };
    const result = await checkContracts(failing, [active[1] as (typeof active)[number]], {
      simulationSource: SOURCE,
    });
    expect(result.rows[0]?.fixCostXlm).toBeNull();
    expect(result.simulationFailed).toBe(1);
    expect(result.simulated).toBe(0);

    const down = fakeRpc(entries, [instanceKey(expiring)]);
    const skipped = await checkContracts(down.rpc, active.slice(0, 2), {
      simulationSource: SOURCE,
    });
    expect(skipped.rows).toEqual([]);
  });

  it('asks for ledger entries in batches of 200', async () => {
    const many = Array.from({ length: 450 }, (_, n) => ({
      contract: StrKey.encodeContract(Buffer.from(`${n}`.padStart(32, 'x'))),
      invocations: 100,
      scfProject: null,
    }));
    const { rpc, entryCalls } = fakeRpc([]);
    const result = await checkContracts(rpc, many, { simulationSource: SOURCE, concurrency: 4 });
    expect(entryCalls.slice(1).sort((a, b) => b - a)).toEqual([200, 200, 50]);
    expect(result.rows).toHaveLength(450);
  });
});

describe('listActiveContracts', () => {
  const scf = contractId(7);
  const busy = contractId(8);
  const quiet = contractId(9);
  const repoOnly = contractId(10);

  it('keeps 100+ invocation contracts and SCF-funded ones', async () => {
    const fetch = fakeFetch(({ url }) => {
      if (url.includes('/api/projects/search')) {
        return {
          body: {
            meta: { counts: { returned: 1, total: 1 } },
            projects: [
              {
                slug: 'demo',
                name: 'Demo',
                scfAwarded: true,
                onchain: { contracts: [{ address: scf }] },
              },
            ],
          },
        };
      }
      if (url.includes('/api/repos/search')) {
        return {
          body: {
            meta: { counts: { returned: 1, total: 1 } },
            repos: [
              {
                project: { slug: 'demo', name: 'Demo' },
                codeVerified: { mainnetContractId: repoOnly },
              },
            ],
          },
        };
      }
      if (url.includes('cursor=next')) {
        return {
          body: {
            _links: { next: { href: '/explorer/public/contract?order=desc&limit=200&cursor=end' } },
            _embedded: { records: [{ contract: scf, invocations: 3 }] },
          },
        };
      }
      if (url.includes('cursor=end')) return { body: { _links: {}, _embedded: { records: [] } } };
      return {
        body: {
          _links: { next: { href: '/explorer/public/contract?order=desc&limit=200&cursor=next' } },
          _embedded: {
            records: [
              { contract: busy, invocations: 150 },
              { contract: quiet, invocations: 99 },
            ],
          },
        },
      };
    });
    expect(await listActiveContracts({ fetchImpl: fetch.impl })).toEqual([
      { contract: busy, invocations: 150, scfProject: null },
      { contract: scf, invocations: 3, scfProject: 'Demo' },
      { contract: repoOnly, invocations: 0, scfProject: 'Demo' },
    ]);
    expect(fetch.calls.filter((call) => call.url.includes('stellar.expert'))).toHaveLength(3);
  });
});

describe('fetchXlmUsd', () => {
  it('reads one CoinGecko price with its time', async () => {
    const fetch = fakeFetch(() => ({
      body: { stellar: { usd: 0.18, last_updated_at: 1_792_538_905 } },
    }));
    expect(await fetchXlmUsd(fetch.impl)).toEqual({
      price: 0.18,
      source: 'coingecko:simple/price',
      time: new Date(1_792_538_905_000).toISOString(),
    });
    expect(fetch.calls).toHaveLength(1);
  });
});
