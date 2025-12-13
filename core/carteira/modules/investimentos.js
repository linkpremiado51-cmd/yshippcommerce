// modules/investimentos.js

// ================================
// INVESTIMENTOS – YSHIPPBANK
// ================================
// Depende de:
// window.RegrasYshipp
// window.SaldoYshipp

// ================================
// OBTENÇÃO DE PLANOS
// ================================

function getInvestmentPlans() {
    return window.INVESTMENT_PLANS || {};
}

function getInvestmentPlan(planId) {
    const plans = getInvestmentPlans();
    return plans[planId] || null;
}

// ================================
// VALIDAÇÕES
// ================================

function canInvest(walletData, planId, amount) {
    if (!walletData) return false;
    if (typeof amount !== 'number' || amount <= 0) return false;

    const plan = getInvestmentPlan(planId);
    if (!plan) return false;

    if (amount < plan.minInvest) return false;

    const availableGolds = window.SaldoYshipp.getInvestibleGoldsBalance(walletData);
    return availableGolds >= amount;
}

// ================================
// CRIAÇÃO DE INVESTIMENTO
// ================================

function createInvestment(walletData, planId, amount) {
    if (!canInvest(walletData, planId, amount)) {
        return { success: false, message: 'Investimento inválido.' };
    }

    const plan = getInvestmentPlan(planId);
    const now = new Date();

    const investment = {
        id: `${planId}_${now.getTime()}`,
        planId,
        planName: plan.name,
        amount,
        returnRate: plan.returnRate,
        risk: plan.risk,
        lockInDays: plan.lockInDays,
        startDate: now.toISOString(),
        lockedUntil: new Date(
            now.getTime() + plan.lockInDays * 24 * 60 * 60 * 1000
        ).toISOString(),
        status: 'active'
    };

    return {
        success: true,
        investment
    };
}

// ================================
// PROCESSAMENTO DE SALDO
// ================================

function applyInvestment(walletData, investment) {
    const newWallet = { ...walletData };

    newWallet.goldsBalance =
        (newWallet.goldsBalance || 0) - investment.amount;

    if (!newWallet.investments) {
        newWallet.investments = {};
    }

    newWallet.investments[investment.id] = investment;

    return newWallet;
}

// ================================
// CÁLCULO DE RETORNO
// ================================

function calculateInvestmentReturn(investment) {
    if (!investment || investment.status !== 'active') return 0;

    const investedAmount = investment.amount;
    const rate = investment.returnRate;

    return Math.floor(investedAmount * rate);
}

// ================================
// RESGATE DE INVESTIMENTO
// ================================

function canWithdrawInvestment(investment) {
    if (!investment) return false;
    const now = new Date();
    return now >= new Date(investment.lockedUntil);
}

function withdrawInvestment(walletData, investmentId) {
    if (!walletData || !walletData.investments) {
        return { success: false, message: 'Investimento não encontrado.' };
    }

    const investment = walletData.investments[investmentId];
    if (!investment) {
        return { success: false, message: 'Investimento inválido.' };
    }

    if (!canWithdrawInvestment(investment)) {
        return { success: false, message: 'Investimento ainda bloqueado.' };
    }

    const profit = calculateInvestmentReturn(investment);
    const totalReturn = investment.amount + profit;

    const newWallet = { ...walletData };
    newWallet.goldsBalance =
        (newWallet.goldsBalance || 0) + totalReturn;

    investment.status = 'closed';
    investment.closedAt = new Date().toISOString();
    investment.profit = profit;

    return {
        success: true,
        newWallet,
        investment
    };
}

// ================================
// EXPORT GLOBAL
// ================================

window.InvestimentosYshipp = {
    getInvestmentPlans,
    getInvestmentPlan,
    canInvest,
    createInvestment,
    applyInvestment,
    calculateInvestmentReturn,
    canWithdrawInvestment,
    withdrawInvestment
};
