// passos.js
// ----------------------------------------------------
// Este script exibe uma notificação fixa na parte superior da tela indicando que "Passos está ativo".
// A notificação permanece visível enquanto a página estiver carregada.
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 O arquivo passos.js foi carregado com sucesso em mercado.html!");
  console.log("Verificando ambiente...");

  // Cria a notificação
  const notificacao = document.createElement('div');
  notificacao.id = 'notificacao-passos';
  notificacao.textContent = '🚀 Passos está ativo';
  notificacao.style = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: #2d3748;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
    z-index: 999999;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
  `;

  // Adiciona a notificação ao body
  if (document.body) {
    document.body.appendChild(notificacao);
    console.log("Notificação adicionada ao body.");
  } else {
    console.error("Erro: document.body não encontrado.");
  }

  // Adiciona estilo para garantir compatibilidade
  const estilo = document.createElement('style');
  estilo.textContent = `
    #notificacao-passos {
      transition: opacity 0.3s ease;
    }
  `;
  document.head.appendChild(estilo);
  console.log("Estilo adicionado.");
});
