# Bingo Project — Contexto Completo do Projeto

## Objetivo Geral

Criar uma plataforma de Bingo configurável em HTML, CSS e JavaScript puro.

O projeto deve suportar:

- bingo numérico;
- bingo de texto;
- bingo de imagens;
- bingo misto.

O foco principal é um bingo de situações cotidianas/corporativas, onde os jogadores marcam eventos manualmente.

A arquitetura foi planejada para:

- baixo custo;
- hospedagem gratuita;
- aprendizado progressivo;
- futura expansão para multiplayer online.

---

# Decisões Técnicas

## Stack escolhida

```text
HTML
CSS
JavaScript puro
```

## Motivos

- simplicidade;
- aprendizado real da web;
- controle total da interface;
- hospedagem gratuita;
- escalabilidade gradual.

---

# Estrutura Atual do Projeto

```text
bingo_project/
│
├── index.html
├── theme_config.html
├── cell_config.html
│
├── css/
│   └── styles.css
│
├── js/
│   ├── app.js
│   ├── assets.js
│   ├── board.js
│   ├── cell_config.js
│   ├── rules.js
│   ├── storage.js
│   ├── theme.js
│   └── theme_config.js
│
├── data/
│   ├── sample_room.json
│   └── sample_items.json
│
└── assets/
    ├── images/
    └── sounds/
```

---

# Estado Atual da Aplicação

## Já implementado

### Sistema de configuração

- leitura de `sample_room.json`;
- leitura de `sample_items.json`;
- separação entre regras e conteúdo.
- preload de imagens permitidas pelos filtros da sala.
- preload de sons configurados em `audio_settings`.
- tema visual configurável via `theme_settings`.
- sobrescrita local de tema via configurador visual e `localStorage`.
- sobrescrita local de título, descrição, filtros de conteúdo e regras de vitória.
- sobrescrita local de casa livre central.
- sobrescrita local de itens de texto por campo com uma linha por item.
- padding de célula configurável via `board.cell_padding_px`.
- modo de conteúdo textual ou numérico configurável visualmente.
- range numérico configurável sem listar número por número.
- cartela numérica preenchida em ordem crescente por coluna, de cima para baixo.
- opções específicas aparecem e desaparecem conforme o modo escolhido.
- configurações de cartela/célula movidas para `cell_config.html`.
- visibilidade dos blocos específicos reforçada com `hidden` no HTML e no JavaScript.
- timer de sala configurável em `draw_settings`.
- quantidade local de conferências necessárias configurável em `draw_settings.ready_target`.
- timer de sala limitado ao modo numérico.
- timer configurável como fixo ou aleatório.
- bloqueio de notificações por período do dia.
- lista de prendas por sala, configurada por quebra de linha.
- sorteio de prenda quando o jogador local for o último a confirmar X vezes.
- cartela numérica aleatória por faixas de coluna.
- sorteio local de números por rodada no modo numérico.
- camada online mínima opcional via Firebase Firestore.
- sincronização online de rodada, número sorteado, confirmações e timer.

---

### Cartela dinâmica

- tamanho configurável;
- geração aleatória;
- embaralhamento Fisher-Yates;
- suporte a texto;
- suporte a número;
- suporte estrutural a imagens.
- suporte a casa livre central configurável via `board.free_center`.
- balanceamento de tipos configurável via `content_settings.balance_types`.
- filtros de conteúdo via `content_settings.allow_text`, `allow_numbers` e `allow_images`.

---

### Sistema de marcação

- clique em células;
- alternância marcado/desmarcado;
- renderização dinâmica.

---

### Regras de vitória

Implementadas:

- linha;
- coluna;
- diagonal;
- cartela cheia.

---

### Persistência local

Usando `localStorage`.

Persistimos:

- cartela atual;
- células marcadas;
- histórico local de vitórias;
- sessão local da sala: rodada, conferências e timer em andamento.

Quando `js/online_config.js` estiver habilitado, a sessão da sala também pode ser sincronizada em Firestore.
As cartelas e marcações ainda continuam locais em cada navegador nesta primeira camada online.

---

### Histórico local

O sistema salva:

