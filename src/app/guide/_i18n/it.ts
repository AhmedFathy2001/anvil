import type { PartialGuideDict } from './en';

// Italiano — Italian.
//
// Stessa convenzione degli altri file di lingua: resta in inglese tutto ciò che il lettore vede
// davvero sullo schermo —— i menu di RuneLite e OBS, le righe di chat che il plugin stampa da sé e le
// etichette del pannello di amministrazione di Anvil (in inglese finché quelle schermate non saranno
// tradotte). Tradurre “Tracked drop detected” significa che chi cerca quella riga non la trova più.
// Tutto il resto —— le spiegazioni, l’ordine, il perché —— è in italiano.

const it: PartialGuideDict = {
  common: {
    contents: 'Indice',
    step: 'Passo',
    optional: 'facoltativo',
    minRead: '{n} min di lettura',
    language: 'Lingua',
    partialNotice:
      'Questa guida è tradotta in {language} solo in parte. Ciò che non è ancora tradotto resta in inglese.',
    backToGuides: 'Tutte le guide',
    unreviewedNotice:
      'Questa traduzione in {language} non è ancora stata riletta da un madrelingua. Se una frase suona sbagliata, la [pagina in inglese]({englishHref}) è l’originale —— e [segnalarcelo](/feedback) è ciò che la fa correggere.',
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
    },
    cards: {
      plugin: {
        eyebrow: 'Per i giocatori',
        title: 'Configurare il plugin RuneLite',
        blurb:
          'Installa il plugin, collegalo a questo sito e lascia che invii i tuoi drop. Copre anche le notifiche Discord e le clip con OBS.',
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
    },
  },

  plugin: {
    metaTitle: 'Configurare il plugin RuneLite — Anvil',
    metaDescription:
      'Installa il plugin RuneLite di Anvil, collegalo a questo sito e configura le notifiche Discord e le clip con OBS.',
    eyebrow: 'Anvil · plugin RuneLite',
    title: 'Guida alla configurazione per i giocatori',
    dek: 'Installalo, puntalo su {clanName} e gioca. Il plugin invia i tuoi drop del bingo, pubblica su Discord i drop rari e le morti e —— se usi OBS —— salva e pubblica le clip dei momenti che vale la pena rivedere.',
    facts: [
      { strong: '2 campi', rest: 'per iniziare a tracciare' },
      { strong: '~3 min', rest: 'per la configurazione di base' },
      { strong: 'Le clip', rest: 'richiedono OBS e 5 minuti in più' },
    ],
    footnote:
      'Gli screenshot vengono da una configurazione reale —— il token dell’account, l’indirizzo di OBS e il webhook Discord sono oscurati apposta. I tuoi dovrebbero restare altrettanto privati.',

    install: {
      title: 'Installa il plugin',
      body: [
        'In RuneLite: **Configuration** (la chiave inglese) → **Plugin Hub** → cerca **Anvil** → **Install**. L’autore è `AhmedFathy2001`.',
        'Un solo plugin serve tutti i clan —— lo punti su questo sito al passo successivo, quindi non c’è nulla di specifico da scaricare. Una volta installato, apri **Configuration → Anvil** per raggiungere il pannello delle impostazioni mostrato in tutta questa guida.',
      ],
    },

    connect: {
      title: 'Collegalo a questo sito',
      intro: 'Per partire conta solo la sezione **Setup**. Tutto il resto ha valori predefiniti ragionevoli.',
      figure: {
        caption: 'Configuration → Anvil → Setup',
        alt: 'La sezione Setup del plugin Anvil, con i campi Site URL e Account Token evidenziati',
        legend: [
          {
            label: 'Site URL',
            body: 'per {clanName} è `{origin}`. Arriva vuoto, quindi devi compilarlo tu. Non serve la barra finale, e `https://` viene aggiunto se lo ometti.',
          },
          {
            label: 'Account Token',
            body: 'la tua chiave personale per questo sito. Puoi lasciare che sia il plugin a inserirlo per te (qui sotto), oppure incollarlo a mano. Trattalo come una password.',
          },
        ],
      },
      easyHeading: 'La via facile: accedi dal plugin',
      easyIntro:
        'Con il Site URL impostato e il token ancora vuoto, il **pannello laterale di Anvil** mostra un pulsante **Sign in with Discord**. Cliccalo e il plugin ti guida —— senza copiare nulla.',
      easySteps: [
        'Il pannello mostra un codice e apre il browser su questo sito.',
        'Controlla che il codice sulla pagina coincida con quello in RuneLite, poi clicca **Approve**.',
        'Il pannello dice _Signed in_ e compila l’Account Token al posto tuo.',
      ],
      linkFigure: {
        caption: 'Questo sito → /link-device',
        alt: 'La pagina “Link your RuneLite client”, con il campo del codice e il pulsante Approve evidenziati',
        legend: [
          { label: 'Il codice', body: 'deve coincidere con quello che il plugin ti sta mostrando in questo momento.' },
          {
            label: 'Approve',
            body: 'approva soltanto un codice mostrato dal _tuo_ client. Se qualcuno ti ha mandato un link o un codice, rifiuta: approvare significherebbe consegnargli il tuo account.',
          },
        ],
      },
      brokeredNote: {
        tag: 'Perché compare un secondo dominio',
        body: [
          'L’approvazione avviene qui, su `{origin}`. Se non hai ancora effettuato l’accesso al sito, il passaggio di login passa dal login Discord condiviso di Anvil su `anvilosrs.com` per confermare la tua identità Discord e ti riporta subito qui —— è lo stesso login che ottieni dal pulsante Login di questo sito, non fa parte del flusso del plugin.',
          'Il plugin in sé parla solo con `{origin}`: si rifiuta di aprire qualsiasi pagina di accesso che non sia sul Site URL che hai digitato.',
        ],
      },
      directNote: {
        tag: 'Dove avviene tutto questo',
        body: [
          'Tutto questo flusso resta su `{origin}` —— il codice viene emesso qui, approvato qui con il login Discord di {clanName}, e il token viene restituito qui. Il plugin si rifiuta di aprire qualsiasi pagina di accesso che non sia sul Site URL che hai digitato, quindi nulla in questo passaggio raggiunge un’altra istanza di Anvil.',
        ],
      },
      federationAside:
        'Da non confondere con **Connect clans** nel pannello laterale —— quello è il pulsante separato e facoltativo che ti collega ad altri clan Anvil, e compare solo quando hai già effettuato l’accesso qui.',
      manualFallback:
        'Se il browser non si apre da solo, il pannello stampa l’indirizzo e il codice così puoi aprirlo a mano. I codici scadono dopo dieci minuti —— basta premere di nuovo il pulsante.',
      manualHeading: 'La via manuale: copia il tuo token',
      manualIntro:
        'Accedi con Discord e apri il [Profilo](/profile), poi scorri fino alla scheda **RuneLite plugin**.',
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
            body: 'copialo nel campo Account Token del plugin. Rotate ne emette uno nuovo e annulla il vecchio —— usalo se sospetti che il tuo token sia trapelato.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Buono a sapersi',
        body: ['Un solo token copre tutti gli eventi a cui sei iscritto qui —— non devi mai reincollarlo per ogni bingo.'],
      },
    },

    accounts: {
      title: 'Collega i tuoi account —— basta giocare',
      body: [
        'Non c’è nessun codice da digitare. Una volta inserito il token, qualunque account con cui accedi viene associato automaticamente al tuo profilo.',
        'Il plugin invia il tuo nome in gioco insieme a un’impronta stabile dell’account a ogni richiesta, e il sito confronta prima l’impronta —— così i collegamenti sopravvivono a un cambio di nome. Accedi una volta con un alt e comparirà sul tuo Profilo sotto _Accounts we noticed you playing_ con un pulsante **Add**.',
      ],
      figure: {
        caption: 'Profilo → RuneScape Accounts',
        alt: 'La scheda RuneScape Accounts sulla pagina del profilo con gli account verificati tramite plugin',
        legend: [
          {
            label: 'I tuoi account collegati',
            body: 'tutto ciò che è contrassegnato “Verified via plugin” è finito lì solo per essere stato giocato. Aggiungi quanti alt vuoi; uno è il principale.',
          },
        ],
      },
      noPluginHeading: 'Non puoi usare il plugin?',
      noPluginIntro:
        'Da mobile o dal client ufficiale, collega l’account dal sito —— il Profilo mostra entrambe le opzioni:',
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
        'Dovresti anche vedere il **pannello laterale di Anvil** riempirsi con i tuoi clan, gli eventi in corso, la tua posizione e i pulsanti di sincronizzazione — e comparire un pulsante **Anvil** nella barra del titolo del Collection Log in gioco, accanto a WikiSync e RuneProfile.',
      guestNote: {
        tag: 'Ospite o membro',
        body: 'Se la chat dice _Tracked as a guest_, sei tracciato ma non sei ancora nel roster del clan. Un admin lo risolve sincronizzando il roster del clan in gioco —— chiedi {discordLink}.',
        discordWord: 'su Discord',
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
            label: 'Auto Submit Drops',
            body: 'fotografa e invia un drop tracciato nell’istante in cui cade. Lascialo attivo; è tutto il senso della cosa.',
          },
          {
            label: 'Show Overlay',
            body: 'disegna un piccolo riquadro _Anvil / squadra / data UTC_ in alto a sinistra. Entra a far parte dell’immagine nei tuoi screenshot di prova, ed è ciò che rende una prova difficile da falsificare o retrodatare. In questo screenshot è disattivato —— attivalo se il tuo clan vuole squadra e orario visibili su ogni prova.',
          },
          {
            label: 'Team completion popups',
            body: 'un banner quando chiunque nella tua squadra completa una casella. Se ne arrivano più insieme: la più difficile prende il banner, le altre vanno in chat.',
          },
          {
            label: 'Distinct mission sound',
            body: 'dà un suono tutto suo a una missione che arriva — e a qualcuno che la reclama — così la distingui da una casella normale senza guardare.',
          },
          {
            label: 'Banner sound + volume',
            body: 'riproduce un suono insieme al banner. Non succede nulla finché non aggiungi almeno un .wav tu, con **Add clip** sotto “Banner sounds” nel pannello laterale di Anvil.',
          },
          {
            label: 'Two-frame drop proof',
            body: 'inserisce nello screenshot un secondo fotogramma un paio di secondi dopo, quando il loot si è posato a terra. Tienilo attivo; evita discussioni.',
          },
        ],
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
        'Scattano che ci sia o meno un bingo in corso, e pubblicano nei canali del clan. Quale canale lo decidono gli admin —— tu scegli solo _cosa_ pubblicare.',
      dropsFigure: {
        caption: 'Morti e kill · Drop e pet',
        alt: 'Le sezioni di notifica “Deaths and kills” e “Drops and pets” con ogni impostazione evidenziata e numerata',
        legend: [
          { label: 'Notify on death', body: 'pubblica nel canale delle morti del clan con uno screenshot del momento in cui sei morto.' },
          { label: 'Death message', body: 'la tua frase. `{name}` viene sostituito con il tuo RSN.' },
          { label: 'Notify on PvP kill', body: 'uno screenshot del tick in cui il tuo bersaglio arriva a 0 HP. Disattivato di base; qui attivo.' },
          { label: 'Notify on rare drops', body: 'l’interruttore principale per i post sui drop.' },
          {
            label: 'Min drop value / Min drop rarity',
            body: 'due strade indipendenti verso un post: vale almeno tanto (GE o high alch, il maggiore dei due) oppure è più raro di 1 su N (1/10.000 di base —— impostazioni più larghe riempiono il canale di erbe). Il tuo clan può fissare una soglia di rarità valida per tutti; la tua vale comunque quando è più severa. Metti 0 per disattivare una delle due strade.',
          },
          { label: 'Screenshot rare drops', body: 'allega l’immagine, non solo il testo.' },
          {
            label: 'Loot key value',
            body: 'una loot key pubblica una volta sola, come singola notifica, quando il suo contenuto complessivo supera questa cifra.',
          },
          { label: 'Notify on pets + Screenshot pets', body: 'i pet vengono pubblicati nel canale dei drop rari.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievement · livelli · diari · quest',
        alt: 'La sezione di notifica dei Combat achievement con ogni impostazione evidenziata e numerata',
        legend: [
          { label: 'Notify on combat achievements', body: 'i completamenti di tier vengono sempre pubblicati quando è attivo.' },
          {
            label: 'CA task min tier',
            body: 'quanto sono rumorosi i singoli task completati. Qui Elite; il valore predefinito è Master. Metti Grandmaster per soli i più rari.',
          },
          { label: 'Notify on 99s & high totals', body: 'i 99, ogni 100 livelli totali da 1800 in su, e il max.' },
          { label: 'Notify on diary completions', body: 'i tier degli achievement diary.' },
          {
            label: 'Announce quest completions',
            body: 'dalla difficoltà che scegli in su. Qui “All quests”; il valore predefinito è Master & up.',
          },
        ],
      },
    },

    clips: {
      title: 'Clip con OBS',
      intro: [
        'Premi un tasto e gli ultimi 30 secondi vengono salvati e finiscono nel canale clip del clan. È disattivato di base e richiede OBS in esecuzione —— ma è la cosa più vicina a un video di highlight che il tuo clan avrà mai.',
        'Come funziona: OBS mantiene un **replay buffer** scorrevole degli ultimi X secondi. Il tuo tasto dice a OBS di scaricare quel buffer su file, e il plugin prende il file e lo carica su un webhook Discord che incolli tu.',
      ],
      privacyNote: {
        tag: 'Dove finisce il tuo video',
        body: 'Le clip vengono caricate **direttamente dal tuo PC a Discord**. Non passano mai da questo sito, e se lasci vuoto il campo del webhook non viene caricato proprio nulla —— le clip restano semplicemente sul tuo computer.',
      },
      obsHeading: 'A. Configura OBS (una volta sola)',
      obsSteps: [
        'Serve **OBS Studio 28 o successivo** —— il server WebSocket è integrato dalla 28 in poi, niente download aggiuntivi.',
        'Assicurati che OBS stia davvero catturando il gioco: una sorgente Game / Window / Display Capture che mostri RuneLite. Se OBS non vede il tuo client, le tue clip saranno un rettangolo nero.',
        '**Settings → Output** → spunta **Enable Replay Buffer**. (In modalità Simple sta nella pagina Recording; in modalità Advanced ha una scheda tutta sua.) Già che ci sei, controlla che il percorso di registrazione abbia spazio libero.',
        '**Tools → WebSocket Server Settings** → spunta **Enable WebSocket server**. Annota la **Server Port** (4455 di base) e clicca **Show Connect Info** per la password.',
      ],
      obsAside:
        'Non devi premere “Start Replay Buffer” —— lo avvia il plugin quando si collega, e lo riavvia ogni volta che cambi la durata della clip.',
      fillHeading: 'B. Compila il plugin',
      figure: {
        caption: 'Configuration → Anvil → Clips',
        alt: 'La sezione Clips della configurazione del plugin con ogni impostazione evidenziata e numerata; l’host OBS e l’URL del webhook sono nascosti',
        legend: [
          { label: 'Enable clip capture', body: 'l’interruttore principale. Da spento, il plugin non parla mai con OBS.' },
          {
            label: 'Capture clip hotkey',
            body: 'impostalo o non succederà mai nulla. Scegli qualcosa che non premerai per sbaglio in mezzo a una raid.',
          },
          {
            label: 'OBS host / port / password',
            body: '`localhost` quando OBS gira sullo stesso PC di RuneLite. Se OBS è su un’altra macchina, metti qui l’IP locale di quella macchina —— nascosto in questo screenshot —— e apri la porta sul suo firewall. Porta e password vengono da _Show Connect Info_; lascia la password vuota se hai disattivato l’autenticazione di OBS.',
          },
          {
            label: 'Max auto-post size (MB)',
            body: 'tutto ciò che è più grande viene salvato in locale e menzionato in chat invece di essere pubblicato. Adattalo a ciò che il tuo server Discord accetta davvero; il plugin parte da 25.',
          },
          {
            label: 'Clip length (seconds)',
            body: 'quanto indietro arriva ogni clip. Questo scrive la durata del buffer nel tuo profilo OBS, quindi OBS ha bisogno di quei secondi di rincorsa prima che esista una clip di lunghezza piena. Clip più lunghe = file più grandi; 30 è una buona via di mezzo.',
          },
          {
            label: 'Save clips as MP4',
            body: 'l’MP4 si vede e si riproduce direttamente dentro Discord; l’MKV va prima scaricato. Attenzione: questo cambia il formato di registrazione di OBS, quindi tocca anche le tue registrazioni normali. Disattivalo per lasciare OBS in pace.',
          },
          {
            label: 'Clips Discord webhook URL',
            body: 'dove vengono pubblicate le clip —— chiedi a un admin il webhook del canale clip. Vuoto = le clip restano sul tuo PC. Qui è nascosto, e vale la pena nasconderlo: chiunque abbia questo URL può pubblicare in quel canale.',
          },
          {
            label: 'Post OBS-triggered clips too',
            body: 'gestisce anche i salvataggi avviati da OBS stesso o dal plugin “Save Replay Buffer for OBS”. Lascialo spento se usi due client RuneLite contro un solo OBS, altrimenti ogni clip viene pubblicata due volte.',
          },
        ],
      },
      useHeading: 'C. Usalo',
      useIntro: 'Succede qualcosa di divertente → premi il tasto → la chat ti accompagna:',
      useChat: [
        { text: 'Saving clip...', tone: 'plain' },
        { text: 'Uploading clip to the clan Discord...', tone: 'plain' },
        { text: 'Clip posted to the clan Discord.', tone: 'green' },
      ],
      reminder: {
        tag: 'Promemoria',
        body: 'La clip copre i secondi _precedenti_ alla pressione del tasto —— quindi premilo dopo il momento, non durante. Hai tutta la durata del buffer per reagire.',
      },
      decodedHeading: 'I messaggi delle clip, decifrati',
      decoded: [
        {
          term: '`Clip capture: OBS isn’t connected.`',
          body: 'OBS non è in esecuzione, il server WebSocket è spento, oppure host/porta/password non coincidono. Sistemalo e premi di nuovo —— il plugin ritenta la connessione da solo ogni 30 secondi.',
        },
        {
          term: '`OBS could not save the clip — is the Replay Buffer started?`',
          body: 'Il buffer non è attivo. Controlla Enable Replay Buffer nelle impostazioni di output di OBS, poi spegni e riaccendi Enable clip capture.',
        },
        {
          term: '`Clip saved locally — paste a Clips Discord webhook URL…`',
          body: 'Funziona come previsto, semplicemente non hai impostato un webhook. Il file è nella cartella di registrazione di OBS.',
        },
        {
          term: '`Clip saved locally (48MB) — too big to auto-post.`',
          body: 'Accorcia la durata della clip, abbassa la qualità di registrazione di OBS, oppure alza la dimensione massima se il tuo server accetta file più grandi.',
        },
        {
          term: '`…but Discord didn’t accept the upload.`',
          body: 'Troppo grande, rate limit, o caricamento scaduto. Il file è ancora sul tuo PC —— pubblicalo a mano se ne vale la pena.',
        },
      ],
    },

    trouble: {
      title: 'Quando qualcosa si rompe',
      intro:
        'Il plugin te lo dice in chat quando il tracciamento si è fermato —— aspetta circa 90 secondi prima di lamentarsi e ripete al massimo ogni 5 minuti.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Il token è sbagliato o è stato rigenerato. Ricopialo da [Profilo → RuneLite plugin](/profile#plugin-token), oppure svuota il campo e accedi di nuovo dal plugin.',
        },
        {
          term: '`Anvil: can’t reach the site — tracking is OFF.`',
          body: 'Controlla che il Site URL non abbia errori di battitura —— dovrebbe essere `{origin}`. Se è giusto, probabilmente il sito è offline.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Quell’account non è ancora collegato. Aggiungilo dal Profilo → “Accounts we noticed you playing”.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Niente. Si è ripreso da solo.',
        },
      ],
      logHeading: 'Ancora bloccato? Manda un log a un admin',
      logBody:
        'Scrivi `::anvillog` nella chat di gioco (o imposta l’**Export debug log hotkey** nella sezione Support del plugin). Scrive un file di log nella cartella `.runelite/anvil-debug`, apre la cartella e copia il percorso negli appunti —— manda quel file a un admin e potrà vedere esattamente cosa è andato storto.',
      missingNote: {
        tag: 'Prove mancanti?',
        body: 'I pet e i Champion’s scroll doppi richiedono uno screenshot manuale. Il plugin lo scatta per te e lo salva in `.runelite/osrs-bingo-pending/` — **Copy folder path** nel pannello laterale di Anvil apre la cartella — così lo alleghi sul sito invece di cercare un’immagine dopo.',
      },
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
      { strong: '4 passi', rest: 'nella procedura guidata' },
      { strong: '7 formati', rest: 'da cui costruire un tabellone' },
      { strong: '1 pulsante', rest: 'per sincronizzare il roster' },
    ],
    footnote:
      'Questa guida segue l’app così com’è oggi. Se una schermata qui non corrisponde a quella che stai guardando, ha ragione l’app e la guida è vecchia —— [segnalacelo](/feedback) e la sistemiamo.',

    access: {
      title: 'Chi può fare cosa',
      intro:
        'Si accede tutti con Discord —— non ci sono password. Il primo admin arriva dalla configurazione del server; dopo di che è un admin a promuovere le persone da **Clan → Members & staff**. I ruoli si sommano verso il basso: tutto ciò che può fare un moderatore lo possono fare anche un tesoriere e un admin.',
      rows: [
        {
          term: 'Admin',
          body: 'accesso completo —— eventi, caselle, squadre, impostazioni, staff, premi. Dallo a quante meno persone il clan riesca a tollerare.',
        },
        { term: 'Tesoriere', body: 'tutto ciò che può fare un moderatore, più le quote d’iscrizione e i premi.' },
        {
          term: 'Moderatore',
          body: 'la quotidianità: roster, verifiche, competizioni settimanali, calendario, feedback. Non può creare né modificare eventi.',
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
        '**System → Setup** è una procedura guidata in quattro passi, e la dashboard tiene gli stessi quattro come lista di controllo finché non sono fatti: nomina il clan, collega Discord, crea un evento, aggiungi caselle. Lo stato è calcolato su dati reali, quindi un passo si spunta solo quando è davvero concluso.',
      discord:
        'Per Discord hai due strade, e si combinano: dai ad Anvil un **bot** e potrà creare webhook, sincronizzare ruoli e nickname e costruire canali privati per le squadre; dagli un singolo **URL di webhook** e potrà pubblicare annunci e nient’altro. Parti dal webhook se vuoi essere operativo in due minuti, aggiungi il bot quando vuoi l’automazione.',
      permsNote: {
        tag: 'Permessi del bot',
        body: 'Il bot ha bisogno di _Manage Webhooks_, _Manage Roles_, _Manage Channels_ e _Manage Nicknames_, e il suo ruolo deve stare _sopra_ i ruoli che gestisce nell’elenco dei ruoli del tuo server. Altrimenti Discord rifiuta in silenzio.',
      },
      hosted:
        'Con un piano ospitato quella schermata l’hai già incontrata una volta: aggiungere il bot durante la configurazione è il modo in cui Anvil ha capito qual è il tuo server, quindi non c’è mai stato un ID da copiare. Lo stesso link è qui ogni volta che vuoi spostare il bot su un altro server.',
    },

    channels: {
      title: 'Dividi i post su più canali',
      body: [
        'Di base tutto finisce in un unico canale annunci. Quando diventa rumoroso, apri **System → Advanced settings → Webhooks** e dai una casa propria alle categorie chiassose —— eventi bingo, competizioni settimanali, drop rari, morti, kill PvP, combat achievement, clip. Tutto ciò che lasci vuoto ricade sul canale principale, quindi puoi separare una categoria alla volta.',
        'Con il bot collegato non tocchi mai un URL di webhook: scegli un canale dal menu e premi **Create webhook**. Su un evento affollato puoi aggiungere un secondo webhook allo stesso canale —— Anvil li alterna così il rate limit di Discord non si mangia i post.',
      ],
      clipsNote: {
        tag: 'Il canale delle clip è diverso',
        body: 'I video delle clip vengono caricati direttamente dal PC di ogni giocatore a Discord —— non passano mai da questo sito. Quindi il webhook delle clip che imposti qui è quello che _distribuisci_: sono i membri a incollarlo nel proprio plugin. Tutto il resto in questa pagina sta sul server e i membri non lo vedono mai.',
      },
    },

    roster: {
      title: 'Porta dentro il roster',
      body: [
        'L’appartenenza al clan viene da un solo posto: una sincronizzazione del roster in gioco. Installa il [plugin RuneLite di Anvil]({pluginGuide}) sull’account di un _admin_, apri la scheda **Bingo** nel Collection Log in gioco e premi **Sync clan roster**. Questo manda al sito la lista reale del tuo clan in un clic.',
        'Chi collega o verifica un account sul sito senza essere in quel roster è un **ospite** —— tracciato, visibile, ma non membro finché un admin non lo promuove o la prossima sincronizzazione non lo raccoglie. È voluto: significa che nessuno può auto-promuoversi nel tuo clan digitando un nome.',
        'Puoi anche aggiungere qualcuno a mano da **Clan → Members & staff**, compresa l’iscrizione a un evento per conto suo quando non riesce a raggiungere il sito.',
      ],
    },

    board: {
      title: 'Crea il primo tabellone',
      intro:
        '**Events → All events → New event**. Scegli prima il formato —— decide come viene assegnato il punteggio e cosa ti chiederà il resto del modulo.',
      formats: {
        classic: { label: 'Bingo classico', blurb: 'Una griglia quadrata N×N —— le squadre completano le caselle nell’ordine che vogliono, ognuna vale 1.' },
        leagues: { label: 'Bingo Leagues', blurb: 'Una lista di compiti dove ogni casella porta un valore in punti —— quante caselle vuoi.' },
        race: { label: 'Corsa a caselle', blurb: 'Un percorso ordinato —— le squadre raggiungono le caselle in sequenza; vince chi arriva più lontano.' },
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
        'La scheda **Tiles** dell’evento è dove un tabellone diventa un bingo. Ogni casella è un solo _tipo_ di compito, e il tipo decide cosa cerca il plugin: un drop, un killcount di boss, XP di skill, l’uccisione di un NPC, un clear a tempo, un achievement diary, un Combat Achievement, uno sblocco del Collection Log, una kill PvP, un guadagno d’inventario o una run senza morti. Le caselle manuali —— quelle che una persona verifica da uno screenshot —— restano sempre un’opzione.',
        'Per un tabellone intero, scrivile in blocco: esporta il foglio, compilalo in un foglio di calcolo e reimportalo. CSV e .xlsx fanno entrambi il giro completo, e le righe corrispondono alle posizioni, così puoi riscrivere un’intera griglia da 25 caselle in un solo incolla.',
      ],
      rows: [
        {
          term: 'Fasce di difficoltà',
          body: 'i valori in punti si mappano su fasce con un nome (easy → elite). Modifica le fasce in Advanced settings se il tuo clan valuta diversamente.',
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
        'La scheda **Teams & Draft** si adatta al formato che hai scelto: un formato che non usa squadre la salta del tutto. Per un normale bingo a squadre crei le squadre, decidi chi le capitana e o assegni tu i giocatori o fai un draft dal vivo.',
        'I capitani pescano dal pool delle iscrizioni nell’ordine che hai stabilito, e ognuno vede le risposte date nel modulo d’iscrizione —— congelate come sono state inviate, così nessuno modifica le proprie “ore a settimana” dopo essere stato scelto.',
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
          body: 'System → Announce pubblica un messaggio nei tuoi canali a evento in corso, senza scrivere un webhook a mano.',
        },
      ],
      missionNote: {
        tag: 'Sorprese a evento in corso',
        body: 'Puoi lanciare una **missione** su un bingo già avviato —— una casella bonus nascosta che viene annunciata quando la fai partire, eventualmente con valore calante o con scadenza. È il modo più economico di risvegliare un tabellone al quinto giorno.',
      },
      startProofNote: {
        tag: 'Fermare l’accumulo prima dell’evento',
        body: [
          'Attiva lo **scatto di partenza** (evento → Overview) e ogni giocatore dovrà consegnare uno screenshot fatto dopo l’avvio dell’evento, in un luogo che Anvil estrae nel momento della partenza —— così nessuno può presentarsi al T0 seduto su una settimana di clue e forzieri in banca. Il luogo viene annunciato con la partenza; la parola chiave di ogni giocatore è personale, deriva dall’estrazione e non esiste prima dell’avvio, quindi nessuno può prepararla in anticipo.',
          'Fissa i punti sulla mappa del mondo (l’editor del pool ne ha una) e il plugin controlla che i giocatori siano davvero lì, invece di limitarsi a dirglielo. Puoi anche richiedere una **sessione fresca** —— 15 minuti di base: gli hiscores si salvano solo al logout, quindi far rientrare tutti subito prima dello scatto è ciò che rende onesti i totali iniziali dietro ogni casella di XP e di KC.',
          'Chi usa il plugin preme un pulsante. Tutti gli altri scrivono la parola chiave in gioco e caricano da My Team. Sei tu a scegliere cosa succede a un credito di chi non ha consegnato: segnalarlo per revisione (predefinito) o rifiutarlo finché non lo fa. Lo stesso pannello Overview è la lista di revisione —— le catture del plugin con parola chiave verificata arrivano già accettate, quindi in pratica guardi solo i giocatori da telefono.',
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
          body: 'la scheda Payouts dell’evento trasforma il montepremi in una lista di chi prende cosa, spuntata man mano che paghi.',
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
          body: 'conserva il tabellone appena costruito. Il prossimo bingo parte da lì invece che da una griglia vuota.',
        },
      ],
      federation:
        'Con la federazione attiva, i membri possono anche collegarsi ad altri clan Anvil dal plugin —— comodo per gli eventi tra clan, e del tutto facoltativo per ciascun membro.',
      outro: 'Poi indirizza i tuoi membri alla [guida per i giocatori]({pluginGuide}) e comincia a pensare al prossimo.',
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
        'Apri il tuo evento e vai alla scheda **Teams & Draft**. Crea una squadra per ogni clan che hai invitato e chiamala col loro nome —— il nome è ciò che i loro giocatori vedono sul modulo d’iscrizione, quindi “Ironforge” batte “Team 2”.',
        'Non _devi_ fare un draft. I link d’invito e il draft sono alternative: un draft distribuisce un pool comune di iscritti, un link sistema le persone direttamente. In un clan contro clan puro la maggior parte di chi ospita crea le squadre, distribuisce un link ciascuna e non apre mai il draft.',
        'Poi apri la squadra stessa —— **Teams & Draft → la squadra** —— che è dove vivono entrambi i due passi successivi.',
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
        caption: 'Evento → Teams & Draft → la squadra → Team staff',
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
        caption: 'Evento → Teams & Draft → la squadra → Invite links',
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
        kill: { label: 'Killcount', blurb: 'N uccisioni di un NPC —— anche di quelli che non compaiono negli hiscores (galline, mucche). Rilevato dal plugin.' },
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
          term: 'Un obiettivo di KC di un boss',
          body: '**non** è una casella kill. Le caselle kill osservano le morti degli NPC tramite il plugin; un obiettivo di KC è un numero degli hiscores e richiede `trackedStat` + `statType=boss` + `statGoal`. Usa una casella kill per ciò che gli Hiscores non hanno mai contato —— mucche, galline, uno specifico mostro da slayer.',
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
        '**Download spreadsheet** nella scheda **Tiles** dell’evento. Ottieni un .xlsx del tabellone com’è, con i menu a tendina, la lista degli oggetti e le istruzioni delle colonne in fogli separati.',
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
        'Su un tabellone a punti ogni casella porta il proprio valore, e quei valori si mappano su fasce di difficoltà con un nome —— da easy a elite —— che puoi modificare in **Advanced settings** se il tuo clan valuta diversamente. La fascia è ciò che leggono i giocatori; il numero è ciò che fa punteggio.',
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
      'Il formato si fissa alla creazione ma resta modificabile dalla scheda Overview dell’evento; la politica di svelamento e i modificatori di punteggio si possono cambiare in qualsiasi momento prima che le caselle interessate vengano svelate.',

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
      'Quote e premi sono l’ambito del tesoriere. Un tesoriere può fare tutto ciò che può fare un moderatore, più questo; un moderatore può segnare una quota come incassata ma non può mai chiuderla.',

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
        'Quante firme serve una quota è un’impostazione del clan, da zero a cinque. Lo zero esiste per un motivo vero: in un clan dove il tesoriere _è_ il proprietario non c’è nessun altro che firmi, e “34 quote in attesa di una seconda firma” diventa una coda che non si potrà mai svuotare e stabilmente la cosa più rumorosa della dashboard. A zero, segnare una quota come pagata **è** la firma.',
        'Mettila a uno —— il valore predefinito —— se siete in due. Mettila a zero se onestamente non lo siete, e alzala solo se il tuo clan ha sia lo staff sia il motivo.',
      ],
    },

    pay: {
      title: 'Pagare i premi',
      body: [
        'Quando l’evento finisce, la scheda **Payouts** dell’evento trasforma il montepremi in una lista di persone. Generala e ottieni una riga per destinatario, non per squadra: il premio di una squadra vincente si divide equamente fra i suoi membri, così pagare diventa una lista di nomi e numeri invece di un problema di aritmetica a mezzanotte.',
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
        'il roster: sincronizzarlo, aggiungere persone, promuovere un ospite',
        'le verifiche degli account —— la sfida XP e la revisione manuale',
        'gli invii e gli screenshot di prova',
        'le competizioni settimanali e il calendario',
        'i feedback dei membri',
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
          body: 'il caso più comune, e non richiede nulla da te. Giocare l’account con il plugin collegato lo associa in automatico, e un’impronta stabile dell’account fa sì che il collegamento sopravviva a un cambio di nome.',
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
        body: 'Verificare un account dice “questo è davvero suo”. Non lo mette nel clan —— l’appartenenza al clan viene solo da una sincronizzazione del roster in gioco o da un admin che lo aggiunge a mano. Chi è verificato ma non è nel roster è un **ospite**: tracciato, visibile, e non membro. È voluto, ed è ciò che impedisce a chiunque di entrare nel tuo clan digitando un nome.',
      },
    },

    roster: {
      title: 'Tenere il roster veritiero',
      body: [
        'Il roster viene da un solo posto: un admin lancia una sincronizzazione dalla lista del clan in gioco, con il pulsante **Anvil** nella barra del titolo della finestra del clan (o **Sync roster** nel pannello laterale del plugin). Tutto il resto —— verifiche, collegamenti, iscrizioni —— pende da lì.',
        'Quindi la manutenzione è piccola ma reale: lancia la sincronizzazione dopo ogni tornata di reclutamento, promuovi gli ospiti che sono davvero entrati, e guarda le persone che il sito ha segnalato come da rivedere invece di aspettare che si lamentino.',
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
};

export default it;
