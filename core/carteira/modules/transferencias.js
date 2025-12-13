// modules/transferencias.js

// ================================
// TRANSFERÊNCIAS – YSHIPPBANK
// ================================
// Depende de:
// window.RegrasYshipp
// window.SaldoYshipp

// ================================
// VALIDAÇÕES
// ================================

function canTransfer(walletData, amount, currency) {
    if (!walletData) return false;
    if (typeof amount !== 'number' || amount <= 0) return false;

    const taxRate = window.RegrasYshipp.getTaxRate
        ? window.RegrasYshipp.getTaxRate('transfer', currency)
        : 0;

    const tax = amount * taxRate;
    const totalRequired = amount + tax;

    if (currency === 'reais') {
        return (walletData.reaisBalance || 0) >= totalRequired;
    }

    if (currency === 'golds') {
        return (walletData.goldsBalance || 0) >= totalRequired;
    }

    return false;
}

// ================================
// PREPARAÇÃO DA TRANSFERÊNCIA
// ================================

function prepareTransfer(senderId, recipientId, walletData, amount, currency) {
    if (!senderId || !recipientId || !walletData) {
        return { success: false, message: 'Dados insuficientes.' };
    }

    if (!canTransfer(walletData, amount, currency)) {
        return { success: false, message: 'Saldo insuficiente.' };
    }

    const taxRate = window.RegrasYshipp.getTaxRate
        ? window.RegrasYshipp.getTaxRate('transfer', currency)
        : 0;

    const tax = amount * taxRate;
    const netAmount = amount - tax;

    const senderTransaction = {
        type: 'send',
        currency,
        amount,
        tax,
        netAmount,
        date: new Date().toISOString(),
        from: senderId,
        to: recipientId,
        description: `Transferência enviada`
    };

    const recipientTransaction = {
        type: 'receive',
        currency,
        amount: netAmount,
        date: new Date().toISOString(),
        from: senderId,
        to: recipientId,
        description: `Transferência recebida`
    };

    return {
        success: true,
        tax,
        netAmount,
        senderTransaction,
        recipientTransaction
    };
}

// ================================
// PROCESSAMENTO DE SALDO
// ================================

function processTransferBalance(senderWallet, recipientWallet, amount, tax, currency) {
    if (!senderWallet || !recipientWallet) {
        throw new Error('Carteiras inválidas.');
    }

    const newSenderWallet = { ...senderWallet };
    const newRecipientWallet = { ...recipientWallet };

    const totalDebit = amount + tax;

    if (currency === 'reais') {
        newSenderWallet.reaisBalance -= totalDebit;
        newRecipientWallet.reaisBalance =
            (newRecipientWallet.reaisBalance || 0) + amount;
    }

    if (currency === 'golds') {
        newSenderWallet.goldsBalance -= totalDebit;
        newRecipientWallet.goldsBalance =
            (newRecipientWallet.goldsBalance || 0) + amount;
    }

    return {
        newSenderWallet,
        newRecipientWallet,
        systemRevenue: tax
    };
}

// ================================
// EXECUÇÃO COMPLETA
// ================================

function executeTransfer(data) {
    const {
        senderId,
        recipientId,
        senderWallet,
        recipientWallet,
        amount,
        currency
    } = data;

    const prepared = prepareTransfer(
        senderId,
        recipientId,
        senderWallet,
        amount,
        currency
    );

    if (!prepared.success) return prepared;

    try {
        const balanceResult = processTransferBalance(
            senderWallet,
            recipientWallet,
            amount,
            prepared.tax,
            currency
        );

        return {
            success: true,
            message: 'Transferência realizada com sucesso.',
            newSenderWallet: balanceResult.newSenderWallet,
            newRecipientWallet: balanceResult.newRecipientWallet,
            systemRevenue: balanceResult.systemRevenue,
            transactions: {
                sender: prepared.senderTransaction,
                recipient: prepared.recipientTransaction
            }
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

window.TransferenciasYshipp = {
    canTransfer,
    prepareTransfer,
    processTransferBalance,
    executeTransfer
};
