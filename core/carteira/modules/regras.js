// modules/regras.js

// ================================
// REGRAS INSTITUCIONAIS – YSHIPPBANK
// ================================

// Conversão
const GOLD_TO_REAL_RATE = 1000;

// ================================
// PLANOS DE INVESTIMENTO
// ================================
const INVESTMENT_PLANS = {
    yshippcommerce: {
        name: 'YshippCommerce',
        returnRate: 0.02,
        risk: 'Baixo',
        lockInDays: 30,
        minInvest: 100
    },
    yshippstore: {
        name: 'YshippStore',
        returnRate: 0.035,
        risk: 'Médio',
        lockInDays: 60,
        minInvest: 500
    },
    yshippmarket: {
        name: 'YshippMarket',
        returnRate: 0.05,
        risk: 'Alto',
        lockInDays: 90,
        minInvest: 1000
    },
    inscricoes: {
        name: 'Inscrever-se',
        returnRate: 0.005,
        risk: 'Muito Baixo',
        lockInDays: 15,
        minInvest: 20
    }
};

// ================================
// TAXAS DO SISTEMA
// ================================
const TAX_RATES = {
    deposit: { reais: 0.02, golds: 0.01 },
    withdraw: { reais: 0.03, golds: 0.02 },
    transfer: { reais: 0.01, golds: 0.005 },
    conversion: { reais: 0.005, golds: 0.005 },
    invest: { reais: 0.001, golds: 0.001 },
    withdraw_invest: { reais: 0.01, golds: 0.01 },
    profit_withdrawal: { reais: 0.02, golds: 0.02 }
};

// ================================
// FUNÇÕES DE REGRA
// ================================
function getTaxRate(operationType, currency) {
    return TAX_RATES?.[operationType]?.[currency] || 0;
}

// ================================
// VALIDAÇÃO PIX
// ================================
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CPF_CNPJ_REGEX = /^(\d{11}|\d{14})$/;
const PHONE_REGEX = /^(\+55)?\d{10,11}$/;
const RANDOM_KEY_REGEX = /^[a-zA-Z0-9\-]{26,36}$/;

function validatePixKey(key) {
    if (!key) return true;

    const cleanedKey = key.replace(/[^a-zA-Z0-9@.\-_]/g, '');

    return (
        EMAIL_REGEX.test(cleanedKey) ||
        CPF_CNPJ_REGEX.test(cleanedKey) ||
        PHONE_REGEX.test(cleanedKey.replace(/[\(\)\-\s\+]/g, '')) ||
        RANDOM_KEY_REGEX.test(cleanedKey)
    );
}

// ================================
// VALIDAÇÕES DE SALDO (PURO)
// ================================
function validateBalance(balance, amount, tax = 0) {
    return balance >= (amount + tax);
}

function validateMinimumBalance(balance, amount, tax = 0) {
    const newBalance = balance - (amount + tax);
    return newBalance >= 0;
}

// ================================
// REGRAS DE VISIBILIDADE (LÓGICA)
// ================================
function canAccessCommercialAccount(goldsBalance) {
    return goldsBalance >= 500000;
}

function canAccessCryptoAnalysis(goldsBalance) {
    return goldsBalance >= 1000000;
}

// ================================
// EXPORT GLOBAL CONTROLADO
// ================================
window.RegrasYshipp = {
    GOLD_TO_REAL_RATE,
    INVESTMENT_PLANS,
    TAX_RATES,
    getTaxRate,
    validatePixKey,
    validateBalance,
    validateMinimumBalance,
    canAccessCommercialAccount,
    canAccessCryptoAnalysis
};
