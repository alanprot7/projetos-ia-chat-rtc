(function () {
  /* ============================================================
     CONFIGURAÇÕES
     ============================================================ */

  // Servidores STUN públicos gratuitos para descoberta de IP/Cone NAT
  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Tempo máximo que aguardamos a coleta de candidatos ICE terminar
  const ICE_TIMEOUT_MS = 8000;

  // Nome do DataChannel — mesmo label para ambos os lados
  const CHANNEL_LABEL = 'chat';

  /* ============================================================
     REFERÊNCIAS DO DOM
     ============================================================ */

  const $ = (sel) => document.querySelector(sel);

  // Telas
  const setupScreen   = $('#setup-screen');
  const chatScreen    = $('#chat-screen');

  // Seleção de papel
  const roleSelection = $('#role-selection');
  const btnCreate     = $('#btn-create');
  const btnJoin       = $('#btn-join');

  // Fluxo Criar (A)
  const createFlow      = $('#create-flow');
  const btnGenOffer     = $('#btn-generate-offer');
  const statusOffer     = $('#status-offer');
  const offerOutputArea = $('#offer-output-area');
  const offerOutput     = $('#offer-output');
  const btnCopyOffer    = $('#btn-copy-offer');
  const answerInput     = $('#answer-input');
  const btnConnect      = $('#btn-connect');
  const statusConnect   = $('#status-connect');
  const btnBackCreate   = $('#btn-back-create');

  // Fluxo Entrar (B)
  const joinFlow        = $('#join-flow');
  const offerInput      = $('#offer-input');
  const btnProcessOffer = $('#btn-process-offer');
  const statusAnswer    = $('#status-answer');
  const answerOutputArea= $('#answer-output-area');
  const answerOutput    = $('#answer-output');
  const btnCopyAnswer   = $('#btn-copy-answer');
  const btnBackJoin     = $('#btn-back-join');

  // Chat
  const messageList       = $('#message-list');
  const chatInput         = $('#chat-input');
  const btnSend           = $('#btn-send');
  const btnNewConnection  = $('#btn-new-connection');
  const connectionBar     = $('#connection-status-bar');
  const partnerName       = $('.partner-name');

  /* ============================================================
     ESTADO GLOBAL
     ============================================================ */

  // Conexão WebRTC e canal de dados
  let pc = null;       // RTCPeerConnection
  let channel = null;  // RTCDataChannel (usado por ambos os lados)
  let isOfferer = false; // true = Usuário A, false = Usuário B

  /* ============================================================
     UTILITÁRIOS
     ============================================================ */

  /**
   * Codifica um objeto RTCSessionDescription em Base64.
   * Usamos JSON.stringify para preservar a estrutura completa (type + sdp).
   * O SDP neste ponto já contém todos os candidatos ICE (aguardamos gathering).
   */
  function encodeSDP(description) {
    return btoa(JSON.stringify(description));
  }

  /**
   * Decodifica uma string Base64 de volta para RTCSessionDescription.
   * Retorna null + exibe erro se a string for inválida.
   */
  function decodeSDP(base64, errorTarget) {
    try {
      const obj = JSON.parse(atob(base64.trim()));
      if (!obj.type || !obj.sdp) {
        throw new Error('Objeto SDP inválido — esperado { type, sdp }');
      }
      return obj;
    } catch (e) {
      showStatus(errorTarget, 'String Base64 inválida. Verifique se copiou corretamente.', 'error');
      return null;
    }
  }

  /** Exibe um indicador de status colorido em um container */
  function showStatus(container, message, type) {
    container.className = `status status-${type}`;
    container.innerHTML = `<span class="dot"></span> ${message}`;
    container.classList.remove('hidden');
  }

  /** Esconde o indicador de status */
  function hideStatus(container) {
    container.classList.add('hidden');
    container.innerHTML = '';
  }

  /** Alterna a visibilidade das telas principais */
  function showScreen(screen) {
    if (screen === 'setup') {
      setupScreen.classList.remove('hidden');
      chatScreen.style.display = 'none';
    } else {
      setupScreen.classList.add('hidden');
      chatScreen.style.display = 'block';
    }
  }

  /** Reseta todo o estado para reiniciar o fluxo */
  function resetAll() {
    // Fecha conexão anterior se existir
    if (channel) {
      channel.close();
      channel = null;
    }
    if (pc) {
      pc.close();
      pc = null;
    }
    isOfferer = false;

    // Reseta UI da tela de setup
    roleSelection.classList.remove('hidden');
    createFlow.classList.add('hidden');
    joinFlow.classList.add('hidden');
    offerOutputArea.classList.add('hidden');
    [statusOffer, statusConnect, statusAnswer].forEach(hideStatus);
    offerOutput.value = '';
    answerInput.value = '';
    offerInput.value = '';
    answerOutputArea.classList.add('hidden');
    answerOutput.value = '';
    btnConnect.disabled = true;
    btnGenOffer.classList.remove('hidden');
    btnGenOffer.disabled = false;
    offerOutputArea.classList.add('hidden');
    btnProcessOffer.classList.remove('hidden');
    btnProcessOffer.disabled = false;
    connectionBar.innerHTML = '';

    // Reseta chat
    messageList.innerHTML = '<p class="empty-chat">Conexão estabelecida. Envie a primeira mensagem!</p>';
    chatInput.value = '';

    showScreen('setup');
  }

  /** Copia texto para a área de transferência com fallback */
  async function copyToClipboard(text, buttonEl) {
    try {
      await navigator.clipboard.writeText(text);
      const original = buttonEl.textContent;
      buttonEl.textContent = 'Copiado!';
      buttonEl.style.color = '#22c55e';
      setTimeout(() => {
        buttonEl.textContent = original;
        buttonEl.style.color = '';
      }, 2000);
    } catch {
      // Fallback: seleciona o texto manualmente
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      buttonEl.textContent = 'Copiado!';
      setTimeout(() => { buttonEl.textContent = 'Copiar'; }, 2000);
    }
  }

  /**
   * Aguarda o ICE gathering atingir o estado "complete".
   * Crucial: SÓ depois disso o pc.localDescription contém todos os candidatos.
   * Timeout de segurança para evitar travamento eterno.
   */
  function waitForIceComplete(connection, timeoutMs = ICE_TIMEOUT_MS) {
    return new Promise((resolve) => {
      // Se já estiver completo, resolve imediatamente
      if (connection.iceGatheringState === 'complete') {
        resolve('complete');
        return;
      }

      let resolved = false;

      // Timeout de segurança
      const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        connection.removeEventListener('icegatheringstatechange', handler);
        resolve('timeout');
      }, timeoutMs);

      // Handler do evento ICE gathering
      const handler = () => {
        if (resolved) return;
        if (connection.iceGatheringState === 'complete') {
          resolved = true;
          clearTimeout(timer);
          connection.removeEventListener('icegatheringstatechange', handler);
          resolve('complete');
        }
      };

      connection.addEventListener('icegatheringstatechange', handler);
    });
  }

  /* ============================================================
     CONFIGURAÇÃO DO DATACHANNEL
     ============================================================ */

  /**
   * Configura os handlers de um RTCDataChannel.
   * Chamado tanto pelo ofertante (channel próprio) quanto pelo convidado
   * (channel recebido via ondatachannel).
   */
  function setupDataChannel(dc) {
    dc.onopen = () => {
      console.log('[DataChannel] Aberto e pronto para uso');
      showScreen('chat');
      showStatus(connectionBar, 'Conectado ao parceiro', 'success');
    };

    dc.onmessage = (event) => {
      // Suporte tanto a string quanto a Blob/ArrayBuffer
      let text;
      if (typeof event.data === 'string') {
        text = event.data;
      } else if (event.data instanceof ArrayBuffer) {
        text = new TextDecoder().decode(event.data);
      } else if (event.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => { addMessage(reader.result, 'partner'); };
        reader.readAsText(event.data);
        return;
      } else {
        text = String(event.data);
      }
      addMessage(text, 'partner');
    };

    dc.onclose = () => {
      addMessage('--- Parceiro desconectou ---', 'system');
      showStatus(connectionBar, 'Desconectado', 'error');
    };

    dc.onerror = (e) => {
      console.error('[DataChannel] Erro:', e);
      showStatus(connectionBar, 'Erro no canal de dados', 'error');
    };
  }

  /* ============================================================
     CHAT — RENDERIZAÇÃO DE MENSAGENS
     ============================================================ */

  /**
   * Adiciona uma mensagem na lista de chat.
   * @param {string} text  - Conteúdo da mensagem
   * @param {'you'|'partner'|'system'} sender - Quem enviou
   */
  function addMessage(text, sender) {
    const isEmpty = messageList.querySelector('.empty-chat');
    if (isEmpty) isEmpty.remove();

    const div = document.createElement('div');

    if (sender === 'system') {
      div.className = 'msg';
      div.style.alignSelf = 'center';
      div.style.background = 'transparent';
      div.style.color = 'var(--text-muted)';
      div.style.fontSize = '0.8rem';
      div.style.fontStyle = 'italic';
      div.textContent = text;
    } else if (sender === 'you') {
      div.className = 'msg msg-you';
      div.innerHTML = `<div class="sender">Você</div>${escapeHtml(text)}`;
    } else {
      div.className = 'msg msg-partner';
      div.innerHTML = `<div class="sender">Parceiro</div>${escapeHtml(text)}`;
    }

    messageList.appendChild(div);
    messageList.scrollTop = messageList.scrollHeight;
  }

  /** Escape simples para evitar XSS nas mensagens renderizadas */
  function escapeHtml(str) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(str).replace(/[&<>"']/g, (c) => map[c]);
  }

  /**
   * Envia uma mensagem de texto via DataChannel.
   * Só envia se o canal estiver no estado "open".
   */
  function sendMessage(text) {
    if (!channel || channel.readyState !== 'open') {
      showStatus(connectionBar, 'Canal de dados não está pronto', 'warning');
      return;
    }
    channel.send(text);
    addMessage(text, 'you');
  }

  /* ============================================================
     FLUXO CRIAR OFERTA (USUÁRIO A)
     ============================================================ */

  async function handleGenerateOffer() {
    btnGenOffer.disabled = true;
    showStatus(statusOffer, 'Criando PeerConnection e aguardando coleta de candidatos ICE...', 'info');

    try {
      // 1. Criar RTCPeerConnection
      pc = new RTCPeerConnection(RTC_CONFIG);
      isOfferer = true;

      // 2. Criar DataChannel — como somos o ofertante, usamos createDataChannel
      channel = pc.createDataChannel(CHANNEL_LABEL);
      setupDataChannel(channel);

      // 3. Criar oferta SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 4. Aguardar ICE gathering completar (crucial para o Copy-Paste!)
      console.log('[Oferta] Aguardando ICE gathering...');
      const result = await waitForIceComplete(pc);

      if (result === 'timeout') {
        showStatus(statusOffer, 'Coleta ICE incompleta (timeout). A oferta foi gerada mas a conexão pode ser menos eficiente.', 'warning');
      } else {
        showStatus(statusOffer, 'Oferta pronta! Copie o texto abaixo e envie para o Usuário B.', 'success');
      }

      // 5. Codificar SDP completo (já com ICE) em Base64
      const base64Offer = encodeSDP(pc.localDescription);
      offerOutput.value = base64Offer;
      offerOutputArea.classList.remove('hidden');

      // 6. Habilitar o botão de conectar (depende de haver texto no answer-input)
      btnConnect.disabled = !answerInput.value.trim();

      // 7. Monitorar estado da conexão (debug e fallback para abrir chat)
      pc.onconnectionstatechange = () => {
        console.log('[Ofertante] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected' || pc.connectionState === 'connecting') {
          // Se o chat ainda não foi aberto pelo onopen, abrimos aqui
          if (chatScreen.style.display === 'none' && channel && channel.readyState === 'open') {
            showScreen('chat');
          }
        }
      };

    } catch (err) {
      console.error('[Ofertante] Erro:', err);
      showStatus(statusOffer, 'Erro ao gerar oferta: ' + err.message, 'error');
      btnGenOffer.disabled = false;
    }
  }

  async function handleConnect() {
    const base64 = answerInput.value.trim();
    if (!base64) return;

    const answerDesc = decodeSDP(base64, statusConnect);
    if (!answerDesc) return;

    btnConnect.disabled = true;
    showStatus(statusConnect, 'Aplicando resposta, estabelecendo conexão...', 'info');

    try {
      // Aplicar a resposta do convidado como remote description
      await pc.setRemoteDescription(new RTCSessionDescription(answerDesc));
      showStatus(statusConnect, 'Resposta aplicada! Aguardando estabelecimento da conexão...', 'success');

      // O onopen do DataChannel e/ou onconnectionstatechange abrirá o chat
    } catch (err) {
      console.error('[Ofertante] Erro ao aplicar resposta:', err);
      showStatus(statusConnect, 'Erro ao aplicar resposta: ' + err.message, 'error');
      btnConnect.disabled = false;
    }
  }

  /* ============================================================
     FLUXO ENTRAR NA SALA (USUÁRIO B)
     ============================================================ */

  async function handleProcessOffer() {
    const base64 = offerInput.value.trim();
    if (!base64) {
      showStatus(statusAnswer, 'Cole a oferta Base64 recebida de A primeiro.', 'warning');
      return;
    }

    const offerDesc = decodeSDP(base64, statusAnswer);
    if (!offerDesc) return;

    btnProcessOffer.disabled = true;
    showStatus(statusAnswer, 'Processando oferta e gerando resposta...', 'info');

    try {
      // 1. Criar RTCPeerConnection
      pc = new RTCPeerConnection(RTC_CONFIG);
      isOfferer = false;

      // 2. Aguardar DataChannel do ofertante (será recebido via ondatachannel)
      pc.ondatachannel = (event) => {
        console.log('[Convidado] DataChannel recebido:', event.channel.label);
        channel = event.channel;
        setupDataChannel(channel);
      };

      // 3. Aplicar oferta como remote description
      await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));

      // 4. Criar resposta SDP
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // 5. Aguardar ICE gathering completar
      console.log('[Resposta] Aguardando ICE gathering...');
      const result = await waitForIceComplete(pc);

      if (result === 'timeout') {
        showStatus(statusAnswer, 'Coleta ICE incompleta (timeout). A resposta foi gerada mas a conexão pode ser menos eficiente.', 'warning');
      } else {
        showStatus(statusAnswer, 'Resposta pronta! Copie o texto abaixo e envie de volta para o Usuário A.', 'success');
      }

      // 6. Codificar SDP completo em Base64
      const base64Answer = encodeSDP(pc.localDescription);
      answerOutput.value = base64Answer;
      answerOutputArea.classList.remove('hidden');

      // 7. Monitorar estado da conexão
      pc.onconnectionstatechange = () => {
        console.log('[Convidado] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected' || pc.connectionState === 'connecting') {
          // Se o chat não foi aberto ainda pelo onopen do DataChannel
          if (chatScreen.style.display === 'none' && channel && channel.readyState === 'open') {
            showScreen('chat');
          }
        }
      };

    } catch (err) {
      console.error('[Convidado] Erro:', err);
      showStatus(statusAnswer, 'Erro ao processar oferta: ' + err.message, 'error');
      btnProcessOffer.disabled = false;
    }
  }

  /* ============================================================
     EVENT LISTENERS
     ============================================================ */

  // Seleção de papel: Usuário A (Criar)
  btnCreate.addEventListener('click', () => {
    roleSelection.classList.add('hidden');
    createFlow.classList.remove('hidden');
  });

  // Seleção de papel: Usuário B (Entrar)
  btnJoin.addEventListener('click', () => {
    roleSelection.classList.add('hidden');
    joinFlow.classList.remove('hidden');
  });

  // Voltar à seleção de papel (fluxo Criar)
  btnBackCreate.addEventListener('click', () => {
    createFlow.classList.add('hidden');
    roleSelection.classList.remove('hidden');
    hideStatus(statusOffer);
    hideStatus(statusConnect);
    offerOutputArea.classList.add('hidden');
    btnGenOffer.classList.remove('hidden');
    btnGenOffer.disabled = false;
    btnConnect.disabled = true;
    offerOutput.value = '';
    answerInput.value = '';
    if (pc) { pc.close(); pc = null; }
    channel = null;
  });

  // Voltar à seleção de papel (fluxo Entrar)
  btnBackJoin.addEventListener('click', () => {
    joinFlow.classList.add('hidden');
    roleSelection.classList.remove('hidden');
    hideStatus(statusAnswer);
    answerOutputArea.classList.add('hidden');
    btnProcessOffer.classList.remove('hidden');
    btnProcessOffer.disabled = false;
    offerInput.value = '';
    answerOutput.value = '';
    if (pc) { pc.close(); pc = null; }
    channel = null;
  });

  // Gerar oferta (Usuário A)
  btnGenOffer.addEventListener('click', handleGenerateOffer);

  // Copiar oferta
  btnCopyOffer.addEventListener('click', () => {
    if (offerOutput.value) copyToClipboard(offerOutput.value, btnCopyOffer);
  });

  // Copiar resposta
  btnCopyAnswer.addEventListener('click', () => {
    if (answerOutput.value) copyToClipboard(answerOutput.value, btnCopyAnswer);
  });

  // Habilitar/desabilitar botão Conectar conforme conteúdo do textarea
  answerInput.addEventListener('input', () => {
    btnConnect.disabled = !answerInput.value.trim();
  });

  // Conectar (aplicar resposta do convidado)
  btnConnect.addEventListener('click', handleConnect);

  // Processar oferta (Usuário B)
  btnProcessOffer.addEventListener('click', handleProcessOffer);

  // Enviar mensagem de chat
  function handleSendChat() {
    const text = chatInput.value.trim();
    if (!text) return;
    sendMessage(text);
    chatInput.value = '';
    chatInput.focus();
  }

  btnSend.addEventListener('click', handleSendChat);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendChat();
    }
  });

  // Nova conexão (reseta tudo)
  btnNewConnection.addEventListener('click', resetAll);

  // Verificar suporte a WebRTC ao carregar a página
  if (!window.RTCPeerConnection) {
    document.body.innerHTML = `
      <div class="card" style="text-align:center;margin-top:20vh;">
        <h1>Navegador não compatível</h1>
        <p style="margin-top:12px;color:var(--text-muted);">
          Seu navegador não oferece suporte a WebRTC (RTCPeerConnection).
          Utilize a versão mais recente do Chrome, Firefox ou Edge.
        </p>
      </div>`;
  }

  console.log('[Chat P2P] Aplicação inicializada. Pronto para conexão WebRTC via Copy-Paste.');
})();
