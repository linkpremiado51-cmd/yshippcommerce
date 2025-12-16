 <footer id="userInfoFooter">Usuário: <span id="footerUserName">Carregando...</span> | ID: <span id="footerUserId">---</span></footer>

    <script src="https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/11.0.1/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore-compat.js"></script>
    <script>
// =============================================
// CARTEIRA YSHIPPCOMMERCE - LÓGICA PRINCIPAL
// Versão: 2.1 (Corrigida e Refatorada com Persistência)
// =============================================

// ------------------------------
// 1. CONFIGURAÇÃO INICIAL E FIREBASE
// ------------------------------
// Certifique-se de que as bibliotecas Firebase (app, auth, firestore) foram
// carregadas via script tag antes deste código.

const firebaseConfig = {
    apiKey: "AIzaSyDbxygCeFLDbf6Ge6YZHJqq0VvlSSfbc_I",
    authDomain: "yshippcommerce.firebaseapp.com",
    projectId: "yshippcommerce",
    storageBucket: "yshippcommerce.appspot.com",
    messagingSenderId: "680576769517",
    appId: "1:680576769517:web:ace30d8e451ee70511dbe4"
};

// Inicialização do Firebase
// Adicionei uma verificação para evitar a reinicialização
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// ------------------------------
// 2. VARIÁVEIS GLOBAIS
// ------------------------------
let currentUser = null;
let walletData = null;
let allTransactions = [];
let sortOrder = { field: 'date', direction: 'desc' };
let pendingAction = null;
let transactionHistory = []; // Histórico para "undo"

// ------------------------------
// 3. CONSTANTES DE CONFIGURAÇÃO
// ------------------------------
const GOLD_TO_REAL_RATE = 1000;
const MIN_BALANCE = { reais: 10, golds: 100 };
const MAX_INVESTMENT = 1000000;
const MIN_INVESTMENT = 100;

// Taxas dinâmicas por operação
const TAX_RATES = {
    deposit: { reais: 0.02, golds: 0.01, profit_withdrawal: 0.05 },
    withdraw: { reais: 0.05, golds: 0.03 },
    transfer: { reais: 0.03, golds: 0.02 },
    conversion: { reais: 0.03, golds: 0.05 },
    invest: { golds: 0.05 },
    withdraw_invest: { golds: 0.10 }
};

// Planos de investimento disponíveis
const INVESTMENT_PLANS = {
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

// ------------------------------
// 4. FUNÇÕES UTILITÁRIAS
// ------------------------------

/**
 * Formata um valor monetário para o padrão brasileiro
 * @param {number} value - Valor a ser formatado
 * @returns {string} Valor formatado
 */
function formatCurrency(value) {
    if (value == null || isNaN(value)) return '0,00';
    return Number(value).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Formata um input de moeda (ex: 1000 -> 1.000,00)
 * @param {HTMLInputElement} input - Elemento de input
 */
function formatInputCurrency(input) {
    let value = input.value.replace(/\D/g, '');
    value = value.padStart(3, '0');
    const cents = value.slice(-2);
    const integer = value.slice(0, -2) || '0';
    const formattedInteger = parseInt(integer).toLocaleString('pt-BR');
    input.value = `${formattedInteger},${cents}`;
}

/**
 * Formata um input de número inteiro
 * @param {HTMLInputElement} input - Elemento de input
 */
function formatInputInteger(input) {
    input.value = input.value.replace(/\D/g, '');
}

/**
 * Valida uma chave PIX
 * @param {string} key - Chave PIX
 * @param {string} inputId - ID do input para exibir erros
 * @returns {boolean} True se válida
 */
function validatePixKey(key, inputId) {
    const inputEl = document.getElementById(inputId);
    const errorEl = document.getElementById(`${inputId}-error`);
    if (!inputEl || !errorEl) return true; // Ignora se os elementos não existirem

    inputEl.classList.remove('is-invalid');
    errorEl.style.display = 'none';

    if (!key) return true;

    const cleanedKey = key.replace(/[^a-zA-Z0-9@.\-\_]/g, '');
    inputEl.value = cleanedKey;

    // Regex para chaves PIX (corrigido: removido \$, ajustado para chaves)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cpfCnpjRegex = /^(\d{11}|\d{14})$/;
    const phoneRegex = /^(\+55)?\d{10,11}$/;
    const randomRegex = /^[a-zA-Z0-9\-]{26,36}$/;

    const isValid = emailRegex.test(cleanedKey) ||
                   cpfCnpjRegex.test(cleanedKey) ||
                   phoneRegex.test(cleanedKey.replace(/[\(\)\-\s\+]/g, '')) ||
                   randomRegex.test(cleanedKey);

    if (!isValid) {
        inputEl.classList.add('is-invalid');
        errorEl.textContent = 'Formato de chave PIX inválido (use CPF, e-mail, telefone ou chave aleatória)';
        errorEl.style.display = 'block';
    }
    return isValid;
}

/**
 * Obtém a taxa para uma operação específica
 * @param {string} operationType - Tipo de operação
 * @param {string} currency - Moeda (reais/golds)
 * @returns {number} Taxa aplicável
 */
function getTaxRate(operationType, currency) {
    if (operationType === 'profit_withdrawal') {
        return TAX_RATES.deposit.profit_withdrawal;
    }
    return TAX_RATES[operationType]?.[currency] || 0.05;
}

/**
 * Verifica se um investimento está em período de lock-in
 * @param {Date|firebase.firestore.Timestamp|string} initialDate - Data inicial
 * @param {number} lockInDays - Dias de lock-in
 * @returns {boolean} True se estiver bloqueado
 */
function isInvestmentLocked(initialDate, lockInDays) {
    if (!initialDate || lockInDays <= 0) return false;

    const start = initialDate instanceof firebase.firestore.Timestamp
        ? initialDate.toDate()
        : new Date(initialDate);

    const lockInPeriodEnd = new Date(start);
    lockInPeriodEnd.setDate(lockInPeriodEnd.getDate() + lockInDays);

    return new Date() < lockInPeriodEnd;
}

/**
 * Calcula o retorno atual de um investimento
 * @param {string} investmentId - ID do investimento
 * @param {number} investedAmount - Valor investido
 * @param {Date|firebase.firestore.Timestamp|string} initialDate - Data inicial
 * @returns {number} Retorno acumulado
 */
function calculateCurrentReturn(investmentId, investedAmount, initialDate) {
    const plan = INVESTMENT_PLANS[investmentId];
    if (!plan || investedAmount <= 0 || !initialDate) return 0;

    const now = new Date();
    const start = initialDate instanceof firebase.firestore.Timestamp
        ? initialDate.toDate()
        : new Date(initialDate);

    if (start > now) return 0;

    const diffTime = now - start;
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    const ratePerDay = plan.returnRate / 30; // Considerando retorno mensal / 30 dias
    const totalReturnRate = diffDays * ratePerDay;

    return Math.floor(investedAmount * totalReturnRate);
}

/**
 * Calcula o retorno diário de um investimento
 * @param {string} investmentId - ID do investimento
 * @param {number} investedAmount - Valor investido
 * @returns {number} Retorno diário
 */
function calculateDailyReturn(investmentId, investedAmount) {
    const plan = INVESTMENT_PLANS[investmentId];
    if (!plan || investedAmount <= 0) return 0;
    return Math.floor((investedAmount * plan.returnRate) / 30);
}

/**
 * Calcula o retorno mensal de um investimento
 * @param {string} investmentId - ID do investimento
 * @param {number} investedAmount - Valor investido
 * @returns {number} Retorno mensal
 */
function calculateMonthlyReturn(investmentId, investedAmount) {
    const plan = INVESTMENT_PLANS[investmentId];
    if (!plan || investedAmount <= 0) return 0;
    return Math.floor(investedAmount * plan.returnRate);
}

/**
 * Calcula o retorno anual de um investimento
 * @param {string} investmentId - ID do investimento
 * @param {number} investedAmount - Valor investido
 * @returns {number} Retorno anual
 */
function calculateYearlyReturn(investmentId, investedAmount) {
    const plan = INVESTMENT_PLANS[investmentId];
    if (!plan || investedAmount <= 0) return 0;
    return Math.floor(investedAmount * plan.returnRate * 12);
}

/**
 * Debounce para evitar chamadas excessivas
 * @param {Function} func - Função a ser executada
 * @param {number} delay - Atraso em ms
 * @returns {Function} Função com debounce
 */
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Exibe um loading
 * @param {string} actionId - ID da ação
 */
function showLoading(actionId) {
    const loadingEl = document.getElementById(`${actionId}-loading`);
    if (loadingEl) loadingEl.classList.add('active');
}

/**
 * Esconde um loading
 * @param {string} actionId - ID da ação
 */
function hideLoading(actionId) {
    const loadingEl = document.getElementById(`${actionId}-loading`);
    if (loadingEl) loadingEl.classList.remove('active');
}

/**
 * Exibe uma notificação
 * @param {string} title - Título
 * @param {string} message - Mensagem
 * @param {boolean} isError - Se é um erro
 */
function showNotification(title, message, isError = false) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    notification.innerHTML = `<strong>${title}:</strong> ${message}`;
    notification.className = `notification ${isError ? 'error' : 'success'}`;
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 5000);
}

/**
 * Abre um modal
 * @param {string} id - ID do modal
 */
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
}

/**
 * Fecha um modal
 * @param {string} id - ID do modal
 */
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
        // Limpa os inputs do modal
        const inputs = modal.querySelectorAll('input');
        inputs.forEach(input => {
            input.value = '';
            input.classList.remove('is-invalid');
        });
        modal.querySelectorAll('.validation-error').forEach(el => {
            el.style.display = 'none';
        });
    }
}

// ------------------------------
// 5. FUNÇÕES DE PERSISTÊNCIA
// ------------------------------

/**
 * Salva os dados da carteira no Firebase e localStorage
 * @param {Object} updated - Dados atualizados
 */
async function saveWallet(updated) {
    if (!currentUser?.uid) {
        console.error("Usuário não autenticado. Salvando apenas localmente.");
        localStorage.setItem(`wallet_${currentUser?.uid || 'anonymous'}`, JSON.stringify(updated));
        walletData = { ...walletData, ...updated };
        allTransactions = walletData.transactions || [];
        renderWallet();
        return;
    }

    try {
        // Salva no Firebase
        await db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(currentUser.uid).set(updated, { merge: true });

        // Salva no localStorage como backup
        localStorage.setItem(`wallet_${currentUser.uid}`, JSON.stringify(updated));

        // Atualiza os dados locais
        walletData = { ...walletData, ...updated };
        allTransactions = walletData.transactions || [];
        renderWallet();
    } catch (err) {
        console.error("Erro ao salvar no Firebase:", err);
        localStorage.setItem(`wallet_${currentUser.uid}`, JSON.stringify(updated));
        walletData = { ...walletData, ...updated };
        allTransactions = walletData.transactions || [];
        renderWallet();
        showNotification('Aviso', 'Dados salvos localmente. Sincronize quando a conexão for restaurada.', true);
    }
}

/**
 * Faz backup dos dados antes de operações críticas
 */
async function backupWalletData() {
    if (!walletData || !currentUser?.uid) return;
    localStorage.setItem(`walletBackup_${currentUser.uid}`, JSON.stringify(walletData));
    console.log("Backup realizado com sucesso.");
}

/**
 * Restaura dados do backup em caso de falha
 */
async function restoreWalletData() {
    if (!currentUser?.uid) return;

    const backup = localStorage.getItem(`walletBackup_${currentUser.uid}`);
    if (backup) {
        walletData = JSON.parse(backup);
        try {
            await saveWallet(walletData);
            console.log("Dados restaurados do backup.");
        } catch (err) {
            console.error("Não foi possível restaurar no Firebase:", err);
            showNotification('Aviso', 'Dados restaurados localmente. Tente sincronizar manualmente.', true);
        }
    }
}

