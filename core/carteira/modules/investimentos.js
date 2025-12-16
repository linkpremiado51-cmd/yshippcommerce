// modules/investimentos.js
import { INVESTMENT_PLANS, GOLD_TO_REAL_RATE } from './regras.js';
import { updateSystemReserves } from './saldo.js';

export function isInvestmentLocked(initialDate, lockInDays) {
    if (!initialDate || lockInDays <= 0) return false;
    const start = initialDate.toDate ? initialDate.toDate() : new Date(initialDate); // Compatibilidade Timestamp Firestore
    const lockInPeriodEnd = new Date(start);
    lockInPeriodEnd.setDate(lockInPeriodEnd.getDate() + lockInDays);
    return new Date() < lockInPeriodEnd;
}

export function calculateCurrentReturn(investmentId, investedAmount, initialDate) {
    const plan = INVESTMENT_PLANS[investmentId];
    if (!plan || investedAmount <= 0 || !initialDate) return 0;

    const now = new Date();
    const start = initialDate.toDate ? initialDate.toDate() : new Date(initialDate);

    if (start > now) return 0;

    const diffTime = now - start;
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    const ratePerDay = plan.returnRate / 30;
    const totalReturnRate = diffDays * ratePerDay;

    return Math.floor(investedAmount * totalReturnRate);
}

export async function executeInvest(db, firebase, currentUser, walletData, data) {
    const { companyId, amount, tax, totalCost, plan } = data;
    
    const batch = db.batch();
    const walletRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(currentUser.uid);
    
    const currentInvestment = walletData.investments?.[companyId] || { amount: 0 };
    const newInvestmentAmount = (currentInvestment.amount || 0) + amount;

    // Atualiza saldo e objeto de investimento
    batch.update(walletRef, {
        goldsBalance: firebase.firestore.FieldValue.increment(-totalCost),
        [`investments.${companyId}`]: {
            amount: newInvestmentAmount,
            date: currentInvestment.amount === 0 ? new Date().toISOString() : currentInvestment.date,
            planId: companyId
        }
    });

    // Registra transação e taxa
    batch.update(walletRef, {
        transactions: firebase.firestore.FieldValue.arrayUnion({
            type: 'invest',
            amount,
            currency: 'golds',
            description: `Investimento em ${plan.name}`,
            date: new Date().toISOString(),
            metadata: { company: companyId, tax, planName: plan.name, returnRate: plan.returnRate, lockInDays: plan.lockInDays, canUndo: true, undoTimeout: Date.now() + 300000, originalBalances: { golds: walletData.goldsBalance, reais: walletData.reaisBalance } }
        }),
        taxes: firebase.firestore.FieldValue.arrayUnion({
            type: 'invest',
            amount: tax,
            currency: 'golds',
            date: new Date().toISOString(),
            description: `Taxa de investimento em ${plan.name}`
        })
    });

    await batch.commit();
    await updateSystemReserves(db, tax / GOLD_TO_REAL_RATE, 'reais');
}

export async function executeWithdrawInvestment(db, firebase, currentUser, walletData, data) {
    const { companyId, amountToWithdraw, finalPenalty, finalAmount, plan, accumulatedReturn } = data;

    const batch = db.batch();
    const walletRef = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(currentUser.uid);

    batch.update(walletRef, {
        goldsBalance: firebase.firestore.FieldValue.increment(finalAmount),
        [`investments.${companyId}.amount`]: firebase.firestore.FieldValue.increment(-amountToWithdraw),
        portfolioBalance: firebase.firestore.FieldValue.increment(-accumulatedReturn)
    });

    batch.update(walletRef, {
        transactions: firebase.firestore.FieldValue.arrayUnion({
            type: 'withdraw_invest',
            amount: finalAmount,
            currency: 'golds',
            description: `Retirada de ${amountToWithdraw} investidos em ${plan.name}`,
            date: new Date().toISOString(),
            metadata: { company: companyId, principalWithdrawn: amountToWithdraw, finalReturn: accumulatedReturn, penalty: finalPenalty, canUndo: false }
        }),
        taxes: firebase.firestore.FieldValue.arrayUnion({
            type: 'withdraw_invest_penalty',
            amount: finalPenalty,
            currency: 'golds',
            date: new Date().toISOString()
        })
    });

    await batch.commit();
}

