import type { PartialGuideDict } from './en';

// Français — French.
//
// Même convention que dans tous les autres fichiers de langue ici : tout ce que le lecteur VOIT
// RÉELLEMENT à l’écran reste en anglais — les menus de RuneLite et d’OBS, les lignes de chat du
// plugin lui-même, et les libellés de l’interface d’administration d’Anvil, qui sont en anglais
// jusqu’à ce que cette surface soit traduite elle aussi. Un « Tracked drop detected » traduit est
// une ligne que personne ne retrouve. Tout le reste — l’explication, l’ordre, le pourquoi — est en
// français.

const fr: PartialGuideDict = {
  common: {
    contents: 'Sommaire',
    step: 'Étape',
    optional: 'facultatif',
    minRead: '{n} min de lecture',
    language: 'Langue',
    partialNotice:
      'Ce guide n’est que partiellement traduit en {language}. Ce qui n’est pas encore traduit s’affiche en anglais.',
    backToGuides: 'Tous les guides',
    unreviewedNotice:
      'Cette traduction en {language} n’a encore été relue par aucun locuteur natif. Si une phrase sonne faux, [la page anglaise]({englishHref}) est l’original — et [nous le signaler](/feedback) est ce qui la corrigera.',
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
    },
    cards: {
      plugin: {
        eyebrow: 'Pour les joueurs',
        title: 'Installer le plugin RuneLite',
        blurb:
          'Installez le plugin, reliez-le à ce site, et laissez-le envoyer vos drops. Couvre aussi les notifications Discord et les clips OBS.',
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
    },
  },

  plugin: {
    metaTitle: 'Installer le plugin RuneLite — Anvil',
    metaDescription:
      'Installez le plugin RuneLite d’Anvil, reliez-le à ce site, et configurez les notifications Discord et les clips OBS.',
    eyebrow: 'Anvil · plugin RuneLite',
    title: 'Guide d’installation pour les joueurs',
    dek: 'Installez-le, pointez-le vers {clanName}, et jouez. Le plugin envoie vos drops de bingo, publie vos drops rares et vos morts sur Discord et — si vous utilisez OBS — enregistre et publie les clips des moments qui méritent d’être revus.',
    facts: [
      { strong: '2 champs', rest: 'et le suivi tourne' },
      { strong: '~3 min', rest: 'pour l’installation de base' },
      { strong: 'Les clips', rest: 'demandent OBS + 5 minutes de plus' },
    ],
    footnote:
      'Les captures viennent d’une installation réelle — le jeton de compte, l’adresse OBS et le webhook Discord sont masqués volontairement. Les vôtres doivent rester tout aussi privés.',

    install: {
      title: 'Installer le plugin',
      body: [
        'Dans RuneLite : **Configuration** (la clé à molette) → **Plugin Hub** → cherchez **Anvil** → **Install**. L’éditeur est `AhmedFathy2001`.',
        'Un seul plugin sert tous les clans — vous le pointez vers ce site à l’étape suivante, il n’y a donc rien de spécifique au clan à télécharger. Une fois installé, ouvrez **Configuration → Anvil** pour atteindre le panneau de réglages utilisé tout au long de ce guide.',
      ],
    },

    connect: {
      title: 'Relier à ce site',
      intro: 'Seule la section **Setup** compte pour démarrer. Tout le reste a des valeurs par défaut sensées.',
      figure: {
        caption: 'Configuration → Anvil → Setup',
        alt: 'La section Setup du plugin Anvil, avec les champs Site URL et Account Token encadrés',
        legend: [
          {
            label: 'Site URL',
            body: 'pour {clanName}, c’est `{origin}`. Le champ arrive vide, il faut donc le remplir. Pas besoin de barre oblique finale, et `https://` est ajouté si vous l’omettez.',
          },
          {
            label: 'Account Token',
            body: 'votre clé personnelle vers ce site. Soit vous laissez le plugin le remplir pour vous (ci-dessous), soit vous le collez vous-même. Traitez-le comme un mot de passe.',
          },
        ],
      },
      easyHeading: 'La voie facile : se connecter depuis le plugin',
      easyIntro:
        'Une fois la Site URL renseignée et le jeton encore vide, le **panneau latéral Anvil** affiche un bouton **Sign in with Discord**. Cliquez dessus et le plugin vous guide — sans rien copier.',
      easySteps: [
        'Le panneau affiche un code et ouvre votre navigateur sur ce site.',
        'Vérifiez que le code de la page correspond à celui de RuneLite, puis cliquez **Approve**.',
        'Le panneau indique _Signed in_ et remplit l’Account Token pour vous.',
      ],
      linkFigure: {
        caption: 'Ce site → /link-device',
        alt: 'La page Link your RuneLite client, avec le champ de code et le bouton Approve encadrés',
        legend: [
          { label: 'Le code', body: 'il doit correspondre à ce que le plugin vous affiche en ce moment.' },
          {
            label: 'Approve',
            body: 'n’approuvez qu’un code que _votre propre_ client affiche. Si quelqu’un vous a envoyé un lien ou un code, refusez — approuver reviendrait à lui donner votre compte.',
          },
        ],
      },
      brokeredNote: {
        tag: 'Pourquoi un second domaine apparaît',
        body: [
          'L’approbation se fait ici, sur `{origin}`. Si vous n’êtes pas encore connecté au site, l’étape de connexion passe par la connexion Discord partagée d’Anvil sur `anvilosrs.com` pour confirmer votre identité Discord, puis vous ramène directement ici — c’est la même connexion que celle du bouton Login de ce site, pas une partie du parcours du plugin.',
          'Le plugin lui-même ne parle qu’à `{origin}` : il refuse d’ouvrir une page de connexion qui ne se trouve pas sur la Site URL que vous avez saisie.',
        ],
      },
      directNote: {
        tag: 'Où cela se passe',
        body: [
          'Tout ce parcours reste sur `{origin}` — le code est émis ici, approuvé ici avec la connexion Discord propre à {clanName}, et le jeton est remis ici. Le plugin refuse d’ouvrir une page de connexion qui ne se trouve pas sur la Site URL que vous avez saisie, donc rien dans cette étape n’atteint une autre installation d’Anvil.',
        ],
      },
      federationAside:
        'À ne pas confondre avec **Connect clans** dans le panneau latéral — c’est le bouton distinct et facultatif qui vous relie à d’autres clans Anvil, et il n’apparaît qu’une fois que vous êtes déjà connecté ici.',
      manualFallback:
        'Si le navigateur ne s’ouvre pas tout seul, le panneau affiche l’adresse et le code pour que vous puissiez l’ouvrir à la main. Les codes expirent au bout de dix minutes — appuyez simplement de nouveau sur le bouton.',
      manualHeading: 'La voie manuelle : copier votre jeton',
      manualIntro:
        'Connectez-vous avec Discord et ouvrez [Profile](/profile), puis descendez jusqu’à la carte **RuneLite plugin**.',
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
            body: 'copiez-le dans le champ Account Token du plugin. Rotate en émet un nouveau et tue l’ancien — servez-vous-en si vous soupçonnez une fuite de votre jeton.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Bon à savoir',
        body: ['Un seul jeton couvre tous les événements auxquels vous êtes inscrit ici — vous ne le recollez jamais pour chaque bingo.'],
      },
    },

    accounts: {
      title: 'Reliez vos comptes — jouez, c’est tout',
      body: [
        'Il n’y a aucun code de liaison à saisir. Une fois le jeton en place, le compte avec lequel vous vous connectez est rattaché automatiquement à votre profil.',
        'Le plugin envoie votre nom en jeu ainsi qu’une empreinte de compte stable à chaque requête, et le site compare d’abord l’empreinte — vos liaisons survivent donc à un changement de nom. Connectez-vous une fois sur un compte secondaire et il apparaît sur votre profil sous _Accounts we noticed you playing_ avec un **Add** en un clic.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'La carte RuneScape Accounts sur la page de profil listant les comptes vérifiés via le plugin',
        legend: [
          {
            label: 'Vos comptes reliés',
            body: 'tout ce qui porte « Verified via plugin » y est arrivé simplement en jouant. Ajoutez autant de comptes secondaires que vous voulez ; l’un d’eux est votre compte principal.',
          },
        ],
      },
      noPluginHeading: 'Vous ne pouvez pas faire tourner le plugin ?',
      noPluginIntro:
        'Sur mobile ou sur le client officiel, reliez le compte sur le site à la place — la page de profil montre les deux options :',
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
        'Tu devrais aussi voir le **panneau latéral Anvil** se remplir avec tes clans, tes événements en cours, ton classement et les boutons de synchronisation — et un bouton **Anvil** apparaître dans la barre de titre de ton Collection Log en jeu, à côté de WikiSync et RuneProfile.',
      guestNote: {
        tag: 'Invité ou membre',
        body: 'Si le chat dit _Tracked as a guest_, vous êtes suivi mais vous n’êtes pas encore sur la liste des membres du clan. Un admin corrige ça en synchronisant la liste depuis le jeu — demandez {discordLink}.',
        discordWord: 'sur Discord',
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
            label: 'Auto Submit Drops',
            body: 'prend une capture et envoie un drop suivi à l’instant où il tombe. Laissez-le activé ; c’est tout l’intérêt.',
          },
          {
            label: 'Show Overlay',
            body: 'dessine un petit panneau _Anvil / équipe / date UTC_ en haut à gauche. Il fait partie de l’image dans vos captures de preuve, et c’est précisément ce qui rend une preuve difficile à falsifier ou à antidater. Il est désactivé sur cette capture — activez-le si votre clan veut voir l’équipe et l’heure sur chaque preuve.',
          },
          {
            label: 'Team completion popups',
            body: 'une bannière quand quelqu’un de votre équipe termine une case. Plusieurs d’un coup : la plus difficile obtient la bannière, le reste part dans le chat.',
          },
          {
            label: 'Distinct mission sound',
            body: 'donne son propre son à une mission qui tombe — et à quelqu’un qui la réclame — pour que tu la distingues d’une case ordinaire sans regarder.',
          },
          {
            label: 'Banner sound + volume',
            body: 'joue un son avec la bannière. Rien ne se déclenche tant que tu n’ajoutes pas toi-même au moins un .wav, via **Add clip** sous « Banner sounds » dans le panneau latéral Anvil.',
          },
          {
            label: 'Two-frame drop proof',
            body: 'intègre une seconde image à la capture quelques secondes plus tard, une fois le butin posé au sol. Gardez-le activé ; ça évite les disputes.',
          },
        ],
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
        'Elles partent qu’un bingo soit en cours ou non, et se publient dans les salons du clan. Dans quel salon, ce sont les admins qui le décident ici — vous ne choisissez que _quoi_ publier.',
      dropsFigure: {
        caption: 'Deaths & kills · Drops & pets',
        alt: 'Les sections de notification Deaths and kills et Drops and pets, chaque réglage encadré et numéroté',
        legend: [
          {
            label: 'Notify on death',
            body: 'publie dans le salon des morts du clan, avec une capture de l’instant de votre mort.',
          },
          { label: 'Death message', body: 'votre propre phrase. `{name}` est remplacé par votre RSN.' },
          {
            label: 'Notify on PvP kill',
            body: 'une capture du tick où votre cible atteint 0 PV. Désactivé par défaut ; activé ici.',
          },
          { label: 'Notify on rare drops', body: 'l’interrupteur principal des publications de drops.' },
          {
            label: 'Min drop value / Min drop rarity',
            body: 'deux voies indépendantes vers une publication : valoir au moins tant (GE ou high alch, le plus élevé), ou être plus rare que 1 sur N (1/10 000 par défaut — des réglages plus larges remplissent le salon de tirages d’herbes). Votre clan peut fixer un seuil de rareté valable pour tous ; le vôtre s’applique quand même s’il est plus strict. Mettez l’un ou l’autre à 0 pour désactiver cette voie.',
          },
          { label: 'Screenshot rare drops', body: 'joindre l’image, pas seulement le texte.' },
          {
            label: 'Loot key value',
            body: 'une loot key est publiée une seule fois, en une notification, quand tout son contenu dépasse ce chiffre.',
          },
          { label: 'Notify on pets + Screenshot pets', body: 'les pets vont dans le salon des drops rares.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · levels · diaries · quests',
        alt: 'La section de notification Combat achievements, chaque réglage encadré et numéroté',
        legend: [
          { label: 'Notify on combat achievements', body: 'les paliers terminés sont toujours publiés tant que c’est activé.' },
          {
            label: 'CA task min tier',
            body: 'à quel point les tâches individuelles font du bruit. Elite ici ; la valeur par défaut est Master. Mettez Grandmaster pour ne garder que les plus rares.',
          },
          {
            label: 'Notify on 99s & high totals',
            body: 'les 99, chaque tranche de 100 niveaux totaux à partir de 1800, et le max.',
          },
          { label: 'Notify on diary completions', body: 'les paliers d’achievement diary.' },
          {
            label: 'Announce quest completions',
            body: 'à partir de la difficulté que vous choisissez. « All quests » ici ; la valeur par défaut est Master et au-dessus.',
          },
        ],
      },
    },

    clips: {
      title: 'Clips avec OBS',
      intro: [
        'Une touche, et les 30 dernières secondes sont enregistrées et déposées dans le salon clips du clan. Désactivé par défaut et nécessite OBS en marche — mais c’est ce qui ressemble le plus à un montage de temps forts que votre clan aura.',
        'Comment ça marche : OBS garde un **replay buffer** glissant des X dernières secondes. Votre raccourci demande à OBS d’écrire ce tampon dans un fichier, et le plugin récupère le fichier et l’envoie à un webhook Discord que vous collez.',
      ],
      privacyNote: {
        tag: 'Où va votre vidéo',
        body: 'Les clips sont envoyés **directement de votre PC vers Discord**. Ils ne passent jamais par ce site, et rien n’est envoyé du tout si vous laissez le champ webhook vide — les clips restent alors sur votre machine.',
      },
      obsHeading: 'A. Configurer OBS (une fois)',
      obsSteps: [
        'Il vous faut **OBS Studio 28 ou plus récent** — le serveur WebSocket est intégré à partir de la 28, aucun téléchargement supplémentaire.',
        'Assurez-vous qu’OBS capture bien le jeu : une source Game / Window / Display Capture qui montre RuneLite. Si OBS ne voit pas votre client, vos clips seront un rectangle noir.',
        '**Settings → Output** → cochez **Enable Replay Buffer**. (En mode Simple output, c’est sur la page Recording ; en Advanced, il a son propre onglet.) Profitez-en pour vérifier l’espace disponible sur votre dossier d’enregistrement.',
        '**Tools → WebSocket Server Settings** → cochez **Enable WebSocket server**. Notez le **Server Port** (4455 par défaut) et cliquez **Show Connect Info** pour le mot de passe.',
      ],
      obsAside:
        'Vous n’avez _pas_ besoin d’appuyer sur « Start Replay Buffer » — le plugin le démarre pour vous à la connexion, et le relance chaque fois que vous changez la durée des clips.',
      fillHeading: 'B. Remplir le plugin',
      figure: {
        caption: 'Configuration → Anvil → Clips',
        alt: 'La section Clips des réglages du plugin, chaque réglage encadré et numéroté ; l’hôte OBS et l’URL du webhook sont masqués',
        legend: [
          { label: 'Enable clip capture', body: 'l’interrupteur principal. Désactivé, le plugin ne parle jamais à OBS.' },
          {
            label: 'Capture clip hotkey',
            body: 'réglez-le, sinon rien n’arrivera jamais. Choisissez quelque chose que vous n’appuierez pas par accident en plein raid.',
          },
          {
            label: 'OBS host / port / password',
            body: '`localhost` quand OBS tourne sur le même PC que RuneLite. Si OBS est sur une autre machine, mettez l’IP locale de cette machine ici — masquée sur cette capture — et ouvrez le port dans son pare-feu. Le port et le mot de passe viennent de _Show Connect Info_ ; laissez le mot de passe vide si vous avez désactivé l’authentification d’OBS.',
          },
          {
            label: 'Max auto-post size (MB)',
            body: 'tout ce qui dépasse est enregistré en local et mentionné discrètement dans le chat au lieu d’être publié. Réglez-le sur ce que votre serveur Discord accepte réellement ; le plugin est livré à 25.',
          },
          {
            label: 'Clip length (seconds)',
            body: 'jusqu’où chaque clip remonte. Cela écrit la durée du tampon dans votre profil OBS, OBS a donc besoin d’autant de secondes d’avance avant qu’un clip de pleine durée existe. Clips plus longs = fichiers plus gros ; 30 est un bon compromis.',
          },
          {
            label: 'Save clips as MP4',
            body: 'le MP4 s’affiche et se lit directement dans Discord ; le MKV doit d’abord être téléchargé. Notez que cela change le format d’enregistrement d’OBS, ce qui touche aussi vos enregistrements normaux. Désactivez-le pour laisser OBS tranquille.',
          },
          {
            label: 'Clips Discord webhook URL',
            body: 'où les clips sont publiés — demandez à un admin le webhook du salon clips. Vide = les clips restent sur votre PC. Masqué ici, et à raison : quiconque a cette URL peut publier dans ce salon.',
          },
          {
            label: 'Post OBS-triggered clips too',
            body: 'traite aussi les enregistrements déclenchés par OBS lui-même ou par le plugin « Save Replay Buffer for OBS ». Laissez-le désactivé si vous faites tourner deux clients RuneLite contre un seul OBS, sinon chaque clip est publié deux fois.',
          },
        ],
      },
      useHeading: 'C. L’utiliser',
      useIntro: 'Quelque chose de drôle arrive → appuyez sur votre raccourci → le chat vous guide :',
      useChat: [
        { text: 'Saving clip...', tone: 'plain' },
        { text: 'Uploading clip to the clan Discord...', tone: 'plain' },
        { text: 'Clip posted to the clan Discord.', tone: 'green' },
      ],
      reminder: {
        tag: 'Rappel',
        body: 'Le clip couvre les secondes _avant_ l’appui sur la touche — appuyez donc après le moment, pas pendant. Vous avez toute la durée de votre tampon pour réagir.',
      },
      decodedHeading: 'Messages de clips, décodés',
      decoded: [
        {
          term: '`Clip capture: OBS isn’t connected.`',
          body: 'OBS ne tourne pas, le serveur WebSocket est désactivé, ou hôte/port/mot de passe ne correspondent pas. Corrigez et réessayez — le plugin retente la connexion tout seul toutes les 30 secondes.',
        },
        {
          term: '`OBS could not save the clip — is the Replay Buffer started?`',
          body: 'Le tampon ne tourne pas. Vérifiez Enable Replay Buffer dans les réglages de sortie d’OBS, puis désactivez et réactivez Enable clip capture.',
        },
        {
          term: '`Clip saved locally — paste a Clips Discord webhook URL…`',
          body: 'Cela fonctionne comme prévu, vous n’avez simplement pas de webhook. Le fichier est dans votre dossier d’enregistrement OBS.',
        },
        {
          term: '`Clip saved locally (48MB) — too big to auto-post.`',
          body: 'Raccourcissez la durée du clip, baissez la qualité de votre enregistrement OBS, ou augmentez la taille maximale si votre serveur accepte des fichiers plus gros.',
        },
        {
          term: '`…but Discord didn’t accept the upload.`',
          body: 'Trop gros, limité en débit, ou l’envoi a expiré. Le fichier est toujours sur votre PC — publiez-le à la main s’il en vaut la peine.',
        },
      ],
    },

    trouble: {
      title: 'Quand quelque chose casse',
      intro:
        'Le plugin vous prévient dans le chat quand le suivi s’est arrêté — il attend environ 90 secondes avant de se plaindre et se répète au plus toutes les 5 minutes.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Le jeton est faux ou a été renouvelé. Recopiez-le depuis [Profile → RuneLite plugin](/profile#plugin-token), ou videz le champ et reconnectez-vous depuis le plugin.',
        },
        {
          term: '`Anvil: can’t reach the site — tracking is OFF.`',
          body: 'Vérifiez la Site URL (fautes de frappe) — elle doit être `{origin}`. Si elle est correcte, le site est probablement hors service.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Ce compte n’est pas encore relié. Ajoutez-le depuis Profile → « Accounts we noticed you playing ».',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Rien. Il s’est rétabli tout seul.',
        },
      ],
      logHeading: 'Toujours bloqué ? Envoyez un journal à un admin',
      logBody:
        'Tapez `::anvillog` dans le chat du jeu (ou réglez **Export debug log hotkey** dans la section Support du plugin). Cela écrit un fichier journal dans votre dossier `.runelite/anvil-debug`, ouvre le dossier, et copie le chemin dans votre presse-papiers — envoyez ce fichier à un admin et il verra exactement ce qui a échoué.',
      missingNote: {
        tag: 'Des preuves manquantes ?',
        body: 'Les familiers et les Champion’s scrolls en double demandent une capture manuelle. Le plugin la prend pour toi et l’enregistre dans `.runelite/osrs-bingo-pending/` — **Copy folder path** dans le panneau latéral Anvil ouvre le dossier — pour que tu la joignes sur le site au lieu de chercher une image après coup.',
      },
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
      { strong: '4 étapes', rest: 'dans l’assistant de configuration' },
      { strong: '7 formats', rest: 'pour construire une grille' },
      { strong: '1 bouton', rest: 'pour synchroniser la liste des membres' },
    ],
    footnote:
      'Ce guide suit l’application telle qu’elle est aujourd’hui. Si un écran ici ne correspond pas à ce que vous avez sous les yeux, c’est l’application qui a raison et le guide qui est périmé — [dites-le-nous](/feedback) et nous le corrigerons.',

    access: {
      title: 'Qui peut faire quoi',
      intro:
        'Tout le monde se connecte avec Discord — il n’y a pas de mots de passe. Le premier admin vient de la configuration du serveur ; ensuite, un admin promeut les autres depuis **Clan → Members & staff**. Les rôles s’empilent vers le bas : tout ce qu’un modérateur peut faire, un trésorier et un admin le peuvent aussi.',
      rows: [
        {
          term: 'Admin',
          body: 'accès complet — événements, cases, équipes, réglages, équipe, versements. À donner à aussi peu de gens que le clan peut le supporter.',
        },
        { term: 'Treasurer', body: 'tout ce qu’un modérateur peut faire, plus les frais d’inscription et les versements.' },
        {
          term: 'Moderator',
          body: 'le quotidien : liste des membres, vérifications, compétitions hebdomadaires, calendrier, retours. Ne peut ni créer ni modifier d’événements.',
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
        '**System → Setup** est un assistant en quatre étapes, et le tableau de bord garde les mêmes quatre sous forme de liste jusqu’à ce qu’elles soient faites : nommer le clan, relier Discord, créer un événement, ajouter des cases. Le statut est calculé à partir de vraies données, une étape n’est donc cochée que lorsqu’elle est réellement terminée.',
      discord:
        'Pour Discord vous avez deux voies, et elles se combinent : donnez un **bot** à Anvil et il pourra créer des webhooks, synchroniser rôles et surnoms, et construire des salons d’équipe privés ; donnez-lui une simple **URL de webhook** et il pourra publier des annonces et rien d’autre. Commencez par le webhook si vous voulez être en ligne en deux minutes, ajoutez le bot quand vous voulez l’automatisation.',
      permsNote: {
        tag: 'Permissions du bot',
        body: 'Le bot a besoin de _Manage Webhooks_, _Manage Roles_, _Manage Channels_ et _Manage Nicknames_, et son rôle doit se situer _au-dessus_ des rôles qu’il gère dans la liste des rôles de votre serveur. Sinon Discord refuse en silence.',
      },
      hosted:
        'Sur une formule hébergée, vous avez déjà croisé cet écran une fois : ajouter le bot pendant l’installation, c’est ainsi qu’Anvil a su quel serveur est le vôtre — il n’y a donc jamais eu d’ID de serveur à copier. Le même lien est ici quand vous voudrez déplacer le bot sur un autre serveur.',
    },

    channels: {
      title: 'Répartir les publications sur plusieurs salons',
      body: [
        'Par défaut, tout part dans un salon d’annonces principal. Quand il devient bruyant, ouvrez **System → Advanced settings → Webhooks** et donnez aux catégories bavardes leur propre maison — événements bingo, compétitions hebdomadaires, drops rares, morts, kills PvP, combat achievements, clips. Tout ce que vous laissez vide retombe sur le salon principal, vous pouvez donc détacher une catégorie à la fois.',
        'Avec le bot connecté, vous ne touchez jamais à une URL de webhook : choisissez un salon dans la liste et appuyez sur **Create webhook**. Sur un événement chargé, vous pouvez ajouter un second webhook sur le même salon — Anvil alterne entre les deux pour que la limite de débit de Discord n’avale pas de publications.',
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
        'Quiconque relie ou vérifie un compte sur le site sans figurer sur cette liste est un **invité** — suivi, visible, mais pas membre tant qu’un admin ne le promeut pas ou que la synchronisation suivante ne le récupère pas. C’est délibéré : cela veut dire que personne ne peut s’auto-promouvoir dans votre clan en tapant un nom.',
        'Vous pouvez aussi ajouter quelqu’un à la main depuis **Clan → Members & staff**, y compris l’inscrire à un événement en son nom quand il ne peut pas accéder au site.',
      ],
    },

    board: {
      title: 'Créer votre première grille',
      intro:
        '**Events → All events → New event**. Choisissez d’abord un format — il décide comment la grille est notée et ce que le reste du formulaire vous demandera.',
      formats: {
        classic: {
          label: 'Bingo classique',
          blurb: 'Une grille carrée N×N — les équipes font les cases dans l’ordre qu’elles veulent, chacune vaut 1.',
        },
        leagues: {
          label: 'Bingo Leagues',
          blurb: 'Une liste de tâches où chaque case porte sa propre valeur en points — autant de cases que vous voulez.',
        },
        race: {
          label: 'Course de cases',
          blurb: 'Un parcours ordonné — les équipes atteignent les cases dans l’ordre ; qui va le plus loin gagne.',
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
        'L’onglet **Tiles** de l’événement est l’endroit où une grille devient un bingo. Chaque case est un _type_ de tâche, et le type décide de ce que le plugin surveille : un drop, un compteur de kills de boss, de l’XP de compétence, un kill de PNJ, un temps à battre, un achievement diary, un Combat Achievement, un déblocage de collection log, un kill PvP, un gain d’objet, ou une run sans mort. Les cases manuelles — celles qu’un humain valide à partir d’une capture — restent toujours possibles.',
        'Pour une grille complète, créez en masse : exportez la feuille, remplissez-la dans un tableur, et réimportez-la. CSV et .xlsx font l’aller-retour, et les lignes suivent les positions, vous pouvez donc réécrire une grille entière de 25 cases en un seul collage.',
      ],
      rows: [
        {
          term: 'Niveaux de difficulté',
          body: 'les valeurs en points correspondent à des paliers nommés (easy → elite). Modifiez les paliers dans Advanced settings si votre clan classe autrement.',
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
        'L’onglet **Teams & Draft** s’adapte au format choisi : un format sans équipes le saute entièrement. Pour un bingo par équipes classique, vous créez les équipes, décidez qui les capitaine, et soit répartissez les joueurs vous-même, soit organisez un draft en direct.',
        'Les capitaines draftent dans le vivier d’inscrits dans l’ordre que vous choisissez, et chaque capitaine voit les réponses données au formulaire d’inscription — figées telles qu’elles ont été envoyées, pour que personne ne retouche ses « heures par semaine » après avoir été choisi.',
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
          body: 'System → Announce publie un message dans vos salons en plein événement sans que vous écriviez de webhook à la main.',
        },
      ],
      missionNote: {
        tag: 'Surprises en cours d’événement',
        body: 'Vous pouvez lâcher une **mission** sur un bingo en cours — une case bonus cachée annoncée au moment où vous la déclenchez, qui peut perdre de la valeur ou expirer. C’est le moyen le moins cher de réveiller une grille au cinquième jour.',
      },
      startProofNote: {
        tag: 'Empêcher le stockage avant l’événement',
        body: [
          'Activez **Starting shot** (événement → Overview) et chaque joueur devra remettre une capture prise après le lancement, à un endroit qu’Anvil tire au sort à l’instant du départ — pour que personne ne soit assis sur une semaine de clues et de coffres accumulés à l’instant zéro. Le lieu est annoncé avec le départ ; le mot-clé de chaque joueur est personnel, dérivé du tirage, et n’existe pas avant le démarrage, il ne peut donc être préparé à l’avance par personne.',
          'Épinglez les endroits sur la carte du monde (l’éditeur de pool en a une) et le plugin vérifie que les joueurs s’y trouvent réellement, au lieu de simplement le leur avoir dit. Vous pouvez aussi exiger une **session fraîche** — 15 minutes par défaut : les hiscores ne sont enregistrés qu’à la déconnexion, obliger tout le monde à se reconnecter juste avant sa photo est donc ce qui rend honnêtes les totaux de départ derrière chaque case XP et KC.',
          'Les utilisateurs du plugin appuient sur un bouton. Tous les autres tapent leur mot-clé en jeu et envoient depuis My Team. Vous choisissez ce qui arrive au crédit de quelqu’un qui n’a rien remis : le signaler pour vérification (par défaut) ou le refuser jusqu’à ce qu’il le fasse. Le même panneau Overview est la liste de vérification — les captures du plugin avec mot-clé validé arrivent déjà acceptées, en pratique vous ne regardez donc que les joueurs sur mobile.',
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
          body: 'l’onglet Payouts de l’événement transforme la cagnotte en liste de qui reçoit quoi, cochée au fur et à mesure des paiements.',
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
          body: 'gardez la grille que vous venez de construire. Le prochain bingo repart de là plutôt que d’une grille vide.',
        },
      ],
      federation:
        'Avec la fédération activée, les membres peuvent aussi se connecter à d’autres clans Anvil depuis le plugin — pratique pour des événements inter-clans, et entièrement facultatif par membre.',
      outro: 'Orientez ensuite vos membres vers [le guide d’installation pour les joueurs]({pluginGuide}) et commencez à préparer le suivant.',
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
        'Ouvrez votre événement et allez dans l’onglet **Teams & Draft**. Créez une équipe par clan invité et nommez-la d’après lui — le nom est ce que leurs joueurs voient sur le formulaire d’inscription, « Ironforge » vaut donc mieux que « Équipe 2 ».',
        'Vous n’avez _pas_ besoin de faire un draft. Liens d’invitation et draft sont des alternatives : un draft répartit un vivier commun, un lien place les gens directement. Sur un clan contre clan pur, la plupart des organisateurs créent les équipes, distribuent un lien à chacune, et n’ouvrent jamais le draft.',
        'Ouvrez ensuite l’équipe elle-même — **Teams & Draft → l’équipe** — car c’est là que se passent les deux étapes suivantes.',
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
        caption: 'Événement → Teams & Draft → l’équipe → Team staff',
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
        caption: 'Événement → Teams & Draft → l’équipe → Invite links',
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
        kill: { label: 'Compteur de kills', blurb: 'N kills d’un PNJ — même ceux que les hiscores n’ont jamais comptés (poules, vaches). Détecté par le plugin.' },
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
          term: 'Un objectif de KC de boss',
          body: 'n’est **pas** une case kill. Les cases kill surveillent les morts de PNJ via le plugin ; un objectif de KC est un chiffre des hiscores et exige `trackedStat` + `statType=boss` + `statGoal`. Utilisez une case kill pour ce que les Hiscores n’ont jamais compté — vaches, poules, un mob de slayer précis.',
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
        'Cliquer une grille de 25 cases, ça va. Cliquer une grille Leagues de 200 tâches, non, et la relire ensuite non plus. L’onglet Tiles a un aller-retour prévu exactement pour ça.',
      ],
      steps: [
        '**Download spreadsheet** dans l’onglet **Tiles** de l’événement. Vous obtenez un .xlsx de la grille telle qu’elle est, avec listes déroulantes, liste d’objets et consignes de colonnes sur leurs propres feuilles.',
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
          body: 'les lignes en trop créent de nouvelles cases sur une grille Leagues ou une course de cases, avant le démarrage, jusqu’à 1000. Une grille classique N×N a une forme fixe et les ignore. Pour générer des centaines de tâches, faites-en un événement Leagues.',
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
        'Sur une grille aux points, chaque case porte sa propre valeur, et ces valeurs correspondent à des paliers de difficulté nommés — easy à elite — que vous pouvez modifier dans **Advanced settings** si votre clan classe autrement. Le palier est ce que lisent les joueurs ; le chiffre est ce qui compte.',
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
      'Le format se fixe à la création mais se change ensuite depuis l’onglet Overview de l’événement ; la règle de révélation et les modificateurs de points se changent à tout moment avant que les cases concernées soient révélées.',

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
        { term: 'Des centaines de tâches, notées par difficulté', body: 'Leagues, tout visible. C’est aussi la seule forme dans laquelle un gros import de tableur peut grandir.' },
        { term: 'Une semaine qui construit vers quelque chose', body: 'Leagues avec révélation programmée ou par intervalle, pour que la grille s’ouvre au fil de la semaine plutôt que d’un coup.' },
        { term: 'Une soirée que les gens suivent en direct', body: 'Prime. Une case, la première équipe la prend, la suivante aussitôt.' },
        { term: 'Une compétition individuelle, pas par équipes', body: 'Échelle avec fenêtre rotative et décote. Les tâches vont et viennent et personne ne peut les mettre de côté.' },
        { term: 'Une course avec une ligne d’arrivée', body: 'Course de cases — un parcours ordonné, et qui va le plus loin gagne.' },
      ],
      outro:
        'Quoi que vous choisissiez, les cases elles-mêmes sont le même travail : voir [Construire une grille qui se suit toute seule]({boardGuide}).',
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
      'Frais et récompenses sont le domaine du trésorier. Un trésorier peut tout ce que peut un modérateur, plus ceci ; un modérateur peut marquer des frais comme encaissés mais jamais les clore.',

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
        'Combien de signatures des frais exigent est un réglage de clan, de zéro à cinq. Zéro existe pour une vraie raison : dans un clan où le trésorier _est_ le propriétaire, il n’y a personne d’autre pour signer, et « 34 frais en attente d’une deuxième signature » devient une file qu’on ne peut jamais vider et en permanence la chose la plus bruyante du tableau de bord. À zéro, marquer des frais payés **est** la signature.',
        'Mettez un — la valeur par défaut — si vous êtes deux. Mettez zéro si honnêtement vous ne l’êtes pas, et plus haut seulement si votre clan a à la fois les gens et la raison.',
      ],
    },

    pay: {
      title: 'Verser',
      body: [
        'Quand l’événement se termine, l’onglet **Payouts** transforme la cagnotte en liste de personnes. Générez-la et vous obtenez une ligne par bénéficiaire, pas par équipe : le prix d’une équipe gagnante se divise à parts égales entre ses membres, pour que verser soit une liste de noms et de chiffres plutôt qu’un problème d’arithmétique à minuit.',
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
        'la liste des membres : la synchroniser, ajouter des gens, promouvoir un invité',
        'les vérifications de comptes — le défi XP et l’examen manuel',
        'les soumissions et les captures de preuve',
        'les compétitions hebdomadaires et le calendrier',
        'les retours des membres',
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
          body: 'le cas courant, et il ne vous demande rien. Jouer le compte avec le plugin connecté le relie automatiquement, et une empreinte de compte stable fait survivre la liaison à un changement de nom.',
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
        body: 'Vérifier un compte dit « celui-ci est bien à lui ». Cela ne l’intègre pas au clan — l’appartenance au clan ne vient que d’une synchronisation de la liste en jeu ou d’un admin qui l’ajoute à la main. Quelqu’un de vérifié mais absent de la liste est un **invité** : suivi, visible, non membre. C’est délibéré, et c’est ce qui empêche quiconque de rejoindre votre clan en tapant un nom.',
      },
    },

    roster: {
      title: 'Garder la liste des membres honnête',
      body: [
        'La liste des membres vient d’un seul endroit : un admin lance une synchronisation depuis la liste de clan en jeu, avec le bouton **Anvil** de la barre de titre de la fenêtre de clan (ou **Sync roster** dans le panneau latéral du plugin). Tout le reste — vérifications, liaisons, inscriptions — en dépend.',
        'Le travail d’entretien est donc petit mais réel : lancez la synchronisation après chaque vague de recrutement, promouvez les invités qui ont réellement rejoint, et regardez les personnes que le site a signalées plutôt que d’attendre qu’elles se plaignent.',
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
};

export default fr;
