import type { PartialGuideDict } from './en';

// 한국어 — Korean.
//
// 여기 있는 다른 언어 파일들과 같은 원칙: 독자가 Anvil·RuneLite·OBS 화면에서 "실제로 보는" 것은 영어 그대로
// 둔다 —— RuneLite와 OBS의 메뉴, 플러그인이 직접 출력하는 채팅 줄, 그리고 Anvil 관리 화면의 라벨
// (그 화면 자체가 번역되기 전까지는 영어다). "Tracked drop detected"를 번역해 버리면,
// 화면에서 그 줄을 찾는 사람이 다시는 찾지 못한다.
// Discord의 UI 라벨(메뉴, 설정, 권한 이름: "서버 ID 복사하기", "서버 설정 → 역할", "웹후크 관리")은 Discord 자체의
// 한국어 번역 —— 독자의 Discord 클라이언트에 보이는 표기 —— 을 따른다(Discord가 번역되지 않은 언어라면 영어 그대로).
// 그 밖의 모든 것 —— 설명, 순서, 이유 —— 은 한국어다.

const ko: PartialGuideDict = {
  common: {
    contents: '목차',
    step: '단계',
    optional: '선택',
    minRead: '읽는 데 약 {n}분',
    copyLink: '이 섹션의 링크 복사',
    linkCopied: '링크를 복사했습니다',
    language: '언어',
    partialNotice:
      '이 가이드는 {language}로 일부만 번역되어 있습니다. 아직 번역되지 않은 부분은 영어로 표시됩니다.',
    backToGuides: '전체 가이드',
    unreviewedNotice:
      '이 {language} 번역은 아직 원어민이 검수하지 않았습니다. 어떤 문장이 이상하게 읽힌다면 [영어 페이지]({englishHref})가 원문이며 —— [알려 주시는 것](/feedback)이 그것을 고치는 방법입니다.',
    support: {
      lead: '막히거나 뭔가 이상한가요?',
      link: 'Anvil 지원 Discord에 문의하기',
    },
    legalPaid: '결제 관련 문의: [환불](/legal/refunds) 및 [이용약관](/legal/terms).',
    legalPrivacy: '데이터 처리 방식: [개인정보처리방침](/legal/privacy).',
    aboutLine: 'Anvil 운영 주체가 궁금하다면 [About](/about)을 읽어 보세요.',
  },

  index: {
    metaTitle: '가이드 — Anvil',
    metaDescription:
      'Anvil 시작하기: 플레이어용 RuneLite 플러그인, 클랜 운영진을 위한 이벤트 운영, 그리고 방문 클랜을 맞이하는 방법.',
    title: '가이드',
    dek: '시작하는 데 필요한 모든 것. 여기서 돌아가고 있는 바로 그 버전의 Anvil에 맞춰 쓰였습니다.',
    groups: {
      playing: '플레이',
      running: '이벤트 운영',
      clan: '클랜 운영',
      streamers: '스트리머',
    },
    anvilTab: 'Anvil 사용하기',
    ingame: {
      title: '게임 공략',
      dek: 'Anvil 라이브러리의 레이드, 보스, 스킬링, 돈벌이 공략 — 플러그인이 게임 안에서 보여 주고 봇이 Discord에 올리는 것과 같은 공략입니다.',
      browse: '모든 공략 보기',
      language: '이 공략들은 번역되지 않습니다. 이 페이지의 언어와 상관없이 작성된 언어 그대로 보입니다.',
      empty: 'Anvil 라이브러리에 아직 공개된 공략이 없습니다. 곧 다시 확인해 주세요.',
      placeholder: '게임 공략 검색 — "zulrah", "raids", "money" 등을 입력해 보세요',
      readTime: '{n}분 분량',
      metaTitle: 'OSRS 게임 공략 — Anvil',
      metaDescription: 'Anvil 라이브러리의 레이드, 보스, 스킬링, 돈벌이 공략. 사이트에서, RuneLite 플러그인으로 게임 안에서, 그리고 Discord에서 읽을 수 있습니다.',
    },
    search: {
      placeholder: '가이드 검색 — "webhook", "칸", "드롭이 안 보여요" 같은 말로 찾아보세요',
      results: '가이드 {n}개',
      empty: '일치하는 것이 없습니다. 더 평범한 단어 — "칸", "지급", "봇" — 을 써보거나 아래 목록을 훑어보세요.',
      clear: '검색 지우기',
    },
    cards: {
      tiles: {
        eyebrow: '플레이어용',
        title: '칸 규칙과 제한',
        blurb: '시작하기 전에 칸이 필요로 하는 것(게임 설정, 플러그인, 동기화된 로그, 하이스코어 순위)과 추적할 수 없는 것.',
        minutes: '약 4분',
      },
      discord: {
        eyebrow: '서버를 운영하는 분께',
        title: 'Discord 속 Anvil',
        blurb: '초대 한 번, 그다음은 각 피드가 올라가는 채널, 역할, 슬래시 명령어, 그리고 멈췄을 때 볼 곳.',
        minutes: '약 5분',
      },
      switching: {
        eyebrow: 'Anvil로 옮기기',
        title: '다른 플러그인과 트래커에서 갈아타기',
        blurb:
          'Anvil은 드롭을 Discord에 올리고 주간 대회도 운영합니다. 운영진은 5단계, 플레이어는 2단계면 됩니다.',
        minutes: '약 3분',
      },
      clan: {
        eyebrow: '클랜을 시작하는 분께',
        title: '클랜 만들기',
        blurb: '이름 두 개와 주소 하나면 공개됩니다. 그다음은 Discord, 멤버 명단, 첫 번째 보드.',
        minutes: '약 4분, 무료',
      },
      plugin: {
        eyebrow: '플레이어용',
        title: 'RuneLite 플러그인 설정',
        blurb:
          '플러그인을 설치하고, 사이드 패널에서 로그인한 뒤, 드롭 제출을 맡기세요. Discord 알림과 플레이어 조회도 다룹니다.',
        minutes: '설정 약 3분',
      },
      board: {
        eyebrow: '보드 제작자용',
        title: '스스로 기록하는 보드 만들기',
        blurb:
          '각 칸 종류가 실제로 볼 수 있는 것, 스프레드시트를 통한 대량 작성, 그리고 깔끔하게 들어온 뒤 한 번도 발동하지 않는 실수들.',
        minutes: '약 8분',
      },
      captain: {
        eyebrow: '주장용',
        title: '주장 가이드',
        blurb:
          '시계가 돌기 전에 후보를 읽어 두는 법, 드래프트 당일 그 자체, 그리고 드래프트가 끝난 뒤에야 시작되는 팀 운영의 몫.',
        minutes: '약 6분',
      },
      formats: {
        eyebrow: '클랜 운영진용',
        title: '형식, 그리고 칸이 열리는 방식',
        blurb:
          '일곱 가지 보드 형태, 칸이 플레이 가능해지는 다섯 가지 방식, 그리고 완료 한 번의 값을 정하는 세 가지 보정.',
        minutes: '약 5분',
      },
      fees: {
        eyebrow: '회계 담당용',
        title: '참가비와 상금',
        blurb:
          '참가비를 정하고, 걷고, 그것을 마무리 짓는 두 번째 서명, 그리고 상금 풀을 지급 완료된 순위표로 바꾸기까지.',
        minutes: '약 5분',
      },
      coffer: {
        eyebrow: '회계 담당용',
        title: '클랜 금고',
        blurb:
          '클랜 gp를 담는 하나의 금고: 무엇이 들어오는지, 상금을 내주는 세 가지 길, 그리고 누가 손댈 수 있는지.',
        minutes: '약 5분',
      },
      moderator: {
        eyebrow: '관리자용',
        title: '당번',
        blurb:
          '대기열, 증빙과 계정 확인, 멤버 명단을 정직하게 유지하기, 그리고 결국 사람이 내려야 하는 판단들.',
        minutes: '약 5분',
      },
      admin: {
        eyebrow: '클랜 운영진용',
        title: '첫 이벤트 운영하기',
        blurb:
          'Discord, 멤버 명단, 보드, 칸, 팀과 드래프트, 개시 —— 그리고 이벤트가 끝난 뒤에 할 일.',
        minutes: '하룻밤, 한 번만',
      },
      clanVsClan: {
        eyebrow: '주최자용',
        title: '방문 클랜 맞이하기',
        blurb:
          'RSN을 하나도 손으로 모으지 않고 클랜 대항전을 여는 법: 팀마다 초대 링크 하나, 그리고 상대 쪽 관리자가 자기들 절반을 직접 굴릴 수 있는 자리 하나.',
        minutes: '팀당 약 5분',
      },
      commands: {
        eyebrow: '모든 멤버용',
        title: '슬래시 명령어',
        blurb:
          '봇이 Discord에서 응답하는 모든 명령어, 각 옵션이 하는 일, 실제 예시, 그리고 명령어가 안 보일 때 확인할 것.',
        minutes: '약 6분',
      },
      creators: {
        eyebrow: '스트리머용',
        title: '시청자를 위한 이벤트 열기',
        blurb:
          '클랜은 필요 없어요. 스페이스를 만들고, 링크 하나를 공유하고, 참여할 수 있는 사람(팔로워, 구독자, Discord 역할)을 고른 뒤, 보드를 방송에 띄우세요.',
        minutes: '약 6분',
      },
      joiningStream: {
        eyebrow: '시청자용',
        title: '스트리머의 이벤트에 참여하기',
        blurb:
          '방송에서 링크를 받았나요? 로그인하고, 캐릭터를 추가하고, Join을 누르세요. 팔로워 전용·구독자 전용 이벤트에서 할 일.',
        minutes: '약 2분',
      },
      streamingClans: {
        eyebrow: '방송하는 클랜용',
        title: '클랜 방송하기',
        blurb:
          '시청자가 클랜에 가입하지 않고도 이벤트 하나에 참여하게 하세요. Streaming을 켜고, 이벤트를 시청자에게 열면 됩니다.',
        minutes: '약 2분',
      },
      people: {
        eyebrow: '클랜 스태프용',
        title: '우리 사람들: 명단, 게스트, 그리고 누가 들어올 수 있나',
        blurb:
          '멤버가 어디서 오는지, Roster 탭의 필터가 뜻하는 것, 가입 요청과 Needs review, Who can join의 세 가지 설정, 그리고 누군가를 내보내거나 차단하는 법.',
        minutes: '약 6분',
      },
      staffRoles: {
        eyebrow: '소유자와 admin용',
        title: '스태프 역할: 누가 무엇을 할 수 있나',
        blurb:
          '소유자, admin, 회계 담당, 관리자: 각자 닿는 범위, 누군가를 관리자로 만드는 법, 누가 어떤 역할을 줄 수 있는지, 그리고 이벤트 하나만 맡는 직무.',
        minutes: '약 6분',
      },
      supporter: {
        eyebrow: '플레이어용',
        title: 'Anvil Supporter: 등급과 혜택',
        blurb:
          'Supporter, Champion, Patron: 이름 색, 별, 프로필 사진, 진열장, 친구 이벤트와 클랜 부스트, 결제 방식, 그리고 그만두면 어떻게 되는지.',
        minutes: '약 6분',
      },
      sidePanel: {
        eyebrow: '플레이어용',
        title: '사이드 패널, 탭별로 보기',
        blurb:
          'Clan, Feed, You, Lookup, 그리고 톱니바퀴: 각 탭이 보여 주는 것, 이벤트 채팅, GZ와 Sad 반응, 그리고 피드와 Supporter 색을 게임 안에 띄우는 설정.',
        minutes: '약 6분',
      },
      clanBoosts: {
        eyebrow: 'Supporter와 클랜 스태프용',
        title: '클랜 부스트하기',
        blurb:
          '부스트를 놓고 옮기는 법, 세 가지 레벨과 각 레벨이 여는 것, 클랜 이름 색, 선물받은 부스트, 그리고 부스터 표시와 배지.',
        minutes: '약 5분',
      },
      profile: {
        eyebrow: '플레이어용',
        title: '내 프로필, Wrapped와 Compare',
        blurb: '내 프로필, 캐릭터별 공개 페이지와 내 개인 페이지, 누가 이 페이지들을 볼 수 있는지, 월간 및 이벤트 Wrapped 카드, 그리고 캐릭터 두 개를 비교하는 기능.',
        minutes: '~4분',
      },
      settings: {
        eyebrow: '플레이어용',
        title: '설정, 페이지별로',
        blurb: 'Discord 게시와 스크린샷 개인정보 보호, 게임 내 채팅 피드, 기기, 직접 만든 웹후크, 누가 내 캐릭터를 볼 수 있는지, 각 캐릭터, 그리고 소유권 주장.',
        minutes: '~6분',
      },
      challenges: {
        eyebrow: '플레이어용',
        title: '도전과 친구 이벤트',
        blurb: '한 명의 플레이어에게 드롭, 처치 수 또는 XP 경쟁을 걸고, 친구들을 위해 초대 링크 하나로 열리는 비공개 보드를 엽니다.',
        minutes: '~4분',
      },
      clanHall: {
        eyebrow: '플레이어와 클랜용',
        title: '클랜, 이벤트, 리더보드 찾기',
        blurb: 'Clan Hall, 두 클랜 비교, 주간 리더보드, 공개 이벤트 목록, 그리고 Anvil에 없는 게임 내 클랜의 페이지.',
        minutes: '~3분',
      },
      guideLibrary: {
        eyebrow: '플레이어와 클랜 운영진용',
        title: '게임 내 공략',
        blurb: '레벨별로 공략 라이브러리 읽기, 새 공략이나 수정 제안하기, 그리고 우리 클랜의 복사본 관리하기.',
        minutes: '~3분',
      },
      weekly: {
        eyebrow: '클랜 운영진과 플레이어용',
        title: '주간 스킬과 보스',
        blurb: '주간 대회 예약, 반복과 순환 설정, 시작 신호, 상품, 조기 종료, 그리고 플레이어가 보는 화면.',
        minutes: '~4분',
      },
      teamComps: {
        "eyebrow": "클랜 스태프와 플레이어를 위한 안내",
        "title": "팀 대항전",
        "blurb": "스킬 및 보스 대항전을 팀 또는 클랜 대 클랜으로 운영하는 방법입니다. 설정, 다른 클랜 초대, 합계와 평균 계산 방식, 플레이어에게 보이는 내용을 다룹니다.",
        "minutes": "약 4분"
      },
      clanEvents: {
        eyebrow: '클랜 운영진용',
        title: '클랜 이벤트와 일정',
        blurb: '대규모 모임, 레이드 나이트, 모임: 주간 반복, “갑니다”와 참가 신청, Discord 알림, 지급, 설문, 그리고 일정의 빈 시간 찾기.',
        minutes: '~4분',
      },
      luckRecords: {
        eyebrow: '플레이어를 위한',
        title: '드롭 확률, 행운, 기록',
        blurb: '드롭 타일의 확률이 무엇을 뜻하는지, 행운이 어떻게 계산되는지, 그리고 최고의 하루, 주, 달, 해가 어디에 표시되는지 알려 줍니다.',
        minutes: '약 3분',
      },
    },
  },

  switching: {
    metaTitle: '다른 플러그인과 트래커에서 갈아타기 — Anvil',
    metaDescription:
      '클랜을 Anvil로 옮겨 보세요. Discord 채널 설정, 클랜 명단 동기화, Skill 또는 Boss of the Week 시작, 그리고 멤버 안내까지.',
    eyebrow: 'Anvil로 옮기기',
    title: '다른 플러그인과 트래커에서 갈아타기',
    dek: 'Anvil은 클랜의 드롭과 업적을 Discord에 올립니다. 또 클랜 명단을 최신으로 유지하고 주간 대회를 운영합니다.',

    staff: {
      title: '클랜을 운영한다면',
      body: [
        '**봇이 채널을 설정하게 하세요.** Admin → Discord → **Set it up for me**로 가세요. 채널을 하나 또는 여러 개 고르세요. 다른 플러그인이 어딘가에 올리고 있었다면 _Use the same channels_를 체크하세요. 멤버들에게는 달라지는 게 없습니다.',
        '**클랜 명단을 동기화하세요.** RuneLite에서 Anvil 플러그인 설정을 열고 **Keep the clan roster in sync**를 켜세요. 관리자 한 명이 게임 안에서 한 번만 하면 됩니다. 다른 곳에서 관리하던 클랜 명단을 대신합니다.',
        '**Skill 또는 Boss of the Week를 시작하세요.** Admin → All events → **+ New event**로 가서 Skill of the Week나 Boss of the Week를 고르세요. 클랜 명단의 모든 사람이 자동으로 참여합니다. 다른 곳에서 열던 대회를 대신합니다.',
        '**멤버들에게 알리세요.** Admin → Discord → **Tell your members** → **Post it**로 가세요. 플레이어용 안내 단계를 봇이 대신 올려 줍니다.',
        '**일주일 뒤에 정리하세요.** Admin → Discord → **Remove old webhooks from other plugins**에서 지울 웹훅을 체크하고 **Remove … webhooks**를 누른 다음 **Yes, remove them**을 누르세요. 그 뒤로는 중복 게시가 생기지 않습니다. 그대로 두고 싶은 웹훅에는 **Keep**을 누르세요.',
      ],
    },

    player: {
      title: '플레이어라면',
      body: [
        '**Anvil을 설치하세요.** RuneLite에서 Plugin Hub를 열고 Anvil을 검색해 **Install**을 누르세요. 그런 다음 Anvil 사이드 패널에서 Discord로 로그인하세요.',
        '**이전 플러그인의 알림을 끄세요.** 아무것도 두 번 올라가지 않도록 끄세요. 다른 용도로 쓰지 않는다면 삭제해도 됩니다.',
        '**끝입니다.** 따로 설정할 것은 없습니다.',
      ],
    },

    questions: {
      title: '질문',
      intro: '클랜들이 가장 많이 묻는 질문입니다.',
      rows: [
        {
          term: 'Anvil이 킬 카운트, 슬레이어 과제, 개인 최고 기록을 추적하나요?',
          body: '네. Anvil이 킬 카운트, 슬레이어 과제, 개인 최고 기록을 직접 추적하므로 따로 계속 돌려야 할 것이 없습니다.',
        },
        {
          term: '플레이어가 어딘가에 웹훅을 붙여 넣어야 하나요?',
          body: '아니요. 채널은 클랜이 사이트에서 설정합니다.',
        },
        {
          term: '내 서버에도 게시하고 싶나요?',
          body: '프로필 → **Announcements & webhooks** → _Your own webhooks_로 가세요.',
        },
      ],
    },
  },

  clan: {
    metaTitle: '클랜 만들기 — Anvil',
    metaDescription: 'Anvil에서 클랜 만들기: 이름을 정하고, 주소를 고르고, Discord를 연결하고, 멤버 명단을 동기화한 뒤 첫 이벤트를 여는 방법.',
    eyebrow: 'Anvil · 시작하기',
    title: '클랜 만들기',
    dek: '이름 두 개와 주소 하나면 클랜이 공개됩니다 — 무료이고, 기다릴 것도 없습니다. 이 글은 그 과정과, 바로 뒤이어 해둘 만한 네 가지입니다.',
    facts: [
      {
        strong: '무료',
        rest: '카드 없음, 체험 기간 없음',
      },
      {
        strong: '즉시 공개',
        rest: '제출하는 그 순간',
      },
      {
        strong: '약 4분',
        rest: '작동하는 클랜까지',
      },
    ],
    footnote: '여기 나오는 것들은 나중에 Admin → **Clan settings**에서 모두 바꿀 수 있습니다. 주소만 예외이고, 그건 지금 잠깐 생각해둘 값어치가 있습니다.',
    before: {
      title: '시작하기 전에',
      body: [
        'Discord 계정이 필요하고, 목록은 그게 전부입니다. 먼저 `{apex}`에서 로그인하세요. 클랜에는 소유자가 있어야 하고, 로그인이 바로 그게 당신이라는 걸 사이트에 알려주는 방법입니다. 플랫폼 페이지의 **클랜 만들기**에서 시작하거나 `{apex}/clans/new`로 바로 가세요.',
        '비용은 들지 않습니다. 고를 요금제도, 입력할 카드도, 만료되면서 보드까지 가져가는 체험 기간도 없습니다 — 클랜은 무료로 시작해 그대로 쓸 수 있습니다.',
        '큰 클랜은 나중에 관리의 **Plan and billing**에서 요금제를 올릴 수 있습니다. Anvil에서 결제하는 모든 것 — 클랜, 크리에이터 스페이스, 당신의 Supporter 멤버십 — 은 [결제 페이지](/portal)에 있습니다.',
      ],
      note: {
        tag: '당신이 소유자가 됩니다',
        body: '소유자는 누구도 빼앗을 수 없는 유일한 역할이며, 클랜을 만든 사람에게 갑니다. 스태프는 그 뒤에 Admin → **People** → **Staff & roles**에서 추가하세요. [당번표에서]({moderatorGuide}) 참고.',
      },
    },
    create: {
      title: '이름을 정하고 주소를 고르기',
      intro: '항목은 셋, 실제 결정은 둘뿐입니다. 양식은 입력하는 동안 주소를 확인하고 제출 전에 알려줍니다.',
      fields: [
        {
          term: '게임 내 클랜 이름',
          body: '필수이며 OSRS와 **정확히** 일치해야 합니다. 장식이 아닙니다. 명단 동기화가 이것으로 대조하고, 다른 이름으로 보고된 멤버 명단은 거부합니다. 남의 멤버 명단이 당신 사이트에 들어오는 걸 막는 게 바로 이겁니다.',
        },
        {
          term: '클랜 이름',
          body: '선택 사항. 사람들이 보는 이름입니다 — 사이트에서도, 모든 Discord 게시물에서도. 비워두면 게임 내 이름이 둘 다에 쓰입니다.',
        },
        {
          term: '주소',
          body: '클랜은 `{apex}/c/your-slug`에 자리잡습니다. 입력한 이름을 바탕으로 제안되며 수정할 수 있고, 일부 단어는 예약되어 있습니다. 1년 뒤에도 마음에 들 만한 걸 고르세요. 결국 Discord에 고정될 링크입니다.',
        },
      ],
      note: {
        tag: '게임 내 이름은 라벨이 아니라 자물쇠입니다',
        body: '게임에서 클랜 이름을 바꿨다면 여기서도 바꾸세요. 그전까지 명단 동기화는 새 이름을 거부합니다. 이건 검사가 작동하는 것이지 고장이 아닙니다.',
      },
    },
    live: {
      title: '이미 공개되었습니다',
      body: [
        '**클랜 만들기**를 누르면 그걸로 존재합니다. 프로비저닝도, 대기열도, "사이트를 만드는 중입니다, 몇 분 뒤에 다시 오세요"도 없습니다 — 클랜은 한 행이라서, 페이지가 다 바뀌기도 전에 이미 서비스되고 있습니다.',
        '그다음 **설정하기**(마법사가 열립니다)와 **먼저 둘러보기** 중에서 고르게 됩니다. 도중에 나갔다가 내일 돌아와도 깨지는 건 없습니다. 마법사는 어떤 단계를 마쳤는지 기억합니다.',
      ],
    },
    setup: {
      title: '설정 마법사',
      intro: '갓 만든 클랜과 진행 중인 이벤트 사이에는 세 단계가 있고, 마법사는 그걸 순서대로 밟으며 이미 한 것은 건너뜁니다. 보드는 그 바로 다음입니다.',
      steps: [
        {
          term: '당신의 클랜',
          body: '표시 이름, 게임 내 클랜 이름, 그리고 서버 초대 링크. 초대가 있어야 참가 신청 페이지와 가이드가 사람들을 당신에게 안내할 수 있습니다.',
        },
        {
          term: 'Discord 연결',
          body: '공유 봇 하나라서 등록할 애플리케이션도, 붙여넣을 토큰도 없습니다. **Connect your bot**을 눌러 한 번 승인한 다음, **A few channels** 또는 **Just one channel**을 고르고 **Set it up for me**를 누르세요 — 채널은 봇이 대신 만들어 줍니다.',
        },
        {
          term: '멤버 불러오기',
          body: '플러그인을 설치하고 Discord로 로그인한 뒤, 게임 안에서 클랜 창을 열고 그 제목 표시줄에 있는 **Anvil** 버튼을 누르세요. 멤버 목록이 들어오기 전까지는 아무도 이벤트에 신청할 수 없습니다.',
        },
        {
          term: '보드 만들기',
          body: '마법사는 **Create your first event →**로 끝납니다. 형식을 고르고, 칸을 넣고, 신청을 여세요 — 그게 [첫 이벤트 운영하기]({adminGuide})이고, 압도적으로 가장 긴 단계입니다.',
        },
      ],
      after: [
        '**Skip setup**으로 마법사를 통째로 건너뛰고 나중에 Admin → **Clan settings**와 Admin → **Discord**에서 전부 해도 됩니다. 이게 있는 이유는 처음 해볼 때는 순서가 중요하기 때문입니다. 채널보다 Discord가 먼저, 멤버가 신청해야 하는 보드보다 멤버가 먼저입니다.',
      ],
    },
    members: {
      title: '멤버 데려오기',
      body: [
        '아무도 가입하거나 등록하거나 한 명씩 초대받을 필요가 없습니다. 멤버 명단은 게임에서 옵니다.',
      ],
      ways: [
        {
          term: '명단 동기화 (이걸 쓰세요)',
          body: '플러그인을 켠 채 게임에서 클랜 창을 열고 제목 표시줄의 **Anvil** 버튼을 누르세요. 멤버 명단 전체가 등급까지 그대로 들어오고, 이름이 맞지 않는 클랜에서 온 명단은 거부됩니다. 사람이 들고 날 때마다 반복하면 됩니다 — [플레이어 설정 가이드]({pluginGuide}) 참고.',
        },
        {
          term: '가입을 요청합니다',
          body: '로그인하거나 플러그인으로 플레이하는 것만으로는 누구에게도 자리가 생기지 않습니다. 명단에 오르기 전에 우리 게임 내 클랜에서 플레이하는 사람을 플러그인이 보면, 그 사람 대신 가입 요청을 넣습니다. 그 밖의 사람은 클랜 페이지의 **Apply**로 요청할 수 있습니다. 스태프는 둘 다 **Roster** 탭 맨 위에서 답하고, **Who can join**이 그 사람들이 승인을 기다릴지, 바로 들어올지, 아예 요청할 수 없을지를 정합니다. 이미 명단에 있는 캐릭터를 플레이하는 사람은 대신 **Needs review**에서 확인됩니다. 자세한 내용은 [우리 사람들]({peopleGuide})에 있습니다.',
        },
        {
          term: '수동으로',
          body: 'Admin → **People** → **+ Add Manually**에서 이름을 하나씩 넣을 수 있습니다. 모바일이나 공식 클라이언트로 플레이해 플러그인을 아예 쓸 수 없는 사람을 위한 방법입니다.',
        },
      ],
      note: {
        tag: '게스트는 해결할 문제가 아닙니다',
        body: '게스트는 우리 게임 내 클랜에 속하지 않은 채 이벤트에서 플레이하는 사람입니다: 방문 클랜의 플레이어, 친구, 부계정. 스태프가 요청을 승인하면, 또는 **Who can join**이 **Let anyone in**으로 되어 있으면 바로 자리를 받습니다. 기록되고 이벤트에 참가할 수 있으며, 요금제 인원에는 포함되지 않습니다. 게임에서 클랜에 들어온 사람은 다음 명단 동기화 때 멤버가 됩니다.',
      },
    },
    first: {
      title: '첫 이벤트',
      body: [
        '뭔가 일어나게 하는 가장 짧은 길: 보드를 만들고, 플러그인이 스스로 볼 수 있는 칸 몇 개를 넣고, 신청을 열고, 시작하세요. 그다음부터 드롭, 킬 수, 경험치는 알아서 기록됩니다.',
        '여기서 무게를 지는 건 두 가이드입니다. [첫 이벤트 운영하기]({adminGuide})는 처음부터 끝까지 다룹니다 — Discord, 팀, 시작, 그리고 끝났을 때 할 일까지. [스스로 기록하는 보드 만들기]({boardGuide})는 칸 자체를 다룹니다. 종류별로 실제로 무엇을 감지할 수 있는지, 그리고 깔끔하게 가져와지고는 끝내 한 번도 발동하지 않는 것은 무엇인지.',
        '첫 주에는 보드를 아예 만들고 싶지 않다면 대신 **Skill of the Week**나 **Boss of the Week**를 여세요. 명단의 모두가 자동으로 참가하고, 순위는 hiscores에서 움직이며, 작성할 것이 없습니다.',
      ],
    },
    together: {
      title: '여러 클랜에 걸친 이벤트',
      body: [
        '이벤트가 한 클랜의 것일 필요는 없습니다. 여러 클랜이 같은 보드를 함께 운영할 수 있습니다 — 둘이든 열둘이든 — 각자 자기 명단, 자기 스태프, 자기 몫의 심사를 유지한 채로.',
        '점수판 양쪽에 나뉘어 앉는 대신 하나의 선수 풀을 공유할 수도 있습니다. 이벤트 하나에 모두가 들어가고, 팀이 어떻게 갈리든 상관없습니다. 클랜 대 클랜은 그중 한 형태이지 유일한 형태가 아닙니다.',
        '방문 클랜마다 팀별 초대 링크가 주어지므로 RSN을 손으로 하나도 모을 필요가 없고, 그쪽 운영자가 자기 멤버의 증거를 승인할 수 있는 자리도 함께 주어집니다. [방문 클랜 맞이하기]({clanVsClanGuide})가 주최하는 쪽을 다룹니다.',
      ],
      note: {
        tag: '살 것은 없습니다',
        body: '남의 이벤트에 참가하는 것도, 직접 여는 것도 무료입니다. 남의 보드에만 얼굴을 내미는 클랜은 자기 무료 클랜 이상을 필요로 할 일이 결코 없습니다.',
      },
    },
    boosts: {
      title: '클랜 부스트',
      body: [
        'Anvil Supporter를 **Champion**(부스트 1개) 또는 **Patron**(2개)으로 결제한 멤버는 자기 **Settings → Clan boosts**에서 클랜을 부스트할 수 있습니다. 부스트는 그 클랜에서의 자리가 14일이 지나야 집계되고, 한 사람에게서 집계되는 것은 최대 두 개입니다.',
        '현재 상황은 Admin → **Clan settings** → **Boosts**에서 볼 수 있습니다: 클랜 레벨, 집계 중인 부스트 수, 다음 레벨까지 더 필요한 수. 레벨 1은 부스트 3개, 레벨 2는 8개, 레벨 3은 15개가 필요합니다. 부스트가 어떤 레벨 아래로 떨어져도 그 레벨의 혜택은 일주일 동안 먼저 유지됩니다.',
        '레벨 1은 클랜 페이지, Clan Hall 카드, 검색 결과에 **Boosted** 배지를 달고, Clan Hall에서 부스트 없는 클랜보다 위에 보여 주며, 이름에 그라데이션을 입힙니다. 레벨 2는 Clan Hall의 Featured 줄에 자리를 더하고, 움직이는 배너를 재생하며, **Recruiting line**을 열어 줍니다: 방문자에게 보이는 최대 140자의 한 문장입니다. 레벨 3은 Clan Hall 맨 위의 Spotlight와 한 달에 한 번의 **Recruitment post in the Anvil Discord**를 더합니다. 최대 500자이고, **Post to the Anvil Discord**로 한 번만 보내지며, 클랜 페이지 링크가 붙고 아무도 멘션하지 않습니다.',
      ],
      note: {
        tag: '겉모습만',
        body: '부스트는 클랜이 어떻게 보이고 어디에 노출되는지만 바꿉니다. 등급, 점수, 자리, 요금제는 절대 바꾸지 않습니다.',
      },
    },
    features: {
      title: '기능과 요금제',
      intro: '관리자는 **Features** 아래에서 Anvil의 기능 묶음 전체를 켜거나 끌 수 있습니다. 끄면 메뉴에서 숨겨지며, 아무것도 삭제되지 않습니다.',
      rows: [
        {
          term: '이벤트',
          body: '**Skill & Boss of the Week** (켜짐), **Surprise-task formats** (꺼짐), **Missions** (꺼짐), **Post-event survey** (꺼짐).',
        },
        {
          term: '돈',
          body: '**Sign-up fees** (켜짐), **Clan coffer** (꺼짐).',
        },
        {
          term: 'Discord와 플러그인',
          body: '**Post to Discord** (켜짐), **Death & fun messages** (꺼짐), **Clan Hall card**: 공개 클랜 페이지에 내 Discord에서 누가 온라인인지 표시 (켜짐).',
        },
      ],
      outro: '**Plan and billing**에서 현재 요금제, 정원 대비 멤버 수, 더 큰 요금제를 볼 수 있습니다. 결제 중이라면 **Manage subscription and invoices**도 거기 있습니다.',
    },
  },

  discord: {
    metaTitle: 'Discord 속 Anvil — Anvil',
    metaDescription: 'Anvil 봇을 Discord 서버에 연결하기: 초대 한 번, 각 피드가 올라가는 채널, 역할과 별명 동기화, 슬래시 명령어, 그리고 조용해졌을 때 확인할 것.',
    eyebrow: 'Anvil · Discord',
    title: 'Discord 속 Anvil',
    dek: '봇 하나, 초대 한 번, 등록할 애플리케이션은 없습니다. 무엇을 올리고, 어디에 올리고, 당신 서버에서 무엇을 바꿀 수 있는지 — 그리고 멈춘 날 어디를 봐야 하는지.',
    facts: [
      {
        strong: '봇 하나',
        rest: '공유, 만들 것 없음',
      },
      {
        strong: '약 5분',
        rest: '초대에서 첫 게시물까지',
      },
      {
        strong: '선택 사항',
        rest: '가리키기 전까지 모든 피드는 꺼져 있음',
      },
    ],
    footnote: '여기 있는 건 전부 Admin → **Discord**에 있습니다. 맨 위에 빠른 설정, 그 아래 **More settings** — Connection, What goes where, Event posts, Roles & nicknames, Team channels, Commands, Post without a bot.',
    bot: {
      title: '봇 하나, 이미 만들어져 있음',
      body: [
        '만들 Discord 애플리케이션도, 생성할 토큰도, 붙여넣을 비밀 값도 없습니다. Anvil은 모든 클랜이 공유하는 봇 하나를 돌리므로, 연결한다는 건 초대하는 것뿐입니다.',
        '그래도 자기 봇을 가져올 수 있습니다 — **Use your own bot instead (advanced)** 아래에 토큰을 붙여넣으면 그쪽이 쓰입니다. 멤버 목록에서 봇이 당신 클랜의 이름과 아바타를 달기를 원할 때만 의미가 있고, 이 가이드의 내용은 어느 쪽이든 똑같이 작동합니다.',
      ],
      permissions: [
        {
          term: '채널 보기, 메시지 보내기, 링크 첨부, 파일 첨부',
          body: '기본입니다. 이게 없으면 서버에 있으면서 아무 말도 못 합니다.',
        },
        {
          term: '웹후크 관리',
          body: '**Set it up for me**와 **Post here**가 웹훅을 대신 만들어 줄 수 있게 하려는 것입니다. 없으면 당신이 Discord에서 URL을 손으로 복사해야 합니다. 또 Anvil이 지울 만한 예전 웹훅을 찾아 줄 때도 필요합니다.',
        },
        {
          term: '역할 관리',
          body: '역할 동기화를 켤 때만 필요합니다. 그러면 매핑한 역할을 나눠줄 수 있고 — 자기보다 위에 있는 역할은 결코 건드리지 못합니다. 이건 Discord의 규칙이지 저희 규칙이 아닙니다.',
        },
        {
          term: '별명 관리',
          body: '별명 동기화를 켤 때만 필요합니다. 멤버의 서버 별명을 RSN으로 맞출 수 있게 합니다.',
        },
        {
          term: '채널 관리',
          body: '드래프트 중 팀별 비공개 채널, 그리고 새 카테고리나 포럼으로 올리는 공략에 쓰입니다. 없어도 나머지 기능은 그대로 작동합니다.',
        },
        {
          term: '스레드 관리, 스레드에서 메시지 보내기',
          body: '포럼에 올리는 공략용: 게시물 안에 글을 쓰고, 나중에 게시물을 삭제하는 데 필요합니다. 이 권한이 없으면 Discord는 봇이 자기 포럼 게시물조차 지우지 못하게 합니다.',
        },
        {
          term: '별명 변경',
          body: '**Connection → Bot appearance in your server**에서 봇에게 클랜 이름을 붙일 때만 필요합니다. 여러분 서버에서의 봇 이름만 바뀝니다.',
        },
      ],
      note: {
        tag: '한 번에 모두 요청합니다',
        body: 'Discord에는 나중에 권한을 요청할 방법이 없어서 초대 링크가 한 묶음을 통째로 요구하고, 당신이 켜지 않는 기능은 그 권한을 결코 쓰지 않습니다. 초대 링크를 다시 여는 것은 누군가 없앤 권한을 복구하는 방법이기도 합니다.',
      },
    },
    connect: {
      title: '연결하기',
      intro: '두 가지, 이 순서대로. 봇이 서버에 있어야 하고, Anvil이 어느 서버가 당신 것인지 알아야 합니다.',
      steps: [
        {
          term: '봇 초대하기',
          body: 'Admin → **Discord** → **Connect your Discord server**(또는 **Add Anvil to Discord**). Discord가 Anvil을 어느 서버에 추가할지 묻고 다시 이곳으로 돌려보내므로, 실수로 엉뚱한 서버에 넣을 일이 없습니다. 나중에 쓸 **Invite / re-invite the bot**은 **More settings → Connection**에 있습니다.',
        },
        {
          term: '서버 ID 설정',
          body: '버튼으로 안 될 때만 필요합니다. **Can’t use the button? Enter the server ID**를 열고, Discord에서 서버 아이콘을 우클릭 → **서버 ID 복사하기**(Discord 자체 설정의 고급에서 개발자 모드를 켜야 합니다)한 뒤, **Your Discord server’s ID**에 붙여넣고 **Save**를 누르세요. 이 항목이 연결을 당신만의 것으로 만듭니다.',
        },
      ],
      after: [
        '그다음 패널은 당신의 의도가 아니라 사실을 알려줍니다. 봇이 실제로 그 서버의 멤버인지, 어떤 권한이 빠졌는지. 거기 초록색 한 줄이 저장된 양식보다 값어치가 있습니다.',
      ],
      note: {
        tag: '서버 ID가 연결의 전부입니다',
        body: 'Anvil에서 서버는 정확히 한 클랜에 속하며, 아무도 연결하지 않은 서버에서 온 슬래시 명령어는 추측되지 않고 거부됩니다. 설정하기 전까지 봇은 초대만 된 채 아무 일도 하지 않습니다.',
      },
    },
    channels: {
      title: '웹훅 설정',
      body: [
        'Anvil은 **웹훅**으로 올립니다. 채널마다 하나씩이고, 전부 선택 사항입니다. 피드를 채널로 향하게 하기 전까지는 아무 데도 아무것도 올라가지 않습니다 — 갓 만든 클랜이 조용한 건 사고가 아니라 설계입니다.',
        'Anvil 봇이 서버에 있다면 **Admin → Discord** 맨 위의 **Set it up for me**가 채널을 만들고 모든 피드를 거기로 연결합니다. 손으로 하려면 **More settings → What goes where**를 열고 **Clan & events** 탭의 **Catch-all channel**부터, 그다음 **In-game (plugin)** 탭의 **In-game catch-all**을 설정하세요. 드롭다운에서 채널을 고르면 바로 저장됩니다. 봇이 없다면 Discord에서 해당 채널의 **채널 편집 → 연동 → 웹후크**를 열어 웹훅을 만들고, URL을 복사한 뒤 드롭다운에서 **Paste a webhook…**을 골라 붙여넣고 **Save**를 누르세요. 웹훅 URL은 채널에 글을 올릴 수 있으므로 비밀번호처럼 다뤄야 합니다. 유출되면 Discord에서 삭제하고 새로 만드세요. **Test**와, 게시량이 많을 때 웹훅 두 개를 번갈아 쓰게 하는 **Add another**는 **Post without a bot** 아래에 있습니다.',
      ],
      feeds: [
        {
          term: '전체 채널',
          body:
            '기본 채널로, **Clan & events** 탭에 있습니다. 이벤트 시작과 종료, 참가 신청 열림, 순위, 주간 결과 등 자체 채널이 없는 사이트의 모든 게시물이 여기에 올라옵니다. 이것만 설정해도 클랜이 정상적으로 작동합니다.',
        },
        {
          term: '인게임 전체 채널',
          body: '**In-game (plugin)** 탭에 있습니다. 자체 채널이 없는 게임 내 항목이 여기로 옵니다. 두 번째로 설정하세요.',
        },
        {
          term: '마일스톤 및 기타',
          body:
            '**In-game (plugin)** 탭에 있습니다. 플레이어가 켜면 슬레이어, 클루, 스피드런, 처치 횟수, BA 도박, 사용자 지정 채팅 메시지가 여기에 게시됩니다. **Filters** 버튼은 클랜이 멤버에게 기본으로 주는 설정을 정합니다. 플레이어 개인 템플릿과 비공개 종류는 [Settings, page by page]({settingsGuide})에 있습니다.',
        },
        {
          term: '분리된 피드',
          body:
            '이벤트 게시물, 함께 운영하는 보드, Skill & boss of the week, 클랜 캘린더 이벤트는 전체 채널에서 분리할 수 있습니다. 희귀 드롭, 펫, 컬렉션 로그, 레벨, 전투 업적, 퀘스트, 일지, 사망, PvP 킬은 인게임 전체 채널에서 분리할 수 있습니다. 로스터 변경, 참가 승인, 금고 장부는 **Staff only**에 있습니다. 비어 있는 분리 피드는 해당 전체 채널을 사용합니다. 금고는 예외로, 비어 있으면 돈 관련 게시물이 전혀 올라가지 않습니다. Leagues 및 기타 모드는 자체 **Game modes** 탭을 사용합니다.',
        },
      ],
      note: {
        tag: '사망부터 떼어내세요',
        body: '대부분의 보드에서 사망은 가장 양이 많은 피드이자 나머지 전부를 묻어버리는 피드입니다. 하나만 떼어낸다면 이걸 떼어내세요.',
      },
    },
    roles: {
      title: '역할과 별명',
      body: [
        '두 동기화는 **Admin → Discord → Roles & nicknames**에서 켜기 전까지 꺼져 있고, 둘 다 명단을 기준으로 움직입니다. **Enable Discord role sync**를 켜고, **Auto-match in-game rank → Discord role by name**은 켠 채로 두고, 필요하면 공통 **Member roles**와 **Guest roles**를 선택한 뒤 저장하고 **Sync roles & nicknames now**를 누르세요. 각 사람은 Discord 계정도 연결해야 합니다. 동기화 보고서에 확인하지 못한 사람의 이름이 나옵니다.',
      ],
      ways: [
        {
          term: '역할 동기화',
          body: '게임 내 등급을 Discord 역할에 매핑하면 Anvil이 둘을 맞춰 둡니다. 멤버, 게스트, 팀장, 진행 중인 이벤트용 단독 역할도 있어서, 손으로 목록을 관리하지 않고도 맞는 사람들을 멘션할 수 있습니다.',
        },
        {
          term: '별명 동기화',
          body: '멤버의 서버 별명을 RSN으로 맞춥니다. 기본적으로는 비어 있는 별명만 채우고, 본인이 정한 별명을 덮어쓰도록 지정할 수도 있습니다 — 이건 나중이 아니라 미리 생각해둘 설정입니다.',
        },
      ],
      note: {
        tag: '봇의 역할이 관리 대상 역할보다 위에 있어야 합니다',
        body: 'Discord는 어떤 봇도 자기와 같거나 높은 역할을 건드리지 못하게 하고, 당신 쪽에서는 조용히 거부됩니다 — 동기화가 그냥 아무 일도 하지 않습니다. **서버 설정 → 역할**에서 Anvil 역할을 위로 끌어올리면 작동하기 시작합니다. 다시 초대할 필요는 없습니다.',
      },
    },
    commands: {
      title: '슬래시 명령어',
      body: [
        '봇은 서버에서 `/bingo`(보드, 순위, 규칙, 내 카드)에 더해 `/sotw`, `/stats`, `/coffer` 같은 클랜 명령어에도 응답합니다. 모두 사이트의 실시간 정보를 읽으므로, 자기 순위를 보려고 Discord를 떠날 필요가 없습니다. [모든 명령어와 옵션]({commandsGuide})은 별도 페이지에 정리되어 있습니다.',
        '봇이 들어온 뒤 1분쯤 지나 나타납니다. 아예 나타나지 않는다면 그 초대가 봇은 허용했지만 명령어는 허용하지 않은 것입니다 — 둘은 별개의 권한이고, 오래된 초대 링크는 한쪽만 요청했습니다. Discord 페이지의 **Connection**에서 **Invite / re-invite the bot**을 다시 실행하세요. 봇이 쫓겨나거나 무언가 초기화되지는 않습니다.',
      ],
      note: {
        tag: '각자의 언어로 답합니다',
        body: '기본적으로 봇은 해당 멤버가 Discord에 설정한 언어로 답하고, 영어로 폴백합니다. **봇 언어**에서 하나를 고르면 모두에게 그 언어를 강제할 수 있습니다 — Discord에 감지할 아랍어 클라이언트 언어가 없기 때문에, 아랍어를 쓰는 유일한 방법이기도 합니다.',
      },
    },
    posts: {
      title: '무엇을 언제 올리는가',
      body: [
        '출처는 둘이고, 뭔가 이상해 보일 때 어느 쪽인지 아는 게 도움이 됩니다.',
        '**사이트**는 이벤트를 올립니다: 보드 공개, 신청, 시작, 순위, 결과. 이건 Anvil 자체에서 나가므로 누가 플러그인을 쓰든 말든 작동합니다.',
        '**플러그인**은 게임에서 일어난 일을 올립니다: 드롭, 펫, 사망, 레벨, 컬렉션 로그 칸, 컴뱃 어치브먼트. 이건 플러그인을 켠 멤버에게만 존재하므로, 드롭 채널이 조용하다면 대개 웹훅이 망가진 게 아니라 플러그인이 조용한 것입니다.',
      ],
      note: {
        tag: '두 번 올라가지 않습니다',
        body: '칸을 완성한 드롭은 게시물 하나입니다. 플러그인에서 하나, 보드에서 또 하나가 아닙니다.',
      },
    },
    modes: {
      title: 'Leagues, Deadman 등 다른 모드',
      body: [
        'Leagues, Deadman, hardcore 등 다른 모드는 자체 월드와 자체 캐릭터로 진행됩니다. 이 모드의 게시물은 항상 라벨이 붙으며, 보드나 대회에는 포함되지 않습니다. 전용 탭이 있습니다: **Admin → Discord → What goes where → Game modes**. 멤버가 해당 모드를 처음 플레이하면 그곳에 나타납니다.',
        '각 모드에는 스위치와 **To** 채널이 있습니다. 전용 채널을 사용하려면 **Send game-mode posts to their own channels**를 켜세요. 끄면 모든 모드가 일반 채널에 라벨과 함께 게시됩니다. 모드 행의 **Posts** 버튼을 누르면 해당 모드가 보내는 모든 종류(일반 종류와 모드 전용 이벤트)가 나오고, 각각 개별 스위치가 있습니다.',
        '그 목록 아래의 **Custom thresholds**로 모드가 메인 게임보다 적게 게시하도록 설정할 수 있습니다. **Post drops rarer than 1 in…**(2 이상)과 **Post drops worth at least (gp)**(1,000 이상)로 자체 하한을 정하고(비워 두면 메인 게임과 동일), **Save drop thresholds**를 누르세요. 항상 게시되는 아이템은 계속 게시되지만, 가치로만 조건을 충족하는 드롭은 게시되지 않습니다. **Use its own level milestones**는 두 규칙 세트를 모두 만족하는 경우에만 레벨업을 게시합니다.',
      ],
      note: {
        tag: '더 엄격하게만, 느슨하게는 안 됨',
        body: '모드 필터는 게시물을 덜어낼 수만 있습니다. 플러그인이 이미 메인 게임 설정을 적용했으므로, 모드 필터가 무엇을 하든 게시물을 되살릴 수는 없습니다.',
      },
    },
    cleanup: {
      title: '다른 플러그인이나 봇의 예전 웹훅',
      body: [
        '봇이 서버에 있으면 Discord 페이지에 Anvil 것이 아닌 웹훅이 전부 나열됩니다. **Coming from other plugins?**에는 **Use the same channels**가 있어서, **Set it up for me**가 예전 피드가 올리던 곳에 그대로 게시하고 멤버 입장에서는 아무것도 바뀌지 않습니다.',
        '멤버들이 Anvil로 옮겨 왔다면 **Remove old webhooks from other plugins**로 가서 지울 것을 체크하고 **Remove … webhooks**를 누른 다음 **Yes, remove them**을 누르세요. Discord에서 영구히 삭제됩니다 — 되돌릴 수 없습니다.',
        '이 목록에는 다른 플러그인 것만이 아니라 Anvil 것이 아닌 웹훅이 모두 들어갑니다. 다른 봇의 피드처럼 남겨 두고 싶은 게 있나요? **Keep**을 누르면 목록에서 빠지고, **Show kept**와 **Put back**으로 다시 돌려놓을 수 있습니다. Keep은 여기서 숨기기만 할 뿐 — Discord에서는 아무것도 바뀌지 않습니다.',
      ],
      note: {
        tag: '웹후크 관리 권한 필요',
        body: '봇은 서버의 웹훅을 읽어서 찾아냅니다. 봇 역할에 _웹후크 관리_ 권한이 없으면 페이지에 웹훅을 볼 수 없다고 나옵니다.',
      },
    },
    announce: {
      title: 'Discord에 게시하기',
      body: [
        '관리자는 관리 메뉴의 **Clan** 아래에 있는 **Post to Discord**에서 봇으로 게시할 수 있습니다. **Channel**을 고르고, **Message**를 쓰고, **Send message**를 누르세요. 규칙집처럼 긴 글은 알아서 여러 메시지로 나뉩니다.',
        '**Send as an embed**는 기본으로 켜져 있고, 선택 사항인 **Title**과 **Accent colour**를 추가합니다. 일반 텍스트로 보내려면 끄세요. **Ping**으로 멘션할 역할이나 @everyone을 고를 수 있고, Anvil은 보내기 전에 한 번 확인합니다.',
        '보낸 게시물은 모두 **Sent from here**에 나열됩니다. **Edit**는 다시 멘션하지 않고 Discord에서 내용을 고치고, **Delete**는 게시물을 지웁니다.',
      ],
      note: {
        tag: '관리자 전용, 봇 필요',
        body: 'Anvil 봇으로 게시하므로 먼저 서버를 연결하세요. 모더레이터에게는 보이지 않습니다. **Clan settings → Features**의 **Post to Discord** 스위치로 켜고 끄며, 끄면 메뉴에서 사라집니다.',
      },
    },
    quiet: {
      title: '조용해졌을 때',
      body: [
        '순서대로. 각 항목이 다음 항목을 배제하기 때문입니다:',
      ],
      checks: [
        {
          term: '봇이 정말 서버에 있습니까?',
          body: 'Discord 페이지의 **Connection**이 바로 알려줍니다. "토큰 유효"와 "서버에 있음"은 다른 사실이고, 앞이 뒤를 뜻하지 않습니다 — 공유 봇에서는 토큰이 언제나 유효합니다.',
        },
        {
          term: '서버 ID가 맞습니까?',
          body: '틀렸지만 실재하는 ID는 맞는 것과 똑같아 보입니다. 게시물이 다른 곳으로 가고 있다는 걸 알아차리기 전까지는요.',
        },
        {
          term: '웹훅이 아직 있습니까?',
          body: 'Discord 채널을 지우면 그 웹훅도 사라지는데, Anvil은 죽은 URL을 그대로 들고 있습니다. **What goes where**에서 채널을 다시 고르세요.',
        },
        {
          term: '봇의 역할이 충분히 위에 있습니까?',
          body: '역할과 별명 동기화에만 해당합니다 — 위 참고. 조용히 실패하는 게 바로 이겁니다.',
        },
      ],
      note: {
        tag: '새로 들어온 사람을 맞이할 수는 없습니다',
        body: 'Discord는 입장 사실을 gateway 연결로만 알려주는데, 공유 봇은 모든 서버에 대해 그 연결을 유지하지 않습니다. 그래서 "환영" 게시물은 없습니다 — 대신 신청 링크를 #역할이나 #시작하기 채널에 두세요. 어차피 사람들이 보는 곳이 거깁니다.',
      },
    },
    drops: {
      title: '드롭 기준',
      body: [
        'Anvil은 **1m gp** 또는 **1 in 1,000**에서 시작합니다. 드롭은 둘 중 하나를 충족하면 게시됩니다. 누구도 이보다 낮게 설정할 수 없으며, 0으로 하면 해당 기준을 끕니다.',
        '**Admin → Discord → What goes where → Drops**에서 클랜 기본값을 설정하세요: **Default minimum drop value (gp)**, **Default: post drops rarer than 1 in…**, **Require both**. **Require both**를 켜면 드롭은 가치 **and** 희귀도를 모두 충족해야 합니다.',
        '각 캐릭터는 소속 클랜의 기본값을 따르며, 클랜이 없으면 Anvil 기본값을 따릅니다. 플레이어는 **Settings**에서 자신의 수치를 고를 수 있습니다. **Using clan default** 또는 **Custom**이 표시되며, **Reset**을 누르면 기본값으로 돌아갑니다.',
        '**Hard floor: never post drops more common than 1 in…**는 엄격한 기준입니다. 멤버는 클랜 채널에서 이보다 느슨하게 설정할 수 없습니다. 개인 webhook은 가능합니다.',
      ],
      note: {
        tag: '플레이어 쪽 자세한 내용',
        body: '플레이어 자신의 수치, 템플릿, webhook은 [Settings, page by page]({settingsGuide})에 있습니다.',
      },
    },
    pools: {
      title: '바쁜 채널을 위한 추가 webhook',
      body: [
        'webhook 하나가 보낼 수 있는 속도에는 한계가 있습니다. 바쁜 이벤트에서는 같은 채널에 webhook을 더 추가하세요. **Busy channel? Let the bot add … more webhooks**(**Manage Webhooks** 권한 필요)를 누르거나, 채널 상자에 webhook 링크를 여러 개 붙여 넣으세요. Anvil은 플레이어가 50명 이상이거나, 분당 게시가 많거나, Discord가 최근 “slow down”을 보냈을 때 더 추가하라고 제안합니다. 최대 10개면 충분합니다.',
        'Anvil은 webhook들을 번갈아 사용합니다. 한 webhook에 Discord가 “slow down”을 보내면 그 webhook은 잠시 쉬고 다음 webhook이 게시합니다. 삭제되었거나 작동하지 않는 webhook은 10분 동안 건너뜁니다. 작동하는 webhook이 하나라도 있으면 게시는 계속됩니다.',
        '모든 webhook은 같은 채널을 가리켜야 합니다. 그렇지 않으면 Anvil이 경고합니다. 하나를 확인하려면 **Test**를, 제거하려면 **Stop posting here**를 사용하세요.',
      ],
      note: {
        tag: '같은 채널, 같은 게시물',
        body:
          'webhook을 더 추가해도 같은 게시물이 두 번 올라가지 않습니다. 작업만 나눠 맡습니다. 같은 개념이 위의 [Drop thresholds](#drops)와 관리자 측 [Running the event]({adminGuide})에도 있습니다.',
      },
    },
  },

  plugin: {
    metaTitle: 'RuneLite 플러그인 설정 — Anvil',
    metaDescription:
      'Anvil RuneLite 플러그인을 설치하고, 사이드 패널에서 로그인한 뒤, Discord 알림을 설정합니다.',
    eyebrow: 'Anvil · RuneLite 플러그인',
    title: '플레이어용 설정 가이드',
    dek: '설치하고, 로그인하고, 플레이하세요. 플러그인이 빙고 드롭을 제출하고, 희귀 드롭과 사망, 주요 달성을 Discord에 올리며, 우클릭 한 번으로 누구든 조회할 수 있게 해 줍니다.',
    facts: [
      { strong: '버튼 1개', rest: '면 기록이 시작됩니다' },
      { strong: '약 3분', rest: '기본 설정에 걸리는 시간' },
      { strong: '우클릭', rest: '한 번으로 누구든 조회' },
    ],
    footnote:
      '스크린샷은 실제 설정 환경에서 찍은 것입니다 —— 계정 토큰은 의도적으로 가렸습니다. 여러분의 것도 그만큼 비공개로 두셔야 합니다.',

    install: {
      title: '플러그인 설치하기',
      body: [
        'RuneLite에서: **Configuration**(렌치 아이콘) → **Plugin Hub** → **Anvil** 검색 → **Install**. 게시자는 `AhmedFathy2001`입니다.',
        '플러그인 하나가 모든 클랜을 담당합니다 —— 항상 `anvilosrs.com`에 연결되고, 당신과 당신의 클랜에 묶어 주는 것은 로그인(다음 단계)입니다. 클랜별로 받을 것도, 입력할 주소도 없습니다. 설치하면 RuneLite 사이드바에 **Anvil** 버튼이 나타나고, 설정은 **Configuration → Anvil**에 있습니다.',
      ],
    },

    connect: {
      title: '로그인',
      intro: 'RuneLite 사이드바에서 **Anvil** 패널을 열고 **Sign in with Discord**를 누르세요. 브라우저에서 `anvilosrs.com`이 열리면 거기서 코드를 승인하세요. 그러면 플러그인이 스스로 로그인합니다 —— 입력할 것도, 복사할 것도, 설정에서 채울 것도 없습니다.',
      panelFigure: {
        caption: 'RuneLite → Anvil 버튼',
        alt: 'RuneLite 사이드바 아이콘 줄에서 맨 아래 Anvil 버튼을 표시한 모습',
        legend: [
          {
            label: 'Anvil 버튼',
            body: 'RuneLite 창 옆, 아이콘 줄 맨 아래에 있습니다. 누르면 패널이 열립니다. 플러그인을 설치하고 켜면 바로 나타나며, 위쪽에 두고 싶다면 줄에서 위로 끌어 올리면 됩니다.',
          },
        ],
      },
      signInFigure: {
        caption: 'Anvil 패널',
        alt: 'Sign in with Discord 버튼과 연결되는 사이트를 표시한 Anvil 패널',
        legend: [
          {
            label: 'Sign in with Discord',
            body: '이 컴퓨터가 로그아웃된 동안에만 보입니다. 누르면 나머지는 브라우저에서 진행됩니다.',
          },
          {
            label: 'Connects to',
            body: '항상 `anvilosrs.com`입니다 —— 플러그인이 통신하는 유일한 사이트이자, 당신의 토큰이 속한 사이트입니다.',
          },
          {
            label: 'Paste a token instead',
            body: '브라우저 단계가 되지 않을 때의 대안입니다 —— 이 단계의 끝부분을 보세요.',
          },
        ],
      },
      easySteps: [
        '**Sign in with Discord**를 누릅니다. 패널에 짧은 코드가 나타나고 브라우저에서 `anvilosrs.com`이 열립니다.',
        '아직 로그인하지 않았다면 거기서 Discord로 로그인하고, 페이지의 코드가 RuneLite에 표시된 코드와 같은지 확인한 뒤 **Approve**를 누릅니다.',
        'RuneLite로 돌아오면 패널 상단에 _Signed in_ 이라고 나오고, 게임에 로그인하면 어떤 캐릭터를 추적 중인지도 표시됩니다. 끝입니다.',
      ],
      linkFigure: {
        caption: 'anvilosrs.com → /link-device',
        alt: 'Link your RuneLite client 페이지. 코드 입력란과 Approve 버튼이 네모로 표시되어 있음',
        legend: [
          { label: '그 코드', body: '지금 플러그인이 보여 주고 있는 것과 반드시 일치해야 합니다.' },
          {
            label: 'Approve',
            body: '_본인의_ 클라이언트가 표시하고 있는 코드만 승인하세요. 누군가가 링크나 코드를 보내왔다면 거절하십시오 —— 승인은 계정을 넘겨주는 것과 같습니다.',
          },
        ],
      },
      directNote: {
        tag: '이 일이 어디서 일어나는가',
        body: [
          '이 흐름 전체가 `anvilosrs.com` 안에서 끝납니다 —— 코드는 거기서 발급되고, 당신의 Discord 로그인으로 거기서 승인되며, 토큰은 곧바로 플러그인으로 돌아갑니다. 플러그인은 `anvilosrs.com`의 로그인 페이지만 열기 때문에, 다른 곳을 가리키는 로그인 링크는 플러그인이 보낸 것이 아닙니다.',
        ],
      },
      federationAside:
        '사이드 패널의 **Connect clans**와 혼동하지 마세요 —— 그것은 다른 Anvil 클랜과 연결해 주는 별개의 선택 버튼이며, 여기에 이미 로그인한 뒤에야 나타납니다.',
      manualFallback:
        '브라우저가 저절로 열리지 않으면 패널이 주소와 코드를 표시하니 직접 여시면 됩니다. 코드는 10분 뒤 만료됩니다 —— 버튼을 한 번 더 누르면 됩니다.',
      manualHeading: '대안: 토큰을 직접 붙여넣기',
      manualIntro:
        '플러그인에서 로그인이 되지 않으면, 아래의 토큰을 복사한 뒤(또는 [Profile → plugin token](/profile#plugin-token)에서 — 거기서 교체도 할 수 있습니다) Anvil 패널의 로그인 버튼 아래에 있는 **Paste a token instead**를 눌러 거기에 붙여넣으세요.',
      tokenFigure: {
        caption: 'Profile → RuneLite plugin',
        alt: '프로필 페이지의 RuneLite plugin 카드. 토큰 입력란과 Reveal·Copy·Rotate 버튼이 네모로 표시되어 있음',
        legend: [
          {
            label: '당신의 토큰',
            body: 'Reveal을 누르기 전까지는 가려져 있습니다. 이 스크린샷에서는 일부러 가렸습니다. 본인 것을 Discord에 절대 올리지 마세요.',
          },
          {
            label: 'Copy / Rotate',
            body: '복사한 다음 Anvil 패널에서 **Paste a token instead**를 사용하세요. Rotate는 새 토큰을 발급하고 기존 것을 무효화합니다 —— 유출이 의심되면 언제든 쓰세요.',
          },
        ],
      },
      goodToKnow: {
        tag: '평소에는 사이드 패널 사용',
        body: ['**Anvil 사이드 패널이 기본 작업 공간입니다**. 여기에서 로그인과 로그아웃을 하고, 클랜과 진행 중인 이벤트를 확인하고, 칸을 둘러보고 신청하고, 진행 상황을 추적하고, 시작 스크린샷을 찍고, 동기화와 지원 도구를 실행하세요. 아래의 **Configuration → Anvil**은 환경 설정을 바꿀 때만 사용하며, 토큰은 없습니다. 이 컴퓨터에서 로그아웃하려면 패널 상단의 이름 옆에 있는 **⋯** 메뉴를 여세요. 한 번 로그인하면 신청한 모든 이벤트에 적용되며 빙고마다 다시 할 필요가 없습니다.'],
      },
    },

    accounts: {
      title: '계정 연결하기',
      body: [
        '토큰을 설정하면 플레이한 계정이 프로필에 자동으로 표시됩니다. 새 계정은 바로 연결할 수 있지만, 이미 클랜 명단에 있는 계정은 먼저 한 번의 소유권 확인이 필요합니다. 공개된 RuneScape 이름만으로는 소유자를 증명할 수 없기 때문입니다.',
        '첫 연결에는 [빠른 XP 확인](/profile#link-account)을 사용하거나 클랜 관리자에게 [감지된 계정](/profile#detected-accounts)에서 승인해 달라고 요청하세요. 확인 후에는 안정적인 계정 지문이 이름 변경을 따라가며 계정을 자동으로 인식합니다.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: '프로필 페이지의 RuneScape Accounts 카드. 플러그인으로 확인된 계정들이 나열되어 있음',
        legend: [
          {
            label: '연결된 계정들',
            body: '“Verified via plugin” 표시가 있는 계정은 연결되어 이후 자동으로 인식됩니다. 기존 클랜 명단 계정은 먼저 일회성 XP 확인이나 관리자 승인이 필요할 수 있습니다.',
          },
        ],
      },
      noPluginHeading: '플러그인을 돌릴 수 없다면?',
      noPluginIntro:
        '모바일이나 공식 클라이언트에서는 대신 [Profile → account linking](/profile#link-account)을 사용하세요:',
      noPluginOptions: [
        '**Verify by XP** —— RSN을 입력하면 사이트가 스킬 하나를 무작위로 고릅니다. 30분 안에 그 스킬에서 1,000 경험치를 올리면 됩니다.',
        '**Manual review** —— Hiscores를 숨겼거나 갓 만든 부계정인 경우: RSN과 메모를 제출하면 관리자가 승인합니다.',
      ],
      signupNote:
        '이벤트 신청에는 확인된 계정이 최소 하나 필요하니, 신청 전에 미리 해 두세요.',
    },

    working: {
      title: '제대로 도는지 확인하기',
      intro:
        '접속해서 채팅창을 보세요. 연결이 되어 있고 이벤트가 진행 중이면 플러그인이 인사를 건넵니다.',
      chat: [
        { text: 'Bingo running: Summer Bingo 2026.', tone: 'gold' },
        { text: 'Skill of the Week is live: Runecraft.', tone: 'gold' },
        { text: '……그 뒤로, 일이 벌어질 때마다……', tone: 'muted' },
        { text: 'Tracked drop detected: Dragon warhammer (1/1)', tone: 'plain' },
        { text: 'Tracked kill: Zulrah (7/10)', tone: 'plain' },
      ],
      outro:
        '**Anvil 사이드 패널**도 소속 클랜, 진행 중인 이벤트, 내 순위, 동기화 버튼으로 채워집니다. 그리고 게임 내 Collection Log 제목 표시줄에 **Anvil** 버튼이 나타납니다.',
      guestNote: {
        tag: '게스트와 멤버의 차이',
        body: '채팅에 _Tracked as a guest_ 라고 뜨면 기록은 되고 있지만 아직 클랜 멤버 명단에는 없다는 뜻입니다. 관리자가 게임 내 클랜 명단을 동기화하면 해결됩니다 —— {discordLink} 물어보세요.',
        discordWord: 'Discord에서',
      },
      panelHeading: '사이드 패널',
      panelBody: [
        '탭 네 개와 톱니바퀴 하나. **Clan**은 내 이벤트와 클랜입니다: 진행 중이거나 예정된 모든 빙고와 주간 대회에서의 내 순위. **Feed**는 클랜과 보드의 큰 순간을 일어나는 대로 보여 주고, 이벤트 채팅도 있습니다. **You**는 내 프로필이고, **Lookup**에서는 다른 누구든, 플레이어든 클랜이든 찾을 수 있습니다. 톱니바퀴에는 동기화와 배너 사운드가 있습니다.',
        '모든 탭, 이벤트 채팅, 반응, 그리고 피드와 Supporter 색을 게임 안에 띄우는 설정은 [사이드 패널, 탭별로 보기]({panelGuide})에 있습니다.',
      ],
      panelFigure: {
        caption: 'Clan · You · Lookup',
        alt: 'Anvil 사이드 패널의 세 탭을 나란히 놓은 모습. 이벤트와 클랜의 이번 주가 보이는 Clan 탭, 내 컬렉션 로그가 보이는 You 탭, 다른 플레이어의 카드를 보여 주는 Lookup 탭',
      },
      lookupHeading: '누구든 찾아보기',
      lookupBody:
        '플레이어를 우클릭하세요 — 바로 옆에 있는 플레이어든, 채팅·친구 목록·클랜 패널의 이름이든 상관없습니다. **Anvil**을 고르면 그 플레이어의 카드가 사이드 패널의 **Lookup** 탭에서 열립니다. 내 것은 **You** 탭입니다.',
      lookupFigure: {
        caption: '이름 우클릭 → Anvil',
        alt: '게임 속 플레이어 우클릭 메뉴. Lookup 아래에 Anvil 항목이 있다',
      },
      lookupSettingNote:
        '플러그인 설정의 **Player lookup**에서 **Anvil** 항목이 어디에 나타날지 고르세요. 채팅 속 이름에서는 절대 좌클릭 기본 동작이 되지 않으므로, 이름을 클릭하면 여전히 게임 본래의 동작이 실행됩니다.',
      lookupSettingFigure: {
        caption: 'Configuration → Anvil → Player lookup',
        alt: 'Anvil 설정의 Player lookup 영역. 각 설정이 네모로 표시되고 번호가 매겨져 있음',
        legend: [
          {
            label: 'Anvil lookup on players',
            body: '마스터 스위치. 끄면 어디에서도 항목이 보이지 않습니다.',
          },
          {
            label: 'Players in the world',
            body: '근처에 서 있는 플레이어를 우클릭할 때.',
          },
          {
            label: 'Chatbox and private messages',
            body: '채팅창과 개인 채팅에 나오는 이름.',
          },
          {
            label: 'Clan panels / Friends chat / Friends, ignore and party lists',
            body: '이름 목록: 내 클랜과 게스트 클랜 멤버, 프렌즈 채팅 채널, 친구 목록과 차단 목록, 레이드 파티 패널.',
          },
        ],
      },
    },

    bingo: {
      title: '빙고 설정',
      intro:
        '이 설정들은 이벤트에 참여하는 동안에만 의미가 있습니다. 기본값이면 충분합니다 —— 아래는 각 항목이 실제로 하는 일입니다.',
      figure: {
        caption: 'Configuration → Anvil → Bingo',
        alt: '플러그인 설정의 Bingo 영역. 각 설정이 네모로 표시되고 번호가 매겨져 있음',
        legend: [
          {
            label: 'Show Overlay',
            body: '왼쪽 위에 _Anvil / 팀 / UTC 날짜_ 라는 작은 패널을 그립니다. 이것이 증빙 스크린샷 그림의 일부가 되고, 바로 그 점이 증빙을 위조하거나 날짜를 소급하기 어렵게 만듭니다. 이 스크린샷에서는 꺼져 있습니다 —— 모든 증빙에 팀과 시각이 보이길 원하는 클랜이라면 켜세요.',
          },
          {
            label: 'Team completion popups',
            body: '팀원 중 누군가가 칸을 완료하면 배너를 띄웁니다. 여러 개가 동시에 나오면 가장 어려운 것이 배너를 차지하고 나머지는 채팅으로 갑니다.',
          },
          {
            label: 'My tile popups',
            body: '내 드롭이 칸을 진행시키거나 완료하면 팝업을 띄웁니다. 꺼도 기록은 계속됩니다 —— 조용히 할 뿐입니다.',
          },
          {
            label: 'Banner sound + volume',
            body: '배너와 함께 소리를 재생합니다. Anvil 사이드 패널의 “Banner sounds”에 있는 **Add clip**으로 .wav를 직접 하나 이상 추가하기 전에는 아무 소리도 나지 않습니다. 미션에는 전용 폴더가 있습니다. **Mission sounds** 에서 클립을 추가하면 완료된 타일과 구분해 주는 기본 효과음 대신 그 클립이 재생됩니다.',
          },
          {
            label: 'Auto starting shot',
            body: '이벤트의 핀으로 고정된 지점에 서는 순간 시작 인증샷을 대신 찍어 줍니다. 끄면 사이드 패널의 **Take starting shot**을 직접 누르면 됩니다.',
          },
        ],
      },
      teamsHeading: '팀',
      teamsBody:
        '이벤트의 **Teams** 버튼을 누르면 팀들이 순위대로 나오고, 내 팀이 맨 위에 옵니다. 팀을 열면 주장을 맨 앞으로 한 명단이 보이고, 모든 팀에서 플레이어를 검색할 수도 있습니다 —— 이름을 클릭하면 그 플레이어를 찾아볼 수 있습니다.',
      teamsFigure: {
        caption: '이벤트 → Teams',
        alt: '이벤트의 팀들을 점수와 인원수와 함께 보여 주는 Teams 페이지, 그리고 주장이 맨 앞에 있는 한 팀의 명단',
      },
      startHeading: '시작 인증샷',
      startBody: [
        '어떤 이벤트는 모두에게 **시작 인증샷**을 요구합니다: 이벤트가 시작된 뒤, 시작 순간에 추첨된 장소에서 찍은 스크린샷 한 장입니다. 이것이 있으면 아무도 이벤트 전 일주일 동안 단서와 상자와 처치를 쌓아 두었다가 첫날에 쏟아붓지 못합니다.',
        '플러그인을 돌리고 있다면 준비할 것은 없습니다. 이벤트가 시작되면 어디로 가야 하는지 채팅으로 안내가 오고, Anvil 사이드 패널에 **Take starting shot** 버튼이 나타납니다. 안내된 곳에 서서 한 번 누르면 끝 —— 플러그인이 화면을 찍고 RSN, 팀, 장소, 그리고 당신 계정에만 주어지는 암호를 새겨 넣은 뒤 대신 보관해 줍니다.',
        '무언가를 보관하기 전에 두 가지를 확인합니다. 나중에 Discord에서 다투는 대신 게임 안에서 고칠 수 있도록 말이죠. 주최자가 지도에 장소를 찍어 두었다면 플러그인은 당신이 얼마나 떨어져 있는지 알고 알려 줍니다 —— Gielinor 반대편에서 찍은 사진을 보내는 대신에요. 그리고 이벤트가 새 세션을 요구한다면 찍기 전에 **로그아웃했다가 다시 접속**해야 합니다: hiscores는 로그아웃할 때만 저장되므로, 촬영 직전의 재접속이야말로 시작 시점 수치 —— 나아가 모든 경험치·처치 수 칸 —— 을 정확하게 만듭니다.',
        '모바일이거나 플러그인이 없다면: 이 사이트에서 **My Team**을 열고 시작 인증샷 카드에서 암호를 읽은 뒤, 게임 채팅창에 입력하고, 캐릭터와 암호가 함께 보이도록 스크린샷을 찍어 같은 카드에서 업로드하세요. 이 업로드는 즉시 인정됩니다 —— 올리는 순간부터 플레이할 수 있고, 운영진은 나중에 확인합니다. 카드가 요구한다면 먼저 로그아웃했다가 다시 접속하세요.',
      ],
    },

    notifications: {
      title: 'Discord 알림',
      intro:
        '이 알림들은 빙고가 진행 중이든 아니든 나가며, 클랜 채널에 올라갑니다. 어느 채널인지는 관리자가 여기서 정합니다 —— 당신은 _무엇을_ 올릴지만 고릅니다. 다음 플러그인 업데이트부터 이 선택들은 웹사이트의 **Settings → Discord posts & screenshots** 로 옮겨지고, 어느 컴퓨터에서든 그대로 따라옵니다. 같은 페이지의 **Screenshot privacy** 에서는 플러그인이 찍는 모든 스크린샷에서 숨길 채팅(개인 메시지, 공개 채팅, 클랜 채팅)을 고를 수 있습니다. 플러그인에는 **Notifications** 아래 스위치 두 개가 남습니다: **Share clan posts** 는 메인 게임 게시물을 한꺼번에 멈추고, **Share seasonal activity** 는 Leagues, Deadman 등 시즌 월드에서 같은 일을 합니다.',
      examplesFigure: {
        caption: '게시물은 이렇게 보입니다',
        alt: 'Anvil이 올린 Discord 게시물 두 개. 점수와 다음 해금까지의 진행도가 표시된 Grandmaster 전투 과제, 그리고 메시지가 담긴 사망 알림. 둘 다 그 순간의 스크린샷이 붙어 있음',
      },
      dropsFigure: {
        caption: 'Deaths & kills · Drops & pets',
        alt: 'Deaths and kills와 Drops and pets 알림 영역. 각 설정이 네모로 표시되고 번호가 매겨져 있음',
        legend: [
          {
            label: 'Notify on death',
            body: '사망 순간의 스크린샷과 함께 클랜 사망 채널에 게시됩니다.',
          },
          {
            label: 'Death message',
            body: '직접 작성하는 문구입니다. `{name}`은 RSN으로 바뀝니다.',
          },
          {
            label: 'Notify on PvP kill',
            body: '대상의 HP가 0이 되는 틱의 스크린샷입니다. 기본값은 꺼짐이며, 여기서는 켜져 있습니다.',
          },
          {
            label: 'Notify on rare drops',
            body: '드롭 게시의 전체 스위치입니다.',
          },
          {
            label: 'Min drop value / Min drop rarity',
            body:
              '드롭은 이 금액 이상의 가치(GE 또는 high alch 중 더 높은 값)가 있거나 1-in-N보다 희귀하면 게시됩니다. Anvil은 1m과 1/1,000에서 시작합니다. 클랜은 멤버용 기본값을 설정할 수 있으며, 직접 숫자를 정하기 전까지는 클랜 값을 따릅니다. **Reset to clan default**(클랜이 없으면 **Reset to Anvil default**)를 누르면 다시 클랜 값을 따릅니다. 클랜은 클랜 채널 게시물에만 적용되는 엄격한 희귀도 하한도 설정할 수 있습니다. 그곳에서는 자신의 숫자를 그보다 느슨하게 설정할 수 없으며, 가치 상한은 바뀌지 않습니다. 두 숫자 모두 0으로 설정하면 끌 수 있습니다.',
          },
          {
            label: 'Value and rarity together',
            body:
              '기본적으로 드롭은 가치 **or** 희귀도를 충족하면 게시됩니다. **Require both**를 켜면 가치 **and** 희귀도를 모두 충족해야 합니다. 클랜은 멤버용으로 이 기본값을 선택할 수 있습니다. 직접 선택하기 전까지는 클랜을 따르며, 클랜이 없으면 둘 중 하나입니다. 개인 webhook마다 자체 최소 가치, 희귀도, either/both를 설정할 수도 있으며, 비워 둔 항목은 개인 설정을 따릅니다.',
          },
          {
            label: 'Loot key value',
            body: '루트 키는 전체 내용물의 합계가 이 숫자를 넘으면 한 번, 단일 알림으로 게시됩니다.',
          },
          {
            label: 'Notify on pets',
            body: '펫은 희귀 드롭 채널에 게시됩니다.',
          },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · collection log · levels · diaries · quests',
        alt: 'Combat achievements 알림 영역. 각 설정이 네모로 표시되고 번호가 매겨져 있음',
        legend: [
          {
            label: 'CA post tier',
            body: '올라가는 가장 낮은 과제 등급. 등급 달성도 함께 올라갑니다. 기본값은 Master이고, Grandmaster는 가장 희귀한 것만, **Off**는 아무것도 올리지 않습니다. 빙고 CA 칸은 어느 쪽이든 집계됩니다.',
          },
          {
            label: 'Notify on collection log slots',
            body: '새 컬렉션 로그 슬롯이 채워질 때마다.',
          },
          {
            label: 'Notify on level milestones',
            body: '클랜이 알리기로 정한 레벨업 —— 기본값은 99 달성, 1800부터 총 레벨 100 단위, 그리고 만렙. 규칙은 클랜 관리자가 정하지만, 프로필의 Announcements에서 더 적게 올리도록 바꾸거나 개인 웹훅용 규칙을 직접 정할 수 있습니다.',
          },
          {
            label: 'Notify on diary completions',
            body: 'achievement diary 등급. 스크린샷 포함.',
          },
          {
            label: 'Quest post tier',
            body: '고른 난이도 이상의 퀘스트. All(모든 퀘스트)부터 Grandmaster까지 고를 수 있고, **Off**는 아무것도 올리지 않습니다. 기본값은 Master입니다. 빙고 퀘스트 칸은 어느 쪽이든 집계됩니다.',
          },
        ],
      },
    },

    trouble: {
      title: '무언가 고장 났을 때',
      intro:
        '기록이 멈추면 플러그인이 채팅으로 알려 줍니다 —— 불평하기까지 약 90초를 기다리고, 아무리 자주 해도 5분에 한 번만 반복합니다.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: '토큰이 틀렸거나 교체되었습니다. Anvil 패널 상단의 **⋯** 메뉴를 열고 **Sign out**을 누른 뒤 다시 **Sign in with Discord**를 누르세요 —— 또는 [Profile → RuneLite plugin](/profile#plugin-token)의 새 토큰으로 **Paste a token instead**를 사용하세요.',
        },
        {
          term: '`Anvil: can’t reach the site (anvilosrs.com) — tracking is OFF.`',
          body: '플러그인이 `anvilosrs.com`에 닿지 못하고 있습니다. 인터넷 연결과, RuneLite를 막고 있을 수 있는 방화벽이나 VPN을 확인하세요. 모두 정상이라면 사이트가 잠시 내려갔을 가능성이 큽니다 —— 플러그인이 알아서 다시 연결합니다.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: '그 계정은 아직 연결되지 않았습니다. [Profile → 감지된 계정](/profile#detected-accounts)을 열어 추가하거나 소유권 확인을 시작하세요.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: '아무것도 하지 않아도 됩니다. 알아서 복구되었습니다.',
        },
        {
          term: '“<RSN> belongs to another Anvil player”',
          body: '다른 사람이 먼저 Anvil에 이 캐릭터를 연결해서, 당신의 로그인으로는 아무것도 집계되지 않습니다. 정말 당신 캐릭터라면 패널의 **You** 탭에서 **This is my account**를 누르고 간단한 XP 확인을 통과하세요. 그러면 현재 소유자에게 묻거나 Anvil 스태프가 결정합니다. 상대가 누구인지는 알 수 없습니다. 진행 상황은 [Settings → Ownership claims](/settings/claims)에서 확인하세요.',
        },
      ],
      logHeading: '그래도 막혔다면 관리자에게 로그를 보내세요',
      logBody:
        'RuneLite 로그를 관리자에게 보내세요: 사용자 폴더 안 `.runelite/logs` 폴더에 있는 `client.log`입니다(Windows에서는 파일 탐색기 주소 표시줄에 `%USERPROFILE%\\.runelite\\logs`를 붙여넣으세요). 플러그인이 무엇을 봤고 왜 그렇게 판단했는지를 거기에 기록하므로, 무엇이 잘못됐는지 정확히 볼 수 있습니다.',
      missingNote: {
        tag: '증빙이 안 보인다면?',
        body: '펫과 중복 Champion’s scroll은 수동 스크린샷이 필요합니다. 플러그인이 대신 찍어 `.runelite/osrs-bingo-pending/`에 저장하며(Anvil 사이드 패널의 **Copy folder path**로 폴더가 열립니다), 나중에 사진을 찾는 대신 사이트에서 첨부하면 됩니다.',
      },
    },
    limits: {
      title: '알려진 제한 사항',
      intro:
        '몇 가지는 완벽하게 추적할 수 없습니다 —— 거의 항상 Anvil이 아니라 게임 자체가 보고하는 내용 때문입니다. 해결책은 매번 같습니다: 스크린샷을 찍어 수동으로 제출하세요.',
      rows: [
        {
          term: 'Barraging 등 다중 대상 처치',
          body: '처치 수(KC)는 게임이 처치마다 보고하는 내용에서 나오는데, Ice Barrage 같은 다중 대상 주문은 일부를 놓치게 만들어 **KC가 실제로 처치한 수보다 낮게 나올 수** 있습니다. RuneLite의 자체 Loot Tracker도 같은 방식으로 적게 셉니다 —— 게임 엔진의 한계이지 Anvil의 버그가 아닙니다.',
        },
        {
          term: '이전에 이미 달성한 Combat Achievements',
          body: '게임의 Combat Achievements 설정에서 **repeat completion**(반복 완료)을 켜세요. 켜지 않으면 이미 완료한 과제는 게임이 알려 주지 않고, 플러그인은 게임이 알려 주는 것만 인정할 수 있습니다.',
        },
        {
          term: 'Yama 계약 Combat Achievement',
          body: 'repeat completion을 켜도 게임이 이것은 다시 알려 주지 않으므로 플러그인이 전혀 보지 못합니다. 스크린샷을 찍어 수동으로 제출하세요.',
        },
        {
          term: '플러그인 없이 하는 채집 타일',
          body: '아이템 수 —— 물고기, 광석, 통나무의 개수 —— 는 hiscores에 없으므로 플러그인만 추적할 수 있습니다. 플러그인이 없다면 모든 인벤토리를 스크린샷으로 찍거나, 아이템이 Loot Tracker에 나온다면 시작할 때 0으로 초기화한 화면과 끝날 때의 화면을 각각 스크린샷으로 찍으세요.',
        },
        {
          term: 'Implings, 물고기, 광석 및 기타 아이템 획득',
          body: 'Implings 포획과 아이템 채집(물고기, 광석 등 인벤토리에 들어오는 것으로 세는 모든 것)은 **플러그인을 사용해도 가끔 올바르게 추적되지 않을 수 있습니다**. 진행하면서 스크린샷을 남겨 두고, 수량이 적어 보이면 신고한 뒤 차이만큼 수동으로 제출하세요.',
        },
        {
          term: '피시 배럴, 로그 바스켓 등 보관 아이템',
          body: '아이템 획득 타일은 **출처에서 바로** 인벤토리에 들어온 것만 셉니다 — 낚시터, 바위, 나무 등. 보관함에서 꺼낸 것(피시 배럴, 로그 바스켓, 석탄·보석 주머니, 허브 자루 비우기), 상점에서 산 것, 은행에서 꺼낸 것, 바닥에서 주운 것은 **세지 않습니다**. 그래야 타일이 공정합니다. 그렇지 않으면 같은 물고기를 배럴에 넣었다 빼는 것을 끝없이 반복할 수 있습니다. 배럴이나 바스켓에 바로 모은 것은 세지 않습니다.',
        },
        {
          term: "중복 펫과 Champion's scroll",
          body: '이미 가진 펫이나 스크롤이면 게임은 **“funny feeling”** 이라고만 하고 어떤 것인지 알려주지 않습니다. 플러그인은 방금 잡은 몬스터나 올린 스킬로 추론해 타일을 인정하고, **스태프가 확인하도록 표시합니다**. 알 수 없는 경우 — 같은 출처의 펫이 둘이거나, 킬이나 스킬과 연결되지 않는 펫(마스터 클루의 Bloodhound, 갬블로 얻은 Jad·Zuk 펫, Chompy chick) — 스크린샷을 **Saved proofs** 에 저장하니 직접 제출하세요.',
        },
      ],
    },
    screen: {
      title: '플레이 중 화면에 보이는 것',
      intro: '플러그인이 플레이 중에 화면에 그리고 출력하는 것과 각각을 제어하는 설정.',
      rows: [
        {
          term: '고정된 타일',
          body: '사이드 패널에서 타일을 열고 **Track on screen**을 누르세요 (최대 3개). **Pinned tiles in one panel**이 켜져 있으면 하나의 작은 패널을 함께 씁니다: 각 타일의 이름, 팀 진행도, 그리고 _3/5 runs_ 같은 줄이나 콤보에서 끝난 부분. 꺼져 있으면 각 타일이 팀원과 다른 팀을 보여 주는 더 큰 위젯을 따로 갖습니다. Alt-드래그로 옮기세요. 우클릭하면 **Unpin** 또는 **Unpin all**이 있습니다. 끝난 타일은 **Done**을 표시한 뒤 스스로 고정이 해제됩니다.',
        },
        {
          term: '시작 신호 카드',
          body: '이벤트가 내 시작 신호를 기다리는 동안, 화면 상단의 **Starting shot needed** 카드가 어디로 가야 하는지 알려 주고 각 확인 항목을 초록 또는 빨강으로 보여 줍니다: 재접속, 세션 경과 시간, 지점까지 남은 칸 수. 힌트 화살표와 세계 지도 핀(**Anvil starting shot**)이 그곳으로 안내합니다. **Auto starting shot**이 켜져 있으면 모든 항목이 초록이 되는 순간 자동으로 시작되고, 카드에 **You’re tracked**가 표시된 뒤 사라집니다. 설정: **Starting shot guide**.',
        },
        {
          term: '배너',
          body: '내 팀이 타일을 끝내면 **Tile complete!**, 타일에서 내 드롭의 진행도, 그리고 **New mission!**. 설정: **Team completion popups**와 **My tile popups**.',
        },
        {
          term: 'Vestige 굴림',
          body: 'Desert Treasure II 보스에서 각 고유 아이템마다 vestige 회전에서 현재 위치를 알려 주는 줄이 나옵니다. 예: _Roll 2 of 4_ 또는 _the next unique is the vestige_. vestige를 얻는 모습을 보기 전까지는 _(estimated)_로 표시됩니다. 따로 설정은 없으며 이벤트 유무와 관계없이 작동합니다.',
        },
        {
          term: 'Lookup 자동완성',
          body: '**Lookup** 상자에 입력하면 최근 조회, 친구, 온라인 클랜원, 근처 플레이어 목록에서 이름을 완성해 줍니다. **Enter**로 확정합니다. 내 클라이언트에서만 읽으며 아무것도 전송되지 않습니다.',
        },
        {
          term: '채팅 색상',
          body: '**Chat messages** 아래의 **[Anvil] tag colour**와 **Message colour**. 고르기 전에는 불투명한 채팅창에서도 잘 보이도록 진한 금색과 검정으로 표시됩니다. 채팅에서 서포터의 이름에 마우스를 올리면 _Anvil Patron_ 같은 등급이 보입니다.',
        },
      ],
    },
    sync: {
      title: '프로필 동기화와 그 밖에 보내는 것',
      intro: '**Profile sync** 설정이 내 Anvil 프로필을 채웁니다. 시작할 때는 네 가지가 모두 켜져 있습니다:',
      rows: [
        {
          term: '컬렉션 로그 동기화',
          body: '열어 보는 컬렉션 로그 페이지마다 프로필로 전송됩니다.',
        },
        {
          term: '열 때 전체 로그 동기화',
          body: '컬렉션 로그를 열면 보고 있는 페이지뿐 아니라 전체가 전송됩니다. 원할 때 하려면 컬렉션 로그 제목 표시줄의 **Anvil** 버튼을 누르거나, 로그가 열린 상태에서 사이드 패널의 **Sync profile**을 누르세요. 채팅에 확인 메시지가 뜹니다: _Profile synced — N collection log slots._',
        },
        {
          term: '개인 최고 기록 동기화',
          body: '보스와 레이드 기록은 설정하는 대로 전송됩니다.',
        },
        {
          term: '기존 기록 한 번 가져오기',
          body: '캐릭터당 한 번, 컴퓨터에 이미 RuneLite가 저장해 둔 개인 최고 기록을 복사합니다: _Imported N personal best(s) from RuneLite._',
        },
        {
          term: '하이라이트를 클랜과 공유',
          body: '펫, 큰 드롭, 사망, 전투 과제, 레벨 달성, 새 로그 슬롯, 다이어리, 퀘스트가 클랜 사이트의 피드와, 이를 볼 수 있는 플레이어의 채팅 피드에 나타납니다. 참여 중인 모든 라이브 보드의 피드에도 새 로그 슬롯, 다이어리, 퀘스트가 나타납니다.',
        },
      ],
      outro: '설정이 따로 없는 것 세 가지도 전송됩니다. **Who killed you**: 마지막 15초 동안 내가 타겟으로 잡고 있던 몬스터나 플레이어가 피드에 표시됩니다. **Game counters**: 일부 처치 타일은 게임이 기록하는 수치를 셉니다. 예: Tithe Farm 점수, Giants’ Foundry 평판, Doom 탐험, 슬레이어 연속 기록. 증가만 집계됩니다. **Leagues, Deadman 및 기타 모드**: 해당 월드에서는 게임이 출력하는 유물, 지역, 과제 관련 줄이 전송되어 클랜이 모드 채널에 올릴 수 있습니다.',
    },
  },

  admin: {
    metaTitle: '첫 이벤트 운영하기 — Anvil 관리 가이드',
    metaDescription:
      'Anvil에서 클랜을 세우고 빙고를 처음부터 끝까지 굴리기: Discord, 멤버 명단, 보드, 칸, 팀과 드래프트, 개시, 그리고 이벤트가 끝난 뒤에 일어나는 일.',
    eyebrow: 'Anvil · 클랜 운영진용',
    title: '첫 이벤트 운영하기',
    dek: '실제로 걷게 될 순서 그대로의 전체 경로: {clanName} 설정을 마치고, 멤버 명단을 들여오고, 보드를 만들고, 드래프트로 팀을 짜고, 굴리고, 상품을 나눠 주기까지. 첫 빙고는 대략 하룻밤치 작업 —— 두 번째부터는 몇 분입니다.',
    facts: [
      { strong: '5단계', rest: '설정 체크리스트의 절차' },
      { strong: '7가지 형식', rest: '으로 보드를 만들 수 있음' },
      { strong: '버튼 하나', rest: '로 멤버 명단 동기화' },
    ],
    footnote:
      '이 가이드는 오늘 배포된 앱 기준입니다. 여기 화면이 눈앞의 것과 다르다면 앱이 맞고 가이드가 낡은 것입니다 —— [알려 주시면](/feedback) 고치겠습니다.',

    access: {
      title: '누가 무엇을 할 수 있는가',
      intro:
        '모두 Discord로 로그인합니다 —— 비밀번호는 없습니다. 첫 관리자는 소유자, 즉 클랜을 만든 사람이고, 그 뒤로는 관리자가 **People → Staff & roles**에서 다른 사람을 승격시킵니다. 역할은 아래로 쌓입니다: moderator가 할 수 있는 것은 회계 담당과 admin도 모두 할 수 있습니다.',
      rows: [
        {
          term: 'Admin',
          body: '전체 권한 —— 이벤트, 칸, 팀, 설정, 인원, 지급. 클랜이 감당할 수 있는 한 최소한의 인원에게만 주세요.',
        },
        { term: 'Treasurer', body: 'moderator가 할 수 있는 모든 것에 더해 참가비와 상금 지급.' },
        {
          term: 'Moderator',
          body: '일상 업무: 멤버 명단, 확인 처리, 확인할 증거, 주간 대회, 일정과 클랜 이벤트. 이벤트를 만들거나 편집할 수는 없습니다.',
        },
        {
          term: 'Editor',
          body: '칸 작성만. 전역으로 주거나 특정 보드로 한정할 수 있어서, 외부에서 초대한 보드 제작자는 당신이 넘겨준 이벤트에만 손댈 수 있습니다.',
        },
        { term: 'Member', body: '플레이만 합니다. 관리 화면은 전혀 보이지 않습니다.' },
      ],
      seeAlso:
        '그중 두 역할에는 전용 페이지가 있습니다: moderator가 실제로 하룻저녁에 무엇을 하는지는 [당번]({moderatorGuide}), 회계 담당용은 [참가비와 상금]({feesGuide}).',
      ownerNote: {
        tag: '소유자',
        body: '계정 하나가 소유자입니다. 다른 누구도 그 권한을 낮출 수 없고, 소유권을 넘길 수 있는 유일한 역할이기도 합니다 —— 즉 공동 관리자와의 다툼에서 진다고 해서 클랜을 잃는 일은 결코 없습니다.',
      },
    },

    setup: {
      title: '클랜 이름을 정하고 Discord를 연결하기',
      intro:
        '**Settings → Finish setup**은 짧은 마법사이고(끝날 때까지 메뉴에 남아 있습니다), 대시보드도 끝날 때까지 5단계 체크리스트로 남깁니다: 클랜 이름 정하기, Discord 연결, 멤버 불러오기, 이벤트 생성, 칸 추가. 상태는 실제 데이터로 계산되므로, 진짜로 끝났을 때만 체크가 붙습니다.',
      discord:
        'Discord에는 두 갈래가 있고 함께 쓸 수 있습니다: Anvil에 **봇**을 주면 웹훅 생성, 역할과 별명 동기화, 비공개 팀 채널 생성까지 할 수 있습니다. **웹훅 주소** 하나만 주면 공지를 올리는 것 외엔 아무것도 못 합니다. 2분 만에 돌리고 싶다면 웹훅으로 시작하고, 자동화가 필요해지면 봇을 더하세요.',
      permsNote: {
        tag: '봇 권한',
        body: '봇에는 _웹후크 관리_, _역할 관리_, _채널 관리_, _별명 관리_ 권한이 필요하고, 서버 역할 목록에서 봇의 역할이 관리 대상 역할들보다 _위에_ 있어야 합니다. 그러지 않으면 Discord가 조용히 거부합니다.',
      },
      hosted:
        '호스팅 요금제라면 그 화면을 이미 한 번 만났을 겁니다: 설정 중에 봇을 추가한 것이 곧 Anvil이 어느 서버가 여러분 것인지 알게 된 방법이었고, 그래서 애초에 복사할 서버 ID 같은 건 없었습니다. 봇을 다른 서버로 옮기고 싶을 때를 위해 같은 링크가 여기 있습니다.',
    },

    channels: {
      title: '게시물을 여러 채널로 나누기',
      body: [
        '기본적으로 모든 것이 하나의 catch-all 채널로 갑니다. 시끄러워지면 **Discord → What goes where**를 열고 소란스러운 분류에 각자의 집을 주세요 —— 이벤트 게시물, 주간 대회, 희귀 드롭, 사망, PvP 처치, combat achievements. 비워 둔 항목은 각자의 catch-all로 되돌아가므로 한 번에 한 분류씩 떼어낼 수 있습니다.',
        '봇을 연결해 두면 웹훅 주소를 만질 일이 없습니다: 그 줄의 드롭다운에서 채널을 고르면 바로 저장됩니다. 바쁜 이벤트라면 **Post without a bot**의 **Add another**로 웹훅을 하나 더 둘 수 있습니다 —— Anvil이 둘을 번갈아 쓰므로 Discord의 속도 제한이 게시물을 삼키지 않습니다.',
      ],
      clipsNote: {
        tag: '클립 채널은 다릅니다',
        body: '클립 영상은 각 플레이어의 PC에서 Discord로 바로 올라갑니다 —— 이 사이트를 거치지 않습니다. 그래서 여기서 설정하는 클립 웹훅은 당신이 _나눠 주는_ 것입니다: 멤버들이 직접 자기 플러그인에 붙여 넣습니다. 이 페이지의 나머지는 전부 서버 쪽 이야기라 멤버 눈에는 띄지 않습니다.',
      },
    },

    roster: {
      title: '멤버 명단 들여오기',
      body: [
        '클랜 소속의 출처는 단 하나입니다: 게임 내 멤버 명단 동기화. _관리자_ 계정에 [Anvil의 RuneLite 플러그인]({pluginGuide})을 설치하고, 게임 안에서 클랜 창을 열어 그 제목 표시줄의 **Anvil** 버튼을 누르세요. 그것만으로 실제 게임 내 클랜 목록이 사이트로 올라갑니다.',
        '로그인하거나, 캐릭터를 연결하거나, 플러그인으로 플레이해도 누구도 명단에 오르지 않습니다. 명단에 오르기 전에 우리 게임 내 클랜에서 플레이하는 사람을 플러그인이 보면 가입 요청을 넣고, 그 밖의 사람은 클랜 페이지의 **Apply**로 요청할 수 있습니다. 스태프는 **People → Roster** 맨 위에서 요청에 답하고, **People → Who can join**이 사람들이 승인을 기다릴지, 바로 게스트 자리를 받을지, 아예 요청할 수 없을지를 정합니다. 일부러 이렇게 만들었습니다: 클랜 이름을 입력하는 것만으로는 아무도 클랜에 들어오지 못합니다. 전체 그림은 [우리 사람들]({peopleGuide})에 있습니다.',
        '**People → + Add Manually**에서 손으로 추가할 수도 있고, 사이트에 접속할 수 없는 사람은 이벤트의 **Sign-ups** 페이지에 있는 **Add member**로 대신 신청해 줄 수 있습니다.',
      ],
    },

    board: {
      title: '첫 보드 만들기',
      intro:
        '**Events → All events → + New event**. 먼저 형식을 고르세요 —— 이것이 보드의 채점 방식과, 이후 양식이 무엇을 물을지를 결정합니다.',
      formats: {
        classic: {
          label: '클래식 빙고',
          blurb: '정사각형 N×N 격자 —— 팀은 원하는 순서로 칸을 채우고, 칸마다 1점.',
        },
        leagues: {
          label: 'Point Hunt',
          blurb: '칸마다 고유한 점수를 지닌 과제 목록 —— 칸 개수는 자유.',
        },
        race: {
          label: '칸 레이스',
          blurb: '순서가 정해진 코스 —— 팀은 순서대로 칸에 도달하고, 가장 멀리 간 팀이 승리. 주최자는 갈라지고 합쳐지는 경로로 나눌 수 있습니다. 완료한 칸이 갈 길을 정합니다.',
        },
        showdown: {
          label: 'Showdown',
          blurb:
            '칸이 예정된 시각까지 숨겨져 있습니다 —— 각 공개 시각은 Tiles 탭에서 설정합니다. 점수제, DMM All Stars 느낌.',
        },
        luckydraw: {
          label: '행운 추첨',
          blurb: '빙고 사회자처럼: 숨겨진 칸이 일정 간격의 무작위 추첨으로 열립니다. 점수제.',
        },
        bounty: {
          label: '현상금',
          blurb:
            '한 번에 열려 있는 칸은 하나뿐 —— 먼저 끝낸 팀이 점수를 가져가고, 곧바로 다음 현상금이 뽑힙니다.',
        },
        ladder: {
          label: '래더',
          blurb:
            '개인 순위표 형태로 정렬되는 점수제 과제 목록(팀은 선택). 과제가 순환하며 —— 점진적으로, 하나씩, 혹은 이동 창으로 —— 가치가 떨어질 수도 있습니다. 월간 래더 같은 느낌.',
        },
      },
      outro:
        '그다음 날짜, 신청 기간, 신청에 참가비가 붙는지를 정하세요. 빈 격자에서 시작하고 싶지 않다면 템플릿에서 시작하세요 —— 갤러리에는 기본 제공 템플릿과, 예전에 템플릿으로 저장해 둔 보드가 모두 들어 있습니다.',
      seeAlso:
        '형식은 결정의 절반일 뿐입니다 —— 칸이 어떻게 플레이 가능해지는지가 나머지 절반이고, 둘은 겹쳐 작동합니다. 둘 다 자세히: [형식, 그리고 칸이 열리는 방식]({formatsGuide}).',
      utcNote: {
        tag: '날짜는 모두 UTC',
        body: 'Anvil의 모든 시각은 UTC로 저장·비교되고, 표시는 방문자 각자의 현지 시간으로 됩니다. 당신이 의도한 종료 시각을 설정하세요. 같은 순간이라도 사이트는 영국인과 호주인에게 서로 다른 시계를 보여 줍니다.',
      },
    },

    tiles: {
      title: '보드 채우기',
      body: [
        '이벤트의 **Board & tiles** 페이지가 보드를 빙고로 만드는 곳입니다. 각 칸은 한 _종류_의 과제이고, 그 종류가 플러그인이 무엇을 지켜볼지를 정합니다: 드롭, 보스 처치 수, 스킬 경험치, NPC 처치, 시간 내 완료, achievement diary, Combat Achievement, collection log 해금, PvP 처치, 아이템 획득, 혹은 무사망 클리어. 사람이 스크린샷을 보고 승인하는 수동 칸도 언제나 선택지입니다.',
        '보드 전체를 채울 때는 한꺼번에 작성하세요: 시트를 내보내고, 표 계산 프로그램에서 채우고, 다시 가져오면 됩니다. CSV와 .xlsx 모두 왕복이 되고, 행이 위치에 대응하므로 25칸 격자 전체를 한 번의 붙여넣기로 다시 쓸 수 있습니다.',
      ],
      rows: [
        {
          term: '난이도 구간',
          body: '점수 값이 이름 붙은 구간(easy → elite)에 대응됩니다. 클랜의 분류 방식이 다르다면 **Clan settings → Rules & scoring → Difficulty & balance**에서 구간을 수정하세요.',
        },
        {
          term: '균형 점검기',
          body: '플레이어가 보기도 전에, 완성된 보드의 구조적 문제와 치우친 노력 분포를 확인합니다.',
        },
        {
          term: '공개 전까지 숨김',
          body: '새 보드는 숨김 상태로 시작합니다. 운영진에게는 늘 보이지만 플레이어에게는 당신이 공개하기 전까지 아무것도 보이지 않습니다 —— 즉 보드를 드러내 놓고 만들어도 내용이 새지 않습니다.',
        },
      ],
      seeAlso:
        '어떤 종류를 골라야 하는지, 표 계산으로 200개를 쓰는 법, 그리고 깔끔하게 들어온 뒤 한 번도 발동하지 않는 실수들: [스스로 기록하는 보드 만들기]({boardGuide}).',
    },

    teams: {
      title: '팀과 드래프트',
      body: [
        '**Teams & draft** 페이지는 고른 형식에 맞춰 달라집니다: 팀을 쓰지 않는 형식이라면 통째로 건너뜁니다. 보통의 팀 빙고라면 팀을 만들고, 누가 주장인지 정하고, 직접 배분하거나 실시간 드래프트를 돌립니다.',
        '주장들은 당신이 정한 순서대로 신청자 풀에서 뽑고, 각 주장은 신청서에 적힌 답변을 볼 수 있습니다 —— 제출된 그대로 얼어붙어 있어서, 뽑힌 뒤에 “주당 시간”을 고칠 수는 없습니다.',
      ],
      placementIntro:
        '드래프트를 꼭 할 필요는 없습니다. 생성 양식과 **Sign-ups** 탭에 있는 **Team placement**가 새 신청자가 어디로 갈지 정합니다:',
      placementRows: [
        {
          term: 'Auto-balance',
          body: '신청한 사람은 인원이 가장 적은 팀에 들어갑니다. 당신은 팀 수만 정하면 됩니다. 큰 공개 이벤트에 좋습니다.',
        },
        {
          term: 'Players pick',
          body: '먼저 팀을 만들고, 각 플레이어가 신청서에서 팀을 하나 고릅니다. 팀마다 인원 한도를 두면 고르게 유지됩니다.',
        },
        {
          term: 'Host drafts',
          body: '모두 풀에서 기다리다가, 당신이나 주장이 드래프트하거나 직접 배정합니다. 플레이어를 잘 알 때 가장 좋습니다.',
        },
        {
          term: 'Solo',
          body: '팀이 전혀 없습니다. 모든 플레이어가 혼자이고, 캐릭터 이름으로 표시되며, 순위도 플레이어별로 매깁니다.',
        },
      ],
      lockNote: {
        tag: '드래프트가 구성을 고정합니다',
        body: '드래프트가 시작되는 순간 팀 구성과 지명 순서가 얼어붙습니다. 빠뜨린 팀은 시작을 누르기 _전에_ 추가하세요. 그 뒤로는 안 됩니다.',
      },
      seeAlso:
        '드래프트 전날 밤 전에 주장들에게 [주장 가이드]({captainGuide})를 보내 두세요 —— 작전실이 가장 값어치 있는 때는 그 전 며칠이고, 시계가 돌아가는 동안 새 화면을 읽는 사람은 없습니다.',
      visitingClans:
        '우리끼리 드래프트하는 대신 다른 클랜과 붙는 건가요? 방문 측은 링크 하나로 자기 팀을 꾸리고, 그쪽 관리자가 여기에 admin 계정 없이 운영합니다 —— [방문 클랜 맞이하기]({clanVsClanGuide}) 참고.',
    },

    launch: {
      title: '개시하고 굴리기',
      body: [
        '칸을 공개한 뒤 이벤트를 시작하세요. Anvil은 준비되지 않은 보드 —— 드래프트가 아직 진행 중이거나, 팀 없는 플레이어가 있는 경우 —— 의 시작을 거부하고 어느 쪽인지 알려 줍니다. 당신이 더 잘 알고 있다면(연습전, 재진행, 시험 중인 보드) 강제로 시작할 수 있습니다.',
        '그다음부터는 대체로 알아서 굴러갑니다. 플러그인이 볼 수 있는 모든 것을 자동으로 계산하고, 팀과 UTC 시각이 새겨진 증빙 스크린샷을 올립니다. 당신 몫으로 남는 것은:',
      ],
      rows: [
        {
          term: '확인 대기 중인 제출',
          body: '수동 칸과 플러그인이 표시해 둔 모든 것. 증빙을 앞에 두고 승인하거나 반려하세요.',
        },
        {
          term: '통계',
          body: '이벤트의 Stats 탭이 플레이어별 기여를 보여 줍니다 —— 팀 안에서 “누가 누구를 캐리했나”로 다툴 때 쓸모가 있습니다.',
        },
        {
          term: '공지',
          body: '**Post to Discord**(메뉴의 **Clan** 아래)로, 웹훅을 손수 쓰지 않고도 이벤트 도중 원하는 채널에 봇으로 메시지를 올릴 수 있습니다.',
        },
      ],
      missionNote: {
        tag: '이벤트 도중의 깜짝 요소',
        body: '진행 중인 빙고에 **미션**을 떨어뜨릴 수 있습니다 —— 숨겨진 보너스 칸으로, 당신이 발사하는 순간 공지되고, 원한다면 가치가 줄거나 만료되게 할 수도 있습니다. 5일째에 보드를 깨우는 가장 값싼 방법입니다.',
      },
      startProofNote: {
        tag: '이벤트 전 비축 막기',
        body: [
          '**Starting shot**을 켜면(이벤트 → Home → **Extras**) 모든 플레이어가 이벤트 개시 이후에 찍은 스크린샷 한 장을, Anvil이 개시 순간에 추첨한 장소에서 제출해야 합니다 —— 그래야 아무도 0시점에 한 주치 쌓아 둔 단서와 상자를 깔고 앉아 있지 못합니다. 장소는 개시와 함께 공지되고, 각 플레이어의 암호는 추첨 결과에서 파생된 개인 전용이며 이벤트가 시작되기 전까지는 존재조차 하지 않으므로 누구도 미리 준비할 수 없습니다.',
          '장소를 월드 맵에 찍어 두면(풀 편집기에 지도가 있습니다) 플러그인이 플레이어가 정말 거기 서 있는지 확인합니다. 그냥 말로만 전달받은 것이 아니라요. **새 세션**을 요구할 수도 있습니다 —— 기본 15분: hiscores는 로그아웃할 때만 저장되므로, 촬영 직전에 모두를 재접속시키는 것이야말로 모든 경험치·처치 수 칸 뒤의 시작 수치를 정직하게 만듭니다.',
          '플러그인 사용자는 버튼 하나를 누르면 됩니다. 나머지는 게임 안에서 암호를 입력하고 My Team에서 업로드합니다. 제출하지 않은 사람의 기여를 어떻게 다룰지는 당신이 정합니다: 확인 대기로 표시(기본) 하거나, 제출할 때까지 거부하거나. 이벤트 Home의 같은 패널이 곧 확인 목록입니다 —— 암호가 검증된 플러그인 촬영은 이미 승인된 상태로 들어오므로, 실제로 들여다보는 것은 모바일 플레이어뿐입니다.',
        ],
      },
    },

    after: {
      title: '마지막 칸 이후',
      intro:
        '시간이 다 되면 보드가 얼어붙고 이벤트가 잠깁니다 —— 점수, 기여, 누가 무엇을 했는지가 그 상태 그대로 고정됩니다. 나중에 고칠 일이 생기면 관리자가 의도적으로 잠금을 풀 수 있습니다.',
      rows: [
        {
          term: '상금 지급',
          body: '이벤트의 **Prizes** 페이지가 상금 풀을 “누가 얼마를 받는지”의 목록으로 바꾸고, 지급하면서 하나씩 체크할 수 있게 합니다.',
        },
        {
          term: '결산',
          body: '최종 순위와 마무리 시상 —— 최대 드롭, 최다 처치 등 —— 을 담은 공개 결산 페이지.',
        },
        {
          term: '설문',
          body: '클랜에 어땠는지 물어보세요. Survey 탭에서 만들면 이벤트 종료 후 플레이어가 답하고, 결과는 운영진만 봅니다.',
        },
        {
          term: '템플릿으로 저장',
          body: '방금 만든 보드를 이벤트의 **Settings → More**에서 남겨 두세요. 다음 빙고는 빈 격자가 아니라 거기서 시작합니다.',
        },
      ],
      federation:
        '연합을 켜면 멤버들이 플러그인에서 다른 Anvil 클랜에도 연결할 수 있습니다 —— 클랜 간 이벤트에 편리하고, 멤버별로 완전히 선택 사항입니다.',
      outro: '그다음 멤버들을 [플레이어용 설정 가이드]({pluginGuide})로 안내하고, 다음 이벤트를 준비하세요.',
    },
    survey: {
      title: '플레이어에게 묻기',
      intro: '**Features**에서 **Post-event survey**를 켠 다음, 이벤트의 **Survey** 페이지를 여세요.',
      body: [
        '**Build** 아래에서 질문을 추가하세요: **Rating (1–5)**, **Free text**, **Choose one** 또는 **Choose many**. 각 질문은 선택적으로 **Required**로 설정할 수 있습니다. 또는 템플릿을 불러오세요: **Bingo wrap-up**, **Quick pulse**, **PvM mass**, **Raid team** 또는 **Skilling / social**. **Preview the participant view**는 플레이어가 보게 될 모습을 보여 줍니다.',
        '이벤트가 끝나면 승인된 참가자에게만 열리며, 참가자는 나중에 답변을 바꿀 수 있습니다. **Results**에서 **By question** 또는 **By person** 기준으로 답변을 볼 수 있습니다. 익명이 아니므로 운영진은 누가 무엇을 답했는지 볼 수 있습니다.',
      ],
    },
  },

  clanVsClan: {
    metaTitle: '방문 클랜 맞이하기 — Anvil 주최자 가이드',
    metaDescription:
      'Anvil에서 클랜 대항전 굴리기: 방문 클랜마다 그 팀 플레이어를 한 팀에 앉히는 초대 링크와, 그쪽 관리자가 자기들 절반을 굴릴 수 있는 자리를 주세요.',
    eyebrow: 'Anvil · 주최자용',
    title: '방문 클랜 맞이하기',
    dek: '보드는 당신이 주최하고, 사람은 저쪽이 냅니다. 이것이 DM으로 RSN 열몇 개를 그러모으지 않아도 되는 길입니다 —— 팀마다 링크 하나, 그리고 그쪽 관리자가 이벤트의 자기들 절반을 굴릴 수 있는 자리 하나.',
    facts: [
      { strong: '링크 1개', rest: '방문 팀 하나당' },
      { strong: '관리 자리 0개', rest: '외부인에게 넘기는 수' },
      { strong: '약 5분', rest: '초대하는 클랜 하나당' },
    ],
    footnote:
      '스크린샷은 테스트 보드에서의 실제 설정입니다 —— 초대 토큰과 Discord 이름은 가렸습니다. 진짜 링크는 지킬 값어치가 있습니다: 유효한 동안에는 그것을 가진 누구든 그 팀의 자리를 차지할 수 있으니까요.',

    teamCompsLine: "클랜끼리 스킬이나 보스로 겨루고 싶으신가요? [팀 대항전]({teamCompsGuide})을 참고하세요.",

    shape: {
      title: '지금 준비하는 것',
      body: [
        '클랜 대항전은 딱 한 가지만 다른 평범한 이벤트입니다: 플레이어의 절반이 당신 클랜 소속이 아니고, 앞으로도 아닐 것이라는 점. 명단 동기화로 데려올 수도 없고, 승격시키고 싶지도 않고, 스무 명을 손으로 신청시킨 뒤 하나씩 알맞은 팀으로 끌어다 놓고 싶지는 더더욱 않을 겁니다.',
        '이를 해결하는 두 조각이 있고, 서로 독립적입니다 —— 하나만 쓰든, 둘 다 쓰든 됩니다.',
      ],
      rows: [
        {
          term: '초대 링크',
          body: '한 팀을 위해 한 번만 발급하는 URL. 여는 사람은 로그인하고, 평소의 신청서를 채우고, 이미 승인된 상태로 그 팀에 내려앉습니다 —— 드래프트 풀도, 승인 대기열도 거치지 않습니다.',
        },
        {
          term: '팀 스태프 자리',
          body: '_그 한 팀만_ 굴릴 수 있는, 이름이 붙은 한 사람 —— 명단, 제출과 증빙, 참가비까지. 여기에 admin 계정을 가질 필요도 없고, 실제로 뛰는 사람에게서 주장 자리를 빼앗지도 않습니다.',
        },
      ],
      note: {
        tag: '초대가 아닌 것',
        body: '로그인도 아니고, 확인 절차를 우회하는 지름길도 아닙니다. 여는 사람은 여전히 Discord로 로그인하고, 여전히 확인된 RSN이 필요합니다. 다른 어떤 신청과도 똑같습니다. 링크가 정하는 것은 그 신청이 _어느 팀에_ 들어가는지, 그리고 누구의 승인도 필요 없다는 점뿐입니다.',
      },
    },

    team: {
      title: '팀부터 만들기',
      body: [
        '이벤트를 열고 **Teams & draft** 페이지로 가세요. 초대한 클랜마다 팀을 하나씩 만들고 그 클랜 이름을 붙이세요 —— 그 이름이 상대 플레이어가 신청서에서 보는 것이니, “팀 2”보다 “Ironforge”가 낫습니다.',
        '드래프트를 돌릴 필요는 _없습니다_. 초대 링크와 드래프트는 서로 대안입니다: 드래프트는 공용 신청 풀을 나누고, 링크는 사람을 바로 앉힙니다. 순수한 클랜 대항전이라면 대부분의 주최자가 팀을 만들고 각각 링크 하나씩을 나눠 준 뒤, 드래프트는 아예 열지 않습니다.',
        '그다음 팀 자체를 여세요 —— **Teams & draft → 해당 팀** —— 다음 두 단계가 모두 거기서 이뤄집니다.',
      ],
      captainNote: {
        tag: '주장부터',
        body: '링크를 나눠 주기 전에 방문 측 주장을 지정해 두면, 팀 페이지에 처음부터 책임자가 있게 됩니다. 주장을 지정하면 그 사람이 팀에 앉기도 합니다. 명단에 없다고 카드가 경고하면 제시하는 수정을 받아들이세요.',
      },
    },

    staff: {
      title: '그쪽 관리자에게 자리 주기',
      body: [
        '팀 페이지의 **Team staff** 패널이, 방문 클랜의 관리자가 당신 사이트에서 아무 권한도 받지 않은 채 일을 시작하는 방법입니다. **Add someone**을 누르고, 그 사람을 검색하고, “Ironforge’s mod” 같은 메모를 붙여(다음 관리자가 왜 그 사람이 있는지 알 수 있도록) **Give a seat**을 누르세요.',
      ],
      figure: {
        caption: '이벤트 → Teams & draft → 해당 팀 → Team staff',
        alt: '자리 하나가 부여된 Team staff 패널과, 추가용 검색창이 열려 있는 모습',
        legend: [
          {
            label: 'Add someone',
            body: '검색을 엽니다. 여기서 Discord로 최소 한 번 로그인한 적이 있는 사람만 나타납니다 —— 아래 주의를 보세요.',
          },
          {
            label: '메모',
            body: '자유 입력, 120자. 어느 클랜 사람인지 적으세요. 자리는 이벤트가 끝난 뒤에도 목록에 남고, “이 사람이 누구였더라”는 석 달 뒤 당신이 하게 될 질문입니다.',
          },
          {
            label: 'Remove',
            body: '즉시 자리를 회수합니다. 이벤트가 끝나면 해 주세요 —— 자리는 저절로 만료되지 않습니다.',
          },
        ],
      },
      canDo: '자리로 할 수 있는 일, 그 팀에 한해서:',
      canDoList: [
        '팀 명단을 보고 관리하기',
        '제출과 증빙 처리하기',
        '소속 플레이어의 참가비를 납부 완료로 표시하기',
        '그 팀용 초대 링크 만들기(당신이 켜 준 경우. 다음다음 단계)',
      ],
      cantDo: '절대 할 수 없는 일:',
      cantDoList: [
        '다른 팀을 건드리기',
        '보드나 칸을 편집하기',
        '드래프트에서 지명하기',
        '이벤트가 시작된 뒤 누군가를 교체하기',
      ],
      note: {
        tag: '먼저 여기서 한 번 로그인해야 합니다',
        body: '검색에는 Discord가 연결된 계정만 나옵니다 —— 자리는 실제로 로그인할 수 있는 사람에게 붙습니다. 그러니 방문 클랜의 관리자를 이 사이트로 보내 **Login**을 한 번 누르게 하고, _그 뒤에_ 자리를 주세요. 검색에 나오지 않는다면 그 로그인이 아직 일어나지 않은 것입니다.',
      },
    },

    link: {
      title: '초대 링크 만들기',
      body: [
        '여전히 팀 페이지에서, **Invite links** 패널이 링크를 만듭니다. 링크가 무엇을 약속하는지는 두 칸이 정하고, 둘 다 `0`을 “아무것도 약속하지 않음”으로 읽습니다.',
      ],
      figure: {
        caption: '이벤트 → Teams & draft → 해당 팀 → Invite links',
        alt: '자리 수와 만료 칸, Make a link 버튼, 그리고 목록에 유효한 링크 하나가 있는 Invite links 패널',
        legend: [
          {
            label: 'Seats와 Expires in hours',
            body: '링크가 몇 명까지 앉힐 수 있는지(최대 100)와 얼마 동안 유효한지(최대 30일). 약속받은 인원수에 자리 수를 맞춰 두면 다 들어온 순간 링크가 스스로 닫힙니다. 공개 Discord로 나갈 링크라면 만료를 걸어 두세요. 어느 칸이든 `0`이면 제한 없음입니다.',
          },
          {
            label: 'Make a link',
            body: '만들자마자 클립보드에 복사합니다. 다른 일을 하기 전에 먼저 상대에게 붙여 넣어 주세요.',
          },
          {
            label: '유효한 링크 목록',
            body: '이 팀이 내보낸 모든 링크와, 몇 명이 들어왔고 자리가 몇 개 남았는지. **Copy**로 다시 가져오고, **Turn off**로 영구히 무효화합니다.',
          },
        ],
      },
      shape:
        '링크는 이렇게 생겼습니다: `{origin}/events/{eventId}/join/{token}` —— 한 줄이라 Discord 메시지에 안심하고 붙여 넣을 수 있습니다.',
      note: {
        tag: '합리적인 기본값',
        body: '관리자 한 명과 인원을 합의한 클랜 대항전이라면 두 칸 모두 `0`으로 두고 그쪽에 맡기세요. 자리 수와 만료를 꺼내 드는 건, 링크가 당신이 통제하지 못하는 곳으로 갈 때뿐입니다.',
      },
      revoke:
        '링크를 끄는 것은 즉시 반영되지만, 이미 들어온 사람이 빠지지는 않습니다 —— 그들은 이제 그 팀의 평범한 플레이어입니다. 누군가를 빼고 싶다면 팀 명단에서 하세요.',
    },

    captains: {
      title: '그쪽이 직접 링크를 만들게 하기',
      body: [
        '기본적으로 링크를 만들 수 있는 건 주최자뿐이고, 시도한 주장에게는 그 사실이 안내됩니다. 보통의 클랜 이벤트에서는 그 기본값이 옳습니다 —— 주장이 자리를 나눠 준다는 건 아무도 승인하지 않은 명단을 채우는 일이니까요 —— 그리고 클랜 대항전에서는 틀립니다. 방문 측이 자기들 인원을 당신보다 잘 압니다.',
        '스위치는 같은 **Invite links** 패널에 있습니다: **Let captains make their own links**. 이것은 지금 보고 있는 팀만이 아니라 _이 이벤트의 모든 팀_에 적용됩니다 —— 양쪽 모두 방문 클랜일 때 바로 그것이 원하는 바입니다.',
        '켜 두면 해당 팀의 주장과 스태프 자리를 가진 모든 사람이 **My Team → Invite links**에서 직접 링크를 만들 수 있습니다. 당신이 보는 것과 같은 패널에서 스위치만 빠진 형태입니다.',
      ],
      figure: {
        caption: 'My Team → 해당 팀 → Invite links',
        alt: '팀 허브에서 주장 쪽으로 본 Invite links 탭. 자리 수와 만료 칸, 유효한 링크 하나',
        legend: [
          {
            label: '같은 패널, 주장의 시야',
            body: '만들고, 복사하고, 끄기. 주최자가 스위치를 켜지 않았다면 “Only a host can make links for this event”라고 나오고 입력 칸 자체가 없습니다.',
          },
          {
            label: '유효한 링크 목록',
            body: '링크를 만들 수 없는 주장도 자기 팀이 내보낸 링크는 볼 수 있습니다 —— 그래서 “하나도 없다”고 넘겨짚는 대신 당신에게 하나 더 달라고 할 수 있습니다.',
          },
        ],
      },
    },

    player: {
      title: '그쪽 플레이어가 보게 되는 것',
      intro:
        '링크를 나눠 주기 전에 한 번 직접 따라가 보면, 질문에 답할 수 있게 됩니다.',
      steps: [
        '링크를 엽니다. 로그인 상태가 아니면 먼저 Discord로 로그인하고 곧바로 돌아옵니다 —— 링크가 도중에 사라지지 않습니다.',
        '평소의 신청서에 도착하고, 위쪽에 **You’re joining {teamExample} by invite** 배너가 뜹니다. 질문도, 계정 선택도, 참가비도 다른 모두와 같습니다.',
        '제출하는 순간 그 팀 소속이 되고, 승인된 상태입니다. 주최자의 조치도, 드래프트도 필요 없습니다.',
      ],
      figure: {
        caption: '초대 링크로 연 신청서',
        alt: '플레이어가 초대를 통해 이름이 붙은 팀에 합류한다는 배너가 있는 이벤트 신청서',
        legend: [
          {
            label: '초대 배너',
            body: '곧 합류할 팀 이름이 적혀 있습니다. 다른 팀 이름이 보인다면 링크를 잘못 받은 것입니다 —— 제출하기 전에 멈추고 확인하세요.',
          },
          {
            label: '신청서의 나머지',
            body: '그대로입니다. 확인된 RSN은 여전히 필요하고, 신청 질문도 그대로 나오며, 참가비도 그대로 적용됩니다.',
          },
        ],
      },
      note: {
        tag: '이미 신청했다면?',
        body: '먼저 평소대로 신청해 풀에 있는 사람이 링크를 열면, 두 번째 신청을 만드는 대신 그 사람을 팀으로 옮깁니다. 이미 다른 팀에 승인된 사람은 건드리지 않습니다 —— 그 경우엔 명단에서 옮기세요.',
      },
    },

    dead: {
      title: '링크가 더 이상 듣지 않을 때',
      intro:
        '거부된 링크는 404 대신 페이지에서 스스로 이유를 설명합니다. 그래서 링크를 가진 사람이 어느 경우인지 당신에게 알려 줄 수 있습니다.',
      rows: [
        {
          term: 'This invite has been turned off.',
          body: '누군가 **Turn off**를 눌렀습니다. 새로 만드세요 —— 옛 링크가 돌아오는 일은 없습니다.',
        },
        {
          term: 'This invite has expired.',
          body: '설정한 시간에 도달했습니다. 하나 더 만드세요. 만료가 별 도움이 안 된다면 이번엔 `0`시간으로.',
        },
        {
          term: 'This invite is full.',
          body: '자리가 모두 찼습니다. 자리 수를 늘린 새 링크를 만들어 올리세요 —— 자리 수는 링크가 생긴 시점에 고정됩니다.',
        },
        {
          term: 'Sign-ups for this event aren’t open.',
          body: '스스로 풀릴 수 있는 유일한 경우입니다. 이벤트의 신청 기간을 확인하세요: 아직 안 열렸는지, 마감이 지났는지, 이미 시작했는지.',
        },
        {
          term: 'That invite belongs to a different event.',
          body: '다른 보드의 링크가 붙여진 것입니다. URL의 이벤트 id가 의도한 것인지 확인하세요.',
        },
      ],
      checklist: '이벤트 전에, 방문 클랜마다 이 목록을 한 번씩 훑어 주세요:',
      checklistItems: [
        '그 클랜의 팀이 존재하고, 클랜 이름이 붙어 있다',
        '주장이 지정되어 팀에 앉아 있다',
        '그쪽 관리자가 여기서 로그인했고 팀 스태프 자리를 갖고 있다',
        '링크가 만들어지고, 복사되고, 실제로 사람 손에 전달되었다',
        '신청 기간이 그들이 필요한 만큼 열려 있다',
      ],
      note: {
        tag: '모두 끝난 뒤',
        body: '링크를 끄고 팀 스태프 자리를 회수하세요. 둘 다 저절로 만료되지 않고, 끝난 이벤트에 살아 있는 링크는 그저 풀린 실 한 가닥일 뿐입니다.',
      },
    },
    cohost: {
      title: '공동 호스트라면',
      intro: '위 내용은 모두 호스트 쪽 설명입니다. 방문 클랜의 운영진은 이벤트를 위한 자신들만의 페이지 **Co-hosted with <host>**를 받습니다. 날짜, 초안, 팀, 그리고 누가 볼 수 있는지는 호스트가 관리합니다.',
      rows: [
        {
          term: '우리 클랜의 참가 신청',
          body: '우리 클랜 플레이어를 **Approve**, **Reject** 또는 **Withdraw**할 수 있습니다. 호스트 쪽 신청은 보거나 건드릴 수 없습니다.',
        },
        {
          term: '보드',
          body: '호스트가 운영진에게 권한을 준 경우에만 편집할 수 있습니다. 그렇지 않다면 **Suggest a tile**을 할 수 있습니다: 타일, 세부 내용, 점수를 적어 최대 25개까지 대기시킬 수 있습니다. 각 제안은 **waiting**, **accepted ✓** 또는 **turned down**으로 표시되며, 호스트의 사유가 함께 보입니다.',
        },
        {
          term: '우리 팀',
          body: '우리 클랜의 팀을 **Manage**하세요.',
        },
        {
          term: 'Discord',
          body: '우리 클랜 관리자가 자기 서버로 무엇이 전달될지 고릅니다: **Everything shared**, **Big moments** 또는 **Nothing**, 어떤 채널인지, 누구에게 멘션이 가는지, 그리고 우리 플레이어가 **@Bingo player** 역할을 받을지 여부.',
        },
      ],
    },
  },

  board: {
    metaTitle: '보드 만들기 — Anvil 칸 작성 가이드',
    metaDescription:
      '스스로 계산되는 빙고 칸 만들기: 각 종류가 실제로 볼 수 있는 것, 스프레드시트를 통한 대량 작성, 그리고 조용히 실패하는 실수들.',
    eyebrow: 'Anvil · 보드 제작자용',
    title: '스스로 기록하는 보드 만들기',
    dek: '칸이란 “무언가가 눈에 띌 것”이라는 약속입니다. 여기 적은 것은 각 종류가 실제로 무엇을 볼 수 있는지, 저녁을 통째로 날리지 않고 200개를 쓰는 법, 그리고 조용히 실패하는 몇 안 되는 실수들입니다 —— 칸은 그저 한 번도 발동하지 않고, 4일째까지 아무도 눈치채지 못합니다.',
    facts: [
      { strong: '15가지 종류', rest: '칸 하나에 하나씩, 섞을 수 없음' },
      { strong: '1000칸', rest: '보드당, 스프레드시트로' },
      { strong: '조용히', rest: '나쁜 칸은 그렇게 실패합니다' },
    ],
    footnote:
      '스프레드시트 형식은 `docs/tile-authoring.md`에 전부 적혀 있습니다. 그 문서는 행을 만들어 내는 사람(혹은 프로그램)을 위한 것입니다. 이 페이지는 사람 쪽의 절반입니다: 어떤 종류를 집어야 하는지, 그리고 무엇이 어긋나는지.',

    kinds: {
      title: '칸 하나, 종류 하나',
      body: [
        '모든 칸은 정확히 한 _종류_이고, 그 종류가 곧 전부입니다: 플러그인이나 hiscores 스윕이 무엇을 지켜볼지를 정하고, 따라서 그 칸이 애초에 스스로 완료될 수 있는지를 정합니다. 두 종류의 항목을 섞으면 받아들인 뒤 망가진 채 방치되는 대신 문 앞에서 거부됩니다.',
        '종류는 세 갈래로 나뉘고, 이름표보다 갈래가 더 중요합니다:',
      ],
      families: [
        {
          term: '수동',
          body: '사람이 스크린샷을 보고 “맞다”고 합니다. 언제나 쓸 수 있고, 언제나 작동하고, 언제나 누군가의 저녁을 잡아먹습니다. 소프트웨어가 볼 수 없는 것에 쓰세요.',
        },
        {
          term: 'Hiscores에서 읽어 오는 것',
          body: '스킬 경험치와 보스 처치 수를, 15분마다의 스윕으로 공식 Hiscores에서 읽습니다. 플러그인이 필요 없고 명단의 모든 사람에게 통하지만 —— Hiscores가 세는 것만 볼 수 있고, 그것도 플레이어가 로그아웃한 뒤에야 반영됩니다.',
        },
        {
          term: '플러그인이 감지하는 것',
          body: '그 외 전부: 드롭, NPC 처치, 시간 내 완료, diary, combat task, 랩, 전리품 가치. 몇 초 안에 계산되고 증빙 스크린샷까지 새겨 넣습니다 —— 다만 실제로 플러그인을 돌리는 플레이어에 한합니다.',
        },
      ],
      kindsIntro: '종류 선택기가 제시하는 순서 그대로의 전체 목록:',
      kindLabels: {
        standard: { label: '기본', blurb: '수동 칸 —— 주장이 완료로 표시합니다. 자동 기록은 없습니다.' },
        skill: { label: '스킬', blurb: '스킬이 경험치 목표에 도달하면 자동으로 완료됩니다(hiscores에서 읽음).' },
        boss: { label: '보스 처치 수', blurb: '보스가 처치 수 목표에 도달하면 자동으로 완료됩니다(hiscores에서 읽음).' },
        drop: { label: '드롭', blurb: '어떤 아이템(또는 풀 안의 아무거나)이 N번 드롭 —— 플러그인이 감지하고 스크린샷을 새겨 넣습니다.' },
        collection: { label: '아이템 세트', blurb: '여러 아이템 각각에 필요 수량 —— 하나씩 모으면 세트 완성.' },
        kill: { label: '처치', blurb: '아무 보스나 몬스터를 N마리 처치. 칸의 몬스터가 모두 hiscores에 있으면 hiscores에서, 아니면 플레이하는 동안 플러그인이 셉니다(닭, 소, 슬레이어 몹).' },
        lap: { label: '어질리티 랩', blurb: '어질리티 코스 N바퀴, 또는 Hallowed Sepulchre의 N층 / 완주 —— 게임 내 카운터로 실시간 집계. 이벤트 중에 돈 랩만 셉니다.' },
        pvp: { label: 'PvP 처치', blurb: '플레이어를 처치 —— 아무나, 상대 팀, 또는 지목된 현상금 대상을 —— 황무지나 PvP 월드에서. 안전한 미니게임은 절대 세지 않습니다.' },
        gain: { label: '아이템 획득', blurb: '어떤 아이템을 N개 잡거나, 요리하거나, 모으기 —— 인벤토리에 들어온 것으로 집계. 플러그인 감지.' },
        timed: { label: '시간제', blurb: '제한 시간 안에 활동을 완료(Inferno, 레이드, Colosseum). 플러그인이 시간을 잽니다.' },
        deathless: { label: '무사망', blurb: '파티 사망 0으로 레이드를 N회 완료. 플러그인이 인스턴스 안의 모든 사망을 셉니다.' },
        lms: { label: 'LMS', blurb: 'Last Man Standing에서 상위 N위(1 = 우승)를 M회. 경기 종료 시 플러그인이 감지합니다.' },
        value: { label: '전리품 가치', blurb: 'X gp어치 전리품 —— 한 번의 수확, 또는 합쳐서 목표에 닿는 여러 번. 플러그인이 값을 매깁니다.' },
        diary: { label: 'Diary', blurb: '이벤트 중에 achievement diary 등급을 완료. 완료 메시지로 플러그인이 감지합니다.' },
        ca: { label: 'Combat task', blurb: '이벤트 중에 Combat Achievement 과제를 완료. 완료 메시지로 플러그인이 감지합니다.' },
      },
      note: {
        tag: '플러그인 문제, 한 번만 짚고 갑니다',
        body: '플러그인이 감지하는 칸은 플러그인을 돌리지 않는 플레이어에게는 없는 것이나 마찬가지입니다. 설정으로 우회할 수 있는 결함이 아닙니다 —— 지켜보는 것이 아예 없으니까요. 클랜의 일부가 모바일이나 공식 클라이언트로 논다면, 그런 칸들을 승리로 가는 길목에서 빼거나, 수동 대안과 짝지어 두고 스크린샷 확인을 각오하세요.',
      },
    },

    pick: {
      title: '실제로 발동할 종류를 고르기',
      intro:
        '이상하게 구는 칸 대부분은 옳은 발상을 잘못된 종류로 표현한 것입니다. 사람들이 걸려 넘어지는 넷:',
      rows: [
        {
          term: '보스 목록에 hiscores 밖 몬스터 하나',
          body: '를 더하면 그 칸은 **통째로** 플러그인 칸이 됩니다. 처치 칸은 위의 몬스터가 모두 hiscores에 있을 때만 hiscores에서 셉니다. GWD 보스 넷에 닭 한 마리를 더하면 칸 전체에 플러그인이 필요합니다. 클랜에 플러그인 없이 하는 사람이 있다면 hiscores 보스는 따로 칸을 만드세요.',
        },
        {
          term: 'collection log 한 칸',
          body: '은 드롭 칸입니다. 로그 항목의 해금이 계산을 일으키므로, 플레이어가 이미 갖고 있던 중복에서도 칸이 발동합니다 —— 보통 그게 당신이 의도한 바일 겁니다.',
        },
        {
          term: '“각각 하나씩”',
          body: '은 아이템 목록이 있고 `requiredAmount`가 **없는** 드롭 칸입니다. `requiredAmount`를 더하면 조용히 “이 중 아무거나 N개”로 바뀝니다 —— 같은 행, 전혀 다른 칸입니다.',
        },
        {
          term: 'diary나 combat task',
          body: '는 게임 내 완료 메시지로만 계산되고, 그 메시지는 등급이나 과제가 끝나는 순간에만 뜹니다. 플레이어가 이미 가진 것은 다시 발동시킬 수 없습니다 —— 다만 combat task만은 **Settings → Combat Achievements → Repeat completion**으로 다시 발동시킬 수 있습니다.',
        },
      ],
      note: {
        tag: '복합 보스 칸',
        body: '보스 칸이 추적하는 항목에는 쉼표로 구분한 여러 hiscores 키를 넣을 수 있고, 진행도는 그 키들에 걸쳐 합산됩니다. `chambersOfXeric,chambersOfXericChallengeMode`는 CoX와 CM을 함께 세는 한 칸이고, 레이드 칸이 의도하는 바는 거의 항상 그것입니다.',
      },
    },

    bulk: {
      title: '브라우저 말고 한꺼번에 작성하세요',
      body: [
        '25칸 격자를 클릭으로 만드는 건 괜찮습니다. 과제 200개짜리 Point Hunt 보드를 클릭으로 만드는 건 아니고, 그걸 나중에 검수하는 건 더더욱 아닙니다. Tiles 탭에는 바로 그것을 위한 왕복 경로가 있습니다.',
      ],
      steps: [
        '이벤트의 **Board & tiles** 페이지에서 **Download spreadsheet**. 현재 보드 상태의 .xlsx가 나오고, 드롭다운·아이템 목록·열 설명이 각각 별도 시트에 들어 있습니다.',
        '편집합니다. 칸 하나에 한 행씩, 행 순서가 곧 칸 순서입니다.',
        '같은 탭에서 **Upload CSV / Excel**. 읽히는 것은 **Tiles** 시트뿐입니다.',
      ],
      rules: [
        {
          term: '왕복해도 아무것도 잃지 않습니다',
          body: '내려받아 그대로 다시 올리면 아무 일도 일어나지 않습니다 —— 일치하는 행은 “변경 없음”으로 보고되고 타임스탬프조차 다시 찍히지 않습니다. 덕분에 내보내기는 큰 수정 전의 안전한 백업이 됩니다.',
        },
        {
          term: '행이 위치에 대응합니다',
          body: '1행이 1번 칸. 기존 칸은 제자리에서 갱신되고, 빼먹은 열은 비워지는 대신 그대로 남습니다 —— 그래서 점수만 고치는 두 열짜리 시트를 보낼 수도 있습니다.',
        },
        {
          term: '커지는 것은 동적 보드뿐',
          body: '남는 행은 Point Hunt 보드나 칸 레이스에서 새 칸을 만듭니다. 이벤트 시작 전에 한해, 최대 1000까지. 클래식 N×N 격자는 형태가 고정이라 무시합니다. 수백 개의 과제를 만들 거라면 Point Hunt 이벤트로 하세요.',
        },
        {
          term: '전부 아니면 전무',
          body: '모든 행이 먼저 검증됩니다. 해석할 수 없는 아이템 이름이 하나만 있어도 가져오기 전체가 실패하고, 문제가 된 이름을 짚어 주고, 아무것도 바꾸지 않습니다 —— 절반짜리 보드가 남는 일은 없습니다.',
        },
        {
          term: '시작하면 잠기는 항목이 있습니다',
          body: '이름, 종류, 필요 수량, 아이템 설정은 이벤트 시작 전에만 반영됩니다. 설명, 점수, 분류, 선택 여부 표시는 끝까지 수정할 수 있어서, 보드를 다시 열지 않고도 이벤트 도중에 오타를 고칠 수 있습니다.',
        },
      ],
    },

    traps: {
      title: '조용히 실패하는 실수들',
      intro:
        '아래는 모두 깔끔하게 들어오고, 보드 위에서 멀쩡해 보이고, 한 번도 발동하지 않습니다. 업로드한 뒤보다는 _전에_ 한 번 읽어 둘 값어치가 있습니다.',
      rows: [
        {
          term: '스킬·보스 칸은 `type=standard`',
          body: '`type=skill` 같은 것은 없습니다. 종류는 나머지가 평범한 standard 행의 `trackedStat` + `statType` + `statGoal`에서 나옵니다. `type=boss`라고 쓰면 거부되지만, `type=standard`라고 쓰고 stat 열을 빠뜨리면 거부되지 않습니다 —— 아무도 승인하지 않을 수동 칸이 남습니다.',
        },
        {
          term: '구분자가 열마다 다릅니다',
          body: '`items`는 세미콜론(쉼표는 CSV 구분자니까). `targetNpcs`는 세로 막대. combat task 행에서는 세로 막대가 **유일한** 선택지입니다. 실제 과제 이름에 쉼표가 들어가기 때문이죠 —— `Nylocas, On the Rocks`가 하나의 과제입니다.',
        },
        {
          term: '레이드 이름은 글자 그대로 대조됩니다',
          body: '무사망·시간제 칸은 게임 내 표기 그대로를 담습니다: `Chambers of Xeric: Challenge Mode`, `Theatre of Blood: Hard Mode`, `Tombs of Amascut: Expert Mode`. 비슷한 철자는 영영 완료되지 않는 칸입니다. Entry Mode 클리어는 기본 레이드 칸을 절대 계산해 주지 않고, 더 높은 난이도는 계산해 줍니다.',
        },
        {
          term: '아이템 이름은 정확해야 합니다',
          body: '게임 내 철자 그대로여야 하며, 아니면 가져오기가 실패하고 해석하지 못한 이름을 나열합니다. 이름이 모호하면 `Name#id`로 못 박고 추측을 그만두세요.',
        },
        {
          term: '`timeThresholdSeconds`는 네 가지를 뜻합니다',
          body: '시간제 칸에서는 제한 시간, LMS 칸에서는 등수 상한(1 = 우승), 무사망 칸에서는 정확한 파티 인원, 드롭 칸에서는 정확한 레이드 파티 인원. 같은 열에 네 가지 의미 —— 당신의 종류가 실제로 읽는 쪽을 채우고 있는지 확인하세요.',
        },
        {
          term: '엉뚱한 종류에 필요 수량을 넣기',
          body: '그것은 드롭, 처치, 획득, 랩, PvP, 무사망, LMS 행에 속합니다. stat 행이나 시간제 행에서는 아무 일도 하지 않고, 드롭 행에서는 아이템 세트를 “아무거나 N개” 풀로 바꿔 버립니다.',
        },
      ],
      note: {
        tag: '200개를 쓰기 전에 하나를 시험해 보세요',
        body: '확신이 없는 종류의 칸을 딱 하나 만들고, 버리는 이벤트에서 공개한 뒤, 실제로 그 일을 해 보세요. 거기서 쓰는 5분이, 클랜 빙고 당일에 한 분류가 통째로 죽어 있었다는 걸 알게 되는 것보다 훨씬 낫습니다.',
      },
    },

    points: {
      title: '점수, 등급, 그리고 공정한가',
      body: [
        '점수제 보드에서는 각 칸이 자기 점수를 가지고, 그 점수는 이름 붙은 난이도 구간 —— easy에서 elite —— 에 대응됩니다. 클랜의 분류 방식이 다르다면 **Rules & scoring**에서 구간을 수정할 수 있습니다. 플레이어가 읽는 것은 구간이고, 점수가 되는 것은 숫자입니다.',
        '칸을 **optional**로 표시하면 보드 총점에서 빠집니다 —— 블랙아웃을 불가능하게 만들지 않으면서 도전 과제를 더하는 방법입니다.',
        '보드가 다 차면 Tiles 탭에서 **균형 점검기**를 돌리세요. 구조와 노력 분포를 살펴 보드가 어디로 기울었는지 —— 아무도 끝낼 수 없는 분류, 이웃보다 시간당 값이 훨씬 큰 구간 —— 을 알려 줍니다. 플레이어가 먼저 그걸 찾아내 돌아가기 전에 말이죠.',
      ],
    },

    reveal: {
      title: '당신이 말하기 전엔 아무도 못 봅니다',
      body: [
        '새 보드는 숨김으로 시작합니다. 운영진에게는 늘 보이지만 플레이어에게는 공개 전까지 아무것도 보이지 않습니다 —— 즉 며칠에 걸쳐, 멤버들이 읽을 수 있는 채널에서, 드러내 놓고 보드를 만들어도 아무것도 새지 않습니다.',
        '그 대문 스위치가 나머지 모든 것의 바닥입니다. 공개 정책이 붙은 보드 —— 예약, 간격, 현상금, 순환 —— 에서는 보드 자체가 공개된 뒤에야 엔진이 개별 칸을 뒤집기 시작합니다. 그래서 보드에 장전하는 것은 언제나 의도적인 행위입니다. 어떤 정책을 고를지는 전용 페이지에: [형식, 그리고 칸이 열리는 방식]({formatsGuide}).',
        '미션은 알아 둘 값어치가 있는 예외입니다: 미리 만들어 두되 감춰 둔 칸으로, 보드의 나머지는 계속 보이는 상태에서 이벤트 도중 전용 풀로부터 공지됩니다.',
      ],
    },

    check: {
      title: '공개하기 전에',
      intro: '보드마다 한 번은 훑어볼 값어치가 있습니다. 대부분은 5분이면 끝납니다.',
      items: [
        '각 칸이 깔끔하게 들어온 종류가 아니라 당신이 의도한 종류로 되어 있다',
        '레이드 모드, 아이템 이름, 과제 이름이 게임 내 철자와 한 글자까지 일치한다',
        '클랜의 일부가 플러그인 없이 논다면, 플러그인 감지 칸이 승리로 가는 유일한 길이 아니다',
        '점수가 설정되어 있고 균형 점검기가 만족한다 —— 혹은 의도적으로 그 의견에 반대한다',
        '선택 칸이 선택으로 표시되어 있다',
        '다시 올릴 수 있는 백업으로 스프레드시트를 한 번 내려받아 두었다',
      ],
      note: {
        tag: '누가 이 일을 할 수 있나',
        body: '칸 작성은 전용 역할이 있는 유일한 관리 업무입니다. **editor**는 칸을 만드는 것 말고는 아무것도 못 하고, 특정 보드로 한정할 수도 있습니다 —— 그래서 다른 클랜에서 초대한 제작자는 당신이 넘겨준 그 이벤트만 받게 되고, 당신이 굴리는 다른 어떤 것에도 접근하지 못합니다.',
      },
    },
    library: {
      title: '과제 라이브러리와 제안',
      body: [
        '타일 편집자는 관리자 메뉴의 **Task library**를 쓸 수 있습니다: 우리 클랜에 저장된 과제와, 복사해 올 수 있는 Anvil 자체 라이브러리. **⬇ Export pack**은 과제를 파일로 저장하고, **⬆ Import pack**은 파일을 불러옵니다. 보드를 클랜 사이에 옮길 때 이 방식을 씁니다.',
        'Anvil 라이브러리에서 잘못된 부분을 찾았거나 빠진 과제가 있나요? 과제에서 **Suggest a fix**를 누르거나 **Suggest a new task**를 누르세요. Anvil이 검토하며, 답변은 **Your suggestions** 아래에 **Waiting for review**, **Approved** 또는 **Not taken**과 메모로 표시됩니다. 대기 중인 제안은 5개까지 가능합니다. 승인된 수정은 라이브러리를 계속 따르는 모든 클랜 복사본에 반영됩니다.',
      ],
    },
    stats: {
      title: '시작 스탯과 늦게 합류한 플레이어',
      intro: 'XP와 처치 수 타일은 각 플레이어의 현재 스탯을 이벤트 시작 시 찍은 **starting stats**와 비교합니다. 이벤트의 **Stats** 페이지에서 이를 확인하고 고칠 수 있습니다:',
      rows: [
        {
          term: '시작 스탯 캡처',
          body: '시작 전에는 순위표(hiscores)만 미리 데울 뿐이며, 실제 시작선은 시작 시점에 잡힙니다. 시작 후에는 버튼이 **Capture late joiners**로 바뀌어, 그 뒤에 추가된 플레이어를 기록합니다. 30분에 한 번만 실행할 수 있습니다.',
        },
        {
          term: '지금 업데이트',
          body: '최신 수치로 순위를 새로 고칩니다. 순위도 한 시간마다 자동으로 새로 고쳐집니다.',
        },
        {
          term: '기준선 수정',
          body: '플레이어별로 스킬이나 보스의 시작 수치 하나를 직접 바꿉니다. 이벤트 시작 전에 로그아웃하지 않아서 시작 전 사냥이 집계되었을 때 사용하세요.',
        },
        {
          term: '모든 시작 스탯 재설정',
          body: '**Danger zone** 아래에 숨겨져 있습니다: 지금의 스탯으로 모든 사람의 시작선을 다시 잡아, 지금까지의 증가를 모두 지웁니다. 실수로 시작된 이벤트에만 사용하세요.',
        },
      ],
      outro: '그 아래 **Member breakdown**에서는 각 팀에서 누가 무엇을 했는지 보여 주고, **Stat tile standings**에서는 XP 또는 처치 타일마다 모든 플레이어의 시작 수치와 현재 수치를 보여 줍니다.',
    },
    race: {
      title: '타일 레이스 트랙',
      intro: '타일 레이스 보드에서는 그리드 대신 트랙을 만듭니다. 타일은 번호가 매겨진 단계에 놓이고, 팀은 그 단계를 따라 이동합니다.',
      body: [
        '**Tiles**를 열고 **Route** 섹션을 사용하세요. 템플릿을 고르고(기본값은 **Diamond**), 타일을 단계에 추가한 뒤 **Save route**를 누르세요. 연결하는 모든 타일은 다음 단계에 있어야 합니다.',
        '길은 나뉘었다가 합쳐질 수 있지만 결승선은 하나입니다. 갈림길에서는 타일 완료 시 길이 정해질지, 아니면 캡틴이 골라서 확정할지 선택합니다. 전체 선택지와 플레이어가 보는 내용은 [Formats, and how tiles open]({formatsGuide})에 있습니다.',
      ],
    },
  },

  captain: {
    metaTitle: '주장 가이드 — Anvil',
    metaDescription:
      '드래프트 당일과 그 뒤 몇 주: 시계가 돌기 전에 후보를 읽고, 지명하고, 팀의 명단·증빙·참가비를 굴리는 법.',
    eyebrow: 'Anvil · 주장용',
    title: '주장 가이드',
    dek: '작전실과 시계, 그리고 낯선 스물다섯 명의 신청서를 손에 쥐여 줍니다. 여기에 적은 것은 그 전부가 실제로 무엇을 하는지를, 당신이 마주치는 순서 그대로 —— 더해서, 드래프트가 끝난 뒤에야 시작되는 팀 운영의 몫까지.',
    facts: [
      { strong: '스네이크 순서', rest: '늦은 지명이 상쇄되도록' },
      { strong: '시계는', rest: '결코 대신 지명해 주지 않습니다' },
      { strong: '탭 하나', rest: '로 이벤트 내내 팀을 굴립니다' },
    ],
    footnote:
      '여기 있는 것은 전부 주장에게 보이는 것들입니다. 참가비, 다른 팀의 명단, 공개 전 보드는 운영진의 것이고 앞으로도 그렇습니다 —— 그러니 이 페이지의 내용 때문에 “보면 안 될 것을 봤다”는 의심을 살 일은 없습니다.',

    before: {
      title: '무엇을, 언제 받게 되는가',
      body: [
        '주최자가 당신을 주장으로 지정하면 두 가지 일이 일어납니다: 플레이어로서 팀에 앉게 되고, 팀의 화면들이 열립니다. 만약 팀 페이지가 “사실은 명단에 없다”고 경고한다면 제시되는 수정을 받아들이세요 —— 자기 팀 바깥에 있는 주장이라는 상태는 그 아래 모든 화면을 헷갈리게 만듭니다.',
        '그 뒤로 갈 곳은 둘입니다. **My Team**은 팀의 거점이고, 이벤트 내내 여기서 지냅니다. **작전실**은 드래프트 당일의 화면이며, 신청이 열리는 순간부터 열립니다 —— 드래프트 당일 밤보다 한참 전에.',
      ],
      note: {
        tag: '일찍 들어가세요',
        body: '작전실이 가장 쓸모 있는 때는 드래프트 _전_ 며칠입니다. 그때라야 신청서를 하나하나 제대로 읽을 수 있습니다. 당일 밤에는 그저 스톱워치가 되고, 뭔가를 읽을 여유는 없습니다.',
      },
    },

    warroom: {
      title: '시계가 돌기 전에 후보를 읽어 두세요',
      body: [
        '작전실에는 지명할 수 있는 모든 사람과, 사이트가 그들에 대해 아는 모든 것이 나옵니다: 무엇을 플레이하는지, 실제 처치 수를 가진 보스는 어느 것인지, 지난 이벤트에 몇 번이나 나왔는지, 그리고 신청서에 적은 답변들.',
        '그 답변은 **제출된 그대로 얼어붙어** 있습니다. 누가 먼저 뽑혔는지를 본 뒤에 “주당 시간”을 고치는 사람은 없습니다 —— 그것이 이 답변을 읽을 값어치가 있는 이유의 전부입니다.',
        '읽으면서 **후보 목록**을 만들어 두세요. 당신만 보고, 드래프트 당일까지 남아 있으며, 그날 밤에는 “이미 신뢰하는 목록에서 고르는 것”과 “화면 맨 위에 있는 사람을 고르는 것”의 차이가 됩니다.',
      ],
      rows: [
        {
          term: '평가와 등급',
          body: '그 사람이 실제로 해 온 것의 요약으로, 본인의 말이 아니라 계정 이력에서 도출됩니다. 참고용일 뿐 —— 대화의 출발점이지 판결이 아닙니다.',
        },
        {
          term: '영역과 표식',
          body: '증명 가능한 활동: 레이드, PvM, 스킬링, PvP. 가장 큰 숫자를 네 번 고르는 대신 자기 팀의 빈틈을 찾는 데 쓰세요.',
        },
        {
          term: '참석률',
          body: '신청했던 지난 이벤트를 실제로 끝까지 했는지의 비율. 페이지에서 가장 눈에 안 띄는 숫자이면서, 대개 가장 잘 맞는 숫자입니다.',
        },
      ],
    },

    draft: {
      title: '드래프트 당일',
      body: [
        '지명은 **스네이크 순서**로 진행됩니다: 네 팀이면 1라운드는 A, B, C, D, 2라운드는 D, C, B, A —— 즉 한 라운드에서 마지막으로 고른다는 건 다음 라운드에서 가장 먼저 고른다는 뜻입니다. 1순위를 뽑은 사람은 1분 뒤에 그 값을 치릅니다.',
        '한 사람이 한 지명이지, 한 계정이 한 지명이 아닙니다. 누군가를 데려오면 그 사람이 등록한 계정이 전부 함께 당신 팀으로 들어옵니다 —— 누군가의 부계정에 두 번째 지명을 쓰는 일은 없습니다.',
      ],
      rows: [
        {
          term: '지명 타이머',
          body: '주최자가 설정했다면 차례마다 그만큼의 초가 주어집니다. 시간이 다 되어도 대신 **지명하지는 않습니다** —— 주최자가 당신을 대신해 지명할 수 있게 열릴 뿐이고, 그 사실이 양쪽 화면에 표시됩니다. 조용히 벌어지는 일은 없습니다.',
        },
        {
          term: '좁혀진 목록',
          body: '일부 이벤트는 균형 모드로 돌아갑니다. 어느 모드냐에 따라, 상대가 상위 등급을 한 명도 갖지 못한 동안 최강 팀이 한 명 더 데려가는 것이 막히거나, 평균보다 얼마나 위로 갈 수 있는지에 상한이 걸립니다. 원하던 사람이 흐리게 보인다면 그 때문이고, 모두에게 똑같이 적용됩니다.',
        },
        {
          term: '그 시간에 못 나온다면',
          body: '미리 주최자에게 말해 두세요. 같은 화면에서 당신을 대신해 지명할 수 있고, 남겨 둔 후보 목록이 곧 그가 따를 지시가 됩니다.',
        },
      ],
      note: {
        tag: '드래프트가 명단을 고정합니다',
        body: '드래프트가 돌기 시작하면 팀도 지명 순서도 얼어붙습니다. 팀이 빠졌거나 순서가 틀렸다면 첫 지명 _전에_ 바로잡아야 합니다.',
      },
    },

    roster: {
      title: '이벤트 내내 쓰는 팀 거점',
      intro:
        '**My Team**의 **Manage this team** 카드에 자기 쪽을 위해 할 수 있는 모든 것이 들어 있습니다. 처음엔 접혀 있고, 한 번 펼치면 그 상태로 남습니다.',
      rows: [
        {
          term: 'Roster',
          body: '팀에 누가 있고 각자 무엇을 기여했는지. 누가 “내 드롭이 왜 안 세어졌냐”고 물을 때 가장 먼저 볼 곳입니다 —— 연결되지 않은 계정이 여기서 드러납니다.',
        },
        {
          term: 'Requests',
          body: '플레이어가 직접 팀을 고르는 형식의 이벤트에서, 합류를 요청한 사람들. 있을 때만 나타납니다.',
        },
        {
          term: 'Proof',
          body: '팀의 제출물과 스크린샷. 최종 승인은 당신이 아니라 운영진이 하지만, 무엇이 보내졌는지 볼 수 있고 아직 안 보낸 것을 재촉할 수 있습니다.',
        },
        {
          term: 'Fees',
          body: '팀에서 아직 참가비를 내지 않은 사람. 납부 완료로 표시할 수는 있지만, 그것을 확인하는 일은 의도적으로 운영진의 몫입니다.',
        },
        {
          term: 'Invite links',
          body: '주최자가 주장에게 직접 만들 권한을 준 경우에 나타납니다. 링크 하나로 그것을 여는 사람을 바로 당신 팀에 앉힐 수 있습니다. 링크가 실제로 무엇을 하는지는 [방문 클랜 맞이하기]({clanVsClanGuide}) 참고.',
        },
      ],
    },

    during: {
      title: '시작된 뒤의 운영',
      body: [
        '이벤트의 대부분은 알아서 굴러갑니다: 플러그인이 볼 수 있는 것을 계산하고, 도장이 찍힌 스크린샷을 함께 보관합니다. 남는 것은 사람이고, 그게 바로 일입니다.',
        '진짜로 주장이 필요한 것들: 시작 전에 우리 쪽 모두가 플러그인을 연결하고 계정을 이어 두었는지 확인하기(연결되지 않은 부계정은 아무 데도 기여하지 못합니다), 절반쯤 지났을 때 아무도 건드리지 않은 칸을 알아채기, 그리고 모두가 한꺼번에 달려드는 마지막 한 시간 전에 수동 칸 사진을 다 찍어 두게 하기.',
        '이벤트가 시작 인증샷을 요구한다면, 그건 첫 몇 시간 안에 각 플레이어가 스스로 해야 하는 유일한 일입니다. 일찍부터 재촉하세요 —— 내지 않은 플레이어는 주최자 설정에 따라 모든 기여가 확인 대기로 표시되거나 아예 거부됩니다.',
      ],
      note: {
        tag: '교체에 대해',
        body: '이벤트가 시작된 뒤에는 관리자만 교체할 수 있고, 이는 의도적입니다: 기여가 이미 사람에게 붙어 있으니까요. 우회할 방법을 궁리하지 말고 주최자에게 물어보세요.',
      },
    },
  },

  formats: {
    metaTitle: '형식, 그리고 칸이 열리는 방식 — Anvil',
    metaDescription:
      '일곱 가지 이벤트 형식, 칸이 열릴 수 있는 다섯 가지 방식, 그리고 점수 보정 —— 각각이 이벤트의 감촉을 어떻게 바꾸는가.',
    eyebrow: 'Anvil · 클랜 운영진용',
    title: '형식, 그리고 칸이 열리는 방식',
    dek: '안에 든 어떤 칸보다도 이벤트를 크게 좌우하는 결정이 둘 있습니다: 보드가 어떤 형태인가, 그리고 칸이 어떻게 플레이 가능해지는가. 둘은 서로 독립적이고 —— 어떤 형식이든 어떤 공개 정책과도 짝지을 수 있습니다 —— 합쳐지면 “한 주짜리 노동”과 “하룻밤의 경주”만큼 차이가 납니다.',
    facts: [
      { strong: '7가지 형식', rest: '보드의 형태' },
      { strong: '5가지 정책', rest: '칸이 열리는 방식' },
      { strong: '3가지 보정', rest: '완료 한 번의 값' },
    ],
    footnote:
      '형식은 생성 시에 정해지지만 이후 이벤트의 Settings → Event 탭에서 바꿀 수 있습니다. 공개 정책과 점수 보정은, 영향을 받는 칸이 공개되기 전이라면 언제든 바꿀 수 있습니다.',

    shape: {
      title: '보드의 형태',
      intro:
        '형식은 보드의 채점 방식과, 생성 양식이 다음에 무엇을 물을지를 정합니다. 이 페이지의 나머지는 모두 그 위에 얹힙니다.',
      note: {
        tag: '고정 격자인가, 과제 목록인가',
        body: '**클래식** 보드는 진짜 정사각형이라 “N이 5”면 정확히 25칸이고, 그 수는 결코 바뀌지 않습니다. 그 밖의 모든 것은 길이 제한 없는 과제 목록이고, 스프레드시트 가져오기로 키울 수 있는 유일한 보드 종류이기도 합니다. 과제 백 개를 만들 생각이라면 그 결정은 바로 여기서 내려집니다.',
      },
    },

    reveal: {
      title: '칸이 열리는 방식',
      intro:
        '형식과는 별개입니다. 이벤트 단위의 공개 스위치는 여전히 대문입니다 —— 보드가 숨겨져 있는 동안에는 아무것도 보이지 않고 이 엔진들도 전혀 돌지 않으므로, 보드에 장전하는 것은 언제나 의도적인 행위입니다.',
      rows: [
        {
          term: '한꺼번에 공개',
          body: '고전적인 방식. 보드를 공개하는 순간부터 모든 칸이 플레이 가능하고, 순서는 팀이 알아서 정합니다. 그러지 않을 이유가 없다면 이것을 고르세요.',
        },
        {
          term: '예약 공개',
          body: '각 칸이 자기 공개 시각을 갖고(Tiles 탭에서 설정) 그 시각이 지나면 열립니다. “시간마다 한 칸”식 보드: 박자를 대신 정해 주는 대신, 시각을 미리 적어 두어야 합니다.',
        },
        {
          term: '간격 공개',
          body: '엔진이 일정 간격으로 숨겨진 칸을 뽑습니다 —— N분마다 한 묶음씩, 무작위로 또는 보드 순서로. 빙고 사회자 같은 방식입니다. 칸 자체 말고는 추가 작업이 없고, 당신이 자는 동안 보드가 스스로 공개됩니다.',
        },
        {
          term: '현상금',
          body: '열려 있는 칸이 정확히 하나뿐이고, 먼저 끝낸 팀이 가져갑니다 —— 칸이 닫히고 다음 것이 곧바로 뽑힙니다. 가차 없고, 보는 재미가 크고, 시간대에는 인정이 없습니다.',
        },
        {
          term: '순환',
          body: '몇 칸이 열려 있는 이동 창: 뽑을 때마다 새 칸이 열리고 가장 오래된 것이 만료됩니다. 현상금과 달리, 사라지기 전에 모두가 열린 칸을 끝낼 여유가 있습니다. 개인 래더를 위해 설계된 방식입니다.',
        },
      ],
      note: {
        tag: '시간대 문제',
        body: '현상금과 간격 공개 보드는 마침 깨어 있는 사람에게 보상합니다. 세계 곳곳에 흩어진 클랜에서 그것은 플레이가 아니라 시계가 나눠 주는 실제 이점입니다. 순환 창은 그것을 누그러뜨립니다 —— 열린 칸은 창이 유지되는 동안 계속 열려 있어서, 자고 있는 플레이어에게도 기회가 남습니다.',
      },
    },

    scoring: {
      title: '완료 한 번의 값',
      intro:
        '보정은 셋. 모두 점수제 모드에서만 작동하고, 모두 완료가 일어나는 그 순간 완료 기록에 얼어붙습니다 —— 그래서 나중에 설정을 바꿔도 과거가 다시 쓰이는 일은 결코 없습니다.',
      rows: [
        {
          term: '선착 팀 보너스',
          body: '각 칸을 처음 끝낸 팀에게 주는 추가 점수. 모든 것이 보이는 보드에 경주의 감각을 입히는 가장 값싼 방법이고, 다른 것은 전혀 건드리지 않아도 됩니다.',
        },
        {
          term: '가치 감소',
          body: '칸의 값이 공개 시점의 100%에서 N시간 뒤 목표 비율까지 직선으로 변한 뒤 그대로 유지됩니다. 100% 미만이면 줄어들며 속도에 보상하고, 100%를 넘으면 **늘어나며** 모두가 건너뛴 오래된 과제를 치우는 데 보상합니다. 늘어나는 방향이야말로 존재 자체를 잊히는 쪽입니다.',
        },
        {
          term: '락아웃',
          body: '첫 완료가 그 칸을 다른 모든 팀에게 닫아 버립니다. 현상금에서는 기본으로 포함됩니다. 팀 간 실력 차가 큰 보드에서는 승부가 일찍 갈릴 수 있어 —— 팀들이 팽팽할 때 가장 빛납니다.',
        },
      ],
    },

    missions: {
      title: '미션: 이벤트 도중의 깜짝 요소',
      body: [
        '미션은 미리 만들어 두되 감춰 둔 칸으로, 보드의 나머지는 계속 보이는 채로 전용 풀에서 공지됩니다. 공개 정책과는 독립적이라, 모두 보이는 평범한 빙고에도 넣을 수 있습니다.',
        '보드가 조용해지면 손으로 떨어뜨리거나, 일정 간격으로, 혹은 미션마다의 예정표에 따라. 각 미션은 자기 채점 방식을 지닙니다: 자기만의 락아웃, 보너스, 가치 감소, 만료를 이벤트 단위가 아니라 칸 단위로 설정합니다.',
        '5일째에 보드를 깨우는 가장 값싼 방법이고 —— 5일째야말로 긴 이벤트가 반드시 깨워져야 하는 날입니다.',
      ],
    },

    choose: {
      title: '한 페이지로 고르기',
      intro: '원하는 감촉을 이미 알고 있다면, 이것이 거기까지 가는 가장 짧은 길입니다.',
      rows: [
        { term: '평범한 클랜 빙고', body: '클래식 격자, 모든 칸 공개. 약간의 조급함을 원한다면 선착 팀 보너스를 얹으세요.' },
        { term: '수백 개 과제를 난이도로 채점', body: 'Point Hunt, 전부 공개. 큰 스프레드시트 가져오기가 자랄 수 있는 유일한 형태이기도 합니다.' },
        { term: '한 주에 걸쳐 고조되는 흐름', body: 'Point Hunt에 예약 또는 간격 공개를 얹어, 한꺼번에가 아니라 한 주에 걸쳐 보드가 열리게.' },
        { term: '사람들이 실시간으로 지켜보는 하룻밤', body: '현상금. 칸 하나, 먼저 끝낸 팀이 가져가고, 곧바로 다음 칸.' },
        { term: '팀전이 아니라 개인전', body: '래더에 순환 창과 가치 감소. 과제가 오갔다 사라지고 아무도 쌓아 둘 수 없습니다.' },
        { term: '결승선이 있는 경주', body: '칸 레이스 —— 순서가 정해진 코스에서 가장 멀리 간 팀이 승리.' },
      ],
      outro:
        '무엇을 고르든 칸 자체를 만드는 일은 똑같습니다: [스스로 기록하는 보드 만들기]({boardGuide}) 참고.',
    },
    race: {
      title: '타일 레이스 경로',
      intro: '타일 레이스는 번호가 매겨진 단계로 이루어진 트랙입니다. 팀은 단계별로 이동하며, 가장 멀리 간 팀이 이깁니다. 호스트는 트랙을 길이 나뉘고 합쳐지는 지도로 바꿀 수 있습니다.',
      body: ['모든 경로에는 시작점 하나, 나뉘고 합쳐질 수 있는 길, 결승선 하나가 있습니다. 모든 길의 길이는 같습니다. 팀의 진행 상황은 지금까지 걸은 길입니다.'],
      rows: [
        {
          term: '달성 순서',
          body: '현재 타일 이후의 모든 타일이 열립니다. 팀이 처음 완료한 타일이 그 팀의 길을 정하고, 나머지는 그 팀에게 닫힙니다.',
        },
        {
          term: '선택 후 확정',
          body:
            '캡틴(또는 팀 스태프)이 아무것도 집계되기 전에 **Pick this road**로 다음 타일을 고릅니다. 열리는 것은 선택뿐입니다. 선택은 관리자 초기화를 제외하고 되돌릴 수 없습니다.',
        },
        {
          term: '이른 완료 보관',
          body:
            '기본적으로 꺼져 있어, 팀의 길 위에 열린 타일만 집계됩니다. 켜면 팀이 아직 도달하지 않은 타일에서의 완료가 보관됩니다. 길이 그곳에 도달하면 완료 처리됩니다. 앞서 있는 팀을 건너뛰거나 무언가를 미리 열지는 않습니다.',
        },
      ],
      steps: [
        '이벤트의 **Tiles** 페이지를 열고 **Route**를 찾으세요.',
        '**Route template**을 고르고 **Apply template**을 누르세요. 기본값은 **Diamond**로, 시작점 하나, 길 두 개, 결승선 하나입니다. **Two roads**, **Braid**, **Straight line**, **Free**(링크 없음)도 있습니다.',
        '**How a team’s road is set at a fork**를 고르세요: 달성 순서, 또는 선택 후 확정.',
        '**+ Step before**, **Move step earlier/later**, **Remove step**으로 단계를 추가하거나 옮긴 뒤 **Save route**를 누르세요.',
        '이벤트가 이미 진행 중이면 Anvil이 새 경로에서 잘려 나가는 완료를 어떻게 할지 묻습니다: **Keep**(유지) 또는 **Roll back**(되돌리기).',
      ],
      outro:
        '플레이어는 이벤트 페이지에서 **Race track**을 보며, 자기 팀 타일에 금색 **You** 마커가 표시됩니다. **Fullscreen board**로 크게 볼 수 있고, **Esc**로 닫습니다. 플러그인에서는 사이드 패널에 **Your road**와 **After that**이 표시됩니다.',
    },
  },

  fees: {
    metaTitle: '참가비와 상금 — Anvil 회계 담당 가이드',
    metaDescription:
      '참가비를 정하고, 걷고, 그것을 마무리 짓는 두 번째 서명, 그리고 상금 풀을 지급된 순위로 바꾸기까지.',
    eyebrow: 'Anvil · 회계 담당용',
    title: '참가비와 상금',
    dek: '클랜 이벤트가 어긋나는 지점은 돈이고, 게다가 조용히 어긋납니다: 본인은 냈다고 단언하는 참가비, 아무도 맞출 수 없는 상금 풀, 우승자들이 접속을 끊은 뒤에야 벌어지는 분배 논쟁. 이것은 단계마다 흔적이 남는 경로입니다.',
    facts: [
      { strong: '서명 2개', rest: '가 기본값에서 한 건을 마무리합니다' },
      { strong: '풀 = 추가분', rest: '+ 참가비 × 승인된 신청 수' },
      { strong: '1행', rest: '지급받는 사람 한 명당' },
    ],
    footnote:
      '참가비와 상금은 회계 담당의 영역입니다. 회계 담당은 관리자가 할 수 있는 모든 것에 더해 이것도 할 수 있고, 평범한 관리자에게는 참가비 페이지가 아예 보이지 않습니다.',

    set: {
      title: '참가비 정하기',
      body: [
        '참가비는 이벤트에 붙어 있고, 생성할 때 정하거나 **Sign-ups** 탭에서 수정합니다. 참가비를 아예 두지 않는 것도 완전히 타당한 답입니다 —— 주최자가 넣은 풀만으로 돌아가는 이벤트도 많습니다.',
        '참가비가 실제로 무엇을 뜻하는지 정하는 설정이 둘 있고, 둘 다 지나치기 쉽습니다:',
      ],
      rows: [
        {
          term: '사람 단위인가, 계정 단위인가',
          body: '여러 계정으로 참가할 수 있는 이벤트에서, 한 번만 내는지 계정마다 내는지를 이것이 정합니다. 잘못 잡으면 환불하게 됩니다.',
        },
        {
          term: '납부 마감',
          body: '이 시각이 지나면 미납 신청은 “쫓아다닐 대상”이 아니라 “판단할 대상”이 됩니다. 생각보다 이르게 잡으세요 —— 이벤트 전날은 대체자를 구하기엔 너무 늦습니다.',
        },
        {
          term: '게스트 참가비',
          body: '보드를 운영하는 클랜의 멤버가 아닌 플레이어가 내는 금액입니다. 비워 두면 게스트도 멤버 참가비를 냅니다. 한 플레이어만 다른 금액을 받으려면 **Sign-ups**에서 그 사람 줄의 **Change this player’s fee**를 누르세요.',
        },
      ],
      note: {
        tag: '풀은 신청을 따라갑니다',
        body: '표시되는 상금 풀은 당신이 직접 넣은 금액에, 참가비 × **승인된** 신청 수를 더한 값입니다. 신청이 승인되고 제외될 때마다 움직이므로, 페이지의 숫자는 언제나 “실제로 지급할 수 있는 금액”입니다.',
      },
    },

    collect: {
      title: '걷기',
      body: [
        '참가비는 클랜이 원래 돈을 걷던 방식 그대로 걷으면 됩니다 —— 게임 안에서든, Discord에서든. Anvil의 일은 돈이 도착한 순간부터 시작됩니다: 운영 권한이 있는 누군가가 **납부 완료**로 표시하면, 누가 받았다고 말하는지와 그 시각이 새겨집니다.',
        '플레이어에게도 발언권이 있습니다. 멤버는 누구에게 냈는지 신고하고 스크린샷을 붙일 수 있습니다 —— 바로 그것이 “분명히 냈다”를 양쪽 끝이 있는 기록으로 바꿉니다. 플레이어의 신고와 수령자의 주장이 서로 다른 사람을 가리키면, 그건 다툼 도중에 알게 되는 불일치가 아니라 사이트가 당신에게 보여 줄 수 있는 불일치가 됩니다.',
        '독촉은 버튼 하나면 됩니다: 관리 → **Fees**의 **Remind unpaid**가 그 이벤트에서 아직 내지 않은 모두에게 Discord DM을 보냅니다.',
      ],
      note: {
        tag: '증빙은 의도적으로 삭제됩니다',
        body: '납부 스크린샷은 해당 참가비가 마무리될 때까지만 보관되고 그 뒤 삭제됩니다. 의견 차이를 푸는 용도이지, 1년 동안 보관함에 눕혀 두려는 것이 아닙니다.',
      },
    },

    sign: {
      title: '두 번째 서명',
      body: [
        '참가비는 _다른_ 운영진이 도착을 확인해 줄 때까지 **수령함** 상태로 남습니다. 돈을 다룬 사람이 그것이 도착했다고 서명하는 사람을 겸할 수는 없습니다 —— 그게 이 통제의 전부이고, 그래서 사이트는 수령자 본인의 확인을 권장하지 않는 정도가 아니라 아예 거부합니다.',
        '한 건에 서명이 몇 개 필요한지는 클랜 설정(**Clan settings → Rules & scoring → Fee sign-off**)이고 0에서 5까지입니다. 0이 존재하는 데는 진짜 이유가 있습니다: 회계 담당이 _곧 소유자_인 클랜에는 서명해 줄 다른 사람이 없고, “34건이 두 번째 서명 대기 중”은 결코 비워지지 않는 줄이 되어 대시보드에서 영원히 가장 시끄러운 것이 됩니다. 0일 때는 납부 완료로 표시하는 행위 **자체가** 서명입니다.',
        '두 명이라면 1 —— 기본값 —— 로 두세요. 솔직히 두 명이 아니라면 0으로. 그보다 높이는 것은 인원과 이유가 둘 다 있을 때뿐입니다.',
      ],
    },

    pay: {
      title: '지급하기',
      body: [
        '이벤트가 끝나면 이벤트의 **Prizes** 페이지가 상금 풀을 사람 목록으로 바꿉니다. 생성하면 팀 단위가 아니라 수령자 단위로 한 줄씩 나옵니다: 우승 팀의 상금은 구성원끼리 균등하게 나뉘므로, 지급은 한밤중의 산수 문제가 아니라 이름과 숫자의 목록이 됩니다.',
        '금액은 제안된 분배에서 시작합니다 —— 상위에 무겁게, 그리고 지급 순위를 늘릴수록 평평해집니다 —— 그리고 각 줄은 수정할 수 있습니다. 제안은 출발점이지 방침이 아닙니다.',
        '그다음엔 지급하면서 줄을 하나씩 체크해 나가면 됩니다. 요점은, 일주일 뒤 누구든 이 목록을 보고 “누가 얼마를 받았는지” 알 수 있다는 것 —— Discord 기록에서 재구성할 필요가 없다는 것입니다.',
      ],
      note: {
        tag: '여기서 한 번만 공지하세요',
        body: '지급은 이벤트 자체에서 Discord 채널로 올라가므로, 공지와 기록이 같은 것이 됩니다. 손으로 공지한 상금은, 나중에 누군가가 “못 받았다”고 말하게 되는 종류의 상금입니다.',
      },
    },

    disputes: {
      title: '숫자가 맞지 않을 때',
      intro: '실제로 마주치게 되는 넷:',
      rows: [
        {
          term: '냈다고 하는데 아무도 표시하지 않았다',
          body: '스크린샷과 함께 납부를 신고해 달라고 하세요. 그러면 기록에 이름이 명시된 수령자와 시각이 남고, 지목된 사람이 인정하거나 부인할 수 있습니다.',
        },
        {
          term: '운영진 둘이 서로 자기가 받았다고 생각한다',
          body: '플레이어 본인의 신고가 결정타입니다 —— 누구에게 건넸는지가 적혀 있으니까요. 수령자를 바로잡은 뒤 마무리하세요.',
        },
        {
          term: '서명을 기다리며 멈춰 있다',
          body: '정말로 다른 사람을 기다리고 있거나, “필요한 확인 수” 설정이 전제하는 인원보다 클랜의 운영진이 적은 것입니다. 자기 수령을 자기가 확인하는 대신 설정을 낮추세요.',
        },
        {
          term: '알린 뒤에 풀이 바뀌었다',
          body: '풀은 승인된 신청을 따라가므로, 신청을 승인하거나 제외하면 움직입니다. 신청이 열린 시점이 아니라 마감된 시점의 풀을 말해 주세요.',
        },
      ],
    },
  },

  coffer: {
    metaTitle: '클랜 금고 — Anvil 회계 담당 가이드',
    metaDescription:
      'Anvil의 클랜 gp 금고: 기부를 기록하고 낸 사람 이름으로 남기기, 상금이 지급되는 세 가지 길, 누가 돈을 옮길 수 있는지, 그리고 금고가 모자랄 때 벌어지는 일.',
    eyebrow: 'Anvil · 회계 담당용',
    title: '클랜 금고',
    dek: '대부분의 클랜은 gp를 누군가의 은행에, 장부를 누군가의 기억에 둡니다. 금고는 하나의 통이고, 움직임마다 한 줄이 남습니다 — 누가 냈는지, 무엇에 약속되었는지, 실제로 누가 보냈는지.',
    facts: [
      { strong: '숫자 3개', rest: '보유, 묶임, 약속 가능' },
      { strong: '나가는 길 3개', rest: '주간 대회, 미션 칸, 보드의 상금 풀' },
      { strong: '회계 담당', rest: '또는 관리자 — 직급만으로는 안 됨' },
    ],
    footnote:
      '여기 있는 내용은 모두 Admin → **Coffer**에 있습니다. 상금 사다리만 예외로, 값이 치러지는 대상 쪽에 붙어 있습니다. 공개된 절반은 `/coffer` — 잔액, 기부 순위, 최근 움직임을 멤버에게 보여주는 페이지입니다.',

    what: {
      title: '무엇인가',
      body: [
        '지갑이 아니라 장부입니다. Anvil은 여러분의 gp를 절대 보관하지 않습니다 — gp는 클랜이 이미 두고 있는 곳에 그대로 있습니다 — 그러니 금고는 무엇이 들어왔고, 무엇이 약속되었으며, 실제로 무엇이 건네졌는지에 대한 기록입니다. 약속과 지급이 서로 다른 줄이라는 점이 그 쓸모입니다.',
        '페이지는 세 개의 숫자로 시작합니다. 셋인 이유는 서로 다른 세 가지 질문에 답하기 때문입니다.',
      ],
      rows: [
        {
          term: '보유',
          body: '승인된 기부와 조정. 클랜이 받은 것에서 손실 처리한 것을 뺀 값.',
        },
        {
          term: '묶임',
          body: '어떤 상금이 걸어둔 gp — 이겼지만 아직 보내지 않은 몫과, 보드를 위해 떼어둔 풀. 아직 누군가의 은행에 있어도 임자는 정해져 있습니다.',
        },
        {
          term: '약속 가능',
          body: '보유에서 묶임을 뺀 값. 새 상금이 대조되는 유일한 숫자입니다. 그러지 않으면 회계 담당이 자는 사이 같은 5천만을 두 명의 우승자에게 약속하게 됩니다.',
        },
      ],
      note: {
        tag: '대기 중인 기부는 어디에도 세지 않는다',
        body: '누군가 「1억 냈다」고 적는 것은 과거에 대한 주장이지 은행 속 gp가 아닙니다. 스태프가 인정하기 전까지 세 숫자 어디에도 들어가지 않으므로, 나중에 지급할 수 없는 상금을 떠받치는 일은 결코 없습니다.',
      },
    },

    inbound: {
      title: 'gp를 들여오기',
      body: [
        '평소의 경로는 RuneLite 플러그인이 자동으로 처리합니다. 게임 안에서 Clan Coffer를 열면 Anvil이 실제 코인 잔액을 보고 입금과 출금을 기록합니다. 처음 본 금액은 기준점일 뿐이며, 연 사람이 안에 있던 돈을 전부 기부한 것처럼 꾸미지 않습니다.',
        '수동 기록은 아무도 플러그인을 켜 두지 않은 사이에 일어난 일을 위해 남아 있습니다. 멤버는 `/coffer`에서 자기 기부를 신고하고 스태프가 믿어주기를 기다립니다. 회계 담당은 이미 도착한 것을 기록하는데, 그 입력 **자체가** 승인입니다.',
        '어느 쪽이든 기부는 **사람**에게 귀속됩니다. 이는 들리는 것보다 무겁습니다. 공개 페이지의 기부 순위는 대다수 기부자가 받는 유일한 감사이고, 「클랜」 이름으로 들어온 gp는 아무에게도 고마움을 표하지 않습니다.',
      ],
      rows: [
        {
          term: '게임 안에서 금고 열기',
          body: 'Anvil을 켜고 로그인한 상태에서 (Profile sync → **Sync Clan Coffer**는 기본으로 켜져 있습니다). 일치하는 게임 메시지가 나오면 본인의 입금이나 출금이 본인 이름으로 기록됩니다. 공백 뒤에 발견된 변화는 본 사람의 이름을 붙이지 않고 맞춰 넣습니다. Admin → Coffer에는 마지막으로 확인된 실제 금액과 그 시각이 표시됩니다.',
        },
        {
          term: '멤버가 신고한다',
          body: '공개 금고 페이지에서, 스크린샷이 있다면 함께. 대기 상태로 들어와 당신의 대기열에 나타납니다. 승인해야 비로소 진짜 돈이 됩니다.',
        },
        {
          term: '당신이 기록한다',
          body: 'Admin → Coffer → **Record a donation**. 명단에서 누가 냈는지 검색하고 이름 옆에 금액을 넣으면 끝입니다. 게스트도 기록할 수 있습니다 — 정식 멤버가 아니어도 금고에 보탰을 수 있으니까요.',
        },
        {
          term: '여러 명이 함께',
          body: '모두 고르고 총액을 입력한 뒤 **Split … ways**를 누르고, 필요하면 개별 몫을 손으로 조정합니다. 한 줄에 이름을 나열하지 않고 사람마다 한 줄씩 쓰므로, 각자 자기 이름으로 기부 순위에 오릅니다.',
        },
      ],
      note: {
        tag: '조정은 다른 것이다',
        body: '**Correct the pot**은 이 모든 흐름 바깥에서 움직인 gp를 위한 것입니다 — 금고에 종잣돈을 넣거나, Anvil이 보지 못한 곳에 쓰거나, 실수를 바로잡거나. 의도적으로 누구의 것도 아니며, 선물을 기록하는 방법으로는 일부러 쓰지 않습니다.',
      },
    },

    out: {
      title: '지급되는 세 가지 길',
      intro: 'Anvil의 모든 상금은 이 하나의 통에서 나오지만, 승자를 정하는 방식은 길마다 다릅니다. 사다리는 「따내는 대상」 쪽에서 설정하세요 — 금고는 누가 무엇을 이겼는지 절대 묻지 않습니다.',
      rows: [
        {
          term: '주간 대회, 자기 페이지에서',
          body: 'Skill 또는 Boss of the Week는 순위 사다리를 가집니다. 1위는 이것, 2위는 저것. 대회가 끝날 때 최종 순위를 기준으로 **한 번** 정산되며, 진행 중에는 아무것도 오가지 않습니다. 대회를 만들 때 설정하거나, 나중에 대회 자체 페이지에서 설정합니다.',
        },
        {
          term: '보드 위의 미션 칸',
          body: '미션은 끝낸 순서대로 지급하므로 그 사다리는 정산이 아니라 선점됩니다. 먼저 깬 팀이 1위의 gp를 가져갑니다. 칸의 rewards 영역에서 설정하며, 미션을 허용하는 보드라면 어디서든 됩니다.',
        },
        {
          term: '보드의 상금 풀',
          body: '빙고는 자기 풀을 순위별로 알아서 나누므로, 금고는 숫자 하나만 건넵니다. Event → **Prizes** → *From the clan coffer*. 참가비와 직접 얹은 금액에 더해지고, 순위별 배분은 같은 페이지에서 정합니다. 그 gp를 금고가 지금 **묶어둘지**, 약속만 기록할지도 고를 수 있습니다. 아직 나가지 않은 돈이고, 6주 뒤에 열릴 보드 때문에 그때까지 자금 절반을 얼려둘 필요는 없으니까요.',
        },
      ],
      note: {
        tag: '동점이 났을 때',
        body: '주간 사다리는 **동점을 나눌** 수 있습니다. 동점자 전원이 자기들이 차지한 순위를 합쳐 똑같이 나누므로, 40 kc가 셋이면 맨 앞의 한 명이 다 가져가는 대신 1·2·3위 합계를 셋으로 나눕니다. 꺼두면 순위표 자체의 순서가 결정합니다. 둘 다 방어할 수 있습니다 — 결과가 나온 뒤에 정하는 것은 아닙니다.',
      },
    },

    who: {
      title: '누가 옮길 수 있는가',
      intro: '돈은 직급이 아니라 별도의 권한입니다. 모더레이터는 제출을 승인하면서도 금고에는 전혀 손대지 않습니다. 빠뜨린 것이 아니라 의도한 것입니다.',
      rows: [
        {
          term: '회계 담당 또는 관리자',
          body: '장부 전체: 기부 기록과 승인, 금고 조정, 상금 사다리 설정, 상금을 보냄으로 표시. 소유자는 여기서 관리자로 칩니다.',
        },
        {
          term: '모더레이터',
          body: '아무것도 못 합니다. 금고 페이지 자체가 보이지 않습니다 — 돈을 걷는 일은 회계 담당의 몫이고, 직급만으로 그 권리가 생긴 적은 없습니다.',
        },
        {
          term: '보드 회계 담당',
          body: '한 이벤트의 돈: 그 참가비, 그 지급, 그 상금 풀. 보드 단위로 부여되며, 방문 클랜이 여러분의 장부를 넘겨받지 않고도 클랜 대 클랜의 자기 절반을 굴리는 방식입니다. 클랜 금고에는 닿지 못합니다.',
        },
        {
          term: '아무 멤버나',
          body: '기부를 신고하고 공개 페이지를 읽을 수 있습니다. 그게 전부입니다.',
        },
      ],
      note: {
        tag: '채널에서 클랜에 알리기',
        body: 'Admin → Discord → What goes where → **Staff only**에서 **Coffer ledger**를 디스코드 채널로 지정하면, 움직임마다 그것이 남긴 잔액과 함께 올라갑니다. 대체 경로가 없는 유일한 피드입니다 — 비워두면 돈에 관해서는 어디에도 올라가지 않습니다. [디스코드의 Anvil]({discordGuide}) 참고.',
      },
    },

    short: {
      title: '금고가 모자랄 때',
      body: [
        '금고보다 큰 상금도 거절되지 않습니다. **미지급 채무**로 기록됩니다 — 우승자 이름이 붙은 진짜 한 줄입니다 — 그러지 않으면 우승자에게는 아무것도 없고, 무엇인가 약속되었다는 흔적조차 남지 않기 때문입니다.',
        '그러니 해법은 평범합니다. gp를 들여오고, 그다음에 지급하세요. 하지 말아야 할 일은 나중에 조용히 사다리를 고치는 것입니다. 장부에는 이미 무엇을 공지했는지가 적혀 있고, 둘이 어긋나는 것은 모자란 것보다 나쁩니다.',
      ],
      note: {
        tag: 'Anvil은 아무것도 보내지 않는다',
        body: '모든 상금은 결국 사람이 게임 안에서 gp를 건네고 한 줄에 체크하는 것으로 끝납니다. 장부의 일은 그 줄이 존재하게 하고, 누구에게 얼마인지 적히게 하고, 일주일 뒤 누구도 디스코드 기록에서 그것을 되짚지 않게 하는 것입니다.',
      },
    },
  },
  moderator: {
    metaTitle: '당번 — Anvil 관리자 가이드',
    metaDescription:
      'Anvil 클랜 사이트에서 관리자의 하루: 대기열, 제출과 계정 확인, 멤버 명단을 정직하게 유지하기, 그리고 판단들.',
    eyebrow: 'Anvil · 관리자용',
    title: '당번',
    dek: '관리자는 이벤트가 돌든 안 돌든 들어오는 일을 맡습니다: 봐야 할 증빙, 확인해야 할 계정, 놔두면 어긋나는 멤버 명단. 여기에 적은 것은 그 대기열이 무엇으로 이뤄져 있는지, 그리고 스스로 “사람들을 기다리게 하는 이유”가 되지 않으면서 그것을 비우는 법입니다.',
    facts: [
      { strong: '이벤트 불가', rest: '관리자는 만들지도 편집하지도 못합니다' },
      { strong: '한 페이지', rest: '가 무엇이 기다리는지 알려 줍니다' },
      { strong: '빨리 승인하세요', rest: '느린 대기열은 망가진 사이트처럼 느껴집니다' },
    ],
    footnote:
      '관리자에게는 멤버가 보는 모든 것에 더해 검토 화면들이 보입니다. 이벤트 생성과 편집, 설정, 인원, 상금 지급은 admin과 회계 담당의 일입니다 —— 버튼이 없다면 그 때문이고, 의도된 것입니다.',

    what: {
      title: '이 역할은 무엇인가',
      intro:
        '역할은 아래로 쌓입니다: 관리자가 할 수 있는 것은 회계 담당과 admin도 모두 할 수 있습니다. 관리자만의 몫은:',
      canList: [
        '멤버 명단: 사람 추가와 내보내기, 가입 요청에 답하기([우리 사람들]({peopleGuide}))',
        '계정 확인 —— 경험치 과제와 수동 검토',
        '제출물과 증빙 스크린샷',
        '주간 대회와 일정',
        '클랜 캘린더 이벤트',
      ],
      cantIntro: '의도적으로 할 수 없는 것:',
      cantList: [
        '이벤트나 그 칸을 만들거나 편집하기',
        '클랜 설정이나 Discord 연결 바꾸기',
        '누군가를 승격시키거나 인원 구성을 건드리기',
        '참가비를 마무리 짓거나 상금을 지급하기',
      ],
    },

    queue: {
      title: '당신을 기다리는 것부터 시작하세요',
      body: [
        '관리 대시보드는 사이트 요약이 아닙니다 —— 무엇이 기다리고 있는지의 목록이고, 중요도 순으로 정렬되며, 어긋나는 카운터가 아니라 실제 데이터로 계산됩니다. “기다리는 것이 없다”고 나오면 정말로 없는 것입니다.',
        '위에서 아래로 처리하세요. 위로 올라오는 항목은 반대편에 사람이 있는 것들입니다: 계정이 확인되지 않아 신청하지 못하는 사람, 혹은 아직 아무도 보지 않아 드롭이 세어지지 않은 사람.',
      ],
    },

    submissions: {
      title: '제출과 증빙',
      body: [
        '대부분의 계산은 당신에게 오지 않습니다: 플러그인이 드롭을 보고, 팀과 UTC 시각이 새겨진 스크린샷을 보관하고, 칸이 완료됩니다. 대기열에 들어오는 것은 수동 칸과, 플러그인이 표시해 둔 것들입니다.',
        '그 도장이야말로 증빙을 반박하기 어렵게 만드는 것입니다. 플러그인 스크린샷은 팀과 시각이 그림 안에 새겨져 있고, 두 장짜리 증빙을 켜 두었다면 몇 초 뒤의 두 번째 장면이 전리품이 바닥에 자리 잡은 모습까지 보여 줍니다. 그런 게 하나도 없는 스크린샷은 휴대폰에서 찍은 것이고, 그것도 괜찮습니다 —— 다만 확인하는 사람이 당신이 된다는 뜻일 뿐입니다.',
      ],
      rows: [
        {
          term: '그럴듯하면 승인하세요',
          body: '은행을 감사하는 게 아닙니다. 그림에 그것이 찍혀 있고, 계정이 명단에 있고, 시각이 이벤트 기간 안이라면 승인하고 다음으로 넘어가세요.',
        },
        {
          term: '반려할 때는 이유를 적으세요',
          body: '설명 없는 반려는 한 시간 안에 당신에게 DM으로 돌아옵니다. 무엇이 부족했는지 적어 두면 두 번째 시도가 제대로 옵니다.',
        },
        {
          term: '표시된 제출은 질문이지 고발이 아닙니다',
          body: '플러그인이 표시하는 것은 완전히 확인하지 못한 것들입니다 —— 대개는 시작 인증샷을 내지 않은 플레이어입니다. “이건 한번 봐 달라”로 읽어야지, “누가 부정을 저질렀다”로 읽으면 안 됩니다.',
        },
      ],
    },

    verify: {
      title: '계정 확인하기',
      intro:
        '확인된 계정이 하나도 없으면 어떤 이벤트에도 신청할 수 없으므로, 이 대기열은 사람들을 곧장 플레이에서 막아 세웁니다. 매일 비울 값어치가 있는 것이 바로 이것입니다.',
      rows: [
        {
          term: '플러그인으로 확인됨',
          body: '첫 소유권 확인 후에는 플러그인이 계정을 자동으로 인식하고 안정적인 지문이 이름 변경 뒤에도 연결을 유지합니다. 알려진 지문이 없는 명단 계정은 XP 확인이나 관리자 승인을 한 번 거칩니다.',
        },
        {
          term: 'Verify by XP',
          body: '플러그인이 없는 플레이어용. 사이트가 스킬 하나를 무작위로 고르고, 30분 안에 그 스킬에서 1,000 경험치를 올리면 됩니다. 스스로 판정되므로 당신은 실패한 것만 보게 됩니다.',
        },
        {
          term: '수동 검토',
          body: 'Hiscores를 숨겼거나, 거기 올라가기엔 너무 새로운 부계정. 누군가 RSN과 메모를 보내오면 당신이 판단합니다. 메모로 부족하면 로그인 화면 스크린샷을 요청하세요.',
        },
      ],
      note: {
        tag: '확인됨 ≠ 멤버',
        body: '계정을 확인한다는 것은 “이건 정말 그 사람 것”이라고 말하는 것입니다. 그렇다고 클랜에 들어가는 것은 아닙니다. 멤버 자격은 게임 내 명단 동기화나 스태프가 직접 추가하는 것으로만 생기고, 게스트 자리는 스태프가 승인한 가입 요청으로만 생깁니다(클랜이 누구나 받아들인다면 바로). 일부러 이렇게 만들었고, 이름을 입력하는 것만으로 누군가 클랜에 들어오는 걸 막는 것이 바로 이 장치입니다.',
      },
    },

    roster: {
      title: '멤버 명단을 정직하게 유지하기',
      body: [
        '멤버 명단의 출처는 단 하나입니다: 관리자가 클랜 창 제목 표시줄의 **Anvil** 버튼(또는 플러그인 사이드 패널의 **Sync roster**)으로 게임 내 클랜 목록에서 동기화를 돌립니다. 그 밖의 모든 것 —— 확인, 연결, 신청 —— 이 거기에 매달려 있습니다.',
        '그래서 유지 보수는 작지만 실재합니다: 모집이 끝날 때마다 admin에게 동기화를 부탁하고(게임에서 들어온 게스트가 멤버가 됩니다), **Roster** 탭 맨 위의 가입 요청에 답하고, 사람들이 불평하기를 기다리지 말고 **Needs review**를 처리하세요. [우리 사람들]({peopleGuide})을 보세요.',
      ],
      note: {
        tag: '마지막으로 확인된 시각 ≠ 마지막으로 플레이한 시각',
        body: '멤버의 “클랜에서 마지막으로 확인됨” 시각은 그 사람을 찾아낸 가장 최근 동기화를 기록한 것이지, 마지막 접속 시각이 아닙니다. “아직 플레이하고 있는가”를 알고 싶다면 대신 실시간 통계 시각을 보세요 —— 그쪽이 스스로 움직이는 값입니다.',
      },
    },

    startshot: {
      title: '시작 인증샷 검토하기',
      body: [
        '그것을 요구하는 이벤트에서는 모든 플레이어가 이벤트 개시 이후에 찍은 스크린샷을, 개시 순간에 추첨된 장소에서 제출해야 합니다. 암호가 검증된 플러그인 촬영은 이미 승인된 상태로 들어오므로, 실제로 들여다보는 것은 휴대폰에서 손으로 올린 플레이어뿐입니다.',
        '확인할 것은 적습니다: 캐릭터가 화면에 있는지, 암호가 채팅창에 있는지, 그리고 그것이 그 플레이어에게 실제로 주어진 암호인지. 업로드는 즉시 인정되고 검토는 사후이므로, 당신을 기다리는 동안 누군가가 플레이하지 못하는 일은 없습니다.',
      ],
    },

    judgement: {
      title: '당신이 내려야 할 판단들',
      intro:
        '어느 것도 소프트웨어에는 정답이 없습니다 —— 그래서 사람에게 오는 것입니다.',
      rows: [
        {
          term: '증빙은 진짜인데 늦었다',
          body: '드롭은 이벤트 중에 일어났고 스크린샷은 끝난 뒤에 왔습니다. 대개는 승인하세요 —— 봐야 할 것은 그림 속 도장이지 업로드 시각이 아닙니다.',
        },
        {
          term: '계정이 아직 연결되지 않았다',
          body: '드롭은 진짜고 계정도 본인 것인데, 플레이 전에 추가해 두지 않았을 뿐입니다. 연결하게 한 뒤 승인하세요. 서류 절차 때문에 레이드를 다시 뛰게 하지는 마세요.',
        },
        {
          term: '연출한 것처럼 보인다',
          body: '직접 반려하지 말고 admin에게 올리세요. 작은 클랜 안에서 반려는 공개적인 고발이고, 그것이 한 사람이 급하게 내리는 결정이어서는 결코 안 됩니다.',
        },
        {
          term: '당신도 그 이벤트에 참가하고 있다',
          body: '거의 틀림없이 그럴 겁니다. 자기 팀이 얽힌 건은 전부 다른 관리자에게 넘기세요 —— 당신이 불공정할까 봐가 아니라, 불공정하지 않았음을 증명해야 하는 자리에 스스로를 두어서는 안 되기 때문입니다.',
        },
      ],
    },
  },

  commands: {
    metaTitle: 'Discord 슬래시 명령어 — Anvil',
    metaDescription:
      'Anvil의 모든 슬래시 명령어 — /bingo, /sotw, /botw, /eff, /coffer, /stats, /guide — 각 옵션 설명, 예시, 누가 무엇을 쓸 수 있는지, 그리고 명령어가 안 보일 때의 해결법.',
    eyebrow: 'Anvil · Discord에서',
    title: '슬래시 명령어',
    dek: '클랜 Discord에서 `/`를 입력하면 Anvil이 사이트의 실시간 정보로 답합니다: 보드, 순위, 내 카드, 주간 대회, 금고, 그리고 누구의 스탯이든. 이 페이지는 그 전체 목록이며, 봇이 실제로 등록하는 명령어에서 생성되므로 낡을 일이 없습니다.',
    facts: [
      { strong: '비공개', rest: '나만 보이는 답변, 공유 버튼 포함' },
      { strong: '내 언어', rest: 'Discord에 설정된 언어 그대로' },
      { strong: '읽기 전용', rest: '/coffer add와 remove 제외' },
    ],
    footnote:
      '봇을 처음 설정하는 방법은 [Discord 가이드](/guide/discord)에 있습니다. 이 페이지는 사용법을 다룹니다.',

    using: {
      title: '명령어가 작동하는 방식',
      body: [
        '봇이 볼 수 있는 아무 채널에서 `/`를 입력하고 목록에서 Anvil 명령어를 고르세요. 그러면 Discord가 옵션을 채울 칸으로 보여줍니다. Tab을 누르거나 클릭해서 추가하세요. 아래에서 `<angle brackets>`(꺾쇠괄호) 안의 옵션은 필수이고, `[square brackets]`(대괄호) 안의 옵션은 선택이라 빼도 됩니다.',
        '모든 답변은 **비공개**입니다. 나만 보이므로 하루에 열 번 보드를 확인해도 아무도 신경 쓰지 않습니다. 채널에 보여줄 만하다면 답변 아래의 **Share to channel**을 누르세요. 공유본은 그 순간 새로 만들어지므로, 나중에 공유한 순위는 그때의 순위입니다.',
      ],
      rows: [
        { term: '필수', body: '`<amount>` — 채우기 전까지 Discord가 명령어를 보내지 않습니다.' },
        { term: '선택', body: '`[member]` — 빼면 명령어가 나, 내 팀, 또는 클랜 전체에 대해 답합니다.' },
        { term: '목록', body: 'Discord가 제시하는 값 중 하나를 고릅니다. 직접 입력할 수는 없습니다.' },
        { term: '입력해서 검색', body: '입력을 시작한 뒤 제안에서 고릅니다. 보스 이름이나 내 계정 같은 것들입니다.' },
        { term: '멤버', body: '서버에서 누군가를 고릅니다. @멘션과 같습니다.' },
      ],
      note: {
        tag: '명령어는 클랜 서버에서만 작동합니다',
        body: '모든 답변은 하나의 클랜에 관한 것인데, DM에는 답할 클랜이 없습니다. 그래서 명령어가 DM에는 나타나지 않습니다.',
      },
    },

    bingo: {
      title: '보드 명령어: /bingo',
      intro:
        '`/bingo`는 하나의 보드에 관한 명령어입니다. 여러 보드가 진행 중이면 **board**와 **leaderboard**는 전부를 나열하고, 나머지는 진행 중인 보드, 그다음 시작할 보드, 그다음 막 끝난 보드 순으로 골라 답합니다.',
    },

    clan: {
      title: '클랜 명령어',
      intro:
        '이것들은 보드가 아니라 클랜에 대해 답하므로, 빙고가 진행 중이든 아니든 작동합니다: 주간 대회, 효율, 금고, 누구의 스탯이든, 그리고 설정 가이드.',
    },

    options: {
      title: '어디서나 보게 될 옵션',
      intro: '몇몇 옵션은 그것이 있는 모든 명령어에서 같은 뜻입니다:',
      rows: [
        {
          term: '`member`',
          body: '서버의 다른 사람. 빼면 나 자신에 대해 묻습니다. 그 사람이 사이트에서 쓴 Discord 로그인으로 Anvil 계정을 찾으므로, Anvil에 한 번이라도 로그인한 멤버에게만 작동합니다.',
        },
        {
          term: '`account`',
          body: '부계정이 있는 사람이라면, 그 사람의 어느 OSRS 계정인지. 입력해서 고르고, 빼면 본계정이 됩니다.',
        },
        {
          term: '`page`',
          body: '보스나 활동을 입력해서 검색: `Zulrah`, `Theatre of Blood`, `Tempoross`. 빼면 전체 보기입니다.',
        },
        {
          term: '`language`',
          body: '이번 한 번만 다른 언어로 답합니다. 기본적으로는 Discord에 설정된 언어, 또는 클랜이 고른 봇 언어로 받습니다.',
        },
        {
          term: '`amount`',
          body: '편한 방식으로 쓰는 gp: `5m`, `2.5b`, `500k`, 또는 `2,500,000` 같은 그냥 숫자.',
        },
      ],
    },

    who: {
      title: '누가 무엇을 쓸 수 있나',
      body: [
        '서버의 누구나 모든 읽기 전용 명령어를 실행할 수 있습니다. 보이는 것은 멤버가 보는 것과 같습니다. 칸이 아직 공개되지 않은 보드는 스태프에게도 Discord에서 숨겨진 채로 남습니다.',
        '**나**에 대해 답하는 명령어(`/bingo me`, member 없는 `/stats`)는 어느 Anvil 계정이 내 것인지 알아야 합니다. 사이트에서 쓴 Discord 로그인으로 찾으므로, Discord로 Anvil에 한 번 로그인하면 그 뒤로는 작동합니다.',
      ],
      rows: [
        { term: '모두', body: '`/coffer add`와 `/coffer remove`를 제외한 모든 명령어.' },
        {
          term: '회계 담당, 관리자, 소유자',
          body: '`/coffer add`와 `/coffer remove`. Discord 역할이 아니라 **Anvil 사이트에서의** 역할로 확인합니다. 채팅 서버의 직급이 클랜 돈을 다룰 권한을 뜻한 적은 한 번도 없기 때문입니다.',
        },
      ],
    },

    trouble: {
      title: '명령어가 작동하지 않을 때',
      intro: '흔한 원인들, 대략 일어나는 순서대로:',
      rows: [
        {
          term: '목록에 Anvil 명령어가 없음',
          body: '봇이 명령어 없이 초대되었습니다 — 그건 별개의 권한이고, 오래된 초대 링크는 한쪽만 요청했습니다. 관리자가 Admin → Discord → **Connection**에서 **Invite / re-invite the bot**을 다시 실행합니다. 봇이 쫓겨나거나 무언가 초기화되지는 않습니다. 새로 추가된 명령어는 나타나기까지 최대 한 시간이 걸릴 수 있습니다.',
        },
        {
          term: '“The application did not respond”',
          body: 'Anvil에 잠시 연결할 수 없었던 것으로, 보통 업데이트 중입니다. 몇 초 뒤에 다시 실행하세요.',
        },
        {
          term: '나에 대해 「이 보드에 없음」이라고 나옴',
          body: '이 보드에 참가하지 않았거나, Anvil이 내 Discord를 내 계정과 연결하지 못한 것입니다. 이 Discord 계정으로 사이트에 로그인하고 프로필을 확인하세요.',
        },
        {
          term: '멤버의 스탯이 비어서 돌아옴',
          body: '그 사람이 아직 Discord로 Anvil에 로그인하지 않았거나, 그 계정의 하이스코어를 아직 읽지 않았습니다. `account` 옵션으로 다시 해 보거나, 한 번 로그인해 달라고 부탁하세요.',
        },
        {
          term: '`/coffer add`가 권한이 없다고 함',
          body: 'Anvil 사이트에서의 역할이 회계 담당, 관리자, 소유자가 아니거나, 이 Discord가 사이트에 로그인하는 계정이 아닙니다.',
        },
      ],
    },

    labels: {
      options: '옵션',
      noOptions: '옵션 없음 — 그냥 실행하세요.',
      example: '예시',
      examples: '예시',
      required: '필수',
      optional: '선택',
      choices: '선택지',
      range: '{min}부터 {max}까지',
      kinds: {
        text: '텍스트',
        number: '숫자',
        member: '멤버',
        choice: '목록에서 고르기',
        search: '입력해서 검색',
        yesno: '예 또는 아니요',
      },
    },

    examples: {
      'bingo board': {
        examples: ['/bingo board'],
        tip: '지금 진행 중인 보드. 보드가 공개되기 전까지는 여기서도 칸 이름이 숨겨집니다.',
      },
      'bingo leaderboard': {
        examples: ['/bingo leaderboard'],
        tip: '팀 순위. 보드의 채점 방식에 따라 점수나 칸 수로 표시됩니다.',
      },
      'bingo rules': {
        examples: ['/bingo rules'],
        tip: '이 보드의 채점 방식(이벤트 자체에서 읽어오므로 항상 정확합니다), 그리고 클랜의 자체 규칙.',
      },
      'bingo apply': {
        examples: ['/bingo apply'],
        tip: '참가하는 방법: 참가 신청, 참가비, 그리고 내 신청 상태.',
      },
      'bingo next': {
        examples: ['/bingo next'],
        tip: '다음에 올 것: 칸 공개, 미션, 또는 마감.',
      },
      'bingo me': {
        examples: ['/bingo me'],
        tip: '내 팀, 내 순위, 그리고 내 앞으로 인정된 칸.',
      },
      'bingo help': {
        examples: ['/bingo help'],
        tip: '봇이 답할 수 있는 것의 짧은 목록을 Discord 안에서.',
      },
      'bingo team': {
        examples: ['/bingo team', '/bingo team name:Iron Wolves'],
        tip: '팀 카드: 점수, 명단, 최근 칸. 이름을 빼면 내 팀입니다.',
      },
      sotw: {
        examples: ['/sotw', '/sotw language:Deutsch'],
        tip: '진행 중인 모든 Skill of the Week, 각각의 상위권, 그리고 내 순위.',
      },
      botw: {
        examples: ['/botw'],
        tip: '진행 중인 모든 Boss of the Week와 실시간 순위.',
      },
      eff: {
        examples: ['/eff', '/eff metric:Hours bossed'],
        tip: '클랜 효율 순위표와 그 안에서의 내 순위. 기본은 플레이 시간이고, 보스는 보스 시간를 고르세요.',
      },
      'coffer balance': {
        examples: ['/coffer balance'],
        tip: '금고 잔액, 기부 순위, 그리고 최근 움직임.',
      },
      'coffer add': {
        examples: ['/coffer add amount:5m', '/coffer add amount:250k note:Raffle proceeds'],
        tip: '회계 담당, 관리자, 소유자 전용. 들어온 gp를 기록하며, 금고 피드 채널에도 올라갑니다.',
      },
      'coffer remove': {
        examples: ['/coffer remove amount:20m note:SOTW prize'],
        tip: '회계 담당, 관리자, 소유자 전용. 금고를 0 아래로 내리는 것은 거부합니다. 정말 그럴 생각이라면 금고 페이지에서 기록하세요.',
      },
      'stats profile': {
        examples: ['/stats profile', '/stats profile player:Zezima'],
        tip: '계정 하나를 한눈에: 전투 레벨과 총 레벨, 플레이 시간와 보스 시간, 컬렉션 로그 수, 개인 최고 기록.',
      },
      'stats levels': {
        examples: ['/stats levels', '/stats levels player:My Iron'],
        tip: '모든 스킬의 레벨과 XP.',
      },
      'stats efficiency': {
        examples: ['/stats efficiency'],
        tip: '플레이 시간와 보스 시간, 그리고 그것이 어느 스킬과 보스에서 나오는지.',
      },
      'stats clog': {
        examples: ['/stats clog', '/stats clog page:Zulrah'],
        tip: '컬렉션 로그 전체 진행도, 또는 보스 하나의 페이지.',
      },
      'stats pbs': {
        examples: ['/stats pbs', '/stats pbs page:Theatre of Blood mode:Hard size:3'],
        tip: '개인 최고 기록. 레이드는 모드와 팀 인원별로 기록이 따로 있으니, `mode`와 `size`로 원하는 기록을 찾으세요.',
      },
      'stats luck': {
        examples: ['/stats luck', '/stats luck player:Zezima'],
        tip: 'Anvil이 추적하는 드롭 전반에서 그 계정이 얼마나 운이 좋았는지.',
      },
      'stats collectors': {
        examples: ['/stats collectors'],
        tip: '클랜에서 가장 큰 컬렉션 로그들.',
      },
      'stats luckboard': {
        examples: ['/stats luckboard'],
        tip: '클랜에서 드롭이 가장 안 뜬 멤버와 가장 운 좋은 멤버.',
      },
      setup: {
        examples: ['/setup topic:Plugin setup', '/setup topic:Plugin setup step:5'],
        tip: 'Discord 안의 설정 가이드: 단계 목록, 또는 사이트의 해당 단계로 바로 가는 링크가 달린 한 단계.',
      },
      guide: {
        examples: ['/guide guide:ToB 4-man gear'],
        tip: '클랜의 게임 가이드(레이드, 보스, 돈벌이 등) 중 하나: 이름을 입력하기 시작해 목록에서 고르세요.',
      },
    },
  },

  tiles: {
    metaTitle: '칸 규칙과 제한 — Anvil',
    metaDescription:
      '빙고 칸 종류마다 필요한 것(게임 설정, RuneLite 플러그인, 동기화된 컬렉션 로그, 하이스코어 순위)과 추적할 수 있는 범위의 한계.',
    eyebrow: 'Anvil · 플레이어용',
    title: '칸 규칙과 제한',
    dek: '모든 칸에는 필요한 것과 할 수 없는 것이 표시됩니다. 이 페이지는 각 항목을 설명하며, 칸의 **Why?** 링크가 여기로 연결됩니다.',
    needs: '필요',
    limit: '알아둘 점',
    checked: '칸이 대신 확인해 줍니다',
    englishOnly: '아래 규칙은 사이트의 실제 동작과 항상 일치하도록 당분간 영어로만 제공됩니다.',
  },

  // /guide/creators — 스트리머 스페이스 호스트용 가이드.
  creators: {
    metaTitle: '시청자를 위한 OSRS 빙고 열기 — Anvil',
    metaDescription:
      '클랜 없이 방송용 Old School RuneScape 빙고나 타일 레이스를 열어 보세요: 스페이스를 만들고, 링크 하나를 공유하고, 참여할 수 있는 사람(Twitch, Kick, YouTube, Discord)을 고른 뒤, OBS로 보드를 방송에 띄웁니다.',
    eyebrow: '스트리머·크리에이터용',
    title: '시청자를 위한 이벤트 열기',
    dek: '크리에이터 스페이스로 방송용 빙고를 열 수 있어요. 게임 내 클랜은 필요 없습니다. 이벤트 하나를 만들고, 링크 하나를 공유하면 시청자가 참여합니다.',
    facts: [
      { strong: '클랜', rest: '필요 없음' },
      { strong: '무료', rest: '로 시작' },
      { strong: '링크 하나', rest: '를 채팅에' },
    ],

    what: {
      title: '크리에이터 스페이스란',
      body: [
        'Anvil에 있는 나만의 페이지로, 주소는 `{apex}/c/your-name`입니다. 여기서 시청자를 위한 이벤트를 엽니다.',
        '클랜이 아닙니다. 클랜 목록도, 계급도, 주간 대회도 없어요. 이벤트에 참여한 사람은 그 이벤트만 합니다. 그게 전부예요.',
        '시청자는 Discord로 로그인하고, RuneScape 캐릭터를 추가하고, **Join**을 누릅니다. 그러면 Anvil RuneLite 플러그인이 드롭을 알아서 세어 줍니다.',
      ],
    },

    create: {
      title: '스페이스 만들기',
      body: [
        '[{apex}/host](/host)로 가서 Discord로 로그인하세요.',
        '스페이스 이름을 입력하세요. 채널 이름이 좋아요. 링크는 이름으로 만들어집니다. 다른 링크를 원하면 **change link**를 누르세요.',
        '**Create my space**를 누르세요. 스페이스는 Discord 계정 하나당 하나입니다.',
      ],
    },

    first: {
      title: '첫 이벤트 만들기',
      body: [
        '스페이스를 만들면 바로 **Create your first event** 화면이 나옵니다. 나중에는 **Your events** 위쪽의 **+ New event**를 쓰세요.',
        '**Name.** 시청자에게 보이는 이름이에요.',
        '**What kind?** 카드를 고르세요. **Team bingo**는 5×5 칸이고 Anvil이 팀을 나눠 줍니다. **Solo bingo**는 같은 칸에서 각자 겨룹니다. **Team race**는 순서대로 하는 과제이고, 가장 멀리 간 팀이 이깁니다.',
        '**Ready-made tiles**는 쉬운 것부터 어려운 것까지 섞인 과제를 주고, 나중에 바꿀 수 있어요. **Blank, I’ll write my own**은 빈 상태로 시작합니다.',
        '**Who can join?** 은 **Anyone**으로 두거나, 참여할 수 있는 사람을 고르세요. 5단계를 보세요.',
        '**When?** 시작일과 종료일을 고르세요. 비워 두고 준비되면 직접 시작해도 됩니다.',
        '**Create event**를 누른 다음 **Copy invite link**를 누르세요.',
      ],
    },

    share: {
      title: '링크 공유하기',
      body: [
        '초대 링크를 방송 채팅, Discord, SNS에 붙여 넣으세요. 시청자에게 필요한 건 그 링크뿐이에요.',
        '언제든 다시 복사할 수 있어요: **Your events** → 이벤트 옆의 **Copy invite link**.',
        '채팅의 `!join`에 봇이 링크로 답하게 하고 싶나요? 9단계를 보세요.',
      ],
    },

    who: {
      title: '참여할 수 있는 사람 고르기',
      body: [
        '이벤트는 처음에 **Anyone**에게 열려 있어요. 내 커뮤니티만 받고 싶다면 이벤트의 **Settings** → **Viewers** → **Who can join?** 을 열고 하나 이상 고르세요. 같은 선택지가 첫 이벤트 화면에도 있습니다.',
        '둘 이상 고르면 **그중 하나만 맞아도 됩니다**. 팔로워이거나 서버 부스터이면 들어올 수 있어요.',
      ],
      intro: '각 선택지와 시청자가 해야 할 일:',
      rows: [
        {
          term: 'Anyone',
          body: '링크가 있는 사람은 바로 참여합니다.',
        },
        {
          term: 'Twitch followers',
          body: '시청자가 이벤트 페이지에서 **Link Twitch**를 누르고 Twitch로 로그인합니다. Anvil이 나를 팔로우하는지 확인합니다.',
        },
        {
          term: 'Twitch subs',
          body: '팔로워와 같지만 구독 중이어야 합니다. 가장 낮은 티어를 고르세요: **Tier 1 or higher**, **Tier 2 or higher**, **Tier 3**. Prime 구독은 1티어로 셉니다. 채널이 Twitch 제휴(Affiliate) 또는 파트너여야 합니다.',
        },
        {
          term: 'Kick followers',
          body: 'Kick은 앱에 누가 팔로우하는지 알려 주지 않아서, Anvil은 Kick을 연결한 「뒤에」 팔로우한 사람을 셉니다. 그 전에 팔로우했다면 시청자가 언팔로우했다가 다시 팔로우하면 됩니다. Kick 채팅이 팔로워 전용인가요? **Kick channel** 칸에서 **My Kick chat is followers-only**를 켜세요. 그러면 채팅에 Anvil 코드를 입력한 시청자가 팔로워로 집계됩니다.',
        },
        {
          term: 'Kick subs',
          body: 'Kick을 연결한 뒤 Anvil이 본 구독자는 자동으로 인정됩니다. 그 밖의 사람은 **Get Kick code**를 누르고, 코드(`ANVIL-7F3K9Q` 같은 모양)를 내 Kick 채팅에 입력합니다. Anvil이 구독 배지를 확인합니다. Kick에는 구독 티어가 없어요.',
        },
        {
          term: 'YouTube subscribers',
          body: '시청자가 **Check my YouTube subscription**을 누르고 Google로 로그인합니다. YouTube에서 구독 목록이 공개여야 합니다.',
        },
        {
          term: 'YouTube members',
          body: '시청자가 Anvil 코드를 내 YouTube 라이브 채팅에 입력합니다. 그래서 멤버는 **방송 중일 때만** 참여할 수 있어요.',
        },
        {
          term: 'Discord role',
          body: '내 Discord 서버에서 고른 역할(최대 5개)을 가진 사람. 먼저 서버를 연결하세요: 메뉴의 **Discord (optional)**.',
        },
        {
          term: 'Server boosters',
          body: '내 Discord 서버를 부스트하는 사람. 이것도 서버가 연결되어 있어야 합니다.',
        },
      ],
      note: {
        tag: '알아 두세요',
        body: '먼저 채널을 연결하세요(7단계). 그러지 않으면 Twitch, Kick, YouTube 선택지가 회색으로 남아요. Twitch, Kick, YouTube 계정 하나는 이벤트마다 플레이어 한 명만 들여보낼 수 있습니다. 스태프와 이름으로 초대한 사람은 확인 없이 들어옵니다.',
      },
    },

    approve: {
      title: '플레이어를 한 명씩 승인하기 (선택)',
      body: [
        '누가 플레이할지 직접 고르고 싶나요? 이벤트의 **Settings** → **Viewers** → **Who can enter**를 열고 **Ask me about everyone**을 고르세요. **Save changes**를 누르세요.',
        '이제 시청자에게는 **Join** 대신 **Ask to join**이 보입니다. 그 전에 **Who can join?** 조건은 먼저 통과해야 해요.',
        '요청은 **Your events**에 **N waiting for you**로 보입니다. 누르거나 이벤트의 **Sign-ups** 탭을 여세요. 맨 위 목록의 이름은 **Waiting for your yes**입니다. 한 명씩 수락하거나 거절하세요.',
      ],
    },

    channels: {
      title: 'Twitch, Kick, YouTube 연결하기',
      body: [
        '메뉴에서 **Settings**를 여세요. **Twitch channel**, **YouTube channel**, **Kick channel** 칸에서 **Connect Twitch**, **Connect YouTube**, **Connect Kick**을 누르고 내 채널로 로그인하세요.',
        '연결한 채널은 내 페이지에 **verified** 링크로 보입니다. 링크를 직접 입력할 수는 없어요: 로그인이 그 채널이 내 것임을 Anvil이 아는 방법입니다.',
        '채널은 Anvil의 한 곳에만 연결할 수 있어요. 이미 내가 운영하는 다른 스페이스나 클랜에 연결돼 있으면 옮길지 Anvil이 물어봅니다.',
      ],
    },

    overlay: {
      title: '보드를 방송에 띄우기 (OBS)',
      body: [
        '**Your events**에서 이벤트 옆의 **Stream overlay**를 누르고 **Make overlay links**를 누르세요.',
        '링크가 세 개 생깁니다. **Standings**: 상위 팀과 진행 상황. **Feed**: 최근 드롭과 완료한 타일. **Board**: 완료한 타일이 표시된 보드.',
        '복사하기 전에 **Text size**(S, M, L, XL)를 고르세요. 그다음 원하는 것 옆의 **Copy**를 누르세요.',
      ],
      stepsTitle: 'OBS에 추가하기',
      steps: [
        'OBS의 **Sources**에서 **+**를 누르고 **Browser**를 고르세요.',
        '**URL**에 링크를 붙여 넣으세요.',
        '크기를 정하세요. 예: 800 × 600. **Custom CSS**는 비워 두세요.',
        '**OK**를 누르세요. 몇 초마다 알아서 업데이트됩니다.',
      ],
      tipsTag: '알아 두세요',
      tips: [
        '링크 끝에 `&limit=10`, `&title=0`, `&align=right`를 붙이면 바꿀 수 있어요.',
        '오버레이에는 공개 이벤트 페이지에 보이는 것이 그대로 나옵니다. 숨긴 순위와 숨긴 타일은 방송에서도 숨겨져요.',
        '**Reset link**는 새 링크를 만들고 예전 링크를 막습니다. 링크가 새어 나갔을 때 쓰세요. 새 링크를 OBS에 다시 붙여 넣어야 해요.',
        '구석에 작은 “Anvil” 마크가 있습니다. Gold 플랜에서는 **Settings** → **Anvil mark on your overlay**에서 숨길 수 있어요.',
      ],
    },

    chatjoin: {
      title: '채팅에서 !join',
      body: [
        '**Settings** → **!join in Twitch chat**을 열고 켜세요.',
        '시청자가 `!join`을 입력하면 Anvil 봇(Anvil_OSRS)이 열려 있는 이벤트의 링크로 답합니다. 몇 명이 입력해도 30초에 한 번만 답해요.',
        '연결한 채널(7단계)에서만 답합니다. Kick은 **Kick channel** 칸에서 **!join in Kick chat**을 켜세요.',
        '열려 있는 이벤트가 없으면 그렇게 알려 줍니다: “No event is open to join right now — keep an eye on the stream!”',
      ],
      tips: [
        '채팅에서 링크를 차단하고 있다면(Twitch의 **Block hyperlinks** 또는 AutoMod) 봇의 답장이 보류됩니다. 채팅에 `/vip anvil_osrs` 또는 `/mod anvil_osrs`를 한 번 입력하면 링크가 올라갑니다.',
        '이벤트를 작업 중인가요? 이벤트 메뉴의 **Space settings**를 누르면 이 스위치로 돌아옵니다. **Who can join?** 아래의 **Switch it on in your settings**로도 돌아올 수 있어요.',
      ],
    },

    page: {
      title: '내 페이지 꾸미기',
      body: [
        '내 페이지는 사람들이 `{apex}/c/your-name`에서 내 이벤트와 함께 보는 곳이에요. **Settings** → **Your page**를 여세요. 부분마다 저장 버튼이 따로 있습니다.',
      ],
      items: [
        '**Bio.** 나와 내 방송에 대한 몇 줄. `https://`로 시작하는 링크는 클릭할 수 있어요.',
        '**Logo and banner.** **Upload a logo** 또는 **Upload a banner**를 누르세요. 배너는 페이지 맨 위를 가로지르니 가로로 길게 만드세요(3:1, 예: 1500 × 500). PNG, JPEG, GIF, WebP. 둘 다 움직이는 이미지여도 됩니다.',
        '**Panels.** 이벤트 아래에 놓는 카드 최대 8장. Twitch 채널 아래의 패널과 같아요. **+ Add a panel**을 누르고 제목과 글을 넣으세요. 사진과 링크는 선택입니다. 화살표로 순서를 바꿔요.',
        '**Schedule.** 보통 방송하는 시간을 내 시간대로. 방문자에게는 각자의 시계 기준으로 보입니다.',
        '**Featured.** 페이지 맨 위에 고정하는 클립 하나. 내 방송 하이라이트(다음 단계)에서 고르거나, Twitch, YouTube, Kick, Medal의 클립 링크를 붙여 넣으세요.',
        '**Preview your page**를 누르면 방문자가 보는 그대로 볼 수 있어요.',
      ],
      note: {
        tag: 'Jagex의 규칙',
        body: '페이지의 모든 내용은 Jagex의 규칙을 따라야 해요: 골드나 계정 판매, 도박, 봇, 사설 서버는 안 됩니다. 저장할 때 Anvil이 글과 링크를 확인합니다. 신고를 받고 Anvil 스태프가 페이지를 숨기면 설정에 그렇게 표시돼요. 실수라고 생각되면 Anvil Discord에서 물어보세요.',
      },
    },

    highlights: {
      title: '방송 하이라이트',
      body: [
        'Twitch나 YouTube 채널을 연결해 두면, 방송 중에 내 이벤트의 큰 순간을 Anvil이 잡아냅니다. 스위치는 **Settings** → **Stream highlights**에 있어요.',
        '**Auto-clip big moments on my stream**은 연결하는 즉시 켜져 있어요. Twitch에서 방송 중이면 이벤트가 시작될 때, 팀이 보드를 다 채우거나 이길 때, 내 캐릭터가 희귀 드롭이나 펫을 얻을 때 Anvil이 클립을 만듭니다. YouTube에서는 대신 방송의 그 초로 가는 링크를 저장해요. Kick은 아직 하이라이트가 없습니다.',
        '클립은 이벤트 페이지와 내 페이지의 **Highlights**에 보여요. 하나를 **Featured** 클립으로 고정할 수 있습니다(10단계).',
        '**Let Anvil feature clips from my events in its own promotion**은 직접 켤 때까지 꺼져 있어요. 켜면 Anvil이 자체 페이지와 SNS에서 클립을 공유할 수 있고, 항상 당신을 출처로 밝힙니다.',
        '플레이어도 자기 큰 순간을 클립할 수 있어요. **Settings** → **Connected accounts**에서 자기 Twitch 계정 아래의 **Clip my stream when I hit a big moment**를 켜면 됩니다.',
      ],
    },

    listing: {
      title: 'Anvil에 등록하기',
      body: [
        '스페이스는 만들 때 비공개 목록 상태예요. 링크가 있는 사람만 찾을 수 있습니다.',
        '**Settings** → **Advertise on Anvil**을 열고 켜세요. 스페이스가 Anvil 클랜 디렉터리에 보이고, 새 이벤트는 `{apex}/events`에 보입니다.',
        '이벤트 하나만 등록하려면 그 이벤트의 **Settings** → **Viewers** → **List on Anvil**을 여세요. 예정 중이거나 진행 중일 때 보입니다.',
        '날짜가 없는 이벤트는 **Open to join** 아래에 “Open now · starts when the host starts it”라고 표시됩니다.',
      ],
    },

    plans: {
      title: '플랜과 한도',
      body: [
        '플랜이 정하는 건 내 이벤트들에 동시에 들어올 수 있는 플레이어 수예요. 날짜가 겹치는 이벤트는 그 수를 함께 나눠 쓰고, 날짜가 다른 이벤트는 각각 그 수를 받아요. 겹치는 이벤트 두 곳에 있는 플레이어는 두 번 셉니다. 나머지는 모든 플랜이 같습니다: 보드, 플러그인 추적, 오버레이, Discord.',
        '플랜 카드는 **Your events**에 있어요. 플랜을 비교하려면 [요금](/pricing#creators)을 보세요. 결제를 바꾸거나 해지하려면 [결제 페이지](/portal)로 가세요.',
      ],
      rows: [
        { term: 'Free', body: '내 이벤트 전체에서 동시에 최대 50명. 한 번에 이벤트 하나. Discord 역할·부스터 확인.' },
        { term: 'Bronze', body: '내 이벤트 전체에서 동시에 최대 150명. Twitch, Kick, YouTube 확인.' },
        { term: 'Silver', body: '내 이벤트 전체에서 동시에 최대 300명. 한 번에 이벤트 여러 개. 채팅의 `!join`. 목록에서 먼저 표시.' },
        { term: 'Gold', body: '내 이벤트 전체에서 동시에 최대 1,000명. 오버레이의 Anvil 마크 숨기기.' },
        { term: 'Partner', body: '플레이어 수 제한 없음. Anvil과 직접 설정해요 — 문의해 주세요.' },
      ],
      note: {
        tag: '지금은',
        body: 'Anvil이 자라는 동안에는 플랜 숫자를 넘어도 모두 들어올 수 있어요. 한도는 안내를 드린 뒤 나중에 시작됩니다. 플랜 카드에서 얼마나 가까운지 볼 수 있어요.',
      },
    },

    faq: {
      title: '질문',
      intro: '스트리머가 가장 많이 묻는 것들:',
      rows: [
        {
          term: '시청자에게 클랜이 필요한가요?',
          body: '아니요. Discord 계정과 OSRS 캐릭터만 있으면 됩니다. [시청자 가이드]({joiningGuide})를 보내 주세요.',
        },
        {
          term: 'RuneLite 플러그인이 필요한가요?',
          body: '드롭과 처치(킬)에는 필요해요. 플러그인이 알아서 보냅니다. 일부 타일은 대신 하이스코어를 읽어요.',
        },
        {
          term: '시청자가 “The host’s Twitch connection isn’t working”라고 해요.',
          body: 'Twitch가 내 연결을 더는 받아 주지 않아요. **Settings**를 열고 **Reconnect Twitch**를 누르세요. Kick과 YouTube도 같습니다.',
        },
        {
          term: '다른 사람이 운영을 도와줄 수 있나요?',
          body: '네. **Players** → **Staff & roles**를 열어 그 사람을 추가하고, 각자 할 수 있는 일을 고르세요.',
        },
        {
          term: '게임 내 클랜도 운영하고 있어요.',
          body: '그렇다면 스페이스는 필요 없을 수 있어요. 공개 클랜은 대신 **Streaming**을 켤 수 있습니다. [클랜 방송하기]({streamingGuide})를 보세요.',
        },
        {
          term: '스페이스를 하나 더 만들 수 있나요?',
          body: '지금은 Discord 계정 하나당 스페이스 하나예요. 하나 더 필요하면 문의해 주세요.',
        },
        {
          term: '스페이스 설정은 어디에 있나요?',
          body: '메뉴에서 **Settings**를 누르세요. 이벤트 안에서는 이벤트 메뉴의 **Space settings**를 누르세요.',
        },
        {
          term: '내 페이지의 **Report** 버튼은 무엇을 하나요?',
          body: '로그인한 사람은 누구나 내 페이지, 패널, 이벤트, 하이라이트를 Anvil 스태프에게 신고할 수 있어요. 신고는 스태프에게만 갑니다. 스태프가 소개, 패널, 일정, Featured 클립을 숨기면 설정에 그렇게 표시돼요.',
        },
      ],
    },
  },

  // /guide/joining-a-streamer-event — 스트리머의 링크를 누른 시청자용.
  joiningStream: {
    metaTitle: '스트리머의 OSRS 빙고에 참여하기 — Anvil',
    metaDescription:
      '스트리머에게 링크를 받았나요? Discord로 로그인하고, OSRS 캐릭터를 추가하고, Join을 누르세요. Twitch, Kick, YouTube의 팔로워 전용·구독자 전용 이벤트에서 할 일과 드롭이 세어지는 방식.',
    eyebrow: '시청자용',
    title: '스트리머의 이벤트에 참여하기',
    dek: '스트리머가 링크를 공유했어요. 보드에 들어가는 방법입니다. 클랜은 필요 없어요.',
    facts: [
      { strong: '약 2분', rest: '이면 참여' },
      { strong: '클랜', rest: '필요 없음' },
    ],

    join: {
      title: '네 단계로 참여하기',
      body: [
        '스트리머가 공유한 **링크를 여세요**. 아니면 스트리머의 채팅에 `!join`을 입력하면 봇이 링크를 올려 줍니다.',
        '**Discord로 로그인하세요.** 그게 Anvil 계정이에요. 따로 적을 건 없습니다.',
        '**캐릭터를 추가하세요.** **Add my character**를 누르고 RuneScape 이름을 입력하세요. **Prove it’s mine**이 보이면 프로필의 안내를 따르세요. 방법은 [플러그인 가이드]({pluginGuide})에 있어요.',
        '**Join을 누르세요.** 캐릭터가 여러 개면 하나를 고르세요. 성공하면 **You’re in!** 이 보입니다.',
      ],
    },

    gated: {
      title: '팔로워·구독자 전용 이벤트',
      body: [
        '스트리머의 커뮤니티만을 위한 이벤트도 있어요. 참여 카드에 누구를 위한 건지 나옵니다. 예: “Open to followers of somename on Twitch”.',
        '그래도 **Join**을 눌러 보세요. 아직 들어갈 수 없다면 카드에 할 일이 나옵니다. 그중 하나를 하고 **Join**을 다시 누르세요.',
      ],
      intro: '종류별로 할 일:',
      rows: [
        {
          term: 'Twitch follow or sub',
          body: '**Link Twitch**를 누르고 Twitch로 로그인하세요. Anvil은 아무 권한도 요구하지 않아요. 그다음 **Join**을 다시 누르세요.',
        },
        {
          term: 'Kick follow or sub',
          body: '**Get Kick code**를 누르세요. 코드(`ANVIL-7F3K9Q` 같은 모양)를 10분 안에 스트리머의 Kick 채팅에 입력하세요. 코드는 한 번만 쓸 수 있어요. 그다음 **Join**을 다시 누르세요.',
        },
        {
          term: 'YouTube subscriber',
          body: '**Check my YouTube subscription**을 누르고 Google로 로그인하세요. 방송을 볼 때 쓰는 계정을 고르세요. YouTube 개인정보 설정에서 구독 목록이 공개여야 합니다.',
        },
        {
          term: 'YouTube member',
          body: '**Link my YouTube account**를 누른 다음, YouTube 라이브 채팅에 코드를 입력하고 **check the chat**을 누르세요. 스트리머가 방송 중일 때만 됩니다.',
        },
        {
          term: 'Discord role or booster',
          body: '스트리머의 Discord 서버에 들어가서 역할을 받으세요(또는 부스트하세요). Anvil은 로그인한 Discord 계정으로 확인합니다.',
        },
      ],
      note: {
        tag: '승인',
        body: '스트리머가 플레이어를 한 명씩 승인하는 경우도 있어요. 그러면 버튼이 **Ask to join**이고, 답이 올 때까지 **Waiting for the host**가 보입니다.',
      },
    },

    plugin: {
      title: 'Anvil 플러그인 설치하기',
      body: [
        '드롭과 처치(킬)는 RuneLite용 Anvil 플러그인으로 세어집니다. Plugin Hub에서 설치하고, 사이드 패널에서 Discord로 로그인하세요.',
        '[플러그인 가이드]({pluginGuide})가 약 3분 안에 안내해 줍니다.',
      ],
    },

    play: {
      title: '플레이하기',
      body: [
        '이게 전부예요. 평소처럼 플레이하세요. 보드에 필요한 드롭이나 처치가 나오면 플러그인이 알아서 보냅니다.',
        '이벤트 링크를 열면 언제든 보드와 순위를 볼 수 있어요. 이 이벤트 하나만 하는 거예요: 클랜에 가입하는 게 아닙니다.',
      ],
    },

    accounts: {
      title: '연결한 계정',
      body: [
        '연결한 Twitch, YouTube, Kick 계정은 [Settings → Connected accounts](/settings/connections)에 있어요. 참여하기 전에 여기서 미리 연결해도 됩니다.',
        '언제든 연결을 끊을 수 있어요. 이미 참여한 이벤트는 그대로입니다. 나중에 참여하는 제한 이벤트는 다시 연결하라고 합니다.',
        '연결한 Twitch, YouTube, Kick 계정은 프로필에 인증 표시와 함께 보여요: 내 것임을 증명했다는 뜻입니다. 숨기려면 **Show on my profile**을 끄세요. Medal 링크는 달라요. 직접 붙여 넣는 것이라 인증 표시가 없습니다.',
        '직접 Twitch에서 방송하나요? Twitch 계정 아래의 **Clip my stream when I hit a big moment**를 켜세요. 스트리머의 이벤트에서 방송 중일 때 Anvil이 희귀 드롭, 펫, 완료한 타일을 클립합니다.',
      ],
    },

    faq: {
      title: '질문',
      intro: '안 된다고 할 때:',
      rows: [
        {
          term: '“This event is full”',
          body: '더 들어올 자리가 없어요. 자리를 만들 수 있는 건 스트리머뿐이에요 — 알려 주세요.',
        },
        {
          term: '구독 중인데 들어가지 못해요.',
          body: '구독할 때 쓰는 계정과 같은 계정을 연결했는지 확인하세요. Twitch에서는 참여 카드의 **Your Twitch**를 보세요. Kick에서는 새 코드를 채팅에 입력하세요: Anvil이 그 메시지의 구독 배지를 읽습니다. YouTube에서는 구독 목록을 공개로 바꾸고 다시 확인하세요.',
        },
        {
          term: 'Kick에서 팔로우했는데 안 했다고 나와요.',
          body: 'Anvil은 스트리머가 Kick을 연결한 뒤에 한 팔로우만 볼 수 있어요. 언팔로우했다가 다시 팔로우한 다음 **Join**을 누르세요.',
        },
        {
          term: '“That Twitch account was already used to join this event”',
          body: 'Twitch(또는 Kick, YouTube) 계정 하나는 플레이어 한 명만 들여보냅니다. 다른 사람이 이미 그 계정으로 참여했어요.',
        },
        {
          term: '“Twitch didn’t answer just now”',
          body: 'Twitch, Kick, YouTube, Discord 중 하나가 잠깐 문제가 있었어요. 1분 기다렸다가 **Join**을 다시 누르세요.',
        },
        {
          term: '“The host’s … connection isn’t working”',
          body: '이건 스트리머 쪽 문제예요. Anvil에서 채널을 다시 연결하라고 알려 주세요.',
        },
        {
          term: '드롭이 안 보여요.',
          body: '플러그인이 설치되어 로그인되어 있는지, 지금 플레이하는 캐릭터로 참여했는지 확인하세요. [플러그인 가이드]({pluginGuide})를 보세요.',
        },
        {
          term: '이런 이벤트를 더 찾으려면 어디로 가나요?',
          body: '[이벤트 페이지](/events)에 누구나 참여할 수 있는 이벤트가 있어요. 지금 열려 있는 스트리머 이벤트도 포함됩니다.',
        },
        {
          term: '스트리머 페이지에 규칙을 어기는 내용이 있어요.',
          body: '페이지, 이벤트, 하이라이트에서 **Report**를 누르세요. 무엇이 문제인지 고르고 **Send**를 누르세요. Anvil 스태프에게만 갑니다. 누가 신고했는지 스트리머는 절대 알 수 없어요.',
        },
      ],
    },
  },

  // /guide/streaming-for-clans — 공개 클랜이 Streaming을 켜는 방법.
  streamingClans: {
    metaTitle: '클랜 이벤트 방송하기 — Anvil',
    metaDescription:
      '방송 시청자가 클랜에 가입하지 않고도 클랜의 OSRS 이벤트에 참여하게 하세요: Streaming을 켜고, 이벤트를 시청자에게 열고, 들어올 시청자를 고릅니다.',
    eyebrow: '방송하는 클랜용',
    title: '클랜 방송하기',
    dek: '클랜이 이벤트를 방송하나요? 시청자가 클랜에 가입하지 않고도 이벤트 하나에 참여하게 하세요.',

    on: {
      title: 'Streaming 켜기',
      body: [
        'Admin → **Clan settings** → **Profile**로 가서 **Streaming**을 켜세요.',
        '공개 클랜만 방송할 수 있어요. 시청자가 이벤트 페이지를 열어야 하는데, 비공개 클랜은 그것을 숨기기 때문이에요. Streaming이 켜진 클랜은 끌 때까지 비공개로 바꿀 수 없습니다.',
        '켠 뒤에는 바로 아래에서 Twitch, YouTube, Kick 채널을 연결하세요.',
      ],
    },

    event: {
      title: '이벤트를 시청자에게 열기',
      body: [
        '모든 이벤트는 바꾸기 전까지 **Members only**입니다. 예전과 같아요.',
        '이벤트의 **Settings** → **Entry & co-hosts** → **Who can join?** 을 열고 **Members and viewers**를 고르세요. 그다음 **Which viewers?** 를 고르세요: 누구나, 또는 팔로워, 구독자, Discord 역할 등. **Save**를 누르세요.',
        '이 확인은 시청자에게만 적용됩니다. 클랜 멤버는 예전처럼 언제나 들어옵니다.',
      ],
    },

    viewers: {
      title: '시청자란',
      body: [
        '합류한 시청자는 **event player**입니다. 그 이벤트 하나만 플레이합니다.',
        '클랜 멤버도 게스트도 아닙니다. 클랜 목록에 올라가지 않으며 계급도 받지 않습니다.',
        '이런 방식으로 들어온 모든 사람은 **People** → **Past viewers**에서 볼 수 있습니다.',
        '계속 함께하고 싶은 단골이 있나요? 그 사람의 행에서 **Make guest**를 누르면 클랜 게스트가 되어, 이 이벤트뿐 아니라 게스트에게 열린 이벤트 어디든 참여할 수 있습니다. **Make a guest a viewer again**은 게스트를 다시 한 이벤트의 시청자로 되돌립니다.',
      ],
    },

    tools: {
      title: '방송 도구',
      body: [
        '스트리머 도구는 크리에이터 스페이스와 똑같이 동작해요: 인증된 채널 링크, **Who can join?** 확인, OBS 오버레이, 채팅의 `!join`.',
        '클랜 이벤트의 오버레이 링크는 이벤트의 **Settings** → **Stream** → **Stream overlay**에 있어요. `!join`과 오버레이 마크는 **Clan settings** → **Profile** → **Streaming**에 있습니다.',
        '[크리에이터 가이드]({creatorsGuide})가 하나씩 차근차근 설명해 줍니다.',
        '방송 하이라이트도 여기서 동작해요: Twitch나 YouTube를 연결하면, 시청자에게 열린 이벤트의 큰 순간을 Anvil이 클립합니다. Kick 채팅의 `!join`은 **Kick channel** 칸에 따로 스위치가 있어요.',
      ],
    },

    faq: {
      title: '질문',
      intro: '짧은 답:',
      rows: [
        {
          term: '시청자도 멤버 한도에 포함되나요?',
          body: '아니요. 멤버가 아니라 event player예요. 스트리머 한도는 운영하는 이벤트 전체에서 동시에 있는 플레이어 수로 셉니다([크리에이터 가이드]({creatorsGuide})를 보세요).',
        },
        {
          term: '`!join`이 멤버 전용 이벤트로 안내하나요?',
          body: '아니요. 시청자에게 열린 이벤트만 안내합니다.',
        },
        {
          term: '대신 크리에이터 스페이스를 만들어야 할까요?',
          body: '클랜이 없을 때만요. 스페이스는 게임 내 클랜이 없는 스트리머를 위한 거예요.',
        },
      ],
    },
  },
  people: {
    metaTitle: '우리 사람들: 명단, 게스트, 그리고 누가 들어올 수 있나 — Anvil',
    metaDescription:
      'Anvil 클랜의 명단은 어디서 오는지, Members·Guests·Roster only·Departed·Quiet가 무슨 뜻인지, 가입 요청과 Needs review가 어떻게 돌아가는지, Who can join의 세 가지 설정, 그리고 누군가를 내보내거나 차단하는 법.',
    eyebrow: 'Anvil · 클랜 스태프용',
    title: '우리 사람들: 명단, 게스트, 그리고 누가 들어올 수 있나',
    dek: 'Admin → **People**에 있는 사람은 모두 네 가지 길 중 하나로 들어왔습니다: 게임 내 클랜 명단에 이름이 있었거나, 스태프가 승인했거나, 클랜이 누구나 받아들이거나, 누군가 직접 추가했거나. 여기서는 각각이 어떻게 동작하는지, Roster 탭이 무엇을 알려 주는지, 그리고 누군가 엉뚱한 곳에 있을 때 무엇을 확인할지 설명합니다.',
    facts: [
      { strong: '게임 내 명단', rest: '이 멤버가 되는 유일한 자동 경로' },
      { strong: '로그인', rest: '만으로는 절대 명단에 오르지 않음' },
      { strong: '대기열 두 개', rest: '가 서로 다른 탭에 있음' },
    ],
    footnote:
      '여기 나오는 모든 것은 Admin → **People** 아래에 있습니다. Roster와 Needs review는 관리자의 일입니다. **Who can join**과 **Staff & roles**는 admin 전용 탭입니다. 관리 화면 전체에서 누가 무엇을 할 수 있는지는 [스태프 역할: 누가 무엇을 할 수 있나]({staffGuide})를 보세요.',

    roster: {
      title: '명단은 어디서 오나',
      body: [
        '명단은 게임 내 클랜 명단을 사이트로 옮겨 온 것입니다. admin이 Anvil 플러그인을 켠 RuneLite에서 보냅니다: 클랜 창 제목 표시줄의 **Anvil** 버튼을 누르거나, 플러그인 사이드 패널의 **Sync roster**를 누르세요. 명단에 있는 모두가 게임 내 등급을 그대로 달고 **멤버**로 들어옵니다. 보낼 수 있는 사람은 사이트에서 Admin 역할을 가진 사람뿐이고, 다른 사람에게는 게임 안에서 그렇게 안내됩니다.',
        '동기화는 그것만으로 누군가를 멤버로 만드는 유일한 수단입니다. 게임에서 클랜을 나간 사람은 다음 동기화에서 떠난 것으로 표시되고, 다시 들어온 사람은 그다음 동기화에서 돌아옵니다. 어느 쪽이든 기록은 남습니다.',
        '그 밖의 자리는 모두 **게스트** 자리입니다: 게임 내 클랜에는 없지만 이벤트에 참가하는 사람이죠. 게스트도 기록되고 이벤트에 참가할 수 있습니다. 멤버는 아니며, 요금제 인원에도 포함되지 않습니다.',
      ],
      note: {
        tag: '로그인만으로는 절대 명단에 오르지 않습니다',
        body: 'Discord로 로그인하거나, 캐릭터를 연결하거나, 플러그인을 켜고 플레이해도 자리가 생기지 않습니다. 게임 내 클랜이 우리 클랜인데 아직 명단에 없는 사람을 플러그인이 보면, 그 사람 대신 요청을 넣습니다(3단계 참고). 그 밖의 사람은 클랜 없는 Anvil 계정만 가진 것입니다. 클랜 이름을 입력하는 것만으로 낯선 사람이 들어오지 못하는 건 이 덕분입니다.',
      },
    },

    filters: {
      title: 'Roster 탭 읽는 법',
      intro:
        '위쪽 막대는 명단을 **Members**, **Guests**, **Departed**로 나눕니다. 구간을 클릭하면 그것으로 걸러집니다. 그 아래 칩으로 목록을 더 좁힐 수 있습니다:',
      rows: [
        {
          term: 'Active',
          body: '아직 명단에 있는 멤버. 게스트와 떠난 사람은 빠집니다.',
        },
        {
          term: 'Quiet 7d+',
          body: '플러그인이 7일 넘게 플레이를 보지 못한 멤버. 플러그인을 한 번도 쓰지 않은 사람은 판단할 근거가 없어서 여기 들어가지 않습니다. 그 사람의 **Last played**에는 대신 **no plugin data**가 표시됩니다.',
        },
        {
          term: 'Guests',
          body: '현재 게스트 자리: 이벤트에는 참가하지만 게임 내 클랜에는 없는 사람.',
        },
        {
          term: 'Roster only',
          body: '아직 사이트 계정이 연결되지 않은 현재 멤버와 게스트. Discord로 한 번도 로그인하지 않은 사람이라면 정상입니다. 명단에는 그대로 남고, 무언가에 신청하고 싶어지면 로그인해서 캐릭터를 연결하면 됩니다.',
        },
        {
          term: 'Departed',
          body: '게임에서 나간 사람, 또는 스태프가 내보낸 사람. 성적과 기록은 남습니다.',
        },
        {
          term: 'All',
          body: '위의 모두.',
        },
      ],
      outro:
        '**Source** 열은 각 자리가 어떻게 시작됐는지 알려 줍니다: **Clan sync**, **Added manually**, **Applied or self-reported** 중 하나입니다. **Last played**는 명단 동기화가 아니라 플러그인에서 옵니다.',
      note: {
        tag: '등급과 역할은 다릅니다',
        body: '칩 옆의 드롭다운 두 개는 각각 게임 내 등급과 사이트 역할로 거릅니다. 등급은 게임이 보고한 그대로입니다. 사이트 역할은 admin이 **Staff & roles**에서 정한 것입니다. 한쪽이 다른 쪽을 바꾸는 일은 없습니다.',
      },
    },

    review: {
      title: '가입 요청과 Needs review',
      intro: '“네”를 기다리는 사람은 두 종류이고, 기다리는 탭도 서로 다릅니다.',
      rows: [
        {
          term: 'Asking to join',
          body: '**Roster** 탭 맨 위에, 누군가 기다리고 있을 때만 보입니다. 요청은 사이트에서 오거나(클랜 페이지에서 **Apply**를 눌렀거나, 우리 이벤트에 참가하려 했을 때) 플러그인에서 옵니다(명단에 오르기 전에 게임 내 클랜에서 플레이하는 걸 봤을 때). 각 줄에 어느 쪽인지, 그리고 다른 클랜의 멤버인지가 적혀 있습니다. **Approve**는 게스트 자리를 줍니다. **Decline**은 본인에게 알려 줍니다(봇이 닿으면 Discord DM으로). 여러 개를 체크하면 한꺼번에 답할 수 있습니다.',
        },
        {
          term: 'Awaiting confirmation',
          body: '**Needs review**에 있습니다. 명단에 있는 캐릭터를 경험치를 올리거나, 요청하거나, 플러그인을 켜고 플레이해서 연결한 사람들입니다. 기다리는 동안에도 이미 플레이할 수 있습니다. Discord 이름이 캐릭터와 맞는지 확인하고 **Approve**를 누르세요. **Not our member**는 그 캐릭터를 우리 목록에서 빼고 주인에게 남겨 둡니다. **Report to Anvil**은 본인 것이 아닌 캐릭터에 씁니다.',
        },
        {
          term: 'Claim requests',
          body: '이것도 **Needs review**에 있습니다. 여기서 이미 오래된 멤버인 캐릭터를 누군가 플레이해서, Anvil이 알아서 연결하지 않은 경우입니다. 본인이 맞다면 **Yes, that’s them**, 아니면 **Not them**을 누르세요. 우리 클랜에만 있었던 캐릭터는 바로 연결됩니다. 다른 클랜에도 있는 캐릭터는 Anvil이 결정합니다.',
        },
      ],
      note: {
        tag: '배지는 가입 요청을 세지 않습니다',
        body: '**Needs review**와 사이드바의 **People**에 붙은 숫자는 Awaiting confirmation과 Claim requests를 셉니다. 가입 요청은 들어 있지 않으니 Roster 탭 맨 위도 꼭 보세요.',
      },
    },

    policy: {
      title: '누가 들어올 수 있나',
      intro:
        'Admin → People → **Who can join**에는 설정이 세 개 있고, 이 탭은 admin에게만 보입니다. 바깥 사람이 어떻게 들어오는지 정하는 것은 **Players from other clans**입니다:',
      rows: [
        {
          term: 'Ask first',
          body: '기본값입니다. 신청한 사람이나 플러그인이 게임 내 클랜에서 찾은 사람은 스태프가 승인할 때까지 가입 요청으로 기다립니다. “네” 없이 자리를 얻는 사람은 없습니다.',
        },
        {
          term: 'Let anyone in',
          body: '요청만으로 충분합니다. 바로 게스트 자리를 받고, 요청은 남지 않습니다. 공개 이벤트에는 좋지만, 그 외에는 시끄럽습니다.',
        },
        {
          term: 'No guests',
          body: '우리 멤버만 플레이합니다. 다른 클랜의 플레이어는 이벤트에 참가할 수도, 가입을 요청할 수도 없고, 플러그인도 그들을 위해 아무것도 넣지 않습니다.',
        },
      ],
      outro:
        '**Who can see this clan**은 **Anyone**(보드 링크를 받은 사람은 누구나 열 수 있음) 또는 **Members only**(나머지 사람에게는 클랜 카드와 신청 안내만 보임)입니다. **List in the Clan Hall**은 클랜을 공개 클랜 목록에 올립니다. 이걸 꺼도 클랜이 비공개가 되지는 않습니다.',
      note: {
        tag: '어느 것도 멤버에게는 영향이 없습니다',
        body: '이 설정이 무엇이든 명단 동기화는 멤버에게 자리를 줍니다. 우리 스태프도 게스트로 취급되지 않습니다: 스태프의 캐릭터는 요청 없이 멤버 자리를 받습니다.',
      },
    },

    manual: {
      title: '직접 추가하기',
      body: [
        'Roster → **+ Add Manually**로 캐릭터 하나를 명단에 올립니다. **RSN**을 넣고, 필요하면 **Discord ID**와 **Rank**도 넣으세요. 게임 내 클랜에 없는 사람이라면 **Add as guest**를 체크합니다. 관리자와 admin 모두 할 수 있습니다.',
        '동기화가 아직 보지 못하는 사람에게 쓰세요. 예를 들어 마지막 동기화 뒤에 들어온 신입입니다. 그 자리는 **Added manually**로 표시되고, 동기화는 그것을 여러분의 결정으로 존중합니다: 직접 추가한 자리를 나중에 빼면, 다음 동기화가 다시 넣지 않습니다.',
        '명단에 추가한다고 이벤트에 신청되는 것은 아닙니다. 그러려면 이벤트의 **Sign-ups** 탭을 열고 **Add member**를 쓰세요. 그건 admin 전용입니다.',
      ],
    },

    removing: {
      title: '내보내기와 차단',
      intro: '명단의 각 줄에는 작업 메뉴가 있습니다. 하는 일이 서로 다릅니다:',
      rows: [
        {
          term: 'Demote to guest',
          body: '목록에는 남고 이벤트에도 넣을 수 있지만, 멤버로는 세지 않습니다. **Promote to member**로 되돌립니다.',
        },
        {
          term: 'Remove from roster',
          body: '떠난 것으로 표시합니다. 기록과 성적은 남습니다. 아직 게임 내 클랜에 있다면 다음 명단 동기화에서 다시 들어올 수 있습니다.',
        },
        {
          term: 'Not our member',
          body: 'Needs review에서, 누군가 연결했지만 우리 클랜에 없는 캐릭터에 씁니다. 우리 목록에서 빠지고 주인에게 남습니다.',
        },
        {
          term: 'Ban from this clan',
          body: '그 사람이 여기 가진 모든 자리를 부계정까지 포함해 끝내고, 이 클랜에서 맡은 스태프 역할과 보드 직무를 모두 거두며, 돌아오지 못하게 합니다: 차단이 풀릴 때까지 명단 동기화, 플러그인, 가입 요청 모두 그 사람을 거부합니다. Anvil 계정과 다른 클랜은 건드리지 않습니다. admin 전용이고 사이트 계정이 있으며 역할이 admin보다 아래인 사람에게만 쓸 수 있습니다. 줄 메뉴나 **Staff & roles**에서 하거나, 여러 사람을 한꺼번에 할 수도 있습니다. 차단을 풀어도 자동으로 돌아오지는 않습니다. 게임에서 다시 들어오거나 여러분이 추가해야 합니다.',
        },
      ],
      note: {
        tag: '차단하면 스태프 역할도 사라집니다',
        body: '누군가를 차단하면 자리가 끝나고, 스태프 역할과 이 클랜 보드에서 맡던 보드 편집자나 보드 회계 담당 직무도 사라집니다. 차단을 풀어도 이것들은 돌아오지 않습니다: 계속 맡겨야 한다면 Staff & roles에서 역할을 다시 정하세요.',
      },
    },

    faq: {
      title: '자주 묻는 질문',
      intro: '누군가 엉뚱한 곳에 있을 때, 보통 이런 이유입니다.',
      rows: [
        {
          term: '클랜에 있는 사람이 안 보여요',
          body: '먼저 명단 동기화를 하세요: 목록은 admin이 보낼 때만 바뀝니다. 그다음 **Departed**를 보고 내보내진 건 아닌지, 차단된 건 아닌지 확인하세요. 동기화는 여기서 차단된 사람을 건너뛰고, 누구를 건너뛰었는지 알려 줍니다. 클랜이 요금제 한도를 넘었고 유예 기간도 끝났다면, 업그레이드하거나 명단을 줄일 때까지 동기화가 새 멤버를 추가하지 않습니다.',
        },
        {
          term: '클랜에 있는데 게스트로 보여요',
          body: '대개는 아직 Anvil의 다른 클랜 멤버이기 때문입니다. 캐릭터는 한 번에 한 클랜의 멤버만 될 수 있어서, 동기화는 여기서는 게스트로 앉히고 다른 클랜을 떠난 뒤 첫 동기화에서 멤버로 만듭니다. 그게 아니라면 가입 요청으로 들어왔거나, 누군가 게스트로 강등했거나 게스트로 추가한 것입니다. 동기화를 하거나 **Promote to member**를 쓰세요.',
        },
        {
          term: '로그인했는데 명단에 없어요',
          body: '정상입니다. 로그인은 Anvil 계정을 만들 뿐, 자리를 만들지 않습니다. 동기화가 그 사람을 올리거나, 요청을 승인하거나, 직접 추가하면 나타납니다.',
        },
        {
          term: '#Player1234 같은 이름',
          body: 'RuneLite는 플레이어가 로그인하는 잠깐 동안, 그리고 이름을 알 수 없는 클랜 멤버에게 이런 임시 이름을 보여 줍니다. Anvil은 이제 이런 이름을 무시합니다: 동기화는 건너뛰고, 플러그인은 요청을 넣지 않으며, 이런 이름의 예전 요청은 숨겨집니다. 아직 명단에 남아 있다면 예전 줄입니다. **Remove from roster**로 지우세요.',
        },
        {
          term: '내보낸 멤버가 자꾸 돌아와요',
          body: '내보내도 게임 내 클랜은 바뀌지 않으니, 게임에 아직 그 사람이 있는 동안에는 다음 동기화가 다시 넣습니다. 게임에서 내보내거나, 여기서 차단하세요.',
        },
        {
          term: '관리자에게 Who can join이 안 보여요',
          body: 'Staff & roles처럼 admin 전용 탭입니다. [스태프 역할: 누가 무엇을 할 수 있나]({staffGuide})를 보세요.',
        },
      ],
    },
  },

  staffRoles: {
    metaTitle: '스태프 역할: 누가 무엇을 할 수 있나 — Anvil',
    metaDescription:
      'Anvil의 클랜 역할(소유자, admin, 회계 담당, 관리자, 멤버), 각자 닿는 범위, 누군가를 관리자로 만드는 법, 누가 어떤 역할을 줄 수 있는지, 그리고 이벤트 하나만 맡는 직무.',
    eyebrow: 'Anvil · 소유자와 admin용',
    title: '스태프 역할: 누가 무엇을 할 수 있나',
    dek: '역할은 다섯 개이고, 클랜마다 Admin → People → **Staff & roles**에서 정합니다. 여기서의 역할은 다른 클랜에서는 아무 의미가 없고, 누구도 자기와 같거나 더 높은 역할은 줄 수 없습니다. 이 페이지가 전체 지도입니다: 각 역할이 닿는 범위, 역할을 주는 법, 그리고 이벤트 하나만 맡는 직무.',
    facts: [
      { strong: '클랜마다', rest: '여기서의 역할은 다른 곳에서 의미 없음' },
      { strong: '자기보다 아래', rest: '역할만 줄 수 있음' },
      { strong: '소유자', rest: '는 양도로만 넘어감' },
    ],
    footnote:
      '역할은 페이지를 불러올 때마다 다시 확인되므로, 변경은 그 사람의 다음 클릭부터 적용됩니다. 로그아웃할 필요는 없습니다. 명단 자체는 [우리 사람들]({peopleGuide})을, 관리자의 하루는 [당번]({moderatorGuide})을 보세요.',

    roles: {
      title: '역할들',
      intro: 'Discord로 로그인한 사람은 모두 평범한 **Member**로 시작합니다. 그 위로:',
      rows: [
        {
          term: 'Owner',
          body: '클랜을 만든 사람이며, 넘겨주기 전까지 그대로입니다. admin이 할 수 있는 모든 것에 더해 소유권 양도와 클랜 삭제를 할 수 있습니다. 소유자는 딱 한 명이고, 누구도 강등하거나 내보내거나 차단할 수 없습니다.',
        },
        {
          term: 'Admin',
          body: '클랜을 넘겨주는 것만 빼고 전부: 이벤트와 보드, 설정, Discord, 스태프, 그리고 클랜의 돈.',
        },
        {
          term: 'Treasurer',
          body: '참가비, 금고, 상금. 여기에 관리자가 하는 모든 것까지: 명단, 증빙, 대회, 일정, Needs review.',
        },
        {
          term: 'Moderator',
          body: '신입, 명단, 증빙, 주간 대회, 클랜 이벤트. 이벤트나 보드, 설정, 스태프, 돈은 건드리지 못합니다.',
        },
        {
          term: 'Member',
          body: '스태프 업무 없음. 플레이하고, 신청하고, 금고에 기부를 보고할 수 있습니다.',
        },
      ],
      outro:
        'Staff & roles에서 역할 아래에 체크박스가 두 개 있고, admin보다 아래인 누구에게나(평범한 멤버 포함) 쓸 수 있습니다. **Can build bingo boards**는 모든 보드의 Tiles 탭과 Task library를 엽니다. **Can write guides**는 클랜 가이드를 쓸 수 있게 합니다. admin은 처음부터 둘 다 가지고 있습니다.',
    },

    assign: {
      title: '누군가를 관리자로 만들기',
      intro:
        '그 사람이 Discord로 로그인했고, 명단에 있는 캐릭터(멤버든 게스트든)를 연결해 둔 상태여야 합니다. 그다음:',
      steps: [
        'Admin → **People** → **Staff & roles**를 엽니다.',
        '목록은 **Staff**로 열립니다. **Members**나 **All accounts**로 바꾸고 이름을 검색하세요.',
        '**Role** 열에서 **Moderator: newcomers, roster, sign-ups, proofs**를 고릅니다. 고르는 즉시 저장됩니다.',
        '보드도 만들게 하려면 **Can build bingo boards**를 체크합니다.',
      ],
      outro:
        '아직 로그인하지 않았나요? **Roster** 탭에서 그 사람의 캐릭터를 찾아 메뉴를 열고 **Set role**을 고르세요. 역할이 그 캐릭터에 저장됩니다. 그 사람이 처음 로그인해서 캐릭터를 연결할 때, 또는 Needs review에서 기다리는 중이라면 관리자가 승인할 때 역할을 받습니다.',
      note: {
        tag: '역할 거두기',
        body: '역할을 **Member**로 되돌리세요. 누군가의 역할을 바꾸면 이 클랜 보드에서 맡던 보드 직무도 함께 사라지니(5단계 참고), 계속 맡겨야 한다면 나중에 다시 추가하세요.',
      },
    },

    who: {
      title: '누가 무엇을 줄 수 있나',
      intro:
        'Staff & roles는 admin 전용 탭이고, 거기서의 모든 변경은 두 가지 규칙으로 확인됩니다: 자기보다 아래 역할만 줄 수 있고, 자기보다 아래 역할인 사람만 바꿀 수 있습니다.',
      rows: [
        {
          term: '소유자',
          body: 'Admin, Treasurer, Moderator를 주거나 거둘 수 있습니다.',
        },
        {
          term: 'admin',
          body: 'Treasurer와 Moderator를 주거나 거둘 수 있습니다. admin은 다른 사람을 admin으로 만들 수도, 다른 admin을 바꿀 수도, 자기 역할을 바꿀 수도 없습니다.',
        },
        {
          term: '회계 담당과 관리자',
          body: '누구의 역할도 바꿀 수 없습니다. 탭 자체가 보이지 않습니다.',
        },
        {
          term: '아무도',
          body: '소유자의 역할을 바꾸거나, 소유자를 내보내거나 차단할 수 없습니다. 클랜에는 또 항상 admin이 한 명은 남습니다: 마지막 한 명은 강등할 수 없습니다.',
        },
      ],
      note: {
        tag: '클랜 넘겨주기',
        body: '소유자만 할 수 있고, 이미 admin인 사람에게만 넘길 수 있습니다: 그 admin의 줄에 **Make owner** 작업이 생깁니다. 안전을 위해 은행 PIN을 바꿀 때처럼 3일이 걸립니다. 언제 넘어가는지는 모든 관리 페이지의 배너에 표시되고, 그때까지 여러분은 **Cancel**로 취소할 수 있으며 상대는 **Decline**으로 거절할 수 있습니다. Anvil 스태프도 알림을 받고 막을 수 있습니다. 3일이 지나면 그 사람이 소유자가 되고 여러분은 평범한 admin이 됩니다. 다시 넘겨줄 수 있는 건 새 소유자뿐입니다.',
      },
    },

    table: {
      title: '누가 무엇을 할 수 있나',
      intro:
        '관리 화면에서 각 역할이 닿는 범위입니다. “체크 시”는 Staff & roles의 **Can build bingo boards** 또는 **Can write guides** 체크박스를 말합니다.',
      areaLabel: '영역',
      columns: ['소유자', 'Admin', '회계 담당', '관리자', '멤버'],
      rows: [
        { area: '대시보드', cells: ['가능', '가능', '가능', '가능', '불가'] },
        { area: '이벤트: 생성, 편집, 팀, 신청, 시작', cells: ['가능', '가능', '불가', '불가', '불가'] },
        { area: '보드 칸과 Task library', cells: ['가능', '가능', '체크 시', '체크 시', '체크 시'] },
        { area: '확인할 증빙', cells: ['가능', '가능', '가능', '가능', '불가'] },
        { area: '주간 대회', cells: ['가능', '가능', '가능', '가능', '불가'] },
        { area: '클랜 이벤트', cells: ['가능', '가능', '가능', '가능', '불가'] },
        { area: '일정', cells: ['가능', '가능', '가능', '가능', '불가'] },
        { area: '명단: 보기, 추가, 내보내기', cells: ['가능', '가능', '가능', '가능', '불가'] },
        { area: '가입 요청과 Needs review', cells: ['가능', '가능', '가능', '가능', '불가'] },
        { area: '클랜에서 차단하기', cells: ['가능', 'admin 아래만', '불가', '불가', '불가'] },
        { area: 'Staff & roles', cells: ['가능', 'admin 아래만', '불가', '불가', '불가'] },
        { area: 'Who can join', cells: ['가능', '가능', '불가', '불가', '불가'] },
        { area: '금고와 상금 사다리', cells: ['가능', '가능', '가능', '불가', '불가'] },
        { area: '참가비: 걷음으로 표시', cells: ['가능', '가능', '가능', '불가', '불가'] },
        { area: '참가비: 확인(두 번째 서명)', cells: ['가능', '가능', '불가', '불가', '불가'] },
        { area: 'Discord 설정', cells: ['가능', '가능', '불가', '불가', '불가'] },
        { area: 'Discord에 게시', cells: ['가능', '가능', '불가', '불가', '불가'] },
        { area: '클랜 설정: Profile, Features, Rules & scoring, Boosts', cells: ['가능', '가능', '불가', '불가', '불가'] },
        { area: '요금제와 결제', cells: ['가능', '가능', '불가', '불가', '불가'] },
        { area: '가이드', cells: ['쓰기', '쓰기', '읽기, 체크 시 쓰기', '읽기, 체크 시 쓰기', '체크 시 쓰기'] },
        { area: 'Activity log', cells: ['가능', '가능', '가능', '가능', '불가'] },
        { area: 'RuneLite에서 명단 동기화', cells: ['가능', '가능', '불가', '불가', '불가'] },
        { area: '소유권 양도, 클랜 삭제', cells: ['가능', '불가', '불가', '불가', '불가'] },
      ],
      note: {
        tag: '숨겨진 것과 허용되는 것은 다릅니다',
        body: '사이드바에는 내 역할로 쓸 수 있는 것만 나오지만, 실제로 효력이 있는 확인은 서버에서 이뤄집니다. 내 역할로 쓸 수 없는 페이지 주소를 직접 입력하면 대시보드로 돌아가고, 그 뒤의 작업도 거부됩니다.',
      },
    },

    event: {
      title: '이벤트 하나에만 해당하는 직무',
      intro:
        '어떤 직무는 클랜이 아니라 이벤트 하나만 맡습니다. admin이 그 이벤트 안에서 주고, 그 이벤트 말고는 아무것도 건드릴 수 없으니 평범한 멤버에게 줘도 안전합니다.',
      rows: [
        {
          term: '보드 편집자',
          body: '그 보드의 칸을 만들고 편집합니다. 이벤트의 **Settings** → **Staff** → **Board staff**에서 주거나, Staff & roles에서 그 사람 작업 메뉴의 **Boards…**로 줍니다. 이걸 받은 멤버는 관리 화면에서 자기 보드만 봅니다.',
        },
        {
          term: '보드 회계 담당',
          body: '그 보드의 참가비를 걷고 상금 지급을 처리하지만, 클랜 금고에는 닿지 않습니다. 관리 화면에서는 자기 보드만, 그리고 각 보드의 **Sign-ups**와 **Prizes** 탭만 봅니다. 이것도 **Board staff**에서 줍니다.',
        },
        {
          term: '팀 스태프',
          body: '팀 하나를 운영합니다: 그 팀의 명단, 제출과 증빙, 그리고 팀원의 참가비를 낸 것으로 표시하기. 다른 팀을 건드리거나, 보드를 편집하거나, 드래프트 지명을 하거나, 이벤트가 시작된 뒤 누군가를 교체할 수는 없습니다. 팀 페이지의 **Team staff**에서 추가합니다. 방문 클랜의 관리자가 클랜 대항전에서 자기들 절반을 운영하는 방법이 바로 이것입니다.',
        },
        {
          term: '주장',
          body: '주최자가 팀 하나에 지정합니다. 팀 스태프가 할 수 있는 모든 것에 더해 팀의 드래프트 지명을 합니다.',
        },
      ],
      note: {
        tag: '클랜 역할은 보드 직무를 대체합니다',
        body: '누군가에게 클랜 역할을 주거나 바꾸면, 이 클랜 보드에서의 보드 편집자와 보드 회계 담당 직무가 사라집니다. 가진 게 보드 직무뿐인 사람이라면 Staff & roles가 먼저 경고합니다. 계속 맡겨야 한다면 나중에 다시 추가하세요.',
      },
    },

    safety: {
      title: '안전장치',
      intro: '역할을 어떻게 정하든 이것들은 그대로입니다.',
      rows: [
        {
          term: '소유자는 보호됩니다',
          body: 'Staff & roles의 소유자 줄에는 **Protected**가 표시됩니다. 역할을 바꿀 수 없고 차단할 수도 없습니다. 소유권은 소유자가 양도할 때만 넘어갑니다.',
        },
        {
          term: 'admin끼리는 서로 내보낼 수 없습니다',
          body: 'admin은 다른 admin을 강등하지도 차단하지도 못합니다. 한 명씩이든 여러 명을 한꺼번에든 마찬가지입니다. 두 admin의 의견이 갈리면 소유자가 정합니다. 차단하면 그 사람이 이 클랜에서 맡던 스태프 역할과 보드 직무도 사라집니다.',
        },
        {
          term: '돈에는 두 사람이 필요합니다',
          body: '참가비에 확인이 필요할 때, 그 확인은 걷음으로 표시한 사람이 아닌 다른 admin이 해야 합니다. 참가비 하나에 확인이 몇 번 필요한지(0에서 5까지)는 **Clan settings** → **Rules & scoring** → **Fee sign-off**에서 정합니다. 돈을 다루는 admin이 혼자뿐이어도 별도 버튼으로 참가비를 강제로 마감할 수 있습니다.',
        },
        {
          term: '관리자가 할 수 없는 것',
          body: '이벤트 생성이나 편집, 설정이나 Discord 변경, 누군가에게 역할 주기(자기 자신 포함), 클랜의 돈 건드리기.',
        },
        {
          term: '모두 기록에 남습니다',
          body: '역할 변경, 소유권 양도, 차단, 답한 가입 요청은 **Activity log**에 기록되고, 스태프라면 누구나 읽을 수 있습니다.',
        },
        {
          term: 'Discord 역할은 별개입니다',
          body: 'Anvil의 역할 동기화는 Discord 역할을 사이트 역할이 아니라 **게임 내 등급**에 맞춥니다. 여기서 누군가를 관리자로 만들어도 Discord 서버에서는 아무것도 생기지 않고, Discord에서 직접 준 관리자 역할도 그대로 둡니다. 무언가를 바꾸는 봇 명령은 단 하나 —— `/coffer`로 금고에 추가하기 —— 이고, 이것은 사이트 역할(회계 담당, admin, 소유자)을 확인합니다.',
        },
      ],
    },
    log: {
      title: '활동 로그',
      body: [
        '관리자 메뉴의 **Activity log**는 최근 200개의 변경 내역을 보여 주며, 모든 운영진이 읽을 수 있습니다: 가입, 탈퇴, 이름 변경, 인증, 소유권 이전, 주장 임명 및 해제, 참가 신청 승인 또는 거절, 참가비 확인, 기능 전환, 설정 변경. **Filter by event type**으로 범위를 좁힙니다.',
        '중복 정리도 여기서 합니다. **Merge two members**는 중복 항목을 실제 멤버로 합치고, **Suspected renames**는 Anvil이 찾아낸 이름 변경 목록을 보여 주어 확인하거나 거절할 수 있게 합니다.',
      ],
    },
  },
  supporter: {
    metaTitle: 'Anvil Supporter: 등급과 혜택 — Anvil',
    metaDescription:
      'Anvil Supporter, Champion, Patron이 각각 받는 것: 이름 색과 별, 금색 GZ, 움직이는 아바타와 배너, 진열장, 친구 이벤트, 1:1 대결, 이벤트 채팅, 클랜 부스트. Gumroad 결제가 어떻게 돌아가는지, 해지하면 어떻게 되는지.',
    eyebrow: 'Anvil · 플레이어용',
    title: 'Anvil Supporter: 등급과 혜택',
    dek: 'Anvil Supporter는 Anvil의 서버 비용을 대는 개인 구독입니다. 등급은 세 가지이고, 각 등급은 바로 아래 등급의 모든 것을 포함합니다. 모든 혜택은 꾸미기나 더 넉넉한 개최 여유뿐입니다: 기록, 이벤트, 점수, 내 기록은 누구에게나 무료로 남고, 여기 있는 어떤 것도 이벤트의 집계를 바꾸지 않습니다.',
    facts: [
      { strong: '월 $1부터', rest: '연 $10도 가능' },
      { strong: '꾸미기만', rest: '점수, 순위, 아이템은 절대 아님' },
      { strong: '아무것도 지워지지 않음', rest: '그만둬도' },
    ],
    footnote:
      '여기 나오는 모든 것은 웹사이트의 **Settings** → **Supporter**, **Profile look**, **Clan boosts**에서 설정합니다. 부스트에 대한 자세한 내용은 [클랜 부스트하기]({boostsGuide})를, RuneLite에서 색이 어디에 보이는지는 [사이드 패널, 탭별로 보기]({panelGuide})를 보세요.',

    tiers: {
      title: '세 가지 등급',
      intro: '가격은 **Anvil Supporter** 페이지 `/supporter`에 있습니다. 연간 요금제는 10개월 값입니다.',
      rows: [
        {
          term: 'Supporter',
          body: '월 $1 또는 연 $10. 금색 이름과 별, 금색 GZ, 4칸짜리 진열장, 그리고 친구 이벤트를 하나 열 수 있습니다.',
        },
        {
          term: 'Champion',
          body: '월 $2 또는 연 $20. 준비된 그라데이션 중에서 고르는 이름 색(또는 원하는 단색 1개), 내 아바타와 배너(원하면 움직이게), 8칸 진열장, 더 빠른 이벤트 채팅, 그리고 클랜 부스트 1개.',
        },
        {
          term: 'Patron',
          body: '월 $5 또는 연 $50. 최대 4색으로 만드는 나만의 움직이는 그라데이션. 12칸 진열장, 이벤트 채팅 대기 없음, 친구 이벤트 동시에 2개, 그리고 클랜 부스트 2개.',
        },
      ],
      note: {
        tag: '초대로 받는 기간',
        body: 'Settings → Supporter에 초대 링크가 있습니다. 내가 초대한 친구가 결제하면 무료 개월을 받습니다. 보상은 그 친구의 첫 결제 2주 뒤에 들어옵니다. 이렇게 얻은 기간에는 클랜 부스트를 뺀 그 등급의 모든 혜택이 붙습니다.',
      },
    },

    compare: {
      title: '등급별로 받는 것',
      intro: 'Supporter 페이지와 같은 표에 채팅 혜택을 더했습니다.',
      table: {
        areaLabel: '혜택',
        columns: ['무료', 'Supporter', 'Champion', 'Patron'],
        rows: [
          { area: '이름 색', cells: ['—', '금색', '프리셋 또는 직접 고른 한 가지 색', '프리셋 또는 최대 네 가지 색, 움직임'] },
          { area: '이름 옆 별', cells: ['—', '있음', '있음', '있음'] },
          { area: '금색 GZ', cells: ['—', '있음', '있음', '있음'] },
          { area: '내 아바타와 배너, 움직임', cells: ['—', '—', '있음', '있음'] },
          { area: '진열장', cells: ['—', '4칸', '8칸', '12칸'] },
          { area: '친구 이벤트(동시 개수 · 인원)', cells: ['참가만', '1 · 10', '1 · 25', '2 · 50'] },
          { area: '1:1 대결', cells: ['진행 중 1개', '진행 중 5개', '무제한', '무제한'] },
          { area: '이벤트 채팅: 줄 사이 대기', cells: ['5초', '3초', '1초', '없음'] },
          { area: '클랜 부스트', cells: ['—', '—', '1', '2'] },
        ],
      },
      outro:
        '**Settings** → **In-game chat**에는 세 가지가 더 있습니다: 내 채팅 피드 색(Supporter), 로그인 브리핑에 무엇을 담을지 고르기(Champion), 그리고 다른 플레이어의 채팅 피드에서 내 이름 옆에 붙는 별(Patron).',
    },

    names: {
      title: '이름 색',
      intro:
        '**Settings** → **Supporter**의 **Your name’s look**에서 정합니다. 미리 보기에서 어두운 배경과 밝은 배경 위의 내 이름을 볼 수 있습니다.',
      rows: [
        {
          term: 'Supporter',
          body: '단색 금색. 고를 것이 없습니다.',
        },
        {
          term: 'Champion',
          body: '프리셋 그라데이션(기본값인 **Classic**, **Ember**, **Ocean**, **Aurora**, **Rose gold**, **Toxic**) 중 하나, 또는 **Your own**: 움직이지 않는 한 가지 색. 모든 캐릭터를 통틀어 직접 고른 색은 최대 두 가지까지 쓸 수 있습니다.',
        },
        {
          term: 'Patron',
          body: '모든 프리셋에 Patron 기본값인 **Prism**을 더해서, 또는 한 가지에서 네 가지 색으로 된 **Your own**. 한 가지 색은 가만히 있고, 두 가지에서 네 가지 색은 왼쪽에서 오른쪽으로 움직이는 그라데이션이 됩니다.',
        },
      ],
      outro:
        '**Your Anvil display name**은 Discord에 연결된 계정의 이름입니다. **Your RuneScape characters**에서 **Same for all** 또는 **Customize each**를 골라 캐릭터마다 다른 모습을 줄 수 있습니다. **Save**(또는 **Save for all characters**)를 누르세요. **Reset to default**는 내 등급의 색으로 되돌립니다.',
      note: {
        tag: '어두운 배경과 밝은 배경',
        body: '사이트, 플러그인 패널, Discord는 어둡고, 게임의 불투명한 채팅창은 밝습니다. Anvil은 어느 쪽에서도 읽히도록 색을 조정합니다. 한쪽에서 다른 모습을 원하면 **Set a separate look for dark backgrounds** 또는 **for light backgrounds**를 켜세요. 그 모습은 대비 보정 없이 고른 그대로 보이고, 읽기 어려우면 미리 보기가 경고합니다.',
      },
    },

    where: {
      title: '꾸미기가 보이는 곳',
      intro: '색과 별은 내 이름이 나오는 곳이면 어디든 따라갑니다:',
      rows: [
        {
          term: '사이트에서',
          body: '보드, 명단, 프로필, 위쪽 막대의 내 이름, 그리고 캐릭터 이름. 별도 내 색을 입습니다.',
        },
        {
          term: '플러그인 패널에서',
          body: 'Feed, 이벤트 채팅, 카드, 그리고 **Tracking** 줄. Patron의 그라데이션은 흐르고, 각 플레이어는 **Animated names**로 멈출 수 있습니다.',
        },
        {
          term: '게임 안에서',
          body: 'Anvil 플러그인을 쓰는 다른 플레이어에게: 공개, 클랜, 친구, 개인 채팅, 클랜 방송, 로그인 알림, 친구와 클랜 목록, 그리고 우클릭 메뉴(PvP 월드와 황야에서는 절대 안 보임). 게임 채팅의 별은 Patron의 것입니다.',
        },
        {
          term: 'Discord에서',
          body: 'Anvil 게시물에서 내 이름 옆의 별. 색을 골랐다면 그 색으로 그려집니다.',
        },
        {
          term: '금색 GZ',
          body: '사이트의 클랜 피드에서 클랜원의 드롭에 주는 내 GZ가 금색이 될 수 있습니다. Supporter만 줄 수 있습니다.',
        },
      ],
      note: {
        tag: '내 것으로 확인된 캐릭터에서만',
        body: '색은 사이트에서도 게임 안에서도 플러그인이 내 것으로 확인한 캐릭터에만 보입니다. 다른 사람의 게임 채팅에서 내 이름에 색이 보이지 않게 하려면 Settings → Supporter에서 **Show my colours on my characters’ names in game chat**의 체크를 해제하세요.',
      },
    },

    profile: {
      title: '아바타, 배너, 진열장',
      intro: '셋 다 **Settings** → **Profile look**에 있습니다.',
      rows: [
        {
          term: '아바타와 배너',
          body: 'Champion과 Patron. 직접 올리세요. GIF나 WebP는 움직이는 그대로입니다. 내 카드, 프로필, 내 모든 캐릭터에 사이트와 플러그인 양쪽에서 보입니다. 배너는 최대 6 MB에 최소 600×150, 아바타는 최대 2 MB입니다.',
        },
        {
          term: '캐릭터별',
          body: '한 캐릭터에 따로 배너나 아바타, 또는 둘 다를 줄 수 있습니다. 그 캐릭터의 페이지와 플러그인 카드에서만 기본값을 대신합니다.',
        },
        {
          term: '진열장',
          body: '최고의 드롭, 킬 수, 기록을 프로필에 걸어 둡니다: Supporter는 4칸, Champion은 8칸, Patron은 12칸. 공유하지 않는 캐릭터에서 건 것은 비공개로 남습니다.',
        },
      ],
    },

    hosting: {
      title: '친구 이벤트, 1:1 대결, 채팅',
      intro: '꾸미기 대신 더 넉넉하게 놀 수 있게 해 주는 혜택:',
      rows: [
        {
          term: '친구 이벤트',
          body: '**Host an event for your friends**에서 친구들과 할 빙고, 솔로 빙고, 레이스를 직접 열 수 있고, 클랜 이벤트처럼 플러그인이 기록합니다. 친구들은 내 초대 링크로 들어옵니다. Supporter: 진행 중인 이벤트 1개, 10명. Champion: 1개, 25명. Patron: 동시에 2개, 합쳐서 50명. 참가는 누구나 할 수 있습니다.',
        },
        {
          term: '1:1 대결',
          body: '친구의 프로필에서 도전하세요: 드롭을 먼저 얻기, 또는 1시간, 24시간, 7일 동안 킬이나 XP 더 많이 얻기. 자랑할 권리만 걸려 있습니다. 무료 플레이어는 한 번에 1개, Supporter는 5개, Champion과 Patron은 원하는 만큼 열 수 있습니다.',
        },
        {
          term: '이벤트 채팅',
          body: '줄과 줄 사이에 기다리는 시간: 등급 없음 5초, Supporter 3초, Champion 1초, Patron은 대기 없음. 보드 채팅이 붐비면 Patron까지 포함해 모두가 10초 기다립니다.',
        },
        {
          term: '클랜 부스트',
          body: '결제하는 동안 Champion 1개, Patron 2개. [클랜 부스트하기]({boostsGuide})를 보세요.',
        },
      ],
    },

    billing: {
      title: '결제, 변경, 해지',
      intro: 'Anvil Supporter는 Gumroad를 통해 월간 또는 연간으로 결제됩니다.',
      steps: [
        'Anvil에 로그인하고 `/supporter`를 엽니다.',
        '**Choose Supporter**, **Choose Champion**, **Choose Patron** 중 하나를 누릅니다. Gumroad 결제 화면이 열리고, 월간 또는 연간 결제를 고를 수 있습니다.',
        '결제합니다. Gumroad가 Anvil에 알리는 즉시 혜택이 켜지고, Supporter 페이지에 내 등급이 **Your tier**로 표시됩니다.',
      ],
      outro:
        '등급을 바꾸려면 Settings → Supporter의 **Change tier**를 쓰세요. 해지하거나 카드를 바꾸려면 같은 곳의 **Manage on Gumroad**를 쓰세요. 해지한 멤버십도 결제한 기간이 끝날 때까지 모든 혜택을 유지합니다.',
      note: {
        tag: '항상 /supporter에서 시작하세요',
        body: '**Choose** 버튼에는 어느 계정이 결제했는지 Anvil에 알려 주는 코드가 들어 있습니다. Anvil은 결제를 이메일로 맞추지 않으므로, 그 버튼 없이 Gumroad에서 바로 사면 결제가 어느 계정에도 연결되지 않습니다. 그렇게 됐다면 Anvil Discord에 물어보세요. 스태프가 직접 내 계정에 붙여 줄 수 있습니다.',
      },
    },

    lapse: {
      title: '등급을 낮추거나 그만두기',
      intro:
        '설정한 것은 아무것도 지워지지 않습니다. 모든 혜택은 지금 가진 등급에 맞춰 확인되므로, 저절로 꺼졌다가 갱신하는 즉시 돌아옵니다.',
      rows: [
        {
          term: '이름 색',
          body: '저장해 둔 선택은 그대로 남습니다. 그것을 허용하는 등급이 돌아올 때까지는 새 등급의 색을 입거나 색이 없습니다.',
        },
        {
          term: '아바타와 배너',
          body: 'Champion 아래에서는 움직이지 않고 첫 프레임으로 멈춰 보입니다.',
        },
        {
          term: '진열장',
          body: '내 등급이 허용하는 만큼 앞쪽 것을 보여 주고 나머지는 숨깁니다. 등급이 없으면 진열장이 숨겨지고, 걸어 둔 것은 그대로 기다립니다.',
        },
        {
          term: '클랜 부스트',
          body: '가장 오래된 부스트는 계속 집계되고, 나머지는 제거되지 않고 일시 정지됩니다.',
        },
      ],
      note: {
        tag: 'Anvil 스태프가 주는 임시 업그레이드',
        body: '스태프는 감사 표시 등으로 누군가에게 한동안 더 높은 등급을 줄 수 있습니다. 이것은 결제한 것 위에 얹힐 뿐 구독을 바꾸지 않습니다. Settings → Supporter에 **A gift from Anvil**과 끝나는 날이 표시되고, 그 뒤에는 결제한 등급으로 돌아갑니다. 선물은 스태프가 포함시킨 경우에만 클랜 부스트 칸을 줍니다.',
      },
    },
  },

  sidePanel: {
    metaTitle: 'Anvil 사이드 패널, 탭별로 보기 — Anvil',
    metaDescription:
      'Anvil RuneLite 사이드 패널의 각 탭(Clan, Feed, You, Lookup, 톱니바퀴)이 보여 주는 것, 이벤트 채팅과 Feed 반응이 어떻게 동작하는지, 그리고 게임 채팅의 피드, Supporter 색, 움직이는 이름에 관한 플러그인 설정.',
    eyebrow: 'Anvil · 플레이어용',
    title: '사이드 패널, 탭별로 보기',
    dek: 'RuneLite 사이드바의 Anvil 버튼을 누르면 탭 네 개와 톱니바퀴가 있는 패널이 열립니다: **Clan**, **Feed**, **You**, **Lookup**, 그리고 ⚙. 보이는 것 대부분은 사이트에서 오므로, 플러그인을 업데이트하지 않아도 최신으로 유지됩니다. 아래 몇 가지는 다음 플러그인 업데이트에 들어온다고 표시해 두었습니다.',
    facts: [
      { strong: '탭 네 개', rest: '그리고 동기화와 설정용 톱니바퀴' },
      { strong: '이벤트 채팅', rest: 'Feed 탭 안에' },
      { strong: 'GZ, Sad, Sit', rest: 'Feed의 각 줄에' },
    ],
    footnote:
      '플러그인 설치와 로그인은 [RuneLite 플러그인 설정]({pluginGuide})에 있습니다. Supporter 색, 별, 채팅 혜택은 [Anvil Supporter: 등급과 혜택]({supporterGuide})에서 설명합니다.',

    header: {
      title: '패널 맨 위',
      intro: '탭 위에는 제목, **Refresh**, 계정 줄이 있습니다.',
      rows: [
        {
          term: 'Refresh',
          body: 'Feed 탭을 포함해 패널을 다시 불러옵니다. 동작하는 동안 **Refreshing…**이라고 표시됩니다. 다음 플러그인 업데이트에서는 You와 Lookup도 다시 불러와 새 아바타나 배너가 바로 보이고, 더 이상 Feed 탭을 비우지 않습니다.',
        },
        {
          term: 'Tracking',
          body: '제목 아래 줄에 기록 중인 캐릭터 이름이 나오며, Supporter 색이 있으면 그 색으로 보입니다. **Not my account…**는 이 컴퓨터에서 다른 사람이 플레이하는 캐릭터의 기록을 멈추고, **Track again**은 그걸 되돌립니다.',
        },
        {
          term: '계정 메뉴',
          body: '⋯ 링크를 누르면 **View my profile on Anvil**, **Not my account…**, **Sign out…**이 열립니다. 다음 플러그인 업데이트에서는 **Become a Supporter**, 이미 Supporter라면 **Your Supporter perks**도 생깁니다.',
        },
        {
          term: '시즌 진행 상황',
          body: '다음 플러그인 업데이트에서, Leagues, Deadman 등 시즌제 월드에서는 **Sharing season progress · Turn off**라는 줄이 나옵니다. 내 렐릭, 지역, 과제(스크린샷 포함)를 클랜에 보내고, 무엇을 게시할지는 클랜이 웹사이트에서 정합니다. **Turn on**을 누르면 다시 공유합니다. 같은 스위치가 플러그인 설정의 **Share seasonal activity**에도 있습니다.',
        },
      ],
    },

    clan: {
      title: 'Clan',
      intro:
        '내 이벤트와 클랜입니다. 크리에이터 스페이스에서는 이 탭이 **Space**로 표시됩니다.',
      rows: [
        {
          term: '클랜 드롭다운',
          body:
            '두 개 이상의 클랜이나 스페이스에서 플레이할 때 표시됩니다. **All clans**(기본값)는 라이브 이벤트를 먼저 보여 주며 플레이 중인 모든 것을 표시합니다. 한 클랜을 고르면 패널이 그 클랜으로 좁혀지고 제출 내용도 그곳에 저장됩니다.',
        },
        {
          term: '다음 할 일',
          body: '맨 위의 금색 카드로, 지금 하면 가장 좋은 한 가지를 알려 줍니다. 예: 이벤트 참가, 설문 응답, 첫 시작 샷.',
        },
        {
          term: '이벤트',
          body:
            '라이브 및 예정된 모든 보드, Skill 또는 Boss of the Week, 클랜 이벤트와 현재 순위를 보여 줍니다. 그다음 **Your other boards**, **Also live**, **Your clan**이 나옵니다.',
        },
        {
          term: '보드',
          body:
            '열면 순위(상위 3명과 내 줄, 나머지는 **View all**), 팀, 미션, 최근 활동, 가까운 타일, **View all tiles**를 볼 수 있습니다. **Feed**와 **Chat** 버튼은 그 보드를 Feed 탭에서 엽니다.',
        },
        {
          term: '순위 변동',
          body: '이름 옆의 초록색 **▲** 또는 산호색 **▼**와 숫자는 그날이 시작된 이후 얼마나 움직였는지를 보여 줍니다.',
        },
        {
          term: '클랜 이벤트',
          body: '이벤트에 따라 **I’m going**, **Sign me up**, **Answer the survey**가 표시됩니다.',
        },
      ],
    },

    feed: {
      title: 'Feed',
      intro:
        '클랜과 보드의 큰 순간을 실시간으로: 드롭, 펫, 업적, 퀘스트, 죽음, 완료한 타일.',
      rows: [
        {
          term: '누구의 피드',
          body: '상단 드롭다운에는 소속된 각 클랜의 **Clan ·**와 참여 중인 각 라이브 보드의 **Event ·**가 나옵니다. 자신의 보드가 있으면 그곳을, 없으면 클랜을 엽니다.',
        },
        {
          term: '필터',
          body:
            '**All**, **Tiles**(보드만), **Drops**, **Pets**, **Achievements**, **Deaths**, **Milestones**(슬레이어, 클루, 처치 횟수 등. 플레이어가 켠 경우), 보드에서 팀에 속한 경우 **My team**. 클랜 피드에는 Leagues 및 기타 모드를 위한 게임 모드 활동 버튼도 있습니다.',
        },
        {
          term: '새 행',
          body: '자동으로 나타납니다. 스크롤해서 멀어졌다면 **↑ N new** 알약 모양 버튼이 다시 그곳으로 데려갑니다.',
        },
      ],
      note: {
        tag: '게임 내 채팅 피드와는 다릅니다',
        body: 'Feed 탭은 플러그인 설정과 상관없이 동작합니다. **Show feed in game chat**(8단계)은 피드를 채팅창에도 찍어 주는 별도의 설정입니다.',
      },
    },

    reactions: {
      title: '반응',
      intro: 'Feed의 각 줄 아래에는 그 줄의 반응이 있습니다:',
      rows: [
        {
          term: 'GZ',
          body: '드롭, 펫, 업적에. 옆에 개수가 보입니다. 예: **GZ 3**.',
        },
        {
          term: 'Sad와 Sit',
          body: '죽음에는 GZ 대신 이것이 붙습니다. Sit은 죽은 사람에게 “앉아 있어”라고 놀리는 게임 속 표현입니다.',
        },
        {
          term: '누가 반응할 수 있나',
          body: '클랜 피드에서는 클랜원. 보드에서는 그 보드의 플레이어와 주최 측 스태프. 순위를 숨긴 보드에서는 플레이어가 자기 팀의 줄에만 반응할 수 있습니다.',
        },
        {
          term: '누가 반응했나',
          body: '반응에 마우스를 올리면 “GZ · Mossy and 3 others”처럼 이름이 보입니다. 다시 클릭하면 내 반응을 거둡니다.',
        },
      ],
      note: {
        tag: '다음 플러그인 업데이트에서',
        body: '반응이 알약 모양 버튼이 되고, 내가 누른 것은 색이 입혀지며, 다른 사람의 반응이 보고 있는 모두에게(내 다른 클라이언트 포함) 실시간으로 갱신됩니다. 지금은 내가 반응하거나 Feed를 다시 불러올 때 개수가 바뀝니다. Supporter 반응인 금색 GZ는 웹사이트 피드에서 주는 것이고, Feed 탭에는 GZ, Sad, Sit이 있습니다.',
      },
    },

    chat: {
      title: '이벤트 채팅',
      intro:
        '채팅이 켜진 보드에는 Feed 탭 위쪽에 **Feed / Chat** 전환이 있고, 그 보드의 플레이어와 주최 측 스태프가 쓸 수 있습니다. Clan 탭의 보드 페이지에도 **Chat** 버튼이 있습니다.',
      rows: [
        {
          term: '모두 또는 내 팀',
          body:
            '상단 칩으로 채널을 고르세요: 보드 전체는 **All teams**, 내 팀만은 **My team**, 호스트와 모드만 글을 쓸 수 있는 **Announcements**. 각 칩에는 읽지 않은 줄 수가 표시됩니다. 호스트와 모드의 줄에는 **HOST** 또는 **MOD**가 붙습니다.',
        },
        {
          term: '보내기',
          body: '상자에 입력하고 Enter를 누르세요. 줄은 최대 200자이며, 링크는 호스트와 모드만 게시할 수 있습니다.',
        },
        {
          term: '전송 간격',
          body:
            '내 줄 사이의 대기 시간은 Supporter 등급에 따릅니다. 등급이 없으면 5초, Supporter는 3초, Champion은 1초, Patron은 대기가 없습니다. 상자 아래 줄에 내 값이 표시됩니다. 스태프는 기다리지 않습니다.',
        },
        {
          term: '저속 모드',
          body: '보드 채팅이 매우 붐비면, Patron을 포함해 모두 1분 동안 최소 10초를 기다립니다. 10초 안에 10줄을 넘게 보낼 수 없습니다.',
        },
        {
          term: '관리',
          body:
            '호스트와 모드는 줄을 우클릭해 **Delete message**를 하거나 누군가를 **Mute**할 수 있고, **Pause chat**으로 채팅을 일시 중지할 수 있습니다. 일시 중지하면 스태프를 제외한 모두가 글을 쓸 수 없으며, **Announcements**는 예외입니다. 패널의 **Mute**는 관리 페이지에서 해제할 때까지 유지되는 차단입니다. 그곳에서는 5분, 1시간, 24시간(또는 1분에서 30일 사이의 아무 시간) 타임아웃도 줄 수 있으며, 이는 그 사람의 모든 채널을 닫습니다. 채팅을 채널별로 필터링할 수도 있습니다.',
        },
      ],
      outro:
        '한 사람이 이어서 쓴 줄은 5분 공백이 생기기 전까지 이름과 시간을 하나로 묶어 보여 줍니다. 채팅은 이벤트가 끝난 뒤 7일 동안 보관됩니다.',
    },

    you: {
      title: 'You와 Lookup',
      intro: '플레이어 카드 탭 두 개: 내 것, 그리고 다른 누구의 것.',
      rows: [
        {
          term: '나',
          body:
            '로그인한 캐릭터의 내 카드입니다: 배너와 아바타, **Display case**, 그리고 **Stats**, **Bosses**, **Log** 탭(각 페이지 아이템까지의 컬렉션 로그, 그리고 클루, 시간, 전투 업적). 그 아래에는 나를 기다리는 **Head-to-head** 도전(**Accept** 또는 **Decline**)과 **+ Add goal**이 있는 **Goals**가 있습니다.',
        },
        {
          term: '검색',
          body:
            '**Players**와 **Clans** 사이를 전환하고, 이름을 입력한 뒤 Enter를 누르세요. **Recent**에는 최근 사용한 항목이 나옵니다. 게임 안에서 누구든 우클릭하고 **Anvil**을 고르면 여기로 옵니다.',
        },
        {
          term: '비교',
          body:
            '다른 사람의 카드에서 **Compare with me**를 누르면 스킬별, 보스별, 페이지별로 나와 비교할 수 있습니다. 클랜 카드에는 **Compare with my clan**이 있습니다.',
        },
      ],
    },

    gear: {
      title: '톱니바퀴 탭',
      intro: '볼거리보다는 동기화와 설정:',
      rows: [
        {
          term: 'Sync profile',
          body: '컬렉션 로그와 최고 기록을 Anvil로 보냅니다.',
        },
        {
          term: 'Sync clan roster',
          body: '클랜 admin 전용: 게임 내 클랜 멤버 목록을 사이트로 보냅니다. 플러그인이 클랜을 읽지 못하면 대신 **Join your clan channel to sync the roster**라고 표시됩니다.',
        },
        {
          term: 'Banner sounds',
          body: '**Add clip**으로 배너가 재생할 소리를 넣고, **Copy folder path**로 소리를 관리하며, **Add mission clip**으로 미션용 소리를 넣습니다.',
        },
        {
          term: 'Become a Supporter',
          body: '다음 플러그인 업데이트에서 맨 아래에 ★ 링크가 생겨 Supporter 페이지를 엽니다. 이미 Supporter라면 **Your Supporter perks**로 표시됩니다.',
        },
      ],
    },

    settings: {
      title: '보이는 것을 바꾸는 설정',
      intro:
        'RuneLite의 Anvil 설정 중 **Chat messages** 아래에 있습니다. 처음에는 모두 켜져 있습니다.',
      rows: [
        {
          term: 'Show feed in game chat',
          body: '피드를 일어나는 대로 채팅창에도 찍어 줍니다: 주최자가 켜 둔 보드와 내가 게스트로 있는 클랜의 큰 드롭, 펫, 업적, 우리 팀원의 타일 진행, 그리고 다른 팀이 완료한 타일.',
        },
        {
          term: 'Supporter names in chat',
          body: '공개, 클랜, 친구, 개인 채팅과 친구 목록, 채널 멤버 목록에서 Supporter의 색(과 Patron의 별)을 보여 줍니다. 이름 목록은 Anvil에서 내려받고, 내가 누구를 보는지에 대해서는 아무것도 보내지 않습니다.',
        },
        {
          term: 'Animated names',
          body: '패널, Feed, 이벤트 채팅에서 Patron의 그라데이션이 흐르게 합니다. 끄면 멈춰 있습니다. 다음 플러그인 업데이트에서는 부스트된 클랜 이름과 패널의 움직이는 배너에도 적용됩니다.',
        },
        {
          term: 'Supporter names in menus',
          body: '우클릭할 때 Supporter의 이름에 그 사람의 색을 입힙니다. PvP 월드와 황야에서는 절대 적용되지 않습니다.',
        },
        {
          term: 'Over other plugins’ colours',
          body: '켜면 Player Indicators 같은 다른 플러그인이 정한 이름 색을 Supporter의 색이 대신합니다. 끄면 그런 이름은 그대로 둡니다.',
        },
      ],
    },
  },

  clanBoosts: {
    metaTitle: '클랜 부스트하기 — Anvil',
    metaDescription:
      'Anvil 클랜 부스트가 어떻게 동작하는지: 누가 가지고 있는지, 부스트를 놓고 옮기는 법, 세 가지 부스트 레벨과 각 레벨이 여는 것, 클랜 이름 색, 선물받은 부스트, 그리고 부스터 표시와 배지.',
    eyebrow: 'Anvil · Supporter와 클랜 스태프용',
    title: '클랜 부스트하기',
    dek: '결제 중인 Champion이나 Patron은 자기가 멤버인 클랜에 부스트를 놓을 수 있습니다. 클랜 멤버들의 부스트가 충분히 모이면 클랜 레벨이 오르고, 레벨마다 클랜이 보이는 모습과 목록에 오르는 자리가 바뀝니다. 부스트는 꾸미기일 뿐입니다: 순위, 점수, 자리, 클랜의 요금제는 절대 바뀌지 않습니다.',
    facts: [
      { strong: 'Champion 1개, Patron 2개', rest: '결제하는 동안의 부스트' },
      { strong: '레벨은 3, 8, 15에서', rest: '집계된 부스트 기준' },
      { strong: '일주일에 한 번', rest: '부스트를 옮길 수 있음' },
    ],
    footnote:
      '멤버는 **Settings** → **Clan boosts**에서 부스트를 놓습니다. 클랜 스태프는 Admin → **Clan settings** → **Boosts**에서 레벨과 그 옵션을 봅니다. 등급 자체는 [Anvil Supporter: 등급과 혜택]({supporterGuide})을 보세요.',

    what: {
      title: '누가 부스트를 가지나',
      intro: '부스트는 유료 멤버십에 딸려 옵니다:',
      rows: [
        { term: 'Champion', body: '부스트 1개.' },
        { term: 'Patron', body: '부스트 2개.' },
        {
          term: 'Supporter',
          body: '없음. 초대로 얻은 기간에도 없습니다. Anvil 스태프의 임시 업그레이드는 스태프가 포함시킨 경우에만 칸을 줍니다.',
        },
      ],
      outro:
        '부스트는 캐릭터가 아니라 나에게 속합니다: 세 클랜에 캐릭터가 셋 있어도 부스트 한 묶음을 함께 씁니다. **Settings** → **Clan boosts**는 내가 Supporter이거나 아직 놓아 둔 부스트가 있을 때만 설정에 나타납니다.',
    },

    place: {
      title: '부스트 놓기와 옮기기',
      intro: '부스트는 직접 놓습니다. 누구도 대신 놓아 줄 수 없습니다.',
      steps: [
        '**Settings** → **Clan boosts**를 엽니다. **Your boosts**에 놓아 둔 부스트와 빈 **Free slot**이 나열됩니다.',
        '**Clans you can boost**에서 클랜 옆의 **Boost**를 누릅니다. 클랜 자체 페이지의 Boosters 섹션에서 **Boost this clan**을 눌러도 됩니다.',
        '옮기려면 그 줄의 **Move to…**로 다른 클랜을 고릅니다. **Remove**는 부스트를 뺍니다.',
      ],
      rows: [
        {
          term: '14일 된 멤버 자리',
          body: '각 부스트는 내 캐릭터 하나가 게임 내 클랜에서 가진 멤버 자리에 올라탑니다. 게스트 자리는 부스트를 실을 수 없습니다. 자리의 날짜는 Anvil이 그 자리를 처음 본 때와 게임이 알려 주는 캐릭터의 가입일 중 이른 쪽부터 셉니다. 그때까지는 클랜 줄에 며칠 남았는지 표시됩니다.',
        },
        {
          term: '클랜마다 한 줄',
          body: '목록에는 각 클랜이 한 번씩만 나오고, 부스트를 실을 캐릭터는 Anvil이 고릅니다: 가능하면 본캐, 아니면 가장 오래 자리를 지킨 캐릭터. 클랜에는 그 캐릭터만 보이고, 내 다른 캐릭터는 보이지 않습니다.',
        },
        {
          term: '일주일에 한 번',
          body: '놓은 부스트는 놓은 지 7일 뒤에 옮길 수 있습니다. 뺀 부스트의 칸도 같은 날짜에 다시 열리므로, 뺐다가 다시 놓는 건 지름길이 아닙니다. 부스트를 실은 캐릭터가 클랜을 떠났다면 바로 옮길 수 있습니다.',
        },
      ],
      note: {
        tag: '라벨의 뜻',
        body: '**counting**: 클랜 레벨에 집계되고 있습니다. **paused**: 지금 등급의 칸이 놓아 둔 수보다 적어서, 가장 오래된 부스트는 계속 집계되고 나머지는 기다립니다. **seat gone**: 부스트를 실은 캐릭터가 더 이상 그 클랜 멤버가 아닙니다. 옮기세요. **over the 2-per-person cap**: 그 클랜은 이미 내 부스트 두 개를 집계하고 있습니다.',
      },
    },

    levels: {
      title: '레벨',
      intro:
        '클랜 레벨은 집계된 부스트로 정해집니다. 한 사람에게서 한 클랜에 집계되는 부스트는 최대 두 개이므로, 레벨이 있다는 건 여러 멤버가 그 클랜을 골랐다는 뜻입니다.',
      rows: [
        { term: '레벨 1', body: '집계된 부스트 3개.' },
        { term: '레벨 2', body: '집계된 부스트 8개.' },
        { term: '레벨 3', body: '집계된 부스트 15개.' },
      ],
      outro:
        '멤버는 클랜 페이지에서 진행 상황을 봅니다. 예를 들면 “5 of 8 to Level 2”. 레벨이 오른 클랜은 새 레벨을 바로 받습니다.',
      note: {
        tag: '일주일의 유예',
        body: '부스트가 어떤 레벨 아래로 떨어지면, 클랜은 그 레벨의 혜택을 7일 동안 유지합니다. 끝나는 때는 Admin → Clan settings → Boosts에 나옵니다. 그 안에 멤버들이 다시 부스트하면 아무것도 바뀌지 않습니다.',
      },
    },

    perks: {
      title: '레벨마다 여는 것',
      intro: '각 레벨은 아래 레벨의 모든 것을 그대로 가집니다.',
      rows: [
        {
          term: '레벨 1',
          body: '클랜 페이지, Clan Hall 카드, 검색에 붙는 **Boosted** 배지. Clan Hall과 그 검색 결과에서 부스트 없는 클랜보다 위의 자리. 그리고 그라데이션으로 된 클랜 이름.',
        },
        {
          term: '레벨 2',
          body: 'Clan Hall **Featured** 줄의 자리. 클랜의 움직이는 배너 재생(레벨 2 아래에서는 정지 프레임). 방문자에게 보이는 모집 문구. 그리고 이름의 그라데이션이 움직입니다.',
        },
        {
          term: '레벨 3',
          body: 'Clan Hall 맨 위의 **Spotlight**, 그리고 클랜이 직접 쓰는 Anvil Discord 모집 글 한 달에 한 번.',
        },
      ],
      note: {
        tag: '클랜 로고는 혜택이 아닙니다',
        body: '움직이는 로고(GIF나 WebP 클랜 이미지)는 어느 레벨에서든 재생됩니다. 레벨 2를 기다리는 건 배너뿐입니다.',
      },
    },

    colours: {
      title: '클랜 이름 색',
      intro:
        '레벨 1부터 클랜 이름에 Anvil의 그라데이션이 입혀집니다. 소유자와 admin은 Admin → **Clan settings** → **Boosts** → **Clan name colours**에서 직접 고를 수 있습니다:',
      rows: [
        {
          term: '한 가지에서 네 가지 색',
          body: '한 가지 색은 정지된 이름, 두 가지에서 네 가지 색은 그라데이션이 됩니다. 레벨 2부터 그라데이션이 움직입니다.',
        },
        {
          term: '어두운 배경과 밝은 배경',
          body: 'Supporter 이름처럼, Anvil은 어두운 배경(사이트, 플러그인 패널, Discord)과 밝은 배경(게임의 불투명한 채팅창)에서 읽히도록 색을 조정합니다. 어느 한쪽에 별도의 모습을 켜면 고른 그대로 보입니다.',
        },
        {
          term: 'Reset to Anvil',
          body: 'Anvil의 팔레트로 되돌립니다.',
        },
      ],
      outro:
        '클랜이 레벨 1 아래로 떨어져도 색은 저장된 채로 남고, 다시 올라오면 돌아옵니다. 플러그인은 다음 새로 고침 때 변경을 반영합니다.',
    },

    staff: {
      title: '클랜 스태프를 위해',
      intro:
        'Admin → **Clan settings** → **Boosts**는 소유자와 admin용입니다. 스태프가 멤버 대신 부스트를 놓을 수는 없습니다. 멤버가 직접 놓습니다.',
      rows: [
        {
          term: '레벨',
          body: '클랜 레벨, 집계 중인 부스트 수, 다음 레벨까지 더 필요한 수, 그리고 유예 주간이 있다면 그것.',
        },
        {
          term: 'Recruiting line',
          body: '레벨 2. 최대 140자의 한 문장으로, 클랜에 속하지 않은 사람에게 클랜 페이지와 Clan Hall 카드에서 보입니다.',
        },
        {
          term: 'Recruitment post in the Anvil Discord',
          body: '레벨 3. 달력상 한 달에 한 번, 20자에서 500자. 직접 쓰고 **Post it**을 누르면 클랜 페이지 링크와 함께 게시됩니다. 멘션은 제거되고 아무도 알림을 받지 않습니다. 다음 달까지는 수정하거나 다시 보낼 수 없습니다.',
        },
        {
          term: 'Boosters',
          body: '클랜을 부스트하는 캐릭터 목록.',
        },
      ],
      note: {
        tag: 'Anvil이 선물한 부스트',
        body: 'Anvil 스태프는 정해진 기간 동안 또는 기한 없이 클랜에 레벨을 선물할 수 있습니다. 선물은 그 레벨에 모자란 부스트만큼만 더하며, 클랜의 Boosters 목록에 **Anvil gift**로 표시됩니다. 멤버의 진짜 부스트 하나가 선물받은 부스트 하나를 대신하고, 이미 선물받은 레벨보다 위에 있는 클랜은 자기 레벨을 유지합니다. 선물이 끝나면 클랜은 멤버들의 부스트로 닿는 레벨로 돌아갑니다.',
      },
    },

    boosters: {
      title: '부스터 표시와 배지',
      intro: '부스터가 자기가 부스트한 클랜에서 받는 것:',
      rows: [
        {
          term: '부스터 표시',
          body: '그 클랜의 명단, 피드, Discord 게시물에서 캐릭터 옆에 붙는 작은 보석. 마우스를 올리면 “Boosts this clan”이 보입니다.',
        },
        {
          term: 'Boosters 벽',
          body: '클랜 페이지에 있습니다: 캐릭터마다 한 줄, 부스트가 많은 순서, 그다음 가장 오래 이어진 순서.',
        },
        {
          term: '배지',
          body: '클랜의 첫 부스트를 놓은 사람에게 **First booster**. 끊김 없이 부스트한 기간에 따라 **1 month**, **3 months**, **6 months**, **1 year**. 그리고 클랜을 그 레벨로 올린 부스트에 **Level-up 1**, **2**, **3**.',
        },
      ],
      note: {
        tag: '옮기면 시계가 다시 시작됩니다',
        body: '기간 배지는 그 캐릭터의 아직 집계 중인 가장 오래된 부스트부터 셉니다. 그래서 부스트를 옮기거나 빼면 처음부터 다시 셉니다. 내 프로필에는 내가 부스트하는 클랜이 클랜마다 한 번씩 나열됩니다.',
      },
    },
  },

  profile: {
    metaTitle: '내 프로필, Wrapped와 Compare — Anvil',
    metaDescription: 'Anvil이 여러분에 대해 보관하는 페이지들: 프로필, 캐릭터별 공개 페이지, 개인 페이지, 월간 및 연간 Wrapped, 이벤트 Wrapped 카드, 그리고 캐릭터 두 개를 나란히 비교하는 페이지.',
    eyebrow: 'Anvil · 플레이어용',
    title: '내 프로필, Wrapped와 Compare',
    dek: 'Anvil은 **여러분**을 위한 페이지 하나와, 여러분이 플레이하는 **캐릭터마다** 하나씩 페이지를 보관합니다. 그 페이지에 무엇이 있는지, 누가 열어 볼 수 있는지, 그리고 매달과 이벤트가 끝날 때마다 나오는 Wrapped 카드를 정리했습니다.',
    facts: [
      {
        strong: '기본값은 공유',
        rest: '스위치 하나로 어떤 캐릭터든 비공개로 전환',
      },
      {
        strong: '월간 Wrapped',
        rest: '다음 달 1일에 공개',
      },
      {
        strong: '이벤트 Wrapped',
        rest: '이벤트가 끝나면 공개',
      },
    ],
    footnote: '여기 언급된 모든 스위치는 [설정, 페이지별로]({settingsGuide})에서 있는 곳마다 설명되어 있습니다.',
    pages: {
      title: '내 페이지',
      intro: '네 개의 페이지가 각각 다른 질문에 답합니다:',
      rows: [
        {
          term: '내 프로필',
          body: '[/profile](/profile), 오직 나만 볼 수 있습니다. 위쪽 칩에서 캐릭터를 고르면 레벨, 보스, 컬렉션 로그, 이벤트를 볼 수 있습니다. 캡틴은 여기서 **Captain’s deck**도 봅니다.',
        },
        {
          term: '캐릭터 페이지',
          body: '`/p/<name>`: 공유되는 동안 링크를 가진 누구나 읽을 수 있는 캐릭터 하나. 스킬, 보스, 컬렉션 로그, 개인 최고 기록을 보여 주며, 일부러 클랜 순위, 이벤트 기록, Discord 이름은 빼 둡니다.',
        },
        {
          term: '개인 페이지',
          body: '`/u/…`: 공유된 캐릭터를 모두 한 페이지에 모아 보여 주며, 전시 진열대와 골라서 보여 주기로 한 스트리밍 계정이 함께 있습니다. **Show that my characters are one person**을 켰을 때만 존재합니다.',
        },
        {
          term: '클랜의 멤버 페이지',
          body: '`/c/<clan>/members/<name>`: 한 클랜이 보는 것과 같은 캐릭터 페이지로, 그 클랜의 **Members** 목록에서 들어갑니다. 비공개 클랜은 자기 구성원에게만 멤버를 보여 줍니다.',
        },
      ],
    },
    sharing: {
      title: '누가 무엇을 볼 수 있나',
      body: [
        '모든 캐릭터는 처음에 **shared** 상태로 시작합니다. 페이지는 링크를 가진 누구에게나 열리며, 리더보드와 다른 클랜에도 나타날 수 있습니다. 설정의 **Who sees my characters**에서 끄면 나 말고는 모두에게 그 페이지가 _not found_로 나옵니다. 나에게는 **Private — only you can see this page.**와 **Share it →** 링크가 보입니다.',
        '공유된 페이지에는 이름 아래 **Copy link**가 있습니다. 로그인한 방문자가 페이지가 악의적이라고 생각하면 **Report this profile**을 누를 수 있습니다.',
        '캐릭터별로 설정에서 그 캐릭터가 속한 게임 내 클랜을 숨길 수도 있습니다(**Show my in-game clan**). 그러면 그 캐릭터의 페이지와 그 클랜의 Anvil 페이지에서 사라집니다.',
      ],
    },
    wrapped: {
      title: '월간 및 연간 Wrapped',
      body: [
        '매달 캐릭터마다 Wrapped 카드가 하나씩 생깁니다: **XP gained**, **Boss kills**, 컬렉션 로그의 **New slots**, **Efficient** 시간, **PBs**, 그리고 펫과 가장 큰 드롭. **다음 달 1일**(UTC)에 공개됩니다. 그 전까지는 나만 미리보기로 열 수 있습니다.',
        '연간 카드도 있으며 `/p/<name>/wrapped/<year>`에서 **12월 1일**부터 볼 수 있습니다. `/p/<name>/wrapped`는 언제나 가장 최근 카드로 이동합니다.',
        '**Copy link to your Wrapped**를 눌러 공유하세요. Discord에 붙여 넣으면 카드 그림으로 펼쳐집니다. 비공개 캐릭터의 Wrapped는 나만 열 수 있으며, 그 링크는 평범한 Anvil 카드로 미리보기됩니다.',
      ],
      note: {
        tag: '빈 달',
        body: '그 달에 Anvil에 아무것도 도착하지 않았다면(XP, 처치, 로그 슬롯, PB 없음) 카드에 0을 보여 주는 대신 그렇다고 알려 줍니다. 플러그인으로 플레이하거나 순위표가 여러분을 잡아 주면 다음 달에는 채워집니다.',
      },
    },
    events: {
      title: '이벤트 Wrapped',
      body: [
        '보드가 끝나면 모든 플레이어와 모든 팀이 카드를 받습니다. 이벤트의 **Wrapped** 페이지를 여세요. 맨 위에 **Your card**, 그다음 **Teams**(순위, 점수, 플레이어)와 **Players**가 있습니다. **Open and share your card**를 누른 뒤 **Copy share link**를 누르세요.',
        '끝나기 전에는 **Cards aren’t out yet**이 보입니다. 운영진은 플레이어가 보기 전에 카드를 확인할 수 있도록 미리보기를 먼저 열 수 있습니다.',
        '카드 그림은 초대 전용이 아닌 공개 클랜의 이벤트에서만 나옵니다. 그 밖의 이벤트는 해당 이벤트를 볼 수 있는 사람에게만 링크가 작동하며, 평범한 Anvil 카드로 미리보기됩니다.',
      ],
    },
    compare: {
      title: '캐릭터 두 개 비교',
      body: [
        '[Compare](/compare)를 열고 이름 두 개를 입력하세요. 스킬, 보스, 컬렉션 로그 페이지를 나란히 볼 수 있습니다. 각 항목에서 앞서는 쪽은 금색으로 표시됩니다. 그 아래에는 분석, 스킬별 XP, 둘 중 한 명이라도 잡은 모든 보스, 그리고 로그 페이지의 항목별 비교(둘 다 가짐, 둘 다 없음, 한 명만 가짐)가 있습니다. **Swap sides**로 좌우를 바꿉니다.',
        '공유된 캐릭터만 비교할 수 있습니다. 비공개 캐릭터나 Anvil이 모르는 이름이면 _not on Anvil, or not shared_가 나옵니다. 로그인한 상태라면 내 비공개 캐릭터는 언제든 비교할 수 있습니다.',
      ],
    },
    news: {
      title: '새 소식과 변경 기록',
      body: [
        '[What’s new](/whats-new)는 Anvil의 변경 사항을 최신순으로 보여 줍니다. 로그인하면 내 등급과 클랜에 중요한 소식인 **For you**가 먼저 나오고, 그다음 **Everything new**가 나옵니다. 플러그인 업데이트가 필요한 항목에는 **Coming in the next plugin update**라고 표시됩니다.',
        '[changelog](/changelog)에는 모든 릴리스의 소식, 주요 내용, 그리고 **New**, **Improved**, **Fixed** 항목이 나옵니다.',
        '릴리스가 나가면 그 소식은 Anvil Discord와 클랜의 Anvil updates에 게시되며, 플러그인은 로그인할 때 한 줄을 표시합니다. 작은 수정은 다음 게시물에 묶입니다.',
      ],
    },
  },
  settings: {
    metaTitle: '설정, 페이지별로 — Anvil',
    metaDescription: 'Anvil 설정 아래의 모든 페이지: Discord 게시와 스크린샷 개인정보 보호, 게임 내 채팅 피드, 플러그인 연결과 기기, 직접 만든 웹후크, 누가 내 캐릭터를 볼 수 있는지, Supporter와 프로필 모양, 스트리밍 계정, 각 캐릭터, 소유권 주장.',
    eyebrow: 'Anvil · 플레이어용',
    title: '설정, 페이지별로',
    dek: '[Settings](/settings)에는 내 선택이 모여 있습니다: 무엇을 게시할지, 게임에서 무엇을 볼지, 누가 내 캐릭터를 볼 수 있을지. 여기서 한 선택은 내가 플레이하는 모든 컴퓨터를 따라갑니다.',
    facts: [
      {
        strong: '검색 상자',
        rest: '첫 페이지에서 어떤 설정이든 찾습니다',
      },
      {
        strong: '캐릭터마다 한 페이지',
        rest: 'Characters 아래',
      },
      {
        strong: '웹후크 10개',
        rest: '직접 만든 것',
      },
    ],
    footnote: '프로필 페이지는 [내 프로필, Wrapped와 Compare]({profileGuide})에서, 플러그인 자체 설정은 [RuneLite 플러그인 설정]({pluginGuide})에서 설명합니다.',
    find: {
      title: '설정 찾기',
      body: [
        '첫 페이지인 **Overview & search**에는 검색 상자가 있습니다. 원하는 것을 내 말로 입력하세요. 예: _private messages_, _rare drop value_, _death message_, _name colour_ 또는 _plugin token_. 맞는 스위치로 바로 이동합니다.',
        '왼쪽 메뉴는 두 그룹입니다. **Account**에는 아래 페이지들이 있습니다. **Characters**에는 연결한 캐릭터마다 한 페이지가 있고(메인 캐릭터에는 **main** 표시), 그다음 **Add character**가 있습니다. **Add character**의 숫자는 Anvil이 아직 연결하지 않은 캐릭터로 플레이하는 것을 봤다는 뜻입니다.',
      ],
    },
    posts: {
      title: 'Discord 게시와 스크린샷',
      intro: '플러그인이 내 클랜들의 Discord 채널에 나에 대해 무엇을 게시하는지, 그리고 스크린샷에서 무엇을 가리는지. 이 선택은 다음 플러그인 업데이트에서 읽힙니다. 그 전까지는 플러그인 자체 설정의 같은 스위치가 결정합니다.',
      rows: [
        {
          term: '플러그인이 게시하는 것',
          body: '**Rare drops**, **Pets**, **Deaths**, **Collection log slots**, **Level milestones**, **Diary completions**는 켜진 상태로 시작하고, **PvP kills**는 꺼진 상태로 시작합니다.',
        },
        {
          term: '숫자들',
          body: '**Min drop value** (기본 1m, 최소 1m, 0이면 끔), **Min drop rarity (1 in N)** (기본 1/1,000), **가치와 희귀도 함께** (기본은 둘 중 하나, 또는 둘 다 필요), **Loot key value** (1m), 최대 200자의 **Death message** (`{name}`은 내 이름으로 바뀜), 그리고 게시될 가장 낮은 **Combat task tier**와 **Quest tier** (기본 Master). 가치, 희귀도, 둘 중 하나/둘 다 선택은 직접 설정하기 전까지 클랜 기본값을 따르며, **클랜 기본값으로 재설정**을 누르면 다시 그 값을 따릅니다.',
        },
        {
          term: '게시물이 가는 곳',
          body: '**Keep my announcements out of clans I only guest in**, 그리고 클랜 채널의 **Level posts in clan channels**: **Clan rules**, **Only 99s & max** 또는 **Off**. **Per character**에는 캐릭터마다 목록이 있고, **Clans →** 링크로 한 클랜에 대해서만 게시를 끌 수 있습니다.',
        },
        {
          term: '종류별 스크린샷',
          body: '각 종류(**Rare drops**, **Pets**, **Deaths**, **Collection log**, **Combat tasks**, **Achievement diaries**, **Levels**, **Player kills**)마다 게시물에 스크린샷을 넣을지 고를 수 있습니다. 모두 처음에는 켜져 있습니다. 클랜은 멤버를 위한 기본값을 설정할 수 있으며, 직접 바꾸기 전까지는 그 기본값을 따르고, **Reset**을 누르면 다시 기본값으로 돌아갑니다. 빙고 증거는 어떤 선택과 관계없이 항상 캡처됩니다. 그것이 여러분의 증거이기 때문입니다.',
        },
        {
          term: '추가로 알릴 항목',
          body: '**Slayer** (N번째 과제마다), **Clue scrolls** (선택한 티어부터), **Speedruns** (개인 최고 기록만, 또는 매번), **Kill count** (N킬마다), **BA gambles** (N번마다), **Custom chat messages** (내 패턴과 일치하는 게임 메시지, `*`는 임의의 텍스트, `#`는 임의의 숫자; 최대 10개). 모두 처음에는 꺼져 있습니다. 클랜은 멤버를 위한 기본값으로 켤 수 있고, 각 항목을 개인적으로 켜거나 끌 수 있습니다. **Reset to clan default**를 누르면 다시 클랜 설정을 따릅니다. 이 항목들은 클랜의 **Milestones & more** 채널과 이를 받는 내 웹훅으로 게시되며, 내 패턴은 내 웹훅으로만 게시됩니다.',
        },
        {
          term: '비공개: Grand Exchange, 거래, 그룹 보관함, 다른 플러그인',
          body: '**Grand Exchange** (설정한 금액 이상 가치의 완료된 거래), **Player trades** (내가 준 것과 받은 것), **Group storage** (넣거나 뺀 것), **Other plugins** (지정한 RuneLite 플러그인이 Anvil을 통해 게시할 수 있음). 모두 처음에는 꺼져 있고 나만 켤 수 있으며, 클랜은 나를 대신해 켤 수 없습니다. 게시는 내 웹훅으로만 이뤄지므로, 받고 싶은 웹훅에서 해당 항목을 체크하세요.',
        },
        {
          term: '메시지 템플릿',
          body: '모든 게시물의 첫 줄을 바꿉니다: **Loot**, **Pet**, **Collection log**, **Combat tasks**, **Achievement diary**, **Quests**, **Levels**, **Death**, **Player kills**, **Slayer**, **Clue scrolls**, **Speedruns**, **Kill count**, **BA gambles**, 그리고 본인에게만 **Grand Exchange**, **Player trades**, **Group storage**. `{player}` 또는 `{item}` 같은 자리 표시자를 클릭하면 추가되며, 미리보기에는 샘플 값이 채워집니다. 종류마다 고유한 자리 표시자가 있고, 중괄호 안의 다른 내용은 입력한 그대로 유지됩니다. 최대 200자; 멘션과 링크는 절대 게시되지 않습니다. 변경하지 않으면 게시물은 늘 그랬던 것처럼 보입니다. 클랜이 자체 설정을 지정할 수 있고, **Reset to clan default**를 누르면 클랜 기본값으로 돌아갑니다.',
        },
        {
          term: '스크린샷 개인정보 보호',
          body: '모든 스크린샷에서 제외할 채팅을 체크하세요. 플러그인이 찍는 것, 증명 사진, Discord 게시물 모두 해당됩니다: **Private messages**(기본 체크), **Public chat**, **Clan chat: others’ messages**, **Clan chat: your own messages**, **Chat channel**, **Group chat**. 게임 메시지와 Anvil 자체 줄은 항상 포함됩니다.',
        },
      ],
      note: {
        tag: '보드 타일은 절대 영향을 받지 않음',
        body: '게시를 끄면 Discord 게시만 멈춥니다. 드롭, 처치, 업적은 여러분이 플레이하는 보드에서 계속 집계됩니다.',
      },
    },
    chat: {
      title: '게임 내 채팅 피드',
      intro: '플러그인 설정 **Show feed in game chat**이 켜져 있을 때 채팅창에 출력되는 것.',
      rows: [
        {
          term: '출처',
          body: '**Boards I play on**, 그리고 **Clans I’m guesting in, and my clan’s guests**.',
        },
        {
          term: '내용',
          body: '내가 고른 금액 이상의 드롭, **Pets**, **New collection log slots**, **Other teams’ completed tiles**, **My team’s progress on item tiles**, **Leagues, Deadman and other game-mode unlocks**, 그리고 전투 업적, 레벨, 퀘스트, 다이어리.',
        },
        {
          term: '로그인할 때',
          body: '**A short brief in chat**: 자리를 비운 동안 일어난 일. 챔피언은 무엇을 포함할지 고를 수 있습니다.',
        },
        {
          term: '색상',
          body: '**Anvil lines in chat**: **By type (Anvil colours)**, **One colour (the plugin’s own)** 또는 Supporter를 위한 **My own colours**.',
        },
      ],
    },
    login: {
      title: '플러그인 연결, 로그인과 기기',
      intro: '플러그인과 웹사이트가 어디에 로그인되어 있는지, 그리고 어떻게 로그아웃하는지.',
      rows: [
        {
          term: '플러그인 연결',
          body: '플러그인 토큰. 직접 붙여 넣어야 하는 드문 경우를 위한 것입니다. 보통은 사이드 패널의 **Sign in with Discord**가 이를 대신합니다.',
        },
        {
          term: '로그인과 기기',
          body: '플러그인이 로그인된 모든 컴퓨터가 만들어진 시각과 마지막 사용 시각과 함께 **RuneLite sign-in 1**, **2**… 순서로 나열됩니다. **Revoke**는 한 대를 로그아웃합니다. 예: 판매한 컴퓨터. **Enter a code**는 다른 컴퓨터를 연결합니다. **Sessions**는 모든 곳에서 웹사이트 로그아웃을 합니다.',
        },
        {
          term: '클랜 결제',
          body: '클랜 소유자는 여기서 클랜 결제를 위해 **Open portal →**을 누를 수 있습니다.',
        },
      ],
    },
    webhooks: {
      title: '내 Discord 웹후크',
      body: [
        '게시물을 내가 만든 Discord 서버로도 보낼 수 있습니다. 비공개 채널, 친구들의 서버, webhook을 만들 수 있는 어디든 가능합니다. webhook 링크를 붙여 넣고, 받을 항목을 체크한 뒤(**Rare drops**, **Pets**, **Deaths**, **Combat achievements**, **Levels & milestones**, **Quests**, **Achievement diaries**, **Collection log**, **PvP kills**), 원하면 이 webhook만의 최소 드롭 가치와 희귀도를 설정하고 **Add webhook**을 누르세요. **Rare drops**를 받는 webhook에서는 나중에 그 설정을 바꿔 **Value or rarity: my setting**, **either**, **both** 중에서 고를 수 있습니다. 비워 둔 항목은 내 설정을 따르며, webhook은 클랜의 엄격한 하한보다 느슨할 수 있습니다.',
        '최대 10개까지 가능합니다. Discord webhook 링크만 허용되며, 저장된 링크는 가려서 표시되므로 이 페이지의 스크린샷으로 유출되지 않습니다. **Level posts on my webhooks**는 클랜과 별도로 이 webhook들에 대한 내 레벨 규칙을 설정합니다.',
      ],
    },
    privacy: {
      title: '누가 내 캐릭터를 보나',
      intro: '내 캐릭터는 처음에 공유됩니다. 세 가지 스위치로 바꿀 수 있습니다:',
      rows: [
        {
          term: 'Show <name> publicly',
          body: '캐릭터마다 스위치 하나. 켜면(시작 시 기본) 페이지가 **Public**이 됩니다. 끄면 **Only its clans**가 되어, 그 클랜들은 여전히 명단과 이벤트에서 보지만 다른 누구도 보지 못하고 리더보드에서도 빠집니다.',
        },
        {
          term: 'Show that my characters are one person',
          body: '캐릭터가 둘 이상일 때, 공유된 캐릭터들을 함께 나열하는 개인 페이지를 만듭니다. 끄면 그것들이 모두 나라는 사실을 아무도 알 수 없습니다.',
        },
        {
          term: 'Show other clans’ boards',
          body: '홈 페이지에 다른 클랜의 공개 보드를 보여 줄지 여부.',
        },
      ],
    },
    look: {
      title: 'Supporter, 프로필 모양, 스트리밍과 부스트',
      intro: 'Anvil에서 내가 어떻게 보이는지, 그리고 그 뒤의 계정과 혜택.',
      rows: [
        {
          term: 'Supporter와 이름 색상',
          body: '내 등급, 혜택, 초대 링크: 친구를 데려오면 무료 개월 수를 얻습니다. 등급은 [Anvil Supporter]({supporterGuide})에서 설명합니다.',
        },
        {
          term: '프로필 모양',
          body: '아바타와 배너(Champion부터 애니메이션), 원하면 캐릭터마다 다르게 설정할 수 있고, **Display case**: 등급에 따라 4, 8 또는 12개의 핀.',
        },
        {
          term: '스트리밍 계정',
          body: '**Twitch**, **YouTube**, **Kick**, **Medal**. 각각 인증 여부가 표시되며, 프로필에 보여 줄지 전환하는 스위치가 있습니다. 인증된 계정이 있어야 팔로워 및 구독자 이벤트에 들어갈 수 있습니다.',
        },
        {
          term: '클랜 부스트',
          body: '부스트할 수 있을 때만 보입니다: 내 슬롯, 배치 위치, 부스트할 수 있는 클랜. [클랜 부스트하기]({boostsGuide})를 보세요.',
        },
      ],
    },
    characters: {
      title: '캐릭터별 설정',
      intro: '**Characters** 아래에서 모든 캐릭터는 자기 페이지를 갖습니다. 유형, 인증 여부, 공개 페이지와 전체 프로필 링크가 있습니다.',
      rows: [
        {
          term: '공개 범위',
          body: '**Show to other clans and on leaderboards**와 **Show my in-game clan**.',
        },
        {
          term: '클랜',
          body: '그 캐릭터가 속한 각 클랜과 스페이스가 **member** 또는 **guest**로 표시되며, 클랜별 **Announce drops & achievements**와 **Leave**가 있습니다. Anvil이 엉뚱한 클랜에 넣어 두었다면, **Which clan is it really in?**으로 운영진에게 알릴 수 있습니다.',
        },
        {
          term: '캐릭터',
          body: '**Make main**, 이름 변경 후 이름 바꾸기 요청, 또는 내 계정에서 **Remove**. 지난 결과는 그대로 남습니다.',
        },
        {
          term: '캐릭터 추가',
          body: '플러그인이 로그인된 상태로 캐릭터를 한 번 플레이하면 스스로 연결됩니다. 모바일이나 공식 클라이언트에서는 이름으로 연결하세요. **We noticed you playing**은 Anvil이 본 캐릭터를 나열하고, **Not mine**은 하나를 치워 줍니다.',
        },
      ],
    },
    claims: {
      title: '소유권 주장',
      body: [
        '캐릭터가 다른 사람의 Anvil 계정에 연결되어 있지만 실제로는 내 것이라면, 플러그인 사이드 패널의 **You** 탭에서 **This is my account**를 누르세요. 빠른 XP 확인으로 내가 플레이한다는 것을 증명하면, 현재 보유자에게 묻습니다. 나는 그 사람이 누구인지 알 수 없고, 그 사람도 내가 누구인지 알 수 없습니다.',
        '내 주장은 **XP check**, **open**을 표시한 다음 어떻게 끝났는지 보여 줍니다: **moved to you**, **with Anvil staff**, **withdrawn**, **check timed out** 또는 **closed**. **Withdraw**는 하나를 취소합니다.',
        '누군가 내 캐릭터 중 하나를 주장하면 **Claims on your characters** 아래에 **Approve** 또는 **Object — it’s mine**과 함께 표시됩니다. 인증되지 않은 캐릭터는 이의를 제기하지 않으면 7일 후에 옮겨집니다. 인증된 캐릭터는 내가 승인할 때만 옮겨집니다.',
      ],
    },
  },
  weekly: {
    metaTitle: '주간 스킬과 보스 — Anvil',
    metaDescription: 'Anvil에서 주간 스킬, 주간 보스 또는 효율 경쟁 실행하기: 예약, 반복과 순환, 시작 신호, 사람 추가와 제거, 상품, 조기 종료, 그리고 플레이어가 보는 화면.',
    eyebrow: 'Anvil · 클랜 운영진과 플레이어용',
    title: '주간 스킬과 보스',
    dek: '주간 대회는 노력이 적게 드는 이벤트입니다. 작성할 타일도, 팀도, 참가 신청도 없습니다. 명단에 있는 모두가 시작할 때 자동으로 참가하며, 끝나기 전에 가장 많이 얻은 사람이 우승합니다.',
    facts: [
      {
        strong: '타일도 팀도 없음',
        rest: '리더보드 하나',
      },
      {
        strong: '시작 시 자동 참가',
        rest: '명단 전체, 자동으로',
      },
      {
        strong: '상품 최대 10위',
        rest: '클랜 금고에서 지급',
      },
    ],
    footnote: '보드(빙고)는 [첫 이벤트 운영하기]({adminGuide})에, 상품과 금고는 [클랜 금고]({cofferGuide})에 있습니다.',
    schedule: {
      title: '하나 예약하기',
      intro: '선택 사항은 다섯 가지이며, 대부분의 클랜에는 기본값으로 충분합니다:',
      steps: [
        '관리자 메뉴에서 **Schedule**을 열고 **+ Schedule event**를 누르세요 (중재자는 **Schedule a competition**을 쓸 수 있습니다).',
        '종류를 고르세요: **Skill of the Week** (얻은 XP), **Boss of the Week** (얻은 처치 수) 또는 **Efficiency race** (얻은 플레이 시간 또는 보스 시간).',
        '**What is measured**에서 스킬이나 보스를 고르세요. 매주 바꾸고 싶다면 **Then rotate through**에 더 추가하세요. 비워 두면 같은 것을 반복합니다.',
        '**Runs**에서 언제 진행할지 고르세요: **This weekend**, **One week** 또는 직접 정한 날짜. 시작과 끝 사이의 증가를 점수로 매기므로 끝나는 시점이 항상 필요합니다.',
        '**Repeat every week**를 켜 두면 이것이 끝나는 순간 같은 길이와 상품으로 다음 대회가 시작됩니다. 클랜 게스트도 순위에 올라야 한다면 **Guests race too**를 체크하세요.',
      ],
      outro: '이 밖에 설정할 것은 없습니다. 시작 수치는 시작할 때 순위표에서 가져옵니다.',
    },
    counting: {
      title: '집계 방식',
      body: [
        '각 플레이어의 증가량은 지금 스탯에서 대회가 시작되었을 때의 스탯(그들의 **starting line**)을 뺀 값입니다. 가장 많이 얻은 사람이 이기며, 동점은 이름으로 나열되고 상품은 동점 순위 사이에서 나눌 수 있습니다.',
        '시작선은 순위표에서 가져옵니다. 그 뒤에는 플러그인의 실시간 업데이트가 순위표 확인 사이에도 보드를 최신으로 유지하므로, 플러그인을 쓰는 플레이어는 플레이하면서 보드에서 올라갑니다.',
        '줄어드는 수치는 무시되고, 불가능해 보이는 증가는 집계하거나 깎는 대신 운영진에게 **flagged** 표시됩니다.',
      ],
      note: {
        tag: '플레이어: 시작 전에 로그아웃하세요',
        body: '순위표는 로그아웃할 때만 스탯을 저장합니다. 로그아웃하지 않고 시작 직전까지 사냥하면, 시작선은 그 사냥 전에 잡혀 있어서 사냥한 만큼이 증가로 집계됩니다. 운영진이 보통 잡아서 시작선을 고쳐 주지만, 시작 전에 한 번 로그아웃해 두세요.',
      },
    },
    manage: {
      title: '운영하기',
      intro: '**Schedule** 또는 대시보드에서 대회를 여세요. 홈 페이지와 세 개의 탭이 있습니다:',
      rows: [
        {
          term: '홈',
          body: '**Leaderboard**(상위 25명, 몇 명이 점수를 얻는지 포함), **flagged** 증가, **left the clan** 상태인 사람, 그리고 상품. 끝나면 우승자와 **Final leaderboard**.',
        },
        {
          term: '시작선',
          body: '모든 플레이어의 **Started at**, **Now**, **Gained**. 대회 전 사냥이 집계되었을 때 시작선을 직접 고치면 순위표가 따라갑니다. **Pull current stats**는 모두를 새로 고치고, **Reset baselines**는 지금 순위표 기준으로 모두를 다시 시작시켜 모든 증가를 지웁니다.',
        },
        {
          term: '참가자',
          body: '명단 전체가 이미 들어가 있습니다. **Add someone**은 줄마다 이름 하나를 받아, 아직 명단에 없는 게스트나 계정을 추가합니다. 플레이어를 제거하면 그 순위도 제거되며, 다시 추가하면 새 시작선을 받습니다. **Leave one each**는 여러 캐릭터로 여러 번 들어간 사람을 정리합니다. 모든 게스트를 한꺼번에 뺄 수도 있습니다.',
        },
        {
          term: '설정',
          body: '이름, 날짜, **Repeat every week**, 그리고 **Status**(멈춘 것을 풀 때만 사용하며, 스스로 진행됩니다). 관리자는 참가자와 순위와 함께 **Delete**할 수 있습니다.',
        },
      ],
    },
    prizes: {
      title: '상품과 종료',
      body: [
        '최대 10개 순위까지 상품을 설정하며, 클랜 금고에서 지급됩니다. 증가가 없는 플레이어에게도 줄지, 동점 순위가 상품을 나눌지 여부를 고릅니다. 돈이 어떻게 움직이는지는 [클랜 금고]({cofferGuide})에 있습니다.',
        '설정한 시간에 스스로 끝납니다. **End now**는 일찍 멈춥니다. 그 즉시 증가는 집계되지 않고, 결과는 Discord에 게시되며 상품은 15분 안에 정산됩니다.',
      ],
    },
    players: {
      title: '플레이어를 위한 안내',
      body: [
        '따로 신청할 필요가 없습니다. 시작할 때 클랜 명단에 있다면 들어가 있습니다. 클랜의 **Events** 페이지, 플러그인 사이드 패널의 **Clan** 탭(현재 순위 포함), 그리고 시작과 끝을 알리는 Discord에서 찾을 수 있습니다.',
        '각 대회에는 실시간 순위표와 날마다 경쟁이 어떻게 흘러갔는지 보여 주는 자체 페이지가 있습니다. 비공개 클랜은 그것을 자기 멤버에게만 보여 줍니다.',
        '플러그인으로 플레이하면 내 수치가 실시간으로 유지됩니다. 플러그인이 없어도 집계되며, 순위표의 속도로만 반영됩니다.',
      ],
    },
    teamsLine: "스킬이나 보스로 팀전 또는 클랜끼리의 대결을 원하시나요? 예약할 때 **Format**을 설정하세요. [팀 대항전]({teamCompsGuide})을 참고하세요.",
  },
  teamComps: {
    "metaTitle": "팀 대항전 — Anvil",
    "metaDescription": "Anvil에서 스킬 또는 이주의 보스를 팀 또는 클랜 대 클랜으로 운영하는 방법입니다. 플레이어를 팀으로 나누기, 다른 클랜 초대, 합계와 평균 점수 계산, 늦게 합류한 플레이어, 플레이어에게 보이는 내용을 설명합니다.",
    "eyebrow": "Anvil · 클랜 스태프와 플레이어를 위한 안내",
    "title": "팀 대항전",
    "dek": "모든 스킬 및 보스 대항전에는 Format이 있습니다. Solo가 기본값이며 예전과 똑같이 동작합니다. Teams를 고르면 클랜을 여러 편으로 나눌 수 있고, Clan vs clan을 고르면 같은 스킬이나 보스로 다른 클랜과 겨룰 수 있습니다.",
    "facts": [
      {
        "strong": "세 가지 형식",
        "rest": "Solo, Teams, Clan vs clan"
      },
      {
        "strong": "합계로 승부가 갈림",
        "rest": "플레이어 1인당 평균도 함께 표시"
      },
      {
        "strong": "호스트만 수정",
        "rest": "파트너 클랜은 지켜봄"
      }
    ],
    "footnote": "스킬과 이주의 보스의 기본 내용은 [Skill and Boss of the Week]({weeklyGuide})에 있습니다. 클랜들이 대신 빙고 보드에서 겨루길 원하신다면 [방문 클랜 호스팅]({clanVsClanGuide})을 참고하세요.",
    "teams": {
      "title": "팀 설정하기",
      "intro": "팀은 우리 클랜을 여러 편으로 나눕니다. 약 1분이면 설정할 수 있습니다:",
      "steps": [
        "평소처럼 대항전을 예약합니다. **Format**을 **Teams**로 설정합니다.",
        "팀 이름을 입력합니다. 등록된 모든 사람은 현재 레벨이나 킬 수를 기준으로 균등하게 나뉘어 처음부터 공정하게 시작합니다.",
        "시작 후에 들어오는 사람이 있을 수 있다면 **Late joiners go into the smallest team**을 켜 둡니다. 팀을 고정하려면 끕니다.",
        "나중에 바꾸려면 대항전을 열고 관리 사이드바에서 **Teams**를 선택합니다. 거기서 다음을 할 수 있습니다:"
      ],
      "rows": [
        {
          "term": "이름 변경과 색상 변경",
          "body": "각 팀에 이름과 플레이어가 알아볼 수 있는 색상을 정합니다."
        },
        {
          "term": "팀 추가와 삭제",
          "body": "두 팀으로 시작해서 세 번째 팀을 추가하거나, 더 이상 필요 없는 팀을 삭제합니다."
        },
        {
          "term": "플레이어 이동",
          "body": "다른 팀으로 보냅니다. 함께 하고 싶은 친구가 있을 때 편리합니다."
        },
        {
          "term": "자동 균형 맞추기",
          "body": "**Auto-balance by current level/KC**를 누르면 모든 사람을 다시 균등하게 나눕니다."
        },
        {
          "term": "늦게 합류한 플레이어",
          "body": "늦게 합류하는 옵션을 켜거나 끕니다. 켜져 있으면 새 플레이어는 가장 인원이 적은 팀에 들어갑니다."
        }
      ],
      "note": {
        "tag": "팀이 없어도 괜찮아요",
        "body": "팀이 없는 플레이어도 개인 보드에는 계속 집계됩니다. 다만 어떤 팀의 합계에도 더해지지는 않습니다."
      },
      "outro": "반복되는 대항전은 팀을 다음 주로 그대로 넘기고, 다시 균형을 맞춥니다."
    },
    "clans": {
      "title": "클랜 대 클랜 설정하기",
      "intro": "클랜 대 클랜은 원하는 만큼 다른 클랜이 대회에 참여하게 해 줍니다. 여러분이 호스트이고, 다른 클랜은 파트너입니다.",
      "steps": [
        "호스트 클랜의 admin 이상 권한으로 **Format**을 **Clan vs clan**으로 설정합니다.",
        "다른 클랜을 주소로 초대합니다. 생성 양식에서 하거나, 나중에 대회의 **Clans** 페이지에서 할 수 있습니다.",
        "초대받은 클랜의 owner 또는 admin이 **People** 페이지나 **Events** 목록에서 수락 또는 거절합니다. moderator는 할 수 없습니다. 수락하기 전까지는 그 클랜의 누구도 등록되지 않습니다.",
        "수락하면 누가 경기에 나갈지 정합니다. 로스터의 **All members**, 또는 직접 고른 **Selected people** 중에서 고를 수 있습니다. 같은 카드에서 나중에 바꿀 수 있습니다.",
      ],
      "body": [
        "파트너 클랜은 자신의 사이트에서 `/c/<slug>/weekly/<id>`로 순위를 볼 수 있습니다. 읽기 전용입니다. 대회를 수정할 수 있는 사람은 호스트뿐입니다.",
        "클랜을 빼려면 **Clans** 페이지에서 제거합니다. 그 클랜의 플레이어들은 보드에서 빠집니다.",
        "반복되는 대회는 매주 새 초대를 보내므로, 각 클랜은 매번 다시 수락해야 합니다.",
        "원치 않는 초대를 받고 계신가요? 초대에서 **Decline & block this clan**을 선택하세요. 그 클랜의 이후 초대는 조용히 거절되며, **Settings → Blocked clans**에서 차단을 해제할 수 있습니다.",
      ],
      "note": {
        "tag": "주소 공유하기",
        "body": "클랜 주소는 웹 주소에 들어 있는 짧은 이름입니다. 초대하기 전에 상대 클랜의 admin에게 물어보세요."
      }
    },
    "scoring": {
      "title": "점수 계산 방식",
      "body": [
        "팀이나 클랜의 합계는 구성원들이 얻은 양을 모두 더한 값입니다. 얻은 양은 개인 보드와 같은 방식으로 셉니다.",
        "각 합계 옆에는 **플레이어 1인당 평균**도 함께 나오므로, 8명인 팀과 12명인 팀도 비교할 수 있습니다.",
        "합계가 같으면 그 점수에 먼저 도달한 쪽이 더 높은 순위를 차지합니다."
      ]
    },
    "players": {
      "title": "플레이어에게 보이는 내용",
      "body": [
        "대회 페이지에는 팀이나 클랜 순위가 먼저 나옵니다. 아무 항목이나 열면 그 플레이어들을 볼 수 있습니다. 내 팀이나 클랜은 강조 표시됩니다.",
        "시작, 중간, 종료 시점의 Discord 게시물에 순위가 나옵니다. 클랜 대 클랜에서는 모든 클랜의 채널로 게시되며, 우리 클랜에는 **← you** 표시가 붙습니다.",
        "플러그인 사이드 패널에서 내 팀의 순위를 확인할 수 있습니다.",
        "따로 신청할 것은 없습니다. 클랜이 모든 멤버를 등록했고 내가 로스터에 있으면 참여하게 됩니다. 클랜이 사람을 골라 등록한 경우에는 선택된 뒤부터 참여하게 됩니다.",
        "참여하고 싶지 않다면 대회 페이지, Events 목록 또는 플러그인에서 **You’re in** 옆의 **Opt out**을 누르세요. 그 대회에서만 보드에서 빠지며, 대회가 진행 중이라도 다시 참여할 수 있습니다.",
      ]
    },
    "faq": {
      "title": "자주 묻는 질문",
      "intro": "클랜 스태프와 플레이어가 가장 많이 묻는 질문:",
      "rows": [
        { term: "팀 크기가 서로 다릅니다. 불공평한가요?", body: "그것만으로는 아닙니다. 순위는 합계로 정하지만, 각 팀에는 플레이어 1인당 평균도 표시되므로 작은 팀이 실제로 어떻게 하고 있는지 볼 수 있습니다." },
        { term: "중간에 들어오는 사람은 어떻게 되나요?", body: "늦게 합류한 사람 스위치를 켜 두면 가장 인원이 적은 팀에 들어갑니다. 끄면 개인 보드에만 포함됩니다. **Teams** 페이지에서 언제든 직접 옮길 수 있습니다." },
        { term: "다른 클랜이 우리 대회를 수정할 수 있나요?", body: "아니요. 파트너 클랜은 순위를 읽기 전용으로 볼 수만 있습니다. 대회를 바꿀 수 있는 것은 호스트 클랜뿐입니다." },
        { term: "대회 한 번만 쉴 수 있나요?", body: "네. 대회 페이지, Events 목록 또는 플러그인에서 **Opt out**을 누르세요. 그 대회에만 영향을 주며, 진행 중이어도 다시 참여할 수 있습니다." },
        { term: "몇 개의 클랜이 경기할 수 있나요?", body: "초대한 만큼 가능하며, 한 대회에 최대 50개 클랜입니다. 각 클랜은 순위와 Discord 게시물에서 자기 쪽이 표시된 것을 봅니다." },
        { term: "다른 클랜이 계속 초대합니다. 막을 수 있나요?", body: "네. owner 또는 admin이 초대에서 **Decline & block this clan**을 선택하세요. 이후 초대는 상대에게 알리지 않고 거절됩니다. 언제든 **Settings → Blocked clans**에서 차단을 해제할 수 있습니다." },
        { term: "한 번 동의하면 매주 자동으로 참여하게 되나요?", body: "아니요. 반복되는 대회는 매주 새 초대를 보내며, owner 또는 admin이 매번 수락해야 합니다." },
      ]
    }
  },

  clanEvents: {
    metaTitle: '클랜 이벤트와 일정 — Anvil',
    metaDescription: 'Anvil에서 클랜 이벤트 예약하기: 대규모 모임, 여행과 모임, 주간 반복, 자리와 질문과 참가비가 있는 “갑니다”와 참가 신청, Discord 게시와 알림, 지급, 설문, 그리고 빈 시간을 보여 주는 일정.',
    eyebrow: 'Anvil · 클랜 운영진용',
    title: '클랜 이벤트와 일정',
    dek: '모든 것이 보드인 건 아닙니다. 클랜 이벤트는 대규모 모임, 레이드 나이트, 드롭 파티, 모임입니다: 시간과 장소가 있고, Discord에 게시되며 알림이 가고, 참가 신청은 원하는 만큼 많거나 적게 받을 수 있습니다.',
    facts: [
      {
        strong: '한 번 또는 매주',
        rest: '선택 종료일 포함',
      },
      {
        strong: '참여 방식 세 가지',
        rest: '정보, “갑니다”, 또는 참가 신청',
      },
      {
        strong: '알림',
        rest: '15분 전, 그다음 시작 시',
      },
    ],
    footnote:
      '주간 대회는 [Skill and Boss of the Week]({weeklyGuide})에, 참가비와 상금은 [Fees and payouts]({feesGuide})에 있습니다. 알림 게시물은 클랜의 메시지 템플릿을 사용하며, 이는 [Settings, page by page]({settingsGuide})에서 설명합니다.',
    create: {
      title: '하나 예약하기',
      intro: '관리자 메뉴에서 **Clan events**를 열고 양식을 채우세요:',
      rows: [
        {
          term: '이름, 시간, 길이',
          body: '**Name**, 내 시간대로 **Starts (your time)**, 그리고 **Minutes**.',
        },
        {
          term: '반복',
          body: '**Just once** 또는 **Every week**, 선택 사항 **Until** 날짜.',
        },
        {
          term: '장소',
          body: '**Where**, **World**, **Host**, 그리고 사진: 보스나 스킬을 고르거나 직접 업로드하세요.',
        },
        {
          term: '세부 사항',
          body: '장비, 요구 사항, 준비물.',
        },
        {
          term: '누가 오나',
          body: '**Just information**(버튼도 인원 수도 없음), **“I’m going”**(한 번 누르기, 인원 수 표시) 또는 **Sign-ups**(자리, 질문, 참가비).',
        },
        {
          term: 'Discord',
          body: '채널(또는 클랜 기본값)에 **Post to**, 선택적으로 연결할 **Chat**, **Guide**, **Voice** 채널, 그리고 공지, 알림, 시작 때 멤버 역할을 멘션할지 여부.',
        },
      ],
      outro: '**Schedule it**을 누르세요. 지급과 설문은 그 뒤 이벤트 자체 페이지에서 추가합니다.',
    },
    discord: {
      title: 'Discord가 보는 것',
      body: [
        '예약할 때 공지가 올라가고, 무엇을 바꾸든 그 게시물이 제자리에서 수정되므로 오래된 사본은 없습니다. 반복되는 이벤트에는 **every week** 표시가 붙습니다.',
        '15분 전에는 **Starting in 15 minutes**가, 시작 시점에는 **Starting now**가 게시됩니다. 시간을 옮기면 알림도 함께 옮겨집니다. 취소(**Cancel**)하면 게시물에 **Cancelled**가 표시되어 아무도 오지 않습니다.',
      ],
    },
    manage: {
      title: '참가 신청, 참가비와 지급',
      intro: '이벤트를 열어 무엇을 쓸지 바꾸세요. 모든 것이 처음에는 꺼져 있습니다:',
      rows: [
        {
          term: '참가 신청',
          body: '**Places**(제한 없으면 비움), **Sign-ups close** 시각, 그리고 **Sign-up questions**와 함께. **You approve each one**을 켜면 모든 참가 신청이 운영진의 승인을 기다립니다.',
        },
        {
          term: '“I’m going” 버튼',
          body: '끄면 정보만 표시됩니다: 사이트, 플러그인, Discord 어디에도 버튼이나 인원 수가 없습니다.',
        },
        {
          term: '참가비',
          body: '참가 신청을 켭니다. **Added to the pot** 아래에 내가 보탤 gp를 추가하세요.',
        },
        {
          term: '지급',
          body: '팟은 참가비와 내가 보탠 금액의 합입니다. **Who**가 받을 사람과 **For** 무엇인지 적고, 각각 **Paid**로 표시하세요. 팟보다 많이 지급하면 Anvil이 경고합니다.',
        },
        {
          term: '이후 설문',
          body: '끝나면 열립니다. 답변은 운영진만 봅니다. 참가 신청을 받았다면 신청한 사람에게만 묻습니다.',
        },
        {
          term: '주간 이벤트',
          body: '**Every week is…** 아래 **Its own**(매주 참가 신청, 팟, 설문 각각) 또는 **One run**(시리즈 전체에 참가 신청, 팟, 설문 한 번).',
        },
      ],
    },
    players: {
      title: '멤버가 보는 것',
      body: [
        '이벤트 페이지에는 **When**, **Where**, **Host**, **Discord**, **Entry**, **Prizes**가 표시되며, 진행 중에는 **Live now**가 붙습니다. 멤버는 **I’m going** 또는 **Sign me up**을 누르고, 운영진이 하나씩 승인하는 경우에는 **Ask to sign up**을 누릅니다. 플러그인 사이드 패널의 **Clan** 탭에도 같은 버튼과 함께 있습니다.',
        '클랜 멤버만 “갑니다”라고 하거나 참가 신청을 할 수 있습니다.',
      ],
    },
    calendar: {
      title: '일정',
      body: [
        '**Schedule**은 보드, 주간 대회, 클랜 이벤트를 하나의 달력에 모으며, 각각에 필터가 있습니다.',
        '이틀 이상 아무것도 없는 구간은 빈 시간으로 표시되며, 그곳에 무언가를 예약하기 위한 **Fill the gap**이 있습니다. 큰 이벤트 사이에 클랜을 활발하게 유지하고, 한산한 2주가 그냥 지나가지 않게 하는 데 쓰세요.',
      ],
    },
  },
  challenges: {
    metaTitle: '도전과 친구 이벤트 — Anvil',
    metaDescription: 'Anvil의 1:1 도전(1시간, 24시간 또는 7일 안에 드롭 먼저, 처치 수 가장 많이, 또는 XP 가장 많이)과 Supporter 친구 이벤트: 초대 링크 하나로 친구들을 위한 비공개 보드.',
    eyebrow: 'Anvil · 플레이어용',
    title: '도전과 친구 이벤트',
    dek: '클랜 이벤트 없이 아는 사람들과 겨루는 두 가지 방법: **도전**은 한 명 대 한 명이고, **친구 이벤트**는 초대 링크 뒤에 있는 그룹을 위한 비공개 보드입니다.',
    facts: [
      {
        strong: '1시간에서 7일',
        rest: '도전마다',
      },
      {
        strong: '자랑거리',
        rest: '걸린 것 없이, gp 없음',
      },
      {
        strong: '친구 최대 50명',
        rest: '친구 이벤트마다, 등급별',
      },
    ],
    footnote: '등급과 각 등급이 호스트할 수 있는 것은 [Anvil Supporter: 등급과 혜택]({supporterGuide})에 있습니다.',
    start: {
      title: '누군가에게 도전하기',
      intro: '인증된 캐릭터가 필요하며, 상대도 마찬가지입니다.',
      steps: [
        '[Challenges](/challenges)를 열거나, 플레이어의 프로필에서 **Challenge <name>**을 누르세요.',
        '**Who**에서 상대 이름을 입력하고, **Playing as**에서 내 캐릭터를 고르세요. 인증된 캐릭터여야 합니다.',
        '경쟁 방식을 고르세요: **First to a drop**(최대 5개 아이템, 모두 몬스터 드롭), 보스의 **Most kills**, 또는 한 스킬이나 전체의 **Most XP**.',
        '제한 시간을 고르세요: **1 hour**, **24 hours** 또는 **7 days**. 결과가 공개되어도 괜찮다면 **OK to show the result publicly**를 체크하세요. 둘 다 체크해야만 공개됩니다.',
      ],
      outro: '상대는 알림과 Discord 메시지를 받고, 24시간 안에 **Accept**, **Decline** 또는 **Decline and block**을 할 수 있습니다. 시계는 수락할 때 시작됩니다.',
    },
    rules: {
      title: '승부는 어떻게 정해지나',
      intro: 'Anvil이 끝나고 1분 안에 스스로 판정합니다.',
      rows: [
        {
          term: '처치 수와 XP',
          body: '두 시작선은 수락될 때 잡힙니다. 끝날 때 더 많이 얻은 쪽이 이기며, 같으면 무승부입니다. 순위표와 플러그인 중 높은 쪽으로 집계됩니다.',
        },
        {
          term: '먼저 드롭',
          body: '아이템 중 하나를 먼저 얻은 쪽이 그 자리에서 이깁니다. 드롭은 플러그인만 보므로 두 사람 모두 플러그인이 실행 중이어야 합니다. 제한 시간 안에 아무도 얻지 못하면 무승부입니다.',
        },
        {
          term: '취소',
          body: '응답하기 전까지 내 도전을 철회할 수 있습니다. 진행 중이면 둘 다 동의할 때만 멈춥니다.',
        },
      ],
    },
    limits: {
      title: '제한과 거절',
      body: [
        '열린 도전(대기 중이거나 진행 중, 보낸 것과 받은 것)은 등급에 따라 제한됩니다: 무료는 **1**개, Supporter는 **5**개, Champion과 Patron은 무제한. 누구나 하루에 20개까지 시작할 수 있으며, 같은 상대와는 한 번에 하나만 가능합니다.',
        '원하지 않는다면 **Turn away all new challenges**를 쓰거나, 거절할 때 한 사람을 차단하세요. 도전을 보낸 쪽은 두 경우 모두 같은 거절을 보므로, 차단되었는지 알 수 없습니다.',
        '페이지에는 **Your record**(승, 패, 무승부), 지금 **Open now**인 것, 그리고 **Your limit**이 표시됩니다.',
      ],
    },
    friends: {
      title: '친구 이벤트 호스트하기',
      body: [
        '모든 Supporter, Champion, Patron은 [Host](/host) → **Host for friends** → **New friends event**에서 친구들을 위한 비공개 보드를 열 수 있습니다. 빙고나 타일 경쟁인 완전한 보드이며, 플러그인이 추적하고 크리에이터 이벤트와 같은 설정을 씁니다.',
        '**Invite link**를 보내세요. 그것이 유일한 입장 방법입니다. 친구들은 링크를 열고, Discord로 로그인한 뒤 **Open the event**를 누릅니다. 참가는 언제나 무료입니다. 링크가 새어 나가면 새 링크를 만드세요. 옛 링크는 작동을 멈추고, 이미 들어와 있는 사람은 그대로 남습니다.',
        '친구 이벤트는 Anvil 어디에도 목록으로 나오지 않으며 클랜도 필요하지 않습니다.',
      ],
      table: {
        areaLabel: '등급',
        columns: [
          '플레이어',
          '동시 진행',
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
        tag: '등급이 끝나면',
        body: '이미 들어온 친구는 그대로 남습니다. 새 친구는 새 한도를 넘으면 들어올 수 없으며, 한도 아래로 돌아오기 전까지 새 이벤트를 시작할 수 없습니다.',
      },
    },
  },
  clanHall: {
    metaTitle: '클랜, 이벤트, 리더보드 찾기 — Anvil',
    metaDescription: 'Anvil의 Clan Hall에서 OSRS 클랜 찾기, 두 클랜 비교, 주간 플레이어 및 클랜 리더보드, 공개 이벤트 목록, 그리고 Anvil에 없는 클랜의 게임 내 클랜 페이지.',
    eyebrow: 'Anvil · 플레이어와 클랜용',
    title: '클랜, 이벤트, 리더보드 찾기',
    dek: '둘러보기 위한 Anvil의 공개 페이지: 클랜을 찾는 **Clan Hall**, 참여할 것을 찾는 **Events** 목록, 그리고 누가 가장 많이 얻고 있는지 보는 **Leaderboard**.',
    facts: [
      {
        strong: 'Clan Hall',
        rest: '공개 클랜만',
      },
      {
        strong: 'Leaderboard',
        rest: '이번 주, 30일, 전체',
      },
      {
        strong: 'Events',
        rest: '호스트가 홍보한 것만',
      },
    ],
    footnote: '내 클랜을 목록에 올리려면 [클랜 시작하기]({clanGuide})를, 부스트된 클랜은 추천되며 [클랜 부스트하기]({boostsGuide})를 보세요.',
    hall: {
      title: 'Clan Hall',
      body: [
        '[Clan Hall](/clans)은 모든 공개 클랜을 나열합니다. 이름이나 한 줄 소개로 검색한 뒤 **Taking members** 또는 **Open to challenges**로 좁힐 수 있습니다. **Most active**(기본 정렬)는 이번 주 멤버가 가장 많이 얻은 클랜을 먼저 보여 주고, **Biggest**는 멤버 수로 정렬합니다.',
        '각 카드에는 클랜이 **Recruiting** 중인지, 게스트를 어떻게 받는지가 나옵니다: **Guests welcome**, **Guests by approval** 또는 **No guests**. 부스트된 클랜은 맨 위에 추천 줄로 나오며, 크리에이터도 자기 줄이 있습니다.',
      ],
      note: {
        tag: '목록에 없나요?',
        body: '공개로 설정된 클랜만 나타나며, 클랜은 설정에서 목록 노출을 끌 수 있습니다. 비공개 클랜은 Clan Hall, 리더보드, 비교에 절대 나오지 않습니다.',
      },
    },
    compare: {
      title: '두 클랜 비교',
      body: [
        '[Compare clans](/compare/clans)는 목록에 있는 두 클랜을 나란히 보여 줍니다. 캐릭터 두 개를 비교하려면 [Compare](/compare)를 쓰세요.',
      ],
    },
    board: {
      title: '리더보드',
      body: [
        '[Leaderboard](/leaderboard)는 **This week**, **30 days** 또는 **All time** 기간에 경험치, 효율 시간, 보스 활동으로 플레이어와 클랜의 순위를 매깁니다. 플레이어는 **Regular**, **Ironman**, **Hardcore**, **Ultimate** 또는 **Group** 계정으로 좁힐 수 있습니다.',
        '클랜은 멤버가 얻은 XP로 순위가 매겨집니다. Clan Hall에 나열된 인증된 클랜만 나옵니다. 게스트의 증가는 그가 게스트로 있는 클랜이 아니라 자기 클랜에 집계됩니다.',
      ],
    },
    events: {
      title: '참여할 이벤트 찾기',
      body: [
        '[Events](/events)는 Anvil 전역에서 진행 중이거나 곧 열릴 것을 보여 줍니다. **Live now**, **Open to join** 또는 **Starting this week**, 형식이나 **Solo**, **Anyone can join** 또는 **Ask or meet a rule**, **Clans** 또는 **Creators**로 필터링하세요. **Join**은 참가 신청 페이지로 데려갑니다.',
        '호스트가 **Advertise on Anvil**을 켠 이벤트만 나옵니다. 멤버 전용과 초대 전용 이벤트는 절대 나오지 않습니다.',
      ],
    },
    ghost: {
      title: 'Anvil에 없는 게임 내 클랜',
      body: [
        '캐릭터 페이지에는 그 캐릭터가 속한 게임 내 클랜의 이름이 나옵니다. 그 클랜이 Anvil에 없다면, 링크는 그 클랜에 속해 있고 보여 주기로 한 Anvil 플레이어들을 나열하는 평범한 페이지를 엽니다. 그 클랜의 명단이 아니며, 그 페이지의 무엇도 누군가를 멤버로 만들지 않습니다.',
        '우리 클랜이라면 **Bring your clan to Anvil**이 하나를 만들어 줍니다. 공개 Anvil 클랜이 되면 링크가 곧장 그곳으로 갑니다.',
      ],
    },
  },
  guideLibrary: {
    metaTitle: '게임 내 공략: 읽기, 제안, 클랜 복사본 — Anvil',
    metaDescription: 'Anvil 공략 라이브러리: 사이트, 게임 내, Discord에서 보는 레이드, 보스, 스킬링, 돈벌이 공략. 레벨별 읽기, 새 공략이나 수정 제안, 클랜이 라이브러리 공략을 복사하고 고치는 방법.',
    eyebrow: 'Anvil · 플레이어와 클랜 운영진용',
    title: '게임 내 공략',
    dek: '이런 사용법 페이지 말고도 Anvil은 게임 공략 라이브러리를 갖고 있습니다: 레이드, 보스, 스킬링, 돈벌이. 누구나 읽을 수 있고, 로그인한 사람은 누구나 하나를 제안할 수 있으며, 클랜은 자체 복사본을 보관할 수 있습니다.',
    facts: [
      {
        strong: '세 가지 레벨',
        rest: '입문, 중급, 고급',
      },
      {
        strong: '누구나 제안 가능',
        rest: '운영진이 모두 검토',
      },
      {
        strong: '/guide',
        rest: 'Discord에 공략 하나를 게시',
      },
    ],
    footnote: '슬래시 명령어는 [슬래시 명령어]({commandsGuide})에 있습니다.',
    read: {
      title: '공략 읽기',
      body: [
        '공략 페이지의 **In-game guides** 탭을 열거나, 클랜 사이트의 [/guides](/guides)를 여세요. 클랜 목록에는 자체 공략과 아직 복사하지 않은 라이브러리 공략이 함께 있습니다.',
        '많은 공략은 맨 위에 레벨 전환이 있습니다: **Beginner**, **Intermediate**, **Advanced**. 다른 레벨의 부분은 접혀 있어서, 초보자와 스피드러너가 같은 페이지를 읽습니다.',
        'Discord에서는 `/guide`와 공략 이름의 앞부분을 입력하면 공략 카드와 전체 페이지 링크가 게시됩니다.',
      ],
    },
    propose: {
      title: '공략이나 수정 제안하기',
      body: [
        '로그인한 상태에서 [Propose a guide](/guides/propose)를 열어 새 공략을 쓰거나, 기존 라이브러리 공략에 수정을 제안하세요. 검토자에게 무엇을 바꿨고 왜 바꿨는지 알려 주세요. 보내기 전에 현재 공략과 비교해 변경 사항을 볼 수 있습니다.',
        '**Send for review**를 누르세요. [My guide proposals](/guides/proposals)에는 각 제안이 **pending**, **approved**, **rejected** 또는 **withdrawn**으로 표시되며, 답변이 오면 검토자의 메모가 붙습니다. 대기 중에는 수정하거나 **Withdraw**할 수 있습니다. 한 번에 5개까지 대기시킬 수 있습니다.',
        'Anvil의 공략 편집자가 승인하기 전에는 아무것도 공개되지 않습니다. 승인된 수정은 바뀌지 않은 모든 클랜 복사본도 업데이트합니다.',
      ],
    },
    clan: {
      title: '우리 클랜의 공략',
      intro: '관리자와 공략 작성이 허용된 중재자는 관리자 메뉴의 **Guides**에서 관리합니다.',
      rows: [
        {
          term: '사이트에 라이브러리 공략 보이기',
          body: '켜면, 복사하지 않은 라이브러리 공략도 우리 Guides 페이지에 함께 보이며 항상 최신입니다.',
        },
        {
          term: '우리 공략으로 복사',
          body: '클랜 복사본을 만듭니다. 편집하기 전까지는 **follows library** 상태로, 라이브러리의 모든 변경을 따라갑니다.',
        },
        {
          term: '복사본 편집',
          body: '**customised** 상태, 즉 클랜 고유의 것이 됩니다. 나중에 라이브러리 공략이 바뀌면 **update available**이 표시되며, 새 버전을 받거나 내 것을 유지할 수 있습니다.',
        },
        {
          term: '새 공략',
          body: '우리 클랜만 가진 공략을 씁니다. 예: 우리 클랜의 레이드 규칙이나 모임 공략.',
        },
      ],
      note: {
        tag: 'Discord 게시',
        body: '공략은 Discord 채널에 게시할 수 있으며, 공략이 바뀌면 그 게시물은 제자리에서 수정됩니다.',
      },
    },
  },
  luckRecords: {
    metaTitle: '드롭 확률, 행운, 기록 — Anvil',
    metaDescription:
      '드롭 타일의 확률 줄이 무엇을 뜻하는지, Anvil이 행운(spooned, dry, on rate)을 어떻게 계산하는지, 효율 시간이 무엇인지, 그리고 최고의 하루, 주, 달, 해가 어디에 저장되는지 설명합니다.',
    eyebrow: 'Anvil · 플레이어를 위한',
    title: '드롭 확률, 행운, 기록',
    dek: 'Anvil은 드롭이 얼마나 희귀한지, 보통 얼마나 걸리는지, 그리고 당신이 얼마나 운이 좋았는지 알려 줄 수 있습니다. 최고의 날도 기억할 수 있습니다. 이 페이지는 그 숫자들을 설명합니다.',
    facts: [
      {
        strong: '레이트',
        rest: 'OSRS Wiki에서 가져옴',
      },
      {
        strong: '행운',
        rest: '예상 킬 수와 실제 킬 수 비교',
      },
      {
        strong: '기록',
        rest: 'Anvil이 나를 추적하기 시작한 시점부터의 기록을 포함',
      },
    ],
    footnote:
      '내 페이지는 [Your profile, Wrapped and Compare]({profileGuide})에 있습니다. 스위치는 [Settings, page by page]({settingsGuide})에 있습니다.',
    odds: {
      title: '드롭 타일의 확률',
      intro: '드롭 타일을 열면 확률이 알려진 아이템마다 한 줄씩, 최대 8줄이 보입니다. 줄은 다음과 같습니다:',
      body: [
        '`Item: 1 in 512 from Boss · ~512 kills ≈ 9.4 h at 55/h`',
        '한 번의 킬에서 여러 번 굴릴 수 있는 아이템에는 **(×2 rolls)**도 표시됩니다. Anvil이 그 보스를 사람들이 얼마나 빨리 잡는지 모르면, 시간 부분은 빠집니다.',
      ],
      rows: [
        {
          term: '1 in N',
          body: '한 번의 킬에서 그 드롭이 나올 확률이며, 가장 빨리 얻을 수 있는 출처를 기준으로 합니다.',
        },
        {
          term: '예상 킬 수',
          body: '필요한 킬 수의 평균입니다. 확률과 굴림 횟수로 계산합니다.',
        },
        {
          term: '시간',
          body: '예상 킬 수를 사람들이 보통 한 시간에 해내는 킬 수로 나눈 값입니다. 참고용이지 약속이 아닙니다.',
        },
      ],
      note: {
        tag: '상한이 아닌 평균',
        body: '모든 플레이어의 절반은 예상 킬 수 이전에 얻고, 일부는 훨씬 더 많이 필요합니다. 타일이 얼마나 큰지 판단하는 데 쓰세요. 언제 나올지 알려 주는 것은 아닙니다.',
      },
    },
    luck: {
      title: '행운: spooned, dry, on rate',
      body: [
        '행운은 내가 한 킬 수와 나와야 했던 킬 수를 비교합니다. 예상보다 적은 킬에서 드롭을 얻었다면 **spooned**입니다. 많은 킬을 했는데도 아무것도 없다면 **dry**입니다. 그 사이는 **on rate**입니다.',
        'Anvil은 드물 때만, 즉 약 20분의 1 확률이거나 그보다 희귀할 때만 **dry** 또는 **spooned**로 표시합니다. 예상 대비 몇 번인지, 얼마나 앞서 있거나 밀려 있는지 보여 줍니다.',
        'Members 페이지의 **Luck** 탭에는 클랜에서 가장 운이 없는 사람과 가장 운이 좋은 사람이 나열됩니다. 희귀 드롭의 플러그인 게시물에는 상위 몇 퍼센트인지, 지금쯤 몇 명이 이미 얻었을지 같은 행운 줄도 포함될 수 있습니다.',
      ],
    },
    source: {
      title: '숫자의 출처',
      body: [
        '드롭 확률은 OSRS Wiki에서 가져오며 매일 갱신됩니다. 시간 계산에 쓰는 킬 속도는 Wiki의 돈벌이 가이드에서 가져옵니다. 확률이 신중한 추정치라면 Anvil도 그렇게 취급합니다.',
        '확률이 틀려 보인다면 고칠 곳은 Wiki입니다. Anvil은 그 변경 사항을 반영합니다.',
      ],
    },
    records: {
      title: '기록과 효율 시간',
      body: [
        'Anvil은 스킬 XP, 보스 킬, 효율 시간에 대해 내 최고의 **day**, **week**, **month**, **year**를 저장합니다. 날짜는 UTC 기준이며, 주는 월요일에 시작합니다.',
        '기록은 Anvil이 내 계정을 추적하기 시작한 시점까지 거슬러 올라갑니다. 기록을 처음 열면 Anvil이 일별 기록으로 빈 부분을 채우고, 이후에는 최신 상태로 유지합니다. 기록은 기존 최고 기록을 넘어설 때만 바뀝니다.',
        '내 기록은 캐릭터 페이지의 **Records**에서 볼 수 있습니다. 클랜의 기록 보유자는 **Members → Records**에 있습니다.',
        '**Efficient hours played**는 내 성장이 좋은 훈련 방법으로 얼마나 걸릴지를 보여 주므로, 빠른 스킬과 느린 스킬을 비교할 수 있습니다. **Efficient hours bossed**는 킬에 대해 같은 일을 합니다. 확률은 OSRS Wiki에서 가져오며, 아이언맨 계정은 자체 확률을 사용합니다.',
      ],
    },
  },
};

export default ko;
