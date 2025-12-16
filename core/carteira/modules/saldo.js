// modules/saldo.js
import { GOLD_TO_REAL_RATE } from './regras.js';

export async function saveWallet(db, userId, updatedData, walletData) {
    if (!userId) {
        console.error("Usuário não autenticado. Salvando apenas localmente.");
        localStorage.setItem(`wallet_${userId || 'anonymous'}`, JSON.stringify(updatedData));
        return { ...walletData, ...updatedData };
    }

    try {
        await db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(userId).set(updatedData, { merge: true });
        localStorage.setItem(`wallet_${userId}`, JSON.stringify(updatedData));
        return { ...walletData, ...updatedData };
    } catch (err) {
        console.error("Erro ao salvar no Firebase:", err);
        localStorage.setItem(`wallet_${userId}`, JSON.stringify(updatedData));
        throw new Error('Erro de sincronização. Dados salvos localmente.');
    }
}

export async function loadWalletData(db, auth, userId) {
    console.log(`Carregando carteira para ${userId}`);
    const ref = db.collection('bankCentral').doc('wallets_usuarios').collection('usuarios').doc(userId);
    const snap = await ref.get();

    if (!snap.exists) {
        const initialData = {
            userId: userId,
            name: auth.currentUser?.displayName || 'Usuário',
            goldsBalance: 0,
            reaisBalance: 0,
            portfolioBalance: 0,
            enterpriseBalance: 0,
            cryptoBalance: 0,
            investments: {},
            transactions: [],
            taxes: [],
            createdAt: new Date().toISOString(), // Usando string ISO para compatibilidade
            lastUpdated: new Date().toISOString()
        };
        await ref.set(initialData);
        return initialData;
    }
    return snap.data();
}

export async function updateSystemReserves(db, amount, currency) {
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

