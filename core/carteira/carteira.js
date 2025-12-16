// carteira.js
// IMPORTANTE: Adicione type="module" na tag script do HTML: <script type="module" src="carteira.js"></script>

import * as Regras from './modules/regras.js';
import * as Saldo from './modules/saldo.js';
import * as Transferencias from './modules/transferencias.js';
import * as Saques from './modules/saques.js';
import * as Investimentos from './modules/investimentos.js';
import * as Historico from './modules/historico.js';

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyDbxygCeFLDbf6Ge6YZHJqq0VvlSSfbc_I",
    authDomain: "yshippcommerce.firebaseapp.com",
    projectId: "yshippcommerce",
    storageBucket: "yshippcommerce.appspot.com",
    messagingSenderId: "680576769517",
    appId: "1:680576769517:web:ace30d8e451ee70511dbe4"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- Global State ---
let currentUser = null;
let walletData = null;
let pendingAction = null;
let sortOrder = { field: 'date', direction: 'desc' };

// --- UI Helpers ---
function showNotification(title, message, isError = false) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    notification.innerHTML = `<strong>${title}:</strong> ${message}`;
    notification.className = `notification ${isError ? 'error' : 'success'} show`;
    setTimeout(() => notification.classList.remove('show'), 5000);
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showLoading(id) { document.getElementById(`${id}-loading`)?.classList.add('active'); }
function hideLoading(id) { document.getElementById(`${id}-loading`)?.classList.remove('active'); }

// --- Main Render Function ---
function renderUI() {
    if (!walletData) return;

    // Update Basic Balances
    document.getElementById('golds-balance').textContent = (walletData.goldsBalance || 0).toLocaleString('pt-BR');
    document.getElementById('reais-balance').textContent = `R$ ${Regras.formatCurrency(walletData.reaisBalance || 0)}`;
    document.getElementById('portfolio-balance').textContent = (walletData.portfolioBalance || 0).toLocaleString('pt-BR');
    document.getElementById('enterprise-balance').textContent = (walletData.enterpriseBalance || 0).toLocaleString('pt-BR');
    document.getElementById('crypto-balance').textContent = (walletData.cryptoBalance || 0).toLocaleString('pt-BR');

    // Stats
    const txs = walletData.transactions || [];
    document.getElementById('total-transactions').textContent = txs.length;

    // Call Module Renderers
    Historico.renderTransactions('transaction-list', walletData, sortOrder, {
        filterType: document.getElementById('filter-type')?.value,
        filterCurrency: document.getElementById('filter-currency')?.value
    });
    
    // Render Investments Summary (Lógica Inline simplificada aqui ou movida para modulo se for complexa de UI)
    renderInvestmentSummary();
}

function renderInvestmentSummary() {
    const listEl = document.getElementById('investment-summary-list');
    if (!listEl) return;
    const investments = Object.entries(walletData.investments || {}).filter(([, inv]) => inv.amount > 0);
    
    if (investments.length === 0) {
        listEl.innerHTML = `<div style="text-align:center; padding:1rem;">Sem investimentos ativos.</div>`;
        return;
    }

    listEl.innerHTML = investments.map(([id, inv]) => {
        const plan = Regras.INVESTMENT_PLANS[id];
        const currentReturn = Investimentos.calculateCurrentReturn(id, inv.amount, inv.date);
        const isLocked = Investimentos.isInvestmentLocked(inv.date, plan.lockInDays);
        return `
            <div class="investment-card">
                <div>${plan.name} <span style="color:${isLocked ? 'red' : 'green'}">${isLocked ? '(Lock)' : '(Livre)'}</span></div>
                <div style="text-align:right">${inv.amount.toLocaleString('pt-BR')} + ${currentReturn.toLocaleString('pt-BR')}</div>
            </div>`;
    }).join('');
}

// --- Action Handlers (Bridges between UI and Modules) ---

// 1. Depósito
window.processDeposit = async function() {
    const amountInput = document.getElementById('deposit-amount');
    const method = document.getElementById('deposit-method').value;
    const amount = parseFloat(amountInput.value.replace(/\./g, '').replace(',', '.'));
    
    if (isNaN(amount) || amount <= 0) return showNotification('Erro', 'Valor inválido', true);
    
    const taxRate = Regras.getTaxRate('deposit', 'reais');
    const tax = amount * taxRate;
    
    pendingAction = { type: 'deposit', amount, netAmount: amount - tax, tax, method };
    
    document.getElementById('confirmation-message').innerHTML = `Confirma depósito de R$ ${Regras.formatCurrency(amount)}?`;
    openModal('confirmationModal');
};

