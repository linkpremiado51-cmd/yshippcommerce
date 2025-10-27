// passos.js
// ----------------------------------------------------
// Este código mostra um aviso visual sempre que o usuário
// clica no botão "Confirmar publicação", confirmando que
// o sistema de melhorias está ativo e funcionando.
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 O arquivo passos.js foi carregado com sucesso!");

  // Procura o botão real de confirmação da publicação
  const botaoConfirmar = document.getElementById('confirmar-publicacao');

  if (botaoConfirmar) {
    // Quando o usuário clicar em "Confirmar publicação"
    botaoConfirmar.addEventListener('click', () => {

      // Cria um aviso visual centralizado com animação
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

      // Adiciona o aviso ao corpo da página
      document.body.appendChild(aviso);

      // Remove o aviso após 3 segundos
      setTimeout(() => aviso.remove(), 3000);
    });

  } else {
    // Caso o botão não exista ou tenha outro ID
    console.warn("⚠️ Nenhum botão com ID 'confirmar-publicacao' foi encontrado no HTML.");
  }

  // Adiciona as animações CSS usadas pelo aviso
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
