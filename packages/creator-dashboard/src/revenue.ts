/**
 * Revenue Service - Revenue management module for creator dashboard
 *
 * Provides commission calculation, withdrawal management, and billing
 * functionality for the creator program.
 */

import Decimal from 'decimal.js';
import type {
  Revenue,
  RevenueType,
  BillItem,
  WithdrawalRequest,
  WithdrawalStatus,
  CommissionTier,
  CreatorTier,
  CreatorProgramConfig,
  ApiResponse,
  PaginatedResponse,
  TimeRange
} from './types';

/** Default commission tiers configuration */
const DEFAULT_COMMISSION_TIERS: CommissionTier[] = [
  {
    tier: 'starter',
    minRevenue: 0,
    maxRevenue: 1000,
    commissionRate: 0.70,
    description: '入门级 - 70% 分成'
  },
  {
    tier: 'advanced',
    minRevenue: 1001,
    maxRevenue: 10000,
    commissionRate: 0.75,
    description: '进阶级 - 75% 分成'
  },
  {
    tier: 'professional',
    minRevenue: 10001,
    maxRevenue: 50000,
    commissionRate: 0.80,
    description: '专业级 - 80% 分成'
  },
  {
    tier: 'flagship',
    minRevenue: 50001,
    maxRevenue: null,
    commissionRate: 0.85,
    description: '旗舰级 - 85% 分成'
  }
];

/** Default program configuration */
const DEFAULT_CONFIG: CreatorProgramConfig = {
  tiers: DEFAULT_COMMISSION_TIERS,
  minimumWithdrawal: 100,
  paymentMethods: ['alipay', 'wechat', 'bank', 'paypal'],
  bonusRules: [
    {
      id: 'first-month',
      name: '首月激励',
      description: '首月收入达到 ¥500 可获得 ¥100 奖金',
      type: 'first_month',
      condition: { metric: 'monthlyRevenue', operator: 'gte', value: 500 },
      reward: { type: 'fixed', value: 100 }
    },
    {
      id: 'quarterly-sprint',
      name: '季度冲刺',
      description: '季度收入增长 50% 可获得额外 5% 分成',
      type: 'quarterly',
      condition: { metric: 'quarterlyGrowth', operator: 'gte', value: 50 },
      reward: { type: 'percentage', value: 5, maxValue: 5000 }
    }
  ]
};

/**
 * Revenue service for managing creator earnings, commissions, and withdrawals
 */