/**
 * Adiciona uma transação ao histórico
 * @param {Object} tx - Transação
 */
async function pushTransaction(tx) {
    if (!walletData) walletData = { transactions: [] };

    // Adiciona metadata para permitir "undo"
    tx.metadata = {
        ...tx.metadata,
        canUndo: true,
        undoTimeout: Date.now() + 300000, // 5 minutos para desfazer
        originalBalances: {
            reais: walletData.reaisBalance,
            golds: walletData.goldsBalance
        }
    };

    transactionHistory.push(tx);
    const arr = Array.isArray(walletData.transactions) ? walletData.transactions : [];
    arr.push(tx);
    await saveWallet({ transactions: arr });
}

/**
 * Adiciona uma taxa ao histórico
 * @param {Object} tax - Taxa
 */
async function pushTax(tax) {
    if (!walletData) walletData = { taxes: [] };
    const arr = Array.isArray(walletData.taxes) ? walletData.taxes : [];
    arr.push(tax);
    await saveWallet({ taxes: arr });
}

/**
 * Atualiza as reservas do sistema
 * @param {number} amount - Valor
 * @param {string} currency - Moeda
 */
async function updateSystemReserves(amount, currency) {
    try {
        const reserveRef = db.collection('system').doc('reserves');
        const reserveSnap = await reserveRef.get();
        let newReserves = reserveSnap.exists ? reserveSnap.data() : { reais: 0 };

        if (currency === 'reais') {
            newReserves.reais = (newReserves.reais || 0) + amount;
        } else if (currency === 'golds') {
            newReserves.reais = (newReserves.reais || 0) + (amount / GOLD_TO_REAL_RATE);
        }

        await reserveRef.set(newReserves, { merge: true });
    } catch (err) {
        console.error('Erro ao atualizar reservas:', err);
    }
}

// ------------------------------
// 6. FUNÇÕES DE VALIDAÇÃO
// ------------------------------

/**
 * Valida saldo mínimo
 * @param {string} currency - Moeda
 * @param {number} amount - Valor
 * @param {number} tax - Taxa
 * @returns {boolean} True se válido
 */
function validateMinimumBalance(currency, amount, tax = 0) {
    const balance = walletData[`${currency}Balance`] || 0;
    const totalCost = amount + tax;
    const minBalance = MIN_BALANCE[currency] || 0;

    if (balance - totalCost < minBalance) {
        showNotification('Erro', `Saldo mínimo de ${minBalance.toLocaleString('pt-BR')} ${currency === 'reais' ? 'R$' : '🪙'} é obrigatório.`, true);
        return false;
    }
    return true;
}

/**
 * Valida saldo suficiente
 * @param {string} currency - Moeda
 * @param {number} amount - Valor
 * @param {number} tax - Taxa
 * @returns {boolean} True se válido
 */
function validateBalance(currency, amount, tax = 0) {
    const balance = walletData[`${currency}Balance`] || 0;
    const totalCost = amount + tax;

    if (balance < totalCost) {
        showNotification('Erro', `Saldo insuficiente em ${currency === 'reais' ? 'Reais' : 'Golds'}.`, true);
        return false;
    }
    return true;
}

/**
 * Valida se um usuário existe
 * @param {string} userId - ID do usuário
 * @returns {Promise<boolean>} True se existir
 */
async function validateUserId(userId) {
    if (!userId || userId === currentUser?.uid) return false;
    try {
        const userDoc = await db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(userId).get();
        return userDoc.exists;
    } catch (err) {
        console.error('Erro ao validar usuário:', err);
        return false;
    }
}

// ------------------------------
// 7. FUNÇÕES DE OPERAÇÕES FINANCEIRAS
// ------------------------------

/**
 * Processa um depósito
 */
async function processDeposit() {
    try {
        const amountInput = document.getElementById('deposit-amount');
        const method = document.getElementById('deposit-method').value;
        const pixKey = document.getElementById('deposit-pix-key').value;

        const amount = parseFloat(amountInput.value.replace(/\./g, '').replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
            showNotification('Erro', 'Valor de depósito inválido.', true);
            return;
        }

        if (method === 'pix' && !validatePixKey(pixKey, 'deposit-pix-key')) {
            return;
        }

        const taxRate = getTaxRate('deposit', 'reais');
        const tax = amount * taxRate;
        const netAmount = amount - tax;

        pendingAction = {
            type: 'deposit',
            amount,
            netAmount,
            tax,
            method,
            pixKey
        };

        document.getElementById('confirmation-title').textContent = 'Confirmação de Depósito';
        document.getElementById('confirmation-message').innerHTML = `
            <p>Confirma o depósito de <strong>R$ ${formatCurrency(amount)}</strong> via ${method.toUpperCase()}?</p>
            <p>Valor líquido: <strong>R$ ${formatCurrency(netAmount)}</strong></p>
            <p>Taxa: <strong>R$ ${formatCurrency(tax)}</strong></p>
        `;
        openModal('confirmationModal');
    } catch (err) {
        console.error('Erro ao processar depósito:', err);
        showNotification('Erro', 'Não foi possível processar o depósito.', true);
    }
}

/**
 * Confirma um depósito
 */
async function processDepositConfirmed() {
    if (!pendingAction) return;

    try {
        closeModal('confirmationModal');
        await backupWalletData();

        const { amount, netAmount, tax, method, pixKey } = pendingAction;

        // Atualiza o saldo
        await saveWallet({
            reaisBalance: (walletData.reaisBalance || 0) + netAmount
        });

        // Registra a transação
        await pushTransaction({
            type: 'deposit',
            amount: netAmount,
            currency: 'reais',
            description: `Depósito via ${method.toUpperCase()}`,
            date: new Date().toISOString(),
            metadata: {
                method,
                fullAmount: amount,
                tax,
                pixKey: method === 'pix' ? pixKey : undefined,
                canUndo: true,
                undoTimeout: Date.now() + 300000
            }
        });

        // Registra a taxa
        await pushTax({
            type: 'deposit',
            amount: tax,
            currency: 'reais',
            date: new Date().toISOString()
        });

        // Atualiza reservas do sistema
        await updateSystemReserves(tax, 'reais');

        closeModal('depositModal');
        showNotification('Sucesso', `Depósito de R$ ${formatCurrency(netAmount)} realizado com sucesso!`);
    } catch (err) {
        console.error('Erro ao confirmar depósito:', err);
        await restoreWalletData();
        showNotification('Erro', 'Falha ao confirmar depósito.', true);
    } finally {
        pendingAction = null;
        hideLoading('deposit');
    }
}

/**
 * Processa um saque
 */
function confirmWithdrawal() {
    try {
        const currency = document.getElementById('withdraw-currency').value;
        const amountInput = document.getElementById('withdraw-amount');
        const pixKeyInput = document.getElementById('withdraw-pix-key');

        const amount = parseFloat(amountInput.value.replace(/\./g, '').replace(',', '.'));
        const pixKey = pixKeyInput.value.trim();

        if (isNaN(amount) || amount <= 0) {
            showNotification('Erro', 'Valor de saque inválido.', true);
            return;
        }

        if (currency === 'reais' && !validatePixKey(pixKey, 'withdraw-pix-key')) {
            return;
        }

        const taxRate = getTaxRate('withdraw', currency);
        const tax = amount * taxRate;
        const netAmount = amount - tax;

        if (!validateBalance(currency, amount, tax)) return;
        if (!validateMinimumBalance(currency, amount, tax)) return;

        pendingAction = {
            type: 'withdraw',
            currency,
            amount,
            tax,
            netAmount,
            pixKey
        };

        const symbol = currency === 'reais' ? 'R$' : '';
        document.getElementById('confirmation-title').textContent = 'Confirmação de Saque';
        document.getElementById('confirmation-message').innerHTML = `
            <p>Confirma o saque de <strong>${amount.toLocaleString('pt-BR')} ${symbol}</strong>?</p>
            <p>Valor líquido: <strong>${netAmount.toLocaleString('pt-BR')} ${symbol}</strong></p>
            <p>Taxa: <strong>${tax.toLocaleString('pt-BR')} ${symbol}</strong></p>
        `;
        openModal('confirmationModal');
    } catch (err) {
        console.error('Erro ao processar saque:', err);
        showNotification('Erro', 'Não foi possível processar o saque.', true);
    }
}

/**
 * Confirma um saque
 */
async function processWithdrawalConfirmed() {
    if (!pendingAction) return;

    try {
        closeModal('confirmationModal');
        await backupWalletData();
        const { currency, amount, tax, netAmount, pixKey } = pendingAction;

        if (currency === 'reais') {
            await saveWallet({
                reaisBalance: (walletData.reaisBalance || 0) - (amount + tax)
            });
        } else {
            await saveWallet({
                goldsBalance: (walletData.goldsBalance || 0) - (amount + tax)
            });
        }

        const symbol = currency === 'reais' ? 'R$' : '';
        await pushTransaction({
            type: 'withdraw',
            amount,
            currency,
            description: `Saque de ${amount.toLocaleString('pt-BR')} ${symbol}`,
            date: new Date().toISOString(),
            metadata: {
                pixKey: currency === 'reais' ? pixKey : undefined,
                tax,
                canUndo: false // Saques não podem ser desfeitos
            }
        });

        await pushTax({
            type: 'withdraw',
            amount: tax,
            currency,
            date: new Date().toISOString()
        });

        await updateSystemReserves(tax, currency);

        closeModal('withdrawModal');
        showNotification('Sucesso', `Saque de ${netAmount.toLocaleString('pt-BR')} ${symbol} realizado com sucesso!`);
    } catch (err) {
        console.error('Erro ao confirmar saque:', err);
        await restoreWalletData();
        showNotification('Erro', 'Falha ao confirmar saque.', true);
    } finally {
        pendingAction = null;
        hideLoading('withdraw');
    }
}

/**
 * Processa uma transferência
 */
async function confirmTransfer() {
    try {
        const recipientId = document.getElementById('recipient-id').value.trim();
        const currency = document.getElementById('transfer-currency').value;
        const amountInput = document.getElementById('transfer-amount');

        const amount = parseFloat(amountInput.value.replace(/\./g, '').replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
            showNotification('Erro', 'Valor de transferência inválido.', true);
            return;
        }

        if (!recipientId) {
            showNotification('Erro', 'Informe o ID do destinatário.', true);
            return;
        }

        if (recipientId === currentUser?.uid) {
            showNotification('Erro', 'Não é possível transferir para si mesmo.', true);
            return;
        }

        const isValidRecipient = await validateUserId(recipientId);
        if (!isValidRecipient) {
            showNotification('Erro', 'Destinatário não encontrado.', true);
            return;
        }

        const taxRate = getTaxRate('transfer', currency);
        const tax = amount * taxRate;
        const netAmount = amount - tax;

        if (!validateBalance(currency, amount, tax)) return;
        if (!validateMinimumBalance(currency, amount, tax)) return;

        pendingAction = {
            type: 'transfer',
            recipientId,
            currency,
            amount,
            tax,
            netAmount
        };

        const symbol = currency === 'reais' ? 'R$' : '';
        document.getElementById('confirmation-title').textContent = 'Confirmação de Transferência';
        document.getElementById('confirmation-message').innerHTML = `
            <p>Confirma a transferência de <strong>${amount.toLocaleString('pt-BR')} ${symbol}</strong>
            para <strong>${recipientId}</strong>?</p>
            <p>Valor líquido: <strong>${netAmount.toLocaleString('pt-BR')} ${symbol}</strong></p>
            <p>Taxa: <strong>${tax.toLocaleString('pt-BR')} ${symbol}</strong></p>
        `;
        openModal('confirmationModal');
    } catch (err) {
        console.error('Erro ao processar transferência:', err);
        showNotification('Erro', 'Não foi possível processar a transferência.', true);
    }
}

