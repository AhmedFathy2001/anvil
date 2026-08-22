import type { PartialDiscordDict } from './en';

// Italiano — Italian.
//
// I nomi dei comandi restano in inglese: chi legge in italiano digita comunque `/bingo board`, e un
// nome di comando tradotto è un comando che nessuno trova. Lo stesso vale per “Powered by Anvil”.
// Tutto il resto — la spiegazione, l’ordine, il perché — è in italiano.

const it: PartialDiscordDict = {
  common: {
    noTeams: '_Ancora nessuna squadra._',
    moreOnSite: '+{n} altre sul sito',
    more: '+{n} altre',
    bonusLegend:
      '⚡ bonus missione — guadagnato sopra al totale del tabellone, quindi conta nel punteggio ma non nella percentuale.',
    visitingClansOne: '🤝 {names} è un clan in visita — questo tabellone è condiviso.',
    visitingClansMany: '🤝 {names} sono clan in visita — questo tabellone è condiviso.',
    visitingPlayersOne: '🤝 1 giocatore è in visita da un altro clan.',
    visitingPlayersMany: '🤝 {n} giocatori sono in visita da altri clan.',
    phaseRunning: 'in corso',
    phaseUpcoming: 'non iniziato',
    phaseEnded: 'concluso',
    phaseDraft: 'bozza',
    contextVisitingTeamsOne: 'tra clan · 1 squadra in visita',
    contextVisitingTeamsMany: 'tra clan · {n} squadre in visita',
    contextVisitingPlayersOne: '1 giocatore in visita',
    contextVisitingPlayersMany: '{n} giocatori in visita',
    shareButton: 'Condividi nel canale',
    sharedBy: '-# Condiviso da {who}',
    fieldFormat: 'Formato',
    fieldTeams: 'Squadre',
    fieldPlayers: 'Giocatori',
    fieldTilesDone: 'Caselle fatte',
    fieldTeamScore: 'Punteggio squadra',
    fieldYourTiles: 'Le tue caselle',
    fieldAccounts: 'Account',
    fieldRank: 'Posizione',
    fieldRoster: 'Rosa',
    fieldScore: 'Punteggio',
  },

  board: {
    starts: 'Inizia {when}.',
    ends: 'Finisce {when}.',
    finished: 'Questo tabellone è finito.',
    notScheduled: 'Non ancora programmato.',
    hidden: 'Le caselle sono ancora nascoste — il tabellone si apre quando lo staff lo svela.',
  },

  leaderboard: { title: '🏆 {event} — classifica' },

  rules: {
    title: '📜 {event} — come funziona',
    houseTitle: '📌 {clan} — regole della casa',
    houseContinues: '**Le regole proseguono** — leggile tutte su',
    houseFull: 'Regole complete:',
    houseTrimmed: '-# Accorciate per stare in Discord — chiedi allo staff il regolamento completo.',

    scoringPoints:
      '• **Punteggio** — ogni casella vale i propri punti; il punteggio di una squadra è la somma di ciò che ha completato.',
    scoringTiles: '• **Punteggio** — un punto per casella; il punteggio di una squadra è quante ne ha completate.',
    tileRace:
      '• **Corsa a caselle** — il tabellone è un percorso ordinato. Avanzate lungo di esso; la casella più lontana è la vostra posizione.',
    revealScheduled:
      '• **Aperture** — le caselle si aprono secondo un calendario deciso dallo staff. Una casella che non vedi ancora semplicemente non si è aperta.',
    revealIntervalOne: '• **Aperture** — una casella viene estratta {order} ogni {minutes} minuti.',
    revealIntervalMany: '• **Aperture** — {n} caselle vengono estratte {order} ogni {minutes} minuti.',
    revealOrderRandom: 'a caso',
    revealOrderBoard: 'nell’ordine del tabellone',
    revealBounty:
      '• **Taglia** — è aperta esattamente una casella per volta. La prima squadra che la completa la chiude, e viene estratta la successiva.',
    revealRotating:
      '• **Rotazione** — {n} caselle restano aperte insieme; le più vecchie scadono man mano che ne escono di nuove. Completatele finché sono lì.',
    revealAll: '• **Aperture** — tutto il tabellone è aperto fin dall’inizio.',
    notRevealed:
      '• **Non ancora svelato** — lo staff apre il tabellone all’inizio dell’evento. Prima nessuno vede le caselle.',
    lockout: '• **Esclusiva** — la prima squadra che completa una casella se la prende. Nessun altro può più segnarla.',
    firstBonus: '• **Bonus primo arrivato** — la prima squadra su una casella guadagna {amount} punti extra.',
    decay:
      '• **Calo** — una casella vale punti pieni quando si apre e scende al {pct}% nell’arco di {hours} ore. Chiudere presto rende di più.',
    growth:
      '• **Crescita** — una casella parte dal valore pieno e sale al {pct}% nell’arco di {hours} ore. Aspettare rende di più.',
    missions:
      '• **Missioni** — obiettivi extra svelati a evento in corso, {when}. Nessuno ne vede una prima che sia annunciata.',
    missionWhenInterval: 'ogni {minutes} minuti',
    missionWhenScheduled: 'secondo un calendario',
    missionWhenManual: 'quando le lancia lo staff',
    missionBonusNote:
      '-# I punti missione sono un **bonus** — si aggiungono al tuo punteggio ma mai al totale del tabellone, quindi il tabellone non può allungarsi a evento in corso.',
    missionAnnouncedCount: '{announced} su {total} annunciate finora.',
    startProofStrict:
      '• **Scatto di partenza** — ogni giocatore consegna uno screenshot dopo l’avvio, in un luogo estratto nel momento della partenza. Finché non consegni il tuo, tutto ciò che invii viene rifiutato.',
    startProofFlag:
      '• **Scatto di partenza** — ogni giocatore consegna uno screenshot dopo l’avvio, in un luogo estratto nel momento della partenza. Finché non consegni il tuo, tutto ciò che invii viene segnalato per revisione.',
    startProofSession:
      '-# Prima disconnettiti e riconnettiti — gli hiscores si salvano solo al logout, quindi il tuo scatto deve stare entro {minutes} minuti da un accesso fresco.',
    teamChoice: '• **Squadre** — scegli la tua squadra quando ti iscrivi; lo staff la approva.',
    captainInvites: '• **Squadre** — i capitani distribuiscono da soli i link d’invito per la propria parte.',
    entryFee: '• **Quota d’iscrizione** — {amount} per iscrizione.',
    prizePool: '• **Montepremi** — {amount} e in crescita a ogni iscrizione approvata.',

    trackingHeading: '**Come ti viene accreditato**',
    trackingPlugin: '• **Con il plugin Anvil** — invia al posto tuo. Non c’è altro da fare che giocare.',
    trackingHiscoresAll:
      '• **Niente plugin?** Ogni casella qui legge dagli **hiscores ufficiali**, quindi non serve alcun client — ma gli hiscores si salvano solo quando **ti disconnetti**, e si aggiornano allo scoccare dell’ora. Gioca → disconnettiti → aspetta l’ora.',
    trackingHiscoresSome:
      '• **Niente plugin?** {n} di queste caselle leggono dagli **hiscores ufficiali**, quindi non serve alcun client — ma gli hiscores si salvano solo quando **ti disconnetti**, e si aggiornano allo scoccare dell’ora. Gioca → disconnettiti → aspetta l’ora.',
    trackingProofAll:
      '• **Drop, kill e prove a tempo** richiedono una prova — qui ogni singola casella. Il plugin la archivia da solo; senza, carichi tu stesso uno screenshot {where}.',
    trackingProofSome:
      '• **Drop, kill e prove a tempo** richiedono una prova — {n} di queste. Il plugin la archivia da solo; senza, carichi tu stesso uno screenshot {where}.',
    trackingWhereUrl: 'su **My Team** all’indirizzo {url}/team',
    trackingWhereNoUrl: 'sulla pagina My Team',
    trackingKeepShot:
      '-# Tieniti comunque uno screenshot tuo di tutto ciò che conta — non costa nulla e chiude qualsiasi discussione.',
  },

  me: {
    title: '👤 {who} — {event}',
    notEnteredTitle: '🔍 Non sei su questo tabellone',
    notEntered: 'Non sei iscritto a **{event}**.',
    notEnteredWhere: 'Iscrizioni e profilo stanno su {url}.',
    onTeam: 'Sei in **{team}**.',
    onTeamRanked: 'Sei in **{team}** — {place} su {total}.',
    noTeamYet: 'Sei iscritto ma non sei ancora in una squadra.',
    finishedHiddenOne: 'Hai completato 1 casella — i nomi compaiono quando il tabellone viene svelato.',
    finishedHiddenMany: 'Hai completato {n} caselle — i nomi compaiono quando il tabellone viene svelato.',
    finishedHeading: '**Caselle che hai completato**',
    nothingYet: 'Non ti è ancora stata accreditata nessuna casella.',
  },

  team: {
    noTeamsTitle: '🔍 Ancora nessuna squadra',
    noTeamsBody: '**{event}** non ha ancora squadre.',
    noMatchTitle: '🔍 Nessuna squadra così',
    noMatch: 'Nessuna squadra di **{event}** corrisponde a "{needle}".',
    noneOfYours: 'Non sei in una squadra — indicane una per consultarla.',
    teamsList: '**Squadre:** {names}',
    standing: '{place} su {total} — {score}{bonus} · {pct}% del tabellone.',
    bonusSuffix: ' (⚡+{n} bonus missione)',
    visitingWholeTeam: '🤝 Un clan in visita: {names}',
    visitingSomeOne: '🤝 1 giocatore in visita: {names}',
    visitingSomeMany: '🤝 {n} giocatori in visita: {names}',
    recentHeading: '**Ultime caselle**',
    hiddenBoard: 'Le caselle di **{event}** non sono ancora svelate — le schede squadra si aprono con il tabellone.',
  },

  apply: {
    title: '📝 {event} — come entrare',
    drafted: '**Ci sei** — già scelto al draft in una squadra. Non resta che giocare.',
    approved: '**Sei iscritto e approvato.** Verrai messo in una squadra prima che l’evento inizi.',
    pending: '**La tua iscrizione è arrivata** e aspetta l’approvazione dello staff. Non serve altro.',
    open: '**Le iscrizioni sono aperte.**',
    notOpenYet: '**Le iscrizioni non sono ancora aperte.**',
    eventStarted: '**L’evento è iniziato**, quindi le iscrizioni sono chiuse. Chiedi allo staff se c’è ancora posto.',
    closed: '**Le iscrizioni sono chiuse.**',
    closesIn: 'Chiudono {when}.',
    opensIn: 'Aprono {when}.',
    fee: 'L’iscrizione costa {amount} — lo staff ti dirà dove mandarli.',
    feePerAccount: 'L’iscrizione costa {amount} per account — lo staff ti dirà dove mandarli.',
    signUpAt: '**Iscriviti:** {url}',
    noAccountUrl:
      '-# Anvil non conosce ancora il tuo account. Collega prima il tuo RSN su {url}/profile — le iscrizioni si attaccano a un account, non a un nome Discord.',
    noAccountNoUrl:
      '-# Anvil non conosce ancora il tuo account. Collega prima il tuo RSN sulla tua pagina profilo — le iscrizioni si attaccano a un account, non a un nome Discord.',
  },

  next: {
    title: '⏭️ {event} — cosa arriva ora',
    eventStarts: '🚩 Inizio evento',
    eventEnds: '🏁 Fine evento',
    nextTile: '🎲 Prossima casella estratta',
    nextMission: '⚡ Prossima missione',
    signupsClose: '📝 Chiusura iscrizioni',
    nothingEnded: 'Niente più sull’orologio — questo tabellone è finito.',
    nothingScheduled: 'Niente in programma. Lo staff lancia la prossima cosa quando la lancia.',
    hiddenMissionsOne: '-# Manca ancora 1 missione, annunciata quando la lancia lo staff.',
    hiddenMissionsMany: '-# Mancano ancora {n} missioni, annunciate quando le lancia lo staff.',
  },

  help: {
    title: '🔨 Cosa può dirti Anvil',
    privateNote:
      '-# Le risposte le vedi solo tu. Usa il pulsante **{share}** sotto una risposta per pubblicarla nel canale.',
    subs: {
      board: 'Il tabellone in corso proprio adesso',
      leaderboard: 'Classifica delle squadre',
      rules: 'Come funziona il tabellone — punteggio, aperture, prove, più le regole della casa',
      apply: 'Come entrare — iscrizioni, quota, e a che punto sei',
      next: 'Cosa arriva — la prossima apertura, missione o scadenza',
      me: 'La tua squadra, le tue caselle, la tua posizione',
      help: 'Cosa può dirti Anvil qui dentro',
      team: 'La scheda di una squadra — punteggio, rosa, ultime caselle',
    },
    command: 'Anvil — guarda il tabellone del clan',
    optionTeamName: 'Nome squadra (lascia vuoto per la tua)',
  },

  rolePanel: {
    modalTitle:
      'Un’ultima cosa',
    modalLabel:
      'Il tuo nome RuneScape',
    modalPlaceholder:
      'Esattamente come appare in gioco',
    granted:
      '✅ Sei stato impostato come **{label}**.',
    optionGone:
      'Quel pulsante è vecchio — chiedi allo staff di ripubblicare il pannello.',
    grantFailed:
      '⚠️ I tuoi ruoli non sono stati applicati. Il ruolo del bot di Anvil deve stare **sopra** quelli che distribuisce — chiedi a un admin di controllare.',
    rsnSaved:
      '📋 Salvato **{rsn}** come tuo nome RuneScape.',
    rsnSavedRenamed:
      '📋 Salvato **{rsn}** come tuo nome RuneScape, e messo il tuo nickname uguale.',
    rsnPending:
      '-# Un moderatore deve ancora confermare che l’account è tuo prima che valga per gli eventi.',
    rsnInvalid:
      'Non sembra un nome RuneScape — da 1 a 12 caratteri, esattamente come in gioco.',
    rsnTaken:
      '**{rsn}** è già collegato a qualcun altro. Se è sbagliato, chiedi a un moderatore di sistemarlo.',
    failed:
      'Anvil non è riuscito a completarlo. Un admin può controllare i log del sito.',
  },

  errors: {
    dm: 'Lanciala nel server Discord del tuo clan — un comando sul tabellone deve sapere quale clan sta chiedendo.',
    wrongGuild:
      'Questo bot è collegato a un server diverso dall’Anvil di **{clan}**. Chiedi a un admin di controllare l’ID del server sotto Integrations.',
    unknownCommand: 'Anvil non risponde a {command} — prova {suggestion}.',
    unknownSub: 'Comando sconosciuto. Prova {list}.',
    noBoards: '**{clan}** non ha ancora tabelloni.',
    noBoardsStaff: 'Lo staff può crearne uno su {url}/admin/events/new.',
    failed: 'Anvil ha incontrato un errore nel rispondere. Un admin può controllare i log del sito.',
    unsupported: 'Quel tipo di interazione non è ancora supportato.',
    shareExpired: 'Quella risposta è troppo vecchia per essere condivisa — rilancia il comando.',
  },
};

export default it;
