import type { PartialDiscordDict } from './en';

// Español — Spanish.
//
// Los nombres de los comandos se quedan en inglés: quien lee en español escribe igualmente
// `/bingo board`, y un nombre de comando traducido es un comando que nadie encuentra. Lo mismo vale
// para «Powered by Anvil». Todo lo demás — la explicación, el orden, el porqué — va en español.

const es: PartialDiscordDict = {
  common: {
    noTeams: '_Aún no hay equipos._',
    moreOnSite: '+{n} más en la web',
    more: '+{n} más',
    bonusLegend:
      '⚡ bonus de misión — se gana por encima del total del tablero, así que cuenta para la puntuación pero no para el porcentaje.',
    visitingClansOne: '🤝 {names} es un clan invitado — este tablero es compartido.',
    visitingClansMany: '🤝 {names} son clanes invitados — este tablero es compartido.',
    visitingPlayersOne: '🤝 1 jugador está de visita desde otro clan.',
    visitingPlayersMany: '🤝 {n} jugadores están de visita desde otros clanes.',
    phaseRunning: 'en curso',
    phaseUpcoming: 'sin empezar',
    phaseEnded: 'terminado',
    phaseDraft: 'borrador',
    contextVisitingTeamsOne: 'entre clanes · 1 equipo invitado',
    contextVisitingTeamsMany: 'entre clanes · {n} equipos invitados',
    contextVisitingPlayersOne: '1 jugador invitado',
    contextVisitingPlayersMany: '{n} jugadores invitados',
    shareButton: 'Compartir en el canal',
    sharedBy: '-# Compartido por {who}',
    fieldFormat: 'Formato',
    fieldTeams: 'Equipos',
    fieldPlayers: 'Jugadores',
    fieldTilesDone: 'Casillas hechas',
    fieldTeamScore: 'Puntos del equipo',
    fieldYourTiles: 'Tus casillas',
    fieldAccounts: 'Cuentas',
    fieldRank: 'Puesto',
    fieldRoster: 'Plantilla',
    fieldScore: 'Puntos',
  },

  board: {
    starts: 'Empieza {when}.',
    ends: 'Termina {when}.',
    finished: 'Este tablero ha terminado.',
    notScheduled: 'Aún sin programar.',
    hidden: 'Las casillas siguen ocultas — el tablero se abre cuando el staff lo revela.',
  },

  leaderboard: { title: '🏆 {event} — clasificación' },

  rules: {
    title: '📜 {event} — cómo funciona',
    houseTitle: '📌 {clan} — normas del clan',
    houseContinues: '**Las normas continúan** — léelas todas en',
    houseFull: 'Normas completas:',
    houseTrimmed: '-# Recortadas para caber en Discord — pide al staff el reglamento completo.',

    scoringPoints:
      '• **Puntuación** — cada casilla vale sus propios puntos; la puntuación de un equipo es la suma de lo que ha completado.',
    scoringTiles: '• **Puntuación** — un punto por casilla; la puntuación de un equipo es cuántas ha completado.',
    tileRace:
      '• **Carrera de casillas** — el tablero es un recorrido ordenado. Avanzáis por él; vuestra casilla más lejana es vuestra posición.',
    revealScheduled:
      '• **Aperturas** — las casillas se abren según un calendario fijado por el staff. Una casilla que aún no ves simplemente no se ha abierto.',
    revealIntervalOne: '• **Aperturas** — se sortea una casilla {order} cada {minutes} minutos.',
    revealIntervalMany: '• **Aperturas** — se sortean {n} casillas {order} cada {minutes} minutos.',
    revealOrderRandom: 'al azar',
    revealOrderBoard: 'en orden de tablero',
    revealBounty:
      '• **Recompensa** — hay exactamente una casilla abierta a la vez. El primer equipo que la completa la cierra, y se sortea la siguiente.',
    revealRotating:
      '• **Rotación** — {n} casillas permanecen abiertas a la vez; las más antiguas caducan según salen otras nuevas. Completadlas mientras están.',
    revealAll: '• **Aperturas** — todo el tablero está abierto desde el principio.',
    notRevealed:
      '• **Aún sin revelar** — el staff abre el tablero cuando arranca el evento. Antes nadie ve las casillas.',
    lockout: '• **Bloqueo** — el primer equipo que completa una casilla se la lleva. Nadie más puede puntuarla después.',
    firstBonus: '• **Bonus de primero** — el primer equipo en una casilla gana {amount} puntos extra.',
    decay:
      '• **Caída** — una casilla vale puntos completos al abrirse y baja al {pct}% en {hours} h. Completarla pronto da más.',
    growth:
      '• **Subida** — una casilla parte de su valor completo y sube al {pct}% en {hours} h. Esperar da más.',
    missions:
      '• **Misiones** — objetivos extra revelados durante el evento, {when}. Nadie ve una antes de que se anuncie.',
    missionWhenInterval: 'cada {minutes} minutos',
    missionWhenScheduled: 'según un calendario',
    missionWhenManual: 'cuando el staff las suelta',
    missionBonusNote:
      '-# Los puntos de misión son un **bonus** — se suman a tu puntuación pero nunca al total del tablero, así que el tablero no puede alargarse a mitad del evento.',
    missionAnnouncedCount: '{announced} de {total} anunciadas hasta ahora.',
    startProofStrict:
      '• **Foto de salida** — cada jugador entrega una captura tras el arranque, en un lugar sorteado en el momento de la salida. Hasta que entregues la tuya, se rechaza todo lo que envíes.',
    startProofFlag:
      '• **Foto de salida** — cada jugador entrega una captura tras el arranque, en un lugar sorteado en el momento de la salida. Hasta que entregues la tuya, todo lo que envíes queda marcado para revisión.',
    startProofSession:
      '-# Cierra sesión y vuelve a entrar primero — los hiscores solo se guardan al desconectar, así que tu foto debe estar dentro de los {minutes} minutos posteriores a un inicio de sesión fresco.',
    teamChoice: '• **Equipos** — eliges tu equipo al inscribirte; el staff lo aprueba.',
    captainInvites: '• **Equipos** — los capitanes reparten ellos mismos enlaces de invitación para su lado.',
    entryFee: '• **Cuota de inscripción** — {amount} por inscripción.',
    prizePool: '• **Bote** — {amount} y subiendo con cada inscripción aprobada.',

    trackingHeading: '**Cómo se te acredita**',
    trackingPlugin: '• **Con el plugin de Anvil** — envía por ti. No hay nada que hacer salvo jugar.',
    trackingHiscoresAll:
      '• **¿Sin plugin?** Cada casilla de aquí lee de los **hiscores oficiales**, así que no necesitan cliente alguno — pero los hiscores solo se guardan cuando **cierras sesión**, y se refrescan en punto. Juega → cierra sesión → espera a la hora.',
    trackingHiscoresSome:
      '• **¿Sin plugin?** {n} de estas casillas leen de los **hiscores oficiales**, así que no necesitan cliente alguno — pero los hiscores solo se guardan cuando **cierras sesión**, y se refrescan en punto. Juega → cierra sesión → espera a la hora.',
    trackingProofAll:
      '• **Drops, kills y retos cronometrados** necesitan prueba — aquí todas las casillas. El plugin la archiva solo; sin él, subes tú mismo una captura {where}.',
    trackingProofSome:
      '• **Drops, kills y retos cronometrados** necesitan prueba — {n} de estas. El plugin la archiva solo; sin él, subes tú mismo una captura {where}.',
    trackingWhereUrl: 'en **My Team**, en {url}/team',
    trackingWhereNoUrl: 'en la página My Team',
    trackingKeepShot:
      '-# Guarda igualmente tu propia captura de todo lo importante — no cuesta nada y zanja cualquier discusión.',
  },

  me: {
    title: '👤 {who} — {event}',
    notEnteredTitle: '🔍 No estás en este tablero',
    notEntered: 'No estás inscrito en **{event}**.',
    notEnteredWhere: 'Las inscripciones y tu perfil están en {url}.',
    onTeam: 'Estás en **{team}**.',
    onTeamRanked: 'Estás en **{team}** — {place} de {total}.',
    noTeamYet: 'Estás inscrito pero todavía no tienes equipo.',
    finishedHiddenOne: 'Has completado 1 casilla — los nombres aparecen cuando se revele el tablero.',
    finishedHiddenMany: 'Has completado {n} casillas — los nombres aparecen cuando se revele el tablero.',
    finishedHeading: '**Casillas que has completado**',
    nothingYet: 'Todavía no se te ha acreditado ninguna casilla.',
  },

  team: {
    noTeamsTitle: '🔍 Aún no hay equipos',
    noTeamsBody: '**{event}** todavía no tiene equipos.',
    noMatchTitle: '🔍 No existe ese equipo',
    noMatch: 'Ningún equipo de **{event}** coincide con «{needle}».',
    noneOfYours: 'No estás en ningún equipo — nombra uno para consultarlo.',
    teamsList: '**Equipos:** {names}',
    standing: '{place} de {total} — {score}{bonus} · {pct}% del tablero.',
    bonusSuffix: ' (⚡+{n} de bonus de misión)',
    visitingWholeTeam: '🤝 Un clan invitado: {names}',
    visitingSomeOne: '🤝 1 jugador invitado: {names}',
    visitingSomeMany: '🤝 {n} jugadores invitados: {names}',
    recentHeading: '**Últimas casillas**',
    hiddenBoard: 'Las casillas de **{event}** aún no están reveladas — las fichas de equipo se abren con el tablero.',
  },

  apply: {
    title: '📝 {event} — cómo entrar',
    drafted: '**Estás dentro** — ya elegido en el draft para un equipo. Solo queda jugar.',
    approved: '**Estás inscrito y aprobado.** Te colocarán en un equipo antes de que empiece el evento.',
    pending: '**Tu inscripción está dentro** y espera a que el staff la apruebe. Nada más que hacer.',
    open: '**Las inscripciones están abiertas.**',
    notOpenYet: '**Las inscripciones aún no han abierto.**',
    eventStarted: '**El evento ya ha empezado**, así que las inscripciones están cerradas. Pregunta al staff si aún queda sitio.',
    closed: '**Las inscripciones están cerradas.**',
    closesIn: 'Cierran {when}.',
    opensIn: 'Abren {when}.',
    fee: 'La entrada cuesta {amount} — el staff te dirá dónde enviarlo.',
    feePerAccount: 'La entrada cuesta {amount} por cuenta — el staff te dirá dónde enviarlo.',
    signUpAt: '**Inscríbete:** {url}',
    noAccountUrl:
      '-# Anvil aún no conoce tu cuenta. Vincula primero tu RSN en {url}/profile — las inscripciones cuelgan de una cuenta, no de un nombre de Discord.',
    noAccountNoUrl:
      '-# Anvil aún no conoce tu cuenta. Vincula primero tu RSN en tu página de perfil — las inscripciones cuelgan de una cuenta, no de un nombre de Discord.',
  },

  next: {
    title: '⏭️ {event} — qué viene ahora',
    eventStarts: '🚩 Empieza el evento',
    eventEnds: '🏁 Termina el evento',
    nextTile: '🎲 Próxima casilla sorteada',
    nextMission: '⚡ Próxima misión',
    signupsClose: '📝 Cierran las inscripciones',
    nothingEnded: 'Nada más en el reloj — este tablero ha terminado.',
    nothingScheduled: 'Nada programado. El staff suelta lo siguiente cuando lo suelta.',
    hiddenMissionsOne: '-# Queda 1 misión por venir, se anunciará cuando el staff la suelte.',
    hiddenMissionsMany: '-# Quedan {n} misiones por venir, se anunciarán cuando el staff las suelte.',
  },

  help: {
    title: '🔨 Esto es lo que Anvil puede contarte',
    privateNote:
      '-# Las respuestas solo las ves tú. Usa el botón **{share}** bajo una respuesta para publicarla en el canal.',
    subs: {
      board: 'El tablero que está en marcha ahora mismo',
      leaderboard: 'Clasificación de equipos',
      rules: 'Cómo funciona el tablero — puntuación, aperturas, pruebas y las normas del clan',
      apply: 'Cómo entrar — inscripciones, la cuota y cómo estás tú',
      next: 'Qué viene — la próxima apertura, misión o fecha límite',
      me: 'Tu equipo, tus casillas, tu puesto',
      help: 'Lo que Anvil puede contarte aquí dentro',
      team: 'La ficha de un equipo — puntos, plantilla, últimas casillas',
    },
    command: 'Anvil — consulta el tablero del clan',
    optionTeamName: 'Nombre del equipo (déjalo vacío para el tuyo)',
  },

  errors: {
    dm: 'Ejecútalo en el servidor de Discord de tu clan — un comando de tablero necesita saber qué clan pregunta.',
    wrongGuild:
      'Este bot está conectado a un servidor distinto al Anvil de **{clan}**. Pide a un admin que revise el ID del servidor en Integrations.',
    unknownCommand: 'Anvil no responde a {command} — prueba {suggestion}.',
    unknownSub: 'Comando desconocido. Prueba {list}.',
    noBoards: '**{clan}** todavía no tiene tableros.',
    noBoardsStaff: 'El staff puede crear uno en {url}/admin/events/new.',
    failed: 'Anvil se topó con un error al responder. Un admin puede revisar los logs del sitio.',
    unsupported: 'Ese tipo de interacción todavía no está soportado.',
    shareExpired: 'Esa respuesta es demasiado antigua para compartirla — vuelve a lanzar el comando.',
  },
};

export default es;
