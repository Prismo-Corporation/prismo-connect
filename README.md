# Prismo Connect

Aplicativo de comunicação em comunidades, com servidores, canais de texto, cargos e mensagens privadas. Projeto da PrismoLab, de código aberto sob a licença AGPL-3.0.

## Status

Em fase de especificação e preparação. A primeira versão (MVP) está em desenvolvimento e será testada por um grupo pequeno antes de qualquer expansão.

## Escopo do MVP

1. Contas e perfil
2. Servidores
3. Canais de texto
4. Cargos e permissões
5. Mensagens
6. Mensagens diretas e grupos

Voz e vídeo, notificações avançadas, moderação, bots e aplicativos nativos ficam para as próximas etapas.

## Como rodar em desenvolvimento

Requisitos: Node.js 22 (ver `.nvmrc`), Docker e Docker Compose.

```bash
# 1. Configurar variáveis de ambiente
cp .env.example .env

# 2. Subir o PostgreSQL
docker compose up -d postgres

# 3. Instalar dependências do servidor
cd server
npm install

# 4. Rodar os testes e iniciar o servidor
npm test
npm run dev
```

Com o servidor rodando, `http://localhost:3000/health` deve responder com `{"status":"ok","service":"prismo-connect"}`.

## Documentação

- [Especificação do MVP](docs/especificacao-mvp.md): funções detalhadas, modelo de dados, telas, requisitos e ordem de desenvolvimento.

## Stack prevista

- Back-end: Node.js com TypeScript
- Tempo real: WebSockets
- Banco de dados: PostgreSQL
- Front-end: React com TypeScript e Vite

## Licença

Este projeto é distribuído sob a [GNU Affero General Public License v3.0](LICENSE).

## Princípios

As funções são inspiradas em ideias gerais de aplicativos de chat, mas o código, o layout, os ícones e os textos são escritos do zero. Não reutilizamos código ou marcas de outros produtos.
