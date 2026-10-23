# 🚀 Guia de Deploy na Vercel — Retífica Vision AI

Este projeto já está **100% preparado** para ser publicado na [Vercel](https://vercel.com/) com suporte total a:
- ✅ **HTTPS automático:** Obrigatório para liberar a câmera do celular e geolocalização (GPS)
- ✅ **PWA (Progressive Web App):** Permite instalar o app direto na tela inicial do celular Android / iPhone
- ✅ **Single Page Application (SPA):** Roteamento e arquivos estáticos otimizados com `vercel.json`
- ✅ **Deploy Contínuo:** Toda vez que você der push no GitHub, a Vercel atualiza o site automaticamente em segundos

---

## 🎯 Método 1: Pelo Painel Web da Vercel (Recomendado - 2 minutos)

Como o seu projeto já está salvo no seu GitHub (`joel457-debug/retifica-pecas-app`), você só precisa vinculá-lo:

1. Acesse **[vercel.com/new](https://vercel.com/new)** e faça login com sua conta do GitHub.
2. Na lista de repositórios, localize **`retifica-pecas-app`** e clique no botão azul **"Import"**.
3. O Vercel detectará automaticamente o framework:
   - **Framework Preset:** `Vite`
   - **Build Command:** `vite build`
   - **Output Directory:** `dist`
4. *(Opcional)* Se desejar adicionar a chave da API do Google Gemini para todos os aparelhos:
   - Expanda a seção **"Environment Variables"**
   - Adicione o nome: `VITE_GEMINI_API_KEY`
   - Cole a sua chave no valor
5. Clique no botão azul **"Deploy"**.
6. Pronto! Em menos de 1 minuto seu aplicativo estará no ar em um endereço do tipo:
   👉 `https://retifica-pecas-app.vercel.app`

---

## 💻 Método 2: Pelo Terminal via Vercel CLI

Se preferir fazer o deploy direto pelo terminal:

```bash
cd retifica-pecas-app
npx vercel
```

- Siga as instruções na tela fazendo login no navegador.
- Confirme o diretório (`./`), framework (`Vite`) e responda `Y` para publicar.
- Para deploy final de produção:
```bash
npx vercel --prod
```

---

## 📱 Dica de Uso na Oficina (Instalação no Celular)
Após o deploy, ao abrir o link `https://seu-app.vercel.app` pelo Chrome no Android ou Safari no iPhone:
1. Clique no menu do navegador (3 pontinhos ou botão de compartilhar).
2. Selecione **"Adicionar à tela de início"** ou **"Instalar Aplicativo"**.
3. O ícone do **Retífica Vision** aparecerá como um app nativo no celular, com acesso instantâneo à câmera e funcionamento offline!
