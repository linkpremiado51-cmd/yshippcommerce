// modules/saldo.js

// Supondo que as funções de regra estejam disponíveis globalmente como no arquivo anterior
// window.RegrasYshipp

/**
 * Obtém o saldo total em Reais
 * @param {Object} walletData - Dados da carteira do usuário
 * @returns {number} Saldo em Reais
 */
function getReaisBalance(walletData) {
    if (!walletData) return 0;
    return walletData.reaisBalance || 0;
}

/**
 * Obtém o saldo total em Golds
 * @param {Object} walletData - Dados da carteira do usuário
 * @returns {number} Saldo em Golds
 */
function getGoldsBalance(walletData) {
    if (!walletData) return 0;
    return walletData.goldsBalance || 0;
}

/**
 * Obtém o saldo total em Golds para fins de investimento (pode incluir regras de saldo bloqueado)
 * @param {Object} walletData - Dados da carteira do usuário
 * @returns {number} Saldo disponível para investimento em Golds
 */
function getInvestibleGoldsBalance(walletData) {
    if (!walletData) return 0;
    const totalGolds = getGoldsBalance(walletData);
    // Aqui pode ser aplicada lógica de saldo bloqueado, se necessário no futuro
    // Por exemplo, subtrair golds investidos ou bloqueados
    // const lockedGolds = walletData.lockedGolds || 0;
    return totalGolds;
}

/**
 * Obtém o saldo total do portfólio (investimentos ativos)
 * @param {Object} walletData - Dados da carteira do usuário
 * @returns {number} Valor total investido
 */
function getPortfolioBalance(walletData) {
    if (!walletData) return 0;
    // O saldo do portfólio pode ser calculado a partir dos investimentos ativos
    const investments = walletData.investments || {};
    let total = 0;
    for (const key in investments) {
        if (investments[key] && typeof investments[key].amount === 'number') {
            total += investments[key].amount;
        }
    }
    return total;
}

/**
 * Obtém o saldo total em moedas empresariais (se aplicável)
 * @param {Object} walletData - Dados da carteira do usuário
 * @returns {number} Saldo em moedas empresariais
 */
function getEnterpriseBalance(walletData) {
    if (!walletData) return 0;
    return walletData.enterpriseBalance || 0;
}

/**
 * Obtém o saldo total em criptomoedas (YSC, etc)
 * @param {Object} walletData - Dados da carteira do usuário
 * @returns {number} Saldo em criptomoedas
 */
function getCryptoBalance(walletData) {
    if (!walletData) return 0;
    return walletData.cryptoBalance || 0;
}

/**
 * Converte um valor em Golds para Reais usando a taxa interna
 * @param {number} goldsAmount - Valor em Golds
 * @returns {number} Valor equivalente em Reais
 */
function convertGoldsToReais(goldsAmount) {
    const rate = window.RegrasYshipp?.getInternalConversionRate() || 1000;
    if (typeof goldsAmount !== 'number' || goldsAmount < 0) return 0;
    return goldsAmount / rate;
}

/**
 * Converte um valor em Reais para Golds usando a taxa interna
 * @param {number} reaisAmount - Valor em Reais
 * @returns {number} Valor equivalente em Golds
 */
function convertReaisToGolds(reaisAmount) {
    const rate = window.RegrasYshipp?.getInternalConversionRate() || 1000;
    if (typeof reaisAmount !== 'number' || reaisAmount < 0) return 0;
    return reaisAmount * rate;
}

/**
 * Calcula o saldo total estimado em Reais (considerando todas as moedas convertidas)
 * @param {Object} walletData - Dados da carteira do usuário
 * @returns {number} Saldo total estimado em Reais
 */
function getTotalEstimatedBalanceInReais(walletData) {
    if (!walletData) return 0;
    const reais = getReaisBalance(walletData);
    const goldsAsReais = convertGoldsToReais(getGoldsBalance(walletData));
    const portfolioAsReais = convertGoldsToReais(getPortfolioBalance(walletData));
    const enterpriseAsReais = convertGoldsToReais(getEnterpriseBalance(walletData));
    const cryptoAsReais = convertGoldsToReais(getCryptoBalance(walletData));

    return reais + goldsAsReais + portfolioAsReais + enterpriseAsReais + cryptoAsReais;
}

/**
 * Atualiza a exibição dos saldos na interface (função pura de atualização visual)
 * Esta função não faz cálculos, apenas atualiza elementos do DOM com valores fornecidos.
 * @param {Object} balances - Objeto contendo os saldos a serem exibidos
 * @param {number} balances.reais - Saldo em Reais
 * @param {number} balances.golds - Saldo em Golds
 * @param {number} balances.portfolio - Saldo do portfólio
 * @param {number} balances.enterprise - Saldo empresarial
 * @param {number} balances.crypto - Saldo em cripto
 */
function updateBalanceDisplay(balances) {
    const {
        reais = 0,
        golds = 0,
        portfolio = 0,
        enterprise = 0,
        crypto = 0
    } = balances;

    // Atualiza saldos na interface, se os elementos existirem
    const goldsEl = document.getElementById('golds-balance');
    const reaisEl = document.getElementById('reais-balance');
    const portfolioEl = document.getElementById('portfolio-balance');
    const enterpriseEl = document.getElementById('enterprise-balance');
    const cryptoEl = document.getElementById('crypto-balance');

    if (goldsEl) goldsEl.textContent = golds.toLocaleString('pt-BR');
    if (reaisEl) reaisEl.textContent = `R$ ${reais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (portfolioEl) portfolioEl.textContent = `${portfolio.toLocaleString('pt-BR')} G`;
    if (enterpriseEl) enterpriseEl.textContent = `${enterprise.toLocaleString('pt-BR')} G`;
    if (cryptoEl) cryptoEl.textContent = `${crypto.toLocaleString('pt-BR')} YSC`;
}

// Exportar funções para uso em outros módulos (padrão IIFE ou objeto global)
// Este padrão permite que outros módulos importem as funções de saldo de forma organizada
window.SaldoYshipp = {
    getReaisBalance,
    getGoldsBalance,
    getInvestibleGoldsBalance,
    getPortfolioBalance,
    getEnterpriseBalance,
    getCryptoBalance,
    convertGoldsToReais,
    convertReaisToGolds,
    getTotalEstimatedBalanceInReais,
    updateBalanceDisplay
};
