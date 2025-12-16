// modules/saques.js
import { updateSystemReserves } from './saldo.js';

export async function executeWithdrawal(db, firebase, currentUser, walletData, data) {
    const { currency, amount, tax, netAmount, pixKey } = data;
    
    const walletRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(currentUser.uid);
    const batch = db.batch();

    const fieldToUpdate = currency === 'reais' ? 'reaisBalance' : 'goldsBalance';
    batch.update(walletRef, {
        [fieldToUpdate]: firebase.firestore.FieldValue.increment(-(amount + tax))
    });

    const symbol = currency === 'reais' ? 'R$' : '';
    batch.update(walletRef, {
        transactions: firebase.firestore.FieldValue.arrayUnion({
            type: 'withdraw',
            amount,
            currency,
            description: `Saque de ${amount.toLocaleString('pt-BR')} ${symbol}`,
            date: new Date().toISOString(),
            metadata: { pixKey: currency === 'reais' ? pixKey : undefined, tax, canUndo: false }
        }),
        taxes: firebase.firestore.FieldValue.arrayUnion({
            type: 'withdraw',
            amount: tax,
            currency,
            date: new Date().toISOString()
        })
    });

    await batch.commit();
    await updateSystemReserves(db, tax, currency);
}

export async function executeProfitWithdrawal(db, firebase, currentUser, walletData, data) {
    const { amount, tax, finalAmount } = data;
    
    const walletRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(currentUser.uid);
    const batch = db.batch();

    batch.update(walletRef, {
        goldsBalance: (walletData.goldsBalance || 0) + finalAmount,
        portfolioBalance: 0
    });

    batch.update(walletRef, {
        transactions: firebase.firestore.FieldValue.arrayUnion({
            type: 'profit_withdrawal',
            amount: finalAmount,
            currency: 'golds',
            description: `Resgate de lucro acumulado (${amount.toLocaleString('pt-BR')} bruto, -${tax.toLocaleString('pt-BR')} taxa)`,
            date: new Date().toISOString(),
            metadata: { canUndo: false }
        }),
        taxes: firebase.firestore.FieldValue.arrayUnion({
            type: 'portfolio_withdraw',
            amount: tax,
            currency: 'golds',
            date: new Date().toISOString()
        })
    });

    await batch.commit();
}