// 2. Transferência
window.confirmTransfer = async function() {
    const recipientId = document.getElementById('recipient-id').value.trim();
    const currency = document.getElementById('transfer-currency').value;
    const amount = parseFloat(document.getElementById('transfer-amount').value.replace(/\./g, '').replace(',', '.'));

    if (!Regras.validateBalance(walletData, currency, amount)) return showNotification('Erro', 'Saldo insuficiente', true);
    if (!await Transferencias.validateUserId(db, recipientId, currentUser.uid)) return showNotification('Erro', 'Destinatário inválido', true);

    const taxRate = Regras.getTaxRate('transfer', currency);
    const tax = amount * taxRate;

    pendingAction = { type: 'transfer', recipientId, currency, amount, tax };
    document.getElementById('confirmation-message').innerHTML = `Confirma transferir ${amount} ${currency}?`;
    openModal('confirmationModal');
}

// 3. Execution (Callback for Modal)
window.executeConfirmedAction = async function() {
    closeModal('confirmationModal');
    if (!pendingAction) return;
    
    showLoading(pendingAction.type);
    try {
        if (pendingAction.type === 'deposit') {
            const result = await Transferencias.processDepositLogic(db, currentUser, walletData, pendingAction);
            // Update Firestore with result transaction (or use the one inside logic if implemented directly)
            // No modulo atual, processDepositLogic retorna os objetos, precisamos salvar aqui ou mover a logica de save para lá.
            // Para simplificar, vou assumir que processDepositLogic faz o batch.update igual executeTransfer.
            // Correção: Vou ajustar processDepositLogic no modulo para fazer o commit.
            // *Nota: Para o código funcionar, o modulo deve fazer o commit.*
            await db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(currentUser.uid).update({
                reaisBalance: firebase.firestore.FieldValue.increment(pendingAction.netAmount),
                transactions: firebase.firestore.FieldValue.arrayUnion(result.transaction),
                taxes: firebase.firestore.FieldValue.arrayUnion(result.taxEntry)
            });
            await Saldo.updateSystemReserves(db, pendingAction.tax, 'reais');
        }
        else if (pendingAction.type === 'transfer') {
            await Transferencias.executeTransfer(db, firebase, currentUser, walletData, pendingAction);
        }
        else if (pendingAction.type === 'withdraw') {
            await Saques.executeWithdrawal(db, firebase, currentUser, walletData, pendingAction);
        }
        else if (pendingAction.type === 'invest') {
            await Investimentos.executeInvest(db, firebase, currentUser, walletData, pendingAction);
        }
        
        showNotification('Sucesso', 'Operação realizada!');
    } catch (err) {
        console.error(err);
        showNotification('Erro', 'Falha na operação', true);
    } finally {
        hideLoading(pendingAction.type);
        pendingAction = null;
    }
};


// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // Theme setup
    document.body.dataset.theme = localStorage.getItem('theme') || 'light';
    
    // Auth Listener
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            await auth.signInAnonymously();
            return;
        }
        currentUser = user;
        document.getElementById('footerUserName').textContent = user.displayName || 'Anônimo';
        document.getElementById('footerUserId').textContent = user.uid;

        // Initial Load
        walletData = await Saldo.loadWalletData(db, auth, user.uid);
        renderUI();

        // Realtime Listener
        db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(user.uid)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    walletData = doc.data();
                    renderUI();
                }
            });
    });

    // Event Listeners (UI Toggles)
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const newTheme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
        document.body.dataset.theme = newTheme;
        localStorage.setItem('theme', newTheme);
    });
    
    // Bind Confirmation Modal Buttons
    document.getElementById('confirmActionBtn')?.addEventListener('click', window.executeConfirmedAction);
    document.getElementById('cancelActionBtn')?.addEventListener('click', () => closeModal('confirmationModal'));
    
    // Expose needed functions to window for HTML onclick attributes (Legacy support)
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.formatInputCurrency = (el) => { /* Lógica de formatação */ };
});

