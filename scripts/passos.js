// passos.js
// ----------------------------------------------------
// Este script exibe uma notificação fixa na parte superior da tela indicando que "Passos está ativo"
// e gerencia a exibição de subcategorias como cards clicáveis em mercado.html.
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 O arquivo passos.js foi carregado com sucesso em mercado.html!");

  // Cria a notificação fixa
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
  if (document.body) {
    document.body.appendChild(notificacao);
    console.log("Notificação adicionada ao body.");
  }

  // Adiciona estilo para a notificação
  const estiloNotificacao = document.createElement('style');
  estiloNotificacao.textContent = `
    #notificacao-passos {
      transition: opacity 0.3s ease;
    }
  `;
  document.head.appendChild(estiloNotificacao);

  // Função para inicializar os cards de subcategorias
  function initSubcategoryCards() {
    const container = document.getElementById('subcategory-container');
    if (!container) {
      console.warn("Contêiner 'subcategory-container' não encontrado em mercado.html.");
      return;
    }

    const cards = [
      { value: 'curtir-facebook', label: 'Curtir no Facebook' },
      { value: 'curtidas-50', label: 'Curtidas no Facebook (mais de 50 amigos)' }
      // Adicione mais opções conforme necessário
    ];

    // Cria os cards dinamicamente
    cards.forEach(card => {
      const div = document.createElement('div');
      div.className = 'subcategory-card bg-surface p-4 rounded-lg shadow cursor-pointer';
      div.dataset.value = card.value;
      div.textContent = card.label;
      container.appendChild(div);
    });

    // Adiciona evento de clique
    document.querySelectorAll('.subcategory-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.subcategory-card').forEach(c => c.classList.remove('border-primary'));
        card.classList.add('border-primary');
        // Verifica se calculateDifficultyAndProof existe antes de chamar
        if (typeof calculateDifficultyAndProof === 'function') {
          const mockInput = { target: { value: card.dataset.value } };
          calculateDifficultyAndProof(mockInput);
          console.log("Subcategoria selecionada:", card.dataset.value);
        } else {
          console.warn("Função calculateDifficultyAndProof não encontrada.");
        }
      });
    });
  }

  // Chama as funções após carregar
  initSubcategoryCards();
});
