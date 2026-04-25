# Creative OS — Carrossel Automator

Creative OS (também conhecido como **Made by Human**) é uma plataforma premium de automação de conteúdo para criar, gerenciar, editar e preparar carrosséis de alta conversão para redes sociais.

O sistema combina inteligência estratégica, gestão de marca (Brand DNA), geração de conteúdo com IA e um editor visual para transformar ideias e bases de conhecimento em ativos visuais prontos para publicação.

---

## Principais Funcionalidades

### Gestão de Projetos e Brand DNA
- **Base de Conhecimento**: Centralize informações, referências e diretrizes de cada projeto.
- **Brand DNA**: Defina pilares de conteúdo, público-alvo, tom de voz, mensagens-chave e identidade visual.
- **Magic DNA**: Configuração assistida da essência da marca a partir de descrições informais.

### Automações com Inteligência Artificial
- **Geração de Hooks**: Criação de ganchos magnéticos baseados no nicho, tom de voz e contexto da marca.
- **Produção de Carrosséis**: Geração completa de slides e legendas otimizadas.
- **Análise Estratégica**: Processamento de dados brutos para extrair insights, padrões e recomendações.
- **DNA Automático**: Extração estruturada da essência da marca.
- **Planejamento Semanal**: Sugestões de tópicos e hooks integradas às automações.

### Editor de Slides
- **Criação Dinâmica**: Editor side-by-side com visualização em tempo real.
- **Temas Premium**: Suporte a estilos como Dark Mode, Light Mode, Vibrant e Bold Gradient.
- **Branding**: Aplicação de logo, marca d'água, cores e referências visuais.
- **Exportação**: Geração de assets visuais com `html-to-image` e `jszip`.

### Análise, Planejamento e Biblioteca Visual
- **Análise de Conteúdo**: Identifique o que funcionou, o que falhou e o que repetir.
- **Planejamento Semanal**: Organize tópicos sugeridos e status de geração.
- **Coleções de Imagens**: Bibliotecas para hooks, body slides, Pexels, Unsplash e uploads manuais.

---

## Stack Tecnológica

- **Frontend**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/)
- **Estilização**: [Tailwind CSS](https://tailwindcss.com/)
- **Backend/Database**: [Firebase](https://firebase.google.com/) + Firestore
- **Autenticação**: Firebase Auth
- **Deploy**: Vercel com deploy automático a partir do GitHub
- **Ícones**: [Lucide React](https://lucide.dev/)
- **Processamento de Imagem**: `html-to-image` e `jszip`

---

## Arquitetura

```text
api/
└── ai.ts             # Proxy server-side para provedores de IA via Vercel

src/
├── components/       # Componentes reutilizáveis (layout, UI, project views)
├── lib/              # Firebase, AuthContext, tipos globais e temas
├── pages/            # Páginas principais da aplicação
├── services/         # Serviços de IA, imagens e upload
└── assets/           # Estilos globais e recursos estáticos
```

A aplicação usa Firebase/Firestore como fonte principal de dados. As chamadas de IA devem passar por `/api/ai`, preservando chaves sensíveis em variáveis de ambiente no Vercel.

---

## Variáveis de Ambiente

Crie um arquivo `.env` local ou configure as variáveis no Vercel:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

GEMINI_API_KEY=...
OPENROUTER_API_KEY=...
```

As chaves de IA devem ser tratadas como server-side. Evite depender de variáveis `VITE_` para provedores de IA em produção.

---

## Desenvolvimento

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

---

## Deploy e Qualidade

O projeto está conectado ao Vercel. Branches e PRs geram deploys de preview, e merges na `main` publicam produção.

Antes de promover mudanças para produção, o fluxo recomendado é:

1. Abrir PR com escopo pequeno.
2. Conferir preview deploy no Vercel.
3. Rodar `npm run typecheck` e `npm run build`.
4. Validar o golden path: criar projeto, configurar Brand DNA, gerar hook, gerar carrossel, editar slide e exportar.
5. Fazer merge apenas quando o fluxo principal estiver estável.

---

## Roadmap de Produto

### Fundação para GTM
- Consolidar Firebase/Firestore como backend oficial.
- Manter chaves sensíveis no Vercel e chamadas de IA via API server-side.
- Criar checks obrigatórios de build e typecheck antes de produção.
- Polir o golden path de geração e exportação de carrossel.

### Produto Vendável
- Onboarding guiado para primeiro projeto e primeiro Brand DNA.
- Templates por caso de uso: expert, agência, social media e SaaS B2B.
- Estados de erro claros para IA, quota, timeout, resposta inválida e exportação.
- Métricas de ativação: primeiro carrossel gerado, primeiro export, frequência semanal.

### GTM
- Posicionamento: carrosséis estratégicos e on-brand em minutos.
- Beta controlado com usuários próximos e feedback semanal.
- Medição de tempo até primeiro carrossel exportado e retenção D7.

---

## Status do Projeto

O projeto está em fase avançada de desenvolvimento, com núcleo de automação, editor visual e gestão de Brand DNA operacionais. A prioridade atual é aumentar confiabilidade, clareza do fluxo principal e prontidão para aquisição de usuários.
