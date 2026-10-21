# Prismo Connect: Especificação do MVP (versão 0.2)

## 1. Visão geral

Prismo Connect é um aplicativo web de comunicação em comunidades, com servidores, canais de texto e de voz, cargos, mensagens privadas e lista de amigos. O primeiro uso é um grupo pequeno de amigos, para testar. Se funcionar, o projeto será expandido.

**Princípio de projeto:** as funções são inspiradas em ideias gerais de chat, mas nome, código, layout, ícones e textos são escritos do zero. Não usar a marca, o código ou os recursos de qualquer outro produto.

**Licença:** AGPL-3.0.

**Plataforma:** web (navegadores modernos de desktop e celular).

## 2. Escopo

### Dentro do MVP
1. Contas e perfil
2. Servidores
3. Canais de texto e de voz
4. Cargos e permissões
5. Mensagens
6. Mensagens diretas e grupos
7. Voz (canais de voz)
8. Lista de amigos

### Fora do MVP (próximas etapas, nesta ordem)
9. Compartilhamento de tela e vídeo com câmera
10. Notificações avançadas (push, desktop)
11. Moderação (silenciar, banir, log de ações)
12. Bots e API pública
13. Aplicativos desktop e mobile nativos

## 3. Stack

- **Back-end:** Node.js 22 com TypeScript, framework Fastify
- **Banco de dados:** PostgreSQL 16, com driver `pg` e migrações em SQL. Sem ORM no MVP, para manter o código simples e fácil de revisar
- **Tempo real:** WebSockets (biblioteca `ws`, acoplada ao Fastify)
- **Voz:** WebRTC no navegador, com conexões diretas entre participantes (malha) em canais de até 8 pessoas. Servidor STUN e TURN (coturn) para atravessar redes e firewalls
- **Front-end:** React com TypeScript, Vite como ferramenta de build
- **Autenticação:** senhas com hash scrypt (módulo nativo do Node, sem compilação); sessões por token aleatório, guardado como hash no banco e enviado em cookie httpOnly
- **Validação:** schemas com Zod nas entradas da API
- **Armazenamento de arquivos:** disco local no início, depois armazenamento de objetos (S3 ou compatível)
- **Hospedagem inicial:** servidor de containers (Docker), com PostgreSQL gerenciado
- **Controle de versão:** GitHub, com revisão de código antes de mesclar

## 4. Modelo de dados (simplificado)

- **Usuário:** id, nome de usuário (único), nome de exibição, e-mail (único), hash da senha, data de nascimento (não pública), e-mail confirmado, avatar, bio, status, data de criação, tentativas de login e bloqueio até
- **Sessão:** id, usuário, hash do token, criada em, expira em, dispositivo
- **Amizade:** usuário A, usuário B, status (pendente, aceita, bloqueada), quem enviou, criada em
- **Servidor:** id, nome, ícone, dono, data de criação
- **Membro:** usuário, servidor, apelido, data de entrada
- **Convite:** código, servidor, criado por, expira em, limite de usos, usos atuais
- **Categoria:** id, servidor, nome, ordem
- **Canal:** id, servidor, categoria, tipo (texto ou voz), nome, tópico, ordem
- **Cargo:** id, servidor, nome, cor, posição na hierarquia, permissões (lista de flags)
- **Cargo do membro:** membro, cargo
- **Permissão de canal:** canal, cargo ou usuário, permitido/negado por flag
- **Mensagem:** id, canal ou conversa, autor, texto, resposta a (opcional), editada em, apagada em, criada em
- **Anexo:** id, mensagem, nome do arquivo, tipo, tamanho, caminho
- **Reação:** mensagem, usuário, emoji
- **Menção:** mensagem, usuário ou cargo
- **Conversa direta:** id, tipo (direta ou grupo), nome (só grupos), ícone (só grupos), criada em
- **Participante de conversa:** conversa, usuário, entrada em
- **Mensagem fixada:** canal ou conversa, mensagem, fixada por, data
- **Presença em canal de voz:** canal, usuário, entrada em, mudo, surdo

