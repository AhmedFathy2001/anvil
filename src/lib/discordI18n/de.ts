import type { PartialDiscordDict } from './en';

// Deutsch — German.
//
// Die Befehlsnamen bleiben englisch: wer Deutsch liest, tippt trotzdem `/bingo board`, und ein
// übersetzter Befehlsname ist ein Befehl, den niemand findet. Dasselbe gilt für "Powered by Anvil".
// Alles andere — die Erklärung, die Reihenfolge, das Warum — ist auf Deutsch.

const de: PartialDiscordDict = {
  common: {
    noTeams: '_Noch keine Teams._',
    moreOnSite: '+{n} weitere auf der Website',
    more: '+{n} weitere',
    bonusLegend:
      '⚡ Missionsbonus — zusätzlich zur Brett-Gesamtwertung verdient, zählt also für die Punkte, aber nicht für die Prozentzahl.',
    visitingClansOne: '🤝 {names} ist ein Gastclan — dieses Brett wird geteilt.',
    visitingClansMany: '🤝 {names} sind Gastclans — dieses Brett wird geteilt.',
    visitingPlayersOne: '🤝 1 Spieler ist aus einem anderen Clan zu Gast.',
    visitingPlayersMany: '🤝 {n} Spieler sind aus anderen Clans zu Gast.',
    phaseRunning: 'läuft',
    phaseUpcoming: 'nicht gestartet',
    phaseEnded: 'beendet',
    phaseDraft: 'Entwurf',
    contextVisitingTeamsOne: 'clanübergreifend · 1 Gastteam',
    contextVisitingTeamsMany: 'clanübergreifend · {n} Gastteams',
    contextVisitingPlayersOne: '1 Gastspieler',
    contextVisitingPlayersMany: '{n} Gastspieler',
    shareButton: 'Im Kanal teilen',
    sharedBy: '-# Geteilt von {who}',
    fieldFormat: 'Format',
    fieldTeams: 'Teams',
    fieldPlayers: 'Spieler',
    fieldTilesDone: 'Felder geschafft',
    fieldTeamScore: 'Teampunkte',
    fieldYourTiles: 'Deine Felder',
    fieldAccounts: 'Accounts',
    fieldRank: 'Platz',
    fieldRoster: 'Kader',
    fieldScore: 'Punkte',
  },

  board: {
    starts: 'Beginnt {when}.',
    ends: 'Endet {when}.',
    finished: 'Dieses Brett ist beendet.',
    notScheduled: 'Noch nicht terminiert.',
    hidden: 'Die Felder sind noch verborgen — das Brett öffnet, wenn das Staff-Team es freigibt.',
  },

  leaderboard: { title: '🏆 {event} — Tabelle' },

  rules: {
    title: '📜 {event} — so funktioniert es',
    houseTitle: '📌 {clan} — Hausregeln',
    houseContinues: '**Die Regeln gehen weiter** — vollständig nachzulesen unter',
    houseFull: 'Vollständige Regeln:',
    houseTrimmed: '-# Für Discord gekürzt — frag das Staff-Team nach dem vollständigen Regelwerk.',

    scoringPoints:
      '• **Wertung** — jedes Feld ist seine eigenen Punkte wert; die Teampunktzahl ist die Summe des Geschafften.',
    scoringTiles: '• **Wertung** — ein Punkt pro Feld; die Teampunktzahl ist, wie viele geschafft wurden.',
    tileRace:
      '• **Feldrennen** — das Brett ist eine feste Strecke. Ihr rückt darauf vor; euer weitestes Feld ist eure Position.',
    revealScheduled:
      '• **Freischaltung** — Felder öffnen nach einem vom Staff gesetzten Plan. Ein Feld, das du noch nicht siehst, hat schlicht noch nicht geöffnet.',
    revealIntervalOne: '• **Freischaltung** — alle {minutes} Minuten wird {order} ein Feld gezogen.',
    revealIntervalMany: '• **Freischaltung** — alle {minutes} Minuten werden {order} {n} Felder gezogen.',
    revealOrderRandom: 'zufällig',
    revealOrderBoard: 'in Brettreihenfolge',
    revealBounty:
      '• **Kopfgeld** — es ist genau ein Feld gleichzeitig offen. Das erste Team, das es schafft, schließt es, und das nächste wird gezogen.',
    revealRotating:
      '• **Rotation** — {n} Felder bleiben gleichzeitig offen; ältere laufen aus, während neue gezogen werden. Schafft sie, solange sie offen sind.',
    revealAll: '• **Freischaltung** — das ganze Brett ist von Anfang an offen.',
    notRevealed:
      '• **Noch nicht freigegeben** — das Staff-Team öffnet das Brett zum Eventstart. Vorher sieht niemand die Felder.',
    lockout: '• **Sperre** — das erste Team, das ein Feld schafft, bekommt es. Danach kann es niemand mehr werten.',
    firstBonus: '• **Erstschaffer-Bonus** — das erste Team auf einem Feld erhält {amount} Zusatzpunkte.',
    decay:
      '• **Wertverfall** — ein Feld ist beim Öffnen voll wert und sinkt über {hours} Stunden auf {pct}%. Frühes Schaffen bringt mehr.',
    growth:
      '• **Wertzuwachs** — ein Feld startet beim vollen Wert und steigt über {hours} Stunden auf {pct}%. Warten bringt mehr.',
    missions:
      '• **Missionen** — Zusatzziele, die mitten im Event freigegeben werden, {when}. Vor der Ankündigung sieht sie niemand.',
    missionWhenInterval: 'alle {minutes} Minuten',
    missionWhenScheduled: 'nach Zeitplan',
    missionWhenManual: 'wenn das Staff-Team sie einwirft',
    missionBonusNote:
      '-# Missionspunkte sind ein **Bonus** — sie kommen zu deiner Punktzahl dazu, nie zur Brett-Gesamtwertung, das Brett kann also mitten im Event nicht länger werden.',
    missionAnnouncedCount: 'Bisher {announced} von {total} angekündigt.',
    startProofStrict:
      '• **Startbild** — jeder Spieler reicht einen Screenshot nach dem Start ein, an einem im Startmoment gezogenen Ort. Bis du deinen einreichst, wird alles abgelehnt, was du einsendest.',
    startProofFlag:
      '• **Startbild** — jeder Spieler reicht einen Screenshot nach dem Start ein, an einem im Startmoment gezogenen Ort. Bis du deinen einreichst, wird alles Eingesendete zur Prüfung markiert.',
    startProofSession:
      '-# Vorher aus- und wieder einloggen — die Hiscores speichern nur beim Logout, dein Bild muss also innerhalb von {minutes} Minuten nach einem frischen Login entstehen.',
    teamChoice: '• **Teams** — du wählst dein Team bei der Anmeldung; das Staff-Team bestätigt es.',
    captainInvites: '• **Teams** — die Kapitäne verteilen selbst Einladungslinks für ihre eigene Seite.',
    entryFee: '• **Startgeld** — {amount} pro Anmeldung.',
    prizePool: '• **Preistopf** — {amount}, und er wächst mit jeder bestätigten Anmeldung.',

    trackingHeading: '**So wird dir etwas gutgeschrieben**',
    trackingPlugin: '• **Mit dem Anvil-Plugin** — es reicht für dich ein. Du musst nichts tun außer spielen.',
    trackingHiscoresAll:
      '• **Kein Plugin?** Jedes Feld hier liest aus den **offiziellen Hiscores**, braucht also überhaupt keinen Client — aber die Hiscores speichern nur, wenn du dich **ausloggst**, und aktualisieren zur vollen Stunde. Spielen → ausloggen → auf die volle Stunde warten.',
    trackingHiscoresSome:
      '• **Kein Plugin?** {n} dieser Felder lesen aus den **offiziellen Hiscores**, brauchen also überhaupt keinen Client — aber die Hiscores speichern nur, wenn du dich **ausloggst**, und aktualisieren zur vollen Stunde. Spielen → ausloggen → auf die volle Stunde warten.',
    trackingProofAll:
      '• **Drops, Kills und Zeitaufgaben** brauchen einen Nachweis — hier jedes einzelne Feld. Das Plugin legt ihn automatisch ab; ohne es lädst du selbst einen Screenshot hoch {where}.',
    trackingProofSome:
      '• **Drops, Kills und Zeitaufgaben** brauchen einen Nachweis — {n} davon. Das Plugin legt ihn automatisch ab; ohne es lädst du selbst einen Screenshot hoch {where}.',
    trackingWhereUrl: 'unter **My Team** auf {url}/team',
    trackingWhereNoUrl: 'auf der Seite My Team',
    trackingKeepShot:
      '-# Mach so oder so einen eigenen Screenshot von allem Großen — er kostet nichts und beendet jede Diskussion.',
  },

  me: {
    title: '👤 {who} — {event}',
    notEnteredTitle: '🔍 Nicht auf diesem Brett',
    notEntered: 'Du bist bei **{event}** nicht angemeldet.',
    notEnteredWhere: 'Anmeldung und dein Profil liegen auf {url}.',
    onTeam: 'Du bist bei **{team}**.',
    onTeamRanked: 'Du bist bei **{team}** — {place} von {total}.',
    noTeamYet: 'Du bist angemeldet, aber noch keinem Team zugeteilt.',
    finishedHiddenOne: 'Du hast 1 Feld geschafft — die Namen erscheinen, sobald das Brett freigegeben ist.',
    finishedHiddenMany: 'Du hast {n} Felder geschafft — die Namen erscheinen, sobald das Brett freigegeben ist.',
    finishedHeading: '**Von dir geschaffte Felder**',
    nothingYet: 'Dir ist noch kein Feld gutgeschrieben.',
  },

  team: {
    noTeamsTitle: '🔍 Noch keine Teams',
    noTeamsBody: 'Bei **{event}** gibt es noch keine Teams.',
    noMatchTitle: '🔍 Kein solches Team',
    noMatch: 'Kein Team bei **{event}** passt zu "{needle}".',
    noneOfYours: 'Du bist in keinem Team — nenne eines, um es nachzuschlagen.',
    teamsList: '**Teams:** {names}',
    standing: '{place} von {total} — {score}{bonus} · {pct}% des Bretts.',
    bonusSuffix: ' (⚡+{n} Missionsbonus)',
    visitingWholeTeam: '🤝 Ein Gastclan: {names}',
    visitingSomeOne: '🤝 1 Gastspieler: {names}',
    visitingSomeMany: '🤝 {n} Gastspieler: {names}',
    recentHeading: '**Zuletzt geschaffte Felder**',
    hiddenBoard: 'Die Felder von **{event}** sind noch nicht freigegeben — Teamkarten öffnen mit dem Brett.',
  },

  apply: {
    title: '📝 {event} — so kommst du rein',
    drafted: '**Du bist dabei** — bereits in ein Team gedraftet. Bleibt nur noch spielen.',
    approved: '**Du bist angemeldet und bestätigt.** Du wirst vor dem Eventstart einem Team zugeteilt.',
    pending: '**Deine Anmeldung liegt vor** und wartet auf die Bestätigung durch das Staff-Team. Mehr ist nicht zu tun.',
    open: '**Die Anmeldung ist offen.**',
    notOpenYet: '**Die Anmeldung hat noch nicht geöffnet.**',
    eventStarted: '**Das Event hat begonnen**, die Anmeldung ist also geschlossen. Frag das Staff-Team, ob noch Platz ist.',
    closed: '**Die Anmeldung ist geschlossen.**',
    closesIn: 'Sie schließt {when}.',
    opensIn: 'Sie öffnet {when}.',
    fee: 'Die Teilnahme kostet {amount} — das Staff-Team sagt dir, wohin damit.',
    feePerAccount: 'Die Teilnahme kostet {amount} pro Account — das Staff-Team sagt dir, wohin damit.',
    signUpAt: '**Anmelden:** {url}',
    noAccountUrl:
      '-# Anvil kennt deinen Account noch nicht. Verknüpfe zuerst deinen RSN auf {url}/profile — Anmeldungen hängen an einem Account, nicht an einem Discord-Namen.',
    noAccountNoUrl:
      '-# Anvil kennt deinen Account noch nicht. Verknüpfe zuerst deinen RSN auf deiner Profilseite — Anmeldungen hängen an einem Account, nicht an einem Discord-Namen.',
  },

  next: {
    title: '⏭️ {event} — was als Nächstes kommt',
    eventStarts: '🚩 Event beginnt',
    eventEnds: '🏁 Event endet',
    nextTile: '🎲 Nächstes Feld wird gezogen',
    nextMission: '⚡ Nächste Mission',
    signupsClose: '📝 Anmeldung schließt',
    nothingEnded: 'Nichts mehr auf der Uhr — dieses Brett ist beendet.',
    nothingScheduled: 'Nichts geplant. Das Staff-Team wirft das Nächste ein, wenn es soweit ist.',
    hiddenMissionsOne: '-# 1 Mission steht noch aus, angekündigt sobald das Staff-Team sie einwirft.',
    hiddenMissionsMany: '-# {n} Missionen stehen noch aus, angekündigt sobald das Staff-Team sie einwirft.',
  },

  help: {
    title: '🔨 Das kann Anvil dir sagen',
    privateNote:
      '-# Die Antworten sieht nur du. Nutze den Button **{share}** unter einer Antwort, um sie im Kanal zu posten.',
    subs: {
      board: 'Das Brett, das gerade läuft',
      leaderboard: 'Teamtabelle',
      rules: 'So funktioniert das Brett — Wertung, Freischaltung, Nachweise und die Hausregeln des Clans',
      apply: 'So kommst du rein — Anmeldung, Startgeld und dein Stand',
      next: 'Was kommt — die nächste Freischaltung, Mission oder Frist',
      me: 'Dein Team, deine Felder, dein Platz',
      help: 'Was Anvil dir hier drin sagen kann',
      team: 'Die Karte eines Teams — Punkte, Kader, letzte Felder',
    },
    command: 'Anvil — das Clanbrett ansehen',
    optionTeamName: 'Teamname (leer lassen für dein eigenes Team)',
  },

  errors: {
    dm: 'Führ das im Discord-Server deines Clans aus — ein Brettbefehl muss wissen, welcher Clan fragt.',
    wrongGuild:
      'Dieser Bot ist mit einem anderen Server verbunden als dem Anvil von **{clan}**. Bitte einen Admin, die Server-ID unter Integrations zu prüfen.',
    unknownCommand: 'Anvil beantwortet {command} nicht — versuch {suggestion}.',
    unknownSub: 'Unbekannter Befehl. Versuch {list}.',
    noBoards: '**{clan}** hat noch keine Bretter.',
    noBoardsStaff: 'Das Staff-Team kann eins unter {url}/admin/events/new anlegen.',
    failed: 'Anvil ist bei der Antwort auf einen Fehler gestoßen. Ein Admin kann die Logs der Website prüfen.',
    unsupported: 'Diese Interaktionsart wird noch nicht unterstützt.',
    shareExpired: 'Diese Antwort ist zu alt zum Teilen — führ den Befehl noch einmal aus.',
  },
};

export default de;
