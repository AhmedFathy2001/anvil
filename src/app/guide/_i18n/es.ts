import type { PartialGuideDict } from './en';

// Español — Spanish.
//
// Misma convención que en los demás archivos de idioma: todo lo que el lector VE REALMENTE en su
// pantalla en Anvil, RuneLite y OBS se queda en inglés — los menús de RuneLite y OBS, las líneas de
// chat del propio plugin, y las etiquetas del panel de administración de Anvil, que están en inglés
// hasta que también se traduzca esa superficie. Un «Tracked drop detected» traducido es una línea
// que nadie vuelve a encontrar. Las etiquetas de la propia interfaz de Discord (menús, ajustes,
// permisos) siguen, en cambio, la traducción oficial de Discord al español — lo que muestra un
// Discord configurado en español; donde Discord no estuviera traducido, se quedarían en inglés.
// Todo lo demás — la explicación, el orden, el porqué — está en español.

const es: PartialGuideDict = {
  common: {
    contents: 'Contenido',
    step: 'Paso',
    optional: 'opcional',
    minRead: '{n} min de lectura',
    copyLink: 'Copiar un enlace a esta sección',
    linkCopied: 'Enlace copiado',
    language: 'Idioma',
    partialNotice:
      'Esta guía solo está traducida parcialmente al {language}. Lo que aún no está traducido aparece en inglés.',
    backToGuides: 'Todas las guías',
    unreviewedNotice:
      'Ningún hablante nativo ha revisado todavía esta traducción al {language}. Si una frase suena mal, [la página en inglés]({englishHref}) es el original — y [avisarnos](/feedback) es lo que la arregla.',
    support: {
      lead: '¿Atascado o algo no cuadra?',
      link: 'Pregunta en el Discord de soporte de Anvil',
    },
  },

  index: {
    metaTitle: 'Guías — Anvil',
    metaDescription:
      'Empezar con Anvil: el plugin de RuneLite para jugadores, organizar un evento para el equipo del clan, y acoger a un clan invitado.',
    title: 'Guías',
    dek: 'Todo lo que necesitas para empezar, escrito para exactamente la versión de Anvil que corre aquí.',
    groups: {
      playing: 'Jugar',
      running: 'Organizar un evento',
      clan: 'Llevar el clan',
      streamers: 'Streamers',
    },
    anvilTab: 'Usar Anvil',
    ingame: {
      title: 'Guías del juego',
      dek: 'Raids, jefes, habilidades y formas de ganar dinero de la biblioteca de Anvil — las mismas guías que el plugin muestra en el juego y el bot publica en Discord.',
      browse: 'Ver todas las guías',
      language: 'Estas guías no están traducidas: se muestran tal como se escribieron, sea cual sea el idioma de esta página.',
      empty: 'La biblioteca de Anvil aún no tiene guías publicadas. Vuelve pronto.',
      placeholder: 'Busca guías del juego — prueba "zulrah", "raids" o "money"',
      readTime: '{n} min de lectura',
      metaTitle: 'Guías de OSRS para el juego — Anvil',
      metaDescription: 'Guías de raids, jefes, habilidades y dinero de la biblioteca de Anvil, para leer en la web, en el juego con el plugin de RuneLite y en Discord.',
    },
    search: {
      placeholder: 'Busca en las guías — prueba "webhook", "casillas" o "no aparecen los drops"',
      results: '{n} guías',
      empty: 'Nada coincide. Prueba una palabra más sencilla — "casillas", "pago", "bot" — o mira la lista de abajo.',
      clear: 'Borrar la búsqueda',
    },
    cards: {
      tiles: {
        eyebrow: 'Para jugadores',
        title: 'Reglas y límites de las casillas',
        blurb: 'Lo que una casilla necesita de ti antes de empezar (un ajuste del juego, el plugin, un registro sincronizado, un puesto en los hiscores) y lo que no puede seguir.',
        minutes: '~4 min',
      },
      discord: {
        eyebrow: 'Para quien lleva el servidor',
        title: 'Anvil en Discord',
        blurb: 'Una invitación, luego los canales donde publica cada flujo, roles, comandos slash, y qué comprobar cuando se para.',
        minutes: '~5 min',
      },
      switching: {
        eyebrow: 'Pasarte a Anvil',
        title: 'Cambiarse desde otros plugins y trackers',
        blurb:
          'Anvil publica tus drops en Discord y organiza vuestras competiciones semanales. Cinco pasos para el staff, dos para los jugadores.',
        minutes: '~3 min',
      },
      clan: {
        eyebrow: 'Para quien empieza uno',
        title: 'Crear un clan',
        blurb: 'Dos nombres y una dirección, y está en línea. Después Discord, tu lista de miembros y el primer tablero.',
        minutes: '~4 min, gratis',
      },
      plugin: {
        eyebrow: 'Para jugadores',
        title: 'Configurar el plugin de RuneLite',
        blurb:
          'Instala el plugin, inicia sesión desde su panel lateral y deja que envíe tus drops. Cubre también las notificaciones de Discord y la búsqueda de jugadores.',
        minutes: '~3 min de configuración',
      },
      board: {
        eyebrow: 'Para quien monta el tablero',
        title: 'Monta un tablero que se registra solo',
        blurb:
          'Qué puede ver realmente cada tipo de casilla, crearlas en bloque con una hoja de cálculo, y los errores que se importan limpios y luego nunca saltan.',
        minutes: '~8 min',
      },
      captain: {
        eyebrow: 'Para capitanes',
        title: 'Guía del capitán',
        blurb:
          'Leer la lista antes de que arranque el reloj, el día del draft en sí, y las partes de llevar un equipo que empiezan después.',
        minutes: '~6 min',
      },
      formats: {
        eyebrow: 'Para el equipo del clan',
        title: 'Formatos, y cómo se abren las casillas',
        blurb:
          'Siete formas de tablero, cinco maneras de que las casillas se vuelvan jugables, y los tres modificadores que deciden cuánto vale completar una.',
        minutes: '~5 min',
      },
      fees: {
        eyebrow: 'Para tesoreros',
        title: 'Cuotas y premios',
        blurb:
          'Cobrar una cuota de inscripción, recaudarla, la segunda firma que la cierra, y convertir un bote en puestos pagados.',
        minutes: '~5 min',
      },
      coffer: {
        eyebrow: 'Para tesoreros',
        title: 'La caja del clan',
        blurb:
          'Una sola caja para el oro del clan: qué entra, las tres formas en que paga premios, y quién puede tocarla.',
        minutes: '~5 min',
      },
      moderator: {
        eyebrow: 'Para moderadores',
        title: 'De guardia',
        blurb:
          'La cola, revisar pruebas y cuentas, mantener honesta la lista de miembros, y los criterios que acaban en manos de una persona.',
        minutes: '~5 min',
      },
      admin: {
        eyebrow: 'Para el equipo del clan',
        title: 'Cómo organizar tu primer evento',
        blurb:
          'Discord, lista de miembros, tableros, casillas, equipos y draft, el arranque — y qué hacer cuando el evento acaba.',
        minutes: 'una tarde, una vez',
      },
      clanVsClan: {
        eyebrow: 'Para anfitriones',
        title: 'Acoger a un clan invitado',
        blurb:
          'Clan contra clan sin recoger ni un solo RSN a mano: un enlace de invitación por equipo, y un puesto para que su propio moderador lleve su mitad.',
        minutes: '~5 min por equipo',
      },
      commands: {
        eyebrow: 'Para todos los miembros',
        title: 'Comandos slash',
        blurb:
          'Cada comando al que responde el bot en Discord, qué hace cada opción, ejemplos prácticos, y qué comprobar cuando alguno no aparece.',
        minutes: '~6 min',
      },
      creators: {
        eyebrow: 'Para streamers',
        title: 'Organizar eventos para tus espectadores',
        blurb:
          'Sin clan. Crea un espacio, comparte un enlace, elige quién puede entrar (seguidores, suscriptores, roles de Discord) y pon el tablero en el stream.',
        minutes: '~6 min',
      },
      joiningStream: {
        eyebrow: 'Para espectadores',
        title: 'Unirte al evento de un streamer',
        blurb:
          '¿Te llegó un enlace desde un stream? Inicia sesión, añade tu personaje y pulsa Join. Qué hacer en eventos solo para seguidores o suscriptores.',
        minutes: '~2 min',
      },
      streamingClans: {
        eyebrow: 'Para clanes que hacen stream',
        title: 'Stream para clanes',
        blurb:
          'Deja que tus espectadores jueguen un evento sin unirse al clan. Activa Streaming y abre un evento a los espectadores.',
        minutes: '~2 min',
      },
      people: {
        eyebrow: 'Para el equipo del clan',
        title: 'Tu gente: lista de miembros, invitados y quién puede unirse',
        blurb:
          'De dónde salen los miembros, qué significan los filtros de la pestaña Roster, las solicitudes para unirse y Needs review, los tres ajustes de Who can join, y cómo quitar o banear a alguien.',
        minutes: '~6 min',
      },
      staffRoles: {
        eyebrow: 'Para propietarios y admins',
        title: 'Roles del staff: quién puede hacer qué',
        blurb:
          'Propietario, admin, tesorero y moderador: hasta dónde llega cada uno, cómo nombrar a un moderador, quién puede dar qué rol, y los cargos que cubren un solo evento.',
        minutes: '~6 min',
      },
      supporter: {
        eyebrow: 'Para jugadores',
        title: 'Anvil Supporter: niveles y ventajas',
        blurb:
          'Supporter, Champion y Patron: colores del nombre, la estrella, fotos de perfil, la vitrina, eventos con amigos y boosts de clan, cómo funciona el cobro y qué pasa si lo dejas.',
        minutes: '~6 min',
      },
      sidePanel: {
        eyebrow: 'Para jugadores',
        title: 'El panel lateral, pestaña a pestaña',
        blurb:
          'Clan, Feed, You, Lookup y el engranaje: qué muestra cada pestaña, el chat de eventos, las reacciones GZ y Sad, y los ajustes que llevan el feed y los colores de Supporter a tu juego.',
        minutes: '~6 min',
      },
      clanBoosts: {
        eyebrow: 'Para Supporters y el equipo del clan',
        title: 'Dar boost a un clan',
        blurb:
          'Colocar y mover un boost, los tres niveles y qué desbloquea cada uno, los colores del nombre del clan, los boosts regalados, y las marcas e insignias de quien da boost.',
        minutes: '~5 min',
      },
      profile: {
        eyebrow: 'Para jugadores',
        title: 'Tu perfil, Wrapped y Compare',
        blurb: 'Tu perfil, la página pública de cada personaje y tu página de persona, quién puede verlas, las tarjetas Wrapped mensuales y de evento, y comparar dos personajes.',
        minutes: '~4 min',
      },
      settings: {
        eyebrow: 'Para jugadores',
        title: 'Ajustes, página por página',
        blurb: 'Publicaciones de Discord y privacidad de capturas, el feed del chat del juego, dispositivos, tus propios webhooks, quién ve tus personajes, cada personaje y las reclamaciones de propiedad.',
        minutes: '~6 min',
      },
      challenges: {
        eyebrow: 'Para jugadores',
        title: 'Retos y eventos de amigos',
        blurb: 'Reta a un jugador a una carrera de drops, kills o XP, y organiza un tablero privado para tus amigos detrás de un único enlace de invitación.',
        minutes: '~4 min',
      },
      clanHall: {
        eyebrow: 'Para jugadores y clanes',
        title: 'Encontrar clanes, eventos y clasificaciones',
        blurb: 'El Clan Hall, comparar dos clanes, la clasificación semanal, la lista pública de eventos y las páginas de clanes del juego que no están en Anvil.',
        minutes: '~3 min',
      },
      guideLibrary: {
        eyebrow: 'Para jugadores y staff de clan',
        title: 'Guías del juego',
        blurb: 'Leer la biblioteca de guías por nivel, proponer una guía nueva o una edición, y mantener las copias propias de tu clan.',
        minutes: '~3 min',
      },
      weekly: {
        eyebrow: 'Para staff de clan y jugadores',
        title: 'Skill y Boss of the Week',
        blurb: 'Programar una competición semanal, repetirla y rotarla, las líneas de salida, los premios, terminarla antes de tiempo y lo que ven los jugadores.',
        minutes: '~4 min',
      },
      teamComps: {
        "eyebrow": "Para staff de clanes y jugadores",
        "title": "Competiciones por equipos",
        "blurb": "Competiciones de skills y bosses por equipos o clan contra clan: cómo montarlas, invitar clanes, cómo funcionan los totales y promedios, y qué ve cada jugador.",
        "minutes": "~4 min"
      },
      clanEvents: {
        eyebrow: 'Para staff de clan',
        title: 'Eventos del clan y el calendario',
        blurb: 'Masivos, noches de raid y quedadas: repeticiones semanales, «Voy» e inscripciones, recordatorios en Discord, pagos, encuestas y encontrar huecos en el calendario.',
        minutes: '~4 min',
      },
    },
  },

  switching: {
    metaTitle: 'Cambiarse desde otros plugins y trackers — Anvil',
    metaDescription:
      'Pasa tu clan a Anvil: configura los canales de Discord, sincroniza la lista del clan, empieza una Skill o Boss of the Week y avisa a tus miembros.',
    eyebrow: 'Pasarte a Anvil',
    title: 'Cambiarse desde otros plugins y trackers',
    dek: 'Anvil publica los drops y logros de tu clan en Discord. También mantiene la lista del clan y organiza competiciones semanales.',

    staff: {
      title: 'Si diriges el clan',
      body: [
        '**Deja que el bot configure tus canales.** Ve a Admin → Discord → **Set it up for me**. Elige un canal o varios. Si otro plugin publicaba en algún sitio, marca _Use the same channels_. A tus miembros no les cambia nada.',
        '**Sincroniza la lista del clan.** En RuneLite, abre los ajustes del plugin de Anvil. Activa **Keep the clan roster in sync**. Un admin lo hace una sola vez, dentro del juego. Esto sustituye cualquier lista de clan que llevaras en otro sitio.',
        '**Empieza una Skill o Boss of the Week.** Ve a Admin → All events → **+ New event** y elige Skill of the Week o Boss of the Week. Todos los de la lista del clan participan automáticamente. Esto sustituye a las competiciones que organizabas en otro sitio.',
        '**Avisa a tus miembros.** Ve a Admin → Discord → **Tell your members** → **Post it**. El bot publica los pasos para los jugadores por ti.',
        '**Una semana después, limpia.** Ve a Admin → Discord → **Remove old webhooks from other plugins**, marca los que sobran, pulsa **Remove … webhooks** y después **Yes, remove them**. Después de eso, nada puede publicarse dos veces. Pulsa **Keep** en los que quieras dejar tal cual.',
      ],
    },

    player: {
      title: 'Si eres jugador',
      body: [
        '**Instala Anvil.** En RuneLite, abre el Plugin Hub, busca Anvil y pulsa **Install**. Luego inicia sesión con Discord desde el panel lateral de Anvil.',
        '**Desactiva las notificaciones de tu plugin antiguo** para que nada se publique dos veces. O desinstálalo, si no lo usas para nada más.',
        '**Eso es todo.** No hay nada más que configurar.',
      ],
    },

    questions: {
      title: 'Preguntas',
      intro: 'Las que más hacen los clanes:',
      rows: [
        {
          term: '¿Anvil registra kill counts, tareas de slayer y mejores marcas personales?',
          body: 'Sí. Anvil registra por sí mismo los kill counts, las tareas de slayer y las mejores marcas personales, así que no hay nada más que mantener en marcha.',
        },
        {
          term: '¿Los jugadores tienen que pegar un webhook en algún sitio?',
          body: 'No. El clan configura los canales en la web.',
        },
        {
          term: '¿Quieres publicaciones también en tu propio servidor?',
          body: 'Ve a tu perfil → **Announcements & webhooks** → _Your own webhooks_.',
        },
      ],
    },
  },

  clan: {
    metaTitle: 'Crear un clan — Anvil',
    metaDescription: 'Crea un clan en Anvil: ponle nombre, elige su dirección, conecta Discord, sincroniza tu lista de miembros y organiza tu primer evento.',
    eyebrow: 'Anvil · empezar',
    title: 'Crear un clan',
    dek: 'Dos nombres y una dirección, y tu clan está en línea — gratis, y no hay nada que esperar. Eso es esto, más las cuatro cosas que conviene hacer justo después.',
    facts: [
      {
        strong: 'Gratis',
        rest: 'sin tarjeta, sin prueba',
      },
      {
        strong: 'En línea',
        rest: 'en cuanto lo envías',
      },
      {
        strong: '~4 min',
        rest: 'hasta un clan funcionando',
      },
    ],
    footnote: 'Todo esto se puede cambiar luego desde Admin → **Clan settings**, salvo la dirección — esa merece un momento de reflexión ahora.',
    before: {
      title: 'Antes de empezar',
      body: [
        'Necesitas una cuenta de Discord, y esa es toda la lista. Inicia sesión primero en `{apex}`: un clan necesita un propietario, y el inicio de sesión es como el sitio sabe que eres tú. Empieza desde **Crear un clan** en las páginas de la plataforma, o ve directo a `{apex}/clans/new`.',
        'No cuesta nada. No hay plan que elegir, ni tarjeta que introducir, ni prueba que caduque y se lleve tu tablero — un clan empieza gratis y sigue siendo usable.',
        'Los clanes grandes pueden subir de plan más adelante desde **Plan and billing** en Admin. Todo lo que pagas en Anvil — un clan, un espacio de creador o tu propia membresía Supporter — está en [tu página de facturación](/portal).',
      ],
      note: {
        tag: 'Serás su propietario',
        body: 'Propietario es el único rol que nadie puede quitarte, y va a quien crea el clan. Añade staff después desde Admin → **People** → **Staff & roles**; ver [En el turno]({moderatorGuide}).',
      },
    },
    create: {
      title: 'Ponle nombre y elige su dirección',
      intro: 'Tres campos, y solo dos decisiones reales. El formulario comprueba la dirección mientras escribes y te avisa antes de enviar.',
      fields: [
        {
          term: 'Nombre del clan en el juego',
          body: 'Obligatorio, y tiene que coincidir **exactamente** con OSRS. No es decoración: la sincronización de la lista se basa en él y rechaza cualquier lista de miembros que se reporte con otro nombre. Eso es lo que impide que la lista de otro acabe en tu sitio.',
        },
        {
          term: 'Nombre del clan',
          body: 'Opcional. Lo que ve la gente — en el sitio y en cada publicación de Discord. Déjalo en blanco y se usará tu nombre del juego para ambos.',
        },
        {
          term: 'Dirección',
          body: 'Tu clan vive en `{apex}/c/tu-slug`. Se sugiere a partir del nombre que escribiste, puedes editarla, y unas cuantas palabras están reservadas. Elige una que te siga gustando dentro de un año: es el enlace que acabará fijado en tu Discord.',
        },
      ],
      note: {
        tag: 'El nombre del juego es un cerrojo, no una etiqueta',
        body: 'Si tu clan se renombra en el juego, cámbialo aquí también — hasta entonces la sincronización rechazará el nombre nuevo. Es el control funcionando, no un fallo.',
      },
    },
    live: {
      title: 'Está en línea',
      body: [
        'Pulsa **Crear clan** y existe. Sin aprovisionamiento, sin cola, sin «estamos construyendo tu sitio, vuelve en unos minutos» — un clan es una fila, así que ya está sirviendo antes de que la página termine de cambiar.',
        'Aterrizas en una elección entre **Configurarlo**, que abre el asistente, y **Echar un vistazo primero**. No se rompe nada si te vas y vuelves mañana; el asistente recuerda qué pasos has hecho.',
      ],
    },
    setup: {
      title: 'El asistente de configuración',
      intro: 'Tres pasos separan un clan recién creado de un evento en marcha, y el asistente los recorre en orden, saltándose lo que ya hayas hecho. El tablero viene justo después.',
      steps: [
        {
          term: 'Tu clan',
          body: 'Tu nombre visible, tu nombre de clan en el juego y un enlace de invitación a tu servidor. La invitación es lo que permite que las páginas de inscripción y las guías dirijan gente hacia ti.',
        },
        {
          term: 'Conectar Discord',
          body: 'Un bot compartido, así que no hay aplicación que registrar ni token que pegar. Pulsa **Connect your bot** y apruébalo una vez; luego elige **A few channels** o **Just one channel** y pulsa **Set it up for me** — el bot crea los canales por ti.',
        },
        {
          term: 'Trae a tus miembros',
          body: 'Instala el plugin, inicia sesión con Discord, y luego abre la ventana del clan en el juego y pulsa el botón **Anvil** de su barra de título. Nadie puede inscribirse en un evento hasta que tu lista de miembros esté dentro.',
        },
        {
          term: 'Haz un tablero',
          body: 'El asistente termina en **Create your first event →**. Elige un formato, añade casillas, abre inscripciones — eso es [Organizar tu primer evento]({adminGuide}), y con diferencia el paso más largo.',
        },
      ],
      after: [
        'Puedes saltarte el asistente por completo con **Skip setup** y hacerlo todo luego desde Admin → **Clan settings** y Admin → **Discord**. Existe porque el orden importa cuando nunca lo has hecho: Discord antes que los canales, los miembros antes que un tablero en el que tienen que inscribirse.',
      ],
    },
    members: {
      title: 'Meter a tus miembros',
      body: [
        'Nadie tiene que inscribirse, registrarse ni ser invitado uno a uno. Tu lista de miembros viene del juego.',
      ],
      ways: [
        {
          term: 'Sincronización de la lista (haz esta)',
          body: 'Abre la ventana de clan en el juego con el plugin activo y pulsa el botón **Anvil** en su barra de título. Toda tu lista llega con los rangos intactos, y una lista de un clan cuyo nombre no coincide con el tuyo se rechaza. Repítelo cuando entre o salga gente — ver la [guía de instalación para jugadores]({pluginGuide}).',
        },
        {
          term: 'Piden unirse',
          body: 'Iniciar sesión o jugar con el plugin nunca le da a nadie un puesto por sí solo. Si el plugin ve a alguien jugando en tu clan del juego antes de que tu lista lo tenga, crea una solicitud para unirse a su nombre, y cualquier otro puede pedirlo con **Apply** en la página de tu clan. El staff responde a ambas arriba en la pestaña **Roster**, y **Who can join** decide si esperan un sí, entran al momento o no pueden pedirlo en absoluto. Quien juega un personaje que ya está en tu lista se confirma en **Needs review**. Los detalles están en [Tu gente]({peopleGuide}).',
        },
        {
          term: 'A mano',
          body: 'Admin → **People** → **+ Add Manually** acepta nombres de uno en uno, para quien juega en móvil o en el cliente oficial y no puede usar el plugin en absoluto.',
        },
      ],
      note: {
        tag: 'Los invitados no son un problema que resolver',
        body: 'Un invitado juega tus eventos sin estar en tu clan del juego: un jugador de un clan visitante, un amigo, un alt. Recibe un puesto cuando el staff aprueba su solicitud, o al momento si **Who can join** está en **Let anyone in**. Tiene seguimiento y puede entrar en eventos, y no cuenta para tu plan. Quien se une a vosotros en el juego pasa a ser miembro en la siguiente sincronización de la lista.',
      },
    },
    first: {
      title: 'Tu primer evento',
      body: [
        'El camino más corto para que pase algo: haz un tablero, añade un puñado de casillas que el plugin vea por sí solo, abre inscripciones y arranca. Los drops, los contadores de kills y la XP se registran solos a partir de ahí.',
        'Dos guías cargan con el peso aquí. [Organizar tu primer evento]({adminGuide}) va de principio a fin — Discord, equipos, lanzamiento, y qué hacer cuando termina. [Construir un tablero que se sigue solo]({boardGuide}) trata específicamente de casillas: qué puede detectar realmente cada tipo, y cuáles se importan limpiamente y luego no se disparan nunca.',
        'Si prefieres no construir ningún tablero en tu primera semana, organiza un **Skill of the Week** o un **Boss of the Week** en su lugar. Todos los de la lista entran automáticamente, la clasificación sale de los hiscores, y no hay nada que redactar.',
      ],
    },
    together: {
      title: 'Eventos entre varios clanes',
      body: [
        'Un evento no tiene por qué pertenecer a un solo clan. Varios clanes pueden llevar el mismo tablero juntos — dos, o una docena — conservando cada lado su propia lista de miembros, su propio staff y su propia mitad de la moderación.',
        'También pueden compartir un mismo grupo de jugadores en vez de sentarse en lados opuestos de una clasificación: un evento, todos dentro, se repartan como se repartan los equipos. Clan contra clan es una forma de esto, no la única.',
        'Cada clan visitante recibe un enlace de invitación por equipo, así que nunca recoges un solo RSN a mano, y un asiento que permite a su propio moderador aprobar las pruebas de sus propios miembros. [Acoger a un clan visitante]({clanVsClanGuide}) cubre cómo organizarlo.',
      ],
      note: {
        tag: 'Nada que comprar',
        body: 'Participar en el evento de otro es gratis, y organizar uno también. Un clan que solo aparece en los tableros de los demás nunca necesita más que su propio clan gratuito.',
      },
    },
    boosts: {
      title: 'Boosts del clan',
      body: [
        'Los miembros que pagan Anvil Supporter en **Champion** (un boost) o **Patron** (dos) pueden dar boost al clan desde sus propios **Settings → Clan boosts**. Un boost cuenta cuando su plaza en el clan tiene 14 días, y no cuentan más de dos de una misma persona.',
        'Ves cómo vas en Admin → **Clan settings** → **Boosts**: el nivel del clan, cuántos boosts cuentan y cuántos más necesita el siguiente nivel. El nivel 1 requiere 3 boosts, el nivel 2, 8, y el nivel 3, 15. Si los boosts caen por debajo de un nivel, sus ventajas se mantienen una semana antes de irse.',
        'El nivel 1 pone una insignia **Boosted** en la página de tu clan, en su tarjeta del Clan Hall y en la búsqueda, te coloca por encima de los clanes sin boost en el Clan Hall y le da un degradado a tu nombre. El nivel 2 añade un hueco en la fila Featured del Clan Hall, reproduce tu banner animado y desbloquea una línea de reclutamiento (**Recruiting line**): una frase, de hasta 140 caracteres, que ven los visitantes. El nivel 3 añade un Spotlight en lo alto del Clan Hall y una publicación de reclutamiento al mes en el Discord de Anvil (**Recruitment post in the Anvil Discord**), de hasta 500 caracteres, enviada una sola vez con **Post to the Anvil Discord**, con un enlace a la página de tu clan y sin mencionar a nadie.',
      ],
      note: {
        tag: 'Solo apariencia',
        body: 'Los boosts cambian cómo se ve el clan y dónde aparece listado. Nunca cambian un rango, una puntuación, tus plazas ni tu plan.',
      },
    },
    features: {
      title: 'Funciones y plan',
      intro: 'Los admins pueden activar o desactivar partes enteras de Anvil en **Features**. Al desactivarlas se ocultan de los menús; no se borra nada.',
      rows: [
        {
          term: 'Eventos',
          body: '**Skill & Boss of the Week** (activado), **formatos de tarea sorpresa** (desactivado), **Missions** (desactivado), **encuesta posterior al evento** (desactivado).',
        },
        {
          term: 'Dinero',
          body: '**Cuotas de inscripción** (activado), **Clan coffer** (desactivado).',
        },
        {
          term: 'Discord y plugin',
          body: '**Post to Discord** (activado), **mensajes de muerte y diversión** (desactivado), **Clan Hall card**, que muestra quién está en línea en tu Discord en la página pública de tu clan (activado).',
        },
      ],
      outro: '**Plan and billing** muestra tu plan, cuántos miembros tienes frente a su tamaño, y los planes más grandes. Si pagas, **Manage subscription and invoices** también está ahí.',
    },
  },

  discord: {
    metaTitle: 'Anvil en Discord — Anvil',
    metaDescription: 'Conecta el bot de Anvil a tu servidor de Discord: una invitación, los canales donde publica cada flujo, sincronización de roles y apodos, comandos slash, y qué comprobar cuando se queda en silencio.',
    eyebrow: 'Anvil · Discord',
    title: 'Anvil en Discord',
    dek: 'Un bot, una invitación, y ninguna aplicación que registrar. Esto es lo que publica, dónde lo publica, qué puede cambiar en tu servidor — y qué mirar el día que se pare.',
    facts: [
      {
        strong: 'Un bot',
        rest: 'compartido, nada que crear',
      },
      {
        strong: '~5 min',
        rest: 'de la invitación a la primera publicación',
      },
      {
        strong: 'Opcional',
        rest: 'cada flujo está apagado hasta que lo apuntas a algún sitio',
      },
    ],
    footnote: 'Todo esto vive en Admin → **Discord**: la configuración rápida arriba y luego **More settings** — Connection, What goes where, Event posts, Roles & nicknames, Team channels, Commands y Post without a bot.',
    bot: {
      title: 'Un bot, ya construido',
      body: [
        'No hay aplicación de Discord que crear, ni token que generar, ni secreto que pegar. Anvil ejecuta un bot que comparten todos los clanes, así que conectarlo es una invitación y nada más.',
        'Aun así puedes traer el tuyo — pega un token en **Use your own bot instead (advanced)** y se usará en su lugar. Solo merece la pena si quieres que el bot lleve el nombre y el avatar de tu clan en la lista de miembros; todo lo de esta guía funciona igual de cualquier modo.',
      ],
      permissions: [
        {
          term: 'Ver canales, Enviar mensajes, Insertar enlaces, Adjuntar archivos',
          body: 'Lo básico. Sin esto está en tu servidor y callado.',
        },
        {
          term: 'Gestionar webhooks',
          body: 'Para que **Set it up for me** y **Post here** puedan crear webhooks por ti en vez de que copies URLs de Discord a mano, y para que Anvil pueda encontrar webhooks antiguos que quieras quitar.',
        },
        {
          term: 'Gestionar roles',
          body: 'Solo si activas la sincronización de roles. Entonces puede repartir los roles que asocies — y nunca puede tocar un rol por encima del suyo, que es regla de Discord, no nuestra.',
        },
        {
          term: 'Gestionar apodos',
          body: 'Solo si activas la sincronización de apodos, para que el apodo de servidor de un miembro se pueda poner a su RSN.',
        },
        {
          term: 'Gestionar canales',
          body: 'Para los canales privados de cada equipo durante un draft, y para las guías publicadas como una nueva categoría o foro. Sin él, todo lo demás funciona igual.',
        },
        {
          term: 'Gestionar hilos, Enviar mensajes en hilos',
          body: 'Para las guías publicadas en un foro: escribir dentro de la publicación y volver a quitarla — sin este permiso Discord no deja que un bot borre ni su propia publicación.',
        },
        {
          term: 'Cambiar apodo',
          body: 'Solo si le das al bot el nombre de tu clan en **Connection → Bot appearance in your server**. Solo cambia el nombre del bot en tu servidor.',
        },
      ],
      note: {
        tag: 'Pide todo de una vez',
        body: 'Discord no tiene forma de pedir un permiso más tarde, así que el enlace de invitación solicita el conjunto completo, y las funciones que nunca actives nunca usan el suyo. Volver a abrir el enlace de invitación es también cómo se repara un permiso que alguien quitó.',
      },
    },
    connect: {
      title: 'Conectarlo',
      intro: 'Dos cosas, en este orden. El bot tiene que estar en tu servidor, y Anvil tiene que saber cuál es el tuyo.',
      steps: [
        {
          term: 'Invita al bot',
          body: 'Admin → **Discord** → **Connect your Discord server** (o **Add Anvil to Discord**). Discord te pregunta a qué servidor añadir Anvil y te devuelve aquí, así que no puedes añadirlo al equivocado por accidente. Más adelante, **Invite / re-invite the bot** está en **More settings → Connection**.',
        },
        {
          term: 'Pon el ID del servidor',
          body: 'Solo si el botón no puede hacerlo: abre **Can’t use the button? Enter the server ID**, haz clic derecho en el icono de tu servidor en Discord → **Copiar ID del servidor** (requiere activar el Modo desarrollador, en la sección Avanzado de los ajustes del propio Discord), pégalo en **Your Discord server’s ID** y pulsa **Save**. Este campo es lo que hace la conexión específicamente tuya.',
        },
      ],
      after: [
        'El panel te dice entonces la verdad en vez de tu intención: si el bot es realmente miembro de ese servidor, y qué permisos le faltan. Una línea verde ahí vale más que un formulario guardado.',
      ],
      note: {
        tag: 'El ID del servidor es todo el vínculo',
        body: 'Un servidor pertenece exactamente a un clan en Anvil, y los comandos slash de un servidor que nadie ha reclamado se rechazan en vez de adivinarse. Hasta que lo pongas, el bot está invitado y ocioso.',
      },
    },
    channels: {
      title: 'Configurar webhooks',
      body: [
        'Anvil publica mediante **webhooks**, uno por canal, y todos son opcionales. No se publica nada en ninguna parte hasta que apuntas un flujo a un canal — un clan recién creado está en silencio a propósito, no por accidente.',
        'Con el bot de Anvil en tu servidor, **Set it up for me**, arriba del todo en **Admin → Discord**, crea los canales y apunta todos los flujos a ellos. Para hacerlo a mano, abre **More settings → What goes where** y empieza por el **Catch-all channel** de **Clan & events**, y luego por el **In-game catch-all** de **In-game (plugin)**: elige un canal en el desplegable y se guarda. Sin el bot, abre en ese canal de Discord **Editar canal → Integraciones → Webhooks**, crea uno, copia su URL, elige **Paste a webhook…** en el desplegable, pégala y pulsa **Save**. Una URL de webhook puede publicar en su canal, así que trátala como una contraseña; si se filtra, bórrala en Discord y crea otra. **Test**, y **Add another** para repartir las publicaciones de mucho tráfico entre dos webhooks, están en **Post without a bot**.',
      ],
      feeds: [
        {
          term: 'Canal general (Catch-all channel)',
          body: 'El principal, en la pestaña **Clan & events**. Inicios y finales de evento, apertura de inscripciones, clasificaciones, resultados semanales — todo lo que el sitio publica sin un canal propio. Pon este y nada más y ya tienes un clan funcionando.',
        },
        {
          term: 'General del juego (In-game catch-all)',
          body: 'En la pestaña **In-game (plugin)**: adonde va todo lo que viene del juego y no tiene canal propio. Ponlo en segundo lugar.',
        },
        {
          term: 'Los flujos separados',
          body: 'Las publicaciones de evento, los tableros que coorganizas, Skill & boss of the week y los eventos del calendario del clan pueden separarse del canal general; los drops raros, mascotas, collection log, niveles, combat achievements, quests, diaries, muertes y kills de PvP pueden separarse del general del juego. Los cambios en la lista de miembros, las aprobaciones de inscripción y el libro de la caja están en **Staff only**. Los flujos separados que dejes vacíos vuelven a su canal general. La caja es la excepción: vacío significa que no se publica nada de dinero. Leagues y los demás modos tienen su propia pestaña **Game modes**.',
        },
      ],
      note: {
        tag: 'Separa las muertes primero',
        body: 'Las muertes son el flujo de mayor volumen en la mayoría de tableros y el que entierra todo lo demás. Si solo separas una cosa, separa esa.',
      },
    },
    roles: {
      title: 'Roles y apodos',
      body: [
        'Las dos sincronizaciones están apagadas hasta que las actives en **Admin → Discord → Roles & nicknames**, y las dos se guían por la lista de miembros. Activa **Enable Discord role sync**, deja encendido **Auto-match in-game rank → Discord role by name**, elige los **Member roles** y **Guest roles** generales que quieras, guarda y pulsa **Sync roles & nicknames now**. Cada persona también necesita tener vinculada su cuenta de Discord; el informe de sincronización nombra a quien no haya podido resolver.',
      ],
      ways: [
        {
          term: 'Sincronización de roles',
          body: 'Asocia tus rangos del juego a roles de Discord y Anvil los mantiene alineados. También hay roles sueltos para miembros, invitados, capitanes y el evento en curso, para poder mencionar a la gente correcta sin mantener una lista a mano.',
        },
        {
          term: 'Sincronización de apodos',
          body: 'Pone el apodo de servidor de un miembro a su RSN. Por defecto rellena un apodo vacío y se le puede decir que sobrescriba uno que alguien eligió — ese es el ajuste que conviene pensar antes, no después.',
        },
      ],
      note: {
        tag: 'El rol del bot debe estar por encima de los que gestiona',
        body: 'Discord no deja que ningún bot toque un rol al mismo nivel o por encima del suyo, y lo rechaza en silencio desde tu lado — la sincronización simplemente no hace nada. Sube el rol de Anvil en **Ajustes del servidor → Roles** y empieza a funcionar; no hay que reinvitar nada.',
      },
    },
    commands: {
      title: 'Comandos slash',
      body: [
        'El bot responde a `/bingo` en tu servidor (el tablero, la clasificación, las reglas, tu propio cartón) y a comandos del clan como `/sotw`, `/stats` y `/coffer`. Leen el sitio en directo, así que nadie tiene que salir de Discord para ver cómo va. [Cada comando y sus opciones]({commandsGuide}) tiene su propia página.',
        'Aparecen alrededor de un minuto después de que el bot entre. Si no aparecen nunca, la invitación concedió el bot pero no sus comandos — son dos permisos separados, y un enlace de invitación antiguo solo pedía uno. Vuelve a usar **Invite / re-invite the bot** en **Connection**, en la página de Discord; no expulsa al bot ni reinicia nada.',
      ],
      note: {
        tag: 'Responde en el idioma de cada uno',
        body: 'Por defecto el bot responde en el idioma que ese miembro tenga configurado en Discord, con el inglés como reserva. Elige un único idioma en **Idioma del bot** para imponerlo a todos — también es la única forma de tener árabe, ya que Discord no tiene idioma de cliente árabe que detectar.',
      },
    },
    posts: {
      title: 'Qué publica y cuándo',
      body: [
        'Dos fuentes, y conviene saber cuál es cuál cuando algo parece raro.',
        'El **sitio** publica eventos: un tablero que abre, inscripciones, un arranque, clasificaciones, el resultado. Salen del propio Anvil y funcionan tenga o no alguien el plugin.',
        'El **plugin** publica lo que pasa en el juego: drops, mascotas, muertes, niveles, casillas del collection log, combat achievements. Solo existen para los miembros que lo usan, así que un canal de drops en silencio suele significar un plugin en silencio, no un webhook roto.',
      ],
      note: {
        tag: 'Nada se publica dos veces',
        body: 'Un drop que completa una casilla es una publicación, no una del plugin y otra del tablero.',
      },
    },
    modes: {
      title: 'Leagues, Deadman y otros modos',
      body: [
        'Leagues, Deadman, hardcore y otros modos se juegan en sus propios mundos con sus propios personajes. Sus publicaciones siempre van etiquetadas y nunca cuentan para tableros ni competiciones. Tienen su propia pestaña: **Admin → Discord → What goes where → Game modes**. Un modo aparece ahí la primera vez que un miembro lo juega.',
        'Cada modo tiene un interruptor y un canal **To**. Activa **Send game-mode posts to their own channels** para usar esos canales; si lo dejas apagado, todos los modos publican en los canales normales, etiquetados igualmente. El botón **Posts** de la fila de un modo lista todo lo que envía — lo habitual y los eventos propios del modo — cada cosa con su propio interruptor.',
        'Bajo esa lista, los **Custom filters** hacen que un modo publique menos que el juego principal. **Post drops rarer than 1 in…** fija su propio umbral de rareza (vacío = igual que el juego principal): los objetos que siempre se publican se siguen publicando, pero los drops que solo cuentan por su valor no. **Use its own level milestones** publica una subida de nivel solo si cumple los dos conjuntos de reglas.',
      ],
      note: {
        tag: 'Más estricto, nunca más laxo',
        body: 'Los filtros de un modo solo pueden quitar publicaciones. El plugin ya ha aplicado tus ajustes del juego principal, así que nada de lo que haga un filtro de modo puede recuperar una publicación.',
      },
    },
    cleanup: {
      title: 'Webhooks antiguos de otros plugins u otros bots',
      body: [
        'Con el bot en tu servidor, la página de Discord lista todos los webhooks que hay en él y que no son de Anvil. **Coming from other plugins?** ofrece **Use the same channels**, para que **Set it up for me** publique donde lo hacían tus flujos antiguos y nada cambie para tus miembros.',
        'Cuando tus miembros ya estén en Anvil, ve a **Remove old webhooks from other plugins**, marca los que sobran y pulsa **Remove … webhooks**, y luego **Yes, remove them**. Eso los borra en Discord para siempre — no se puede deshacer.',
        'La lista incluye cualquier webhook que no sea de Anvil, no solo los de otros plugins. ¿Hay uno que quieres conservar, como el flujo de otro bot? Pulsa **Keep** y sale de la lista; **Show kept** y **Put back** lo devuelven. Conservarlo solo lo oculta aquí — en Discord no cambia nada.',
      ],
      note: {
        tag: 'Requiere «Gestionar webhooks»',
        body: 'El bot lee los webhooks de tu servidor para encontrarlos. Sin _Gestionar webhooks_ en su rol, la página dice que no puede verlos.',
      },
    },
    announce: {
      title: 'Publicar en Discord',
      body: [
        'Los admins pueden publicar como el bot desde **Post to Discord**, bajo **Clan** en el menú de administración. Elige un **Channel**, escribe el **Message** y pulsa **Send message**. Los textos largos, como un reglamento, se dividen solos en varios mensajes.',
        '**Send as an embed** está activado por defecto y añade un **Title** opcional y un **Accent colour**; desactívalo para enviar texto plano. **Ping** elige un rol, o @everyone, al que mencionar, y Anvil pregunta antes de enviar.',
        'Cada publicación que envías aparece en **Sent from here**. **Edit** la cambia en Discord sin volver a mencionar a nadie, y **Delete** la elimina.',
      ],
      note: {
        tag: 'Solo admins, con el bot',
        body: 'Publica como el bot de Anvil, así que conecta antes tu servidor. Los moderadores no lo ven. Es el interruptor **Post to Discord** en **Clan settings → Features**; si lo apagas, desaparece del menú.',
      },
    },
    quiet: {
      title: 'Cuando se queda en silencio',
      body: [
        'En orden, porque cada punto descarta el siguiente:',
      ],
      checks: [
        {
          term: '¿Está el bot realmente en el servidor?',
          body: '**Connection**, en la página de Discord, lo dice directamente. «Token válido» y «en tu servidor» son hechos distintos y el primero no implica el segundo — con un bot compartido el token siempre es válido.',
        },
        {
          term: '¿Es correcto el ID del servidor?',
          body: 'Un ID equivocado pero real se ve exactamente igual que uno correcto, hasta que notas que las publicaciones van a otra parte.',
        },
        {
          term: '¿Sigue existiendo el webhook?',
          body: 'Borrar un canal de Discord borra su webhook, y Anvil se queda con la URL muerta. Vuelve a elegirle un canal en **What goes where**.',
        },
        {
          term: '¿Está el rol del bot lo bastante alto?',
          body: 'Solo para la sincronización de roles y apodos — ver arriba. Este es el que falla en silencio.',
        },
      ],
      note: {
        tag: 'No puede dar la bienvenida a quien entra',
        body: 'Discord solo informa de las entradas por una conexión gateway, que un bot compartido no mantiene abierta para cada servidor. Por eso no hay publicación de bienvenida — pon el enlace de inscripción en un canal #roles o #empieza-aquí, que es donde la gente mira de todas formas.',
      },
    },
  },

  plugin: {
    metaTitle: 'Configurar el plugin de RuneLite — Anvil',
    metaDescription:
      'Instala el plugin de RuneLite de Anvil, inicia sesión desde su panel lateral y configura las notificaciones de Discord.',
    eyebrow: 'Anvil · plugin de RuneLite',
    title: 'Guía de configuración para jugadores',
    dek: 'Instálalo, inicia sesión y juega. El plugin envía tus drops de bingo, publica en Discord tus drops raros, tus muertes y tus hitos, y te deja buscar a cualquiera con un clic derecho.',
    facts: [
      { strong: '1 botón', rest: 'y el registro está en marcha' },
      { strong: '~3 min', rest: 'para la configuración básica' },
      { strong: 'Clic derecho', rest: 'para buscar a cualquiera' },
    ],
    footnote:
      'Las capturas son de una instalación real — el token de cuenta está tapado a propósito. El tuyo debería seguir siendo igual de privado.',

    install: {
      title: 'Instala el plugin',
      body: [
        'En RuneLite: **Configuration** (la llave inglesa) → **Plugin Hub** → busca **Anvil** → **Install**. El editor es `AhmedFathy2001`.',
        'Un único plugin sirve a todos los clanes — siempre se conecta a `anvilosrs.com`, y es el inicio de sesión (siguiente paso) lo que lo vincula a ti y a tus clanes. No hay nada específico del clan que descargar ni ninguna dirección que escribir. Una vez instalado, aparece un botón **Anvil** en la barra lateral de RuneLite, y sus ajustes están en **Configuration → Anvil**.',
      ],
    },

    connect: {
      title: 'Inicia sesión',
      intro: 'Abre el panel **Anvil** desde la barra lateral de RuneLite y pulsa **Sign in with Discord**. El navegador se abre en `anvilosrs.com`; aprueba allí el código y el plugin inicia sesión por sí solo — nada que escribir, nada que copiar y nada que rellenar en los ajustes.',
      panelFigure: {
        caption: 'RuneLite → el botón Anvil',
        alt: 'La barra de iconos de RuneLite, con el botón Anvil del final resaltado',
        legend: [
          {
            label: 'El botón Anvil',
            body: 'en el lateral de la ventana de RuneLite, al final de la barra de iconos. Haz clic para abrir el panel. Aparece en cuanto el plugin está instalado y activado — y puedes arrastrarlo hacia arriba si lo prefieres cerca de la parte superior.',
          },
        ],
      },
      signInFigure: {
        caption: 'El panel de Anvil',
        alt: 'El panel de Anvil con el botón Sign in with Discord y el sitio al que se conecta resaltados',
        legend: [
          {
            label: 'Sign in with Discord',
            body: 'solo aparece mientras este ordenador tiene la sesión cerrada. Haz clic y el resto ocurre en tu navegador.',
          },
          {
            label: 'Connects to',
            body: 'siempre `anvilosrs.com` — el único sitio con el que habla el plugin, y al que pertenece tu token.',
          },
          {
            label: 'Paste a token instead',
            body: 'la alternativa, si el paso del navegador no te funciona — mira el final de este paso.',
          },
        ],
      },
      easySteps: [
        'Pulsa **Sign in with Discord**. El panel muestra un código corto y abre el navegador en `anvilosrs.com`.',
        'Inicia sesión allí con Discord si aún no lo has hecho, comprueba que el código de la página coincide con el de RuneLite y pulsa **Approve**.',
        'De vuelta en RuneLite, la parte superior del panel dice _Signed in_ — y, en cuanto entras al juego, qué personaje está siguiendo. Listo.',
      ],
      linkFigure: {
        caption: 'anvilosrs.com → /link-device',
        alt: 'La página Link your RuneLite client, con el campo del código y el botón Approve recuadrados',
        legend: [
          { label: 'El código', body: 'tiene que coincidir con lo que el plugin te está mostrando ahora mismo.' },
          {
            label: 'Approve',
            body: 'aprueba solo un código que muestre _tu propio_ cliente. Si alguien te ha mandado un enlace o un código, recházalo — aprobarlo sería entregarle tu cuenta.',
          },
        ],
      },
      directNote: {
        tag: 'Dónde ocurre esto',
        body: [
          'Todo el flujo se queda en `anvilosrs.com` — el código se emite allí, lo apruebas allí con tu propio inicio de sesión de Discord, y el token vuelve directamente al plugin. El plugin solo abre páginas de inicio de sesión en `anvilosrs.com`, así que un enlace de inicio de sesión que apunte a otro sitio no viene de él.',
        ],
      },
      federationAside:
        'No lo confundas con **Connect clans** del panel lateral — ese es el botón aparte y opcional que te conecta con otros clanes de Anvil, y solo aparece cuando ya has iniciado sesión aquí.',
      manualFallback:
        'Si el navegador no se abre solo, el panel imprime la dirección y el código para que lo abras a mano. Los códigos caducan a los diez minutos — simplemente vuelve a pulsar el botón.',
      manualHeading: 'Plan B: pega tu token a mano',
      manualIntro:
        'Si iniciar sesión desde el plugin no te funciona, copia tu token aquí abajo (o desde [Profile → plugin token](/profile#plugin-token), donde también puedes rotarlo), luego pulsa **Paste a token instead** debajo del botón de inicio de sesión en el panel de Anvil y pégalo ahí.',
      tokenFigure: {
        caption: 'Profile → RuneLite plugin',
        alt: 'La tarjeta RuneLite plugin en la página de perfil, con el campo del token y los botones Reveal, Copy y Rotate recuadrados',
        legend: [
          {
            label: 'Tu token',
            body: 'oculto hasta que pulsas Reveal. En esta captura está tapado a propósito; no publiques nunca el tuyo en Discord.',
          },
          {
            label: 'Copy / Rotate',
            body: 'cópialo y luego usa **Paste a token instead** en el panel de Anvil. Rotate emite uno nuevo y mata el antiguo — úsalo si alguna vez sospechas que tu token se ha filtrado.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Usa el panel lateral a diario',
        body: ['**El panel lateral de Anvil es tu espacio de trabajo principal**: inicia y cierra sesión allí, consulta tus clanes y eventos activos, explora y reclama casillas, sigue el progreso, toma capturas iniciales, ejecuta sincronizaciones y abre las herramientas de soporte. **Configuration → Anvil**, que se muestra abajo, es solo para preferencias — no hay ningún token ahí. Para cerrar la sesión en este ordenador, abre el menú **⋯** junto a tu nombre en la parte superior del panel. Un solo inicio de sesión cubre todos los eventos en los que estás inscrito — no tienes que repetirlo para cada bingo.'],
      },
    },

    accounts: {
      title: 'Vincula tus cuentas',
      body: [
        'Con el token configurado, las cuentas con las que juegas aparecen automáticamente en tu perfil. Una cuenta nueva puede vincularse de inmediato; una que ya figura en la lista de un clan necesita primero una comprobación de propiedad, porque un nombre público de RuneScape no demuestra quién es su dueño.',
        'Para el primer vínculo, usa [la comprobación rápida por XP](/profile#link-account) o pide a un moderador del clan que apruebe la cuenta en [cuentas detectadas](/profile#detected-accounts). Después, la huella estable sigue los cambios de nombre y reconoce la cuenta automáticamente.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'La tarjeta RuneScape Accounts en la página de perfil, listando las cuentas verificadas mediante el plugin',
        legend: [
          {
            label: 'Tus cuentas vinculadas',
            body: 'todo lo marcado «Verified via plugin» está vinculado y se reconocerá automáticamente. Las cuentas que ya están en un clan pueden pedir antes una comprobación única por XP o por un moderador.',
          },
        ],
      },
      noPluginHeading: '¿No puedes usar el plugin?',
      noPluginIntro:
        'En móvil o en el cliente oficial, usa [Profile → account linking](/profile#link-account):',
      noPluginOptions: [
        '**Verify by XP** — escribe tu RSN, el sitio elige una habilidad al azar, y tienes que ganar 1.000 XP en ella en 30 minutos.',
        '**Manual review** — para Hiscores ocultos o cuentas secundarias recién creadas: envía tu RSN con una nota y un moderador lo aprueba.',
      ],
      signupNote:
        'Inscribirse en un evento exige al menos una cuenta verificada, así que resuélvelo antes de apuntarte.',
    },

    working: {
      title: 'Comprueba que funciona',
      intro:
        'Inicia sesión y lee tu ventana de chat. El plugin te saluda cuando está conectado y hay un evento en marcha.',
      chat: [
        { text: 'Bingo running: Summer Bingo 2026.', tone: 'gold' },
        { text: 'Skill of the Week is live: Runecraft.', tone: 'gold' },
        { text: '…más tarde, según van pasando cosas…', tone: 'muted' },
        { text: 'Tracked drop detected: Dragon warhammer (1/1)', tone: 'plain' },
        { text: 'Tracked kill: Zulrah (7/10)', tone: 'plain' },
      ],
      outro:
        'También deberías ver el **panel lateral de Anvil** llenarse con tus clanes, tus eventos en curso, tu puesto y los botones de sincronización — y aparecer un botón **Anvil** en la barra de título de tu Collection Log dentro del juego.',
      guestNote: {
        tag: 'Invitado o miembro',
        body: 'Si el chat dice _Tracked as a guest_, se te está registrando pero aún no estás en la lista de miembros del clan. Un admin lo arregla sincronizando la lista desde el juego — pregunta {discordLink}.',
        discordWord: 'en Discord',
      },
      panelHeading: 'El panel lateral',
      panelBody: [
        'Cuatro pestañas y un engranaje. **Clan** son tus eventos y tu clan: cada bingo y competición semanal en curso o próxima con tu posición. **Feed** son los grandes momentos de tu clan y de tus tableros según ocurren, con el chat de eventos. **You** es tu propio perfil, y **Lookup** encuentra el de cualquier otro, jugador o clan. El engranaje guarda la sincronización y los sonidos de tu banner.',
        'Cada pestaña, el chat de eventos, las reacciones y los ajustes que llevan el feed y los colores de Supporter a tu juego están en [El panel lateral, pestaña a pestaña]({panelGuide}).',
      ],
      panelFigure: {
        caption: 'Clan · You · Lookup',
        alt: 'Las tres pestañas del panel lateral de Anvil una junto a otra: la pestaña Clan con eventos y la semana del clan, la pestaña You con tu Collection Log y la pestaña Lookup con la tarjeta de otro jugador',
      },
      lookupHeading: 'Busca a cualquiera',
      lookupBody:
        'Haz clic derecho en un jugador — a tu lado, o por su nombre en el chat, tu lista de amigos o el panel del clan — y elige **Anvil** para abrir su tarjeta en la pestaña **Lookup** del panel lateral. La tuya es la pestaña **You**.',
      lookupFigure: {
        caption: 'Clic derecho en un nombre → Anvil',
        alt: 'El menú de clic derecho de un jugador en el juego con una entrada Anvil bajo Lookup',
      },
      lookupSettingNote:
        'Elige dónde aparece la entrada **Anvil** en **Player lookup**, en los ajustes del plugin. Sobre un nombre en el chat nunca es la opción del clic izquierdo, así que hacer clic en un nombre sigue haciendo lo que hace el juego.',
      lookupSettingFigure: {
        caption: 'Configuration → Anvil → Player lookup',
        alt: 'La sección Player lookup de los ajustes de Anvil, con cada ajuste recuadrado y numerado',
        legend: [
          {
            label: 'Anvil lookup on players',
            body: 'el interruptor general. Desactivado, oculta la entrada en todas partes.',
          },
          {
            label: 'Players in the world',
            body: 'al hacer clic derecho sobre un jugador que está cerca de ti.',
          },
          {
            label: 'Chatbox and private messages',
            body: 'los nombres en el chat y en los mensajes privados.',
          },
          {
            label: 'Clan panels / Friends chat / Friends, ignore and party lists',
            body: 'las listas de nombres: los miembros de tu clan y del clan invitado, el canal de friends chat, tus listas de amigos e ignorados y el panel del grupo de raid.',
          },
        ],
      },
    },

    bingo: {
      title: 'Ajustes del bingo',
      intro:
        'Solo importan mientras estás en un evento. Los valores por defecto están bien — esto es lo que hace realmente cada uno.',
      figure: {
        caption: 'Configuration → Anvil → Bingo',
        alt: 'La sección Bingo de los ajustes del plugin, con cada ajuste recuadrado y numerado',
        legend: [
          {
            label: 'Show Overlay',
            body: 'dibuja un pequeño panel de _Anvil / equipo / fecha UTC_ arriba a la izquierda. Pasa a formar parte de la imagen en tus capturas de prueba, y es justo eso lo que hace difícil falsificar o antedatar una prueba. En esta captura está apagado — actívalo si tu clan quiere ver el equipo y la hora en cada prueba.',
          },
          {
            label: 'Team completion popups',
            body: 'un cartel cuando alguien de tu equipo completa una casilla. Varias a la vez: la más difícil se lleva el cartel, el resto va al chat.',
          },
          {
            label: 'My tile popups',
            body: 'un aviso cuando un drop tuyo hace avanzar una casilla o la completa. Desactivado, sigue registrando — solo que en silencio.',
          },
          {
            label: 'Banner sound + volume',
            body: 'reproduce un sonido con el banner. No suena nada hasta que añadas al menos un .wav tú mismo, con **Add clip** bajo “Banner sounds” en el panel lateral de Anvil. Las misiones tienen su propia carpeta: añade un clip en **Mission sounds** y sonará en lugar del tono integrado que evita que se confundan con una casilla completada.',
          },
          {
            label: 'Auto starting shot',
            body: 'toma por ti la foto de salida de un evento en cuanto te pones en su punto fijado. Desactivado, pulsas tú **Take starting shot** en el panel lateral.',
          },
        ],
      },
      teamsHeading: 'Equipos',
      teamsBody:
        'El botón **Teams** de un evento lista sus equipos por clasificación, con el tuyo arriba. Abre uno para ver su plantilla, con el capitán primero, o busca a un jugador en todos los equipos — haz clic en un nombre para buscarlo.',
      teamsFigure: {
        caption: 'Event → Teams',
        alt: 'La página Teams con los equipos de un evento, sus puntos y su número de miembros, junto a la plantilla de un equipo con su capitán primero',
      },
      startHeading: 'Foto de salida',
      startBody: [
        'Algunos eventos piden a todo el mundo una **foto de salida**: una captura tomada después de que el evento arranque, en un lugar sorteado en el instante del inicio. Impide que nadie se pase la semana previa acumulando clues, cofres y kills para soltarlos el primer día.',
        'Si usas el plugin no hay nada que preparar. Al empezar el evento recibes una línea de chat que te dice adónde ir, y el panel lateral de Anvil muestra un botón **Take starting shot**. Colócate donde dice, púlsalo una vez, y listo — el plugin captura la imagen, le estampa tu RSN, tu equipo, el lugar y una palabra clave que solo recibe tu cuenta, y la archiva por ti.',
        'Comprueba dos cosas antes de archivar nada, para que las arregles dentro del juego en lugar de en una discusión de Discord después. Si el anfitrión fijó el sitio en el mapa, el plugin sabe a qué distancia estás y te lo dice, en vez de enviar una foto desde el otro extremo de Gielinor. Y si el evento exige una sesión fresca, tienes que **cerrar sesión y volver a entrar** antes de tomarla: tus hiscores solo se guardan al cerrar sesión, así que volver a entrar justo antes de la foto es lo que hace correctos tus totales de partida — y, por tanto, cada casilla de XP y KC.',
        'En móvil, o sin el plugin: abre **My Team** en este sitio, lee tu palabra clave en la tarjeta de la foto de salida, escríbela en el chat del juego, haz una captura donde se vean tu personaje y la palabra clave, y súbela en esa misma tarjeta. Esa subida cuenta de inmediato — puedes jugar en cuanto entre, y el equipo la revisa después. Cierra sesión y vuelve a entrar primero si la tarjeta te lo pide.',
      ],
    },

    notifications: {
      title: 'Notificaciones de Discord',
      intro:
        'Estas se envían haya bingo en marcha o no, y se publican en los canales del clan. En qué canal lo deciden aquí los administradores — tú solo eliges _qué_ publicas. En la próxima actualización del plugin estas opciones pasan a la web, en **Settings → Discord posts & screenshots**, y te siguen en cualquier ordenador. En esa misma página, **Screenshot privacy** elige qué chat (mensajes privados, chat público, chat del clan) se oculta en cada captura que hace el plugin. El plugin conserva dos interruptores en **Notifications**: **Share clan posts** pausa de golpe todas las publicaciones del juego principal, y **Share seasonal activity** hace lo mismo en Leagues, Deadman y otros mundos de temporada.',
      examplesFigure: {
        caption: 'Así se ve una publicación',
        alt: 'Dos publicaciones de Discord de Anvil: una tarea de combate Grandmaster con sus puntos y el progreso hasta el siguiente desbloqueo, y una muerte con su mensaje, cada una con una captura del momento',
      },
      dropsFigure: {
        caption: 'Deaths & kills · Drops & pets',
        alt: 'Las secciones de notificación Deaths and kills y Drops and pets, con cada ajuste recuadrado y numerado',
        legend: [
          {
            label: 'Notify on death',
            body: 'publica en el canal de muertes del clan, con una captura del momento en que moriste.',
          },
          { label: 'Death message', body: 'tu propia frase. `{name}` se sustituye por tu RSN.' },
          {
            label: 'Notify on PvP kill',
            body: 'una captura del tick en que tu objetivo llega a 0 PV. Desactivado por defecto; activado aquí.',
          },
          { label: 'Notify on rare drops', body: 'el interruptor principal de las publicaciones de drops.' },
          {
            label: 'Min drop value / Min drop rarity',
            body: 'un drop se publica cuando vale al menos esta cantidad (GE o high alch, lo que sea mayor) o es más raro que 1 entre N. Anvil empieza en 1m y 1/1,000. Tu clan puede fijar sus propios valores por defecto para sus miembros, y hasta que pongas un número tú mismo sigues el de tu clan; **Restablecer al valor del clan** (o **Restablecer al valor de Anvil** si no tienes clan) vuelve a seguirlo. Un clan también puede fijar un mínimo de rareza estricto para sus propios canales, por debajo del cual tu número no puede bajar. Pon cualquiera de los dos números a 0 para apagarlo.',
          },
          {
            label: 'Valor y rareza juntos',
            body: 'por defecto, un drop se publica cuando cumple el valor **o** la rareza. Activa **Exigir ambos** y debe cumplir el valor **y** la rareza. Tu clan puede elegir este valor por defecto para sus miembros; hasta que elijas, lo sigues, y sin clan es uno u otro. Cada uno de tus propios webhooks también puede fijar su propio valor mínimo, rareza y uno/ambos; lo que deje en blanco sigue tus ajustes.',
          },
          {
            label: 'Loot key value',
            body: 'una loot key se publica una vez, como una sola notificación, cuando todo su contenido supera esta cifra.',
          },
          { label: 'Notify on pets', body: 'las mascotas van al canal de drops raros.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · collection log · levels · diaries · quests',
        alt: 'La sección de notificación Combat achievements, con cada ajuste recuadrado y numerado',
        legend: [
          {
            label: 'CA post tier',
            body: 'el nivel de tarea más bajo que se publica; los niveles completados también se publican. Por defecto es Master; Grandmaster publica solo las más raras, **Off** no publica ninguna. Las casillas de CA del bingo cuentan igualmente.',
          },
          {
            label: 'Notify on collection log slots',
            body: 'cada hueco nuevo del collection log.',
          },
          {
            label: 'Notify on level milestones',
            body: 'las subidas de nivel que tu clan ha decidido anunciar — por defecto los 99, cada 100 niveles totales desde 1800, y el máximo. Los admins de tu clan ponen las reglas; tú puedes publicar menos (o poner tus propias reglas para tus webhooks personales) desde Announcements en tu perfil.',
          },
          {
            label: 'Notify on diary completions',
            body: 'niveles de achievement diary, con una captura.',
          },
          {
            label: 'Quest post tier',
            body: 'misiones desde la dificultad que elijas hacia arriba, de All (todas) hasta Grandmaster; **Off** no publica ninguna. Por defecto es Master. Las casillas de misiones del bingo cuentan igualmente.',
          },
        ],
      },
    },

    trouble: {
      title: 'Cuando algo se rompe',
      intro:
        'El plugin te avisa por chat cuando el registro se ha parado — espera unos 90 segundos antes de quejarse y se repite como mucho cada 5 minutos.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'El token es incorrecto o se ha rotado. Abre el menú **⋯** en la parte superior del panel de Anvil, pulsa **Sign out** y después **Sign in with Discord** de nuevo — o usa **Paste a token instead** con un token nuevo desde [Profile → RuneLite plugin](/profile#plugin-token).',
        },
        {
          term: '`Anvil: can’t reach the site (anvilosrs.com) — tracking is OFF.`',
          body: 'El plugin no consigue llegar a `anvilosrs.com`. Revisa tu conexión a internet y cualquier cortafuegos o VPN que pueda estar bloqueando RuneLite. Si todo eso está bien, el sitio probablemente esté caído un momento — el plugin se vuelve a conectar solo.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Esa cuenta aún no está vinculada. Abre [Profile → cuentas detectadas](/profile#detected-accounts) para añadirla o iniciar la comprobación de propiedad.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Nada. Se ha recuperado solo.',
        },
        {
          term: '“<RSN> belongs to another Anvil player”',
          body: 'Otra persona vinculó este personaje en Anvil primero, así que nada cuenta para él desde tu sesión. Si de verdad es tuyo, pulsa **This is my account** en la pestaña **You** del panel y pasa la comprobación rápida de XP. Después se pregunta al propietario actual, o decide el staff de Anvil. Nunca sabrás quién es. Sigue la solicitud en [Settings → Ownership claims](/settings/claims).',
        },
      ],
      logHeading: '¿Sigues atascado? Manda un registro a un admin',
      logBody:
        'Envía a un admin tu log de RuneLite: `client.log`, en la carpeta `.runelite/logs` de tu carpeta de usuario (en Windows, pega `%USERPROFILE%\\.runelite\\logs` en la barra de direcciones del Explorador). El plugin escribe ahí lo que vio y por qué, así que podrá ver exactamente qué falló.',
      missingNote: {
        tag: '¿Faltan pruebas?',
        body: 'Las mascotas y los Champion’s scrolls repetidos necesitan una captura manual. El plugin la hace por ti y la guarda en `.runelite/osrs-bingo-pending/` — **Copy folder path** en el panel lateral de Anvil abre la carpeta — así la adjuntas en la web en vez de buscar una imagen después.',
      },
    },
    limits: {
      title: 'Limitaciones conocidas',
      intro:
        'Hay cosas que no se pueden registrar a la perfección — casi siempre por lo que informa el propio juego, no Anvil. La solución es siempre la misma: haz una captura de pantalla y envíala manualmente.',
      rows: [
        {
          term: 'El barraging y otras muertes a varios objetivos',
          body: 'Los recuentos de kills (KC) salen de lo que el juego informa por cada muerte, y los hechizos de varios objetivos como Ice Barrage hacen que se le escapen algunas, así que **el KC puede salir más bajo** de lo que has matado. El Loot Tracker de RuneLite también cuenta de menos igual — es un límite del motor del juego, no un fallo de Anvil.',
        },
        {
          term: 'Combat achievements que ya hiciste antes',
          body: 'Activa **repeat completion** en los ajustes de Combat Achievements del juego. Sin ello, el juego no anuncia una tarea que ya completaste, y el plugin solo puede acreditar lo que el juego anuncia.',
        },
        {
          term: 'El combat achievement del contrato de Yama',
          body: 'El juego no lo vuelve a anunciar ni siquiera con repeat completion activado, así que el plugin nunca lo ve. Haz una captura de pantalla y envíala manualmente.',
        },
        {
          term: 'Casillas de recolección sin el plugin',
          body: 'Las cantidades de objetos — un número de peces, minerales, troncos — no están en los hiscores, así que solo las registra el plugin. Sin él, haz una captura de cada inventario; o, si el objeto aparece en el Loot Tracker, una captura reiniciado a 0 al principio y otra al final.',
        },
        {
          term: 'Implings, peces, minerales y otras ganancias de objetos',
          body: 'Capturar implings y recolectar objetos (peces, minerales y cualquier otra cosa que se cuente por lo que llega a tu inventario) **a veces no se registra bien, incluso con el plugin**. Guarda capturas de pantalla sobre la marcha, y si un recuento parece corto, avísalo y envía la diferencia manualmente.',
        },
        {
          term: 'Barriles de peces, cestas de troncos y otros almacenes',
          body: 'Las casillas de objetos obtenidos solo cuentan lo que llega a tu inventario **directamente de la fuente**: un punto de pesca, una roca, un árbol. Todo lo que sale de un almacén (vaciar un barril de peces, una cesta de troncos, una bolsa de carbón o de gemas, un saco de hierbas), se compra en una tienda, se retira del banco o se recoge del suelo **no cuenta**. Así la casilla es justa: si no, el mismo pez podría meterse en un barril y sacarse una y otra vez. Lo que recoges directamente en un barril o cesta no se cuenta.',
        },
        {
          term: "Mascotas y champion's scrolls duplicados",
          body: 'Cuando ya tienes la mascota o el scroll, el juego solo dice que tienes un **“funny feeling”** — nunca dice cuál. El plugin lo deduce de lo que acabas de matar o entrenar, acredita la casilla y **la marca para que el staff la revise**. Si no puede saberlo — dos mascotas de la misma fuente, o una mascota sin una muerte o habilidad detrás (Bloodhound de un master clue, una mascota de Jad o Zuk apostada, Chompy chick) — guarda la captura en **Saved proofs** para que la envíes manualmente.',
        },
      ],
    },
    screen: {
      title: 'En pantalla mientras juegas',
      intro: 'Lo que dibuja e imprime el plugin mientras juegas, y el ajuste detrás de cada cosa.',
      rows: [
        {
          term: 'Casillas fijadas',
          body: 'abre una casilla en el panel lateral y pulsa **Track on screen** (hasta 3). Con **Pinned tiles in one panel** activado, comparten un panel pequeño: el nombre de cada casilla, el progreso de tu equipo y líneas como _3/5 runs_ o qué partes de un combo están hechas. Desactivado, cada una tiene su propio widget más grande con tus compañeros y los otros equipos. Arrastra con Alt para moverlo. Haz clic derecho para **Unpin** o **Unpin all**. Una casilla terminada muestra **Done** y se desancla sola.',
        },
        {
          term: 'La tarjeta de la foto de salida',
          body: 'mientras un evento espera tu foto de salida, una tarjeta **Starting shot needed** arriba de la pantalla te dice adónde ir y muestra cada comprobación en verde o rojo: el relog, cuánto lleva tu sesión, a cuántos cuadros estás del punto. Una flecha de pista y un marcador en el mapa del mundo (**Anvil starting shot**) te llevan allí. Con **Auto starting shot** activado, la foto se toma en cuanto todo está en verde; entonces la tarjeta dice **You’re tracked** y se va. Ajuste: **Starting shot guide**.',
        },
        {
          term: 'Banners',
          body: '**Tile complete!** cuando tu equipo termina una casilla, tu propio progreso de drop en una casilla, y **New mission!**. Ajustes: **Team completion popups** y **My tile popups**.',
        },
        {
          term: 'Tiradas de vestigio',
          body: 'en los jefes de Desert Treasure II, cada único imprime una línea con dónde estás en la rotación de vestigios, como _Roll 2 of 4_ o _the next unique is the vestige_. Dice _(estimated)_ hasta que te haya visto conseguir un vestigio. No tiene ajuste; funciona con o sin evento.',
        },
        {
          term: 'Autocompletado de Lookup',
          body: 'al escribir en el cuadro **Lookup** se completa el nombre por ti, a partir de tus búsquedas recientes, amigos, miembros del clan en línea y jugadores cercanos. **Enter** lo acepta. Lee solo tu propio cliente; no se envía nada.',
        },
        {
          term: 'Colores del chat',
          body: '**[Anvil] tag colour** y **Message colour** bajo **Chat messages**. Hasta que elijas, pasan a dorado oscuro y negro en un chatbox opaco para que se lean bien. Pasa el cursor sobre el nombre de un Supporter en el chat para ver su nivel, como _Anvil Patron_.',
        },
      ],
    },
    sync: {
      title: 'Sincronización del perfil, y lo que más envía',
      intro: 'Los ajustes de **Profile sync** rellenan tu perfil de Anvil. Los cuatro están activados al empezar:',
      rows: [
        {
          term: 'Sincronizar el collection log',
          body: 'cada página del collection log que abres se envía a tu perfil.',
        },
        {
          term: 'Sincronizar todo el log al abrir',
          body: 'abrir el collection log envía todo, no solo la página que miras. Para hacerlo a mano, pulsa el botón **Anvil** en la barra de título del collection log, o **Sync profile** en el panel lateral mientras el log está abierto. El chat lo confirma: _Profile synced — N collection log slots._',
        },
        {
          term: 'Sincronizar mejores marcas personales',
          body: 'los tiempos de jefes y raids se envían en cuanto los registras.',
        },
        {
          term: 'Importar las mejores marcas existentes una vez',
          body: 'una vez por personaje, copia las mejores marcas personales que RuneLite ya guardó en tu ordenador: _Imported N personal best(s) from RuneLite._',
        },
        {
          term: 'Compartir momentos destacados con el clan',
          body: 'tus mascotas, drops grandes, muertes, tareas de combate, hitos de nivel, nuevas casillas del log y diarios aparecen en el feed de la web pública de tu clan, y en el feed del chat de los jugadores que pueden verlos.',
        },
      ],
      outro: 'Otras tres cosas se envían sin ajuste propio. **Quién te mató**: el monstruo o jugador que te tenía como objetivo en tus últimos 15 segundos aparece nombrado en el feed. **Contadores del juego**: algunas casillas de kills cuentan un número que lleva el juego, como los puntos de Tithe Farm, la reputación de Giants’ Foundry, los delves de Doom o las rachas de slayer; solo se envían los aumentos. **Leagues, Deadman y otros modos**: en esos mundos se envían las líneas propias del juego sobre reliquias, zonas y tareas para que tu clan las publique en su canal de modo.',
    },
  },

  admin: {
    metaTitle: 'Cómo organizar tu primer evento — guía de admin de Anvil',
    metaDescription:
      'Monta un clan en Anvil y lleva un bingo de principio a fin: Discord, lista de miembros, tableros, casillas, equipos y draft, arranque, y qué pasa cuando el evento termina.',
    eyebrow: 'Anvil · para el equipo del clan',
    title: 'Cómo organizar tu primer evento',
    dek: 'El camino entero, en el orden en que lo vas a recorrer de verdad: dejar {clanName} configurado, meter la lista de miembros, montar un tablero, repartir equipos por draft, arrancarlo todo, y repartir los premios. Como una tarde de trabajo para el primer bingo — minutos para el segundo.',
    facts: [
      { strong: '5 pasos', rest: 'en la lista de configuración' },
      { strong: '7 formatos', rest: 'para montar un tablero' },
      { strong: '1 botón', rest: 'para sincronizar la lista de miembros' },
    ],
    footnote:
      'Esta guía sigue la aplicación tal y como está hoy. Si una pantalla de aquí no cuadra con lo que tienes delante, la aplicación tiene razón y la guía está desfasada — [dínoslo](/feedback) y la arreglamos.',

    access: {
      title: 'Quién puede hacer qué',
      intro:
        'Todo el mundo entra con Discord — no hay contraseñas. El primer admin es el propietario, quien creó el clan; a partir de ahí, un admin asciende a los demás desde **People → Staff & roles**. Los roles se apilan hacia abajo: todo lo que puede un moderador lo pueden también un tesorero y un admin.',
      rows: [
        {
          term: 'Admin',
          body: 'acceso completo — eventos, casillas, equipos, ajustes, equipo, pagos. Dáselo a tan poca gente como el clan pueda soportar.',
        },
        { term: 'Treasurer', body: 'todo lo que puede un moderador, más las cuotas de inscripción y los pagos.' },
        {
          term: 'Moderator',
          body: 'el día a día: lista de miembros, verificaciones, pruebas por revisar, competiciones semanales, el calendario y los eventos del clan. No puede crear ni editar eventos.',
        },
        {
          term: 'Editor',
          body: 'solo crear casillas. Dalo de forma global, o acótalo a tableros concretos para que un montador invitado solo toque el evento que le has dado.',
        },
        { term: 'Member', body: 'juega; no ve ninguna interfaz de administración.' },
      ],
      seeAlso:
        'Dos de esos roles tienen página propia: [De guardia]({moderatorGuide}) sobre lo que un moderador hace realmente con su tarde, y [Cuotas y premios]({feesGuide}) para el tesorero.',
      ownerNote: {
        tag: 'Propietario',
        body: 'Una cuenta es la propietaria. Nadie más puede degradarla, y es el único rol que puede traspasar la propiedad — así que perder una discusión con otro admin nunca puede costarte el clan.',
      },
    },

    setup: {
      title: 'Nombra el clan, conecta Discord',
      intro:
        '**Settings → Finish setup** es un asistente breve (sigue en el menú hasta que termines), y el panel mantiene una lista de tareas de cinco pasos hasta que estén hechos: nombrar el clan, conectar Discord, cargar tus miembros, crear un evento, añadir casillas. El estado se calcula con datos reales, así que un paso solo se marca cuando está genuinamente terminado.',
      discord:
        'Para Discord tienes dos vías, y se combinan: dale a Anvil un **bot** y podrá crear webhooks, sincronizar roles y apodos, y montar canales privados de equipo; dale una sola **URL de webhook** y podrá publicar anuncios y nada más. Empieza por el webhook si quieres estar en marcha en dos minutos, y añade el bot cuando quieras la automatización.',
      permsNote: {
        tag: 'Permisos del bot',
        body: 'El bot necesita _Gestionar webhooks_, _Gestionar roles_, _Gestionar canales_ y _Gestionar apodos_, y su rol debe estar _por encima_ de los roles que gestiona en la lista de roles de tu servidor. Si no, Discord se niega en silencio.',
      },
      hosted:
        'En un plan alojado ya viste esa pantalla una vez: añadir el bot durante la configuración fue como Anvil supo qué servidor es el vuestro, así que nunca hubo un ID de servidor que copiar. El mismo enlace está aquí cuando quieras mover el bot a otro servidor.',
    },

    channels: {
      title: 'Reparte las publicaciones entre canales',
      body: [
        'Por defecto todo va a un único canal general. Cuando se vuelva ruidoso, abre **Discord → What goes where** y dale casa propia a las categorías escandalosas — publicaciones de evento, competiciones semanales, drops raros, muertes, kills de PvP, combat achievements. Todo lo que dejes vacío vuelve a su canal general, así que puedes separar una categoría cada vez.',
        'Con el bot conectado nunca tocas una URL de webhook: elige un canal en el desplegable de la fila y se guarda. En un evento cargado puedes añadir un segundo webhook con **Add another**, en **Post without a bot** — Anvil alterna entre ellos para que el límite de ritmo de Discord no se trague publicaciones.',
      ],
      clipsNote: {
        tag: 'El canal de clips es distinto',
        body: 'Los vídeos de clips se suben directamente del PC de cada jugador a Discord — nunca pasan por este sitio. Por eso el webhook de clips que configuras aquí es el que _repartes_: los miembros lo pegan ellos mismos en su plugin. Todo lo demás de esta página ocurre en el servidor, y los miembros no lo ven nunca.',
      },
    },

    roster: {
      title: 'Mete tu lista de miembros',
      body: [
        'La pertenencia al clan viene de un único sitio: una sincronización de la lista desde el juego. Instala [el plugin de RuneLite de Anvil]({pluginGuide}) en la cuenta de un _admin_, abre la ventana del clan en el juego y pulsa el botón **Anvil** de su barra de título. Eso empuja vuestra lista real del clan desde el juego al sitio con un clic.',
        'Iniciar sesión, vincular un personaje o jugar con el plugin nunca mete a nadie en la lista. Si el plugin ve a alguien jugando en vuestro clan del juego antes de que la lista lo tenga, crea una solicitud para unirse; cualquier otro puede pedirlo con **Apply** en la página de vuestro clan. El staff responde a las solicitudes arriba en **People → Roster**, y **People → Who can join** decide si la gente espera un sí, recibe un puesto de invitado al momento o no puede pedirlo en absoluto. Es deliberado: nadie entra en vuestro clan escribiendo su nombre. Tienes el panorama completo en [Tu gente]({peopleGuide}).',
        'También puedes añadir a alguien a mano desde **People → + Add Manually**, e inscribirlo en un evento en su nombre con **Add member** en la página **Sign-ups** del evento cuando no pueda llegar al sitio.',
      ],
    },

    board: {
      title: 'Crea tu primer tablero',
      intro:
        '**Events → All events → + New event**. Elige primero un formato — decide cómo puntúa el tablero y qué te va a pedir el resto del formulario.',
      formats: {
        classic: {
          label: 'Bingo clásico',
          blurb: 'Una cuadrícula cuadrada N×N — los equipos hacen las casillas en el orden que quieran, cada una vale 1.',
        },
        leagues: {
          label: 'Bingo Leagues',
          blurb: 'Una lista de tareas donde cada casilla lleva su propio valor en puntos — tantas casillas como quieras.',
        },
        race: {
          label: 'Carrera de casillas',
          blurb: 'Un recorrido ordenado — los equipos alcanzan las casillas en secuencia; gana quien llega más lejos. El anfitrión puede ramificarlo en rutas que se separan y se unen: la casilla que completas elige tu camino.',
        },
        showdown: {
          label: 'Showdown',
          blurb:
            'Las casillas siguen ocultas hasta su momento programado — fija cada revelación en la pestaña Tiles. Por puntos, al estilo DMM All Stars.',
        },
        luckydraw: {
          label: 'Sorteo',
          blurb: 'Un cantador de bingo: las casillas ocultas se abren en sorteos aleatorios a intervalos fijos. Por puntos.',
        },
        bounty: {
          label: 'Caza de recompensas',
          blurb:
            'Una sola casilla abierta a la vez — el primer equipo que la termina se lleva los puntos, y se sortea la siguiente recompensa.',
        },
        ladder: {
          label: 'Escalera',
          blurb:
            'Una lista de tareas por puntos ordenada como clasificación individual (equipos opcionales). Las tareas rotan — progresivamente, de una en una, o en una ventana deslizante — y pueden perder valor. Al estilo de una escalera mensual.',
        },
      },
      outro:
        'Luego fija las fechas, la ventana de inscripción, y si inscribirse cuesta una cuota. Empieza desde una plantilla si prefieres no partir de una cuadrícula vacía — la galería contiene tanto las plantillas integradas como cualquier tablero que hayas guardado antes como plantilla.',
      seeAlso:
        'El formato es solo la mitad de la decisión — cómo se vuelven jugables las casillas es la otra mitad, y las dos se combinan. Ambas al completo: [Formatos, y cómo se abren las casillas]({formatsGuide}).',
      utcNote: {
        tag: 'Las fechas son UTC',
        body: 'Cada marca de tiempo en Anvil se guarda y compara en UTC, y se muestra en la hora local de cada visitante. Fija la hora de fin que quieres decir; el sitio le enseñará a un británico y a un australiano dos relojes distintos para el mismo instante.',
      },
    },

    tiles: {
      title: 'Rellena el tablero',
      body: [
        'La página **Board & tiles** del evento es donde un tablero se convierte en bingo. Cada casilla es un _tipo_ de tarea, y el tipo decide qué vigila el plugin: un drop, un contador de kills de jefe, XP de habilidad, un kill de PNJ, un tiempo a batir, un achievement diary, un Combat Achievement, un desbloqueo del collection log, un kill de PvP, una ganancia de objeto, o una run sin muertes. Las casillas manuales — las que una persona valida a partir de una captura — también son siempre una opción.',
        'Para un tablero completo, créalas en bloque: exporta la hoja, rellénala en una hoja de cálculo, e impórtala de vuelta. CSV y .xlsx van en los dos sentidos, y las filas siguen a las posiciones, así que puedes reescribir una cuadrícula entera de 25 casillas con un solo pegado.',
      ],
      rows: [
        {
          term: 'Niveles de dificultad',
          body: 'los valores en puntos se traducen a bandas con nombre (easy → elite). Edita las bandas en **Clan settings → Rules & scoring → Difficulty & balance** si tu clan clasifica de otra manera.',
        },
        {
          term: 'Auditor de equilibrio',
          body: 'revisa un tablero terminado buscando problemas de estructura y esfuerzo descompensado antes de que los jugadores lo vean siquiera.',
        },
        {
          term: 'Oculto hasta revelar',
          body: 'los tableros nuevos empiezan ocultos. El equipo siempre los ve; los jugadores no ven nada hasta que reveles — así que un tablero se puede montar a la vista sin destriparlo.',
        },
      ],
      seeAlso:
        'Qué tipo elegir, cómo escribir doscientas en una hoja de cálculo, y los errores que se importan limpios y luego nunca saltan: [Monta un tablero que se registra solo]({boardGuide}).',
    },

    teams: {
      title: 'Equipos y draft',
      body: [
        'La página **Teams & draft** se adapta al formato elegido: un formato sin equipos se la salta entera. Para un bingo por equipos normal creas los equipos, decides quién los capitanea, y o bien repartes tú a los jugadores o haces un draft en directo.',
        'Los capitanes eligen del grupo de inscritos en el orden que fijes, y cada capitán ve las respuestas que la gente dio en el formulario de inscripción — congeladas tal y como se enviaron, para que nadie retoque sus «horas por semana» después de ser elegido.',
      ],
      placementIntro:
        'No tienes por qué hacer un draft. **Team placement**, en el formulario de creación y en la pestaña **Sign-ups**, decide dónde acaba cada nueva inscripción:',
      placementRows: [
        {
          term: 'Auto-balance',
          body: 'cada persona que se inscribe entra en el equipo con menos jugadores. Tú solo eliges cuántos equipos hay. Bueno para eventos públicos grandes.',
        },
        {
          term: 'Players pick',
          body: 'primero creas los equipos, y cada jugador elige uno en el formulario de inscripción. Pon un límite por equipo para que queden parejos.',
        },
        {
          term: 'Host drafts',
          body: 'todos esperan en un grupo hasta que tú o tus capitanes los elijáis en el draft o los asignéis a mano. Lo mejor si conoces a los jugadores.',
        },
        {
          term: 'Solo',
          body: 'sin equipos. Cada jugador va por su cuenta, con el nombre de su personaje, y la clasificación ordena jugadores.',
        },
      ],
      lockNote: {
        tag: 'El draft bloquea los equipos',
        body: 'En cuanto arranca un draft, el conjunto de equipos y el orden de elección quedan congelados. Añade el equipo que se te olvidó _antes_ de pulsar empezar, no después.',
      },
      seeAlso:
        'Manda a tus capitanes [la guía del capitán]({captainGuide}) antes de la noche del draft — la sala de guerra vale sobre todo los días previos, y nadie lee una pantalla nueva mientras corre un reloj.',
      visitingClans:
        '¿Jugáis contra otro clan en vez de repartir a los vuestros? El bando visitante presenta su propia plantilla mediante un solo enlace, y su moderador la lleva sin cuenta de admin aquí — mira [Acoger a un clan invitado]({clanVsClanGuide}).',
    },

    launch: {
      title: 'Arranca y llévalo',
      body: [
        'Revela las casillas y luego arranca el evento. Anvil se niega a arrancar un tablero que no está listo — un draft aún en marcha, o jugadores sin equipo — y te dice cuál. Si tú sabes mejor (un amistoso, una repetición, un tablero que estás probando), puedes forzarlo.',
        'A partir de ahí se lleva prácticamente solo. El plugin acredita automáticamente todo lo que ve y publica capturas de prueba selladas con el equipo y una marca de tiempo UTC. Lo que te cae encima es:',
      ],
      rows: [
        {
          term: 'Envíos que revisar',
          body: 'las casillas manuales y todo lo que el plugin haya marcado. Aprueba o rechaza con la prueba delante.',
        },
        {
          term: 'Estadísticas',
          body: 'la pestaña Stats del evento muestra la aportación por jugador — útil cuando un equipo discute sobre quién cargó con quién.',
        },
        {
          term: 'Anuncios',
          body: '**Post to Discord** (bajo **Clan** en el menú) publica un mensaje en cualquier canal como el bot a mitad de evento sin que escribas un webhook a mano.',
        },
      ],
      missionNote: {
        tag: 'Sorpresas a mitad de evento',
        body: 'Puedes soltar una **misión** sobre un bingo en marcha — una casilla de bonificación oculta que se anuncia cuando la disparas, y que opcionalmente pierde valor o caduca. Es la forma más barata de despertar un tablero el quinto día.',
      },
      startProofNote: {
        tag: 'Frenar el acaparamiento previo',
        body: [
          'Activa **Starting shot** (evento → Home → **Extras**) y cada jugador tendrá que entregar una captura tomada después del arranque, en un lugar que Anvil sortea en el instante del inicio — para que nadie esté sentado sobre una semana de clues y cofres guardados en el minuto cero. El lugar se anuncia con el arranque; la palabra clave de cada jugador es personal, derivada del sorteo, y no existe hasta que el evento empieza, así que nadie puede prepararla de antemano.',
          'Fija los sitios en el mapa del mundo (el editor del conjunto tiene uno) y el plugin comprueba que los jugadores están realmente allí en vez de solo habérselo dicho. También puedes exigir una **sesión fresca** — 15 minutos por defecto: los hiscores solo se guardan al cerrar sesión, así que obligar a todos a volver a entrar justo antes de su foto es lo que hace honestos los totales de partida detrás de cada casilla de XP y KC.',
          'Los que usan el plugin pulsan un botón. Los demás escriben su palabra clave en el juego y suben la imagen en My Team. Tú eliges qué pasa con el crédito de quien no ha entregado: marcarlo para revisión (por defecto) o rechazarlo hasta que lo haga. Ese mismo panel, en la Home del evento, es la lista de revisión — las capturas del plugin con palabra clave verificada llegan ya aceptadas, así que en la práctica solo miras a los jugadores de móvil.',
        ],
      },
    },

    after: {
      title: 'Después de la última casilla',
      intro:
        'Cuando se acaba el tiempo, el tablero se congela y el evento se bloquea — puntos, aportaciones y quién-hizo-qué quedan congelados tal como estaban. Si hay que arreglar algo después, un admin puede desbloquearlo deliberadamente.',
      rows: [
        {
          term: 'Pagos',
          body: 'la página **Prizes** del evento convierte el bote en una lista de quién recibe qué, marcada a medida que pagas.',
        },
        {
          term: 'Resumen',
          body: 'una página pública de resumen con la clasificación final y los galardones de cierre — el drop más grande, más kills, y lo demás.',
        },
        {
          term: 'Encuesta',
          body: 'pregunta al clan qué le pareció. Móntala en la pestaña Survey; los jugadores responden cuando el evento acaba y solo el equipo ve los resultados.',
        },
        {
          term: 'Guardar como plantilla',
          body: 'quédate con el tablero que acabas de montar, desde **Settings → More** del evento. El siguiente bingo empieza desde ahí en vez de desde una cuadrícula vacía.',
        },
      ],
      federation:
        'Con la federación activada, los miembros también pueden conectarse a otros clanes de Anvil desde el plugin — práctico para eventos entre clanes, y totalmente voluntario por miembro.',
      outro: 'Después dirige a tus miembros a [la guía de configuración para jugadores]({pluginGuide}) y empieza a planear el siguiente.',
    },
    survey: {
      title: 'Pregunta a los jugadores',
      intro: 'Activa **Post-event survey** en **Features** y luego abre la página **Survey** del evento.',
      body: [
        'En **Build**, añade preguntas: **Rating (1–5)**, **Free text**, **Choose one** o **Choose many**, cada una opcionalmente **Required**. O carga una plantilla: **Bingo wrap-up**, **Quick pulse**, **PvM mass**, **Raid team** o **Skilling / social**. **Preview the participant view** la muestra como la verá un jugador.',
        'Se abre cuando termina el evento, solo para los participantes aprobados, y pueden cambiar sus respuestas después. **Results** muestra las respuestas **By question** o **By person**. No es anónima: el staff ve quién dijo qué.',
      ],
    },
  },

  clanVsClan: {
    metaTitle: 'Acoger a un clan invitado — guía del anfitrión de Anvil',
    metaDescription:
      'Lleva un clan contra clan en Anvil: dale a cada clan invitado un enlace de invitación que siente a sus jugadores en un equipo, y un puesto para que su propio moderador lleve su mitad.',
    eyebrow: 'Anvil · para anfitriones',
    title: 'Acoger a un clan invitado',
    dek: 'Tú acoges el tablero; ellos ponen la plantilla. Este es el camino que te ahorra recoger una docena de RSN por privado — un enlace por equipo, y un puesto para que su propio moderador lleve su mitad del evento.',
    facts: [
      { strong: '1 enlace', rest: 'por equipo invitado' },
      { strong: '0 puestos de admin', rest: 'repartidos a gente de fuera' },
      { strong: '~5 min', rest: 'por clan que invitas' },
    ],
    footnote:
      'Las capturas son de una instalación real sobre un tablero de pruebas — los tokens de invitación y los nombres de Discord están tapados. Un enlace real merece cuidarse: cualquiera que lo tenga puede ocupar un puesto en ese equipo mientras siga activo.',

    teamCompsLine: "¿Quieres que los clanes compitan en skills o bosses? Mira [Competiciones por equipos]({teamCompsGuide}).",

    shape: {
      title: 'Lo que estás montando',
      body: [
        'Un clan contra clan es un evento normal con una diferencia: la mitad de los jugadores no están en tu clan y nunca lo estarán. No se pueden sincronizar desde la lista de miembros, no quieres ascenderlos, y desde luego no quieres inscribir a veinte a mano y luego arrastrar a cada uno a su equipo.',
        'Dos piezas resuelven eso, y son independientes — usa una, o las dos.',
      ],
      rows: [
        {
          term: 'Un enlace de invitación',
          body: 'una URL que creas una vez para un equipo. Quien la abra inicia sesión, rellena el formulario de inscripción de siempre, y aterriza en ese equipo ya aprobado — sin grupo de draft, sin cola de aprobación.',
        },
        {
          term: 'Un puesto en el equipo técnico',
          body: 'una persona concreta que puede llevar _solo ese equipo_ — su plantilla, sus envíos y pruebas, sus cuotas — sin cuenta de admin aquí, y sin quitarle el puesto de capitán a quien de verdad juega.',
        },
      ],
      note: {
        tag: 'Lo que una invitación no es',
        body: 'No es un inicio de sesión ni un atajo que salte la verificación. Quien la abra inicia sesión igualmente con Discord y sigue necesitando un RSN verificado, exactamente como en cualquier otra inscripción. Lo único que decide el enlace es _a qué equipo_ va la inscripción, y que no necesita la aprobación de nadie.',
      },
    },

    team: {
      title: 'Crea primero el equipo',
      body: [
        'Abre tu evento y ve a la página **Teams & draft**. Crea un equipo por cada clan invitado y ponle su nombre — el nombre es lo que ven sus jugadores en el formulario de inscripción, así que «Ironforge» gana a «Equipo 2».',
        '_No_ hace falta que hagas un draft. Los enlaces de invitación y un draft son alternativas: un draft reparte un grupo común de inscritos, un enlace sienta a la gente directamente. En un clan contra clan puro, la mayoría de anfitriones crean los equipos, reparten un enlace a cada uno, y nunca abren el draft.',
        'Después abre el equipo en sí — **Teams & draft → el equipo** — porque ahí ocurren los dos pasos siguientes.',
      ],
      captainNote: {
        tag: 'El capitán primero',
        body: 'Nombra al capitán del bando visitante antes de repartir el enlace, para que la página del equipo tenga responsable desde el principio. Nombrar a un capitán también lo sienta en el equipo; si la tarjeta te avisa de que no está en la plantilla, acepta el arreglo que ofrece.',
      },
    },

    staff: {
      title: 'Dale un puesto a su moderador',
      body: [
        'El panel **Team staff** de la página del equipo es cómo el propio moderador del clan invitado se pone a trabajar sin que le concedas nada en tu sitio. Pulsa **Add someone**, búscalo, añade una nota como «Ironforge’s mod» para que el siguiente admin sepa por qué está ahí, y pulsa **Give a seat**.',
      ],
      figure: {
        caption: 'Evento → Teams & draft → el equipo → Team staff',
        alt: 'El panel Team staff con un puesto concedido y el buscador abierto para añadir a alguien',
        legend: [
          {
            label: 'Add someone',
            body: 'abre el buscador. Solo pueden aparecer personas que hayan iniciado sesión aquí con Discord al menos una vez — mira la nota de abajo.',
          },
          {
            label: 'La nota',
            body: 'texto libre, 120 caracteres. Escribe de qué clan son. Los puestos siguen en la lista después del evento, y «¿quién es este?» es la pregunta que tendrás dentro de tres meses.',
          },
          {
            label: 'Remove',
            body: 'retira el puesto de inmediato. Hazlo cuando acabe el evento — un puesto no caduca solo.',
          },
        ],
      },
      canDo: 'Lo que permite un puesto, solo en ese equipo:',
      canDoList: [
        'ver y gestionar la plantilla del equipo',
        'ocuparse de sus envíos y pruebas',
        'marcar como pagadas las cuotas de sus jugadores',
        'crear enlaces de invitación para él, si lo activas (el paso después del siguiente)',
      ],
      cantDo: 'Lo que nunca permite:',
      cantDoList: [
        'tocar ningún otro equipo',
        'editar el tablero o sus casillas',
        'hacer elecciones de draft',
        'cambiar a nadie una vez el evento está en marcha',
      ],
      note: {
        tag: 'Primero tienen que iniciar sesión aquí una vez',
        body: 'El buscador solo lista cuentas con Discord vinculado — un puesto depende de una persona que pueda entrar de verdad. Manda al moderador del clan invitado a este sitio, pídele que pulse **Login** una vez, y concede el puesto _después_. Si no aparece en el buscador, ese inicio de sesión no ha ocurrido todavía.',
      },
    },

    link: {
      title: 'Crea el enlace de invitación',
      body: [
        'Todavía en la página del equipo, el panel **Invite links** crea el enlace. Dos campos deciden qué promete el enlace, y los dos leen `0` como «no prometas nada».',
      ],
      figure: {
        caption: 'Evento → Teams & draft → el equipo → Invite links',
        alt: 'El panel Invite links con los campos de puestos y caducidad, el botón Make a link, y un enlace activo en la lista',
        legend: [
          {
            label: 'Seats y Expires in hours',
            body: 'a cuánta gente puede sentar el enlace (hasta 100) y cuánto tiempo sigue valiendo (hasta 30 días). Pon los puestos al tamaño de la plantilla que te prometieron y el enlace se cierra solo cuando entren todos; pon caducidad cuando el enlace vaya a un Discord público. `0` en cualquiera de los campos significa sin límite.',
          },
          {
            label: 'Make a link',
            body: 'lo crea y lo copia al portapapeles al momento. Pégaselo antes de hacer cualquier otra cosa.',
          },
          {
            label: 'La lista de enlaces activos',
            body: 'cada enlace que este equipo tiene fuera, con cuánta gente ha entrado y cuántos puestos quedan. **Copy** lo vuelve a coger; **Turn off** lo mata para siempre.',
          },
        ],
      },
      shape:
        'El enlace tiene esta pinta: `{origin}/events/{eventId}/join/{token}` — una línea, segura de pegar en un mensaje de Discord.',
      note: {
        tag: 'Valores por defecto sensatos',
        body: 'En un clan contra clan donde has acordado una plantilla con un moderador, deja los dos campos en `0` y déjale hacer. Recurre a puestos y caducidad cuando el enlace vaya a algún sitio que no controlas.',
      },
      revoke:
        'Apagar un enlace surte efecto al momento y no saca a nadie que ya haya entrado — ahora son jugadores normales de ese equipo. Si quieres sacar a alguien, usa la plantilla del equipo.',
    },

    captains: {
      title: 'Deja que creen sus propios enlaces',
      body: [
        'Por defecto solo un anfitrión puede crear enlaces, y a un capitán que lo intente se le dice. Ese valor por defecto es el correcto para un evento de clan normal — un capitán repartiendo puestos estaría llenando una plantilla que nadie ha aprobado — y el equivocado para un clan contra clan, donde el bando visitante conoce su propia plantilla mejor que tú.',
        'El interruptor está en ese mismo panel **Invite links**: **Let captains make their own links**. Se aplica a _todos los equipos de este evento_, no solo al que estás mirando — que es justo lo que quieres cuando los dos bandos son clanes invitados.',
        'Con él activado, el capitán del equipo y cualquiera con un puesto en el equipo técnico pueden crear enlaces por su cuenta desde **My Team → Invite links**. Reciben el mismo panel que tú, sin el interruptor.',
      ],
      figure: {
        caption: 'My Team → el equipo → Invite links',
        alt: 'La pestaña Invite links desde el lado del capitán en el centro del equipo, con los campos de puestos y caducidad y un enlace activo',
        legend: [
          {
            label: 'El mismo panel, vista del capitán',
            body: 'crear, copiar, apagar. Si el anfitrión no ha activado el interruptor, pone «Only a host can make links for this event» y los campos no están.',
          },
          {
            label: 'La lista de enlaces activos',
            body: 'un capitán que no puede crear sigue viendo los que su equipo tiene fuera — así puede pedirte otro en vez de suponer que no hay ninguno.',
          },
        ],
      },
    },

    player: {
      title: 'Lo que ven sus jugadores',
      intro:
        'Merece la pena recorrerlo una vez tú mismo antes de repartir el enlace, para poder responder a las preguntas.',
      steps: [
        'Abren el enlace. Si no han iniciado sesión, entran primero con Discord y vuelven directos — el enlace no se pierde por el camino.',
        'Llegan al formulario de inscripción de siempre, con un cartel que dice **You’re joining {teamExample} by invite**. Las mismas preguntas, el mismo selector de cuentas, la misma cuota que para cualquiera.',
        'Al enviar están en ese equipo, aprobados. Sin intervención del anfitrión, sin draft.',
      ],
      figure: {
        caption: 'El formulario de inscripción, abierto mediante un enlace de invitación',
        alt: 'El formulario de inscripción del evento con un cartel que indica que el jugador entra en un equipo concreto por invitación',
        legend: [
          {
            label: 'El cartel de invitación',
            body: 'nombra el equipo al que están a punto de entrar. Si nombra el equipo equivocado, tienen el enlace equivocado — que paren y lo comprueben antes de enviar.',
          },
          {
            label: 'El resto del formulario',
            body: 'sin cambios. Sigue haciendo falta un RSN verificado, se siguen haciendo las preguntas de inscripción, y sigue aplicándose la cuota.',
          },
        ],
      },
      note: {
        tag: '¿Ya inscrito?',
        body: 'Si alguien se inscribió antes de forma normal y está en el grupo, abrir el enlace lo mueve al equipo en vez de crear una segunda inscripción. A quien ya está aprobado en otro equipo se le deja en paz — muévelo desde la plantilla.',
      },
    },

    dead: {
      title: 'Cuando un enlace deja de funcionar',
      intro:
        'Un enlace rechazado se explica solo en la página en vez de dar un 404, así que quien lo tenga puede decirte cuál de estos casos es.',
      rows: [
        {
          term: 'This invite has been turned off.',
          body: 'Alguien pulsó **Turn off**. Crea uno nuevo — un enlace viejo no vuelve nunca.',
        },
        {
          term: 'This invite has expired.',
          body: 'Alcanzó las horas que fijaste. Crea otro, esta vez con `0` horas si la caducidad no está aportando nada.',
        },
        {
          term: 'This invite is full.',
          body: 'Todos los puestos están ocupados. Súbelo creando un enlace nuevo con más puestos — el número queda fijo en cuanto un enlace existe.',
        },
        {
          term: 'Sign-ups for this event aren’t open.',
          body: 'El único que puede arreglarse solo. Comprueba la ventana de inscripción del evento: si ya abrió, si pasó la fecha límite, o si el evento ya empezó.',
        },
        {
          term: 'That invite belongs to a different event.',
          body: 'Se ha pegado un enlace de otro tablero. Comprueba que el id de evento de la URL es el que querías.',
        },
      ],
      checklist: 'Antes del evento, repasa esta lista una vez por cada clan invitado:',
      checklistItems: [
        'su equipo existe y lleva su nombre',
        'su capitán está nombrado y sentado en el equipo',
        'su moderador ha iniciado sesión aquí y tiene un puesto en el equipo técnico',
        'el enlace está creado, copiado, y realmente entregado a una persona',
        'la ventana de inscripción está abierta el tiempo que necesiten',
      ],
      note: {
        tag: 'Cuando todo termina',
        body: 'Apaga los enlaces y retira los puestos del equipo técnico. Ninguno caduca solo, y un enlace activo en un evento terminado no es más que un cabo suelto.',
      },
    },
    cohost: {
      title: 'Si eres el co-anfitrión',
      intro: 'Todo lo anterior es el lado del anfitrión. El staff del clan visitante tiene su propia página del evento, **Co-hosted with <host>**. El anfitrión mantiene las fechas, el draft, los equipos y quién puede verlo.',
      rows: [
        {
          term: 'Las inscripciones de tu clan',
          body: '**Approve**, **Reject** o **Withdraw** a los jugadores de tu propio clan. Nunca ves ni tocas los del anfitrión.',
        },
        {
          term: 'El tablero',
          body: 'solo puedes editarlo si el anfitrión dio ese permiso a tu staff. Si no, puedes **Suggest a tile**: la casilla, los detalles y los puntos, hasta 25 en espera a la vez. Cada una aparece como **waiting**, **accepted ✓** o **turned down** con el motivo del anfitrión.',
        },
        {
          term: 'Tu equipo',
          body: '**Manage** el equipo de tu clan.',
        },
        {
          term: 'Discord',
          body: 'tus admins eligen qué llega a tu propio servidor: **Everything shared**, **Big moments** o **Nothing**, en qué canal, a quién se avisa y si tus jugadores reciben el rol **@Bingo player**.',
        },
      ],
    },
  },

  board: {
    metaTitle: 'Montar un tablero — guía de creación de casillas de Anvil',
    metaDescription:
      'Crea casillas de bingo que se acreditan solas: qué puede ver realmente cada tipo, creación en bloque con hoja de cálculo, y los errores que fallan en silencio.',
    eyebrow: 'Anvil · para quien monta el tablero',
    title: 'Monta un tablero que se registra solo',
    dek: 'Una casilla es la promesa de que algo se va a notar. Esto es lo que cada tipo puede ver realmente, cómo escribir doscientas sin perder la tarde, y el puñado de errores que fallan en silencio — la casilla simplemente nunca salta, y nadie se entera hasta el cuarto día.',
    facts: [
      { strong: '15 tipos', rest: 'uno por casilla, nunca mezclados' },
      { strong: '1000 casillas', rest: 'por tablero, con hoja de cálculo' },
      { strong: 'En silencio', rest: 'así falla una casilla mal hecha' },
    ],
    footnote:
      'El formato de la hoja de cálculo está descrito por completo en `docs/tile-authoring.md`, escrito para quien (o lo que) genera las filas. Esta página es la mitad humana: a qué tipo recurrir, y qué se tuerce.',

    kinds: {
      title: 'Una casilla, un tipo',
      body: [
        'Cada casilla es exactamente de un _tipo_, y el tipo es toda la cuestión: decide qué vigila el plugin o el barrido de hiscores, y por tanto si la casilla puede siquiera completarse sola. Mezclar campos de dos tipos se rechaza en la puerta en vez de aceptarse y quedar roto.',
        'Los tipos caen en tres familias, y la familia importa más que la etiqueta:',
      ],
      families: [
        {
          term: 'Manual',
          body: 'una persona mira una captura y dice que sí. Siempre disponible, siempre funciona, siempre le cuesta la tarde a alguien. Úsalo para lo que el software no puede ver.',
        },
        {
          term: 'Leído de los Hiscores',
          body: 'XP de habilidades y contadores de kills de jefes, leídos de los Hiscores oficiales cada 15 minutos. No necesita plugin y funciona para todos los de la lista — pero solo ve lo que los Hiscores cuentan, y solo después de que el jugador cierre sesión.',
        },
        {
          term: 'Detectado por el plugin',
          body: 'todo lo demás: drops, kills de PNJ, tiempos, diaries, combat tasks, vueltas, valor del botín. Acredita en segundos e incrusta una captura de prueba — pero solo para jugadores que usan realmente el plugin.',
        },
      ],
      kindsIntro: 'La lista completa, en el orden del selector de tipo:',
      kindLabels: {
        standard: { label: 'Estándar', blurb: 'Casilla manual — un capitán la marca como hecha. Sin registro automático.' },
        skill: { label: 'Habilidad', blurb: 'Se completa sola cuando una habilidad alcanza un objetivo de XP (leído de los hiscores).' },
        boss: { label: 'KC de jefe', blurb: 'Se completa sola cuando un jefe alcanza un objetivo de kills (leído de los hiscores).' },
        drop: { label: 'Drop', blurb: 'N drops de un objeto (o de cualquiera de un conjunto) — detectado por el plugin, con captura incrustada.' },
        collection: { label: 'Conjunto de objetos', blurb: 'Varios objetos, cada uno con su propia cantidad requerida — uno de cada para un conjunto completo.' },
        kill: { label: 'Kills', blurb: 'N kills de cualquier jefe o monstruo. Se cuenta desde los hiscores cuando todos los monstruos de la casilla están en ellos; si no, lo cuenta el plugin mientras juegas (gallinas, vacas, monstruos de Slayer).' },
        lap: { label: 'Vueltas de agility', blurb: 'N vueltas en un circuito de agility, o N plantas / recorridos completos del Hallowed Sepulchre — contadas en vivo desde el contador del juego. Solo cuentan las vueltas hechas durante el evento.' },
        pvp: { label: 'Kill de PvP', blurb: 'Mata jugadores — a cualquiera, a equipos rivales, o a un objetivo con nombre — en el Wilderness o en mundos PvP. Los minijuegos seguros nunca cuentan.' },
        gain: { label: 'Ganancia de objeto', blurb: 'Pesca, cocina o recolecta N de un objeto — contado por lo que entra en el inventario. Detectado por el plugin.' },
        timed: { label: 'A contrarreloj', blurb: 'Completa una actividad bajo un límite de tiempo (Inferno, raids, Colosseum). El plugin cronometra.' },
        deathless: { label: 'Sin muertes', blurb: 'Completa una raid con CERO muertes del grupo, N veces. El plugin cuenta cada muerte dentro de la instancia.' },
        lms: { label: 'LMS', blurb: 'Queda entre los N primeros en Last Man Standing (1 = victoria), M veces. Detectado por el plugin al final de la partida.' },
        value: { label: 'Valor del botín', blurb: 'Botín por valor de X gp — un botín, o varios que sumen un objetivo. El plugin tasa el botín.' },
        diary: { label: 'Diary', blurb: 'Completa niveles de achievement diary durante el evento. Detectado por el plugin en el mensaje de finalización.' },
        ca: { label: 'Combat task', blurb: 'Completa tareas de Combat Achievement durante el evento. Detectado por el plugin en el mensaje de finalización.' },
      },
      note: {
        tag: 'La pregunta del plugin, hecha una vez',
        body: 'Una casilla que detecta el plugin es invisible para un jugador que no lo usa. No es un fallo que puedas configurar — no hay nada mirando. Si parte de tu clan juega en móvil o en el cliente oficial: o mantienes esas casillas fuera del camino a la victoria, o las emparejas con una alternativa manual y cuentas con revisar capturas.',
      },
    },

    pick: {
      title: 'Elige el tipo que va a saltar de verdad',
      intro:
        'La mayoría de las casillas que se portan mal son la idea correcta expresada con el tipo equivocado. Las cuatro que pillan a la gente:',
      rows: [
        {
          term: 'Una lista de jefes más un monstruo fuera de los hiscores',
          body: 'es una casilla del plugin para **todo**. Una casilla Kills solo se cuenta desde los hiscores si todos sus monstruos están en ellos; añade una gallina a cuatro jefes de GWD y toda la casilla necesita el plugin. Si parte del clan juega sin él, deja los jefes de los hiscores en su propia casilla.',
        },
        {
          term: 'Una ranura del collection log',
          body: 'es una casilla drop. Desbloquear la entrada del registro la acredita, así que la casilla salta incluso con un duplicado que el jugador ya tenía — que suele ser lo que querías decir.',
        },
        {
          term: '«Uno de cada»',
          body: 'es una casilla drop con lista de objetos y **sin** `requiredAmount`. Añade un `requiredAmount` y se convierte en silencio en «cualquiera N de estos» — la misma fila, una casilla completamente distinta.',
        },
        {
          term: 'Un diary o un combat task',
          body: 'solo acredita con el mensaje de finalización del juego, que aparece en el momento en que se termina el nivel o la tarea. Lo que un jugador ya posee no puede volver a dispararlo — salvo un combat task, donde **Settings → Combat Achievements → Repeat completion** le permite dispararlo de nuevo.',
        },
      ],
      note: {
        tag: 'Casillas de jefe compuestas',
        body: 'La estadística registrada de una casilla de jefe puede contener varias claves de hiscores separadas por comas, y el progreso se suma entre ellas. `chambersOfXeric,chambersOfXericChallengeMode` es una casilla que cuenta CoX y CM juntos — que es casi siempre lo que quiere decir una casilla de raid.',
      },
    },

    bulk: {
      title: 'Créalas en bloque, no en el navegador',
      body: [
        'Hacer a clics una cuadrícula de 25 casillas está bien. Hacer a clics un tablero Leagues de 200 tareas no, y revisarlo después tampoco. La pestaña Tiles tiene una ida y vuelta hecha justo para eso.',
      ],
      steps: [
        '**Download spreadsheet** en la página **Board & tiles** del evento. Obtienes un .xlsx del tablero tal cual está, con desplegables, la lista de objetos y las instrucciones de columnas en hojas propias.',
        'Edítalo. Una fila por casilla; el orden de filas es el orden de casillas.',
        '**Upload CSV / Excel** en la misma pestaña. Solo se lee la hoja **Tiles**.',
      ],
      rules: [
        {
          term: 'La ida y vuelta no pierde nada',
          body: 'descarga y vuelve a subir sin cambios y no pasa nada — las filas que coinciden se informan como sin cambios y ni siquiera se les pone marca de tiempo. Eso hace que la exportación sea una copia de seguridad segura antes de una edición grande.',
        },
        {
          term: 'Las filas siguen a las posiciones',
          body: 'fila 1 es casilla 1. Las casillas existentes se actualizan en su sitio, y una columna que omitas se deja intacta en vez de vaciarse — puedes enviar una hoja de dos columnas que solo cambie los puntos.',
        },
        {
          term: 'Solo crecen los tableros dinámicos',
          body: 'las filas de más crean casillas nuevas en un tablero Leagues o una carrera de casillas, antes de que arranque el evento, hasta 1000. Una cuadrícula clásica N×N tiene forma fija y las ignora. Para generar cientos de tareas, hazlo un evento Leagues.',
        },
        {
          term: 'Todo o nada',
          body: 'todas las filas se validan primero. Un solo nombre de objeto que no se pueda resolver hace fallar toda la importación, nombra a los culpables, y no cambia nada — nunca te quedas con medio tablero.',
        },
        {
          term: 'Algunos campos se bloquean al arrancar',
          body: 'nombre, tipo, cantidad requerida y configuración de objetos solo se aplican antes del arranque. Descripción, puntos, categoría y la marca de opcional siguen editables todo el rato, así que puedes corregir una errata a mitad de evento sin reabrir el tablero.',
        },
      ],
    },

    traps: {
      title: 'Los errores que fallan en silencio',
      intro:
        'Todos estos se importan limpios, se quedan en el tablero con buen aspecto, y nunca saltan. Merecen una lectura antes de subir el archivo, no después.',
      rows: [
        {
          term: 'Las casillas de habilidad y jefe son `type=standard`',
          body: 'no existe `type=skill`. El tipo sale de `trackedStat` + `statType` + `statGoal` sobre una fila por lo demás estándar. Escribir `type=boss` se rechaza; escribir `type=standard` y olvidar las columnas de estadística no — así te queda una casilla manual que nadie aprobará jamás.',
        },
        {
          term: 'Los separadores cambian según la columna',
          body: '`items` usa punto y coma (la coma es el separador de CSV). `targetNpcs` usa barras verticales. En una fila de combat task la barra vertical es la **única** opción, porque los nombres reales de tareas llevan comas — `Nylocas, On the Rocks` es una sola tarea.',
        },
        {
          term: 'Los nombres de raids se comparan literalmente',
          body: 'una casilla sin muertes o a contrarreloj lleva el modo tal y como se escribe en el juego: `Chambers of Xeric: Challenge Mode`, `Theatre of Blood: Hard Mode`, `Tombs of Amascut: Expert Mode`. Una grafía casi correcta es una casilla que nunca se completará. Las runs en Entry Mode nunca acreditan una casilla de raid base; los modos más difíciles sí.',
        },
        {
          term: 'Los nombres de objetos deben ser exactos',
          body: 'la grafía del juego, o la importación falla y lista lo que no pudo resolver. Si un nombre es ambiguo, fíjalo como `Name#id` y deja de adivinar.',
        },
        {
          term: '`timeThresholdSeconds` significa cuatro cosas',
          body: 'un límite de tiempo en una casilla a contrarreloj, un límite de puesto en una casilla LMS (1 = victoria), un tamaño de grupo exacto en una casilla sin muertes, y un tamaño exacto de grupo de raid en una casilla drop. La misma columna, cuatro significados — comprueba que rellenas el que tu tipo lee de verdad.',
        },
        {
          term: 'Una cantidad requerida en el tipo equivocado',
          body: 'su sitio son las filas drop, kill, gain, lap, PvP, sin muertes y LMS. En una fila de estadística o a contrarreloj no hace nada, y en una fila drop convierte un conjunto de objetos en un grupo de «N cualesquiera».',
        },
      ],
      note: {
        tag: 'Prueba una antes de escribir doscientas',
        body: 'Crea una sola casilla del tipo que te genera dudas, revélala en un evento de usar y tirar, y ve a hacer la cosa. Cinco minutos ahí valen más que descubrir en la noche de bingo del clan que una categoría entera estaba muerta.',
      },
    },

    points: {
      title: 'Puntos, niveles y si es justo',
      body: [
        'En un tablero por puntos cada casilla lleva su propio valor, y esos valores se traducen a bandas de dificultad con nombre — easy a elite — que puedes editar en **Rules & scoring** si tu clan clasifica de otro modo. La banda es lo que leen los jugadores; el número es lo que puntúa.',
        'Marca una casilla como **optional** y deja de contar para el total del tablero, que es como añades objetivos ambiciosos sin hacer imposible un blackout.',
        'Cuando el tablero esté lleno, lanza el **auditor de equilibrio** desde la pestaña Tiles. Revisa la estructura y el reparto de esfuerzo y te dice dónde se inclina el tablero — una categoría que nadie puede terminar, una banda que vale mucho más por hora que sus vecinas — antes de que los jugadores encuentren esas cosas por ti y las esquiven.',
      ],
    },

    reveal: {
      title: 'Nadie lo ve hasta que tú lo digas',
      body: [
        'Los tableros nuevos empiezan ocultos. El equipo siempre los ve; los jugadores no ven absolutamente nada hasta que reveles — así que un tablero se puede montar a la vista, durante días, en un canal que tus miembros pueden leer, sin destripar nada.',
        'Ese interruptor principal es el suelo bajo todo lo demás. En un tablero con política de revelación — programada, por intervalos, recompensa, o rotatoria — el motor solo empieza a dar la vuelta a las casillas cuando el tablero en sí está revelado, así que armar un tablero es siempre un acto deliberado. Qué política elegir tiene su propia página: [Formatos, y cómo se abren las casillas]({formatsGuide}).',
        'Las misiones son la excepción que conviene conocer: casillas creadas de antemano pero retenidas, anunciadas a mitad de evento desde su propio conjunto mientras el resto del tablero sigue visible.',
      ],
    },

    check: {
      title: 'Antes de revelar',
      intro: 'Merece la pena repasarlo una vez por tablero. Casi todo son cinco minutos.',
      items: [
        'cada casilla tiene el tipo que querías, no el que se importó limpio',
        'los modos de raid, nombres de objetos y nombres de tareas coinciden carácter a carácter con la grafía del juego',
        'las casillas detectadas por el plugin no son el único camino a la victoria, si parte de tu clan juega sin él',
        'los puntos están puestos y el auditor de equilibrio está contento, o le llevas la contraria a propósito',
        'las casillas opcionales están marcadas como opcionales',
        'has descargado la hoja de cálculo una vez, como copia de seguridad que puedes volver a subir',
      ],
      note: {
        tag: 'Quién puede hacer esto',
        body: 'Crear casillas es el único trabajo de administración con rol propio. Un **editor** puede crear casillas y nada más, y se le puede acotar a tableros concretos — así que un montador invitado de otro clan recibe exactamente el evento que le diste, sin acceso a nada más de lo que llevas.',
      },
    },
    library: {
      title: 'La biblioteca de tareas y las sugerencias',
      body: [
        'Los editores de casillas tienen **Task library** en el menú de admin: las tareas guardadas de tu clan, y la biblioteca propia de Anvil para copiar. **⬇ Export pack** guarda tus tareas en un archivo y **⬆ Import pack** carga uno, que es como un tablero se traslada de un clan a otro.',
        '¿Encontraste un error en la biblioteca de Anvil, o falta una tarea? Pulsa **Suggest a fix** en la tarea, o **Suggest a new task**. Anvil la revisa y la respuesta aparece en **Your suggestions**: **Waiting for review**, **Approved** o **Not taken**, con una nota. Puedes tener 5 en espera. Una corrección aprobada llega a cada copia del clan que siga la biblioteca.',
      ],
    },
    stats: {
      title: 'Estadísticas iniciales y los que se unen tarde',
      intro: 'Las casillas de XP y de conteo de kills comparan las estadísticas actuales de cada jugador con sus **starting stats**, tomadas al empezar el evento. La página **Stats** del evento es donde las revisas y corriges:',
      rows: [
        {
          term: 'Capturar las estadísticas iniciales',
          body: 'antes del inicio solo precalienta las hiscores; la línea de salida se toma al empezar. Después del inicio, el botón pasa a ser **Capture late joiners**, para los jugadores añadidos desde entonces. Puede ejecutarse una vez cada 30 minutos.',
        },
        {
          term: 'Update now',
          body: 'actualiza la clasificación con los números más recientes. También se actualiza cada hora por sí sola.',
        },
        {
          term: 'Fix baseline',
          body: 'por jugador: cambia a mano el número inicial de una skill o un boss. Úsalo cuando se contó un grind de antes del evento, porque el jugador no cerró sesión antes de que empezara.',
        },
        {
          term: 'Reset all starting stats',
          body: 'escondido bajo **Danger zone**: vuelve a tomar la línea inicial de todos a partir de sus estadísticas actuales, borrando todas las ganancias hasta ahora. Solo para un evento que empezó por error.',
        },
      ],
      outro: 'Debajo, **Member breakdown** muestra quién hizo qué en cada equipo, y **Stat tile standings** muestra el inicio y el número actual de cada jugador en cada casilla de XP o kills.',
    },
  },

  captain: {
    metaTitle: 'Guía del capitán — Anvil',
    metaDescription:
      'El día del draft y las semanas siguientes: leer la lista antes de que arranque el reloj, elegir, y llevar la plantilla, las pruebas y las cuotas de tu equipo.',
    eyebrow: 'Anvil · para capitanes',
    title: 'Guía del capitán',
    dek: 'Te ponen en las manos una sala de guerra, un reloj y los formularios de inscripción de veinticinco desconocidos. Esto es lo que hace todo eso, en el orden en que te lo encuentras — más las partes de llevar un equipo que solo empiezan cuando el draft ha terminado.',
    facts: [
      { strong: 'Orden serpiente', rest: 'para que las elecciones tardías se compensen' },
      { strong: 'El reloj', rest: 'nunca elige por ti' },
      { strong: 'Una pestaña', rest: 'lleva tu equipo todo el evento' },
    ],
    footnote:
      'Todo lo de aquí es lo que ve un capitán. Las cuotas, las plantillas de otros equipos y el tablero antes de revelarse son del equipo organizador y ahí se quedan, así que nada de esta página puede hacer que te acusen de haber mirado donde no debías.',

    before: {
      title: 'Qué recibes, y cuándo',
      body: [
        'Un anfitrión te nombra capitán, y eso hace dos cosas: te sienta en el equipo como jugador, y te abre las pantallas del equipo. Si la página del equipo avisa alguna vez de que en realidad no estás en la plantilla, acepta el arreglo que ofrece — un capitán fuera de su propio equipo es un estado que confunde a todas las pantallas de después.',
        'A partir de ahí tienes dos sitios. **My Team** es el centro de tu equipo, y ahí pasas el evento. La **sala de guerra** es la pantalla del día del draft, y se abre en cuanto abren las inscripciones — mucho antes de la noche del draft.',
      ],
      note: {
        tag: 'Ve pronto',
        body: 'La sala de guerra vale sobre todo los días _previos_ al draft, cuando puedes leer cada formulario con calma. La noche en sí se convierte en un cronómetro y no vas a tener tiempo de leer nada.',
      },
    },

    warroom: {
      title: 'Lee la lista antes de que arranque el reloj',
      body: [
        'La sala de guerra muestra a todos los que se pueden elegir, con todo lo que el sitio sabe de ellos: qué juegan, en qué jefes tienen contadores de kills reales, a cuántos eventos anteriores aparecieron, y las respuestas que dieron en el formulario de inscripción.',
        'Esas respuestas están **congeladas tal y como se enviaron**. Nadie retoca sus «horas por semana» después de ver a quién eligieron primero, y esa es justo la razón por la que merece la pena leerlas.',
        'Monta una **lista corta** mientras lees. Es privada, sobrevive hasta la noche del draft, y esa noche marca la diferencia entre elegir de una lista en la que ya confías y elegir a quien casualmente esté arriba en la pantalla.',
      ],
      rows: [
        {
          term: 'Valoración y nivel',
          body: 'un resumen de lo que alguien ha hecho de verdad, deducido de su historial de cuenta y no de lo que te contó. Orientativo — un punto de partida para una conversación, no un veredicto.',
        },
        {
          term: 'Ámbitos y marcadores',
          body: 'lo que hacen de forma demostrable: raids, PvM, skilling, PvP. Útil para detectar el hueco de tu plantilla en vez de coger cuatro veces el número más alto.',
        },
        {
          term: 'Asistencia',
          body: 'con qué frecuencia terminaron eventos anteriores a los que se apuntaron. El número más callado de la página y a menudo el que mejor predice.',
        },
      ],
    },

    draft: {
      title: 'El día del draft',
      body: [
        'Las elecciones van en **orden serpiente**: con cuatro equipos la primera ronda va A, B, C, D y la segunda D, C, B, A, así que elegir el último en una ronda significa elegir el primero en la siguiente. Quien sacó la primera elección lo paga un minuto después.',
        'Una persona es una elección, no una cuenta. Coger a alguien arrastra todas las cuentas que haya registrado a tu equipo de golpe — nunca gastas una segunda elección en la cuenta secundaria de nadie.',
      ],
      rows: [
        {
          term: 'El reloj de elección',
          body: 'si el anfitrión puso uno, tienes esos segundos por turno. Cuando se agota **no** elige por ti — desbloquea que el anfitrión elija en tu nombre, y lo dice en las dos pantallas. Nada ocurre en silencio.',
        },
        {
          term: 'Una lista recortada',
          body: 'algunos eventos usan un modo de equilibrio. Según cuál, al equipo más fuerte se le puede impedir coger otro jugador de primer nivel mientras un rival no tiene ninguno, o ponerle un tope de cuánto puede subir su plantilla por encima de la media. Si alguien que querías está en gris, es por eso, y se aplica a todos.',
        },
        {
          term: 'Si te lo pierdes',
          body: 'avisa al anfitrión antes. Puede elegir por ti desde el mismo tablero, y una lista corta que hayas dejado es la instrucción que seguirá.',
        },
      ],
      note: {
        tag: 'El draft bloquea la plantilla',
        body: 'En cuanto un draft está en marcha, los equipos y el orden de elección quedan congelados. Si falta un equipo o el orden está mal, hay que arreglarlo antes de la primera elección, no después.',
      },
    },

    roster: {
      title: 'El centro de tu equipo, todo el evento',
      intro:
        'En **My Team**, la tarjeta **Manage this team** contiene todo lo que puedes hacer por tu bando. Viene plegada; ábrela una vez y se queda donde la dejaste.',
      rows: [
        {
          term: 'Roster',
          body: 'quién está en el equipo y qué ha aportado. El primer sitio donde mirar cuando alguien pregunta por qué no contó su drop — una cuenta sin vincular aparece aquí.',
        },
        {
          term: 'Requests',
          body: 'gente pidiendo entrar, en eventos donde los jugadores eligen su propio equipo. Solo aparece cuando hay alguien.',
        },
        {
          term: 'Proof',
          body: 'los envíos de tu equipo y sus capturas. Tú no eres quien aprueba al final — eso es del equipo organizador — pero ves lo que se ha mandado y puedes perseguir lo que no.',
        },
        {
          term: 'Fees',
          body: 'quién de tu equipo sigue debiendo la cuota. Puedes marcar una como pagada; confirmarla es trabajo del equipo organizador, a propósito.',
        },
        {
          term: 'Invite links',
          body: 'aparece cuando el anfitrión permite a los capitanes crear los suyos. Un enlace sienta a quien lo abra directamente en tu equipo. Mira [Acoger a un clan invitado]({clanVsClanGuide}) para saber qué hace realmente el enlace.',
        },
      ],
    },

    during: {
      title: 'Llevarlo una vez ha empezado',
      body: [
        'La mayor parte del evento se lleva sola: el plugin acredita lo que ve y archiva una captura sellada. Lo que queda son personas, y ese es el trabajo.',
        'Lo que de verdad necesita un capitán: asegurarte de que todos en tu bando tienen el plugin conectado y sus cuentas vinculadas antes del pistoletazo, porque una cuenta secundaria sin vincular no aporta a nada; darte cuenta a mitad de camino de qué casillas no ha tocado nadie; y conseguir que las casillas manuales estén fotografiadas antes de la última hora, cuando todos lo intentan a la vez.',
        'Si el evento pide una foto de salida, esa es la única cosa que cada jugador tiene que hacer por sí mismo en las primeras horas. Persíguelo pronto — a un jugador sin ella se le marca cada crédito para revisión, o se le rechaza directamente, según lo haya configurado el anfitrión.',
      ],
      note: {
        tag: 'Sustituciones',
        body: 'Una vez el evento está en marcha, solo un admin puede cambiar a alguien, y es a propósito: las aportaciones ya están atadas a personas. Pregunta a un anfitrión en vez de apañarlo por otro lado.',
      },
    },
  },

  formats: {
    metaTitle: 'Formatos, y cómo se abren las casillas — Anvil',
    metaDescription:
      'Los siete formatos de evento, las cinco formas en que pueden abrirse las casillas, y los modificadores de puntos — qué le hace cada uno a la sensación de un evento.',
    eyebrow: 'Anvil · para el equipo del clan',
    title: 'Formatos, y cómo se abren las casillas',
    dek: 'Dos decisiones dan forma a un evento más que cualquiera de sus casillas: qué forma tiene el tablero, y cómo se vuelven jugables las casillas. Son independientes — cualquier formato admite cualquier política de revelación — y juntas son la diferencia entre una semana de faena y una carrera de una noche.',
    facts: [
      { strong: '7 formatos', rest: 'la forma del tablero' },
      { strong: '5 políticas', rest: 'cómo se abren las casillas' },
      { strong: '3 modificadores', rest: 'cuánto vale completar una' },
    ],
    footnote:
      'El formato se fija al crear pero se puede cambiar después desde la pestaña Settings → Event del evento; la política de revelación y los modificadores de puntos se pueden cambiar en cualquier momento antes de que se revelen las casillas afectadas.',

    shape: {
      title: 'La forma del tablero',
      intro:
        'El formato decide cómo puntúa el tablero y qué te pedirá a continuación el formulario de creación. Todo lo demás de esta página se monta encima.',
      note: {
        tag: 'Cuadrícula fija o lista de tareas',
        body: 'Un tablero **clásico** es un cuadrado de verdad, así que «N igual a 5» significa exactamente 25 casillas y ese número no puede cambiar nunca. Todo lo demás es una lista de tareas de cualquier longitud, que además es el único tipo de tablero que una importación de hoja de cálculo puede hacer crecer. Si vas a generar cien tareas, esa decisión se toma aquí.',
      },
    },

    reveal: {
      title: 'Cómo se abren las casillas',
      intro:
        'Independiente del formato. El interruptor de revelación a nivel de evento sigue siendo la puerta principal — mientras un tablero esté oculto no se ve nada y ninguno de estos motores corre, así que armar un tablero es siempre algo deliberado.',
      rows: [
        {
          term: 'Todas de golpe',
          body: 'el clásico. Cada casilla es jugable en el momento en que revelas el tablero, y los equipos eligen su propio orden. Elige esto salvo que tengas motivo para no hacerlo.',
        },
        {
          term: 'Programado',
          body: 'cada casilla lleva su propia hora de revelación, fijada en la pestaña Tiles, y se abre cuando llega esa hora. Un tablero de «casilla de la hora»: marca el ritmo por ti y exige que las horas se escriban de antemano.',
        },
        {
          term: 'Por intervalos',
          body: 'el motor saca casillas ocultas a intervalos fijos — una tanda cada N minutos, al azar o en orden de tablero. Un cantador de bingo. Sin trabajo extra más allá de las casillas, y el tablero se revela solo mientras duermes.',
        },
        {
          term: 'Recompensa',
          body: 'exactamente una casilla abierta a la vez, y el primer equipo que la termina se la lleva — la casilla se cierra y la siguiente se saca al momento. Despiadado, muy vistoso, e implacable con los husos horarios.',
        },
        {
          term: 'Rotatorio',
          body: 'una ventana deslizante con unas pocas casillas abiertas: cada sorteo abre nuevas y deja caducar las más viejas. A diferencia de la recompensa, a todos les da tiempo a terminar una casilla abierta antes de que desaparezca. Pensado para escaleras individuales.',
        },
      ],
      note: {
        tag: 'La cuestión de los husos horarios',
        body: 'Los tableros de recompensa y por intervalos premian a quien casualmente esté despierto. En un clan repartido por el mundo eso es una ventaja real repartida por el reloj y no por jugar. Las ventanas rotatorias lo suavizan — una casilla abierta sigue abierta lo que dure la ventana, así que un jugador dormido conserva su oportunidad.',
      },
    },

    scoring: {
      title: 'Cuánto vale completar una',
      intro:
        'Tres modificadores, todos solo en modo puntos, todos congelados en la finalización en el instante en que ocurre — un cambio que hagas después nunca reescribe la historia.',
      rows: [
        {
          term: 'Bonificación al primer equipo',
          body: 'puntos extra para el primer equipo que termina cada casilla. La forma más barata de que un tablero con todo visible se sienta como una carrera sin cambiar nada más.',
        },
        {
          term: 'Decaimiento',
          body: 'el valor de una casilla escala linealmente desde el 100 % al revelarse hasta un porcentaje objetivo tras N horas, y luego se mantiene. Por debajo del 100 % decae y premia la velocidad; por encima del 100 % **crece**, lo que premia limpiar las tareas viejas que todos saltaron. La dirección creciente es de la que la gente olvida que existe.',
        },
        {
          term: 'Lockout',
          body: 'la primera finalización cierra la casilla para todos los demás. Implícito en el modo recompensa. En un tablero con mucha diferencia de nivel entre equipos esto puede decidir la competición pronto — está en su mejor momento cuando los equipos están parejos.',
        },
      ],
    },

    missions: {
      title: 'Misiones: sorpresas a mitad de evento',
      body: [
        'Las misiones son casillas creadas de antemano pero retenidas — anunciadas desde su propio conjunto mientras el resto del tablero sigue visible. Son independientes de la política de revelación, así que incluso un bingo normal con todo visible puede tenerlas.',
        'Suéltalas a mano cuando el tablero se apague, a intervalos fijos, o según un calendario por misión. Cada misión lleva su propia puntuación: su lockout, su bonificación, su decaimiento y su caducidad, fijados por casilla y no para el evento.',
        'Son la forma más barata de despertar un tablero el quinto día — y el quinto día es el día en que todo evento largo necesita que lo despierten.',
      ],
    },

    choose: {
      title: 'Elegir, en una página',
      intro: 'Si sabes qué sensación quieres, esta es la ruta más corta.',
      rows: [
        { term: 'Un bingo de clan normal', body: 'Cuadrícula clásica, todas las casillas visibles. Añade una bonificación al primer equipo si quieres algo de prisa.' },
        { term: 'Cientos de tareas, puntuadas por dificultad', body: 'Leagues, todo visible. Es además la única forma en la que puede crecer una importación grande de hoja de cálculo.' },
        { term: 'Una semana que construye hacia algo', body: 'Leagues con revelación programada o por intervalos, para que el tablero se abra a lo largo de la semana en vez de de golpe.' },
        { term: 'Una noche que la gente sigue en directo', body: 'Recompensa. Una casilla, el primer equipo se la lleva, la siguiente al momento.' },
        { term: 'Una competición individual, no por equipos', body: 'Escalera con ventana rotatoria y decaimiento. Las tareas van y vienen y nadie puede guardarlas.' },
        { term: 'Una carrera con meta', body: 'Carrera de casillas — un recorrido ordenado, y gana quien llega más lejos.' },
      ],
      outro:
        'Elijas lo que elijas, las casillas en sí son el mismo trabajo: mira [Monta un tablero que se registra solo]({boardGuide}).',
    },
  },

  fees: {
    metaTitle: 'Cuotas y premios — guía del tesorero de Anvil',
    metaDescription:
      'Cobrar una cuota de inscripción, recaudarla, la segunda firma que la cierra, y convertir el bote en puestos pagados.',
    eyebrow: 'Anvil · para tesoreros',
    title: 'Cuotas y premios',
    dek: 'El dinero es donde los eventos de clan se tuercen, y se tuercen en silencio: una cuota que alguien jura haber pagado, un bote que nadie consigue cuadrar, un reparto de premios que se discute después de que los ganadores se hayan desconectado. Este es el camino que deja rastro en cada paso.',
    facts: [
      { strong: '2 firmas', rest: 'cierran una cuota por defecto' },
      { strong: 'Bote = añadido', rest: '+ cuota × inscripciones aprobadas' },
      { strong: '1 fila', rest: 'por persona que cobra' },
    ],
    footnote:
      'Las cuotas y los premios son terreno del tesorero. Un tesorero puede todo lo que puede un moderador, más esto; un simple moderador no ve las páginas de cuotas en absoluto.',

    set: {
      title: 'Fijar la cuota',
      body: [
        'La cuota de inscripción vive en el evento, se fija al crearlo o se edita desde su pestaña **Sign-ups**. No poner cuota es una respuesta perfectamente válida — montones de eventos funcionan solo con un bote que ha puesto el anfitrión.',
        'Dos ajustes deciden qué significa realmente la cuota, y son fáciles de pasar por alto:',
      ],
      rows: [
        {
          term: 'Por persona o por cuenta',
          body: 'en un evento donde se puede participar con varias cuentas, esto decide si pagan una vez o una vez por cada una. Si te equivocas, vas a devolver dinero.',
        },
        {
          term: 'Fecha límite de pago',
          body: 'una vez pasada, las inscripciones impagadas dejan de ser algo que persigues y pasan a ser una decisión. Ponla antes de lo que crees — el día antes del evento es tarde para buscar un sustituto.',
        },
        {
          term: 'Cuota de invitado',
          body: 'lo que pagan los jugadores que no son miembros de un clan que organiza el tablero. Déjala en blanco y los invitados pagan la cuota de miembro. Para cobrar a un jugador una cantidad distinta, pulsa **Change this player’s fee** en su fila de **Sign-ups**.',
        },
      ],
      note: {
        tag: 'El bote sigue a las inscripciones',
        body: 'El bote que se muestra es lo que has añadido a mano, más la cuota multiplicada por el número de inscripciones **aprobadas**. Se mueve según se aprueban y excluyen inscripciones, así que la cifra de la página es siempre la que podrías pagar de verdad.',
      },
    },

    collect: {
      title: 'Recaudar',
      body: [
        'Las cuotas se recaudan como tu clan ya recauda dinero — en el juego, en Discord, como lo hagáis. El trabajo de Anvil empieza en el momento en que llega: alguien con acceso de equipo la marca como **pagada**, y eso deja constancia de quién dice haberla recibido, y cuándo.',
        'Los jugadores también tienen voz. Un miembro puede informar de a quién pagó y adjuntar una captura, y eso es lo que convierte «yo pagué, seguro» en un registro con dos extremos. Cuando el aviso del jugador y la afirmación del recaudador nombran a personas distintas, es una discrepancia que el sitio puede enseñarte en vez de una que descubres en plena discusión.',
        'Reclamar es un solo botón: **Remind unpaid** en Admin → **Fees** manda un MD de Discord a todos los de ese evento que aún deben.',
      ],
      note: {
        tag: 'La prueba se borra a propósito',
        body: 'Una captura de pago solo se guarda hasta que la cuota se cierra, y luego se elimina. Existe para resolver un desacuerdo, no para quedarse un año en un archivo.',
      },
    },

    sign: {
      title: 'La segunda firma',
      body: [
        'Una cuota queda en **recaudada** hasta que _otro_ miembro del equipo confirma que llegó. Quien manejó el dinero no puede ser también quien firma que apareció — ese es todo el control, y por eso el sitio rechaza la confirmación del propio recaudador en vez de limitarse a desaconsejarla.',
        'Cuántas firmas exige una cuota es un ajuste del clan (**Clan settings → Rules & scoring → Fee sign-off**), de cero a cinco. El cero existe por una razón real: en un clan donde el tesorero _es_ el propietario, no hay nadie más que firme, y «34 cuotas esperando una segunda firma» se convierte en una cola que nunca se puede vaciar y en lo más ruidoso del panel para siempre. En cero, marcar una cuota como pagada **es** la firma.',
        'Ponlo en uno — el valor por defecto — si sois dos. Ponlo en cero si sinceramente no lo sois, y más alto solo si tu clan tiene tanto la gente como el motivo.',
      ],
    },

    pay: {
      title: 'Pagar',
      body: [
        'Cuando el evento termina, la página **Prizes** del evento convierte el bote en una lista de personas. Genérala y obtienes una fila por beneficiario, no por equipo: el premio de un equipo ganador se reparte a partes iguales entre sus miembros, para que pagar sea una lista de nombres y cifras y no un problema de aritmética a medianoche.',
        'Los importes parten de un reparto sugerido — cargado hacia el ganador, y cuantos más puestos pagados pongas más plano se vuelve — y cada fila es editable. La sugerencia es un punto de partida, no una política.',
        'Después les pagas, marcando filas según avanzas. La gracia es que una semana más tarde cualquiera pueda mirar la lista y ver quién cobró qué, en vez de reconstruirlo desde el historial de Discord.',
      ],
      note: {
        tag: 'Anúncialo una vez, desde aquí',
        body: 'Los pagos se publican en vuestros canales de Discord desde el propio evento, así que el anuncio y el registro son lo mismo. Un premio anunciado a mano es un premio del que alguien dirá más tarde que nunca llegó.',
      },
    },

    disputes: {
      title: 'Cuando las cifras no cuadran',
      intro: 'Las cuatro que te vas a encontrar de verdad:',
      rows: [
        {
          term: 'Dice que pagó, nadie lo marcó',
          body: 'pídele que informe del pago con una captura. Eso pone un recaudador con nombre y una marca de tiempo en el registro, y esa persona puede confirmarlo o negarlo.',
        },
        {
          term: 'Dos del equipo creen que lo recibieron',
          body: 'el aviso del propio jugador desempata — nombra a quién le entregó el dinero. Corrige el recaudador y cierra la cuota.',
        },
        {
          term: 'Una cuota atascada esperando una firma',
          body: 'o está esperando de verdad a otra persona, o tu clan tiene menos gente en el equipo de la que supone el ajuste de confirmaciones necesarias. Baja el ajuste en vez de confirmar tu propia recaudación.',
        },
        {
          term: 'El bote cambió después de que se lo dijeras a la gente',
          body: 'sigue a las inscripciones aprobadas, así que aprobar o excluir una inscripción lo mueve. Di el bote tal y como está al cerrar las inscripciones, no al abrirlas.',
        },
      ],
    },
  },

  coffer: {
    metaTitle: 'La caja del clan — guía de Anvil para tesoreros',
    metaDescription:
      'La caja de oro del clan en Anvil: registrar donaciones y acreditarlas a quien las hizo, las tres formas de pagar un premio, quién puede mover el dinero, y qué pasa cuando la caja no llega.',
    eyebrow: 'Anvil · para tesoreros',
    title: 'La caja del clan',
    dek: 'La mayoría de los clanes guarda su oro en el banco de alguien y su contabilidad en la memoria de alguien. La caja es un solo fondo con una línea por movimiento — quién lo dio, a qué está prometido, y quién lo envió de verdad.',
    facts: [
      { strong: '3 cifras', rest: 'en caja, comprometido, libre para prometer' },
      { strong: '3 salidas', rest: 'competiciones semanales, casillas de misión, el bote de un tablero' },
      { strong: 'Tesorero', rest: 'o admin — nunca el rango por sí solo' },
    ],
    footnote:
      'Todo esto está en Admin → **Coffer**, salvo las escalas de premios, que viven en aquello por lo que se paga. La mitad pública es `/coffer`: el saldo, los mayores donantes y los movimientos recientes, para los miembros.',

    what: {
      title: 'Qué es',
      body: [
        'Un libro de cuentas, no un monedero. Anvil nunca guarda vuestro oro — se queda donde el clan ya lo tiene — así que la caja es el registro de lo que entró, de lo que está prometido y de lo que realmente se entregó. Su utilidad está en que la promesa y el pago son dos líneas distintas.',
        'La página abre con tres cifras, y son tres porque responden a tres preguntas distintas:',
      ],
      rows: [
        {
          term: 'En caja',
          body: 'donaciones aprobadas y ajustes. Lo que el clan ha recibido, menos lo que ha dado por perdido.',
        },
        {
          term: 'Comprometido',
          body: 'oro que un premio ha reclamado — ganado pero aún no enviado, más cualquier bote apartado para un tablero. Reservado, aunque siga en el banco de alguien.',
        },
        {
          term: 'Libre para prometer',
          body: 'en caja menos comprometido. La única cifra contra la que se contrasta un premio nuevo, porque la alternativa es prometer los mismos 50M a dos ganadores mientras el tesorero duerme.',
        },
      ],
      note: {
        tag: 'Una donación pendiente no cuenta en ningún sitio',
        body: 'Que alguien escriba «di 100M» es una afirmación sobre el pasado, no oro en un banco. Queda fuera de las tres cifras hasta que el staff la reconozca, de modo que nunca puede financiar un premio que luego no se pueda pagar.',
      },
    },

    inbound: {
      title: 'Meter oro',
      body: [
        'El plugin de RuneLite se encarga solo del caso normal: abre el Clan Coffer en el juego y Anvil registra los depósitos y las retiradas a partir de su saldo real de monedas. El primer vistazo es solo una referencia — nunca da por hecho que quien lo abrió donó todo lo que ya había dentro.',
        'Los registros manuales siguen ahí para todo lo que pasó mientras nadie tenía el plugin abierto. Un miembro declara su propia donación desde `/coffer` y esta espera a que el staff se la crea; un tesorero registra una que ya llegó, y el hecho de teclearla **es** la aprobación.',
        'En ambos casos se acredita a una **persona**. Pesa más de lo que parece: la lista de mayores donantes de la página pública es el único agradecimiento que la mayoría recibirá, y el oro que llega como «el clan» no agradece a nadie.',
      ],
      rows: [
        {
          term: 'Abre la caja en el juego',
          body: 'con Anvil activado y con la sesión iniciada (Profile sync → **Sync Clan Coffer** viene activado por defecto). Un mensaje del juego que coincida te acredita a ti tu propio depósito o retirada; los cambios que se ven tras un tiempo sin mirar se cuadran sin nombrar a quien los observó. Admin → Coffer muestra la última cantidad física y cuándo se vio.',
        },
        {
          term: 'La declara un miembro',
          body: 'desde la página pública de la caja, con captura si la tiene. Llega como pendiente y aparece en tu cola. Aprobarla es lo que la convierte en dinero real.',
        },
        {
          term: 'La registras tú',
          body: 'Admin → Coffer → **Record a donation**. Busca en la lista quién la dio, pon una cantidad junto al nombre, listo. También se puede acreditar a invitados — quien no es miembro de pleno derecho igualmente pudo aportar.',
        },
        {
          term: 'Varios juntos',
          body: 'selecciónalos a todos, escribe el total y pulsa **Split … ways**, y luego ajusta a mano una parte si hace falta. Escribe una línea por persona en vez de una línea con una lista, así cada uno aparece en la lista de donantes con su propio nombre.',
        },
      ],
      note: {
        tag: 'Un ajuste es otra cosa',
        body: '**Correct the pot** es para oro que se movió al margen de todo esto — arrancar la caja, gastarla en algo que Anvil nunca vio, corregir un error. A propósito no pertenece a nadie, y deliberadamente no es la forma de registrar un regalo.',
      },
    },

    out: {
      title: 'Las tres formas en que paga',
      intro: 'Todo premio en Anvil sale de este mismo fondo, y cada vía decide a los ganadores a su manera. Configura la escala donde vive aquello que se gana — la caja nunca pregunta quién ganó qué.',
      rows: [
        {
          term: 'Una semanal, en su propia página',
          body: 'un Skill o Boss of the Week lleva una escala de puestos: el primero se lleva esto, el segundo aquello. Se liquida **una sola vez** al terminar la competición, según la clasificación final — mientras corre no cambia nada de manos. Configúrala al crear la competición, o después desde la página de la propia competición.',
        },
        {
          term: 'Una casilla de misión, en el tablero',
          body: 'las misiones pagan en el orden en que la gente termina, así que su escala se reclama en lugar de liquidarse: el primer equipo que la complete se lleva el oro del primer puesto. Se configura en la sección rewards de la casilla, en cualquier tablero que permita misiones.',
        },
        {
          term: 'El bote de un tablero',
          body: 'un bingo reparte su propio bote entre los puestos, así que la caja solo le pasa una cifra. Event → **Prizes** → *From the clan coffer*. Se suma a las cuotas de inscripción y a lo que hayas añadido a mano, y el reparto entre puestos se configura en esa misma página. También eliges si la caja **retiene** ese oro ya o solo anota la promesa: todavía no ha salido, y un tablero dentro de seis semanas no necesita medio bote congelado hasta entonces.',
        },
      ],
      note: {
        tag: 'Cuando hay empate',
        body: 'Una escala semanal puede **repartir los empates**: todos los empatados juntan los puestos que ocupan y se llevan una parte igual, de modo que tres jugadores con 40 kc cada uno se llevan un tercio del primero, segundo y tercero en vez de que el primero de ellos se lo lleve todo. Déjalo desactivado y decide el orden de la clasificación. Ambas opciones son defendibles — decidirlo con los resultados ya puestos no lo es.',
      },
    },

    who: {
      title: 'Quién puede moverla',
      intro: 'El dinero es un permiso aparte, no un rango. Un moderador puede aprobar una prueba sin tocar nunca la caja, y eso es deliberado, no un descuido.',
      rows: [
        {
          term: 'Tesorero o admin',
          body: 'todo el libro: registrar y aprobar donaciones, ajustar la caja, configurar escalas de premios, marcar un premio como enviado. El propietario cuenta aquí como admin.',
        },
        {
          term: 'Un moderador',
          body: 'nada de eso. Ni siquiera verá la página de la caja — recaudar dinero es trabajo del tesorero, y el rango por sí solo nunca ha dado ese derecho.',
        },
        {
          term: 'Un tesorero de tablero',
          body: 'el dinero de un solo evento: sus cuotas, sus pagos, su bote. Se concede por tablero, y así un clan visitante lleva su propia mitad de un clan contra clan sin que le entreguen vuestra contabilidad. A la caja del clan no llega.',
        },
        {
          term: 'Cualquier miembro',
          body: 'puede declarar una donación y leer la página pública. Eso es todo.',
        },
      ],
      note: {
        tag: 'Cuéntaselo al clan, en un canal',
        body: 'Apunta el **Coffer ledger** a un canal de Discord en Admin → Discord → What goes where → **Staff only** y cada movimiento se publica con el saldo que deja detrás. Es el único feed sin alternativa: déjalo vacío y no se publica nada sobre el dinero en ningún sitio. Ver [Anvil en Discord]({discordGuide}).',
      },
    },

    short: {
      title: 'Cuando la caja no llega',
      body: [
        'Un premio mayor que la caja no se rechaza. Se anota como **debido y sin cobertura** — una línea real, con el nombre de un ganador — porque la alternativa es un ganador sin nada y sin rastro de que se le prometiera algo.',
        'Así que la solución es la de siempre: mete oro y luego paga. Lo que no hay que hacer es cambiar la escala en silencio después; el libro ya dice qué se anunció, y que ambos se contradigan es peor que ir corto.',
      ],
      note: {
        tag: 'Anvil no envía nada',
        body: 'Todo premio acaba con una persona entregando oro en el juego y marcando una línea. El trabajo del libro es asegurar que esa línea existe, que dice quién y cuánto, y que una semana después nadie tenga que reconstruirla del historial de Discord.',
      },
    },
  },

  commands: {
    metaTitle: 'Comandos slash de Discord — Anvil',
    metaDescription:
      'Todos los comandos slash de Anvil — /bingo, /sotw, /botw, /eff, /coffer, /stats y /guide — con cada opción explicada, ejemplos, quién puede usar qué, y soluciones cuando los comandos no aparecen.',
    eyebrow: 'Anvil · en Discord',
    title: 'Comandos slash',
    dek: 'Escribe `/` en el Discord de tu clan y Anvil responde desde el sitio en directo: el tablero, la clasificación, tu propio cartón, las semanales, la caja y las estadísticas de cualquiera. Esta página es la lista completa, generada a partir de los comandos que el bot registra de verdad, así que nunca está desactualizada.',
    facts: [
      { strong: 'Privado', rest: 'respuestas que solo ves tú, con un botón para compartir' },
      { strong: 'Tu idioma', rest: 'el que tengas configurado en Discord' },
      { strong: 'Solo lectura', rest: 'salvo /coffer add y remove' },
    ],
    footnote:
      'Configurar el bot en primer lugar está en la [guía de Discord](/guide/discord). Esta página trata de cómo usarlo.',

    using: {
      title: 'Cómo funciona un comando',
      body: [
        'Escribe `/` en cualquier canal que el bot pueda ver y elige un comando de Anvil de la lista. Discord muestra entonces sus opciones como casillas para rellenar: pulsa Tab o haz clic en una para añadirla. Abajo, las opciones marcadas `<angle brackets>` (entre ángulos) son obligatorias; las marcadas `[square brackets]` (entre corchetes) son opcionales y puedes omitirlas.',
        'Toda respuesta es **privada**: solo la ves tú, así que mirar el tablero diez veces al día no molesta a nadie. Si merece la pena enseñarlo al canal, pulsa **Share to channel** debajo de la respuesta. La copia compartida se genera en ese momento, así que una clasificación compartida más tarde es la clasificación tal como esté entonces.',
      ],
      rows: [
        { term: 'Obligatoria', body: '`<amount>` — Discord no enviará el comando hasta que esté rellenada.' },
        { term: 'Opcional', body: '`[member]` — si la omites, el comando responde sobre ti, tu equipo o todo el clan.' },
        { term: 'Una lista', body: 'elige uno de los valores que ofrece Discord; no puedes escribir el tuyo.' },
        { term: 'Escribe para buscar', body: 'empieza a escribir y elige entre las sugerencias, como nombres de jefes o tus propias cuentas.' },
        { term: 'Un miembro', body: 'elige a alguien del servidor, igual que con una @mención.' },
      ],
      note: {
        tag: 'Los comandos solo funcionan en el servidor de tu clan',
        body: 'Cada respuesta trata de un clan, y un MD no tiene ningún clan sobre el que responder. Por eso los comandos no aparecen en los MD.',
      },
    },

    bingo: {
      title: 'Comandos del tablero: /bingo',
      intro:
        '`/bingo` trata de un solo tablero. Cuando hay varios tableros en marcha, **board** y **leaderboard** los listan todos; el resto responde sobre el tablero en curso, si no el próximo en empezar, y si no el que acaba de terminar.',
    },

    clan: {
      title: 'Comandos del clan',
      intro:
        'Estos responden sobre el clan y no sobre un tablero, así que funcionan haya o no un bingo en marcha: las semanales, la eficiencia, la caja, las estadísticas de cualquiera y las guías de configuración.',
    },

    options: {
      title: 'Opciones que verás por todas partes',
      intro: 'Algunas opciones significan lo mismo en todos los comandos que las tienen:',
      rows: [
        {
          term: '`member`',
          body: 'otra persona del servidor. Omítela para preguntar por ti. Encuentra su cuenta de Anvil a través del inicio de sesión con Discord que usó en el sitio, así que solo funciona con miembros que hayan entrado en Anvil al menos una vez.',
        },
        {
          term: '`account`',
          body: 'cuál de las cuentas de OSRS de esa persona, para quien tenga alts. Escribe para elegir; omítela para su cuenta principal.',
        },
        {
          term: '`page`',
          body: 'un jefe o actividad, escribiendo para buscar: `Zulrah`, `Theatre of Blood`, `Tempoross`. Omítela para la vista general.',
        },
        {
          term: '`language`',
          body: 'responder esta vez en otro idioma. Por defecto recibes el idioma de tu Discord, o el idioma del bot que haya elegido el clan.',
        },
        {
          term: '`amount`',
          body: 'oro como se dice normalmente: `5m`, `2.5b`, `500k`, o un número sin más como `2,500,000`.',
        },
      ],
    },

    who: {
      title: 'Quién puede usar qué',
      body: [
        'Cualquiera en el servidor puede usar todos los comandos de solo lectura. Lo que ves es lo que vería un miembro: un tablero cuyas casillas aún no se han revelado también sigue oculto en Discord, incluso para el staff.',
        'Los comandos que responden sobre **ti** (`/bingo me`, `/stats` sin miembro) necesitan saber qué cuenta de Anvil es la tuya. La encuentran a través del inicio de sesión con Discord que usaste en el sitio, así que entra en Anvil con Discord una vez y a partir de ahí funcionan.',
      ],
      rows: [
        { term: 'Todo el mundo', body: 'todos los comandos salvo `/coffer add` y `/coffer remove`.' },
        {
          term: 'Tesoreros, admins, propietarios',
          body: '`/coffer add` y `/coffer remove`. Se comprueba con tu rol **en el sitio de Anvil**, nunca con tu rol de Discord, porque un rango en un servidor de chat nunca ha significado controlar el dinero del clan.',
        },
      ],
    },

    trouble: {
      title: 'Cuando un comando no funciona',
      intro: 'Las causas habituales, más o menos en el orden en que ocurren:',
      rows: [
        {
          term: 'No hay comandos de Anvil en la lista',
          body: 'el bot se invitó sin sus comandos — es un permiso aparte, y los enlaces de invitación antiguos solo pedían uno. Un admin vuelve a usar **Invite / re-invite the bot** desde Admin → Discord → **Connection**. No expulsa al bot ni reinicia nada. Los comandos recién añadidos pueden tardar hasta una hora en aparecer.',
        },
        {
          term: '«The application did not respond»',
          body: 'Anvil no estuvo disponible un momento, normalmente en mitad de una actualización. Vuelve a lanzarlo unos segundos después.',
        },
        {
          term: '«No estás en este tablero» sobre ti',
          body: 'o no te has apuntado a este tablero, o Anvil no consigue enlazar tu Discord con tu cuenta. Inicia sesión en el sitio con esta cuenta de Discord y revisa tu perfil.',
        },
        {
          term: 'Las estadísticas de un miembro salen vacías',
          body: 'todavía no ha entrado en Anvil con Discord, o aún no se han leído los hiscores de su cuenta. Prueba otra vez con la opción `account`, o pídele que inicie sesión una vez.',
        },
        {
          term: '`/coffer add` dice que no puedes',
          body: 'tu rol en el sitio de Anvil no es tesorero, admin ni propietario, o este Discord no es la cuenta con la que inicias sesión en el sitio.',
        },
      ],
    },

    labels: {
      options: 'Opciones',
      noOptions: 'Sin opciones — simplemente ejecútalo.',
      example: 'Ejemplo',
      examples: 'Ejemplos',
      required: 'obligatoria',
      optional: 'opcional',
      choices: 'Valores',
      range: 'de {min} a {max}',
      kinds: {
        text: 'texto',
        number: 'número',
        member: 'un miembro',
        choice: 'elegir de una lista',
        search: 'escribe para buscar',
        yesno: 'sí o no',
      },
    },

    examples: {
      'bingo board': {
        examples: ['/bingo board'],
        tip: 'El tablero que está en marcha ahora mismo. Hasta que se revele, los nombres de las casillas también siguen ocultos aquí.',
      },
      'bingo leaderboard': {
        examples: ['/bingo leaderboard'],
        tip: 'La clasificación de equipos, por puntos o por casillas según cómo puntúe el tablero.',
      },
      'bingo rules': {
        examples: ['/bingo rules'],
        tip: 'Cómo puntúa este tablero (leído del propio evento, así que siempre es correcto), y luego las normas de la casa de tu clan.',
      },
      'bingo apply': {
        examples: ['/bingo apply'],
        tip: 'Cómo entrar: las inscripciones, la cuota, y cómo va tu propia inscripción.',
      },
      'bingo next': {
        examples: ['/bingo next'],
        tip: 'Lo que viene ahora: una revelación de casillas, una misión o una fecha límite.',
      },
      'bingo me': {
        examples: ['/bingo me'],
        tip: 'Tu equipo, tu puesto y las casillas que se te han acreditado.',
      },
      'bingo help': {
        examples: ['/bingo help'],
        tip: 'Una lista breve de lo que responde el bot, dentro de Discord.',
      },
      'bingo team': {
        examples: ['/bingo team', '/bingo team name:Iron Wolves'],
        tip: 'La ficha de un equipo: puntuación, plantilla y casillas recientes. Omite el nombre para ver tu propio equipo.',
      },
      sotw: {
        examples: ['/sotw', '/sotw language:Deutsch'],
        tip: 'Cada Skill of the Week activo, los primeros de cada uno y en qué puesto vas tú.',
      },
      botw: {
        examples: ['/botw'],
        tip: 'Cada Boss of the Week activo y su clasificación en directo.',
      },
      eff: {
        examples: ['/eff', '/eff metric:Hours bossed'],
        tip: 'La clasificación de eficiencia del clan y tu puesto en ella. horas jugadas por defecto; elige horas de jefes para jefes.',
      },
      'coffer balance': {
        examples: ['/coffer balance'],
        tip: 'El saldo de la caja, los mayores donantes y los últimos movimientos.',
      },
      'coffer add': {
        examples: ['/coffer add amount:5m', '/coffer add amount:250k note:Raffle proceeds'],
        tip: 'Solo tesoreros, admins y propietarios. Registra oro que entra; también se publica en el canal del feed de la caja.',
      },
      'coffer remove': {
        examples: ['/coffer remove amount:20m note:SOTW prize'],
        tip: 'Solo tesoreros, admins y propietarios. Se niega a dejar la caja por debajo de cero; regístralo en la página de la caja si de verdad es lo que quieres.',
      },
      'stats profile': {
        examples: ['/stats profile', '/stats profile player:Zezima'],
        tip: 'Una cuenta de un vistazo: nivel de combate y total, horas jugadas y horas de jefes, número de entradas del collection log y récords personales.',
      },
      'stats levels': {
        examples: ['/stats levels', '/stats levels player:My Iron'],
        tip: 'El nivel y la XP de cada habilidad.',
      },
      'stats efficiency': {
        examples: ['/stats efficiency'],
        tip: 'Horas jugadas y horas de jefes, y de qué habilidades y jefes salen.',
      },
      'stats clog': {
        examples: ['/stats clog', '/stats clog page:Zulrah'],
        tip: 'El progreso del collection log en general, o la página de un jefe.',
      },
      'stats pbs': {
        examples: ['/stats pbs', '/stats pbs page:Theatre of Blood mode:Hard size:3'],
        tip: 'Récords personales. Las raids guardan un tiempo por modo y tamaño de equipo, así que usa `mode` y `size` para encontrar la run que buscas.',
      },
      'stats luck': {
        examples: ['/stats luck', '/stats luck player:Zezima'],
        tip: 'Cuánta suerte ha tenido la cuenta con los drops que sigue Anvil.',
      },
      'stats collectors': {
        examples: ['/stats collectors'],
        tip: 'Los collection logs más grandes del clan.',
      },
      'stats luckboard': {
        examples: ['/stats luckboard'],
        tip: 'Los miembros del clan más secos y los que más suerte tienen.',
      },
      setup: {
        examples: ['/setup topic:Plugin setup', '/setup topic:Plugin setup step:5'],
        tip: 'Una guía de configuración dentro de Discord: la lista de pasos, o un solo paso con un enlace directo a él en el sitio.',
      },
      guide: {
        examples: ['/guide guide:ToB 4-man gear'],
        tip: 'Una de las guías de juego del clan (raids, bossing, money making…): empieza a escribir su nombre y elígela de la lista.',
      },
    },
  },
  moderator: {
    metaTitle: 'De guardia — guía del moderador de Anvil',
    metaDescription:
      'Un día de moderador en un sitio de clan de Anvil: la cola, revisar envíos y cuentas, mantener honesta la lista de miembros, y los criterios.',
    eyebrow: 'Anvil · para moderadores',
    title: 'De guardia',
    dek: 'Un moderador se ocupa del trabajo que llega haya o no evento en marcha: pruebas que mirar, cuentas que verificar, una lista de miembros que se desvía. Esto es de qué está hecha la cola, y cómo vaciarla sin convertirte tú en el motivo por el que la gente espera.',
    facts: [
      { strong: 'Sin eventos', rest: 'un moderador no puede crearlos ni editarlos' },
      { strong: 'Una página', rest: 'dice qué te está esperando' },
      { strong: 'Aprueba rápido', rest: 'una cola lenta parece un sitio roto' },
    ],
    footnote:
      'Un moderador ve todo lo que ve un miembro, más las pantallas de revisión. Crear y editar eventos, los ajustes, el equipo y los pagos son tarea de admins y tesoreros — si falta un botón, es por eso, y es a propósito.',

    what: {
      title: 'En qué consiste el rol',
      intro:
        'Los roles se apilan hacia abajo: todo lo que puede un moderador lo pueden también un tesorero y un admin. Lo que le pertenece en concreto a un moderador:',
      canList: [
        'la lista de miembros: añadir y quitar gente, y responder a las solicitudes para unirse ([Tu gente]({peopleGuide}))',
        'las verificaciones de cuentas — el reto de XP y la revisión manual',
        'los envíos y las capturas de prueba',
        'las competiciones semanales y el calendario',
        'los eventos del calendario del clan',
      ],
      cantIntro: 'Lo que no pueden, a propósito:',
      cantList: [
        'crear o editar un evento, o sus casillas',
        'cambiar los ajustes del clan o la conexión con Discord',
        'ascender a nadie, ni tocar el equipo',
        'cerrar una cuota o ejecutar un pago',
      ],
    },

    queue: {
      title: 'Empieza por lo que te está esperando',
      body: [
        'El panel de admin no es un resumen del sitio — es una lista de lo que está esperando, ordenada por cuánto importa, calculada con datos reales y no con contadores que se desvían. Si dice que no te espera nada, no te espera nada.',
        'Trabaja de arriba abajo. Los elementos que suben arriba son los que tienen a una persona al otro lado: alguien que no puede inscribirse porque su cuenta no está verificada, o cuyo drop no ha contado porque nadie lo ha mirado todavía.',
      ],
    },

    submissions: {
      title: 'Envíos y pruebas',
      body: [
        'La mayoría de los créditos nunca llegan hasta ti: el plugin ve el drop, archiva una captura sellada con el equipo y una marca de tiempo UTC, y la casilla se completa. Lo que cae en la cola son las casillas manuales y todo lo que el plugin haya marcado.',
        'El sello es lo que hace difícil discutir una prueba. Una captura del plugin lleva el equipo y el momento incrustados en la imagen, y con la prueba de dos fotogramas activada, un segundo fotograma un par de segundos después muestra el loot ya en el suelo. Una captura sin nada de eso es una captura de móvil, lo cual está bien — solo significa que el que comprueba eres tú.',
      ],
      rows: [
        {
          term: 'Aprueba cuando sea plausible',
          body: 'no estás auditando un banco. Si la imagen muestra la cosa, la cuenta está en la lista de miembros y la marca de tiempo cae dentro del evento, apruébalo y sigue.',
        },
        {
          term: 'Rechaza con un motivo',
          body: 'un rechazo sin explicación te vuelve como mensaje privado en menos de una hora. Di qué faltaba para que el segundo intento salga bien.',
        },
        {
          term: 'Un envío marcado es una pregunta, no una acusación',
          body: 'el plugin marca lo que no ha podido confirmar del todo — casi siempre un jugador que no ha entregado foto de salida. Léelo como «mira esta», no como «alguien ha hecho trampas».',
        },
      ],
    },

    verify: {
      title: 'Verificar cuentas',
      intro:
        'Nadie puede inscribirse en un evento sin al menos una cuenta verificada, así que esta cola impide directamente que la gente juegue. Es la que merece vaciarse a diario.',
      rows: [
        {
          term: 'Verificada por el plugin',
          body: 'tras la primera comprobación de propiedad, el plugin reconoce la cuenta automáticamente y una huella estable mantiene el vínculo al cambiar de nombre. Una cuenta del roster sin huella conocida usa una vez la comprobación por XP o la aprobación de un moderador.',
        },
        {
          term: 'Verify by XP',
          body: 'para jugadores sin plugin. El sitio elige una habilidad al azar y tienen que ganar 1.000 XP en ella en treinta minutos. Se comprueba solo — tú solo ves a los que fallan.',
        },
        {
          term: 'Revisión manual',
          body: 'Hiscores ocultos, o una cuenta secundaria demasiado nueva para aparecer en ellos. Alguien envía un RSN con una nota y tú decides. Pide una captura de la pantalla de inicio de sesión si la nota no basta.',
        },
      ],
      note: {
        tag: 'Verificado no es lo mismo que miembro',
        body: 'Verificar una cuenta dice «esta es realmente suya». No lo mete en el clan. La pertenencia solo viene de una sincronización de la lista desde el juego o de que el staff lo añada a mano, y un puesto de invitado solo de una solicitud para unirse que el staff apruebe (o al momento, si el clan deja entrar a cualquiera). Es a propósito, y es lo que impide que nadie entre en tu clan escribiendo un nombre.',
      },
    },

    roster: {
      title: 'Mantener honesta la lista de miembros',
      body: [
        'La lista de miembros viene de un único sitio: un admin lanza una sincronización desde la lista del clan en el juego, con el botón **Anvil** de la barra de título de la ventana del clan (o **Sync roster** en el panel lateral del plugin). Todo lo demás — verificaciones, vínculos, inscripciones — cuelga de ahí.',
        'Así que el mantenimiento es pequeño pero real: pide a un admin que lance la sincronización después de cada ronda de reclutamiento (convierte en miembros a los invitados que se unieron en el juego), responde a las solicitudes para unirse arriba en la pestaña **Roster**, y repasa **Needs review** en vez de esperar a que la gente se queje. Mira [Tu gente]({peopleGuide}).',
      ],
      note: {
        tag: 'Visto por última vez no es jugado por última vez',
        body: 'La marca de «visto por última vez en el clan» registra la última sincronización que lo encontró, no la última vez que inició sesión. Para «¿sigue jugando?», lee en su lugar la hora de sus estadísticas en vivo — esa es la que se mueve sola.',
      },
    },

    startshot: {
      title: 'Revisar fotos de salida',
      body: [
        'En un evento que la exige, cada jugador tiene que entregar una captura tomada después del arranque, en un lugar sorteado en el instante del inicio. Las capturas del plugin con palabra clave verificada llegan ya aceptadas, así que en la práctica solo miras a los jugadores que han subido a mano desde un móvil.',
        'Lo que compruebas es poco: que el personaje sale en la imagen, que la palabra clave está en el chat, y que es la palabra clave que le tocó a ese jugador. Las subidas cuentan de inmediato y tú las revisas después, así que a nadie se le impide jugar mientras te espera.',
      ],
    },

    judgement: {
      title: 'Los criterios que vas a tener que aplicar',
      intro:
        'Ninguno tiene una respuesta correcta en el software, y justo por eso acaban en manos de una persona.',
      rows: [
        {
          term: 'La prueba es real pero tardía',
          body: 'el drop ocurrió dentro del evento y la captura llegó después de terminar. Aprueba, por lo general — mira el sello de la imagen, no la hora de subida.',
        },
        {
          term: 'La cuenta aún no está vinculada',
          body: 'el drop es auténtico, la cuenta es suya, simplemente no se añadió antes de jugar. Que la vincule, y luego apruébalo. No hagas que nadie repita una raid por papeleo.',
        },
        {
          term: 'Parece montado',
          body: 'llévalo a un admin en vez de rechazarlo tú. Un rechazo es una acusación pública dentro de un clan pequeño, y no debería ser nunca la decisión rápida de una sola persona.',
        },
        {
          term: 'Tú estás en el evento',
          body: 'casi con seguridad lo estás. Pasa cualquier cosa que tenga que ver con tu propio equipo a otro moderador — no porque fueras a ser injusto, sino porque no deberías tener que demostrar que no lo fuiste.',
        },
      ],
    },
  },

  tiles: {
    metaTitle: 'Reglas y límites de las casillas — Anvil',
    metaDescription:
      'Lo que cada tipo de casilla de bingo necesita de ti (ajustes del juego, el plugin de RuneLite, un collection log sincronizado, un puesto en los hiscores) y los límites de lo que puede seguir.',
    eyebrow: 'Anvil · para jugadores',
    title: 'Reglas y límites de las casillas',
    dek: 'Cada casilla muestra lo que necesita de ti y lo que no puede hacer. Esta página explica cada línea; los enlaces **Why?** de una casilla llevan aquí.',
    needs: 'Necesita',
    limit: 'Conviene saber',
    checked: 'La casilla lo comprueba por ti',
    englishOnly: 'Las reglas de abajo están en inglés por ahora, para que siempre coincidan con lo que el sitio hace de verdad.',
  },

  // /guide/creators — guía del anfitrión para un espacio de creador.
  creators: {
    metaTitle: 'Organiza un bingo de OSRS para tus espectadores — Anvil',
    metaDescription:
      'Organiza un bingo o una carrera de casillas de Old School RuneScape para tu stream, sin clan: crea un espacio, comparte un enlace, elige quién puede entrar (Twitch, Kick, YouTube o Discord) y pon el tablero en el stream con OBS.',
    eyebrow: 'Para streamers y creadores',
    title: 'Organizar eventos para tus espectadores',
    dek: 'Un espacio de creador te deja organizar un bingo para tu stream. No necesitas un clan en el juego. Creas un evento, compartes un enlace y tus espectadores se unen.',
    facts: [
      { strong: 'Sin clan', rest: 'necesario' },
      { strong: 'Gratis', rest: 'para empezar' },
      { strong: 'Un enlace', rest: 'para tu chat' },
    ],

    what: {
      title: 'Qué es un espacio de creador',
      body: [
        'Es tu propia página en Anvil, en `{apex}/c/tu-nombre`. Ahí organizas eventos para tus espectadores.',
        'No es un clan. No hay lista de clan, ni rangos, ni competiciones semanales. Quien se une a tu evento juega ese evento. Nada más.',
        'Los espectadores inician sesión con Discord, añaden su personaje de RuneScape y pulsan **Join**. Después el plugin de Anvil para RuneLite cuenta sus drops solo.',
      ],
    },

    create: {
      title: 'Crea tu espacio',
      body: [
        'Ve a [{apex}/host](/host) e inicia sesión con Discord.',
        'Escribe un nombre para tu espacio. El nombre de tu canal es buena idea. Tu enlace se hace con el nombre. Pulsa **change link** si quieres otro.',
        'Pulsa **Create my space**. Tienes un espacio por cuenta de Discord.',
      ],
    },

    first: {
      title: 'Crea tu primer evento',
      body: [
        'Justo después de crear tu espacio llegas a **Create your first event**. Más adelante usa **+ New event** arriba de **Your events**.',
        '**Name.** Lo que verán tus espectadores.',
        '**What kind?** Elige una tarjeta. **Team bingo** es una cuadrícula de 5×5 y Anvil reparte a los jugadores en equipos por ti. **Solo bingo** es la misma cuadrícula, cada jugador por su cuenta. **Team race** son tareas en orden: gana el equipo que vaya más lejos.',
        '**Ready-made tiles** te da una mezcla de tareas fáciles y difíciles que puedes cambiar después. **Blank, I’ll write my own** empieza vacío.',
        '**Who can join?** Déjalo en **Anyone**, o elige quién puede entrar. Mira el paso 5.',
        '**When?** Elige las fechas de inicio y fin. O déjalo vacío y empieza el evento tú cuando estés listo.',
        'Pulsa **Create event**. Luego pulsa **Copy invite link**.',
      ],
    },

    share: {
      title: 'Comparte el enlace',
      body: [
        'Pega el enlace de invitación en el chat de tu stream, en tu Discord o en tus redes. Ese enlace es todo lo que tus espectadores necesitan.',
        'Puedes copiarlo otra vez cuando quieras: **Your events** → **Copy invite link** junto al evento.',
        '¿Quieres que el bot responda `!join` en el chat con el enlace? Mira el paso 9.',
      ],
    },

    who: {
      title: 'Elige quién puede entrar',
      body: [
        'Todo evento empieza abierto a **Anyone**. Para dejarlo solo a tu comunidad, abre **Settings** → **Viewers** → **Who can join?** del evento y elige una o más opciones. Las mismas opciones están en la pantalla del primer evento.',
        'Si eliges más de una, **con cumplir una basta**. Entra un seguidor O un booster del servidor.',
      ],
      intro: 'Cada opción, y lo que tiene que hacer el espectador:',
      rows: [
        {
          term: 'Anyone',
          body: 'Cualquiera con el enlace entra de inmediato.',
        },
        {
          term: 'Twitch followers',
          body: 'El espectador pulsa **Link Twitch** en la página del evento e inicia sesión con Twitch. Anvil comprueba que te sigue.',
        },
        {
          term: 'Twitch subs',
          body: 'Igual que los seguidores, pero tiene que estar suscrito. Elige el nivel mínimo: **Tier 1 or higher**, **Tier 2 or higher** o **Tier 3**. Las suscripciones Prime cuentan como nivel 1. Tu canal debe ser afiliado o socio de Twitch.',
        },
        {
          term: 'Kick followers',
          body: 'Kick no dice a las apps quién te sigue, así que Anvil cuenta a quien te sigue _después_ de que conectes Kick. ¿Te seguía antes? El espectador deja de seguirte y vuelve a seguirte. ¿Tu chat de Kick es solo para seguidores? Activa **My Kick chat is followers-only** en el recuadro **Kick channel**. Así, un espectador que escribe su código de Anvil en tu chat cuenta como seguidor.',
        },
        {
          term: 'Kick subs',
          body: 'Los suscriptores que Anvil vio después de conectar Kick cuentan solos. Los demás pulsan **Get Kick code** y escriben el código (se parece a `ANVIL-7F3K9Q`) en tu chat de Kick, y Anvil ve su insignia de suscriptor. Kick no tiene niveles de suscripción.',
        },
        {
          term: 'YouTube subscribers',
          body: 'El espectador pulsa **Check my YouTube subscription** e inicia sesión con Google. Sus suscripciones deben ser públicas en YouTube.',
        },
        {
          term: 'YouTube members',
          body: 'El espectador escribe su código de Anvil en tu chat en directo de YouTube. Por eso los miembros solo pueden entrar **mientras estás en directo**.',
        },
        {
          term: 'Discord role',
          body: 'Gente con un rol que elijas en tu servidor de Discord (hasta 5 roles). Conecta antes tu servidor: **Discord (optional)** en el menú.',
        },
        {
          term: 'Server boosters',
          body: 'Gente que hace boost a tu servidor de Discord. También necesita tu servidor conectado.',
        },
      ],
      note: {
        tag: 'Conviene saber',
        body: 'Conecta antes tu canal (paso 7), o las opciones de Twitch, Kick y YouTube se quedan en gris. Una cuenta de Twitch, Kick o YouTube solo puede meter a un jugador en cada evento. Tu staff, y la gente que invitas por nombre, se saltan las comprobaciones.',
      },
    },

    approve: {
      title: 'Aprueba a cada jugador (opcional)',
      body: [
        '¿Quieres elegir quién juega? Abre **Settings** → **Viewers** → **Who can enter** del evento y elige **Ask me about everyone**. Pulsa **Save changes**.',
        'Ahora los espectadores pulsan **Ask to join** en vez de **Join**. Antes tienen que pasar tus opciones de **Who can join?**.',
        'Sus solicitudes aparecen en **Your events** como **N waiting for you**. Haz clic ahí, o abre la pestaña **Sign-ups** del evento. La lista de arriba se llama **Waiting for your yes**. Acepta o rechaza cada una.',
      ],
    },

    channels: {
      title: 'Conecta tu Twitch, Kick o YouTube',
      body: [
        'Abre **Settings** en el menú. En el recuadro **Twitch channel**, **YouTube channel** o **Kick channel**, pulsa **Connect Twitch**, **Connect YouTube** o **Connect Kick**, e inicia sesión como tu canal.',
        'Cada canal que conectas aparece en tu página como un enlace **verified**. No puedes escribir un enlace a mano: iniciar sesión es cómo Anvil sabe que el canal es tuyo.',
        'Un canal solo se puede conectar a un sitio en Anvil. Si ya está en otro espacio o clan tuyo, Anvil te pregunta si quieres moverlo.',
      ],
    },

    overlay: {
      title: 'Pon el tablero en el stream (OBS)',
      body: [
        'En **Your events**, pulsa **Stream overlay** junto al evento y luego **Make overlay links**.',
        'Obtienes tres enlaces. **Standings**: los mejores equipos y cuánto llevan. **Feed**: los últimos drops y casillas completadas. **Board**: el tablero, con las casillas completadas marcadas.',
        'Elige un **Text size** (S, M, L o XL) antes de copiar. Luego pulsa **Copy** junto al que quieras.',
      ],
      stepsTitle: 'Añádelo a OBS',
      steps: [
        'En OBS, bajo **Sources**, pulsa **+** y elige **Browser**.',
        'Pega el enlace en **URL**.',
        'Pon un tamaño, por ejemplo 800 × 600. Deja **Custom CSS** vacío.',
        'Pulsa **OK**. Se actualiza solo cada pocos segundos.',
      ],
      tipsTag: 'Conviene saber',
      tips: [
        'Añade `&limit=10`, `&title=0` o `&align=right` al final de un enlace para cambiarlo.',
        'El overlay muestra lo mismo que la página pública de tu evento. Las clasificaciones y casillas ocultas también siguen ocultas en el stream.',
        '**Reset link** crea enlaces nuevos y detiene los antiguos. Úsalo si se filtra un enlace. Tendrás que pegar los enlaces nuevos en OBS otra vez.',
        'Una pequeña marca “Anvil” está en la esquina. En el plan Gold puedes ocultarla en **Settings** → **Anvil mark on your overlay**.',
      ],
    },

    chatjoin: {
      title: '!join en tu chat',
      body: [
        'Abre **Settings** → **!join in Twitch chat** y actívalo.',
        'Cuando un espectador escribe `!join`, el bot de Anvil (Anvil_OSRS) responde con el enlace de tu evento abierto. Responde como mucho una vez cada 30 segundos, por mucha gente que lo escriba.',
        'Solo responde en un canal que conectaste en el paso 7. Para Kick, activa **!join in Kick chat** en el recuadro **Kick channel**.',
        '¿No hay ningún evento abierto? Lo dice: “No event is open to join right now — keep an eye on the stream!”',
      ],
      tips: [
        'Si tu chat bloquea enlaces (**Block hyperlinks** de Twitch o AutoMod), la respuesta del bot queda retenida. Escribe una vez `/vip anvil_osrs` o `/mod anvil_osrs` en tu chat para que el enlace pase.',
        '¿Estás con un evento? **Space settings** en el menú del evento te lleva de vuelta a estos interruptores. También **Switch it on in your settings**, debajo de **Who can join?**.',
      ],
    },

    page: {
      title: 'Haz tuya tu página',
      body: [
        'Tu página es lo que la gente ve en `{apex}/c/your-name`, junto con tus eventos. Abre **Settings** → **Your page**. Cada parte tiene su propio botón de guardar.',
      ],
      items: [
        '**Bio.** Unas líneas sobre ti y tus streams. Los enlaces que empiezan por `https://` se pueden pulsar.',
        '**Logo and banner.** Pulsa **Upload a logo** o **Upload a banner**. El banner ocupa la parte de arriba de tu página, así que hazlo ancho (3:1, por ejemplo 1500 × 500). PNG, JPEG, GIF o WebP. Los dos pueden ser animados.',
        '**Panels.** Hasta 8 tarjetas bajo tus eventos, como los paneles bajo un canal de Twitch. Pulsa **+ Add a panel** y ponle un título y algo de texto. Una imagen y un enlace son opcionales. Usa las flechas para cambiar el orden.',
        '**Schedule.** Cuándo sueles emitir en directo, en tu propia zona horaria. Los visitantes ven cada hora en su propio reloj.',
        '**Featured.** Un clip fijado arriba de tu página. Elige uno de tus momentos destacados del stream (siguiente paso), o pega un enlace de clip de Twitch, YouTube, Kick o Medal.',
        'Pulsa **Preview your page** para verla como la ven los visitantes.',
      ],
      note: {
        tag: 'Las reglas de Jagex',
        body: 'Todo lo que hay en tu página debe cumplir las reglas de Jagex: nada de venta de oro o cuentas, nada de apuestas, nada de bots y nada de servidores privados. Anvil revisa tus textos y enlaces al guardar. Si el staff de Anvil oculta tu página tras un reporte, tus ajustes lo dicen. Pregunta en el Discord de Anvil si crees que es un error.',
      },
    },

    highlights: {
      title: 'Momentos destacados del stream',
      body: [
        'Con tu canal de Twitch o YouTube conectado, Anvil captura los grandes momentos de tus eventos mientras estás en directo. Los interruptores están en **Settings** → **Stream highlights**.',
        '**Auto-clip big moments on my stream** está activado en cuanto conectas tu canal. Mientras estás en directo en Twitch, Anvil crea un clip cuando empieza uno de tus eventos, cuando un equipo completa el tablero o gana, y cuando tu propio personaje consigue un drop raro o una mascota. En YouTube, en su lugar, guarda un enlace a ese segundo de tu stream. Kick aún no tiene momentos destacados.',
        'Los clips aparecen en **Highlights** en la página del evento y en tu página. Puedes fijar uno como tu clip **Featured** (paso 10).',
        '**Let Anvil feature clips from my events in its own promotion** sigue desactivado hasta que lo actives. Entonces Anvil puede compartir un clip en sus propias páginas y redes sociales, y siempre te da el crédito.',
        'Tus jugadores también pueden clipear sus propios grandes momentos. Activan **Clip my stream when I hit a big moment** bajo su cuenta de Twitch en **Settings** → **Connected accounts**.',
      ],
    },

    listing: {
      title: 'Aparece en la lista de Anvil',
      body: [
        'Tu espacio no sale en listas cuando lo creas. Solo lo encuentra quien tenga tu enlace.',
        'Abre **Settings** → **Advertise on Anvil** y actívalo. Tu espacio aparece en el directorio de clanes de Anvil, y tus eventos nuevos aparecen en `{apex}/events`.',
        'Para listar solo un evento, abre su **Settings** → **Viewers** → **List on Anvil**. Se muestra mientras el evento está próximo o en curso.',
        'Un evento sin fechas aparece en **Open to join**, marcado como “Open now · starts when the host starts it”.',
      ],
    },

    plans: {
      title: 'Planes y límites',
      body: [
        'Tu plan marca cuántos jugadores puede haber a la vez en tus eventos. Los eventos cuyas fechas se solapan comparten ese número; los eventos en fechas distintas lo tienen cada uno. Un jugador en dos eventos que se solapan cuenta dos veces. Todo lo demás es igual en todos los planes: el tablero, el seguimiento del plugin, el overlay y Discord.',
        'La tarjeta de tu plan está en **Your events**. Para comparar planes, mira [precios](/pricing#creators). Para cambiar o cancelar lo que pagas, ve a [tu página de facturación](/portal).',
      ],
      rows: [
        { term: 'Free', body: 'Hasta 50 jugadores a la vez entre todos tus eventos. Un evento a la vez. Comprobaciones de rol y booster de Discord.' },
        { term: 'Bronze', body: 'Hasta 150 jugadores a la vez entre todos tus eventos. Comprobaciones de Twitch, Kick y YouTube.' },
        { term: 'Silver', body: 'Hasta 300 jugadores a la vez entre todos tus eventos. Más de un evento a la vez. `!join` en el chat. Sales primero en la lista.' },
        { term: 'Gold', body: 'Hasta 1.000 jugadores a la vez entre todos tus eventos. Oculta la marca de Anvil en tu overlay.' },
        { term: 'Partner', body: 'Sin límite de jugadores. Se configura directamente con Anvil — ponte en contacto.' },
      ],
      note: {
        tag: 'Por ahora',
        body: 'Mientras Anvil crece, todos siguen pudiendo entrar, incluso por encima de los números de tu plan. Los límites empezarán más adelante, con aviso. La tarjeta de tu plan muestra cuánto te falta.',
      },
    },

    faq: {
      title: 'Preguntas',
      intro: 'Las que más hacen los streamers:',
      rows: [
        {
          term: '¿Mis espectadores necesitan un clan?',
          body: 'No. Necesitan una cuenta de Discord y un personaje de OSRS. Mándales la [guía para espectadores]({joiningGuide}).',
        },
        {
          term: '¿Necesitan el plugin de RuneLite?',
          body: 'Para drops y kills, sí. El plugin los envía solo. Algunas casillas leen los hiscores en su lugar.',
        },
        {
          term: 'Un espectador dice “The host’s Twitch connection isn’t working”.',
          body: 'Twitch dejó de aceptar tu conexión. Abre **Settings** y pulsa **Reconnect Twitch**. Lo mismo vale para Kick y YouTube.',
        },
        {
          term: '¿Puede ayudarme otra persona a llevarlo?',
          body: 'Sí. Abre **Players** → **Staff & roles**, añádela y elige qué puede hacer cada una.',
        },
        {
          term: 'También llevo un clan en el juego.',
          body: 'Entonces quizá no necesites un espacio. Un clan público puede activar **Streaming** en su lugar. Mira [stream para clanes]({streamingGuide}).',
        },
        {
          term: '¿Puedo crear un segundo espacio?',
          body: 'Por ahora, un espacio por cuenta de Discord. Ponte en contacto si necesitas otro.',
        },
        {
          term: '¿Dónde están los ajustes de mi espacio?',
          body: 'Pulsa **Settings** en el menú. Desde dentro de un evento, pulsa **Space settings** en el menú del evento.',
        },
        {
          term: '¿Qué hace el botón **Report** de mi página?',
          body: 'Cualquiera con sesión iniciada puede reportar tu página, un panel, un evento o un momento destacado al staff de Anvil. Los reportes solo llegan al staff. Si el staff oculta tu bio, tus paneles, tu horario o tu clip destacado, tus ajustes lo dicen.',
        },
      ],
    },
  },

  // /guide/joining-a-streamer-event — para el espectador que hizo clic en el enlace de un streamer.
  joiningStream: {
    metaTitle: 'Unirte al bingo de OSRS de un streamer — Anvil',
    metaDescription:
      '¿Te llegó un enlace de un streamer? Inicia sesión con Discord, añade tu personaje de OSRS y pulsa Join. Qué hacer en eventos solo para seguidores o suscriptores de Twitch, Kick o YouTube, y cómo cuentan tus drops.',
    eyebrow: 'Para espectadores',
    title: 'Unirte al evento de un streamer',
    dek: 'Un streamer compartió un enlace. Así entras al tablero. No necesitas un clan.',
    facts: [
      { strong: '~2 min', rest: 'para unirte' },
      { strong: 'Sin clan', rest: 'necesario' },
    ],

    join: {
      title: 'Únete en cuatro pasos',
      body: [
        '**Abre el enlace** que compartió el streamer. O escribe `!join` en su chat y el bot lo publica.',
        '**Inicia sesión con Discord.** Esa es tu cuenta de Anvil. No hay nada que rellenar.',
        '**Añade tu personaje.** Pulsa **Add my character** y escribe tu nombre de RuneScape. Si dice **Prove it’s mine**, sigue los pasos en tu perfil. La [guía del plugin]({pluginGuide}) te lo explica.',
        '**Pulsa Join.** Elige tu personaje si tienes más de uno. Verás **You’re in!** cuando haya funcionado.',
      ],
    },

    gated: {
      title: 'Eventos para seguidores o suscriptores',
      body: [
        'Algunos eventos son solo para la comunidad del streamer. La tarjeta para unirse dice para quién, por ejemplo “Open to followers of somename on Twitch”.',
        'Pulsa **Join** igualmente. Si aún no te dejan entrar, la tarjeta lista lo que debes hacer. Haz una de esas cosas y pulsa **Join** otra vez.',
      ],
      intro: 'Qué hacer en cada caso:',
      rows: [
        {
          term: 'Seguir o suscribirte en Twitch',
          body: 'Pulsa **Link Twitch** e inicia sesión con Twitch. Anvil no pide permisos. Luego pulsa **Join** otra vez.',
        },
        {
          term: 'Seguir o suscribirte en Kick',
          body: 'Pulsa **Get Kick code**. Escribe el código (como `ANVIL-7F3K9Q`) en el chat de Kick del streamer en 10 minutos. Cada código sirve una vez. Luego pulsa **Join** otra vez.',
        },
        {
          term: 'Suscriptor de YouTube',
          body: 'Pulsa **Check my YouTube subscription** e inicia sesión con Google. Elige la cuenta con la que ves los streams. Tus suscripciones deben ser públicas en los ajustes de privacidad de YouTube.',
        },
        {
          term: 'Miembro de YouTube',
          body: 'Pulsa **Link my YouTube account**, luego escribe tu código en el chat en directo de YouTube y pulsa **check the chat**. Solo funciona mientras el streamer está en directo.',
        },
        {
          term: 'Rol de Discord o booster',
          body: 'Únete al servidor de Discord del streamer y consigue el rol (o haz boost). Anvil lo comprueba con la cuenta de Discord con la que iniciaste sesión.',
        },
      ],
      note: {
        tag: 'Aprobación',
        body: 'Algunos streamers aprueban a cada jugador. Entonces el botón dice **Ask to join**, y ves **Waiting for the host** hasta que responden.',
      },
    },

    plugin: {
      title: 'Instala el plugin de Anvil',
      body: [
        'Tus drops y kills cuentan gracias al plugin de Anvil para RuneLite. Instálalo desde el Plugin Hub e inicia sesión con Discord desde su panel lateral.',
        'La [guía del plugin]({pluginGuide}) te acompaña en unos tres minutos.',
      ],
    },

    play: {
      title: 'Juega',
      body: [
        'Eso es todo. Juega como siempre. Cuando consigas un drop o una kill que el tablero necesita, el plugin la envía solo.',
        'Abre el enlace del evento cuando quieras para ver el tablero y la clasificación. Juegas solo este evento: no te unes a ningún clan.',
      ],
    },

    accounts: {
      title: 'Tus cuentas conectadas',
      body: [
        'Las cuentas de Twitch, YouTube y Kick que enlazaste están en [Settings → Connected accounts](/settings/connections). También puedes enlazarlas ahí antes de unirte.',
        'Desvincula una cuando quieras. Los eventos a los que ya te uniste te mantienen. Un evento con requisitos al que te unas después te pide enlazar otra vez.',
        'Las cuentas de Twitch, YouTube y Kick enlazadas salen en tu perfil con una marca de verificación: demostraste que son tuyas. Desactiva **Show on my profile** para ocultar una. Un enlace de Medal es distinto. Lo pegas tú, así que no lleva marca.',
        '¿Tú también haces stream en Twitch? Activa **Clip my stream when I hit a big moment** bajo tu cuenta de Twitch. Mientras estás en directo en el evento de un streamer, Anvil clipea tus drops raros, tus mascotas y tus casillas completadas.',
      ],
    },

    faq: {
      title: 'Preguntas',
      intro: 'Cuando algo dice que no:',
      rows: [
        {
          term: '“This event is full”',
          body: 'No hay sitio para más jugadores. Solo el streamer puede hacer sitio — avísale.',
        },
        {
          term: 'Estoy suscrito pero no me deja entrar.',
          body: 'Comprueba que enlazaste la misma cuenta con la que te suscribes. En Twitch, mira **Your Twitch** en la tarjeta para unirte. En Kick, escribe un código nuevo en su chat: Anvil lee la insignia de suscriptor de ese mensaje. En YouTube, haz públicas tus suscripciones y vuelve a comprobar.',
        },
        {
          term: 'Seguí en Kick pero dice que no.',
          body: 'Anvil solo ve los seguimientos hechos después de que el streamer conectara Kick. Deja de seguir y vuelve a seguir, luego pulsa **Join**.',
        },
        {
          term: '“That Twitch account was already used to join this event”',
          body: 'Una cuenta de Twitch (o Kick, o YouTube) mete a un jugador. Otra persona ya se unió con ella.',
        },
        {
          term: '“Twitch didn’t answer just now”',
          body: 'Twitch, Kick, YouTube o Discord tuvo un fallo. Espera un minuto y pulsa **Join** otra vez.',
        },
        {
          term: '“The host’s … connection isn’t working”',
          body: 'Esto depende del streamer. Dile que vuelva a conectar su canal en Anvil.',
        },
        {
          term: 'Mis drops no aparecen.',
          body: 'Comprueba que el plugin esté instalado y con sesión iniciada, y que te uniste con el personaje con el que juegas. Mira la [guía del plugin]({pluginGuide}).',
        },
        {
          term: '¿Dónde encuentro más eventos como este?',
          body: '[La página de eventos](/events) muestra eventos a los que cualquiera puede unirse, incluidos eventos de streamers que están abiertos ahora mismo.',
        },
        {
          term: 'Algo en la página de un streamer incumple las reglas.',
          body: 'Pulsa **Report** en la página, el evento o el momento destacado. Elige qué está mal y pulsa **Send**. Solo le llega al staff de Anvil. El streamer nunca sabe quién lo reportó.',
        },
      ],
    },
  },

  // /guide/streaming-for-clans — un clan público que activa Streaming.
  streamingClans: {
    metaTitle: 'Hacer stream de los eventos de tu clan — Anvil',
    metaDescription:
      'Deja que los espectadores de tu stream se unan a un evento de OSRS de tu clan sin unirse al clan: activa Streaming, abre un evento a los espectadores y elige cuáles entran.',
    eyebrow: 'Para clanes que hacen stream',
    title: 'Stream para clanes',
    dek: '¿Tu clan hace stream de sus eventos? Deja que los espectadores jueguen un evento sin unirse a tu clan.',

    on: {
      title: 'Activa Streaming',
      body: [
        'Ve a Admin → **Clan settings** → **Profile** y activa **Streaming**.',
        'Solo un clan público puede hacer stream. Los espectadores tienen que abrir la página de tu evento, y un clan privado se la oculta. Un clan con Streaming activado no puede pasar a privado hasta que lo desactives.',
        'Una vez activado, conecta tu canal de Twitch, YouTube o Kick justo debajo.',
      ],
    },

    event: {
      title: 'Abre un evento a los espectadores',
      body: [
        'Todo evento sigue siendo **Members only** hasta que digas otra cosa. Así funcionaba antes.',
        'Abre **Settings** → **Entry & co-hosts** → **Who can join?** del evento y elige **Members and viewers**. Luego elige **Which viewers?**: cualquiera, o seguidores, suscriptores, un rol de Discord, etc. Pulsa **Save**.',
        'Estas comprobaciones son solo para espectadores. Los miembros de tu clan siempre entran, como antes.',
      ],
    },

    viewers: {
      title: 'Qué son los espectadores',
      body: [
        'Un espectador que se une es un **event player**. Juega ese único evento.',
        'No son miembros del clan ni invitados. Nunca aparecen en la lista de tu clan, y no reciben rango.',
        'Puedes ver a todos los que se unieron así en **People** → **Past viewers**.',
        '¿Un habitual que quieres conservar? **Make guest** en su fila lo convierte en invitado del clan, para que pueda unirse a cualquiera de tus eventos abiertos a invitados, no solo a este. **Make a guest a viewer again** convierte a un invitado de nuevo en espectador de un solo evento.',
      ],
    },

    tools: {
      title: 'Tus herramientas de stream',
      body: [
        'Las herramientas de streamer funcionan igual que en un espacio de creador: enlaces de canal verificados, comprobaciones de **Who can join?**, el overlay de OBS y `!join` en el chat.',
        'Los enlaces del overlay de un evento del clan están en **Settings** → **Stream** → **Stream overlay** del evento. `!join` y la marca del overlay están en **Clan settings** → **Profile** → **Streaming**.',
        'La [guía para creadores]({creatorsGuide}) explica cada una paso a paso.',
        'Los momentos destacados del stream también funcionan aquí: con Twitch o YouTube conectado, Anvil clipea los grandes momentos de los eventos abiertos a espectadores. `!join` en el chat de Kick tiene su propio interruptor en el recuadro **Kick channel**.',
      ],
    },

    faq: {
      title: 'Preguntas',
      intro: 'Las respuestas cortas:',
      rows: [
        {
          term: '¿Los espectadores cuentan para nuestro límite de miembros?',
          body: 'No. Son jugadores del evento, no miembros. Los límites del streamer cuentan los jugadores a la vez entre los eventos que organizas (mira la [guía para creadores]({creatorsGuide})).',
        },
        {
          term: '¿`!join` manda a la gente a un evento solo para miembros?',
          body: 'No. Solo apunta a un evento abierto a espectadores.',
        },
        {
          term: '¿Debería crear un espacio de creador en su lugar?',
          body: 'Solo si no tienes clan. Un espacio es para streamers sin clan en el juego.',
        },
      ],
    },
  },

  people: {
    metaTitle: 'Tu gente: lista de miembros, invitados y quién puede unirse — Anvil',
    metaDescription:
      'De dónde sale la lista de miembros de un clan en Anvil, qué significan Members, Guests, Roster only, Departed y Quiet, cómo funcionan las solicitudes para unirse y Needs review, los tres ajustes de Who can join, y cómo quitar o banear a alguien.',
    eyebrow: 'Anvil · para el equipo del clan',
    title: 'Tu gente: lista de miembros, invitados y quién puede unirse',
    dek: 'Todos los que aparecen en Admin → **People** llegaron por una de cuatro vías: la lista del clan en el juego los nombraba, el staff los aprobó, el clan deja entrar a cualquiera, o alguien los añadió a mano. Así funciona cada una, esto es lo que te dice la pestaña Roster, y esto es lo que hay que revisar cuando alguien está donde no toca.',
    facts: [
      { strong: 'Lista del clan en el juego', rest: 'la única vía automática para ser miembro' },
      { strong: 'Iniciar sesión', rest: 'nunca mete a nadie en la lista' },
      { strong: 'Dos colas', rest: 'en dos pestañas distintas' },
    ],
    footnote:
      'Todo esto está en Admin → **People**. Roster y Needs review son trabajo de moderadores. **Who can join** y **Staff & roles** son pestañas solo para admins. Para saber quién puede hacer qué en toda la zona de administración, mira [Roles del staff: quién puede hacer qué]({staffGuide}).',

    roster: {
      title: 'De dónde sale la lista de miembros',
      body: [
        'La lista de miembros es la lista de tu clan en el juego, copiada al sitio. Un admin la envía desde RuneLite con el plugin de Anvil: pulsa el botón **Anvil** en la barra de título de la ventana del clan, o **Sync roster** en el panel lateral del plugin. Todos los de la lista llegan como **miembros**, con su rango en el juego. Solo alguien con el rol Admin en el sitio puede enviarla. A cualquier otro se le avisa en el juego.',
        'Una sincronización es lo único que convierte a alguien en miembro por sí sola. Quien deja el clan en el juego queda marcado como ido en la siguiente sincronización, y quien vuelve regresa en la siguiente a esa. Su historial se queda en ambos casos.',
        'Cualquier otro puesto es de **invitado**: alguien que juega tus eventos sin estar en tu clan del juego. Los invitados tienen seguimiento y pueden entrar en eventos. No son miembros y no cuentan para tu plan.',
      ],
      note: {
        tag: 'Iniciar sesión nunca mete a nadie en la lista',
        body: 'Iniciar sesión con Discord, vincular un personaje o jugar con el plugin no le da un puesto a nadie. Si el plugin ve a alguien cuyo clan en el juego es el tuyo pero que aún no está en la lista, pide su entrada (mira el paso 3). Los demás solo tienen una cuenta de Anvil sin clan. Eso es lo que impide que un desconocido se una a tu clan escribiendo su nombre.',
      },
    },

    filters: {
      title: 'Cómo leer la pestaña Roster',
      intro:
        'La barra de arriba divide la lista en **Members**, **Guests** y **Departed**. Haz clic en un segmento para filtrar por él. Las etiquetas de debajo acotan más la lista:',
      rows: [
        {
          term: 'Active',
          body: 'los miembros que siguen en la lista. Quedan fuera los invitados y los que se fueron.',
        },
        {
          term: 'Quiet 7d+',
          body: 'los miembros a los que el plugin no ha visto jugar en siete días o más. Quien nunca ha usado el plugin no aparece aquí, porque no hay nada con qué juzgarlo. Su **Last played** pone **no plugin data** en su lugar.',
        },
        {
          term: 'Guests',
          body: 'los puestos de invitado actuales: gente que juega tus eventos pero no está en tu clan del juego.',
        },
        {
          term: 'Roster only',
          body: 'miembros e invitados actuales que todavía no tienen cuenta en el sitio. Es normal en cualquiera que nunca haya iniciado sesión con Discord. Siguen en la lista; inician sesión y vinculan el personaje cuando quieran inscribirse en algo.',
        },
        {
          term: 'Departed',
          body: 'gente que se fue en el juego, o a la que el staff quitó. Sus resultados e historial se quedan.',
        },
        {
          term: 'All',
          body: 'todos los anteriores.',
        },
      ],
      outro:
        'La columna **Source** dice cómo empezó cada puesto: **Clan sync**, **Added manually** o **Applied or self-reported**. **Last played** viene del plugin, no de la sincronización de la lista.',
      note: {
        tag: 'Rango y rol no son lo mismo',
        body: 'Los dos desplegables junto a las etiquetas filtran por rango en el juego y por rol en el sitio. El rango es lo que informa el juego. El rol en el sitio es lo que un admin pone en **Staff & roles**. Uno nunca fija el otro.',
      },
    },

    review: {
      title: 'Solicitudes para unirse y Needs review',
      intro: 'Hay dos tipos de gente esperando un sí, y esperan en pestañas distintas.',
      rows: [
        {
          term: 'Quienes piden unirse',
          body: 'arriba en la pestaña **Roster**, y solo mientras alguien espera. Una solicitud llega del sitio (pulsó **Apply** en la página de tu clan, o intentó entrar en uno de tus eventos) o del plugin (lo vio jugando en tu clan del juego antes de que la lista lo tuviera). Cada fila dice de dónde, y si es miembro de otro clan. **Approve** le da un puesto de invitado. **Decline** se lo comunica, por MD de Discord cuando tu bot puede llegar a él. Marca varias para responderlas de una vez.',
        },
        {
          term: 'Pendientes de confirmar',
          body: 'en **Needs review**. Gente que vinculó uno de los personajes de tu lista ganando XP con él, pidiéndolo o jugándolo con el plugin. Ya pueden jugar mientras esperan. Comprueba que el nombre de Discord encaja con el personaje y pulsa **Approve**. **Not our member** quita el personaje de tu lista y lo deja con su dueño. **Report to Anvil** es para un personaje que no es suyo.',
        },
        {
          term: 'Reclamaciones',
          body: 'también en **Needs review**. Alguien jugó un personaje que aquí ya es un miembro asentado, así que Anvil no se lo vinculó por su cuenta. Si sabes que es él, pulsa **Yes, that’s them**; si no, **Not them**. Un personaje que solo ha estado en tu clan se vincula al momento. Uno que también está en otro clan pasa a Anvil para que decida.',
        },
      ],
      note: {
        tag: 'El contador no incluye las solicitudes para unirse',
        body: 'El número de **Needs review**, y el de **People** en la barra lateral, cuenta las confirmaciones pendientes y las reclamaciones. Las solicitudes para unirse no están ahí, así que mira también arriba en la pestaña Roster.',
      },
    },

    policy: {
      title: 'Quién puede unirse',
      intro:
        'Admin → People → **Who can join** tiene tres ajustes, y solo los admins ven la pestaña. El que decide cómo entra la gente de fuera es **Players from other clans**:',
      rows: [
        {
          term: 'Ask first',
          body: 'el valor por defecto. Quien lo solicita, o a quien el plugin detecta en tu clan del juego, espera como solicitud para unirse hasta que el staff lo aprueba. Nadie consigue un puesto sin un sí.',
        },
        {
          term: 'Let anyone in',
          body: 'basta con pedirlo. Recibe un puesto de invitado al momento y no se crea ninguna solicitud. Bien para un evento abierto; ruidoso en cualquier otro caso.',
        },
        {
          term: 'No guests',
          body: 'solo juegan tus propios miembros. Los jugadores de otros clanes no pueden entrar en tus eventos ni pedir unirse, y el plugin no crea nada para ellos.',
        },
      ],
      outro:
        '**Who can see this clan** es **Anyone** (un enlace a un tablero funciona para quien lo reciba) o **Members only** (los demás ven la tarjeta del clan y una invitación a solicitar la entrada). **List in the Clan Hall** pone el clan en la lista pública de clanes. Desactivarlo no hace privado el clan.',
      note: {
        tag: 'Nada de esto afecta a tus miembros',
        body: 'La sincronización de la lista da su puesto a los miembros digan lo que digan estos ajustes. Tu propio staff tampoco se trata nunca como invitado: el personaje de alguien del staff recibe un puesto de miembro sin solicitud.',
      },
    },

    manual: {
      title: 'Añadir a alguien a mano',
      body: [
        'Roster → **+ Add Manually** pone un personaje en la lista. Rellena el **RSN** y, si quieres, su **Discord ID** y su **Rank**. Marca **Add as guest** para alguien que no esté en tu clan del juego. Pueden hacerlo tanto los moderadores como los admins.',
        'Úsalo para alguien a quien la sincronización todavía no ve, como un recluta que entró después de la última. El puesto queda marcado como **Added manually**, y la sincronización lo trata como decisión tuya: si más adelante quitas un puesto añadido a mano, la siguiente sincronización no lo devuelve.',
        'Añadir a alguien a la lista no lo inscribe en ningún evento. Para eso, abre la pestaña **Sign-ups** del evento y usa **Add member**. Eso es solo para admins.',
      ],
    },

    removing: {
      title: 'Quitar y banear',
      intro: 'Cada fila de la lista tiene un menú de acciones. Hacen cosas distintas:',
      rows: [
        {
          term: 'Demote to guest',
          body: 'sigue en la lista y aún se le puede inscribir en eventos, pero deja de contar como miembro. **Promote to member** lo revierte.',
        },
        {
          term: 'Remove from roster',
          body: 'lo marca como ido. Su historial y sus resultados se quedan. Si sigue en tu clan del juego, la siguiente sincronización puede volver a añadirlo.',
        },
        {
          term: 'Not our member',
          body: 'en Needs review, para un personaje que alguien vinculó y que no está en tu clan. Sale de tu lista y se queda con su dueño.',
        },
        {
          term: 'Ban from this clan',
          body: 'cierra todos los puestos que la persona tiene aquí, alts incluidas, le quita el rol de staff y los cargos de tablero que tenga en este clan, y le impide volver: la sincronización de la lista, el plugin y las solicitudes para unirse la rechazan hasta que se levante el baneo. Su cuenta de Anvil y sus otros clanes no se tocan. Solo admins, para alguien con cuenta en el sitio y un rol por debajo de admin, desde el menú de la fila, desde **Staff & roles**, o para varias personas a la vez. Levantar un baneo no la devuelve a su sitio; vuelve a entrar en el juego o la añades tú.',
        },
      ],
      note: {
        tag: 'Un baneo también quita su rol de staff',
        body: 'Banear a alguien cierra sus puestos y le quita el rol de staff y cualquier cargo de editor o tesorero de tablero en los tableros de este clan. Levantar el baneo no se los devuelve: vuelve a ponerle el rol en Staff & roles si debe tenerlo.',
      },
    },

    faq: {
      title: 'Preguntas frecuentes',
      intro: 'Lo que suele explicar que alguien esté donde no toca.',
      rows: [
        {
          term: 'Falta alguien del clan',
          body: 'Lanza primero una sincronización: la lista solo cambia cuando un admin la envía. Luego mira **Departed**, por si lo quitaron, y si está baneado; la sincronización se salta a cualquiera baneado aquí e informa de a quién se saltó. Si el clan supera su plan y el periodo de gracia ha terminado, una sincronización deja de añadir miembros nuevos hasta que mejores el plan o recortes la lista.',
        },
        {
          term: 'Alguien sale como invitado pero está en el clan',
          body: 'Normalmente sigue siendo miembro de otro clan en Anvil. Un personaje solo puede ser miembro de un clan a la vez, así que la sincronización lo coloca aquí como invitado y lo hace miembro en la primera sincronización después de que deje el otro clan. Si no, entró por una solicitud para unirse, o alguien lo bajó a invitado o lo añadió como invitado. Lanza una sincronización, o usa **Promote to member**.',
        },
        {
          term: 'Alguien inició sesión pero no está en la lista',
          body: 'Es lo esperado. Iniciar sesión crea una cuenta de Anvil, no un puesto. Aparece cuando la sincronización lo incluye, cuando apruebas su solicitud o cuando lo añades a mano.',
        },
        {
          term: 'Nombres como #Player1234',
          body: 'RuneLite muestra un nombre provisional así durante un momento mientras un jugador entra, y para los miembros del clan a los que no sabe poner nombre. Anvil ya ignora esos nombres: la sincronización se los salta, el plugin no crea solicitudes para ellos y las solicitudes antiguas con uno de ellos están ocultas. Si todavía queda uno en tu lista, es una fila antigua. **Remove from roster** la borra.',
        },
        {
          term: 'Un miembro que quitaste no deja de volver',
          body: 'Quitar a alguien no cambia el clan del juego, así que la siguiente sincronización lo vuelve a añadir mientras el juego lo siga listando. Quítalo en el juego, o banéalo aquí.',
        },
        {
          term: 'Un moderador no ve Who can join',
          body: 'Es una pestaña solo para admins, como Staff & roles. Mira [Roles del staff: quién puede hacer qué]({staffGuide}).',
        },
      ],
    },
  },

  staffRoles: {
    metaTitle: 'Roles del staff: quién puede hacer qué — Anvil',
    metaDescription:
      'Los roles de clan en Anvil (propietario, admin, tesorero, moderador, miembro), hasta dónde llega cada uno, cómo nombrar a un moderador, quién puede dar qué rol, y los cargos que cubren un solo evento.',
    eyebrow: 'Anvil · para propietarios y admins',
    title: 'Roles del staff: quién puede hacer qué',
    dek: 'Cinco roles, fijados clan por clan en Admin → People → **Staff & roles**. Un rol aquí no da nada en ningún otro clan, y nadie puede dar un rol igual o superior al suyo. Esta página es el mapa completo: hasta dónde llega cada rol, cómo darlo y los cargos que cubren un solo evento.',
    facts: [
      { strong: 'Por clan', rest: 'un rol aquí no vale nada en otro sitio' },
      { strong: 'Por debajo del tuyo', rest: 'es todo lo que puedes dar' },
      { strong: 'Propietario', rest: 'solo cambia por traspaso' },
    ],
    footnote:
      'Los roles se vuelven a comprobar en cada carga de página, así que un cambio se aplica en el siguiente clic de la persona; no hace falta que cierre sesión. Para la propia lista de miembros, mira [Tu gente]({peopleGuide}). Para el día a día de un moderador, mira [De guardia]({moderatorGuide}).',

    roles: {
      title: 'Los roles',
      intro: 'Todo el que inicia sesión con Discord empieza como simple **Member**. Por encima:',
      rows: [
        {
          term: 'Propietario',
          body: 'quien creó el clan, hasta que lo traspase. Todo lo que puede hacer un admin, más traspasar la propiedad y borrar el clan. Hay exactamente uno, y nadie puede degradarlo, quitarlo ni banearlo.',
        },
        {
          term: 'Admin',
          body: 'todo salvo traspasar el clan: eventos y tableros, ajustes, Discord, staff y el dinero del clan.',
        },
        {
          term: 'Tesorero',
          body: 'cuotas, la caja y los premios, además de todo lo que hace un moderador: la lista de miembros, las pruebas, las competiciones, el Schedule y Needs review.',
        },
        {
          term: 'Moderador',
          body: 'los recién llegados, la lista de miembros, las pruebas, las competiciones semanales y los eventos del clan. Ni eventos ni tableros, ni ajustes, ni staff, ni dinero.',
        },
        {
          term: 'Miembro',
          body: 'sin cargo de staff. Juega, se inscribe y puede declarar una donación a la caja.',
        },
      ],
      outro:
        'Debajo del rol, en Staff & roles, hay dos casillas para cualquiera por debajo de admin, simples miembros incluidos. **Can build bingo boards** abre la pestaña Tiles de todos los tableros y la Task library. **Can write guides** le deja escribir las guías del clan. Los admins ya tienen las dos.',
    },

    assign: {
      title: 'Nombrar a un moderador',
      intro:
        'Tiene que haber iniciado sesión con Discord y vinculado un personaje que esté en tu lista, como miembro o como invitado. Después:',
      steps: [
        'Abre Admin → **People** → **Staff & roles**.',
        'La lista se abre en **Staff**. Cambia a **Members** o **All accounts** y busca su nombre.',
        'En la columna **Role**, elige **Moderator: newcomers, roster, sign-ups, proofs**. Se guarda en cuanto lo eliges.',
        'Si también debe montar tableros, marca **Can build bingo boards**.',
      ],
      outro:
        '¿Aún no ha iniciado sesión? Busca su personaje en la pestaña **Roster**, abre su menú y elige **Set role**. Eso guarda el rol en el personaje. Lo recibe la primera vez que inicie sesión y lo vincule o, si está esperando en Needs review, cuando un moderador lo apruebe.',
      note: {
        tag: 'Quitárselo',
        body: 'Vuelve a poner el rol en **Member**. Cambiar el rol de alguien también le quita los cargos que tuviera en los tableros de este clan (mira el paso 5), así que vuelve a dárselos después si debe conservarlos.',
      },
    },

    who: {
      title: 'Quién puede dar qué',
      intro:
        'Staff & roles es una pestaña solo para admins, y cada cambio en ella se comprueba con dos reglas: solo puedes dar un rol inferior al tuyo, y solo puedes cambiar a alguien cuyo rol sea inferior al tuyo.',
      rows: [
        {
          term: 'El propietario',
          body: 'puede dar o quitar Admin, Treasurer y Moderator.',
        },
        {
          term: 'Un admin',
          body: 'puede dar o quitar Treasurer y Moderator. Un admin no puede nombrar a otro admin, cambiar a otro admin ni cambiar su propio rol.',
        },
        {
          term: 'Tesoreros y moderadores',
          body: 'no pueden cambiar el rol de nadie. La pestaña está oculta para ellos.',
        },
        {
          term: 'Nadie',
          body: 'puede cambiar el rol del propietario, quitarlo ni banearlo. Además, el clan siempre conserva un admin: el último no se puede degradar.',
        },
      ],
      note: {
        tag: 'Traspasar el clan',
        body: 'Solo puede hacerlo el propietario, y solo a alguien que ya sea admin: la fila de ese admin tiene una acción **Make owner**. Por seguridad tarda 3 días, como cambiar el PIN del banco: un aviso en todas las páginas de administración dice cuándo ocurre, hasta entonces puedes pulsar **Cancel**, esa persona puede pulsar **Decline**, y el equipo de Anvil recibe aviso y puede detenerlo. Pasados los 3 días pasa a ser el propietario y tú pasas a ser un admin normal. Solo el nuevo propietario puede devolvértelo.',
      },
    },

    table: {
      title: 'Quién puede hacer qué',
      intro:
        'Hasta dónde llega cada rol en la zona de administración. «Si está marcada» se refiere a la casilla **Can build bingo boards** o **Can write guides** de Staff & roles.',
      areaLabel: 'Sección',
      columns: ['Propietario', 'Admin', 'Tesorero', 'Moderador', 'Miembro'],
      rows: [
        { area: 'Panel principal', cells: ['Sí', 'Sí', 'Sí', 'Sí', 'No'] },
        { area: 'Eventos: crear, editar, equipos, inscripciones, lanzamiento', cells: ['Sí', 'Sí', 'No', 'No', 'No'] },
        { area: 'Casillas de los tableros y Task library', cells: ['Sí', 'Sí', 'Si está marcada', 'Si está marcada', 'Si está marcada'] },
        { area: 'Pruebas por revisar', cells: ['Sí', 'Sí', 'Sí', 'Sí', 'No'] },
        { area: 'Competiciones semanales', cells: ['Sí', 'Sí', 'Sí', 'Sí', 'No'] },
        { area: 'Eventos del clan', cells: ['Sí', 'Sí', 'Sí', 'Sí', 'No'] },
        { area: 'Calendario', cells: ['Sí', 'Sí', 'Sí', 'Sí', 'No'] },
        { area: 'Lista de miembros: ver, añadir, quitar', cells: ['Sí', 'Sí', 'Sí', 'Sí', 'No'] },
        { area: 'Solicitudes para unirse y Needs review', cells: ['Sí', 'Sí', 'Sí', 'Sí', 'No'] },
        { area: 'Banear a alguien del clan', cells: ['Sí', 'Por debajo de admin', 'No', 'No', 'No'] },
        { area: 'Staff & roles', cells: ['Sí', 'Por debajo de admin', 'No', 'No', 'No'] },
        { area: 'Who can join', cells: ['Sí', 'Sí', 'No', 'No', 'No'] },
        { area: 'Caja y escalas de premios', cells: ['Sí', 'Sí', 'Sí', 'No', 'No'] },
        { area: 'Cuotas: marcar como cobradas', cells: ['Sí', 'Sí', 'Sí', 'No', 'No'] },
        { area: 'Cuotas: confirmar (la segunda firma)', cells: ['Sí', 'Sí', 'No', 'No', 'No'] },
        { area: 'Ajustes de Discord', cells: ['Sí', 'Sí', 'No', 'No', 'No'] },
        { area: 'Publicar en Discord', cells: ['Sí', 'Sí', 'No', 'No', 'No'] },
        { area: 'Ajustes del clan: Profile, Features, Rules & scoring, Boosts', cells: ['Sí', 'Sí', 'No', 'No', 'No'] },
        { area: 'Plan y facturación', cells: ['Sí', 'Sí', 'No', 'No', 'No'] },
        { area: 'Guías', cells: ['Escritura', 'Escritura', 'Lectura; escritura si está marcada', 'Lectura; escritura si está marcada', 'Escritura si está marcada'] },
        { area: 'Registro de actividad', cells: ['Sí', 'Sí', 'Sí', 'Sí', 'No'] },
        { area: 'Sincronizar la lista desde RuneLite', cells: ['Sí', 'Sí', 'No', 'No', 'No'] },
        { area: 'Traspasar la propiedad, borrar el clan', cells: ['Sí', 'No', 'No', 'No', 'No'] },
      ],
      note: {
        tag: 'Oculto no es lo mismo que permitido',
        body: 'La barra lateral solo muestra lo que tu rol puede usar, pero la comprobación que cuenta se hace en el servidor. Escribir la dirección de una página que tu rol no puede usar te devuelve al panel principal, y la acción que hay detrás se rechaza.',
      },
    },

    event: {
      title: 'Cargos en un solo evento',
      intro:
        'Algunos cargos cubren un único evento en vez del clan. Los da un admin en el propio evento, y llegan a ese evento y a nada más, así que se pueden dar sin miedo a un simple miembro.',
      rows: [
        {
          term: 'Editor del tablero',
          body: 'monta y edita las casillas de ese tablero. Se da en **Settings** → **Staff** → **Board staff** del evento, o con **Boards…** en las acciones de una persona en Staff & roles. Un miembro con este cargo solo ve sus tableros en la zona de administración.',
        },
        {
          term: 'Tesorero del tablero',
          body: 'cobra las cuotas de ese tablero y gestiona sus pagos, sin acceso a la caja del clan. En la zona de administración solo ve sus propios tableros, y de cada uno solo las pestañas **Sign-ups** y **Prizes**. También se da en **Board staff**.',
        },
        {
          term: 'Staff del equipo',
          body: 'lleva un equipo: su plantilla, sus envíos y pruebas, y marcar como pagadas las cuotas de sus jugadores. No puede tocar otro equipo, editar el tablero, hacer elecciones del draft ni sustituir a nadie una vez que el evento está en marcha. Se añade en la página del equipo, en **Team staff**. Así es como el moderador de un clan visitante lleva su mitad de un clan contra clan.',
        },
        {
          term: 'Capitán',
          body: 'nombrado por el organizador para un equipo. Todo lo que puede hacer el staff del equipo, más las elecciones del draft del equipo.',
        },
      ],
      note: {
        tag: 'Un rol de clan sustituye a los cargos de tablero',
        body: 'Dar a alguien un rol de clan, o cambiárselo, le quita los cargos de editor y tesorero de tablero en los tableros de este clan. Staff & roles te avisa antes cuando esos cargos son lo único que tiene. Vuelve a dárselos después si debe conservarlos.',
      },
    },

    safety: {
      title: 'Mantenerlo seguro',
      intro: 'Esto se cumple estén como estén repartidos los roles.',
      rows: [
        {
          term: 'El propietario está protegido',
          body: 'su fila en Staff & roles pone **Protected**. Su rol no se puede cambiar y no se le puede banear. La propiedad solo cambia de manos cuando él la traspasa.',
        },
        {
          term: 'Los admins no pueden quitarse entre sí',
          body: 'un admin no puede ni degradar ni banear a otro admin, ni de uno en uno ni a varios a la vez. Cuando dos admins no se ponen de acuerdo, decide el propietario. Un baneo también le quita a la persona su rol de staff y sus cargos de tablero en este clan.',
        },
        {
          term: 'El dinero necesita a dos personas',
          body: 'cuando una cuota necesita confirmación, esta tiene que venir de un admin distinto del que la marcó como cobrada. Cuántas confirmaciones necesita una cuota, de cero a cinco, se fija en **Clan settings** → **Rules & scoring** → **Fee sign-off**. Un admin que lleva el dinero él solo puede forzar igualmente el cierre de una cuota, con un botón aparte.',
        },
        {
          term: 'Lo que un moderador no puede hacer',
          body: 'crear o editar eventos, cambiar los ajustes o Discord, dar un rol a nadie (ni a sí mismo), ni tocar el dinero del clan.',
        },
        {
          term: 'Todo queda registrado',
          body: 'los cambios de rol, los traspasos de propiedad, los baneos y las solicitudes para unirse respondidas se anotan en el **Activity log**, que cualquiera del staff puede leer.',
        },
        {
          term: 'Los roles de Discord van aparte',
          body: 'la sincronización de roles de Anvil relaciona los roles de Discord con los **rangos del juego**, no con los roles del sitio. Hacer moderador a alguien aquí no le da nada en tu servidor de Discord, y un rol de moderador que diste a mano en Discord no se toca. El único comando del bot que cambia algo, añadir a la caja con `/coffer`, comprueba el rol en el sitio: tesorero, admin o propietario.',
        },
      ],
    },
    log: {
      title: 'El registro de actividad',
      body: [
        '**Activity log** en el menú de admin lista los 200 cambios más recientes, y cualquier miembro del staff puede leerlo: entradas, salidas, renombrados y verificaciones, traspasos de propiedad, capitanes nombrados y retirados, inscripciones aprobadas o rechazadas, cuotas confirmadas, funciones activadas o desactivadas y ajustes cambiados. **Filter by event type** lo acota.',
        'También es donde se ordenan los duplicados. **Merge two members** une un duplicado con el real, y **Suspected renames** lista los cambios de nombre que Anvil detectó para que los confirmes o rechaces.',
      ],
    },
  },

  supporter: {
    metaTitle: 'Anvil Supporter: niveles y ventajas — Anvil',
    metaDescription:
      'Qué recibe cada nivel de Anvil Supporter, Champion y Patron: colores del nombre y la estrella, GZ dorado, avatar y banner animados, la vitrina, eventos con amigos, retos cara a cara, chat de eventos y boosts de clan. Cómo funciona el cobro con Gumroad y qué pasa cuando cancelas.',
    eyebrow: 'Anvil · para jugadores',
    title: 'Anvil Supporter: niveles y ventajas',
    dek: 'Anvil Supporter es una suscripción personal que paga los servidores de Anvil. Tiene tres niveles, y cada uno incluye todo lo del anterior. Cada ventaja es de apariencia o de espacio para organizar: el seguimiento, los eventos, la puntuación y tus propias estadísticas siguen siendo gratis para todos, y nada de esto cambia lo que cuenta un evento.',
    facts: [
      { strong: 'Desde $1 al mes', rest: 'o $10 al año' },
      { strong: 'Solo apariencia', rest: 'nunca una puntuación, un rango ni un objeto' },
      { strong: 'No se borra nada', rest: 'cuando lo dejas' },
    ],
    footnote:
      'Todo esto se configura en la web, en **Settings** → **Supporter**, **Profile look** y **Clan boosts**. Para los boosts en detalle, mira [Dar boost a un clan]({boostsGuide}). Para saber dónde se ven tus colores en RuneLite, mira [El panel lateral, pestaña a pestaña]({panelGuide}).',

    tiers: {
      title: 'Los tres niveles',
      intro: 'Los precios están en la página **Anvil Supporter**, `/supporter`. Un plan anual cuesta lo que diez meses.',
      rows: [
        {
          term: 'Supporter',
          body: '$1 al mes o $10 al año. Nombre dorado y una estrella, GZ dorado, una vitrina con 4 huecos, y puedes organizar un evento con amigos.',
        },
        {
          term: 'Champion',
          body: '$2 al mes o $20 al año. Un nombre en degradado de nuestros predefinidos (o un color propio), tu propio avatar y banner (animados si quieres), 8 huecos en la vitrina, chat de eventos más rápido y 1 boost de clan.',
        },
        {
          term: 'Patron',
          body: '$5 al mes o $50 al año. Tu propio degradado de hasta 4 colores, en movimiento, 12 huecos en la vitrina, sin espera en el chat de eventos, 2 eventos con amigos a la vez y 2 boosts de clan.',
        },
      ],
      note: {
        tag: 'Tiempo por invitaciones',
        body: 'En Settings → Supporter tienes un enlace de invitación. Cuando un amigo al que invitaste paga, ganas meses gratis; la recompensa llega dos semanas después de su primer pago. El tiempo ganado así da todas las ventajas de su nivel salvo los boosts de clan.',
      },
    },

    compare: {
      title: 'Qué recibe cada nivel',
      intro: 'La misma tabla que en la página de Supporter, más las ventajas del chat.',
      table: {
        areaLabel: 'Ventaja',
        columns: ['Gratis', 'Supporter', 'Champion', 'Patron'],
        rows: [
          { area: 'Colores del nombre', cells: ['—', 'Dorado', 'Predefinidos o un color propio', 'Predefinidos o hasta cuatro colores, en movimiento'] },
          { area: 'Estrella junto a tu nombre', cells: ['—', 'Sí', 'Sí', 'Sí'] },
          { area: 'GZ dorado', cells: ['—', 'Sí', 'Sí', 'Sí'] },
          { area: 'Avatar y banner propios, animados', cells: ['—', '—', 'Sí', 'Sí'] },
          { area: 'Vitrina', cells: ['—', '4 huecos', '8 huecos', '12 huecos'] },
          { area: 'Eventos con amigos (a la vez · jugadores)', cells: ['Solo unirse', '1 · 10', '1 · 25', '2 · 50'] },
          { area: 'Retos cara a cara', cells: ['1 activo', '5 activos', 'Ilimitados', 'Ilimitados'] },
          { area: 'Chat de eventos: espera entre líneas', cells: ['5 s', '3 s', '1 s', 'Ninguna'] },
          { area: 'Boosts de clan', cells: ['—', '—', '1', '2'] },
        ],
      },
      outro:
        'En **Settings** → **In-game chat** hay tres más: tus propios colores del feed en el chat (Supporter), elegir qué cubre tu resumen al iniciar sesión (Champion) y una estrella junto a tu nombre en el feed del chat de otros jugadores (Patron).',
    },

    names: {
      title: 'Colores del nombre',
      intro:
        'Se eligen en **Settings** → **Supporter**, en **Your name’s look**. La vista previa muestra tu nombre sobre un fondo oscuro y sobre uno claro.',
      rows: [
        {
          term: 'Supporter',
          body: 'dorado sólido. No hay nada que elegir.',
        },
        {
          term: 'Champion',
          body: 'uno de los degradados predefinidos (**Classic**, el de por defecto, **Ember**, **Ocean**, **Aurora**, **Rose gold** o **Toxic**), o **Your own**: un color fijo. Entre todos tus personajes puedes usar como mucho dos colores propios distintos.',
        },
        {
          term: 'Patron',
          body: 'todos los predefinidos más **Prism**, el de por defecto de Patron, o **Your own** con de uno a cuatro colores. Un solo color se queda quieto; de dos a cuatro forman un degradado que se mueve de izquierda a derecha.',
        },
      ],
      outro:
        '**Your Anvil display name** es el nombre de tu cuenta vinculada a Discord. En **Your RuneScape characters**, elige **Same for all** o **Customize each** para dar a cada personaje su propio aspecto. Pulsa **Save** (o **Save for all characters**); **Reset to default** vuelve a los colores de tu nivel.',
      note: {
        tag: 'Fondos oscuros y claros',
        body: 'La web, el panel del plugin y Discord son oscuros; el chatbox sólido del juego es claro. Anvil ajusta tus colores para que se lean bien en cada uno. Si quieres un aspecto distinto en uno de ellos, activa **Set a separate look for dark backgrounds** o **for light backgrounds**. Ese aspecto se muestra tal cual lo elegiste, sin corrección de contraste, y la vista previa te avisa cuando cuesta leerlo.',
      },
    },

    where: {
      title: 'Dónde se ve tu estilo',
      intro: 'Tus colores y la estrella van allí donde va tu nombre:',
      rows: [
        {
          term: 'En la web',
          body: 'tableros, listas de miembros, perfiles, tu propio nombre en la barra superior y los nombres de tus personajes. La estrella lleva tus colores.',
        },
        {
          term: 'En el panel del plugin',
          body: 'el Feed, el chat de eventos, las tarjetas y la línea **Tracking**. El degradado de un Patron se desliza; cada jugador puede pararlo con **Animated names**.',
        },
        {
          term: 'En el juego',
          body: 'para otros jugadores que usan el plugin de Anvil: chat público, de clan, de amigos y privado, anuncios del clan, avisos de inicio de sesión, listas de amigos y del clan, y el menú del clic derecho (nunca en mundos PvP ni en el Wilderness). En el chat del juego, la estrella es cosa de los Patron.',
        },
        {
          term: 'En Discord',
          body: 'una estrella junto a tu nombre en las publicaciones de Anvil, dibujada con tus propios colores si elegiste alguno.',
        },
        {
          term: 'GZ dorado',
          body: 'en el drop de un compañero de clan, en el feed de tu clan en la web, tu GZ puede ser dorado. Solo los Supporters pueden darlo.',
        },
      ],
      note: {
        tag: 'Solo en personajes que se ha demostrado que son tuyos',
        body: 'Los colores solo se ven en personajes que el plugin ha confirmado que son tuyos, en la web y en el juego. Para que no aparezcan en tus nombres en el chat del juego de otras personas, desmarca **Show my colours on my characters’ names in game chat** en Settings → Supporter.',
      },
    },

    profile: {
      title: 'Avatar, banner y vitrina',
      intro: 'Los tres están en **Settings** → **Profile look**.',
      rows: [
        {
          term: 'Avatar y banner',
          body: 'Champion y Patron. Sube los tuyos; un GIF o WebP sigue animado. Se ven en tu tarjeta, tu perfil y todos tus personajes, en la web y en el plugin. Un banner puede pesar hasta 6 MB y medir al menos 600×150; un avatar, hasta 2 MB.',
        },
        {
          term: 'Por personaje',
          body: 'da a un personaje su propio banner o avatar, o ambos. Sustituye al tuyo por defecto solo en las páginas de ese personaje y en su tarjeta del plugin.',
        },
        {
          term: 'Vitrina',
          body: 'tus mejores drops, contadores de kills y tiempos, fijados en tu perfil: 4 huecos para Supporter, 8 para Champion, 12 para Patron. Lo fijado desde personajes que no compartes sigue siendo privado.',
        },
      ],
    },

    hosting: {
      title: 'Eventos con amigos, cara a cara y chat',
      intro: 'Las ventajas que te dan más espacio para jugar, en vez de un aspecto:',
      rows: [
        {
          term: 'Eventos con amigos',
          body: 'organiza tu propio bingo, bingo en solitario o carrera para amigos desde **Host an event for your friends**, con seguimiento del plugin como un evento de clan. Los amigos entran con tu enlace de invitación. Supporter: 1 evento en curso, 10 jugadores. Champion: 1 evento, 25 jugadores. Patron: 2 a la vez, 50 jugadores entre los dos. Cualquiera puede unirse a uno.',
        },
        {
          term: 'Cara a cara',
          body: 'reta a un amigo desde su perfil: el primero en conseguir un drop, o más kills o XP en 1 hora, 24 horas o 7 días. Solo por presumir. Los jugadores sin nivel pueden tener 1 abierto a la vez, los Supporters 5, y los Champions y Patrons tantos como quieran.',
        },
        {
          term: 'Chat de eventos',
          body: 'cuánto esperas entre líneas: 5 segundos sin nivel, 3 para Supporters, 1 para Champions, nada para Patrons. Cuando el chat de un tablero se llena, todos esperan 10 segundos, Patrons incluidos.',
        },
        {
          term: 'Boosts de clan',
          body: 'Champion 1, Patron 2, mientras pagues. Mira [Dar boost a un clan]({boostsGuide}).',
        },
      ],
    },

    billing: {
      title: 'Pagar, cambiar y cancelar',
      intro: 'Anvil Supporter se cobra a través de Gumroad, al mes o al año.',
      steps: [
        'Inicia sesión en Anvil y abre `/supporter`.',
        'Pulsa **Choose Supporter**, **Choose Champion** o **Choose Patron**. Se abre el pago de Gumroad, con cobro mensual o anual.',
        'Paga. Tus ventajas se activan en cuanto Gumroad avisa a Anvil, y tu nivel aparece en la página de Supporter como **Your tier**.',
      ],
      outro:
        'Para cambiar de nivel, usa **Change tier** en Settings → Supporter. Para cancelar o actualizar tu tarjeta, usa **Manage on Gumroad** ahí mismo. Una suscripción cancelada conserva todas las ventajas hasta el final del periodo que pagaste.',
      note: {
        tag: 'Empieza siempre desde /supporter',
        body: 'El botón **Choose** lleva un código que le dice a Anvil qué cuenta pagó. Anvil nunca relaciona un pago por el correo, así que comprar directamente en Gumroad, sin ese botón, deja el pago sin vincular. Si te pasó, pregunta en el Discord de Anvil y el staff puede asociarlo a tu cuenta a mano.',
      },
    },

    lapse: {
      title: 'Bajar de nivel o dejarlo',
      intro:
        'No se borra nada de lo que configuraste. Cada ventaja se comprueba contra el nivel que tienes ahora mismo, así que se desactiva sola y vuelve en cuanto renuevas.',
      rows: [
        {
          term: 'Colores del nombre',
          body: 'tu elección se queda guardada. Llevas los colores de tu nuevo nivel, o ninguno, hasta que vuelva un nivel que la permita.',
        },
        {
          term: 'Avatar y banner',
          body: 'por debajo de Champion, muestran su primer fotograma fijo en vez de moverse.',
        },
        {
          term: 'Vitrina',
          body: 'muestra las primeras piezas fijadas que permite tu nivel y oculta el resto. Sin nivel queda oculta; lo fijado te espera.',
        },
        {
          term: 'Boosts de clan',
          body: 'tus boosts más antiguos siguen contando y el resto queda en pausa, no se quita.',
        },
      ],
      note: {
        tag: 'Una mejora temporal del staff de Anvil',
        body: 'El staff puede dar a alguien un nivel superior durante un tiempo, por ejemplo como agradecimiento. Se suma a lo que pagas y nunca cambia tu suscripción. Settings → Supporter muestra **A gift from Anvil** y cuándo termina; después vuelves a tu nivel de pago. Un regalo solo da huecos de boost de clan cuando el staff los incluye.',
      },
    },
  },

  sidePanel: {
    metaTitle: 'El panel lateral de Anvil, pestaña a pestaña — Anvil',
    metaDescription:
      'Qué muestra cada pestaña del panel lateral de Anvil en RuneLite (Clan, Feed, You, Lookup y el engranaje), cómo funcionan el chat de eventos y las reacciones del Feed, y los ajustes del plugin para el feed en el chat del juego, los colores de Supporter y los nombres animados.',
    eyebrow: 'Anvil · para jugadores',
    title: 'El panel lateral, pestaña a pestaña',
    dek: 'El botón de Anvil en la barra lateral de RuneLite abre un panel con cuatro pestañas y un engranaje: **Clan**, **Feed**, **You**, **Lookup** y ⚙. Casi todo lo que muestra viene de la web, así que se mantiene al día sin actualizar el plugin. Algunas cosas de abajo están marcadas como parte de la próxima actualización del plugin.',
    facts: [
      { strong: 'Cuatro pestañas', rest: 'y un engranaje para sincronizar y ajustar' },
      { strong: 'Chat de eventos', rest: 'en la pestaña Feed' },
      { strong: 'GZ, Sad, Sit', rest: 'en las filas del Feed' },
    ],
    footnote:
      'Cómo instalar el plugin e iniciar sesión está en la [guía de configuración del plugin de RuneLite]({pluginGuide}). Los colores de Supporter, la estrella y las ventajas del chat se explican en [Anvil Supporter: niveles y ventajas]({supporterGuide}).',

    header: {
      title: 'La parte de arriba del panel',
      intro: 'Sobre las pestañas están el título, **Refresh** y la línea de la cuenta.',
      rows: [
        {
          term: 'Refresh',
          body: 'recarga el panel, incluida la pestaña Feed. Pone **Refreshing…** mientras trabaja. En la próxima actualización del plugin también recarga You y Lookup, para que un avatar o banner nuevo se vea al momento, y ya no deja en blanco la pestaña Feed.',
        },
        {
          term: 'Tracking',
          body: 'la línea bajo el título nombra el personaje al que se sigue, con sus colores de Supporter si los tiene. **Not my account…** deja de seguir a un personaje que otra persona juega en este ordenador; **Track again** lo deshace.',
        },
        {
          term: 'El menú de la cuenta',
          body: 'el enlace ⋯ abre **View my profile on Anvil**, **Not my account…** y **Sign out…**. En la próxima actualización del plugin también tiene **Become a Supporter**, o **Your Supporter perks** si ya lo eres.',
        },
        {
          term: 'Progreso de temporada',
          body: 'en la próxima actualización del plugin, en Leagues, Deadman y otros mundos de temporada, una línea pone **Sharing season progress · Turn off**. Envía tus reliquias, zonas y tareas (con una captura) a tu clan; tu clan elige en la web qué se publica. **Turn on** vuelve a compartirlo. El mismo interruptor es **Share seasonal activity** en los ajustes del plugin.',
        },
      ],
    },

    clan: {
      title: 'Clan',
      intro:
        'Tus eventos y tu clan. En el espacio de un creador, la pestaña dice **Space**.',
      rows: [
        {
          term: 'El desplegable de clan',
          body: 'aparece cuando juegas en más de un clan o espacio. **All clans** (el valor por defecto) muestra todo lo que estás jugando, con el evento en curso primero. Elegir un clan acota el panel a ese clan y envía allí tus envíos.',
        },
        {
          term: 'Eventos',
          body: 'cada tablero, Skill o Boss of the Week y evento de clan, en curso o próximo, con tu posición. Después, **Your other boards**, **Also live** y **Your clan**.',
        },
        {
          term: 'Un tablero',
          body: 'ábrelo para ver su clasificación, equipos, misiones, actividad reciente, las casillas más cercanas y **View all tiles**. Sus botones **Feed** y **Chat** abren ese tablero en la pestaña Feed.',
        },
        {
          term: 'Un evento de clan',
          body: '**I’m going**, **Sign me up** o **Answer the survey**, según el evento.',
        },
      ],
    },

    feed: {
      title: 'Feed',
      intro:
        'Los grandes momentos de tu clan y de tus tableros, en directo: drops, mascotas, logros, quests, muertes y casillas completadas.',
      rows: [
        {
          term: 'De quién es el feed',
          body: 'el desplegable de arriba lista **Clan ·** cada clan del que eres miembro y **Event ·** cada tablero en curso en el que estás. Se abre en tu tablero si tienes uno; si no, en tu clan.',
        },
        {
          term: 'Filtros',
          body: '**All**, **Tiles** (solo tableros), **Drops**, **Pets**, **Achievements**, **Deaths**, y **My team** en un tablero en el que estés en un equipo. El feed de un clan también tiene un botón de actividad de modos de juego para Leagues y otros modos.',
        },
        {
          term: 'Filas nuevas',
          body: 'llegan solas. Si te has desplazado, una píldora **↑ N new** te devuelve a ellas.',
        },
      ],
      note: {
        tag: 'No es lo mismo que el feed en el chat del juego',
        body: 'La pestaña Feed funciona digan lo que digan tus ajustes del plugin. **Show feed in game chat** (paso 8) es el ajuste aparte que además lo imprime en tu chatbox.',
      },
    },

    reactions: {
      title: 'Reacciones',
      intro: 'Cada fila del Feed tiene su reacción debajo:',
      rows: [
        {
          term: 'GZ',
          body: 'en drops, mascotas y logros. El contador se ve al lado, como **GZ 3**.',
        },
        {
          term: 'Sad y Sit',
          body: 'en muertes, en vez de GZ. Sit es la forma del juego de decirle a alguien que ha muerto que se siente.',
        },
        {
          term: 'Quién puede reaccionar',
          body: 'en el feed de un clan, los compañeros de clan. En un tablero, sus jugadores y el staff del organizador; cuando un tablero oculta su clasificación, los jugadores solo pueden reaccionar a las filas de su propio equipo.',
        },
        {
          term: 'Quién ha reaccionado',
          body: 'pasa el ratón por una reacción para ver los nombres, como «GZ · Mossy and 3 others». Haz clic otra vez para retirar la tuya.',
        },
      ],
      note: {
        tag: 'En la próxima actualización del plugin',
        body: 'Las reacciones pasan a ser botones en forma de píldora, teñidos cuando una es tuya, y las reacciones de los demás se actualizan en directo para todos los que miran, también en tus otros clientes abiertos. Hoy el contador cambia cuando reaccionas o cuando se recarga el Feed. El GZ dorado, la reacción de Supporter, se da en los feeds de la web; la pestaña Feed tiene GZ, Sad y Sit.',
      },
    },

    chat: {
      title: 'Chat de eventos',
      intro:
        'Un tablero con el chat activado tiene un interruptor **Feed / Chat** arriba en la pestaña Feed, para los jugadores de ese tablero y el staff del organizador. La página del tablero en la pestaña Clan también tiene un botón **Chat**.',
      rows: [
        {
          term: 'Todos o tu equipo',
          body: '**All** escribe a todo el tablero, **My team** solo a tu equipo (esas líneas van marcadas con **TEAM**). El staff ve además **Host & mods**, y sus líneas van marcadas con **HOST** o **MOD**.',
        },
        {
          term: 'Enviar',
          body: 'escribe en la caja y pulsa Enter. Las líneas tienen hasta 200 caracteres, y solo el organizador y los mods pueden publicar enlaces.',
        },
        {
          term: 'Cada cuánto',
          body: 'la espera entre tus líneas sigue tu nivel de Supporter: 5 segundos sin nivel, 3 para Supporters, 1 para Champions, nada para Patrons. La línea bajo la caja te dice cuál es la tuya. El staff nunca espera.',
        },
        {
          term: 'Modo lento',
          body: 'cuando el chat de un tablero se llena mucho, todos esperan al menos 10 segundos durante un minuto, Patrons incluidos. Nadie puede enviar más de 10 líneas en 10 segundos.',
        },
        {
          term: 'Moderación',
          body: 'el organizador y los mods pueden hacer clic derecho en una línea para **Delete message** o para **Mute** a alguien, y pausar todo el chat con **Pause chat**.',
        },
      ],
      outro:
        'Una serie de líneas de una misma persona comparte un nombre y una hora, hasta que hay un hueco de 5 minutos. El chat se guarda 7 días después de que termine el evento.',
    },

    you: {
      title: 'You y Lookup',
      intro: 'Dos pestañas para tarjetas de jugador: la tuya y la de cualquier otro.',
      rows: [
        {
          term: 'You',
          body: 'tu propia tarjeta, del personaje con el que has iniciado sesión: banner y avatar, **Display case**, Collection Log hasta los objetos de cada página, y **Skills**, **Bosses**, **Clues**, **Times** y **CAs**. Debajo, cualquier reto **Head-to-head** que te espere (**Accept** o **Decline**) y tus **Goals**, con **+ Add goal**.',
        },
        {
          term: 'Lookup',
          body: 'cambia entre **Players** y **Clans**, escribe un nombre y pulsa Enter. **Recent** lista tus últimas búsquedas. Haz clic derecho sobre cualquiera en el juego y elige **Anvil** para llegar aquí.',
        },
        {
          term: 'Comparar',
          body: 'en la tarjeta de otro, **Compare with me** pone a los dos lado a lado, habilidad por habilidad, jefe por jefe y página por página. La tarjeta de un clan tiene **Compare with my clan**.',
        },
      ],
    },

    gear: {
      title: 'La pestaña del engranaje',
      intro: 'Sincronización y ajustes, más que cosas que mirar:',
      rows: [
        {
          term: 'Sync profile',
          body: 'envía tu Collection Log y tus mejores tiempos a Anvil.',
        },
        {
          term: 'Sync clan roster',
          body: 'solo admins del clan: envía a la web la lista de miembros del clan en el juego. Si el plugin no puede leer tu clan, pone **Join your clan channel to sync the roster** en su lugar.',
        },
        {
          term: 'Sonidos del banner',
          body: '**Add clip** para el sonido que hace un banner, **Copy folder path** para gestionarlos, y **Add mission clip** para las misiones.',
        },
        {
          term: 'Become a Supporter',
          body: 'en la próxima actualización del plugin, un enlace ★ abajo abre la página de Supporter, o pone **Your Supporter perks** si ya lo eres.',
        },
      ],
    },

    settings: {
      title: 'Ajustes que cambian lo que ves',
      intro:
        'En la configuración de Anvil en RuneLite, en **Chat messages**. Todos vienen activados.',
      rows: [
        {
          term: 'Show feed in game chat',
          body: 'imprime también el feed en tu chatbox según ocurre: grandes drops, mascotas y logros de los tableros cuyo organizador lo activó y de los clanes en los que eres invitado, el progreso en casillas de tus compañeros de equipo, y las casillas que completan otros equipos.',
        },
        {
          term: 'Supporter names in chat',
          body: 'los colores de los Supporters (y la estrella de un Patron) en el chat público, de clan, de amigos y privado, y en tu lista de amigos y las listas de miembros de los canales. La lista de nombres se descarga de Anvil; no se envía nada sobre a quién ves.',
        },
        {
          term: 'Animated names',
          body: 'deja que el degradado de un Patron se deslice en el panel, el Feed y el chat de eventos. Desactivado, se queda quieto. En la próxima actualización del plugin también cubre los nombres de clanes con boost y los banners animados del panel.',
        },
        {
          term: 'Supporter names in menus',
          body: 'los colores de los Supporters en su nombre cuando haces clic derecho sobre ellos, nunca en mundos PvP ni en el Wilderness.',
        },
        {
          term: 'Por encima de los colores de otros plugins',
          body: 'activado, los colores de un Supporter sustituyen al color de nombre que puso otro plugin, como Player Indicators. Desactivado, deja esos nombres en paz.',
        },
      ],
    },
  },

  clanBoosts: {
    metaTitle: 'Dar boost a un clan — Anvil',
    metaDescription:
      'Cómo funcionan los boosts de clan en Anvil: quién los tiene, colocar y mover un boost, los tres niveles de boost y qué desbloquea cada uno, los colores del nombre del clan, los boosts regalados, y las marcas e insignias de quien da boost.',
    eyebrow: 'Anvil · para Supporters y el equipo del clan',
    title: 'Dar boost a un clan',
    dek: 'Un Champion o Patron de pago puede poner un boost en un clan del que es miembro. Con suficientes boosts de sus miembros, un clan sube de nivel, y cada nivel cambia cómo se ve el clan y dónde aparece listado. Los boosts son solo apariencia: nunca cambian un rango, una puntuación, un puesto ni el plan del clan.',
    facts: [
      { strong: 'Champion 1, Patron 2', rest: 'boosts mientras pagues' },
      { strong: 'Niveles con 3, 8 y 15', rest: 'boosts que cuentan' },
      { strong: 'Una vez por semana', rest: 'se puede mover un boost' },
    ],
    footnote:
      'Los miembros colocan sus boosts en **Settings** → **Clan boosts**. El staff del clan ve el nivel y sus opciones en Admin → **Clan settings** → **Boosts**. Para los propios niveles de Supporter, mira [Anvil Supporter: niveles y ventajas]({supporterGuide}).',

    what: {
      title: 'Quién tiene boosts',
      intro: 'Los boosts vienen con una suscripción de pago:',
      rows: [
        { term: 'Champion', body: '1 boost.' },
        { term: 'Patron', body: '2 boosts.' },
        {
          term: 'Supporter',
          body: 'ninguno. Tampoco el tiempo ganado con invitaciones. Una mejora temporal del staff de Anvil solo da huecos cuando el staff los incluye.',
        },
      ],
      outro:
        'Los boosts son tuyos, no de un personaje: tres personajes en tres clanes siguen compartiendo un solo juego de boosts. **Settings** → **Clan boosts** solo aparece en tus ajustes mientras eres Supporter o todavía tienes un boost colocado.',
    },

    place: {
      title: 'Colocar y mover un boost',
      intro: 'Tus boosts los colocas tú; nadie puede colocar uno por ti.',
      steps: [
        'Abre **Settings** → **Clan boosts**. **Your boosts** lista lo que has colocado y cualquier **Free slot**.',
        'En **Clans you can boost**, pulsa **Boost** junto a un clan. También puedes pulsar **Boost this clan** en la sección Boosters de la propia página del clan.',
        'Para moverlo, usa **Move to…** en su fila y elige otro clan. **Remove** lo quita.',
      ],
      rows: [
        {
          term: 'Un puesto de miembro con 14 días',
          body: 'cada boost va sobre un puesto de miembro que tiene uno de tus personajes en el clan del juego. Un puesto de invitado no puede llevar uno. El puesto cuenta desde lo que ocurriera antes: cuando Anvil lo vio por primera vez, o cuando el juego dice que el personaje se unió. Hasta entonces, la fila del clan dice cuántos días faltan.',
        },
        {
          term: 'Una fila por clan',
          body: 'la lista muestra cada clan una vez, y Anvil elige el personaje sobre el que va el boost: tu principal cuando puede; si no, el puesto que llevas más tiempo. El clan solo ve ese personaje, nunca los demás.',
        },
        {
          term: 'Una vez por semana',
          body: 'un boost colocado se puede mover 7 días después de colocarlo. El hueco de un boost quitado se vuelve a abrir en esa misma fecha, así que quitarlo y volver a colocarlo no es un atajo. Si el personaje sobre el que iba dejó el clan, puedes moverlo al momento.',
        },
      ],
      note: {
        tag: 'Qué significan las etiquetas',
        body: '**counting**: cuenta para el nivel del clan. **paused**: tu suscripción tiene ahora menos huecos de los que colocaste, así que tus boosts más antiguos siguen contando y el resto espera. **seat gone**: el personaje sobre el que iba ya no es miembro allí; muévelo. **over the 2-per-person cap**: el clan ya cuenta dos tuyos.',
      },
    },

    levels: {
      title: 'Niveles',
      intro:
        'El nivel de un clan sale de sus boosts que cuentan. Para un mismo clan cuentan como mucho dos boosts de una misma persona, así que un nivel siempre significa que lo eligieron varios miembros.',
      rows: [
        { term: 'Nivel 1', body: '3 boosts que cuentan.' },
        { term: 'Nivel 2', body: '8 boosts que cuentan.' },
        { term: 'Nivel 3', body: '15 boosts que cuentan.' },
      ],
      outro:
        'Los miembros ven el progreso en la página del clan, por ejemplo «5 of 8 to Level 2». Un clan que sube recibe el nuevo nivel al momento.',
      note: {
        tag: 'Una semana de gracia',
        body: 'Cuando los boosts caen por debajo de un nivel, el clan conserva las ventajas de ese nivel durante 7 días. Admin → Clan settings → Boosts muestra cuándo terminan. Si los miembros vuelven a darle boost a tiempo, no cambia nada.',
      },
    },

    perks: {
      title: 'Qué desbloquea cada nivel',
      intro: 'Cada nivel conserva todo lo del anterior.',
      rows: [
        {
          term: 'Nivel 1',
          body: 'una insignia **Boosted** en la página del clan, en su tarjeta del Clan Hall y en la búsqueda; un sitio por encima de los clanes sin boost en el Clan Hall y en sus resultados de búsqueda; y el nombre del clan en degradado.',
        },
        {
          term: 'Nivel 2',
          body: 'un hueco en la fila **Featured** del Clan Hall; el banner animado del clan se reproduce (por debajo del nivel 2 muestra su fotograma fijo); una línea de reclutamiento para los visitantes; y el degradado del nombre se mueve.',
        },
        {
          term: 'Nivel 3',
          body: 'el **Spotlight** en lo más alto del Clan Hall, y una publicación de reclutamiento al mes en el Discord de Anvil, escrita por el clan.',
        },
      ],
      note: {
        tag: 'El logo del clan no es una ventaja',
        body: 'Un logo animado (una imagen de clan en GIF o WebP) se reproduce en cualquier nivel. Solo el banner espera al nivel 2.',
      },
    },

    colours: {
      title: 'Los colores del nombre del clan',
      intro:
        'Desde el nivel 1, el nombre del clan lleva el degradado de Anvil. Los propietarios y admins pueden elegir los suyos en Admin → **Clan settings** → **Boosts** → **Clan name colours**:',
      rows: [
        {
          term: 'De uno a cuatro colores',
          body: 'un solo color da un nombre fijo; de dos a cuatro forman un degradado. Desde el nivel 2, el degradado se mueve.',
        },
        {
          term: 'Fondos oscuros y claros',
          body: 'como con los nombres de Supporter, Anvil ajusta los colores para que se lean bien sobre fondos oscuros (la web, el panel del plugin, Discord) y claros (el chatbox sólido del juego). Activa un aspecto aparte para cualquiera de los dos y se muestra tal cual lo elegiste.',
        },
        {
          term: 'Reset to Anvil',
          body: 'vuelve a la paleta de Anvil.',
        },
      ],
      outro:
        'Los colores se quedan guardados si el clan baja del nivel 1, y vuelven cuando lo recupera. El plugin recoge un cambio en su siguiente recarga.',
    },

    staff: {
      title: 'Para el staff del clan',
      intro:
        'Admin → **Clan settings** → **Boosts** es para propietarios y admins. El staff no puede colocar boosts por los miembros; los miembros colocan los suyos.',
      rows: [
        {
          term: 'El nivel',
          body: 'el nivel del clan, cuántos boosts cuentan, cuántos más faltan para el siguiente nivel y cualquier semana de gracia.',
        },
        {
          term: 'Recruiting line',
          body: 'nivel 2. Una frase, de hasta 140 caracteres, que ven en la página de tu clan y en su tarjeta del Clan Hall quienes no están en el clan.',
        },
        {
          term: 'Recruitment post in the Anvil Discord',
          body: 'nivel 3. Una vez por mes natural, de 20 a 500 caracteres, escrita por ti y publicada cuando pulsas **Post it**, con un enlace a la página de tu clan. Las menciones se quitan y no se avisa a nadie. No puedes editarla ni enviar otra hasta el mes siguiente.',
        },
        {
          term: 'Boosters',
          body: 'la lista de personajes que dan boost al clan.',
        },
      ],
      note: {
        tag: 'Boosts regalados por Anvil',
        body: 'El staff de Anvil puede regalar a un clan un nivel, durante un tiempo fijo o sin fin. El regalo añade solo los boosts que le faltan al clan para llegar a ese nivel, y aparecen como **Anvil gift** en la lista de Boosters del clan. Cada boost real de un miembro sustituye a un boost regalado, y un clan que ya está por encima del nivel regalado conserva el suyo. Cuando el regalo termina, el clan vuelve al nivel que le dan los boosts de sus miembros.',
      },
    },

    boosters: {
      title: 'Marcas e insignias de quien da boost',
      intro: 'Lo que recibe quien da boost en el clan al que se lo da:',
      rows: [
        {
          term: 'La marca de Booster',
          body: 'una pequeña gema junto a su personaje en la lista de miembros, el feed y las publicaciones de Discord de ese clan. Pasa el ratón por encima para ver «Boosts this clan».',
        },
        {
          term: 'El muro de Boosters',
          body: 'en la página del clan: una fila por personaje, primero quien da más boosts, después quien lleva más tiempo.',
        },
        {
          term: 'Insignias',
          body: '**First booster** para quien colocó el primer boost de la historia del clan; **1 month**, **3 months**, **6 months** y **1 year** de boost sin interrupción; y **Level-up 1**, **2** o **3** para el boost que subió el clan a ese nivel.',
        },
      ],
      note: {
        tag: 'Moverlo reinicia el reloj',
        body: 'Las insignias de tiempo cuentan desde el boost más antiguo del personaje que todavía cuenta, así que mover o quitar un boost las pone a cero. Tu perfil lista los clanes a los que das boost, una vez por clan.',
      },
    },
  },

  profile: {
    metaTitle: 'Tu perfil, Wrapped y Compare — Anvil',
    metaDescription: 'Las páginas que Anvil guarda sobre ti: tu perfil, la página pública de cada personaje, tu página de persona, Wrapped mensual y anual, tarjetas Wrapped de evento, y comparar dos personajes lado a lado.',
    eyebrow: 'Anvil · para jugadores',
    title: 'Tu perfil, Wrapped y Compare',
    dek: 'Anvil guarda una página para **ti** y una para **cada personaje** que juegas. Esto es lo que hay en ellas, quién puede abrirlas, y las tarjetas Wrapped que salen al final de cada mes y de cada evento.',
    facts: [
      {
        strong: 'Compartido por defecto',
        rest: 'cambia cualquier personaje a privado con un solo interruptor',
      },
      {
        strong: 'Wrapped mensual',
        rest: 'sale el día 1 del mes siguiente',
      },
      {
        strong: 'Wrapped de evento',
        rest: 'sale cuando termina el evento',
      },
    ],
    footnote: 'Cada interruptor mencionado aquí se explica donde está, en [Ajustes, página por página]({settingsGuide}).',
    pages: {
      title: 'Tus páginas',
      intro: 'Cuatro páginas, cada una responde a una pregunta distinta:',
      rows: [
        {
          term: 'Tu perfil',
          body: '[/profile](/profile), solo lo ves tú. Elige un personaje con las fichas de arriba para ver sus niveles, jefes, collection log y eventos. Los capitanes también tienen aquí un **Captain’s deck**.',
        },
        {
          term: 'La página de un personaje',
          body: '`/p/<name>`: un personaje, legible para cualquiera con el enlace mientras está compartido. Muestra skills, jefes, el collection log y las mejores marcas personales, y deliberadamente omite tus posiciones en clanes, tu historial de eventos y tu nombre de Discord.',
        },
        {
          term: 'Tu página de persona',
          body: '`/u/…`: todos tus personajes compartidos en una sola página, con tu vitrina y las cuentas de streaming que elegiste mostrar. Solo existe si activas **Show that my characters are one person**.',
        },
        {
          term: 'La página de miembro de un clan',
          body: '`/c/<clan>/members/<name>`: el mismo personaje como lo ve un clan, al que se llega desde la lista **Members** de ese clan. Un clan privado solo muestra sus miembros a su propia gente.',
        },
      ],
    },
    sharing: {
      title: 'Quién puede ver qué',
      body: [
        'Cada personaje empieza **shared**: su página se abre para cualquiera con el enlace, y puede aparecer en clasificaciones y ante otros clanes. Desactívala en **Who sees my characters** en Ajustes y su página responde _not found_ a todos menos a ti. Tú ves **Private — only you can see this page.** con un enlace **Share it →**.',
        'Una página compartida tiene **Copy link** bajo el nombre. Los visitantes con sesión que crean que una página es abusiva pueden pulsar **Report this profile**.',
        'Por personaje, Ajustes también te deja ocultar a qué clan del juego pertenece (**Show my in-game clan**), de modo que sale de la página de ese personaje y de la página de Anvil de ese clan.',
      ],
    },
    wrapped: {
      title: 'Tu Wrapped mensual y anual',
      body: [
        'Cada mes, cada personaje recibe una tarjeta Wrapped: **XP gained**, **Boss kills**, **New slots** en el collection log, horas **Efficient**, **PBs**, además de mascotas y el drop más grande. Sale el **1 del mes siguiente** (UTC). Hasta entonces solo tú puedes abrirla, como vista previa.',
        'El año también tiene una, en `/p/<name>/wrapped/<year>`, desde el **1 de diciembre**. `/p/<name>/wrapped` siempre te lleva a la más reciente que haya.',
        'Pulsa **Copy link to your Wrapped** para compartirla. Pegada en Discord se despliega como una imagen de la tarjeta. El Wrapped de un personaje privado solo se abre para ti, y su enlace se previsualiza como una tarjeta simple de Anvil.',
      ],
      note: {
        tag: 'Un mes vacío',
        body: 'Si ese mes no llegó nada a Anvil (ni XP, kills, casillas del log ni PBs), la tarjeta lo dice en lugar de mostrar ceros. Juega con el plugin, o deja que las hiscores te capten, y el mes siguiente se llena.',
      },
    },
    events: {
      title: 'Wrapped de evento',
      body: [
        'Cuando termina un tablero, cada jugador y cada equipo recibe una tarjeta. Abre la página **Wrapped** del evento: **Your card** está arriba, luego **Teams** (puesto, puntuación y jugadores) y **Players**. Pulsa **Open and share your card** y luego **Copy share link**.',
        'Antes del final verás **Cards aren’t out yet**. El staff puede abrir una vista previa antes, para revisar las tarjetas antes de que las vean los jugadores.',
        'Las imágenes de las tarjetas solo se muestran para un evento de un clan público que no era solo por invitación. Para cualquier otro evento, el enlace sigue funcionando para quienes pueden ver ese evento, y se previsualiza como una tarjeta simple de Anvil.',
      ],
    },
    compare: {
      title: 'Comparar dos personajes',
      body: [
        'Abre [Compare](/compare) y escribe dos nombres. Obtienes skills, jefes y páginas del collection log lado a lado. El líder en cada conteo aparece en dorado. Debajo hay un análisis, el XP por skill, cada jefe que cualquiera de los dos ha matado y cada página del log, ítem por ítem: los dos lo tienen, ninguno, o solo uno de vosotros. **Swap sides** los intercambia.',
        'Solo se pueden comparar personajes compartidos. Uno privado, o un nombre que Anvil no conoce, devuelve _not on Anvil, or not shared_. Siempre puedes comparar tus propios personajes privados si tienes sesión iniciada.',
      ],
    },
  },
  settings: {
    metaTitle: 'Ajustes, página por página — Anvil',
    metaDescription: 'Cada página de los Ajustes de Anvil: publicaciones de Discord y privacidad de capturas, el feed del chat del juego, conexión del plugin y dispositivos, tus propios webhooks, quién ve tus personajes, el aspecto de Supporter y del perfil, cuentas de streaming, cada personaje y las reclamaciones de propiedad.',
    eyebrow: 'Anvil · para jugadores',
    title: 'Ajustes, página por página',
    dek: '[Settings](/settings) es donde viven tus propias elecciones: qué publicas, qué ves en el juego, quién puede ver tus personajes. Las elecciones hechas aquí te siguen a cada ordenador en el que juegues.',
    facts: [
      {
        strong: 'Cuadro de búsqueda',
        rest: 'en la primera página encuentra cualquier ajuste',
      },
      {
        strong: 'Una página por personaje',
        rest: 'dentro de Characters',
      },
      {
        strong: '10 webhooks',
        rest: 'propios',
      },
    ],
    footnote: 'Las páginas de tu perfil se explican en [Tu perfil, Wrapped y Compare]({profileGuide}); los ajustes propios del plugin, en [Configurar el plugin de RuneLite]({pluginGuide}).',
    find: {
      title: 'Encontrar un ajuste',
      body: [
        'La primera página, **Overview & search**, tiene un cuadro de búsqueda. Escribe lo que quieras con tus propias palabras, como _private messages_, _rare drop value_, _death message_, _name colour_ o _plugin token_, y te lleva al interruptor correcto.',
        'El menú de la izquierda tiene dos grupos. **Account** contiene las páginas de abajo. **Characters** tiene una página por cada personaje vinculado (tu principal está marcado como **main**), y luego **Add character**. Un número en **Add character** significa que Anvil ha visto que juegas personajes que aún no has vinculado.',
      ],
    },
    posts: {
      title: 'Publicaciones de Discord y capturas',
      intro: 'Lo que el plugin publica sobre ti en los canales de Discord de tus clanes, y lo que oculta en las capturas. Estas elecciones las lee la siguiente actualización del plugin. Hasta que la tengas, deciden los mismos interruptores en los ajustes del propio plugin.',
      rows: [
        {
          term: 'Lo que publica tu plugin',
          body: '**Rare drops**, **Pets**, **Deaths**, **Collection log slots**, **Level milestones** y **Diary completions** empiezan activados; **PvP kills** empieza desactivado.',
        },
        {
          term: 'Los números',
          body: '**Min drop value** (1m al empezar, al menos 1m, 0 lo desactiva), **Min drop rarity (1 in N)** (1 entre 1,000 al empezar), **Valor y rareza juntos** (uno de los dos al empezar, o **Exigir ambos**), **Loot key value** (1m), un **Death message** de hasta 200 caracteres donde `{name}` se convierte en tu nombre, y el **Combat task tier** y el **Quest tier** más bajos que se publican (Master al empezar). El valor, la rareza y la elección de uno u ambos siguen los valores por defecto de tu clan hasta que pongas los tuyos; **Restablecer al valor del clan** vuelve a seguirlos.',
        },
        {
          term: 'A dónde van tus publicaciones',
          body: '**Keep my announcements out of clans I only guest in**, y **Level posts in clan channels**: **Clan rules**, **Only 99s & max** u **Off**. **Per character** lista cada personaje con un enlace **Clans →** para desactivar las publicaciones en un solo clan.',
        },
        {
          term: 'Capturas por tipo',
          body: 'elige para cada tipo (**Rare drops**, **Pets**, **Deaths**, **Collection log**, **Combat tasks**, **Achievement diaries**, **Levels**, **Player kills**) si su publicación lleva una captura. Todas empiezan activadas. Tu clan puede definir un valor predeterminado para sus miembros; hasta que cambies uno, lo sigues, y **Reset** vuelve a él. Las pruebas de bingo siempre se capturan, elijas lo que elijas: son tu evidencia.',
        },
        {
          term: 'Más para anunciar',
          body: '**Slayer** (cada N tareas), **Clue scrolls** (desde el nivel que elijas), **Speedruns** (solo mejores marcas personales, o cada vez), **Kill count** (cada N muertes), **BA gambles** (cada N apuestas) y **Custom chat messages** (mensajes del juego que coincidan con tus propios patrones, donde `*` es cualquier texto y `#` cualquier número; hasta 10). Todas empiezan desactivadas. Tu clan puede activarlas como predeterminado para sus miembros, y tú puedes activar o desactivar cualquiera para ti; **Reset to clan default** vuelve a seguir a tu clan. Se publican en el canal **Milestones & more** de tu clan y en tus propios webhooks que las acepten; tus patrones solo se publican en tus propios webhooks.',
        },
        {
          term: 'Privado: Grand Exchange, intercambios, almacenamiento de grupo, otros plugins',
          body: '**Grand Exchange** (ofertas finalizadas por al menos la cantidad que pongas), **Player trades** (lo que diste y recibiste), **Group storage** (lo que metiste o sacaste) y **Other plugins** (los plugins de RuneLite que nombres pueden publicar a través de Anvil). Empiezan desactivados, solo tú puedes activarlos, tu clan nunca puede activarlos por ti, y solo se publican en tus propios webhooks: marca el tipo en el webhook donde los quieras.',
        },
        {
          term: 'Plantillas de mensajes',
          body: 'cambia la primera línea de cualquier mensaje: **Loot**, **Pet**, **Collection log**, **Combat tasks**, **Achievement diary**, **Quests**, **Levels**, **Death**, **Player kills**, **Slayer**, **Clue scrolls**, **Speedruns**, **Kill count**, **BA gambles** y, solo para ti, **Grand Exchange**, **Player trades** y **Group storage**. Haz clic en un marcador como `{player}` o `{item}` para añadirlo; la vista previa rellena valores de ejemplo. Cada tipo tiene sus propios marcadores, y cualquier otra cosa entre llaves se queda como la escribiste. Hasta 200 caracteres; las menciones y los enlaces nunca se publican. Sin cambios, el mensaje se publica como siempre; tu clan puede definir el suyo, y **Reset to clan default** vuelve a él.',
        },
        {
          term: 'Privacidad de capturas',
          body: 'marca el chat que se omite en cada captura que hace el plugin, pruebas y publicaciones de Discord por igual: **Private messages** (marcado al empezar), **Public chat**, **Clan chat: others’ messages**, **Clan chat: your own messages**, **Chat channel** y **Group chat**. Los mensajes del juego y las líneas propias de Anvil siempre se quedan.',
        },
      ],
      note: {
        tag: 'Las casillas de tablero nunca se ven afectadas',
        body: 'Desactivar una publicación solo detiene el post de Discord. Los drops, kills y logros siguen contando en cualquier tablero en el que juegues.',
      },
    },
    chat: {
      title: 'Feed del chat del juego',
      intro: 'Lo que el plugin imprime en tu chatbox cuando el ajuste del plugin **Show feed in game chat** está activado.',
      rows: [
        {
          term: 'De dónde',
          body: '**Boards I play on**, y **Clans I’m guesting in, and my clan’s guests**.',
        },
        {
          term: 'Qué',
          body: 'drops que valgan al menos una cantidad que eliges, **Pets**, **New collection log slots**, **Other teams’ completed tiles**, **My team’s progress on item tiles**, **Leagues, Deadman and other game-mode unlocks**, y logros de combate, niveles, quests y diarios.',
        },
        {
          term: 'Al iniciar sesión',
          body: '**A short brief in chat**: lo que pasó mientras estabas fuera. Los Champions eligen lo que cubre.',
        },
        {
          term: 'Colores',
          body: '**Anvil lines in chat**: **By type (Anvil colours)**, **One colour (the plugin’s own)**, o **My own colours** para Supporters.',
        },
      ],
    },
    login: {
      title: 'Conexión del plugin, inicio de sesión y dispositivos',
      intro: 'Dónde están iniciadas sesión el plugin y la web, y cómo cerrarlas.',
      rows: [
        {
          term: 'Conexión del plugin',
          body: 'tu token del plugin, para el caso raro en que lo pegas a mano. Normalmente **Sign in with Discord** en el panel lateral lo hace por ti.',
        },
        {
          term: 'Inicio de sesión y dispositivos',
          body: 'cada ordenador con sesión del plugin, como **RuneLite sign-in 1**, **2**… con cuándo se creó y cuándo se usó por última vez. **Revoke** cierra la sesión de uno, por ejemplo de un ordenador que vendiste. **Enter a code** vincula otro ordenador. **Sessions** cierra tu sesión en la web en todas partes.',
        },
        {
          term: 'Facturación del clan',
          body: 'los dueños de clan tienen aquí **Open portal →**, para la facturación del clan.',
        },
      ],
    },
    webhooks: {
      title: 'Tus webhooks de Discord',
      body: [
        'Tus publicaciones también pueden ir a un servidor de Discord propio: un canal privado, el servidor de tus amigos, donde sea que puedas crear un webhook. Pega el enlace del webhook, marca lo que recibe (**Rare drops**, **Pets**, **Deaths**, **Combat achievements**, **Levels & milestones**, **Quests**, **Achievement diaries**, **Collection log**, **PvP kills**), opcionalmente fija **Only drops worth at least … gp**, y pulsa **Add webhook**.',
        'Puedes tener hasta 10. Solo se aceptan enlaces de webhooks de Discord, y un enlace guardado se muestra enmascarado, para que una captura de esta página no lo filtre. **Level posts on my webhooks** fija tus propias reglas de nivel para ellos, separadas de las de tu clan.',
      ],
    },
    privacy: {
      title: 'Quién ve mis personajes',
      intro: 'Tus personajes se comparten desde el principio. Tres interruptores cambian eso:',
      rows: [
        {
          term: 'Show <name> publicly',
          body: 'un interruptor por personaje. Activado (al empezar), su página es **Public**. Desactivado, es **Only its clans**: sus clanes siguen viéndolo en sus listas y eventos, nadie más lo ve, y sale de las clasificaciones.',
        },
        {
          term: 'Show that my characters are one person',
          body: 'con dos o más personajes, esto crea tu página de persona, que reúne tus personajes compartidos. Desactivado, nadie puede saber que son todos tuyos.',
        },
        {
          term: 'Show other clans’ boards',
          body: 'si la página de inicio te muestra los tableros abiertos de otros clanes para que los mires.',
        },
      ],
    },
    look: {
      title: 'Supporter, aspecto del perfil, streaming y boosts',
      intro: 'Cómo te ves en Anvil, y las cuentas y ventajas que hay detrás.',
      rows: [
        {
          term: 'Supporter y colores de nombre',
          body: 'tu nivel, tus ventajas y tu enlace de invitación: trae amigos y gana meses gratis. Los niveles se explican en [Anvil Supporter]({supporterGuide}).',
        },
        {
          term: 'Aspecto del perfil',
          body: 'avatar y banner (animados desde Champion), distintos por personaje si quieres, y la **Display case**: 4, 8 o 12 pins según el nivel.',
        },
        {
          term: 'Cuentas de streaming',
          body: '**Twitch**, **YouTube**, **Kick** y **Medal**. Cada una muestra si está verificada, con un interruptor para mostrarla en tu perfil. Las cuentas verificadas son lo que te deja entrar a eventos de seguidores y suscriptores.',
        },
        {
          term: 'Boosts de clan',
          body: 'solo se muestra cuando puedes dar boost: tus slots, dónde están colocados y los clanes que puedes impulsar. Ver [Dar boost a un clan]({boostsGuide}).',
        },
      ],
    },
    characters: {
      title: 'Cada personaje',
      intro: 'Dentro de **Characters**, cada personaje tiene su propia página: su tipo, si está verificado, y enlaces a su página pública y a su perfil completo.',
      rows: [
        {
          term: 'Visibilidad',
          body: '**Show to other clans and on leaderboards**, y **Show my in-game clan**.',
        },
        {
          term: 'Clanes',
          body: 'cada clan y espacio en el que está, como **member** o **guest**, con **Announce drops & achievements** por clan y **Leave**. Si Anvil lo tiene en el clan equivocado, **Which clan is it really in?** avisa al staff.',
        },
        {
          term: 'Personaje',
          body: '**Make main**, pedir un renombrado tras un cambio de nombre, o **Remove** de tu cuenta. Sus resultados anteriores se quedan donde están.',
        },
        {
          term: 'Añadir personaje',
          body: 'juega una vez con el plugin con sesión iniciada y se vincula solo. En móvil o en el cliente oficial, vincúlalo por nombre. **We noticed you playing** lista los que Anvil ha visto; **Not mine** descarta uno.',
        },
      ],
    },
    claims: {
      title: 'Reclamaciones de propiedad',
      body: [
        'Si un personaje está vinculado a la cuenta de Anvil de otra persona pero en realidad es tuyo, pulsa **This is my account** en la pestaña **You** del panel lateral del plugin. Demuestras que lo juegas con una comprobación rápida de XP, y luego se le pregunta al titular actual. Tú nunca sabes quién es, y él nunca sabe quién eres.',
        'Tus reclamaciones muestran **XP check**, **open**, y luego cómo terminaron: **moved to you**, **with Anvil staff**, **withdrawn**, **check timed out** o **closed**. **Withdraw** cancela una.',
        'Cuando alguien reclama uno de los tuyos, aparece en **Claims on your characters** con **Approve** u **Object — it’s mine**. Un personaje no verificado se traslada tras 7 días salvo que lo objetes. Uno verificado solo se traslada si lo apruebas.',
      ],
    },
  },
  weekly: {
    metaTitle: 'Skill y Boss of the Week — Anvil',
    metaDescription: 'Cómo organizar una Skill of the Week, Boss of the Week o carrera de eficiencia en Anvil: programarla, repetirla y rotarla, líneas de salida, añadir y quitar gente, premios, terminarla antes de tiempo y lo que ven los jugadores.',
    eyebrow: 'Anvil · para staff de clan y jugadores',
    title: 'Skill y Boss of the Week',
    dek: 'Una competición semanal es el evento de poco esfuerzo: sin casillas que escribir, sin equipos y sin inscripciones. Todos en la lista del clan entran al empezar, y gana quien más suba antes de que termine.',
    facts: [
      {
        strong: 'Sin casillas, sin equipos',
        rest: 'una sola clasificación',
      },
      {
        strong: 'Dentro al empezar',
        rest: 'toda la lista del clan, automáticamente',
      },
      {
        strong: 'Hasta 10 puestos de premio',
        rest: 'pagados desde la caja',
      },
    ],
    footnote: 'Los tableros (bingo) están en [Organizar tu primer evento]({adminGuide}); los premios y la caja en [La caja del clan]({cofferGuide}).',
    schedule: {
      title: 'Programar una',
      intro: 'Cinco elecciones, y los valores por defecto sirven para la mayoría de clanes:',
      steps: [
        'Abre **Schedule** en el menú de admin y pulsa **+ Schedule event** (los moderadores pueden usar **Schedule a competition**).',
        'Elige el tipo: **Skill of the Week** (XP ganada), **Boss of the Week** (kills ganadas) o **Efficiency race** (horas jugadas o horas de jefes ganadas).',
        'Bajo **What is measured**, elige la skill o el boss. Para cambiarlo cada semana, añade más en **Then rotate through**. Déjalo vacío para repetir el mismo.',
        'Elige cuándo **Runs**: **This weekend**, **One week**, o tus propias fechas. Siempre necesita un final, porque puntúa las ganancias entre el inicio y el final.',
        'Deja **Repeat every week** activado y la siguiente empieza en cuanto termina esta, con la misma duración y los mismos premios. Marca **Guests race too** si los invitados de tu clan deben estar en el tablero.',
      ],
      outro: 'No hay nada más que configurar. Las líneas de salida se toman de las hiscores al empezar.',
    },
    counting: {
      title: 'Cómo se cuenta',
      body: [
        'La ganancia de cada jugador es su stat ahora menos su stat cuando empezó la competición (su **starting line**). Gana la mayor ganancia; un empate se lista por nombre, y los premios se pueden repartir entre puestos empatados.',
        'Las líneas de salida se toman de las hiscores. Después, las actualizaciones en vivo del plugin mantienen el tablero al día entre comprobaciones de hiscores, así que los jugadores con el plugin suben en el tablero mientras juegan.',
        'Un número que baja se ignora, y una ganancia que parece imposible se **flagged** para el staff en lugar de contarse o recortarse.',
      ],
      note: {
        tag: 'Jugadores: cierren sesión antes de que empiece',
        body: 'Las hiscores solo guardan tus stats cuando cierras sesión. Si haces grind hasta justo el inicio sin cerrar sesión, tu línea de salida se toma de antes de ese grind y el grind cuenta como ganancia. El staff normalmente lo detecta y corrige tu línea de salida, pero cierra sesión una vez antes de que empiece.',
      },
    },
    manage: {
      title: 'Gestionarla',
      intro: 'Abre la competición desde **Schedule** o el panel. Tiene una página de inicio y tres pestañas:',
      rows: [
        {
          term: 'Inicio',
          body: 'la **Leaderboard** (top 25, con cuántos están puntuando), las ganancias **flagged**, quien **left the clan**, y los premios. Cuando termina, los ganadores y la **Final leaderboard**.',
        },
        {
          term: 'Líneas de salida',
          body: 'el **Started at**, **Now** y **Gained** de cada jugador. Corrige a mano una línea de salida cuando se contó un grind previo a la competición, y la clasificación lo sigue. **Pull current stats** actualiza a todos; **Reset baselines** vuelve a empezar a todos desde sus hiscores actuales y borra todas las ganancias.',
        },
        {
          term: 'Participantes',
          body: 'la lista del clan completa ya está dentro. **Add someone** acepta un nombre por línea, para un invitado o una cuenta que aún no está en la lista. Quitar a un jugador borra su posición; volver a añadirlo le da una línea de salida nueva. **Leave one each** limpia a una persona inscrita con varios personajes. También puedes quitar a todos los invitados de una vez.',
        },
        {
          term: 'Ajustes',
          body: 'nombre, fechas, **Repeat every week**, y **Status** (solo para desbloquear una; avanza sola). Los admins pueden **Delete** la competición, junto con sus participantes y clasificaciones.',
        },
      ],
    },
    prizes: {
      title: 'Premios y final',
      body: [
        'Fija premios para hasta 10 puestos, pagados desde la caja del clan. Tú decides si un jugador sin ganancia puede cobrar y si los puestos empatados comparten premio. Cómo se mueve el dinero está en [La caja del clan]({cofferGuide}).',
        'Termina sola a la hora que fijaste. **End now** la detiene antes: las ganancias dejan de contar al instante, y los resultados se publican en Discord con los premios pagados en 15 minutos.',
      ],
    },
    players: {
      title: 'Para jugadores',
      body: [
        'No te apuntas. Si estás en la lista del clan cuando empieza, entras. Búscala en la página **Events** de tu clan, en la pestaña **Clan** del panel lateral del plugin con tu posición, y en Discord cuando empieza y termina.',
        'Cada competición tiene su propia página con la clasificación en vivo y cómo fue la carrera día a día. Un clan privado solo la muestra a sus propios miembros.',
        'Jugar con el plugin mantiene tu número en vivo. Sin él sigues contando, solo a la velocidad de las hiscores.',
      ],
    },
    teamsLine: "¿Quieres equipos, o clanes compitiendo entre sí, en una skill o boss? Elige el **Format** al programarla. Mira [Competiciones por equipos]({teamCompsGuide}).",
  },
  teamComps: {
    "metaTitle": "Competiciones por equipos — Anvil",
    "metaDescription": "Organiza una Skill o Boss of the Week por equipos o clan contra clan en Anvil: repartir jugadores en equipos, invitar a otros clanes, cómo puntúan los totales y promedios, jugadores que se unen tarde y lo que ven los jugadores.",
    "eyebrow": "Anvil · para staff de clanes y jugadores",
    "title": "Competiciones por equipos",
    "dek": "Cada competición de skill o boss tiene un Format. Solo es el valor por defecto y funciona como siempre. Elige Teams para dividir tu clan en bandos, o Clan vs clan para competir contra otros clanes en la misma skill o boss.",
    "facts": [
      {
        "strong": "Tres formatos",
        "rest": "Solo, Teams, Clan vs clan"
      },
      {
        "strong": "Los totales deciden",
        "rest": "con un promedio por jugador"
      },
      {
        "strong": "Solo el anfitrión edita",
        "rest": "los clanes socios miran"
      }
    ],
    "footnote": "Las bases de Skill and Boss of the Week están en [Skill and Boss of the Week]({weeklyGuide}). ¿Quieres que los clanes compitan en tableros de bingo? Mira [Alojar a un clan visitante]({clanVsClanGuide}).",
    "teams": {
      "title": "Configurar equipos",
      "intro": "Los equipos dividen tu propio clan en bandos. Tarda cerca de un minuto:",
      "steps": [
        "Programa una competición como de costumbre. Pon **Format** en **Teams**.",
        "Escribe los nombres de los equipos. Todos los inscritos se reparten por igual según su nivel actual o su KC, para que los bandos empiecen equilibrados.",
        "Deja **Late joiners go into the smallest team** activado si la gente puede llegar después del inicio. Desactívalo para mantener los equipos fijos.",
        "Para cambiar algo más tarde, abre la competición y elige **Teams** en su barra lateral de admin. Ahí puedes:"
      ],
      "rows": [
        {
          "term": "Renombrar y cambiar color",
          "body": "pon un nombre a cada equipo y un color que los jugadores reconozcan."
        },
        {
          "term": "Añadir y eliminar equipos",
          "body": "empieza con dos y añade un tercero, o elimina uno que ya no necesites."
        },
        {
          "term": "Mover a un jugador",
          "body": "envía a alguien a otro equipo. Útil para amigos que quieren jugar juntos."
        },
        {
          "term": "Auto-balance",
          "body": "pulsa **Auto-balance by current level/KC** para volver a repartir a todos por igual."
        },
        {
          "term": "Late joiners",
          "body": "activa o desactiva la opción de llegadas tardías. Si está activa, los nuevos jugadores entran en el equipo más pequeño."
        }
      ],
      "note": {
        "tag": "Sin equipo, sin problema",
        "body": "Un jugador sin equipo sigue contando en el tablero individual. Simplemente no suma al total de ningún equipo."
      },
      "outro": "Una competición recurrente traslada sus equipos a la semana siguiente y los vuelve a equilibrar."
    },
    "clans": {
      "title": "Configurar clan contra clan",
      "intro": "Clan vs clan permite que otros clanes se unan a tu competición, todos los que quieras. Tú eres el anfitrión y los demás clanes son socios.",
      "steps": [
        "Como admin o superior en el clan anfitrión, pon **Format** en **Clan vs clan**.",
        "Invita a los otros clanes con su dirección. Hazlo en el formulario de creación o más tarde, en la página **Clans** de la competición.",
        "El dueño o el admin del clan invitado acepta o rechaza en su página **People** o en la lista de **Events**. Un moderador no puede hacerlo. Nadie de ese clan entra hasta que acepte.",
        "Cuando acepta, elige quién compite: **All members** de su plantilla, o **Selected people** que él escoja. Puede cambiarlo después desde la misma tarjeta.",
      ],
      "body": [
        "El clan socio puede seguir la clasificación en su propia web, en `/c/<slug>/weekly/<id>`. Es de solo lectura. Solo el anfitrión edita la competición.",
        "Para quitar un clan, elimínalo en la página **Clans**. Sus jugadores salen del tablero.",
        "Una competición que se repite envía invitaciones nuevas cada semana, así que cada clan tiene que volver a aceptar.",
        "¿Recibes invitaciones que no quieres? Elige **Decline & block this clan** en la invitación. Las invitaciones futuras de ese clan se rechazan en silencio, y puedes desbloquearlo en **Settings → Blocked clans**.",
      ],
      "note": {
        "tag": "Comparte la dirección",
        "body": "La dirección de un clan es el nombre corto de su URL. Pide al admin del otro clan que te la dé antes de invitarlo."
      }
    },
    "scoring": {
      "title": "Cómo puntúa",
      "body": [
        "El total de un equipo o clan es la suma de las ganancias de sus miembros. Las ganancias se cuentan igual que en el tablero individual.",
        "Junto a cada total también ves un **promedio por jugador**, así que un equipo de 8 y uno de 12 siguen siendo comparables.",
        "Si dos totales empatan, el que llegó antes a esa cifra queda por encima."
      ]
    },
    "players": {
      "title": "Lo que ven los jugadores",
      "body": [
        "La página de la competición muestra primero la clasificación de equipos o clanes. Ábrela para ver a sus jugadores. Tu equipo o clan aparece resaltado.",
        "Los mensajes de Discord al inicio, a mitad y al final muestran la clasificación. En clan vs clan llegan al canal de cada clan, y el tuyo aparece marcado con **← you**.",
        "En el panel lateral del plugin puedes ver en qué puesto queda tu equipo.",
        "No hay nada que inscribirse. Si tu clan incluye a todos sus miembros y tú estás en la plantilla, estás dentro. Si elige personas, entras cuando te elijan.",
        "¿No quieres participar? Pulsa **Opt out** junto a **You’re in**, en la página de la competición, en la lista de Events o en el plugin. Sales del tablero solo en esa competición, y puedes volver a unirte mientras siga en marcha.",
      ]
    },
    "faq": {
      "title": "Preguntas",
      "intro": "Las que más preguntan el staff del clan y los jugadores:",
      "rows": [
        { term: "Nuestros equipos tienen tamaños distintos. ¿Es injusto?", body: "No por sí mismo. Los totales deciden la clasificación, pero cada equipo también muestra un promedio por jugador, para que veas cómo le va realmente a un equipo más pequeño." },
        { term: "¿Qué pasa con quienes se unen tarde?", body: "Con el interruptor de incorporación tardía activado, entran en el equipo más pequeño. Con él desactivado, solo cuentan en el tablero individual. Siempre puedes moverlos a mano en la página **Teams**." },
        { term: "¿Puede el otro clan editar nuestra competición?", body: "No. Los clanes socios ven la clasificación en modo de solo lectura. Solo el clan anfitrión puede cambiar la competición." },
        { term: "¿Puedo no participar en una competición?", body: "Sí. Pulsa **Opt out** en la página de la competición, en la lista de Events o en el plugin. Solo afecta a esa competición, y puedes volver a unirte mientras esté en marcha." },
        { term: "¿Cuántos clanes pueden competir?", body: "Tantos como invites, hasta 50 en una competición. Cada clan ve su propio lado marcado en la clasificación y en sus mensajes de Discord." },
        { term: "Otro clan no deja de invitarnos. ¿Podemos pararlo?", body: "Sí. Un dueño o admin elige **Decline & block this clan** en la invitación. Las invitaciones futuras se rechazan sin avisarles. Puedes desbloquearlo en cualquier momento en **Settings → Blocked clans**." },
        { term: "Si aceptamos una vez, ¿quedamos inscritos cada semana?", body: "No. Una competición que se repite envía invitaciones nuevas cada semana, y un dueño o admin tiene que aceptar cada una." },
      ]
    }
  },

  clanEvents: {
    metaTitle: 'Eventos del clan y el calendario — Anvil',
    metaDescription: 'Programar eventos de clan en Anvil: masivos, viajes y quedadas, repeticiones semanales, «Voy» e inscripciones con plazas, preguntas y cuotas, publicaciones y recordatorios en Discord, pagos, encuestas, y el calendario que muestra los huecos.',
    eyebrow: 'Anvil · para staff de clan',
    title: 'Eventos del clan y el calendario',
    dek: 'No todo es un tablero. Un evento de clan es un masivo, una noche de raid, una fiesta de drops o una quedada: una hora y un lugar, publicados en Discord y con recordatorios, con toda la inscripción que quieras o ninguna.',
    facts: [
      {
        strong: 'Una vez o cada semana',
        rest: 'con fecha de fin opcional',
      },
      {
        strong: 'Tres formas de unirse',
        rest: 'información, «Voy» o inscripciones',
      },
      {
        strong: 'Recordatorio',
        rest: '15 minutos antes, y luego al empezar',
      },
    ],
    footnote: 'Las competiciones semanales están en [Skill y Boss of the Week]({weeklyGuide}); las cuotas y los premios en [Cuotas y pagos]({feesGuide}).',
    create: {
      title: 'Programar uno',
      intro: 'Abre **Clan events** en el menú de admin y rellena el formulario:',
      rows: [
        {
          term: 'Nombre, hora, duración',
          body: '**Name**, **Starts (your time)** en tu propia zona horaria, y **Minutes**.',
        },
        {
          term: 'Repeticiones',
          body: '**Just once** o **Every week**, con una fecha **Until** opcional.',
        },
        {
          term: 'Dónde',
          body: '**Where**, **World** y **Host**, más una imagen: elige un boss o una skill, o sube la tuya.',
        },
        {
          term: 'Detalles',
          body: 'equipo, requisitos, qué traer.',
        },
        {
          term: 'Quién viene',
          body: '**Just information** (sin botón ni contador), **“I’m going”** (un toque, muestra un contador) o **Sign-ups** (plazas, preguntas y una cuota).',
        },
        {
          term: 'Discord',
          body: '**Post to** un canal (o el predeterminado del clan), **Chat**, **Guide** y **Voice** opcionales para vincular, y si mencionar el rol de miembro en el anuncio, el recordatorio y el inicio.',
        },
      ],
      outro: 'Pulsa **Schedule it**. Los pagos y una encuesta se añaden después desde la propia página del evento.',
    },
    discord: {
      title: 'Lo que ve Discord',
      body: [
        'El anuncio se publica al programarlo y se edita en el sitio cada vez que cambias algo, así que nunca hay una copia desfasada. Un evento que se repite se marca **every week**.',
        'Quince minutos antes publica **Starting in 15 minutes**, y al empezar **Starting now**. Si mueves la hora, los recordatorios se mueven con ella. Cancelarlo (**Cancel**) marca la publicación como **Cancelled**, para que nadie se presente.',
      ],
    },
    manage: {
      title: 'Inscripciones, cuotas y pagos',
      intro: 'Abre el evento para cambiar lo que usa. Todo empieza desactivado:',
      rows: [
        {
          term: 'Inscripciones',
          body: 'con **Places** (vacío para sin límite), cuándo **Sign-ups close**, y **Sign-up questions**. **You approve each one** hace que cada inscripción espere al staff.',
        },
        {
          term: 'Botón «Voy»',
          body: 'desactivado lo deja solo como información: sin botón ni contador en la web, en el plugin ni en Discord.',
        },
        {
          term: 'Cuota de entrada',
          body: 'activa las inscripciones. Añade gp propios al bote en **Added to the pot**.',
        },
        {
          term: 'Pagos',
          body: 'el bote son las cuotas más lo que añadiste. Pon **Who** recibe qué y **For** qué, y marca cada uno como **Paid**. Anvil te avisa si pagas más de lo que hay en el bote.',
        },
        {
          term: 'Encuesta después',
          body: 'se abre cuando termina. Solo el staff ve las respuestas. Si tuvo inscripciones, solo se pregunta a las personas que se inscribieron.',
        },
        {
          term: 'Un evento semanal',
          body: '**Every week is…** **Its own** (inscripciones, bote y encuesta cada semana) o **One run** (una inscripción, bote y encuesta para toda la serie).',
        },
      ],
    },
    players: {
      title: 'Lo que ven los miembros',
      body: [
        'La página del evento muestra **When**, **Where**, **Host**, **Discord**, **Entry** y **Prizes**, con **Live now** mientras está en marcha. Los miembros pulsan **I’m going** o **Sign me up**, o **Ask to sign up** cuando el staff aprueba cada inscripción. También está en la pestaña **Clan** del panel lateral del plugin, con los mismos botones.',
        'Solo los miembros del clan pueden decir que van o inscribirse.',
      ],
    },
    calendar: {
      title: 'El calendario',
      body: [
        '**Schedule** pone tableros, competiciones semanales y eventos de clan en un solo calendario, con un filtro para cada uno.',
        'Cualquier tramo de dos o más días sin nada se marca como hueco, con **Fill the gap** para programar algo ahí. Úsalo para mantener al clan ocupado entre grandes eventos, en lugar de dejar pasar una quincena tranquila.',
      ],
    },
  },
  challenges: {
    metaTitle: 'Retos y eventos de amigos — Anvil',
    metaDescription: 'Retos cara a cara en Anvil (el primero en un drop, más kills o más XP en 1 hora, 24 horas o 7 días) y eventos de amigos para Supporters: tableros privados para tus amigos detrás de un solo enlace de invitación.',
    eyebrow: 'Anvil · para jugadores',
    title: 'Retos y eventos de amigos',
    dek: 'Dos formas de jugar contra gente que conoces sin un evento de clan: un **reto** es un jugador contra otro, y un **evento de amigos** es un tablero privado para un grupo, detrás de un enlace de invitación.',
    facts: [
      {
        strong: 'De 1 hora a 7 días',
        rest: 'por reto',
      },
      {
        strong: 'Solo presumir',
        rest: 'sin apuestas, sin gp',
      },
      {
        strong: 'Hasta 50 amigos',
        rest: 'por evento de amigos, según el nivel',
      },
    ],
    footnote: 'Los niveles y lo que aloja cada uno están en [Anvil Supporter: niveles y ventajas]({supporterGuide}).',
    start: {
      title: 'Retar a alguien',
      intro: 'Necesitas un personaje verificado, y ellos también.',
      steps: [
        'Abre [Challenges](/challenges), o pulsa **Challenge <name>** en el perfil de un jugador.',
        'Bajo **Who**, escribe su nombre, y bajo **Playing as**, elige tu propio personaje. Tiene que estar verificado.',
        'Elige la carrera: **First to a drop** (hasta 5 ítems, todos drops de monstruos), **Most kills** de un boss, o **Most XP** en una skill o en el total.',
        'Elige el límite de tiempo: **1 hour**, **24 hours** o **7 days**. Marca **OK to show the result publicly** si no te importa que se vea; solo es público si ambos lo marcáis.',
      ],
      outro: 'Reciben una notificación y un mensaje de Discord, y tienen 24 horas para **Accept**, **Decline** o **Decline and block**. El reloj empieza cuando aceptan.',
    },
    rules: {
      title: 'Cómo se decide',
      intro: 'Anvil lo resuelve solo, a menos de un minuto del final.',
      rows: [
        {
          term: 'Kills y XP',
          body: 'ambas líneas de salida se toman cuando se acepta; gana quien más suba al final, y las ganancias iguales son empate. Cuentan las hiscores y el plugin, la que sea más alta.',
        },
        {
          term: 'El primero en un drop',
          body: 'el primero de vosotros que consiga uno de los ítems gana, en ese mismo momento. Los drops solo los ve el plugin, así que los dos necesitáis tenerlo activo. Si nadie consigue uno a tiempo: empate.',
        },
        {
          term: 'Cancelarlo',
          body: 'puedes retirar tu propio reto hasta que lo respondan. Una vez en marcha, solo se detiene si ambos estáis de acuerdo.',
        },
      ],
    },
    limits: {
      title: 'Límites y decir que no',
      body: [
        'Los retos abiertos (en espera o en marcha, enviados o recibidos) se limitan por nivel: **1** gratis, **5** para Supporters, sin límite para Champions y Patrons. Cualquiera puede empezar hasta 20 al día, y solo uno a la vez con la misma persona.',
        '¿No quieres ninguno? **Turn away all new challenges**, o bloquea a una persona al rechazar. Quien te reta ve el mismo rechazo en cualquier caso, así que no puede saber si lo bloqueaste.',
        'La página guarda **Your record** (victorias, derrotas y empates), lo que está **Open now** y **Your limit**.',
      ],
    },
    friends: {
      title: 'Organizar un evento de amigos',
      body: [
        'Cualquier Supporter, Champion o Patron puede dirigir un tablero privado para amigos desde [Host](/host) → **Host for friends** → **New friends event**. Es un tablero completo: bingo o una carrera de casillas, seguido por el plugin, con la misma configuración que el evento de un creador.',
        'Envía el **Invite link**; es la única forma de entrar. Tus amigos lo abren, inician sesión con Discord y pulsan **Open the event**. Unirse siempre es gratis. Si el enlace se filtra, crea uno nuevo: el anterior deja de funcionar y quienes ya están dentro se quedan.',
        'Un evento de amigos nunca aparece en ningún sitio de Anvil, y no necesita clan.',
      ],
      table: {
        areaLabel: 'Nivel',
        columns: [
          'Jugadores',
          'En marcha a la vez',
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
        tag: 'Si tu nivel termina',
        body: 'Los amigos que ya están dentro se quedan. Los nuevos amigos no pueden entrar por encima de tu nuevo límite, y tú no puedes empezar otro hasta que vuelvas a estar por debajo.',
      },
    },
  },
  clanHall: {
    metaTitle: 'Encontrar clanes, eventos y clasificaciones — Anvil',
    metaDescription: 'Cómo encontrar un clan de OSRS en el Clan Hall de Anvil, comparar dos clanes, las clasificaciones semanales de jugadores y clanes, la lista pública de eventos, y las páginas de clanes del juego que no están en Anvil.',
    eyebrow: 'Anvil · para jugadores y clanes',
    title: 'Encontrar clanes, eventos y clasificaciones',
    dek: 'Las páginas públicas de Anvil para echar un vistazo: el **Clan Hall** para encontrar un clan, la lista **Events** para encontrar algo en lo que unirte, y la **Leaderboard** para ver quién gana más.',
    facts: [
      {
        strong: 'Clan Hall',
        rest: 'solo clanes públicos',
      },
      {
        strong: 'Clasificación',
        rest: 'esta semana, 30 días, todo el tiempo',
      },
      {
        strong: 'Eventos',
        rest: 'solo lo que anunció el anfitrión',
      },
    ],
    footnote: 'Para que tu propio clan aparezca listado, mira [Crear un clan]({clanGuide}); los clanes con boost salen destacados, mira [Dar boost a un clan]({boostsGuide}).',
    hall: {
      title: 'El Clan Hall',
      body: [
        '[Clan Hall](/clans) lista todos los clanes públicos. Busca por nombre o lema, y luego acota a **Taking members** u **Open to challenges**. **Most active** (el orden en que se abre) pone primero a los clanes cuyos miembros más subieron esta semana; **Biggest** ordena por miembros.',
        'Cada tarjeta indica si el clan está **Recruiting** y cómo acepta invitados: **Guests welcome**, **Guests by approval** o **No guests**. Los clanes con boost tienen filas destacadas arriba, y los creadores tienen una fila propia.',
      ],
      note: {
        tag: '¿No aparece?',
        body: 'Solo aparecen los clanes configurados como públicos, y un clan puede desactivar su listado en sus ajustes. Los clanes privados nunca están en el Clan Hall, la clasificación ni las comparaciones.',
      },
    },
    compare: {
      title: 'Comparar dos clanes',
      body: [
        '[Compare clans](/compare/clans) pone lado a lado dos clanes listados cualesquiera. Para comparar dos personajes, usa [Compare](/compare).',
      ],
    },
    board: {
      title: 'La clasificación',
      body: [
        '[Leaderboard](/leaderboard) ordena jugadores y clanes por experiencia, horas eficientes y bossing en **This week**, **30 days** o **All time**. Los jugadores se pueden acotar a cuentas **Regular**, **Ironman**, **Hardcore**, **Ultimate** o **Group**.',
        'Los clanes se ordenan por el XP que ganaron sus miembros. Solo aparecen clanes verificados listados en el Clan Hall. Las ganancias de un invitado cuentan para su propio clan, no para el que visita.',
      ],
    },
    events: {
      title: 'Encontrar un evento al que unirse',
      body: [
        '[Events](/events) lista lo que está en vivo y próximo en todo Anvil. Filtra por **Live now**, **Open to join** o **Starting this week**, por formato o **Solo**, por **Anyone can join** o **Ask or meet a rule**, y por **Clans** o **Creators**. **Join** te lleva a inscribirte.',
        'Solo aparecen los eventos cuyo anfitrión activó **Advertise on Anvil**. Los eventos solo para miembros y solo por invitación nunca aparecen.',
      ],
    },
    ghost: {
      title: 'Clanes del juego que no están en Anvil',
      body: [
        'La página de un personaje indica el clan del juego en el que está. Si ese clan no está en Anvil, el enlace abre una página simple que lista a los jugadores de Anvil que están en él y eligieron mostrarlo. No es la lista de ese clan, y nada en ella convierte a nadie en miembro.',
        'Si es tu clan, **Bring your clan to Anvil** crea uno. Una vez que sea un clan público de Anvil, el enlace va directo a él.',
      ],
    },
  },
  guideLibrary: {
    metaTitle: 'Guías del juego: leer, proponer y copias de clan — Anvil',
    metaDescription: 'La biblioteca de guías de Anvil: guías de raids, jefes, skilling y dinero en la web, en el juego y en Discord. Leer por nivel, proponer una guía nueva o una edición, y cómo un clan copia y edita las guías de la biblioteca.',
    eyebrow: 'Anvil · para jugadores y staff de clan',
    title: 'Guías del juego',
    dek: 'Además de estas páginas de cómo hacer las cosas, Anvil guarda una biblioteca de guías del juego: raids, jefes, skilling y formas de ganar dinero. Cualquiera puede leerlas, cualquiera con sesión puede sugerir una, y un clan puede guardar sus propias copias.',
    facts: [
      {
        strong: 'Tres niveles',
        rest: 'Beginner, Intermediate, Advanced',
      },
      {
        strong: 'Cualquiera puede proponer',
        rest: 'el staff revisa todas',
      },
      {
        strong: '/guide',
        rest: 'publica una en Discord',
      },
    ],
    footnote: 'Los comandos de barra están en [Comandos de barra]({commandsGuide}).',
    read: {
      title: 'Leer una guía',
      body: [
        'Abre la pestaña **In-game guides** en la página de guías, o [/guides](/guides) en la web de tu clan. La lista de un clan tiene sus propias guías más las de la biblioteca que no ha copiado.',
        'Muchas guías tienen un interruptor de nivel arriba: **Beginner**, **Intermediate** y **Advanced**. Las partes de otros niveles se pliegan, así que alguien que empieza y un speedrunner leen la misma página.',
        'En Discord, `/guide` y el inicio de un nombre publican la tarjeta de una guía con un enlace a la página completa.',
      ],
    },
    propose: {
      title: 'Sugerir una guía o una edición',
      body: [
        'Con sesión iniciada, abre [Propose a guide](/guides/propose) para escribir una nueva, o sugerir una edición de una guía de la biblioteca. Dile al revisor qué cambiaste y por qué; puedes mostrar tus cambios frente a la guía actual antes de enviarla.',
        'Pulsa **Send for review**. [My guide proposals](/guides/proposals) muestra cada una como **pending**, **approved**, **rejected** o **withdrawn**, con la nota del revisor una vez respondida. Mientras está pendiente puedes editarla o **Withdraw** la propuesta. Puedes tener 5 en espera a la vez.',
        'Nada se publica hasta que los editores de guías de Anvil lo aprueben. Una edición aprobada también actualiza cada copia del clan que no se haya cambiado.',
      ],
    },
    clan: {
      title: 'Las guías de tu clan',
      intro: 'Los admins, y los moderadores autorizados a escribir guías, las gestionan en **Guides** en el menú de admin.',
      rows: [
        {
          term: 'Mostrar las guías de la biblioteca en nuestra web',
          body: 'activado: las guías de la biblioteca que no has copiado también aparecen en tu página Guides, siempre al día.',
        },
        {
          term: 'Copiar a nuestras guías',
          body: 'crea una copia del clan. **Sigue la biblioteca** hasta que la edites, recibiendo cada cambio de la biblioteca.',
        },
        {
          term: 'Editar una copia',
          body: 'la convierte en **customised**, propia del clan. Cuando la guía de la biblioteca cambie después, muestra **update available**: acepta la versión nueva o conserva la tuya.',
        },
        {
          term: 'Guía nueva',
          body: 'escribe una que solo tiene tu clan, como las reglas de tu propio raid o una guía de masivo.',
        },
      ],
      note: {
        tag: 'Publicarlas',
        body: 'Las guías se pueden publicar en un canal de Discord, y esas publicaciones se editan en el sitio cuando cambia la guía.',
      },
    },
  },
};

export default es;