## 5. Funções detalhadas

### 5.1 Contas e perfil

**F1.1 Cadastro**
- Campos: e-mail, nome de usuário (3 a 32 caracteres, letras, números, ponto e sublinhado), senha (mínimo 8 caracteres), data de nascimento
- Nome de usuário e e-mail devem ser únicos, verificados em tempo real
- Quem informar idade menor de 13 anos não consegue concluir o cadastro; a data de nascimento não é exibida para outros usuários
- Envio de e-mail de confirmação; conta fica limitada até confirmar
- Critério de aceite: não é possível criar conta com e-mail ou nome de usuário já existente, nem com idade abaixo de 13 anos

**F1.2 Login e sessão**
- Login com e-mail ou nome de usuário, mais senha
- Sessão válida por 30 dias, com renovação ao usar
- Token de sessão enviado em cookie httpOnly, seguro e com SameSite
- Tela de sessões ativas, com opção de encerrar cada uma
- Após 5 tentativas erradas, bloqueio temporário de 15 minutos
- Critério de aceite: encerrar uma sessão a derruba em até 1 minuto

**F1.3 Recuperação de senha**
- Link de redefinição por e-mail, válido por 1 hora e de uso único
- Ao trocar a senha, todas as sessões são encerradas

**F1.4 Perfil**
- Editar nome de exibição (até 32 caracteres), nome de usuário, avatar (PNG, JPG ou WebP, até 2 MB), bio (até 190 caracteres)
- Status: online, ausente, não perturbe, invisível
- Critério de aceite: outros usuários veem o status atualizado em até 5 segundos

**F1.5 Privacidade básica**
- Opção de quem pode enviar mensagem direta: amigos, qualquer membro de servidor em comum, ou ninguém
- Opção de mostrar ou esconder o status para usuários que não são amigos nem estão em servidor comum

**F1.6 Excluir conta**
- Usuário pode excluir a própria conta, com confirmação pela senha
- Mensagens e arquivos do usuário são apagados, conforme a política de retenção da seção 10
- Mensagens em servidores ou conversas de outros usuários são exibidas como "usuário excluído", sem o conteúdo pessoal do perfil
- Critério de aceite: após a exclusão, o nome de usuário fica disponível e a conta não pode mais ser usada para login

### 5.2 Servidores

**F2.1 Criar servidor**
- Nome (2 a 100 caracteres) e ícone opcional
- O criador vira dono e recebe todas as permissões
- Ao criar, o servidor já vem com uma categoria "Texto", um canal "geral" e uma categoria "Voz", com um canal de voz "Sala geral"

**F2.2 Editar e excluir servidor**
- Apenas o dono edita nome e ícone e pode excluir
- Exclusão pede confirmação digitando o nome do servidor

**F2.3 Convites**
- Gerar link com código de 8 caracteres
- Configurações: expiração (30 min, 1 dia, 7 dias, nunca) e limite de usos (1, 5, 10, sem limite)
- Quem tem a permissão "criar convites" pode gerar e revogar
- Critério de aceite: convite expirado ou esgotado mostra mensagem clara, sem entrar no servidor

**F2.4 Entrar e sair**
- Entrar pelo link de convite; sair pelo menu do servidor
- O dono não pode sair sem transferir a propriedade ou excluir o servidor

**F2.5 Lista de membros**
- Mostrar membros online e offline, separados
- Mostrar cargo de maior hierarquia de cada membro, com a cor do cargo

### 5.3 Canais de texto e de voz

**F3.1 Criar, editar e excluir canal**
- Tipo: texto ou voz
- Nome (1 a 100 caracteres, sem espaços; hífen no lugar de espaço), tópico opcional (até 1024 caracteres, só para canais de texto)
- Criar, renomear e excluir exige a permissão "gerenciar canais"
- Excluir um canal apaga suas mensagens, com confirmação