/**
 * Confirma uma transferência
 */
async function processTransferConfirmed() {
    if (!pendingAction) return;

    try {
        closeModal('confirmationModal');
        await backupWalletData();
        const { recipientId, currency, amount, tax } = pendingAction;

        const batch = db.batch();
        const senderRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(currentUser.uid);
        const recipientRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(recipientId);

        // Atualiza o remetente
        batch.update(senderRef, {
            [`${currency}Balance`]: firebase.firestore.FieldValue.increment(-(amount + tax)),
            transactions: firebase.firestore.FieldValue.arrayUnion({
                type: 'send',
                amount: amount, // Valor enviado (bruto)
                currency,
                description: `Transferência para ${recipientId}`,
                date: new Date().toISOString(),
                to: recipientId,
                metadata: {
                    tax,
                    netAmount: amount - tax,
                    canUndo: true,
                    undoTimeout: Date.now() + 300000,
                    originalBalances: {
                        reais: walletData.reaisBalance,
                        golds: walletData.goldsBalance
                    }
                }
            }),
            taxes: firebase.firestore.FieldValue.arrayUnion({
                type: 'transfer',
                amount: tax,
                currency,
                date: new Date().toISOString()
            })
        });

        // Atualiza o destinatário (recebe o valor bruto sem a taxa do remetente, ou seja, amount)
        batch.update(recipientRef, {
            [`${currency}Balance`]: firebase.firestore.FieldValue.increment(amount),
            transactions: firebase.firestore.FieldValue.arrayUnion({
                type: 'receive',
                amount,
                currency,
                description: `Recebido de ${currentUser.uid}`,
                date: new Date().toISOString(),
                from: currentUser.uid,
                metadata: { canUndo: false }
            })
        });

        await batch.commit();
        await updateSystemReserves(tax, currency);

        closeModal('transferModal');
        const symbol = currency === 'reais' ? 'R$' : '';
        showNotification('Sucesso', `Transferência de ${amount.toLocaleString('pt-BR')} ${symbol} realizada com sucesso!`);
    } catch (err) {
        console.error('Erro ao confirmar transferência:', err);
        await restoreWalletData();
        showNotification('Erro', 'Falha ao confirmar transferência.', true);
    } finally {
        pendingAction = null;
        hideLoading('transfer');
    }
}

/**
 * Processa uma conversão de moedas
 */
async function processConversion() {
    try {
        const from = document.getElementById('convert-from').value;
        const to = document.getElementById('convert-to').value;
        const amountInput = document.getElementById('convert-amount');

        const amount = parseFloat(amountInput.value.replace(/\./g, '').replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
            showNotification('Erro', 'Valor de conversão inválido.', true);
            return;
        }

        if (from === to) {
            showNotification('Erro', 'Selecione moedas diferentes para conversão.', true);
            return;
        }

        const taxRate = getTaxRate('conversion', from);
        const tax = amount * taxRate;
        const netAmount = amount - tax;

        if (from === 'golds' && !validateBalance('golds', amount, tax)) return;
        if (from === 'reais' && !validateBalance('reais', amount, tax)) return;

        let convertedAmount;

        if (from === 'golds' && to === 'reais') {
            convertedAmount = netAmount / GOLD_TO_REAL_RATE;
        } else if (from === 'reais' && to === 'golds') {
            convertedAmount = Math.floor(netAmount * GOLD_TO_REAL_RATE);
        } else {
            showNotification('Erro', 'Conversão não suportada.', true);
            return;
        }

        pendingAction = {
            type: 'conversion',
            from,
            to,
            amount,
            tax,
            convertedAmount
        };

        const fromSymbol = from === 'golds' ? '' : 'R$';
        const toSymbol = to === 'golds' ? '' : 'R$';

        document.getElementById('confirmation-title').textContent = 'Confirmação de Conversão';
        document.getElementById('confirmation-message').innerHTML = `
            <p>Confirma a conversão de <strong>${amount.toLocaleString('pt-BR')} ${fromSymbol}</strong>
            para <strong>${convertedAmount.toLocaleString('pt-BR')} ${toSymbol}</strong>?</p>
            <p>Taxa: <strong>${tax.toLocaleString('pt-BR')} ${fromSymbol}</strong></p>
        `;
        openModal('confirmationModal');
    } catch (err) {
        console.error('Erro ao processar conversão:', err);
        showNotification('Erro', 'Não foi possível processar a conversão.', true);
    }
}

/**
 * Confirma uma conversão
 */
async function processConversionConfirmed() {
    if (!pendingAction) return;

    try {
        closeModal('confirmationModal');
        await backupWalletData();
        const { from, to, amount, tax, convertedAmount } = pendingAction;

        const updates = {
            [`${from}Balance`]: (walletData[`${from}Balance`] || 0) - (amount + tax),
            [`${to}Balance`]: (walletData[`${to}Balance`] || 0) + convertedAmount
        };

        await saveWallet(updates);

        const fromSymbol = from === 'golds' ? '🪙' : 'R$';
        const toSymbol = to === 'golds' ? '' : 'R$';

        await pushTransaction({
            type: 'conversion',
            amount,
            from,
            to,
            convertedAmount,
            currency: from,
            description: `Conversão de ${amount.toLocaleString('pt-BR')} ${fromSymbol} para ${convertedAmount.toLocaleString('pt-BR')} ${toSymbol}`,
            date: new Date().toISOString(),
            metadata: {
                tax,
                originalBalances: {
                    reais: walletData.reaisBalance,
                    golds: walletData.goldsBalance
                },
                canUndo: true,
                undoTimeout: Date.now() + 300000
            }
        });

        await pushTax({
            type: 'conversion',
            amount: tax,
            currency: from,
            date: new Date().toISOString()
        });

        closeModal('convertModal');
        showNotification('Sucesso', `Conversão de ${amount.toLocaleString('pt-BR')} ${fromSymbol} para ${convertedAmount.toLocaleString('pt-BR')} ${toSymbol} realizada com sucesso!`);
    } catch (err) {
        console.error('Erro ao confirmar conversão:', err);
        await restoreWalletData();
        showNotification('Erro', 'Falha ao confirmar conversão.', true);
    } finally {
        pendingAction = null;
        hideLoading('conversion');
    }
}

/**
 * Processa um investimento
 */
async function processInvest() {
    try {
        const companySelect = document.getElementById('invest-company');
        const amountInput = document.getElementById('invest-amount');

        const companyId = companySelect.value;
        const amount = parseInt(amountInput.value.replace(/\D/g, ''));

        if (!companyId || !INVESTMENT_PLANS[companyId]) {
            showNotification('Erro', 'Selecione uma empresa válida.', true);
            return;
        }

        const plan = INVESTMENT_PLANS[companyId];
        if (isNaN(amount) || amount < plan.minInvest) {
            showNotification('Erro', `Investimento mínimo para ${plan.name} é ${plan.minInvest.toLocaleString('pt-BR')} `, true);
            return;
        }

        if (amount > MAX_INVESTMENT) {
            showNotification('Erro', `Investimento máximo é ${MAX_INVESTMENT.toLocaleString('pt-BR')} `, true);
            return;
        }

        const taxRate = getTaxRate('invest', 'golds');
        const tax = Math.ceil(amount * taxRate);
        const totalCost = amount + tax;

        if (!validateBalance('golds', amount, tax)) return;
        if (!validateMinimumBalance('golds', amount, tax)) return;

        pendingAction = {
            type: 'invest',
            companyId,
            amount,
            tax,
            totalCost,
            plan
        };

        document.getElementById('confirmation-title').textContent = 'Confirmação de Investimento';
        document.getElementById('confirmation-message').innerHTML = `
            <p>Confirma o investimento de <strong>${amount.toLocaleString('pt-BR')} </strong>
            em <strong>${plan.name}</strong>?</p>
            <p>Taxa: <strong>${tax.toLocaleString('pt-BR')} </strong></p>
            <p>Retorno mensal estimado: <strong>${Math.floor(amount * plan.returnRate).toLocaleString('pt-BR')} </strong></p>
            <p>Período de lock-in: <strong>${plan.lockInDays} dias</strong></p>
        `;
        openModal('confirmationModal');
    } catch (err) {
        console.error('Erro ao processar investimento:', err);
        showNotification('Erro', 'Não foi possível processar o investimento.', true);
    }
}

/**
 * Confirma um investimento
 */
async function processInvestConfirmed() {
    if (!pendingAction) return;

    try {
        closeModal('confirmationModal');
        await backupWalletData();
        const { companyId, amount, tax, totalCost, plan } = pendingAction;

        const batch = db.batch();
        const walletRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(currentUser.uid);
        const currentInvestment = walletData.investments?.[companyId] || { amount: 0 };
        const newInvestmentAmount = (currentInvestment.amount || 0) + amount;

        // Atualiza o saldo de Golds
        batch.update(walletRef, {
            goldsBalance: firebase.firestore.FieldValue.increment(-totalCost),
            [`investments.${companyId}`]: {
                amount: newInvestmentAmount,
                date: currentInvestment.amount === 0 ? new Date().toISOString() : currentInvestment.date, // Mantém a data se já houver investimento
                planId: companyId
            }
        });

        // Registra a transação
        batch.update(walletRef, {
            transactions: firebase.firestore.FieldValue.arrayUnion({
                type: 'invest',
                amount,
                currency: 'golds',
                description: `Investimento em ${plan.name}`,
                date: new Date().toISOString(),
                metadata: {
                    company: companyId,
                    tax,
                    planName: plan.name,
                    returnRate: plan.returnRate,
                    lockInDays: plan.lockInDays,
                    canUndo: true,
                    undoTimeout: Date.now() + 300000,
                    originalBalances: {
                        golds: walletData.goldsBalance,
                        reais: walletData.reaisBalance // Incluir reais por segurança
                    }
                }
            })
        });

        // Registra a taxa
        batch.update(walletRef, {
            taxes: firebase.firestore.FieldValue.arrayUnion({
                type: 'invest',
                amount: tax,
                currency: 'golds',
                date: new Date().toISOString(),
                description: `Taxa de investimento em ${plan.name}`
            })
        });

        await batch.commit();
        await updateSystemReserves(tax / GOLD_TO_REAL_RATE, 'reais');

        closeModal('investModal');
        showNotification('Sucesso', `Investimento de ${amount.toLocaleString('pt-BR')}  em ${plan.name} realizado com sucesso!`);
    } catch (err) {
        console.error('Erro ao confirmar investimento:', err);
        await restoreWalletData();
        showNotification('Erro', 'Falha ao confirmar investimento.', true);
    } finally {
        pendingAction = null;
        hideLoading('invest');
    }
}

/**
 * Processa a retirada de um investimento
 */
