import type { PartialGuideDict } from './en';

// Deutsch — German.
//
// Gleiche Konvention wie in allen anderen Sprachdateien hier: alles, was der Leser tatsächlich AUF
// DEM BILDSCHIRM SIEHT, bleibt auf Englisch — Menüs in RuneLite und OBS, die Chatzeilen des Plugins
// selbst, und Anvils eigene Admin-Beschriftungen, die englisch sind, bis auch jene Oberfläche
// übersetzt wird. Ein übersetztes „Tracked drop detected“ ist eine Zeile, die niemand wiederfindet.
// Alles andere — die Erklärung, die Reihenfolge, das Warum — ist deutsch.

const de: PartialGuideDict = {
  common: {
    contents: 'Inhalt',
    step: 'Schritt',
    optional: 'optional',
    minRead: '{n} Min. Lesezeit',
    language: 'Sprache',
    partialNotice:
      'Diese Anleitung ist nur teilweise ins {language} übersetzt. Was noch nicht übersetzt ist, erscheint auf Englisch.',
    backToGuides: 'Alle Anleitungen',
    unreviewedNotice:
      'Diese Übersetzung ins {language} wurde noch von keinem Muttersprachler gegengelesen. Wenn sich ein Satz falsch liest, ist [die englische Seite]({englishHref}) das Original — und [uns Bescheid zu geben](/feedback) ist das, was ihn korrigiert.',
  },

  index: {
    metaTitle: 'Anleitungen — Anvil',
    metaDescription:
      'Der Einstieg in Anvil: das RuneLite-Plugin für Spieler, ein Event für das Clan-Team durchführen, und einen Gastclan ausrichten.',
    title: 'Anleitungen',
    dek: 'Alles, was du zum Einstieg brauchst, geschrieben für genau die Anvil-Version, die hier läuft.',
    groups: {
      playing: 'Spielen',
      running: 'Ein Event durchführen',
      clan: 'Den Clan führen',
    },
    cards: {
      plugin: {
        eyebrow: 'Für Spieler',
        title: 'RuneLite-Plugin einrichten',
        blurb:
          'Plugin installieren, mit dieser Seite verbinden, und deine Drops von ihm einreichen lassen. Deckt auch Discord-Benachrichtigungen und OBS-Clips ab.',
        minutes: '~3 Min. Einrichtung',
      },
      board: {
        eyebrow: 'Für Board-Bauer',
        title: 'Ein Board bauen, das sich selbst verfolgt',
        blurb:
          'Was jede Feldart tatsächlich sehen kann, Massenpflege per Tabelle, und die Fehler, die sauber importieren und dann nie auslösen.',
        minutes: '~8 Min.',
      },
      captain: {
        eyebrow: 'Für Kapitäne',
        title: 'Kapitänsanleitung',
        blurb:
          'Den Pool lesen, bevor die Uhr läuft, der Drafttag selbst, und die Teile der Teamführung, die erst danach beginnen.',
        minutes: '~6 Min.',
      },
      formats: {
        eyebrow: 'Für das Clan-Team',
        title: 'Formate, und wie Felder aufgehen',
        blurb:
          'Sieben Boardformen, fünf Arten, wie Felder spielbar werden, und die drei Modifikatoren, die den Wert einer Erledigung bestimmen.',
        minutes: '~5 Min.',
      },
      fees: {
        eyebrow: 'Für Kassenwarte',
        title: 'Gebühren und Auszahlungen',
        blurb:
          'Eine Teilnahmegebühr erheben, sie einsammeln, die zweite Unterschrift, die sie abschließt, und aus einem Topf bezahlte Platzierungen machen.',
        minutes: '~5 Min.',
      },
      moderator: {
        eyebrow: 'Für Moderatoren',
        title: 'Im Dienst',
        blurb:
          'Die Warteschlange, das Prüfen von Nachweisen und Accounts, die Mitgliederliste ehrlich halten, und die Ermessensfragen, die bei einem Menschen landen.',
        minutes: '~5 Min.',
      },
      admin: {
        eyebrow: 'Für das Clan-Team',
        title: 'So führst du dein erstes Event durch',
        blurb:
          'Discord, Mitgliederliste, Boards, Felder, Teams und Draft, Start — und was du tust, wenn das Event vorbei ist.',
        minutes: 'ein Abend, einmalig',
      },
      clanVsClan: {
        eyebrow: 'Für Ausrichter',
        title: 'Einen Gastclan ausrichten',
        blurb:
          'Clan gegen Clan, ohne einen einzigen RSN von Hand einzusammeln: ein Einladungslink pro Team, und ein Platz, mit dem deren eigener Moderator die eigene Hälfte führt.',
        minutes: '~5 Min. pro Team',
      },
    },
  },

  plugin: {
    metaTitle: 'RuneLite-Plugin einrichten — Anvil',
    metaDescription:
      'Installiere Anvils RuneLite-Plugin, verbinde es mit dieser Seite, und richte Discord-Benachrichtigungen und OBS-Clips ein.',
    eyebrow: 'Anvil · RuneLite-Plugin',
    title: 'Einrichtungsanleitung für Spieler',
    dek: 'Installieren, auf {clanName} richten, spielen. Das Plugin reicht deine Bingo-Drops ein, postet deine seltenen Drops und Tode auf Discord und — wenn du OBS nutzt — speichert und postet Clips der Momente, die ein zweites Ansehen wert sind.',
    facts: [
      { strong: '2 Felder', rest: 'und die Erfassung läuft' },
      { strong: '~3 Min.', rest: 'für die Grundeinrichtung' },
      { strong: 'Clips', rest: 'brauchen OBS + 5 weitere Minuten' },
    ],
    footnote:
      'Die Screenshots stammen aus einer echten Einrichtung — Account-Token, OBS-Adresse und Discord-Webhook sind absichtlich unkenntlich gemacht. Deine sollten genauso privat bleiben.',

    install: {
      title: 'Plugin installieren',
      body: [
        'In RuneLite: **Configuration** (der Schraubenschlüssel) → **Plugin Hub** → nach **Anvil** suchen → **Install**. Der Herausgeber ist `AhmedFathy2001`.',
        'Ein Plugin bedient alle Clans — du richtest es im nächsten Schritt auf diese Seite, es gibt also nichts clanspezifisches herunterzuladen. Nach der Installation öffnest du **Configuration → Anvil**, um an das Einstellungsfenster zu kommen, das in dieser Anleitung durchgehend gezeigt wird.',
      ],
    },

    connect: {
      title: 'Mit dieser Seite verbinden',
      intro: 'Nur der Abschnitt **Setup** ist für den Start wichtig. Alles andere hat sinnvolle Standardwerte.',
      figure: {
        caption: 'Configuration → Anvil → Setup',
        alt: 'Der Setup-Abschnitt des Anvil-Plugins, mit umrahmten Feldern Site URL und Account Token',
        legend: [
          {
            label: 'Site URL',
            body: 'für {clanName} ist das `{origin}`. Das Feld kommt leer, du musst es also ausfüllen. Ein abschließender Schrägstrich ist nicht nötig, und `https://` wird ergänzt, wenn du es weglässt.',
          },
          {
            label: 'Account Token',
            body: 'dein persönlicher Schlüssel zu dieser Seite. Entweder lässt du ihn das Plugin für dich ausfüllen (unten), oder du fügst ihn selbst ein. Behandle ihn wie ein Passwort.',
          },
        ],
      },
      easyHeading: 'Der einfache Weg: aus dem Plugin heraus anmelden',
      easyIntro:
        'Mit gesetzter Site URL und noch leerem Token zeigt das **Anvil-Seitenpanel** eine Schaltfläche **Sign in with Discord**. Klick sie an, und das Plugin führt dich hindurch — ohne dass du irgendetwas kopierst.',
      easySteps: [
        'Das Panel zeigt einen Code und öffnet deinen Browser auf dieser Seite.',
        'Prüfe, dass der Code auf der Seite mit dem in RuneLite übereinstimmt, und klicke dann **Approve**.',
        'Das Panel meldet _Signed in_ und füllt den Account Token für dich aus.',
      ],
      linkFigure: {
        caption: 'Diese Seite → /link-device',
        alt: 'Die Seite Link your RuneLite client, mit umrahmtem Codefeld und Approve-Schaltfläche',
        legend: [
          { label: 'Der Code', body: 'er muss mit dem übereinstimmen, was dir das Plugin gerade anzeigt.' },
          {
            label: 'Approve',
            body: 'bestätige nur einen Code, den _dein eigener_ Client anzeigt. Hat dir jemand einen Link oder einen Code geschickt, lehne ihn ab — bestätigen hieße, ihm deinen Account zu übergeben.',
          },
        ],
      },
      brokeredNote: {
        tag: 'Warum eine zweite Domain auftaucht',
        body: [
          'Die Bestätigung passiert hier, auf `{origin}`. Wenn du noch nicht auf der Seite angemeldet bist, läuft der Anmeldeschritt über Anvils gemeinsame Discord-Anmeldung auf `anvilosrs.com`, um deine Discord-Identität zu bestätigen, und bringt dich dann direkt hierher zurück — das ist dieselbe Anmeldung, die dir die Login-Schaltfläche dieser Seite gibt, kein Teil des Plugin-Ablaufs.',
          'Das Plugin selbst spricht nur mit `{origin}`: es weigert sich, eine Anmeldeseite zu öffnen, die nicht auf der von dir eingetragenen Site URL liegt.',
        ],
      },
      directNote: {
        tag: 'Wo das passiert',
        body: [
          'Der gesamte Ablauf bleibt auf `{origin}` — der Code wird hier ausgestellt, hier mit {clanName}s eigener Discord-Anmeldung bestätigt, und der Token wird hier zurückgegeben. Das Plugin weigert sich, eine Anmeldeseite zu öffnen, die nicht auf der eingetragenen Site URL liegt, also erreicht in diesem Schritt nichts eine andere Anvil-Installation.',
        ],
      },
      federationAside:
        'Nicht zu verwechseln mit **Connect clans** im Seitenpanel — das ist die separate, freiwillige Schaltfläche, die dich mit anderen Anvil-Clans verbindet, und sie erscheint erst, wenn du hier bereits angemeldet bist.',
      manualFallback:
        'Öffnet sich der Browser nicht von selbst, gibt das Panel Adresse und Code aus, damit du sie manuell öffnen kannst. Codes laufen nach zehn Minuten ab — drück einfach noch mal auf die Schaltfläche.',
      manualHeading: 'Der manuelle Weg: Token kopieren',
      manualIntro:
        'Melde dich mit Discord an und öffne [Profile](/profile), scrolle dann zur Karte **RuneLite plugin**.',
      tokenFigure: {
        caption: 'Profile → RuneLite plugin',
        alt: 'Die Karte RuneLite plugin auf der Profilseite, mit umrahmtem Tokenfeld und den Schaltflächen Reveal, Copy und Rotate',
        legend: [
          {
            label: 'Dein Token',
            body: 'verborgen, bis du Reveal drückst. Er ist auf diesem Screenshot absichtlich unkenntlich; poste deinen eigenen niemals in Discord.',
          },
          {
            label: 'Copy / Rotate',
            body: 'kopiere ihn in das Account-Token-Feld des Plugins. Rotate stellt einen neuen aus und macht den alten ungültig — nutze das, wenn du je vermutest, dass dein Token abhandengekommen ist.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Gut zu wissen',
        body: ['Ein Token deckt jedes Event ab, für das du hier angemeldet bist — du fügst ihn nie pro Bingo neu ein.'],
      },
    },

    accounts: {
      title: 'Accounts verknüpfen — einfach spielen',
      body: [
        'Es gibt keinen Verknüpfungscode einzutippen. Sobald der Token drin ist, wird der Account, mit dem du dich einloggst, automatisch deinem Profil zugeordnet.',
        'Das Plugin schickt deinen Namen im Spiel plus einen stabilen Account-Fingerabdruck bei jeder Anfrage mit, und die Seite gleicht zuerst über den Fingerabdruck ab — deine Verknüpfungen überleben also eine Namensänderung. Logge dich einmal auf einem Zweitaccount ein, und er erscheint in deinem Profil unter _Accounts we noticed you playing_ mit einem **Add** in einem Klick.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'Die Karte RuneScape Accounts auf der Profilseite mit den per Plugin verifizierten Accounts',
        legend: [
          {
            label: 'Deine verknüpften Accounts',
            body: 'alles mit „Verified via plugin“ ist allein durchs Spielen dorthin gelangt. Füge so viele Zweitaccounts hinzu, wie du willst; einer davon ist dein Hauptaccount.',
          },
        ],
      },
      noPluginHeading: 'Kannst du das Plugin nicht nutzen?',
      noPluginIntro:
        'Auf Mobilgeräten oder im offiziellen Client verknüpfst du den Account stattdessen auf der Website — die Profilseite zeigt beide Wege:',
      noPluginOptions: [
        '**Verify by XP** — gib deinen RSN ein, die Seite wählt einen zufälligen Skill, und du musst darin innerhalb von 30 Minuten 1.000 XP sammeln.',
        '**Manual review** — für verborgene Hiscores oder brandneue Zweitaccounts: reiche deinen RSN mit einer Notiz ein, und ein Moderator bestätigt ihn.',
      ],
      signupNote:
        'Für die Event-Anmeldung braucht es mindestens einen verifizierten Account, erledige das also, bevor du dich anmeldest.',
    },

    working: {
      title: 'Prüfen, ob es läuft',
      intro:
        'Melde dich an und lies dein Chatfenster. Das Plugin begrüßt dich, wenn es verbunden ist und ein Event läuft.',
      chat: [
        { text: 'Bingo running: Summer Bingo 2026.', tone: 'gold' },
        { text: 'Skill of the Week is live: Runecraft.', tone: 'gold' },
        { text: '…später, wenn Dinge passieren…', tone: 'muted' },
        { text: 'Tracked drop detected: Dragon warhammer (1/1)', tone: 'plain' },
        { text: 'Tracked kill: Zulrah (7/10)', tone: 'plain' },
      ],
      outro:
        'Du solltest außerdem sehen, wie sich das **Anvil-Seitenpanel** mit deinem Event, deinem Team und deinem Feldfortschritt füllt — und wie ein **Bingo**-Reiter im Collection Log im Spiel auftaucht.',
      guestNote: {
        tag: 'Gast oder Mitglied',
        body: 'Sagt der Chat _Tracked as a guest_, wirst du erfasst, stehst aber noch nicht auf der Clan-Mitgliederliste. Das behebt ein Admin, indem er die Mitgliederliste aus dem Spiel synchronisiert — frag {discordLink}.',
        discordWord: 'in Discord',
      },
    },

    bingo: {
      title: 'Bingo-Einstellungen',
      intro:
        'Die sind nur relevant, solange du in einem Event bist. Die Standardwerte sind in Ordnung — hier steht, was jede einzelne tatsächlich tut.',
      figure: {
        caption: 'Configuration → Anvil → Bingo',
        alt: 'Der Bingo-Abschnitt der Plugin-Konfiguration mit umrahmten und nummerierten Einstellungen',
        legend: [
          {
            label: 'Auto Submit Drops',
            body: 'macht einen Screenshot und reicht einen erfassten Drop in dem Moment ein, in dem er fällt. Lass das an; darum geht es im Kern.',
          },
          {
            label: 'Show Overlay',
            body: 'zeichnet ein kleines Panel mit _Anvil / Team / UTC-Datum_ oben links. Es wird Teil des Bildes in deinen Nachweis-Screenshots, und genau das macht einen Nachweis schwer zu fälschen oder rückzudatieren. Auf diesem Screenshot ist es aus — schalte es ein, wenn dein Clan Team und Zeit auf jedem Nachweis sehen will.',
          },
          {
            label: 'Team completion popups',
            body: 'ein Banner, wenn jemand aus deinem Team ein Feld abschließt. Mehrere gleichzeitig: das schwerste bekommt das Banner, der Rest geht in den Chat.',
          },
          {
            label: 'Bingo tab in Collection Log',
            body: 'legt dein Board in das Collection Log im Spiel, neben deine gespeicherten Nachweise.',
          },
          {
            label: 'Banner sound + volume',
            body: 'spielt einen Ton zum Banner. Es passiert nichts, bis du selbst mindestens eine .wav-Datei hinzufügst, über die Schaltfläche „Banner sounds“ in diesem Bingo-Reiter.',
          },
          {
            label: 'Two-frame drop proof',
            body: 'backt ein paar Sekunden später ein zweites Bild in den Screenshot ein, wenn sich der Loot auf dem Boden gelegt hat. Lass es an; es erspart Diskussionen.',
          },
        ],
      },
      startHeading: 'Startaufnahme',
      startBody: [
        'Manche Events verlangen von allen eine **Startaufnahme**: einen Screenshot, aufgenommen nachdem das Event begonnen hat, an einem Ort, der im Startmoment ausgelost wird. Das verhindert, dass jemand die Woche vor dem Event damit verbringt, Clues, Kisten und Kills zu horten, um sie am ersten Tag abzuladen.',
        'Wenn du das Plugin nutzt, gibt es nichts vorzubereiten. Beim Eventstart bekommst du eine Chatzeile, die dir sagt, wohin du gehen sollst, und das Anvil-Seitenpanel zeigt eine Schaltfläche **Take starting shot**. Stell dich dorthin, drück einmal, und fertig — das Plugin nimmt das Bild auf, stempelt deinen RSN, dein Team, den Ort und ein Kennwort darauf, das nur dein Account bekommt, und legt es für dich ab.',
        'Zwei Dinge prüft es, bevor es irgendetwas ablegt, damit du sie im Spiel behebst statt hinterher in einem Discord-Streit. Hat der Ausrichter den Ort auf der Karte markiert, weiß das Plugin, wie weit du entfernt bist, und sagt es dir, statt ein Bild von der falschen Seite Gielinors zu schicken. Und verlangt das Event eine frische Sitzung, musst du dich vorher **aus- und wieder einloggen**: deine Hiscores werden nur beim Ausloggen gespeichert, ein Relog kurz vor der Aufnahme ist also das, was deine Startwerte — und damit jedes XP- und KC-Feld — korrekt macht.',
        'Auf dem Handy oder ohne Plugin: öffne **My Team** auf dieser Seite, lies dein Kennwort auf der Startaufnahme-Karte ab, tippe es ins Spielchat-Fenster, mache einen Screenshot, auf dem sowohl dein Charakter als auch das Kennwort zu sehen sind, und lade ihn auf derselben Karte hoch. Der Upload zählt sofort — du kannst spielen, sobald er drin ist, und das Team prüft ihn im Nachhinein. Logge dich vorher aus und wieder ein, wenn die Karte dich dazu auffordert.',
      ],
    },

    notifications: {
      title: 'Discord-Benachrichtigungen',
      intro:
        'Die werden verschickt, egal ob gerade ein Bingo läuft, und landen in den Kanälen des Clans. Welcher Kanal, legen die Admins hier fest — du wählst nur, _was_ du postest.',
      dropsFigure: {
        caption: 'Deaths & kills · Drops & pets',
        alt: 'Die Benachrichtigungsabschnitte Deaths and kills und Drops and pets mit umrahmten und nummerierten Einstellungen',
        legend: [
          {
            label: 'Notify on death',
            body: 'postet im Todeskanal des Clans, mit einem Screenshot des Moments, in dem du gestorben bist.',
          },
          { label: 'Death message', body: 'deine eigene Zeile. `{name}` wird durch deinen RSN ersetzt.' },
          {
            label: 'Notify on PvP kill',
            body: 'ein Screenshot des Ticks, in dem dein Ziel auf 0 HP fällt. Standardmäßig aus; hier an.',
          },
          { label: 'Notify on rare drops', body: 'der Hauptschalter für Drop-Posts.' },
          {
            label: 'Min drop value / Min drop rarity',
            body: 'zwei unabhängige Wege zu einem Post: mindestens so viel wert (GE oder High Alch, was höher ist), oder seltener als 1 zu N (standardmäßig 1/10.000 — lockerere Werte füllen den Kanal mit Kräuterwürfen). Dein Clan kann eine Seltenheitsgrenze setzen, die für alle gilt; deine eigene greift trotzdem, wenn sie strenger ist. Setze einen der beiden auf 0, um diesen Weg abzuschalten.',
          },
          { label: 'Screenshot rare drops', body: 'das Bild anhängen, nicht nur den Text.' },
          {
            label: 'Loot key value',
            body: 'ein Loot Key wird einmal gepostet, als eine einzige Benachrichtigung, wenn sein gesamter Inhalt diese Zahl übersteigt.',
          },
          { label: 'Notify on pets + Screenshot pets', body: 'Pets landen im Kanal für seltene Drops.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · levels · diaries · quests',
        alt: 'Der Benachrichtigungsabschnitt Combat achievements mit umrahmten und nummerierten Einstellungen',
        legend: [
          { label: 'Notify on combat achievements', body: 'abgeschlossene Stufen werden immer gepostet, solange das an ist.' },
          {
            label: 'CA task min tier',
            body: 'wie laut einzelne Aufgaben sind. Hier Elite; Standard ist Master. Stell es auf Grandmaster, wenn nur die seltensten durchsollen.',
          },
          {
            label: 'Notify on 99s & high totals',
            body: '99er, alle 100 Gesamtlevel ab 1800 aufwärts, und Max.',
          },
          { label: 'Notify on diary completions', body: 'Stufen der Achievement Diaries.' },
          {
            label: 'Announce quest completions',
            body: 'ab der Schwierigkeit, die du wählst, aufwärts. Hier „All quests“; Standard ist Master und höher.',
          },
        ],
      },
    },

    clips: {
      title: 'Clips mit OBS',
      intro: [
        'Eine Taste drücken, und die letzten 30 Sekunden werden gespeichert und im Clip-Kanal des Clans abgelegt. Standardmäßig aus und braucht ein laufendes OBS — aber es ist das Nächste an einem Highlight-Video, das dein Clan bekommen wird.',
        'So funktioniert es: OBS hält einen rollenden **Replay Buffer** der letzten X Sekunden vor. Deine Tastenkombination weist OBS an, diesen Puffer in eine Datei zu schreiben, und das Plugin greift die Datei ab und lädt sie an einen Discord-Webhook hoch, den du einfügst.',
      ],
      privacyNote: {
        tag: 'Wohin dein Video geht',
        body: 'Clips werden **direkt von deinem PC zu Discord** hochgeladen. Sie laufen nie über diese Seite, und es wird überhaupt nichts hochgeladen, wenn du das Webhook-Feld leer lässt — dann bleiben die Clips auf deinem Rechner.',
      },
      obsHeading: 'A. OBS einrichten (einmalig)',
      obsSteps: [
        'Du brauchst **OBS Studio 28 oder neuer** — der WebSocket-Server ist ab 28 eingebaut, kein zusätzlicher Download.',
        'Stell sicher, dass OBS das Spiel wirklich aufnimmt: eine Game- / Window- / Display-Capture-Quelle, die RuneLite zeigt. Sieht OBS deinen Client nicht, werden deine Clips ein schwarzes Rechteck.',
        '**Settings → Output** → **Enable Replay Buffer** anhaken. (Im Simple-Output-Modus liegt es auf der Recording-Seite; im Advanced-Modus hat es einen eigenen Reiter.) Prüfe bei der Gelegenheit, ob auf deinem Aufnahmepfad Platz ist.',
        '**Tools → WebSocket Server Settings** → **Enable WebSocket server** anhaken. Notiere den **Server Port** (standardmäßig 4455) und klicke **Show Connect Info** für das Passwort.',
      ],
      obsAside:
        'Du musst „Start Replay Buffer“ _nicht_ drücken — das Plugin startet ihn beim Verbinden für dich und startet ihn neu, sobald du die Cliplänge änderst.',
      fillHeading: 'B. Das Plugin ausfüllen',
      figure: {
        caption: 'Configuration → Anvil → Clips',
        alt: 'Der Clips-Abschnitt der Plugin-Konfiguration mit umrahmten und nummerierten Einstellungen; OBS-Host und Webhook-URL sind verborgen',
        legend: [
          { label: 'Enable clip capture', body: 'der Hauptschalter. Ist er aus, spricht das Plugin überhaupt nicht mit OBS.' },
          {
            label: 'Capture clip hotkey',
            body: 'setze sie, sonst passiert nie etwas. Wähle etwas, das du mitten im Raid nicht versehentlich triffst.',
          },
          {
            label: 'OBS host / port / password',
            body: '`localhost`, wenn OBS auf demselben PC läuft wie RuneLite. Läuft OBS auf einem anderen Rechner, trage hier dessen lokale IP ein — auf diesem Screenshot verborgen — und lass den Port durch dessen Firewall. Port und Passwort stammen aus _Show Connect Info_; lass das Passwort leer, wenn du die OBS-Authentifizierung abgeschaltet hast.',
          },
          {
            label: 'Max auto-post size (MB)',
            body: 'alles Größere wird lokal gespeichert und im Chat beiläufig erwähnt, statt gepostet zu werden. Stell es auf das ein, was dein Discord-Server tatsächlich akzeptiert; das Plugin kommt mit 25.',
          },
          {
            label: 'Clip length (seconds)',
            body: 'wie weit jeder Clip zurückreicht. Das schreibt die Pufferlänge in dein OBS-Profil, OBS braucht also so viele Sekunden Vorlauf, bevor ein Clip in voller Länge überhaupt existiert. Längere Clips = größere Dateien; 30 ist ein guter Mittelweg.',
          },
          {
            label: 'Save clips as MP4',
            body: 'MP4 wird in Discord direkt als Vorschau angezeigt und abgespielt; MKV muss erst heruntergeladen werden. Beachte, dass das OBS’ Aufnahmeformat ändert, was auch deine normalen Aufnahmen betrifft. Schalte es aus, um OBS in Ruhe zu lassen.',
          },
          {
            label: 'Clips Discord webhook URL',
            body: 'wohin Clips gepostet werden — frag einen Admin nach dem Webhook des Clip-Kanals. Leer = Clips bleiben auf deinem PC. Hier verborgen, und zu Recht: jeder mit dieser URL kann in diesen Kanal posten.',
          },
          {
            label: 'Post OBS-triggered clips too',
            body: 'behandelt auch Speicherungen, die OBS selbst oder das Plugin „Save Replay Buffer for OBS“ auslöst. Lass es aus, wenn du zwei RuneLite-Clients gegen ein OBS laufen lässt, sonst wird jeder Clip doppelt gepostet.',
          },
        ],
      },
      useHeading: 'C. Benutzen',
      useIntro: 'Etwas Lustiges passiert → deine Tastenkombination drücken → der Chat führt dich hindurch:',
      useChat: [
        { text: 'Saving clip...', tone: 'plain' },
        { text: 'Uploading clip to the clan Discord...', tone: 'plain' },
        { text: 'Clip posted to the clan Discord.', tone: 'green' },
      ],
      reminder: {
        tag: 'Denk dran',
        body: 'Der Clip erfasst die Sekunden _vor_ dem Tastendruck — drück also nach dem Moment, nicht währenddessen. Du hast die Länge deines Puffers, um zu reagieren.',
      },
      decodedHeading: 'Clip-Meldungen, übersetzt',
      decoded: [
        {
          term: '`Clip capture: OBS isn’t connected.`',
          body: 'OBS läuft nicht, der WebSocket-Server ist aus, oder Host/Port/Passwort passen nicht. Behebe es und drück noch mal — das Plugin versucht die Verbindung alle 30 Sekunden von selbst erneut.',
        },
        {
          term: '`OBS could not save the clip — is the Replay Buffer started?`',
          body: 'Der Puffer läuft nicht. Prüfe Enable Replay Buffer in den Output-Einstellungen von OBS und schalte dann Enable clip capture aus und wieder ein.',
        },
        {
          term: '`Clip saved locally — paste a Clips Discord webhook URL…`',
          body: 'Funktioniert wie vorgesehen, du hast nur keinen Webhook gesetzt. Die Datei liegt in deinem OBS-Aufnahmeordner.',
        },
        {
          term: '`Clip saved locally (48MB) — too big to auto-post.`',
          body: 'Verkürze die Cliplänge, senke die Qualität deiner OBS-Aufnahme, oder erhöhe die Maximalgröße, wenn dein Server größere Dateien annimmt.',
        },
        {
          term: '`…but Discord didn’t accept the upload.`',
          body: 'Zu groß, rate-limited, oder der Upload lief in einen Timeout. Die Datei liegt weiterhin auf deinem PC — poste sie von Hand, wenn sie es wert ist.',
        },
      ],
    },

    trouble: {
      title: 'Wenn etwas kaputtgeht',
      intro:
        'Das Plugin sagt dir im Chat Bescheid, wenn die Erfassung aufgehört hat — es wartet etwa 90 Sekunden, bevor es sich beschwert, und wiederholt sich höchstens alle 5 Minuten.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Der Token ist falsch oder wurde rotiert. Kopiere ihn erneut aus [Profile → RuneLite plugin](/profile#plugin-token), oder leere das Feld und melde dich aus dem Plugin heraus neu an.',
        },
        {
          term: '`Anvil: can’t reach the site — tracking is OFF.`',
          body: 'Prüfe die Site URL auf Tippfehler — sie sollte `{origin}` sein. Stimmt sie, ist die Seite wahrscheinlich offline.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Dieser Account ist noch nicht verknüpft. Füge ihn über Profile → „Accounts we noticed you playing“ hinzu.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Nichts. Es hat sich von selbst erholt.',
        },
      ],
      logHeading: 'Immer noch fest? Schick einem Admin ein Log',
      logBody:
        'Tippe `::anvillog` in den Spielchat (oder setze **Export debug log hotkey** im Support-Abschnitt des Plugins). Es schreibt eine Logdatei in deinen Ordner `.runelite/anvil-debug`, öffnet den Ordner und kopiert den Pfad in die Zwischenablage — schick diese Datei einem Admin, dann sieht er genau, was schiefgelaufen ist.',
      missingNote: {
        tag: 'Fehlen Nachweise?',
        body: 'Pets und doppelte Champion’s Scrolls brauchen einen manuellen Screenshot. Die werden nach `.runelite/osrs-bingo-pending/` gespeichert und erscheinen als Zeile **Saved proofs** im Bingo-Reiter des Collection Log.',
      },
    },
  },

  admin: {
    metaTitle: 'So führst du dein erstes Event durch — Anvil-Adminanleitung',
    metaDescription:
      'Richte einen Clan auf Anvil ein und führe ein Bingo von Anfang bis Ende durch: Discord, Mitgliederliste, Boards, Felder, Teams und Draft, Start, und was nach dem Eventende passiert.',
    eyebrow: 'Anvil · für das Clan-Team',
    title: 'So führst du dein erstes Event durch',
    dek: 'Der ganze Weg, in der Reihenfolge, in der du ihn wirklich gehst: {clanName} konfigurieren, die Mitgliederliste hereinholen, ein Board bauen, Teams draften, das Ganze starten und die Preise verteilen. Etwa ein Abend Arbeit fürs erste Bingo — Minuten fürs zweite.',
    facts: [
      { strong: '4 Schritte', rest: 'im Einrichtungsassistenten' },
      { strong: '7 Formate', rest: 'aus denen ein Board entsteht' },
      { strong: '1 Schaltfläche', rest: 'um die Mitgliederliste zu synchronisieren' },
    ],
    footnote:
      'Diese Anleitung folgt der App, wie sie heute ausgeliefert wird. Passt ein Bildschirm hier nicht zu dem, was du siehst, hat die App recht und die Anleitung ist veraltet — [sag uns Bescheid](/feedback), dann korrigieren wir sie.',

    access: {
      title: 'Wer darf was',
      intro:
        'Alle melden sich mit Discord an — es gibt keine Passwörter. Der erste Admin kommt aus der Serverkonfiguration; danach befördert ein Admin andere über **Clan → Members & staff**. Die Rollen stapeln sich nach unten: alles, was ein Moderator kann, können auch ein Kassenwart und ein Admin.',
      rows: [
        {
          term: 'Admin',
          body: 'voller Zugriff — Events, Felder, Teams, Einstellungen, Team, Auszahlungen. Gib sie an so wenige wie möglich.',
        },
        { term: 'Treasurer', body: 'alles, was ein Moderator kann, plus Teilnahmegebühren und Auszahlungen.' },
        {
          term: 'Moderator',
          body: 'das Tagesgeschäft: Mitgliederliste, Verifizierungen, Wochenwettbewerbe, Terminplan, Rückmeldungen. Kann keine Events anlegen oder bearbeiten.',
        },
        {
          term: 'Editor',
          body: 'nur das Anlegen von Feldern. Vergib sie global, oder begrenze sie auf bestimmte Boards, damit ein eingeladener Board-Bauer nur an das Event kommt, das du ihm übergeben hast.',
        },
        { term: 'Member', body: 'spielt; sieht überhaupt keine Adminoberfläche.' },
      ],
      seeAlso:
        'Zwei dieser Rollen haben eine eigene Seite: [Im Dienst]({moderatorGuide}) dazu, was ein Moderator tatsächlich mit seinem Abend macht, und [Gebühren und Auszahlungen]({feesGuide}) für den Kassenwart.',
      ownerNote: {
        tag: 'Eigentümer',
        body: 'Ein Account ist der Eigentümer. Niemand sonst kann ihn herabstufen, und es ist die einzige Rolle, die das Eigentum weitergeben kann — einen Streit mit einem Mit-Admin zu verlieren, kann dich also nie den Clan kosten.',
      },
    },

    setup: {
      title: 'Clan benennen, Discord verbinden',
      intro:
        '**System → Setup** ist ein Assistent mit vier Schritten, und das Dashboard behält dieselben vier als Checkliste, bis sie erledigt sind: Clan benennen, Discord verbinden, ein Event anlegen, Felder hinzufügen. Der Status wird aus echten Daten berechnet, ein Schritt wird also erst abgehakt, wenn er wirklich fertig ist.',
      discord:
        'Für Discord hast du zwei Wege, und sie ergänzen sich: gib Anvil einen **Bot**, dann kann es Webhooks anlegen, Rollen und Spitznamen synchronisieren und private Teamkanäle bauen; gib ihm eine einzelne **Webhook-URL**, dann kann es Ankündigungen posten und sonst nichts. Fang mit dem Webhook an, wenn du in zwei Minuten live sein willst, und ergänze den Bot, wenn du die Automatik willst.',
      permsNote: {
        tag: 'Bot-Rechte',
        body: 'Der Bot braucht _Manage Webhooks_, _Manage Roles_, _Manage Channels_ und _Manage Nicknames_, und seine Rolle muss in der Rollenliste deines Servers _über_ den Rollen stehen, die er verwaltet. Sonst verweigert Discord es stillschweigend.',
      },
      hosted:
        'Bei einem gehosteten Tarif hast du diesen Bildschirm schon einmal gesehen: den Bot während der Einrichtung hinzuzufügen war der Weg, über den Anvil erfahren hat, welcher Server eurer ist — es gab also nie eine Server-ID zu kopieren. Derselbe Link liegt hier, wann immer du den Bot auf einen anderen Server umziehen willst.',
    },

    channels: {
      title: 'Beiträge auf mehrere Kanäle verteilen',
      body: [
        'Standardmäßig geht alles in einen zentralen Ankündigungskanal. Wenn der laut wird, öffne **System → Advanced settings → Webhooks** und gib den lauten Kategorien ein eigenes Zuhause — Bingo-Events, Wochenwettbewerbe, seltene Drops, Tode, PvP-Kills, Combat Achievements, Clips. Alles, was du leer lässt, fällt auf den Hauptkanal zurück, du kannst also eine Kategorie nach der anderen abtrennen.',
        'Mit verbundenem Bot fasst du nie eine Webhook-URL an: wähle einen Kanal aus der Liste und drück **Create webhook**. Bei einem vollen Event kannst du einen zweiten Webhook auf denselben Kanal legen — Anvil wechselt zwischen ihnen, damit Discords Ratenbegrenzung keine Beiträge verschluckt.',
      ],
      clipsNote: {
        tag: 'Der Clip-Kanal ist anders',
        body: 'Clip-Videos werden direkt vom PC jedes Spielers zu Discord hochgeladen — sie laufen nie über diese Seite. Deshalb ist der Clip-Webhook, den du hier setzt, derjenige, den du _weitergibst_: die Mitglieder fügen ihn selbst in ihr Plugin ein. Alles andere auf dieser Seite passiert serverseitig, und Mitglieder sehen es nie.',
      },
    },

    roster: {
      title: 'Die Mitgliederliste hereinholen',
      body: [
        'Clanmitgliedschaft kommt aus genau einer Quelle: einer Synchronisierung der Mitgliederliste aus dem Spiel. Installiere [Anvils RuneLite-Plugin]({pluginGuide}) auf dem Account eines _Admins_, öffne den **Bingo**-Reiter im Collection Log im Spiel und drück **Sync clan roster**. Das schiebt eure tatsächliche Clanliste aus dem Spiel mit einem Klick auf die Seite.',
        'Wer einen Account auf der Website verknüpft oder verifiziert, ohne auf dieser Liste zu stehen, ist ein **Gast** — erfasst, sichtbar, aber kein Mitglied, bis ein Admin ihn befördert oder die nächste Synchronisierung ihn aufnimmt. Das ist Absicht: es bedeutet, dass sich niemand durch das Eintippen eines Namens in euren Clan befördern kann.',
        'Du kannst jemanden auch von Hand über **Clan → Members & staff** hinzufügen — einschließlich der Anmeldung zu einem Event stellvertretend, wenn er die Seite nicht erreicht.',
      ],
    },

    board: {
      title: 'Dein erstes Board anlegen',
      intro:
        '**Events → All events → New event**. Wähle zuerst ein Format — es entscheidet, wie das Board gewertet wird und was das restliche Formular von dir will.',
      formats: {
        classic: {
          label: 'Klassisches Bingo',
          blurb: 'Ein quadratisches N×N-Raster — Teams erledigen Felder in beliebiger Reihenfolge, jedes zählt 1.',
        },
        leagues: {
          label: 'Leagues-Bingo',
          blurb: 'Eine Aufgabenliste, in der jedes Feld seinen eigenen Punktwert trägt — beliebig viele Felder.',
        },
        race: {
          label: 'Feldrennen',
          blurb: 'Eine geordnete Strecke — Teams erreichen die Felder der Reihe nach; wer am weitesten kommt, gewinnt.',
        },
        showdown: {
          label: 'Showdown',
          blurb:
            'Felder bleiben bis zu ihrem geplanten Zeitpunkt verborgen — setze jede Aufdeckzeit im Tiles-Reiter. Punktgewertet, im Stil von DMM All Stars.',
        },
        luckydraw: {
          label: 'Glücksziehung',
          blurb: 'Ein Bingo-Ausrufer: verborgene Felder gehen in zufälligen Ziehungen in festen Abständen auf. Punktgewertet.',
        },
        bounty: {
          label: 'Kopfgeldjagd',
          blurb:
            'Ein offenes Feld nach dem anderen — das erste Team, das es erledigt, holt die Punkte, und das nächste Kopfgeld wird gezogen.',
        },
        ladder: {
          label: 'Leiter',
          blurb:
            'Eine punktgewertete Aufgabenliste als Einzelrangliste (Teams optional). Aufgaben rotieren — fortlaufend, einzeln, oder in einem gleitenden Fenster — und können an Wert verlieren. Im Stil einer Monatsleiter.',
        },
      },
      outro:
        'Setze dann die Termine, das Anmeldefenster, und ob die Anmeldung eine Gebühr kostet. Starte von einer Vorlage, wenn du nicht mit einem leeren Raster anfangen willst — die Galerie hält sowohl die eingebauten Vorlagen als auch jedes Board bereit, das du zuvor als Vorlage gespeichert hast.',
      seeAlso:
        'Das Format ist nur die halbe Entscheidung — wie Felder spielbar werden, ist die andere Hälfte, und beide bauen aufeinander auf. Beides vollständig: [Formate, und wie Felder aufgehen]({formatsGuide}).',
      utcNote: {
        tag: 'Termine sind UTC',
        body: 'Jeder Zeitstempel in Anvil wird in UTC gespeichert und verglichen und in der Ortszeit jedes Besuchers angezeigt. Setze die Endzeit, die du meinst; die Seite zeigt einem Briten und einem Australier zwei verschiedene Uhrzeiten für denselben Moment.',
      },
    },

    tiles: {
      title: 'Das Board füllen',
      body: [
        'Der **Tiles**-Reiter des Events ist der Ort, an dem aus einem Board ein Bingo wird. Jedes Feld ist eine _Art_ von Aufgabe, und die Art entscheidet, worauf das Plugin achtet: einen Drop, einen Boss-Killcount, Skill-XP, einen NPC-Kill, eine Zeitvorgabe, ein Achievement Diary, ein Combat Achievement, eine Collection-Log-Freischaltung, einen PvP-Kill, einen Gegenstandsgewinn, oder einen Durchlauf ohne Tod. Manuelle Felder — die, die ein Mensch anhand eines Screenshots bestätigt — sind immer auch eine Option.',
        'Für ein volles Board arbeitest du in Bulk: exportiere die Tabelle, füll sie in einem Tabellenprogramm aus, und importiere sie zurück. CSV und .xlsx laufen beide in beide Richtungen, und Zeilen entsprechen Positionen — du kannst also ein ganzes 25-Felder-Raster mit einem Einfügen neu schreiben.',
      ],
      rows: [
        {
          term: 'Schwierigkeitsstufen',
          body: 'Punktwerte werden auf benannte Bänder abgebildet (easy → elite). Bearbeite die Bänder unter Advanced settings, wenn dein Clan anders einstuft.',
        },
        {
          term: 'Balance-Prüfer',
          body: 'prüft ein fertiges Board auf strukturelle Probleme und schiefe Aufwandsverteilung, bevor Spieler es überhaupt sehen.',
        },
        {
          term: 'Verborgen bis zur Aufdeckung',
          body: 'neue Boards starten verborgen. Das Team sieht sie immer; Spieler sehen nichts, bis du aufdeckst — ein Board kann also offen gebaut werden, ohne gespoilert zu sein.',
        },
      ],
      seeAlso:
        'Zu welcher Art du greifst, wie du zweihundert davon in einer Tabelle schreibst, und die Fehler, die sauber importieren und dann nie auslösen: [Ein Board bauen, das sich selbst verfolgt]({boardGuide}).',
    },

    teams: {
      title: 'Teams und der Draft',
      body: [
        'Der Reiter **Teams & Draft** passt sich dem gewählten Format an: ein Format ohne Teams überspringt ihn ganz. Für ein normales Teambingo legst du die Teams an, bestimmst die Kapitäne, und verteilst die Spieler entweder selbst oder führst einen Live-Draft durch.',
        'Die Kapitäne draften aus dem Anmeldepool in der Reihenfolge, die du festlegst, und jeder Kapitän sieht die Antworten, die die Leute im Anmeldeformular gegeben haben — eingefroren, wie sie eingereicht wurden, damit niemand seine „Stunden pro Woche“ nachträglich anpasst.',
      ],
      lockNote: {
        tag: 'Der Draft sperrt die Aufstellung',
        body: 'Sobald ein Draft läuft, sind die Teams und die Pickreihenfolge eingefroren. Füge das vergessene Team _vor_ dem Start hinzu, nicht danach.',
      },
      seeAlso:
        'Schick deinen Kapitänen [die Kapitänsanleitung]({captainGuide}) vor dem Draftabend — der Kriegsraum ist in den Tagen davor am wertvollsten, und niemand liest einen neuen Bildschirm, während eine Uhr läuft.',
      visitingClans:
        'Spielt ihr gegen einen anderen Clan, statt eure eigenen zu draften? Die Gastseite stellt ihre eigene Mannschaft über einen einzigen Link, und ihr Moderator führt sie ohne Adminkonto hier — siehe [Einen Gastclan ausrichten]({clanVsClanGuide}).',
    },

    launch: {
      title: 'Starten und durchführen',
      body: [
        'Decke die Felder auf und starte dann das Event. Anvil weigert sich, ein Board zu starten, das nicht bereit ist — ein noch laufender Draft, oder Spieler ohne Team — und sagt dir, welches davon. Wenn du es besser weißt (ein Testlauf, eine Wiederholung, ein Board, das du prüfst), kannst du es erzwingen.',
        'Danach läuft es weitgehend von selbst. Das Plugin schreibt automatisch alles gut, was es sieht, und postet Nachweis-Screenshots, gestempelt mit Team und UTC-Zeitstempel. Was auf deinem Tisch landet, ist:',
      ],
      rows: [
        {
          term: 'Einreichungen zur Prüfung',
          body: 'manuelle Felder und alles, was das Plugin markiert hat. Bestätige oder lehne ab, mit dem Nachweis vor dir.',
        },
        {
          term: 'Statistik',
          body: 'der Stats-Reiter des Events zeigt den Beitrag pro Spieler — nützlich, wenn ein Team darüber streitet, wer wen getragen hat.',
        },
        {
          term: 'Ankündigungen',
          body: 'System → Announce postet mitten im Event eine Nachricht in eure Kanäle, ohne dass du einen Webhook von Hand schreibst.',
        },
      ],
      missionNote: {
        tag: 'Überraschungen mitten im Event',
        body: 'Du kannst eine **Mission** in ein laufendes Bingo werfen — ein verborgenes Bonusfeld, das angekündigt wird, wenn du es auslöst, und das optional an Wert verliert oder abläuft. Es ist der billigste Weg, ein Board an Tag fünf aufzuwecken.',
      },
      startProofNote: {
        tag: 'Horten vor dem Event unterbinden',
        body: [
          'Schalte **Starting shot** ein (Event → Overview), dann muss jeder Spieler einen Screenshot einreichen, aufgenommen nach dem Eventstart, an einem Ort, den Anvil im Startmoment auslost — damit niemand bei null auf einer Woche gebunkerter Clues und Kisten sitzt. Der Ort wird mit dem Start angekündigt; das Kennwort jedes Spielers ist persönlich, aus der Ziehung abgeleitet, und existiert vor dem Eventstart nicht, es kann also von niemandem vorbereitet werden.',
          'Markiere die Orte auf der Weltkarte (der Pool-Editor hat eine), dann prüft das Plugin, ob die Spieler tatsächlich dort stehen, statt es ihnen nur gesagt zu haben. Du kannst außerdem eine **frische Sitzung** verlangen — standardmäßig 15 Minuten: Hiscores werden nur beim Ausloggen gespeichert, alle kurz vor ihrer Aufnahme zum Relog zu zwingen ist also das, was die Startwerte hinter jedem XP- und KC-Feld ehrlich macht.',
          'Plugin-Nutzer drücken eine Taste. Alle anderen tippen ihr Kennwort im Spiel und laden auf My Team hoch. Du entscheidest, was mit einer Gutschrift von jemandem passiert, der nichts eingereicht hat: zur Prüfung markieren (Standard) oder ablehnen, bis er es tut. Dasselbe Overview-Panel ist die Prüfliste — Plugin-Aufnahmen mit verifiziertem Kennwort kommen bereits bestätigt an, in der Praxis siehst du dir also nur die Handyspieler an.',
        ],
      },
    },

    after: {
      title: 'Nach dem letzten Feld',
      intro:
        'Wenn die Uhr abläuft, friert das Board ein und das Event wird gesperrt — Punkte, Beiträge und wer-was-getan-hat werden so eingefroren, wie sie standen. Musst du danach etwas korrigieren, kann ein Admin es bewusst entsperren.',
      rows: [
        {
          term: 'Auszahlungen',
          body: 'der Payouts-Reiter des Events macht aus dem Preistopf eine Liste, wer was bekommt, und hakt sie ab, während du auszahlst.',
        },
        {
          term: 'Rückblick',
          body: 'eine öffentliche Rückblickseite mit dem Endstand und Auszeichnungen zum Eventende — größter Drop, meiste Kills, und der Rest.',
        },
        {
          term: 'Umfrage',
          body: 'frag den Clan, was er davon hielt. Bau sie im Survey-Reiter; Spieler antworten nach Eventende, und nur das Team sieht die Ergebnisse.',
        },
        {
          term: 'Als Vorlage speichern',
          body: 'behalte das Board, das du gerade gebaut hast. Das nächste Bingo startet daraus statt aus einem leeren Raster.',
        },
      ],
      federation:
        'Mit aktivierter Föderation können Mitglieder sich aus dem Plugin heraus auch mit anderen Anvil-Clans verbinden — praktisch für clanübergreifende Events, und pro Mitglied vollkommen freiwillig.',
      outro: 'Verweise deine Mitglieder dann auf die [Einrichtungsanleitung für Spieler]({pluginGuide}) und plane das nächste.',
    },
  },

  clanVsClan: {
    metaTitle: 'Einen Gastclan ausrichten — Anvil-Ausrichteranleitung',
    metaDescription:
      'Clan gegen Clan auf Anvil: gib jedem Gastclan einen Einladungslink, der seine Spieler in ein Team setzt, und einen Platz, damit ihr eigener Moderator ihre Hälfte führt.',
    eyebrow: 'Anvil · für Ausrichter',
    title: 'Einen Gastclan ausrichten',
    dek: 'Du richtest das Board aus; sie stellen die Mannschaft. Das ist der Weg, der dir erspart, ein Dutzend RSNs per DM einzusammeln — ein Link pro Team, und ein Platz, mit dem ihr eigener Moderator ihre Hälfte des Events führt.',
    facts: [
      { strong: '1 Link', rest: 'pro Gastteam' },
      { strong: '0 Adminplätze', rest: 'an Außenstehende vergeben' },
      { strong: '~5 Min.', rest: 'pro eingeladenem Clan' },
    ],
    footnote:
      'Die Screenshots stammen aus einer echten Einrichtung auf einem Testboard — Einladungs-Tokens und Discord-Namen sind unkenntlich. Ein echter Link ist es wert, gehütet zu werden: jeder, der ihn hat, kann sich einen Platz in diesem Team nehmen, solange er aktiv ist.',

    shape: {
      title: 'Was du hier aufsetzt',
      body: [
        'Clan gegen Clan ist ein ganz normales Event mit einem Unterschied: die Hälfte der Spieler ist nicht in deinem Clan und wird es nie sein. Sie lassen sich nicht über die Mitgliederliste hereinsynchronisieren, du willst sie nicht befördern, und du willst ganz sicher nicht zwanzig von ihnen von Hand anmelden und dann jeden einzeln ins richtige Team ziehen.',
        'Zwei Bausteine lösen das, und sie sind unabhängig — nimm einen davon, oder beide.',
      ],
      rows: [
        {
          term: 'Ein Einladungslink',
          body: 'eine URL, die du einmal für ein Team erzeugst. Wer sie öffnet, meldet sich an, füllt das normale Anmeldeformular aus, und landet in diesem Team bereits bestätigt — kein Draftpool, keine Freigabewarteschlange.',
        },
        {
          term: 'Ein Platz im Teamstab',
          body: 'eine benannte Person, die _genau dieses eine Team_ führen kann — dessen Aufstellung, dessen Einreichungen und Nachweise, dessen Gebühren — ohne Adminkonto hier, und ohne dem, der tatsächlich spielt, den Kapitänsplatz wegzunehmen.',
        },
      ],
      note: {
        tag: 'Was eine Einladung nicht ist',
        body: 'Sie ist keine Anmeldung und keine Abkürzung um die Verifizierung herum. Wer sie öffnet, meldet sich trotzdem mit Discord an und braucht trotzdem einen verifizierten RSN, genau wie bei jeder anderen Anmeldung. Der Link entscheidet nur, _in welches Team_ die Anmeldung geht, und dass sie niemandes Freigabe braucht.',
      },
    },

    team: {
      title: 'Zuerst das Team anlegen',
      body: [
        'Öffne dein Event und geh zum Reiter **Teams & Draft**. Lege ein Team pro eingeladenem Clan an und benenne es nach ihm — der Name ist das, was ihre Spieler im Anmeldeformular sehen, „Ironforge“ schlägt also „Team 2“.',
        'Du musst _keinen_ Draft durchführen. Einladungslinks und ein Draft sind Alternativen: ein Draft verteilt einen gemeinsamen Anmeldepool, ein Link setzt Leute direkt. Bei einem reinen Clan-gegen-Clan legen die meisten Ausrichter die Teams an, geben je einen Link heraus, und öffnen den Draft nie.',
        'Öffne dann das Team selbst — **Teams & Draft → das Team** — denn dort passieren beide nächsten Schritte.',
      ],
      captainNote: {
        tag: 'Erst der Kapitän',
        body: 'Benenne den Kapitän der Gastseite, bevor du den Link herausgibst, damit die Teamseite von Anfang an einen Verantwortlichen hat. Einen Kapitän zu benennen setzt ihn zugleich ins Team; warnt die Karte, dass er nicht in der Aufstellung steht, nimm die angebotene Korrektur an.',
      },
    },

    staff: {
      title: 'Ihrem Moderator einen Platz geben',
      body: [
        'Das Panel **Team staff** auf der Teamseite ist der Weg, wie der eigene Moderator des Gastclans loslegt, ohne dass du ihm auf deiner Seite irgendetwas einräumst. Drück **Add someone**, such ihn, füge eine Notiz wie „Ironforge’s mod“ hinzu, damit der nächste Admin weiß, warum er da ist, und drück **Give a seat**.',
      ],
      figure: {
        caption: 'Event → Teams & Draft → das Team → Team staff',
        alt: 'Das Team-staff-Panel mit einem vergebenen Platz und geöffneter Suche zum Hinzufügen',
        legend: [
          {
            label: 'Add someone',
            body: 'öffnet die Suche. Nur Leute, die sich hier mindestens einmal mit Discord angemeldet haben, können auftauchen — siehe Hinweis unten.',
          },
          {
            label: 'Die Notiz',
            body: 'Freitext, 120 Zeichen. Schreib hin, aus welchem Clan sie kommen. Plätze bleiben nach dem Event in der Liste, und „wer ist das?“ ist die Frage, die du in drei Monaten hast.',
          },
          {
            label: 'Remove',
            body: 'nimmt den Platz sofort zurück. Mach das, wenn das Event endet — ein Platz ist nicht von selbst befristet.',
          },
        ],
      },
      canDo: 'Was ein Platz kann, nur in diesem Team:',
      canDoList: [
        'die Aufstellung des Teams sehen und verwalten',
        'dessen Einreichungen und Nachweise bearbeiten',
        'die Gebühren seiner Spieler als bezahlt markieren',
        'Einladungslinks dafür erzeugen, wenn du das einschaltest (der übernächste Schritt)',
      ],
      cantDo: 'Was er nie kann:',
      cantDoList: [
        'irgendein anderes Team anfassen',
        'das Board oder seine Felder bearbeiten',
        'Draftpicks machen',
        'jemanden austauschen, sobald das Event läuft',
      ],
      note: {
        tag: 'Sie müssen sich hier einmal anmelden',
        body: 'Die Suche listet nur Accounts mit verknüpftem Discord — ein Platz hängt an einer Person, die sich tatsächlich anmelden kann. Schick also den Moderator des Gastclans auf diese Seite, lass ihn einmal **Login** drücken, und vergib _dann_ den Platz. Taucht er in der Suche nicht auf, hat diese Anmeldung noch nicht stattgefunden.',
      },
    },

    link: {
      title: 'Den Einladungslink erzeugen',
      body: [
        'Weiterhin auf der Teamseite erzeugt das Panel **Invite links** den Link. Zwei Felder legen fest, was der Link verspricht, und beide verstehen `0` als „versprich nichts“.',
      ],
      figure: {
        caption: 'Event → Teams & Draft → das Team → Invite links',
        alt: 'Das Invite-links-Panel mit den Feldern für Plätze und Ablauf, der Schaltfläche Make a link, und einem aktiven Link in der Liste',
        legend: [
          {
            label: 'Seats und Expires in hours',
            body: 'wie viele Personen der Link setzen darf (bis 100) und wie lange er gültig bleibt (bis 30 Tage). Setze die Plätze auf die Größe der zugesagten Mannschaft, dann schließt sich der Link von selbst, sobald alle drin sind; setze einen Ablauf, wenn der Link in ein öffentliches Discord geht. `0` in einem der Felder heißt kein Limit.',
          },
          {
            label: 'Make a link',
            body: 'erzeugt ihn und kopiert ihn sofort in deine Zwischenablage. Schick ihn ihnen, bevor du irgendetwas anderes machst.',
          },
          {
            label: 'Die Liste der aktiven Links',
            body: 'jeder Link, den dieses Team draußen hat, mit der Zahl der Beigetretenen und der verbleibenden Plätze. **Copy** holt ihn erneut; **Turn off** beendet ihn endgültig.',
          },
        ],
      },
      shape:
        'Der Link sieht so aus: `{origin}/events/{eventId}/join/{token}` — eine Zeile, gefahrlos in eine Discord-Nachricht einzufügen.',
      note: {
        tag: 'Sinnvolle Voreinstellungen',
        body: 'Bei einem Clan-gegen-Clan, bei dem du eine Mannschaft mit einem Moderator vereinbart hast: lass beide Felder auf `0` und lass ihn machen. Greif zu Plätzen und Ablauf, wenn der Link irgendwohin geht, das du nicht kontrollierst.',
      },
      revoke:
        'Einen Link abzuschalten wirkt sofort und entfernt niemanden, der schon beigetreten ist — die sind jetzt ganz normale Spieler in diesem Team. Willst du jemanden herausnehmen, nutze die Aufstellung des Teams.',
    },

    captains: {
      title: 'Lass sie ihre eigenen Links erzeugen',
      body: [
        'Standardmäßig kann nur ein Ausrichter Links erzeugen, und ein Kapitän, der es versucht, bekommt das gesagt. Diese Voreinstellung ist für ein normales Clanevent richtig — ein Kapitän, der Plätze verteilt, würde eine Aufstellung füllen, die niemand freigegeben hat — und für ein Clan-gegen-Clan falsch, wo die Gastseite ihre eigene Mannschaft besser kennt als du.',
        'Der Schalter sitzt im selben **Invite links**-Panel: **Let captains make their own links**. Er gilt für _jedes Team in diesem Event_, nicht nur für das, das du gerade ansiehst — genau das willst du, wenn beide Seiten Gastclans sind.',
        'Ist er an, können der Kapitän des Teams und jeder mit einem Platz im Stab selbst Links erzeugen, über **My Team → Invite links**. Sie bekommen dasselbe Panel wie du, ohne den Schalter.',
      ],
      figure: {
        caption: 'My Team → das Team → Invite links',
        alt: 'Der Invite-links-Reiter aus Sicht des Kapitäns im Team-Hub, mit den Feldern für Plätze und Ablauf und einem aktiven Link',
        legend: [
          {
            label: 'Dasselbe Panel, Kapitänsansicht',
            body: 'erzeugen, kopieren, abschalten. Hat der Ausrichter den Schalter nicht aktiviert, steht dort „Only a host can make links for this event“, und die Felder fehlen.',
          },
          {
            label: 'Die Liste der aktiven Links',
            body: 'ein Kapitän, der keine Links erzeugen darf, sieht trotzdem die, die sein Team draußen hat — so kann er dich um einen weiteren bitten, statt anzunehmen, es gäbe keine.',
          },
        ],
      },
    },

    player: {
      title: 'Was ihre Spieler sehen',
      intro:
        'Es lohnt sich, das einmal selbst durchzugehen, bevor du den Link herausgibst, damit du Fragen dazu beantworten kannst.',
      steps: [
        'Sie öffnen den Link. Sind sie nicht angemeldet, melden sie sich zuerst mit Discord an und kommen direkt zurück — der Link geht unterwegs nicht verloren.',
        'Sie landen auf dem ganz normalen Anmeldeformular, mit einem Banner: **You’re joining {teamExample} by invite**. Dieselben Fragen, dieselbe Accountauswahl, dieselbe Gebühr wie für alle anderen.',
        'Mit dem Absenden sind sie in diesem Team, bestätigt. Kein Eingreifen des Ausrichters, kein Draft.',
      ],
      figure: {
        caption: 'Das Anmeldeformular, über einen Einladungslink geöffnet',
        alt: 'Das Event-Anmeldeformular mit einem Banner, dass der Spieler per Einladung einem benannten Team beitritt',
        legend: [
          {
            label: 'Das Einladungsbanner',
            body: 'nennt das Team, dem sie gleich beitreten. Nennt es das falsche Team, haben sie den falschen Link — anhalten und prüfen, bevor sie absenden.',
          },
          {
            label: 'Der Rest des Formulars',
            body: 'unverändert. Ein verifizierter RSN ist weiterhin nötig, die Anmeldefragen werden weiterhin gestellt, und eine Anmeldegebühr gilt weiterhin.',
          },
        ],
      },
      note: {
        tag: 'Schon angemeldet?',
        body: 'Hat sich jemand zuerst normal angemeldet und sitzt im Pool, verschiebt das Öffnen des Links ihn ins Team, statt einen zweiten Eintrag anzulegen. Wer bereits für ein anderes Team bestätigt ist, wird in Ruhe gelassen — verschieb ihn stattdessen über die Aufstellung.',
      },
    },

    dead: {
      title: 'Wenn ein Link nicht mehr funktioniert',
      intro:
        'Ein abgelehnter Link erklärt sich auf der Seite selbst, statt einen 404 zu liefern — wer ihn hat, kann dir also sagen, welcher Fall vorliegt.',
      rows: [
        {
          term: 'This invite has been turned off.',
          body: 'Jemand hat **Turn off** gedrückt. Erzeug einen neuen — ein alter Link kommt nie zurück.',
        },
        {
          term: 'This invite has expired.',
          body: 'Er hat die von dir gesetzten Stunden erreicht. Erzeug einen weiteren, diesmal mit `0` Stunden, falls der Ablauf nichts bringt.',
        },
        {
          term: 'This invite is full.',
          body: 'Alle Plätze sind belegt. Erhöhe es, indem du einen neuen Link mit mehr Plätzen erzeugst — die Platzzahl liegt fest, sobald ein Link existiert.',
        },
        {
          term: 'Sign-ups for this event aren’t open.',
          body: 'Der einzige Fall, der sich von selbst lösen kann. Prüfe das Anmeldefenster des Events: schon geöffnet, Frist abgelaufen, oder Event bereits gestartet.',
        },
        {
          term: 'That invite belongs to a different event.',
          body: 'Ein Link von einem anderen Board wurde eingefügt. Prüfe, ob die Event-ID in der URL die gemeinte ist.',
        },
      ],
      checklist: 'Geh diese Liste vor dem Event einmal pro Gastclan durch:',
      checklistItems: [
        'ihr Team existiert und ist nach ihnen benannt',
        'ihr Kapitän ist benannt und im Team gesetzt',
        'ihr Moderator hat sich hier angemeldet und hat einen Platz im Teamstab',
        'der Link ist erzeugt, kopiert und tatsächlich bei einem Menschen angekommen',
        'das Anmeldefenster ist so lange offen, wie sie es brauchen',
      ],
      note: {
        tag: 'Wenn alles vorbei ist',
        body: 'Schalte die Links ab und entferne die Plätze im Teamstab. Beides läuft nicht von selbst aus, und ein aktiver Link auf einem beendeten Event ist bloß ein loses Ende.',
      },
    },
  },

  board: {
    metaTitle: 'Ein Board bauen — Anvils Anleitung zum Anlegen von Feldern',
    metaDescription:
      'Lege Bingofelder an, die sich selbst gutschreiben: was jede Feldart tatsächlich sehen kann, Massenpflege per Tabelle, und die Fehler, die still scheitern.',
    eyebrow: 'Anvil · für Board-Bauer',
    title: 'Ein Board bauen, das sich selbst verfolgt',
    dek: 'Ein Feld ist das Versprechen, dass etwas bemerkt wird. Hier steht, was jede Art tatsächlich sehen kann, wie du zweihundert davon schreibst, ohne deinen Abend zu verlieren, und die wenigen Fehler, die still scheitern — das Feld löst schlicht nie aus, und niemand merkt es vor Tag vier.',
    facts: [
      { strong: '15 Arten', rest: 'eine pro Feld, nie gemischt' },
      { strong: '1000 Felder', rest: 'pro Board, per Tabelle' },
      { strong: 'Still', rest: 'so scheitert ein schlechtes Feld' },
    ],
    footnote:
      'Das Tabellenformat ist vollständig in `docs/tile-authoring.md` beschrieben, geschrieben für den (oder das), was die Zeilen erzeugt. Diese Seite ist die menschliche Hälfte: zu welcher Art du greifst, und was schiefgeht.',

    kinds: {
      title: 'Ein Feld, eine Art',
      body: [
        'Jedes Feld ist genau eine _Art_, und die Art ist die ganze Frage: sie entscheidet, worauf das Plugin oder der Hiscores-Durchlauf achtet, und damit, ob das Feld überhaupt von selbst fertig werden kann. Felder zweier Arten zu mischen wird an der Tür abgewiesen, statt angenommen und kaputt liegen gelassen zu werden.',
        'Die Arten fallen in drei Familien, und die Familie zählt mehr als die Bezeichnung:',
      ],
      families: [
        {
          term: 'Manuell',
          body: 'ein Mensch sieht sich einen Screenshot an und sagt ja. Immer verfügbar, funktioniert immer, kostet immer jemanden seinen Abend. Nimm es für das, was Software nicht sehen kann.',
        },
        {
          term: 'Aus den Hiscores',
          body: 'Skill-XP und Boss-Killcounts, alle 15 Minuten aus den offiziellen Hiscores gelesen. Braucht kein Plugin und funktioniert für alle auf der Mitgliederliste — sieht aber nur, was die Hiscores zählen, und erst nachdem der Spieler sich ausgeloggt hat.',
        },
        {
          term: 'Vom Plugin erkannt',
          body: 'alles andere: Drops, NPC-Kills, Zeitvorgaben, Diaries, Combat Tasks, Runden, Lootwert. Schreibt binnen Sekunden gut und backt einen Nachweis-Screenshot ein — aber nur für Spieler, die das Plugin tatsächlich nutzen.',
        },
      ],
      kindsIntro: 'Die vollständige Liste, in der Reihenfolge der Artauswahl:',
      kindLabels: {
        standard: { label: 'Standard', blurb: 'Manuelles Feld — ein Kapitän markiert es als erledigt. Keine automatische Erfassung.' },
        skill: { label: 'Skill', blurb: 'Wird automatisch fertig, wenn ein Skill ein XP-Ziel erreicht (aus den Hiscores gelesen).' },
        boss: { label: 'Boss-KC', blurb: 'Wird automatisch fertig, wenn ein Boss ein Killcount-Ziel erreicht (aus den Hiscores gelesen).' },
        drop: { label: 'Drop', blurb: 'N Drops eines Gegenstands (oder irgendeines aus einem Pool) — vom Plugin erkannt, mit eingebackenem Screenshot.' },
        collection: { label: 'Gegenstandssatz', blurb: 'Mehrere Gegenstände, jeder mit eigener geforderter Anzahl — je einer für einen vollen Satz.' },
        kill: { label: 'Killcount', blurb: 'N Kills eines NPCs — auch solcher, die nie in den Hiscores standen (Hühner, Kühe). Vom Plugin erkannt.' },
        lap: { label: 'Agility-Runden', blurb: 'N Runden auf einem Agility-Kurs, oder N Stockwerke / komplette Durchläufe im Hallowed Sepulchre — live am Spielzähler mitgezählt. Nur Runden während des Events zählen.' },
        pvp: { label: 'PvP-Kill', blurb: 'Töte Spieler — irgendwen, gegnerische Teams, oder ein benanntes Kopfgeld — in der Wilderness oder auf PvP-Welten. Sichere Minispiele zählen nie.' },
        gain: { label: 'Gegenstandsgewinn', blurb: 'Fange, koche oder sammle N eines Gegenstands — gezählt an dem, was ins Inventar wandert. Vom Plugin erkannt.' },
        timed: { label: 'Auf Zeit', blurb: 'Schließe eine Aktivität unter einer Zeitvorgabe ab (Inferno, Raids, Colosseum). Das Plugin stoppt die Zeit.' },
        deathless: { label: 'Ohne Tod', blurb: 'Schließe ein Raid mit NULL Toten im Team ab, N Mal. Das Plugin zählt jeden Tod in der Instanz.' },
        lms: { label: 'LMS', blurb: 'Erreiche Top N in Last Man Standing (1 = Sieg), M Mal. Vom Plugin am Spielende erkannt.' },
        value: { label: 'Lootwert', blurb: 'Loot im Wert von X gp — eine Beute, oder Beuten, die zusammen ein Ziel erreichen. Das Plugin bepreist die Beute.' },
        diary: { label: 'Diary', blurb: 'Schließe Achievement-Diary-Stufen während des Events ab. Vom Plugin an der Abschlussmeldung erkannt.' },
        ca: { label: 'Combat Task', blurb: 'Schließe Combat-Achievement-Aufgaben während des Events ab. Vom Plugin an der Abschlussmeldung erkannt.' },
      },
      note: {
        tag: 'Die Plugin-Frage, einmal gestellt',
        body: 'Ein vom Plugin erkanntes Feld ist für einen Spieler ohne Plugin unsichtbar. Das ist kein Fehler, den man wegkonfigurieren kann — es schaut schlicht nichts hin. Spielt ein Teil deines Clans auf dem Handy oder im offiziellen Client: halte diese Felder entweder vom kritischen Weg zum Sieg fern, oder kombiniere sie mit einer manuellen Alternative und rechne damit, Screenshots zu prüfen.',
      },
    },

    pick: {
      title: 'Wähle die Art, die tatsächlich auslöst',
      intro:
        'Die meisten Felder, die sich schlecht benehmen, sind die richtige Idee in der falschen Art ausgedrückt. Die vier, über die Leute stolpern:',
      rows: [
        {
          term: 'Ein Boss-KC-Ziel',
          body: 'ist **kein** Kill-Feld. Kill-Felder beobachten NPC-Tode über das Plugin; ein KC-Ziel ist eine Hiscores-Zahl und braucht `trackedStat` + `statType=boss` + `statGoal`. Nimm ein Kill-Feld für das, was die Hiscores nie gezählt haben — Kühe, Hühner, einen bestimmten Slayer-Mob.',
        },
        {
          term: 'Ein Collection-Log-Platz',
          body: 'ist ein Drop-Feld. Die Freischaltung des Logeintrags schreibt es gut, das Feld löst also auch bei einem Duplikat aus, das der Spieler schon besaß — was meistens genau das ist, was du meintest.',
        },
        {
          term: '„Von jedem eins“',
          body: 'ist ein Drop-Feld mit Gegenstandsliste und **ohne** `requiredAmount`. Ergänze ein `requiredAmount`, und es wird still zu „irgendwelche N davon“ — dieselbe Zeile, ein völlig anderes Feld.',
        },
        {
          term: 'Ein Diary oder Combat Task',
          body: 'schreibt nur an der Abschlussmeldung im Spiel gut, die genau in dem Moment kommt, in dem die Stufe oder Aufgabe fertig ist. Was ein Spieler schon besitzt, kann nicht erneut auslösen — außer bei einem Combat Task, wo **Settings → Combat Achievements → Repeat completion** ihn erneut auslösen lässt.',
        },
      ],
      note: {
        tag: 'Zusammengesetzte Boss-Felder',
        body: 'Der erfasste Wert eines Boss-Felds darf mehrere Hiscores-Schlüssel enthalten, durch Kommas getrennt, und die Fortschritte werden über sie summiert. `chambersOfXeric,chambersOfXericChallengeMode` ist ein Feld, das CoX und CM zusammen zählt — fast immer das, was ein Raid-Feld meint.',
      },
    },

    bulk: {
      title: 'Leg sie in Bulk an, nicht im Browser',
      body: [
        'Ein 25-Felder-Raster zusammenzuklicken geht. Ein Leagues-Board mit 200 Aufgaben zusammenzuklicken nicht, und Korrekturlesen danach ebenso wenig. Der Tiles-Reiter hat genau dafür einen Hin- und Rückweg.',
      ],
      steps: [
        '**Download spreadsheet** im **Tiles**-Reiter des Events. Du bekommst eine .xlsx des Boards, wie es gerade ist, mit Auswahllisten, der Gegenstandsliste und den Spaltenhinweisen auf eigenen Blättern.',
        'Bearbeite sie. Eine Zeile pro Feld; die Zeilenreihenfolge ist die Feldreihenfolge.',
        '**Upload CSV / Excel** im selben Reiter. Nur das Blatt **Tiles** wird gelesen.',
      ],
      rules: [
        {
          term: 'Der Rundweg verliert nichts',
          body: 'herunterladen und unverändert wieder hochladen, und es passiert nichts — übereinstimmende Zeilen werden als unverändert gemeldet und nicht einmal neu gestempelt. Das macht den Export zu einer sicheren Sicherung vor einer großen Änderung.',
        },
        {
          term: 'Zeilen entsprechen Positionen',
          body: 'Zeile 1 ist Feld 1. Bestehende Felder werden an Ort und Stelle aktualisiert, und eine Spalte, die du weglässt, bleibt unangetastet, statt geleert zu werden — du kannst also eine Tabelle mit zwei Spalten schicken, die nur Punkte ändert.',
        },
        {
          term: 'Nur dynamische Boards wachsen',
          body: 'zusätzliche Zeilen legen neue Felder auf einem Leagues-Board oder einem Feldrennen an, vor dem Eventstart, bis zu 1000. Ein klassisches N×N-Raster hat eine feste Form und ignoriert sie. Willst du Hunderte Aufgaben erzeugen, mach ein Leagues-Event daraus.',
        },
        {
          term: 'Alles oder nichts',
          body: 'alle Zeilen werden zuerst geprüft. Ein einziger nicht auflösbarer Gegenstandsname lässt den ganzen Import scheitern, nennt die Übeltäter, und ändert nichts — du bekommst nie ein halbes Board.',
        },
        {
          term: 'Manche Felder sperren beim Start',
          body: 'Name, Art, geforderte Anzahl und Gegenstandskonfiguration werden nur vor dem Eventstart übernommen. Beschreibung, Punkte, Kategorie und das Optional-Flag bleiben durchgehend bearbeitbar, du kannst also einen Tippfehler mitten im Event korrigieren, ohne das Board neu zu öffnen.',
        },
      ],
    },

    traps: {
      title: 'Die Fehler, die still scheitern',
      intro:
        'Jeder davon importiert sauber, sitzt richtig aussehend auf dem Board, und löst nie aus. Sie sind eher vor dem Hochladen eine Lektüre wert als danach.',
      rows: [
        {
          term: 'Skill- und Boss-Felder sind `type=standard`',
          body: 'es gibt kein `type=skill`. Die Art ergibt sich aus `trackedStat` + `statType` + `statGoal` auf einer ansonsten normalen Standardzeile. `type=boss` wird abgelehnt; `type=standard` zu schreiben und die Stat-Spalten zu vergessen aber nicht — dann bekommst du ein manuelles Feld, das nie jemand bestätigt.',
        },
        {
          term: 'Die Trennzeichen unterscheiden sich je Spalte',
          body: '`items` nutzt Semikolons (das Komma ist das CSV-Trennzeichen). `targetNpcs` nutzt senkrechte Striche. In einer Combat-Task-Zeile ist der senkrechte Strich die **einzige** Option, weil echte Aufgabennamen Kommas enthalten — `Nylocas, On the Rocks` ist eine Aufgabe.',
        },
        {
          term: 'Raid-Namen werden wortwörtlich abgeglichen',
          body: 'ein Deathless- oder Zeitfeld trägt den Modus genau so, wie er im Spiel geschrieben wird: `Chambers of Xeric: Challenge Mode`, `Theatre of Blood: Hard Mode`, `Tombs of Amascut: Expert Mode`. Eine fast richtige Schreibweise ist ein Feld, das nie fertig wird. Entry-Mode-Durchläufe schreiben nie ein normales Raid-Feld gut; schwerere Modi schon.',
        },
        {
          term: 'Gegenstandsnamen müssen exakt sein',
          body: 'die Schreibweise aus dem Spiel, sonst scheitert der Import und listet auf, was er nicht auflösen konnte. Ist ein Name mehrdeutig, fixiere ihn als `Name#id` und hör auf zu raten.',
        },
        {
          term: '`timeThresholdSeconds` bedeutet vier Dinge',
          body: 'eine Zeitvorgabe bei einem Zeitfeld, eine Platzierungsgrenze bei einem LMS-Feld (1 = Sieg), eine exakte Gruppengröße bei einem Deathless-Feld, und eine exakte Raid-Gruppengröße bei einem Drop-Feld. Dieselbe Spalte, vier Bedeutungen — prüfe, dass du die ausfüllst, die deine Art tatsächlich liest.',
        },
        {
          term: 'Eine geforderte Anzahl bei der falschen Art',
          body: 'sie gehört auf Drop-, Kill-, Gain-, Lap-, PvP-, Deathless- und LMS-Zeilen. Auf einer Stat- oder Zeitzeile tut sie nichts, und auf einer Drop-Zeile macht sie aus einem Gegenstandssatz einen „irgendwelche N“-Pool.',
        },
      ],
      note: {
        tag: 'Teste eins, bevor du zweihundert schreibst',
        body: 'Leg ein einziges Feld der Art an, bei der du unsicher bist, deck es in einem Wegwerf-Event auf, und geh die Sache tun. Fünf Minuten dort schlagen die Entdeckung am Bingoabend des Clans, dass eine ganze Kategorie tot war.',
      },
    },

    points: {
      title: 'Punkte, Stufen und ob es fair ist',
      body: [
        'Auf einem punktgewerteten Board trägt jedes Feld seinen eigenen Wert, und diese Werte bilden sich auf benannte Schwierigkeitsbänder ab — easy bis elite — die du unter **Advanced settings** bearbeiten kannst, wenn dein Clan anders einstuft. Das Band ist das, was Spieler lesen; die Zahl ist das, was zählt.',
        'Markiere ein Feld als **optional**, und es zählt nicht mehr zur Boardsumme — so fügst du Zusatzziele hinzu, ohne ein Blackout unmöglich zu machen.',
        'Wenn das Board voll ist, lass den **Balance-Prüfer** aus dem Tiles-Reiter laufen. Er prüft die Struktur und die Aufwandsverteilung und sagt dir, wo das Board schief liegt — eine Kategorie, die niemand schaffen kann, ein Band, das pro Stunde deutlich mehr wert ist als seine Nachbarn — bevor Spieler das für dich herausfinden und drum herum spielen.',
      ],
    },

    reveal: {
      title: 'Niemand sieht es, bis du es sagst',
      body: [
        'Neue Boards starten verborgen. Das Team sieht sie immer; Spieler sehen überhaupt nichts, bis du aufdeckst — ein Board kann also offen gebaut werden, über Tage, in einem Kanal, den deine Mitglieder lesen können, ohne dass etwas gespoilert wird.',
        'Dieser Hauptschalter ist der Boden unter allem anderen. Auf einem Board mit einer Aufdeckregel — geplant, Intervall, Kopfgeld, rotierend — beginnt die Mechanik erst dann, einzelne Felder umzudrehen, wenn das Board selbst aufgedeckt ist; ein Board scharf zu stellen ist also immer eine bewusste Handlung. Welche Regel du wählst, hat eine eigene Seite: [Formate, und wie Felder aufgehen]({formatsGuide}).',
        'Missionen sind die Ausnahme, die man kennen sollte: vorab angelegte, aber zurückgehaltene Felder, die mitten im Event aus einem eigenen Pool angekündigt werden, während der Rest des Boards sichtbar bleibt.',
      ],
    },

    check: {
      title: 'Bevor du aufdeckst',
      intro: 'Einmal pro Board durchzugehen lohnt sich. Das meiste sind fünf Minuten.',
      items: [
        'jedes Feld hat die Art, die du meintest, nicht die, die sauber importiert hat',
        'Raid-Modi, Gegenstandsnamen und Aufgabennamen stimmen Zeichen für Zeichen mit der Schreibweise im Spiel überein',
        'die vom Plugin erkannten Felder sind nicht der einzige Weg zum Sieg, falls ein Teil deines Clans ohne spielt',
        'Punkte sind gesetzt und der Balance-Prüfer ist zufrieden, oder du widersprichst ihm absichtlich',
        'optionale Felder sind als optional markiert',
        'du hast die Tabelle einmal heruntergeladen, als Sicherung, die du wieder hochladen kannst',
      ],
      note: {
        tag: 'Wer darf das',
        body: 'Das Anlegen von Feldern ist die eine Adminaufgabe mit einer eigenen Rolle. Ein **Editor** kann Felder anlegen und sonst nichts, und lässt sich auf bestimmte Boards begrenzen — ein eingeladener Board-Bauer aus einem anderen Clan bekommt also genau das Event, das du ihm übergeben hast, ohne Zugriff auf irgendetwas anderes, das du betreibst.',
      },
    },
  },

  captain: {
    metaTitle: 'Kapitänsanleitung — Anvil',
    metaDescription:
      'Der Drafttag und die Wochen danach: den Pool lesen, bevor die Uhr läuft, Picks machen, und Aufstellung, Nachweise und Gebühren deines Teams führen.',
    eyebrow: 'Anvil · für Kapitäne',
    title: 'Kapitänsanleitung',
    dek: 'Man drückt dir einen Kriegsraum, eine Uhr und fünfundzwanzig Anmeldeformulare Fremder in die Hand. Hier steht, was das alles tut, in der Reihenfolge, in der du es triffst — plus die Teile der Teamführung, die erst nach dem Draft beginnen.',
    facts: [
      { strong: 'Schlangenreihenfolge', rest: 'damit späte Picks sich ausgleichen' },
      { strong: 'Die Uhr', rest: 'pickt nie für dich' },
      { strong: 'Ein Reiter', rest: 'führt dein Team das ganze Event' },
    ],
    footnote:
      'Alles hier ist das, was ein Kapitän sieht. Gebühren, die Aufstellungen anderer Teams und das Board vor der Aufdeckung gehören dem Team und bleiben dort — nichts auf dieser Seite bringt dich also in den Verdacht, etwas gesehen zu haben, was du nicht sollst.',

    before: {
      title: 'Was du bekommst, und wann',
      body: [
        'Ein Ausrichter ernennt dich zum Kapitän, was zwei Dinge tut: es setzt dich als Spieler ins Team, und es öffnet dir die Oberflächen des Teams. Warnt die Teamseite je, dass du gar nicht in der Aufstellung stehst, nimm die angebotene Korrektur an — ein Kapitän außerhalb seines eigenen Teams ist ein Zustand, der jeden nachgelagerten Bildschirm verwirrt.',
        'Danach hast du zwei Orte. **My Team** ist der Knotenpunkt deines Teams, und dort verbringst du das Event. Der **Kriegsraum** ist der Bildschirm des Drafttags, und er öffnet, sobald die Anmeldung öffnet — lange vor dem Draftabend.',
      ],
      note: {
        tag: 'Geh früh hin',
        body: 'Der Kriegsraum ist in den Tagen _vor_ dem Draft am nützlichsten, wenn du jedes Anmeldeformular in Ruhe lesen kannst. Am Abend selbst wird er zur Stoppuhr, und du wirst keine Zeit zum Lesen haben.',
      },
    },

    warroom: {
      title: 'Lies den Pool, bevor die Uhr läuft',
      body: [
        'Der Kriegsraum zeigt alle, die gepickt werden können, mit allem, was die Seite über sie weiß: was sie spielen, bei welchen Bossen sie echte Killcounts haben, zu wie vielen früheren Events sie erschienen sind, und die Antworten aus dem Anmeldeformular.',
        'Diese Antworten sind **eingefroren, wie sie eingereicht wurden**. Niemand bearbeitet seine „Stunden pro Woche“, nachdem er gesehen hat, wer zuerst gepickt wurde — und genau deshalb lohnt es sich, sie zu lesen.',
        'Bau dir beim Lesen eine **Merkliste**. Sie ist privat, sie überlebt bis zum Draftabend, und an diesem Abend ist sie der Unterschied zwischen einer Liste, der du schon vertraust, und dem, wer gerade oben auf dem Bildschirm steht.',
      ],
      rows: [
        {
          term: 'Bewertung und Stufe',
          body: 'eine Zusammenfassung dessen, was jemand tatsächlich getan hat, aus seiner Accounthistorie abgeleitet statt aus dem, was er dir erzählt hat. Beratend — ein Ausgangspunkt für ein Gespräch, kein Urteil.',
        },
        {
          term: 'Bereiche und Marker',
          body: 'was sie nachweislich tun: Raids, PvM, Skilling, PvP. Nützlich, um die Lücke in deiner Aufstellung zu finden, statt viermal die höchste Zahl zu nehmen.',
        },
        {
          term: 'Teilnahme',
          body: 'wie oft sie frühere Events, für die sie sich angemeldet hatten, auch zu Ende gespielt haben. Die leiseste Zahl auf der Seite und häufig die aussagekräftigste.',
        },
      ],
    },

    draft: {
      title: 'Der Drafttag',
      body: [
        'Die Picks laufen in **Schlangenreihenfolge**: bei vier Teams geht die erste Runde A, B, C, D und die zweite D, C, B, A — als Letzter in einer Runde zu picken heißt also, als Erster in der nächsten zu picken. Wer den ersten Pick gezogen hat, zahlt eine Minute später dafür.',
        'Eine Person ist ein Pick, kein Account. Jemanden zu nehmen, zieht alle Accounts, die er registriert hat, gemeinsam in dein Team — du gibst nie einen zweiten Pick für den Zweitaccount von jemandem aus.',
      ],
      rows: [
        {
          term: 'Die Pickuhr',
          body: 'hat der Ausrichter eine gesetzt, bekommst du so viele Sekunden pro Zug. Läuft sie ab, pickt sie **nicht** für dich — sie schaltet für den Ausrichter die Möglichkeit frei, an deiner Stelle zu picken, und sagt das auf beiden Bildschirmen. Nichts passiert im Stillen.',
        },
        {
          term: 'Eine eingeengte Liste',
          body: 'manche Events laufen mit einem Balance-Modus. Je nachdem kann dem stärksten Team verwehrt werden, noch einen Topspieler zu nehmen, während ein Rivale keinen hat — oder es gibt eine Obergrenze, wie weit seine Aufstellung über den Durchschnitt gehen darf. Ist jemand, den du wolltest, ausgegraut, ist das der Grund, und es gilt für alle.',
        },
        {
          term: 'Wenn du ihn verpasst',
          body: 'sag dem Ausrichter vorher Bescheid. Er kann vom selben Board aus für dich picken, und eine hinterlassene Merkliste ist die Anweisung, der er folgt.',
        },
      ],
      note: {
        tag: 'Der Draft sperrt die Aufstellung',
        body: 'Sobald ein Draft läuft, sind Teams und Pickreihenfolge eingefroren. Fehlt ein Team oder stimmt die Reihenfolge nicht, muss das vor dem ersten Pick behoben werden, nicht danach.',
      },
    },

    roster: {
      title: 'Der Knotenpunkt deines Teams, das ganze Event',
      intro:
        'Auf **My Team** enthält die Karte **Manage this team** alles, was du für deine Seite tun kannst. Sie kommt eingeklappt; öffne sie einmal, dann bleibt sie, wo du sie gelassen hast.',
      rows: [
        {
          term: 'Roster',
          body: 'wer im Team ist und was er beigetragen hat. Der erste Ort zum Nachsehen, wenn jemand fragt, warum sein Drop nicht gezählt hat — ein nicht verknüpfter Account taucht hier auf.',
        },
        {
          term: 'Requests',
          body: 'Leute, die um Aufnahme bitten, bei Events, in denen Spieler ihr Team selbst wählen. Erscheint nur, wenn es welche gibt.',
        },
        {
          term: 'Proof',
          body: 'die Einreichungen deines Teams und ihre Screenshots. Du bist nicht die letzte Instanz — das ist das Team — aber du siehst, was geschickt wurde, und kannst hinterher sein, was fehlt.',
        },
        {
          term: 'Fees',
          body: 'wer in deinem Team noch eine Teilnahmegebühr schuldet. Du kannst eine als bezahlt markieren; sie zu bestätigen ist bewusst Sache des Teams.',
        },
        {
          term: 'Invite links',
          body: 'erscheint, wenn der Ausrichter Kapitänen erlaubt hat, eigene zu erzeugen. Ein Link setzt den, der ihn öffnet, direkt in dein Team. Siehe [Einen Gastclan ausrichten]({clanVsClanGuide}) dazu, was der Link tatsächlich tut.',
        },
      ],
    },

    during: {
      title: 'Es führen, sobald es läuft',
      body: [
        'Das meiste am Event läuft von selbst: das Plugin schreibt gut, was es sieht, und legt einen gestempelten Screenshot dazu ab. Übrig bleiben Menschen, und das ist die Arbeit.',
        'Was wirklich einen Kapitän braucht: sicherstellen, dass alle auf deiner Seite das Plugin verbunden und ihre Accounts verknüpft haben, bevor es losgeht — ein nicht verknüpfter Zweitaccount trägt zu nichts bei; zur Halbzeit bemerken, welche Felder niemand angefasst hat; und die manuellen Felder vor der letzten Stunde fotografiert bekommen, wenn alle gleichzeitig anfangen.',
        'Verlangt das Event eine Startaufnahme, ist das die eine Sache, die jeder Spieler in den ersten Stunden selbst erledigen muss. Sei früh dahinter — bei einem Spieler ohne wird jede Gutschrift zur Prüfung markiert oder direkt abgelehnt, je nachdem, wie der Ausrichter es eingestellt hat.',
      ],
      note: {
        tag: 'Auswechslungen',
        body: 'Sobald ein Event läuft, kann nur ein Admin jemanden austauschen, und das mit Absicht: Beiträge hängen bereits an Personen. Frag einen Ausrichter, statt darum herum zu basteln.',
      },
    },
  },

  formats: {
    metaTitle: 'Formate, und wie Felder aufgehen — Anvil',
    metaDescription:
      'Die sieben Eventformate, die fünf Arten, wie Felder aufgehen können, und die Punktmodifikatoren — was jeder davon damit macht, wie sich ein Event anfühlt.',
    eyebrow: 'Anvil · für das Clan-Team',
    title: 'Formate, und wie Felder aufgehen',
    dek: 'Zwei Entscheidungen prägen ein Event stärker als alle Felder darin: welche Form das Board hat, und wie Felder spielbar werden. Sie sind unabhängig — jedes Format kann jede Aufdeckregel nutzen — und zusammen sind sie der Unterschied zwischen einer Woche Schufterei und einem Rennen an einem Abend.',
    facts: [
      { strong: '7 Formate', rest: 'die Form des Boards' },
      { strong: '5 Regeln', rest: 'wie Felder aufgehen' },
      { strong: '3 Modifikatoren', rest: 'was eine Erledigung wert ist' },
    ],
    footnote:
      'Das Format wird bei der Anlage festgelegt, lässt sich danach aber im Overview-Reiter des Events ändern; die Aufdeckregel und die Punktmodifikatoren lassen sich jederzeit ändern, bevor die betroffenen Felder aufgedeckt sind.',

    shape: {
      title: 'Die Form des Boards',
      intro:
        'Das Format entscheidet, wie das Board gewertet wird und was das Anlageformular als Nächstes von dir will. Alles andere auf dieser Seite baut darauf auf.',
      note: {
        tag: 'Festes Raster oder Aufgabenliste',
        body: 'Ein **klassisches** Board ist ein echtes Quadrat, „N gleich 5“ heißt also exakt 25 Felder, und die Zahl kann sich nie ändern. Alles andere ist eine Aufgabenliste beliebiger Länge — und das ist auch die einzige Boardart, die ein Tabellenimport wachsen lassen kann. Willst du hundert Aufgaben erzeugen, fällt diese Entscheidung hier.',
      },
    },

    reveal: {
      title: 'Wie Felder aufgehen',
      intro:
        'Unabhängig vom Format. Der Aufdeckschalter auf Eventebene bleibt das Haupttor — solange ein Board verborgen ist, ist nichts sichtbar und keine dieser Mechaniken läuft; du stellst ein Board also immer bewusst scharf.',
      rows: [
        {
          term: 'Alles auf einmal',
          body: 'der Klassiker. Jedes Feld ist in dem Moment spielbar, in dem du das Board aufdeckst, und die Teams wählen ihre eigene Reihenfolge. Nimm das, wenn du keinen Grund dagegen hast.',
        },
        {
          term: 'Geplant',
          body: 'jedes Feld trägt seine eigene Aufdeckzeit, gesetzt im Tiles-Reiter, und geht auf, wenn diese Zeit erreicht ist. Ein „Feld der Stunde“-Board: es gibt den Takt vor und verlangt, dass die Zeiten vorab eingetragen werden.',
        },
        {
          term: 'Intervall',
          body: 'die Mechanik zieht verborgene Felder in festem Abstand — ein Schwung alle N Minuten, zufällig oder in Boardreihenfolge. Ein Bingo-Ausrufer. Kein zusätzlicher Aufwand über die Felder hinaus, und das Board deckt sich auf, während du schläfst.',
        },
        {
          term: 'Kopfgeld',
          body: 'genau ein Feld ist offen, und das erste Team, das es erledigt, holt es sich — das Feld schließt und das nächste wird sofort gezogen. Gnadenlos, sehr sehenswert, und unbarmherzig gegenüber Zeitzonen.',
        },
        {
          term: 'Rotierend',
          body: 'ein gleitendes Fenster mit ein paar offenen Feldern: jede Ziehung öffnet neue und lässt die ältesten auslaufen. Anders als beim Kopfgeld schaffen alle ein offenes Feld, bevor es verschwindet. Für Einzelleitern gebaut.',
        },
      ],
      note: {
        tag: 'Die Zeitzonenfrage',
        body: 'Kopfgeld- und Intervallboards belohnen den, der zufällig wach ist. In einem über die Welt verteilten Clan ist das ein echter Vorteil, den die Uhr verteilt und nicht das Spielen. Rotierende Fenster mildern das — ein offenes Feld bleibt so lange offen, wie das Fenster dauert, ein schlafender Spieler bekommt also trotzdem eine Chance.',
      },
    },

    scoring: {
      title: 'Was eine Erledigung wert ist',
      intro:
        'Drei Modifikatoren, alle nur im Punktmodus, alle in dem Moment in die Erledigung eingefroren, in dem sie passiert — eine spätere Änderung schreibt also nie die Geschichte um.',
      rows: [
        {
          term: 'Bonus fürs erste Team',
          body: 'Zusatzpunkte für das erste Team, das jedes Feld erledigt. Der billigste Weg, ein Board, auf dem alles sichtbar ist, wie ein Rennen wirken zu lassen, ohne sonst etwas zu ändern.',
        },
        {
          term: 'Wertverfall',
          body: 'der Wert eines Felds skaliert linear von voll bei der Aufdeckung auf einen Zielprozentsatz nach N Stunden und hält dann. Unter 100 % verfällt er und belohnt Tempo; über 100 % **wächst** er, was das Abarbeiten der alten Aufgaben belohnt, die alle übersprungen haben. Die wachsende Richtung ist die, deren Existenz die Leute vergessen.',
        },
        {
          term: 'Lockout',
          body: 'die erste Erledigung schließt das Feld für alle anderen. Beim Kopfgeld impliziert. Auf einem Board mit großem Stärkeunterschied kann das den Wettbewerb früh entscheiden — am besten ist es, wenn die Teams eng beieinander liegen.',
        },
      ],
    },

    missions: {
      title: 'Missionen: Überraschungen mitten im Event',
      body: [
        'Missionen sind vorab angelegte, aber zurückgehaltene Felder — aus einem eigenen Pool angekündigt, während der Rest des Boards sichtbar bleibt. Sie sind unabhängig von der Aufdeckregel, selbst ein ganz normales Bingo mit sichtbaren Feldern kann sie also haben.',
        'Wirf sie von Hand ein, wenn das Board still wird, in festem Abstand, oder nach einem Zeitplan je Mission. Jede Mission bringt ihre eigene Wertung mit: eigenen Lockout, Bonus, Wertverfall und Ablauf, pro Feld gesetzt statt fürs Event.',
        'Sie sind der billigste Weg, ein Board an Tag fünf aufzuwecken — und Tag fünf ist der Tag, an dem jedes lange Event geweckt werden muss.',
      ],
    },

    choose: {
      title: 'Auswählen, auf einer Seite',
      intro: 'Wenn du weißt, welches Gefühl du willst, ist das der kürzeste Weg dorthin.',
      rows: [
        { term: 'Ein normales Clanbingo', body: 'Klassisches Raster, alle Felder sichtbar. Ergänze einen Bonus fürs erste Team, wenn du etwas Dringlichkeit willst.' },
        { term: 'Hunderte Aufgaben, nach Schwierigkeit gewertet', body: 'Leagues, alles sichtbar. Das ist auch die einzige Form, in die ein großer Tabellenimport hineinwachsen kann.' },
        { term: 'Eine Woche, die auf etwas zuläuft', body: 'Leagues mit geplanter oder Intervall-Aufdeckung, damit sich das Board über die Woche öffnet statt auf einmal.' },
        { term: 'Ein Abend, den Leute live verfolgen', body: 'Kopfgeld. Ein Feld, das erste Team holt es, sofort das nächste.' },
        { term: 'Ein Einzelwettbewerb, kein Teamwettbewerb', body: 'Leiter mit rotierendem Fenster und Wertverfall. Aufgaben kommen und gehen, und niemand kann sie horten.' },
        { term: 'Ein Rennen mit Ziellinie', body: 'Feldrennen — eine geordnete Strecke, und wer am weitesten kommt, gewinnt.' },
      ],
      outro:
        'Was du auch wählst, die Felder selbst sind dieselbe Arbeit: siehe [Ein Board bauen, das sich selbst verfolgt]({boardGuide}).',
    },
  },

  fees: {
    metaTitle: 'Gebühren und Auszahlungen — Anvils Kassenwart-Anleitung',
    metaDescription:
      'Eine Teilnahmegebühr erheben, sie einsammeln, die zweite Unterschrift, die sie abschließt, und den Preistopf in ausgezahlte Platzierungen verwandeln.',
    eyebrow: 'Anvil · für Kassenwarte',
    title: 'Gebühren und Auszahlungen',
    dek: 'Geld ist der Punkt, an dem Clanevents schiefgehen, und sie gehen leise schief: eine Gebühr, von der jemand schwört, sie bezahlt zu haben, ein Topf, den niemand nachrechnen kann, eine Preisaufteilung, über die gestritten wird, nachdem die Gewinner sich ausgeloggt haben. Das ist der Weg, der bei jedem Schritt eine Spur hinterlässt.',
    facts: [
      { strong: '2 Unterschriften', rest: 'schließen eine Gebühr ab, standardmäßig' },
      { strong: 'Topf = eingelegt', rest: '+ Gebühr × bestätigte Anmeldungen' },
      { strong: '1 Zeile', rest: 'pro Person, die Geld bekommt' },
    ],
    footnote:
      'Gebühren und Auszahlungen sind die Oberfläche des Kassenwarts. Ein Kassenwart kann alles, was ein Moderator kann, plus das hier; ein Moderator kann eine Gebühr als eingesammelt markieren, sie aber nie abschließen.',

    set: {
      title: 'Die Gebühr festlegen',
      body: [
        'Die Teilnahmegebühr hängt am Event, gesetzt beim Anlegen oder bearbeitet über dessen **Sign-ups**-Reiter. Gar keine Gebühr ist eine völlig gute Antwort — viele Events laufen allein mit einem vom Ausrichter eingelegten Topf.',
        'Zwei Einstellungen entscheiden, was die Gebühr tatsächlich bedeutet, und sie werden leicht überlesen:',
      ],
      rows: [
        {
          term: 'Pro Person oder pro Account',
          body: 'bei einem Event, in dem Leute mit mehreren Accounts antreten dürfen, entscheidet das, ob sie einmal zahlen oder je einmal. Stimmt es nicht, wirst du Geld zurückzahlen.',
        },
        {
          term: 'Zahlungsfrist',
          body: 'nach ihrem Ablauf hören unbezahlte Anmeldungen auf, etwas zu sein, dem du hinterherläufst, und werden zu einer Entscheidung. Setz sie früher, als du denkst — der Tag vor dem Event ist zu spät, um Ersatz zu finden.',
        },
      ],
      note: {
        tag: 'Der Topf folgt den Anmeldungen',
        body: 'Der angezeigte Preistopf ist das, was du von Hand eingelegt hast, plus die Teilnahmegebühr mal die Zahl der **bestätigten** Anmeldungen. Er bewegt sich, während Anmeldungen bestätigt und ausgeschlossen werden — die Zahl auf der Seite ist also immer die, die du tatsächlich auszahlen könntest.',
      },
    },

    collect: {
      title: 'Einsammeln',
      body: [
        'Gebühren werden so eingesammelt, wie dein Clan ohnehin Geld einsammelt — im Spiel, in Discord, wie auch immer ihr das macht. Anvils Arbeit beginnt in dem Moment, in dem es ankommt: jemand mit Teamzugang markiert es als **bezahlt**, und das hält fest, wer sagt, er habe es entgegengenommen, und wann.',
        'Auch die Spieler haben ein Wort mitzureden. Ein Mitglied kann melden, an wen es gezahlt hat, und einen Screenshot anhängen — und genau das macht aus „ich hab definitiv bezahlt“ einen Eintrag mit zwei Enden. Wenn die Meldung des Spielers und die Angabe des Einsammlers verschiedene Personen nennen, ist das ein Widerspruch, den die Seite dir zeigen kann, statt dass du ihn mitten im Streit erfährst.',
      ],
      note: {
        tag: 'Der Nachweis wird absichtlich gelöscht',
        body: 'Ein Zahlungs-Screenshot wird nur bis zum Abschluss der Gebühr aufbewahrt und dann entfernt. Er existiert, um eine Meinungsverschiedenheit zu klären, nicht um ein Jahr im Archiv zu liegen.',
      },
    },

    sign: {
      title: 'Die zweite Unterschrift',
      body: [
        'Eine Gebühr steht auf **eingesammelt**, bis ein _anderes_ Teammitglied bestätigt, dass sie angekommen ist. Wer das Geld angefasst hat, kann nicht auch derjenige sein, der unterschreibt, dass es aufgetaucht ist — das ist die ganze Kontrolle, und deshalb weist die Seite die eigene Bestätigung eines Einsammlers zurück, statt bloß davon abzuraten.',
        'Wie viele Unterschriften eine Gebühr braucht, ist eine Clan-Einstellung, von null bis fünf. Null gibt es aus einem echten Grund: in einem Clan, in dem der Kassenwart _der_ Eigentümer ist, gibt es niemanden sonst zum Unterschreiben, und „34 Gebühren warten auf eine zweite Unterschrift“ wird zu einer Warteschlange, die sich nie leeren lässt, und dauerhaft zum Lautesten auf dem Dashboard. Bei null **ist** das Markieren als bezahlt die Unterschrift.',
        'Stell sie auf eins — den Standard — wenn ihr zu zweit seid. Stell sie auf null, wenn ihr das ehrlich nicht seid, und höher nur dann, wenn dein Clan sowohl die Leute als auch den Grund hat.',
      ],
    },

    pay: {
      title: 'Auszahlen',
      body: [
        'Wenn das Event endet, macht der **Payouts**-Reiter des Events aus dem Topf eine Liste von Menschen. Erzeuge sie, und du bekommst eine Zeile pro Empfänger, nicht pro Team: der Preis eines Siegerteams teilt sich zu gleichen Teilen auf seine Mitglieder auf, damit die Auszahlung eine Liste aus Namen und Zahlen ist und keine Rechenaufgabe um Mitternacht.',
        'Die Beträge starten aus einer vorgeschlagenen Aufteilung — siegerlastig, und je mehr bezahlte Plätze du setzt, desto flacher wird sie — und jede Zeile ist bearbeitbar. Der Vorschlag ist ein Ausgangspunkt, keine Vorgabe.',
        'Dann zahlst du aus und hakst die Zeilen dabei ab. Der Punkt ist, dass eine Woche später jeder auf die Liste schauen und sehen kann, wer was bekommen hat, statt es aus dem Discord-Verlauf zu rekonstruieren.',
      ],
      note: {
        tag: 'Kündige es einmal an, von hier',
        body: 'Auszahlungen werden aus dem Event selbst in eure Discord-Kanäle gepostet, Ankündigung und Eintrag sind also dasselbe. Ein von Hand angekündigter Preis ist ein Preis, von dem später jemand behauptet, er sei nie angekommen.',
      },
    },

    disputes: {
      title: 'Wenn die Zahlen nicht zusammenpassen',
      intro: 'Die vier, die dir wirklich begegnen:',
      rows: [
        {
          term: 'Er sagt, er habe bezahlt, niemand hat es markiert',
          body: 'bitte ihn, die Zahlung mit einem Screenshot zu melden. Das setzt einen benannten Einsammler und einen Zeitstempel in den Eintrag, und die benannte Person kann bestätigen oder widersprechen.',
        },
        {
          term: 'Zwei aus dem Team glauben beide, es entgegengenommen zu haben',
          body: 'die eigene Meldung des Spielers ist der Stichentscheid — sie nennt, wem er das Geld gegeben hat. Korrigiere den Einsammler, und schließe dann ab.',
        },
        {
          term: 'Eine Gebühr hängt und wartet auf eine Unterschrift',
          body: 'entweder wartet sie wirklich auf jemand anderen, oder dein Clan hat weniger Leute im Team, als die Einstellung für nötige Bestätigungen annimmt. Senk die Einstellung, statt deine eigene Einsammlung zu bestätigen.',
        },
        {
          term: 'Der Topf hat sich geändert, nachdem du es angekündigt hast',
          body: 'er folgt den bestätigten Anmeldungen, eine Anmeldung zu bestätigen oder auszuschließen verschiebt ihn also. Nenne den Topf so, wie er beim Schließen der Anmeldung steht, nicht beim Öffnen.',
        },
      ],
    },
  },

  moderator: {
    metaTitle: 'Im Dienst — Anvils Moderatorenanleitung',
    metaDescription:
      'Ein Moderatorentag auf einer Anvil-Clanseite: die Warteschlange, das Prüfen von Einreichungen und Accounts, die Mitgliederliste ehrlich halten, und die Ermessensfragen.',
    eyebrow: 'Anvil · für Moderatoren',
    title: 'Im Dienst',
    dek: 'Ein Moderator erledigt die Arbeit, die anfällt, egal ob ein Event läuft: Nachweise zum Ansehen, Accounts zum Verifizieren, eine Mitgliederliste, die abdriftet. Hier steht, woraus die Warteschlange besteht, und wie du sie leerst, ohne selbst der Grund zu sein, warum Leute warten.',
    facts: [
      { strong: 'Keine Events', rest: 'ein Moderator kann sie weder anlegen noch bearbeiten' },
      { strong: 'Eine Seite', rest: 'sagt, was auf dich wartet' },
      { strong: 'Schnell bestätigen', rest: 'eine träge Warteschlange wirkt wie eine kaputte Seite' },
    ],
    footnote:
      'Ein Moderator sieht alles, was ein Mitglied sieht, plus die Prüfoberflächen. Events anlegen und bearbeiten, Einstellungen, Team und Auszahlungen sind Admin- und Kassenwartaufgaben — fehlt eine Schaltfläche, ist das der Grund, und es ist Absicht.',

    what: {
      title: 'Was die Rolle ist',
      intro:
        'Die Rollen stapeln sich nach unten: alles, was ein Moderator kann, können auch ein Kassenwart und ein Admin. Was ein Moderator speziell besitzt:',
      canList: [
        'die Mitgliederliste: synchronisieren, Leute hinzufügen, einen Gast befördern',
        'Accountverifizierungen — die XP-Aufgabe und die manuelle Prüfung',
        'Einreichungen und Nachweis-Screenshots',
        'Wochenwettbewerbe und den Terminplan',
        'Rückmeldungen der Mitglieder',
      ],
      cantIntro: 'Was sie bewusst nicht können:',
      cantList: [
        'ein Event oder dessen Felder anlegen oder bearbeiten',
        'Clan-Einstellungen oder die Discord-Anbindung ändern',
        'jemanden befördern oder das Team anfassen',
        'eine Gebühr abschließen oder eine Auszahlung durchführen',
      ],
    },

    queue: {
      title: 'Fang bei dem an, was auf dich wartet',
      body: [
        'Das Admin-Dashboard ist keine Zusammenfassung der Seite — es ist eine Liste dessen, was wartet, sortiert danach, wie sehr es zählt, aus echten Daten berechnet statt aus Zählern, die abdriften. Sagt es, dass nichts auf dich wartet, wartet nichts.',
        'Arbeite von oben nach unten. Die Punkte, die nach oben rutschen, sind die mit einem Menschen am anderen Ende: jemand, der sich nicht anmelden kann, weil sein Account nicht verifiziert ist, oder dessen Drop nicht gezählt hat, weil noch niemand hingesehen hat.',
      ],
    },

    submissions: {
      title: 'Einreichungen und Nachweise',
      body: [
        'Die meisten Gutschriften erreichen dich nie: das Plugin sieht den Drop, legt einen mit Team und UTC-Zeitstempel gestempelten Screenshot ab, und das Feld wird fertig. In der Warteschlange landen die manuellen Felder und alles, was das Plugin markiert hat.',
        'Der Stempel ist das, was einen Nachweis schwer bestreitbar macht. Ein Plugin-Screenshot trägt Team und Zeitpunkt ins Bild eingebacken, und mit Zwei-Bild-Nachweis zeigt ein zweites Bild ein paar Sekunden später den Loot auf dem Boden liegend. Ein Screenshot ohne all das ist ein Screenshot vom Handy, was völlig in Ordnung ist — es heißt nur, dass du derjenige bist, der prüft.',
      ],
      rows: [
        {
          term: 'Bestätige, wenn es plausibel ist',
          body: 'du prüfst keine Bank. Zeigt das Bild die Sache, steht der Account auf der Mitgliederliste und liegt der Zeitstempel im Event, bestätige und mach weiter.',
        },
        {
          term: 'Lehne mit Begründung ab',
          body: 'eine Ablehnung ohne Erklärung kommt innerhalb einer Stunde als DM zu dir zurück. Sag, was gefehlt hat, damit der zweite Versuch stimmt.',
        },
        {
          term: 'Eine markierte Einreichung ist eine Frage, kein Vorwurf',
          body: 'das Plugin markiert, was es nicht vollständig bestätigen konnte — meistens einen Spieler, der keine Startaufnahme eingereicht hat. Lies es als „sieh dir die mal an“, nicht als „jemand hat betrogen“.',
        },
      ],
    },

    verify: {
      title: 'Accounts verifizieren',
      intro:
        'Niemand kann sich ohne mindestens einen verifizierten Account für ein Event anmelden, diese Warteschlange hindert Leute also unmittelbar am Spielen. Sie lohnt sich täglich zu leeren.',
      rows: [
        {
          term: 'Per Plugin verifiziert',
          body: 'der Normalfall, und er verlangt nichts von dir. Den Account mit verbundenem Plugin zu spielen verknüpft ihn automatisch, und ein stabiler Account-Fingerabdruck lässt die Verknüpfung eine Namensänderung überleben.',
        },
        {
          term: 'Verify by XP',
          body: 'für Spieler ohne Plugin. Die Seite wählt einen zufälligen Skill, und sie müssen darin binnen dreißig Minuten 1.000 XP sammeln. Das prüft sich selbst — du siehst nur die, die scheitern.',
        },
        {
          term: 'Manuelle Prüfung',
          body: 'verborgene Hiscores, oder ein Zweitaccount, der zu neu ist, um dort aufzutauchen. Jemand reicht einen RSN mit Notiz ein, und du entscheidest. Frag nach einem Screenshot des Anmeldebildschirms, wenn die Notiz nicht reicht.',
        },
      ],
      note: {
        tag: 'Verifiziert ist nicht Mitglied',
        body: 'Einen Account zu verifizieren sagt „der gehört wirklich ihm“. Es macht ihn nicht zum Teil des Clans — Clanmitgliedschaft kommt nur aus einer Synchronisierung der Mitgliederliste im Spiel oder von einem Admin, der ihn von Hand hinzufügt. Wer verifiziert, aber nicht auf der Liste ist, ist ein **Gast**: erfasst, sichtbar, kein Mitglied. Das ist Absicht, und genau das hindert jemanden daran, deinem Clan durch Eintippen eines Namens beizutreten.',
      },
    },

    roster: {
      title: 'Die Mitgliederliste ehrlich halten',
      body: [
        'Die Mitgliederliste kommt aus genau einer Quelle: ein Admin startet eine Synchronisierung aus der Clanliste im Spiel, über den Bingo-Reiter des Plugins im Collection Log. Alles andere — Verifizierungen, Verknüpfungen, Anmeldungen — hängt daran.',
        'Die Pflegearbeit ist also klein, aber real: starte die Synchronisierung nach jeder Rekrutierungsrunde, befördere die Gäste, die tatsächlich beigetreten sind, und sieh dir die Leute an, die die Seite zur Prüfung markiert hat, statt zu warten, bis sie sich beschweren.',
      ],
      note: {
        tag: 'Zuletzt gesehen ist nicht zuletzt gespielt',
        body: 'Der Zeitstempel „zuletzt im Clan gesehen“ hält die letzte Synchronisierung fest, die das Mitglied gefunden hat, nicht seine letzte Anmeldung. Für „spielt er noch“ lies stattdessen die Zeit seiner Live-Statistik — die ist die, die sich von selbst bewegt.',
      },
    },

    startshot: {
      title: 'Startaufnahmen prüfen',
      body: [
        'Bei einem Event, das eine verlangt, muss jeder Spieler einen Screenshot einreichen, aufgenommen nach dem Eventstart, an einem im Startmoment ausgelosten Ort. Plugin-Aufnahmen mit verifiziertem Kennwort kommen bereits bestätigt an, in der Praxis siehst du dir also nur die Spieler an, die von Hand vom Handy hochgeladen haben.',
        'Was du prüfst, ist wenig: dass der Charakter im Bild ist, dass das Kennwort im Chatfenster steht, und dass es das Kennwort ist, das dieser Spieler tatsächlich bekommen hat. Die Uploads zählen sofort, und du prüfst sie im Nachhinein — niemand wird also am Spielen gehindert, während er auf dich wartet.',
      ],
    },

    judgement: {
      title: 'Die Entscheidungen, die du treffen musst',
      intro:
        'Keine davon hat eine richtige Antwort in Software, und genau deshalb landen sie bei einem Menschen.',
      rows: [
        {
          term: 'Der Nachweis ist echt, aber spät',
          body: 'der Drop passierte innerhalb des Events, und der Screenshot kam danach. In der Regel bestätigen — sieh auf den Stempel im Bild, nicht auf die Uploadzeit.',
        },
        {
          term: 'Der Account ist noch nicht verknüpft',
          body: 'der Drop ist echt, der Account gehört ihm, er wurde nur vor dem Spielen nicht hinzugefügt. Lass ihn verknüpfen, dann bestätige. Lass niemanden wegen Papierkram ein Raid wiederholen.',
        },
        {
          term: 'Es sieht gestellt aus',
          body: 'bring es zu einem Admin, statt es selbst abzulehnen. Eine Ablehnung ist in einem kleinen Clan eine öffentliche Anschuldigung, und sie sollte nie die schnelle Entscheidung einer einzelnen Person sein.',
        },
        {
          term: 'Du bist selbst im Event',
          body: 'das bist du mit ziemlicher Sicherheit. Gib alles, was dein eigenes Team betrifft, an einen anderen Moderator ab — nicht weil du unfair wärst, sondern weil du nicht beweisen müssen sollst, dass du es nicht warst.',
        },
      ],
    },
  },
};

export default de;
