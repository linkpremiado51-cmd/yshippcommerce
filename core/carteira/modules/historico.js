// modules/historico.js

// Supondo que as funções de saldo estejam disponíveis globalmente como no arquivo anterior
// window.SaldoYshipp

/**
 * Formata uma data ISO para o formato DD/MM/YYYY HH:mm
 * @param {string} isoDateString - Data no formato ISO
 * @returns {string} Data formatada
 */
function formatDate(isoDateString) {
    if (!isoDateString) return 'Data inválida';
    try {
        const date = new Date(isoDateString);
        return date.toLocaleString('pt-BR');
    } catch (e) {
        console.error('Erro ao formatar data:', e);
        return 'Data inválida';
    }
}

/**
 * Formata um valor monetário para exibição
 * @param {number} amount - Valor numérico
 * @param {string} currency - Moeda ('reais', 'golds', 'crypto', etc.)
 * @returns {string} Valor formatado
 */
function formatCurrency(amount, currency = 'golds') {
    if (typeof amount !== 'number') return '0';
    if (currency === 'reais') {
        return `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (currency === 'crypto') {
        // Exemplo para YSC ou outra moeda específica
        return `${amount.toLocaleString('pt-BR')} YSC`;
    } else {
        // Padrão para Golds e outras moedas baseadas em Gold
        return `${amount.toLocaleString('pt-BR')} G`;
    }
}

/**
 * Obtém o símbolo da moeda
 * @param {string} currency - Moeda
 * @returns {string} Símbolo
 */
function getCurrencySymbol(currency) {
    switch (currency) {
        case 'reais': return 'R$';
        case 'golds': return '🪙';
        case 'crypto': return 'YSC'; // ou outro símbolo para cripto
        default: return currency.toUpperCase();
    }
}

/**
 * Gera um resumo textual da transação
 * @param {Object} transaction - Objeto de transação
 * @returns {string} Descrição resumida
 */
function generateTransactionSummary(transaction) {
    if (!transaction) return 'Transação inválida';
    const { type, description, from, to, currency, amount } = transaction;

    if (description) {
        return description;
    }

    const symbol = getCurrencySymbol(currency);
    switch (type) {
        case 'send':
            return `Transferência enviada (${symbol} ${formatCurrency(amount, currency)} para ${to || 'usuário'})`;
        case 'receive':
            return `Transferência recebida (${symbol} ${formatCurrency(amount, currency)} de ${from || 'usuário'})`;
        case 'withdraw':
            return `Saque realizado (${symbol} ${formatCurrency(amount, currency)})`;
        case 'deposit':
            return `Depósito realizado (${symbol} ${formatCurrency(amount, currency)})`;
        case 'invest':
            return `Investimento realizado (${symbol} ${formatCurrency(amount, currency)})`;
        case 'withdraw_invest':
            return `Retirada de investimento (${symbol} ${formatCurrency(amount, currency)})`;
        case 'conversion':
            return `Conversão de moeda (${symbol} ${formatCurrency(amount, currency)})`;
        case 'tax':
            return `Taxa aplicada (${symbol} ${formatCurrency(amount, currency)})`;
        default:
            return `Operação (${type}): ${symbol} ${formatCurrency(amount, currency)}`;
    }
}

/**
 * Filtra transações por critérios
 * @param {Array} transactions - Lista de transações
 * @param {Object} filters - Filtros a serem aplicados
 * @param {string} filters.type - Tipo de transação
 * @param {string} filters.currency - Moeda
 * @param {Date} filters.startDate - Data inicial
 * @param {Date} filters.endDate - Data final
 * @param {string} filters.searchTerm - Termo de busca
 * @returns {Array} Transações filtradas
 */
function filterTransactions(transactions, filters) {
    if (!Array.isArray(transactions)) return [];
    let filtered = [...transactions];

    if (filters.type) {
        filtered = filtered.filter(tx => tx.type === filters.type);
    }
    if (filters.currency) {
        filtered = filtered.filter(tx => tx.currency === filters.currency);
    }
    if (filters.startDate) {
        const start = new Date(filters.startDate);
        filtered = filtered.filter(tx => new Date(tx.date) >= start);
    }
    if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999); // Inclui o dia inteiro
        filtered = filtered.filter(tx => new Date(tx.date) <= end);
    }
    if (filters.searchTerm && filters.searchTerm.trim()) {
        const term = filters.searchTerm.toLowerCase().trim();
        filtered = filtered.filter(tx =>
            (tx.description && tx.description.toLowerCase().includes(term)) ||
            (tx.from && tx.from.toLowerCase().includes(term)) ||
            (tx.to && tx.to.toLowerCase().includes(term))
        );
    }

    return filtered;
}

/**
 * Ordena transações
 * @param {Array} transactions - Lista de transações
 * @param {string} field - Campo para ordenação ('date', 'amount', 'type')
 * @param {string} direction - Direção ('asc', 'desc')
 * @returns {Array} Transações ordenadas
 */
function sortTransactions(transactions, field = 'date', direction = 'desc') {
    if (!Array.isArray(transactions)) return [];
    return [...transactions].sort((a, b) => {
        let valA = a[field];
        let valB = b[field];

        if (field === 'date') {
            valA = new Date(valA);
            valB = new Date(valB);
        }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });
}

/**
 * Agrupa transações por data (útil para UI)
 * @param {Array} transactions - Lista de transações
 * @returns {Object} Transações agrupadas por data
 */
function groupTransactionsByDate(transactions) {
    if (!Array.isArray(transactions)) return {};

    const grouped = {};
    transactions.forEach(tx => {
        const dateStr = new Date(tx.date).toLocaleDateString('pt-BR'); // 'DD/MM/YYYY'
        if (!grouped[dateStr]) {
            grouped[dateStr] = [];
        }
        grouped[dateStr].push(tx);
    });

    // Ordena as datas em ordem decrescente (mais recente primeiro)
    const sortedGrouped = {};
    Object.keys(grouped)
        .sort((a, b) => new Date(b.split('/').reverse().join('-')) - new Date(a.split('/').reverse().join('-')))
        .forEach(date => {
            sortedGrouped[date] = grouped[date];
        });

    return sortedGrouped;
}

/**
 * Renderiza uma lista de transações em um elemento HTML (exemplo genérico)
 * @param {Array} transactions - Lista de transações
 * @param {HTMLElement} containerElement - Elemento do DOM onde renderizar
 * @param {number} limit - Limite de transações a renderizar (opcional)
 */
function renderTransactionList(transactions, containerElement, limit = null) {
    if (!containerElement || !Array.isArray(transactions)) return;

    // Limpa o container
    containerElement.innerHTML = '';

    // Aplica limite se necessário
    const transactionsToShow = limit ? transactions.slice(0, limit) : transactions;

    // Cria e adiciona os elementos de transação
    transactionsToShow.forEach(tx => {
        const txElement = document.createElement('div');
        txElement.className = 'transaction-item';

        const summary = generateTransactionSummary(tx);
        const formattedDate = formatDate(tx.date);
        const formattedAmount = formatCurrency(tx.amount, tx.currency);
        const typeClass = `transaction-${tx.type}`;

        txElement.innerHTML = `
            <div class="transaction-main">
                <div class="transaction-summary ${typeClass}">${summary}</div>
                <div class="transaction-amount ${typeClass}">${formattedAmount}</div>
            </div>
            <div class="transaction-details">
                <div class="transaction-date">${formattedDate}</div>
                <div class="transaction-type">${tx.type}</div>
            </div>
        `;

        containerElement.appendChild(txElement);
    });
}

/**
 * Prepara os dados para exportação em CSV
 * @param {Array} transactions - Lista de transações
 * @returns {string} Conteúdo CSV
 */
function prepareCSVExport(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
        return '';
    }

    const headers = ['Data', 'Tipo', 'Moeda', 'Valor', 'Descrição', 'De/Para', 'Taxa'];
    let csvContent = headers.join(';') + '\n';

    transactions.forEach(tx => {
        const row = [
            tx.date ? formatDate(tx.date) : 'Data inválida',
            tx.type || '-',
            tx.currency || '-',
            tx.currency === 'golds' ? `${formatCurrency(tx.amount || 0, 'golds')}` : `${formatCurrency(tx.amount || 0, tx.currency)}`,
            tx.description || '-',
            tx.from || tx.to || '-',
            tx.metadata?.tax ? formatCurrency(tx.metadata.tax, tx.currency) : '-' // Exemplo de como pegar a taxa se existir
        ];
        csvContent += row.join(';') + '\n';
    });

    return csvContent;
}

/**
 * Dispara o download do arquivo CSV
 * @param {string} csvContent - Conteúdo CSV gerado
 * @param {string} filename - Nome do arquivo
 */
function triggerCSVDownload(csvContent, filename) {
    if (!csvContent) return;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Opcional: revogar a URL para liberar memória
    URL.revokeObjectURL(url);
}

// Exportar funções para uso em outros módulos (padrão IIFE ou objeto global)
// Este padrão permite que outros módulos importem as funções de histórico de forma organizada
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
