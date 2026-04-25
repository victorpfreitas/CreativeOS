# GTM Readiness Plan

Este plano organiza as melhorias necessárias para transformar o Creative OS em um produto mais sólido antes de aquisição ativa de usuários.

## Objetivo

Garantir que o fluxo principal seja confiável, mensurável e simples de demonstrar:

1. Criar projeto.
2. Configurar Brand DNA.
3. Gerar hook.
4. Gerar carrossel.
5. Editar slides.
6. Exportar ou agendar.

## Fase 1: Fundação Técnica

- Firebase/Firestore é o backend oficial.
- Remover documentação e arquivos de apoio ligados ao teste com Supabase.
- Manter chamadas de IA por API server-side no Vercel.
- Usar variáveis server-side para provedores de IA (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`).
- Restaurar typecheck no build de produção.
- Adicionar workflow de qualidade para PRs.

## Fase 2: Golden Path

- Revisar a jornada projeto -> Brand DNA -> hook -> carrossel -> editor -> export.
- Reduzir campos obrigatórios no primeiro uso.
- Adicionar estados vazios úteis em cada etapa.
- Melhorar mensagens de erro para IA, quota, timeout e JSON inválido.
- Criar uma checklist manual de smoke test antes de merge.

## Fase 3: Produto Vendável

- Onboarding guiado para primeiro carrossel.
- Templates por perfil: expert, agência, social media e SaaS B2B.
- Exemplos prontos de Brand DNA e carrosséis.
- Métricas de ativação: primeiro projeto, primeiro hook, primeiro carrossel, primeiro export.
- Página simples de status/configurações do workspace.

## Fase 4: GTM

- Definir posicionamento: carrosséis estratégicos e on-brand em minutos.
- Rodar beta controlado com usuários próximos.
- Coletar feedback semanal sobre clareza, qualidade do output e tempo economizado.
- Medir tempo até primeiro carrossel exportado, uso semanal e retenção D7.

## Checklist de Release

Antes de merge na `main`:

- `npm run typecheck` passa.
- `npm run build` passa.
- Preview deploy abre sem erro.
- Golden path foi validado manualmente.
- Nenhuma chave sensível foi adicionada ao frontend ou ao repositório.
- Mensagens de erro novas são compreensíveis para usuário final.