- tipo de vitória;
- data;
- quantidade de células marcadas manualmente pelo jogador;
- sala.

O sistema também exibe o histórico local na interface, abaixo da cartela.
As entradas são carregadas do `localStorage` ao iniciar e atualizadas após novas vitórias.
O histórico pode ser limpo pela interface do jogo.

---

### Interface

- minimalista;
- responsiva;
- inspirada em Wordle.
- popup de vitória com resumo da vitória recém-registrada.
- som de vitória tocado quando o popup abre, usando `audio_settings.victory_sound`.
- cores configuráveis por sala usando variáveis CSS.
- página separada para configuração visual de tema.
- configurador visual de sala para título, descrição, conteúdo permitido e regras.
- painel de rodada na tela de jogo com confirmação de cartela, timer e notificações do navegador.
- página separada para configurar cartela e célula.

---

# Fluxo Atual do Sistema

## Inicialização

`app.js`:

1. carrega `sample_room.json`;
2. descobre arquivo de itens;
3. carrega `sample_items.json`;
4. valida quantidade de itens;
5. cria ou restaura cartela;
6. renderiza interface.

---

## Clique em célula

1. alterna estado marcado;
2. salva no `localStorage`;
3. re-renderiza cartela;
4. verifica vitória.

---

## Vitória

1. `rules.js` detecta condição;
2. interface atualiza;
3. vitória é salva no histórico local.

## Rodada com timer

Disponível apenas no modo numérico.

1. a rodada tem um número sorteado;
2. jogador procura o número na cartela e marca se existir;
3. jogador clica em `Conferi minha cartela`;
4. a confirmação é salva na sessão local da sala;
5. quando a quantidade configurada de conferências é atingida, o timer começa;
6. ao final do timer, a rodada local avança;
7. um novo número ainda não sorteado é sorteado;
8. o sistema tenta enviar uma notificação do navegador;
9. as confirmações são zeradas para a próxima rodada.

O timer pode ser:

```text
- fixo;
- aleatório dentro de um intervalo mínimo/máximo.
```

As notificações podem ser bloqueadas em um período do dia, por exemplo, das 22:00 às 08:00.
Prendas são configuradas por sala e sorteadas quando o jogador local for o último a confirmar a cartela X vezes.

## Camada online mínima

Arquivos:

```text
js/online_config.js
js/online.js
ONLINE_SETUP.md
```

Objetivo:

```text
- manter o app funcionando offline por padrão;
- permitir sincronização opcional via Firebase Firestore;
- sincronizar sala numérica real entre computadores diferentes;
- compartilhar número sorteado, rodada, confirmações e timer.
```

Ainda não sincroniza:

```text
- cartelas individuais;
- marcações de cada jogador;
- usuários autenticados;
- ranking ou placar.
```

## Cartela numérica

No modo numérico puro, a cartela segue o padrão de bingo tradicional:

```text
- cada coluna recebe uma fatia do range total;
- em uma cartela 5x5 com range 1-75, cada coluna representa 15 números;
- os números da coluna são escolhidos aleatoriamente dentro da fatia;
- os números dentro da coluna são exibidos em ordem crescente, de cima para baixo.
```

Observação offline:

```text
Enquanto não há multiplayer real, a tela de jogo tem um botão para simular outra confirmação de jogador.
Isso permite testar salas com `ready_target` maior que 1 usando apenas o navegador local.
```

---

# Estrutura dos JSONs

## sample_room.json

Responsável por:

- regras da sala;
- tamanho da cartela;
- modos de jogo;
- sons;
- publicação;
- referência ao arquivo de itens.

---

## sample_items.json

Responsável por:

- conteúdo das casas.

Estrutura:

```json
{
  "items": [
    {
      "id": "item_001",
      "type": "text",
      "label": "Texto",
      "image_url": null
    }
  ]
}
```

---

# Decisões Arquiteturais Importantes

## Separação entre configuração e conteúdo

A sala não contém diretamente os itens.

Isso permite:

- reutilização;
- temas;
- bibliotecas de itens;
- importação/exportação futura.

---

## Persistência local primeiro

Antes de multiplayer online.

Objetivo:

- consolidar estado;
- validar arquitetura;
- facilitar migração futura.

