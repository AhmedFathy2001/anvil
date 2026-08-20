import type { PartialGuideDict } from './en';

// Dansk.
//
// To ting bliver med vilje stående på engelsk, og skal blive ved med det:
//
//   1. Alt spillet og pluginnet selv skriver — chatlinjer, fejlbeskeder, knapper og menupunkter i
//      RuneLite og OBS. En dansk oversættelse af "Tracked drop detected" ville ikke kunne findes
//      igen af den, der leder efter linjen på sin skærm.
//   2. Navnene på felterne i Anvils egen adminflade, indtil den flade også bliver oversat. Så længe
//      knappen hedder "Make a link", skal vejledningen sige "Make a link".
//
// Alt andet — forklaringen, rækkefølgen, hvorfor man gør det — er dansk.

const da: PartialGuideDict = {
  common: {
    contents: 'Indhold',
    step: 'Trin',
    optional: 'valgfrit',
    minRead: '{n} min læsning',
    language: 'Sprog',
    partialNotice:
      'Denne vejledning er kun delvist oversat til {language}. Det, der endnu ikke er oversat, vises på engelsk.',
    backToGuides: 'Alle vejledninger',
  },

  index: {
    metaTitle: 'Vejledninger — Anvil',
    metaDescription:
      'Kom i gang med Anvil: RuneLite-pluginnet til spillere, afvikling af et event for klanens stab, og hvordan man er vært for en gæsteklan.',
    title: 'Vejledninger',
    dek: 'Alt hvad du skal bruge for at komme i gang, skrevet til præcis den version af Anvil, der kører her.',
    cards: {
      plugin: {
        eyebrow: 'Til spillere',
        title: 'Opsætning af RuneLite-pluginnet',
        blurb:
          'Installér pluginnet, forbind det til denne side, og lad det indsende dine drops. Dækker også Discord-beskeder og klip via OBS.',
        minutes: '~3 min opsætning',
      },
      admin: {
        eyebrow: 'Til klanens stab',
        title: 'Sådan afvikler du dit første event',
        blurb:
          'Discord, medlemsliste, brætter, felter, hold og draft, opstart — og hvad du gør, når eventet er slut.',
        minutes: 'en aften, én gang',
      },
      clanVsClan: {
        eyebrow: 'Til værter',
        title: 'Vær vært for en gæsteklan',
        blurb:
          'Clan-mod-clan uden at samle et eneste RSN ind i hånden: ét invitationslink pr. hold, og en plads der lader deres egen moderator styre deres halvdel.',
        minutes: '~5 min pr. hold',
      },
    },
  },

  plugin: {
    metaTitle: 'Opsætning af RuneLite-pluginnet — Anvil',
    metaDescription:
      'Installér Anvils RuneLite-plugin, forbind det til denne side, og sæt Discord-beskeder og OBS-klip op.',
    eyebrow: 'Anvil · RuneLite-plugin',
    title: 'Opsætningsguide til spillere',
    dek: 'Installér det, peg det på {clanName}, og spil. Pluginnet indsender dine bingo-drops, poster dine sjældne drops og dødsfald på Discord og — hvis du kører OBS — gemmer og poster klip af de øjeblikke, der er værd at se igen.',
    facts: [
      { strong: '2 felter', rest: 'og du bliver tracket' },
      { strong: '~3 min', rest: 'til den basale opsætning' },
      { strong: 'Klip', rest: 'kræver OBS + 5 minutter mere' },
    ],
    footnote:
      'Skærmbillederne er fra en rigtig opsætning — kontotoken, OBS-adresse og Discord-webhook er sløret med vilje. Dine bør blive lige så private.',

    install: {
      title: 'Installér pluginnet',
      body: [
        'I RuneLite: **Configuration** (skruenøglen) → **Plugin Hub** → søg efter **Anvil** → **Install**. Udgiveren er `AhmedFathy2001`.',
        'Ét plugin dækker alle klaner — du peger det på denne side i næste trin, så der er ikke noget klan-specifikt at hente. Når det er installeret, åbner du **Configuration → Anvil** for at nå indstillingerne, der bruges hele vejen igennem denne vejledning.',
      ],
    },

    connect: {
      title: 'Forbind til denne side',
      intro: 'Kun afsnittet **Setup** betyder noget for at komme i gang. Alt andet har fornuftige standardværdier.',
      figure: {
        caption: 'Configuration → Anvil → Setup',
        alt: 'Anvil-pluginnets Setup-afsnit med felterne Site URL og Account Token markeret',
        legend: [
          {
            label: 'Site URL',
            body: 'for {clanName} er det `{origin}`. Feltet er tomt fra start, så du skal selv udfylde det. Der skal ikke skråstreg til sidst, og `https://` bliver sat på, hvis du udelader det.',
          },
          {
            label: 'Account Token',
            body: 'din personlige nøgle til denne side. Enten lader du pluginnet udfylde den for dig (se nedenfor), eller du indsætter den selv. Behandl den som et kodeord.',
          },
        ],
      },
      easyHeading: 'Den nemme vej: log ind fra pluginnet',
      easyIntro:
        'Når Site URL er sat, og token stadig er tom, viser **Anvil-sidepanelet** en **Sign in with Discord**-knap. Klik på den, så guider pluginnet dig igennem — du skal ikke kopiere noget.',
      easySteps: [
        'Panelet viser en kode og åbner din browser på denne side.',
        'Tjek at koden på siden er den samme som den i RuneLite, og klik så **Approve**.',
        'Panelet skriver _Signed in_ og udfylder Account Token for dig.',
      ],
      linkFigure: {
        caption: 'Denne side → /link-device',
        alt: 'Siden Link your RuneLite client med kodefeltet og Approve-knappen markeret',
        legend: [
          { label: 'Koden', body: 'den skal stemme med det, pluginnet viser dig lige nu.' },
          {
            label: 'Approve',
            body: 'godkend kun en kode, som _din egen_ klient viser. Har nogen sendt dig et link eller en kode, så afvis den — at godkende ville give dem din konto.',
          },
        ],
      },
      brokeredNote: {
        tag: 'Derfor dukker et andet domæne op',
        body: [
          'Godkendelsen sker her, på `{origin}`. Hvis du ikke allerede er logget ind på siden, går selve login-trinnet via Anvils fælles Discord-login på `anvilosrs.com` for at bekræfte, hvem du er på Discord — og sender dig så direkte tilbage hertil. Det er det samme login, du får fra Login-knappen på denne side, og ikke en del af pluginnets flow.',
          'Pluginnet selv taler kun med `{origin}`: det nægter at åbne en login-side, der ikke ligger på den Site URL, du har skrevet.',
        ],
      },
      directNote: {
        tag: 'Hvor det foregår',
        body: [
          'Hele forløbet bliver på `{origin}` — koden udstedes her, godkendes her med {clanName}s eget Discord-login, og token udleveres her. Pluginnet nægter at åbne en login-side, der ikke ligger på den Site URL, du har skrevet, så intet i dette trin når frem til en anden Anvil-installation.',
        ],
      },
      federationAside:
        'Må ikke forveksles med **Connect clans** i sidepanelet — det er den separate, valgfrie knap, der forbinder dig til andre Anvil-klaner, og den dukker først op, når du allerede er logget ind her.',
      manualFallback:
        'Åbner browseren ikke af sig selv, skriver panelet adressen og koden, så du kan åbne den manuelt. Koder udløber efter ti minutter — tryk bare på knappen igen.',
      manualHeading: 'Den manuelle vej: kopiér din token',
      manualIntro:
        'Log ind med Discord og åbn [Profile](/profile), og rul så ned til kortet **RuneLite plugin**.',
      tokenFigure: {
        caption: 'Profile → RuneLite plugin',
        alt: 'RuneLite plugin-kortet på profilsiden med tokenfeltet og knapperne Reveal, Copy og Rotate markeret',
        legend: [
          {
            label: 'Din token',
            body: 'skjult indtil du trykker Reveal. Den er sløret på dette skærmbillede med vilje; post aldrig din egen på Discord.',
          },
          {
            label: 'Copy / Rotate',
            body: 'kopiér den ind i pluginnets Account Token-felt. Rotate udsteder en ny og dræber den gamle — brug den, hvis du overhovedet mistænker, at din token er sluppet ud.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Værd at vide',
        body: ['Én token dækker alle de events, du er tilmeldt her — du skal aldrig indsætte den igen pr. bingo.'],
      },
    },

    accounts: {
      title: 'Forbind dine konti — bare spil',
      body: [
        'Der er ingen linkkode at taste. Når din token er på plads, bliver den konto, du logger ind med, automatisk koblet til din profil.',
        'Pluginnet sender dit navn i spillet plus et stabilt kontofingeraftryk med hver forespørgsel, og siden matcher på fingeraftrykket først — så dine links overlever et navneskift. Log ind på en alt én gang, og den dukker op på din profil under _Accounts we noticed you playing_ med et **Add** i ét klik.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'RuneScape Accounts-kortet på profilsiden med konti verificeret via pluginnet',
        legend: [
          {
            label: 'Dine forbundne konti',
            body: 'alt med “Verified via plugin” er kommet dertil bare ved at blive spillet. Tilføj lige så mange alts, du vil; én af dem er din primære.',
          },
        ],
      },
      noPluginHeading: 'Kan du ikke køre pluginnet?',
      noPluginIntro:
        'På mobil eller i den officielle klient forbinder du kontoen på hjemmesiden i stedet — profilsiden viser begge muligheder:',
      noPluginOptions: [
        '**Verify by XP** — skriv dit RSN, siden vælger en tilfældig skill, og du skal tjene 1.000 XP i den inden for 30 minutter.',
        '**Manual review** — til skjulte Hiscores eller helt nye alts: indsend dit RSN med en note, og en moderator godkender det.',
      ],
      signupNote:
        'Tilmelding til et event kræver mindst én verificeret konto, så få det klaret, inden du melder dig til.',
    },

    working: {
      title: 'Tjek at det virker',
      intro:
        'Log ind og læs din chatboks. Pluginnet hilser på dig, når det er forbundet, og der kører et event.',
      // Verbatim: det er præcis de linjer, spillet skriver.
      chat: [
        { text: 'Bingo running: Summer Bingo 2026.', tone: 'gold' },
        { text: 'Skill of the Week is live: Runecraft.', tone: 'gold' },
        { text: '…senere, efterhånden som ting sker…', tone: 'muted' },
        { text: 'Tracked drop detected: Dragon warhammer (1/1)', tone: 'plain' },
        { text: 'Tracked kill: Zulrah (7/10)', tone: 'plain' },
      ],
      outro:
        'Du bør også se **Anvil-sidepanelet** fyldes ud med dit event, dit hold og din fremgang på felterne — og en **Bingo**-fane dukke op inde i din Collection Log i spillet.',
      guestNote: {
        tag: 'Gæst kontra medlem',
        body: 'Står der _Tracked as a guest_ i chatten, bliver du tracket, men du står endnu ikke på klanens medlemsliste. Det retter en admin ved at synkronisere medlemslisten fra spillet — spørg {discordLink}.',
        discordWord: 'på Discord',
      },
    },

    bingo: {
      title: 'Bingo-indstillinger',
      intro:
        'De betyder kun noget, mens du er med i et event. Standardværdierne er fine — her står, hvad hver enkelt rent faktisk gør.',
      figure: {
        caption: 'Configuration → Anvil → Bingo',
        alt: 'Bingo-afsnittet i pluginnets indstillinger med hver indstilling markeret og nummereret',
        legend: [
          {
            label: 'Auto Submit Drops',
            body: 'tager et screenshot og indsender et tracket drop i samme øjeblik, det falder. Lad den være tændt; det er hele pointen.',
          },
          {
            label: 'Show Overlay',
            body: 'tegner et lille _Anvil / hold / UTC-dato_-panel øverst til venstre. Det bliver en del af billedet på dine bevis-screenshots, og det er netop dét, der gør et bevis svært at forfalske eller datere tilbage. Den er slukket på dette skærmbillede — tænd den, hvis din klan vil have hold og tidspunkt synligt på hvert bevis.',
          },
          {
            label: 'Team completion popups',
            body: 'et banner, når nogen på dit hold gør et felt færdigt. Flere på én gang: det sværeste får banneret, resten går i chatten.',
          },
          {
            label: 'Bingo tab in Collection Log',
            body: 'lægger dit bræt ind i Collection Log i spillet, side om side med dine gemte beviser.',
          },
          {
            label: 'Banner sound + volume',
            body: 'afspiller en lyd sammen med banneret. Der sker ingenting, før du selv tilføjer mindst én .wav-fil via knappen “Banner sounds” i den Bingo-fane.',
          },
          {
            label: 'Two-frame drop proof',
            body: 'bager et billede nummer to ind i screenshottet et par sekunder senere, når loot har lagt sig på jorden. Lad den være tændt; den sparer dig for diskussioner.',
          },
        ],
      },
      startHeading: 'Startbillede',
      startBody: [
        'Nogle events kræver et **startbillede** af alle: ét screenshot taget efter, at eventet er gået i gang, på et sted der trækkes i selve startøjeblikket. Det forhindrer folk i at bruge ugen op til eventet på at hamstre clues, kister og kills, som de så dumper på første dag.',
        'Kører du pluginnet, er der intet at forberede. Når eventet starter, får du en chatlinje med besked om, hvor du skal hen, og Anvil-sidepanelet viser en **Take starting shot**-knap. Stil dig, hvor der står, tryk én gang, og så er du færdig — pluginnet tager billedet, stempler dit RSN, dit hold, stedet og et kodeord, kun din konto får, ind i det, og arkiverer det for dig.',
        'To ting tjekker det, inden det arkiverer noget, så du kan nå at rette dem i spillet i stedet for i en Discord-diskussion bagefter. Har værten sat stedet på kortet, ved pluginnet, hvor langt væk du er, og siger det — i stedet for at sende et billede fra den forkerte ende af Gielinor. Og kræver eventet en frisk session, skal du **logge ud og ind igen**, før du tager billedet: dine hiscores gemmes kun, når du logger ud, så et relog lige inden billedet er dét, der gør dine starttal — og dermed hvert eneste XP- og KC-felt — rigtige.',
        'På mobil, eller uden pluginnet: åbn **My Team** her på siden, læs dit kodeord på startbillede-kortet, skriv det i chatboksen i spillet, tag et screenshot hvor både din figur og kodeordet er synlige, og upload det på samme kort. Den upload tæller med det samme — du kan spille, så snart den er inde, og staben ser den igennem bagefter. Log ud og ind først, hvis kortet beder dig om det.',
      ],
    },

    notifications: {
      title: 'Discord-beskeder',
      intro:
        'De sendes, uanset om der kører en bingo eller ej, og de lander i klanens kanaler. Hvilken kanal bestemmer administratorerne her — du vælger kun _hvad_ du poster.',
      dropsFigure: {
        caption: 'Deaths & kills · Drops & pets',
        alt: 'Beskedafsnittene Deaths and kills og Drops and pets med hver indstilling markeret og nummereret',
        legend: [
          {
            label: 'Notify on death',
            body: 'poster i klanens dødsfaldskanal med et screenshot af det øjeblik, du døde.',
          },
          { label: 'Death message', body: 'din egen linje. `{name}` bliver erstattet med dit RSN.' },
          {
            label: 'Notify on PvP kill',
            body: 'et screenshot af det tick, hvor dit mål rammer 0 HP. Slukket som standard; tændt her.',
          },
          { label: 'Notify on rare drops', body: 'hovedafbryderen for drop-opslag.' },
          {
            label: 'Min drop value / Min drop rarity',
            body: 'to uafhængige veje til et opslag: værd mindst så meget (GE eller high alch, alt efter hvad der er højest), eller sjældnere end 1-ud-af-N (1/10.000 som standard — løsere indstillinger fylder kanalen med urteruller). Din klan kan sætte en sjældenhedsgrænse, der gælder alle; din egen gælder stadig, når den er strengere. Sæt en af dem til 0 for at slukke den vej.',
          },
          { label: 'Screenshot rare drops', body: 'vedhæft billedet, ikke bare teksten.' },
          {
            label: 'Loot key value',
            body: 'en loot key posteres én gang, som én besked, når hele indholdet kommer over dette tal.',
          },
          { label: 'Notify on pets + Screenshot pets', body: 'pets lander i kanalen for sjældne drops.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · levels · diaries · quests',
        alt: 'Beskedafsnittet Combat achievements med hver indstilling markeret og nummereret',
        legend: [
          { label: 'Notify on combat achievements', body: 'gennemførte tiers posteres altid, når denne er tændt.' },
          {
            label: 'CA task min tier',
            body: 'hvor larmende de enkelte opgaver er. Elite her; standarden er Master. Sæt den til Grandmaster, hvis du kun vil have de allersjældneste.',
          },
          {
            label: 'Notify on 99s & high totals',
            body: '99’ere, hver 100 total levels fra 1800 og op, samt max.',
          },
          { label: 'Notify on diary completions', body: 'gennemførte achievement diary-tiers.' },
          {
            label: 'Announce quest completions',
            body: 'fra den sværhedsgrad, du vælger, og opefter. “All quests” her; standarden er Master og op.',
          },
        ],
      },
    },

    clips: {
      title: 'Klip med OBS',
      intro: [
        'Tryk på én tast, og de sidste 30 sekunder bliver gemt og lagt i klanens klipkanal. Det er slukket som standard og kræver, at OBS kører — men det er det tætteste, din klan kommer på en highlight-reel.',
        'Sådan virker det: OBS holder en rullende **replay buffer** med de sidste X sekunder. Din genvejstast beder OBS om at skrive den buffer til en fil, og pluginnet samler filen op og uploader den til en Discord-webhook, du har indsat.',
      ],
      privacyNote: {
        tag: 'Hvor din video havner',
        body: 'Klip uploades **direkte fra din PC til Discord**. De passerer aldrig denne side, og der uploades intet som helst, hvis du lader webhook-feltet stå tomt — så bliver klippene liggende på din maskine.',
      },
      obsHeading: 'A. Sæt OBS op (én gang)',
      obsSteps: [
        'Du skal bruge **OBS Studio 28 eller nyere** — WebSocket-serveren er indbygget fra 28 og frem, ingen ekstra download.',
        'Sørg for, at OBS faktisk optager spillet: en Game / Window / Display Capture-kilde, der viser RuneLite. Kan OBS ikke se din klient, bliver dine klip et sort rektangel.',
        '**Settings → Output** → sæt flueben i **Enable Replay Buffer**. (I Simple output-tilstand ligger den på Recording-siden; i Advanced har den sin egen fane.) Tjek samtidig, at der er plads på den sti, du optager til.',
        '**Tools → WebSocket Server Settings** → sæt flueben i **Enable WebSocket server**. Notér **Server Port** (4455 som standard), og klik **Show Connect Info** for at få adgangskoden.',
      ],
      obsAside:
        'Du behøver _ikke_ trykke på “Start Replay Buffer” — pluginnet starter den for dig, når det forbinder, og genstarter den, hver gang du ændrer kliplængden.',
      fillHeading: 'B. Udfyld pluginnet',
      figure: {
        caption: 'Configuration → Anvil → Clips',
        alt: 'Clips-afsnittet i pluginnets indstillinger med hver indstilling markeret og nummereret; OBS-værten og webhook-URL’en er skjult',
        legend: [
          { label: 'Enable clip capture', body: 'hovedafbryderen. Er den slukket, taler pluginnet slet ikke med OBS.' },
          {
            label: 'Capture clip hotkey',
            body: 'sæt den, ellers sker der aldrig noget. Vælg noget, du ikke rammer ved et uheld midt i et raid.',
          },
          {
            label: 'OBS host / port / password',
            body: '`localhost`, når OBS kører på samme PC som RuneLite. Kører OBS på en anden maskine, skriver du dens lokale IP her — skjult på dette skærmbillede — og lukker porten igennem dens firewall. Port og adgangskode kommer fra _Show Connect Info_; lad adgangskoden stå tom, hvis du har slået OBS-godkendelse fra.',
          },
          {
            label: 'Max auto-post size (MB)',
            body: 'alt større bliver gemt lokalt og nævnt diskret i chatten i stedet for at blive postet. Sæt den til det, din Discord-server faktisk accepterer; pluginnet leveres med 25.',
          },
          {
            label: 'Clip length (seconds)',
            body: 'hvor langt tilbage hvert klip rækker. Den skriver bufferlængden ind i din OBS-profil, så OBS skal bruge det antal sekunders tilløb, før et klip i fuld længde overhovedet findes. Længere klip = større filer; 30 er et godt sted at lande.',
          },
          {
            label: 'Save clips as MP4',
            body: 'MP4 kan forhåndsvises og afspilles direkte i Discord; MKV skal hentes ned først. Bemærk at den ændrer OBS’ optageformat, hvilket også påvirker dine almindelige optagelser. Slå den fra for at lade OBS være i fred.',
          },
          {
            label: 'Clips Discord webhook URL',
            body: 'hvor klip bliver postet — spørg en admin om webhooken til klipkanalen. Tom = klippene bliver på din PC. Skjult her, og værd at skjule: alle med denne URL kan poste i den kanal.',
          },
          {
            label: 'Post OBS-triggered clips too',
            body: 'håndterer også gemte klip udløst af OBS selv eller af pluginnet “Save Replay Buffer for OBS”. Lad den være slukket, hvis du kører to RuneLite-klienter mod én OBS — ellers bliver hvert klip postet to gange.',
          },
        ],
      },
      useHeading: 'C. Brug det',
      useIntro: 'Der sker noget sjovt → tryk på din genvejstast → chatten fører dig igennem:',
      useChat: [
        { text: 'Saving clip...', tone: 'plain' },
        { text: 'Uploading clip to the clan Discord...', tone: 'plain' },
        { text: 'Clip posted to the clan Discord.', tone: 'green' },
      ],
      reminder: {
        tag: 'Husk',
        body: 'Klippet dækker sekunderne _før_, du trykkede — så tryk efter øjeblikket, ikke under. Du har hele bufferens længde til at reagere.',
      },
      decodedHeading: 'Klip-beskeder, oversat',
      decoded: [
        {
          term: '`Clip capture: OBS isn’t connected.`',
          body: 'OBS kører ikke, WebSocket-serveren er slukket, eller host/port/adgangskode passer ikke. Ret det og tryk igen — pluginnet prøver selv at forbinde igen hvert 30. sekund.',
        },
        {
          term: '`OBS could not save the clip — is the Replay Buffer started?`',
          body: 'Bufferen kører ikke. Tjek Enable Replay Buffer i OBS’ output-indstillinger, og slå så Enable clip capture fra og til igen.',
        },
        {
          term: '`Clip saved locally — paste a Clips Discord webhook URL…`',
          body: 'Det virker, som det skal — du har bare ingen webhook sat. Filen ligger i din OBS-optagemappe.',
        },
        {
          term: '`Clip saved locally (48MB) — too big to auto-post.`',
          body: 'Gør kliplængden kortere, sænk kvaliteten på din OBS-optagelse, eller hæv maksstørrelsen, hvis din server accepterer større filer.',
        },
        {
          term: '`…but Discord didn’t accept the upload.`',
          body: 'For stor, rate-limited, eller uploaden løb tør for tid. Filen ligger stadig på din PC — post den i hånden, hvis den er det værd.',
        },
      ],
    },

    trouble: {
      title: 'Når noget går galt',
      intro:
        'Pluginnet siger til i chatten, når trackingen er stoppet — det venter cirka 90 sekunder, før det brokker sig, og gentager højst hvert 5. minut.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Token er forkert eller er blevet roteret. Kopiér den igen fra [Profile → RuneLite plugin](/profile#plugin-token), eller ryd feltet og log ind fra pluginnet igen.',
        },
        {
          term: '`Anvil: can’t reach the site — tracking is OFF.`',
          body: 'Tjek Site URL for tastefejl — den skal være `{origin}`. Er den rigtig, er siden formentlig nede.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Den konto er ikke forbundet endnu. Tilføj den fra Profile → “Accounts we noticed you playing”.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Ingenting. Den kom sig selv.',
        },
      ],
      logHeading: 'Stadig i vanskeligheder? Send en admin en log',
      logBody:
        'Skriv `::anvillog` i spillets chat (eller sæt **Export debug log hotkey** i pluginnets Support-afsnit). Den skriver en logfil til din `.runelite/anvil-debug`-mappe, åbner mappen og kopierer stien til din udklipsholder — send filen til en admin, så kan de se præcis, hvad der gik galt.',
      missingNote: {
        tag: 'Mangler der beviser?',
        body: 'Pets og ekstra Champion’s scrolls kræver et manuelt screenshot. De bliver gemt i `.runelite/osrs-bingo-pending/` og dukker op som en **Saved proofs**-række i Bingo-fanen i Collection Log.',
      },
    },
  },

  admin: {
    metaTitle: 'Sådan afvikler du dit første event — Anvil adminguide',
    metaDescription:
      'Sæt en klan op på Anvil og kør en bingo fra ende til anden: Discord, medlemsliste, brætter, felter, hold og draft, opstart, og hvad der sker, når eventet slutter.',
    eyebrow: 'Anvil · til klanens stab',
    title: 'Sådan afvikler du dit første event',
    dek: 'Hele vejen, i den rækkefølge du faktisk går den: få {clanName} sat op, få medlemslisten ind, byg et bræt, draft hold, sæt det i gang, og del præmierne ud. Cirka en aftens arbejde for den første bingo — minutter for den næste.',
    facts: [
      { strong: '4 trin', rest: 'i opsætningsguiden' },
      { strong: '7 formater', rest: 'at bygge et bræt af' },
      { strong: '1 knap', rest: 'til at synkronisere medlemslisten' },
    ],
    footnote:
      'Denne vejledning følger appen, som den ser ud i dag. Passer en skærm her ikke med det, du kigger på, er appen rigtig, og vejledningen er forældet — [sig til](/feedback), så retter vi den.',

    access: {
      title: 'Hvem må hvad',
      intro:
        'Alle logger ind med Discord — der er ingen kodeord. Den første admin kommer fra serverkonfigurationen; derefter forfremmer en admin folk fra **Clan → Members & staff**. Rollerne stabler nedad: alt en moderator kan, kan en treasurer og en admin også.',
      rows: [
        {
          term: 'Admin',
          body: 'fuld adgang — events, felter, hold, indstillinger, stab, udbetalinger. Giv den til så få, som klanen kan holde ud.',
        },
        { term: 'Treasurer', body: 'alt hvad en moderator kan, plus tilmeldingsgebyrer og udbetalinger.' },
        {
          term: 'Moderator',
          body: 'det daglige: medlemsliste, verificeringer, ugentlige konkurrencer, kalender, feedback. Kan ikke oprette eller redigere events.',
        },
        {
          term: 'Editor',
          body: 'kun oprettelse af felter. Giv den globalt, eller afgræns den til bestemte brætter, så en udefrakommende brætbygger kun kan røre det event, du har givet dem.',
        },
        { term: 'Member', body: 'spiller; har slet ingen adminflade.' },
      ],
      ownerNote: {
        tag: 'Ejer',
        body: 'Én konto er ejeren. Den kan ikke degraderes af andre og er den eneste rolle, der kan give ejerskabet videre — så en tabt diskussion med en med-admin kan aldrig koste dig klanen.',
      },
    },

    setup: {
      title: 'Navngiv klanen, forbind Discord',
      intro:
        '**System → Setup** er en guide i fire trin, og dashboardet holder de samme fire som en tjekliste, indtil de er klaret: navngiv klanen, forbind Discord, opret et event, tilføj felter. Status regnes ud fra rigtige data, så et trin bliver først flueben, når det virkelig er færdigt.',
      discord:
        'Til Discord har du to veje, og de kan kombineres: giv Anvil en **bot**, og den kan oprette webhooks, synkronisere roller og kaldenavne og bygge private holdkanaler for dig; giv den en enkelt **webhook-URL**, og den kan poste beskeder og intet andet. Start med webhooken, hvis du vil være i luften om to minutter, og tilføj botten, når du vil have automatikken.',
      permsNote: {
        tag: 'Bottens rettigheder',
        body: 'Botten skal bruge _Manage Webhooks_, _Manage Roles_, _Manage Channels_ og _Manage Nicknames_, og dens rolle skal ligge _over_ de roller, den styrer, i din servers rolleliste. Ellers nægter Discord i stilhed.',
      },
      hosted:
        'På en hostet plan har du mødt den skærm én gang før: det var ved at tilføje botten under opsætningen, at Anvil fandt ud af, hvilken server der er jeres — derfor var der aldrig et server-ID at kopiere. Det samme link ligger her, når du vil flytte botten til en anden server.',
    },

    channels: {
      title: 'Fordel opslag på flere kanaler',
      body: [
        'Alt lander som standard i én hovedkanal til beskeder. Når den bliver larmende, åbner du **System → Advanced settings → Webhooks** og giver de larmende kategorier deres eget hjem — bingo-events, ugentlige konkurrencer, sjældne drops, dødsfald, PvP-kills, combat achievements, klip. Alt du lader stå tomt falder tilbage til hovedkanalen, så du kan flytte én kategori ad gangen.',
        'Med botten forbundet rører du aldrig en webhook-URL: vælg en kanal i menuen og tryk **Create webhook**. Under et travlt event kan du lægge en webhook nummer to på samme kanal — Anvil skifter mellem dem, så Discords rate limit ikke sluger opslag.',
      ],
      clipsNote: {
        tag: 'Klipkanalen er anderledes',
        body: 'Klipvideoer uploades direkte fra hver spillers PC til Discord — de passerer aldrig denne side. Derfor er klip-webhooken, du sætter her, den ene du _deler ud_: medlemmerne indsætter den selv i deres plugin. Alt andet på denne side er serverside, og medlemmerne ser det aldrig.',
      },
    },

    roster: {
      title: 'Få din medlemsliste ind',
      body: [
        'Medlemskab af klanen kommer ét sted fra: en synkronisering af medlemslisten inde fra spillet. Installér [Anvils RuneLite-plugin]({pluginGuide}) på en _admins_ konto, åbn **Bingo**-fanen i Collection Log i spillet, og tryk **Sync clan roster**. Det skubber jeres faktiske klanliste fra spillet op på siden med ét klik.',
        'Alle, der forbinder eller verificerer en konto på hjemmesiden uden at stå på den liste, er en **gæst** — tracket og synlig, men ikke medlem, før en admin forfremmer dem, eller næste synkronisering samler dem op. Det er med vilje: det betyder, at ingen kan forfremme sig selv ind i jeres klan ved at skrive et navn.',
        'Du kan også tilføje nogen i hånden fra **Clan → Members & staff** — inklusive at tilmelde dem et event på deres vegne, når de ikke kan nå siden.',
      ],
    },

    board: {
      title: 'Opret dit første bræt',
      intro:
        '**Events → All events → New event**. Vælg format først — det afgør, hvordan brættet giver point, og hvad resten af formularen spørger dig om.',
      formats: {
        classic: {
          label: 'Klassisk bingo',
          blurb: 'Et kvadratisk N×N-gitter — holdene tager felterne i vilkårlig rækkefølge, hvert felt tæller 1.',
        },
        leagues: {
          label: 'Leagues-bingo',
          blurb: 'En opgaveliste, hvor hvert felt har sin egen pointværdi — et vilkårligt antal felter.',
        },
        race: {
          label: 'Feltræs',
          blurb: 'En ordnet bane — holdene når felterne i rækkefølge; den, der når længst, vinder.',
        },
        showdown: {
          label: 'Showdown',
          blurb:
            'Felterne er skjult indtil deres planlagte tidspunkt — sæt hver afsløring på Tiles-fanen. Pointbaseret, i DMM All Stars-stil.',
        },
        luckydraw: {
          label: 'Lykketrækning',
          blurb:
            'En bankospiller: skjulte felter går live i tilfældige trækninger med faste mellemrum. Pointbaseret.',
        },
        bounty: {
          label: 'Dusørjagt',
          blurb:
            'Ét åbent felt ad gangen — det første hold, der gør det færdigt, tager pointene, og den næste dusør trækkes.',
        },
        ladder: {
          label: 'Stige',
          blurb:
            'En pointbaseret opgaveliste rangeret som en individuel leaderboard (hold er valgfrit). Opgaverne roterer — progressivt, én ad gangen eller i et rullende vindue — og kan falde i værdi. I stil med en månedsstige.',
        },
      },
      outro:
        'Sæt derefter datoerne, tilmeldingsvinduet, og om tilmelding koster et gebyr. Start fra en skabelon, hvis du helst ikke vil starte med et tomt gitter — galleriet rummer både de indbyggede skabeloner og ethvert bræt, du selv har gemt som skabelon.',
      utcNote: {
        tag: 'Datoer er UTC',
        body: 'Alle tidsstempler i Anvil gemmes og sammenlignes i UTC og vises i hver besøgendes lokale tid. Sæt det sluttidspunkt, du mener; siden viser en brite og en australier to forskellige ure for det samme øjeblik.',
      },
    },

    tiles: {
      title: 'Fyld brættet',
      body: [
        'Eventets **Tiles**-fane er der, hvor et bræt bliver til en bingo. Hvert felt er én _slags_ opgave, og slagsen afgør, hvad pluginnet holder øje med: et drop, en boss-killcount, skill-XP, et NPC-kill, en tid at slå, en achievement diary, en combat achievement, en collection log-oplåsning, et PvP-kill, en gevinst i inventory eller en tur uden dødsfald. Manuelle felter — dem et menneske godkender ud fra et screenshot — er også altid en mulighed.',
        'Til et helt bræt er det hurtigere at skrive dem i bulk: eksportér arket, udfyld det i et regneark, og importér det tilbage. Både CSV og .xlsx kan gå frem og tilbage, og rækkerne følger positionerne, så du kan skrive et helt 25-felters gitter om i én indsætning.',
      ],
      rows: [
        {
          term: 'Sværhedsgrader',
          body: 'pointværdier oversættes til navngivne bånd (easy → elite). Rediger båndene under Advanced settings, hvis din klan graduerer anderledes.',
        },
        {
          term: 'Balance-revisor',
          body: 'gennemgår et færdigt bræt for strukturelle problemer og skæv arbejdsbyrde, før spillerne overhovedet ser det.',
        },
        {
          term: 'Skjult indtil afsløring',
          body: 'nye brætter starter skjulte. Staben ser dem altid; spillerne ser ingenting, før du afslører — så et bræt kan bygges i åbenhed uden at blive spoleret.',
        },
      ],
    },

    teams: {
      title: 'Hold og draft',
      body: [
        'Fanen **Teams & Draft** retter sig efter det format, du valgte: et format uden hold springer den helt over. Til en almindelig holdbingo opretter du holdene, bestemmer hvem der er kaptajner, og enten fordeler spillerne selv eller kører en live draft.',
        'Kaptajnerne drafter fra tilmeldingspuljen i den rækkefølge, du vælger, og hver kaptajn kan se de svar, folk gav i tilmeldingsformularen — fastfrosset som de blev indsendt, så ingen redigerer deres “timer om ugen”, efter de er blevet valgt.',
      ],
      lockNote: {
        tag: 'Draften låser holdene',
        body: 'Så snart en draft er gået i gang, er både holdene og pickrækkefølgen låst. Tilføj det hold, du glemte, _inden_ du trykker start — ikke efter.',
      },
      visitingClans:
        'Spiller I mod en anden klan i stedet for at drafte jeres egne? En gæsteklan stiller sin egen trup gennem ét link, og deres moderator styrer den uden en adminkonto her — se [Vær vært for en gæsteklan]({clanVsClanGuide}).',
    },

    launch: {
      title: 'Start og kør det',
      body: [
        'Afslør felterne, og start så eventet. Anvil nægter at starte et bræt, der ikke er klar — en draft midt i forløbet, eller spillere uden hold — og fortæller dig hvilket. Ved du bedre (en træningskamp, en genkørsel, et bræt du tester), kan du tvinge det igennem.',
        'Derefter kører det stort set sig selv. Pluginnet krediterer automatisk alt, det kan se, og poster bevis-screenshots stemplet med hold og et UTC-tidsstempel. Det, der lander på dit bord, er:',
      ],
      rows: [
        {
          term: 'Indsendelser til godkendelse',
          body: 'manuelle felter og alt, pluginnet har markeret. Godkend eller afvis med beviset foran dig.',
        },
        {
          term: 'Statistik',
          body: 'eventets Stats-fane viser bidraget pr. spiller — nyttigt når et hold diskuterer, hvem der bar hvem.',
        },
        {
          term: 'Beskeder',
          body: 'System → Announce sender en besked til jeres kanaler midt i eventet, uden at du selv skal skrive en webhook.',
        },
      ],
      missionNote: {
        tag: 'Overraskelser undervejs',
        body: 'Du kan slippe en **mission** løs på en igangværende bingo — et skjult bonusfelt, der bliver annonceret, når du fyrer det af, og som eventuelt falder i værdi eller udløber. Det er den billigste måde at vække et bræt på dag fem.',
      },
      startProofNote: {
        tag: 'Sådan stopper du hamstring før eventet',
        body: [
          'Slå **Starting shot** til (event → Overview), så skal hver spiller aflevere ét screenshot taget efter, at eventet er gået i gang, på et sted Anvil trækker i selve startøjeblikket — så ingen kan sidde på en uges opsparede clues og kister ved T0. Stedet annonceres sammen med starten; hver spillers kodeord er personligt, udledt af trækningen, og findes ikke, før eventet starter, så det kan ikke stilles op i forvejen af nogen.',
          'Sæt stederne på verdenskortet (puljeeditoren har et), så tjekker pluginnet, at spillerne rent faktisk står der, i stedet for bare at have fået besked på det. Du kan også kræve en **frisk session** — 15 minutter som standard: hiscores gemmes kun, når en spiller logger ud, så det at få alle til at relogge lige inden deres billede er dét, der gør starttallene bag hvert XP- og KC-felt ærlige.',
          'Plugin-brugere trykker på én knap. Alle andre skriver deres kodeord i spillet og uploader på My Team. Du bestemmer, hvad der sker med en kredit fra en, der ikke har afleveret: markér den til gennemsyn (standard), eller afvis den, indtil de gør. Det samme Overview-panel er gennemsynslisten — billeder fra pluginnet med et verificeret kodeord ankommer allerede godkendt, så i praksis kigger du kun mobilspillerne efter.',
        ],
      },
    },

    after: {
      title: 'Efter det sidste felt',
      intro:
        'Når uret løber ud, fryser brættet, og eventet låses — point, bidrag og hvem-gjorde-hvad fastfryses, som de stod. Skal noget rettes bagefter, kan en admin bevidst låse det op igen.',
      rows: [
        {
          term: 'Udbetalinger',
          body: 'eventets Payouts-fane laver præmiepuljen om til en liste over, hvem der får hvad, og følger med, mens du betaler ud.',
        },
        {
          term: 'Opsamling',
          body: 'en offentlig opsamlingsside med de endelige stillinger og sjove kåringer — største drop, flest kills og resten.',
        },
        {
          term: 'Spørgeskema',
          body: 'spørg klanen, hvad de synes. Byg det på Survey-fanen; spillerne svarer, når eventet er slut, og kun staben ser resultaterne.',
        },
        {
          term: 'Gem som skabelon',
          body: 'behold det bræt, du lige har bygget. Næste bingo starter fra det i stedet for et tomt gitter.',
        },
      ],
      federation:
        'Med federation slået til kan medlemmerne også forbinde sig til andre Anvil-klaner fra pluginnet — praktisk til events på tværs af klaner, og helt frivilligt for det enkelte medlem.',
      outro: 'Send så dine medlemmer videre til [opsætningsguiden til spillere]({pluginGuide}), og begynd at planlægge den næste.',
    },
  },

  clanVsClan: {
    metaTitle: 'Vær vært for en gæsteklan — Anvil værtsguide',
    metaDescription:
      'Kør en clan-mod-clan på Anvil: giv hver gæsteklan et invitationslink, der sætter deres spillere på ét hold, og en plads så deres egen moderator styrer deres halvdel.',
    eyebrow: 'Anvil · til værter',
    title: 'Vær vært for en gæsteklan',
    dek: 'Du er vært for brættet; de stiller truppen. Det er den vej, der sparer dig for at samle et dusin RSN’er ind i en DM — ét link pr. hold, og en plads der lader deres egen moderator styre deres halvdel af eventet.',
    facts: [
      { strong: '1 link', rest: 'pr. gæstehold' },
      { strong: '0 adminpladser', rest: 'givet til udefrakommende' },
      { strong: '~5 min', rest: 'pr. klan du inviterer' },
    ],
    footnote:
      'Skærmbillederne er fra en rigtig opsætning på et testbræt — invitationstokens og Discord-navne er slørede. Et rigtigt link er værd at passe på: alle, der har det, kan tage en plads på det hold, så længe det er aktivt.',

    shape: {
      title: 'Det, du er ved at sætte op',
      body: [
        'En clan-mod-clan er et helt almindeligt event med én forskel: halvdelen af spillerne er ikke i din klan og bliver det aldrig. De kan ikke synkroniseres ind fra medlemslisten, du vil ikke forfremme dem, og du vil bestemt ikke tilmelde tyve af dem i hånden og derefter trække hver enkelt over på det rigtige hold.',
        'To ting løser det, og de er uafhængige — brug den ene, eller begge.',
      ],
      rows: [
        {
          term: 'Et invitationslink',
          body: 'en URL, du laver én gang til ét hold. Den, der åbner den, logger ind, udfylder den normale tilmeldingsformular og lander på det hold allerede godkendt — ingen draftpulje, ingen godkendelseskø.',
        },
        {
          term: 'En plads i holdstaben',
          body: 'en navngiven person, der kan styre _netop det ene hold_ — dets trup, dets indsendelser og beviser, dets gebyrer — uden en adminkonto her, og uden at tage kaptajnpladsen fra den, der faktisk spiller.',
        },
      ],
      note: {
        tag: 'Hvad et invitationslink ikke er',
        body: 'Det er ikke et login og ikke en genvej uden om verificering. Den, der åbner det, logger stadig ind med Discord og skal stadig have et verificeret RSN, præcis som ved enhver anden tilmelding. Det eneste, linket afgør, er _hvilket hold_ tilmeldingen kommer på, og at den ikke skal godkendes af nogen.',
      },
    },

    team: {
      title: 'Lav holdet først',
      body: [
        'Åbn dit event og gå til fanen **Teams & Draft**. Opret ét hold pr. klan, du har inviteret, og opkald det efter dem — navnet er det, deres spillere ser i tilmeldingsformularen, så “Ironforge” slår “Hold 2”.',
        'Du behøver _ikke_ køre en draft. Invitationslinks og en draft er alternativer: en draft fordeler en fælles tilmeldingspulje, et link sætter folk direkte på plads. Ved en ren clan-mod-clan opretter de fleste værter holdene, deler ét link ud til hver, og åbner aldrig draften.',
        'Åbn så selve holdet — **Teams & Draft → holdet** — for det er der, begge de næste to trin foregår.',
      ],
      captainNote: {
        tag: 'Kaptajnen først',
        body: 'Udpeg gæsteklanens kaptajn, før du deler linket ud, så holdsiden har en ejer fra starten. At udpege en kaptajn sætter dem samtidig på holdet; advarer kortet om, at de ikke står på truppen, så tag imod den rettelse, det tilbyder.',
      },
    },

    staff: {
      title: 'Giv deres moderator en plads',
      body: [
        'Panelet **Team staff** på holdsiden er måden, gæsteklanens egen moderator kommer i gang på, uden at du giver dem noget som helst på din side. Tryk **Add someone**, søg dem frem, skriv en note som “Ironforges mod”, så den næste admin ved, hvorfor de er der, og tryk **Give a seat**.',
      ],
      figure: {
        caption: 'Event → Teams & Draft → holdet → Team staff',
        alt: 'Team staff-panelet med én tildelt plads og søgefeltet til at tilføje flere åbent',
        legend: [
          {
            label: 'Add someone',
            body: 'åbner søgningen. Kun folk, der har logget ind her med Discord mindst én gang, kan dukke op — se noten nedenfor.',
          },
          {
            label: 'Noten',
            body: 'fri tekst, 120 tegn. Skriv hvilken klan de kommer fra. Pladser bliver stående på listen efter eventet, og “hvem er det her?” er præcis det spørgsmål, du sidder med om tre måneder.',
          },
          {
            label: 'Remove',
            body: 'tager pladsen tilbage med det samme. Gør det, når eventet er slut — en plads er ikke tidsbegrænset af sig selv.',
          },
        ],
      },
      canDo: 'Hvad en plads kan, udelukkende på det hold:',
      canDoList: [
        'se og styre holdets trup',
        'håndtere dets indsendelser og beviser',
        'markere dets spilleres gebyrer som betalt',
        'lave invitationslinks til det, hvis du slår det til (næste trin på nær ét)',
      ],
      cantDo: 'Hvad den aldrig kan:',
      cantDoList: [
        'røre noget som helst andet hold',
        'redigere brættet eller dets felter',
        'foretage draftvalg',
        'skifte nogen ud, når eventet først er i gang',
      ],
      note: {
        tag: 'De skal logge ind her først',
        body: 'Søgningen viser kun konti med et forbundet Discord — en plads hænger på en person, der rent faktisk kan logge ind. Så send gæsteklanens moderator ind på siden, få dem til at trykke **Login** én gang, og giv _derefter_ pladsen. Dukker de ikke op i søgningen, er det login ikke sket endnu.',
      },
    },

    link: {
      title: 'Lav invitationslinket',
      body: [
        'Stadig på holdsiden: panelet **Invite links** laver linket. To felter afgør, hvad linket lover, og begge forstår `0` som “lov ikke noget”.',
      ],
      figure: {
        caption: 'Event → Teams & Draft → holdet → Invite links',
        alt: 'Invite links-panelet med felterne til pladser og udløb, knappen Make a link, og ét aktivt link på listen',
        legend: [
          {
            label: 'Seats og Expires in hours',
            body: 'hvor mange personer linket må sætte på plads (op til 100), og hvor længe det holder (op til 30 dage). Sæt pladserne til størrelsen på den trup, de har lovet dig, så lukker linket sig selv, når de alle er inde; sæt et udløb, når linket skal ud i en offentlig Discord. `0` i et af felterne betyder ingen grænse.',
          },
          {
            label: 'Make a link',
            body: 'laver det og kopierer det til din udklipsholder med det samme. Send det til dem, før du gør noget andet.',
          },
          {
            label: 'Listen over aktive links',
            body: 'alle links, holdet har ude, med hvor mange der er kommet ind, og hvor mange pladser der er tilbage. **Copy** henter det igen; **Turn off** dræber det for altid.',
          },
        ],
      },
      shape:
        'Linket ser sådan ud: `{origin}/events/{eventId}/join/{token}` — én linje, sikker at indsætte i en Discord-besked.',
      note: {
        tag: 'Fornuftige standardvalg',
        body: 'Til en clan-mod-clan, hvor du har aftalt truppen med én moderator, så lad begge felter stå på `0`, og lad dem styre det. Grib til pladser og udløb, når linket skal et sted hen, du ikke selv kontrollerer.',
      },
      revoke:
        'At slukke et link virker med det samme og fjerner ikke nogen, der allerede er kommet ind — de er helt almindelige spillere på holdet nu. Vil du tage nogen af, gør du det fra holdets trup.',
    },

    captains: {
      title: 'Lad dem lave deres egne links',
      body: [
        'Som udgangspunkt er det kun en vært, der kan lave links, og en kaptajn, der prøver, får det at vide. Den standard er rigtig til et almindeligt klanevent — en kaptajn, der deler pladser ud, ville fylde en trup, ingen har godkendt — og forkert til en clan-mod-clan, hvor gæsteklanen kender sin egen trup bedre end du gør.',
        'Kontakten sidder på det samme **Invite links**-panel: **Let captains make their own links**. Den gælder _hvert hold i dette event_, ikke kun det, du står på — hvilket netop er, hvad du vil have, når begge sider er gæsteklaner.',
        'Med den slået til kan holdets kaptajn og alle med en plads i holdstaben selv lave links fra **My Team → Invite links**. De får det samme panel som dig, minus kontakten.',
      ],
      figure: {
        caption: 'My Team → holdet → Invite links',
        alt: 'Invite links-fanen set fra kaptajnens side i holdcentret, med felterne til pladser og udløb og ét aktivt link',
        legend: [
          {
            label: 'Samme panel, kaptajnens udgave',
            body: 'lav, kopiér, sluk. Har værten ikke slået kontakten til, står der “Only a host can make links for this event”, og felterne er væk.',
          },
          {
            label: 'Listen over aktive links',
            body: 'en kaptajn, der ikke må lave links, kan stadig se dem, holdet har ude — så de kan bede dig om et til i stedet for at gå ud fra, at der ingen er.',
          },
        ],
      },
    },

    player: {
      title: 'Det, deres spillere ser',
      intro:
        'Værd at gå igennem én gang selv, før du deler linket ud, så du kan svare på spørgsmål om det.',
      steps: [
        'De åbner linket. Er de ikke logget ind, logger de ind med Discord først og kommer direkte tilbage — linket går ikke tabt undervejs.',
        'De lander på den helt normale tilmeldingsformular med et banner, der siger **You’re joining {teamExample} by invite**. Samme spørgsmål, samme kontovælger, samme gebyr som alle andre.',
        'Når de sender ind, er de på holdet og godkendt. Ingen handling fra værten, ingen draft.',
      ],
      figure: {
        caption: 'Tilmeldingsformularen, åbnet gennem et invitationslink',
        alt: 'Eventets tilmeldingsformular med et banner om, at spilleren er ved at komme på et navngivet hold via invitation',
        legend: [
          {
            label: 'Invitationsbanneret',
            body: 'nævner det hold, de er ved at komme på. Står der et forkert hold, har de det forkerte link — stop og tjek, inden de sender ind.',
          },
          {
            label: 'Resten af formularen',
            body: 'uændret. Et verificeret RSN er stadig påkrævet, tilmeldingsspørgsmålene bliver stadig stillet, og et tilmeldingsgebyr gælder stadig.',
          },
        ],
      },
      note: {
        tag: 'Allerede tilmeldt?',
        body: 'Har nogen meldt sig til på normal vis først og sidder i puljen, flytter linket dem over på holdet i stedet for at oprette en ekstra tilmelding. En, der allerede er godkendt på et andet hold, bliver ladt i fred — flyt dem fra truppen i stedet.',
      },
    },

    dead: {
      title: 'Når et link holder op med at virke',
      intro:
        'Et afvist link forklarer sig selv på siden i stedet for at give en 404, så den, der sidder med det, kan fortælle dig, hvilken af disse det er.',
      rows: [
        {
          term: 'This invite has been turned off.',
          body: 'Nogen har trykket **Turn off**. Lav et nyt — et gammelt link kommer aldrig tilbage.',
        },
        {
          term: 'This invite has expired.',
          body: 'Det ramte de timer, du satte. Lav et nyt, denne gang med `0` timer, hvis udløbet ikke gør nogen nytte.',
        },
        {
          term: 'This invite is full.',
          body: 'Alle pladser er taget. Du hæver det ved at lave et nyt link med flere pladser — antallet ligger fast, når først et link findes.',
        },
        {
          term: 'Sign-ups for this event aren’t open.',
          body: 'Den eneste, der kan løse sig selv. Tjek eventets tilmeldingsvindue: er det åbnet endnu, er fristen løbet ud, eller er eventet allerede gået i gang.',
        },
        {
          term: 'That invite belongs to a different event.',
          body: 'Et link fra et andet bræt er blevet indsat. Tjek at event-id’et i URL’en er det, du mente.',
        },
      ],
      checklist: 'Gå denne liste igennem én gang pr. gæsteklan, inden eventet går i gang:',
      checklistItems: [
        'deres hold findes og er opkaldt efter dem',
        'deres kaptajn er udpeget og sidder på holdet',
        'deres moderator har logget ind her og har en plads i holdstaben',
        'linket er lavet, kopieret og faktisk afleveret til et menneske',
        'tilmeldingsvinduet er åbent, så længe de har brug for det',
      ],
      note: {
        tag: 'Når det er slut',
        body: 'Sluk linkene og fjern pladserne i holdstaben. Ingen af delene udløber af sig selv, og et aktivt link på et afsluttet event er bare en løs ende.',
      },
    },
  },
};

export default da;
