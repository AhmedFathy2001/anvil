import type { PartialGuideDict } from './en';

// Español — Spanish.
//
// Misma convención que en los demás archivos de idioma: todo lo que el lector VE REALMENTE en su
// pantalla se queda en inglés — los menús de RuneLite y OBS, las líneas de chat del propio plugin,
// y las etiquetas del panel de administración de Anvil, que están en inglés hasta que también se
// traduzca esa superficie. Un «Tracked drop detected» traducido es una línea que nadie vuelve a
// encontrar. Todo lo demás — la explicación, el orden, el porqué — está en español.

const es: PartialGuideDict = {
  common: {
    contents: 'Contenido',
    step: 'Paso',
    optional: 'opcional',
    minRead: '{n} min de lectura',
    language: 'Idioma',
    partialNotice:
      'Esta guía solo está traducida parcialmente al {language}. Lo que aún no está traducido aparece en inglés.',
    backToGuides: 'Todas las guías',
    unreviewedNotice:
      'Ningún hablante nativo ha revisado todavía esta traducción al {language}. Si una frase suena mal, [la página en inglés]({englishHref}) es el original — y [avisarnos](/feedback) es lo que la arregla.',
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
    },
    cards: {
      discord: {
        eyebrow: 'Para quien lleva el servidor',
        title: 'Anvil en Discord',
        blurb: 'Una invitación, luego los canales donde publica cada flujo, roles, comandos slash, y qué comprobar cuando se para.',
        minutes: '~5 min',
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
          'Instala el plugin, conéctalo a este sitio, y deja que envíe tus drops. También cubre las notificaciones de Discord y los clips de OBS.',
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
    footnote: 'Todo esto se puede cambiar luego desde Admin → Clan, salvo la dirección — esa merece un momento de reflexión ahora.',
    before: {
      title: 'Antes de empezar',
      body: [
        'Necesitas una cuenta de Discord, y esa es toda la lista. Inicia sesión primero en `{apex}`: un clan necesita un propietario, y el inicio de sesión es como el sitio sabe que eres tú. Empieza desde **Crear un clan** en las páginas de la plataforma, o ve directo a `{apex}/clans/new`.',
        'No cuesta nada. No hay plan que elegir, ni tarjeta que introducir, ni prueba que caduque y se lleve tu tablero — un clan empieza gratis y sigue siendo usable.',
      ],
      note: {
        tag: 'Serás su propietario',
        body: 'Propietario es el único rol que nadie puede quitarte, y va a quien crea el clan. Añade staff después desde Admin → Clan; ver [En el turno]({moderatorGuide}).',
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
      intro: 'Cuatro cosas separan un clan recién creado de un evento en marcha. El asistente las recorre en orden y salta lo que ya hayas hecho.',
      steps: [
        {
          term: 'Ponle nombre en Discord',
          body: 'Tu nombre visible, tu nombre de clan en el juego y un enlace de invitación a tu servidor. La invitación es lo que permite que las páginas de inscripción y las guías dirijan gente hacia ti.',
        },
        {
          term: 'Conectar Discord',
          body: 'Un bot compartido, así que no hay aplicación que registrar ni token que pegar. Apruébalo una vez y podrá publicar en tus canales y leer tus roles.',
        },
        {
          term: 'Dale un canal',
          body: 'Un canal de anuncios para las publicaciones de evento. Opcionalmente separa los flujos del plugin: drops raros en un canal, muertes en otro, para que ninguno ahogue al otro.',
        },
        {
          term: 'Haz un tablero',
          body: 'El primer evento. Elige un formato, añade casillas, abre inscripciones — eso es [Organizar tu primer evento]({adminGuide}), y con diferencia la más larga de las cuatro.',
        },
      ],
      after: [
        'Puedes saltarte el asistente por completo y hacerlo todo luego desde Admin → Clan. Existe porque el orden importa cuando nunca lo has hecho: Discord antes que los canales, los canales antes que un tablero que quiere publicar en ellos.',
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
          term: 'Simplemente juegan',
          body: 'Cualquiera que inicie sesión con el plugin activo se reconoce automáticamente. Si aún no está en la lista, se le sigue como **invitado** — visible, contable, y a una sincronización de ser miembro.',
        },
        {
          term: 'A mano',
          body: 'Admin → Clan acepta nombres de uno en uno, para quien juega en móvil o en el cliente oficial y no puede usar el plugin en absoluto.',
        },
      ],
      note: {
        tag: 'Los invitados no son un problema que resolver',
        body: 'Un invitado es simplemente alguien a quien hemos visto y que no está en tu lista — un jugador de un clan visitante, un alt, alguien que entró esta mañana. Pueden participar en eventos sin llegar a ser miembros nunca.',
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
    footnote: 'Todo esto vive en Admin → Ajustes, repartido entre las pestañas Bot de Discord, Webhooks, Roles y canales, y Notificaciones.',
    bot: {
      title: 'Un bot, ya construido',
      body: [
        'No hay aplicación de Discord que crear, ni token que generar, ni secreto que pegar. Anvil ejecuta un bot que comparten todos los clanes, así que conectarlo es una invitación y nada más.',
        'Aun así puedes traer el tuyo — pega un token en **Bot de Discord** y se usará en su lugar. Solo merece la pena si quieres que el bot lleve el nombre y el avatar de tu clan en la lista de miembros; todo lo de esta guía funciona igual de cualquier modo.',
      ],
      permissions: [
        {
          term: 'Ver canales, enviar mensajes, insertar enlaces, adjuntar archivos',
          body: 'Lo básico. Sin esto está en tu servidor y callado.',
        },
        {
          term: 'Gestionar webhooks',
          body: 'Para que el botón **Crear** de la pestaña Webhooks pueda hacer uno por ti, en vez de que copies URLs de Discord a mano.',
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
          body: 'Solo para canales privados por equipo durante un draft. Sáltatelo y todo lo demás sigue funcionando.',
        },
      ],
      note: {
        tag: 'Pide los cinco de una vez',
        body: 'Discord no tiene forma de pedir un permiso más tarde, así que el enlace de invitación solicita el conjunto completo, y las funciones que nunca actives nunca usan el suyo. Volver a abrir el enlace de invitación es también cómo se repara un permiso que alguien quitó.',
      },
    },
    connect: {
      title: 'Conectarlo',
      intro: 'Dos cosas, en este orden. El bot tiene que estar en tu servidor, y Anvil tiene que saber cuál es el tuyo.',
      steps: [
        {
          term: 'Invita al bot',
          body: 'Admin → Ajustes → **Bot de Discord** → **Invitar / reinvitar al bot**. El enlace preselecciona tu servidor una vez puesto el ID, así que no puedes añadirlo al equivocado por accidente.',
        },
        {
          term: 'Pon el ID del servidor',
          body: 'Clic derecho en el icono de tu servidor en Discord → **Copiar ID del servidor** (requiere el modo desarrollador, en los ajustes avanzados de Discord) y pégalo. Este campo es lo que hace la conexión específicamente tuya.',
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
      title: 'Dónde se publica cada cosa',
      body: [
        'Anvil publica mediante **webhooks**, uno por canal, y todos son opcionales. No se publica nada en ninguna parte hasta que apuntas un flujo a un canal — un clan recién creado está en silencio a propósito, no por accidente.',
        'La pestaña Webhooks puede crearlos por ti: elige un canal, pulsa **Crear**, y el bot fabrica el webhook con su permiso. Pegar una URL que hayas hecho tú en Discord funciona igual.',
      ],
      feeds: [
        {
          term: 'Anuncios',
          body: 'El principal. Inicios y finales de evento, apertura de inscripciones, clasificaciones, resultados semanales. Pon este y nada más y ya tienes un clan funcionando.',
        },
        {
          term: 'Predeterminado del plugin',
          body: 'Adonde va todo lo que viene del juego y no tiene canal propio. Ponlo en segundo lugar.',
        },
        {
          term: 'Los flujos separados',
          body: 'Drops raros, mascotas, muertes, collection log, combat achievements, niveles, quests, diaries, clips, kills de PvP y Leagues llevan cada uno su canal. Esa separación es la diferencia entre un flujo que la gente lee y uno que silencia.',
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
        'Dos sincronizaciones, ambas apagadas hasta que las actives, y ambas guiadas por la lista de miembros y no por lo que alguien escriba en Discord.',
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
        body: 'Discord no deja que ningún bot toque un rol al mismo nivel o por encima del suyo, y lo rechaza en silencio desde tu lado — la sincronización simplemente no hace nada. Sube el rol de Anvil en Ajustes del servidor → Roles y empieza a funcionar; no hay que reinvitar nada.',
      },
    },
    commands: {
      title: 'Comandos slash',
      body: [
        'El bot responde a `/bingo` en tu servidor: **board**, **rules**, **leaderboard**, **me** y **team**. Leen el evento en curso, así que nadie tiene que salir de Discord para ver cómo va.',
        'Aparecen alrededor de un minuto después de que el bot entre. Si no aparecen nunca, la invitación concedió el bot pero no sus comandos — son dos permisos separados, y un enlace de invitación antiguo solo pedía uno. Vuelve a abrir el enlace desde la pestaña Bot de Discord; no expulsa al bot ni reinicia nada.',
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
    quiet: {
      title: 'Cuando se queda en silencio',
      body: [
        'En orden, porque cada punto descarta el siguiente:',
      ],
      checks: [
        {
          term: '¿Está el bot realmente en el servidor?',
          body: 'La pestaña Bot de Discord lo dice directamente. «Token válido» y «en tu servidor» son hechos distintos y el primero no implica el segundo — con un bot compartido el token siempre es válido.',
        },
        {
          term: '¿Es correcto el ID del servidor?',
          body: 'Un ID equivocado pero real se ve exactamente igual que uno correcto, hasta que notas que las publicaciones van a otra parte.',
        },
        {
          term: '¿Sigue existiendo el webhook?',
          body: 'Borrar un canal de Discord borra su webhook, y Anvil se queda con la URL muerta. Vuelve a crearlo en la pestaña Webhooks.',
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
      'Instala el plugin de RuneLite de Anvil, conéctalo a este sitio, y configura las notificaciones de Discord y los clips de OBS.',
    eyebrow: 'Anvil · plugin de RuneLite',
    title: 'Guía de configuración para jugadores',
    dek: 'Instálalo, apúntalo a {clanName}, y juega. El plugin envía tus drops del bingo, publica tus drops raros y tus muertes en Discord y — si usas OBS — guarda y publica clips de los momentos que merece la pena volver a ver.',
    facts: [
      { strong: '2 campos', rest: 'y el registro está en marcha' },
      { strong: '~3 min', rest: 'para la configuración básica' },
      { strong: 'Los clips', rest: 'necesitan OBS + 5 minutos más' },
    ],
    footnote:
      'Las capturas son de una instalación real — el token de cuenta, la dirección de OBS y el webhook de Discord están tapados a propósito. Los tuyos deberían seguir siendo igual de privados.',

    install: {
      title: 'Instala el plugin',
      body: [
        'En RuneLite: **Configuration** (la llave inglesa) → **Plugin Hub** → busca **Anvil** → **Install**. El editor es `AhmedFathy2001`.',
        'Un único plugin sirve a todos los clanes — lo apuntas a este sitio en el siguiente paso, así que no hay nada específico del clan que descargar. Una vez instalado, abre **Configuration → Anvil** para llegar al panel de ajustes que se usa a lo largo de toda esta guía.',
      ],
    },

    connect: {
      title: 'Conectar con este sitio',
      intro: 'Para empezar solo importa la sección **Setup**. Todo lo demás tiene valores por defecto razonables.',
      figure: {
        caption: 'Configuration → Anvil → Setup',
        alt: 'La sección Setup del plugin de Anvil, con los campos Site URL y Account Token recuadrados',
        legend: [
          {
            label: 'Site URL',
            body: 'para {clanName} es `{origin}`. El campo llega vacío, así que hay que rellenarlo. No hace falta barra final, y `https://` se añade si lo omites.',
          },
          {
            label: 'Account Token',
            body: 'tu llave personal a este sitio. O dejas que el plugin lo rellene por ti (más abajo), o lo pegas tú. Trátalo como una contraseña.',
          },
        ],
      },
      easyHeading: 'La vía fácil: inicia sesión desde el plugin',
      easyIntro:
        'Con la Site URL puesta y el token todavía vacío, el **panel lateral de Anvil** muestra un botón **Sign in with Discord**. Púlsalo y el plugin te guía — sin copiar nada.',
      easySteps: [
        'El panel muestra un código y abre tu navegador en este sitio.',
        'Comprueba que el código de la página coincide con el de RuneLite, y pulsa **Approve**.',
        'El panel dice _Signed in_ y rellena el Account Token por ti.',
      ],
      linkFigure: {
        caption: 'Este sitio → /link-device',
        alt: 'La página Link your RuneLite client, con el campo del código y el botón Approve recuadrados',
        legend: [
          { label: 'El código', body: 'tiene que coincidir con lo que el plugin te está mostrando ahora mismo.' },
          {
            label: 'Approve',
            body: 'aprueba solo un código que muestre _tu propio_ cliente. Si alguien te ha mandado un enlace o un código, recházalo — aprobarlo sería entregarle tu cuenta.',
          },
        ],
      },
      brokeredNote: {
        tag: 'Por qué aparece un segundo dominio',
        body: [
          'La aprobación ocurre aquí, en `{origin}`. Si aún no has iniciado sesión en el sitio, el paso de inicio de sesión pasa por el acceso compartido de Discord de Anvil en `anvilosrs.com` para confirmar tu identidad de Discord, y luego te devuelve directamente aquí — es el mismo acceso que te da el botón Login de este sitio, no una parte del flujo del plugin.',
          'El plugin en sí solo habla con `{origin}`: se niega a abrir cualquier página de inicio de sesión que no esté en la Site URL que escribiste.',
        ],
      },
      directNote: {
        tag: 'Dónde ocurre esto',
        body: [
          'Todo el flujo se queda en `{origin}` — el código se emite aquí, se aprueba aquí con el propio acceso de Discord de {clanName}, y el token se entrega aquí. El plugin se niega a abrir cualquier página de inicio de sesión que no esté en la Site URL que escribiste, así que nada de este paso llega a otra instalación de Anvil.',
        ],
      },
      federationAside:
        'No lo confundas con **Connect clans** del panel lateral — ese es el botón aparte y opcional que te conecta con otros clanes de Anvil, y solo aparece cuando ya has iniciado sesión aquí.',
      manualFallback:
        'Si el navegador no se abre solo, el panel imprime la dirección y el código para que lo abras a mano. Los códigos caducan a los diez minutos — simplemente vuelve a pulsar el botón.',
      manualHeading: 'La vía manual: copia tu token',
      manualIntro:
        'Inicia sesión con Discord y abre [Profile](/profile), luego baja hasta la tarjeta **RuneLite plugin**.',
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
            body: 'cópialo al campo Account Token del plugin. Rotate emite uno nuevo y mata el antiguo — úsalo si alguna vez sospechas que tu token se ha filtrado.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Conviene saberlo',
        body: ['Un solo token cubre todos los eventos en los que estás inscrito aquí — nunca lo vuelves a pegar por cada bingo.'],
      },
    },

    accounts: {
      title: 'Vincula tus cuentas — solo juega',
      body: [
        'No hay ningún código de vinculación que teclear. Una vez puesto el token, la cuenta con la que inicies sesión se asocia automáticamente a tu perfil.',
        'El plugin envía tu nombre en el juego más una huella de cuenta estable en cada petición, y el sitio compara primero esa huella — así que tus vinculaciones sobreviven a un cambio de nombre. Entra una vez con una cuenta secundaria y aparecerá en tu perfil bajo _Accounts we noticed you playing_ con un **Add** de un clic.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'La tarjeta RuneScape Accounts en la página de perfil, listando las cuentas verificadas mediante el plugin',
        legend: [
          {
            label: 'Tus cuentas vinculadas',
            body: 'todo lo que lleva «Verified via plugin» llegó ahí simplemente por jugarlo. Añade tantas cuentas secundarias como quieras; una de ellas es tu principal.',
          },
        ],
      },
      noPluginHeading: '¿No puedes usar el plugin?',
      noPluginIntro:
        'En móvil o en el cliente oficial, vincula la cuenta desde la web — la página de perfil muestra las dos opciones:',
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
        'También deberías ver el **panel lateral de Anvil** llenarse con tus clanes, tus eventos en curso, tu puesto y los botones de sincronización — y aparecer un botón **Anvil** en la barra de título de tu Collection Log dentro del juego, junto a WikiSync y RuneProfile.',
      guestNote: {
        tag: 'Invitado o miembro',
        body: 'Si el chat dice _Tracked as a guest_, se te está registrando pero aún no estás en la lista de miembros del clan. Un admin lo arregla sincronizando la lista desde el juego — pregunta {discordLink}.',
        discordWord: 'en Discord',
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
            label: 'Auto Submit Drops',
            body: 'hace una captura y envía un drop registrado en el momento en que cae. Déjalo activado; es de lo que va todo esto.',
          },
          {
            label: 'Show Overlay',
            body: 'dibuja un pequeño panel de _Anvil / equipo / fecha UTC_ arriba a la izquierda. Pasa a formar parte de la imagen en tus capturas de prueba, y es justo eso lo que hace difícil falsificar o antedatar una prueba. En esta captura está apagado — actívalo si tu clan quiere ver el equipo y la hora en cada prueba.',
          },
          {
            label: 'Team completion popups',
            body: 'un cartel cuando alguien de tu equipo completa una casilla. Varias a la vez: la más difícil se lleva el cartel, el resto va al chat.',
          },
          {
            label: 'Distinct mission sound',
            body: 'le da su propio sonido a una misión que aparece — y a alguien reclamándola — para que la distingas de una casilla normal sin mirar.',
          },
          {
            label: 'Banner sound + volume',
            body: 'reproduce un sonido con el banner. No suena nada hasta que añadas al menos un .wav tú mismo, con **Add clip** bajo “Banner sounds” en el panel lateral de Anvil.',
          },
          {
            label: 'Two-frame drop proof',
            body: 'incrusta un segundo fotograma en la captura un par de segundos después, cuando el loot ya se ha posado en el suelo. Déjalo activado; te ahorra discusiones.',
          },
        ],
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
        'Estas se envían haya bingo en marcha o no, y se publican en los canales del clan. En qué canal lo deciden aquí los administradores — tú solo eliges _qué_ publicas.',
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
            body: 'dos rutas independientes hacia una publicación: valer al menos tanto (GE o high alch, lo que sea mayor), o ser más raro que 1 entre N (1/10.000 por defecto — ajustes más laxos llenan el canal de tiradas de hierbas). Tu clan puede fijar un umbral de rareza que valga para todos; el tuyo sigue aplicándose cuando es más estricto. Pon cualquiera de los dos a 0 para apagar esa ruta.',
          },
          { label: 'Screenshot rare drops', body: 'adjuntar la imagen, no solo el texto.' },
          {
            label: 'Loot key value',
            body: 'una loot key se publica una vez, como una sola notificación, cuando todo su contenido supera esta cifra.',
          },
          { label: 'Notify on pets + Screenshot pets', body: 'las mascotas van al canal de drops raros.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · levels · diaries · quests',
        alt: 'La sección de notificación Combat achievements, con cada ajuste recuadrado y numerado',
        legend: [
          { label: 'Notify on combat achievements', body: 'los niveles completados se publican siempre mientras esto esté activado.' },
          {
            label: 'CA task min tier',
            body: 'cuánto ruido hacen las tareas sueltas. Aquí Elite; por defecto es Master. Ponlo en Grandmaster para dejar solo las más raras.',
          },
          {
            label: 'Notify on 99s & high totals',
            body: 'los 99, cada 100 niveles totales desde 1800 en adelante, y el máximo.',
          },
          { label: 'Notify on diary completions', body: 'niveles de achievement diary.' },
          {
            label: 'Announce quest completions',
            body: 'desde la dificultad que elijas hacia arriba. Aquí «All quests»; por defecto es Master en adelante.',
          },
        ],
      },
    },

    clips: {
      title: 'Clips con OBS',
      intro: [
        'Pulsas una tecla y los últimos 30 segundos se guardan y caen en el canal de clips del clan. Está desactivado por defecto y necesita OBS en marcha — pero es lo más parecido a un vídeo de mejores momentos que va a tener tu clan.',
        'Cómo funciona: OBS mantiene un **replay buffer** continuo de los últimos X segundos. Tu atajo le dice a OBS que vuelque ese búfer a un archivo, y el plugin recoge el archivo y lo sube a un webhook de Discord que tú pegas.',
      ],
      privacyNote: {
        tag: 'Adónde va tu vídeo',
        body: 'Los clips se suben **directamente de tu PC a Discord**. Nunca pasan por este sitio, y no se sube absolutamente nada si dejas el campo del webhook vacío — los clips se quedan en tu máquina.',
      },
      obsHeading: 'A. Configura OBS (una vez)',
      obsSteps: [
        'Necesitas **OBS Studio 28 o más nuevo** — el servidor WebSocket viene integrado desde la 28, sin descargas extra.',
        'Asegúrate de que OBS está capturando el juego de verdad: una fuente Game / Window / Display Capture que muestre RuneLite. Si OBS no ve tu cliente, tus clips serán un rectángulo negro.',
        '**Settings → Output** → marca **Enable Replay Buffer**. (En modo Simple output está en la página Recording; en Advanced tiene su propia pestaña.) Aprovecha para comprobar que hay espacio en tu ruta de grabación.',
        '**Tools → WebSocket Server Settings** → marca **Enable WebSocket server**. Apunta el **Server Port** (4455 por defecto) y pulsa **Show Connect Info** para la contraseña.',
      ],
      obsAside:
        '_No_ necesitas pulsar «Start Replay Buffer» — el plugin lo arranca por ti al conectarse, y lo reinicia cada vez que cambias la duración del clip.',
      fillHeading: 'B. Rellena el plugin',
      figure: {
        caption: 'Configuration → Anvil → Clips',
        alt: 'La sección Clips de los ajustes del plugin, con cada ajuste recuadrado y numerado; el host de OBS y la URL del webhook están ocultos',
        legend: [
          { label: 'Enable clip capture', body: 'el interruptor principal. Apagado, el plugin no habla con OBS en absoluto.' },
          {
            label: 'Capture clip hotkey',
            body: 'configúralo o no pasará nunca nada. Elige algo que no vayas a pulsar sin querer en mitad de una raid.',
          },
          {
            label: 'OBS host / port / password',
            body: '`localhost` cuando OBS corre en el mismo PC que RuneLite. Si OBS está en otra máquina, pon aquí la IP local de esa máquina — oculta en esta captura — y abre el puerto en su cortafuegos. El puerto y la contraseña salen de _Show Connect Info_; deja la contraseña vacía si desactivaste la autenticación de OBS.',
          },
          {
            label: 'Max auto-post size (MB)',
            body: 'todo lo que pase de ahí se guarda en local y se menciona discretamente en el chat en vez de publicarse. Ajústalo a lo que tu servidor de Discord acepte de verdad; el plugin viene en 25.',
          },
          {
            label: 'Clip length (seconds)',
            body: 'cuánto hacia atrás alcanza cada clip. Esto escribe la duración del búfer en tu perfil de OBS, así que OBS necesita esos segundos de margen antes de que exista siquiera un clip de duración completa. Clips más largos = archivos más grandes; 30 es un buen término medio.',
          },
          {
            label: 'Save clips as MP4',
            body: 'el MP4 se previsualiza y reproduce dentro de Discord; el MKV hay que descargarlo antes. Ojo: esto cambia el formato de grabación de OBS, lo que afecta también a tus grabaciones normales. Desactívalo para dejar OBS en paz.',
          },
          {
            label: 'Clips Discord webhook URL',
            body: 'dónde se publican los clips — pide a un admin el webhook del canal de clips. Vacío = los clips se quedan en tu PC. Aquí está oculto, y con razón: cualquiera con esta URL puede publicar en ese canal.',
          },
          {
            label: 'Post OBS-triggered clips too',
            body: 'también gestiona los guardados que dispara el propio OBS o el plugin «Save Replay Buffer for OBS». Déjalo apagado si usas dos clientes de RuneLite contra un solo OBS, o cada clip se publicará dos veces.',
          },
        ],
      },
      useHeading: 'C. Úsalo',
      useIntro: 'Pasa algo gracioso → pulsa tu atajo → el chat te guía:',
      useChat: [
        { text: 'Saving clip...', tone: 'plain' },
        { text: 'Uploading clip to the clan Discord...', tone: 'plain' },
        { text: 'Clip posted to the clan Discord.', tone: 'green' },
      ],
      reminder: {
        tag: 'Recuerda',
        body: 'El clip cubre los segundos _anteriores_ a pulsar la tecla — así que púlsala después del momento, no durante. Tienes toda la duración del búfer para reaccionar.',
      },
      decodedHeading: 'Mensajes de clips, descifrados',
      decoded: [
        {
          term: '`Clip capture: OBS isn’t connected.`',
          body: 'OBS no está en marcha, el servidor WebSocket está apagado, o el host/puerto/contraseña no coinciden. Arréglalo y vuelve a pulsar — el plugin reintenta la conexión por su cuenta cada 30 segundos.',
        },
        {
          term: '`OBS could not save the clip — is the Replay Buffer started?`',
          body: 'El búfer no está corriendo. Comprueba Enable Replay Buffer en los ajustes de salida de OBS, y luego apaga y vuelve a encender Enable clip capture.',
        },
        {
          term: '`Clip saved locally — paste a Clips Discord webhook URL…`',
          body: 'Funciona como debe, simplemente no tienes webhook configurado. El archivo está en tu carpeta de grabación de OBS.',
        },
        {
          term: '`Clip saved locally (48MB) — too big to auto-post.`',
          body: 'Acorta la duración del clip, baja la calidad de tu grabación de OBS, o sube el tamaño máximo si tu servidor acepta archivos más grandes.',
        },
        {
          term: '`…but Discord didn’t accept the upload.`',
          body: 'Demasiado grande, limitado por tasa, o la subida agotó el tiempo. El archivo sigue en tu PC — publícalo a mano si merece la pena.',
        },
      ],
    },

    trouble: {
      title: 'Cuando algo se rompe',
      intro:
        'El plugin te avisa por chat cuando el registro se ha parado — espera unos 90 segundos antes de quejarse y se repite como mucho cada 5 minutos.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'El token es incorrecto o se ha rotado. Vuelve a copiarlo desde [Profile → RuneLite plugin](/profile#plugin-token), o vacía el campo e inicia sesión de nuevo desde el plugin.',
        },
        {
          term: '`Anvil: can’t reach the site — tracking is OFF.`',
          body: 'Revisa la Site URL por si hay erratas — debería ser `{origin}`. Si está bien, el sitio probablemente esté caído.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Esa cuenta aún no está vinculada. Añádela desde Profile → «Accounts we noticed you playing».',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Nada. Se ha recuperado solo.',
        },
      ],
      logHeading: '¿Sigues atascado? Manda un registro a un admin',
      logBody:
        'Escribe `::anvillog` en el chat del juego (o configura **Export debug log hotkey** en la sección Support del plugin). Escribe un archivo de registro en tu carpeta `.runelite/anvil-debug`, abre la carpeta, y copia la ruta al portapapeles — envía ese archivo a un admin y verá exactamente qué falló.',
      missingNote: {
        tag: '¿Faltan pruebas?',
        body: 'Las mascotas y los Champion’s scrolls repetidos necesitan una captura manual. El plugin la hace por ti y la guarda en `.runelite/osrs-bingo-pending/` — **Copy folder path** en el panel lateral de Anvil abre la carpeta — así la adjuntas en la web en vez de buscar una imagen después.',
      },
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
      { strong: '4 pasos', rest: 'en el asistente de configuración' },
      { strong: '7 formatos', rest: 'para montar un tablero' },
      { strong: '1 botón', rest: 'para sincronizar la lista de miembros' },
    ],
    footnote:
      'Esta guía sigue la aplicación tal y como está hoy. Si una pantalla de aquí no cuadra con lo que tienes delante, la aplicación tiene razón y la guía está desfasada — [dínoslo](/feedback) y la arreglamos.',

    access: {
      title: 'Quién puede hacer qué',
      intro:
        'Todo el mundo entra con Discord — no hay contraseñas. El primer admin sale de la configuración del servidor; a partir de ahí, un admin asciende a los demás desde **Clan → Members & staff**. Los roles se apilan hacia abajo: todo lo que puede un moderador lo pueden también un tesorero y un admin.',
      rows: [
        {
          term: 'Admin',
          body: 'acceso completo — eventos, casillas, equipos, ajustes, equipo, pagos. Dáselo a tan poca gente como el clan pueda soportar.',
        },
        { term: 'Treasurer', body: 'todo lo que puede un moderador, más las cuotas de inscripción y los pagos.' },
        {
          term: 'Moderator',
          body: 'el día a día: lista de miembros, verificaciones, competiciones semanales, calendario, comentarios. No puede crear ni editar eventos.',
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
        '**System → Setup** es un asistente de cuatro pasos, y el panel mantiene esos mismos cuatro como lista de tareas hasta que estén hechos: nombrar el clan, conectar Discord, crear un evento, añadir casillas. El estado se calcula con datos reales, así que un paso solo se marca cuando está genuinamente terminado.',
      discord:
        'Para Discord tienes dos vías, y se combinan: dale a Anvil un **bot** y podrá crear webhooks, sincronizar roles y apodos, y montar canales privados de equipo; dale una sola **URL de webhook** y podrá publicar anuncios y nada más. Empieza por el webhook si quieres estar en marcha en dos minutos, y añade el bot cuando quieras la automatización.',
      permsNote: {
        tag: 'Permisos del bot',
        body: 'El bot necesita _Manage Webhooks_, _Manage Roles_, _Manage Channels_ y _Manage Nicknames_, y su rol debe estar _por encima_ de los roles que gestiona en la lista de roles de tu servidor. Si no, Discord se niega en silencio.',
      },
      hosted:
        'En un plan alojado ya viste esa pantalla una vez: añadir el bot durante la configuración fue como Anvil supo qué servidor es el vuestro, así que nunca hubo un ID de servidor que copiar. El mismo enlace está aquí cuando quieras mover el bot a otro servidor.',
    },

    channels: {
      title: 'Reparte las publicaciones entre canales',
      body: [
        'Por defecto todo va a un único canal principal de anuncios. Cuando se vuelva ruidoso, abre **System → Advanced settings → Webhooks** y dale casa propia a las categorías escandalosas — eventos de bingo, competiciones semanales, drops raros, muertes, kills de PvP, combat achievements, clips. Todo lo que dejes vacío vuelve al canal principal, así que puedes separar una categoría cada vez.',
        'Con el bot conectado nunca tocas una URL de webhook: elige un canal del desplegable y pulsa **Create webhook**. En un evento cargado puedes añadir un segundo webhook al mismo canal — Anvil alterna entre ellos para que el límite de ritmo de Discord no se trague publicaciones.',
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
        'Cualquiera que vincule o verifique una cuenta en la web sin estar en esa lista es un **invitado** — registrado, visible, pero no miembro hasta que un admin lo ascienda o la siguiente sincronización lo recoja. Es deliberado: significa que nadie puede ascenderse a sí mismo a vuestro clan escribiendo un nombre.',
        'También puedes añadir a alguien a mano desde **Clan → Members & staff**, incluida su inscripción a un evento en su nombre cuando no pueda llegar al sitio.',
      ],
    },

    board: {
      title: 'Crea tu primer tablero',
      intro:
        '**Events → All events → New event**. Elige primero un formato — decide cómo puntúa el tablero y qué te va a pedir el resto del formulario.',
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
          blurb: 'Un recorrido ordenado — los equipos alcanzan las casillas en secuencia; gana quien llega más lejos.',
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
        'La pestaña **Tiles** del evento es donde un tablero se convierte en bingo. Cada casilla es un _tipo_ de tarea, y el tipo decide qué vigila el plugin: un drop, un contador de kills de jefe, XP de habilidad, un kill de PNJ, un tiempo a batir, un achievement diary, un Combat Achievement, un desbloqueo del collection log, un kill de PvP, una ganancia de objeto, o una run sin muertes. Las casillas manuales — las que una persona valida a partir de una captura — también son siempre una opción.',
        'Para un tablero completo, créalas en bloque: exporta la hoja, rellénala en una hoja de cálculo, e impórtala de vuelta. CSV y .xlsx van en los dos sentidos, y las filas siguen a las posiciones, así que puedes reescribir una cuadrícula entera de 25 casillas con un solo pegado.',
      ],
      rows: [
        {
          term: 'Niveles de dificultad',
          body: 'los valores en puntos se traducen a bandas con nombre (easy → elite). Edita las bandas en Advanced settings si tu clan clasifica de otra manera.',
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
        'La pestaña **Teams & Draft** se adapta al formato elegido: un formato sin equipos se la salta entera. Para un bingo por equipos normal creas los equipos, decides quién los capitanea, y o bien repartes tú a los jugadores o haces un draft en directo.',
        'Los capitanes eligen del grupo de inscritos en el orden que fijes, y cada capitán ve las respuestas que la gente dio en el formulario de inscripción — congeladas tal y como se enviaron, para que nadie retoque sus «horas por semana» después de ser elegido.',
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
          body: 'System → Announce publica un mensaje en vuestros canales a mitad de evento sin que escribas un webhook a mano.',
        },
      ],
      missionNote: {
        tag: 'Sorpresas a mitad de evento',
        body: 'Puedes soltar una **misión** sobre un bingo en marcha — una casilla de bonificación oculta que se anuncia cuando la disparas, y que opcionalmente pierde valor o caduca. Es la forma más barata de despertar un tablero el quinto día.',
      },
      startProofNote: {
        tag: 'Frenar el acaparamiento previo',
        body: [
          'Activa **Starting shot** (evento → Overview) y cada jugador tendrá que entregar una captura tomada después del arranque, en un lugar que Anvil sortea en el instante del inicio — para que nadie esté sentado sobre una semana de clues y cofres guardados en el minuto cero. El lugar se anuncia con el arranque; la palabra clave de cada jugador es personal, derivada del sorteo, y no existe hasta que el evento empieza, así que nadie puede prepararla de antemano.',
          'Fija los sitios en el mapa del mundo (el editor del conjunto tiene uno) y el plugin comprueba que los jugadores están realmente allí en vez de solo habérselo dicho. También puedes exigir una **sesión fresca** — 15 minutos por defecto: los hiscores solo se guardan al cerrar sesión, así que obligar a todos a volver a entrar justo antes de su foto es lo que hace honestos los totales de partida detrás de cada casilla de XP y KC.',
          'Los que usan el plugin pulsan un botón. Los demás escriben su palabra clave en el juego y suben la imagen en My Team. Tú eliges qué pasa con el crédito de quien no ha entregado: marcarlo para revisión (por defecto) o rechazarlo hasta que lo haga. Ese mismo panel Overview es la lista de revisión — las capturas del plugin con palabra clave verificada llegan ya aceptadas, así que en la práctica solo miras a los jugadores de móvil.',
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
          body: 'la pestaña Payouts del evento convierte el bote en una lista de quién recibe qué, marcada a medida que pagas.',
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
          body: 'quédate con el tablero que acabas de montar. El siguiente bingo empieza desde ahí en vez de desde una cuadrícula vacía.',
        },
      ],
      federation:
        'Con la federación activada, los miembros también pueden conectarse a otros clanes de Anvil desde el plugin — práctico para eventos entre clanes, y totalmente voluntario por miembro.',
      outro: 'Después dirige a tus miembros a [la guía de configuración para jugadores]({pluginGuide}) y empieza a planear el siguiente.',
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
        'Abre tu evento y ve a la pestaña **Teams & Draft**. Crea un equipo por cada clan invitado y ponle su nombre — el nombre es lo que ven sus jugadores en el formulario de inscripción, así que «Ironforge» gana a «Equipo 2».',
        '_No_ hace falta que hagas un draft. Los enlaces de invitación y un draft son alternativas: un draft reparte un grupo común de inscritos, un enlace sienta a la gente directamente. En un clan contra clan puro, la mayoría de anfitriones crean los equipos, reparten un enlace a cada uno, y nunca abren el draft.',
        'Después abre el equipo en sí — **Teams & Draft → el equipo** — porque ahí ocurren los dos pasos siguientes.',
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
        caption: 'Evento → Teams & Draft → el equipo → Team staff',
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
        caption: 'Evento → Teams & Draft → el equipo → Invite links',
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
        kill: { label: 'Contador de kills', blurb: 'N kills de un PNJ — incluso de los que los hiscores nunca contaron (gallinas, vacas). Detectado por el plugin.' },
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
          term: 'Un objetivo de KC de jefe',
          body: '**no** es una casilla kill. Las casillas kill vigilan muertes de PNJ mediante el plugin; un objetivo de KC es una cifra de los hiscores y necesita `trackedStat` + `statType=boss` + `statGoal`. Usa una casilla kill para lo que los Hiscores nunca contaron — vacas, gallinas, un mob de slayer concreto.',
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
        '**Download spreadsheet** en la pestaña **Tiles** del evento. Obtienes un .xlsx del tablero tal cual está, con desplegables, la lista de objetos y las instrucciones de columnas en hojas propias.',
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
        'En un tablero por puntos cada casilla lleva su propio valor, y esos valores se traducen a bandas de dificultad con nombre — easy a elite — que puedes editar en **Advanced settings** si tu clan clasifica de otro modo. La banda es lo que leen los jugadores; el número es lo que puntúa.',
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
      'El formato se fija al crear pero se puede cambiar después desde la pestaña Overview del evento; la política de revelación y los modificadores de puntos se pueden cambiar en cualquier momento antes de que se revelen las casillas afectadas.',

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
      'Las cuotas y los premios son terreno del tesorero. Un tesorero puede todo lo que puede un moderador, más esto; un moderador puede marcar una cuota como recaudada pero nunca cerrarla.',

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
        'Cuántas firmas exige una cuota es un ajuste del clan, de cero a cinco. El cero existe por una razón real: en un clan donde el tesorero _es_ el propietario, no hay nadie más que firme, y «34 cuotas esperando una segunda firma» se convierte en una cola que nunca se puede vaciar y en lo más ruidoso del panel para siempre. En cero, marcar una cuota como pagada **es** la firma.',
        'Ponlo en uno — el valor por defecto — si sois dos. Ponlo en cero si sinceramente no lo sois, y más alto solo si tu clan tiene tanto la gente como el motivo.',
      ],
    },

    pay: {
      title: 'Pagar',
      body: [
        'Cuando el evento termina, la pestaña **Payouts** del evento convierte el bote en una lista de personas. Genérala y obtienes una fila por beneficiario, no por equipo: el premio de un equipo ganador se reparte a partes iguales entre sus miembros, para que pagar sea una lista de nombres y cifras y no un problema de aritmética a medianoche.',
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
        'la lista de miembros: sincronizarla, añadir gente, ascender a un invitado',
        'las verificaciones de cuentas — el reto de XP y la revisión manual',
        'los envíos y las capturas de prueba',
        'las competiciones semanales y el calendario',
        'los comentarios de los miembros',
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
          body: 'el caso habitual, y no te pide nada. Jugar la cuenta con el plugin conectado la vincula automáticamente, y una huella de cuenta estable hace que el vínculo sobreviva a un cambio de nombre.',
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
        body: 'Verificar una cuenta dice «esta es realmente suya». No lo mete en el clan — la pertenencia al clan solo viene de una sincronización de la lista desde el juego o de un admin que lo añade a mano. Alguien verificado pero que no está en la lista es un **invitado**: registrado, visible, y no miembro. Es a propósito, y es lo que impide que nadie entre en tu clan escribiendo un nombre.',
      },
    },

    roster: {
      title: 'Mantener honesta la lista de miembros',
      body: [
        'La lista de miembros viene de un único sitio: un admin lanza una sincronización desde la lista del clan en el juego, con el botón **Anvil** de la barra de título de la ventana del clan (o **Sync roster** en el panel lateral del plugin). Todo lo demás — verificaciones, vínculos, inscripciones — cuelga de ahí.',
        'Así que el mantenimiento es pequeño pero real: lanza la sincronización después de cada ronda de reclutamiento, asciende a los invitados que realmente se han unido, y mira a la gente que el sitio ha marcado para revisión en vez de esperar a que se quejen.',
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
};

export default es;