---

## Sem framework inicialmente

Sem React neste estágio.

Motivos:

- reduzir complexidade;
- facilitar aprendizado;
- acelerar prototipagem.

---

# Comando Local do Ambiente

No Windows do usuário:

```bash
py -m http.server 8000
```

Abrir:

```text
http://localhost:8000
```

Observação:

`python` não funciona corretamente no ambiente atual do usuário.

---

# Melhorias Futuras Planejadas

## Curto prazo

- tocar som de marcação;
- limpar histórico local.

---

## Médio prazo

- dashboard configurador;
- exportação/importação;
- temas;
- salas publicáveis.

---

## Longo prazo

- multiplayer;
- sincronização online;
- Firebase/Supabase;
- streaks globais;
- usuários;
- ranking.

---

# Camada Online Atual

Foi iniciado o multiplayer real com Firebase Firestore.

## Firestore

Documento usado:

```text
rooms/sample_room_001
```

Campos principais:

```text
config.room_settings
config.theme_settings
session
```

## O que sincroniza online

- configuração publicada da sala;
- tema publicado da sala;
- rodada atual;
- número sorteado atual;
- histórico de números sorteados;
- jogadores que já conferiram;
- timer compartilhado;
- shoutouts enviados pelo organizador.

## O que ainda é local

- cartela de cada jogador;
- marcações de cada jogador;
- histórico local de vitórias;
- imagens enviadas pelo navegador quando forem grandes demais para Firestore.

Observação:

Para que novos jogadores recebam a configuração personalizada, o configurador precisa salvar a configuração uma vez depois da versão com sincronização de `config` estar publicada. Antes disso, o Firestore tinha apenas `session`, então navegadores novos usavam o JSON base.

## Separação jogador/configurador

A página principal `index.html` passou a ser a tela limpa do jogador:

- sem link visível para configuração;
- sem mensagem técnica de balanceamento da cartela;
- sem histórico local de vitórias visível.

As configurações continuam acessíveis diretamente pelos links:

```text
theme_config.html
cell_config.html
```

## Itens condicionais

O configurador permite definir um grupo de textos condicionais por dia da semana.

Campos salvos:

```text
conditional_text_items_raw
conditional_text_weekdays
```

No jogo, esses itens só entram na lista de itens disponíveis quando o dia atual do navegador está entre os dias configurados.

## Shoutout

O configurador consegue enviar um aviso online para jogadores com a página aberta.

O Firestore recebe:

```text
shoutout.id
shoutout.message
shoutout.sent_at
shoutout_history
shoutout_history_date
```

Jogadores com a tela aberta recebem notification do navegador quando permitido; caso contrário, recebem alerta na página.

O configurador também mostra o histórico de shoutouts do dia, para acompanhar quais palavras/números já foram avisados. O histórico é filtrado pelo dia atual e é renovado diariamente.

## Preservação de cartelas

Cartelas já geradas não devem ser resetadas por alterações de configuração, novos shoutouts ou mudanças na lista de itens durante o mesmo dia.

Regra atual:

- se o usuário clica em gerar nova cartela, cria uma nova;
- se o dia local vira, a próxima abertura do jogo cria uma nova cartela;
- se a cartela salva não tinha data porque veio de versão antiga, ela é marcada como cartela de hoje e preservada.

Campo salvo na cartela:

```text
generated_on
```

---

# Filosofia do Projeto

O projeto deve:

- começar simples;
- escalar gradualmente;
- evitar reescritas completas;
- ensinar arquitetura real;
- manter separação de responsabilidades.

---

# Arquivos Mais Importantes Atualmente

## app.js

Controlador principal.

Responsável por:

- inicialização;
- carregamento;
- eventos;
- persistência;
- renderização.

---

## assets.js

Responsável por:

- preload de imagens;
- preload de sons;
- descoberta de imagens permitidas pelos filtros de conteúdo.

Som de vitória disponível atualmente:

- `assets/sounds/victory.ogg`.

---

## board.js

Responsável por:

- geração de cartela;
- renderização;
- shuffle;
- clique nas células.

---

## rules.js

Responsável por:

- detecção de vitória.

---

## storage.js

Responsável por:

