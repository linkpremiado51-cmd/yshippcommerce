// modules/historico.js
import { formatCurrency } from './regras.js';
import { loadWalletData } from './saldo.js';

export async function executeUndo(db, firebase, currentUser, walletData, lastTx) {
    const batch = db.batch();
    const walletRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(currentUser.uid);

    if (lastTx.type === 'send') {
        const recipientRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(lastTx.to);
        
        batch.update(walletRef, {
            [`${lastTx.currency}Balance`]: lastTx.metadata.originalBalances[lastTx.currency],
            transactions: firebase.firestore.FieldValue.arrayRemove(lastTx)
        });

        // Simula objeto para remover do destinatário
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
        batch.update(walletRef, {
            reaisBalance: lastTx.metadata.originalBalances.reais,
            goldsBalance: lastTx.metadata.originalBalances.golds,
            transactions: firebase.firestore.FieldValue.arrayRemove(lastTx)
        });

        if (lastTx.type === 'invest') {
            batch.update(walletRef, {
                [`investments.${lastTx.metadata.company}.amount`]: firebase.firestore.FieldValue.increment(-lastTx.amount)
            });
        }
    } else {
        throw new Error("Tipo de transação não suportada para desfazer.");
    }

    await batch.commit();
}

export function renderTransactions(containerId, walletData, sortOrder, filters) {
    const listEl = document.getElementById(containerId);
    if (!listEl) return;

    let txs = (walletData?.transactions || []).slice();
    const { filterType, filterCurrency } = filters;

    txs = txs.filter(tx => {
        const matchesType = !filterType || tx.type === filterType;
        const matchesCurrency = !filterCurrency || tx.currency === filterCurrency;
        return matchesType && matchesCurrency;
    });

    txs.sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        if (sortOrder.field === 'date') return sortOrder.direction === 'asc' ? dateA - dateB : dateB - dateA;
        return sortOrder.direction === 'asc' ? (a.amount - b.amount) : (b.amount - a.amount);
    });

    if (txs.length === 0) {
        listEl.innerHTML = `<div style="text-align:center; padding:1rem;">Nenhuma transação encontrada.</div>`;
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
        const amountLabel = tx.currency === 'golds' ? `${(tx.amount).toLocaleString('pt-BR')} ` : `R$ ${formatCurrency(tx.amount)}`;
        const sign = (['receive', 'deposit', 'withdraw_invest', 'profit_withdrawal'].includes(tx.type)) ? '+' : '-';
        
        return `
            <div class="transaction-item" onclick="window.openTransactionDetails(${txs.length - 1 - index})">
                <div style="flex:1;">
                    <div class="transaction-type">${txType.label}</div>
                    <div class="transaction-desc">${tx.description || '-'}</div>
                    <div class="transaction-date">${new Date(tx.date).toLocaleString('pt-BR')}</div>
                </div>
                <div style="text-align:right">
                    <div class="transaction-amount ${txType.color}">
                        <i class="fas ${txType.icon}"></i> ${sign} ${amountLabel}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

