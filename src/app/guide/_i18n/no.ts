import type { PartialGuideDict } from './en';

// Norsk (bokmål) — Norwegian.
//
// Samme konvensjon som i alle de andre språkfilene her: alt leseren FAKTISK SER på skjermen blir
// stående på engelsk — menyer i RuneLite og OBS, pluginets egne chattelinjer, og Anvils egne
// adminetiketter, som er engelske til den flaten også blir oversatt. En oversatt "Tracked drop
// detected" er en linje ingen finner igjen. Alt annet — forklaringen, rekkefølgen, hvorfor — er norsk.

const no: PartialGuideDict = {
  common: {
    contents: 'Innhold',
    step: 'Trinn',
    optional: 'valgfritt',
    minRead: '{n} min lesing',
    language: 'Språk',
    partialNotice:
      'Denne veiledningen er bare delvis oversatt til {language}. Det som ennå ikke er oversatt, vises på engelsk.',
    backToGuides: 'Alle veiledninger',
    unreviewedNotice:
      'Denne oversettelsen til {language} er ennå ikke lest gjennom av noen som har språket som morsmål. Hvis en setning leses feil, er [den engelske siden]({englishHref}) originalen — og [å si fra](/feedback) er det som får den rettet.',
  },

  index: {
    metaTitle: 'Veiledninger — Anvil',
    metaDescription:
      'Kom i gang med Anvil: RuneLite-pluginet for spillere, å kjøre et event for klanens stab, og å være vert for en gjesteklan.',
    title: 'Veiledninger',
    dek: 'Alt du trenger for å komme i gang, skrevet for akkurat den versjonen av Anvil som kjører her.',
    groups: {
      playing: 'Å spille',
      running: 'Å kjøre et event',
      clan: 'Å drive klanen',
    },
    cards: {
      plugin: {
        eyebrow: 'For spillere',
        title: 'Oppsett av RuneLite-pluginet',
        blurb:
          'Installer pluginet, koble det til dette nettstedet, og la det sende inn dropsene dine. Dekker også Discord-varsler og klipp via OBS.',
        minutes: '~3 min oppsett',
      },
      board: {
        eyebrow: 'For brettbyggere',
        title: 'Bygg et brett som sporer seg selv',
        blurb:
          'Hva hver rutetype faktisk kan se, masseredigering via regneark, og feilene som importeres pent og deretter aldri utløses.',
        minutes: '~8 min',
      },
      captain: {
        eyebrow: 'For lagkapteiner',
        title: 'Kapteinveiledningen',
        blurb:
          'Å lese puljen før klokka starter, selve draftdagen, og de delene av å lede et lag som begynner etterpå.',
        minutes: '~6 min',
      },
      formats: {
        eyebrow: 'For klanens stab',
        title: 'Formater, og hvordan ruter åpnes',
        blurb:
          'Sju brettformer, fem måter ruter blir spillbare på, og de tre modifikatorene som avgjør hva en fullføring er verdt.',
        minutes: '~5 min',
      },
      fees: {
        eyebrow: 'For kasserere',
        title: 'Avgifter og utbetalinger',
        blurb:
          'Å ta en påmeldingsavgift, samle den inn, den andre signaturen som avslutter den, og å gjøre en pott om til betalte plasseringer.',
        minutes: '~5 min',
      },
      moderator: {
        eyebrow: 'For moderatorer',
        title: 'På vakt',
        blurb:
          'Køen, gjennomgang av innsendte bevis og kontoer, å holde medlemslista ærlig, og vurderingene som havner hos et menneske.',
        minutes: '~5 min',
      },
      admin: {
        eyebrow: 'For klanens stab',
        title: 'Slik kjører du ditt første event',
        blurb:
          'Discord, medlemsliste, brett, ruter, lag og draft, oppstart — og hva du gjør når eventet er over.',
        minutes: 'en kveld, én gang',
      },
      clanVsClan: {
        eyebrow: 'For verter',
        title: 'Å være vert for en gjesteklan',
        blurb:
          'Klan mot klan uten å samle inn et eneste RSN for hånd: én invitasjonslenke per lag, og en plass som lar deres egen moderator styre sin halvdel.',
        minutes: '~5 min per lag',
      },
    },
  },

  plugin: {
    metaTitle: 'Oppsett av RuneLite-pluginet — Anvil',
    metaDescription:
      'Installer Anvils RuneLite-plugin, koble det til dette nettstedet, og sett opp Discord-varsler og OBS-klipp.',
    eyebrow: 'Anvil · RuneLite-plugin',
    title: 'Oppsettsveiledning for spillere',
    dek: 'Installer det, pek det mot {clanName}, og spill. Pluginet sender inn bingo-dropsene dine, poster de sjeldne dropsene og dødsfallene dine på Discord, og — hvis du kjører OBS — lagrer og poster klipp av øyeblikkene som er verdt å se om igjen.',
    facts: [
      { strong: '2 felter', rest: 'så er sporingen i gang' },
      { strong: '~3 min', rest: 'for grunnoppsettet' },
      { strong: 'Klipp', rest: 'krever OBS + 5 minutter til' },
    ],
    footnote:
      'Skjermbildene er fra et ekte oppsett — kontotoken, OBS-adresse og Discord-webhook er sladdet med vilje. Dine bør forbli like private.',

    install: {
      title: 'Installer pluginet',
      body: [
        'I RuneLite: **Configuration** (skiftenøkkelen) → **Plugin Hub** → søk etter **Anvil** → **Install**. Utgiveren er `AhmedFathy2001`.',
        'Ett plugin dekker alle klaner — du peker det mot dette nettstedet i neste trinn, så det er ingenting klanspesifikt å laste ned. Når det er installert, åpne **Configuration → Anvil** for å nå innstillingene som brukes gjennom hele denne veiledningen.',
      ],
    },

    connect: {
      title: 'Koble til dette nettstedet',
      intro: 'Bare seksjonen **Setup** betyr noe for å komme i gang. Alt annet har fornuftige standardverdier.',
      figure: {
        caption: 'Configuration → Anvil → Setup',
        alt: 'Setup-seksjonen i Anvil-pluginet, med feltene Site URL og Account Token rammet inn',
        legend: [
          {
            label: 'Site URL',
            body: 'for {clanName} er det `{origin}`. Feltet er tomt fra start, så du må fylle det ut. Ingen skråstrek på slutten er nødvendig, og `https://` legges til hvis du utelater den.',
          },
          {
            label: 'Account Token',
            body: 'din personlige nøkkel til dette nettstedet. Enten lar du pluginet fylle den ut for deg (nedenfor), eller så limer du den inn selv. Behandle den som et passord.',
          },
        ],
      },
      easyHeading: 'Den enkle veien: logg inn fra pluginet',
      easyIntro:
        'Med Site URL satt og token fortsatt tom viser **Anvil-sidepanelet** en **Sign in with Discord**-knapp. Klikk på den, så leder pluginet deg gjennom — uten at du kopierer noe.',
      easySteps: [
        'Panelet viser en kode og åpner nettleseren din på dette nettstedet.',
        'Sjekk at koden på siden stemmer med den i RuneLite, og klikk så **Approve**.',
        'Panelet sier _Signed in_ og fyller ut Account Token for deg.',
      ],
      linkFigure: {
        caption: 'Dette nettstedet → /link-device',
        alt: 'Siden Link your RuneLite client, med kodefeltet og Approve-knappen rammet inn',
        legend: [
          { label: 'Koden', body: 'den må stemme med det pluginet viser deg akkurat nå.' },
          {
            label: 'Approve',
            body: 'godkjenn bare en kode som _din egen_ klient viser. Har noen sendt deg en lenke eller en kode, avvis den — å godkjenne ville vært å gi dem kontoen din.',
          },
        ],
      },
      brokeredNote: {
        tag: 'Derfor dukker et annet domene opp',
        body: [
          'Godkjenningen skjer her, på `{origin}`. Hvis du ikke allerede er logget inn på nettstedet, går selve innloggingstrinnet via Anvils delte Discord-innlogging på `anvilosrs.com` for å bekrefte hvem du er på Discord, og sender deg så rett tilbake hit — det er den samme innloggingen som Login-knappen på dette nettstedet gir deg, ikke en del av pluginets flyt.',
          'Pluginet selv snakker bare med `{origin}`: det nekter å åpne en innloggingsside som ikke ligger på den Site URL-en du skrev inn.',
        ],
      },
      directNote: {
        tag: 'Hvor dette skjer',
        body: [
          'Hele flyten blir på `{origin}` — koden utstedes her, godkjennes her med {clanName}s egen Discord-innlogging, og token leveres tilbake her. Pluginet nekter å åpne en innloggingsside som ikke ligger på den Site URL-en du skrev inn, så ingenting i dette trinnet når en annen Anvil-installasjon.',
        ],
      },
      federationAside:
        'Må ikke forveksles med **Connect clans** i sidepanelet — det er den separate, valgfrie knappen som kobler deg til andre Anvil-klaner, og den dukker først opp når du allerede er logget inn her.',
      manualFallback:
        'Hvis nettleseren ikke åpner seg selv, skriver panelet ut adressen og koden slik at du kan åpne den manuelt. Koder utløper etter ti minutter — trykk bare på knappen igjen.',
      manualHeading: 'Den manuelle veien: kopier tokenet ditt',
      manualIntro:
        'Logg inn med Discord og åpne [Profile](/profile), og bla så ned til kortet **RuneLite plugin**.',
      tokenFigure: {
        caption: 'Profile → RuneLite plugin',
        alt: 'RuneLite plugin-kortet på profilsiden, med tokenfeltet og knappene Reveal, Copy og Rotate rammet inn',
        legend: [
          {
            label: 'Tokenet ditt',
            body: 'skjult til du trykker Reveal. Det er sladdet på dette skjermbildet med vilje; post aldri ditt eget i Discord.',
          },
          {
            label: 'Copy / Rotate',
            body: 'kopier det inn i pluginets Account Token-felt. Rotate utsteder et nytt og dreper det gamle — bruk det hvis du noen gang mistenker at tokenet ditt har lekket.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Verdt å vite',
        body: ['Ett token dekker alle eventene du er påmeldt her — du limer det aldri inn på nytt per bingo.'],
      },
    },

    accounts: {
      title: 'Koble kontoene dine — bare spill',
      body: [
        'Det finnes ingen koblingskode å taste. Når tokenet er på plass, matches kontoen du logger inn med automatisk mot profilen din.',
        'Pluginet sender navnet ditt i spillet pluss et stabilt kontofingeravtrykk med hver forespørsel, og nettstedet matcher på fingeravtrykket først — så koblingene dine overlever et navnebytte. Logg inn på en altkonto én gang, så dukker den opp på profilen din under _Accounts we noticed you playing_ med en **Add** i ett klikk.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'Kortet RuneScape Accounts på profilsiden som lister opp kontoer verifisert via pluginet',
        legend: [
          {
            label: 'De koblede kontoene dine',
            body: 'alt som er merket “Verified via plugin” havnet der bare ved å bli spilt. Legg til så mange altkontoer du vil; én av dem er hovedkontoen din.',
          },
        ],
      },
      noPluginHeading: 'Kan du ikke kjøre pluginet?',
      noPluginIntro:
        'På mobil eller i den offisielle klienten kobler du kontoen på nettsiden i stedet — profilsiden viser begge mulighetene:',
      noPluginOptions: [
        '**Verify by XP** — skriv inn RSN-et ditt, nettstedet velger en tilfeldig ferdighet, og du skal tjene 1 000 XP i den innen 30 minutter.',
        '**Manual review** — for skjulte Hiscores eller helt nye altkontoer: send inn RSN-et ditt med en kommentar, så godkjenner en moderator det.',
      ],
      signupNote:
        'Påmelding til event krever minst én verifisert konto, så få det unnagjort før du melder deg på.',
    },

    working: {
      title: 'Sjekk at det virker',
      intro:
        'Logg inn og les chatteboksen din. Pluginet hilser på deg når det er tilkoblet og et event pågår.',
      chat: [
        { text: 'Bingo running: Summer Bingo 2026.', tone: 'gold' },
        { text: 'Skill of the Week is live: Runecraft.', tone: 'gold' },
        { text: '…senere, etter hvert som ting skjer…', tone: 'muted' },
        { text: 'Tracked drop detected: Dragon warhammer (1/1)', tone: 'plain' },
        { text: 'Tracked kill: Zulrah (7/10)', tone: 'plain' },
      ],
      outro:
        'Du bør også se **Anvil-sidepanelet** fylles med klanene dine, pågående eventer, plasseringen din og synkroniseringsknappene — og en **Anvil**-knapp dukke opp i tittellinjen på Collection Log i spillet, ved siden av WikiSync og RuneProfile.',
      guestNote: {
        tag: 'Gjest eller medlem',
        body: 'Sier chatten _Tracked as a guest_, blir du sporet, men du står ikke på klanens medlemsliste ennå. Det fikser en admin ved å synkronisere medlemslista fra spillet — spør {discordLink}.',
        discordWord: 'på Discord',
      },
    },

    bingo: {
      title: 'Bingo-innstillinger',
      intro:
        'De betyr bare noe mens du er med i et event. Standardverdiene er greie — dette er hva hver enkelt faktisk gjør.',
      figure: {
        caption: 'Configuration → Anvil → Bingo',
        alt: 'Bingo-seksjonen i pluginets innstillinger med hver innstilling rammet inn og nummerert',
        legend: [
          {
            label: 'Auto Submit Drops',
            body: 'tar et skjermbilde og sender inn et sporet drop i samme øyeblikk det faller. La den stå på; det er hele poenget.',
          },
          {
            label: 'Show Overlay',
            body: 'tegner et lite panel med _Anvil / lag / UTC-dato_ oppe til venstre. Det blir en del av bildet i bevis-skjermbildene dine, og det er nettopp det som gjør et bevis vanskelig å forfalske eller datere tilbake. Den er av på dette bildet — slå den på hvis klanen din vil se lag og tid på hvert bevis.',
          },
          {
            label: 'Team completion popups',
            body: 'et banner når noen på laget ditt fullfører en rute. Flere samtidig: den vanskeligste får banneret, resten går til chatten.',
          },
          {
            label: 'Distinct mission sound',
            body: 'gir et oppdrag som lander — og noen som tar det — sin egen lyd, så du skiller det fra en vanlig rute uten å se etter.',
          },
          {
            label: 'Banner sound + volume',
            body: 'spiller en lyd sammen med banneret. Ingenting skjer før du selv legger til minst én .wav-fil, via **Add clip** under “Banner sounds” i Anvil-sidepanelet.',
          },
          {
            label: 'Two-frame drop proof',
            body: 'baker inn et bilde nummer to i skjermbildet et par sekunder senere, når lootet har lagt seg på bakken. La den stå på; den sparer deg for diskusjoner.',
          },
        ],
      },
      startHeading: 'Startbilde',
      startBody: [
        'Noen event krever et **startbilde** av alle: ett skjermbilde tatt etter at eventet har startet, på et sted som trekkes i selve startøyeblikket. Det hindrer folk i å bruke uka før eventet på å samle opp clues, kister og kills å dumpe første dag.',
        'Kjører du pluginet, er det ingenting å forberede. Når eventet starter, får du en chattelinje som sier hvor du skal, og Anvil-sidepanelet viser en **Take starting shot**-knapp. Still deg der det står, trykk én gang, og du er ferdig — pluginet tar bildet, stempler det med RSN-et ditt, laget ditt, stedet og et passord bare kontoen din får, og arkiverer det for deg.',
        'To ting sjekkes før noe arkiveres, slik at du rekker å rette dem i spillet i stedet for i en Discord-krangel etterpå. Har verten festet stedet på kartet, vet pluginet hvor langt unna du er og sier fra, i stedet for å sende et bilde fra feil side av Gielinor. Og krever eventet en fersk økt, må du **logge ut og inn igjen** før du tar det: hiscores lagres bare når du logger ut, så en ny innlogging rett før bildet er det som gjør starttallene dine — og dermed hver XP- og KC-rute — riktige.',
        'På mobil, eller uten pluginet: åpne **My Team** på dette nettstedet, les passordet ditt på startbilde-kortet, skriv det inn i chatteboksen i spillet, ta et skjermbilde der både figuren din og passordet er synlig, og last det opp på det samme kortet. Opplastingen teller med én gang — du kan spille i det den er inne, og staben går gjennom den i etterkant. Logg ut og inn først hvis kortet ber deg om det.',
      ],
    },

    notifications: {
      title: 'Discord-varsler',
      intro:
        'Disse sendes uansett om en bingo pågår eller ikke, og de postes i klanens kanaler. Hvilken kanal bestemmer administratorene her — du velger bare _hva_ du poster.',
      dropsFigure: {
        caption: 'Deaths & kills · Drops & pets',
        alt: 'Varselseksjonene Deaths and kills og Drops and pets med hver innstilling rammet inn og nummerert',
        legend: [
          {
            label: 'Notify on death',
            body: 'poster i klanens dødskanal med et skjermbilde av øyeblikket du døde.',
          },
          { label: 'Death message', body: 'din egen linje. `{name}` byttes ut med RSN-et ditt.' },
          {
            label: 'Notify on PvP kill',
            body: 'et skjermbilde av ticket der målet ditt når 0 HP. Av som standard; på her.',
          },
          { label: 'Notify on rare drops', body: 'hovedbryteren for drop-innlegg.' },
          {
            label: 'Min drop value / Min drop rarity',
            body: 'to uavhengige veier til et innlegg: verdt minst så mye (GE eller high alch, det som er høyest), eller sjeldnere enn 1 av N (1/10 000 som standard — løsere innstillinger fyller kanalen med urteruller). Klanen din kan sette en sjeldenhetsgrense som gjelder alle; din egen gjelder likevel når den er strengere. Sett en av dem til 0 for å slå av den veien.',
          },
          { label: 'Screenshot rare drops', body: 'legg ved bildet, ikke bare teksten.' },
          {
            label: 'Loot key value',
            body: 'en loot key postes én gang, som ett enkelt varsel, når hele innholdet passerer dette tallet.',
          },
          { label: 'Notify on pets + Screenshot pets', body: 'pets postes i kanalen for sjeldne drops.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · levels · diaries · quests',
        alt: 'Varselseksjonen Combat achievements med hver innstilling rammet inn og nummerert',
        legend: [
          { label: 'Notify on combat achievements', body: 'fullførte nivåer postes alltid når denne er på.' },
          {
            label: 'CA task min tier',
            body: 'hvor støyende enkeltoppgaver er. Elite her; standarden er Master. Sett den til Grandmaster for bare de aller sjeldneste.',
          },
          {
            label: 'Notify on 99s & high totals',
            body: '99-ere, hvert 100. totalnivå fra 1800 og opp, og max.',
          },
          { label: 'Notify on diary completions', body: 'nivåer i achievement diary.' },
          {
            label: 'Announce quest completions',
            body: 'fra vanskelighetsgraden du velger og oppover. “All quests” her; standarden er Master og opp.',
          },
        ],
      },
    },

    clips: {
      title: 'Klipp med OBS',
      intro: [
        'Trykk på én tast, så lagres de siste 30 sekundene og legges i klanens klippkanal. Det er av som standard og krever at OBS kjører — men det er det nærmeste en høydepunktsfilm klanen din kommer.',
        'Slik virker det: OBS holder en rullerende **replay buffer** med de siste X sekundene. Hurtigtasten din ber OBS skrive bufferen til en fil, og pluginet plukker opp fila og laster den opp til en Discord-webhook du har limt inn.',
      ],
      privacyNote: {
        tag: 'Hvor videoen din havner',
        body: 'Klipp lastes opp **rett fra maskinen din til Discord**. De passerer aldri dette nettstedet, og ingenting lastes opp i det hele tatt hvis du lar webhook-feltet stå tomt — da blir klippene liggende på maskinen din.',
      },
      obsHeading: 'A. Sett opp OBS (én gang)',
      obsSteps: [
        'Du trenger **OBS Studio 28 eller nyere** — WebSocket-serveren er innebygd fra 28 og framover, ingen ekstra nedlasting.',
        'Sørg for at OBS faktisk fanger spillet: en Game / Window / Display Capture-kilde som viser RuneLite. Ser ikke OBS klienten din, blir klippene dine et svart rektangel.',
        '**Settings → Output** → huk av **Enable Replay Buffer**. (I Simple output-modus ligger den på Recording-siden; i Advanced har den sin egen fane.) Sjekk samtidig at opptaksstien har ledig plass.',
        '**Tools → WebSocket Server Settings** → huk av **Enable WebSocket server**. Noter **Server Port** (4455 som standard) og klikk **Show Connect Info** for passordet.',
      ],
      obsAside:
        'Du trenger _ikke_ å trykke “Start Replay Buffer” — pluginet starter den for deg når det kobler til, og starter den på nytt hver gang du endrer klipplengden.',
      fillHeading: 'B. Fyll ut pluginet',
      figure: {
        caption: 'Configuration → Anvil → Clips',
        alt: 'Clips-seksjonen i pluginets innstillinger med hver innstilling rammet inn og nummerert; OBS-verten og webhook-URL-en er skjult',
        legend: [
          { label: 'Enable clip capture', body: 'hovedbryteren. Er den av, snakker pluginet aldri med OBS i det hele tatt.' },
          {
            label: 'Capture clip hotkey',
            body: 'sett den, ellers skjer det aldri noe. Velg noe du ikke treffer ved et uhell midt i et raid.',
          },
          {
            label: 'OBS host / port / password',
            body: '`localhost` når OBS kjører på samme maskin som RuneLite. Kjører OBS på en annen maskin, skriv den maskinens lokale IP her — skjult på dette bildet — og slipp porten gjennom brannmuren dens. Port og passord kommer fra _Show Connect Info_; la passordet stå tomt hvis du har slått av OBS-autentisering.',
          },
          {
            label: 'Max auto-post size (MB)',
            body: 'alt større lagres lokalt og nevnes diskret i chatten i stedet for å postes. Sett den etter hva Discord-serveren din faktisk godtar; pluginet leveres med 25.',
          },
          {
            label: 'Clip length (seconds)',
            body: 'hvor langt tilbake hvert klipp rekker. Dette skriver bufferlengden inn i OBS-profilen din, så OBS trenger så mange sekunders forsprang før et klipp i full lengde i det hele tatt finnes. Lengre klipp = større filer; 30 er et godt mellompunkt.',
          },
          {
            label: 'Save clips as MP4',
            body: 'MP4 forhåndsvises og spilles direkte i Discord; MKV må lastes ned først. Merk at dette endrer opptaksformatet til OBS, som også påvirker de vanlige opptakene dine. Slå den av for å la OBS være i fred.',
          },
          {
            label: 'Clips Discord webhook URL',
            body: 'dit klippene postes — be en admin om webhooken til klippkanalen. Tomt = klippene blir på maskinen din. Skjult her, og verdt å skjule: alle med denne URL-en kan poste i den kanalen.',
          },
          {
            label: 'Post OBS-triggered clips too',
            body: 'håndterer også lagringer utløst av OBS selv eller av pluginet “Save Replay Buffer for OBS”. La den stå av hvis du kjører to RuneLite-klienter mot én OBS, ellers postes hvert klipp to ganger.',
          },
        ],
      },
      useHeading: 'C. Bruk det',
      useIntro: 'Noe morsomt skjer → trykk på hurtigtasten → chatten leder deg gjennom:',
      useChat: [
        { text: 'Saving clip...', tone: 'plain' },
        { text: 'Uploading clip to the clan Discord...', tone: 'plain' },
        { text: 'Clip posted to the clan Discord.', tone: 'green' },
      ],
      reminder: {
        tag: 'Husk',
        body: 'Klippet dekker sekundene _før_ du trykket — så trykk etter øyeblikket, ikke under. Du har hele bufferens lengde på deg til å reagere.',
      },
      decodedHeading: 'Klippmeldinger, forklart',
      decoded: [
        {
          term: '`Clip capture: OBS isn’t connected.`',
          body: 'OBS kjører ikke, WebSocket-serveren er av, eller vert/port/passord stemmer ikke. Fiks det og trykk igjen — pluginet prøver å koble til på nytt av seg selv hvert 30. sekund.',
        },
        {
          term: '`OBS could not save the clip — is the Replay Buffer started?`',
          body: 'Bufferen kjører ikke. Sjekk Enable Replay Buffer i OBS sine output-innstillinger, og slå så Enable clip capture av og på.',
        },
        {
          term: '`Clip saved locally — paste a Clips Discord webhook URL…`',
          body: 'Virker som det skal, du har bare ingen webhook satt. Fila ligger i OBS-opptaksmappa di.',
        },
        {
          term: '`Clip saved locally (48MB) — too big to auto-post.`',
          body: 'Kort ned klipplengden, senk kvaliteten på OBS-opptaket, eller hev maksstørrelsen hvis serveren din godtar større filer.',
        },
        {
          term: '`…but Discord didn’t accept the upload.`',
          body: 'For stor, rate-limitet, eller opplastingen gikk tom for tid. Fila ligger fortsatt på maskinen din — post den for hånd hvis den er verdt det.',
        },
      ],
    },

    trouble: {
      title: 'Når noe går galt',
      intro:
        'Pluginet sier fra i chatten når sporingen har stoppet — det venter rundt 90 sekunder før det klager, og gjentar seg maks hvert 5. minutt.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Tokenet er feil eller har blitt rotert. Kopier det på nytt fra [Profile → RuneLite plugin](/profile#plugin-token), eller tøm feltet og logg inn fra pluginet igjen.',
        },
        {
          term: '`Anvil: can’t reach the site — tracking is OFF.`',
          body: 'Sjekk Site URL for skrivefeil — den skal være `{origin}`. Stemmer den, er nettstedet trolig nede.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Den kontoen er ikke koblet ennå. Legg den til fra Profile → “Accounts we noticed you playing”.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Ingenting. Det ordnet seg av seg selv.',
        },
      ],
      logHeading: 'Fortsatt fast? Send en admin en logg',
      logBody:
        'Skriv `::anvillog` i spillets chat (eller sett **Export debug log hotkey** i pluginets Support-seksjon). Den skriver en loggfil til `.runelite/anvil-debug`-mappa di, åpner mappa og kopierer stien til utklippstavla — send den fila til en admin, så ser de nøyaktig hva som gikk galt.',
      missingNote: {
        tag: 'Mangler det bevis?',
        body: 'Pets og ekstra Champion’s scrolls krever et manuelt skjermbilde. Pluginnet tar det for deg og lagrer det i `.runelite/osrs-bingo-pending/` — **Copy folder path** i Anvil-sidepanelet åpner mappen — så du legger det ved på siden i stedet for å lete etter et bilde etterpå.',
      },
    },
  },

  admin: {
    metaTitle: 'Slik kjører du ditt første event — Anvils adminveiledning',
    metaDescription:
      'Sett opp en klan på Anvil og kjør en bingo fra ende til annen: Discord, medlemsliste, brett, ruter, lag og draft, oppstart, og hva som skjer når eventet er over.',
    eyebrow: 'Anvil · for klanens stab',
    title: 'Slik kjører du ditt første event',
    dek: 'Hele veien, i den rekkefølgen du faktisk går den: få {clanName} satt opp, få inn medlemslista, bygg et brett, draft lag, dra i gang det hele og del ut premiene. Omtrent en kvelds arbeid for den første bingoen — minutter for den andre.',
    facts: [
      { strong: '4 trinn', rest: 'i oppsettsveiviseren' },
      { strong: '7 formater', rest: 'å bygge et brett av' },
      { strong: '1 knapp', rest: 'for å synkronisere medlemslista' },
    ],
    footnote:
      'Denne veiledningen følger appen slik den er i dag. Stemmer ikke en skjerm her med det du ser på, er appen riktig og veiledningen gammel — [si fra](/feedback), så fikser vi den.',

    access: {
      title: 'Hvem kan gjøre hva',
      intro:
        'Alle logger inn med Discord — ingen passord. Den første administratoren kommer fra serverkonfigurasjonen; deretter forfremmer en admin folk fra **Clan → Members & staff**. Rollene stabler nedover: alt en moderator kan, kan en kasserer og en admin også.',
      rows: [
        {
          term: 'Admin',
          body: 'full tilgang — event, ruter, lag, innstillinger, stab, utbetalinger. Gi den til så få som klanen tåler.',
        },
        { term: 'Treasurer', body: 'alt en moderator kan, pluss påmeldingsavgifter og utbetalinger.' },
        {
          term: 'Moderator',
          body: 'det daglige: medlemsliste, verifiseringer, ukeskonkurranser, timeplan, tilbakemeldinger. Kan ikke opprette eller redigere event.',
        },
        {
          term: 'Editor',
          body: 'bare ruteredigering. Gi den globalt, eller avgrens den til bestemte brett så en innleid brettbygger bare når det eventet du har overlatt til dem.',
        },
        { term: 'Member', body: 'spiller; har ingen adminflate i det hele tatt.' },
      ],
      seeAlso:
        'To av de rollene har sin egen side: [På vakt]({moderatorGuide}) om hva en moderator faktisk bruker kvelden sin på, og [Avgifter og utbetalinger]({feesGuide}) for kassereren.',
      ownerNote: {
        tag: 'Eier',
        body: 'Én konto er eieren. Ingen andre kan degradere den, og det er den eneste rollen som kan gi eierskapet videre — så å tape en krangel med en medadmin kan aldri koste deg klanen.',
      },
    },

    setup: {
      title: 'Gi klanen navn, koble til Discord',
      intro:
        '**System → Setup** er en veiviser i fire trinn, og dashbordet beholder de samme fire som en sjekkliste til de er ferdige: gi klanen navn, koble til Discord, opprett et event, legg til ruter. Statusen regnes ut fra ekte data, så et trinn hukes først av når det virkelig er ferdig.',
      discord:
        'For Discord har du to veier, og de lar seg kombinere: gi Anvil en **bot**, så kan den opprette webhooks, synkronisere roller og kallenavn og bygge private lagkanaler; gi den én enkelt **webhook-URL**, så kan den poste kunngjøringer og ingenting annet. Start med webhooken hvis du vil være i gang på to minutter, og legg til boten når du vil ha automatikken.',
      permsNote: {
        tag: 'Botens rettigheter',
        body: 'Boten trenger _Manage Webhooks_, _Manage Roles_, _Manage Channels_ og _Manage Nicknames_, og rollen dens må ligge _over_ rollene den styrer i serverens rolleliste. Ellers nekter Discord i stillhet.',
      },
      hosted:
        'På en hostet plan møtte du den skjermen én gang allerede: å legge til boten under oppsettet var måten Anvil fant ut hvilken server som er deres, så det fantes aldri en server-ID å kopiere. Den samme lenken ligger her når du vil flytte boten til en annen server.',
    },

    channels: {
      title: 'Fordel innleggene på flere kanaler',
      body: [
        'Alt postes som standard i én hovedkanal for kunngjøringer. Når den blir bråkete, åpne **System → Advanced settings → Webhooks** og gi de høylytte kategoriene egne hjem — bingo-event, ukeskonkurranser, sjeldne drops, dødsfall, PvP-kills, combat achievements, klipp. Alt du lar stå tomt, faller tilbake til hovedkanalen, så du kan skille ut én kategori av gangen.',
        'Med boten tilkoblet rører du aldri en webhook-URL: velg en kanal fra lista og trykk **Create webhook**. Under et travelt event kan du legge til en webhook nummer to på samme kanal — Anvil veksler mellom dem slik at Discords hastighetsgrense ikke sluker innlegg.',
      ],
      clipsNote: {
        tag: 'Klippkanalen er annerledes',
        body: 'Klippvideoer lastes opp rett fra hver spillers maskin til Discord — de passerer aldri dette nettstedet. Derfor er klipp-webhooken du setter opp her den du _deler ut_: medlemmene limer den inn selv i pluginet sitt. Alt annet på denne siden skjer på serveren, og medlemmene ser det aldri.',
      },
    },

    roster: {
      title: 'Få inn medlemslista di',
      body: [
        'Klanmedlemskap kommer fra ett sted: en synkronisering av medlemslista fra spillet. Installer [Anvils RuneLite-plugin]({pluginGuide}) på en _admins_ konto, åpne **Bingo**-fanen i spillets Collection Log, og trykk **Sync clan roster**. Det skyver den faktiske klanlista deres fra spillet opp til nettstedet med ett klikk.',
        'Alle som kobler eller verifiserer en konto på nettsiden uten å stå på den lista, er en **gjest** — sporet og synlig, men ikke medlem før en admin forfremmer dem eller neste synkronisering plukker dem opp. Det er med vilje: det betyr at ingen kan forfremme seg selv inn i klanen din ved å skrive et navn.',
        'Du kan også legge til noen for hånd fra **Clan → Members & staff**, inkludert å melde dem på et event på deres vegne når de ikke når nettstedet.',
      ],
    },

    board: {
      title: 'Opprett ditt første brett',
      intro:
        '**Events → All events → New event**. Velg format først — det avgjør hvordan brettet gir poeng og hva resten av skjemaet spør deg om.',
      formats: {
        classic: {
          label: 'Klassisk bingo',
          blurb: 'Et kvadratisk N×N-rutenett — lagene fullfører rutene i vilkårlig rekkefølge, hver verdt 1.',
        },
        leagues: {
          label: 'Leagues-bingo',
          blurb: 'En oppgaveliste der hver rute har sin egen poengverdi — så mange ruter du vil.',
        },
        race: {
          label: 'Ruteløp',
          blurb: 'En ordnet bane — lagene når rutene i rekkefølge; den som kommer lengst, vinner.',
        },
        showdown: {
          label: 'Showdown',
          blurb:
            'Rutene holdes skjult til sitt planlagte tidspunkt — sett hvert avsløringstidspunkt i Tiles-fanen. Poengbasert, i DMM All Stars-stil.',
        },
        luckydraw: {
          label: 'Lykketrekning',
          blurb: 'En bingoutroper: skjulte ruter åpnes i tilfeldige trekninger med faste mellomrom. Poengbasert.',
        },
        bounty: {
          label: 'Dusørjakt',
          blurb:
            'Én åpen rute av gangen — første lag som fullfører den, tar poengene, og neste dusør trekkes.',
        },
        ladder: {
          label: 'Stige',
          blurb:
            'En poengbasert oppgaveliste rangert som en individuell toppliste (lag er valgfritt). Oppgavene roterer — progressivt, én av gangen, eller i et rullerende vindu — og kan synke i verdi. I stil med en månedsstige.',
        },
      },
      outro:
        'Sett så datoene, påmeldingsvinduet, og om påmelding koster en avgift. Start fra en mal hvis du helst slipper å starte med et tomt rutenett — galleriet rommer både de innebygde malene og hvert brett du har lagret som mal før.',
      seeAlso:
        'Formatet er bare halve avgjørelsen — hvordan ruter blir spillbare er den andre halvdelen, og de to bygger på hverandre. Begge deler i sin helhet: [Formater, og hvordan ruter åpnes]({formatsGuide}).',
      utcNote: {
        tag: 'Datoer er UTC',
        body: 'Hvert tidsstempel i Anvil lagres og sammenlignes i UTC, og vises i hver besøkendes lokale tid. Sett sluttidspunktet du mener; nettstedet viser en brite og en australier to forskjellige klokkeslett for det samme øyeblikket.',
      },
    },

    tiles: {
      title: 'Fyll brettet',
      body: [
        'Eventets **Tiles**-fane er der et brett blir til en bingo. Hver rute er én _type_ oppgave, og typen avgjør hva pluginet ser etter: et drop, et boss-killcount, ferdighets-XP, et NPC-kill, en fullføring på tid, en achievement diary, en Combat Achievement, en opplåsning i collection log, et PvP-kill, en gjenstandsgevinst, eller en runde uten dødsfall. Manuelle ruter — de som et menneske godkjenner ut fra et skjermbilde — er alltid et alternativ også.',
        'For et fullt brett, skriv dem i bulk: eksporter arket, fyll det ut i et regneark, og importer det tilbake. Både CSV og .xlsx går fram og tilbake, og rader følger posisjoner, så du kan skrive om et helt 25-ruters nett med én innliming.',
      ],
      rows: [
        {
          term: 'Vanskelighetsgrader',
          body: 'poengverdier oversettes til navngitte bånd (easy → elite). Rediger båndene under Advanced settings hvis klanen din graderer annerledes.',
        },
        {
          term: 'Balansekontrollen',
          body: 'sjekker et ferdig brett for strukturelle problemer og skjev arbeidsmengde før spillerne i det hele tatt ser det.',
        },
        {
          term: 'Skjult til du avslører',
          body: 'nye brett starter skjult. Staben ser dem alltid; spillerne ser ingenting før du avslører — så et brett kan bygges i åpenhet uten å bli spolert.',
        },
      ],
      seeAlso:
        'Hvilken type du skal velge, hvordan du skriver to hundre av dem i et regneark, og feilene som importeres pent og deretter aldri utløses: [Bygg et brett som sporer seg selv]({boardGuide}).',
    },

    teams: {
      title: 'Lag og draft',
      body: [
        'Fanen **Teams & Draft** tilpasser seg formatet du valgte: et format uten lag hopper rett forbi den. For en vanlig laginndelt bingo oppretter du lagene, bestemmer hvem som er kapteiner, og enten fordeler spillerne selv eller kjører en live draft.',
        'Kapteinene drafter fra påmeldingspuljen i den rekkefølgen du velger, og hver kaptein ser svarene folk ga i påmeldingsskjemaet — fryst slik de ble sendt inn, så ingen redigerer «timer per uke» etter å ha blitt valgt.',
      ],
      lockNote: {
        tag: 'Draften låser lagene',
        body: 'Så snart en draft er i gang, er både lagene og valgrekkefølgen fryst. Legg til laget du glemte _før_ du trykker start, ikke etter.',
      },
      seeAlso:
        'Send kapteinene dine [kapteinveiledningen]({captainGuide}) før draftkvelden — krigsrommet er mest verdt i dagene før, og ingen leser en ny skjerm mens en klokke går.',
      visitingClans:
        'Spiller dere mot en annen klan i stedet for å drafte deres egne? Den besøkende siden stiller med sin egen tropp gjennom én lenke, og moderatoren deres styrer den uten en adminkonto her — se [Å være vert for en gjesteklan]({clanVsClanGuide}).',
    },

    launch: {
      title: 'Start og kjør det',
      body: [
        'Avslør rutene, og start så eventet. Anvil nekter å starte et brett som ikke er klart — en draft som fortsatt pågår, eller spillere uten lag — og forteller deg hvilket. Vet du bedre (en treningskamp, en omkjøring, et brett du tester), kan du tvinge det gjennom.',
        'Deretter kjører det stort sett seg selv. Pluginet krediterer automatisk alt det ser og poster bevisbilder stemplet med lag og et UTC-tidsstempel. Det som havner på ditt bord, er:',
      ],
      rows: [
        {
          term: 'Innsendinger til gjennomgang',
          body: 'manuelle ruter og alt pluginet har flagget. Godkjenn eller avslå med beviset foran deg.',
        },
        {
          term: 'Statistikk',
          body: 'eventets Stats-fane viser bidrag per spiller — nyttig når et lag krangler om hvem som bar hvem.',
        },
        {
          term: 'Kunngjøringer',
          body: 'System → Announce poster en melding i kanalene deres midt i eventet uten at du skriver en webhook for hånd.',
        },
      ],
      missionNote: {
        tag: 'Overraskelser underveis',
        body: 'Du kan slippe et **oppdrag** ned på en pågående bingo — en skjult bonusrute som kunngjøres når du fyrer den av, og som eventuelt synker i verdi eller utløper. Det er den billigste måten å vekke et brett på dag fem.',
      },
      startProofNote: {
        tag: 'Å stoppe hamstring før eventet',
        body: [
          'Slå på **Starting shot** (eventet → Overview), så må hver spiller levere ett skjermbilde tatt etter at eventet har startet, på et sted Anvil trekker i selve startøyeblikket — så ingen sitter på en uke med oppsparte clues og kister ved null. Stedet kunngjøres ved starten; hver spillers passord er personlig, avledet av trekningen, og finnes ikke før eventet starter, så det kan ikke settes opp på forhånd av noen.',
          'Fest stedene på verdenskartet (puljeredigereren har ett), så sjekker pluginet at spillerne faktisk står der i stedet for bare å ha fått beskjed. Du kan også kreve en **fersk økt** — 15 minutter som standard: hiscores lagres bare når en spiller logger ut, så å få alle til å logge inn på nytt rett før bildet sitt er det som gjør starttallene bak hver XP- og KC-rute ærlige.',
          'Pluginbrukere trykker på én knapp. Alle andre skriver passordet sitt i spillet og laster opp på My Team. Du velger hva som skjer med en kreditering fra noen som ikke har levert: flagg den for gjennomgang (standard), eller nekt den til de gjør det. Det samme Overview-panelet er gjennomgangslista — pluginbilder med verifisert passord kommer inn allerede godkjent, så i praksis ser du bare på mobilspillerne.',
        ],
      },
    },

    after: {
      title: 'Etter den siste ruta',
      intro:
        'Når klokka går ut, fryser brettet og eventet låses — poeng, bidrag og hvem-gjorde-hva fryses slik de sto. Trenger du å fikse noe etterpå, kan en admin låse det opp bevisst.',
      rows: [
        {
          term: 'Utbetalinger',
          body: 'eventets Payouts-fane gjør premiepotten om til en liste over hvem som får hva, som hukes av mens du betaler ut.',
        },
        {
          term: 'Oppsummering',
          body: 'en offentlig oppsummeringsside med sluttstillingen og utmerkelser etter eventet — største drop, flest kills, og resten.',
        },
        {
          term: 'Spørreundersøkelse',
          body: 'spør klanen hva de syntes. Bygg den i Survey-fanen; spillerne svarer når eventet er over, og bare staben ser resultatene.',
        },
        {
          term: 'Lagre som mal',
          body: 'behold brettet du nettopp bygde. Neste bingo starter fra det i stedet for et tomt rutenett.',
        },
      ],
      federation:
        'Med føderasjon slått på kan medlemmene også koble seg til andre Anvil-klaner fra pluginet — nyttig for event på tvers av klaner, og helt frivillig per medlem.',
      outro: 'Pek så medlemmene dine mot [oppsettsveiledningen for spillere]({pluginGuide}) og begynn å planlegge den neste.',
    },
  },

  clanVsClan: {
    metaTitle: 'Å være vert for en gjesteklan — Anvils vertsveiledning',
    metaDescription:
      'Kjør klan mot klan på Anvil: gi hver gjesteklan en invitasjonslenke som setter spillerne deres på ett lag, og en plass så deres egen moderator styrer sin halvdel.',
    eyebrow: 'Anvil · for verter',
    title: 'Å være vert for en gjesteklan',
    dek: 'Du er vert for brettet; de stiller med troppen. Dette er veien som slipper å samle inn et dusin RSN i en DM — én lenke per lag, og en plass som lar deres egen moderator styre sin halvdel av eventet.',
    facts: [
      { strong: '1 lenke', rest: 'per gjestelag' },
      { strong: '0 adminplasser', rest: 'delt ut til utenforstående' },
      { strong: '~5 min', rest: 'per klan du inviterer' },
    ],
    footnote:
      'Skjermbildene er fra et ekte oppsett på et testbrett — invitasjonstokens og Discord-navn er sladdet. En ekte lenke er verdt å passe på: alle som har den, kan ta en plass på det laget så lenge den er aktiv.',

    shape: {
      title: 'Det du setter opp',
      body: [
        'Klan mot klan er et helt vanlig event med én forskjell: halvparten av spillerne er ikke i klanen din og kommer aldri til å bli det. De kan ikke synkroniseres inn fra medlemslista, du vil ikke forfremme dem, og du vil definitivt ikke melde på tjue av dem for hånd og så dra hver enkelt til riktig lag.',
        'To brikker løser det, og de er uavhengige — bruk den ene, eller begge.',
      ],
      rows: [
        {
          term: 'En invitasjonslenke',
          body: 'en URL du lager én gang for ett lag. Den som åpner den, logger inn, fyller ut det vanlige påmeldingsskjemaet, og lander på det laget allerede godkjent — ingen draftpulje, ingen godkjenningskø.',
        },
        {
          term: 'En plass i lagstaben',
          body: 'en navngitt person som kan styre _akkurat det ene laget_ — troppen, innsendingene og bevisene, avgiftene — uten en adminkonto her, og uten å ta kapteinsplassen fra den som faktisk spiller.',
        },
      ],
      note: {
        tag: 'Hva en invitasjon ikke er',
        body: 'Det er ikke en innlogging og ingen snarvei forbi verifisering. Den som åpner den, logger likevel inn med Discord og trenger likevel et verifisert RSN, akkurat som ved enhver annen påmelding. Det eneste lenken avgjør, er _hvilket lag_ påmeldingen havner på, og at den ikke trenger noens godkjenning.',
      },
    },

    team: {
      title: 'Lag laget først',
      body: [
        'Åpne eventet ditt og gå til fanen **Teams & Draft**. Opprett ett lag per klan du har invitert, og kall det opp etter dem — navnet er det spillerne deres ser i påmeldingsskjemaet, så “Ironforge” slår “Lag 2”.',
        'Du trenger _ikke_ å kjøre en draft. Invitasjonslenker og en draft er alternativer: en draft fordeler en felles påmeldingspulje, en lenke setter folk direkte på plass. På en ren klan-mot-klan oppretter de fleste verter lagene, deler ut én lenke hver, og åpner aldri draften.',
        'Åpne så selve laget — **Teams & Draft → laget** — for det er der begge de to neste trinnene skjer.',
      ],
      captainNote: {
        tag: 'Kapteinen først',
        body: 'Utpek den besøkende sidens kaptein før du deler ut lenken, så lagsiden har en eier fra starten. Å utpeke en kaptein setter dem også på laget; advarer kortet om at de ikke står i troppen, ta imot rettelsen det tilbyr.',
      },
    },

    staff: {
      title: 'Gi moderatoren deres en plass',
      body: [
        'Panelet **Team staff** på lagsiden er måten gjesteklanens egen moderator kommer i gang på, uten at du gir dem noe som helst på nettstedet ditt. Trykk **Add someone**, søk dem opp, legg til et notat som “Ironforge’s mod” så neste admin vet hvorfor de er der, og trykk **Give a seat**.',
      ],
      figure: {
        caption: 'Eventet → Teams & Draft → laget → Team staff',
        alt: 'Team staff-panelet med én tildelt plass og søkefeltet åpent for å legge til flere',
        legend: [
          {
            label: 'Add someone',
            body: 'åpner søket. Bare folk som har logget inn her med Discord minst én gang, kan dukke opp — se notatet nedenfor.',
          },
          {
            label: 'Notatet',
            body: 'fritekst, 120 tegn. Skriv hvilken klan de kommer fra. Plasser blir stående i lista etter eventet, og “hvem er dette?” er spørsmålet du sitter med om tre måneder.',
          },
          {
            label: 'Remove',
            body: 'tar plassen tilbake med én gang. Gjør det når eventet er over — en plass er ikke tidsbegrenset av seg selv.',
          },
        ],
      },
      canDo: 'Hva en plass kan gjøre, bare på det laget:',
      canDoList: [
        'se og styre lagets tropp',
        'håndtere innsendingene og bevisene',
        'markere spillernes avgifter som betalt',
        'lage invitasjonslenker til det, hvis du slår det på (trinnet etter neste)',
      ],
      cantDo: 'Hva den aldri kan gjøre:',
      cantDoList: [
        'røre noe annet lag',
        'redigere brettet eller rutene',
        'gjøre draftvalg',
        'bytte ut noen når eventet først er i gang',
      ],
      note: {
        tag: 'De må logge inn her én gang først',
        body: 'Søket lister bare kontoer med koblet Discord — en plass henger på en person som faktisk kan logge inn. Send altså gjesteklanens moderator til dette nettstedet, be dem trykke **Login** én gang, og gi _deretter_ plassen. Dukker de ikke opp i søket, har den innloggingen ikke skjedd ennå.',
      },
    },

    link: {
      title: 'Lag invitasjonslenken',
      body: [
        'Fortsatt på lagsiden lager panelet **Invite links** lenken. To felter avgjør hva lenken lover, og begge tolker `0` som “ikke lov noe”.',
      ],
      figure: {
        caption: 'Eventet → Teams & Draft → laget → Invite links',
        alt: 'Invite links-panelet med feltene for plasser og utløp, knappen Make a link, og én aktiv lenke i lista',
        legend: [
          {
            label: 'Seats og Expires in hours',
            body: 'hvor mange personer lenken får sette inn (opptil 100), og hvor lenge den gjelder (opptil 30 dager). Sett plassene til størrelsen på troppen de har lovet deg, så lukker lenken seg selv når alle er inne; sett et utløp når lenken skal ut i en offentlig Discord. `0` i et av feltene betyr ingen grense.',
          },
          {
            label: 'Make a link',
            body: 'lager den og kopierer den til utklippstavla med én gang. Lim den til dem før du gjør noe annet.',
          },
          {
            label: 'Lista over aktive lenker',
            body: 'hver lenke laget har ute, med hvor mange som har blitt med, og hvor mange plasser som er igjen. **Copy** henter den igjen; **Turn off** dreper den for godt.',
          },
        ],
      },
      shape:
        'Lenken ser slik ut: `{origin}/events/{eventId}/join/{token}` — én linje, trygg å lime inn i en Discord-melding.',
      note: {
        tag: 'Fornuftige standardvalg',
        body: 'På en klan-mot-klan der du har avtalt en tropp med én moderator: la begge feltene stå på `0` og la dem styre det. Ta i bruk plasser og utløp når lenken skal et sted du ikke kontrollerer.',
      },
      revoke:
        'Å slå av en lenke virker med én gang og fjerner ingen som allerede er kommet inn — de er vanlige spillere på laget nå. Vil du ta noen av, bruk lagets tropp.',
    },

    captains: {
      title: 'La dem lage sine egne lenker',
      body: [
        'Som standard er det bare en vert som kan lage lenker, og en kaptein som prøver, får beskjed om det. Den standarden er riktig for et vanlig klanevent — en kaptein som deler ut plasser, fyller en tropp ingen har godkjent — og feil for en klan-mot-klan, der den besøkende siden kjenner sin egen tropp bedre enn deg.',
        'Bryteren sitter i det samme **Invite links**-panelet: **Let captains make their own links**. Den gjelder _hvert lag i dette eventet_, ikke bare det du ser på — noe som er nettopp det du vil ha når begge sider er gjesteklaner.',
        'Med den slått på kan lagets kaptein og alle med en plass i staben lage lenker selv fra **My Team → Invite links**. De får det samme panelet som deg, minus bryteren.',
      ],
      figure: {
        caption: 'My Team → laget → Invite links',
        alt: 'Invite links-fanen sett fra kapteinens side i lagsenteret, med feltene for plasser og utløp og én aktiv lenke',
        legend: [
          {
            label: 'Samme panel, kapteinens utgave',
            body: 'lag, kopier, slå av. Har ikke verten slått på bryteren, står det “Only a host can make links for this event”, og feltene er borte.',
          },
          {
            label: 'Lista over aktive lenker',
            body: 'en kaptein som ikke får lage lenker, ser likevel de laget har ute — så de kan be deg om en til i stedet for å anta at det ikke finnes noen.',
          },
        ],
      },
    },

    player: {
      title: 'Hva spillerne deres ser',
      intro:
        'Verdt å gå gjennom én gang selv før du deler ut lenken, så du kan svare på spørsmål om den.',
      steps: [
        'De åpner lenken. Er de ikke logget inn, logger de inn med Discord først og kommer rett tilbake — lenken går ikke tapt underveis.',
        'De lander på det helt vanlige påmeldingsskjemaet, med et banner som sier **You’re joining {teamExample} by invite**. Samme spørsmål, samme kontovelger, samme avgift som for alle andre.',
        'Når de sender inn, er de på det laget, godkjent. Ingen handling fra verten, ingen draft.',
      ],
      figure: {
        caption: 'Påmeldingsskjemaet, åpnet via en invitasjonslenke',
        alt: 'Eventets påmeldingsskjema med et banner om at spilleren blir med på et navngitt lag via invitasjon',
        legend: [
          {
            label: 'Invitasjonsbanneret',
            body: 'navngir laget de er i ferd med å bli med på. Navngir det feil lag, har de feil lenke — stopp og sjekk før de sender inn.',
          },
          {
            label: 'Resten av skjemaet',
            body: 'uendret. Et verifisert RSN kreves fortsatt, påmeldingsspørsmålene stilles fortsatt, og en påmeldingsavgift gjelder fortsatt.',
          },
        ],
      },
      note: {
        tag: 'Allerede påmeldt?',
        body: 'Har noen meldt seg på vanlig vis først og sitter i puljen, flytter lenken dem over på laget i stedet for å lage en påmelding nummer to. Den som allerede er godkjent på et annet lag, blir latt i fred — flytt dem fra troppen i stedet.',
      },
    },

    dead: {
      title: 'Når en lenke slutter å virke',
      intro:
        'En avvist lenke forklarer seg selv på siden i stedet for å gi en 404, så den som sitter med den, kan fortelle deg hvilken av disse det er.',
      rows: [
        {
          term: 'This invite has been turned off.',
          body: 'Noen trykket **Turn off**. Lag en ny — en gammel lenke kommer aldri tilbake.',
        },
        {
          term: 'This invite has expired.',
          body: 'Den nådde timene du satte. Lag en til, denne gangen med `0` timer hvis utløpet ikke gjør noen nytte.',
        },
        {
          term: 'This invite is full.',
          body: 'Alle plassene er tatt. Hev det ved å lage en ny lenke med flere plasser — antallet ligger fast så snart en lenke finnes.',
        },
        {
          term: 'Sign-ups for this event aren’t open.',
          body: 'Den eneste som kan ordne seg selv. Sjekk eventets påmeldingsvindu: har det åpnet ennå, har fristen gått ut, eller har eventet allerede startet.',
        },
        {
          term: 'That invite belongs to a different event.',
          body: 'En lenke fra et annet brett er blitt limt inn. Sjekk at event-ID-en i URL-en er den du mente.',
        },
      ],
      checklist: 'Før eventet, gå gjennom denne lista én gang per gjesteklan:',
      checklistItems: [
        'laget deres finnes og er oppkalt etter dem',
        'kapteinen deres er utpekt og satt på laget',
        'moderatoren deres har logget inn her og har en plass i lagstaben',
        'lenken er laget, kopiert og faktisk levert til et menneske',
        'påmeldingsvinduet er åpent så lenge de trenger det',
      ],
      note: {
        tag: 'Når alt er over',
        body: 'Slå av lenkene og fjern plassene i lagstaben. Ingen av delene utløper av seg selv, og en aktiv lenke på et avsluttet event er bare en løs tråd.',
      },
    },
  },

  board: {
    metaTitle: 'Å bygge et brett — Anvils veiledning til ruteredigering',
    metaDescription:
      'Lag bingoruter som krediterer seg selv: hva hver rutetype faktisk kan se, masseredigering via regneark, og feilene som svikter i stillhet.',
    eyebrow: 'Anvil · for brettbyggere',
    title: 'Bygg et brett som sporer seg selv',
    dek: 'En rute er et løfte om at noe vil bli lagt merke til. Dette er hva hver type faktisk kan se, hvordan du skriver to hundre av dem uten å miste kvelden, og de få feilene som svikter i stillhet — ruta utløses rett og slett aldri, og ingen oppdager det før dag fire.',
    facts: [
      { strong: '15 typer', rest: 'én per rute, aldri blandet' },
      { strong: '1000 ruter', rest: 'per brett, via regneark' },
      { strong: 'I stillhet', rest: 'er slik en dårlig rute svikter' },
    ],
    footnote:
      'Regnearkformatet er beskrevet i sin helhet i `docs/tile-authoring.md`, som er skrevet for den (eller det) som genererer radene. Denne siden er den menneskelige halvdelen: hvilken type du skal gripe til, og hva som går galt.',

    kinds: {
      title: 'Én rute, én type',
      body: [
        'Hver rute er nøyaktig én _type_, og typen er hele spørsmålet: den avgjør hva pluginet eller hiscores-sveipet ser etter, og dermed om ruta i det hele tatt kan bli ferdig av seg selv. Å blande felter fra to typer avvises i døra i stedet for å bli akseptert og etterlatt ødelagt.',
        'Typene faller i tre familier, og familien betyr mer enn navnet:',
      ],
      families: [
        {
          term: 'Manuell',
          body: 'et menneske ser på et skjermbilde og sier ja. Alltid tilgjengelig, virker alltid, koster alltid noen kvelden. Bruk den til det programvare ikke kan se.',
        },
        {
          term: 'Hentet fra Hiscores',
          body: 'ferdighets-XP og boss-killcount, lest fra de offisielle Hiscores i et sveip hvert 15. minutt. Krever ingen plugin og virker for alle på medlemslista — men ser bare det Hiscores teller, og først etter at spilleren har logget ut.',
        },
        {
          term: 'Oppdaget av pluginet',
          body: 'alt annet: drops, NPC-kills, fullføringer på tid, diaries, combat tasks, runder, lootverdi. Krediterer innen sekunder og baker inn et bevisbilde — men bare for spillere som faktisk kjører pluginet.',
        },
      ],
      kindsIntro: 'Hele lista, i den rekkefølgen typevelgeren tilbyr dem:',
      kindLabels: {
        standard: { label: 'Standard', blurb: 'Manuell rute — en kaptein markerer den som gjort. Ingen automatisk sporing.' },
        skill: { label: 'Ferdighet', blurb: 'Blir ferdig automatisk når en ferdighet når et XP-mål (hentet fra hiscores).' },
        boss: { label: 'Boss-KC', blurb: 'Blir ferdig automatisk når en boss når et killcount-mål (hentet fra hiscores).' },
        drop: { label: 'Drop', blurb: 'N drops av en gjenstand (eller hvilken som helst fra en pulje) — oppdaget av pluginet, med innbakt skjermbilde.' },
        collection: { label: 'Gjenstandssett', blurb: 'Flere gjenstander, hver med sitt eget krav — én av hver til et komplett sett.' },
        kill: { label: 'Killcount', blurb: 'N kills av en NPC — også de som aldri sto på hiscores (høner, kuer). Oppdaget av pluginet.' },
        lap: { label: 'Agility-runder', blurb: 'N runder på en agility-bane, eller N etasjer / hele runder i Hallowed Sepulchre — talt live fra telleren i spillet. Bare runder løpt under eventet teller.' },
        pvp: { label: 'PvP-kill', blurb: 'Drep spillere — hvem som helst, rivaliserende lag, eller en navngitt dusør — i Wilderness eller på PvP-verdener. Trygge minispill teller aldri.' },
        gain: { label: 'Gjenstandsgevinst', blurb: 'Fang, tilbered eller samle N av en gjenstand — talt fra det som havner i inventoryet. Oppdaget av pluginet.' },
        timed: { label: 'På tid', blurb: 'Fullfør en aktivitet under et tidstak (Inferno, raids, Colosseum). Pluginet tar tiden.' },
        deathless: { label: 'Uten dødsfall', blurb: 'Fullfør et raid med NULL dødsfall i laget, N ganger. Pluginet teller hvert dødsfall inne i instansen.' },
        lms: { label: 'LMS', blurb: 'Bli topp N i Last Man Standing (1 = seier), M ganger. Oppdaget av pluginet når spillet slutter.' },
        value: { label: 'Lootverdi', blurb: 'Loot verdt X gp — ett bytte, eller bytter som til sammen når et mål. Pluginet prissetter byttet.' },
        diary: { label: 'Diary', blurb: 'Fullfør achievement diary-nivåer under eventet. Oppdaget av pluginet via meldingen om fullføring.' },
        ca: { label: 'Combat task', blurb: 'Fullfør Combat Achievement-oppgaver under eventet. Oppdaget av pluginet via meldingen om fullføring.' },
      },
      note: {
        tag: 'Pluginspørsmålet, stilt én gang',
        body: 'En rute pluginet oppdager, er usynlig for en spiller som ikke kjører pluginet. Det er ingen feil du kan konfigurere bort — ingenting ser etter. Spiller en del av klanen din på mobil eller den offisielle klienten: hold enten de rutene unna veien til seier, eller sett et manuelt alternativ ved siden av og regn med å gå gjennom skjermbilder.',
      },
    },

    pick: {
      title: 'Velg typen som faktisk utløses',
      intro:
        'De fleste ruter som oppfører seg dårlig, er riktig idé uttrykt som feil type. De fire som tar folk:',
      rows: [
        {
          term: 'Et boss-KC-mål',
          body: 'er **ikke** en kill-rute. Kill-ruter følger NPC-dødsfall via pluginet; et KC-mål er et hiscores-tall og trenger `trackedStat` + `statType=boss` + `statGoal`. Bruk en kill-rute til det Hiscores aldri har telt — kuer, høner, en bestemt slayer-mob.',
        },
        {
          term: 'En plass i collection log',
          body: 'er en drop-rute. Opplåsingen av loggoppføringen krediterer den, så ruta utløses også på et duplikat spilleren allerede hadde — som som regel er det du mente.',
        },
        {
          term: '“Få én av hver”',
          body: 'er en drop-rute med en gjenstandsliste og **uten** `requiredAmount`. Legger du til et `requiredAmount`, blir den i stillhet til “få hvilke som helst N av disse” — samme rad, en helt annen rute.',
        },
        {
          term: 'En diary eller combat task',
          body: 'krediterer bare ut fra meldingen i spillet, som kommer i samme øyeblikk nivået eller oppgaven er ferdig. Noe en spiller allerede eier, kan ikke utløses på nytt — bortsett fra en combat task, der **Settings → Combat Achievements → Repeat completion** lar dem utløse den igjen.',
        },
      ],
      note: {
        tag: 'Sammensatte boss-ruter',
        body: 'En boss-rutes sporede stat kan romme flere hiscores-nøkler adskilt med komma, og framgangen summeres på tvers av dem. `chambersOfXeric,chambersOfXericChallengeMode` er én rute som teller CoX og CM sammen — noe som nesten alltid er det en raid-rute betyr.',
      },
    },

    bulk: {
      title: 'Skriv dem i bulk, ikke i nettleseren',
      body: [
        'Å klikke fram et 25-ruters nett går fint. Å klikke fram et Leagues-brett med 200 oppgaver gjør det ikke, og heller ikke å korrekturlese det etterpå. Tiles-fanen har en tur-retur bygget for nettopp dette.',
      ],
      steps: [
        '**Download spreadsheet** i eventets **Tiles**-fane. Du får en .xlsx av brettet slik det er nå, med nedtrekkslister, gjenstandslista og kolonneveiledningen på hvert sitt ark.',
        'Rediger det. Én rad per rute; radrekkefølgen er ruterekkefølgen.',
        '**Upload CSV / Excel** i samme fane. Bare **Tiles**-arket leses.',
      ],
      rules: [
        {
          term: 'Turen mister ingenting',
          body: 'last ned og last opp igjen uendret, så skjer det ingenting — rader som matcher, rapporteres som uendret og blir ikke engang tidsstemplet. Det gjør eksporten trygg å bruke som sikkerhetskopi før en stor endring.',
        },
        {
          term: 'Rader følger posisjoner',
          body: 'rad 1 er rute 1. Eksisterende ruter oppdateres på stedet, og en kolonne du utelater, blir latt i fred i stedet for tømt — så du kan sende et ark med to kolonner som bare endrer poeng.',
        },
        {
          term: 'Bare dynamiske brett vokser',
          body: 'ekstra rader oppretter nye ruter på et Leagues-brett eller et ruteløp, før eventet starter, opptil 1000. Et klassisk N×N-nett har en fast form og ignorerer dem. Skal du generere hundrevis av oppgaver, gjør det til et Leagues-event.',
        },
        {
          term: 'Alt eller ingenting',
          body: 'alle rader valideres først. Ett gjenstandsnavn som ikke lar seg slå opp, får hele importen til å feile, navngir synderne, og endrer ingenting — du ender aldri med et halvt brett.',
        },
        {
          term: 'Noen felter låses ved start',
          body: 'navn, type, krevd antall og gjenstandsoppsett blir bare tatt i bruk før eventet starter. Beskrivelse, poeng, kategori og valgfri-flagget kan redigeres hele veien, så du kan rette en skrivefeil midt i eventet uten å åpne brettet igjen.',
        },
      ],
    },

    traps: {
      title: 'Feilene som svikter i stillhet',
      intro:
        'Hver eneste av dem importeres pent, står på brettet og ser riktig ut, og utløses aldri. De er verdt en gjennomlesning før opplastingen heller enn etter.',
      rows: [
        {
          term: 'Ferdighets- og boss-ruter er `type=standard`',
          body: 'det finnes ikke noe `type=skill`. Typen kommer fra `trackedStat` + `statType` + `statGoal` på en ellers vanlig standardrad. Å skrive `type=boss` avvises; å skrive `type=standard` og glemme stat-kolonnene gjør det ikke — da får du en manuell rute ingen noen gang godkjenner.',
        },
        {
          term: 'Skilletegnene er ulike fra kolonne til kolonne',
          body: '`items` bruker semikolon (komma er CSV-skilletegnet). `targetNpcs` bruker loddrett strek. På en combat task-rad er loddrett strek det **eneste** alternativet, fordi ekte oppgavenavn inneholder komma — `Nylocas, On the Rocks` er én oppgave.',
        },
        {
          term: 'Raid-navn matches ordrett',
          body: 'en deathless- eller tidsrute bærer modusen nøyaktig slik den staves i spillet: `Chambers of Xeric: Challenge Mode`, `Theatre of Blood: Hard Mode`, `Tombs of Amascut: Expert Mode`. En stavemåte som er nesten riktig, er en rute som aldri blir ferdig. Entry Mode-runder krediterer aldri en vanlig raid-rute; vanskeligere moduser gjør det.',
        },
        {
          term: 'Gjenstandsnavn må være nøyaktige',
          body: 'stavemåten fra spillet, ellers feiler importen og lister opp det den ikke kunne slå opp. Er et navn tvetydig, lås det som `Name#id` og slutt å gjette.',
        },
        {
          term: '`timeThresholdSeconds` betyr fire ting',
          body: 'et tidstak på en tidsrute, en plasseringsgrense på en LMS-rute (1 = seier), en nøyaktig lagstørrelse på en deathless-rute, og en nøyaktig raid-lagstørrelse på en drop-rute. Samme kolonne, fire betydninger — sjekk at du fyller ut den typen din faktisk leser.',
        },
        {
          term: 'Et krevd antall på feil type',
          body: 'det hører hjemme på drop-, kill-, gain-, lap-, PvP-, deathless- og LMS-rader. På en stat- eller tidsrad gjør det ingenting, og på en drop-rad gjør det et gjenstandssett om til en “hvilke som helst N”-pulje.',
        },
      ],
      note: {
        tag: 'Test én før du skriver to hundre',
        body: 'Lag én enkelt rute av typen du er usikker på, avslør den på et testevent, og gå og gjør tingen. Fem minutter der slår å oppdage på klanens bingokveld at en hel kategori var død.',
      },
    },

    points: {
      title: 'Poeng, nivåer og om det er rettferdig',
      body: [
        'På et poengbasert brett har hver rute sin egen verdi, og de verdiene oversettes til navngitte vanskelighetsbånd — easy til elite — som du kan redigere under **Advanced settings** hvis klanen din graderer annerledes. Båndet er det spillerne leser; tallet er det som teller.',
        'Merk en rute **optional**, så slutter den å telle mot brettets total, og slik legger du til strekkmål uten å gjøre en blackout umulig.',
        'Når brettet er fullt, kjør **balansekontrollen** fra Tiles-fanen. Den sjekker strukturen og arbeidsfordelingen og forteller deg hvor brettet skjever seg — en kategori ingen kan fullføre, et bånd som er mye mer verdt per time enn naboene — før spillerne finner de tingene for deg og styrer utenom dem.',
      ],
    },

    reveal: {
      title: 'Ingen ser det før du sier fra',
      body: [
        'Nye brett starter skjult. Staben ser dem alltid; spillerne ser ingenting i det hele tatt før du avslører — så et brett kan bygges i åpenhet, over flere dager, i en kanal medlemmene dine kan lese, uten at noe blir spolert.',
        'Den hovedbryteren er gulvet under alt annet. På et brett med en avsløringspolitikk — planlagt, intervall, dusør eller roterende — begynner motoren først å snu enkeltruter når selve brettet er avslørt, så å gjøre et brett skarpt er alltid en bevisst handling. Hvilken politikk du skal velge, har sin egen side: [Formater, og hvordan ruter åpnes]({formatsGuide}).',
        'Oppdrag er unntaket som er verdt å kjenne til: ruter skrevet på forhånd, men holdt tilbake, kunngjort midt i eventet fra sin egen pulje mens resten av brettet blir stående synlig.',
      ],
    },

    check: {
      title: 'Før du avslører',
      intro: 'Verdt å gå gjennom én gang per brett. Det meste tar fem minutter.',
      items: [
        'hver rute har typen du mente, ikke typen som importerte pent',
        'raid-moduser, gjenstandsnavn og oppgavenavn matcher spillets stavemåte tegn for tegn',
        'de plugin-oppdagede rutene er ikke eneste vei til seier, hvis en del av klanen din spiller uten',
        'poengene er satt og balansekontrollen er fornøyd, eller du er uenig med den med vilje',
        'valgfrie ruter er merket som valgfrie',
        'du har lastet ned regnearket én gang, som en sikkerhetskopi du kan laste opp igjen',
      ],
      note: {
        tag: 'Hvem kan gjøre dette',
        body: 'Ruteredigering er den ene adminjobben med sin egen rolle. En **editor** kan lage ruter og ingenting annet, og kan avgrenses til bestemte brett — så en innleid brettbygger fra en annen klan får nøyaktig det eventet du har overlatt til dem, uten tilgang til noe annet du kjører.',
      },
    },
  },

  captain: {
    metaTitle: 'Kapteinveiledningen — Anvil',
    metaDescription:
      'Draftdagen og ukene etter: å lese puljen før klokka starter, å velge, og å styre lagets tropp, bevis og avgifter.',
    eyebrow: 'Anvil · for lagkapteiner',
    title: 'Kapteinveiledningen',
    dek: 'Du får et krigsrom, en klokke og tjuefem fremmedes påmeldingsskjemaer i hendene. Dette er hva alt sammen gjør, i den rekkefølgen du møter det — pluss de delene av å lede et lag som først begynner når draften er over.',
    facts: [
      { strong: 'Slangerekkefølge', rest: 'så sene valg jevner seg ut' },
      { strong: 'Klokka', rest: 'velger aldri for deg' },
      { strong: 'Én fane', rest: 'styrer laget ditt hele eventet' },
    ],
    footnote:
      'Alt her er det en kaptein ser. Avgifter, andre lags tropper og brettet før avsløringen hører staben til og blir værende der, så ingenting på denne siden kan få deg anklaget for å ha sett på noe du ikke skulle.',

    before: {
      title: 'Hva du får, og når',
      body: [
        'En vert utpeker deg til kaptein, noe som gjør to ting: det setter deg på laget som spiller, og det åpner lagets flater for deg. Advarer lagsiden noen gang om at du faktisk ikke står i troppen, ta imot rettelsen den tilbyr — en kaptein utenfor sitt eget lag er en tilstand som forvirrer hver eneste skjerm nedenfor.',
        'Deretter har du to steder å være. **My Team** er lagets senter, og det er der du tilbringer eventet. **Krigsrommet** er draftdagens skjerm, og det åpner så snart påmeldingen gjør det — lenge før draftkvelden.',
      ],
      note: {
        tag: 'Gå inn tidlig',
        body: 'Krigsrommet er mest verdt i dagene _før_ draften, når du rekker å lese hvert påmeldingsskjema ordentlig. På selve kvelden blir det en stoppeklokke, og du får ikke tid til å lese noe som helst.',
      },
    },

    warroom: {
      title: 'Les puljen før klokka starter',
      body: [
        'Krigsrommet viser alle som kan velges, med alt nettstedet vet om dem: hva de spiller, hvilke bosser de har ekte killcounts på, hvor mange tidligere event de møtte opp til, og svarene de ga i påmeldingsskjemaet.',
        'De svarene er **fryst slik de ble sendt inn**. Ingen redigerer «timer per uke» etter å ha sett hvem som ble valgt først, og det er hele grunnen til at de er verdt å lese.',
        'Bygg en **kandidatliste** mens du leser. Den er privat, den overlever til draftkvelden, og på kvelden er den forskjellen på å velge fra en liste du allerede stoler på, og å velge den som tilfeldigvis står øverst.',
      ],
      rows: [
        {
          term: 'Vurdering og nivå',
          body: 'et sammendrag av hva noen faktisk har gjort, utledet av kontohistorikken deres heller enn av hva de fortalte deg. Veiledende — et utgangspunkt for en samtale, ikke en dom.',
        },
        {
          term: 'Områder og markører',
          body: 'hva de beviselig gjør: raids, PvM, skilling, PvP. Nyttig for å finne hullet i troppen din i stedet for å ta det høyeste tallet fire ganger.',
        },
        {
          term: 'Oppmøte',
          body: 'hvor ofte de fullførte tidligere event de meldte seg på. Det stilleste tallet på siden, og ofte det som sier mest.',
        },
      ],
    },

    draft: {
      title: 'Draftdagen',
      body: [
        'Valgene går i **slangerekkefølge**: med fire lag går første runde A, B, C, D og andre D, C, B, A, så å velge sist i én runde betyr å velge først i den neste. Den som trakk første valg, betaler for det et minutt senere.',
        'En person er ett valg, ikke én konto. Å ta noen drar med alle kontoene de har registrert til laget ditt på én gang — du bruker aldri et valg nummer to på noens altkonto.',
      ],
      rows: [
        {
          term: 'Valgklokka',
          body: 'har verten satt en, får du så mange sekunder per tur. Når den går ut, velger den **ikke** for deg — den låser opp vertens mulighet til å velge på dine vegne, og sier det på begge skjermene. Ingenting skjer i stillhet.',
        },
        {
          term: 'En innsnevret liste',
          body: 'noen event kjører en balansemodus. Avhengig av hvilken kan det sterkeste laget bli hindret i å ta enda en toppspiller mens en rival ikke har noen, eller ha et tak for hvor langt over snittet troppen får komme. Er noen du ville hatt, gråtonet, er det derfor, og det gjelder alle.',
        },
        {
          term: 'Hvis du går glipp av den',
          body: 'si fra til verten på forhånd. De kan velge for deg fra det samme brettet, og en kandidatliste du har lagt igjen, er instruksen de følger.',
        },
      ],
      note: {
        tag: 'Draften låser troppen',
        body: 'Så snart en draft er i gang, er både lagene og valgrekkefølgen fryst. Mangler et lag, eller er rekkefølgen feil, må det ordnes før første valg, ikke etter.',
      },
    },

    roster: {
      title: 'Lagets senter, hele eventet',
      intro:
        'På **My Team** rommer kortet **Manage this team** alt du kan gjøre for din side. Det kommer sammenslått; åpne det én gang, så blir det stående der du la det.',
      rows: [
        {
          term: 'Roster',
          body: 'hvem som er på laget og hva de har bidratt med. Det første stedet å se når noen spør hvorfor dropet deres ikke telte — en konto uten kobling dukker opp her.',
        },
        {
          term: 'Requests',
          body: 'folk som ber om å bli med, på event der spillerne velger lag selv. Vises bare når det er noen.',
        },
        {
          term: 'Proof',
          body: 'lagets innsendinger og skjermbildene deres. Du er ikke den som godkjenner til slutt — det er staben — men du ser hva som er sendt, og kan purre på det som ikke er det.',
        },
        {
          term: 'Fees',
          body: 'hvem på laget ditt som fortsatt skylder påmeldingsavgift. Du kan markere en som betalt; å bekrefte den er stabens jobb, med vilje.',
        },
        {
          term: 'Invite links',
          body: 'dukker opp når verten har tillatt kapteiner å lage sine egne. Én lenke setter den som åpner den, rett på laget ditt. Se [Å være vert for en gjesteklan]({clanVsClanGuide}) for hva lenken faktisk gjør.',
        },
      ],
    },

    during: {
      title: 'Å kjøre det når det først har startet',
      body: [
        'Det meste av eventet kjører seg selv: pluginet krediterer det det ser, og arkiverer et stemplet skjermbilde for det. Igjen står mennesker, og det er jobben.',
        'Det som virkelig trenger en kaptein: å sørge for at alle på din side har pluginet tilkoblet og kontoene sine koblet før startskuddet, for en altkonto uten kobling bidrar til ingenting; å legge merke til hvilke ruter ingen har rørt ved halvspilt tid; og å få de manuelle rutene fotografert før den siste timen, når alle prøver samtidig.',
        'Krever eventet et startbilde, er det den ene tingen hver spiller må gjøre selv i de første timene. Purr tidlig — en spiller uten får hver kreditering flagget, eller avvist rett ut, alt etter hvordan verten har satt det opp.',
      ],
      note: {
        tag: 'Innbytter',
        body: 'Når et event først er i gang, er det bare admins som kan bytte ut noen, med vilje: bidrag er allerede knyttet til personer. Spør en vert i stedet for å manøvrere rundt det.',
      },
    },
  },

  formats: {
    metaTitle: 'Formater, og hvordan ruter åpnes — Anvil',
    metaDescription:
      'De sju eventformatene, de fem måtene ruter kan åpnes på, og poengmodifikatorene — hva hver av dem gjør med hvordan et event føles å spille.',
    eyebrow: 'Anvil · for klanens stab',
    title: 'Formater, og hvordan ruter åpnes',
    dek: 'To avgjørelser former et event mer enn alle rutene i det: hvilken form brettet har, og hvordan ruter blir spillbare. De er uavhengige — hvilket som helst format kan bruke hvilken som helst avsløringspolitikk — og sammen er de forskjellen på en ukes slit og et kveldsløp.',
    facts: [
      { strong: '7 formater', rest: 'brettets form' },
      { strong: '5 politikker', rest: 'hvordan ruter åpnes' },
      { strong: '3 modifikatorer', rest: 'hva en fullføring er verdt' },
    ],
    footnote:
      'Formatet settes ved opprettelsen, men kan endres etterpå fra eventets Overview-fane; avsløringspolitikken og poengmodifikatorene kan endres når som helst før rutene de påvirker, blir avslørt.',

    shape: {
      title: 'Brettets form',
      intro:
        'Formatet avgjør hvordan brettet gir poeng og hva opprettelsesskjemaet spør deg om videre. Alt annet på denne siden bygger oppå det.',
      note: {
        tag: 'Fast rutenett eller oppgaveliste',
        body: 'Et **klassisk** brett er et ekte kvadrat, så “N på 5” betyr nøyaktig 25 ruter, og antallet kan aldri endres. Alt annet er en oppgaveliste av vilkårlig lengde, som også er den eneste typen brett en regnearkimport kan få til å vokse. Skal du generere hundre oppgaver, tas den avgjørelsen her.',
      },
    },

    reveal: {
      title: 'Hvordan ruter åpnes',
      intro:
        'Uavhengig av formatet. Eventets avsløringsbryter er fortsatt hovedporten — så lenge et brett er skjult, er ingenting synlig og ingen av disse motorene går, så du gjør alltid et brett skarpt bevisst.',
      rows: [
        {
          term: 'Alle på én gang',
          body: 'klassikeren. Hver rute er spillbar i det øyeblikket du avslører brettet, og lagene velger rekkefølge selv. Velg dette med mindre du har grunn til å la være.',
        },
        {
          term: 'Planlagt',
          body: 'hver rute har sitt eget avsløringstidspunkt, satt i Tiles-fanen, og går live når tiden passerer. Et “timens rute”-brett: det setter tempoet for deg og krever at tidene skrives inn på forhånd.',
        },
        {
          term: 'Intervall',
          body: 'motoren trekker skjulte ruter med faste mellomrom — en pulje hvert N. minutt, tilfeldig eller i brettrekkefølge. En bingoutroper. Ingen ekstra redigering utover rutene selv, og brettet avslører seg mens du sover.',
        },
        {
          term: 'Dusør',
          body: 'nøyaktig én rute er åpen av gangen, og første lag som fullfører den, tar den — ruta lukkes og den neste trekkes med én gang. Nådeløst, veldig severdig, og ubarmhjertig mot tidssoner.',
        },
        {
          term: 'Roterende',
          body: 'et rullerende vindu med noen få åpne ruter: hver trekning åpner nye og lar de eldste utløpe. I motsetning til dusør rekker alle å fullføre en åpen rute før den forsvinner. Bygget for individuelle stiger.',
        },
      ],
      note: {
        tag: 'Tidssonespørsmålet',
        body: 'Dusør- og intervallbrett belønner den som tilfeldigvis er våken. I en klan spredt over verden er det en reell fordel delt ut av klokka heller enn av spill. Roterende vinduer demper det — en åpen rute står åpen så lenge vinduet varer, så en sovende spiller får likevel en sjanse.',
      },
    },

    scoring: {
      title: 'Hva en fullføring er verdt',
      intro:
        'Tre modifikatorer, alle bare i poengmodus, alle fryst inn i fullføringen i det øyeblikket den skjer — så en endring du gjør senere, skriver aldri om historien.',
      rows: [
        {
          term: 'Bonus til første lag',
          body: 'ekstrapoeng til det første laget som fullfører hver rute. Den billigste måten å få et brett der alt er synlig, til å føles som et kappløp uten å endre noe annet.',
        },
        {
          term: 'Verdifall',
          body: 'en rutes verdi skaleres lineært fra full ved avsløringen til en målprosent etter N timer, og holder seg så. Under 100 % faller den og belønner fart; over 100 % **vokser** den, noe som belønner å rydde de gamle oppgavene alle hoppet over. Den voksende retningen er den folk glemmer finnes.',
        },
        {
          term: 'Lockout',
          body: 'den første fullføringen lukker ruta for alle andre. Underforstått ved dusør. På et brett med stor forskjell i lagstyrke kan det avgjøre konkurransen tidlig — den er best når lagene står nær hverandre.',
        },
      ],
    },

    missions: {
      title: 'Oppdrag: overraskelser midt i eventet',
      body: [
        'Oppdrag er ruter skrevet på forhånd og holdt tilbake — kunngjort fra sin egen pulje mens resten av brettet blir stående synlig. De er uavhengige av avsløringspolitikken, så selv en helt vanlig bingo der alt er synlig, kan ha dem.',
        'Slipp dem for hånd når brettet blir stille, med faste mellomrom, eller etter en plan per oppdrag. Hvert oppdrag har sin egen poengsetting: sin egen lockout, bonus, verdifall og utløp, satt per rute i stedet for for eventet.',
        'De er den billigste måten å vekke et brett på dag fem — og dag fem er dagen ethvert langt event trenger å bli vekket.',
      ],
    },

    choose: {
      title: 'Å velge, på én side',
      intro: 'Vet du hvilken følelse du er ute etter, er dette korteste vei dit.',
      rows: [
        { term: 'En vanlig klanbingo', body: 'Klassisk rutenett, alle ruter synlige. Legg til en bonus til første lag hvis du vil ha litt hastverk.' },
        { term: 'Hundrevis av oppgaver, scoret etter vanskelighet', body: 'Leagues, alt synlig. Det er også den eneste formen en stor regnearkimport kan vokse inn i.' },
        { term: 'En uke som bygger mot noe', body: 'Leagues med planlagt eller intervallavsløring, så brettet åpner seg utover uka i stedet for på én gang.' },
        { term: 'En kveld folk følger live', body: 'Dusør. Én rute, første lag tar den, neste rute med én gang.' },
        { term: 'En individuell konkurranse, ikke en lagkonkurranse', body: 'Stige med roterende vindu og verdifall. Oppgaver kommer og går, og ingen kan spare dem.' },
        { term: 'Et løp med en målstrek', body: 'Ruteløp — en ordnet bane, og den som kommer lengst, vinner.' },
      ],
      outro:
        'Uansett hva du velger, er selve rutene den samme jobben: se [Bygg et brett som sporer seg selv]({boardGuide}).',
    },
  },

  fees: {
    metaTitle: 'Avgifter og utbetalinger — Anvils kassererveiledning',
    metaDescription:
      'Å ta en påmeldingsavgift, samle den inn, den andre signaturen som avslutter den, og å gjøre premiepotten om til utbetalte plasseringer.',
    eyebrow: 'Anvil · for kasserere',
    title: 'Avgifter og utbetalinger',
    dek: 'Penger er der klanevent går galt, og de går galt i stillhet: en avgift noen sverger på at de har betalt, en pott ingen får til å gå opp, en premiefordeling som diskuteres etter at vinnerne har logget av. Dette er veien som legger igjen et spor ved hvert skritt.',
    facts: [
      { strong: '2 signaturer', rest: 'avslutter en avgift som standard' },
      { strong: 'Pott = tillagt', rest: '+ avgift × godkjente påmeldinger' },
      { strong: '1 rad', rest: 'per person som får betalt' },
    ],
    footnote:
      'Avgifter og utbetalinger er kassererens flate. En kasserer kan alt en moderator kan, pluss dette; en moderator kan markere en avgift som innkrevd, men aldri avslutte en.',

    set: {
      title: 'Å sette avgiften',
      body: [
        'Påmeldingsavgiften ligger på eventet, satt når du oppretter det eller redigert fra dets **Sign-ups**-fane. Ingen avgift i det hele tatt er et helt greit svar — massevis av event kjører på en pott verten har lagt inn selv.',
        'To innstillinger avgjør hva avgiften faktisk betyr, og de er lette å overse:',
      ],
      rows: [
        {
          term: 'Per person eller per konto',
          body: 'på et event der folk får stille med flere kontoer, avgjør den om de betaler én gang eller én gang hver. Blir den feil, kommer du til å betale penger tilbake.',
        },
        {
          term: 'Betalingsfrist',
          body: 'når den har passert, slutter ubetalte påmeldinger å være noe du løper etter og blir en avgjørelse. Sett den tidligere enn du tror — dagen før eventet er for sent til å finne en erstatter.',
        },
      ],
      note: {
        tag: 'Potten følger påmeldingene',
        body: 'Den viste premiepotten er det du selv har lagt inn, pluss påmeldingsavgiften ganger antallet **godkjente** påmeldinger. Den beveger seg etter hvert som påmeldinger godkjennes og utelukkes, så tallet på siden er alltid det du faktisk kan betale ut.',
      },
    },

    collect: {
      title: 'Å samle inn',
      body: [
        'Avgifter samles inn på den måten klanen din allerede samler inn penger — i spillet, på Discord, slik dere nå gjør. Anvils jobb begynner i det øyeblikket pengene lander: noen med stabstilgang markerer den **betalt**, og det stempler hvem som sier de tok imot, og når.',
        'Spillerne har også et ord med i laget. Et medlem kan melde fra om hvem de betalte til og legge ved et skjermbilde, og det er det som gjør «jeg har definitivt betalt» til en oppføring med to ender. Når spillerens melding og innkreverens påstand navngir ulike personer, er det en uenighet nettstedet kan vise deg, i stedet for en du oppdager midt i en krangel.',
      ],
      note: {
        tag: 'Beviset slettes med vilje',
        body: 'Et betalingsskjermbilde lagres bare til avgiften er avsluttet, og fjernes så. Det finnes for å løse en uenighet, ikke for å ligge i et arkiv i et år.',
      },
    },

    sign: {
      title: 'Den andre signaturen',
      body: [
        'En avgift står som **innkrevd** til et _annet_ stabsmedlem bekrefter at den kom fram. Den som håndterte pengene, kan ikke også være den som skriver under på at de dukket opp — det er hele kontrollen, og derfor avviser nettstedet en innkrevers egen bekreftelse i stedet for bare å fraråde den.',
        'Hvor mange signaturer en avgift krever, er en klaninnstilling, fra null til fem. Null finnes av en reell grunn: i en klan der kassereren _er_ eieren, finnes det ingen andre til å skrive under, og «34 avgifter venter på en andre signatur» blir en kø som aldri kan tømmes, og permanent det høyeste på dashbordet. Ved null **er** det å markere en avgift betalt selve underskriften.',
        'Sett den til én — standarden — hvis dere er to. Sett den til null hvis dere ærlig talt ikke er det, og sett den høyere bare hvis klanen din har både folkene og grunnen.',
      ],
    },

    pay: {
      title: 'Å betale ut',
      body: [
        'Når eventet er over, gjør eventets **Payouts**-fane potten om til en liste over mennesker. Generer den, så får du én rad per mottaker, ikke per lag: et vinnende lags premie deles likt mellom medlemmene, slik at utbetalingen blir en liste med navn og tall heller enn et regnestykke ved midnatt.',
        'Beløpene starter fra en foreslått fordeling — tyngst i toppen, og jo flere betalte plasseringer du setter, jo flatere blir den — og hver rad kan redigeres. Forslaget er et utgangspunkt, ikke en policy.',
        'Så betaler du dem og huker av rader underveis. Poenget er at noen en uke senere kan se på lista og se hvem som fikk hva, i stedet for å rekonstruere det fra Discord-historikken.',
      ],
      note: {
        tag: 'Kunngjør det én gang, herfra',
        body: 'Utbetalinger postes til Discord-kanalene deres fra selve eventet, så kunngjøringen og oppføringen er det samme. En premie som kunngjøres for hånd, er en premie noen senere påstår aldri kom.',
      },
    },

    disputes: {
      title: 'Når tallene er uenige',
      intro: 'De fire du faktisk kommer til å møte:',
      rows: [
        {
          term: 'De sier de har betalt, ingen markerte det',
          body: 'be dem melde fra om betalingen med et skjermbilde. Det setter en navngitt innkrever og et tidsstempel på oppføringen, og den navngitte personen kan bekrefte eller avvise.',
        },
        {
          term: 'To i staben tror begge at de tok imot',
          body: 'spillerens egen melding er avgjørelsen — den navngir hvem de rakte pengene til. Rett innkreveren, og avslutt så avgiften.',
        },
        {
          term: 'En avgift har låst seg i påvente av en signatur',
          body: 'enten venter den virkelig på en annen, eller så har klanen din færre i staben enn innstillingen for påkrevde bekreftelser går ut fra. Senk innstillingen i stedet for å bekrefte din egen innkreving.',
        },
        {
          term: 'Potten endret seg etter at du fortalte det til folk',
          body: 'den følger godkjente påmeldinger, så å godkjenne eller utelukke en påmelding flytter den. Oppgi potten slik den er når påmeldingen stenger, ikke når den åpner.',
        },
      ],
    },
  },

  moderator: {
    metaTitle: 'På vakt — Anvils moderatorveiledning',
    metaDescription:
      'En moderators dag på et Anvil-klannettsted: køen, gjennomgang av innsendinger og kontoer, å holde medlemslista ærlig, og vurderingene.',
    eyebrow: 'Anvil · for moderatorer',
    title: 'På vakt',
    dek: 'En moderator tar det arbeidet som kommer uansett om et event pågår eller ikke: bevis som skal ses på, kontoer som skal verifiseres, en medlemsliste som driver. Dette er hva køen består av, og hvordan du tømmer den uten selv å bli grunnen til at folk venter.',
    facts: [
      { strong: 'Ingen event', rest: 'en moderator kan verken opprette eller redigere dem' },
      { strong: 'Én side', rest: 'sier hva som venter på deg' },
      { strong: 'Godkjenn raskt', rest: 'en treg kø føles som et ødelagt nettsted' },
    ],
    footnote:
      'En moderator ser alt et medlem ser, pluss gjennomgangsflatene. Å opprette og redigere event, innstillinger, stab og utbetalinger er admin- og kassererjobber — mangler en knapp, er det derfor, og det er med vilje.',

    what: {
      title: 'Hva rollen er',
      intro:
        'Rollene stabler nedover: alt en moderator kan, kan en kasserer og en admin også. Det en moderator spesifikt eier:',
      canList: [
        'medlemslista: å synkronisere den, legge til folk, forfremme en gjest',
        'kontoverifiseringer — XP-utfordringen og manuell gjennomgang',
        'innsendinger og bevisskjermbilder',
        'ukeskonkurranser og timeplanen',
        'tilbakemeldinger fra medlemmene',
      ],
      cantIntro: 'Hva de ikke kan, med vilje:',
      cantList: [
        'opprette eller redigere et event, eller rutene i det',
        'endre klaninnstillinger eller Discord-oppsett',
        'forfremme noen, eller røre staben',
        'avslutte en avgift eller kjøre en utbetaling',
      ],
    },

    queue: {
      title: 'Start med det som venter på deg',
      body: [
        'Admin-dashbordet er ingen oppsummering av nettstedet — det er en liste over hva som venter, sortert etter hvor mye det betyr, regnet ut fra ekte data heller enn fra tellere som driver. Sier det at ingenting venter på deg, gjør det ikke det.',
        'Jobb ovenfra og ned. Postene som når toppen, er de med et menneske i den andre enden: noen som ikke kan melde seg på fordi kontoen ikke er verifisert, eller som ikke har fått dropet sitt talt fordi ingen har sett på det ennå.',
      ],
    },

    submissions: {
      title: 'Innsendinger og bevis',
      body: [
        'De fleste krediteringer når deg aldri: pluginet ser dropet, arkiverer et skjermbilde stemplet med lag og et UTC-tidsstempel, og ruta blir ferdig. Det som havner i køen, er de manuelle rutene og alt pluginet har flagget.',
        'Stempelet er det som gjør et bevis vanskelig å krangle om. Et pluginskjermbilde bærer laget og øyeblikket bakt inn i bildet, og med tobildesbevis slått på viser bilde nummer to et par sekunder senere at lootet har lagt seg på bakken. Et skjermbilde uten noe av det er et skjermbilde fra en telefon, noe som er helt greit — det betyr bare at det er du som sjekker.',
      ],
      rows: [
        {
          term: 'Godkjenn når det er sannsynlig',
          body: 'du reviderer ingen bank. Viser bildet tingen, står kontoen på medlemslista, og ligger tidsstempelet innenfor eventet, godkjenn og gå videre.',
        },
        {
          term: 'Avslå med en begrunnelse',
          body: 'et avslag uten forklaring kommer tilbake som en DM til deg innen en time. Si hva som manglet, så forsøk nummer to blir riktig.',
        },
        {
          term: 'En flagget innsending er et spørsmål, ikke en anklage',
          body: 'pluginet flagger det det ikke kunne bekrefte helt — som oftest en spiller som ikke har levert et startbilde. Les det som «se på denne», ikke som «noen har jukset».',
        },
      ],
    },

    verify: {
      title: 'Å verifisere kontoer',
      intro:
        'Ingen kan melde seg på et event uten minst én verifisert konto, så denne køen hindrer folk direkte i å spille. Det er den som er verdt å tømme daglig.',
      rows: [
        {
          term: 'Verifisert via pluginet',
          body: 'det vanlige tilfellet, og det krever ingenting av deg. Å spille kontoen med pluginet tilkoblet kobler den automatisk, og et stabilt kontofingeravtrykk gjør at koblingen overlever et navnebytte.',
        },
        {
          term: 'Verify by XP',
          body: 'for spillere uten pluginet. Nettstedet velger en tilfeldig ferdighet, og de skal tjene 1 000 XP i den innen tretti minutter. Den sjekker seg selv — du ser bare de som feiler.',
        },
        {
          term: 'Manuell gjennomgang',
          body: 'skjulte Hiscores, eller en altkonto som er for ny til å stå der. Noen sender inn et RSN med en kommentar, og du avgjør. Be om et skjermbilde av innloggingsskjermen hvis kommentaren ikke holder.',
        },
      ],
      note: {
        tag: 'Verifisert er ikke det samme som medlem',
        body: 'Å verifisere en konto sier «denne er virkelig deres». Det gjør dem ikke til en del av klanen — klanmedlemskap kommer bare fra en synkronisering av medlemslista i spillet eller fra en admin som legger dem til for hånd. Noen som er verifisert, men ikke står på lista, er en **gjest**: sporet, synlig og ikke medlem. Det er med vilje, og det er det som hindrer noen i å bli med i klanen din ved å skrive et navn.',
      },
    },

    roster: {
      title: 'Å holde medlemslista ærlig',
      body: [
        'Medlemslista kommer fra ett sted: en admin kjører en synkronisering fra klanlista i spillet, med **Anvil**-knappen i tittellinjen på klanvinduet (eller **Sync roster** i pluginnets sidepanel). Alt annet — verifiseringer, koblinger, påmeldinger — henger på den.',
        'Vedlikeholdsjobben er altså liten, men reell: kjør synkroniseringen etter hver rekrutteringsrunde, forfremm de gjestene som faktisk har blitt med, og se på de folkene nettstedet har flagget som noe å se nærmere på, i stedet for å vente på at de klager.',
      ],
      note: {
        tag: 'Sist sett er ikke sist spilt',
        body: 'Et medlems tidsstempel for «sist sett i klanen» viser den siste synkroniseringen som fant dem, ikke siste gang de logget inn. For «spiller de fortsatt», les tidspunktet for livestatistikken deres i stedet — det er det som beveger seg av seg selv.',
      },
    },

    startshot: {
      title: 'Å gå gjennom startbilder',
      body: [
        'På et event som krever et, må hver spiller levere et skjermbilde tatt etter at eventet har startet, på et sted som trekkes i selve startøyeblikket. Pluginbilder med verifisert passord kommer inn allerede godkjent, så i praksis ser du bare på spillerne som har lastet opp for hånd fra en telefon.',
        'Det du sjekker, er lite: at figuren er med på bildet, at passordet står i chatteboksen, og at det er passordet akkurat den spilleren faktisk fikk. Opplastingene teller med én gang, og du går gjennom dem i etterkant, så ingen hindres i å spille mens de venter på deg.',
      ],
    },

    judgement: {
      title: 'Vurderingene du kommer til å måtte gjøre',
      intro:
        'Ingen av dem har et riktig svar i programvare, og det er derfor de havner hos et menneske.',
      rows: [
        {
          term: 'Beviset er ekte, men sent',
          body: 'dropet skjedde inne i eventet, og skjermbildet kom etter at det var over. Godkjenn som regel — se på stempelet i bildet, ikke på opplastingstidspunktet.',
        },
        {
          term: 'Kontoen er ikke koblet ennå',
          body: 'dropet er ekte, kontoen er deres, den ble bare ikke lagt til før de spilte. Få den koblet, og godkjenn så. Ikke få noen til å gjøre et raid om igjen på grunn av papirarbeid.',
        },
        {
          term: 'Det ser iscenesatt ut',
          body: 'ta det til en admin i stedet for å avslå det selv. Et avslag er en offentlig anklage inne i en liten klan, og det bør aldri være én persons avgjørelse tatt i farten.',
        },
        {
          term: 'Du er selv med i eventet',
          body: 'det er du nesten helt sikkert. Gi alt som gjelder ditt eget lag, videre til en annen moderator — ikke fordi du ville vært urettferdig, men fordi du ikke skal måtte bevise at du ikke var det.',
        },
      ],
    },
  },
};

export default no;
