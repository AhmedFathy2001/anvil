import type { PartialGuideDict } from './en';

// Italiano — Italian.
//
// Stessa convenzione degli altri file di lingua: resta in inglese ciò che il lettore vede davvero
// sullo schermo di Anvil, RuneLite e OBS —— i menu di RuneLite e OBS, le righe di chat che il plugin
// stampa da sé e le etichette del pannello di amministrazione di Anvil (in inglese finché quelle
// schermate non saranno tradotte). Tradurre “Tracked drop detected” significa che chi cerca quella
// riga non la trova più.
// Le etichette dell’interfaccia di Discord (menu, impostazioni, nomi dei permessi: “Copia ID server”,
// “Impostazioni server → Ruoli”, “Gestisci webhook”) seguono invece la traduzione italiana di Discord
// stesso —— ciò che mostra il client del lettore —— e resterebbero in inglese dove Discord non è tradotto.
// Tutto il resto —— le spiegazioni, l’ordine, il perché —— è in italiano.

const it: PartialGuideDict = {
  common: {
    contents: 'Indice',
    step: 'Passo',
    optional: 'facoltativo',
    minRead: '{n} min di lettura',
    copyLink: 'Copia un link a questa sezione',
    linkCopied: 'Link copiato',
    language: 'Lingua',
    partialNotice:
      'Questa guida è tradotta in {language} solo in parte. Ciò che non è ancora tradotto resta in inglese.',
    backToGuides: 'Tutte le guide',
    unreviewedNotice:
      'Questa traduzione in {language} non è ancora stata riletta da un madrelingua. Se una frase suona sbagliata, la [pagina in inglese]({englishHref}) è l’originale —— e [segnalarcelo](/feedback) è ciò che la fa correggere.',
    support: {
      lead: 'Bloccato, o qualcosa non torna?',
      link: 'Chiedi nel Discord di supporto di Anvil',
    },
    legalPaid: 'Domande sui pagamenti: [Rimborsi](/legal/refunds) e [Termini](/legal/terms).',
    legalPrivacy: 'Come vengono trattati i tuoi dati: [Informativa sulla privacy](/legal/privacy).',
    aboutLine: 'Chi c\'è dietro Anvil? Leggi [About](/about).',
  },

  index: {
    metaTitle: 'Guide — Anvil',
    metaDescription:
      'Guide di configurazione per Anvil: il plugin RuneLite per i giocatori, come organizzare un evento per lo staff del clan e come ospitare un clan in visita.',
    title: 'Guide',
    dek: 'Tutto quello che serve per partire, scritto per la versione di Anvil che gira proprio qui.',
    groups: {
      playing: 'Giocare',
      running: 'Organizzare un evento',
      clan: 'Gestire il clan',
      streamers: 'Streamers',
    },
    anvilTab: 'Usare Anvil',
    ingame: {
      title: 'Guide di gioco',
      dek: 'Raid, boss, skilling e guadagni dalla libreria di Anvil — le stesse guide che il plugin mostra in gioco e che il bot pubblica su Discord.',
      browse: 'Sfoglia tutte le guide',
      language: 'Queste guide non sono tradotte: appaiono come sono state scritte, qualunque sia la lingua di questa pagina.',
      empty: 'La libreria di Anvil non ha ancora guide pubblicate. Torna presto.',
      placeholder: 'Cerca nelle guide di gioco — prova "zulrah", "raids" o "money"',
      readTime: '{n} min di lettura',
      metaTitle: 'Guide di gioco OSRS — Anvil',
      metaDescription: 'Guide su raid, boss, skilling e guadagni dalla libreria di Anvil, da leggere sul sito, in gioco con il plugin RuneLite e su Discord.',
    },
    search: {
      placeholder: 'Cerca nelle guide — prova "webhook", "caselle" o "i drop non compaiono"',
      results: '{n} guide',
      empty: 'Nessun risultato. Prova una parola più semplice — "caselle", "pagamento", "bot" — o sfoglia l\'elenco qui sotto.',
      clear: 'Cancella la ricerca',
    },
    cards: {
      tiles: {
        eyebrow: 'Per i giocatori',
        title: 'Regole e limiti delle caselle',
        blurb: 'Cosa ti chiede una casella prima di iniziare (un’impostazione di gioco, il plugin, un registro sincronizzato, una posizione negli hiscores) e cosa non riesce a tracciare.',
        minutes: '~4 min',
      },
      discord: {
        eyebrow: 'Per chi gestisce il server',
        title: 'Anvil in Discord',
        blurb: 'Un invito, poi i canali in cui pubblica ogni feed, i ruoli, i comandi slash, e cosa controllare quando si ferma.',
        minutes: '~5 min',
      },
      switching: {
        eyebrow: 'Passare ad Anvil',
        title: 'Passare da altri plugin e tracker ad Anvil',
        blurb:
          'Anvil pubblica i tuoi drop su Discord e gestisce le vostre competizioni settimanali. Cinque passaggi per lo staff, due per i giocatori.',
        minutes: '~3 min',
      },
      clan: {
        eyebrow: 'Per chi ne avvia uno',
        title: 'Creare un clan',
        blurb: 'Due nomi e un indirizzo, ed è online. Poi Discord, la lista membri e la prima board.',
        minutes: '~4 min, gratis',
      },
      plugin: {
        eyebrow: 'Per i giocatori',
        title: 'Configurare il plugin RuneLite',
        blurb:
          'Installa il plugin, accedi dal suo pannello laterale e lascia che invii i tuoi drop. Copre anche le notifiche Discord e la ricerca dei giocatori.',
        minutes: '~3 min di setup',
      },
      admin: {
        eyebrow: 'Per lo staff del clan',
        title: 'Organizzare il primo evento',
        blurb:
          'Discord, sincronizzazione del roster, tabelloni, caselle, squadre e draft, avvio, e cosa fare quando l’evento finisce.',
        minutes: 'una serata, una volta sola',
      },
      board: {
        eyebrow: 'Per chi costruisce i tabelloni',
        title: 'Costruire un tabellone che si registra da solo',
        blurb:
          'Cosa vede davvero ogni tipo di casella, come scriverne duecento con un foglio di calcolo, e gli errori che si importano perfettamente e poi non scattano mai.',
        minutes: '~8 min',
      },
      captain: {
        eyebrow: 'Per i capitani',
        title: 'Guida del capitano',
        blurb:
          'Leggere il pool prima che parta il cronometro, il giorno del draft, e le parti della gestione di una squadra che iniziano dopo.',
        minutes: '~6 min',
      },
      formats: {
        eyebrow: 'Per lo staff del clan',
        title: 'Formati, e come si aprono le caselle',
        blurb:
          'Sette forme di tabellone, cinque modi in cui una casella diventa giocabile, e i tre modificatori che decidono quanto vale un completamento.',
        minutes: '~5 min',
      },
      fees: {
        eyebrow: 'Per i tesorieri',
        title: 'Quote e premi',
        blurb:
          'Fissare una quota d’iscrizione, incassarla, la seconda firma che la chiude, e trasformare un montepremi in pagamenti effettivi.',
        minutes: '~5 min',
      },
      coffer: {
        eyebrow: 'Per i tesorieri',
        title: 'La cassa del clan',
        blurb:
          'Una sola cassa per i gp del clan: cosa ci entra, i tre modi in cui paga i premi, e chi può toccarla.',
        minutes: '~5 min',
      },
      moderator: {
        eyebrow: 'Per i moderatori',
        title: 'Di turno',
        blurb:
          'La coda, la verifica di prove e account, tenere il roster onesto, e le decisioni che arrivano a una persona.',
        minutes: '~5 min',
      },
      clanVsClan: {
        eyebrow: 'Per chi ospita',
        title: 'Ospitare un clan in visita',
        blurb:
          'Clan contro clan senza raccogliere un solo RSN a mano: un link d’invito per squadra, e un posto che permette al loro moderatore di gestire la propria metà.',
        minutes: '~5 min per squadra',
      },
      commands: {
        eyebrow: 'Per tutti i membri',
        title: 'Comandi slash',
        blurb:
          'Ogni comando a cui il bot risponde in Discord, cosa fa ciascuna opzione, esempi pratici, e cosa controllare quando uno non compare.',
        minutes: '~6 min',
      },
      creators: {
        eyebrow: 'Per gli streamer',
        title: 'Organizzare eventi per i tuoi spettatori',
        blurb:
          'Non serve un clan. Crea uno spazio, condividi un solo link, scegli chi può unirsi (follower, iscritti, ruoli Discord) e porta il tabellone in streaming.',
        minutes: '~6 min',
      },
      joiningStream: {
        eyebrow: 'Per gli spettatori',
        title: 'Unirsi all’evento di uno streamer',
        blurb:
          'Hai ricevuto un link da uno stream? Accedi, aggiungi il tuo personaggio, premi Join. Cosa fare per gli eventi riservati a follower o iscritti.',
        minutes: '~2 min',
      },
      streamingClans: {
        eyebrow: 'Per i clan che fanno streaming',
        title: 'Streaming per i clan',
        blurb:
          'Lascia che i tuoi spettatori giochino un evento senza entrare nel clan. Attiva Streaming, poi apri un evento agli spettatori.',
        minutes: '~2 min',
      },
      people: {
        eyebrow: 'Per lo staff del clan',
        title: 'La tua gente: roster, ospiti e chi può entrare',
        blurb:
          'Da dove arrivano i membri, cosa significano i filtri della scheda Roster, le richieste di adesione e Needs review, le tre impostazioni di Who can join, e come rimuovere o bannare qualcuno.',
        minutes: '~6 min',
      },
      staffRoles: {
        eyebrow: 'Per proprietari e admin',
        title: 'Ruoli dello staff: chi può fare cosa',
        blurb:
          'Proprietario, admin, tesoriere e moderatore: cosa raggiunge ciascuno, come nominare un moderatore, chi può assegnare quale ruolo, e gli incarichi che valgono per un solo evento.',
        minutes: '~6 min',
      },
      supporter: {
        eyebrow: 'Per i giocatori',
        title: 'Anvil Supporter: fasce e vantaggi',
        blurb:
          'Supporter, Champion e Patron: colori del nome, la stella, immagini del profilo, la vetrina, eventi tra amici e boost del clan, come funziona il pagamento e cosa succede se smetti.',
        minutes: '~6 min',
      },
      sidePanel: {
        eyebrow: 'Per i giocatori',
        title: 'Il pannello laterale, scheda per scheda',
        blurb:
          'Clan, Feed, You, Lookup e l’ingranaggio: cosa mostra ogni scheda, la chat dell’evento, le reazioni GZ e Sad, e le impostazioni che portano il feed e i colori Supporter nel tuo gioco.',
        minutes: '~6 min',
      },
      clanBoosts: {
        eyebrow: 'Per i Supporter e lo staff del clan',
        title: 'Potenziare un clan con i boost',
        blurb:
          'Piazzare e spostare un boost, i tre livelli e cosa sblocca ciascuno, i colori del nome del clan, i boost regalati, e i segni e i badge dei booster.',
        minutes: '~5 min',
      },
      profile: {
        eyebrow: 'Per i giocatori',
        title: 'Il tuo profilo, Wrapped e Compare',
        blurb: 'Il tuo profilo, la pagina pubblica di ogni personaggio e la tua pagina personale, chi può vederle, le schede Wrapped mensili e per evento, e il confronto tra due personaggi.',
        minutes: '~4 min',
      },
      settings: {
        eyebrow: 'Per i giocatori',
        title: 'Impostazioni, pagina per pagina',
        blurb: 'Post su Discord e privacy degli screenshot, il feed della chat in gioco, dispositivi, i tuoi webhook, chi vede i tuoi personaggi, ogni personaggio e le rivendicazioni di proprietà.',
        minutes: '~6 min',
      },
      challenges: {
        eyebrow: 'Per i giocatori',
        title: 'Sfide ed eventi per amici',
        blurb: 'Sfida un giocatore in una gara di drop, uccisioni o XP, e ospita un tabellone privato per i tuoi amici dietro un unico link di invito.',
        minutes: '~4 min',
      },
      clanHall: {
        eyebrow: 'Per i giocatori e i clan',
        title: 'Trovare clan, eventi e classifiche',
        blurb: 'La Clan Hall, il confronto tra due clan, la classifica settimanale, la lista pubblica degli eventi e le pagine dei clan in gioco che non sono su Anvil.',
        minutes: '~3 min',
      },
      guideLibrary: {
        eyebrow: 'Per i giocatori e lo staff del clan',
        title: 'Guide in gioco',
        blurb: 'Leggere la libreria di guide per livello, proporre una nuova guida o una modifica, e tenere le copie del tuo clan.',
        minutes: '~3 min',
      },
      weekly: {
        eyebrow: 'Per lo staff del clan e i giocatori',
        title: 'Skill e Boss of the Week',
        blurb: 'Programmare una competizione settimanale, ripeterla e ruotarla, le partenze, i premi, terminarla in anticipo e cosa vedono i giocatori.',
        minutes: '~4 min',
      },
      teamComps: {
        "eyebrow": "Per lo staff del clan e i giocatori",
        "title": "Competizioni a squadre",
        "blurb": "Competizioni di skill e boss a squadre o clan contro clan: come impostarle, come invitare altri clan, come funzionano totali e medie e cosa vedono i giocatori.",
        "minutes": "~4 min"
      },
      clanEvents: {
        eyebrow: 'Per lo staff del clan',
        title: 'Eventi del clan e calendario',
        blurb: 'Mass, serate di raid e ritrovi: ripetizioni settimanali, “I’m going” e iscrizioni, promemoria su Discord, pagamenti, sondaggi e ricerca dei buchi nel calendario.',
        minutes: '~4 min',
      },
      luckRecords: {
        eyebrow: 'Per i giocatori',
        title: 'Probabilità, fortuna e record',
        blurb:
          'Cosa significano le probabilità di un riquadro drop, come viene calcolata la fortuna e dove compaiono il tuo giorno, la settimana, il mese e l\'anno migliori.',
        minutes: '~3 min',
      },
    },
  },

  switching: {
    metaTitle: 'Passare da altri plugin e tracker ad Anvil — Anvil',
    metaDescription:
      'Porta il tuo clan su Anvil: imposta i canali Discord, sincronizza l’elenco del clan, avvia uno Skill o Boss of the Week e avvisa i tuoi membri.',
    eyebrow: 'Passare ad Anvil',
    title: 'Passare da altri plugin e tracker ad Anvil',
    dek: 'Anvil pubblica su Discord i drop e i traguardi del tuo clan. Gestisce anche l’elenco del clan e organizza le competizioni settimanali.',

    staff: {
      title: 'Se gestisci il clan',
      body: [
        '**Lascia che sia il bot a impostare i tuoi canali.** Vai su Admin → Discord → **Set it up for me**. Scegli un canale o più. Se un altro plugin pubblicava da qualche parte, spunta _Use the same channels_. Per i tuoi membri non cambia niente.',
        '**Sincronizza l’elenco del clan.** In RuneLite, apri le impostazioni del plugin di Anvil. Attiva **Keep the clan roster in sync**. Un admin lo fa una sola volta, in gioco. Questo sostituisce qualsiasi elenco del clan tenuto altrove.',
        '**Avvia uno Skill o Boss of the Week.** Vai su Admin → All events → **+ New event** e scegli Skill of the Week o Boss of the Week. Tutti quelli nell’elenco del clan partecipano in automatico. Questo sostituisce le competizioni organizzate altrove.',
        '**Avvisa i tuoi membri.** Vai su Admin → Discord → **Tell your members** → **Post it**. Il bot pubblica i passaggi per i giocatori al posto tuo.',
        '**Una settimana dopo, fai pulizia.** Vai su Admin → Discord → **Remove old webhooks from other plugins**, spunta quelli da eliminare, premi **Remove … webhooks** e poi **Yes, remove them**. Dopo, niente può essere pubblicato due volte. Premi **Keep** su quelli che vuoi lasciare stare.',
      ],
    },

    player: {
      title: 'Se sei un giocatore',
      body: [
        '**Installa Anvil.** In RuneLite, apri il Plugin Hub, cerca Anvil e premi **Install**. Poi accedi con Discord dal pannello laterale di Anvil.',
        '**Disattiva le notifiche del tuo vecchio plugin** così non si pubblica due volte. Oppure disinstallalo, se non lo usi per nient’altro.',
        '**Tutto qui.** Non c’è altro da configurare.',
      ],
    },

    questions: {
      title: 'Domande',
      intro: 'Quelle che i clan fanno più spesso:',
      rows: [
        {
          term: 'Anvil tiene traccia di kill count, task slayer e record personali?',
          body: 'Sì. Anvil tiene traccia da sé di kill count, task slayer e record personali, quindi non c’è nient’altro da tenere in esecuzione.',
        },
        {
          term: 'I giocatori devono incollare un webhook da qualche parte?',
          body: 'No. Il clan imposta i canali sul sito.',
        },
        {
          term: 'Vuoi i post anche sul tuo server?',
          body: 'Vai al tuo profilo → **Announcements & webhooks** → _Your own webhooks_.',
        },
      ],
    },
  },

  clan: {
    metaTitle: 'Creare un clan — Anvil',
    metaDescription: 'Crea un clan su Anvil: dagli un nome, scegli l’indirizzo, collega Discord, sincronizza la lista membri e avvia il primo evento.',
    eyebrow: 'Anvil · iniziare',
    title: 'Creare un clan',
    dek: 'Due nomi e un indirizzo, e il tuo clan è online — gratis, e non c’è niente da aspettare. Questo è quello, più le quattro cose che vale la pena fare subito dopo.',
    facts: [
      {
        strong: 'Gratis',
        rest: 'nessuna carta, nessuna prova',
      },
      {
        strong: 'Online',
        rest: 'nel momento in cui invii',
      },
      {
        strong: '~4 min',
        rest: 'fino a un clan funzionante',
      },
    ],
    footnote: 'Puoi cambiare tutto questo più tardi da Admin → **Clan settings**, tranne l’indirizzo — su quello vale la pena riflettere ora.',
    before: {
      title: 'Prima di iniziare',
      body: [
        'Ti serve un account Discord, e la lista finisce qui. Accedi prima su `{apex}`: un clan ha bisogno di un proprietario, e l’accesso è il modo in cui il sito sa che sei tu. Parti da **Creare un clan** nelle pagine della piattaforma, o vai direttamente su `{apex}/clans/new`.',
        'Non costa niente. Nessun piano da scegliere, nessuna carta da inserire e nessuna prova che scade portandosi via la tua board — un clan parte gratis e resta utilizzabile.',
        'I clan grandi possono passare a un piano superiore più avanti da **Plan and billing** in Admin. Tutto ciò che paghi su Anvil — un clan, uno spazio creator o il tuo abbonamento Supporter — è nella [tua pagina di fatturazione](/portal).',
      ],
      note: {
        tag: 'Ne sarai il proprietario',
        body: 'Proprietario è l’unico ruolo che nessuno può toglierti, e va a chi crea il clan. Aggiungi staff dopo da Admin → **People** → **Staff & roles**; vedi [Nel turno]({moderatorGuide}).',
      },
    },
    create: {
      title: 'Dagli un nome e scegli l’indirizzo',
      intro: 'Tre campi, e solo due decisioni vere. Il modulo controlla l’indirizzo mentre scrivi e te lo dice prima di inviare.',
      fields: [
        {
          term: 'Nome del clan nel gioco',
          body: 'Obbligatorio, e deve corrispondere **esattamente** a OSRS. Non è decorativo: la sincronizzazione della lista si basa su questo e rifiuta qualsiasi lista membri segnalata con un altro nome. È ciò che impedisce che la lista di qualcun altro finisca sul tuo sito.',
        },
        {
          term: 'Nome del clan',
          body: 'Facoltativo. Quello che vede la gente — sul sito e in ogni messaggio Discord. Lascialo vuoto e verrà usato il tuo nome nel gioco per entrambi.',
        },
        {
          term: 'Indirizzo',
          body: 'Il tuo clan vive su `{apex}/c/tuo-slug`. Viene suggerito dal nome che hai scritto, puoi modificarlo, e alcune parole sono riservate. Scegline uno che ti piacerà ancora fra un anno: è il link che finirà fissato nel tuo Discord.',
        },
      ],
      note: {
        tag: 'Il nome nel gioco è una serratura, non un’etichetta',
        body: 'Se il tuo clan cambia nome nel gioco, cambialo anche qui — fino ad allora la sincronizzazione rifiuterà il nuovo nome. È il controllo che funziona, non un guasto.',
      },
    },
    live: {
      title: 'È online',
      body: [
        'Premi **Crea clan** ed esiste. Nessun provisioning, nessuna coda, nessun «stiamo costruendo il tuo sito, ripassa fra qualche minuto» — un clan è una riga, quindi risponde già prima che la pagina finisca di cambiare.',
        'Atterri su una scelta tra **Configuralo**, che apre la procedura guidata, e **Dai prima un’occhiata**. Non si rompe niente se te ne vai e torni domani; la procedura ricorda quali passi hai fatto.',
      ],
    },
    setup: {
      title: 'La procedura guidata',
      intro: 'Tre passi separano un clan appena nato da un evento in corso, e la procedura li percorre in ordine, saltando ciò che hai già fatto. Subito dopo viene la board.',
      steps: [
        {
          term: 'Il tuo clan',
          body: 'Il tuo nome visualizzato, il nome del clan nel gioco e un link d’invito al tuo server. L’invito è ciò che permette alle pagine di iscrizione e alle guide di indirizzare le persone da te.',
        },
        {
          term: 'Collega Discord',
          body: 'Un bot condiviso, quindi nessuna applicazione da registrare e nessun token da incollare. Premi **Connect your bot** e approvalo una volta, poi scegli **A few channels** o **Just one channel** e premi **Set it up for me** — il bot crea i canali per te.',
        },
        {
          term: 'Porta dentro i tuoi membri',
          body: 'Installa il plugin, accedi con Discord, poi apri la finestra del clan in gioco e premi il pulsante **Anvil** nella sua barra del titolo. Nessuno può iscriversi a un evento finché la tua lista membri non è dentro.',
        },
        {
          term: 'Crea una board',
          body: 'La procedura finisce su **Create your first event →**. Scegli un formato, aggiungi caselle, apri le iscrizioni — è [Organizzare il tuo primo evento]({adminGuide}), e di gran lunga il passo più lungo.',
        },
      ],
      after: [
        'Puoi saltare del tutto la procedura con **Skip setup** e fare tutto più tardi da Admin → **Clan settings** e Admin → **Discord**. Esiste perché l’ordine conta quando non l’hai mai fatto: Discord prima dei canali, i membri prima di una board a cui devono iscriversi.',
      ],
    },
    members: {
      title: 'Far entrare i tuoi membri',
      body: [
        'Nessuno deve iscriversi, registrarsi o essere invitato uno alla volta. La tua lista membri arriva dal gioco.',
      ],
      ways: [
        {
          term: 'Sincronizzazione della lista (fai questa)',
          body: 'Apri la finestra del clan nel gioco con il plugin attivo e premi il pulsante **Anvil** nella barra del titolo. Tutta la lista arriva con i ranghi intatti, e una lista da un clan il cui nome non corrisponde al tuo viene rifiutata. Ripetilo quando qualcuno entra o esce — vedi la [guida di installazione per i giocatori]({pluginGuide}).',
        },
        {
          term: 'Chiedono di entrare',
          body: 'Accedere o giocare con il plugin non dà mai, da solo, un posto a nessuno. Se il plugin vede qualcuno giocare nel tuo clan in gioco prima che il tuo roster lo abbia, crea per lui una richiesta di adesione, e chiunque altro può chiedere con **Apply** sulla pagina del tuo clan. Lo staff risponde a entrambe in cima alla scheda **Roster**, e **Who can join** decide se aspettano un sì, entrano subito o non possono chiedere affatto. Chi gioca un personaggio già nel tuo roster viene invece confermato in **Needs review**. I dettagli sono in [La tua gente]({peopleGuide}).',
        },
        {
          term: 'A mano',
          body: 'Admin → **People** → **+ Add Manually** accetta nomi uno alla volta, per chi gioca da mobile o dal client ufficiale e non può usare il plugin.',
        },
      ],
      note: {
        tag: 'Gli ospiti non sono un problema da risolvere',
        body: 'Un ospite gioca nei tuoi eventi senza essere nel tuo clan in gioco: un giocatore di un clan in visita, un amico, un alt. Riceve un posto quando lo staff approva la sua richiesta, o subito se **Who can join** è impostato su **Let anyone in**. Gli ospiti sono tracciati e possono partecipare agli eventi, e non contano per il tuo piano. Chi entra nel tuo clan in gioco diventa membro alla successiva sincronizzazione del roster.',
      },
    },
    first: {
      title: 'Il tuo primo evento',
      body: [
        'La via più breve perché succeda qualcosa: crea una board, aggiungi una manciata di caselle che il plugin vede da solo, apri le iscrizioni e avvia. Drop, kill count e XP si registrano poi da soli.',
        'Due guide reggono il peso qui. [Organizzare il tuo primo evento]({adminGuide}) va dall’inizio alla fine — Discord, squadre, avvio, e cosa fare quando finisce. [Costruire una board che si segue da sola]({boardGuide}) parla nello specifico di caselle: cosa ogni tipo riesce davvero a rilevare, e quelle che si importano bene e poi non scattano mai.',
        'Se preferisci non costruire nessuna board nella prima settimana, organizza invece uno **Skill of the Week** o un **Boss of the Week**. Tutti quelli in lista partecipano in automatico, la classifica viene dagli hiscores, e non c’è niente da scrivere.',
      ],
    },
    together: {
      title: 'Eventi tra più clan',
      body: [
        'Un evento non deve appartenere a un solo clan. Più clan possono gestire insieme la stessa board — due, o una dozzina — mantenendo ciascuno la propria lista membri, il proprio staff e la propria metà della moderazione.',
        'Possono anche condividere un unico bacino di giocatori invece di stare ai lati opposti di una classifica: un evento, tutti dentro, comunque vengano divise le squadre. Clan contro clan è una forma di questo, non l’unica.',
        'Ogni clan in visita riceve un link d’invito per squadra, così non raccogli mai un solo RSN a mano, e un posto che permette al loro moderatore di approvare le prove dei propri membri. [Ospitare un clan in visita]({clanVsClanGuide}) copre l’organizzazione.',
      ],
      note: {
        tag: 'Niente da comprare',
        body: 'Partecipare all’evento di qualcun altro è gratis, e organizzarne uno pure. Un clan che compare solo sulle board altrui non avrà mai bisogno di altro che del proprio clan gratuito.',
      },
    },
    boosts: {
      title: 'Boost del clan',
      body: [
        'I membri che pagano Anvil Supporter al livello **Champion** (un boost) o **Patron** (due) possono dare un boost al clan dalle proprie **Settings → Clan boosts**. Un boost conta quando il loro posto nel clan ha compiuto 14 giorni, e da una stessa persona non ne contano più di due.',
        'Vedi a che punto sei in Admin → **Clan settings** → **Boosts**: il livello del clan, quanti boost contano e quanti ne servono ancora per il livello successivo. Il Livello 1 richiede 3 boost, il Livello 2 ne richiede 8 e il Livello 3 15. Se i boost scendono sotto un livello, i suoi vantaggi restano ancora per una settimana.',
        'Il Livello 1 mette un badge **Boosted** sulla pagina del clan, sulla sua scheda nella Clan Hall e nella ricerca, ti elenca sopra i clan senza boost nella Clan Hall e dà al tuo nome un gradiente. Il Livello 2 aggiunge un posto nella riga Featured della Clan Hall, riproduce il tuo banner animato e sblocca una **Recruiting line**: una frase, fino a 140 caratteri, mostrata ai visitatori. Il Livello 3 aggiunge uno Spotlight in cima alla Clan Hall e un **Recruitment post in the Anvil Discord** al mese, fino a 500 caratteri, inviato una sola volta con **Post to the Anvil Discord**, con un link alla pagina del clan e senza menzionare nessuno.',
      ],
      note: {
        tag: 'Solo estetica',
        body: 'I boost cambiano l’aspetto del clan e il punto in cui viene elencato. Non cambiano mai un rank, un punteggio, i tuoi posti o il tuo piano.',
      },
    },
    features: {
      title: 'Funzioni e piano',
      intro: 'Gli admin possono attivare o disattivare intere parti di Anvil sotto **Features**. Se disattivate, spariscono dai menu; non viene cancellato nulla.',
      rows: [
        {
          term: 'Eventi',
          body: '**Skill & Boss of the Week** (attivo), **Surprise-task formats** (disattivato), **Missions** (disattivato), **Post-event survey** (disattivato).',
        },
        {
          term: 'Denaro',
          body: '**Sign-up fees** (attivo), **Clan coffer** (disattivato).',
        },
        {
          term: 'Discord e plugin',
          body: '**Post to Discord** (attivo), **Death & fun messages** (disattivato), **Clan Hall card**, che mostra chi è online nel tuo Discord sulla pagina pubblica del clan (attivo).',
        },
      ],
      outro: '**Plan and billing** mostra il tuo piano, quanti membri hai rispetto alla sua capienza, e i piani più grandi. Se paghi, c’è anche **Manage subscription and invoices**.',
    },
  },

  discord: {
    metaTitle: 'Anvil in Discord — Anvil',
    metaDescription: 'Collega il bot Anvil al tuo server Discord: un invito, i canali in cui pubblica ogni feed, la sincronizzazione di ruoli e nickname, i comandi slash, e cosa controllare quando cala il silenzio.',
    eyebrow: 'Anvil · Discord',
    title: 'Anvil in Discord',
    dek: 'Un bot, un invito, e nessuna applicazione da registrare. Ecco cosa pubblica, dove lo pubblica, cosa può cambiare nel tuo server — e cosa guardare il giorno in cui si ferma.',
    facts: [
      {
        strong: 'Un bot',
        rest: 'condiviso, niente da creare',
      },
      {
        strong: '~5 min',
        rest: 'dall’invito al primo messaggio',
      },
      {
        strong: 'Facoltativo',
        rest: 'ogni feed è spento finché non lo indirizzi',
      },
    ],
    footnote: 'Tutto questo sta in Admin → **Discord**: la configurazione rapida in alto, poi **More settings** — Connection, What goes where, Event posts, Roles & nicknames, Team channels, Commands e Post without a bot.',
    bot: {
      title: 'Un bot, già pronto',
      body: [
        'Non c’è nessuna applicazione Discord da creare, nessun token da generare e nessun segreto da incollare. Anvil fa girare un bot che ogni clan condivide, quindi collegarlo è un invito e nient’altro.',
        'Puoi comunque portare il tuo — incolla un token sotto **Use your own bot instead (advanced)** e verrà usato al suo posto. Ne vale la pena solo se vuoi che il bot porti nome e avatar del tuo clan nella lista membri; tutto in questa guida funziona uguale in entrambi i casi.',
      ],
      permissions: [
        {
          term: 'Visualizza canali, Invia messaggi, Incorpora link, Allega file',
          body: 'Le basi. Senza queste è nel tuo server e muto.',
        },
        {
          term: 'Gestisci webhook',
          body: 'Perché **Set it up for me** e **Post here** possano creare i webhook per te invece che tu copi URL da Discord a mano, e perché Anvil possa trovare i vecchi webhook da farti rimuovere.',
        },
        {
          term: 'Gestisci ruoli',
          body: 'Solo se attivi la sincronizzazione dei ruoli. Allora può assegnare i ruoli che colleghi — e non può mai toccare un ruolo sopra il proprio, che è una regola di Discord, non nostra.',
        },
        {
          term: 'Gestisci nickname',
          body: 'Solo se attivi la sincronizzazione dei nickname, perché il nickname sul server di un membro possa essere impostato al suo RSN.',
        },
        {
          term: 'Gestisci canali',
          body: 'Per i canali privati delle squadre durante un draft, e per le guide pubblicate come nuova categoria o forum. Senza, tutto il resto funziona comunque.',
        },
        {
          term: 'Gestisci thread, Invia messaggi nei thread',
          body: 'Per le guide pubblicate in un forum: scrivere nel post e rimuoverlo di nuovo — senza questo permesso Discord non lascia a un bot eliminare nemmeno il proprio post.',
        },
        {
          term: 'Cambia nickname',
          body: 'Solo se dai al bot il nome del tuo clan sotto **Connection → Bot appearance in your server**. Cambia il nome del bot solo nel tuo server.',
        },
      ],
      note: {
        tag: 'Chiede tutto in una volta',
        body: 'Discord non ha modo di chiedere un permesso più tardi, quindi il link d’invito richiede l’intero set, e le funzioni che non attivi mai non usano mai il loro. Riaprire il link d’invito è anche il modo di riparare un permesso che qualcuno ha tolto.',
      },
    },
    connect: {
      title: 'Collegarlo',
      intro: 'Due cose, in quest’ordine. Il bot deve essere nel tuo server, e Anvil deve sapere quale server è il tuo.',
      steps: [
        {
          term: 'Invita il bot',
          body: 'Admin → **Discord** → **Connect your Discord server** (o **Add Anvil to Discord**). Discord ti chiede a quale server aggiungere Anvil e ti rimanda qui, quindi non puoi aggiungerlo a quello sbagliato per sbaglio. In seguito, **Invite / re-invite the bot** si trova sotto **More settings → Connection**.',
        },
        {
          term: 'Imposta l’ID del server',
          body: 'Solo se il pulsante non ci riesce: apri **Can’t use the button? Enter the server ID**, fai clic destro sull’icona del tuo server in Discord → **Copia ID server** (richiede la Modalità sviluppatore attiva, sotto Avanzate nelle impostazioni di Discord), incollalo in **Your Discord server’s ID** e premi **Save**. È il campo che rende il collegamento specificamente tuo.',
        },
      ],
      after: [
        'Il pannello ti dice poi la verità invece della tua intenzione: se il bot è davvero membro di quel server, e quali permessi gli mancano. Una riga verde lì vale più di un modulo salvato.',
      ],
      note: {
        tag: 'L’ID del server è tutto il legame',
        body: 'Un server appartiene esattamente a un clan su Anvil, e i comandi slash da un server che nessuno ha rivendicato vengono rifiutati anziché indovinati. Finché non lo imposti, il bot è invitato e inattivo.',
      },
    },
    channels: {
      title: 'Configurare i webhook',
      body: [
        'Anvil pubblica tramite **webhook**, uno per canale, e sono tutti facoltativi. Non viene pubblicato niente da nessuna parte finché non indirizzi un feed a un canale — un clan appena nato è silenzioso di proposito, non per sbaglio.',
        'Con il bot di Anvil nel tuo server, **Set it up for me** in cima ad **Admin → Discord** crea i canali e ci punta ogni feed. Per farlo a mano, apri **More settings → What goes where** e parti dal **Catch-all channel** in **Clan & events**, poi dall’**In-game catch-all** in **In-game (plugin)**: scegli un canale dal menu a tendina e si salva da solo. Senza il bot, in Discord apri **Modifica canale → Integrazioni → Webhook** di quel canale, creane uno, copia l’URL, scegli **Paste a webhook…** nel menu a tendina, incollalo e premi **Save**. Un URL webhook può pubblicare nel canale, quindi trattalo come una password; se viene esposto, eliminalo in Discord e creane uno nuovo. **Test**, e **Add another** per distribuire i post più intensi fra due webhook, si trovano sotto **Post without a bot**.',
      ],
      feeds: [
        {
          term: 'Canale generale',
          body:
            'Il principale, nella scheda **Clan & events**. Inizio e fine degli eventi, apertura delle iscrizioni, classifiche, risultati settimanali: tutto ciò che il sito pubblica senza un canale dedicato. Se imposti solo questo, hai già un clan funzionante.',
        },
        {
          term: 'Canale generale in-game',
          body:
            'Nella scheda **In-game (plugin)**: qui finisce tutto ciò che arriva dal gioco quando non ha un canale proprio. Impostalo per secondo.',
        },
        {
          term: 'Traguardi e altro',
          body:
            'Nella scheda **In-game (plugin)**. Slayer, clue, speedrun, conteggi di uccisioni, gamble BA e messaggi di chat personalizzati vengono pubblicati qui, una volta che i giocatori li attivano. Il pulsante **Filters** definisce cosa il tuo clan assegna per impostazione predefinita ai membri. I modelli dei giocatori e i tipi privati sono in [Settings, page by page]({settingsGuide}).',
        },
        {
          term: 'I feed separati',
          body:
            'I post degli eventi, le bacheche che co-ospiti, Skill & boss of the week e gli eventi del calendario del clan possono essere separati dal canale generale; i drop rari, i pet, il collection log, i livelli, le imprese di combattimento, le quest, i diari, le morti e le uccisioni PvP possono essere separati dal canale generale in-game. Modifiche al roster, approvazioni delle iscrizioni e il registro della cassa restano su **Staff only**. I feed separati vuoti ricadono sul loro canale generale. La cassa fa eccezione: se è vuota, non viene pubblicato alcun denaro. Leghe e altre modalità hanno la loro scheda **Game modes**.',
        },
      ],
      note: {
        tag: 'Separa prima le morti',
        body: 'Le morti sono il feed con più volume sulla maggior parte delle board e quello che seppellisce tutto il resto. Se separi una cosa sola, separa quella.',
      },
    },
    roles: {
      title: 'Ruoli e nickname',
      body: [
        'Entrambe le sincronizzazioni restano spente finché non le attivi in **Admin → Discord → Roles & nicknames**, ed entrambe dipendono dal roster. Attiva **Enable Discord role sync**, lascia acceso **Auto-match in-game rank → Discord role by name**, scegli gli eventuali **Member roles** e **Guest roles** generali, salva e poi premi **Sync roles & nicknames now**. Ogni persona deve anche avere un’identità Discord collegata; il resoconto della sincronizzazione nomina chiunque non sia riuscita a risolvere.',
      ],
      ways: [
        {
          term: 'Sincronizzazione dei ruoli',
          body: 'Collega i tuoi ranghi di gioco a ruoli Discord e Anvil li tiene allineati. Ci sono anche ruoli singoli per membri, ospiti, capitani e l’evento in corso, così puoi menzionare le persone giuste senza mantenere una lista a mano.',
        },
        {
          term: 'Sincronizzazione dei nickname',
          body: 'Imposta il nickname sul server di un membro al suo RSN. Di base riempie un nickname vuoto e le si può dire di sovrascriverne uno scelto dalla persona — è l’impostazione su cui riflettere prima, non dopo.',
        },
      ],
      note: {
        tag: 'Il ruolo del bot deve stare sopra quelli che gestisce',
        body: 'Discord non permette a nessun bot di toccare un ruolo pari o superiore al proprio, e lo rifiuta in silenzio dal tuo lato — la sincronizzazione semplicemente non fa nulla. Trascina il ruolo Anvil più in alto in **Impostazioni server → Ruoli** e comincia a funzionare; non serve reinvitare niente.',
      },
    },
    commands: {
      title: 'Comandi slash',
      body: [
        'Il bot risponde a `/bingo` nel tuo server (la board, la classifica, le regole, la tua scheda) più a comandi del clan come `/sotw`, `/stats` e `/coffer`. Leggono il sito in tempo reale, così nessuno deve uscire da Discord per vedere a che punto è. [Ogni comando e le sue opzioni]({commandsGuide}) hanno una pagina dedicata.',
        'Compaiono circa un minuto dopo l’ingresso del bot. Se non compaiono affatto, l’invito ha concesso il bot ma non i suoi comandi — sono due permessi separati, e un vecchio link d’invito ne chiedeva uno solo. Rilancia **Invite / re-invite the bot** sotto **Connection** nella pagina Discord; non espelle il bot e non azzera nulla.',
      ],
      note: {
        tag: 'Risponde nella lingua di ciascuno',
        body: 'Di base il bot risponde nella lingua che quel membro ha impostato in Discord, con l’inglese come ripiego. Scegli una sola lingua sotto **Lingua del bot** per imporla a tutti — è anche l’unico modo di avere l’arabo, dato che Discord non ha una lingua client araba da rilevare.',
      },
    },
    posts: {
      title: 'Cosa pubblica, e quando',
      body: [
        'Due fonti, e vale la pena sapere quale è quale quando qualcosa sembra sbagliato.',
        'Il **sito** pubblica gli eventi: una board che apre, le iscrizioni, un avvio, le classifiche, il risultato. Partono da Anvil stesso e funzionano che qualcuno abbia il plugin o no.',
        'Il **plugin** pubblica ciò che succede nel gioco: drop, pet, morti, livelli, caselle del collection log, combat achievement. Esistono solo per i membri che lo usano, quindi un canale drop silenzioso di solito significa un plugin silenzioso, non un webhook rotto.',
      ],
      note: {
        tag: 'Niente viene pubblicato due volte',
        body: 'Un drop che completa una casella è un messaggio, non uno dal plugin e un altro dalla board.',
      },
    },
    modes: {
      title: 'Leagues, Deadman e altre modalità',
      body: [
        'Leagues, Deadman, hardcore e le altre modalità girano su mondi propri con personaggi propri. I loro post sono sempre etichettati e non contano mai per bacheche o competizioni. Hanno una scheda dedicata: **Admin → Discord → What goes where → Game modes**. Una modalità compare lì la prima volta che un membro la gioca.',
        'Ogni modalità ha un interruttore e un canale **To**. Attiva **Send game-mode posts to their own channels** per usare quei canali; se lo lasci disattivato, ogni modalità pubblica nei canali normali, comunque etichettata. Il pulsante **Posts** nella riga di una modalità elenca ogni tipo che invia (quelli usuali e gli eventi propri della modalità), ciascuno con il proprio interruttore.',
        'Sotto questo elenco, **Custom thresholds** fanno sì che una modalità pubblichi meno del gioco principale. **Post drops rarer than 1 in…** (minimo 2) e **Post drops worth at least (gp)** (minimo 1,000) impostano le proprie soglie minime (vuoto = come il gioco principale), poi premi **Save drop thresholds**: i drop sempre pubblicati continuano a esserlo, ma quelli che contano solo per il valore no. **Use its own level milestones** pubblica un level-up solo se rispetta entrambi gli insiemi di regole.',
      ],
      note: {
        tag: 'Più severi, mai più permissivi',
        body: 'I filtri di una modalità possono solo togliere post. Il plugin ha già applicato le impostazioni del gioco principale, quindi niente di ciò che fa un filtro di modalità può riportare indietro un post.',
      },
    },
    cleanup: {
      title: 'Vecchi webhook di altri plugin o bot',
      body: [
        'Con il bot nel tuo server, la pagina Discord elenca ogni webhook presente che non è di Anvil. **Coming from other plugins?** offre **Use the same channels**, così **Set it up for me** pubblica dove pubblicavano i tuoi vecchi feed e per i tuoi membri non cambia niente.',
        'Quando i tuoi membri sono passati ad Anvil, vai su **Remove old webhooks from other plugins**, spunta quelli da eliminare e premi **Remove … webhooks**, poi **Yes, remove them**. Questo li elimina in Discord per sempre — non si può annullare.',
        'La lista contiene qualsiasi webhook che non sia di Anvil, non solo quelli di altri plugin. Ce n’è uno che vuoi tenere, come il feed di un altro bot? Premi **Keep** ed esce dalla lista; **Show kept** e **Put back** lo riportano dentro. Tenerlo lo nasconde soltanto qui — in Discord non cambia niente.',
      ],
      note: {
        tag: 'Richiede il permesso Gestisci webhook',
        body: 'Il bot legge i webhook del tuo server per trovarli. Senza _Gestisci webhook_ sul suo ruolo, la pagina dice che non riesce a vederli.',
      },
    },
    announce: {
      title: 'Pubblicare su Discord',
      body: [
        'Gli admin possono pubblicare come il bot da **Post to Discord**, sotto **Clan** nel menu di amministrazione. Scegli un **Channel**, scrivi il **Message** e premi **Send message**. Un testo lungo, come un regolamento, viene diviso da sé in più messaggi.',
        '**Send as an embed** è attivo di base e aggiunge un **Title** facoltativo e un **Accent colour**; spegnilo per il testo semplice. **Ping** sceglie un ruolo, o @everyone, da menzionare, e Anvil chiede conferma prima di inviare.',
        'Ogni post che invii è elencato sotto **Sent from here**. **Edit** lo modifica in Discord senza menzionare di nuovo nessuno, e **Delete** lo rimuove.',
      ],
      note: {
        tag: 'Solo admin, con il bot',
        body: 'Pubblica come il bot di Anvil, quindi collega prima il tuo server. I moderatori non lo vedono. È l’interruttore **Post to Discord** sotto **Clan settings → Features**; se lo spegni, sparisce dal menu.',
      },
    },
    quiet: {
      title: 'Quando cala il silenzio',
      body: [
        'In ordine, perché ogni punto esclude il successivo:',
      ],
      checks: [
        {
          term: 'Il bot è davvero nel server?',
          body: '**Connection** nella pagina Discord lo dice direttamente. «Token valido» e «nel tuo server» sono fatti diversi e il primo non implica il secondo — con un bot condiviso il token è sempre valido.',
        },
        {
          term: 'L’ID del server è giusto?',
          body: 'Un ID sbagliato ma reale sembra identico a uno giusto, finché non noti che i messaggi finiscono altrove.',
        },
        {
          term: 'Il webhook esiste ancora?',
          body: 'Eliminare un canale Discord elimina il suo webhook, e Anvil tiene l’URL morto. Scegli di nuovo un canale per quel feed sotto **What goes where**.',
        },
        {
          term: 'Il ruolo del bot è abbastanza in alto?',
          body: 'Solo per la sincronizzazione di ruoli e nickname — vedi sopra. È quella che fallisce in silenzio.',
        },
      ],
      note: {
        tag: 'Non può dare il benvenuto a chi entra',
        body: 'Discord segnala gli ingressi solo tramite una connessione gateway, che un bot condiviso non mantiene aperta per ogni server. Quindi non c’è nessun messaggio di benvenuto — metti il link di iscrizione in un canale #ruoli o #inizia-qui, che è dove la gente guarda comunque.',
      },
    },
    drops: {
      title: 'Soglie dei drop',
      body: [
        'Anvil parte da **1m gp** oppure **1 in 1,000**. Un drop viene pubblicato quando soddisfa uno dei due. Nessuno può impostare valori più bassi di questi, e 0 disattiva una soglia.',
        'Imposta i valori predefiniti del tuo clan in **Admin → Discord → What goes where → Drops**: **Default minimum drop value (gp)**, **Default: post drops rarer than 1 in…** e **Require both**. Attiva **Require both** e un drop deve soddisfare il valore **and** la rarità.',
        'Ogni personaggio segue il valore predefinito del clan di cui è membro, e quello di Anvil se non ne ha uno. I giocatori possono scegliere i propri numeri in **Settings**. Compaiono **Using clan default** oppure **Custom**, e **Reset** torna indietro.',
        '**Hard floor: never post drops more common than 1 in…** è quella rigida. I membri non possono andare oltre nei canali del tuo clan. I loro webhook personali sì.',
      ],
      note: {
        tag: 'Altro dal lato giocatore',
        body: 'I numeri, i modelli e i webhook dei giocatori sono in [Settings, page by page]({settingsGuide}).',
      },
    },
    pools: {
      title: 'Più webhook per i canali affollati',
      body: [
        'Un webhook può inviare solo a una certa velocità. Per un evento affollato, aggiungi altri webhook allo stesso canale. Premi **Busy channel? Let the bot add … more webhooks** (richiede **Manage Webhooks**) oppure incolla più link di webhook nella casella del canale. Anvil ne suggerisce altri quando hai 50 o più giocatori, molti post al minuto, o quando Discord ha recentemente detto “slow down”. Fino a 10 bastano.',
        'Anvil alterna tra i webhook. Se Discord dice “slow down” per uno, quel webhook si ferma un attimo e il successivo prende il post. Se uno viene eliminato o smette di funzionare, viene saltato per 10 minuti. I post continuano a fluire finché un webhook funziona.',
        'Tutti devono puntare allo stesso canale. Anvil ti avvisa se non è così. Usa **Test** per verificarne uno, o **Stop posting here** per rimuoverlo.',
      ],
      note: {
        tag: 'Stesso canale, stessi post',
        body:
          'Più webhook non pubblicano mai due volte lo stesso post. Condividono solo il lavoro. La stessa idea è in [Drop thresholds](#drops) qui sopra e il lato admin in [Running the event]({adminGuide}).',
      },
    },
  },

  plugin: {
    metaTitle: 'Configurare il plugin RuneLite — Anvil',
    metaDescription:
      'Installa il plugin RuneLite di Anvil, accedi dal suo pannello laterale e configura le notifiche Discord.',
    eyebrow: 'Anvil · plugin RuneLite',
    title: 'Guida alla configurazione per i giocatori',
    dek: 'Installalo, accedi e gioca. Il plugin invia i tuoi drop del bingo, pubblica su Discord i drop rari, le morti e i traguardi, e ti permette di cercare chiunque con un clic destro.',
    facts: [
      { strong: '1 pulsante', rest: 'per iniziare a tracciare' },
      { strong: '~3 min', rest: 'per la configurazione di base' },
      { strong: 'Clic destro', rest: 'per cercare chiunque' },
    ],
    footnote:
      'Gli screenshot vengono da una configurazione reale —— il token dell’account è oscurato apposta. Il tuo dovrebbe restare altrettanto privato.',

    install: {
      title: 'Installa il plugin',
      body: [
        'In RuneLite: **Configuration** (la chiave inglese) → **Plugin Hub** → cerca **Anvil** → **Install**. L’autore è `AhmedFathy2001`.',
        'Un solo plugin serve tutti i clan —— si collega sempre a `anvilosrs.com`, ed è l’accesso (passo successivo) a legarlo a te e ai tuoi clan. Non c’è nulla di specifico da scaricare né alcun indirizzo da digitare. Una volta installato, nella barra laterale di RuneLite compare un pulsante **Anvil**, e le impostazioni si trovano in **Configuration → Anvil**.',
      ],
    },

    connect: {
      title: 'Accedi',
      intro: 'Apri il pannello **Anvil** dalla barra laterale di RuneLite e clicca **Sign in with Discord**. Il browser si apre su `anvilosrs.com`; approva lì il codice e il plugin accede da solo —— niente da scrivere, niente da copiare e niente da compilare nelle impostazioni.',
      panelFigure: {
        caption: 'RuneLite → il pulsante Anvil',
        alt: 'La barra delle icone di RuneLite, con il pulsante Anvil in fondo evidenziato',
        legend: [
          {
            label: 'Il pulsante Anvil',
            body: 'sul lato della finestra di RuneLite, in fondo alla barra delle icone. Cliccalo per aprire il pannello. Compare appena il plugin è installato e attivo — e puoi trascinarlo più in alto nella barra se lo preferisci vicino alla cima.',
          },
        ],
      },
      signInFigure: {
        caption: 'Il pannello Anvil',
        alt: 'Il pannello Anvil con il pulsante Sign in with Discord e il sito a cui si collega evidenziati',
        legend: [
          {
            label: 'Sign in with Discord',
            body: 'appare solo finché questo computer è disconnesso. Cliccalo e il resto avviene nel tuo browser.',
          },
          {
            label: 'Connects to',
            body: 'sempre `anvilosrs.com` —— l’unico sito con cui il plugin parla, e quello a cui appartiene il tuo token.',
          },
          {
            label: 'Paste a token instead',
            body: 'il ripiego, se il passaggio nel browser non funziona per te —— vedi la fine di questo passaggio.',
          },
        ],
      },
      easySteps: [
        'Clicca **Sign in with Discord**. Il pannello mostra un codice breve e apre il browser su `anvilosrs.com`.',
        'Accedi lì con Discord se non l’hai già fatto, controlla che il codice sulla pagina corrisponda a quello in RuneLite, poi clicca **Approve**.',
        'Tornato in RuneLite, in cima al pannello c’è scritto _Signed in_ —— e, una volta entrato in gioco, quale personaggio sta tracciando. Fatto.',
      ],
      linkFigure: {
        caption: 'anvilosrs.com → /link-device',
        alt: 'La pagina “Link your RuneLite client”, con il campo del codice e il pulsante Approve evidenziati',
        legend: [
          { label: 'Il codice', body: 'deve coincidere con quello che il plugin ti sta mostrando in questo momento.' },
          {
            label: 'Approve',
            body: 'approva soltanto un codice mostrato dal _tuo_ client. Se qualcuno ti ha mandato un link o un codice, rifiuta: approvare significherebbe consegnargli il tuo account.',
          },
        ],
      },
      directNote: {
        tag: 'Dove avviene tutto questo',
        body: [
          'Tutto questo flusso resta su `anvilosrs.com` —— il codice viene emesso lì, lo approvi lì con il tuo login Discord, e il token torna direttamente al plugin. Il plugin apre pagine di accesso solo su `anvilosrs.com`, quindi un link di accesso che punta altrove non viene da lui.',
        ],
      },
      federationAside:
        'Da non confondere con **Connect clans** nel pannello laterale —— quello è il pulsante separato e facoltativo che ti collega ad altri clan Anvil, e compare solo quando hai già effettuato l’accesso qui.',
      manualFallback:
        'Se il browser non si apre da solo, il pannello stampa l’indirizzo e il codice così puoi aprirlo a mano. I codici scadono dopo dieci minuti —— basta premere di nuovo il pulsante.',
      manualHeading: 'Ripiego: incolla il token a mano',
      manualIntro:
        'Se l’accesso dal plugin non funziona per te, copia il tuo token qui sotto (o da [Profile → plugin token](/profile#plugin-token), dove puoi anche ruotarlo), poi clicca **Paste a token instead** sotto il pulsante di accesso nel pannello Anvil e incollalo lì.',
      tokenFigure: {
        caption: 'Profilo → RuneLite plugin',
        alt: 'La scheda RuneLite plugin sulla pagina del profilo, con il campo del token e i pulsanti Reveal, Copy e Rotate evidenziati',
        legend: [
          {
            label: 'Il tuo token',
            body: 'nascosto finché non premi Reveal. In questo screenshot è oscurato apposta; non pubblicare mai il tuo su Discord.',
          },
          {
            label: 'Copy / Rotate',
            body: 'copialo, poi usa **Paste a token instead** nel pannello Anvil. Rotate ne emette uno nuovo e annulla il vecchio —— usalo se sospetti che il tuo token sia trapelato.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Usa il pannello laterale ogni giorno',
        body: ['**Il pannello laterale di Anvil è il tuo spazio di lavoro principale**: accedi ed esci da lì, guarda i tuoi clan e gli eventi attivi, sfoglia e rivendica le caselle, segui i progressi, scatta le immagini iniziali, avvia le sincronizzazioni e apri gli strumenti di supporto. **Configuration → Anvil**, mostrato qui sotto, serve solo per le preferenze —— lì non c’è nessun token. Per disconnettere questo computer, apri il menu **⋯** accanto al tuo nome in cima al pannello. Un solo accesso copre tutti gli eventi a cui sei iscritto — non devi rifarlo per ogni bingo.'],
      },
    },

    accounts: {
      title: 'Collega i tuoi account',
      body: [
        'Una volta configurato il token, gli account con cui giochi compaiono automaticamente sul tuo profilo. Un account nuovo può essere collegato subito; uno già presente nel roster di un clan richiede prima una verifica della proprietà, perché un nome RuneScape pubblico non dimostra chi lo possiede.',
        'Per il primo collegamento usa [la verifica rapida tramite XP](/profile#link-account), oppure chiedi a un moderatore del clan di approvare l’account tra [gli account rilevati](/profile#detected-accounts). Dopo la verifica, l’impronta stabile segue i cambi di nome e riconosce automaticamente l’account.',
      ],
      figure: {
        caption: 'Profilo → RuneScape Accounts',
        alt: 'La scheda RuneScape Accounts sulla pagina del profilo con gli account verificati tramite plugin',
        legend: [
          {
            label: 'I tuoi account collegati',
            body: 'tutto ciò che è contrassegnato “Verified via plugin” è collegato e verrà riconosciuto automaticamente. Gli account già nel roster possono richiedere prima una verifica una tantum tramite XP o moderatore.',
          },
        ],
      },
      noPluginHeading: 'Non puoi usare il plugin?',
      noPluginIntro:
        'Da mobile o dal client ufficiale usa [Profile → account linking](/profile#link-account):',
      noPluginOptions: [
        '**Verify by XP** —— inserisci il tuo RSN, il sito estrae una skill a caso, guadagni 1.000 XP in quella skill entro 30 minuti.',
        '**Manual review** —— per Hiscores nascosti o alt appena creati: invii il tuo RSN con una nota e un moderatore approva.',
      ],
      signupNote: 'Per iscriversi a un evento serve almeno un account verificato, quindi sistemalo prima di iscriverti.',
    },

    working: {
      title: 'Verifica che funzioni',
      intro: 'Accedi e leggi la chat. Il plugin ti saluta quando è collegato e c’è un evento in corso.',
      chat: [
        { text: 'Bingo running: Summer Bingo 2026.', tone: 'gold' },
        { text: 'Skill of the Week is live: Runecraft.', tone: 'gold' },
        { text: '…più tardi, mentre le cose accadono…', tone: 'muted' },
        { text: 'Tracked drop detected: Dragon warhammer (1/1)', tone: 'plain' },
        { text: 'Tracked kill: Zulrah (7/10)', tone: 'plain' },
      ],
      outro:
        'Dovresti anche vedere il **pannello laterale di Anvil** riempirsi con i tuoi clan, gli eventi in corso, la tua posizione e i pulsanti di sincronizzazione — e comparire un pulsante **Anvil** nella barra del titolo del Collection Log in gioco.',
      guestNote: {
        tag: 'Ospite o membro',
        body: 'Se la chat dice _Tracked as a guest_, sei tracciato ma non sei ancora nel roster del clan. Un admin lo risolve sincronizzando il roster del clan in gioco —— chiedi {discordLink}.',
        discordWord: 'su Discord',
      },
      panelHeading: 'Il pannello laterale',
      panelBody: [
        'Quattro schede e un ingranaggio. **Clan** sono i tuoi eventi e il tuo clan: ogni bingo e competizione settimanale in corso o in arrivo con la tua posizione. **Feed** sono i grandi momenti del tuo clan e delle tue board mentre accadono, con la chat dell’evento. **You** è il tuo profilo, e **Lookup** trova quello di chiunque altro, giocatore o clan. L’ingranaggio contiene la sincronizzazione e i suoni del tuo banner.',
        'Ogni scheda, la chat dell’evento, le reazioni e le impostazioni che portano il feed e i colori Supporter nel tuo gioco sono in [Il pannello laterale, scheda per scheda]({panelGuide}).',
      ],
      panelFigure: {
        caption: 'Clan · You · Lookup',
        alt: 'Le tre schede del pannello laterale di Anvil affiancate: la scheda Clan con gli eventi e la settimana del clan, la scheda You con il tuo collection log e la scheda Lookup con la scheda di un altro giocatore',
      },
      lookupHeading: 'Cerca chiunque',
      lookupBody:
        'Fai clic destro su un giocatore — accanto a te, o sul suo nome in chat, nella lista amici o nel pannello del clan — e scegli **Anvil** per aprire la sua scheda nella tab **Lookup** del pannello laterale. La tua è la tab **You**.',
      lookupFigure: {
        caption: 'Clic destro su un nome → Anvil',
        alt: 'Il menu del clic destro di un giocatore in gioco con una voce Anvil sotto Lookup',
      },
      lookupSettingNote:
        'Scegli dove compare la voce **Anvil** in **Player lookup** nelle impostazioni del plugin. Su un nome in chat non è mai l’opzione del clic sinistro, quindi cliccare su un nome fa ancora quello che fa il gioco.',
      lookupSettingFigure: {
        caption: 'Configuration → Anvil → Player lookup',
        alt: 'La sezione Player lookup delle impostazioni di Anvil con ogni impostazione evidenziata e numerata',
        legend: [
          {
            label: 'Anvil lookup on players',
            body: 'l’interruttore principale. Disattivato, la voce sparisce ovunque.',
          },
          {
            label: 'Players in the world',
            body: 'il clic destro su un giocatore che si trova vicino a te.',
          },
          {
            label: 'Chatbox and private messages',
            body: 'i nomi nella chatbox e nella chat privata.',
          },
          {
            label: 'Clan panels / Friends chat / Friends, ignore and party lists',
            body: 'le liste di nomi: i membri del tuo clan e del clan ospite, il canale della friends chat, le tue liste amici e ignorati e il pannello del party del raid.',
          },
        ],
      },
    },

    bingo: {
      title: 'Impostazioni del bingo',
      intro:
        'Contano solo mentre sei dentro un evento. I valori predefiniti vanno bene —— questo è ciò che fa davvero ciascuno.',
      figure: {
        caption: 'Configuration → Anvil → Bingo',
        alt: 'La sezione Bingo della configurazione del plugin con ogni impostazione evidenziata e numerata',
        legend: [
          {
            label: 'Show Overlay',
            body: 'disegna un piccolo riquadro _Anvil / squadra / data UTC_ in alto a sinistra. Entra a far parte dell’immagine nei tuoi screenshot di prova, ed è ciò che rende una prova difficile da falsificare o retrodatare. In questo screenshot è disattivato —— attivalo se il tuo clan vuole squadra e orario visibili su ogni prova.',
          },
          {
            label: 'Team completion popups',
            body: 'un banner quando chiunque nella tua squadra completa una casella. Se ne arrivano più insieme: la più difficile prende il banner, le altre vanno in chat.',
          },
          {
            label: 'My tile popups',
            body: 'un popup quando un tuo drop fa avanzare una casella o la completa. Disattivato, il tracciamento continua —— solo in silenzio.',
          },
          {
            label: 'Banner sound + volume',
            body: 'riproduce un suono insieme al banner. Non succede nulla finché non aggiungi almeno un .wav tu, con **Add clip** sotto “Banner sounds” nel pannello laterale di Anvil. Le missioni hanno una cartella propria: aggiungi una clip in **Mission sounds** e la riprodurranno al posto del suono integrato che le distingue da una casella completata.',
          },
          {
            label: 'Auto starting shot',
            body: 'fa per te lo scatto di partenza di un evento nel momento in cui ti trovi sul punto fissato. Disattivato, premi tu **Take starting shot** nel pannello laterale.',
          },
        ],
      },
      teamsHeading: 'Squadre',
      teamsBody:
        'Il pulsante **Teams** di un evento elenca le sue squadre in classifica, con la tua in cima. Aprine una per vederne il roster, capitano per primo, oppure cerca un giocatore in tutte le squadre —— clicca su un nome per cercarlo.',
      teamsFigure: {
        caption: 'Evento → Teams',
        alt: 'La pagina Teams con le squadre di un evento, i loro punti e il numero di membri, accanto al roster di una squadra con il capitano per primo',
      },
      startHeading: 'Scatto di partenza',
      startBody: [
        'Alcuni eventi chiedono a tutti uno **scatto di partenza**: uno screenshot fatto dopo l’avvio dell’evento, in un luogo estratto nel momento stesso della partenza. Impedisce a chiunque di passare la settimana precedente ad accumulare clue, forzieri e kill da scaricare il primo giorno.',
        'Se usi il plugin non devi preparare nulla. Quando l’evento parte ricevi una riga in chat che ti dice dove andare, e il pannello laterale di Anvil mostra un pulsante **Take starting shot**. Mettiti dove indicato, premilo una volta e hai finito —— il plugin cattura il fotogramma, ci imprime il tuo RSN, la squadra, il luogo e una parola chiave che tocca solo al tuo account, e lo archivia per te.',
        'Prima di archiviare qualsiasi cosa controlla due cose, così le sistemi in gioco anziché in una discussione su Discord dopo. Se l’organizzatore ha fissato il punto sulla mappa, il plugin sa quanto sei distante e te lo dice, invece di mandare uno scatto dall’altra parte di Gielinor. E se l’evento richiede una sessione fresca, devi **disconnetterti e riconnetterti** prima di scattare: i tuoi hiscores vengono salvati solo al logout, quindi un relog subito prima dello scatto è ciò che rende corretti i tuoi totali iniziali —— e quindi ogni casella di XP e di KC.',
        'Da mobile, o senza plugin: apri **My Team** su questo sito, leggi la tua parola chiave sulla scheda dello scatto di partenza, scrivila nella chat di gioco, fotografa il gioco con il tuo personaggio e la parola chiave visibili, e caricala su quella stessa scheda. Il caricamento vale subito —— puoi giocare appena è dentro, lo staff lo revisiona dopo. Se la scheda te lo chiede, disconnettiti e riconnettiti prima.',
      ],
    },

    notifications: {
      title: 'Notifiche Discord',
      intro:
        'Scattano che ci sia o meno un bingo in corso, e pubblicano nei canali del clan. Quale canale lo decidono gli admin —— tu scegli solo _cosa_ pubblicare. Con il prossimo aggiornamento del plugin queste scelte passano al sito, in **Settings → Discord posts & screenshots**, e ti seguono su ogni computer. Nella stessa pagina, **Screenshot privacy** sceglie quale chat (messaggi privati, chat pubblica, chat del clan) viene nascosta in ogni screenshot del plugin. Nel plugin restano due interruttori sotto **Notifications**: **Share clan posts** mette in pausa in un colpo solo tutti i post del gioco principale, e **Share seasonal activity** fa lo stesso su Leagues, Deadman e gli altri mondi stagionali.',
      examplesFigure: {
        caption: 'Com’è fatto un post',
        alt: 'Due post Discord di Anvil: un combat task Grandmaster con i punti e il progresso verso il prossimo sblocco, e una morte con il suo messaggio, ciascuno con uno screenshot del momento',
      },
      dropsFigure: {
        caption: 'Morti e kill · Drop e pet',
        alt: 'Le sezioni di notifica “Deaths and kills” e “Drops and pets” con ogni impostazione evidenziata e numerata',
        legend: [
          {
            label: 'Notify on death',
            body: 'pubblica nel canale dei morti del clan con uno screenshot del momento in cui sei morto.',
          },
          {
            label: 'Death message',
            body: 'la tua riga personale. `{name}` viene sostituito con il tuo RSN.',
          },
          {
            label: 'Notify on PvP kill',
            body: 'uno screenshot del tick in cui il bersaglio scende a 0 HP. Disattivato di default; qui attivo.',
          },
          {
            label: 'Notify on rare drops',
            body: 'l\'interruttore generale per i post dei drop.',
          },
          {
            label: 'Min drop value / Min drop rarity',
            body:
              'un drop viene pubblicato quando vale almeno questa cifra (GE o high alch, il maggiore dei due) oppure è più raro di 1-in-N. Anvil parte da 1m e 1/1,000. Il tuo clan può impostare valori predefiniti per i propri membri e, finché non imposti tu un numero, segui quelli del clan; **Reset to clan default** (o **Reset to Anvil default** se non hai un clan) torna a seguirli. Un clan può anche impostare una soglia di rarità rigida, che vale solo per i post nei propri canali. Il tuo numero non può essere più permissivo lì, e non cambia mai il limite di valore. Imposta un numero a 0 per disattivarlo.',
          },
          {
            label: 'Value and rarity together',
            body:
              'per impostazione predefinita un drop viene pubblicato quando soddisfa il valore **or** la rarità. Attiva **Require both** e deve soddisfare il valore **and** la rarità. Il tuo clan può scegliere questo come predefinito per i propri membri; finché non scegli tu, lo segui, e senza clan vale uno dei due. Ognuno dei tuoi webhook può anche impostare il proprio valore minimo, la rarità e either/both; tutto ciò che lascia vuoto segue le tue impostazioni.',
          },
          {
            label: 'Loot key value',
            body:
              'una chiave del loot viene pubblicata una sola volta, come singola notifica, quando tutto il suo contenuto supera questo numero.',
          },
          {
            label: 'Notify on pets',
            body: 'i pet vengono pubblicati nel canale dei drop rari.',
          },
        ],
      },
      caFigure: {
        caption: 'Combat achievement · collection log · livelli · diari · quest',
        alt: 'La sezione di notifica dei Combat achievement con ogni impostazione evidenziata e numerata',
        legend: [
          {
            label: 'CA post tier',
            body: 'il tier di task più basso che viene pubblicato; vengono pubblicati anche i completamenti di tier. Il valore predefinito è Master; Grandmaster pubblica solo i più rari, **Off** non pubblica nulla. Le caselle CA del bingo contano in ogni caso.',
          },
          {
            label: 'Notify on collection log slots',
            body: 'ogni nuovo slot del collection log.',
          },
          {
            label: 'Notify on level milestones',
            body: 'i level-up che il tuo clan ha scelto di annunciare —— di default i 99, ogni 100 livelli totali da 1800 in su, e il max. Le regole le decidono gli admin del clan; puoi pubblicare di meno (o impostare regole tue per i tuoi webhook personali) dalla sezione Announcements del tuo profilo.',
          },
          {
            label: 'Notify on diary completions',
            body: 'i tier degli achievement diary, con uno screenshot.',
          },
          {
            label: 'Quest post tier',
            body: 'le quest dalla difficoltà che scegli in su, da All (ogni quest) fino a Grandmaster; **Off** non ne pubblica nessuna. Il valore predefinito è Master. Le caselle quest del bingo contano in ogni caso.',
          },
        ],
      },
    },

    trouble: {
      title: 'Quando qualcosa si rompe',
      intro:
        'Il plugin te lo dice in chat quando il tracciamento si è fermato —— aspetta circa 90 secondi prima di lamentarsi e ripete al massimo ogni 5 minuti.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Il token è sbagliato o è stato rigenerato. Apri il menu **⋯** in cima al pannello Anvil, premi **Sign out**, poi di nuovo **Sign in with Discord** —— oppure usa **Paste a token instead** con un token nuovo da [Profilo → RuneLite plugin](/profile#plugin-token).',
        },
        {
          term: '`Anvil: can’t reach the site (anvilosrs.com) — tracking is OFF.`',
          body: 'Il plugin non riesce a raggiungere `anvilosrs.com`. Controlla la connessione internet ed eventuali firewall o VPN che potrebbero bloccare RuneLite. Se è tutto a posto, probabilmente il sito è giù per un momento —— il plugin si ricollega da solo.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Quell’account non è ancora collegato. Apri [Profilo → account rilevati](/profile#detected-accounts) per aggiungerlo o avviare la verifica della proprietà.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Niente. Si è ripreso da solo.',
        },
        {
          term: '“<RSN> belongs to another Anvil player”',
          body: 'Qualcun altro ha collegato questo personaggio su Anvil per primo, quindi dal tuo login non conta niente per lui. Se è davvero tuo, premi **This is my account** nella scheda **You** del pannello e supera il rapido controllo XP. Poi viene chiesto all’attuale proprietario, oppure decide lo staff di Anvil. Non saprai mai chi è. Segui la richiesta in [Settings → Ownership claims](/settings/claims).',
        },
      ],
      logHeading: 'Ancora bloccato? Manda un log a un admin',
      logBody:
        'Manda a un admin il tuo log di RuneLite: `client.log` nella cartella `.runelite/logs` dentro la tua cartella utente (su Windows, incolla `%USERPROFILE%\\.runelite\\logs` nella barra degli indirizzi di Esplora file). Il plugin ci scrive cosa ha visto e perché, così l’admin può vedere esattamente cosa è andato storto.',
      missingNote: {
        tag: 'Prove mancanti?',
        body: 'I pet e i Champion’s scroll doppi richiedono uno screenshot manuale. Il plugin lo scatta per te e lo salva in `.runelite/osrs-bingo-pending/` — **Copy folder path** nel pannello laterale di Anvil apre la cartella — così lo alleghi sul sito invece di cercare un’immagine dopo.',
      },
    },
    limits: {
      title: 'Limiti noti',
      intro:
        'Alcune cose non si possono tracciare alla perfezione — quasi sempre per ciò che riporta il gioco stesso, non Anvil. La soluzione è ogni volta la stessa: fai uno screenshot e inviala manualmente.',
      rows: [
        {
          term: 'Il barraging e le altre uccisioni multi-bersaglio',
          body: 'I conteggi di uccisioni (KC) arrivano da ciò che il gioco riporta a ogni uccisione, e gli incantesimi multi-bersaglio come Ice Barrage gliene fanno perdere alcune, quindi **il KC può risultare più basso** di quanto hai ucciso. Anche il Loot Tracker di RuneLite conta in difetto allo stesso modo — è un limite del motore di gioco, non un bug di Anvil.',
        },
        {
          term: 'Combat achievement già completati in passato',
          body: 'Attiva **repeat completion** nelle impostazioni dei Combat Achievements del gioco. Senza, il gioco non annuncia un compito già completato, e il plugin può accreditare solo ciò che il gioco annuncia.',
        },
        {
          term: 'Il combat achievement del contratto Yama',
          body: 'Il gioco non lo annuncia di nuovo nemmeno con repeat completion attivo, quindi il plugin non lo vede mai. Fai uno screenshot e invialo manualmente.',
        },
        {
          term: 'Caselle di raccolta senza il plugin',
          body: 'Le quantità di oggetti — un certo numero di pesci, minerali, tronchi — non sono negli hiscores, quindi solo il plugin le traccia. Senza, fai uno screenshot di ogni inventario; oppure, se l’oggetto compare nel Loot Tracker, uno screenshot azzerato a 0 all’inizio e un altro alla fine.',
        },
        {
          term: 'Implings, pesci, minerali e altri guadagni di oggetti',
          body: 'Catturare implings e raccogliere oggetti (pesci, minerali e tutto ciò che viene contato in base a ciò che finisce nel tuo inventario) **a volte non viene tracciato correttamente, anche con il plugin**. Conserva gli screenshot man mano, e se un conteggio sembra troppo basso, segnalalo e invia la differenza manualmente.',
        },
        {
          term: 'Barili per pesci, cesti per tronchi e altri contenitori',
          body: 'Le caselle di oggetti ottenuti contano solo ciò che arriva nell’inventario **direttamente dalla fonte** — un punto di pesca, una roccia, un albero. Tutto ciò che esce da un contenitore (svuotare un barile per pesci, un cesto per tronchi, una sacca di carbone o di gemme, un sacco di erbe), acquistato in un negozio, prelevato dalla banca o raccolto da terra **non conta**. Così la casella resta onesta: altrimenti lo stesso pesce potrebbe essere messo nel barile e tirato fuori all’infinito. Ciò che raccogli direttamente in un barile o cesto non viene contato.',
        },
        {
          term: "Pet e champion's scroll doppi",
          body: "Quando hai già il pet o lo scroll, il gioco dice solo che hai una **“funny feeling”** — non dice mai quale. Il plugin lo deduce da ciò che hai appena ucciso o allenato, accredita la casella e **la segnala allo staff per un controllo**. Se non può esserne sicuro — due pet dalla stessa fonte, o un pet senza un'uccisione o una skill dietro (Bloodhound da un master clue, un pet di Jad o Zuk ottenuto col sacrificio, Chompy chick) — salva lo screenshot in **Saved proofs** perché tu lo invii manualmente.",
        },
      ],
    },
    screen: {
      title: 'Sullo schermo mentre giochi',
      intro: 'Cosa disegna e stampa il plugin mentre giochi, e l’impostazione che controlla ciascuno.',
      rows: [
        {
          term: 'Caselle fissate',
          body: 'apri una casella nel pannello laterale e premi **Track on screen** (fino a 3). Con **Pinned tiles in one panel** attivo, condividono un unico piccolo pannello: il nome di ogni casella, il progresso della tua squadra e righe come _3/5 runs_ o quali parti di una combo sono completate. Disattivato, ognuna ha un widget più grande con i compagni di squadra e le altre squadre. Trascina con Alt per spostarlo. Clic destro per **Unpin** o **Unpin all**. Una casella completata mostra **Done**, poi si sgancia da sola.',
        },
        {
          term: 'La scheda starting shot',
          body: 'mentre un evento aspetta la tua starting shot, una scheda **Starting shot needed** in cima allo schermo dice dove andare e mostra ogni controllo in verde o in rosso: il relog, da quanto dura la tua sessione, quante caselle ti separano dal punto. Una freccia e un segnaposto sulla mappa del mondo (**Anvil starting shot**) ti portano lì. Con **Auto starting shot** attivo, la starting shot viene presa nel momento in cui tutto è verde; poi la scheda dice **You’re tracked** e se ne va. Impostazione: **Starting shot guide**.',
        },
        {
          term: 'Banner',
          body: '**Tile complete!** quando la tua squadra completa una casella, il progresso del tuo drop su una casella, e **New mission!**. Impostazioni: **Team completion popups** e **My tile popups**.',
        },
        {
          term: 'Tiri dei vestige',
          body: 'ai boss di Desert Treasure II, ogni unique stampa una riga con la tua posizione nella rotazione dei vestige, come _Roll 2 of 4_ o _the next unique is the vestige_. Dice _(estimated)_ finché non ti ha visto ottenere un vestige. Nessuna impostazione; funziona con o senza evento.',
        },
        {
          term: 'Completamento automatico di Lookup',
          body: 'scrivendo nella casella **Lookup** il nome si completa da solo, con le tue ricerche recenti, gli amici, i compagni di clan online e i giocatori vicini. **Enter** accetta. Legge solo il tuo client; non viene inviato nulla.',
        },
        {
          term: 'Colori della chat',
          body: '**[Anvil] tag colour** e **Message colour** sotto **Chat messages**. Finché non scegli, diventano oro scuro e nero su una chatbox opaca, così restano leggibili. Passa sopra il nome di un Supporter in chat per vederne il livello, come _Anvil Patron_.',
        },
      ],
    },
    sync: {
      title: 'Sincronizzazione del profilo, e cos’altro invia',
      intro: 'Le impostazioni **Profile sync** riempiono il tuo profilo Anvil. Sono tutte e quattro attive all’inizio:',
      rows: [
        {
          term: 'Sync collection log',
          body: 'ogni pagina del collection log che apri viene inviata al tuo profilo.',
        },
        {
          term: 'Sync the whole log on open',
          body: 'aprire il collection log invia tutto, non solo la pagina che guardi. Per farlo a richiesta, premi il pulsante **Anvil** nella barra del titolo del collection log, oppure **Sync profile** nel pannello laterale mentre il log è aperto. La chat lo conferma: _Profile synced — N collection log slots._',
        },
        {
          term: 'Sync personal bests',
          body: 'tempi di boss e raid vengono inviati man mano che li imposti.',
        },
        {
          term: 'Import existing bests once',
          body: 'una volta per personaggio, copia i personal best che RuneLite ha già salvato sul tuo computer: _Imported N personal best(s) from RuneLite._',
        },
        {
          term: 'Share highlights with the clan',
          body: 'i tuoi pet, i drop importanti, le morti, i task di combattimento, i traguardi di livello, i nuovi slot del log e i diari compaiono nel feed del sito del tuo clan, e nel feed della chat dei giocatori che possono vederli.',
        },
      ],
      outro: 'Altre tre cose vengono inviate senza un’impostazione propria. **Chi ti ha ucciso**: il mostro o il giocatore che ti aveva come bersaglio negli ultimi 15 secondi viene nominato nel feed. **Contatori di gioco**: alcune caselle di uccisione contano un numero che il gioco tiene, come i punti Tithe Farm, la reputazione della Giants’ Foundry, i delve di Doom o le serie di slayer; contano solo gli aumenti. **Leagues, Deadman e altre modalità**: su quei mondi vengono inviate le righe del gioco su reliquie, aree e task, così il tuo clan può pubblicarle nel canale della modalità.',
    },
  },

  admin: {
    metaTitle: 'Organizzare il primo evento — guida admin di Anvil',
    metaDescription:
      'Configura un clan su Anvil e porta un bingo dall’inizio alla fine: Discord, sincronizzazione del roster, tabelloni, caselle, squadre e draft, avvio, e cosa succede dopo la fine.',
    eyebrow: 'Anvil · per lo staff del clan',
    title: 'Organizzare il primo evento',
    dek: 'Tutto il percorso, nell’ordine in cui lo farai davvero: configurare {clanName}, portare dentro il roster, costruire un tabellone, comporre le squadre, far partire la cosa e distribuire i premi. Grosso modo il lavoro di una serata per il primo bingo —— minuti per il secondo.',
    facts: [
      { strong: '5 passi', rest: 'nella lista di controllo di configurazione' },
      { strong: '7 formati', rest: 'da cui costruire un tabellone' },
      { strong: '1 pulsante', rest: 'per sincronizzare il roster' },
    ],
    footnote:
      'Questa guida segue l’app così com’è oggi. Se una schermata qui non corrisponde a quella che stai guardando, ha ragione l’app e la guida è vecchia —— [segnalacelo](/feedback) e la sistemiamo.',

    access: {
      title: 'Chi può fare cosa',
      intro:
        'Si accede tutti con Discord —— non ci sono password. Il primo admin è il proprietario, cioè chi ha creato il clan; dopo di che è un admin a promuovere le persone da **People → Staff & roles**. I ruoli si sommano verso il basso: tutto ciò che può fare un moderatore lo possono fare anche un tesoriere e un admin.',
      rows: [
        {
          term: 'Admin',
          body: 'accesso completo —— eventi, caselle, squadre, impostazioni, staff, premi. Dallo a quante meno persone il clan riesca a tollerare.',
        },
        { term: 'Tesoriere', body: 'tutto ciò che può fare un moderatore, più le quote d’iscrizione e i premi.' },
        {
          term: 'Moderatore',
          body: 'la quotidianità: roster, verifiche, prove da controllare, competizioni settimanali, il calendario e gli eventi del clan. Non può creare né modificare eventi.',
        },
        {
          term: 'Editor',
          body: 'solo la scrittura delle caselle. Puoi concederlo in generale o limitarlo a tabelloni specifici, così un costruttore ospite tocca soltanto l’evento che gli hai affidato.',
        },
        { term: 'Membro', body: 'gioca; nessuna interfaccia di amministrazione.' },
      ],
      seeAlso:
        'Due di questi ruoli hanno una pagina tutta loro: [Di turno]({moderatorGuide}) per cosa fa davvero un moderatore della sua serata, e [Quote e premi]({feesGuide}) per il tesoriere.',
      ownerNote: {
        tag: 'Proprietario',
        body: 'Un account è il proprietario. Nessun altro può degradarlo ed è l’unico ruolo che può cedere la proprietà —— così perdere una discussione con un co-admin non può mai costarti il clan.',
      },
    },

    setup: {
      title: 'Dai un nome al clan, collega Discord',
      intro:
        '**Settings → Finish setup** è una procedura guidata breve (resta nel menu finché non hai finito), e la dashboard tiene una lista di controllo in cinque passi finché non sono fatti: nomina il clan, collega Discord, carica i tuoi membri, crea un evento, aggiungi caselle. Lo stato è calcolato su dati reali, quindi un passo si spunta solo quando è davvero concluso.',
      discord:
        'Per Discord hai due strade, e si combinano: dai ad Anvil un **bot** e potrà creare webhook, sincronizzare ruoli e nickname e costruire canali privati per le squadre; dagli un singolo **URL di webhook** e potrà pubblicare annunci e nient’altro. Parti dal webhook se vuoi essere operativo in due minuti, aggiungi il bot quando vuoi l’automazione.',
      permsNote: {
        tag: 'Permessi del bot',
        body: 'Il bot ha bisogno dei permessi _Gestisci webhook_, _Gestisci ruoli_, _Gestisci canali_ e _Gestisci nickname_, e il suo ruolo deve stare _sopra_ i ruoli che gestisce nell’elenco dei ruoli del tuo server. Altrimenti Discord rifiuta in silenzio.',
      },
      hosted:
        'Con un piano ospitato quella schermata l’hai già incontrata una volta: aggiungere il bot durante la configurazione è il modo in cui Anvil ha capito qual è il tuo server, quindi non c’è mai stato un ID da copiare. Lo stesso link è qui ogni volta che vuoi spostare il bot su un altro server.',
    },

    channels: {
      title: 'Dividi i post su più canali',
      body: [
        'Di base tutto finisce in un unico canale catch-all. Quando diventa rumoroso, apri **Discord → What goes where** e dai una casa propria alle categorie chiassose —— post degli eventi, competizioni settimanali, drop rari, morti, kill PvP, combat achievement. Tutto ciò che lasci vuoto ricade sul suo catch-all, quindi puoi separare una categoria alla volta.',
        'Con il bot collegato non tocchi mai un URL di webhook: scegli un canale dal menu della riga e si salva da solo. Su un evento affollato puoi aggiungere un secondo webhook con **Add another** sotto **Post without a bot** —— Anvil li alterna così il rate limit di Discord non si mangia i post.',
      ],
      clipsNote: {
        tag: 'Il canale delle clip è diverso',
        body: 'I video delle clip vengono caricati direttamente dal PC di ogni giocatore a Discord —— non passano mai da questo sito. Quindi il webhook delle clip che imposti qui è quello che _distribuisci_: sono i membri a incollarlo nel proprio plugin. Tutto il resto in questa pagina sta sul server e i membri non lo vedono mai.',
      },
    },

    roster: {
      title: 'Porta dentro il roster',
      body: [
        'L’appartenenza al clan viene da un solo posto: una sincronizzazione del roster in gioco. Installa il [plugin RuneLite di Anvil]({pluginGuide}) sull’account di un _admin_, apri la finestra del clan in gioco e premi il pulsante **Anvil** nella sua barra del titolo. Questo manda al sito la lista reale del tuo clan in un clic.',
        'Accedere, collegare un personaggio o giocare con il plugin non mette mai nessuno nel roster. Se il plugin vede qualcuno giocare nel tuo clan in gioco prima che il roster lo abbia, crea una richiesta di adesione; chiunque altro può chiedere con **Apply** sulla pagina del tuo clan. Lo staff risponde alle richieste in cima a **People → Roster**, e **People → Who can join** decide se le persone aspettano un sì, ricevono subito un posto da ospite o non possono chiedere affatto. È voluto: nessuno entra nel tuo clan digitandone il nome. Il quadro completo è in [La tua gente]({peopleGuide}).',
        'Puoi anche aggiungere qualcuno a mano da **People → + Add Manually**, e iscriverlo a un evento per conto suo con **Add member** nella pagina **Sign-ups** dell’evento quando non riesce a raggiungere il sito.',
      ],
    },

    board: {
      title: 'Crea il primo tabellone',
      intro:
        '**Events → All events → + New event**. Scegli prima il formato —— decide come viene assegnato il punteggio e cosa ti chiederà il resto del modulo.',
      formats: {
        classic: { label: 'Bingo classico', blurb: 'Una griglia quadrata N×N —— le squadre completano le caselle nell’ordine che vogliono, ognuna vale 1.' },
        leagues: { label: 'Bingo Leagues', blurb: 'Una lista di compiti dove ogni casella porta un valore in punti —— quante caselle vuoi.' },
        race: { label: 'Corsa a caselle', blurb: 'Un percorso ordinato —— le squadre raggiungono le caselle in sequenza; vince chi arriva più lontano. L’organizzatore può ramificarlo in percorsi che si dividono e si riuniscono: la casella che completi sceglie la tua strada.' },
        showdown: {
          label: 'Showdown',
          blurb:
            'Le caselle restano nascoste fino all’orario previsto —— imposta ogni orario di apertura nella scheda Tiles. A punti, stile DMM All Stars.',
        },
        luckydraw: {
          label: 'Estrazione',
          blurb: 'Un tabellone che si chiama da sé: le caselle nascoste si aprono a estrazioni casuali a intervallo fisso. A punti.',
        },
        bounty: {
          label: 'Caccia alla taglia',
          blurb:
            'Una sola casella aperta per volta —— la prima squadra che la completa si prende i punti e viene estratta la taglia successiva.',
        },
        ladder: {
          label: 'Classifica',
          blurb:
            'Una lista di compiti a punti ordinata come classifica individuale (squadre facoltative). I compiti ruotano —— progressivi, uno alla volta o a finestra scorrevole —— e possono perdere valore. Stile classifica mensile.',
        },
      },
      outro:
        'Poi imposta le date, la finestra di iscrizione e se le iscrizioni prevedono una quota. Parti da un modello se preferisci non partire da una griglia vuota —— la galleria contiene sia i preset integrati sia ogni tabellone che hai già salvato come modello.',
      seeAlso:
        'Il formato è solo metà della decisione —— l’altra metà è come le caselle diventano giocabili, e le due cose si combinano. Entrambe per esteso: [Formati, e come si aprono le caselle]({formatsGuide}).',
      utcNote: {
        tag: 'Le date sono in UTC',
        body: 'Ogni orario in Anvil è salvato e confrontato in UTC, e mostrato nell’ora locale di chi guarda. Imposta l’orario di fine che intendi davvero; il sito mostrerà a un inglese e a un australiano due orologi diversi per lo stesso istante.',
      },
    },

    tiles: {
      title: 'Riempi il tabellone',
      body: [
        'La pagina **Board & tiles** dell’evento è dove un tabellone diventa un bingo. Ogni casella è un solo _tipo_ di compito, e il tipo decide cosa cerca il plugin: un drop, un killcount di boss, XP di skill, l’uccisione di un NPC, un clear a tempo, un achievement diary, un Combat Achievement, uno sblocco del Collection Log, una kill PvP, un guadagno d’inventario o una run senza morti. Le caselle manuali —— quelle che una persona verifica da uno screenshot —— restano sempre un’opzione.',
        'Per un tabellone intero, scrivile in blocco: esporta il foglio, compilalo in un foglio di calcolo e reimportalo. CSV e .xlsx fanno entrambi il giro completo, e le righe corrispondono alle posizioni, così puoi riscrivere un’intera griglia da 25 caselle in un solo incolla.',
      ],
      rows: [
        {
          term: 'Fasce di difficoltà',
          body: 'i valori in punti si mappano su fasce con un nome (easy → elite). Modifica le fasce in **Clan settings → Rules & scoring → Difficulty & balance** se il tuo clan valuta diversamente.',
        },
        {
          term: 'Revisore di equilibrio',
          body: 'controlla un tabellone finito cercando problemi strutturali e sforzo mal distribuito prima che i giocatori lo vedano.',
        },
        {
          term: 'Nascosto fino allo svelamento',
          body: 'i tabelloni nuovi nascono nascosti. Lo staff li vede sempre; i giocatori non vedono nulla finché non lo sveli —— così un tabellone può essere costruito allo scoperto senza rovinare la sorpresa.',
        },
      ],
      seeAlso:
        'Quale tipo scegliere, come scriverne duecento in un foglio di calcolo, e gli errori che si importano bene e poi non scattano mai: [Costruire un tabellone che si registra da solo]({boardGuide}).',
    },

    teams: {
      title: 'Squadre e draft',
      body: [
        'La pagina **Teams & draft** si adatta al formato che hai scelto: un formato che non usa squadre la salta del tutto. Per un normale bingo a squadre crei le squadre, decidi chi le capitana e o assegni tu i giocatori o fai un draft dal vivo.',
        'I capitani pescano dal pool delle iscrizioni nell’ordine che hai stabilito, e ognuno vede le risposte date nel modulo d’iscrizione —— congelate come sono state inviate, così nessuno modifica le proprie “ore a settimana” dopo essere stato scelto.',
      ],
      placementIntro:
        'Non sei obbligato a fare un draft. **Team placement**, nel modulo di creazione e nella scheda **Sign-ups**, decide dove finisce ogni nuova iscrizione:',
      placementRows: [
        {
          term: 'Auto-balance',
          body: 'ogni persona che si iscrive entra nella squadra con meno giocatori. Tu scegli solo quante squadre. Ottimo per grandi eventi pubblici.',
        },
        {
          term: 'Players pick',
          body: 'prima crei le squadre, e ogni giocatore ne sceglie una nel modulo d’iscrizione. Imposta un limite per squadra per tenerle equilibrate.',
        },
        {
          term: 'Host drafts',
          body: 'tutti aspettano in un pool finché tu o i tuoi capitani non li scegliete nel draft o li assegnate a mano. Ideale quando conosci i giocatori.',
        },
        {
          term: 'Solo',
          body: 'nessuna squadra. Ogni giocatore gioca per conto suo, con il nome del suo personaggio, e la classifica ordina i giocatori.',
        },
      ],
      lockNote: {
        tag: 'Il draft blocca il roster',
        body: 'Una volta avviato un draft, l’insieme delle squadre e l’ordine di scelta sono congelati. Aggiungi la squadra che hai dimenticato _prima_ di premere avvio, non dopo.',
      },
      seeAlso:
        'Manda ai tuoi capitani [la guida del capitano]({captainGuide}) prima della serata del draft —— la sala operativa è utilissima nei giorni precedenti, e nessuno legge una schermata nuova mentre scorre un cronometro.',
      visitingClans:
        'Giocate contro un altro clan invece di fare il draft interno? Una squadra in visita schiera il proprio roster con un solo link, e il loro moderatore lo gestisce senza un account admin qui —— vedi [Ospitare un clan in visita]({clanVsClanGuide}).',
    },

    launch: {
      title: 'Avvialo e gestiscilo',
      body: [
        'Svela le caselle, poi avvia l’evento. Anvil si rifiuta di avviare un tabellone non pronto —— un draft ancora in corso, o giocatori senza squadra —— e ti dice quale. Se sai quello che fai (una sfida amichevole, una ripetizione, un tabellone di prova) puoi forzarlo.',
        'Da lì in poi va avanti quasi da solo. Il plugin assegna automaticamente tutto ciò che vede e pubblica screenshot di prova con impressi la squadra e un orario UTC. Quello che resta a te è:',
      ],
      rows: [
        {
          term: 'Prove da verificare',
          body: 'le caselle manuali e tutto ciò che il plugin ha segnalato. Approva o rifiuta con la prova davanti.',
        },
        {
          term: 'Statistiche',
          body: 'la scheda Stats dell’evento mostra il contributo per giocatore —— utile quando una squadra discute su chi ha trascinato chi.',
        },
        {
          term: 'Annunci',
          body: '**Post to Discord** (sotto **Clan** nel menu) pubblica un messaggio in qualsiasi canale come il bot a evento in corso, senza scrivere un webhook a mano.',
        },
      ],
      missionNote: {
        tag: 'Sorprese a evento in corso',
        body: 'Puoi lanciare una **missione** su un bingo già avviato —— una casella bonus nascosta che viene annunciata quando la fai partire, eventualmente con valore calante o con scadenza. È il modo più economico di risvegliare un tabellone al quinto giorno.',
      },
      startProofNote: {
        tag: 'Fermare l’accumulo prima dell’evento',
        body: [
          'Attiva lo **scatto di partenza** (evento → Home → **Extras**) e ogni giocatore dovrà consegnare uno screenshot fatto dopo l’avvio dell’evento, in un luogo che Anvil estrae nel momento della partenza —— così nessuno può presentarsi al T0 seduto su una settimana di clue e forzieri in banca. Il luogo viene annunciato con la partenza; la parola chiave di ogni giocatore è personale, deriva dall’estrazione e non esiste prima dell’avvio, quindi nessuno può prepararla in anticipo.',
          'Fissa i punti sulla mappa del mondo (l’editor del pool ne ha una) e il plugin controlla che i giocatori siano davvero lì, invece di limitarsi a dirglielo. Puoi anche richiedere una **sessione fresca** —— 15 minuti di base: gli hiscores si salvano solo al logout, quindi far rientrare tutti subito prima dello scatto è ciò che rende onesti i totali iniziali dietro ogni casella di XP e di KC.',
          'Chi usa il plugin preme un pulsante. Tutti gli altri scrivono la parola chiave in gioco e caricano da My Team. Sei tu a scegliere cosa succede a un credito di chi non ha consegnato: segnalarlo per revisione (predefinito) o rifiutarlo finché non lo fa. Lo stesso pannello nella Home dell’evento è la lista di revisione —— le catture del plugin con parola chiave verificata arrivano già accettate, quindi in pratica guardi solo i giocatori da telefono.',
        ],
      },
    },

    after: {
      title: 'Dopo l’ultima casella',
      intro:
        'Quando scade il tempo il tabellone si congela e l’evento si blocca —— punti, contributi e chi-ha-fatto-cosa restano com’erano. Se devi sistemare qualcosa dopo, un admin può sbloccarlo deliberatamente.',
      rows: [
        {
          term: 'Premi',
          body: 'la pagina **Prizes** dell’evento trasforma il montepremi in una lista di chi prende cosa, spuntata man mano che paghi.',
        },
        {
          term: 'Riepilogo',
          body: 'una pagina pubblica con la classifica finale e i premi di fine evento —— il drop più grosso, più kill, e il resto.',
        },
        {
          term: 'Sondaggio',
          body: 'chiedi al clan cosa ne pensa. Costruiscilo nella scheda Survey; i giocatori rispondono a evento finito e solo lo staff vede i risultati.',
        },
        {
          term: 'Salva come modello',
          body: 'conserva il tabellone appena costruito, da **Settings → More** dell’evento. Il prossimo bingo parte da lì invece che da una griglia vuota.',
        },
      ],
      federation:
        'Con la federazione attiva, i membri possono anche collegarsi ad altri clan Anvil dal plugin —— comodo per gli eventi tra clan, e del tutto facoltativo per ciascun membro.',
      outro: 'Poi indirizza i tuoi membri alla [guida per i giocatori]({pluginGuide}) e comincia a pensare al prossimo.',
    },
    survey: {
      title: 'Chiedi ai giocatori',
      intro: 'Attiva **Post-event survey** sotto **Features**, poi apri la pagina **Survey** dell’evento.',
      body: [
        'Sotto **Build**, aggiungi domande: **Rating (1–5)**, **Free text**, **Choose one** o **Choose many**, ognuna facoltativamente **Required**. Oppure carica un modello: **Bingo wrap-up**, **Quick pulse**, **PvM mass**, **Raid team** o **Skilling / social**. **Preview the participant view** mostra il sondaggio come lo vede un giocatore.',
        'Si apre quando l’evento finisce, solo per i partecipanti approvati, e possono cambiare le risposte in seguito. **Results** mostra le risposte **By question** o **By person**. Non è anonimo: lo staff vede chi ha detto cosa.',
      ],
    },
  },

  clanVsClan: {
    metaTitle: 'Ospitare un clan in visita — guida di Anvil per chi ospita',
    metaDescription:
      'Organizza un clan contro clan su Anvil: dai a ogni clan in visita un link d’invito che sistema i suoi giocatori in una sola squadra, e un posto nello staff perché il loro moderatore gestisca la propria metà.',
    eyebrow: 'Anvil · per chi ospita',
    title: 'Ospitare un clan in visita',
    dek: 'Il tabellone lo ospiti tu; il roster lo schierano loro. Questo è il percorso che evita di raccogliere una dozzina di RSN nei messaggi privati —— un link per squadra, e un posto che permette al loro moderatore di gestire la sua metà dell’evento.',
    facts: [
      { strong: '1 link', rest: 'per squadra in visita' },
      { strong: '0 posti da admin', rest: 'dati a estranei' },
      { strong: '~5 min', rest: 'per clan che inviti' },
    ],
    footnote:
      'Gli screenshot vengono da una configurazione reale su un tabellone di prova —— i token degli inviti e i nomi Discord sono oscurati. Un link vero va custodito: chiunque lo abbia può prendere posto in quella squadra finché è attivo.',

    teamCompsLine: "Vuoi che i clan si sfidino su skill o boss? Vedi [Competizioni a squadre]({teamCompsGuide}).",

    shape: {
      title: 'Cosa stai preparando',
      body: [
        'Un clan contro clan è un evento normale con una differenza: metà dei giocatori non è nel tuo clan e non ci sarà mai. Non puoi sincronizzarli dal roster, non vuoi promuoverli, e di certo non vuoi iscriverne venti a mano e poi trascinarli uno a uno nella squadra giusta.',
        'Due pezzi risolvono la cosa, e sono indipendenti —— usane uno, o entrambi.',
      ],
      rows: [
        {
          term: 'Un link d’invito',
          body: 'un URL che generi una volta per una squadra. Chi lo apre accede, compila il normale modulo d’iscrizione e finisce in quella squadra già approvato —— niente pool del draft, niente coda di approvazione.',
        },
        {
          term: 'Un posto nello staff della squadra',
          body: 'una persona precisa che può gestire _quella sola squadra_ —— il suo roster, le sue prove, le sue quote —— senza un account admin qui, e senza togliere il posto di capitano a chi sta davvero giocando.',
        },
      ],
      note: {
        tag: 'Cosa un invito non è',
        body: 'Non è un accesso e non è una scorciatoia che salta la verifica. Chi lo apre accede comunque con Discord e ha comunque bisogno di un RSN verificato, esattamente come qualsiasi altra iscrizione. Le uniche cose che il link decide sono _in quale squadra_ entra l’iscrizione e che non serve l’approvazione di nessuno.',
      },
    },

    team: {
      title: 'Prima crea la squadra',
      body: [
        'Apri il tuo evento e vai alla pagina **Teams & draft**. Crea una squadra per ogni clan che hai invitato e chiamala col loro nome —— il nome è ciò che i loro giocatori vedono sul modulo d’iscrizione, quindi “Ironforge” batte “Team 2”.',
        'Non _devi_ fare un draft. I link d’invito e il draft sono alternative: un draft distribuisce un pool comune di iscritti, un link sistema le persone direttamente. In un clan contro clan puro la maggior parte di chi ospita crea le squadre, distribuisce un link ciascuna e non apre mai il draft.',
        'Poi apri la squadra stessa —— **Teams & draft → la squadra** —— che è dove vivono entrambi i due passi successivi.',
      ],
      captainNote: {
        tag: 'Prima il capitano',
        body: 'Nomina il capitano della squadra in visita prima di consegnare il link, così la pagina della squadra ha un responsabile fin dall’inizio. Nominare un capitano lo mette anche in squadra; se la scheda ti avverte che non è nel roster, accetta la correzione che ti propone.',
      },
    },

    staff: {
      title: 'Dai un posto al loro moderatore',
      body: [
        'Il pannello **Team staff** nella pagina della squadra è il modo in cui il moderatore del clan in visita si mette al lavoro senza che tu gli conceda nulla sul tuo sito. Premi **Add someone**, cercalo, aggiungi una nota tipo “moderatore di Ironforge” così il prossimo admin capisce perché è lì, e premi **Give a seat**.',
      ],
      figure: {
        caption: 'Evento → Teams & draft → la squadra → Team staff',
        alt: 'Il pannello Team staff con un posto assegnato e la ricerca “add someone” aperta',
        legend: [
          {
            label: 'Add someone',
            body: 'apre la ricerca. Possono comparire solo le persone che hanno effettuato l’accesso qui con Discord almeno una volta —— vedi la nota qui sotto.',
          },
          {
            label: 'La nota',
            body: 'testo libero, 120 caratteri. Scrivi da quale clan viene. I posti restano nell’elenco anche dopo l’evento, e “chi è questa persona” è la domanda che ti farai fra tre mesi.',
          },
          {
            label: 'Remove',
            body: 'ritira il posto all’istante. Fallo alla fine dell’evento —— un posto non ha una scadenza automatica.',
          },
        ],
      },
      canDo: 'Cosa può fare un posto, solo su quella squadra:',
      canDoList: [
        'vedere e gestire il roster della squadra',
        'occuparsi delle sue prove e dei suoi invii',
        'segnare come pagate le quote dei suoi giocatori',
        'generare link d’invito per essa, se lo attivi (fra due passi)',
      ],
      cantDo: 'Cosa non può mai fare:',
      cantDoList: [
        'toccare qualsiasi altra squadra',
        'modificare il tabellone o le sue caselle',
        'fare scelte al draft',
        'sostituire qualcuno a evento avviato',
      ],
      note: {
        tag: 'Devono prima accedere qui una volta',
        body: 'La ricerca elenca solo account con un Discord collegato —— un posto è legato a una persona che può davvero accedere. Quindi manda il moderatore in visita su questo sito, faglielo premere **Login** una volta, e _poi_ concedi il posto. Se non compare nella ricerca, quell’accesso non è ancora avvenuto.',
      },
    },

    link: {
      title: 'Genera il link d’invito',
      body: [
        'Sempre nella pagina della squadra, il pannello **Invite links** crea il link. Due campi decidono cosa promette il link, e in entrambi `0` significa “non prometto nulla”.',
      ],
      figure: {
        caption: 'Evento → Teams & draft → la squadra → Invite links',
        alt: 'Il pannello Invite links con i campi dei posti e della scadenza, il pulsante Make a link e un link attivo in elenco',
        legend: [
          {
            label: 'Posti e scadenza',
            body: 'quante persone può far entrare il link (fino a 100) e per quanto resta valido (fino a 30 giorni). Metti i posti pari al roster che ti hanno promesso e il link si chiude da solo quando sono tutti dentro; metti una scadenza quando il link finisce in un Discord pubblico. `0` in uno dei due campi significa nessun limite.',
          },
          {
            label: 'Make a link',
            body: 'lo genera e lo copia subito negli appunti. Incollaglielo prima di fare qualsiasi altra cosa.',
          },
          {
            label: 'L’elenco attivo',
            body: 'tutti i link che questa squadra ha in giro, con quante persone sono entrate e quanti posti restano. **Copy** lo riprende; **Turn off** lo annulla per sempre.',
          },
        ],
      },
      shape: 'Il link ha la forma `{origin}/events/{eventId}/join/{token}` —— una riga sola, tranquillamente incollabile in un messaggio Discord.',
      note: {
        tag: 'Valori sensati',
        body: 'Per un clan contro clan in cui hai concordato il roster con un solo moderatore, lascia entrambi i campi a `0` e lascia che se lo gestisca. Ricorri a posti e scadenza quando il link va in un posto che non controlli.',
      },
      revoke:
        'Disattivare un link è immediato e non rimuove chi è già entrato —— ora sono giocatori normali di quella squadra. Per toglierne uno, usa il roster della squadra.',
    },

    captains: {
      title: 'Lascia che generino i propri link',
      body: [
        'Di base solo chi ospita può creare link, e a un capitano che ci prova viene detto. Quel valore predefinito è giusto per un normale evento di clan —— un capitano che distribuisce posti riempirebbe un roster che nessuno ha approvato —— ed è sbagliato per un clan contro clan, dove la squadra in visita conosce il proprio roster meglio di te.',
        'L’interruttore è nello stesso pannello **Invite links**: **Let captains make their own links**. Vale per _ogni squadra di questo evento_, non solo per quella che stai guardando, che è esattamente ciò che serve quando entrambe le parti sono clan in visita.',
        'Con l’interruttore attivo, il capitano della squadra e chiunque abbia un posto nello staff possono generare link da **My Team → Invite links**. Hanno lo stesso pannello che hai tu, meno l’interruttore.',
      ],
      figure: {
        caption: 'My Team → la squadra → Invite links',
        alt: 'La scheda Invite links lato capitano nell’hub della squadra, con i campi posti e scadenza e un link attivo',
        legend: [
          {
            label: 'Stesso pannello, vista del capitano',
            body: 'genera, copia, disattiva. Se chi ospita non ha attivato l’interruttore, qui si legge “Only a host can make links for this event” e i campi spariscono.',
          },
          {
            label: 'L’elenco attivo',
            body: 'un capitano che non può generare vede comunque i link che la sua squadra ha in giro —— così può chiedertene un altro invece di dare per scontato che non ce ne siano.',
          },
        ],
      },
    },

    player: {
      title: 'Cosa vedono i loro giocatori',
      intro: 'Vale la pena percorrerlo tu una volta prima di consegnare il link, così sai rispondere alle domande.',
      steps: [
        'Aprono il link. Se non hanno effettuato l’accesso, accedono con Discord e tornano subito indietro —— il link non si perde per strada.',
        'Atterrano sul normale modulo d’iscrizione, con una fascia che dice **You’re joining {teamExample} by invite**. Stesse domande, stesso selettore di account, stessa quota di chiunque altro.',
        'All’invio sono in quella squadra, approvati. Nessuna azione da parte tua, nessun draft.',
      ],
      figure: {
        caption: 'Il modulo d’iscrizione, aperto tramite link d’invito',
        alt: 'Il modulo d’iscrizione all’evento con una fascia che dice che il giocatore entra su invito in una squadra indicata per nome',
        legend: [
          {
            label: 'La fascia dell’invito',
            body: 'nomina la squadra in cui stanno per entrare. Se nomina la squadra sbagliata, hanno il link sbagliato —— fermati e controlla prima di inviare.',
          },
          {
            label: 'Il resto del modulo',
            body: 'invariato. Serve comunque un RSN verificato, le domande d’iscrizione vengono comunque poste, e la quota d’iscrizione si applica comunque.',
          },
        ],
      },
      note: {
        tag: 'Già iscritto?',
        body: 'Se qualcuno si è iscritto normalmente prima ed è nel pool, aprire il link lo sposta nella squadra invece di creare una seconda iscrizione. Chi è già approvato in un’altra squadra viene lasciato stare —— spostalo dal roster.',
      },
    },

    dead: {
      title: 'Quando un link smette di funzionare',
      intro:
        'Un link rifiutato si spiega sulla pagina invece di dare 404, così chi ce l’ha può dirti di quale caso si tratta.',
      rows: [
        {
          term: 'This invite has been turned off.',
          body: 'Qualcuno ha premuto **Turn off**. Generane uno nuovo —— un link vecchio non torna mai.',
        },
        {
          term: 'This invite has expired.',
          body: 'Ha raggiunto le ore che avevi impostato. Generane un altro, stavolta con `0` ore se la scadenza non serve a niente.',
        },
        {
          term: 'This invite is full.',
          body: 'Tutti i posti sono occupati. Alzali generando un nuovo link con più posti —— il numero di posti è fissato quando il link nasce.',
        },
        {
          term: 'Sign-ups for this event aren’t open.',
          body: 'L’unico che può risolversi da solo. Controlla la finestra di iscrizione dell’evento: già aperta, scadenza passata, oppure evento già iniziato.',
        },
        {
          term: 'That invite belongs to a different event.',
          body: 'È stato incollato un link di un altro tabellone. Controlla che l’id dell’evento nell’URL sia quello giusto.',
        },
      ],
      checklist: 'Prima dell’evento, percorri questa lista una volta per ogni clan in visita:',
      checklistItems: [
        'la loro squadra esiste e porta il loro nome',
        'il loro capitano è nominato e seduto in squadra',
        'il loro moderatore ha effettuato l’accesso qui e ha un posto nello staff',
        'il link è generato, copiato e davvero consegnato a una persona',
        'la finestra di iscrizione è aperta per tutto il tempo che serve loro',
      ],
      note: {
        tag: 'Quando è finita',
        body: 'Disattiva i link e rimuovi i posti nello staff. Nessuno dei due scade da solo, e un link attivo su un evento concluso è solo un filo lasciato pendere.',
      },
    },
    cohost: {
      title: 'Se sei il co-ospite',
      intro: 'Tutto quanto sopra è il lato dell’ospite. Lo staff del clan in visita ha una sua pagina per l’evento, **Co-hosted with <host>**. L’ospite mantiene le date, la bozza, le squadre e chi può vederle.',
      rows: [
        {
          term: 'Le iscrizioni del tuo clan',
          body: '**Approve**, **Reject** o **Withdraw** i giocatori del tuo clan. Non vedi né tocchi mai quelli dell’ospite.',
        },
        {
          term: 'Il tabellone',
          body: 'puoi modificarlo solo se l’ospite l’ha concesso al tuo staff. Altrimenti puoi **Suggest a tile**: la casella, i dettagli e i punti, fino a 25 in attesa alla volta. Ognuna compare come **waiting**, **accepted ✓** o **turned down** con il motivo dell’ospite.',
        },
        {
          term: 'La tua squadra',
          body: '**Manage** la squadra del tuo clan.',
        },
        {
          term: 'Discord',
          body: 'gli admin del tuo clan scelgono cosa arriva al proprio server: **Everything shared**, **Big moments** o **Nothing**, quale canale, chi viene menzionato e se i giocatori ricevono il ruolo **@Bingo player**.',
        },
      ],
    },
  },

  board: {
    metaTitle: 'Costruire un tabellone — guida di Anvil alla scrittura delle caselle',
    metaDescription:
      'Scrivi caselle da bingo che si registrano da sole: cosa vede davvero ogni tipo di casella, la scrittura in blocco con un foglio di calcolo, e gli errori che falliscono in silenzio.',
    eyebrow: 'Anvil · per chi costruisce i tabelloni',
    title: 'Costruire un tabellone che si registra da solo',
    dek: 'Una casella è la promessa che qualcosa verrà notato. Questo è ciò che ogni tipo riesce davvero a vedere, come scriverne duecento senza perderci la serata, e quella manciata di errori che falliscono in silenzio —— la casella semplicemente non scatta mai, e nessuno se ne accorge fino al quarto giorno.',
    facts: [
      { strong: '15 tipi', rest: 'uno per casella, mai mescolati' },
      { strong: '1000 caselle', rest: 'per tabellone, via foglio di calcolo' },
      { strong: 'In silenzio', rest: 'è come fallisce una casella sbagliata' },
    ],
    footnote:
      'Il formato del foglio è specificato per intero in `docs/tile-authoring.md`, scritto per chiunque (o qualunque cosa) stia generando le righe. Questa pagina è la metà umana: quale tipo scegliere, e cosa va storto.',

    kinds: {
      title: 'Una casella, un tipo',
      body: [
        'Ogni casella è esattamente un _tipo_, e il tipo è tutta la questione: decide cosa osservano il plugin o la scansione degli hiscores, e quindi se la casella potrà mai completarsi da sola. Mescolare i campi di due tipi viene rifiutato all’ingresso, invece che accettato e lasciato rotto.',
        'I tipi si dividono in tre famiglie, e la famiglia conta più dell’etichetta:',
      ],
      families: [
        {
          term: 'Manuale',
          body: 'una persona guarda uno screenshot e dice di sì. Sempre disponibile, funziona sempre, costa sempre la serata a qualcuno. Usalo per le cose che il software non può vedere.',
        },
        {
          term: 'Da hiscores',
          body: 'XP delle skill e killcount dei boss, letti dagli Hiscores ufficiali con una scansione ogni 15 minuti. Non serve il plugin, funziona per tutti quelli nel roster —— ma vede solo ciò che gli Hiscores tracciano, e solo dopo che il giocatore si è disconnesso.',
        },
        {
          term: 'Rilevato dal plugin',
          body: 'tutto il resto: drop, uccisioni di NPC, clear a tempo, diari, combat task, giri, valore del loot. Assegna il credito in pochi secondi e imprime uno screenshot di prova —— ma solo per i giocatori che usano davvero il plugin.',
        },
      ],
      kindsIntro: 'L’elenco completo, nell’ordine in cui il selettore te li propone:',
      kindLabels: {
        standard: { label: 'Standard', blurb: 'Casella manuale —— un capitano la segna come fatta. Nessun tracciamento automatico.' },
        skill: { label: 'Skill', blurb: 'Si completa da sola quando una skill raggiunge un obiettivo di XP (letto dagli hiscores).' },
        boss: { label: 'KC boss', blurb: 'Si completa da sola quando un boss raggiunge un obiettivo di killcount (letto dagli hiscores).' },
        drop: { label: 'Drop', blurb: 'N drop di un oggetto (o uno qualsiasi di un insieme) —— rilevato dal plugin, con screenshot impresso.' },
        collection: { label: 'Set di oggetti', blurb: 'Più oggetti, ciascuno con la propria quantità richiesta —— 1× di ognuno per un set completo.' },
        kill: { label: 'Kills', blurb: 'N uccisioni di qualsiasi boss o mostro. Contate dagli hiscores quando ogni mostro della casella è presente lì, altrimenti dal plugin mentre giochi (galline, mucche, mostri Slayer).' },
        lap: { label: 'Giri di agility', blurb: 'N giri di un percorso di agility, o N piani / run complete dell’Hallowed Sepulchre —— contati dal vivo sul contatore in gioco. Valgono solo i giri fatti durante l’evento.' },
        pvp: { label: 'Kill PvP', blurb: 'Uccidi giocatori —— chiunque, squadre rivali o una taglia con nome —— nella Wild o nei mondi PvP. I minigiochi safe non contano mai.' },
        gain: { label: 'Oggetti ottenuti', blurb: 'Pesca/cucina/raccogli N di un oggetto —— contati dai guadagni d’inventario. Rilevato dal plugin.' },
        timed: { label: 'A tempo', blurb: 'Completa un’attività entro un limite di tempo (Inferno, raid, Colosseum). Il plugin cronometra.' },
        deathless: { label: 'Senza morti', blurb: 'Completa una raid con ZERO morti nel gruppo, N volte. Il plugin conta le morti nell’istanza.' },
        lms: { label: 'LMS', blurb: 'Arriva nei primi N a Last Man Standing (1 = vittoria), M volte. Rilevato dal plugin a fine partita.' },
        value: { label: 'Valore del loot', blurb: 'Loot che vale X gp —— un singolo bottino o più bottini che sommano fino a un obiettivo. Il plugin ne calcola il prezzo.' },
        diary: { label: 'Diario', blurb: 'Completa dei tier di achievement diary durante l’evento. Rilevato dal plugin sul messaggio di completamento.' },
        ca: { label: 'Combat task', blurb: 'Completa dei task dei Combat Achievement durante l’evento. Rilevato dal plugin sul messaggio di completamento.' },
      },
      note: {
        tag: 'La domanda sul plugin, posta una volta sola',
        body: 'Una casella rilevata dal plugin è invisibile per chi il plugin non lo usa. Non è un bug che si possa aggirare con un’impostazione —— non c’è nulla che stia guardando. Se una fetta del tuo clan gioca da mobile o dal client ufficiale, o tieni quelle caselle fuori dal percorso critico verso la vittoria, oppure le affianchi a un ripiego manuale e metti in conto di verificare screenshot.',
      },
    },

    pick: {
      title: 'Scegli il tipo che scatterà davvero',
      intro:
        'Quasi tutte le caselle che si comportano male sono l’idea giusta espressa nel tipo sbagliato. Le quattro che fregano tutti:',
      rows: [
        {
          term: 'Una lista di boss più un mostro fuori dagli hiscores',
          body: 'diventa una casella del plugin per **tutto**. Una casella Kills è contata dagli hiscores solo se ogni suo mostro c’è; aggiungi una gallina a quattro boss di GWD e l’intera casella richiede il plugin. Se parte del clan gioca senza, lascia i boss degli hiscores in una casella a parte.',
        },
        {
          term: 'Uno slot del Collection Log',
          body: 'è una casella drop. Sbloccare la voce del log dà il credito, quindi la casella scatta anche su un doppione che il giocatore possedeva già —— che di solito è quello che intendevi.',
        },
        {
          term: '“Prendine uno di ciascuno”',
          body: 'è una casella drop con una lista di oggetti e **nessun** `requiredAmount`. Aggiungi un `requiredAmount` e diventa silenziosamente “prendine N qualsiasi” —— stessa riga, casella completamente diversa.',
        },
        {
          term: 'Un diario o un combat task',
          body: 'prende credito solo dal messaggio di completamento in gioco, che compare nell’istante in cui il tier o il task viene finito. Ciò che un giocatore possiede già non può riscattare —— tranne un combat task, dove **Settings → Combat Achievements → Repeat completion** gli permette di farlo scattare di nuovo.',
        },
      ],
      note: {
        tag: 'Caselle boss composite',
        body: 'La statistica tracciata di una casella boss può contenere più chiavi degli Hiscores separate da virgole, e i progressi si sommano. `chambersOfXeric,chambersOfXericChallengeMode` è una casella sola che conta insieme CoX e CM, che è quasi sempre ciò che intende una casella da raid.',
      },
    },

    bulk: {
      title: 'Scrivi in blocco, non nel browser',
      body: [
        'Cliccare a mano una griglia da 25 caselle va bene. Cliccare a mano un tabellone Leagues da 200 compiti no, e nemmeno rileggerlo dopo. La scheda Tiles ha un giro completo pensato esattamente per questo.',
      ],
      steps: [
        '**Download spreadsheet** nella pagina **Board & tiles** dell’evento. Ottieni un .xlsx del tabellone com’è, con i menu a tendina, la lista degli oggetti e le istruzioni delle colonne in fogli separati.',
        'Modificalo. Una riga per casella; l’ordine delle righe è l’ordine delle caselle.',
        '**Upload CSV / Excel** nella stessa scheda. Viene letto solo il foglio **Tiles**.',
      ],
      rules: [
        {
          term: 'Il giro completo non perde nulla',
          body: 'scarica e ricarica senza modifiche e non succede niente —— le righe identiche vengono riportate come invariate e nemmeno riscritte. Questo rende l’esportazione sicura come backup prima di una modifica grossa.',
        },
        {
          term: 'Le righe corrispondono alle posizioni',
          body: 'la riga 1 è la casella 1. Le caselle esistenti vengono aggiornate sul posto, e una colonna che ometti viene lasciata stare invece che svuotata —— così puoi caricare un foglio a due colonne che modifica solo i punti.',
        },
        {
          term: 'Solo i tabelloni dinamici crescono',
          body: 'le righe in più creano nuove caselle su un tabellone Leagues o una corsa a caselle, prima che l’evento inizi, fino a 1000. Una griglia classica N×N ha una forma fissa e le ignora. Per generare centinaia di compiti, fai un evento Leagues.',
        },
        {
          term: 'Tutto o niente',
          body: 'ogni riga viene prima validata. Un solo nome di oggetto irrisolvibile fa fallire l’intera importazione, elenca i colpevoli e non cambia nulla —— non ti ritrovi mai con mezzo tabellone.',
        },
        {
          term: 'Alcuni campi si bloccano all’avvio',
          body: 'etichetta, tipo, quantità richiesta e configurazione degli oggetti vengono applicati solo prima dell’inizio dell’evento. Descrizione, punti, categoria e il flag “facoltativo” restano modificabili sempre, così puoi correggere un refuso a evento in corso senza riaprire il tabellone.',
        },
      ],
    },

    traps: {
      title: 'Gli errori che falliscono in silenzio',
      intro:
        'Ognuno di questi si importa pulito, se ne sta sul tabellone con l’aria giusta, e non scatta mai. Vale la pena rileggerli prima di caricare, non dopo.',
      rows: [
        {
          term: 'Le caselle skill e boss sono `type=standard`',
          body: 'non esiste `type=skill`. Il tipo nasce da `trackedStat` + `statType` + `statGoal` su una riga per il resto standard. Scrivere `type=boss` viene rifiutato; scrivere `type=standard` e dimenticare le colonne della statistica no —— ottieni una casella manuale che nessuno approverà mai.',
        },
        {
          term: 'I separatori cambiano da colonna a colonna',
          body: '`items` usa il punto e virgola (la virgola è il delimitatore del CSV). `targetNpcs` usa la barra verticale. Su una riga di combat task la barra verticale è l’**unica** opzione, perché i nomi veri dei task contengono virgole —— `Nylocas, On the Rocks` è un task solo.',
        },
        {
          term: 'I nomi delle raid vengono confrontati alla lettera',
          body: 'una casella raid senza morti o a tempo porta la modalità scritta come in gioco: `Chambers of Xeric: Challenge Mode`, `Theatre of Blood: Hard Mode`, `Tombs of Amascut: Expert Mode`. Una grafia quasi giusta è una casella che non si completa mai. I clear in Entry Mode non danno mai credito a una casella della raid base; le modalità più difficili sì.',
        },
        {
          term: 'I nomi degli oggetti devono essere esatti',
          body: 'grafia identica a quella in gioco, altrimenti l’importazione fallisce ed elenca ciò che non è riuscita a risolvere. Quando un nome è ambiguo, fissalo come `Nome#id` e smetti di tirare a indovinare.',
        },
        {
          term: '`timeThresholdSeconds` significa quattro cose',
          body: 'un limite di tempo su una casella a tempo, un limite di piazzamento su una casella LMS (1 = vittoria), la dimensione esatta del gruppo su una casella senza morti, e la dimensione esatta del gruppo raid su una casella drop. Stessa colonna, quattro significati —— controlla di star compilando quello che il tuo tipo legge davvero.',
        },
        {
          term: 'Una quantità richiesta sul tipo sbagliato',
          body: 'vale sulle righe drop, kill, gain, lap, PvP, senza morti e LMS. Su una riga di statistica o a tempo non fa nulla, e su una riga drop trasforma un set di oggetti in un insieme “N qualsiasi”.',
        },
      ],
      note: {
        tag: 'Provane una prima di scriverne duecento',
        body: 'Scrivi una singola casella del tipo su cui hai dubbi, svelala su un evento usa e getta, e vai a farla davvero. Cinque minuti lì valgono più che scoprire, la sera del bingo del clan, che un’intera categoria era morta.',
      },
    },

    points: {
      title: 'Punti, fasce e se è equilibrato',
      body: [
        'Su un tabellone a punti ogni casella porta il proprio valore, e quei valori si mappano su fasce di difficoltà con un nome —— da easy a elite —— che puoi modificare in **Rules & scoring** se il tuo clan valuta diversamente. La fascia è ciò che leggono i giocatori; il numero è ciò che fa punteggio.',
        'Segna una casella come **facoltativa** e smette di contare nel totale del tabellone: è così che aggiungi obiettivi extra senza rendere impossibile un blackout.',
        'Quando il tabellone è pieno, lancia il **revisore di equilibrio** dalla scheda Tiles. Controlla la struttura e la distribuzione dello sforzo e ti dice dove il tabellone pende da una parte —— una categoria che nessuno può finire, una fascia che vale molto più all’ora delle vicine —— prima che siano i giocatori a trovarle e ad aggirarle.',
      ],
    },

    reveal: {
      title: 'Nessuno lo vede finché non lo dici tu',
      body: [
        'I tabelloni nuovi nascono nascosti. Lo staff li vede sempre; i giocatori non vedono assolutamente nulla finché non li sveli —— così un tabellone può essere costruito allo scoperto, per giorni, in un canale che i tuoi membri possono leggere, senza rovinare niente.',
        'Quell’interruttore principale è la base di tutto il resto. Su un tabellone con una politica di svelamento —— programmata, a intervalli, a taglie, a rotazione —— il motore comincia a girare le singole caselle solo quando il tabellone stesso è stato svelato, quindi armare un tabellone è sempre un atto deliberato. Quale politica scegliere ha una pagina tutta sua: [Formati, e come si aprono le caselle]({formatsGuide}).',
        'Le missioni sono l’eccezione da conoscere: caselle scritte in anticipo ma tenute da parte, annunciate a evento in corso dal loro pool mentre il resto del tabellone resta visibile.',
      ],
    },

    check: {
      title: 'Prima di svelare',
      intro: 'Vale la pena percorrerla una volta per tabellone. In gran parte sono cinque minuti.',
      items: [
        'ogni casella ha il tipo che intendevi, non quello che si è importato bene',
        'modalità delle raid, nomi degli oggetti e nomi dei task coincidono con la grafia in gioco carattere per carattere',
        'le caselle rilevate dal plugin non sono l’unica strada per vincere, se una parte del clan gioca senza',
        'i punti sono impostati e il revisore di equilibrio è soddisfatto, oppure non sei d’accordo con lui di proposito',
        'le caselle facoltative sono contrassegnate come facoltative',
        'hai scaricato il foglio almeno una volta, come backup ricaricabile',
      ],
      note: {
        tag: 'Chi può farlo',
        body: 'La scrittura del tabellone è l’unico lavoro da admin con un ruolo tutto suo. Un **editor** può scrivere caselle e nient’altro, e può essere limitato a tabelloni specifici —— così un costruttore ospite di un altro clan ottiene esattamente l’evento che gli hai affidato e nessun accesso a nient’altro di ciò che gestisci.',
      },
    },
    library: {
      title: 'La libreria dei task e i suggerimenti',
      body: [
        'Gli editor delle caselle hanno **Task library** nel menu admin: i task salvati dal tuo clan, e la libreria di Anvil da cui copiare. **⬇ Export pack** salva i tuoi task in un file e **⬆ Import pack** ne carica uno, ed è così che un tabellone passa da un clan all’altro.',
        'Hai trovato un errore nella libreria di Anvil, o un task che manca? Premi **Suggest a fix** sul task, oppure **Suggest a new task**. Anvil lo esamina e la risposta compare sotto **Your suggestions**: **Waiting for review**, **Approved** o **Not taken**, con una nota. Puoi averne 5 in attesa. Una correzione approvata arriva a ogni copia del clan che segue ancora la libreria.',
      ],
    },
    stats: {
      title: 'Statistiche iniziali e ritardatari',
      intro: 'Le caselle XP e uccisioni confrontano le statistiche attuali di ogni giocatore con le sue **starting stats**, prese all’inizio dell’evento. La pagina **Stats** dell’evento è dove controllarle e correggerle:',
      rows: [
        {
          term: 'Capture starting stats',
          body: 'prima dell’inizio serve solo a scaldare le classifiche; la partenza vera viene presa all’inizio. Dopo l’inizio il pulsante diventa **Capture late joiners**, per i giocatori aggiunti dopo. Può essere eseguito una volta ogni 30 minuti.',
        },
        {
          term: 'Update now',
          body: 'aggiorna le classifiche con gli ultimi numeri. Si aggiornano anche da sole ogni ora.',
        },
        {
          term: 'Fix baseline',
          body: 'per giocatore: cambia a mano un numero di partenza di una skill o di un boss. Usalo quando un grind fatto prima dell’evento è stato conteggiato, perché il giocatore non ha fatto logout prima dell’inizio.',
        },
        {
          term: 'Reset all starting stats',
          body: 'nascosto sotto **Danger zone**: riprende da capo la partenza di tutti dalle loro statistiche attuali, cancellando ogni guadagno finora. Solo per un evento iniziato per errore.',
        },
      ],
      outro: 'Più sotto, **Member breakdown** mostra chi in ogni squadra ha fatto cosa, e **Stat tile standings** le statistiche di partenza e attuali di ogni giocatore su ogni casella XP o uccisioni.',
    },
    race: {
      title: 'Percorsi delle corse a tessere',
      intro:
        'In una bacheca di corsa a tessere costruisci un percorso invece di una griglia. Le tessere stanno su passi numerati, e una squadra avanza lungo di essi.',
      body: [
        'Apri **Tiles** e usa la sezione **Route**. Scegli un modello (**Diamond** è quello predefinito), aggiungi le tue tessere ai passi e premi **Save route**. Ogni tessera che colleghi deve trovarsi sul passo successivo.',
        'Le strade possono dividersi e riunirsi, ma c\'è un solo traguardo. A un bivio scegli se completare una tessera imposta la strada, oppure se il capitano la sceglie e la blocca. L\'elenco completo delle scelte, e cosa vedono i giocatori, è in [Formats, and how tiles open]({formatsGuide}).',
      ],
    },
  },

  captain: {
    metaTitle: 'Guida del capitano — Anvil',
    metaDescription:
      'Il giorno del draft e le settimane dopo: leggere il pool prima che parta il cronometro, fare le scelte, e gestire roster, prove e quote della tua squadra.',
    eyebrow: 'Anvil · per i capitani',
    title: 'Guida del capitano',
    dek: 'Ti consegnano una sala operativa, un cronometro e i moduli d’iscrizione di venticinque sconosciuti. Questo è ciò che fa tutto quanto, nell’ordine in cui lo incontri —— più le parti della gestione di una squadra che iniziano soltanto quando il draft è finito.',
    facts: [
      { strong: 'Ordine a serpentina', rest: 'così le scelte tardive si compensano' },
      { strong: 'Il cronometro', rest: 'non sceglie mai al posto tuo' },
      { strong: 'Una scheda', rest: 'gestisce la squadra per tutto l’evento' },
    ],
    footnote:
      'Tutto ciò che c’è qui è ciò che vede un capitano. Quote, roster delle altre squadre e il tabellone prima dello svelamento restano lato staff, quindi nulla in questa pagina ti farà accusare di aver guardato qualcosa che non dovevi.',

    before: {
      title: 'Cosa ricevi, e quando',
      body: [
        'Chi ospita ti nomina capitano, e questo fa due cose: ti mette in squadra come giocatore e ti apre le schermate della squadra. Se la pagina della squadra ti avverte che in realtà non sei nel roster, accetta la correzione che ti propone —— un capitano fuori dalla propria squadra è uno stato che confonde ogni schermata a valle.',
        'Da lì in poi hai due posti dove stare. **My Team** è l’hub della tua squadra, ed è dove passi l’evento. La **sala operativa** è la schermata del giorno del draft, e si apre appena si aprono le iscrizioni —— molto prima della serata del draft.',
      ],
      note: {
        tag: 'Entraci presto',
        body: 'La sala operativa è utilissima nei giorni _precedenti_ al draft, quando puoi leggere ogni modulo d’iscrizione per bene. La sera stessa diventa un cronometro e non avrai tempo di leggere nulla.',
      },
    },

    warroom: {
      title: 'Leggi il pool prima che parta il cronometro',
      body: [
        'La sala operativa mostra tutti quelli che potresti scegliere, con tutto ciò che il sito sa di loro: cosa giocano, i boss su cui hanno killcount veri, a quanti eventi passati si sono presentati, e le risposte date nel modulo d’iscrizione.',
        'Quelle risposte sono **congelate come sono state inviate**. Nessuno modifica le proprie “ore a settimana” dopo aver visto chi è stato scelto per primo, ed è esattamente il motivo per cui vale la pena leggerle.',
        'Costruisci una **lista ristretta** mentre leggi. È privata, sopravvive fino alla sera del draft, e quella sera è la differenza fra scegliere da una lista di cui ti fidi già e scegliere chi capita in cima allo schermo.',
      ],
      rows: [
        {
          term: 'Valutazione e fascia',
          body: 'un riassunto di ciò che una persona ha davvero fatto, ricavato dallo storico del suo account e non da ciò che ti ha raccontato. Indicativo —— è il punto di partenza di una conversazione, non una sentenza.',
        },
        {
          term: 'Ambiti e indicatori',
          body: 'ciò che fanno in modo dimostrabile: raid, PvM, skilling, PvP. Utile per individuare il buco nel tuo roster invece di prendere quattro volte il numero più alto.',
        },
        {
          term: 'Presenza',
          body: 'quanto spesso hanno portato a termine gli eventi passati a cui si erano iscritti. Il numero più silenzioso della pagina e spesso quello che predice meglio.',
        },
      ],
    },

    draft: {
      title: 'Il giorno del draft',
      body: [
        'Le scelte seguono l’**ordine a serpentina**: con quattro squadre il primo giro è A, B, C, D e il secondo è D, C, B, A, quindi scegliere per ultimo in un giro significa scegliere per primo in quello dopo. Chi ha pescato la prima scelta la paga un minuto più tardi.',
        'Una persona è una scelta, non un account. Prendere qualcuno tira nella tua squadra tutti gli account che ha registrato —— non spendi mai una seconda scelta per l’alt di qualcuno.',
      ],
      rows: [
        {
          term: 'Il cronometro delle scelte',
          body: 'se chi ospita ne ha impostato uno, hai quei secondi per turno. Quando scade **non** sceglie al posto tuo —— sblocca la possibilità per chi ospita di scegliere per tuo conto, e lo dice su entrambe le schermate. Non succede nulla in silenzio.',
        },
        {
          term: 'Una lista ristretta',
          body: 'alcuni eventi girano in modalità equilibrata. A seconda di quale, alla squadra più forte può essere impedito di prendere un altro giocatore di fascia alta finché una rivale non ne ha nessuno, oppure può esserle posto un tetto su quanto può stare sopra la media. Se qualcuno che volevi è in grigio, è per questo, e vale per tutti.',
        },
        {
          term: 'Se non ci sei',
          body: 'dillo prima a chi ospita. Può scegliere per te dalla stessa schermata, e la lista ristretta che hai lasciato è l’istruzione che seguirà.',
        },
      ],
      note: {
        tag: 'Il roster si blocca quando parte il draft',
        body: 'Quando un draft è in corso, l’insieme delle squadre e l’ordine di scelta sono congelati. Se manca una squadra o l’ordine è sbagliato, va sistemato prima della prima scelta, non dopo.',
      },
    },

    roster: {
      title: 'L’hub della tua squadra, per tutto l’evento',
      intro:
        'Su **My Team**, la scheda **Manage this team** contiene tutto ciò che puoi fare per la tua parte. Arriva chiusa; aprila una volta e resta dove l’hai messa.',
      rows: [
        {
          term: 'Roster',
          body: 'chi c’è in squadra e cosa ha contribuito. Il primo posto dove guardare quando qualcuno chiede perché il suo drop non è stato contato —— un account non collegato salta fuori qui.',
        },
        {
          term: 'Requests',
          body: 'chi chiede di entrare, negli eventi che lasciano scegliere la squadra ai giocatori. Compare solo se ce ne sono.',
        },
        {
          term: 'Proof',
          body: 'gli invii della tua squadra e i loro screenshot. Non sei tu ad approvare in via definitiva —— lo fa lo staff —— ma vedi cosa è stato mandato e puoi sollecitare ciò che manca.',
        },
        {
          term: 'Fees',
          body: 'chi nella tua squadra deve ancora la quota d’iscrizione. Puoi segnarne una come pagata; confermarla è un compito dello staff, di proposito.',
        },
        {
          term: 'Invite links',
          body: 'compare quando chi ospita ha permesso ai capitani di generare i propri. Un link mette chi lo apre direttamente nella tua squadra. Vedi [Ospitare un clan in visita]({clanVsClanGuide}) per cosa fa davvero il link.',
        },
      ],
    },

    during: {
      title: 'Gestirlo una volta partito',
      body: [
        'Gran parte dell’evento va avanti da sola: il plugin assegna il credito a ciò che vede e archivia uno screenshot marchiato. Quello che resta sono le persone, ed è quello il lavoro.',
        'Le cose che hanno davvero bisogno di un capitano: assicurarsi che tutti nella tua parte abbiano il plugin collegato e gli account associati prima del fischio d’inizio, perché un alt non collegato non contribuisce a nulla; accorgersi di quali caselle nessuno ha toccato a metà strada; e far fotografare le caselle manuali prima dell’ultima ora, quando ci provano tutti insieme.',
        'Se l’evento chiede uno scatto di partenza, quella è l’unica cosa che ogni giocatore deve fare da sé nelle prime ore. Sollecitala presto —— chi non ce l’ha si vede segnalare ogni credito, o rifiutare del tutto, a seconda di come lo ha impostato chi ospita.',
      ],
      note: {
        tag: 'Sostituzioni',
        body: 'A evento avviato, sostituire qualcuno è riservato agli admin, di proposito: i contributi sono già attaccati alle persone. Chiedi a chi ospita invece di trovare il modo di aggirarlo.',
      },
    },
  },

  formats: {
    metaTitle: 'Formati e come si aprono le caselle — Anvil',
    metaDescription:
      'I sette formati d’evento, i cinque modi in cui le caselle possono aprirsi, e i modificatori di punteggio —— cosa fa ciascuno alla sensazione di giocare un evento.',
    eyebrow: 'Anvil · per lo staff del clan',
    title: 'Formati, e come si aprono le caselle',
    dek: 'Due decisioni danno forma a un evento più di ogni casella che contiene: che forma ha il tabellone, e come le caselle diventano giocabili. Sono indipendenti —— qualsiasi formato può usare qualsiasi politica di svelamento —— e insieme sono la differenza fra una settimana di lavoro e una corsa di una sera.',
    facts: [
      { strong: '7 formati', rest: 'la forma del tabellone' },
      { strong: '5 politiche', rest: 'come si aprono le caselle' },
      { strong: '3 modificatori', rest: 'quanto vale un completamento' },
    ],
    footnote:
      'Il formato si fissa alla creazione ma resta modificabile dalla scheda Settings → Event dell’evento; la politica di svelamento e i modificatori di punteggio si possono cambiare in qualsiasi momento prima che le caselle interessate vengano svelate.',

    shape: {
      title: 'La forma del tabellone',
      intro:
        'Il formato decide come viene assegnato il punteggio e cosa ti chiede dopo il modulo di creazione. Tutto il resto di questa pagina si costruisce sopra.',
      note: {
        tag: 'Griglia fissa o lista di compiti',
        body: 'Un tabellone **classico** è un quadrato vero, quindi “N uguale a 5” significa esattamente 25 caselle e il numero non può mai cambiare. Tutto il resto è una lista di compiti di lunghezza libera, che è anche l’unico tipo di tabellone che un’importazione di massa può far crescere. Se stai per generare cento compiti, quella decisione si prende proprio qui.',
      },
    },

    reveal: {
      title: 'Come si aprono le caselle',
      intro:
        'Indipendente dal formato. L’interruttore di svelamento a livello di evento resta comunque il cancello principale —— finché un tabellone è nascosto non si vede nulla e nessuno di questi motori gira, quindi armare un tabellone è sempre un atto deliberato.',
      rows: [
        {
          term: 'Tutte insieme',
          body: 'il classico. Ogni casella è giocabile dall’istante in cui sveli il tabellone, e le squadre scelgono il proprio ordine. Scegli questo se non hai un motivo per non farlo.',
        },
        {
          term: 'Programmato',
          body: 'ogni casella porta il proprio orario di apertura, impostato nella scheda Tiles, e si apre quando quell’orario passa. Un tabellone “una casella all’ora”: ti detta il ritmo e richiede gli orari scritti in anticipo.',
        },
        {
          term: 'A intervalli',
          body: 'il motore estrae caselle nascoste a intervallo fisso —— un gruppo ogni N minuti, a caso o nell’ordine del tabellone. Un tombolone. Zero lavoro oltre alle caselle stesse, e il tabellone si svela da solo mentre dormi.',
        },
        {
          term: 'A taglie',
          body: 'una sola casella aperta per volta, e la prima squadra che la finisce se la prende —— la casella si chiude e la successiva viene estratta subito. Spietato, molto bello da guardare, e senza pietà per i fusi orari.',
        },
        {
          term: 'A rotazione',
          body: 'una finestra scorrevole di poche caselle aperte: ogni estrazione ne apre di nuove e fa scadere le più vecchie. A differenza delle taglie, tutti possono completare una casella aperta prima che sparisca. Pensata per le classifiche individuali.',
        },
      ],
      note: {
        tag: 'La questione dei fusi orari',
        body: 'I tabelloni a taglie e a intervalli premiano chi per caso è sveglio. In un clan sparso per il mondo, è un vantaggio reale distribuito dall’orologio invece che dal gioco. Le finestre a rotazione lo attenuano —— una casella aperta resta aperta per tutta la durata della finestra, quindi anche un giocatore che sta dormendo ha la sua occasione.',
      },
    },

    scoring: {
      title: 'Quanto vale un completamento',
      intro:
        'Tre modificatori, tutti solo in modalità a punti, tutti congelati nel completamento nell’istante in cui avviene —— così una modifica successiva non riscrive mai il passato.',
      rows: [
        {
          term: 'Bonus prima squadra',
          body: 'punti extra alla prima squadra che finisce ciascuna casella. Il modo più economico di far sembrare una corsa un tabellone tutto visibile, senza cambiare nient’altro.',
        },
        {
          term: 'Decadimento',
          body: 'il valore di una casella scala linearmente dal pieno allo svelamento fino a una percentuale obiettivo dopo N ore, poi si ferma. Sotto il 100% cala e premia la corsa; sopra il 100% **cresce**, e premia chi smaltisce i compiti vecchi che tutti hanno saltato. La direzione in crescita è quella che tutti dimenticano esista.',
        },
        {
          term: 'Esclusiva',
          body: 'il primo completamento chiude la casella per tutti gli altri. Implicita nelle taglie. Su un tabellone con grande divario di forza fra le squadre può chiudere la sfida in anticipo —— dà il meglio quando le squadre sono vicine.',
        },
      ],
    },

    missions: {
      title: 'Missioni: sorprese a evento in corso',
      body: [
        'Le missioni sono caselle scritte in anticipo e tenute da parte —— annunciate dal loro pool mentre il resto del tabellone resta visibile. Sono indipendenti dalla politica di svelamento, quindi anche un bingo tutto visibile può averne.',
        'Lanciale a mano quando il tabellone si spegne, a intervallo fisso, o secondo un calendario per singola missione. Ogni missione porta il proprio punteggio: esclusiva, bonus, decadimento e scadenza tutti suoi, impostati per casella e non per evento.',
        'Sono il modo più economico di risvegliare un tabellone al quinto giorno, che è il giorno in cui ogni evento lungo ha bisogno di essere risvegliato.',
      ],
    },

    choose: {
      title: 'Scegliere, in una pagina',
      intro: 'Se sai già la sensazione che vuoi, questa è la strada più breve per arrivarci.',
      rows: [
        { term: 'Un normale bingo di clan', body: 'Griglia classica, tutte le caselle visibili. Aggiungi un bonus prima squadra se vuoi un po’ di fretta.' },
        { term: 'Centinaia di compiti, valutati per difficoltà', body: 'Leagues, tutto visibile. È anche l’unica forma in cui una grossa importazione da foglio di calcolo può crescere.' },
        { term: 'Una settimana che sale verso qualcosa', body: 'Leagues con svelamento programmato o a intervalli, così il tabellone si apre lungo la settimana invece che tutto insieme.' },
        { term: 'Una serata che la gente guarda in diretta', body: 'Taglie. Una casella, la prima squadra se la prende, subito la successiva.' },
        { term: 'Una gara individuale, non a squadre', body: 'Classifica con finestra a rotazione e decadimento. I compiti vanno e vengono e nessuno può accumularli.' },
        { term: 'Una corsa con un traguardo', body: 'Corsa a caselle —— un percorso ordinato, e vince chi arriva più lontano.' },
      ],
      outro:
        'Qualunque cosa tu scelga, le caselle in sé sono lo stesso lavoro: vedi [Costruire un tabellone che si registra da solo]({boardGuide}).',
    },
    race: {
      title: 'Percorsi delle corse a tessere',
      intro:
        'Una corsa a tessere è un percorso di passi numerati. Le squadre avanzano di passo in passo, e vince chi arriva più lontano. L\'host può trasformare il percorso in una mappa con strade che si dividono e si uniscono.',
      body: [
        'Ogni percorso ha un solo inizio, strade che possono dividersi e unirsi, e un solo traguardo. Ogni strada ha la stessa lunghezza. Il progresso di una squadra è la strada percorsa finora.',
      ],
      rows: [
        {
          term: 'Per completamento',
          body:
            'ogni tessera dopo quella attuale è aperta. La prima che una squadra completa imposta la sua strada, e le altre si chiudono per quella squadra.',
        },
        {
          term: 'Scegli e blocca',
          body:
            'il capitano (o lo staff della squadra) sceglie la tessera successiva con **Pick this road** prima che qualcosa conti. Si apre solo la scelta. Una scelta non può essere annullata, se non con un reset da parte di un admin.',
        },
        {
          term: 'Metti da parte i completamenti anticipati',
          body:
            'disattivato di default, quindi contano solo le tessere aperte sulla strada della squadra. Attivalo e un completamento su una tessera che la squadra non ha ancora raggiunto viene conservato. Si completa quando la strada arriva lì. Non salta mai una squadra in vantaggio né apre nulla in anticipo.',
        },
      ],
      steps: [
        'Apri la pagina **Tiles** dell\'evento e trova **Route**.',
        'Scegli un **Route template** e premi **Apply template**. **Diamond** è quello predefinito: un inizio, due strade, un traguardo. Ci sono anche **Two roads**, **Braid**, **Straight line** e **Free** (senza collegamenti).',
        'Scegli **How a team’s road is set at a fork**: per completamento, oppure scegli e blocca.',
        'Aggiungi o sposta passi con **+ Step before**, **Move step earlier/later** e **Remove step**, poi premi **Save route**.',
        'Se l\'evento è già in corso, Anvil chiede cosa fare dei completamenti che il nuovo percorso taglia fuori: **Keep** li mantiene oppure **Roll back**.',
      ],
      outro:
        'I giocatori vedono una **Race track** nella pagina dell\'evento, con un indicatore dorato **You** sulla tessera della propria squadra. **Fullscreen board** la ingrandisce, e **Esc** la chiude. Nel plugin, il pannello laterale mostra **Your road** e **After that**.',
    },
  },

  fees: {
    metaTitle: 'Quote e premi — guida di Anvil per i tesorieri',
    metaDescription:
      'Fissare una quota d’iscrizione, incassarla, la seconda firma che la chiude, e trasformare il montepremi in pagamenti effettivi.',
    eyebrow: 'Anvil · per i tesorieri',
    title: 'Quote e premi',
    dek: 'I soldi sono il punto in cui gli eventi di clan vanno storti, e vanno storti in silenzio: una quota che qualcuno giura di aver pagato, un montepremi che nessuno riesce a far quadrare, una divisione dei premi discussa quando i vincitori si sono già disconnessi. Questo è il percorso che lascia una traccia a ogni passo.',
    facts: [
      { strong: '2 firme', rest: 'chiudono una quota, di base' },
      { strong: 'Montepremi = aggiunto', rest: '+ quota × iscrizioni approvate' },
      { strong: '1 riga', rest: 'per persona pagata' },
    ],
    footnote:
      'Quote e premi sono l’ambito del tesoriere. Un tesoriere può fare tutto ciò che può fare un moderatore, più questo; un semplice moderatore non vede affatto le pagine delle quote.',

    set: {
      title: 'Fissare la quota',
      body: [
        'La quota d’iscrizione vive sull’evento, impostata quando lo crei o modificata dalla sua scheda **Sign-ups**. Nessuna quota è una risposta perfettamente valida —— molti eventi girano solo con un montepremi messo da chi ospita.',
        'Due impostazioni decidono cosa significa davvero la quota, ed è facile passarci sopra:',
      ],
      rows: [
        {
          term: 'A persona o per account',
          body: 'in un evento in cui si possono iscrivere più account, decide se si paga una volta sola o una volta per account. Sbagliala e ti toccherà fare rimborsi.',
        },
        {
          term: 'Scadenza di pagamento',
          body: 'quando passa, le iscrizioni non pagate smettono di essere un problema da rincorrere e diventano una decisione. Fissala prima di quanto pensi —— il giorno prima dell’evento è troppo tardi per sostituire qualcuno.',
        },
        {
          term: 'Quota ospite',
          body: 'quanto pagano i giocatori che non sono membri di un clan che organizza la board. Lasciala vuota e gli ospiti pagano la quota dei membri. Per far pagare a un giocatore una cifra diversa, premi **Change this player’s fee** sulla sua riga in **Sign-ups**.',
        },
      ],
      note: {
        tag: 'Il montepremi segue le iscrizioni',
        body: 'Il montepremi mostrato è quello che hai aggiunto a mano, più la quota d’iscrizione moltiplicata per il numero di iscrizioni **approvate**. Si muove man mano che le iscrizioni vengono approvate o escluse, quindi il numero sulla pagina è sempre quello che potresti davvero pagare.',
      },
    },

    collect: {
      title: 'Incassare',
      body: [
        'Le quote si incassano come il tuo clan incassa già i soldi —— in gioco, su Discord, come fate voi. Il lavoro di Anvil comincia nel momento in cui arrivano: qualcuno con accesso da staff le segna come **pagate**, e questo imprime chi dice di averle prese e quando.',
        'Anche i giocatori hanno voce in capitolo. Un membro può dichiarare a chi ha pagato e allegare uno screenshot, ed è ciò che trasforma “io di sicuro ho pagato” in un documento con due estremi. Quando la dichiarazione del giocatore e la rivendicazione di chi ha incassato nominano persone diverse, quella è una divergenza che il sito può mostrarti, invece di una che scopri in mezzo a una lite.',
        'Sollecitare è un solo pulsante: **Remind unpaid** in Admin → **Fees** manda un DM su Discord a tutti quelli di quell’evento che devono ancora pagare.',
      ],
      note: {
        tag: 'La prova viene cancellata di proposito',
        body: 'Uno screenshot di pagamento viene conservato solo finché la quota non è chiusa, poi rimosso. Esiste per risolvere un disaccordo, non per stare in archivio un anno.',
      },
    },

    sign: {
      title: 'La seconda firma',
      body: [
        'Una quota resta in stato **incassata** finché un membro dello staff _diverso_ non conferma che è arrivata. Chi ha maneggiato i soldi non può essere anche la persona che firma che sono arrivati —— è tutto qui il controllo, ed è il motivo per cui il sito rifiuta la conferma di chi ha incassato, invece di limitarsi a sconsigliarla.',
        'Quante firme servono per una quota è un’impostazione del clan (**Clan settings → Rules & scoring → Fee sign-off**), da zero a cinque. Lo zero esiste per un motivo vero: in un clan dove il tesoriere _è_ il proprietario non c’è nessun altro che firmi, e “34 quote in attesa di una seconda firma” diventa una coda che non si potrà mai svuotare e stabilmente la cosa più rumorosa della dashboard. A zero, segnare una quota come pagata **è** la firma.',
        'Mettila a uno —— il valore predefinito —— se siete in due. Mettila a zero se onestamente non lo siete, e alzala solo se il tuo clan ha sia lo staff sia il motivo.',
      ],
    },

    pay: {
      title: 'Pagare i premi',
      body: [
        'Quando l’evento finisce, la pagina **Prizes** dell’evento trasforma il montepremi in una lista di persone. Generala e ottieni una riga per destinatario, non per squadra: il premio di una squadra vincente si divide equamente fra i suoi membri, così pagare diventa una lista di nomi e numeri invece di un problema di aritmetica a mezzanotte.',
        'Gli importi partono da una divisione suggerita —— sbilanciata verso il primo, e più posti premiati imposti più diventa piatta —— e ogni riga è modificabile. Il suggerimento è un punto di partenza, non una regola.',
        'Poi paghi, spuntando le righe man mano. Il punto è che una settimana dopo chiunque possa guardare la lista e vedere chi ha preso cosa, invece di ricostruirlo dalla cronologia di Discord.',
      ],
      note: {
        tag: 'Annuncialo una volta sola, da qui',
        body: 'I premi vengono pubblicati nei tuoi canali Discord dall’evento stesso, così l’annuncio e il documento sono la stessa cosa. Un premio annunciato a mano è un premio che qualcuno più avanti dirà di non aver mai ricevuto.',
      },
    },

    disputes: {
      title: 'Quando i numeri non tornano',
      intro: 'I quattro che incontrerai davvero:',
      rows: [
        {
          term: 'Dicono di aver pagato, nessuno l’ha segnato',
          body: 'chiedi di dichiarare il pagamento con uno screenshot. Questo mette sul documento un incassatore col nome e un orario, e la persona nominata può confermare o smentire.',
        },
        {
          term: 'Due dello staff pensano entrambi di averla presa',
          body: 'la dichiarazione del giocatore è il criterio decisivo —— dice a chi l’ha consegnata. Correggi l’incassatore, poi chiudila.',
        },
        {
          term: 'Una quota è ferma in attesa di una firma',
          body: 'o sta davvero aspettando qualcun altro, o il tuo clan ha meno staff di quanto l’impostazione sulle conferme richieste dia per scontato. Abbassa l’impostazione invece di confermare il tuo stesso incasso.',
        },
        {
          term: 'Il montepremi è cambiato dopo che l’avevi annunciato',
          body: 'segue le iscrizioni approvate, quindi approvare o escludere un’iscrizione lo muove. Cita il montepremi al momento della chiusura delle iscrizioni, non a quello dell’apertura.',
        },
      ],
    },
  },

  coffer: {
    metaTitle: 'La cassa del clan — guida Anvil per i tesorieri',
    metaDescription:
      'La cassa in gp del clan su Anvil: registrare le donazioni e accreditarle a chi le ha fatte, i tre modi in cui viene pagato un premio, chi può muovere il denaro, e cosa succede quando la cassa non basta.',
    eyebrow: 'Anvil · per i tesorieri',
    title: 'La cassa del clan',
    dek: 'Quasi tutti i clan tengono i gp nella banca di qualcuno e la contabilità nella memoria di qualcuno. La cassa è un unico fondo con una riga per ogni movimento — chi l\'ha dato, a cosa è promesso, e chi l\'ha davvero mandato.',
    facts: [
      { strong: '3 numeri', rest: 'in cassa, impegnato, libero da promettere' },
      { strong: '3 uscite', rest: 'gare settimanali, caselle missione, il fondo di una board' },
      { strong: 'Tesoriere', rest: 'o admin — mai il grado da solo' },
    ],
    footnote:
      'Tutto questo sta in Admin → **Coffer**, tranne le scale dei premi, che vivono su ciò per cui si paga. La metà pubblica è `/coffer`: il saldo, i maggiori donatori e i movimenti recenti, per i membri.',

    what: {
      title: 'Cos\'è',
      body: [
        'Un registro, non un portafoglio. Anvil non tiene mai i vostri gp — restano dove il clan già li custodisce — quindi la cassa è l\'annotazione di ciò che è entrato, di ciò che è stato promesso e di ciò che è stato davvero consegnato. La sua utilità è che la promessa e il pagamento sono due righe distinte.',
        'La pagina si apre con tre numeri, e sono tre perché rispondono a tre domande diverse:',
      ],
      rows: [
        {
          term: 'In cassa',
          body: 'donazioni approvate e rettifiche. Ciò che il clan ha ricevuto, meno ciò che ha svalutato.',
        },
        {
          term: 'Impegnato',
          body: 'gp che un premio ha rivendicato — vinti ma non ancora inviati, più l\'eventuale fondo messo da parte per una board. Vincolati, anche se sono ancora nella banca di qualcuno.',
        },
        {
          term: 'Libero da promettere',
          body: 'in cassa meno impegnato. L\'unico numero contro cui viene verificato un nuovo premio, perché l\'alternativa è promettere gli stessi 50M a due vincitori mentre il tesoriere dorme.',
        },
      ],
      note: {
        tag: 'Una donazione in attesa non conta da nessuna parte',
        body: 'Che qualcuno scriva «ho dato 100M» è un\'affermazione sul passato, non gp in banca. Resta fuori da tutti e tre i numeri finché lo staff non la riconosce, così non può mai finanziare un premio che poi non si riesce a pagare.',
      },
    },

    inbound: {
      title: 'Far entrare i gp',
      body: [
        'Il plugin RuneLite gestisce da solo il caso normale: apri il Clan Coffer in gioco e Anvil registra depositi e prelievi a partire dal suo vero saldo in monete. La prima occhiata serve solo come riferimento — non fa mai finta che chi l’ha aperto abbia donato tutto ciò che c’era già dentro.',
        'Le registrazioni manuali restano per tutto ciò che è successo mentre nessuno aveva il plugin aperto. Un membro segnala la propria donazione da `/coffer` e questa attende che lo staff le creda; un tesoriere registra una donazione già arrivata, e il fatto stesso che la digiti **è** l\'approvazione.',
        'In entrambi i casi viene accreditata a una **persona**. Conta più di quanto sembri: l\'elenco dei maggiori donatori sulla pagina pubblica è l\'unico ringraziamento che la maggior parte riceverà, e gp arrivati come «il clan» non ringraziano nessuno.',
      ],
      rows: [
        {
          term: 'Apri la cassa in gioco',
          body: 'con Anvil attivo e l’accesso effettuato (Profile sync → **Sync Clan Coffer** è attivo di default). Un messaggio di gioco corrispondente accredita a te il tuo deposito o prelievo; le variazioni viste dopo un periodo scoperto vengono riconciliate senza nominare chi le ha osservate. Admin → Coffer mostra l’ultimo importo fisico e quando è stato visto.',
        },
        {
          term: 'La segnala un membro',
          body: 'dalla pagina pubblica della cassa, con uno screenshot se ce l\'ha. Arriva in attesa e compare nella tua coda. È l\'approvazione a renderla denaro vero.',
        },
        {
          term: 'La registri tu',
          body: 'Admin → Coffer → **Record a donation**. Cerca nell\'elenco chi l\'ha data, metti un importo accanto al nome, fatto. Anche gli ospiti si possono accreditare — chi non è membro a pieno titolo può benissimo aver contribuito.',
        },
        {
          term: 'In più persone insieme',
          body: 'selezionali tutti, scrivi il totale e premi **Split … ways**, poi correggi a mano una singola quota se serve. Scrive una riga ciascuno invece di una riga con un elenco, così ognuno compare nell’elenco donatori col proprio nome.',
        },
      ],
      note: {
        tag: 'Una rettifica è un\'altra cosa',
        body: '**Correct the pot** serve per i gp che si sono mossi al di fuori di tutto questo — avviare la cassa, spenderla per qualcosa che Anvil non ha mai visto, correggere un errore. Volutamente non appartiene a nessuno, e non è il modo di registrare un dono.',
      },
    },

    out: {
      title: 'I tre modi in cui paga',
      intro: 'Ogni premio su Anvil esce da questo unico fondo, e ogni strada decide i vincitori a modo suo. Imposta la scala dove vive ciò che si vince — la cassa non chiede mai chi ha vinto cosa.',
      rows: [
        {
          term: 'Una settimanale, sulla sua pagina',
          body: 'una Skill o Boss of the Week porta una scala di posizioni: il primo prende questo, il secondo quello. Si liquida **una volta sola**, alla fine della gara, sulla classifica finale — mentre è in corso non cambia nulla di mano. Impostala mentre crei la gara, o dopo dalla pagina della gara stessa.',
        },
        {
          term: 'Una casella missione, sulla board',
          body: 'le missioni pagano nell\'ordine in cui la gente finisce, quindi la loro scala si rivendica invece di liquidarsi: la prima squadra che la completa prende i gp del primo posto. Si imposta nella sezione rewards della casella, su qualsiasi board che consenta le missioni.',
        },
        {
          term: 'Il montepremi di una board',
          body: 'un bingo divide da sé il proprio montepremi tra le posizioni, quindi la cassa gli passa solo un numero. Event → **Prizes** → *From the clan coffer*. Si somma alle quote d’iscrizione e a quanto hai aggiunto tu, e la divisione tra le posizioni si imposta nella stessa pagina. Scegli anche se la cassa **vincola** subito quei gp o si limita a registrare la promessa: non sono ancora usciti, e una board fra sei settimane non ha bisogno di metà del fondo bloccata fino ad allora.',
        },
      ],
      note: {
        tag: 'Quando si finisce alla pari',
        body: 'Una scala settimanale può **dividere i pari merito**: tutti quelli a pari punteggio mettono insieme le posizioni che occupano e prendono una quota uguale, così tre giocatori con 40 kc ciascuno prendono un terzo di primo, secondo e terzo invece che il primo di loro si prenda tutto. Lasciala spenta e decide l\'ordine della classifica. Entrambe le scelte si difendono — decidere a risultati usciti no.',
      },
    },

    who: {
      title: 'Chi può muoverla',
      intro: 'Il denaro è un permesso a sé, non un grado. Un moderatore può approvare una prova senza mai toccare la cassa, ed è una scelta, non una dimenticanza.',
      rows: [
        {
          term: 'Tesoriere o admin',
          body: 'tutto il registro: registrare e approvare donazioni, rettificare la cassa, impostare le scale dei premi, segnare un premio come inviato. Il proprietario qui conta come admin.',
        },
        {
          term: 'Un moderatore',
          body: 'niente di tutto ciò. Non vedrà nemmeno la pagina della cassa — raccogliere denaro è il lavoro del tesoriere, e il grado da solo non ha mai conferito quel diritto.',
        },
        {
          term: 'Un tesoriere di board',
          body: 'il denaro di un solo evento: le sue quote, i suoi pagamenti, il suo montepremi. Si concede per board, ed è così che un clan ospite gestisce la propria metà di un clan contro clan senza ricevere in mano la vostra contabilità. Alla cassa del clan non arriva.',
        },
        {
          term: 'Qualunque membro',
          body: 'può segnalare una donazione e leggere la pagina pubblica. Tutto qui.',
        },
      ],
      note: {
        tag: 'Dillo al clan, in un canale',
        body: 'Punta il **Coffer ledger** su un canale Discord in Admin → Discord → What goes where → **Staff only** e ogni movimento viene pubblicato col saldo che lascia dietro di sé. È l’unico feed senza ripiego: lascialo vuoto e sul denaro non viene pubblicato nulla da nessuna parte. Vedi [Anvil su Discord]({discordGuide}).',
      },
    },

    short: {
      title: 'Quando la cassa non basta',
      body: [
        'Un premio più grande della cassa non viene rifiutato. Viene registrato come **dovuto e non coperto** — una riga vera, col nome di un vincitore sopra — perché l\'alternativa è un vincitore senza niente e senza traccia che gli sia mai stato promesso qualcosa.',
        'La soluzione quindi è la solita: far entrare gp, poi pagare. Quello che non va fatto è modificare la scala di nascosto a posteriori; il registro dice già cosa era stato annunciato, e vederli in contraddizione è peggio che essere a corto.',
      ],
      note: {
        tag: 'Anvil non manda nulla',
        body: 'Ogni premio finisce con una persona che consegna gp in gioco e spunta una riga. Il compito del registro è garantire che quella riga esista, che dica chi e quanto, e che una settimana dopo nessuno debba ricostruirla dalla cronologia di Discord.',
      },
    },
  },

  commands: {
    metaTitle: 'Comandi slash di Discord — Anvil',
    metaDescription:
      'Tutti i comandi slash di Anvil — /bingo, /sotw, /botw, /eff, /coffer, /stats e /guide — con ogni opzione spiegata, esempi, chi può usare cosa, e le soluzioni quando i comandi non compaiono.',
    eyebrow: 'Anvil · in Discord',
    title: 'Comandi slash',
    dek: 'Scrivi `/` nel Discord del tuo clan e Anvil risponde dal sito in tempo reale: la board, la classifica, la tua scheda, le settimanali, la cassa e le statistiche di chiunque. Questa pagina è l’elenco completo, generato dai comandi che il bot registra davvero, quindi non è mai superata.',
    facts: [
      { strong: 'Privato', rest: 'risposte che vedi solo tu, con un pulsante per condividere' },
      { strong: 'La tua lingua', rest: 'quella impostata nel tuo Discord' },
      { strong: 'Sola lettura', rest: 'tranne /coffer add e remove' },
    ],
    footnote:
      'Per configurare il bot da zero c’è la [guida Discord](/guide/discord). Questa pagina riguarda come usarlo.',

    using: {
      title: 'Come funziona un comando',
      body: [
        'Scrivi `/` in qualsiasi canale che il bot può vedere e scegli un comando Anvil dall’elenco. Discord mostra poi le sue opzioni come caselle da riempire: premi Tab o cliccane una per aggiungerla. Qui sotto, le opzioni indicate con `<angle brackets>` (parentesi angolari) sono obbligatorie; quelle con `[square brackets]` (parentesi quadre) sono facoltative e puoi tralasciarle.',
        'Ogni risposta è **privata**: la vedi solo tu, quindi controllare la board dieci volte al giorno non disturba nessuno. Se vale la pena mostrarla al canale, premi **Share to channel** sotto la risposta. La copia condivisa viene rigenerata in quel momento, quindi una classifica condivisa più tardi è la classifica com’è in quel momento.',
      ],
      rows: [
        { term: 'Obbligatoria', body: '`<amount>` — Discord non invia il comando finché non è compilata.' },
        { term: 'Facoltativa', body: '`[member]` — se la tralasci, il comando risponde su di te, sulla tua squadra o su tutto il clan.' },
        { term: 'Un elenco', body: 'scegli uno dei valori proposti da Discord; non puoi scriverne uno tuo.' },
        { term: 'Scrivi per cercare', body: 'inizia a scrivere e scegli tra i suggerimenti, come nomi di boss o i tuoi account.' },
        { term: 'Un membro', body: 'scegli qualcuno del server, come con una @menzione.' },
      ],
      note: {
        tag: 'I comandi funzionano solo nel server del tuo clan',
        body: 'Ogni risposta riguarda un clan, e un DM non ha nessun clan su cui rispondere. Per questo i comandi non compaiono nei DM.',
      },
    },

    bingo: {
      title: 'Comandi della board: /bingo',
      intro:
        '`/bingo` riguarda una sola board. Quando ce ne sono diverse attive, **board** e **leaderboard** le elencano tutte; gli altri rispondono sulla board in corso, altrimenti sulla prossima a partire, altrimenti su quella appena finita.',
    },

    clan: {
      title: 'Comandi del clan',
      intro:
        'Questi rispondono sul clan anziché su una board, quindi funzionano che ci sia un bingo in corso o no: le settimanali, l’efficienza, la cassa, le statistiche di chiunque e le guide di configurazione.',
    },

    options: {
      title: 'Opzioni che vedrai ovunque',
      intro: 'Alcune opzioni significano la stessa cosa in tutti i comandi che le hanno:',
      rows: [
        {
          term: '`member`',
          body: 'un’altra persona del server. Tralasciala per chiedere di te. Trova il suo account Anvil tramite l’accesso Discord usato sul sito, quindi funziona solo con i membri che hanno fatto l’accesso ad Anvil almeno una volta.',
        },
        {
          term: '`account`',
          body: 'quale degli account OSRS di quella persona, per chi ha degli alt. Scrivi per scegliere; tralasciala per il suo account principale.',
        },
        {
          term: '`page`',
          body: 'un boss o un’attività, da cercare scrivendo: `Zulrah`, `Theatre of Blood`, `Tempoross`. Tralasciala per la panoramica generale.',
        },
        {
          term: '`language`',
          body: 'rispondi questa volta in un’altra lingua. Di base ricevi la lingua impostata nel tuo Discord, o la lingua del bot scelta dal clan.',
        },
        {
          term: '`amount`',
          body: 'gp scritti come li diresti: `5m`, `2.5b`, `500k`, o un numero semplice come `2,500,000`.',
        },
      ],
    },

    who: {
      title: 'Chi può usare cosa',
      body: [
        'Chiunque nel server può usare tutti i comandi in sola lettura. Quello che vedi è quello che vedrebbe un membro: una board le cui caselle non sono ancora state rivelate resta nascosta anche in Discord, persino per lo staff.',
        'I comandi che rispondono su di **te** (`/bingo me`, `/stats` senza membro) devono sapere quale account Anvil è il tuo. Lo trovano tramite l’accesso Discord che hai usato sul sito, quindi accedi ad Anvil con Discord una volta e da lì in poi funzionano.',
      ],
      rows: [
        { term: 'Tutti', body: 'ogni comando tranne `/coffer add` e `/coffer remove`.' },
        {
          term: 'Tesorieri, admin, proprietari',
          body: '`/coffer add` e `/coffer remove`. Il controllo si fa sul tuo ruolo **sul sito Anvil**, mai sul ruolo Discord, perché un grado in un server di chat non ha mai significato il controllo dei soldi del clan.',
        },
      ],
    },

    trouble: {
      title: 'Quando un comando non funziona',
      intro: 'Le cause più comuni, più o meno nell’ordine in cui capitano:',
      rows: [
        {
          term: 'Nessun comando Anvil nell’elenco',
          body: 'il bot è stato invitato senza i suoi comandi — è un permesso separato, e i vecchi link d’invito ne chiedevano uno solo. Un admin rilancia **Invite / re-invite the bot** da Admin → Discord → **Connection**. Non espelle il bot e non azzera nulla. I comandi appena aggiunti possono metterci fino a un’ora a comparire.',
        },
        {
          term: '“The application did not respond”',
          body: 'Anvil non era raggiungibile per un attimo, di solito durante un aggiornamento. Riprova dopo qualche secondo.',
        },
        {
          term: '“Non sei in questa board” su di te',
          body: 'o non ti sei iscritto a questa board, o Anvil non riesce ad associare il tuo Discord al tuo account. Accedi al sito con questo account Discord e controlla il tuo profilo.',
        },
        {
          term: 'Le statistiche di un membro tornano vuote',
          body: 'non ha ancora fatto l’accesso ad Anvil con Discord, oppure gli hiscores del suo account non sono ancora stati letti. Riprova con l’opzione `account`, o chiedigli di accedere una volta.',
        },
        {
          term: '`/coffer add` dice che non puoi',
          body: 'il tuo ruolo sul sito Anvil non è tesoriere, admin o proprietario, oppure questo Discord non è l’account con cui accedi al sito.',
        },
      ],
    },

    labels: {
      options: 'Opzioni',
      noOptions: 'Nessuna opzione — basta lanciarlo.',
      example: 'Esempio',
      examples: 'Esempi',
      required: 'obbligatoria',
      optional: 'facoltativa',
      choices: 'Valori',
      range: 'da {min} a {max}',
      kinds: {
        text: 'testo',
        number: 'numero',
        member: 'un membro',
        choice: 'scegli da un elenco',
        search: 'scrivi per cercare',
        yesno: 'sì o no',
      },
    },

    examples: {
      'bingo board': {
        examples: ['/bingo board'],
        tip: 'La board in corso adesso. Finché non viene rivelata, i nomi delle caselle restano nascosti anche qui.',
      },
      'bingo leaderboard': {
        examples: ['/bingo leaderboard'],
        tip: 'La classifica delle squadre, a punti o a caselle a seconda di come conta la board.',
      },
      'bingo rules': {
        examples: ['/bingo rules'],
        tip: 'Come conta questa board (letto dall’evento stesso, quindi è sempre giusto), poi le regole interne del tuo clan.',
      },
      'bingo apply': {
        examples: ['/bingo apply'],
        tip: 'Come entrare: le iscrizioni, la quota, e a che punto è la tua iscrizione.',
      },
      'bingo next': {
        examples: ['/bingo next'],
        tip: 'Cosa arriva dopo: una rivelazione di caselle, una missione o una scadenza.',
      },
      'bingo me': {
        examples: ['/bingo me'],
        tip: 'La tua squadra, la tua posizione e le caselle accreditate a te.',
      },
      'bingo help': {
        examples: ['/bingo help'],
        tip: 'Un breve elenco di ciò a cui risponde il bot, dentro Discord.',
      },
      'bingo team': {
        examples: ['/bingo team', '/bingo team name:Iron Wolves'],
        tip: 'La scheda di una squadra: punteggio, roster e caselle recenti. Tralascia il nome per la tua squadra.',
      },
      sotw: {
        examples: ['/sotw', '/sotw language:Deutsch'],
        tip: 'Ogni Skill of the Week attiva, i primi di ciascuna e la tua posizione.',
      },
      botw: {
        examples: ['/botw'],
        tip: 'Ogni Boss of the Week attivo e la sua classifica in tempo reale.',
      },
      eff: {
        examples: ['/eff', '/eff metric:Hours bossed'],
        tip: 'La classifica di efficienza del clan e la tua posizione. ore giocate di default; scegli ore boss per i boss.',
      },
      'coffer balance': {
        examples: ['/coffer balance'],
        tip: 'Il saldo della cassa, i maggiori donatori e gli ultimi movimenti.',
      },
      'coffer add': {
        examples: ['/coffer add amount:5m', '/coffer add amount:250k note:Raffle proceeds'],
        tip: 'Solo tesorieri, admin e proprietari. Registra gp in entrata; viene anche pubblicato nel canale del feed della cassa.',
      },
      'coffer remove': {
        examples: ['/coffer remove amount:20m note:SOTW prize'],
        tip: 'Solo tesorieri, admin e proprietari. Si rifiuta di portare la cassa sotto zero; se è davvero quello che vuoi, registralo sulla pagina della cassa.',
      },
      'stats profile': {
        examples: ['/stats profile', '/stats profile player:Zezima'],
        tip: 'Un account a colpo d’occhio: livello di combattimento e totale, ore giocate ed ore boss, numero di voci del collection log e record personali.',
      },
      'stats levels': {
        examples: ['/stats levels', '/stats levels player:My Iron'],
        tip: 'Livello e XP di ogni skill.',
      },
      'stats efficiency': {
        examples: ['/stats efficiency'],
        tip: 'Ore giocate ed ore boss, e da quali skill e boss arrivano.',
      },
      'stats clog': {
        examples: ['/stats clog', '/stats clog page:Zulrah'],
        tip: 'I progressi del collection log in generale, o la pagina di un boss.',
      },
      'stats pbs': {
        examples: ['/stats pbs', '/stats pbs page:Theatre of Blood mode:Hard size:3'],
        tip: 'Record personali. I raid tengono un tempo per modalità e dimensione della squadra, quindi usa `mode` e `size` per trovare la run che intendi.',
      },
      'stats luck': {
        examples: ['/stats luck', '/stats luck player:Zezima'],
        tip: 'Quanto è stato fortunato l’account sui drop che Anvil traccia.',
      },
      'stats collectors': {
        examples: ['/stats collectors'],
        tip: 'I collection log più grandi del clan.',
      },
      'stats luckboard': {
        examples: ['/stats luckboard'],
        tip: 'I membri del clan più a secco e quelli più fortunati.',
      },
      setup: {
        examples: ['/setup topic:Plugin setup', '/setup topic:Plugin setup step:5'],
        tip: 'Una guida di configurazione dentro Discord: l’elenco dei passi, o un singolo passo con un link diretto a quel punto sul sito.',
      },
      guide: {
        examples: ['/guide guide:ToB 4-man gear'],
        tip: 'Una delle guide di gioco del clan (raid, bossing, money making…): inizia a scriverne il nome e sceglila dall’elenco.',
      },
    },
  },
  moderator: {
    metaTitle: 'Di turno — guida di Anvil per i moderatori',
    metaDescription:
      'La giornata di un moderatore su un sito di clan Anvil: la coda, la verifica di prove e account, tenere il roster onesto, e le decisioni da prendere.',
    eyebrow: 'Anvil · per i moderatori',
    title: 'Di turno',
    dek: 'Un moderatore fa il lavoro che arriva che ci sia o meno un evento in corso: prove da guardare, account da verificare, un roster che deriva. Questo è ciò di cui è fatta la coda, e come svuotarla senza diventare tu il motivo per cui la gente aspetta.',
    facts: [
      { strong: 'Niente eventi', rest: 'un moderatore non può crearli né modificarli' },
      { strong: 'Una pagina', rest: 'dice cosa ha bisogno di te' },
      { strong: 'Approva in fretta', rest: 'una coda lenta sembra un sito rotto' },
    ],
    footnote:
      'Un moderatore vede tutto ciò che vede un membro più le schermate di revisione. Creare e modificare eventi, impostazioni, staff e premi sono compiti da admin e da tesoriere —— se un pulsante non c’è, è per questo, ed è voluto.',

    what: {
      title: 'Cos’è il ruolo',
      intro:
        'I ruoli si sommano verso il basso: tutto ciò che può fare un moderatore lo possono fare anche un tesoriere e un admin. Ciò di cui un moderatore si occupa in proprio:',
      canList: [
        'il roster: aggiungere e rimuovere persone, e rispondere alle richieste di adesione ([La tua gente]({peopleGuide}))',
        'le verifiche degli account —— la sfida XP e la revisione manuale',
        'gli invii e gli screenshot di prova',
        'le competizioni settimanali e il calendario',
        'gli eventi del calendario del clan',
      ],
      cantIntro: 'Cosa non può fare, di proposito:',
      cantList: [
        'creare o modificare un evento, o le sue caselle',
        'cambiare le impostazioni del clan o i collegamenti Discord',
        'promuovere qualcuno, o toccare lo staff',
        'chiudere una quota o eseguire un pagamento',
      ],
    },

    queue: {
      title: 'Parti da ciò che ha bisogno di te',
      body: [
        'La dashboard di amministrazione non è un riassunto del sito —— è la lista di ciò che è in attesa, ordinata per quanto conta, calcolata su dati reali e non su contatori che derivano. Se dice che non serve nulla, non serve nulla.',
        'Lavorala dall’alto verso il basso. Le voci che arrivano in cima sono quelle con una persona dall’altra parte: qualcuno che non può iscriversi perché il suo account non è verificato, o a cui il drop non è stato contato perché nessuno l’ha ancora guardato.',
      ],
    },

    submissions: {
      title: 'Invii e prove',
      body: [
        'Gran parte dei crediti non ti arriva mai: il plugin vede il drop, archivia uno screenshot marchiato con la squadra e un orario UTC, e la casella si completa. Quello che finisce in coda sono le caselle manuali e tutto ciò che il plugin ha segnalato.',
        'È il marchio a rendere una prova difficile da contestare. Uno screenshot del plugin porta la squadra e l’istante impressi nell’immagine, e con la prova a due fotogrammi attiva un secondo fotogramma un paio di secondi dopo mostra il loot posato a terra. Uno screenshot senza niente di tutto questo è uno screenshot fatto col telefono, e va benissimo —— significa solo che a controllare sei tu.',
      ],
      rows: [
        {
          term: 'Approva quando è plausibile',
          body: 'non stai facendo la revisione contabile di una banca. Se l’immagine mostra la cosa, l’account è nel roster e l’orario cade dentro l’evento, approva e vai avanti.',
        },
        {
          term: 'Rifiuta spiegando perché',
          body: 'un rifiuto senza spiegazione ti torna indietro come messaggio privato entro un’ora. Di’ cosa mancava, così il secondo tentativo è quello giusto.',
        },
        {
          term: 'Un invio segnalato è una domanda, non un’accusa',
          body: 'il plugin segnala ciò che non è riuscito a confermare del tutto —— molto spesso un giocatore che non ha consegnato lo scatto di partenza. Leggilo come “guarda questo”, non come “qualcuno ha barato”.',
        },
      ],
    },

    verify: {
      title: 'Verificare gli account',
      intro:
        'Nessuno può iscriversi a un evento senza almeno un account verificato, quindi questa coda blocca direttamente delle persone dal giocare. È quella che vale la pena svuotare ogni giorno.',
      rows: [
        {
          term: 'Verificato dal plugin',
          body: 'dopo il primo controllo di proprietà, il plugin riconosce automaticamente l’account e un’impronta stabile mantiene il collegamento dopo i cambi di nome. Un account del roster senza impronta nota usa una volta la verifica XP o un moderatore.',
        },
        {
          term: 'Verify by XP',
          body: 'per i giocatori senza plugin. Il sito estrae una skill a caso e loro devono guadagnarci 1.000 XP entro trenta minuti. Si verifica da sé —— tu vedi solo quelli che falliscono.',
        },
        {
          term: 'Revisione manuale',
          body: 'Hiscores nascosti, o un alt troppo nuovo per comparirci. Qualcuno invia un RSN con una nota e decidi tu. Chiedi uno screenshot della schermata di accesso se la nota non basta.',
        },
      ],
      note: {
        tag: 'Verificato non vuol dire membro',
        body: 'Verificare un account dice “questo è davvero suo”. Non lo mette nel clan. L’appartenenza viene solo da una sincronizzazione del roster in gioco o dallo staff che lo aggiunge a mano, e un posto da ospite solo da una richiesta di adesione approvata dallo staff (o subito, se il clan fa entrare chiunque). È voluto, ed è ciò che impedisce a chiunque di entrare nel tuo clan digitando un nome.',
      },
    },

    roster: {
      title: 'Tenere il roster veritiero',
      body: [
        'Il roster viene da un solo posto: un admin lancia una sincronizzazione dalla lista del clan in gioco, con il pulsante **Anvil** nella barra del titolo della finestra del clan (o **Sync roster** nel pannello laterale del plugin). Tutto il resto —— verifiche, collegamenti, iscrizioni —— pende da lì.',
        'Quindi la manutenzione è piccola ma reale: chiedi a un admin di lanciare la sincronizzazione dopo ogni tornata di reclutamento (trasforma in membri gli ospiti entrati nel clan in gioco), rispondi alle richieste di adesione in cima alla scheda **Roster**, e smaltisci **Needs review** invece di aspettare che la gente si lamenti. Vedi [La tua gente]({peopleGuide}).',
      ],
      note: {
        tag: 'Ultimo avvistamento non è ultima partita',
        body: 'L’orario di “ultimo avvistamento nel clan” di un membro registra l’ultima sincronizzazione che l’ha trovato, non l’ultima volta che ha giocato. Per capire “sta ancora giocando”, guarda invece l’orario delle sue statistiche dal vivo —— è quello che si muove da solo.',
      },
    },

    startshot: {
      title: 'Rivedere gli scatti di partenza',
      body: [
        'In un evento che lo richiede, ogni giocatore deve consegnare uno screenshot fatto dopo l’avvio dell’evento, in un luogo estratto nel momento della partenza. Le catture del plugin con parola chiave verificata arrivano già accettate, quindi in pratica guardi solo i giocatori che hanno caricato a mano da telefono.',
        'Quello che controlli è poco: il personaggio è nell’immagine, la parola chiave è nella chat, ed è la parola chiave che quel giocatore ha davvero ricevuto. I caricamenti valgono subito e la revisione avviene dopo, quindi nessuno resta bloccato ad aspettarti.',
      ],
    },

    judgement: {
      title: 'Le decisioni che dovrai prendere',
      intro:
        'Nessuna di queste ha una risposta giusta nel software, ed è per questo che arriva a una persona.',
      rows: [
        {
          term: 'La prova è vera ma tardiva',
          body: 'il drop è avvenuto dentro l’evento e lo screenshot è arrivato dopo la fine. Di solito approva —— guarda il marchio nell’immagine, non l’orario del caricamento.',
        },
        {
          term: 'L’account non è ancora collegato',
          body: 'il drop è autentico, l’account è suo, semplicemente non è stato aggiunto prima di giocare. Fallo collegare, poi approva. Non far rifare una raid a qualcuno per una questione di moduli.',
        },
        {
          term: 'Sembra costruito ad arte',
          body: 'portalo a un admin invece di rifiutarlo tu. Un rifiuto dentro un clan piccolo è un’accusa pubblica, e non dovrebbe mai essere la decisione veloce di una persona sola.',
        },
        {
          term: 'Sei tu stesso nell’evento',
          body: 'quasi certamente lo sei. Passa a un altro moderatore qualsiasi cosa riguardi la tua squadra —— non perché saresti ingiusto, ma perché non dovresti trovarti a dover dimostrare di non esserlo.',
        },
      ],
    },
  },

  tiles: {
    metaTitle: 'Regole e limiti delle caselle — Anvil',
    metaDescription:
      'Cosa ti chiede ogni tipo di casella del bingo (impostazioni di gioco, il plugin RuneLite, una collection log sincronizzata, una posizione negli hiscores) e i limiti di ciò che può tracciare.',
    eyebrow: 'Anvil · per i giocatori',
    title: 'Regole e limiti delle caselle',
    dek: 'Ogni casella mostra cosa ti chiede e cosa non può fare. Questa pagina spiega ogni riga; i link **Why?** di una casella portano qui.',
    needs: 'Richiede',
    limit: 'Buono a sapersi',
    checked: 'La casella lo controlla per te',
    englishOnly: 'Le regole qui sotto sono per ora in inglese, così corrispondono sempre a ciò che il sito fa davvero.',
  },

  // /guide/creators — la guida dell’host per uno spazio creator.
  creators: {
    metaTitle: 'Organizza un bingo OSRS per i tuoi spettatori — Anvil',
    metaDescription:
      'Organizza un bingo o una gara di caselle di Old School RuneScape per il tuo stream, senza clan: crea uno spazio, condividi un solo link, scegli chi può unirsi (Twitch, Kick, YouTube o Discord) e porta il tabellone in streaming con OBS.',
    eyebrow: 'Per streamer e creator',
    title: 'Organizzare eventi per i tuoi spettatori',
    dek: 'Uno spazio creator ti permette di organizzare un bingo per il tuo stream. Non serve un clan in gioco. Crei un evento, condividi un link e i tuoi spettatori si uniscono.',
    facts: [
      { strong: 'Nessun clan', rest: 'necessario' },
      { strong: 'Gratis', rest: 'per iniziare' },
      { strong: 'Un solo link', rest: 'per la tua chat' },
    ],

    what: {
      title: 'Cos’è uno spazio creator',
      body: [
        'È la tua pagina su Anvil, all’indirizzo `{apex}/c/il-tuo-nome`. Lì organizzi eventi per i tuoi spettatori.',
        'Non è un clan. Non c’è una lista del clan, né ranghi, né competizioni settimanali. Chi si unisce al tuo evento gioca quell’evento. Nient’altro.',
        'Gli spettatori accedono con Discord, aggiungono il loro personaggio RuneScape e premono **Join**. Il plugin Anvil per RuneLite poi conta i loro drop da solo.',
      ],
    },

    create: {
      title: 'Crea il tuo spazio',
      body: [
        'Vai su [{apex}/host](/host) e accedi con Discord.',
        'Scrivi un nome per il tuo spazio. Il nome del tuo canale è una buona scelta. Il tuo link nasce dal nome. Premi **change link** se ne vuoi uno diverso.',
        'Premi **Create my space**. Hai uno spazio per account Discord.',
      ],
    },

    first: {
      title: 'Crea il tuo primo evento',
      body: [
        'Subito dopo aver creato lo spazio, arrivi su **Create your first event**. Più tardi usa **+ New event** in alto in **Your events**.',
        '**Name.** Quello che vedranno i tuoi spettatori.',
        '**What kind?** Scegli una scheda. **Team bingo** è una griglia 5×5 e Anvil divide i giocatori in squadre per te. **Solo bingo** è la stessa griglia, ognuno per sé. **Team race** sono compiti in ordine: vince la squadra più avanti.',
        '**Ready-made tiles** ti dà un mix di compiti da facili a difficili che potrai cambiare dopo. **Blank, I’ll write my own** parte vuoto.',
        '**Who can join?** Lascialo su **Anyone**, oppure scegli chi può unirsi. Vedi il passo 5.',
        '**When?** Scegli le date di inizio e fine. Oppure lascia vuoto e avvia l’evento tu quando sei pronto.',
        'Premi **Create event**. Poi premi **Copy invite link**.',
      ],
    },

    share: {
      title: 'Condividi il link',
      body: [
        'Incolla il link d’invito nella chat del tuo stream, nel tuo Discord o sui social. Quel link è tutto ciò che serve ai tuoi spettatori.',
        'Puoi copiarlo di nuovo quando vuoi: **Your events** → **Copy invite link** accanto all’evento.',
        'Vuoi che il bot risponda a `!join` in chat con il link? Vedi il passo 9.',
      ],
    },

    who: {
      title: 'Scegli chi può unirsi',
      body: [
        'Ogni evento parte aperto a **Anyone**. Per riservarlo alla tua community, apri **Settings** → **Viewers** → **Who can join?** dell’evento e scegli una o più opzioni. Le stesse opzioni sono nella schermata del primo evento.',
        'Se ne scegli più di una, **ne basta una qualsiasi**. Entra un follower OPPURE un booster del server.',
      ],
      intro: 'Ogni opzione, e cosa deve fare lo spettatore:',
      rows: [
        {
          term: 'Anyone',
          body: 'Chiunque abbia il link si unisce subito.',
        },
        {
          term: 'Twitch followers',
          body: 'Lo spettatore preme **Link Twitch** nella pagina dell’evento e accede con Twitch. Anvil controlla che ti segua.',
        },
        {
          term: 'Twitch subs',
          body: 'Come per i follower, ma deve essere iscritto. Scegli il livello minimo: **Tier 1 or higher**, **Tier 2 or higher** o **Tier 3**. Gli iscritti Prime contano come livello 1. Il tuo canale deve essere affiliato o partner Twitch.',
        },
        {
          term: 'Kick followers',
          body: 'Kick non dice alle app chi ti segue, quindi Anvil conta chi ti segue _dopo_ che colleghi Kick. Seguiva già prima? Lo spettatore smette di seguirti e ti segue di nuovo. La tua chat Kick è solo per follower? Attiva **My Kick chat is followers-only** nel riquadro **Kick channel**. Così uno spettatore che scrive il suo codice Anvil nella tua chat conta come follower.',
        },
        {
          term: 'Kick subs',
          body: 'Gli iscritti che Anvil ha visto dopo il collegamento di Kick contano da soli. Tutti gli altri premono **Get Kick code** e scrivono il codice (è fatto come `ANVIL-7F3K9Q`) nella tua chat Kick, e Anvil vede il loro badge da iscritto. Kick non ha livelli di iscrizione.',
        },
        {
          term: 'YouTube subscribers',
          body: 'Lo spettatore preme **Check my YouTube subscription** e accede con Google. Le sue iscrizioni devono essere pubbliche su YouTube.',
        },
        {
          term: 'YouTube members',
          body: 'Lo spettatore scrive il suo codice Anvil nella tua chat live di YouTube. Quindi i membri possono unirsi solo **mentre sei in diretta**.',
        },
        {
          term: 'Discord role',
          body: 'Chi ha un ruolo che scegli nel tuo server Discord (fino a 5 ruoli). Prima collega il tuo server: **Discord (optional)** nel menu.',
        },
        {
          term: 'Server boosters',
          body: 'Chi boosta il tuo server Discord. Serve anche il server collegato.',
        },
      ],
      note: {
        tag: 'Buono a sapersi',
        body: 'Collega prima il tuo canale (passo 7), altrimenti le opzioni Twitch, Kick e YouTube restano grigie. Un account Twitch, Kick o YouTube può far entrare un solo giocatore in ogni evento. Il tuo staff e le persone che inviti per nome saltano i controlli.',
      },
    },

    approve: {
      title: 'Di’ sì a ogni giocatore (facoltativo)',
      body: [
        'Vuoi scegliere chi gioca? Apri **Settings** → **Viewers** → **Who can enter** dell’evento e scegli **Ask me about everyone**. Premi **Save changes**.',
        'Ora gli spettatori premono **Ask to join** invece di **Join**. Devono comunque superare prima le tue scelte **Who can join?**.',
        'Le loro richieste compaiono in **Your events** come **N waiting for you**. Cliccaci sopra, oppure apri la scheda **Sign-ups** dell’evento. L’elenco in alto si chiama **Waiting for your yes**. Accetta o rifiuta ogni richiesta.',
      ],
    },

    channels: {
      title: 'Collega il tuo Twitch, Kick o YouTube',
      body: [
        'Apri **Settings** nel menu. Nel riquadro **Twitch channel**, **YouTube channel** o **Kick channel**, premi **Connect Twitch**, **Connect YouTube** o **Connect Kick** e accedi come il tuo canale.',
        'Ogni canale collegato compare sulla tua pagina come link **verified**. Non puoi scrivere un link a mano: accedere è il modo in cui Anvil sa che il canale è tuo.',
        'Un canale può essere collegato a un solo posto su Anvil. Se è già su un altro spazio o clan che gestisci, Anvil ti chiede se vuoi spostarlo.',
      ],
    },

    overlay: {
      title: 'Porta il tabellone in streaming (OBS)',
      body: [
        'In **Your events**, premi **Stream overlay** accanto all’evento, poi **Make overlay links**.',
        'Ottieni tre link. **Standings**: le squadre in testa e a che punto sono. **Feed**: gli ultimi drop e le caselle completate. **Board**: il tabellone, con le caselle completate segnate.',
        'Scegli una **Text size** (S, M, L o XL) prima di copiare. Poi premi **Copy** accanto a quello che vuoi.',
      ],
      stepsTitle: 'Aggiungilo a OBS',
      steps: [
        'In OBS, sotto **Sources**, premi **+** e scegli **Browser**.',
        'Incolla il link in **URL**.',
        'Imposta una dimensione, per esempio 800 × 600. Lascia vuoto **Custom CSS**.',
        'Premi **OK**. Si aggiorna da solo ogni pochi secondi.',
      ],
      tipsTag: 'Buono a sapersi',
      tips: [
        'Aggiungi `&limit=10`, `&title=0` o `&align=right` alla fine di un link per cambiarlo.',
        'L’overlay mostra ciò che mostra la pagina pubblica del tuo evento. Classifiche e caselle nascoste restano nascoste anche in streaming.',
        '**Reset link** crea nuovi link e ferma i vecchi. Usalo se un link trapela. Devi incollare di nuovo i nuovi link in OBS.',
        'Un piccolo marchio “Anvil” sta nell’angolo. Con il piano Gold puoi nasconderlo in **Settings** → **Anvil mark on your overlay**.',
      ],
    },

    chatjoin: {
      title: '!join nella tua chat',
      body: [
        'Apri **Settings** → **!join in Twitch chat** e attivalo.',
        'Quando uno spettatore scrive `!join`, il bot Anvil (Anvil_OSRS) risponde con il link al tuo evento aperto. Risponde al massimo una volta ogni 30 secondi, per quante persone lo scrivano.',
        'Risponde solo in un canale che hai collegato al passo 7. Per Kick, attiva **!join in Kick chat** nel riquadro **Kick channel**.',
        'Nessun evento aperto? Lo dice: “No event is open to join right now — keep an eye on the stream!”',
      ],
      tips: [
        'Se la tua chat blocca i link (**Block hyperlinks** di Twitch o AutoMod), la risposta del bot viene trattenuta. Scrivi una volta `/vip anvil_osrs` o `/mod anvil_osrs` nella tua chat perché il link passi.',
        'Stai lavorando a un evento? **Space settings** nel menu dell’evento ti riporta a questi interruttori. Lo stesso fa **Switch it on in your settings** sotto **Who can join?**.',
      ],
    },

    page: {
      title: 'Rendi tua la tua pagina',
      body: [
        'La tua pagina è ciò che la gente vede su `{apex}/c/your-name`, insieme ai tuoi eventi. Apri **Settings** → **Your page**. Ogni parte ha il suo pulsante per salvare.',
      ],
      items: [
        '**Bio.** Qualche riga su di te e sui tuoi stream. I link che iniziano con `https://` sono cliccabili.',
        '**Logo and banner.** Premi **Upload a logo** o **Upload a banner**. Il banner attraversa la parte alta della tua pagina, quindi fallo largo (3:1, per esempio 1500 × 500). PNG, JPEG, GIF o WebP. Entrambi possono essere animati.',
        '**Panels.** Fino a 8 schede sotto i tuoi eventi, come i pannelli sotto un canale Twitch. Premi **+ Add a panel** e dagli un titolo e un po’ di testo. Un’immagine e un link sono facoltativi. Usa le frecce per cambiare l’ordine.',
        '**Schedule.** Quando vai in live di solito, nel tuo fuso orario. I visitatori vedono ogni orario sul proprio orologio.',
        '**Featured.** Un clip fissato in cima alla tua pagina. Scegli uno dei tuoi momenti salienti dello stream (passo successivo), o incolla il link di un clip da Twitch, YouTube, Kick o Medal.',
        'Premi **Preview your page** per vederla come la vedono i visitatori.',
      ],
      note: {
        tag: 'Le regole di Jagex',
        body: 'Tutto ciò che è sulla tua pagina deve rispettare le regole di Jagex: niente vendita di oro o account, niente gioco d’azzardo, niente bot e niente server privati. Anvil controlla i tuoi testi e i tuoi link quando salvi. Se lo staff di Anvil nasconde la tua pagina dopo una segnalazione, le tue impostazioni lo dicono. Chiedi sul Discord di Anvil se pensi che sia un errore.',
      },
    },

    highlights: {
      title: 'Momenti salienti dello stream',
      body: [
        'Con il tuo canale Twitch o YouTube collegato, Anvil cattura i grandi momenti dei tuoi eventi mentre sei in live. Gli interruttori sono in **Settings** → **Stream highlights**.',
        '**Auto-clip big moments on my stream** è attivo appena colleghi il canale. Mentre sei in live su Twitch, Anvil crea un clip quando uno dei tuoi eventi inizia, quando una squadra completa la board o vince, e quando il tuo personaggio ottiene un drop raro o un pet. Su YouTube salva invece un link a quel secondo del tuo stream. Kick non ha ancora i momenti salienti.',
        'I clip compaiono sotto **Highlights** nella pagina dell’evento e sulla tua pagina. Puoi fissarne uno come clip **Featured** (passo 10).',
        '**Let Anvil feature clips from my events in its own promotion** resta spento finché non lo attivi. Poi Anvil può condividere un clip sulle sue pagine e sui suoi social, e ti cita sempre.',
        'Anche i tuoi giocatori possono fare clip dei loro grandi momenti. Attivano **Clip my stream when I hit a big moment** sotto il loro account Twitch in **Settings** → **Connected accounts**.',
      ],
    },

    listing: {
      title: 'Fatti elencare su Anvil',
      body: [
        'Quando lo crei, il tuo spazio non è in elenco. Solo chi ha il tuo link può trovarlo.',
        'Apri **Settings** → **Advertise on Anvil** e attivalo. Il tuo spazio compare nella directory dei clan di Anvil e i tuoi nuovi eventi compaiono su `{apex}/events`.',
        'Per elencare un solo evento, apri le sue **Settings** → **Viewers** → **List on Anvil**. Compare finché l’evento è in arrivo o in corso.',
        'Un evento senza date compare sotto **Open to join**, con la scritta “Open now · starts when the host starts it”.',
      ],
    },

    plans: {
      title: 'Piani e limiti',
      body: [
        'Il tuo piano stabilisce quanti giocatori possono esserci nei tuoi eventi contemporaneamente. Gli eventi con date sovrapposte si dividono quel numero; gli eventi in date diverse lo hanno ciascuno. Un giocatore in due eventi sovrapposti conta due volte. Tutto il resto è uguale in ogni piano: il tabellone, il tracciamento del plugin, l’overlay e Discord.',
        'La tua scheda del piano è in **Your events**. Per confrontare i piani, vedi i [prezzi](/pricing#creators). Per cambiare o annullare quello che paghi, vai alla [tua pagina di fatturazione](/portal).',
      ],
      rows: [
        { term: 'Free', body: 'Fino a 50 giocatori contemporaneamente in tutti i tuoi eventi. Un evento alla volta. Controlli di ruolo Discord e booster.' },
        { term: 'Bronze', body: 'Fino a 150 giocatori contemporaneamente in tutti i tuoi eventi. Controlli Twitch, Kick e YouTube.' },
        { term: 'Silver', body: 'Fino a 300 giocatori contemporaneamente in tutti i tuoi eventi. Più eventi alla volta. `!join` in chat. Mostrato per primo nell’elenco.' },
        { term: 'Gold', body: 'Fino a 1.000 giocatori contemporaneamente in tutti i tuoi eventi. Nascondi il marchio Anvil sul tuo overlay.' },
        { term: 'Partner', body: 'Nessun limite di giocatori. Si imposta direttamente con Anvil — contattaci.' },
      ],
      note: {
        tag: 'Per ora',
        body: 'Per ora entrano tutti mentre Anvil cresce, anche oltre i numeri del tuo piano. I limiti partiranno più avanti, con preavviso. La scheda del tuo piano mostra quanto ci sei vicino.',
      },
    },

    faq: {
      title: 'Domande',
      intro: 'Quelle che gli streamer fanno più spesso:',
      rows: [
        {
          term: 'I miei spettatori hanno bisogno di un clan?',
          body: 'No. Servono un account Discord e un personaggio OSRS. Mandagli la [guida per gli spettatori]({joiningGuide}).',
        },
        {
          term: 'Serve loro il plugin RuneLite?',
          body: 'Per drop e kill, sì. Il plugin li invia da solo. Alcune caselle leggono invece gli hiscores.',
        },
        {
          term: 'Uno spettatore dice “The host’s Twitch connection isn’t working”.',
          body: 'Twitch non accetta più la tua connessione. Apri **Settings** e premi **Reconnect Twitch**. Lo stesso vale per Kick e YouTube.',
        },
        {
          term: 'Qualcun altro può aiutarmi a gestirlo?',
          body: 'Sì. Apri **Players** → **Staff & roles**, aggiungili e scegli cosa può fare ciascuno.',
        },
        {
          term: 'Gestisco anche un clan in gioco.',
          body: 'Allora forse non ti serve uno spazio. Un clan pubblico può attivare **Streaming** al suo posto. Vedi [streaming per i clan]({streamingGuide}).',
        },
        {
          term: 'Posso creare un secondo spazio?',
          body: 'Per ora uno spazio per account Discord. Contattaci se te ne serve un altro.',
        },
        {
          term: 'Dove sono le impostazioni del mio spazio?',
          body: 'Premi **Settings** nel menu. Da dentro un evento, premi **Space settings** nel menu dell’evento.',
        },
        {
          term: 'Cosa fa il pulsante **Report** sulla mia pagina?',
          body: 'Chiunque abbia fatto l’accesso può segnalare la tua pagina, un pannello, un evento o un momento saliente allo staff di Anvil. Le segnalazioni vanno solo allo staff. Se lo staff nasconde la tua bio, i pannelli, il programma o il clip in evidenza, le tue impostazioni lo dicono.',
        },
      ],
    },
  },

  // /guide/joining-a-streamer-event — per uno spettatore che ha cliccato il link di uno streamer.
  joiningStream: {
    metaTitle: 'Unirsi al bingo OSRS di uno streamer — Anvil',
    metaDescription:
      'Hai ricevuto un link da uno streamer? Accedi con Discord, aggiungi il tuo personaggio OSRS, premi Join. Cosa fare per gli eventi riservati a follower o iscritti su Twitch, Kick o YouTube, e come contano i tuoi drop.',
    eyebrow: 'Per gli spettatori',
    title: 'Unirsi all’evento di uno streamer',
    dek: 'Uno streamer ha condiviso un link. Ecco come salire sul tabellone. Non serve un clan.',
    facts: [
      { strong: '~2 min', rest: 'per unirti' },
      { strong: 'Nessun clan', rest: 'necessario' },
    ],

    join: {
      title: 'Unisciti in quattro passi',
      body: [
        '**Apri il link** condiviso dallo streamer. Oppure scrivi `!join` nella sua chat e il bot lo posta.',
        '**Accedi con Discord.** Quello è il tuo account Anvil. Non c’è nulla da compilare.',
        '**Aggiungi il tuo personaggio.** Premi **Add my character** e scrivi il tuo nome RuneScape. Se compare **Prove it’s mine**, segui i passi sul tuo profilo. La [guida al plugin]({pluginGuide}) mostra come.',
        '**Premi Join.** Scegli il tuo personaggio se ne hai più di uno. Vedi **You’re in!** quando ha funzionato.',
      ],
    },

    gated: {
      title: 'Eventi per follower o iscritti',
      body: [
        'Alcuni eventi sono solo per la community dello streamer. La scheda per unirsi dice chi, per esempio “Open to followers of somename on Twitch”.',
        'Premi comunque **Join**. Se non sei ancora dentro, la scheda elenca cosa fare. Fanne una, poi premi di nuovo **Join**.',
      ],
      intro: 'Cosa fare per ogni caso:',
      rows: [
        {
          term: 'Twitch follow or sub',
          body: 'Premi **Link Twitch** e accedi con Twitch. Anvil non chiede permessi. Poi premi di nuovo **Join**.',
        },
        {
          term: 'Kick follow or sub',
          body: 'Premi **Get Kick code**. Scrivi il codice (come `ANVIL-7F3K9Q`) nella chat Kick dello streamer entro 10 minuti. Ogni codice vale una volta sola. Poi premi di nuovo **Join**.',
        },
        {
          term: 'YouTube subscriber',
          body: 'Premi **Check my YouTube subscription** e accedi con Google. Scegli l’account con cui guardi. Le tue iscrizioni devono essere pubbliche nelle impostazioni di privacy di YouTube.',
        },
        {
          term: 'YouTube member',
          body: 'Premi **Link my YouTube account**, poi scrivi il tuo codice nella chat live di YouTube e premi **check the chat**. Funziona solo mentre lo streamer è in diretta.',
        },
        {
          term: 'Discord role or booster',
          body: 'Entra nel server Discord dello streamer e ottieni il ruolo (o boostalo). Anvil controlla con l’account Discord con cui hai effettuato l’accesso.',
        },
      ],
      note: {
        tag: 'Approvazione',
        body: 'Alcuni streamer dicono sì a ogni giocatore. Allora il pulsante dice **Ask to join** e vedi **Waiting for the host** finché non rispondono.',
      },
    },

    plugin: {
      title: 'Installa il plugin Anvil',
      body: [
        'I tuoi drop e i tuoi kill contano tramite il plugin Anvil per RuneLite. Installalo dal Plugin Hub e accedi con Discord dal suo pannello laterale.',
        'La [guida al plugin]({pluginGuide}) ti accompagna in circa tre minuti.',
      ],
    },

    play: {
      title: 'Gioca',
      body: [
        'Fatto. Gioca come sempre. Quando ottieni un drop o un kill che serve al tabellone, il plugin lo invia da solo.',
        'Apri il link dell’evento quando vuoi per vedere il tabellone e la classifica. Giochi solo questo evento: non entri in un clan.',
      ],
    },

    accounts: {
      title: 'I tuoi account collegati',
      body: [
        'Gli account Twitch, YouTube e Kick che hai collegato sono in [Settings → Connected accounts](/settings/connections). Puoi collegarli lì anche prima di unirti.',
        'Scollegane uno quando vuoi. Gli eventi a cui ti sei già unito ti mantengono. Un evento riservato a cui ti unirai più tardi ti chiederà di collegare di nuovo.',
        'Gli account Twitch, YouTube e Kick collegati compaiono sul tuo profilo con una spunta di verifica: hai dimostrato che sono tuoi. Disattiva **Show on my profile** per nasconderne uno. Un link Medal è diverso. Lo incolli tu, quindi non ha la spunta.',
        'Fai stream anche tu su Twitch? Attiva **Clip my stream when I hit a big moment** sotto il tuo account Twitch. Mentre sei in live nell’evento di uno streamer, Anvil fa clip dei tuoi drop rari, dei pet e delle caselle completate.',
      ],
    },

    faq: {
      title: 'Domande',
      intro: 'Quando qualcosa dice no:',
      rows: [
        {
          term: '“This event is full”',
          body: 'Non c’è posto per altri giocatori. Solo lo streamer può fare spazio — fallo sapere.',
        },
        {
          term: 'Sono iscritto ma non mi fa entrare.',
          body: 'Controlla di aver collegato lo stesso account con cui sei iscritto. Su Twitch, guarda **Your Twitch** nella scheda per unirsi. Su Kick, scrivi un codice nuovo nella sua chat: Anvil legge il badge da iscritto su quel messaggio. Su YouTube, rendi pubbliche le tue iscrizioni e ricontrolla.',
        },
        {
          term: 'Ho seguito su Kick ma dice di no.',
          body: 'Anvil vede solo i follow fatti dopo che lo streamer ha collegato Kick. Smetti di seguire e segui di nuovo, poi premi **Join**.',
        },
        {
          term: '“That Twitch account was already used to join this event”',
          body: 'Un account Twitch (o Kick, o YouTube) fa entrare un solo giocatore. Qualcun altro si è già unito con quello.',
        },
        {
          term: '“Twitch didn’t answer just now”',
          body: 'Twitch, Kick, YouTube o Discord ha avuto un intoppo. Aspetta un minuto e premi di nuovo **Join**.',
        },
        {
          term: '“The host’s … connection isn’t working”',
          body: 'Questo dipende dallo streamer. Digli di ricollegare il suo canale su Anvil.',
        },
        {
          term: 'I miei drop non compaiono.',
          body: 'Controlla che il plugin sia installato e con l’accesso fatto, e che ti sia unito con il personaggio che stai giocando. Vedi la [guida al plugin]({pluginGuide}).',
        },
        {
          term: 'Dove trovo altri eventi come questo?',
          body: '[La pagina degli eventi](/events) elenca gli eventi a cui chiunque può unirsi, compresi quelli degli streamer aperti in questo momento.',
        },
        {
          term: 'Qualcosa sulla pagina di uno streamer viola le regole.',
          body: 'Premi **Report** sulla pagina, sull’evento o sul momento saliente. Scegli cosa non va e premi **Send**. Arriva solo allo staff di Anvil. Lo streamer non saprà mai chi l’ha segnalato.',
        },
      ],
    },
  },

  // /guide/streaming-for-clans — un clan pubblico che attiva Streaming.
  streamingClans: {
    metaTitle: 'Fare streaming degli eventi del tuo clan — Anvil',
    metaDescription:
      'Lascia che gli spettatori del tuo stream si uniscano a un evento OSRS del tuo clan senza entrare nel clan: attiva Streaming, apri un evento agli spettatori e scegli quali spettatori possono entrare.',
    eyebrow: 'Per i clan che fanno streaming',
    title: 'Streaming per i clan',
    dek: 'Il tuo clan trasmette i suoi eventi? Lascia che gli spettatori giochino un evento senza entrare nel clan.',

    on: {
      title: 'Attiva Streaming',
      body: [
        'Vai in Admin → **Clan settings** → **Profile** e attiva **Streaming**.',
        'Solo un clan pubblico può fare streaming. Gli spettatori devono aprire la pagina del tuo evento, e un clan privato la nasconde. Un clan con Streaming attivo non può diventare privato finché non lo disattivi.',
        'Una volta attivo, collega il tuo canale Twitch, YouTube o Kick subito sotto.',
      ],
    },

    event: {
      title: 'Apri un evento agli spettatori',
      body: [
        'Ogni evento resta **Members only** finché non dici altro. Funzionava già così prima.',
        'Apri **Settings** → **Entry & co-hosts** → **Who can join?** dell’evento e scegli **Members and viewers**. Poi scegli **Which viewers?**: chiunque, oppure follower, iscritti, un ruolo Discord e così via. Premi **Save**.',
        'Questi controlli valgono solo per gli spettatori. I membri del tuo clan entrano sempre, come prima.',
      ],
    },

    viewers: {
      title: 'Cosa sono gli spettatori',
      body: [
        'Uno spettatore che si unisce diventa un **event player**. Gioca quell’unico evento.',
        'Non sono membri del clan né ospiti. Non finiscono mai nella lista del clan e non ricevono alcun grado.',
        'Puoi vedere tutti quelli entrati in questo modo sotto **People** → **Past viewers**.',
        'Un abituale che vuoi tenere? **Make guest** sulla sua riga lo trasforma in ospite del clan, così può unirsi a qualsiasi evento aperto agli ospiti, non solo a questo. **Make a guest a viewer again** riporta un ospite a essere spettatore di un solo evento.',
      ],
    },

    tools: {
      title: 'I tuoi strumenti per lo stream',
      body: [
        'Gli strumenti dello streamer funzionano come in uno spazio creator: link dei canali verificati, controlli **Who can join?**, l’overlay OBS e `!join` in chat.',
        'I link dell’overlay per un evento del clan sono in **Settings** → **Stream** → **Stream overlay** dell’evento. `!join` e il marchio dell’overlay sono sotto **Clan settings** → **Profile** → **Streaming**.',
        'La [guida per i creator]({creatorsGuide}) spiega ognuno passo per passo.',
        'Anche qui funzionano i momenti salienti dello stream: con Twitch o YouTube collegato, Anvil fa clip dei grandi momenti degli eventi aperti agli spettatori. `!join` nella chat Kick ha il suo interruttore nel riquadro **Kick channel**.',
      ],
    },

    faq: {
      title: 'Domande',
      intro: 'Le risposte brevi:',
      rows: [
        {
          term: 'Gli spettatori contano nel nostro limite di membri?',
          body: 'No. Sono giocatori dell’evento, non membri. I limiti dello streamer contano i giocatori contemporanei in tutti gli eventi che gestisci (vedi la [guida per i creator]({creatorsGuide})).',
        },
        {
          term: '`!join` manderà le persone a un evento solo per membri?',
          body: 'No. Indica solo un evento aperto agli spettatori.',
        },
        {
          term: 'Dovrei creare invece uno spazio creator?',
          body: 'Solo se non hai un clan. Uno spazio è per gli streamer senza un clan in gioco.',
        },
      ],
    },
  },

  people: {
    metaTitle: 'La tua gente: roster, ospiti e chi può entrare — Anvil',
    metaDescription:
      'Da dove arriva il roster di un clan Anvil, cosa significano Members, Guests, Roster only, Departed e Quiet, come funzionano le richieste di adesione e Needs review, le tre impostazioni di Who can join, e come rimuovere o bannare qualcuno.',
    eyebrow: 'Anvil · per lo staff del clan',
    title: 'La tua gente: roster, ospiti e chi può entrare',
    dek: 'Chiunque compaia sotto Admin → **People** ci è arrivato in uno di quattro modi: lo elencava la lista del clan in gioco, lo staff l’ha approvato, il clan fa entrare chiunque, oppure qualcuno l’ha aggiunto a mano. Ecco come funziona ciascuno, cosa ti sta dicendo la scheda Roster e cosa controllare quando qualcuno è nel posto sbagliato.',
    facts: [
      { strong: 'Roster in gioco', rest: 'l’unico modo automatico per diventare membro' },
      { strong: 'Accedere', rest: 'non mette mai nessuno nel roster' },
      { strong: 'Due code', rest: 'su due schede diverse' },
    ],
    footnote:
      'Tutto questo sta in Admin → **People**. Roster e Needs review sono lavoro da moderatore. **Who can join** e **Staff & roles** sono schede riservate agli admin. Per chi può fare cosa in tutta l’area admin, vedi [Ruoli dello staff: chi può fare cosa]({staffGuide}).',

    roster: {
      title: 'Da dove arriva il roster',
      body: [
        'Il roster è la lista del tuo clan in gioco, copiata sul sito. Un admin la invia da RuneLite con il plugin Anvil: premi il pulsante **Anvil** nella barra del titolo della finestra del clan, oppure **Sync roster** nel pannello laterale del plugin. Tutti quelli nella lista arrivano come **membri**, con il loro grado in gioco. Solo chi ha il ruolo Admin sul sito può inviarla. Gli altri lo vengono a sapere in gioco.',
        'Una sincronizzazione è l’unica cosa che rende qualcuno membro da sola. Chi lascia il clan in gioco viene segnato come uscito alla sincronizzazione successiva, e chi rientra torna con quella dopo. La sua cronologia resta in ogni caso.',
        'Ogni altro posto è un posto da **ospite**: qualcuno che gioca i tuoi eventi senza essere nel tuo clan in gioco. Gli ospiti sono tracciati e possono partecipare agli eventi. Non sono membri e non contano per il tuo piano.',
      ],
      note: {
        tag: 'Accedere non mette mai nessuno nel roster',
        body: 'Accedere con Discord, collegare un personaggio o giocare con il plugin non dà un posto a nessuno. Se il plugin vede qualcuno il cui clan in gioco è il tuo ma che non è ancora nel roster, chiede per lui (vedi il passo 3). Tutti gli altri hanno solo un account Anvil senza clan. È questo che impedisce a uno sconosciuto di entrare nel tuo clan scrivendone il nome.',
      },
    },

    filters: {
      title: 'Leggere la scheda Roster',
      intro:
        'La barra in alto divide il roster in **Members**, **Guests** e **Departed**. Clicca un segmento per filtrare. I chip sotto restringono ancora la lista:',
      rows: [
        {
          term: 'Active',
          body: 'i membri ancora nel roster. Ospiti e usciti restano fuori.',
        },
        {
          term: 'Quiet 7d+',
          body: 'i membri che il plugin non vede giocare da sette giorni o più. Chi non ha mai usato il plugin non c’è, perché non c’è nulla su cui giudicarlo. Il suo **Last played** mostra invece **no plugin data**.',
        },
        {
          term: 'Guests',
          body: 'i posti da ospite attuali: persone che giocano i tuoi eventi ma non sono nel tuo clan in gioco.',
        },
        {
          term: 'Roster only',
          body: 'membri e ospiti attuali che non hanno ancora un account sul sito. È normale per chi non ha mai fatto l’accesso con Discord. Restano nel roster; accedono e collegano il personaggio quando vogliono iscriversi a qualcosa.',
        },
        {
          term: 'Departed',
          body: 'chi è uscito in gioco, o è stato rimosso dallo staff. I risultati e la cronologia restano.',
        },
        {
          term: 'All',
          body: 'tutti quelli sopra.',
        },
      ],
      outro:
        'La colonna **Source** dice come è nato ogni posto: **Clan sync**, **Added manually** o **Applied or self-reported**. **Last played** viene dal plugin, non dalla sincronizzazione del roster.',
      note: {
        tag: 'Grado e ruolo sono cose diverse',
        body: 'I due menu a tendina accanto ai chip filtrano per grado in gioco e per ruolo sul sito. Il grado è quello che riporta il gioco. Il ruolo sul sito è quello che un admin imposta in **Staff & roles**. Uno non imposta mai l’altro.',
      },
    },

    review: {
      title: 'Richieste di adesione e Needs review',
      intro: 'Due tipi di persone aspettano un sì, e aspettano su schede diverse.',
      rows: [
        {
          term: 'Chi chiede di entrare',
          body: 'in cima alla scheda **Roster**, visibile solo mentre qualcuno aspetta. Una richiesta arriva dal sito (ha premuto **Apply** sulla pagina del tuo clan, o ha provato a entrare in uno dei tuoi eventi) o dal plugin (l’ha visto giocare nel tuo clan in gioco prima che il roster lo avesse). Ogni riga dice da dove, e se è membro di un altro clan. **Approve** gli dà un posto da ospite. **Decline** glielo comunica, con un DM su Discord quando il tuo bot riesce a raggiungerlo. Spuntane più di una per rispondere in blocco.',
        },
        {
          term: 'In attesa di conferma',
          body: 'su **Needs review**. Persone che hanno collegato uno dei personaggi del tuo roster guadagnandoci XP, chiedendolo o giocandoci con il plugin. Possono già giocare mentre aspettano. Controlla che il nome Discord corrisponda al personaggio, poi premi **Approve**. **Not our member** toglie il personaggio dalla tua lista e lo lascia al suo proprietario. **Report to Anvil** serve per un personaggio che non è suo.',
        },
        {
          term: 'Richieste di rivendicazione',
          body: 'sempre su **Needs review**. Qualcuno ha giocato un personaggio che qui è già un membro consolidato, quindi Anvil non glielo ha collegato da solo. Se sai che è lui, premi **Yes, that’s them**; altrimenti **Not them**. Un personaggio che è sempre stato solo nel tuo clan viene collegato subito. Uno che è anche in un altro clan passa ad Anvil per la decisione.',
        },
      ],
      note: {
        tag: 'Il badge non conta le richieste di adesione',
        body: 'Il numero su **Needs review**, e su **People** nella barra laterale, conta le conferme in attesa e le richieste di rivendicazione. Le richieste di adesione non ci sono, quindi guarda anche in cima alla scheda Roster.',
      },
    },

    policy: {
      title: 'Chi può entrare',
      intro:
        'Admin → People → **Who can join** contiene tre impostazioni, e solo gli admin vedono la scheda. Quella che decide come entrano gli esterni è **Players from other clans**:',
      rows: [
        {
          term: 'Ask first',
          body: 'il valore predefinito. Chi fa domanda, o chi il plugin rileva nel tuo clan in gioco, resta in attesa come richiesta di adesione finché lo staff non lo approva. Nessuno ha un posto senza un sì.',
        },
        {
          term: 'Let anyone in',
          body: 'basta chiedere. Riceve subito un posto da ospite e non viene creata nessuna richiesta. Buono per un evento aperto, rumoroso negli altri casi.',
        },
        {
          term: 'No guests',
          body: 'giocano solo i tuoi membri. I giocatori di altri clan non possono entrare nei tuoi eventi né chiedere di unirsi, e il plugin non crea nulla per loro.',
        },
      ],
      outro:
        '**Who can see this clan** è **Anyone** (un link a una board funziona per chiunque lo riceva) oppure **Members only** (tutti gli altri vedono la scheda del clan e un invito a fare domanda). **List in the Clan Hall** mette il clan nell’elenco pubblico dei clan. Disattivarlo non rende il clan privato.',
      note: {
        tag: 'Nessuna di queste tocca i tuoi membri',
        body: 'La sincronizzazione del roster dà il posto ai membri qualunque cosa dicano. Nemmeno il tuo staff viene mai trattato come ospite: il personaggio di un membro dello staff riceve un posto da membro senza richiesta.',
      },
    },

    manual: {
      title: 'Aggiungere qualcuno a mano',
      body: [
        'Roster → **+ Add Manually** mette un personaggio nel roster. Compila l’**RSN** e, se vuoi, il suo **Discord ID** e il **Rank**. Spunta **Add as guest** per chi non è nel tuo clan in gioco. Possono farlo sia i moderatori sia gli admin.',
        'Usalo per qualcuno che la sincronizzazione non vede ancora, come una recluta entrata dopo l’ultima. Il posto è segnato **Added manually**, e la sincronizzazione lo tratta come una tua decisione: se poi rimuovi un posto aggiunto a mano, la sincronizzazione successiva non lo rimette.',
        'Aggiungere qualcuno al roster non lo iscrive a nessun evento. Per quello apri la scheda **Sign-ups** dell’evento e usa **Add member**. Quella è riservata agli admin.',
      ],
    },

    removing: {
      title: 'Rimuovere e bannare',
      intro: 'Ogni riga del roster ha un menu di azioni. Fanno cose diverse:',
      rows: [
        {
          term: 'Demote to guest',
          body: 'resta nella lista e può ancora essere iscritto agli eventi, ma smette di contare come membro. **Promote to member** lo annulla.',
        },
        {
          term: 'Remove from roster',
          body: 'lo segna come uscito. Cronologia e risultati restano. Se è ancora nel tuo clan in gioco, la sincronizzazione successiva può rimetterlo.',
        },
        {
          term: 'Not our member',
          body: 'su Needs review, per un personaggio che qualcuno ha collegato ma che non è nel tuo clan. Esce dalla tua lista e resta al suo proprietario.',
        },
        {
          term: 'Ban from this clan',
          body: 'chiude ogni posto che la persona ha qui, alt compresi, le toglie qualsiasi ruolo dello staff e incarico sulle board che ha in questo clan, e le impedisce di tornare: la sincronizzazione del roster, il plugin e le richieste di adesione la rifiutano finché il ban non viene tolto. Il suo account Anvil e gli altri suoi clan non vengono toccati. Solo per admin, per chi ha un account sul sito e un ruolo sotto admin, dal menu della riga, da **Staff & roles**, o per più persone alla volta. Togliere un ban non la rimette dentro; rientra in gioco o la aggiungi tu.',
        },
      ],
      note: {
        tag: 'Un ban toglie anche il ruolo dello staff',
        body: 'Bannare qualcuno chiude i suoi posti e gli toglie il ruolo dello staff e qualsiasi incarico di editor o tesoriere sulle board di questo clan. Togliere il ban non glieli restituisce: reimposta il ruolo in Staff & roles se deve averlo.',
      },
    },

    faq: {
      title: 'Domande frequenti',
      intro: 'Cosa di solito spiega qualcuno nel posto sbagliato.',
      rows: [
        {
          term: 'Manca qualcuno del clan',
          body: 'Prima fai una sincronizzazione del roster: la lista cambia solo quando un admin la invia. Poi controlla **Departed**, nel caso sia stato rimosso, e se è bannato; la sincronizzazione salta chiunque sia bannato qui e riporta chi ha saltato. Se il clan supera il suo piano e il periodo di tolleranza è finito, una sincronizzazione smette di aggiungere nuovi membri finché non passi a un piano superiore o non sfoltisci il roster.',
        },
        {
          term: 'Qualcuno risulta ospite ma è nel clan',
          body: 'Di solito è ancora membro di un altro clan su Anvil. Un personaggio può essere membro di un solo clan alla volta, quindi la sincronizzazione lo mette qui come ospite e lo rende membro alla prima sincronizzazione dopo che ha lasciato l’altro clan. Altrimenti è entrato tramite una richiesta di adesione, oppure qualcuno l’ha retrocesso o aggiunto come ospite. Fai una sincronizzazione, o usa **Promote to member**.',
        },
        {
          term: 'Qualcuno ha fatto l’accesso ma non è nel roster',
          body: 'È previsto. Accedere crea un account Anvil, non un posto. Compare quando la sincronizzazione lo elenca, quando approvi la sua richiesta o quando lo aggiungi a mano.',
        },
        {
          term: 'Nomi come #Player1234',
          body: 'RuneLite mostra un segnaposto del genere per un attimo mentre un giocatore entra, e per i membri del clan che non sa nominare. Ora Anvil ignora questi nomi: la sincronizzazione li salta, il plugin non crea richieste per loro e le vecchie richieste con uno di questi nomi sono nascoste. Se ne resta uno nel tuo roster, è una riga vecchia. **Remove from roster** la toglie.',
        },
        {
          term: 'Un membro rimosso continua a tornare',
          body: 'Rimuovere qualcuno non cambia il clan in gioco, quindi la sincronizzazione successiva lo rimette finché il gioco lo elenca ancora. Rimuovilo in gioco, oppure bannalo qui.',
        },
        {
          term: 'Un moderatore non vede Who can join',
          body: 'È una scheda riservata agli admin, come Staff & roles. Vedi [Ruoli dello staff: chi può fare cosa]({staffGuide}).',
        },
      ],
    },
  },

  staffRoles: {
    metaTitle: 'Ruoli dello staff: chi può fare cosa — Anvil',
    metaDescription:
      'I ruoli del clan su Anvil (proprietario, admin, tesoriere, moderatore, membro), cosa può raggiungere ciascuno, come nominare un moderatore, chi può assegnare quale ruolo, e gli incarichi che valgono per un solo evento.',
    eyebrow: 'Anvil · per proprietari e admin',
    title: 'Ruoli dello staff: chi può fare cosa',
    dek: 'Cinque ruoli, impostati clan per clan in Admin → People → **Staff & roles**. Un ruolo qui non dà nulla in nessun altro clan, e nessuno può assegnare un ruolo pari o superiore al proprio. Questa pagina è la mappa completa: cosa raggiunge ogni ruolo, come assegnarlo e gli incarichi che valgono per un singolo evento.',
    facts: [
      { strong: 'Per clan', rest: 'un ruolo qui non vale nulla altrove' },
      { strong: 'Sotto il tuo', rest: 'è tutto ciò che puoi assegnare' },
      { strong: 'Proprietario', rest: 'passa di mano solo con un trasferimento' },
    ],
    footnote:
      'I ruoli vengono ricontrollati a ogni caricamento di pagina, quindi una modifica vale dal clic successivo della persona; non serve che esca. Per il roster in sé, vedi [La tua gente]({peopleGuide}). Per la giornata di un moderatore, vedi [Di turno]({moderatorGuide}).',

    roles: {
      title: 'I ruoli',
      intro: 'Chiunque acceda con Discord parte come semplice **Member**. Sopra:',
      rows: [
        {
          term: 'Proprietario',
          body: 'chi ha creato il clan, finché non lo passa a un altro. Tutto ciò che può fare un admin, più trasferire la proprietà ed eliminare il clan. Ce n’è esattamente uno, e nessuno può retrocederlo, rimuoverlo o bannarlo.',
        },
        {
          term: 'Admin',
          body: 'tutto tranne cedere il clan: eventi e board, impostazioni, Discord, staff e i soldi del clan.',
        },
        {
          term: 'Tesoriere',
          body: 'quote, cassa e premi, oltre a tutto ciò che fa un moderatore: il roster, le prove, le competizioni, lo Schedule e Needs review.',
        },
        {
          term: 'Moderatore',
          body: 'nuovi arrivati, roster, prove, competizioni settimanali ed eventi del clan. Niente eventi o board, niente impostazioni, niente staff e niente soldi.',
        },
        {
          term: 'Membro',
          body: 'nessun incarico da staff. Gioca, si iscrive e può segnalare una donazione alla cassa.',
        },
      ],
      outro:
        'Sotto il ruolo, in Staff & roles, ci sono due caselle per chiunque sia sotto admin, semplici membri compresi. **Can build bingo boards** apre la scheda Tiles di ogni board e la Task library. **Can write guides** permette di scrivere le guide del clan. Gli admin le hanno già entrambe.',
    },

    assign: {
      title: 'Nominare un moderatore',
      intro:
        'Deve aver fatto l’accesso con Discord e collegato un personaggio presente nel tuo roster, come membro o come ospite. Poi:',
      steps: [
        'Apri Admin → **People** → **Staff & roles**.',
        'La lista si apre su **Staff**. Passa a **Members** o **All accounts** e cerca il suo nome.',
        'Nella colonna **Role**, scegli **Moderator: newcomers, roster, sign-ups, proofs**. Si salva appena lo scegli.',
        'Se deve anche costruire board, spunta **Can build bingo boards**.',
      ],
      outro:
        'Non ha ancora fatto l’accesso? Trova il suo personaggio nella scheda **Roster**, apri il suo menu e scegli **Set role**. Il ruolo viene salvato sul personaggio. Lo riceve la prima volta che accede e lo collega, oppure, se è in attesa su Needs review, quando un moderatore lo approva.',
      note: {
        tag: 'Toglierlo',
        body: 'Rimetti il ruolo su **Member**. Cambiare il ruolo di qualcuno toglie anche gli incarichi che aveva sulle board di questo clan (vedi il passo 5), quindi riassegnaglieli dopo se deve tenerli.',
      },
    },

    who: {
      title: 'Chi può assegnare cosa',
      intro:
        'Staff & roles è una scheda riservata agli admin, e ogni modifica fatta lì viene controllata con due regole: puoi assegnare solo un ruolo inferiore al tuo, e puoi modificare solo chi ha un ruolo inferiore al tuo.',
      rows: [
        {
          term: 'Il proprietario',
          body: 'può assegnare o togliere Admin, Treasurer e Moderator.',
        },
        {
          term: 'Un admin',
          body: 'può assegnare o togliere Treasurer e Moderator. Un admin non può nominare un altro admin, modificare un altro admin o cambiare il proprio ruolo.',
        },
        {
          term: 'Tesorieri e moderatori',
          body: 'non possono cambiare il ruolo di nessuno. La scheda per loro è nascosta.',
        },
        {
          term: 'Nessuno',
          body: 'può cambiare il ruolo del proprietario, rimuoverlo o bannarlo. Il clan tiene anche sempre almeno un admin: l’ultimo non può essere retrocesso.',
        },
      ],
      note: {
        tag: 'Cedere il clan',
        body: 'Può farlo solo il proprietario, e solo a favore di qualcuno che è già admin: la riga di quell’admin ha un’azione **Make owner**. Per sicurezza servono 3 giorni, come per cambiare il PIN della banca: un banner su ogni pagina di amministrazione dice quando avverrà, fino ad allora puoi annullare con **Cancel**, lui può rifiutare con **Decline**, e lo staff di Anvil viene avvisato e può fermarlo. Passati i 3 giorni lui diventa proprietario e tu diventi un admin qualunque. Solo il nuovo proprietario può ritrasferirla.',
      },
    },

    table: {
      title: 'Chi può fare cosa',
      intro:
        'Cosa raggiunge ogni ruolo nell’area admin. “Se spuntata” indica la casella **Can build bingo boards** o **Can write guides** in Staff & roles.',
      areaLabel: 'Area',
      columns: ['Proprietario', 'Admin', 'Tesoriere', 'Moderatore', 'Membro'],
      rows: [
        { area: 'Dashboard', cells: ['Sì', 'Sì', 'Sì', 'Sì', 'No'] },
        { area: 'Eventi: creare, modificare, squadre, iscrizioni, avvio', cells: ['Sì', 'Sì', 'No', 'No', 'No'] },
        { area: 'Caselle delle board e Task library', cells: ['Sì', 'Sì', 'Se spuntata', 'Se spuntata', 'Se spuntata'] },
        { area: 'Prove da controllare', cells: ['Sì', 'Sì', 'Sì', 'Sì', 'No'] },
        { area: 'Competizioni settimanali', cells: ['Sì', 'Sì', 'Sì', 'Sì', 'No'] },
        { area: 'Eventi del clan', cells: ['Sì', 'Sì', 'Sì', 'Sì', 'No'] },
        { area: 'Calendario', cells: ['Sì', 'Sì', 'Sì', 'Sì', 'No'] },
        { area: 'Roster: vedere, aggiungere, rimuovere', cells: ['Sì', 'Sì', 'Sì', 'Sì', 'No'] },
        { area: 'Richieste di adesione e Needs review', cells: ['Sì', 'Sì', 'Sì', 'Sì', 'No'] },
        { area: 'Bannare qualcuno dal clan', cells: ['Sì', 'Sotto admin', 'No', 'No', 'No'] },
        { area: 'Staff & roles', cells: ['Sì', 'Sotto admin', 'No', 'No', 'No'] },
        { area: 'Who can join', cells: ['Sì', 'Sì', 'No', 'No', 'No'] },
        { area: 'Cassa e scale dei premi', cells: ['Sì', 'Sì', 'Sì', 'No', 'No'] },
        { area: 'Quote: segnare come incassate', cells: ['Sì', 'Sì', 'Sì', 'No', 'No'] },
        { area: 'Quote: confermare (la seconda firma)', cells: ['Sì', 'Sì', 'No', 'No', 'No'] },
        { area: 'Impostazioni Discord', cells: ['Sì', 'Sì', 'No', 'No', 'No'] },
        { area: 'Pubblicare su Discord', cells: ['Sì', 'Sì', 'No', 'No', 'No'] },
        { area: 'Impostazioni del clan: Profile, Features, Rules & scoring, Boosts', cells: ['Sì', 'Sì', 'No', 'No', 'No'] },
        { area: 'Piano e fatturazione', cells: ['Sì', 'Sì', 'No', 'No', 'No'] },
        { area: 'Guide', cells: ['Scrittura', 'Scrittura', 'Lettura; scrittura se spuntata', 'Lettura; scrittura se spuntata', 'Scrittura se spuntata'] },
        { area: 'Registro attività', cells: ['Sì', 'Sì', 'Sì', 'Sì', 'No'] },
        { area: 'Sincronizzare il roster da RuneLite', cells: ['Sì', 'Sì', 'No', 'No', 'No'] },
        { area: 'Trasferire la proprietà, eliminare il clan', cells: ['Sì', 'No', 'No', 'No', 'No'] },
      ],
      note: {
        tag: 'Nascosto non vuol dire permesso',
        body: 'La barra laterale elenca solo ciò che il tuo ruolo può usare, ma il controllo che conta avviene sul server. Scrivere l’indirizzo di una pagina che il tuo ruolo non può usare ti rimanda alla dashboard, e l’azione dietro viene rifiutata.',
      },
    },

    event: {
      title: 'Incarichi su un solo evento',
      intro:
        'Alcuni incarichi valgono per un singolo evento invece che per il clan. Li assegna un admin sull’evento stesso, e raggiungono quell’evento e nient’altro, quindi si possono dare tranquillamente a un semplice membro.',
      rows: [
        {
          term: 'Editor della board',
          body: 'costruisce e modifica le caselle di quella board. Si assegna in **Settings** → **Staff** → **Board staff** dell’evento, oppure con **Boards…** tra le azioni di una persona in Staff & roles. Un membro che ne ha uno vede solo le sue board nell’area admin.',
        },
        {
          term: 'Tesoriere della board',
          body: 'incassa le quote di quella board e gestisce i suoi pagamenti, senza accedere alla cassa del clan. Nell’area admin vede solo le proprie board, e di ciascuna solo le schede **Sign-ups** e **Prizes**. Si assegna anche questo in **Board staff**.',
        },
        {
          term: 'Staff della squadra',
          body: 'gestisce una squadra: la sua formazione, gli invii e le prove, e il segnare come pagate le quote dei suoi giocatori. Non può toccare un’altra squadra, modificare la board, fare scelte nel draft né sostituire nessuno una volta che l’evento è partito. Si aggiunge dalla pagina della squadra in **Team staff**. È così che il moderatore di un clan in visita gestisce la sua metà di un clan contro clan.',
        },
        {
          term: 'Capitano',
          body: 'nominato dall’organizzatore per una squadra. Tutto ciò che può fare lo staff della squadra, più le scelte del draft della squadra.',
        },
      ],
      note: {
        tag: 'Un ruolo del clan sostituisce gli incarichi sulle board',
        body: 'Dare a qualcuno un ruolo del clan, o cambiarlo, toglie i suoi incarichi di editor e tesoriere della board sulle board di questo clan. Staff & roles ti avvisa prima quando sono gli unici incarichi che ha. Riassegnaglieli dopo se deve tenerli.',
      },
    },

    safety: {
      title: 'Tenere tutto al sicuro',
      intro: 'Queste regole valgono comunque siano impostati i ruoli.',
      rows: [
        {
          term: 'Il proprietario è protetto',
          body: 'la sua riga in Staff & roles mostra **Protected**. Il suo ruolo non si può cambiare e non può essere bannato. La proprietà passa di mano solo quando è lui a trasferirla.',
        },
        {
          term: 'Gli admin non possono togliersi di mezzo a vicenda',
          body: 'un admin non può né retrocedere né bannare un altro admin, né uno alla volta né più insieme. Quando due admin non sono d’accordo, decide il proprietario. Un ban toglie anche alla persona il ruolo dello staff e gli incarichi sulle board in questo clan.',
        },
        {
          term: 'I soldi richiedono due persone',
          body: 'quando una quota va confermata, la conferma deve arrivare da un admin diverso da chi l’ha segnata come incassata. Quante conferme servono, da zero a cinque, si imposta in **Clan settings** → **Rules & scoring** → **Fee sign-off**. Un admin che gestisce i soldi da solo può comunque forzare la chiusura di una quota, con un pulsante a parte.',
        },
        {
          term: 'Cosa non può fare un moderatore',
          body: 'creare o modificare eventi, cambiare le impostazioni o Discord, dare un ruolo a chiunque (se stesso compreso), né toccare i soldi del clan.',
        },
        {
          term: 'Resta tutto registrato',
          body: 'cambi di ruolo, trasferimenti di proprietà, ban e risposte alle richieste di adesione finiscono nell’**Activity log**, che ogni membro dello staff può leggere.',
        },
        {
          term: 'I ruoli di Discord sono un’altra cosa',
          body: 'la sincronizzazione dei ruoli di Anvil abbina i ruoli di Discord ai **gradi in gioco**, non ai ruoli del sito. Nominare qualcuno moderatore qui non gli dà nulla nel tuo server Discord, e un ruolo da moderatore che hai dato a mano su Discord non viene toccato. L’unico comando del bot che cambia qualcosa, aggiungere alla cassa con `/coffer`, controlla il ruolo sul sito: tesoriere, admin o proprietario.',
        },
      ],
    },
    log: {
      title: 'Il registro delle attività',
      body: [
        '**Activity log** nel menu admin elenca gli ultimi 200 cambiamenti, e ogni membro dello staff può leggerlo: ingressi, uscite, rinomine e verifiche, passaggi di proprietà, capitani nominati e rimossi, iscrizioni approvate o rifiutate, quote confermate, funzioni attivate e impostazioni cambiate. **Filter by event type** lo restringe.',
        'È anche dove si sistemano i duplicati. **Merge two members** unisce un duplicato a quello vero, e **Suspected renames** elenca i cambi di nome che Anvil ha notato per farti confermare o rifiutare.',
      ],
    },
  },

  supporter: {
    metaTitle: 'Anvil Supporter: fasce e vantaggi — Anvil',
    metaDescription:
      'Cosa ottengono Anvil Supporter, Champion e Patron: colori del nome e stella, GZ dorato, avatar e banner animati, la vetrina, eventi tra amici, sfide testa a testa, chat dell’evento e boost del clan. Come funziona il pagamento con Gumroad e cosa succede quando disdici.',
    eyebrow: 'Anvil · per i giocatori',
    title: 'Anvil Supporter: fasce e vantaggi',
    dek: 'Anvil Supporter è un abbonamento personale che paga i server di Anvil. Ha tre fasce, ognuna con tutto ciò che ha quella sotto. Ogni vantaggio è estetico o dà più spazio per organizzare: tracciamento, eventi, punteggi e le tue statistiche restano gratis per tutti, e niente qui cambia ciò che un evento conta.',
    facts: [
      { strong: 'Da $1 al mese', rest: 'o $10 all’anno' },
      { strong: 'Solo estetica', rest: 'mai un punteggio, un grado o un oggetto' },
      { strong: 'Niente cancellato', rest: 'quando smetti' },
    ],
    footnote:
      'Tutto questo si imposta sul sito in **Settings** → **Supporter**, **Profile look** e **Clan boosts**. Per i boost nel dettaglio, vedi [Potenziare un clan con i boost]({boostsGuide}). Per dove compaiono i tuoi colori in RuneLite, vedi [Il pannello laterale, scheda per scheda]({panelGuide}).',

    tiers: {
      title: 'Le tre fasce',
      intro: 'I prezzi sono sulla pagina **Anvil Supporter**, `/supporter`. Un piano annuale costa dieci mesi.',
      rows: [
        {
          term: 'Supporter',
          body: '$1 al mese o $10 all’anno. Un nome dorato e una stella, un GZ dorato, una vetrina con 4 spazi, e puoi ospitare un evento tra amici.',
        },
        {
          term: 'Champion',
          body: '$2 al mese o $20 all’anno. Un nome sfumato tra i nostri predefiniti (o un tuo colore), il tuo avatar e il tuo banner (animati, se vuoi), 8 spazi in vetrina, una chat dell’evento più veloce e 1 boost del clan.',
        },
        {
          term: 'Patron',
          body: '$5 al mese o $50 all’anno. La tua sfumatura personale fino a 4 colori, in movimento, 12 spazi in vetrina, nessuna attesa nella chat dell’evento, 2 eventi tra amici alla volta e 2 boost del clan.',
        },
      ],
      note: {
        tag: 'Tempo dagli inviti',
        body: 'In Settings → Supporter trovi un link di invito. Quando un amico che hai invitato paga, guadagni mesi gratis; il premio arriva due settimane dopo il suo primo pagamento. Il tempo guadagnato così dà tutti i vantaggi della sua fascia tranne i boost del clan.',
      },
    },

    compare: {
      title: 'Cosa ottiene ogni fascia',
      intro: 'La stessa tabella della pagina Supporter, più i vantaggi della chat.',
      table: {
        areaLabel: 'Vantaggio',
        columns: ['Gratis', 'Supporter', 'Champion', 'Patron'],
        rows: [
          { area: 'Colori del nome', cells: ['—', 'Oro', 'Preimpostati o un colore tuo', 'Preimpostati o fino a quattro colori, in movimento'] },
          { area: 'Stella accanto al nome', cells: ['—', 'Sì', 'Sì', 'Sì'] },
          { area: 'GZ dorato', cells: ['—', 'Sì', 'Sì', 'Sì'] },
          { area: 'Avatar e banner tuoi, animati', cells: ['—', '—', 'Sì', 'Sì'] },
          { area: 'Vetrina', cells: ['—', '4 spazi', '8 spazi', '12 spazi'] },
          { area: 'Eventi tra amici (alla volta · giocatori)', cells: ['Solo partecipare', '1 · 10', '1 · 25', '2 · 50'] },
          { area: 'Sfide testa a testa', cells: ['1 attiva', '5 attive', 'Illimitate', 'Illimitate'] },
          { area: 'Chat dell’evento: attesa tra i messaggi', cells: ['5 s', '3 s', '1 s', 'Nessuna'] },
          { area: 'Boost del clan', cells: ['—', '—', '1', '2'] },
        ],
      },
      outro:
        'In **Settings** → **In-game chat** ce ne sono altri tre: i tuoi colori del feed in chat (Supporter), la scelta di cosa copre il tuo riepilogo all’accesso (Champion), e una stella accanto al tuo nome nel feed in chat degli altri giocatori (Patron).',
    },

    names: {
      title: 'Colori del nome',
      intro:
        'Si impostano in **Settings** → **Supporter**, in **Your name’s look**. L’anteprima mostra il tuo nome su uno sfondo scuro e su uno chiaro.',
      rows: [
        {
          term: 'Supporter',
          body: 'oro pieno. Non c’è niente da scegliere.',
        },
        {
          term: 'Champion',
          body: 'una delle sfumature preimpostate (**Classic**, quella predefinita, **Ember**, **Ocean**, **Aurora**, **Rose gold** o **Toxic**), oppure **Your own**: un solo colore fisso. Su tutti i tuoi personaggi puoi usare al massimo due colori tuoi diversi.',
        },
        {
          term: 'Patron',
          body: 'tutte le preimpostate più **Prism**, la predefinita dei Patron, oppure **Your own** con da uno a quattro colori. Un colore resta fermo; da due a quattro formano una sfumatura che scorre da sinistra a destra.',
        },
      ],
      outro:
        '**Your Anvil display name** è il nome del tuo account collegato a Discord. In **Your RuneScape characters**, scegli **Same for all** o **Customize each** per dare a ogni personaggio il suo aspetto. Premi **Save** (o **Save for all characters**); **Reset to default** torna ai colori della tua fascia.',
      note: {
        tag: 'Sfondi scuri e chiari',
        body: 'Il sito, il pannello del plugin e Discord sono scuri; la chatbox opaca del gioco è chiara. Anvil regola i tuoi colori perché restino leggibili su ciascuno. Se vuoi un aspetto diverso su uno di essi, attiva **Set a separate look for dark backgrounds** o **for light backgrounds**. Quell’aspetto viene mostrato esattamente come l’hai scelto, senza correzione del contrasto, e l’anteprima ti avvisa quando è difficile da leggere.',
      },
    },

    where: {
      title: 'Dove compaiono i tuoi colori',
      intro: 'I tuoi colori e la stella vanno ovunque vada il tuo nome:',
      rows: [
        {
          term: 'Sul sito',
          body: 'board, roster, profili, il tuo nome nella barra in alto e i nomi dei tuoi personaggi. La stella porta i tuoi colori.',
        },
        {
          term: 'Nel pannello del plugin',
          body: 'il Feed, la chat dell’evento, le schede e la riga **Tracking**. La sfumatura di un Patron scorre; ogni giocatore può fermarla con **Animated names**.',
        },
        {
          term: 'In gioco',
          body: 'per gli altri giocatori che usano il plugin Anvil: chat pubblica, del clan, degli amici e privata, annunci del clan, avvisi di accesso, liste di amici e del clan, e il menu del clic destro (mai sui mondi PvP o nel Wilderness). Nella chat di gioco, la stella è solo dei Patron.',
        },
        {
          term: 'Su Discord',
          body: 'una stella accanto al tuo nome nei messaggi di Anvil, disegnata con i tuoi colori se ne hai scelti.',
        },
        {
          term: 'GZ dorato',
          body: 'sul drop di un compagno di clan nel feed del tuo clan sul sito, il tuo GZ può essere dorato. Solo i Supporter possono darlo.',
        },
      ],
      note: {
        tag: 'Solo sui personaggi che risultano tuoi',
        body: 'I colori compaiono solo sui personaggi che il plugin ha confermato come tuoi, sul sito e in gioco. Per toglierli dai tuoi nomi nella chat di gioco degli altri, togli la spunta a **Show my colours on my characters’ names in game chat** in Settings → Supporter.',
      },
    },

    profile: {
      title: 'Avatar, banner e vetrina',
      intro: 'Tutti e tre stanno in **Settings** → **Profile look**.',
      rows: [
        {
          term: 'Avatar e banner',
          body: 'Champion e Patron. Carica i tuoi; una GIF o una WebP resta animata. Compaiono sulla tua scheda, sul tuo profilo e su ogni tuo personaggio, sul sito e nel plugin. Un banner può pesare fino a 6 MB ed essere almeno 600×150; un avatar fino a 2 MB.',
        },
        {
          term: 'Per personaggio',
          body: 'dai a un personaggio il suo banner o avatar, o entrambi. Sostituisce il tuo predefinito solo sulle pagine e sulla scheda del plugin di quel personaggio.',
        },
        {
          term: 'Vetrina',
          body: 'i tuoi drop, kill count e tempi migliori fissati sul profilo: 4 spazi per Supporter, 8 per Champion, 12 per Patron. Gli elementi fissati da personaggi che non condividi restano privati.',
        },
      ],
    },

    hosting: {
      title: 'Eventi tra amici, testa a testa e chat',
      intro: 'I vantaggi che ti danno più spazio per giocare, invece di un aspetto:',
      rows: [
        {
          term: 'Eventi tra amici',
          body: 'organizza il tuo bingo, bingo in solitaria o gara per gli amici da **Host an event for your friends**, tracciato dal plugin come un evento del clan. Gli amici entrano con il tuo link di invito. Supporter: 1 evento attivo, 10 giocatori. Champion: 1 evento, 25 giocatori. Patron: 2 alla volta, 50 giocatori in tutto. Chiunque può partecipare a uno.',
        },
        {
          term: 'Testa a testa',
          body: 'sfida un amico dal suo profilo: il primo a ottenere un drop, oppure più kill o XP in 1 ora, 24 ore o 7 giorni. Solo per vantarsene. I giocatori gratuiti possono averne 1 aperta alla volta, i Supporter 5, Champion e Patron quante ne vogliono.',
        },
        {
          term: 'Chat dell’evento',
          body: 'quanto aspetti tra un messaggio e l’altro: 5 secondi senza fascia, 3 per i Supporter, 1 per i Champion, nessuna attesa per i Patron. Quando la chat di una board si affolla, tutti aspettano 10 secondi, Patron compresi.',
        },
        {
          term: 'Boost del clan',
          body: 'Champion 1, Patron 2, finché paghi. Vedi [Potenziare un clan con i boost]({boostsGuide}).',
        },
      ],
    },

    billing: {
      title: 'Pagare, cambiare e disdire',
      intro: 'Anvil Supporter si paga tramite Gumroad, mensilmente o annualmente.',
      steps: [
        'Accedi ad Anvil e apri `/supporter`.',
        'Premi **Choose Supporter**, **Choose Champion** o **Choose Patron**. Si apre il checkout di Gumroad, con pagamento mensile o annuale.',
        'Paga. I tuoi vantaggi si attivano appena Gumroad lo comunica ad Anvil, e la tua fascia compare sulla pagina Supporter come **Your tier**.',
      ],
      outro:
        'Per cambiare fascia, usa **Change tier** in Settings → Supporter. Per disdire o aggiornare la carta, usa **Manage on Gumroad** nello stesso punto. Un abbonamento disdetto mantiene tutti i vantaggi fino alla fine del periodo che hai pagato.',
      note: {
        tag: 'Parti sempre da /supporter',
        body: 'Il pulsante **Choose** porta un codice che dice ad Anvil quale account ha pagato. Anvil non abbina mai un pagamento tramite email, quindi comprare direttamente da Gumroad, senza quel pulsante, lascia il pagamento scollegato. Se ti è successo, chiedi nel Discord di Anvil e lo staff può collegarlo al tuo account a mano.',
      },
    },

    lapse: {
      title: 'Scendere di fascia o smettere',
      intro:
        'Niente di ciò che hai impostato viene cancellato. Ogni vantaggio viene confrontato con la fascia che hai in questo momento, quindi si spegne da solo e torna appena rinnovi.',
      rows: [
        {
          term: 'Colori del nome',
          body: 'la tua scelta resta salvata. Porti i colori della nuova fascia, o nessuno, finché non torna una fascia che lo permette.',
        },
        {
          term: 'Avatar e banner',
          body: 'sotto Champion mostrano il loro primo fotogramma fermo invece di muoversi.',
        },
        {
          term: 'Vetrina',
          body: 'mostra i primi elementi fissati che la tua fascia permette e nasconde il resto. Senza fascia è nascosta; gli elementi fissati ti aspettano.',
        },
        {
          term: 'Boost del clan',
          body: 'i tuoi boost più vecchi continuano a contare e gli altri vengono messi in pausa, non rimossi.',
        },
      ],
      note: {
        tag: 'Un upgrade temporaneo dallo staff di Anvil',
        body: 'Lo staff può dare a qualcuno una fascia più alta per un periodo, per esempio come ringraziamento. Si aggiunge a ciò che paghi e non cambia mai il tuo abbonamento. Settings → Supporter mostra **A gift from Anvil** e quando finisce; dopo torni alla fascia che paghi. Un regalo dà spazi per i boost del clan solo se lo staff li include.',
      },
    },
  },

  sidePanel: {
    metaTitle: 'Il pannello laterale di Anvil, scheda per scheda — Anvil',
    metaDescription:
      'Cosa mostra ogni scheda del pannello laterale di Anvil in RuneLite (Clan, Feed, You, Lookup e l’ingranaggio), come funzionano la chat dell’evento e le reazioni del Feed, e le impostazioni del plugin per il feed nella chat di gioco, i colori Supporter e i nomi animati.',
    eyebrow: 'Anvil · per i giocatori',
    title: 'Il pannello laterale, scheda per scheda',
    dek: 'Il pulsante Anvil nella barra laterale di RuneLite apre un pannello con quattro schede e un ingranaggio: **Clan**, **Feed**, **You**, **Lookup** e ⚙. Quasi tutto ciò che mostra arriva dal sito, quindi resta aggiornato senza aggiornare il plugin. Alcune cose qui sotto sono segnate come in arrivo con il prossimo aggiornamento del plugin.',
    facts: [
      { strong: 'Quattro schede', rest: 'e un ingranaggio per sincronizzazione e impostazioni' },
      { strong: 'Chat dell’evento', rest: 'nella scheda Feed' },
      { strong: 'GZ, Sad, Sit', rest: 'sulle righe del Feed' },
    ],
    footnote:
      'Installare il plugin e accedere è spiegato nella [guida di installazione del plugin RuneLite]({pluginGuide}). I colori Supporter, la stella e i vantaggi della chat sono spiegati in [Anvil Supporter: fasce e vantaggi]({supporterGuide}).',

    header: {
      title: 'La parte alta del pannello',
      intro: 'Sopra le schede ci sono il titolo, **Refresh** e la riga dell’account.',
      rows: [
        {
          term: 'Refresh',
          body: 'ricarica il pannello, scheda Feed compresa. Mentre lavora mostra **Refreshing…**. Con il prossimo aggiornamento del plugin ricarica anche You e Lookup, così un nuovo avatar o banner compare subito, e non svuota più la scheda Feed.',
        },
        {
          term: 'Tracking',
          body: 'la riga sotto il titolo indica il personaggio tracciato, con i suoi colori Supporter se ne ha. **Not my account…** smette di tracciare un personaggio che qualcun altro gioca su questo computer; **Track again** lo annulla.',
        },
        {
          term: 'Il menu dell’account',
          body: 'il link ⋯ apre **View my profile on Anvil**, **Not my account…** e **Sign out…**. Con il prossimo aggiornamento del plugin ha anche **Become a Supporter**, o **Your Supporter perks** se lo sei già.',
        },
        {
          term: 'Progressi stagionali',
          body: 'con il prossimo aggiornamento del plugin, sui mondi Leagues, Deadman e altri mondi stagionali, una riga dice **Sharing season progress · Turn off**. Manda al tuo clan le tue reliquie, aree e task (con uno screenshot); il tuo clan sceglie sul sito cosa pubblicare. **Turn on** li condivide di nuovo. Lo stesso interruttore è **Share seasonal activity** nelle impostazioni del plugin.',
        },
      ],
    },

    clan: {
      title: 'Clan',
      intro:
        'I tuoi eventi e il tuo clan. Nello spazio di un creator la scheda si chiama **Space**.',
      rows: [
        {
          term: 'Il menu del clan',
          body:
            'visibile quando giochi in più di un clan o spazio. **All clans** (predefinito) mostra tutto ciò che stai giocando, con l\'evento in corso per primo. Scegliere un clan restringe il pannello a quello e vi registra i tuoi invii.',
        },
        {
          term: 'Fai questo ora',
          body:
            'una scheda dorata in alto che indica la cosa più utile da fare adesso, come unirsi a un evento, rispondere a un sondaggio o fare il tuo primo tiro di partenza.',
        },
        {
          term: 'Eventi',
          body:
            'ogni bacheca in corso e in arrivo, Skill o Boss of the Week ed evento del clan, con la tua posizione. Poi **Your other boards**, **Also live** e **Your clan**.',
        },
        {
          term: 'Una bacheca',
          body:
            'aprila per le sue classifiche (i primi tre e le tue righe, con **View all** per il resto), squadre, missioni, attività recente, le tessere più vicine e **View all tiles**. I suoi pulsanti **Feed** e **Chat** aprono quella bacheca nella scheda Feed.',
        },
        {
          term: 'Movimenti in classifica',
          body:
            'un **▲** verde o un **▼** corallo con un numero accanto a un nome indica quanto si è spostato dall\'inizio della giornata.',
        },
        {
          term: 'Un evento del clan',
          body: '**I’m going**, **Sign me up** o **Answer the survey**, a seconda dell\'evento.',
        },
      ],
    },

    feed: {
      title: 'Feed',
      intro:
        'I grandi momenti del tuo clan e delle tue board, in diretta: drop, pet, achievement, quest, morti e caselle completate.',
      rows: [
        {
          term: 'Di chi è il feed',
          body:
            'il menu in alto elenca **Clan ·** per ogni clan di cui sei membro e **Event ·** per ogni bacheca in corso a cui partecipi. Si apre sulla tua bacheca se ne hai una, altrimenti sul tuo clan.',
        },
        {
          term: 'Filtri',
          body:
            '**All**, **Tiles** (solo bacheche), **Drops**, **Pets**, **Achievements**, **Deaths**, **Milestones** (slayer, clue, conteggi di uccisioni e simili, una volta che i giocatori li attivano) e **My team** su una bacheca dove sei in squadra. Un feed del clan ha anche un pulsante di attività per la modalità di gioco per Leghe e altre modalità.',
        },
        {
          term: 'Nuove righe',
          body: 'arrivano da sole. Se hai scorso via, una pillola **↑ N new** ti riporta a loro.',
        },
      ],
      note: {
        tag: 'Non è il feed nella chat di gioco',
        body: 'La scheda Feed funziona qualunque cosa dicano le impostazioni del plugin. **Show feed in game chat** (passo 8) è l’impostazione separata che lo stampa anche nella tua chatbox.',
      },
    },

    reactions: {
      title: 'Reazioni',
      intro: 'Ogni riga del Feed ha la sua reazione sotto:',
      rows: [
        {
          term: 'GZ',
          body: 'su drop, pet e achievement. Il conteggio compare accanto, per esempio **GZ 3**.',
        },
        {
          term: 'Sad e Sit',
          body: 'sulle morti, al posto di GZ. Sit è il modo del gioco per dire a chi è morto di andarsi a sedere.',
        },
        {
          term: 'Chi può reagire',
          body: 'sul feed di un clan, i compagni di clan. Su una board, i suoi giocatori e lo staff di chi la ospita; quando una board nasconde la classifica, i giocatori possono reagire solo alle righe della propria squadra.',
        },
        {
          term: 'Chi ha reagito',
          body: 'passa il mouse su una reazione per vedere i nomi, per esempio “GZ · Mossy and 3 others”. Cliccala di nuovo per ritirare la tua.',
        },
      ],
      note: {
        tag: 'Con il prossimo aggiornamento del plugin',
        body: 'Le reazioni diventano pulsanti a pillola, colorati quando una è tua, e le reazioni degli altri si aggiornano in diretta per tutti quelli che guardano, anche sugli altri tuoi client aperti. Oggi il conteggio cambia quando reagisci o quando il Feed si ricarica. Il GZ dorato, la reazione dei Supporter, si dà nei feed del sito; la scheda Feed ha GZ, Sad e Sit.',
      },
    },

    chat: {
      title: 'Chat dell’evento',
      intro:
        'Una board con la chat attiva ha un interruttore **Feed / Chat** in cima alla scheda Feed, per i giocatori di quella board e lo staff di chi la ospita. Anche la pagina della board nella scheda Clan ha un pulsante **Chat**.',
      rows: [
        {
          term: 'Tutti o la tua squadra',
          body:
            'Scegli un canale con i chip in alto: **All teams** per l\'intera bacheca, **My team** solo per la tua squadra, e **Announcements**, dove possono scrivere solo host e moderatori. Ogni chip mostra il numero di righe non lette. Le righe di host e moderatori sono contrassegnate **HOST** o **MOD**.',
        },
        {
          term: 'Invio',
          body:
            'scrivi nella casella e premi Invio. Le righe possono avere fino a 200 caratteri, e solo host e moderatori possono inviare link.',
        },
        {
          term: 'Frequenza',
          body:
            'l\'attesa tra le tue righe segue il tuo livello di Supporter: 5 secondi senza, 3 per i Supporter, 1 per i Champion, nessuna per i Patron. La riga sotto la casella indica la tua. Lo staff non aspetta mai.',
        },
        {
          term: 'Modalità lenta',
          body:
            'quando la chat di una bacheca è molto affollata, tutti aspettano almeno 10 secondi per un minuto, Patron inclusi. Nessuno può inviare più di 10 righe in 10 secondi.',
        },
        {
          term: 'Moderazione',
          body:
            'host e moderatori possono fare clic destro su una riga per **Delete message** o **Mute** qualcuno, e mettere in pausa la chat con **Pause chat**. Una pausa impedisce di scrivere a tutti tranne allo staff, eccetto in **Announcements**. **Mute** nel pannello è un ban che dura finché non viene revocato dalla pagina di moderazione. Lì puoi anche dare un timeout di 5 minuti, 1 ora o 24 ore (o da 1 minuto a 30 giorni), che chiude ogni canale per quella persona, e filtrare la chat per canale.',
        },
      ],
      outro:
        'Una serie di messaggi della stessa persona condivide un solo nome e orario, finché non c’è una pausa di 5 minuti. La chat resta per 7 giorni dopo la fine dell’evento.',
    },

    you: {
      title: 'You e Lookup',
      intro: 'Due schede per le schede giocatore: la tua e quella di chiunque altro.',
      rows: [
        {
          term: 'Tu',
          body:
            'la tua scheda per il personaggio con cui sei connesso: banner e avatar, **Display case**, e le schede **Stats**, **Bosses** e **Log** (il collection log fino agli oggetti di ogni pagina, più clue, tempi e imprese di combattimento). Sotto, ogni sfida **Head-to-head** in attesa per te (**Accept** o **Decline**) e i tuoi **Goals**, con **+ Add goal**.',
        },
        {
          term: 'Ricerca',
          body:
            'passa tra **Players** e **Clans**, scrivi un nome e premi Invio. **Recent** elenca gli ultimi usati. Fai clic destro su chiunque in gioco e scegli **Anvil** per arrivare qui.',
        },
        {
          term: 'Confronta',
          body:
            'sulla scheda di qualcun altro, **Compare with me** vi mette a confronto skill per skill, boss per boss e pagina per pagina. La scheda di un clan ha **Compare with my clan**.',
        },
      ],
    },

    gear: {
      title: 'La scheda dell’ingranaggio',
      intro: 'Sincronizzazione e impostazioni, più che cose da guardare:',
      rows: [
        {
          term: 'Sync profile',
          body: 'manda ad Anvil il tuo collection log e i tuoi tempi migliori.',
        },
        {
          term: 'Sync clan roster',
          body: 'solo per gli admin del clan: manda al sito la lista dei membri del clan in gioco. Se il plugin non riesce a leggere il tuo clan, dice invece **Join your clan channel to sync the roster**.',
        },
        {
          term: 'Suoni del banner',
          body: '**Add clip** per il suono che riproduce un banner, **Copy folder path** per gestirli, e **Add mission clip** per le missioni.',
        },
        {
          term: 'Become a Supporter',
          body: 'con il prossimo aggiornamento del plugin, un link ★ in fondo apre la pagina Supporter, oppure dice **Your Supporter perks** se lo sei già.',
        },
      ],
    },

    settings: {
      title: 'Impostazioni che cambiano ciò che vedi',
      intro:
        'Nella configurazione di Anvil in RuneLite, sotto **Chat messages**. Sono tutte attive all’inizio.',
      rows: [
        {
          term: 'Show feed in game chat',
          body: 'stampa anche il feed nella tua chatbox mentre accade: grossi drop, pet e achievement dalle board il cui host l’ha attivato e dai clan in cui sei ospite, i progressi sulle caselle dei tuoi compagni di squadra, e le caselle completate dalle altre squadre.',
        },
        {
          term: 'Supporter names in chat',
          body: 'i colori dei Supporter (e la stella di un Patron) nella chat pubblica, del clan, degli amici e privata, e nella lista amici e nelle liste dei membri dei canali. La lista dei nomi viene scaricata da Anvil; non viene inviato nulla su chi vedi.',
        },
        {
          term: 'Animated names',
          body: 'fa scorrere la sfumatura di un Patron nel pannello, nel Feed e nella chat dell’evento. Disattivata, resta ferma. Con il prossimo aggiornamento del plugin vale anche per i nomi dei clan potenziati e per i banner animati nel pannello.',
        },
        {
          term: 'Supporter names in menus',
          body: 'i colori dei Supporter sul loro nome quando fai clic destro su di loro, mai sui mondi PvP o nel Wilderness.',
        },
        {
          term: 'Over other plugins’ colours',
          body: 'se attiva, i colori di un Supporter sostituiscono il colore del nome impostato da un altro plugin, come Player Indicators. Se disattivata, quei nomi restano come sono.',
        },
      ],
    },
  },

  clanBoosts: {
    metaTitle: 'Potenziare un clan con i boost — Anvil',
    metaDescription:
      'Come funzionano i boost del clan di Anvil: chi li ha, piazzare e spostare un boost, i tre livelli di boost e cosa sblocca ciascuno, i colori del nome del clan, i boost regalati, e i segni e i badge dei booster.',
    eyebrow: 'Anvil · per i Supporter e lo staff del clan',
    title: 'Potenziare un clan con i boost',
    dek: 'Un Champion o un Patron pagante può mettere un boost su un clan di cui è membro. Abbastanza boost dai membri di un clan lo fanno salire di livello, e ogni livello cambia l’aspetto del clan e dove viene elencato. I boost sono solo estetici: non cambiano mai un grado, un punteggio, un posto o il piano del clan.',
    facts: [
      { strong: 'Champion 1, Patron 2', rest: 'boost finché paghi' },
      { strong: 'Livelli a 3, 8 e 15', rest: 'boost contati' },
      { strong: 'Una volta a settimana', rest: 'un boost si può spostare' },
    ],
    footnote:
      'I membri piazzano i boost in **Settings** → **Clan boosts**. Lo staff del clan vede il livello e le sue opzioni in Admin → **Clan settings** → **Boosts**. Per le fasce in sé, vedi [Anvil Supporter: fasce e vantaggi]({supporterGuide}).',

    what: {
      title: 'Chi ha i boost',
      intro: 'I boost arrivano con un abbonamento a pagamento:',
      rows: [
        { term: 'Champion', body: '1 boost.' },
        { term: 'Patron', body: '2 boost.' },
        {
          term: 'Supporter',
          body: 'nessuno. Nemmeno il tempo guadagnato con gli inviti. Un upgrade temporaneo dallo staff di Anvil dà spazi solo se lo staff li include.',
        },
      ],
      outro:
        'I boost appartengono a te, non a un personaggio: tre personaggi in tre clan condividono comunque una sola dotazione. **Settings** → **Clan boosts** compare nelle tue impostazioni solo finché sei Supporter o hai ancora un boost piazzato.',
    },

    place: {
      title: 'Piazzare e spostare un boost',
      intro: 'I tuoi boost li piazzi tu; nessuno può piazzarne uno al posto tuo.',
      steps: [
        'Apri **Settings** → **Clan boosts**. **Your boosts** elenca ciò che hai piazzato e ogni **Free slot**.',
        'In **Clans you can boost**, premi **Boost** accanto a un clan. Puoi anche premere **Boost this clan** nella sezione Boosters della pagina del clan.',
        'Per spostarne uno, usa **Move to…** sulla sua riga e scegli un altro clan. **Remove** lo toglie.',
      ],
      rows: [
        {
          term: 'Un posto da membro di 14 giorni',
          body: 'ogni boost poggia su un posto da membro che uno dei tuoi personaggi occupa nel clan in gioco. Un posto da ospite non può portarne uno. L’anzianità del posto si conta dalla data più vecchia tra quando Anvil l’ha visto per la prima volta e quando il gioco dice che il personaggio è entrato. Fino ad allora la riga del clan dice quanti giorni mancano.',
        },
        {
          term: 'Una riga per clan',
          body: 'la lista mostra ogni clan una volta sola, e Anvil sceglie il personaggio su cui poggia il boost: il tuo main dove può, altrimenti il posto tenuto più a lungo. Il clan vede solo quel personaggio, mai gli altri.',
        },
        {
          term: 'Una volta a settimana',
          body: 'un boost piazzato si può spostare 7 giorni dopo averlo piazzato. Lo spazio di un boost rimosso si riapre alla stessa data, quindi rimuovere e ripiazzare non è una scorciatoia. Se il personaggio su cui poggiava ha lasciato il clan, puoi spostarlo subito.',
        },
      ],
      note: {
        tag: 'Cosa significano le etichette',
        body: '**counting**: conta per il livello del clan. **paused**: la tua fascia ora ha meno spazi di quanti boost hai piazzato, quindi i più vecchi continuano a contare e gli altri aspettano. **seat gone**: il personaggio su cui poggiava non è più membro lì; spostalo. **over the 2-per-person cap**: il clan conta già due dei tuoi.',
      },
    },

    levels: {
      title: 'Livelli',
      intro:
        'Il livello di un clan viene dai suoi boost contati. Per un clan contano al massimo due boost di una stessa persona, quindi un livello significa sempre che l’hanno scelto più membri.',
      rows: [
        { term: 'Livello 1', body: '3 boost contati.' },
        { term: 'Livello 2', body: '8 boost contati.' },
        { term: 'Livello 3', body: '15 boost contati.' },
      ],
      outro:
        'I membri vedono i progressi sulla pagina del clan, per esempio “5 of 8 to Level 2”. Un clan che sale ottiene subito il nuovo livello.',
      note: {
        tag: 'Una settimana di tolleranza',
        body: 'Quando i boost scendono sotto un livello, il clan mantiene i vantaggi di quel livello per 7 giorni. Admin → Clan settings → Boosts mostra quando finiscono. Se i membri lo ripotenziano in tempo, non cambia nulla.',
      },
    },

    perks: {
      title: 'Cosa sblocca ogni livello',
      intro: 'Ogni livello mantiene tutto ciò che dà quello sotto.',
      rows: [
        {
          term: 'Livello 1',
          body: 'un badge **Boosted** sulla pagina del clan, sulla sua scheda nella Clan Hall e nella ricerca; un posto sopra i clan non potenziati nella Clan Hall e nei suoi risultati di ricerca; e il nome del clan sfumato.',
        },
        {
          term: 'Livello 2',
          body: 'un posto nella fila **Featured** della Clan Hall; il banner animato del clan si muove (sotto il Livello 2 mostra il fotogramma fermo); una riga di reclutamento per i visitatori; e la sfumatura del nome si muove.',
        },
        {
          term: 'Livello 3',
          body: 'lo **Spotlight** in cima alla Clan Hall, e un post di reclutamento al mese nel Discord di Anvil, scritto dal clan.',
        },
      ],
      note: {
        tag: 'Il logo del clan non è un vantaggio',
        body: 'Un logo animato (un’immagine del clan GIF o WebP) si muove a qualsiasi livello. Solo il banner aspetta il Livello 2.',
      },
    },

    colours: {
      title: 'I colori del nome del clan',
      intro:
        'Dal Livello 1 il nome del clan porta la sfumatura di Anvil. Proprietari e admin possono scegliere la propria in Admin → **Clan settings** → **Boosts** → **Clan name colours**:',
      rows: [
        {
          term: 'Da uno a quattro colori',
          body: 'un colore dà un nome fisso; da due a quattro formano una sfumatura. Dal Livello 2 la sfumatura si muove.',
        },
        {
          term: 'Sfondi scuri e chiari',
          body: 'come per i nomi dei Supporter, Anvil regola i colori perché restino leggibili sugli sfondi scuri (il sito, il pannello del plugin, Discord) e su quelli chiari (la chatbox opaca del gioco). Attiva un aspetto separato per uno dei due e verrà mostrato esattamente come l’hai scelto.',
        },
        {
          term: 'Reset to Anvil',
          body: 'torna alla palette di Anvil.',
        },
      ],
      outro:
        'I colori restano salvati se il clan scende sotto il Livello 1, e tornano quando risale. Il plugin recepisce una modifica al suo prossimo aggiornamento.',
    },

    staff: {
      title: 'Per lo staff del clan',
      intro:
        'Admin → **Clan settings** → **Boosts** è per proprietari e admin. Lo staff non può piazzare boost per i membri; i membri piazzano i propri.',
      rows: [
        {
          term: 'Il livello',
          body: 'il livello del clan, quanti boost stanno contando, quanti ne mancano al livello successivo, e l’eventuale settimana di tolleranza.',
        },
        {
          term: 'Riga di reclutamento',
          body: 'Livello 2. Una frase, fino a 140 caratteri, mostrata a chi non è nel clan sulla pagina del tuo clan e sulla sua scheda nella Clan Hall.',
        },
        {
          term: 'Post di reclutamento nel Discord di Anvil',
          body: 'Livello 3. Una volta per mese di calendario, da 20 a 500 caratteri, scritto da te e pubblicato quando premi **Post it**, con un link alla pagina del tuo clan. Le menzioni vengono rimosse e nessuno riceve un ping. Non puoi modificarlo né mandarne un altro fino al mese successivo.',
        },
        {
          term: 'Boosters',
          body: 'la lista dei personaggi che potenziano il clan.',
        },
      ],
      note: {
        tag: 'Boost regalati da Anvil',
        body: 'Lo staff di Anvil può regalare un livello a un clan, per un periodo stabilito o senza scadenza. Il regalo aggiunge solo i boost che mancano al clan per raggiungere quel livello, mostrati come **Anvil gift** nella lista Boosters del clan. Ogni boost vero di un membro sostituisce un boost regalato, e un clan già sopra il livello regalato tiene il suo. Quando il regalo finisce, il clan torna al livello che gli danno i boost dei suoi membri.',
      },
    },

    boosters: {
      title: 'Segni e badge dei booster',
      intro: 'Cosa ottiene un booster nel clan che potenzia:',
      rows: [
        {
          term: 'Il segno Booster',
          body: 'una piccola gemma accanto al suo personaggio nel roster, nel feed e nei post su Discord di quel clan. Passaci sopra il mouse per vedere “Boosts this clan”.',
        },
        {
          term: 'La bacheca dei Booster',
          body: 'sulla pagina del clan: una riga per personaggio, prima chi ha più boost, poi chi li ha da più tempo.',
        },
        {
          term: 'Badge',
          body: '**First booster** per chi ha piazzato il primissimo boost del clan; **1 month**, **3 months**, **6 months** e **1 year** di boost senza interruzioni; e **Level-up 1**, **2** o **3** per il boost che ha portato il clan a quel livello.',
        },
      ],
      note: {
        tag: 'Spostare fa ripartire il conteggio',
        body: 'I badge a tempo contano dal boost più vecchio del personaggio che sta ancora contando, quindi spostare o rimuovere un boost li fa ripartire da zero. Il tuo profilo elenca i clan che potenzi, una volta per clan.',
      },
    },
  },

  profile: {
    metaTitle: 'Il tuo profilo, Wrapped e Compare — Anvil',
    metaDescription: 'Le pagine che Anvil tiene su di te: il tuo profilo, la pagina pubblica di ogni personaggio, la tua pagina personale, i Wrapped mensili e annuali, le schede Wrapped degli eventi e il confronto affiancato di due personaggi.',
    eyebrow: 'Anvil · per i giocatori',
    title: 'Il tuo profilo, Wrapped e Compare',
    dek: 'Anvil tiene una pagina per **te** e una per **ogni personaggio** che giochi. Ecco cosa c’è su di esse, chi può aprirle e le schede Wrapped che escono alla fine di ogni mese e di ogni evento.',
    facts: [
      {
        strong: 'Condiviso di default',
        rest: 'rendi privato un personaggio con un solo interruttore',
      },
      {
        strong: 'Wrapped mensile',
        rest: 'esce il 1° del mese successivo',
      },
      {
        strong: 'Wrapped evento',
        rest: 'esce a fine evento',
      },
    ],
    footnote: 'Ogni interruttore citato qui è spiegato dove si trova in [Impostazioni, pagina per pagina]({settingsGuide}).',
    pages: {
      title: 'Le tue pagine',
      intro: 'Quattro pagine, ognuna risponde a una domanda diversa:',
      rows: [
        {
          term: 'Il tuo profilo',
          body: '[/profile](/profile), visto solo da te. Scegli un personaggio dai chip in alto per vederne livelli, boss, collection log ed eventi. I capitani trovano anche qui il **Captain’s deck**.',
        },
        {
          term: 'La pagina di un personaggio',
          body: '`/p/<name>`: un personaggio, leggibile da chiunque abbia il link finché è condiviso. Mostra skill, boss, collection log e personal best, e di proposito non mostra le tue classifiche di clan, la cronologia degli eventi né il tuo nome Discord.',
        },
        {
          term: 'La tua pagina personale',
          body: '`/u/…`: tutti i tuoi personaggi condivisi su un’unica pagina, con la tua vetrina e gli account streaming che hai scelto di mostrare. Esiste solo se attivi **Show that my characters are one person**.',
        },
        {
          term: 'La pagina membro di un clan',
          body: '`/c/<clan>/members/<name>`: lo stesso personaggio come lo vede un clan, raggiunto dalla lista **Members** di quel clan. Un clan privato mostra i suoi membri solo alla propria gente.',
        },
      ],
    },
    sharing: {
      title: 'Chi può vedere cosa',
      body: [
        'Ogni personaggio parte **shared**: la sua pagina si apre per chiunque abbia il link, e può comparire nelle classifiche e presso altri clan. Disattivala sotto **Who sees my characters** nelle Impostazioni e la sua pagina risponde _non trovato_ a tutti tranne te. Vedi **Private — only you can see this page.** con un link **Share it →**.',
        'Una pagina condivisa ha **Copy link** sotto il nome. I visitatori registrati che ritengono abusiva una pagina possono premere **Report this profile**.',
        'Per ogni personaggio, le Impostazioni ti permettono anche di nascondere in quale clan in gioco si trova (**Show my in-game clan**), così esce dalla pagina del personaggio e dalla pagina Anvil di quel clan.',
      ],
    },
    wrapped: {
      title: 'I tuoi Wrapped mensili e annuali',
      body: [
        'Ogni mese, ogni personaggio riceve una scheda Wrapped: **XP gained**, **Boss kills**, **New slots** nel collection log, ore **Efficient**, **PBs**, più pet e il drop più grande. Esce il **1° del mese successivo** (UTC). Fino ad allora solo tu puoi aprirla, come anteprima.',
        'Anche l’anno ne ha uno, a `/p/<name>/wrapped/<year>`, da **1 dicembre**. `/p/<name>/wrapped` ti porta sempre al più recente disponibile.',
        'Premi **Copy link to your Wrapped** per condividerlo. Incollato su Discord diventa un’immagine della scheda. Il Wrapped di un personaggio privato si apre solo per te, e il suo link in anteprima mostra una semplice scheda Anvil.',
      ],
      note: {
        tag: 'Un mese vuoto',
        body: 'Se quel mese non è arrivato nulla ad Anvil (né XP, uccisioni, slot del log o PB), la scheda lo dice invece di mostrare zeri. Gioca con il plugin, o lascia che le classifiche ti catturino, e il mese prossimo si riempie.',
      },
    },
    events: {
      title: 'Wrapped dell’evento',
      body: [
        'Quando un tabellone finisce, ogni giocatore e ogni squadra riceve una scheda. Apri la pagina **Wrapped** dell’evento: in cima c’è **Your card**, poi **Teams** (posizione, punteggio e giocatori) e **Players**. Premi **Open and share your card**, poi **Copy share link**.',
        'Prima della fine vedi **Cards aren’t out yet**. Lo staff può aprire un’anteprima in anticipo, per controllare le schede prima che le vedano i giocatori.',
        'Le immagini delle schede si vedono solo per l’evento di un clan pubblico che non sia a inviti. Per ogni altro evento il link funziona comunque per chi può vedere quell’evento, e in anteprima mostra una semplice scheda Anvil.',
      ],
    },
    compare: {
      title: 'Confronta due personaggi',
      body: [
        'Apri [Compare](/compare) e digita due nomi. Ottieni skill, boss e pagine del collection log affiancate. Il primo in ogni conteggio è evidenziato in oro. Sotto ci sono un’analisi, l’XP per skill, ogni boss che almeno uno dei due ha ucciso, e ogni oggetto di ogni pagina del log: li hanno entrambi, nessuno dei due, o solo uno di voi. **Swap sides** li scambia.',
        'Si possono confrontare solo personaggi condivisi. Uno privato, o un nome che Anvil non conosce, risponde _non su Anvil, o non condiviso_. Mentre sei registrato puoi sempre confrontare i tuoi personaggi privati.',
      ],
    },
    news: {
      title: 'Novità e changelog',
      body: [
        '[What’s new](/whats-new) mostra cosa è cambiato su Anvil, dal più recente. Quando sei connesso inizia con **For you**, le novità che contano per il tuo livello e il tuo clan, poi **Everything new**. Le cose che richiedono un aggiornamento del plugin dicono **Coming in the next plugin update**.',
        'Il [changelog](/changelog) elenca ogni release con le sue novità, i punti salienti e cosa è **New**, **Improved** e **Fixed**.',
        'Quando esce una release, le sue novità vengono pubblicate nel Discord di Anvil e negli aggiornamenti Anvil del tuo clan, e il plugin mostra una riga quando accedi. Le piccole correzioni vengono raccolte nel post successivo.',
      ],
    },
  },
  settings: {
    metaTitle: 'Impostazioni, pagina per pagina — Anvil',
    metaDescription: 'Ogni pagina delle Impostazioni di Anvil: post Discord e privacy degli screenshot, il feed della chat in gioco, connessione del plugin e dispositivi, i tuoi webhook, chi vede i tuoi personaggi, aspetto di Supporter e profilo, account streaming, ogni personaggio e le rivendicazioni di proprietà.',
    eyebrow: 'Anvil · per i giocatori',
    title: 'Impostazioni, pagina per pagina',
    dek: '[Settings](/settings) è dove vivono le tue scelte: cosa pubblichi, cosa vedi in gioco, chi può vedere i tuoi personaggi. Le scelte fatte qui ti seguono su ogni computer su cui giochi.',
    facts: [
      {
        strong: 'Casella di ricerca',
        rest: 'nella prima pagina trova qualsiasi impostazione',
      },
      {
        strong: 'Una pagina per personaggio',
        rest: 'sotto Characters',
      },
      {
        strong: '10 webhook',
        rest: 'propri',
      },
    ],
    footnote: 'Le pagine del tuo profilo sono spiegate in [Il tuo profilo, Wrapped e Compare]({profileGuide}); le impostazioni del plugin stesso in [Configurare il plugin RuneLite]({pluginGuide}).',
    find: {
      title: 'Trovare un’impostazione',
      body: [
        'La prima pagina, **Overview & search**, ha una casella di ricerca. Scrivi quello che cerchi con parole tue, come _private messages_, _rare drop value_, _death message_, _name colour_ o _plugin token_, e ti porta all’interruttore giusto.',
        'Il menu a lato ha due gruppi. **Account** contiene le pagine qui sotto. **Characters** ha una pagina per ogni personaggio collegato (il tuo principale è segnato **main**), poi **Add character**. Un numero su **Add character** significa che Anvil ti ha visto giocare personaggi che non hai ancora collegato.',
      ],
    },
    posts: {
      title: 'Post Discord e screenshot',
      intro: 'Cosa pubblica il plugin su di te nei canali Discord dei tuoi clan, e cosa nasconde negli screenshot. Queste scelte vengono lette dal prossimo aggiornamento del plugin. Finché non ce l’hai, decidono gli stessi interruttori nelle impostazioni del plugin.',
      rows: [
        {
          term: 'Cosa pubblica il tuo plugin',
          body: '**Rare drops**, **Pets**, **Deaths**, **Collection log slots**, **Level milestones** e **Diary completions** partono attivi; **PvP kills** parte disattivato.',
        },
        {
          term: 'I valori',
          body: '**Min drop value** (1m all’inizio, almeno 1m, 0 lo disattiva), **Min drop rarity (1 in N)** (1 su 1,000 all’inizio), **Valore e rarità insieme** (uno dei due all’inizio, oppure richiedi entrambi), **Loot key value** (1m), un **Death message** fino a 200 caratteri dove `{name}` diventa il tuo nome, e la **Combat task tier** e la **Quest tier** più basse che vengono pubblicate (Master all’inizio). Il valore, la rarità e la scelta tra uno o entrambi seguono i default del tuo clan finché non imposti i tuoi; **Ripristina il default del clan** ti riporta a seguirli.',
        },
        {
          term: 'Dove vanno i tuoi post',
          body: '**Keep my announcements out of clans I only guest in**, e **Level posts in clan channels**: **Clan rules**, **Only 99s & max** o **Off**. **Per character** elenca ogni personaggio con un link **Clans →** per disattivare la pubblicazione per un solo clan.',
        },
        {
          term: 'Screenshot per tipo',
          body: 'scegli per ogni tipo (**Rare drops**, **Pets**, **Deaths**, **Collection log**, **Combat tasks**, **Achievement diaries**, **Levels**, **Player kills**) se il suo post include uno screenshot. Sono tutti attivi all’inizio. Il tuo clan può impostare un default per i suoi membri; finché non ne cambi uno, lo segui, e **Reset** ti riporta a quello. Le prove del bingo vengono sempre catturate, qualunque sia la scelta: sono le tue prove.',
        },
        {
          term: 'Altro da annunciare',
          body: '**Slayer** (ogni N task), **Clue scrolls** (dal livello che scegli), **Speedruns** (solo record personali, o ogni volta), **Kill count** (ogni N uccisioni), **BA gambles** (ogni N gamble) e **Custom chat messages** (messaggi di gioco che corrispondono ai tuoi schemi, dove `*` è qualsiasi testo e `#` qualsiasi numero; fino a 10). Sono tutti disattivati all’inizio. Il tuo clan può attivarli come default per i suoi membri, e puoi attivarne o disattivarne ognuno per te; **Reset to clan default** ti riporta a seguire il clan. Vengono pubblicati nel canale **Milestones & more** del tuo clan e nei tuoi webhook che li accettano; i tuoi schemi personali vengono pubblicati solo nei tuoi webhook.',
        },
        {
          term: 'Privati: Grand Exchange, scambi, deposito di gruppo, altri plugin',
          body: '**Grand Exchange** (offerte concluse di valore almeno pari all’importo che imposti), **Player trades** (cosa hai dato e ricevuto), **Group storage** (cosa hai depositato o prelevato) e **Other plugins** (i plugin RuneLite che indichi possono pubblicare tramite Anvil). Sono disattivati all’inizio, solo tu puoi attivarli, il tuo clan non può mai attivarli per te, e pubblicano solo nei tuoi webhook: spunta il tipo sul webhook in cui li vuoi.',
        },
        {
          term: 'Modelli di messaggio',
          body: 'cambia la prima riga di qualsiasi messaggio: **Loot**, **Pet**, **Collection log**, **Combat tasks**, **Achievement diary**, **Quests**, **Levels**, **Death**, **Player kills**, **Slayer**, **Clue scrolls**, **Speedruns**, **Kill count**, **BA gambles** e, solo per te, **Grand Exchange**, **Player trades** e **Group storage**. Clicca un segnaposto come `{player}` o `{item}` per aggiungerlo; l’anteprima compila valori di esempio. Ogni tipo ha i propri segnaposto, e qualsiasi altra cosa tra parentesi graffe resta come l’hai scritta. Fino a 200 caratteri; le menzioni e i link non vengono mai pubblicati. Lasciato invariato, un messaggio appare come sempre; il tuo clan può impostarne uno proprio, e **Reset to clan default** torna a quello.',
        },
        {
          term: 'Privacy degli screenshot',
          body: 'spunta la chat che viene esclusa da ogni screenshot che il plugin fa, prove e post Discord compresi: **Private messages** (spuntata all’inizio), **Public chat**, **Clan chat: others’ messages**, **Clan chat: your own messages**, **Chat channel** e **Group chat**. I messaggi di gioco e le righe di Anvil restano sempre dentro.',
        },
      ],
      note: {
        tag: 'Le caselle dei tabelloni non sono mai toccate',
        body: 'Disattivare un post ferma solo il post Discord. Drop, uccisioni e traguardi contano comunque su ogni tabellone a cui partecipi.',
      },
    },
    chat: {
      title: 'Feed della chat in gioco',
      intro: 'Cosa stampa il plugin nella tua chatbox quando l’impostazione del plugin **Show feed in game chat** è attiva.',
      rows: [
        {
          term: 'Da dove',
          body: '**Boards I play on**, e **Clans I’m guesting in, and my clan’s guests**.',
        },
        {
          term: 'Cosa',
          body: 'drop di valore pari almeno a una cifra che scegli, **Pets**, **New collection log slots**, **Other teams’ completed tiles**, **My team’s progress on item tiles**, **Leagues, Deadman and other game-mode unlocks**, e obiettivi di combattimento, livelli, quest e diari.',
        },
        {
          term: 'Quando entri',
          body: '**A short brief in chat**: cosa è successo mentre eri via. I Champion scelgono cosa copre.',
        },
        {
          term: 'Colori',
          body: '**Anvil lines in chat**: **By type (Anvil colours)**, **One colour (the plugin’s own)**, oppure **My own colours** per i Supporter.',
        },
      ],
    },
    login: {
      title: 'Connessione del plugin, accesso e dispositivi',
      intro: 'Dove il plugin e il sito sono connessi, e come disconnetterli.',
      rows: [
        {
          term: 'Connessione del plugin',
          body: 'il tuo plugin token, per il caso raro in cui lo incolli a mano. Di solito **Sign in with Discord** nel pannello laterale fa questo per te.',
        },
        {
          term: 'Accesso e dispositivi',
          body: 'ogni computer su cui il plugin è connesso, come **RuneLite sign-in 1**, **2**… con la data di creazione e dell’ultimo utilizzo. **Revoke** disconnette uno, per esempio un computer venduto. **Enter a code** collega un altro computer. **Sessions** ti disconnette dal sito ovunque.',
        },
        {
          term: 'Fatturazione del clan',
          body: 'i proprietari di clan trovano qui **Open portal →**, per la fatturazione del clan.',
        },
      ],
    },
    webhooks: {
      title: 'I tuoi webhook Discord',
      body: [
        'I tuoi post possono anche andare a un server Discord tuo: un canale privato, il server di amici, ovunque tu possa creare un webhook. Incolla il link del webhook, scegli cosa riceve (**Rare drops**, **Pets**, **Deaths**, **Combat achievements**, **Levels & milestones**, **Quests**, **Achievement diaries**, **Collection log**, **PvP kills**), facoltativamente imposta un valore minimo di drop e una rarità solo per lui, e premi **Add webhook**. Su un webhook che riceve **Rare drops**, puoi cambiarli in seguito e scegliere **Value or rarity: my setting**, **either** o **both**. Ciò che lasci vuoto segue le tue impostazioni, e un webhook può essere più permissivo della soglia rigida del tuo clan.',
        'Puoi averne fino a 10. Sono accettati solo link di webhook Discord, e un link salvato viene mostrato mascherato, così uno screenshot di questa pagina non lo rivela. **Level posts on my webhooks** imposta le tue regole di livello per loro, separate da quelle del tuo clan.',
      ],
    },
    privacy: {
      title: 'Chi vede i miei personaggi',
      intro: 'I tuoi personaggi all’inizio sono condivisi. Tre interruttori cambiano questo:',
      rows: [
        {
          term: 'Show <name> publicly',
          body: 'un interruttore per personaggio. Acceso (all’inizio), la sua pagina è **Public**. Spento, diventa **Only its clans**: i suoi clan lo vedono ancora nelle loro liste e negli eventi, nessun altro, ed esce dalle classifiche.',
        },
        {
          term: 'Show that my characters are one person',
          body: 'con due o più personaggi, questo crea la tua pagina personale, che raccoglie insieme i personaggi condivisi. Spento, nessuno può capire che sono tutti tuoi.',
        },
        {
          term: 'Show other clans’ boards',
          body: 'se la home page elenca i tabelloni aperti di altri clan che puoi guardare.',
        },
      ],
    },
    look: {
      title: 'Supporter, aspetto del profilo, streaming e boost',
      intro: 'Come appari su Anvil, e gli account e i vantaggi che ci stanno dietro.',
      rows: [
        {
          term: 'Supporter & name colours',
          body: 'il tuo livello, i tuoi vantaggi e il tuo link di invito: porta amici e guadagna mesi gratuiti. I livelli sono spiegati in [Anvil Supporter: fasce e vantaggi]({supporterGuide}).',
        },
        {
          term: 'Profile look',
          body: 'avatar e banner (animati da Champion), diversi per ogni personaggio se vuoi, e la **Display case**: 4, 8 o 12 spille a seconda del livello.',
        },
        {
          term: 'Streaming accounts',
          body: '**Twitch**, **YouTube**, **Kick** e **Medal**. Ognuno mostra se è verificato, con un interruttore per mostrarlo sul profilo. Gli account verificati sono ciò che ti fa entrare negli eventi per follower e iscritti.',
        },
        {
          term: 'Clan boosts',
          body: 'visibile solo quando puoi potenziare: i tuoi slot, dove sono piazzati e i clan che puoi potenziare. Vedi [Potenziare un clan con i boost]({boostsGuide}).',
        },
      ],
    },
    characters: {
      title: 'Ogni personaggio',
      intro: 'Sotto **Characters**, ogni personaggio ha una sua pagina: il tipo, se è verificato, e i link alla pagina pubblica e al profilo completo.',
      rows: [
        {
          term: 'Visibilità',
          body: '**Show to other clans and on leaderboards**, e **Show my in-game clan**.',
        },
        {
          term: 'Clan',
          body: 'ogni clan e spazio in cui si trova, come **member** o **guest**, con **Announce drops & achievements** per clan e **Leave**. Se Anvil lo ha nel clan sbagliato, **Which clan is it really in?** lo segnala allo staff.',
        },
        {
          term: 'Personaggio',
          body: '**Make main**, chiedi un cambio di nome dopo una rinomina, oppure **Remove** dal tuo account. I suoi risultati passati restano dove sono.',
        },
        {
          term: 'Aggiungi personaggio',
          body: 'gioca una volta un personaggio con il plugin connesso e si collega da solo. Su mobile o nel client ufficiale, collegalo con il nome. **We noticed you playing** elenca quelli che Anvil ha visto; **Not mine** ne esclude uno.',
        },
      ],
    },
    claims: {
      title: 'Rivendicazioni di proprietà',
      body: [
        'Se un personaggio è collegato all’account Anvil di qualcun altro ma è davvero tuo, premi **This is my account** nella scheda **You** del pannello laterale del plugin. Dimostri di giocarlo con un rapido controllo XP, poi viene chiesto all’attuale titolare. Tu non scopri mai chi è, e lui non scopre mai chi sei tu.',
        'Le tue rivendicazioni mostrano **XP check**, **open**, e poi come sono finite: **moved to you**, **with Anvil staff**, **withdrawn**, **check timed out** o **closed**. **Withdraw** ne annulla una.',
        'Quando qualcuno rivendica uno dei tuoi, compare sotto **Claims on your characters** con **Approve** o **Object — it’s mine**. Un personaggio non verificato si sposta dopo 7 giorni se non ti opponi. Uno verificato si sposta solo se lo approvi.',
      ],
    },
  },
  weekly: {
    metaTitle: 'Skill e Boss of the Week — Anvil',
    metaDescription: 'Gestire una Skill of the Week, una Boss of the Week o una corsa di efficienza su Anvil: programmarla, ripeterla e ruotarla, le partenze, aggiungere e rimuovere persone, i premi, terminarla in anticipo e cosa vedono i giocatori.',
    eyebrow: 'Anvil · per lo staff del clan e i giocatori',
    title: 'Skill e Boss of the Week',
    dek: 'Una competizione settimanale è l’evento a basso sforzo: niente caselle da scrivere, niente squadre e niente iscrizioni. Tutti nella lista del clan vengono iscritti all’inizio, e vince chi guadagna di più prima della fine.',
    facts: [
      {
        strong: 'Niente caselle, niente squadre',
        rest: 'una sola classifica',
      },
      {
        strong: 'Iscritti all’inizio',
        rest: 'l’intera lista, in automatico',
      },
      {
        strong: 'Fino a 10 posti premio',
        rest: 'pagati dalla cassa',
      },
    ],
    footnote: 'I tabelloni (bingo) sono in [Organizzare il primo evento]({adminGuide}); i premi e la cassa in [La cassa del clan]({cofferGuide}).',
    schedule: {
      title: 'Programmarne una',
      intro: 'Cinque scelte, e i valori predefiniti vanno bene per la maggior parte dei clan:',
      steps: [
        'Apri **Schedule** nel menu admin e premi **+ Schedule event** (i moderatori possono usare **Schedule a competition**).',
        'Scegli il tipo: **Skill of the Week** (XP guadagnati), **Boss of the Week** (uccisioni guadagnate) o **Efficiency race** (ore giocate o ore boss guadagnati).',
        'Sotto **What is measured**, scegli la skill o il boss. Per cambiarlo ogni settimana, aggiungine altri sotto **Then rotate through**. Lascialo vuoto per ripetere sempre lo stesso.',
        'Scegli quando **Runs**: **This weekend**, **One week**, oppure le tue date. Serve sempre una fine, perché calcola i guadagni tra inizio e fine.',
        'Lascia attivo **Repeat every week** e la successiva inizia nel momento in cui questa finisce, con la stessa durata e gli stessi premi. Spunta **Guests race too** se gli ospiti del clan devono essere in classifica.',
      ],
      outro: 'Non c’è altro da impostare. Le statistiche di partenza arrivano dalle classifiche quando inizia.',
    },
    counting: {
      title: 'Come conta',
      body: [
        'Il guadagno di ogni giocatore è la sua statistica adesso meno la statistica quando la competizione è iniziata (la sua **starting line**). Vince il guadagno più alto; in caso di pareggio viene elencato per nome, e i premi possono essere divisi tra posti pari.',
        'Le partenze vengono prese dalle classifiche. Dopo, gli aggiornamenti in tempo reale del plugin tengono il tabellone aggiornato tra un controllo e l’altro, così i giocatori con il plugin salgono in classifica mentre giocano.',
        'Un numero che scende viene ignorato, e un guadagno che sembra impossibile viene **flagged** per lo staff invece di essere contato o tagliato.',
      ],
      note: {
        tag: 'Giocatori: fate logout prima dell’inizio',
        body: 'Le classifiche salvano le tue statistiche solo quando fai logout. Se fai grind fino all’inizio senza fare logout, la tua partenza viene presa prima di quel grind e il grind conta come guadagno. Lo staff di solito se ne accorge e corregge la tua partenza, ma fai comunque logout una volta prima dell’inizio.',
      },
    },
    manage: {
      title: 'Gestirla',
      intro: 'Apri la competizione da **Schedule** o dalla dashboard. Ha una pagina principale e tre schede:',
      rows: [
        {
          term: 'Home',
          body: 'la **Leaderboard** (primi 25, con quanti stanno segnando), i guadagni **flagged**, chi ha **left the clan**, e i premi. Quando finisce, i vincitori e la **Final leaderboard**.',
        },
        {
          term: 'Starting lines',
          body: 'ogni **Started at**, **Now** e **Gained** del giocatore. Correggi a mano una partenza quando un grind precedente alla competizione è stato contato, e la classifica segue. **Pull current stats** aggiorna tutti; **Reset baselines** riparte tutti dalle loro classifiche di adesso e cancella tutti i guadagni.',
        },
        {
          term: 'Participants',
          body: 'l’intera lista è già dentro. **Add someone** accetta un nome per riga, per un ospite o un account non ancora nella lista. Rimuovere un giocatore cancella il suo punteggio; riaggiungerlo gli dà una nuova partenza. **Leave one each** pulisce una persona iscritta con più personaggi. Puoi anche rimuovere tutti gli ospiti in una volta.',
        },
        {
          term: 'Settings',
          body: 'nome, date, **Repeat every week**, e **Status** (solo per sbloccarne una; si muove da sola). Gli admin possono **Delete** la competizione, insieme ai partecipanti e alle classifiche.',
        },
      ],
    },
    prizes: {
      title: 'Premi e fine',
      body: [
        'Imposta i premi per fino a 10 posti, pagati dalla cassa del clan. Scegli se un giocatore senza guadagno può essere pagato e se i posti pari dividono i premi. Come si muovono i soldi è in [La cassa del clan]({cofferGuide}).',
        'Finisce da sola all’orario che hai impostato. **End now** la ferma in anticipo: i guadagni smettono di contare subito, e i risultati vengono pubblicati su Discord con i premi saldati entro 15 minuti.',
      ],
    },
    players: {
      title: 'Per i giocatori',
      body: [
        'Non ti iscrivi. Se sei nella lista del clan quando inizia, sei dentro. Trovala nella pagina **Events** del tuo clan, nella scheda **Clan** del pannello laterale del plugin con la tua posizione, e su Discord quando inizia e finisce.',
        'Ogni competizione ha una sua pagina con la classifica in tempo reale e come è andata la gara giorno per giorno. Un clan privato la mostra solo ai suoi membri.',
        'Giocare con il plugin tiene aggiornato il tuo numero. Senza, conti lo stesso, solo alla velocità delle classifiche.',
      ],
    },
    teamsLine: "Vuoi squadre, o clan che si sfidano, su una skill o un boss? Imposta il **Format** quando la programmi. Vedi [Competizioni a squadre]({teamCompsGuide}).",
  },
  teamComps: {
    "metaTitle": "Competizioni a squadre — Anvil",
    "metaDescription": "Organizza uno Skill o Boss of the Week a squadre o clan contro clan su Anvil: dividere i giocatori in squadre, invitare altri clan, come si calcola il punteggio di totali e medie, chi arriva in ritardo e cosa vedono i giocatori.",
    "eyebrow": "Anvil · per lo staff del clan e i giocatori",
    "title": "Competizioni a squadre",
    "dek": "Ogni competizione di skill o boss ha un Format. Solo è quello predefinito e funziona come sempre. Scegli Teams per dividere il tuo clan in due schieramenti, o Clan vs clan per sfidare altri clan sulla stessa skill o boss.",
    "facts": [
      {
        "strong": "Tre formati",
        "rest": "Solo, Teams, Clan vs clan"
      },
      {
        "strong": "I totali decidono",
        "rest": "con una media per giocatore"
      },
      {
        "strong": "Un host modifica",
        "rest": "i clan partner guardano"
      }
    ],
    "footnote": "Le basi di Skill and Boss of the Week sono in [Skill and Boss of the Week]({weeklyGuide}). Vuoi che i clan si sfidino invece sulle bingo board? Vedi [Ospitare un clan in visita]({clanVsClanGuide}).",
    "teams": {
      "title": "Imposta le squadre",
      "intro": "Le squadre dividono il tuo clan in due schieramenti. Ci vuole circa un minuto:",
      "steps": [
        "Programma una competizione come al solito. Imposta **Format** su **Teams**.",
        "Scrivi i nomi delle squadre. Tutti gli iscritti vengono divisi equamente in base al livello attuale o al numero di uccisioni, così gli schieramenti partono in parità.",
        "Lascia attivo **Late joiners go into the smallest team** se qualcuno può arrivare dopo l'inizio. Disattivalo per mantenere le squadre fisse.",
        "Per cambiare qualcosa più avanti, apri la competizione e scegli **Teams** nella barra laterale di amministrazione. Lì puoi:"
      ],
      "rows": [
        {
          "term": "Rinominare e cambiare colore",
          "body": "dai a ogni squadra un nome e un colore riconoscibile dai giocatori."
        },
        {
          "term": "Aggiungere ed eliminare squadre",
          "body": "parti con due e aggiungine una terza, oppure rimuovi quelle che non ti servono più."
        },
        {
          "term": "Spostare un giocatore",
          "body": "manda qualcuno in un'altra squadra. Utile per gli amici che vogliono giocare insieme."
        },
        {
          "term": "Bilanciamento automatico",
          "body": "premi **Auto-balance by current level/KC** per ridistribuire tutti in modo equo."
        },
        {
          "term": "Ritardatari",
          "body": "attiva o disattiva l'opzione per i ritardatari. Se è attiva, i nuovi giocatori entrano nella squadra più piccola."
        }
      ],
      "note": {
        "tag": "Nessuna squadra, nessun problema",
        "body": "Un giocatore senza squadra conta comunque nella classifica individuale. Semplicemente non contribuisce al totale di nessuna squadra."
      },
      "outro": "Una competizione ricorrente porta le squadre alla settimana successiva e le bilancia di nuovo."
    },
    "clans": {
      "title": "Imposta clan contro clan",
      "intro": "Clan vs clan permette ad altri clan di unirsi alla tua competizione, quanti ne vuoi. Tu sei l'host, gli altri clan sono partner.",
      "steps": [
        "Come admin o superiore nel clan host, imposta **Format** su **Clan vs clan**.",
        "Invita gli altri clan tramite il loro indirizzo. Puoi farlo nel modulo di creazione o più tardi nella pagina **Clans** della competizione.",
        "Il proprietario o un admin del clan invitato accetta o rifiuta dalla sua pagina **People** o dall'elenco **Events**. Un moderatore non può farlo. Nessuno di quel clan viene iscritto finché non accetta.",
        "Quando accetta, sceglie chi gareggia: **All members** del suo roster, oppure **Selected people** che seleziona. Può cambiarlo più tardi dalla stessa scheda.",
      ],
      "body": [
        "Il clan partner può seguire la classifica sul proprio sito all'indirizzo `/c/<slug>/weekly/<id>`. È di sola lettura. Solo l'host modifica la competizione.",
        "Per rimuovere un clan, eliminalo dalla pagina **Clans**. I suoi giocatori escono dalla classifica.",
        "Una competizione ricorrente invia nuovi inviti ogni settimana, quindi ogni clan deve confermare di nuovo.",
        "Ricevi inviti indesiderati? Scegli **Decline & block this clan** sull'invito. Gli inviti successivi di quel clan vengono rifiutati in silenzio, e puoi sbloccarlo in **Settings → Blocked clans**.",
      ],
      "note": {
        "tag": "Condividi l'indirizzo",
        "body": "L'indirizzo di un clan è il nome breve presente nel suo indirizzo web. Chiedi all'admin dell'altro clan prima di invitarlo."
      }
    },
    "scoring": {
      "title": "Come si calcola il punteggio",
      "body": [
        "Il totale di una squadra o di un clan è la somma dei guadagni dei suoi membri. I guadagni si contano come nella classifica individuale.",
        "Accanto a ogni totale vedi anche una **media per giocatore**, così una squadra di 8 e una di 12 restano confrontabili.",
        "In caso di parità, chi ci è arrivato per primo si piazza più in alto."
      ]
    },
    "players": {
      "title": "Cosa vedono i giocatori",
      "body": [
        "La pagina della competizione mostra prima le classifiche di squadre o clan. Aprine una per vedere i suoi giocatori. La tua squadra o il tuo clan è evidenziato.",
        "I post Discord all'inizio, a metà e alla fine mostrano la classifica. In clan vs clan vanno al canale di ogni clan, e il tuo è contrassegnato con **← you**.",
        "Nel pannello laterale del plugin puoi vedere il posto della tua squadra.",
        "Non c'è nessuna iscrizione da fare. Se il tuo clan iscrive tutti i membri e tu sei nel roster, sei dentro. Se sceglie delle persone, sei dentro una volta selezionato.",
        "Non vuoi partecipare? Premi **Opt out** accanto a **You’re in**, nella pagina della competizione, nell'elenco Events o nel plugin. Esci dalla classifica solo per quella competizione, e puoi rientrare mentre è in corso.",
      ]
    },
    "faq": {
      "title": "Domande",
      "intro": "Le domande più frequenti dello staff del clan e dei giocatori:",
      "rows": [
        { term: "Le nostre squadre hanno dimensioni diverse. È ingiusto?", body: "Non di per sé. I totali decidono la classifica, ma ogni squadra mostra anche una media per giocatore, così puoi vedere come va davvero una squadra più piccola." },
        { term: "E chi arriva in ritardo?", body: "Con l'interruttore per i ritardatari attivo, entrano nella squadra più piccola. Con l'interruttore disattivo, contano solo nella classifica individuale. Puoi sempre spostarli a mano nella pagina **Teams**." },
        { term: "L'altro clan può modificare la nostra competizione?", body: "No. I clan partner vedono le classifiche in sola lettura. Solo il clan host può cambiare la competizione." },
        { term: "Posso saltare una competizione?", body: "Sì. Premi **Opt out** nella pagina della competizione, nell'elenco Events o nel plugin. Viene interessata solo quella competizione, e puoi rientrare mentre è in corso." },
        { term: "Quanti clan possono gareggiare?", body: "Quanti ne inviti, fino a 50 in una sola competizione. Ogni clan vede il proprio lato contrassegnato nella classifica e nei post Discord." },
        { term: "Un altro clan continua a invitarci. Possiamo fermarlo?", body: "Sì. Un proprietario o un admin sceglie **Decline & block this clan** sull'invito. Gli inviti successivi vengono rifiutati senza avvisarli. Puoi sbloccarlo in qualsiasi momento in **Settings → Blocked clans**." },
        { term: "Se accettiamo una volta, siamo iscritti ogni settimana?", body: "No. Una competizione ricorrente invia nuovi inviti ogni settimana, e un proprietario o un admin deve accettare ciascuno di essi." },
      ]
    }
  },

  clanEvents: {
    metaTitle: 'Eventi del clan e calendario — Anvil',
    metaDescription: 'Programmare eventi di clan su Anvil: mass, viaggi e ritrovi, ripetizioni settimanali, “I’m going” e iscrizioni con posti, domande e quote, post e promemoria Discord, pagamenti, sondaggi e il calendario che mostra i buchi.',
    eyebrow: 'Anvil · per lo staff del clan',
    title: 'Eventi del clan e calendario',
    dek: 'Non tutto è un tabellone. Un evento del clan è una mass, una serata di raid, una festa dei drop o un ritrovo: un orario e un luogo, pubblicato su Discord e con promemoria, con tanta o poca iscrizione quanta ne vuoi.',
    facts: [
      {
        strong: 'Una volta o ogni settimana',
        rest: 'con una data di fine facoltativa',
      },
      {
        strong: 'Tre modi per partecipare',
        rest: 'info, “I’m going” o iscrizioni',
      },
      {
        strong: 'Promemoria',
        rest: '15 minuti prima, poi all’inizio',
      },
    ],
    footnote:
      'Le competizioni settimanali sono in [Skill and Boss of the Week]({weeklyGuide}); quote e premi in [Fees and payouts]({feesGuide}). I post promemoria usano i modelli di messaggio del tuo clan, spiegati in [Settings, page by page]({settingsGuide}).',
    create: {
      title: 'Programmarne uno',
      intro: 'Apri **Clan events** nel menu admin e compila il modulo:',
      rows: [
        {
          term: 'Nome, orario, durata',
          body: '**Name**, **Starts (your time)** nel tuo fuso orario, e **Minutes**.',
        },
        {
          term: 'Ripetizioni',
          body: '**Just once** o **Every week**, con una data **Until** facoltativa.',
        },
        {
          term: 'Dove',
          body: '**Where**, **World** e **Host**, più un’immagine: scegli un boss o una skill, o caricane una tua.',
        },
        {
          term: 'Dettagli',
          body: 'equipaggiamento, requisiti, cosa portare.',
        },
        {
          term: 'Chi viene',
          body: '**Just information** (nessun pulsante, nessun conteggio), **“I’m going”** (un tocco, mostra un conteggio) o **Sign-ups** (posti, domande e una quota).',
        },
        {
          term: 'Discord',
          body: '**Post to** un canale (o quello predefinito del clan), facoltativamente i canali **Chat**, **Guide** e **Voice** da collegare, e se menzionare il ruolo dei membri nell’annuncio, nel promemoria e all’inizio.',
        },
      ],
      outro: 'Premi **Schedule it**. Pagamenti e sondaggio si aggiungono dopo, dalla pagina dell’evento.',
    },
    discord: {
      title: 'Cosa vede Discord',
      body: [
        'L’annuncio compare quando lo programmi e viene modificato sul posto ogni volta che cambi qualcosa, così non esiste mai una copia vecchia. Un evento ripetuto è segnato **every week**.',
        'Quindici minuti prima, pubblica **Starting in 15 minutes**, e all’inizio **Starting now**. Se sposti l’orario, i promemoria si spostano con lui. Annullarlo (**Cancel**) segna il post **Cancelled**, così nessuno si presenta.',
      ],
    },
    manage: {
      title: 'Iscrizioni, quote e pagamenti',
      intro: 'Apri l’evento per cambiare cosa usa. All’inizio è tutto disattivato:',
      rows: [
        {
          term: 'Sign-ups',
          body: 'con **Places** (vuoto per nessun limite), quando **Sign-ups close**, e **Sign-up questions**. **You approve each one** fa sì che ogni iscrizione attenda lo staff.',
        },
        {
          term: 'Pulsante “I’m going”',
          body: 'disattivato, diventa solo informazione: niente pulsante o conteggio sul sito, nel plugin o su Discord.',
        },
        {
          term: 'Quota d’ingresso',
          body: 'attiva le iscrizioni. Aggiungi gp tuoi al montepremi sotto **Added to the pot**.',
        },
        {
          term: 'Pagamenti',
          body: 'il montepremi sono le quote più quanto hai aggiunto. Indica **Who** riceve cosa e **For** cosa, e segna ognuno come **Paid**. Anvil ti avvisa se paghi più del montepremi.',
        },
        {
          term: 'Sondaggio dopo',
          body: 'si apre quando finisce. Solo lo staff vede le risposte. Se c’erano iscrizioni, vengono interpellate solo le persone iscritte.',
        },
        {
          term: 'Un evento settimanale',
          body: '**Every week is…** **Its own** (iscrizioni, montepremi e sondaggio ogni settimana) oppure **One run** (una sola iscrizione, montepremi e sondaggio per l’intera serie).',
        },
      ],
    },
    players: {
      title: 'Cosa vedono i membri',
      body: [
        'La pagina dell’evento mostra **When**, **Where**, **Host**, **Discord**, **Entry** e **Prizes**, con **Live now** mentre è in corso. I membri premono **I’m going** o **Sign me up**, oppure **Ask to sign up** quando lo staff approva ogni iscrizione. È anche nella scheda **Clan** del pannello laterale del plugin, con gli stessi pulsanti.',
        'Solo i membri del clan possono dire che ci saranno o iscriversi.',
      ],
    },
    calendar: {
      title: 'Il calendario',
      body: [
        '**Schedule** mette tabelloni, competizioni settimanali ed eventi del clan su un unico calendario, con un filtro per ciascuno.',
        'Ogni tratto di due o più giorni senza nulla viene segnato come buco, con **Fill the gap** per programmare qualcosa lì. Usalo per tenere il clan attivo tra un grande evento e l’altro, invece di lasciare scivolare via una quindicina tranquilla.',
      ],
    },
  },
  challenges: {
    metaTitle: 'Sfide ed eventi per amici — Anvil',
    metaDescription: 'Sfide uno contro uno su Anvil (primo a un drop, più uccisioni o più XP in 1 ora, 24 ore o 7 giorni) ed eventi per amici dei Supporter: tabelloni privati per i tuoi amici dietro un unico link di invito.',
    eyebrow: 'Anvil · per i giocatori',
    title: 'Sfide ed eventi per amici',
    dek: 'Due modi per giocare contro persone che conosci senza un evento di clan: una **sfida** è un giocatore contro un altro, e un **evento per amici** è un tabellone privato per un gruppo, dietro un link di invito.',
    facts: [
      {
        strong: 'Da 1 ora a 7 giorni',
        rest: 'per sfida',
      },
      {
        strong: 'Vanto',
        rest: 'niente posta, niente gp',
      },
      {
        strong: 'Fino a 50 amici',
        rest: 'per evento per amici, a seconda del livello',
      },
    ],
    footnote: 'Livelli e cosa ospita ciascuno sono in [Anvil Supporter: fasce e vantaggi]({supporterGuide}).',
    start: {
      title: 'Sfida qualcuno',
      intro: 'Ti serve un personaggio verificato, e serve anche al tuo avversario.',
      steps: [
        'Apri [Sfide](/challenges), o premi **Challenge <name>** sul profilo di un giocatore.',
        'Sotto **Who**, scrivi il loro nome, e sotto **Playing as**, scegli il tuo personaggio. Deve essere verificato.',
        'Scegli la gara: **First to a drop** (fino a 5 oggetti, tutti drop di mostri), **Most kills** di un boss, o **Most XP** in una skill o in totale.',
        'Scegli il limite di tempo: **1 hour**, **24 hours** o **7 days**. Spunta **OK to show the result publicly** se non ti dispiace che si veda; è pubblico solo se lo spuntate entrambi.',
      ],
      outro: 'Ricevono una notifica e un messaggio Discord, e hanno 24 ore per **Accept**, **Decline** o **Decline and block**. Il conteggio parte quando accettano.',
    },
    rules: {
      title: 'Come si decide',
      intro: 'Anvil lo decide da solo, entro un minuto dalla fine.',
      rows: [
        {
          term: 'Uccisioni e XP',
          body: 'entrambe le partenze vengono prese quando viene accettata; chi guadagna di più alla fine vince, e guadagni uguali sono un pareggio. Classifiche e plugin contano entrambi, quale dei due sia più alto.',
        },
        {
          term: 'Primo a un drop',
          body: 'il primo di voi a ottenere uno degli oggetti vince, all’istante. I drop li vede solo il plugin, quindi servono entrambi con il plugin attivo. Se nessuno ne ottiene uno in tempo: pareggio.',
        },
        {
          term: 'Annullare',
          body: 'puoi ritirare la tua sfida finché non viene risposta. Una volta in corso, si ferma solo se siete d’accordo entrambi.',
        },
      ],
    },
    limits: {
      title: 'Limiti e dire di no',
      body: [
        'Le sfide aperte (in attesa o in corso, inviate o ricevute) sono limitate dal livello: **1** gratis, **5** per i Supporter, illimitate per Champion e Patron. Chiunque può iniziarne fino a 20 al giorno, e solo una alla volta con la stessa persona.',
        'Non ne vuoi? **Turn away all new challenges**, oppure blocca una persona quando rifiuti. Chi ti sfida vede lo stesso rifiuto in ogni caso, così non può capire di essere stato bloccato.',
        'La pagina conserva **Your record** (vittorie, sconfitte e pareggi), cosa è **Open now** e il tuo **Your limit**.',
      ],
    },
    friends: {
      title: 'Ospitare un evento per amici',
      body: [
        'Ogni Supporter, Champion o Patron può gestire un tabellone privato per amici da [Host](/host) → **Host for friends** → **New friends event**. È un tabellone completo: bingo o una gara di caselle, tracciato dal plugin, con la stessa configurazione di un evento di un creator.',
        'Invia l’**Invite link**: è l’unico modo per entrare. Gli amici lo aprono, accedono con Discord e premono **Open the event**. Entrare è sempre gratis. Se il link viene diffuso, creane uno nuovo: quello vecchio smette di funzionare e chi è già dentro resta dentro.',
        'Un evento per amici non è mai elencato da nessuna parte su Anvil, e non serve un clan.',
      ],
      table: {
        areaLabel: 'Livello',
        columns: [
          'Giocatori',
          'In esecuzione contemporaneamente',
        ],
        rows: [
          {
            area: 'Supporter',
            cells: [
              '10',
              '1',
            ],
          },
          {
            area: 'Champion',
            cells: [
              '25',
              '1',
            ],
          },
          {
            area: 'Patron',
            cells: [
              '50',
              '2',
            ],
          },
        ],
      },
      note: {
        tag: 'Se il tuo livello finisce',
        body: 'Gli amici già dentro restano. I nuovi amici non possono entrare oltre il tuo nuovo limite, e tu non puoi avviarne un altro finché non scendi sotto.',
      },
    },
  },
  clanHall: {
    metaTitle: 'Trovare clan, eventi e classifiche — Anvil',
    metaDescription: 'Trovare un clan OSRS sulla Clan Hall di Anvil, confrontare due clan, le classifiche settimanali di giocatori e clan, la lista pubblica degli eventi e le pagine dei clan in gioco che non sono su Anvil.',
    eyebrow: 'Anvil · per i giocatori e i clan',
    title: 'Trovare clan, eventi e classifiche',
    dek: 'Le pagine pubbliche di Anvil per guardarsi attorno: la **Clan Hall** per trovare un clan, la lista **Events** per trovare qualcosa a cui unirti, e la **Leaderboard** per vedere chi guadagna di più.',
    facts: [
      {
        strong: 'Clan Hall',
        rest: 'solo clan pubblici',
      },
      {
        strong: 'Leaderboard',
        rest: 'questa settimana, 30 giorni, sempre',
      },
      {
        strong: 'Eventi',
        rest: 'solo quelli pubblicizzati dall’ospite',
      },
    ],
    footnote: 'Per far elencare il tuo clan, vedi [Creare un clan]({clanGuide}); i clan potenziati sono in evidenza, vedi [Potenziare un clan con i boost]({boostsGuide}).',
    hall: {
      title: 'La Clan Hall',
      body: [
        '[Clan Hall](/clans) elenca ogni clan pubblico. Cerca per nome o slogan, poi restringi a **Taking members** o **Open to challenges**. **Most active** (l’ordine in cui si apre) mette in cima i clan i cui membri hanno guadagnato di più questa settimana; **Biggest** ordina per membri.',
        'Ogni scheda dice se il clan è **Recruiting** e come accetta gli ospiti: **Guests welcome**, **Guests by approval** o **No guests**. I clan potenziati hanno le righe in evidenza in cima, e i creator hanno una riga tutta loro.',
      ],
      note: {
        tag: 'Non elencato?',
        body: 'Compaiono solo i clan impostati come pubblici, e un clan può disattivare l’elenco nelle sue impostazioni. I clan privati non sono mai nella Clan Hall, nella classifica o nei confronti.',
      },
    },
    compare: {
      title: 'Confronta due clan',
      body: [
        '[Compare clans](/compare/clans) mette due clan elencati affiancati. Per confrontare invece due personaggi, usa [Compare](/compare).',
      ],
    },
    board: {
      title: 'La classifica',
      body: [
        '[Leaderboard](/leaderboard) classifica giocatori e clan per esperienza, ore efficienti e boss su **This week**, **30 days** o **All time**. I giocatori si possono restringere ad account **Regular**, **Ironman**, **Hardcore**, **Ultimate** o **Group**.',
        'I clan sono classificati in base all’XP guadagnato dai loro membri. Compaiono solo i clan verificati elencati nella Clan Hall. I guadagni di un ospite contano per il suo clan, non per quello in cui è ospite.',
      ],
    },
    events: {
      title: 'Trova un evento a cui unirti',
      body: [
        '[Events](/events) elenca ciò che è in corso e in arrivo su Anvil. Filtra per **Live now**, **Open to join** o **Starting this week**, per formato o **Solo**, per **Anyone can join** o **Ask or meet a rule**, e per **Clans** o **Creators**. **Join** ti porta a iscriverti.',
        'Compaiono solo gli eventi il cui ospite ha attivato **Advertise on Anvil**. Gli eventi solo per membri e quelli su invito non compaiono mai.',
      ],
    },
    ghost: {
      title: 'Clan in gioco non su Anvil',
      body: [
        'La pagina di un personaggio indica il clan in gioco in cui si trova. Se quel clan non è su Anvil, il link apre una semplice pagina che elenca i giocatori Anvil che ne fanno parte e hanno scelto di mostrarlo. Non è la lista di quel clan, e niente su di essa rende qualcuno membro.',
        'Se è il tuo clan, **Bring your clan to Anvil** ne crea uno. Quando è un clan pubblico su Anvil, il link porta direttamente a lui.',
      ],
    },
  },
  guideLibrary: {
    metaTitle: 'Guide in gioco: leggere, proporre e copie dei clan — Anvil',
    metaDescription: 'La libreria di guide di Anvil: guide su raid, boss, skilling e money-making sul sito, in gioco e su Discord. Leggerle per livello, proporre una nuova guida o una modifica, e come un clan copia e modifica le guide della libreria.',
    eyebrow: 'Anvil · per i giocatori e lo staff del clan',
    title: 'Guide in gioco',
    dek: 'Oltre a queste pagine pratiche, Anvil tiene una libreria di guide di gioco: raid, boss, skilling e money maker. Chiunque può leggerle, chiunque sia registrato può proporne una, e un clan può tenere le proprie copie.',
    facts: [
      {
        strong: 'Tre livelli',
        rest: 'Beginner, Intermediate, Advanced',
      },
      {
        strong: 'Chiunque può proporre',
        rest: 'lo staff esamina ognuna',
      },
      {
        strong: '/guide',
        rest: 'pubblica una guida su Discord',
      },
    ],
    footnote: 'I comandi slash sono in [Comandi slash]({commandsGuide}).',
    read: {
      title: 'Leggere una guida',
      body: [
        'Apri la scheda **In-game guides** nella pagina delle guide, o [/guides](/guides) sul sito del tuo clan. La lista di un clan ha le sue guide più le guide della libreria che non ha ancora copiato.',
        'Molte guide hanno un selettore di livello in cima: **Beginner**, **Intermediate** e **Advanced**. Le parti per gli altri livelli si ripiegano, così un principiante e chi fa speed-run leggono la stessa pagina.',
        'Su Discord, `/guide` e l’inizio di un nome pubblicano la scheda di una guida con un link alla pagina completa.',
      ],
    },
    propose: {
      title: 'Proporre una guida o una modifica',
      body: [
        'Registrato, apri [Propose a guide](/guides/propose) per scriverne una nuova, o proporre una modifica a una guida della libreria. Spiega al revisore cosa hai cambiato e perché; puoi mostrare le tue modifiche rispetto alla guida attuale prima di inviare.',
        'Premi **Send for review**. [My guide proposals](/guides/proposals) mostra ognuna come **pending**, **approved**, **rejected** o **withdrawn**, con la nota del revisore una volta risposto. Finché è in attesa puoi modificarla o **Withdraw**. Puoi averne 5 in attesa alla volta.',
        'Niente va online finché gli editor delle guide di Anvil non la approvano. Una modifica approvata aggiorna anche ogni copia del clan che non è stata cambiata.',
      ],
    },
    clan: {
      title: 'Le guide del tuo clan',
      intro: 'Gli admin, e i moderatori autorizzati a scrivere guide, le gestiscono sotto **Guides** nel menu admin.',
      rows: [
        {
          term: 'Show library guides on our site',
          body: 'attivo: le guide della libreria che non hai copiato compaiono anche sulla tua pagina Guides, sempre aggiornate.',
        },
        {
          term: 'Copy to our guides',
          body: 'crea una copia del clan. Resta **follows library** finché non la modifichi, ricevendo ogni modifica della libreria.',
        },
        {
          term: 'Editing a copy',
          body: 'la rende **customised**, propria del clan. Quando la guida della libreria cambia in seguito, mostra **update available**: prendi la nuova versione o tieni la tua.',
        },
        {
          term: 'New guide',
          body: 'ne scrive una che solo il tuo clan ha, come le regole del tuo raid o una guida per una mass.',
        },
      ],
      note: {
        tag: 'Pubblicarle',
        body: 'Le guide possono essere pubblicate su un canale Discord, e quei post vengono modificati sul posto quando la guida cambia.',
      },
    },
  },
  luckRecords: {
    metaTitle: 'Probabilità, fortuna e record — Anvil',
    metaDescription:
      'Cosa significa la riga delle probabilità su un riquadro drop, come Anvil calcola la fortuna (spooned, dry o on rate), cosa sono le ore efficienti e dove vengono conservati il tuo giorno, la settimana, il mese e l\'anno migliori.',
    eyebrow: 'Anvil · per i giocatori',
    title: 'Probabilità, fortuna e record',
    dek:
      'Anvil può dirti quanto è raro un drop, quanto tempo richiede di solito e quanto sei stato fortunato. Può anche ricordare i tuoi giorni migliori. Questa pagina spiega i numeri.',
    facts: [
      {
        strong: 'Tassi',
        rest: 'arrivano dall\'OSRS Wiki',
      },
      {
        strong: 'Fortuna',
        rest: 'uccisioni attese rispetto a quelle reali',
      },
      {
        strong: 'Record',
        rest: 'partono dal lancio, senza recupero del passato',
      },
    ],
    footnote:
      'Le tue pagine personali sono in [Your profile, Wrapped and Compare]({profileGuide}). Gli interruttori sono in [Settings, page by page]({settingsGuide}).',
    odds: {
      title: 'Le probabilità su un riquadro drop',
      intro:
        'Apri un riquadro drop e vedi fino a otto righe, una per oggetto con probabilità note. Una riga appare così:',
      body: [
        '`Item: 1 in 512 from Boss · ~512 kills ≈ 9.4 h at 55/h`',
        'Se l\'oggetto può essere ottenuto più di una volta per uccisione, compare anche **(×2 rolls)**. Se Anvil non sa quanto velocemente la gente uccide quel boss, la parte delle ore viene omessa.',
      ],
      rows: [
        {
          term: '1 in N',
          body: 'la probabilità del drop per una singola uccisione, dalla fonte che lo ottiene più rapidamente.',
        },
        {
          term: 'Uccisioni attese',
          body: 'il numero medio di uccisioni necessarie. Viene calcolato dalle probabilità e dal numero di tiri.',
        },
        {
          term: 'Ore',
          body:
            'uccisioni attese divise per quante uccisioni all\'ora riesce di solito a fare la gente. È una guida, non una promessa.',
        },
      ],
      note: {
        tag: 'Una media, non un limite',
        body:
          'Metà dei giocatori lo ottiene prima delle uccisioni attese, e alcuni ne hanno bisogno di molte di più. Usalo per capire quanto è grande un riquadro, non per sapere quando uscirà.',
      },
    },
    luck: {
      title: 'Fortuna: spooned, dry o on rate',
      body: [
        'La fortuna confronta le uccisioni che hai fatto con quelle che dovrebbero servire. Se hai il drop con meno uccisioni del previsto, sei **spooned**. Se hai fatto molte uccisioni e non hai ancora nulla, sei **dry**. In mezzo, sei **on rate**.',
        'Anvil ti segna **dry** o **spooned** solo quando è insolito: circa una probabilità di uno su venti o più rara. Mostra quante ne hai rispetto a quante se ne prevedevano, e quanto sei avanti o in debito.',
        'La scheda **Luck** nella pagina Members elenca le persone più secche e più fortunate del tuo clan. I post del plugin per i drop rari possono anche includere una riga di fortuna, come una percentuale tra i migliori o quanti giocatori l\'avrebbero già ottenuto a questo punto.',
      ],
    },
    source: {
      title: 'Da dove vengono i numeri',
      body: [
        'I tassi di drop provengono dall\'OSRS Wiki e vengono aggiornati ogni giorno. I tassi di uccisione per le ore provengono dalle guide ai guadagni della Wiki. Quando un tasso è una stima accurata, Anvil lo tratta come tale.',
        'Se un tasso sembra sbagliato, la Wiki è il posto dove correggerlo. Anvil recepisce la modifica.',
      ],
    },
    records: {
      title: 'Record e ore efficienti',
      body: [
        'Anvil conserva il tuo miglior **day**, **week**, **month** e **year** per XP delle skill, uccisioni di boss e ore efficienti. I giorni sono in UTC e le settimane iniziano il lunedì.',
        'I record contano dal momento in cui è stato lanciato questo. Non esiste nulla di precedente, e Anvil non riempie mai il passato. Un record viene salvato solo quando superi il tuo vecchio migliore.',
        'Vedi i tuoi sulla pagina del tuo personaggio, sotto **Records**. I detentori di record del tuo clan sono in **Members → Records**.',
        '**Efficient hours played** indica quanto tempo ci vorrebbe ai tuoi guadagni con buoni metodi di allenamento, così si possono confrontare una skill veloce e una lenta. **Efficient hours bossed** fa lo stesso per le uccisioni. I tassi provengono dall\'OSRS Wiki, e gli account ironman usano i propri tassi.',
      ],
    },
  },
};

export default it;
