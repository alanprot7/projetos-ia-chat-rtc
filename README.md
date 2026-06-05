# Teste DeepSeek + OpenCode

<table align="center" border="0" style="border: none;">
  <tr style="border: none;">
    <td align="center" valign="middle" style="border: none;">
      <img src="https://upload.wikimedia.org/wikipedia/commons/e/ec/DeepSeek_logo.svg" alt="DeepSeek Logo" width="200" />
    </td>
    <td align="center" valign="middle" style="border: none;">
      <span style="font-size: 50px;">+</span>
    </td>
    <td align="center" valign="middle" style="border: none;">
      <img src="./opencode-wordmark-dark.svg" alt="OpenCode Logo" width="200" />
    </td>
  </tr>
</table>

---

Este projeto é um ambiente de testes para a criação de aplicações simples, focado em validar a integração e o uso do **OpenCode** em conjunto com a **API do DeepSeek**.

## Objetivo

O propósito principal deste repositório é explorar as capacidades de geração de código e assistência no desenvolvimento de projetos experimentais, utilizando modelos de linguagem avançados.

## Tecnologias

<table>
  <tr>
    <td><b>OpenCode</b></td>
    <td>Ferramenta de auxílio ao desenvolvimento.</td>
  </tr>
  <tr>
    <td><b>DeepSeek API</b></td>
    <td>Inteligência artificial utilizada para geração e revisão de lógica.</td>
  </tr>
</table>

## 🔒 Segurança e Privacidade

Este aplicativo foi projetado com foco total em privacidade. Devido à sua arquitetura descentralizada (Peer-to-Peer) e *serverless*, ele oferece um nível de confidencialidade superior ao de muitos mensageiros convencionais. 

Abaixo estão os detalhes de como seus dados são protegidos:

### 🛡️ Criptografia de Ponta a Ponta (E2EE)
A segurança não é um recurso opcional neste app. A comunicação é construída sobre a tecnologia **WebRTC**, cuja especificação obriga que todas as conexões — incluindo o canal de texto (`RTCDataChannel`) — sejam **criptografadas por padrão** utilizando o protocolo **DTLS** (Datagram Transport Layer Security).

### 📡 Proteção contra Interceptação de Rede
As suas conversas estão seguras independentemente da rede que você utiliza. Mesmo em conexões vulneráveis, como redes Wi-Fi públicas de aeroportos ou conexões 4G/5G móveis, o tráfego é blindado. Qualquer tentativa de interceptação de pacotes (*sniffing*) por invasores ou provedores de internet resultará apenas na captura de dados criptografados e ininteligíveis.

### 👻 Arquitetura Efêmera
* **Sem Servidor (Backend):** As mensagens saem do seu navegador e vão **direto** para o navegador do seu contato. Elas não passam por servidores de terceiros.
* **Sem Banco de Dados:** Não armazenamos histórico, logs, IPs ou metadados da sua conversa.
* **Autodestruição Natural:** A conexão é temporária. Assim que a aba do navegador é fechada em qualquer um dos dispositivos, a ponte é destruída e a conversa deixa de existir definitivamente.

---

> **⚠️ IMPORTANTE: A Segurança do Convite (Sinalização Manual)**
>
> Embora o túnel de comunicação seja impenetrável, a criação desse túnel exige uma troca inicial de chaves (os códigos em **Base64** gerados pelo app).
> 
> * Esses códigos não contêm suas mensagens, mas possuem as "impressões digitais" necessárias para iniciar a conexão segura.
> * **Regra de Ouro:** Sempre compartilhe os códigos Base64 através de um canal direto e privado com o seu contato (ex: WhatsApp, Telegram, SMS, e-mail). Se você publicar um convite em um ambiente público, a primeira pessoa a responder o código conseguirá estabelecer a conexão com você.
