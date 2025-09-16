'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount } from '../lib/web3-context';
import { performanceService, PerformanceData } from '../lib/performance-service';
import { fundDatabaseService, FundData } from '../lib/fund-database-service';
import PerformanceChart from './ui/PerformanceChart';
import LoadingSpinner from './ui/LoadingSpinner';

interface ManagedFund {
  id: string;
  name: string;
  symbol: string;
  address: string; // vaultProxy 地址
  totalAssets: string;
  sharePrice: string;
  performance: string;
  performanceColor: string;
  investors: number;
  lastUpdated: number;
  // 來自資料庫的額外資料
  comptrollerProxy?: string;
  denominationAsset?: string;
  managementFee?: number;
  performanceFee?: number;
  creator?: string;
  txHash?: string;
  status?: string;
}

export default function ManagerDashboard() {
  const { address: walletAddress, isConnected } = useAccount();
  const [funds, setFunds] = useState<ManagedFund[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [realTimeUpdates, setRealTimeUpdates] = useState<Map<string, PerformanceData>>(new Map());
  const [selectedFund, setSelectedFund] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected && walletAddress) {
      loadFundData();
      setupRealTimeUpdates();
    }
  }, [isConnected, walletAddress]);

  const loadFundData = async () => {
    setIsLoading(true);
    try {
      console.log('Loading managed funds for address:', walletAddress);
      
      // 從資料庫載入基金資料
      const fundDataList = await fundDatabaseService.getFundsByCreator(walletAddress!);
      console.log('Loaded funds from database:', fundDataList);
      
      // 將資料庫資料轉換為 ManagedFund 格式
      const managedFunds = fundDataList.map((fund: FundData): ManagedFund => ({
          id: fund.id,
          name: fund.fundName,
          symbol: fund.fundSymbol,
          address: fund.vaultProxy, // 使用 vaultProxy 作為地址
          totalAssets: fund.totalAssets || '$0', // 如果沒有資料則顯示 $0
          sharePrice: fund.sharePrice || '$1.00', // 預設價格
          performance: '+0.00%', // 預設表現（可以後續從區塊鏈更新）
          performanceColor: 'text-success-600',
          investors: fund.totalInvestors || 0, // 預設投資人數
          lastUpdated: new Date(fund.updatedAt || fund.createdAt).getTime(),
          // 額外的資料庫資料
          comptrollerProxy: fund.comptrollerProxy,
          denominationAsset: fund.denominationAsset,
          managementFee: fund.managementFee,
          performanceFee: fund.performanceFee,
          creator: fund.creator,
          txHash: fund.txHash,
          status: fund.status
        }));

      setFunds(managedFunds);
      console.log('Processed managed funds:', managedFunds);
      
    } catch (error) {
      console.error('Error loading fund data:', error);
      // 如果載入失敗，保持空陣列
      setFunds([]);
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealTimeUpdates = () => {
    const fundAddresses = funds.map(fund => fund.address);
    const cleanup = performanceService.startRealTimeUpdates(
      (updates) => {
        setRealTimeUpdates(new Map(updates));
        
        // Update funds with real-time data
        setFunds(currentFunds => 
          currentFunds.map(fund => {
            const update = updates.get(fund.address);
            if (update) {
              return {
                ...fund,
                sharePrice: `$${parseFloat(update.sharePrice).toFixed(4)}`,
                performance: `${update.priceChangePercentage24h >= 0 ? '+' : ''}${update.priceChangePercentage24h.toFixed(2)}%`,
                performanceColor: update.priceChangePercentage24h >= 0 ? 'text-success-600' : 'text-danger-600',
                totalAssets: `$${(parseFloat(update.sharePrice) * parseFloat(update.totalShares)).toFixed(0)}`,
                lastUpdated: Date.now()
              };
            }
            return fund;
          })
        );
      },
      fundAddresses
    );

    return cleanup;
  };

  // Calculate metrics from current fund data
  const calculateMetrics = () => {
    const totalAUM = funds.reduce((sum, fund) => {
      const assets = parseFloat(fund.totalAssets.replace(/[$,]/g, ''));
      return sum + assets;
    }, 0);

    const totalInvestors = funds.reduce((sum, fund) => sum + fund.investors, 0);

    return {
      totalAUM: `$${totalAUM.toLocaleString()}`,
      activeFunds: funds.length,
      totalInvestors,
      pendingActions: 1 // Mock pending actions
    };
  };

  const metrics = calculateMetrics();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 頁面標題 */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">基金經理儀表板</h1>
            <p className="text-gray-600 mt-2">總覽您所有基金的表現與狀態。</p>
          </div>
          <Link href="/manager/create" className="btn-success">
            創建新基金
          </Link>
        </div>

        {/* 指標卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* <div className="card">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-600">管理總資產 (AUM)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.totalAUM}</p>
                <p className="text-sm text-success-600 mt-1">+2.5% 近24小時</p>
              </div>
            </div>
          </div> */}

          <div className="card">
            <div>
              <p className="text-sm text-gray-600">旗下基金數量</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.activeFunds}</p>
              <p className="text-sm text-gray-600 mt-1">檔活躍基金</p>
            </div>
          </div>

          {/* <div className="card">
            <div>
              <p className="text-sm text-gray-600">總投資人數</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.totalInvestors}</p>
              <p className="text-sm text-success-600 mt-1">+12 新進投資人</p>
            </div>
          </div> */}

          {/* <div className="card border-orange-200 bg-orange-50">
            <div>
              <p className="text-sm text-orange-600">待處理操作</p>
              <p className="text-2xl font-bold text-orange-700 mt-1">{metrics.pendingActions}</p>
              <p className="text-sm text-orange-600 mt-1">策略變更冷卻中</p>
            </div>
          </div> */}
        </div>

        {/* Performance Charts Section */}
        {/* {selectedFund && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">基金表現詳情</h2>
              <button
                onClick={() => setSelectedFund(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* <PerformanceChart
                fundId={selectedFund}
                fundName={funds.find(f => f.address === selectedFund)?.name}
                height={300}
              /> */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">基金統計</h3>
                {(() => {
                  const fund = funds.find(f => f.address === selectedFund);
                  const update = realTimeUpdates.get(selectedFund);
                  return fund ? (
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">淨資產價值:</span>
                        <span className="font-medium">{fund.totalAssets}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">份額價格:</span>
                        <span className="font-medium">{fund.sharePrice}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">投資人數量:</span>
                        <span className="font-medium">{fund.investors}</span>
                      </div>
                      {update && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">總份額:</span>
                            <span className="font-medium">{parseFloat(update.totalShares).toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">24小時變化:</span>
                            <span className={`font-medium ${
                              update.priceChangePercentage24h >= 0 ? 'text-success-600' : 'text-danger-600'
                            }`}>
                              {update.priceChangePercentage24h >= 0 ? '+' : ''}{update.priceChangePercentage24h.toFixed(2)}%
                            </span>
                          </div>
                        </>
                      )}
                      <div className="pt-4 border-t">
                        <Link 
                          href={`/manager/fund/${fund.id}`}
                          className="btn-primary w-full text-center"
                        >
                          管理基金
                        </Link>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
        )} */}

        {/* 基金列表 */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">我的基金</h2>
            {isLoading && <LoadingSpinner />}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">基金名稱</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">總資產 (AUM)</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">份額淨值 (NAV)</th>
                  {/* <th className="text-left py-3 px-4 font-medium text-gray-700">日漲跌</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">投資人數</th> */}
                  <th className="text-left py-3 px-4 font-medium text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {funds.map((fund) => {
                  const isUpdating = realTimeUpdates.has(fund.address);
                  const timeSinceUpdate = Date.now() - fund.lastUpdated;
                  const isRecent = timeSinceUpdate < 60000; // Less than 1 minute
                  
                  return (
                    <tr key={fund.id} className="border-b border-gray-100">
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <div>
                            <div className="font-medium text-gray-900 flex items-center">
                              {fund.name}
                              {isRecent && (
                                <span className="ml-2 w-2 h-2 bg-success-500 rounded-full animate-pulse"></span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{fund.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-900 font-medium">
                        {fund.totalAssets}
                        {isUpdating && (
                          <div className="text-xs text-blue-500 animate-pulse">更新中...</div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-gray-900">{fund.sharePrice}</td>
                      {/* <td className={`py-4 px-4 font-medium ${fund.performanceColor}`}>
                        {fund.performance}
                      </td> */}
                      {/* <td className="py-4 px-4 text-gray-900">{fund.investors.toLocaleString()}</td> */}
                      <td className="py-4 px-4">
                        <div className="flex space-x-2">
                          {/* <button
                            onClick={() => setSelectedFund(
                              selectedFund === fund.address ? null : fund.address
                            )}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${
                              selectedFund === fund.address
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {selectedFund === fund.address ? '隱藏圖表' : '查看圖表'}
                          </button> */}
                          <Link
                            href={`/manager/fund/${fund.id}`}
                            className="btn-primary text-sm"
                          >
                            管理
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {/* 空資料狀態 */}
            {!isLoading && funds.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">還沒有基金</h3>
                <p className="text-gray-500 mb-6">創建您的第一個基金來開始管理投資組合</p>
                <Link
                  href="/manager/create"
                  className="btn-primary inline-flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  創建新基金
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
