// passos.js
// Este código "ouve" o momento em que o usuário publica um serviço
// e executa ações de melhoria visual e feedback.

document.addEventListener('DOMContentLoaded', () => {

  // Procura o botão de publicação no HTML
  const botaoPublicar = document.getElementById('botao-publicar');

  // Verifica se o botão existe antes de continuar
  if (botaoPublicar) {

    // Quando o usuário clicar em "Publicar"
    botaoPublicar.addEventListener('click', () => {

      // Aqui, o arquivo de melhorias sabe que uma publicação foi feita
      console.log("📢 O sistema detectou que um serviço foi publicado!");

      // Você pode exibir uma animação visual
      const alerta = document.createElement('div');
      alerta.innerHTML = `
        <div style="
          position: fixed;
          top: 20px;
          right: 20px;
          background: #00b894;
          color: white;
          padding: 15px 20px;
          border-radius: 12px;
          font-size: 16px;
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
          z-index: 9999;
        ">
          ✅ Serviço publicado com sucesso! O sistema registrou sua taxa.
        </div>
      `;
      document.body.appendChild(alerta);

      // Remove o alerta após 3 segundos
      setTimeout(() => alerta.remove(), 3000);

      // (Opcional) Envia uma notificação interna personalizada
      const eventoPublicacao = new CustomEvent("servicoPublicado", {
        detail: {
          hora: new Date(),
          usuario: "Usuário atual", // pode vir do sistema
          status: "sucesso"
        }
      });
      document.dispatchEvent(eventoPublicacao);
    });
  }

  // Ouvinte do evento personalizado (para futuras integrações)
  document.addEventListener("servicoPublicado", (e) => {
    console.log("Evento detectado pelo sistema de melhorias:", e.detail);
    // Aqui você pode executar funções automáticas:
    // atualizar barras, somar lucros, mudar interface, etc.
  });
});
