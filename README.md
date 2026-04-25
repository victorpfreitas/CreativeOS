# Creative OS — Carrossel Automator

Creative OS (também conhecido como **Made by Human**) é uma plataforma premium de automação de conteúdo projetada para criar, gerenciar e agendar carrosséis de alta conversão para redes sociais. 

O sistema integra inteligência estratégica, gestão de marca (Brand DNA) e uma ferramenta de edição visual poderosa para transformar ideias e bases de conhecimento em ativos visuais prontos para publicação.

---

## 🚀 Principais Funcionalidades

### 📂 Gestão de Projetos e Brand DNA
- **Base de Conhecimento**: Centralize informações, referências e diretrizes de cada projeto.
- **Brand DNA**: Defina pilares de conteúdo, público-alvo, tom de voz, mensagens-chave e identidade visual (cores, referências).
- **Magic DNA**: Modal inteligente para configuração rápida da essência da marca.

### 🤖 Automações com Inteligência Artificial (Gemini AI)
- **Geração de Hooks**: Criação de ganchos magnéticos baseados no nicho e tom de voz.
- **Produção de Carrosséis**: Geração completa de conteúdo (slides de corpo + CTA) e legendas otimizadas.
- **Análise Estratégica**: Processamento de dados brutos para extrair insights e recomendações reais.
- **DNA Automático**: Extração inteligente da essência da marca a partir de descrições informais.
- **Planejamento Semanal**: Sugestões de tópicos e ganchos integradas às automações existentes.

### 🎨 Editor de Slides (Slideshow Editor)
- **Criação Dinâmica**: Editor side-by-side para visualização em tempo real.
- **Temas Premium**: Suporte a múltiplos estilos visuais:
  - `Dark Mode` (Sleek & Professional)
  - `Light Mode` (Clean & Minimal)
  - `Vibrant` (Energetic)
  - `Bold Gradient` (Modern & Impactful)
- **Marca d'água e Logo**: Personalização automática de branding em todos os slides.

### 📊 Análise e Planejamento
- **Análise de Conteúdo**: Extração de insights, padrões e recomendações a partir de dados brutos.
- **Planejamento Semanal**: Organize o calendário de postagens com tópicos sugeridos e status de geração.

### 🖼️ Coleções de Imagens
- **Bibliotecas Curadas**: Organize bancos de imagens para ganchos (hooks) e corpo do conteúdo (body).
- **Integração**: Suporte para Pexels, Unsplash e uploads manuais.

---

## 🛠️ Stack Tecnológica

- **Frontend**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/)
- **Estilização**: [Tailwind CSS](https://tailwindcss.com/)
- **Backend/Database**: [Firebase](https://firebase.google.com/) (Firestore)
- **Ícones**: [Lucide React](https://lucide.dev/)
- **Processamento de Imagem**: `html-to-image` e `jszip` para exportação.

---

## 📁 Estrutura do Projeto

```text
src/
├── components/      # Componentes reutilizáveis (Layout, UI, Forms)
├── lib/             # Configurações (Firebase, Tipos globais)
├── pages/           # Páginas principais da aplicação
├── services/        # Integrações com APIs externas (AI, Imagens)
└── assets/          # Estilos globais e recursos estáticos
```

---

## ⚙️ Instalação e Desenvolvimento

1. **Clonar o repositório**:
   ```bash
   git clone [url-do-repositorio]
   ```

2. **Instalar dependências**:
   ```bash
   npm install
   ```

3. **Configurar Variáveis de Ambiente**:
   Crie um arquivo `.env` na raiz com as credenciais do Firebase:
   ```env
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

4. **Rodar em ambiente de desenvolvimento**:
   ```bash
   npm run dev
   ```

---

## 📈 Status do Projeto

O projeto está em fase avançada de desenvolvimento, com o núcleo de automação, editor visual e gestão de Brand DNA totalmente operacionais. As próximas etapas incluem o refinamento das análises baseadas em IA e expansão das integrações de exportação.

---
**Developed with ✨ by Antigravity AI**