async function confirmWithdrawalInvestment() {
    try {
        const companySelect = document.getElementById('withdraw-invest-company');
        const amountInput = document.getElementById('withdraw-invest-amount');

        const companyId = companySelect.value;
        let amountToWithdraw = parseInt(amountInput.value.replace(/\D/g, ''));

        if (!companyId || !INVESTMENT_PLANS[companyId]) {
            showNotification('Erro', 'Selecione um investimento válido.', true);
            return;
        }

        const investment = walletData.investments?.[companyId];
        const plan = INVESTMENT_PLANS[companyId];

        if (!investment || investment.amount <= 0) {
            showNotification('Erro', 'Investimento não encontrado ou com saldo zero.', true);
            return;
        }

        const investedAmount = investment.amount;
        amountToWithdraw = amountToWithdraw || investedAmount;

        if (isNaN(amountToWithdraw) || amountToWithdraw <= 0 || amountToWithdraw > investedAmount) {
            showNotification('Erro', `Valor inválido. Máximo: ${investedAmount.toLocaleString('pt-BR')} `, true);
            return;
        }

        const accumulatedReturn = calculateCurrentReturn(companyId, investedAmount, investment.date);
        const isLocked = isInvestmentLocked(investment.date, plan.lockInDays);

        // Cálculo da Taxa/Penalidade sobre o valor total a ser retirado (Principal + Lucro)
        const totalGrossWithdrawal = amountToWithdraw + accumulatedReturn;
        const totalTaxRate = getTaxRate('withdraw_invest', 'golds');
        const finalPenalty = Math.ceil(totalGrossWithdrawal * totalTaxRate);
        const finalAmount = totalGrossWithdrawal - finalPenalty;

        if (finalAmount <= 0) {
            showNotification('Erro', 'Valor líquido de retirada é zero ou negativo após taxas.', true);
            return;
        }

        pendingAction = {
            type: 'withdraw_investment',
            companyId,
            amountToWithdraw,
            accumulatedReturn,
            finalPenalty,
            finalAmount,
            plan,
            isLocked
        };

        document.getElementById('confirmation-title').textContent = 'Confirmação de Retirada';
        document.getElementById('confirmation-message').innerHTML = `
            <p>Confirma a retirada de <strong>${finalAmount.toLocaleString('pt-BR')} </strong>
            (líquido) de <strong>${plan.name}</strong>?</p>
            <p>Valor bruto: <strong>${amountToWithdraw.toLocaleString('pt-BR')} </strong>
            (Principal) + <strong>${accumulatedReturn.toLocaleString('pt-BR')} </strong>
            (Retorno)</p>
            <p>Taxas/Penalidades: <strong>${finalPenalty.toLocaleString('pt-BR')} </strong></p>
            ${isLocked ? '<p style="color: var(--accent)"><strong>Atenção:</strong> Este investimento está em período de lock-in. Penalidades aplicadas.</p>' : ''}
        `;
        openModal('confirmationModal');
    } catch (err) {
        console.error('Erro ao processar retirada de investimento:', err);
        showNotification('Erro', 'Não foi possível processar a retirada do investimento.', true);
    }
}

/**
 * Confirma a retirada de um investimento
 */
async function processWithdrawalInvestmentConfirmed() {
    if (!pendingAction) return;

    try {
        closeModal('confirmationModal');
        await backupWalletData();
        const { companyId, amountToWithdraw, finalPenalty, finalAmount, plan, accumulatedReturn } = pendingAction;

        const batch = db.batch();
        const walletRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(currentUser.uid);

        // O lucro total acumulado do investimento deve ser zerado ao retirar
        const totalProfitToDeduct = accumulatedReturn;

        // Atualiza o saldo de Golds e o investimento (reduz o valor investido pelo amountToWithdraw)
        batch.update(walletRef, {
            goldsBalance: firebase.firestore.FieldValue.increment(finalAmount),
            [`investments.${companyId}.amount`]: firebase.firestore.FieldValue.increment(-amountToWithdraw),
            portfolioBalance: firebase.firestore.FieldValue.increment(-totalProfitToDeduct) // Remove o lucro acumulado da carteira
        });

        // Registra a transação
        batch.update(walletRef, {
            transactions: firebase.firestore.FieldValue.arrayUnion({
                type: 'withdraw_invest',
                amount: finalAmount,
                currency: 'golds',
                description: `Retirada de ${amountToWithdraw}  investidos em ${plan.name} (+${accumulatedReturn}  lucro, -${finalPenalty} 🪙 taxa)`,
                date: new Date().toISOString(),
                metadata: {
                    company: companyId,
                    principalWithdrawn: amountToWithdraw,
                    finalReturn: accumulatedReturn,
                    penalty: finalPenalty,
                    canUndo: false
                }
            })
        });

        // Registra a taxa/penalidade
        batch.update(walletRef, {
            taxes: firebase.firestore.FieldValue.arrayUnion({
                type: 'withdraw_invest_penalty',
                amount: finalPenalty,
                currency: 'golds',
                description: pendingAction.isLocked
                    ? 'Retirada antecipada (lock-in) + Taxa'
                    : 'Taxa de retirada de investimento',
                date: new Date().toISOString()
            })
        });

        await batch.commit();
        closeModal('withdrawInvestModal');
        showNotification('Sucesso', `Retirada de ${finalAmount.toLocaleString('pt-BR')}  de ${plan.name} realizada com sucesso!`);
    } catch (err) {
        console.error('Erro ao confirmar retirada de investimento:', err);
        await restoreWalletData();
        showNotification('Erro', 'Falha ao confirmar retirada do investimento.', true);
    } finally {
        pendingAction = null;
        hideLoading('withdraw_investment');
    }
}

/**
 * Processa o resgate de lucro
 */
async function confirmProfitWithdrawal() {
    try {
        const portfolioBalance = walletData.portfolioBalance || 0;

        if (portfolioBalance <= 0) {
            showNotification('Erro', 'Não há lucro acumulado para resgatar.', true);
            return;
        }

        const taxRate = getTaxRate('profit_withdrawal', 'golds');
        const tax = Math.ceil(portfolioBalance * taxRate);
        const finalAmount = portfolioBalance - tax;

        if (finalAmount <= 0) {
            showNotification('Erro', 'Valor insuficiente após taxas.', true);
            return;
        }

        pendingAction = {
            type: 'profit_withdrawal',
            amount: portfolioBalance,
            tax,
            finalAmount
        };

        document.getElementById('confirmation-title').textContent = 'Confirmação de Resgate de Lucro';
        document.getElementById('confirmation-message').innerHTML = `
            <p>Confirma o resgate de <strong>${portfolioBalance.toLocaleString('pt-BR')} </strong>
            de lucro acumulado?</p>
            <p>Valor líquido após taxa: <strong>${finalAmount.toLocaleString('pt-BR')} </strong></p>
            <p>Taxa: <strong>${tax.toLocaleString('pt-BR')} </strong></p>
        `;
        openModal('confirmationModal');
    } catch (err) {
        console.error('Erro ao processar resgate de lucro:', err);
        showNotification('Erro', 'Não foi possível processar o resgate de lucro.', true);
    }
}

/**
 * Confirma o resgate de lucro
 */
async function processProfitWithdrawalConfirmed() {
    if (!pendingAction) return;

    try {
        closeModal('confirmationModal');
        await backupWalletData();
        const { amount, tax, finalAmount } = pendingAction;

        await saveWallet({
            goldsBalance: (walletData.goldsBalance || 0) + finalAmount,
            portfolioBalance: 0
        });

        await pushTransaction({
            type: 'profit_withdrawal',
            amount: finalAmount,
            currency: 'golds',
            description: `Resgate de lucro acumulado (${amount.toLocaleString('pt-BR')}  bruto, -${tax.toLocaleString('pt-BR')}  taxa)`,
            date: new Date().toISOString(),
            metadata: { canUndo: false }
        });

        await pushTax({
            type: 'portfolio_withdraw',
            amount: tax,
            currency: 'golds',
            date: new Date().toISOString()
        });

        closeModal('profitWithdrawalModal');
        showNotification('Sucesso', `Resgate de ${finalAmount.toLocaleString('pt-BR')}  realizado com sucesso!`);
    } catch (err) {
        console.error('Erro ao confirmar resgate de lucro:', err);
        await restoreWalletData();
        showNotification('Erro', 'Falha ao confirmar resgate de lucro.', true);
    } finally {
        pendingAction = null;
        hideLoading('profit_withdrawal');
    }
}

/**
 * Desfaz a última transação (se possível)
 */
async function undoLastTransaction() {
    if (transactionHistory.length === 0) {
        showNotification('Aviso', 'Não há transações para desfazer.');
        return;
    }

    const lastTx = transactionHistory[transactionHistory.length - 1];

    if (!lastTx.metadata?.canUndo || lastTx.metadata.undoTimeout < Date.now()) {
        showNotification('Erro', 'Não é possível desfazer esta transação ou o prazo expirou.', true);
        return;
    }

    try {
        await backupWalletData();
        const batch = db.batch();
        const walletRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(currentUser.uid);

        if (lastTx.type === 'send') {
            // Reverte uma transferência
            const recipientRef = db
    .collection('bankCentral')
    .doc('wallets_usuarios')
    .collection('usuarios')
    .doc(lastTx.to);

            // Reverte o saldo e remove a transação do remetente
            batch.update(walletRef, {
                [`${lastTx.currency}Balance`]: lastTx.metadata.originalBalances[lastTx.currency],
                transactions: firebase.firestore.FieldValue.arrayRemove(lastTx)
            });

            // Cria uma transação "fake" para remoção do destinatário (Firestore arrayRemove requer o objeto idêntico)
            const recipientTxToRemove = {
                type: 'receive',
                amount: lastTx.amount,
                currency: lastTx.currency,
                description: `Recebido de ${currentUser.uid}`,
                date: lastTx.date,
                from: currentUser.uid,
                metadata: { canUndo: false }
            };

            batch.update(recipientRef, {
                [`${lastTx.currency}Balance`]: firebase.firestore.FieldValue.increment(-lastTx.amount),
                transactions: firebase.firestore.FieldValue.arrayRemove(recipientTxToRemove)
            });
        }
        else if (['deposit', 'conversion', 'invest'].includes(lastTx.type)) {
            // Reverte depósito, conversão ou investimento
            const originalBalances = lastTx.metadata.originalBalances;
            // Restaura os saldos originais
            batch.update(walletRef, {
                reaisBalance: originalBalances.reais,
                goldsBalance: originalBalances.golds,
                transactions: firebase.firestore.FieldValue.arrayRemove(lastTx)
            });

            if (lastTx.type === 'invest') {
                // Reverte a alteração no investimento
                batch.update(walletRef, {
                    [`investments.${lastTx.metadata.company}.amount`]:
                        firebase.firestore.FieldValue.increment(-lastTx.amount)
                });
            }
        } else {
             showNotification('Erro', 'Tipo de transação não suportado para desfazer.', true);
             return;
        }

        await batch.commit();
        transactionHistory.pop();
        showNotification('Sucesso', 'Transação desfeita com sucesso!');
        await loadWalletData(currentUser.uid);
    } catch (err) {
        console.error('Erro ao desfazer transação:', err);
        await restoreWalletData();
        showNotification('Erro', 'Falha ao desfazer transação.', true);
    }
}

// ------------------------------
// 8. FUNÇÕES DE RENDERIZAÇÃO
// ------------------------------

/**
 * Renderiza a carteira na interface
 */
