// modules/regras.js

// --- REGRAS INSTITUCIONAIS DO YSHIPPBANK ---

// Regras de saque
const MIN_TASKS_FOR_WITHDRAW = 100;           // Quantidade mínima de tarefas para poder sacar
const WITHDRAW_INTERVAL_DAYS = 30;            // Intervalo mínimo entre saques
const MIN_WITHDRAW_AMOUNT = 50;               // Valor mínimo de saque em Reais
const MAX_WITHDRAW_PER_PERIOD = 500;          // Limite máximo de saque por período em Reais

// Regras de empresa
const COMPANY_MIN_LOCKED_GOLD = 250000;       // Quantidade mínima de Gold a ser travada para criar empresa
const COMPANY_COIN_MIN_GOLD = 1000000;        // Quantidade mínima de Gold para criar moeda própria
const MIN_CIRCULATION_FOR_REWARDS = 10000;    // Circulação mínima para gerar recompensas

// Regras de usuário/carteira
// Ajustado para representar uma distinção clara: ativo vs elegível para saque
const MIN_USER_TASKS_MONTHLY = 30;            // Tarefas mínimas mensais para manter conta ativa
const MIN_BALANCE_GOLDS_TRANSFER = 10;        // Saldo mínimo em Golds para fazer transferência
const TRANSFER_FEE_PERCENTAGE = 0.02;         // Taxa de 2% sobre transferências (vai para o sistema)

// Regras de circulação
const MIN_CIRCULATION_VALUE = 10;             // Valor mínimo de uma transação circular
// Taxa sistêmica de circulação que vai para o Banco Central
const CIRCULATION_TAX_PERCENTAGE = 0.01;      
// Recompensa de 0.5% para o emissor de uma transação circular, incentivando a movimentação
const CIRCULATION_REWARD_PERCENTAGE = 0.005;  

// Constantes de conversão e identificação
// NOTA: Esta taxa é fixa por enquanto, mas conceitualmente será controlada pelo Banco Central no futuro
const GOLD_TO_REAL_RATE = 1000;               
const SYSTEM_WALLET_ID = 'system_account';    // ID da carteira do sistema para taxas e reservas


// --- FUNÇÕES DE REGRA ---

/**
 * Verifica se o usuário pode sacar
 * @param {Object} userData - Dados do usuário (tarefas, último saque, etc.)
 * @returns {boolean} True se puder sacar
 */
function canWithdraw(userData) {
    if (!userData) return false;
    
    const tasksCompleted = userData.tasksCompleted || 0;
    const lastWithdrawDate = userData.lastWithdrawDate ? new Date(userData.lastWithdrawDate) : null;
    const now = new Date();
    
    // Verifica tarefas mínimas
    if (tasksCompleted < MIN_TASKS_FOR_WITHDRAW) {
        return false;
    }
    
    // Verifica intervalo entre saques
    if (lastWithdrawDate) {
        const daysSinceLastWithdraw = Math.floor((now - lastWithdrawDate) / (1000 * 60 * 60 * 24));
        if (daysSinceLastWithdraw < WITHDRAW_INTERVAL_DAYS) {
            return false;
        }
    }
    
    return true;
}

/**
 * Verifica se o usuário está em dia com as tarefas mensais mínimas
 * @param {Object} userData - Dados do usuário
 * @returns {boolean} True se estiver ativo
 */
function isUserActive(userData) {
    if (!userData) return false;
    const monthlyTasks = userData.monthlyTasks || 0;
    return monthlyTasks >= MIN_USER_TASKS_MONTHLY;
}

/**
 * Verifica se o usuário pode criar uma empresa
 * @param {Object} userData - Dados do usuário (saldo de golds, etc.)
 * @returns {boolean} True se puder criar empresa
 */
function canCreateCompany(userData) {
    if (!userData) return false;
    const goldsBalance = userData.goldsBalance || 0;
    return goldsBalance >= COMPANY_MIN_LOCKED_GOLD;
}

/**
 * Verifica se uma empresa pode emitir sua própria moeda
 * @param {Object} companyData - Dados da empresa (saldo de golds, etc.)
 * @returns {boolean} True se puder emitir moeda
 */
function canCreateCompanyCoin(companyData) {
    if (!companyData) return false;
    const goldsBalance = companyData.goldsBalance || 0;
    return goldsBalance >= COMPANY_COIN_MIN_GOLD;
}

/**
 * Calcula a taxa de uma transferência
 * @param {number} amount - Valor da transferência
 * @param {string} currency - Moeda ('golds' ou 'reais')
 * @returns {number} Valor da taxa
 */
function calculateTransferFee(amount, currency) {
    // A taxa pode variar por moeda, mas por enquanto é fixa
    // Esta taxa é uma taxa sistêmica de circulação, vai para o Banco Central
    return amount * TRANSFER_FEE_PERCENTAGE;
}

/**
 * Calcula a taxa de uma transação circular
 * @param {number} amount - Valor da transação
 * @returns {number} Valor da taxa
 */
function calculateCirculationTax(amount) {
    // Taxa cobrada em todas as transações circulares, indo para o Banco Central
    return amount * CIRCULATION_TAX_PERCENTAGE;
}

/**
 * Calcula a recompensa de uma transação circular para o emissor
 * @param {number} amount - Valor da transação
 * @returns {number} Valor da recompensa
 */
function calculateCirculationReward(amount) {
    // Recompensa dada ao emissor da transação, incentivando a circulação
    return amount * CIRCULATION_REWARD_PERCENTAGE;
}

/**
 * Verifica se uma transação circular é válida
 * @param {number} amount - Valor da transação
 * @returns {boolean} True se for válida
 */
function isValidCirculationTransaction(amount) {
    // Garante que a transação tenha um valor mínimo para ser considerada
    return amount >= MIN_CIRCULATION_VALUE;
}

/**
 * Obtém a taxa de conversão interna
 * @returns {number} Taxa de conversão
 */
function getInternalConversionRate() {
    // NOTA: Esta taxa é fixa por enquanto, mas futuramente será determinada pelo Banco Central
    return GOLD_TO_REAL_RATE;
}

/**
 * Obtém o ID da carteira do sistema
 * @returns {string} ID da carteira
 */
function getSystemWalletId() {
    return SYSTEM_WALLET_ID;
}

// Exportar funções para uso em outros módulos (padrão IIFE ou objeto global)
// Este padrão permite que outros módulos importem as regras de forma organizada
window.RegrasYshipp = {
  canWithdraw,
  isUserActive,
  canCreateCompany,
  canCreateCompanyCoin,
  calculateTransferFee,
  calculateCirculationTax,
  calculateCirculationReward,
  isValidCirculationTransaction,
  getInternalConversionRate,
  getSystemWalletId
};
