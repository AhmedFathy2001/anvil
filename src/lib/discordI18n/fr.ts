import type { PartialDiscordDict } from './en';

// Français — French.
//
// Les noms de commandes restent en anglais : qui lit du français tape quand même `/bingo board`, et
// un nom de commande traduit est une commande que personne ne trouve. Idem pour « Powered by
// Anvil ». Tout le reste — l’explication, l’ordre, le pourquoi — est en français.

const fr: PartialDiscordDict = {
  common: {
    noTeams: '_Pas encore d’équipes._',
    moreOnSite: '+{n} de plus sur le site',
    more: '+{n} de plus',
    synced: 'Synchronisé {when}',
    bonusLegend:
      '⚡ bonus de mission — gagné en plus du total du plateau, il compte donc dans le score mais pas dans le pourcentage.',
    visitingClansOne: '🤝 {names} est un clan invité — ce plateau est partagé.',
    visitingClansMany: '🤝 {names} sont des clans invités — ce plateau est partagé.',
    visitingPlayersOne: '🤝 1 joueur vient d’un autre clan.',
    visitingPlayersMany: '🤝 {n} joueurs viennent d’autres clans.',
    phaseRunning: 'en cours',
    phaseUpcoming: 'pas commencé',
    phaseEnded: 'terminé',
    phaseDraft: 'brouillon',
    contextVisitingTeamsOne: 'inter-clans · 1 équipe invitée',
    contextVisitingTeamsMany: 'inter-clans · {n} équipes invitées',
    contextVisitingPlayersOne: '1 joueur invité',
    contextVisitingPlayersMany: '{n} joueurs invités',
    shareButton: 'Partager dans le salon',
    sharedBy: '-# Partagé par {who}',
    fieldFormat: 'Format',
    fieldTeams: 'Équipes',
    fieldPlayers: 'Joueurs',
    fieldTilesDone: 'Cases faites',
    fieldTeamScore: 'Score de l’équipe',
    fieldYourTiles: 'Tes cases',
    fieldAccounts: 'Comptes',
    fieldRank: 'Rang',
    fieldRoster: 'Effectif',
    fieldScore: 'Score',
  },

  stats: {
    rank: '#{rank} sur {total} dans {clan}',
  },

  board: {
    starts: 'Commence {when}.',
    ends: 'Se termine {when}.',
    finished: 'Ce plateau est terminé.',
    notScheduled: 'Pas encore programmé.',
    hidden: 'Les cases sont encore masquées — le plateau s’ouvre quand le staff le dévoile.',
  },

  leaderboard: { title: '🏆 {event} — classement' },

  rules: {
    title: '📜 {event} — comment ça marche',
    houseTitle: '📌 {clan} — règles du clan',
    houseContinues: '**Les règles continuent** — lis-les toutes sur',
    houseFull: 'Règles complètes :',
    houseTrimmed: '-# Raccourci pour tenir dans Discord — demande le règlement complet au staff.',

    scoringPoints:
      '• **Score** — chaque case vaut ses propres points ; le score d’une équipe est la somme de ce qu’elle a fini.',
    scoringTiles: '• **Score** — un point par case ; le score d’une équipe est le nombre de cases finies.',
    tileRace:
      '• **Course aux cases** — le plateau est un parcours ordonné. Vous avancez dessus ; votre case la plus lointaine est votre position.',
    revealScheduled:
      '• **Ouvertures** — les cases s’ouvrent selon un calendrier fixé par le staff. Une case que tu ne vois pas encore n’est tout simplement pas ouverte.',
    revealIntervalOne: '• **Ouvertures** — une case est tirée {order} toutes les {minutes} minutes.',
    revealIntervalMany: '• **Ouvertures** — {n} cases sont tirées {order} toutes les {minutes} minutes.',
    revealOrderRandom: 'au hasard',
    revealOrderBoard: 'dans l’ordre du plateau',
    revealBounty:
      '• **Prime** — une seule case est ouverte à la fois. La première équipe qui la finit la ferme, et la suivante est tirée.',
    revealRotating:
      '• **Rotation** — {n} cases restent ouvertes en même temps ; les plus anciennes expirent à mesure que de nouvelles sortent. Finis-les tant qu’elles sont là.',
    revealAll: '• **Ouvertures** — tout le plateau est ouvert dès le départ.',
    notRevealed:
      '• **Pas encore dévoilé** — le staff ouvre le plateau au démarrage de l’événement. Personne ne voit les cases avant.',
    lockout: '• **Verrouillage** — la première équipe à finir une case la prend. Plus personne ne peut marquer dessus ensuite.',
    firstBonus: '• **Bonus de première** — la première équipe sur une case gagne {amount} points supplémentaires.',
    decay:
      '• **Décote** — une case vaut tous ses points à l’ouverture puis glisse à {pct}% sur {hours} h. Finir tôt rapporte plus.',
    growth:
      '• **Montée** — une case part de sa pleine valeur et monte à {pct}% sur {hours} h. Attendre rapporte plus.',
    missions:
      '• **Missions** — objectifs supplémentaires dévoilés en cours d’événement, {when}. Personne n’en voit une avant son annonce.',
    missionWhenInterval: 'toutes les {minutes} minutes',
    missionWhenScheduled: 'selon un calendrier',
    missionWhenManual: 'quand le staff les lâche',
    missionBonusNote:
      '-# Les points de mission sont un **bonus** — ajoutés à ton score mais jamais au total du plateau, donc le plateau ne peut pas s’allonger en cours de route.',
    missionAnnouncedCount: '{announced} sur {total} annoncées jusqu’ici.',
    startProofStrict:
      '• **Photo de départ** — chaque joueur dépose une capture après le lancement, à un lieu tiré au sort au moment du départ. Tant que tu n’as pas déposé la tienne, tout ce que tu envoies est refusé.',
    startProofFlag:
      '• **Photo de départ** — chaque joueur dépose une capture après le lancement, à un lieu tiré au sort au moment du départ. Tant que tu n’as pas déposé la tienne, tout ce que tu envoies est signalé pour vérification.',
    startProofSession:
      '-# Déconnecte-toi et reconnecte-toi d’abord — les hiscores ne s’enregistrent qu’à la déconnexion, donc ta photo doit être prise dans les {minutes} minutes suivant une connexion fraîche.',
    teamChoice: '• **Équipes** — tu choisis ton équipe à l’inscription ; le staff la valide.',
    captainInvites: '• **Équipes** — les capitaines distribuent eux-mêmes des liens d’invitation pour leur côté.',
    entryFee: '• **Frais d’inscription** — {amount} par inscription.',
    prizePool: '• **Cagnotte** — {amount}, et elle monte à chaque inscription validée.',

    trackingHeading: '**Comment ça te sera crédité**',
    trackingPlugin: '• **Avec le plugin Anvil** — il envoie à ta place. Rien à faire d’autre que jouer.',
    trackingHiscoresAll:
      '• **Pas de plugin ?** Chaque case ici se lit dans les **hiscores officiels**, elle n’a donc besoin d’aucun client — mais les hiscores ne s’enregistrent qu’à la **déconnexion**, et se rafraîchissent à l’heure pile. Jouer → se déconnecter → attendre l’heure.',
    trackingHiscoresSome:
      '• **Pas de plugin ?** {n} de ces cases se lisent dans les **hiscores officiels**, elles n’ont donc besoin d’aucun client — mais les hiscores ne s’enregistrent qu’à la **déconnexion**, et se rafraîchissent à l’heure pile. Jouer → se déconnecter → attendre l’heure.',
    trackingProofAll:
      '• **Drops, kills et défis chronométrés** exigent une preuve — ici, chaque case. Le plugin la dépose automatiquement ; sans lui, tu envoies toi-même une capture {where}.',
    trackingProofSome:
      '• **Drops, kills et défis chronométrés** exigent une preuve — {n} d’entre elles. Le plugin la dépose automatiquement ; sans lui, tu envoies toi-même une capture {where}.',
    trackingWhereUrl: 'sur **My Team** à l’adresse {url}/team',
    trackingWhereNoUrl: 'sur la page My Team',
    trackingKeepShot:
      '-# Garde de toute façon ta propre capture de tout ce qui est important — ça ne coûte rien et ça tranche n’importe quel litige.',
  },

  me: {
    title: '👤 {who} — {event}',
    notEnteredTitle: '🔍 Pas sur ce plateau',
    notEntered: 'Tu n’es pas inscrit à **{event}**.',
    notEnteredWhere: 'Les inscriptions et ton profil sont sur {url}.',
    onTeam: 'Tu es dans **{team}**.',
    onTeamRanked: 'Tu es dans **{team}** — {place} sur {total}.',
    noTeamYet: 'Tu es inscrit mais pas encore dans une équipe.',
    finishedHiddenOne: 'Tu as fini 1 case — les noms s’afficheront une fois le plateau dévoilé.',
    finishedHiddenMany: 'Tu as fini {n} cases — les noms s’afficheront une fois le plateau dévoilé.',
    finishedHeading: '**Cases que tu as finies**',
    nothingYet: 'Aucune case ne t’est encore créditée.',
    notEnteredOther: '{who} n’est pas inscrit à **{event}**.',
    onTeamOther: '{who} est dans **{team}**.',
    onTeamRankedOther: '{who} est dans **{team}** — {place} sur {total}.',
    noTeamYetOther: '{who} est inscrit mais pas encore dans une équipe.',
    finishedHiddenOneOther: '{who} a fini 1 case — les noms s’afficheront une fois le plateau dévoilé.',
    finishedHiddenManyOther: '{who} a fini {n} cases — les noms s’afficheront une fois le plateau dévoilé.',
    finishedHeadingOther: '**Cases que {who} a finies**',
    nothingYetOther: 'Aucune case n’est encore créditée à {who}.',
  },

  team: {
    noTeamsTitle: '🔍 Pas encore d’équipes',
    noTeamsBody: '**{event}** n’a encore aucune équipe.',
    noMatchTitle: '🔍 Aucune équipe de ce nom',
    noMatch: 'Aucune équipe de **{event}** ne correspond à « {needle} ».',
    noneOfYours: 'Tu n’es dans aucune équipe — donne un nom pour en consulter une.',
    teamsList: '**Équipes :** {names}',
    standing: '{place} sur {total} — {score}{bonus} · {pct}% du plateau.',
    bonusSuffix: ' (⚡+{n} bonus de mission)',
    visitingWholeTeam: '🤝 Un clan invité : {names}',
    visitingSomeOne: '🤝 1 joueur invité : {names}',
    visitingSomeMany: '🤝 {n} joueurs invités : {names}',
    recentHeading: '**Dernières cases**',
    hiddenBoard: 'Les cases de **{event}** ne sont pas encore dévoilées — les fiches d’équipe s’ouvrent avec le plateau.',
  },

  apply: {
    title: '📝 {event} — comment participer',
    drafted: '**Tu es dedans** — déjà drafté dans une équipe. Il ne reste plus qu’à jouer.',
    approved: '**Tu es inscrit et validé.** Tu seras placé dans une équipe avant le début de l’événement.',
    pending: '**Ton inscription est passée** et attend la validation du staff. Rien de plus à faire.',
    open: '**Les inscriptions sont ouvertes.**',
    notOpenYet: '**Les inscriptions ne sont pas encore ouvertes.**',
    eventStarted: '**L’événement a commencé**, les inscriptions sont donc fermées. Demande au staff s’il reste de la place.',
    closed: '**Les inscriptions sont fermées.**',
    closesIn: 'Elles ferment {when}.',
    opensIn: 'Elles ouvrent {when}.',
    fee: 'La participation coûte {amount} — le staff te dira où l’envoyer.',
    feePerAccount: 'La participation coûte {amount} par compte — le staff te dira où l’envoyer.',
    signUpAt: '**S’inscrire :** {url}',
    noAccountUrl:
      '-# Anvil ne connaît pas encore ton compte. Relie d’abord ton RSN sur {url}/profile — les inscriptions se rattachent à un compte, pas à un pseudo Discord.',
    noAccountNoUrl:
      '-# Anvil ne connaît pas encore ton compte. Relie d’abord ton RSN sur ta page de profil — les inscriptions se rattachent à un compte, pas à un pseudo Discord.',
  },

  next: {
    title: '⏭️ {event} — la suite',
    eventStarts: '🚩 Début de l’événement',
    eventEnds: '🏁 Fin de l’événement',
    nextTile: '🎲 Prochaine case tirée',
    nextMission: '⚡ Prochaine mission',
    signupsClose: '📝 Fermeture des inscriptions',
    nothingEnded: 'Plus rien au compteur — ce plateau est terminé.',
    nothingScheduled: 'Rien de programmé. Le staff lâche la suite quand il la lâche.',
    hiddenMissionsOne: '-# 1 mission reste à venir, annoncée quand le staff la lâchera.',
    hiddenMissionsMany: '-# {n} missions restent à venir, annoncées quand le staff les lâchera.',
  },

  help: {
    title: '🔨 Ce qu’Anvil peut te dire',
    privateNote:
      '-# Les réponses ne sont visibles que par toi. Utilise le bouton **{share}** sous une réponse pour la publier dans le salon.',
    subs: {
      board: 'Le plateau en cours en ce moment',
      leaderboard: 'Classement des équipes',
      rules: 'Comment marche ce plateau — score, ouvertures, preuves, plus les règles du clan',
      apply: 'Comment participer — inscriptions, frais, et où tu en es',
      next: 'Ce qui arrive — prochaine ouverture, mission ou échéance',
      me: 'Ton équipe, tes cases, ton classement',
      help: 'Ce qu’Anvil peut te dire ici',
      team: 'La fiche d’une équipe — score, effectif, dernières cases',
    },
    command: 'Anvil — consulter le plateau du clan',
    optionTeamName: 'Nom d’équipe (laisse vide pour la tienne)',
  },

  errors: {
    dm: 'Lance-la dans le serveur Discord de ton clan — une commande de plateau doit savoir quel clan demande.',
    wrongGuild:
      'Ce bot est relié à un autre serveur que l’Anvil de **{clan}**. Demande à un admin de vérifier l’ID du serveur dans Integrations.',
    unknownCommand: 'Anvil ne répond pas à {command} — essaie {suggestion}.',
    unknownSub: 'Commande inconnue. Essaie {list}.',
    noBoards: '**{clan}** n’a encore aucun plateau.',
    noBoardsStaff: 'Le staff peut en créer un sur {url}/admin/events/new.',
    failed: 'Anvil a rencontré une erreur en répondant. Un admin peut consulter les logs du site.',
    unsupported: 'Ce type d’interaction n’est pas encore pris en charge.',
    shareExpired: 'Cette réponse est trop ancienne pour être partagée — relance la commande.',
  },

  commands: {
    sotw: 'Skill of the Week — classement en direct',
    botw: 'Boss of the Week — classement en direct',
    eff: 'Classement d’efficacité (EHP/EHB) et ton rang',
    coffer: 'Le coffre du clan — solde, donateurs et ajout/retrait par le staff',
    clog: 'Journal de collection — le total d’un membre et les meilleurs collectionneurs du clan',
    luck: 'Chance aux drops — les plus secs et chanceux du clan, ou d’un membre',
    guide: 'Lire un guide d’installation — l’aperçu ou une étape, avec un lien',
  },

  multi: {
    liveTitle: '📋 Plateaux en direct',
    liveIntro: '{n} plateaux sont en direct en ce moment.',
    standingsTitle: '🏆 Classements en direct',
    standingsIntro: 'Classement sur {n} plateaux en direct.',
    teamsOne: '1 équipe',
    teamsMany: '{n} équipes',
    leader: 'menée par {team} ({score})',
  },

  weekly: {
    sotwTitle: '📈 {title}',
    botwTitle: '⚔️ {title}',
    sotwEmpty: 'Aucun Skill of the Week n’est en cours dans {clan} pour l’instant.',
    botwEmpty: 'Aucun Boss of the Week n’est en cours dans {clan} pour l’instant.',
    ends: 'Se termine {when}.',
    noEntries: 'Personne ne s’est encore inscrit.',
    you: 'Toi : {place} sur {total}.',
    youNone: 'Tu n’es pas inscrit — rejoins via le plugin ou sur le site.',
    fieldMetric: 'Mesure',
    fieldEntries: 'Inscrits',
  },

  eff: {
    title: '⚡ Efficacité — {metric}',
    empty: 'Pas encore de données d’efficacité — il faut d’abord une passe de stats sur les membres.',
    you: 'Toi : #{rank} sur {total}.',
    fieldRanked: 'Classés',
  },

  coffer: {
    title: '💰 {clan} — coffre',
    none: 'Pas encore de coffre — {clan} n’a enregistré aucun mouvement de gp.',
    available: 'Disponible',
    reserved: 'Réservé',
    pending: 'En attente',
    donorsHeading: '**Meilleurs donateurs**',
    recentHeading: '**Derniers mouvements**',
    needAccount:
      'Relie d’abord ton compte Anvil sur le site — les mouvements du coffre sont liés à ton identifiant du site, pas à ton nom Discord.',
    notStaff: 'Seuls les trésoriers, admins et owners peuvent bouger le coffre.',
    badAmount: 'Indique un montant à ajouter ou retirer, p. ex. `5m` ou `2500000`.',
    outOfRange: 'Ce montant est hors limites.',
    added: '✅ {amount} ajouté au coffre — {available} disponible maintenant.',
    removed: '✅ {amount} retiré du coffre — {available} disponible maintenant.',
  },

  clog: {
    title: '📖 {who} — journal de collection',
    notSynced: '{who} n’a pas encore synchronisé de journal de collection — synchronise-le depuis le plugin Anvil.',
    rankLine: '#{rank} sur {total} collectionneurs dans {clan}.',
    topHeading: '**Meilleurs collectionneurs**',
    slots: 'Slots',
    collectors: 'Collectionneurs',
  },

  luck: {
    boardsTitle: '🍀 {clan} — chance',
    memberTitle: '🍀 {who} — chance',
    dryHeading: '**Les plus secs**',
    spoonedHeading: '**Les plus chanceux**',
    emptyBoards: 'Pas encore de données de chance — les membres doivent synchroniser leur journal de collection.',
    notSynced: '{who} n’a pas encore synchronisé de journal de collection.',
    totalLine: 'Au total : {net} sur {items} drops suivis.',
    fromLogs: 'D’après {n} journaux synchronisés.',
  },

  guide: {
    notFound: 'Je n’ai pas de guide portant ce nom.',
    stepsHeading: '**Étapes**',
    stepsField: 'Étapes',
    stepTitle: 'Étape {n}/{total} — {title}',
    noSuchStep: 'Ce guide compte {total} étapes — choisis un nombre de 1 à {total}.',
    readFull: '📖 Lire le guide complet : {url}',
    openStep: '🔗 Ouvrir cette étape sur le site : {url}',
    jumpHint: '-# Aller à une étape : `/guide topic:{topic} step:1`',
  },
};

export default fr;
