import type { PartialDiscordDict } from './en';

// 한국어 — Korean.
//
// 명령어 이름 자체는 영어로 둡니다: 한국어로 읽는 사람도 입력하는 것은 `/bingo board`이고,
// 번역된 명령어 이름은 아무도 찾을 수 없는 명령어가 됩니다. "Powered by Anvil"도 마찬가지입니다.
// 그 밖의 모든 것 —— 설명, 순서, 이유 —— 은 한국어입니다.

const ko: PartialDiscordDict = {
  common: {
    noTeams: '_아직 팀이 없습니다._',
    moreOnSite: '사이트에 {n}개 더',
    more: '{n}개 더',
    bonusLegend: '⚡ 미션 보너스 —— 보드 총점 위에 얹혀 얻는 점수라, 점수에는 들어가지만 진행률에는 들어가지 않습니다.',
    visitingClansOne: '🤝 {names}은(는) 방문 클랜입니다 —— 이 보드는 공유되고 있습니다.',
    visitingClansMany: '🤝 {names}은(는) 방문 클랜입니다 —— 이 보드는 공유되고 있습니다.',
    visitingPlayersOne: '🤝 다른 클랜에서 1명이 방문 중입니다.',
    visitingPlayersMany: '🤝 다른 클랜에서 {n}명이 방문 중입니다.',
    phaseRunning: '진행 중',
    phaseUpcoming: '시작 전',
    phaseEnded: '종료됨',
    phaseDraft: '초안',
    contextVisitingTeamsOne: '클랜 간 · 방문 팀 1',
    contextVisitingTeamsMany: '클랜 간 · 방문 팀 {n}',
    contextVisitingPlayersOne: '방문 플레이어 1명',
    contextVisitingPlayersMany: '방문 플레이어 {n}명',
    shareButton: '채널에 공유',
    sharedBy: '-# {who} 님이 공유',
    fieldFormat: '형식',
    fieldTeams: '팀',
    fieldPlayers: '플레이어',
    fieldTilesDone: '완료한 칸',
    fieldTeamScore: '팀 점수',
    fieldYourTiles: '내 칸',
    fieldAccounts: '계정',
    fieldRank: '순위',
    fieldRoster: '명단',
    fieldScore: '점수',
  },

  board: {
    starts: '{when} 시작합니다.',
    ends: '{when} 종료됩니다.',
    finished: '이 보드는 끝났습니다.',
    notScheduled: '아직 일정이 없습니다.',
    hidden: '칸이 아직 숨겨져 있습니다 —— 운영진이 공개하면 보드가 열립니다.',
  },

  leaderboard: { title: '🏆 {event} —— 순위' },

  rules: {
    title: '📜 {event} —— 진행 방식',
    houseTitle: '📌 {clan} —— 클랜 규칙',
    houseContinues: '**규칙은 이어집니다** —— 전문은 여기에서',
    houseFull: '규칙 전문:',
    houseTrimmed: '-# Discord에 맞추어 줄였습니다 —— 전체 규칙은 운영진에게 요청하세요.',

    scoringPoints: '• **점수** —— 각 칸은 자기 점수를 가지며, 팀 점수는 완료한 칸들의 합입니다.',
    scoringTiles: '• **점수** —— 칸당 1점이고, 팀 점수는 완료한 칸의 개수입니다.',
    tileRace: '• **칸 레이스** —— 보드는 순서가 정해진 코스입니다. 그 위를 나아가며, 가장 멀리 간 칸이 여러분의 위치입니다.',
    revealScheduled: '• **공개** —— 칸은 운영진이 정한 일정에 따라 열립니다. 아직 안 보이는 칸은 그저 아직 열리지 않은 것입니다.',
    revealIntervalOne: '• **공개** —— {minutes}분마다 {order} 1칸이 뽑힙니다.',
    revealIntervalMany: '• **공개** —— {minutes}분마다 {order} {n}칸이 뽑힙니다.',
    revealOrderRandom: '무작위로',
    revealOrderBoard: '보드 순서대로',
    revealBounty: '• **현상금** —— 한 번에 정확히 한 칸만 열립니다. 먼저 끝낸 팀이 그 칸을 닫고, 곧바로 다음 칸이 뽑힙니다.',
    revealRotating: '• **순환** —— {n}칸이 동시에 열려 있고, 새로 뽑힐 때마다 가장 오래된 칸이 만료됩니다. 열려 있는 동안 끝내세요.',
    revealAll: '• **공개** —— 보드 전체가 처음부터 열려 있습니다.',
    notRevealed: '• **아직 공개 전** —— 이벤트가 시작될 때 운영진이 보드를 엽니다. 그전에는 아무도 칸을 볼 수 없습니다.',
    lockout: '• **선점** —— 칸을 먼저 끝낸 팀이 가져갑니다. 그 뒤로는 누구도 그 칸으로 득점할 수 없습니다.',
    firstBonus: '• **선착 보너스** —— 그 칸을 처음 끝낸 팀은 {amount}점을 더 받습니다.',
    decay: '• **가치 감소** —— 칸은 열릴 때 만점이고 {hours}시간에 걸쳐 {pct}%까지 내려갑니다. 빨리 끝낼수록 점수가 큽니다.',
    growth: '• **가치 상승** —— 칸은 만점에서 시작해 {hours}시간에 걸쳐 {pct}%까지 올라갑니다. 기다릴수록 점수가 큽니다.',
    missions: '• **미션** —— 이벤트 도중에 공개되는 추가 목표, {when}. 공지 전에는 아무도 보지 못합니다.',
    missionWhenInterval: '{minutes}분마다',
    missionWhenScheduled: '예정표에 따라',
    missionWhenManual: '운영진이 떨어뜨릴 때',
    missionBonusNote:
      '-# 미션 점수는 **보너스**입니다 —— 내 점수에는 더해지지만 보드 총점에는 결코 더해지지 않으므로, 보드가 도중에 길어지는 일은 없습니다.',
    missionAnnouncedCount: '지금까지 {total}개 중 {announced}개 공지됨.',
    startProofStrict:
      '• **시작 인증샷** —— 모든 플레이어는 개시 이후에 스크린샷 한 장을 제출합니다. 장소는 개시 순간에 추첨됩니다. 제출하기 전까지 여러분이 올리는 것은 모두 거부됩니다.',
    startProofFlag:
      '• **시작 인증샷** —— 모든 플레이어는 개시 이후에 스크린샷 한 장을 제출합니다. 장소는 개시 순간에 추첨됩니다. 제출하기 전까지 여러분이 올리는 것은 모두 확인 대기로 표시됩니다.',
    startProofSession:
      '-# 먼저 로그아웃했다가 다시 접속하세요 —— 하이스코어는 로그아웃할 때만 저장되므로, 새로 접속한 뒤 {minutes}분 안에 찍어야 합니다.',
    teamChoice: '• **팀** —— 신청할 때 직접 팀을 고르고, 운영진이 승인합니다.',
    captainInvites: '• **팀** —— 주장이 자기 팀의 초대 링크를 직접 나눠 줍니다.',
    entryFee: '• **참가비** —— 신청 1건당 {amount}.',
    prizePool: '• **상금 풀** —— {amount}, 승인된 신청마다 늘어납니다.',

    trackingHeading: '**어떻게 인정되는가**',
    trackingPlugin: '• **Anvil 플러그인이 있으면** —— 대신 제출해 줍니다. 플레이 말고는 할 일이 없습니다.',
    trackingHiscoresAll:
      '• **플러그인이 없다면?** 여기 모든 칸은 **공식 하이스코어**를 읽으므로 클라이언트가 전혀 필요 없습니다 —— 다만 하이스코어는 **로그아웃할 때만** 저장되고 정시에 갱신됩니다. 플레이 → 로그아웃 → 정시까지 대기.',
    trackingHiscoresSome:
      '• **플러그인이 없다면?** 이 중 {n}칸은 **공식 하이스코어**를 읽으므로 클라이언트가 전혀 필요 없습니다 —— 다만 하이스코어는 **로그아웃할 때만** 저장되고 정시에 갱신됩니다. 플레이 → 로그아웃 → 정시까지 대기.',
    trackingProofAll:
      '• **드롭, 처치, 시간제한 과제**에는 증빙이 필요합니다 —— 여기서는 모든 칸이 그렇습니다. 플러그인이 자동으로 보관해 주며, 없다면 {where} 직접 스크린샷을 올리면 됩니다.',
    trackingProofSome:
      '• **드롭, 처치, 시간제한 과제**에는 증빙이 필요합니다 —— 이 중 {n}칸입니다. 플러그인이 자동으로 보관해 주며, 없다면 {where} 직접 스크린샷을 올리면 됩니다.',
    trackingWhereUrl: '{url}/team 의 **My Team**에서',
    trackingWhereNoUrl: 'My Team 페이지에서',
    trackingKeepShot: '-# 어느 쪽이든 큰 건은 스스로 스크린샷을 남겨 두세요 —— 비용은 없고, 어떤 다툼이든 정리해 줍니다.',
  },

  me: {
    title: '👤 {who} —— {event}',
    notEnteredTitle: '🔍 이 보드에 없습니다',
    notEntered: '**{event}**에 신청되어 있지 않습니다.',
    notEnteredWhere: '신청과 프로필은 {url} 에 있습니다.',
    onTeam: '**{team}** 소속입니다.',
    onTeamRanked: '**{team}** 소속 —— {total}팀 중 {place}.',
    noTeamYet: '신청은 되어 있지만 아직 팀이 없습니다.',
    finishedHiddenOne: '1칸을 끝냈습니다 —— 이름은 보드가 공개되면 표시됩니다.',
    finishedHiddenMany: '{n}칸을 끝냈습니다 —— 이름은 보드가 공개되면 표시됩니다.',
    finishedHeading: '**내가 끝낸 칸**',
    nothingYet: '아직 인정된 칸이 없습니다.',
  },

  team: {
    noTeamsTitle: '🔍 아직 팀이 없습니다',
    noTeamsBody: '**{event}**에는 아직 팀이 없습니다.',
    noMatchTitle: '🔍 그런 팀이 없습니다',
    noMatch: '**{event}**에 "{needle}"와(과) 맞는 팀이 없습니다.',
    noneOfYours: '어느 팀에도 속해 있지 않습니다 —— 팀 이름을 지정해 조회하세요.',
    teamsList: '**팀:** {names}',
    standing: '{total}팀 중 {place} —— {score}{bonus} · 보드의 {pct}%.',
    bonusSuffix: ' (⚡+{n} 미션 보너스)',
    visitingWholeTeam: '🤝 방문 클랜: {names}',
    visitingSomeOne: '🤝 방문 플레이어 1명: {names}',
    visitingSomeMany: '🤝 방문 플레이어 {n}명: {names}',
    recentHeading: '**최근 칸**',
    hiddenBoard: '**{event}**의 칸은 아직 공개되지 않았습니다 —— 팀 카드는 보드가 열릴 때 함께 열립니다.',
  },

  apply: {
    title: '📝 {event} —— 참가 방법',
    drafted: '**이미 참가 중입니다** —— 드래프트로 팀에 들어가 있습니다. 남은 건 플레이뿐입니다.',
    approved: '**신청되어 승인되었습니다.** 이벤트 시작 전에 팀에 배정됩니다.',
    pending: '**신청이 접수되어** 운영진 승인을 기다리는 중입니다. 더 하실 일은 없습니다.',
    open: '**신청을 받고 있습니다.**',
    notOpenYet: '**아직 신청이 열리지 않았습니다.**',
    eventStarted: '**이벤트가 이미 시작되어** 신청이 마감되었습니다. 자리가 남았는지 운영진에게 물어보세요.',
    closed: '**신청이 마감되었습니다.**',
    closesIn: '{when} 마감됩니다.',
    opensIn: '{when} 열립니다.',
    fee: '참가비는 {amount}입니다 —— 어디로 보낼지는 운영진이 알려 줍니다.',
    feePerAccount: '참가비는 계정당 {amount}입니다 —— 어디로 보낼지는 운영진이 알려 줍니다.',
    signUpAt: '**신청하기:** {url}',
    noAccountUrl:
      '-# Anvil이 아직 당신의 계정을 모릅니다. 먼저 {url}/profile 에서 RSN을 연결하세요 —— 신청은 Discord 이름이 아니라 계정에 붙습니다.',
    noAccountNoUrl:
      '-# Anvil이 아직 당신의 계정을 모릅니다. 먼저 프로필 페이지에서 RSN을 연결하세요 —— 신청은 Discord 이름이 아니라 계정에 붙습니다.',
  },

  next: {
    title: '⏭️ {event} —— 다음 순서',
    eventStarts: '🚩 이벤트 시작',
    eventEnds: '🏁 이벤트 종료',
    nextTile: '🎲 다음 칸 추첨',
    nextMission: '⚡ 다음 미션',
    signupsClose: '📝 신청 마감',
    nothingEnded: '시계에 남은 것이 없습니다 —— 이 보드는 끝났습니다.',
    nothingScheduled: '예정된 것이 없습니다. 운영진이 다음을 떨어뜨릴 때가 그때입니다.',
    hiddenMissionsOne: '-# 미션이 1개 남았습니다. 운영진이 떨어뜨릴 때 공지됩니다.',
    hiddenMissionsMany: '-# 미션이 {n}개 남았습니다. 운영진이 떨어뜨릴 때 공지됩니다.',
  },

  help: {
    title: '🔨 Anvil이 알려 줄 수 있는 것',
    privateNote: '-# 답변은 당신에게만 보입니다. 답변 아래의 **{share}** 버튼을 누르면 채널에 올릴 수 있습니다.',
    subs: {
      board: '지금 진행 중인 보드',
      leaderboard: '팀 순위',
      rules: '이 보드가 어떻게 굴러가는지 —— 점수, 공개, 증빙, 그리고 클랜 규칙',
      apply: '참가 방법 —— 신청, 참가비, 그리고 내 상태',
      next: '앞으로 올 것 —— 다음 공개, 미션, 마감',
      me: '내 팀, 내 칸, 내 순위',
      help: '여기서 Anvil이 알려 줄 수 있는 것',
      team: '팀 카드 —— 점수, 명단, 최근 칸',
    },
    command: 'Anvil —— 클랜 보드 확인',
    optionTeamName: '팀 이름 (비워 두면 내 팀)',
  },

  rolePanel: {
    modalTitle:
      '한 가지만 더',
    modalLabel:
      '당신의 RuneScape 이름',
    modalPlaceholder:
      '게임 안 표기 그대로',
    granted:
      '✅ **{label}**(으)로 설정했습니다.',
    optionGone:
      '이 버튼은 오래된 것입니다 —— 운영진에게 패널을 다시 올려 달라고 하세요.',
    grantFailed:
      '⚠️ 역할이 적용되지 않았습니다. Anvil 봇 역할은 나눠 주는 역할보다 **위**에 있어야 합니다 —— 관리자에게 확인을 요청하세요.',
    rsnSaved:
      '📋 **{rsn}**을(를) RuneScape 이름으로 저장했습니다.',
    rsnSavedRenamed:
      '📋 **{rsn}**을(를) RuneScape 이름으로 저장하고, 별명도 같게 맞췄습니다.',
    rsnPending:
      '-# 이벤트에 반영되려면 그 계정이 당신 것임을 운영진이 확인해야 합니다.',
    rsnInvalid:
      'RuneScape 이름 같지 않습니다 —— 1~12자, 게임 안 표기 그대로 입력하세요.',
    rsnTaken:
      '**{rsn}**은(는) 이미 다른 사람에게 연결되어 있습니다. 잘못된 것이라면 운영진에게 문의하세요.',
    failed:
      'Anvil이 끝까지 처리하지 못했습니다. 관리자가 사이트 로그를 확인할 수 있습니다.',
  },

  errors: {
    dm: '클랜의 Discord 서버에서 실행하세요 —— 보드 명령은 어느 클랜이 묻는지 알아야 합니다.',
    wrongGuild:
      '이 봇은 **{clan}**의 Anvil과 다른 서버에 연결되어 있습니다. 관리자에게 Integrations의 서버 ID를 확인해 달라고 하세요.',
    unknownCommand: 'Anvil은 {command}에 응답하지 않습니다 —— {suggestion}을(를) 써 보세요.',
    unknownSub: '알 수 없는 명령입니다. {list}을(를) 써 보세요.',
    noBoards: '**{clan}**에는 아직 보드가 없습니다.',
    noBoardsStaff: '운영진은 {url}/admin/events/new 에서 만들 수 있습니다.',
    failed: 'Anvil이 답하는 중 오류를 만났습니다. 관리자가 사이트 로그를 확인할 수 있습니다.',
    unsupported: '그 상호작용 유형은 아직 지원하지 않습니다.',
    shareExpired: '그 답변은 너무 오래되어 공유할 수 없습니다 —— 명령을 다시 실행하세요.',
  },
};

export default ko;