**F3.2 Categorias**
- Agrupar canais em categorias, com nome e ordem
- Recolher e expandir categorias na barra lateral; o estado é salvo por usuário

**F3.3 Ordenação**
- Reordenar canais e categorias por arrastar e soltar

**F3.4 Permissões por canal**
- Cada canal pode sobrescrever as permissões do servidor para um cargo ou usuário
- Flags de canal de texto: ver canal, enviar mensagem, anexar arquivos, mencionar todos, reagir, gerenciar mensagens
- Flags de canal de voz: ver canal, conectar, falar

### 5.4 Cargos e permissões

**F4.1 Criar e editar cargos**
- Nome, cor e posição na hierarquia
- O cargo "todos" existe em todo servidor e não pode ser excluído
- Qualquer usuário sempre tem o cargo "todos"

**F4.2 Permissões do servidor**
- Ver canais, gerenciar canais, gerenciar cargos, gerenciar convites, expulsar membros, criar convites, apagar mensagens de outros, mencionar todos, gerenciar servidor
- Quem tem "gerenciar cargos" só pode dar cargos abaixo do próprio na hierarquia

**F4.3 Atribuir cargos**
- Um membro pode ter vários cargos
- Permissões são a união dos cargos, depois aplicadas as sobreposições dos canais

**F4.4 Expulsar membro**
- Remove o membro do servidor, mas ele pode entrar de novo com outro convite
- Exige permissão "expulsar membros" e hierarquia superior à do alvo

### 5.5 Mensagens

**F5.1 Enviar mensagem**
- Limite de 2000 caracteres
- Formatação: negrito, itálico, tachado, código inline, bloco de código, citação
- Quebra de linha com Shift+Enter; envio com Enter
- A mensagem aparece para os outros usuários em até 1 segundo, em conexão normal

**F5.2 Menções**
- @usuário, @cargo e @todos (este último só com permissão)
- Usuário mencionado recebe indicação visual no canal (sem notificação push no MVP)

**F5.3 Responder**
- Responder a uma mensagem mostra o trecho original acima da resposta
- Clicar no trecho rola até a mensagem original

**F5.4 Editar e apagar**
- Autor edita a própria mensagem, com marcação "editada"
- Autor apaga a própria mensagem; quem tem "apagar mensagens de outros" pode apagar qualquer uma
- Mensagem apagada some para todos

**F5.5 Reações**
- Adicionar e remover reação com emoji; contagem visível
- Limite de 20 tipos de emoji diferentes por mensagem

**F5.6 Fixar mensagens**
- Até 50 mensagens fixadas por canal
- Quem tem "gerenciar mensagens" fixa e desafixa

**F5.7 Anexos**
- Até 10 arquivos por mensagem, até 15 MB cada no MVP (limite alinhado à seção 10)
- Pré-visualização de imagens; demais arquivos como link de download
- Tipos bloqueados: executáveis (.exe, .bat, .sh, .msi), por segurança

**F5.8 Histórico e busca**
- Rolagem para trás carrega 50 mensagens por vez
- Busca por texto dentro de um canal ou de todo o servidor, com filtro por autor e por data

**F5.9 Tempo real**
- Novas mensagens, edições, exclusões, reações e presença chegam por WebSocket
- Se a conexão cair, reconecta sozinho e busca o que perdeu

### 5.6 Mensagens diretas e grupos

**F6.1 Conversa direta**
- Iniciar conversa com qualquer usuário que permita (ver F1.5)
- Mesmas regras de mensagem da F5 (formatação, reações, anexos, edição, exclusão)

**F6.2 Grupo**
- De 3 a 10 participantes, com nome e ícone opcionais
- Qualquer participante adiciona ou remove outro; quem criou o grupo pode renomear
- Participante pode sair do grupo; o grupo continua para os demais
- Só é possível adicionar usuários que permitem mensagem direta de quem os adiciona (ver F1.5)

