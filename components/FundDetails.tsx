'use client';

import { useState, useEffect } from 'react';
import { useAccount } from '../lib/web3-context';
import { ethers } from 'ethers';
import { DENOMINATION_ASSETS } from '../lib/contracts';
import { FundService } from '../lib/fund-service';
import { fundDatabaseService, FundData, InvestmentRecord } from '../lib/fund-database-service';
import { useTransactionNotification, useSuccessNotification, useErrorNotification } from './ui/NotificationSystem';
import { Line } from 'react-chartjs-2';
import { Chart, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js';

interface FundDetailsProps {
  fundId: string;
}
Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);
export default function FundDetails({ fundId }: FundDetailsProps) {
  const { address, isConnected } = useAccount();
  const [fund, setFund] = useState<FundData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [redemptionAmount, setRedemptionAmount] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isInvesting, setIsInvesting] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [userShares, setUserShares] = useState('0');
  const [tokenBalance, setTokenBalance] = useState('0');
  const [allowance, setAllowance] = useState('0');
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);

  // 新增：基金統計數據狀態
  const [fundStats, setFundStats] = useState<{
    totalAssets: string;
    totalInvestors: number;
    currentSharePrice: string;
  }>({
    totalAssets: '0.00',
    totalInvestors: 0,
    currentSharePrice: '1.00'
  });

  // 新增：用戶投資歷史狀態
  const [userInvestmentSummary, setUserInvestmentSummary] = useState<{
    totalDeposited: string;
    totalRedeemed: string;
    currentShares: string;
    currentValue: string;
    totalReturn: string;
    returnPercentage: string;
  } | null>(null);

  // Notification hooks
  const showTransactionNotification = useTransactionNotification();
  const showSuccessNotification = useSuccessNotification();
  const showErrorNotification = useErrorNotification();
  const [fundInvestmentHistory, setFundInvestmentHistory] = useState<InvestmentRecord[]>([]);

  useEffect(() => {
    loadFundData();
  }, [fundId]);

  useEffect(() => {
    if (isConnected && address && fund && window.ethereum) {
      loadUserData();
    }
  }, [isConnected, address, fund]);

  const loadFundData = async () => {
    setIsLoading(true);
    try {
      // 根據 fundId 從資料庫載入基金數據
      const fundData = await fundDatabaseService.getFundByVaultAddress(fundId) || 
                        await fundDatabaseService.getAllFunds().then(funds => funds.find(f => f.id === fundId));
      
      if (fundData) {
        setFund(fundData);

        // 載入基金統計數據
        try {
          const stats = await fundDatabaseService.getFundStatistics(fundData.id);
          setFundStats({
            totalAssets: stats.totalAssets,
            totalInvestors: stats.totalInvestors,
            currentSharePrice: stats.currentSharePrice
          });
        } catch (statsError) {
          console.warn('Failed to load fund statistics:', statsError);
        }

      } else {
        console.error(`Fund with ID ${fundId} not found`);
      }
    } catch (error) {
      console.error('Error loading fund data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const denominationAsset = DENOMINATION_ASSETS.find(
    asset => fund && asset.address === fund.denominationAsset
  ) || DENOMINATION_ASSETS[0];

  const loadUserData = async () => {
    if (!fund) return;
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const fundService = new FundService(provider);

      // 獲取代幣的小數位數
      if (denominationAsset.address) {
        const token = new ethers.Contract(denominationAsset.address, [
          'function decimals() view returns (uint8)'
        ], provider);
        const decimals = await token.decimals();
        setTokenDecimals(decimals);
        console.log('Token decimals loaded:', decimals);
      }

      if (fund.vaultProxy && address) {
        const shares = await fundService.getUserBalance(fund.vaultProxy, address);
        setUserShares(shares);
        console.log('User shares loaded:', shares);
      }

      if (denominationAsset.address && address) {
        const balance = await fundService.getTokenBalance(denominationAsset.address, address);
        setTokenBalance(balance);
        console.log('Token balance loaded:', balance);

        if (fund.comptrollerProxy) {
          const allowanceAmount = await fundService.getTokenAllowance(
            denominationAsset.address,
            address,
            fund.comptrollerProxy
          );
          setAllowance(allowanceAmount);
          console.log('Token allowance loaded:', allowanceAmount);
        }
      }

      try {
        const fundHistory = await fundDatabaseService.getFundInvestmentHistory(fund.id);

        setFundInvestmentHistory(fundHistory);
        
      } catch (error) {
        console.warn('Failed to load investment records:', error);
      }

      // 載入用戶投資摘要
      if (address) {
        try {
          const summary = await fundDatabaseService.getUserInvestmentSummary(fund.id, address);
          setUserInvestmentSummary(summary);
          console.log('User investment summary loaded:', summary);
        } catch (summaryError) {
          console.warn('Failed to load user investment summary:', summaryError);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleApprove = async () => {
    if (!isConnected || !window.ethereum || !investmentAmount || !fund) return;

    setIsApproving(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const fundService = new FundService(provider);

      const txHash = await fundService.approveToken(
        denominationAsset.address,
        fund.comptrollerProxy,
        investmentAmount
      );

      showSuccessNotification(
        '授權成功',
        `已授權 ${investmentAmount} ${denominationAsset.symbol}`,
        {
          label: '查看交易',
          onClick: () => window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank')
        }
      );
      await loadUserData();
    } catch (error: any) {
      console.error('Approval failed:', error);
      showErrorNotification(
        '授權失敗',
        error.message || '授權過程中發生錯誤，請稍後重試'
      );
    } finally {
      setIsApproving(false);
    }
  };

  const handleInvest = async () => {
    if (!isConnected || !window.ethereum || !investmentAmount || !fund || !address) return;

    // 檢查投資金額是否超過用戶餘額 - 使用正確的小數位數進行精確比較
    const investAmountWei = ethers.parseUnits(investmentAmount, tokenDecimals);
    const userTokenBalanceWei = ethers.parseUnits(tokenBalance, tokenDecimals);
    
    if (investAmountWei > userTokenBalanceWei) {
      showErrorNotification(
        '餘額不足',
        `您的 ${denominationAsset.symbol} 餘額不足。可用餘額: ${parseFloat(tokenBalance).toFixed(6)}，需要: ${parseFloat(investmentAmount).toFixed(6)}`
      );
      return;
    }

    // 檢查是否需要授權且授權額度不足 - 使用正確的小數位數進行精確比較
    const allowanceWei = ethers.parseUnits(allowance, tokenDecimals);
    if (investAmountWei > allowanceWei) {
      showErrorNotification(
        '需要授權',
        `授權額度不足。已授權: ${parseFloat(allowance).toFixed(6)}，需要: ${parseFloat(investmentAmount).toFixed(6)}，請先授權 ${denominationAsset.symbol} 代幣`
      );
      return;
    }

    setIsInvesting(true);
    let notificationId;
    
    try {
      // Show pending transaction notification
      notificationId = showTransactionNotification('pending', undefined, investmentAmount, fund.fundName);
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const fundService = new FundService(provider);

      // 執行投資交易
      const txHash = await fundService.buyShares(
        fund.comptrollerProxy,
        investmentAmount
      );

      // Show success notification
      showTransactionNotification('success', txHash, investmentAmount, fund.fundName);

      // 記錄投資到資料庫
      try {
        const sharePrice = fundStats.currentSharePrice || '1.00';
        const shares = (parseFloat(investmentAmount) / parseFloat(sharePrice)).toString();
        
        await fundDatabaseService.recordInvestment({
          fundId: fund.id,
          investorAddress: address,
          type: 'deposit',
          amount: investmentAmount,
          shares: shares,
          sharePrice: sharePrice,
          txHash: txHash
        });
        
        console.log('Investment recorded to database');
        
        // 重新載入基金統計數據
        const updatedStats = await fundDatabaseService.getFundStatistics(fund.id);
        setFundStats({
          totalAssets: updatedStats.totalAssets,
          totalInvestors: updatedStats.totalInvestors,
          currentSharePrice: updatedStats.currentSharePrice
        });
      } catch (dbError) {
        console.warn('Failed to record investment to database:', dbError);
      }
      
      showSuccessNotification(
        '投資成功',
        `您已成功投資 ${investmentAmount} ${denominationAsset.symbol}`,
        {
          label: '查看交易',
          onClick: () => window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank')
        }
      );
      
      setInvestmentAmount('');
      await loadUserData();
    } catch (error: any) {
      console.error('Investment failed:', error);
      showTransactionNotification('error');
      
      // 解析不同類型的錯誤
      let errorMessage = '交易處理時發生錯誤，請稍後重試';
      
      if (error.message) {
        if (error.message.includes('ERC20: transfer amount exceeds balance')) {
          errorMessage = `代幣餘額不足。請確認您有足夠的 ${denominationAsset.symbol} 餘額`;
        } else if (error.message.includes('ERC20: insufficient allowance')) {
          errorMessage = `授權額度不足。請重新授權 ${denominationAsset.symbol} 代幣`;
        } else if (error.message.includes('User rejected')) {
          errorMessage = '用戶取消了交易';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'ETH 餘額不足以支付 gas 費用';
        } else if (error.message.includes('execution reverted')) {
          errorMessage = '智能合約執行失敗，請檢查交易參數';
        }
      }
      
      showErrorNotification('投資失敗', errorMessage);
    } finally {
      setIsInvesting(false);
    }
  };

  const handleRedeem = async () => {
    if (!isConnected || !window.ethereum || !redemptionAmount || !fund || !address) return;

    // 檢查贖回份額是否超過用戶持有量 - 使用 BigInt 進行精確比較
    const redeemAmountWei = ethers.parseEther(redemptionAmount);
    const userSharesWei = ethers.parseEther(userShares);
    
    if (redeemAmountWei > userSharesWei) {
      showErrorNotification(
        '份額不足',
        `您的基金份額不足。可贖回份額: ${parseFloat(userShares).toFixed(6)}，嘗試贖回: ${parseFloat(redemptionAmount).toFixed(6)}`
      );
      return;
    }

    setIsRedeeming(true);
    
    try {
      // Show pending transaction notification
      showTransactionNotification('pending', undefined, redemptionAmount, fund.fundName);
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const fundService = new FundService(provider);

      // 執行贖回交易
      const txHash = await fundService.redeemShares(
        fund.comptrollerProxy,
        redemptionAmount
      );

      // 記錄贖回到資料庫
      try {
        const sharePrice = fundStats.currentSharePrice || '1.00';
        const redeemAmount = (parseFloat(redemptionAmount) * parseFloat(sharePrice)).toString();
        
        await fundDatabaseService.recordInvestment({
          fundId: fund.id,
          investorAddress: address,
          type: 'redeem',
          amount: redeemAmount,
          shares: redemptionAmount,
          sharePrice: sharePrice,
          txHash: txHash
        });
        
        console.log('Redemption recorded to database');
        
        // 重新載入基金統計數據
        const updatedStats = await fundDatabaseService.getFundStatistics(fund.id);
        setFundStats({
          totalAssets: updatedStats.totalAssets,
          totalInvestors: updatedStats.totalInvestors,
          currentSharePrice: updatedStats.currentSharePrice
        });
      } catch (dbError) {
        console.warn('Failed to record redemption to database:', dbError);
      }

      // Show success notification
      showSuccessNotification(
        '贖回成功',
        `您已成功贖回 ${redemptionAmount} 份額`,
        {
          label: '查看交易',
          onClick: () => window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank')
        }
      );
      
      setRedemptionAmount('');
      await loadUserData();
    } catch (error: any) {
      console.error('Redemption failed:', error);
      
      // 解析不同類型的錯誤
      let errorMessage = '交易處理時發生錯誤，請稍後重試';
      
      if (error.message) {
        if (error.message.includes('ERC20: burn amount exceeds balance')) {
          errorMessage = `基金份額不足。請確認您有足夠的基金份額進行贖回`;
        } else if (error.message.includes('User rejected')) {
          errorMessage = '用戶取消了交易';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'ETH 餘額不足以支付 gas 費用';
        } else if (error.message.includes('execution reverted')) {
          errorMessage = '智能合約執行失敗，請檢查交易參數';
        }
      }
      
      showErrorNotification('贖回失敗', errorMessage);
    } finally {
      setIsRedeeming(false);
    }
  };

  // 使用正確的代幣小數位數進行精確的數值比較
  const needsApproval = investmentAmount ? 
    ethers.parseUnits(investmentAmount, tokenDecimals) > ethers.parseUnits(allowance || '0', tokenDecimals) : false;
  const expectedShares = fund && investmentAmount ? 
    (parseFloat(investmentAmount) / parseFloat(fundStats.currentSharePrice || '1')).toFixed(4) : '0.00';
  
  // 檢查投資是否可用 - 使用正確的小數位數進行精確比較
  const canInvest = investmentAmount && 
                   parseFloat(investmentAmount) > 0 && 
                   (ethers.parseUnits(investmentAmount, tokenDecimals) <= ethers.parseUnits(tokenBalance || '0', tokenDecimals));
  
  // 檢查贖回是否可用 - 基金份額使用 18 位小數
  const canRedeem = redemptionAmount && 
                   parseFloat(redemptionAmount) > 0 && 
                   (ethers.parseEther(redemptionAmount) <= ethers.parseEther(userShares || '0'));

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="card max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">需要連接錢包</h2>
          <p className="text-gray-600 mb-6">請先連接您的錢包以查看基金詳情並進行投資</p>
          <div className="text-4xl mb-4">🔗</div>
        </div>
      </div>
    );
  }

  if (isLoading || !fund) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="card max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">載入中...</h2>
          <p className="text-gray-600">正在載入基金詳情</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 基金標題 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{fund.fundName}</h1>
          <p className="text-gray-600 mt-2">代號：{fund.fundSymbol} | 由 {fund.creator.slice(0, 10)}... 管理</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* 左側：基金詳情 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 基金概覽 */}
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-6">基金概覽</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">${fundStats.totalAssets}</p>
                  <p className="text-sm text-gray-600">總資產 (AUM)</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">${fundStats.currentSharePrice}</p>
                  <p className="text-sm text-gray-600">份額淨值</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{fundStats.totalInvestors}</p>
                  <p className="text-sm text-gray-600">投資人數</p>
                </div>
              </div>
            </div>

            {/* 基金資訊 */}
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-4">基金資訊</h2>
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">管理費</p>
                  <p className="font-medium">{(fund.managementFee / 100).toFixed(2)}% / 年</p>
                </div>
                <div>
                  <p className="text-gray-600">績效費</p>
                  <p className="font-medium">{(fund.performanceFee / 100).toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-gray-600">計價資產</p>
                  <p className="font-medium">{denominationAsset.symbol} - {denominationAsset.name}</p>
                </div>
                <div>
                  <p className="text-gray-600">創立日期</p>
                  <p className="font-medium">{new Date(fund.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* 您的持倉 */}
            {userInvestmentSummary && parseFloat(userInvestmentSummary.currentShares) > 0 && (
              <div className="card">
                <h2 className="text-xl font-bold text-gray-900 mb-4">您的持倉</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">持有份額</p>
                    <p className="text-xl font-bold text-gray-900">{parseFloat(userInvestmentSummary.currentShares).toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">當前價值</p>
                    <p className="text-xl font-bold text-gray-900">${userInvestmentSummary.currentValue}</p>
                  </div>
                  {/* <div>
                    <p className="text-sm text-gray-600">總收益</p>
                    <p className={`text-xl font-bold ${parseFloat(userInvestmentSummary.returnPercentage) >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                      {parseFloat(userInvestmentSummary.returnPercentage) >= 0 ? '+' : ''}${userInvestmentSummary.totalReturn} ({userInvestmentSummary.returnPercentage}%)
                    </p>
                  </div> */}
                  <div>
                    <p className="text-sm text-gray-600">淨投入</p>
                    <p className="text-xl font-bold text-gray-900">
                      ${(parseFloat(userInvestmentSummary.totalDeposited) - parseFloat(userInvestmentSummary.totalRedeemed)).toFixed(5)}
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">總投入</p>
                      <p className="font-medium">${userInvestmentSummary.totalDeposited}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">總贖回</p>
                      <p className="font-medium">${userInvestmentSummary.totalRedeemed}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">投資佔比</p>
                      <p className="font-medium">
                        {fundStats.totalAssets && parseFloat(fundStats.totalAssets) > 0 ? 
                          ((parseFloat(userInvestmentSummary.currentValue) / parseFloat(fundStats.totalAssets)) * 100).toFixed(4) 
                          : '0.00'}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-6">基金投資記錄</h2>
              <div className="space-y-3">
                {fundInvestmentHistory.length > 0 ? (
                  fundInvestmentHistory.slice(0, 10).map((record, index) => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">
                          {record.type === 'deposit' ? '投資人申購' : '投資人贖回'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(record.timestamp).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {record.investorAddress.substring(0, 6)}...{record.investorAddress.substring(38)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${record.type === 'deposit' ? 'text-success-600' : 'text-danger-600'}`}>
                          {record.type === 'deposit' ? '+' : '-'}${parseFloat(record.amount).toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-600">
                          {parseFloat(record.shares).toFixed(4)} 份額
                        </p>
                        <p className="text-xs text-gray-500">
                          ${parseFloat(record.sharePrice).toFixed(4)}/份額
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📊</div>
                    <p>暫無投資記錄</p>
                    <p className="text-sm mt-1">投資記錄會在有申購或贖回活動後顯示</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右側：交易面板 */}
          <div className="space-y-6">
            {/* 投資面板 */}
            <div className="card">
              <h3 className="text-lg font-bold text-gray-900 mb-4">投資基金</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    投資金額 ({denominationAsset.symbol})
                  </label>
                  <input
                    type="number"
                    value={investmentAmount}
                    onChange={(e) => setInvestmentAmount(e.target.value)}
                    placeholder="請輸入投資金額"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    可用餘額: {parseFloat(tokenBalance).toFixed(5)} {denominationAsset.symbol}
                  </p>
                </div>

                {investmentAmount && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">預計獲得份額</p>
                    <p className="font-medium">{expectedShares} 份</p>
                    {investmentAmount && tokenBalance && 
                     ethers.parseUnits(investmentAmount, tokenDecimals) > ethers.parseUnits(tokenBalance, tokenDecimals) && (
                      <p className="text-sm text-red-600 mt-1">⚠️ 餘額不足</p>
                    )}
                    {needsApproval && (
                      <p className="text-sm text-yellow-600 mt-1">⚠️ 需要先授權代幣</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      代幣小數位數: {tokenDecimals}
                    </p>
                  </div>
                )}

                {/* {needsApproval ? ( */}
                  <button
                    onClick={handleApprove}
                    disabled={isApproving || !canInvest}
                    className="w-full btn-secondary disabled:opacity-50"
                  >
                    {isApproving && <div className="loading-spinner mr-2"></div>}
                    {isApproving ? '授權中...' : `授權 ${denominationAsset.symbol}`}
                  </button>
                {/* ) : ( */}
                  <button
                    onClick={handleInvest}
                    disabled={isInvesting || !canInvest}
                    className="w-full btn-success disabled:opacity-50"
                  >
                    {isInvesting && <div className="loading-spinner mr-2"></div>}
                    {isInvesting ? '投資中...' : '投資基金'}
                  </button>
                {/* )} */}
              </div>
            </div>

            {/* 贖回面板 */}
              <div className="card">
                <h3 className="text-lg font-bold text-gray-900 mb-4">贖回份額</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      贖回份額
                    </label>
                    <input
                      type="number"
                      value={redemptionAmount}
                      onChange={(e) => setRedemptionAmount(e.target.value)}
                      placeholder="請輸入贖回份額"
                      max={userShares}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      可贖回份額: {parseFloat(userShares).toFixed(5)}
                    </p>
                  </div>

                  {redemptionAmount && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">預計獲得金額</p>
                      <p className="font-medium">
                        ${(parseFloat(redemptionAmount) * parseFloat(fundStats.currentSharePrice || '1')).toFixed(2)} {denominationAsset.symbol}
                      </p>
                      {redemptionAmount && userShares && 
                       ethers.parseEther(redemptionAmount) > ethers.parseEther(userShares) && (
                        <p className="text-sm text-red-600 mt-1">⚠️ 份額不足</p>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleRedeem}
                    disabled={isRedeeming || !canRedeem}
                    className="w-full btn-danger disabled:opacity-50"
                  >
                    {isRedeeming && <div className="loading-spinner mr-2"></div>}
                    {isRedeeming ? '贖回中...' : '贖回份額'}
                  </button>
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
