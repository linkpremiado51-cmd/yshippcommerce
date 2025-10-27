// passos.js (continuação)
// ----------------------------------------------------
// Gerencia a exibição de subcategorias como cards clicáveis em vez de select.
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Função para inicializar os cards de subcategorias
  function initSubcategoryCards() {
    const container = document.getElementById('subcategory-container');
    if (!container) return;

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
        // Simula evento de mudança para calculateDifficultyAndProof
        const event = new Event('change', { bubbles: true });
        const mockInput = { target: { value: card.dataset.value } };
        if (typeof calculateDifficultyAndProof === 'function') {
          calculateDifficultyAndProof(mockInput);
        }
      });
    });
  }

  // Chama a função após carregar a notificação
  initSubcategoryCards();
});