**F6.3 Lista de conversas**
- Barra lateral com conversas recentes, ordenadas pela última mensagem
- Indicador de mensagens não lidas

### 5.7 Voz

**F7.1 Entrar e sair de canal de voz**
- Clicar em um canal de voz conecta o usuário; ele só pode estar em um canal de voz por vez
- Lista de participantes aparece abaixo do nome do canal, para quem tem permissão de ver o canal
- Sair pelo botão de desconectar ou ao fechar a aba

**F7.2 Mudo e surdez**
- Botão de mudo (não envia áudio) e botão de surdez (não ouve nem envia áudio)
- Estado visível para os outros participantes

**F7.3 Indicador de quem fala**
- Destaque visual ao redor do avatar de quem está falando

**F7.4 Limite de participantes**
- Até 8 pessoas por canal de voz no MVP, por causa das conexões diretas entre participantes
- Ao atingir o limite, o usuário vê mensagem clara e não consegue entrar

**F7.5 Permissões de voz**
- Conectar e falar são permissões separadas, por cargo ou usuário (ver F3.4)
- Quem não tem "falar" entra apenas para ouvir

**F7.6 Privacidade e segurança da voz**
- Áudio trafega criptografado pelo WebRTC (DTLS e SRTP)
- Nenhum áudio é gravado no MVP
- O navegador pede permissão de microfone; sem permissão, o usuário ainda pode entrar para ouvir

**F7.7 Falhas de conexão**
- Se a conexão direta com um participante falhar, o sistema tenta pelo servidor TURN
- Mensagem clara ao usuário se não for possível conectar

### 5.8 Lista de amigos

**F8.1 Enviar pedido**
- Enviar pedido pelo nome de usuário exato
- Não é possível enviar pedido para quem bloqueou o remetente, nem para si mesmo
- Critério de aceite: o destinatário recebe o pedido na aba de amigos, sem revelar se bloqueou o remetente

**F8.2 Aceitar ou recusar**
- Pedidos pendentes aparecem em uma aba própria, com contagem
- Recusar remove o pedido sem avisar o remetente

**F8.3 Remover amigo**
- Qualquer um dos dois pode remover a amizade; a remoção não impede novos pedidos

**F8.4 Bloquear**
- Bloqueado não envia pedido, não envia mensagem direta e não vê o status do bloqueador
- O bloqueador não vê mensagens novas do bloqueado em conversas diretas; conversas em servidores comuns continuam visíveis

**F8.5 Lista de amigos**
- Lista separada entre online e offline, com o mesmo status do perfil (F1.4)
- Ação rápida para iniciar conversa direta

## 6. Telas

1. **Entrada:** login, cadastro, recuperação de senha
2. **Início:** lista de servidores à esquerda, aba de amigos e conversas diretas, com acesso a pedidos pendentes
3. **Servidor:** categorias e canais (texto e voz) à esquerda, mensagens no centro, lista de membros à direita
4. **Painel de voz:** participantes com indicador de fala, botões de mudo, surdez e desconectar, visível enquanto o usuário está em um canal de voz
5. **Configurações do servidor:** perfil, convites, cargos, canais, membros
6. **Configurações do usuário:** perfil, privacidade, sessões, senha
7. **Conversa direta ou grupo:** mensagens no centro, participantes à direita

## 7. Requisitos não funcionais

- **Desempenho:** carregar a tela de um canal em menos de 2 segundos em conexão comum; entrar em canal de voz em menos de 3 segundos
- **Segurança:** HTTPS obrigatório; senhas nunca em texto puro; tokens de sessão guardados com hash; validação de todas as entradas no servidor; proteção contra XSS na renderização de mensagens (Markdown sanitizado)
- **Privacidade:** nenhuma coleta de dados além do necessário; logs sem conteúdo de mensagens; nenhum áudio gravado
- **Acessibilidade:** navegação por teclado; contraste mínimo de 4.5:1; textos alternativos em avatares e ícones
- **Idioma:** português brasileiro na primeira versão; estrutura pronta para tradução

