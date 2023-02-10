import React from 'react';
import { Form, Panel } from 'rsuite';
import { useParams } from "react-router-dom";
import { 
  getDateByTx, 
  getState, 
  getContractTxInfo, 
  getName, 
  getTarget, 
  getBalance, 
  isWellFormattedAddress,
  transfer
} from '../lib/api';
import { PageLoading } from './PageLoading/PageLoading';
import { mul, pow } from '../lib/math';
import LinkIcon from '@rsuite/icons/legacy/ExternalLink';
import RefreshIcon from '@rsuite/icons/legacy/Refresh';
import { ConnectWallet } from './ConnectWallet/ConnectWallet';
import { SubmitButton } from './SubmitButton/SubmitButton';

const panelStyle = {
  color: 'white', 
  fontSize: '1.4em', 
  fontWeight: 700
};

const radioType = {fontSize: '1.2rem', color: 'white'};

export const TokenInfo = (props) => {
  const params = useParams();

  const [symbol, setSymbol] = React.useState();
  const [decimals, setDecimals] = React.useState(0);
  const [tokenInfoList, setTokenInfoList] = React.useState([]);
  const [balance, setBalance] = React.useState('N/A');
  const [refreshing, setRefreshing] = React.useState(false);
  const [target, setTarget] = React.useState('');
  const [amount, setAmount] = React.useState(0);

  React.useEffect(async () => {
    fetchBalance();
  }, [props.walletConnect]);

  const fetchBalance = async () => {
    if (refreshing) return;
    setRefreshing(true);
    getBalance(params.address).then(ret=>{
      setRefreshing(false);
      if (ret.status) {
        const balanceWithDecimals = mul(ret.result, pow(10, -decimals));
        setBalance(balanceWithDecimals);
      }
    });
  };
  
  const fetchTokenInfo = async () => {
    const tokenStateRet = await getState(params.address);
    if (tokenStateRet.status === false) {
      return {status: false, result: 'Fetch token info failed. Please check if token address is correct!'};
    }
    const tokenState = tokenStateRet.result;
    
    const contractInfo = (await getContractTxInfo(params.address)).result;
    const mintDate = await getDateByTx(params.address);
    const totalSupply = mul(tokenState.totalSupply, pow(10, -tokenState.decimals));

    const renderWalletAddress = async (address) => {
      let addressContent = address;

      // check if bind to a polaris name
      const polarisNameRet = await getName(address);
      if (polarisNameRet.status === true && 
          polarisNameRet.result !== undefined && 
          polarisNameRet.result !== null &&
          polarisNameRet.result.domain === 'wallet') {
        const domain = polarisNameRet.result.domain;
        const name = polarisNameRet.result.name;
        const polarisNameTargetRet = await getTarget(domain, name);
        if (polarisNameTargetRet.status === true && polarisNameTargetRet.result.target) {
          addressContent = 
            <a 
              href={`https://arweave.net/wbo15PDbhXjpGMSGV8wh-XhlfFgjXKOZPw-wvEE24xI/#/${domain}/${name}`}
            > 
              {`${name}.${domain}`} {<LinkIcon />}
            </a>;
        }
      }

      return addressContent;
    };

    const calcTop1Holdler = () => {
      let max = 0;
      let holdler = '';
      for (const addr in tokenState.balances) {
        if (Object.hasOwnProperty.call(tokenState.balances, addr)) {
          const balance = tokenState.balances[addr];
          if (balance > max) {
            max = balance;
            holdler = addr;
          }
        }
      }
      return {max, holdler};
    }

    const { max, holdler } = calcTop1Holdler();

    setSymbol(tokenState.symbol);
    setDecimals(tokenState.decimals);
    setTokenInfoList([
      {title: 'Token Name', content: tokenState.name}, 
      {title: 'Token Address', content: params.address}, 
      {title: 'Creator', content: await renderWalletAddress(contractInfo.owner_address)},
      {title: 'Decimals', content: tokenState.decimals !== undefined ? tokenState.decimals : 'Unknown'},
      {title: 'Mint Date', content: mintDate.status ? mintDate.result : 'Unknown'},
      {title: 'Total Supply', content: totalSupply},
      {title: 'Holdlers', content: Object.keys(tokenState.balances).length},
      // {title: 'Transactions', content: ''}, // TODO
      {title: 'Top 1 Holdler', content: 
        `${await renderWalletAddress(holdler)} (${(max/tokenState.totalSupply*100).toFixed(2)}%)`},
    ]);
    
    return {status: true, result: 'fetch token info secceeded!'};
  };

  const formOnchange = async (formValue) => {
    setTarget(formValue['target']);
    setAmount(formValue['amount']);
  };

  const onTransfer = async () => {
    var address;
    if (target.length > 0 && target[0] === '@') {
      const name = target.substring(1);
      const polarisTargetRet = await getTarget('wallet', name);
      if (!polarisTargetRet.status || 
          !polarisTargetRet.result ||
          !isWellFormattedAddress(polarisTargetRet.result.target)) {
        return {status: false, result:`Polaris name '${name}' is not point to a wallet!`};
      } else {
        address = polarisTargetRet.result.target;
      }
    } else {
      if (!isWellFormattedAddress(target)) {
        return {status: false, result:`Transaction ID you entered seems not valid!`};
      }
      address = target;
    }
    
    const plainAmount = mul(amount, pow(10, decimals)).toFixed(0);
    const ret = await transfer(address, plainAmount);
    await fetchBalance();

    return ret;
  };

  const renderTokenInfo = (title, content) => {
    return(
      <div style={{padding: '0.8rem'}}>
        <p style={{color: 'white', fontSize: '1rem', fontWeight: 300}}>{title}</p>
        <p style={{color: 'white', fontSize: '1.4rem', fontWeight: 500}}>{content}</p>
      </div>
    );
  };

  const renderTransfer = () => {
    return(
      <Form onChange={formOnchange}>
        <Form.Group controlId="target">
          <Form.ControlLabel>Target</Form.ControlLabel>
          <Form.Control name="target" />
          <Form.HelpText tooltip>Polaris name is supported. Format: '@PolarisName'(non-endings). e.g. @marslab</Form.HelpText>
        </Form.Group>

        <Form.Group controlId="amount">
          <Form.ControlLabel>Amount</Form.ControlLabel>
          <Form.Control name="amount" />
          <Form.HelpText>Your balance: {balance} ${symbol} <RefreshIcon onClick={fetchBalance} spin={refreshing} /> </Form.HelpText>
        </Form.Group>
        
        <Form.Group>
          <SubmitButton
            buttonText='Transfer'
            submitTask={onTransfer}
          />
        </Form.Group>
      </Form>
    );
  };

  if (tokenInfoList.length === 0 || symbol === undefined) {
    return (
      <PageLoading 
        submitTask={fetchTokenInfo}
      />
    );
  }

  return (
    <>
      <Panel 
        bordered 
        defaultExpanded 
        collapsible 
        header={<p style={panelStyle}>{`$${symbol}`} Info</p>}
      >
        {tokenInfoList.map((item) => renderTokenInfo(item.title, item.content))}
      </Panel>
      <Panel 
        bordered 
        defaultExpanded 
        collapsible 
        header={<p style={panelStyle}>Transfer</p>}
      >
        { props.walletConnect ? renderTransfer() : <ConnectWallet /> }
      </Panel>
    </>
  );
};