import { StrKey, xdr } from '@stellar/stellar-sdk';
import horizon from './horizon-codes.json';

const NAMES: Record<string, Record<string, string> | undefined> = horizon.codes;

const snake = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

const upperFirst = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const txCode = (name: string): string =>
  NAMES.Transaction?.[name] ?? `tx_${snake(name).replace(/^tx_?/, '')}`;

const innerOpCode = (operation: string, resultName: string): string => {
  const aliases = operation === 'createPassiveSellOffer' ? ['manageSellOffer'] : [];
  for (const candidate of [operation, ...aliases]) {
    const known = NAMES[upperFirst(candidate)]?.[resultName];
    if (known) return known;
  }
  const suffix = resultName.startsWith(operation) ? resultName.slice(operation.length) : resultName;
  return `op_${snake(suffix)}`;
};

const opCode = (result: xdr.OperationResult): string => {
  if (result.type !== 'opInner') return NAMES.Operation?.[result.type] ?? snake(result.type);
  const inner: unknown = result.tr.value;
  const type =
    typeof inner === 'object' && inner !== null && 'type' in inner ? String(inner.type) : null;
  return type ? innerOpCode(result.tr.type, type) : `op_${snake(result.tr.type)}`;
};

type ResultBody = xdr.TransactionResultResult | xdr.InnerTransactionResultResult;

const bodyCode = (body: ResultBody): string | null => {
  if (body.type === 'txSuccess') return null;
  if (body.type !== 'txFailed') return txCode(body.type);
  const failing = body.results.map(opCode).find((code) => code !== 'op_success');
  return failing ?? 'tx_failed';
};

export const failureCode = (resultXdr: string): string | null => {
  const outer = xdr.TransactionResult.fromXdr(resultXdr, 'base64').result;
  if (outer.type === 'txFeeBumpInnerSuccess') return null;
  if (outer.type === 'txFeeBumpInnerFailed') {
    return bodyCode(outer.innerResultPair.result.result) ?? 'tx_fee_bump_inner_failed';
  }
  return bodyCode(outer);
};

const accountOf = (muxed: xdr.MuxedAccount): string =>
  muxed.type === 'keyTypeEd25519'
    ? StrKey.encodeEd25519PublicKey(Buffer.from(muxed.ed25519.value))
    : StrKey.encodeEd25519PublicKey(Buffer.from(muxed.med25519.ed25519.value));

export const envelopeSource = (envelopeXdr: string): { source: string; feeBump: boolean } => {
  const envelope = xdr.TransactionEnvelope.fromXdr(envelopeXdr, 'base64');
  switch (envelope.type) {
    case 'envelopeTypeTxFeeBump':
      return { source: accountOf(envelope.feeBump.tx.innerTx.v1.tx.sourceAccount), feeBump: true };
    case 'envelopeTypeTx':
      return { source: accountOf(envelope.v1.tx.sourceAccount), feeBump: false };
    default:
      return {
        source: StrKey.encodeEd25519PublicKey(
          Buffer.from(envelope.v0.tx.sourceAccountEd25519.value),
        ),
        feeBump: false,
      };
  }
};