## 8. Ordem de desenvolvimento

**Etapa 0: preparação (concluída)**
- Repositório no GitHub com licença AGPL-3.0, README e esta especificação
- Ambiente local com Node, PostgreSQL e Docker Compose

**Etapa 1: contas (F1)**
- 1a: cadastro, login, sessões em cookie, perfil, exclusão de conta
- 1b: confirmação de e-mail e recuperação de senha (depende de provedor de e-mail)
- Testes automáticos para autenticação

**Etapa 2: servidores e canais (F2 e F3)**
- Criar servidor, convites, canais de texto e de voz, categorias
- Lista de membros

**Etapa 3: cargos e permissões (F4)**
- Cargos, hierarquia, permissões por servidor e por canal
- Testes para cada combinação de permissão

**Etapa 4: mensagens (F5)**
- Envio, edição, exclusão, menções, respostas, reações
- Tempo real por WebSocket
- Anexos e histórico

**Etapa 5: lista de amigos e conversas diretas (F8 e F6)**
- Amizades e bloqueio antes das conversas diretas, porque a privacidade das mensagens depende deles

**Etapa 6: voz (F7)**
- Conexão WebRTC entre participantes, controles de mudo e surdez, indicador de fala
- Servidor STUN e TURN configurado e testado com duas redes diferentes

**Etapa 7: testes com o grupo de amigos**
- Uso real por uma semana
- Lista de bugs e pedidos priorizados antes da próxima versão

## 9. Critérios de conclusão do MVP

- Todos os critérios de aceite das funções F1 a F8 passam
- Dois ou mais usuários conversam em tempo real sem queda por 24 horas de uso
- Quatro ou mais usuários conversam por voz em um canal sem queda por 1 hora
- Dono, moderador e membro comum têm as permissões corretas nos testes
- Nenhuma senha ou token aparece em logs
- O grupo de amigos usa o sistema por uma semana sem bloqueios graves

## 10. Definições de infraestrutura, retenção e compliance

**Nome e domínio**
- Nome oficial: Prismo Connect
- Domínio principal: connect.prismolab.com.br (domínio já pertence à empresa)
- Alternativas, se necessário no futuro: prismoconnect.com.br e prismoconnect.app
- Pendente: confirmar a configuração do subdomínio e checar conflito de marca dentro da PrismoLab

**Infraestrutura da instância beta (MVP)**
- Aplicação: 2 a 4 vCPUs, 4 a 8 GB de RAM, em containers Docker, com WebSockets
- Servidor de voz: coturn (STUN e TURN), em instância separada, com 2 vCPUs e 2 GB de RAM para começar
- Banco: PostgreSQL gerenciado, 2 vCPUs, 4 GB de RAM
- Arquitetura preparada para auto-scaling conforme o número de usuários ativos cresce
- Voz em malha tem limite de 8 pessoas por canal; acima disso será necessário um servidor de mídia (SFU), fora do MVP

**Retenção de dados**
- Mensagens de canais ativos são mantidas
- Históricos inativos são arquivados ou limpos após 12 a 24 meses (prazo a definir)
- Uploads: limite de 8 MB a 15 MB por arquivo, em object storage (S3 ou compatível)
- Usuário pode apagar as próprias mensagens e arquivos, conforme a LGPD

**Cadastro e idade mínima**
- Idade mínima: 13 anos
- Verificação pela data de nascimento durante o onboarding
- Pendente: revisão jurídica das regras de idade e de consentimento de responsáveis, incluindo a legislação brasileira aplicável a menores de idade em plataformas digitais

**Decisões ainda abertas**
- Quantidade inicial de servidores e usuários por instância
- Prazo exato de arquivamento de mensagens inativas
- Provedor de e-mail para confirmação de cadastro e recuperação de senha