export class RevenueService {
  private readonly config: CreatorProgramConfig;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string, config?: Partial<CreatorProgramConfig>) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate commission for a sale
   */
  calculateCommission(
    salePrice: number,
    creatorTier: CreatorTier,
    customRate?: number
  ): { creatorRevenue: number; platformRevenue: number; commissionRate: number } {
    const rate = customRate ?? this.getCommissionRate(creatorTier);
    const price = new Decimal(salePrice);
    const commissionRate = new Decimal(rate);

    const creatorRevenue = price.mul(commissionRate).toDecimalPlaces(2).toNumber();
    const platformRevenue = price.minus(creatorRevenue).toDecimalPlaces(2).toNumber();

    return {
      creatorRevenue,
      platformRevenue,
      commissionRate: rate
    };
  }

  /**
   * Get commission rate for a tier
   */
  getCommissionRate(tier: CreatorTier): number {
    const tierConfig = this.config.tiers.find(t => t.tier === tier);
    return tierConfig?.commissionRate ?? 0.70;
  }

  /**
   * Determine creator tier based on cumulative revenue
   */
  determineTier(cumulativeRevenue: number): CreatorTier {
    const sortedTiers = [...this.config.tiers].sort((a, b) => b.minRevenue - a.minRevenue);

    for (const tier of sortedTiers) {
      if (cumulativeRevenue >= tier.minRevenue) {
        return tier.tier;
      }
    }

    return 'starter';
  }

  /**
   * Calculate batch commissions for multiple sales
   */
  calculateBatchCommissions(
    sales: Array<{ price: number; creatorTier: CreatorTier }>
  ): Array<{ creatorRevenue: number; platformRevenue: number; commissionRate: number }> {
    return sales.map(sale => this.calculateCommission(sale.price, sale.creatorTier));
  }

  /**
   * Calculate total revenue from a list of revenue records
   */
  calculateTotalRevenue(revenues: Revenue[]): {
    totalSales: number;
    totalBonus: number;
    totalRefund: number;
    totalPenalty: number;
    netRevenue: number;
  } {
    const totals = revenues.reduce(
      (acc, revenue) => {
        switch (revenue.type) {
          case 'sales':
            acc.totalSales = new Decimal(acc.totalSales).plus(revenue.netAmount).toNumber();
            break;
          case 'bonus':
            acc.totalBonus = new Decimal(acc.totalBonus).plus(revenue.netAmount).toNumber();
            break;
          case 'refund':
            acc.totalRefund = new Decimal(acc.totalRefund).plus(revenue.netAmount).toNumber();
            break;
          case 'penalty':
            acc.totalPenalty = new Decimal(acc.totalPenalty).plus(revenue.netAmount).toNumber();
            break;
        }
        return acc;
      },
      { totalSales: 0, totalBonus: 0, totalRefund: 0, totalPenalty: 0, netRevenue: 0 }
    );

    totals.netRevenue = new Decimal(totals.totalSales)
      .plus(totals.totalBonus)
      .minus(totals.totalRefund)
      .minus(totals.totalPenalty)
      .toNumber();

    return totals;
  }

  /**
   * Check if a withdrawal request is valid
   */
  validateWithdrawal(
    amount: number,
    availableBalance: number
  ): { valid: boolean; error?: string } {
    if (amount < this.config.minimumWithdrawal) {
      return {
        valid: false,
        error: `最低提现金额为 ¥${this.config.minimumWithdrawal}`
      };
    }

    if (amount > availableBalance) {
      return {
        valid: false,
        error: '提现金额超过可用余额'
      };
    }

    return { valid: true };
  }

  /**
   * Create a withdrawal request
   */
  async createWithdrawal(
    creatorId: string,
    amount: number,
    method: 'alipay' | 'wechat' | 'bank' | 'paypal',
    accountInfo: string
  ): Promise<ApiResponse<WithdrawalRequest>> {
    try {
      const response = await this.fetch<WithdrawalRequest>(
        `/api/v1/creator/${creatorId}/withdrawals`,
        {
          method: 'POST',
          body: JSON.stringify({ amount, method, accountInfo })
        }
      );
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create withdrawal'
      };
    }
  }

  /**
   * Get withdrawal history
   */
  async getWithdrawals(
    creatorId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApiResponse<PaginatedResponse<WithdrawalRequest>>> {
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      });
      const response = await this.fetch<PaginatedResponse<WithdrawalRequest>>(
        `/api/v1/creator/${creatorId}/withdrawals?${params.toString()}`
      );
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch withdrawals'
      };
    }
  }

  /**
   * Generate monthly bill
   */
  async generateBill(
    creatorId: string,
    year: number,
    month: number
  ): Promise<ApiResponse<BillItem[]>> {
    try {
      const response = await this.fetch<BillItem[]>(
        `/api/v1/creator/${creatorId}/bills/${year}/${month}`
      );
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate bill'
      };
    }
  }

  /**
   * Calculate bonus rewards based on rules
   */
  calculateBonus(
    metrics: Record<string, number>,
    isFirstMonth: boolean = false
  ): Array<{ ruleId: string; name: string; reward: number }> {
    const bonuses: Array<{ ruleId: string; name: string; reward: number }> = [];

    for (const rule of this.config.bonusRules) {
      if (rule.type === 'first_month' && !isFirstMonth) continue;

      const metricValue = metrics[rule.condition.metric];
      if (metricValue === undefined) continue;

      const conditionMet = this.evaluateCondition(
        metricValue,
        rule.condition.operator,
        rule.condition.value
      );

      if (conditionMet) {
        let reward = 0;
        if (rule.reward.type === 'fixed') {
          reward = rule.reward.value;
        } else if (rule.reward.type === 'percentage') {
          reward = metricValue * (rule.reward.value / 100);
          if (rule.reward.maxValue) {
            reward = Math.min(reward, rule.reward.maxValue);
          }
        }

        bonuses.push({
          ruleId: rule.id,
          name: rule.name,
          reward: Math.round(reward * 100) / 100
        });
      }
    }

    return bonuses;
  }

  /**
   * Calculate tax for revenue
   */
  calculateTax(revenue: number, isEnterprise: boolean = false): {
    taxAmount: number;
    taxRate: number;
    afterTax: number;
  } {
    if (isEnterprise) {
      // Enterprise VAT: 6%
      const taxRate = 0.06;
      const taxAmount = new Decimal(revenue).mul(taxRate).toDecimalPlaces(2).toNumber();
      return {
        taxAmount,
        taxRate,
        afterTax: new Decimal(revenue).minus(taxAmount).toDecimalPlaces(2).toNumber()
      };
    }

    // Individual income tax (simplified progressive rates)
    let taxRate: number;
    let quickDeduction: number;

    if (revenue <= 36000) {
      taxRate = 0.03;
      quickDeduction = 0;
    } else if (revenue <= 144000) {
      taxRate = 0.10;
      quickDeduction = 2520;
    } else if (revenue <= 300000) {
      taxRate = 0.20;
      quickDeduction = 16920;
    } else if (revenue <= 420000) {
      taxRate = 0.25;
      quickDeduction = 31920;
    } else if (revenue <= 660000) {
      taxRate = 0.30;
      quickDeduction = 52920;
    } else if (revenue <= 960000) {
      taxRate = 0.35;
      quickDeduction = 85920;
    } else {
      taxRate = 0.45;
      quickDeduction = 181920;
    }

    const taxAmount = Math.max(0, new Decimal(revenue).mul(taxRate).minus(quickDeduction).toDecimalPlaces(2).toNumber());

    return {
      taxAmount,
      taxRate,
      afterTax: new Decimal(revenue).minus(taxAmount).toDecimalPlaces(2).toNumber()
    };
  }

  /**
   * Format revenue for display
   */
  formatRevenue(amount: number, currency: string = 'CNY'): string {
    const formatters: Record<string, Intl.NumberFormat> = {
      CNY: new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }),
      USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
      EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
    };

    const formatter = formatters[currency] ?? formatters.CNY;
    return formatter.format(amount);
  }

  /**
   * Get commission tier information
   */
  getCommissionTiers(): CommissionTier[] {
    return [...this.config.tiers];
  }

  /**
   * Get next tier information
   */
  getNextTierInfo(currentTier: CreatorTier): {
    nextTier: CreatorTier | null;
    revenueGap: number;
    commissionIncrease: number;
  } | null {
    const currentIndex = this.config.tiers.findIndex(t => t.tier === currentTier);
    if (currentIndex === -1 || currentIndex === this.config.tiers.length - 1) {
      return null;
    }

    const nextTier = this.config.tiers[currentIndex + 1];
    const currentRate = this.config.tiers[currentIndex].commissionRate;

    return {
      nextTier: nextTier.tier,
      revenueGap: nextTier.minRevenue,
      commissionIncrease: nextTier.commissionRate - currentRate
    };
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(
    value: number,
    operator: string,
    threshold: number
  ): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  /**
   * Fetch data from API
   */
  private async fetch<T>(
    endpoint: string,
    options?: { method?: string; body?: string }
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: options?.body
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: data as T
    };
  }
}
