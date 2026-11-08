import type { PartialGuideDict } from './en';

// Norsk (bokmål) — Norwegian.
//
// Samme konvensjon som i alle de andre språkfilene her: alt leseren FAKTISK SER på skjermen i Anvil,
// RuneLite og OBS blir stående på engelsk — menyer i RuneLite og OBS, pluginets egne chattelinjer, og
// Anvils egne adminetiketter, som er engelske til den flaten også blir oversatt. En oversatt "Tracked
// drop detected" er en linje ingen finner igjen.
// Discords egne UI-etiketter (menyer, innstillinger, navn på tillatelser: "Kopier server-ID",
// "Serverinnstillinger → Roller", "Administrer webhooks") følger Discords egen norske oversettelse — det
// leserens Discord-klient viser — og ville blitt stående på engelsk der Discord ikke er oversatt.
// Alt annet — forklaringen, rekkefølgen, hvorfor — er norsk.

const no: PartialGuideDict = {
  common: {
    contents: 'Innhold',
    step: 'Trinn',
    optional: 'valgfritt',
    minRead: '{n} min lesing',
    copyLink: 'Kopier en lenke til denne delen',
    linkCopied: 'Lenke kopiert',
    language: 'Språk',
    partialNotice:
      'Denne veiledningen er bare delvis oversatt til {language}. Det som ennå ikke er oversatt, vises på engelsk.',
    backToGuides: 'Alle veiledninger',
    unreviewedNotice:
      'Denne oversettelsen til {language} er ennå ikke lest gjennom av noen som har språket som morsmål. Hvis en setning leses feil, er [den engelske siden]({englishHref}) originalen — og [å si fra](/feedback) er det som får den rettet.',
    support: {
      lead: 'Står du fast, eller ser noe feil ut?',
      link: 'Spør i Anvils support-Discord',
    },
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
      streamers: 'Streamers',
    },
    anvilTab: 'Bruke Anvil',
    ingame: {
      title: 'Guider for spillet',
      dek: 'Raids, bosser, skilling og pengetjening fra Anvil-biblioteket — de samme guidene som pluginen viser i spillet og boten poster i Discord.',
      browse: 'Se alle guider',
      language: 'Disse guidene er ikke oversatt: de vises slik de er skrevet, uansett hvilket språk denne siden er på.',
      empty: 'Anvil-biblioteket har ingen publiserte guider ennå. Kom tilbake snart.',
      placeholder: 'Søk i guider for spillet — prøv "zulrah", "raids" eller "money"',
      readTime: '{n} min lesing',
      metaTitle: 'OSRS-guider for spillet — Anvil',
      metaDescription: 'Guider for raids, bossing, skilling og pengetjening fra Anvil-biblioteket — til å lese på siden, i spillet via RuneLite-pluginen og i Discord.',
    },
    search: {
      placeholder: 'Søk i veiledningene — prøv "webhook", "ruter" eller "drops vises ikke"',
      results: '{n} veiledninger',
      empty: 'Ingenting traff. Prøv et enklere ord — "ruter", "utbetaling", "bot" — eller bla i listen under.',
      clear: 'Tøm søket',
    },
    cards: {
      tiles: {
        eyebrow: 'For spillere',
        title: 'Ruteregler og begrensninger',
        blurb: 'Hva en rute krever av deg før du starter (en spillinnstilling, pluginet, en synkronisert logg, en hiscores-plassering) og hva den ikke kan spore.',
        minutes: '~4 min',
      },
      discord: {
        eyebrow: 'For den som styrer serveren',
        title: 'Anvil i Discord',
        blurb: 'Én invitasjon, så kanalene hver feed poster i, roller, slash-kommandoer, og hva du sjekker når det stopper.',
        minutes: '~5 min',
      },
      switching: {
        eyebrow: 'Bytt til Anvil',
        title: 'Bytt fra Dink eller Wise Old Man',
        blurb:
          'Anvil poster dropene dine på Discord og kjører ukentlige konkurranser. Fem steg for staben, to for spillerne.',
        minutes: '~3 min',
      },
      clan: {
        eyebrow: 'For deg som starter en',
        title: 'Start en klan',
        blurb: 'To navn og en adresse, så er den live. Deretter Discord, medlemslista og det første brettet.',
        minutes: '~4 min, gratis',
      },
      plugin: {
        eyebrow: 'For spillere',
        title: 'Oppsett av RuneLite-pluginet',
        blurb:
          'Installer pluginet, logg inn fra sidepanelet, og la det sende inn dropsene dine. Dekker også Discord-varsler og spilleroppslag.',
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
      coffer: {
        eyebrow: 'For kasserere',
        title: 'Klankassa',
        blurb:
          'Én kasse for klanens gp: hva som kommer inn, de tre måtene den betaler ut premier på, og hvem som får røre den.',
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
      commands: {
        eyebrow: 'For alle medlemmer',
        title: 'Slash-kommandoer',
        blurb:
          'Hver kommando boten svarer på i Discord, hva hvert alternativ gjør, gjennomgåtte eksempler, og hva du sjekker når en ikke dukker opp.',
        minutes: '~6 min',
      },
      creators: {
        eyebrow: 'For streamere',
        title: 'Hold events for seerne dine',
        blurb:
          'Ingen klan nødvendig. Lag et rom, del én lenke, velg hvem som får være med (følgere, subs, Discord-roller) og vis brettet på stream.',
        minutes: '~6 min',
      },
      joiningStream: {
        eyebrow: 'For seere',
        title: 'Slik blir du med i eventet til en streamer',
        blurb:
          'Fikk du en lenke fra en stream? Logg inn, legg til karakteren din, trykk Join. Hva du gjør for events kun for følgere eller subs.',
        minutes: '~2 min',
      },
      streamingClans: {
        eyebrow: 'For klaner som streamer',
        title: 'Streaming for klaner',
        blurb:
          'La seerne dine spille ett event uten å være med i klanen. Slå på Streaming, og åpne så et event for seere.',
        minutes: '~2 min',
      },
      people: {
        eyebrow: 'For klanens stab',
        title: 'Folkene dine: medlemsliste, gjester og hvem som kan bli med',
        blurb:
          'Hvor medlemmene kommer fra, hva filtrene på Roster-fanen betyr, forespørsler om å bli med og Needs review, de tre innstillingene under Who can join, og hvordan du fjerner eller utestenger noen.',
        minutes: '~6 min',
      },
      staffRoles: {
        eyebrow: 'For eiere og admins',
        title: 'Stabsroller: hvem kan gjøre hva',
        blurb:
          'Eier, admin, kasserer og moderator: hva hver rolle når, hvordan du gjør noen til moderator, hvem som kan gi hvilken rolle, og oppgaver som bare gjelder ett event.',
        minutes: '~6 min',
      },
      supporter: {
        eyebrow: 'For spillere',
        title: 'Anvil Supporter: nivåer og fordeler',
        blurb:
          'Supporter, Champion og Patron: navnefarger, stjernen, profilbilder, monteren, venneeventer og klanboosts, hvordan betalingen fungerer og hva som skjer hvis du slutter.',
        minutes: '~6 min',
      },
      sidePanel: {
        eyebrow: 'For spillere',
        title: 'Sidepanelet, fane for fane',
        blurb:
          'Clan, Feed, You, Lookup og tannhjulet: hva hver fane viser, eventchat, GZ- og Sad-reaksjoner, og innstillingene som tar feeden og Supporter-fargene inn i spillet ditt.',
        minutes: '~6 min',
      },
      clanBoosts: {
        eyebrow: 'For Supporters og klanens stab',
        title: 'Å booste en klan',
        blurb:
          'Å plassere og flytte en boost, de tre nivåene og hva hvert av dem låser opp, klanens navnefarger, boosts i gave, og boostermerker og badges.',
        minutes: '~5 min',
      },
    },
  },

  switching: {
    metaTitle: 'Bytt fra Dink eller Wise Old Man — Anvil',
    metaDescription:
      'Flytt klanen din fra Dink og Wise Old Man til Anvil: sett opp Discord-kanalene, synkroniser klanlisten, start Skill eller Boss of the Week og si fra til medlemmene.',
    eyebrow: 'Bytt til Anvil',
    title: 'Bytt fra Dink eller Wise Old Man',
    dek: 'Anvil gjør begge jobbene. Den poster klanens drops og bragder på Discord. Den holder også klanlisten oppdatert og kjører ukentlige konkurranser.',

    staff: {
      title: 'Hvis du driver klanen',
      body: [
        '**La boten sette opp kanalene dine.** Gå til Admin → Discord → **Set it up for me**. Velg én kanal eller flere. Hvis Dink postet et sted, huk av for _Use the same channels_. Ingenting endrer seg for medlemmene dine.',
        '**Synkroniser klanlisten.** Åpne innstillingene til Anvil-pluginen i RuneLite. Slå på **Keep the clan roster in sync**. Én admin gjør dette én gang, i spillet. Det erstatter Wise Old Man-gruppen din.',
        '**Start en Skill eller Boss of the Week.** Gå til Admin → All events → **+ New event**, og velg Skill of the Week eller Boss of the Week. Alle på klanlisten er med automatisk. Det erstatter Wise Old Man-konkurranser.',
        '**Si fra til medlemmene.** Gå til Admin → Discord → **Tell your members** → **Post it**. Boten poster spillertrinnene for deg.',
        '**En uke senere: rydd opp.** Gå til Admin → Discord → **Remove Dink’s old webhooks**, huk av for dem som skal bort, trykk på **Remove … webhooks** og deretter **Yes, remove them**. Etter det kan ingenting postes to ganger. Trykk **Keep** på dem du vil la være i fred.',
      ],
    },

    player: {
      title: 'Hvis du er spiller',
      body: [
        '**Installer Anvil.** Åpne Plugin Hub i RuneLite, søk etter Anvil og trykk på **Install**. Logg deretter inn med Discord fra Anvil-sidepanelet.',
        '**Slå av Dinks varsler.** Eller avinstaller Dink, hvis du ikke bruker det til noe annet.',
        '**Det var alt.** Du trenger ikke gjøre noe for Wise Old Man.',
      ],
    },

    questions: {
      title: 'Spørsmål',
      intro: 'De klanene spør mest om:',
      rows: [
        {
          term: 'Kan vi beholde Dink til noen ting?',
          body: 'Ja. Anvil poster ikke kill counts, slayer-oppdrag eller speedruns. La bare de stå på i Dink.',
        },
        {
          term: 'Trenger vi fortsatt Wise Old Man?',
          body: 'Bare til rekorder gjennom tidene og EHP / EHB-rangeringer.',
        },
        {
          term: 'Må spillerne lime inn en webhook noe sted?',
          body: 'Nei. Klanen velger kanalene på nettstedet.',
        },
        {
          term: 'Vil du ha innlegg på din egen server også?',
          body: 'Gå til profilen din → **Announcements & webhooks** → _Your own webhooks_.',
        },
      ],
    },
  },

  clan: {
    metaTitle: 'Start en klan — Anvil',
    metaDescription: 'Opprett en klan på Anvil: gi den navn, velg adresse, koble til Discord, synkroniser medlemslista og kjør ditt første arrangement.',
    eyebrow: 'Anvil · kom i gang',
    title: 'Start en klan',
    dek: 'To navn og en adresse, så er klanen din live — gratis, og det er ingenting å vente på. Det er dette, pluss de fire tingene det er verdt å gjøre rett etterpå.',
    facts: [
      {
        strong: 'Gratis',
        rest: 'ingen kort, ingen prøveperiode',
      },
      {
        strong: 'Live',
        rest: 'i det øyeblikket du sender',
      },
      {
        strong: '~4 min',
        rest: 'til en fungerende klan',
      },
    ],
    footnote: 'Alt dette kan du endre senere under Admin → **Clan settings**, bortsett fra adressen — den er verdt en tanke nå.',
    before: {
      title: 'Før du setter i gang',
      body: [
        'Du trenger en Discord-konto, og det er hele lista. Logg inn på `{apex}` først: en klan må ha en eier, og innloggingen er måten siden vet at det er deg. Start fra **Start en klan** på plattformsidene, eller gå rett til `{apex}/clans/new`.',
        'Det koster ingenting. Ingen plan å velge, ingen kort å taste inn, og ingen prøveperiode som går ut og tar brettet ditt med seg — en klan starter gratis og fortsetter å virke.',
        'Store klaner kan senere gå opp til en større plan via **Plan and billing** i Admin. Alt du betaler for på Anvil — en klan, et creator-rom eller ditt eget Supporter-medlemskap — ligger på [betalingssiden din](/portal).',
      ],
      note: {
        tag: 'Du blir eieren',
        body: 'Eier er den ene rollen ingen kan ta fra deg, og den går til den som oppretter klanen. Legg til stab etterpå under Admin → **People** → **Staff & roles**; se [På vaktlista]({moderatorGuide}).',
      },
    },
    create: {
      title: 'Gi den navn, og velg adresse',
      intro: 'Tre felt, og bare to reelle valg. Skjemaet sjekker adressen mens du skriver og sier fra før du sender.',
      fields: [
        {
          term: 'Klannavn i spillet',
          body: 'Påkrevd, og det må stemme **nøyaktig** med OSRS. Dette er ikke pynt: rostersynkroniseringen matcher på det og avviser en medlemsliste som meldes under et annet navn. Det er dét som hindrer andres medlemsliste i å havne på siden din.',
        },
        {
          term: 'Klannavn',
          body: 'Valgfritt. Det folk ser — på siden og i hver Discord-post. La det stå tomt, så brukes spillnavnet ditt til begge deler.',
        },
        {
          term: 'Adresse',
          body: 'Klanen din bor på `{apex}/c/din-slug`. Den foreslås ut fra navnet du skrev, du kan endre den, og noen få ord er reservert. Velg en du fortsatt liker om et år: det er lenka som ender festet i Discorden din.',
        },
      ],
      note: {
        tag: 'Spillnavnet er en lås, ikke en etikett',
        body: 'Hvis klanen bytter navn i spillet, endre det her også — inntil da avviser rostersynkroniseringen det nye navnet. Det er kontrollen som virker, ikke en feil.',
      },
    },
    live: {
      title: 'Den er live',
      body: [
        'Trykk **Opprett klan**, og den finnes. Ingen provisjonering, ingen kø, ingen «vi bygger siden din, kom tilbake om noen minutter» — en klan er en rad, så den kjører allerede før siden er ferdig med å bytte.',
        'Du havner på et valg mellom **Sett den opp**, som åpner veiviseren, og **Se deg om først**. Ingenting går i stykker om du går fra det og kommer tilbake i morgen; veiviseren husker hvilke steg du har gjort.',
      ],
    },
    setup: {
      title: 'Oppsettsveiviseren',
      intro: 'Tre trinn står mellom en fersk klan og et arrangement i gang, og veiviseren går gjennom dem i rekkefølge og hopper over det du alt har gjort. Brettet kommer rett etterpå.',
      steps: [
        {
          term: 'Klanen din',
          body: 'Visningsnavnet ditt, klannavnet i spillet og en invitasjonslenke til serveren din. Invitasjonen er dét som lar påmeldingssider og guider peke folk til deg.',
        },
        {
          term: 'Koble til Discord',
          body: 'Én delt bot, så det er ingen applikasjon å registrere og ingen token å lime inn. Trykk **Connect your bot** og godkjenn den én gang, velg så **A few channels** eller **Just one channel** og trykk **Set it up for me** — boten lager kanalene for deg.',
        },
        {
          term: 'Få med medlemmene',
          body: 'Installer pluginet, logg inn med Discord, åpne så klanvinduet i spillet og trykk **Anvil**-knappen i tittellinja. Ingen kan melde seg på et arrangement før medlemslista di er inne.',
        },
        {
          term: 'Lag et brett',
          body: 'Veiviseren slutter på **Create your first event →**. Velg format, legg til ruter, åpne påmelding — det er [Kjør ditt første arrangement]({adminGuide}), og klart det lengste trinnet.',
        },
      ],
      after: [
        'Du kan hoppe over veiviseren helt med **Skip setup** og gjøre alt senere under Admin → **Clan settings** og Admin → **Discord**. Den finnes fordi rekkefølgen betyr noe når man aldri har gjort det før: Discord før kanaler, medlemmer før et brett de må melde seg på.',
      ],
    },
    members: {
      title: 'Få medlemmene inn',
      body: [
        'Ingen trenger å melde seg på, registrere seg eller inviteres én om gangen. Medlemslista di kommer fra spillet.',
      ],
      ways: [
        {
          term: 'Rostersynkronisering (ta denne)',
          body: 'Åpne klanvinduet i spillet med pluginet i gang og trykk **Anvil**-knappen i tittellinja. Hele medlemslista kommer inn med rangene i behold, og en liste fra en klan hvis navn ikke stemmer med ditt, blir avvist. Gjenta det når folk kommer eller går — se [oppsettsguiden for spillere]({pluginGuide}).',
        },
        {
          term: 'De ber om å bli med',
          body: 'Å logge inn eller spille med pluginet gir aldri noen en plass av seg selv. Ser pluginet noen spille i klanen din i spillet før medlemslista di har dem, oppretter det en forespørsel om å bli med for dem, og alle andre kan spørre med **Apply** på klansiden deres. Staben svarer på begge øverst i **Roster**-fanen, og **Who can join** avgjør om de venter på et ja, kommer inn med en gang eller ikke kan spørre i det hele tatt. Den som spiller en karakter som allerede står på medlemslista di, blir i stedet bekreftet under **Needs review**. Detaljene står i [Folkene dine]({peopleGuide}).',
        },
        {
          term: 'For hånd',
          body: 'Admin → **People** → **+ Add Manually** tar navn ett om gangen, for den som spiller på mobil eller den offisielle klienten og ikke kan kjøre pluginet i det hele tatt.',
        },
      ],
      note: {
        tag: 'Gjester er ikke et problem som skal løses',
        body: 'En gjest spiller i eventene dine uten å være med i klanen din i spillet: en spiller fra en gjesteklan, en venn, en alt. De får en plass når staben godkjenner forespørselen deres, eller med en gang hvis **Who can join** er satt til **Let anyone in**. De blir sporet og kan delta i eventer, og de teller ikke med i planen din. Den som blir med i klanen din i spillet, blir medlem ved neste synkronisering av medlemslista.',
      },
    },
    first: {
      title: 'Ditt første arrangement',
      body: [
        'Korteste vei til at noe skjer: lag et brett, legg til en håndfull ruter pluginet ser selv, åpne påmelding, og start. Drops, killcounts og XP fører seg så inn av seg selv.',
        'To guider bærer lasset her. [Kjør ditt første arrangement]({adminGuide}) går fra start til slutt — Discord, lag, oppstart, og hva man gjør når det er over. [Bygg et brett som følger med selv]({boardGuide}) handler spesifikt om ruter: hva hver type faktisk kan oppdage, og de som importeres pent og så aldri utløser.',
        'Vil du helst ikke bygge et brett i det hele tatt den første uka, kjør en **Skill of the Week** eller **Boss of the Week** i stedet. Alle på lista er automatisk med, stillingen kommer fra hiscores, og det er ingenting å skrive.',
      ],
    },
    together: {
      title: 'Arrangementer på tvers av flere klaner',
      body: [
        'Et arrangement trenger ikke tilhøre én klan. Flere klaner kan kjøre samme brett sammen — to, eller et dusin — der hver side beholder sin egen medlemsliste, sin egen stab og sin egen halvdel av moderasjonen.',
        'De kan også dele én pulje spillere i stedet for å sitte på hver sin side av en tabell: ett arrangement, alle med, uansett hvordan lagene til slutt settes sammen. Klan mot klan er én form for dette, ikke den eneste.',
        'Hver gjesteklan får en invitasjonslenke per lag, så du aldri samler inn ett eneste RSN for hånd, og en plass som lar deres egen moderator godkjenne sine egne medlemmers bevis. [Være vert for en gjesteklan]({clanVsClanGuide}) dekker det å arrangere ett.',
      ],
      note: {
        tag: 'Ingenting å kjøpe',
        body: 'Å delta i andres arrangement er gratis, og å arrangere ett er også gratis. En klan som bare dukker opp på andres brett, trenger aldri mer enn sin egen gratis klan.',
      },
    },
    boosts: {
      title: 'Klanboosts',
      body: [
        'Medlemmer som betaler for Anvil Supporter på **Champion** (én boost) eller **Patron** (to) kan booste klanen fra sine egne **Settings → Clan boosts**. En boost teller når plassen deres i klanen er 14 dager gammel, og det teller aldri mer enn to fra samme person.',
        'Du ser hvor dere står under Admin → **Clan settings** → **Boosts**: klanens nivå, hvor mange boosts som teller, og hvor mange flere neste nivå trenger. Level 1 krever 3 boosts, Level 2 krever 8 og Level 3 krever 15. Faller boostene under et nivå, beholder dere fordelene i en uke først.',
        'Level 1 gir et **Boosted**-merke på klansiden, på kortet i Clan Hall og i søk, plasserer dere over klaner uten boost i Clan Hall og gir navnet en fargeovergang. Level 2 legger til en plass i Clan Halls Featured-rad, spiller av det animerte banneret og låser opp en **Recruiting line**: én setning, opptil 140 tegn, som vises for besøkende. Level 3 legger til en Spotlight øverst i Clan Hall og ett **Recruitment post in the Anvil Discord** i måneden, opptil 500 tegn, sendt én gang med **Post to the Anvil Discord**, med en lenke til klansiden og uten at noen blir pinget.',
      ],
      note: {
        tag: 'Bare utseende',
        body: 'Boosts endrer hvordan klanen ser ut og hvor den vises. De endrer aldri en rang, en poengsum, plassene deres eller abonnementet.',
      },
    },
  },

  discord: {
    metaTitle: 'Anvil i Discord — Anvil',
    metaDescription: 'Koble Anvil-boten til Discord-serveren din: én invitasjon, kanalene hver feed poster i, rolle- og kallenavnsynkronisering, slash-kommandoer, og hva du sjekker når det blir stille.',
    eyebrow: 'Anvil · Discord',
    title: 'Anvil i Discord',
    dek: 'Én bot, én invitasjon, og ingen applikasjon å registrere. Her står hva den poster, hvor den poster det, hva den får endre på serveren din — og hva du ser på den dagen den slutter.',
    facts: [
      {
        strong: 'Én bot',
        rest: 'delt, ingenting å opprette',
      },
      {
        strong: '~5 min',
        rest: 'fra invitasjon til første post',
      },
      {
        strong: 'Påslag',
        rest: 'hver feed er av til du peker den et sted',
      },
    ],
    footnote: 'Alt her ligger på Admin → **Discord**: hurtigoppsettet øverst, deretter **More settings** — Connection, What goes where, Event posts, Roles & nicknames, Team channels, Commands og Post without a bot.',
    bot: {
      title: 'Én bot, allerede bygd',
      body: [
        'Det er ingen Discord-applikasjon å opprette, ingen token å generere og ingen hemmelighet å lime inn. Anvil kjører én bot som alle klaner deler, så å koble til er en invitasjon og ingenting mer.',
        'Du kan fortsatt ta med din egen — lim inn en token under **Use your own bot instead (advanced)**, så brukes den i stedet. Verdt det bare om du vil at boten skal bære klanens navn og avatar i medlemslista; alt i denne guiden virker likt uansett.',
      ],
      permissions: [
        {
          term: 'Se kanaler, Send meldinger, Bygg inn lenker, Legg ved filer',
          body: 'Det grunnleggende. Uten disse er den på serveren din og taus.',
        },
        {
          term: 'Administrer webhooks',
          body: 'Så **Set it up for me** og **Post here** kan lage webhooks for deg i stedet for at du kopierer URL-er ut av Discord for hånd, og så Anvil kan finne gamle webhooks du kan fjerne.',
        },
        {
          term: 'Administrer roller',
          body: 'Bare hvis du slår på rollesynkronisering. Da kan den dele ut rollene du kobler — og den kan aldri røre en rolle over sin egen, som er Discords regel, ikke vår.',
        },
        {
          term: 'Administrer kallenavn',
          body: 'Bare hvis du slår på kallenavnsynkronisering, så et medlems servernavn kan settes til RSN-et deres.',
        },
        {
          term: 'Administrer kanaler',
          body: 'For private lagkanaler under en draft, og for guider som postes som en ny kategori eller et forum. Hopp over den, så fungerer alt annet likevel.',
        },
        {
          term: 'Administrer tråder, Send meldinger i tråder',
          body: 'For guider i et forum: å skrive i innlegget og fjerne det igjen — Discord lar ikke en bot slette selv sitt eget foruminnlegg uten den.',
        },
        {
          term: 'Endre kallenavn',
          body: 'Bare hvis du gir boten klanens navn under **Connection → Bot appearance in your server**. Det endrer bare botens navn på serveren deres.',
        },
      ],
      note: {
        tag: 'Den ber om alt på én gang',
        body: 'Discord kan ikke be om en rettighet senere, så invitasjonslenka ber om hele settet, og funksjonene du aldri slår på bruker aldri sine. Å åpne invitasjonslenka på nytt er også måten å reparere en rettighet noen har fjernet.',
      },
    },
    connect: {
      title: 'Å koble den til',
      intro: 'To ting, i denne rekkefølgen. Boten må være på serveren din, og Anvil må vite hvilken server som er din.',
      steps: [
        {
          term: 'Inviter boten',
          body: 'Admin → **Discord** → **Connect your Discord server** (eller **Add Anvil to Discord**). Discord spør hvilken server Anvil skal legges til på og sender deg tilbake hit, så du kan ikke legge den til feil server ved et uhell. Senere ligger **Invite / re-invite the bot** under **More settings → Connection**.',
        },
        {
          term: 'Sett server-id-en',
          body: 'Bare hvis knappen ikke får det til: åpne **Can’t use the button? Enter the server ID**, høyreklikk serverikonet i Discord → **Kopier server-ID** (krever Utviklermodus, under Avansert i Discords egne innstillinger), lim den inn i **Your Discord server’s ID** og trykk **Save**. Det er feltet som gjør koblingen til din.',
        },
      ],
      after: [
        'Panelet forteller deg så sannheten i stedet for hensikten din: om boten faktisk er medlem av den serveren, og hvilke rettigheter den mangler. En grønn linje der er mer verdt enn et lagret skjema.',
      ],
      note: {
        tag: 'Server-id-en er hele bindingen',
        body: 'En server tilhører nøyaktig én klan på Anvil, og slash-kommandoer fra en server ingen har gjort krav på blir avvist framfor gjettet. Til du setter den, er boten invitert og uvirksom.',
      },
    },
    channels: {
      title: 'Sett opp webhooks',
      body: [
        'Anvil poster gjennom **webhooks**, én per kanal, og hver eneste er valgfri. Ingenting postes noe sted før du peker en feed mot en kanal — en fersk klan er taus med vilje, ikke ved et uhell.',
        'Med Anvil-boten på serveren lager **Set it up for me** øverst på **Admin → Discord** kanalene og peker hver feed mot dem. Vil du gjøre det for hånd, åpner du **More settings → What goes where** og starter med **Catch-all channel** på **Clan & events**, deretter **In-game catch-all** på **In-game (plugin)**: velg en kanal i nedtrekkslista, så lagres den. Uten boten går du i Discord til kanalens **Rediger kanal → Integrasjoner → Webhooks**, oppretter en, kopierer URL-en, velger **Paste a webhook…** i nedtrekkslista, limer den inn og trykker **Save**. En webhook-URL kan poste i kanalen sin, så behandle den som et passord; slett den i Discord og lag en ny hvis den lekker. **Test**, og **Add another** for å fordele travle poster mellom to webhooks, ligger under **Post without a bot**.',
      ],
      feeds: [
        {
          term: 'Catch-all channel',
          body: 'Den viktigste, på fanen **Clan & events**. Arrangementer som starter og slutter, påmelding som åpner, stillinger, ukesresultater — alt nettstedet poster uten en egen kanal. Sett bare den, så har du en fungerende klan.',
        },
        {
          term: 'In-game catch-all',
          body: 'På fanen **In-game (plugin)**: hvor alt fra spillet havner når det ikke har sin egen kanal. Sett den som nummer to.',
        },
        {
          term: 'De oppdelte feedene',
          body: 'Arrangementsposter, brett dere arrangerer sammen med andre, Skill & boss of the week og arrangementer i klankalenderen kan skilles ut fra catch-all-kanalen; sjeldne drops, pets, collection log, nivåer, combat achievements, quests, diaries, dødsfall og PvP-kills kan skilles ut fra in-game catch-all. Endringer i medlemslista, godkjente påmeldinger og kassaboka ligger på **Staff only**. Tomme utskilte feeder faller tilbake til sin catch-all. Kassa er unntaket: tom betyr ingen pengeposter i det hele tatt. Leagues og andre moduser har sin egen **Game modes**-fane.',
        },
      ],
      note: {
        tag: 'Skill ut dødsfallene først',
        body: 'Dødsfall er feeden med størst volum på de fleste brett og den som begraver alt annet. Skiller du ut bare én ting, skill ut den.',
      },
    },
    roles: {
      title: 'Roller og kallenavn',
      body: [
        'Begge synkroniseringene er av til du aktiverer dem under **Admin → Discord → Roles & nicknames**, og begge styres av medlemslista. Slå på **Enable Discord role sync**, la **Auto-match in-game rank → Discord role by name** stå på, velg eventuelle generelle **Member roles** og **Guest roles**, lagre og trykk **Sync roles & nicknames now**. Hver person må også ha en koblet Discord-identitet; synkroniseringsrapporten navngir alle den ikke kunne finne.',
      ],
      ways: [
        {
          term: 'Rollesynkronisering',
          body: 'For automatisk rangmatching må navnet på Discord-rollen stemme med klanrangen i spillet: `Owner`, `Deputy Owner`, `Coordinator`, `Overseer`, `General`, `Captain`, `Lieutenant`, `Sergeant`, `Corporal` eller `Recruit`. Egne ranger virker også når Discord-rollen deres har nøyaktig samme navn. Store og små bokstaver spiller ingen rolle, og understrek regnes som mellomrom, men ekstra ord matcher ikke: `General` virker, `OSRS General` gjør ikke det. Medlems- og gjesteroller velges separat, så de kan hete hva som helst.',
        },
        {
          term: 'Kallenavnsynkronisering',
          body: 'Setter et medlems servernavn til RSN-et deres. Den fyller som standard inn et tomt kallenavn og kan få beskjed om å overskrive et noen har valgt selv — det er innstillingen å tenke over før, ikke etter.',
        },
      ],
      note: {
        tag: 'Botens rolle må ligge over dem den styrer',
        body: 'Discord lar ingen bot røre en rolle på eller over sin egen, og nekter det tause fra din side — synkroniseringen gjør da rett og slett ingenting. Dra Anvil-rollen opp under **Serverinnstillinger → Roller**, så begynner den å virke; ingenting må inviteres på nytt.',
      },
    },
    commands: {
      title: 'Slash-kommandoer',
      body: [
        'Boten svarer på `/bingo` på serveren din (brettet, stillingen, reglene, ditt eget kort) pluss klankommandoer som `/sotw`, `/stats` og `/coffer`. De leser det levende nettstedet, så ingen må forlate Discord for å se hvor de ligger. [Hver kommando og alternativene dens]({commandsGuide}) har sin egen side.',
        'De dukker opp omtrent ett minutt etter at boten har blitt med. Dukker de ikke opp i det hele tatt, ga invitasjonen boten men ikke kommandoene — det er to separate rettigheter, og en eldre invitasjonslenke ba bare om den ene. Kjør **Invite / re-invite the bot** på nytt under **Connection** på Discord-siden; det kaster ikke ut boten og nullstiller ingenting.',
      ],
      note: {
        tag: 'Den svarer på hver enkelts eget språk',
        body: 'Som standard svarer boten på språket det medlemmet har satt Discord til, med engelsk som reserve. Velg ett språk under **Botspråk** for å overstyre det for alle — det er også eneste vei til arabisk, siden Discord ikke har et arabisk klientspråk å oppdage.',
      },
    },
    posts: {
      title: 'Hva den poster, og når',
      body: [
        'To kilder, og det er verdt å vite hvilken som er hvilken når noe ser feil ut.',
        '**Siden** poster om arrangementer: et brett som åpner, påmelding, en start, stillinger, resultatet. De kommer fra Anvil selv og virker enten noen har pluginet eller ikke.',
        '**Pluginet** poster hva som skjer i spillet: drops, pets, dødsfall, nivåer, collection log-plasser, combat achievements. De finnes bare for medlemmer som kjører det, så en taus drops-kanal betyr som regel et taust plugin framfor en ødelagt webhook.',
      ],
      note: {
        tag: 'Ingenting postes to ganger',
        body: 'Et drop som fullfører en rute er én post, ikke én fra pluginet og én til fra brettet.',
      },
    },
    modes: {
      title: 'Leagues, Deadman og andre moduser',
      body: [
        'Leagues, Deadman, hardcore og andre moduser kjører på egne verdener med egne figurer. Postene deres er alltid merket og teller aldri mot brett eller konkurranser. De har sin egen fane: **Admin → Discord → What goes where → Game modes**. En modus dukker opp der første gang et medlem spiller den.',
        'Hver modus har en bryter og en **To**-kanal. Slå på **Send game-mode posts to their own channels** for å bruke de kanalene; la den stå av, så poster hver modus i de vanlige kanalene, fortsatt merket. Knappen **Posts** på raden til en modus viser alle typene den sender — de vanlige og modusens egne hendelser — hver med sin egen bryter.',
        'Under den lista får **Custom filters** en modus til å poste mindre enn hovedspillet. **Post drops rarer than 1 in…** setter en egen sjeldenhetsgrense (tom = samme som hovedspillet): gjenstander som alltid postes, postes fortsatt, men drops som bare teller på grunn av verdien, gjør det ikke. **Use its own level milestones** poster et nivå bare hvis det oppfyller begge settene med regler.',
      ],
      note: {
        tag: 'Strengere, aldri løsere',
        body: 'Filtrene til en modus kan bare ta bort poster. Pluginet har allerede brukt innstillingene dine for hovedspillet, så ingenting et modusfilter gjør kan hente tilbake en post.',
      },
    },
    cleanup: {
      title: 'Gamle webhooks fra Dink eller andre boter',
      body: [
        'Med boten på serveren viser Discord-siden alle webhooks der som ikke er Anvils. **Coming from Dink?** tilbyr **Use the same channels**, så **Set it up for me** poster der de gamle feedene dine gjorde, og ingenting flytter seg for medlemmene.',
        'Når medlemmene er over på Anvil, går du til **Remove Dink’s old webhooks**, huker av for dem som skal bort og trykker **Remove … webhooks**, deretter **Yes, remove them**. Det sletter dem i Discord for godt — det kan ikke angres.',
        'Lista inneholder alle webhooks som ikke er Anvils, ikke bare Dinks. Vil du beholde en, som feeden til en annen bot? Trykk **Keep**, så forsvinner den fra lista; **Show kept** og **Put back** henter den tilbake. Å beholde skjuler den bare her — ingenting endres i Discord.',
      ],
      note: {
        tag: 'Krever Administrer webhooks',
        body: 'Boten leser serverens webhooks for å finne dem. Uten _Administrer webhooks_ på rollen sin sier siden at den ikke kan se dem.',
      },
    },
    announce: {
      title: 'Post i Discord',
      body: [
        'Administratorer kan poste som boten fra **Post to Discord**, under **Clan** i adminmenyen. Velg en **Channel**, skriv teksten i **Message** og trykk **Send message**. Lang tekst, som et regelverk, deles opp i flere meldinger av seg selv.',
        '**Send as an embed** er på som standard og legger til en valgfri **Title** og en **Accent colour**; slå den av for ren tekst. **Ping** velger en rolle, eller @everyone, å nevne, og Anvil spør før den sender.',
        'Hver post du sender, står oppført under **Sent from here**. **Edit** endrer den i Discord uten å pinge på nytt, og **Delete** fjerner den.',
      ],
      note: {
        tag: 'Bare administratorer, med boten',
        body: 'Den poster som Anvils bot, så koble til serveren først. Moderatorer ser den ikke. Det er bryteren **Post to Discord** under **Clan settings → Features**; slått av forsvinner den fra menyen.',
      },
    },
    quiet: {
      title: 'Når det blir stille',
      body: [
        'I rekkefølge, fordi hvert punkt utelukker det neste:',
      ],
      checks: [
        {
          term: 'Er boten faktisk på serveren?',
          body: '**Connection** på Discord-siden sier det direkte. «Token gyldig» og «på serveren din» er to ulike fakta, og det første betyr ikke det andre — med en delt bot er tokenet alltid gyldig.',
        },
        {
          term: 'Er server-id-en riktig?',
          body: 'En feil-men-ekte id ser nøyaktig ut som en riktig, helt til du merker at postene havner et annet sted.',
        },
        {
          term: 'Finnes webhooken fortsatt?',
          body: 'Å slette en Discord-kanal sletter webhooken dens, og Anvil beholder den døde URL-en. Velg en kanal for den på nytt under **What goes where**.',
        },
        {
          term: 'Ligger botens rolle høyt nok?',
          body: 'Bare for rolle- og kallenavnsynkronisering — se over. Det er den som feiler tause.',
        },
      ],
      note: {
        tag: 'Den kan ikke ønske nye velkommen',
        body: 'Discord melder bare tilganger over en gateway-forbindelse, som en delt bot ikke holder åpen for hver server. Det finnes derfor ingen «velkommen»-post — legg påmeldingslenka i en #roller- eller #start-her-kanal i stedet, der folk uansett ser.',
      },
    },
  },

  plugin: {
    metaTitle: 'Oppsett av RuneLite-pluginet — Anvil',
    metaDescription:
      'Installer Anvils RuneLite-plugin, logg inn fra sidepanelet, og sett opp Discord-varsler.',
    eyebrow: 'Anvil · RuneLite-plugin',
    title: 'Oppsettsveiledning for spillere',
    dek: 'Installer det, logg inn, og spill. Pluginet sender inn bingo-dropsene dine, poster sjeldne drops, dødsfall og milepæler på Discord, og lar deg slå opp hvem som helst med et høyreklikk.',
    facts: [
      { strong: '1 knapp', rest: 'så er sporingen i gang' },
      { strong: '~3 min', rest: 'for grunnoppsettet' },
      { strong: 'Høyreklikk', rest: 'for å slå opp hvem som helst' },
    ],
    footnote:
      'Skjermbildene er fra et ekte oppsett — kontotokenet er sladdet med vilje. Ditt bør forbli like privat.',

    install: {
      title: 'Installer pluginet',
      body: [
        'I RuneLite: **Configuration** (skiftenøkkelen) → **Plugin Hub** → søk etter **Anvil** → **Install**. Utgiveren er `AhmedFathy2001`.',
        'Ett plugin dekker alle klaner — det kobler seg alltid til `anvilosrs.com`, og det er innloggingen (neste trinn) som knytter det til deg og klanene dine. Det er ingenting klanspesifikt å laste ned og ingen adresse å skrive inn. Når det er installert, dukker en **Anvil**-knapp opp i RuneLites sidefelt, og innstillingene ligger under **Configuration → Anvil**.',
      ],
    },

    connect: {
      title: 'Logg inn',
      intro: 'Åpne **Anvil**-panelet fra RuneLites sidefelt og klikk **Sign in with Discord**. Nettleseren åpnes på `anvilosrs.com`; godkjenn koden der, så logger pluginet seg inn selv — ingenting å skrive, ingenting å kopiere og ingenting å fylle inn under innstillinger.',
      panelFigure: {
        caption: 'RuneLite → Anvil-knappen',
        alt: 'RuneLites sidepanel med Anvil-knappen nederst i ikonraden ringet inn',
        legend: [
          {
            label: 'Anvil-knappen',
            body: 'langs kanten av RuneLite-vinduet, nederst i ikonraden. Klikk på den for å åpne panelet. Den dukker opp så snart pluginet er installert og slått på — og du kan dra den oppover raden hvis du heller vil ha den nær toppen.',
          },
        ],
      },
      signInFigure: {
        caption: 'Anvil-panelet',
        alt: 'Anvil-panelet med knappen Sign in with Discord og siden det kobler til ringet inn',
        legend: [
          {
            label: 'Sign in with Discord',
            body: 'vises bare så lenge denne datamaskinen er logget ut. Klikk på den, så skjer resten i nettleseren din.',
          },
          {
            label: 'Connects to',
            body: 'alltid `anvilosrs.com` — det eneste nettstedet pluginet snakker med, og det tokenet ditt hører til.',
          },
          {
            label: 'Paste a token instead',
            body: 'reserveløsningen, hvis nettlesertrinnet ikke fungerer for deg — se slutten av dette trinnet.',
          },
        ],
      },
      easySteps: [
        'Klikk **Sign in with Discord**. Panelet viser en kort kode og åpner nettleseren på `anvilosrs.com`.',
        'Logg inn med Discord der hvis du ikke allerede er det, sjekk at koden på siden stemmer med den i RuneLite, og klikk så **Approve**.',
        'Tilbake i RuneLite står det _Signed in_ øverst i panelet — og, når du logger inn i spillet, hvilken karakter det følger. Ferdig.',
      ],
      linkFigure: {
        caption: 'anvilosrs.com → /link-device',
        alt: 'Siden Link your RuneLite client, med kodefeltet og Approve-knappen rammet inn',
        legend: [
          { label: 'Koden', body: 'den må stemme med det pluginet viser deg akkurat nå.' },
          {
            label: 'Approve',
            body: 'godkjenn bare en kode som _din egen_ klient viser. Har noen sendt deg en lenke eller en kode, avvis den — å godkjenne ville vært å gi dem kontoen din.',
          },
        ],
      },
      directNote: {
        tag: 'Hvor dette skjer',
        body: [
          'Hele flyten blir på `anvilosrs.com` — koden utstedes der, du godkjenner den der med din egen Discord-innlogging, og tokenet går rett tilbake til pluginet. Pluginet åpner bare innloggingssider på `anvilosrs.com`, så en innloggingslenke som peker et annet sted, kommer ikke fra det.',
        ],
      },
      federationAside:
        'Må ikke forveksles med **Connect clans** i sidepanelet — det er den separate, valgfrie knappen som kobler deg til andre Anvil-klaner, og den dukker først opp når du allerede er logget inn her.',
      manualFallback:
        'Hvis nettleseren ikke åpner seg selv, skriver panelet ut adressen og koden slik at du kan åpne den manuelt. Koder utløper etter ti minutter — trykk bare på knappen igjen.',
      manualHeading: 'Reserveløsning: lim inn tokenet for hånd',
      manualIntro:
        'Hvis innlogging fra pluginet ikke fungerer for deg, kopier tokenet ditt nedenfor (eller fra [Profile → plugin token](/profile#plugin-token), der du også kan rotere det), klikk deretter **Paste a token instead** under innloggingsknappen i Anvil-panelet og lim det inn der.',
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
            body: 'kopier det, og bruk så **Paste a token instead** i Anvil-panelet. Rotate utsteder et nytt og dreper det gamle — bruk det hvis du noen gang mistenker at tokenet ditt har lekket.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Bruk sidepanelet til daglig',
        body: ['**Anvil-sidepanelet er hovedarbeidsområdet ditt**: logg inn og ut der, se klanene og aktive eventer, bla gjennom og gjør krav på ruter, følg fremdriften, ta startbilder, kjør synkroniseringer og åpne støtteverktøy. **Configuration → Anvil**, vist nedenfor, er bare for innstillinger — det finnes ikke noe token der. For å logge denne datamaskinen ut, åpne **⋯**-menyen ved siden av navnet ditt øverst i panelet. Én innlogging dekker alle eventene du er påmeldt — du gjør det aldri på nytt per bingo.'],
      },
    },

    accounts: {
      title: 'Koble kontoene dine',
      body: [
        'Når tokenet er satt opp, vises kontoene du spiller på automatisk på profilen din. En helt ny konto kan kobles med en gang; en konto som allerede står på en klanliste trenger først én eierskapssjekk, fordi et offentlig RuneScape-navn ikke beviser hvem som eier det.',
        'For den første koblingen bruker du [den raske XP-sjekken](/profile#link-account), eller ber en klanmoderator godkjenne kontoen under [oppdagede kontoer](/profile#detected-accounts). Etterpå følger det stabile kontofingeravtrykket navnebytter og kjenner igjen kontoen automatisk.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'Kortet RuneScape Accounts på profilsiden som lister opp kontoer verifisert via pluginet',
        legend: [
          {
            label: 'De koblede kontoene dine',
            body: 'alt merket “Verified via plugin” er koblet og blir automatisk gjenkjent. Eksisterende klanlistekontoer kan først be om en engangs XP-sjekk eller moderatorgodkjenning.',
          },
        ],
      },
      noPluginHeading: 'Kan du ikke kjøre pluginet?',
      noPluginIntro:
        'På mobil eller i den offisielle klienten bruker du [Profile → account linking](/profile#link-account) i stedet:',
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
      panelHeading: 'Sidepanelet',
      panelBody: [
        'Fire faner og et tannhjul. **Clan** er eventene dine og klanen din: hver pågående og kommende bingo og ukeskonkurranse med hvor du står. **Feed** er de store øyeblikkene til klanen din og brettene dine mens de skjer, med eventchat. **You** er din egen profil, og **Lookup** finner alle andres, spiller eller klan. Tannhjulet har synkronisering og bannerlydene dine.',
        'Alle fanene, eventchat, reaksjoner og innstillingene som tar feeden og Supporter-fargene inn i spillet ditt, står i [Sidepanelet, fane for fane]({panelGuide}).',
      ],
      panelFigure: {
        caption: 'Clan · You · Lookup',
        alt: 'Anvil-sidepanelets tre faner side om side: Clan-fanen med eventer og klanens uke, You-fanen med collection log-en din, og Lookup-fanen med en annen spillers kort',
      },
      lookupHeading: 'Slå opp hvem som helst',
      lookupBody:
        'Høyreklikk en spiller — rett ved siden av deg, eller på navnet i chatten, vennelisten eller klanpanelet — og velg **Anvil** for å åpne kortet deres i sidepanelets **Lookup**-fane. Ditt eget er **You**-fanen.',
      lookupFigure: {
        caption: 'Høyreklikk et navn → Anvil',
        alt: 'En spillers høyreklikkmeny i spillet med et Anvil-valg under Lookup og RuneProfile',
      },
      lookupSettingNote:
        'Velg hvor **Anvil**-valget vises under **Player lookup** i pluginets innstillinger. På et navn i chatten er det aldri venstreklikk-valget, så et klikk på et navn gjør fortsatt det spillet vanligvis gjør.',
      lookupSettingFigure: {
        caption: 'Configuration → Anvil → Player lookup',
        alt: 'Player lookup-delen av Anvil-innstillingene med hver innstilling rammet inn og nummerert',
        legend: [
          {
            label: 'Anvil lookup on players',
            body: 'hovedbryteren. Av skjuler valget overalt.',
          },
          {
            label: 'Players in the world',
            body: 'høyreklikk på en spiller som står i nærheten av deg.',
          },
          {
            label: 'Chatbox and private messages',
            body: 'navn i chatteboksen og i privat chat.',
          },
          {
            label: 'Clan panels / Friends chat / Friends, ignore and party lists',
            body: 'navnelistene: medlemmene i klanen din og gjesteklanen, friends chat-kanalen, venne- og ignorerlistene dine og raid-partypanelet.',
          },
        ],
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
            label: 'Show Overlay',
            body: 'tegner et lite panel med _Anvil / lag / UTC-dato_ oppe til venstre. Det blir en del av bildet i bevis-skjermbildene dine, og det er nettopp det som gjør et bevis vanskelig å forfalske eller datere tilbake. Den er av på dette bildet — slå den på hvis klanen din vil se lag og tid på hvert bevis.',
          },
          {
            label: 'Team completion popups',
            body: 'et banner når noen på laget ditt fullfører en rute. Flere samtidig: den vanskeligste får banneret, resten går til chatten.',
          },
          {
            label: 'My tile popups',
            body: 'en popup når din egen drop flytter en rute fremover eller fullfører den. Av sporer den fortsatt — bare i stillhet.',
          },
          {
            label: 'Banner sound + volume',
            body: 'spiller en lyd sammen med banneret. Ingenting skjer før du selv legger til minst én .wav-fil, via **Add clip** under “Banner sounds” i Anvil-sidepanelet. Oppdrag har sin egen mappe — legg til et klipp under **Mission sounds**, så spilles det i stedet for den innebygde lyden som skiller dem fra en fullført rute.',
          },
          {
            label: 'Auto starting shot',
            body: 'tar startbildet for et event for deg i det øyeblikket du står på det festede stedet. Av trykker du **Take starting shot** i sidepanelet selv.',
          },
        ],
      },
      teamsHeading: 'Lag',
      teamsBody:
        '**Teams**-knappen på et event viser lagene rangert, med ditt øverst. Åpne et lag for å se medlemslista, kapteinen først, eller søk etter en spiller på tvers av alle lag — klikk et navn for å slå personen opp.',
      teamsFigure: {
        caption: 'Eventet → Teams',
        alt: 'Teams-siden med et events lag, poeng og antall medlemmer, ved siden av medlemslista til ett lag med kapteinen først',
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
        'Disse sendes uansett om en bingo pågår eller ikke, og de postes i klanens kanaler. Hvilken kanal bestemmer administratorene her — du velger bare _hva_ du poster. I neste plugin-oppdatering flytter disse valgene til nettsiden, under **Settings → Announcements**, og følger deg til hver datamaskin. Pluginen beholder to brytere under **Notifications**: **Share clan posts** setter alle innlegg fra hovedspillet på pause på én gang, og **Share seasonal activity** gjør det samme på Leagues, Deadman og andre sesongverdener.',
      examplesFigure: {
        caption: 'Slik ser en post ut',
        alt: 'To Discord-poster fra Anvil: en Grandmaster combat task med poeng og fremgang mot neste opplåsning, og et dødsfall med meldingen sin, hver med et skjermbilde av øyeblikket',
      },
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
          {
            label: 'Loot key value',
            body: 'en loot key postes én gang, som ett enkelt varsel, når hele innholdet passerer dette tallet.',
          },
          { label: 'Notify on pets', body: 'pets postes i kanalen for sjeldne drops.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · collection log · levels · diaries · quests',
        alt: 'Varselseksjonen Combat achievements med hver innstilling rammet inn og nummerert',
        legend: [
          {
            label: 'CA post tier',
            body: 'det laveste oppgavenivået som postes; fullførte nivåer postes også. Standarden er Master; Grandmaster poster bare de aller sjeldneste, **Off** poster ingen. Bingo-ruter for CA teller uansett.',
          },
          {
            label: 'Notify on collection log slots',
            body: 'hver ny plass i collection log.',
          },
          {
            label: 'Notify on level milestones',
            body: 'nivåøkninger klanen din har valgt å annonsere — som standard 99-ere, hvert 100. totalnivå fra 1800, og max. Klanens administratorer setter reglene; du kan poste mindre (eller sette egne regler for dine personlige webhooks) under Announcements på profilen din.',
          },
          {
            label: 'Notify on diary completions',
            body: 'nivåer i achievement diary, med et skjermbilde.',
          },
          {
            label: 'Quest post tier',
            body: 'quester fra vanskelighetsgraden du velger og oppover, fra All (hver quest) opp til Grandmaster; **Off** poster ingen. Standarden er Master. Bingo-ruter for quester teller uansett.',
          },
        ],
      },
    },

    trouble: {
      title: 'Når noe går galt',
      intro:
        'Pluginet sier fra i chatten når sporingen har stoppet — det venter rundt 90 sekunder før det klager, og gjentar seg maks hvert 5. minutt.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Tokenet er feil eller har blitt rotert. Åpne **⋯**-menyen øverst i Anvil-panelet, trykk **Sign out**, og deretter **Sign in with Discord** igjen — eller bruk **Paste a token instead** med et ferskt token fra [Profile → RuneLite plugin](/profile#plugin-token).',
        },
        {
          term: '`Anvil: can’t reach the site (anvilosrs.com) — tracking is OFF.`',
          body: 'Pluginet når ikke `anvilosrs.com`. Sjekk internettforbindelsen din og eventuell brannmur eller VPN som kan blokkere RuneLite. Er alt det i orden, er nettstedet trolig nede en liten stund — pluginet kobler seg til igjen av seg selv.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Kontoen er ikke koblet ennå. Åpne [Profile → oppdagede kontoer](/profile#detected-accounts) for å legge den til eller starte eierskapssjekken.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Ingenting. Det ordnet seg av seg selv.',
        },
        {
          term: '“<RSN> belongs to another Anvil player”',
          body: 'Noen andre koblet denne karakteren til Anvil først, så ingenting teller for den fra din innlogging. Er den virkelig din? Trykk **This is my account** i panelets **You**-fane og ta den raske XP-sjekken. Da blir den nåværende eieren spurt, eller staben til Anvil avgjør. Du får aldri vite hvem det er. Følg saken under [Settings → Ownership claims](/settings/claims).',
        },
      ],
      logHeading: 'Fortsatt fast? Send en admin en logg',
      logBody:
        'Send en admin RuneLite-loggen din: `client.log` i `.runelite/logs`-mappa i brukermappa di (på Windows limer du inn `%USERPROFILE%\\.runelite\\logs` i adressefeltet i Filutforsker). Pluginet skriver inn hva det så og hvorfor, så de kan se nøyaktig hva som gikk galt.',
      missingNote: {
        tag: 'Mangler det bevis?',
        body: 'Pets og ekstra Champion’s scrolls krever et manuelt skjermbilde. Pluginnet tar det for deg og lagrer det i `.runelite/osrs-bingo-pending/` — **Copy folder path** i Anvil-sidepanelet åpner mappen — så du legger det ved på siden i stedet for å lete etter et bilde etterpå.',
      },
    },
    limits: {
      title: 'Kjente begrensninger',
      intro:
        'Noen få ting kan ikke spores perfekt — nesten alltid på grunn av det selve spillet rapporterer, ikke Anvil. Løsningen er den samme hver gang: ta et skjermbilde og send det inn manuelt.',
      rows: [
        {
          term: 'Barraging og andre drap på flere mål',
          body: 'Antall drap (KC) kommer fra det spillet rapporterer per drap, og trylleformler med flere mål som Ice Barrage gjør at noen blir oversett, så **KC kan bli lavere** enn det du har drept. RuneLites egen Loot Tracker teller for lavt på samme måte — det er en begrensning i spillmotoren, ikke en Anvil-feil.',
        },
        {
          term: 'Combat achievements du har gjort før',
          body: 'Slå på **repeat completion** i spillets innstillinger for Combat Achievements. Uten den melder ikke spillet fra om en oppgave du allerede har fullført, og pluginet kan bare gi poeng for det spillet melder.',
        },
        {
          term: 'Yama-kontraktens combat achievement',
          body: 'Spillet melder ikke fra om denne på nytt selv med repeat completion på, så pluginet ser den aldri. Ta et skjermbilde og send den inn manuelt.',
        },
        {
          term: 'Innsamlingsruter uten pluginet',
          body: 'Antall gjenstander — et antall fisk, malm, tømmerstokker — står ikke på hiscores, så bare pluginet sporer dem. Uten det: ta skjermbilde av hvert inventar; eller, hvis gjenstanden vises i Loot Tracker, et skjermbilde nullstilt til 0 i starten og et til på slutten.',
        },
        {
          term: 'Implings, fisk, malm og andre gjenstandsgevinster',
          body: 'Å fange implings og samle gjenstander (fisk, malm og alt annet som telles ut fra det som havner i inventory) **spores noen ganger ikke riktig, selv med pluginet**. Ta vare på skjermbilder underveis, og hvis en telling ser for lav ut, meld fra og send inn differansen manuelt.',
        },
        {
          term: 'Fisketønner, vedkurver og annen oppbevaring',
          body: 'Felt for item-gevinst teller bare det som havner i inventoryen din **rett fra kilden** — en fiskeplass, en stein, et tre. Alt som tas ut av oppbevaring (tømme en fisketønne, vedkurv, kull- eller edelsteinspose, urtesekk), kjøpes i en butikk, tas ut av banken eller plukkes opp fra bakken, **teller ikke**. Det holder feltet ærlig: ellers kunne samme fisk fylles i en tønne og tømmes ut igjen i det uendelige. Fangst du samler rett i en tønne eller kurv, telles ikke.',
        },
        {
          term: "Doble pets og champion's scrolls",
          body: 'Når du allerede har peten eller scrollen, sier spillet bare at du har en **«funny feeling»** — det sier aldri hvilken. Pluginen finner det ut fra hva du nettopp drepte eller trente, krediterer ruten og **flagger den for sjekk av staff**. Kan den ikke vite det sikkert — to pets fra samme kilde, eller en pet uten kill eller skill bak (Bloodhound fra en master clue, en gamblet Jad- eller Zuk-pet, Chompy chick) — lagres skjermbildet i **Saved proofs** så du kan sende det inn manuelt.',
        },
      ],
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
      { strong: '5 trinn', rest: 'på oppsettsjekklisten' },
      { strong: '7 formater', rest: 'å bygge et brett av' },
      { strong: '1 knapp', rest: 'for å synkronisere medlemslista' },
    ],
    footnote:
      'Denne veiledningen følger appen slik den er i dag. Stemmer ikke en skjerm her med det du ser på, er appen riktig og veiledningen gammel — [si fra](/feedback), så fikser vi den.',

    access: {
      title: 'Hvem kan gjøre hva',
      intro:
        'Alle logger inn med Discord — ingen passord. Den første administratoren er eieren, den som opprettet klanen; deretter forfremmer en admin folk fra **People → Staff & roles**. Rollene stabler nedover: alt en moderator kan, kan en kasserer og en admin også.',
      rows: [
        {
          term: 'Admin',
          body: 'full tilgang — event, ruter, lag, innstillinger, stab, utbetalinger. Gi den til så få som klanen tåler.',
        },
        { term: 'Treasurer', body: 'alt en moderator kan, pluss påmeldingsavgifter og utbetalinger.' },
        {
          term: 'Moderator',
          body: 'det daglige: medlemsliste, verifiseringer, bevis som skal sjekkes, ukeskonkurranser, timeplanen og klanarrangementer. Kan ikke opprette eller redigere event.',
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
        '**Settings → Finish setup** er en kort veiviser (den blir stående i menyen til du er ferdig), og dashbordet beholder en sjekkliste i fem trinn til de er ferdige: gi klanen navn, koble til Discord, last inn medlemmene dine, opprett et event, legg til ruter. Statusen regnes ut fra ekte data, så et trinn hukes først av når det virkelig er ferdig.',
      discord:
        'For Discord har du to veier, og de lar seg kombinere: gi Anvil en **bot**, så kan den opprette webhooks, synkronisere roller og kallenavn og bygge private lagkanaler; gi den én enkelt **webhook-URL**, så kan den poste kunngjøringer og ingenting annet. Start med webhooken hvis du vil være i gang på to minutter, og legg til boten når du vil ha automatikken.',
      permsNote: {
        tag: 'Botens rettigheter',
        body: 'Boten trenger _Administrer webhooks_, _Administrer roller_, _Administrer kanaler_ og _Administrer kallenavn_, og rollen dens må ligge _over_ rollene den styrer i serverens rolleliste. Ellers nekter Discord i stillhet.',
      },
      hosted:
        'På en hostet plan møtte du den skjermen én gang allerede: å legge til boten under oppsettet var måten Anvil fant ut hvilken server som er deres, så det fantes aldri en server-ID å kopiere. Den samme lenken ligger her når du vil flytte boten til en annen server.',
    },

    channels: {
      title: 'Fordel innleggene på flere kanaler',
      body: [
        'Alt postes som standard i én catch-all-kanal. Når den blir bråkete, åpne **Discord → What goes where** og gi de høylytte kategoriene egne hjem — eventposter, ukeskonkurranser, sjeldne drops, dødsfall, PvP-kills, combat achievements. Alt du lar stå tomt, faller tilbake til sin catch-all, så du kan skille ut én kategori av gangen.',
        'Med boten tilkoblet rører du aldri en webhook-URL: velg en kanal fra radens nedtrekksliste, så lagres den. Under et travelt event kan du legge til en webhook nummer to med **Add another** under **Post without a bot** — Anvil veksler mellom dem slik at Discords hastighetsgrense ikke sluker innlegg.',
      ],
      clipsNote: {
        tag: 'Klippkanalen er annerledes',
        body: 'Klippvideoer lastes opp rett fra hver spillers maskin til Discord — de passerer aldri dette nettstedet. Derfor er klipp-webhooken du setter opp her den du _deler ut_: medlemmene limer den inn selv i pluginet sitt. Alt annet på denne siden skjer på serveren, og medlemmene ser det aldri.',
      },
    },

    roster: {
      title: 'Få inn medlemslista di',
      body: [
        'Klanmedlemskap kommer fra ett sted: en synkronisering av medlemslista fra spillet. Installer [Anvils RuneLite-plugin]({pluginGuide}) på en _admins_ konto, åpne klanvinduet i spillet, og trykk **Anvil**-knappen i tittellinja. Det skyver den faktiske klanlista deres fra spillet opp til nettstedet med ett klikk.',
        'Å logge inn, koble en karakter eller spille med pluginet setter aldri noen på medlemslista. Ser pluginet noen spille i klanen deres i spillet før medlemslista har dem, oppretter det en forespørsel om å bli med; alle andre kan spørre med **Apply** på klansiden deres. Staben svarer på forespørsler øverst i **People → Roster**, og **People → Who can join** avgjør om folk venter på et ja, får en gjesteplass med en gang eller ikke kan spørre i det hele tatt. Det er med vilje: ingen blir med i klanen din ved å skrive navnet på den. Hele bildet står i [Folkene dine]({peopleGuide}).',
        'Du kan også legge til noen for hånd fra **People → + Add Manually**, og melde dem på et event på deres vegne med **Add member** på eventets **Sign-ups**-side når de ikke når nettstedet.',
      ],
    },

    board: {
      title: 'Opprett ditt første brett',
      intro:
        '**Events → All events → + New event**. Velg format først — det avgjør hvordan brettet gir poeng og hva resten av skjemaet spør deg om.',
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
        'Eventets **Board & tiles**-side er der et brett blir til en bingo. Hver rute er én _type_ oppgave, og typen avgjør hva pluginet ser etter: et drop, et boss-killcount, ferdighets-XP, et NPC-kill, en fullføring på tid, en achievement diary, en Combat Achievement, en opplåsning i collection log, et PvP-kill, en gjenstandsgevinst, eller en runde uten dødsfall. Manuelle ruter — de som et menneske godkjenner ut fra et skjermbilde — er alltid et alternativ også.',
        'For et fullt brett, skriv dem i bulk: eksporter arket, fyll det ut i et regneark, og importer det tilbake. Både CSV og .xlsx går fram og tilbake, og rader følger posisjoner, så du kan skrive om et helt 25-ruters nett med én innliming.',
      ],
      rows: [
        {
          term: 'Vanskelighetsgrader',
          body: 'poengverdier oversettes til navngitte bånd (easy → elite). Rediger båndene under **Clan settings → Rules & scoring → Difficulty & balance** hvis klanen din graderer annerledes.',
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
        'Siden **Teams & draft** tilpasser seg formatet du valgte: et format uten lag hopper rett forbi den. For en vanlig laginndelt bingo oppretter du lagene, bestemmer hvem som er kapteiner, og enten fordeler spillerne selv eller kjører en live draft.',
        'Kapteinene drafter fra påmeldingspuljen i den rekkefølgen du velger, og hver kaptein ser svarene folk ga i påmeldingsskjemaet — fryst slik de ble sendt inn, så ingen redigerer «timer per uke» etter å ha blitt valgt.',
      ],
      placementIntro:
        'Du trenger ikke å drafte. **Team placement**, på opprettingsskjemaet og fanen **Sign-ups**, bestemmer hvor hver nye påmelding havner:',
      placementRows: [
        {
          term: 'Auto-balance',
          body: 'hver person som melder seg på, havner på laget med færrest spillere. Du velger bare hvor mange lag det skal være. Bra for store, åpne eventer.',
        },
        {
          term: 'Players pick',
          body: 'du lager lagene først, og hver spiller velger ett i påmeldingsskjemaet. Sett en grense per lag for å holde dem jevne.',
        },
        {
          term: 'Host drafts',
          body: 'alle venter i en pulje til du eller kapteinene dine drafter dem eller fordeler dem for hånd. Best når du kjenner spillerne.',
        },
        {
          term: 'Solo',
          body: 'ingen lag i det hele tatt. Hver spiller er på egen hånd, oppkalt etter karakteren sin, og stillingen rangerer spillere.',
        },
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
          body: '**Post to Discord** (under **Clan** i menyen) poster en melding som boten i hvilken som helst kanal midt i eventet, uten at du skriver en webhook for hånd.',
        },
      ],
      missionNote: {
        tag: 'Overraskelser underveis',
        body: 'Du kan slippe et **oppdrag** ned på en pågående bingo — en skjult bonusrute som kunngjøres når du fyrer den av, og som eventuelt synker i verdi eller utløper. Det er den billigste måten å vekke et brett på dag fem.',
      },
      startProofNote: {
        tag: 'Å stoppe hamstring før eventet',
        body: [
          'Slå på **Starting shot** (eventet → Home → **Extras**), så må hver spiller levere ett skjermbilde tatt etter at eventet har startet, på et sted Anvil trekker i selve startøyeblikket — så ingen sitter på en uke med oppsparte clues og kister ved null. Stedet kunngjøres ved starten; hver spillers passord er personlig, avledet av trekningen, og finnes ikke før eventet starter, så det kan ikke settes opp på forhånd av noen.',
          'Fest stedene på verdenskartet (puljeredigereren har ett), så sjekker pluginet at spillerne faktisk står der i stedet for bare å ha fått beskjed. Du kan også kreve en **fersk økt** — 15 minutter som standard: hiscores lagres bare når en spiller logger ut, så å få alle til å logge inn på nytt rett før bildet sitt er det som gjør starttallene bak hver XP- og KC-rute ærlige.',
          'Pluginbrukere trykker på én knapp. Alle andre skriver passordet sitt i spillet og laster opp på My Team. Du velger hva som skjer med en kreditering fra noen som ikke har levert: flagg den for gjennomgang (standard), eller nekt den til de gjør det. Det samme panelet på eventets Home er gjennomgangslista — pluginbilder med verifisert passord kommer inn allerede godkjent, så i praksis ser du bare på mobilspillerne.',
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
          body: 'eventets **Prizes**-side gjør premiepotten om til en liste over hvem som får hva, som hukes av mens du betaler ut.',
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
          body: 'behold brettet du nettopp bygde, fra eventets **Settings → More**. Neste bingo starter fra det i stedet for et tomt rutenett.',
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
        'Åpne eventet ditt og gå til siden **Teams & draft**. Opprett ett lag per klan du har invitert, og kall det opp etter dem — navnet er det spillerne deres ser i påmeldingsskjemaet, så “Ironforge” slår “Lag 2”.',
        'Du trenger _ikke_ å kjøre en draft. Invitasjonslenker og en draft er alternativer: en draft fordeler en felles påmeldingspulje, en lenke setter folk direkte på plass. På en ren klan-mot-klan oppretter de fleste verter lagene, deler ut én lenke hver, og åpner aldri draften.',
        'Åpne så selve laget — **Teams & draft → laget** — for det er der begge de to neste trinnene skjer.',
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
        caption: 'Eventet → Teams & draft → laget → Team staff',
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
        caption: 'Eventet → Teams & draft → laget → Invite links',
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
        kill: { label: 'Kills', blurb: 'N kills av hvilken som helst boss eller monster. Talt fra hiscores når hvert monster i ruten står der, ellers av pluginet mens du spiller (høner, kuer, Slayer-monstre).' },
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
          term: 'En boss-liste pluss ett monster utenfor hiscores',
          body: 'er en plugin-rute for **alt sammen**. En Kills-rute telles bare fra hiscores når hvert monster i den står der; legg en høne til fire GWD-bosser, og hele ruten trenger pluginet. Spiller en del av klanen uten, gi hiscores-bossene en egen rute.',
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
        '**Download spreadsheet** på eventets **Board & tiles**-side. Du får en .xlsx av brettet slik det er nå, med nedtrekkslister, gjenstandslista og kolonneveiledningen på hvert sitt ark.',
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
        'På et poengbasert brett har hver rute sin egen verdi, og de verdiene oversettes til navngitte vanskelighetsbånd — easy til elite — som du kan redigere under **Rules & scoring** hvis klanen din graderer annerledes. Båndet er det spillerne leser; tallet er det som teller.',
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
      'Formatet settes ved opprettelsen, men kan endres etterpå fra eventets Settings → Event-fane; avsløringspolitikken og poengmodifikatorene kan endres når som helst før rutene de påvirker, blir avslørt.',

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
      'Avgifter og utbetalinger er kassererens flate. En kasserer kan alt en moderator kan, pluss dette; en vanlig moderator ser ikke avgiftssidene i det hele tatt.',

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
        {
          term: 'Gjesteavgift',
          body: 'det spillere betaler når de ikke er medlem av en klan som kjører brettet. La det stå tomt, så betaler gjester medlemsavgiften. Skal én spiller betale et annet beløp, trykker du **Change this player’s fee** på raden til spilleren i **Sign-ups**.',
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
        'Purring er én knapp: **Remind unpaid** under Admin → **Fees** sender en Discord-DM til alle i det eventet som fortsatt skylder.',
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
        'Hvor mange signaturer en avgift krever, er en klaninnstilling (**Clan settings → Rules & scoring → Fee sign-off**), fra null til fem. Null finnes av en reell grunn: i en klan der kassereren _er_ eieren, finnes det ingen andre til å skrive under, og «34 avgifter venter på en andre signatur» blir en kø som aldri kan tømmes, og permanent det høyeste på dashbordet. Ved null **er** det å markere en avgift betalt selve underskriften.',
        'Sett den til én — standarden — hvis dere er to. Sett den til null hvis dere ærlig talt ikke er det, og sett den høyere bare hvis klanen din har både folkene og grunnen.',
      ],
    },

    pay: {
      title: 'Å betale ut',
      body: [
        'Når eventet er over, gjør eventets **Prizes**-side potten om til en liste over mennesker. Generer den, så får du én rad per mottaker, ikke per lag: et vinnende lags premie deles likt mellom medlemmene, slik at utbetalingen blir en liste med navn og tall heller enn et regnestykke ved midnatt.',
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

  coffer: {
    metaTitle: 'Klankassa — Anvil-veiledning for kasserere',
    metaDescription:
      'Klanens gp-kasse i Anvil: å registrere donasjoner og gi æren til dem som ga dem, de tre måtene en premie blir betalt på, hvem som får flytte pengene, og hva som skjer når kassa er for liten.',
    eyebrow: 'Anvil · for kasserere',
    title: 'Klankassa',
    dek: 'De fleste klaner har gp-en sin i én persons bank og regnskapet i én persons hukommelse. Kassa er én pott med en linje for hver bevegelse — hvem som ga den, hva den er lovet bort til, og hvem som faktisk sendte den.',
    facts: [
      { strong: '3 tall', rest: 'i kassa, lovet bort, fritt å love bort' },
      { strong: '3 veier ut', rest: 'ukekonkurranser, oppdragsruter, en tavles pott' },
      { strong: 'Kasserer', rest: 'eller admin — aldri rang alene' },
    ],
    footnote:
      'Alt her ligger under Admin → **Coffer**, bortsett fra premiestigene, som ligger på det som betales for. Den offentlige halvdelen er `/coffer`: saldoen, de største giverne og de siste bevegelsene, for medlemmene.',

    what: {
      title: 'Hva den er',
      body: [
        'Et regnskap, ikke en lommebok. Anvil sitter aldri på gp-en deres — den blir der klanen allerede har den — så kassa er notatet over hva som kom inn, hva som er lovet bort og hva som faktisk er levert. Nytten er at løftet og betalingen er to forskjellige linjer.',
        'Siden starter med tre tall, og de er tre fordi de svarer på tre forskjellige spørsmål:',
      ],
      rows: [
        {
          term: 'I kassa',
          body: 'godkjente donasjoner og justeringer. Hva klanen har fått, minus hva den har skrevet av.',
        },
        {
          term: 'Lovet bort',
          body: 'gp en premie har gjort krav på — vunnet, men ikke sendt ennå, pluss en pott satt av til en tavle. Disponert, selv om det fortsatt står i noens bank.',
        },
        {
          term: 'Fritt å love bort',
          body: 'i kassa minus lovet bort. Det eneste tallet en ny premie blir målt mot, for alternativet er å love de samme 50m til to vinnere mens kassereren sover.',
        },
      ],
      note: {
        tag: 'En ventende donasjon teller ingen steder',
        body: 'At noen skriver "jeg ga 100m" er en påstand om fortiden, ikke gp i en bank. Den står utenfor alle tre tallene til staben anerkjenner den, så den kan aldri finansiere en premie som etterpå ikke kan betales.',
      },
    },

    inbound: {
      title: 'Å få gp inn',
      body: [
        'RuneLite-pluginet tar seg av den vanlige veien automatisk: åpne Clan Coffer i spillet, så registrerer Anvil innskudd og uttak ut fra den faktiske myntsaldoen. Den første titten er bare et utgangspunkt — den later aldri som om den som åpnet kassa, donerte alt som allerede lå i den.',
        'Manuelle registreringer finnes fortsatt for alt som skjedde mens ingen hadde pluginet åpent. Et medlem melder inn sin egen donasjon fra `/coffer`, og den venter på at staben skal tro på den; en kasserer registrerer en som allerede er kommet, og at hen taster den **er** godkjenningen.',
        'Uansett blir den kreditert en **person**. Det betyr mer enn det høres ut som: listen over de største giverne på den offentlige siden er den eneste takken de fleste givere får, og gp som kommer inn som "klanen" takker ingen.',
      ],
      rows: [
        {
          term: 'Åpne kassa i spillet',
          body: 'med Anvil aktivert og pålogget (Profile sync → **Sync Clan Coffer** er på som standard). En samsvarende spillmelding krediterer ditt eget innskudd eller uttak til deg; endringer som blir sett etter et opphold, blir avstemt uten å navngi den som så dem. Admin → Coffer viser det siste fysiske beløpet og når det ble sett.',
        },
        {
          term: 'Et medlem melder inn en',
          body: 'fra den offentlige kassesiden, med et skjermbilde hvis de har et. Den lander som ventende og dukker opp i køen din. Å godkjenne den er det som gjør den til ekte penger.',
        },
        {
          term: 'Du registrerer en',
          body: 'Admin → Coffer → **Record a donation**. Søk i medlemslisten etter hvem som ga den, sett et beløp ved siden av navnet, ferdig. Gjester kan også krediteres — en som ikke er fullt medlem kan godt ha betalt inn.',
        },
        {
          term: 'Flere sammen',
          body: 'velg alle, skriv totalen og trykk **Split … ways**, og juster så en enkelt andel for hånd. Det skriver én linje hver i stedet for én linje med en liste, så hver av dem står i giverlisten under sitt eget navn.',
        },
      ],
      note: {
        tag: 'En justering er noe annet',
        body: '**Correct the pot** er for gp som har flyttet seg utenom alt dette — å fylle opp kassa, å bruke den på noe Anvil aldri så, å rette en feil. Den tilhører med vilje ingen, og den er bevisst ikke måten å registrere en gave på.',
      },
    },

    out: {
      title: 'De tre måtene den betaler ut',
      intro: 'Hver eneste premie i Anvil kommer fra denne ene potten, og hver vei avgjør vinnerne på sin egen måte. Sett stigen der det som vinnes hører hjemme — kassa spør aldri hvem som vant noe.',
      rows: [
        {
          term: 'En ukekonkurranse, på sin egen side',
          body: 'en Skill eller Boss of the Week har en plasseringsstige: første får dette, andre får hint. Den gjøres opp **én gang** når konkurransen slutter, ut fra sluttstillingen — ingenting skifter hender underveis. Sett den mens du oppretter konkurransen, eller senere fra konkurransens egen side.',
        },
        {
          term: 'En oppdragsrute, på tavla',
          body: 'oppdrag betaler i den rekkefølgen folk blir ferdige, så stigen deres blir gjort krav på snarere enn gjort opp: det første laget som klarer den, tar førsteplassens gp. Settes i rutens rewards-del, på enhver tavle som tillater oppdrag.',
        },
        {
          term: 'En tavles premiepott',
          body: 'en bingo fordeler selv potten sin på plasseringer, så kassa rekker den bare ett tall. Event → **Prizes** → *From the clan coffer*. Det legges til påmeldingsavgiftene og det du selv har lagt oppå, og fordelingen på plasser settes på samme side. Du velger også om kassa **holder** de gp-ene med en gang eller bare noterer løftet — de har jo ikke forlatt kassa ennå, og et brett om seks uker trenger ikke halve potten låst til da.',
        },
      ],
      note: {
        tag: 'Når folk ender likt',
        body: 'En ukestige kan **dele ved likhet**: alle som er like, slår sammen plassene de opptar og tar en lik del, så tre på 40 kc hver tar en tredjedel av første, andre og tredje i stedet for at den første av dem tar alt. La den stå av, og tavlas egen rekkefølge avgjør. Begge deler kan forsvares — å bestemme det etter at resultatene er inne, kan ikke.',
      },
    },

    who: {
      title: 'Hvem som får flytte den',
      intro: 'Penger er sin egen tillatelse, ikke en rang. En moderator kan godkjenne en innsending og aldri røre kassa, og det er med vilje snarere enn en forglemmelse.',
      rows: [
        {
          term: 'Kasserer eller admin',
          body: 'hele regnskapet: registrere og godkjenne donasjoner, justere kassa, sette premiestiger, markere en premie som sendt. Eieren teller som admin her.',
        },
        {
          term: 'En moderator',
          body: 'ingenting av det. De ser ikke kassesiden i det hele tatt — å samle inn penger er kassererens jobb, og rang alene har aldri gitt rett til det.',
        },
        {
          term: 'En tavlekasserer',
          body: 'ett events penger: avgiftene, utbetalingene, premiepotten. Gis per tavle, som er måten en gjesteklan kjører sin egen halvdel av en klan-mot-klan uten å få regnskapet deres i hendene. De kan ikke røre klankassa.',
        },
        {
          term: 'Ethvert medlem',
          body: 'kan melde inn en donasjon og lese den offentlige siden. Det er hele listen.',
        },
      ],
      note: {
        tag: 'Fortell klanen det, i en kanal',
        body: 'Pek **Coffer ledger** mot en Discord-kanal under Admin → Discord → What goes where → **Staff only**, så blir hver bevegelse lagt ut med saldoen den etterlater. Det er den ene strømmen uten reserveløsning: la den stå tom, og ingenting om pengene blir lagt ut noe sted. Se [Anvil i Discord]({discordGuide}).',
      },
    },

    short: {
      title: 'Når potten er for liten',
      body: [
        'En premie som er større enn kassa, blir ikke avvist. Den blir ført som **skyldig og udekket** — en ekte linje med en vinners navn på — for alternativet er en vinner uten noe og uten spor av at noe noen gang ble lovet.',
        'Så løsningen er den vanlige: skaff gp inn, og betal så. Det du ikke skal, er å endre stigen i stillhet etterpå; regnskapet sier allerede hva som ble annonsert, og at de to er uenige er verre enn å mangle penger.',
      ],
      note: {
        tag: 'Anvil sender ingenting',
        body: 'Hver premie ender med at et menneske rekker over gp i spillet og krysser av en linje. Regnskapets jobb er å sørge for at linjen finnes, at den sier hvem og hvor mye, og at ingen en uke senere må grave det fram fra Discord-historikken.',
      },
    },
  },

  commands: {
    metaTitle: 'Slash-kommandoer i Discord — Anvil',
    metaDescription:
      'Alle Anvils slash-kommandoer — /bingo, /sotw, /botw, /eff, /coffer, /stats og /guide — med hvert alternativ forklart, eksempler, hvem som kan bruke hva, og løsninger når kommandoer ikke dukker opp.',
    eyebrow: 'Anvil · i Discord',
    title: 'Slash-kommandoer',
    dek: 'Skriv `/` i klanens Discord, så svarer Anvil fra det levende nettstedet: brettet, stillingen, ditt eget kort, ukekonkurransene, kassa og hvem som helst sine stats. Denne siden er hele listen, generert fra kommandoene boten faktisk registrerer, så den er aldri utdatert.',
    facts: [
      { strong: 'Privat', rest: 'svar bare du ser, med en Share-knapp' },
      { strong: 'Ditt språk', rest: 'det Discord-en din er satt til' },
      { strong: 'Bare lesing', rest: 'unntatt /coffer add og remove' },
    ],
    footnote:
      'Å sette opp boten i utgangspunktet står i [Discord-veiledningen](/guide/discord). Denne siden handler om å bruke den.',

    using: {
      title: 'Slik virker en kommando',
      body: [
        'Skriv `/` i en hvilken som helst kanal boten kan se, og velg en Anvil-kommando fra listen. Discord viser så alternativene som felt du fyller inn: trykk Tab eller klikk på et for å legge det til. Alternativer skrevet som `<angle brackets>` nedenfor er påkrevd; de skrevet som `[square brackets]` er valgfrie, og du kan utelate dem.',
        'Hvert svar er **privat**: bare du ser det, så å sjekke brettet ti ganger om dagen plager ingen. Er det verdt å vise kanalen, trykk **Share to channel** under svaret. Den delte kopien bygges i det øyeblikket, så en stilling som deles senere, er stillingen slik den er da.',
      ],
      rows: [
        { term: 'Påkrevd', body: '`<amount>` — Discord sender ikke kommandoen før det er fylt inn.' },
        { term: 'Valgfritt', body: '`[member]` — utelat det, så svarer kommandoen om deg, laget ditt eller hele klanen.' },
        { term: 'En liste', body: 'velg en av verdiene Discord tilbyr; du kan ikke skrive din egen.' },
        { term: 'Skriv for å søke', body: 'begynn å skrive og velg blant forslagene, for eksempel bossnavn eller dine egne kontoer.' },
        { term: 'Et medlem', body: 'velg noen fra serveren, akkurat som med en @mention.' },
      ],
      note: {
        tag: 'Kommandoene virker bare på klanens server',
        body: 'Hvert svar handler om én klan, og en DM har ingen klan å svare om. Derfor dukker ikke kommandoene opp i DM-er.',
      },
    },

    bingo: {
      title: 'Brettkommandoer: /bingo',
      intro:
        '`/bingo` handler om ett brett. Når flere brett går, lister **board** og **leaderboard** opp alle; resten svarer om brettet som går, deretter det neste som starter, deretter det som nettopp er ferdig.',
    },

    clan: {
      title: 'Klankommandoer',
      intro:
        'Disse svarer om klanen i stedet for et brett, så de virker uansett om en bingo går: ukekonkurransene, effektivitet, kassa, hvem som helst sine stats og oppsettsveiledningene.',
    },

    options: {
      title: 'Alternativer du ser overalt',
      intro: 'Noen få alternativer betyr det samme på hver kommando som har dem:',
      rows: [
        {
          term: '`member`',
          body: 'noen andre på serveren. Utelat det for å spørre om deg selv. Det finner Anvil-kontoen deres via Discord-innloggingen de brukte på nettstedet, så det virker bare for medlemmer som har logget inn på Anvil én gang.',
        },
        {
          term: '`account`',
          body: 'hvilken av personens OSRS-kontoer, for folk med alts. Skriv for å velge; utelat det for main-en deres.',
        },
        {
          term: '`page`',
          body: 'en boss eller aktivitet, søkbar ved å skrive: `Zulrah`, `Theatre of Blood`, `Tempoross`. Utelat det for helhetsbildet.',
        },
        {
          term: '`language`',
          body: 'svar denne ene gangen på et annet språk. Som standard får du språket Discord-en din er satt til, eller klanens valgte botspråk.',
        },
        {
          term: '`amount`',
          body: 'gp på den enkle måten: `5m`, `2.5b`, `500k`, eller et vanlig tall som `2,500,000`.',
        },
      ],
    },

    who: {
      title: 'Hvem som kan bruke hva',
      body: [
        'Alle på serveren kan kjøre alle kommandoene som bare leser. Det du ser, er det et medlem ville sett: et brett med ruter som ikke er avslørt ennå, forblir skjult i Discord også, selv for staben.',
        'Kommandoer som svarer om **deg** (`/bingo me`, `/stats` uten member) må vite hvilken Anvil-konto som er din. De finner den via Discord-innloggingen du brukte på nettstedet, så logg inn på Anvil med Discord én gang, så virker de fra da av.',
      ],
      rows: [
        { term: 'Alle', body: 'alle kommandoer unntatt `/coffer add` og `/coffer remove`.' },
        {
          term: 'Kasserere, admins, eiere',
          body: '`/coffer add` og `/coffer remove`. Sjekkes mot rollen din **på Anvil-nettstedet**, aldri Discord-rollen din, fordi en rang på en chatteserver aldri har betydd kontroll over klanens penger.',
        },
      ],
    },

    trouble: {
      title: 'Når en kommando ikke virker',
      intro: 'De vanlige årsakene, omtrent i den rekkefølgen de skjer:',
      rows: [
        {
          term: 'Ingen Anvil-kommandoer i listen',
          body: 'boten ble invitert uten kommandoene sine — det er en separat rettighet, og eldre invitasjonslenker ba bare om den ene. En admin kjører **Invite / re-invite the bot** på nytt fra Admin → Discord → **Connection**. Det kaster ikke ut boten og nullstiller ingenting. Nylig lagt til kommandoer kan bruke opptil en time på å dukke opp.',
        },
        {
          term: '"The application did not respond"',
          body: 'Anvil var kortvarig utilgjengelig, som regel midt i en oppdatering. Kjør den igjen noen sekunder senere.',
        },
        {
          term: '"Ikke med på dette brettet" om deg selv',
          body: 'enten har du ikke meldt deg på dette brettet, eller så klarer ikke Anvil å koble Discord-en din til kontoen din. Logg inn på nettstedet med denne Discord-kontoen og sjekk profilen din.',
        },
        {
          term: 'Et medlems stats kommer tomme tilbake',
          body: 'de har ikke logget inn på Anvil med Discord ennå, eller så er ikke hiscores for kontoen deres lest inn ennå. Prøv igjen med alternativet `account`, eller be dem logge inn én gang.',
        },
        {
          term: '`/coffer add` sier at du ikke får lov',
          body: 'rollen din på Anvil-nettstedet er ikke kasserer, admin eller eier, eller så er ikke denne Discord-en kontoen du logger inn på nettstedet med.',
        },
      ],
    },

    labels: {
      options: 'Alternativer',
      noOptions: 'Ingen alternativer — bare kjør den.',
      example: 'Eksempel',
      examples: 'Eksempler',
      required: 'påkrevd',
      optional: 'valgfritt',
      choices: 'Valg',
      range: 'fra {min} til {max}',
      kinds: {
        text: 'tekst',
        number: 'tall',
        member: 'et medlem',
        choice: 'velg fra en liste',
        search: 'skriv for å søke',
        yesno: 'ja eller nei',
      },
    },

    examples: {
      'bingo board': {
        examples: ['/bingo board'],
        tip: 'Brettet som går akkurat nå. Til brettet er avslørt, forblir rutenavnene skjult her også.',
      },
      'bingo leaderboard': {
        examples: ['/bingo leaderboard'],
        tip: 'Lagenes stilling, med poeng eller ruter avhengig av hvordan brettet teller.',
      },
      'bingo rules': {
        examples: ['/bingo rules'],
        tip: 'Hvordan dette brettet teller (lest rett fra selve eventet, så det stemmer alltid), og deretter klanens egne husregler.',
      },
      'bingo apply': {
        examples: ['/bingo apply'],
        tip: 'Hvordan du blir med: påmelding, avgiften, og hvor din egen påmelding står.',
      },
      'bingo next': {
        examples: ['/bingo next'],
        tip: 'Hva som kommer nå: en ruteavsløring, et oppdrag eller en frist.',
      },
      'bingo me': {
        examples: ['/bingo me'],
        tip: 'Laget ditt, plasseringen din og rutene som er kreditert deg.',
      },
      'bingo help': {
        examples: ['/bingo help'],
        tip: 'En kort liste over hva boten svarer på, inne i Discord.',
      },
      'bingo team': {
        examples: ['/bingo team', '/bingo team name:Iron Wolves'],
        tip: 'Et lags kort: poeng, lagoppstilling og siste ruter. Utelat navnet for ditt eget lag.',
      },
      sotw: {
        examples: ['/sotw', '/sotw language:Deutsch'],
        tip: 'Hver aktive Skill of the Week, toppen av hver, og hvor du ligger.',
      },
      botw: {
        examples: ['/botw'],
        tip: 'Hver aktive Boss of the Week og den aktuelle stillingen.',
      },
      eff: {
        examples: ['/eff', '/eff metric:EHB'],
        tip: 'Klanens effektivitetsliste og plasseringen din på den. EHP (efficient hours played) som standard; velg EHB for bossing.',
      },
      'coffer balance': {
        examples: ['/coffer balance'],
        tip: 'Kassas saldo, de største giverne og de siste bevegelsene.',
      },
      'coffer add': {
        examples: ['/coffer add amount:5m', '/coffer add amount:250k note:Raffle proceeds'],
        tip: 'Bare kasserere, admins og eiere. Registrerer gp som kommer inn; det blir også lagt ut i kassas feed-kanal.',
      },
      'coffer remove': {
        examples: ['/coffer remove amount:20m note:SOTW prize'],
        tip: 'Bare kasserere, admins og eiere. Nekter å ta kassa under null; registrer det på kassesiden hvis du mener det.',
      },
      'stats profile': {
        examples: ['/stats profile', '/stats profile player:Zezima'],
        tip: 'Én konto i et blikk: combat- og totalnivå, EHP og EHB, antall i collection log og personlige rekorder.',
      },
      'stats levels': {
        examples: ['/stats levels', '/stats levels player:My Iron'],
        tip: 'Hver skills nivå og XP.',
      },
      'stats efficiency': {
        examples: ['/stats efficiency'],
        tip: 'EHP og EHB, og hvilke skills og bosser de kommer fra.',
      },
      'stats clog': {
        examples: ['/stats clog', '/stats clog page:Zulrah'],
        tip: 'Framgang i collection log totalt, eller siden for én boss.',
      },
      'stats pbs': {
        examples: ['/stats pbs', '/stats pbs page:Theatre of Blood mode:Hard size:3'],
        tip: 'Personlige rekorder. Raids lagrer en tid per mode og lagstørrelse, så bruk `mode` og `size` for å finne runden du mener.',
      },
      'stats luck': {
        examples: ['/stats luck', '/stats luck player:Zezima'],
        tip: 'Hvor heldig kontoen har vært på tvers av dropsene Anvil følger med på.',
      },
      'stats collectors': {
        examples: ['/stats collectors'],
        tip: 'Klanens største collection logs.',
      },
      'stats luckboard': {
        examples: ['/stats luckboard'],
        tip: 'Klanens mest uheldige og mest heldige medlemmer.',
      },
      setup: {
        examples: ['/setup topic:Plugin setup', '/setup topic:Plugin setup step:5'],
        tip: 'En oppsettsveiledning inne i Discord: listen over trinn, eller ett trinn med en lenke rett til det på nettstedet.',
      },
      guide: {
        examples: ['/guide guide:ToB 4-man gear'],
        tip: 'En av klanens spillguider (raids, bossing, money making…): begynn å skrive navnet og velg den fra listen.',
      },
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
        'medlemslista: å legge til og fjerne folk, og svare på forespørsler om å bli med ([Folkene dine]({peopleGuide}))',
        'kontoverifiseringer — XP-utfordringen og manuell gjennomgang',
        'innsendinger og bevisskjermbilder',
        'ukeskonkurranser og timeplanen',
        'arrangementer i klankalenderen',
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
          body: 'etter den første eierskapssjekken gjenkjenner pluginet kontoen automatisk, og et stabilt fingeravtrykk beholder koblingen ved navnebytter. En listekonto uten kjent fingeravtrykk bruker XP-sjekk eller moderatorgodkjenning én gang.',
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
        body: 'Å verifisere en konto sier «denne er virkelig deres». Det gjør dem ikke til en del av klanen. Medlemskap kommer bare fra en synkronisering av medlemslista i spillet eller fra staben som legger dem til for hånd, og en gjesteplass bare fra en forespørsel om å bli med som staben godkjenner (eller med en gang, hvis klanen slipper inn alle). Det er med vilje, og det er det som hindrer noen i å bli med i klanen din ved å skrive et navn.',
      },
    },

    roster: {
      title: 'Å holde medlemslista ærlig',
      body: [
        'Medlemslista kommer fra ett sted: en admin kjører en synkronisering fra klanlista i spillet, med **Anvil**-knappen i tittellinjen på klanvinduet (eller **Sync roster** i pluginnets sidepanel). Alt annet — verifiseringer, koblinger, påmeldinger — henger på den.',
        'Vedlikeholdsjobben er altså liten, men reell: be en admin kjøre synkroniseringen etter hver rekrutteringsrunde (den gjør gjester som har blitt med i spillet, til medlemmer), svar på forespørslene om å bli med øverst i **Roster**-fanen, og jobb deg gjennom **Needs review** i stedet for å vente på at folk klager. Se [Folkene dine]({peopleGuide}).',
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

  tiles: {
    metaTitle: 'Ruteregler og begrensninger — Anvil',
    metaDescription:
      'Hva hver type bingorute krever av deg (spillinnstillinger, RuneLite-pluginet, en synkronisert collection log, en hiscores-plassering) og grensene for hva den kan spore.',
    eyebrow: 'Anvil · for spillere',
    title: 'Ruteregler og begrensninger',
    dek: 'Hver rute viser hva den krever av deg og hva den ikke får til. Denne siden forklarer hver linje; rutens **Why?**-lenker havner her.',
    needs: 'Krever',
    limit: 'Greit å vite',
    checked: 'Ruten sjekker dette for deg',
    englishOnly: 'Reglene nedenfor er på engelsk inntil videre, så de alltid stemmer med det nettstedet faktisk gjør.',
  },

  // /guide/creators — vertens veiledning for et creator-rom (lib/creatorSpaces). Skrevet for en som
  // aldri har brukt Anvil og ikke har noen klan. Grenser og fordeler følger lib/creatorCatalog.
  creators: {
    metaTitle: 'Hold en OSRS-bingo for seerne dine — Anvil',
    metaDescription:
      'Kjør en Old School RuneScape-bingo eller rute-løp for streamen din uten klan: lag et rom, del én lenke, velg hvem som får være med (Twitch, Kick, YouTube eller Discord), og vis brettet på stream med OBS.',
    eyebrow: 'For streamere og creators',
    title: 'Hold events for seerne dine',
    dek: 'Med et creator-rom kan du kjøre en bingo for streamen din. Du trenger ikke en klan i spillet. Du lager ett event, deler én lenke, og seerne dine blir med.',
    facts: [
      { strong: 'Ingen klan', rest: 'nødvendig' },
      { strong: 'Gratis', rest: 'å starte' },
      { strong: 'Én lenke', rest: 'til chatten din' },
    ],

    what: {
      title: 'Hva et creator-rom er',
      body: [
        'Det er din egen side på Anvil, på `{apex}/c/ditt-navn`. Der kjører du events for seerne dine.',
        'Det er ikke en klan. Det finnes ingen klanliste, ingen rangeringer og ingen ukentlige konkurranser. Den som blir med i eventet ditt, spiller det eventet. Ikke noe annet.',
        'Seerne logger inn med Discord, legger til RuneScape-karakteren sin og trykker **Join**. Anvil RuneLite-pluginet teller så dropsene deres av seg selv.',
      ],
    },

    create: {
      title: 'Lag rommet ditt',
      body: [
        'Gå til [{apex}/host](/host) og logg inn med Discord.',
        'Skriv et navn på rommet ditt. Navnet på kanalen din er et godt valg. Lenken din lages av navnet. Trykk **change link** hvis du vil ha en annen.',
        'Trykk **Create my space**. Du får ett rom per Discord-konto.',
      ],
    },

    first: {
      title: 'Lag ditt første event',
      body: [
        'Rett etter at du har laget rommet, havner du på **Create your first event**. Senere bruker du **+ New event** øverst under **Your events**.',
        '**Name.** Det seerne dine ser.',
        '**What kind?** Velg et kort. **Team bingo** er et 5×5-rutenett, og Anvil deler spillerne i lag for deg. **Solo bingo** er det samme rutenettet, hver spiller for seg selv. **Team race** er oppgaver i rekkefølge: laget som har kommet lengst, vinner.',
        '**Ready-made tiles** gir deg en blanding av lette til vanskelige oppgaver du kan endre senere. **Blank, I’ll write my own** starter tomt.',
        '**Who can join?** La den stå på **Anyone**, eller velg hvem som får være med. Se trinn 5.',
        '**When?** Velg start- og sluttdato. Eller la feltet stå tomt og start eventet selv når du er klar.',
        'Trykk **Create event**. Trykk så **Copy invite link**.',
      ],
    },

    share: {
      title: 'Del lenken',
      body: [
        'Lim invitasjonslenken inn i stream-chatten din, Discord eller sosiale medier. Den lenken er alt seerne dine trenger.',
        'Du kan kopiere den igjen når som helst: **Your events** → **Copy invite link** ved siden av eventet.',
        'Vil du at boten skal svare på `!join` i chatten med lenken? Se trinn 9.',
      ],
    },

    who: {
      title: 'Velg hvem som får være med',
      body: [
        'Hvert event starter åpent for **Anyone**. Vil du holde det for fellesskapet ditt, åpner du eventets **Settings** → **Viewers** → **Who can join?** og velger ett eller flere alternativer. De samme valgene finnes på skjermen for det første eventet.',
        'Velger du mer enn ett, **holder det med ett av dem**. En følger ELLER en server-booster kommer inn.',
      ],
      intro: 'Hvert valg, og hva en seer må gjøre:',
      rows: [
        {
          term: 'Anyone',
          body: 'Alle med lenken kommer rett inn.',
        },
        {
          term: 'Twitch followers',
          body: 'Seeren trykker **Link Twitch** på event-siden og logger inn med Twitch. Anvil sjekker at de følger deg.',
        },
        {
          term: 'Twitch subs',
          body: 'Som følgere, men de må være subscribed. Velg laveste nivå: **Tier 1 or higher**, **Tier 2 or higher** eller **Tier 3**. Prime-subs teller som tier 1. Kanalen din må være Twitch-affiliate eller -partner.',
        },
        {
          term: 'Kick followers',
          body: 'Kick forteller ikke apper hvem som følger deg, så Anvil teller folk som følger _etter_ at du kobler til Kick. Fulgte de før? Da må seeren fjerne følgen og følge på nytt. Er Kick-chatten din bare for følgere? Slå på **My Kick chat is followers-only** i boksen **Kick channel**. Da teller en seer som skriver Anvil-koden sin i chatten din, som følger.',
        },
        {
          term: 'Kick subs',
          body: 'Subs som Anvil så etter at du koblet til Kick, teller av seg selv. Alle andre trykker **Get Kick code** og skriver koden (den ser ut som `ANVIL-7F3K9Q`) i Kick-chatten din, og Anvil ser sub-merket deres. Kick har ingen sub-nivåer.',
        },
        {
          term: 'YouTube subscribers',
          body: 'Seeren trykker **Check my YouTube subscription** og logger inn med Google. Abonnementene deres må være offentlige på YouTube.',
        },
        {
          term: 'YouTube members',
          body: 'Seeren skriver Anvil-koden sin i YouTube live-chatten din. Medlemmer kan derfor bare bli med **mens du er live**.',
        },
        {
          term: 'Discord role',
          body: 'Folk med en rolle du velger i Discord-serveren din (opptil 5 roller). Koble til serveren først: **Discord (optional)** i menyen.',
        },
        {
          term: 'Server boosters',
          body: 'Folk som booster Discord-serveren din. Krever også at serveren er koblet til.',
        },
      ],
      note: {
        tag: 'Greit å vite',
        body: 'Koble til kanalen din først (trinn 7), ellers er valgene for Twitch, Kick og YouTube grået ut. Én Twitch-, Kick- eller YouTube-konto kan bare få inn én spiller i hvert event. Staben din og folk du inviterer ved navn, hopper over sjekkene.',
      },
    },

    approve: {
      title: 'Si ja til hver spiller (valgfritt)',
      body: [
        'Vil du velge hvem som spiller? Åpne eventets **Settings** → **Viewers** → **Who can enter** og velg **Ask me about everyone**. Trykk **Save changes**.',
        'Nå trykker seerne **Ask to join** i stedet for **Join**. De må fortsatt bestå **Who can join?**-valgene dine først.',
        'Forespørslene deres vises på **Your events** som **N waiting for you**. Klikk på den, eller åpne fanen **Sign-ups** i eventet. Listen øverst heter **Waiting for your yes**. Godta eller avslå hver enkelt.',
      ],
    },

    channels: {
      title: 'Koble til Twitch, Kick eller YouTube',
      body: [
        'Åpne **Settings** i menyen. I boksen **Twitch channel**, **YouTube channel** eller **Kick channel** trykker du **Connect Twitch**, **Connect YouTube** eller **Connect Kick** og logger inn som kanalen din.',
        'Hver kanal du kobler til, vises på siden din som en **verified** lenke. Du kan ikke skrive inn en lenke for hånd: å logge inn er måten Anvil vet at kanalen er din.',
        'En kanal kan bare være koblet til ett sted på Anvil. Hvis den allerede ligger på et annet rom eller en annen klan du styrer, spør Anvil om du vil flytte den.',
      ],
    },

    overlay: {
      title: 'Vis brettet på stream (OBS)',
      body: [
        'På **Your events** trykker du **Stream overlay** ved siden av eventet, og så **Make overlay links**.',
        'Du får tre lenker. **Standings**: de beste lagene og hvor langt de har kommet. **Feed**: de siste dropsene og ferdige ruter. **Board**: brettet, med ferdige ruter markert.',
        'Velg en **Text size** (S, M, L eller XL) før du kopierer. Trykk så **Copy** ved siden av den du vil ha.',
      ],
      stepsTitle: 'Legg det inn i OBS',
      steps: [
        'Trykk **+** under **Sources** i OBS og velg **Browser**.',
        'Lim lenken inn i **URL**.',
        'Velg en størrelse, for eksempel 800 × 600. La **Custom CSS** stå tom.',
        'Trykk **OK**. Det oppdaterer seg selv hvert par sekunder.',
      ],
      tipsTag: 'Greit å vite',
      tips: [
        'Legg til `&limit=10`, `&title=0` eller `&align=right` på slutten av en lenke for å endre den.',
        'Overlayet viser det samme som den offentlige event-siden din. Skjulte stillinger og skjulte ruter forblir også skjult på stream.',
        '**Reset link** lager nye lenker og stopper de gamle. Bruk det hvis en lenke lekker. Du må lime de nye lenkene inn i OBS på nytt.',
        'Et lite “Anvil”-merke sitter i hjørnet. Med Gold-planen kan du skjule det under **Settings** → **Anvil mark on your overlay**.',
      ],
    },

    chatjoin: {
      title: '!join i chatten din',
      body: [
        'Åpne **Settings** → **!join in Twitch chat** og slå det på.',
        'Når en seer skriver `!join`, svarer Anvil-boten (Anvil_OSRS) med lenken til det åpne eventet ditt. Den svarer høyst én gang hvert 30. sekund, uansett hvor mange som skriver det.',
        'Den svarer bare i en kanal du koblet til i trinn 7. For Kick slår du på **!join in Kick chat** i boksen **Kick channel**.',
        'Ikke noe event åpent? Da sier den det: “No event is open to join right now — keep an eye on the stream!”',
      ],
      tips: [
        'Hvis chatten din blokkerer lenker (Twitchs **Block hyperlinks** eller AutoMod), blir svaret fra boten holdt tilbake. Skriv `/vip anvil_osrs` eller `/mod anvil_osrs` i chatten én gang, så kommer lenken gjennom.',
        'Holder du på med et event? **Space settings** i eventets meny tar deg tilbake til disse bryterne. Det gjør også **Switch it on in your settings** under **Who can join?**.',
      ],
    },

    page: {
      title: 'Gjør siden til din egen',
      body: [
        'Siden din er det folk ser på `{apex}/c/your-name`, sammen med eventene dine. Åpne **Settings** → **Your page**. Hver del har sin egen lagre-knapp.',
      ],
      items: [
        '**Bio.** Noen linjer om deg og streamene dine. Lenker som starter med `https://`, kan klikkes.',
        '**Logo and banner.** Trykk **Upload a logo** eller **Upload a banner**. Banneret går over hele toppen av siden din, så gjør det bredt (3:1, for eksempel 1500 × 500). PNG, JPEG, GIF eller WebP. Begge kan være animert.',
        '**Panels.** Opptil 8 kort under eventene dine, som panelene under en Twitch-kanal. Trykk **+ Add a panel** og gi det en tittel og litt tekst. Bilde og lenke er valgfritt. Bruk pilene for å endre rekkefølgen.',
        '**Schedule.** Når du vanligvis går live, i din egen tidssone. Besøkende ser hvert tidspunkt på sin egen klokke.',
        '**Featured.** Ett klipp, festet øverst på siden din. Velg et av stream-høydepunktene dine (neste trinn), eller lim inn en klipplenke fra Twitch, YouTube, Kick eller Medal.',
        'Trykk **Preview your page** for å se siden slik besøkende ser den.',
      ],
      note: {
        tag: 'Jagex’ regler',
        body: 'Alt på siden din må følge Jagex’ regler: ikke salg av gull eller kontoer, ingen gambling, ingen boter og ingen private servere. Anvil sjekker ordene og lenkene dine når du lagrer. Hvis staben til Anvil skjuler siden din etter en rapport, står det i innstillingene dine. Spør på Anvils Discord hvis du mener det er en feil.',
      },
    },

    highlights: {
      title: 'Stream-høydepunkter',
      body: [
        'Når Twitch- eller YouTube-kanalen din er koblet til, fanger Anvil de store øyeblikkene i eventene dine mens du er live. Bryterne ligger i **Settings** → **Stream highlights**.',
        '**Auto-clip big moments on my stream** er på så snart du kobler til. Mens du er live på Twitch, lager Anvil et klipp når et av eventene dine starter, når et lag fullfører brettet eller vinner, og når din egen karakter får en sjelden drop eller en pet. På YouTube lagrer Anvil i stedet en lenke til akkurat det sekundet i streamen din. Kick har ingen høydepunkter ennå.',
        'Klippene vises under **Highlights** på eventsiden og på siden din. Du kan feste ett som ditt **Featured**-klipp (trinn 10).',
        '**Let Anvil feature clips from my events in its own promotion** er av til du slår det på. Da kan Anvil dele et klipp på sine egne sider og sosiale medier, og krediterer alltid deg.',
        'Spillerne dine kan også klippe sine egne store øyeblikk. De slår på **Clip my stream when I hit a big moment** under Twitch-kontoen sin i **Settings** → **Connected accounts**.',
      ],
    },

    listing: {
      title: 'Bli vist på Anvil',
      body: [
        'Rommet ditt er ikke oppført når du lager det. Bare folk med lenken din kan finne det.',
        'Åpne **Settings** → **Advertise on Anvil** og slå det på. Rommet ditt vises i Anvils klanoversikt, og de nye eventene dine vises på `{apex}/events`.',
        'Vil du vise bare ett event, åpner du **Settings** → **Viewers** → **List on Anvil** i det. Det vises mens eventet er kommende eller pågår.',
        'Et event uten datoer vises under **Open to join**, merket “Open now · starts when the host starts it”.',
      ],
    },

    plans: {
      title: 'Planer og grenser',
      body: [
        'Planen din bestemmer hvor mange spillere som kan være med i eventene dine samtidig. Events med overlappende datoer deler det tallet; events på ulike datoer får det hver for seg. En spiller i to overlappende events telles to ganger. Alt annet er likt på alle planer: brettet, plugin-sporingen, overlayet og Discord.',
        'Plankortet ditt ligger på **Your events**. Vil du sammenligne planer, se [priser](/pricing#creators). Vil du endre eller si opp det du betaler, gå til [betalingssiden din](/portal).',
      ],
      rows: [
        { term: 'Free', body: 'Opptil 50 spillere samtidig på tvers av eventene dine. Ett event om gangen. Sjekk av Discord-rolle og booster.' },
        { term: 'Bronze', body: 'Opptil 150 spillere samtidig på tvers av eventene dine. Sjekk av Twitch, Kick og YouTube.' },
        { term: 'Silver', body: 'Opptil 300 spillere samtidig på tvers av eventene dine. Mer enn ett event om gangen. `!join` i chatten. Vist først i listen.' },
        { term: 'Gold', body: 'Opptil 1 000 spillere samtidig på tvers av eventene dine. Skjul Anvil-merket på overlayet ditt.' },
        { term: 'Partner', body: 'Ingen grense for spillere. Settes opp direkte med Anvil — ta kontakt.' },
      ],
      note: {
        tag: 'Akkurat nå',
        body: 'Alle slipper fortsatt inn mens Anvil vokser, også over tallene i planen din. Grensene starter senere, med varsel. Plankortet ditt viser hvor nær du er.',
      },
    },

    faq: {
      title: 'Spørsmål',
      intro: 'De streamere spør mest om:',
      rows: [
        {
          term: 'Må seerne mine ha en klan?',
          body: 'Nei. De trenger en Discord-konto og en OSRS-karakter. Send dem [seerveiledningen]({joiningGuide}).',
        },
        {
          term: 'Trenger de RuneLite-pluginet?',
          body: 'For drops og kills, ja. Pluginet sender dem inn av seg selv. Noen få ruter leser hiscores i stedet.',
        },
        {
          term: 'En seer sier “The host’s Twitch connection isn’t working”.',
          body: 'Twitch sluttet å godta tilkoblingen din. Åpne **Settings** og trykk **Reconnect Twitch**. Det samme gjelder Kick og YouTube.',
        },
        {
          term: 'Kan noen andre hjelpe meg å kjøre det?',
          body: 'Ja. Åpne **Players** → **Staff & roles**, legg dem til, og velg hva hver av dem kan gjøre.',
        },
        {
          term: 'Jeg driver også en klan i spillet.',
          body: 'Da trenger du kanskje ikke et rom. En offentlig klan kan i stedet slå på **Streaming**. Se [streaming for klaner]({streamingGuide}).',
        },
        {
          term: 'Kan jeg lage et rom til?',
          body: 'Ett rom per Discord-konto foreløpig. Ta kontakt hvis du trenger et til.',
        },
        {
          term: 'Hvor finner jeg innstillingene for rommet mitt?',
          body: 'Trykk **Settings** i menyen. Inne i et event trykker du **Space settings** i eventets meny.',
        },
        {
          term: 'Hva gjør **Report**-knappen på siden min?',
          body: 'Alle som er logget inn, kan rapportere siden din, et panel, et event eller et høydepunkt til staben til Anvil. Rapporter går bare til staben. Hvis staben skjuler bioen, panelene, timeplanen eller det fremhevede klippet ditt, står det i innstillingene dine.',
        },
      ],
    },
  },

  // /guide/joining-a-streamer-event — for en seer som klikket på lenken til en streamer. Antar ingenting:
  // ingen klan, ingen Anvil-konto, kanskje ikke RuneLite-pluginet. Knappene står ordrett som på siden.
  joiningStream: {
    metaTitle: 'Slik blir du med i OSRS-bingoen til en streamer — Anvil',
    metaDescription:
      'Fikk du en lenke fra en streamer? Logg inn med Discord, legg til OSRS-karakteren din, trykk Join. Hva du gjør for events kun for følgere eller subs på Twitch, Kick eller YouTube, og hvordan dropsene dine teller.',
    eyebrow: 'For seere',
    title: 'Slik blir du med i eventet til en streamer',
    dek: 'En streamer delte en lenke. Slik kommer du på brettet. Du trenger ikke en klan.',
    facts: [
      { strong: '~2 min', rest: 'å bli med' },
      { strong: 'Ingen klan', rest: 'nødvendig' },
    ],

    join: {
      title: 'Bli med i fire trinn',
      body: [
        '**Åpne lenken** streameren delte. Eller skriv `!join` i chatten deres, så legger boten ut den.',
        '**Logg inn med Discord.** Det er Anvil-kontoen din. Det er ingenting å fylle ut.',
        '**Legg til karakteren din.** Trykk **Add my character** og skriv RuneScape-navnet ditt. Står det **Prove it’s mine**, følg trinnene på profilen din. [Plugin-veiledningen]({pluginGuide}) viser hvordan.',
        '**Trykk Join.** Velg karakteren din hvis du har flere. Du ser **You’re in!** når det gikk bra.',
      ],
    },

    gated: {
      title: 'Events for følgere eller subs',
      body: [
        'Noen events er bare for fellesskapet til streameren. Join-kortet sier hvem, for eksempel “Open to followers of somename on Twitch”.',
        'Trykk **Join** likevel. Hvis du ikke er sluppet inn ennå, viser kortet hva du må gjøre. Gjør én av dem, og trykk så **Join** igjen.',
      ],
      intro: 'Hva du gjør for hver type:',
      rows: [
        {
          term: 'Twitch follow or sub',
          body: 'Trykk **Link Twitch** og logg inn med Twitch. Anvil ber ikke om noen tillatelser. Trykk så **Join** igjen.',
        },
        {
          term: 'Kick follow or sub',
          body: 'Trykk **Get Kick code**. Skriv koden (som `ANVIL-7F3K9Q`) i Kick-chatten til streameren innen 10 minutter. Hver kode virker én gang. Trykk så **Join** igjen.',
        },
        {
          term: 'YouTube subscriber',
          body: 'Trykk **Check my YouTube subscription** og logg inn med Google. Velg kontoen du ser med. Abonnementene dine må være offentlige i personverninnstillingene til YouTube.',
        },
        {
          term: 'YouTube member',
          body: 'Trykk **Link my YouTube account**, skriv så koden din i YouTube live-chatten og trykk **check the chat**. Dette virker bare mens streameren er live.',
        },
        {
          term: 'Discord role or booster',
          body: 'Bli med på Discord-serveren til streameren og få rollen (eller boost den). Anvil sjekker med Discord-kontoen du logget inn med.',
        },
      ],
      note: {
        tag: 'Godkjenning',
        body: 'Noen streamere sier ja til hver spiller. Da står det **Ask to join** på knappen, og du ser **Waiting for the host** til de svarer.',
      },
    },

    plugin: {
      title: 'Installer Anvil-pluginet',
      body: [
        'Dropsene og killsene dine teller gjennom Anvil-pluginet for RuneLite. Installer det fra Plugin Hub og logg inn med Discord fra sidepanelet.',
        '[Plugin-veiledningen]({pluginGuide}) tar deg gjennom det på omtrent tre minutter.',
      ],
    },

    play: {
      title: 'Spill',
      body: [
        'Det var alt. Spill som vanlig. Når du får et drop eller et kill brettet trenger, sender pluginet det inn av seg selv.',
        'Åpne event-lenken når som helst for å se brettet og stillingen. Du spiller bare dette ene eventet: du blir ikke med i en klan.',
      ],
    },

    accounts: {
      title: 'Kontoene dine',
      body: [
        'Twitch-, YouTube- og Kick-kontoene du har koblet til, ligger i [Settings → Connected accounts](/settings/connections). Du kan koble dem til der før du blir med også.',
        'Fjern en tilkobling når som helst. Events du allerede er med i, beholder deg. Et event med krav som du blir med i senere, ber deg koble til på nytt.',
        'Tilkoblede Twitch-, YouTube- og Kick-kontoer vises på profilen din med en hake: du har bevist at de er dine. Slå av **Show on my profile** for å skjule en. En Medal-lenke er annerledes. Den limer du inn selv, så den får ingen hake.',
        'Streamer du selv på Twitch? Slå på **Clip my stream when I hit a big moment** under Twitch-kontoen din. Mens du er live i en streamers event, klipper Anvil de sjeldne dropsene dine, pets og fullførte ruter.',
      ],
    },

    faq: {
      title: 'Spørsmål',
      intro: 'Når noe sier nei:',
      rows: [
        {
          term: '“This event is full”',
          body: 'Det er ikke plass til flere spillere. Bare streameren kan lage plass — si fra til dem.',
        },
        {
          term: 'Jeg er subbed, men kommer ikke inn.',
          body: 'Sjekk at du koblet til den samme kontoen du abonnerer med. På Twitch ser du **Your Twitch** på join-kortet. På Kick skriver du en ny kode i chatten deres: Anvil leser sub-merket på den meldingen. På YouTube må du gjøre abonnementene dine offentlige og sjekke igjen.',
        },
        {
          term: 'Jeg fulgte på Kick, men det står at jeg ikke gjorde det.',
          body: 'Anvil ser bare følgere som kom etter at streameren koblet til Kick. Fjern følgen og følg på nytt, og trykk så **Join**.',
        },
        {
          term: '“That Twitch account was already used to join this event”',
          body: 'Én Twitch-konto (eller Kick eller YouTube) får inn én spiller. Noen andre har allerede blitt med på den.',
        },
        {
          term: '“Twitch didn’t answer just now”',
          body: 'Twitch, Kick, YouTube eller Discord hadde et lite hikst. Vent et minutt og trykk **Join** igjen.',
        },
        {
          term: '“The host’s … connection isn’t working”',
          body: 'Dette er streamerens sak. Si til dem at de må koble til kanalen sin på Anvil på nytt.',
        },
        {
          term: 'Dropsene mine vises ikke.',
          body: 'Sjekk at pluginet er installert og innlogget, og at du ble med med karakteren du spiller. Se [plugin-veiledningen]({pluginGuide}).',
        },
        {
          term: 'Hvor finner jeg flere eventer som dette?',
          body: '[Eventsiden](/events) viser eventer alle kan bli med i, også streameres eventer som er åpne akkurat nå.',
        },
        {
          term: 'Noe på siden til en streamer bryter reglene.',
          body: 'Trykk **Report** på siden, eventet eller høydepunktet. Velg hva som er galt, og trykk **Send**. Det går bare til staben til Anvil. Streameren får aldri vite hvem som rapporterte.',
        },
      ],
    },
  },

  // /guide/streaming-for-clans — en offentlig klan som slår på Streaming (lib/streamingSwitch). Bare det
  // som er annerledes enn et creator-rom; de felles verktøyene peker til creator-veiledningen.
  streamingClans: {
    metaTitle: 'Stream eventene til klanen din — Anvil',
    metaDescription:
      'La seerne på streamen din bli med i et av OSRS-eventene til klanen din uten å bli med i klanen: slå på Streaming, åpne et event for seere, og velg hvilke seere som slipper inn.',
    eyebrow: 'For klaner som streamer',
    title: 'Streaming for klaner',
    dek: 'Streamer klanen din eventene sine? La seere spille ett event uten å bli med i klanen din.',

    on: {
      title: 'Slå på Streaming',
      body: [
        'Gå til Admin → **Clan settings** → **Profile** og slå på **Streaming**.',
        'Bare en offentlig klan kan streame. Seerne må kunne åpne event-siden din, og en privat klan skjuler den for dem. En klan med Streaming på kan ikke bli privat før du slår det av.',
        'Når det er på, kobler du til Twitch-, YouTube- eller Kick-kanalen din rett under.',
      ],
    },

    event: {
      title: 'Åpne et event for seere',
      body: [
        'Hvert event forblir **Members only** til du sier noe annet. Slik var det før.',
        'Åpne eventets **Settings** → **Entry & co-hosts** → **Who can join?** og velg **Members and viewers**. Velg så **Which viewers?**: alle, eller følgere, subs, en Discord-rolle og så videre. Trykk **Save**.',
        'Disse sjekkene gjelder bare seere. Klanmedlemmene dine kommer alltid inn, som før.',
      ],
    },

    viewers: {
      title: 'Hva seere er',
      body: [
        'En seer som blir med, er en **event player**. De spiller det ene eventet.',
        'De er ikke klanmedlemmer og ikke gjester. De havner aldri på klanlisten din, og de får ingen rang.',
        'Du ser alle som ble med på den måten under **People** → **Past viewers**.',
      ],
    },

    tools: {
      title: 'Stream-verktøyene dine',
      body: [
        'Streamer-verktøyene fungerer som i et creator-rom: verifiserte kanallenker, **Who can join?**-sjekker, OBS-overlayet og `!join` i chatten.',
        'Overlay-lenkene for et klan-event ligger i eventets **Settings** → **Stream** → **Stream overlay**. `!join` og overlay-merket ligger under **Clan settings** → **Profile** → **Streaming**.',
        '[Creator-veiledningen]({creatorsGuide}) forklarer hver enkelt trinn for trinn.',
        'Stream-høydepunkter virker her også: med Twitch eller YouTube koblet til klipper Anvil de store øyeblikkene i eventer som er åpne for seere. `!join` i Kick-chat har sin egen bryter i boksen **Kick channel**.',
      ],
    },

    faq: {
      title: 'Spørsmål',
      intro: 'De korte svarene:',
      rows: [
        {
          term: 'Teller seere med i medlemsgrensen vår?',
          body: 'Nei. De er event players, ikke medlemmer. Streamer-grensene teller spillere samtidig på tvers av eventene du arrangerer (se [creator-veiledningen]({creatorsGuide})).',
        },
        {
          term: 'Sender `!join` folk til et event kun for medlemmer?',
          body: 'Nei. Den peker bare til et event som er åpent for seere.',
        },
        {
          term: 'Bør jeg lage et creator-rom i stedet?',
          body: 'Bare hvis du ikke har en klan. Et rom er for streamere uten klan i spillet.',
        },
      ],
    },
  },

  people: {
    metaTitle: 'Folkene dine: medlemsliste, gjester og hvem som kan bli med — Anvil',
    metaDescription:
      'Hvor en Anvil-klans medlemsliste kommer fra, hva Members, Guests, Roster only, Departed og Quiet betyr, hvordan forespørsler om å bli med og Needs review fungerer, de tre innstillingene under Who can join, og hvordan du fjerner eller utestenger noen.',
    eyebrow: 'Anvil · for klanens stab',
    title: 'Folkene dine: medlemsliste, gjester og hvem som kan bli med',
    dek: 'Alle under Admin → **People** har havnet der på en av fire måter: klanlisten i spillet hadde dem med, staben godkjente dem, klanen slipper inn alle, eller noen la dem til for hånd. Her er hvordan hver av dem virker, hva Roster-fanen forteller deg, og hva du sjekker når noen står på feil sted.',
    facts: [
      { strong: 'Medlemslisten i spillet', rest: 'den eneste automatiske veien til å bli medlem' },
      { strong: 'Å logge inn', rest: 'setter aldri noen på medlemslisten' },
      { strong: 'To køer', rest: 'på to forskjellige faner' },
    ],
    footnote:
      'Alt her ligger under Admin → **People**. Roster og Needs review er moderatorarbeid. **Who can join** og **Staff & roles** er faner bare for admins. Hvem som kan gjøre hva i hele adminområdet, står i [Stabsroller: hvem kan gjøre hva]({staffGuide}).',

    roster: {
      title: 'Hvor medlemslisten kommer fra',
      body: [
        'Medlemslisten er klanlisten fra spillet, kopiert over til nettstedet. En admin sender den fra RuneLite med Anvil-pluginet: trykk på **Anvil**-knappen i tittellinjen på klanvinduet, eller på **Sync roster** i sidepanelet til pluginet. Alle på listen kommer inn som **medlem**, med rangen sin fra spillet. Bare noen med Admin-rollen på nettstedet kan sende den. Alle andre får beskjed om det i spillet.',
        'En synkronisering er det eneste som gjør noen til medlem av seg selv. Forlater noen klanen i spillet, blir de merket som utmeldt ved neste synkronisering, og blir de med igjen, kommer de tilbake ved synkroniseringen etter det. Historikken deres blir liggende uansett.',
        'Alle andre plasser er **gjesteplasser**: folk som spiller i eventene deres uten å være med i klanen i spillet. Gjester blir sporet og kan delta i eventer. De er ikke medlemmer, og de teller ikke med i planen deres.',
      ],
      note: {
        tag: 'Å logge inn setter aldri noen på medlemslisten',
        body: 'Å logge inn med Discord, koble til en karakter eller spille med pluginet gir ingen en plass. Ser pluginet noen som har deres klan i spillet, men som ikke står på medlemslisten ennå, ber det om å få dem inn (se trinn 3). Alle andre har bare en Anvil-konto uten klan. Det er det som hindrer en fremmed i å bli med i klanen deres ved å skrive navnet på den.',
      },
    },

    filters: {
      title: 'Slik leser du Roster-fanen',
      intro:
        'Linjen øverst deler medlemslisten i **Members**, **Guests** og **Departed**. Klikk på en del for å filtrere på den. Knappene under snevrer listen inn ytterligere:',
      rows: [
        {
          term: 'Active',
          body: 'medlemmer som fortsatt står på medlemslisten. Gjester og utmeldte er holdt utenfor.',
        },
        {
          term: 'Quiet 7d+',
          body: 'medlemmer pluginet ikke har sett spille på sju dager eller mer. Har noen aldri brukt pluginet, er de ikke med her, for det finnes ingenting å vurdere dem etter. **Last played** viser i stedet **no plugin data**.',
        },
        {
          term: 'Guests',
          body: 'nåværende gjesteplasser: folk som spiller i eventene deres, men ikke er med i klanen i spillet.',
        },
        {
          term: 'Roster only',
          body: 'nåværende medlemmer og gjester som ennå ikke har en konto på nettstedet. Helt vanlig for alle som aldri har logget inn med Discord. De blir stående på medlemslisten; de logger inn og kobler til karakteren når de vil melde seg på noe.',
        },
        {
          term: 'Departed',
          body: 'folk som har forlatt klanen i spillet, eller som staben har fjernet. Resultatene og historikken deres blir liggende.',
        },
        {
          term: 'All',
          body: 'alle over.',
        },
      ],
      outro:
        'Kolonnen **Source** viser hvordan hver plass startet: **Clan sync**, **Added manually** eller **Applied or self-reported**. **Last played** kommer fra pluginet, ikke fra synkroniseringen av medlemslisten.',
      note: {
        tag: 'Rang og rolle er to forskjellige ting',
        body: 'De to nedtrekksmenyene ved siden av knappene filtrerer på rang i spillet og på rolle på nettstedet. Rangen er det spillet melder. Rollen på nettstedet er det en admin setter under **Staff & roles**. Den ene setter aldri den andre.',
      },
    },

    review: {
      title: 'Forespørsler om å bli med og Needs review',
      intro: 'To slags folk venter på et ja, og de venter på hver sin fane.',
      rows: [
        {
          term: 'Asking to join',
          body: 'øverst på **Roster**-fanen, og vises bare mens noen venter. En forespørsel kommer fra nettstedet (de trykket **Apply** på klansiden deres, eller prøvde å delta i et av eventene deres) eller fra pluginet (det så dem spille i klanen deres i spillet før medlemslisten hadde dem). Hver rad viser hvilken, og om de er medlem av en annen klan. **Approve** gir dem en gjesteplass. **Decline** gir dem beskjed, som DM på Discord når boten deres kan nå dem. Kryss av for flere for å svare alle på én gang.',
        },
        {
          term: 'Awaiting confirmation',
          body: 'på **Needs review**. Folk som har koblet til en av karakterene på medlemslisten deres ved å få XP på den, ved å spørre, eller ved å spille den med pluginet. De kan allerede spille mens de venter. Sjekk at Discord-navnet stemmer med karakteren, og trykk så **Approve**. **Not our member** tar karakteren av listen deres og lar den bli hos eieren sin. **Report to Anvil** er for en karakter som ikke er deres.',
        },
        {
          term: 'Claim requests',
          body: 'også på **Needs review**. Noen har spilt en karakter som allerede er et etablert medlem her, så Anvil koblet den ikke til dem av seg selv. Vet du at det er dem, trykk **Yes, that’s them**; hvis ikke, **Not them**. En karakter som bare noen gang har vært i klanen deres, blir koblet til med en gang. En som også er med i en annen klan, går til Anvil for avgjørelse.',
        },
      ],
      note: {
        tag: 'Merket teller ikke forespørsler om å bli med',
        body: 'Tallet på **Needs review**, og på **People** i sidefeltet, teller Awaiting confirmation og Claim requests. Forespørsler om å bli med er ikke med, så se øverst på Roster-fanen også.',
      },
    },

    policy: {
      title: 'Hvem som kan bli med',
      intro:
        'Admin → People → **Who can join** har tre innstillinger, og bare admins ser fanen. Den som avgjør hvordan utenforstående kommer inn, er **Players from other clans**:',
      rows: [
        {
          term: 'Ask first',
          body: 'standarden. Den som søker, eller som pluginet plukker opp fra klanen deres i spillet, venter som en forespørsel til staben godkjenner dem. Ingen får en plass uten et ja.',
        },
        {
          term: 'Let anyone in',
          body: 'det holder å spørre. De får en gjesteplass med en gang, og ingen forespørsel blir opprettet. Bra for et åpent event, ellers mest støy.',
        },
        {
          term: 'No guests',
          body: 'bare deres egne medlemmer spiller. Spillere fra andre klaner kan ikke delta i eventene deres eller be om å bli med, og pluginet oppretter ingenting for dem.',
        },
      ],
      outro:
        '**Who can see this clan** er enten **Anyone** (en lenke til et brett virker for den du sender den til) eller **Members only** (alle andre ser klanens kort og en invitasjon til å søke). **List in the Clan Hall** setter klanen på den offentlige listen over klaner. Å slå den av gjør ikke klanen privat.',
      note: {
        tag: 'Ingen av dem rører medlemmene deres',
        body: 'Synkroniseringen av medlemslisten gir medlemmer en plass uansett hva som står her. Deres egen stab blir heller aldri behandlet som gjester: karakteren til noen i staben får en medlemsplass uten forespørsel.',
      },
    },

    manual: {
      title: 'Legge til noen for hånd',
      body: [
        'Roster → **+ Add Manually** setter én karakter på medlemslisten. Fyll inn **RSN**, og om du vil, **Discord ID** og **Rank**. Kryss av for **Add as guest** for noen som ikke er med i klanen deres i spillet. Både moderatorer og admins kan gjøre dette.',
        'Bruk det for noen synkroniseringen ikke ser ennå, for eksempel en rekrutt som ble med etter forrige synkronisering. Plassen blir merket **Added manually**, og synkroniseringen behandler den som deres avgjørelse: fjerner du senere en plass du la til for hånd, henter ikke neste synkronisering den tilbake.',
        'Å sette noen på medlemslisten melder dem ikke på et event. Det gjør du på fanen **Sign-ups** i eventet, med **Add member**. Den er bare for admins.',
      ],
    },

    removing: {
      title: 'Fjerne og utestenge',
      intro: 'Hver rad på medlemslisten har en handlingsmeny. Disse gjør forskjellige ting:',
      rows: [
        {
          term: 'Demote to guest',
          body: 'de blir stående på listen og kan fortsatt settes inn i eventer, men teller ikke lenger som medlem. **Promote to member** gjør det om.',
        },
        {
          term: 'Remove from roster',
          body: 'merker dem som utmeldt. Historikken og resultatene deres blir liggende. Er de fortsatt med i klanen deres i spillet, kan neste synkronisering av medlemslisten legge dem til igjen.',
        },
        {
          term: 'Not our member',
          body: 'på Needs review, for en karakter noen har koblet til, men som ikke er med i klanen deres. Den forsvinner fra listen deres og blir hos eieren sin.',
        },
        {
          term: 'Ban from this clan',
          body: 'avslutter alle plassene personen har her, alts inkludert, fjerner alle stabsroller og brettjobber de har i denne klanen, og hindrer dem i å komme tilbake: synkroniseringen, pluginet og forespørsler om å bli med avviser dem alle til utestengelsen blir opphevet. Anvil-kontoen deres og de andre klanene deres blir ikke rørt. Bare for admins, bare for noen med en konto på nettstedet og en rolle under admin, fra menyen på raden, fra **Staff & roles** eller for flere personer på én gang. Å oppheve en utestengelse setter dem ikke tilbake; de blir med igjen i spillet, eller du legger dem til.',
        },
      ],
      note: {
        tag: 'En utestengelse fjerner også stabsrollen',
        body: 'Å utestenge noen avslutter plassene deres og tar fra dem stabsrollen og eventuelle jobber som brettredaktør eller brettkasserer på klanens brett. Å oppheve utestengelsen gir dem ikke tilbake: sett rollen på nytt under Staff & roles hvis de skal ha den.',
      },
    },

    faq: {
      title: 'Vanlige spørsmål',
      intro: 'Det som som regel forklarer at noen står på feil sted.',
      rows: [
        {
          term: 'Noen i klanen mangler',
          body: 'Kjør en synkronisering av medlemslisten først: listen endres bare når en admin sender den. Sjekk så **Departed**, i tilfelle de er fjernet, og om de er utestengt; synkroniseringen hopper over alle som er utestengt her, og melder hvem den hoppet over. Er klanen over planen sin og fristen har gått ut, slutter synkroniseringen å legge til nye medlemmer til dere oppgraderer eller rydder i medlemslisten.',
        },
        {
          term: 'Noen vises som gjest, men er med i klanen',
          body: 'Som regel er de fortsatt medlem av en annen klan på Anvil. En karakter kan bare være medlem av én klan om gangen, så synkroniseringen gir dem en gjesteplass her og gjør dem til medlem ved første synkronisering etter at de har forlatt den andre klanen. Ellers kom de inn via en forespørsel, eller noen har degradert dem eller lagt dem til som gjest. Kjør en synkronisering, eller bruk **Promote to member**.',
        },
        {
          term: 'Noen har logget inn, men står ikke på medlemslisten',
          body: 'Det er som forventet. Å logge inn oppretter en Anvil-konto, ikke en plass. De dukker opp når synkroniseringen har dem med, når du godkjenner forespørselen deres, eller når du legger dem til for hånd.',
        },
        {
          term: 'Navn som #Player1234',
          body: 'RuneLite viser en slik plassholder et øyeblikk mens en spiller logger inn, og for klanmedlemmer den ikke kan navngi. Anvil ignorerer de navnene nå: synkroniseringen hopper over dem, pluginet oppretter ingen forespørsel for dem, og gamle forespørsler under et slikt navn er skjult. Står det fortsatt ett på medlemslisten deres, er det en gammel rad. **Remove from roster** fjerner den.',
        },
        {
          term: 'Et fjernet medlem kommer stadig tilbake',
          body: 'Å fjerne noen endrer ikke klanen i spillet, så neste synkronisering legger dem til igjen så lenge spillet fortsatt har dem på listen. Fjern dem i spillet, eller utesteng dem her.',
        },
        {
          term: 'En moderator ser ikke Who can join',
          body: 'Det er en fane bare for admins, akkurat som Staff & roles. Se [Stabsroller: hvem kan gjøre hva]({staffGuide}).',
        },
      ],
    },
  },

  staffRoles: {
    metaTitle: 'Stabsroller: hvem kan gjøre hva — Anvil',
    metaDescription:
      'Klanrollene på Anvil (eier, admin, kasserer, moderator, medlem), hva hver av dem når, hvordan du gjør noen til moderator, hvem som kan gi hvilken rolle, og oppgavene som bare gjelder ett event.',
    eyebrow: 'Anvil · for eiere og admins',
    title: 'Stabsroller: hvem kan gjøre hva',
    dek: 'Fem roller, satt per klan under Admin → People → **Staff & roles**. En rolle her gir ingenting i noen annen klan, og ingen kan dele ut en rolle som er like høy som eller høyere enn sin egen. Denne siden er hele kartet: hva hver rolle når, hvordan du deler ut en, og oppgavene som dekker ett enkelt event.',
    facts: [
      { strong: 'Per klan', rest: 'en rolle her betyr ingenting andre steder' },
      { strong: 'Under din egen', rest: 'er alt du kan gi' },
      { strong: 'Eier', rest: 'byttes bare ved overføring' },
    ],
    footnote:
      'Roller blir sjekket på nytt ved hver sidelasting, så en endring gjelder fra personens neste klikk; de trenger ikke logge ut. Om selve medlemslisten, se [Folkene dine]({peopleGuide}). Om hverdagen til en moderator, se [På vakt]({moderatorGuide}).',

    roles: {
      title: 'Rollene',
      intro: 'Alle som logger inn med Discord, starter som vanlig **Member**. Over det:',
      rows: [
        {
          term: 'Eier',
          body: 'den som opprettet klanen, til de gir den videre. Alt en admin kan gjøre, pluss å overføre eierskapet og slette klanen. Det finnes nøyaktig én, og ingen kan degradere, fjerne eller utestenge dem.',
        },
        {
          term: 'Admin',
          body: 'alt bortsett fra å overlevere klanen: eventer og brett, innstillinger, Discord, staben og klanens penger.',
        },
        {
          term: 'Kasserer',
          body: 'avgifter, kassa og premier, i tillegg til alt en moderator gjør: medlemslisten, bevis, konkurranser, Schedule og Needs review.',
        },
        {
          term: 'Moderator',
          body: 'nykommere, medlemslisten, bevis, ukentlige konkurranser og klaneventer. Ingen eventer eller brett, ingen innstillinger, ingen stab og ingen penger.',
        },
        {
          term: 'Medlem',
          body: 'ingen oppgave i staben. Spiller, melder seg på, og kan melde inn en donasjon til kassa.',
        },
      ],
      outro:
        'Under rollen på Staff & roles står to avkrysningsbokser, for alle under admin, vanlige medlemmer inkludert. **Can build bingo boards** åpner Tiles-fanen på alle brett og Task library. **Can write guides** lar dem skrive klanens guider. Admins har begge allerede.',
    },

    assign: {
      title: 'Gjøre noen til moderator',
      intro:
        'De må ha logget inn med Discord og koblet til en karakter som står på medlemslisten deres, som medlem eller gjest. Så:',
      steps: [
        'Åpne Admin → **People** → **Staff & roles**.',
        'Listen åpner på **Staff**. Bytt til **Members** eller **All accounts**, og søk etter navnet deres.',
        'Velg **Moderator: newcomers, roster, sign-ups, proofs** i kolonnen **Role**. Det lagres så snart du velger.',
        'Skal de også bygge brett, kryss av for **Can build bingo boards**.',
      ],
      outro:
        'Ikke logget inn ennå? Finn karakteren deres på **Roster**-fanen, åpne menyen og velg **Set role**. Da lagres rollen på karakteren. De får den første gang de logger inn og kobler den til, eller, hvis de venter på Needs review, når en moderator godkjenner dem.',
      note: {
        tag: 'Ta den fra dem igjen',
        body: 'Sett rollen tilbake til **Member**. Å endre noens rolle fjerner også brettoppgavene de hadde på klanens brett (se trinn 5), så legg dem til igjen etterpå hvis de skal beholde dem.',
      },
    },

    who: {
      title: 'Hvem kan gi hva',
      intro:
        'Staff & roles er en fane bare for admins, og hver endring der blir sjekket mot to regler: du kan bare gi en rolle under din egen, og du kan bare endre noen som har en rolle under din egen.',
      rows: [
        {
          term: 'Eieren',
          body: 'kan gi og ta fra Admin, Treasurer og Moderator.',
        },
        {
          term: 'En admin',
          body: 'kan gi og ta fra Treasurer og Moderator. En admin kan ikke gjøre noen andre til admin, endre en annen admin eller endre sin egen rolle.',
        },
        {
          term: 'Kasserere og moderatorer',
          body: 'kan ikke endre noens rolle. Fanen er skjult for dem.',
        },
        {
          term: 'Ingen',
          body: 'kan endre rollen til eieren, fjerne dem eller utestenge dem. Klanen beholder også alltid én admin: den siste kan ikke degraderes.',
        },
      ],
      note: {
        tag: 'Overlevere klanen',
        body: 'Det kan bare eieren, og bare til noen som allerede er admin: raden til den adminen får handlingen **Make owner**. De blir eier, og du blir en vanlig admin. Du kan ikke angre det selv; bare den nye eieren kan overføre den tilbake.',
      },
    },

    table: {
      title: 'Hvem kan gjøre hva',
      intro:
        'Hva hver rolle når i adminområdet. «Hvis avkrysset» betyr boksen **Can build bingo boards** eller **Can write guides** under Staff & roles.',
      areaLabel: 'Område',
      columns: ['Eier', 'Admin', 'Kasserer', 'Moderator', 'Medlem'],
      rows: [
        { area: 'Dashboard', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nei'] },
        { area: 'Eventer: opprette, redigere, lag, påmeldinger, starte', cells: ['Ja', 'Ja', 'Nei', 'Nei', 'Nei'] },
        { area: 'Ruter på brett og Task library', cells: ['Ja', 'Ja', 'Hvis avkrysset', 'Hvis avkrysset', 'Hvis avkrysset'] },
        { area: 'Bevis som skal sjekkes', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nei'] },
        { area: 'Ukentlige konkurranser', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nei'] },
        { area: 'Klaneventer', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nei'] },
        { area: 'Schedule', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nei'] },
        { area: 'Medlemsliste: se, legge til, fjerne', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nei'] },
        { area: 'Forespørsler om å bli med og Needs review', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nei'] },
        { area: 'Utestenge noen fra klanen', cells: ['Ja', 'Under admin', 'Nei', 'Nei', 'Nei'] },
        { area: 'Staff & roles', cells: ['Ja', 'Under admin', 'Nei', 'Nei', 'Nei'] },
        { area: 'Who can join', cells: ['Ja', 'Ja', 'Nei', 'Nei', 'Nei'] },
        { area: 'Kassa og premiestiger', cells: ['Ja', 'Ja', 'Ja', 'Nei', 'Nei'] },
        { area: 'Avgifter: merke som innkrevd', cells: ['Ja', 'Ja', 'Ja', 'Nei', 'Nei'] },
        { area: 'Avgifter: bekrefte (den andre signaturen)', cells: ['Ja', 'Ja', 'Nei', 'Nei', 'Nei'] },
        { area: 'Discord-innstillinger', cells: ['Ja', 'Ja', 'Nei', 'Nei', 'Nei'] },
        { area: 'Legge ut i Discord', cells: ['Ja', 'Ja', 'Nei', 'Nei', 'Nei'] },
        { area: 'Klaninnstillinger: Profile, Features, Rules & scoring, Boosts', cells: ['Ja', 'Ja', 'Nei', 'Nei', 'Nei'] },
        { area: 'Plan og betaling', cells: ['Ja', 'Ja', 'Nei', 'Nei', 'Nei'] },
        { area: 'Guider', cells: ['Skrive', 'Skrive', 'Lese; skrive hvis avkrysset', 'Lese; skrive hvis avkrysset', 'Skrive hvis avkrysset'] },
        { area: 'Aktivitetslogg', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nei'] },
        { area: 'Synkronisere medlemslisten fra RuneLite', cells: ['Ja', 'Ja', 'Nei', 'Nei', 'Nei'] },
        { area: 'Overføre eierskapet, slette klanen', cells: ['Ja', 'Nei', 'Nei', 'Nei', 'Nei'] },
      ],
      note: {
        tag: 'Skjult er ikke det samme som tillatt',
        body: 'Sidefeltet viser bare det rollen din kan bruke, men sjekken som teller, kjører på serveren. Skriver du inn adressen til en side rollen din ikke kan bruke, blir du sendt tilbake til dashbordet, og handlingen bak den blir avvist.',
      },
    },

    event: {
      title: 'Oppgaver på ett event',
      intro:
        'Noen oppgaver dekker ett enkelt event i stedet for klanen. En admin gir dem på selve eventet, og de når det eventet og ingenting annet, så de er trygge å gi til et vanlig medlem.',
      rows: [
        {
          term: 'Brettredaktør',
          body: 'bygger og redigerer rutene på det brettet. Gis under eventets **Settings** → **Staff** → **Board staff**, eller med **Boards…** i handlingene til en person under Staff & roles. Et medlem som har fått en, ser bare sine egne brett i adminområdet.',
        },
        {
          term: 'Brettkasserer',
          body: 'krever inn avgiftene til det brettet og tar seg av utbetalingene, uten å nå klanens kasse. I adminområdet ser de bare sine egne brett, og bare fanene **Sign-ups** og **Prizes** på hvert brett. Gis også under **Board staff**.',
        },
        {
          term: 'Lagstab',
          body: 'styrer ett lag: troppen, innsendingene og bevisene, og å merke spillernes avgifter som betalt. De kan ikke røre et annet lag, redigere brettet, gjøre draftvalg eller bytte ut noen når eventet er live. Legges til på lagets side under **Team staff**. Det er slik moderatoren til en gjesteklan styrer sin halvdel av en klan-mot-klan.',
        },
        {
          term: 'Kaptein',
          body: 'utnevnt av verten for ett lag. Alt lagstaben kan gjøre, pluss å gjøre lagets draftvalg.',
        },
      ],
      note: {
        tag: 'En klanrolle erstatter brettoppgaver',
        body: 'Å gi noen en klanrolle, eller endre den, fjerner oppgavene deres som brettredaktør og brettkasserer på klanens brett. Staff & roles advarer deg først når brettoppgaver er alt de har. Legg dem til igjen etterpå hvis de skal beholde dem.',
      },
    },

    safety: {
      title: 'Slik holdes det trygt',
      intro: 'Dette gjelder uansett hvordan rollene er satt.',
      rows: [
        {
          term: 'Eieren er beskyttet',
          body: 'raden deres under Staff & roles viser **Protected**. Rollen kan ikke endres, og de kan ikke utestenges. Eierskapet byttes bare når de selv overfører det.',
        },
        {
          term: 'Admins kan ikke fjerne hverandre',
          body: 'en admin kan verken degradere eller utestenge en annen admin, verken én om gangen eller flere på én gang. Når to admins er uenige, avgjør eieren. En utestengelse tar også fra personen stabsrollen og brettjobbene i denne klanen.',
        },
        {
          term: 'Penger krever to personer',
          body: 'når en avgift må bekreftes, må bekreftelsen komme fra en annen admin enn den som merket den som innkrevd. Hvor mange bekreftelser en avgift trenger, fra null til fem, settes under **Clan settings** → **Rules & scoring** → **Fee sign-off**. En admin som er alene om pengene, kan fortsatt tvinge en avgift lukket, med en egen knapp.',
        },
        {
          term: 'Dette kan ikke en moderator',
          body: 'opprette eller redigere eventer, endre innstillinger eller Discord, gi noen en rolle (heller ikke seg selv) eller røre klanens penger.',
        },
        {
          term: 'Alt blir loggført',
          body: 'rolleendringer, overføringer av eierskap, utestengelser og besvarte forespørsler om å bli med blir skrevet til **Activity log**, som alle i staben kan lese.',
        },
        {
          term: 'Discord-roller er noe annet',
          body: 'Anvils rollesynkronisering matcher Discord-roller mot **rang i spillet**, ikke mot roller på nettstedet. Å gjøre noen til moderator her gir dem ingenting på Discord-serveren deres, og en moderatorrolle du har delt ut for hånd i Discord, blir latt være. Den ene botkommandoen som endrer noe, å legge til i kassa med `/coffer`, sjekker rollen på nettstedet: kasserer, admin eller eier.',
        },
      ],
    },
  },
  supporter: {
    metaTitle: 'Anvil Supporter: nivåer og fordeler — Anvil',
    metaDescription:
      'Hva Anvil Supporter, Champion og Patron får: navnefarger og stjernen, gull-GZ, animert avatar og banner, monteren, venneeventer, head-to-head, eventchat og klanboosts. Hvordan betalingen via Gumroad fungerer, og hva som skjer når du sier opp.',
    eyebrow: 'Anvil · for spillere',
    title: 'Anvil Supporter: nivåer og fordeler',
    dek: 'Anvil Supporter er et personlig abonnement som betaler for Anvils servere. Det finnes i tre nivåer, og hvert nivå har alt nivået under har. Hver fordel er utseende eller plass til å arrangere: sporing, eventer, poeng og din egen statistikk er fortsatt gratis for alle, og ingenting her endrer hva et event teller.',
    facts: [
      { strong: 'Fra $1 i måneden', rest: 'eller $10 i året' },
      { strong: 'Bare utseende', rest: 'aldri poeng, en rang eller en gjenstand' },
      { strong: 'Ingenting slettes', rest: 'når du slutter' },
    ],
    footnote:
      'Alt her stilles inn på nettsiden under **Settings** → **Supporter**, **Profile look** og **Clan boosts**. Boosts i detalj står i [Å booste en klan]({boostsGuide}). Hvor fargene dine vises i RuneLite, står i [Sidepanelet, fane for fane]({panelGuide}).',

    tiers: {
      title: 'De tre nivåene',
      intro: 'Prisene står på siden **Anvil Supporter**, `/supporter`. En årsplan koster det samme som ti måneder.',
      rows: [
        {
          term: 'Supporter',
          body: '$1 i måneden eller $10 i året. Et navn i gull og en stjerne, gull-GZ, en monter med 4 plasser, og du kan arrangere et venneevent.',
        },
        {
          term: 'Champion',
          body: '$2 i måneden eller $20 i året. Et navn med fargeovergang fra våre forhåndsvalg (eller én egen farge), egen avatar og eget banner (animert om du vil), 8 plasser i monteren, raskere eventchat og 1 klanboost.',
        },
        {
          term: 'Patron',
          body: '$5 i måneden eller $50 i året. Din egen fargeovergang med opptil 4 farger, som beveger seg, 12 plasser i monteren, ingen venting i eventchatten, 2 venneeventer samtidig og 2 klanboosts.',
        },
      ],
      note: {
        tag: 'Tid fra invitasjoner',
        body: 'Under Settings → Supporter får du en invitasjonslenke. Når en venn du har invitert betaler, tjener du gratis måneder; belønningen kommer to uker etter vennens første betaling. Tid tjent på denne måten gir alle fordelene på sitt nivå unntatt klanboosts.',
      },
    },

    compare: {
      title: 'Hva hvert nivå får',
      intro: 'Den samme tabellen som på Supporter-siden, pluss fordelene i chatten.',
      table: {
        areaLabel: 'Fordel',
        columns: ['Gratis', 'Supporter', 'Champion', 'Patron'],
        rows: [
          { area: 'Navnefarger', cells: ['—', 'Gull', 'Forhåndsvalg eller én egen farge', 'Forhåndsvalg eller opptil fire farger, i bevegelse'] },
          { area: 'Stjerne ved navnet ditt', cells: ['—', 'Ja', 'Ja', 'Ja'] },
          { area: 'Gull-GZ', cells: ['—', 'Ja', 'Ja', 'Ja'] },
          { area: 'Egen avatar og eget banner, animert', cells: ['—', '—', 'Ja', 'Ja'] },
          { area: 'Monter', cells: ['—', '4 plasser', '8 plasser', '12 plasser'] },
          { area: 'Venneeventer (samtidig · spillere)', cells: ['Bare bli med', '1 · 10', '1 · 25', '2 · 50'] },
          { area: 'Head-to-head-utfordringer', cells: ['1 aktiv', '5 aktive', 'Ubegrenset', 'Ubegrenset'] },
          { area: 'Eventchat: venting mellom linjer', cells: ['5 s', '3 s', '1 s', 'Ingen'] },
          { area: 'Klanboosts', cells: ['—', '—', '1', '2'] },
        ],
      },
      outro:
        'Under **Settings** → **In-game chat** finnes tre til: egne farger i chatfeeden (Supporter), å velge hva innloggingsoppsummeringen din dekker (Champion), og en stjerne ved navnet ditt i andre spilleres chatfeed (Patron).',
    },

    names: {
      title: 'Navnefarger',
      intro:
        'Still dem inn under **Settings** → **Supporter**, i **Your name’s look**. Forhåndsvisningen viser navnet ditt på en mørk og på en lys bakgrunn.',
      rows: [
        {
          term: 'Supporter',
          body: 'helt i gull. Det er ingenting å velge.',
        },
        {
          term: 'Champion',
          body: 'en av de forhåndsvalgte fargeovergangene (**Classic**, standarden, **Ember**, **Ocean**, **Aurora**, **Rose gold** eller **Toxic**), eller **Your own**: én fast farge. På tvers av alle karakterene dine kan du bruke høyst to forskjellige egne farger.',
        },
        {
          term: 'Patron',
          body: 'alle forhåndsvalgene pluss **Prism**, Patron-standarden, eller **Your own** med én til fire farger. Én farge står stille; to til fire gir en fargeovergang som beveger seg fra venstre mot høyre.',
        },
      ],
      outro:
        '**Your Anvil display name** er navnet på kontoen din som er koblet til Discord. Under **Your RuneScape characters** velger du **Same for all** eller **Customize each** for å gi hver karakter sitt eget utseende. Trykk **Save** (eller **Save for all characters**); **Reset to default** går tilbake til fargene for nivået ditt.',
      note: {
        tag: 'Mørke og lyse bakgrunner',
        body: 'Nettstedet, pluginpanelet og Discord er mørke; spillets faste chatboks er lys. Anvil justerer fargene dine så de holder seg lesbare på hver av dem. Vil du ha et annet utseende på en av dem, slå på **Set a separate look for dark backgrounds** eller **for light backgrounds**. Det utseendet vises nøyaktig slik du valgte det, uten kontrastjustering, og forhåndsvisningen advarer deg når det er vanskelig å lese.',
      },
    },

    where: {
      title: 'Hvor flairen din vises',
      intro: 'Fargene dine og stjernen følger med overalt der navnet ditt står:',
      rows: [
        {
          term: 'På nettstedet',
          body: 'brett, medlemslister, profiler, ditt eget navn i topplinjen og navnene på karakterene dine. Stjernen bærer fargene dine.',
        },
        {
          term: 'I pluginpanelet',
          body: 'Feed, eventchatten, kortene og **Tracking**-linjen. En Patrons fargeovergang glir; hver spiller kan stoppe den med **Animated names**.',
        },
        {
          term: 'I spillet',
          body: 'for andre spillere som bruker Anvil-pluginet: offentlig chat, klan-, venne- og privatchat, klankunngjøringer, innloggingsvarsler, venne- og klanlister og høyreklikkmenyen (aldri på PvP-verdener eller i Wilderness). I spillchatten er stjernen en Patrons.',
        },
        {
          term: 'På Discord',
          body: 'en stjerne ved navnet ditt på Anvils innlegg, tegnet i dine egne farger hvis du har valgt noen.',
        },
        {
          term: 'Gull-GZ',
          body: 'på en klankamerats drop i klanens feed på nettstedet kan GZ-en din være i gull. Bare Supporters kan gi en.',
        },
      ],
      note: {
        tag: 'Bare på karakterer som er bevist å være dine',
        body: 'Fargene vises bare på karakterer pluginet har bekreftet er dine, på nettstedet og i spillet. For å holde dem unna navnene dine i andres spillchat, fjern haken i **Show my colours on my characters’ names in game chat** under Settings → Supporter.',
      },
    },

    profile: {
      title: 'Avatar, banner og monter',
      intro: 'Alle tre ligger under **Settings** → **Profile look**.',
      rows: [
        {
          term: 'Avatar og banner',
          body: 'Champion og Patron. Last opp dine egne; en GIF eller WebP forblir animert. De vises på kortet ditt, profilen din og alle karakterene dine, på nettstedet og i pluginet. Et banner kan være opptil 6 MB og minst 600×150; en avatar opptil 2 MB.',
        },
        {
          term: 'Per karakter',
          body: 'gi én karakter sitt eget banner eller sin egen avatar, eller begge deler. Det erstatter standarden din bare på den karakterens sider og pluginkort.',
        },
        {
          term: 'Monter',
          body: 'de beste dropsene, killcountene og tidene dine festet til profilen: 4 plasser for Supporter, 8 for Champion, 12 for Patron. Festede ting fra karakterer du ikke deler, forblir private.',
        },
      ],
    },

    hosting: {
      title: 'Venneeventer, head-to-head og chat',
      intro: 'Fordelene som gir deg mer plass til å spille, i stedet for et utseende:',
      rows: [
        {
          term: 'Venneeventer',
          body: 'kjør din egen bingo, solobingo eller ditt eget race for venner fra **Host an event for your friends**, sporet av pluginet akkurat som et klanevent. Venner blir med via invitasjonslenken din. Supporter: 1 pågående event, 10 spillere. Champion: 1 event, 25 spillere. Patron: 2 samtidig, 50 spillere til sammen. Hvem som helst kan bli med i et.',
        },
        {
          term: 'Head-to-head',
          body: 'utfordre en venn fra profilen deres: først til en drop, eller flest kills eller mest XP på 1 time, 24 timer eller 7 dager. Bare for æren. Gratisspillere kan ha 1 åpen om gangen, Supporters 5, Champions og Patrons så mange de vil.',
        },
        {
          term: 'Eventchat',
          body: 'hvor lenge du venter mellom linjer: 5 sekunder uten nivå, 3 for Supporters, 1 for Champions, ingen for Patrons. Når chatten på et brett blir travel, venter alle 10 sekunder, Patrons også.',
        },
        {
          term: 'Klanboosts',
          body: 'Champion 1, Patron 2, så lenge du betaler. Se [Å booste en klan]({boostsGuide}).',
        },
      ],
    },

    billing: {
      title: 'Betale, bytte og si opp',
      intro: 'Anvil Supporter faktureres via Gumroad, månedlig eller årlig.',
      steps: [
        'Logg inn på Anvil og åpne `/supporter`.',
        'Trykk **Choose Supporter**, **Choose Champion** eller **Choose Patron**. Gumroads kasse åpnes, med månedlig eller årlig betaling.',
        'Betal. Fordelene dine slås på så snart Gumroad gir Anvil beskjed, og nivået ditt vises på Supporter-siden som **Your tier**.',
      ],
      outro:
        'Bytt nivå med **Change tier** under Settings → Supporter. Si opp eller oppdater kortet ditt med **Manage on Gumroad** samme sted. Et oppsagt medlemskap beholder alle fordelene til slutten av perioden du har betalt for.',
      note: {
        tag: 'Start alltid fra /supporter',
        body: '**Choose**-knappen har med en kode som forteller Anvil hvilken konto som betalte. Anvil matcher aldri en betaling på e-post, så kjøper du direkte fra Gumroad uten den knappen, blir betalingen ikke koblet til noe. Har det skjedd, spør i Anvils Discord, så kan staben knytte den til kontoen din for hånd.',
      },
    },

    lapse: {
      title: 'Gå ned eller slutte',
      intro:
        'Ingenting du har stilt inn, blir slettet. Hver fordel sjekkes mot nivået du har akkurat nå, så den slår seg av av seg selv og kommer tilbake så snart du fornyer.',
      rows: [
        {
          term: 'Navnefarger',
          body: 'det lagrede valget ditt blir liggende. Du bærer fargene til det nye nivået ditt, eller ingen, til et nivå som tillater det, kommer tilbake.',
        },
        {
          term: 'Avatar og banner',
          body: 'under Champion viser de sitt første stillbilde i stedet for å bevege seg.',
        },
        {
          term: 'Monter',
          body: 'viser de første festede tingene nivået ditt tillater, og skjuler resten. Uten nivå er den skjult; de festede tingene venter på deg.',
        },
        {
          term: 'Klanboosts',
          body: 'de eldste boostene dine fortsetter å telle, og resten settes på pause, ikke fjernet.',
        },
      ],
      note: {
        tag: 'En midlertidig oppgradering fra Anvils stab',
        body: 'Staben kan gi noen et høyere nivå en stund, for eksempel som takk. Det ligger oppå det du betaler, og endrer aldri abonnementet ditt. Settings → Supporter viser **A gift from Anvil** og når den tar slutt; etter det er du tilbake på det betalte nivået ditt. En gave gir bare plasser til klanboosts når staben tar dem med.',
      },
    },
  },

  sidePanel: {
    metaTitle: 'Anvils sidepanel, fane for fane — Anvil',
    metaDescription:
      'Hva hver fane i Anvils sidepanel i RuneLite viser (Clan, Feed, You, Lookup og tannhjulet), hvordan eventchat og reaksjoner i Feed fungerer, og plugininnstillingene for feeden i spillchatten, Supporter-farger og animerte navn.',
    eyebrow: 'Anvil · for spillere',
    title: 'Sidepanelet, fane for fane',
    dek: 'Anvil-knappen i RuneLites sidestolpe åpner et panel med fire faner og et tannhjul: **Clan**, **Feed**, **You**, **Lookup** og ⚙. Det meste panelet viser, kommer fra nettstedet, så det holder seg oppdatert uten en oppdatering av pluginet. Noen få ting nedenfor er merket som på vei i neste pluginoppdatering.',
    facts: [
      { strong: 'Fire faner', rest: 'og et tannhjul for synkronisering og innstillinger' },
      { strong: 'Eventchat', rest: 'i Feed-fanen' },
      { strong: 'GZ, Sad, Sit', rest: 'på radene i Feed' },
    ],
    footnote:
      'Å installere pluginet og logge inn står i [Oppsettsveiledning for spillere]({pluginGuide}). Supporter-farger, stjernen og fordelene i chatten er forklart i [Anvil Supporter: nivåer og fordeler]({supporterGuide}).',

    header: {
      title: 'Toppen av panelet',
      intro: 'Over fanene sitter tittelen, **Refresh** og kontolinjen.',
      rows: [
        {
          term: 'Refresh',
          body: 'laster inn panelet på nytt, Feed-fanen inkludert. Det står **Refreshing…** mens den jobber. I neste pluginoppdatering laster den også inn You og Lookup på nytt, så en ny avatar eller et nytt banner vises med en gang, og den tømmer ikke lenger Feed-fanen.',
        },
        {
          term: 'Tracking',
          body: 'linjen under tittelen viser karakteren som spores, i dens Supporter-farger hvis den har noen. **Not my account…** slutter å spore en karakter som noen andre spiller på denne datamaskinen; **Track again** angrer det.',
        },
        {
          term: 'Kontomenyen',
          body: '⋯-lenken åpner **View my profile on Anvil**, **Not my account…** og **Sign out…**. I neste pluginoppdatering har den også **Become a Supporter**, eller **Your Supporter perks** hvis du allerede er det.',
        },
        {
          term: 'Sesongfremgang',
          body: 'i neste pluginoppdatering står det på Leagues, Deadman og andre sesongverdener en linje: **Sharing season progress · Turn off**. Den sender relics, områder og tasks (med et skjermbilde) til klanen din; klanen velger på nettsiden hva som blir postet. **Turn on** deler det igjen. Den samme bryteren heter **Share seasonal activity** i plugininnstillingene.',
        },
      ],
    },

    clan: {
      title: 'Clan',
      intro:
        'Eventene dine og klanen din. I en skapers space heter fanen **Space**.',
      rows: [
        {
          term: 'Klanmenyen',
          body: 'vises når du spiller i mer enn én klan eller space. **All clans** (standard) viser alt du spiller, med pågående event først. Velger du én klan, snevres panelet inn til den, og innsendingene dine havner der.',
        },
        {
          term: 'Eventer',
          body: 'hvert pågående og kommende brett, Skill eller Boss of the Week og klanevent, med hvor du står. Deretter **Your other boards**, **Also live** og **Your clan**.',
        },
        {
          term: 'Et brett',
          body: 'åpne et for stillingen, lagene, oppdragene, siste aktivitet, de nærmeste rutene og **View all tiles**. Knappene **Feed** og **Chat** åpner brettet i Feed-fanen.',
        },
        {
          term: 'Et klanevent',
          body: '**I’m going**, **Sign me up** eller **Answer the survey**, avhengig av eventet.',
        },
      ],
    },

    feed: {
      title: 'Feed',
      intro:
        'De store øyeblikkene til klanen din og brettene dine, live: drops, pets, achievements, quests, dødsfall og fullførte ruter.',
      rows: [
        {
          term: 'Hvilken feed',
          body: 'menyen øverst viser **Clan ·** for hver klan du er medlem av og **Event ·** for hvert pågående brett du er med på. Den åpner på brettet ditt hvis du har et, ellers på klanen din.',
        },
        {
          term: 'Filtre',
          body: '**All**, **Tiles** (bare brett), **Drops**, **Pets**, **Achievements**, **Deaths**, og **My team** på et brett der du er på et lag. En klanfeed har også en knapp for aktivitet i spillmoduser som Leagues og andre moduser.',
        },
        {
          term: 'Nye rader',
          body: 'kommer av seg selv. Har du scrollet bort, tar en **↑ N new**-knapp deg tilbake til dem.',
        },
      ],
      note: {
        tag: 'Ikke det samme som chatfeeden i spillet',
        body: 'Feed-fanen virker uansett hva plugininnstillingene dine sier. **Show feed in game chat** (steg 8) er den separate innstillingen som også skriver den ut i chatboksen din.',
      },
    },

    reactions: {
      title: 'Reaksjoner',
      intro: 'Hver rad i Feed har sin reaksjon under seg:',
      rows: [
        {
          term: 'GZ',
          body: 'på drops, pets og achievements. Antallet vises ved siden av, for eksempel **GZ 3**.',
        },
        {
          term: 'Sad og Sit',
          body: 'på dødsfall, i stedet for GZ. Sit er spillets måte å be noen som døde om å sette seg ned.',
        },
        {
          term: 'Hvem kan reagere',
          body: 'på en klanfeed: klankamerater. På et brett: spillerne på det og vertens stab; når et brett skjuler stillingen, kan spillerne bare reagere på radene til sitt eget lag.',
        },
        {
          term: 'Hvem som har reagert',
          body: 'hold musepekeren over en reaksjon for å se navn, for eksempel «GZ · Mossy and 3 others». Klikk igjen for å ta tilbake din.',
        },
      ],
      note: {
        tag: 'I neste pluginoppdatering',
        body: 'Reaksjonene blir pilleknapper, farget når én av dem er din, og andres reaksjoner oppdateres live for alle som ser på, også i de andre åpne klientene dine. I dag endres antallet når du reagerer eller når Feed lastes inn på nytt. Gull-GZ, Supporter-reaksjonen, gis i nettsidens feeder; Feed-fanen har GZ, Sad og Sit.',
      },
    },

    chat: {
      title: 'Eventchat',
      intro:
        'Et brett med chat slått på har en **Feed / Chat**-bryter øverst i Feed-fanen, for spillerne på det brettet og vertens stab. Brettets side i Clan-fanen har også en **Chat**-knapp.',
      rows: [
        {
          term: 'Alle eller laget ditt',
          body: '**All** skriver til hele brettet, **My team** bare til laget ditt (de linjene er merket **TEAM**). Staben ser også **Host & mods**, og linjene deres er merket **HOST** eller **MOD**.',
        },
        {
          term: 'Sende',
          body: 'skriv i feltet og trykk Enter. Linjer kan være opptil 200 tegn, og bare verten og modsene kan poste lenker.',
        },
        {
          term: 'Hvor ofte',
          body: 'ventetiden mellom linjene dine følger Supporter-nivået ditt: 5 sekunder uten nivå, 3 for Supporters, 1 for Champions, ingen for Patrons. Linjen under feltet sier hva som gjelder for deg. Staben venter aldri.',
        },
        {
          term: 'Slow mode',
          body: 'når chatten på et brett blir veldig travel, venter alle minst 10 sekunder i ett minutt, Patrons inkludert. Ingen kan sende mer enn 10 linjer på 10 sekunder.',
        },
        {
          term: 'Moderering',
          body: 'verten og modsene kan høyreklikke på en linje for å velge **Delete message** eller **Mute** noen, og sette hele chatten på pause med **Pause chat (read-only for everyone)**.',
        },
      ],
      outro:
        'Flere linjer på rad fra samme person deler ett navn og ett tidspunkt, til det blir en pause på 5 minutter. Chatten blir lagret i 7 dager etter at eventet er slutt.',
    },

    you: {
      title: 'You og Lookup',
      intro: 'To faner for spillerkort: ditt eget og alle andres.',
      rows: [
        {
          term: 'You',
          body: 'ditt eget kort for karakteren du er logget inn på: banner og avatar, **Display case**, collection log helt ned til hver sides gjenstander, og **Skills**, **Bosses**, **Clues**, **Times** og **CAs**. Under det finner du eventuelle **Head-to-head**-utfordringer som venter på deg (**Accept** eller **Decline**) og dine **Goals**, med **+ Add goal**.',
        },
        {
          term: 'Lookup',
          body: 'bytt mellom **Players** og **Clans**, skriv et navn og trykk Enter. **Recent** viser de siste du har slått opp. Høyreklikk på hvem som helst i spillet og velg **Anvil** for å havne her.',
        },
        {
          term: 'Sammenlign',
          body: 'på noen andres kort stiller **Compare with me** dere opp mot hverandre ferdighet for ferdighet, boss for boss og side for side. Et klankort har **Compare with my clan**.',
        },
      ],
    },

    gear: {
      title: 'Tannhjulfanen',
      intro: 'Synkronisering og innstillinger, heller enn ting å se på:',
      rows: [
        {
          term: 'Sync profile',
          body: 'sender collection loggen og de beste tidene dine til Anvil.',
        },
        {
          term: 'Sync clan roster',
          body: 'bare for klanens admins: sender klanens medlemsliste fra spillet til nettstedet. Kan ikke pluginet lese klanen din, står det **Join your clan channel to sync the roster** i stedet.',
        },
        {
          term: 'Bannerlyder',
          body: '**Add clip** for lyden et banner spiller, **Copy folder path** for å administrere dem, og **Add mission clip** for oppdrag.',
        },
        {
          term: 'Become a Supporter',
          body: 'i neste pluginoppdatering åpner en ★-lenke nederst Supporter-siden, eller det står **Your Supporter perks** hvis du allerede er det.',
        },
      ],
    },

    settings: {
      title: 'Innstillinger som endrer hva du ser',
      intro:
        'I RuneLites konfigurasjon for Anvil, under **Chat messages**. Alle er slått på fra start.',
      rows: [
        {
          term: 'Show feed in game chat',
          body: 'skriver også ut feeden i chatboksen din mens det skjer: store drops, pets og achievements fra brett der verten har slått det på og klaner du er gjest i, lagkameratenes fremgang på ruter, og andre lags fullførte ruter.',
        },
        {
          term: 'Supporter names in chat',
          body: 'Supporters’ farger (og en Patrons stjerne) i offentlig chat, klan-, venne- og privatchat, og på vennelisten din og kanalenes medlemslister. Listen over navn lastes ned fra Anvil; ingenting om hvem du ser, blir sendt.',
        },
        {
          term: 'Animated names',
          body: 'lar en Patrons fargeovergang gli i panelet, Feed og eventchatten. Av holder den i ro. I neste pluginoppdatering gjelder den også boostede klannavn og animerte bannere i panelet.',
        },
        {
          term: 'Supporter names in menus',
          body: 'Supporters’ farger på navnet deres når du høyreklikker på dem, aldri på PvP-verdener eller i Wilderness.',
        },
        {
          term: 'Over other plugins’ colours',
          body: 'på erstatter en Supporters farger en navnefarge et annet plugin har satt, for eksempel Player Indicators. Av lar de navnene være i fred.',
        },
      ],
    },
  },

  clanBoosts: {
    metaTitle: 'Å booste en klan — Anvil',
    metaDescription:
      'Slik fungerer klanboosts på Anvil: hvem som har dem, å plassere og flytte en boost, de tre boostnivåene og hva hvert av dem låser opp, klanens navnefarger, boosts i gave, og boostermerker og badges.',
    eyebrow: 'Anvil · for Supporters og klanens stab',
    title: 'Å booste en klan',
    dek: 'En betalende Champion eller Patron kan sette en boost på en klan de er medlem av. Nok boosts fra en klans medlemmer løfter den et nivå, og hvert nivå endrer hvordan klanen ser ut og hvor den vises. Boosts er bare utseende: de endrer aldri en rang, en poengsum, en plass eller klanens plan.',
    facts: [
      { strong: 'Champion 1, Patron 2', rest: 'boosts så lenge du betaler' },
      { strong: 'Nivåer ved 3, 8 og 15', rest: 'tellende boosts' },
      { strong: 'Én gang i uka', rest: 'kan en boost flyttes' },
    ],
    footnote:
      'Medlemmer plasserer boosts under **Settings** → **Clan boosts**. Klanens stab ser nivået og valgene for det under Admin → **Clan settings** → **Boosts**. Om selve Supporter-nivåene, se [Anvil Supporter: nivåer og fordeler]({supporterGuide}).',

    what: {
      title: 'Hvem som har boosts',
      intro: 'Boosts følger med et betalt medlemskap:',
      rows: [
        { term: 'Champion', body: '1 boost.' },
        { term: 'Patron', body: '2 boosts.' },
        {
          term: 'Supporter',
          body: 'ingen. Det gir heller ikke tid tjent via invitasjoner. En midlertidig oppgradering fra Anvils stab gir bare plasser når staben tar dem med.',
        },
      ],
      outro:
        'Boosts hører til deg, ikke til en karakter: tre karakterer i tre klaner deler likevel ett sett. **Settings** → **Clan boosts** vises bare i innstillingene dine mens du er Supporter eller fortsatt har en boost plassert.',
    },

    place: {
      title: 'Å plassere og flytte en boost',
      intro: 'Du plasserer dine egne boosts; ingen kan plassere en for deg.',
      steps: [
        'Åpne **Settings** → **Clan boosts**. **Your boosts** viser hva du har plassert og eventuelle **Free slot**.',
        'Under **Clans you can boost**, trykk **Boost** ved siden av en klan. Du kan også trykke **Boost this clan** i Boosters-delen på klanens egen side.',
        'For å flytte en, bruk **Move to…** på raden og velg en annen klan. **Remove** tar den av.',
      ],
      rows: [
        {
          term: 'En medlemsplass, 14 dager gammel',
          body: 'hver boost hviler på en medlemsplass som en av karakterene dine har i klanen i spillet. En gjesteplass kan ikke bære en. Plassen teller fra det som kom først: da Anvil først så den, eller da spillet sier at karakteren ble med. Fram til da viser klanens rad hvor mange dager som gjenstår.',
        },
        {
          term: 'Én rad per klan',
          body: 'listen viser hver klan én gang, og Anvil velger karakteren boosten hviler på: mainen din der det går, ellers plassen du har hatt lengst. Klanen ser bare den karakteren, aldri de andre dine.',
        },
        {
          term: 'Én gang i uka',
          body: 'en plassert boost kan flyttes 7 dager etter at du plasserte den. Plassen til en fjernet boost åpner igjen på samme dato, så å fjerne og plassere på nytt er ingen snarvei. Har karakteren den hvilte på forlatt klanen, kan du flytte den med en gang.',
        },
      ],
      note: {
        tag: 'Hva merkelappene betyr',
        body: '**counting**: den teller mot klanens nivå. **paused**: nivået ditt har nå færre plasser enn du har plassert, så de eldste boostene dine fortsetter å telle og resten venter. **seat gone**: karakteren den hvilte på er ikke lenger medlem der; flytt den. **over the 2-per-person cap**: klanen teller allerede to av dine.',
      },
    },

    levels: {
      title: 'Nivåer',
      intro:
        'En klans nivå kommer fra de tellende boostene. Høyst to boosts fra én og samme person teller for én klan, så et nivå betyr alltid at flere medlemmer har valgt den.',
      rows: [
        { term: 'Level 1', body: '3 tellende boosts.' },
        { term: 'Level 2', body: '8 tellende boosts.' },
        { term: 'Level 3', body: '15 tellende boosts.' },
      ],
      outro:
        'Medlemmer ser fremgangen på klanens side, for eksempel «5 of 8 to Level 2». En klan som stiger, får det nye nivået med en gang.',
      note: {
        tag: 'En uke med frist',
        body: 'Når boostene faller under et nivå, beholder klanen fordelene for det nivået i 7 dager. Admin → Clan settings → Boosts viser når de tar slutt. Booster medlemmene den opp igjen i tide, endres ingenting.',
      },
    },

    perks: {
      title: 'Hva hvert nivå låser opp',
      intro: 'Hvert nivå beholder alt fra nivået under.',
      rows: [
        {
          term: 'Level 1',
          body: 'et **Boosted**-merke på klansiden, på kortet i Clan Hall og i søk; en plass over klaner uten boost i Clan Hall og søkeresultatene der; og klannavnet med fargeovergang.',
        },
        {
          term: 'Level 2',
          body: 'en plass i Clan Halls **Featured**-rad; klanens animerte banner spilles av (under Level 2 viser det stillbildet sitt); en rekrutteringslinje for besøkende; og fargeovergangen i navnet beveger seg.',
        },
        {
          term: 'Level 3',
          body: '**Spotlight** helt øverst i Clan Hall, og ett rekrutteringsinnlegg i måneden i Anvils Discord, skrevet av klanen.',
        },
      ],
      note: {
        tag: 'Klanlogoen er ikke en fordel',
        body: 'En animert logo (et klanbilde i GIF eller WebP) spilles av på alle nivåer. Bare banneret venter på Level 2.',
      },
    },

    colours: {
      title: 'Klanens navnefarger',
      intro:
        'Fra Level 1 bærer klanens navn Anvils fargeovergang. Eiere og admins kan velge sine egne under Admin → **Clan settings** → **Boosts** → **Clan name colours**:',
      rows: [
        {
          term: 'Én til fire farger',
          body: 'én farge gir et fast navn; to til fire gir en fargeovergang. Fra Level 2 beveger fargeovergangen seg.',
        },
        {
          term: 'Mørke og lyse bakgrunner',
          body: 'som med Supporter-navn justerer Anvil fargene så de holder seg lesbare på mørke bakgrunner (nettstedet, pluginpanelet, Discord) og lyse (spillets faste chatboks). Slå på et eget utseende for en av dem, så vises det nøyaktig slik det ble valgt.',
        },
        {
          term: 'Reset to Anvil',
          body: 'går tilbake til Anvils palett.',
        },
      ],
      outro:
        'Fargene forblir lagret hvis klanen faller under Level 1, og kommer tilbake når den når det igjen. Pluginet fanger opp en endring ved neste oppdatering.',
    },

    staff: {
      title: 'For klanens stab',
      intro:
        'Admin → **Clan settings** → **Boosts** er for eiere og admins. Staben kan ikke plassere boosts for medlemmer; medlemmene plasserer sine egne.',
      rows: [
        {
          term: 'Nivået',
          body: 'klanens nivå, hvor mange boosts som teller, hvor mange flere som trengs til neste nivå, og en eventuell fristuke.',
        },
        {
          term: 'Rekrutteringslinje',
          body: 'Level 2. Én setning, opptil 140 tegn, som vises for folk som ikke er med i klanen, på klansiden og kortet deres i Clan Hall.',
        },
        {
          term: 'Rekrutteringsinnlegg i Anvils Discord',
          body: 'Level 3. Én gang per kalendermåned, 20 til 500 tegn, skrevet av deg og postet når du trykker **Post it**, med en lenke til klansiden. Omtaler fjernes, og ingen blir pinget. Du kan ikke redigere det eller sende et nytt før neste måned.',
        },
        {
          term: 'Boosters',
          body: 'listen over karakterer som booster klanen.',
        },
      ],
      note: {
        tag: 'Boosts i gave fra Anvil',
        body: 'Anvils stab kan gi en klan et nivå i gave, for en bestemt tid eller uten slutt. Gaven legger bare til de boostene klanen mangler for å nå det nivået, vist som **Anvil gift** på klanens Boosters-liste. Hver ekte boost fra et medlem erstatter én gaveboost, og en klan som allerede ligger over gavenivået, beholder sitt eget. Når gaven tar slutt, faller klanen tilbake til nivået medlemmenes boosts gir den.',
      },
    },

    boosters: {
      title: 'Boostermerker og badges',
      intro: 'Hva en booster får i klanen de booster:',
      rows: [
        {
          term: 'Boostermerket',
          body: 'en liten edelsten ved karakteren deres i den klanens medlemsliste, feed og Discord-innlegg. Hold musepekeren over den for «Boosts this clan».',
        },
        {
          term: 'Boosters-veggen',
          body: 'på klansiden: én rad per karakter, flest boosts først, deretter de som har stått lengst.',
        },
        {
          term: 'Badges',
          body: '**First booster** til den som plasserte klanens aller første boost; **1 month**, **3 months**, **6 months** og **1 year** for å ha boostet uten pause; og **Level-up 1**, **2** eller **3** for boosten som løftet klanen til det nivået.',
        },
      ],
      note: {
        tag: 'Å flytte starter klokka på nytt',
        body: 'Badges for tid teller fra karakterens tidligste boost som fortsatt teller, så å flytte eller fjerne en boost starter dem på nytt. Profilen din viser klanene du booster, én gang per klan.',
      },
    },
  },
};

export default no;