function renderWallet() {
    if (!walletData) return;

    // Atualiza saldos
    const goldsBalanceEl = document.getElementById('golds-balance');
    const reaisBalanceEl = document.getElementById('reais-balance');
    const portfolioBalanceEl = document.getElementById('portfolio-balance');
    const enterpriseBalanceEl = document.getElementById('enterprise-balance');
    const cryptoBalanceEl = document.getElementById('crypto-balance');
    
    if (goldsBalanceEl) goldsBalanceEl.textContent =
        (walletData.goldsBalance || 0).toLocaleString('pt-BR');
    if (reaisBalanceEl) reaisBalanceEl.textContent =
        `R$ ${formatCurrency(walletData.reaisBalance || 0)}`;
    if (portfolioBalanceEl) portfolioBalanceEl.textContent =
        `${(walletData.portfolioBalance || 0).toLocaleString('pt-BR')} `;
    if (enterpriseBalanceEl) enterpriseBalanceEl.textContent =
        `${(walletData.enterpriseBalance || 0).toLocaleString('pt-BR')} 🏢`;
    if (cryptoBalanceEl) cryptoBalanceEl.textContent =
        `${(walletData.cryptoBalance || 0).toLocaleString('pt-BR')} YSC`;

    // Atualiza níveis
    const goldsLevel = walletData.goldsBalance >= 1000000 ? 3 :
                      (walletData.goldsBalance >= 500000 ? 2 : 1);
    const enterpriseLevel = walletData.enterpriseBalance >= 1000000 ? 3 :
                           (walletData.enterpriseBalance >= 500000 ? 2 : 1);

    const goldsLevelEl = document.getElementById('golds-level');
    const enterpriseLevelEl = document.getElementById('enterprise-level');

    if (goldsLevelEl) goldsLevelEl.textContent = `Nível ${goldsLevel}`;
    if (enterpriseLevelEl) enterpriseLevelEl.textContent = `Nível ${enterpriseLevel}`;

    // Atualiza estatísticas
    const txs = walletData.transactions || [];
    const totalTransactionsEl = document.getElementById('total-transactions');
    if (totalTransactionsEl) totalTransactionsEl.textContent = txs.length;

    let totalReceived = 0, totalSent = 0, lastWithdrawal = '-';
    txs.forEach(tx => {
        if (tx.currency === 'golds') {
            if (tx.type === 'receive' || tx.type === 'withdraw_invest' || tx.type === 'deposit' || tx.type === 'profit_withdrawal') totalReceived += (tx.amount || 0);
            if (tx.type === 'send' || tx.type === 'withdraw' || tx.type === 'invest') totalSent += (tx.amount || 0);
        }
        if (tx.type === 'withdraw' && tx.currency === 'reais' && tx.date) {
            lastWithdrawal = new Date(tx.date).toLocaleDateString('pt-BR');
        }
    });

    const totalReceivedEl = document.getElementById('total-received');
    const totalSentEl = document.getElementById('total-sent');
    const lastWithdrawalEl = document.getElementById('last-withdrawal');
    const enterpriseProfileEl = document.getElementById('enterprise-profile');
    const personalProfileEl = document.getElementById('personal-profile');

    if (totalReceivedEl) totalReceivedEl.textContent = totalReceived.toLocaleString('pt-BR');
    if (totalSentEl) totalSentEl.textContent = totalSent.toLocaleString('pt-BR');
    if (lastWithdrawalEl) lastWithdrawalEl.textContent = lastWithdrawal;
    if (enterpriseProfileEl) enterpriseProfileEl.textContent = `${(walletData.enterpriseBalance || 0).toLocaleString('pt-BR')} 🏢`;
    if (personalProfileEl) personalProfileEl.textContent = `${((walletData.goldsBalance || 0) - (walletData.enterpriseBalance || 0)).toLocaleString('pt-BR')} `;

    // Verifica botões especiais
    checkCryptoButton();
    checkCommercialButton();

    // Renderiza transações e investimentos
    renderTransactions();
    renderInvestmentSummary();
}

/**
 * Renderiza a lista de transações
 */
function renderTransactions() {
    const listEl = document.getElementById('transaction-list');
    const filterType = document.getElementById('filter-type')?.value;
    const filterCurrency = document.getElementById('filter-currency')?.value;

    if (!listEl) return;

    let txs = (walletData?.transactions || []).slice();

    // Aplica filtros
    txs = txs.filter(tx => {
        const matchesType = !filterType || tx.type === filterType;
        const matchesCurrency = !filterCurrency || tx.currency === filterCurrency;
        return matchesType && matchesCurrency;
    });

    // Ordena transações
    txs.sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        const amountA = a.amount || 0;
        const amountB = b.amount || 0;

        if (sortOrder.field === 'date') {
            return sortOrder.direction === 'asc' ? dateA - dateB : dateB - dateA;
        } else if (sortOrder.field === 'amount') {
            return sortOrder.direction === 'asc' ? amountA - amountB : amountB - amountA;
        }
        return 0;
    });

    // Exibe mensagem se não houver transações
    if (txs.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center; padding:1rem; color:var(--text-secondary)">
                <i class="fas fa-inbox" style="font-size:1.5rem; opacity:0.6"></i>
                <div style="margin-top:0.5rem; font-size:0.85rem">Nenhuma transação encontrada.</div>
            </div>
        `;
        return;
    }

    // Renderiza transações
    const typeMap = {
        receive: { label: 'Recebido', icon: 'fa-arrow-down', color: 'receive' },
        send: { label: 'Enviado', icon: 'fa-arrow-up', color: 'send' },
        withdraw: { label: 'Saque', icon: 'fa-arrow-up', color: 'withdraw' },
        deposit: { label: 'Depósito', icon: 'fa-arrow-down', color: 'receive' },
        conversion: { label: 'Conversão', icon: 'fa-exchange-alt', color: 'send' },
        invest: { label: 'Investimento', icon: 'fa-chart-line', color: 'send' },
        withdraw_invest: { label: 'Resgate', icon: 'fa-coins', color: 'receive' },
        profit_withdrawal: { label: 'Resgate Lucro', icon: 'fa-hand-holding-usd', color: 'receive' }
    };

    listEl.innerHTML = txs.map((tx, index) => {
        const txType = typeMap[tx.type] || { label: tx.type, icon: 'fa-question', color: 'send' };
        const amountLabel = tx.currency === 'golds'
            ? `${(tx.amount || 0).toLocaleString('pt-BR')} `
            : `R$ ${formatCurrency(tx.amount || 0)}`;

        const sign = (tx.type === 'receive' || tx.type === 'withdraw_invest' || tx.type === 'deposit' || tx.type === 'profit_withdrawal')
            ? '+'
            : (tx.type === 'withdraw' || tx.type === 'invest')
                ? '↓'
                : '-';

        const when = tx.date ? new Date(tx.date).toLocaleString('pt-BR') : 'Data inválida';

        return `
            <div class="transaction-item" onclick="openTransactionDetails(${txs.length - 1 - index})">
                <div style="flex:1; min-width:0">
                    <div class="transaction-type">${txType.label}</div>
                    <div class="transaction-desc">${tx.description || '-'}</div>
                    <div class="transaction-date">${when}</div>
                </div>
                <div style="margin-left:0.75rem; text-align:right">
                    <div class="transaction-amount ${txType.color}">
                        <i class="fas ${txType.icon}"></i> ${sign} ${amountLabel}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Renderiza o resumo de investimentos
 */
function renderInvestmentSummary() {
    const listEl = document.getElementById('investment-summary-list');
    if (!listEl) return;
    
    const investments = walletData?.investments || {};
    let totalInvested = 0;
    let totalReturn = 0;

    const activeInvestments = Object.entries(investments)
        .filter(([, inv]) => inv.amount > 0)
        .map(([id, inv]) => ({ id, ...inv }));

    if (activeInvestments.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center; color:var(--text-secondary); padding:1rem">
                <i class="fas fa-chart-line" style="font-size:1.5rem; opacity:0.6"></i>
                <div style="margin-top:0.5rem; font-size:0.85rem">Você não tem investimentos ativos.</div>
            </div>
        `;
        return;
    }

    listEl.innerHTML = activeInvestments.map(inv => {
        const plan = INVESTMENT_PLANS[inv.id];
        if (!plan) return '';

        const investedAmount = inv.amount;
        const accumulatedReturn = calculateCurrentReturn(inv.id, investedAmount, inv.date);
        const totalValue = investedAmount + accumulatedReturn;
        const isLocked = isInvestmentLocked(inv.date, plan.lockInDays);

        const unlockDate = new Date(inv.date instanceof firebase.firestore.Timestamp
            ? inv.date.toDate().getTime()
            : new Date(inv.date).getTime());
        unlockDate.setDate(unlockDate.getDate() + plan.lockInDays);

        totalInvested += investedAmount;
        totalReturn += accumulatedReturn;

        const statusTag = isLocked
            ? `<span style="color: var(--accent); font-weight: 500;">(Em Lock-in)</span>`
            : `<span style="color: var(--reais); font-weight: 500;">(Liberado)</span>`;

        return `
            <div class="investment-card">
                <div style="flex:1; min-width:0">
                    <div class="invest-name">${plan.name} ${statusTag}</div>
                    <div class="invest-return">Retorno: +${accumulatedReturn.toLocaleString('pt-BR')} </div>
                    <div class="invest-lockin">Liberação: ${unlockDate.toLocaleDateString('pt-BR')}</div>
                </div>
                <div style="margin-left:0.75rem; text-align:right">
                    <div class="invest-amount">${investedAmount.toLocaleString('pt-BR')} </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">
                        Total: ${totalValue.toLocaleString('pt-BR')} 
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Atualiza saldos de portfólio
    const portfolioBalanceEl = document.getElementById('portfolio-balance');
    if (portfolioBalanceEl) portfolioBalanceEl.textContent = `${(walletData?.portfolioBalance || 0).toLocaleString('pt-BR')} `;
}

/**
 * Abre os detalhes de uma transação
 * @param {number} index - Índice da transação (do fim para o começo)
 */
function openTransactionDetails(index) {
    const txs = walletData?.transactions || [];
    const tx = txs[txs.length - 1 - index];
    if (!tx) return;

    const typeMap = {
        receive: 'Recebido',
        send: 'Enviado',
        withdraw: 'Saque',
        deposit: 'Depósito',
        conversion: 'Conversão',
        invest: 'Investimento',
        withdraw_invest: 'Resgate de Investimento',
        profit_withdrawal: 'Resgate de Lucro'
    };

    const amountLabel = tx.currency === 'golds'
        ? `${(tx.amount || 0).toLocaleString('pt-BR')} `
        : `R$ ${formatCurrency(tx.amount || 0)}`;

    const type = typeMap[tx.type] || tx.type;
    const when = tx.date ? new Date(tx.date).toLocaleString('pt-BR') : 'Data inválida';

    let detailsHtml = `
        <div class="detail-item"><strong>Tipo:</strong> <span>${type}</span></div>
        <div class="detail-item"><strong>Valor:</strong> <span>${amountLabel}</span></div>
        <div class="detail-item"><strong>Descrição:</strong> <span>${tx.description || '-'}</span></div>
        <div class="detail-item"><strong>Data:</strong> <span>${when}</span></div>
    `;

    if (tx.to) detailsHtml += `<div class="detail-item"><strong>Destinatário:</strong> <span>${tx.to}</span></div>`;
    if (tx.from) detailsHtml += `<div class="detail-item"><strong>Remetente:</strong> <span>${tx.from}</span></div>`;
    if (tx.metadata) {
        // Exibe detalhes específicos
        if (tx.metadata.tax) {
            const taxLabel = tx.currency === 'golds' ? `${(tx.metadata.tax || 0).toLocaleString('pt-BR')} ` : `R$ ${formatCurrency(tx.metadata.tax || 0)}`;
            detailsHtml += `<div class="detail-item"><strong>Taxa:</strong> <span>${taxLabel}</span></div>`;
        }
        if (tx.metadata.pixKey) {
            detailsHtml += `<div class="detail-item"><strong>Chave PIX:</strong> <span>${tx.metadata.pixKey}</span></div>`;
        }
        if (tx.metadata.planName) {
            detailsHtml += `<div class="detail-item"><strong>Plano:</strong> <span>${tx.metadata.planName}</span></div>`;
        }

        // Botão para desfazer (se permitido)
        if (tx.metadata.canUndo && tx.metadata.undoTimeout > Date.now()) {
            detailsHtml += `
                <div style="margin-top: 1rem; text-align: center;">
                    <button class="action-btn default" onclick="undoTransaction(${index})"
                            style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">
                        <i class="fas fa-undo"></i> Desfazer Transação
                    </button>
                </div>
            `;
        }
    }

    const detailsContentEl = document.getElementById('transaction-details-content');
    if (detailsContentEl) detailsContentEl.innerHTML = detailsHtml;
    openModal('transactionDetailsModal');
}

/**
 * Desfaz uma transação específica (chamada do modal de detalhes)
 * @param {number} index - Índice da transação (do fim para o começo)
 */
async function undoTransaction(index) {
    const txs = walletData?.transactions || [];
    const tx = txs[txs.length - 1 - index];
    if (!tx) return;

    if (!tx.metadata?.canUndo || tx.metadata.undoTimeout < Date.now()) {
        showNotification('Erro', 'Não é possível desfazer esta transação ou o prazo expirou.', true);
        return;
    }

    try {
        await backupWalletData();
        const batch = db.batch();
        const walletRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(currentUser.uid);

        if (tx.type === 'send') {
            const recipientRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(tx.to);

            // Reverte o saldo e remove a transação do remetente
            batch.update(walletRef, {
                [`${tx.currency}Balance`]: tx.metadata.originalBalances[tx.currency],
                transactions: firebase.firestore.FieldValue.arrayRemove(tx)
            });

            // Cria uma transação "fake" para remoção do destinatário (Firestore arrayRemove requer o objeto idêntico)
            const recipientTxToRemove = {
                type: 'receive',
                amount: tx.amount,
                currency: tx.currency,
                description: `Recebido de ${currentUser.uid}`,
                date: tx.date,
                from: currentUser.uid,
                metadata: { canUndo: false }
            };

            batch.update(recipientRef, {
                [`${tx.currency}Balance`]: firebase.firestore.FieldValue.increment(-tx.amount),
                transactions: firebase.firestore.FieldValue.arrayRemove(recipientTxToRemove)
            });
        }
        else if (['deposit', 'conversion', 'invest'].includes(tx.type)) {
            batch.update(walletRef, {
                reaisBalance: tx.metadata.originalBalances.reais,
                goldsBalance: tx.metadata.originalBalances.golds,
                transactions: firebase.firestore.FieldValue.arrayRemove(tx)
            });

            if (tx.type === 'invest') {
                batch.update(walletRef, {
                    [`investments.${tx.metadata.company}.amount`]:
                        firebase.firestore.FieldValue.increment(-tx.amount)
                });
            }
        } else {
            showNotification('Erro', 'Tipo de transação não suportado para desfazer.', true);
            return;
        }

        await batch.commit();
        closeModal('transactionDetailsModal');
        
        // Remove do histórico local
        walletData.transactions = walletData.transactions.filter(t => t !== tx);
        transactionHistory = transactionHistory.filter(t => t !== tx);

        showNotification('Sucesso', 'Transação desfeita com sucesso!');
        await loadWalletData(currentUser.uid);
    } catch (err) {
        console.error('Erro ao desfazer transação:', err);
        await restoreWalletData();
        showNotification('Erro', 'Falha ao desfazer transação.', true);
    }
}

/**
 * Preenche as opções de investimento nos selects
 */
function populateInvestmentOptions() {
    const investSelect = document.getElementById('invest-company');
    const withdrawSelect = document.getElementById('withdraw-invest-company');

    if (!investSelect || !withdrawSelect) return;

    // Limpa os selects
    investSelect.innerHTML = '<option value="">Selecione uma Empresa/Serviço</option>';
    withdrawSelect.innerHTML = '<option value="">Selecione um Investimento Ativo</option>';

    // Adiciona opções de investimento
    Object.entries(INVESTMENT_PLANS).forEach(([id, plan]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${plan.name} (Mínimo: ${plan.minInvest.toLocaleString('pt-BR')} )`;
        investSelect.appendChild(option);
    });

    // Adiciona opções de retirada (apenas investimentos ativos)
    const investments = walletData?.investments || {};
    Object.entries(investments).forEach(([id, inv]) => {
        if (inv.amount > 0 && INVESTMENT_PLANS[id]) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${INVESTMENT_PLANS[id].name} (${inv.amount.toLocaleString('pt-BR')} )`;
            withdrawSelect.appendChild(option);
        }
    });
}

// ------------------------------
// 9. FUNÇÕES DE INICIALIZAÇÃO
// ------------------------------

/**
 * Configura a formatação dos inputs
 */
function setupInputFormatting() {
    // Formatação para inputs de moeda
    const currencyInputs = ['deposit-amount', 'withdraw-amount', 'transfer-amount', 'convert-amount'];
    currencyInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', () => formatInputCurrency(input));
            input.addEventListener('blur', () => {
                if (!input.value || input.value === '0,00') input.value = '';
            });
            input.addEventListener('focus', () => {
                if (!input.value) input.value = '0,00';
            });
        }
    });

    // Formatação para inputs de números inteiros
    const integerInputs = ['invest-amount', 'withdraw-invest-amount'];
    integerInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', () => formatInputInteger(input));
            input.addEventListener('blur', () => {
                if (!input.value) input.value = '';
            });
            input.addEventListener('focus', () => {
                if (!input.value) input.value = '0';
            });
        }
    });

    // Validação de chaves PIX
    const pixKeyInputs = [
        { id: 'withdraw-pix-key', errorId: 'withdraw-pix-key-error' },
        { id: 'deposit-pix-key', errorId: 'deposit-pix-key-error' }
    ];

    pixKeyInputs.forEach(({ id }) => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', (e) => validatePixKey(e.target.value, id));
        }
    });
}

