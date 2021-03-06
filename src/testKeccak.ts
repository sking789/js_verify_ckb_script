import * as chain from './config/chain';

import CKB from '@nervosnetwork/ckb-sdk-core';
import { Deployer } from './deployer';
import {
  privateKeyToPublicKey,
  scriptToHash,
  privateKeyToAddress,
  AddressPrefix,
  AddressType,
  parseAddress,
  toHexInLittleEndian,
} from '@nervosnetwork/ckb-sdk-utils';
import blake160 from '@nervosnetwork/ckb-sdk-utils/lib/crypto/blake160';

import * as EthLib from 'eth-lib';
import { Secp256Keccak } from './lock/secp256Keccak';
import { toHex, hexToNumber } from 'web3-utils';

const ckb = new CKB(process.env.NODE_URL);
const pubKeyHash = `0x${blake160(privateKeyToPublicKey(chain.privateKey1), 'hex')}`;

console.log('pubKeyHash is', pubKeyHash);

async function getUnspentCell(lockHash: string): Promise<CachedCell[]> {
  const unspentCells = await ckb.loadCells({ lockHash });

  return unspentCells;
}

function changeOutputLock(tx: CKBComponents.RawTransactionToSign, oldLockHash: string, newLock: CKBComponents.Script) {
  for (const output of tx.outputs) {
    if (scriptToHash(output.lock) === oldLockHash) {
      output.lock = newLock;
    }
  }
}
async function sendCKBToKeccakLock() {
  const secp256k1Dep = await ckb.loadSecp256k1Dep();
  const from = privateKeyToAddress(chain.privateKey1, {
    prefix: AddressPrefix.Testnet,
    type: AddressType.HashIdx,
    codeHashOrCodeHashIndex: '0x00',
  });

  const to = privateKeyToAddress(chain.privateKey2, {
    prefix: AddressPrefix.Testnet,
    type: AddressType.HashIdx,
    codeHashOrCodeHashIndex: '0x00',
  });
  const toEthAddress = EthLib.Account.fromPrivate(chain.privateKey2).address;
  const capacity = 1000000;

  const inputLockHash = scriptToHash({
    codeHash: chain.blockAssemblerCode,
    hashType: 'type',
    args: `0x${parseAddress(from, 'hex').slice(6)}`,
  });
  const unspentCells = await getUnspentCell(inputLockHash);

  const rawTx = ckb.generateRawTransaction({
    fromAddress: from,
    toAddress: to,
    capacity: BigInt(capacity * 10 ** 8),
    fee: BigInt(100000),
    cells: unspentCells,
    deps: secp256k1Dep,
    safeMode: true,
  });

  const oldOutputLock: CKBComponents.Script = {
    codeHash: chain.blockAssemblerCode,
    hashType: 'type',
    args: `0x${parseAddress(to, 'hex').slice(6)}`,
  };
  const oldOutputLockHash = scriptToHash(oldOutputLock);
  const newOutputLock: CKBComponents.Script = {
    codeHash: scriptToHash(chain.keccak256LockCell.type),
    hashType: 'type',
    args: toEthAddress,
  };
  changeOutputLock(rawTx, oldOutputLockHash, newOutputLock);

  rawTx.witnesses = rawTx.inputs.map(() => '0x');
  rawTx.witnesses[0] = { lock: '', inputType: '', outputType: '' };
  const signedTx = ckb.signTransaction(chain.privateKey1)(rawTx, []);
  const realTxHash = await ckb.rpc.sendTransaction(signedTx);
  console.log(`The real transaction hash is: ${realTxHash}`);
}

