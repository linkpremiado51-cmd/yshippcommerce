// modules/transferencias.js
import { updateSystemReserves } from './saldo.js';
import { GOLD_TO_REAL_RATE } from './regras.js';

export async function processDepositLogic(db, currentUser, walletData, data) {
    const { netAmount, tax, method, amount, pixKey } = data;

    // Atualiza saldo
    const newReaisBalance = (walletData.reaisBalance || 0) + netAmount;

    const batch = db.batch();
    const walletRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(currentUser.uid);

    batch.update(walletRef, { reaisBalance: newReaisBalance });
    
    // Transação
    const transaction = {
        type: 'deposit',
        amount: netAmount,
        currency: 'reais',
        description: `Depósito via ${method.toUpperCase()}`,
        date: new Date().toISOString(),
        metadata: { method, fullAmount: amount, tax, pixKey: method === 'pix' ? pixKey : undefined, canUndo: true, undoTimeout: Date.now() + 300000 }
    };
    
    // Adiciona arrayUnion via lógica auxiliar ou direta (aqui simplificado para batch direto se possível, mas o arrayUnion é do firebase)
    // Nota: Como estamos em módulos puros JS, precisamos passar o objeto firebase ou usar a sintaxe compat
    // Assumindo que 'firebase' está global ou passado. Vamos simplificar assumindo que o orquestrador lida com a chamada específica do firebase se for complexo,
    // mas aqui faremos a lógica de update.
    
    return { 
        transaction, 
        taxEntry: { type: 'deposit', amount: tax, currency: 'reais', date: new Date().toISOString() },
        newBalance: { reaisBalance: newReaisBalance }
    };
}

export async function validateUserId(db, userId, currentUserId) {
    if (!userId || userId === currentUserId) return false;
    try {
        const userDoc = await db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(userId).get();
        return userDoc.exists;
    } catch (err) {
        return false;
    }
}

export async function executeTransfer(db, firebase, currentUser, walletData, data) {
    const { recipientId, currency, amount, tax } = data;
    
    const batch = db.batch();
    const senderRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(currentUser.uid);
    const recipientRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(recipientId);

    // Sender Updates
    batch.update(senderRef, {
        [`${currency}Balance`]: firebase.firestore.FieldValue.increment(-(amount + tax)),
        transactions: firebase.firestore.FieldValue.arrayUnion({
            type: 'send',
            amount: amount,
            currency,
            description: `Transferência para ${recipientId}`,
            date: new Date().toISOString(),
            to: recipientId,
            metadata: { tax, netAmount: amount - tax, canUndo: true, undoTimeout: Date.now() + 300000, originalBalances: { reais: walletData.reaisBalance, golds: walletData.goldsBalance } }
        }),
        taxes: firebase.firestore.FieldValue.arrayUnion({ type: 'transfer', amount: tax, currency, date: new Date().toISOString() })
    });

    // Recipient Updates
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
    await updateSystemReserves(db, tax, currency);
}

export async function executeConversion(db, firebase, currentUser, walletData, data) {
    const { from, to, amount, tax, convertedAmount } = data;
    
    const updates = {
        [`${from}Balance`]: (walletData[`${from}Balance`] || 0) - (amount + tax),
        [`${to}Balance`]: (walletData[`${to}Balance`] || 0) + convertedAmount
    };

    const walletRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(currentUser.uid);
    const batch = db.batch();

    batch.update(walletRef, updates);
    
    const fromSymbol = from === 'golds' ? '🪙' : 'R$';
    const toSymbol = to === 'golds' ? '' : 'R$';

    batch.update(walletRef, {
        transactions: firebase.firestore.FieldValue.arrayUnion({
            type: 'conversion',
            amount,
            from,
            to,
            convertedAmount,
            currency: from,
            description: `Conversão de ${amount.toLocaleString('pt-BR')} ${fromSymbol} para ${convertedAmount.toLocaleString('pt-BR')} ${toSymbol}`,
            date: new Date().toISOString(),
            metadata: { tax, canUndo: true, undoTimeout: Date.now() + 300000, originalBalances: { reais: walletData.reaisBalance, golds: walletData.goldsBalance } }
        }),
        taxes: firebase.firestore.FieldValue.arrayUnion({ type: 'conversion', amount: tax, currency: from, date: new Date().toISOString() })
    });

    await batch.commit();
}