- persistência local;
- histórico;
- estado salvo;
- tema local salvo pelo configurador;
- sessão local da sala para simular rodadas offline.

---

## theme.js

Responsável por:

- mapeamento de tema para variáveis CSS;
- merge entre tema base do JSON e tema local salvo.

---

## theme_config.js

Responsável por:

- página visual de configuração de tema;
- edição visual de dados básicos da sala;
- edição visual de filtros de conteúdo;
- edição visual de regras de vitória;
- edição visual de itens de texto por quebra de linha;
- edição visual de range para bingo numérico;
- edição visual de imagens submetidas pelo usuário;
- edição visual de timer e conferências necessárias para a sala;
- edição visual de timer fixo ou aleatório;
- edição visual de bloqueio de notificações por horário;
- edição visual de prendas por sala;
- alternância visual entre modo texto e modo número;
- edição visual do padding da célula com preview individual;
- preview em tempo real;
- salvamento local de tema e configurações básicas.

---

## cell_config.js

Responsável por:

- página visual de configuração da cartela;
- edição visual da casa livre central;
- edição visual do padding da célula;
- preview individual da célula;
- salvamento local das configurações de cartela dentro da sala;
- fallback local quando a leitura via `fetch` dos JSONs não estiver disponível.

---

# Status Atual do MVP

O MVP já possui:

```text
[x] Cartela dinâmica
[x] Persistência local
[x] Regras de vitória
[x] Histórico local
[x] Layout responsivo
[x] Estrutura modular
[x] Suporte estrutural a imagens
[x] Geração aleatória
[x] Configuração via JSON
[x] Preload de imagens
[x] Preload de sons
[x] Sistema de temas
[x] Configurador visual de tema
[x] Limpar histórico local
[x] Configurador visual de regras e dados básicos da sala
[x] Configurador visual de casa livre central
[x] Configurador visual de itens de texto por linha
[x] Células quadradas uniformes calculadas pelo maior texto
[x] Padding de célula configurável
[x] Modo numérico com range configurável
[x] Cartela numérica em ordem crescente
[x] Configurador visual de imagens locais
[x] Configurador visual de timer da sala
[x] Simulação local de conferências e próxima rodada
[x] Notificações do navegador para próxima rodada
[x] Timer fixo ou aleatório no modo numérico
[x] Bloqueio de notificações por horário
[x] Lista de prendas por sala
[x] Cartela numérica aleatória por faixas de coluna
[x] Sorteio local de números por rodada
[x] Configuração específica aparece conforme o modo selecionado
[x] Configuração de cartela/célula em página separada
[x] Camada online mínima opcional com Firestore
```

Observação técnica:

```text
No navegador, JavaScript puro não pode gravar arquivos diretamente em assets/images.
Por isso, nesta fase local, as imagens submetidas no configurador são salvas no localStorage como data URLs.
A arquitetura da interface já simula o fluxo futuro: usuário submete imagem -> sistema transforma em item -> sala usa esse item.
Na versão online, o destino desse mesmo fluxo poderá virar Firebase Storage, Supabase Storage ou backend próprio.
Para evitar estouro de quota do localStorage, a cartela salva somente o estado do jogo e reidrata os dados completos das imagens ao carregar.
As imagens submetidas pelo configurador são redimensionadas no navegador antes de serem salvas localmente.
```

---

# Próximo Passo Recomendado

Próximo passo recomendado:

```text
- Validação visual do configurador
```

Objetivo:

```text
- avisar quando a sala não tem itens suficientes para a cartela;
- mostrar quantos itens válidos existem;
- mostrar quantas casas jogáveis a cartela precisa;
- bloquear salvamento de configurações claramente inválidas;
- evitar erro só na página do jogo.
```

Próximos passos planejados:

```text
1. Validação visual do configurador.
2. Editor visual de itens mistos: texto, número e imagem.
3. Importar/exportar configuração local em JSON.
4. Separar páginas em navegação mais clara: jogar, configurar sala, configurar tema.
5. Criar presets de tema.
6. Preparar modelo de sala publicável para futura versão online.
7. Persistência online com Firebase ou Supabase.
```

Antes de iniciar multiplayer online.
