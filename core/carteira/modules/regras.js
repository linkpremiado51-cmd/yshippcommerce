// modules/regras.js

// --- Constantes de Configuração ---
export const GOLD_TO_REAL_RATE = 1000;
export const MIN_BALANCE = { reais: 10, golds: 100 };
export const MAX_INVESTMENT = 1000000;
export const MIN_INVESTMENT = 100;

export const TAX_RATES = {
    deposit: { reais: 0.02, golds: 0.01, profit_withdrawal: 0.05 },
    withdraw: { reais: 0.05, golds: 0.03 },
    transfer: { reais: 0.03, golds: 0.02 },
    conversion: { reais: 0.03, golds: 0.05 },
    invest: { golds: 0.05 },
    withdraw_invest: { golds: 0.10 }
};

export const INVESTMENT_PLANS = {
    facebook: { name: 'Micro Influenciador do Facebook', returnRate: 0.012, risk: 'Baixo', lockInDays: 30, minInvest: 100 },
    instagram: { name: 'Micro Influenciador do Instagram', returnRate: 0.015, risk: 'Baixo', lockInDays: 30, minInvest: 100 },
    mobile: { name: 'Aplicativo Móvel', returnRate: 0.025, risk: 'Médio', lockInDays: 60, minInvest: 500 },
    telegram: { name: 'Telegram', returnRate: 0.018, risk: 'Baixo', lockInDays: 30, minInvest: 100 },
    tiktok: { name: 'TikTok', returnRate: 0.030, risk: 'Médio', lockInDays: 60, minInvest: 500 },
    video: { name: 'Marketing de Vídeo', returnRate: 0.040, risk: 'Alto', lockInDays: 90, minInvest: 1000 },
    discord: { name: 'Discord', returnRate: 0.010, risk: 'Baixo', lockInDays: 30, minInvest: 50 },
    blog: { name: 'Comente em outros Blogs', returnRate: 0.008, risk: 'Baixo', lockInDays: 15, minInvest: 50 },
    reddit: { name: 'Reddit', returnRate: 0.035, risk: 'Alto', lockInDays: 90, minInvest: 1000 },
    seo: { name: 'SEO, Promover Conteúdo', returnRate: 0.020, risk: 'Médio', lockInDays: 60, minInvest: 200 },
    inscricoes: { name: 'Inscrever-se', returnRate: 0.005, risk: 'Muito Baixo', lockInDays: 15, minInvest: 20 }
};

// --- Funções Utilitárias e de Formatação ---

export function formatCurrency(value) {
    if (value == null || isNaN(value)) return '0,00';
    return Number(value).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

export function getTaxRate(operationType, currency) {
    if (operationType === 'profit_withdrawal') {
        return TAX_RATES.deposit.profit_withdrawal;
    }
    return TAX_RATES[operationType]?.[currency] || 0.05;
}

// --- Validações ---

export function validatePixKey(key) {
    if (!key) return true;
    const cleanedKey = key.replace(/[^a-zA-Z0-9@.\-\_]/g, '');
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cpfCnpjRegex = /^(\d{11}|\d{14})$/;
    const phoneRegex = /^(\+55)?\d{10,11}$/;
    const randomRegex = /^[a-zA-Z0-9\-]{26,36}$/;

    return emailRegex.test(cleanedKey) ||
           cpfCnpjRegex.test(cleanedKey) ||
           phoneRegex.test(cleanedKey.replace(/[\(\)\-\s\+]/g, '')) ||
           randomRegex.test(cleanedKey);
}

export function validateBalance(walletData, currency, amount, tax = 0) {
    const balance = walletData[`${currency}Balance`] || 0;
    const totalCost = amount + tax;
    return balance >= totalCost;
}

export function validateMinimumBalance(walletData, currency, amount, tax = 0) {
    const balance = walletData[`${currency}Balance`] || 0;
    const totalCost = amount + tax;
    const minBalance = MIN_BALANCE[currency] || 0;
    return (balance - totalCost) >= minBalance;
}

