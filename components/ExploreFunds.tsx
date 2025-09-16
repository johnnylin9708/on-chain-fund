"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount } from "../lib/web3-context";
import { fundDatabaseService, FundData } from "../lib/fund-database-service";
import { DENOMINATION_ASSETS, ERC20_ABI, formatTokenAmount, VAULT_PROXY_ABI } from "../lib/contracts";
import LoadingSpinner from "./ui/LoadingSpinner";
import { ethers } from "ethers";


export default function ExploreFunds() {
  const { isConnected } = useAccount();
  const [funds, setFunds] = useState<FundData[]>([]);
  const [filterBy, setFilterBy] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFundsData();
  }, []);

  const loadFundsData = async () => {
    setIsLoading(true);
    try {
      const fundsData = await fundDatabaseService.getAllFunds();

      const fundsDataMap = await Promise.all(fundsData.map(async (fund) => {
        if (!window.ethereum) {
          alert('請先連接您的錢包');
          return {...fund};
        }
        const provider = new ethers.BrowserProvider(window.ethereum);
        const vault = new ethers.Contract(fund.vaultProxy, VAULT_PROXY_ABI, provider);
        const underlying = new ethers.Contract(fund.denominationAsset, ERC20_ABI, provider);

        const decimals = getDenominationAsset(fund.denominationAsset).decimals;
        const totalSupplyRaw = await vault.totalSupply();
        const totalSupply = ethers.formatUnits(totalSupplyRaw, 18);
        const vaultBalanceRaw = await underlying.balanceOf(fund.vaultProxy);
        const vaultBalance = ethers.formatUnits(vaultBalanceRaw, decimals);

        const sharePrice =
          parseFloat(totalSupply) > 0
            ? (parseFloat(vaultBalance) / parseFloat(totalSupply)).toFixed(6)
            : "1.000000";
        
        return {
          ...fund,
          sharePrice,
          totalAssets: vaultBalance
        };
      }));

      console.log(fundsDataMap);
      setFunds(fundsDataMap);
    } catch (error) {
      console.error("Error loading funds:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDenominationAsset = (address: string) => {
    return (
      DENOMINATION_ASSETS.find((asset) => asset.address === address) ||
      DENOMINATION_ASSETS[0]
    );
  };

  const formatCurrency = (amount: string | undefined, asset: any) => {
    if (!amount) return "0 " + asset.symbol;
    return `${formatTokenAmount(amount)} ${asset.symbol}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 頁面標題 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">探索基金</h1>
          <p className="text-gray-600 mt-2">發現並投資符合您需求的區塊鏈基金</p>
        </div>

        {/* 載入狀態 */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        )}

        {!isLoading && (
          <>
            {/* 篩選和排序 */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setFilterBy("all")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterBy === "all"
                      ? "bg-primary-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                  }`}
                >
                  全部基金
                </button>
              </div>
            </div>

            {/* Performance Chart Section */}
            {/* {selectedChartFund && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    基金表現圖表
                  </h2>
                  <button
                    onClick={() => setSelectedChartFund(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕ 關閉圖表
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <PerformanceChart
                    fundId={selectedChartFund}
                    fundName={
                      funds.find((f) => f.id === selectedChartFund)?.fundName
                    }
                    height={300}
                  />
                  <div className="card">
                    <h3 className="font-semibold text-gray-900 mb-4">
                      基金詳情
                    </h3>
                    {(() => {
                      const fund = funds.find(
                        (f) => f.id === selectedChartFund
                      );
                      return fund ? (
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600">基金名稱:</span>
                            <span className="font-medium">{fund.fundName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">管理規模:</span>
                            <span className="font-medium">
                              {formatCurrency(
                                fund.totalAssets,
                                getDenominationAsset(fund.denominationAsset)
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">份額淨值:</span>
                            <span className="font-medium">
                              ${fund.sharePrice || "0"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">30天收益:</span>
                            <span
                              className={`font-medium ${fund.performanceColor}`}
                            >
                              {fund.performance30d}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">投資人數:</span>
                            <span className="font-medium">
                              {fund.totalInvestors.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">風險等級:</span>
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(
                                fund.riskLevel
                              )}`}
                            >
                              {fund.riskLevel}
                            </span>
                          </div>
                          <div className="pt-4 border-t">
                            <Link
                              href={`/fund/${fund.id}`}
                              className="btn-primary w-full text-center"
                            >
                              開始投資
                            </Link>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
            )} */}

            {/* 基金卡片 */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {funds.map((fund) => {
                const denominationAsset = getDenominationAsset(
                  fund.denominationAsset
                );

                return (
                  <div
                    key={fund.id}
                    className="card hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {fund.fundName}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {fund.fundSymbol}
                        </p>
                      </div>
                      {/* <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(
                          fund.riskLevel
                        )}`}
                      >
                        {fund.riskLevel}風險
                      </span> */}
                    </div>

                    {/* <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">投資策略</p>
                      <p className="text-sm text-gray-800">{fund.strategy}</p>
                    </div> */}

                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-gray-600">總資產</p>
                        <p className="font-medium">
                          {formatCurrency(fund.totalAssets, denominationAsset)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">份額淨值</p>
                        <p className="font-medium">
                          ${fund.sharePrice || "1.00"}
                        </p>
                      </div>
                      {/* <div>
                        <p className="text-gray-600">投資人數</p>
                        <p className="font-medium">{fund.totalInvestors}</p>
                      </div> */}
                      {/* <div>
                        <p className="text-gray-600">最小投資</p>
                        <p className="font-medium">
                          {fund.minInvestment} {denominationAsset.symbol}
                        </p>
                      </div> */}
                    </div>

                    <div className="mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">管理費:</span>
                        <span className="font-medium">
                          {(fund.managementFee / 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">績效費:</span>
                        <span className="font-medium">
                          {(fund.performanceFee / 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">計價資產:</span>
                        <span className="font-medium">
                          {denominationAsset.icon} {denominationAsset.symbol}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {/* <button
                        onClick={() =>
                          setSelectedChartFund(
                            selectedChartFund === fund.id ? null : fund.id
                          )
                        }
                        className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                          selectedChartFund === fund.id
                            ? "bg-primary-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {selectedChartFund === fund.id
                          ? "關閉圖表"
                          : "查看圖表"}
                      </button> */}
                      <Link
                        href={`/fund/${fund.id}`}
                        className="flex-1 text-center py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        查看詳情
                      </Link>
                      {isConnected && (
                        <Link
                          href={`/fund/${fund.id}#invest`}
                          className="flex-1 text-center py-2 px-4 bg-success-500 hover:bg-success-600 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          立即投資
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {funds.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg
                    className="mx-auto h-16 w-16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  沒有找到符合條件的基金
                </h3>
                <p className="text-gray-600 mb-6">請嘗試調整篩選條件</p>
                <button
                  onClick={() => setFilterBy("all")}
                  className="btn-primary"
                >
                  查看全部基金
                </button>
              </div>
            )}

            {!isConnected && (
              <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <div className="text-blue-400 mr-3">
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-blue-800 font-medium mb-1">
                      連接錢包開始投資
                    </h4>
                    <p className="text-blue-700 text-sm">
                      請連接您的錢包以投資基金並管理您的投資組合。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
