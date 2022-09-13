export interface PstState {
  type: string;
  maxSupply: number;
  ticker: string;
  name: string;
  owner: string;
  balances: {
    [address: string]: number;
  };
}

export interface PstAction {
  input: PstInput;
  caller: string;
}

export interface PstInput {
  function: PstFunction;
  target: string;
  qty: number;
}

export interface PstResult {
  target: string;
  ticker: string;
  balance: number;
}

export type PstFunction = 'transfer' | 'balance';

export type ContractResult = { state: PstState } | { result: PstResult };