async function sendCKBToKeccakLockWithSince() {
  const secp256k1Dep = await ckb.loadSecp256k1Dep();
  const from = privateKeyToAddress(chain.privateKey1, {
    prefix: AddressPrefix.Testnet,
    type: AddressType.HashIdx,
    codeHashOrCodeHashIndex: '0x00',
  });

  const to = privateKeyToAddress(chain.privateKey2, {
    prefix: AddressPrefix.Testnet,
    type: AddressType.HashIdx,
    codeHashOrCodeHashIndex: '0x00',
  });
  const toEthAddress = EthLib.Account.fromPrivate(chain.privateKey2).address;
  const capacity = 100;

  const inputLockHash = scriptToHash({
    codeHash: chain.blockAssemblerCode,
    hashType: 'type',
    args: `0x${parseAddress(from, 'hex').slice(6)}`,
  });
  const unspentCells = await getUnspentCell(inputLockHash);

  const rawTx = ckb.generateRawTransaction({
    fromAddress: from,
    toAddress: to,
    capacity: BigInt(capacity * 10 ** 8),
    fee: BigInt(100000),
    cells: unspentCells,
    deps: secp256k1Dep,
    safeMode: true,
  });

  const oldOutputLock: CKBComponents.Script = {
    codeHash: chain.blockAssemblerCode,
    hashType: 'type',
    args: `0x${parseAddress(to, 'hex').slice(6)}`,
  };
  const oldOutputLockHash = scriptToHash(oldOutputLock);
  const newOutputLock: CKBComponents.Script = {
    codeHash: scriptToHash(chain.keccak256LockCell.type),
    hashType: 'type',
    args: toEthAddress,
  };
  changeOutputLock(rawTx, oldOutputLockHash, newOutputLock);

  const flag = (0 << 5) | (0 << 7);
  const blockNumber = hexToNumber(await ckb.rpc.getTipBlockNumber()) + 10;
  console.log('flag', flag);
  console.log('timestamp', blockNumber);
  const sinceInt = (flag << 56) | blockNumber;

  const since = toHex(sinceInt);

  // toHexInLittleEndian()

  rawTx.inputs[0].since = since;
  console.log('since', since);

  rawTx.witnesses = rawTx.inputs.map(() => '0x');
  rawTx.witnesses[0] = { lock: '', inputType: '', outputType: '' };
  const signedTx = ckb.signTransaction(chain.privateKey1)(rawTx, []);
  const realTxHash = await ckb.rpc.sendTransaction(signedTx);
  console.log(`The real transaction hash is: ${realTxHash}`);
}

async function sendCKBFromKeccakLock() {
  const secp256k1Dep = await ckb.loadSecp256k1Dep();
  const from = privateKeyToAddress(chain.privateKey2, {
    prefix: AddressPrefix.Testnet,
    type: AddressType.HashIdx,
    codeHashOrCodeHashIndex: '0x00',
  });
  const to = privateKeyToAddress(chain.privateKey1, {
    prefix: AddressPrefix.Testnet,
    type: AddressType.HashIdx,
    codeHashOrCodeHashIndex: '0x00',
  });
  const fromEthAddress = EthLib.Account.fromPrivate(chain.privateKey2).address;
  const capacity = 100000;

  const inputLockHash = scriptToHash({
    codeHash: scriptToHash(chain.keccak256LockCell.type),
    hashType: 'type',
    args: fromEthAddress,
  });
  const unspentCells = await getUnspentCell(inputLockHash);

  const rawTx = ckb.generateRawTransaction({
    fromAddress: from,
    toAddress: to,
    capacity: BigInt(capacity * 10 ** 8),
    fee: BigInt(100000),
    cells: unspentCells,
    deps: secp256k1Dep,
    safeMode: true,
  });

  const oldOutputLock: CKBComponents.Script = {
    codeHash: chain.blockAssemblerCode,
    hashType: 'type',
    args: `0x${parseAddress(from, 'hex').slice(6)}`,
  };
  const oldOutputLockHash = scriptToHash(oldOutputLock);
  const newOutputLock: CKBComponents.Script = {
    codeHash: scriptToHash(chain.keccak256LockCell.type),
    hashType: 'type',
    args: fromEthAddress,
  };
  changeOutputLock(rawTx, oldOutputLockHash, newOutputLock);

  rawTx.cellDeps.push({ outPoint: chain.keccak256LockCell.outPoint, depType: 'code' });

  rawTx.witnesses = rawTx.inputs.map(() => '0x');
  rawTx.witnesses[0] = { lock: '', inputType: '', outputType: '' };

  const signedTx = new Secp256Keccak(ckb).signETHTransaction(unspentCells, rawTx, chain.privateKey2, true);

  const realTxHash = await ckb.rpc.sendTransaction(signedTx);
  console.log(`The real transaction hash is: ${realTxHash}`);
}