/**
 * Verifica se o botão de criptomoeda deve estar habilitado
 */
function checkCryptoButton() {
    const cryptoBtn = document.getElementById('analyzeCryptoBtn');
    if (cryptoBtn) {
        cryptoBtn.disabled = (walletData?.goldsBalance || 0) < 1000000;
        cryptoBtn.title = (walletData?.goldsBalance || 0) < 1000000
            ? "Você precisa de 1.000.000  para acessar esta funcionalidade"
            : "Analisar sua criptomoeda YSC";
    }
}

/**
 * Verifica se o botão de conta comercial deve estar visível
 */
function checkCommercialButton() {
    const commercialBtn = document.querySelector('.action-btn.commercial');
    if (commercialBtn) {
        commercialBtn.style.display = (walletData?.goldsBalance || 0) >= 500000 ? 'block' : 'none';
    }
}

/**
 * Carrega os dados da carteira
 * @param {string} uid - ID do usuário
 */
async function loadWalletData(uid) {
    console.log(`Carteira carregada para ${uid}`);
    try {
        const ref = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(uid);
        const snap = await ref.get();

        if (!snap.exists) {
            // Cria uma carteira nova se não existir
            const initialData = {
                userId: uid,
                name: auth.currentUser?.displayName || (auth.currentUser?.isAnonymous ? 'Anônimo' : 'Usuário'),
                goldsBalance: 0,
                reaisBalance: 0,
                portfolioBalance: 0,
                enterpriseBalance: 0,
                cryptoBalance: 0,
                investments: {},
                transactions: [],
                taxes: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastUpdated: new Date().toISOString()
            };

            await ref.set(initialData);
            walletData = initialData;
        } else {
            walletData = snap.data();
            // Log de dados carregados
            console.log("Object { reaisBalance, creditScore, ultimaPublicacao, investments: {...} }");
        }

        allTransactions = walletData.transactions || [];
        // Atualiza o histórico de transações localmente
        transactionHistory = walletData.transactions || [];
        renderWallet();
    } catch (err) {
        console.error('Erro ao carregar carteira:', err);
        showNotification('Erro', 'Não foi possível carregar os dados da carteira.', true);
    }
}

/**
 * Garante login anônimo se não houver usuário
 */
async function ensureAnonymousSignIn() {
    try {
        await auth.signInAnonymously();
    } catch (error) {
        console.error('Erro ao fazer login anônimo:', error);
        showNotification('Erro', 'Não foi possível iniciar sessão anônima.', true);
    }
}

// ------------------------------
// 10. FUNÇÕES DE EVENTO E AUXILIARES DE UI
// ------------------------------

// Funções para atualizar pré-visualizações
const updateDepositPreview = debounce(function() {
    const amountInput = document.getElementById('deposit-amount');
    if (!amountInput) return;
    const amount = parseFloat(amountInput.value.replace(/\./g, '').replace(',', '.'));
    const tax = amount * getTaxRate('deposit', 'reais');
    const netAmount = amount - tax;
    const depositPreviewEl = document.getElementById('deposit-preview');
    if (depositPreviewEl) depositPreviewEl.textContent =
        `Valor líquido após taxa: R$ ${formatCurrency(netAmount)}`;
}, 300);

const updateWithdrawPreview = debounce(function() {
    const currency = document.getElementById('withdraw-currency')?.value;
    const amountInput = document.getElementById('withdraw-amount');
    if (!currency || !amountInput) return;
    const amount = parseFloat(amountInput.value.replace(/\./g, '').replace(',', '.'));
    const tax = amount * getTaxRate('withdraw', currency);
    const netAmount = amount - tax;

    const symbol = currency === 'reais' ? 'R$' : '';
    const withdrawPreviewEl = document.getElementById('withdraw-preview');
    if (withdrawPreviewEl) withdrawPreviewEl.textContent =
        `Valor líquido após taxa: ${currency === 'reais'
            ? `R$ ${formatCurrency(netAmount)}`
            : `${Math.floor(netAmount).toLocaleString('pt-BR')} ${symbol}`}`;
}, 300);

const updateTransferPreview = debounce(function() {
    const currency = document.getElementById('transfer-currency')?.value;
    const amountInput = document.getElementById('transfer-amount');
    if (!currency || !amountInput) return;
    const amount = parseFloat(amountInput.value.replace(/\./g, '').replace(',', '.'));
    const tax = amount * getTaxRate('transfer', currency);
    const netAmount = amount - tax;

    const symbol = currency === 'reais' ? 'R$' : '';
    const transferPreviewEl = document.getElementById('transfer-preview');
    if (transferPreviewEl) transferPreviewEl.textContent =
        `Valor líquido após taxa: ${currency === 'reais'
            ? `R$ ${formatCurrency(netAmount)}`
            : `${Math.floor(netAmount).toLocaleString('pt-BR')} ${symbol}`}`;
}, 300);

const updateConversionPreview = debounce(function() {
    const from = document.getElementById('convert-from')?.value;
    const to = document.getElementById('convert-to')?.value;
    const amountInput = document.getElementById('convert-amount');
    const conversionPreviewEl = document.getElementById('conversion-preview');
    
    if (!from || !to || !amountInput || !conversionPreviewEl) return;

    const amount = parseFloat(amountInput.value.replace(/\./g, '').replace(',', '.'));
    if (isNaN(amount) || amount <= 0 || from === to) {
        conversionPreviewEl.textContent = '0';
        return;
    }

    const tax = amount * getTaxRate('conversion', from);
    const netAmount = amount - tax;

    let convertedAmount;
    if (from === 'golds' && to === 'reais') {
        convertedAmount = netAmount / GOLD_TO_REAL_RATE;
        conversionPreviewEl.textContent =
            `R$ ${formatCurrency(convertedAmount)} (Taxa: ${tax.toLocaleString('pt-BR')} )`;
    } else if (from === 'reais' && to === 'golds') {
        convertedAmount = Math.floor(netAmount * GOLD_TO_REAL_RATE);
        conversionPreviewEl.textContent =
            `${convertedAmount.toLocaleString('pt-BR')}  (Taxa: R$ ${formatCurrency(tax)})`;
    }
}, 300);

