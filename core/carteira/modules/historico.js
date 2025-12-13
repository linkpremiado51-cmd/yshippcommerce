// modules/historico.js

// ================================
// HISTÓRICO DE TRANSAÇÕES – YSHIPPBANK
// ================================

// ================================
// FORMATAÇÕES
// ================================
function formatDate(isoDate) {
    if (!isoDate) return 'Data inválida';
    const date = new Date(isoDate);
    return date.toLocaleString('pt-BR');
}

function formatCurrency(amount, currency) {
    if (typeof amount !== 'number') amount = 0;

    switch (currency) {
        case 'reais':
            return `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        case 'crypto':
            return `${amount.toLocaleString('pt-BR')} YSC`;
        default:
            return `${amount.toLocaleString('pt-BR')} G`;
    }
}

function getCurrencySymbol(currency) {
    switch (currency) {
        case 'reais': return 'R$';
        case 'golds': return 'G';
        case 'crypto': return 'YSC';
        default: return currency?.toUpperCase() || '';
    }
}

// ================================
// RESUMO DE TRANSAÇÃO
// ================================
function generateTransactionSummary(tx) {
    if (!tx) return 'Transação inválida';

    if (tx.description) return tx.description;

    const symbol = getCurrencySymbol(tx.currency);

    switch (tx.type) {
        case 'send':
            return `Enviado ${symbol} ${formatCurrency(tx.amount, tx.currency)} para ${tx.to}`;
        case 'receive':
            return `Recebido ${symbol} ${formatCurrency(tx.amount, tx.currency)} de ${tx.from}`;
        case 'withdraw':
            return `Saque ${symbol} ${formatCurrency(tx.amount, tx.currency)}`;
        case 'deposit':
            return `Depósito ${symbol} ${formatCurrency(tx.amount, tx.currency)}`;
        case 'invest':
            return `Investimento ${symbol} ${formatCurrency(tx.amount, tx.currency)}`;
        case 'withdraw_invest':
            return `Resgate de investimento ${symbol} ${formatCurrency(tx.amount, tx.currency)}`;
        case 'conversion':
            return `Conversão ${symbol} ${formatCurrency(tx.amount, tx.currency)}`;
        case 'tax':
            return `Taxa ${symbol} ${formatCurrency(tx.amount, tx.currency)}`;
        default:
            return `${tx.type} ${symbol} ${formatCurrency(tx.amount, tx.currency)}`;
    }
}

// ================================
// FILTROS
// ================================
function filterTransactions(transactions, filters = {}) {
    if (!Array.isArray(transactions)) return [];

    let list = [...transactions];

    if (filters.type) {
        list = list.filter(tx => tx.type === filters.type);
    }

    if (filters.currency) {
        list = list.filter(tx => tx.currency === filters.currency);
    }

    if (filters.startDate) {
        const start = new Date(filters.startDate);
        list = list.filter(tx => new Date(tx.date) >= start);
    }

    if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        list = list.filter(tx => new Date(tx.date) <= end);
    }

    if (filters.search) {
        const term = filters.search.toLowerCase();
        list = list.filter(tx =>
            tx.description?.toLowerCase().includes(term) ||
            tx.from?.toLowerCase().includes(term) ||
            tx.to?.toLowerCase().includes(term)
        );
    }

    return list;
}

// ================================
// ORDENAÇÃO
// ================================
function sortTransactions(transactions, field = 'date', direction = 'desc') {
    if (!Array.isArray(transactions)) return [];

    return [...transactions].sort((a, b) => {
        let A = a[field];
        let B = b[field];

        if (field === 'date') {
            A = new Date(A);
            B = new Date(B);
        }

        if (A < B) return direction === 'asc' ? -1 : 1;
        if (A > B) return direction === 'asc' ? 1 : -1;
        return 0;
    });
}

// ================================
// AGRUPAMENTO POR DATA
// ================================
function groupTransactionsByDate(transactions) {
    const grouped = {};

    transactions.forEach(tx => {
        const dateKey = new Date(tx.date).toLocaleDateString('pt-BR');
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(tx);
    });

    return grouped;
}

// ================================
// RENDERIZAÇÃO
// ================================
function renderTransactionList(transactions, container, limit = null) {
    if (!container || !Array.isArray(transactions)) return;

    container.innerHTML = '';

    const list = limit ? transactions.slice(0, limit) : transactions;

    list.forEach(tx => {
        const div = document.createElement('div');
        div.className = `transaction-item transaction-${tx.type}`;

        div.innerHTML = `
            <div class="transaction-main">
                <span class="transaction-summary">${generateTransactionSummary(tx)}</span>
                <span class="transaction-amount">${formatCurrency(tx.amount, tx.currency)}</span>
            </div>
            <div class="transaction-details">
                <span class="transaction-date">${formatDate(tx.date)}</span>
                <span class="transaction-type">${tx.type}</span>
            </div>
        `;

        container.appendChild(div);
    });
}

// ================================
// EXPORTAÇÃO CSV
// ================================
function prepareCSVExport(transactions) {
    if (!transactions?.length) return '';

    const headers = ['Data', 'Tipo', 'Moeda', 'Valor', 'Descrição', 'Origem/Destino'];
    let csv = headers.join(';') + '\n';

    transactions.forEach(tx => {
        csv += [
            formatDate(tx.date),
            tx.type,
            tx.currency,
            tx.amount,
            tx.description || '',
            tx.from || tx.to || ''
        ].join(';') + '\n';
    });

    return csv;
}

function triggerCSVDownload(csvContent, filename) {
    if (!csvContent) return;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}

// ================================
// EXPORT GLOBAL
// ================================
window.HistoricoYshipp = {
    formatDate,
    formatCurrency,
    getCurrencySymbol,
    generateTransactionSummary,
    filterTransactions,
    sortTransactions,
    groupTransactionsByDate,
    renderTransactionList,
    prepareCSVExport,
    triggerCSVDownload
};