async function sendCKBToAddress(to: string) {
  const secp256k1Dep = await ckb.loadSecp256k1Dep();
  const from = privateKeyToAddress(chain.privateKey1, {
    prefix: AddressPrefix.Testnet,
    type: AddressType.HashIdx,
    codeHashOrCodeHashIndex: '0x00',
  });

  const capacity = 100000;

  const inputLockHash = scriptToHash({
    codeHash: chain.blockAssemblerCode,
    hashType: 'type',
    args: `0x${parseAddress(from, 'hex').slice(6)}`,
  });
  const unspentCells = await getUnspentCell(inputLockHash);

  const rawTx = ckb.generateRawTransaction({
    fromAddress: from,
    toAddress: to,
    capacity: BigInt(capacity * 10 ** 8),
    fee: BigInt(100000),
    cells: unspentCells,
    deps: secp256k1Dep,
    safeMode: true,
  });

  rawTx.witnesses = rawTx.inputs.map(() => '0x');
  rawTx.witnesses[0] = { lock: '', inputType: '', outputType: '' };
  const signedTx = ckb.signTransaction(chain.privateKey1)(rawTx, []);
  const realTxHash = await ckb.rpc.sendTransaction(signedTx);
  console.log(`The real transaction hash is: ${realTxHash}`);
}

async function testPwCore() {
  let rawTx: CKBComponents.RawTransactionToSign = {
    version: '0x0',
    cellDeps: [
      {
        outPoint: {
          txHash: '0xa563884b3686078ec7e7677a5f86449b15cf2693f3c1241766c6996f206cc541',
          index: '0x3',
        },
        depType: 'code',
      },
      {
        outPoint: {
          txHash: '0x7822910729c566c0f8a3f4bb9aee721c5da2808f9a4688e909c0119b0ab820d7',
          index: '0x0',
        },
        depType: 'code',
      },
    ],
    headerDeps: [],
    inputs: [
      {
        since: '0x0',
        previousOutput: {
          txHash: '0x40b2fa274a67092d735553187aa23861bdd2a91d5282d1571776afed3e8a873b',
          index: '0x0',
        },
      },
    ],
    outputs: [
      {
        capacity: '0x2540be400',
        lock: {
          codeHash: '0xc9eb3097397836e4d5b8fabed3c0cddd14fefe483caf238ca2e3095a111add0b',
          hashType: 'type',
          args: '0x26c5f390ff2033cbb44377361c63a3dd2de3121d',
        },
      },
      {
        capacity: '0x915fa66ba0f',
        lock: {
          codeHash: '0xc9eb3097397836e4d5b8fabed3c0cddd14fefe483caf238ca2e3095a111add0b',
          hashType: 'type',
          args: '0x26c5f390ff2033cbb44377361c63a3dd2de3121d',
        },
      },
    ],
    outputsData: ['0x', '0x'],
    witnesses: [
      '0x5500000010000000550000005500000041000000b8f2ae75e6e31eca6d6eee8b51557ef4d83efd577f69d8970351000d41fc51441dce45998bead154cb5e60f19943e213391f26a24af737d4f855a819ce4bcc8200',
    ],
  };
  rawTx.witnesses = rawTx.inputs.map(() => '0x');
  rawTx.witnesses[0] = { lock: '', inputType: '', outputType: '' };
  const signedTx = new Secp256Keccak(ckb).signETHTransaction([], rawTx, chain.privateKey2, false);
  console.log('signedTx', signedTx.witnesses[0]);
}

// sendCKBToKeccakLock();
// sendCKBFromKeccakLock();
// sendCKBToKeccakLockWithSince();

testPwCore();

// sendCKBToAddress('ckt1qyqfvmjsfgyd4np4vddlp48y6er868hgkh0q6kk56f');
