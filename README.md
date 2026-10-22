# 🔧 Retífica Vision AI — Registro, Identificação & Envio de Peças de Motores

> Aplicativo inteligente e offline para retíficas de motores: registre componentes por fotos, identifique cabeçotes, blocos e bielas com IA, marque procedimentos técnicos, anexe localização GPS e compartilhe resumos pelo WhatsApp ou E-mail.

![Status](https://img.shields.io/badge/Status-Funcional%20%2F%20MVP-success)
![Vite](https://img.shields.io/badge/Build-Vite-646CFF?logo=vite&logoColor=white)
![Storage](https://img.shields.io/badge/Offline-IndexedDB-orange)
![AI](https://img.shields.io/badge/AI-Gemini%20Vision%20%2B%20Offline%20Classifier-blue)

---

## 🚀 Funcionalidades Principais

1. **4 Pastas de Trabalho Simultâneas (Offline)**:
   - Gerencie até 4 motores simultaneamente na oficina sem perder fotos ou dados ao alternar entre eles.
   - Status visual por pasta: *Livre*, *Em Preenchimento*, *Aguardando Análise*, *Pronta p/ Envio*, *Aguardando Conexão*, *Enviada*.
   - Armazenamento 100% local e seguro via **IndexedDB** (`localforage`).

2. **Câmera ao Vivo com Viewfinder da Oficina**:
   - Visor em tempo real no app com guias de enquadramento para placa e peças.
   - Botão disparador circular com som de obturador, troca de lentes frontal/traseira e botão de lanterna.
   - Suporte a múltiplas fotos por motor com galeria, zoom e exclusão.

3. **Identificação Inteligente de Peças por IA**:
   - Classificação com cálculo de confiança:
     - 🔩 **Cabeçote com tampa de válvula montado**
     - ⚙️ **Cabeçote desmontado**
     - 📦 **Somente cabeçote**
     - 🏷️ **Tampa de válvula separada**
     - 🧱 **Somente bloco**
     - 🔗 **Somente biela / Conjunto de bielas**
     - 🔘 **Pistões**
     - 🌀 **Virabrequim**
     - 🕹️ **Comando de válvulas**
     - ❓ **Itens não identificados / precisando de confirmação manual**
   - **Chips de adição rápida**: Adicione peças extras da oficina com 1 toque (*Carter, Bomba de óleo, Bomba d'água, Válvulas, Tuchos, etc.*).
   - **Modo Híbrido**: Google Gemini Vision (online) + Classificador Inteligente Heurístico Embarcado (offline).

4. **Procedimentos & Serviços Solicitados**:
   - Seleção com 1 clique de procedimentos comuns de retífica (*Banho químico, Plainar cabeçote, Retífica de virabrequim, Brunimento, Teste de trinca, etc.*).
   - Campo para instruções técnicas detalhadas do mecânico.

5. **Localização GPS & Nome da Oficina**:
   - Botão para capturar coordenadas GPS da retífica ou do ponto de coleta com link direto do Google Maps.
   - Nome da oficina em destaque em todas as saídas (resumos, WhatsApp, e-mail e comprovantes).

6. **Compartilhamento & Exportação**:
   - 📲 **WhatsApp**: Mensagem organizada com emojis e dados técnicos, com suporte a Web Share API para anexar fotos no mobile.
   - ✉️ **E-mail**: Disparo automático com assunto e corpo pré-formatados.
   - 🖨️ **Impressão / PDF**: Ordem de serviço limpa e diagramada para etiquetar caixas e bancadas.
   - 🗄️ **Histórico Arquivado**: Registro permanente com busca por placa ou número do motor.

---

## 🛠️ Tecnologias Utilizadas

- **Core**: HTML5 Semântico, JavaScript Moderno (ESModules).
- **Estilização**: Vanilla CSS com design system industrial escuro de alta legibilidade, botões grandes para oficina e micro-animações.
- **Armazenamento**: `localforage` (IndexedDB no navegador).
- **Build Tool**: Vite.
- **Áudio**: Web Audio API sintetizada (zero arquivos externos de som).
- **Visão Computacional**: Google Gemini API + Motor Heurístico Canvas On-Device.

---

## 💻 Como Rodar o Projeto

### Pré-requisitos
- Node.js (v18 ou superior)
- Git

### Instalação
```bash
# Clone o repositório
git clone https://github.com/joel457-debug/retifica-pecas-app.git

# Acesse o diretório
cd retifica-pecas-app

# Instale as dependências
npm install

# Inicie o servidor local
npm run dev
```

Abra [http://localhost:5173/](http://localhost:5173/) no seu navegador.

---

## 📱 Acesso pelo Celular na Rede Wi-Fi

Para usar a câmera do seu smartphone diretamente na oficina:
1. Conecte o computador e o celular na mesma rede Wi-Fi.
2. Inicie com `npm run dev -- --host`.
3. Abra no navegador do celular o endereço de rede exibido no terminal (ex.: `http://192.168.100.47:5173/`).

---

## 📄 Especificação do Produto (PRD)

Para consultar o documento de requisitos original detalhado, veja [PRD.md](PRD.md).

---

Feito com ⚡ para oficinas e retíficas de motores.
