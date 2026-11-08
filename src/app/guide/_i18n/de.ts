import type { PartialGuideDict } from './en';

// Deutsch — German.
//
// Gleiche Konvention wie in allen anderen Sprachdateien hier: alles, was der Leser in Anvil,
// RuneLite und OBS tatsächlich AUF DEM BILDSCHIRM SIEHT, bleibt auf Englisch — Menüs in RuneLite
// und OBS, die Chatzeilen des Plugins selbst, und Anvils eigene Admin-Beschriftungen, die englisch
// sind, bis auch jene Oberfläche übersetzt wird. Ein übersetztes „Tracked drop detected“ ist eine
// Zeile, die niemand wiederfindet. Discords eigene Beschriftungen (Menüs, Einstellungen,
// Berechtigungen) folgen dagegen Discords offizieller deutscher Übersetzung — dem, was ein auf
// Deutsch gestelltes Discord anzeigt; wo Discord nicht übersetzt ist, blieben sie englisch. Alles
// andere — die Erklärung, die Reihenfolge, das Warum — ist deutsch.

const de: PartialGuideDict = {
  common: {
    contents: 'Inhalt',
    step: 'Schritt',
    optional: 'optional',
    minRead: '{n} Min. Lesezeit',
    copyLink: 'Link zu diesem Abschnitt kopieren',
    linkCopied: 'Link kopiert',
    language: 'Sprache',
    partialNotice:
      'Diese Anleitung ist nur teilweise ins {language} übersetzt. Was noch nicht übersetzt ist, erscheint auf Englisch.',
    backToGuides: 'Alle Anleitungen',
    unreviewedNotice:
      'Diese Übersetzung ins {language} wurde noch von keinem Muttersprachler gegengelesen. Wenn sich ein Satz falsch liest, ist [die englische Seite]({englishHref}) das Original — und [uns Bescheid zu geben](/feedback) ist das, was ihn korrigiert.',
    support: {
      lead: 'Hängst du fest oder sieht etwas falsch aus?',
      link: 'Frag im Anvil-Support-Discord',
    },
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
      streamers: 'Streamer',
    },
    anvilTab: 'Anvil nutzen',
    ingame: {
      title: 'Spiel-Guides',
      dek: 'Raids, Bosse, Skilling und Geldverdienen aus der Anvil-Bibliothek — dieselben Guides, die das Plugin im Spiel zeigt und der Bot in Discord postet.',
      browse: 'Alle Guides ansehen',
      language: 'Diese Guides sind nicht übersetzt: Sie erscheinen so, wie sie geschrieben wurden, egal in welcher Sprache diese Seite ist.',
      empty: 'Die Anvil-Bibliothek hat noch keine veröffentlichten Guides. Schau bald wieder vorbei.',
      placeholder: 'Spiel-Guides durchsuchen — probier "zulrah", "raids" oder "money"',
      readTime: '{n} Min. Lesezeit',
      metaTitle: 'OSRS-Spiel-Guides — Anvil',
      metaDescription: 'Guides zu Raids, Bossing, Skilling und Geldverdienen aus der Anvil-Bibliothek — auf der Website, im Spiel über das RuneLite-Plugin und in Discord.',
    },
    search: {
      placeholder: 'Anleitungen durchsuchen — probier "Webhook", "Felder" oder "Drops werden nicht angezeigt"',
      results: '{n} Anleitungen',
      empty: 'Nichts gefunden. Probier ein schlichteres Wort — "Felder", "Auszahlung", "Bot" — oder sieh die Liste unten durch.',
      clear: 'Suche zurücksetzen',
    },
    cards: {
      tiles: {
        eyebrow: 'Für Spieler',
        title: 'Feldregeln und Grenzen',
        blurb: 'Was ein Feld von dir braucht, bevor du loslegst (eine Spieleinstellung, das Plugin, ein synchronisiertes Log, ein Hiscores-Rang), und was es nicht erfassen kann.',
        minutes: '~4 Min.',
      },
      discord: {
        eyebrow: 'Für alle, die den Server betreuen',
        title: 'Anvil in Discord',
        blurb: 'Eine Einladung, dann die Kanäle für jeden Feed, Rollen, Slash-Befehle und was zu prüfen ist, wenn es stockt.',
        minutes: '~5 Min.',
      },
      switching: {
        eyebrow: 'Umstieg auf Anvil',
        title: 'Umstieg von Dink oder Wise Old Man',
        blurb:
          'Anvil postet deine Drops auf Discord und führt eure Wochenwettbewerbe durch. Fünf Schritte für die Leitung, zwei für Spieler.',
        minutes: '~3 Min.',
      },
      clan: {
        eyebrow: 'Für alle, die einen gründen',
        title: 'Clan gründen',
        blurb: 'Zwei Namen und eine Adresse, und er ist online. Dann Discord, deine Mitgliederliste und das erste Board.',
        minutes: '~4 Min., kostenlos',
      },
      plugin: {
        eyebrow: 'Für Spieler',
        title: 'RuneLite-Plugin einrichten',
        blurb:
          'Plugin installieren, über sein Seitenpanel anmelden, und deine Drops von ihm einreichen lassen. Deckt auch Discord-Benachrichtigungen und die Spielersuche ab.',
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
      coffer: {
        eyebrow: 'Für Kassenwarte',
        title: 'Die Clankasse',
        blurb:
          'Ein Topf für das Gold des Clans: was hineinkommt, die drei Wege, auf denen er Preise auszahlt, und wer ihn bewegen darf.',
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
      commands: {
        eyebrow: 'Für alle Mitglieder',
        title: 'Slash-Befehle',
        blurb:
          'Jeder Befehl, auf den der Bot in Discord antwortet, was jede Option tut, durchgespielte Beispiele, und was du prüfst, wenn einer nicht auftaucht.',
        minutes: '~6 Min.',
      },
      creators: {
        eyebrow: 'Für Streamer',
        title: 'Events für deine Zuschauer veranstalten',
        blurb:
          'Kein Clan nötig. Erstelle einen Space, teile einen Link, wähle, wer mitmachen darf (Follower, Subs, Discord-Rollen) und zeig das Board im Stream.',
        minutes: '~6 Min.',
      },
      joiningStream: {
        eyebrow: 'Für Zuschauer',
        title: 'Beim Event eines Streamers mitmachen',
        blurb:
          'Link aus einem Stream bekommen? Anmelden, Charakter hinzufügen, Join drücken. Was du bei Events nur für Follower oder Subs tun musst.',
        minutes: '~2 Min.',
      },
      streamingClans: {
        eyebrow: 'Für Clans, die streamen',
        title: 'Streaming für Clans',
        blurb:
          'Lass deine Zuschauer bei einem Event mitspielen, ohne dem Clan beizutreten. Streaming einschalten, dann ein Event für Zuschauer öffnen.',
        minutes: '~2 Min.',
      },
      people: {
        eyebrow: 'Für das Clan-Team',
        title: 'Deine Leute: Mitgliederliste, Gäste und wer beitreten darf',
        blurb:
          'Woher Mitglieder kommen, was die Filter im Roster-Reiter bedeuten, Beitrittsanfragen und Needs review, die drei Einstellungen unter Who can join, und jemanden entfernen oder sperren.',
        minutes: '~6 Min.',
      },
      staffRoles: {
        eyebrow: 'Für Eigentümer und Admins',
        title: 'Teamrollen: wer was darf',
        blurb:
          'Eigentümer, Admin, Kassenwart und Moderator: was jede Rolle erreicht, wie du jemanden zum Moderator machst, wer welche Rolle vergeben darf, und Aufgaben für ein einzelnes Event.',
        minutes: '~6 Min.',
      },
      supporter: {
        eyebrow: 'Für Spieler',
        title: 'Anvil Supporter: Stufen und Vorteile',
        blurb:
          'Supporter, Champion und Patron: Namensfarben, der Stern, Profilbilder, die Vitrine, Freundes-Events und Clan-Boosts, wie die Abrechnung läuft und was passiert, wenn du aufhörst.',
        minutes: '~6 Min.',
      },
      sidePanel: {
        eyebrow: 'Für Spieler',
        title: 'Das Seitenpanel, Tab für Tab',
        blurb:
          'Clan, Feed, You, Lookup und das Zahnrad: was jeder Tab zeigt, Event-Chat, GZ- und Sad-Reaktionen, und die Einstellungen, die den Feed und die Supporter-Farben in dein Spiel bringen.',
        minutes: '~6 Min.',
      },
      clanBoosts: {
        eyebrow: 'Für Supporter und das Clan-Team',
        title: 'Einen Clan boosten',
        blurb:
          'Einen Boost setzen und verschieben, die drei Stufen und was jede freischaltet, die Namensfarben des Clans, geschenkte Boosts, und Booster-Zeichen und Abzeichen.',
        minutes: '~5 Min.',
      },
    },
  },

  switching: {
    metaTitle: 'Umstieg von Dink oder Wise Old Man — Anvil',
    metaDescription:
      'Hol deinen Clan von Dink und Wise Old Man zu Anvil: Discord-Kanäle einrichten, Clanliste synchronisieren, Skill oder Boss of the Week starten und deine Mitglieder informieren.',
    eyebrow: 'Umstieg auf Anvil',
    title: 'Umstieg von Dink oder Wise Old Man',
    dek: 'Anvil übernimmt beide Aufgaben. Es postet die Drops und Erfolge deines Clans auf Discord. Außerdem pflegt es die Clanliste und führt Wochenwettbewerbe durch.',

    staff: {
      title: 'Wenn du den Clan leitest',
      body: [
        '**Lass den Bot deine Kanäle einrichten.** Gehe zu Admin → Discord → **Set it up for me**. Wähle einen oder mehrere Kanäle. Falls Dink irgendwo gepostet hat, hake _Use the same channels_ an. Für deine Mitglieder ändert sich nichts.',
        '**Synchronisiere die Clanliste.** Öffne in RuneLite die Einstellungen des Anvil-Plugins. Schalte **Keep the clan roster in sync** ein. Ein Admin macht das einmal, im Spiel. Das ersetzt deine Wise-Old-Man-Gruppe.',
        '**Starte einen Skill oder Boss of the Week.** Gehe zu Admin → All events → **+ New event** und wähle Skill of the Week oder Boss of the Week. Alle auf der Clanliste sind automatisch dabei. Das ersetzt die Wise-Old-Man-Wettbewerbe.',
        '**Informiere deine Mitglieder.** Gehe zu Admin → Discord → **Tell your members** → **Post it**. Der Bot postet die Schritte für Spieler für dich.',
        '**Eine Woche später: aufräumen.** Gehe zu Admin → Discord → **Remove Dink’s old webhooks**, hake die an, die weg sollen, klicke auf **Remove … webhooks** und dann auf **Yes, remove them**. Danach kann nichts mehr doppelt gepostet werden. Klicke bei allen, die du in Ruhe lassen willst, auf **Keep**.',
      ],
    },

    player: {
      title: 'Wenn du Spieler bist',
      body: [
        '**Installiere Anvil.** Öffne in RuneLite den Plugin Hub, suche nach Anvil und klicke auf **Install**. Melde dich dann im Anvil-Seitenpanel mit Discord an.',
        '**Schalte die Benachrichtigungen von Dink aus.** Oder deinstalliere Dink, falls du es für nichts anderes brauchst.',
        '**Das war’s.** Für Wise Old Man musst du nichts tun.',
      ],
    },

    questions: {
      title: 'Fragen',
      intro: 'Die, die Clans am häufigsten stellen:',
      rows: [
        {
          term: 'Können wir Dink für manche Dinge behalten?',
          body: 'Ja. Anvil postet keine Kill Counts, Slayer-Aufgaben oder Speedruns. Lass in Dink nur diese eingeschaltet.',
        },
        {
          term: 'Brauchen wir Wise Old Man noch?',
          body: 'Nur für Allzeit-Rekorde und EHP- / EHB-Ränge.',
        },
        {
          term: 'Müssen Spieler irgendwo einen Webhook einfügen?',
          body: 'Nein. Der Clan legt die Kanäle auf der Website fest.',
        },
        {
          term: 'Willst du Posts auch auf deinem eigenen Server?',
          body: 'Gehe zu deinem Profil → **Announcements & webhooks** → _Your own webhooks_.',
        },
      ],
    },
  },

  clan: {
    metaTitle: 'Clan gründen — Anvil',
    metaDescription: 'Einen Clan auf Anvil erstellen: benennen, Adresse wählen, Discord verbinden, Mitgliederliste synchronisieren und das erste Event starten.',
    eyebrow: 'Anvil · Erste Schritte',
    title: 'Clan gründen',
    dek: 'Zwei Namen und eine Adresse, und dein Clan ist online — kostenlos, ohne Wartezeit. Genau das steht hier, plus die vier Dinge, die sich direkt danach lohnen.',
    facts: [
      {
        strong: 'Kostenlos',
        rest: 'keine Karte, keine Testphase',
      },
      {
        strong: 'Sofort online',
        rest: 'sobald du absendest',
      },
      {
        strong: '~4 Min.',
        rest: 'bis zum fertigen Clan',
      },
    ],
    footnote: 'Alles davon kannst du später unter Admin → **Clan settings** ändern — außer der Adresse. Über die lohnt sich jetzt ein kurzer Gedanke.',
    before: {
      title: 'Bevor du loslegst',
      body: [
        'Du brauchst ein Discord-Konto, das ist die ganze Liste. Melde dich zuerst auf `{apex}` an: ein Clan braucht einen Besitzer, und über die Anmeldung weiß die Seite, dass du das bist. Starte über **Clan gründen** auf den Plattformseiten oder direkt über `{apex}/clans/new`.',
        'Es kostet nichts. Kein Tarif, keine Karte und keine Testphase, die abläuft und dein Board mitnimmt — ein Clan startet kostenlos und bleibt nutzbar.',
        'Große Clans können später unter **Plan and billing** im Admin-Bereich in einen höheren Tarif wechseln. Alles, wofür du auf Anvil zahlst — ein Clan, ein Creator-Space oder deine eigene Supporter-Mitgliedschaft —, findest du auf [deiner Abrechnungsseite](/portal).',
      ],
      note: {
        tag: 'Du wirst sein Besitzer',
        body: 'Besitzer ist die eine Rolle, die dir niemand nehmen kann, und sie geht an den, der den Clan erstellt. Weitere Team-Mitglieder fügst du danach unter Admin → **People** → **Staff & roles** hinzu; siehe [Im Dienstplan]({moderatorGuide}).',
      },
    },
    create: {
      title: 'Benennen und Adresse wählen',
      intro: 'Drei Felder, nur zwei echte Entscheidungen. Das Formular prüft die Adresse beim Tippen und sagt dir vor dem Absenden Bescheid.',
      fields: [
        {
          term: 'Clanname im Spiel',
          body: 'Pflichtfeld, und er muss **exakt** mit OSRS übereinstimmen. Das ist keine Deko: Die Roster-Synchronisierung gleicht darüber ab und lehnt jede Mitgliederliste ab, die unter einem anderen Namen gemeldet wird. Genau das verhindert, dass die Liste eines fremden Clans auf deiner Seite landet.',
        },
        {
          term: 'Clanname',
          body: 'Optional. Das, was die Leute sehen — auf der Seite und in jedem Discord-Post. Lässt du es leer, wird dein Spielname für beides verwendet.',
        },
        {
          term: 'Adresse',
          body: 'Dein Clan liegt unter `{apex}/c/dein-slug`. Sie wird aus dem Namen vorgeschlagen, du kannst sie bearbeiten, und einige Wörter sind reserviert. Wähle eine, die dir in einem Jahr noch gefällt: Das ist der Link, der in deinem Discord angepinnt wird.',
        },
      ],
      note: {
        tag: 'Der Spielname ist ein Schloss, kein Etikett',
        body: 'Wird dein Clan im Spiel umbenannt, ändere ihn auch hier — bis dahin lehnt die Roster-Synchronisierung den neuen Namen ab. Das ist die Prüfung bei der Arbeit, kein Fehler.',
      },
    },
    live: {
      title: 'Er ist online',
      body: [
        'Drücke **Clan erstellen**, und er existiert. Kein Bereitstellen, keine Warteschlange, kein „wir bauen deine Seite, schau gleich nochmal vorbei“ — ein Clan ist eine Zeile, also läuft er schon, bevor die Seite fertig gewechselt hat.',
        'Du landest bei der Wahl zwischen **Einrichten**, was den Assistenten öffnet, und **Erst mal umsehen**. Nichts geht kaputt, wenn du morgen wiederkommst; der Assistent merkt sich die erledigten Schritte.',
      ],
    },
    setup: {
      title: 'Der Einrichtungsassistent',
      intro: 'Drei Schritte stehen zwischen einem frischen Clan und einem laufenden Event, und der Assistent geht sie der Reihe nach durch und überspringt, was schon erledigt ist. Das Board kommt direkt danach.',
      steps: [
        {
          term: 'Dein Clan',
          body: 'Dein Anzeigename, dein Clanname im Spiel und ein Einladungslink zu deinem Server. Über die Einladung können Anmeldeseiten und Guides auf dich verweisen.',
        },
        {
          term: 'Discord verbinden',
          body: 'Ein gemeinsamer Bot, also keine App zu registrieren und kein Token einzufügen. Drück **Connect your bot** und bestätige einmal, wähle dann **A few channels** oder **Just one channel** und drück **Set it up for me** — der Bot legt die Kanäle für dich an.',
        },
        {
          term: 'Deine Mitglieder hereinholen',
          body: 'Installiere das Plugin, melde dich mit Discord an, öffne dann im Spiel dein Clan-Fenster und drück den **Anvil**-Button in seiner Titelleiste. Niemand kann sich für ein Event anmelden, bevor deine Mitgliederliste drin ist.',
        },
        {
          term: 'Board erstellen',
          body: 'Der Assistent endet bei **Create your first event →**. Format wählen, Felder anlegen, Anmeldungen öffnen — das ist [Dein erstes Event durchführen]({adminGuide}), und mit Abstand der längste Schritt.',
        },
      ],
      after: [
        'Du kannst den Assistenten mit **Skip setup** komplett überspringen und alles später unter Admin → **Clan settings** und Admin → **Discord** erledigen. Er existiert, weil die Reihenfolge zählt, wenn man es noch nie gemacht hat: Discord vor Kanälen, Mitglieder vor einem Board, für das sie sich anmelden müssen.',
      ],
    },
    members: {
      title: 'Deine Mitglieder hereinholen',
      body: [
        'Niemand muss sich anmelden, registrieren oder einzeln eingeladen werden. Deine Mitgliederliste kommt aus dem Spiel.',
      ],
      ways: [
        {
          term: 'Roster-Synchronisierung (nimm die)',
          body: 'Öffne im Spiel das Clan-Fenster bei laufendem Plugin und drücke den **Anvil**-Button in der Titelleiste. Deine ganze Mitgliederliste kommt mitsamt Rängen an, und eine Liste aus einem Clan, dessen Name nicht passt, wird abgelehnt. Wiederhole das, wenn Leute kommen oder gehen — siehe den [Spieler-Einrichtungsguide]({pluginGuide}).',
        },
        {
          term: 'Sie bitten um Beitritt',
          body: 'Sich anmelden oder mit dem Plugin spielen gibt niemandem von selbst einen Sitz. Sieht das Plugin jemanden in deinem Clan im Spiel spielen, bevor deine Mitgliederliste ihn hat, stellt es für ihn eine Beitrittsanfrage, und alle anderen können mit **Apply** auf deiner Clanseite fragen. Das Team beantwortet beides oben im Reiter **Roster**, und **Who can join** entscheidet, ob sie auf ein Ja warten, sofort reinkommen oder gar nicht fragen können. Wer einen Charakter spielt, der schon auf deiner Mitgliederliste steht, wird stattdessen unter **Needs review** bestätigt. Die Details stehen in [Deine Leute]({peopleGuide}).',
        },
        {
          term: 'Von Hand',
          body: 'Unter Admin → **People** → **+ Add Manually** kannst du Namen einzeln eintragen — für die Person am Handy oder im offiziellen Client, die das Plugin gar nicht nutzen kann.',
        },
      ],
      note: {
        tag: 'Gäste sind kein zu lösendes Problem',
        body: 'Ein Gast spielt bei deinen Events mit, ohne in deinem Clan im Spiel zu sein: ein Spieler eines Gastclans, ein Freund, ein Twink. Er bekommt einen Sitz, wenn das Team seine Anfrage annimmt, oder sofort, wenn **Who can join** auf **Let anyone in** steht. Gäste werden erfasst, können an Events teilnehmen und zählen nicht für deinen Tarif. Wer deinem Clan im Spiel beitritt, wird bei der nächsten Synchronisierung der Mitgliederliste Mitglied.',
      },
    },
    first: {
      title: 'Dein erstes Event',
      body: [
        'Der kürzeste Weg zu etwas Passierendem: ein Board anlegen, ein paar Felder hinzufügen, die das Plugin von allein sieht, Anmeldungen öffnen und starten. Drops, Killcounts und XP tragen sich dann von selbst ein.',
        'Zwei Guides tragen hier die Last. [Dein erstes Event durchführen]({adminGuide}) führt von Anfang bis Ende — Discord, Teams, Start und was am Ende zu tun ist. [Ein Board bauen, das sich selbst trackt]({boardGuide}) geht speziell um Felder: was jede Art wirklich erkennen kann und welche sich sauber importieren und dann nie auslösen.',
        'Wenn du in der ersten Woche lieber gar kein Board bauen willst, mach stattdessen ein **Skill of the Week** oder **Boss of the Week**. Alle auf der Liste sind automatisch dabei, die Wertung läuft über die Hiscores, und es gibt nichts zu erstellen.',
      ],
    },
    together: {
      title: 'Events über mehrere Clans hinweg',
      body: [
        'Ein Event muss nicht zu einem Clan gehören. Mehrere Clans können dasselbe Board gemeinsam austragen — zwei oder ein Dutzend — wobei jede Seite ihre eigene Mitgliederliste, ihr eigenes Team und ihre eigene Hälfte der Moderation behält.',
        'Sie können sich auch einen Spielerpool teilen, statt auf gegenüberliegenden Seiten einer Wertung zu sitzen: ein Event, alle dabei, wie auch immer die Teams geschnitten werden. Clan gegen Clan ist eine Form davon, nicht die einzige.',
        'Jeder Gastclan bekommt einen Einladungslink pro Team, sodass du nie einen RSN von Hand einsammelst, und einen Sitz, mit dem der eigene Moderator die Nachweise der eigenen Mitglieder freigeben kann. [Einen Gastclan aufnehmen]({clanVsClanGuide}) behandelt das Ausrichten.',
      ],
      note: {
        tag: 'Nichts zu kaufen',
        body: 'An fremden Events teilzunehmen ist kostenlos, und eines auszurichten ebenfalls. Ein Clan, der nur bei den Boards anderer auftaucht, braucht nie mehr als seinen eigenen kostenlosen Clan.',
      },
    },
    boosts: {
      title: 'Clan-Boosts',
      body: [
        'Mitglieder, die Anvil Supporter als **Champion** (ein Boost) oder **Patron** (zwei) bezahlen, können den Clan in ihren eigenen **Settings → Clan boosts** boosten. Ein Boost zählt, sobald ihr Platz im Clan 14 Tage alt ist, und von einer Person zählen höchstens zwei.',
        'Wo du stehst, siehst du unter Admin → **Clan settings** → **Boosts**: die Stufe des Clans, wie viele Boosts gerade zählen und wie viele die nächste Stufe noch braucht. Stufe 1 braucht 3 Boosts, Stufe 2 braucht 8 und Stufe 3 braucht 15. Fallen die Boosts unter eine Stufe, bleiben ihre Vorteile zuerst noch eine Woche erhalten.',
        'Stufe 1 setzt ein **Boosted**-Abzeichen auf deine Clanseite, deine Karte in der Clan Hall und in die Suche, listet dich in der Clan Hall über Clans ohne Boost und gibt deinem Namen einen Farbverlauf. Stufe 2 bringt einen Platz in der Featured-Reihe der Clan Hall, spielt dein animiertes Banner ab und schaltet eine **Recruiting line** frei: ein Satz mit bis zu 140 Zeichen, den Besucher sehen. Stufe 3 bringt ein Spotlight ganz oben in der Clan Hall und einen **Recruitment post in the Anvil Discord** pro Monat, bis zu 500 Zeichen, einmal gesendet mit **Post to the Anvil Discord**, mit einem Link zu deiner Clanseite und ohne dass jemand gepingt wird.',
      ],
      note: {
        tag: 'Nur die Optik',
        body: 'Boosts ändern, wie der Clan aussieht und wo er gelistet wird. Sie ändern nie einen Rang, eine Wertung, deine Sitze oder deinen Tarif.',
      },
    },
  },

  discord: {
    metaTitle: 'Anvil in Discord — Anvil',
    metaDescription: 'Den Anvil-Bot mit deinem Discord-Server verbinden: eine Einladung, die Kanäle für jeden Feed, Rollen- und Nicknamen-Sync, Slash-Befehle und was zu prüfen ist, wenn es still wird.',
    eyebrow: 'Anvil · Discord',
    title: 'Anvil in Discord',
    dek: 'Ein Bot, eine Einladung, keine App zu registrieren. Hier steht, was er postet, wo er es postet, was er in deinem Server ändern darf — und was du dir ansiehst, wenn er aufhört.',
    facts: [
      {
        strong: 'Ein Bot',
        rest: 'gemeinsam, nichts zu erstellen',
      },
      {
        strong: '~5 Min.',
        rest: 'von der Einladung zum ersten Post',
      },
      {
        strong: 'Opt-in',
        rest: 'jeder Feed ist aus, bis du ihn zuweist',
      },
    ],
    footnote: 'Alles hier liegt unter Admin → **Discord**: oben die Schnelleinrichtung, darunter **More settings** — Connection, What goes where, Event posts, Roles & nicknames, Team channels, Commands und Post without a bot.',
    bot: {
      title: 'Ein Bot, schon fertig',
      body: [
        'Es gibt keine Discord-App zu erstellen, kein Token zu generieren und kein Geheimnis einzufügen. Anvil betreibt einen Bot, den sich alle Clans teilen — verbinden ist eine Einladung und sonst nichts.',
        'Du kannst trotzdem deinen eigenen mitbringen — füge unter **Use your own bot instead (advanced)** ein Token ein, und es wird stattdessen benutzt. Lohnt sich nur, wenn der Bot in der Mitgliederliste den Namen und das Bild deines Clans tragen soll; alles hier funktioniert so oder so gleich.',
      ],
      permissions: [
        {
          term: 'Kanäle ansehen, Nachrichten senden, Links einbetten, Dateien anhängen',
          body: 'Die Grundlage. Ohne diese ist er in deinem Server und stumm.',
        },
        {
          term: 'Webhooks verwalten',
          body: 'Damit **Set it up for me** und **Post here** Webhooks für dich anlegen können, statt dass du URLs von Hand aus Discord kopierst, und damit Anvil alte Webhooks finden kann, die du entfernen kannst.',
        },
        {
          term: 'Rollen verwalten',
          body: 'Nur wenn du den Rollen-Sync einschaltest. Er vergibt dann die Rollen, die du zuordnest — und kann nie eine Rolle über seiner eigenen anfassen, was Discords Regel ist, nicht unsere.',
        },
        {
          term: 'Nicknames verwalten',
          body: 'Nur wenn du den Nicknamen-Sync einschaltest, damit der Servername eines Mitglieds auf seinen RSN gesetzt werden kann.',
        },
        {
          term: 'Kanäle verwalten',
          body: 'Für private Teamkanäle während eines Drafts und für Guides, die als neue Kategorie oder als Forum gepostet werden. Ohne sie funktioniert alles andere trotzdem.',
        },
        {
          term: 'Threads verwalten, Nachrichten in Threads senden',
          body: 'Für Guides in einem Forum: im Beitrag schreiben und ihn wieder entfernen — ohne diese Berechtigung lässt Discord einen Bot nicht einmal seinen eigenen Forenbeitrag löschen.',
        },
        {
          term: 'Nickname ändern',
          body: 'Nur wenn du dem Bot unter **Connection → Bot appearance in your server** den Namen eures Clans gibst. Das ändert nur seinen Namen auf eurem Server.',
        },
      ],
      note: {
        tag: 'Er fragt alles auf einmal ab',
        body: 'Discord kann eine Berechtigung nicht nachträglich anfordern, also verlangt der Einladungslink den ganzen Satz, und die Funktionen, die du nie einschaltest, nutzen ihre nie. Den Link erneut zu öffnen ist auch der Weg, eine entfernte Berechtigung zu reparieren.',
      },
    },
    connect: {
      title: 'Verbinden',
      intro: 'Zwei Dinge, in dieser Reihenfolge. Der Bot muss in deinem Server sein, und Anvil muss wissen, welcher Server deiner ist.',
      steps: [
        {
          term: 'Bot einladen',
          body: 'Admin → **Discord** → **Connect your Discord server** (oder **Add Anvil to Discord**). Discord fragt, zu welchem Server Anvil hinzugefügt werden soll, und schickt dich hierher zurück, du kannst ihn also nicht versehentlich dem falschen hinzufügen. Später findest du **Invite / re-invite the bot** unter **More settings → Connection**.',
        },
        {
          term: 'Server-ID setzen',
          body: 'Nur wenn der Button es nicht schafft: Öffne **Can’t use the button? Enter the server ID**, klick in Discord mit rechts auf dein Server-Symbol → **Server-ID kopieren** (dafür muss der Entwicklermodus an sein, zu finden in Discords eigenen Einstellungen unter Erweitert), füge sie in **Your Discord server’s ID** ein und drück **Save**. Dieses Feld macht die Verbindung zu deiner.',
        },
      ],
      after: [
        'Das Panel sagt dir dann die Wahrheit statt deiner Absicht: ob der Bot wirklich Mitglied dieses Servers ist und welche Berechtigungen ihm fehlen. Eine grüne Zeile dort ist mehr wert als ein gespeichertes Formular.',
      ],
      note: {
        tag: 'Die Server-ID ist die ganze Bindung',
        body: 'Ein Server gehört auf Anvil zu genau einem Clan, und Slash-Befehle aus einem Server, den niemand beansprucht hat, werden abgelehnt statt geraten. Bis du sie setzt, ist der Bot eingeladen und untätig.',
      },
    },
    channels: {
      title: 'Webhooks einrichten',
      body: [
        'Anvil postet über **Webhooks**, einen pro Kanal, und jeder davon ist optional. Nichts wird irgendwo gepostet, bis du einen Feed auf einen Kanal richtest — ein frischer Clan ist absichtlich still, nicht versehentlich.',
        'Ist der Anvil-Bot auf deinem Server, legt **Set it up for me** oben auf **Admin → Discord** die Kanäle an und richtet jeden Feed auf sie aus. Willst du es von Hand machen, öffne **More settings → What goes where** und beginne mit dem **Catch-all channel** im Reiter **Clan & events**, dann mit dem **In-game catch-all** im Reiter **In-game (plugin)**: Wähle einen Kanal aus der Auswahlliste, und er wird gespeichert. Ohne Bot öffnest du in Discord beim Kanal **Kanal bearbeiten → Integrationen → Webhooks**, erstellst einen Webhook, kopierst seine URL, wählst in der Auswahlliste **Paste a webhook…**, fügst sie ein und drückst **Save**. Eine Webhook-URL kann in den Kanal posten; behandle sie daher wie ein Passwort. Wenn sie bekannt wird, lösche sie in Discord und erstelle eine neue. **Test** und **Add another**, mit dem du viele Posts auf zwei Webhooks verteilst, liegen unter **Post without a bot**.',
      ],
      feeds: [
        {
          term: 'Catch-all channel',
          body: 'Der wichtigste, im Reiter **Clan & events**. Event-Starts und -Enden, geöffnete Anmeldungen, Wertungen, Wochenergebnisse — alles, was die Seite postet und keinen eigenen Kanal hat. Setz nur diesen, und du hast einen funktionierenden Clan.',
        },
        {
          term: 'In-game catch-all',
          body: 'Im Reiter **In-game (plugin)**: wohin alles aus dem Spiel geht, das keinen eigenen Kanal hat. Setz diesen als zweites.',
        },
        {
          term: 'Die aufgeteilten Feeds',
          body: 'Event-Posts, Boards, die du mit ausrichtest, Skill & Boss of the Week und Termine im Clan-Kalender lassen sich vom Catch-all abtrennen; seltene Drops, Pets, Sammlungslog, Level, Combat Achievements, Quests, Diaries, Tode und PvP-Kills vom In-game catch-all. Änderungen der Mitgliederliste, Freigaben von Anmeldungen und das Kassenbuch liegen unter **Staff only**. Leere abgetrennte Feeds fallen auf ihren Catch-all zurück. Die Kasse ist die Ausnahme: Leer heißt, über Geld wird gar nichts gepostet. Leagues und andere Modi haben ihren eigenen Reiter **Game modes**.',
        },
      ],
      note: {
        tag: 'Trenne zuerst die Tode ab',
        body: 'Tode sind auf den meisten Boards der Feed mit dem größten Volumen und der, der alles andere begräbt. Wenn du nur eine Sache abtrennst, dann die.',
      },
    },
    roles: {
      title: 'Rollen und Nicknamen',
      body: [
        'Beide Syncs sind aus, bis du sie unter **Admin → Discord → Roles & nicknames** aktivierst, und beide richten sich nach der Mitgliederliste. Schalte **Enable Discord role sync** ein, lass **Auto-match in-game rank → Discord role by name** an, wähle gegebenenfalls allgemeine **Member roles** und **Guest roles**, speichere und drück dann **Sync roles & nicknames now**. Jede Person braucht außerdem ein verknüpftes Discord-Konto; der Sync-Bericht nennt jeden, den er nicht zuordnen konnte.',
      ],
      ways: [
        {
          term: 'Rollen-Sync',
          body: 'Ordne deine Ingame-Ränge Discord-Rollen zu, und Anvil hält sie in Einklang. Es gibt außerdem einzelne Rollen für Mitglieder, Gäste, Captains und das laufende Event, damit du die richtigen Leute anpingen kannst, ohne eine Liste von Hand zu pflegen.',
        },
        {
          term: 'Nicknamen-Sync',
          body: 'Setzt den Servernamen eines Mitglieds auf seinen RSN. Standardmäßig füllt er einen leeren Nicknamen aus und kann angewiesen werden, einen selbst gewählten zu überschreiben — über diese Einstellung denkt man besser vorher nach als nachher.',
        },
      ],
      note: {
        tag: 'Die Rolle des Bots muss über den verwalteten liegen',
        body: 'Discord lässt keinen Bot eine Rolle auf oder über seiner eigenen anfassen, und es verweigert das von deiner Seite aus stillschweigend — der Sync tut dann einfach nichts. Zieh die Anvil-Rolle unter **Servereinstellungen → Rollen** nach oben, und er funktioniert; neu einladen musst du nichts.',
      },
    },
    commands: {
      title: 'Slash-Befehle',
      body: [
        'Der Bot beantwortet `/bingo` in deinem Server (das Board, den Stand, die Regeln, deine eigene Karte) und dazu Clan-Befehle wie `/sotw`, `/stats` und `/coffer`. Sie lesen die Seite live mit, sodass niemand Discord verlassen muss, um seinen Stand zu prüfen. [Jeder Befehl und seine Optionen]({commandsGuide}) hat eine eigene Seite.',
        'Sie erscheinen etwa eine Minute nachdem der Bot beigetreten ist. Erscheinen sie gar nicht, hat die Einladung den Bot gewährt, aber nicht seine Befehle — das sind zwei getrennte Berechtigungen, und ein älterer Einladungslink hat nur eine davon angefragt. Führ **Invite / re-invite the bot** unter **Connection** auf der Discord-Seite erneut aus; das wirft den Bot nicht raus und setzt nichts zurück.',
      ],
      note: {
        tag: 'Er antwortet in der Sprache jedes Einzelnen',
        body: 'Standardmäßig antwortet der Bot in der Sprache, die das Mitglied in Discord eingestellt hat, und fällt auf Englisch zurück. Wähle unter **Bot-Sprache** eine feste Sprache, um das für alle zu überschreiben — das ist auch der einzige Weg zu Arabisch, da Discord keine arabische Client-Sprache zum Erkennen hat.',
      },
    },
    posts: {
      title: 'Was wann gepostet wird',
      body: [
        'Zwei Quellen, und es lohnt sich zu wissen, welche welche ist, wenn etwas falsch aussieht.',
        'Die **Seite** postet Events: ein geöffnetes Board, Anmeldungen, ein Start, Wertungen, das Ergebnis. Das kommt aus Anvil selbst und funktioniert, ob jemand das Plugin hat oder nicht.',
        'Das **Plugin** postet, was im Spiel passiert: Drops, Pets, Tode, Level, Sammlungslog-Einträge, Combat Achievements. Das gibt es nur für Mitglieder, die es nutzen — ein stiller Drop-Kanal heißt meist ein stilles Plugin, nicht ein kaputter Webhook.',
      ],
      note: {
        tag: 'Nichts wird doppelt gepostet',
        body: 'Ein Drop, der ein Feld abschließt, ist ein Post — nicht einer vom Plugin und noch einer vom Board.',
      },
    },
    modes: {
      title: 'Leagues, Deadman und andere Modi',
      body: [
        'Leagues, Deadman, Hardcore und andere Modi laufen auf eigenen Welten mit eigenen Charakteren. Ihre Posts sind immer gekennzeichnet und zählen nie für Boards oder Wettbewerbe. Sie haben ihren eigenen Reiter: **Admin → Discord → What goes where → Game modes**. Ein Modus erscheint dort, sobald ein Mitglied ihn zum ersten Mal spielt.',
        'Jeder Modus hat einen Schalter und einen **To**-Kanal. Schalte **Send game-mode posts to their own channels** ein, um diese Kanäle zu nutzen; lässt du es aus, postet jeder Modus in die normalen Kanäle, weiterhin gekennzeichnet. Der Button **Posts** in der Zeile eines Modus listet jede Art von Post, die er sendet — die üblichen und die eigenen Events des Modus —, jede mit eigenem Schalter.',
        'Unter dieser Liste lassen **Custom filters** einen Modus weniger posten als das Hauptspiel. **Post drops rarer than 1 in…** setzt eine eigene Seltenheitsgrenze (leer = wie im Hauptspiel): Gegenstände, die immer gepostet werden, werden weiterhin gepostet, Drops, die nur wegen ihres Werts zählen, dagegen nicht. **Use its own level milestones** postet einen Levelaufstieg nur, wenn er beide Regelsätze erfüllt.',
      ],
      note: {
        tag: 'Strenger, nie lockerer',
        body: 'Die Filter eines Modus können Posts nur wegnehmen. Das Plugin hat deine Einstellungen fürs Hauptspiel schon angewendet, also kann kein Modusfilter einen Post zurückholen.',
      },
    },
    cleanup: {
      title: 'Alte Webhooks von Dink oder anderen Bots',
      body: [
        'Ist der Bot auf deinem Server, listet die Discord-Seite jeden Webhook dort auf, der nicht von Anvil ist. **Coming from Dink?** bietet **Use the same channels** an, damit **Set it up for me** dorthin postet, wo deine alten Feeds gepostet haben, und sich für deine Mitglieder nichts verschiebt.',
        'Sobald deine Mitglieder auf Anvil sind, geh zu **Remove Dink’s old webhooks**, hake die an, die weg sollen, und drück **Remove … webhooks**, dann **Yes, remove them**. Das löscht sie in Discord endgültig — rückgängig machen lässt sich das nicht.',
        'Die Liste enthält jeden Webhook, der nicht von Anvil ist, nicht nur die von Dink. Einen willst du behalten, etwa den Feed eines anderen Bots? Drück **Keep**, und er verschwindet aus der Liste; **Show kept** und **Put back** holen ihn zurück. Behalten blendet ihn nur hier aus — in Discord ändert sich nichts.',
      ],
      note: {
        tag: 'Braucht „Webhooks verwalten“',
        body: 'Der Bot liest die Webhooks deines Servers, um sie zu finden. Ohne _Webhooks verwalten_ auf seiner Rolle sagt die Seite, dass sie sie nicht sehen kann.',
      },
    },
    announce: {
      title: 'Post to Discord',
      body: [
        'Admins können über **Post to Discord**, unter **Clan** im Admin-Menü, als Bot posten. Wähle einen **Channel**, schreib die **Message** und drück **Send message**. Lange Texte wie ein Regelwerk werden von selbst auf mehrere Nachrichten aufgeteilt.',
        '**Send as an embed** ist standardmäßig an und fügt einen optionalen **Title** und eine **Accent colour** hinzu; schalte es für reinen Text aus. **Ping** wählt eine Rolle oder @everyone, die erwähnt werden soll, und Anvil fragt nach, bevor es sendet.',
        'Jeder Post, den du sendest, steht unter **Sent from here**. **Edit** ändert ihn in Discord, ohne erneut zu pingen, und **Delete** entfernt ihn.',
      ],
      note: {
        tag: 'Nur für Admins, mit dem Bot',
        body: 'Es postet als Anvils Bot, verbinde also zuerst deinen Server. Moderatoren sehen es nicht. Es ist der Schalter **Post to Discord** unter **Clan settings → Features**; ausgeschaltet verschwindet es aus dem Menü.',
      },
    },
    quiet: {
      title: 'Wenn es still wird',
      body: [
        'Der Reihe nach, weil jeder Punkt den nächsten ausschließt:',
      ],
      checks: [
        {
          term: 'Ist der Bot wirklich im Server?',
          body: '**Connection** auf der Discord-Seite sagt es direkt. „Token gültig“ und „in deinem Server“ sind zwei verschiedene Tatsachen, und die erste bedeutet die zweite nicht — bei einem gemeinsamen Bot ist das Token immer gültig.',
        },
        {
          term: 'Stimmt die Server-ID?',
          body: 'Eine falsche, aber echte ID sieht genau wie eine richtige aus, bis dir auffällt, dass die Posts woanders landen.',
        },
        {
          term: 'Gibt es den Webhook noch?',
          body: 'Einen Discord-Kanal zu löschen löscht seinen Webhook, und Anvil behält die tote URL. Wähl unter **What goes where** wieder einen Kanal dafür.',
        },
        {
          term: 'Ist die Rolle des Bots hoch genug?',
          body: 'Nur für Rollen- und Nicknamen-Sync — siehe oben. Das ist der Punkt, der stillschweigend fehlschlägt.',
        },
      ],
      note: {
        tag: 'Er kann Beitretende nicht begrüßen',
        body: 'Discord meldet Beitritte nur über eine Gateway-Verbindung, die ein gemeinsamer Bot nicht für jeden Server hält. Es gibt also keinen „Willkommen“-Post — leg den Anmeldelink stattdessen in einen #rollen- oder #start-Kanal, wo die Leute ohnehin schauen.',
      },
    },
  },

  plugin: {
    metaTitle: 'RuneLite-Plugin einrichten — Anvil',
    metaDescription:
      'Das Anvil-RuneLite-Plugin installieren, dich über sein Seitenpanel anmelden und Discord-Benachrichtigungen einrichten.',
    eyebrow: 'Anvil · RuneLite-Plugin',
    title: 'Einrichtungsanleitung für Spieler',
    dek: 'Installieren, anmelden, spielen. Das Plugin reicht deine Bingo-Drops ein, postet deine seltenen Drops, Tode und Meilensteine auf Discord und lässt dich jeden per Rechtsklick nachschlagen.',
    facts: [
      { strong: '1 Klick', rest: 'und die Erfassung läuft' },
      { strong: '~3 Min.', rest: 'für die Grundeinrichtung' },
      { strong: 'Rechtsklick', rest: 'um jeden nachzuschlagen' },
    ],
    footnote:
      'Die Screenshots stammen aus einer echten Einrichtung — das Account-Token ist absichtlich unkenntlich gemacht. Deins sollte genauso privat bleiben.',

    install: {
      title: 'Plugin installieren',
      body: [
        'In RuneLite: **Configuration** (der Schraubenschlüssel) → **Plugin Hub** → nach **Anvil** suchen → **Install**. Der Herausgeber ist `AhmedFathy2001`.',
        'Ein Plugin bedient alle Clans — es verbindet sich immer mit `anvilosrs.com`, und erst die Anmeldung (nächster Schritt) verknüpft es mit dir und deinen Clans. Es gibt nichts clanspezifisches herunterzuladen und keine Adresse einzutippen. Nach der Installation erscheint in der RuneLite-Seitenleiste eine **Anvil**-Schaltfläche, und die Einstellungen findest du unter **Configuration → Anvil**.',
      ],
    },

    connect: {
      title: 'Anmelden',
      intro: 'Öffne das **Anvil**-Panel in der RuneLite-Seitenleiste und klick auf **Sign in with Discord**. Dein Browser öffnet sich auf `anvilosrs.com`; bestätige dort den Code, und das Plugin meldet sich selbst an — nichts zu tippen, nichts zu kopieren und nichts in den Einstellungen einzutragen.',
      panelFigure: {
        caption: 'RuneLite → die Anvil-Schaltfläche',
        alt: 'Die Symbolleiste von RuneLite, in der die Anvil-Schaltfläche ganz unten eingerahmt ist',
        legend: [
          {
            label: 'Die Anvil-Schaltfläche',
            body: 'am Rand des RuneLite-Fensters, ganz unten in der Symbolleiste. Ein Klick öffnet das Panel. Sie erscheint, sobald das Plugin installiert und eingeschaltet ist — und du kannst sie in der Leiste nach oben ziehen, wenn du sie lieber weiter oben hast.',
          },
        ],
      },
      signInFigure: {
        caption: 'Das Anvil-Panel',
        alt: 'Das Anvil-Panel mit eingerahmter Schaltfläche Sign in with Discord und der Seite, zu der es verbindet',
        legend: [
          {
            label: 'Sign in with Discord',
            body: 'erscheint nur, solange dieser Computer abgemeldet ist. Klick darauf, der Rest passiert in deinem Browser.',
          },
          {
            label: 'Connects to',
            body: 'immer `anvilosrs.com` — die einzige Seite, mit der das Plugin spricht, und die, zu der dein Token gehört.',
          },
          {
            label: 'Paste a token instead',
            body: 'die Notlösung, falls der Schritt im Browser bei dir nicht klappt — siehe das Ende dieses Schritts.',
          },
        ],
      },
      easySteps: [
        'Klick auf **Sign in with Discord**. Das Panel zeigt einen kurzen Code und öffnet deinen Browser auf `anvilosrs.com`.',
        'Melde dich dort mit Discord an, falls du es noch nicht bist, prüfe, ob der Code auf der Seite mit dem in RuneLite übereinstimmt, und klick dann auf **Approve**.',
        'Zurück in RuneLite steht oben im Panel _Signed in_ — und, sobald du dich einloggst, welcher Charakter erfasst wird. Das war’s.',
      ],
      linkFigure: {
        caption: 'anvilosrs.com → /link-device',
        alt: 'Die Seite Link your RuneLite client, mit umrahmtem Codefeld und Approve-Schaltfläche',
        legend: [
          { label: 'Der Code', body: 'er muss mit dem übereinstimmen, was dir das Plugin gerade anzeigt.' },
          {
            label: 'Approve',
            body: 'bestätige nur einen Code, den _dein eigener_ Client anzeigt. Hat dir jemand einen Link oder einen Code geschickt, lehne ihn ab — bestätigen hieße, ihm deinen Account zu übergeben.',
          },
        ],
      },
      directNote: {
        tag: 'Wo das passiert',
        body: [
          'Dieser ganze Ablauf bleibt auf `anvilosrs.com` — der Code wird dort ausgestellt, du bestätigst ihn dort mit deinem eigenen Discord-Login, und das Token geht direkt zurück ans Plugin. Das Plugin öffnet Anmeldeseiten nur auf `anvilosrs.com`; ein Anmeldelink, der woanders hinführt, stammt also nicht von ihm.',
        ],
      },
      federationAside:
        'Nicht zu verwechseln mit **Connect clans** im Seitenpanel — das ist die separate, freiwillige Schaltfläche, die dich mit anderen Anvil-Clans verbindet, und sie erscheint erst, wenn du hier bereits angemeldet bist.',
      manualFallback:
        'Öffnet sich der Browser nicht von selbst, gibt das Panel Adresse und Code aus, damit du sie manuell öffnen kannst. Codes laufen nach zehn Minuten ab — drück einfach noch mal auf die Schaltfläche.',
      manualHeading: 'Notlösung: Token von Hand einfügen',
      manualIntro:
        'Wenn die Anmeldung aus dem Plugin bei dir nicht klappt, kopiere dein Token unten (oder unter [Profile → plugin token](/profile#plugin-token), wo du es auch rotieren kannst), klick dann im Anvil-Panel unter der Anmelde-Schaltfläche auf **Paste a token instead** und füge es dort ein.',
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
            body: 'kopiere ihn und nutze dann **Paste a token instead** im Anvil-Panel. Rotate stellt einen neuen aus und macht den alten ungültig — nutze das, wenn du je vermutest, dass dein Token abhandengekommen ist.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Nutze im Alltag das Seitenpanel',
        body: ['**Das Anvil-Seitenpanel ist dein zentraler Arbeitsbereich**: Melde dich dort an und ab, sieh deine Clans und laufenden Events, durchsuche und beanspruche Felder, verfolge den Fortschritt, nimm Startbilder auf, führe Synchronisierungen aus und öffne die Support-Werkzeuge. **Configuration → Anvil**, unten gezeigt, ist nur für Einstellungen gedacht — dort gibt es keinen Token. Um diesen Computer abzumelden, öffne das **⋯**-Menü neben deinem Namen oben im Panel. Eine Anmeldung gilt für alle Events, für die du angemeldet bist — du musst sie nicht für jedes Bingo wiederholen.'],
      },
    },

    accounts: {
      title: 'Accounts verknüpfen',
      body: [
        'Sobald der Token eingetragen ist, erscheinen gespielte Accounts automatisch in deinem Profil. Ein brandneuer Account kann sofort verknüpft werden; ein Account, der bereits auf einer Clanliste steht, braucht zuerst einen Eigentumsnachweis, weil ein öffentlicher RuneScape-Name nicht beweist, wem er gehört.',
        'Nutze für die erste Verknüpfung [den schnellen XP-Test](/profile#link-account), oder bitte einen Clan-Moderator, den Account unter [erkannte Accounts](/profile#detected-accounts) zu bestätigen. Danach verfolgt der stabile Account-Fingerabdruck Namensänderungen und erkennt den Account automatisch wieder.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'Die Karte RuneScape Accounts auf der Profilseite mit den per Plugin verifizierten Accounts',
        legend: [
          {
            label: 'Deine verknüpften Accounts',
            body: 'alles mit „Verified via plugin“ ist verknüpft und wird automatisch wiedererkannt. Bestehende Clan-Accounts können vorher einmalig einen XP-Test oder die Bestätigung eines Moderators verlangen.',
          },
        ],
      },
      noPluginHeading: 'Kannst du das Plugin nicht nutzen?',
      noPluginIntro:
        'Auf Mobilgeräten oder im offiziellen Client nutzt du stattdessen [Profile → account linking](/profile#link-account):',
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
        'Außerdem füllt sich das **Anvil-Seitenpanel** mit deinen Clans, den laufenden Events, deiner Platzierung und den Sync-Schaltflächen — und in der Titelleiste deines Collection Log im Spiel erscheint eine **Anvil**-Schaltfläche, neben WikiSync und RuneProfile.',
      guestNote: {
        tag: 'Gast oder Mitglied',
        body: 'Sagt der Chat _Tracked as a guest_, wirst du erfasst, stehst aber noch nicht auf der Clan-Mitgliederliste. Das behebt ein Admin, indem er die Mitgliederliste aus dem Spiel synchronisiert — frag {discordLink}.',
        discordWord: 'in Discord',
      },
      panelHeading: 'Das Seitenpanel',
      panelBody: [
        'Vier Tabs und ein Zahnrad. **Clan** sind deine Events und dein Clan: jedes laufende und kommende Bingo und jeder Wochenwettbewerb samt deiner Platzierung. **Feed** sind die großen Momente deines Clans und deiner Boards, während sie passieren, mit Event-Chat. **You** ist dein eigenes Profil, und **Lookup** findet das von allen anderen, Spieler oder Clan. Im Zahnrad liegen die Synchronisierung und deine Banner-Sounds.',
        'Jeder Tab, Event-Chat, Reaktionen und die Einstellungen, die den Feed und die Supporter-Farben in dein Spiel bringen, stehen in [Das Seitenpanel, Tab für Tab]({panelGuide}).',
      ],
      panelFigure: {
        caption: 'Clan · You · Lookup',
        alt: 'Die drei Tabs des Anvil-Seitenpanels nebeneinander: der Clan-Tab mit Events und der Woche des Clans, der You-Tab mit deinem Collection Log und der Lookup-Tab mit der Karte eines anderen Spielers',
      },
      lookupHeading: 'Jeden nachschlagen',
      lookupBody:
        'Rechtsklicke einen Spieler — direkt neben dir oder per Name im Chat, in deiner Freundesliste oder im Clan-Panel — und wähle **Anvil**, um seine Karte im **Lookup**-Tab des Seitenpanels zu öffnen. Deine eigene ist der **You**-Tab.',
      lookupFigure: {
        caption: 'Rechtsklick auf einen Namen → Anvil',
        alt: 'Das Rechtsklick-Menü eines Spielers im Spiel mit einem Anvil-Eintrag unter Lookup und RuneProfile',
      },
      lookupSettingNote:
        'Unter **Player lookup** in den Plugin-Einstellungen legst du fest, wo der **Anvil**-Eintrag erscheint. Auf einem Namen im Chat ist er nie die Linksklick-Option, ein Klick auf einen Namen tut also weiterhin, was das Spiel tut.',
      lookupSettingFigure: {
        caption: 'Configuration → Anvil → Player lookup',
        alt: 'Der Abschnitt Player lookup der Anvil-Einstellungen mit umrahmten und nummerierten Einstellungen',
        legend: [
          {
            label: 'Anvil lookup on players',
            body: 'der Hauptschalter. Aus blendet den Eintrag überall aus.',
          },
          {
            label: 'Players in the world',
            body: 'Rechtsklick auf einen Spieler, der in deiner Nähe steht.',
          },
          {
            label: 'Chatbox and private messages',
            body: 'Namen in der Chatbox und im privaten Chat.',
          },
          {
            label: 'Clan panels / Friends chat / Friends, ignore and party lists',
            body: 'die Namenslisten: Mitglieder deines Clans und des Gast-Clans, der Friends-Chat-Kanal, deine Freundes- und Ignorierliste und das Raid-Party-Panel.',
          },
        ],
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
            label: 'Show Overlay',
            body: 'zeichnet ein kleines Panel mit _Anvil / Team / UTC-Datum_ oben links. Es wird Teil des Bildes in deinen Nachweis-Screenshots, und genau das macht einen Nachweis schwer zu fälschen oder rückzudatieren. Auf diesem Screenshot ist es aus — schalte es ein, wenn dein Clan Team und Zeit auf jedem Nachweis sehen will.',
          },
          {
            label: 'Team completion popups',
            body: 'ein Banner, wenn jemand aus deinem Team ein Feld abschließt. Mehrere gleichzeitig: das schwerste bekommt das Banner, der Rest geht in den Chat.',
          },
          {
            label: 'My tile popups',
            body: 'ein Popup, wenn dein eigener Drop ein Feld voranbringt oder abschließt. Aus wird trotzdem erfasst — nur leise.',
          },
          {
            label: 'Banner sound + volume',
            body: 'spielt zum Banner einen Ton ab. Es passiert nichts, bis du selbst mindestens eine .wav-Datei hinzufügst, über **Add clip** unter „Banner sounds“ im Anvil-Seitenpanel. Missionen haben einen eigenen Ordner — füge unter **Mission sounds** einen Clip hinzu, und sie spielen ihn statt des eingebauten Tons, der sie von einem fertigen Feld unterscheidet.',
          },
          {
            label: 'Auto starting shot',
            body: 'macht den Startschuss eines Events für dich, sobald du auf seinem festgelegten Ort stehst. Aus drückst du **Take starting shot** im Seitenpanel selbst.',
          },
        ],
      },
      teamsHeading: 'Teams',
      teamsBody:
        'Die Schaltfläche **Teams** an einem Event listet seine Teams nach Rang, deins ganz oben. Öffne eins für seinen Kader, Captain zuerst, oder suche einen Spieler über alle Teams hinweg — ein Klick auf einen Namen schlägt ihn nach.',
      teamsFigure: {
        caption: 'Event → Teams',
        alt: 'Die Teams-Seite mit den Teams eines Events samt Punkten und Mitgliederzahl, daneben der Kader eines Teams mit dem Captain zuerst',
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
        'Die werden verschickt, egal ob gerade ein Bingo läuft, und landen in den Kanälen des Clans. Welcher Kanal, legen die Admins hier fest — du wählst nur, _was_ du postest. Mit dem nächsten Plugin-Update ziehen diese Einstellungen auf die Website, unter **Settings → Discord posts & screenshots**, und folgen dir auf jeden Rechner. Auf derselben Seite legt **Screenshot privacy** fest, welcher Chat (private Nachrichten, öffentlicher Chat, Clan-Chat) auf jedem Screenshot des Plugins ausgeblendet wird. Im Plugin bleiben zwei Schalter unter **Notifications**: **Share clan posts** pausiert alle Posts aus dem Hauptspiel auf einmal, **Share seasonal activity** tut dasselbe auf Leagues, Deadman und anderen saisonalen Welten.',
      examplesFigure: {
        caption: 'So sieht ein Post aus',
        alt: 'Zwei Discord-Posts von Anvil: eine Grandmaster-Kampfaufgabe mit Punkten und dem Fortschritt bis zur nächsten Freischaltung und ein Tod mit seiner Nachricht, jeweils mit einem Screenshot des Moments',
      },
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
          {
            label: 'Loot key value',
            body: 'ein Loot Key wird einmal gepostet, als eine einzige Benachrichtigung, wenn sein gesamter Inhalt diese Zahl übersteigt.',
          },
          { label: 'Notify on pets', body: 'Pets landen im Kanal für seltene Drops.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · collection log · levels · diaries · quests',
        alt: 'Der Benachrichtigungsabschnitt Combat achievements mit umrahmten und nummerierten Einstellungen',
        legend: [
          {
            label: 'CA post tier',
            body: 'die niedrigste Aufgabenstufe, die gepostet wird; abgeschlossene Stufen werden ebenfalls gepostet. Standard ist Master; Grandmaster postet nur die seltensten, **Off** gar keine. CA-Felder im Bingo zählen so oder so.',
          },
          {
            label: 'Notify on collection log slots',
            body: 'jeder neue Platz im Collection Log.',
          },
          {
            label: 'Notify on level milestones',
            body: 'Level-ups, die dein Clan ankündigen will — standardmäßig 99er, alle 100 Gesamtlevel ab 1800 und Max. Die Admins deines Clans legen die Regeln fest; du kannst weniger posten (oder eigene Regeln für deine persönlichen Webhooks setzen) unter Announcements in deinem Profil.',
          },
          {
            label: 'Notify on diary completions',
            body: 'Stufen der Achievement Diaries, mit Screenshot.',
          },
          {
            label: 'Quest post tier',
            body: 'Quests ab der Schwierigkeit, die du wählst, von All (jede Quest) bis Grandmaster; **Off** postet gar keine. Standard ist Master. Quest-Felder im Bingo zählen so oder so.',
          },
        ],
      },
    },

    trouble: {
      title: 'Wenn etwas kaputtgeht',
      intro:
        'Das Plugin sagt dir im Chat Bescheid, wenn die Erfassung aufgehört hat — es wartet etwa 90 Sekunden, bevor es sich beschwert, und wiederholt sich höchstens alle 5 Minuten.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Der Token ist falsch oder wurde rotiert. Öffne das **⋯**-Menü oben im Anvil-Panel, drück **Sign out** und dann erneut **Sign in with Discord** — oder nutze **Paste a token instead** mit einem frischen Token aus [Profile → RuneLite plugin](/profile#plugin-token).',
        },
        {
          term: '`Anvil: can’t reach the site (anvilosrs.com) — tracking is OFF.`',
          body: 'Das Plugin erreicht `anvilosrs.com` nicht. Prüfe deine Internetverbindung und eine eventuelle Firewall oder ein VPN, das RuneLite blockieren könnte. Ist all das in Ordnung, ist die Seite vermutlich kurz down — das Plugin verbindet sich von selbst wieder.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Dieser Account ist noch nicht verknüpft. Öffne [Profile → erkannte Accounts](/profile#detected-accounts), um ihn hinzuzufügen oder den Eigentumsnachweis zu starten.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Nichts. Es hat sich von selbst erholt.',
        },
        {
          term: '„<RSN> belongs to another Anvil player“',
          body: 'Jemand anderes hat diesen Charakter zuerst auf Anvil verknüpft, deshalb zählt bei deinem Login nichts für ihn. Gehört er wirklich dir, drück im Reiter **You** des Panels auf **This is my account** und besteh den kurzen XP-Check. Danach wird der aktuelle Besitzer gefragt, oder das Anvil-Team entscheidet. Du erfährst nie, wer es ist. Verfolge den Stand unter [Settings → Ownership claims](/settings/claims).',
        },
      ],
      logHeading: 'Immer noch fest? Schick einem Admin ein Log',
      logBody:
        'Schick einem Admin dein RuneLite-Log: `client.log` im Ordner `.runelite/logs` in deinem Benutzerordner (unter Windows `%USERPROFILE%\\.runelite\\logs` in die Adressleiste des Explorers einfügen). Das Plugin schreibt hinein, was es gesehen hat und warum, so sieht er genau, was schiefgelaufen ist.',
      missingNote: {
        tag: 'Fehlen Nachweise?',
        body: 'Pets und doppelte Champion’s scrolls brauchen einen manuellen Screenshot. Das Plugin macht ihn für dich und legt ihn in `.runelite/osrs-bingo-pending/` ab — **Copy folder path** im Anvil-Seitenpanel öffnet den Ordner — damit du ihn auf der Seite anhängst, statt hinterher nach einem Bild zu suchen.',
      },
    },
    limits: {
      title: 'Bekannte Einschränkungen',
      intro:
        'Ein paar Dinge lassen sich nicht perfekt erfassen — fast immer wegen dem, was das Spiel selbst meldet, nicht wegen Anvil. Die Lösung ist jedes Mal dieselbe: Screenshot machen und manuell einreichen.',
      rows: [
        {
          term: 'Barraging und andere Kills mit mehreren Zielen',
          body: 'Kill-Zahlen (KC) stammen aus dem, was das Spiel pro Kill meldet, und Zauber mit mehreren Zielen wie Ice Barrage lassen es manche verpassen, sodass **KC niedriger ausfallen kann**, als du getötet hast. Auch RuneLites eigener Loot Tracker zählt so zu wenig — das ist eine Grenze der Spiel-Engine, kein Anvil-Fehler.',
        },
        {
          term: 'Combat Achievements, die du schon erledigt hast',
          body: 'Schalte **repeat completion** in den Combat-Achievements-Einstellungen des Spiels ein. Ohne sie kündigt das Spiel eine bereits erledigte Aufgabe nicht an, und das Plugin kann nur anrechnen, was das Spiel ankündigt.',
        },
        {
          term: 'Die Combat Achievement für den Yama-Vertrag',
          body: 'Diese kündigt das Spiel selbst mit eingeschaltetem repeat completion nicht erneut an, also sieht das Plugin sie nie. Mach einen Screenshot und reiche sie manuell ein.',
        },
        {
          term: 'Sammelfelder ohne das Plugin',
          body: 'Gegenstandszahlen — eine Anzahl Fische, Erze, Baumstämme — stehen nicht in den Hiscores, also erfasst sie nur das Plugin. Ohne es: Screenshot von jedem Inventar; oder, wenn der Gegenstand im Loot Tracker auftaucht, ein Screenshot nach dem Zurücksetzen auf 0 zu Beginn und noch einer am Ende.',
        },
        {
          term: 'Implings, Fisch, Erze und andere Item-Zuwächse',
          body: 'Das Fangen von Implings und das Sammeln von Items (Fisch, Erze und alles andere, das danach gezählt wird, was in deinem Inventar landet) **wird manchmal auch mit dem Plugin nicht korrekt erfasst**. Mach unterwegs Screenshots, und wenn eine Zahl zu niedrig aussieht, melde es und reiche die Differenz manuell ein.',
        },
        {
          term: 'Fischfässer, Holzkörbe und anderer Stauraum',
          body: 'Item-Zuwachs-Felder zählen nur, was **direkt von der Quelle** in deinem Inventar landet — einem Fischplatz, einem Felsen, einem Baum. Alles, was aus einem Behälter kommt (Fischfass, Holzkorb, Kohle- oder Edelsteinbeutel, Kräutersack leeren), im Shop gekauft, von der Bank abgehoben oder vom Boden aufgehoben wird, **zählt nicht**. So bleibt ein Feld ehrlich: sonst könnte derselbe Fisch endlos ins Fass gefüllt und wieder herausgeholt werden. Was du direkt in ein Fass oder einen Korb sammelst, wird nicht gezählt.',
        },
        {
          term: "Doppelte Pets und Champion's Scrolls",
          body: 'Wenn du das Pet oder die Scroll schon hast, sagt das Spiel nur, dass du ein **„funny feeling“** hast — welches, verrät es nie. Das Plugin erschließt es aus dem, was du gerade getötet oder trainiert hast, rechnet das Feld an und **markiert es zur Prüfung durch das Staff**. Kann es das nicht eindeutig sagen — zwei Pets aus derselben Quelle oder ein Pet ohne Kill oder Skill dahinter (Bloodhound aus einem Master-Clue, ein erspieltes Jad- oder Zuk-Pet, Chompy chick) —, landet der Screenshot in **Saved proofs**, damit du ihn manuell einreichst.',
        },
      ],
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
      { strong: '5 Schritte', rest: 'auf der Einrichtungs-Checkliste' },
      { strong: '7 Formate', rest: 'aus denen ein Board entsteht' },
      { strong: '1 Schaltfläche', rest: 'um die Mitgliederliste zu synchronisieren' },
    ],
    footnote:
      'Diese Anleitung folgt der App, wie sie heute ausgeliefert wird. Passt ein Bildschirm hier nicht zu dem, was du siehst, hat die App recht und die Anleitung ist veraltet — [sag uns Bescheid](/feedback), dann korrigieren wir sie.',

    access: {
      title: 'Wer darf was',
      intro:
        'Alle melden sich mit Discord an — es gibt keine Passwörter. Der erste Admin ist der Besitzer, also wer den Clan erstellt hat; danach befördert ein Admin andere über **People → Staff & roles**. Die Rollen stapeln sich nach unten: alles, was ein Moderator kann, können auch ein Kassenwart und ein Admin.',
      rows: [
        {
          term: 'Admin',
          body: 'voller Zugriff — Events, Felder, Teams, Einstellungen, Team, Auszahlungen. Gib sie an so wenige wie möglich.',
        },
        { term: 'Treasurer', body: 'alles, was ein Moderator kann, plus Teilnahmegebühren und Auszahlungen.' },
        {
          term: 'Moderator',
          body: 'das Tagesgeschäft: Mitgliederliste, Verifizierungen, zu prüfende Nachweise, Wochenwettbewerbe, der Terminplan und Clan-Events. Kann keine Events anlegen oder bearbeiten.',
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
        '**Settings → Finish setup** ist ein kurzer Assistent (er bleibt im Menü, bis du fertig bist), und das Dashboard behält eine Checkliste mit fünf Schritten, bis sie erledigt sind: Clan benennen, Discord verbinden, Mitglieder laden, ein Event anlegen, Felder hinzufügen. Der Status wird aus echten Daten berechnet, ein Schritt wird also erst abgehakt, wenn er wirklich fertig ist.',
      discord:
        'Für Discord hast du zwei Wege, und sie ergänzen sich: gib Anvil einen **Bot**, dann kann es Webhooks anlegen, Rollen und Spitznamen synchronisieren und private Teamkanäle bauen; gib ihm eine einzelne **Webhook-URL**, dann kann es Ankündigungen posten und sonst nichts. Fang mit dem Webhook an, wenn du in zwei Minuten live sein willst, und ergänze den Bot, wenn du die Automatik willst.',
      permsNote: {
        tag: 'Bot-Rechte',
        body: 'Der Bot braucht _Webhooks verwalten_, _Rollen verwalten_, _Kanäle verwalten_ und _Nicknames verwalten_, und seine Rolle muss in der Rollenliste deines Servers _über_ den Rollen stehen, die er verwaltet. Sonst verweigert Discord es stillschweigend.',
      },
      hosted:
        'Bei einem gehosteten Tarif hast du diesen Bildschirm schon einmal gesehen: den Bot während der Einrichtung hinzuzufügen war der Weg, über den Anvil erfahren hat, welcher Server eurer ist — es gab also nie eine Server-ID zu kopieren. Derselbe Link liegt hier, wann immer du den Bot auf einen anderen Server umziehen willst.',
    },

    channels: {
      title: 'Beiträge auf mehrere Kanäle verteilen',
      body: [
        'Standardmäßig geht alles in einen einzigen Catch-all-Kanal. Wenn der laut wird, öffne **Discord → What goes where** und gib den lauten Kategorien ein eigenes Zuhause — Event-Posts, Wochenwettbewerbe, seltene Drops, Tode, PvP-Kills, Combat Achievements. Alles, was du leer lässt, fällt auf seinen Catch-all zurück, du kannst also eine Kategorie nach der anderen abtrennen.',
        'Mit verbundenem Bot fasst du nie eine Webhook-URL an: Wähle in der Auswahlliste der Zeile einen Kanal, und er wird gespeichert. Bei einem vollen Event kannst du mit **Add another** unter **Post without a bot** einen zweiten Webhook hinzufügen — Anvil wechselt zwischen ihnen, damit Discords Ratenbegrenzung keine Beiträge verschluckt.',
      ],
      clipsNote: {
        tag: 'Der Clip-Kanal ist anders',
        body: 'Clip-Videos werden direkt vom PC jedes Spielers zu Discord hochgeladen — sie laufen nie über diese Seite. Deshalb ist der Clip-Webhook, den du hier setzt, derjenige, den du _weitergibst_: die Mitglieder fügen ihn selbst in ihr Plugin ein. Alles andere auf dieser Seite passiert serverseitig, und Mitglieder sehen es nie.',
      },
    },

    roster: {
      title: 'Die Mitgliederliste hereinholen',
      body: [
        'Clanmitgliedschaft kommt aus genau einer Quelle: einer Synchronisierung der Mitgliederliste aus dem Spiel. Installiere [Anvils RuneLite-Plugin]({pluginGuide}) auf dem Account eines _Admins_, öffne im Spiel dein Clan-Fenster und drück den **Anvil**-Button in seiner Titelleiste. Das schiebt eure tatsächliche Clanliste aus dem Spiel mit einem Klick auf die Seite.',
        'Sich anmelden, einen Charakter verknüpfen oder mit dem Plugin spielen setzt niemanden auf die Mitgliederliste. Sieht das Plugin jemanden in eurem Clan im Spiel spielen, bevor die Mitgliederliste ihn hat, stellt es eine Beitrittsanfrage; alle anderen können mit **Apply** auf eurer Clanseite fragen. Das Team beantwortet Anfragen oben unter **People → Roster**, und **People → Who can join** entscheidet, ob Leute auf ein Ja warten, sofort einen Gast-Sitz bekommen oder gar nicht fragen können. Das ist Absicht: Niemand tritt eurem Clan bei, indem er seinen Namen eintippt. Das ganze Bild steht in [Deine Leute]({peopleGuide}).',
        'Du kannst jemanden auch von Hand über **People → + Add Manually** hinzufügen und ihn mit **Add member** auf der **Sign-ups**-Seite des Events stellvertretend zu einem Event anmelden, wenn er die Seite nicht erreicht.',
      ],
    },

    board: {
      title: 'Dein erstes Board anlegen',
      intro:
        '**Events → All events → + New event**. Wähle zuerst ein Format — es entscheidet, wie das Board gewertet wird und was das restliche Formular von dir will.',
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
          blurb: 'Eine geordnete Strecke — Teams erreichen die Felder der Reihe nach; wer am weitesten kommt, gewinnt. Der Host kann sie in Routen verzweigen, die sich teilen und wieder treffen — das Feld, das ihr schafft, wählt euren Weg.',
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
        'Die Seite **Board & tiles** des Events ist der Ort, an dem aus einem Board ein Bingo wird. Jedes Feld ist eine _Art_ von Aufgabe, und die Art entscheidet, worauf das Plugin achtet: einen Drop, einen Boss-Killcount, Skill-XP, einen NPC-Kill, eine Zeitvorgabe, ein Achievement Diary, ein Combat Achievement, eine Collection-Log-Freischaltung, einen PvP-Kill, einen Gegenstandsgewinn, oder einen Durchlauf ohne Tod. Manuelle Felder — die, die ein Mensch anhand eines Screenshots bestätigt — sind immer auch eine Option.',
        'Für ein volles Board arbeitest du in Bulk: exportiere die Tabelle, füll sie in einem Tabellenprogramm aus, und importiere sie zurück. CSV und .xlsx laufen beide in beide Richtungen, und Zeilen entsprechen Positionen — du kannst also ein ganzes 25-Felder-Raster mit einem Einfügen neu schreiben.',
      ],
      rows: [
        {
          term: 'Schwierigkeitsstufen',
          body: 'Punktwerte werden auf benannte Bänder abgebildet (easy → elite). Bearbeite die Bänder unter **Clan settings → Rules & scoring → Difficulty & balance**, wenn dein Clan anders einstuft.',
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
        'Die Seite **Teams & draft** passt sich dem gewählten Format an: Ein Format ohne Teams überspringt sie ganz. Für ein normales Teambingo legst du die Teams an, bestimmst die Kapitäne, und verteilst die Spieler entweder selbst oder führst einen Live-Draft durch.',
        'Die Kapitäne draften aus dem Anmeldepool in der Reihenfolge, die du festlegst, und jeder Kapitän sieht die Antworten, die die Leute im Anmeldeformular gegeben haben — eingefroren, wie sie eingereicht wurden, damit niemand seine „Stunden pro Woche“ nachträglich anpasst.',
      ],
      placementIntro:
        'Du musst nicht draften. **Team placement** im Erstellformular und im Reiter **Sign-ups** legt fest, wo jede neue Anmeldung landet:',
      placementRows: [
        {
          term: 'Auto-balance',
          body: 'jede Person, die sich anmeldet, kommt ins Team mit den wenigsten Spielern. Du wählst nur, wie viele Teams es gibt. Gut für große öffentliche Events.',
        },
        {
          term: 'Players pick',
          body: 'du legst zuerst die Teams an, und jeder Spieler wählt eins im Anmeldeformular. Setz ein Limit pro Team, damit sie ausgeglichen bleiben.',
        },
        {
          term: 'Host drafts',
          body: 'alle warten in einem Pool, bis du oder deine Kapitäne sie draften oder von Hand zuteilen. Am besten, wenn du die Spieler kennst.',
        },
        {
          term: 'Solo',
          body: 'gar keine Teams. Jeder Spieler ist für sich, benannt nach seinem Charakter, und die Rangliste ordnet Spieler.',
        },
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
          body: '**Post to Discord** (unter **Clan** im Menü) postet mitten im Event als Bot eine Nachricht in einen beliebigen Kanal, ohne dass du einen Webhook von Hand schreibst.',
        },
      ],
      missionNote: {
        tag: 'Überraschungen mitten im Event',
        body: 'Du kannst eine **Mission** in ein laufendes Bingo werfen — ein verborgenes Bonusfeld, das angekündigt wird, wenn du es auslöst, und das optional an Wert verliert oder abläuft. Es ist der billigste Weg, ein Board an Tag fünf aufzuwecken.',
      },
      startProofNote: {
        tag: 'Horten vor dem Event unterbinden',
        body: [
          'Schalte **Starting shot** ein (Event → Home → **Extras**), dann muss jeder Spieler einen Screenshot einreichen, aufgenommen nach dem Eventstart, an einem Ort, den Anvil im Startmoment auslost — damit niemand bei null auf einer Woche gebunkerter Clues und Kisten sitzt. Der Ort wird mit dem Start angekündigt; das Kennwort jedes Spielers ist persönlich, aus der Ziehung abgeleitet, und existiert vor dem Eventstart nicht, es kann also von niemandem vorbereitet werden.',
          'Markiere die Orte auf der Weltkarte (der Pool-Editor hat eine), dann prüft das Plugin, ob die Spieler tatsächlich dort stehen, statt es ihnen nur gesagt zu haben. Du kannst außerdem eine **frische Sitzung** verlangen — standardmäßig 15 Minuten: Hiscores werden nur beim Ausloggen gespeichert, alle kurz vor ihrer Aufnahme zum Relog zu zwingen ist also das, was die Startwerte hinter jedem XP- und KC-Feld ehrlich macht.',
          'Plugin-Nutzer drücken eine Taste. Alle anderen tippen ihr Kennwort im Spiel und laden auf My Team hoch. Du entscheidest, was mit einer Gutschrift von jemandem passiert, der nichts eingereicht hat: zur Prüfung markieren (Standard) oder ablehnen, bis er es tut. Dasselbe Panel auf der Home-Seite des Events ist die Prüfliste — Plugin-Aufnahmen mit verifiziertem Kennwort kommen bereits bestätigt an, in der Praxis siehst du dir also nur die Handyspieler an.',
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
          body: 'die **Prizes**-Seite des Events macht aus dem Preistopf eine Liste, wer was bekommt, und hakt sie ab, während du auszahlst.',
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
          body: 'behalte das Board, das du gerade gebaut hast, über **Settings → More** des Events. Das nächste Bingo startet daraus statt aus einem leeren Raster.',
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
        'Öffne dein Event und geh zur Seite **Teams & draft**. Lege ein Team pro eingeladenem Clan an und benenne es nach ihm — der Name ist das, was ihre Spieler im Anmeldeformular sehen, „Ironforge“ schlägt also „Team 2“.',
        'Du musst _keinen_ Draft durchführen. Einladungslinks und ein Draft sind Alternativen: ein Draft verteilt einen gemeinsamen Anmeldepool, ein Link setzt Leute direkt. Bei einem reinen Clan-gegen-Clan legen die meisten Ausrichter die Teams an, geben je einen Link heraus, und öffnen den Draft nie.',
        'Öffne dann das Team selbst — **Teams & draft → das Team** — denn dort passieren beide nächsten Schritte.',
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
        caption: 'Event → Teams & draft → das Team → Team staff',
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
        caption: 'Event → Teams & draft → das Team → Invite links',
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
        kill: { label: 'Kills', blurb: 'N Kills beliebiger Bosse oder Monster. Aus den Hiscores gezählt, wenn jedes Monster auf dem Feld dort steht, sonst vom Plugin beim Spielen (Hühner, Kühe, Slayer-Mobs).' },
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
          term: 'Eine Boss-Liste plus ein Monster außerhalb der Hiscores',
          body: 'ist **komplett** ein Plugin-Feld. Ein Kills-Feld wird nur dann aus den Hiscores gezählt, wenn jedes Monster darauf dort steht; nimm zu vier GWD-Bossen ein Huhn dazu, und das ganze Feld braucht das Plugin. Wenn ein Teil eures Clans ohne spielt, gib den Hiscores-Bossen ein eigenes Feld.',
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
        '**Download spreadsheet** auf der Seite **Board & tiles** des Events. Du bekommst eine .xlsx des Boards, wie es gerade ist, mit Auswahllisten, der Gegenstandsliste und den Spaltenhinweisen auf eigenen Blättern.',
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
        'Auf einem punktgewerteten Board trägt jedes Feld seinen eigenen Wert, und diese Werte bilden sich auf benannte Schwierigkeitsbänder ab — easy bis elite — die du unter **Rules & scoring** bearbeiten kannst, wenn dein Clan anders einstuft. Das Band ist das, was Spieler lesen; die Zahl ist das, was zählt.',
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
      'Das Format wird bei der Anlage festgelegt, lässt sich danach aber unter Settings → Event des Events ändern; die Aufdeckregel und die Punktmodifikatoren lassen sich jederzeit ändern, bevor die betroffenen Felder aufgedeckt sind.',

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
      'Gebühren und Auszahlungen sind die Oberfläche des Kassenwarts. Ein Kassenwart kann alles, was ein Moderator kann, plus das hier; ein einfacher Moderator sieht die Gebührenseiten überhaupt nicht.',

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
        {
          term: 'Gastgebühr',
          body: 'was Spieler zahlen, die kein Mitglied eines Clans sind, der das Board ausrichtet. Lässt du das Feld leer, zahlen Gäste die Mitgliedergebühr. Um einem einzelnen Spieler einen anderen Betrag zu berechnen, drück in seiner Zeile unter **Sign-ups** auf **Change this player’s fee**.',
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
        'Nachhaken ist ein Knopfdruck: **Remind unpaid** unter Admin → **Fees** schickt allen, die bei diesem Event noch etwas schulden, eine Discord-DM.',
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
        'Wie viele Unterschriften eine Gebühr braucht, ist eine Clan-Einstellung (**Clan settings → Rules & scoring → Fee sign-off**), von null bis fünf. Null gibt es aus einem echten Grund: In einem Clan, in dem der Kassenwart _der_ Eigentümer ist, gibt es niemanden sonst zum Unterschreiben, und „34 Gebühren warten auf eine zweite Unterschrift“ wird zu einer Warteschlange, die sich nie leeren lässt, und dauerhaft zum Lautesten auf dem Dashboard. Bei null **ist** das Markieren als bezahlt die Unterschrift.',
        'Stell sie auf eins — den Standard — wenn ihr zu zweit seid. Stell sie auf null, wenn ihr das ehrlich nicht seid, und höher nur dann, wenn dein Clan sowohl die Leute als auch den Grund hat.',
      ],
    },

    pay: {
      title: 'Auszahlen',
      body: [
        'Wenn das Event endet, macht die **Prizes**-Seite des Events aus dem Topf eine Liste von Menschen. Erzeuge sie, und du bekommst eine Zeile pro Empfänger, nicht pro Team: Der Preis eines Siegerteams teilt sich zu gleichen Teilen auf seine Mitglieder auf, damit die Auszahlung eine Liste aus Namen und Zahlen ist und keine Rechenaufgabe um Mitternacht.',
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

  coffer: {
    metaTitle: 'Die Clankasse — Anvil-Anleitung für Kassenwarte',
    metaDescription:
      'Der Goldtopf des Clans in Anvil: Spenden erfassen und denen gutschreiben, die sie gegeben haben, die drei Wege einer Preisauszahlung, wer das Geld bewegen darf, und was passiert, wenn der Topf nicht reicht.',
    eyebrow: 'Anvil · für Kassenwarte',
    title: 'Die Clankasse',
    dek: 'Die meisten Clans haben ihr Gold auf einer Bank und ihre Buchführung in einem Gedächtnis. Die Kasse ist ein Topf mit einer Zeile für jede Bewegung — wer sie gegeben hat, wofür sie versprochen ist, und wer sie tatsächlich geschickt hat.',
    facts: [
      { strong: '3 Zahlen', rest: 'vorhanden, gebunden, frei verfügbar' },
      { strong: '3 Wege hinaus', rest: 'Wochenwettbewerbe, Missionsfelder, der Topf eines Boards' },
      { strong: 'Kassenwart', rest: 'oder Admin — nie der Rang allein' },
    ],
    footnote:
      'Alles hier liegt unter Admin → **Coffer**, außer den Preisleitern, die dort sitzen, wofür bezahlt wird. Die öffentliche Hälfte ist `/coffer`: der Kontostand, die größten Spender und die letzten Bewegungen, für die Mitglieder.',

    what: {
      title: 'Was sie ist',
      body: [
        'Ein Kassenbuch, keine Geldbörse. Anvil hält euer Gold nie — es bleibt dort, wo der Clan es ohnehin verwahrt — die Kasse ist also die Aufzeichnung dessen, was hereinkam, was versprochen ist und was tatsächlich übergeben wurde. Ihr Nutzen liegt darin, dass Versprechen und Zahlung zwei verschiedene Zeilen sind.',
        'Die Seite beginnt mit drei Zahlen, und es sind drei, weil sie drei verschiedene Fragen beantworten:',
      ],
      rows: [
        {
          term: 'Vorhanden',
          body: 'genehmigte Spenden und Korrekturen. Was der Clan bekommen hat, minus dem, was er abgeschrieben hat.',
        },
        {
          term: 'Gebunden',
          body: 'Gold, das ein Preis beansprucht hat — gewonnen, aber noch nicht verschickt, plus ein für ein Board zurückgelegter Topf. Verplant, auch wenn es noch auf jemandes Bank liegt.',
        },
        {
          term: 'Frei verfügbar',
          body: 'vorhanden minus gebunden. Die einzige Zahl, gegen die ein neuer Preis geprüft wird, denn die Alternative ist, dieselben 50M zwei Gewinnern zu versprechen, während der Kassenwart schläft.',
        },
      ],
      note: {
        tag: 'Eine offene Spende zählt nirgends',
        body: 'Dass jemand „ich habe 100M gegeben" tippt, ist eine Behauptung über die Vergangenheit, kein Gold auf einer Bank. Sie steht außerhalb aller drei Zahlen, bis das Team sie anerkennt — so kann sie nie einen Preis finanzieren, der danach nicht bezahlt werden kann.',
      },
    },

    inbound: {
      title: 'Gold hineinbekommen',
      body: [
        'Den gewöhnlichen Weg erledigt das RuneLite-Plugin automatisch: öffne die Clan Coffer im Spiel, und Anvil erfasst Ein- und Auszahlungen anhand ihres echten Münzbestands. Der erste Blick ist nur eine Ausgangsbasis — er tut nie so, als hätte derjenige, der sie geöffnet hat, alles gespendet, was schon drin liegt.',
        'Manuelle Einträge bleiben für alles, was passiert ist, während niemand das Plugin offen hatte. Ein Mitglied meldet seine eigene Spende über `/coffer` und sie wartet darauf, dass das Team sie glaubt; ein Kassenwart erfasst eine bereits eingetroffene, und dass er sie eintippt **ist** die Genehmigung.',
        'So oder so wird sie einer **Person** gutgeschrieben. Das wiegt schwerer, als es klingt: die Spenderliste auf der öffentlichen Seite ist der einzige Dank, den die meisten Spender je bekommen, und Gold, das als „der Clan" ankommt, dankt niemandem.',
      ],
      rows: [
        {
          term: 'Die Kasse im Spiel öffnen',
          body: 'mit aktiviertem und angemeldetem Anvil (Profile sync → **Sync Clan Coffer** ist standardmäßig an). Eine passende Spielnachricht schreibt dir deine eigene Ein- oder Auszahlung gut; Änderungen, die erst nach einer Lücke auffallen, werden abgeglichen, ohne den Beobachter zu nennen. Admin → Coffer zeigt den zuletzt gesehenen tatsächlichen Betrag und wann er gesehen wurde.',
        },
        {
          term: 'Ein Mitglied meldet eine',
          body: 'über die öffentliche Kassenseite, mit Screenshot, falls vorhanden. Sie landet als offen und taucht in deiner Warteschlange auf. Das Genehmigen macht sie zu echtem Geld.',
        },
        {
          term: 'Du erfasst eine',
          body: 'Admin → Coffer → **Record a donation**. Such im Kader, wer sie gegeben hat, setz einen Betrag neben den Namen, fertig. Gäste lassen sich ebenfalls gutschreiben — wer kein Vollmitglied ist, kann trotzdem eingezahlt haben.',
        },
        {
          term: 'Mehrere zusammen',
          body: 'wähl sie alle aus, tipp die Summe und drück **Split … ways**, und pass einzelne Anteile danach von Hand an. Es schreibt je eine Zeile statt einer Zeile mit einer Liste, damit jeder unter seinem eigenen Namen in der Spenderliste steht.',
        },
      ],
      note: {
        tag: 'Eine Korrektur ist etwas anderes',
        body: '**Correct the pot** ist für Gold, das sich außerhalb all dessen bewegt hat — den Topf befüllen, ihn für etwas ausgeben, das Anvil nie gesehen hat, einen Fehler richtigstellen. Sie gehört bewusst niemandem und ist ausdrücklich nicht der Weg, ein Geschenk zu erfassen.',
      },
    },

    out: {
      title: 'Die drei Wege der Auszahlung',
      intro: 'Jeder Preis in Anvil kommt aus diesem einen Topf, und jeder Weg bestimmt die Gewinner anders. Setz die Leiter dort, wo das Gewonnene lebt — die Kasse fragt nie, wer etwas gewonnen hat.',
      rows: [
        {
          term: 'Ein Wochenwettbewerb, auf seiner eigenen Seite',
          body: 'ein Skill oder Boss of the Week trägt eine Platzleiter: Erster bekommt dies, Zweiter das. Sie wird **einmal** abgerechnet, wenn der Wettbewerb endet, anhand des Endstands — während er läuft, wechselt nichts den Besitzer. Setz sie beim Anlegen des Wettbewerbs oder später auf dessen eigener Seite.',
        },
        {
          term: 'Ein Missionsfeld, auf dem Board',
          body: 'Missionen zahlen in der Reihenfolge, in der Leute fertig werden, ihre Leiter wird also beansprucht statt abgerechnet: das erste Team, das sie schafft, nimmt das Gold des ersten Platzes. Wird im Rewards-Abschnitt des Feldes gesetzt, auf jedem Board, das Missionen erlaubt.',
        },
        {
          term: 'Der Preistopf eines Boards',
          body: 'ein Bingo verteilt seinen Topf selbst auf Platzierungen, die Kasse reicht ihm also nur eine Zahl. Event → **Prizes** → *From the clan coffer*. Sie kommt zu den Startgeldern und zu dem, was du selbst zugelegt hast, und die Aufteilung auf Plätze wird auf derselben Seite gesetzt. Du entscheidest außerdem, ob die Kasse dieses Gold sofort **bindet** oder nur das Versprechen festhält — es ist ja noch nicht weg, und ein Board in sechs Wochen braucht nicht den halben Topf bis dahin eingefroren.',
        },
      ],
      note: {
        tag: 'Wenn Leute gleichauf enden',
        body: 'Eine Wochenleiter kann **Gleichstände teilen**: alle Gleichauf-Platzierten legen die von ihnen belegten Plätze zusammen und nehmen einen gleichen Anteil — drei mit je 40 KC nehmen also ein Drittel von Platz eins, zwei und drei, statt dass der erste von ihnen alles bekommt. Lässt du es aus, entscheidet die Reihenfolge des Boards. Beides ist vertretbar — nach Bekanntgabe der Ergebnisse zu entscheiden nicht.',
      },
    },

    who: {
      title: 'Wer sie bewegen darf',
      intro: 'Geld ist eine eigene Berechtigung, kein Rang. Ein Moderator kann Einreichungen prüfen und die Kasse nie berühren, und das ist Absicht, kein Versehen.',
      rows: [
        {
          term: 'Kassenwart oder Admin',
          body: 'das ganze Kassenbuch: Spenden erfassen und genehmigen, den Topf korrigieren, Preisleitern setzen, einen Preis als verschickt markieren. Der Eigentümer zählt hier als Admin.',
        },
        {
          term: 'Ein Moderator',
          body: 'nichts davon. Er sieht die Kassenseite gar nicht — Geld einzusammeln ist die Aufgabe des Kassenwarts, und der Rang allein hat dieses Recht noch nie verliehen.',
        },
        {
          term: 'Ein Board-Kassenwart',
          body: 'das Geld eines Events: dessen Gebühren, Auszahlungen, Preistopf. Wird pro Board vergeben — so führt ein Gastclan seine eigene Hälfte eines Clan-gegen-Clan, ohne euer Kassenbuch in die Hand zu bekommen. An die Clankasse kommt er nicht.',
        },
        {
          term: 'Jedes Mitglied',
          body: 'kann eine Spende melden und die öffentliche Seite lesen. Das ist alles.',
        },
      ],
      note: {
        tag: 'Sag es dem Clan, in einem Kanal',
        body: 'Richte das **Coffer ledger** unter Admin → Discord → What goes where → **Staff only** auf einen Discord-Kanal, dann wird jede Bewegung mit dem Stand gepostet, den sie hinterlässt. Es ist der einzige Feed ohne Rückfallkanal: Bleibt er leer, wird über das Geld nirgends etwas gepostet. Siehe [Anvil in Discord]({discordGuide}).',
      },
    },

    short: {
      title: 'Wenn der Topf nicht reicht',
      body: [
        'Ein Preis, der größer ist als die Kasse, wird nicht abgelehnt. Er wird als **geschuldet und ungedeckt** verbucht — eine echte Zeile mit dem Namen eines Gewinners darauf — denn die Alternative ist ein Gewinner ohne alles und ohne Spur davon, dass je etwas versprochen wurde.',
        'Die Lösung ist also die gewöhnliche: Gold hereinholen, dann zahlen. Was du nicht tun solltest, ist die Leiter hinterher still zu ändern; das Kassenbuch sagt bereits, was angekündigt war, und dass beide sich widersprechen, ist schlimmer, als knapp zu sein.',
      ],
      note: {
        tag: 'Anvil verschickt nichts',
        body: 'Jeder Preis endet damit, dass ein Mensch im Spiel Gold übergibt und eine Zeile abhakt. Die Aufgabe des Kassenbuchs ist es, dafür zu sorgen, dass diese Zeile existiert, dass sie wer und wie viel sagt, und dass niemand sie eine Woche später aus dem Discord-Verlauf rekonstruieren muss.',
      },
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
        'die Mitgliederliste: Leute hinzufügen und entfernen und Beitrittsanfragen beantworten ([Deine Leute]({peopleGuide}))',
        'Accountverifizierungen — die XP-Aufgabe und die manuelle Prüfung',
        'Einreichungen und Nachweis-Screenshots',
        'Wochenwettbewerbe und den Terminplan',
        'Termine im Clan-Kalender',
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
          body: 'nach dem ersten Eigentumsnachweis erkennt das Plugin den Account automatisch, und ein stabiler Fingerabdruck erhält die Verknüpfung bei Namensänderungen. Ein Listen-Account ohne bekannten Fingerabdruck nutzt einmal den XP-Test oder einen Moderator.',
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
        body: 'Einen Account zu verifizieren sagt „der gehört wirklich ihm“. Es macht ihn nicht zum Teil des Clans. Mitgliedschaft kommt nur aus einer Synchronisierung der Mitgliederliste im Spiel oder vom Team, das ihn von Hand hinzufügt, und ein Gast-Sitz nur aus einer Beitrittsanfrage, die das Team annimmt (oder sofort, wenn der Clan jeden reinlässt). Das ist Absicht, und genau das hindert jemanden daran, deinem Clan durch Eintippen eines Namens beizutreten.',
      },
    },

    roster: {
      title: 'Die Mitgliederliste ehrlich halten',
      body: [
        'Die Mitgliederliste kommt aus genau einer Quelle: ein Admin startet eine Synchronisierung aus der Clanliste im Spiel, über den Bingo-Reiter des Plugins im Collection Log. Alles andere — Verifizierungen, Verknüpfungen, Anmeldungen — hängt daran.',
        'Die Pflegearbeit ist also klein, aber real: Bitte einen Admin, nach jeder Rekrutierungsrunde die Synchronisierung zu starten (sie macht Gäste, die im Spiel beigetreten sind, zu Mitgliedern), beantworte die Beitrittsanfragen oben im Reiter **Roster** und arbeite **Needs review** ab, statt zu warten, bis sich Leute beschweren. Siehe [Deine Leute]({peopleGuide}).',
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

  commands: {
    metaTitle: 'Discord-Slash-Befehle — Anvil',
    metaDescription:
      'Jeder Slash-Befehl von Anvil — /bingo, /sotw, /botw, /eff, /coffer, /stats und /guide — mit jeder Option erklärt, Beispielen, wer was nutzen darf, und Lösungen für Befehle, die nicht erscheinen.',
    eyebrow: 'Anvil · in Discord',
    title: 'Slash-Befehle',
    dek: 'Tipp `/` im Discord deines Clans, und Anvil antwortet live von der Seite: das Board, der Stand, deine eigene Karte, die Wochenwettbewerbe, die Kasse und die Stats von wem auch immer. Diese Seite ist die vollständige Liste, erzeugt aus den Befehlen, die der Bot tatsächlich registriert — sie ist also nie veraltet.',
    facts: [
      { strong: 'Privat', rest: 'Antworten, die nur du siehst, mit einem Share-Button' },
      { strong: 'Deine Sprache', rest: 'die, auf die dein Discord eingestellt ist' },
      { strong: 'Nur lesend', rest: 'außer /coffer add und remove' },
    ],
    footnote:
      'Den Bot überhaupt einzurichten ist Sache der [Discord-Anleitung](/guide/discord). Diese Seite handelt davon, ihn zu benutzen.',

    using: {
      title: 'So funktioniert ein Befehl',
      body: [
        'Tipp `/` in einem beliebigen Kanal, den der Bot sehen kann, und wähl einen Anvil-Befehl aus der Liste. Discord zeigt dann seine Optionen als Felder zum Ausfüllen: drück Tab oder klick auf eine, um sie hinzuzufügen. Optionen in spitzen Klammern, `<angle brackets>`, sind unten Pflicht; Optionen in eckigen Klammern, `[square brackets]`, sind optional, und du kannst sie weglassen.',
        'Jede Antwort ist **privat**: nur du siehst sie, also stört es niemanden, wenn du zehnmal am Tag aufs Board schaust. Wenn es sich lohnt, es dem Kanal zu zeigen, drück **Share to channel** unter der Antwort. Die geteilte Kopie wird in dem Moment neu erstellt — ein später geteilter Stand ist also der Stand von dann.',
      ],
      rows: [
        { term: 'Pflicht', body: '`<amount>` — Discord schickt den Befehl erst ab, wenn das ausgefüllt ist.' },
        { term: 'Optional', body: '`[member]` — lass es weg, und der Befehl antwortet über dich, dein Team oder den ganzen Clan.' },
        { term: 'Eine Liste', body: 'wähl einen der Werte, die Discord anbietet; eigene kannst du nicht eintippen.' },
        { term: 'Tippen zum Suchen', body: 'fang an zu tippen und wähl aus den Vorschlägen, etwa Bossnamen oder deine eigenen Accounts.' },
        { term: 'Ein Mitglied', body: 'wähl jemanden aus dem Server, genau wie bei einer @-Erwähnung.' },
      ],
      note: {
        tag: 'Befehle funktionieren nur im Server deines Clans',
        body: 'Jede Antwort betrifft einen Clan, und eine DM hat keinen Clan, über den sie antworten könnte. Deshalb erscheinen die Befehle nicht in DMs.',
      },
    },

    bingo: {
      title: 'Board-Befehle: /bingo',
      intro:
        '`/bingo` dreht sich um ein Board. Wenn mehrere Boards laufen, listen **board** und **leaderboard** sie alle auf; der Rest antwortet über das Board, das gerade läuft, sonst das nächste, das startet, sonst das, das gerade geendet hat.',
    },

    clan: {
      title: 'Clan-Befehle',
      intro:
        'Diese antworten über den Clan statt über ein Board, funktionieren also, ob gerade ein Bingo läuft oder nicht: die Wochenwettbewerbe, Effizienz, die Kasse, die Stats von jedem und die Einrichtungsanleitungen.',
    },

    options: {
      title: 'Optionen, die dir überall begegnen',
      intro: 'Ein paar Optionen bedeuten bei jedem Befehl, der sie hat, dasselbe:',
      rows: [
        {
          term: '`member`',
          body: 'jemand anderes im Server. Lass es weg, um nach dir selbst zu fragen. Es findet den Anvil-Account der Person über den Discord-Login, den sie auf der Seite benutzt hat — funktioniert also nur bei Mitgliedern, die sich einmal bei Anvil angemeldet haben.',
        },
        {
          term: '`account`',
          body: 'welcher der OSRS-Accounts dieser Person, für Leute mit Alts. Tippen zum Auswählen; lass es weg für den Main.',
        },
        {
          term: '`page`',
          body: 'ein Boss oder eine Aktivität, per Suche getippt: `Zulrah`, `Theatre of Blood`, `Tempoross`. Lass es weg für die Gesamtansicht.',
        },
        {
          term: '`language`',
          body: 'antwortet dieses eine Mal in einer anderen Sprache. Standardmäßig bekommst du die Sprache, auf die dein Discord eingestellt ist, oder die vom Clan gewählte Bot-Sprache.',
        },
        {
          term: '`amount`',
          body: 'gp auf die bequeme Art: `5m`, `2.5b`, `500k` oder eine einfache Zahl wie `2,500,000`.',
        },
      ],
    },

    who: {
      title: 'Wer was nutzen darf',
      body: [
        'Jeder im Server kann jeden nur lesenden Befehl ausführen. Was du siehst, ist das, was ein Mitglied sehen würde: ein Board, dessen Felder noch nicht aufgedeckt sind, bleibt auch in Discord verborgen, selbst für das Team.',
        'Befehle, die über **dich** antworten (`/bingo me`, `/stats` ohne member), müssen wissen, welcher Anvil-Account deiner ist. Sie finden ihn über den Discord-Login, den du auf der Seite benutzt hast — melde dich also einmal mit Discord bei Anvil an, und ab dann funktionieren sie.',
      ],
      rows: [
        { term: 'Alle', body: 'jeder Befehl außer `/coffer add` und `/coffer remove`.' },
        {
          term: 'Kassenwarte, Admins, Besitzer',
          body: '`/coffer add` und `/coffer remove`. Geprüft wird deine Rolle **auf der Anvil-Seite**, nie deine Discord-Rolle, denn ein Rang in einem Chatserver hat noch nie Verfügungsgewalt über das Geld des Clans bedeutet.',
        },
      ],
    },

    trouble: {
      title: 'Wenn ein Befehl nicht funktioniert',
      intro: 'Die üblichen Ursachen, ungefähr in der Reihenfolge, in der sie auftreten:',
      rows: [
        {
          term: 'Keine Anvil-Befehle in der Liste',
          body: 'der Bot wurde ohne seine Befehle eingeladen — das ist eine eigene Berechtigung, und ältere Einladungslinks haben nur eine davon angefragt. Ein Admin führt **Invite / re-invite the bot** unter Admin → Discord → **Connection** erneut aus. Das wirft den Bot nicht raus und setzt nichts zurück. Neu hinzugefügte Befehle können bis zu einer Stunde brauchen, bis sie erscheinen.',
        },
        {
          term: '„The application did not respond“',
          body: 'Anvil war kurz nicht erreichbar, meist mitten in einem Update. Führ den Befehl ein paar Sekunden später noch einmal aus.',
        },
        {
          term: '„Nicht auf diesem Brett“ über dich selbst',
          body: 'entweder bist du diesem Board nicht beigetreten, oder Anvil kann dein Discord nicht deinem Account zuordnen. Melde dich mit diesem Discord-Konto auf der Seite an und prüf dein Profil.',
        },
        {
          term: 'Die Stats eines Mitglieds kommen leer zurück',
          body: 'die Person hat sich noch nicht mit Discord bei Anvil angemeldet, oder die Hiscores ihres Accounts wurden noch nicht gelesen. Versuch es noch einmal mit der Option `account`, oder bitte sie, sich einmal anzumelden.',
        },
        {
          term: '`/coffer add` sagt, du darfst nicht',
          body: 'deine Rolle auf der Anvil-Seite ist nicht Kassenwart, Admin oder Besitzer, oder dieses Discord ist nicht das Konto, mit dem du dich auf der Seite anmeldest.',
        },
      ],
    },

    labels: {
      options: 'Optionen',
      noOptions: 'Keine Optionen — einfach ausführen.',
      example: 'Beispiel',
      examples: 'Beispiele',
      required: 'Pflicht',
      optional: 'optional',
      choices: 'Auswahl',
      range: 'von {min} bis {max}',
      kinds: {
        text: 'Text',
        number: 'Zahl',
        member: 'ein Mitglied',
        choice: 'aus einer Liste wählen',
        search: 'tippen zum Suchen',
        yesno: 'ja oder nein',
      },
    },

    examples: {
      'bingo board': {
        examples: ['/bingo board'],
        tip: 'Das Board, das gerade läuft. Bis das Board aufgedeckt ist, bleiben die Feldnamen auch hier verborgen.',
      },
      'bingo leaderboard': {
        examples: ['/bingo leaderboard'],
        tip: 'Der Teamstand, mit Punkten oder Feldern, je nachdem, wie das Board wertet.',
      },
      'bingo rules': {
        examples: ['/bingo rules'],
        tip: 'Wie dieses Board wertet (direkt aus dem Event gelesen, also immer korrekt), danach die Hausregeln deines Clans.',
      },
      'bingo apply': {
        examples: ['/bingo apply'],
        tip: 'Wie du reinkommst: Anmeldungen, die Gebühr, und wo deine eigene Anmeldung steht.',
      },
      'bingo next': {
        examples: ['/bingo next'],
        tip: 'Was als Nächstes kommt: ein Feld wird aufgedeckt, eine Mission oder eine Deadline.',
      },
      'bingo me': {
        examples: ['/bingo me'],
        tip: 'Dein Team, deine Platzierung und die Felder, die dir gutgeschrieben wurden.',
      },
      'bingo help': {
        examples: ['/bingo help'],
        tip: 'Eine kurze Liste dessen, worauf der Bot antwortet, direkt in Discord.',
      },
      'bingo team': {
        examples: ['/bingo team', '/bingo team name:Iron Wolves'],
        tip: 'Die Karte eines Teams: Punktzahl, Aufstellung und letzte Felder. Lass den Namen weg für dein eigenes Team.',
      },
      sotw: {
        examples: ['/sotw', '/sotw language:Deutsch'],
        tip: 'Jeder aktive Skill of the Week, die Spitze von jedem, und wo du stehst.',
      },
      botw: {
        examples: ['/botw'],
        tip: 'Jeder aktive Boss of the Week und sein Live-Stand.',
      },
      eff: {
        examples: ['/eff', '/eff metric:EHB'],
        tip: 'Die Effizienz-Rangliste des Clans und dein Platz darin. Standardmäßig EHP (efficient hours played); wähl EHB fürs Bossing.',
      },
      'coffer balance': {
        examples: ['/coffer balance'],
        tip: 'Der Kontostand der Kasse, die größten Spender und die letzten Bewegungen.',
      },
      'coffer add': {
        examples: ['/coffer add amount:5m', '/coffer add amount:250k note:Raffle proceeds'],
        tip: 'Nur für Kassenwarte, Admins und Besitzer. Erfasst eingehendes Gold; es wird außerdem im Kassen-Feed-Kanal gepostet.',
      },
      'coffer remove': {
        examples: ['/coffer remove amount:20m note:SOTW prize'],
        tip: 'Nur für Kassenwarte, Admins und Besitzer. Bringt die Kasse nie unter null; erfasse das auf der Kassenseite, wenn du es wirklich so meinst.',
      },
      'stats profile': {
        examples: ['/stats profile', '/stats profile player:Zezima'],
        tip: 'Ein Account auf einen Blick: Kampf- und Gesamtlevel, EHP und EHB, Einträge im Collection Log und persönliche Bestzeiten.',
      },
      'stats levels': {
        examples: ['/stats levels', '/stats levels player:My Iron'],
        tip: 'Level und XP jedes Skills.',
      },
      'stats efficiency': {
        examples: ['/stats efficiency'],
        tip: 'EHP und EHB, und aus welchen Skills und Bossen sie stammen.',
      },
      'stats clog': {
        examples: ['/stats clog', '/stats clog page:Zulrah'],
        tip: 'Fortschritt im Collection Log insgesamt, oder die Seite eines Bosses.',
      },
      'stats pbs': {
        examples: ['/stats pbs', '/stats pbs page:Theatre of Blood mode:Hard size:3'],
        tip: 'Persönliche Bestzeiten. Raids speichern eine Zeit pro Modus und Teamgröße, nimm also `mode` und `size`, um den Run zu finden, den du meinst.',
      },
      'stats luck': {
        examples: ['/stats luck', '/stats luck player:Zezima'],
        tip: 'Wie viel Glück der Account bei den Drops hatte, die Anvil verfolgt.',
      },
      'stats collectors': {
        examples: ['/stats collectors'],
        tip: 'Die größten Collection Logs des Clans.',
      },
      'stats luckboard': {
        examples: ['/stats luckboard'],
        tip: 'Die Clanmitglieder mit dem meisten Pech und dem meisten Glück.',
      },
      setup: {
        examples: ['/setup topic:Plugin setup', '/setup topic:Plugin setup step:5'],
        tip: 'Eine Einrichtungsanleitung direkt in Discord: die Liste der Schritte, oder ein einzelner Schritt mit einem Link direkt dorthin auf der Seite.',
      },
      guide: {
        examples: ['/guide guide:ToB 4-man gear'],
        tip: 'Eine der Spielanleitungen des Clans (Raids, Bossing, Money Making…): tippe den Namen an und wähle sie aus der Liste.',
      },
    },
  },

  tiles: {
    metaTitle: 'Feldregeln und Grenzen — Anvil',
    metaDescription:
      'Was jede Art von Bingo-Feld von dir braucht (Spieleinstellungen, das RuneLite-Plugin, ein synchronisiertes Collection Log, ein Hiscores-Rang) und wo die Grenzen dessen liegen, was es erfassen kann.',
    eyebrow: 'Anvil · für Spieler',
    title: 'Feldregeln und Grenzen',
    dek: 'Jedes Feld zeigt, was es von dir braucht und was es nicht kann. Diese Seite erklärt jede Zeile; die **Why?**-Links auf einem Feld führen hierher.',
    needs: 'Braucht',
    limit: 'Gut zu wissen',
    checked: 'Das Feld prüft das für dich',
    englishOnly: 'Die Regeln unten sind vorerst auf Englisch, damit sie immer genau dem entsprechen, was die Seite tatsächlich tut.',
  },
  // /guide/creators — die Anleitung für Hosts eines Creator-Space.
  creators: {
    metaTitle: 'Ein OSRS-Bingo für deine Zuschauer veranstalten — Anvil',
    metaDescription:
      'Veranstalte ein Old-School-RuneScape-Bingo oder Tile-Rennen für deinen Stream, ganz ohne Clan: Space erstellen, einen Link teilen, wählen, wer mitmachen darf (Twitch, Kick, YouTube oder Discord), und das Board per OBS in den Stream bringen.',
    eyebrow: 'Für Streamer und Creator',
    title: 'Events für deine Zuschauer veranstalten',
    dek: 'Mit einem Creator-Space veranstaltest du ein Bingo für deinen Stream. Du brauchst keinen Clan im Spiel. Du erstellst ein Event, teilst einen Link, und deine Zuschauer machen mit.',
    facts: [
      { strong: 'Kein Clan', rest: 'nötig' },
      { strong: 'Kostenlos', rest: 'zum Start' },
      { strong: 'Ein Link', rest: 'für deinen Chat' },
    ],

    what: {
      title: 'Was ein Creator-Space ist',
      body: [
        'Es ist deine eigene Seite auf Anvil, unter `{apex}/c/dein-name`. Dort veranstaltest du Events für deine Zuschauer.',
        'Es ist kein Clan. Es gibt keine Clan-Liste, keine Ränge und keine wöchentlichen Wettbewerbe. Wer bei deinem Event mitmacht, spielt dieses Event. Mehr nicht.',
        'Zuschauer melden sich mit Discord an, fügen ihren RuneScape-Charakter hinzu und drücken **Join**. Das Anvil-RuneLite-Plugin zählt ihre Drops dann von selbst.',
      ],
    },

    create: {
      title: 'Deinen Space erstellen',
      body: [
        'Geh zu [{apex}/host](/host) und melde dich mit Discord an.',
        'Gib deinem Space einen Namen. Dein Kanalname ist eine gute Wahl. Dein Link entsteht aus dem Namen. Drück **change link**, wenn du einen anderen willst.',
        'Drück **Create my space**. Du bekommst einen Space pro Discord-Account.',
      ],
    },

    first: {
      title: 'Dein erstes Event erstellen',
      body: [
        'Gleich nach dem Erstellen deines Space landest du bei **Create your first event**. Später nimmst du **+ New event** oben bei **Your events**.',
        '**Name.** Das sehen deine Zuschauer.',
        '**What kind?** Wähle eine Karte. **Team bingo** ist ein 5×5-Raster, und Anvil teilt die Spieler für dich in Teams auf. **Solo bingo** ist dasselbe Raster, jeder für sich. **Team race** sind Aufgaben der Reihe nach: Das Team, das am weitesten ist, gewinnt.',
        '**Ready-made tiles** gibt dir eine Mischung aus leichten bis schweren Aufgaben, die du später ändern kannst. **Blank, I’ll write my own** startet leer.',
        '**Who can join?** Lass es auf **Anyone**, oder wähle, wer mitmachen darf. Siehe Schritt 5.',
        '**When?** Wähle Start- und Enddatum. Oder lass es leer und starte das Event selbst, wenn du bereit bist.',
        'Drück **Create event**. Drück dann **Copy invite link**.',
      ],
    },

    share: {
      title: 'Den Link teilen',
      body: [
        'Füge den Einladungslink in deinen Stream-Chat, dein Discord oder deine Social Media ein. Mehr brauchen deine Zuschauer nicht.',
        'Du kannst ihn jederzeit erneut kopieren: **Your events** → **Copy invite link** neben dem Event.',
        'Soll der Bot im Chat auf `!join` mit dem Link antworten? Siehe Schritt 9.',
      ],
    },

    who: {
      title: 'Wählen, wer mitmachen darf',
      body: [
        'Jedes Event startet offen für **Anyone**. Um es für deine Community zu reservieren, öffne die **Settings** des Events → **Viewers** → **Who can join?** und wähle eine oder mehrere Optionen. Dieselben Optionen gibt es auf dem Bildschirm fürs erste Event.',
        'Wenn du mehr als eine wählst, **reicht eine davon**. Ein Follower ODER ein Server-Booster kommt rein.',
      ],
      intro: 'Jede Option, und was ein Zuschauer tun muss:',
      rows: [
        {
          term: 'Anyone',
          body: 'Jeder mit dem Link macht sofort mit.',
        },
        {
          term: 'Twitch followers',
          body: 'Der Zuschauer drückt auf der Event-Seite **Link Twitch** und meldet sich bei Twitch an. Anvil prüft, ob er dir folgt.',
        },
        {
          term: 'Twitch subs',
          body: 'Wie bei Followern, aber er muss abonniert haben. Wähle die niedrigste Stufe: **Tier 1 or higher**, **Tier 2 or higher** oder **Tier 3**. Prime-Subs zählen als Tier 1. Dein Kanal muss Twitch-Affiliate oder -Partner sein.',
        },
        {
          term: 'Kick followers',
          body: 'Kick verrät Apps nicht, wer dir folgt. Deshalb zählt Anvil Leute, die dir folgen, _nachdem_ du Kick verbunden hast. Vorher gefolgt? Dann entfolgt der Zuschauer und folgt neu. Ist dein Kick-Chat nur für Follower? Schalte im Kasten **Kick channel** die Option **My Kick chat is followers-only** ein. Dann zählt ein Zuschauer, der seinen Anvil-Code in deinen Chat tippt, als Follower.',
        },
        {
          term: 'Kick subs',
          body: 'Subs, die Anvil nach dem Verbinden von Kick gesehen hat, zählen von selbst. Alle anderen drücken **Get Kick code** und tippen den Code (er sieht so aus: `ANVIL-7F3K9Q`) in deinen Kick-Chat, und Anvil sieht ihr Sub-Badge. Kick hat keine Sub-Stufen.',
        },
        {
          term: 'YouTube subscribers',
          body: 'Der Zuschauer drückt **Check my YouTube subscription** und meldet sich bei Google an. Seine Abos müssen auf YouTube öffentlich sein.',
        },
        {
          term: 'YouTube members',
          body: 'Der Zuschauer tippt seinen Anvil-Code in deinen YouTube-Livechat. Mitglieder können also nur beitreten, **während du live bist**.',
        },
        {
          term: 'Discord role',
          body: 'Leute mit einer Rolle, die du auf deinem Discord-Server auswählst (bis zu 5 Rollen). Verbinde zuerst deinen Server: **Discord (optional)** im Menü.',
        },
        {
          term: 'Server boosters',
          body: 'Leute, die deinen Discord-Server boosten. Dafür muss dein Server ebenfalls verbunden sein.',
        },
      ],
      note: {
        tag: 'Gut zu wissen',
        body: 'Verbinde zuerst deinen Kanal (Schritt 7), sonst bleiben die Optionen für Twitch, Kick und YouTube ausgegraut. Ein Twitch-, Kick- oder YouTube-Account bringt nur einen Spieler in jedes Event. Dein Staff und Leute, die du namentlich einlädst, überspringen die Prüfungen.',
      },
    },

    approve: {
      title: 'Zu jedem Spieler Ja sagen (optional)',
      body: [
        'Du willst auswählen, wer spielt? Öffne die **Settings** des Events → **Viewers** → **Who can enter** und wähle **Ask me about everyone**. Drück **Save changes**.',
        'Jetzt drücken Zuschauer **Ask to join** statt **Join**. Sie müssen vorher trotzdem deine **Who can join?**-Optionen erfüllen.',
        'Ihre Anfragen erscheinen bei **Your events** als **N waiting for you**. Klick darauf, oder öffne den Tab **Sign-ups** des Events. Die Liste oben heißt **Waiting for your yes**. Nimm jede an oder lehne sie ab.',
      ],
    },

    channels: {
      title: 'Deinen Twitch-, Kick- oder YouTube-Kanal verbinden',
      body: [
        'Öffne **Settings** im Menü. Drück im Kasten **Twitch channel**, **YouTube channel** oder **Kick channel** auf **Connect Twitch**, **Connect YouTube** oder **Connect Kick** und melde dich als dein Kanal an.',
        'Jeder verbundene Kanal erscheint auf deiner Seite als **verified**-Link. Du kannst keinen Link von Hand eintippen: Durch die Anmeldung weiß Anvil, dass der Kanal dir gehört.',
        'Ein Kanal kann nur mit einer Stelle auf Anvil verbunden sein. Ist er schon bei einem anderen Space oder Clan von dir, fragt Anvil, ob du ihn verschieben willst.',
      ],
    },

    overlay: {
      title: 'Das Board in den Stream bringen (OBS)',
      body: [
        'Drück bei **Your events** neben dem Event **Stream overlay**, dann **Make overlay links**.',
        'Du bekommst drei Links. **Standings**: die besten Teams und wie weit sie sind. **Feed**: die neuesten Drops und fertigen Felder. **Board**: das Board, mit markierten fertigen Feldern.',
        'Wähle vor dem Kopieren eine **Text size** (S, M, L oder XL). Drück dann **Copy** neben dem gewünschten Link.',
      ],
      stepsTitle: 'In OBS hinzufügen',
      steps: [
        'Drück in OBS unter **Sources** auf **+** und wähle **Browser**.',
        'Füge den Link bei **URL** ein.',
        'Stell eine Größe ein, zum Beispiel 800 × 600. Lass **Custom CSS** leer.',
        'Drück **OK**. Es aktualisiert sich alle paar Sekunden von selbst.',
      ],
      tipsTag: 'Gut zu wissen',
      tips: [
        'Häng `&limit=10`, `&title=0` oder `&align=right` ans Ende eines Links, um ihn anzupassen.',
        'Das Overlay zeigt, was deine öffentliche Event-Seite zeigt. Versteckte Standings und versteckte Felder bleiben auch im Stream versteckt.',
        '**Reset link** erzeugt neue Links und stoppt die alten. Nutze es, falls ein Link durchsickert. Du musst die neuen Links dann erneut in OBS einfügen.',
        'Ein kleines „Anvil“-Zeichen sitzt in der Ecke. Im Gold-Tarif kannst du es unter **Settings** → **Anvil mark on your overlay** ausblenden.',
      ],
    },

    chatjoin: {
      title: '!join in deinem Chat',
      body: [
        'Öffne **Settings** → **!join in Twitch chat** und schalte es ein.',
        'Wenn ein Zuschauer `!join` tippt, antwortet der Anvil-Bot (Anvil_OSRS) mit dem Link zu deinem offenen Event. Er antwortet höchstens alle 30 Sekunden einmal, egal wie viele es tippen.',
        'Er antwortet nur in einem Kanal, den du in Schritt 7 verbunden hast. Für Kick schaltest du im Kasten **Kick channel** die Option **!join in Kick chat** ein.',
        'Kein Event offen? Dann sagt er das: „No event is open to join right now — keep an eye on the stream!“',
      ],
      tips: [
        'Blockiert dein Chat Links (Twitchs **Block hyperlinks** oder AutoMod), wird die Antwort des Bots zurückgehalten. Schreib einmal `/vip anvil_osrs` oder `/mod anvil_osrs` in deinen Chat, damit der Link durchkommt.',
        'Du arbeitest gerade an einem Event? **Space settings** im Menü des Events bringt dich zurück zu diesen Schaltern. Genauso **Switch it on in your settings** unter **Who can join?**.',
      ],
    },

    page: {
      title: 'Deine Seite gestalten',
      body: [
        'Deine Seite sehen die Leute unter `{apex}/c/your-name`, zusammen mit deinen Events. Öffne **Settings** → **Your page**. Jeder Teil hat seinen eigenen Speichern-Knopf.',
      ],
      items: [
        '**Bio.** Ein paar Zeilen über dich und deine Streams. Links, die mit `https://` beginnen, sind anklickbar.',
        '**Logo and banner.** Drück **Upload a logo** oder **Upload a banner**. Das Banner liegt quer über dem oberen Rand deiner Seite, also mach es breit (3:1, zum Beispiel 1500 × 500). PNG, JPEG, GIF oder WebP. Beide dürfen animiert sein.',
        '**Panels.** Bis zu 8 Karten unter deinen Events, wie die Panels unter einem Twitch-Kanal. Drück **+ Add a panel** und gib ihm einen Titel und etwas Text. Ein Bild und ein Link sind optional. Mit den Pfeilen änderst du die Reihenfolge.',
        '**Schedule.** Wann du normalerweise live gehst, in deiner eigenen Zeitzone. Besucher sehen jede Zeit in ihrer eigenen Uhrzeit.',
        '**Featured.** Ein Clip, oben auf deiner Seite angeheftet. Wähle eines deiner Stream-Highlights (nächster Schritt) oder füge einen Clip-Link von Twitch, YouTube, Kick oder Medal ein.',
        'Drück **Preview your page**, um sie so zu sehen wie Besucher.',
      ],
      note: {
        tag: 'Die Regeln von Jagex',
        body: 'Alles auf deiner Seite muss den Regeln von Jagex folgen: kein Gold- oder Account-Verkauf, kein Glücksspiel, keine Bots und keine privaten Server. Anvil prüft deine Texte und Links beim Speichern. Blendet das Anvil-Team deine Seite nach einer Meldung aus, steht das in deinen Einstellungen. Frag im Anvil-Discord nach, wenn du denkst, dass es ein Fehler ist.',
      },
    },

    highlights: {
      title: 'Stream-Highlights',
      body: [
        'Ist dein Twitch- oder YouTube-Kanal verbunden, hält Anvil die großen Momente deiner Events fest, während du live bist. Die Schalter findest du unter **Settings** → **Stream highlights**.',
        '**Auto-clip big moments on my stream** ist an, sobald du verbindest. Während du auf Twitch live bist, macht Anvil einen Clip, wenn eines deiner Events startet, wenn ein Team das Board abräumt oder gewinnt und wenn dein eigener Charakter einen seltenen Drop oder ein Pet bekommt. Auf YouTube speichert es stattdessen einen Link zu genau dieser Sekunde deines Streams. Kick hat noch keine Highlights.',
        'Die Clips erscheinen unter **Highlights** auf der Event-Seite und auf deiner Seite. Einen davon kannst du als deinen **Featured**-Clip anheften (Schritt 10).',
        '**Let Anvil feature clips from my events in its own promotion** bleibt aus, bis du es einschaltest. Dann darf Anvil einen Clip auf seinen eigenen Seiten und Social-Media-Kanälen teilen und nennt dich dabei immer.',
        'Deine Spieler können ihre eigenen großen Momente auch clippen. Sie schalten **Clip my stream when I hit a big moment** unter ihrem Twitch-Account in **Settings** → **Connected accounts** ein.',
      ],
    },

    listing: {
      title: 'Auf Anvil gelistet werden',
      body: [
        'Dein Space ist beim Erstellen nicht gelistet. Nur Leute mit deinem Link finden ihn.',
        'Öffne **Settings** → **Advertise on Anvil** und schalte es ein. Dein Space erscheint im Anvil-Clan-Verzeichnis, und deine neuen Events erscheinen auf `{apex}/events`.',
        'Um nur ein Event zu listen, öffne dessen **Settings** → **Viewers** → **List on Anvil**. Es erscheint, solange das Event bevorsteht oder läuft.',
        'Ein Event ohne Termine erscheint unter **Open to join**, markiert mit „Open now · starts when the host starts it“.',
      ],
    },

    plans: {
      title: 'Tarife und Limits',
      body: [
        'Dein Tarif bestimmt, wie viele Spieler gleichzeitig in deinen Events sein können. Events mit überlappenden Terminen teilen sich diese Zahl; Events an verschiedenen Terminen bekommen sie jeweils für sich. Ein Spieler in zwei überlappenden Events zählt doppelt. Alles andere ist in jedem Tarif gleich: das Board, das Plugin-Tracking, das Overlay und Discord.',
        'Deine Tarifkarte findest du bei **Your events**. Zum Vergleich der Tarife siehe [Preise](/pricing#creators). Um zu ändern oder zu kündigen, was du zahlst, geh zu [deiner Abrechnungsseite](/portal).',
      ],
      rows: [
        { term: 'Free', body: 'Bis zu 50 Spieler gleichzeitig über all deine Events hinweg. Ein Event gleichzeitig. Prüfungen für Discord-Rolle und Booster.' },
        { term: 'Bronze', body: 'Bis zu 150 Spieler gleichzeitig über all deine Events hinweg. Prüfungen für Twitch, Kick und YouTube.' },
        { term: 'Silver', body: 'Bis zu 300 Spieler gleichzeitig über all deine Events hinweg. Mehr als ein Event gleichzeitig. `!join` im Chat. Wird in der Liste zuerst gezeigt.' },
        { term: 'Gold', body: 'Bis zu 1.000 Spieler gleichzeitig über all deine Events hinweg. Das Anvil-Zeichen im Overlay ausblenden.' },
        { term: 'Partner', body: 'Keine Spielergrenze. Wird direkt mit Anvil eingerichtet — melde dich bei uns.' },
      ],
      note: {
        tag: 'Im Moment',
        body: 'Solange Anvil wächst, kommt noch jeder rein, auch über die Zahlen deines Tarifs hinaus. Die Limits greifen später, mit Vorankündigung. Deine Tarifkarte zeigt, wie nah du dran bist.',
      },
    },

    faq: {
      title: 'Fragen',
      intro: 'Die, die Streamer am häufigsten stellen:',
      rows: [
        {
          term: 'Brauchen meine Zuschauer einen Clan?',
          body: 'Nein. Sie brauchen einen Discord-Account und einen OSRS-Charakter. Schick ihnen die [Zuschauer-Anleitung]({joiningGuide}).',
        },
        {
          term: 'Brauchen sie das RuneLite-Plugin?',
          body: 'Für Drops und Kills ja. Das Plugin schickt sie von selbst ein. Einige Felder lesen stattdessen die Hiscores.',
        },
        {
          term: 'Ein Zuschauer sagt „The host’s Twitch connection isn’t working“.',
          body: 'Twitch akzeptiert deine Verbindung nicht mehr. Öffne **Settings** und drück **Reconnect Twitch**. Dasselbe gilt für Kick und YouTube.',
        },
        {
          term: 'Kann mir jemand anderes beim Veranstalten helfen?',
          body: 'Ja. Öffne **Players** → **Staff & roles**, füge die Person hinzu und wähle, was sie jeweils darf.',
        },
        {
          term: 'Ich führe auch einen Clan im Spiel.',
          body: 'Dann brauchst du vielleicht keinen Space. Ein öffentlicher Clan kann stattdessen **Streaming** einschalten. Siehe [Streaming für Clans]({streamingGuide}).',
        },
        {
          term: 'Kann ich einen zweiten Space erstellen?',
          body: 'Vorerst ein Space pro Discord-Account. Melde dich bei uns, wenn du einen weiteren brauchst.',
        },
        {
          term: 'Wo sind die Einstellungen meines Space?',
          body: 'Drück **Settings** im Menü. Aus einem Event heraus drückst du **Space settings** im Menü des Events.',
        },
        {
          term: 'Was macht der **Report**-Knopf auf meiner Seite?',
          body: 'Jeder, der angemeldet ist, kann deine Seite, ein Panel, ein Event oder ein Highlight beim Anvil-Team melden. Meldungen sieht nur das Team. Blendet das Team deine Bio, Panels, deinen Zeitplan oder Featured-Clip aus, steht das in deinen Einstellungen.',
        },
      ],
    },
  },

  // /guide/joining-a-streamer-event — für Zuschauer, die auf den Link eines Streamers geklickt haben.
  joiningStream: {
    metaTitle: 'Beim OSRS-Bingo eines Streamers mitmachen — Anvil',
    metaDescription:
      'Link von einem Streamer bekommen? Mit Discord anmelden, OSRS-Charakter hinzufügen, Join drücken. Was du bei Events nur für Follower oder Subs auf Twitch, Kick oder YouTube tun musst, und wie deine Drops zählen.',
    eyebrow: 'Für Zuschauer',
    title: 'Beim Event eines Streamers mitmachen',
    dek: 'Ein Streamer hat einen Link geteilt. So kommst du aufs Board. Du brauchst keinen Clan.',
    facts: [
      { strong: '~2 Min.', rest: 'zum Beitreten' },
      { strong: 'Kein Clan', rest: 'nötig' },
    ],

    join: {
      title: 'In vier Schritten beitreten',
      body: [
        '**Öffne den Link**, den der Streamer geteilt hat. Oder tippe `!join` in seinem Chat, dann postet der Bot ihn.',
        '**Melde dich mit Discord an.** Das ist dein Anvil-Account. Du musst nichts ausfüllen.',
        '**Füge deinen Charakter hinzu.** Drück **Add my character** und tippe deinen RuneScape-Namen. Steht dort **Prove it’s mine**, folge den Schritten in deinem Profil. Die [Plugin-Anleitung]({pluginGuide}) zeigt, wie.',
        '**Drück Join.** Wähle deinen Charakter, falls du mehrere hast. Du siehst **You’re in!**, wenn es geklappt hat.',
      ],
    },

    gated: {
      title: 'Events für Follower oder Subs',
      body: [
        'Manche Events sind nur für die Community des Streamers. Die Join-Karte sagt, für wen, zum Beispiel „Open to followers of somename on Twitch“.',
        'Drück trotzdem **Join**. Wirst du noch nicht reingelassen, listet die Karte, was zu tun ist. Erledige eins davon und drück dann erneut **Join**.',
      ],
      intro: 'Was du bei jeder Art tun musst:',
      rows: [
        {
          term: 'Twitch follow or sub',
          body: 'Drück **Link Twitch** und melde dich bei Twitch an. Anvil fragt nach keinen Berechtigungen. Drück dann erneut **Join**.',
        },
        {
          term: 'Kick follow or sub',
          body: 'Drück **Get Kick code**. Tippe den Code (wie `ANVIL-7F3K9Q`) innerhalb von 10 Minuten im Kick-Chat des Streamers. Jeder Code funktioniert einmal. Drück dann erneut **Join**.',
        },
        {
          term: 'YouTube subscriber',
          body: 'Drück **Check my YouTube subscription** und melde dich bei Google an. Wähle den Account, mit dem du schaust. Deine Abos müssen in den YouTube-Datenschutzeinstellungen öffentlich sein.',
        },
        {
          term: 'YouTube member',
          body: 'Drück **Link my YouTube account**, tippe dann deinen Code im YouTube-Livechat und drück **check the chat**. Das klappt nur, während der Streamer live ist.',
        },
        {
          term: 'Discord role or booster',
          body: 'Tritt dem Discord-Server des Streamers bei und hol dir die Rolle (oder boost ihn). Anvil prüft das mit dem Discord-Account, mit dem du angemeldet bist.',
        },
      ],
      note: {
        tag: 'Bestätigung',
        body: 'Manche Streamer sagen zu jedem Spieler Ja. Dann steht auf dem Button **Ask to join**, und du siehst **Waiting for the host**, bis er antwortet.',
      },
    },

    plugin: {
      title: 'Das Anvil-Plugin installieren',
      body: [
        'Deine Drops und Kills zählen über das Anvil-Plugin für RuneLite. Installiere es aus dem Plugin Hub und melde dich im Seitenpanel mit Discord an.',
        'Die [Plugin-Anleitung]({pluginGuide}) führt dich in etwa drei Minuten durch.',
      ],
    },

    play: {
      title: 'Spielen',
      body: [
        'Das war’s. Spiel ganz normal. Wenn du einen Drop oder Kill bekommst, den das Board braucht, schickt das Plugin ihn von selbst ein.',
        'Öffne den Event-Link jederzeit, um das Board und die Standings zu sehen. Du spielst nur dieses eine Event: Du trittst keinem Clan bei.',
      ],
    },

    accounts: {
      title: 'Deine verbundenen Accounts',
      body: [
        'Die Twitch-, YouTube- und Kick-Accounts, die du verknüpft hast, findest du unter [Settings → Connected accounts](/settings/connections). Dort kannst du sie auch vor dem Beitreten verknüpfen.',
        'Du kannst jederzeit eine Verknüpfung lösen. Events, denen du schon beigetreten bist, behalten dich. Bei einem beschränkten Event, dem du später beitrittst, musst du erneut verknüpfen.',
        'Verknüpfte Twitch-, YouTube- und Kick-Accounts erscheinen auf deinem Profil mit einem Verifiziert-Haken: Du hast bewiesen, dass sie dir gehören. Schalte **Show on my profile** aus, um einen zu verbergen. Ein Medal-Link ist anders. Den fügst du selbst ein, deshalb hat er keinen Haken.',
        'Streamst du selbst auf Twitch? Schalte **Clip my stream when I hit a big moment** unter deinem Twitch-Account ein. Während du in einem Streamer-Event live bist, clippt Anvil deine seltenen Drops, Pets und fertigen Felder.',
      ],
    },

    faq: {
      title: 'Fragen',
      intro: 'Wenn etwas Nein sagt:',
      rows: [
        {
          term: '„This event is full“',
          body: 'Es ist kein Platz mehr für weitere Spieler. Nur der Streamer kann Platz schaffen — sag ihm Bescheid.',
        },
        {
          term: 'Ich bin Sub, komme aber nicht rein.',
          body: 'Prüfe, ob du denselben Account verknüpft hast, mit dem du abonniert hast. Bei Twitch schau auf der Join-Karte bei **Your Twitch**. Bei Kick tippe einen frischen Code in den Chat: Anvil liest das Sub-Badge an dieser Nachricht. Bei YouTube mach deine Abos öffentlich und prüfe erneut.',
        },
        {
          term: 'Ich bin auf Kick gefolgt, aber es sagt, ich nicht.',
          body: 'Anvil sieht nur Follows, die nach dem Verbinden von Kick durch den Streamer entstanden sind. Entfolge und folge neu, dann drück **Join**.',
        },
        {
          term: '„That Twitch account was already used to join this event“',
          body: 'Ein Twitch-Account (oder Kick, oder YouTube) bringt einen Spieler rein. Jemand anderes ist damit schon beigetreten.',
        },
        {
          term: '„Twitch didn’t answer just now“',
          body: 'Bei Twitch, Kick, YouTube oder Discord gab es einen Aussetzer. Warte eine Minute und drück erneut **Join**.',
        },
        {
          term: '„The host’s … connection isn’t working“',
          body: 'Das liegt am Streamer. Sag ihm, er soll seinen Kanal auf Anvil neu verbinden.',
        },
        {
          term: 'Meine Drops erscheinen nicht.',
          body: 'Prüfe, ob das Plugin installiert und angemeldet ist und ob du mit dem Charakter beigetreten bist, den du spielst. Siehe die [Plugin-Anleitung]({pluginGuide}).',
        },
        {
          term: 'Wo finde ich mehr Events wie dieses?',
          body: '[Die Events-Seite](/events) listet Events, bei denen jeder mitmachen kann, auch Streamer-Events, die gerade offen sind.',
        },
        {
          term: 'Etwas auf der Seite eines Streamers verstößt gegen die Regeln.',
          body: 'Drück **Report** auf der Seite, dem Event oder dem Highlight. Wähle, was nicht stimmt, und drück **Send**. Es geht nur an das Anvil-Team. Der Streamer erfährt nie, wer es gemeldet hat.',
        },
      ],
    },
  },

  // /guide/streaming-for-clans — ein öffentlicher Clan schaltet Streaming ein.
  streamingClans: {
    metaTitle: 'Die Events deines Clans streamen — Anvil',
    metaDescription:
      'Lass die Zuschauer deines Streams bei einem Event deines Clans mitspielen, ohne dem Clan beizutreten: Streaming einschalten, ein Event für Zuschauer öffnen und wählen, welche Zuschauer reinkommen.',
    eyebrow: 'Für Clans, die streamen',
    title: 'Streaming für Clans',
    dek: 'Dein Clan streamt seine Events? Lass Zuschauer bei einem Event mitspielen, ohne deinem Clan beizutreten.',

    on: {
      title: 'Streaming einschalten',
      body: [
        'Geh zu Admin → **Clan settings** → **Profile** und schalte **Streaming** ein.',
        'Nur ein öffentlicher Clan kann streamen. Zuschauer müssen deine Event-Seite öffnen können, und ein privater Clan versteckt sie. Ein Clan mit eingeschaltetem Streaming kann nicht privat werden, bis du es ausschaltest.',
        'Ist es an, verbinde direkt darunter deinen Twitch-, YouTube- oder Kick-Kanal.',
      ],
    },

    event: {
      title: 'Ein Event für Zuschauer öffnen',
      body: [
        'Jedes Event bleibt **Members only**, bis du etwas anderes sagst. So war es auch vorher.',
        'Öffne die **Settings** des Events → **Entry & co-hosts** → **Who can join?** und wähle **Members and viewers**. Wähle dann **Which viewers?**: jeder, oder Follower, Subs, eine Discord-Rolle und so weiter. Drück **Save**.',
        'Diese Prüfungen gelten nur für Zuschauer. Deine Clan-Mitglieder kommen wie bisher immer rein.',
      ],
    },

    viewers: {
      title: 'Was Zuschauer sind',
      body: [
        'Ein Zuschauer, der beitritt, ist ein **Event-Spieler**. Er spielt dieses eine Event.',
        'Er ist kein Clan-Mitglied und kein Gast. Er landet nie auf deiner Clan-Liste und bekommt keinen Rang.',
        'Alle, die so beigetreten sind, siehst du unter **People** → **Past viewers**.',
      ],
    },

    tools: {
      title: 'Deine Stream-Werkzeuge',
      body: [
        'Die Streamer-Werkzeuge funktionieren wie in einem Creator-Space: verifizierte Kanal-Links, **Who can join?**-Prüfungen, das OBS-Overlay und `!join` im Chat.',
        'Die Overlay-Links für ein Clan-Event findest du in den **Settings** des Events → **Stream** → **Stream overlay**. `!join` und das Overlay-Zeichen liegen unter **Clan settings** → **Profile** → **Streaming**.',
        'Die [Creator-Anleitung]({creatorsGuide}) erklärt jedes Werkzeug Schritt für Schritt.',
        'Stream-Highlights funktionieren hier auch: Mit verbundenem Twitch oder YouTube clippt Anvil die großen Momente von Events, die für Zuschauer offen sind. `!join` im Kick-Chat hat einen eigenen Schalter im Kasten **Kick channel**.',
      ],
    },

    faq: {
      title: 'Fragen',
      intro: 'Die kurzen Antworten:',
      rows: [
        {
          term: 'Zählen Zuschauer zu unserem Mitgliederlimit?',
          body: 'Nein. Sie sind Event-Spieler, keine Mitglieder. Die Streamer-Limits zählen Spieler gleichzeitig über alle Events, die du veranstaltest (siehe die [Creator-Anleitung]({creatorsGuide})).',
        },
        {
          term: 'Schickt `!join` Leute zu einem Event nur für Mitglieder?',
          body: 'Nein. Es verweist nur auf ein Event, das für Zuschauer offen ist.',
        },
        {
          term: 'Sollte ich stattdessen einen Creator-Space erstellen?',
          body: 'Nur wenn du keinen Clan hast. Ein Space ist für Streamer ohne Clan im Spiel.',
        },
      ],
    },
  },

  people: {
    metaTitle: 'Deine Leute: Mitgliederliste, Gäste und wer beitreten darf — Anvil',
    metaDescription:
      'Woher die Mitgliederliste eines Anvil-Clans kommt, was Members, Guests, Roster only, Departed und Quiet bedeuten, wie Beitrittsanfragen und Needs review funktionieren, die drei Einstellungen unter Who can join, und jemanden entfernen oder sperren.',
    eyebrow: 'Anvil · für das Clan-Team',
    title: 'Deine Leute: Mitgliederliste, Gäste und wer beitreten darf',
    dek: 'Jeder unter Admin → **People** ist auf einem von vier Wegen dorthin gekommen: Die Clanliste im Spiel hat ihn genannt, das Team hat ihn angenommen, der Clan lässt jeden rein, oder jemand hat ihn von Hand hinzugefügt. Hier steht, wie jeder Weg funktioniert, was dir der Roster-Reiter sagt, und was du prüfst, wenn jemand am falschen Platz steht.',
    facts: [
      { strong: 'Mitgliederliste im Spiel', rest: 'der einzige automatische Weg, Mitglied zu werden' },
      { strong: 'Anmelden', rest: 'setzt niemanden auf die Mitgliederliste' },
      { strong: 'Zwei Warteschlangen', rest: 'auf zwei verschiedenen Reitern' },
    ],
    footnote:
      'Alles hier liegt unter Admin → **People**. Roster und Needs review sind Moderatorenarbeit. **Who can join** und **Staff & roles** sind Reiter nur für Admins. Wer im ganzen Adminbereich was darf, steht in [Teamrollen: wer was darf]({staffGuide}).',

    roster: {
      title: 'Woher die Mitgliederliste kommt',
      body: [
        'Die Mitgliederliste ist eure Clanliste aus dem Spiel, auf die Seite kopiert. Ein Admin schickt sie mit dem Anvil-Plugin aus RuneLite: Drück den **Anvil**-Button in der Titelleiste des Clan-Fensters oder **Sync roster** im Seitenpanel des Plugins. Jeder auf der Liste kommt als **Mitglied** an, mit seinem Rang im Spiel. Nur wer auf der Seite die Admin-Rolle hat, kann sie schicken. Alle anderen bekommen das im Spiel gesagt.',
        'Eine Synchronisierung ist das Einzige, was jemanden von selbst zum Mitglied macht. Wer den Clan im Spiel verlässt, wird bei der nächsten Synchronisierung als ausgetreten markiert, und wer zurückkommt, ist bei der Synchronisierung danach wieder da. Sein Verlauf bleibt in beiden Fällen erhalten.',
        'Jeder andere Sitz ist ein **Gast**-Sitz: jemand, der bei euren Events mitspielt, ohne in eurem Clan im Spiel zu sein. Gäste werden erfasst und können an Events teilnehmen. Sie sind keine Mitglieder und zählen nicht für euren Tarif.',
      ],
      note: {
        tag: 'Anmelden setzt niemanden auf die Mitgliederliste',
        body: 'Sich mit Discord anmelden, einen Charakter verknüpfen oder mit dem Plugin spielen gibt niemandem einen Sitz. Sieht das Plugin jemanden, dessen Clan im Spiel eurer ist, der aber noch nicht auf der Mitgliederliste steht, fragt es für ihn an (siehe Schritt 3). Alle anderen haben einfach einen Anvil-Account ohne Clan. Genau das verhindert, dass ein Fremder eurem Clan beitritt, indem er seinen Namen eintippt.',
      },
    },

    filters: {
      title: 'Den Roster-Reiter lesen',
      intro:
        'Der Balken oben teilt die Mitgliederliste in **Members**, **Guests** und **Departed**. Klick auf einen Abschnitt, um danach zu filtern. Die Chips darunter grenzen die Liste weiter ein:',
      rows: [
        {
          term: 'Active',
          body: 'Mitglieder, die noch auf der Mitgliederliste stehen. Gäste und Ausgetretene sind nicht dabei.',
        },
        {
          term: 'Quiet 7d+',
          body: 'Mitglieder, die das Plugin seit sieben Tagen oder länger nicht spielen gesehen hat. Wer das Plugin nie benutzt hat, ist nicht dabei, weil es nichts gibt, woran man ihn messen könnte. Bei ihm steht unter **Last played** stattdessen **no plugin data**.',
        },
        {
          term: 'Guests',
          body: 'aktuelle Gast-Sitze: Leute, die bei euren Events mitspielen, aber nicht in eurem Clan im Spiel sind.',
        },
        {
          term: 'Roster only',
          body: 'aktuelle Mitglieder und Gäste, hinter denen noch kein Account auf der Seite steht. Normal für jeden, der sich nie mit Discord angemeldet hat. Sie bleiben auf der Mitgliederliste; sie melden sich an und verknüpfen den Charakter, wenn sie sich für etwas anmelden wollen.',
        },
        {
          term: 'Departed',
          body: 'Leute, die im Spiel ausgetreten sind oder die das Team entfernt hat. Ihre Ergebnisse und ihr Verlauf bleiben.',
        },
        {
          term: 'All',
          body: 'alle oben Genannten.',
        },
      ],
      outro:
        'Die Spalte **Source** sagt, wie jeder Sitz entstanden ist: **Clan sync**, **Added manually** oder **Applied or self-reported**. **Last played** kommt vom Plugin, nicht von der Synchronisierung der Mitgliederliste.',
      note: {
        tag: 'Rang und Rolle sind zwei verschiedene Dinge',
        body: 'Die beiden Auswahllisten neben den Chips filtern nach Rang im Spiel und nach Rolle auf der Seite. Der Rang ist, was das Spiel meldet. Die Rolle auf der Seite setzt ein Admin unter **Staff & roles**. Das eine setzt nie das andere.',
      },
    },

    review: {
      title: 'Beitrittsanfragen und Needs review',
      intro: 'Zwei Arten von Leuten warten auf ein Ja, und sie warten auf verschiedenen Reitern.',
      rows: [
        {
          term: 'Asking to join',
          body: 'oben im Reiter **Roster**, nur sichtbar, solange jemand wartet. Eine Anfrage kommt von der Seite (er hat auf eurer Clanseite **Apply** gedrückt oder versucht, an einem eurer Events teilzunehmen) oder vom Plugin (es hat ihn in eurem Clan im Spiel spielen sehen, bevor er auf der Mitgliederliste stand). Jede Zeile sagt, woher, und ob er Mitglied eines anderen Clans ist. **Approve** gibt ihm einen Gast-Sitz. **Decline** sagt es ihm, per Discord-Direktnachricht, wenn euer Bot ihn erreicht. Hak mehrere an, um sie auf einmal zu beantworten.',
        },
        {
          term: 'Awaiting confirmation',
          body: 'unter **Needs review**. Leute, die einen Charakter von eurer Mitgliederliste verknüpft haben, indem sie darauf XP gesammelt, darum gebeten oder ihn mit dem Plugin gespielt haben. Sie können schon spielen, während sie warten. Prüf, ob der Discord-Name zum Charakter passt, und drück dann **Approve**. **Not our member** nimmt den Charakter von eurer Liste und lässt ihn bei seinem Besitzer. **Report to Anvil** ist für einen Charakter, der nicht ihm gehört.',
        },
        {
          term: 'Claim requests',
          body: 'ebenfalls unter **Needs review**. Jemand hat einen Charakter gespielt, der hier schon ein etabliertes Mitglied ist, also verknüpft Anvil ihn nicht von selbst mit ihm. Wenn du weißt, dass er es ist, drück **Yes, that’s them**; wenn nicht, **Not them**. Ein Charakter, der nur je in eurem Clan war, wird sofort verknüpft. Einer, der auch in einem anderen Clan ist, geht zur Entscheidung an Anvil.',
        },
      ],
      note: {
        tag: 'Das Abzeichen zählt keine Beitrittsanfragen',
        body: 'Die Zahl an **Needs review** und an **People** in der Seitenleiste zählt Awaiting confirmation und Claim requests. Beitrittsanfragen sind nicht dabei, schau also auch oben in den Roster-Reiter.',
      },
    },

    policy: {
      title: 'Wer beitreten darf',
      intro:
        'Admin → People → **Who can join** hat drei Einstellungen, und nur Admins sehen den Reiter. Wie Außenstehende hereinkommen, entscheidet **Players from other clans**:',
      rows: [
        {
          term: 'Ask first',
          body: 'die Voreinstellung. Wer sich bewirbt oder wen das Plugin aus eurem Clan im Spiel aufgreift, wartet als Beitrittsanfrage, bis das Team ihn annimmt. Ohne ein Ja bekommt niemand einen Sitz.',
        },
        {
          term: 'Let anyone in',
          body: 'Fragen reicht. Er bekommt sofort einen Gast-Sitz, und es wird keine Anfrage angelegt. Gut für ein offenes Event, sonst laut.',
        },
        {
          term: 'No guests',
          body: 'nur eure eigenen Mitglieder spielen. Spieler aus anderen Clans können weder an euren Events teilnehmen noch eine Beitrittsanfrage stellen, und das Plugin legt für sie nichts an.',
        },
      ],
      outro:
        '**Who can see this clan** ist **Anyone** (ein Board-Link funktioniert für jeden, dem du ihn schickst) oder **Members only** (alle anderen sehen die Karte des Clans und eine Einladung, sich zu bewerben). **List in the Clan Hall** setzt den Clan auf die öffentliche Clanliste. Ausschalten macht den Clan nicht privat.',
      note: {
        tag: 'Nichts davon betrifft eure Mitglieder',
        body: 'Die Synchronisierung der Mitgliederliste gibt Mitgliedern ihren Sitz, egal was hier steht. Auch euer eigenes Team wird nie als Gast behandelt: Der Charakter eines Teammitglieds bekommt ohne Anfrage einen Mitglieds-Sitz.',
      },
    },

    manual: {
      title: 'Jemanden von Hand hinzufügen',
      body: [
        'Roster → **+ Add Manually** setzt einen Charakter auf die Mitgliederliste. Füll **RSN** aus, und wenn du willst **Discord ID** und **Rank**. Hak **Add as guest** an für jemanden, der nicht in eurem Clan im Spiel ist. Moderatoren und Admins können das beide.',
        'Nutz das für jemanden, den die Synchronisierung noch nicht sieht, etwa einen Neuzugang, der nach der letzten Synchronisierung beigetreten ist. Der Sitz wird als **Added manually** markiert, und die Synchronisierung behandelt ihn als deine Entscheidung: Entfernst du später einen von Hand hinzugefügten Sitz, holt ihn die nächste Synchronisierung nicht zurück.',
        'Jemanden auf die Mitgliederliste zu setzen, meldet ihn nicht für ein Event an. Dafür öffnest du den Reiter **Sign-ups** des Events und nimmst **Add member**. Das dürfen nur Admins.',
      ],
    },

    removing: {
      title: 'Entfernen und sperren',
      intro: 'Jede Zeile der Mitgliederliste hat ein Aktionsmenü. Diese Aktionen tun Verschiedenes:',
      rows: [
        {
          term: 'Demote to guest',
          body: 'er bleibt auf der Liste und kann weiter für Events eingetragen werden, zählt aber nicht mehr als Mitglied. **Promote to member** macht es rückgängig.',
        },
        {
          term: 'Remove from roster',
          body: 'markiert ihn als ausgetreten. Sein Verlauf und seine Ergebnisse bleiben. Ist er noch in eurem Clan im Spiel, kann die nächste Synchronisierung ihn wieder hinzufügen.',
        },
        {
          term: 'Not our member',
          body: 'unter Needs review, für einen verknüpften Charakter, der nicht in eurem Clan ist. Er kommt von eurer Liste und bleibt bei seinem Besitzer.',
        },
        {
          term: 'Ban from this clan',
          body: 'beendet jeden Sitz, den die Person hier hat, Zweitaccounts eingeschlossen, nimmt ihr jede Teamrolle und jede Board-Aufgabe in diesem Clan und hält sie draußen: Synchronisierung, Plugin und Beitrittsanfragen weisen sie alle ab, bis die Sperre aufgehoben ist. Ihr Anvil-Account und ihre anderen Clans bleiben unberührt. Nur Admins, für jemanden mit Account auf der Seite und einer Rolle unter Admin, über das Zeilenmenü, unter **Staff & roles** oder für mehrere Leute auf einmal. Eine aufgehobene Sperre holt niemanden zurück; er tritt im Spiel wieder bei, oder du fügst ihn hinzu.',
        },
      ],
      note: {
        tag: 'Eine Sperre nimmt auch die Teamrolle weg',
        body: 'Eine Sperre beendet die Sitze und nimmt die Teamrolle sowie jede Aufgabe als Board-Editor oder Board-Kassenwart auf den Boards dieses Clans weg. Wird die Sperre aufgehoben, kommt nichts davon zurück: Setz die Rolle unter Staff & roles neu, wenn die Person sie haben soll.',
      },
    },

    faq: {
      title: 'Häufige Fragen',
      intro: 'Was meistens erklärt, warum jemand am falschen Platz steht.',
      rows: [
        {
          term: 'Jemand aus dem Clan fehlt',
          body: 'Mach zuerst eine Synchronisierung der Mitgliederliste: Die Liste ändert sich nur, wenn ein Admin sie schickt. Schau dann unter **Departed**, falls er entfernt wurde, und ob er gesperrt ist; die Synchronisierung überspringt jeden, der hier gesperrt ist, und meldet, wen sie übersprungen hat. Ist der Clan über seinem Tarif und die Schonfrist vorbei, fügt eine Synchronisierung keine neuen Mitglieder mehr hinzu, bis du upgradest oder die Liste kürzt.',
        },
        {
          term: 'Jemand ist im Clan, steht aber als Gast da',
          body: 'Meistens ist er auf Anvil noch Mitglied eines anderen Clans. Ein Charakter kann nur in einem Clan zugleich Mitglied sein, also setzt ihn die Synchronisierung hier als Gast und macht ihn bei der ersten Synchronisierung, nachdem er den anderen Clan verlassen hat, zum Mitglied. Sonst kam er über eine Beitrittsanfrage, oder jemand hat ihn herabgestuft oder als Gast hinzugefügt. Mach eine Synchronisierung oder nimm **Promote to member**.',
        },
        {
          term: 'Jemand hat sich angemeldet, steht aber nicht auf der Mitgliederliste',
          body: 'Das ist so gewollt. Anmelden legt einen Anvil-Account an, keinen Sitz. Er erscheint, wenn die Synchronisierung ihn aufführt, wenn du seine Anfrage annimmst oder wenn du ihn von Hand hinzufügst.',
        },
        {
          term: 'Namen wie #Player1234',
          body: 'RuneLite zeigt kurz so einen Platzhalter, während sich ein Spieler einloggt, und für Clanmitglieder, die es nicht benennen kann. Anvil ignoriert solche Namen inzwischen: Die Synchronisierung überspringt sie, das Plugin legt keine Anfrage für sie an, und alte Anfragen unter so einem Namen sind ausgeblendet. Steht noch einer auf deiner Mitgliederliste, ist es eine alte Zeile. **Remove from roster** räumt sie weg.',
        },
        {
          term: 'Ein entferntes Mitglied kommt immer wieder',
          body: 'Jemanden zu entfernen, ändert nichts am Clan im Spiel, also fügt ihn die nächste Synchronisierung wieder hinzu, solange das Spiel ihn noch aufführt. Entfern ihn im Spiel oder sperr ihn hier.',
        },
        {
          term: 'Ein Moderator sieht Who can join nicht',
          body: 'Das ist ein Reiter nur für Admins, wie Staff & roles. Siehe [Teamrollen: wer was darf]({staffGuide}).',
        },
      ],
    },
  },

  staffRoles: {
    metaTitle: 'Teamrollen: wer was darf — Anvil',
    metaDescription:
      'Die Clanrollen auf Anvil (Eigentümer, Admin, Kassenwart, Moderator, Mitglied), was jede erreicht, wie du jemanden zum Moderator machst, wer welche Rolle vergeben darf, und die Aufgaben für ein einzelnes Event.',
    eyebrow: 'Anvil · für Eigentümer und Admins',
    title: 'Teamrollen: wer was darf',
    dek: 'Fünf Rollen, pro Clan gesetzt unter Admin → People → **Staff & roles**. Eine Rolle hier gibt in keinem anderen Clan etwas, und niemand kann eine Rolle auf oder über seiner eigenen vergeben. Diese Seite ist die ganze Karte: was jede Rolle erreicht, wie du eine vergibst, und die Aufgaben für ein einzelnes Event.',
    facts: [
      { strong: 'Pro Clan', rest: 'eine Rolle hier bedeutet anderswo nichts' },
      { strong: 'Unter deiner eigenen', rest: 'ist alles, was du vergeben kannst' },
      { strong: 'Eigentümer', rest: 'wechselt nur per Übertragung' },
    ],
    footnote:
      'Rollen werden bei jedem Seitenaufruf neu geprüft, eine Änderung gilt also beim nächsten Klick der Person; abmelden muss sie sich nicht. Zur Mitgliederliste selbst siehe [Deine Leute]({peopleGuide}). Zum Alltag eines Moderators siehe [Im Dienst]({moderatorGuide}).',

    roles: {
      title: 'Die Rollen',
      intro: 'Jeder, der sich mit Discord anmeldet, beginnt als einfaches **Member**. Darüber:',
      rows: [
        {
          term: 'Eigentümer',
          body: 'wer den Clan gegründet hat, bis er ihn weitergibt. Alles, was ein Admin kann, plus das Eigentum übertragen und den Clan löschen. Es gibt genau einen, und niemand kann ihn herabstufen, entfernen oder sperren.',
        },
        {
          term: 'Admin',
          body: 'alles außer der Übergabe des Clans: Events und Boards, Einstellungen, Discord, das Team und das Geld des Clans.',
        },
        {
          term: 'Kassenwart',
          body: 'Gebühren, die Kasse und Preise, zusätzlich zu allem, was ein Moderator macht: die Mitgliederliste, Nachweise, Wettbewerbe, der Schedule und Needs review.',
        },
        {
          term: 'Moderator',
          body: 'Neulinge, die Mitgliederliste, Nachweise, Wochenwettbewerbe und Clan-Events. Keine Events oder Boards, keine Einstellungen, kein Team und kein Geld.',
        },
        {
          term: 'Mitglied',
          body: 'keine Teamaufgabe. Spielt, meldet sich an und kann eine Spende an die Kasse melden.',
        },
      ],
      outro:
        'Unter der Rolle auf Staff & roles sitzen zwei Kästchen, für jeden unterhalb von Admin, einfache Mitglieder eingeschlossen. **Can build bingo boards** öffnet den Tiles-Reiter jedes Boards und die Task library. **Can write guides** lässt ihn die Anleitungen des Clans schreiben. Admins haben beides schon.',
    },

    assign: {
      title: 'Jemanden zum Moderator machen',
      intro:
        'Er muss sich mit Discord angemeldet und einen Charakter verknüpft haben, der auf eurer Mitgliederliste steht, als Mitglied oder als Gast. Dann:',
      steps: [
        'Öffne Admin → **People** → **Staff & roles**.',
        'Die Liste öffnet sich auf **Staff**. Wechsle zu **Members** oder **All accounts** und such nach seinem Namen.',
        'Wähl in der Spalte **Role** den Eintrag **Moderator: newcomers, roster, sign-ups, proofs**. Gespeichert wird sofort beim Auswählen.',
        'Soll er auch Boards bauen, hak **Can build bingo boards** an.',
      ],
      outro:
        'Noch nicht angemeldet? Such seinen Charakter im Reiter **Roster**, öffne dessen Menü und wähl **Set role**. Das speichert die Rolle am Charakter. Er bekommt sie, sobald er sich zum ersten Mal anmeldet und den Charakter verknüpft, oder, wenn er unter Needs review wartet, sobald ein Moderator ihn annimmt.',
      note: {
        tag: 'Die Rolle wieder wegnehmen',
        body: 'Setz die Rolle zurück auf **Member**. Eine Rollenänderung nimmt auch alle Board-Aufgaben weg, die jemand auf den Boards dieses Clans hatte (siehe Schritt 5). Trag sie danach wieder ein, wenn er sie behalten soll.',
      },
    },

    who: {
      title: 'Wer was vergeben darf',
      intro:
        'Staff & roles ist ein Reiter nur für Admins, und jede Änderung dort wird gegen zwei Regeln geprüft: Du kannst nur eine Rolle unter deiner eigenen vergeben, und du kannst nur jemanden ändern, dessen Rolle unter deiner eigenen liegt.',
      rows: [
        {
          term: 'Der Eigentümer',
          body: 'kann Admin, Kassenwart und Moderator vergeben oder wegnehmen.',
        },
        {
          term: 'Ein Admin',
          body: 'kann Kassenwart und Moderator vergeben oder wegnehmen. Ein Admin kann keinen weiteren Admin ernennen, keinen anderen Admin ändern und nicht seine eigene Rolle ändern.',
        },
        {
          term: 'Kassenwarte und Moderatoren',
          body: 'können niemandes Rolle ändern. Der Reiter ist für sie ausgeblendet.',
        },
        {
          term: 'Niemand',
          body: 'kann die Rolle des Eigentümers ändern, ihn entfernen oder sperren. Außerdem behält der Clan immer einen Admin: Der letzte kann nicht herabgestuft werden.',
        },
      ],
      note: {
        tag: 'Den Clan übergeben',
        body: 'Das kann nur der Eigentümer, und nur an jemanden, der schon Admin ist: Die Zeile dieses Admins bekommt die Aktion **Make owner**. Aus Sicherheitsgründen dauert es 3 Tage, wie das Ändern einer Bank-PIN: Ein Banner auf jeder Admin-Seite zeigt, wann es passiert, bis dahin kannst du mit **Cancel** abbrechen, er kann mit **Decline** ablehnen, und das Anvil-Team wird informiert und kann es stoppen. Nach den 3 Tagen wird er Eigentümer, und du wirst ein normaler Admin. Nur der neue Eigentümer kann es zurückübertragen.',
      },
    },

    table: {
      title: 'Wer was darf',
      intro:
        'Was jede Rolle im Adminbereich erreicht. „Wenn angehakt“ meint das Kästchen **Can build bingo boards** oder **Can write guides** unter Staff & roles.',
      areaLabel: 'Bereich',
      columns: ['Eigentümer', 'Admin', 'Kassenwart', 'Moderator', 'Mitglied'],
      rows: [
        { area: 'Dashboard', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nein'] },
        { area: 'Events: anlegen, bearbeiten, Teams, Anmeldungen, starten', cells: ['Ja', 'Ja', 'Nein', 'Nein', 'Nein'] },
        { area: 'Board-Felder und die Task library', cells: ['Ja', 'Ja', 'Wenn angehakt', 'Wenn angehakt', 'Wenn angehakt'] },
        { area: 'Nachweise prüfen', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nein'] },
        { area: 'Wochenwettbewerbe', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nein'] },
        { area: 'Clan-Events', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nein'] },
        { area: 'Schedule', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nein'] },
        { area: 'Mitgliederliste: ansehen, hinzufügen, entfernen', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nein'] },
        { area: 'Beitrittsanfragen und Needs review', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nein'] },
        { area: 'Jemanden aus dem Clan sperren', cells: ['Ja', 'Unter Admin', 'Nein', 'Nein', 'Nein'] },
        { area: 'Staff & roles', cells: ['Ja', 'Unter Admin', 'Nein', 'Nein', 'Nein'] },
        { area: 'Who can join', cells: ['Ja', 'Ja', 'Nein', 'Nein', 'Nein'] },
        { area: 'Kasse und Preisleitern', cells: ['Ja', 'Ja', 'Ja', 'Nein', 'Nein'] },
        { area: 'Gebühren: als eingesammelt markieren', cells: ['Ja', 'Ja', 'Ja', 'Nein', 'Nein'] },
        { area: 'Gebühren: bestätigen (die zweite Unterschrift)', cells: ['Ja', 'Ja', 'Nein', 'Nein', 'Nein'] },
        { area: 'Discord-Einstellungen', cells: ['Ja', 'Ja', 'Nein', 'Nein', 'Nein'] },
        { area: 'Auf Discord posten', cells: ['Ja', 'Ja', 'Nein', 'Nein', 'Nein'] },
        { area: 'Clan-Einstellungen: Profile, Features, Rules & scoring, Boosts', cells: ['Ja', 'Ja', 'Nein', 'Nein', 'Nein'] },
        { area: 'Tarif und Abrechnung', cells: ['Ja', 'Ja', 'Nein', 'Nein', 'Nein'] },
        { area: 'Anleitungen', cells: ['Schreiben', 'Schreiben', 'Lesen; schreiben wenn angehakt', 'Lesen; schreiben wenn angehakt', 'Schreiben wenn angehakt'] },
        { area: 'Aktivitätsprotokoll', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nein'] },
        { area: 'Mitgliederliste aus RuneLite synchronisieren', cells: ['Ja', 'Ja', 'Nein', 'Nein', 'Nein'] },
        { area: 'Eigentum übertragen, Clan löschen', cells: ['Ja', 'Nein', 'Nein', 'Nein', 'Nein'] },
      ],
      note: {
        tag: 'Ausgeblendet heißt nicht erlaubt',
        body: 'Die Seitenleiste zeigt nur, was deine Rolle nutzen kann, aber die Prüfung, die zählt, läuft auf dem Server. Wer die Adresse einer Seite eintippt, die seine Rolle nicht nutzen darf, landet wieder auf dem Dashboard, und die Aktion dahinter wird abgelehnt.',
      },
    },

    event: {
      title: 'Aufgaben für ein Event',
      intro:
        'Manche Aufgaben gelten für ein einzelnes Event statt für den Clan. Ein Admin vergibt sie am Event selbst, und sie reichen bis zu diesem Event und nicht weiter. Du kannst sie also ruhig einem einfachen Mitglied geben.',
      rows: [
        {
          term: 'Board-Editor',
          body: 'baut und bearbeitet die Felder dieses Boards. Vergeben unter **Settings** → **Staff** → **Board staff** des Events, oder mit **Boards…** in den Aktionen einer Person unter Staff & roles. Ein Mitglied mit dieser Aufgabe sieht im Adminbereich nur seine Boards.',
        },
        {
          term: 'Board-Kassenwart',
          body: 'sammelt die Gebühren dieses Boards ein und wickelt seine Auszahlungen ab, ohne an die Clan-Kasse zu kommen. Im Adminbereich sieht er nur seine eigenen Boards und von jedem Board nur die Reiter **Sign-ups** und **Prizes**. Wird ebenfalls unter **Board staff** vergeben.',
        },
        {
          term: 'Team staff',
          body: 'führt ein Team: seine Aufstellung, seine Einreichungen und Nachweise, und das Markieren bezahlter Gebühren seiner Spieler. Sie können kein anderes Team anfassen, das Board nicht bearbeiten, keine Draft-Picks machen und niemanden auswechseln, sobald das Event läuft. Hinzugefügt auf der Teamseite unter **Team staff**. So führt der Moderator eines Gastclans seine Hälfte eines Clan-gegen-Clan.',
        },
        {
          term: 'Kapitän',
          body: 'vom Ausrichter für ein Team ernannt. Alles, was Team staff kann, plus die Draft-Picks des Teams.',
        },
      ],
      note: {
        tag: 'Eine Clanrolle ersetzt Board-Aufgaben',
        body: 'Wer eine Clanrolle bekommt oder eine andere, verliert seine Aufgaben als Board-Editor und Board-Kassenwart auf den Boards dieses Clans. Staff & roles warnt dich vorher, wenn Board-Aufgaben alles sind, was er hat. Trag sie danach wieder ein, wenn er sie behalten soll.',
      },
    },

    safety: {
      title: 'Damit es sicher bleibt',
      intro: 'Das gilt, egal wie die Rollen gesetzt sind.',
      rows: [
        {
          term: 'Der Eigentümer ist geschützt',
          body: 'seine Zeile unter Staff & roles zeigt **Protected**. Seine Rolle lässt sich nicht ändern, und er kann nicht gesperrt werden. Das Eigentum wechselt nur, wenn er es überträgt.',
        },
        {
          term: 'Admins können sich nicht gegenseitig entfernen',
          body: 'ein Admin kann einen anderen Admin weder herabstufen noch sperren, weder einzeln noch mehrere auf einmal. Sind sich zwei Admins uneinig, entscheidet der Eigentümer. Eine Sperre nimmt der Person auch ihre Teamrolle und ihre Board-Aufgaben in diesem Clan.',
        },
        {
          term: 'Geld braucht zwei Leute',
          body: 'muss eine Gebühr bestätigt werden, muss die Bestätigung von einem anderen Admin kommen als dem, der sie als eingesammelt markiert hat. Wie viele Bestätigungen eine Gebühr braucht, von null bis fünf, steht unter **Clan settings** → **Rules & scoring** → **Fee sign-off**. Ein Admin, der als Einziger mit Geld zu tun hat, kann eine Gebühr trotzdem abschließen, mit einem eigenen Button.',
        },
        {
          term: 'Was ein Moderator nicht kann',
          body: 'Events anlegen oder bearbeiten, Einstellungen oder Discord ändern, jemandem eine Rolle geben (sich selbst eingeschlossen) oder das Geld des Clans anfassen.',
        },
        {
          term: 'Alles wird festgehalten',
          body: 'Rollenänderungen, Eigentumsübertragungen, Sperren und beantwortete Beitrittsanfragen landen im **Activity log**, das jedes Teammitglied lesen kann.',
        },
        {
          term: 'Discord-Rollen sind etwas anderes',
          body: 'Anvils Rollen-Synchronisierung ordnet Discord-Rollen den **Rängen im Spiel** zu, nicht den Rollen auf der Seite. Wer hier Moderator wird, bekommt dadurch nichts auf eurem Discord-Server, und eine Moderatorenrolle, die du in Discord von Hand vergeben hast, bleibt unangetastet. Der eine Bot-Befehl, der etwas ändert, eine Einzahlung in die Kasse mit `/coffer`, prüft die Rolle auf der Seite: Kassenwart, Admin oder Eigentümer.',
        },
      ],
    },
  },

  supporter: {
    metaTitle: 'Anvil Supporter: Stufen und Vorteile — Anvil',
    metaDescription:
      'Was Anvil Supporter, Champion und Patron jeweils bekommen: Namensfarben und der Stern, goldenes GZ, animierter Avatar und Banner, die Vitrine, Freundes-Events, Head-to-head, Event-Chat und Clan-Boosts. Wie die Abrechnung über Gumroad läuft und was passiert, wenn du kündigst.',
    eyebrow: 'Anvil · für Spieler',
    title: 'Anvil Supporter: Stufen und Vorteile',
    dek: 'Anvil Supporter ist ein persönliches Abo, das Anvils Server bezahlt. Es gibt drei Stufen, und jede hat alles, was die darunter hat. Jeder Vorteil ist Optik oder mehr Platz zum Ausrichten: Tracking, Events, Wertung und deine eigenen Statistiken bleiben für alle kostenlos, und nichts hier ändert, was ein Event zählt.',
    facts: [
      { strong: 'Ab $1 im Monat', rest: 'oder $10 im Jahr' },
      { strong: 'Nur Optik', rest: 'nie eine Wertung, ein Rang oder ein Item' },
      { strong: 'Nichts wird gelöscht', rest: 'wenn du aufhörst' },
    ],
    footnote:
      'Alles hier stellst du auf der Website unter **Settings** → **Supporter**, **Profile look** und **Clan boosts** ein. Boosts im Detail stehen in [Einen Clan boosten]({boostsGuide}). Wo deine Farben in RuneLite erscheinen, steht in [Das Seitenpanel, Tab für Tab]({panelGuide}).',

    tiers: {
      title: 'Die drei Stufen',
      intro: 'Die Preise stehen auf der Seite **Anvil Supporter**, `/supporter`. Ein Jahresplan kostet so viel wie zehn Monate.',
      rows: [
        {
          term: 'Supporter',
          body: '$1 im Monat oder $10 im Jahr. Ein goldener Name und ein Stern, ein goldenes GZ, eine Vitrine mit 4 Plätzen, und du kannst ein Freundes-Event ausrichten.',
        },
        {
          term: 'Champion',
          body: '$2 im Monat oder $20 im Jahr. Ein Namensverlauf aus unseren Vorlagen (oder eine eigene Farbe), dein eigener Avatar und Banner (auf Wunsch animiert), 8 Vitrinenplätze, schnellerer Event-Chat und 1 Clan-Boost.',
        },
        {
          term: 'Patron',
          body: '$5 im Monat oder $50 im Jahr. Dein eigener Verlauf aus bis zu 4 Farben, der sich bewegt, 12 Vitrinenplätze, keine Wartezeit im Event-Chat, 2 Freundes-Events gleichzeitig und 2 Clan-Boosts.',
        },
      ],
      note: {
        tag: 'Zeit durch Einladungen',
        body: 'Unter Settings → Supporter bekommst du einen Einladungslink. Wenn ein Freund, den du eingeladen hast, bezahlt, verdienst du Gratismonate; die Belohnung kommt zwei Wochen nach seiner ersten Zahlung. So verdiente Zeit gibt jeden Vorteil ihrer Stufe außer Clan-Boosts.',
      },
    },

    compare: {
      title: 'Was jede Stufe bekommt',
      intro: 'Dieselbe Tabelle wie auf der Supporter-Seite, plus die Chat-Vorteile.',
      table: {
        areaLabel: 'Vorteil',
        columns: ['Kostenlos', 'Supporter', 'Champion', 'Patron'],
        rows: [
          { area: 'Namensfarben', cells: ['—', 'Gold', 'Vorlagen oder eine eigene Farbe', 'Vorlagen oder bis zu vier Farben, bewegt'] },
          { area: 'Stern neben deinem Namen', cells: ['—', 'Ja', 'Ja', 'Ja'] },
          { area: 'Goldenes GZ', cells: ['—', 'Ja', 'Ja', 'Ja'] },
          { area: 'Eigener Avatar und Banner, animiert', cells: ['—', '—', 'Ja', 'Ja'] },
          { area: 'Vitrine', cells: ['—', '4 Plätze', '8 Plätze', '12 Plätze'] },
          { area: 'Freundes-Events (gleichzeitig · Spieler)', cells: ['Nur beitreten', '1 · 10', '1 · 25', '2 · 50'] },
          { area: 'Head-to-head-Herausforderungen', cells: ['1 aktiv', '5 aktiv', 'Unbegrenzt', 'Unbegrenzt'] },
          { area: 'Event-Chat: Wartezeit zwischen Zeilen', cells: ['5 s', '3 s', '1 s', 'Keine'] },
          { area: 'Clan-Boosts', cells: ['—', '—', '1', '2'] },
        ],
      },
      outro:
        'Unter **Settings** → **In-game chat** gibt es drei weitere: eigene Farben für deinen Chat-Feed (Supporter), die Wahl, was deine Login-Zusammenfassung abdeckt (Champion), und einen Stern neben deinem Namen in den Chat-Feeds anderer Spieler (Patron).',
    },

    names: {
      title: 'Namensfarben',
      intro:
        'Du stellst sie unter **Settings** → **Supporter** ein, in **Your name’s look**. Die Vorschau zeigt deinen Namen auf dunklem und auf hellem Hintergrund.',
      rows: [
        {
          term: 'Supporter',
          body: 'einfarbiges Gold. Es gibt nichts auszuwählen.',
        },
        {
          term: 'Champion',
          body: 'einer der vorgefertigten Verläufe (**Classic**, die Voreinstellung, **Ember**, **Ocean**, **Aurora**, **Rose gold** oder **Toxic**) oder **Your own**: eine feste Farbe. Über alle deine Charaktere hinweg kannst du höchstens zwei verschiedene eigene Farben verwenden.',
        },
        {
          term: 'Patron',
          body: 'jede Vorlage plus **Prism**, die Voreinstellung für Patrons, oder **Your own** mit einer bis vier Farben. Eine Farbe bleibt stehen; zwei bis vier ergeben einen Verlauf, der von links nach rechts wandert.',
        },
      ],
      outro:
        '**Your Anvil display name** ist der Name auf deinem mit Discord verknüpften Account. Unter **Your RuneScape characters** wählst du **Same for all** oder **Customize each**, um jedem Charakter einen eigenen Look zu geben. Drück **Save** (oder **Save for all characters**); **Reset to default** geht zurück zu den Farben deiner Stufe.',
      note: {
        tag: 'Dunkle und helle Hintergründe',
        body: 'Die Seite, das Plugin-Panel und Discord sind dunkel; die feste Chatbox des Spiels ist hell. Anvil passt deine Farben an, damit sie auf beiden lesbar bleiben. Willst du auf einem davon einen anderen Look, schalte **Set a separate look for dark backgrounds** oder **for light backgrounds** ein. Dieser Look wird genau so gezeigt, wie du ihn gewählt hast, ohne Kontrastkorrektur, und die Vorschau warnt dich, wenn er schwer lesbar ist.',
      },
    },

    where: {
      title: 'Wo dein Flair erscheint',
      intro: 'Deine Farben und der Stern gehen überall hin, wo dein Name auftaucht:',
      rows: [
        {
          term: 'Auf der Seite',
          body: 'Boards, Mitgliederlisten, Profile, dein eigener Name in der oberen Leiste und deine Charakternamen. Der Stern trägt deine Farben.',
        },
        {
          term: 'Im Plugin-Panel',
          body: 'der Feed, Event-Chat, Karten und die **Tracking**-Zeile. Der Verlauf eines Patrons gleitet; jeder Spieler kann ihn mit **Animated names** anhalten.',
        },
        {
          term: 'Im Spiel',
          body: 'für andere Spieler, die das Anvil-Plugin nutzen: öffentlicher, Clan-, Freundes- und privater Chat, Clan-Broadcasts, Login-Hinweise, Freundes- und Clanlisten und das Rechtsklickmenü (nie auf PvP-Welten oder in der Wilderness). Im Spielchat ist der Stern den Patrons vorbehalten.',
        },
        {
          term: 'In Discord',
          body: 'ein Stern neben deinem Namen in Anvils Posts, in deinen eigenen Farben, wenn du welche gewählt hast.',
        },
        {
          term: 'Goldenes GZ',
          body: 'auf den Drop eines Clankameraden im Feed deines Clans auf der Seite kann dein GZ golden sein. Nur Supporter können eins vergeben.',
        },
      ],
      note: {
        tag: 'Nur auf Charakteren, die nachweislich dir gehören',
        body: 'Farben erscheinen nur auf Charakteren, bei denen das Plugin bestätigt hat, dass sie dir gehören, auf der Seite und im Spiel. Um sie im Spielchat anderer Leute von deinen Namen fernzuhalten, entferne unter Settings → Supporter den Haken bei **Show my colours on my characters’ names in game chat**.',
      },
    },

    profile: {
      title: 'Avatar, Banner und Vitrine',
      intro: 'Alle drei liegen unter **Settings** → **Profile look**.',
      rows: [
        {
          term: 'Avatar & Banner',
          body: 'Champion und Patron. Lade deine eigenen hoch; ein GIF oder WebP bleibt animiert. Sie erscheinen auf deiner Karte, deinem Profil und jedem deiner Charaktere, auf der Seite und im Plugin. Ein Banner darf bis zu 6 MB groß und mindestens 600×150 sein; ein Avatar bis zu 2 MB.',
        },
        {
          term: 'Pro Charakter',
          body: 'gib einem Charakter sein eigenes Banner oder seinen eigenen Avatar, oder beides. Das ersetzt deine Voreinstellung nur auf den Seiten und der Plugin-Karte dieses Charakters.',
        },
        {
          term: 'Vitrine',
          body: 'deine besten Drops, Killcounts und Zeiten, an dein Profil gepinnt: 4 Plätze für Supporter, 8 für Champion, 12 für Patron. Pins von Charakteren, die du nicht teilst, bleiben privat.',
        },
      ],
    },

    hosting: {
      title: 'Freundes-Events, Head-to-head und Chat',
      intro: 'Die Vorteile, die dir mehr Raum zum Spielen geben statt eines Looks:',
      rows: [
        {
          term: 'Freundes-Events',
          body: 'richte über **Host an event for your friends** dein eigenes Bingo, Solo-Bingo oder Rennen für Freunde aus, vom Plugin getrackt wie ein Clan-Event. Freunde treten über deinen Einladungslink bei. Supporter: 1 laufendes Event, 10 Spieler. Champion: 1 Event, 25 Spieler. Patron: 2 gleichzeitig, 50 Spieler zusammen. Beitreten kann jeder.',
        },
        {
          term: 'Head-to-head',
          body: 'fordere einen Freund über sein Profil heraus: wer zuerst einen Drop hat, oder die meisten Kills oder XP in 1 Stunde, 24 Stunden oder 7 Tagen. Nur für die Ehre. Spieler ohne Stufe können 1 gleichzeitig offen haben, Supporter 5, Champions und Patrons so viele sie wollen.',
        },
        {
          term: 'Event-Chat',
          body: 'wie lange du zwischen Zeilen wartest: 5 Sekunden ohne Stufe, 3 für Supporter, 1 für Champions, keine für Patrons. Wenn der Chat eines Boards voll wird, warten alle 10 Sekunden, Patrons auch.',
        },
        {
          term: 'Clan-Boosts',
          body: 'Champion 1, Patron 2, solange du zahlst. Siehe [Einen Clan boosten]({boostsGuide}).',
        },
      ],
    },

    billing: {
      title: 'Bezahlen, wechseln und kündigen',
      intro: 'Anvil Supporter wird über Gumroad abgerechnet, monatlich oder jährlich.',
      steps: [
        'Melde dich bei Anvil an und öffne `/supporter`.',
        'Drück **Choose Supporter**, **Choose Champion** oder **Choose Patron**. Gumroads Kasse öffnet sich, mit monatlicher oder jährlicher Abrechnung.',
        'Bezahl. Deine Vorteile schalten sich ein, sobald Gumroad es Anvil meldet, und deine Stufe erscheint auf der Supporter-Seite als **Your tier**.',
      ],
      outro:
        'Um die Stufe zu wechseln, nutz **Change tier** unter Settings → Supporter. Zum Kündigen oder um deine Karte zu ändern, nutz dort **Manage on Gumroad**. Eine gekündigte Mitgliedschaft behält jeden Vorteil bis zum Ende des bezahlten Zeitraums.',
      note: {
        tag: 'Fang immer bei /supporter an',
        body: 'Der **Choose**-Button trägt einen Code, der Anvil sagt, welcher Account bezahlt hat. Anvil ordnet eine Zahlung nie per E-Mail zu, daher bleibt ein Kauf direkt bei Gumroad, ohne diesen Button, unverknüpft. Ist dir das passiert, frag im Anvil-Discord, und das Team kann die Zahlung von Hand deinem Account zuordnen.',
      },
    },

    lapse: {
      title: 'Herabstufen oder aufhören',
      intro:
        'Nichts, was du eingestellt hast, wird gelöscht. Jeder Vorteil wird gegen die Stufe geprüft, die du gerade hast, also schaltet er sich von selbst ab und kommt zurück, sobald du verlängerst.',
      rows: [
        {
          term: 'Namensfarben',
          body: 'deine gespeicherte Wahl bleibt erhalten. Du trägst die Farben deiner neuen Stufe, oder keine, bis eine Stufe zurückkommt, die sie erlaubt.',
        },
        {
          term: 'Avatar & Banner',
          body: 'unterhalb von Champion zeigen sie ihr stehendes erstes Bild, statt sich zu bewegen.',
        },
        {
          term: 'Vitrine',
          body: 'zeigt die ersten Pins, die deine Stufe erlaubt, und blendet den Rest aus. Ohne Stufe ist sie ausgeblendet; die Pins warten auf dich.',
        },
        {
          term: 'Clan-Boosts',
          body: 'deine ältesten Boosts zählen weiter, und der Rest wird pausiert, nicht entfernt.',
        },
      ],
      note: {
        tag: 'Ein befristetes Upgrade vom Anvil-Team',
        body: 'Das Anvil-Team kann jemandem für eine Weile eine höhere Stufe geben, zum Beispiel als Dankeschön. Sie liegt über dem, was du bezahlst, und ändert nie dein Abo. Settings → Supporter zeigt **A gift from Anvil** und wann es endet; danach bist du wieder auf deiner bezahlten Stufe. Ein Geschenk gibt nur dann Clan-Boost-Plätze, wenn das Team sie mit einschließt.',
      },
    },
  },

  sidePanel: {
    metaTitle: 'Das Anvil-Seitenpanel, Tab für Tab — Anvil',
    metaDescription:
      'Was jeder Tab des Anvil-Seitenpanels in RuneLite zeigt (Clan, Feed, You, Lookup und das Zahnrad), wie Event-Chat und Feed-Reaktionen funktionieren, und die Plugin-Einstellungen für den Feed im Spielchat, Supporter-Farben und animierte Namen.',
    eyebrow: 'Anvil · für Spieler',
    title: 'Das Seitenpanel, Tab für Tab',
    dek: 'Der Anvil-Button in der Seitenleiste von RuneLite öffnet ein Panel mit vier Tabs und einem Zahnrad: **Clan**, **Feed**, **You**, **Lookup** und ⚙. Das meiste, was es zeigt, kommt von der Seite, also bleibt es ohne Plugin-Update aktuell. Ein paar Dinge unten sind als „kommt im nächsten Plugin-Update“ markiert.',
    facts: [
      { strong: 'Vier Tabs', rest: 'und ein Zahnrad für Synchronisierung und Einstellungen' },
      { strong: 'Event-Chat', rest: 'im Feed-Tab' },
      { strong: 'GZ, Sad, Sit', rest: 'auf Feed-Zeilen' },
    ],
    footnote:
      'Wie du das Plugin installierst und dich anmeldest, steht in [RuneLite-Plugin einrichten]({pluginGuide}). Supporter-Farben, der Stern und die Chat-Vorteile sind in [Anvil Supporter: Stufen und Vorteile]({supporterGuide}) erklärt.',

    header: {
      title: 'Oben im Panel',
      intro: 'Über den Tabs sitzen der Titel, **Refresh** und die Account-Zeile.',
      rows: [
        {
          term: 'Refresh',
          body: 'lädt das Panel neu, den Feed-Tab eingeschlossen. Während es arbeitet, steht dort **Refreshing…**. Im nächsten Plugin-Update lädt es auch You und Lookup neu, sodass ein neuer Avatar oder Banner sofort erscheint, und es leert den Feed-Tab nicht mehr.',
        },
        {
          term: 'Tracking',
          body: 'die Zeile unter dem Titel nennt den Charakter, der getrackt wird, in seinen Supporter-Farben, falls er welche hat. **Not my account…** beendet das Tracking eines Charakters, den jemand anderes auf diesem Computer spielt; **Track again** macht das rückgängig.',
        },
        {
          term: 'Das Account-Menü',
          body: 'der ⋯-Link öffnet **View my profile on Anvil**, **Not my account…** und **Sign out…**. Im nächsten Plugin-Update enthält es auch **Become a Supporter**, oder **Your Supporter perks**, wenn du schon einer bist.',
        },
        {
          term: 'Saisonfortschritt',
          body: 'im nächsten Plugin-Update steht auf Leagues-, Deadman- und anderen saisonalen Welten eine Zeile **Sharing season progress · Turn off**. Sie schickt deine Relikte, Gebiete und Aufgaben (mit Screenshot) an deinen Clan; dein Clan entscheidet auf der Website, was gepostet wird. **Turn on** teilt sie wieder. Derselbe Schalter ist **Share seasonal activity** in den Plugin-Einstellungen.',
        },
      ],
    },

    clan: {
      title: 'Clan',
      intro:
        'Deine Events und dein Clan. Im Space eines Creators heißt der Tab **Space**.',
      rows: [
        {
          term: 'Die Clan-Auswahl',
          body: 'erscheint, wenn du in mehr als einem Clan oder Space spielst. **All clans** (die Voreinstellung) zeigt alles, wo du mitspielst, laufende Events zuerst. Wählst du einen Clan, beschränkt sich das Panel auf ihn, und deine Einsendungen gehen dorthin.',
        },
        {
          term: 'Events',
          body: 'jedes laufende und kommende Board, Skill oder Boss of the Week und Clan-Event, mit deiner Platzierung. Danach **Your other boards**, **Also live** und **Your clan**.',
        },
        {
          term: 'Ein Board',
          body: 'öffne eins für Rangliste, Teams, Missionen, letzte Aktivität, die nächstgelegenen Felder und **View all tiles**. Seine Buttons **Feed** und **Chat** öffnen dieses Board im Feed-Tab.',
        },
        {
          term: 'Ein Clan-Event',
          body: '**I’m going**, **Sign me up** oder **Answer the survey**, je nach Event.',
        },
      ],
    },

    feed: {
      title: 'Feed',
      intro:
        'Die großen Momente deines Clans und deiner Boards, live: Drops, Pets, Erfolge, Quests, Tode und fertige Felder.',
      rows: [
        {
          term: 'Wessen Feed',
          body: 'die Auswahl oben listet **Clan ·** für jeden Clan, in dem du Mitglied bist, und **Event ·** für jedes laufende Board, auf dem du bist. Sie öffnet auf deinem Board, wenn du eins hast, sonst auf deinem Clan.',
        },
        {
          term: 'Filter',
          body: '**All**, **Tiles** (nur Boards), **Drops**, **Pets**, **Achievements**, **Deaths** und **My team** auf einem Board, auf dem du in einem Team bist. Ein Clan-Feed hat außerdem einen Button für Spielmodus-Aktivität, für Leagues und andere Modi.',
        },
        {
          term: 'Neue Zeilen',
          body: 'kommen von selbst. Wenn du weggescrollt hast, bringt dich eine **↑ N new**-Pille zu ihnen zurück.',
        },
      ],
      note: {
        tag: 'Nicht dasselbe wie der Chat-Feed im Spiel',
        body: 'Der Feed-Tab funktioniert, egal was in deinen Plugin-Einstellungen steht. **Show feed in game chat** (Schritt 8) ist die separate Einstellung, die ihn zusätzlich in deiner Chatbox ausgibt.',
      },
    },

    reactions: {
      title: 'Reaktionen',
      intro: 'Jede Zeile im Feed hat ihre Reaktion darunter:',
      rows: [
        {
          term: 'GZ',
          body: 'auf Drops, Pets und Erfolgen. Die Zahl steht daneben, etwa **GZ 3**.',
        },
        {
          term: 'Sad und Sit',
          body: 'auf Toden, statt GZ. „Sit“ ist die Art des Spiels, jemandem, der gestorben ist, zu sagen, er soll sich hinsetzen.',
        },
        {
          term: 'Wer reagieren kann',
          body: 'in einem Clan-Feed die Clankameraden. Auf einem Board die Spieler darauf und das Team des Ausrichters; wenn ein Board seine Rangliste verbirgt, können Spieler nur auf die Zeilen ihres eigenen Teams reagieren.',
        },
        {
          term: 'Wer reagiert hat',
          body: 'fahr mit der Maus über eine Reaktion, um Namen zu sehen, etwa „GZ · Mossy and 3 others“. Klick sie erneut, um deine zurückzunehmen.',
        },
      ],
      note: {
        tag: 'Im nächsten Plugin-Update',
        body: 'Reaktionen werden zu Pillen-Buttons, eingefärbt, wenn eine von dir ist, und die Reaktionen anderer aktualisieren sich live für alle, die zuschauen, auch auf deinen anderen offenen Clients. Heute ändert sich die Zahl, wenn du reagierst oder der Feed neu lädt. Goldenes GZ, die Supporter-Reaktion, wird in den Feeds der Website vergeben; der Feed-Tab hat GZ, Sad und Sit.',
      },
    },

    chat: {
      title: 'Event-Chat',
      intro:
        'Ein Board mit eingeschaltetem Chat hat oben im Feed-Tab einen Schalter **Feed / Chat**, für die Spieler auf diesem Board und das Team des Ausrichters. Die Board-Seite im Clan-Tab hat auch einen **Chat**-Button.',
      rows: [
        {
          term: 'Alle oder dein Team',
          body: '**All** schreibt an das ganze Board, **My team** nur an dein Team (diese Zeilen sind mit **TEAM** markiert). Ausrichter und Mods sehen außerdem **Host & mods**, und ihre Zeilen sind mit **HOST** oder **MOD** markiert.',
        },
        {
          term: 'Senden',
          body: 'tipp in das Feld und drück Enter. Zeilen haben bis zu 200 Zeichen, und nur der Ausrichter und die Mods können Links posten.',
        },
        {
          term: 'Wie oft',
          body: 'die Wartezeit zwischen deinen Zeilen richtet sich nach deiner Supporter-Stufe: 5 Sekunden ohne Stufe, 3 für Supporter, 1 für Champions, keine für Patrons. Die Zeile unter dem Feld sagt, welche deine ist. Ausrichter und Mods warten nie.',
        },
        {
          term: 'Slow Mode',
          body: 'wenn der Chat eines Boards sehr voll wird, warten alle eine Minute lang mindestens 10 Sekunden, Patrons eingeschlossen. Niemand kann mehr als 10 Zeilen in 10 Sekunden senden.',
        },
        {
          term: 'Moderation',
          body: 'der Ausrichter und die Mods können per Rechtsklick auf eine Zeile **Delete message** oder jemanden mit **Mute** stummschalten, und den ganzen Chat mit **Pause chat** anhalten.',
        },
      ],
      outro:
        'Mehrere Zeilen hintereinander von einer Person teilen sich einen Namen und eine Uhrzeit, bis eine Lücke von 5 Minuten kommt. Der Chat wird nach Eventende 7 Tage lang aufbewahrt.',
    },

    you: {
      title: 'You und Lookup',
      intro: 'Zwei Tabs für Spielerkarten: deine und die von allen anderen.',
      rows: [
        {
          term: 'You',
          body: 'deine eigene Karte für den Charakter, mit dem du eingeloggt bist: Banner und Avatar, **Display case**, Collection Log bis hinunter zu den Items jeder Seite, und **Skills**, **Bosses**, **Clues**, **Times** und **CAs**. Darunter jede **Head-to-head**-Herausforderung, die auf dich wartet (**Accept** oder **Decline**), und deine **Goals**, mit **+ Add goal**.',
        },
        {
          term: 'Lookup',
          body: 'wechsle zwischen **Players** und **Clans**, tipp einen Namen ein und drück Enter. **Recent** listet deine letzten paar. Klick im Spiel mit rechts auf jemanden und wähl **Anvil**, um hier zu landen.',
        },
        {
          term: 'Vergleichen',
          body: 'auf der Karte eines anderen stellt **Compare with me** euch beide nebeneinander, Skill für Skill, Boss für Boss und Seite für Seite. Die Karte eines Clans hat **Compare with my clan**.',
        },
      ],
    },

    gear: {
      title: 'Der Zahnrad-Tab',
      intro: 'Synchronisierung und Einstellungen statt Dingen zum Anschauen:',
      rows: [
        {
          term: 'Sync profile',
          body: 'schickt dein Collection Log und deine Bestzeiten an Anvil.',
        },
        {
          term: 'Sync clan roster',
          body: 'nur Clan-Admins: schickt die Mitgliederliste des Clans aus dem Spiel an die Seite. Kann das Plugin deinen Clan nicht lesen, steht dort stattdessen **Join your clan channel to sync the roster**.',
        },
        {
          term: 'Banner sounds',
          body: '**Add clip** für den Sound, den ein Banner spielt, **Copy folder path**, um sie zu verwalten, und **Add mission clip** für Missionen.',
        },
        {
          term: 'Become a Supporter',
          body: 'im nächsten Plugin-Update öffnet ein ★-Link ganz unten die Supporter-Seite, oder dort steht **Your Supporter perks**, wenn du schon einer bist.',
        },
      ],
    },

    settings: {
      title: 'Einstellungen, die ändern, was du siehst',
      intro:
        'In der RuneLite-Konfiguration für Anvil, unter **Chat messages**. Am Anfang sind alle eingeschaltet.',
      rows: [
        {
          term: 'Show feed in game chat',
          body: 'gibt den Feed zusätzlich in deiner Chatbox aus, sobald etwas passiert: große Drops, Pets und Erfolge von Boards, deren Ausrichter es eingeschaltet hat, und von Clans, in denen du Gast bist, der Feldfortschritt deiner Teamkameraden und fertige Felder anderer Teams.',
        },
        {
          term: 'Supporter names in chat',
          body: 'die Farben von Supportern (und der Stern eines Patrons) im öffentlichen, Clan-, Freundes- und privaten Chat sowie in deiner Freundesliste und den Mitgliederlisten von Channels. Die Namensliste wird von Anvil heruntergeladen; darüber, wen du siehst, wird nichts gesendet.',
        },
        {
          term: 'Animated names',
          body: 'lässt den Verlauf eines Patrons im Panel, im Feed und im Event-Chat gleiten. Aus hält ihn still. Im nächsten Plugin-Update gilt es auch für geboostete Clannamen und animierte Banner im Panel.',
        },
        {
          term: 'Supporter names in menus',
          body: 'die Farben von Supportern auf ihrem Namen, wenn du sie mit rechts anklickst, nie auf PvP-Welten oder in der Wilderness.',
        },
        {
          term: 'Over other plugins’ colours',
          body: 'an, ersetzen die Farben eines Supporters eine Namensfarbe, die ein anderes Plugin gesetzt hat, etwa Player Indicators. Aus lässt diese Namen in Ruhe.',
        },
      ],
    },
  },

  clanBoosts: {
    metaTitle: 'Einen Clan boosten — Anvil',
    metaDescription:
      'Wie Anvils Clan-Boosts funktionieren: wer sie hat, einen Boost setzen und verschieben, die drei Boost-Stufen und was jede freischaltet, die Namensfarben des Clans, geschenkte Boosts, und Booster-Zeichen und Abzeichen.',
    eyebrow: 'Anvil · für Supporter und das Clan-Team',
    title: 'Einen Clan boosten',
    dek: 'Ein zahlender Champion oder Patron kann einen Boost auf einen Clan setzen, in dem er Mitglied ist. Genug Boosts von den Mitgliedern eines Clans heben ihn eine Stufe höher, und jede Stufe ändert, wie der Clan aussieht und wo er gelistet wird. Boosts sind nur Optik: Sie ändern nie einen Rang, eine Wertung, einen Sitz oder den Tarif des Clans.',
    facts: [
      { strong: 'Champion 1, Patron 2', rest: 'Boosts, solange du zahlst' },
      { strong: 'Stufen bei 3, 8 und 15', rest: 'gezählten Boosts' },
      { strong: 'Einmal pro Woche', rest: 'kann ein Boost umziehen' },
    ],
    footnote:
      'Mitglieder setzen Boosts unter **Settings** → **Clan boosts**. Das Clan-Team sieht die Stufe und ihre Optionen unter Admin → **Clan settings** → **Boosts**. Zu den Supporter-Stufen selbst siehe [Anvil Supporter: Stufen und Vorteile]({supporterGuide}).',

    what: {
      title: 'Wer Boosts hat',
      intro: 'Boosts kommen mit einer bezahlten Mitgliedschaft:',
      rows: [
        { term: 'Champion', body: '1 Boost.' },
        { term: 'Patron', body: '2 Boosts.' },
        {
          term: 'Supporter',
          body: 'keine. Durch Einladungen verdiente Zeit ebenso wenig. Ein befristetes Upgrade vom Anvil-Team gibt nur dann Plätze, wenn das Team sie mit einschließt.',
        },
      ],
      outro:
        'Boosts gehören dir, nicht einem Charakter: Drei Charaktere in drei Clans teilen sich trotzdem einen Satz. **Settings** → **Clan boosts** erscheint in deinen Einstellungen nur, solange du Supporter bist oder noch einen Boost gesetzt hast.',
    },

    place: {
      title: 'Einen Boost setzen und verschieben',
      intro: 'Du setzt deine Boosts selbst; niemand kann einen für dich setzen.',
      steps: [
        'Öffne **Settings** → **Clan boosts**. **Your boosts** listet, was du gesetzt hast, und jeden **Free slot**.',
        'Drück unter **Clans you can boost** neben einem Clan auf **Boost**. Du kannst auch im Boosters-Bereich auf der Seite des Clans selbst **Boost this clan** drücken.',
        'Um einen zu verschieben, nutz **Move to…** in seiner Zeile und wähl einen anderen Clan. **Remove** nimmt ihn weg.',
      ],
      rows: [
        {
          term: 'Ein Mitglieds-Sitz, 14 Tage alt',
          body: 'jeder Boost hängt an einem Mitglieds-Sitz, den einer deiner Charaktere im Clan im Spiel hat. Ein Gast-Sitz kann keinen tragen. Der Sitz zählt ab dem früheren von zwei Zeitpunkten: als Anvil ihn zuerst gesehen hat, oder als der Charakter laut Spiel beigetreten ist. Bis dahin sagt die Zeile des Clans, wie viele Tage noch fehlen.',
        },
        {
          term: 'Eine Zeile pro Clan',
          body: 'die Liste zeigt jeden Clan einmal, und Anvil wählt den Charakter, an dem der Boost hängt: wo möglich deinen Main, sonst den am längsten gehaltenen Sitz. Der Clan sieht nur diesen Charakter, nie deine anderen.',
        },
        {
          term: 'Einmal pro Woche',
          body: 'ein gesetzter Boost kann 7 Tage nach dem Setzen umziehen. Der Platz eines entfernten Boosts wird am selben Datum wieder frei, also ist Entfernen und neu Setzen keine Abkürzung. Hat der Charakter, an dem er hing, den Clan verlassen, kannst du ihn sofort verschieben.',
        },
      ],
      note: {
        tag: 'Was die Markierungen bedeuten',
        body: '**counting**: Er zählt für die Stufe des Clans. **paused**: Deine Supporter-Stufe hat jetzt weniger Plätze, als du gesetzt hast, also zählen deine ältesten Boosts weiter, und der Rest wartet. **seat gone**: Der Charakter, an dem er hing, ist dort kein Mitglied mehr; verschieb ihn. **over the 2-per-person cap**: Der Clan zählt schon zwei von deinen.',
      },
    },

    levels: {
      title: 'Stufen',
      intro:
        'Die Stufe eines Clans ergibt sich aus seinen gezählten Boosts. Von einer einzelnen Person zählen höchstens zwei Boosts für einen Clan, also bedeutet eine Stufe immer, dass sich mehrere Mitglieder dafür entschieden haben.',
      rows: [
        { term: 'Stufe 1', body: '3 gezählte Boosts.' },
        { term: 'Stufe 2', body: '8 gezählte Boosts.' },
        { term: 'Stufe 3', body: '15 gezählte Boosts.' },
      ],
      outro:
        'Mitglieder sehen den Fortschritt auf der Seite des Clans, zum Beispiel „5 of 8 to Level 2“. Ein Clan, der aufsteigt, bekommt die neue Stufe sofort.',
      note: {
        tag: 'Eine Woche Schonfrist',
        body: 'Fallen die Boosts unter eine Stufe, behält der Clan deren Vorteile 7 Tage lang. Admin → Clan settings → Boosts zeigt, wann sie enden. Boosten die Mitglieder ihn rechtzeitig wieder hoch, ändert sich nichts.',
      },
    },

    perks: {
      title: 'Was jede Stufe freischaltet',
      intro: 'Jede Stufe behält alles von der darunter.',
      rows: [
        {
          term: 'Stufe 1',
          body: 'ein **Boosted**-Abzeichen auf der Clanseite, auf seiner Clan-Hall-Karte und in der Suche; ein Platz über Clans ohne Boost in der Clan Hall und ihren Suchergebnissen; und der Clanname im Farbverlauf.',
        },
        {
          term: 'Stufe 2',
          body: 'ein Platz in der **Featured**-Reihe der Clan Hall; das animierte Banner des Clans spielt ab (unter Stufe 2 zeigt es sein stehendes Bild); eine Werbezeile für Besucher; und der Verlauf des Namens bewegt sich.',
        },
        {
          term: 'Stufe 3',
          body: 'das **Spotlight** ganz oben in der Clan Hall und ein Rekrutierungspost pro Monat im Anvil-Discord, vom Clan selbst geschrieben.',
        },
      ],
      note: {
        tag: 'Das Clan-Logo ist kein Vorteil',
        body: 'Ein animiertes Logo (ein GIF- oder WebP-Clanbild) spielt auf jeder Stufe. Nur das Banner wartet auf Stufe 2.',
      },
    },

    colours: {
      title: 'Die Namensfarben des Clans',
      intro:
        'Ab Stufe 1 trägt der Name des Clans Anvils Farbverlauf. Eigentümer und Admins können eigene wählen, unter Admin → **Clan settings** → **Boosts** → **Clan name colours**:',
      rows: [
        {
          term: 'Eine bis vier Farben',
          body: 'eine Farbe ergibt einen statischen Namen; zwei bis vier ergeben einen Verlauf. Ab Stufe 2 bewegt sich ein Verlauf.',
        },
        {
          term: 'Dunkle und helle Hintergründe',
          body: 'wie bei Supporter-Namen passt Anvil die Farben an, damit sie auf dunklen Hintergründen (die Seite, das Plugin-Panel, Discord) und hellen (die feste Chatbox des Spiels) lesbar bleiben. Schalte für einen davon einen eigenen Look ein, und er wird genau so gezeigt, wie gewählt.',
        },
        {
          term: 'Reset to Anvil',
          body: 'geht zurück zu Anvils Palette.',
        },
      ],
      outro:
        'Die Farben bleiben gespeichert, wenn der Clan unter Stufe 1 fällt, und kommen zurück, wenn er sie wieder erreicht. Das Plugin übernimmt eine Änderung beim nächsten Neuladen.',
    },

    staff: {
      title: 'Für das Clan-Team',
      intro:
        'Admin → **Clan settings** → **Boosts** ist für Eigentümer und Admins. Das Team kann keine Boosts für Mitglieder setzen; Mitglieder setzen ihre eigenen.',
      rows: [
        {
          term: 'Die Stufe',
          body: 'die Stufe des Clans, wie viele Boosts zählen, wie viele bis zur nächsten Stufe fehlen, und eine etwaige Schonwoche.',
        },
        {
          term: 'Recruiting line',
          body: 'Stufe 2. Ein Satz, bis zu 140 Zeichen, den Leute außerhalb des Clans auf eurer Clanseite und Clan-Hall-Karte sehen.',
        },
        {
          term: 'Recruitment post in the Anvil Discord',
          body: 'Stufe 3. Einmal pro Kalendermonat, 20 bis 500 Zeichen, von dir geschrieben und gepostet, wenn du **Post it** drückst, mit einem Link zu eurer Clanseite. Erwähnungen werden entfernt, und niemand wird gepingt. Bis zum nächsten Monat kannst du ihn weder bearbeiten noch einen weiteren senden.',
        },
        {
          term: 'Boosters',
          body: 'die Liste der Charaktere, die den Clan boosten.',
        },
      ],
      note: {
        tag: 'Geschenkte Boosts von Anvil',
        body: 'Das Anvil-Team kann einem Clan eine Stufe schenken, befristet oder ohne Ende. Das Geschenk fügt nur die Boosts hinzu, die dem Clan bis zu dieser Stufe fehlen, angezeigt als **Anvil gift** in der Boosters-Liste des Clans. Jeder echte Boost eines Mitglieds ersetzt einen geschenkten, und ein Clan, der schon über der geschenkten Stufe liegt, behält seine eigene. Endet das Geschenk, fällt der Clan auf die Stufe zurück, die ihm die Boosts seiner Mitglieder geben.',
      },
    },

    boosters: {
      title: 'Booster-Zeichen und Abzeichen',
      intro: 'Was ein Booster in dem Clan bekommt, den er boostet:',
      rows: [
        {
          term: 'Das Booster-Zeichen',
          body: 'ein kleiner Edelstein neben seinem Charakter in der Mitgliederliste, im Feed und in den Discord-Posts dieses Clans. Fahr mit der Maus darüber für „Boosts this clan“.',
        },
        {
          term: 'Die Booster-Wand',
          body: 'auf der Clanseite: eine Zeile pro Charakter, die meisten Boosts zuerst, dann die am längsten dabei sind.',
        },
        {
          term: 'Abzeichen',
          body: '**First booster** für den, der den allerersten Boost des Clans gesetzt hat; **1 month**, **3 months**, **6 months** und **1 year** Boosten ohne Unterbrechung; und **Level-up 1**, **2** oder **3** für den Boost, der den Clan auf diese Stufe gehoben hat.',
        },
      ],
      note: {
        tag: 'Verschieben startet die Uhr neu',
        body: 'Zeit-Abzeichen zählen ab dem frühesten Boost des Charakters, der noch zählt, also setzt Verschieben oder Entfernen eines Boosts sie zurück. Dein Profil listet die Clans, die du boostest, einmal pro Clan.',
      },
    },
  },
};

export default de;
