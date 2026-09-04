import type { PartialGuideDict } from './en';

// Polski — Polish.
//
// Ta sama zasada co w pozostałych plikach językowych: po angielsku zostaje wszystko, co czytelnik
// naprawdę widzi na ekranie —— menu RuneLite i OBS, linie czatu wypisywane przez sam plugin oraz
// etykiety panelu administracyjnego Anvil (po angielsku, dopóki te ekrany nie zostaną
// przetłumaczone). Przetłumaczone „Tracked drop detected” sprawia, że ktoś szukający tej linii już
// jej nie znajdzie. Cała reszta —— wyjaśnienia, kolejność, powody —— jest po polsku.

const pl: PartialGuideDict = {
  common: {
    contents: 'Spis treści',
    step: 'Krok',
    optional: 'opcjonalnie',
    minRead: 'czytanie: {n} min',
    language: 'Język',
    partialNotice:
      'Ten przewodnik jest przetłumaczony na język {language} tylko częściowo. Wszystko, czego jeszcze nie przetłumaczono, pokazuje się po angielsku.',
    backToGuides: 'Wszystkie przewodniki',
    unreviewedNotice:
      'To tłumaczenie na język {language} nie zostało jeszcze sprawdzone przez native speakera. Jeśli jakieś zdanie brzmi źle, [strona angielska]({englishHref}) jest oryginałem —— a [zgłoszenie nam tego](/feedback) jest tym, co doprowadza do poprawki.',
  },

  index: {
    metaTitle: 'Przewodniki — Anvil',
    metaDescription:
      'Przewodniki konfiguracyjne Anvil: plugin do RuneLite dla graczy, prowadzenie wydarzenia dla sztabu klanu i goszczenie klanu z zewnątrz.',
    title: 'Przewodniki',
    dek: 'Wszystko, czego potrzeba, żeby wystartować, napisane dla tej wersji Anvil, która działa właśnie tutaj.',
    groups: {
      playing: 'Granie',
      running: 'Prowadzenie wydarzenia',
      clan: 'Prowadzenie klanu',
    },
    cards: {
      plugin: {
        eyebrow: 'Dla graczy',
        title: 'Konfiguracja pluginu RuneLite',
        blurb:
          'Zainstaluj plugin, połącz go z tą stroną i pozwól mu wysyłać twoje dropy. Obejmuje też powiadomienia na Discordzie i klipy z OBS.',
        minutes: '~3 min konfiguracji',
      },
      admin: {
        eyebrow: 'Dla sztabu klanu',
        title: 'Prowadzenie pierwszego wydarzenia',
        blurb:
          'Discord, synchronizacja składu klanu, plansze, pola, drużyny i draft, start, oraz co robić, gdy wydarzenie się skończy.',
        minutes: 'jeden wieczór, raz',
      },
      board: {
        eyebrow: 'Dla budujących plansze',
        title: 'Plansza, która zalicza się sama',
        blurb:
          'Co naprawdę widzi każdy rodzaj pola, pisanie hurtem w arkuszu i błędy, które importują się bez zarzutu, a potem nigdy nie zadziałają.',
        minutes: '~8 min',
      },
      captain: {
        eyebrow: 'Dla kapitanów',
        title: 'Przewodnik kapitana',
        blurb:
          'Czytanie puli zanim ruszy zegar, sam dzień draftu i te części prowadzenia drużyny, które zaczynają się dopiero po nim.',
        minutes: '~6 min',
      },
      formats: {
        eyebrow: 'Dla sztabu klanu',
        title: 'Formaty i sposoby odsłaniania pól',
        blurb:
          'Siedem kształtów planszy, pięć sposobów, w jakie pole staje się grywalne, i trzy modyfikatory decydujące, ile warte jest ukończenie.',
        minutes: '~5 min',
      },
      fees: {
        eyebrow: 'Dla skarbników',
        title: 'Wpisowe i wypłaty',
        blurb:
          'Ustalanie wpisowego, zbieranie go, drugi podpis, który je zamyka, i zamiana puli nagród w faktycznie wypłacone miejsca.',
        minutes: '~5 min',
      },
      moderator: {
        eyebrow: 'Dla moderatorów',
        title: 'Na dyżurze',
        blurb:
          'Kolejka, weryfikacja zgłoszeń i kont, utrzymywanie składu w zgodzie z prawdą, i decyzje, które trafiają do człowieka.',
        minutes: '~5 min',
      },
      clanVsClan: {
        eyebrow: 'Dla gospodarzy',
        title: 'Goszczenie klanu z zewnątrz',
        blurb:
          'Klan kontra klan bez zbierania choćby jednego RSN-a ręcznie: jeden link z zaproszeniem na drużynę i miejsce, dzięki któremu ich moderator prowadzi własną połowę.',
        minutes: '~5 min na drużynę',
      },
    },
  },

  plugin: {
    metaTitle: 'Konfiguracja pluginu RuneLite — Anvil',
    metaDescription:
      'Zainstaluj plugin Anvil do RuneLite, połącz go z tą stroną i skonfiguruj powiadomienia na Discordzie oraz klipy z OBS.',
    eyebrow: 'Anvil · plugin RuneLite',
    title: 'Przewodnik konfiguracji dla graczy',
    dek: 'Zainstaluj, wskaż mu {clanName} i graj. Plugin wysyła twoje dropy z bingo, wrzuca na Discorda rzadkie dropy i śmierci, a —— jeśli używasz OBS —— zapisuje i publikuje klipy z momentów wartych obejrzenia jeszcze raz.',
    facts: [
      { strong: '2 pola', rest: 'żeby ruszyć ze śledzeniem' },
      { strong: '~3 min', rest: 'na podstawową konfigurację' },
      { strong: 'Klipy', rest: 'wymagają OBS i 5 minut więcej' },
    ],
    footnote:
      'Zrzuty ekranu pochodzą z działającej konfiguracji —— token konta, adres OBS i webhook Discorda są celowo zamazane. Twoje powinny pozostać równie prywatne.',

    install: {
      title: 'Zainstaluj plugin',
      body: [
        'W RuneLite: **Configuration** (klucz) → **Plugin Hub** → wyszukaj **Anvil** → **Install**. Wydawcą jest `AhmedFathy2001`.',
        'Jeden plugin obsługuje każdy klan —— w następnym kroku wskazujesz mu tę stronę, więc nie ma nic klanowego do pobrania. Po instalacji otwórz **Configuration → Anvil**, żeby dostać się do panelu ustawień pokazywanego w całym tym przewodniku.',
      ],
    },

    connect: {
      title: 'Połącz z tą stroną',
      intro: 'Do startu liczy się tylko sekcja **Setup**. Cała reszta ma rozsądne wartości domyślne.',
      figure: {
        caption: 'Configuration → Anvil → Setup',
        alt: 'Sekcja Setup pluginu Anvil z zaznaczonymi polami Site URL i Account Token',
        legend: [
          {
            label: 'Site URL',
            body: 'dla {clanName} to `{origin}`. Przychodzi puste, więc musisz je wypełnić. Ukośnik na końcu nie jest potrzebny, a `https://` zostanie dodane, jeśli je pominiesz.',
          },
          {
            label: 'Account Token',
            body: 'twój osobisty klucz do tej strony. Albo pozwól pluginowi wypełnić go za ciebie (niżej), albo wklej go sam. Traktuj go jak hasło.',
          },
        ],
      },
      easyHeading: 'Łatwa droga: zaloguj się z pluginu',
      easyIntro:
        'Z ustawionym Site URL i wciąż pustym tokenem **panel boczny Anvil** pokazuje przycisk **Sign in with Discord**. Kliknij go, a plugin przeprowadzi cię przez resztę —— bez kopiowania czegokolwiek.',
      easySteps: [
        'Panel pokazuje kod i otwiera przeglądarkę na tej stronie.',
        'Sprawdź, czy kod na stronie zgadza się z tym w RuneLite, a potem kliknij **Approve**.',
        'Panel napisze _Signed in_ i wypełni Account Token za ciebie.',
      ],
      linkFigure: {
        caption: 'Ta strona → /link-device',
        alt: 'Strona „Link your RuneLite client” z zaznaczonym polem kodu i przyciskiem Approve',
        legend: [
          { label: 'Kod', body: 'musi zgadzać się z tym, który plugin pokazuje ci w tej chwili.' },
          {
            label: 'Approve',
            body: 'zatwierdzaj wyłącznie kod, który wyświetla _twój własny_ klient. Jeśli ktoś przysłał ci link albo kod, odrzuć —— zatwierdzenie oddałoby mu twoje konto.',
          },
        ],
      },
      brokeredNote: {
        tag: 'Skąd bierze się druga domena',
        body: [
          'Zatwierdzanie odbywa się tutaj, na `{origin}`. Jeśli nie jesteś jeszcze zalogowany na stronie, krok logowania prowadzi przez wspólne logowanie Discordem Anvil na `anvilosrs.com`, żeby potwierdzić twoją tożsamość na Discordzie, i odsyła cię prosto tutaj —— to to samo logowanie, które dostajesz z przycisku Login na tej stronie, a nie część przepływu pluginu.',
          'Sam plugin rozmawia wyłącznie z `{origin}`: odmawia otwarcia jakiejkolwiek strony logowania, która nie leży pod wpisanym przez ciebie Site URL.',
        ],
      },
      directNote: {
        tag: 'Gdzie to wszystko się dzieje',
        body: [
          'Cały ten przepływ zostaje na `{origin}` —— kod jest wydawany tutaj, zatwierdzany tutaj logowaniem Discordem klanu {clanName}, a token wraca tutaj. Plugin odmawia otwarcia jakiejkolwiek strony logowania, która nie leży pod wpisanym przez ciebie Site URL, więc nic w tym kroku nie trafia do innej instancji Anvil.',
        ],
      },
      federationAside:
        'Nie mylić z **Connect clans** w panelu bocznym —— to osobny, opcjonalny przycisk, który łączy cię z innymi klanami Anvil, i pojawia się dopiero, gdy jesteś już tutaj zalogowany.',
      manualFallback:
        'Jeśli przeglądarka nie otworzy się sama, panel wypisze adres i kod, żebyś mógł otworzyć go ręcznie. Kody wygasają po dziesięciu minutach —— po prostu naciśnij przycisk jeszcze raz.',
      manualHeading: 'Droga ręczna: skopiuj swój token',
      manualIntro:
        'Zaloguj się Discordem i otwórz [Profil](/profile), a potem przewiń do karty **RuneLite plugin**.',
      tokenFigure: {
        caption: 'Profil → RuneLite plugin',
        alt: 'Karta RuneLite plugin na stronie profilu z zaznaczonym polem tokenu i przyciskami Reveal, Copy i Rotate',
        legend: [
          {
            label: 'Twój token',
            body: 'ukryty, dopóki nie naciśniesz Reveal. Na tym zrzucie jest celowo zamazany; nigdy nie wrzucaj swojego na Discorda.',
          },
          {
            label: 'Copy / Rotate',
            body: 'skopiuj go do pola Account Token w pluginie. Rotate wydaje nowy i unieważnia stary —— użyj go, jeśli podejrzewasz, że token wyciekł.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Warto wiedzieć',
        body: ['Jeden token obejmuje wszystkie wydarzenia, na które jesteś tu zapisany —— nigdy nie wklejasz go ponownie do każdego bingo.'],
      },
    },

    accounts: {
      title: 'Podłącz swoje konta —— po prostu graj',
      body: [
        'Nie ma żadnego kodu do przepisywania. Gdy token jest już wpisany, każde konto, na które się zalogujesz, zostaje automatycznie dopasowane do twojego profilu.',
        'Plugin wysyła twoją nazwę w grze wraz ze stabilnym odciskiem konta przy każdym żądaniu, a strona dopasowuje najpierw po odcisku —— dzięki temu powiązania przeżywają zmianę nazwy. Zaloguj się raz na alta, a pojawi się na twoim Profilu w sekcji _Accounts we noticed you playing_ z przyciskiem **Add**.',
      ],
      figure: {
        caption: 'Profil → RuneScape Accounts',
        alt: 'Karta RuneScape Accounts na stronie profilu z listą kont zweryfikowanych przez plugin',
        legend: [
          {
            label: 'Twoje podłączone konta',
            body: 'wszystko oznaczone „Verified via plugin” trafiło tam wyłącznie dlatego, że na tym koncie grano. Dodawaj tylu altów, ilu chcesz; jedno konto jest głównym.',
          },
        ],
      },
      noPluginHeading: 'Nie możesz używać pluginu?',
      noPluginIntro:
        'Na telefonie albo na oficjalnym kliencie połącz konto na stronie —— Profil pokazuje obie opcje:',
      noPluginOptions: [
        '**Verify by XP** —— wpisz swój RSN, strona losuje umiejętność, zdobądź w niej 1000 XP w ciągu 30 minut.',
        '**Manual review** —— dla ukrytych Hiscores albo świeżych altów: wysyłasz RSN z notatką, a moderator zatwierdza.',
      ],
      signupNote: 'Zapis na wydarzenie wymaga co najmniej jednego zweryfikowanego konta, więc załatw to przed zapisem.',
    },

    working: {
      title: 'Sprawdź, czy działa',
      intro: 'Zaloguj się i przeczytaj czat. Plugin wita cię, gdy jest połączony i trwa wydarzenie.',
      chat: [
        { text: 'Bingo running: Summer Bingo 2026.', tone: 'gold' },
        { text: 'Skill of the Week is live: Runecraft.', tone: 'gold' },
        { text: '…później, w miarę jak coś się dzieje…', tone: 'muted' },
        { text: 'Tracked drop detected: Dragon warhammer (1/1)', tone: 'plain' },
        { text: 'Tracked kill: Zulrah (7/10)', tone: 'plain' },
      ],
      outro:
        'Zobaczysz też, jak **panel boczny Anvil** wypełnia się twoimi klanami, trwającymi wydarzeniami, twoją pozycją i przyciskami synchronizacji — a na pasku tytułu Collection Log w grze pojawia się przycisk **Anvil**, obok WikiSync i RuneProfile.',
      guestNote: {
        tag: 'Gość a członek',
        body: 'Jeśli czat mówi _Tracked as a guest_, jesteś śledzony, ale nie ma cię jeszcze na składzie klanu. Admin naprawia to, synchronizując skład klanu z gry —— poproś {discordLink}.',
        discordWord: 'na Discordzie',
      },
    },

    bingo: {
      title: 'Ustawienia bingo',
      intro:
        'Liczą się tylko wtedy, gdy jesteś w wydarzeniu. Wartości domyślne są w porządku —— tu jest, co każda z nich naprawdę robi.',
      figure: {
        caption: 'Configuration → Anvil → Bingo',
        alt: 'Sekcja Bingo w konfiguracji pluginu z każdym ustawieniem zaznaczonym i ponumerowanym',
        legend: [
          {
            label: 'Auto Submit Drops',
            body: 'robi zrzut i wysyła śledzony drop w chwili, w której wypadnie. Zostaw włączone; o to w tym wszystkim chodzi.',
          },
          {
            label: 'Show Overlay',
            body: 'rysuje mały panel _Anvil / drużyna / data UTC_ w lewym górnym rogu. Staje się częścią obrazu na twoich zrzutach dowodowych i to właśnie sprawia, że dowód trudno podrobić albo antydatować. Na tym zrzucie jest wyłączony —— włącz go, jeśli twój klan chce widzieć drużynę i czas na każdym dowodzie.',
          },
          {
            label: 'Team completion popups',
            body: 'baner, gdy ktokolwiek z twojej drużyny kończy pole. Kilka naraz: najtrudniejsze dostaje baner, reszta idzie na czat.',
          },
          {
            label: 'Distinct mission sound',
            body: 'nadaje pojawiającej się misji — i komuś, kto ją zgarnia — własny dźwięk, żebyś odróżnił ją od zwykłego pola bez patrzenia.',
          },
          {
            label: 'Banner sound + volume',
            body: 'odtwarza dźwięk razem z banerem. Nic nie zabrzmi, dopóki sam nie dodasz przynajmniej jednego pliku .wav przez **Add clip** pod „Banner sounds” w panelu bocznym Anvil.',
          },
          {
            label: 'Two-frame drop proof',
            body: 'wtapia w zrzut drugą klatkę kilka sekund później, gdy łup opadnie już na ziemię. Zostaw włączone; oszczędza kłótni.',
          },
        ],
      },
      startHeading: 'Zdjęcie startowe',
      startBody: [
        'Niektóre wydarzenia proszą wszystkich o **zdjęcie startowe**: jeden zrzut zrobiony po starcie wydarzenia, w miejscu wylosowanym w momencie startu. To powstrzymuje kogokolwiek od spędzenia poprzedniego tygodnia na gromadzeniu clue, skrzynek i killi, żeby zrzucić je pierwszego dnia.',
        'Jeśli używasz pluginu, nie musisz nic przygotowywać. Gdy wydarzenie ruszy, dostajesz linię na czacie z informacją, dokąd iść, a panel boczny Anvil pokazuje przycisk **Take starting shot**. Stań tam, gdzie napisano, naciśnij raz i gotowe —— plugin łapie klatkę, wypala na niej twój RSN, drużynę, miejsce i słowo kluczowe, które przypada tylko twojemu kontu, i archiwizuje ją za ciebie.',
        'Zanim cokolwiek zarchiwizuje, sprawdza dwie rzeczy, żebyś poprawił je w grze, a nie w kłótni na Discordzie po fakcie. Jeśli gospodarz przypiął miejsce na mapie, plugin wie, jak daleko jesteś, i mówi ci o tym, zamiast wysyłać zdjęcie z drugiego końca Gielinoru. A jeśli wydarzenie wymaga świeżej sesji, musisz się **wylogować i zalogować z powrotem** przed zrobieniem zdjęcia: twoje hiscores zapisują się dopiero przy wylogowaniu, więc relog tuż przed zdjęciem jest tym, co sprawia, że twoje startowe sumy —— a więc i każde pole XP i KC —— są poprawne.',
        'Na telefonie albo bez pluginu: otwórz **My Team** na tej stronie, odczytaj swoje słowo kluczowe z karty zdjęcia startowego, wpisz je na czacie w grze, zrób zrzut gry z widoczną postacią i słowem kluczowym i wgraj go na tej samej karcie. Takie wgranie liczy się natychmiast —— możesz grać, gdy tylko trafi, a sztab przejrzy je później. Jeśli karta o to prosi, najpierw wyloguj się i zaloguj z powrotem.',
      ],
    },

    notifications: {
      title: 'Powiadomienia na Discordzie',
      intro:
        'Działają niezależnie od tego, czy trwa bingo, i trafiają na kanały klanu. Który kanał, ustawiają adminowie —— ty wybierasz tylko _co_ publikujesz.',
      dropsFigure: {
        caption: 'Śmierci i kille · Dropy i pety',
        alt: 'Sekcje powiadomień „Deaths and kills” oraz „Drops and pets” z każdym ustawieniem zaznaczonym i ponumerowanym',
        legend: [
          { label: 'Notify on death', body: 'publikuje na klanowym kanale śmierci wraz ze zrzutem z chwili, w której zginąłeś.' },
          { label: 'Death message', body: 'twoja własna linia. `{name}` jest zastępowane twoim RSN-em.' },
          { label: 'Notify on PvP kill', body: 'zrzut z ticka, w którym cel spada do 0 HP. Domyślnie wyłączone; tutaj włączone.' },
          { label: 'Notify on rare drops', body: 'główny przełącznik wpisów o dropach.' },
          {
            label: 'Min drop value / Min drop rarity',
            body: 'dwie niezależne drogi do wpisu: wart co najmniej tyle (GE albo high alch, co większe) albo rzadszy niż 1 na N (domyślnie 1/10 000 —— luźniejsze ustawienia zapychają kanał ziołami). Twój klan może ustawić próg rzadkości obowiązujący wszystkich; twój i tak obowiązuje, gdy jest ostrzejszy. Wpisz 0, żeby wyłączyć jedną z dróg.',
          },
          { label: 'Screenshot rare drops', body: 'dołącza obraz, nie tylko tekst.' },
          {
            label: 'Loot key value',
            body: 'loot key publikuje się raz, jako jedno powiadomienie, gdy cała jego zawartość przekroczy tę liczbę.',
          },
          { label: 'Notify on pets + Screenshot pets', body: 'pety trafiają na kanał rzadkich dropów.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · poziomy · dzienniki · questy',
        alt: 'Sekcja powiadomień Combat achievements z każdym ustawieniem zaznaczonym i ponumerowanym',
        legend: [
          { label: 'Notify on combat achievements', body: 'ukończenia całych tierów zawsze się publikują, gdy to jest włączone.' },
          {
            label: 'CA task min tier',
            body: 'jak głośne są pojedyncze ukończone zadania. Tu Elite; domyślnie Master. Ustaw Grandmaster, żeby zostały tylko najrzadsze.',
          },
          { label: 'Notify on 99s & high totals', body: '99-tki, każde 100 poziomów total od 1800 wzwyż, i max.' },
          { label: 'Notify on diary completions', body: 'tiery achievement diary.' },
          {
            label: 'Announce quest completions',
            body: 'od wybranej trudności wzwyż. Tutaj „All quests”; domyślnie Master & up.',
          },
        ],
      },
    },

    clips: {
      title: 'Klipy z OBS',
      intro: [
        'Naciskasz jeden klawisz i ostatnie 30 sekund zostaje zapisane i wrzucone na klanowy kanał klipów. Domyślnie wyłączone i wymaga uruchomionego OBS —— ale to najbliższa rzecz do rolki z highlightami, jaką twój klan dostanie.',
        'Jak to działa: OBS trzyma przewijany **replay buffer** z ostatnich X sekund. Twój skrót każe OBS zrzucić ten bufor do pliku, a plugin bierze plik i wysyła go na webhook Discorda, który wklejasz.',
      ],
      privacyNote: {
        tag: 'Dokąd trafia twoje wideo',
        body: 'Klipy wysyłane są **prosto z twojego PC na Discorda**. Nigdy nie przechodzą przez tę stronę, a jeśli zostawisz pole webhooka puste, nic w ogóle nie zostanie wysłane —— klipy po prostu zostają na twoim komputerze.',
      },
      obsHeading: 'A. Skonfiguruj OBS (raz)',
      obsSteps: [
        'Potrzebujesz **OBS Studio 28 lub nowszego** —— serwer WebSocket jest wbudowany od wersji 28, nic dodatkowego do pobrania.',
        'Upewnij się, że OBS faktycznie przechwytuje grę: źródło Game / Window / Display Capture pokazujące RuneLite. Jeśli OBS nie widzi twojego klienta, twoje klipy będą czarnym prostokątem.',
        '**Settings → Output** → zaznacz **Enable Replay Buffer**. (W trybie Simple jest to na stronie Recording; w trybie Advanced ma własną zakładkę.) Przy okazji sprawdź, czy ścieżka nagrywania ma wolne miejsce.',
        '**Tools → WebSocket Server Settings** → zaznacz **Enable WebSocket server**. Zanotuj **Server Port** (domyślnie 4455) i kliknij **Show Connect Info** po hasło.',
      ],
      obsAside:
        '_Nie_ musisz naciskać „Start Replay Buffer” —— plugin uruchamia go za ciebie przy połączeniu i restartuje przy każdej zmianie długości klipu.',
      fillHeading: 'B. Wypełnij plugin',
      figure: {
        caption: 'Configuration → Anvil → Clips',
        alt: 'Sekcja Clips w konfiguracji pluginu z każdym ustawieniem zaznaczonym i ponumerowanym; host OBS i URL webhooka są ukryte',
        legend: [
          { label: 'Enable clip capture', body: 'główny przełącznik. Wyłączony —— plugin w ogóle nie rozmawia z OBS.' },
          {
            label: 'Capture clip hotkey',
            body: 'ustaw go, bo inaczej nic się nigdy nie wydarzy. Wybierz coś, czego nie naciśniesz przypadkiem w środku raidu.',
          },
          {
            label: 'OBS host / port / password',
            body: '`localhost`, gdy OBS działa na tym samym PC co RuneLite. Jeśli OBS jest na innej maszynie, wpisz tu jej lokalne IP —— ukryte na tym zrzucie —— i przepuść port przez jej firewall. Port i hasło pochodzą z _Show Connect Info_; zostaw hasło puste, jeśli wyłączyłeś uwierzytelnianie w OBS.',
          },
          {
            label: 'Max auto-post size (MB)',
            body: 'wszystko większe zostaje zapisane lokalnie i po cichu wspomniane na czacie zamiast opublikowane. Dopasuj do tego, co twój serwer Discorda naprawdę przyjmuje; plugin startuje z 25.',
          },
          {
            label: 'Clip length (seconds)',
            body: 'jak daleko wstecz sięga każdy klip. To zapisuje długość bufora do twojego profilu OBS, więc OBS potrzebuje tylu sekund rozbiegu, zanim powstanie klip pełnej długości. Dłuższe klipy = większe pliki; 30 to dobry środek.',
          },
          {
            label: 'Save clips as MP4',
            body: 'MP4 podgląda się i odtwarza bezpośrednio na Discordzie; MKV trzeba najpierw pobrać. Uwaga: to zmienia format nagrywania w OBS, więc dotyka też twoich zwykłych nagrań. Wyłącz, żeby zostawić OBS w spokoju.',
          },
          {
            label: 'Clips Discord webhook URL',
            body: 'gdzie trafiają klipy —— poproś admina o webhook kanału klipów. Puste = klipy zostają na twoim PC. Tutaj ukryty i warto go ukrywać: każdy, kto ma ten URL, może pisać na ten kanał.',
          },
          {
            label: 'Post OBS-triggered clips too',
            body: 'obsługuje także zapisy wyzwolone przez sam OBS albo przez plugin „Save Replay Buffer for OBS”. Zostaw wyłączone, jeśli używasz dwóch klientów RuneLite przy jednym OBS, bo inaczej każdy klip publikuje się dwa razy.',
          },
        ],
      },
      useHeading: 'C. Używaj',
      useIntro: 'Dzieje się coś zabawnego → naciskasz skrót → czat prowadzi cię za rękę:',
      useChat: [
        { text: 'Saving clip...', tone: 'plain' },
        { text: 'Uploading clip to the clan Discord...', tone: 'plain' },
        { text: 'Clip posted to the clan Discord.', tone: 'green' },
      ],
      reminder: {
        tag: 'Przypomnienie',
        body: 'Klip obejmuje sekundy _przed_ naciśnięciem klawisza —— więc naciskaj po momencie, nie w trakcie. Masz na reakcję tyle, ile wynosi twój bufor.',
      },
      decodedHeading: 'Komunikaty klipów, rozszyfrowane',
      decoded: [
        {
          term: '`Clip capture: OBS isn’t connected.`',
          body: 'OBS nie działa, serwer WebSocket jest wyłączony albo host/port/hasło się nie zgadzają. Napraw i naciśnij ponownie —— plugin sam ponawia połączenie co 30 sekund.',
        },
        {
          term: '`OBS could not save the clip — is the Replay Buffer started?`',
          body: 'Bufor nie działa. Sprawdź Enable Replay Buffer w ustawieniach wyjścia OBS, a potem przełącz Enable clip capture w dół i w górę.',
        },
        {
          term: '`Clip saved locally — paste a Clips Discord webhook URL…`',
          body: 'Działa zgodnie z zamierzeniem, po prostu nie masz ustawionego webhooka. Plik jest w folderze nagrań OBS.',
        },
        {
          term: '`Clip saved locally (48MB) — too big to auto-post.`',
          body: 'Skróć długość klipu, obniż jakość nagrywania w OBS albo podnieś maksymalny rozmiar, jeśli twój serwer przyjmuje większe pliki.',
        },
        {
          term: '`…but Discord didn’t accept the upload.`',
          body: 'Za duży, rate limit albo przekroczony czas wysyłki. Plik dalej jest na twoim PC —— wrzuć go ręcznie, jeśli jest tego wart.',
        },
      ],
    },

    trouble: {
      title: 'Gdy coś się psuje',
      intro:
        'Plugin mówi ci na czacie, gdy śledzenie się zatrzymało —— czeka około 90 sekund, zanim zacznie narzekać, i powtarza najwyżej co 5 minut.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Token jest błędny albo został zrotowany. Skopiuj go ponownie z [Profil → RuneLite plugin](/profile#plugin-token) albo wyczyść pole i zaloguj się z pluginu jeszcze raz.',
        },
        {
          term: '`Anvil: can’t reach the site — tracking is OFF.`',
          body: 'Sprawdź Site URL pod kątem literówek —— powinno być `{origin}`. Jeśli jest poprawny, strona prawdopodobnie nie działa.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'To konto nie jest jeszcze podłączone. Dodaj je z Profilu → „Accounts we noticed you playing”.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Nic. Naprawiło się samo.',
        },
      ],
      logHeading: 'Dalej nie działa? Wyślij adminowi log',
      logBody:
        'Wpisz `::anvillog` na czacie w grze (albo ustaw **Export debug log hotkey** w sekcji Support pluginu). Zapisze to plik logu w folderze `.runelite/anvil-debug`, otworzy folder i skopiuje ścieżkę do schowka —— wyślij ten plik adminowi, a zobaczy dokładnie, co poszło nie tak.',
      missingNote: {
        tag: 'Brakuje dowodów?',
        body: 'Pety i powtórzone Champion’s scrolle wymagają ręcznego zrzutu ekranu. Plugin robi go za ciebie i zapisuje w `.runelite/osrs-bingo-pending/` — **Copy folder path** w panelu bocznym Anvil otwiera ten folder — więc załączasz go na stronie, zamiast szukać obrazka po fakcie.',
      },
    },
  },

  admin: {
    metaTitle: 'Prowadzenie pierwszego wydarzenia — przewodnik admina Anvil',
    metaDescription:
      'Skonfiguruj klan w Anvil i przeprowadź bingo od początku do końca: Discord, synchronizacja składu, plansze, pola, drużyny i draft, start i to, co dzieje się po zakończeniu.',
    eyebrow: 'Anvil · dla sztabu klanu',
    title: 'Prowadzenie pierwszego wydarzenia',
    dek: 'Cała droga, w kolejności, w jakiej naprawdę ją przejdziesz: skonfiguruj {clanName}, wciągnij skład, zbuduj planszę, złóż drużyny, odpal całość i rozdaj nagrody. Z grubsza wieczór pracy przy pierwszym bingo —— minuty przy drugim.',
    facts: [
      { strong: '4 kroki', rest: 'w kreatorze konfiguracji' },
      { strong: '7 formatów', rest: 'z których zbudujesz planszę' },
      { strong: '1 przycisk', rest: 'do synchronizacji składu klanu' },
    ],
    footnote:
      'Ten przewodnik opisuje aplikację taką, jaka jest dziś. Jeśli któryś ekran tutaj nie zgadza się z tym, na co patrzysz, rację ma aplikacja, a przewodnik jest nieaktualny —— [napisz nam](/feedback), a poprawimy.',

    access: {
      title: 'Kto co może',
      intro:
        'Wszyscy logują się Discordem —— nie ma haseł. Pierwszy admin bierze się z konfiguracji serwera; potem to admin awansuje ludzi w **Clan → Members & staff**. Role kumulują się w dół: wszystko, co może moderator, może też skarbnik i admin.',
      rows: [
        {
          term: 'Admin',
          body: 'pełny dostęp —— wydarzenia, pola, drużyny, ustawienia, sztab, wypłaty. Daj to tak niewielu ludziom, jak klan zniesie.',
        },
        { term: 'Skarbnik', body: 'wszystko, co może moderator, plus wpisowe i wypłaty.' },
        {
          term: 'Moderator',
          body: 'codzienność: skład, weryfikacje, tygodniowe konkursy, kalendarz, opinie. Nie może tworzyć ani edytować wydarzeń.',
        },
        {
          term: 'Editor',
          body: 'wyłącznie pisanie pól. Nadaj globalnie albo ogranicz do konkretnych plansz, żeby gościnny budowniczy mógł tknąć tylko to wydarzenie, które mu powierzyłeś.',
        },
        { term: 'Członek', body: 'gra; żadnego panelu administracyjnego.' },
      ],
      seeAlso:
        'Dwie z tych ról mają własną stronę: [Na dyżurze]({moderatorGuide}) o tym, co moderator naprawdę robi ze swoim wieczorem, i [Wpisowe i wypłaty]({feesGuide}) dla skarbnika.',
      ownerNote: {
        tag: 'Właściciel',
        body: 'Jedno konto jest właścicielem. Nikt inny nie może go zdegradować i to jedyna rola, która może przekazać własność —— więc przegrana kłótnia z drugim adminem nigdy nie może kosztować cię klanu.',
      },
    },

    setup: {
      title: 'Nazwij klan, podłącz Discorda',
      intro:
        '**System → Setup** to czterokrokowy kreator, a pulpit trzyma te same cztery kroki jako listę kontrolną, dopóki nie zostaną wykonane: nazwij klan, podłącz Discorda, utwórz wydarzenie, dodaj pola. Status liczony jest z prawdziwych danych, więc krok odhacza się dopiero, gdy jest naprawdę skończony.',
      discord:
        'Do Discorda masz dwie drogi i one się uzupełniają: daj Anvil **bota**, a będzie mógł tworzyć webhooki, synchronizować role i pseudonimy oraz budować prywatne kanały drużyn; daj mu jeden **URL webhooka**, a będzie mógł publikować ogłoszenia i nic więcej. Zacznij od webhooka, jeśli chcesz działać w dwie minuty, a bota dodaj, gdy zechcesz automatyzacji.',
      permsNote: {
        tag: 'Uprawnienia bota',
        body: 'Bot potrzebuje _Manage Webhooks_, _Manage Roles_, _Manage Channels_ i _Manage Nicknames_, a jego rola musi stać _powyżej_ ról, którymi zarządza, na liście ról twojego serwera. Inaczej Discord po cichu odmawia.',
      },
      hosted:
        'W planie hostowanym ten ekran już raz spotkałeś: dodanie bota podczas konfiguracji to sposób, w jaki Anvil dowiedział się, który serwer jest twój, więc nigdy nie było ID do przepisywania. Ten sam link jest tutaj, gdy zechcesz przenieść bota na inny serwer.',
    },

    channels: {
      title: 'Rozdziel wpisy na kanały',
      body: [
        'Domyślnie wszystko trafia na jeden główny kanał ogłoszeń. Gdy zrobi się na nim głośno, otwórz **System → Advanced settings → Webhooks** i daj hałaśliwym kategoriom własne domy —— wydarzenia bingo, tygodniowe konkursy, rzadkie dropy, śmierci, kille PvP, combat achievements, klipy. Wszystko, co zostawisz puste, spada z powrotem na kanał główny, więc możesz rozdzielać po jednej kategorii.',
        'Z podłączonym botem nigdy nie dotykasz URL-a webhooka: wybierasz kanał z listy i naciskasz **Create webhook**. Przy ruchliwym wydarzeniu możesz dodać drugi webhook do tego samego kanału —— Anvil przełącza się między nimi, żeby limit Discorda nie połknął wpisów.',
      ],
      clipsNote: {
        tag: 'Kanał klipów jest inny',
        body: 'Klipy wideo wysyłane są prosto z komputera każdego gracza na Discorda —— nigdy nie przechodzą przez tę stronę. Więc webhook klipów, który tu ustawiasz, to ten, który _rozdajesz_: członkowie sami wklejają go do swojego pluginu. Wszystko inne na tej stronie dzieje się po stronie serwera i członkowie tego nigdy nie widzą.',
      },
    },

    roster: {
      title: 'Wciągnij swój skład',
      body: [
        'Członkostwo w klanie bierze się z jednego miejsca: z synchronizacji składu z gry. Zainstaluj [plugin Anvil do RuneLite]({pluginGuide}) na koncie _admina_, otwórz zakładkę **Bingo** w Collection Logu w grze i naciśnij **Sync clan roster**. To wysyła na stronę twoją prawdziwą listę klanu jednym kliknięciem.',
        'Kto podłącza albo weryfikuje konto na stronie, nie będąc na tym składzie, jest **gościem** —— śledzony, widoczny, ale nie członkiem, dopóki admin go nie awansuje albo nie zgarnie go kolejna synchronizacja. To celowe: znaczy, że nikt nie awansuje się sam do twojego klanu przez wpisanie nazwy.',
        'Możesz też dodać kogoś ręcznie w **Clan → Members & staff**, łącznie z zapisaniem go na wydarzenie w jego imieniu, gdy nie może dotrzeć do strony.',
      ],
    },

    board: {
      title: 'Utwórz pierwszą planszę',
      intro:
        '**Events → All events → New event**. Najpierw wybierz format —— to on decyduje, jak plansza jest punktowana i o co zapyta cię reszta formularza.',
      formats: {
        classic: { label: 'Klasyczne bingo', blurb: 'Kwadratowa siatka N×N —— drużyny kończą pola w dowolnej kolejności, każde warte 1.' },
        leagues: { label: 'Bingo w stylu Leagues', blurb: 'Lista zadań, gdzie każde pole ma własną wartość punktową —— dowolna liczba pól.' },
        race: { label: 'Wyścig po polach', blurb: 'Uporządkowana trasa —— drużyny sięgają pól po kolei; wygrywa ta, która zajdzie najdalej.' },
        showdown: {
          label: 'Showdown',
          blurb:
            'Pola zostają ukryte do zaplanowanej chwili —— ustaw czas odsłonięcia każdego w zakładce Tiles. Punktowane, w stylu DMM All Stars.',
        },
        luckydraw: {
          label: 'Losowanie',
          blurb: 'Krupier bingo: ukryte pola wchodzą do gry w losowaniach w stałych odstępach. Punktowane.',
        },
        bounty: {
          label: 'Polowanie na nagrody',
          blurb:
            'Jedno otwarte pole naraz —— pierwsza drużyna, która je skończy, zgarnia punkty i natychmiast losowana jest kolejna nagroda.',
        },
        ladder: {
          label: 'Drabinka',
          blurb:
            'Punktowana lista zadań ułożona jako ranking indywidualny (drużyny opcjonalnie). Zadania rotują —— progresywnie, po jednym albo w przesuwnym oknie —— i mogą tracić na wartości. W stylu miesięcznej drabinki.',
        },
      },
      outro:
        'Potem ustaw daty, okno zapisów i to, czy zapisy wiążą się z wpisowym. Zacznij od szablonu, jeśli wolisz nie zaczynać od pustej siatki —— galeria zawiera zarówno wbudowane gotowce, jak i każdą planszę, którą wcześniej zapisałeś jako szablon.',
      seeAlso:
        'Format to tylko połowa decyzji —— drugą jest to, jak pola stają się grywalne, a te dwie rzeczy się składają. Obie w całości: [Formaty i sposoby odsłaniania pól]({formatsGuide}).',
      utcNote: {
        tag: 'Daty są w UTC',
        body: 'Każdy znacznik czasu w Anvil jest zapisywany i porównywany w UTC, a wyświetlany w czasie lokalnym odwiedzającego. Ustaw taki czas końca, jaki naprawdę masz na myśli; strona pokaże Brytyjczykowi i Australijczykowi dwa różne zegary dla tej samej chwili.',
      },
    },

    tiles: {
      title: 'Wypełnij planszę',
      body: [
        'Zakładka **Tiles** wydarzenia to miejsce, gdzie plansza staje się bingiem. Każde pole to jeden _rodzaj_ zadania, a rodzaj decyduje, czego szuka plugin: dropu, killcountu bossa, XP w umiejętności, zabicia NPC, przejścia na czas, achievement diary, Combat Achievement, odblokowania w Collection Logu, killa PvP, przyrostu w ekwipunku albo przejścia bez śmierci. Pola ręczne —— te, które człowiek weryfikuje ze zrzutu —— zawsze też są opcją.',
        'Przy pełnej planszy pisz hurtem: wyeksportuj arkusz, wypełnij go w arkuszu kalkulacyjnym i zaimportuj z powrotem. CSV i .xlsx robią pełne kółko, a wiersze odpowiadają pozycjom, więc całą 25-polową siatkę przepiszesz jednym wklejeniem.',
      ],
      rows: [
        {
          term: 'Progi trudności',
          body: 'wartości punktowe mapują się na nazwane progi (easy → elite). Zmień progi w Advanced settings, jeśli twój klan ocenia inaczej.',
        },
        {
          term: 'Audytor równowagi',
          body: 'sprawdza gotową planszę pod kątem problemów strukturalnych i nierównego wysiłku, zanim gracze ją w ogóle zobaczą.',
        },
        {
          term: 'Ukryta do odsłonięcia',
          body: 'nowe plansze startują ukryte. Sztab zawsze je widzi; gracze nie widzą nic, dopóki nie odsłonisz —— więc planszę można budować jawnie, nie psując niespodzianki.',
        },
      ],
      seeAlso:
        'Po który rodzaj sięgnąć, jak napisać dwieście pól w arkuszu i jakie błędy importują się czysto, a potem nigdy nie zadziałają: [Plansza, która zalicza się sama]({boardGuide}).',
    },

    teams: {
      title: 'Drużyny i draft',
      body: [
        'Zakładka **Teams & Draft** dopasowuje się do wybranego formatu: format, który nie używa drużyn, po prostu ją pomija. Przy zwykłym drużynowym bingo tworzysz drużyny, decydujesz, kto nimi kapitanuje, i albo sam przydzielasz graczy, albo prowadzisz draft na żywo.',
        'Kapitanowie draftują z puli zapisanych w ustalonej przez ciebie kolejności, a każdy widzi odpowiedzi z formularza zapisu —— zamrożone w postaci, w jakiej zostały wysłane, żeby nikt nie poprawiał swoich „godzin tygodniowo” po tym, jak został wybrany.',
      ],
      lockNote: {
        tag: 'Draft blokuje skład',
        body: 'Gdy draft ruszy, zestaw drużyn i kolejność wyborów są zamrożone. Dodaj zapomnianą drużynę _zanim_ naciśniesz start, nie po.',
      },
      seeAlso:
        'Wyślij swoim kapitanom [przewodnik kapitana]({captainGuide}) przed wieczorem draftu —— sztab jest najbardziej przydatny w dniach wcześniej, a nikt nie czyta nowego ekranu, gdy tyka zegar.',
      visitingClans:
        'Gracie z innym klanem zamiast draftować własnych? Drużyna z zewnątrz wystawia własny skład jednym linkiem, a ich moderator prowadzi ją bez konta admina tutaj —— zobacz [Goszczenie klanu z zewnątrz]({clanVsClanGuide}).',
    },

    launch: {
      title: 'Odpal i prowadź',
      body: [
        'Odsłoń pola, a potem wystartuj wydarzenie. Anvil odmawia startu planszy, która nie jest gotowa —— trwający draft albo gracze bez drużyny —— i mówi, o co chodzi. Jeśli wiesz lepiej (sparing, powtórka, plansza testowa), możesz wymusić.',
        'Od tej chwili prowadzi się prawie samo. Plugin automatycznie zalicza wszystko, co widzi, i publikuje zrzuty dowodowe z wypaloną drużyną i znacznikiem czasu UTC. Na twoją głowę zostaje:',
      ],
      rows: [
        {
          term: 'Zgłoszenia do weryfikacji',
          body: 'pola ręczne i wszystko, co plugin oznaczył. Zatwierdzasz albo odrzucasz, mając dowód przed sobą.',
        },
        {
          term: 'Statystyki',
          body: 'zakładka Stats wydarzenia pokazuje wkład każdego gracza —— przydatne, gdy drużyna kłóci się, kto kogo ciągnął.',
        },
        {
          term: 'Ogłoszenia',
          body: 'System → Announce publikuje wiadomość na twoich kanałach w trakcie wydarzenia, bez ręcznego pisania webhooka.',
        },
      ],
      missionNote: {
        tag: 'Niespodzianki w trakcie',
        body: 'Możesz zrzucić **misję** na trwające bingo —— ukryte pole bonusowe, które zostaje ogłoszone, gdy je odpalisz, opcjonalnie tracące na wartości albo wygasające. To najtańszy sposób obudzenia planszy piątego dnia.',
      },
      startProofNote: {
        tag: 'Zatrzymywanie gromadzenia przed startem',
        body: [
          'Włącz **zdjęcie startowe** (wydarzenie → Overview), a każdy gracz musi złożyć jeden zrzut zrobiony po starcie wydarzenia, w miejscu, które Anvil losuje w chwili startu —— więc nikt nie siedzi w T0 na tygodniu zbanowanych clue i skrzynek. Miejsce ogłaszane jest razem ze startem; słowo kluczowe każdego gracza jest osobiste, wywodzi się z losowania i nie istnieje, zanim wydarzenie nie ruszy, więc nikt nie przygotuje go z góry.',
          'Przypnij miejsca na mapie świata (edytor puli ma jedną) a plugin sprawdzi, czy gracze faktycznie tam stoją, zamiast tylko im o tym powiedzieć. Możesz też wymagać **świeżej sesji** —— domyślnie 15 minut: hiscores zapisują się dopiero przy wylogowaniu, więc zmuszenie wszystkich do relogu tuż przed zdjęciem jest tym, co czyni uczciwymi startowe sumy stojące za każdym polem XP i KC.',
          'Użytkownicy pluginu naciskają jeden przycisk. Wszyscy inni wpisują słowo kluczowe w grze i wgrywają je w My Team. To ty wybierasz, co dzieje się z zaliczeniem od kogoś, kto nie złożył zdjęcia: oznaczyć do przeglądu (domyślnie) albo odrzucić, dopóki nie złoży. Ten sam panel Overview jest listą do przeglądu —— przechwycenia z pluginu ze zweryfikowanym słowem kluczowym przychodzą już przyjęte, więc w praktyce oglądasz tylko graczy z telefonu.',
        ],
      },
    },

    after: {
      title: 'Po ostatnim polu',
      intro:
        'Gdy czas się kończy, plansza zamarza, a wydarzenie zostaje zablokowane —— punkty, wkłady i kto-co-zrobił zostają takie, jakie były. Jeśli musisz coś potem poprawić, admin może to świadomie odblokować.',
      rows: [
        {
          term: 'Wypłaty',
          body: 'zakładka Payouts wydarzenia zamienia pulę nagród w listę, kto co dostaje, odhaczaną w miarę wypłacania.',
        },
        {
          term: 'Podsumowanie',
          body: 'publiczna strona z końcową tabelą i nagrodami na koniec wydarzenia —— największy drop, najwięcej killi i reszta.',
        },
        {
          term: 'Ankieta',
          body: 'zapytaj klan, co myśli. Zbuduj ją w zakładce Survey; gracze odpowiadają po zakończeniu, a wyniki widzi tylko sztab.',
        },
        {
          term: 'Zapisz jako szablon',
          body: 'zachowaj planszę, którą właśnie zbudowałeś. Następne bingo zacznie się od niej, a nie od pustej siatki.',
        },
      ],
      federation:
        'Przy włączonej federacji członkowie mogą też łączyć się z innymi klanami Anvil z poziomu pluginu —— przydatne przy wydarzeniach międzyklanowych i w pełni dobrowolne dla każdego z osobna.',
      outro: 'Potem skieruj swoich członków do [przewodnika dla graczy]({pluginGuide}) i zacznij planować kolejne.',
    },
  },

  clanVsClan: {
    metaTitle: 'Goszczenie klanu z zewnątrz — przewodnik gospodarza Anvil',
    metaDescription:
      'Przeprowadź klan kontra klan w Anvil: daj każdemu odwiedzającemu klanowi link z zaproszeniem, który sadza jego graczy w jednej drużynie, i miejsce w sztabie, żeby ich moderator prowadził swoją połowę.',
    eyebrow: 'Anvil · dla gospodarzy',
    title: 'Goszczenie klanu z zewnątrz',
    dek: 'Ty gościsz planszę; oni wystawiają skład. To jest droga, która pozwala uniknąć zbierania kilkunastu RSN-ów na priv —— jeden link na drużynę i miejsce, dzięki któremu ich własny moderator prowadzi swoją połowę wydarzenia.',
    facts: [
      { strong: '1 link', rest: 'na odwiedzającą drużynę' },
      { strong: '0 miejsc admina', rest: 'oddanych obcym' },
      { strong: '~5 min', rest: 'na każdy zaproszony klan' },
    ],
    footnote:
      'Zrzuty pochodzą z działającej konfiguracji na testowej planszy —— tokeny zaproszeń i nazwy z Discorda są zamazane. Prawdziwego linku warto pilnować: każdy, kto go ma, może zająć miejsce w tej drużynie, dopóki link żyje.',

    shape: {
      title: 'Co właściwie przygotowujesz',
      body: [
        'Klan kontra klan to zwykłe wydarzenie z jedną różnicą: połowa graczy nie jest w twoim klanie i nigdy nie będzie. Nie da się ich wciągnąć synchronizacją składu, nie chcesz ich awansować i na pewno nie chcesz zapisywać dwudziestu ręcznie, a potem przeciągać każdego do właściwej drużyny.',
        'Rozwiązują to dwa elementy, i są niezależne —— użyj jednego albo obu.',
      ],
      rows: [
        {
          term: 'Link z zaproszeniem',
          body: 'URL, który generujesz raz dla jednej drużyny. Kto go otworzy, loguje się, wypełnia normalny formularz zapisu i ląduje w tej drużynie już zatwierdzony —— żadnej puli draftu, żadnej kolejki zatwierdzeń.',
        },
        {
          term: 'Miejsce w sztabie drużyny',
          body: 'wskazana osoba, która może prowadzić _tę jedną drużynę_ —— jej skład, jej zgłoszenia i dowody, jej wpisowe —— bez konta admina tutaj i bez zabierania fotela kapitana temu, kto naprawdę gra.',
        },
      ],
      note: {
        tag: 'Czym zaproszenie nie jest',
        body: 'To nie jest logowanie ani skrót omijający weryfikację. Kto je otworzy, i tak loguje się Discordem i i tak potrzebuje zweryfikowanego RSN-a, dokładnie jak przy każdym innym zapisie. Jedyne, o czym decyduje link, to _do której drużyny_ trafia zapis i że nie potrzebuje niczyjego zatwierdzenia.',
      },
    },

    team: {
      title: 'Najpierw stwórz drużynę',
      body: [
        'Otwórz swoje wydarzenie i przejdź do zakładki **Teams & Draft**. Utwórz po jednej drużynie na każdy zaproszony klan i nazwij ją jego nazwą —— to ta nazwa pojawia się ich graczom w formularzu zapisu, więc „Ironforge” bije „Team 2”.',
        '_Nie_ musisz prowadzić draftu. Linki z zaproszeniem i draft to alternatywy: draft rozdziela wspólną pulę zapisanych, link sadza ludzi bezpośrednio. Przy czystym klan kontra klan większość gospodarzy tworzy drużyny, rozdaje po jednym linku i w ogóle nie otwiera draftu.',
        'Potem otwórz samą drużynę —— **Teams & Draft → drużyna** —— bo tam mieszkają oba kolejne kroki.',
      ],
      captainNote: {
        tag: 'Najpierw kapitan',
        body: 'Wyznacz kapitana odwiedzającej drużyny, zanim wydasz link, żeby strona drużyny od początku miała gospodarza. Wyznaczenie kapitana sadza go też w drużynie; jeśli karta ostrzega, że nie ma go na składzie, przyjmij proponowaną poprawkę.',
      },
    },

    staff: {
      title: 'Daj miejsce ich moderatorowi',
      body: [
        'Panel **Team staff** na stronie drużyny to sposób, w jaki moderator odwiedzającego klanu zabiera się do pracy, a ty nie nadajesz mu niczego na swojej stronie. Naciśnij **Add someone**, wyszukaj go, dodaj notatkę w rodzaju „mod Ironforge”, żeby następny admin wiedział, po co tu jest, i naciśnij **Give a seat**.',
      ],
      figure: {
        caption: 'Wydarzenie → Teams & Draft → drużyna → Team staff',
        alt: 'Panel Team staff z jednym przyznanym miejscem i otwartą wyszukiwarką „add someone”',
        legend: [
          {
            label: 'Add someone',
            body: 'otwiera wyszukiwarkę. Pojawić się mogą tylko osoby, które zalogowały się tu Discordem przynajmniej raz —— zobacz notatkę niżej.',
          },
          {
            label: 'Notatka',
            body: 'dowolny tekst, 120 znaków. Napisz, z jakiego są klanu. Miejsca przeżywają wydarzenie na liście, a „kto to jest” to pytanie, które zadasz sobie za trzy miesiące.',
          },
          {
            label: 'Remove',
            body: 'natychmiast odbiera miejsce. Zrób to po zakończeniu wydarzenia —— miejsce nie ma automatycznego terminu ważności.',
          },
        ],
      },
      canDo: 'Co takie miejsce może, wyłącznie w tej drużynie:',
      canDoList: [
        'widzieć skład drużyny i nim zarządzać',
        'zajmować się jej zgłoszeniami i dowodami',
        'oznaczać wpisowe jej graczy jako opłacone',
        'generować dla niej linki z zaproszeniem, jeśli to włączysz (za dwa kroki)',
      ],
      cantDo: 'Czego nigdy nie może:',
      cantDoList: [
        'tknąć jakiejkolwiek innej drużyny',
        'edytować planszy ani jej pól',
        'dokonywać wyborów w drafcie',
        'zmieniać składu, gdy wydarzenie już trwa',
      ],
      note: {
        tag: 'Najpierw muszą się tu raz zalogować',
        body: 'Wyszukiwarka pokazuje tylko konta z podłączonym Discordem —— miejsce przypisuje się do osoby, która naprawdę może się zalogować. Więc wyślij odwiedzającego moderatora na tę stronę, każ mu raz nacisnąć **Login**, a _potem_ przyznaj miejsce. Jeśli nie pojawia się w wyszukiwarce, to logowanie jeszcze się nie odbyło.',
      },
    },

    link: {
      title: 'Wygeneruj link z zaproszeniem',
      body: [
        'Wciąż na stronie drużyny, panel **Invite links** tworzy link. Dwa pola decydują, co link obiecuje, i w obu `0` znaczy „nie obiecuję nic”.',
      ],
      figure: {
        caption: 'Wydarzenie → Teams & Draft → drużyna → Invite links',
        alt: 'Panel Invite links z polami miejsc i wygaśnięcia, przyciskiem Make a link i jednym aktywnym linkiem na liście',
        legend: [
          {
            label: 'Miejsca i wygaśnięcie',
            body: 'ilu ludzi link może posadzić (do 100) i jak długo pozostaje ważny (do 30 dni). Ustaw miejsca na wielkość składu, który ci obiecali, a link zamknie się sam, gdy wszyscy będą w środku; ustaw wygaśnięcie, gdy link idzie na publiczny Discord. `0` w którymkolwiek polu znaczy brak limitu.',
          },
          {
            label: 'Make a link',
            body: 'generuje go i od razu kopiuje do schowka. Wklej im go, zanim zrobisz cokolwiek innego.',
          },
          {
            label: 'Lista aktywnych',
            body: 'każdy link, który ta drużyna ma na zewnątrz, z liczbą tych, którzy dołączyli, i liczbą wolnych miejsc. **Copy** bierze go ponownie; **Turn off** unieważnia go na dobre.',
          },
        ],
      },
      shape: 'Link wygląda tak: `{origin}/events/{eventId}/join/{token}` —— jedna linijka, spokojnie można wkleić w wiadomość na Discordzie.',
      note: {
        tag: 'Rozsądne ustawienia',
        body: 'Przy klan kontra klan, gdzie skład uzgodniłeś z jednym moderatorem, zostaw oba pola na `0` i pozwól mu to poprowadzić. Po miejsca i wygaśnięcie sięgaj, gdy link idzie tam, gdzie nie masz kontroli.',
      },
      revoke:
        'Wyłączenie linku działa natychmiast i nie usuwa nikogo, kto już dołączył —— to teraz zwykli gracze tej drużyny. Żeby kogoś usunąć, użyj składu drużyny.',
    },

    captains: {
      title: 'Pozwól im generować własne linki',
      body: [
        'Domyślnie tylko gospodarz może tworzyć linki, a kapitanowi, który spróbuje, zostaje to powiedziane. To ustawienie jest właściwe przy zwykłym wydarzeniu klanowym —— kapitan rozdający miejsca zapełniałby skład, którego nikt nie zatwierdził —— i niewłaściwe przy klan kontra klan, gdzie odwiedzająca strona zna swój skład lepiej niż ty.',
        'Przełącznik jest w tym samym panelu **Invite links**: **Let captains make their own links**. Dotyczy _każdej drużyny w tym wydarzeniu_, nie tylko tej, na którą patrzysz, i o to właśnie chodzi, gdy obie strony są klanami z zewnątrz.',
        'Przy włączonym przełączniku kapitan drużyny i każdy z miejscem w sztabie mogą sami generować linki w **My Team → Invite links**. Dostają ten sam panel co ty, tylko bez przełącznika.',
      ],
      figure: {
        caption: 'My Team → drużyna → Invite links',
        alt: 'Zakładka Invite links po stronie kapitana w hubie drużyny, z polami miejsc i wygaśnięcia oraz jednym aktywnym linkiem',
        legend: [
          {
            label: 'Ten sam panel, widok kapitana',
            body: 'generuj, kopiuj, wyłączaj. Jeśli gospodarz nie włączył przełącznika, widnieje tu „Only a host can make links for this event”, a pól nie ma.',
          },
          {
            label: 'Lista aktywnych',
            body: 'kapitan, który nie może generować, i tak widzi linki, które jego drużyna ma na zewnątrz —— więc może poprosić cię o kolejny zamiast zakładać, że żadnego nie ma.',
          },
        ],
      },
    },

    player: {
      title: 'Co widzą ich gracze',
      intro: 'Warto przejść to raz samemu, zanim wydasz link, żeby umieć odpowiadać na pytania.',
      steps: [
        'Otwierają link. Jeśli nie są zalogowani, najpierw logują się Discordem i wracają prosto tutaj —— link nie ginie po drodze.',
        'Lądują na zwykłym formularzu zapisu, z banerem **You’re joining {teamExample} by invite**. Te same pytania, ten sam wybór konta, to samo wpisowe co u każdego innego.',
        'Po wysłaniu są w tej drużynie, zatwierdzeni. Żadnego działania gospodarza, żadnego draftu.',
      ],
      figure: {
        caption: 'Formularz zapisu otwarty przez link z zaproszeniem',
        alt: 'Formularz zapisu na wydarzenie z banerem mówiącym, że gracz dołącza do wskazanej drużyny z zaproszenia',
        legend: [
          {
            label: 'Baner zaproszenia',
            body: 'nazywa drużynę, do której zaraz dołączą. Jeśli nazywa złą drużynę, mają zły link —— zatrzymaj się i sprawdź przed wysłaniem.',
          },
          {
            label: 'Reszta formularza',
            body: 'bez zmian. Zweryfikowany RSN nadal jest wymagany, pytania z zapisu nadal się pojawiają, a wpisowe nadal obowiązuje.',
          },
        ],
      },
      note: {
        tag: 'Już się zapisali?',
        body: 'Jeśli ktoś najpierw zapisał się normalnie i siedzi w puli, otwarcie linku przenosi go do drużyny, zamiast tworzyć drugi wpis. Kogoś już zatwierdzonego w innej drużynie link zostawia w spokoju —— przenieś go ze składu.',
      },
    },

    dead: {
      title: 'Gdy link przestaje działać',
      intro:
        'Odrzucony link tłumaczy się na stronie zamiast dawać 404, więc osoba, która go trzyma, może ci powiedzieć, który to przypadek.',
      rows: [
        {
          term: 'This invite has been turned off.',
          body: 'Ktoś nacisnął **Turn off**. Wygeneruj świeży —— stary link nigdy nie wraca.',
        },
        {
          term: 'This invite has expired.',
          body: 'Dobił do ustawionej liczby godzin. Wygeneruj kolejny, tym razem z `0` godzin, jeśli wygaśnięcie nie zarabia na siebie.',
        },
        {
          term: 'This invite is full.',
          body: 'Wszystkie miejsca zajęte. Podnieś je, generując nowy link z większą liczbą miejsc —— liczba miejsc jest ustalona w chwili powstania linku.',
        },
        {
          term: 'Sign-ups for this event aren’t open.',
          body: 'Jedyny, który może naprawić się sam. Sprawdź okno zapisów wydarzenia: czy już się otworzyło, czy termin minął, czy wydarzenie już wystartowało.',
        },
        {
          term: 'That invite belongs to a different event.',
          body: 'Wklejono link z innej planszy. Sprawdź, czy id wydarzenia w URL-u zgadza się z tym, o które ci chodziło.',
        },
      ],
      checklist: 'Przed wydarzeniem przejdź tę listę raz dla każdego odwiedzającego klanu:',
      checklistItems: [
        'ich drużyna istnieje i nosi ich nazwę',
        'ich kapitan jest wyznaczony i posadzony w drużynie',
        'ich moderator zalogował się tutaj i ma miejsce w sztabie',
        'link jest wygenerowany, skopiowany i naprawdę dostarczony żywemu człowiekowi',
        'okno zapisów jest otwarte tak długo, jak potrzebują',
      ],
      note: {
        tag: 'Gdy już po wszystkim',
        body: 'Wyłącz linki i odbierz miejsca w sztabie. Żadne z nich nie wygasa samo, a żywy link na zakończonym wydarzeniu to po prostu luźny koniec.',
      },
    },
  },

  board: {
    metaTitle: 'Budowanie planszy — przewodnik Anvil po pisaniu pól',
    metaDescription:
      'Pisz pola bingo, które zaliczają się same: co naprawdę widzi każdy rodzaj pola, pisanie hurtem w arkuszu i błędy, które zawodzą po cichu.',
    eyebrow: 'Anvil · dla budujących plansze',
    title: 'Plansza, która zalicza się sama',
    dek: 'Pole to obietnica, że coś zostanie zauważone. Oto co każdy rodzaj naprawdę widzi, jak napisać dwieście pól, nie tracąc na to wieczoru, i garść błędów, które zawodzą po cichu —— pole po prostu nigdy nie zadziała, a nikt się nie zorientuje aż do czwartego dnia.',
    facts: [
      { strong: '15 rodzajów', rest: 'jeden na pole, nigdy mieszane' },
      { strong: '1000 pól', rest: 'na planszę, przez arkusz' },
      { strong: 'Po cichu', rest: 'tak zawodzi złe pole' },
    ],
    footnote:
      'Format arkusza jest opisany w całości w `docs/tile-authoring.md`, napisanym dla tego (albo tego czegoś), kto generuje wiersze. Ta strona to połowa ludzka: po który rodzaj sięgnąć i co idzie nie tak.',

    kinds: {
      title: 'Jedno pole, jeden rodzaj',
      body: [
        'Każde pole ma dokładnie jeden _rodzaj_, a rodzaj to całe pytanie: decyduje, czego wypatruje plugin albo przemiatanie hiscores, a więc i tego, czy pole w ogóle może zaliczyć się samo. Mieszanie pól z dwóch rodzajów jest odrzucane na wejściu, zamiast być przyjęte i zostawione zepsute.',
        'Rodzaje dzielą się na trzy rodziny, a rodzina liczy się bardziej niż etykieta:',
      ],
      families: [
        {
          term: 'Ręczne',
          body: 'człowiek patrzy na zrzut i mówi „tak”. Zawsze dostępne, zawsze działa, zawsze kosztuje kogoś wieczór. Używaj do rzeczy, których oprogramowanie nie widzi.',
        },
        {
          term: 'Z hiscores',
          body: 'XP w umiejętnościach i killcount bossów, odczytywane z oficjalnych Hiscores przemiataniem co 15 minut. Nie wymaga pluginu, działa dla wszystkich na składzie —— ale widzi tylko to, co śledzą Hiscores, i dopiero po wylogowaniu gracza.',
        },
        {
          term: 'Wykrywane przez plugin',
          body: 'cała reszta: dropy, zabójstwa NPC, przejścia na czas, dzienniki, combat taski, okrążenia, wartość łupu. Zalicza w kilka sekund i wypala zrzut dowodowy —— ale tylko graczom faktycznie używającym pluginu.',
        },
      ],
      kindsIntro: 'Pełna lista, w kolejności, w jakiej podaje je wybierak:',
      kindLabels: {
        standard: { label: 'Standardowe', blurb: 'Pole ręczne —— kapitan oznacza je jako zrobione. Bez automatycznego śledzenia.' },
        skill: { label: 'Umiejętność', blurb: 'Kończy się samo, gdy umiejętność osiągnie cel XP (odczyt z hiscores).' },
        boss: { label: 'KC bossa', blurb: 'Kończy się samo, gdy boss osiągnie cel killcountu (odczyt z hiscores).' },
        drop: { label: 'Drop', blurb: 'N dropów przedmiotu (albo dowolnego z puli) —— wykrywane przez plugin, z wypalonym zrzutem.' },
        collection: { label: 'Zestaw przedmiotów', blurb: 'Kilka przedmiotów, każdy z własną wymaganą liczbą —— po 1× z każdego na pełny zestaw.' },
        kill: { label: 'Killcount', blurb: 'N zabójstw NPC —— także tych spoza hiscores (kury, krowy). Wykrywane przez plugin.' },
        lap: { label: 'Okrążenia agility', blurb: 'N okrążeń toru agility albo N pięter / pełnych przebiegów Hallowed Sepulchre —— liczone na żywo z licznika w grze. Liczą się tylko okrążenia zrobione w trakcie wydarzenia.' },
        pvp: { label: 'Kill PvP', blurb: 'Zabijaj graczy —— kogokolwiek, rywalizujące drużyny albo wskazany cel —— na Wildzie lub światach PvP. Bezpieczne minigry nigdy się nie liczą.' },
        gain: { label: 'Zdobyte przedmioty', blurb: 'Złów/ugotuj/zbierz N sztuk przedmiotu —— liczone z przyrostów w ekwipunku. Wykrywane przez plugin.' },
        timed: { label: 'Na czas', blurb: 'Ukończ aktywność w limicie czasu (Inferno, raidy, Colosseum). Plugin mierzy czas.' },
        deathless: { label: 'Bez śmierci', blurb: 'Ukończ raid z ZEREM śmierci w drużynie, N razy. Plugin liczy śmierci w instancji.' },
        lms: { label: 'LMS', blurb: 'Zajmij miejsce w pierwszej N w Last Man Standing (1 = wygrana), M razy. Wykrywane przez plugin na końcu gry.' },
        value: { label: 'Wartość łupu', blurb: 'Łup wart X gp —— jeden zbiór albo zbiory sumujące się do celu. Plugin wycenia zbiór.' },
        diary: { label: 'Dziennik', blurb: 'Ukończ tiery achievement diary w trakcie wydarzenia. Wykrywane przez plugin z komunikatu o ukończeniu.' },
        ca: { label: 'Combat task', blurb: 'Ukończ zadania Combat Achievement w trakcie wydarzenia. Wykrywane przez plugin z komunikatu o ukończeniu.' },
      },
      note: {
        tag: 'Pytanie o plugin, zadane raz',
        body: 'Pole wykrywane przez plugin jest niewidzialne dla gracza, który pluginu nie używa. To nie jest błąd, który da się obejść ustawieniem —— nic tam nie patrzy. Jeśli część twojego klanu gra na telefonie albo na oficjalnym kliencie, albo trzymaj takie pola poza krytyczną drogą do wygranej, albo dopnij do nich ręczną alternatywę i licz się z weryfikowaniem zrzutów.',
      },
    },

    pick: {
      title: 'Wybierz rodzaj, który naprawdę zadziała',
      intro:
        'Prawie każde źle zachowujące się pole to dobry pomysł wyrażony w złym rodzaju. Cztery, które łapią ludzi:',
      rows: [
        {
          term: 'Cel na KC bossa',
          body: '**nie** jest polem kill. Pola kill patrzą na śmierci NPC przez plugin; cel KC to liczba z hiscores i wymaga `trackedStat` + `statType=boss` + `statGoal`. Pola kill używaj do rzeczy, których Hiscores nigdy nie liczyły —— krowy, kury, konkretny mob ze slayera.',
        },
        {
          term: 'Slot w Collection Logu',
          body: 'to pole drop. Odblokowanie wpisu w logu zalicza je, więc pole zadziała nawet na duplikacie, który gracz już miał —— a to zwykle właśnie miałeś na myśli.',
        },
        {
          term: '„Zdobądź po jednym z każdego”',
          body: 'to pole drop z listą przedmiotów i **bez** `requiredAmount`. Dodaj `requiredAmount`, a po cichu zmieni się w „zdobądź dowolne N z tych” —— ten sam wiersz, zupełnie inne pole.',
        },
        {
          term: 'Dziennik albo combat task',
          body: 'zalicza się wyłącznie z komunikatu o ukończeniu w grze, który pojawia się w chwili domknięcia tieru albo zadania. Coś, co gracz już ma, nie może zadziałać ponownie —— z wyjątkiem combat taska, gdzie **Settings → Combat Achievements → Repeat completion** pozwala mu wyzwolić to jeszcze raz.',
        },
      ],
      note: {
        tag: 'Złożone pola bossów',
        body: 'Śledzona statystyka pola bossa może zawierać kilka kluczy Hiscores rozdzielonych przecinkami, a przyrosty się sumują. `chambersOfXeric,chambersOfXericChallengeMode` to jedno pole liczące CoX i CM razem, czyli niemal zawsze to, co znaczy pole raidowe.',
      },
    },

    bulk: {
      title: 'Pisz hurtem, nie w przeglądarce',
      body: [
        'Wyklikanie siatki na 25 pól jest w porządku. Wyklikanie planszy Leagues na 200 zadań już nie, tak samo jak przeczytanie jej potem. Zakładka Tiles ma pełne kółko zbudowane dokładnie do tego.',
      ],
      steps: [
        '**Download spreadsheet** w zakładce **Tiles** wydarzenia. Dostajesz .xlsx z planszą w obecnym stanie, z listami rozwijanymi, listą przedmiotów i instrukcjami kolumn na osobnych arkuszach.',
        'Edytuj. Jeden wiersz na pole; kolejność wierszy to kolejność pól.',
        '**Upload CSV / Excel** w tej samej zakładce. Czytany jest wyłącznie arkusz **Tiles**.',
      ],
      rules: [
        {
          term: 'Kółko niczego nie gubi',
          body: 'pobierz i wgraj z powrotem bez zmian, a nic się nie stanie —— pasujące wiersze zostają zgłoszone jako niezmienione i nawet nie są ponownie stemplowane. Dzięki temu eksport jest bezpieczną kopią zapasową przed dużą edycją.',
        },
        {
          term: 'Wiersze mapują się po pozycji',
          body: 'wiersz 1 to pole 1. Istniejące pola są aktualizowane w miejscu, a pominięta kolumna zostaje nietknięta zamiast wyczyszczona —— więc możesz wgrać dwukolumnowy arkusz, który zmienia tylko punkty.',
        },
        {
          term: 'Rosną tylko plansze dynamiczne',
          body: 'dodatkowe wiersze tworzą nowe pola na planszy Leagues albo w wyścigu po polach, przed startem wydarzenia, do 1000. Klasyczna siatka N×N ma stały kształt i je ignoruje. Żeby wygenerować setki zadań, zrób wydarzenie Leagues.',
        },
        {
          term: 'Wszystko albo nic',
          body: 'każdy wiersz jest najpierw walidowany. Jedna nierozpoznana nazwa przedmiotu wywala cały import, wypisuje winowajców i nic nie zmienia —— nigdy nie dostaniesz połowy planszy.',
        },
        {
          term: 'Część pól blokuje się na starcie',
          body: 'etykieta, rodzaj, wymagana liczba i konfiguracja przedmiotów są stosowane tylko przed startem wydarzenia. Opis, punkty, kategoria i flaga „opcjonalne” pozostają edytowalne cały czas, więc literówkę poprawisz w trakcie, nie otwierając planszy na nowo.',
        },
      ],
    },

    traps: {
      title: 'Błędy, które zawodzą po cichu',
      intro:
        'Każdy z nich importuje się czysto, siedzi na planszy, wyglądając poprawnie, i nigdy nie zadziała. Warto je przeczytać przed wgraniem, a nie po.',
      rows: [
        {
          term: 'Pola umiejętności i bossów to `type=standard`',
          body: 'nie ma czegoś takiego jak `type=skill`. Rodzaj bierze się z `trackedStat` + `statType` + `statGoal` w skądinąd standardowym wierszu. Wpisanie `type=boss` zostaje odrzucone; wpisanie `type=standard` i zapomnienie kolumn statystyki już nie —— dostajesz pole ręczne, którego nikt nigdy nie zatwierdzi.',
        },
        {
          term: 'Separatory różnią się w zależności od kolumny',
          body: '`items` używa średników (przecinek jest separatorem CSV). `targetNpcs` używa pionowych kresek. W wierszu combat taska pionowe kreski są **jedyną** opcją, bo prawdziwe nazwy zadań zawierają przecinki —— `Nylocas, On the Rocks` to jedno zadanie.',
        },
        {
          term: 'Nazwy raidów porównywane są dosłownie',
          body: 'pole raidu bez śmierci albo na czas niesie tryb zapisany tak jak w grze: `Chambers of Xeric: Challenge Mode`, `Theatre of Blood: Hard Mode`, `Tombs of Amascut: Expert Mode`. Prawie trafiona pisownia to pole, które nigdy się nie kończy. Przejścia w Entry Mode nigdy nie zaliczają pola bazowego raidu; trudniejsze tryby tak.',
        },
        {
          term: 'Nazwy przedmiotów muszą być dokładne',
          body: 'pisownia jak w grze, inaczej import się wywala i wypisuje, czego nie udało się rozpoznać. Gdy nazwa jest niejednoznaczna, przypnij ją jako `Nazwa#id` i przestań zgadywać.',
        },
        {
          term: '`timeThresholdSeconds` znaczy cztery rzeczy',
          body: 'limit czasu na polu na czas, limit miejsca na polu LMS (1 = wygrana), dokładny rozmiar drużyny na polu bez śmierci i dokładny rozmiar drużyny raidowej na polu drop. Ta sama kolumna, cztery znaczenia —— sprawdź, czy wypełniasz to, które czyta twój rodzaj.',
        },
        {
          term: 'Wymagana liczba w złym rodzaju',
          body: 'należy do wierszy drop, kill, gain, lap, PvP, bez śmierci i LMS. W wierszu statystyki albo na czas nic nie robi, a w wierszu drop zamienia zestaw przedmiotów w pulę „dowolne N”.',
        },
      ],
      note: {
        tag: 'Przetestuj jedno, zanim napiszesz dwieście',
        body: 'Napisz pojedyncze pole tego rodzaju, którego nie jesteś pewien, odsłoń je na jednorazowym wydarzeniu i idź to zrobić. Pięć minut tam bije odkrycie w wieczór klanowego bingo, że cała kategoria była martwa.',
      },
    },

    points: {
      title: 'Punkty, progi i czy to sprawiedliwe',
      body: [
        'Na planszy punktowanej każde pole niesie własną wartość, a te wartości mapują się na nazwane progi trudności —— od easy do elite —— które możesz zmienić w **Advanced settings**, jeśli twój klan ocenia inaczej. Próg jest tym, co czytają gracze; liczba jest tym, co punktuje.',
        'Oznacz pole jako **opcjonalne**, a przestaje liczyć się do sumy planszy —— tak dodaje się cele ponadprogramowe, nie czyniąc blackoutu niemożliwym.',
        'Gdy plansza jest pełna, odpal **audytora równowagi** z zakładki Tiles. Sprawdza strukturę i rozkład wysiłku i mówi ci, gdzie plansza się przechyla —— kategoria, której nikt nie skończy, próg wart o wiele więcej na godzinę niż sąsiednie —— zanim gracze znajdą to za ciebie i zaczną to obchodzić.',
      ],
    },

    reveal: {
      title: 'Nikt nie widzi, dopóki nie powiesz',
      body: [
        'Nowe plansze startują ukryte. Sztab zawsze je widzi; gracze nie widzą absolutnie nic, dopóki nie odsłonisz —— więc planszę można budować jawnie, przez wiele dni, na kanale, który twoi członkowie czytają, niczego nie psując.',
        'Ten główny przełącznik jest podłogą dla wszystkiego innego. Na planszy z polityką odsłaniania —— zaplanowaną, interwałową, nagrodową, rotacyjną —— silnik zaczyna odwracać poszczególne pola dopiero wtedy, gdy sama plansza jest odsłonięta, więc uzbrojenie planszy zawsze jest świadomym aktem. Którą politykę wybrać, to osobna strona: [Formaty i sposoby odsłaniania pól]({formatsGuide}).',
        'Misje to wyjątek, o którym warto wiedzieć: pola napisane z góry, ale wstrzymane, ogłaszane w trakcie wydarzenia z własnej puli, podczas gdy reszta planszy pozostaje widoczna.',
      ],
    },

    check: {
      title: 'Zanim odsłonisz',
      intro: 'Warto przejść raz na planszę. Większość to pięć minut.',
      items: [
        'każde pole ma rodzaj, który miałeś na myśli, a nie ten, który ładnie się zaimportował',
        'tryby raidów, nazwy przedmiotów i nazwy zadań zgadzają się z pisownią w grze co do znaku',
        'pola wykrywane przez plugin nie są jedyną drogą do wygranej, jeśli część klanu gra bez niego',
        'punkty są ustawione, a audytor równowagi zadowolony —— albo świadomie się z nim nie zgadzasz',
        'pola opcjonalne są oznaczone jako opcjonalne',
        'pobrałeś arkusz przynajmniej raz, jako kopię, którą da się wgrać z powrotem',
      ],
      note: {
        tag: 'Kto może to robić',
        body: 'Pisanie planszy to jedyna admińska robota z własną rolą. **Editor** może pisać pola i nic więcej, a można go ograniczyć do konkretnych plansz —— więc gościnny budowniczy z innego klanu dostaje dokładnie to wydarzenie, które mu powierzyłeś, i żadnego dostępu do reszty tego, co prowadzisz.',
      },
    },
  },

  captain: {
    metaTitle: 'Przewodnik kapitana — Anvil',
    metaDescription:
      'Dzień draftu i tygodnie po nim: czytanie puli, zanim ruszy zegar, dokonywanie wyborów i prowadzenie składu, dowodów i wpisowego swojej drużyny.',
    eyebrow: 'Anvil · dla kapitanów',
    title: 'Przewodnik kapitana',
    dek: 'Dostajesz sztab, zegar i formularze zapisu dwudziestu pięciu obcych ludzi. Oto co to wszystko robi, w kolejności, w jakiej to spotkasz —— plus te części prowadzenia drużyny, które zaczynają się dopiero po zakończeniu draftu.',
    facts: [
      { strong: 'Kolejność wężowa', rest: 'żeby późne wybory się wyrównały' },
      { strong: 'Zegar', rest: 'nigdy nie wybiera za ciebie' },
      { strong: 'Jedna zakładka', rest: 'prowadzi drużynę przez całe wydarzenie' },
    ],
    footnote:
      'Wszystko tutaj to rzeczy, które widzi kapitan. Wpisowe, składy innych drużyn i plansza przed odsłonięciem należą do sztabu i tak zostaje —— więc nic na tej stronie nie sprawi, że oskarżą cię o zaglądanie tam, gdzie nie wolno.',

    before: {
      title: 'Co dostajesz i kiedy',
      body: [
        'Gospodarz mianuje cię kapitanem, a to robi dwie rzeczy: sadza cię w drużynie jako gracza i otwiera ci ekrany drużyny. Jeśli strona drużyny ostrzega, że tak naprawdę nie ma cię na składzie, przyjmij proponowaną poprawkę —— kapitan poza własną drużyną to stan, który miesza wszystkie ekrany niżej.',
        'Od tej chwili masz dwa miejsca. **My Team** to hub twojej drużyny i tam spędzasz wydarzenie. **Sztab** to ekran dnia draftu i otwiera się, gdy tylko ruszą zapisy —— na długo przed wieczorem draftu.',
      ],
      note: {
        tag: 'Wejdź wcześnie',
        body: 'Sztab jest najbardziej przydatny w dniach _przed_ draftem, kiedy możesz porządnie przeczytać każdy formularz zapisu. Tego wieczoru staje się stoperem i nie będziesz miał czasu niczego czytać.',
      },
    },

    warroom: {
      title: 'Przeczytaj pulę, zanim ruszy zegar',
      body: [
        'Sztab pokazuje wszystkich, których można wybrać, wraz ze wszystkim, co strona o nich wie: w co grają, przy których bossach mają prawdziwe killcounty, na ilu poprzednich wydarzeniach się pojawili, i odpowiedzi, które dali w formularzu zapisu.',
        'Te odpowiedzi są **zamrożone w postaci, w jakiej zostały wysłane**. Nikt nie poprawia swoich „godzin tygodniowo” po zobaczeniu, kogo wzięto pierwszego, i to jest cały powód, dla którego warto je czytać.',
        'W trakcie czytania buduj **krótką listę**. Jest prywatna, przetrwa do wieczoru draftu, a tego wieczoru jest różnicą między wybieraniem z listy, której już ufasz, a wybieraniem tego, kto akurat jest na górze ekranu.',
      ],
      rows: [
        {
          term: 'Ocena i próg',
          body: 'podsumowanie tego, co ktoś naprawdę zrobił, wyprowadzone z historii jego konta, a nie z tego, co ci powiedział. Orientacyjne —— to punkt wyjścia do rozmowy, nie wyrok.',
        },
        {
          term: 'Obszary i znaczniki',
          body: 'to, co robią w sposób dający się wykazać: raidy, PvM, skillowanie, PvP. Przydatne do wypatrzenia dziury w składzie, zamiast czterokrotnego brania najwyższej liczby.',
        },
        {
          term: 'Frekwencja',
          body: 'jak często kończyli poprzednie wydarzenia, na które się zapisali. Najcichsza liczba na stronie i często najbardziej przewidująca.',
        },
      ],
    },

    draft: {
      title: 'Dzień draftu',
      body: [
        'Wybory idą w **kolejności wężowej**: przy czterech drużynach pierwsza runda to A, B, C, D, a druga D, C, B, A, więc wybieranie ostatnim w jednej rundzie znaczy wybieranie pierwszym w kolejnej. Kto wylosował pierwszy wybór, płaci za to minutę później.',
        'Człowiek to jeden wybór, nie jedno konto. Wzięcie kogoś ściąga do twojej drużyny wszystkie zarejestrowane przez niego konta razem —— nigdy nie wydajesz drugiego wyboru na czyjegoś alta.',
      ],
      rows: [
        {
          term: 'Zegar wyboru',
          body: 'jeśli gospodarz go ustawił, masz tyle sekund na turę. Gdy upłynie, **nie** wybiera za ciebie —— odblokowuje gospodarzowi możliwość wybrania w twoim imieniu i mówi o tym na obu ekranach. Nic nie dzieje się po cichu.',
        },
        {
          term: 'Zawężona lista',
          body: 'część wydarzeń działa w trybie równoważenia. Zależnie od tego, w którym, najsilniejsza drużyna może mieć zablokowane wzięcie kolejnego gracza z najwyższego progu, dopóki rywal nie ma żadnego, albo mieć sufit na to, jak bardzo jej skład może przekroczyć średnią. Jeśli ktoś, kogo chciałeś, jest wyszarzony, to właśnie dlatego, i dotyczy to wszystkich.',
        },
        {
          term: 'Jeśli cię nie będzie',
          body: 'powiedz gospodarzowi wcześniej. Może wybierać za ciebie z tego samego ekranu, a zostawiona krótka lista jest instrukcją, którą wykona.',
        },
      ],
      note: {
        tag: 'Draft blokuje skład, gdy ruszy',
        body: 'Gdy draft trwa, zestaw drużyn i kolejność wyborów są zamrożone. Jeśli brakuje drużyny albo kolejność jest zła, trzeba to naprawić przed pierwszym wyborem, nie po.',
      },
    },

    roster: {
      title: 'Hub twojej drużyny, przez całe wydarzenie',
      intro:
        'W **My Team** karta **Manage this team** mieści wszystko, co możesz zrobić dla swojej strony. Przychodzi zwinięta; rozwiń raz, a zostanie tam, gdzie ją zostawiłeś.',
      rows: [
        {
          term: 'Roster',
          body: 'kto jest w drużynie i co wniósł. Pierwsze miejsce, gdzie szukać, gdy ktoś pyta, czemu jego drop się nie policzył —— niepodłączone konto wychodzi tutaj.',
        },
        {
          term: 'Requests',
          body: 'ludzie proszący o dołączenie, w wydarzeniach, które pozwalają graczom wybrać drużynę. Pojawia się tylko, gdy jacyś są.',
        },
        {
          term: 'Proof',
          body: 'zgłoszenia twojej drużyny i ich zrzuty. To nie ty zatwierdzasz ostatecznie —— robi to sztab —— ale widzisz, co zostało wysłane, i możesz dopominać się tego, czego brak.',
        },
        {
          term: 'Fees',
          body: 'kto w twojej drużynie wciąż jest winien wpisowe. Możesz oznaczyć jedno jako opłacone; potwierdzenie to celowo robota sztabu.',
        },
        {
          term: 'Invite links',
          body: 'pojawia się, gdy gospodarz pozwolił kapitanom generować własne. Jeden link sadza tego, kto go otworzy, prosto w twojej drużynie. Zobacz [Goszczenie klanu z zewnątrz]({clanVsClanGuide}), żeby wiedzieć, co link naprawdę robi.',
        },
      ],
    },

    during: {
      title: 'Prowadzenie po starcie',
      body: [
        'Większość wydarzenia prowadzi się sama: plugin zalicza to, co widzi, i archiwizuje do tego ostemplowany zrzut. Zostają ludzie, i to jest ta robota.',
        'Rzeczy, które naprawdę wymagają kapitana: dopilnowanie, żeby wszyscy po twojej stronie mieli podłączony plugin i powiązane konta przed gwizdkiem, bo niepodłączony alt nie wnosi nic; zauważenie w połowie, których pól nikt nie tknął; i doprowadzenie do sfotografowania pól ręcznych przed ostatnią godziną, gdy wszyscy próbują naraz.',
        'Jeśli wydarzenie wymaga zdjęcia startowego, to jedyna rzecz, którą każdy gracz musi zrobić sam w pierwszych godzinach. Dopominaj się wcześnie —— graczowi bez niego każde zaliczenie zostanie oznaczone albo wprost odrzucone, zależnie od tego, jak ustawił to gospodarz.',
      ],
      note: {
        tag: 'Zmiany w składzie',
        body: 'Gdy wydarzenie trwa, wymiana kogoś jest zarezerwowana dla adminów, i to celowo: wkłady są już przypisane do ludzi. Zapytaj gospodarza, zamiast kombinować dookoła.',
      },
    },
  },

  formats: {
    metaTitle: 'Formaty i sposoby odsłaniania pól — Anvil',
    metaDescription:
      'Siedem formatów wydarzeń, pięć sposobów odsłaniania pól i modyfikatory punktacji —— co każde z nich robi z tym, jak gra się w wydarzenie.',
    eyebrow: 'Anvil · dla sztabu klanu',
    title: 'Formaty i sposoby odsłaniania pól',
    dek: 'Dwie decyzje kształtują wydarzenie bardziej niż wszystkie pola razem: jaki kształt ma plansza i jak pola stają się grywalne. Są niezależne —— każdy format może użyć każdej polityki odsłaniania —— a razem są różnicą między tygodniowym mieleniem a wieczornym wyścigiem.',
    facts: [
      { strong: '7 formatów', rest: 'kształt planszy' },
      { strong: '5 polityk', rest: 'jak otwierają się pola' },
      { strong: '3 modyfikatory', rest: 'ile warte jest ukończenie' },
    ],
    footnote:
      'Format ustala się przy tworzeniu, ale można go potem zmienić w zakładce Overview wydarzenia; politykę odsłaniania i modyfikatory punktacji można zmieniać w każdej chwili, zanim odsłonięte zostaną pola, których dotyczą.',

    shape: {
      title: 'Kształt planszy',
      intro:
        'Format decyduje, jak plansza jest punktowana i o co zapyta cię dalej formularz tworzenia. Wszystko inne na tej stronie składa się na wierzchu.',
      note: {
        tag: 'Stała siatka czy lista zadań',
        body: 'Plansza **klasyczna** jest prawdziwym kwadratem, więc „N równe 5” znaczy dokładnie 25 pól, a liczba nigdy nie może się zmienić. Cała reszta to lista zadań dowolnej długości, i jest to zarazem jedyny rodzaj planszy, który hurtowy import z arkusza może powiększyć. Jeśli zamierzasz wygenerować sto zadań, ta decyzja zapada właśnie tutaj.',
      },
    },

    reveal: {
      title: 'Jak otwierają się pola',
      intro:
        'Niezależne od formatu. Przełącznik odsłonięcia na poziomie wydarzenia i tak pozostaje główną bramą —— dopóki plansza jest ukryta, nic nie jest widoczne i żaden z tych silników nie działa, więc uzbrojenie planszy zawsze jest świadome.',
      rows: [
        {
          term: 'Wszystkie naraz',
          body: 'klasyka. Każde pole jest grywalne od chwili odsłonięcia planszy, a drużyny same wybierają kolejność. Wybierz to, jeśli nie masz powodu, żeby nie.',
        },
        {
          term: 'Zaplanowane',
          body: 'każde pole niesie własny czas odsłonięcia, ustawiany w zakładce Tiles, i wchodzi do gry, gdy ten czas minie. Plansza „pole na godzinę”: narzuca tempo za ciebie i wymaga wpisania czasów z góry.',
        },
        {
          term: 'Interwałowe',
          body: 'silnik losuje ukryte pola w stałych odstępach —— partia co N minut, losowo albo w kolejności planszy. Krupier bingo. Zero pisania poza samymi polami, a plansza odsłania się, gdy śpisz.',
        },
        {
          term: 'Nagrodowe',
          body: 'dokładnie jedno pole otwarte naraz, a pierwsza drużyna, która je skończy, bierze wszystko —— pole się zamyka, a kolejne losuje się natychmiast. Bezlitosne, świetnie się ogląda i nie zna litości dla stref czasowych.',
        },
        {
          term: 'Rotacyjne',
          body: 'przesuwne okno kilku otwartych pól: każde losowanie otwiera nowe i wygasza najstarsze. W przeciwieństwie do nagrodowego każdy może skończyć otwarte pole, zanim zniknie. Zbudowane pod rankingi indywidualne.',
        },
      ],
      note: {
        tag: 'Kwestia stref czasowych',
        body: 'Plansze nagrodowe i interwałowe nagradzają tego, kto akurat nie śpi. W klanie rozsianym po świecie to prawdziwa przewaga rozdawana przez zegar, a nie przez grę. Okna rotacyjne to łagodzą —— otwarte pole zostaje otwarte przez całą długość okna, więc śpiący gracz też ma szansę.',
      },
    },

    scoring: {
      title: 'Ile warte jest ukończenie',
      intro:
        'Trzy modyfikatory, wszystkie tylko w trybie punktowym, wszystkie zamrażane w ukończeniu w chwili, w której ono następuje —— więc późniejsza zmiana nigdy nie przepisuje historii.',
      rows: [
        {
          term: 'Bonus za pierwszą drużynę',
          body: 'dodatkowe punkty dla drużyny, która pierwsza skończy dane pole. Najtańszy sposób, żeby plansza z wszystkim odsłoniętym poczuła się jak wyścig, bez zmieniania czegokolwiek innego.',
        },
        {
          term: 'Spadek wartości',
          body: 'wartość pola zmienia się liniowo z pełnej przy odsłonięciu do docelowego procentu po N godzinach, a potem stoi. Poniżej 100% spada i nagradza ściganie się; powyżej 100% **rośnie**, co nagradza sprzątanie starych zadań, które wszyscy pominęli. O kierunku w górę wszyscy zapominają, że istnieje.',
        },
        {
          term: 'Wyłączność',
          body: 'pierwsze ukończenie zamyka pole dla wszystkich innych. Domyślnie zawarte w trybie nagrodowym. Na planszy z dużą rozpiętością siły drużyn może zakończyć rywalizację wcześnie —— najlepiej wypada, gdy drużyny są wyrównane.',
        },
      ],
    },

    missions: {
      title: 'Misje: niespodzianki w trakcie',
      body: [
        'Misje to pola napisane z góry i wstrzymane —— ogłaszane z własnej puli, podczas gdy reszta planszy pozostaje widoczna. Są niezależne od polityki odsłaniania, więc może je mieć nawet zwykłe, w całości odsłonięte bingo.',
        'Zrzucaj je ręcznie, gdy plansza cichnie, w stałych odstępach albo według harmonogramu ustawionego dla każdej z osobna. Każda misja niesie własną punktację: własną wyłączność, bonus, spadek wartości i wygaśnięcie, ustawiane na polu, a nie na wydarzeniu.',
        'To najtańszy sposób obudzenia planszy piątego dnia, a piąty dzień to ten, w którym każde długie wydarzenie trzeba obudzić.',
      ],
    },

    choose: {
      title: 'Wybór na jednej stronie',
      intro: 'Jeśli wiesz, jakiego wrażenia chcesz, to najkrótsza droga do niego.',
      rows: [
        { term: 'Zwykłe klanowe bingo', body: 'Klasyczna siatka, wszystkie pola widoczne. Dodaj bonus za pierwszą drużynę, jeśli chcesz odrobiny pośpiechu.' },
        { term: 'Setki zadań punktowanych za trudność', body: 'Leagues, wszystko widoczne. To także jedyny kształt, w który może urosnąć duży import z arkusza.' },
        { term: 'Tydzień, który do czegoś narasta', body: 'Leagues z odsłanianiem zaplanowanym albo interwałowym, żeby plansza otwierała się przez tydzień, a nie naraz.' },
        { term: 'Wieczór, który ludzie oglądają na żywo', body: 'Tryb nagrodowy. Jedno pole, pierwsza drużyna bierze, natychmiast kolejne.' },
        { term: 'Rywalizacja indywidualna, nie drużynowa', body: 'Drabinka z oknem rotacyjnym i spadkiem wartości. Zadania przychodzą i znikają, a nikt ich nie odłoży.' },
        { term: 'Wyścig z metą', body: 'Wyścig po polach —— uporządkowana trasa i wygrywa ten, kto zajdzie najdalej.' },
      ],
      outro:
        'Cokolwiek wybierzesz, same pola to ta sama robota: zobacz [Plansza, która zalicza się sama]({boardGuide}).',
    },
  },

  fees: {
    metaTitle: 'Wpisowe i wypłaty — przewodnik skarbnika Anvil',
    metaDescription:
      'Ustalanie wpisowego, zbieranie go, drugi podpis, który je zamyka, i zamiana puli nagród w wypłacone miejsca.',
    eyebrow: 'Anvil · dla skarbników',
    title: 'Wpisowe i wypłaty',
    dek: 'Pieniądze to miejsce, w którym klanowe wydarzenia się sypią, i sypią się po cichu: wpisowe, o którym ktoś przysięga, że je zapłacił, pula, której nikt nie potrafi rozliczyć, podział nagród kłócony po tym, jak zwycięzcy się wylogowali. To jest droga, która na każdym kroku zostawia ślad.',
    facts: [
      { strong: '2 podpisy', rest: 'zamykają wpisowe, domyślnie' },
      { strong: 'Pula = dodane', rest: '+ wpisowe × zatwierdzone zapisy' },
      { strong: '1 wiersz', rest: 'na każdą opłaconą osobę' },
    ],
    footnote:
      'Wpisowe i wypłaty to obszar skarbnika. Skarbnik może wszystko, co moderator, plus to; moderator może oznaczyć wpisowe jako zebrane, ale nigdy go nie zamknie.',

    set: {
      title: 'Ustalanie wpisowego',
      body: [
        'Wpisowe mieszka na wydarzeniu, ustawiane przy tworzeniu albo edytowane w zakładce **Sign-ups**. Brak wpisowego to całkowicie dobra odpowiedź —— mnóstwo wydarzeń działa na samej puli dorzuconej przez gospodarza.',
        'Dwa ustawienia decydują, co wpisowe naprawdę znaczy, i łatwo je przeoczyć:',
      ],
      rows: [
        {
          term: 'Od osoby czy od konta',
          body: 'w wydarzeniu, gdzie można zgłosić kilka kont, to decyduje, czy płaci się raz, czy raz za każde. Pomyl się, a będziesz zwracał pieniądze.',
        },
        {
          term: 'Termin płatności',
          body: 'gdy minie, nieopłacone zapisy przestają być problemem do ścigania, a stają się decyzją. Ustaw go wcześniej, niż ci się wydaje —— dzień przed wydarzeniem jest za późno, żeby kogoś zastąpić.',
        },
      ],
      note: {
        tag: 'Pula podąża za zapisami',
        body: 'Wyświetlana pula nagród to to, co dorzuciłeś ręcznie, plus wpisowe razy liczba **zatwierdzonych** zapisów. Rusza się, gdy zapisy są zatwierdzane i wykluczane, więc liczba na stronie zawsze jest tą, którą naprawdę mógłbyś wypłacić.',
      },
    },

    collect: {
      title: 'Zbieranie',
      body: [
        'Wpisowe zbiera się tak, jak twój klan już zbiera pieniądze —— w grze, na Discordzie, jak wolicie. Robota Anvil zaczyna się w chwili, gdy pieniądze dotrą: ktoś z dostępem sztabu oznacza je jako **paid**, a to odciska, kto mówi, że je wziął, i kiedy.',
        'Gracze też mają głos. Członek może zgłosić, komu zapłacił, i dołączyć zrzut, i to właśnie zamienia „na pewno zapłaciłem” w zapis z dwoma końcami. Gdy zgłoszenie gracza i deklaracja zbierającego wskazują różne osoby, to rozbieżność, którą strona może ci pokazać, zamiast takiej, o której dowiadujesz się w kłótni.',
      ],
      note: {
        tag: 'Dowód jest celowo kasowany',
        body: 'Zrzut płatności jest trzymany tylko do zamknięcia wpisowego, a potem usuwany. Istnieje po to, żeby rozstrzygnąć spór, a nie żeby leżeć w magazynie przez rok.',
      },
    },

    sign: {
      title: 'Drugi podpis',
      body: [
        'Wpisowe stoi w stanie **collected**, dopóki _inny_ członek sztabu nie potwierdzi, że dotarło. Kto obracał pieniędzmi, nie może być zarazem osobą, która podpisuje, że dotarły —— na tym polega cała kontrola i dlatego strona odmawia potwierdzenia przez samego zbierającego, zamiast tylko je odradzać.',
        'Ile podpisów wymaga wpisowe, jest ustawieniem klanu, od zera do pięciu. Zero istnieje z prawdziwego powodu: w klanie, w którym skarbnik _jest_ właścicielem, nie ma nikogo innego do podpisu, a „34 wpisowe czekają na drugi podpis” staje się kolejką, której nigdy nie da się wyczyścić, i trwale najgłośniejszą rzeczą na pulpicie. Przy zerze oznaczenie wpisowego jako opłacone **jest** podpisem.',
        'Ustaw na jeden —— domyślnie —— jeśli macie dwie osoby. Ustaw na zero, jeśli szczerze nie macie, a wyżej tylko wtedy, gdy twój klan ma i ludzi, i powód.',
      ],
    },

    pay: {
      title: 'Wypłacanie',
      body: [
        'Gdy wydarzenie się kończy, zakładka **Payouts** zamienia pulę w listę ludzi. Wygeneruj ją, a dostaniesz jeden wiersz na odbiorcę, nie na drużynę: nagroda zwycięskiej drużyny dzieli się po równo między jej członków, żeby wypłacanie było listą nazwisk i liczb, a nie zadaniem z arytmetyki o północy.',
        'Kwoty startują z sugerowanego podziału —— przechylonego ku zwycięzcy, i tym bardziej płaskiego, im więcej płatnych miejsc ustawisz —— a każdy wiersz da się edytować. Sugestia to punkt wyjścia, nie zasada.',
        'Potem płacisz, odhaczając wiersze po kolei. Chodzi o to, żeby tydzień później każdy mógł spojrzeć na listę i zobaczyć, kto ile dostał, zamiast odtwarzać to z historii Discorda.',
      ],
      note: {
        tag: 'Ogłoś raz, stąd',
        body: 'Wypłaty trafiają na twoje kanały Discorda z samego wydarzenia, więc ogłoszenie i zapis to jedno i to samo. Nagroda ogłoszona ręcznie to nagroda, o której ktoś później powie, że nigdy nie doszła.',
      },
    },

    disputes: {
      title: 'Gdy liczby się nie zgadzają',
      intro: 'Cztery, które naprawdę spotkasz:',
      rows: [
        {
          term: 'Mówią, że zapłacili, nikt tego nie oznaczył',
          body: 'poproś, żeby zgłosili płatność ze zrzutem. To wpisuje w rekord zbierającego z nazwiska i znacznik czasu, a wskazana osoba może potwierdzić albo zaprzeczyć.',
        },
        {
          term: 'Dwie osoby ze sztabu obie sądzą, że wzięły',
          body: 'zgłoszenie samego gracza rozstrzyga —— wskazuje, komu przekazał. Popraw zbierającego, a potem zamknij.',
        },
        {
          term: 'Wpisowe stoi, czekając na podpis',
          body: 'albo naprawdę czeka na kogoś innego, albo twój klan ma mniej ludzi w sztabie, niż zakłada ustawienie liczby wymaganych potwierdzeń. Obniż ustawienie, zamiast potwierdzać własny wpływ.',
        },
        {
          term: 'Pula zmieniła się po tym, jak ją ogłosiłeś',
          body: 'śledzi zatwierdzone zapisy, więc zatwierdzenie albo wykluczenie zapisu nią rusza. Podawaj pulę z chwili zamknięcia zapisów, nie z chwili ich otwarcia.',
        },
      ],
    },
  },

  moderator: {
    metaTitle: 'Na dyżurze — przewodnik moderatora Anvil',
    metaDescription:
      'Dzień moderatora na klanowej stronie Anvil: kolejka, weryfikacja zgłoszeń i kont, utrzymywanie składu w zgodzie z prawdą i decyzje do podjęcia.',
    eyebrow: 'Anvil · dla moderatorów',
    title: 'Na dyżurze',
    dek: 'Moderator robi robotę, która przychodzi niezależnie od tego, czy trwa wydarzenie: dowody do obejrzenia, konta do zweryfikowania, skład, który się rozjeżdża. Oto z czego składa się kolejka i jak ją czyścić, nie stając się powodem, dla którego ludzie czekają.',
    facts: [
      { strong: 'Żadnych wydarzeń', rest: 'moderator nie tworzy ich ani nie edytuje' },
      { strong: 'Jedna strona', rest: 'mówi, co cię potrzebuje' },
      { strong: 'Zatwierdzaj szybko', rest: 'wolna kolejka wygląda jak zepsuta strona' },
    ],
    footnote:
      'Moderator widzi wszystko, co członek, plus ekrany przeglądu. Tworzenie i edytowanie wydarzeń, ustawienia, sztab i wypłaty to robota admina i skarbnika —— jeśli przycisku nie ma, to dlatego, i tak ma być.',

    what: {
      title: 'Czym jest ta rola',
      intro:
        'Role kumulują się w dół: wszystko, co może moderator, może też skarbnik i admin. Co należy konkretnie do moderatora:',
      canList: [
        'skład: synchronizacja, dodawanie ludzi, awansowanie gościa',
        'weryfikacje kont —— wyzwanie XP i przegląd ręczny',
        'zgłoszenia i zrzuty dowodowe',
        'tygodniowe konkursy i kalendarz',
        'opinie od członków',
      ],
      cantIntro: 'Czego celowo nie może:',
      cantList: [
        'tworzyć ani edytować wydarzenia, ani jego pól',
        'zmieniać ustawień klanu ani powiązań z Discordem',
        'nikogo awansować ani ruszać sztabu',
        'zamknąć wpisowego ani przeprowadzić wypłaty',
      ],
    },

    queue: {
      title: 'Zacznij od tego, co cię potrzebuje',
      body: [
        'Pulpit administracyjny nie jest podsumowaniem strony —— to lista tego, co czeka, uszeregowana według wagi, liczona z prawdziwych danych, a nie z rozjeżdżających się liczników. Jeśli mówi, że nic cię nie potrzebuje, to nic nie potrzebuje.',
        'Rób ją od góry. Na górę trafiają pozycje, po których drugiej stronie stoi człowiek: ktoś, kto nie może się zapisać, bo jego konto nie jest zweryfikowane, albo komu drop się nie policzył, bo nikt jeszcze na niego nie spojrzał.',
      ],
    },

    submissions: {
      title: 'Zgłoszenia i dowody',
      body: [
        'Większość zaliczeń nigdy do ciebie nie dociera: plugin widzi drop, archiwizuje zrzut ostemplowany drużyną i znacznikiem czasu UTC, a pole się kończy. Do kolejki trafiają pola ręczne i wszystko, co plugin oznaczył.',
        'To stempel sprawia, że z dowodem trudno dyskutować. Zrzut z pluginu niesie drużynę i chwilę wypalone w obrazie, a przy włączonym dowodzie dwuklatkowym druga klatka kilka sekund później pokazuje łup leżący już na ziemi. Zrzut bez tego wszystkiego to zrzut z telefonu, i to jest w porządku —— znaczy tylko, że sprawdzającym jesteś ty.',
      ],
      rows: [
        {
          term: 'Zatwierdzaj, gdy jest prawdopodobne',
          body: 'nie audytujesz banku. Jeśli obraz pokazuje tę rzecz, konto jest na składzie, a znacznik czasu mieści się w wydarzeniu, zatwierdź i idź dalej.',
        },
        {
          term: 'Odrzucaj z powodem',
          body: 'odrzucenie bez wyjaśnienia wraca do ciebie priv w ciągu godziny. Napisz, czego brakowało, żeby druga próba była właściwa.',
        },
        {
          term: 'Oznaczone zgłoszenie to pytanie, nie oskarżenie',
          body: 'plugin oznacza to, czego nie zdołał w pełni potwierdzić —— najczęściej gracza, który nie złożył zdjęcia startowego. Czytaj to jako „spójrz na to”, a nie „ktoś oszukiwał”.',
        },
      ],
    },

    verify: {
      title: 'Weryfikacja kont',
      intro:
        'Nikt nie zapisze się na wydarzenie bez co najmniej jednego zweryfikowanego konta, więc ta kolejka wprost blokuje ludziom granie. To ta, którą warto czyścić codziennie.',
      rows: [
        {
          term: 'Zweryfikowane przez plugin',
          body: 'przypadek najczęstszy i nie wymaga od ciebie niczego. Granie na koncie z podłączonym pluginem wiąże je automatycznie, a stabilny odcisk konta sprawia, że powiązanie przeżywa zmianę nazwy.',
        },
        {
          term: 'Verify by XP',
          body: 'dla graczy bez pluginu. Strona losuje umiejętność, a oni mają w niej zdobyć 1000 XP w ciągu trzydziestu minut. Sprawdza się samo —— widzisz tylko te, które się nie powiodły.',
        },
        {
          term: 'Przegląd ręczny',
          body: 'ukryte Hiscores albo alt zbyt świeży, żeby się na nich pojawić. Ktoś przysyła RSN z notatką, a ty decydujesz. Poproś o zrzut ekranu logowania, jeśli notatka nie wystarcza.',
        },
      ],
      note: {
        tag: 'Zweryfikowany to nie członek',
        body: 'Zweryfikowanie konta mówi „to naprawdę jego”. Nie wprowadza go do klanu —— członkostwo bierze się wyłącznie z synchronizacji składu z gry albo z ręcznego dodania przez admina. Ktoś zweryfikowany, ale spoza składu, jest **gościem**: śledzonym, widocznym i niebędącym członkiem. To celowe i to właśnie powstrzymuje kogokolwiek przed dołączeniem do twojego klanu przez wpisanie nazwy.',
      },
    },

    roster: {
      title: 'Utrzymywanie składu w zgodzie z prawdą',
      body: [
        'Skład bierze się z jednego miejsca: admin uruchamia synchronizację z listy klanu w grze, przyciskiem **Anvil** na pasku tytułu okna klanu (albo **Sync roster** w panelu bocznym pluginu)u. Wszystko inne —— weryfikacje, powiązania, zapisy —— wisi na tym.',
        'Więc utrzymanie jest małe, ale prawdziwe: puść synchronizację po każdej turze rekrutacji, awansuj gości, którzy naprawdę dołączyli, i zaglądaj do ludzi, których strona oznaczyła jako wymagających przeglądu, zamiast czekać, aż zaczną narzekać.',
      ],
      note: {
        tag: 'Ostatnio widziany to nie ostatnio grał',
        body: 'Znacznik „ostatnio widziany w klanie” zapisuje ostatnią synchronizację, która daną osobę znalazła, a nie ostatnie logowanie. Na pytanie „czy jeszcze gra” patrz zamiast tego na czas jego statystyk na żywo —— to ten, który rusza się sam.',
      },
    },

    startshot: {
      title: 'Przegląd zdjęć startowych',
      body: [
        'W wydarzeniu, które tego wymaga, każdy gracz musi złożyć zrzut zrobiony po starcie wydarzenia, w miejscu wylosowanym w chwili startu. Przechwycenia z pluginu ze zweryfikowanym słowem kluczowym przychodzą już przyjęte, więc w praktyce oglądasz tylko graczy, którzy wgrali coś ręcznie z telefonu.',
        'Sprawdzasz niewiele: postać jest na obrazie, słowo kluczowe jest na czacie i jest to słowo, które ten gracz naprawdę dostał. Wgrania liczą się natychmiast, a przegląd następuje po fakcie, więc nikt nie jest zablokowany, czekając na ciebie.',
      ],
    },

    judgement: {
      title: 'Decyzje, które będziesz musiał podjąć',
      intro:
        'Żadna z nich nie ma poprawnej odpowiedzi w oprogramowaniu i dlatego trafia do człowieka.',
      rows: [
        {
          term: 'Dowód jest prawdziwy, ale spóźniony',
          body: 'drop zdarzył się w trakcie wydarzenia, a zrzut przyszedł po jego końcu. Zwykle zatwierdzaj —— patrz na stempel w obrazie, nie na czas wgrania.',
        },
        {
          term: 'Konto nie jest jeszcze podłączone',
          body: 'drop jest prawdziwy, konto jego, po prostu nie zostało dodane przed graniem. Doprowadź do podłączenia, potem zatwierdź. Nie każ nikomu powtarzać raidu z powodu papierologii.',
        },
        {
          term: 'Wygląda na ustawione',
          body: 'zanieś to do admina, zamiast odrzucać samemu. Odrzucenie w małym klanie jest publicznym oskarżeniem i nigdy nie powinno być szybką decyzją jednej osoby.',
        },
        {
          term: 'Sam jesteś w tym wydarzeniu',
          body: 'prawie na pewno jesteś. Wszystko, co dotyczy twojej drużyny, oddaj innemu moderatorowi —— nie dlatego, że byłbyś nieuczciwy, ale dlatego, że nie powinieneś musieć dowodzić, że nie byłeś.',
        },
      ],
    },
  },
};

export default pl;