function togglePixKeyField() {
    const currency = document.getElementById('withdraw-currency')?.value;
    const pixGroup = document.getElementById('withdraw-pix-group');
    const pixKeyInput = document.getElementById('withdraw-pix-key');

    if (pixGroup && pixKeyInput) {
        if (currency === 'reais') {
            pixGroup.style.display = 'block';
        } else {
            pixGroup.style.display = 'none';
            pixKeyInput.value = '';
        }
    }
}

function updateDepositMethodInfo() {
    const method = document.getElementById('deposit-method')?.value;
    const infoEl = document.getElementById('deposit-method-info');
    const pixKeyGroup = document.getElementById('pix-key-group');

    if (!method || !infoEl || !pixKeyGroup) return;

    if (method === 'pix') {
        pixKeyGroup.style.display = 'block';
        infoEl.innerHTML = `
            <p><strong>Instruções PIX:</strong> Utilize a chave PIX <code>${currentUser?.uid.substring(0, 8) || 'XXXXXX'}</code> para depositar.</p>
            <p style="margin-top:0.3rem; color:var(--accent);"><strong>Atenção:</strong> A chave PIX de origem deve ser válida.</p>
        `;
    } else if (method === 'boleto') {
        pixKeyGroup.style.display = 'none';
        infoEl.innerHTML = `
            <p><strong>Instruções Boleto:</strong> Um boleto será gerado com o valor + taxa. O crédito pode levar até 2 dias úteis.</p>
        `;
    } else if (method === 'card') {
        pixKeyGroup.style.display = 'none';
        infoEl.innerHTML = `
            <p><strong>Instruções Cartão:</strong> Você será redirecionado para pagamento seguro. Taxa adicional de 2%.</p>
        `;
    }
}

// Funções de navegação (adaptadas para o escopo do JS)
function navigateTo(page) {
    const pages = {
        wallet: "carteira.html",
        generator: "gerador.html",
        market: "mercado.html",
        store: "loja.html",
        yshippcommerce: "yshippcommerce.html",
        enterprise: "empresarial.html",
        home: "index.html"
    };
    window.location.href = pages[page] || pages.home;
}

// Funções para modais específicos
function openDepositModal() {
    openModal('depositModal');
    updateDepositMethodInfo();
    updateDepositPreview();
}

function openWithdrawModal() {
    openModal('withdrawModal');
    togglePixKeyField();
    updateWithdrawPreview();
}

function openTransferModal() {
    openModal('transferModal');
    updateTransferPreview();
}

function openConvertModal() {
    openModal('convertModal');
    updateConversionPreview();
}

function openInvestModal() {
    populateInvestmentOptions();
    const investAmountEl = document.getElementById('invest-amount');
    if (investAmountEl) investAmountEl.value = '';
    renderInvestmentDetails();
    openModal('investModal');
}

function openWithdrawInvestmentModal() {
    populateInvestmentOptions();
    const withdrawInvestAmountEl = document.getElementById('withdraw-invest-amount');
    if (withdrawInvestAmountEl) withdrawInvestAmountEl.value = '';
    renderWithdrawalDetails();
    openModal('withdrawInvestModal');
}

function openProfitWithdrawalModal() {
    const portfolioBalance = walletData?.portfolioBalance || 0;
    if (portfolioBalance <= 0) {
        showNotification('Aviso', 'Não há lucro acumulado para resgatar.');
        return;
    }

    const taxRate = getTaxRate('profit_withdrawal', 'golds');
    const tax = Math.ceil(portfolioBalance * taxRate);
    const finalAmount = portfolioBalance - tax;

    const contentEl = document.getElementById('profit-withdrawal-content');
    if (!contentEl) return;

    contentEl.innerHTML = `
        <div class="detail-item">
            <span>Lucro disponível:</span>
            <span style="color: var(--reais);">${portfolioBalance.toLocaleString('pt-BR')} </span>
        </div>
        <div class="detail-item">
            <span>Taxa (${(taxRate * 100).toFixed(2)}%):</span>
            <span style="color: var(--accent);">${tax.toLocaleString('pt-BR')} </span>
        </div>
        <div class="detail-item" style="border-top: 1px dashed var(--border); margin-top: 0.5rem; padding-top: 0.5rem;">
            <span>Valor líquido:</span>
            <span style="color: var(--reais); font-weight: bold;">${finalAmount.toLocaleString('pt-BR')} </span>
        </div>
    `;
    openModal('profitWithdrawalModal');
}

// Função para analisar criptomoeda (placeholder)
function analyzeCrypto() {
    if ((walletData?.goldsBalance || 0) < 1000000) {
        showNotification('Aviso', 'Você precisa de 1.000.000  para acessar esta funcionalidade.');
        return;
    }
    showNotification('Sucesso', 'Análise de criptomoeda disponível para Nível 3!');
}

function showLevelModal(type) {
    const levels = {
        golds: [
            { level: 1, name: 'Bronze', golds: 0, benefits: ['Acesso básico à carteira'] },
            { level: 2, name: 'Prata', golds: 500000, benefits: ['Acesso à conta comercial', 'Descontos em taxas'] },
            { level: 3, name: 'Ouro', golds: 1000000, benefits: ['Criação de criptomoeda', 'Análise avançada', 'Suporte prioritário'] }
        ],
        enterprise: [
            { level: 1, name: 'Bronze', golds: 0, benefits: ['Acesso básico'] },
            { level: 2, name: 'Prata', golds: 500000, benefits: ['Descontos em taxas', 'Relatórios avançados'] },
            { level: 3, name: 'Ouro', golds: 1000000, benefits: ['Retornos maiores', 'Suporte VIP', 'Visibilidade aumentada'] }
        ]
    };

    const currentBalance = type === 'golds'
        ? walletData?.goldsBalance || 0
        : walletData?.enterpriseBalance || 0;

    const currentLevel = levels[type].findLast(l => currentBalance >= l.golds) || levels[type][0];
    const nextLevel = levels[type].find(l => currentBalance < l.golds);

    let content = `
        <div style="margin-bottom: 1rem;">
            <div style="font-weight: 600; margin-bottom: 0.5rem;">Nível Atual: ${currentLevel.name} (${currentLevel.level})</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">
                Saldo: ${currentBalance.toLocaleString('pt-BR')} ${type === 'golds' ? '🪙' : ''}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">
                <strong>Benefícios:</strong>
                <ul style="margin-top: 0.25rem; padding-left: 1rem;">
                    ${currentLevel.benefits.map(b => `<li>${b}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;

    if (nextLevel) {
        const progress = ((currentBalance - currentLevel.golds) / (nextLevel.golds - currentLevel.golds)) * 100;
        content += `
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border);">
                <div style="font-weight: 600; margin-bottom: 0.5rem;">Próximo Nível: ${nextLevel.name} (${nextLevel.level})</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                    Faltam: ${(nextLevel.golds - currentBalance).toLocaleString('pt-BR')} ${type === 'golds' ? '🪙' : '🏢'}
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">
                    <strong>Novos Benefícios:</strong>
                    <ul style="margin-top: 0.25rem; padding-left: 1rem;">
                        ${nextLevel.benefits.map(b => `<li>${b}</li>`).join('')}
                    </ul>
                </div>
                <div style="margin-top: 0.75rem;">
                    <div style="font-size: 0.85rem; margin-bottom: 0.25rem;">Progresso:</div>
                    <div class="level-progress">
                        <div class="level-progress-bar" style="width: ${Math.min(100, progress)}%;"></div>
                    </div>
                    <div style="font-size: 0.75rem; text-align: right; margin-top: 0.25rem;">
                        ${Math.floor(Math.min(100, progress))}%
                    </div>
                </div>
            </div>
        `;
    }

    const levelModalContentEl = document.getElementById('level-modal-content');
    if (levelModalContentEl) levelModalContentEl.innerHTML = content;
    openModal('levelModal');
}

// Função para exportar transações como CSV
function exportTransactions() {
    const transactions = walletData?.transactions || [];
    if (transactions.length === 0) {
        showNotification('Aviso', 'Nenhuma transação para exportar.');
        return;
    }

    // Cria o conteúdo CSV
    const headers = ['Data', 'Tipo', 'Moeda', 'Valor', 'Descrição', 'De/Para', 'Taxa'];
    let csvContent = headers.join(';') + '\n';

    transactions.forEach(tx => {
        const row = [
            tx.date ? new Date(tx.date).toLocaleString('pt-BR') : 'Data inválida',
            tx.type,
            tx.currency,
            tx.currency === 'golds' ? `${(tx.amount || 0).toLocaleString('pt-BR')} G` : `R$ ${formatCurrency(tx.amount || 0)}`,
            tx.description || '-',
            tx.from || tx.to || '-',
            tx.metadata?.tax ? (tx.currency === 'golds' ? `${(tx.metadata.tax || 0).toLocaleString('pt-BR')} G` : `R$ ${formatCurrency(tx.metadata.tax || 0)}`) : '0'
        ];
        csvContent += row.join(';') + '\n';
    });

    // Cria e faz download do arquivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `extrato_carteira_${currentUser?.uid || 'anonimo'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Sucesso', 'Extrato exportado com sucesso!');
}

// Função para atualizar detalhes de investimento
const renderInvestmentDetails = debounce(function() {
    const companyId = document.getElementById('invest-company')?.value;
    const amountInput = document.getElementById('invest-amount');
    const detailsEl = document.getElementById('investment-details');
    const returnEl = document.getElementById('estimated-return');

    if (!detailsEl || !returnEl || !companyId || !INVESTMENT_PLANS[companyId]) {
        if(detailsEl) detailsEl.innerHTML = 'Selecione um plano para ver detalhes.';
        if(returnEl) returnEl.textContent = '';
        return;
    }

    const plan = INVESTMENT_PLANS[companyId];
    const amount = parseInt(amountInput.value.replace(/\D/g, '')) || 0;

    const riskClass = `risk-${plan.risk.toLowerCase().replace(' ', '-')}`;
    detailsEl.innerHTML = `
        <div class="detail-item"><span>Empresa:</span> <span>${plan.name}</span></div>
        <div class="detail-item"><span>Risco:</span> <span class="risk-indicator ${riskClass}">${plan.risk}</span></div>
        <div class="detail-item"><span>Retorno Mensal:</span> <span>${(plan.returnRate * 100).toFixed(2)}%</span></div>
        <div class="detail-item"><span>Lock-in:</span> <span>${plan.lockInDays} dias</span></div>
        <div class="detail-item"><span>Investimento Mínimo:</span> <span>${plan.minInvest.toLocaleString('pt-BR')} G</span></div>
        <div class="detail-item"><span>Taxa:</span> <span>${(getTaxRate('invest', 'golds') * 100).toFixed(2)}%</span></div>
    `;

    if (amount > 0) {
        const monthlyReturn = amount * plan.returnRate;
        const dailyReturn = monthlyReturn / 30;
        const yearlyReturn = monthlyReturn * 12;

        returnEl.innerHTML = `
            <div style="margin-top: 0.5rem;">
                <div style="font-weight: 600; margin-bottom: 0.25rem;">Retorno Estimado:</div>
                <div class="detail-item">
                    <span>Diário:</span>
                    <span style="color: var(--reais);">${Math.floor(dailyReturn).toLocaleString('pt-BR')} G</span>
                </div>
                <div class="detail-item">
                    <span>Mensal:</span>
                    <span style="color: var(--reais);">${Math.floor(monthlyReturn).toLocaleString('pt-BR')}G</span>
                </div>
                <div class="detail-item">
                    <span>Anual:</span>
                    <span style="color: var(--reais);">${Math.floor(yearlyReturn).toLocaleString('pt-BR')}G</span>
                </div>
            </div>
        `;
    } else {
        returnEl.textContent = 'Insira um valor para ver o retorno estimado.';
    }
}, 300);

