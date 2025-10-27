// passos.js
// ----------------------------------------------------
// Este código mostra um aviso visual sempre que o usuário
// clica no botão de publicar serviço, para confirmar que
// o sistema de melhorias está ativo e funcionando.
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 O arquivo passos.js foi carregado com sucesso!");

  // Procura o botão de publicação pelo ID
  const botaoPublicar = document.getElementById('botao-publicar');

  if (botaoPublicar) {
    botaoPublicar.addEventListener('click', () => {

      // Cria o aviso visual centralizado na tela
      const aviso = document.createElement('div');
      aviso.innerHTML = `
        <div id="aviso-yshipp" style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(0.8);
          background: linear-gradient(135deg, #00b894, #55efc4);
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
          ✅ Serviço publicado com sucesso!<br>
          <span style="font-size: 16px; font-weight: normal;">O sistema de melhorias está ativo.</span>
        </div>
      `;

      // Adiciona o aviso ao corpo do site
      document.body.appendChild(aviso);

      // Remove o aviso após 3 segundos
      setTimeout(() => aviso.remove(), 3000);
    });
  } else {
    // Caso o botão não seja encontrado
    console.warn("⚠️ Nenhum botão com ID 'botao-publicar' foi encontrado no HTML.");
  }

  // Adiciona as animações por CSS
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
