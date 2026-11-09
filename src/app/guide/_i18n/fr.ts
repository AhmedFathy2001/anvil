import type { PartialGuideDict } from './en';

// Français — French.
//
// Même convention que dans tous les autres fichiers de langue ici : tout ce que le lecteur VOIT
// RÉELLEMENT à l’écran dans Anvil, RuneLite et OBS reste en anglais — les menus de RuneLite et
// d’OBS, les lignes de chat du plugin lui-même, et les libellés de l’interface d’administration
// d’Anvil, qui sont en anglais jusqu’à ce que cette surface soit traduite elle aussi. Un « Tracked
// drop detected » traduit est une ligne que personne ne retrouve. Les libellés de l’interface de
// Discord elle-même (menus, paramètres, permissions) suivent en revanche la traduction officielle
// de Discord en français — ce qu’affiche un Discord réglé en français ; là où Discord ne serait pas
// traduit, ils resteraient en anglais. Tout le reste — l’explication, l’ordre, le pourquoi — est en
// français.

const fr: PartialGuideDict = {
  common: {
    contents: 'Sommaire',
    step: 'Étape',
    optional: 'facultatif',
    minRead: '{n} min de lecture',
    copyLink: 'Copier un lien vers cette section',
    linkCopied: 'Lien copié',
    language: 'Langue',
    partialNotice:
      'Ce guide n’est que partiellement traduit en {language}. Ce qui n’est pas encore traduit s’affiche en anglais.',
    backToGuides: 'Tous les guides',
    unreviewedNotice:
      'Cette traduction en {language} n’a encore été relue par aucun locuteur natif. Si une phrase sonne faux, [la page anglaise]({englishHref}) est l’original — et [nous le signaler](/feedback) est ce qui la corrigera.',
    support: {
      lead: 'Bloqué, ou quelque chose cloche ?',
      link: 'Demande sur le Discord de support Anvil',
    },
    legalPaid: 'Questions d’argent : [Remboursements](/legal/refunds) et [Conditions](/legal/terms).',
    legalPrivacy: 'Traitement de vos données : [Politique de confidentialité](/legal/privacy).',
    aboutLine: 'Qui se cache derrière Anvil ? Lisez [À propos](/about).',
  },

  index: {
    metaTitle: 'Guides — Anvil',
    metaDescription:
      'Bien démarrer avec Anvil : le plugin RuneLite pour les joueurs, organiser un événement pour l’équipe du clan, et accueillir un clan invité.',
    title: 'Guides',
    dek: 'Tout ce qu’il faut pour démarrer, écrit pour exactement la version d’Anvil qui tourne ici.',
    groups: {
      playing: 'Jouer',
      running: 'Organiser un événement',
      clan: 'Gérer le clan',
      streamers: 'Streamers',
    },
    anvilTab: 'Utiliser Anvil',
    ingame: {
      title: 'Guides de jeu',
      dek: 'Raids, boss, compétences et gains d’or issus de la bibliothèque Anvil — les mêmes guides que le plugin affiche en jeu et que le bot publie sur Discord.',
      browse: 'Voir tous les guides',
      language: 'Ces guides ne sont pas traduits : ils s’affichent tels qu’ils ont été écrits, quelle que soit la langue de cette page.',
      empty: 'La bibliothèque Anvil n’a pas encore de guide publié. Reviens bientôt.',
      placeholder: 'Rechercher dans les guides de jeu — essaie "zulrah", "raids" ou "money"',
      readTime: '{n} min de lecture',
      metaTitle: 'Guides de jeu OSRS — Anvil',
      metaDescription: 'Guides de raids, boss, compétences et gains d’or de la bibliothèque Anvil, à lire sur le site, en jeu via le plugin RuneLite et sur Discord.',
    },
    search: {
      placeholder: 'Rechercher dans les guides — essayez « webhook », « cases » ou « les drops n\'apparaissent pas »',
      results: '{n} guides',
      empty: 'Aucun résultat. Essayez un mot plus simple — « cases », « paiement », « bot » — ou parcourez la liste ci-dessous.',
      clear: 'Effacer la recherche',
    },
    cards: {
      tiles: {
        eyebrow: 'Pour les joueurs',
        title: 'Règles et limites des cases',
        blurb: 'Ce qu’une case attend de vous avant de commencer (un réglage du jeu, le plugin, un journal synchronisé, un classement aux hiscores) et ce qu’elle ne peut pas suivre.',
        minutes: '~4 min',
      },
      discord: {
        eyebrow: 'Pour qui gère le serveur',
        title: 'Anvil dans Discord',
        blurb: 'Une invitation, puis les salons où chaque flux publie, les rôles, les commandes slash, et quoi vérifier quand ça s’arrête.',
        minutes: '~5 min',
      },
      switching: {
        eyebrow: 'Passer à Anvil',
        title: 'Passer d’autres plugins et trackers à Anvil',
        blurb:
          'Anvil publie tes drops sur Discord et fait tourner vos compétitions hebdomadaires. Cinq étapes pour le staff, deux pour les joueurs.',
        minutes: '~3 min',
      },
      clan: {
        eyebrow: 'Pour qui en lance un',
        title: 'Créer un clan',
        blurb: 'Deux noms et une adresse, et il est en ligne. Ensuite Discord, votre liste de membres et le premier tableau.',
        minutes: '~4 min, gratuit',
      },
      plugin: {
        eyebrow: 'Pour les joueurs',
        title: 'Installer le plugin RuneLite',
        blurb:
          'Installez le plugin, connectez-vous depuis son panneau latéral, et laissez-le soumettre vos drops. Couvre aussi les notifications Discord et la recherche de joueurs.',
        minutes: '~3 min d’installation',
      },
      board: {
        eyebrow: 'Pour les créateurs de grille',
        title: 'Construire une grille qui se suit toute seule',
        blurb:
          'Ce que chaque type de case peut réellement voir, la création en masse par tableur, et les erreurs qui s’importent proprement puis ne se déclenchent jamais.',
        minutes: '~8 min',
      },
      captain: {
        eyebrow: 'Pour les capitaines',
        title: 'Guide du capitaine',
        blurb:
          'Lire le vivier avant que l’horloge démarre, le jour du draft lui-même, et les parties de la gestion d’équipe qui ne commencent qu’après.',
        minutes: '~6 min',
      },
      formats: {
        eyebrow: 'Pour l’équipe du clan',
        title: 'Formats, et comment les cases s’ouvrent',
        blurb:
          'Sept formes de grille, cinq façons dont les cases deviennent jouables, et les trois modificateurs qui décident de la valeur d’une réussite.',
        minutes: '~5 min',
      },
      fees: {
        eyebrow: 'Pour les trésoriers',
        title: 'Frais et récompenses',
        blurb:
          'Fixer des frais d’inscription, les encaisser, la deuxième signature qui les clôt, et transformer une cagnotte en places payées.',
        minutes: '~5 min',
      },
      coffer: {
        eyebrow: 'Pour les trésoriers',
        title: 'La caisse du clan',
        blurb:
          'Une seule caisse pour les po du clan : ce qui y entre, les trois façons dont elle paie les prix, et qui a le droit d\'y toucher.',
        minutes: '~5 min',
      },
      moderator: {
        eyebrow: 'Pour les modérateurs',
        title: 'De permanence',
        blurb:
          'La file d’attente, la vérification des preuves et des comptes, garder la liste des membres honnête, et les arbitrages qui reviennent à un humain.',
        minutes: '~5 min',
      },
      admin: {
        eyebrow: 'Pour l’équipe du clan',
        title: 'Organiser votre premier événement',
        blurb:
          'Discord, liste des membres, grilles, cases, équipes et draft, lancement — et quoi faire une fois l’événement terminé.',
        minutes: 'une soirée, une fois',
      },
      clanVsClan: {
        eyebrow: 'Pour les organisateurs',
        title: 'Accueillir un clan invité',
        blurb:
          'Clan contre clan sans récolter un seul RSN à la main : un lien d’invitation par équipe, et une place qui permet à leur propre modérateur de gérer leur moitié.',
        minutes: '~5 min par équipe',
      },
      commands: {
        eyebrow: 'Pour tous les membres',
        title: 'Commandes slash',
        blurb:
          'Chaque commande à laquelle le bot répond dans Discord, ce que fait chaque option, des exemples concrets, et quoi vérifier quand l’une d’elles n’apparaît pas.',
        minutes: '~6 min',
      },
      creators: {
        eyebrow: 'Pour les streamers',
        title: 'Organiser des événements pour tes viewers',
        blurb:
          'Pas besoin de clan. Crée un espace, partage un seul lien, choisis qui peut rejoindre (followers, abonnés, rôles Discord) et mets la grille en stream.',
        minutes: '~6 min',
      },
      joiningStream: {
        eyebrow: 'Pour les viewers',
        title: 'Rejoindre l’événement d’un streamer',
        blurb:
          'Tu as reçu un lien depuis un stream ? Connecte-toi, ajoute ton personnage, appuie sur Join. Que faire pour les événements réservés aux followers ou aux abonnés.',
        minutes: '~2 min',
      },
      streamingClans: {
        eyebrow: 'Pour les clans qui streament',
        title: 'Streamer pour un clan',
        blurb:
          'Laisse tes viewers jouer un événement sans rejoindre le clan. Active Streaming, puis ouvre un événement aux viewers.',
        minutes: '~2 min',
      },
      people: {
        eyebrow: 'Pour l’équipe du clan',
        title: 'Vos membres : liste, invités et qui peut rejoindre',
        blurb:
          'D’où viennent les membres, ce que veulent dire les filtres de l’onglet Roster, les demandes d’adhésion et Needs review, les trois réglages de Who can join, et retirer ou bannir quelqu’un.',
        minutes: '~6 min',
      },
      staffRoles: {
        eyebrow: 'Pour les propriétaires et les admins',
        title: 'Rôles du staff : qui peut faire quoi',
        blurb:
          'Propriétaire, admin, trésorier et modérateur : ce que chacun atteint, comment nommer un modérateur, qui peut donner quel rôle, et les fonctions limitées à un seul événement.',
        minutes: '~6 min',
      },
      supporter: {
        eyebrow: 'Pour les joueurs',
        title: 'Anvil Supporter : paliers et avantages',
        blurb:
          'Supporter, Champion et Patron : couleurs de nom, l’étoile, images de profil, la vitrine, événements entre amis et boosts de clan, comment fonctionne la facturation et ce qui se passe si vous arrêtez.',
        minutes: '~6 min',
      },
      sidePanel: {
        eyebrow: 'Pour les joueurs',
        title: 'Le panneau latéral, onglet par onglet',
        blurb:
          'Clan, Feed, You, Lookup et la roue dentée : ce que montre chaque onglet, le chat d’événement, les réactions GZ et Sad, et les réglages qui amènent le fil et les couleurs Supporter dans votre jeu.',
        minutes: '~6 min',
      },
      clanBoosts: {
        eyebrow: 'Pour les Supporters et l’équipe du clan',
        title: 'Booster un clan',
        blurb:
          'Placer et déplacer un boost, les trois niveaux et ce que chacun débloque, les couleurs du nom du clan, les boosts offerts, et les marques et badges des boosters.',
        minutes: '~5 min',
      },
      profile: {
        eyebrow: 'Pour les joueurs',
        title: 'Ton profil, Wrapped et Comparer',
        blurb: 'Ton profil, la page publique de chaque personnage et ta page personnelle, qui peut les voir, les cartes Wrapped mensuelles et d’événement, et la comparaison de deux personnages.',
        minutes: '~4 min',
      },
      settings: {
        eyebrow: 'Pour les joueurs',
        title: 'Réglages, page par page',
        blurb: 'Publications Discord et confidentialité des captures d’écran, le fil de chat en jeu, les appareils, tes propres webhooks, qui voit tes personnages, chaque personnage et les demandes de propriété.',
        minutes: '~6 min',
      },
      challenges: {
        eyebrow: 'Pour les joueurs',
        title: 'Défis et événements entre amis',
        blurb: 'Défie un joueur dans une course au drop, aux kills ou à l’XP, et héberge un tableau privé pour tes amis derrière un seul lien d’invitation.',
        minutes: '~4 min',
      },
      clanHall: {
        eyebrow: 'Pour les joueurs et les clans',
        title: 'Trouver des clans, des événements et des classements',
        blurb: 'La Clan Hall, la comparaison de deux clans, le classement hebdomadaire, la liste publique des événements et les pages des clans en jeu qui ne sont pas sur Anvil.',
        minutes: '~3 min',
      },
      guideLibrary: {
        eyebrow: 'Pour les joueurs et l’équipe des clans',
        title: 'Guides en jeu',
        blurb: 'Lire la bibliothèque de guides par niveau, proposer un nouveau guide ou une modification, et garder les copies propres à ton clan.',
        minutes: '~3 min',
      },
      weekly: {
        eyebrow: 'Pour l’équipe des clans et les joueurs',
        title: 'Skill et Boss de la semaine',
        blurb: 'Programmer une compétition hebdomadaire, la répéter et la faire tourner, les lignes de départ, les prix, la terminer en avance, et ce que voient les joueurs.',
        minutes: '~4 min',
      },
      teamComps: {
        "eyebrow": "Pour le staff de clan et les joueurs",
        "title": "Compétitions par équipes",
        "blurb": "Compétitions de skills et de boss en équipes ou clan contre clan : mise en place, invitation des clans, calcul des totaux et moyennes, et ce que voient les joueurs.",
        "minutes": "~4 min"
      },
      clanEvents: {
        eyebrow: 'Pour l’équipe des clans',
        title: 'Événements du clan et planning',
        blurb: 'Masses, soirées raid et rencontres : répétitions hebdomadaires, « I’m going » et inscriptions, rappels Discord, versements, sondages, et repérage des trous dans le planning.',
        minutes: '~4 min',
      },
      luckRecords: {
        eyebrow: 'Pour les joueurs',
        title: 'Taux de drop, chance et records',
        blurb:
          'Ce que signifient les probabilités d’une case de drop, comment la chance est calculée, et où apparaissent vos meilleurs jour, semaine, mois et année.',
        minutes: '~3 min',
      },
    },
  },

  switching: {
    metaTitle: 'Passer d’autres plugins et trackers à Anvil — Anvil',
    metaDescription:
      'Fais passer ton clan à Anvil : configurer les salons Discord, synchroniser la liste du clan, lancer un Skill ou Boss of the Week, et prévenir tes membres.',
    eyebrow: 'Passer à Anvil',
    title: 'Passer d’autres plugins et trackers à Anvil',
    dek: 'Anvil publie les drops et les hauts faits de ton clan sur Discord. Il tient aussi la liste du clan et organise les compétitions hebdomadaires.',

    staff: {
      title: 'Si tu diriges le clan',
      body: [
        '**Laisse le bot configurer tes salons.** Va dans Admin → Discord → **Set it up for me**. Choisis un salon ou plusieurs. Si un autre plugin publiait quelque part, coche _Use the same channels_. Rien ne change pour tes membres.',
        '**Synchronise la liste du clan.** Dans RuneLite, ouvre les réglages du plugin Anvil. Active **Keep the clan roster in sync**. Un admin le fait une seule fois, en jeu. Cela remplace toute liste de clan tenue ailleurs.',
        '**Lance un Skill ou Boss of the Week.** Va dans Admin → All events → **+ New event**, puis choisis Skill of the Week ou Boss of the Week. Toute la liste du clan y participe automatiquement. Cela remplace les compétitions organisées ailleurs.',
        '**Préviens tes membres.** Va dans Admin → Discord → **Tell your members** → **Post it**. Le bot publie les étapes pour les joueurs à ta place.',
        '**Une semaine plus tard, fais le ménage.** Va dans Admin → Discord → **Remove old webhooks from other plugins**, coche ceux à supprimer, appuie sur **Remove … webhooks** puis sur **Yes, remove them**. Après ça, plus rien ne peut être publié en double. Appuie sur **Keep** pour ceux que tu veux laisser tranquilles.',
      ],
    },

    player: {
      title: 'Si tu es joueur',
      body: [
        '**Installe Anvil.** Dans RuneLite, ouvre le Plugin Hub, cherche Anvil et appuie sur **Install**. Connecte-toi ensuite avec Discord depuis le panneau latéral d’Anvil.',
        '**Désactive les notifications de ton ancien plugin** pour que rien ne soit publié deux fois. Ou désinstalle-le si tu ne t’en sers pas pour autre chose.',
        '**C’est tout.** Il n’y a rien d’autre à configurer.',
      ],
    },

    questions: {
      title: 'Questions',
      intro: 'Celles que les clans posent le plus souvent :',
      rows: [
        {
          term: 'Anvil suit-il les kill counts, les tâches slayer et les records personnels ?',
          body: 'Oui. Anvil suit lui-même les kill counts, les tâches slayer et les records personnels, il n’y a donc rien d’autre à laisser tourner.',
        },
        {
          term: 'Les joueurs doivent-ils coller un webhook quelque part ?',
          body: 'Non. Le clan règle les salons sur le site.',
        },
        {
          term: 'Tu veux aussi des publications sur ton propre serveur ?',
          body: 'Va dans ton profil → **Announcements & webhooks** → _Your own webhooks_.',
        },
      ],
    },
  },

  clan: {
    metaTitle: 'Créer un clan — Anvil',
    metaDescription: 'Créez un clan sur Anvil : nommez-le, choisissez son adresse, connectez Discord, synchronisez votre liste de membres et lancez votre premier événement.',
    eyebrow: 'Anvil · démarrer',
    title: 'Créer un clan',
    dek: 'Deux noms et une adresse, et votre clan est en ligne — gratuitement, et sans rien attendre. C’est cela, plus les quatre choses qui valent la peine d’être faites juste après.',
    facts: [
      {
        strong: 'Gratuit',
        rest: 'pas de carte, pas d’essai',
      },
      {
        strong: 'En ligne',
        rest: 'dès que vous validez',
      },
      {
        strong: '~4 min',
        rest: 'jusqu’à un clan qui fonctionne',
      },
    ],
    footnote: 'Vous pourrez tout modifier plus tard depuis Admin → **Clan settings**, sauf l’adresse — celle-là mérite d’y réfléchir maintenant.',
    before: {
      title: 'Avant de commencer',
      body: [
        'Il vous faut un compte Discord, et c’est toute la liste. Connectez-vous d’abord sur `{apex}` : un clan a besoin d’un propriétaire, et la connexion est ce qui indique au site que c’est vous. Partez de **Créer un clan** sur les pages de la plateforme, ou allez directement à `{apex}/clans/new`.',
        'Cela ne coûte rien. Aucune formule à choisir, aucune carte à saisir, et aucun essai qui expire en emportant votre tableau — un clan démarre gratuit et le reste.',
        'Les grands clans peuvent passer à une formule supérieure plus tard, depuis **Plan and billing** dans l’Admin. Tout ce que vous payez sur Anvil — un clan, un espace créateur ou votre propre abonnement Supporter — se trouve sur [votre page de facturation](/portal).',
      ],
      note: {
        tag: 'Vous en serez le propriétaire',
        body: 'Propriétaire est le seul rôle que personne ne peut vous retirer, et il revient à qui crée le clan. Ajoutez du staff ensuite depuis Admin → **People** → **Staff & roles** ; voir [Dans la rotation]({moderatorGuide}).',
      },
    },
    create: {
      title: 'Le nommer et choisir son adresse',
      intro: 'Trois champs, et seulement deux vraies décisions. Le formulaire vérifie l’adresse pendant que vous tapez et vous prévient avant validation.',
      fields: [
        {
          term: 'Nom du clan en jeu',
          body: 'Obligatoire, et il doit correspondre **exactement** à OSRS. Ce n’est pas décoratif : la synchronisation de la liste s’appuie dessus et refuse toute liste de membres signalée sous un autre nom. C’est ce qui empêche la liste de quelqu’un d’autre d’atterrir sur votre site.',
        },
        {
          term: 'Nom du clan',
          body: 'Facultatif. Ce que les gens voient — sur le site et dans chaque message Discord. Laissez-le vide et votre nom en jeu servira pour les deux.',
        },
        {
          term: 'Adresse',
          body: 'Votre clan vit à `{apex}/c/votre-slug`. Elle est suggérée d’après le nom saisi, vous pouvez la modifier, et quelques mots sont réservés. Choisissez-en une qui vous plaira encore dans un an : c’est le lien qui finira épinglé dans votre Discord.',
        },
      ],
      note: {
        tag: 'Le nom en jeu est un verrou, pas une étiquette',
        body: 'Si votre clan change de nom en jeu, changez-le ici aussi — d’ici là, la synchronisation refusera le nouveau nom. C’est le contrôle qui fonctionne, pas une panne.',
      },
    },
    live: {
      title: 'Il est en ligne',
      body: [
        'Appuyez sur **Créer le clan** et il existe. Aucun provisionnement, aucune file, aucun « nous construisons votre site, revenez dans quelques minutes » — un clan est une ligne, donc il répond déjà avant que la page ait fini de changer.',
        'Vous arrivez sur un choix entre **Le configurer**, qui ouvre l’assistant, et **Jeter un œil d’abord**. Rien ne casse si vous partez et revenez demain ; l’assistant retient les étapes déjà faites.',
      ],
    },
    setup: {
      title: 'L’assistant de configuration',
      intro: 'Trois étapes séparent un clan tout neuf d’un événement en cours, et l’assistant les parcourt dans l’ordre en sautant ce qui est déjà fait. Le tableau vient juste après.',
      steps: [
        {
          term: 'Votre clan',
          body: 'Votre nom affiché, votre nom de clan en jeu et un lien d’invitation vers votre serveur. L’invitation est ce qui permet aux pages d’inscription et aux guides de diriger les gens vers vous.',
        },
        {
          term: 'Connecter Discord',
          body: 'Un bot partagé, donc aucune application à enregistrer et aucun token à coller. Appuyez sur **Connect your bot** et approuvez-le une fois, puis choisissez **A few channels** ou **Just one channel** et appuyez sur **Set it up for me** — le bot crée les salons pour vous.',
        },
        {
          term: 'Faire entrer vos membres',
          body: 'Installez le plugin, connectez-vous avec Discord, puis ouvrez la fenêtre de votre clan en jeu et appuyez sur le bouton **Anvil** de sa barre de titre. Personne ne peut s’inscrire à un événement tant que votre liste de membres n’est pas importée.',
        },
        {
          term: 'Faire un tableau',
          body: 'L’assistant se termine sur **Create your first event →**. Choisissez un format, ajoutez des cases, ouvrez les inscriptions — c’est [Organiser votre premier événement]({adminGuide}), et de loin l’étape la plus longue.',
        },
      ],
      after: [
        'Vous pouvez sauter l’assistant entièrement avec **Skip setup** et tout faire plus tard depuis Admin → **Clan settings** et Admin → **Discord**. Il existe parce que l’ordre compte quand on ne l’a jamais fait : Discord avant les salons, les membres avant un tableau auquel ils doivent s’inscrire.',
      ],
    },
    members: {
      title: 'Faire entrer vos membres',
      body: [
        'Personne n’a besoin de s’inscrire, de créer un compte ni d’être invité un par un. Votre liste de membres vient du jeu.',
      ],
      ways: [
        {
          term: 'Synchronisation de la liste (faites celle-ci)',
          body: 'Ouvrez la fenêtre de clan en jeu avec le plugin actif et appuyez sur le bouton **Anvil** dans sa barre de titre. Toute votre liste arrive avec les rangs intacts, et une liste venant d’un clan dont le nom ne correspond pas au vôtre est refusée. Répétez-le quand des gens arrivent ou partent — voir le [guide d’installation joueur]({pluginGuide}).',
        },
        {
          term: 'Ils demandent à rejoindre',
          body: 'Se connecter ou jouer avec le plugin ne donne jamais à lui seul de place à personne. Si le plugin voit quelqu’un jouer dans votre clan en jeu avant que votre liste ne l’ait, il fait une demande d’adhésion pour lui, et n’importe qui d’autre peut demander avec **Apply** sur la page de votre clan. Le staff répond aux deux en haut de l’onglet **Roster**, et **Who can join** décide s’ils attendent un oui, entrent tout de suite ou ne peuvent pas demander du tout. Quelqu’un qui joue un personnage déjà sur votre liste est plutôt confirmé sous **Needs review**. Les détails sont dans [Vos membres]({peopleGuide}).',
        },
        {
          term: 'À la main',
          body: 'Admin → **People** → **+ Add Manually** accepte les noms un par un, pour la personne sur mobile ou sur le client officiel qui ne peut pas du tout faire tourner le plugin.',
        },
      ],
      note: {
        tag: 'Les invités ne sont pas un problème à résoudre',
        body: 'Un invité joue dans vos événements sans être dans votre clan en jeu : un joueur d’un clan de passage, un ami, un alt. Il reçoit une place quand le staff approuve sa demande, ou tout de suite si **Who can join** est réglé sur **Let anyone in**. Les invités sont suivis et peuvent participer aux événements, et ils ne comptent pas dans votre formule. Quelqu’un qui vous rejoint en jeu devient membre à la synchronisation suivante de la liste.',
      },
    },
    first: {
      title: 'Votre premier événement',
      body: [
        'Le chemin le plus court pour que quelque chose se passe : faites un tableau, ajoutez une poignée de cases que le plugin voit tout seul, ouvrez les inscriptions et lancez. Les drops, les compteurs de kills et l’XP se consignent ensuite d’eux-mêmes.',
        'Deux guides portent l’essentiel ici. [Organiser votre premier événement]({adminGuide}) va du début à la fin — Discord, équipes, lancement, et quoi faire quand ça se termine. [Construire un tableau qui se suit tout seul]({boardGuide}) traite spécifiquement des cases : ce que chaque type peut réellement détecter, et celles qui s’importent proprement puis ne se déclenchent jamais.',
        'Si vous préférez ne pas construire de tableau du tout la première semaine, lancez plutôt un **Skill of the Week** ou un **Boss of the Week**. Tout le monde sur la liste est inscrit automatiquement, le classement vient des hiscores, et il n’y a rien à rédiger.',
      ],
    },
    together: {
      title: 'Des événements entre plusieurs clans',
      body: [
        'Un événement n’a pas à appartenir à un seul clan. Plusieurs clans peuvent mener le même tableau ensemble — deux, ou une douzaine — chacun gardant sa propre liste de membres, son propre staff et sa propre moitié de la modération.',
        'Ils peuvent aussi partager un même vivier de joueurs plutôt que de se faire face au classement : un événement, tout le monde dedans, quelle que soit la façon dont les équipes sont découpées. Clan contre clan est une forme de cela, pas la seule.',
        'Chaque clan invité reçoit un lien d’invitation par équipe, si bien que vous ne collectez jamais un seul RSN à la main, et un siège permettant à leur propre modérateur de valider les preuves de leurs propres membres. [Accueillir un clan invité]({clanVsClanGuide}) couvre l’organisation.',
      ],
      note: {
        tag: 'Rien à acheter',
        body: 'Participer à l’événement de quelqu’un d’autre est gratuit, et en organiser un aussi. Un clan qui ne fait que passer sur les tableaux des autres n’aura jamais besoin de plus que son propre clan gratuit.',
      },
    },
    boosts: {
      title: 'Boosts de clan',
      body: [
        'Les membres qui paient Anvil Supporter au palier **Champion** (un boost) ou **Patron** (deux) peuvent booster le clan depuis leurs propres **Settings → Clan boosts**. Un boost compte une fois que leur place dans le clan a 14 jours, et pas plus de deux ne comptent pour une même personne.',
        'Vous voyez où vous en êtes dans Admin → **Clan settings** → **Boosts** : le niveau du clan, combien de boosts comptent et combien il en faut encore pour le niveau suivant. Le niveau 1 demande 3 boosts, le niveau 2 en demande 8 et le niveau 3, 15. Si les boosts passent sous un niveau, ses avantages restent encore une semaine.',
        'Le niveau 1 met un badge **Boosted** sur la page de votre clan, sur sa carte du Clan Hall et dans la recherche, vous place au-dessus des clans non boostés dans le Clan Hall et donne un dégradé à votre nom. Le niveau 2 ajoute une place dans la rangée Featured du Clan Hall, fait jouer votre bannière animée et débloque une ligne de recrutement (**Recruiting line**) : une phrase, jusqu’à 140 caractères, montrée aux visiteurs. Le niveau 3 ajoute un Spotlight en haut du Clan Hall et une annonce de recrutement par mois sur le Discord d’Anvil (**Recruitment post in the Anvil Discord**), jusqu’à 500 caractères, envoyée une seule fois avec **Post to the Anvil Discord**, avec un lien vers la page de votre clan et sans mentionner personne.',
      ],
      note: {
        tag: 'Apparence seulement',
        body: 'Les boosts changent l’apparence du clan et l’endroit où il est listé. Ils ne changent jamais un grade, un score, vos places ni votre offre.',
      },
    },
    features: {
      title: 'Fonctionnalités et formule',
      intro: 'Les admins peuvent activer ou désactiver des blocs entiers d’Anvil sous **Features**. Désactiver masque ces blocs des menus ; rien n’est supprimé.',
      rows: [
        {
          term: 'Événements',
          body: '**Skill & Boss of the Week** (activé), **formats à tâche surprise** (désactivé), **Missions** (désactivé), **sondage après l’événement** (désactivé).',
        },
        {
          term: 'Argent',
          body: '**Frais d’inscription** (activé), **Caisse du clan** (désactivé).',
        },
        {
          term: 'Discord et plugin',
          body: '**Post to Discord** (activé), **messages de mort et messages amusants** (désactivé), **Clan Hall card**, qui affiche qui est en ligne sur ton Discord sur la page publique de ton clan (activé).',
        },
      ],
      outro: '**Plan and billing** affiche ta formule, le nombre de membres par rapport à sa taille, et les formules supérieures. Si tu paies, **Manage subscription and invoices** est aussi là.',
    },
  },

  discord: {
    metaTitle: 'Anvil dans Discord — Anvil',
    metaDescription: 'Connectez le bot Anvil à votre serveur Discord : une invitation, les salons où chaque flux publie, la synchronisation des rôles et des pseudos, les commandes slash, et quoi vérifier quand ça devient silencieux.',
    eyebrow: 'Anvil · Discord',
    title: 'Anvil dans Discord',
    dek: 'Un bot, une invitation, et aucune application à enregistrer. Voici ce qu’il publie, où il le publie, ce qu’il peut modifier sur votre serveur — et quoi regarder le jour où il s’arrête.',
    facts: [
      {
        strong: 'Un bot',
        rest: 'partagé, rien à créer',
      },
      {
        strong: '~5 min',
        rest: 'de l’invitation au premier message',
      },
      {
        strong: 'Sur demande',
        rest: 'chaque flux est coupé tant que vous ne le dirigez pas',
      },
    ],
    footnote: 'Tout ceci se trouve dans Admin → **Discord** : la configuration rapide en haut, puis **More settings** — Connection, What goes where, Event posts, Roles & nicknames, Team channels, Commands et Post without a bot.',
    bot: {
      title: 'Un bot, déjà construit',
      body: [
        'Il n’y a aucune application Discord à créer, aucun token à générer et aucun secret à coller. Anvil fait tourner un bot que chaque clan partage, donc se connecter est une invitation et rien d’autre.',
        'Vous pouvez tout de même amener le vôtre — collez un token sous **Use your own bot instead (advanced)** et il sera utilisé à la place. Cela ne vaut le coup que si vous voulez que le bot porte le nom et l’avatar de votre clan dans la liste des membres ; tout ce guide fonctionne pareil dans les deux cas.',
      ],
      permissions: [
        {
          term: 'Voir les salons, Envoyer des messages, Intégrer des liens, Joindre des fichiers',
          body: 'La base. Sans cela, il est sur votre serveur et muet.',
        },
        {
          term: 'Gérer les webhooks',
          body: 'Pour que **Set it up for me** et **Post here** puissent créer des webhooks à votre place, au lieu que vous copiiez des URL depuis Discord à la main, et pour qu’Anvil puisse trouver d’anciens webhooks à supprimer.',
        },
        {
          term: 'Gérer les rôles',
          body: 'Uniquement si vous activez la synchronisation des rôles. Il peut alors distribuer les rôles que vous associez — et il ne peut jamais toucher un rôle au-dessus du sien, ce qui est la règle de Discord, pas la nôtre.',
        },
        {
          term: 'Gérer les pseudos',
          body: 'Uniquement si vous activez la synchronisation des pseudos, pour que le pseudo serveur d’un membre puisse être mis à son RSN.',
        },
        {
          term: 'Gérer les salons',
          body: 'Pour les salons privés des équipes pendant une draft, et pour les guides publiés comme nouvelle catégorie ou forum. Sans elle, tout le reste fonctionne quand même.',
        },
        {
          term: 'Gérer les fils, Envoyer des messages dans les fils',
          body: 'Pour les guides publiés dans un forum : écrire dans la publication, puis la supprimer — sans cette permission, Discord ne laisse pas un bot supprimer même sa propre publication.',
        },
        {
          term: 'Changer le pseudo',
          body: 'Seulement si vous donnez au bot le nom de votre clan sous **Connection → Bot appearance in your server**. Cela ne change son nom que sur votre serveur.',
        },
      ],
      note: {
        tag: 'Il demande tout d’un coup',
        body: 'Discord n’a aucun moyen de demander une permission plus tard, donc le lien d’invitation réclame l’ensemble, et les fonctions que vous n’activez jamais n’utilisent jamais les leurs. Rouvrir le lien d’invitation est aussi la façon de réparer une permission que quelqu’un a retirée.',
      },
    },
    connect: {
      title: 'Le connecter',
      intro: 'Deux choses, dans cet ordre. Le bot doit être sur votre serveur, et Anvil doit savoir quel serveur est le vôtre.',
      steps: [
        {
          term: 'Inviter le bot',
          body: 'Admin → **Discord** → **Connect your Discord server** (ou **Add Anvil to Discord**). Discord vous demande sur quel serveur ajouter Anvil et vous renvoie ici, vous ne pouvez donc pas l’ajouter au mauvais par accident. Plus tard, **Invite / re-invite the bot** se trouve sous **More settings → Connection**.',
        },
        {
          term: 'Renseigner l’identifiant du serveur',
          body: 'Seulement si le bouton n’y arrive pas : ouvrez **Can’t use the button? Enter the server ID**, faites un clic droit sur l’icône de votre serveur dans Discord → **Copier l’identifiant du serveur** (nécessite d’activer le Mode développeur, dans la section Avancés des paramètres de Discord lui-même), collez-le dans **Your Discord server’s ID** et appuyez sur **Save**. C’est ce champ qui rend la connexion propre à vous.',
        },
      ],
      after: [
        'Le panneau vous dit ensuite la vérité plutôt que votre intention : si le bot est réellement membre de ce serveur, et quelles permissions lui manquent. Une ligne verte là vaut plus qu’un formulaire enregistré.',
      ],
      note: {
        tag: 'L’identifiant du serveur est tout le lien',
        body: 'Un serveur appartient à exactement un clan sur Anvil, et les commandes slash venant d’un serveur que personne n’a revendiqué sont refusées plutôt que devinées. Tant que vous ne le renseignez pas, le bot est invité et inactif.',
      },
    },
    channels: {
      title: 'Configurer les webhooks',
      body: [
        'Anvil publie via des **webhooks**, un par salon, et chacun est facultatif. Rien n’est publié nulle part tant que vous ne dirigez pas un flux vers un salon — un clan tout neuf est silencieux à dessein, pas par accident.',
        'Avec le bot Anvil sur votre serveur, **Set it up for me**, en haut de **Admin → Discord**, crée les salons et y dirige chaque flux. Pour le faire à la main, ouvrez **More settings → What goes where** et commencez par le **Catch-all channel** de l’onglet **Clan & events**, puis le **In-game catch-all** de l’onglet **In-game (plugin)** : choisissez un salon dans la liste déroulante et c’est enregistré. Sans le bot, ouvrez dans ce salon Discord **Modifier le salon → Intégrations → Webhooks**, créez-en un, copiez son URL, choisissez **Paste a webhook…** dans la liste déroulante, collez-la et appuyez sur **Save**. Une URL de webhook peut publier dans son salon : traitez-la comme un mot de passe ; si elle fuit, supprimez-la dans Discord et recréez-en une. **Test**, et **Add another** pour répartir les publications chargées entre deux webhooks, se trouvent sous **Post without a bot**.',
      ],
      feeds: [
        {
          term: 'Canal général',
          body:
            'Le principal, dans l’onglet **Clan & events**. Débuts et fins d’événements, ouvertures d’inscriptions, classements, résultats hebdomadaires : tout ce que le site publie sans canal dédié. Si vous ne configurez que celui-ci, votre clan fonctionne déjà.',
        },
        {
          term: 'Canal général in-game',
          body:
            'Dans l’onglet **In-game (plugin)** : là où va tout ce qui vient du jeu quand il n’a pas de canal dédié. À configurer en second.',
        },
        {
          term: 'Jalons et plus',
          body:
            'Dans l’onglet **In-game (plugin)**. Slayer, clues, speedruns, kill counts, paris BA et messages de chat personnalisés sont publiés ici, une fois que les joueurs les ont activés. Son bouton **Filters** définit ce que votre clan offre à ses membres par défaut. Les modèles personnels des joueurs et les types privés se trouvent dans [Settings, page by page]({settingsGuide}).',
        },
        {
          term: 'Les flux séparés',
          body:
            'Les posts d’événements, les tableaux que vous co-animez, le Skill & Boss of the Week et les événements du calendrier du clan peuvent être séparés du canal général. Les drops rares, pets, collection log, niveaux, combat achievements, quêtes, journaux, morts et kills PvP peuvent être séparés du canal général in-game. Les changements de roster, les validations d’inscription et le journal de la cagnotte restent sur **Staff only**. Un flux séparé vide revient à son canal général. La cagnotte fait exception : vide signifie qu’aucun argent n’est publié. Leagues et les autres modes ont leur propre onglet **Game modes**.',
        },
      ],
      note: {
        tag: 'Séparez les morts en premier',
        body: 'Les morts sont le flux au plus gros volume sur la plupart des tableaux et celui qui enterre tout le reste. Si vous ne séparez qu’une chose, séparez celle-là.',
      },
    },
    roles: {
      title: 'Rôles et pseudos',
      body: [
        'Les deux synchronisations sont coupées jusqu’à leur activation sous **Admin → Discord → Roles & nicknames**, et toutes deux suivent la liste des membres. Activez **Enable Discord role sync**, laissez **Auto-match in-game rank → Discord role by name** activé, choisissez au besoin des **Member roles** et **Guest roles** généraux, enregistrez, puis appuyez sur **Sync roles & nicknames now**. Chaque personne doit aussi avoir un compte Discord lié ; le rapport de synchronisation nomme quiconque n’a pas pu être identifié.',
      ],
      ways: [
        {
          term: 'Synchronisation des rôles',
          body: 'Associez vos rangs en jeu à des rôles Discord et Anvil les maintient alignés. Il y a aussi des rôles uniques pour les membres, les invités, les capitaines et l’événement en cours, pour pouvoir mentionner les bonnes personnes sans tenir une liste à la main.',
        },
        {
          term: 'Synchronisation des pseudos',
          body: 'Met le pseudo serveur d’un membre à son RSN. Par défaut elle remplit un pseudo vide, et on peut lui demander d’écraser celui que quelqu’un a choisi — c’est le réglage auquel réfléchir avant, pas après.',
        },
      ],
      note: {
        tag: 'Le rôle du bot doit être au-dessus de ceux qu’il gère',
        body: 'Discord n’autorise aucun bot à toucher un rôle au niveau du sien ou au-dessus, et il refuse en silence de votre côté — la synchronisation ne fait alors simplement rien. Remontez le rôle Anvil dans **Paramètres du serveur → Rôles** et ça se met à marcher ; rien n’a besoin d’être réinvité.',
      },
    },
    commands: {
      title: 'Commandes slash',
      body: [
        'Le bot répond à `/bingo` sur votre serveur (la grille, le classement, les règles, votre propre carte), ainsi qu’à des commandes de clan comme `/sotw`, `/stats` et `/coffer`. Elles lisent le site en direct, donc personne n’a à quitter Discord pour savoir où il en est. [Chaque commande et ses options]({commandsGuide}) a sa propre page.',
        'Elles apparaissent une minute environ après l’arrivée du bot. Si elles n’apparaissent jamais, l’invitation a accordé le bot mais pas ses commandes — ce sont deux permissions distinctes, et un ancien lien d’invitation n’en demandait qu’une. Relancez **Invite / re-invite the bot** sous **Connection** sur la page Discord ; cela n’expulse pas le bot et ne réinitialise rien.',
      ],
      note: {
        tag: 'Il répond dans la langue de chacun',
        body: 'Par défaut, le bot répond dans la langue que ce membre a réglée dans Discord, avec l’anglais en repli. Choisissez une seule langue sous **Langue du bot** pour l’imposer à tous — c’est aussi le seul moyen d’avoir l’arabe, puisque Discord n’a pas de langue client arabe à détecter.',
      },
    },
    posts: {
      title: 'Ce qu’il publie, et quand',
      body: [
        'Deux sources, et il vaut la peine de savoir laquelle est laquelle quand quelque chose semble anormal.',
        'Le **site** publie les événements : un tableau qui ouvre, les inscriptions, un lancement, les classements, le résultat. Cela part d’Anvil lui-même et fonctionne que quelqu’un ait le plugin ou non.',
        'Le **plugin** publie ce qui se passe en jeu : drops, familiers, morts, niveaux, cases du collection log, combat achievements. Cela n’existe que pour les membres qui le font tourner, donc un salon de drops silencieux signifie en général un plugin silencieux plutôt qu’un webhook cassé.',
      ],
      note: {
        tag: 'Rien n’est publié deux fois',
        body: 'Un drop qui complète une case fait un message, pas un du plugin et un autre du tableau.',
      },
    },
    modes: {
      title: 'Leagues, Deadman et autres modes',
      body: [
        'Leagues, Deadman, hardcore et les autres modes tournent sur leurs propres mondes, avec leurs propres personnages. Leurs posts sont toujours étiquetés et ne comptent jamais pour les tableaux ni pour les compétitions. Ils ont leur propre onglet : **Admin → Discord → What goes where → Game modes**. Un mode y apparaît la première fois qu’un membre y joue.',
        'Chaque mode a un interrupteur et un canal **To**. Activez **Send game-mode posts to their own channels** pour utiliser ces canaux ; si vous le laissez désactivé, chaque mode publie dans les canaux habituels, toujours étiqueté. Le bouton **Posts** sur la ligne d’un mode liste tous les types qu’il envoie, les habituels comme les événements propres au mode, chacun avec son propre interrupteur.',
        'Sous cette liste, **Custom thresholds** permet à un mode de publier moins que le jeu principal. **Post drops rarer than 1 in…** (au moins 2) et **Post drops worth at least (gp)** (au moins 1,000) fixent leurs propres seuils (vide = identique au jeu principal). Appuyez ensuite sur **Save drop thresholds** : les objets toujours publiés le restent, mais les drops qui ne comptent que par leur valeur ne le sont plus. **Use its own level milestones** ne publie un passage de niveau que s’il respecte les deux jeux de règles.',
      ],
      note: {
        tag: 'Plus strict, jamais plus souple',
        body: 'Les filtres d’un mode ne peuvent que retirer des publications. Le plugin a déjà appliqué vos réglages du jeu principal, donc aucun filtre de mode ne peut faire revenir une publication.',
      },
    },
    cleanup: {
      title: 'Anciens webhooks d’autres plugins ou bots',
      body: [
        'Avec le bot sur votre serveur, la page Discord liste chaque webhook qui s’y trouve et qui n’appartient pas à Anvil. **Coming from other plugins?** propose **Use the same channels**, pour que **Set it up for me** publie là où vos anciens flux publiaient et que rien ne bouge pour vos membres.',
        'Une fois vos membres sur Anvil, allez dans **Remove old webhooks from other plugins**, cochez ceux à supprimer et appuyez sur **Remove … webhooks**, puis sur **Yes, remove them**. Cela les supprime définitivement dans Discord — c’est irréversible.',
        'La liste contient tout webhook qui n’appartient pas à Anvil, pas seulement ceux d’autres plugins. Il y en a un que vous voulez garder, comme le flux d’un autre bot ? Appuyez sur **Keep** et il quitte la liste ; **Show kept** et **Put back** le font revenir. Le garder ne fait que le masquer ici — rien ne change dans Discord.',
      ],
      note: {
        tag: 'Nécessite « Gérer les webhooks »',
        body: 'Le bot lit les webhooks de votre serveur pour les trouver. Sans _Gérer les webhooks_ sur son rôle, la page indique qu’il ne peut pas les voir.',
      },
    },
    announce: {
      title: 'Publier sur Discord',
      body: [
        'Les admins peuvent publier en tant que bot depuis **Post to Discord**, sous **Clan** dans le menu d’administration. Choisissez un **Channel**, écrivez le **Message** et appuyez sur **Send message**. Un long texte, comme un règlement, est découpé tout seul en plusieurs messages.',
        '**Send as an embed** est activé par défaut et ajoute un **Title** facultatif et une **Accent colour** ; désactivez-le pour du texte brut. **Ping** choisit un rôle, ou @everyone, à mentionner, et Anvil demande confirmation avant d’envoyer.',
        'Chaque publication envoyée est listée sous **Sent from here**. **Edit** la modifie dans Discord sans mentionner à nouveau, et **Delete** la supprime.',
      ],
      note: {
        tag: 'Admins seulement, avec le bot',
        body: 'Il publie en tant que bot d’Anvil, connectez donc d’abord votre serveur. Les modérateurs ne le voient pas. C’est l’interrupteur **Post to Discord** sous **Clan settings → Features** ; désactivé, il disparaît du menu.',
      },
    },
    quiet: {
      title: 'Quand ça devient silencieux',
      body: [
        'Dans l’ordre, parce que chaque point élimine le suivant :',
      ],
      checks: [
        {
          term: 'Le bot est-il réellement sur le serveur ?',
          body: '**Connection** sur la page Discord le dit directement. « Token valide » et « sur votre serveur » sont deux faits différents et le premier n’implique pas le second — avec un bot partagé, le token est toujours valide.',
        },
        {
          term: 'L’identifiant du serveur est-il le bon ?',
          body: 'Un identifiant faux mais réel ressemble exactement à un bon, jusqu’à ce que vous remarquiez que les messages partent ailleurs.',
        },
        {
          term: 'Le webhook existe-t-il encore ?',
          body: 'Supprimer un salon Discord supprime son webhook, et Anvil garde l’URL morte. Choisissez-lui à nouveau un salon sous **What goes where**.',
        },
        {
          term: 'Le rôle du bot est-il assez haut ?',
          body: 'Uniquement pour la synchronisation des rôles et des pseudos — voir plus haut. C’est celui qui échoue en silence.',
        },
      ],
      note: {
        tag: 'Il ne peut pas accueillir les arrivants',
        body: 'Discord ne signale les arrivées que via une connexion gateway, qu’un bot partagé ne maintient pas pour chaque serveur. Il n’y a donc pas de message de bienvenue — mettez plutôt le lien d’inscription dans un salon #roles ou #commencer-ici, là où les gens regardent de toute façon.',
      },
    },
    drops: {
      title: 'Seuils de drop',
      body: [
        'Anvil démarre à **1m gp** ou **1 in 1,000**. Un drop est publié dès qu’il atteint l’un des deux. Personne ne peut fixer des valeurs inférieures à celles-ci, et 0 désactive un seuil.',
        'Définissez les valeurs par défaut de votre clan dans **Admin → Discord → What goes where → Drops** : **Default minimum drop value (gp)**, **Default: post drops rarer than 1 in…** et **Require both**. Activez **Require both** et un drop doit atteindre la valeur **and** la rareté.',
        'Chaque personnage suit la valeur par défaut du clan dont il est membre, et celle d’Anvil s’il n’en a pas. Les joueurs peuvent choisir leurs propres valeurs dans **Settings**. Il affiche **Using clan default** ou **Custom**, et **Reset** revient en arrière.',
        '**Hard floor: never post drops more common than 1 in…** est la règle stricte. Les membres ne peuvent pas aller au-delà dans les canaux de votre clan. Leurs propres webhooks, si.',
      ],
      note: {
        tag: 'Plus d’informations côté joueur',
        body:
          'Les valeurs, modèles et webhooks personnels des joueurs se trouvent dans [Settings, page by page]({settingsGuide}).',
      },
    },
    pools: {
      title: 'Plus de webhooks pour les canaux chargés',
      body: [
        'Un webhook ne peut envoyer qu’à une certaine vitesse. Pour un événement chargé, ajoutez d’autres webhooks au même canal. Appuyez sur **Busy channel? Let the bot add … more webhooks** (il faut **Manage Webhooks**) ou collez plusieurs liens de webhook dans la zone du canal. Anvil en suggère davantage dès que vous avez 50 joueurs ou plus, beaucoup de posts par minute, ou si Discord a récemment dit « slow down ». Jusqu’à 10, c’est largement suffisant.',
        'Anvil alterne entre eux. Si Discord dit « slow down » à l’un, ce webhook se repose un moment et le suivant prend le post. Si l’un est supprimé ou ne fonctionne plus, il est ignoré pendant 10 minutes. Les posts continuent tant qu’au moins un webhook fonctionne.',
        'Ils doivent tous pointer vers le même canal. Anvil vous prévient s’ils ne le font pas. Utilisez **Test** pour en vérifier un, ou **Stop posting here** pour le retirer.',
      ],
      note: {
        tag: 'Même canal, mêmes posts',
        body:
          'Davantage de webhooks ne publient jamais deux fois. Ils se partagent simplement le travail. La même idée apparaît dans [Seuils de drop](#drops) plus haut, et côté admin dans [Running the event]({adminGuide}).',
      },
    },
  },

  plugin: {
    metaTitle: 'Installer le plugin RuneLite — Anvil',
    metaDescription:
      'Installer le plugin RuneLite d’Anvil, vous connecter depuis son panneau latéral, et configurer les notifications Discord.',
    eyebrow: 'Anvil · plugin RuneLite',
    title: 'Guide d’installation pour les joueurs',
    dek: 'Installez-le, connectez-vous, et jouez. Le plugin soumet vos drops de bingo, publie vos drops rares, vos morts et vos paliers sur Discord, et vous permet de rechercher n’importe qui d’un clic droit.',
    facts: [
      { strong: '1 bouton', rest: 'et le suivi tourne' },
      { strong: '~3 min', rest: 'pour l’installation de base' },
      { strong: 'Un clic droit', rest: 'pour rechercher n’importe qui' },
    ],
    footnote:
      'Les captures viennent d’une installation réelle — le jeton de compte est masqué volontairement. Le vôtre doit rester tout aussi privé.',

    install: {
      title: 'Installer le plugin',
      body: [
        'Dans RuneLite : **Configuration** (la clé à molette) → **Plugin Hub** → cherchez **Anvil** → **Install**. L’éditeur est `AhmedFathy2001`.',
        'Un seul plugin sert tous les clans — il se connecte toujours à `anvilosrs.com`, et c’est la connexion (étape suivante) qui le relie à vous et à vos clans. Il n’y a rien de spécifique au clan à télécharger, ni d’adresse à saisir. Une fois installé, un bouton **Anvil** apparaît dans la barre latérale de RuneLite, et ses réglages se trouvent sous **Configuration → Anvil**.',
      ],
    },

    connect: {
      title: 'Se connecter',
      intro: 'Ouvrez le panneau **Anvil** depuis la barre latérale de RuneLite et cliquez sur **Sign in with Discord**. Votre navigateur s’ouvre sur `anvilosrs.com` ; validez le code là-bas et le plugin se connecte tout seul — rien à taper, rien à copier, et rien à remplir dans les réglages.',
      panelFigure: {
        caption: 'RuneLite → le bouton Anvil',
        alt: 'La barre d’icônes de RuneLite, avec le bouton Anvil entouré tout en bas',
        legend: [
          {
            label: 'Le bouton Anvil',
            body: 'sur le côté de la fenêtre RuneLite, tout en bas de la barre d’icônes. Cliquez dessus pour ouvrir le panneau. Il apparaît dès que le plugin est installé et activé — et vous pouvez le faire glisser vers le haut de la barre si vous le préférez près du sommet.',
          },
        ],
      },
      signInFigure: {
        caption: 'Le panneau Anvil',
        alt: 'Le panneau Anvil, avec le bouton Sign in with Discord et le site auquel il se connecte encadrés',
        legend: [
          {
            label: 'Sign in with Discord',
            body: 'ne s’affiche que tant que cet ordinateur est déconnecté. Cliquez dessus : le reste se passe dans votre navigateur.',
          },
          {
            label: 'Connects to',
            body: 'toujours `anvilosrs.com` — le seul site auquel le plugin parle, et celui auquel votre jeton appartient.',
          },
          {
            label: 'Paste a token instead',
            body: 'la solution de secours, si l’étape dans le navigateur ne fonctionne pas chez vous — voir la fin de cette étape.',
          },
        ],
      },
      easySteps: [
        'Cliquez sur **Sign in with Discord**. Le panneau affiche un code court et ouvre votre navigateur sur `anvilosrs.com`.',
        'Connectez-vous avec Discord là-bas si ce n’est pas déjà fait, vérifiez que le code de la page correspond à celui de RuneLite, puis cliquez sur **Approve**.',
        'De retour dans RuneLite, le haut du panneau indique _Signed in_ — et, une fois en jeu, quel personnage est suivi. C’est tout.',
      ],
      linkFigure: {
        caption: 'anvilosrs.com → /link-device',
        alt: 'La page Link your RuneLite client, avec le champ de code et le bouton Approve encadrés',
        legend: [
          { label: 'Le code', body: 'il doit correspondre à ce que le plugin vous affiche en ce moment.' },
          {
            label: 'Approve',
            body: 'n’approuvez qu’un code que _votre propre_ client affiche. Si quelqu’un vous a envoyé un lien ou un code, refusez — approuver reviendrait à lui donner votre compte.',
          },
        ],
      },
      directNote: {
        tag: 'Où cela se passe',
        body: [
          'Tout ce parcours reste sur `anvilosrs.com` — le code y est émis, vous l’y approuvez avec votre propre connexion Discord, et le jeton repart directement vers le plugin. Le plugin n’ouvre que des pages de connexion sur `anvilosrs.com` : un lien de connexion qui pointe ailleurs ne vient donc pas de lui.',
        ],
      },
      federationAside:
        'À ne pas confondre avec **Connect clans** dans le panneau latéral — c’est le bouton distinct et facultatif qui vous relie à d’autres clans Anvil, et il n’apparaît qu’une fois que vous êtes déjà connecté ici.',
      manualFallback:
        'Si le navigateur ne s’ouvre pas tout seul, le panneau affiche l’adresse et le code pour que vous puissiez l’ouvrir à la main. Les codes expirent au bout de dix minutes — appuyez simplement de nouveau sur le bouton.',
      manualHeading: 'En secours : collez votre jeton à la main',
      manualIntro:
        'Si la connexion depuis le plugin ne fonctionne pas chez vous, copiez votre jeton ci-dessous (ou depuis [Profile → plugin token](/profile#plugin-token), où vous pouvez aussi le renouveler), puis cliquez sur **Paste a token instead** sous le bouton de connexion du panneau Anvil et collez-le là.',
      tokenFigure: {
        caption: 'Profile → RuneLite plugin',
        alt: 'La carte RuneLite plugin sur la page de profil, avec le champ de jeton et les boutons Reveal, Copy et Rotate encadrés',
        legend: [
          {
            label: 'Votre jeton',
            body: 'masqué jusqu’à ce que vous appuyiez sur Reveal. Il est volontairement flouté sur cette capture ; ne publiez jamais le vôtre sur Discord.',
          },
          {
            label: 'Copy / Rotate',
            body: 'copiez-le, puis utilisez **Paste a token instead** dans le panneau Anvil. Rotate en émet un nouveau et tue l’ancien — servez-vous-en si vous soupçonnez une fuite de votre jeton.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Utilisez le panneau latéral au quotidien',
        body: ['**Le panneau latéral Anvil est votre espace de travail principal** : connectez-vous et déconnectez-vous depuis celui-ci, consultez vos clans et événements actifs, parcourez et réclamez des cases, suivez votre progression, prenez les captures de départ, lancez les synchronisations et ouvrez les outils d’assistance. **Configuration → Anvil**, illustré ci-dessous, sert uniquement aux préférences — il n’y a aucun jeton dedans. Pour déconnecter cet ordinateur, ouvrez le menu **⋯** à côté de votre nom en haut du panneau. Une seule connexion couvre tous les événements auxquels vous êtes inscrit — inutile de la refaire pour chaque bingo.'],
      },
    },

    accounts: {
      title: 'Reliez vos comptes',
      body: [
        'Une fois le jeton configuré, les comptes avec lesquels vous jouez apparaissent automatiquement sur votre profil. Un compte tout neuf peut être relié immédiatement ; un compte déjà présent dans la liste d’un clan demande d’abord une vérification de propriété, car un nom RuneScape public ne prouve pas son propriétaire.',
        'Pour cette première liaison, utilisez [la vérification rapide par XP](/profile#link-account) ou demandez à un modérateur du clan de valider le compte dans [les comptes détectés](/profile#detected-accounts). Ensuite, son empreinte stable suit les changements de nom et le reconnaît automatiquement.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'La carte RuneScape Accounts sur la page de profil listant les comptes vérifiés via le plugin',
        legend: [
          {
            label: 'Vos comptes reliés',
            body: 'tout ce qui porte « Verified via plugin » est relié et sera reconnu automatiquement. Les comptes déjà inscrits dans un clan peuvent d’abord demander une vérification unique par XP ou par un modérateur.',
          },
        ],
      },
      noPluginHeading: 'Vous ne pouvez pas faire tourner le plugin ?',
      noPluginIntro:
        'Sur mobile ou sur le client officiel, utilisez plutôt [Profile → account linking](/profile#link-account) :',
      noPluginOptions: [
        '**Verify by XP** — saisissez votre RSN, le site choisit une compétence au hasard, et vous devez y gagner 1 000 XP en 30 minutes.',
        '**Manual review** — pour des Hiscores masqués ou un compte secondaire tout neuf : envoyez votre RSN avec une note et un modérateur l’approuve.',
      ],
      signupNote:
        'L’inscription aux événements exige au moins un compte vérifié, réglez donc cela avant de vous inscrire.',
    },

    working: {
      title: 'Vérifier que ça marche',
      intro:
        'Connectez-vous et lisez votre fenêtre de chat. Le plugin vous salue quand il est connecté et qu’un événement est en cours.',
      chat: [
        { text: 'Bingo running: Summer Bingo 2026.', tone: 'gold' },
        { text: 'Skill of the Week is live: Runecraft.', tone: 'gold' },
        { text: '…plus tard, au fil des événements…', tone: 'muted' },
        { text: 'Tracked drop detected: Dragon warhammer (1/1)', tone: 'plain' },
        { text: 'Tracked kill: Zulrah (7/10)', tone: 'plain' },
      ],
      outro:
        'Tu devrais aussi voir le **panneau latéral Anvil** se remplir avec tes clans, tes événements en cours, ton classement et les boutons de synchronisation — et un bouton **Anvil** apparaître dans la barre de titre de ton Collection Log en jeu.',
      guestNote: {
        tag: 'Invité ou membre',
        body: 'Si le chat dit _Tracked as a guest_, vous êtes suivi mais vous n’êtes pas encore sur la liste des membres du clan. Un admin corrige ça en synchronisant la liste depuis le jeu — demandez {discordLink}.',
        discordWord: 'sur Discord',
      },
      panelHeading: 'Le panneau latéral',
      panelBody: [
        'Quatre onglets et une roue dentée. **Clan**, ce sont tes événements et ton clan : chaque bingo et chaque compétition hebdomadaire en cours ou à venir avec ta position. **Feed**, ce sont les grands moments de ton clan et de tes plateaux au moment où ils arrivent, avec le chat d’événement. **You**, c’est ton propre profil, et **Lookup** trouve celui de n’importe qui d’autre, joueur ou clan. La roue dentée regroupe la synchronisation et les sons de ta bannière.',
        'Chaque onglet, le chat d’événement, les réactions et les réglages qui amènent le fil et les couleurs Supporter dans ton jeu sont expliqués dans [Le panneau latéral, onglet par onglet]({panelGuide}).',
      ],
      panelFigure: {
        caption: 'Clan · You · Lookup',
        alt: 'Les trois onglets du panneau latéral Anvil côte à côte : l’onglet Clan avec les événements et la semaine du clan, l’onglet You avec ton collection log, et l’onglet Lookup affichant la carte d’un autre joueur',
      },
      lookupHeading: 'Rechercher n’importe qui',
      lookupBody:
        'Fais un clic droit sur un joueur — à côté de toi, ou sur son nom dans le chat, ta liste d’amis ou le panneau du clan — et choisis **Anvil** pour ouvrir sa carte dans l’onglet **Lookup** du panneau latéral. La tienne, c’est l’onglet **You**.',
      lookupFigure: {
        caption: 'Clic droit sur un nom → Anvil',
        alt: 'Le menu clic droit d’un joueur en jeu avec une entrée Anvil sous Lookup',
      },
      lookupSettingNote:
        'Choisis où l’entrée **Anvil** apparaît sous **Player lookup** dans les paramètres du plugin. Sur un nom dans le chat, ce n’est jamais l’option du clic gauche : cliquer sur un nom fait donc toujours ce que fait le jeu.',
      lookupSettingFigure: {
        caption: 'Configuration → Anvil → Player lookup',
        alt: 'La section Player lookup des paramètres d’Anvil, chaque réglage encadré et numéroté',
        legend: [
          {
            label: 'Anvil lookup on players',
            body: 'l’interrupteur principal. Désactivé, l’entrée disparaît partout.',
          },
          {
            label: 'Players in the world',
            body: 'le clic droit sur un joueur qui se tient près de toi.',
          },
          {
            label: 'Chatbox and private messages',
            body: 'les noms dans la chatbox et dans le chat privé.',
          },
          {
            label: 'Clan panels / Friends chat / Friends, ignore and party lists',
            body: 'les listes de noms : les membres de ton clan et du clan invité, le salon du friends chat, tes listes d’amis et d’ignorés, et le panneau du groupe de raid.',
          },
        ],
      },
    },

    bingo: {
      title: 'Réglages du bingo',
      intro:
        'Ils ne comptent que pendant un événement. Les valeurs par défaut conviennent — voici ce que chacun fait réellement.',
      figure: {
        caption: 'Configuration → Anvil → Bingo',
        alt: 'La section Bingo des réglages du plugin, chaque réglage encadré et numéroté',
        legend: [
          {
            label: 'Show Overlay',
            body: 'dessine un petit panneau _Anvil / équipe / date UTC_ en haut à gauche. Il fait partie de l’image dans vos captures de preuve, et c’est précisément ce qui rend une preuve difficile à falsifier ou à antidater. Il est désactivé sur cette capture — activez-le si votre clan veut voir l’équipe et l’heure sur chaque preuve.',
          },
          {
            label: 'Team completion popups',
            body: 'une bannière quand quelqu’un de votre équipe termine une case. Plusieurs d’un coup : la plus difficile obtient la bannière, le reste part dans le chat.',
          },
          {
            label: 'My tile popups',
            body: 'une popup quand votre propre drop fait avancer une case ou la termine. Désactivé, le suivi continue — simplement en silence.',
          },
          {
            label: 'Banner sound + volume',
            body: 'joue un son avec la bannière. Rien ne se déclenche tant que tu n’ajoutes pas toi-même au moins un .wav, via **Add clip** sous « Banner sounds » dans le panneau latéral Anvil. Les missions ont leur propre dossier : ajoutez un clip sous **Mission sounds** et elles le joueront à la place du son intégré qui les distingue d’une case terminée.',
          },
          {
            label: 'Auto starting shot',
            body: 'prend la photo de départ d’un événement pour vous dès que vous vous tenez sur l’endroit épinglé. Désactivé, c’est à vous d’appuyer sur **Take starting shot** dans le panneau latéral.',
          },
        ],
      },
      teamsHeading: 'Les équipes',
      teamsBody:
        'Le bouton **Teams** d’un événement liste ses équipes par classement, la vôtre en tête. Ouvrez-en une pour voir sa composition, capitaine en premier, ou cherchez un joueur dans toutes les équipes — cliquez sur un nom pour le rechercher.',
      teamsFigure: {
        caption: 'Événement → Teams',
        alt: 'La page Teams listant les équipes d’un événement avec leurs points et leur nombre de membres, à côté de la composition d’une équipe, capitaine en premier',
      },
      startHeading: 'Photo de départ',
      startBody: [
        'Certains événements demandent à tous une **photo de départ** : une capture prise après le lancement de l’événement, à un endroit tiré au sort à l’instant du départ. Cela empêche quiconque de passer la semaine précédente à stocker des clues, des coffres et des kills à déverser le premier jour.',
        'Si vous utilisez le plugin, il n’y a rien à préparer. Au démarrage, une ligne de chat vous indique où aller, et le panneau latéral Anvil affiche un bouton **Take starting shot**. Placez-vous où c’est indiqué, appuyez une fois, et c’est fait — le plugin capture l’image, y appose votre RSN, votre équipe, le lieu et un mot-clé que seul votre compte reçoit, et l’archive pour vous.',
        'Il vérifie deux choses avant d’archiver quoi que ce soit, pour que vous les corrigiez en jeu plutôt que dans une dispute Discord après coup. Si l’organisateur a épinglé l’endroit sur la carte, le plugin sait à quelle distance vous êtes et vous le dit, au lieu d’envoyer une image du mauvais bout de Gielinor. Et si l’événement exige une session fraîche, vous devez **vous déconnecter et vous reconnecter** avant de la prendre : vos hiscores ne sont enregistrés qu’à la déconnexion, une reconnexion juste avant la photo est donc ce qui rend vos totaux de départ — et par conséquent chaque case XP et KC — corrects.',
        'Sur mobile, ou sans le plugin : ouvrez **My Team** sur ce site, lisez votre mot-clé sur la carte de photo de départ, tapez-le dans le chat en jeu, prenez une capture où votre personnage et le mot-clé sont visibles, et envoyez-la sur cette même carte. Cet envoi compte immédiatement — vous pouvez jouer dès qu’il est passé, et l’équipe le vérifie après coup. Déconnectez-vous et reconnectez-vous d’abord si la carte vous le demande.',
      ],
    },

    notifications: {
      title: 'Notifications Discord',
      intro:
        'Elles partent qu’un bingo soit en cours ou non, et se publient dans les salons du clan. Dans quel salon, ce sont les admins qui le décident ici — vous ne choisissez que _quoi_ publier. Avec la prochaine mise à jour du plugin, ces choix passent sur le site, dans **Settings → Discord posts & screenshots**, et vous suivent sur chaque ordinateur. Sur la même page, **Screenshot privacy** choisit quel chat (messages privés, chat public, chat de clan) est masqué sur chaque capture prise par le plugin. Le plugin garde deux interrupteurs dans **Notifications** : **Share clan posts** met en pause d’un coup toutes les publications du jeu principal, et **Share seasonal activity** fait de même sur Leagues, Deadman et les autres mondes saisonniers.',
      examplesFigure: {
        caption: 'À quoi ressemble une publication',
        alt: 'Deux publications Discord d’Anvil : une tâche de combat Grandmaster avec ses points et la progression vers le prochain palier, et une mort avec son message, chacune accompagnée d’une capture du moment',
      },
      dropsFigure: {
        caption: 'Deaths & kills · Drops & pets',
        alt: 'Les sections de notification Deaths and kills et Drops and pets, chaque réglage encadré et numéroté',
        legend: [
          {
            label: 'Notify on death',
            body: 'publie dans le canal des morts du clan avec une capture du moment où vous êtes mort.',
          },
          {
            label: 'Death message',
            body: 'votre propre phrase. `{name}` est remplacé par votre RSN.',
          },
          {
            label: 'Notify on PvP kill',
            body: 'une capture du tick où votre cible tombe à 0 HP. Désactivé par défaut ; activé ici.',
          },
          {
            label: 'Notify on rare drops',
            body: 'l’interrupteur général des posts de drops.',
          },
          {
            label: 'Min drop value / Min drop rarity',
            body:
              'un drop est publié s’il vaut au moins ce montant (GE ou high alch, le plus élevé des deux) ou s’il est plus rare que 1 sur N. Anvil démarre à 1m et 1/1,000. Votre clan peut définir ses propres valeurs par défaut pour ses membres ; tant que vous ne fixez pas de nombre, vous suivez celui du clan. **Reset to clan default** (ou **Reset to Anvil default** si vous n’avez pas de clan) revient à ce suivi. Un clan peut aussi fixer un seuil de rareté strict, qui ne s’applique qu’aux posts dans ses propres canaux. Votre nombre ne peut pas être plus permissif là-bas, et cela ne change jamais la limite de valeur. Mettez l’un des deux nombres à 0 pour le désactiver.',
          },
          {
            label: 'Value and rarity together',
            body:
              'par défaut, un drop est publié s’il atteint la valeur **or** la rareté. Activez **Require both** et il doit atteindre la valeur **and** la rareté. Votre clan peut choisir ce défaut pour ses membres ; tant que vous ne choisissez pas, vous le suivez, et sans clan c’est l’un ou l’autre. Chacun de vos webhooks peut aussi fixer sa propre valeur minimale, sa rareté, et choisir entre l’un ou les deux ; ce qu’il laisse vide suit vos réglages.',
          },
          {
            label: 'Loot key value',
            body:
              'une clé de butin est publiée une seule fois, comme une seule notification, lorsque tout son contenu atteint ce nombre.',
          },
          {
            label: 'Notify on pets',
            body: 'les pets sont publiés dans le canal des drops rares.',
          },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · collection log · levels · diaries · quests',
        alt: 'La section de notification Combat achievements, chaque réglage encadré et numéroté',
        legend: [
          {
            label: 'CA post tier',
            body: 'le palier de tâche le plus bas qui est publié ; les paliers terminés sont publiés aussi. La valeur par défaut est Master ; Grandmaster ne publie que les plus rares, **Off** ne publie rien. Les cases CA du bingo comptent dans tous les cas.',
          },
          {
            label: 'Notify on collection log slots',
            body: 'chaque nouvel emplacement du collection log.',
          },
          {
            label: 'Notify on level milestones',
            body: 'les montées de niveau que votre clan a choisi d’annoncer — par défaut les 99, chaque tranche de 100 niveaux totaux à partir de 1800, et le max. Ce sont les admins de votre clan qui fixent les règles ; vous pouvez publier moins (ou fixer vos propres règles pour vos webhooks personnels) depuis la section Announcements de votre profil.',
          },
          {
            label: 'Notify on diary completions',
            body: 'les paliers d’achievement diary, avec une capture.',
          },
          {
            label: 'Quest post tier',
            body: 'les quêtes à partir de la difficulté que vous choisissez, de All (toutes les quêtes) jusqu’à Grandmaster ; **Off** n’en publie aucune. La valeur par défaut est Master. Les cases de quête du bingo comptent dans tous les cas.',
          },
        ],
      },
    },

    trouble: {
      title: 'Quand quelque chose casse',
      intro:
        'Le plugin vous prévient dans le chat quand le suivi s’est arrêté — il attend environ 90 secondes avant de se plaindre et se répète au plus toutes les 5 minutes.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Le jeton est faux ou a été renouvelé. Ouvrez le menu **⋯** en haut du panneau Anvil, appuyez sur **Sign out**, puis à nouveau sur **Sign in with Discord** — ou utilisez **Paste a token instead** avec un jeton neuf depuis [Profile → RuneLite plugin](/profile#plugin-token).',
        },
        {
          term: '`Anvil: can’t reach the site (anvilosrs.com) — tracking is OFF.`',
          body: 'Le plugin n’arrive pas à joindre `anvilosrs.com`. Vérifiez votre connexion internet, ainsi qu’un éventuel pare-feu ou VPN qui bloquerait RuneLite. Si tout va bien de ce côté, le site est probablement indisponible un instant — le plugin se reconnecte tout seul.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Ce compte n’est pas encore relié. Ouvrez [Profile → comptes détectés](/profile#detected-accounts) pour l’ajouter ou lancer la vérification de propriété.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Rien. Il s’est rétabli tout seul.',
        },
        {
          term: '« <RSN> belongs to another Anvil player »',
          body: 'Quelqu’un d’autre a relié ce personnage sur Anvil en premier, donc rien ne compte pour lui depuis votre connexion. S’il est vraiment à vous, appuyez sur **This is my account** dans l’onglet **You** du panneau et passez la petite vérification d’XP. Ensuite, le propriétaire actuel est consulté, ou l’équipe Anvil tranche. Vous ne saurez jamais qui c’est. Suivez la demande dans [Settings → Ownership claims](/settings/claims).',
        },
      ],
      logHeading: 'Toujours bloqué ? Envoyez un journal à un admin',
      logBody:
        'Envoyez votre journal RuneLite à un admin : `client.log`, dans le dossier `.runelite/logs` de votre dossier utilisateur (sous Windows, collez `%USERPROFILE%\\.runelite\\logs` dans la barre d’adresse de l’Explorateur de fichiers). Le plugin y note ce qu’il a vu et pourquoi, pour que l’admin voie exactement ce qui a échoué.',
      missingNote: {
        tag: 'Des preuves manquantes ?',
        body: 'Les familiers et les Champion’s scrolls en double demandent une capture manuelle. Le plugin la prend pour toi et l’enregistre dans `.runelite/osrs-bingo-pending/` — **Copy folder path** dans le panneau latéral Anvil ouvre le dossier — pour que tu la joignes sur le site au lieu de chercher une image après coup.',
      },
    },
    limits: {
      title: 'Limites connues',
      intro:
        'Quelques éléments ne peuvent pas être suivis parfaitement — presque toujours à cause de ce que le jeu lui-même rapporte, pas d’Anvil. La solution est chaque fois la même : faites une capture d’écran et soumettez-la manuellement.',
      rows: [
        {
          term: 'Le barraging et les autres kills multi-cibles',
          body: 'Les compteurs de kills (KC) viennent de ce que le jeu rapporte à chaque kill, et les sorts multi-cibles comme Ice Barrage lui en font rater certains, donc **le KC peut sortir plus bas** que ce que vous avez tué. Le Loot Tracker de RuneLite sous-compte de la même façon — c’est une limite du moteur du jeu, pas un bug d’Anvil.',
        },
        {
          term: 'Les combat achievements déjà réalisés',
          body: 'Activez **repeat completion** dans les paramètres des Combat Achievements du jeu. Sans cela, le jeu n’annonce pas une tâche que vous avez déjà accomplie, et le plugin ne peut créditer que ce que le jeu annonce.',
        },
        {
          term: 'Le combat achievement du contrat Yama',
          body: 'Le jeu ne l’annonce pas de nouveau, même avec repeat completion activé, donc le plugin ne le voit jamais. Faites une capture d’écran et soumettez-la manuellement.',
        },
        {
          term: 'Les cases de collecte sans le plugin',
          body: 'Les quantités d’objets — un nombre de poissons, de minerais, de bûches — ne figurent pas dans les hiscores, donc seul le plugin les suit. Sans lui, faites une capture de chaque inventaire ; ou, si l’objet apparaît dans le Loot Tracker, une capture remis à 0 au début et une autre à la fin.',
        },
        {
          term: 'Implings, poissons, minerais et autres gains d’objets',
          body: 'Attraper des implings et récolter des objets (poissons, minerais et tout ce qui est compté d’après ce qui arrive dans votre inventaire) **n’est parfois pas suivi correctement, même avec le plugin**. Gardez des captures d’écran au fil de l’eau, et si un compte semble trop bas, signalez-le et soumettez la différence manuellement.',
        },
        {
          term: 'Tonneaux à poissons, paniers à bûches et autres rangements',
          body: 'Les cases de gain d’objets ne comptent que ce qui arrive dans ton inventaire **directement depuis la source** — un coin de pêche, un rocher, un arbre. Tout ce qui sort d’un rangement (vider un tonneau à poissons, un panier à bûches, un sac à charbon ou à gemmes, un sac à herbes), qui est acheté en magasin, retiré de la banque ou ramassé au sol **ne compte pas**. Ça garde la case honnête : sinon le même poisson pourrait être mis dans un tonneau et ressorti à l’infini. Ce que tu récoltes directement dans un tonneau ou un panier n’est pas compté.',
        },
        {
          term: "Pets et champion's scrolls en double",
          body: "Quand tu possèdes déjà le pet ou le scroll, le jeu dit seulement que tu as un **« funny feeling »** — il ne précise jamais lequel. Le plugin le déduit de ce que tu viens de tuer ou d'entraîner, valide la case et **la signale au staff pour vérification**. S'il ne peut pas trancher — deux pets de la même source, ou un pet sans kill ni compétence derrière (Bloodhound d'un master clue, un pet Jad ou Zuk obtenu par sacrifice, Chompy chick) — la capture va dans **Saved proofs** pour que tu la soumettes manuellement.",
        },
      ],
    },
    screen: {
      title: 'À l’écran pendant que tu joues',
      intro: 'Ce que le plugin dessine et affiche pendant que tu joues, et le réglage derrière chacun.',
      rows: [
        {
          term: 'Cases épinglées',
          body: 'ouvre une case dans le panneau latéral et appuie sur **Track on screen** (jusqu’à 3). Avec **Pinned tiles in one panel** activé, elles partagent un petit panneau : le nom de chaque case, la progression de ton équipe, et des lignes comme _3/5 runs_ ou les parties d’un combo déjà faites. Désactivé, chacune a son propre widget plus grand avec tes coéquipiers et les autres équipes. Glisse avec Alt pour la déplacer. Clic droit dessus pour **Unpin** ou **Unpin all**. Une case terminée affiche **Done**, puis se désépingle toute seule.',
        },
        {
          term: 'La carte du départ',
          body: 'pendant qu’un événement attend ton signal de départ, une carte **Starting shot needed** en haut de l’écran indique où aller et affiche chaque contrôle en vert ou en rouge : la reconnexion, la durée de ta session, le nombre de cases qui te séparent du point. Une flèche d’aide et une épingle sur la carte du monde (**Anvil starting shot**) te y mènent. Avec **Auto starting shot** activé, le départ est pris dès que tout est vert ; la carte affiche alors **You’re tracked** puis disparaît. Réglage : **Starting shot guide**.',
        },
        {
          term: 'Bannières',
          body: '**Tile complete!** quand ton équipe termine une case, la progression de ton propre drop sur une case, et **New mission!**. Réglages : **Team completion popups** et **My tile popups**.',
        },
        {
          term: 'Tirages de vestige',
          body: 'aux boss de Desert Treasure II, chaque unique affiche une ligne indiquant où tu en es dans la rotation des vestiges, comme _Roll 2 of 4_ ou _the next unique is the vestige_. Elle indique _(estimated)_ tant qu’elle n’a pas encore vu un vestige tomber. Pas de réglage ; cela fonctionne avec ou sans événement.',
        },
        {
          term: 'Saisie anticipée dans Lookup',
          body: 'taper dans la zone **Lookup** complète le nom pour toi, à partir de tes recherches récentes, de tes amis, de tes coéquipiers de clan en ligne et des joueurs proches. **Entrée** valide. Il ne lit que ton propre client ; rien n’est envoyé.',
        },
        {
          term: 'Couleurs du chat',
          body: '**[Anvil] tag colour** et **Message colour** sous **Chat messages**. Tant que tu n’en choisis pas, elles passent en or foncé et noir sur une zone de chat opaque pour rester lisibles. Survole le nom d’un Supporter dans le chat pour voir son palier, comme _Anvil Patron_.',
        },
      ],
    },
    sync: {
      title: 'Synchronisation du profil, et ce qu’elle envoie d’autre',
      intro: 'Les réglages **Profile sync** remplissent ton profil Anvil. Les quatre sont activés au départ :',
      rows: [
        {
          term: 'Synchroniser le journal de collection',
          body: 'chaque page du journal de collection que tu ouvres est envoyée à ton profil.',
        },
        {
          term: 'Synchroniser tout le journal à l’ouverture',
          body: 'ouvrir le journal de collection envoie tout, pas seulement la page que tu regardes. Pour le faire à la demande, appuie sur le bouton **Anvil** dans la barre de titre du journal, ou sur **Sync profile** dans le panneau latéral pendant que le journal est ouvert. Le chat le confirme : _Profile synced — N collection log slots._',
        },
        {
          term: 'Synchroniser les meilleurs temps',
          body: 'les temps de boss et de raids sont envoyés au moment où tu les réalises.',
        },
        {
          term: 'Importer les meilleurs temps existants, une fois',
          body: 'une fois par personnage, copie les meilleurs temps que RuneLite a déjà enregistrés sur ton ordinateur : _Imported N personal best(s) from RuneLite._',
        },
        {
          term: 'Partager les faits marquants avec le clan',
          body: 'tes pets, gros drops, morts, tâches de combat, paliers de niveau, nouvelles cases du journal, journaux de succès et quêtes apparaissent sur le fil de ta page de clan, et dans le fil de chat des joueurs qui peuvent les voir. Les nouvelles cases du journal, journaux de succès et quêtes apparaissent aussi sur le fil de chaque grille en direct à laquelle tu participes.',
        },
      ],
      outro: 'Trois autres éléments sont envoyés sans réglage propre. **Qui t’a tué** : le monstre ou le joueur que tu avais ciblé dans les 15 dernières secondes est nommé dans le fil. **Compteurs de jeu** : certaines cases de kills comptent un nombre que le jeu tient à jour, comme les points de Tithe Farm, la réputation de Giants’ Foundry, les delves de Doom ou les séries de slayer ; seules les hausses comptent. **Leagues, Deadman et autres modes** : sur ces mondes, les messages du jeu sur les reliques, les zones et les tâches sont envoyés pour que ton clan puisse les publier dans son canal de mode.',
    },
  },

  admin: {
    metaTitle: 'Organiser votre premier événement — guide admin Anvil',
    metaDescription:
      'Mettez en place un clan sur Anvil et menez un bingo de bout en bout : Discord, liste des membres, grilles, cases, équipes et draft, lancement, et ce qui se passe une fois l’événement terminé.',
    eyebrow: 'Anvil · pour l’équipe du clan',
    title: 'Organiser votre premier événement',
    dek: 'Tout le chemin, dans l’ordre où vous le parcourrez vraiment : configurer {clanName}, faire entrer la liste des membres, construire une grille, drafter les équipes, lancer le tout, et distribuer les prix. Environ une soirée de travail pour le premier bingo — quelques minutes pour le deuxième.',
    facts: [
      { strong: '5 étapes', rest: 'dans la liste de configuration' },
      { strong: '7 formats', rest: 'pour construire une grille' },
      { strong: '1 bouton', rest: 'pour synchroniser la liste des membres' },
    ],
    footnote:
      'Ce guide suit l’application telle qu’elle est aujourd’hui. Si un écran ici ne correspond pas à ce que vous avez sous les yeux, c’est l’application qui a raison et le guide qui est périmé — [dites-le-nous](/feedback) et nous le corrigerons.',

    access: {
      title: 'Qui peut faire quoi',
      intro:
        'Tout le monde se connecte avec Discord — il n’y a pas de mots de passe. Le premier admin est le propriétaire, celui qui a créé le clan ; ensuite, un admin promeut les autres depuis **People → Staff & roles**. Les rôles s’empilent vers le bas : tout ce qu’un modérateur peut faire, un trésorier et un admin le peuvent aussi.',
      rows: [
        {
          term: 'Admin',
          body: 'accès complet — événements, cases, équipes, réglages, équipe, versements. À donner à aussi peu de gens que le clan peut le supporter.',
        },
        { term: 'Treasurer', body: 'tout ce qu’un modérateur peut faire, plus les frais d’inscription et les versements.' },
        {
          term: 'Moderator',
          body: 'le quotidien : liste des membres, vérifications, preuves à contrôler, compétitions hebdomadaires, le calendrier et les événements du clan. Ne peut ni créer ni modifier d’événements.',
        },
        {
          term: 'Editor',
          body: 'uniquement la création de cases. Accordez-le globalement, ou limitez-le à certaines grilles pour qu’un créateur invité ne touche que l’événement que vous lui avez confié.',
        },
        { term: 'Member', body: 'joue ; ne voit aucune interface d’administration.' },
      ],
      seeAlso:
        'Deux de ces rôles ont leur propre page : [De permanence]({moderatorGuide}) sur ce qu’un modérateur fait réellement de sa soirée, et [Frais et récompenses]({feesGuide}) pour le trésorier.',
      ownerNote: {
        tag: 'Propriétaire',
        body: 'Un compte est le propriétaire. Personne d’autre ne peut le rétrograder, et c’est le seul rôle qui peut transmettre la propriété — perdre une dispute avec un co-admin ne peut donc jamais vous coûter le clan.',
      },
    },

    setup: {
      title: 'Nommer le clan, relier Discord',
      intro:
        '**Settings → Finish setup** est un assistant court (il reste dans le menu jusqu’à ce que vous ayez fini), et le tableau de bord garde une liste de cinq étapes jusqu’à ce qu’elles soient faites : nommer le clan, relier Discord, charger vos membres, créer un événement, ajouter des cases. Le statut est calculé à partir de vraies données, une étape n’est donc cochée que lorsqu’elle est réellement terminée.',
      discord:
        'Pour Discord vous avez deux voies, et elles se combinent : donnez un **bot** à Anvil et il pourra créer des webhooks, synchroniser rôles et surnoms, et construire des salons d’équipe privés ; donnez-lui une simple **URL de webhook** et il pourra publier des annonces et rien d’autre. Commencez par le webhook si vous voulez être en ligne en deux minutes, ajoutez le bot quand vous voulez l’automatisation.',
      permsNote: {
        tag: 'Permissions du bot',
        body: 'Le bot a besoin de _Gérer les webhooks_, _Gérer les rôles_, _Gérer les salons_ et _Gérer les pseudos_, et son rôle doit se situer _au-dessus_ des rôles qu’il gère dans la liste des rôles de votre serveur. Sinon Discord refuse en silence.',
      },
      hosted:
        'Sur une formule hébergée, vous avez déjà croisé cet écran une fois : ajouter le bot pendant l’installation, c’est ainsi qu’Anvil a su quel serveur est le vôtre — il n’y a donc jamais eu d’ID de serveur à copier. Le même lien est ici quand vous voudrez déplacer le bot sur un autre serveur.',
    },

    channels: {
      title: 'Répartir les publications sur plusieurs salons',
      body: [
        'Par défaut, tout part dans un seul salon fourre-tout. Quand il devient bruyant, ouvrez **Discord → What goes where** et donnez aux catégories bavardes leur propre maison — publications d’événement, compétitions hebdomadaires, drops rares, morts, kills PvP, combat achievements. Tout ce que vous laissez vide retombe sur son fourre-tout, vous pouvez donc détacher une catégorie à la fois.',
        'Avec le bot connecté, vous ne touchez jamais à une URL de webhook : choisissez un salon dans la liste déroulante de la ligne et c’est enregistré. Sur un événement chargé, vous pouvez ajouter un second webhook avec **Add another** sous **Post without a bot** — Anvil alterne entre les deux pour que la limite de débit de Discord n’avale pas de publications.',
      ],
      clipsNote: {
        tag: 'Le salon clips est différent',
        body: 'Les vidéos de clips partent directement du PC de chaque joueur vers Discord — elles ne passent jamais par ce site. Le webhook clips que vous réglez ici est donc celui que vous _distribuez_ : les membres le collent eux-mêmes dans leur plugin. Tout le reste de cette page se passe côté serveur, et les membres ne le voient jamais.',
      },
    },

    roster: {
      title: 'Faire entrer votre liste de membres',
      body: [
        'L’appartenance au clan vient d’un seul endroit : une synchronisation de la liste depuis le jeu. Installez [le plugin RuneLite d’Anvil]({pluginGuide}) sur le compte d’un _admin_, ouvrez la fenêtre de clan en jeu et appuyez sur le bouton **Anvil** de sa barre de titre. Cela pousse votre véritable liste de clan depuis le jeu vers le site en un clic.',
        'Se connecter, relier un personnage ou jouer avec le plugin n’inscrit jamais personne sur la liste. Si le plugin voit quelqu’un jouer dans votre clan en jeu avant que la liste ne l’ait, il fait une demande d’adhésion ; n’importe qui d’autre peut demander avec **Apply** sur la page de votre clan. Le staff répond aux demandes en haut de **People → Roster**, et **People → Who can join** décide si les gens attendent un oui, reçoivent tout de suite une place d’invité ou ne peuvent pas demander du tout. C’est délibéré : personne ne rejoint votre clan en tapant son nom. Le tableau complet est dans [Vos membres]({peopleGuide}).',
        'Vous pouvez aussi ajouter quelqu’un à la main depuis **People → + Add Manually**, et l’inscrire à un événement en son nom avec **Add member** sur la page **Sign-ups** de l’événement quand il ne peut pas accéder au site.',
      ],
    },

    board: {
      title: 'Créer votre première grille',
      intro:
        '**Events → All events → + New event**. Choisissez d’abord un format — il décide comment la grille est notée et ce que le reste du formulaire vous demandera.',
      formats: {
        classic: {
          label: 'Bingo classique',
          blurb: 'Une grille carrée N×N — les équipes font les cases dans l’ordre qu’elles veulent, chacune vaut 1.',
        },
        leagues: {
          label: 'Point Hunt',
          blurb: 'Une liste de tâches où chaque case porte sa propre valeur en points — autant de cases que vous voulez.',
        },
        race: {
          label: 'Course de cases',
          blurb: 'Un parcours ordonné — les équipes atteignent les cases dans l’ordre ; qui va le plus loin gagne. L’hôte peut le ramifier en routes qui se séparent et se rejoignent : la case que vous terminez choisit votre chemin.',
        },
        showdown: {
          label: 'Showdown',
          blurb:
            'Les cases restent cachées jusqu’à leur horaire prévu — réglez chaque révélation dans l’onglet Tiles. Aux points, dans l’esprit DMM All Stars.',
        },
        luckydraw: {
          label: 'Tirage au sort',
          blurb: 'Un annonceur de bingo : les cases cachées s’ouvrent par tirages aléatoires à intervalle fixe. Aux points.',
        },
        bounty: {
          label: 'Chasse à la prime',
          blurb:
            'Une seule case ouverte à la fois — la première équipe qui la termine emporte les points, et la prime suivante est tirée.',
        },
        ladder: {
          label: 'Échelle',
          blurb:
            'Une liste de tâches aux points classée en classement individuel (équipes facultatives). Les tâches tournent — progressivement, une à la fois, ou dans une fenêtre glissante — et peuvent perdre de la valeur. Dans l’esprit d’une échelle mensuelle.',
        },
      },
      outro:
        'Réglez ensuite les dates, la fenêtre d’inscription, et si l’inscription coûte des frais. Partez d’un modèle si vous préférez ne pas commencer sur une grille vide — la galerie contient à la fois les modèles intégrés et toute grille que vous avez déjà enregistrée comme modèle.',
      seeAlso:
        'Le format n’est que la moitié de la décision — la façon dont les cases deviennent jouables est l’autre moitié, et les deux se combinent. Les deux en entier : [Formats, et comment les cases s’ouvrent]({formatsGuide}).',
      utcNote: {
        tag: 'Les dates sont en UTC',
        body: 'Chaque horodatage dans Anvil est stocké et comparé en UTC, et affiché dans l’heure locale de chaque visiteur. Réglez l’heure de fin que vous voulez dire ; le site montrera à un Britannique et à un Australien deux horloges différentes pour le même instant.',
      },
    },

    tiles: {
      title: 'Remplir la grille',
      body: [
        'La page **Board & tiles** de l’événement est l’endroit où une grille devient un bingo. Chaque case est un _type_ de tâche, et le type décide de ce que le plugin surveille : un drop, un compteur de kills de boss, de l’XP de compétence, un kill de PNJ, un temps à battre, un achievement diary, un Combat Achievement, un déblocage de collection log, un kill PvP, un gain d’objet, ou une run sans mort. Les cases manuelles — celles qu’un humain valide à partir d’une capture — restent toujours possibles.',
        'Pour une grille complète, créez en masse : exportez la feuille, remplissez-la dans un tableur, et réimportez-la. CSV et .xlsx font l’aller-retour, et les lignes suivent les positions, vous pouvez donc réécrire une grille entière de 25 cases en un seul collage.',
      ],
      rows: [
        {
          term: 'Niveaux de difficulté',
          body: 'les valeurs en points correspondent à des paliers nommés (easy → elite). Modifiez les paliers dans **Clan settings → Rules & scoring → Difficulty & balance** si votre clan classe autrement.',
        },
        {
          term: 'Vérificateur d’équilibre',
          body: 'contrôle une grille terminée à la recherche de problèmes de structure et d’effort déséquilibré avant même que les joueurs la voient.',
        },
        {
          term: 'Cachée jusqu’à révélation',
          body: 'les nouvelles grilles démarrent cachées. L’équipe les voit toujours ; les joueurs ne voient rien avant que vous révéliez — une grille peut donc se construire au grand jour sans être gâchée.',
        },
      ],
      seeAlso:
        'Quel type choisir, comment en écrire deux cents dans un tableur, et les erreurs qui s’importent proprement puis ne se déclenchent jamais : [Construire une grille qui se suit toute seule]({boardGuide}).',
    },

    teams: {
      title: 'Équipes et draft',
      body: [
        'La page **Teams & draft** s’adapte au format choisi : un format sans équipes le saute entièrement. Pour un bingo par équipes classique, vous créez les équipes, décidez qui les capitaine, et soit répartissez les joueurs vous-même, soit organisez un draft en direct.',
        'Les capitaines draftent dans le vivier d’inscrits dans l’ordre que vous choisissez, et chaque capitaine voit les réponses données au formulaire d’inscription — figées telles qu’elles ont été envoyées, pour que personne ne retouche ses « heures par semaine » après avoir été choisi.',
      ],
      placementIntro:
        'Vous n’êtes pas obligé de faire un draft. **Team placement**, dans le formulaire de création et l’onglet **Sign-ups**, décide où arrive chaque nouvel inscrit :',
      placementRows: [
        {
          term: 'Auto-balance',
          body: 'chaque inscrit rejoint l’équipe qui a le moins de joueurs. Vous choisissez seulement le nombre d’équipes. Idéal pour les grands événements publics.',
        },
        {
          term: 'Players pick',
          body: 'vous créez d’abord les équipes, et chaque joueur en choisit une sur le formulaire d’inscription. Fixez une limite par équipe pour garder l’équilibre.',
        },
        {
          term: 'Host drafts',
          body: 'tout le monde attend dans un vivier jusqu’à ce que vous ou vos capitaines les draftiez ou les placiez à la main. Le mieux quand vous connaissez les joueurs.',
        },
        {
          term: 'Solo',
          body: 'pas d’équipes du tout. Chaque joueur joue pour lui-même, sous le nom de son personnage, et le classement range les joueurs.',
        },
      ],
      lockNote: {
        tag: 'Le draft verrouille les équipes',
        body: 'Dès qu’un draft démarre, l’ensemble des équipes et l’ordre de sélection sont figés. Ajoutez l’équipe oubliée _avant_ d’appuyer sur démarrer, pas après.',
      },
      seeAlso:
        'Envoyez à vos capitaines [le guide du capitaine]({captainGuide}) avant la soirée du draft — la salle de guerre vaut surtout pour les jours d’avant, et personne ne lit un écran nouveau pendant qu’une horloge tourne.',
      visitingClans:
        'Vous jouez contre un autre clan plutôt que de drafter les vôtres ? Le camp invité aligne sa propre équipe via un seul lien, et leur modérateur la gère sans compte admin ici — voir [Accueillir un clan invité]({clanVsClanGuide}).',
    },

    launch: {
      title: 'Lancer et faire tourner',
      body: [
        'Révélez les cases, puis démarrez l’événement. Anvil refuse de démarrer une grille qui n’est pas prête — un draft encore en cours, ou des joueurs sans équipe — et vous dit lequel. Si vous savez mieux (un match d’entraînement, une reprise, une grille que vous testez), vous pouvez forcer.',
        'Ensuite, ça tourne pratiquement tout seul. Le plugin crédite automatiquement tout ce qu’il voit et publie des captures de preuve estampillées de l’équipe et d’un horodatage UTC. Ce qui vous retombe dessus, c’est :',
      ],
      rows: [
        {
          term: 'Soumissions à vérifier',
          body: 'les cases manuelles et tout ce que le plugin a signalé. Approuvez ou refusez avec la preuve sous les yeux.',
        },
        {
          term: 'Statistiques',
          body: 'l’onglet Stats de l’événement montre la contribution par joueur — utile quand une équipe débat de qui a porté qui.',
        },
        {
          term: 'Annonces',
          body: '**Post to Discord** (sous **Clan** dans le menu) publie un message dans n’importe quel salon en tant que bot en plein événement sans que vous écriviez de webhook à la main.',
        },
      ],
      missionNote: {
        tag: 'Surprises en cours d’événement',
        body: 'Vous pouvez lâcher une **mission** sur un bingo en cours — une case bonus cachée annoncée au moment où vous la déclenchez, qui peut perdre de la valeur ou expirer. C’est le moyen le moins cher de réveiller une grille au cinquième jour.',
      },
      startProofNote: {
        tag: 'Empêcher le stockage avant l’événement',
        body: [
          'Activez **Starting shot** (événement → Home → **Extras**) et chaque joueur devra remettre une capture prise après le lancement, à un endroit qu’Anvil tire au sort à l’instant du départ — pour que personne ne soit assis sur une semaine de clues et de coffres accumulés à l’instant zéro. Le lieu est annoncé avec le départ ; le mot-clé de chaque joueur est personnel, dérivé du tirage, et n’existe pas avant le démarrage, il ne peut donc être préparé à l’avance par personne.',
          'Épinglez les endroits sur la carte du monde (l’éditeur de pool en a une) et le plugin vérifie que les joueurs s’y trouvent réellement, au lieu de simplement le leur avoir dit. Vous pouvez aussi exiger une **session fraîche** — 15 minutes par défaut : les hiscores ne sont enregistrés qu’à la déconnexion, obliger tout le monde à se reconnecter juste avant sa photo est donc ce qui rend honnêtes les totaux de départ derrière chaque case XP et KC.',
          'Les utilisateurs du plugin appuient sur un bouton. Tous les autres tapent leur mot-clé en jeu et envoient depuis My Team. Vous choisissez ce qui arrive au crédit de quelqu’un qui n’a rien remis : le signaler pour vérification (par défaut) ou le refuser jusqu’à ce qu’il le fasse. Le même panneau, sur la Home de l’événement, est la liste de vérification — les captures du plugin avec mot-clé validé arrivent déjà acceptées, en pratique vous ne regardez donc que les joueurs sur mobile.',
        ],
      },
    },

    after: {
      title: 'Après la dernière case',
      intro:
        'Quand le temps est écoulé, la grille gèle et l’événement se verrouille — points, contributions et qui-a-fait-quoi sont figés tels quels. S’il faut corriger quelque chose ensuite, un admin peut le déverrouiller délibérément.',
      rows: [
        {
          term: 'Versements',
          body: 'la page **Prizes** de l’événement transforme la cagnotte en liste de qui reçoit quoi, cochée au fur et à mesure des paiements.',
        },
        {
          term: 'Récapitulatif',
          body: 'une page publique avec le classement final et les distinctions de fin d’événement — plus gros drop, plus de kills, et le reste.',
        },
        {
          term: 'Sondage',
          body: 'demandez au clan ce qu’il en a pensé. Construisez-le dans l’onglet Survey ; les joueurs répondent une fois l’événement fini et seule l’équipe voit les résultats.',
        },
        {
          term: 'Enregistrer comme modèle',
          body: 'gardez la grille que vous venez de construire, depuis **Settings → More** de l’événement. Le prochain bingo repart de là plutôt que d’une grille vide.',
        },
      ],
      federation:
        'Avec la fédération activée, les membres peuvent aussi se connecter à d’autres clans Anvil depuis le plugin — pratique pour des événements inter-clans, et entièrement facultatif par membre.',
      outro: 'Orientez ensuite vos membres vers [le guide d’installation pour les joueurs]({pluginGuide}) et commencez à préparer le suivant.',
    },
    survey: {
      title: 'Demander l’avis des joueurs',
      intro: 'Active **Post-event survey** sous **Features**, puis ouvre la page **Survey** de l’événement.',
      body: [
        'Sous **Build**, ajoute des questions : **Rating (1–5)**, **Free text**, **Choose one** ou **Choose many**, chacune éventuellement **Required**. Ou charge un modèle : **Bingo wrap-up**, **Quick pulse**, **PvM mass**, **Raid team** ou **Skilling / social**. **Preview the participant view** la montre comme la verra un joueur.',
        'Il s’ouvre à la fin de l’événement, uniquement pour les participants approuvés, qui peuvent modifier leurs réponses plus tard. **Results** affiche les réponses **By question** ou **By person**. Ce n’est pas anonyme : le staff voit qui a dit quoi.',
      ],
    },
  },

  clanVsClan: {
    metaTitle: 'Accueillir un clan invité — guide de l’organisateur Anvil',
    metaDescription:
      'Menez un clan contre clan sur Anvil : donnez à chaque clan invité un lien d’invitation qui place ses joueurs dans une équipe, et une place pour que leur propre modérateur gère leur moitié.',
    eyebrow: 'Anvil · pour les organisateurs',
    title: 'Accueillir un clan invité',
    dek: 'Vous accueillez la grille ; ils fournissent l’équipe. C’est le chemin qui évite de récolter une douzaine de RSN en message privé — un lien par équipe, et une place qui permet à leur propre modérateur de gérer leur moitié de l’événement.',
    facts: [
      { strong: '1 lien', rest: 'par équipe invitée' },
      { strong: '0 place admin', rest: 'donnée à des extérieurs' },
      { strong: '~5 min', rest: 'par clan invité' },
    ],
    footnote:
      'Les captures viennent d’une installation réelle sur une grille de test — les jetons d’invitation et les noms Discord sont masqués. Un vrai lien mérite d’être gardé : quiconque le détient peut prendre une place dans cette équipe tant qu’il est actif.',

    teamCompsLine: "Vous voulez que les clans s'affrontent sur des skills ou des boss ? Voir [Compétitions par équipes]({teamCompsGuide}).",

    shape: {
      title: 'Ce que vous mettez en place',
      body: [
        'Un clan contre clan est un événement ordinaire avec une différence : la moitié des joueurs ne sont pas dans votre clan et ne le seront jamais. Ils ne peuvent pas être synchronisés depuis la liste des membres, vous ne voulez pas les promouvoir, et vous ne voulez surtout pas en inscrire vingt à la main puis traîner chacun vers la bonne équipe.',
        'Deux pièces règlent ça, et elles sont indépendantes — servez-vous de l’une, ou des deux.',
      ],
      rows: [
        {
          term: 'Un lien d’invitation',
          body: 'une URL que vous créez une fois pour une équipe. Qui l’ouvre se connecte, remplit le formulaire d’inscription habituel, et atterrit dans cette équipe déjà approuvé — pas de vivier de draft, pas de file de validation.',
        },
        {
          term: 'Une place dans l’encadrement de l’équipe',
          body: 'une personne nommée qui peut gérer _cette seule équipe_ — son effectif, ses soumissions et preuves, ses frais — sans compte admin ici, et sans prendre la place de capitaine à celui qui joue vraiment.',
        },
      ],
      note: {
        tag: 'Ce qu’une invitation n’est pas',
        body: 'Ce n’est ni une connexion ni un raccourci contournant la vérification. Qui l’ouvre se connecte quand même avec Discord et a quand même besoin d’un RSN vérifié, exactement comme pour toute autre inscription. Le lien ne décide que de _quelle équipe_ rejoint l’inscription, et du fait qu’elle n’a besoin de l’approbation de personne.',
      },
    },

    team: {
      title: 'Créez d’abord l’équipe',
      body: [
        'Ouvrez votre événement et allez sur la page **Teams & draft**. Créez une équipe par clan invité et nommez-la d’après lui — le nom est ce que leurs joueurs voient sur le formulaire d’inscription, « Ironforge » vaut donc mieux que « Équipe 2 ».',
        'Vous n’avez _pas_ besoin de faire un draft. Liens d’invitation et draft sont des alternatives : un draft répartit un vivier commun, un lien place les gens directement. Sur un clan contre clan pur, la plupart des organisateurs créent les équipes, distribuent un lien à chacune, et n’ouvrent jamais le draft.',
        'Ouvrez ensuite l’équipe elle-même — **Teams & draft → l’équipe** — car c’est là que se passent les deux étapes suivantes.',
      ],
      captainNote: {
        tag: 'Le capitaine d’abord',
        body: 'Nommez le capitaine du camp invité avant de distribuer le lien, pour que la page d’équipe ait un responsable dès le départ. Nommer un capitaine l’installe aussi dans l’équipe ; si la carte vous avertit qu’il n’est pas dans l’effectif, acceptez la correction proposée.',
      },
    },

    staff: {
      title: 'Donner une place à leur modérateur',
      body: [
        'Le panneau **Team staff** de la page d’équipe est la façon dont le modérateur du clan invité se met au travail sans que vous lui accordiez quoi que ce soit sur votre site. Appuyez sur **Add someone**, cherchez-le, ajoutez une note comme « Ironforge’s mod » pour que le prochain admin sache pourquoi il est là, et appuyez sur **Give a seat**.',
      ],
      figure: {
        caption: 'Événement → Teams & draft → l’équipe → Team staff',
        alt: 'Le panneau Team staff avec une place accordée et la recherche ouverte pour en ajouter',
        legend: [
          {
            label: 'Add someone',
            body: 'ouvre la recherche. Seules les personnes qui se sont connectées ici avec Discord au moins une fois peuvent apparaître — voir la note ci-dessous.',
          },
          {
            label: 'La note',
            body: 'texte libre, 120 caractères. Écrivez de quel clan ils viennent. Les places restent dans la liste après l’événement, et « qui est cette personne ? » est la question que vous vous poserez dans trois mois.',
          },
          {
            label: 'Remove',
            body: 'reprend la place immédiatement. Faites-le à la fin de l’événement — une place n’a pas de durée limitée d’elle-même.',
          },
        ],
      },
      canDo: 'Ce qu’une place permet, sur cette seule équipe :',
      canDoList: [
        'voir et gérer l’effectif de l’équipe',
        'traiter ses soumissions et ses preuves',
        'marquer les frais de ses joueurs comme payés',
        'créer des liens d’invitation pour elle, si vous l’activez (l’étape d’après la suivante)',
      ],
      cantDo: 'Ce qu’elle ne permet jamais :',
      cantDoList: [
        'toucher à une autre équipe',
        'modifier la grille ou ses cases',
        'faire des choix de draft',
        'remplacer quelqu’un une fois l’événement lancé',
      ],
      note: {
        tag: 'Ils doivent d’abord se connecter ici une fois',
        body: 'La recherche ne liste que les comptes avec un Discord relié — une place tient à une personne qui peut réellement se connecter. Envoyez donc le modérateur du clan invité sur ce site, faites-lui appuyer une fois sur **Login**, et accordez la place _ensuite_. S’il n’apparaît pas dans la recherche, cette connexion n’a pas encore eu lieu.',
      },
    },

    link: {
      title: 'Créer le lien d’invitation',
      body: [
        'Toujours sur la page d’équipe, le panneau **Invite links** crée le lien. Deux champs décident de ce que le lien promet, et tous deux lisent `0` comme « ne rien promettre ».',
      ],
      figure: {
        caption: 'Événement → Teams & draft → l’équipe → Invite links',
        alt: 'Le panneau Invite links avec les champs de places et d’expiration, le bouton Make a link, et un lien actif dans la liste',
        legend: [
          {
            label: 'Seats et Expires in hours',
            body: 'combien de personnes le lien peut placer (jusqu’à 100) et combien de temps il reste valable (jusqu’à 30 jours). Réglez les places sur la taille de l’effectif promis et le lien se ferme tout seul quand ils sont tous entrés ; réglez une expiration quand le lien part dans un Discord public. `0` dans l’un ou l’autre champ signifie sans limite.',
          },
          {
            label: 'Make a link',
            body: 'le crée et le copie aussitôt dans votre presse-papiers. Collez-le-leur avant de faire quoi que ce soit d’autre.',
          },
          {
            label: 'La liste des liens actifs',
            body: 'chaque lien que cette équipe a dehors, avec le nombre de personnes entrées et de places restantes. **Copy** le reprend ; **Turn off** le tue définitivement.',
          },
        ],
      },
      shape:
        'Le lien ressemble à `{origin}/events/{eventId}/join/{token}` — une ligne, sans risque à coller dans un message Discord.',
      note: {
        tag: 'Valeurs par défaut raisonnables',
        body: 'Pour un clan contre clan où vous avez convenu d’un effectif avec un modérateur, laissez les deux champs à `0` et laissez-le faire. Sortez les places et l’expiration quand le lien part quelque part que vous ne contrôlez pas.',
      },
      revoke:
        'Désactiver un lien agit immédiatement et n’enlève personne qui a déjà rejoint — ce sont désormais des joueurs ordinaires de cette équipe. Pour retirer quelqu’un, passez par l’effectif de l’équipe.',
    },

    captains: {
      title: 'Laissez-les créer leurs propres liens',
      body: [
        'Par défaut, seul un organisateur peut créer des liens, et un capitaine qui essaie se le voit signifier. Ce défaut est juste pour un événement de clan normal — un capitaine qui distribue des places remplirait un effectif que personne n’a validé — et faux pour un clan contre clan, où le camp invité connaît son effectif mieux que vous.',
        'L’interrupteur est sur le même panneau **Invite links** : **Let captains make their own links**. Il s’applique à _toutes les équipes de cet événement_, pas seulement à celle que vous regardez — ce que vous voulez précisément quand les deux camps sont des clans invités.',
        'Une fois activé, le capitaine de l’équipe et toute personne détenant une place peuvent créer des liens eux-mêmes depuis **My Team → Invite links**. Ils obtiennent le même panneau que vous, sans l’interrupteur.',
      ],
      figure: {
        caption: 'My Team → l’équipe → Invite links',
        alt: 'L’onglet Invite links côté capitaine dans le centre d’équipe, avec les champs de places et d’expiration et un lien actif',
        legend: [
          {
            label: 'Le même panneau, vue du capitaine',
            body: 'créer, copier, désactiver. Si l’organisateur n’a pas activé l’interrupteur, on lit « Only a host can make links for this event » et les champs ont disparu.',
          },
          {
            label: 'La liste des liens actifs',
            body: 'un capitaine qui ne peut pas créer voit quand même ceux que son équipe a dehors — il peut donc vous en demander un autre au lieu de supposer qu’il n’y en a aucun.',
          },
        ],
      },
    },

    player: {
      title: 'Ce que voient leurs joueurs',
      intro:
        'Cela vaut la peine de le parcourir une fois vous-même avant de distribuer le lien, pour pouvoir répondre aux questions.',
      steps: [
        'Ils ouvrent le lien. S’ils ne sont pas connectés, ils se connectent d’abord avec Discord et reviennent aussitôt — le lien ne se perd pas en route.',
        'Ils arrivent sur le formulaire d’inscription habituel, avec une bannière : **You’re joining {teamExample} by invite**. Mêmes questions, même sélecteur de comptes, mêmes frais que pour tout le monde.',
        'À l’envoi, ils sont dans cette équipe, approuvés. Aucune action de l’organisateur, aucun draft.',
      ],
      figure: {
        caption: 'Le formulaire d’inscription, ouvert via un lien d’invitation',
        alt: 'Le formulaire d’inscription de l’événement avec une bannière indiquant que le joueur rejoint une équipe nommée par invitation',
        legend: [
          {
            label: 'La bannière d’invitation',
            body: 'nomme l’équipe qu’ils s’apprêtent à rejoindre. Si elle nomme la mauvaise équipe, ils ont le mauvais lien — arrêtez-vous et vérifiez avant l’envoi.',
          },
          {
            label: 'Le reste du formulaire',
            body: 'inchangé. Un RSN vérifié reste exigé, les questions d’inscription sont toujours posées, et des frais d’inscription s’appliquent toujours.',
          },
        ],
      },
      note: {
        tag: 'Déjà inscrit ?',
        body: 'Si quelqu’un s’est inscrit normalement d’abord et se trouve dans le vivier, ouvrir le lien le déplace vers l’équipe au lieu de créer une seconde inscription. Celui qui est déjà approuvé dans une autre équipe est laissé tranquille — déplacez-le depuis l’effectif à la place.',
      },
    },

    dead: {
      title: 'Quand un lien cesse de fonctionner',
      intro:
        'Un lien refusé s’explique sur la page au lieu de renvoyer une 404, celui qui le détient peut donc vous dire de quel cas il s’agit.',
      rows: [
        {
          term: 'This invite has been turned off.',
          body: 'Quelqu’un a appuyé sur **Turn off**. Créez-en un neuf — un ancien lien ne revient jamais.',
        },
        {
          term: 'This invite has expired.',
          body: 'Il a atteint les heures que vous aviez fixées. Créez-en un autre, cette fois avec `0` heure si l’expiration ne sert à rien.',
        },
        {
          term: 'This invite is full.',
          body: 'Toutes les places sont prises. Augmentez en créant un nouveau lien avec plus de places — le nombre est figé dès qu’un lien existe.',
        },
        {
          term: 'Sign-ups for this event aren’t open.',
          body: 'Le seul cas qui peut se résoudre tout seul. Vérifiez la fenêtre d’inscription de l’événement : déjà ouverte, date limite passée, ou événement déjà démarré.',
        },
        {
          term: 'That invite belongs to a different event.',
          body: 'Un lien d’une autre grille a été collé. Vérifiez que l’identifiant d’événement dans l’URL est bien celui que vous vouliez.',
        },
      ],
      checklist: 'Avant l’événement, parcourez cette liste une fois par clan invité :',
      checklistItems: [
        'leur équipe existe et porte leur nom',
        'leur capitaine est nommé et installé dans l’équipe',
        'leur modérateur s’est connecté ici et détient une place dans l’encadrement',
        'le lien est créé, copié, et réellement remis à un humain',
        'la fenêtre d’inscription reste ouverte aussi longtemps qu’ils en ont besoin',
      ],
      note: {
        tag: 'Quand tout est fini',
        body: 'Désactivez les liens et retirez les places d’encadrement. Ni l’un ni l’autre n’expire tout seul, et un lien actif sur un événement terminé n’est qu’un fil qui pend.',
      },
    },
    cohost: {
      title: 'Si tu es le co-hôte',
      intro: 'Tout ce qui précède concerne le côté de l’hôte. Le staff du clan invité a sa propre page pour l’événement, **Co-hosted with <host>**. L’hôte garde les dates, le draft, les équipes et qui peut le voir.',
      rows: [
        {
          term: 'Les inscriptions de ton clan',
          body: '**Approve**, **Reject** ou **Withdraw** les joueurs de ton propre clan. Tu ne vois ni ne touches jamais ceux de l’hôte.',
        },
        {
          term: 'Le tableau',
          body: 'tu ne peux le modifier que si l’hôte a donné cette permission à ton staff. Sinon, tu peux **Suggest a tile** : la case, les détails et les points, jusqu’à 25 en attente à la fois. Chacune apparaît comme **waiting**, **accepted ✓** ou **turned down** avec la raison de l’hôte.',
        },
        {
          term: 'Ton équipe',
          body: '**Manage** l’équipe de ton clan.',
        },
        {
          term: 'Discord',
          body: 'tes admins choisissent ce qui arrive sur ton propre serveur : **Everything shared**, **Big moments** ou **Nothing**, quel canal, qui reçoit une mention, et si tes joueurs reçoivent le rôle **@Bingo player**.',
        },
      ],
    },
  },

  board: {
    metaTitle: 'Construire une grille — guide de création de cases Anvil',
    metaDescription:
      'Créez des cases de bingo qui se créditent elles-mêmes : ce que chaque type peut réellement voir, la création en masse par tableur, et les erreurs qui échouent en silence.',
    eyebrow: 'Anvil · pour les créateurs de grille',
    title: 'Construire une grille qui se suit toute seule',
    dek: 'Une case est la promesse que quelque chose sera remarqué. Voici ce que chaque type peut réellement voir, comment en écrire deux cents sans y perdre votre soirée, et la poignée d’erreurs qui échouent en silence — la case ne se déclenche tout simplement jamais, et personne ne s’en aperçoit avant le quatrième jour.',
    facts: [
      { strong: '15 types', rest: 'un par case, jamais mélangés' },
      { strong: '1000 cases', rest: 'par grille, par tableur' },
      { strong: 'En silence', rest: 'c’est ainsi qu’une mauvaise case échoue' },
    ],
    footnote:
      'Le format du tableur est décrit intégralement dans `docs/tile-authoring.md`, écrit pour qui (ou quoi) génère les lignes. Cette page est la moitié humaine : quel type choisir, et ce qui déraille.',

    kinds: {
      title: 'Une case, un type',
      body: [
        'Chaque case est exactement d’un _type_, et le type est toute la question : il décide de ce que le plugin ou le balayage des hiscores surveille, et donc si la case peut seulement se terminer d’elle-même. Mélanger des champs de deux types est refusé à la porte plutôt qu’accepté et laissé cassé.',
        'Les types se rangent en trois familles, et la famille compte davantage que l’étiquette :',
      ],
      families: [
        {
          term: 'Manuel',
          body: 'un humain regarde une capture et dit oui. Toujours disponible, marche toujours, coûte toujours une soirée à quelqu’un. À utiliser pour ce qu’un logiciel ne peut pas voir.',
        },
        {
          term: 'Lu dans les Hiscores',
          body: 'l’XP de compétence et les compteurs de kills de boss, lus dans les Hiscores officiels toutes les 15 minutes. Aucun plugin requis et cela marche pour tout le monde sur la liste — mais ne voit que ce que les Hiscores comptent, et seulement après la déconnexion du joueur.',
        },
        {
          term: 'Détecté par le plugin',
          body: 'tout le reste : drops, kills de PNJ, temps à battre, diaries, combat tasks, tours, valeur de butin. Crédite en quelques secondes et intègre une capture de preuve — mais uniquement pour les joueurs qui font tourner le plugin.',
        },
      ],
      kindsIntro: 'La liste complète, dans l’ordre du sélecteur de type :',
      kindLabels: {
        standard: { label: 'Standard', blurb: 'Case manuelle — un capitaine la marque comme faite. Aucun suivi automatique.' },
        skill: { label: 'Compétence', blurb: 'Se termine automatiquement quand une compétence atteint un objectif d’XP (lu dans les hiscores).' },
        boss: { label: 'KC de boss', blurb: 'Se termine automatiquement quand un boss atteint un objectif de kills (lu dans les hiscores).' },
        drop: { label: 'Drop', blurb: 'N drops d’un objet (ou de n’importe lequel d’un lot) — détecté par le plugin, capture intégrée.' },
        collection: { label: 'Lot d’objets', blurb: 'Plusieurs objets, chacun avec son propre nombre requis — un de chaque pour un lot complet.' },
        kill: { label: 'Kills', blurb: 'N kills de n’importe quel boss ou monstre. Compté depuis les hiscores quand chaque monstre de la case y figure, sinon par le plugin pendant que vous jouez (poules, vaches, monstres de Slayer).' },
        lap: { label: 'Tours d’agility', blurb: 'N tours sur un parcours d’agility, ou N étages / runs complètes du Hallowed Sepulchre — comptés en direct sur le compteur du jeu. Seuls les tours faits pendant l’événement comptent.' },
        pvp: { label: 'Kill PvP', blurb: 'Tuer des joueurs — n’importe qui, des équipes rivales, ou une cible nommée — dans le Wilderness ou sur les mondes PvP. Les mini-jeux sûrs ne comptent jamais.' },
        gain: { label: 'Gain d’objet', blurb: 'Attraper, cuisiner ou récolter N d’un objet — compté sur ce qui arrive dans l’inventaire. Détecté par le plugin.' },
        timed: { label: 'Chronométré', blurb: 'Terminer une activité sous une limite de temps (Inferno, raids, Colosseum). Le plugin chronomètre.' },
        deathless: { label: 'Sans mort', blurb: 'Terminer un raid avec ZÉRO mort dans le groupe, N fois. Le plugin compte chaque mort dans l’instance.' },
        lms: { label: 'LMS', blurb: 'Finir dans le top N de Last Man Standing (1 = victoire), M fois. Détecté par le plugin à la fin de la partie.' },
        value: { label: 'Valeur de butin', blurb: 'Du butin valant X po — un butin, ou des butins qui atteignent ensemble un objectif. Le plugin évalue le butin.' },
        diary: { label: 'Diary', blurb: 'Terminer des paliers d’achievement diary pendant l’événement. Détecté par le plugin au message de fin.' },
        ca: { label: 'Combat task', blurb: 'Terminer des tâches de Combat Achievement pendant l’événement. Détecté par le plugin au message de fin.' },
      },
      note: {
        tag: 'La question du plugin, posée une fois',
        body: 'Une case détectée par le plugin est invisible pour un joueur qui ne l’utilise pas. Ce n’est pas un défaut qu’on peut configurer — rien ne regarde. Si une partie de votre clan joue sur mobile ou sur le client officiel : soit vous gardez ces cases hors du chemin critique vers la victoire, soit vous les doublez d’un recours manuel en vous attendant à vérifier des captures.',
      },
    },

    pick: {
      title: 'Choisissez le type qui se déclenchera vraiment',
      intro:
        'La plupart des cases qui se comportent mal sont la bonne idée exprimée dans le mauvais type. Les quatre qui piègent les gens :',
      rows: [
        {
          term: 'Une liste de boss plus un monstre hors hiscores',
          body: 'est une case plugin pour **tout** son contenu. Une case Kills n’est comptée depuis les hiscores que si chaque monstre y figure ; ajoutez une poule à quatre boss de GWD et toute la case a besoin du plugin. Si une partie du clan joue sans, laissez les boss des hiscores sur leur propre case.',
        },
        {
          term: 'Un emplacement de collection log',
          body: 'est une case drop. Le déblocage de l’entrée la crédite, la case se déclenche donc même sur un doublon que le joueur possédait déjà — ce qui est en général ce que vous vouliez.',
        },
        {
          term: '« Un de chaque »',
          body: 'est une case drop avec une liste d’objets et **sans** `requiredAmount`. Ajoutez un `requiredAmount` et elle devient silencieusement « n’importe lesquels N parmi ceux-ci » — même ligne, case complètement différente.',
        },
        {
          term: 'Un diary ou un combat task',
          body: 'ne crédite qu’au message de fin en jeu, qui apparaît au moment où le palier ou la tâche s’achève. Ce qu’un joueur possède déjà ne peut pas se redéclencher — sauf pour un combat task, où **Settings → Combat Achievements → Repeat completion** lui permet de le redéclencher.',
        },
      ],
      note: {
        tag: 'Cases de boss composées',
        body: 'La statistique suivie d’une case de boss peut contenir plusieurs clés de hiscores séparées par des virgules, et la progression s’additionne entre elles. `chambersOfXeric,chambersOfXericChallengeMode` est une case qui compte CoX et CM ensemble — presque toujours ce qu’une case de raid veut dire.',
      },
    },

    bulk: {
      title: 'Créez-les en masse, pas dans le navigateur',
      body: [
        'Cliquer une grille de 25 cases, ça va. Cliquer une grille Point Hunt de 200 tâches, non, et la relire ensuite non plus. L’onglet Tiles a un aller-retour prévu exactement pour ça.',
      ],
      steps: [
        '**Download spreadsheet** sur la page **Board & tiles** de l’événement. Vous obtenez un .xlsx de la grille telle qu’elle est, avec listes déroulantes, liste d’objets et consignes de colonnes sur leurs propres feuilles.',
        'Modifiez-le. Une ligne par case ; l’ordre des lignes est l’ordre des cases.',
        '**Upload CSV / Excel** dans le même onglet. Seule la feuille **Tiles** est lue.',
      ],
      rules: [
        {
          term: 'L’aller-retour ne perd rien',
          body: 'téléchargez et renvoyez sans modification et il ne se passe rien — les lignes identiques sont signalées comme inchangées et ne sont même pas réhorodatées. Cela fait de l’export une sauvegarde sûre avant une grosse retouche.',
        },
        {
          term: 'Les lignes suivent les positions',
          body: 'ligne 1 = case 1. Les cases existantes sont mises à jour sur place, et une colonne que vous omettez est laissée telle quelle plutôt que vidée — vous pouvez donc envoyer une feuille à deux colonnes qui ne modifie que les points.',
        },
        {
          term: 'Seules les grilles dynamiques s’agrandissent',
          body: 'les lignes en trop créent de nouvelles cases sur une grille Point Hunt ou une course de cases, avant le démarrage, jusqu’à 1000. Une grille classique N×N a une forme fixe et les ignore. Pour générer des centaines de tâches, faites-en un événement Point Hunt.',
        },
        {
          term: 'Tout ou rien',
          body: 'toutes les lignes sont validées d’abord. Un seul nom d’objet introuvable fait échouer tout l’import, nomme les fautifs, et ne change rien — vous n’obtenez jamais une demi-grille.',
        },
        {
          term: 'Certains champs se verrouillent au démarrage',
          body: 'nom, type, quantité requise et configuration d’objets ne sont appliqués qu’avant le démarrage. Description, points, catégorie et l’indicateur facultatif restent modifiables tout du long, vous pouvez donc corriger une faute en plein événement sans rouvrir la grille.',
        },
      ],
    },

    traps: {
      title: 'Les erreurs qui échouent en silence',
      intro:
        'Chacune s’importe proprement, s’affiche correctement sur la grille, et ne se déclenche jamais. Elles méritent une lecture avant l’envoi plutôt qu’après.',
      rows: [
        {
          term: 'Les cases compétence et boss sont `type=standard`',
          body: 'il n’existe pas de `type=skill`. Le type vient de `trackedStat` + `statType` + `statGoal` sur une ligne standard par ailleurs ordinaire. Écrire `type=boss` est refusé ; écrire `type=standard` en oubliant les colonnes de stats ne l’est pas — vous obtenez alors une case manuelle que personne n’approuvera jamais.',
        },
        {
          term: 'Les séparateurs diffèrent selon la colonne',
          body: '`items` utilise le point-virgule (la virgule est le séparateur CSV). `targetNpcs` utilise la barre verticale. Sur une ligne combat task, la barre verticale est la **seule** option, car les vrais noms de tâches contiennent des virgules — `Nylocas, On the Rocks` est une seule tâche.',
        },
        {
          term: 'Les noms de raids sont comparés mot pour mot',
          body: 'une case sans mort ou chronométrée porte le mode exactement tel qu’il s’écrit en jeu : `Chambers of Xeric: Challenge Mode`, `Theatre of Blood: Hard Mode`, `Tombs of Amascut: Expert Mode`. Une orthographe presque juste est une case qui ne se terminera jamais. Les runs en Entry Mode ne créditent jamais une case de raid de base ; les modes plus difficiles, si.',
        },
        {
          term: 'Les noms d’objets doivent être exacts',
          body: 'l’orthographe du jeu, sinon l’import échoue et liste ce qu’il n’a pas su résoudre. Si un nom est ambigu, fixez-le en `Name#id` et cessez de deviner.',
        },
        {
          term: '`timeThresholdSeconds` veut dire quatre choses',
          body: 'une limite de temps sur une case chronométrée, une limite de classement sur une case LMS (1 = victoire), une taille de groupe exacte sur une case sans mort, et une taille de groupe de raid exacte sur une case drop. Même colonne, quatre sens — vérifiez que vous remplissez celui que votre type lit vraiment.',
        },
        {
          term: 'Une quantité requise sur le mauvais type',
          body: 'sa place est sur les lignes drop, kill, gain, lap, PvP, sans mort et LMS. Sur une ligne stat ou chronométrée elle ne fait rien, et sur une ligne drop elle transforme un lot d’objets en pool « N au choix ».',
        },
      ],
      note: {
        tag: 'Testez-en une avant d’en écrire deux cents',
        body: 'Créez une seule case du type dont vous doutez, révélez-la sur un événement jetable, et allez faire la chose. Cinq minutes là-bas valent mieux que de découvrir le soir du bingo du clan qu’une catégorie entière était morte.',
      },
    },

    points: {
      title: 'Points, paliers et l’équité',
      body: [
        'Sur une grille aux points, chaque case porte sa propre valeur, et ces valeurs correspondent à des paliers de difficulté nommés — easy à elite — que vous pouvez modifier dans **Rules & scoring** si votre clan classe autrement. Le palier est ce que lisent les joueurs ; le chiffre est ce qui compte.',
        'Marquez une case **optional** et elle cesse de compter dans le total de la grille — c’est ainsi qu’on ajoute des objectifs bonus sans rendre un blackout impossible.',
        'Quand la grille est pleine, lancez le **vérificateur d’équilibre** depuis l’onglet Tiles. Il examine la structure et la répartition de l’effort et vous dit où la grille penche — une catégorie que personne ne peut finir, un palier qui vaut bien plus à l’heure que ses voisins — avant que les joueurs ne trouvent ces choses à votre place et les contournent.',
      ],
    },

    reveal: {
      title: 'Personne ne la voit avant que vous le disiez',
      body: [
        'Les nouvelles grilles démarrent cachées. L’équipe les voit toujours ; les joueurs ne voient absolument rien avant que vous révéliez — une grille peut donc se construire au grand jour, sur plusieurs jours, dans un salon que vos membres peuvent lire, sans rien gâcher.',
        'Cet interrupteur principal est le plancher sous tout le reste. Sur une grille avec une règle de révélation — programmée, par intervalle, prime, ou rotative — le moteur ne commence à retourner les cases individuelles qu’une fois la grille elle-même révélée ; armer une grille est donc toujours un acte délibéré. Quelle règle choisir a sa propre page : [Formats, et comment les cases s’ouvrent]({formatsGuide}).',
        'Les missions sont l’exception à connaître : des cases créées à l’avance mais retenues, annoncées en cours d’événement depuis leur propre lot pendant que le reste de la grille reste visible.',
      ],
    },

    check: {
      title: 'Avant de révéler',
      intro: 'À parcourir une fois par grille. L’essentiel prend cinq minutes.',
      items: [
        'chaque case a le type que vous vouliez, pas celui qui s’est importé proprement',
        'les modes de raid, noms d’objets et noms de tâches correspondent caractère pour caractère à l’orthographe du jeu',
        'les cases détectées par le plugin ne sont pas le seul chemin vers la victoire, si une partie de votre clan joue sans',
        'les points sont réglés et le vérificateur d’équilibre est satisfait, ou vous le contredisez exprès',
        'les cases facultatives sont marquées comme facultatives',
        'vous avez téléchargé le tableur une fois, comme sauvegarde que vous pouvez renvoyer',
      ],
      note: {
        tag: 'Qui peut faire ça',
        body: 'La création de cases est le seul travail d’administration doté de son propre rôle. Un **editor** peut créer des cases et rien d’autre, et peut être limité à certaines grilles — un créateur invité venu d’un autre clan obtient donc exactement l’événement que vous lui avez confié, sans accès à quoi que ce soit d’autre.',
      },
    },
    library: {
      title: 'La bibliothèque de tâches et les suggestions',
      body: [
        'Les éditeurs de cases ont **Task library** dans le menu admin : les tâches enregistrées de ton clan, et la bibliothèque d’Anvil à copier. **⬇ Export pack** enregistre tes tâches dans un fichier et **⬆ Import pack** en charge un, ce qui permet à un tableau de passer d’un clan à l’autre.',
        'Une erreur dans la bibliothèque d’Anvil, ou une tâche qui manque ? Appuie sur **Suggest a fix** sur la tâche, ou sur **Suggest a new task**. Anvil la examine, et la réponse s’affiche sous **Your suggestions** : **Waiting for review**, **Approved** ou **Not taken**, avec une note. Tu peux en avoir 5 en attente. Une correction approuvée atteint chaque copie du clan qui suit encore la bibliothèque.',
      ],
    },
    stats: {
      title: 'Stats de départ et retardataires',
      intro: 'Les cases XP et kill-count comparent les stats actuelles de chaque joueur à ses **starting stats**, prises au lancement de l’événement. La page **Stats** de l’événement te permet de les vérifier et de les corriger :',
      rows: [
        {
          term: 'Capturer les stats de départ',
          body: 'avant le départ, cela ne fait que préchauffer les hiscores ; la ligne de départ elle-même est prise au départ. Après le départ, le bouton devient **Capture late joiners**, pour les joueurs ajoutés depuis. Il peut être lancé une fois toutes les 30 minutes.',
        },
        {
          term: 'Mettre à jour maintenant',
          body: 'rafraîchit le classement avec les derniers chiffres. Il se rafraîchit aussi toutes les heures tout seul.',
        },
        {
          term: 'Corriger la base',
          body: 'par joueur : modifier à la main le chiffre de départ d’une compétence ou d’un boss. À utiliser quand un grind fait avant l’événement a été compté, parce que le joueur ne s’était pas déconnecté avant le début.',
        },
        {
          term: 'Réinitialiser toutes les stats de départ',
          body: 'caché sous **Danger zone** : reprend la ligne de départ de tout le monde à partir de ses stats actuelles, en effaçant tous les gains jusqu’ici. Seulement pour un événement lancé par erreur.',
        },
      ],
      outro: 'Plus bas, **Member breakdown** montre qui, dans chaque équipe, a fait quoi, et **Stat tile standings** affiche les stats de départ et actuelles de chaque joueur sur chaque case XP ou kills.',
    },
    race: {
      title: 'Parcours de course de tiles',
      intro:
        'Sur un tableau de course de tiles, vous construisez un parcours au lieu d’une grille. Les tiles sont placées sur des étapes numérotées, et une équipe avance le long de celles-ci.',
      body: [
        'Ouvrez **Tiles** et utilisez la section **Route**. Choisissez un modèle (**Diamond** par défaut), ajoutez vos tiles aux étapes et appuyez sur **Save route**. Chaque tile liée doit se trouver sur l’étape suivante.',
        'Les routes peuvent se diviser et se rejoindre, mais il n’y a qu’une arrivée. À une bifurcation, vous choisissez si terminer une tile fixe la route, ou si le capitaine la choisit et la verrouille. La liste complète des options, et ce que voient les joueurs, se trouve dans [Formats, and how tiles open]({formatsGuide}).',
      ],
    },
  },

  captain: {
    metaTitle: 'Guide du capitaine — Anvil',
    metaDescription:
      'Le jour du draft et les semaines qui suivent : lire le vivier avant que l’horloge démarre, faire ses choix, et gérer l’effectif, les preuves et les frais de son équipe.',
    eyebrow: 'Anvil · pour les capitaines',
    title: 'Guide du capitaine',
    dek: 'On vous met dans les mains une salle de guerre, une horloge et les formulaires d’inscription de vingt-cinq inconnus. Voici ce que tout cela fait, dans l’ordre où vous le rencontrez — plus les parties de la gestion d’équipe qui ne commencent qu’une fois le draft fini.',
    facts: [
      { strong: 'Ordre serpentin', rest: 'pour que les choix tardifs se compensent' },
      { strong: 'L’horloge', rest: 'ne choisit jamais à votre place' },
      { strong: 'Un onglet', rest: 'gère votre équipe tout l’événement' },
    ],
    footnote:
      'Tout ici est ce que voit un capitaine. Les frais, les effectifs des autres équipes et la grille avant révélation appartiennent à l’équipe d’organisation et y restent — rien sur cette page ne peut donc vous faire soupçonner d’avoir regardé ce qu’il ne fallait pas.',

    before: {
      title: 'Ce que vous obtenez, et quand',
      body: [
        'Un organisateur vous nomme capitaine, ce qui fait deux choses : cela vous installe dans l’équipe en tant que joueur, et cela vous ouvre les interfaces de l’équipe. Si la page d’équipe vous avertit un jour que vous n’êtes pas réellement dans l’effectif, acceptez la correction proposée — un capitaine hors de sa propre équipe est un état qui déroute tous les écrans en aval.',
        'Ensuite vous avez deux endroits. **My Team** est le centre de votre équipe, et c’est là que vous passez l’événement. La **salle de guerre** est l’écran du jour de draft, et elle ouvre dès l’ouverture des inscriptions — bien avant la soirée du draft.',
      ],
      note: {
        tag: 'Allez-y tôt',
        body: 'La salle de guerre est surtout utile dans les jours _précédant_ le draft, quand vous pouvez lire chaque formulaire tranquillement. Le soir même, elle devient un chronomètre et vous n’aurez le temps de rien lire.',
      },
    },

    warroom: {
      title: 'Lisez le vivier avant que l’horloge démarre',
      body: [
        'La salle de guerre montre tous ceux qui peuvent être choisis, avec tout ce que le site sait d’eux : ce qu’ils jouent, les boss sur lesquels ils ont de vrais compteurs de kills, à combien d’événements passés ils se sont présentés, et les réponses données au formulaire d’inscription.',
        'Ces réponses sont **figées telles qu’elles ont été envoyées**. Personne ne retouche ses « heures par semaine » après avoir vu qui a été choisi en premier, et c’est précisément pour ça qu’elles valent la peine d’être lues.',
        'Constituez une **liste courte** pendant votre lecture. Elle est privée, elle survit jusqu’au soir du draft, et ce soir-là elle fait la différence entre choisir dans une liste à laquelle vous faites déjà confiance et choisir celui qui se trouve en haut de l’écran.',
      ],
      rows: [
        {
          term: 'Note et palier',
          body: 'un résumé de ce que quelqu’un a réellement fait, déduit de l’historique de son compte plutôt que de ce qu’il vous a raconté. Indicatif — un point de départ pour une conversation, pas un verdict.',
        },
        {
          term: 'Domaines et repères',
          body: 'ce qu’ils font de façon démontrée : raids, PvM, skilling, PvP. Utile pour repérer le trou dans votre effectif plutôt que de prendre quatre fois le chiffre le plus élevé.',
        },
        {
          term: 'Présence',
          body: 'à quelle fréquence ils ont terminé les événements passés auxquels ils s’étaient inscrits. Le chiffre le plus discret de la page et souvent le plus prédictif.',
        },
      ],
    },

    draft: {
      title: 'Le jour du draft',
      body: [
        'Les choix suivent un **ordre serpentin** : à quatre équipes, le premier tour va A, B, C, D et le second D, C, B, A — choisir en dernier à un tour, c’est donc choisir en premier au suivant. Celui qui a tiré le premier choix le paie une minute plus tard.',
        'Une personne est un choix, pas un compte. Prendre quelqu’un attire d’un coup tous les comptes qu’il a enregistrés dans votre équipe — vous ne dépensez jamais un second choix pour le compte secondaire de quelqu’un.',
      ],
      rows: [
        {
          term: 'L’horloge de choix',
          body: 'si l’organisateur en a réglé une, vous avez ce nombre de secondes par tour. À expiration, elle ne choisit **pas** à votre place — elle débloque la possibilité pour l’organisateur de choisir en votre nom, et le dit sur les deux écrans. Rien ne se passe en silence.',
        },
        {
          term: 'Une liste réduite',
          body: 'certains événements tournent avec un mode d’équilibrage. Selon lequel, l’équipe la plus forte peut être empêchée de prendre encore un joueur de haut niveau tant qu’un rival n’en a aucun, ou plafonnée sur l’écart au-dessus de la moyenne. Si quelqu’un que vous vouliez est grisé, c’est pour ça, et cela s’applique à tout le monde.',
        },
        {
          term: 'Si vous le ratez',
          body: 'prévenez l’organisateur à l’avance. Il peut choisir pour vous depuis le même écran, et une liste courte laissée derrière vous est l’instruction qu’il suivra.',
        },
      ],
      note: {
        tag: 'Le draft verrouille l’effectif',
        body: 'Dès qu’un draft tourne, les équipes et l’ordre de choix sont figés. S’il manque une équipe ou si l’ordre est faux, il faut corriger avant le premier choix, pas après.',
      },
    },

    roster: {
      title: 'Le centre de votre équipe, tout l’événement',
      intro:
        'Sur **My Team**, la carte **Manage this team** contient tout ce que vous pouvez faire pour votre camp. Elle arrive repliée ; ouvrez-la une fois et elle reste où vous l’avez laissée.',
      rows: [
        {
          term: 'Roster',
          body: 'qui est dans l’équipe et ce que chacun a apporté. Le premier endroit à regarder quand quelqu’un demande pourquoi son drop n’a pas compté — un compte non relié apparaît ici.',
        },
        {
          term: 'Requests',
          body: 'les gens qui demandent à entrer, sur les événements où les joueurs choisissent leur équipe. N’apparaît que s’il y en a.',
        },
        {
          term: 'Proof',
          body: 'les soumissions de votre équipe et leurs captures. Ce n’est pas vous qui validez en dernier ressort — c’est l’équipe d’organisation — mais vous voyez ce qui a été envoyé et pouvez relancer ce qui manque.',
        },
        {
          term: 'Fees',
          body: 'qui, dans votre équipe, doit encore des frais d’inscription. Vous pouvez en marquer un comme payé ; le confirmer est délibérément le travail de l’équipe d’organisation.',
        },
        {
          term: 'Invite links',
          body: 'apparaît quand l’organisateur autorise les capitaines à créer les leurs. Un lien installe celui qui l’ouvre directement dans votre équipe. Voir [Accueillir un clan invité]({clanVsClanGuide}) pour ce que fait réellement le lien.',
        },
      ],
    },

    during: {
      title: 'Le mener une fois lancé',
      body: [
        'L’essentiel de l’événement se déroule tout seul : le plugin crédite ce qu’il voit et archive une capture estampillée pour chaque chose. Restent les gens, et c’est ça le travail.',
        'Ce qui demande vraiment un capitaine : s’assurer que tout le monde de votre camp a le plugin connecté et ses comptes reliés avant le coup d’envoi, car un compte secondaire non relié ne contribue à rien ; remarquer à mi-parcours quelles cases personne n’a touchées ; et faire photographier les cases manuelles avant la dernière heure, quand tout le monde s’y met en même temps.',
        'Si l’événement demande une photo de départ, c’est la seule chose que chaque joueur doit faire lui-même dans les premières heures. Relancez tôt — pour un joueur qui n’en a pas, chaque crédit est signalé pour vérification, ou refusé net, selon le réglage de l’organisateur.',
      ],
      note: {
        tag: 'Remplacements',
        body: 'Une fois l’événement lancé, seul un admin peut remplacer quelqu’un, et c’est voulu : les contributions sont déjà rattachées à des personnes. Demandez à un organisateur plutôt que de bricoler autour.',
      },
    },
  },

  formats: {
    metaTitle: 'Formats, et comment les cases s’ouvrent — Anvil',
    metaDescription:
      'Les sept formats d’événement, les cinq façons dont les cases peuvent s’ouvrir, et les modificateurs de points — ce que chacun change au ressenti d’un événement.',
    eyebrow: 'Anvil · pour l’équipe du clan',
    title: 'Formats, et comment les cases s’ouvrent',
    dek: 'Deux décisions façonnent un événement plus que toutes ses cases : la forme de la grille, et la façon dont les cases deviennent jouables. Elles sont indépendantes — n’importe quel format accepte n’importe quelle règle de révélation — et ensemble elles font la différence entre une semaine de labeur et une course d’une soirée.',
    facts: [
      { strong: '7 formats', rest: 'la forme de la grille' },
      { strong: '5 règles', rest: 'comment les cases s’ouvrent' },
      { strong: '3 modificateurs', rest: 'ce que vaut une réussite' },
    ],
    footnote:
      'Le format se fixe à la création mais se change ensuite depuis l’onglet Settings → Event de l’événement ; la règle de révélation et les modificateurs de points se changent à tout moment avant que les cases concernées soient révélées.',

    shape: {
      title: 'La forme de la grille',
      intro:
        'Le format décide comment la grille est notée et ce que le formulaire de création vous demandera ensuite. Tout le reste de cette page se construit dessus.',
      note: {
        tag: 'Grille fixe ou liste de tâches',
        body: 'Une grille **classique** est un vrai carré, « N à 5 » signifie donc exactement 25 cases et ce nombre ne peut jamais changer. Tout le reste est une liste de tâches de longueur libre, et c’est aussi le seul type de grille qu’un import de tableur peut agrandir. Si vous générez une centaine de tâches, la décision se prend ici.',
      },
    },

    reveal: {
      title: 'Comment les cases s’ouvrent',
      intro:
        'Indépendant du format. L’interrupteur de révélation au niveau de l’événement reste la porte principale — tant qu’une grille est cachée, rien n’est visible et aucun de ces moteurs ne tourne, vous armez donc toujours une grille délibérément.',
      rows: [
        {
          term: 'Tout d’un coup',
          body: 'le classique. Chaque case est jouable à l’instant où vous révélez la grille, et les équipes choisissent leur ordre. Prenez ça sauf raison contraire.',
        },
        {
          term: 'Programmé',
          body: 'chaque case porte son propre horaire de révélation, réglé dans l’onglet Tiles, et s’ouvre quand l’heure passe. Une grille « case de l’heure » : elle impose le rythme et exige que les horaires soient saisis à l’avance.',
        },
        {
          term: 'Intervalle',
          body: 'le moteur tire des cases cachées à intervalle fixe — un lot toutes les N minutes, au hasard ou dans l’ordre de la grille. Un annonceur de bingo. Aucun travail au-delà des cases elles-mêmes, et la grille se révèle pendant que vous dormez.',
        },
        {
          term: 'Prime',
          body: 'exactement une case ouverte à la fois, et la première équipe qui la termine l’emporte — la case se ferme et la suivante est tirée aussitôt. Impitoyable, très regardable, et sans pitié pour les fuseaux horaires.',
        },
        {
          term: 'Rotatif',
          body: 'une fenêtre glissante de quelques cases ouvertes : chaque tirage en ouvre de nouvelles et laisse expirer les plus anciennes. Contrairement à la prime, tout le monde a le temps de terminer une case ouverte avant qu’elle disparaisse. Conçu pour les échelles individuelles.',
        },
      ],
      note: {
        tag: 'La question des fuseaux horaires',
        body: 'Les grilles prime et intervalle récompensent celui qui se trouve éveillé. Dans un clan réparti sur le globe, c’est un avantage réel distribué par l’horloge plutôt que par le jeu. Les fenêtres rotatives atténuent cela — une case ouverte le reste tant que dure la fenêtre, un joueur endormi garde donc sa chance.',
      },
    },

    scoring: {
      title: 'Ce que vaut une réussite',
      intro:
        'Trois modificateurs, tous uniquement en mode points, tous figés dans la réussite à l’instant où elle se produit — un changement fait plus tard ne réécrit donc jamais l’histoire.',
      rows: [
        {
          term: 'Bonus à la première équipe',
          body: 'des points en plus pour la première équipe qui termine chaque case. Le moyen le moins cher de donner à une grille entièrement visible des allures de course sans rien changer d’autre.',
        },
        {
          term: 'Décote',
          body: 'la valeur d’une case décroît linéairement de 100 % à la révélation vers un pourcentage cible après N heures, puis se stabilise. Sous 100 % elle décroît et récompense la vitesse ; au-dessus de 100 % elle **croît**, ce qui récompense le nettoyage des vieilles tâches que tout le monde a sautées. La direction croissante est celle dont on oublie l’existence.',
        },
        {
          term: 'Lockout',
          body: 'la première réussite ferme la case pour tous les autres. Implicite en mode prime. Sur une grille où les équipes ont des niveaux très différents, cela peut décider la partie tôt — c’est au mieux quand les équipes se tiennent.',
        },
      ],
    },

    missions: {
      title: 'Missions : des surprises en cours d’événement',
      body: [
        'Les missions sont des cases créées à l’avance mais retenues — annoncées depuis leur propre lot pendant que le reste de la grille reste visible. Elles sont indépendantes de la règle de révélation, même un bingo tout à fait ordinaire entièrement visible peut donc en avoir.',
        'Lâchez-les à la main quand la grille s’endort, à intervalle fixe, ou selon un calendrier par mission. Chaque mission porte sa propre notation : son lockout, son bonus, sa décote et son expiration, réglés par case plutôt que pour l’événement.',
        'C’est le moyen le moins cher de réveiller une grille au cinquième jour — et le cinquième jour est le jour où tout long événement a besoin d’être réveillé.',
      ],
    },

    choose: {
      title: 'Choisir, en une page',
      intro: 'Si vous savez quelle sensation vous voulez, voici le chemin le plus court.',
      rows: [
        { term: 'Un bingo de clan ordinaire', body: 'Grille classique, toutes cases visibles. Ajoutez un bonus à la première équipe si vous voulez un peu d’urgence.' },
        { term: 'Des centaines de tâches, notées par difficulté', body: 'Point Hunt, tout visible. C’est aussi la seule forme dans laquelle un gros import de tableur peut grandir.' },
        { term: 'Une semaine qui construit vers quelque chose', body: 'Point Hunt avec révélation programmée ou par intervalle, pour que la grille s’ouvre au fil de la semaine plutôt que d’un coup.' },
        { term: 'Une soirée que les gens suivent en direct', body: 'Prime. Une case, la première équipe la prend, la suivante aussitôt.' },
        { term: 'Une compétition individuelle, pas par équipes', body: 'Échelle avec fenêtre rotative et décote. Les tâches vont et viennent et personne ne peut les mettre de côté.' },
        { term: 'Une course avec une ligne d’arrivée', body: 'Course de cases — un parcours ordonné, et qui va le plus loin gagne.' },
      ],
      outro:
        'Quoi que vous choisissiez, les cases elles-mêmes sont le même travail : voir [Construire une grille qui se suit toute seule]({boardGuide}).',
    },
    race: {
      title: 'Routes de course de tiles',
      intro:
        'Une course de tiles est un parcours d’étapes numérotées. Les équipes avancent d’étape en étape, et celle qui va le plus loin gagne. L’hôte peut transformer le parcours en carte avec des routes qui se séparent et se rejoignent.',
      body: [
        'Chaque route a un seul départ, des routes qui peuvent se diviser et se rejoindre, et une seule arrivée. Toutes les routes ont la même longueur. La progression d’une équipe est la route qu’elle a parcourue jusqu’ici.',
      ],
      rows: [
        {
          term: 'Par achievement',
          body:
            'chaque tile après votre tile actuelle est ouverte. La première qu’une équipe termine fixe sa route, et les autres se ferment pour cette équipe.',
        },
        {
          term: 'Choisir et verrouiller',
          body:
            'le capitaine (ou le staff d’équipe) choisit la tile suivante avec **Pick this road** avant que quoi que ce soit ne compte. Seul le choix est ouvert. Un choix ne peut pas être annulé, sauf par une réinitialisation admin.',
        },
        {
          term: 'Garder les fins anticipées',
          body:
            'désactivé par défaut, donc seules les tiles ouvertes sur la route d’une équipe comptent. Activez-le et une fin sur une tile que l’équipe n’a pas encore atteinte est conservée. Elle se complète quand la route y arrive. Cela ne fait jamais dépasser une équipe en tête ni n’ouvre rien en avance.',
        },
      ],
      steps: [
        'Ouvrez la page **Tiles** de l’événement et trouvez **Route**.',
        'Choisissez un **Route template** et appuyez sur **Apply template**. **Diamond** est le modèle par défaut : un départ, deux routes, une arrivée. **Two roads**, **Braid**, **Straight line** et **Free** (sans liens) sont aussi disponibles.',
        'Choisissez **How a team’s road is set at a fork** : par achievement, ou choisir et verrouiller.',
        'Ajoutez ou déplacez des étapes avec **+ Step before**, **Move step earlier/later** et **Remove step**, puis appuyez sur **Save route**.',
        'Si l’événement est déjà en direct, Anvil demande quoi faire des fins que la nouvelle route coupe : **Keep** ou **Roll back**.',
      ],
      outro:
        'Les joueurs voient une **Race track** sur la page de l’événement, avec un repère doré **You** sur la tile de leur équipe. **Fullscreen board** l’agrandit, et **Esc** la ferme. Dans le plugin, le panneau latéral affiche **Your road** et **After that**.',
    },
  },

  fees: {
    metaTitle: 'Frais et récompenses — guide du trésorier Anvil',
    metaDescription:
      'Fixer des frais d’inscription, les encaisser, la deuxième signature qui les clôt, et transformer la cagnotte en places payées.',
    eyebrow: 'Anvil · pour les trésoriers',
    title: 'Frais et récompenses',
    dek: 'L’argent est l’endroit où les événements de clan déraillent, et ils déraillent en silence : des frais que quelqu’un jure avoir payés, une cagnotte que personne ne peut faire tomber juste, un partage des prix débattu après que les gagnants se sont déconnectés. Voici le chemin qui laisse une trace à chaque étape.',
    facts: [
      { strong: '2 signatures', rest: 'clôturent des frais par défaut' },
      { strong: 'Cagnotte = ajout', rest: '+ frais × inscriptions validées' },
      { strong: '1 ligne', rest: 'par personne payée' },
    ],
    footnote:
      'Frais et récompenses sont le domaine du trésorier. Un trésorier peut tout ce que peut un modérateur, plus ceci ; un simple modérateur ne voit pas du tout les pages des frais.',

    set: {
      title: 'Fixer les frais',
      body: [
        'Les frais d’inscription tiennent à l’événement, réglés à sa création ou modifiés depuis son onglet **Sign-ups**. Pas de frais du tout est une réponse parfaitement valable — beaucoup d’événements tournent sur une seule cagnotte ajoutée par l’organisateur.',
        'Deux réglages décident de ce que les frais veulent vraiment dire, et on les saute facilement :',
      ],
      rows: [
        {
          term: 'Par personne ou par compte',
          body: 'sur un événement où l’on peut engager plusieurs comptes, cela décide s’ils paient une fois ou une fois chacun. Si c’est faux, vous allez rembourser des gens.',
        },
        {
          term: 'Date limite de paiement',
          body: 'une fois passée, les inscriptions impayées cessent d’être quelque chose que vous poursuivez et deviennent une décision. Fixez-la plus tôt que vous ne le pensez — la veille de l’événement est trop tard pour remplacer quelqu’un.',
        },
        {
          term: 'Frais invité',
          body: 'ce que paient les joueurs qui ne sont pas membres d’un clan qui organise le tableau. Laissez vide et les invités paient les frais des membres. Pour demander un autre montant à un seul joueur, appuyez sur **Change this player’s fee** sur sa ligne dans **Sign-ups**.',
        },
      ],
      note: {
        tag: 'La cagnotte suit les inscriptions',
        body: 'La cagnotte affichée est ce que vous avez ajouté à la main, plus les frais multipliés par le nombre d’inscriptions **validées**. Elle bouge à mesure que des inscriptions sont validées ou exclues, le chiffre affiché est donc toujours celui que vous pourriez réellement verser.',
      },
    },

    collect: {
      title: 'Encaisser',
      body: [
        'Les frais s’encaissent comme votre clan encaisse déjà l’argent — en jeu, sur Discord, comme vous faites. Le travail d’Anvil commence à l’instant où l’argent arrive : quelqu’un ayant l’accès équipe le marque **payé**, et cela enregistre qui dit l’avoir pris, et quand.',
        'Les joueurs ont aussi leur mot à dire. Un membre peut signaler à qui il a payé et joindre une capture, et c’est ce qui transforme « j’ai payé, c’est sûr » en une trace à deux bouts. Quand le signalement du joueur et la déclaration de l’encaisseur nomment des personnes différentes, c’est un différend que le site peut vous montrer plutôt qu’un que vous découvrez en pleine dispute.',
        'Relancer tient en un bouton : **Remind unpaid** dans Admin → **Fees** envoie un MP Discord à toutes les personnes de cet événement qui doivent encore payer.',
      ],
      note: {
        tag: 'La preuve est supprimée volontairement',
        body: 'Une capture de paiement n’est conservée que jusqu’à la clôture des frais, puis supprimée. Elle existe pour trancher un désaccord, pas pour rester un an dans un archivage.',
      },
    },

    sign: {
      title: 'La deuxième signature',
      body: [
        'Des frais restent en **encaissés** jusqu’à ce qu’un _autre_ membre de l’équipe confirme leur arrivée. Celui qui a manipulé l’argent ne peut pas être aussi celui qui signe qu’il est arrivé — c’est là tout le contrôle, et c’est pour ça que le site refuse la confirmation de l’encaisseur lui-même plutôt que de simplement la déconseiller.',
        'Combien de signatures des frais exigent est un réglage de clan (**Clan settings → Rules & scoring → Fee sign-off**), de zéro à cinq. Zéro existe pour une vraie raison : dans un clan où le trésorier _est_ le propriétaire, il n’y a personne d’autre pour signer, et « 34 frais en attente d’une deuxième signature » devient une file qu’on ne peut jamais vider et en permanence la chose la plus bruyante du tableau de bord. À zéro, marquer des frais payés **est** la signature.',
        'Mettez un — la valeur par défaut — si vous êtes deux. Mettez zéro si honnêtement vous ne l’êtes pas, et plus haut seulement si votre clan a à la fois les gens et la raison.',
      ],
    },

    pay: {
      title: 'Verser',
      body: [
        'Quand l’événement se termine, la page **Prizes** de l’événement transforme la cagnotte en liste de personnes. Générez-la et vous obtenez une ligne par bénéficiaire, pas par équipe : le prix d’une équipe gagnante se divise à parts égales entre ses membres, pour que verser soit une liste de noms et de chiffres plutôt qu’un problème d’arithmétique à minuit.',
        'Les montants partent d’un partage suggéré — appuyé sur le vainqueur, et d’autant plus plat que vous ajoutez de places payées — et chaque ligne est modifiable. La suggestion est un point de départ, pas une politique.',
        'Ensuite vous payez, en cochant les lignes au fur et à mesure. L’intérêt, c’est qu’une semaine plus tard n’importe qui peut regarder la liste et voir qui a reçu quoi, au lieu de le reconstituer depuis l’historique Discord.',
      ],
      note: {
        tag: 'Annoncez-le une fois, depuis ici',
        body: 'Les versements sont publiés dans vos salons Discord depuis l’événement lui-même, l’annonce et la trace ne font donc qu’un. Un prix annoncé à la main est un prix dont quelqu’un affirmera plus tard qu’il n’est jamais arrivé.',
      },
    },

    disputes: {
      title: 'Quand les chiffres ne concordent pas',
      intro: 'Les quatre que vous rencontrerez vraiment :',
      rows: [
        {
          term: 'Il dit avoir payé, personne ne l’a marqué',
          body: 'demandez-lui de signaler le paiement avec une capture. Cela inscrit un encaisseur nommé et un horodatage, et la personne nommée peut confirmer ou nier.',
        },
        {
          term: 'Deux membres de l’équipe pensent tous deux l’avoir reçu',
          body: 'le signalement du joueur tranche — il nomme à qui il a remis l’argent. Corrigez l’encaisseur, puis clôturez.',
        },
        {
          term: 'Des frais bloqués en attente d’une signature',
          body: 'soit ils attendent vraiment quelqu’un d’autre, soit votre clan compte moins de membres d’équipe que ne le suppose le réglage des confirmations requises. Baissez le réglage plutôt que de confirmer votre propre encaissement.',
        },
        {
          term: 'La cagnotte a changé après que vous l’avez annoncée',
          body: 'elle suit les inscriptions validées, valider ou exclure une inscription la déplace donc. Annoncez la cagnotte telle qu’elle est à la clôture des inscriptions, pas à leur ouverture.',
        },
      ],
    },
  },

  coffer: {
    metaTitle: 'La caisse du clan — guide Anvil du trésorier',
    metaDescription:
      'La caisse en po du clan sur Anvil : enregistrer les dons et les créditer à ceux qui les ont faits, les trois façons de payer un prix, qui peut déplacer l\'argent, et ce qui se passe quand la caisse est à sec.',
    eyebrow: 'Anvil · pour les trésoriers',
    title: 'La caisse du clan',
    dek: 'La plupart des clans gardent leurs po sur la banque de quelqu\'un et leur comptabilité dans la mémoire de quelqu\'un. La caisse, c\'est une seule cagnotte avec une ligne par mouvement — qui a donné, à quoi c\'est promis, et qui l\'a réellement envoyé.',
    facts: [
      { strong: '3 chiffres', rest: 'en caisse, engagé, libre de promesse' },
      { strong: '3 sorties', rest: 'compétitions hebdo, cases mission, cagnotte d\'un plateau' },
      { strong: 'Trésorier', rest: 'ou admin — jamais le rang seul' },
    ],
    footnote:
      'Tout ceci se trouve sous Admin → **Coffer**, sauf les grilles de prix, qui vivent sur ce qui est payé. La moitié publique, c\'est `/coffer` : le solde, les plus gros donateurs et les mouvements récents, pour les membres.',

    what: {
      title: 'Ce que c\'est',
      body: [
        'Un livre de comptes, pas un porte-monnaie. Anvil ne détient jamais vos po — ils restent là où le clan les garde déjà — la caisse est donc la trace de ce qui est entré, de ce qui est promis et de ce qui a réellement été remis. Son intérêt : la promesse et le paiement sont deux lignes distinctes.',
        'La page s\'ouvre sur trois chiffres, et ils sont trois parce qu\'ils répondent à trois questions différentes :',
      ],
      rows: [
        {
          term: 'En caisse',
          body: 'dons approuvés et ajustements. Ce que le clan a reçu, moins ce qu\'il a passé en perte.',
        },
        {
          term: 'Engagé',
          body: 'les po qu\'un prix a réclamés — gagnés mais pas encore envoyés, plus toute cagnotte mise de côté pour un plateau. Réservé, même si c\'est encore sur la banque de quelqu\'un.',
        },
        {
          term: 'Libre de promesse',
          body: 'en caisse moins engagé. Le seul chiffre auquel un nouveau prix est confronté, parce que l\'alternative est de promettre les mêmes 50M à deux gagnants pendant que le trésorier dort.',
        },
      ],
      note: {
        tag: 'Un don en attente ne compte nulle part',
        body: 'Quelqu\'un qui écrit « j\'ai donné 100M » énonce une affirmation sur le passé, pas des po sur une banque. Il reste hors des trois chiffres tant que le staff ne l\'a pas reconnu, si bien qu\'il ne peut jamais financer un prix qu\'on ne pourra ensuite pas payer.',
      },
    },

    inbound: {
      title: 'Faire entrer des po',
      body: [
        'Le plugin RuneLite gère automatiquement le cas ordinaire : ouvrez le Clan Coffer en jeu et Anvil enregistre les dépôts et les retraits à partir de son vrai solde en pièces. Le premier coup d’œil ne sert que de point de référence — il ne prétend jamais que la personne qui l’a ouvert a donné tout ce qui s’y trouvait déjà.',
        'Les enregistrements manuels restent pour tout ce qui s’est passé pendant que personne n’avait le plugin ouvert. Un membre déclare son propre don depuis `/coffer` et il attend que le staff le croie ; un trésorier enregistre un don déjà arrivé, et le fait de le saisir **vaut** approbation.',
        'Dans les deux cas, il est crédité à une **personne**. Cela compte plus qu\'il n\'y paraît : la liste des plus gros donateurs sur la page publique est le seul merci que la plupart recevront, et des po arrivés au nom du « clan » ne remercient personne.',
      ],
      rows: [
        {
          term: 'Ouvrir la caisse en jeu',
          body: 'avec Anvil activé et connecté (Profile sync → **Sync Clan Coffer** est activé par défaut). Un message de jeu correspondant vous crédite votre propre dépôt ou retrait ; les changements constatés après une absence sont rapprochés sans nommer celui qui les a observés. Admin → Coffer affiche le dernier montant physique et le moment où il a été vu.',
        },
        {
          term: 'Un membre le déclare',
          body: 'depuis la page publique de la caisse, avec une capture d\'écran s\'il en a une. Il arrive en attente et apparaît dans votre file. C\'est l\'approbation qui en fait de l\'argent réel.',
        },
        {
          term: 'Vous l\'enregistrez',
          body: 'Admin → Coffer → **Record a donation**. Cherchez dans l\'effectif qui l\'a donné, mettez un montant en face du nom, terminé. Les invités peuvent aussi être crédités — quelqu\'un qui n\'est pas membre à part entière a très bien pu contribuer.',
        },
        {
          term: 'Plusieurs ensemble',
          body: 'choisissez-les tous, tapez le total et appuyez sur **Split … ways**, puis ajustez une part à la main si besoin. Cela écrit une ligne chacun plutôt qu\'une ligne avec une liste, pour que chacun figure dans la liste des donateurs sous son propre nom.',
        },
      ],
      note: {
        tag: 'Un ajustement, c\'est autre chose',
        body: '**Correct the pot** sert aux po qui ont bougé en dehors de tout cela — amorcer la caisse, la dépenser pour quelque chose qu\'Anvil n\'a jamais vu, corriger une erreur. Il n\'appartient à personne, volontairement, et ce n\'est délibérément pas la façon d\'enregistrer un don.',
      },
    },

    out: {
      title: 'Les trois façons de payer',
      intro: 'Chaque prix sur Anvil sort de cette même cagnotte, et chaque chemin désigne les gagnants à sa manière. Réglez la grille là où vit ce qui est gagné — la caisse ne demande jamais qui a gagné quoi.',
      rows: [
        {
          term: 'Une hebdo, sur sa propre page',
          body: 'un Skill ou Boss of the Week porte une grille de places : le premier reçoit ceci, le deuxième cela. Elle est réglée **une fois**, à la fin de la compétition, sur le classement final — rien ne change de mains pendant qu\'elle tourne. Réglez-la en créant la compétition, ou plus tard depuis sa propre page.',
        },
        {
          term: 'Une case mission, sur le plateau',
          body: 'les missions paient dans l\'ordre où les gens terminent : leur grille se réclame plutôt qu\'elle ne se règle — la première équipe à la boucler prend les po de la première place. Se règle dans la section rewards de la case, sur tout plateau qui autorise les missions.',
        },
        {
          term: 'La cagnotte d\'un plateau',
          body: 'un bingo répartit lui-même sa cagnotte entre les places, la caisse lui tend donc juste un chiffre. Event → **Prizes** → *From the clan coffer*. Cela s’ajoute aux frais d’inscription et à ce que vous avez ajouté vous-même, et la répartition entre les places se règle sur cette même page. Vous choisissez aussi si la caisse **bloque** ces po tout de suite ou se contente d’enregistrer la promesse — ils ne sont pas encore partis, et un plateau dans six semaines n’a pas besoin que la moitié de la cagnotte soit gelée jusque-là.',
        },
      ],
      note: {
        tag: 'Quand des joueurs finissent à égalité',
        body: 'Une grille hebdo peut **partager les égalités** : tous ceux à égalité mettent en commun les places qu\'ils occupent et prennent une part égale — trois joueurs à 40 kc prennent chacun un tiers des première, deuxième et troisième places au lieu que le premier d\'entre eux rafle tout. Laissez l\'option désactivée et l\'ordre du classement tranche. Les deux se défendent — décider une fois les résultats connus, non.',
      },
    },

    who: {
      title: 'Qui peut y toucher',
      intro: 'L\'argent est une permission à part, pas un rang. Un modérateur peut valider une soumission sans jamais toucher à la caisse, et c\'est délibéré, pas un oubli.',
      rows: [
        {
          term: 'Trésorier ou admin',
          body: 'tout le livre de comptes : enregistrer et approuver les dons, ajuster la caisse, régler les grilles de prix, marquer un prix comme envoyé. Le propriétaire compte ici comme admin.',
        },
        {
          term: 'Un modérateur',
          body: 'rien de tout cela. Il ne verra même pas la page de la caisse — collecter l\'argent est le travail du trésorier, et le rang seul n\'a jamais conféré ce droit.',
        },
        {
          term: 'Un trésorier de plateau',
          body: 'l\'argent d\'un seul événement : ses frais, ses paiements, sa cagnotte. Accordé par plateau, c\'est ainsi qu\'un clan invité gère sa moitié d\'un clan contre clan sans qu\'on lui remette votre comptabilité. Il ne touche pas à la caisse du clan.',
        },
        {
          term: 'N\'importe quel membre',
          body: 'peut déclarer un don et lire la page publique. C\'est tout.',
        },
      ],
      note: {
        tag: 'Dites-le au clan, dans un salon',
        body: 'Pointez le **Coffer ledger** vers un salon Discord sous Admin → Discord → What goes where → **Staff only** et chaque mouvement est publié avec le solde qu\'il laisse derrière lui. C\'est le seul flux sans repli : laissez-le vide et rien sur l\'argent n\'est publié nulle part. Voir [Anvil sur Discord]({discordGuide}).',
      },
    },

    short: {
      title: 'Quand la caisse est trop courte',
      body: [
        'Un prix plus gros que la caisse n\'est pas refusé. Il est inscrit comme **dû et non couvert** — une vraie ligne, au nom d\'un gagnant — parce que l\'alternative, c\'est un gagnant sans rien et sans trace qu\'on lui ait jamais promis quoi que ce soit.',
        'La solution est donc l\'ordinaire : faire rentrer des po, puis payer. Ce qu\'il ne faut pas faire, c\'est modifier la grille en douce après coup ; le livre de comptes dit déjà ce qui avait été annoncé, et les voir se contredire est pire que d\'être à court.',
      ],
      note: {
        tag: 'Anvil n\'envoie rien',
        body: 'Chaque prix se termine par un humain qui remet des po en jeu et coche une ligne. Le rôle du livre de comptes est de garantir que cette ligne existe, qu\'elle dit qui et combien, et que personne n\'ait à la reconstituer une semaine plus tard depuis l\'historique Discord.',
      },
    },
  },

  commands: {
    metaTitle: 'Commandes slash Discord — Anvil',
    metaDescription:
      'Toutes les commandes slash d’Anvil — /bingo, /sotw, /botw, /eff, /coffer, /stats et /guide — avec chaque option expliquée, des exemples, qui peut utiliser quoi, et les solutions quand une commande n’apparaît pas.',
    eyebrow: 'Anvil · dans Discord',
    title: 'Commandes slash',
    dek: 'Tapez `/` dans le Discord de votre clan et Anvil répond depuis le site en direct : la grille, le classement, votre propre carte, les hebdos, la caisse et les stats de n’importe qui. Cette page en est la liste complète, générée à partir des commandes que le bot enregistre réellement, elle n’est donc jamais périmée.',
    facts: [
      { strong: 'Privé', rest: 'des réponses que vous seul voyez, avec un bouton pour partager' },
      { strong: 'Votre langue', rest: 'celle réglée dans votre Discord' },
      { strong: 'Lecture seule', rest: 'sauf /coffer add et remove' },
    ],
    footnote:
      'Installer le bot, c’est le [guide Discord](/guide/discord). Cette page parle de son utilisation.',

    using: {
      title: 'Comment fonctionne une commande',
      body: [
        'Tapez `/` dans n’importe quel salon que le bot peut voir et choisissez une commande Anvil dans la liste. Discord affiche alors ses options sous forme de cases à remplir : appuyez sur Tab ou cliquez sur l’une d’elles pour l’ajouter. Ci-dessous, les options notées `<angle brackets>` (entre chevrons) sont obligatoires ; celles notées `[square brackets]` (entre crochets) sont facultatives et vous pouvez les omettre.',
        'Chaque réponse est **privée** : vous seul la voyez, donc consulter la grille dix fois par jour ne dérange personne. Si ça vaut la peine de la montrer au salon, appuyez sur **Share to channel** sous la réponse. La copie partagée est reconstruite à ce moment-là : un classement partagé plus tard est le classement tel qu’il est alors.',
      ],
      rows: [
        { term: 'Obligatoire', body: '`<amount>` — Discord n’enverra pas la commande tant qu’elle n’est pas remplie.' },
        { term: 'Facultative', body: '`[member]` — omettez-la et la commande répond sur vous, votre équipe ou tout le clan.' },
        { term: 'Une liste', body: 'choisissez l’une des valeurs proposées par Discord ; impossible de taper la vôtre.' },
        { term: 'Recherche à la saisie', body: 'commencez à taper et choisissez parmi les suggestions, comme des noms de boss ou vos propres comptes.' },
        { term: 'Un membre', body: 'choisissez quelqu’un du serveur, comme pour une @mention.' },
      ],
      note: {
        tag: 'Les commandes ne marchent que sur le serveur de votre clan',
        body: 'Chaque réponse porte sur un clan, et un MP n’a aucun clan sur lequel répondre. C’est pour ça que les commandes n’apparaissent pas en MP.',
      },
    },

    bingo: {
      title: 'Commandes de grille : /bingo',
      intro:
        '`/bingo` porte sur une seule grille. Quand plusieurs grilles sont en cours, **board** et **leaderboard** les listent toutes ; les autres répondent sur la grille en cours, sinon la prochaine à démarrer, sinon celle qui vient de se terminer.',
    },

    clan: {
      title: 'Commandes de clan',
      intro:
        'Celles-ci portent sur le clan plutôt que sur une grille, elles fonctionnent donc qu’un bingo soit en cours ou non : les hebdos, l’efficacité, la caisse, les stats de n’importe qui, et les guides d’installation.',
    },

    options: {
      title: 'Les options que vous verrez partout',
      intro: 'Quelques options veulent dire la même chose sur toutes les commandes qui les proposent :',
      rows: [
        {
          term: '`member`',
          body: 'quelqu’un d’autre sur le serveur. Omettez-la pour parler de vous. Elle retrouve son compte Anvil grâce à la connexion Discord utilisée sur le site, elle ne fonctionne donc que pour les membres qui se sont connectés à Anvil au moins une fois.',
        },
        {
          term: '`account`',
          body: 'lequel des comptes OSRS de cette personne, pour ceux qui ont des alts. Tapez pour choisir ; omettez-la pour son compte principal.',
        },
        {
          term: '`page`',
          body: 'un boss ou une activité, avec recherche à la saisie : `Zulrah`, `Theatre of Blood`, `Tempoross`. Omettez-la pour la vue d’ensemble.',
        },
        {
          term: '`language`',
          body: 'répondre cette fois-ci dans une autre langue. Par défaut, vous obtenez la langue de votre Discord, ou la langue du bot choisie par le clan.',
        },
        {
          term: '`amount`',
          body: 'des po, écrits comme on les dit : `5m`, `2.5b`, `500k`, ou un simple nombre comme `2,500,000`.',
        },
      ],
    },

    who: {
      title: 'Qui peut utiliser quoi',
      body: [
        'Tout le monde sur le serveur peut lancer toutes les commandes en lecture seule. Ce que vous voyez est ce qu’un membre verrait : une grille dont les cases ne sont pas encore révélées reste cachée dans Discord aussi, même pour le staff.',
        'Les commandes qui parlent de **vous** (`/bingo me`, `/stats` sans membre) doivent savoir quel compte Anvil est le vôtre. Elles le retrouvent grâce à la connexion Discord utilisée sur le site : connectez-vous une fois à Anvil avec Discord et elles fonctionnent ensuite.',
      ],
      rows: [
        { term: 'Tout le monde', body: 'toutes les commandes sauf `/coffer add` et `/coffer remove`.' },
        {
          term: 'Trésoriers, admins, propriétaires',
          body: '`/coffer add` et `/coffer remove`. Vérifié d’après votre rôle **sur le site Anvil**, jamais votre rôle Discord, parce qu’un rang sur un serveur de discussion n’a jamais voulu dire le contrôle de l’argent du clan.',
        },
      ],
    },

    trouble: {
      title: 'Quand une commande ne marche pas',
      intro: 'Les causes habituelles, à peu près dans l’ordre où elles surviennent :',
      rows: [
        {
          term: 'Aucune commande Anvil dans la liste',
          body: 'le bot a été invité sans ses commandes — c’est une permission distincte, et les anciens liens d’invitation n’en demandaient qu’une. Un admin relance **Invite / re-invite the bot** depuis Admin → Discord → **Connection**. Cela n’expulse pas le bot et ne réinitialise rien. Les commandes nouvellement ajoutées peuvent mettre jusqu’à une heure à apparaître.',
        },
        {
          term: '« The application did not respond »',
          body: 'Anvil était brièvement injoignable, en général en pleine mise à jour. Relancez la commande quelques secondes plus tard.',
        },
        {
          term: '« Pas sur cette grille » à votre sujet',
          body: 'soit vous n’êtes pas inscrit à cette grille, soit Anvil n’arrive pas à relier votre Discord à votre compte. Connectez-vous au site avec ce compte Discord et vérifiez votre profil.',
        },
        {
          term: 'Les stats d’un membre reviennent vides',
          body: 'il ne s’est pas encore connecté à Anvil avec Discord, ou les hiscores de son compte n’ont pas encore été lus. Réessayez avec l’option `account`, ou demandez-lui de se connecter une fois.',
        },
        {
          term: '`/coffer add` vous le refuse',
          body: 'votre rôle sur le site Anvil n’est ni trésorier, ni admin, ni propriétaire, ou ce Discord n’est pas le compte avec lequel vous vous connectez au site.',
        },
      ],
    },

    labels: {
      options: 'Options',
      noOptions: 'Aucune option — lancez-la, tout simplement.',
      example: 'Exemple',
      examples: 'Exemples',
      required: 'obligatoire',
      optional: 'facultative',
      choices: 'Choix',
      range: 'de {min} à {max}',
      kinds: {
        text: 'texte',
        number: 'nombre',
        member: 'un membre',
        choice: 'choix dans une liste',
        search: 'recherche à la saisie',
        yesno: 'oui ou non',
      },
    },

    examples: {
      'bingo board': {
        examples: ['/bingo board'],
        tip: 'La grille en cours en ce moment. Tant qu’elle n’est pas révélée, les noms des cases restent cachés ici aussi.',
      },
      'bingo leaderboard': {
        examples: ['/bingo leaderboard'],
        tip: 'Le classement des équipes, en points ou en cases selon la façon dont la grille compte.',
      },
      'bingo rules': {
        examples: ['/bingo rules'],
        tip: 'Comment cette grille compte les points (lu sur l’événement lui-même, donc toujours juste), puis les règles maison de votre clan.',
      },
      'bingo apply': {
        examples: ['/bingo apply'],
        tip: 'Comment participer : les inscriptions, les frais, et où en est votre propre inscription.',
      },
      'bingo next': {
        examples: ['/bingo next'],
        tip: 'Ce qui arrive ensuite : une révélation de cases, une mission ou une échéance.',
      },
      'bingo me': {
        examples: ['/bingo me'],
        tip: 'Votre équipe, votre place, et les cases qui vous sont créditées.',
      },
      'bingo help': {
        examples: ['/bingo help'],
        tip: 'Une courte liste de ce à quoi le bot répond, directement dans Discord.',
      },
      'bingo team': {
        examples: ['/bingo team', '/bingo team name:Iron Wolves'],
        tip: 'La fiche d’une équipe : score, effectif et cases récentes. Omettez le nom pour votre propre équipe.',
      },
      sotw: {
        examples: ['/sotw', '/sotw language:Deutsch'],
        tip: 'Chaque Skill of the Week en cours, le haut de chaque classement, et votre rang.',
      },
      botw: {
        examples: ['/botw'],
        tip: 'Chaque Boss of the Week en cours et son classement en direct.',
      },
      eff: {
        examples: ['/eff', '/eff metric:Hours bossed'],
        tip: 'Le classement d’efficacité du clan et votre rang. heures jouées par défaut ; choisissez heures de boss pour les boss.',
      },
      'coffer balance': {
        examples: ['/coffer balance'],
        tip: 'Le solde de la caisse, les plus gros donateurs et les derniers mouvements.',
      },
      'coffer add': {
        examples: ['/coffer add amount:5m', '/coffer add amount:250k note:Raffle proceeds'],
        tip: 'Réservé aux trésoriers, admins et propriétaires. Enregistre des po qui entrent ; c’est aussi publié dans le salon du flux de la caisse.',
      },
      'coffer remove': {
        examples: ['/coffer remove amount:20m note:SOTW prize'],
        tip: 'Réservé aux trésoriers, admins et propriétaires. Refuse de faire passer la caisse sous zéro ; enregistrez-le sur la page de la caisse si c’est voulu.',
      },
      'stats profile': {
        examples: ['/stats profile', '/stats profile player:Zezima'],
        tip: 'Un compte en un coup d’œil : niveau de combat et niveau total, heures jouées et heures de boss, nombre d’entrées du collection log et records personnels.',
      },
      'stats levels': {
        examples: ['/stats levels', '/stats levels player:My Iron'],
        tip: 'Le niveau et l’XP de chaque compétence.',
      },
      'stats efficiency': {
        examples: ['/stats efficiency'],
        tip: 'Heures jouées et heures de boss, et de quelles compétences et quels boss ils viennent.',
      },
      'stats clog': {
        examples: ['/stats clog', '/stats clog page:Zulrah'],
        tip: 'La progression du collection log au global, ou la page d’un boss.',
      },
      'stats pbs': {
        examples: ['/stats pbs', '/stats pbs page:Theatre of Blood mode:Hard size:3'],
        tip: 'Records personnels. Les raids gardent un temps par mode et par taille d’équipe, utilisez donc `mode` et `size` pour trouver le run voulu.',
      },
      'stats luck': {
        examples: ['/stats luck', '/stats luck player:Zezima'],
        tip: 'À quel point le compte a eu de la chance sur les drops qu’Anvil suit.',
      },
      'stats collectors': {
        examples: ['/stats collectors'],
        tip: 'Les plus gros collection logs du clan.',
      },
      'stats luckboard': {
        examples: ['/stats luckboard'],
        tip: 'Les membres du clan les plus en dry et les plus chanceux.',
      },
      setup: {
        examples: ['/setup topic:Plugin setup', '/setup topic:Plugin setup step:5'],
        tip: 'Un guide d’installation dans Discord : la liste des étapes, ou une seule étape avec un lien direct vers elle sur le site.',
      },
      guide: {
        examples: ['/guide guide:ToB 4-man gear'],
        tip: 'Un des guides de jeu du clan (raids, bossing, money making…) : commencez à taper son nom et choisissez-le dans la liste.',
      },
    },
  },
  moderator: {
    metaTitle: 'De permanence — guide du modérateur Anvil',
    metaDescription:
      'Une journée de modérateur sur un site de clan Anvil : la file, la vérification des soumissions et des comptes, garder la liste des membres honnête, et les arbitrages.',
    eyebrow: 'Anvil · pour les modérateurs',
    title: 'De permanence',
    dek: 'Un modérateur prend le travail qui arrive, qu’un événement soit en cours ou non : des preuves à regarder, des comptes à vérifier, une liste de membres qui dérive. Voici de quoi la file est faite, et comment la vider sans devenir vous-même la raison pour laquelle les gens attendent.',
    facts: [
      { strong: 'Pas d’événements', rest: 'un modérateur ne peut ni les créer ni les modifier' },
      { strong: 'Une page', rest: 'dit ce qui vous attend' },
      { strong: 'Approuvez vite', rest: 'une file lente donne l’impression d’un site cassé' },
    ],
    footnote:
      'Un modérateur voit tout ce que voit un membre, plus les interfaces de vérification. Créer et modifier des événements, les réglages, l’équipe et les versements sont l’affaire des admins et des trésoriers — si un bouton manque, c’est pour ça, et c’est voulu.',

    what: {
      title: 'Ce qu’est le rôle',
      intro:
        'Les rôles s’empilent vers le bas : tout ce qu’un modérateur peut faire, un trésorier et un admin le peuvent aussi. Ce qui appartient en propre au modérateur :',
      canList: [
        'la liste des membres : ajouter et retirer des gens, et répondre aux demandes d’adhésion ([Vos membres]({peopleGuide}))',
        'les vérifications de comptes — le défi XP et l’examen manuel',
        'les soumissions et les captures de preuve',
        'les compétitions hebdomadaires et le calendrier',
        'les événements du calendrier du clan',
      ],
      cantIntro: 'Ce qu’ils ne peuvent pas faire, volontairement :',
      cantList: [
        'créer ou modifier un événement, ou ses cases',
        'changer les réglages du clan ou le raccordement à Discord',
        'promouvoir qui que ce soit, ou toucher à l’équipe',
        'clore des frais ou lancer un versement',
      ],
    },

    queue: {
      title: 'Commencez par ce qui vous attend',
      body: [
        'Le tableau de bord admin n’est pas un résumé du site — c’est une liste de ce qui attend, triée par importance, calculée à partir de vraies données plutôt que de compteurs qui dérivent. S’il dit que rien ne vous attend, rien ne vous attend.',
        'Travaillez de haut en bas. Les éléments qui remontent sont ceux avec un humain à l’autre bout : quelqu’un qui ne peut pas s’inscrire parce que son compte n’est pas vérifié, ou dont le drop n’a pas compté parce que personne n’a encore regardé.',
      ],
    },

    submissions: {
      title: 'Soumissions et preuves',
      body: [
        'La plupart des crédits ne vous parviennent jamais : le plugin voit le drop, archive une capture estampillée de l’équipe et d’un horodatage UTC, et la case se termine. Ce qui atterrit dans la file, ce sont les cases manuelles et tout ce que le plugin a signalé.',
        'L’estampille est ce qui rend une preuve difficile à contester. Une capture du plugin porte l’équipe et l’instant intégrés à l’image, et avec la preuve à deux images activée, une seconde image quelques secondes plus tard montre le butin posé au sol. Une capture sans rien de tout ça est une capture prise au téléphone, ce qui va très bien — cela veut simplement dire que c’est vous qui vérifiez.',
      ],
      rows: [
        {
          term: 'Approuvez quand c’est plausible',
          body: 'vous n’auditez pas une banque. Si l’image montre la chose, que le compte est sur la liste des membres et que l’horodatage tombe dans l’événement, approuvez et passez à la suite.',
        },
        {
          term: 'Refusez avec un motif',
          body: 'un refus sans explication vous revient en message privé dans l’heure. Dites ce qui manquait pour que la deuxième tentative soit bonne.',
        },
        {
          term: 'Une soumission signalée est une question, pas une accusation',
          body: 'le plugin signale ce qu’il n’a pas pu confirmer entièrement — le plus souvent un joueur qui n’a pas rendu de photo de départ. Lisez-le comme « regarde celle-ci », pas comme « quelqu’un a triché ».',
        },
      ],
    },

    verify: {
      title: 'Vérifier les comptes',
      intro:
        'Personne ne peut s’inscrire à un événement sans au moins un compte vérifié, cette file empêche donc directement des gens de jouer. C’est celle qui vaut la peine d’être vidée chaque jour.',
      rows: [
        {
          term: 'Vérifié par le plugin',
          body: 'après la première vérification de propriété, le plugin reconnaît automatiquement le compte et une empreinte stable conserve la liaison après un changement de nom. Un compte de la liste sans empreinte connue utilise une fois la vérification par XP ou un modérateur.',
        },
        {
          term: 'Verify by XP',
          body: 'pour les joueurs sans plugin. Le site choisit une compétence au hasard et ils doivent y gagner 1 000 XP en trente minutes. Cela se vérifie tout seul — vous ne voyez que ceux qui échouent.',
        },
        {
          term: 'Examen manuel',
          body: 'Hiscores masqués, ou compte secondaire trop récent pour y figurer. Quelqu’un envoie un RSN avec une note et vous décidez. Demandez une capture de l’écran de connexion si la note ne suffit pas.',
        },
      ],
      note: {
        tag: 'Vérifié n’est pas membre',
        body: 'Vérifier un compte dit « celui-ci est bien à lui ». Cela ne l’intègre pas au clan. L’appartenance au clan ne vient que d’une synchronisation de la liste en jeu ou du staff qui l’ajoute à la main, et une place d’invité seulement d’une demande d’adhésion approuvée par le staff (ou tout de suite, si le clan laisse entrer tout le monde). C’est délibéré, et c’est ce qui empêche quiconque de rejoindre votre clan en tapant un nom.',
      },
    },

    roster: {
      title: 'Garder la liste des membres honnête',
      body: [
        'La liste des membres vient d’un seul endroit : un admin lance une synchronisation depuis la liste de clan en jeu, avec le bouton **Anvil** de la barre de titre de la fenêtre de clan (ou **Sync roster** dans le panneau latéral du plugin). Tout le reste — vérifications, liaisons, inscriptions — en dépend.',
        'Le travail d’entretien est donc petit mais réel : demandez à un admin de lancer la synchronisation après chaque vague de recrutement (elle fait membres les invités qui ont rejoint en jeu), répondez aux demandes d’adhésion en haut de l’onglet **Roster**, et traitez **Needs review** plutôt que d’attendre que les gens se plaignent. Voir [Vos membres]({peopleGuide}).',
      ],
      note: {
        tag: 'Vu la dernière fois n’est pas joué la dernière fois',
        body: 'L’horodatage « vu la dernière fois dans le clan » enregistre la dernière synchronisation qui l’a trouvé, pas sa dernière connexion. Pour « joue-t-il encore », lisez plutôt l’heure de ses statistiques en direct — c’est celle qui bouge d’elle-même.',
      },
    },

    startshot: {
      title: 'Vérifier les photos de départ',
      body: [
        'Sur un événement qui en exige une, chaque joueur doit rendre une capture prise après le lancement, à un endroit tiré au sort à l’instant du départ. Les captures du plugin avec un mot-clé validé arrivent déjà acceptées, en pratique vous ne regardez donc que les joueurs qui ont envoyé à la main depuis un téléphone.',
        'Ce que vous vérifiez est court : que le personnage est sur l’image, que le mot-clé est dans la fenêtre de chat, et que c’est bien le mot-clé donné à ce joueur-là. Les envois comptent immédiatement et vous les vérifiez après coup, personne n’est donc empêché de jouer en vous attendant.',
      ],
    },

    judgement: {
      title: 'Les arbitrages que vous devrez rendre',
      intro:
        'Aucun n’a de bonne réponse dans un logiciel, et c’est précisément pour ça qu’ils arrivent chez un humain.',
      rows: [
        {
          term: 'La preuve est réelle mais tardive',
          body: 'le drop a eu lieu pendant l’événement et la capture est arrivée après. Approuvez en général — regardez l’estampille sur l’image, pas l’heure d’envoi.',
        },
        {
          term: 'Le compte n’est pas encore relié',
          body: 'le drop est authentique, le compte est bien le sien, il n’a simplement pas été ajouté avant de jouer. Faites-le relier, puis approuvez. Ne faites refaire un raid à personne pour de la paperasse.',
        },
        {
          term: 'Ça a l’air mis en scène',
          body: 'portez-le à un admin plutôt que de refuser vous-même. Un refus est une accusation publique à l’intérieur d’un petit clan, et cela ne devrait jamais être la décision rapide d’une seule personne.',
        },
        {
          term: 'Vous êtes vous-même dans l’événement',
          body: 'c’est presque certainement le cas. Confiez tout ce qui touche à votre propre équipe à un autre modérateur — non parce que vous seriez injuste, mais parce que vous ne devriez pas avoir à prouver que vous ne l’étiez pas.',
        },
      ],
    },
  },

  tiles: {
    metaTitle: 'Règles et limites des cases — Anvil',
    metaDescription:
      'Ce que chaque type de case de bingo attend de vous (réglages du jeu, plugin RuneLite, collection log synchronisé, classement aux hiscores) et les limites de ce qu’elle peut suivre.',
    eyebrow: 'Anvil · pour les joueurs',
    title: 'Règles et limites des cases',
    dek: 'Chaque case indique ce qu’elle attend de vous et ce qu’elle ne sait pas faire. Cette page explique chaque ligne ; les liens **Why?** d’une case mènent ici.',
    needs: 'Requis',
    limit: 'Bon à savoir',
    checked: 'La case le vérifie pour vous',
    englishOnly: 'Les règles ci-dessous sont en anglais pour l’instant, afin de toujours correspondre à ce que le site fait réellement.',
  },

  // /guide/creators — le guide de l’hôte pour un espace créateur.
  creators: {
    metaTitle: 'Organise un bingo OSRS pour tes viewers — Anvil',
    metaDescription:
      'Organise un bingo ou une course de cases Old School RuneScape pour ton stream, sans clan : crée un espace, partage un seul lien, choisis qui peut rejoindre (Twitch, Kick, YouTube ou Discord) et mets la grille en stream avec OBS.',
    eyebrow: 'Pour les streamers et les créateurs',
    title: 'Organiser des événements pour tes viewers',
    dek: 'Un espace créateur te permet d’organiser un bingo pour ton stream. Pas besoin de clan en jeu. Tu crées un événement, tu partages un lien, et tes viewers rejoignent.',
    facts: [
      { strong: 'Pas de clan', rest: 'nécessaire' },
      { strong: 'Gratuit', rest: 'pour commencer' },
      { strong: 'Un seul lien', rest: 'pour ton chat' },
    ],

    what: {
      title: 'Ce qu’est un espace créateur',
      body: [
        'C’est ta propre page sur Anvil, à `{apex}/c/ton-nom`. Tu y organises des événements pour tes viewers.',
        'Ce n’est pas un clan. Pas de liste de clan, pas de rangs, pas de compétitions hebdomadaires. Celui qui rejoint ton événement joue cet événement. Rien de plus.',
        'Les viewers se connectent avec Discord, ajoutent leur personnage RuneScape et appuient sur **Join**. Le plugin Anvil pour RuneLite compte ensuite leurs drops tout seul.',
      ],
    },

    create: {
      title: 'Crée ton espace',
      body: [
        'Va sur [{apex}/host](/host) et connecte-toi avec Discord.',
        'Tape un nom pour ton espace. Le nom de ta chaîne est un bon choix. Ton lien est créé à partir du nom. Appuie sur **change link** si tu veux un autre lien.',
        'Appuie sur **Create my space**. Tu as un espace par compte Discord.',
      ],
    },

    first: {
      title: 'Crée ton premier événement',
      body: [
        'Juste après avoir créé ton espace, tu arrives sur **Create your first event**. Plus tard, utilise **+ New event** en haut de **Your events**.',
        '**Name.** Ce que verront tes viewers.',
        '**What kind?** Choisis une carte. **Team bingo** est une grille 5×5 et Anvil répartit les joueurs en équipes pour toi. **Solo bingo** est la même grille, chacun pour soi. **Team race** est une suite de tâches dans l’ordre : l’équipe la plus avancée gagne.',
        '**Ready-made tiles** te donne un mélange de tâches faciles à difficiles que tu pourras modifier plus tard. **Blank, I’ll write my own** démarre vide.',
        '**Who can join?** Laisse sur **Anyone**, ou choisis qui peut rejoindre. Voir l’étape 5.',
        '**When?** Choisis les dates de début et de fin. Ou laisse vide et lance l’événement toi-même quand tu es prêt.',
        'Appuie sur **Create event**. Puis appuie sur **Copy invite link**.',
      ],
    },

    share: {
      title: 'Partage le lien',
      body: [
        'Colle le lien d’invitation dans le chat de ton stream, ton Discord ou tes réseaux. Ce lien suffit à tes viewers.',
        'Tu peux le copier à nouveau à tout moment : **Your events** → **Copy invite link** à côté de l’événement.',
        'Tu veux que le bot réponde à `!join` dans le chat avec le lien ? Voir l’étape 9.',
      ],
    },

    who: {
      title: 'Choisis qui peut rejoindre',
      body: [
        'Chaque événement commence ouvert à **Anyone**. Pour le réserver à ta communauté, ouvre **Settings** → **Viewers** → **Who can join?** de l’événement et choisis une ou plusieurs options. Ce sont les mêmes options que sur l’écran du premier événement.',
        'Si tu en choisis plusieurs, **une seule suffit**. Un follower OU un booster du serveur peut entrer.',
      ],
      intro: 'Chaque option, et ce que le viewer doit faire :',
      rows: [
        {
          term: 'Anyone',
          body: 'Toute personne avec le lien rejoint tout de suite.',
        },
        {
          term: 'Twitch followers',
          body: 'Le viewer appuie sur **Link Twitch** sur la page de l’événement et se connecte avec Twitch. Anvil vérifie qu’il te suit.',
        },
        {
          term: 'Twitch subs',
          body: 'Comme pour les followers, mais il doit être abonné. Choisis le palier minimum : **Tier 1 or higher**, **Tier 2 or higher** ou **Tier 3**. Les abonnés Prime comptent comme palier 1. Ta chaîne doit être affiliée ou partenaire Twitch.',
        },
        {
          term: 'Kick followers',
          body: 'Kick ne dit pas aux applis qui te suit, donc Anvil compte les personnes qui te suivent _après_ que tu as connecté Kick. Suivi avant ? Le viewer se désabonne puis te suit à nouveau. Ton chat Kick est réservé aux followers ? Active **My Kick chat is followers-only** dans le bloc **Kick channel**. Ensuite, un viewer qui tape son code Anvil dans ton chat compte comme follower.',
        },
        {
          term: 'Kick subs',
          body: 'Les abonnés qu’Anvil a vus après ta connexion à Kick comptent tout seuls. Les autres appuient sur **Get Kick code** et tapent le code (il ressemble à `ANVIL-7F3K9Q`) dans ton chat Kick, et Anvil voit leur badge d’abonné. Kick n’a pas de paliers d’abonnement.',
        },
        {
          term: 'YouTube subscribers',
          body: 'Le viewer appuie sur **Check my YouTube subscription** et se connecte avec Google. Ses abonnements doivent être publics sur YouTube.',
        },
        {
          term: 'YouTube members',
          body: 'Le viewer tape son code Anvil dans ton chat en direct YouTube. Les membres ne peuvent donc rejoindre que **pendant ton live**.',
        },
        {
          term: 'Discord role',
          body: 'Les personnes qui ont un rôle de ton serveur Discord que tu choisis (jusqu’à 5 rôles). Connecte d’abord ton serveur : **Discord (optional)** dans le menu.',
        },
        {
          term: 'Server boosters',
          body: 'Les personnes qui boostent ton serveur Discord. Il faut aussi que ton serveur soit connecté.',
        },
      ],
      note: {
        tag: 'Bon à savoir',
        body: 'Connecte d’abord ta chaîne (étape 7), sinon les options Twitch, Kick et YouTube restent grisées. Un compte Twitch, Kick ou YouTube ne peut faire entrer qu’un seul joueur par événement. Ton staff, et les personnes que tu invites par leur nom, passent sans vérification.',
      },
    },

    approve: {
      title: 'Dis oui à chaque joueur (facultatif)',
      body: [
        'Tu veux choisir qui joue ? Ouvre **Settings** → **Viewers** → **Who can enter** de l’événement et choisis **Ask me about everyone**. Appuie sur **Save changes**.',
        'Les viewers appuient alors sur **Ask to join** au lieu de **Join**. Ils doivent d’abord passer tes choix **Who can join?**.',
        'Leurs demandes apparaissent dans **Your events** sous la forme **N waiting for you**. Clique dessus, ou ouvre l’onglet **Sign-ups** de l’événement. La liste du haut s’appelle **Waiting for your yes**. Accepte ou refuse chaque demande.',
      ],
    },

    channels: {
      title: 'Connecte ton Twitch, Kick ou YouTube',
      body: [
        'Ouvre **Settings** dans le menu. Dans le bloc **Twitch channel**, **YouTube channel** ou **Kick channel**, appuie sur **Connect Twitch**, **Connect YouTube** ou **Connect Kick**, et connecte-toi avec ta chaîne.',
        'Chaque chaîne connectée apparaît sur ta page comme un lien **verified**. Tu ne peux pas saisir un lien à la main : se connecter est la façon dont Anvil sait que la chaîne est à toi.',
        'Une chaîne ne peut être connectée qu’à un seul endroit sur Anvil. Si elle est déjà sur un autre espace ou clan que tu gères, Anvil te demande si tu veux la déplacer.',
      ],
    },

    overlay: {
      title: 'Mets la grille en stream (OBS)',
      body: [
        'Dans **Your events**, appuie sur **Stream overlay** à côté de l’événement, puis sur **Make overlay links**.',
        'Tu obtiens trois liens. **Standings** : les meilleures équipes et leur avancement. **Feed** : les derniers drops et cases terminées. **Board** : la grille, avec les cases terminées marquées.',
        'Choisis une **Text size** (S, M, L ou XL) avant de copier. Puis appuie sur **Copy** à côté du lien voulu.',
      ],
      stepsTitle: 'Ajoute-le à OBS',
      steps: [
        'Dans OBS, sous **Sources**, appuie sur **+** et choisis **Browser**.',
        'Colle le lien dans **URL**.',
        'Règle une taille, par exemple 800 × 600. Laisse **Custom CSS** vide.',
        'Appuie sur **OK**. Il se met à jour tout seul toutes les quelques secondes.',
      ],
      tipsTag: 'Bon à savoir',
      tips: [
        'Ajoute `&limit=10`, `&title=0` ou `&align=right` à la fin d’un lien pour le modifier.',
        'L’overlay montre ce que montre la page publique de ton événement. Les classements et cases masqués restent masqués aussi en stream.',
        '**Reset link** crée de nouveaux liens et arrête les anciens. Utilise-le si un lien fuite. Tu dois recoller les nouveaux liens dans OBS.',
        'Une petite marque « Anvil » est dans le coin. Avec l’offre Gold, tu peux la masquer dans **Settings** → **Anvil mark on your overlay**.',
      ],
    },

    chatjoin: {
      title: '!join dans ton chat',
      body: [
        'Ouvre **Settings** → **!join in Twitch chat** et active-le.',
        'Quand un viewer tape `!join`, le bot Anvil (Anvil_OSRS) répond avec le lien de ton événement ouvert. Il répond au plus une fois toutes les 30 secondes, peu importe combien de personnes le tapent.',
        'Il ne répond que dans une chaîne que tu as connectée à l’étape 7. Pour Kick, active **!join in Kick chat** dans le bloc **Kick channel**.',
        'Aucun événement ouvert ? Il le dit : « No event is open to join right now — keep an eye on the stream! »',
      ],
      tips: [
        'Si ton chat bloque les liens (**Block hyperlinks** de Twitch ou AutoMod), la réponse du bot est retenue. Tape une fois `/vip anvil_osrs` ou `/mod anvil_osrs` dans ton chat pour que le lien passe.',
        'Tu travailles sur un événement ? **Space settings** dans le menu de l’événement te ramène à ces interrupteurs. **Switch it on in your settings**, sous **Who can join?**, aussi.',
      ],
    },

    page: {
      title: 'Personnalise ta page',
      body: [
        'Ta page, c’est ce que les gens voient sur `{apex}/c/your-name`, avec tes événements. Ouvre **Settings** → **Your page**. Chaque partie a son propre bouton d’enregistrement.',
      ],
      items: [
        '**Bio.** Quelques lignes sur toi et tes streams. Les liens qui commencent par `https://` sont cliquables.',
        '**Logo and banner.** Appuie sur **Upload a logo** ou **Upload a banner**. La bannière s’étend en haut de ta page, alors fais-la large (3:1, par exemple 1500 × 500). PNG, JPEG, GIF ou WebP. Les deux peuvent être animés.',
        '**Panels.** Jusqu’à 8 cartes sous tes événements, comme les panneaux sous une chaîne Twitch. Appuie sur **+ Add a panel** et donne-lui un titre et un peu de texte. Une image et un lien sont facultatifs. Utilise les flèches pour changer l’ordre.',
        '**Schedule.** Quand tu passes en live d’habitude, dans ton propre fuseau horaire. Les visiteurs voient chaque horaire à leur propre heure.',
        '**Featured.** Un clip épinglé en haut de ta page. Choisis un de tes temps forts de stream (étape suivante), ou colle un lien de clip Twitch, YouTube, Kick ou Medal.',
        'Appuie sur **Preview your page** pour la voir comme les visiteurs.',
      ],
      note: {
        tag: 'Les règles de Jagex',
        body: 'Tout ce qui est sur ta page doit respecter les règles de Jagex : pas de vente d’or ou de comptes, pas de jeux d’argent, pas de bots et pas de serveurs privés. Anvil vérifie tes textes et tes liens quand tu enregistres. Si l’équipe Anvil masque ta page après un signalement, tes paramètres l’indiquent. Demande sur le Discord d’Anvil si tu penses que c’est une erreur.',
      },
    },

    highlights: {
      title: 'Temps forts du stream',
      body: [
        'Avec ta chaîne Twitch ou YouTube connectée, Anvil capture les grands moments de tes événements pendant que tu es en live. Les interrupteurs sont dans **Settings** → **Stream highlights**.',
        '**Auto-clip big moments on my stream** est activé dès que tu connectes ta chaîne. Pendant que tu es en live sur Twitch, Anvil crée un clip quand un de tes événements commence, quand une équipe termine la grille ou gagne, et quand ton propre personnage obtient un drop rare ou un pet. Sur YouTube, il enregistre plutôt un lien vers cette seconde de ton stream. Kick n’a pas encore de temps forts.',
        'Les clips apparaissent sous **Highlights** sur la page de l’événement et sur ta page. Tu peux en épingler un comme clip **Featured** (étape 10).',
        '**Let Anvil feature clips from my events in its own promotion** reste désactivé tant que tu ne l’actives pas. Ensuite, Anvil peut partager un clip sur ses propres pages et réseaux sociaux, et te cite toujours.',
        'Tes joueurs peuvent aussi clipper leurs propres grands moments. Ils activent **Clip my stream when I hit a big moment** sous leur compte Twitch dans **Settings** → **Connected accounts**.',
      ],
    },

    listing: {
      title: 'Sois listé sur Anvil',
      body: [
        'Ton espace n’est pas listé quand tu le crées. Seules les personnes avec ton lien peuvent le trouver.',
        'Ouvre **Settings** → **Advertise on Anvil** et active-le. Ton espace apparaît dans l’annuaire des clans d’Anvil, et tes nouveaux événements apparaissent sur `{apex}/events`.',
        'Pour lister un seul événement, ouvre son **Settings** → **Viewers** → **List on Anvil**. Il apparaît tant que l’événement est à venir ou en cours.',
        'Un événement sans dates apparaît sous **Open to join**, avec la mention « Open now · starts when the host starts it ».',
      ],
    },

    plans: {
      title: 'Offres et limites',
      body: [
        'Ton offre fixe combien de joueurs peuvent être dans tes événements en même temps. Les événements dont les dates se chevauchent se partagent ce nombre ; les événements à des dates différentes l’ont chacun. Un joueur dans deux événements qui se chevauchent compte deux fois. Tout le reste est identique pour toutes les offres : la grille, le suivi du plugin, l’overlay et Discord.',
        'Ta carte d’offre est dans **Your events**. Pour comparer les offres, voir les [tarifs](/pricing#creators). Pour changer ou annuler ton paiement, va sur [ta page de facturation](/portal).',
      ],
      rows: [
        { term: 'Free', body: 'Jusqu’à 50 joueurs en même temps sur l’ensemble de tes événements. Un événement à la fois. Vérifications de rôle Discord et de booster.' },
        { term: 'Bronze', body: 'Jusqu’à 150 joueurs en même temps sur l’ensemble de tes événements. Vérifications Twitch, Kick et YouTube.' },
        { term: 'Silver', body: 'Jusqu’à 300 joueurs en même temps sur l’ensemble de tes événements. Plusieurs événements à la fois. `!join` dans le chat. Affiché en premier dans la liste.' },
        { term: 'Gold', body: 'Jusqu’à 1 000 joueurs en même temps sur l’ensemble de tes événements. Masque la marque Anvil sur ton overlay.' },
        { term: 'Partner', body: 'Pas de limite de joueurs. Mise en place directement avec Anvil — contacte-nous.' },
      ],
      note: {
        tag: 'Pour l’instant',
        body: 'Tout le monde peut encore entrer pendant qu’Anvil grandit, même au-delà des chiffres de ton offre. Les limites arriveront plus tard, avec préavis. Ta carte d’offre montre où tu en es.',
      },
    },

    faq: {
      title: 'Questions',
      intro: 'Celles que les streamers posent le plus :',
      rows: [
        {
          term: 'Mes viewers ont-ils besoin d’un clan ?',
          body: 'Non. Il leur faut un compte Discord et un personnage OSRS. Envoie-leur le [guide du viewer]({joiningGuide}).',
        },
        {
          term: 'Ont-ils besoin du plugin RuneLite ?',
          body: 'Pour les drops et les kills, oui. Le plugin les envoie tout seul. Quelques cases lisent plutôt les hiscores.',
        },
        {
          term: 'Un viewer dit « The host’s Twitch connection isn’t working ».',
          body: 'Twitch n’accepte plus ta connexion. Ouvre **Settings** et appuie sur **Reconnect Twitch**. Pareil pour Kick et YouTube.',
        },
        {
          term: 'Quelqu’un d’autre peut-il m’aider à gérer ?',
          body: 'Oui. Ouvre **Players** → **Staff & roles**, ajoute-les et choisis ce que chacun peut faire.',
        },
        {
          term: 'J’ai aussi un clan en jeu.',
          body: 'Alors tu n’as peut-être pas besoin d’un espace. Un clan public peut activer **Streaming** à la place. Voir [streamer pour un clan]({streamingGuide}).',
        },
        {
          term: 'Puis-je créer un deuxième espace ?',
          body: 'Un espace par compte Discord pour l’instant. Contacte-nous si tu en as besoin d’un autre.',
        },
        {
          term: 'Où sont les paramètres de mon espace ?',
          body: 'Appuie sur **Settings** dans le menu. Depuis un événement, appuie sur **Space settings** dans le menu de l’événement.',
        },
        {
          term: 'À quoi sert le bouton **Report** sur ma page ?',
          body: 'Toute personne connectée peut signaler ta page, un panneau, un événement ou un temps fort à l’équipe Anvil. Les signalements ne vont qu’à l’équipe. Si l’équipe masque ta bio, tes panneaux, ton planning ou ton clip mis en avant, tes paramètres l’indiquent.',
        },
      ],
    },
  },

  // /guide/joining-a-streamer-event — pour un viewer qui a cliqué sur le lien d’un streamer.
  joiningStream: {
    metaTitle: 'Rejoindre le bingo OSRS d’un streamer — Anvil',
    metaDescription:
      'Tu as reçu un lien d’un streamer ? Connecte-toi avec Discord, ajoute ton personnage OSRS, appuie sur Join. Que faire pour les événements réservés aux followers ou abonnés sur Twitch, Kick ou YouTube, et comment tes drops comptent.',
    eyebrow: 'Pour les viewers',
    title: 'Rejoindre l’événement d’un streamer',
    dek: 'Un streamer a partagé un lien. Voici comment te mettre sur la grille. Pas besoin de clan.',
    facts: [
      { strong: '~2 min', rest: 'pour rejoindre' },
      { strong: 'Pas de clan', rest: 'nécessaire' },
    ],

    join: {
      title: 'Rejoins en quatre étapes',
      body: [
        '**Ouvre le lien** partagé par le streamer. Ou tape `!join` dans son chat et le bot le poste.',
        '**Connecte-toi avec Discord.** C’est ton compte Anvil. Rien à remplir.',
        '**Ajoute ton personnage.** Appuie sur **Add my character** et tape ton nom RuneScape. Si tu vois **Prove it’s mine**, suis les étapes sur ton profil. Le [guide du plugin]({pluginGuide}) explique comment.',
        '**Appuie sur Join.** Choisis ton personnage si tu en as plusieurs. Tu vois **You’re in!** quand ça a marché.',
      ],
    },

    gated: {
      title: 'Événements pour followers ou abonnés',
      body: [
        'Certains événements sont réservés à la communauté du streamer. La carte pour rejoindre dit qui, par exemple « Open to followers of somename on Twitch ».',
        'Appuie quand même sur **Join**. Si tu n’es pas encore accepté, la carte liste quoi faire. Fais l’une de ces choses, puis appuie à nouveau sur **Join**.',
      ],
      intro: 'Quoi faire pour chaque cas :',
      rows: [
        {
          term: 'Twitch follow or sub',
          body: 'Appuie sur **Link Twitch** et connecte-toi avec Twitch. Anvil ne demande aucune permission. Puis appuie à nouveau sur **Join**.',
        },
        {
          term: 'Kick follow or sub',
          body: 'Appuie sur **Get Kick code**. Tape le code (comme `ANVIL-7F3K9Q`) dans le chat Kick du streamer dans les 10 minutes. Chaque code ne marche qu’une fois. Puis appuie à nouveau sur **Join**.',
        },
        {
          term: 'YouTube subscriber',
          body: 'Appuie sur **Check my YouTube subscription** et connecte-toi avec Google. Choisis le compte avec lequel tu regardes. Tes abonnements doivent être publics dans les paramètres de confidentialité de YouTube.',
        },
        {
          term: 'YouTube member',
          body: 'Appuie sur **Link my YouTube account**, puis tape ton code dans le chat en direct YouTube et appuie sur **check the chat**. Ça ne marche que pendant le live du streamer.',
        },
        {
          term: 'Discord role or booster',
          body: 'Rejoins le serveur Discord du streamer et obtiens le rôle (ou booste-le). Anvil vérifie avec le compte Discord avec lequel tu t’es connecté.',
        },
      ],
      note: {
        tag: 'Approbation',
        body: 'Certains streamers disent oui à chaque joueur. Le bouton affiche alors **Ask to join**, et tu vois **Waiting for the host** jusqu’à leur réponse.',
      },
    },

    plugin: {
      title: 'Installe le plugin Anvil',
      body: [
        'Tes drops et tes kills comptent grâce au plugin Anvil pour RuneLite. Installe-le depuis le Plugin Hub et connecte-toi avec Discord depuis son panneau latéral.',
        'Le [guide du plugin]({pluginGuide}) t’accompagne en trois minutes environ.',
      ],
    },

    play: {
      title: 'Joue',
      body: [
        'C’est tout. Joue normalement. Quand tu obtiens un drop ou un kill dont la grille a besoin, le plugin l’envoie tout seul.',
        'Ouvre le lien de l’événement à tout moment pour voir la grille et le classement. Tu joues uniquement cet événement : tu ne rejoins pas un clan.',
      ],
    },

    accounts: {
      title: 'Tes comptes connectés',
      body: [
        'Les comptes Twitch, YouTube et Kick que tu as liés sont dans [Settings → Connected accounts](/settings/connections). Tu peux aussi les lier là avant de rejoindre.',
        'Tu peux en délier un à tout moment. Les événements déjà rejoints te gardent. Un événement réservé que tu rejoins plus tard te demandera de lier à nouveau.',
        'Les comptes Twitch, YouTube et Kick liés apparaissent sur ton profil avec une coche de vérification : tu as prouvé qu’ils sont à toi. Désactive **Show on my profile** pour en masquer un. Un lien Medal, c’est différent. Tu le colles toi-même, donc il n’a pas de coche.',
        'Tu streames toi-même sur Twitch ? Active **Clip my stream when I hit a big moment** sous ton compte Twitch. Pendant que tu es en live dans l’événement d’un streamer, Anvil clippe tes drops rares, tes pets et tes cases terminées.',
      ],
    },

    faq: {
      title: 'Questions',
      intro: 'Quand quelque chose dit non :',
      rows: [
        {
          term: '“This event is full”',
          body: 'Il n’y a plus de place. Seul le streamer peut en faire — préviens-le.',
        },
        {
          term: 'Je suis abonné mais ça ne me laisse pas entrer.',
          body: 'Vérifie que tu as lié le même compte que celui avec lequel tu t’abonnes. Sur Twitch, regarde **Your Twitch** sur la carte pour rejoindre. Sur Kick, tape un nouveau code dans son chat : Anvil lit le badge d’abonné sur ce message. Sur YouTube, rends tes abonnements publics et revérifie.',
        },
        {
          term: 'J’ai suivi sur Kick mais ça dit que non.',
          body: 'Anvil ne voit que les follows faits après que le streamer a connecté Kick. Désabonne-toi et suis à nouveau, puis appuie sur **Join**.',
        },
        {
          term: '“That Twitch account was already used to join this event”',
          body: 'Un compte Twitch (ou Kick, ou YouTube) ne fait entrer qu’un joueur. Quelqu’un d’autre a déjà rejoint avec.',
        },
        {
          term: '“Twitch didn’t answer just now”',
          body: 'Twitch, Kick, YouTube ou Discord a eu un petit souci. Attends une minute et appuie à nouveau sur **Join**.',
        },
        {
          term: '“The host’s … connection isn’t working”',
          body: 'C’est du côté du streamer. Dis-lui de reconnecter sa chaîne sur Anvil.',
        },
        {
          term: 'Mes drops n’apparaissent pas.',
          body: 'Vérifie que le plugin est installé et connecté, et que tu as rejoint avec le personnage que tu joues. Voir le [guide du plugin]({pluginGuide}).',
        },
        {
          term: 'Où trouver d’autres événements comme celui-ci ?',
          body: '[La page des événements](/events) liste les événements que tout le monde peut rejoindre, y compris les événements de streamers ouverts en ce moment.',
        },
        {
          term: 'Quelque chose sur la page d’un streamer enfreint les règles.',
          body: 'Appuie sur **Report** sur la page, l’événement ou le temps fort. Choisis ce qui ne va pas et appuie sur **Send**. Ça ne va qu’à l’équipe Anvil. Le streamer ne saura jamais qui l’a signalé.',
        },
      ],
    },
  },

  // /guide/streaming-for-clans — un clan public qui active Streaming.
  streamingClans: {
    metaTitle: 'Streamer les événements de ton clan — Anvil',
    metaDescription:
      'Laisse les viewers de ton stream rejoindre un événement OSRS de ton clan sans rejoindre le clan : active Streaming, ouvre un événement aux viewers et choisis quels viewers peuvent entrer.',
    eyebrow: 'Pour les clans qui streament',
    title: 'Streamer pour un clan',
    dek: 'Ton clan streame ses événements ? Laisse les viewers jouer un événement sans rejoindre ton clan.',

    on: {
      title: 'Active Streaming',
      body: [
        'Va dans Admin → **Clan settings** → **Profile** et active **Streaming**.',
        'Seul un clan public peut streamer. Les viewers doivent ouvrir la page de ton événement, et un clan privé la leur cache. Un clan avec Streaming activé ne peut pas passer en privé tant que tu ne le désactives pas.',
        'Une fois activé, connecte ta chaîne Twitch, YouTube ou Kick juste en dessous.',
      ],
    },

    event: {
      title: 'Ouvre un événement aux viewers',
      body: [
        'Chaque événement reste **Members only** tant que tu ne dis pas autre chose. C’était déjà comme ça avant.',
        'Ouvre **Settings** → **Entry & co-hosts** → **Who can join?** de l’événement et choisis **Members and viewers**. Puis choisis **Which viewers?** : tout le monde, ou followers, abonnés, un rôle Discord, etc. Appuie sur **Save**.',
        'Ces vérifications ne concernent que les viewers. Les membres de ton clan entrent toujours, comme avant.',
      ],
    },

    viewers: {
      title: 'Ce que sont les viewers',
      body: [
        'Un viewer qui rejoint devient un **event player**. Il ne joue que cet événement.',
        'Ce ne sont ni des membres du clan, ni des invités. Ils n’apparaissent jamais dans la liste de ton clan et n’obtiennent aucun rang.',
        'Tu peux voir tous ceux qui ont rejoint ainsi sous **People** → **Past viewers**.',
        'Un habitué que tu veux garder ? **Make guest** sur sa ligne en fait un invité du clan, pour qu’il puisse rejoindre tous tes événements ouverts aux invités, pas seulement celui-ci. **Make a guest a viewer again** refait d’un invité un viewer d’un seul événement.',
      ],
    },

    tools: {
      title: 'Tes outils de stream',
      body: [
        'Les outils du streamer fonctionnent comme dans un espace créateur : liens de chaîne vérifiés, vérifications **Who can join?**, l’overlay OBS et `!join` dans le chat.',
        'Les liens d’overlay d’un événement de clan sont dans les **Settings** de l’événement → **Stream** → **Stream overlay**. `!join` et la marque de l’overlay sont sous **Clan settings** → **Profile** → **Streaming**.',
        'Le [guide du créateur]({creatorsGuide}) explique chacun pas à pas.',
        'Les temps forts du stream marchent ici aussi : avec Twitch ou YouTube connecté, Anvil clippe les grands moments des événements ouverts aux viewers. `!join` dans le chat Kick a son propre interrupteur dans le bloc **Kick channel**.',
      ],
    },

    faq: {
      title: 'Questions',
      intro: 'Les réponses courtes :',
      rows: [
        {
          term: 'Les viewers comptent-ils dans notre limite de membres ?',
          body: 'Non. Ce sont des joueurs d’événement, pas des membres. Les limites du streamer comptent les joueurs en même temps sur l’ensemble des événements que tu organises (voir le [guide du créateur]({creatorsGuide})).',
        },
        {
          term: '`!join` enverra-t-il des gens vers un événement réservé aux membres ?',
          body: 'Non. Il ne pointe que vers un événement ouvert aux viewers.',
        },
        {
          term: 'Devrais-je plutôt créer un espace créateur ?',
          body: 'Seulement si tu n’as pas de clan. Un espace est pour les streamers sans clan en jeu.',
        },
      ],
    },
  },

  people: {
    metaTitle: 'Vos membres : liste, invités et qui peut rejoindre — Anvil',
    metaDescription:
      'D’où vient la liste des membres d’un clan Anvil, ce que veulent dire Members, Guests, Roster only, Departed et Quiet, comment fonctionnent les demandes d’adhésion et Needs review, les trois réglages de Who can join, et retirer ou bannir quelqu’un.',
    eyebrow: 'Anvil · pour l’équipe du clan',
    title: 'Vos membres : liste, invités et qui peut rejoindre',
    dek: 'Toute personne sous Admin → **People** est arrivée là de l’une de quatre façons : la liste du clan en jeu l’a nommée, le staff l’a acceptée, le clan laisse entrer tout le monde, ou quelqu’un l’a ajoutée à la main. Voici comment fonctionne chacune, ce que vous dit l’onglet Roster, et quoi vérifier quand quelqu’un n’est pas au bon endroit.',
    facts: [
      { strong: 'Liste du clan en jeu', rest: 'la seule façon automatique de devenir membre' },
      { strong: 'Se connecter', rest: 'n’inscrit jamais personne sur la liste' },
      { strong: 'Deux files d’attente', rest: 'sur deux onglets différents' },
    ],
    footnote:
      'Tout ceci se trouve sous Admin → **People**. Roster et Needs review relèvent des modérateurs. **Who can join** et **Staff & roles** sont des onglets réservés aux admins. Pour savoir qui peut faire quoi dans toute l’administration, voir [Rôles du staff : qui peut faire quoi]({staffGuide}).',

    roster: {
      title: 'D’où vient la liste des membres',
      body: [
        'La liste des membres, c’est la liste de votre clan en jeu, recopiée sur le site. Un admin l’envoie depuis RuneLite avec le plugin Anvil : appuyez sur le bouton **Anvil** dans la barre de titre de la fenêtre du clan, ou sur **Sync roster** dans le panneau latéral du plugin. Chaque personne de la liste arrive comme **membre**, avec son rang en jeu. Seul quelqu’un qui a le rôle Admin sur le site peut l’envoyer. Les autres en sont avertis en jeu.',
        'Une synchronisation est la seule chose qui fait de quelqu’un un membre à elle seule. Quelqu’un qui quitte le clan en jeu est marqué comme parti à la synchronisation suivante, et quelqu’un qui revient réapparaît à celle d’après. Son historique reste dans les deux cas.',
        'Toute autre place est une place d’**invité** : quelqu’un qui joue vos événements sans être dans votre clan en jeu. Les invités sont suivis et peuvent participer aux événements. Ce ne sont pas des membres, et ils ne comptent pas dans votre formule.',
      ],
      note: {
        tag: 'Se connecter n’inscrit jamais personne sur la liste',
        body: 'Se connecter avec Discord, relier un personnage ou jouer avec le plugin ne donne de place à personne. Si le plugin voit quelqu’un dont le clan en jeu est le vôtre mais qui n’est pas encore sur la liste, il fait une demande pour lui (voir l’étape 3). Les autres ont simplement un compte Anvil sans clan. C’est ce qui empêche un inconnu de rejoindre votre clan en tapant son nom.',
      },
    },

    filters: {
      title: 'Lire l’onglet Roster',
      intro:
        'La barre du haut découpe la liste en **Members**, **Guests** et **Departed**. Cliquez sur un segment pour filtrer. Les puces en dessous affinent encore la liste :',
      rows: [
        {
          term: 'Active',
          body: 'les membres toujours sur la liste. Les invités et les partis en sont exclus.',
        },
        {
          term: 'Quiet 7d+',
          body: 'les membres que le plugin n’a pas vus jouer depuis sept jours ou plus. Quelqu’un qui n’a jamais utilisé le plugin n’y figure pas, faute de quoi le juger. Sa colonne **Last played** affiche alors **no plugin data**.',
        },
        {
          term: 'Guests',
          body: 'les places d’invité actuelles : des gens qui jouent vos événements sans être dans votre clan en jeu.',
        },
        {
          term: 'Roster only',
          body: 'les membres et invités actuels qui n’ont pas encore de compte sur le site. C’est normal pour quiconque ne s’est jamais connecté avec Discord. Ils restent sur la liste ; ils se connectent et relient leur personnage le jour où ils veulent s’inscrire à quelque chose.',
        },
        {
          term: 'Departed',
          body: 'les gens partis en jeu, ou retirés par le staff. Leurs résultats et leur historique restent.',
        },
        {
          term: 'All',
          body: 'tout ce qui précède.',
        },
      ],
      outro:
        'La colonne **Source** indique comment chaque place a commencé : **Clan sync**, **Added manually** ou **Applied or self-reported**. **Last played** vient du plugin, pas de la synchronisation de la liste.',
      note: {
        tag: 'Le rang et le rôle sont deux choses différentes',
        body: 'Les deux menus déroulants à côté des puces filtrent par rang en jeu et par rôle sur le site. Le rang est ce que le jeu rapporte. Le rôle sur le site est ce qu’un admin règle sous **Staff & roles**. L’un ne règle jamais l’autre.',
      },
    },

    review: {
      title: 'Demandes d’adhésion et Needs review',
      intro: 'Deux sortes de personnes attendent un oui, et elles n’attendent pas sur le même onglet.',
      rows: [
        {
          term: 'Demandes pour rejoindre',
          body: 'en haut de l’onglet **Roster**, affichées seulement quand quelqu’un attend. Une demande vient du site (la personne a appuyé sur **Apply** sur la page de votre clan, ou a tenté d’entrer dans l’un de vos événements) ou du plugin (il l’a vue jouer dans votre clan en jeu avant que la liste ne l’ait). Chaque ligne indique laquelle, et si la personne est membre d’un autre clan. **Approve** lui donne une place d’invité. **Decline** la prévient, par MP Discord quand votre bot peut la joindre. Cochez-en plusieurs pour répondre d’un coup.',
        },
        {
          term: 'En attente de confirmation',
          body: 'sur **Needs review**. Des gens qui ont relié l’un des personnages de votre liste en gagnant de l’XP dessus, en le demandant, ou en le jouant avec le plugin. Ils peuvent déjà jouer pendant qu’ils attendent. Vérifiez que le nom Discord correspond au personnage, puis appuyez sur **Approve**. **Not our member** retire le personnage de votre liste et le laisse à son propriétaire. **Report to Anvil** sert pour un personnage qui n’est pas le leur.',
        },
        {
          term: 'Demandes de revendication',
          body: 'aussi sur **Needs review**. Quelqu’un a joué un personnage qui est déjà un membre établi chez vous, donc Anvil ne le lui a pas relié tout seul. Si vous savez que c’est bien lui, appuyez sur **Yes, that’s them** ; sinon, **Not them**. Un personnage qui n’a jamais été que dans votre clan est relié tout de suite. Un personnage qui est aussi dans un autre clan part chez Anvil pour décision.',
        },
      ],
      note: {
        tag: 'Le badge ne compte pas les demandes d’adhésion',
        body: 'Le nombre sur **Needs review**, et sur **People** dans la barre latérale, compte les confirmations en attente et les demandes de revendication. Les demandes d’adhésion n’y sont pas, alors regardez aussi le haut de l’onglet Roster.',
      },
    },

    policy: {
      title: 'Qui peut rejoindre',
      intro:
        'Admin → People → **Who can join** contient trois réglages, et seuls les admins voient cet onglet. Celui qui décide comment les gens de l’extérieur entrent est **Players from other clans** :',
      rows: [
        {
          term: 'Ask first',
          body: 'le réglage par défaut. Quelqu’un qui postule, ou que le plugin repère dans votre clan en jeu, attend sous forme de demande d’adhésion jusqu’à ce que le staff l’accepte. Personne n’a de place sans un oui.',
        },
        {
          term: 'Let anyone in',
          body: 'demander suffit. La personne reçoit tout de suite une place d’invité et aucune demande n’est créée. Bien pour un événement ouvert, bruyant sinon.',
        },
        {
          term: 'No guests',
          body: 'seuls vos propres membres jouent. Les joueurs d’autres clans ne peuvent ni entrer dans vos événements ni demander à rejoindre, et le plugin ne crée rien pour eux.',
        },
      ],
      outro:
        '**Who can see this clan** vaut **Anyone** (un lien vers un plateau marche pour quiconque le reçoit) ou **Members only** (les autres voient la carte du clan et une invitation à postuler). **List in the Clan Hall** fait figurer le clan dans la liste publique des clans. Le désactiver ne rend pas le clan privé.',
      note: {
        tag: 'Aucun de ces réglages ne touche vos membres',
        body: 'La synchronisation de la liste installe les membres quoi qu’ils disent. Votre propre staff n’est jamais traité en invité non plus : le personnage d’un membre du staff reçoit une place de membre sans demande.',
      },
    },

    manual: {
      title: 'Ajouter quelqu’un à la main',
      body: [
        'Roster → **+ Add Manually** met un personnage sur la liste. Remplissez le **RSN**, et si vous voulez son **Discord ID** et son **Rank**. Cochez **Add as guest** pour quelqu’un qui n’est pas dans votre clan en jeu. Les modérateurs comme les admins peuvent le faire.',
        'Servez-vous-en pour quelqu’un que la synchronisation ne voit pas encore, comme une recrue arrivée après la dernière. La place est marquée **Added manually**, et la synchronisation la traite comme votre décision : si vous retirez plus tard une place ajoutée à la main, la synchronisation suivante ne la remet pas.',
        'Ajouter quelqu’un à la liste ne l’inscrit à aucun événement. Pour cela, ouvrez l’onglet **Sign-ups** de l’événement et utilisez **Add member**. Celui-là est réservé aux admins.',
      ],
    },

    removing: {
      title: 'Retirer et bannir',
      intro: 'Chaque ligne de la liste a un menu d’actions. Elles ne font pas la même chose :',
      rows: [
        {
          term: 'Demote to guest',
          body: 'la personne reste sur la liste et peut toujours être inscrite aux événements, mais ne compte plus comme membre. **Promote to member** fait l’inverse.',
        },
        {
          term: 'Remove from roster',
          body: 'la marque comme partie. Son historique et ses résultats restent. Si elle est toujours dans votre clan en jeu, la synchronisation suivante peut la remettre.',
        },
        {
          term: 'Not our member',
          body: 'sur Needs review, pour un personnage que quelqu’un a relié et qui n’est pas dans votre clan. Il quitte votre liste et reste à son propriétaire.',
        },
        {
          term: 'Ban from this clan',
          body: 'met fin à toutes les places de la personne ici, alts compris, lui retire tout rôle de staff et toute fonction de plateau qu’elle a dans ce clan, et l’empêche de revenir : la synchronisation, le plugin et les demandes d’adhésion la refusent tous jusqu’à la levée du bannissement. Son compte Anvil et ses autres clans ne sont pas touchés. Réservé aux admins, pour quelqu’un qui a un compte sur le site et un rôle inférieur à admin, depuis le menu de la ligne, depuis **Staff & roles**, ou pour plusieurs personnes à la fois. Lever un bannissement ne la remet pas en place ; elle revient en jeu ou vous l’ajoutez.',
        },
      ],
      note: {
        tag: 'Un bannissement retire aussi le rôle de staff',
        body: 'Bannir quelqu’un met fin à ses places et lui retire son rôle de staff ainsi que toute fonction d’éditeur ou de trésorier sur les plateaux de ce clan. Lever le bannissement ne les lui rend pas : redonnez-lui le rôle dans Staff & roles s’il doit l’avoir.',
      },
    },

    faq: {
      title: 'Questions fréquentes',
      intro: 'Ce qui explique d’habitude que quelqu’un ne soit pas au bon endroit.',
      rows: [
        {
          term: 'Quelqu’un du clan manque',
          body: 'Lancez d’abord une synchronisation : la liste ne change que quand un admin l’envoie. Puis regardez **Departed**, au cas où la personne aurait été retirée, et si elle est bannie ; la synchronisation saute toute personne bannie ici et dit qui elle a sautée. Si le clan dépasse sa formule et que le délai de grâce est fini, une synchronisation n’ajoute plus de nouveaux membres tant que vous ne passez pas à la formule supérieure ou n’allégez pas la liste.',
        },
        {
          term: 'Quelqu’un apparaît comme invité alors qu’il est dans le clan',
          body: 'En général, il est encore membre d’un autre clan sur Anvil. Un personnage ne peut être membre que d’un clan à la fois, donc la synchronisation l’installe ici comme invité et en fait un membre à la première synchronisation après son départ de l’autre clan. Sinon, il est entré par une demande d’adhésion, ou quelqu’un l’a rétrogradé ou ajouté comme invité. Lancez une synchronisation, ou utilisez **Promote to member**.',
        },
        {
          term: 'Quelqu’un s’est connecté mais n’est pas sur la liste',
          body: 'C’est normal. Se connecter crée un compte Anvil, pas une place. La personne apparaît quand la synchronisation la liste, quand vous acceptez sa demande, ou quand vous l’ajoutez à la main.',
        },
        {
          term: 'Des noms comme #Player1234',
          body: 'RuneLite affiche un nom provisoire de ce genre un instant pendant qu’un joueur se connecte, et pour les membres du clan qu’il ne sait pas nommer. Anvil ignore désormais ces noms : la synchronisation les saute, le plugin ne crée aucune demande pour eux, et les anciennes demandes sous un tel nom sont masquées. S’il en reste un sur votre liste, c’est une ancienne ligne. **Remove from roster** l’efface.',
        },
        {
          term: 'Un membre retiré revient sans cesse',
          body: 'Retirer quelqu’un ne change pas le clan en jeu, donc la synchronisation suivante le remet tant que le jeu le liste encore. Retirez-le en jeu, ou bannissez-le ici.',
        },
        {
          term: 'Un modérateur ne voit pas Who can join',
          body: 'C’est un onglet réservé aux admins, comme Staff & roles. Voir [Rôles du staff : qui peut faire quoi]({staffGuide}).',
        },
      ],
    },
  },

  staffRoles: {
    metaTitle: 'Rôles du staff : qui peut faire quoi — Anvil',
    metaDescription:
      'Les rôles de clan sur Anvil (propriétaire, admin, trésorier, modérateur, membre), ce que chacun peut atteindre, comment nommer un modérateur, qui peut donner quel rôle, et les fonctions limitées à un seul événement.',
    eyebrow: 'Anvil · pour les propriétaires et les admins',
    title: 'Rôles du staff : qui peut faire quoi',
    dek: 'Cinq rôles, réglés clan par clan sous Admin → People → **Staff & roles**. Un rôle ici ne donne rien dans un autre clan, et personne ne peut attribuer un rôle égal ou supérieur au sien. Cette page est la carte complète : ce que chaque rôle atteint, comment le donner, et les fonctions qui couvrent un seul événement.',
    facts: [
      { strong: 'Par clan', rest: 'un rôle ici ne vaut rien ailleurs' },
      { strong: 'En dessous du vôtre', rest: 'c’est tout ce que vous pouvez donner' },
      { strong: 'Propriétaire', rest: 'ne change que par transfert' },
    ],
    footnote:
      'Les rôles sont revérifiés à chaque chargement de page, donc un changement s’applique au clic suivant de la personne ; elle n’a pas besoin de se déconnecter. Pour la liste elle-même, voir [Vos membres]({peopleGuide}). Pour la journée d’un modérateur, voir [De permanence]({moderatorGuide}).',

    roles: {
      title: 'Les rôles',
      intro: 'Toute personne qui se connecte avec Discord commence comme simple **Member**. Au-dessus :',
      rows: [
        {
          term: 'Propriétaire',
          body: 'la personne qui a créé le clan, jusqu’à ce qu’elle le transmette. Tout ce qu’un admin peut faire, plus transférer la propriété et supprimer le clan. Il n’y en a qu’un, et personne ne peut le rétrograder, le retirer ou le bannir.',
        },
        {
          term: 'Admin',
          body: 'tout sauf céder le clan : événements et plateaux, réglages, Discord, staff et l’argent du clan.',
        },
        {
          term: 'Trésorier',
          body: 'les frais, la caisse et les prix, en plus de tout ce que fait un modérateur : la liste des membres, les preuves, les compétitions, le Schedule et Needs review.',
        },
        {
          term: 'Modérateur',
          body: 'les nouveaux venus, la liste des membres, les preuves, les compétitions hebdomadaires et les événements du clan. Pas d’événements ni de plateaux, pas de réglages, pas de staff et pas d’argent.',
        },
        {
          term: 'Membre',
          body: 'aucune fonction de staff. Joue, s’inscrit, et peut déclarer un don à la caisse.',
        },
      ],
      outro:
        'Deux cases se trouvent sous le rôle dans Staff & roles, pour toute personne en dessous d’admin, simples membres compris. **Can build bingo boards** ouvre l’onglet Tiles de chaque plateau et la Task library. **Can write guides** permet d’écrire les guides du clan. Les admins ont déjà les deux.',
    },

    assign: {
      title: 'Nommer un modérateur',
      intro:
        'La personne doit s’être connectée avec Discord et avoir relié un personnage qui est sur votre liste, comme membre ou comme invité. Ensuite :',
      steps: [
        'Ouvrez Admin → **People** → **Staff & roles**.',
        'La liste s’ouvre sur **Staff**. Passez à **Members** ou **All accounts** et cherchez son nom.',
        'Dans la colonne **Role**, choisissez **Moderator: newcomers, roster, sign-ups, proofs**. C’est enregistré dès que vous le choisissez.',
        'Si elle doit aussi construire des plateaux, cochez **Can build bingo boards**.',
      ],
      outro:
        'Pas encore connectée ? Trouvez son personnage dans l’onglet **Roster**, ouvrez son menu et choisissez **Set role**. Le rôle est alors enregistré sur le personnage. Elle le reçoit la première fois qu’elle se connecte et le relie, ou, si elle attend sur Needs review, quand un modérateur l’accepte.',
      note: {
        tag: 'Le retirer',
        body: 'Remettez le rôle sur **Member**. Changer le rôle de quelqu’un retire aussi ses fonctions sur les plateaux de ce clan (voir l’étape 5) ; rendez-les-lui ensuite s’il doit les garder.',
      },
    },

    who: {
      title: 'Qui peut donner quoi',
      intro:
        'Staff & roles est un onglet réservé aux admins, et chaque changement y est vérifié selon deux règles : vous ne pouvez donner qu’un rôle inférieur au vôtre, et vous ne pouvez modifier que quelqu’un dont le rôle est inférieur au vôtre.',
      rows: [
        {
          term: 'Le propriétaire',
          body: 'peut donner ou retirer Admin, Treasurer et Moderator.',
        },
        {
          term: 'Un admin',
          body: 'peut donner ou retirer Treasurer et Moderator. Un admin ne peut pas nommer un autre admin, modifier un autre admin, ni changer son propre rôle.',
        },
        {
          term: 'Les trésoriers et les modérateurs',
          body: 'ne peuvent changer le rôle de personne. L’onglet leur est masqué.',
        },
        {
          term: 'Personne',
          body: 'ne peut changer le rôle du propriétaire, le retirer ou le bannir. Le clan garde aussi toujours un admin : le dernier ne peut pas être rétrogradé.',
        },
      ],
      note: {
        tag: 'Céder le clan',
        body: 'Seul le propriétaire le peut, et seulement au profit de quelqu’un qui est déjà admin : la ligne de cet admin propose une action **Make owner**. Par sécurité, cela prend 3 jours, comme changer le code PIN de la banque : une bannière sur chaque page d’administration indique quand cela aura lieu, d’ici là vous pouvez annuler avec **Cancel**, la personne peut refuser avec **Decline**, et l’équipe Anvil est prévenue et peut l’arrêter. Au bout des 3 jours, il devient propriétaire et vous devenez un admin ordinaire. Seul le nouveau propriétaire peut vous la retransférer.',
      },
    },

    table: {
      title: 'Qui peut faire quoi',
      intro:
        'Ce que chaque rôle atteint dans l’administration. « Si coché » désigne la case **Can build bingo boards** ou **Can write guides** dans Staff & roles.',
      areaLabel: 'Domaine',
      columns: ['Propriétaire', 'Admin', 'Trésorier', 'Modérateur', 'Membre'],
      rows: [
        { area: 'Tableau de bord', cells: ['Oui', 'Oui', 'Oui', 'Oui', 'Non'] },
        { area: 'Événements : créer, modifier, équipes, inscriptions, lancement', cells: ['Oui', 'Oui', 'Non', 'Non', 'Non'] },
        { area: 'Cases des plateaux et Task library', cells: ['Oui', 'Oui', 'Si coché', 'Si coché', 'Si coché'] },
        { area: 'Preuves à contrôler', cells: ['Oui', 'Oui', 'Oui', 'Oui', 'Non'] },
        { area: 'Compétitions hebdomadaires', cells: ['Oui', 'Oui', 'Oui', 'Oui', 'Non'] },
        { area: 'Événements du clan', cells: ['Oui', 'Oui', 'Oui', 'Oui', 'Non'] },
        { area: 'Calendrier', cells: ['Oui', 'Oui', 'Oui', 'Oui', 'Non'] },
        { area: 'Liste des membres : voir, ajouter, retirer', cells: ['Oui', 'Oui', 'Oui', 'Oui', 'Non'] },
        { area: 'Demandes d’adhésion et Needs review', cells: ['Oui', 'Oui', 'Oui', 'Oui', 'Non'] },
        { area: 'Bannir quelqu’un du clan', cells: ['Oui', 'Sous admin', 'Non', 'Non', 'Non'] },
        { area: 'Staff & roles', cells: ['Oui', 'Sous admin', 'Non', 'Non', 'Non'] },
        { area: 'Who can join', cells: ['Oui', 'Oui', 'Non', 'Non', 'Non'] },
        { area: 'Caisse et grilles de prix', cells: ['Oui', 'Oui', 'Oui', 'Non', 'Non'] },
        { area: 'Frais : marquer comme encaissés', cells: ['Oui', 'Oui', 'Oui', 'Non', 'Non'] },
        { area: 'Frais : confirmer (la seconde signature)', cells: ['Oui', 'Oui', 'Non', 'Non', 'Non'] },
        { area: 'Réglages Discord', cells: ['Oui', 'Oui', 'Non', 'Non', 'Non'] },
        { area: 'Publier sur Discord', cells: ['Oui', 'Oui', 'Non', 'Non', 'Non'] },
        { area: 'Réglages du clan : Profile, Features, Rules & scoring, Boosts', cells: ['Oui', 'Oui', 'Non', 'Non', 'Non'] },
        { area: 'Formule et facturation', cells: ['Oui', 'Oui', 'Non', 'Non', 'Non'] },
        { area: 'Guides', cells: ['Écriture', 'Écriture', 'Lecture ; écriture si coché', 'Lecture ; écriture si coché', 'Écriture si coché'] },
        { area: 'Journal d’activité', cells: ['Oui', 'Oui', 'Oui', 'Oui', 'Non'] },
        { area: 'Synchroniser la liste depuis RuneLite', cells: ['Oui', 'Oui', 'Non', 'Non', 'Non'] },
        { area: 'Transférer la propriété, supprimer le clan', cells: ['Oui', 'Non', 'Non', 'Non', 'Non'] },
      ],
      note: {
        tag: 'Masqué ne veut pas dire autorisé',
        body: 'La barre latérale ne liste que ce que votre rôle peut utiliser, mais la vérification qui compte se fait sur le serveur. Taper l’adresse d’une page que votre rôle ne peut pas utiliser vous renvoie au tableau de bord, et l’action derrière est refusée.',
      },
    },

    event: {
      title: 'Fonctions sur un seul événement',
      intro:
        'Certaines fonctions couvrent un seul événement plutôt que le clan. Un admin les donne sur l’événement lui-même, et elles n’atteignent que cet événement, donc on peut sans risque les confier à un simple membre.',
      rows: [
        {
          term: 'Éditeur de plateau',
          body: 'construit et modifie les cases de ce plateau. Se donne sous **Settings** → **Staff** → **Board staff** de l’événement, ou avec **Boards…** dans les actions d’une personne sur Staff & roles. Un membre qui en a une ne voit que ses plateaux dans l’administration.',
        },
        {
          term: 'Trésorier de plateau',
          body: 'encaisse les frais de ce plateau et gère ses versements, sans accès à la caisse du clan. Dans l’administration, il ne voit que ses propres plateaux, et seulement les onglets **Sign-ups** et **Prizes** de chacun. Se donne aussi sous **Board staff**.',
        },
        {
          term: 'Staff d’équipe',
          body: 'gère une équipe : sa composition, ses soumissions et preuves, et le marquage des frais payés par ses joueurs. Il ne peut toucher à aucune autre équipe, ni modifier le plateau, ni faire de choix de draft, ni remplacer qui que ce soit une fois l’événement lancé. S’ajoute sur la page de l’équipe sous **Team staff**. C’est ainsi que le modérateur d’un clan invité gère sa moitié d’un clan contre clan.',
        },
        {
          term: 'Capitaine',
          body: 'désigné par l’organisateur pour une équipe. Tout ce que le staff d’équipe peut faire, plus les choix de draft de l’équipe.',
        },
      ],
      note: {
        tag: 'Un rôle de clan remplace les fonctions de plateau',
        body: 'Donner un rôle de clan à quelqu’un, ou le changer, lui retire ses fonctions d’éditeur et de trésorier de plateau sur les plateaux de ce clan. Staff & roles vous prévient d’abord quand ce sont ses seules fonctions. Rendez-les-lui ensuite s’il doit les garder.',
      },
    },

    safety: {
      title: 'Garder les choses sûres',
      intro: 'Ces règles tiennent quelle que soit la répartition des rôles.',
      rows: [
        {
          term: 'Le propriétaire est protégé',
          body: 'sa ligne dans Staff & roles affiche **Protected**. Son rôle ne peut pas être changé et il ne peut pas être banni. La propriété ne change de mains que s’il la transfère.',
        },
        {
          term: 'Les admins ne peuvent pas s’écarter entre eux',
          body: 'un admin ne peut ni rétrograder ni bannir un autre admin, que ce soit un par un ou plusieurs à la fois. Quand deux admins ne sont pas d’accord, c’est le propriétaire qui tranche. Un bannissement retire aussi à la personne son rôle de staff et ses fonctions de plateau dans ce clan.',
        },
        {
          term: 'L’argent demande deux personnes',
          body: 'quand des frais doivent être confirmés, la confirmation doit venir d’un autre admin que celui qui les a marqués encaissés. Le nombre de confirmations nécessaires, de zéro à cinq, se règle sous **Clan settings** → **Rules & scoring** → **Fee sign-off**. Un admin qui gère seul l’argent peut toujours forcer la clôture des frais, avec un bouton à part.',
        },
        {
          term: 'Ce qu’un modérateur ne peut pas faire',
          body: 'créer ou modifier des événements, changer les réglages ou Discord, donner un rôle à qui que ce soit (lui compris), ni toucher à l’argent du clan.',
        },
        {
          term: 'Tout est consigné',
          body: 'les changements de rôle, les transferts de propriété, les bannissements et les réponses aux demandes d’adhésion sont inscrits dans l’**Activity log**, que tout le staff peut lire.',
        },
        {
          term: 'Les rôles Discord sont à part',
          body: 'la synchronisation des rôles d’Anvil fait correspondre les rôles Discord aux **rangs en jeu**, pas aux rôles du site. Nommer quelqu’un modérateur ici ne lui donne rien sur votre serveur Discord, et un rôle de modérateur donné à la main dans Discord n’est pas touché. La seule commande du bot qui change quelque chose, ajouter à la caisse avec `/coffer`, vérifie le rôle sur le site : trésorier, admin ou propriétaire.',
        },
      ],
    },
    log: {
      title: 'Le journal d’activité',
      body: [
        '**Activity log** dans le menu admin liste les 200 changements les plus récents, et tout membre du staff peut le lire : arrivées, départs, renommages et vérifications, transferts de propriété, capitaines nommés et retirés, inscriptions approuvées ou refusées, frais confirmés, fonctionnalités activées et réglages modifiés. **Filter by event type** le restreint.',
        'C’est aussi là que l’on nettoie les doublons. **Merge two members** fusionne un doublon dans le bon membre, et **Suspected renames** liste les changements de nom repérés par Anvil, à confirmer ou à rejeter.',
      ],
    },
  },

  supporter: {
    metaTitle: 'Anvil Supporter : paliers et avantages — Anvil',
    metaDescription:
      'Ce que reçoivent Anvil Supporter, Champion et Patron : couleurs de nom et étoile, GZ doré, avatar et bannière animés, la vitrine, événements entre amis, défis en face-à-face, chat d’événement et boosts de clan. Comment fonctionne la facturation Gumroad et ce qui se passe quand vous résiliez.',
    eyebrow: 'Anvil · pour les joueurs',
    title: 'Anvil Supporter : paliers et avantages',
    dek: 'Anvil Supporter est un abonnement personnel qui paie les serveurs d’Anvil. Il existe en trois paliers, chacun avec tout ce qu’a celui du dessous. Chaque avantage est esthétique ou donne de la place pour organiser : le suivi, les événements, le score et vos propres statistiques restent gratuits pour tout le monde, et rien ici ne change ce qu’un événement compte.',
    facts: [
      { strong: 'À partir de $1 par mois', rest: 'ou $10 par an' },
      { strong: 'Esthétique uniquement', rest: 'jamais un score, un rang ou un objet' },
      { strong: 'Rien n’est supprimé', rest: 'quand vous arrêtez' },
    ],
    footnote:
      'Tout ceci se règle sur le site sous **Settings** → **Supporter**, **Profile look** et **Clan boosts**. Pour les boosts en détail, voir [Booster un clan]({boostsGuide}). Pour savoir où vos couleurs apparaissent dans RuneLite, voir [Le panneau latéral, onglet par onglet]({panelGuide}).',

    tiers: {
      title: 'Les trois paliers',
      intro: 'Les prix sont sur la page **Anvil Supporter**, `/supporter`. Une formule annuelle coûte dix mois.',
      rows: [
        {
          term: 'Supporter',
          body: '$1 par mois ou $10 par an. Un nom doré et une étoile, un GZ doré, une vitrine à 4 emplacements, et vous pouvez organiser un événement entre amis.',
        },
        {
          term: 'Champion',
          body: '$2 par mois ou $20 par an. Un nom en dégradé parmi nos modèles (ou une couleur de votre choix), votre propre avatar et votre propre bannière (animés si vous le souhaitez), 8 emplacements de vitrine, un chat d’événement plus rapide et 1 boost de clan.',
        },
        {
          term: 'Patron',
          body: '$5 par mois ou $50 par an. Votre propre dégradé de 4 couleurs au plus, qui bouge, 12 emplacements de vitrine, aucune attente dans le chat d’événement, 2 événements entre amis à la fois et 2 boosts de clan.',
        },
      ],
      note: {
        tag: 'Du temps grâce aux invitations',
        body: 'Sous Settings → Supporter, vous avez un lien d’invitation. Quand un ami que vous avez invité paie, vous gagnez des mois gratuits ; la récompense arrive deux semaines après son premier paiement. Le temps gagné ainsi donne tous les avantages de son palier, sauf les boosts de clan.',
      },
    },

    compare: {
      title: 'Ce que reçoit chaque palier',
      intro: 'Le même tableau que sur la page Supporter, plus les avantages du chat.',
      table: {
        areaLabel: 'Avantage',
        columns: ['Gratuit', 'Supporter', 'Champion', 'Patron'],
        rows: [
          { area: 'Couleurs de nom', cells: ['—', 'Or', 'Préréglages ou une couleur à vous', 'Préréglages ou jusqu’à quatre couleurs, animées'] },
          { area: 'Étoile à côté de votre nom', cells: ['—', 'Oui', 'Oui', 'Oui'] },
          { area: 'GZ doré', cells: ['—', 'Oui', 'Oui', 'Oui'] },
          { area: 'Avatar et bannière perso, animés', cells: ['—', '—', 'Oui', 'Oui'] },
          { area: 'Vitrine', cells: ['—', '4 emplacements', '8 emplacements', '12 emplacements'] },
          { area: 'Événements entre amis (à la fois · joueurs)', cells: ['Rejoindre seulement', '1 · 10', '1 · 25', '2 · 50'] },
          { area: 'Défis en face-à-face', cells: ['1 actif', '5 actifs', 'Illimités', 'Illimités'] },
          { area: 'Chat d’événement : attente entre les lignes', cells: ['5 s', '3 s', '1 s', 'Aucune'] },
          { area: 'Boosts de clan', cells: ['—', '—', '1', '2'] },
        ],
      },
      outro:
        'Sous **Settings** → **In-game chat**, il y en a trois de plus : vos propres couleurs dans le fil du chat (Supporter), le choix de ce que couvre votre résumé de connexion (Champion), et une étoile à côté de votre nom dans le fil du chat des autres joueurs (Patron).',
    },

    names: {
      title: 'Couleurs de nom',
      intro:
        'Réglez-les sous **Settings** → **Supporter**, dans **Your name’s look**. L’aperçu montre votre nom sur un fond sombre et sur un fond clair.',
      rows: [
        {
          term: 'Supporter',
          body: 'or uni. Il n’y a rien à choisir.',
        },
        {
          term: 'Champion',
          body: 'l’un des dégradés prédéfinis (**Classic**, celui par défaut, **Ember**, **Ocean**, **Aurora**, **Rose gold** ou **Toxic**), ou **Your own** : une seule couleur fixe. Sur l’ensemble de vos personnages, vous pouvez utiliser au plus deux couleurs personnelles différentes.',
        },
        {
          term: 'Patron',
          body: 'tous les préréglages plus **Prism**, celui par défaut des Patrons, ou **Your own** avec une à quatre couleurs. Une couleur reste fixe ; deux à quatre forment un dégradé qui défile de gauche à droite.',
        },
      ],
      outro:
        '**Your Anvil display name** est le nom de votre compte relié à Discord. Sous **Your RuneScape characters**, choisissez **Same for all** ou **Customize each** pour donner à chaque personnage son propre style. Appuyez sur **Save** (ou **Save for all characters**) ; **Reset to default** revient aux couleurs de votre palier.',
      note: {
        tag: 'Fonds sombres et clairs',
        body: 'Le site, le panneau du plugin et Discord sont sombres ; la chatbox opaque du jeu est claire. Anvil ajuste vos couleurs pour qu’elles restent lisibles sur chacun. Si vous voulez un style différent sur l’un d’eux, activez **Set a separate look for dark backgrounds** ou **for light backgrounds**. Ce style s’affiche exactement comme vous l’avez choisi, sans correction de contraste, et l’aperçu vous prévient quand il est difficile à lire.',
      },
    },

    where: {
      title: 'Où apparaissent vos couleurs',
      intro: 'Vos couleurs et l’étoile vont partout où va votre nom :',
      rows: [
        {
          term: 'Sur le site',
          body: 'plateaux, listes de membres, profils, votre propre nom dans la barre du haut, et les noms de vos personnages. L’étoile porte vos couleurs.',
        },
        {
          term: 'Dans le panneau du plugin',
          body: 'le Feed, le chat d’événement, les cartes et la ligne **Tracking**. Le dégradé d’un Patron défile ; chaque joueur peut l’arrêter avec **Animated names**.',
        },
        {
          term: 'En jeu',
          body: 'pour les autres joueurs qui utilisent le plugin Anvil : chat public, de clan, d’amis et privé, annonces du clan, notifications de connexion, listes d’amis et de clan, et le menu du clic droit (jamais sur les mondes PvP ni dans le Wilderness). Dans le chat du jeu, l’étoile est réservée aux Patrons.',
        },
        {
          term: 'Sur Discord',
          body: 'une étoile à côté de votre nom sur les messages d’Anvil, dessinée dans vos propres couleurs si vous en avez choisi.',
        },
        {
          term: 'GZ doré',
          body: 'sur le drop d’un membre du clan dans le fil de votre clan sur le site, votre GZ peut être doré. Seuls les Supporters peuvent en donner un.',
        },
      ],
      note: {
        tag: 'Seulement sur les personnages prouvés comme les vôtres',
        body: 'Les couleurs n’apparaissent que sur les personnages dont le plugin a confirmé qu’ils sont à vous, sur le site et en jeu. Pour les retirer de vos noms dans le chat des autres joueurs, décochez **Show my colours on my characters’ names in game chat** sous Settings → Supporter.',
      },
    },

    profile: {
      title: 'Avatar, bannière et vitrine',
      intro: 'Les trois se trouvent sous **Settings** → **Profile look**.',
      rows: [
        {
          term: 'Avatar et bannière',
          body: 'Champion et Patron. Envoyez les vôtres ; un GIF ou un WebP reste animé. Ils apparaissent sur votre carte, votre profil et chacun de vos personnages, sur le site et dans le plugin. Une bannière peut faire jusqu’à 6 MB et au moins 600×150 ; un avatar jusqu’à 2 MB.',
        },
        {
          term: 'Par personnage',
          body: 'donnez à un personnage sa propre bannière ou son propre avatar, ou les deux. Cela remplace votre choix par défaut uniquement sur les pages et la carte du plugin de ce personnage.',
        },
        {
          term: 'Vitrine',
          body: 'vos meilleurs drops, kill counts et temps épinglés sur votre profil : 4 emplacements pour Supporter, 8 pour Champion, 12 pour Patron. Les épingles des personnages que vous ne partagez pas restent privées.',
        },
      ],
    },

    hosting: {
      title: 'Événements entre amis, face-à-face et chat',
      intro: 'Les avantages qui vous donnent plus de place pour jouer, plutôt qu’un style :',
      rows: [
        {
          term: 'Événements entre amis',
          body: 'organisez votre propre bingo, bingo solo ou course pour vos amis depuis **Host an event for your friends**, suivi par le plugin comme un événement de clan. Vos amis rejoignent avec votre lien d’invitation. Supporter : 1 événement en cours, 10 joueurs. Champion : 1 événement, 25 joueurs. Patron : 2 à la fois, 50 joueurs au total. Tout le monde peut en rejoindre un.',
        },
        {
          term: 'Face-à-face',
          body: 'défiez un ami depuis son profil : le premier à obtenir un drop, ou le plus de kills ou d’XP en 1 heure, 24 heures ou 7 jours. Pour la gloire uniquement. Les joueurs gratuits peuvent en avoir 1 ouvert à la fois, les Supporters 5, les Champions et les Patrons autant qu’ils veulent.',
        },
        {
          term: 'Chat d’événement',
          body: 'combien de temps vous attendez entre deux lignes : 5 secondes sans palier, 3 pour les Supporters, 1 pour les Champions, aucune pour les Patrons. Quand le chat d’un plateau s’emballe, tout le monde attend 10 secondes, Patrons compris.',
        },
        {
          term: 'Boosts de clan',
          body: 'Champion 1, Patron 2, tant que vous payez. Voir [Booster un clan]({boostsGuide}).',
        },
      ],
    },

    billing: {
      title: 'Payer, changer et résilier',
      intro: 'Anvil Supporter est facturé via Gumroad, au mois ou à l’année.',
      steps: [
        'Connectez-vous sur Anvil et ouvrez `/supporter`.',
        'Appuyez sur **Choose Supporter**, **Choose Champion** ou **Choose Patron**. Le paiement Gumroad s’ouvre, avec facturation mensuelle ou annuelle.',
        'Payez. Vos avantages s’activent dès que Gumroad prévient Anvil, et votre palier apparaît sur la page Supporter sous **Your tier**.',
      ],
      outro:
        'Pour changer de palier, utilisez **Change tier** sous Settings → Supporter. Pour résilier ou mettre à jour votre carte, utilisez **Manage on Gumroad** au même endroit. Un abonnement résilié garde tous ses avantages jusqu’à la fin de la période payée.',
      note: {
        tag: 'Commencez toujours par /supporter',
        body: 'Le bouton **Choose** porte un code qui indique à Anvil quel compte a payé. Anvil ne rapproche jamais un paiement par e-mail, donc acheter directement sur Gumroad, sans ce bouton, laisse le paiement non relié. Si cela vous est arrivé, demandez sur le Discord d’Anvil et le staff pourra le rattacher à votre compte à la main.',
      },
    },

    lapse: {
      title: 'Descendre de palier ou arrêter',
      intro:
        'Rien de ce que vous avez réglé n’est supprimé. Chaque avantage est vérifié par rapport au palier que vous avez à cet instant, donc il se désactive tout seul et revient dès que vous renouvelez.',
      rows: [
        {
          term: 'Couleurs de nom',
          body: 'votre choix reste enregistré. Vous portez les couleurs de votre nouveau palier, ou aucune, jusqu’au retour d’un palier qui le permet.',
        },
        {
          term: 'Avatar et bannière',
          body: 'en dessous de Champion, ils affichent leur première image, fixe, au lieu de bouger.',
        },
        {
          term: 'Vitrine',
          body: 'affiche les premières épingles que votre palier permet et masque le reste. Sans palier, elle est masquée ; les épingles vous attendent.',
        },
        {
          term: 'Boosts de clan',
          body: 'vos boosts les plus anciens continuent de compter et les autres sont mis en pause, pas retirés.',
        },
      ],
      note: {
        tag: 'Une amélioration temporaire offerte par le staff d’Anvil',
        body: 'Le staff peut donner à quelqu’un un palier supérieur pour un temps, par exemple pour le remercier. Elle s’ajoute à ce que vous payez et ne change jamais votre abonnement. Settings → Supporter affiche **A gift from Anvil** et sa date de fin ; ensuite, vous revenez à votre palier payé. Un cadeau ne donne d’emplacements de boost de clan que si le staff les inclut.',
      },
    },
  },

  sidePanel: {
    metaTitle: 'Le panneau latéral d’Anvil, onglet par onglet — Anvil',
    metaDescription:
      'Ce que montre chaque onglet du panneau latéral RuneLite d’Anvil (Clan, Feed, You, Lookup et la roue dentée), comment fonctionnent le chat d’événement et les réactions du Feed, et les réglages du plugin pour le fil dans le chat du jeu, les couleurs Supporter et les noms animés.',
    eyebrow: 'Anvil · pour les joueurs',
    title: 'Le panneau latéral, onglet par onglet',
    dek: 'Le bouton Anvil dans la barre latérale de RuneLite ouvre un panneau avec quatre onglets et une roue dentée : **Clan**, **Feed**, **You**, **Lookup** et ⚙. L’essentiel de ce qu’il affiche vient du site, donc il reste à jour sans mise à jour du plugin. Quelques éléments ci-dessous sont signalés comme arrivant avec la prochaine mise à jour du plugin.',
    facts: [
      { strong: 'Quatre onglets', rest: 'et une roue dentée pour la synchronisation et les réglages' },
      { strong: 'Chat d’événement', rest: 'dans l’onglet Feed' },
      { strong: 'GZ, Sad, Sit', rest: 'sur les lignes du Feed' },
    ],
    footnote:
      'L’installation du plugin et la connexion sont expliquées dans le [guide d’installation du plugin RuneLite]({pluginGuide}). Les couleurs Supporter, l’étoile et les avantages du chat sont expliqués dans [Anvil Supporter : paliers et avantages]({supporterGuide}).',

    header: {
      title: 'Le haut du panneau',
      intro: 'Au-dessus des onglets se trouvent le titre, **Refresh** et la ligne du compte.',
      rows: [
        {
          term: 'Refresh',
          body: 'recharge le panneau, onglet Feed compris. Il affiche **Refreshing…** pendant ce temps. Avec la prochaine mise à jour du plugin, il recharge aussi You et Lookup, pour qu’un nouvel avatar ou une nouvelle bannière s’affiche tout de suite, et il ne vide plus l’onglet Feed.',
        },
        {
          term: 'Tracking',
          body: 'la ligne sous le titre indique le personnage suivi, dans ses couleurs Supporter s’il en a. **Not my account…** arrête de suivre un personnage que quelqu’un d’autre joue sur cet ordinateur ; **Track again** l’annule.',
        },
        {
          term: 'Le menu du compte',
          body: 'le lien ⋯ ouvre **View my profile on Anvil**, **Not my account…** et **Sign out…**. Avec la prochaine mise à jour du plugin, il propose aussi **Become a Supporter**, ou **Your Supporter perks** si vous l’êtes déjà.',
        },
        {
          term: 'Progression de saison',
          body: 'avec la prochaine mise à jour du plugin, sur les mondes Leagues, Deadman et autres mondes saisonniers, une ligne affiche **Sharing season progress · Turn off**. Elle envoie vos reliques, zones et tâches (avec une capture d’écran) à votre clan ; votre clan choisit sur le site ce qui est publié. **Turn on** la partage à nouveau. Le même interrupteur est **Share seasonal activity** dans les réglages du plugin.',
        },
      ],
    },

    clan: {
      title: 'Clan',
      intro:
        'Vos événements et votre clan. Dans l’espace d’un créateur, l’onglet s’appelle **Space**.',
      rows: [
        {
          term: 'Le menu déroulant des clans',
          body:
            'affiché quand vous jouez dans plusieurs clans ou espaces. **All clans** (par défaut) affiche tout ce que vous jouez, l’événement en direct en premier. Choisir un clan restreint le panneau à celui-ci et y classe vos envois.',
        },
        {
          term: 'À faire ensuite',
          body:
            'une carte dorée en haut qui signale la chose la plus utile à faire maintenant, comme rejoindre un événement, répondre à un sondage ou faire votre premier relevé de départ.',
        },
        {
          term: 'Événements',
          body:
            'chaque tableau en direct ou à venir, Skill ou Boss of the Week et événement de clan, avec votre position. Puis **Your other boards**, **Also live** et **Your clan**.',
        },
        {
          term: 'Un tableau',
          body:
            'ouvrez-en un pour son classement (les trois premiers et vos propres lignes, avec **View all** pour le reste), ses équipes, ses missions, l’activité récente, les tiles les plus proches et **View all tiles**. Ses boutons **Feed** et **Chat** ouvrent ce tableau dans l’onglet Feed.',
        },
        {
          term: 'Mouvements de rang',
          body:
            'un **▲** vert ou un **▼** corail avec un nombre à côté d’un nom indique de combien il a bougé depuis le début de la journée.',
        },
        {
          term: 'Un événement de clan',
          body: '**I’m going**, **Sign me up** ou **Answer the survey**, selon l’événement.',
        },
      ],
    },

    feed: {
      title: 'Feed',
      intro:
        'Les grands moments de votre clan et de vos plateaux, en direct : drops, pets, succès, quêtes, morts et cases terminées.',
      rows: [
        {
          term: 'Quel flux',
          body:
            'le menu en haut liste **Clan ·** chaque clan dont vous êtes membre et **Event ·** chaque tableau en direct auquel vous participez. Il s’ouvre sur votre tableau si vous en avez un, sinon sur votre clan.',
        },
        {
          term: 'Filtres',
          body:
            '**All**, **Tiles** (tableaux uniquement), **Drops**, **Pets**, **Achievements**, **Deaths**, **Milestones** (slayer, clues, kill counts et similaires, une fois activés par les joueurs) et **My team** sur un tableau où vous êtes dans une équipe. Un flux de clan propose aussi un bouton d’activité de mode de jeu pour Leagues et les autres modes.',
        },
        {
          term: 'Nouvelles lignes',
          body:
            'arrivent toutes seules. Si vous avez défilé plus bas, une pastille **↑ N new** vous ramène vers elles.',
        },
      ],
      note: {
        tag: 'Pas la même chose que le fil dans le chat du jeu',
        body: 'L’onglet Feed fonctionne quels que soient vos réglages du plugin. **Show feed in game chat** (étape 8) est le réglage séparé qui l’affiche aussi dans votre chatbox.',
      },
    },

    reactions: {
      title: 'Réactions',
      intro: 'Chaque ligne du Feed a sa réaction en dessous :',
      rows: [
        {
          term: 'GZ',
          body: 'sur les drops, les pets et les succès. Le compteur s’affiche à côté, par exemple **GZ 3**.',
        },
        {
          term: 'Sad et Sit',
          body: 'sur les morts, à la place de GZ. Sit, c’est la façon du jeu de dire à quelqu’un qui est mort d’aller s’asseoir.',
        },
        {
          term: 'Qui peut réagir',
          body: 'sur le fil d’un clan, les membres du clan. Sur un plateau, ses joueurs et le staff de l’organisateur ; quand un plateau masque son classement, les joueurs ne peuvent réagir qu’aux lignes de leur propre équipe.',
        },
        {
          term: 'Qui a réagi',
          body: 'survolez une réaction pour voir les noms, par exemple « GZ · Mossy and 3 others ». Cliquez de nouveau dessus pour retirer la vôtre.',
        },
      ],
      note: {
        tag: 'Avec la prochaine mise à jour du plugin',
        body: 'Les réactions deviennent des boutons en pastille, teintés quand l’une est la vôtre, et les réactions des autres se mettent à jour en direct pour tous ceux qui regardent, y compris sur vos autres clients ouverts. Aujourd’hui, le compteur change quand vous réagissez ou quand le Feed se recharge. Le GZ doré, la réaction Supporter, se donne sur les fils du site ; l’onglet Feed a GZ, Sad et Sit.',
      },
    },

    chat: {
      title: 'Chat d’événement',
      intro:
        'Un plateau dont le chat est activé a un interrupteur **Feed / Chat** en haut de l’onglet Feed, pour les joueurs de ce plateau et le staff de l’organisateur. La page du plateau dans l’onglet Clan a aussi un bouton **Chat**.',
      rows: [
        {
          term: 'Tout le monde ou votre équipe',
          body:
            'choisissez un canal avec les puces en haut : **All teams** pour tout le tableau, **My team** pour votre équipe seule, et **Announcements**, où seuls l’hôte et les modérateurs peuvent écrire. Chaque puce affiche un compteur de lignes non lues. Les lignes de l’hôte et des modérateurs sont marquées **HOST** ou **MOD**.',
        },
        {
          term: 'Envoi',
          body:
            'tapez dans la zone et appuyez sur Entrée. Les lignes font jusqu’à 200 caractères, et seuls l’hôte et les modérateurs peuvent publier des liens.',
        },
        {
          term: 'Fréquence',
          body:
            'le délai entre vos lignes dépend de votre niveau de Supporter : 5 secondes sans, 3 pour les Supporters, 1 pour les Champions, aucun pour les Patrons. La ligne sous la zone indique le vôtre. Le staff n’attend jamais.',
        },
        {
          term: 'Mode lent',
          body:
            'quand le chat d’un tableau devient très actif, tout le monde attend au moins 10 secondes pendant une minute, Patrons compris. Personne ne peut envoyer plus de 10 lignes en 10 secondes.',
        },
        {
          term: 'Modération',
          body:
            'l’hôte et les modérateurs peuvent faire un clic droit sur une ligne pour **Delete message** ou **Mute** quelqu’un, et suspendre le chat avec **Pause chat**. Une pause empêche tout le monde sauf le staff d’écrire, sauf dans **Announcements**. **Mute** dans le panneau est un bannissement qui dure jusqu’à sa levée sur la page de modération. Là, vous pouvez aussi donner un timeout de 5 minutes, 1 heure ou 24 heures (ou n’importe quelle durée de 1 minute à 30 jours), qui ferme tous les canaux pour cette personne, et filtrer le chat par canal.',
        },
      ],
      outro:
        'Une suite de lignes d’une même personne partage un seul nom et une seule heure, jusqu’à un écart de 5 minutes. Le chat est conservé 7 jours après la fin de l’événement.',
    },

    you: {
      title: 'You et Lookup',
      intro: 'Deux onglets pour les cartes de joueur : la vôtre, et celle de n’importe qui d’autre.',
      rows: [
        {
          term: 'Vous',
          body:
            'votre propre carte pour le personnage connecté : bannière et avatar, **Display case**, et les onglets **Stats**, **Bosses** et **Log** (le collection log jusqu’aux objets de chaque page, ainsi que les clues, temps et combat achievements). En dessous, tout défi **Head-to-head** qui vous attend (**Accept** ou **Decline**) et vos **Goals**, avec **+ Add goal**.',
        },
        {
          term: 'Recherche',
          body:
            'basculez entre **Players** et **Clans**, tapez un nom et appuyez sur Entrée. **Recent** liste vos dernières recherches. Faites un clic droit sur quelqu’un en jeu et choisissez **Anvil** pour arriver ici.',
        },
        {
          term: 'Comparer',
          body:
            'sur la carte de quelqu’un d’autre, **Compare with me** aligne vos deux profils compétence par compétence, boss par boss et page par page. La carte d’un clan a **Compare with my clan**.',
        },
      ],
    },

    gear: {
      title: 'L’onglet de la roue dentée',
      intro: 'La synchronisation et les réglages, plutôt que des choses à regarder :',
      rows: [
        {
          term: 'Sync profile',
          body: 'envoie votre collection log et vos meilleurs temps à Anvil.',
        },
        {
          term: 'Sync clan roster',
          body: 'admins du clan uniquement : envoie au site la liste des membres du clan en jeu. Si le plugin ne peut pas lire votre clan, il affiche plutôt **Join your clan channel to sync the roster**.',
        },
        {
          term: 'Sons de bannière',
          body: '**Add clip** pour le son que joue une bannière, **Copy folder path** pour les gérer, et **Add mission clip** pour les missions.',
        },
        {
          term: 'Become a Supporter',
          body: 'avec la prochaine mise à jour du plugin, un lien ★ en bas ouvre la page Supporter, ou affiche **Your Supporter perks** si vous l’êtes déjà.',
        },
      ],
    },

    settings: {
      title: 'Les réglages qui changent ce que vous voyez',
      intro:
        'Dans la configuration RuneLite d’Anvil, sous **Chat messages**. Tous sont activés au départ.',
      rows: [
        {
          term: 'Show feed in game chat',
          body: 'affiche aussi le fil dans votre chatbox, en direct : gros drops, pets et succès des plateaux dont l’organisateur l’a activé et des clans où vous êtes invité, la progression des cases de vos coéquipiers, et les cases terminées des autres équipes.',
        },
        {
          term: 'Supporter names in chat',
          body: 'les couleurs des Supporters (et l’étoile d’un Patron) dans le chat public, de clan, d’amis et privé, ainsi que dans votre liste d’amis et les listes de membres des canaux. La liste des noms est téléchargée depuis Anvil ; rien n’est envoyé sur les personnes que vous voyez.',
        },
        {
          term: 'Animated names',
          body: 'laisse défiler le dégradé d’un Patron dans le panneau, le Feed et le chat d’événement. Désactivé, il reste fixe. Avec la prochaine mise à jour du plugin, il couvre aussi les noms des clans boostés et les bannières animées du panneau.',
        },
        {
          term: 'Supporter names in menus',
          body: 'les couleurs des Supporters sur leur nom quand vous faites un clic droit sur eux, jamais sur les mondes PvP ni dans le Wilderness.',
        },
        {
          term: 'Over other plugins’ colours',
          body: 'activé, les couleurs d’un Supporter remplacent la couleur de nom définie par un autre plugin, comme Player Indicators. Désactivé, ces noms restent tels quels.',
        },
      ],
    },
  },

  clanBoosts: {
    metaTitle: 'Booster un clan — Anvil',
    metaDescription:
      'Comment fonctionnent les boosts de clan d’Anvil : qui en a, placer et déplacer un boost, les trois niveaux de boost et ce que chacun débloque, les couleurs du nom du clan, les boosts offerts, et les marques et badges des boosters.',
    eyebrow: 'Anvil · pour les Supporters et l’équipe du clan',
    title: 'Booster un clan',
    dek: 'Un Champion ou un Patron payant peut placer un boost sur un clan dont il est membre. Assez de boosts venant des membres d’un clan le font monter d’un niveau, et chaque niveau change l’apparence du clan et l’endroit où il est listé. Les boosts sont purement esthétiques : ils ne changent jamais un rang, un score, une place ni la formule du clan.',
    facts: [
      { strong: 'Champion 1, Patron 2', rest: 'boosts tant que vous payez' },
      { strong: 'Niveaux à 3, 8 et 15', rest: 'boosts comptés' },
      { strong: 'Une fois par semaine', rest: 'un boost peut être déplacé' },
    ],
    footnote:
      'Les membres placent leurs boosts sous **Settings** → **Clan boosts**. Le staff du clan voit le niveau et ses options sous Admin → **Clan settings** → **Boosts**. Pour les paliers eux-mêmes, voir [Anvil Supporter : paliers et avantages]({supporterGuide}).',

    what: {
      title: 'Qui a des boosts',
      intro: 'Les boosts viennent avec un abonnement payant :',
      rows: [
        { term: 'Champion', body: '1 boost.' },
        { term: 'Patron', body: '2 boosts.' },
        {
          term: 'Supporter',
          body: 'aucun. Le temps gagné grâce aux invitations non plus. Une amélioration temporaire offerte par le staff d’Anvil ne donne des emplacements que si le staff les inclut.',
        },
      ],
      outro:
        'Les boosts vous appartiennent, pas à un personnage : trois personnages dans trois clans partagent toujours un seul lot. **Settings** → **Clan boosts** n’apparaît dans vos réglages que tant que vous êtes Supporter ou qu’il vous reste un boost placé.',
    },

    place: {
      title: 'Placer et déplacer un boost',
      intro: 'Vous placez vos propres boosts ; personne ne peut en placer un pour vous.',
      steps: [
        'Ouvrez **Settings** → **Clan boosts**. **Your boosts** liste ce que vous avez placé et tout **Free slot**.',
        'Sous **Clans you can boost**, appuyez sur **Boost** à côté d’un clan. Vous pouvez aussi appuyer sur **Boost this clan** dans la section Boosters de la page du clan elle-même.',
        'Pour en déplacer un, utilisez **Move to…** sur sa ligne et choisissez un autre clan. **Remove** le retire.',
      ],
      rows: [
        {
          term: 'Une place de membre vieille de 14 jours',
          body: 'chaque boost repose sur une place de membre qu’un de vos personnages occupe dans le clan en jeu. Une place d’invité ne peut pas en porter. L’ancienneté de la place compte à partir de la date la plus ancienne : quand Anvil l’a vue pour la première fois, ou quand le jeu dit que le personnage a rejoint. D’ici là, la ligne du clan indique combien de jours il reste.',
        },
        {
          term: 'Une ligne par clan',
          body: 'la liste montre chaque clan une seule fois, et Anvil choisit le personnage sur lequel repose le boost : votre main si possible, sinon la place détenue depuis le plus longtemps. Le clan ne voit que ce personnage, jamais vos autres.',
        },
        {
          term: 'Une fois par semaine',
          body: 'un boost placé peut être déplacé 7 jours après l’avoir placé. L’emplacement d’un boost retiré se libère à la même date, donc retirer puis replacer n’est pas un raccourci. Si le personnage sur lequel il reposait a quitté le clan, vous pouvez le déplacer tout de suite.',
        },
      ],
      note: {
        tag: 'Ce que veulent dire les étiquettes',
        body: '**counting** : il compte pour le niveau du clan. **paused** : votre palier a maintenant moins d’emplacements que vous n’avez placé de boosts, donc vos boosts les plus anciens continuent de compter et les autres attendent. **seat gone** : le personnage sur lequel il reposait n’est plus membre là-bas ; déplacez-le. **over the 2-per-person cap** : le clan compte déjà deux des vôtres.',
      },
    },

    levels: {
      title: 'Niveaux',
      intro:
        'Le niveau d’un clan vient de ses boosts comptés. Au plus deux boosts d’une même personne comptent pour un clan, donc un niveau veut toujours dire que plusieurs membres l’ont choisi.',
      rows: [
        { term: 'Niveau 1', body: '3 boosts comptés.' },
        { term: 'Niveau 2', body: '8 boosts comptés.' },
        { term: 'Niveau 3', body: '15 boosts comptés.' },
      ],
      outro:
        'Les membres voient la progression sur la page du clan, par exemple « 5 of 8 to Level 2 ». Un clan qui monte reçoit le nouveau niveau immédiatement.',
      note: {
        tag: 'Une semaine de grâce',
        body: 'Quand les boosts passent sous un niveau, le clan garde les avantages de ce niveau pendant 7 jours. Admin → Clan settings → Boosts indique quand ils prennent fin. Si les membres le reboostent à temps, rien ne change.',
      },
    },

    perks: {
      title: 'Ce que débloque chaque niveau',
      intro: 'Chaque niveau garde tout ce qu’offre celui du dessous.',
      rows: [
        {
          term: 'Niveau 1',
          body: 'un badge **Boosted** sur la page du clan, sur sa carte du Clan Hall et dans la recherche ; une place au-dessus des clans non boostés dans le Clan Hall et ses résultats de recherche ; et le nom du clan en dégradé.',
        },
        {
          term: 'Niveau 2',
          body: 'une place dans la rangée **Featured** du Clan Hall ; la bannière animée du clan est jouée (en dessous du niveau 2, elle affiche son image fixe) ; une ligne de recrutement pour les visiteurs ; et le dégradé du nom bouge.',
        },
        {
          term: 'Niveau 3',
          body: 'le **Spotlight** tout en haut du Clan Hall, et une annonce de recrutement par mois sur le Discord d’Anvil, écrite par le clan.',
        },
      ],
      note: {
        tag: 'Le logo du clan n’est pas un avantage',
        body: 'Un logo animé (une image de clan en GIF ou WebP) est joué à n’importe quel niveau. Seule la bannière attend le niveau 2.',
      },
    },

    colours: {
      title: 'Les couleurs du nom du clan',
      intro:
        'Dès le niveau 1, le nom du clan porte le dégradé d’Anvil. Les propriétaires et les admins peuvent choisir le leur sous Admin → **Clan settings** → **Boosts** → **Clan name colours** :',
      rows: [
        {
          term: 'Une à quatre couleurs',
          body: 'une couleur donne un nom fixe ; deux à quatre forment un dégradé. Dès le niveau 2, un dégradé bouge.',
        },
        {
          term: 'Fonds sombres et clairs',
          body: 'comme pour les noms Supporter, Anvil ajuste les couleurs pour qu’elles restent lisibles sur les fonds sombres (le site, le panneau du plugin, Discord) et clairs (la chatbox opaque du jeu). Activez un style séparé pour l’un ou l’autre et il s’affiche exactement comme choisi.',
        },
        {
          term: 'Reset to Anvil',
          body: 'revient à la palette d’Anvil.',
        },
      ],
      outro:
        'Les couleurs restent enregistrées si le clan passe sous le niveau 1, et reviennent quand il y remonte. Le plugin prend en compte un changement à son prochain rafraîchissement.',
    },

    staff: {
      title: 'Pour le staff du clan',
      intro:
        'Admin → **Clan settings** → **Boosts** est réservé aux propriétaires et aux admins. Le staff ne peut pas placer de boosts pour les membres ; les membres placent les leurs.',
      rows: [
        {
          term: 'Le niveau',
          body: 'le niveau du clan, combien de boosts comptent, combien il en manque pour le niveau suivant, et toute semaine de grâce en cours.',
        },
        {
          term: 'Ligne de recrutement',
          body: 'niveau 2. Une phrase, jusqu’à 140 caractères, montrée aux personnes qui ne sont pas dans le clan sur la page de votre clan et sa carte du Clan Hall.',
        },
        {
          term: 'Annonce de recrutement sur le Discord d’Anvil',
          body: 'niveau 3. Une fois par mois civil, de 20 à 500 caractères, écrite par vous et publiée quand vous appuyez sur **Post it**, avec un lien vers la page de votre clan. Les mentions sont retirées et personne n’est notifié. Vous ne pouvez ni la modifier ni en envoyer une autre avant le mois suivant.',
        },
        {
          term: 'Boosters',
          body: 'la liste des personnages qui boostent le clan.',
        },
      ],
      note: {
        tag: 'Boosts offerts par Anvil',
        body: 'Le staff d’Anvil peut offrir un niveau à un clan, pour une durée donnée ou sans fin. Le cadeau n’ajoute que les boosts qui manquent au clan pour atteindre ce niveau, affichés comme **Anvil gift** dans la liste Boosters du clan. Chaque vrai boost d’un membre remplace un boost offert, et un clan déjà au-dessus du niveau offert garde le sien. Quand le cadeau prend fin, le clan retombe au niveau que lui donnent les boosts de ses membres.',
      },
    },

    boosters: {
      title: 'Marques et badges des boosters',
      intro: 'Ce qu’un booster reçoit dans le clan qu’il booste :',
      rows: [
        {
          term: 'La marque Booster',
          body: 'une petite gemme à côté de son personnage dans la liste des membres, le fil et les messages Discord de ce clan. Survolez-la pour voir « Boosts this clan ».',
        },
        {
          term: 'Le mur des Boosters',
          body: 'sur la page du clan : une ligne par personnage, le plus de boosts d’abord, puis les plus anciens.',
        },
        {
          term: 'Badges',
          body: '**First booster** pour celui qui a placé le tout premier boost du clan ; **1 month**, **3 months**, **6 months** et **1 year** de boost sans interruption ; et **Level-up 1**, **2** ou **3** pour le boost qui a fait monter le clan à ce niveau.',
        },
      ],
      note: {
        tag: 'Déplacer relance le compteur',
        body: 'Les badges de durée comptent à partir du plus ancien boost du personnage qui compte encore, donc déplacer ou retirer un boost les fait repartir de zéro. Votre profil liste les clans que vous boostez, une fois par clan.',
      },
    },
  },

  profile: {
    metaTitle: 'Ton profil, Wrapped et Comparer — Anvil',
    metaDescription: 'Les pages qu’Anvil tient sur toi : ton profil, la page publique de chaque personnage, ta page personnelle, les Wrapped mensuels et annuels, les cartes Wrapped d’événement, et la comparaison de deux personnages côte à côte.',
    eyebrow: 'Anvil · pour les joueurs',
    title: 'Ton profil, Wrapped et Comparer',
    dek: 'Anvil tient une page pour **toi** et une page pour **chaque personnage** que tu joues. Voici ce qu’elles contiennent, qui peut les ouvrir, et les cartes Wrapped qui sortent à la fin de chaque mois et de chaque événement.',
    facts: [
      {
        strong: 'Partagé par défaut',
        rest: 'rends n’importe quel personnage privé d’un seul bouton',
      },
      {
        strong: 'Wrapped mensuel',
        rest: 'disponible le 1er du mois suivant',
      },
      {
        strong: 'Wrapped d’événement',
        rest: 'disponible à la fin de l’événement',
      },
    ],
    footnote: 'Chaque réglage mentionné ici est expliqué à l’endroit où il se trouve dans [Réglages, page par page]({settingsGuide}).',
    pages: {
      title: 'Tes pages',
      intro: 'Quatre pages, chacune répond à une question différente :',
      rows: [
        {
          term: 'Ton profil',
          body: '[/profile](/profile), que toi seul vois. Choisis un personnage parmi les puces en haut pour voir ses niveaux, ses boss, son journal de collection et ses événements. Les capitaines reçoivent aussi un **Captain’s deck** ici.',
        },
        {
          term: 'La page d’un personnage',
          body: '`/p/<name>` : un personnage, lisible par quiconque a le lien tant qu’il est partagé. Elle affiche les compétences, les boss, le journal de collection et les meilleurs temps, et laisse volontairement de côté tes classements de clan, ton historique d’événements et ton nom Discord.',
        },
        {
          term: 'Ta page personnelle',
          body: '`/u/…` : tous tes personnages partagés sur une seule page, avec ton display case et les comptes de streaming que tu as choisi de montrer. Elle n’existe que si tu actives **Show that my characters are one person**.',
        },
        {
          term: 'La page membre d’un clan',
          body: '`/c/<clan>/members/<name>` : le même personnage tel qu’un clan le voit, accessible depuis la liste **Members** de ce clan. Un clan privé ne montre ses membres qu’à ses propres membres.',
        },
      ],
    },
    sharing: {
      title: 'Qui peut voir quoi',
      body: [
        'Chaque personnage commence **shared** : sa page s’ouvre pour quiconque a le lien, et il peut apparaître dans les classements et chez les autres clans. Désactive-le sous **Who sees my characters** dans les Réglages, et sa page répond _not found_ à tout le monde sauf à toi. Tu vois **Private — only you can see this page.** avec un lien **Share it →**.',
        'Une page partagée a **Copy link** sous le nom. Les visiteurs connectés qui jugent une page abusive peuvent appuyer sur **Report this profile**.',
        'Pour chaque personnage, les Réglages permettent aussi de masquer le clan en jeu auquel il appartient (**Show my in-game clan**), pour qu’il disparaisse de la page de ce personnage et de la page Anvil de ce clan.',
      ],
    },
    wrapped: {
      title: 'Tes Wrapped mensuels et annuels',
      body: [
        'Chaque mois, chaque personnage reçoit une carte Wrapped : **XP gained**, **Boss kills**, **New slots** dans le journal de collection, heures **Efficient**, **PBs**, plus les pets et le plus gros drop. Elle sort le **1er du mois suivant** (UTC). Jusque-là, toi seul peux l’ouvrir, en aperçu.',
        'L’année en a une aussi, à `/p/<name>/wrapped/<year>`, à partir du **1er décembre**. `/p/<name>/wrapped` t’amène toujours à la plus récente disponible.',
        'Appuie sur **Copy link to your Wrapped** pour la partager. Collée sur Discord, elle s’affiche en image de la carte. Le Wrapped d’un personnage privé ne s’ouvre que pour toi, et son lien ne s’aperçoit que comme une simple carte Anvil.',
      ],
      note: {
        tag: 'Un mois vide',
        body: 'Si rien n’est parvenu à Anvil ce mois-là (ni XP, ni kills, ni cases du journal, ni PBs), la carte l’indique au lieu d’afficher des zéros. Joue avec le plugin, ou laisse les hiscores te rattraper, et le mois suivant se remplira.',
      },
    },
    events: {
      title: 'Wrapped d’événement',
      body: [
        'Quand un tableau se termine, chaque joueur et chaque équipe reçoit une carte. Ouvre la page **Wrapped** de l’événement : **Your card** est en haut, puis **Teams** (rang, score et joueurs) et **Players**. Appuie sur **Open and share your card**, puis sur **Copy share link**.',
        'Avant la fin, tu vois **Cards aren’t out yet**. Le staff peut ouvrir un aperçu en avance, pour vérifier les cartes avant que les joueurs ne les voient.',
        'Les images des cartes ne s’affichent que pour un événement d’un clan public qui n’était pas sur invitation. Pour tout autre événement, le lien fonctionne toujours pour les personnes qui peuvent voir cet événement, et s’aperçoit comme une simple carte Anvil.',
      ],
    },
    compare: {
      title: 'Comparer deux personnages',
      body: [
        'Ouvre [Compare](/compare) et saisis deux noms. Tu obtiens les compétences, les boss et les pages du journal de collection côte à côte. Celui qui mène sur chaque compte est affiché en or. En dessous, il y a une analyse, l’XP par compétence, chaque boss tué par l’un ou l’autre, et chaque objet du journal, un par un : vous l’avez tous les deux, aucun des deux, ou seulement l’un de vous. **Swap sides** les inverse.',
        'Seuls les personnages partagés peuvent être comparés. Un personnage privé, ou un nom qu’Anvil ne connaît pas, renvoie _not on Anvil, or not shared_. Tu peux toujours comparer tes propres personnages privés quand tu es connecté.',
      ],
    },
    news: {
      title: 'Nouveautés et changelog',
      body: [
        '[Nouveautés](/whats-new) montre ce qui a changé sur Anvil, du plus récent au plus ancien. Quand vous êtes connecté, il commence par **For you**, les actus qui comptent pour votre niveau et votre clan, puis **Everything new**. Les éléments nécessitant une mise à jour du plugin indiquent **Coming in the next plugin update**.',
        'Le [changelog](/changelog) liste chaque version avec ses actus, ses temps forts et ce qui est **New**, **Improved** et **Fixed**.',
        'À chaque sortie, ses actus sont publiées sur le Discord d’Anvil et dans les mises à jour Anvil de votre clan, et le plugin affiche une ligne à votre connexion. Les petites corrections sont regroupées dans le post suivant.',
      ],
    },
  },
  settings: {
    metaTitle: 'Réglages, page par page — Anvil',
    metaDescription: 'Chaque page des Réglages Anvil : publications Discord et confidentialité des captures d’écran, fil de chat en jeu, connexion du plugin et appareils, tes propres webhooks, qui voit tes personnages, look Supporter et profil, comptes de streaming, chaque personnage, et demandes de propriété.',
    eyebrow: 'Anvil · pour les joueurs',
    title: 'Réglages, page par page',
    dek: '[Settings](/settings) est l’endroit où vivent tes propres choix : ce que tu publies, ce que tu vois en jeu, qui peut voir tes personnages. Les choix faits ici te suivent sur chaque ordinateur où tu joues.',
    facts: [
      {
        strong: 'Zone de recherche',
        rest: 'sur la première page, trouve n’importe quel réglage',
      },
      {
        strong: 'Une page par personnage',
        rest: 'sous Characters',
      },
      {
        strong: '10 webhooks',
        rest: 'à toi',
      },
    ],
    footnote: 'Tes pages de profil sont expliquées dans [Ton profil, Wrapped et Comparer]({profileGuide}) ; les réglages du plugin lui-même dans [Configuration du plugin RuneLite]({pluginGuide}).',
    find: {
      title: 'Trouver un réglage',
      body: [
        'La première page, **Overview & search**, a une zone de recherche. Tape ce que tu veux avec tes propres mots, comme _private messages_, _rare drop value_, _death message_, _name colour_ ou _plugin token_, et elle t’amène au bon interrupteur.',
        'Le menu sur le côté a deux groupes. **Account** contient les pages ci-dessous. **Characters** a une page par personnage que tu as lié (ton principal est marqué **main**), puis **Add character**. Un chiffre sur **Add character** signifie qu’Anvil t’a vu jouer des personnages que tu n’as pas encore liés.',
      ],
    },
    posts: {
      title: 'Publications Discord et captures d’écran',
      intro: 'Ce que le plugin publie à ton sujet sur les canaux Discord de tes clans, et ce qu’il masque dans les captures d’écran. Ces choix sont lus par la prochaine mise à jour du plugin. Jusque-là, les mêmes interrupteurs dans les réglages du plugin décident.',
      rows: [
        {
          term: 'Ce que ton plugin publie',
          body: '**Rare drops**, **Pets**, **Deaths**, **Collection log slots**, **Level milestones** et **Diary completions** sont activés au départ ; **PvP kills** est désactivé.',
        },
        {
          term: 'Les chiffres',
          body: '**Min drop value** (1m au départ, au moins 1m, 0 désactive), **Min drop rarity (1 in N)** (1 sur 1,000 au départ), **Valeur et rareté ensemble** (l’un ou l’autre au départ, ou exiger les deux), **Loot key value** (1m), un **Death message** de 200 caractères maximum où `{name}` devient votre nom, et le plus bas **Combat task tier** et **Quest tier** publiés (Master au départ). La valeur, la rareté et le choix un/les deux suivent les valeurs par défaut de votre clan tant que vous n’en définissez pas vous-même ; **Revenir au défaut du clan** vous remet à les suivre.',
        },
        {
          term: 'Où vont tes publications',
          body: '**Keep my announcements out of clans I only guest in**, et **Level posts in clan channels** : **Clan rules**, **Only 99s & max** ou **Off**. **Per character** liste chaque personnage avec un lien **Clans →** pour désactiver les publications pour un seul clan.',
        },
        {
          term: 'Captures d’écran par type',
          body: 'choisissez pour chaque type (**Rare drops**, **Pets**, **Deaths**, **Collection log**, **Combat tasks**, **Achievement diaries**, **Levels**, **Player kills**) si sa publication contient une capture. Tous sont activés au départ. Votre clan peut définir une valeur par défaut pour ses membres ; tant que vous n’en modifiez pas une, vous la suivez, et **Reset** revient à celle-ci. Les preuves de bingo sont toujours capturées, quel que soit votre choix : ce sont vos preuves.',
        },
        {
          term: 'Plus à annoncer',
          body: '**Slayer** (toutes les N tâches), **Clue scrolls** (à partir du palier choisi), **Speedruns** (meilleurs temps personnels uniquement, ou à chaque fois), **Kill count** (toutes les N victoires), **BA gambles** (toutes les N tentatives) et **Custom chat messages** (messages de jeu correspondant à vos propres motifs, où `*` représente n’importe quel texte et `#` n’importe quel nombre ; jusqu’à 10). Tous sont désactivés au départ. Votre clan peut les activer par défaut pour ses membres, et vous pouvez en activer ou désactiver chacun pour vous-même ; **Reset to clan default** revient à suivre votre clan. Ils sont publiés dans le canal **Milestones & more** de votre clan et dans vos propres webhooks qui les acceptent ; vos motifs personnels ne sont publiés que dans vos propres webhooks.',
        },
        {
          term: 'Privé : Grand Exchange, échanges, stockage de groupe, autres plugins',
          body: '**Grand Exchange** (offres terminées d’une valeur au moins égale au montant que vous avez défini), **Player trades** (ce que vous avez donné et reçu), **Group storage** (ce que vous avez déposé ou retiré) et **Other plugins** (les plugins RuneLite que vous nommez peuvent publier via Anvil). Ils sont désactivés au départ, vous seul pouvez les activer, votre clan ne peut jamais les activer pour vous, et ils ne publient que dans vos propres webhooks : cochez le type sur le webhook où vous voulez le recevoir.',
        },
        {
          term: 'Modèles de messages',
          body: 'modifie la première ligne de n’importe quel message : **Loot**, **Pet**, **Collection log**, **Combat tasks**, **Achievement diary**, **Quests**, **Levels**, **Death**, **Player kills**, **Slayer**, **Clue scrolls**, **Speedruns**, **Kill count**, **BA gambles** et, pour vous seul, **Grand Exchange**, **Player trades** et **Group storage**. Cliquez sur un espace réservé comme `{player}` ou `{item}` pour l’ajouter ; l’aperçu remplit des valeurs d’exemple. Chaque type a ses propres espaces réservés, et tout le reste entre accolades reste tel que vous l’avez tapé. 200 caractères maximum ; les mentions et les liens ne sont jamais publiés. Sans modification, un message reste comme il l’a toujours été ; votre clan peut en définir un autre, et **Reset to clan default** y revient.',
        },
        {
          term: 'Confidentialité des captures d’écran',
          body: 'coche le chat qui est retiré de chaque capture d’écran prise par le plugin, preuves et publications Discord comprises : **Private messages** (coché au départ), **Public chat**, **Clan chat: others’ messages**, **Clan chat: your own messages**, **Chat channel** et **Group chat**. Les messages du jeu et les lignes d’Anvil restent toujours.',
        },
      ],
      note: {
        tag: 'Les cases de tableau ne sont jamais touchées',
        body: 'Désactiver une publication n’arrête que la publication Discord. Les drops, kills et succès comptent toujours sur tout tableau auquel tu participes.',
      },
    },
    chat: {
      title: 'Fil de chat en jeu',
      intro: 'Ce que le plugin affiche dans ta zone de chat quand le réglage du plugin **Show feed in game chat** est activé.',
      rows: [
        {
          term: 'D’où',
          body: '**Boards I play on**, et **Clans I’m guesting in, and my clan’s guests**.',
        },
        {
          term: 'Quoi',
          body: 'les drops d’une valeur minimale que tu choisis, **Pets**, **New collection log slots**, **Other teams’ completed tiles**, **My team’s progress on item tiles**, **Leagues, Deadman and other game-mode unlocks**, ainsi que les succès de combat, niveaux, quêtes et journaux.',
        },
        {
          term: 'À ta connexion',
          body: '**A short brief in chat** : ce qui s’est passé pendant ton absence. Les Champions choisissent ce qu’il couvre.',
        },
        {
          term: 'Couleurs',
          body: '**Anvil lines in chat** : **By type (Anvil colours)**, **One colour (the plugin’s own)**, ou **My own colours** pour les Supporters.',
        },
      ],
    },
    login: {
      title: 'Connexion du plugin, connexion et appareils',
      intro: 'Où le plugin et le site sont connectés, et comment les déconnecter.',
      rows: [
        {
          term: 'Connexion du plugin',
          body: 'ton jeton de plugin, pour le cas rare où tu le colles à la main. Normalement, **Sign in with Discord** dans le panneau latéral fait ça pour toi.',
        },
        {
          term: 'Connexion et appareils',
          body: 'chaque ordinateur sur lequel le plugin est connecté, sous la forme **RuneLite sign-in 1**, **2**… avec la date de création et de dernière utilisation. **Revoke** déconnecte l’un d’eux, par exemple un ordinateur que tu as vendu. **Enter a code** relie un autre ordinateur. **Sessions** te déconnecte du site partout.',
        },
        {
          term: 'Facturation du clan',
          body: 'les propriétaires de clan obtiennent ici **Open portal →**, pour la facturation du clan.',
        },
      ],
    },
    webhooks: {
      title: 'Tes webhooks Discord',
      body: [
        'Vos posts peuvent aussi aller sur un serveur Discord à vous : un canal privé, un serveur d’amis, n’importe où vous pouvez créer un webhook. Collez le lien du webhook, cochez ce qu’il reçoit (**Rare drops**, **Pets**, **Deaths**, **Combat achievements**, **Levels & milestones**, **Quests**, **Achievement diaries**, **Collection log**, **PvP kills**), fixez éventuellement une valeur et une rareté minimales juste pour lui, et appuyez sur **Add webhook**. Sur un webhook qui reçoit **Rare drops**, vous pouvez modifier ces réglages plus tard et choisir **Value or rarity: my setting**, **either** ou **both**. Ce qui est laissé vide suit vos propres réglages, et un webhook peut être plus permissif que le seuil strict de votre clan.',
        'Vous pouvez en avoir jusqu’à 10. Seuls les liens de webhook Discord sont acceptés, et un lien enregistré s’affiche masqué, donc une capture de cette page ne le divulgue pas. **Level posts on my webhooks** définit vos propres règles de niveau pour eux, séparées de celles de votre clan.',
      ],
    },
    privacy: {
      title: 'Qui voit mes personnages',
      intro: 'Tes personnages sont partagés au départ. Trois interrupteurs changent cela :',
      rows: [
        {
          term: 'Show <name> publicly',
          body: 'un interrupteur par personnage. Activé (par défaut), sa page est **Public**. Désactivé, elle est **Only its clans** : ses clans la voient toujours dans leurs listes et événements, personne d’autre ne la voit, et elle quitte les classements.',
        },
        {
          term: 'Show that my characters are one person',
          body: 'avec deux personnages ou plus, cela crée ta page personnelle, qui regroupe tes personnages partagés. Désactivé, personne ne peut savoir qu’ils sont tous toi.',
        },
        {
          term: 'Show other clans’ boards',
          body: 'indique si la page d’accueil te liste les tableaux ouverts d’autres clans à consulter.',
        },
      ],
    },
    look: {
      title: 'Supporter, look du profil, streaming et boosts',
      intro: 'Ton apparence sur Anvil, et les comptes et avantages qui vont avec.',
      rows: [
        {
          term: 'Supporter et couleurs de nom',
          body: 'ton palier, tes avantages et ton lien d’invitation : amène des amis et gagne des mois gratuits. Les paliers sont expliqués dans [Anvil Supporter]({supporterGuide}).',
        },
        {
          term: 'Look du profil',
          body: 'avatar et bannière (animés à partir de Champion), différents par personnage si tu veux, et le **Display case** : 4, 8 ou 12 épingles selon le palier.',
        },
        {
          term: 'Comptes de streaming',
          body: '**Twitch**, **YouTube**, **Kick** et **Medal**. Chacun indique s’il est vérifié, avec un interrupteur pour l’afficher sur ton profil. Les comptes vérifiés sont ce qui te permet d’entrer dans les événements pour followers et abonnés.',
        },
        {
          term: 'Boosts de clan',
          body: 'affiché seulement quand tu peux booster : tes emplacements, où ils sont placés et les clans que tu peux booster. Voir [Booster un clan]({boostsGuide}).',
        },
      ],
    },
    characters: {
      title: 'Chaque personnage',
      intro: 'Sous **Characters**, chaque personnage a sa propre page : son type, s’il est vérifié, et des liens vers sa page publique et son profil complet.',
      rows: [
        {
          term: 'Visibilité',
          body: '**Show to other clans and on leaderboards**, et **Show my in-game clan**.',
        },
        {
          term: 'Clans',
          body: 'chaque clan et espace dont il fait partie, en tant que **member** ou **guest**, avec **Announce drops & achievements** par clan et **Leave**. Si Anvil l’a placé dans le mauvais clan, **Which clan is it really in?** prévient le staff.',
        },
        {
          term: 'Personnage',
          body: '**Make main**, demander un renommage après un changement de nom, ou **Remove** le personnage de ton compte. Ses résultats passés restent là où ils sont.',
        },
        {
          term: 'Ajouter un personnage',
          body: 'joue une fois un personnage avec le plugin connecté et il se lie tout seul. Sur mobile ou le client officiel, lie-le par son nom. **We noticed you playing** liste ceux qu’Anvil a vus ; **Not mine** en écarte un.',
        },
      ],
    },
    claims: {
      title: 'Demandes de propriété',
      body: [
        'Si un personnage est lié au compte Anvil de quelqu’un d’autre alors qu’il est vraiment le tien, appuie sur **This is my account** dans l’onglet **You** du panneau latéral du plugin. Tu prouves que tu le joues par un rapide contrôle d’XP, puis le détenteur actuel est prévenu. Tu ne découvres jamais qui il est, et il ne découvre jamais qui tu es.',
        'Tes demandes affichent **XP check**, **open**, puis la façon dont elles se sont terminées : **moved to you**, **with Anvil staff**, **withdrawn**, **check timed out** ou **closed**. **Withdraw** en annule une.',
        'Quand quelqu’un revendique l’un des tiens, cela apparaît sous **Claims on your characters** avec **Approve** ou **Object — it’s mine**. Un personnage non vérifié change de main après 7 jours, sauf si tu t’y opposes. Un personnage vérifié ne change de main que si tu l’approuves.',
      ],
    },
  },
  weekly: {
    metaTitle: 'Skill et Boss de la semaine — Anvil',
    metaDescription: 'Organiser un Skill of the Week, un Boss of the Week ou une course d’efficacité sur Anvil : en programmer un, le répéter et le faire tourner, les lignes de départ, ajouter et retirer des personnes, les prix, le terminer en avance, et ce que voient les joueurs.',
    eyebrow: 'Anvil · pour l’équipe des clans et les joueurs',
    title: 'Skill et Boss de la semaine',
    dek: 'Une compétition hebdomadaire est l’événement qui demande peu d’effort : pas de cases à écrire, pas d’équipes ni d’inscriptions. Tout le monde sur la liste est inscrit au départ, et le gagnant est celui qui gagne le plus avant la fin.',
    facts: [
      {
        strong: 'Pas de cases, pas d’équipes',
        rest: 'un seul classement',
      },
      {
        strong: 'Inscrits au départ',
        rest: 'toute la liste, automatiquement',
      },
      {
        strong: 'Jusqu’à 10 places primées',
        rest: 'payées depuis la caisse',
      },
    ],
    footnote: 'Les tableaux (bingo) sont dans [Organiser ton premier événement]({adminGuide}) ; les prix et la caisse dans [La caisse du clan]({cofferGuide}).',
    schedule: {
      title: 'En programmer un',
      intro: 'Cinq choix, et les valeurs par défaut conviennent à la plupart des clans :',
      steps: [
        'Ouvre **Schedule** dans le menu admin et appuie sur **+ Schedule event** (les modérateurs peuvent utiliser **Schedule a competition**).',
        'Choisis le type : **Skill of the Week** (XP gagnée), **Boss of the Week** (kills gagnés) ou **Efficiency race** (heures jouées ou heures de boss gagnés).',
        'Sous **What is measured**, choisis la compétence ou le boss. Pour le changer chaque semaine, ajoute-en d’autres sous **Then rotate through**. Laisse ce champ vide pour répéter la même.',
        'Choisis quand il **Runs** : **This weekend**, **One week**, ou tes propres dates. Il a toujours besoin d’une fin, car il compte les gains entre le début et la fin.',
        'Laisse **Repeat every week** activé et le suivant commence dès que celui-ci se termine, avec la même durée et les mêmes prix. Coche **Guests race too** si les invités de ton clan doivent aussi figurer au classement.',
      ],
      outro: 'Il n’y a rien d’autre à configurer. Les chiffres de départ viennent des hiscores au moment du lancement.',
    },
    counting: {
      title: 'Comment ça compte',
      body: [
        'Le gain de chaque joueur est sa stat actuelle moins sa stat au début de la compétition (sa **starting line**). Le gain le plus élevé gagne ; une égalité est listée par nom, et les prix peuvent être partagés entre les places à égalité.',
        'Les lignes de départ sont prises sur les hiscores. Ensuite, les mises à jour en direct du plugin tiennent le tableau à jour entre deux relevés des hiscores, donc les joueurs avec le plugin montent dans le classement au fil de leur jeu.',
        'Un chiffre qui baisse est ignoré, et un gain qui semble impossible est **flagged** pour le staff au lieu d’être compté ou coupé.',
      ],
      note: {
        tag: 'Joueurs : déconnectez-vous avant le départ',
        body: 'Les hiscores ne sauvegardent tes stats que lorsque tu te déconnectes. Si tu grindes jusqu’au départ sans te déconnecter, ta ligne de départ est prise avant ce grind, et le grind compte comme gain. Le staff le repère en général et corrige ta ligne de départ, mais déconnecte-toi une fois avant le départ.',
      },
    },
    manage: {
      title: 'Le faire tourner',
      intro: 'Ouvre la compétition depuis **Schedule** ou le tableau de bord. Elle a une page d’accueil et trois onglets :',
      rows: [
        {
          term: 'Accueil',
          body: 'le **Leaderboard** (top 25, avec le nombre de joueurs qui marquent des points), les gains **flagged**, les personnes qui ont **left the clan**, et les prix. Quand elle se termine, les gagnants et le **Final leaderboard**.',
        },
        {
          term: 'Lignes de départ',
          body: 'le **Started at**, le **Now** et le **Gained** de chaque joueur. Corrige une ligne de départ à la main quand un grind d’avant la compétition a été compté, et le classement suit. **Pull current stats** rafraîchit tout le monde ; **Reset baselines** repart de zéro pour tout le monde à partir de leurs hiscores actuels et efface tous les gains.',
        },
        {
          term: 'Participants',
          body: 'toute la liste est déjà inscrite. **Add someone** prend un nom par ligne, pour un invité ou un compte qui n’est pas encore dans la liste. Retirer un joueur retire son classement ; le rajouter lui donne une nouvelle ligne de départ. **Leave one each** nettoie une personne inscrite sur plusieurs personnages. Tu peux aussi retirer tous les invités d’un coup.',
        },
        {
          term: 'Réglages',
          body: 'le nom, les dates, **Repeat every week**, et **Status** (seulement pour débloquer une compétition bloquée ; elle avance toute seule). Les admins peuvent **Delete** la compétition, avec ses participants et ses classements.',
        },
      ],
    },
    prizes: {
      title: 'Prix et fin',
      body: [
        'Définis des prix pour jusqu’à 10 places, payés depuis la caisse du clan. Tu choisis si un joueur sans gain peut être payé et si les places à égalité partagent leurs prix. Le fonctionnement de l’argent est expliqué dans [La caisse du clan]({cofferGuide}).',
        'Elle se termine toute seule à l’heure que tu as fixée. **End now** l’arrête en avance : les gains ne comptent plus tout de suite, et les résultats sont publiés sur Discord, les prix réglés dans les 15 minutes.',
      ],
    },
    players: {
      title: 'Pour les joueurs',
      body: [
        'Tu n’as pas à t’inscrire. Si tu es dans la liste du clan au départ, tu y es. Retrouve-la sur la page **Events** de ton clan, dans l’onglet **Clan** du panneau latéral du plugin avec ta position, et sur Discord au début et à la fin.',
        'Chaque compétition a sa propre page avec le classement en direct et le déroulement de la course jour par jour. Un clan privé ne la montre qu’à ses propres membres.',
        'Jouer avec le plugin garde ton chiffre en direct. Sans lui, tu comptes quand même, simplement au rythme des hiscores.',
      ],
    },
    teamsLine: "Vous voulez des équipes, ou des clans qui s'affrontent, sur un skill ou un boss ? Réglez le **Format** lors de la planification. Voir [Compétitions par équipes]({teamCompsGuide}).",
  },
  teamComps: {
    "metaTitle": "Compétitions par équipes — Anvil",
    "metaDescription": "Lancez un Skill ou Boss of the Week en équipes ou clan contre clan sur Anvil : répartition des joueurs en équipes, invitation d'autres clans, calcul des totaux et moyennes, arrivées tardives et ce que voient les joueurs.",
    "eyebrow": "Anvil · pour le staff de clan et les joueurs",
    "title": "Compétitions par équipes",
    "dek": "Chaque compétition de skill ou de boss a un Format. Solo est la valeur par défaut et fonctionne comme avant. Choisissez Teams pour répartir votre clan en camps, ou Clan vs clan pour affronter d'autres clans sur le même skill ou boss.",
    "facts": [
      {
        "strong": "Trois formats",
        "rest": "Solo, Teams, Clan vs clan"
      },
      {
        "strong": "Les totaux décident",
        "rest": "avec une moyenne par joueur"
      },
      {
        "strong": "Un seul hôte modifie",
        "rest": "les clans partenaires suivent"
      }
    ],
    "footnote": "Les bases de Skill and Boss of the Week sont dans [Skill and Boss of the Week]({weeklyGuide}). Vous voulez que les clans s'affrontent sur des grilles de bingo ? Voir [Accueillir un clan visiteur]({clanVsClanGuide}).",
    "teams": {
      "title": "Configurer les équipes",
      "intro": "Les équipes répartissent votre propre clan en camps. Cela prend environ une minute :",
      "steps": [
        "Planifiez une compétition comme d'habitude. Réglez **Format** sur **Teams**.",
        "Saisissez les noms des équipes. Tous les inscrits sont répartis équitablement selon leur niveau actuel ou leur nombre de KC, pour que les camps partent à égalité.",
        "Laissez **Late joiners go into the smallest team** activé si des joueurs peuvent arriver après le début. Désactivez-le pour garder les équipes fixes.",
        "Pour modifier quoi que ce soit plus tard, ouvrez la compétition et choisissez **Teams** dans sa barre latérale d'admin. Vous pouvez alors :"
      ],
      "rows": [
        {
          "term": "Renommer et changer la couleur",
          "body": "donnez à chaque équipe un nom et une couleur que les joueurs reconnaîtront."
        },
        {
          "term": "Ajouter et supprimer des équipes",
          "body": "commencez avec deux et ajoutez-en une troisième, ou supprimez-en une devenue inutile."
        },
        {
          "term": "Déplacer un joueur",
          "body": "envoyez quelqu'un dans une autre équipe. Pratique pour des amis qui veulent jouer ensemble."
        },
        {
          "term": "Auto-balance",
          "body": "appuyez sur **Auto-balance by current level/KC** pour répartir à nouveau tout le monde équitablement."
        },
        {
          "term": "Arrivées tardives",
          "body": "activez ou désactivez l'option d'arrivée tardive. Activée, les nouveaux joueurs rejoignent la plus petite équipe."
        }
      ],
      "note": {
        "tag": "Pas d'équipe, pas de problème",
        "body": "Un joueur sans équipe compte toujours sur le tableau individuel. Il n'ajoute simplement à aucun total d'équipe."
      },
      "outro": "Une compétition récurrente reporte ses équipes à la semaine suivante et les rééquilibre."
    },
    "clans": {
      "title": "Configurer clan contre clan",
      "intro": "Clan vs clan permet à d'autres clans de rejoindre votre compétition, autant que vous le souhaitez. Vous êtes l'hôte, et les autres clans sont des partenaires.",
      "steps": [
        "En tant qu'admin ou plus dans le clan hôte, réglez **Format** sur **Clan vs clan**.",
        "Invitez les autres clans à partir de leur adresse. Faites-le sur le formulaire de création, ou plus tard sur la page **Clans** de la compétition.",
        "Le propriétaire ou l'admin du clan invité accepte ou refuse sur sa page **People** ou dans la liste **Events**. Un modérateur ne le peut pas. Personne de ce clan n'est inscrit tant qu'il n'a pas accepté.",
        "Une fois accepté, le clan choisit qui participe : **All members** de son roster, ou **Selected people** qu'il désigne. Il peut changer cela plus tard depuis la même carte.",
      ],
      "body": [
        "Le clan partenaire peut suivre le classement sur son propre site, à l'adresse `/c/<slug>/weekly/<id>`. Il est en lecture seule. Seul l'hôte modifie la compétition.",
        "Pour retirer un clan, supprimez-le sur la page **Clans**. Ses joueurs quittent le tableau.",
        "Une compétition récurrente envoie de nouvelles invitations chaque semaine, donc chaque clan doit à nouveau accepter.",
        "Vous recevez des invitations indésirables ? Choisissez **Decline & block this clan** sur l'invitation. Les invitations suivantes de ce clan sont refusées discrètement, et vous pouvez le débloquer dans **Settings → Blocked clans**.",
      ],
      "note": {
        "tag": "Partagez l'adresse",
        "body": "L'adresse d'un clan est le nom court dans son adresse web. Demandez-la à l'admin de l'autre clan avant de l'inviter."
      }
    },
    "scoring": {
      "title": "Calcul des points",
      "body": [
        "Le total d'une équipe ou d'un clan est la somme des gains de ses membres. Les gains sont comptés de la même façon que sur le tableau individuel.",
        "À côté de chaque total, vous voyez aussi une **moyenne par joueur**, pour qu'une équipe de 8 et une équipe de 12 restent comparables.",
        "En cas d'égalité, celui qui a atteint ce total en premier est classé devant."
      ]
    },
    "players": {
      "title": "Ce que voient les joueurs",
      "body": [
        "La page de la compétition affiche d'abord le classement des équipes ou des clans. Ouvrez-en un pour voir ses joueurs. Votre propre équipe ou clan est mis en évidence.",
        "Les messages Discord au départ, à mi-parcours et à la fin affichent le classement. En clan vs clan, ils partent sur le canal de chaque clan, et le vôtre est marqué **← you**.",
        "Dans le panneau latéral du plugin, vous voyez où se place votre équipe.",
        "Il n'y a aucune inscription à faire. Si votre clan inscrit tous ses membres et que vous êtes dans le roster, vous êtes dedans. S'il choisit des personnes, vous êtes dedans une fois choisi.",
        "Vous ne voulez pas participer ? Appuyez sur **Opt out** à côté de **You’re in**, sur la page de la compétition, dans la liste Events ou dans le plugin. Vous quittez le tableau pour cette seule compétition, et vous pouvez vous réinscrire pendant qu'elle tourne.",
      ]
    },
    "faq": {
      "title": "Questions",
      "intro": "Celles que le staff du clan et les joueurs posent le plus :",
      "rows": [
        { term: "Nos équipes ont des tailles différentes. Est-ce injuste ?", body: "Pas en soi. Ce sont les totaux qui déterminent le classement, mais chaque équipe affiche aussi une moyenne par joueur, pour que vous voyiez comment une petite équipe se débrouille vraiment." },
        { term: "Et les joueurs qui arrivent en retard ?", body: "Avec l'option d'arrivée tardive activée, ils rejoignent la plus petite équipe. Désactivée, ils ne comptent que sur le tableau individuel. Vous pouvez toujours les déplacer à la main sur la page **Teams**." },
        { term: "L'autre clan peut-il modifier notre compétition ?", body: "Non. Les clans partenaires voient le classement en lecture seule. Seul le clan hôte peut modifier la compétition." },
        { term: "Puis-je ne pas participer à une compétition ?", body: "Oui. Appuyez sur **Opt out** sur la page de la compétition, dans la liste Events ou dans le plugin. Seule cette compétition est concernée, et vous pouvez vous réinscrire pendant qu'elle est en cours." },
        { term: "Combien de clans peuvent concourir ?", body: "Autant que vous en invitez, jusqu'à 50 dans une même compétition. Chaque clan voit son propre côté marqué dans le classement et dans ses messages Discord." },
        { term: "Un autre clan ne cesse de nous inviter. Peut-on l'arrêter ?", body: "Oui. Un propriétaire ou un admin choisit **Decline & block this clan** sur l'invitation. Les invitations suivantes sont refusées sans les en informer. Vous pouvez le débloquer à tout moment dans **Settings → Blocked clans**." },
        { term: "Si nous acceptons une fois, sommes-nous inscrits chaque semaine ?", body: "Non. Une compétition récurrente envoie de nouvelles invitations chaque semaine, et un propriétaire ou un admin doit accepter chacune d'elles." },
      ]
    }
  },

  clanEvents: {
    metaTitle: 'Événements du clan et planning — Anvil',
    metaDescription: 'Organiser des événements de clan sur Anvil : masses, sorties et rencontres, répétitions hebdomadaires, « I’m going » et inscriptions avec places, questions et frais, publications et rappels Discord, versements, sondages, et le planning qui montre les trous.',
    eyebrow: 'Anvil · pour l’équipe des clans',
    title: 'Événements du clan et planning',
    dek: 'Tout n’est pas un tableau. Un événement de clan est une masse, une soirée raid, une fête de drops ou une rencontre : une heure et un lieu, publiés sur Discord et rappelés, avec autant ou aussi peu d’inscription que tu le souhaites.',
    facts: [
      {
        strong: 'Une fois ou chaque semaine',
        rest: 'avec une date de fin facultative',
      },
      {
        strong: 'Trois façons de rejoindre',
        rest: 'info, « I’m going » ou inscriptions',
      },
      {
        strong: 'Rappel',
        rest: '15 minutes avant, puis au départ',
      },
    ],
    footnote:
      'Les compétitions hebdomadaires sont dans [Skill and Boss of the Week]({weeklyGuide}) ; les frais et gains dans [Fees and payouts]({feesGuide}). Les posts de rappel utilisent les modèles de message de votre clan, expliqués dans [Settings, page by page]({settingsGuide}).',
    create: {
      title: 'En programmer un',
      intro: 'Ouvre **Clan events** dans le menu admin et remplis le formulaire :',
      rows: [
        {
          term: 'Nom, heure, durée',
          body: '**Name**, **Starts (your time)** dans ton propre fuseau horaire, et **Minutes**.',
        },
        {
          term: 'Répétitions',
          body: '**Just once** ou **Every week**, avec une date **Until** facultative.',
        },
        {
          term: 'Lieu',
          body: '**Where**, **World** et **Host**, plus une image : choisis un boss ou une compétence, ou envoie la tienne.',
        },
        {
          term: 'Détails',
          body: 'équipement, prérequis, ce qu’il faut apporter.',
        },
        {
          term: 'Qui vient',
          body: '**Just information** (ni bouton, ni compteur), **« I’m going »** (un clic, affiche un compteur) ou **Sign-ups** (places, questions et frais).',
        },
        {
          term: 'Discord',
          body: '**Post to** un canal (ou celui par défaut du clan), **Chat**, **Guide** et **Voice** facultatifs à relier, et s’il faut mentionner le rôle de membre dans l’annonce, le rappel et le départ.',
        },
      ],
      outro: 'Appuie sur **Schedule it**. Les versements et un sondage s’ajoutent ensuite depuis la page propre de l’événement.',
    },
    discord: {
      title: 'Ce que voit Discord',
      body: [
        'L’annonce est publiée quand tu la programmes et modifiée sur place à chaque changement, donc il n’y a jamais de copie périmée. Un événement répété est marqué **every week**.',
        'Quinze minutes avant, il publie **Starting in 15 minutes**, et au départ **Starting now**. Si tu déplaces l’heure, les rappels suivent. Annuler (**Cancel**) marque la publication **Cancelled**, pour que personne ne se présente.',
      ],
    },
    manage: {
      title: 'Inscriptions, frais et versements',
      intro: 'Ouvre l’événement pour changer ce qu’il utilise. Tout est désactivé au départ :',
      rows: [
        {
          term: 'Inscriptions',
          body: 'avec **Places** (vide pour aucune limite), quand **Sign-ups close**, et les **Sign-up questions**. **You approve each one** fait attendre chaque inscription l’approbation du staff.',
        },
        {
          term: 'Bouton « I’m going »',
          body: 'désactivé, il ne sert qu’à l’information : ni bouton ni compteur sur le site, dans le plugin ou sur Discord.',
        },
        {
          term: 'Frais d’entrée',
          body: 'active les inscriptions. Ajoute tes propres gp à la cagnotte sous **Added to the pot**.',
        },
        {
          term: 'Versements',
          body: 'la cagnotte correspond aux frais plus ce que tu as ajouté. Indique **Who** reçoit quoi et **For** quoi, et marque chacun comme **Paid**. Anvil te prévient si tu verses plus que la cagnotte.',
        },
        {
          term: 'Sondage après coup',
          body: 's’ouvre à la fin. Seul le staff voit les réponses. Si l’événement avait des inscriptions, seules les personnes inscrites sont interrogées.',
        },
        {
          term: 'Un événement hebdomadaire',
          body: '**Every week is…** **Its own** (inscriptions, cagnotte et sondage pour chaque semaine) ou **One run** (une seule inscription, cagnotte et sondage pour toute la série).',
        },
      ],
    },
    players: {
      title: 'Ce que voient les membres',
      body: [
        'La page de l’événement affiche **When**, **Where**, **Host**, **Discord**, **Entry** et **Prizes**, avec **Live now** pendant qu’il est en cours. Les membres appuient sur **I’m going** ou **Sign me up**, ou sur **Ask to sign up** quand le staff approuve chaque inscription. C’est aussi dans l’onglet **Clan** du panneau latéral du plugin, avec les mêmes boutons.',
        'Seuls les membres du clan peuvent dire qu’ils viennent ou s’inscrire.',
      ],
    },
    calendar: {
      title: 'Le planning',
      body: [
        '**Schedule** regroupe les tableaux, les compétitions hebdomadaires et les événements de clan dans un seul calendrier, avec un filtre pour chacun.',
        'Toute période d’au moins deux jours sans rien est marquée comme trou, avec **Fill the gap** pour y programmer quelque chose. Sers-t’en pour garder le clan occupé entre les grands événements, au lieu de laisser passer une quinzaine calme.',
      ],
    },
  },
  challenges: {
    metaTitle: 'Défis et événements entre amis — Anvil',
    metaDescription: 'Défis un contre un sur Anvil (premier à un drop, plus de kills ou plus d’XP en 1 heure, 24 heures ou 7 jours) et événements entre amis pour Supporters : tableaux privés pour tes amis derrière un seul lien d’invitation.',
    eyebrow: 'Anvil · pour les joueurs',
    title: 'Défis et événements entre amis',
    dek: 'Deux façons de jouer contre des gens que tu connais, sans événement de clan : un **défi** oppose un joueur à un autre, et un **événement entre amis** est un tableau privé pour un groupe, derrière un lien d’invitation.',
    facts: [
      {
        strong: '1 heure à 7 jours',
        rest: 'par défi',
      },
      {
        strong: 'Pour la gloire',
        rest: 'sans enjeu, sans gp',
      },
      {
        strong: 'Jusqu’à 50 amis',
        rest: 'par événement entre amis, selon le palier',
      },
    ],
    footnote: 'Les paliers et ce que chacun permet d’héberger sont dans [Anvil Supporter : paliers et avantages]({supporterGuide}).',
    start: {
      title: 'Défier quelqu’un',
      intro: 'Il te faut un personnage vérifié, et il en faut un aussi à ton adversaire.',
      steps: [
        'Ouvre [Challenges](/challenges), ou appuie sur **Challenge <name>** sur le profil d’un joueur.',
        'Sous **Who**, tape son nom, et sous **Playing as**, choisis ton propre personnage. Il doit être vérifié.',
        'Choisis la course : **First to a drop** (jusqu’à 5 objets, tous des drops de monstres), **Most kills** d’un boss, ou **Most XP** dans une compétence ou au total.',
        'Choisis la limite de temps : **1 hour**, **24 hours** ou **7 days**. Coche **OK to show the result publicly** si tu ne vois pas d’inconvénient à ce qu’il soit vu ; il n’est public que si vous cochez tous les deux.',
      ],
      outro: 'Il reçoit une notification et un message Discord, et il a 24 heures pour **Accept**, **Decline** ou **Decline and block**. Le chrono démarre quand il accepte.',
    },
    rules: {
      title: 'Comment ça se décide',
      intro: 'Anvil tranche tout seul, dans la minute qui suit la fin.',
      rows: [
        {
          term: 'Kills et XP',
          body: 'les deux lignes de départ sont prises à l’acceptation ; celui qui gagne le plus d’ici la fin l’emporte, et un gain égal est une égalité. Les hiscores et le plugin comptent tous deux, la valeur la plus haute l’emporte.',
        },
        {
          term: 'Premier à un drop',
          body: 'le premier d’entre vous à obtenir un des objets gagne, sur-le-champ. Les drops ne sont vus que par le plugin, donc vous devez l’avoir tous les deux en marche. Si personne n’en obtient dans le temps imparti : égalité.',
        },
        {
          term: 'Annuler',
          body: 'tu peux retirer ton propre défi tant qu’il n’a pas reçu de réponse. Une fois en cours, il ne s’arrête que si vous êtes tous les deux d’accord.',
        },
      ],
    },
    limits: {
      title: 'Limites et refus',
      body: [
        'Les défis ouverts (en attente ou en cours, envoyés ou reçus) sont limités par palier : **1** gratuit, **5** pour les Supporters, illimité pour les Champions et les Patrons. Chacun peut en lancer jusqu’à 20 par jour, et un seul à la fois avec la même personne.',
        'Tu n’en veux aucun ? **Turn away all new challenges**, ou bloque une personne quand tu refuses. La personne qui te défie voit le même refus dans les deux cas, donc elle ne peut pas savoir qu’elle a été bloquée.',
        'La page garde ton **Your record** (victoires, défaites et égalités), ce qui est **Open now** et ta **Your limit**.',
      ],
    },
    friends: {
      title: 'Héberger un événement entre amis',
      body: [
        'Tout Supporter, Champion ou Patron peut lancer un tableau privé pour ses amis depuis [Host](/host) → **Host for friends** → **New friends event**. C’est un tableau complet : bingo ou course de cases, suivi par le plugin, avec la même configuration que l’événement d’un créateur.',
        'Envoie le **Invite link** ; c’est la seule façon d’entrer. Tes amis l’ouvrent, se connectent avec Discord et appuient sur **Open the event**. Rejoindre est toujours gratuit. Si le lien fuite, crée-en un nouveau : l’ancien cesse de fonctionner, et ceux qui sont déjà dedans y restent.',
        'Un événement entre amis n’est jamais listé nulle part sur Anvil, et n’a pas besoin de clan.',
      ],
      table: {
        areaLabel: 'Palier',
        columns: [
          'Joueurs',
          'En cours simultanément',
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
        tag: 'Si ton palier prend fin',
        body: 'Les amis déjà présents restent. Les nouveaux amis ne peuvent pas rejoindre au-delà de ta nouvelle limite, et tu ne peux pas en lancer un autre tant que tu n’es pas repassé en dessous.',
      },
    },
  },
  clanHall: {
    metaTitle: 'Trouver des clans, des événements et des classements — Anvil',
    metaDescription: 'Trouver un clan OSRS sur la Clan Hall d’Anvil, comparer deux clans, les classements hebdomadaires de joueurs et de clans, la liste publique des événements, et les pages des clans en jeu qui ne sont pas sur Anvil.',
    eyebrow: 'Anvil · pour les joueurs et les clans',
    title: 'Trouver des clans, des événements et des classements',
    dek: 'Les pages publiques d’Anvil pour explorer : la **Clan Hall** pour trouver un clan, la liste **Events** pour trouver quoi rejoindre, et le **Leaderboard** pour voir qui gagne le plus.',
    facts: [
      {
        strong: 'Clan Hall',
        rest: 'clans publics uniquement',
      },
      {
        strong: 'Classement',
        rest: 'cette semaine, 30 jours, depuis toujours',
      },
      {
        strong: 'Événements',
        rest: 'seulement ceux que l’hôte a publiés',
      },
    ],
    footnote: 'Pour faire figurer ton propre clan dans la liste, voir [Créer un clan]({clanGuide}) ; les clans boostés sont mis en avant, voir [Booster un clan]({boostsGuide}).',
    hall: {
      title: 'La Clan Hall',
      body: [
        '[Clan Hall](/clans) liste tous les clans publics. Cherche par nom ou par slogan, puis affine avec **Taking members** ou **Open to challenges**. **Most active** (l’ordre d’ouverture) place en premier les clans dont les membres ont le plus gagné cette semaine ; **Biggest** trie par nombre de membres.',
        'Chaque carte indique si le clan **Recruiting**, et comment il accepte les invités : **Guests welcome**, **Guests by approval** ou **No guests**. Les clans boostés ont des rangées mises en avant en haut, et les créateurs ont une rangée à eux.',
      ],
      note: {
        tag: 'Pas listé ?',
        body: 'Seuls les clans réglés sur public apparaissent, et un clan peut désactiver sa liste dans ses réglages. Les clans privés ne figurent jamais dans la Clan Hall, le classement ou les comparaisons.',
      },
    },
    compare: {
      title: 'Comparer deux clans',
      body: [
        '[Compare clans](/compare/clans) met deux clans listés côte à côte. Pour comparer deux personnages à la place, utilise [Compare](/compare).',
      ],
    },
    board: {
      title: 'Le classement',
      body: [
        '[Leaderboard](/leaderboard) classe les joueurs et les clans par expérience, heures efficaces et boss, sur **This week**, **30 days** ou **All time**. Les joueurs peuvent être filtrés en comptes **Regular**, **Ironman**, **Hardcore**, **Ultimate** ou **Group**.',
        'Les clans sont classés selon l’XP gagnée par leurs membres. Seuls les clans vérifiés listés dans la Clan Hall apparaissent. Les gains d’un invité comptent pour son propre clan, pas pour celui qui l’accueille.',
      ],
    },
    events: {
      title: 'Trouver un événement à rejoindre',
      body: [
        '[Events](/events) liste ce qui est en cours et à venir sur Anvil. Filtre par **Live now**, **Open to join** ou **Starting this week**, par format ou **Solo**, par **Anyone can join** ou **Ask or meet a rule**, et par **Clans** ou **Creators**. **Join** t’amène à t’inscrire.',
        'Seuls les événements dont l’hôte a activé **Advertise on Anvil** apparaissent. Les événements réservés aux membres ou sur invitation n’apparaissent jamais.',
      ],
    },
    ghost: {
      title: 'Les clans en jeu qui ne sont pas sur Anvil',
      body: [
        'La page d’un personnage indique le clan en jeu auquel il appartient. Si ce clan n’est pas sur Anvil, le lien ouvre une page simple qui liste les joueurs Anvil qui en font partie et ont choisi de le montrer. Ce n’est pas la liste de membres de ce clan, et rien sur cette page ne fait de quelqu’un un membre.',
        'Si c’est ton clan, **Bring your clan to Anvil** en crée un. Une fois qu’il est un clan Anvil public, le lien y mène directement.',
      ],
    },
  },
  guideLibrary: {
    metaTitle: 'Guides en jeu : lecture, propositions et copies de clan — Anvil',
    metaDescription: 'La bibliothèque de guides d’Anvil : guides de raids, de boss, de skilling et de money-making sur le site, en jeu et sur Discord. Lecture par niveau, proposition d’un nouveau guide ou d’une modification, et comment un clan copie et modifie les guides de la bibliothèque.',
    eyebrow: 'Anvil · pour les joueurs et l’équipe des clans',
    title: 'Guides en jeu',
    dek: 'En plus de ces pages pratiques, Anvil tient une bibliothèque de guides de jeu : raids, boss, skilling et money makers. Tout le monde peut les lire, toute personne connectée peut en proposer un, et un clan peut garder ses propres copies.',
    facts: [
      {
        strong: 'Trois niveaux',
        rest: 'Beginner, Intermediate, Advanced',
      },
      {
        strong: 'Tout le monde peut proposer',
        rest: 'le staff examine chacun',
      },
      {
        strong: '/guide',
        rest: 'publie un guide sur Discord',
      },
    ],
    footnote: 'Les commandes slash sont dans [Commandes slash]({commandsGuide}).',
    read: {
      title: 'Lire un guide',
      body: [
        'Ouvre l’onglet **In-game guides** sur la page des guides, ou [/guides](/guides) sur le site de ton clan. La liste d’un clan contient ses propres guides, plus les guides de la bibliothèque qu’il n’a pas copiés.',
        'Beaucoup de guides ont un sélecteur de niveau en haut : **Beginner**, **Intermediate** et **Advanced**. Les parties pour les autres niveaux se replient, pour qu’un débutant et un speed-runner lisent la même page.',
        'Sur Discord, `/guide` et le début d’un nom publient la carte d’un guide avec un lien vers la page complète.',
      ],
    },
    propose: {
      title: 'Proposer un guide ou une modification',
      body: [
        'Une fois connecté, ouvre [Propose a guide](/guides/propose) pour en écrire un nouveau, ou proposer une modification d’un guide existant de la bibliothèque. Dis au relecteur ce que tu as changé et pourquoi ; tu peux afficher tes modifications face au guide actuel avant d’envoyer.',
        'Appuie sur **Send for review**. [My guide proposals](/guides/proposals) affiche chacun comme **pending**, **approved**, **rejected** ou **withdrawn**, avec la note du relecteur une fois la réponse donnée. Tant qu’il est en attente, tu peux le modifier ou le **Withdraw**. Tu peux en avoir 5 en attente à la fois.',
        'Rien n’est publié tant que les éditeurs de guides d’Anvil ne l’ont pas approuvé. Une modification approuvée met aussi à jour chaque copie de clan qui n’a pas été modifiée.',
      ],
    },
    clan: {
      title: 'Les guides de ton clan',
      intro: 'Les admins, et les modérateurs autorisés à écrire des guides, les gèrent sous **Guides** dans le menu admin.',
      rows: [
        {
          term: 'Afficher les guides de la bibliothèque sur notre site',
          body: 'activé : les guides de la bibliothèque que tu n’as pas copiés apparaissent aussi sur ta page Guides, toujours à jour.',
        },
        {
          term: 'Copier dans nos guides',
          body: 'crée une copie pour le clan. Elle **follows library** jusqu’à ce que tu la modifies, en reprenant chaque changement de la bibliothèque.',
        },
        {
          term: 'Modifier une copie',
          body: 'la rend **customised**, propre au clan. Quand le guide de la bibliothèque change plus tard, elle affiche **update available** : prends la nouvelle version ou garde la tienne.',
        },
        {
          term: 'Nouveau guide',
          body: 'en écrit un que seul ton clan possède, comme tes propres règles de raid ou un guide de masse.',
        },
      ],
      note: {
        tag: 'Les publier',
        body: 'Les guides peuvent être publiés sur un canal Discord, et ces publications sont modifiées sur place quand le guide change.',
      },
    },
  },
  luckRecords: {
    metaTitle: 'Taux de drop, chance et records — Anvil',
    metaDescription:
      'Ce que signifie la ligne de probabilité d’une case de drop, comment Anvil calcule la chance (spooned, dry ou on rate), ce que sont les heures efficaces et où sont gardés vos meilleurs jour, semaine, mois et année.',
    eyebrow: 'Anvil · pour les joueurs',
    title: 'Taux de drop, chance et records',
    dek:
      'Anvil peut vous dire à quel point un drop est rare, combien de temps il faut en général pour l’obtenir, et à quel point vous avez été chanceux. Il peut aussi garder en mémoire vos meilleurs jours. Cette page explique ces chiffres.',
    facts: [
      {
        strong: 'Taux',
        rest: 'viennent de l’OSRS Wiki',
      },
      {
        strong: 'Chance',
        rest: 'kills attendues par rapport à vos vraies kills',
      },
      {
        strong: 'Records',
        rest: 'incluent l’historique depuis que Anvil a commencé à vous suivre',
      },
    ],
    footnote:
      'Vos pages personnelles sont dans [Your profile, Wrapped and Compare]({profileGuide}). Les interrupteurs sont dans [Settings, page by page]({settingsGuide}).',
    odds: {
      title: 'Les probabilités sur une case de drop',
      intro:
        'Ouvrez une case de drop et vous voyez jusqu’à huit lignes, une par objet dont les probabilités sont connues. Une ligne ressemble à ceci :',
      body: [
        '`Item: 1 in 512 from Boss · ~512 kills ≈ 9.4 h at 55/h`',
        'Si l’objet peut être obtenu plusieurs fois par kill, il indique aussi **(×2 rolls)**. Si Anvil ne sait pas à quelle vitesse les joueurs tuent ce boss, la partie heures est omise.',
      ],
      rows: [
        {
          term: '1 in N',
          body: 'la probabilité du drop sur une kill, provenant de la source la plus rapide pour l’obtenir.',
        },
        {
          term: 'Kills attendues',
          body:
            'le nombre moyen de kills nécessaires. Il est calculé à partir des probabilités et du nombre de tirages.',
        },
        {
          term: 'Heures',
          body:
            'kills attendues divisées par le nombre de kills qu’un joueur réalise généralement par heure. C’est un repère, pas une promesse.',
        },
      ],
      note: {
        tag: 'Une moyenne, pas une limite',
        body:
          'La moitié des joueurs l’obtiennent avant les kills attendues, et certains en ont besoin de bien plus. Utilisez-le pour juger la taille d’une case, pas pour prédire quand elle tombera.',
      },
    },
    luck: {
      title: 'Chance : spooned, dry ou on rate',
      body: [
        'La chance compare les kills que vous avez faites avec celles qu’il aurait fallu. Si vous avez obtenu le drop en moins de kills que prévu, vous êtes **spooned**. Si vous avez fait beaucoup de kills sans rien obtenir, vous êtes **dry**. Entre les deux, vous êtes **on rate**.',
        'Anvil ne vous marque **dry** ou **spooned** que lorsque c’est inhabituel : environ une chance sur vingt ou moins. Il indique combien vous en avez contre combien étaient attendues, et de combien vous êtes en avance ou en retard.',
        'L’onglet **Luck** de la page Members liste les personnes les plus sèches et les plus chanceuses de votre clan. Les posts du plugin pour les drops rares peuvent aussi contenir une ligne de chance, comme un pourcentage de tête ou le nombre de joueurs qui l’auraient déjà eu.',
      ],
    },
    source: {
      title: 'D’où viennent les chiffres',
      body: [
        'Les taux de drop viennent de l’OSRS Wiki et sont actualisés chaque jour. Les taux de kills pour les heures viennent des guides de gains de la Wiki. Quand un taux est une estimation prudente, Anvil le traite comme tel.',
        'Si un taux semble faux, c’est sur la Wiki qu’il faut le corriger. Anvil reprend la modification.',
      ],
    },
    records: {
      title: 'Records et heures efficaces',
      body: [
        'Anvil garde votre meilleur **day**, **week**, **month** et **year** pour l’XP de compétence, les kills de boss et les heures efficaces. Les jours sont en UTC et les semaines commencent le lundi.',
        'Les records remontent au moment où Anvil a commencé à suivre votre compte : la première fois que vous les ouvrez, Anvil les complète à partir de votre historique quotidien, puis les tient à jour. Un record ne change que lorsque vous battez votre ancien meilleur.',
        'Vous voyez les vôtres sur la page de votre personnage, sous **Records**. Les détenteurs de records de votre clan sont dans **Members → Records**.',
        '**Efficient hours played** correspond au temps que vos gains prendraient avec de bonnes méthodes d’entraînement, pour pouvoir comparer une compétence rapide et une lente. **Efficient hours bossed** fait la même chose pour les kills. Les taux viennent de l’OSRS Wiki, et les comptes ironman utilisent leurs propres taux.',
      ],
    },
  },
};

export default fr;
