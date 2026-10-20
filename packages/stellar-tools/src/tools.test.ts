import { Account, Address, Keypair, Networks, xdr } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { getAccount } from './account';
import type { Clients, HorizonAccount } from './clients';
import { getContractTtl, ttlOf } from './contract-ttl';
import { buildPaymentPreflight, checkPayment } from './preflight';
import { ledgersForDays, MAX_EXTEND_LEDGERS, simulateExtendTtl, simulateRestore } from './simulate';

const TREASURY = Keypair.random().publicKey();
const DISTRIBUTION = Keypair.random().publicKey();
const CONTRACT = 'CADKCKAZEOUXFS46JTA73DFGCWUGTZDKU5UTUAEA6OAZB7RV5CEHS47R';
const WASM = '60ab01d1a6127e676dcbb175b5e485ec7842a7cf807d120b4472b692b603f904';
const USDC = `USDC:${Keypair.random().publicKey()}`;
const [USDC_CODE, USDC_ISSUER] = USDC.split(':');
const LATEST = 1_000_000;

const account = (balances: HorizonAccount['balances'], subentries = 0): HorizonAccount => ({
  sequence: '42',
  subentry_count: subentries,
  signers: [{ key: TREASURY, weight: 1 }],
  balances,
});
const xlm = (balance: string) => ({ asset_type: 'native', balance });
const usdc = (balance: string) => ({
  asset_type: 'credit_alphanum4',
  asset_code: USDC_CODE,
  asset_issuer: USDC_ISSUER,
  balance,
  limit: '1000',
});

const instanceEntry = (liveUntilLedgerSeq: number) => ({
  liveUntilLedgerSeq,
  val: xdr.LedgerEntryData.contractData(
    new xdr.ContractDataEntry({
      ext: xdr.ExtensionPoint.v0(),
      contract: Address.fromString(CONTRACT).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
      val: xdr.ScVal.scvContractInstance(
        new xdr.ScContractInstance({
          executable: xdr.ContractExecutable.contractExecutableWasm(Buffer.from(WASM, 'hex')),
          storage: null,
        }),
      ),
    }),
  ),
});

const fakeClients = (overrides: Partial<Clients> = {}): Clients => {
  const accounts: Record<string, HorizonAccount> = {
    [TREASURY]: account([xlm('100'), usdc('100')], 1),
    [DISTRIBUTION]: account([xlm('50')]),
  };
  const rpcFake = {
    getAccount: async (id: string) => new Account(id, '42'),
    getLedgerEntries: async (key: xdr.LedgerKey) => ({
      latestLedger: LATEST,
      entries:
        key.type === 'contractData'
          ? [instanceEntry(LATEST + 17_280 * 3)]
          : [{ liveUntilLedgerSeq: LATEST - 1 }],
    }),
    simulateTransaction: async () => ({ minResourceFee: '273032180', latestLedger: LATEST }),
  } as unknown as Clients['rpc'];
  return {
    network: 'testnet',
    passphrase: Networks.TESTNET,
    loadAccount: async (address) => accounts[address] ?? null,
    rpc: rpcFake,
    ...overrides,
  };
};

describe('getAccount', () => {
  it('reads balance, signers and trustlines', async () => {
    const view = await getAccount(fakeClients(), TREASURY);
    expect(view).toMatchObject({ exists: true, xlm: '100', sequence: '42', signers: 1 });
    expect(view.trustlines).toEqual([{ asset: USDC, balance: '100', limit: '1000' }]);
  });

  it('reports a missing account', async () => {
    const view = await getAccount(fakeClients(), Keypair.random().publicKey());
    expect(view).toMatchObject({ exists: false, xlm: null, trustlines: [] });
  });
});

describe('getContractTtl', () => {
  it('converts ledgers left into days', () => {
    expect(ttlOf(LATEST + 17_280, LATEST)).toEqual({
      liveUntilLedger: LATEST + 17_280,
      daysLeft: 1,
      archived: false,
    });
    expect(ttlOf(LATEST - 1, LATEST).archived).toBe(true);
    expect(ttlOf(undefined, LATEST).archived).toBe(true);
  });

  it('reads instance and code entries', async () => {
    const ttl = await getContractTtl(fakeClients(), CONTRACT);
    expect(ttl.wasmHash).toBe(WASM);
    expect(ttl.instance).toMatchObject({ daysLeft: 3, archived: false });
    expect(ttl.code).toMatchObject({ archived: true });
  });
});

describe('simulateExtendTtl and simulateRestore', () => {
  it('returns the fee, cost and operation', async () => {
    const extend = await simulateExtendTtl(fakeClients(), {
      contractId: CONTRACT,
      days: 365,
      source: TREASURY,
    });
    expect(extend).toMatchObject({
      minResourceFeeStroops: 273_032_180,
      estimatedCostXlm: 27.303228,
      footprintEntries: 2,
    });
    expect(extend.operation).toContain(
      '180 days from now, the network maximum (ExtendFootprintTTL)',
    );
  });

  it('caps an extension at the network maximum ttl', () => {
    expect(ledgersForDays(30)).toBe(518_400);
    expect(ledgersForDays(365)).toBe(MAX_EXTEND_LEDGERS);
  });

  it('describes a restore', async () => {
    const restore = await simulateRestore(fakeClients(), {
      contractId: CONTRACT,
      source: TREASURY,
    });
    expect(restore.operation).toContain('RestoreFootprint');
  });

  it('throws when the simulation fails', async () => {
    const clients = fakeClients();
    clients.rpc.simulateTransaction = (async () => ({
      error: 'boom',
      latestLedger: LATEST,
    })) as unknown as Clients['rpc']['simulateTransaction'];
    await expect(
      simulateRestore(clients, { contractId: CONTRACT, source: TREASURY }),
    ).rejects.toThrow('Simulation failed: boom');
  });
});

describe('buildPaymentPreflight', () => {
  const payment = { from: TREASURY, to: DISTRIBUTION, asset: USDC, amount: 25 };

  it('blocks a payment to an account without a trustline', async () => {
    const preflight = await buildPaymentPreflight(fakeClients(), payment);
    expect(preflight.ok).toBe(false);
    expect(preflight.blockers.map((b) => b.code)).toEqual(['op_no_trust']);
    expect(preflight.blockers[0]?.fix).toContain('trustline');
  });

  it('resolves a bare asset code from the sender trustlines', async () => {
    const preflight = await buildPaymentPreflight(fakeClients(), { ...payment, asset: 'usdc' });
    expect(preflight.blockers.map((b) => b.code)).toEqual(['op_no_trust']);
  });

  it('passes when the receiver trusts the asset and the sender holds it', () => {
    const result = checkPayment(payment, account([xlm('10'), usdc('30')]), account([usdc('0')]));
    expect(result).toEqual({ ok: true, blockers: [] });
  });

  it('flags a missing destination and an underfunded sender', () => {
    const result = checkPayment(payment, account([xlm('10'), usdc('5')]), null);
    expect(result.blockers.map((b) => b.code)).toEqual(['op_no_destination', 'op_underfunded']);
  });

  it('flags XLM that would break the reserve', () => {
    const xlmPayment = { ...payment, asset: 'XLM', amount: 9 };
    const result = checkPayment(xlmPayment, account([xlm('10')], 2), account([xlm('1')]));
    expect(result.blockers.map((b) => b.code)).toEqual(['op_low_reserve']);
  });

  it('fails loudly when the source does not exist', async () => {
    await expect(
      buildPaymentPreflight(fakeClients(), { ...payment, from: Keypair.random().publicKey() }),
    ).rejects.toThrow('does not exist');
  });
});
