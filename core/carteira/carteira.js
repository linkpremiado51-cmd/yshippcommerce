document.addEventListener('DOMContentLoaded', async function() {
    console.log("Aguardando autenticação...");
    try {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.dataset.theme = savedTheme;

        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => console.log("✅ Persistência LOCAL ativada — o mesmo usuário será mantido ao relogar."))
            .catch(error => console.error("Erro ao configurar persistência:", error));

        auth.onAuthStateChanged(async (user) => {
            console.log("auth.onAuthStateChanged -> Usuário detectado");
            if (!user) {
                await ensureAnonymousSignIn();
                return;
            }
            currentUser = user;
            console.log(`Usuário ativo: ${user.uid}`);

            const footerUserIdEl = document.getElementById('footerUserId');
            const footerUserNameEl = document.getElementById('footerUserName');
            const loadingOverlayEl = document.getElementById('loadingOverlay');
            if (footerUserIdEl) footerUserIdEl.textContent = user.uid;
            if (footerUserNameEl) footerUserNameEl.textContent =
                user.displayName || (user.isAnonymous ? 'Anônimo' : (user.email || 'Usuário'));

            try {
                await loadWalletData(user.uid);
                if (loadingOverlayEl) loadingOverlayEl.style.display = 'none';
                setupEventListeners();
                populateInvestmentOptions();

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

function setupEventListeners() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const newTheme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
            document.body.dataset.theme = newTheme;
            localStorage.setItem('theme', newTheme);
        });
    }

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

    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => window.location.href = "cadastro.html");
        });
    }

    setupInputFormatting();
    setupCarousel();

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

    document.getElementById('confirmActionBtn')?.addEventListener('click', executeConfirmedAction);
    document.getElementById('cancelActionBtn')?.addEventListener('click', () => closeModal('confirmationModal'));
}

function renderWallet() {
    if (!walletData) return;

    SaldoYshipp.updateBalanceDisplay(walletData);
    HistoricoYshipp.updateStats(walletData);
    checkCryptoButton();
    checkCommercialButton();
    renderTransactions();
    renderInvestmentSummary();
}

function renderTransactions() {
    const listEl = document.getElementById('transaction-list');
    const filterType = document.getElementById('filter-type')?.value;
    const filterCurrency = document.getElementById('filter-currency')?.value;
    if (!listEl) return;

    let txs = (walletData?.transactions || []).slice();
    txs = txs.filter(tx => {
        const matchesType = !filterType || tx.type === filterType;
        const matchesCurrency = !filterCurrency || tx.currency === filterCurrency;
        return matchesType && matchesCurrency;
    });

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

    if (txs.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center; padding:1rem; color:var(--text-secondary)">
                <i class="fas fa-inbox" style="font-size:1.5rem; opacity:0.6"></i>
                <div style="margin-top:0.5rem; font-size:0.85rem">Nenhuma transação encontrada.</div>
            </div>
        `;
        return;
    }

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
        const accumulatedReturn = InvestimentosYshipp.calculateCurrentReturn(inv.id, investedAmount, inv.date);
        const totalValue = investedAmount + accumulatedReturn;
        const isLocked = InvestimentosYshipp.isInvestmentLocked(inv.date, plan.lockInDays);
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

    const portfolioBalanceEl = document.getElementById('portfolio-balance');
    if (portfolioBalanceEl) portfolioBalanceEl.textContent = `${(walletData?.portfolioBalance || 0).toLocaleString('pt-BR')} `;
}

function populateInvestmentOptions() {
    const investSelect = document.getElementById('invest-company');
    const withdrawSelect = document.getElementById('withdraw-invest-company');
    if (!investSelect || !withdrawSelect) return;

    investSelect.innerHTML = '<option value="">Selecione uma Empresa/Serviço</option>';
    withdrawSelect.innerHTML = '<option value="">Selecione um Investimento Ativo</option>';

    Object.entries(INVESTMENT_PLANS).forEach(([id, plan]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${plan.name} (Mínimo: ${plan.minInvest.toLocaleString('pt-BR')} )`;
        investSelect.appendChild(option);
    });

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

async function undoTransaction(index) {
    const txs = walletData?.transactions || [];
    const tx = txs[txs.length - 1 - index];
    if (!tx) return;
    if (!tx.metadata?.canUndo || tx.metadata.undoTimeout < Date.now()) {
        showNotification('Erro', 'Não é possível desfazer esta transação ou o prazo expirou.', true);
        return;
    }

    try {
        closeModal('transactionDetailsModal');
        await backupWalletData();
        const batch = db.batch();
        const walletRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(currentUser.uid);

        if (tx.type === 'send') {
            const recipientRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(tx.to);
            batch.update(walletRef, {
                [`${tx.currency}Balance`]: tx.metadata.originalBalances[tx.currency],
                transactions: firebase.firestore.FieldValue.arrayRemove(tx)
            });
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
        } else if (['deposit', 'conversion', 'invest'].includes(tx.type)) {
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

function checkCryptoButton() {
    const cryptoBtn = document.getElementById('analyzeCryptoBtn');
    if (cryptoBtn) {
        cryptoBtn.disabled = (walletData?.goldsBalance || 0) < 1000000;
        cryptoBtn.title = (walletData?.goldsBalance || 0) < 1000000
            ? "Você precisa de 1.000.000  para acessar esta funcionalidade"
            : "Analisar sua criptomoeda YSC";
    }
}

function checkCommercialButton() {
    const commercialBtn = document.querySelector('.action-btn.commercial');
    if (commercialBtn) {
        commercialBtn.style.display = (walletData?.goldsBalance || 0) >= 500000 ? 'block' : 'none';
    }
}

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

async function executeConfirmedAction() {
    closeModal('confirmationModal');
    if (!pendingAction) return;
    const actionType = pendingAction.type;
    showLoading(actionType);
    try {
        switch (actionType) {
            case 'deposit':
                await SaldoYshipp.processDepositConfirmed();
                break;
            case 'withdraw':
                await SaquesYshipp.processWithdrawalConfirmed();
                break;
            case 'transfer':
                await TransferenciasYshipp.processTransferConfirmed();
                break;
            case 'conversion':
                await SaldoYshipp.processConversionConfirmed();
                break;
            case 'invest':
                await InvestimentosYshipp.processInvestConfirmed();
                break;
            case 'withdraw_investment':
                await InvestimentosYshipp.processWithdrawalInvestmentConfirmed();
                break;
            case 'profit_withdrawal':
                await SaldoYshipp.processProfitWithdrawalConfirmed();
                break;
            default:
                showNotification('Erro', 'Ação desconhecida.', true);
        }
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

function toggleSortOrder(field) {
    if (sortOrder.field === field) {
        sortOrder.direction = sortOrder.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortOrder.field = field;
        sortOrder.direction = 'desc';
    }

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