// Função para atualizar detalhes de retirada de investimento
const renderWithdrawalDetails = debounce(function() {
    const companyId = document.getElementById('withdraw-invest-company')?.value;
    const amountInput = document.getElementById('withdraw-invest-amount');
    const detailsEl = document.getElementById('withdrawal-details');
    const summaryEl = document.getElementById('final-withdrawal-summary');

    if (!detailsEl || !summaryEl || !companyId || !INVESTMENT_PLANS[companyId]) {
        if(detailsEl) detailsEl.innerHTML = 'Selecione um investimento ativo.';
        if(summaryEl) summaryEl.textContent = '';
        return;
    }

    const investment = walletData?.investments?.[companyId];
    const plan = INVESTMENT_PLANS[companyId];

    if (!investment || investment.amount <= 0) {
        detailsEl.innerHTML = 'Investimento não encontrado ou com saldo zero.';
        summaryEl.textContent = '';
        return;
    }

    let amountToWithdraw = parseInt(amountInput.value.replace(/\D/g, '')) || investment.amount;
    amountToWithdraw = Math.min(amountToWithdraw, investment.amount);

    const investedAmount = investment.amount;
    const accumulatedReturn = calculateCurrentReturn(companyId, investedAmount, investment.date);
    const isLocked = isInvestmentLocked(investment.date, plan.lockInDays);

    const totalGrossWithdrawal = amountToWithdraw + accumulatedReturn;
    const totalTaxRate = getTaxRate('withdraw_invest', 'golds');
    const finalPenalty = Math.ceil(totalGrossWithdrawal * totalTaxRate);
    const finalAmount = totalGrossWithdrawal - finalPenalty;

    const unlockDate = new Date(investment.date instanceof firebase.firestore.Timestamp
        ? investment.date.toDate().getTime()
        : new Date(investment.date).getTime());
    unlockDate.setDate(unlockDate.getDate() + plan.lockInDays);

    detailsEl.innerHTML = `
        <div class="detail-item">
            <span>Empresa:</span>
            <span>${plan.name}</span>
        </div>
        <div class="detail-item">
            <span>Investido:</span>
            <span>${investedAmount.toLocaleString('pt-BR')} 🪙</span>
        </div>
        <div class="detail-item">
            <span>Retorno Acumulado:</span>
            <span style="color: var(--reais);">${accumulatedReturn.toLocaleString('pt-BR')} 🪙</span>
        </div>
        <div class="detail-item">
            <span>Status:</span>
            <span style="color: ${isLocked ? 'var(--accent)' : 'var(--reais)'};">
                ${isLocked ? 'Bloqueado (Lock-in)' : 'Liberado'}
            </span>
        </div>
        <div class="detail-item">
            <span>Liberação:</span>
            <span>${unlockDate.toLocaleDateString('pt-BR')}</span>
        </div>
        <div class="detail-item" style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed var(--border);">
            <span>Penalidade/Taxa (${(totalTaxRate * 100).toFixed(2)}%):</span>
            <span style="color: var(--accent);">${finalPenalty.toLocaleString('pt-BR')} 🪙</span>
        </div>
    `;

    summaryEl.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.25rem;">Valor Final a Receber (Líquido):</div>
        <div style="font-size: 1.2rem; color: var(--reais); text-align: center;">
            ${finalAmount.toLocaleString('pt-BR')} 🪙
        </div>
        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem; text-align: center;">
            (Bruto: ${totalGrossWithdrawal.toLocaleString('pt-BR')} 🪙)
        </div>
    `;
}, 300);

// Função para atualizar o carrossel de saldos
function updateHeaderFooterColor(cardClass) {
    const header = document.querySelector('.header');
    const footer = document.querySelector('#userInfoFooter');
    const colors = {
        'gold': { bg: '#d69e2e', text: '#1a202c' },
        'reais': { bg: '#10b981', text: '#1a202c' },
        'portfolio': { bg: '#6b46c1', text: '#1a202c' },
        'enterprise': { bg: '#3b82f6', text: '#1a202c' },
        'crypto': { bg: '#F75561', text: '#1a202c' }
    };

    const color = colors[cardClass];
    if (color && header && footer) {
        header.style.background = color.bg;
        header.style.color = color.text;
        footer.style.background = color.bg;
        footer.style.color = color.text;
    }
}

// Configura o evento de scroll do carrossel
function setupCarousel() {
    const carousel = document.getElementById('balanceCarousel');
    if (carousel) {
        carousel.addEventListener('scroll', () => {
            const cards = carousel.querySelectorAll('.balance-card');
            const center = carousel.scrollLeft + carousel.offsetWidth / 2;
            let closestCard = null;
            let minDistance = Infinity;

            cards.forEach(card => {
                const cardCenter = card.offsetLeft + card.offsetWidth / 2;
                const distance = Math.abs(center - cardCenter);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestCard = card;
                }
            });

            if (closestCard) {
                const cardClass = Array.from(closestCard.classList).find(c => c !== 'balance-card');
                updateHeaderFooterColor(cardClass);
            }
        });
    }
}

// Função para executar a ação confirmada
async function executeConfirmedAction() {
    closeModal('confirmationModal');
    if (!pendingAction) return;

    const actionType = pendingAction.type;
    showLoading(actionType);

    try {
        switch (actionType) {
            case 'deposit':
                await processDepositConfirmed();
                break;
            case 'withdraw':
                await processWithdrawalConfirmed();
                break;
            case 'transfer':
                await processTransferConfirmed();
                break;
            case 'conversion':
                await processConversionConfirmed();
                break;
            case 'invest':
                await processInvestConfirmed();
                break;
            case 'withdraw_investment':
                await processWithdrawalInvestmentConfirmed();
                break;
            case 'profit_withdrawal':
                await processProfitWithdrawalConfirmed();
                break;
            default:
                showNotification('Erro', 'Ação desconhecida.', true);
        }

        // A recarga é feita dentro das funções de confirmação (saveWallet), mas garantimos aqui
        if (currentUser) await loadWalletData(currentUser.uid);
    } catch (err) {
        console.error('Erro ao executar ação:', err);
        await restoreWalletData();
        showNotification('Erro', 'Falha ao processar a ação.', true);
    } finally {
        hideLoading(actionType);
        pendingAction = null;
    }
}

// Função para alternar a ordem de classificação das transações
function toggleSortOrder(field) {
    if (sortOrder.field === field) {
        sortOrder.direction = sortOrder.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortOrder.field = field;
        sortOrder.direction = 'desc';
    }

    // Atualiza os ícones de ordenação
    document.querySelectorAll('.sort-btn i').forEach(icon => {
        icon.className = 'fas fa-sort';
    });

    const activeBtn = document.getElementById(`sort-${field}-btn`);
    if (activeBtn) {
        const icon = activeBtn.querySelector('i');
        if (icon) icon.className = sortOrder.direction === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
    }

    renderTransactions();
}

// Configuração de Event Listeners Globais
function setupEventListeners() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const newTheme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
            document.body.dataset.theme = newTheme;
            localStorage.setItem('theme', newTheme);
        });
    }

    // Menu Toggle
    const menuToggle = document.getElementById('menu-icon');
    const mainMenu = document.getElementById('main-menu');
    if (menuToggle && mainMenu) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            mainMenu.classList.toggle('open');
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.menu') && !e.target.closest('#menu-icon')) {
                mainMenu.classList.remove('open');
            }
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => window.location.href = "cadastro.html");
        });
    }

    // Configuração de formato de inputs
    setupInputFormatting();

    // Configuração do carrossel
    setupCarousel();

    // Adiciona ouvintes de mudança para as pré-visualizações
    document.getElementById('deposit-amount')?.addEventListener('input', updateDepositPreview);
    document.getElementById('deposit-method')?.addEventListener('change', updateDepositMethodInfo);
    document.getElementById('withdraw-amount')?.addEventListener('input', updateWithdrawPreview);
    document.getElementById('withdraw-currency')?.addEventListener('change', () => { togglePixKeyField(); updateWithdrawPreview(); });
    document.getElementById('transfer-amount')?.addEventListener('input', updateTransferPreview);
    document.getElementById('transfer-currency')?.addEventListener('change', updateTransferPreview);
    document.getElementById('convert-amount')?.addEventListener('input', updateConversionPreview);
    document.getElementById('convert-from')?.addEventListener('change', updateConversionPreview);
    document.getElementById('convert-to')?.addEventListener('change', updateConversionPreview);
    document.getElementById('invest-company')?.addEventListener('change', renderInvestmentDetails);
    document.getElementById('invest-amount')?.addEventListener('input', renderInvestmentDetails);
    document.getElementById('withdraw-invest-company')?.addEventListener('change', renderWithdrawalDetails);
    document.getElementById('withdraw-invest-amount')?.addEventListener('input', renderWithdrawalDetails);
    document.getElementById('filter-type')?.addEventListener('change', renderTransactions);
    document.getElementById('filter-currency')?.addEventListener('change', renderTransactions);
    document.getElementById('sort-date-btn')?.addEventListener('click', () => toggleSortOrder('date'));
    document.getElementById('sort-amount-btn')?.addEventListener('click', () => toggleSortOrder('amount'));

    // Configuração do botão de confirmação do modal
    document.getElementById('confirmActionBtn')?.addEventListener('click', executeConfirmedAction);
    document.getElementById('cancelActionBtn')?.addEventListener('click', () => closeModal('confirmationModal'));
}

// ------------------------------
// 11. INICIALIZAÇÃO (PONTO DE ENTRADA)
// ------------------------------

// Inicializa a carteira quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', async function() {
    console.log("Aguardando autenticação...");
    try {
        // Carrega tema salvo
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.dataset.theme = savedTheme;

        // 1. Configura persistência LOCAL para o Firebase Auth
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => console.log("✅ Persistência LOCAL ativada — o mesmo usuário será mantido ao relogar."))
            .catch(error => console.error("Erro ao configurar persistência:", error));

        // 2. Configura ouvinte de autenticação
        auth.onAuthStateChanged(async (user) => {
            console.log("auth.onAuthStateChanged -> Usuário detectado");

            if (!user) {
                // Se não houver usuário logado (nem anônimo), tenta o login anônimo
                await ensureAnonymousSignIn();
                return;
            }

            currentUser = user;
            console.log(`Usuário ativo: ${user.uid}`);
            
            // Atualiza o rodapé com as informações do usuário
            const footerUserIdEl = document.getElementById('footerUserId');
            const footerUserNameEl = document.getElementById('footerUserName');
            const loadingOverlayEl = document.getElementById('loadingOverlay');

            if (footerUserIdEl) footerUserIdEl.textContent = user.uid;
            if (footerUserNameEl) footerUserNameEl.textContent =
                user.displayName || (user.isAnonymous ? 'Anônimo' : (user.email || 'Usuário'));


            try {
                // 3. Carrega e sincroniza os dados da carteira
                await loadWalletData(user.uid);
                
                if (loadingOverlayEl) loadingOverlayEl.style.display = 'none';
                setupEventListeners(); // Configura eventos após carregar dados
                populateInvestmentOptions();

                // 4. Configura ouvinte em tempo real para sincronização dos dados da carteira
                db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(user.uid).onSnapshot((doc) => {
                    if (doc.exists) {
                        walletData = doc.data();
                        allTransactions = walletData.transactions || [];
                        transactionHistory = walletData.transactions || [];
                        localStorage.setItem(`wallet_${user.uid}`, JSON.stringify(walletData));
                        renderWallet();
                    }
                });
            } catch (error) {
                console.error('Erro ao sincronizar carteira:', error);
                showNotification('Erro', 'Erro ao sincronizar dados da carteira.', true);
            }
        });

    } catch (error) {
        console.error("Erro na inicialização:", error);
        showNotification('Erro', 'Falha na inicialização do sistema.', true);
    }
});

    </script>
