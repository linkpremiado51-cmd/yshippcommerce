// passos.js
// ----------------------------------------------------
// Este script monitora os cliques no botão "Confirmar publicação",
// mesmo que o botão seja criado depois que a página já foi carregada.
// Isso é possível graças à "delegação de eventos".
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 O arquivo passos.js foi carregado com sucesso!");

  // Usa o body como "ouvinte" de todos os cliques da página.
  // Assim, mesmo que o botão ainda não exista no carregamento,
  // ele será detectado quando aparecer e for clicado.
  document.body.addEventListener('click', (e) => {

    // Verifica se o elemento clicado tem o ID 'confirmar-publicacao'
    if (e.target.id === 'confirmar-publicacao') {

      // Cria o aviso visual no centro da tela
      const aviso = document.createElement('div');
      aviso.innerHTML = `
        <div id="aviso-yshipp" style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(0.8);
          background: linear-gradient(135deg, #0984e3, #00cec9);
          color: white;
          padding: 25px 40px;
          border-radius: 15px;
          font-size: 20px;
          font-weight: bold;
          box-shadow: 0 0 25px rgba(0, 0, 0, 0.3);
          opacity: 0;
          animation: aparecerAviso 0.5s ease forwards, desaparecerAviso 0.5s ease 2.5s forwards;
          z-index: 99999;
          text-align: center;
        ">
          ✅ Publicação confirmada!<br>
          <span style="font-size: 16px; font-weight: normal;">O sistema de melhorias (passos.js) está funcionando.</span>
        </div>
      `;

      // Mostra o aviso na tela
      document.body.appendChild(aviso);

      // Remove o aviso após 3 segundos
      setTimeout(() => aviso.remove(), 3000);
    }
  });

  // Adiciona no HTML o estilo da animação visual
  const estilo = document.createElement('style');
  estilo.textContent = `
    @keyframes aparecerAviso {
      from { opacity: 0; transform: translate(-50%, -60%) scale(0.8); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes desaparecerAviso {
      to { opacity: 0; transform: translate(-50%, -40%) scale(0.9); }
    }
  `;
  document.head.appendChild(estilo);
});
