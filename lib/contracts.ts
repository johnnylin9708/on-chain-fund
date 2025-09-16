import { ethers } from 'ethers';

export const FUND_FACTORY_ADDRESS = '0x9D2C19a267caDA33da70d74aaBF9d2f75D3CdC14';

// Token addresses for Sepolia testnet
export const TOKEN_ADDRESSES = {
    ASVT: '0x932b08d5553b7431FB579cF27565c7Cd2d4b8fE0', // 正確的 ASVT 地址
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC
    WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', // Sepolia WETH
};

// 可選擇的計價資產
export const DENOMINATION_ASSETS = [
    {
        symbol: 'ASVT',
        name: 'ASVT Token',
        address: TOKEN_ADDRESSES.ASVT,
        icon: '🪙',
        decimals: 18
    },
    {
        symbol: 'USDC',
        name: 'USD Coin',
        address: TOKEN_ADDRESSES.USDC,
        icon: '💰',
        decimals: 6
    },
    {
        symbol: 'WETH',
        name: 'Wrapped Ether',
        address: TOKEN_ADDRESSES.WETH,
        icon: '⚡',
        decimals: 18
    }
];

// 使用 ASVT 作為默認計價資產
export const DEFAULT_DENOMINATION_ASSET = TOKEN_ADDRESSES.ASVT;

// 正確的 Human-Readable ABIs - 根據實際合約源碼
export const FUND_FACTORY_ABI = [
    'function createNewFund(address fundOwner, string fundName, string fundSymbol, address denominationAsset, uint256 sharesActionTimelock, bytes feeManagerConfigData, bytes policyManagerConfigData) returns (address comptrollerProxy, address vaultProxy)',
    // 正確的事件定義
    'event NewFundCreated(address indexed creator, address vaultProxy, address comptrollerProxy)'
];

export const VAULT_PROXY_ABI = [
    'function getAccessor() view returns (address)',
    'function balanceOf(address account) view returns (uint256)',
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function totalSupply() view returns (uint256)'
];

export const COMPTROLLER_ABI = [
    'function calcGav() view returns (uint256)',
    'function calcGrossShareValue() view returns (uint256)',
    'function buyShares(uint256 investmentAmount, uint256 minSharesQuantity)',
    'function getDenominationAsset() view returns (address)',
    'function redeemSharesInKind(address receiver, uint256 shareQuantity, address[] assetsToRedeem, address[] assetReceivers)'
];

export const ERC20_ABI = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address account) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transfer(address to, uint256 amount) returns (bool)'
];

export const addressListRegistryABI = [
    "function createList(address creator, uint8 updateType, address[] addresses) external returns (uint256)"
]

// export const addressListRegistryABI = [
//   {
//     "inputs": [
//       {
//         "internalType": "address",
//         "name": "_owner",
//         "type": "address"
//       },
//       {
//         "internalType": "enum IAddressListRegistry.UpdateType",
//         "name": "_updateType",
//         "type": "uint8"
//       },
//       {
//         "internalType": "address[]",
//         "name": "_initialItems",
//         "type": "address[]"
//       }
//     ],
//     "name": "createList",
//     "outputs": [
//       {
//         "internalType": "uint256",
//         "name": "id_",
//         "type": "uint256"
//       }
//     ],
//     "stateMutability": "nonpayable",
//     "type": "function"
//   },
//   {
//     "anonymous": false,
//     "inputs": [
//       {
//         "indexed": true,
//         "internalType": "address",
//         "name": "caller",
//         "type": "address"
//       },
//       {
//         "indexed": false,
//         "internalType": "address",
//         "name": "owner",
//         "type": "address"
//       },
//       {
//         "indexed": false,
//         "internalType": "uint256",
//         "name": "id",
//         "type": "uint256"
//       },
//       {
//         "indexed": false,
//         "internalType": "enum IAddressListRegistry.UpdateType",
//         "name": "updateType",
//         "type": "uint8"
//       }
//     ],
//     "name": "ListCreated",
//     "type": "event"
//   }
// ];

// 工具函數：格式化代幣金額顯示
export const formatTokenAmount = (amount: string | number | undefined, decimals = 18): string => {
  if (!amount || amount === '0' || amount === '0.0' || amount === '') {
    return '0';
  }
  
  try {
    // 如果是字符串且包含小數點，直接格式化
    if (typeof amount === 'string' && amount.includes('.')) {
      return parseFloat(amount).toFixed(6);
    }
    
    // 如果是純整數字符串，使用 ethers.formatEther
    if (typeof amount === 'string' && /^\d+$/.test(amount)) {
      return parseFloat(ethers.formatEther(amount)).toFixed(6);
    }
    
    // 如果是數字
    if (typeof amount === 'number') {
      return amount.toFixed(6);
    }
    
    return '0';
  } catch (error) {
    console.error('Format token amount error:', error, 'amount:', amount);
    return '0';
  }
};

// 工具函數：解析輸入金額為 BigInt (用於合約調用)
export const parseTokenAmount = (amount: string, decimals = 18): bigint => {
  if (!amount || amount === '0' || amount === '0.0' || amount === '') {
    return BigInt(0);
  }
  
  try {
    return ethers.parseUnits(amount.toString(), decimals);
  } catch (error) {
    console.error('Parse token amount error:', error, 'amount:', amount);
    return BigInt(0);
  }
};
