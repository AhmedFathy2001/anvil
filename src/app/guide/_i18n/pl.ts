import type { PartialGuideDict } from './en';

// Polski — Polish.
//
// Ta sama zasada co w pozostałych plikach językowych: po angielsku zostaje wszystko, co czytelnik
// naprawdę widzi na ekranie w Anvil, RuneLite i OBS —— menu RuneLite i OBS, linie czatu wypisywane
// przez sam plugin oraz etykiety panelu administracyjnego Anvil (po angielsku, dopóki te ekrany nie
// zostaną przetłumaczone). Przetłumaczone „Tracked drop detected” sprawia, że ktoś szukający tej
// linii już jej nie znajdzie. Etykiety interfejsu Discorda (menu, ustawienia, nazwy uprawnień) piszemy
// tak, jak pokazuje je polska wersja Discorda: „Kopiuj ID serwera”, „Ustawienia serwera → Role”,
// „Zarządzanie webhookami”. Cała reszta —— wyjaśnienia, kolejność, powody —— jest po polsku.

const pl: PartialGuideDict = {
  common: {
    contents: 'Spis treści',
    step: 'Krok',
    optional: 'opcjonalnie',
    minRead: 'czytanie: {n} min',
    copyLink: 'Skopiuj link do tej sekcji',
    linkCopied: 'Link skopiowany',
    language: 'Język',
    partialNotice:
      'Ten przewodnik jest przetłumaczony na język {language} tylko częściowo. Wszystko, czego jeszcze nie przetłumaczono, pokazuje się po angielsku.',
    backToGuides: 'Wszystkie przewodniki',
    unreviewedNotice:
      'To tłumaczenie na język {language} nie zostało jeszcze sprawdzone przez native speakera. Jeśli jakieś zdanie brzmi źle, [strona angielska]({englishHref}) jest oryginałem —— a [zgłoszenie nam tego](/feedback) jest tym, co doprowadza do poprawki.',
    support: {
      lead: 'Utknąłeś albo coś wygląda źle?',
      link: 'Zapytaj na Discordzie wsparcia Anvil',
    },
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
      streamers: 'Streamerzy',
    },
    anvilTab: 'Korzystanie z Anvil',
    ingame: {
      title: 'Poradniki do gry',
      dek: 'Rajdy, bossowie, skillowanie i zarabianie z biblioteki Anvil — te same poradniki, które wtyczka pokazuje w grze, a bot publikuje na Discordzie.',
      browse: 'Przeglądaj wszystkie poradniki',
      language: 'Te poradniki nie są tłumaczone: wyświetlają się tak, jak zostały napisane, niezależnie od języka tej strony.',
      empty: 'Biblioteka Anvil nie ma jeszcze opublikowanych poradników. Zajrzyj wkrótce.',
      placeholder: 'Szukaj w poradnikach do gry — spróbuj "zulrah", "raids" lub "money"',
      readTime: '{n} min czytania',
      metaTitle: 'Poradniki OSRS do gry — Anvil',
      metaDescription: 'Poradniki o rajdach, bossach, skillowaniu i zarabianiu z biblioteki Anvil — na stronie, w grze przez wtyczkę RuneLite i na Discordzie.',
    },
    search: {
      placeholder: 'Szukaj w poradnikach — spróbuj "webhook", "pola" albo "dropy się nie pokazują"',
      results: '{n} poradników',
      empty: 'Nic nie pasuje. Spróbuj prostszego słowa — "pola", "wypłata", "bot" — albo przejrzyj listę poniżej.',
      clear: 'Wyczyść wyszukiwanie',
    },
    cards: {
      tiles: {
        eyebrow: 'Dla graczy',
        title: 'Zasady i ograniczenia pól',
        blurb: 'Czego pole wymaga od ciebie przed startem (ustawienie w grze, plugin, zsynchronizowany log, miejsce w hiscores) i czego nie potrafi śledzić.',
        minutes: '~4 min',
      },
      discord: {
        eyebrow: 'Dla prowadzącego serwer',
        title: 'Anvil na Discordzie',
        blurb: 'Jedno zaproszenie, potem kanały dla każdego kanału informacji, role, komendy ukośnikowe i co sprawdzić, gdy przestanie działać.',
        minutes: '~5 min',
      },
      switching: {
        eyebrow: 'Przejście na Anvil',
        title: 'Przejście z Dinka lub Wise Old Man',
        blurb:
          'Anvil publikuje Twoje dropy na Discordzie i prowadzi cotygodniowe konkursy. Pięć kroków dla staffu, dwa dla graczy.',
        minutes: '~3 min',
      },
      clan: {
        eyebrow: 'Dla zakładających klan',
        title: 'Załóż klan',
        blurb: 'Dwie nazwy i adres, i klan działa. Potem Discord, lista członków i pierwsza plansza.',
        minutes: '~4 min, za darmo',
      },
      plugin: {
        eyebrow: 'Dla graczy',
        title: 'Konfiguracja pluginu RuneLite',
        blurb:
          'Zainstaluj plugin, zaloguj się z jego panelu bocznego i pozwól mu wysyłać twoje dropy. Obejmuje też powiadomienia na Discordzie i wyszukiwanie graczy.',
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
      coffer: {
        eyebrow: 'Dla skarbników',
        title: 'Skarbiec klanu',
        blurb:
          'Jeden skarbiec na klanowe gp: co do niego wpływa, trzy sposoby wypłacania nagród i kto może go ruszać.',
        minutes: '~5 min',
      },
      moderator: {
        eyebrow: 'Dla moderatorów',
        title: 'Na dyżurze',
        blurb:
          'Kolejka, weryfikacja zgłoszeń i kont, utrzymywanie składu w zgodzie z prawdą, i decyzje, które trafiają do człowieka.',
        minutes: '~5 min',
      },
      commands: {
        eyebrow: 'Dla każdego członka',
        title: 'Komendy ukośnikowe',
        blurb:
          'Każda komenda, na którą bot odpowiada w Discordzie, co robi każda opcja, gotowe przykłady i co sprawdzić, gdy któraś się nie pokazuje.',
        minutes: '~6 min',
      },
      creators: {
        eyebrow: 'Dla streamerów',
        title: 'Wydarzenia dla twoich widzów',
        blurb:
          'Klan niepotrzebny. Zrób przestrzeń, udostępnij jeden link, wybierz, kto może dołączyć (obserwujący, suby, role z Discorda) i pokaż planszę na streamie.',
        minutes: '~6 min',
      },
      joiningStream: {
        eyebrow: 'Dla widzów',
        title: 'Dołączanie do wydarzenia streamera',
        blurb:
          'Masz link ze streama? Zaloguj się, dodaj postać, kliknij Join. Co zrobić przy wydarzeniach tylko dla obserwujących lub subów.',
        minutes: '~2 min',
      },
      streamingClans: {
        eyebrow: 'Dla klanów, które streamują',
        title: 'Streamowanie dla klanów',
        blurb:
          'Pozwól widzom zagrać w jednym wydarzeniu bez wstępowania do klanu. Włącz Streaming, potem otwórz wydarzenie dla widzów.',
        minutes: '~2 min',
      },
      people: {
        eyebrow: 'Dla sztabu klanu',
        title: 'Twoi ludzie: skład, goście i kto może dołączyć',
        blurb:
          'Skąd biorą się członkowie, co znaczą filtry zakładki Roster, prośby o dołączenie i Needs review, trzy ustawienia Who can join oraz usuwanie i banowanie.',
        minutes: '~6 min',
      },
      staffRoles: {
        eyebrow: 'Dla właścicieli i adminów',
        title: 'Role w sztabie: kto co może',
        blurb:
          'Właściciel, admin, skarbnik i moderator: do czego każdy ma dostęp, jak zrobić kogoś moderatorem, kto może nadać jaką rolę i funkcje obejmujące jedno wydarzenie.',
        minutes: '~6 min',
      },
      supporter: {
        eyebrow: 'Dla graczy',
        title: 'Anvil Supporter: pakiety i korzyści',
        blurb:
          'Supporter, Champion i Patron: kolory nazwy, gwiazdka, zdjęcia profilowe, gablota, wydarzenia dla znajomych i boosty klanu, jak działają płatności i co się dzieje, gdy przestaniesz płacić.',
        minutes: '~6 min',
      },
      sidePanel: {
        eyebrow: 'Dla graczy',
        title: 'Panel boczny, zakładka po zakładce',
        blurb:
          'Clan, Feed, You, Lookup i zębatka: co pokazuje każda zakładka, czat wydarzenia, reakcje GZ i Sad oraz ustawienia, które przenoszą feed i kolory Supporterów do twojej gry.',
        minutes: '~6 min',
      },
      clanBoosts: {
        eyebrow: 'Dla Supporterów i sztabu klanu',
        title: 'Boostowanie klanu',
        blurb:
          'Dawanie i przenoszenie boosta, trzy poziomy i co każdy odblokowuje, kolory nazwy klanu, podarowane boosty oraz znaczki i odznaki boosterów.',
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

  switching: {
    metaTitle: 'Przejście z Dinka lub Wise Old Man — Anvil',
    metaDescription:
      'Przenieś klan z Dinka i Wise Old Man do Anvil: skonfiguruj kanały Discorda, zsynchronizuj listę klanu, wystartuj Skill lub Boss of the Week i powiedz o tym członkom.',
    eyebrow: 'Przejście na Anvil',
    title: 'Przejście z Dinka lub Wise Old Man',
    dek: 'Anvil robi obie rzeczy. Publikuje dropy i osiągnięcia klanu na Discordzie. Prowadzi też listę klanu i cotygodniowe konkursy.',

    staff: {
      title: 'Jeśli prowadzisz klan',
      body: [
        '**Pozwól botowi skonfigurować kanały.** Wejdź w Admin → Discord → **Set it up for me**. Wybierz jeden kanał albo kilka. Jeśli Dink coś gdzieś publikował, zaznacz _Use the same channels_. Dla członków nic się nie zmienia.',
        '**Zsynchronizuj listę klanu.** W RuneLite otwórz ustawienia wtyczki Anvil. Włącz **Keep the clan roster in sync**. Robi to jeden admin, raz, w grze. To zastępuje Twoją grupę w Wise Old Man.',
        '**Wystartuj Skill lub Boss of the Week.** Wejdź w Admin → All events → **+ New event** i wybierz Skill of the Week albo Boss of the Week. Wszyscy z listy klanu biorą udział automatycznie. To zastępuje konkursy z Wise Old Man.',
        '**Powiedz o tym członkom.** Wejdź w Admin → Discord → **Tell your members** → **Post it**. Bot opublikuje kroki dla graczy za Ciebie.',
        '**Tydzień później: posprzątaj.** Wejdź w Admin → Discord → **Remove Dink’s old webhooks**, zaznacz te do usunięcia, kliknij **Remove … webhooks**, a potem **Yes, remove them**. Po tym nic nie opublikuje się dwa razy. Kliknij **Keep** przy każdym, który chcesz zostawić w spokoju.',
      ],
    },

    player: {
      title: 'Jeśli jesteś graczem',
      body: [
        '**Zainstaluj Anvil.** W RuneLite otwórz Plugin Hub, wyszukaj Anvil i kliknij **Install**. Potem zaloguj się przez Discord w panelu bocznym Anvil.',
        '**Wyłącz powiadomienia Dinka.** Albo odinstaluj Dinka, jeśli nie używasz go do niczego innego.',
        '**To wszystko.** W sprawie Wise Old Man nie musisz nic robić.',
      ],
    },

    questions: {
      title: 'Pytania',
      intro: 'Te, o które klany pytają najczęściej:',
      rows: [
        {
          term: 'Czy możemy zostawić Dinka do niektórych rzeczy?',
          body: 'Tak. Anvil nie publikuje kill countów, zadań slayera ani speedrunów. Zostaw w Dinku włączone tylko je.',
        },
        {
          term: 'Czy nadal potrzebujemy Wise Old Man?',
          body: 'Tylko do rekordów wszech czasów i rang EHP / EHB.',
        },
        {
          term: 'Czy gracze muszą gdzieś wklejać webhook?',
          body: 'Nie. Klan ustawia kanały na stronie.',
        },
        {
          term: 'Chcesz publikacji także na własnym serwerze?',
          body: 'Wejdź w swój profil → **Announcements & webhooks** → _Your own webhooks_.',
        },
      ],
    },
  },

  clan: {
    metaTitle: 'Załóż klan — Anvil',
    metaDescription: 'Utwórz klan w Anvil: nadaj mu nazwę, wybierz adres, podłącz Discorda, zsynchronizuj listę członków i przeprowadź pierwsze wydarzenie.',
    eyebrow: 'Anvil · na start',
    title: 'Załóż klan',
    dek: 'Dwie nazwy i adres, i twój klan działa — za darmo i bez czekania. To jest to, plus cztery rzeczy, które warto zrobić zaraz potem.',
    facts: [
      {
        strong: 'Za darmo',
        rest: 'bez karty, bez okresu próbnego',
      },
      {
        strong: 'Działa',
        rest: 'w chwili wysłania formularza',
      },
      {
        strong: '~4 min',
        rest: 'do działającego klanu',
      },
    ],
    footnote: 'Wszystko to możesz później zmienić w Admin → **Clan settings**, poza adresem — nad nim warto się teraz chwilę zastanowić.',
    before: {
      title: 'Zanim zaczniesz',
      body: [
        'Potrzebujesz konta Discord i to cała lista. Najpierw zaloguj się na `{apex}`: klan musi mieć właściciela, a logowanie jest tym, po czym strona wie, że to ty. Zacznij od **Załóż klan** na stronach platformy albo wejdź prosto na `{apex}/clans/new`.',
        'To nic nie kosztuje. Nie ma planu do wyboru, karty do wpisania ani okresu próbnego, który wygasa i zabiera twoją planszę — klan startuje za darmo i pozostaje używalny.',
        'Duże klany mogą później przejść na wyższy plan w **Plan and billing** w panelu Admin. Wszystko, za co płacisz w Anvil — klan, przestrzeń twórcy albo własne członkostwo Supporter — jest na [twojej stronie płatności](/portal).',
      ],
      note: {
        tag: 'Zostaniesz jego właścicielem',
        body: 'Właściciel to jedyna rola, której nikt ci nie odbierze, i trafia do tego, kto zakłada klan. Personel dodasz potem w Admin → **People** → **Staff & roles**; zobacz [W grafiku]({moderatorGuide}).',
      },
    },
    create: {
      title: 'Nadaj nazwę i wybierz adres',
      intro: 'Trzy pola i tylko dwie prawdziwe decyzje. Formularz sprawdza adres w trakcie pisania i mówi ci o tym przed wysłaniem.',
      fields: [
        {
          term: 'Nazwa klanu w grze',
          body: 'Wymagana i musi zgadzać się z OSRS **dokładnie**. To nie ozdoba: synchronizacja listy dopasowuje po niej i odrzuca listę członków zgłoszoną pod jakąkolwiek inną nazwą. To właśnie powstrzymuje cudzą listę członków przed wylądowaniem na twojej stronie.',
        },
        {
          term: 'Nazwa klanu',
          body: 'Opcjonalna. To, co widzą ludzie — na stronie i w każdym poście na Discordzie. Zostaw puste, a do obu użyta zostanie nazwa z gry.',
        },
        {
          term: 'Adres',
          body: 'Twój klan mieszka pod `{apex}/c/twoj-slug`. Jest proponowany na podstawie wpisanej nazwy, możesz go edytować, a garść słów jest zarezerwowana. Wybierz taki, który spodoba ci się także za rok: to link, który wyląduje przypięty na twoim Discordzie.',
        },
      ],
      note: {
        tag: 'Nazwa z gry to zamek, nie etykieta',
        body: 'Jeśli klan zmieni nazwę w grze, zmień ją też tutaj — do tego czasu synchronizacja będzie odrzucać nową nazwę. To działające zabezpieczenie, nie usterka.',
      },
    },
    live: {
      title: 'Klan działa',
      body: [
        'Naciśnij **Utwórz klan** i on istnieje. Bez przygotowywania, bez kolejki, bez „budujemy twoją stronę, wróć za kilka minut” — klan to wiersz, więc odpowiada już zanim strona skończy się przełączać.',
        'Trafiasz na wybór: **Skonfiguruj**, co otwiera kreatora, albo **Najpierw się rozejrzyj**. Nic się nie zepsuje, jeśli odejdziesz i wrócisz jutro; kreator pamięta, które kroki masz za sobą.',
      ],
    },
    setup: {
      title: 'Kreator konfiguracji',
      intro: 'Trzy kroki dzielą świeży klan od trwającego wydarzenia, a kreator przechodzi je po kolei i pomija to, co już zrobiłeś. Plansza przychodzi zaraz potem.',
      steps: [
        {
          term: 'Twój klan',
          body: 'Twoja nazwa wyświetlana, nazwa klanu w grze i link zapraszający na twój serwer. Zaproszenie jest tym, dzięki czemu strony zapisów i poradniki mogą kierować do ciebie ludzi.',
        },
        {
          term: 'Podłącz Discorda',
          body: 'Jeden wspólny bot, więc nie ma aplikacji do rejestrowania ani tokenu do wklejania. Naciśnij **Connect your bot** i zatwierdź go raz, potem wybierz **A few channels** albo **Just one channel** i naciśnij **Set it up for me** — bot sam utworzy kanały.',
        },
        {
          term: 'Wprowadź członków',
          body: 'Zainstaluj plugin, zaloguj się przez Discorda, potem otwórz w grze okno klanu i naciśnij przycisk **Anvil** na jego pasku tytułu. Nikt nie zapisze się na wydarzenie, dopóki twoja lista członków nie trafi na stronę.',
        },
        {
          term: 'Zrób planszę',
          body: 'Kreator kończy się przyciskiem **Create your first event →**. Wybierz format, dodaj pola, otwórz zapisy — to [Poprowadź pierwsze wydarzenie]({adminGuide}) i zdecydowanie najdłuższy krok.',
        },
      ],
      after: [
        'Możesz całkowicie pominąć kreatora przyciskiem **Skip setup** i zrobić wszystko później w Admin → **Clan settings** i Admin → **Discord**. Istnieje dlatego, że kolejność ma znaczenie, gdy robisz to pierwszy raz: Discord przed kanałami, członkowie przed planszą, na którą muszą się zapisać.',
      ],
    },
    members: {
      title: 'Wciągnięcie członków',
      body: [
        'Nikt nie musi się zapisywać, rejestrować ani być zapraszany pojedynczo. Twoja lista członków pochodzi z gry.',
      ],
      ways: [
        {
          term: 'Synchronizacja listy (wybierz tę)',
          body: 'Otwórz w grze okno klanu z działającym pluginem i naciśnij przycisk **Anvil** na jego pasku tytułu. Cała lista przychodzi wraz z rangami, a lista z klanu, którego nazwa nie zgadza się z twoją, zostaje odrzucona. Powtarzaj to, gdy ktoś dołącza lub odchodzi — zobacz [poradnik konfiguracji dla graczy]({pluginGuide}).',
        },
        {
          term: 'Proszą o dołączenie',
          body: 'Logowanie ani granie z pluginem samo z siebie nikomu nie daje miejsca. Jeśli plugin widzi, że ktoś gra w twoim klanie w grze, zanim twój skład go ma, składa za niego prośbę o dołączenie, a każdy inny może poprosić przyciskiem **Apply** na stronie twojego klanu. Sztab odpowiada na jedno i drugie na górze zakładki **Roster**, a **Who can join** decyduje, czy czekają na zgodę, wchodzą od razu, czy w ogóle nie mogą prosić. Ktoś, kto gra postacią już obecną w twoim składzie, jest zamiast tego potwierdzany w **Needs review**. Szczegóły są w [Twoi ludzie]({peopleGuide}).',
        },
        {
          term: 'Ręcznie',
          body: 'Admin → **People** → **+ Add Manually** przyjmuje nazwy pojedynczo, dla kogoś na telefonie albo oficjalnym kliencie, kto w ogóle nie może uruchomić pluginu.',
        },
      ],
      note: {
        tag: 'Goście to nie problem do rozwiązania',
        body: 'Gość gra w twoich wydarzeniach, nie będąc w twoim klanie w grze: gracz odwiedzającego klanu, znajomy, alt. Dostaje miejsce, gdy sztab zatwierdzi jego prośbę, albo od razu, jeśli **Who can join** jest ustawione na **Let anyone in**. Goście są śledzeni i mogą brać udział w wydarzeniach, a nie wliczają się do twojego planu. Ktoś, kto dołączy do ciebie w grze, zostaje członkiem przy następnej synchronizacji składu.',
      },
    },
    first: {
      title: 'Twoje pierwsze wydarzenie',
      body: [
        'Najkrótsza droga do tego, żeby coś się działo: zrób planszę, dodaj garść pól, które plugin widzi sam, otwórz zapisy i wystartuj. Dropy, liczniki zabić i XP zapisują się potem same.',
        'Dwa poradniki niosą tu ciężar. [Poprowadź pierwsze wydarzenie]({adminGuide}) prowadzi od początku do końca — Discord, drużyny, start i co robić, gdy się kończy. [Zbuduj planszę, która śledzi się sama]({boardGuide}) dotyczy konkretnie pól: co każdy rodzaj naprawdę potrafi wykryć i które importują się ładnie, a potem nigdy nie zadziałają.',
        'Jeśli w pierwszym tygodniu wolisz w ogóle nie budować planszy, zrób zamiast tego **Skill of the Week** albo **Boss of the Week**. Wszyscy z listy biorą udział automatycznie, wyniki idą z hiscores i nie ma nic do napisania.',
      ],
    },
    together: {
      title: 'Wydarzenia między klanami',
      body: [
        'Wydarzenie nie musi należeć do jednego klanu. Kilka klanów może prowadzić tę samą planszę razem — dwa albo tuzin — a każda strona zachowuje własną listę członków, własny personel i własną połowę moderacji.',
        'Mogą też dzielić jedną pulę graczy zamiast siedzieć po przeciwnych stronach tabeli: jedno wydarzenie, wszyscy w środku, niezależnie od tego, jak ostatecznie podzielone zostaną drużyny. Klan przeciw klanowi to jedna z form tego, nie jedyna.',
        'Każdy odwiedzający klan dostaje link zapraszający na drużynę, więc nigdy nie zbierasz ręcznie ani jednego RSN-u, oraz miejsce pozwalające ich własnemu moderatorowi zatwierdzać dowody własnych członków. [Goszczenie odwiedzającego klanu]({clanVsClanGuide}) omawia prowadzenie takiego wydarzenia.',
      ],
      note: {
        tag: 'Nie ma czego kupować',
        body: 'Udział w cudzym wydarzeniu jest darmowy i prowadzenie własnego też. Klan, który tylko pojawia się na cudzych planszach, nigdy nie potrzebuje niczego poza własnym darmowym klanem.',
      },
    },
    boosts: {
      title: 'Boosty klanu',
      body: [
        'Członkowie, którzy płacą za Anvil Supporter na poziomie **Champion** (jeden boost) lub **Patron** (dwa), mogą boostować klan ze swoich własnych **Settings → Clan boosts**. Boost liczy się, gdy ich miejsce w klanie ma 14 dni, a od jednej osoby liczą się najwyżej dwa.',
        'Gdzie jesteście, widzisz w Admin → **Clan settings** → **Boosts**: poziom klanu, ile boostów się liczy i ilu jeszcze brakuje do następnego poziomu. Level 1 wymaga 3 boostów, Level 2 — 8, a Level 3 — 15. Jeśli boostów spadnie poniżej poziomu, jego korzyści zostają jeszcze przez tydzień.',
        'Level 1 dodaje odznakę **Boosted** na stronie klanu, na jego karcie w Clan Hall i w wyszukiwaniu, stawia was w Clan Hall nad klanami bez boostów i nadaje nazwie gradient. Level 2 dodaje miejsce w rzędzie Featured w Clan Hall, odtwarza animowany baner i odblokowuje **Recruiting line**: jedno zdanie, do 140 znaków, pokazywane odwiedzającym. Level 3 dodaje Spotlight na górze Clan Hall i jeden **Recruitment post in the Anvil Discord** w miesiącu, do 500 znaków, wysyłany raz przyciskiem **Post to the Anvil Discord**, z linkiem do strony klanu i bez oznaczania kogokolwiek.',
      ],
      note: {
        tag: 'Tylko wygląd',
        body: 'Boosty zmieniają to, jak klan wygląda i gdzie jest wyświetlany. Nigdy nie zmieniają rangi, wyniku, waszych miejsc ani planu.',
      },
    },
  },

  discord: {
    metaTitle: 'Anvil na Discordzie — Anvil',
    metaDescription: 'Podłącz bota Anvil do swojego serwera Discord: jedno zaproszenie, kanały dla każdego strumienia, synchronizacja ról i pseudonimów, komendy ukośnikowe i co sprawdzić, gdy zrobi się cicho.',
    eyebrow: 'Anvil · Discord',
    title: 'Anvil na Discordzie',
    dek: 'Jeden bot, jedno zaproszenie i żadnej aplikacji do rejestrowania. Oto co publikuje, gdzie to publikuje, co może zmienić na twoim serwerze — i na co spojrzeć w dniu, w którym przestanie.',
    facts: [
      {
        strong: 'Jeden bot',
        rest: 'wspólny, nic do tworzenia',
      },
      {
        strong: '~5 min',
        rest: 'od zaproszenia do pierwszego posta',
      },
      {
        strong: 'Opcjonalne',
        rest: 'każdy strumień jest wyłączony, dopóki go nie skierujesz',
      },
    ],
    footnote: 'Wszystko to znajdziesz w Admin → **Discord**: na górze szybka konfiguracja, a pod nią **More settings** — Connection, What goes where, Event posts, Roles & nicknames, Team channels, Commands i Post without a bot.',
    bot: {
      title: 'Jeden bot, już gotowy',
      body: [
        'Nie ma aplikacji Discord do utworzenia, tokenu do wygenerowania ani sekretu do wklejenia. Anvil prowadzi jednego bota, którego dzielą wszystkie klany, więc podłączenie to zaproszenie i nic więcej.',
        'Nadal możesz przynieść własnego — wklej token w **Use your own bot instead (advanced)**, a zostanie użyty zamiast tamtego. Warto tylko wtedy, gdy chcesz, by bot nosił nazwę i awatar twojego klanu na liście członków; wszystko w tym poradniku działa tak samo w obu przypadkach.',
      ],
      permissions: [
        {
          term: 'Wyświetlanie kanałów, Wysyłanie wiadomości, Osadzanie linków, Załączanie plików',
          body: 'Podstawy. Bez nich jest na twoim serwerze i milczy.',
        },
        {
          term: 'Zarządzanie webhookami',
          body: 'Żeby **Set it up for me** i **Post here** mogły tworzyć webhooki za ciebie, zamiast żebyś ręcznie kopiował adresy z Discorda, i żeby Anvil mógł znaleźć stare webhooki do usunięcia.',
        },
        {
          term: 'Zarządzanie rolami',
          body: 'Tylko jeśli włączysz synchronizację ról. Wtedy może rozdawać role, które przypiszesz — i nigdy nie może ruszyć roli wyższej od własnej, co jest zasadą Discorda, nie naszą.',
        },
        {
          term: 'Zarządzanie pseudonimami',
          body: 'Tylko jeśli włączysz synchronizację pseudonimów, żeby pseudonim członka na serwerze mógł zostać ustawiony na jego RSN.',
        },
        {
          term: 'Zarządzanie kanałami',
          body: 'Do prywatnych kanałów drużyn podczas draftu oraz do poradników publikowanych jako nowa kategoria lub forum. Bez tego wszystko inne i tak działa.',
        },
        {
          term: 'Zarządzanie wątkami, Wysyłanie wiadomości w wątkach',
          body: 'Do poradników na forum: pisania w poście i ponownego usunięcia go — bez tego Discord nie pozwoli botowi usunąć nawet własnego posta na forum.',
        },
        {
          term: 'Zmiana pseudonimu',
          body: 'Tylko jeśli nadasz botowi nazwę swojego klanu w **Connection → Bot appearance in your server**. Zmienia to nazwę bota tylko na twoim serwerze.',
        },
      ],
      note: {
        tag: 'Prosi o wszystko naraz',
        body: 'Discord nie ma sposobu, by poprosić o uprawnienie później, więc link zapraszający żąda całego zestawu, a funkcje, których nigdy nie włączysz, nigdy nie używają swoich. Ponowne otwarcie linku zapraszającego to także sposób na naprawienie uprawnienia, które ktoś usunął.',
      },
    },
    connect: {
      title: 'Podłączanie',
      intro: 'Dwie rzeczy, w tej kolejności. Bot musi być na twoim serwerze, a Anvil musi wiedzieć, który serwer jest twój.',
      steps: [
        {
          term: 'Zaproś bota',
          body: 'Admin → **Discord** → **Connect your Discord server** (albo **Add Anvil to Discord**). Discord zapyta, do którego serwera dodać Anvil, i odeśle cię tutaj, więc nie dodasz go przypadkiem do niewłaściwego. Później **Invite / re-invite the bot** znajdziesz w **More settings → Connection**.',
        },
        {
          term: 'Ustaw identyfikator serwera',
          body: 'Tylko jeśli przycisk sobie nie poradzi: otwórz **Can’t use the button? Enter the server ID**, kliknij prawym na ikonę serwera w Discordzie → **Kopiuj ID serwera** (wymaga włączonej opcji Tryb dewelopera w ustawieniach Discorda, w sekcji Zaawansowane), wklej go w **Your Discord server’s ID** i naciśnij **Save**. To pole sprawia, że połączenie dotyczy właśnie ciebie.',
        },
      ],
      after: [
        'Panel powie ci potem prawdę zamiast twoich zamiarów: czy bot naprawdę jest członkiem tego serwera i jakich uprawnień mu brakuje. Zielona linijka tam jest warta więcej niż zapisany formularz.',
      ],
      note: {
        tag: 'Identyfikator serwera to całe powiązanie',
        body: 'Serwer należy w Anvil dokładnie do jednego klanu, a komendy ukośnikowe z serwera, którego nikt nie przypisał, są odrzucane, a nie zgadywane. Dopóki go nie ustawisz, bot jest zaproszony i bezczynny.',
      },
    },
    channels: {
      title: 'Konfiguracja webhooków',
      body: [
        'Anvil publikuje przez **webhooki**, po jednym na kanał, i każdy z nich jest opcjonalny. Nic nigdzie nie trafia, dopóki nie skierujesz strumienia na kanał — świeży klan milczy celowo, nie przez przypadek.',
        'Gdy bot Anvil jest na twoim serwerze, **Set it up for me** na górze **Admin → Discord** tworzy kanały i kieruje na nie każdy strumień. Żeby zrobić to ręcznie, otwórz **More settings → What goes where** i zacznij od **Catch-all channel** w **Clan & events**, potem **In-game catch-all** w **In-game (plugin)**: wybierz kanał z listy rozwijanej, a zapisze się sam. Bez bota otwórz w Discordzie dla tego kanału **Edytuj kanał → Integracje → Webhooki**, utwórz webhook, skopiuj jego URL, wybierz **Paste a webhook…** z listy rozwijanej, wklej go i naciśnij **Save**. URL webhooka pozwala publikować na jego kanale, więc traktuj go jak hasło; jeśli wycieknie, usuń go w Discordzie i utwórz nowy. **Test** oraz **Add another**, by rozdzielać intensywny ruch między dwa webhooki, są w **Post without a bot**.',
      ],
      feeds: [
        {
          term: 'Catch-all channel',
          body: 'Najważniejszy, w zakładce **Clan & events**. Starty i zakończenia wydarzeń, otwarcie zapisów, wyniki, rezultaty tygodnia — wszystko, co strona publikuje bez własnego kanału. Ustaw tylko ten, a masz działający klan.',
        },
        {
          term: 'In-game catch-all',
          body: 'W zakładce **In-game (plugin)**: tam trafia wszystko z gry, co nie ma własnego kanału. Ustaw go jako drugi.',
        },
        {
          term: 'Rozdzielone strumienie',
          body: 'Posty o wydarzeniach, plansze współprowadzone z innymi, Skill & boss of the week i wydarzenia z kalendarza klanu można wydzielić z kanału zbiorczego; rzadkie dropy, pety, collection log, poziomy, combat achievements, questy, diaries, śmierci i zabójstwa PvP można wydzielić z kanału zbiorczego dla gry. Zmiany w składzie, zatwierdzenia zapisów i księga skarbca są w **Staff only**. Puste wydzielone strumienie spadają z powrotem na swój kanał zbiorczy. Wyjątkiem jest skarbiec: puste oznacza brak jakichkolwiek postów o pieniądzach. Leagues i inne tryby mają własną zakładkę **Game modes**.',
        },
      ],
      note: {
        tag: 'Najpierw oddziel śmierci',
        body: 'Śmierci to na większości plansz strumień o największej objętości i ten, który przykrywa całą resztę. Jeśli oddzielisz tylko jedną rzecz, oddziel właśnie tę.',
      },
    },
    roles: {
      title: 'Role i pseudonimy',
      body: [
        'Obie synchronizacje są wyłączone, dopóki nie włączysz ich w **Admin → Discord → Roles & nicknames**, i obie napędza skład klanu. Włącz **Enable Discord role sync**, pozostaw włączone **Auto-match in-game rank → Discord role by name**, wybierz ewentualne ogólne **Member roles** i **Guest roles**, zapisz i naciśnij **Sync roles & nicknames now**. Każda osoba musi też mieć połączoną tożsamość Discord; raport synchronizacji wymienia każdego, kogo nie udało się dopasować.',
      ],
      ways: [
        {
          term: 'Synchronizacja ról',
          body: 'Przy automatycznym dopasowaniu rang nazwa roli na Discordzie musi zgadzać się z rangą klanu w grze: `Owner`, `Deputy Owner`, `Coordinator`, `Overseer`, `General`, `Captain`, `Lieutenant`, `Sergeant`, `Corporal` lub `Recruit`. Własne rangi też działają, gdy ich rola na Discordzie ma dokładnie tę samą nazwę. Wielkość liter nie ma znaczenia, a podkreślniki liczą się jak spacje, lecz dodatkowe słowa nie pasują: `General` działa, `OSRS General` nie. Role członków i gości wybiera się osobno, więc mogą nazywać się dowolnie.',
        },
        {
          term: 'Synchronizacja pseudonimów',
          body: 'Ustawia pseudonim członka na serwerze na jego RSN. Domyślnie uzupełnia pusty pseudonim i można jej kazać nadpisać ten, który ktoś wybrał sam — nad tym ustawieniem warto pomyśleć przed, nie po.',
        },
      ],
      note: {
        tag: 'Rola bota musi być wyżej niż te, którymi zarządza',
        body: 'Discord nie pozwala żadnemu botowi ruszyć roli równej własnej ani wyższej i odmawia tego po cichu z twojej strony — synchronizacja po prostu nic nie robi. Przeciągnij rolę Anvil wyżej w Ustawienia serwera → Role, a zacznie działać; niczego nie trzeba zapraszać ponownie.',
      },
    },
    commands: {
      title: 'Komendy ukośnikowe',
      body: [
        'Bot odpowiada na `/bingo` na twoim serwerze (plansza, ranking, zasady, twoja własna karta), a do tego na komendy klanowe, takie jak `/sotw`, `/stats` i `/coffer`. Czytają stronę na żywo, więc nikt nie musi wychodzić z Discorda, żeby sprawdzić, jak stoi. [Każda komenda i jej opcje]({commandsGuide}) mają własną stronę.',
        'Pojawiają się mniej więcej minutę po dołączeniu bota. Jeśli nie pojawią się w ogóle, zaproszenie przyznało bota, ale nie jego komendy — to dwa osobne uprawnienia, a starszy link zapraszający prosił tylko o jedno. Uruchom ponownie **Invite / re-invite the bot** w **Connection** na stronie Discord; nie wyrzuci to bota ani niczego nie zresetuje.',
      ],
      note: {
        tag: 'Odpowiada w języku każdej osoby',
        body: 'Domyślnie bot odpowiada w języku, jaki dana osoba ustawiła w Discordzie, z angielskim jako zapasowym. Wybierz jeden język w **Język bota**, żeby narzucić go wszystkim — to także jedyna droga do arabskiego, bo Discord nie ma arabskiego języka klienta do wykrycia.',
      },
    },
    posts: {
      title: 'Co publikuje i kiedy',
      body: [
        'Dwa źródła i warto wiedzieć, które jest które, gdy coś wygląda źle.',
        '**Strona** publikuje wydarzenia: otwarcie planszy, zapisy, start, wyniki, rezultat. Wychodzą z samego Anvil i działają niezależnie od tego, czy ktokolwiek ma plugin.',
        '**Plugin** publikuje to, co dzieje się w grze: dropy, pety, śmierci, poziomy, pola collection loga, combat achievements. Istnieją tylko dla członków, którzy go używają, więc cichy kanał dropów zwykle oznacza cichy plugin, a nie zepsuty webhook.',
      ],
      note: {
        tag: 'Nic nie jest publikowane dwa razy',
        body: 'Drop, który kończy pole, to jeden post, a nie jeden od pluginu i drugi od planszy.',
      },
    },
    modes: {
      title: 'Leagues, Deadman i inne tryby',
      body: [
        'Leagues, Deadman, hardcore i inne tryby działają na własnych światach z własnymi postaciami. Ich posty są zawsze oznaczone i nigdy nie liczą się do plansz ani konkursów. Mają własną zakładkę: **Admin → Discord → What goes where → Game modes**. Tryb pojawia się tam, gdy pierwszy członek w niego zagra.',
        'Każdy tryb ma przełącznik i kanał **To**. Włącz **Send game-mode posts to their own channels**, żeby używać tych kanałów; zostaw wyłączone, a każdy tryb publikuje na zwykłych kanałach, nadal z oznaczeniem. Przycisk **Posts** w wierszu trybu pokazuje każdy rodzaj postów, jaki wysyła — zwykłe i własne wydarzenia trybu — każdy z własnym przełącznikiem.',
        'Pod tą listą **Custom filters** sprawiają, że tryb publikuje mniej niż główna gra. **Post drops rarer than 1 in…** ustawia własny próg rzadkości (puste = tak samo jak w głównej grze): przedmioty publikowane zawsze nadal się publikują, ale dropy, które liczą się tylko ze względu na wartość, już nie. **Use its own level milestones** publikuje awans poziomu tylko wtedy, gdy spełnia oba zestawy reguł.',
      ],
      note: {
        tag: 'Ostrzej, nigdy luźniej',
        body: 'Filtry trybu mogą tylko odbierać posty. Plugin zastosował już twoje ustawienia głównej gry, więc żaden filtr trybu nie przywróci posta.',
      },
    },
    cleanup: {
      title: 'Stare webhooki od Dinka lub innych botów',
      body: [
        'Gdy bot jest na twoim serwerze, strona Discord wymienia każdy webhook na nim, który nie należy do Anvila. **Coming from Dink?** proponuje **Use the same channels**, żeby **Set it up for me** publikowało tam, gdzie twoje stare strumienie, i żeby dla członków nic się nie przesunęło.',
        'Gdy członkowie przejdą już na Anvil, wejdź w **Remove Dink’s old webhooks**, zaznacz te do usunięcia i naciśnij **Remove … webhooks**, a potem **Yes, remove them**. To usuwa je z Discorda na dobre — nie da się tego cofnąć.',
        'Lista obejmuje każdy webhook, który nie należy do Anvila, nie tylko te od Dinka. Chcesz jakiś zachować, na przykład strumień innego bota? Naciśnij **Keep**, a zniknie z listy; **Show kept** i **Put back** go przywracają. Zachowanie tylko ukrywa go tutaj — na Discordzie nic się nie zmienia.',
      ],
      note: {
        tag: 'Wymaga uprawnienia Zarządzanie webhookami',
        body: 'Bot odczytuje webhooki twojego serwera, żeby je znaleźć. Bez uprawnienia _Zarządzanie webhookami_ w jego roli strona pokaże, że ich nie widzi.',
      },
    },
    announce: {
      title: 'Publikowanie na Discordzie',
      body: [
        'Admini mogą publikować jako bot z **Post to Discord**, w sekcji **Clan** menu administracyjnego. Wybierz **Channel**, napisz treść w **Message** i naciśnij **Send message**. Długi tekst, jak regulamin, sam dzieli się na kilka wiadomości.',
        '**Send as an embed** jest domyślnie włączone i dodaje opcjonalny **Title** oraz **Accent colour**; wyłącz je, żeby wysłać zwykły tekst. **Ping** wybiera rolę albo @everyone do oznaczenia, a Anvil pyta przed wysłaniem.',
        'Każdy wysłany post jest na liście **Sent from here**. **Edit** zmienia go na Discordzie bez ponownego oznaczania, a **Delete** go usuwa.',
      ],
      note: {
        tag: 'Tylko admini, z botem',
        body: 'Publikuje jako bot Anvila, więc najpierw podłącz serwer. Moderatorzy tego nie widzą. To przełącznik **Post to Discord** w **Clan settings → Features**; po wyłączeniu znika z menu.',
      },
    },
    quiet: {
      title: 'Gdy robi się cicho',
      body: [
        'Po kolei, bo każdy punkt wyklucza następny:',
      ],
      checks: [
        {
          term: 'Czy bot naprawdę jest na serwerze?',
          body: '**Connection** na stronie Discord mówi to wprost. „Token poprawny” i „na twoim serwerze” to dwa różne fakty i pierwsze nie oznacza drugiego — przy wspólnym bocie token jest zawsze poprawny.',
        },
        {
          term: 'Czy identyfikator serwera jest właściwy?',
          body: 'Błędny, ale prawdziwy identyfikator wygląda dokładnie jak właściwy, dopóki nie zauważysz, że posty trafiają gdzie indziej.',
        },
        {
          term: 'Czy webhook nadal istnieje?',
          body: 'Usunięcie kanału na Discordzie usuwa jego webhook, a Anvil zachowuje martwy adres. Wybierz dla niego kanał ponownie w **What goes where**.',
        },
        {
          term: 'Czy rola bota jest wystarczająco wysoko?',
          body: 'Tylko dla synchronizacji ról i pseudonimów — patrz wyżej. To ta, która zawodzi po cichu.',
        },
      ],
      note: {
        tag: 'Nie potrafi witać dołączających',
        body: 'Discord zgłasza dołączenia tylko przez połączenie gateway, którego wspólny bot nie utrzymuje dla każdego serwera. Nie ma więc posta powitalnego — wstaw link do zapisów na kanał #role albo #zacznij-tutaj, gdzie ludzie i tak zaglądają.',
      },
    },
  },

  plugin: {
    metaTitle: 'Konfiguracja pluginu RuneLite — Anvil',
    metaDescription:
      'Zainstaluj plugin RuneLite od Anvil, zaloguj się z jego panelu bocznego i skonfiguruj powiadomienia na Discordzie.',
    eyebrow: 'Anvil · plugin RuneLite',
    title: 'Przewodnik konfiguracji dla graczy',
    dek: 'Zainstaluj, zaloguj się i graj. Plugin zgłasza twoje dropy do bingo, wrzuca rzadkie dropy, śmierci i kamienie milowe na Discorda, a do tego pozwala sprawdzić każdego jednym prawym kliknięciem.',
    facts: [
      { strong: '1 przycisk', rest: 'żeby ruszyć ze śledzeniem' },
      { strong: '~3 min', rest: 'na podstawową konfigurację' },
      { strong: 'Prawy klik', rest: 'żeby sprawdzić każdego' },
    ],
    footnote:
      'Zrzuty ekranu pochodzą z działającej konfiguracji —— token konta jest celowo zamazany. Twój powinien pozostać równie prywatny.',

    install: {
      title: 'Zainstaluj plugin',
      body: [
        'W RuneLite: **Configuration** (klucz) → **Plugin Hub** → wyszukaj **Anvil** → **Install**. Wydawcą jest `AhmedFathy2001`.',
        'Jeden plugin obsługuje każdy klan —— zawsze łączy się z `anvilosrs.com`, a dopiero logowanie (następny krok) wiąże go z tobą i twoimi klanami. Nie ma nic klanowego do pobrania ani żadnego adresu do wpisania. Po instalacji na pasku bocznym RuneLite pojawia się przycisk **Anvil**, a ustawienia znajdziesz w **Configuration → Anvil**.',
      ],
    },

    connect: {
      title: 'Zaloguj się',
      intro: 'Otwórz panel **Anvil** z paska bocznego RuneLite i kliknij **Sign in with Discord**. Przeglądarka otworzy się na `anvilosrs.com`; zatwierdź tam kod, a plugin sam się zaloguje —— nic do wpisywania, nic do kopiowania i nic do uzupełniania w ustawieniach.',
      panelFigure: {
        caption: 'RuneLite → przycisk Anvil',
        alt: 'Pasek ikon RuneLite z zaznaczonym przyciskiem Anvil na samym dole',
        legend: [
          {
            label: 'Przycisk Anvil',
            body: 'przy krawędzi okna RuneLite, na samym dole paska ikon. Kliknij go, aby otworzyć panel. Pojawia się, gdy tylko wtyczka jest zainstalowana i włączona — a jeśli wolisz mieć go wyżej, możesz przeciągnąć go w górę paska.',
          },
        ],
      },
      signInFigure: {
        caption: 'Panel Anvil',
        alt: 'Panel Anvil z zaznaczonym przyciskiem Sign in with Discord i adresem strony, z którą się łączy',
        legend: [
          {
            label: 'Sign in with Discord',
            body: 'pokazuje się tylko dopóki ten komputer jest wylogowany. Kliknij, a reszta dzieje się w przeglądarce.',
          },
          {
            label: 'Connects to',
            body: 'zawsze `anvilosrs.com` —— jedyna strona, z którą plugin rozmawia, i ta, do której należy twój token.',
          },
          {
            label: 'Paste a token instead',
            body: 'rozwiązanie awaryjne, jeśli krok w przeglądarce u ciebie nie działa —— zobacz koniec tego kroku.',
          },
        ],
      },
      easySteps: [
        'Kliknij **Sign in with Discord**. Panel pokaże krótki kod i otworzy przeglądarkę na `anvilosrs.com`.',
        'Zaloguj się tam Discordem, jeśli jeszcze nie jesteś, sprawdź, czy kod na stronie zgadza się z tym w RuneLite, i kliknij **Approve**.',
        'Po powrocie do RuneLite u góry panelu pojawi się _Signed in_ —— a po zalogowaniu do gry także to, którą postać śledzi. To wszystko.',
      ],
      linkFigure: {
        caption: 'anvilosrs.com → /link-device',
        alt: 'Strona „Link your RuneLite client” z zaznaczonym polem kodu i przyciskiem Approve',
        legend: [
          { label: 'Kod', body: 'musi zgadzać się z tym, który plugin pokazuje ci w tej chwili.' },
          {
            label: 'Approve',
            body: 'zatwierdzaj wyłącznie kod, który wyświetla _twój własny_ klient. Jeśli ktoś przysłał ci link albo kod, odrzuć —— zatwierdzenie oddałoby mu twoje konto.',
          },
        ],
      },
      directNote: {
        tag: 'Gdzie to wszystko się dzieje',
        body: [
          'Cały ten przepływ zostaje na `anvilosrs.com` —— kod jest tam wydawany, zatwierdzasz go tam własnym logowaniem Discordem, a token wraca prosto do pluginu. Plugin otwiera strony logowania wyłącznie na `anvilosrs.com`, więc link do logowania prowadzący gdziekolwiek indziej nie pochodzi od niego.',
        ],
      },
      federationAside:
        'Nie mylić z **Connect clans** w panelu bocznym —— to osobny, opcjonalny przycisk, który łączy cię z innymi klanami Anvil, i pojawia się dopiero, gdy jesteś już tutaj zalogowany.',
      manualFallback:
        'Jeśli przeglądarka nie otworzy się sama, panel wypisze adres i kod, żebyś mógł otworzyć go ręcznie. Kody wygasają po dziesięciu minutach —— po prostu naciśnij przycisk jeszcze raz.',
      manualHeading: 'Awaryjnie: wklej token ręcznie',
      manualIntro:
        'Jeśli logowanie z pluginu u ciebie nie działa, skopiuj swój token poniżej (albo z [Profile → plugin token](/profile#plugin-token), gdzie możesz go też wymienić), a potem kliknij **Paste a token instead** pod przyciskiem logowania w panelu Anvil i wklej go tam.',
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
            body: 'skopiuj go, a potem użyj **Paste a token instead** w panelu Anvil. Rotate wydaje nowy i unieważnia stary —— użyj go, jeśli podejrzewasz, że token wyciekł.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Na co dzień używaj panelu bocznego',
        body: ['**Panel boczny Anvil jest Twoim głównym miejscem pracy**: loguj się i wylogowuj w nim, przeglądaj klany i aktywne wydarzenia, przeglądaj i zajmuj pola, śledź postępy, rób zdjęcia startowe, uruchamiaj synchronizację i otwieraj narzędzia pomocy. **Configuration → Anvil**, pokazane poniżej, służy wyłącznie do ustawień —— nie ma tam żadnego tokenu. Aby wylogować ten komputer, otwórz menu **⋯** obok swojej nazwy u góry panelu. Jedno logowanie obejmuje wszystkie wydarzenia, na które jesteś zapisany — nie musisz go powtarzać dla każdego bingo.'],
      },
    },

    accounts: {
      title: 'Podłącz swoje konta',
      body: [
        'Po ustawieniu tokenu konta, na których grasz, pojawiają się automatycznie w twoim profilu. Zupełnie nowe konto można połączyć od razu; konto już obecne na liście klanu wymaga najpierw jednego potwierdzenia własności, bo publiczna nazwa RuneScape nie dowodzi, kto jest właścicielem.',
        'Przy pierwszym połączeniu użyj [szybkiej weryfikacji XP](/profile#link-account) albo poproś moderatora klanu o zatwierdzenie konta w [wykrytych kontach](/profile#detected-accounts). Po weryfikacji stabilny odcisk śledzi zmiany nazwy i automatycznie rozpoznaje konto.',
      ],
      figure: {
        caption: 'Profil → RuneScape Accounts',
        alt: 'Karta RuneScape Accounts na stronie profilu z listą kont zweryfikowanych przez plugin',
        legend: [
          {
            label: 'Twoje podłączone konta',
            body: 'wszystko oznaczone „Verified via plugin” jest połączone i będzie automatycznie rozpoznawane. Istniejące konta z listy klanu mogą najpierw wymagać jednorazowej weryfikacji XP lub moderatora.',
          },
        ],
      },
      noPluginHeading: 'Nie możesz używać pluginu?',
      noPluginIntro:
        'Na telefonie albo w oficjalnym kliencie użyj [Profile → account linking](/profile#link-account):',
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
      panelHeading: 'Panel boczny',
      panelBody: [
        'Cztery zakładki i zębatka. **Clan** to twoje wydarzenia i twój klan: każde trwające i nadchodzące bingo oraz cotygodniowa rywalizacja z twoją pozycją. **Feed** to wielkie chwile twojego klanu i twoich plansz na bieżąco, z czatem wydarzenia. **You** to twój własny profil, a **Lookup** znajdzie każdego innego, gracza albo klan. Pod zębatką jest synchronizacja i dźwięki twojego banera.',
        'Każdą zakładkę, czat wydarzenia, reakcje i ustawienia, które przenoszą feed i kolory Supporterów do twojej gry, opisuje [Panel boczny, zakładka po zakładce]({panelGuide}).',
      ],
      panelFigure: {
        caption: 'Clan · You · Lookup',
        alt: 'Trzy zakładki panelu bocznego Anvil obok siebie: zakładka Clan z wydarzeniami i tygodniem klanu, zakładka You z twoim collection logiem i zakładka Lookup z kartą innego gracza',
      },
      lookupHeading: 'Sprawdź każdego',
      lookupBody:
        'Kliknij prawym przyciskiem gracza —— obok siebie albo jego nick na czacie, liście znajomych lub w panelu klanu —— i wybierz **Anvil**, aby otworzyć jego kartę w zakładce **Lookup** panelu bocznego. Twoja własna to zakładka **You**.',
      lookupFigure: {
        caption: 'Prawy klik na nicku → Anvil',
        alt: 'Menu prawego przycisku gracza w grze z pozycją Anvil pod Lookup i RuneProfile',
      },
      lookupSettingNote:
        'W sekcji **Player lookup** ustawień pluginu wybierz, gdzie ma się pojawiać pozycja **Anvil**. Na nicku na czacie nigdy nie jest to opcja lewego kliknięcia, więc kliknięcie w nick nadal robi to, co zwykle robi gra.',
      lookupSettingFigure: {
        caption: 'Configuration → Anvil → Player lookup',
        alt: 'Sekcja Player lookup ustawień Anvil z każdym ustawieniem zaznaczonym i ponumerowanym',
        legend: [
          {
            label: 'Anvil lookup on players',
            body: 'główny przełącznik. Wyłączony ukrywa pozycję wszędzie.',
          },
          {
            label: 'Players in the world',
            body: 'prawe kliknięcie gracza stojącego obok ciebie.',
          },
          {
            label: 'Chatbox and private messages',
            body: 'nicki w oknie czatu i w prywatnych wiadomościach.',
          },
          {
            label: 'Clan panels / Friends chat / Friends, ignore and party lists',
            body: 'listy nicków: członkowie twojego klanu i klanu gościnnego, kanał friends chat, twoje listy znajomych i ignorowanych oraz panel drużyny rajdowej.',
          },
        ],
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
            label: 'Show Overlay',
            body: 'rysuje mały panel _Anvil / drużyna / data UTC_ w lewym górnym rogu. Staje się częścią obrazu na twoich zrzutach dowodowych i to właśnie sprawia, że dowód trudno podrobić albo antydatować. Na tym zrzucie jest wyłączony —— włącz go, jeśli twój klan chce widzieć drużynę i czas na każdym dowodzie.',
          },
          {
            label: 'Team completion popups',
            body: 'baner, gdy ktokolwiek z twojej drużyny kończy pole. Kilka naraz: najtrudniejsze dostaje baner, reszta idzie na czat.',
          },
          {
            label: 'My tile popups',
            body: 'wyskakujące okienko, gdy twój własny drop posuwa pole do przodu albo je kończy. Wyłączone dalej śledzi —— tylko po cichu.',
          },
          {
            label: 'Banner sound + volume',
            body: 'odtwarza dźwięk razem z banerem. Nic nie zabrzmi, dopóki sam nie dodasz przynajmniej jednego pliku .wav przez **Add clip** pod „Banner sounds” w panelu bocznym Anvil. Misje mają własny folder — dodaj klip w **Mission sounds**, a zagra on zamiast wbudowanego dźwięku, który odróżnia je od ukończonego pola.',
          },
          {
            label: 'Auto starting shot',
            body: 'robi za ciebie zdjęcie startowe wydarzenia w chwili, gdy staniesz w przypiętym miejscu. Wyłączone: sam naciskasz **Take starting shot** w panelu bocznym.',
          },
        ],
      },
      teamsHeading: 'Drużyny',
      teamsBody:
        'Przycisk **Teams** przy wydarzeniu pokazuje jego drużyny w rankingu, z twoją na górze. Otwórz którąś, żeby zobaczyć skład z kapitanem na początku, albo wyszukaj gracza we wszystkich drużynach naraz —— kliknij nick, żeby go sprawdzić.',
      teamsFigure: {
        caption: 'Wydarzenie → Teams',
        alt: 'Strona Teams z drużynami wydarzenia, punktami i liczbą członków, obok składu jednej drużyny z kapitanem na początku',
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
        'Działają niezależnie od tego, czy trwa bingo, i trafiają na kanały klanu. Który kanał, ustawiają adminowie —— ty wybierasz tylko _co_ publikujesz. W następnej aktualizacji wtyczki te ustawienia przenoszą się na stronę, do **Settings → Announcements**, i działają na każdym komputerze. We wtyczce zostają dwa przełączniki w **Notifications**: **Share clan posts** wstrzymuje naraz wszystkie posty z głównej gry, a **Share seasonal activity** robi to samo na Leagues, Deadman i innych światach sezonowych.',
      examplesFigure: {
        caption: 'Jak wygląda post',
        alt: 'Dwa posty Anvil na Discordzie: zadanie Grandmaster z combat achievements z punktami i postępem do następnego odblokowania oraz śmierć z wiadomością, każdy ze zrzutem ekranu z tej chwili',
      },
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
          {
            label: 'Loot key value',
            body: 'loot key publikuje się raz, jako jedno powiadomienie, gdy cała jego zawartość przekroczy tę liczbę.',
          },
          { label: 'Notify on pets', body: 'pety trafiają na kanał rzadkich dropów.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · collection log · poziomy · dzienniki · questy',
        alt: 'Sekcja powiadomień Combat achievements z każdym ustawieniem zaznaczonym i ponumerowanym',
        legend: [
          {
            label: 'CA post tier',
            body: 'najniższy tier zadań, który się publikuje; ukończenia całych tierów też się publikują. Domyślnie Master; Grandmaster publikuje tylko najrzadsze, **Off** nic. Pola CA w bingo liczą się tak czy inaczej.',
          },
          {
            label: 'Notify on collection log slots',
            body: 'każde nowe miejsce w collection logu.',
          },
          {
            label: 'Notify on level milestones',
            body: 'awanse poziomów, które twój klan postanowił ogłaszać —— domyślnie 99-tki, każde 100 poziomów total od 1800, i max. Zasady ustalają admini klanu; możesz publikować mniej (albo ustawić własne zasady dla swoich osobistych webhooków) w sekcji Announcements na swoim profilu.',
          },
          {
            label: 'Notify on diary completions',
            body: 'tiery achievement diary, ze zrzutem ekranu.',
          },
          {
            label: 'Quest post tier',
            body: 'questy od wybranej trudności wzwyż, od All (każdy quest) aż po Grandmaster; **Off** nic nie publikuje. Domyślnie Master. Pola z questami w bingo liczą się tak czy inaczej.',
          },
        ],
      },
    },

    trouble: {
      title: 'Gdy coś się psuje',
      intro:
        'Plugin mówi ci na czacie, gdy śledzenie się zatrzymało —— czeka około 90 sekund, zanim zacznie narzekać, i powtarza najwyżej co 5 minut.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Token jest błędny albo został zrotowany. Otwórz menu **⋯** u góry panelu Anvil, naciśnij **Sign out**, a potem ponownie **Sign in with Discord** —— albo użyj **Paste a token instead** ze świeżym tokenem z [Profil → RuneLite plugin](/profile#plugin-token).',
        },
        {
          term: '`Anvil: can’t reach the site (anvilosrs.com) — tracking is OFF.`',
          body: 'Plugin nie może połączyć się z `anvilosrs.com`. Sprawdź połączenie z internetem oraz ewentualny firewall lub VPN, który może blokować RuneLite. Jeśli wszystko jest w porządku, strona prawdopodobnie na chwilę nie działa —— plugin połączy się ponownie sam.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'To konto nie jest jeszcze podłączone. Otwórz [Profil → wykryte konta](/profile#detected-accounts), aby je dodać lub rozpocząć potwierdzenie własności.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Nic. Naprawiło się samo.',
        },
        {
          term: '„<RSN> belongs to another Anvil player”',
          body: 'Ktoś inny pierwszy połączył tę postać w Anvil, więc nic z twojego logowania się dla niej nie liczy. Jeśli naprawdę jest twoja, kliknij **This is my account** w zakładce **You** panelu i przejdź szybką weryfikację XP. Wtedy pytany jest obecny właściciel albo decyduje staff Anvil. Nigdy nie dowiesz się, kto to jest. Śledź sprawę w [Settings → Ownership claims](/settings/claims).',
        },
      ],
      logHeading: 'Dalej nie działa? Wyślij adminowi log',
      logBody:
        'Wyślij adminowi swój log RuneLite: `client.log` w folderze `.runelite/logs` w twoim folderze użytkownika (na Windowsie wklej `%USERPROFILE%\\.runelite\\logs` w pasek adresu Eksploratora plików). Plugin zapisuje w nim, co zobaczył i dlaczego, więc admin zobaczy dokładnie, co poszło nie tak.',
      missingNote: {
        tag: 'Brakuje dowodów?',
        body: 'Pety i powtórzone Champion’s scrolle wymagają ręcznego zrzutu ekranu. Plugin robi go za ciebie i zapisuje w `.runelite/osrs-bingo-pending/` — **Copy folder path** w panelu bocznym Anvil otwiera ten folder — więc załączasz go na stronie, zamiast szukać obrazka po fakcie.',
      },
    },
    limits: {
      title: 'Znane ograniczenia',
      intro:
        'Kilku rzeczy nie da się śledzić idealnie — prawie zawsze przez to, co raportuje sama gra, a nie Anvil. Rozwiązanie jest za każdym razem takie samo: zrób zrzut ekranu i prześlij go ręcznie.',
      rows: [
        {
          term: 'Barraging i inne zabójstwa wielu celów',
          body: 'Liczba zabójstw (KC) pochodzi z tego, co gra raportuje przy każdym zabójstwie, a czary wielocelowe jak Ice Barrage sprawiają, że część umyka, więc **KC może wyjść niższe** niż to, co zabiłeś. Własny Loot Tracker RuneLite zaniża w ten sam sposób — to ograniczenie silnika gry, a nie błąd Anvil.',
        },
        {
          term: 'Combat Achievement, które wykonałeś wcześniej',
          body: 'Włącz **repeat completion** w ustawieniach Combat Achievements w grze. Bez tego gra nie ogłasza zadania, które już ukończyłeś, a plugin może zaliczyć tylko to, co gra ogłosi.',
        },
        {
          term: 'Combat Achievement za kontrakt Yama',
          body: 'Gra nie ogłasza go ponownie nawet z włączonym repeat completion, więc plugin nigdy go nie widzi. Zrób zrzut ekranu i prześlij go ręcznie.',
        },
        {
          term: 'Pola zbierania bez pluginu',
          body: 'Liczby przedmiotów — pewna liczba ryb, rud, kłód — nie ma w hiscores, więc śledzi je tylko plugin. Bez niego zrób zrzut każdego ekwipunku; albo, jeśli przedmiot widać w Loot Trackerze, zrzut po wyzerowaniu do 0 na początku i kolejny na końcu.',
        },
        {
          term: 'Implingi, ryby, rudy i inne zdobycze przedmiotów',
          body: 'Łapanie implingów i zbieranie przedmiotów (ryb, rud i wszystkiego, co liczy się na podstawie tego, co ląduje w ekwipunku) **czasem nie jest śledzone poprawnie, nawet z pluginem**. Zachowuj zrzuty ekranu na bieżąco, a jeśli liczba wygląda na zaniżoną, zgłoś to i prześlij różnicę ręcznie.',
        },
        {
          term: 'Beczki na ryby, kosze na drewno i inne pojemniki',
          body: 'Pola zdobywania przedmiotów liczą tylko to, co trafia do ekwipunku **prosto ze źródła** — z łowiska, skały, drzewa. Wszystko, co wyjmiesz z pojemnika (opróżnienie beczki na ryby, kosza na drewno, worka na węgiel lub klejnoty, worka na zioła), kupisz w sklepie, wypłacisz z banku lub podniesiesz z ziemi, **się nie liczy**. Dzięki temu pole jest uczciwe: inaczej tę samą rybę można by w nieskończoność wkładać do beczki i wyjmować. To, co zbierasz prosto do beczki lub kosza, nie jest liczone.',
        },
        {
          term: "Zduplikowane pety i champion's scrolle",
          body: 'Gdy masz już peta lub scroll, gra mówi tylko, że masz **„funny feeling”** — nigdy nie mówi, który. Plugin wnioskuje to z tego, co właśnie zabiłeś lub trenowałeś, zalicza pole i **oznacza je do sprawdzenia przez staff**. Gdy nie da się tego ustalić — dwa pety z tego samego źródła albo pet bez zabójstwa czy umiejętności (Bloodhound z master clue, pet Jada lub Zuka z hazardu, Chompy chick) — zrzut ekranu trafia do **Saved proofs**, żebyś zgłosił go ręcznie.',
        },
      ],
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
      { strong: '5 kroków', rest: 'na liście kontrolnej konfiguracji' },
      { strong: '7 formatów', rest: 'z których zbudujesz planszę' },
      { strong: '1 przycisk', rest: 'do synchronizacji składu klanu' },
    ],
    footnote:
      'Ten przewodnik opisuje aplikację taką, jaka jest dziś. Jeśli któryś ekran tutaj nie zgadza się z tym, na co patrzysz, rację ma aplikacja, a przewodnik jest nieaktualny —— [napisz nam](/feedback), a poprawimy.',

    access: {
      title: 'Kto co może',
      intro:
        'Wszyscy logują się Discordem —— nie ma haseł. Pierwszym adminem jest właściciel, czyli ten, kto założył klan; potem to admin awansuje ludzi w **People → Staff & roles**. Role kumulują się w dół: wszystko, co może moderator, może też skarbnik i admin.',
      rows: [
        {
          term: 'Admin',
          body: 'pełny dostęp —— wydarzenia, pola, drużyny, ustawienia, sztab, wypłaty. Daj to tak niewielu ludziom, jak klan zniesie.',
        },
        { term: 'Skarbnik', body: 'wszystko, co może moderator, plus wpisowe i wypłaty.' },
        {
          term: 'Moderator',
          body: 'codzienność: skład, weryfikacje, dowody do sprawdzenia, tygodniowe konkursy, kalendarz i wydarzenia klanowe. Nie może tworzyć ani edytować wydarzeń.',
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
        '**Settings → Finish setup** to krótki kreator (zostaje w menu, dopóki nie skończysz), a pulpit trzyma listę kontrolną z pięciu kroków, dopóki nie zostaną wykonane: nazwij klan, podłącz Discorda, wczytaj członków, utwórz wydarzenie, dodaj pola. Status liczony jest z prawdziwych danych, więc krok odhacza się dopiero, gdy jest naprawdę skończony.',
      discord:
        'Do Discorda masz dwie drogi i one się uzupełniają: daj Anvil **bota**, a będzie mógł tworzyć webhooki, synchronizować role i pseudonimy oraz budować prywatne kanały drużyn; daj mu jeden **URL webhooka**, a będzie mógł publikować ogłoszenia i nic więcej. Zacznij od webhooka, jeśli chcesz działać w dwie minuty, a bota dodaj, gdy zechcesz automatyzacji.',
      permsNote: {
        tag: 'Uprawnienia bota',
        body: 'Bot potrzebuje uprawnień _Zarządzanie webhookami_, _Zarządzanie rolami_, _Zarządzanie kanałami_ i _Zarządzanie pseudonimami_, a jego rola musi stać _powyżej_ ról, którymi zarządza, na liście ról twojego serwera. Inaczej Discord po cichu odmawia.',
      },
      hosted:
        'W planie hostowanym ten ekran już raz spotkałeś: dodanie bota podczas konfiguracji to sposób, w jaki Anvil dowiedział się, który serwer jest twój, więc nigdy nie było ID do przepisywania. Ten sam link jest tutaj, gdy zechcesz przenieść bota na inny serwer.',
    },

    channels: {
      title: 'Rozdziel wpisy na kanały',
      body: [
        'Domyślnie wszystko trafia na jeden kanał zbiorczy. Gdy zrobi się na nim głośno, otwórz **Discord → What goes where** i daj hałaśliwym kategoriom własne domy —— posty o wydarzeniach, tygodniowe konkursy, rzadkie dropy, śmierci, kille PvP, combat achievements. Wszystko, co zostawisz puste, spada z powrotem na swój kanał zbiorczy, więc możesz rozdzielać po jednej kategorii.',
        'Z podłączonym botem nigdy nie dotykasz URL-a webhooka: wybierasz kanał z listy rozwijanej w wierszu i to się zapisuje. Przy ruchliwym wydarzeniu możesz dodać drugi webhook przyciskiem **Add another** w **Post without a bot** —— Anvil przełącza się między nimi, żeby limit Discorda nie połknął wpisów.',
      ],
      clipsNote: {
        tag: 'Kanał klipów jest inny',
        body: 'Klipy wideo wysyłane są prosto z komputera każdego gracza na Discorda —— nigdy nie przechodzą przez tę stronę. Więc webhook klipów, który tu ustawiasz, to ten, który _rozdajesz_: członkowie sami wklejają go do swojego pluginu. Wszystko inne na tej stronie dzieje się po stronie serwera i członkowie tego nigdy nie widzą.',
      },
    },

    roster: {
      title: 'Wciągnij swój skład',
      body: [
        'Członkostwo w klanie bierze się z jednego miejsca: z synchronizacji składu z gry. Zainstaluj [plugin Anvil do RuneLite]({pluginGuide}) na koncie _admina_, otwórz w grze okno klanu i naciśnij przycisk **Anvil** na jego pasku tytułu. To wysyła na stronę twoją prawdziwą listę klanu jednym kliknięciem.',
        'Logowanie, podłączenie postaci ani granie z pluginem nigdy nikogo nie dopisuje do składu. Jeśli plugin widzi, że ktoś gra w twoim klanie w grze, zanim skład go ma, składa prośbę o dołączenie; każdy inny może poprosić przyciskiem **Apply** na stronie twojego klanu. Sztab odpowiada na prośby na górze **People → Roster**, a **People → Who can join** decyduje, czy ludzie czekają na zgodę, od razu dostają miejsce gościa, czy w ogóle nie mogą prosić. To celowe: nikt nie dołącza do twojego klanu przez wpisanie jego nazwy. Pełny obraz znajdziesz w [Twoi ludzie]({peopleGuide}).',
        'Możesz też dodać kogoś ręcznie w **People → + Add Manually**, a zapisać go na wydarzenie w jego imieniu przyciskiem **Add member** na stronie **Sign-ups** wydarzenia, gdy nie może dotrzeć do strony.',
      ],
    },

    board: {
      title: 'Utwórz pierwszą planszę',
      intro:
        '**Events → All events → + New event**. Najpierw wybierz format —— to on decyduje, jak plansza jest punktowana i o co zapyta cię reszta formularza.',
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
        'Strona **Board & tiles** wydarzenia to miejsce, gdzie plansza staje się bingiem. Każde pole to jeden _rodzaj_ zadania, a rodzaj decyduje, czego szuka plugin: dropu, killcountu bossa, XP w umiejętności, zabicia NPC, przejścia na czas, achievement diary, Combat Achievement, odblokowania w Collection Logu, killa PvP, przyrostu w ekwipunku albo przejścia bez śmierci. Pola ręczne —— te, które człowiek weryfikuje ze zrzutu —— zawsze też są opcją.',
        'Przy pełnej planszy pisz hurtem: wyeksportuj arkusz, wypełnij go w arkuszu kalkulacyjnym i zaimportuj z powrotem. CSV i .xlsx robią pełne kółko, a wiersze odpowiadają pozycjom, więc całą 25-polową siatkę przepiszesz jednym wklejeniem.',
      ],
      rows: [
        {
          term: 'Progi trudności',
          body: 'wartości punktowe mapują się na nazwane progi (easy → elite). Zmień progi w **Clan settings → Rules & scoring → Difficulty & balance**, jeśli twój klan ocenia inaczej.',
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
        'Strona **Teams & draft** dopasowuje się do wybranego formatu: format, który nie używa drużyn, po prostu ją pomija. Przy zwykłym drużynowym bingo tworzysz drużyny, decydujesz, kto nimi kapitanuje, i albo sam przydzielasz graczy, albo prowadzisz draft na żywo.',
        'Kapitanowie draftują z puli zapisanych w ustalonej przez ciebie kolejności, a każdy widzi odpowiedzi z formularza zapisu —— zamrożone w postaci, w jakiej zostały wysłane, żeby nikt nie poprawiał swoich „godzin tygodniowo” po tym, jak został wybrany.',
      ],
      placementIntro:
        'Nie musisz robić draftu. **Team placement**, w formularzu tworzenia i w zakładce **Sign-ups**, decyduje, gdzie trafia każda nowa zapisana osoba:',
      placementRows: [
        {
          term: 'Auto-balance',
          body: 'każda zapisana osoba trafia do drużyny z najmniejszą liczbą graczy. Wybierasz tylko, ile ma być drużyn. Dobre na duże publiczne wydarzenia.',
        },
        {
          term: 'Players pick',
          body: 'najpierw tworzysz drużyny, a każdy gracz wybiera jedną w formularzu zapisu. Ustaw limit na drużynę, żeby były równe.',
        },
        {
          term: 'Host drafts',
          body: 'wszyscy czekają w puli, aż ty lub twoi kapitanowie wybierzecie ich w drafcie albo przydzielicie ręcznie. Najlepsze, gdy znasz graczy.',
        },
        {
          term: 'Solo',
          body: 'żadnych drużyn. Każdy gracz gra sam, pod nazwą swojej postaci, a ranking pokazuje graczy.',
        },
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
          body: '**Post to Discord** (w sekcji **Clan** w menu) publikuje jako bot wiadomość na dowolnym kanale w trakcie wydarzenia, bez ręcznego pisania webhooka.',
        },
      ],
      missionNote: {
        tag: 'Niespodzianki w trakcie',
        body: 'Możesz zrzucić **misję** na trwające bingo —— ukryte pole bonusowe, które zostaje ogłoszone, gdy je odpalisz, opcjonalnie tracące na wartości albo wygasające. To najtańszy sposób obudzenia planszy piątego dnia.',
      },
      startProofNote: {
        tag: 'Zatrzymywanie gromadzenia przed startem',
        body: [
          'Włącz **Starting shot** (wydarzenie → Home → **Extras**), a każdy gracz musi złożyć jeden zrzut zrobiony po starcie wydarzenia, w miejscu, które Anvil losuje w chwili startu —— więc nikt nie siedzi w T0 na tygodniu odłożonych clue i skrzynek. Miejsce ogłaszane jest razem ze startem; słowo kluczowe każdego gracza jest osobiste, wywodzi się z losowania i nie istnieje, zanim wydarzenie nie ruszy, więc nikt nie przygotuje go z góry.',
          'Przypnij miejsca na mapie świata (edytor puli ma jedną) a plugin sprawdzi, czy gracze faktycznie tam stoją, zamiast tylko im o tym powiedzieć. Możesz też wymagać **świeżej sesji** —— domyślnie 15 minut: hiscores zapisują się dopiero przy wylogowaniu, więc zmuszenie wszystkich do relogu tuż przed zdjęciem jest tym, co czyni uczciwymi startowe sumy stojące za każdym polem XP i KC.',
          'Użytkownicy pluginu naciskają jeden przycisk. Wszyscy inni wpisują słowo kluczowe w grze i wgrywają zrzut w My Team. To ty wybierasz, co dzieje się z zaliczeniem od kogoś, kto nie złożył zdjęcia: oznaczyć do przeglądu (domyślnie) albo odrzucić, dopóki nie złoży. Ten sam panel na stronie Home wydarzenia jest listą do przeglądu —— przechwycenia z pluginu ze zweryfikowanym słowem kluczowym przychodzą już przyjęte, więc w praktyce oglądasz tylko graczy z telefonu.',
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
          body: 'strona **Prizes** wydarzenia zamienia pulę nagród w listę, kto co dostaje, odhaczaną w miarę wypłacania.',
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
          body: 'zachowaj planszę, którą właśnie zbudowałeś, przez **Settings → More** wydarzenia. Następne bingo zacznie się od niej, a nie od pustej siatki.',
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
        'Otwórz swoje wydarzenie i przejdź na stronę **Teams & draft**. Utwórz po jednej drużynie na każdy zaproszony klan i nazwij ją jego nazwą —— to ta nazwa pojawia się ich graczom w formularzu zapisu, więc „Ironforge” bije „Team 2”.',
        '_Nie_ musisz prowadzić draftu. Linki z zaproszeniem i draft to alternatywy: draft rozdziela wspólną pulę zapisanych, link sadza ludzi bezpośrednio. Przy czystym klan kontra klan większość gospodarzy tworzy drużyny, rozdaje po jednym linku i w ogóle nie otwiera draftu.',
        'Potem otwórz samą drużynę —— **Teams & draft → drużyna** —— bo tam mieszkają oba kolejne kroki.',
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
        caption: 'Wydarzenie → Teams & draft → drużyna → Team staff',
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
        caption: 'Wydarzenie → Teams & draft → drużyna → Invite links',
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
        kill: { label: 'Kills', blurb: 'N zabójstw dowolnego bossa lub potwora. Liczone z hiscores, gdy każdy potwór na polu tam jest, w przeciwnym razie przez plugin podczas gry (kury, krowy, potwory Slayera).' },
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
          term: 'Lista bossów plus jeden potwór spoza hiscores',
          body: 'to w **całości** pole pluginu. Pole Kills liczy się z hiscores tylko wtedy, gdy każdy potwór na nim tam jest; dodaj kurę do czterech bossów GWD, a całe pole wymaga pluginu. Jeśli część klanu gra bez niego, daj bossom z hiscores osobne pole.',
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
        '**Download spreadsheet** na stronie **Board & tiles** wydarzenia. Dostajesz .xlsx z planszą w obecnym stanie, z listami rozwijanymi, listą przedmiotów i instrukcjami kolumn na osobnych arkuszach.',
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
        'Na planszy punktowanej każde pole niesie własną wartość, a te wartości mapują się na nazwane progi trudności —— od easy do elite —— które możesz zmienić w **Rules & scoring**, jeśli twój klan ocenia inaczej. Próg jest tym, co czytają gracze; liczba jest tym, co punktuje.',
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
      'Format ustala się przy tworzeniu, ale można go potem zmienić w zakładce Settings → Event wydarzenia; politykę odsłaniania i modyfikatory punktacji można zmieniać w każdej chwili, zanim odsłonięte zostaną pola, których dotyczą.',

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
      'Wpisowe i wypłaty to obszar skarbnika. Skarbnik może wszystko, co moderator, plus to; zwykły moderator w ogóle nie widzi stron wpisowego.',

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
        {
          term: 'Guest fee',
          body: 'ile płacą gracze, którzy nie są członkami klanu prowadzącego planszę. Zostaw puste, a goście zapłacą tyle co członkowie. Żeby naliczyć jednemu graczowi inną kwotę, kliknij **Change this player’s fee** w jego wierszu w **Sign-ups**.',
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
        'Przypominanie to jeden przycisk: **Remind unpaid** w Admin → **Fees** wysyła prywatną wiadomość na Discordzie do każdego, kto wciąż nie zapłacił za to wydarzenie.',
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
        'Ile podpisów wymaga wpisowe, jest ustawieniem klanu (**Clan settings → Rules & scoring → Fee sign-off**), od zera do pięciu. Zero istnieje z prawdziwego powodu: w klanie, w którym skarbnik _jest_ właścicielem, nie ma nikogo innego do podpisu, a „34 wpisowe czekają na drugi podpis” staje się kolejką, której nigdy nie da się wyczyścić, i trwale najgłośniejszą rzeczą na pulpicie. Przy zerze oznaczenie wpisowego jako opłacone **jest** podpisem.',
        'Ustaw na jeden —— domyślnie —— jeśli macie dwie osoby. Ustaw na zero, jeśli szczerze nie macie, a wyżej tylko wtedy, gdy twój klan ma i ludzi, i powód.',
      ],
    },

    pay: {
      title: 'Wypłacanie',
      body: [
        'Gdy wydarzenie się kończy, strona **Prizes** wydarzenia zamienia pulę w listę ludzi. Wygeneruj ją, a dostaniesz jeden wiersz na odbiorcę, nie na drużynę: nagroda zwycięskiej drużyny dzieli się po równo między jej członków, żeby wypłacanie było listą nazwisk i liczb, a nie zadaniem z arytmetyki o północy.',
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

  coffer: {
    metaTitle: 'Skarbiec klanu — poradnik Anvil dla skarbników',
    metaDescription:
      'Klanowy skarbiec gp w Anvilu: zapisywanie darowizn i przypisywanie ich tym, którzy je wpłacili, trzy sposoby wypłaty nagrody, kto może ruszać pieniądze i co się dzieje, gdy w skarbcu brakuje.',
    eyebrow: 'Anvil · dla skarbników',
    title: 'Skarbiec klanu',
    dek: 'Większość klanów trzyma gp na czyimś banku, a księgowość w czyjejś pamięci. Skarbiec to jedna pula z osobną linią dla każdego ruchu — kto to dał, na co jest obiecane i kto to naprawdę wysłał.',
    facts: [
      { strong: '3 liczby', rest: 'w skarbcu, zajęte, wolne do obiecania' },
      { strong: '3 wyjścia', rest: 'tygodniówki, pola misji, pula planszy' },
      { strong: 'Skarbnik', rest: 'albo admin — nigdy sama ranga' },
    ],
    footnote:
      'Wszystko to znajdziesz w Admin → **Coffer**, poza drabinkami nagród, które żyją przy tym, za co się płaci. Publiczna połowa to `/coffer`: saldo, najwięksi darczyńcy i ostatnie ruchy — dla członków.',

    what: {
      title: 'Czym jest',
      body: [
        'To księga, nie portfel. Anvil nigdy nie trzyma waszego gp — zostaje tam, gdzie klan już je przechowuje — więc skarbiec jest zapisem tego, co wpłynęło, co zostało obiecane i co faktycznie przekazano. Jego wartość polega na tym, że obietnica i wypłata to dwie różne linie.',
        'Strona zaczyna się od trzech liczb, a są trzy, bo odpowiadają na trzy różne pytania:',
      ],
      rows: [
        {
          term: 'W skarbcu',
          body: 'zatwierdzone darowizny i korekty. To, co klan dostał, minus to, co spisał na straty.',
        },
        {
          term: 'Zajęte',
          body: 'gp, do którego zgłosiła się nagroda — wygrane, ale jeszcze niewysłane, plus pula odłożona na planszę. Zarezerwowane, nawet jeśli wciąż leży na czyimś banku.',
        },
        {
          term: 'Wolne do obiecania',
          body: 'w skarbcu minus zajęte. Jedyna liczba, z którą porównuje się nową nagrodę, bo alternatywą jest obiecanie tych samych 50M dwóm zwycięzcom, gdy skarbnik śpi.',
        },
      ],
      note: {
        tag: 'Oczekująca darowizna nie liczy się nigdzie',
        body: 'To, że ktoś wpisze „dałem 100M", jest twierdzeniem o przeszłości, a nie gp na banku. Stoi poza wszystkimi trzema liczbami, dopóki obsługa jej nie uzna — dzięki temu nigdy nie sfinansuje nagrody, której potem nie da się wypłacić.',
      },
    },

    inbound: {
      title: 'Jak wpływa gp',
      body: [
        'Zwykłą drogę plugin RuneLite załatwia sam: otwórz w grze Clan Coffer, a Anvil zapisze wpłaty i wypłaty na podstawie prawdziwego stanu monet. Pierwsze spojrzenie to tylko punkt odniesienia — nigdy nie udaje, że osoba, która otworzyła skarbiec, wpłaciła wszystko, co już w nim leżało.',
        'Ręczne wpisy zostają na wszystko, co wydarzyło się, gdy nikt nie miał włączonego pluginu. Członek zgłasza własną darowiznę z `/coffer` i czeka, aż obsługa mu uwierzy; skarbnik zapisuje tę, która już dotarła, a samo jej wpisanie **jest** zatwierdzeniem.',
        'Tak czy inaczej trafia na konto **osoby**. To waży więcej, niż brzmi: lista największych darczyńców na publicznej stronie to jedyne podziękowanie, jakie większość z nich kiedykolwiek dostanie, a gp, które wpływa jako „klan", nie dziękuje nikomu.',
      ],
      rows: [
        {
          term: 'Otwórz skarbiec w grze',
          body: 'z włączonym i zalogowanym Anvilem (Profile sync → **Sync Clan Coffer** jest domyślnie włączone). Pasujący komunikat z gry przypisuje twoją własną wpłatę lub wypłatę tobie; zmiany zauważone po przerwie są uzgadniane bez wskazywania obserwatora. Admin → Coffer pokazuje ostatnią fizyczną kwotę i kiedy ją widziano.',
        },
        {
          term: 'Zgłasza ją członek',
          body: 'z publicznej strony skarbca, ze zrzutem ekranu, jeśli go ma. Trafia jako oczekująca i pojawia się w twojej kolejce. Zatwierdzenie jest tym, co czyni z niej prawdziwe pieniądze.',
        },
        {
          term: 'Zapisujesz ją ty',
          body: 'Admin → Coffer → **Record a donation**. Wyszukaj na liście, kto ją wpłacił, wpisz kwotę obok nazwy, gotowe. Goście też mogą być uznani — ktoś, kto nie jest pełnym członkiem, mógł spokojnie dorzucić się do puli.',
        },
        {
          term: 'Kilka osób razem',
          body: 'wybierz wszystkich, wpisz sumę i naciśnij **Split … ways**, a potem popraw ręcznie pojedynczy udział. Zapisuje po jednej linii na osobę zamiast jednej linii z listą, więc każdy trafia na listę darczyńców pod własną nazwą.',
        },
      ],
      note: {
        tag: 'Korekta to co innego',
        body: '**Correct the pot** służy do gp, które przemieściło się poza tym wszystkim — zasilenie skarbca, wydanie go na coś, czego Anvil nigdy nie widział, poprawienie pomyłki. Celowo nie należy do nikogo i świadomie nie jest sposobem na zapisanie daru.',
      },
    },

    out: {
      title: 'Trzy sposoby wypłaty',
      intro: 'Każda nagroda w Anvilu pochodzi z tej jednej puli, a każda droga wyłania zwycięzców inaczej. Ustaw drabinkę tam, gdzie żyje to, co się wygrywa — skarbiec nigdy nie pyta, kto co wygrał.',
      rows: [
        {
          term: 'Tygodniówka, na własnej stronie',
          body: 'Skill albo Boss of the Week ma drabinkę miejsc: pierwszy dostaje to, drugi tamto. Rozlicza się **raz**, po zakończeniu rywalizacji, na podstawie końcowej tabeli — w trakcie nic nie zmienia właściciela. Ustaw ją przy tworzeniu rywalizacji albo później z jej własnej strony.',
        },
        {
          term: 'Pole misji, na planszy',
          body: 'misje płacą w kolejności ukończenia, więc ich drabinkę się zgłasza, a nie rozlicza: pierwsza drużyna, która ją zaliczy, bierze gp za pierwsze miejsce. Ustawia się w sekcji rewards pola, na każdej planszy dopuszczającej misje.',
        },
        {
          term: 'Pula nagród planszy',
          body: 'bingo samo dzieli swoją pulę na miejsca, więc skarbiec podaje mu tylko jedną liczbę. Event → **Prizes** → *From the clan coffer*. Dolicza się do wpisowego i do tego, co dołożyłeś ręcznie, a podział na miejsca ustawia się na tej samej stronie. Wybierasz też, czy skarbiec od razu **blokuje** to gp, czy tylko zapisuje obietnicę — przecież jeszcze nie wypłynęło, a plansza za sześć tygodni nie potrzebuje połowy puli zamrożonej do tego czasu.',
        },
      ],
      note: {
        tag: 'Gdy jest remis',
        body: 'Drabinka tygodniowa potrafi **dzielić remisy**: wszyscy z równym wynikiem łączą zajmowane miejsca i biorą równą część, więc trzech graczy po 40 kc bierze po jednej trzeciej pierwszego, drugiego i trzeciego zamiast tego, by pierwszy z nich zgarnął całość. Zostaw wyłączone, a rozstrzygnie kolejność tabeli. Obie decyzje da się obronić — decydowanie po ogłoszeniu wyników już nie.',
      },
    },

    who: {
      title: 'Kto może nim ruszać',
      intro: 'Pieniądze to osobne uprawnienie, nie ranga. Moderator może zatwierdzać zgłoszenia i nigdy nie dotknąć skarbca — to zamierzone, nie przeoczenie.',
      rows: [
        {
          term: 'Skarbnik albo admin',
          body: 'cała księga: zapisywanie i zatwierdzanie darowizn, korygowanie skarbca, ustawianie drabinek nagród, oznaczanie nagrody jako wysłanej. Właściciel liczy się tu jako admin.',
        },
        {
          term: 'Moderator',
          body: 'nic z tego. W ogóle nie zobaczy strony skarbca — zbieranie pieniędzy to zadanie skarbnika, a sama ranga nigdy nie dawała do tego prawa.',
        },
        {
          term: 'Skarbnik planszy',
          body: 'pieniądze jednego wydarzenia: jego wpisowe, wypłaty, pula nagród. Nadawane per plansza — właśnie tak klan w gościach prowadzi swoją połowę meczu klan kontra klan, nie dostając do ręki waszej księgi. Do klanowego skarbca nie sięgnie.',
        },
        {
          term: 'Dowolny członek',
          body: 'może zgłosić darowiznę i czytać publiczną stronę. I to wszystko.',
        },
      ],
      note: {
        tag: 'Powiedz o tym klanowi, na kanale',
        body: 'Wskaż **Coffer ledger** na kanał Discorda w Admin → Discord → What goes where → **Staff only**, a każdy ruch zostanie opublikowany razem z saldem, jakie po sobie zostawia. To jedyny kanał bez rozwiązania zastępczego: zostaw pusty, a o pieniądzach nie pojawi się nigdzie ani słowo. Zobacz [Anvil na Discordzie]({discordGuide}).',
      },
    },

    short: {
      title: 'Gdy w skarbcu brakuje',
      body: [
        'Nagroda większa niż skarbiec nie zostaje odrzucona. Zapisuje się ją jako **należną i niepokrytą** — prawdziwa linia z nazwą zwycięzcy — bo alternatywą jest zwycięzca bez niczego i bez śladu, że cokolwiek mu obiecano.',
        'Rozwiązanie jest więc zwyczajne: zdobądź gp, potem wypłać. Czego robić nie należy, to po cichu zmieniać drabinkę po fakcie; księga już mówi, co ogłoszono, a ich wzajemna sprzeczność jest gorsza niż sam brak środków.',
      ],
      note: {
        tag: 'Anvil niczego nie wysyła',
        body: 'Każda nagroda kończy się tym, że człowiek przekazuje gp w grze i odhacza linię. Zadaniem księgi jest dopilnować, by ta linia istniała, by mówiła kto i ile, i by tydzień później nikt nie musiał odtwarzać tego z historii Discorda.',
      },
    },
  },

  commands: {
    metaTitle: 'Komendy ukośnikowe Discorda — Anvil',
    metaDescription:
      'Wszystkie komendy ukośnikowe Anvila — /bingo, /sotw, /botw, /eff, /coffer, /stats i /guide — z objaśnieniem każdej opcji, przykładami, tym, kto czego może używać, i rozwiązaniami, gdy komendy się nie pokazują.',
    eyebrow: 'Anvil · w Discordzie',
    title: 'Komendy ukośnikowe',
    dek: 'Wpisz `/` na Discordzie swojego klanu, a Anvil odpowie prosto ze strony na żywo: plansza, ranking, twoja własna karta, tygodniówki, skarbiec i statystyki kogokolwiek. Ta strona to pełna lista, generowana z komend, które bot faktycznie rejestruje, więc nigdy nie jest nieaktualna.',
    facts: [
      { strong: 'Prywatnie', rest: 'odpowiedzi widzisz tylko ty, z przyciskiem udostępniania' },
      { strong: 'W twoim języku', rest: 'w tym, na który ustawiony jest twój Discord' },
      { strong: 'Tylko odczyt', rest: 'poza /coffer add i remove' },
    ],
    footnote:
      'Samo ustawienie bota opisuje [przewodnik po Discordzie](/guide/discord). Ta strona dotyczy korzystania z niego.',

    using: {
      title: 'Jak działa komenda',
      body: [
        'Wpisz `/` na dowolnym kanale, który bot widzi, i wybierz z listy komendę Anvila. Discord pokaże wtedy jej opcje jako pola do wypełnienia: naciśnij Tab albo kliknij jedno, żeby je dodać. Opcje w `<nawiasach ostrych>` poniżej są wymagane; opcje w `[nawiasach kwadratowych]` są opcjonalne i możesz je pominąć.',
        'Każda odpowiedź jest **prywatna**: widzisz ją tylko ty, więc sprawdzanie planszy dziesięć razy dziennie nikomu nie przeszkadza. Jeśli warto pokazać ją kanałowi, naciśnij **Share to channel** pod odpowiedzią. Udostępniona kopia jest budowana od nowa w tej chwili, więc ranking udostępniony później to ranking z tamtego momentu.',
      ],
      rows: [
        { term: 'Wymagana', body: '`<amount>` — Discord nie wyśle komendy, dopóki jej nie wypełnisz.' },
        { term: 'Opcjonalna', body: '`[member]` — pomiń ją, a komenda odpowie o tobie, twojej drużynie albo całym klanie.' },
        { term: 'Lista', body: 'wybierz jedną z wartości, które proponuje Discord; własnej nie wpiszesz.' },
        { term: 'Wpisz, by wyszukać', body: 'zacznij pisać i wybierz z podpowiedzi, np. nazwy bossów albo twoje własne konta.' },
        { term: 'Członek', body: 'wybierz kogoś z serwera, tak jak przy @wzmiance.' },
      ],
      note: {
        tag: 'Komendy działają tylko na serwerze twojego klanu',
        body: 'Każda odpowiedź dotyczy jednego klanu, a w wiadomości prywatnej nie ma klanu, o którym można by odpowiedzieć. Dlatego komendy nie pojawiają się w DM-ach.',
      },
    },

    bingo: {
      title: 'Komendy planszy: /bingo',
      intro:
        '`/bingo` dotyczy jednej planszy. Gdy trwa kilka plansz naraz, **board** i **leaderboard** wypisują je wszystkie; reszta odpowiada o planszy, która trwa, potem o następnej, która ma wystartować, a potem o tej, która właśnie się skończyła.',
    },

    clan: {
      title: 'Komendy klanowe',
      intro:
        'Te odpowiadają o klanie, a nie o planszy, więc działają niezależnie od tego, czy trwa bingo: tygodniówki, efektywność, skarbiec, statystyki kogokolwiek i przewodniki konfiguracji.',
    },

    options: {
      title: 'Opcje, które zobaczysz wszędzie',
      intro: 'Kilka opcji znaczy to samo w każdej komendzie, która je ma:',
      rows: [
        {
          term: '`member`',
          body: 'ktoś inny z serwera. Pomiń, żeby zapytać o siebie. Konto Anvil tej osoby znajduje po loginie Discorda, którego użyła na stronie, więc działa tylko dla członków, którzy choć raz zalogowali się do Anvila.',
        },
        {
          term: '`account`',
          body: 'które z kont OSRS tej osoby, dla tych, co mają alty. Wpisz, by wybrać; pomiń dla maina.',
        },
        {
          term: '`page`',
          body: 'boss albo aktywność, wpisywane z wyszukiwaniem: `Zulrah`, `Theatre of Blood`, `Tempoross`. Pomiń dla widoku ogólnego.',
        },
        {
          term: '`language`',
          body: 'odpowiedz ten jeden raz w innym języku. Domyślnie dostajesz język, na który ustawiony jest twój Discord, albo język bota wybrany przez klan.',
        },
        {
          term: '`amount`',
          body: 'gp po ludzku: `5m`, `2.5b`, `500k` albo zwykła liczba, np. `2,500,000`.',
        },
      ],
    },

    who: {
      title: 'Kto czego może używać',
      body: [
        'Każdy na serwerze może uruchomić każdą komendę tylko do odczytu. Widzisz to, co widziałby członek: plansza, której pola nie zostały jeszcze odsłonięte, pozostaje ukryta także w Discordzie, nawet dla obsługi.',
        'Komendy, które odpowiadają o **tobie** (`/bingo me`, `/stats` bez member), muszą wiedzieć, które konto Anvil jest twoje. Znajdują je po loginie Discorda, którego użyłeś na stronie, więc zaloguj się raz do Anvila przez Discorda i od tej pory działają.',
      ],
      rows: [
        { term: 'Wszyscy', body: 'każda komenda poza `/coffer add` i `/coffer remove`.' },
        {
          term: 'Skarbnicy, admini, właściciele',
          body: '`/coffer add` i `/coffer remove`. Sprawdzane według twojej roli **na stronie Anvil**, nigdy według roli na Discordzie, bo ranga na serwerze czatu nigdy nie oznaczała kontroli nad pieniędzmi klanu.',
        },
      ],
    },

    trouble: {
      title: 'Gdy komenda nie działa',
      intro: 'Typowe przyczyny, mniej więcej w kolejności, w jakiej się zdarzają:',
      rows: [
        {
          term: 'Brak komend Anvila na liście',
          body: 'bota zaproszono bez jego komend — to osobne uprawnienie, a starsze linki zapraszające prosiły tylko o jedno. Admin uruchamia ponownie **Invite / re-invite the bot** z Admin → Discord → **Connection**. Nie wyrzuca to bota ani niczego nie resetuje. Nowo dodane komendy mogą pojawić się dopiero po godzinie.',
        },
        {
          term: '„The application did not respond”',
          body: 'Anvil był przez chwilę nieosiągalny, zwykle w trakcie aktualizacji. Uruchom komendę ponownie kilka sekund później.',
        },
        {
          term: '„Not on this board” o tobie samym',
          body: 'albo nie dołączyłeś do tej planszy, albo Anvil nie umie powiązać twojego Discorda z twoim kontem. Zaloguj się na stronę tym kontem Discorda i sprawdź swój profil.',
        },
        {
          term: 'Statystyki członka wracają puste',
          body: 'ta osoba nie zalogowała się jeszcze do Anvila przez Discorda albo hiscores jej konta nie zostały jeszcze odczytane. Spróbuj ponownie z opcją `account` albo poproś ją, żeby zalogowała się raz.',
        },
        {
          term: '`/coffer add` mówi, że nie możesz',
          body: 'twoja rola na stronie Anvil to nie skarbnik, admin ani właściciel, albo ten Discord nie jest kontem, którym logujesz się na stronę.',
        },
      ],
    },

    labels: {
      options: 'Opcje',
      noOptions: 'Brak opcji — po prostu uruchom.',
      example: 'Przykład',
      examples: 'Przykłady',
      required: 'wymagana',
      optional: 'opcjonalna',
      choices: 'Wartości',
      range: 'od {min} do {max}',
      kinds: {
        text: 'tekst',
        number: 'liczba',
        member: 'członek',
        choice: 'wybór z listy',
        search: 'wpisz, by wyszukać',
        yesno: 'tak lub nie',
      },
    },

    examples: {
      'bingo board': {
        examples: ['/bingo board'],
        tip: 'Plansza, która trwa w tej chwili. Dopóki plansza nie zostanie odsłonięta, nazwy pól są ukryte także tutaj.',
      },
      'bingo leaderboard': {
        examples: ['/bingo leaderboard'],
        tip: 'Ranking drużyn, w punktach albo polach, zależnie od tego, jak plansza liczy wynik.',
      },
      'bingo rules': {
        examples: ['/bingo rules'],
        tip: 'Jak ta plansza liczy punkty (odczytane z samego wydarzenia, więc zawsze zgodne z prawdą), a potem własne zasady twojego klanu.',
      },
      'bingo apply': {
        examples: ['/bingo apply'],
        tip: 'Jak się dostać: zapisy, wpisowe i na jakim etapie jest twoje zgłoszenie.',
      },
      'bingo next': {
        examples: ['/bingo next'],
        tip: 'Co nadchodzi: odsłonięcie pól, misja albo termin.',
      },
      'bingo me': {
        examples: ['/bingo me'],
        tip: 'Twoja drużyna, twoje miejsce i pola zaliczone tobie.',
      },
      'bingo help': {
        examples: ['/bingo help'],
        tip: 'Krótka lista tego, na co bot odpowiada, w samym Discordzie.',
      },
      'bingo team': {
        examples: ['/bingo team', '/bingo team name:Iron Wolves'],
        tip: 'Karta drużyny: wynik, skład i ostatnie pola. Pomiń nazwę, żeby zobaczyć własną drużynę.',
      },
      sotw: {
        examples: ['/sotw', '/sotw language:Deutsch'],
        tip: 'Każdy aktywny Skill of the Week, czołówka każdego z nich i twoje miejsce.',
      },
      botw: {
        examples: ['/botw'],
        tip: 'Każdy aktywny Boss of the Week i jego ranking na żywo.',
      },
      eff: {
        examples: ['/eff', '/eff metric:EHB'],
        tip: 'Klanowy ranking efektywności i twoje miejsce w nim. Domyślnie EHP (efficient hours played); wybierz EHB dla bossowania.',
      },
      'coffer balance': {
        examples: ['/coffer balance'],
        tip: 'Stan skarbca, najwięksi darczyńcy i ostatnie ruchy.',
      },
      'coffer add': {
        examples: ['/coffer add amount:5m', '/coffer add amount:250k note:Raffle proceeds'],
        tip: 'Tylko skarbnicy, admini i właściciele. Zapisuje wpływające gp; trafia to też na kanał z feedem skarbca.',
      },
      'coffer remove': {
        examples: ['/coffer remove amount:20m note:SOTW prize'],
        tip: 'Tylko skarbnicy, admini i właściciele. Nie pozwoli zejść skarbcowi poniżej zera; jeśli naprawdę o to chodzi, zapisz to na stronie skarbca.',
      },
      'stats profile': {
        examples: ['/stats profile', '/stats profile player:Zezima'],
        tip: 'Jedno konto w skrócie: poziom bojowy i całkowity, EHP i EHB, liczba wpisów w collection logu i rekordy osobiste.',
      },
      'stats levels': {
        examples: ['/stats levels', '/stats levels player:My Iron'],
        tip: 'Poziom i XP każdej umiejętności.',
      },
      'stats efficiency': {
        examples: ['/stats efficiency'],
        tip: 'EHP i EHB oraz z jakich umiejętności i bossów pochodzą.',
      },
      'stats clog': {
        examples: ['/stats clog', '/stats clog page:Zulrah'],
        tip: 'Postęp collection logu ogólnie albo strona jednego bossa.',
      },
      'stats pbs': {
        examples: ['/stats pbs', '/stats pbs page:Theatre of Blood mode:Hard size:3'],
        tip: 'Rekordy osobiste. Raidy trzymają czas osobno dla każdego trybu i rozmiaru drużyny, więc użyj `mode` i `size`, żeby znaleźć ten run, o który ci chodzi.',
      },
      'stats luck': {
        examples: ['/stats luck', '/stats luck player:Zezima'],
        tip: 'Ile szczęścia miało konto przy dropach, które śledzi Anvil.',
      },
      'stats collectors': {
        examples: ['/stats collectors'],
        tip: 'Największe collection logi w klanie.',
      },
      'stats luckboard': {
        examples: ['/stats luckboard'],
        tip: 'Najbardziej pechowi i najszczęśliwsi członkowie klanu.',
      },
      setup: {
        examples: ['/setup topic:Plugin setup', '/setup topic:Plugin setup step:5'],
        tip: 'Przewodnik konfiguracji w Discordzie: lista kroków albo jeden krok z linkiem prosto do niego na stronie.',
      },
      guide: {
        examples: ['/guide guide:ToB 4-man gear'],
        tip: 'Jeden z poradników do gry klanu (rajdy, bossing, zarabianie…): zacznij wpisywać nazwę i wybierz go z listy.',
      },
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
        'skład: dodawanie i usuwanie ludzi oraz odpowiadanie na prośby o dołączenie ([Twoi ludzie]({peopleGuide}))',
        'weryfikacje kont —— wyzwanie XP i przegląd ręczny',
        'zgłoszenia i zrzuty dowodowe',
        'tygodniowe konkursy i kalendarz',
        'wydarzenia w kalendarzu klanu',
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
          body: 'po pierwszym potwierdzeniu własności plugin rozpoznaje konto automatycznie, a stabilny odcisk zachowuje powiązanie po zmianie nazwy. Konto z listy bez znanego odcisku używa raz weryfikacji XP lub zgody moderatora.',
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
        body: 'Zweryfikowanie konta mówi „to naprawdę jego”. Nie wprowadza go do klanu. Członkostwo bierze się wyłącznie z synchronizacji składu z gry albo z ręcznego dodania przez sztab, a miejsce gościa tylko z prośby o dołączenie zatwierdzonej przez sztab (albo od razu, jeśli klan wpuszcza każdego). To celowe i to właśnie powstrzymuje kogokolwiek przed dołączeniem do twojego klanu przez wpisanie nazwy.',
      },
    },

    roster: {
      title: 'Utrzymywanie składu w zgodzie z prawdą',
      body: [
        'Skład bierze się z jednego miejsca: admin uruchamia synchronizację z listy klanu w grze, przyciskiem **Anvil** na pasku tytułu okna klanu (albo **Sync roster** w panelu bocznym pluginu). Wszystko inne —— weryfikacje, powiązania, zapisy —— wisi na tym.',
        'Więc utrzymanie jest małe, ale prawdziwe: poproś admina o synchronizację po każdej turze rekrutacji (zamienia w członków gości, którzy dołączyli w grze), odpowiadaj na prośby o dołączenie na górze zakładki **Roster** i przerabiaj **Needs review**, zamiast czekać, aż ludzie zaczną narzekać. Zobacz [Twoi ludzie]({peopleGuide}).',
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

  tiles: {
    metaTitle: 'Zasady i ograniczenia pól — Anvil',
    metaDescription:
      'Czego każdy rodzaj pola bingo wymaga od ciebie (ustawienia gry, plugin RuneLite, zsynchronizowany collection log, miejsce w hiscores) i gdzie kończy się to, co potrafi śledzić.',
    eyebrow: 'Anvil · dla graczy',
    title: 'Zasady i ograniczenia pól',
    dek: 'Każde pole pokazuje, czego od ciebie wymaga i czego nie potrafi. Ta strona wyjaśnia każdą linijkę; linki **Why?** na polu prowadzą tutaj.',
    needs: 'Wymaga',
    limit: 'Dobrze wiedzieć',
    checked: 'Pole sprawdza to za ciebie',
    englishOnly: 'Zasady poniżej są na razie po angielsku, żeby zawsze zgadzały się z tym, co strona naprawdę robi.',
  },

  // /guide/creators — przewodnik gospodarza przestrzeni twórcy.
  creators: {
    metaTitle: 'Zorganizuj bingo OSRS dla swoich widzów — Anvil',
    metaDescription:
      'Poprowadź bingo albo wyścig pól w Old School RuneScape na swoim streamie, bez klanu: zrób przestrzeń, udostępnij jeden link, wybierz, kto może dołączyć (Twitch, Kick, YouTube lub Discord) i pokaż planszę na streamie przez OBS.',
    eyebrow: 'Dla streamerów i twórców',
    title: 'Wydarzenia dla twoich widzów',
    dek: 'Przestrzeń twórcy pozwala prowadzić bingo na twoim streamie. Nie potrzebujesz klanu w grze. Robisz jedno wydarzenie, udostępniasz jeden link, a widzowie dołączają.',
    facts: [
      { strong: 'Bez klanu', rest: 'niepotrzebny' },
      { strong: 'Za darmo', rest: 'na start' },
      { strong: 'Jeden link', rest: 'na twój czat' },
    ],

    what: {
      title: 'Czym jest przestrzeń twórcy',
      body: [
        'To twoja własna strona w Anvil, pod adresem `{apex}/c/twoja-nazwa`. Prowadzisz tam wydarzenia dla widzów.',
        'To nie jest klan. Nie ma listy klanu, rang ani cotygodniowych zawodów. Kto dołączy do twojego wydarzenia, gra w tym wydarzeniu. Nic więcej.',
        'Widzowie logują się przez Discord, dodają swoją postać z RuneScape i klikają **Join**. Plugin Anvil do RuneLite sam liczy ich dropy.',
      ],
    },

    create: {
      title: 'Zrób swoją przestrzeń',
      body: [
        'Wejdź na [{apex}/host](/host) i zaloguj się przez Discord.',
        'Wpisz nazwę przestrzeni. Dobra będzie nazwa twojego kanału. Link powstaje z nazwy. Kliknij **change link**, jeśli chcesz inny.',
        'Kliknij **Create my space**. Dostajesz jedną przestrzeń na konto Discord.',
      ],
    },

    first: {
      title: 'Zrób pierwsze wydarzenie',
      body: [
        'Zaraz po zrobieniu przestrzeni trafiasz na **Create your first event**. Później użyj **+ New event** na górze **Your events**.',
        '**Name.** To zobaczą twoi widzowie.',
        '**What kind?** Wybierz kartę. **Team bingo** to siatka 5×5, a Anvil sam dzieli graczy na drużyny. **Solo bingo** to ta sama siatka, każdy gra sam. **Team race** to zadania po kolei: wygrywa drużyna, która zajdzie najdalej.',
        '**Ready-made tiles** daje mieszankę łatwych i trudnych zadań, które możesz potem zmienić. **Blank, I’ll write my own** zaczyna od pustej planszy.',
        '**Who can join?** Zostaw **Anyone** albo wybierz, kto może dołączyć. Zobacz krok 5.',
        '**When?** Wybierz daty startu i końca. Albo zostaw puste i wystartuj wydarzenie sam, gdy będziesz gotowy.',
        'Kliknij **Create event**. Potem kliknij **Copy invite link**.',
      ],
    },

    share: {
      title: 'Udostępnij link',
      body: [
        'Wklej link z zaproszeniem na czat streama, na Discorda albo do social mediów. Twoim widzom wystarczy tylko ten link.',
        'Możesz go skopiować ponownie w każdej chwili: **Your events** → **Copy invite link** obok wydarzenia.',
        'Chcesz, żeby bot odpowiadał linkiem na `!join` na czacie? Zobacz krok 9.',
      ],
    },

    who: {
      title: 'Wybierz, kto może dołączyć',
      body: [
        'Każde wydarzenie zaczyna jako otwarte dla **Anyone**. Żeby zostawić je dla swojej społeczności, otwórz **Settings** → **Viewers** → **Who can join?** wydarzenia i wybierz jedną lub kilka opcji. Te same opcje są na ekranie pierwszego wydarzenia.',
        'Jeśli wybierzesz więcej niż jedną, **wystarczy dowolna z nich**. Wchodzi obserwujący LUB booster serwera.',
      ],
      intro: 'Każda opcja i co musi zrobić widz:',
      rows: [
        {
          term: 'Anyone',
          body: 'Każdy z linkiem dołącza od razu.',
        },
        {
          term: 'Twitch followers',
          body: 'Widz klika **Link Twitch** na stronie wydarzenia i loguje się przez Twitch. Anvil sprawdza, czy cię obserwuje.',
        },
        {
          term: 'Twitch subs',
          body: 'Tak samo jak obserwujący, ale musi mieć suba. Wybierz najniższy poziom: **Tier 1 or higher**, **Tier 2 or higher** albo **Tier 3**. Suby z Prime liczą się jako poziom 1. Twój kanał musi być partnerem lub afiliantem Twitcha.',
        },
        {
          term: 'Kick followers',
          body: 'Kick nie mówi aplikacjom, kto cię obserwuje, więc Anvil liczy osoby, które zaczną obserwować _po_ połączeniu Kicka. Obserwował wcześniej? Widz przestaje obserwować i obserwuje od nowa. Twój czat Kicka jest tylko dla obserwujących? Włącz **My Kick chat is followers-only** w polu **Kick channel**. Wtedy widz, który wpisze swój kod Anvil na twoim czacie, liczy się jako obserwujący.',
        },
        {
          term: 'Kick subs',
          body: 'Suby, które Anvil zobaczył po połączeniu Kicka, liczą się same. Reszta klika **Get Kick code** i wpisuje kod (wygląda jak `ANVIL-7F3K9Q`) na twoim czacie Kicka, a Anvil widzi odznakę suba. Kick nie ma poziomów subów.',
        },
        {
          term: 'YouTube subscribers',
          body: 'Widz klika **Check my YouTube subscription** i loguje się przez Google. Jego subskrypcje muszą być publiczne na YouTube.',
        },
        {
          term: 'YouTube members',
          body: 'Widz wpisuje swój kod Anvil na twoim czacie na żywo na YouTube. Członkowie mogą więc dołączyć tylko **gdy jesteś na żywo**.',
        },
        {
          term: 'Discord role',
          body: 'Osoby z rolą, którą wybierzesz na swoim serwerze Discord (do 5 ról). Najpierw połącz serwer: **Discord (optional)** w menu.',
        },
        {
          term: 'Server boosters',
          body: 'Osoby, które boostują twój serwer Discord. Też wymaga połączonego serwera.',
        },
      ],
      note: {
        tag: 'Dobrze wiedzieć',
        body: 'Najpierw połącz swój kanał (krok 7), inaczej opcje Twitch, Kick i YouTube będą wyszarzone. Jedno konto Twitch, Kick lub YouTube wprowadza do wydarzenia tylko jednego gracza. Twój sztab i osoby zaproszone z nazwy pomijają sprawdzanie.',
      },
    },

    approve: {
      title: 'Zatwierdzaj każdego gracza (opcjonalnie)',
      body: [
        'Chcesz sam wybierać, kto gra? Otwórz **Settings** → **Viewers** → **Who can enter** wydarzenia i wybierz **Ask me about everyone**. Kliknij **Save changes**.',
        'Teraz widzowie klikają **Ask to join** zamiast **Join**. Wciąż muszą najpierw spełnić twoje opcje **Who can join?**.',
        'Ich prośby pokazują się w **Your events** jako **N waiting for you**. Kliknij to albo otwórz kartę **Sign-ups** wydarzenia. Lista na górze nazywa się **Waiting for your yes**. Zaakceptuj lub odrzuć każdą prośbę.',
      ],
    },

    channels: {
      title: 'Połącz swój Twitch, Kick lub YouTube',
      body: [
        'Otwórz **Settings** w menu. W polu **Twitch channel**, **YouTube channel** albo **Kick channel** kliknij **Connect Twitch**, **Connect YouTube** albo **Connect Kick** i zaloguj się jako twój kanał.',
        'Każdy połączony kanał pokazuje się na twojej stronie jako link **verified**. Nie da się wpisać linku ręcznie: logowanie to sposób, w jaki Anvil wie, że kanał jest twój.',
        'Kanał można połączyć tylko z jednym miejscem w Anvil. Jeśli jest już w innej przestrzeni lub klanie, który prowadzisz, Anvil zapyta, czy go przenieść.',
      ],
    },

    overlay: {
      title: 'Pokaż planszę na streamie (OBS)',
      body: [
        'W **Your events** kliknij **Stream overlay** obok wydarzenia, potem **Make overlay links**.',
        'Dostajesz trzy linki. **Standings**: najlepsze drużyny i jak daleko zaszły. **Feed**: ostatnie dropy i ukończone pola. **Board**: plansza z oznaczonymi ukończonymi polami.',
        'Przed skopiowaniem wybierz **Text size** (S, M, L lub XL). Potem kliknij **Copy** przy tym, który chcesz.',
      ],
      stepsTitle: 'Dodaj to do OBS',
      steps: [
        'W OBS, w **Sources**, kliknij **+** i wybierz **Browser**.',
        'Wklej link w **URL**.',
        'Ustaw rozmiar, na przykład 800 × 600. Zostaw **Custom CSS** puste.',
        'Kliknij **OK**. Odświeża się samo co kilka sekund.',
      ],
      tipsTag: 'Dobrze wiedzieć',
      tips: [
        'Dodaj `&limit=10`, `&title=0` lub `&align=right` na końcu linku, żeby go zmienić.',
        'Nakładka pokazuje to, co twoja publiczna strona wydarzenia. Ukryty ranking i ukryte pola zostają ukryte także na streamie.',
        '**Reset link** robi nowe linki i wyłącza stare. Użyj tego, jeśli link wycieknie. Nowe linki trzeba wkleić do OBS jeszcze raz.',
        'W rogu jest mały znaczek „Anvil”. W planie Gold możesz go ukryć w **Settings** → **Anvil mark on your overlay**.',
      ],
    },

    chatjoin: {
      title: '!join na twoim czacie',
      body: [
        'Otwórz **Settings** → **!join in Twitch chat** i włącz to.',
        'Gdy widz wpisze `!join`, bot Anvil (Anvil_OSRS) odpowie linkiem do twojego otwartego wydarzenia. Odpowiada co najwyżej raz na 30 sekund, bez względu na to, ile osób to wpisze.',
        'Odpowiada tylko na kanale, który połączyłeś w kroku 7. Dla Kicka włącz **!join in Kick chat** w polu **Kick channel**.',
        'Brak otwartego wydarzenia? Bot to powie: „No event is open to join right now — keep an eye on the stream!”',
      ],
      tips: [
        'Jeśli twój czat blokuje linki (**Block hyperlinks** na Twitchu lub AutoMod), odpowiedź bota zostanie wstrzymana. Wpisz raz `/vip anvil_osrs` albo `/mod anvil_osrs` na czacie, żeby link przechodził.',
        'Pracujesz nad wydarzeniem? **Space settings** w menu wydarzenia zabierze cię z powrotem do tych przełączników. Tak samo **Switch it on in your settings** pod **Who can join?**.',
      ],
    },

    page: {
      title: 'Zrób swoją stronę po swojemu',
      body: [
        'Twoja strona to to, co ludzie widzą pod `{apex}/c/your-name`, razem z twoimi wydarzeniami. Otwórz **Settings** → **Your page**. Każda część ma własny przycisk zapisu.',
      ],
      items: [
        '**Bio.** Kilka zdań o tobie i twoich streamach. Linki zaczynające się od `https://` są klikalne.',
        '**Logo and banner.** Kliknij **Upload a logo** albo **Upload a banner**. Baner biegnie przez całą górę strony, więc zrób go szerokim (3:1, na przykład 1500 × 500). PNG, JPEG, GIF lub WebP. Oba mogą być animowane.',
        '**Panels.** Do 8 kart pod twoimi wydarzeniami, jak panele pod kanałem na Twitchu. Kliknij **+ Add a panel** i daj mu tytuł i trochę tekstu. Obrazek i link są opcjonalne. Strzałkami zmienisz kolejność.',
        '**Schedule.** Kiedy zwykle wchodzisz na live, w twojej strefie czasowej. Odwiedzający widzą każdą godzinę według własnego zegara.',
        '**Featured.** Jeden klip przypięty na górze strony. Wybierz jeden z highlightów twojego streama (następny krok) albo wklej link do klipu z Twitcha, YouTube, Kicka lub Medal.',
        'Kliknij **Preview your page**, żeby zobaczyć ją tak, jak widzą ją odwiedzający.',
      ],
      note: {
        tag: 'Zasady Jagexu',
        body: 'Wszystko na twojej stronie musi przestrzegać zasad Jagexu: żadnej sprzedaży złota ani kont, żadnego hazardu, żadnych botów ani prywatnych serwerów. Anvil sprawdza twoje teksty i linki przy zapisie. Jeśli staff Anvil ukryje twoją stronę po zgłoszeniu, zobaczysz to w ustawieniach. Zapytaj na Discordzie Anvil, jeśli uważasz, że to pomyłka.',
      },
    },

    highlights: {
      title: 'Highlighty ze streama',
      body: [
        'Gdy twój kanał Twitch lub YouTube jest połączony, Anvil łapie wielkie momenty twoich wydarzeń, kiedy jesteś na live. Przełączniki są w **Settings** → **Stream highlights**.',
        '**Auto-clip big moments on my stream** jest włączone od razu po połączeniu. Gdy jesteś na live na Twitchu, Anvil robi klip, kiedy startuje jedno z twoich wydarzeń, kiedy drużyna czyści planszę lub wygrywa i kiedy twoja postać dostaje rzadki drop albo peta. Na YouTube zamiast tego zapisuje link do tej sekundy streama. Kick nie ma jeszcze highlightów.',
        'Klipy pokazują się w **Highlights** na stronie wydarzenia i na twojej stronie. Jeden możesz przypiąć jako klip **Featured** (krok 10).',
        '**Let Anvil feature clips from my events in its own promotion** jest wyłączone, dopóki tego nie włączysz. Wtedy Anvil może udostępnić klip na swoich stronach i w social mediach, zawsze podając cię jako autora.',
        'Twoi gracze też mogą klipować swoje wielkie momenty. Włączają **Clip my stream when I hit a big moment** pod swoim kontem Twitch w **Settings** → **Connected accounts**.',
      ],
    },

    listing: {
      title: 'Pojaw się na liście Anvil',
      body: [
        'Twoja przestrzeń jest po utworzeniu niepubliczna. Tylko osoby z twoim linkiem mogą ją znaleźć.',
        'Otwórz **Settings** → **Advertise on Anvil** i włącz to. Twoja przestrzeń pokaże się w katalogu klanów Anvil, a nowe wydarzenia na `{apex}/events`.',
        'Żeby pokazać tylko jedno wydarzenie, otwórz jego **Settings** → **Viewers** → **List on Anvil**. Widać je, gdy wydarzenie jest nadchodzące lub trwa.',
        'Wydarzenie bez dat pokazuje się w **Open to join** z dopiskiem „Open now · starts when the host starts it”.',
      ],
    },

    plans: {
      title: 'Plany i limity',
      body: [
        'Twój plan ustala, ilu graczy może być w twoich wydarzeniach naraz. Wydarzenia, których daty się nakładają, dzielą tę liczbę; wydarzenia w różnych terminach dostają ją każde osobno. Gracz w dwóch nakładających się wydarzeniach liczy się dwa razy. Cała reszta jest taka sama w każdym planie: plansza, śledzenie przez plugin, nakładka i Discord.',
        'Karta twojego planu jest w **Your events**. Żeby porównać plany, zobacz [cennik](/pricing#creators). Żeby zmienić lub anulować płatność, wejdź na [swoją stronę rozliczeń](/portal).',
      ],
      rows: [
        { term: 'Free', body: 'Do 50 graczy naraz we wszystkich twoich wydarzeniach. Jedno wydarzenie naraz. Sprawdzanie ról Discord i boosterów.' },
        { term: 'Bronze', body: 'Do 150 graczy naraz we wszystkich twoich wydarzeniach. Sprawdzanie Twitch, Kick i YouTube.' },
        { term: 'Silver', body: 'Do 300 graczy naraz we wszystkich twoich wydarzeniach. Więcej niż jedno wydarzenie naraz. `!join` na czacie. Pokazywane na początku listy.' },
        { term: 'Gold', body: 'Do 1000 graczy naraz we wszystkich twoich wydarzeniach. Ukrycie znaczka Anvil na nakładce.' },
        { term: 'Partner', body: 'Bez limitu graczy. Ustalane bezpośrednio z Anvil — napisz do nas.' },
      ],
      note: {
        tag: 'Na razie',
        body: 'Na razie, gdy Anvil rośnie, wchodzą wszyscy, nawet ponad liczby z twojego planu. Limity ruszą później, z uprzedzeniem. Karta planu pokazuje, jak blisko jesteś.',
      },
    },

    faq: {
      title: 'Pytania',
      intro: 'Te, które streamerzy zadają najczęściej:',
      rows: [
        {
          term: 'Czy moi widzowie potrzebują klanu?',
          body: 'Nie. Potrzebują konta Discord i postaci w OSRS. Wyślij im [przewodnik dla widzów]({joiningGuide}).',
        },
        {
          term: 'Czy potrzebują pluginu RuneLite?',
          body: 'Do dropów i zabójstw tak. Plugin sam je wysyła. Kilka pól czyta zamiast tego hiscores.',
        },
        {
          term: 'Widz mówi: „The host’s Twitch connection isn’t working”.',
          body: 'Twitch przestał przyjmować twoje połączenie. Otwórz **Settings** i kliknij **Reconnect Twitch**. To samo dotyczy Kicka i YouTube.',
        },
        {
          term: 'Czy ktoś inny może mi pomóc to prowadzić?',
          body: 'Tak. Otwórz **Players** → **Staff & roles**, dodaj go i wybierz, co każdy z nich może robić.',
        },
        {
          term: 'Prowadzę też klan w grze.',
          body: 'Wtedy może nie potrzebujesz przestrzeni. Publiczny klan może zamiast tego włączyć **Streaming**. Zobacz [streamowanie dla klanów]({streamingGuide}).',
        },
        {
          term: 'Czy mogę zrobić drugą przestrzeń?',
          body: 'Na razie jedna przestrzeń na konto Discord. Napisz do nas, jeśli potrzebujesz kolejnej.',
        },
        {
          term: 'Gdzie są ustawienia mojej przestrzeni?',
          body: 'Kliknij **Settings** w menu. Z wnętrza wydarzenia kliknij **Space settings** w menu wydarzenia.',
        },
        {
          term: 'Co robi przycisk **Report** na mojej stronie?',
          body: 'Każdy zalogowany może zgłosić staffowi Anvil twoją stronę, panel, wydarzenie albo highlight. Zgłoszenia trafiają tylko do staffu. Jeśli staff ukryje twoje bio, panele, harmonogram lub wyróżniony klip, zobaczysz to w ustawieniach.',
        },
      ],
    },
  },

  // /guide/joining-a-streamer-event — dla widza, który kliknął link streamera.
  joiningStream: {
    metaTitle: 'Dołączanie do bingo OSRS streamera — Anvil',
    metaDescription:
      'Masz link od streamera? Zaloguj się przez Discord, dodaj postać z OSRS, kliknij Join. Co zrobić przy wydarzeniach tylko dla obserwujących lub subów na Twitchu, Kicku i YouTube oraz jak liczą się twoje dropy.',
    eyebrow: 'Dla widzów',
    title: 'Dołączanie do wydarzenia streamera',
    dek: 'Streamer udostępnił link. Oto jak wejść na planszę. Nie potrzebujesz klanu.',
    facts: [
      { strong: '~2 min', rest: 'na dołączenie' },
      { strong: 'Bez klanu', rest: 'niepotrzebny' },
    ],

    join: {
      title: 'Dołącz w czterech krokach',
      body: [
        '**Otwórz link**, który udostępnił streamer. Albo wpisz `!join` na jego czacie, a bot go poda.',
        '**Zaloguj się przez Discord.** To jest twoje konto Anvil. Nic nie trzeba wypełniać.',
        '**Dodaj swoją postać.** Kliknij **Add my character** i wpisz swoją nazwę z RuneScape. Jeśli pokaże się **Prove it’s mine**, wykonaj kroki w swoim profilu. [Przewodnik po pluginie]({pluginGuide}) pokazuje jak.',
        '**Kliknij Join.** Wybierz postać, jeśli masz więcej niż jedną. Gdy się udało, zobaczysz **You’re in!**.',
      ],
    },

    gated: {
      title: 'Wydarzenia dla obserwujących lub subów',
      body: [
        'Niektóre wydarzenia są tylko dla społeczności streamera. Karta dołączania mówi dla kogo, na przykład „Open to followers of somename on Twitch”.',
        'I tak kliknij **Join**. Jeśli jeszcze cię nie wpuszczą, karta wypisze, co zrobić. Zrób jedną z tych rzeczy, potem kliknij **Join** jeszcze raz.',
      ],
      intro: 'Co zrobić w każdym przypadku:',
      rows: [
        {
          term: 'Obserwowanie lub sub na Twitchu',
          body: 'Kliknij **Link Twitch** i zaloguj się przez Twitch. Anvil nie prosi o żadne uprawnienia. Potem kliknij **Join** jeszcze raz.',
        },
        {
          term: 'Obserwowanie lub sub na Kicku',
          body: 'Kliknij **Get Kick code**. Wpisz kod (np. `ANVIL-7F3K9Q`) na czacie Kicka streamera w ciągu 10 minut. Każdy kod działa raz. Potem kliknij **Join** jeszcze raz.',
        },
        {
          term: 'Subskrybent YouTube',
          body: 'Kliknij **Check my YouTube subscription** i zaloguj się przez Google. Wybierz konto, na którym oglądasz. Twoje subskrypcje muszą być publiczne w ustawieniach prywatności YouTube.',
        },
        {
          term: 'Członek YouTube',
          body: 'Kliknij **Link my YouTube account**, potem wpisz swój kod na czacie na żywo YouTube i kliknij **check the chat**. Działa to tylko wtedy, gdy streamer jest na żywo.',
        },
        {
          term: 'Rola lub booster na Discordzie',
          body: 'Dołącz do serwera Discord streamera i zdobądź rolę (albo go zboostuj). Anvil sprawdza to na koncie Discord, którym się zalogowałeś.',
        },
      ],
      note: {
        tag: 'Zatwierdzanie',
        body: 'Niektórzy streamerzy zatwierdzają każdego gracza. Wtedy przycisk mówi **Ask to join**, a ty widzisz **Waiting for the host**, aż odpowiedzą.',
      },
    },

    plugin: {
      title: 'Zainstaluj plugin Anvil',
      body: [
        'Twoje dropy i zabójstwa liczą się przez plugin Anvil do RuneLite. Zainstaluj go z Plugin Hub i zaloguj się przez Discord w jego panelu bocznym.',
        '[Przewodnik po pluginie]({pluginGuide}) przeprowadzi cię przez to w około trzy minuty.',
      ],
    },

    play: {
      title: 'Graj',
      body: [
        'To wszystko. Graj jak zwykle. Gdy zdobędziesz drop albo zabójstwo, którego potrzebuje plansza, plugin sam je wyśle.',
        'Otwórz link do wydarzenia w każdej chwili, żeby zobaczyć planszę i ranking. Grasz tylko w tym jednym wydarzeniu: nie wstępujesz do klanu.',
      ],
    },

    accounts: {
      title: 'Twoje połączone konta',
      body: [
        'Konta Twitch, YouTube i Kick, które połączyłeś, są w [Settings → Connected accounts](/settings/connections). Możesz je tam połączyć jeszcze przed dołączeniem.',
        'Możesz odłączyć każde w każdej chwili. Wydarzenia, do których już dołączyłeś, cię zachowują. Wydarzenie z ograniczeniem, do którego dołączysz później, poprosi o ponowne połączenie.',
        'Połączone konta Twitch, YouTube i Kick widać na twoim profilu ze znaczkiem weryfikacji: udowodniłeś, że są twoje. Wyłącz **Show on my profile**, żeby jedno ukryć. Link do Medal to co innego. Wklejasz go sam, więc nie ma znaczka.',
        'Sam streamujesz na Twitchu? Włącz **Clip my stream when I hit a big moment** pod swoim kontem Twitch. Gdy jesteś na live w wydarzeniu streamera, Anvil klipuje twoje rzadkie dropy, pety i ukończone pola.',
      ],
    },

    faq: {
      title: 'Pytania',
      intro: 'Gdy coś mówi nie:',
      rows: [
        {
          term: '„This event is full”',
          body: 'Nie ma miejsca na więcej graczy. Tylko streamer może zrobić miejsce — daj mu znać.',
        },
        {
          term: 'Mam suba, ale nie wpuszcza mnie.',
          body: 'Sprawdź, czy połączyłeś to samo konto, którym subskrybujesz. Na Twitchu spójrz na **Your Twitch** na karcie dołączania. Na Kicku wpisz świeży kod na ich czacie: Anvil czyta odznakę suba z tej wiadomości. Na YouTube ustaw subskrypcje jako publiczne i sprawdź jeszcze raz.',
        },
        {
          term: 'Zaobserwowałem na Kicku, ale pisze, że nie.',
          body: 'Anvil widzi tylko obserwacje zrobione po tym, jak streamer połączył Kicka. Przestań obserwować i obserwuj od nowa, potem kliknij **Join**.',
        },
        {
          term: '„That Twitch account was already used to join this event”',
          body: 'Jedno konto Twitch (albo Kick, albo YouTube) wprowadza jednego gracza. Ktoś inny już przez nie dołączył.',
        },
        {
          term: '„Twitch didn’t answer just now”',
          body: 'Twitch, Kick, YouTube albo Discord miał chwilową awarię. Poczekaj minutę i kliknij **Join** jeszcze raz.',
        },
        {
          term: '„The host’s … connection isn’t working”',
          body: 'To sprawa streamera. Powiedz mu, żeby ponownie połączył swój kanał w Anvil.',
        },
        {
          term: 'Moje dropy się nie pokazują.',
          body: 'Sprawdź, czy plugin jest zainstalowany i zalogowany oraz czy dołączyłeś postacią, którą grasz. Zobacz [przewodnik po pluginie]({pluginGuide}).',
        },
        {
          term: 'Gdzie znajdę więcej takich wydarzeń?',
          body: '[Strona wydarzeń](/events) pokazuje wydarzenia, do których każdy może dołączyć, w tym otwarte teraz wydarzenia streamerów.',
        },
        {
          term: 'Coś na stronie streamera łamie zasady.',
          body: 'Kliknij **Report** na stronie, przy wydarzeniu albo przy highlighcie. Wybierz, co jest nie tak, i kliknij **Send**. Trafia to tylko do staffu Anvil. Streamer nigdy nie dowie się, kto zgłosił.',
        },
      ],
    },
  },

  // /guide/streaming-for-clans — publiczny klan włączający Streaming.
  streamingClans: {
    metaTitle: 'Streamowanie wydarzeń twojego klanu — Anvil',
    metaDescription:
      'Pozwól widzom swojego streama dołączyć do jednego z wydarzeń OSRS twojego klanu bez wstępowania do klanu: włącz Streaming, otwórz wydarzenie dla widzów i wybierz, którzy widzowie wchodzą.',
    eyebrow: 'Dla klanów, które streamują',
    title: 'Streamowanie dla klanów',
    dek: 'Twój klan streamuje swoje wydarzenia? Pozwól widzom zagrać w jednym wydarzeniu bez wstępowania do klanu.',

    on: {
      title: 'Włącz Streaming',
      body: [
        'Wejdź w Admin → **Clan settings** → **Profile** i włącz **Streaming**.',
        'Streamować może tylko publiczny klan. Widzowie muszą otworzyć stronę twojego wydarzenia, a prywatny klan ją przed nimi ukrywa. Klan z włączonym Streaming nie może stać się prywatny, dopóki tego nie wyłączysz.',
        'Gdy jest włączone, tuż pod spodem połącz swój kanał Twitch, YouTube lub Kick.',
      ],
    },

    event: {
      title: 'Otwórz wydarzenie dla widzów',
      body: [
        'Każde wydarzenie zostaje **Members only**, dopóki nie powiesz inaczej. Tak działało to wcześniej.',
        'Otwórz **Settings** → **Entry & co-hosts** → **Who can join?** wydarzenia i wybierz **Members and viewers**. Potem wybierz **Which viewers?**: każdy albo obserwujący, suby, rola z Discorda i tak dalej. Kliknij **Save**.',
        'Te sprawdzenia dotyczą tylko widzów. Członkowie twojego klanu zawsze wchodzą, jak dotąd.',
      ],
    },

    viewers: {
      title: 'Kim są widzowie',
      body: [
        'Widz, który dołączy, to **gracz wydarzenia**. Gra w tym jednym wydarzeniu.',
        'Nie jest członkiem klanu ani gościem. Nigdy nie trafia na listę klanu i nie dostaje rangi.',
        'Wszystkich, którzy tak dołączyli, zobaczysz w **People** → **Past viewers**.',
      ],
    },

    tools: {
      title: 'Twoje narzędzia streamera',
      body: [
        'Narzędzia streamera działają tak samo jak w przestrzeni twórcy: zweryfikowane linki kanałów, sprawdzanie **Who can join?**, nakładka OBS i `!join` na czacie.',
        'Linki nakładki dla wydarzenia klanu są w **Settings** wydarzenia → **Stream** → **Stream overlay**. `!join` i znaczek nakładki są w **Clan settings** → **Profile** → **Streaming**.',
        '[Przewodnik dla twórców]({creatorsGuide}) tłumaczy każde z nich krok po kroku.',
        'Highlighty ze streama też tu działają: gdy Twitch lub YouTube jest połączony, Anvil klipuje wielkie momenty wydarzeń otwartych dla widzów. `!join` na czacie Kicka ma własny przełącznik w polu **Kick channel**.',
      ],
    },

    faq: {
      title: 'Pytania',
      intro: 'Krótkie odpowiedzi:',
      rows: [
        {
          term: 'Czy widzowie wliczają się do naszego limitu członków?',
          body: 'Nie. To gracze wydarzenia, nie członkowie. Limity streamera liczą graczy naraz we wszystkich wydarzeniach, które prowadzisz (zobacz [przewodnik dla twórców]({creatorsGuide})).',
        },
        {
          term: 'Czy `!join` wyśle ludzi do wydarzenia tylko dla członków?',
          body: 'Nie. Wskazuje tylko wydarzenie otwarte dla widzów.',
        },
        {
          term: 'Czy zamiast tego zrobić przestrzeń twórcy?',
          body: 'Tylko jeśli nie masz klanu. Przestrzeń jest dla streamerów bez klanu w grze.',
        },
      ],
    },
  },

  people: {
    metaTitle: 'Twoi ludzie: skład, goście i kto może dołączyć — Anvil',
    metaDescription:
      'Skąd bierze się skład klanu w Anvil, co znaczą Members, Guests, Roster only, Departed i Quiet, jak działają prośby o dołączenie i Needs review, trzy ustawienia Who can join oraz usuwanie i banowanie.',
    eyebrow: 'Anvil · dla sztabu klanu',
    title: 'Twoi ludzie: skład, goście i kto może dołączyć',
    dek: 'Każdy w Admin → **People** trafił tam na jeden z czterech sposobów: wymieniła go lista klanu w grze, zatwierdził go sztab, klan wpuszcza każdego albo ktoś dodał go ręcznie. Tu jest, jak działa każdy z nich, co mówi ci zakładka Roster i co sprawdzić, gdy ktoś jest nie tam, gdzie trzeba.',
    facts: [
      { strong: 'Skład z gry', rest: 'jedyna automatyczna droga do członkostwa' },
      { strong: 'Logowanie', rest: 'nigdy nikogo nie dopisuje do składu' },
      { strong: 'Dwie kolejki', rest: 'na dwóch różnych zakładkach' },
    ],
    footnote:
      'Wszystko tutaj jest w Admin → **People**. Roster i Needs review to robota moderatora. **Who can join** i **Staff & roles** to zakładki tylko dla adminów. Kto co może w całym panelu administracyjnym, znajdziesz w [Role w sztabie: kto co może]({staffGuide}).',

    roster: {
      title: 'Skąd bierze się skład',
      body: [
        'Skład to twoja lista klanu z gry, skopiowana na stronę. Admin wysyła ją z RuneLite pluginem Anvil: przyciskiem **Anvil** na pasku tytułu okna klanu albo **Sync roster** w panelu bocznym pluginu. Każdy z listy trafia na stronę jako **członek**, ze swoją rangą z gry. Wysłać ją może tylko ktoś z rolą Admin na stronie. Każdy inny dostaje o tym komunikat w grze.',
        'Synchronizacja to jedyna rzecz, która sama robi z kogoś członka. Kto opuści klan w grze, przy następnej synchronizacji zostaje oznaczony jako odszedł, a kto wróci, pojawia się przy kolejnej. Jego historia zostaje w obu przypadkach.',
        'Każde inne miejsce to miejsce **gościa**: kogoś, kto gra w twoich wydarzeniach, nie będąc w twoim klanie w grze. Goście są śledzeni i mogą brać udział w wydarzeniach. Nie są członkami i nie liczą się do twojego planu.',
      ],
      note: {
        tag: 'Logowanie nigdy nikogo nie dopisuje do składu',
        body: 'Logowanie przez Discorda, podłączenie postaci czy granie z pluginem nikomu nie daje miejsca. Jeśli plugin widzi kogoś, kto w grze jest w twoim klanie, ale nie ma go jeszcze w składzie, składa za niego prośbę (zobacz krok 3). Każdy inny ma po prostu konto Anvil bez klanu. To właśnie powstrzymuje obcego przed dołączeniem do twojego klanu przez wpisanie jego nazwy.',
      },
    },

    filters: {
      title: 'Jak czytać zakładkę Roster',
      intro:
        'Pasek na górze dzieli skład na **Members**, **Guests** i **Departed**. Kliknij fragment, żeby po nim filtrować. Etykiety pod spodem zawężają listę dalej:',
      rows: [
        {
          term: 'Active',
          body: 'członkowie wciąż w składzie. Goście i ci, którzy odeszli, są pominięci.',
        },
        {
          term: 'Quiet 7d+',
          body: 'członkowie, których plugin nie widział w grze od siedmiu dni lub dłużej. Kto nigdy nie używał pluginu, tu nie trafia, bo nie ma go po czym ocenić. Jego **Last played** pokazuje wtedy **no plugin data**.',
        },
        {
          term: 'Guests',
          body: 'obecne miejsca gości: ludzie, którzy grają w twoich wydarzeniach, ale nie są w twoim klanie w grze.',
        },
        {
          term: 'Roster only',
          body: 'obecni członkowie i goście, za którymi nie stoi jeszcze konto na stronie. To normalne u każdego, kto nigdy nie zalogował się przez Discorda. Zostają w składzie; logują się i podłączają postać, gdy chcą się na coś zapisać.',
        },
        {
          term: 'Departed',
          body: 'ludzie, którzy odeszli w grze albo których usunął sztab. Ich wyniki i historia zostają.',
        },
        {
          term: 'All',
          body: 'wszyscy powyżej.',
        },
      ],
      outro:
        'Kolumna **Source** mówi, jak zaczęło się każde miejsce: **Clan sync**, **Added manually** albo **Applied or self-reported**. **Last played** pochodzi z pluginu, nie z synchronizacji składu.',
      note: {
        tag: 'Ranga i rola to dwie różne rzeczy',
        body: 'Dwie listy rozwijane obok etykiet filtrują po randze w grze i po roli na stronie. Ranga to to, co zgłasza gra. Rola na stronie to to, co admin ustawi w **Staff & roles**. Jedno nigdy nie ustawia drugiego.',
      },
    },

    review: {
      title: 'Prośby o dołączenie i Needs review',
      intro: 'Na zgodę czekają dwa rodzaje ludzi i czekają na różnych zakładkach.',
      rows: [
        {
          term: 'Proszą o dołączenie',
          body: 'na górze zakładki **Roster**, widoczne tylko wtedy, gdy ktoś czeka. Prośba przychodzi ze strony (kliknął **Apply** na stronie twojego klanu albo próbował wejść do któregoś z twoich wydarzeń) albo z pluginu (widział go w grze w twoim klanie, zanim skład go miał). Każdy wiersz mówi, skąd przyszła i czy ta osoba jest członkiem innego klanu. **Approve** daje jej miejsce gościa. **Decline** informuje ją o tym, przez prywatną wiadomość na Discordzie, gdy twój bot może do niej napisać. Zaznacz kilka, żeby odpowiedzieć wszystkim naraz.',
        },
        {
          term: 'Czekają na potwierdzenie',
          body: 'w **Needs review**. Ludzie, którzy podłączyli jedną z postaci z twojego składu, zdobywając na niej XP, prosząc o to albo grając nią z pluginem. Mogą już grać, czekając. Sprawdź, czy nazwa z Discorda pasuje do postaci, i kliknij **Approve**. **Not our member** zdejmuje postać z twojej listy i zostawia ją właścicielowi. **Report to Anvil** jest na postać, która nie należy do tej osoby.',
        },
        {
          term: 'Prośby o przejęcie',
          body: 'również w **Needs review**. Ktoś grał postacią, która jest tu już ustalonym członkiem, więc Anvil sam jej do niego nie podłączył. Jeśli wiesz, że to on, kliknij **Yes, that’s them**; jeśli nie, **Not them**. Postać, która zawsze była tylko w twoim klanie, zostaje podłączona od razu. Taką, która jest też w innym klanie, rozstrzyga Anvil.',
        },
      ],
      note: {
        tag: 'Licznik nie liczy próśb o dołączenie',
        body: 'Liczba przy **Needs review** i przy **People** w pasku bocznym liczy Awaiting confirmation i Claim requests. Prośby o dołączenie się do niej nie wliczają, więc zaglądaj też na górę zakładki Roster.',
      },
    },

    policy: {
      title: 'Kto może dołączyć',
      intro:
        'Admin → People → **Who can join** ma trzy ustawienia, a zakładkę widzą tylko admini. O tym, jak wchodzą ludzie z zewnątrz, decyduje **Players from other clans**:',
      rows: [
        {
          term: 'Ask first',
          body: 'domyślne. Kto złoży prośbę albo kogo plugin wyłapie z twojego klanu w grze, czeka jako prośba o dołączenie, aż sztab go zatwierdzi. Nikt nie dostaje miejsca bez zgody.',
        },
        {
          term: 'Let anyone in',
          body: 'wystarczy poprosić. Od razu dostają miejsce gościa i żadna prośba nie powstaje. Dobre na otwarte wydarzenie, poza tym robi się tłoczno.',
        },
        {
          term: 'No guests',
          body: 'grają tylko twoi członkowie. Gracze z innych klanów nie mogą wejść do twoich wydarzeń ani poprosić o dołączenie, a plugin nic za nich nie składa.',
        },
      ],
      outro:
        '**Who can see this clan** to **Anyone** (link do planszy działa u każdego, komu go wyślesz) albo **Members only** (wszyscy inni widzą kartę klanu i zaproszenie do złożenia prośby). **List in the Clan Hall** umieszcza klan na publicznej liście klanów. Wyłączenie tego nie czyni klanu prywatnym.',
      note: {
        tag: 'Żadne z nich nie dotyczy twoich członków',
        body: 'Synchronizacja składu daje członkom miejsca bez względu na te ustawienia. Twój sztab też nigdy nie jest traktowany jak goście: postać członka sztabu dostaje miejsce członka bez prośby.',
      },
    },

    manual: {
      title: 'Ręczne dodawanie',
      body: [
        'Roster → **+ Add Manually** dopisuje do składu jedną postać. Wpisz **RSN**, a opcjonalnie **Discord ID** i **Rank**. Zaznacz **Add as guest** dla kogoś spoza twojego klanu w grze. Mogą to zrobić zarówno moderatorzy, jak i admini.',
        'Używaj tego dla kogoś, kogo synchronizacja jeszcze nie widzi, na przykład rekruta, który dołączył po ostatniej synchronizacji. Miejsce dostaje oznaczenie **Added manually**, a synchronizacja traktuje je jako twoją decyzję: jeśli później usuniesz miejsce dodane ręcznie, następna synchronizacja go nie przywróci.',
        'Dodanie kogoś do składu nie zapisuje go na wydarzenie. Do tego otwórz zakładkę **Sign-ups** wydarzenia i użyj **Add member**. To może zrobić tylko admin.',
      ],
    },

    removing: {
      title: 'Usuwanie i banowanie',
      intro: 'Każdy wiersz składu ma menu akcji. Każda robi co innego:',
      rows: [
        {
          term: 'Demote to guest',
          body: 'zostaje na liście i nadal można go wpisać do wydarzeń, ale przestaje liczyć się jako członek. **Promote to member** to odwraca.',
        },
        {
          term: 'Remove from roster',
          body: 'oznacza go jako tego, który odszedł. Jego historia i wyniki zostają. Jeśli wciąż jest w twoim klanie w grze, następna synchronizacja składu może go dodać z powrotem.',
        },
        {
          term: 'Not our member',
          body: 'w Needs review, dla postaci, którą ktoś podłączył, a która nie jest w twoim klanie. Schodzi z twojej listy i zostaje u właściciela.',
        },
        {
          term: 'Ban from this clan',
          body: 'kończy każde miejsce tej osoby tutaj, razem z altami, odbiera jej każdą rolę w sztabie i funkcje na planszach w tym klanie i nie pozwala jej wrócić: synchronizacja składu, plugin i prośby o dołączenie odrzucają ją, dopóki ban nie zostanie zdjęty. Jej konto Anvil i inne klany zostają nietknięte. Tylko admini, dla kogoś z kontem na stronie i rolą poniżej admina, z menu wiersza, ze **Staff & roles** albo dla kilku osób naraz. Zdjęcie bana nie przywraca miejsca; osoba wraca do klanu w grze albo ty ją dodajesz.',
        },
      ],
      note: {
        tag: 'Ban odbiera też rolę w sztabie',
        body: 'Ban kończy miejsca tej osoby i odbiera jej rolę w sztabie oraz wszystkie funkcje edytora i skarbnika planszy na planszach tego klanu. Zdjęcie bana ich nie przywraca: jeśli ma je mieć, nadaj rolę ponownie w Staff & roles.',
      },
    },

    faq: {
      title: 'Częste pytania',
      intro: 'Co zwykle tłumaczy, czemu ktoś jest nie tam, gdzie trzeba.',
      rows: [
        {
          term: 'Brakuje kogoś z klanu',
          body: 'Najpierw puść synchronizację składu: lista zmienia się tylko wtedy, gdy admin ją wyśle. Potem sprawdź **Departed**, na wypadek gdyby został usunięty, i czy nie ma bana; synchronizacja pomija każdego, kto ma tu bana, i podaje, kogo pominęła. Jeśli klan przekroczył plan, a okres karencji minął, synchronizacja przestaje dodawać nowych członków, dopóki nie podniesiesz planu albo nie odchudzisz składu.',
        },
        {
          term: 'Ktoś jest w klanie, a widać go jako gościa',
          body: 'Zwykle wciąż jest członkiem innego klanu w Anvil. Postać może być członkiem tylko jednego klanu naraz, więc synchronizacja sadza ją tu jako gościa i robi z niej członka przy pierwszej synchronizacji po opuszczeniu tamtego klanu. W przeciwnym razie przyszedł przez prośbę o dołączenie albo ktoś go zdegradował lub dodał jako gościa. Puść synchronizację albo użyj **Promote to member**.',
        },
        {
          term: 'Ktoś się zalogował, ale nie ma go w składzie',
          body: 'Tak ma być. Logowanie zakłada konto Anvil, nie miejsce. Pojawi się, gdy wymieni go synchronizacja, gdy zatwierdzisz jego prośbę albo gdy dodasz go ręcznie.',
        },
        {
          term: 'Nazwy w stylu #Player1234',
          body: 'RuneLite pokazuje taką zastępczą nazwę przez chwilę, gdy gracz się loguje, i dla członków klanu, których nie umie nazwać. Anvil teraz je ignoruje: synchronizacja je pomija, plugin nie składa za nie próśb, a stare prośby pod taką nazwą są ukryte. Jeśli któraś wciąż jest w twoim składzie, to stary wiersz. **Remove from roster** go usuwa.',
        },
        {
          term: 'Usunięty członek ciągle wraca',
          body: 'Usunięcie kogoś nie zmienia klanu w grze, więc następna synchronizacja dodaje go z powrotem, dopóki gra wciąż go wymienia. Usuń go w grze albo zbanuj tutaj.',
        },
        {
          term: 'Moderator nie widzi Who can join',
          body: 'To zakładka tylko dla adminów, tak jak Staff & roles. Zobacz [Role w sztabie: kto co może]({staffGuide}).',
        },
      ],
    },
  },

  staffRoles: {
    metaTitle: 'Role w sztabie: kto co może — Anvil',
    metaDescription:
      'Role w klanie w Anvil (właściciel, admin, skarbnik, moderator, członek), do czego każda ma dostęp, jak zrobić kogoś moderatorem, kto może nadać jaką rolę i funkcje obejmujące jedno wydarzenie.',
    eyebrow: 'Anvil · dla właścicieli i adminów',
    title: 'Role w sztabie: kto co może',
    dek: 'Pięć ról, ustawianych osobno dla każdego klanu w Admin → People → **Staff & roles**. Rola tutaj nie daje nic w żadnym innym klanie i nikt nie może nadać roli równej swojej ani wyższej. Ta strona to cała mapa: do czego sięga każda rola, jak ją nadać i jakie funkcje obejmują jedno wydarzenie.',
    facts: [
      { strong: 'Per klan', rest: 'rola tutaj nic nie znaczy gdzie indziej' },
      { strong: 'Poniżej twojej', rest: 'tylko takie role możesz nadać' },
      { strong: 'Właściciel', rest: 'zmienia się tylko przez przekazanie' },
    ],
    footnote:
      'Role są sprawdzane przy każdym wczytaniu strony, więc zmiana działa od następnego kliknięcia tej osoby; nie musi się wylogowywać. O samym składzie przeczytasz w [Twoi ludzie]({peopleGuide}). Dzień moderatora opisuje [Na dyżurze]({moderatorGuide}).',

    roles: {
      title: 'Role',
      intro: 'Każdy, kto loguje się przez Discorda, zaczyna jako zwykły **Member**. Powyżej:',
      rows: [
        {
          term: 'Właściciel',
          body: 'osoba, która założyła klan, dopóki go nie przekaże. Wszystko, co może admin, plus przekazanie własności i usunięcie klanu. Jest dokładnie jeden i nikt nie może go zdegradować, usunąć ani zbanować.',
        },
        {
          term: 'Admin',
          body: 'wszystko poza przekazaniem klanu: wydarzenia i plansze, ustawienia, Discord, sztab i pieniądze klanu.',
        },
        {
          term: 'Skarbnik',
          body: 'wpisowe, skarbiec i nagrody, a do tego wszystko, co robi moderator: skład, dowody, konkursy, harmonogram (Schedule) i Needs review.',
        },
        {
          term: 'Moderator',
          body: 'nowi, skład, dowody, tygodniowe konkursy i wydarzenia klanu. Żadnych wydarzeń ani plansz, żadnych ustawień, żadnego sztabu i żadnych pieniędzy.',
        },
        {
          term: 'Członek',
          body: 'bez funkcji w sztabie. Gra, zapisuje się i może zgłosić wpłatę do skarbca.',
        },
      ],
      outro:
        'Pod rolą w Staff & roles są dwa pola wyboru dla każdego poniżej admina, także zwykłych członków. **Can build bingo boards** otwiera zakładkę Tiles każdej planszy i Task library. **Can write guides** pozwala pisać poradniki klanu. Admini mają oba z góry.',
    },

    assign: {
      title: 'Jak zrobić kogoś moderatorem',
      intro:
        'Ta osoba musi być zalogowana przez Discorda i mieć podłączoną postać, która jest w twoim składzie, jako członek albo gość. Potem:',
      steps: [
        'Otwórz Admin → **People** → **Staff & roles**.',
        'Lista otwiera się na **Staff**. Przełącz na **Members** albo **All accounts** i wyszukaj jej nazwę.',
        'W kolumnie **Role** wybierz **Moderator: newcomers, roster, sign-ups, proofs**. Zapisuje się od razu po wyborze.',
        'Jeśli ma też budować plansze, zaznacz **Can build bingo boards**.',
      ],
      outro:
        'Jeszcze się nie zalogowała? Znajdź jej postać w zakładce **Roster**, otwórz jej menu i wybierz **Set role**. Rola zapisuje się przy postaci. Osoba dostaje ją przy pierwszym logowaniu i podłączeniu tej postaci albo, jeśli czeka w Needs review, gdy moderator ją zatwierdzi.',
      note: {
        tag: 'Odbieranie roli',
        body: 'Ustaw rolę z powrotem na **Member**. Zmiana czyjejś roli usuwa też wszystkie jego funkcje na planszach tego klanu (zobacz krok 5), więc dodaj je potem ponownie, jeśli ma je zachować.',
      },
    },

    who: {
      title: 'Kto może nadać co',
      intro:
        'Staff & roles to zakładka tylko dla adminów, a każda zmiana na niej jest sprawdzana według dwóch zasad: możesz nadać tylko rolę niższą od swojej i możesz zmienić tylko kogoś, kto ma rolę niższą od twojej.',
      rows: [
        {
          term: 'Właściciel',
          body: 'może nadawać i odbierać role admina, skarbnika i moderatora.',
        },
        {
          term: 'Admin',
          body: 'może nadawać i odbierać role skarbnika i moderatora. Admin nie może zrobić kolejnego admina, zmienić innego admina ani zmienić własnej roli.',
        },
        {
          term: 'Skarbnicy i moderatorzy',
          body: 'nie mogą zmienić nikomu roli. Ta zakładka jest przed nimi ukryta.',
        },
        {
          term: 'Nikt',
          body: 'nie może zmienić roli właściciela, usunąć go ani zbanować. Klan zawsze ma też co najmniej jednego admina: ostatniego nie da się zdegradować.',
        },
      ],
      note: {
        tag: 'Przekazanie klanu',
        body: 'Może to zrobić tylko właściciel i tylko komuś, kto już jest adminem: wiersz tego admina dostaje akcję **Make owner**. On zostaje właścicielem, a ty zwykłym adminem. Sam tego nie cofniesz; przekazać klan z powrotem może tylko nowy właściciel.',
      },
    },

    table: {
      title: 'Kto co może',
      intro:
        'Do czego sięga każda rola w panelu administracyjnym. „Jeśli zaznaczone” oznacza pole **Can build bingo boards** albo **Can write guides** w Staff & roles.',
      areaLabel: 'Obszar',
      columns: ['Właściciel', 'Admin', 'Skarbnik', 'Moderator', 'Członek'],
      rows: [
        { area: 'Pulpit', cells: ['Tak', 'Tak', 'Tak', 'Tak', 'Nie'] },
        { area: 'Wydarzenia: tworzenie, edycja, drużyny, zapisy, start', cells: ['Tak', 'Tak', 'Nie', 'Nie', 'Nie'] },
        { area: 'Pola planszy i Task library', cells: ['Tak', 'Tak', 'Jeśli zaznaczone', 'Jeśli zaznaczone', 'Jeśli zaznaczone'] },
        { area: 'Dowody do sprawdzenia', cells: ['Tak', 'Tak', 'Tak', 'Tak', 'Nie'] },
        { area: 'Tygodniowe konkursy', cells: ['Tak', 'Tak', 'Tak', 'Tak', 'Nie'] },
        { area: 'Wydarzenia klanu', cells: ['Tak', 'Tak', 'Tak', 'Tak', 'Nie'] },
        { area: 'Harmonogram (Schedule)', cells: ['Tak', 'Tak', 'Tak', 'Tak', 'Nie'] },
        { area: 'Skład: podgląd, dodawanie, usuwanie', cells: ['Tak', 'Tak', 'Tak', 'Tak', 'Nie'] },
        { area: 'Prośby o dołączenie i Needs review', cells: ['Tak', 'Tak', 'Tak', 'Tak', 'Nie'] },
        { area: 'Ban w klanie', cells: ['Tak', 'Poniżej admina', 'Nie', 'Nie', 'Nie'] },
        { area: 'Staff & roles', cells: ['Tak', 'Poniżej admina', 'Nie', 'Nie', 'Nie'] },
        { area: 'Who can join', cells: ['Tak', 'Tak', 'Nie', 'Nie', 'Nie'] },
        { area: 'Skarbiec i drabinki nagród', cells: ['Tak', 'Tak', 'Tak', 'Nie', 'Nie'] },
        { area: 'Wpisowe: oznaczanie jako zebrane', cells: ['Tak', 'Tak', 'Tak', 'Nie', 'Nie'] },
        { area: 'Wpisowe: potwierdzanie (drugi podpis)', cells: ['Tak', 'Tak', 'Nie', 'Nie', 'Nie'] },
        { area: 'Ustawienia Discorda', cells: ['Tak', 'Tak', 'Nie', 'Nie', 'Nie'] },
        { area: 'Publikowanie na Discordzie', cells: ['Tak', 'Tak', 'Nie', 'Nie', 'Nie'] },
        { area: 'Ustawienia klanu: Profile, Features, Rules & scoring, Boosts', cells: ['Tak', 'Tak', 'Nie', 'Nie', 'Nie'] },
        { area: 'Plan i płatności', cells: ['Tak', 'Tak', 'Nie', 'Nie', 'Nie'] },
        { area: 'Poradniki', cells: ['Pisanie', 'Pisanie', 'Czytanie; pisanie, jeśli zaznaczone', 'Czytanie; pisanie, jeśli zaznaczone', 'Pisanie, jeśli zaznaczone'] },
        { area: 'Activity log', cells: ['Tak', 'Tak', 'Tak', 'Tak', 'Nie'] },
        { area: 'Synchronizacja składu z RuneLite', cells: ['Tak', 'Tak', 'Nie', 'Nie', 'Nie'] },
        { area: 'Przekazanie własności, usunięcie klanu', cells: ['Tak', 'Nie', 'Nie', 'Nie', 'Nie'] },
      ],
      note: {
        tag: 'Ukryte to nie to samo co dozwolone',
        body: 'Pasek boczny pokazuje tylko to, czego twoja rola może używać, ale sprawdzenie, które naprawdę się liczy, odbywa się na serwerze. Wpisanie adresu strony niedostępnej dla twojej roli odsyła cię na pulpit, a akcja za nią zostaje odrzucona.',
      },
    },

    event: {
      title: 'Funkcje w jednym wydarzeniu',
      intro:
        'Niektóre funkcje obejmują jedno wydarzenie, a nie cały klan. Admin nadaje je w samym wydarzeniu i sięgają one tylko do tego wydarzenia, więc można je bezpiecznie dać zwykłemu członkowi.',
      rows: [
        {
          term: 'Edytor planszy',
          body: 'buduje i edytuje pola tej planszy. Nadawany w **Settings** wydarzenia → **Staff** → **Board staff** albo przez **Boards…** w akcjach danej osoby w Staff & roles. Członek z taką funkcją widzi w panelu administracyjnym tylko swoje plansze.',
        },
        {
          term: 'Skarbnik planszy',
          body: 'zbiera wpisowe tej planszy i prowadzi jej wypłaty, bez dostępu do skarbca klanu. W panelu administracyjnym widzi tylko swoje plansze, a w każdej tylko zakładki **Sign-ups** i **Prizes**. Też nadawany w **Board staff**.',
        },
        {
          term: 'Sztab drużyny',
          body: 'prowadzi jedną drużynę: jej skład, jej zgłoszenia i dowody oraz oznaczanie wpisowego jej graczy jako zapłaconego. Nie może ruszać innej drużyny, edytować planszy, wybierać w drafcie ani nikogo zmieniać, gdy wydarzenie już trwa. Dodawany na stronie drużyny w **Team staff**. Tak moderator klanu z zewnątrz prowadzi swoją połowę meczu klan kontra klan.',
        },
        {
          term: 'Kapitan',
          body: 'wskazany przez gospodarza dla jednej drużyny. Wszystko, co może sztab drużyny, plus wybory drużyny w drafcie.',
        },
      ],
      note: {
        tag: 'Rola w klanie zastępuje funkcje na planszach',
        body: 'Nadanie komuś roli w klanie albo jej zmiana usuwa jego funkcje edytora planszy i skarbnika planszy na planszach tego klanu. Staff & roles najpierw ostrzega, gdy funkcje na planszach to wszystko, co ta osoba ma. Dodaj je potem ponownie, jeśli ma je zachować.',
      },
    },

    safety: {
      title: 'Bezpieczeństwo',
      intro: 'To obowiązuje bez względu na to, jak ustawione są role.',
      rows: [
        {
          term: 'Właściciel jest chroniony',
          body: 'jego wiersz w Staff & roles pokazuje **Protected**. Jego roli nie da się zmienić i nie można go zbanować. Własność przechodzi tylko wtedy, gdy sam ją przekaże.',
        },
        {
          term: 'Admini nie mogą usuwać siebie nawzajem',
          body: 'admin nie może ani zdegradować, ani zbanować innego admina, ani pojedynczo, ani kilku naraz. Gdy dwóch adminów się nie zgadza, decyduje właściciel. Ban odbiera też danej osobie rolę w sztabie i funkcje na planszach w tym klanie.',
        },
        {
          term: 'Pieniądze wymagają dwóch osób',
          body: 'gdy wpisowe wymaga potwierdzenia, potwierdzenie musi przyjść od innego admina niż ten, kto oznaczył je jako zebrane. Ile potwierdzeń wymaga wpisowe, od zera do pięciu, ustawia się w **Clan settings** → **Rules & scoring** → **Fee sign-off**. Admin, który jako jedyny zajmuje się pieniędzmi, może nadal wymusić zamknięcie wpisowego osobnym przyciskiem.',
        },
        {
          term: 'Czego moderator nie może',
          body: 'tworzyć ani edytować wydarzeń, zmieniać ustawień ani Discorda, nadawać nikomu roli (sobie też nie) ani ruszać pieniędzy klanu.',
        },
        {
          term: 'Wszystko jest zapisane',
          body: 'zmiany ról, przekazania własności, bany i rozpatrzone prośby o dołączenie trafiają do **Activity log**, który może czytać każdy członek sztabu.',
        },
        {
          term: 'Role na Discordzie to osobna sprawa',
          body: 'synchronizacja ról w Anvil dopasowuje role na Discordzie do **rang w grze**, nie do ról na stronie. Zrobienie kogoś moderatorem tutaj nie daje mu nic na twoim serwerze Discord, a rola moderatora nadana ręcznie na Discordzie zostaje nietknięta. Jedyna komenda bota, która cokolwiek zmienia, czyli dodawanie do skarbca przez `/coffer`, sprawdza rolę na stronie: skarbnik, admin albo właściciel.',
        },
      ],
    },
  },

  supporter: {
    metaTitle: 'Anvil Supporter: pakiety i korzyści — Anvil',
    metaDescription:
      'Co dostają Anvil Supporter, Champion i Patron: kolory nazwy i gwiazdkę, złote GZ, animowany awatar i baner, gablotę, wydarzenia dla znajomych, pojedynki, czat wydarzenia i boosty klanu. Jak działają płatności przez Gumroad i co się dzieje po rezygnacji.',
    eyebrow: 'Anvil · dla graczy',
    title: 'Anvil Supporter: pakiety i korzyści',
    dek: 'Anvil Supporter to osobista subskrypcja, która opłaca serwery Anvil. Ma trzy pakiety, a każdy zawiera wszystko, co ten niżej. Każda korzyść to wygląd albo więcej miejsca na organizowanie: śledzenie, wydarzenia, punktacja i twoje własne statystyki zostają darmowe dla wszystkich, a nic tutaj nie zmienia tego, co liczy wydarzenie.',
    facts: [
      { strong: 'Od $1 miesięcznie', rest: 'albo $10 rocznie' },
      { strong: 'Tylko wygląd', rest: 'nigdy wynik, ranga ani przedmiot' },
      { strong: 'Nic nie znika', rest: 'gdy przestaniesz' },
    ],
    footnote:
      'Wszystko to ustawiasz na stronie w **Settings** → **Supporter**, **Profile look** i **Clan boosts**. Boosty szczegółowo opisuje [Boostowanie klanu]({boostsGuide}). Gdzie twoje kolory widać w RuneLite, opisuje [Panel boczny, zakładka po zakładce]({panelGuide}).',

    tiers: {
      title: 'Trzy pakiety',
      intro: 'Ceny są na stronie **Anvil Supporter**, `/supporter`. Plan roczny kosztuje tyle, co dziesięć miesięcy.',
      rows: [
        {
          term: 'Supporter',
          body: '$1 miesięcznie albo $10 rocznie. Złota nazwa i gwiazdka, złote GZ, gablota z 4 miejscami i możliwość zorganizowania wydarzenia dla znajomych.',
        },
        {
          term: 'Champion',
          body: '$2 miesięcznie albo $20 rocznie. Gradient nazwy z naszych gotowych zestawów (albo jeden własny kolor), własny awatar i baner (animowane, jeśli chcesz), 8 miejsc w gablocie, szybszy czat wydarzenia i 1 boost klanu.',
        },
        {
          term: 'Patron',
          body: '$5 miesięcznie albo $50 rocznie. Własny ruchomy gradient z maksymalnie 4 kolorów, 12 miejsc w gablocie, brak czekania na czacie wydarzenia, 2 wydarzenia dla znajomych naraz i 2 boosty klanu.',
        },
      ],
      note: {
        tag: 'Czas za zaproszenia',
        body: 'W Settings → Supporter dostajesz link z zaproszeniem. Gdy zaproszony przez ciebie znajomy zapłaci, zdobywasz darmowe miesiące; nagroda przychodzi dwa tygodnie po jego pierwszej płatności. Czas zdobyty w ten sposób daje wszystkie korzyści danego pakietu poza boostami klanu.',
      },
    },

    compare: {
      title: 'Co daje każdy pakiet',
      intro: 'Ta sama tabela co na stronie Supporter, plus korzyści na czacie.',
      table: {
        areaLabel: 'Korzyść',
        columns: ['Za darmo', 'Supporter', 'Champion', 'Patron'],
        rows: [
          { area: 'Kolory nazwy', cells: ['—', 'Złoty', 'Gotowe zestawy albo jeden własny kolor', 'Gotowe zestawy albo do czterech kolorów, ruchome'] },
          { area: 'Gwiazdka przy nazwie', cells: ['—', 'Tak', 'Tak', 'Tak'] },
          { area: 'Złote GZ', cells: ['—', 'Tak', 'Tak', 'Tak'] },
          { area: 'Własny awatar i baner, animowane', cells: ['—', '—', 'Tak', 'Tak'] },
          { area: 'Gablota', cells: ['—', '4 miejsca', '8 miejsc', '12 miejsc'] },
          { area: 'Wydarzenia dla znajomych (naraz · graczy)', cells: ['Tylko dołączanie', '1 · 10', '1 · 25', '2 · 50'] },
          { area: 'Pojedynki jeden na jednego', cells: ['1 aktywny', '5 aktywnych', 'Bez limitu', 'Bez limitu'] },
          { area: 'Czat wydarzenia: przerwa między wiadomościami', cells: ['5 s', '3 s', '1 s', 'Brak'] },
          { area: 'Boosty klanu', cells: ['—', '—', '1', '2'] },
        ],
      },
      outro:
        'W **Settings** → **In-game chat** są jeszcze trzy: własne kolory feedu na czacie (Supporter), wybór, co obejmuje podsumowanie po zalogowaniu (Champion), oraz gwiazdka przy twojej nazwie w feedach na czacie innych graczy (Patron).',
    },

    names: {
      title: 'Kolory nazwy',
      intro:
        'Ustawiasz je w **Settings** → **Supporter**, w sekcji **Your name’s look**. Podgląd pokazuje twoją nazwę na ciemnym i na jasnym tle.',
      rows: [
        {
          term: 'Supporter',
          body: 'jednolite złoto. Nie ma czego wybierać.',
        },
        {
          term: 'Champion',
          body: 'jeden z gotowych gradientów (**Classic**, domyślny, **Ember**, **Ocean**, **Aurora**, **Rose gold** albo **Toxic**) albo **Your own**: jeden nieruchomy kolor. Na wszystkich twoich postaciach możesz użyć najwyżej dwóch różnych własnych kolorów.',
        },
        {
          term: 'Patron',
          body: 'wszystkie gotowe zestawy plus **Prism**, domyślny dla Patronów, albo **Your own** z jednym do czterech kolorów. Jeden kolor stoi w miejscu; od dwóch do czterech tworzy gradient, który przesuwa się od lewej do prawej.',
        },
      ],
      outro:
        '**Your Anvil display name** to nazwa twojego konta połączonego z Discordem. W **Your RuneScape characters** wybierz **Same for all** albo **Customize each**, żeby dać każdej postaci własny wygląd. Naciśnij **Save** (albo **Save for all characters**); **Reset to default** przywraca kolory twojego pakietu.',
      note: {
        tag: 'Ciemne i jasne tła',
        body: 'Strona, panel pluginu i Discord są ciemne; nieprzezroczyste okno czatu w grze jest jasne. Anvil dopasowuje twoje kolory, żeby na każdym z nich były czytelne. Jeśli chcesz na którymś inny wygląd, włącz **Set a separate look for dark backgrounds** albo **for light backgrounds**. Taki wygląd jest pokazywany dokładnie tak, jak go wybrałeś, bez korekty kontrastu, a podgląd ostrzega, gdy trudno go odczytać.',
      },
    },

    where: {
      title: 'Gdzie widać twoje kolory',
      intro: 'Twoje kolory i gwiazdka idą wszędzie tam, gdzie twoja nazwa:',
      rows: [
        {
          term: 'Na stronie',
          body: 'plansze, składy, profile, twoja własna nazwa na górnym pasku i nazwy twoich postaci. Gwiazdka nosi twoje kolory.',
        },
        {
          term: 'W panelu pluginu',
          body: 'Feed, czat wydarzenia, karty i wiersz **Tracking**. Gradient Patrona przesuwa się; każdy gracz może go zatrzymać opcją **Animated names**.',
        },
        {
          term: 'W grze',
          body: 'dla innych graczy, którzy używają pluginu Anvil: czat publiczny, klanowy, znajomych i prywatny, ogłoszenia klanu, powiadomienia o logowaniu, listy znajomych i klanu oraz menu pod prawym przyciskiem (nigdy na światach PvP ani w Wilderness). Na czacie w grze gwiazdka przysługuje Patronom.',
        },
        {
          term: 'Na Discordzie',
          body: 'gwiazdka przy twojej nazwie w postach Anvil, w twoich własnych kolorach, jeśli jakieś wybrałeś.',
        },
        {
          term: 'Złote GZ',
          body: 'przy dropie kogoś z klanu w feedzie twojego klanu na stronie twoje GZ może być złote. Dać je mogą tylko Supporterzy.',
        },
      ],
      note: {
        tag: 'Tylko na postaciach potwierdzonych jako twoje',
        body: 'Kolory widać tylko na postaciach, które plugin potwierdził jako twoje, na stronie i w grze. Żeby nie pokazywały się przy twoich nazwach na czacie u innych graczy, odznacz **Show my colours on my characters’ names in game chat** w Settings → Supporter.',
      },
    },

    profile: {
      title: 'Awatar, baner i gablota',
      intro: 'Wszystkie trzy są w **Settings** → **Profile look**.',
      rows: [
        {
          term: 'Awatar i baner',
          body: 'Champion i Patron. Wgraj własne; GIF albo WebP zostaje animowany. Widać je na twojej karcie, profilu i każdej twojej postaci, na stronie i w pluginie. Baner może mieć do 6 MB i co najmniej 600×150; awatar do 2 MB.',
        },
        {
          term: 'Dla każdej postaci',
          body: 'daj jednej postaci własny baner albo awatar, albo jedno i drugie. Zastępuje twój domyślny tylko na stronach tej postaci i na jej karcie w pluginie.',
        },
        {
          term: 'Gablota',
          body: 'twoje najlepsze dropy, liczby zabójstw i czasy przypięte do profilu: 4 miejsca dla Supportera, 8 dla Championa, 12 dla Patrona. Przypięcia z postaci, których nie udostępniasz, pozostają prywatne.',
        },
      ],
    },

    hosting: {
      title: 'Wydarzenia dla znajomych, pojedynki i czat',
      intro: 'Korzyści, które dają ci więcej miejsca na granie, a nie wygląd:',
      rows: [
        {
          term: 'Wydarzenia dla znajomych',
          body: 'zorganizuj własne bingo, bingo solo albo wyścig dla znajomych przez **Host an event for your friends**, śledzone przez plugin jak wydarzenie klanu. Znajomi dołączają przez twój link z zaproszeniem. Supporter: 1 trwające wydarzenie, 10 graczy. Champion: 1 wydarzenie, 25 graczy. Patron: 2 naraz, łącznie 50 graczy. Dołączyć może każdy.',
        },
        {
          term: 'Pojedynki',
          body: 'wyzwij znajomego z jego profilu: kto pierwszy zdobędzie drop albo kto ma najwięcej zabójstw lub XP w 1 godzinę, 24 godziny albo 7 dni. Tylko dla chwały. Darmowi gracze mogą mieć 1 otwarty naraz, Supporterzy 5, Championi i Patroni ile chcą.',
        },
        {
          term: 'Czat wydarzenia',
          body: 'jak długo czekasz między wiadomościami: 5 sekund bez pakietu, 3 dla Supporterów, 1 dla Championów, wcale dla Patronów. Gdy na czacie planszy robi się tłoczno, wszyscy czekają 10 sekund, Patroni też.',
        },
        {
          term: 'Boosty klanu',
          body: 'Champion 1, Patron 2, dopóki płacisz. Zobacz [Boostowanie klanu]({boostsGuide}).',
        },
      ],
    },

    billing: {
      title: 'Płacenie, zmiana i rezygnacja',
      intro: 'Za Anvil Supporter płacisz przez Gumroad, miesięcznie albo rocznie.',
      steps: [
        'Zaloguj się w Anvil i otwórz `/supporter`.',
        'Naciśnij **Choose Supporter**, **Choose Champion** albo **Choose Patron**. Otwiera się kasa Gumroad z płatnością miesięczną albo roczną.',
        'Zapłać. Korzyści włączają się, gdy tylko Gumroad powiadomi Anvil, a twój pakiet pojawia się na stronie Supporter jako **Your tier**.',
      ],
      outro:
        'Żeby zmienić pakiet, użyj **Change tier** w Settings → Supporter. Żeby zrezygnować albo zmienić kartę, użyj tam **Manage on Gumroad**. Anulowane członkostwo zachowuje wszystkie korzyści do końca opłaconego okresu.',
      note: {
        tag: 'Zawsze zaczynaj od /supporter',
        body: 'Przycisk **Choose** niesie kod, który mówi Anvil, które konto zapłaciło. Anvil nigdy nie dopasowuje płatności po adresie e-mail, więc zakup bezpośrednio w Gumroad, bez tego przycisku, zostawia płatność niepowiązaną. Jeśli tak się stało, zapytaj na Discordzie Anvil, a sztab ręcznie przypisze ją do twojego konta.',
      },
    },

    lapse: {
      title: 'Niższy pakiet albo koniec subskrypcji',
      intro:
        'Nic z tego, co ustawiłeś, nie jest usuwane. Każda korzyść jest sprawdzana względem pakietu, który masz w tej chwili, więc wyłącza się sama i wraca, gdy tylko odnowisz.',
      rows: [
        {
          term: 'Kolory nazwy',
          body: 'twój zapisany wybór zostaje. Nosisz kolory nowego pakietu albo żadne, dopóki nie wróci pakiet, który na to pozwala.',
        },
        {
          term: 'Awatar i baner',
          body: 'poniżej Championa pokazują swoją pierwszą, nieruchomą klatkę zamiast się ruszać.',
        },
        {
          term: 'Gablota',
          body: 'pokazuje pierwsze przypięcia, na które pozwala twój pakiet, a resztę ukrywa. Bez pakietu jest ukryta; przypięcia na ciebie czekają.',
        },
        {
          term: 'Boosty klanu',
          body: 'twoje najstarsze boosty dalej się liczą, a reszta jest wstrzymana, nie usunięta.',
        },
      ],
      note: {
        tag: 'Tymczasowe podwyższenie od sztabu Anvil',
        body: 'Sztab może dać komuś na jakiś czas wyższy pakiet, na przykład w podziękowaniu. Działa ono ponad tym, za co płacisz, i nigdy nie zmienia twojej subskrypcji. Settings → Supporter pokazuje **A gift from Anvil** i kiedy się kończy; potem wracasz do opłacanego pakietu. Taki prezent daje miejsca na boosty klanu tylko wtedy, gdy sztab je uwzględni.',
      },
    },
  },

  sidePanel: {
    metaTitle: 'Panel boczny Anvil, zakładka po zakładce — Anvil',
    metaDescription:
      'Co pokazuje każda zakładka panelu bocznego Anvil w RuneLite (Clan, Feed, You, Lookup i zębatka), jak działają czat wydarzenia i reakcje w Feed oraz ustawienia pluginu dla feedu na czacie w grze, kolorów Supporterów i animowanych nazw.',
    eyebrow: 'Anvil · dla graczy',
    title: 'Panel boczny, zakładka po zakładce',
    dek: 'Przycisk Anvil na pasku bocznym RuneLite otwiera panel z czterema zakładkami i zębatką: **Clan**, **Feed**, **You**, **Lookup** i ⚙. Większość tego, co pokazuje, przychodzi ze strony, więc jest aktualne bez aktualizacji pluginu. Kilka rzeczy poniżej oznaczono jako nadchodzące w następnej aktualizacji pluginu.',
    facts: [
      { strong: 'Cztery zakładki', rest: 'i zębatka do synchronizacji i ustawień' },
      { strong: 'Czat wydarzenia', rest: 'w zakładce Feed' },
      { strong: 'GZ, Sad, Sit', rest: 'przy wierszach Feed' },
    ],
    footnote:
      'Instalację pluginu i logowanie opisuje [poradnik konfiguracji pluginu RuneLite]({pluginGuide}). Kolory Supporterów, gwiazdkę i korzyści na czacie wyjaśnia [Anvil Supporter: pakiety i korzyści]({supporterGuide}).',

    header: {
      title: 'Góra panelu',
      intro: 'Nad zakładkami są tytuł, **Refresh** i wiersz konta.',
      rows: [
        {
          term: 'Refresh',
          body: 'przeładowuje panel, razem z zakładką Feed. W trakcie pokazuje **Refreshing…**. W następnej aktualizacji pluginu przeładowuje też You i Lookup, więc nowy awatar albo baner pojawia się od razu, i nie czyści już zakładki Feed.',
        },
        {
          term: 'Tracking',
          body: 'wiersz pod tytułem pokazuje śledzoną postać, w jej kolorach Supportera, jeśli je ma. **Not my account…** przestaje śledzić postać, którą na tym komputerze gra ktoś inny; **Track again** to cofa.',
        },
        {
          term: 'Menu konta',
          body: 'link ⋯ otwiera **View my profile on Anvil**, **Not my account…** i **Sign out…**. W następnej aktualizacji pluginu ma też **Become a Supporter** albo **Your Supporter perks**, jeśli już nim jesteś.',
        },
        {
          term: 'Postępy sezonu',
          body: 'w następnej aktualizacji pluginu, na światach Leagues, Deadman i innych sezonowych, pojawia się wiersz **Sharing season progress · Turn off**. Wysyła on twoje relikty, obszary i zadania (ze zrzutem ekranu) do twojego klanu; twój klan wybiera na stronie, co zostanie opublikowane. **Turn on** znów to udostępnia. Ten sam przełącznik to **Share seasonal activity** w ustawieniach pluginu.',
        },
      ],
    },

    clan: {
      title: 'Clan',
      intro:
        'Twoje wydarzenia i twój klan. W przestrzeni twórcy zakładka nazywa się **Space**.',
      rows: [
        {
          term: 'Lista wyboru klanu',
          body: 'widoczna, gdy grasz w więcej niż jednym klanie albo przestrzeni. **All clans** (domyślnie) pokazuje wszystko, w czym grasz, z trwającym wydarzeniem na początku. Wybranie jednego klanu zawęża do niego panel i tam trafiają twoje zgłoszenia.',
        },
        {
          term: 'Wydarzenia',
          body: 'każda trwająca i nadchodząca plansza, Skill albo Boss of the Week i wydarzenie klanu, z twoją pozycją. Dalej **Your other boards**, **Also live** i **Your clan**.',
        },
        {
          term: 'Plansza',
          body: 'otwórz ją, żeby zobaczyć ranking, drużyny, misje, ostatnią aktywność, najbliższe pola i **View all tiles**. Jej przyciski **Feed** i **Chat** otwierają tę planszę w zakładce Feed.',
        },
        {
          term: 'Wydarzenie klanu',
          body: '**I’m going**, **Sign me up** albo **Answer the survey**, zależnie od wydarzenia.',
        },
      ],
    },

    feed: {
      title: 'Feed',
      intro:
        'Wielkie chwile twojego klanu i twoich plansz, na żywo: dropy, pety, osiągnięcia, questy, śmierci i ukończone pola.',
      rows: [
        {
          term: 'Czyj feed',
          body: 'lista na górze pokazuje **Clan ·** każdy klan, którego jesteś członkiem, i **Event ·** każdą trwającą planszę, na której jesteś. Otwiera się na twojej planszy, jeśli ją masz, a inaczej na twoim klanie.',
        },
        {
          term: 'Filtry',
          body: '**All**, **Tiles** (tylko plansze), **Drops**, **Pets**, **Achievements**, **Deaths** oraz **My team** na planszy, na której jesteś w drużynie. Feed klanu ma też przycisk aktywności trybów gry dla Leagues i innych trybów.',
        },
        {
          term: 'Nowe wiersze',
          body: 'pojawiają się same. Jeśli przewinąłeś gdzie indziej, pigułka **↑ N new** zabierze cię z powrotem.',
        },
      ],
      note: {
        tag: 'To nie to samo co feed na czacie w grze',
        body: 'Zakładka Feed działa bez względu na ustawienia pluginu. **Show feed in game chat** (krok 8) to osobne ustawienie, które dodatkowo wypisuje feed w oknie czatu.',
      },
    },

    reactions: {
      title: 'Reakcje',
      intro: 'Każdy wiersz w Feed ma pod sobą swoją reakcję:',
      rows: [
        {
          term: 'GZ',
          body: 'przy dropach, petach i osiągnięciach. Obok widać licznik, na przykład **GZ 3**.',
        },
        {
          term: 'Sad i Sit',
          body: 'przy śmierciach, zamiast GZ. Sit to sposób gry na powiedzenie komuś, kto zginął, żeby usiadł.',
        },
        {
          term: 'Kto może reagować',
          body: 'w feedzie klanu – członkowie klanu. Na planszy – jej gracze i sztab gospodarza; gdy plansza ukrywa ranking, gracze mogą reagować tylko na wiersze własnej drużyny.',
        },
        {
          term: 'Kto zareagował',
          body: 'najedź na reakcję, żeby zobaczyć nazwy, na przykład „GZ · Mossy and 3 others”. Kliknij ją ponownie, żeby cofnąć swoją.',
        },
      ],
      note: {
        tag: 'W następnej aktualizacji pluginu',
        body: 'Reakcje stają się przyciskami-pigułkami, podświetlonymi, gdy któraś jest twoja, a reakcje innych aktualizują się na żywo u wszystkich, którzy patrzą, także w twoich innych otwartych klientach. Dziś licznik zmienia się, gdy reagujesz albo gdy Feed się przeładuje. Złote GZ, reakcję Supporterów, daje się w feedach na stronie; zakładka Feed ma GZ, Sad i Sit.',
      },
    },

    chat: {
      title: 'Czat wydarzenia',
      intro:
        'Plansza z włączonym czatem ma przełącznik **Feed / Chat** na górze zakładki Feed, dla graczy tej planszy i sztabu gospodarza. Strona planszy w zakładce Clan też ma przycisk **Chat**.',
      rows: [
        {
          term: 'Wszyscy albo twoja drużyna',
          body: '**All** pisze do całej planszy, **My team** tylko do twojej drużyny (te wiadomości są oznaczone **TEAM**). Sztab widzi też **Host & mods**, a jego wiadomości są oznaczone **HOST** albo **MOD**.',
        },
        {
          term: 'Wysyłanie',
          body: 'wpisz w pole i naciśnij Enter. Wiadomość może mieć do 200 znaków, a linki mogą wysyłać tylko gospodarz i modzi.',
        },
        {
          term: 'Jak często',
          body: 'przerwa między twoimi wiadomościami zależy od pakietu Supportera: 5 sekund bez pakietu, 3 dla Supporterów, 1 dla Championów, żadnej dla Patronów. Wiersz pod polem mówi, jaka jest twoja. Sztab nigdy nie czeka.',
        },
        {
          term: 'Tryb powolny',
          body: 'gdy na czacie planszy robi się bardzo tłoczno, wszyscy przez minutę czekają co najmniej 10 sekund, Patroni też. Nikt nie może wysłać więcej niż 10 wiadomości w 10 sekund.',
        },
        {
          term: 'Moderacja',
          body: 'gospodarz i modzi mogą kliknąć wiadomość prawym przyciskiem, żeby wybrać **Delete message** albo **Mute** dla kogoś, i wstrzymać cały czat przez **Pause chat (read-only for everyone)**.',
        },
      ],
      outro:
        'Seria wiadomości jednej osoby ma wspólną nazwę i godzinę, dopóki nie pojawi się 5-minutowa przerwa. Czat jest przechowywany przez 7 dni po końcu wydarzenia.',
    },

    you: {
      title: 'You i Lookup',
      intro: 'Dwie zakładki z kartami graczy: twoją i każdego innego.',
      rows: [
        {
          term: 'You',
          body: 'twoja własna karta dla postaci, na której jesteś zalogowany: baner i awatar, **Display case**, collection log aż po przedmioty z każdej strony oraz **Skills**, **Bosses**, **Clues**, **Times** i **CAs**. Pod nią każde czekające na ciebie wyzwanie **Head-to-head** (**Accept** albo **Decline**) i twoje **Goals**, z **+ Add goal**.',
        },
        {
          term: 'Lookup',
          body: 'przełącz między **Players** i **Clans**, wpisz nazwę i naciśnij Enter. **Recent** pokazuje kilka ostatnich wyszukiwań. Kliknij kogokolwiek w grze prawym przyciskiem i wybierz **Anvil**, żeby trafić tutaj.',
        },
        {
          term: 'Porównanie',
          body: 'na czyjejś karcie **Compare with me** zestawia was obu umiejętność po umiejętności, boss po bossie i strona po stronie. Karta klanu ma **Compare with my clan**.',
        },
      ],
    },

    gear: {
      title: 'Zakładka z zębatką',
      intro: 'Synchronizacja i ustawienia, a nie rzeczy do oglądania:',
      rows: [
        {
          term: 'Sync profile',
          body: 'wysyła do Anvil twój collection log i najlepsze czasy.',
        },
        {
          term: 'Sync clan roster',
          body: 'tylko dla adminów klanu: wysyła na stronę listę członków klanu z gry. Jeśli plugin nie może odczytać twojego klanu, pokazuje zamiast tego **Join your clan channel to sync the roster**.',
        },
        {
          term: 'Dźwięki banera',
          body: '**Add clip** dla dźwięku, który gra baner, **Copy folder path**, żeby nimi zarządzać, i **Add mission clip** dla misji.',
        },
        {
          term: 'Become a Supporter',
          body: 'w następnej aktualizacji pluginu link ★ na dole otwiera stronę Supporter albo pokazuje **Your Supporter perks**, jeśli już nim jesteś.',
        },
      ],
    },

    settings: {
      title: 'Ustawienia, które zmieniają to, co widzisz',
      intro:
        'W konfiguracji Anvil w RuneLite, w sekcji **Chat messages**. Na start wszystkie są włączone.',
      rows: [
        {
          term: 'Show feed in game chat',
          body: 'dodatkowo wypisuje feed w oknie czatu na bieżąco: duże dropy, pety i osiągnięcia z plansz, których gospodarz to włączył, i z klanów, w których jesteś gościem, postępy twoich kolegów z drużyny na polach i pola ukończone przez inne drużyny.',
        },
        {
          term: 'Supporter names in chat',
          body: 'kolory Supporterów (i gwiazdka Patrona) na czacie publicznym, klanowym, znajomych i prywatnym oraz na liście znajomych i listach członków kanałów. Lista nazw jest pobierana z Anvil; nic o tym, kogo widzisz, nie jest wysyłane.',
        },
        {
          term: 'Animated names',
          body: 'pozwala gradientowi Patrona przesuwać się w panelu, w Feed i na czacie wydarzenia. Wyłączone zatrzymuje go w miejscu. W następnej aktualizacji pluginu obejmuje też nazwy boostowanych klanów i animowane banery w panelu.',
        },
        {
          term: 'Supporter names in menus',
          body: 'kolory Supporterów na ich nazwie, gdy klikasz ich prawym przyciskiem, nigdy na światach PvP ani w Wilderness.',
        },
        {
          term: 'Over other plugins’ colours',
          body: 'włączone: kolory Supportera zastępują kolor nazwy ustawiony przez inny plugin, na przykład Player Indicators. Wyłączone: takie nazwy zostają bez zmian.',
        },
      ],
    },
  },

  clanBoosts: {
    metaTitle: 'Boostowanie klanu — Anvil',
    metaDescription:
      'Jak działają boosty klanu w Anvil: kto je ma, dawanie i przenoszenie boosta, trzy poziomy boostów i co każdy odblokowuje, kolory nazwy klanu, podarowane boosty oraz znaczki i odznaki boosterów.',
    eyebrow: 'Anvil · dla Supporterów i sztabu klanu',
    title: 'Boostowanie klanu',
    dek: 'Płacący Champion albo Patron może dać boosta klanowi, którego jest członkiem. Odpowiednio dużo boostów od członków klanu podnosi go o poziom, a każdy poziom zmienia wygląd klanu i miejsce, w którym jest wyświetlany. Boosty to tylko wygląd: nigdy nie zmieniają rangi, wyniku, miejsca ani planu klanu.',
    facts: [
      { strong: 'Champion 1, Patron 2', rest: 'boosty, dopóki płacisz' },
      { strong: 'Poziomy przy 3, 8 i 15', rest: 'liczonych boostach' },
      { strong: 'Raz w tygodniu', rest: 'boosta można przenieść' },
    ],
    footnote:
      'Członkowie dają boosty w **Settings** → **Clan boosts**. Sztab klanu widzi poziom i jego opcje w Admin → **Clan settings** → **Boosts**. O samych pakietach przeczytasz w [Anvil Supporter: pakiety i korzyści]({supporterGuide}).',

    what: {
      title: 'Kto ma boosty',
      intro: 'Boosty przychodzą z płatnym członkostwem:',
      rows: [
        { term: 'Champion', body: '1 boost.' },
        { term: 'Patron', body: '2 boosty.' },
        {
          term: 'Supporter',
          body: 'żadnego. Czas zdobyty za zaproszenia też ich nie daje. Tymczasowe podwyższenie od sztabu Anvil daje miejsca tylko wtedy, gdy sztab je uwzględni.',
        },
      ],
      outro:
        'Boosty należą do ciebie, a nie do postaci: trzy postacie w trzech klanach i tak dzielą jedną pulę. **Settings** → **Clan boosts** pojawia się w twoich ustawieniach tylko wtedy, gdy jesteś Supporterem albo wciąż masz gdzieś dany boost.',
    },

    place: {
      title: 'Dawanie i przenoszenie boosta',
      intro: 'Swoje boosty dajesz sam; nikt nie może dać boosta za ciebie.',
      steps: [
        'Otwórz **Settings** → **Clan boosts**. **Your boosts** pokazuje, co dałeś, i każde **Free slot**.',
        'W **Clans you can boost** naciśnij **Boost** obok klanu. Możesz też nacisnąć **Boost this clan** w sekcji Boosters na stronie samego klanu.',
        'Żeby jeden przenieść, użyj **Move to…** w jego wierszu i wybierz inny klan. **Remove** go zdejmuje.',
      ],
      rows: [
        {
          term: 'Miejsce członka sprzed 14 dni',
          body: 'każdy boost opiera się na miejscu członka, które jedna z twoich postaci ma w klanie w grze. Miejsce gościa nie może go nieść. Staż miejsca liczy się od wcześniejszej z dwóch dat: kiedy Anvil po raz pierwszy je zobaczył albo kiedy według gry postać dołączyła. Do tego czasu wiersz klanu mówi, ile dni zostało.',
        },
        {
          term: 'Jeden wiersz na klan',
          body: 'lista pokazuje każdy klan raz, a Anvil wybiera postać, na której opiera się boost: twojego maina, gdy to możliwe, a inaczej najdłużej zajmowane miejsce. Klan widzi tylko tę postać, nigdy pozostałych.',
        },
        {
          term: 'Raz w tygodniu',
          body: 'danego boosta można przenieść 7 dni po jego daniu. Miejsce zdjętego boosta zwalnia się w tym samym dniu, więc zdjęcie i ponowne danie nie jest skrótem. Jeśli postać, na której się opierał, opuściła klan, możesz go przenieść od razu.',
        },
      ],
      note: {
        tag: 'Co znaczą etykiety',
        body: '**counting**: liczy się do poziomu klanu. **paused**: twój pakiet ma teraz mniej miejsc, niż dałeś boostów, więc najstarsze dalej się liczą, a reszta czeka. **seat gone**: postać, na której się opierał, nie jest już tam członkiem; przenieś go. **over the 2-per-person cap**: klan liczy już dwa twoje.',
      },
    },

    levels: {
      title: 'Poziomy',
      intro:
        'Poziom klanu wynika z jego liczonych boostów. Do jednego klanu liczą się najwyżej dwa boosty jednej osoby, więc poziom zawsze oznacza, że wybrało go kilku członków.',
      rows: [
        { term: 'Poziom 1', body: '3 liczone boosty.' },
        { term: 'Poziom 2', body: '8 liczonych boostów.' },
        { term: 'Poziom 3', body: '15 liczonych boostów.' },
      ],
      outro:
        'Członkowie widzą postęp na stronie klanu, na przykład „5 of 8 to Level 2”. Klan, który awansuje, dostaje nowy poziom od razu.',
      note: {
        tag: 'Tydzień ulgi',
        body: 'Gdy boostów spadnie poniżej progu poziomu, klan zachowuje korzyści tego poziomu przez 7 dni. Admin → Clan settings → Boosts pokazuje, kiedy się kończą. Jeśli członkowie zdążą go ponownie zboostować, nic się nie zmienia.',
      },
    },

    perks: {
      title: 'Co odblokowuje każdy poziom',
      intro: 'Każdy poziom zachowuje wszystko z poziomu niżej.',
      rows: [
        {
          term: 'Poziom 1',
          body: 'odznaka **Boosted** na stronie klanu, na jego karcie w Clan Hall i w wyszukiwaniu; miejsce nad klanami bez boostów w Clan Hall i jego wynikach wyszukiwania; oraz nazwa klanu w gradiencie.',
        },
        {
          term: 'Poziom 2',
          body: 'miejsce w rzędzie **Featured** w Clan Hall; animowany baner klanu się odtwarza (poniżej poziomu 2 pokazuje nieruchomą klatkę); wiersz rekrutacyjny dla odwiedzających; i ruchomy gradient nazwy.',
        },
        {
          term: 'Poziom 3',
          body: '**Spotlight** na samej górze Clan Hall i jeden post rekrutacyjny miesięcznie na Discordzie Anvil, napisany przez klan.',
        },
      ],
      note: {
        tag: 'Logo klanu to nie korzyść',
        body: 'Animowane logo (obrazek klanu w GIF albo WebP) odtwarza się na każdym poziomie. Tylko baner czeka na poziom 2.',
      },
    },

    colours: {
      title: 'Kolory nazwy klanu',
      intro:
        'Od poziomu 1 nazwa klanu nosi gradient Anvil. Właściciele i admini mogą wybrać własny w Admin → **Clan settings** → **Boosts** → **Clan name colours**:',
      rows: [
        {
          term: 'Od jednego do czterech kolorów',
          body: 'jeden kolor daje nieruchomą nazwę; od dwóch do czterech tworzy gradient. Od poziomu 2 gradient się porusza.',
        },
        {
          term: 'Ciemne i jasne tła',
          body: 'jak przy nazwach Supporterów, Anvil dopasowuje kolory, żeby były czytelne na ciemnych tłach (strona, panel pluginu, Discord) i jasnych (nieprzezroczyste okno czatu w grze). Włącz osobny wygląd dla jednego z nich, a będzie pokazywany dokładnie tak, jak go wybrano.',
        },
        {
          term: 'Reset to Anvil',
          body: 'wraca do palety Anvil.',
        },
      ],
      outro:
        'Kolory zostają zapisane, jeśli klan spadnie poniżej poziomu 1, i wracają, gdy znów go osiągnie. Plugin łapie zmianę przy następnym odświeżeniu.',
    },

    staff: {
      title: 'Dla sztabu klanu',
      intro:
        'Admin → **Clan settings** → **Boosts** jest dla właścicieli i adminów. Sztab nie może dawać boostów za członków; członkowie dają je sami.',
      rows: [
        {
          term: 'Poziom',
          body: 'poziom klanu, ile boostów się liczy, ilu brakuje do następnego poziomu i ewentualny tydzień ulgi.',
        },
        {
          term: 'Wiersz rekrutacyjny',
          body: 'poziom 2. Jedno zdanie, do 140 znaków, pokazywane osobom spoza klanu na stronie twojego klanu i jego karcie w Clan Hall.',
        },
        {
          term: 'Post rekrutacyjny na Discordzie Anvil',
          body: 'poziom 3. Raz w miesiącu kalendarzowym, od 20 do 500 znaków, napisany przez ciebie i opublikowany, gdy naciśniesz **Post it**, z linkiem do strony twojego klanu. Wzmianki są usuwane i nikt nie dostaje pinga. Nie możesz go edytować ani wysłać kolejnego przed następnym miesiącem.',
        },
        {
          term: 'Boosters',
          body: 'lista postaci, które boostują klan.',
        },
      ],
      note: {
        tag: 'Boosty podarowane przez Anvil',
        body: 'Sztab Anvil może podarować klanowi poziom, na określony czas albo bezterminowo. Prezent dodaje tylko boosty, których klanowi brakuje do tego poziomu, pokazane jako **Anvil gift** na liście Boosters klanu. Każdy prawdziwy boost od członka zastępuje jeden podarowany, a klan już powyżej podarowanego poziomu zachowuje swój. Gdy prezent się kończy, klan wraca do poziomu, jaki dają mu boosty członków.',
      },
    },

    boosters: {
      title: 'Znaczki i odznaki boosterów',
      intro: 'Co dostaje booster w klanie, który boostuje:',
      rows: [
        {
          term: 'Znaczek Booster',
          body: 'mały klejnot obok jego postaci w składzie, feedzie i postach na Discordzie tego klanu. Najedź na niego, żeby zobaczyć „Boosts this clan”.',
        },
        {
          term: 'Ściana Boosterów',
          body: 'na stronie klanu: jeden wiersz na postać, najpierw najwięcej boostów, potem najdłuższy staż.',
        },
        {
          term: 'Odznaki',
          body: '**First booster** dla tego, kto dał pierwszego boosta w historii klanu; **1 month**, **3 months**, **6 months** i **1 year** boostowania bez przerwy; oraz **Level-up 1**, **2** albo **3** za boosta, który podniósł klan na ten poziom.',
        },
      ],
      note: {
        tag: 'Przeniesienie zeruje licznik',
        body: 'Odznaki za czas liczą się od najwcześniejszego wciąż liczonego boosta danej postaci, więc przeniesienie albo zdjęcie boosta zaczyna je od nowa. Twój profil pokazuje klany, które boostujesz, każdy raz.',
      },
    },
  },
};

export default pl;
