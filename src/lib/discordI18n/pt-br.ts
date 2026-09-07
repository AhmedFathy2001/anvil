import type { PartialDiscordDict } from './en';

// Português (Brasil) — Brazilian Portuguese.
//
// Os nomes dos comandos ficam em inglês: quem lê em português digita do mesmo jeito `/bingo board`,
// e um nome de comando traduzido é um comando que ninguém acha. O mesmo vale para “Powered by
// Anvil”. Todo o resto — a explicação, a ordem, o porquê — está em português.

const ptBr: PartialDiscordDict = {
  common: {
    noTeams: '_Ainda sem times._',
    moreOnSite: '+{n} no site',
    more: '+{n}',
    synced: 'Sincronizado {when}',
    bonusLegend:
      '⚡ bônus de missão — ganho por cima do total do tabuleiro, então conta na pontuação mas não na porcentagem.',
    visitingClansOne: '🤝 {names} é um clã visitante — este tabuleiro é compartilhado.',
    visitingClansMany: '🤝 {names} são clãs visitantes — este tabuleiro é compartilhado.',
    visitingPlayersOne: '🤝 1 jogador está visitando de outro clã.',
    visitingPlayersMany: '🤝 {n} jogadores estão visitando de outros clãs.',
    phaseRunning: 'em andamento',
    phaseUpcoming: 'não começou',
    phaseEnded: 'encerrado',
    phaseDraft: 'rascunho',
    contextVisitingTeamsOne: 'entre clãs · 1 time visitante',
    contextVisitingTeamsMany: 'entre clãs · {n} times visitantes',
    contextVisitingPlayersOne: '1 jogador visitante',
    contextVisitingPlayersMany: '{n} jogadores visitantes',
    shareButton: 'Compartilhar no canal',
    sharedBy: '-# Compartilhado por {who}',
    fieldFormat: 'Formato',
    fieldTeams: 'Times',
    fieldPlayers: 'Jogadores',
    fieldTilesDone: 'Casas feitas',
    fieldTeamScore: 'Pontos do time',
    fieldYourTiles: 'Suas casas',
    fieldAccounts: 'Contas',
    fieldRank: 'Colocação',
    fieldRoster: 'Elenco',
    fieldScore: 'Pontos',
  },

  stats: {
    rank: '#{rank} de {total} em {clan}',
  },

  board: {
    starts: 'Começa {when}.',
    ends: 'Termina {when}.',
    finished: 'Este tabuleiro acabou.',
    notScheduled: 'Ainda sem data.',
    hidden: 'As casas ainda estão escondidas — o tabuleiro abre quando a staff revelar.',
  },

  leaderboard: { title: '🏆 {event} — classificação' },

  rules: {
    title: '📜 {event} — como funciona',
    houseTitle: '📌 {clan} — regras da casa',
    houseContinues: '**As regras continuam** — leia todas em',
    houseFull: 'Regras completas:',
    houseTrimmed: '-# Cortado para caber no Discord — peça o regulamento completo à staff.',

    scoringPoints:
      '• **Pontuação** — cada casa vale os próprios pontos; a pontuação de um time é a soma do que ele fechou.',
    scoringTiles: '• **Pontuação** — um ponto por casa; a pontuação de um time é quantas ele fechou.',
    tileRace:
      '• **Corrida de casas** — o tabuleiro é um percurso ordenado. Vocês avançam por ele; a casa mais distante é a sua posição.',
    revealScheduled:
      '• **Aberturas** — as casas abrem conforme um cronograma definido pela staff. Uma casa que você ainda não vê simplesmente não abriu.',
    revealIntervalOne: '• **Aberturas** — uma casa é sorteada {order} a cada {minutes} minutos.',
    revealIntervalMany: '• **Aberturas** — {n} casas são sorteadas {order} a cada {minutes} minutos.',
    revealOrderRandom: 'aleatoriamente',
    revealOrderBoard: 'na ordem do tabuleiro',
    revealBounty:
      '• **Recompensa** — há exatamente uma casa aberta por vez. O primeiro time que fecha a casa a encerra, e a próxima é sorteada.',
    revealRotating:
      '• **Rotação** — {n} casas ficam abertas ao mesmo tempo; as mais antigas expiram conforme novas saem. Fechem enquanto estão no ar.',
    revealAll: '• **Aberturas** — o tabuleiro inteiro está aberto desde o começo.',
    notRevealed:
      '• **Ainda não revelado** — a staff abre o tabuleiro quando o evento começa. Antes disso ninguém vê as casas.',
    lockout: '• **Exclusividade** — o primeiro time que fecha uma casa leva. Depois disso ninguém mais pontua nela.',
    firstBonus: '• **Bônus de primeiro** — o primeiro time numa casa ganha {amount} pontos extras.',
    decay:
      '• **Queda** — uma casa vale pontos cheios ao abrir e desce para {pct}% ao longo de {hours} h. Fechar cedo rende mais.',
    growth:
      '• **Alta** — uma casa começa no valor cheio e sobe para {pct}% ao longo de {hours} h. Esperar rende mais.',
    missions:
      '• **Missões** — objetivos extras revelados no meio do evento, {when}. Ninguém vê uma antes de ser anunciada.',
    missionWhenInterval: 'a cada {minutes} minutos',
    missionWhenScheduled: 'conforme um cronograma',
    missionWhenManual: 'quando a staff soltar',
    missionBonusNote:
      '-# Pontos de missão são um **bônus** — entram na sua pontuação mas nunca no total do tabuleiro, então o tabuleiro não pode crescer no meio do evento.',
    missionAnnouncedCount: '{announced} de {total} anunciadas até agora.',
    startProofStrict:
      '• **Foto de largada** — cada jogador entrega uma captura depois da largada, num local sorteado no momento da largada. Até você entregar a sua, tudo o que enviar é recusado.',
    startProofFlag:
      '• **Foto de largada** — cada jogador entrega uma captura depois da largada, num local sorteado no momento da largada. Até você entregar a sua, tudo o que enviar fica marcado para revisão.',
    startProofSession:
      '-# Saia e entre de novo antes — os hiscores só salvam no logout, então sua foto precisa ser feita dentro de {minutes} minutos após um login novo.',
    teamChoice: '• **Times** — você escolhe seu time na inscrição; a staff aprova.',
    captainInvites: '• **Times** — os capitães distribuem eles mesmos links de convite para o próprio lado.',
    entryFee: '• **Taxa de inscrição** — {amount} por inscrição.',
    prizePool: '• **Bolo de prêmios** — {amount} e subindo a cada inscrição aprovada.',

    trackingHeading: '**Como o crédito chega até você**',
    trackingPlugin: '• **Com o plugin do Anvil** — ele envia por você. Não há nada a fazer além de jogar.',
    trackingHiscoresAll:
      '• **Sem plugin?** Cada casa aqui lê dos **hiscores oficiais**, então não precisam de cliente nenhum — mas os hiscores só salvam quando você **desloga**, e atualizam na hora cheia. Jogue → deslogue → espere a hora.',
    trackingHiscoresSome:
      '• **Sem plugin?** {n} destas casas leem dos **hiscores oficiais**, então não precisam de cliente nenhum — mas os hiscores só salvam quando você **desloga**, e atualizam na hora cheia. Jogue → deslogue → espere a hora.',
    trackingProofAll:
      '• **Drops, kills e tarefas cronometradas** precisam de prova — aqui, todas as casas. O plugin arquiva sozinho; sem ele, você mesmo envia uma captura {where}.',
    trackingProofSome:
      '• **Drops, kills e tarefas cronometradas** precisam de prova — {n} destas. O plugin arquiva sozinho; sem ele, você mesmo envia uma captura {where}.',
    trackingWhereUrl: 'em **My Team**, no {url}/team',
    trackingWhereNoUrl: 'na página My Team',
    trackingKeepShot:
      '-# Guarde sua própria captura de tudo o que for grande de qualquer jeito — não custa nada e resolve qualquer discussão.',
  },

  me: {
    title: '👤 {who} — {event}',
    notEnteredTitle: '🔍 Você não está neste tabuleiro',
    notEntered: 'Você não está inscrito em **{event}**.',
    notEnteredWhere: 'Inscrições e seu perfil ficam em {url}.',
    onTeam: 'Você está no **{team}**.',
    onTeamRanked: 'Você está no **{team}** — {place} de {total}.',
    noTeamYet: 'Você está inscrito mas ainda não tem time.',
    finishedHiddenOne: 'Você fechou 1 casa — os nomes aparecem quando o tabuleiro for revelado.',
    finishedHiddenMany: 'Você fechou {n} casas — os nomes aparecem quando o tabuleiro for revelado.',
    finishedHeading: '**Casas que você fechou**',
    nothingYet: 'Nenhuma casa foi creditada a você ainda.',
    notEnteredOther: '{who} não está inscrito em **{event}**.',
    onTeamOther: '{who} está no **{team}**.',
    onTeamRankedOther: '{who} está no **{team}** — {place} de {total}.',
    noTeamYetOther: '{who} está inscrito mas ainda não tem time.',
    finishedHiddenOneOther: '{who} fechou 1 casa — os nomes aparecem quando o tabuleiro for revelado.',
    finishedHiddenManyOther: '{who} fechou {n} casas — os nomes aparecem quando o tabuleiro for revelado.',
    finishedHeadingOther: '**Casas que {who} fechou**',
    nothingYetOther: 'Nenhuma casa foi creditada a {who} ainda.',
  },

  team: {
    noTeamsTitle: '🔍 Ainda sem times',
    noTeamsBody: '**{event}** ainda não tem times.',
    noMatchTitle: '🔍 Nenhum time assim',
    noMatch: 'Nenhum time em **{event}** corresponde a "{needle}".',
    noneOfYours: 'Você não está em um time — diga o nome de um para consultar.',
    teamsList: '**Times:** {names}',
    standing: '{place} de {total} — {score}{bonus} · {pct}% do tabuleiro.',
    bonusSuffix: ' (⚡+{n} de bônus de missão)',
    visitingWholeTeam: '🤝 Um clã visitante: {names}',
    visitingSomeOne: '🤝 1 jogador visitante: {names}',
    visitingSomeMany: '🤝 {n} jogadores visitantes: {names}',
    recentHeading: '**Últimas casas**',
    hiddenBoard: 'As casas de **{event}** ainda não foram reveladas — as fichas de time abrem junto com o tabuleiro.',
  },

  apply: {
    title: '📝 {event} — como entrar',
    drafted: '**Você está dentro** — já escolhido no draft para um time. Só falta jogar.',
    approved: '**Você está inscrito e aprovado.** Vão te colocar num time antes de o evento começar.',
    pending: '**Sua inscrição entrou** e está esperando a staff aprovar. Nada mais a fazer.',
    open: '**As inscrições estão abertas.**',
    notOpenYet: '**As inscrições ainda não abriram.**',
    eventStarted: '**O evento já começou**, então as inscrições estão fechadas. Pergunte à staff se ainda tem vaga.',
    closed: '**As inscrições estão fechadas.**',
    closesIn: 'Fecham {when}.',
    opensIn: 'Abrem {when}.',
    fee: 'A entrada custa {amount} — a staff diz para onde mandar.',
    feePerAccount: 'A entrada custa {amount} por conta — a staff diz para onde mandar.',
    signUpAt: '**Inscreva-se:** {url}',
    noAccountUrl:
      '-# O Anvil ainda não conhece sua conta. Vincule seu RSN primeiro em {url}/profile — inscrições ficam presas a uma conta, não a um nome do Discord.',
    noAccountNoUrl:
      '-# O Anvil ainda não conhece sua conta. Vincule seu RSN primeiro na sua página de perfil — inscrições ficam presas a uma conta, não a um nome do Discord.',
  },

  next: {
    title: '⏭️ {event} — o que vem agora',
    eventStarts: '🚩 Evento começa',
    eventEnds: '🏁 Evento termina',
    nextTile: '🎲 Próxima casa sorteada',
    nextMission: '⚡ Próxima missão',
    signupsClose: '📝 Inscrições fecham',
    nothingEnded: 'Nada mais no relógio — este tabuleiro acabou.',
    nothingScheduled: 'Nada marcado. A staff solta a próxima coisa quando soltar.',
    hiddenMissionsOne: '-# Falta 1 missão, anunciada quando a staff soltar.',
    hiddenMissionsMany: '-# Faltam {n} missões, anunciadas quando a staff soltar.',
  },

  help: {
    title: '🔨 O que o Anvil pode te contar',
    privateNote:
      '-# As respostas só você vê. Use o botão **{share}** embaixo de uma resposta para publicá-la no canal.',
    subs: {
      board: 'O tabuleiro que está rolando agora',
      leaderboard: 'Classificação dos times',
      rules: 'Como o tabuleiro funciona — pontuação, aberturas, provas e as regras da casa do clã',
      apply: 'Como entrar — inscrições, a taxa, e como você está',
      next: 'O que vem — a próxima abertura, missão ou prazo',
      me: 'Seu time, suas casas, sua colocação',
      help: 'O que o Anvil pode te contar aqui dentro',
      team: 'A ficha de um time — pontos, elenco, últimas casas',
    },
    command: 'Anvil — veja o tabuleiro do clã',
    optionTeamName: 'Nome do time (deixe em branco para o seu)',
  },

  errors: {
    dm: 'Rode isso no servidor do Discord do seu clã — um comando de tabuleiro precisa saber qual clã está perguntando.',
    wrongGuild:
      'Este bot está ligado a um servidor diferente do Anvil de **{clan}**. Peça a um admin para conferir o ID do servidor em Integrations.',
    unknownCommand: 'O Anvil não responde a {command} — tente {suggestion}.',
    unknownSub: 'Comando desconhecido. Tente {list}.',
    noBoards: '**{clan}** ainda não tem tabuleiros.',
    noBoardsStaff: 'A staff pode criar um em {url}/admin/events/new.',
    failed: 'O Anvil bateu num erro ao responder. Um admin pode conferir os logs do site.',
    unsupported: 'Esse tipo de interação ainda não é suportado.',
    shareExpired: 'Essa resposta é antiga demais para compartilhar — rode o comando de novo.',
  },

  commands: {
    sotw: 'Skill of the Week — classificação ao vivo',
    botw: 'Boss of the Week — classificação ao vivo',
    eff: 'Ranking de eficiência (EHP/EHB) e sua posição',
    coffer: 'O cofre do clã — saldo, doadores e a staff adiciona/remove',
    clog: 'Collection log — a contagem de um membro e os melhores do clã',
    luck: 'Sorte nos drops — os mais secos e sortudos do clã, ou de um membro',
    guide: 'Leia um guia de configuração — a visão geral ou um passo, com link',
  },

  multi: {
    liveTitle: '📋 Tabuleiros ao vivo',
    liveIntro: 'Agora há {n} tabuleiros rolando.',
    standingsTitle: '🏆 Classificação ao vivo',
    standingsIntro: 'Classificação de {n} tabuleiros ao vivo.',
    teamsOne: '1 time',
    teamsMany: '{n} times',
    leader: 'liderado por {team} ({score})',
  },

  weekly: {
    sotwTitle: '📈 {title}',
    botwTitle: '⚔️ {title}',
    sotwEmpty: 'Nenhum Skill of the Week está rolando no {clan} agora.',
    botwEmpty: 'Nenhum Boss of the Week está rolando no {clan} agora.',
    ends: 'Termina {when}.',
    noEntries: 'Ninguém entrou ainda.',
    you: 'Você: {place} de {total}.',
    youNone: 'Você não está participando — entre pelo plugin ou no site.',
    fieldMetric: 'Métrica',
    fieldEntries: 'Inscritos',
  },

  eff: {
    title: '⚡ Eficiência — {metric}',
    empty: 'Ainda sem dados de eficiência — os membros precisam primeiro de uma varredura de estatísticas.',
    you: 'Você: #{rank} de {total}.',
    fieldRanked: 'No ranking',
  },

  coffer: {
    title: '💰 {clan} — cofre',
    none: 'Ainda sem cofre — o {clan} não registrou movimentações de gp.',
    available: 'Disponível',
    reserved: 'Reservado',
    pending: 'Pendente',
    donorsHeading: '**Maiores doadores**',
    recentHeading: '**Movimentações recentes**',
    needAccount:
      'Vincule primeiro sua conta Anvil no site — mudanças no cofre estão ligadas ao seu login no site, não ao seu nome do Discord.',
    notStaff: 'Só tesoureiros, admins e donos podem mexer no cofre.',
    badAmount: 'Informe um valor para adicionar ou remover, ex. `5m` ou `2500000`.',
    outOfRange: 'Esse valor está fora do intervalo.',
    added: '✅ Adicionado {amount} ao cofre — {available} disponível agora.',
    removed: '✅ Removido {amount} do cofre — {available} disponível agora.',
  },

  clog: {
    title: '📖 {who} — collection log',
    notSynced: '{who} ainda não sincronizou um collection log — sincronize pelo plugin do Anvil.',
    rankLine: '#{rank} de {total} colecionadores no {clan}.',
    topHeading: '**Melhores colecionadores**',
    slots: 'Espaços',
    collectors: 'Colecionadores',
  },

  luck: {
    boardsTitle: '🍀 {clan} — sorte',
    memberTitle: '🍀 {who} — sorte',
    dryHeading: '**Mais secos**',
    spoonedHeading: '**Mais sortudos**',
    emptyBoards: 'Ainda sem dados de sorte — os membros precisam sincronizar seus collection logs.',
    notSynced: '{who} ainda não sincronizou um collection log.',
    totalLine: 'No total: {net} em {items} drops rastreados.',
    fromLogs: 'De {n} logs sincronizados.',
  },

  guide: {
    notFound: 'Não tenho um guia com esse nome.',
    stepsHeading: '**Passos**',
    stepsField: 'Passos',
    stepTitle: 'Passo {n}/{total} — {title}',
    noSuchStep: 'Este guia tem {total} passos — escolha um número de 1 a {total}.',
    readFull: '📖 Leia o guia completo: {url}',
    openStep: '🔗 Abra este passo no site: {url}',
    jumpHint: '-# Pule para um passo: `/guide topic:{topic} step:1`',
  },
};

export default ptBr;
