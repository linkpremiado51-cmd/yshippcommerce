// modules/saldo.js

// ================================
// LÓGICA DE SALDO – YSHIPPBANK
// ================================

// ================================
// GETTERS DE SALDO
// ================================
function getReaisBalance(walletData) {
    return walletData?.reaisBalance || 0;
}

function getGoldsBalance(walletData) {
    return walletData?.goldsBalance || 0;
}

function getCryptoBalance(walletData) {
    return walletData?.cryptoBalance || 0;
}

function getEnterpriseBalance(walletData) {
    return walletData?.enterpriseBalance || 0;
}

// ================================
// INVESTIMENTOS
// ================================
function getPortfolioBalance(walletData) {
    if (!walletData?.investments) return 0;

    let total = 0;
    Object.values(walletData.investments).forEach(inv => {
        if (typeof inv.amount === 'number') {
            total += inv.amount;
        }
    });

    return total;
}

function getInvestibleGoldsBalance(walletData) {
    const totalGolds = getGoldsBalance(walletData);
    const lockedGolds = walletData?.lockedGolds || 0;
    return totalGolds - lockedGolds;
}

// ================================
// CONVERSÕES
// ================================
function convertGoldsToReais(golds) {
    if (typeof golds !== 'number') return 0;
    return golds / window.RegrasYshipp.GOLD_TO_REAL_RATE;
}

function convertReaisToGolds(reais) {
    if (typeof reais !== 'number') return 0;
    return reais * window.RegrasYshipp.GOLD_TO_REAL_RATE;
}

// ================================
// SALDO TOTAL ESTIMADO
// ================================
function getTotalEstimatedBalanceInReais(walletData) {
    const reais = getReaisBalance(walletData);
    const golds = convertGoldsToReais(getGoldsBalance(walletData));
    const portfolio = convertGoldsToReais(getPortfolioBalance(walletData));
    const enterprise = convertGoldsToReais(getEnterpriseBalance(walletData));
    const crypto = convertGoldsToReais(getCryptoBalance(walletData));

    return reais + golds + portfolio + enterprise + crypto;
}

// ================================
// ATUALIZAÇÃO VISUAL (CONTROLADA)
// ================================
function updateBalanceDisplay(balances) {
    const {
        reais = 0,
        golds = 0,
        portfolio = 0,
        enterprise = 0,
        crypto = 0
    } = balances;

    const reaisEl = document.getElementById('reais-balance');
    const goldsEl = document.getElementById('golds-balance');
    const portfolioEl = document.getElementById('portfolio-balance');
    const enterpriseEl = document.getElementById('enterprise-balance');
    const cryptoEl = document.getElementById('crypto-balance');

    if (reaisEl) reaisEl.textContent = `R$ ${reais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (goldsEl) goldsEl.textContent = golds.toLocaleString('pt-BR');
    if (portfolioEl) portfolioEl.textContent = `${portfolio.toLocaleString('pt-BR')} G`;
    if (enterpriseEl) enterpriseEl.textContent = `${enterprise.toLocaleString('pt-BR')} G`;
    if (cryptoEl) cryptoEl.textContent = `${crypto.toLocaleString('pt-BR')} YSC`;
}

// ================================
// EXPORT GLOBAL
// ================================
window.SaldoYshipp = {
    getReaisBalance,
    getGoldsBalance,
    getCryptoBalance,
    getEnterpriseBalance,
    getPortfolioBalance,
    getInvestibleGoldsBalance,
    convertGoldsToReais,
    convertReaisToGolds,
    getTotalEstimatedBalanceInReais,
    updateBalanceDisplay
};
