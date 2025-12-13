// modules/saques.js

// ================================
// SAQUES – YSHIPPBANK
// ================================
// Depende de:
// window.RegrasYshipp
// window.SaldoYshipp

// ================================
// VALIDAÇÕES
// ================================

function canUserWithdraw(userData) {
    if (!userData) return false;

    // Regra institucional (tarefas + intervalo)
    if (!window.RegrasYshipp.canWithdraw(userData)) {
        return false;
    }

    // Usuário precisa estar ativo
    if (!window.RegrasYshipp.isUserActive(userData)) {
        return false;
    }

    return true;
}

function validateWithdrawAmount(amount) {
    if (typeof amount !== 'number' || amount <= 0) return false;
    if (amount < MIN_WITHDRAW_AMOUNT) return false;
    if (amount > MAX_WITHDRAW_PER_PERIOD) return false;
    return true;
}

function validateWithdrawBalance(walletData, amount) {
    if (!walletData) return false;

    const tax = window.RegrasYshipp.getTaxRate
        ? window.RegrasYshipp.getTaxRate('withdraw', 'reais')
        : 0;

    const fee = amount * tax;
    const total = amount + fee;

    return (walletData.reaisBalance || 0) >= total;
}

// ================================
// PREPARAÇÃO DO SAQUE
// ================================

function prepareWithdrawRequest(userId, walletData, userData, amount, pixKey) {
    if (!userId || !walletData || !userData) {
        return { success: false, message: 'Dados insuficientes.' };
    }

    if (!canUserWithdraw(userData)) {
        return { success: false, message: 'Usuário não elegível para saque.' };
    }

    if (!validateWithdrawAmount(amount)) {
        return { success: false, message: 'Valor de saque inválido.' };
    }

    if (!validateWithdrawBalance(walletData, amount)) {
        return { success: false, message: 'Saldo insuficiente para saque.' };
    }

    const taxRate = window.RegrasYshipp.getTaxRate
        ? window.RegrasYshipp.getTaxRate('withdraw', 'reais')
        : 0;

    const tax = amount * taxRate;
    const netAmount = amount - tax;

    const withdrawTransaction = {
        type: 'withdraw',
        currency: 'reais',
        amount: amount,
        netAmount: netAmount,
        tax: tax,
        date: new Date().toISOString(),
        description: 'Solicitação de saque',
        to: pixKey,
        metadata: {
            status: 'pending'
        }
    };

    return {
        success: true,
        withdrawTransaction,
        tax,
        netAmount
    };
}

// ================================
// PROCESSAMENTO DO SAQUE
// ================================

function processWithdraw(walletData, amount, tax) {
    if (!walletData) throw new Error('Carteira inválida.');

    const newWalletData = { ...walletData };
    const totalDebit = amount + tax;

    newWalletData.reaisBalance =
        (newWalletData.reaisBalance || 0) - totalDebit;

    return {
        newWalletData,
        systemRevenue: tax
    };
}

// ================================
// EXECUÇÃO COMPLETA
// ================================

function executeWithdraw(data) {
    const { userId, walletData, userData, amount, pixKey } = data;

    const prepared = prepareWithdrawRequest(
        userId,
        walletData,
        userData,
        amount,
        pixKey
    );

    if (!prepared.success) return prepared;

    try {
        const balanceResult = processWithdraw(
            walletData,
            amount,
            prepared.tax
        );

        return {
            success: true,
            message: 'Saque solicitado com sucesso.',
            newWalletData: balanceResult.newWalletData,
            systemRevenue: balanceResult.systemRevenue,
            transaction: prepared.withdrawTransaction
        };
    } catch (err) {
        return {
            success: false,
            message: err.message
        };
    }
}

// ================================
// EXPORT GLOBAL
// ================================

window.SaquesYshipp = {
    canUserWithdraw,
    validateWithdrawAmount,
    validateWithdrawBalance,
    prepareWithdrawRequest,
    processWithdraw,
    executeWithdraw
};
