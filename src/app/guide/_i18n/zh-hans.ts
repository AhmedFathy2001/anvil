import type { PartialGuideDict } from './en';

// 简体中文 — Simplified Chinese.
//
// 与此处其他语言文件相同的约定：读者在 Anvil、RuneLite 与 OBS 屏幕上「真正看到」的东西一律保留英文 ——
// RuneLite 与 OBS 的菜单、插件本身输出的聊天行，以及 Anvil 管理界面的标签（在该界面本身被翻译之前都是英文）。把
// "Tracked drop detected" 翻译掉，就等于让人再也搜不到那一行。Discord 自身的界面标签（菜单、设置、权限名）
// 则沿用 Discord 简体中文版的官方译名：「复制服务器 ID」「服务器设置 → 身份组」「管理 Webhook」。
// 其余的一切 —— 解释、顺序、原因 —— 都是中文。

const zhHans: PartialGuideDict = {
  common: {
    contents: '目录',
    step: '步骤',
    optional: '可选',
    minRead: '阅读约 {n} 分钟',
    copyLink: '复制本节的链接',
    linkCopied: '链接已复制',
    language: '语言',
    partialNotice:
      '本指南只有部分内容译成了{language}。尚未翻译的部分以英文显示。',
    backToGuides: '全部指南',
    unreviewedNotice:
      '这份{language}译文还没有母语者校对过。如果某句话读起来不对，[英文页面]({englishHref}) 才是原文 —— 而[告诉我们](/feedback)才能让它被修正。',
    support: {
      lead: '卡住了,或者有什么不对?',
      link: '在 Anvil 支持 Discord 中提问',
    },
    legalPaid: '关于款项：请见 [退款政策](/legal/refunds) 和 [服务条款](/legal/terms)。',
    legalPrivacy: '数据如何处理：见 [隐私政策](/legal/privacy)。',
    aboutLine: '谁在运营 Anvil？请阅读 [关于](/about)。',
  },

  index: {
    metaTitle: '指南 — Anvil',
    metaDescription:
      '开始使用 Anvil：面向玩家的 RuneLite 插件、面向氏族管理层的活动运营，以及如何接待来访氏族。',
    title: '指南',
    dek: '开始所需的一切，针对此处正在运行的这一版 Anvil 撰写。',
    groups: {
      playing: '参与游戏',
      running: '运营一场活动',
      clan: '管理氏族',
      streamers: '主播',
    },
    anvilTab: '使用 Anvil',
    ingame: {
      title: '游戏攻略',
      dek: '来自 Anvil 攻略库的团队副本、首领、技能与赚钱攻略——与插件在游戏内显示、机器人发布到 Discord 的是同一批攻略。',
      browse: '浏览全部攻略',
      language: '这些攻略未经翻译：无论本页使用哪种语言，都按原文显示。',
      empty: 'Anvil 攻略库暂时还没有已发布的攻略，请稍后再来。',
      placeholder: '搜索游戏攻略——试试 "zulrah"、"raids" 或 "money"',
      readTime: '约 {n} 分钟阅读',
      metaTitle: 'OSRS 游戏攻略 — Anvil',
      metaDescription: 'Anvil 攻略库中的团队副本、首领、技能与赚钱攻略，可在网站上、通过 RuneLite 插件在游戏内以及在 Discord 中阅读。',
    },
    search: {
      placeholder: '搜索指南 — 试试 "webhook"、"格子" 或 "掉落没有显示"',
      results: '{n} 篇指南',
      empty: '没有匹配结果。换个更普通的词试试 — "格子"、"发奖"、"机器人" — 或者浏览下面的列表。',
      clear: '清除搜索',
    },
    cards: {
      tiles: {
        eyebrow: '面向玩家',
        title: '格子规则与限制',
        blurb: '开始前格子需要你做什么（游戏设置、插件、已同步的收藏日志、高分榜排名），以及它无法追踪什么。',
        minutes: '约 4 分钟',
      },
      discord: {
        eyebrow: '给管理服务器的人',
        title: 'Discord 里的 Anvil',
        blurb: '一次邀请，然后是各信息流发帖的频道、身份组、斜杠命令，以及停摆时该检查什么。',
        minutes: '约 5 分钟',
      },
      switching: {
        eyebrow: '迁移到 Anvil',
        title: '从其他插件和追踪工具切换过来',
        blurb:
          'Anvil 会把你的掉落发到 Discord，还会运行每周比赛。管理员五步，玩家两步。',
        minutes: '约 3 分钟',
      },
      clan: {
        eyebrow: '给要开氏族的人',
        title: '创建氏族',
        blurb: '两个名字加一个地址，就上线了。然后是 Discord、你的成员名单和第一块板。',
        minutes: '约 4 分钟，免费',
      },
      plugin: {
        eyebrow: '面向玩家',
        title: 'RuneLite 插件设置',
        blurb:
          '安装插件，在它的侧边栏面板里登录，然后让它替你提交掉落。也涵盖 Discord 通知与玩家查询。',
        minutes: '约 3 分钟完成设置',
      },
      board: {
        eyebrow: '面向棋盘搭建者',
        title: '做一块会自己记账的棋盘',
        blurb:
          '每种格子究竟能看到什么、用表格批量编写，以及那些导入得干干净净、却永远不会触发的错误。',
        minutes: '约 8 分钟',
      },
      captain: {
        eyebrow: '面向队长',
        title: '队长指南',
        blurb:
          '在计时开始前先把候选名单读透、选秀当天本身，以及带队工作中真正从选秀之后才开始的那部分。',
        minutes: '约 6 分钟',
      },
      formats: {
        eyebrow: '面向氏族管理层',
        title: '赛制，以及格子如何开放',
        blurb:
          '七种棋盘形态、五种让格子变得可玩的方式，以及决定一次完成值多少分的三个修正项。',
        minutes: '约 5 分钟',
      },
      fees: {
        eyebrow: '面向司库',
        title: '报名费与奖金发放',
        blurb:
          '设定报名费、把钱收上来、结清它所需的第二个签名，以及把奖池变成一份已付名次表。',
        minutes: '约 5 分钟',
      },
      coffer: {
        eyebrow: '写给财务',
        title: '氏族金库',
        blurb:
          '一个装氏族金币的池子：钱怎么进来、发奖的三条路，以及谁有权动它。',
        minutes: '约 5 分钟',
      },
      moderator: {
        eyebrow: '面向管理员',
        title: '当班',
        blurb:
          '待办队列、审核凭证与账号、让成员名单保持诚实，以及那些必须由人来做的判断。',
        minutes: '约 5 分钟',
      },
      admin: {
        eyebrow: '面向氏族管理层',
        title: '如何办好你的第一场活动',
        blurb:
          'Discord、成员名单、棋盘、格子、队伍与选秀、开赛 —— 以及活动结束后该做什么。',
        minutes: '一个晚上，只需一次',
      },
      clanVsClan: {
        eyebrow: '面向主办方',
        title: '接待一个来访氏族',
        blurb:
          '氏族对抗赛，不用手工收集一个 RSN：每队一条邀请链接，再加一个让对方自己的管理员打理他们那一半的席位。',
        minutes: '每队约 5 分钟',
      },
      commands: {
        eyebrow: '面向每一位成员',
        title: '斜杠命令',
        blurb:
          '机器人在 Discord 里响应的每一条命令、每个选项的作用、实际示例，以及某条命令不出现时该检查什么。',
        minutes: '约 6 分钟',
      },
      creators: {
        eyebrow: '给主播',
        title: '为你的观众举办活动',
        blurb:
          '不需要氏族。建一个空间，分享一条链接，选择谁能加入（关注者、订阅者、Discord 身份组），再把棋盘放到直播里。',
        minutes: '约 6 分钟',
      },
      joiningStream: {
        eyebrow: '给观众',
        title: '加入主播的活动',
        blurb:
          '在直播里拿到了链接？登录，添加你的角色，按 Join。关注者或订阅者专属活动该怎么做。',
        minutes: '约 2 分钟',
      },
      streamingClans: {
        eyebrow: '给做直播的氏族',
        title: '氏族直播',
        blurb:
          '让观众不用加入氏族也能参加一场活动。打开 Streaming，再向观众开放一场活动。',
        minutes: '约 2 分钟',
      },
      people: {
        eyebrow: '面向氏族管理团队',
        title: '你的成员：名单、访客与谁能加入',
        blurb:
          '成员从哪里来、Roster 标签页里各个筛选的含义、加入申请与 Needs review、Who can join 的三个设置，以及移除或封禁某人。',
        minutes: '约 6 分钟',
      },
      staffRoles: {
        eyebrow: '面向所有者和 admin',
        title: '管理团队角色：谁能做什么',
        blurb:
          '所有者、admin、司库和管理员：各自能管到哪里、怎样让某人成为管理员、谁能授予哪个角色，以及只负责一场活动的职务。',
        minutes: '约 6 分钟',
      },
      supporter: {
        eyebrow: '面向玩家',
        title: 'Anvil Supporter：档位与福利',
        blurb:
          'Supporter、Champion 和 Patron：名字颜色、星标、资料图片、展示柜、好友活动和氏族助力，付费怎样运作，以及停止付费后会怎样。',
        minutes: '约 6 分钟',
      },
      sidePanel: {
        eyebrow: '面向玩家',
        title: '侧边面板逐个标签页讲解',
        blurb:
          'Clan、Feed、You、Lookup 和齿轮：每个标签页显示什么、活动聊天、GZ 和 Sad 反应，以及把动态和 Supporter 颜色带进游戏的设置。',
        minutes: '约 6 分钟',
      },
      clanBoosts: {
        eyebrow: '面向 Supporter 和氏族管理团队',
        title: '为氏族助力',
        blurb:
          '放置和移动助力、三个等级及各自解锁的内容、氏族的名字颜色、赠送的助力，以及助力者标记和徽章。',
        minutes: '约 5 分钟',
      },
      profile: {
        eyebrow: '面向玩家',
        title: '你的资料、Wrapped 与对比',
        blurb: '你的资料、每个角色的公开页面和你的个人页面、谁能看到它们、月度与活动 Wrapped 卡片，以及两个角色的对比。',
        minutes: '约 4 分钟',
      },
      settings: {
        eyebrow: '面向玩家',
        title: '设置，逐页讲解',
        blurb: 'Discord 发帖与截图隐私、游戏内聊天动态、设备、你自己的 webhook、谁能看到你的角色、每个角色，以及归属认领。',
        minutes: '约 6 分钟',
      },
      challenges: {
        eyebrow: '面向玩家',
        title: '挑战与好友活动',
        blurb: '向一位玩家发起掉落、击杀或经验对决，并通过一个邀请链接为你的好友主办一个私人棋盘。',
        minutes: '约 4 分钟',
      },
      clanHall: {
        eyebrow: '面向玩家与氏族',
        title: '查找氏族、活动与排行榜',
        blurb: 'Clan Hall、两个氏族的对比、每周排行榜、公开活动列表，以及不在 Anvil 上的游戏内氏族页面。',
        minutes: '约 3 分钟',
      },
      guideLibrary: {
        eyebrow: '面向玩家与氏族工作人员',
        title: '游戏内攻略',
        blurb: '按等级阅读攻略库、提交新攻略或修改建议，并保留你氏族自己的副本。',
        minutes: '约 3 分钟',
      },
      weekly: {
        eyebrow: '面向氏族工作人员与玩家',
        title: 'Skill 与 Boss of the Week',
        blurb: '安排每周比赛、重复与轮换、起跑线、奖品、提前结束，以及玩家看到的内容。',
        minutes: '约 4 分钟',
      },
      teamComps: {
        "eyebrow": "面向 clan 管理员与玩家",
        "title": "团队竞赛",
        "blurb": "以团队或 clan 对 clan 形式进行的技能与 Boss 竞赛：如何设置、邀请其他 clan、总分与平均值如何计算，以及玩家能看到什么。",
        "minutes": "~4 分钟"
      },
      clanEvents: {
        eyebrow: '面向氏族工作人员',
        title: '氏族活动与日程',
        blurb: '集合、团本夜和聚会：每周重复、“I’m going”与报名、Discord 提醒、奖金发放、问卷，以及找出日程中的空档。',
        minutes: '约 4 分钟',
      },
      luckRecords: {
        eyebrow: '面向玩家',
        title: '掉落概率、运气与记录',
        blurb: '了解掉落格的概率含义、运气如何计算，以及你的最佳日、周、月、年在哪里显示。',
        minutes: '约 3 分钟',
      },
    },
  },

  switching: {
    metaTitle: '从其他插件和追踪工具切换过来 — Anvil',
    metaDescription:
      '把你的公会迁到 Anvil：设置 Discord 频道、同步公会名单、开始 Skill 或 Boss of the Week，并通知成员。',
    eyebrow: '迁移到 Anvil',
    title: '从其他插件和追踪工具切换过来',
    dek: 'Anvil 把公会的掉落和成就发到 Discord，还会维护公会名单并运行每周比赛。',

    staff: {
      title: '如果你负责管理公会',
      body: [
        '**让机器人帮你设置频道。** 前往 Admin → Discord → **Set it up for me**。选一个频道或几个都行。如果其他插件之前在某个频道发消息，就勾选 _Use the same channels_。成员那边不会有任何变化。',
        '**同步公会名单。** 在 RuneLite 里打开 Anvil 插件的设置，开启 **Keep the clan roster in sync**。由一位管理员在游戏里操作一次即可。这会取代你在其他地方维护的公会名单。',
        '**开始一场 Skill 或 Boss of the Week。** 前往 Admin → All events → **+ New event**，选择 Skill of the Week 或 Boss of the Week。公会名单里的所有人会自动参加。这会取代你在其他地方举办的比赛。',
        '**通知你的成员。** 前往 Admin → Discord → **Tell your members** → **Post it**。机器人会替你发布玩家要做的步骤。',
        '**一周后，清理一下。** 前往 Admin → Discord → **Remove old webhooks from other plugins**，勾选要删掉的那些，按 **Remove … webhooks**，再按 **Yes, remove them**。之后就不会再有重复发布了。想保留的，就在它上面按 **Keep**。',
      ],
    },

    player: {
      title: '如果你是玩家',
      body: [
        '**安装 Anvil。** 在 RuneLite 里打开 Plugin Hub，搜索 Anvil，点 **Install**。然后在 Anvil 侧边面板里用 Discord 登录。',
        '**关掉旧插件的通知**，避免重复发布。如果不用它做别的事，也可以直接卸载。',
        '**就这些。** 没有其他需要设置的了。',
      ],
    },

    questions: {
      title: '常见问题',
      intro: '公会问得最多的几个：',
      rows: [
        {
          term: 'Anvil 会追踪击杀数、Slayer 任务和个人最佳记录吗？',
          body: '会。Anvil 自己就能追踪击杀数、Slayer 任务和个人最佳记录，所以无需再运行其他工具。',
        },
        {
          term: '玩家需要在哪里粘贴 webhook 吗？',
          body: '不需要。频道由公会在网站上设置。',
        },
        {
          term: '想让消息也发到你自己的服务器吗？',
          body: '前往你的个人资料 → **Announcements & webhooks** → _Your own webhooks_。',
        },
      ],
    },
  },

  clan: {
    metaTitle: '创建氏族 — Anvil',
    metaDescription: '在 Anvil 上创建氏族：起名、选地址、连接 Discord、同步成员名单，并举办第一场活动。',
    eyebrow: 'Anvil · 入门',
    title: '创建氏族',
    dek: '两个名字加一个地址，你的氏族就上线了——免费，而且不用等待。这篇讲的就是这个，外加紧接着值得做的四件事。',
    facts: [
      {
        strong: '免费',
        rest: '不用银行卡，没有试用期',
      },
      {
        strong: '即时上线',
        rest: '提交的那一刻',
      },
      {
        strong: '约 4 分钟',
        rest: '到一个能用的氏族',
      },
    ],
    footnote: '这些以后都能在 管理 → **Clan settings** 里改，只有地址例外——那个现在值得想一下。',
    before: {
      title: '开始之前',
      body: [
        '你需要一个 Discord 账号，清单到此为止。先在 `{apex}` 登录：氏族需要一个所有者，而登录就是网站确认那是你的方式。从平台页面的 **创建氏族** 开始，或者直接前往 `{apex}/clans/new`。',
        '不花一分钱。没有套餐要选，没有卡要填，也没有到期后把你的板一起带走的试用——氏族免费开始，并且一直可用。',
        '大氏族以后可以在管理里的 **Plan and billing** 升级套餐。你在 Anvil 上付费的一切——氏族、创作者空间，或者你自己的 Supporter 会员——都在[你的账单页面](/portal)。',
      ],
      note: {
        tag: '你会成为它的所有者',
        body: '所有者是唯一没人能从你手里拿走的角色，它归创建氏族的人。之后从 管理 → **People** → **Staff & roles** 添加管理团队；参见[值班表上]({moderatorGuide})。',
      },
    },
    create: {
      title: '起名，并选好地址',
      intro: '三个字段，真正的决定只有两个。表单会在你输入时检查地址，并在提交前告诉你。',
      fields: [
        {
          term: '游戏内氏族名',
          body: '必填，而且必须与 OSRS **完全一致**。这不是装饰：名单同步按它匹配，并会拒绝以任何其他名字上报的成员名单。正是它挡住了别人的成员名单落到你的站点上。',
        },
        {
          term: '氏族名称',
          body: '可选。别人看到的名字——在站点上和每一条 Discord 帖子里。留空的话，两处都用你的游戏内名字。',
        },
        {
          term: '地址',
          body: '你的氏族住在 `{apex}/c/你的-slug`。它会根据你输入的名字给出建议，你可以修改，另有少数词是保留的。选一个一年后你仍然喜欢的：这就是最终会被置顶在你 Discord 里的链接。',
        },
      ],
      note: {
        tag: '游戏内名字是一把锁，不是标签',
        body: '如果你的氏族在游戏里改了名，这里也要改——在那之前，名单同步会拒绝新名字。这是校验在起作用，不是故障。',
      },
    },
    live: {
      title: '它已经上线',
      body: [
        '按下 **创建氏族**，它就存在了。没有资源调配，没有排队，没有“我们正在搭建你的站点，过几分钟再来”——氏族就是一行数据，所以在页面切换完成之前它就已经在服务了。',
        '你会看到两个选择：**开始设置**（打开向导）和 **先四处看看**。中途离开、明天再回来也不会有任何损坏；向导会记住你完成了哪些步骤。',
      ],
    },
    setup: {
      title: '设置向导',
      intro: '一个崭新的氏族和一场正在进行的活动之间隔着三个步骤，向导按顺序走一遍，并跳过你已经做完的。紧接着就是做板。',
      steps: [
        {
          term: '你的氏族',
          body: '你的显示名称、游戏内氏族名，以及一个指向你服务器的邀请链接。有了邀请，报名页面和指南才能把人指引到你这里。',
        },
        {
          term: '连接 Discord',
          body: '一个共享机器人，所以没有应用要注册，也没有令牌要粘贴。按 **Connect your bot** 并批准一次，然后选择 **A few channels** 或 **Just one channel**，再按 **Set it up for me**——机器人会替你建好频道。',
        },
        {
          term: '把成员拉进来',
          body: '安装插件，用 Discord 登录，然后在游戏里打开氏族窗口，按标题栏上的 **Anvil** 按钮。在你的成员名单进来之前，没有人能报名活动。',
        },
        {
          term: '做一块板',
          body: '向导的最后一步是 **Create your first event →**。选格式、加格子、开报名——那是[举办你的第一场活动]({adminGuide})，也是明显最长的一步。',
        },
      ],
      after: [
        '你完全可以用 **Skip setup** 跳过向导，之后在 管理 → **Clan settings** 和 管理 → **Discord** 里把这些做完。它之所以存在，是因为第一次做的时候顺序很重要：先 Discord 后频道，先成员后他们要报名的板。',
      ],
    },
    members: {
      title: '把成员拉进来',
      body: [
        '没有人需要报名、注册或被一个个邀请。你的成员名单来自游戏。',
      ],
      ways: [
        {
          term: '名单同步（用这个）',
          body: '在游戏里开着插件打开氏族窗口，按标题栏上的 **Anvil** 按钮。你的整份成员名单会连同等级一起送达，而来自名字与你不符的氏族的名单会被拒绝。有人加入或离开时重复一次即可——参见[玩家设置指南]({pluginGuide})。',
        },
        {
          term: '他们申请加入',
          body: '登录或带着插件游玩，本身都不会给任何人席位。如果插件看到有人在你们的游戏内氏族里游玩、而名单上还没有他，它会替他提交一份加入申请；其他人可以在你们的氏族页面上用 **Apply** 申请。管理团队在 **Roster** 标签页顶部处理这两种申请，而 **Who can join** 决定他们是等一个「同意」、直接进入，还是根本不能申请。玩着一个已经在你们名单上的角色的人，则改在 **Needs review** 里确认。详情见[你的成员]({peopleGuide})。',
        },
        {
          term: '手动添加',
          body: '管理 → **People** → **+ Add Manually** 可以一个一个地添加名字，适合那些用手机或官方客户端、完全无法运行插件的人。',
        },
      ],
      note: {
        tag: '访客不是需要解决的问题',
        body: '访客是不在你们游戏内氏族里、却在你们活动中游玩的人：来访氏族的玩家、朋友、小号。管理团队批准他们的申请时，他们就会得到席位；如果 **Who can join** 设为 **Let anyone in**，则立刻得到。他们会被记录、可以参加活动，并且不计入你们的套餐。在游戏里加入你们的人，会在下一次名单同步时成为成员。',
      },
    },
    first: {
      title: '你的第一场活动',
      body: [
        '让事情发生的最短路径：做一块板，加上几个插件自己就能看到的格子，开放报名，然后开始。之后掉落、击杀数和经验都会自己记录。',
        '这里主要靠两篇指南。[举办你的第一场活动]({adminGuide})从头讲到尾——Discord、队伍、开赛，以及结束时该做什么。[打造一块自己记录的板]({boardGuide})专讲格子：每一种到底能检测到什么，以及哪些导入得很干净却从不触发。',
        '如果第一周你根本不想做板，那就改办 **Skill of the Week** 或 **Boss of the Week**。名单上的每个人都自动参加，排名来自 hiscores，没有任何内容要撰写。',
      ],
    },
    together: {
      title: '跨多个氏族的活动',
      body: [
        '一场活动不必属于某一个氏族。多个氏族可以共同运行同一块板——两个，或者十几个——每一方保留自己的成员名单、自己的管理团队和自己那一半的审核工作。',
        '它们也可以共用同一批玩家，而不是分坐记分板两端：一场活动，所有人都在里面，队伍最终怎么划分都行。氏族对氏族只是其中一种形态，并非唯一。',
        '每个来访氏族都会拿到按队伍分配的邀请链接，所以你永远不必手动收集哪怕一个游戏昵称；还有一个席位，让他们自己的管理员审核自己成员的证据。[接待来访氏族]({clanVsClanGuide})讲的就是如何主办。',
      ],
      note: {
        tag: '没有东西要买',
        body: '参加别人的活动是免费的，自己主办也是免费的。一个只出现在别人板上的氏族，永远不需要超出它自己那个免费氏族的东西。',
      },
    },

    boosts: {
      title: '氏族助力',
      body: [
        '购买了 Anvil Supporter **Champion**（一次助力）或 **Patron**（两次）档位的成员，可以在自己的 **Settings → Clan boosts** 里为氏族助力。一次助力要等此人在氏族里的席位满 14 天才算数，而且同一个人最多只有两次算数。',
        '你可以在 管理 → **Clan settings** → **Boosts** 看到当前情况：氏族的等级、有多少次助力正在算数，以及升到下一级还需要多少次。1 级需要 3 次助力，2 级需要 8 次，3 级需要 15 次。如果助力数掉到某一级以下，该级的福利还会先保留一周。',
        '1 级会在你的氏族页面、Clan Hall 卡片和搜索结果上加一个 **Boosted** 徽章，在 Clan Hall 里把你排在未助力的氏族之前，并让你的名字显示渐变色。2 级增加 Clan Hall 中 Featured 一栏里的一个位置，播放你的动态横幅，并解锁一条 **Recruiting line**：一句话，最多 140 个字符，展示给访客。3 级增加 Clan Hall 顶部的一个 Spotlight，以及每月一条 **Recruitment post in the Anvil Discord**，最多 500 个字符，用 **Post to the Anvil Discord** 发送一次，附带你氏族页面的链接，且不会 @ 任何人。',
      ],
      note: {
        tag: '只影响外观',
        body: '助力只改变氏族的外观和它在列表中的位置。它从不改变等级、分数、你的席位或你的套餐。',
      },
    },
    features: {
      title: '功能与套餐',
      intro: '管理员可以在 **Features** 下整块地开启或关闭 Anvil 的各部分功能。关闭后，菜单中会隐藏它们，但不会删除任何内容。',
      rows: [
        {
          term: '活动',
          body: '**Skill & Boss of the Week**（开）、**Surprise-task formats**（关）、**Missions**（关）、**Post-event survey**（关）。',
        },
        {
          term: '资金',
          body: '**Sign-up fees**（开）、**Clan coffer**（关）。',
        },
        {
          term: 'Discord 与插件',
          body: '**Post to Discord**（开）、**Death & fun messages**（关）、**Clan Hall card**，即在你的公开氏族页面上显示谁在你的 Discord 中在线（开）。',
        },
      ],
      outro: '**Plan and billing** 会显示你的套餐、你的成员数相对套餐上限的情况，以及更大的套餐。如果你付费，**Manage subscription and invoices** 也在那里。',
    },
  },

  discord: {
    metaTitle: 'Discord 里的 Anvil — Anvil',
    metaDescription: '把 Anvil 机器人接入你的 Discord 服务器：一次邀请、各信息流发帖的频道、身份组与昵称同步、斜杠命令，以及安静下来时该检查什么。',
    eyebrow: 'Anvil · Discord',
    title: 'Discord 里的 Anvil',
    dek: '一个机器人，一次邀请，不用注册任何应用。这里讲它发什么、发到哪里、能在你的服务器里改动什么——以及它哪天不动了，你该看哪里。',
    facts: [
      {
        strong: '一个机器人',
        rest: '共享，无需创建',
      },
      {
        strong: '约 5 分钟',
        rest: '从邀请到第一条帖子',
      },
      {
        strong: '按需开启',
        rest: '每个信息流在你指定去处前都是关的',
      },
    ],
    footnote: '这里的一切都在 管理 → **Discord** 上：顶部是快速设置，下面是 **More settings**——Connection、What goes where、Event posts、Roles & nicknames、Team channels、Commands 和 Post without a bot。',
    bot: {
      title: '一个机器人，已经建好',
      body: [
        '没有 Discord 应用要创建，没有令牌要生成，也没有密钥要粘贴。Anvil 运行一个所有氏族共用的机器人，所以接入就是一次邀请，仅此而已。',
        '你仍然可以自带——在 **Use your own bot instead (advanced)** 下粘贴一个令牌，就会改用它。只有当你希望机器人在成员列表里显示你氏族的名字和头像时才值得；本指南里的一切在两种情况下表现完全相同。',
      ],
      permissions: [
        {
          term: '查看频道、发送消息、嵌入链接、附加文件',
          body: '基础项。没有这些，它就在你的服务器里默不作声。',
        },
        {
          term: '管理 Webhook',
          body: '好让 **Set it up for me** 和 **Post here** 替你创建 Webhook，而不必你手动从 Discord 复制网址；Anvil 也靠它找出旧的 Webhook 供你删除。',
        },
        {
          term: '管理身份组',
          body: '仅当你开启身份组同步时需要。届时它可以分发你映射的身份组——而且永远无法碰高于自己的身份组，这是 Discord 的规则，不是我们的。',
        },
        {
          term: '管理昵称',
          body: '仅当你开启昵称同步时需要，好把成员的服务器昵称设为其游戏昵称。',
        },
        {
          term: '管理频道',
          body: '用于选秀期间各队的私密频道，以及以新分类或论坛形式发布的攻略。不给也不影响其他功能。',
        },
        {
          term: '管理子区、在子区中发送消息',
          body: '用于发布到论坛的攻略：在帖子里写内容，以及再次删除帖子——没有这个权限，Discord 连机器人自己的论坛帖子都不让它删。',
        },
        {
          term: '更改昵称',
          body: '仅当你在 **Connection → Bot appearance in your server** 中让机器人使用你们氏族的名字时需要。只会改变机器人在你们服务器里的名字。',
        },
      ],
      note: {
        tag: '它会一次性请求全部权限',
        body: 'Discord 没有办法事后再申请某项权限，所以邀请链接会一次请求整套，而你从不开启的功能也就从不使用它们的权限。重新打开邀请链接，也是修复被人移除的权限的方法。',
      },
    },
    connect: {
      title: '接入它',
      intro: '两件事，按这个顺序。机器人必须在你的服务器里，而 Anvil 必须知道哪个服务器是你的。',
      steps: [
        {
          term: '邀请机器人',
          body: '管理 → **Discord** → **Connect your Discord server**（或 **Add Anvil to Discord**）。Discord 会问你要把 Anvil 加到哪个服务器，然后把你送回这里，所以你不会误加到别的服务器。之后，**Invite / re-invite the bot** 在 **More settings → Connection** 下。',
        },
        {
          term: '填入服务器 ID',
          body: '仅当按钮办不到时：展开 **Can’t use the button? Enter the server ID**，在 Discord 里右键你的服务器图标 → **复制服务器 ID**（需要在 Discord 自身的“高级设置”里打开“开发者模式”），粘贴到 **Your Discord server’s ID**，然后按 **Save**。正是这个字段让连接专属于你。',
        },
      ],
      after: [
        '随后面板告诉你的是事实而不是你的意图：机器人是否真的是那个服务器的成员，以及它缺少哪些权限。那里的一行绿字，比一份保存好的表单更有价值。',
      ],
      note: {
        tag: '服务器 ID 就是全部绑定',
        body: '在 Anvil 上一个服务器恰好属于一个氏族，来自无人认领的服务器的斜杠命令会被拒绝，而不是靠猜。在你填好之前，机器人只是被邀请了，闲着。',
      },
    },
    channels: {
      title: '设置 Webhook',
      body: [
        'Anvil 通过 **Webhook** 发帖，每个频道一个，而且全都是可选的。在你把某个信息流指向某个频道之前，什么都不会发到任何地方——崭新的氏族是刻意安静，不是出了差错。',
        'Anvil 机器人在你的服务器里时，**Admin → Discord** 顶部的 **Set it up for me** 会建好频道，并把每个信息流都指向它们。想手动设置，就打开 **More settings → What goes where**，先设 **Clan & events** 上的 **Catch-all channel**，再设 **In-game (plugin)** 上的 **In-game catch-all**：从下拉菜单里选一个频道，就会自动保存。没有机器人时，在 Discord 中打开该频道的 **编辑频道 → 整合 → Webhook**，创建一个，复制网址，在下拉菜单里选 **Paste a webhook…**，粘贴后按 **Save**。Webhook 网址可以向频道发帖，所以要像密码一样保管；如果泄露，请在 Discord 中删除并新建。**Test**，以及用来在两个 Webhook 之间轮换繁忙帖子的 **Add another**，都在 **Post without a bot** 下。',
      ],
      feeds: [
        {
          term: '总频道',
          body: '主频道，位于 **Clan & events** 标签页。活动开始与结束、报名开放、排名、每周结果，凡是网站发布且没有专属频道的内容都在这里。只设置这一个，你的团队就能正常运作。',
        },
        {
          term: '游戏内总频道',
          body: '位于 **In-game (plugin)** 标签页：游戏内内容若没有专属频道，就发到这里。第二个设置这个。',
        },
        {
          term: '里程碑等',
          body:
            '位于 **In-game (plugin)** 标签页。玩家开启后，Slayer、clues、速通、击杀数、BA gambles 和自定义聊天消息会发到这里。其 **Filters** 按钮设置你的团队默认给成员哪些内容。玩家自己的模板和私密类型见 [Settings, page by page]({settingsGuide})。',
        },
        {
          term: '拆分的推送源',
          body:
            '活动帖子、你共同主办的 boards、Skill & boss of the week 和团队日历活动可以从总频道拆分出来；稀有掉落、宠物、collection log、等级、combat achievements、任务、日记、死亡和 PvP 击杀可以从游戏内总频道拆分出来。成员变动、报名审批和团队金库账本位于 **Staff only**。留空的拆分推送源会回落到其总频道。金库是例外：留空意味着不发布任何金额。Leagues 及其他模式有各自的 **Game modes** 标签页。',
        },
      ],
      note: {
        tag: '先把死亡拆出去',
        body: '在大多数板上，死亡是量最大的信息流，也是会把其他一切埋掉的那个。如果你只拆一样，就拆它。',
      },
    },
    roles: {
      title: '身份组与昵称',
      body: [
        '两种同步默认关闭，需要在 **Admin → Discord → Roles & nicknames** 中启用，而且两者都以成员名单为依据。打开 **Enable Discord role sync**，保持 **Auto-match in-game rank → Discord role by name** 开启，按需选择通用的 **Member roles** 和 **Guest roles**，保存后按 **Sync roles & nicknames now**。每个人还必须关联一个 Discord 身份；同步报告会列出它无法识别的人。',
      ],
      ways: [
        {
          term: '身份组同步',
          body: '要自动匹配等级，Discord 身份组的名称必须与游戏内的氏族等级一致：`Owner`、`Deputy Owner`、`Coordinator`、`Overseer`、`General`、`Captain`、`Lieutenant`、`Sergeant`、`Corporal` 或 `Recruit`。自定义等级只要其 Discord 身份组使用同一名称，也同样适用。匹配不区分大小写，下划线视同空格，但多余的单词不会匹配：`General` 可以；`OSRS General` 不行。成员和访客身份组是另外选的，所以名称可以任意。',
        },
        {
          term: '昵称同步',
          body: '把成员的服务器昵称设为其游戏昵称。默认只填补空白昵称，也可以让它覆盖别人自己取的昵称——这是那种要事先想清楚、而不是事后再想的设置。',
        },
      ],
      note: {
        tag: '机器人的身份组必须高于它所管理的身份组',
        body: 'Discord 不允许任何机器人碰与自己同级或更高的身份组，而且从你这边看它是悄无声息地拒绝——同步就是什么也不做。在 服务器设置 → 身份组 里把 Anvil 的身份组往上拖，它就开始工作了；不需要重新邀请任何东西。',
      },
    },
    commands: {
      title: '斜杠命令',
      body: [
        '机器人在你的服务器里响应 `/bingo`（棋盘、排名、规则、你自己的卡片），以及 `/sotw`、`/stats`、`/coffer` 等氏族命令。它们读取网站上的实时数据，所以没人需要离开 Discord 就能看到自己的位置。[每条命令及其选项]({commandsGuide})都有专门的页面。',
        '机器人加入后大约一分钟它们才会出现。如果始终不出现，说明那次邀请授予了机器人却没有授予它的命令——这是两项独立权限，而较早的邀请链接只申请了其中一项。在 Discord 页面的 **Connection** 下重新运行 **Invite / re-invite the bot** 即可；这不会踢出机器人，也不会重置任何东西。',
      ],
      note: {
        tag: '它用每个人自己的语言回复',
        body: '默认情况下，机器人会用该成员 Discord 所设的语言回复，并以英语兜底。在 **机器人语言** 下选定一种语言，即可为所有人覆盖这一行为——这也是获得阿拉伯语的唯一途径，因为 Discord 没有阿拉伯语客户端语言可供检测。',
      },
    },
    posts: {
      title: '它发什么，什么时候发',
      body: [
        '两个来源。当某处看起来不对时，值得分清哪个是哪个。',
        '**站点** 发布活动：板开放、报名、开赛、排名、结果。它们从 Anvil 自身发出，无论有没有人装插件都照常工作。',
        '**插件** 发布游戏里发生的事：掉落、宠物、死亡、等级、收集日志格、战斗成就。它们只对运行插件的成员存在，所以掉落频道安静，通常意味着插件安静，而不是 Webhook 坏了。',
      ],
      note: {
        tag: '不会重复发两次',
        body: '一次完成格子的掉落只会发一条，而不是插件发一条、板再发一条。',
      },
    },
    modes: {
      title: 'Leagues、Deadman 及其他模式',
      body: [
        'Leagues、Deadman、hardcore 及其他模式运行在各自的世界中，使用各自的角色。它们的帖子始终带有标识，且从不计入排行榜或比赛。它们有自己的标签页：**Admin → Discord → What goes where → Game modes**。成员首次游玩某模式后，该模式会出现在那里。',
        '每个模式都有一个开关和一个 **To** 频道。开启 **Send game-mode posts to their own channels** 即可使用这些频道；关闭则所有模式都发到普通频道，但仍带有标识。模式行上的 **Posts** 按钮会列出它发送的每种类型（常规类型以及该模式自己的活动），每种都有自己的开关。',
        '在该列表下方，**Custom thresholds** 可让某模式发布的内容少于主游戏。**Post drops rarer than 1 in…**（至少 2）和 **Post drops worth at least (gp)**（至少 1,000）设定各自的下限（留空 = 与主游戏相同），然后按 **Save drop thresholds**：总是发布的物品仍会发布，但只因价值而计入的掉落则不会。**Use its own level milestones** 仅当升级同时符合两套规则时才发布。',
      ],
      note: {
        tag: '只会更严，不会更松',
        body: '模式的过滤器只能减少帖子。插件已经应用了你的主游戏设置，所以模式过滤器无论怎么设，都不能把一条帖子找回来。',
      },
    },
    cleanup: {
      title: '来自其他插件或机器人的旧 Webhook',
      body: [
        '机器人在你的服务器里时，Discord 页面会列出服务器里所有不属于 Anvil 的 Webhook。**Coming from other plugins?** 提供 **Use the same channels**，这样 **Set it up for me** 会发到你旧信息流原来发的地方，你的成员那边什么都不用变。',
        '等你的成员都用上 Anvil 之后，前往 **Remove old webhooks from other plugins**，勾选要删掉的那些，按 **Remove … webhooks**，再按 **Yes, remove them**。这会在 Discord 里把它们永久删除——无法撤销。',
        '这个列表包含任何不属于 Anvil 的 Webhook，而不只是其他插件的。有想保留的，比如另一个机器人的信息流？按 **Keep**，它就离开列表；**Show kept** 和 **Put back** 可以把它找回来。保留只是在这里隐藏它——Discord 里什么都不会变。',
      ],
      note: {
        tag: '需要“管理 Webhook”权限',
        body: '机器人要读取你服务器的 Webhook 才能找到它们。如果它的身份组没有 _管理 Webhook_ 权限，页面会提示它看不到这些 Webhook。',
      },
    },
    announce: {
      title: '发布到 Discord',
      body: [
        '管理员可以在管理菜单 **Clan** 下的 **Post to Discord** 以机器人身份发帖。选一个 **Channel**，写好 **Message**，然后按 **Send message**。较长的文本，比如一本规则手册，会自动拆成几条消息。',
        '**Send as an embed** 默认开启，并增加可选的 **Title** 和 **Accent colour**；关掉它就发纯文本。**Ping** 用来选择要提及的身份组或 @everyone，Anvil 会在发送前先问你一下。',
        '你发出的每条帖子都会列在 **Sent from here** 下。**Edit** 会在 Discord 里修改它而不再次提及任何人，**Delete** 会把它删掉。',
      ],
      note: {
        tag: '仅限管理员，需要机器人',
        body: '它以 Anvil 机器人的身份发帖，所以请先连接你的服务器。版主看不到它。它就是 **Clan settings → Features** 下的 **Post to Discord** 开关；关掉后，它会从菜单中消失。',
      },
    },
    quiet: {
      title: '当它安静下来',
      body: [
        '按顺序来，因为每一条都排除下一条：',
      ],
      checks: [
        {
          term: '机器人真的在服务器里吗？',
          body: 'Discord 页面上的 **Connection** 会直接告诉你。“令牌有效”和“在你的服务器里”是两回事，前者并不蕴含后者——用共享机器人时，令牌永远有效。',
        },
        {
          term: '服务器 ID 对吗？',
          body: '一个错误但真实存在的 ID，看起来和正确的一模一样，直到你发现帖子发去了别处。',
        },
        {
          term: 'Webhook 还在吗？',
          body: '删除 Discord 频道会连同它的 Webhook 一起删掉，而 Anvil 会留着那个失效网址。到 **What goes where** 下重新为它选一个频道。',
        },
        {
          term: '机器人的身份组够高吗？',
          body: '只影响身份组和昵称同步——见上文。这一条是会悄无声息失败的那个。',
        },
      ],
      note: {
        tag: '它无法欢迎新加入的人',
        body: 'Discord 只通过 gateway 连接上报加入事件，而共享机器人不会为每个服务器都保持这种连接。因此没有“欢迎”帖——把报名链接放进 #身份组 或 #从这里开始 频道即可，反正大家本来就看那里。',
      },
    },
    drops: {
      title: '掉落阈值',
      body: [
        'Anvil 默认为 **1m gp** 或 **1 in 1,000**。掉落满足其中任一条件即发布。任何人都不能将数值设得低于这些，设为 0 则关闭该项。',
        '在 **Admin → Discord → What goes where → Drops** 下设置团队默认值：**Default minimum drop value (gp)**、**Default: post drops rarer than 1 in…** 和 **Require both**。开启 **Require both** 后，掉落必须同时满足价值**and**稀有度。',
        '每个角色都遵循其所属团队的默认值，若无团队则遵循 Anvil 的默认值。玩家可以在 **Settings** 中自行设置数值。页面显示 **Using clan default** 或 **Custom**，**Reset** 可恢复默认。',
        '**Hard floor: never post drops more common than 1 in…** 是严格的限制。成员在你团队的频道中不能设得比它更宽松。他们自己的 webhook 则不受此限。',
      ],
      note: {
        tag: '玩家端的更多内容',
        body: '玩家自己的数值、模板和 webhook 见 [Settings, page by page]({settingsGuide})。',
      },
    },
    pools: {
      title: '为繁忙频道添加更多 webhook',
      body: [
        '单个 webhook 的发送速度有限。对于繁忙的活动，请为同一频道添加更多 webhook。按 **Busy channel? Let the bot add … more webhooks**（需要 **Manage Webhooks** 权限），或将多个 webhook 链接粘贴到频道的输入框中。当你有 50 名或以上玩家、每分钟大量发帖，或 Discord 最近提示过 “slow down” 时，Anvil 会建议你添加更多。最多 10 个就足够了。',
        'Anvil 会在它们之间轮流发送。如果 Discord 对某个 webhook 提示 “slow down”，该 webhook 会暂停片刻，由下一个接手发帖。如果某个 webhook 被删除或失效，它会被跳过 10 分钟。只要有一个 webhook 可用，帖子就会持续发出。',
        '所有 webhook 都必须指向同一频道。如果不是，Anvil 会警告你。使用 **Test** 检测某个 webhook，或使用 **Stop posting here** 将其移除。',
      ],
      note: {
        tag: '同一频道，同样的帖子',
        body: '更多 webhook 绝不会重复发帖，它们只是分担工作。相同理念见上方的 [掉落阈值](#drops)，管理员端见 [Running the event]({adminGuide})。',
      },
    },
  },

  plugin: {
    metaTitle: 'RuneLite 插件设置 — Anvil',
    metaDescription:
      '安装 Anvil 的 RuneLite 插件，在它的侧边栏面板里登录，并设置 Discord 通知。',
    eyebrow: 'Anvil · RuneLite 插件',
    title: '玩家设置指南',
    dek: '装上、登录、开玩。插件会提交你的宾果掉落，把稀有掉落、死亡和里程碑发到 Discord，还能让你右键一下就查到任何人。',
    facts: [
      { strong: '一个按钮', rest: '就能开始记录' },
      { strong: '约 3 分钟', rest: '完成基础设置' },
      { strong: '右键', rest: '即可查询任何人' },
    ],
    footnote:
      '截图取自真实的设置环境 —— 账号令牌是刻意打码的。你自己的令牌也应当同样保密。',

    install: {
      title: '安装插件',
      body: [
        '在 RuneLite 中：**Configuration**（扳手图标）→ **Plugin Hub** → 搜索 **Anvil** → **Install**。发布者是 `AhmedFathy2001`。',
        '一个插件服务所有氏族 —— 它始终连接 `anvilosrs.com`，而把它和你、和你的氏族绑在一起的，是登录（下一步）。没有任何与氏族相关的东西需要下载，也没有地址需要填写。装好之后，RuneLite 侧边栏会出现一个 **Anvil** 按钮，设置则在 **Configuration → Anvil** 里。',
      ],
    },

    connect: {
      title: '登录',
      intro: '从 RuneLite 侧边栏打开 **Anvil** 面板，点击 **Sign in with Discord**。浏览器会打开 `anvilosrs.com`；在那里批准验证码，插件就会自己完成登录 —— 不用输入，不用复制，也不用在设置里填写任何东西。',
      panelFigure: {
        caption: 'RuneLite → Anvil 按钮',
        alt: 'RuneLite 的侧边图标栏，最下方的 Anvil 按钮被圈出',
        legend: [
          {
            label: 'Anvil 按钮',
            body: '在 RuneLite 窗口侧边、图标栏的最下方。点击它就能打开面板。插件装好并开启后它就会出现——如果你更想让它靠上，把它往上拖即可。',
          },
        ],
      },
      signInFigure: {
        caption: 'Anvil 面板',
        alt: 'Anvil 面板，其中 Sign in with Discord 按钮和它所连接的站点被圈出',
        legend: [
          {
            label: 'Sign in with Discord',
            body: '只在这台电脑处于登出状态时显示。点它，剩下的都在浏览器里完成。',
          },
          {
            label: 'Connects to',
            body: '始终是 `anvilosrs.com` —— 插件唯一会通信的站点，也是你的令牌所属的站点。',
          },
          {
            label: 'Paste a token instead',
            body: '备用方案，适用于浏览器这一步对你行不通的情况 —— 见本步骤末尾。',
          },
        ],
      },
      easySteps: [
        '点击 **Sign in with Discord**。面板会显示一个短验证码，并在浏览器中打开 `anvilosrs.com`。',
        '如果还没登录，先在那里用 Discord 登录，核对页面上的验证码与 RuneLite 里的一致，然后点击 **Approve**。',
        '回到 RuneLite，面板顶部会显示 _Signed in_ —— 进入游戏后，还会显示它正在追踪哪个角色。就这样。',
      ],
      linkFigure: {
        caption: 'anvilosrs.com → /link-device',
        alt: 'Link your RuneLite client 页面，代码字段与 Approve 按钮被方框标出',
        legend: [
          { label: '那段代码', body: '它必须与插件此刻显示给你的完全一致。' },
          {
            label: 'Approve',
            body: '只批准_你自己_的客户端正在显示的代码。若有人给你发来链接或代码，请拒绝 —— 批准就等于把账号交给对方。',
          },
        ],
      },
      directNote: {
        tag: '这一切发生在哪里',
        body: [
          '整个流程都留在 `anvilosrs.com` —— 验证码在那里签发，你在那里用自己的 Discord 登录批准，令牌直接交回插件。插件只会打开 `anvilosrs.com` 上的登录页面，所以指向其他任何地方的登录链接都不是它发出的。',
        ],
      },
      federationAside:
        '别把它和侧边栏里的 **Connect clans** 弄混 —— 那是另一个可选按钮，用来把你连到其他 Anvil 氏族，而且只有在你已经登录之后才会出现。',
      manualFallback:
        '如果浏览器没有自动打开，面板会把网址和代码打印出来，你可以手动打开。代码十分钟后失效 —— 再按一次按钮即可。',
      manualHeading: '备用办法：手动粘贴令牌',
      manualIntro:
        '如果从插件登录对你不起作用，就复制下面的令牌（或到 [Profile → plugin token](/profile#plugin-token) 复制，那里也可以轮换它），然后在 Anvil 面板中点击登录按钮下方的 **Paste a token instead**，粘贴到那里。',
      tokenFigure: {
        caption: 'Profile → RuneLite plugin',
        alt: '个人资料页上的 RuneLite plugin 卡片，令牌字段与 Reveal、Copy、Rotate 按钮被方框标出',
        legend: [
          {
            label: '你的令牌',
            body: '按下 Reveal 之前一直隐藏。这张截图里是刻意打码的；绝不要把自己的发到 Discord。',
          },
          {
            label: 'Copy / Rotate',
            body: '复制它，然后在 Anvil 面板中使用 **Paste a token instead**。Rotate 会签发一个新的并作废旧的 —— 只要你怀疑令牌外泄就用它。',
          },
        ],
      },
      goodToKnow: {
        tag: '日常使用侧边栏',
        body: ['**Anvil 侧边栏是你的主要工作区**：在这里登录和登出、查看氏族和进行中的活动、浏览并认领格子、跟踪进度、拍摄起始截图、运行同步并打开支持工具。下方的 **Configuration → Anvil** 仅用于调整偏好设置 —— 里面没有令牌。要让这台电脑登出，请打开面板顶部你名字旁边的 **⋯** 菜单。一次登录适用于你报名的所有活动 — 无需为每场宾果重新登录。'],
      },
    },

    accounts: {
      title: '关联你的账号',
      body: [
        '令牌设置完成后，你玩过的账号会自动显示在个人资料中。全新账号可以立即关联；已在公会名单中的账号需要先完成一次所有权验证，因为公开的 RuneScape 名称并不能证明账号属于谁。',
        '首次关联时，请使用[快速 XP 验证](/profile#link-account)，或请公会管理员在[检测到的账号](/profile#detected-accounts)中批准。验证后，稳定的账号指纹会跟随改名，并自动识别该账号。',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: '个人资料页上的 RuneScape Accounts 卡片，列出通过插件验证的账号',
        legend: [
          {
            label: '你已关联的账号',
            body: '标有 “Verified via plugin” 的账号已经关联，之后会被自动识别。已有公会名单的账号可能需要先进行一次 XP 验证或管理员批准。',
          },
        ],
      },
      noPluginHeading: '没法运行插件？',
      noPluginIntro:
        '在手机或官方客户端上，请改用 [Profile → account linking](/profile#link-account)：',
      noPluginOptions: [
        '**Verify by XP** —— 输入你的 RSN，网站随机挑一项技能，你需在 30 分钟内在该技能上获得 1,000 经验。',
        '**Manual review** —— 适用于隐藏了 Hiscores 或全新的小号：提交你的 RSN 并附上说明，由管理员批准。',
      ],
      signupNote:
        '报名活动至少需要一个已验证账号，所以请在报名之前先把这件事办好。',
    },

    working: {
      title: '确认它在工作',
      intro:
        '登录游戏并留意聊天框。插件在连接成功且有活动进行时会向你打招呼。',
      chat: [
        { text: 'Bingo running: Summer Bingo 2026.', tone: 'gold' },
        { text: 'Skill of the Week is live: Runecraft.', tone: 'gold' },
        { text: '……稍后，随着事情发生……', tone: 'muted' },
        { text: 'Tracked drop detected: Dragon warhammer (1/1)', tone: 'plain' },
        { text: 'Tracked kill: Zulrah (7/10)', tone: 'plain' },
      ],
      outro:
        '你还会看到 **Anvil 侧边栏**填入你的氏族、正在进行的活动、你的名次以及同步按钮，并且游戏内 Collection Log 的标题栏上会出现一个 **Anvil** 按钮。',
      guestNote: {
        tag: '访客与成员之别',
        body: '如果聊天里显示 _Tracked as a guest_，说明你已被记录，但还没进入氏族成员名单。管理员同步一次游戏内成员名单即可解决 —— 去{discordLink}问一声。',
        discordWord: 'Discord 里',
      },
      panelHeading: '侧边面板',
      panelBody: [
        '四个标签页和一个齿轮。**Clan** 是你的活动和你的氏族：每一场进行中和即将开始的宾果与每周竞赛，以及你所处的位置。**Feed** 是你的氏族和棋盘上发生的大事，实时滚动，还带活动聊天。**You** 是你自己的资料，**Lookup** 用来查找其他任何人，玩家或氏族都可以。齿轮里是同步和你的横幅提示音。',
        '每个标签页、活动聊天、反应，以及把动态和 Supporter 颜色带进游戏的设置，都在[侧边面板逐个标签页讲解]({panelGuide})里。',
      ],
      panelFigure: {
        caption: 'Clan · You · Lookup',
        alt: 'Anvil 侧边面板的三个标签页并排展示：Clan 标签页显示活动和氏族本周情况，You 标签页显示你的 collection log，Lookup 标签页显示另一名玩家的卡片',
      },
      lookupHeading: '查询任何人',
      lookupBody:
        '右键点击一名玩家 —— 无论是在你身边，还是聊天、好友列表或氏族面板里的名字 —— 选择 **Anvil**，即可在侧边面板的 **Lookup** 标签页中打开其卡片。你自己的就在 **You** 标签页。',
      lookupFigure: {
        caption: '右键点击名字 → Anvil',
        alt: '游戏内玩家右键菜单，Lookup 下方有一个 Anvil 选项',
      },
      lookupSettingNote:
        '在插件设置的 **Player lookup** 中选择 **Anvil** 选项出现在哪些地方。在聊天里的名字上，它永远不会成为左键默认选项，所以点击名字仍然执行游戏原本的操作。',
      lookupSettingFigure: {
        caption: 'Configuration → Anvil → Player lookup',
        alt: 'Anvil 设置中的 Player lookup 区块，每一项设置都被方框标出并编号',
        legend: [
          {
            label: 'Anvil lookup on players',
            body: '总开关。关闭后所有地方都不再显示该选项。',
          },
          {
            label: 'Players in the world',
            body: '右键点击站在你附近的玩家。',
          },
          {
            label: 'Chatbox and private messages',
            body: '聊天框和私聊中的名字。',
          },
          {
            label: 'Clan panels / Friends chat / Friends, ignore and party lists',
            body: '各类名单：你的氏族和访客氏族成员、好友聊天频道、你的好友与屏蔽列表，以及团队副本的队伍面板。',
          },
        ],
      },
    },

    bingo: {
      title: '宾果相关设置',
      intro:
        '这些只在你参加活动期间有意义。默认值就挺好 —— 下面是每一项实际做的事。',
      figure: {
        caption: 'Configuration → Anvil → Bingo',
        alt: '插件设置中的 Bingo 区块，每一项设置都被方框标出并编号',
        legend: [
          {
            label: 'Show Overlay',
            body: '在左上角画一个小小的 _Anvil / 队伍 / UTC 日期_ 面板。它会成为凭证截图画面的一部分，而正是这一点让凭证难以伪造或倒填日期。这张截图里它是关的 —— 如果你的氏族希望每张凭证上都能看到队伍和时间，就打开它。',
          },
          {
            label: 'Team completion popups',
            body: '队里任何人完成一个格子时弹出横幅。若同时完成多个：最难的那个用横幅，其余进聊天框。',
          },
          {
            label: 'My tile popups',
            body: '你自己的掉落推进或完成一个格子时弹出提示。关闭后仍会照常记录 —— 只是不再提示。',
          },
          {
            label: 'Banner sound + volume',
            body: '在横幅出现时播放声音。在你自己通过 Anvil 侧边栏“Banner sounds”下的 **Add clip** 添加至少一个 .wav 之前，不会有任何声音。 任务有自己的文件夹：在 **Mission sounds** 下添加一个音频，任务就会播放它，而不是用来和完成格子区分开的内置提示音。',
          },
          {
            label: 'Auto starting shot',
            body: '你一站到活动固定的地点，就自动替你拍下开赛照。关闭后需要你自己在侧边栏按 **Take starting shot**。',
          },
        ],
      },
      teamsHeading: '队伍',
      teamsBody:
        '活动上的 **Teams** 按钮会按排名列出它的所有队伍，你的队伍置顶。打开一支队伍可查看其成员名单，队长排在最前；也可以在所有队伍中搜索某名玩家 —— 点击名字即可查询。',
      teamsFigure: {
        caption: '活动 → Teams',
        alt: 'Teams 页面列出一场活动的各支队伍及其积分和成员数，旁边是一支队伍的成员名单，队长排在最前',
      },
      startHeading: '开赛照',
      startBody: [
        '有些活动要求所有人交一张**开赛照**：在活动正式开始之后拍摄的一张截图，地点在开赛那一刻随机抽取。这能阻止有人在赛前一周囤积线索卷、宝箱和击杀，然后在第一天一次性倾倒出来。',
        '如果你在跑插件，没有任何需要准备的。活动开始时你会收到一行聊天提示告诉你去哪里，Anvil 侧边栏会出现 **Take starting shot** 按钮。站到指定位置，按一次，就完成了 —— 插件会拍下画面，在上面盖上你的 RSN、队伍、地点以及一个只有你的账号才会拿到的口令，并替你归档。',
        '在归档之前它会检查两件事，好让你在游戏里就把问题解决，而不是事后在 Discord 上吵。如果主办方在地图上钉了具体位置，插件知道你离得有多远并会提醒你，而不是从 Gielinor 的另一头发一张照片过去。另外，如果活动要求新开的会话，你必须在拍照前**退出再重新登录**：你的 hiscores 只在退出登录时保存，因此拍照前重登一次，才能让你的起始数值 —— 进而让每一个经验与击杀数格子 —— 是准确的。',
        '在手机上，或者没有插件时：在本站打开 **My Team**，从开赛照卡片上读到你的口令，把它打进游戏聊天框，截一张同时能看到你的角色和口令的图，然后在同一张卡片上上传。这次上传会立刻生效 —— 传上去你就能开始玩，管理层事后再复核。如果卡片提示你需要，请先退出再登录。',
      ],
    },

    notifications: {
      title: 'Discord 通知',
      intro:
        '无论是否有宾果在进行，这些都会发出，并且发到氏族的频道里。发到哪个频道由管理员在这里决定 —— 你只选择_发什么_。下一次插件更新后，这些选择会移到网站的 **Settings → Discord posts & screenshots**，在任何电脑上都一样。同一页面的 **Screenshot privacy** 可以选择在插件拍摄的每张截图中隐藏哪些聊天（私信、公共聊天、部落聊天）。插件在 **Notifications** 下保留两个开关：**Share clan posts** 一次性暂停所有主游戏的帖子，**Share seasonal activity** 在 Leagues、Deadman 等季节性世界做同样的事。',
      examplesFigure: {
        caption: '一条帖子的样子',
        alt: 'Anvil 发出的两条 Discord 帖子：一条是 Grandmaster 战斗任务，附有积分和距下一次解锁的进度；一条是死亡记录及其消息，各自附有当时的截图',
      },
      dropsFigure: {
        caption: 'Deaths & kills · Drops & pets',
        alt: 'Deaths and kills 与 Drops and pets 两个通知区块，每一项设置都被方框标出并编号',
        legend: [
          {
            label: 'Notify on death',
            body: '在你死亡的那一刻，附带截图发送到团队死亡频道。',
          },
          {
            label: 'Death message',
            body: '你自己的文字。`{name}` 会被替换为你的 RSN。',
          },
          {
            label: 'Notify on PvP kill',
            body: '目标生命值降至 0 的那一 tick 的截图。默认关闭；此处已开启。',
          },
          {
            label: 'Notify on rare drops',
            body: '掉落帖子的总开关。',
          },
          {
            label: 'Min drop value / Min drop rarity',
            body:
              '掉落物价值不低于此数（GE 或高价炼金中较高者）或稀有度高于 1/N 时发布。Anvil 默认为 1m 和 1/1,000。你的团队可以为成员设置自己的默认值，在你自己设置数值之前，你会遵循团队的设置；**Reset to clan default**（若无团队则为 **Reset to Anvil default**）可恢复为遵循团队设置。团队还可以设置硬性稀有度下限，它只作用于该团队自己频道中的帖子。你的数值在那里不能比它更宽松，并且它从不改变价值限制。将任一数值设为 0 即可关闭。',
          },
          {
            label: 'Value and rarity together',
            body:
              '默认情况下，掉落满足价值**or**稀有度即发布。开启 **Require both** 后，必须同时满足价值**and**稀有度。你的团队可以为成员选择此默认值；在你自行选择之前，你会遵循它，若无团队则满足其中一项即可。你自己的每个 webhook 也可以设置各自的最低价值、稀有度以及 either/both（任一/两者）；留空的项遵循你的设置。',
          },
          {
            label: 'Loot key value',
            body: '当一把 loot key 的全部内容达到此数值时，它会作为一条通知发布一次。',
          },
          {
            label: 'Notify on pets',
            body: '宠物发布到稀有掉落频道。',
          },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · collection log · levels · diaries · quests',
        alt: 'Combat achievements 通知区块，每一项设置都被方框标出并编号',
        legend: [
          {
            label: 'CA post tier',
            body: '会播报的最低任务层级；完成整个层级时也会播报。默认是 Master；Grandmaster 只播报最稀有的，**Off** 则一条都不发。无论如何，宾果的 CA 格子都照常计数。',
          },
          {
            label: 'Notify on collection log slots',
            body: '每个新解锁的 collection log 格位。',
          },
          {
            label: 'Notify on level milestones',
            body: '你的氏族选择播报的升级 —— 默认是 99 级、从 1800 起每 100 总等级，以及满级。规则由氏族管理员设定；你可以在个人资料的 Announcements 中少发一些（或为你的个人 webhook 设定自己的规则）。',
          },
          {
            label: 'Notify on diary completions',
            body: '成就日记的各个层级，附带截图。',
          },
          {
            label: 'Quest post tier',
            body: '你选定难度及以上的任务，从 All（所有任务）到 Grandmaster；**Off** 则一条都不发。默认是 Master。无论如何，宾果的任务格子都照常计数。',
          },
        ],
      },
    },

    trouble: {
      title: '出问题的时候',
      intro:
        '记录中断时插件会在聊天里告诉你 —— 它会先等大约 90 秒才抱怨，并且最多每 5 分钟重复一次。',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: '令牌不对或已被轮换。打开 Anvil 面板顶部的 **⋯** 菜单，点击 **Sign out**，然后再点 **Sign in with Discord** —— 或者用 [Profile → RuneLite plugin](/profile#plugin-token) 里的新令牌，通过 **Paste a token instead** 粘贴。',
        },
        {
          term: '`Anvil: can’t reach the site (anvilosrs.com) — tracking is OFF.`',
          body: '插件连不上 `anvilosrs.com`。检查你的网络连接，以及可能拦截 RuneLite 的防火墙或 VPN。如果这些都没问题，多半是站点暂时挂了 —— 插件会自己重新连上。',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: '该账号尚未关联。打开 [Profile → 检测到的账号](/profile#detected-accounts)以添加它或开始所有权验证。',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: '什么都不用做。它自己恢复了。',
        },
        {
          term: '“<RSN> belongs to another Anvil player”',
          body: '别人先在 Anvil 上关联了这个角色，所以你登录时它的任何进度都不计数。如果它真的是你的，在面板的 **You** 标签页按 **This is my account**，并通过一个简短的 XP 检查。之后会询问当前所有者，或由 Anvil 工作人员决定。你永远不会知道对方是谁。在 [Settings → Ownership claims](/settings/claims) 里跟进进度。',
        },
      ],
      logHeading: '还是不行？给管理员发一份日志',
      logBody:
        '把你的 RuneLite 日志发给管理员：就是你用户文件夹下 `.runelite/logs` 文件夹里的 `client.log`（在 Windows 上，把 `%USERPROFILE%\\.runelite\\logs` 粘贴到文件资源管理器的地址栏）。插件会把它看到了什么、为什么这么做写进去，这样他们就能看到究竟哪里出了问题。',
      missingNote: {
        tag: '凭证不见了？',
        body: '宠物和重复的 Champion’s scroll 需要手动截图。插件会替你截好并保存到 `.runelite/osrs-bingo-pending/`（Anvil 侧边栏的 **Copy folder path** 可以打开该文件夹），你在网站上直接附加即可，不必事后再去翻找图片。',
      },
    },
    limits: {
      title: '已知限制',
      intro:
        '有几样东西无法被完美记录 —— 几乎总是因为游戏本身上报的内容，而不是 Anvil。解决办法每次都一样：截图并手动提交。',
      rows: [
        {
          term: 'Barraging 与其他多目标击杀',
          body: '击杀数（KC）来自游戏对每次击杀的上报，而 Ice Barrage 这类多目标法术会让它漏掉一部分，所以**KC 可能比你实际击杀的少**。RuneLite 自带的 Loot Tracker 也会以同样的方式少计 —— 这是游戏引擎的限制，不是 Anvil 的 bug。',
        },
        {
          term: '你以前完成过的 Combat Achievements',
          body: '在游戏的 Combat Achievements 设置中打开 **repeat completion**（重复完成）。不开的话，游戏不会提示你已经完成过的任务，而插件只能记入游戏提示过的内容。',
        },
        {
          term: 'Yama 契约 Combat Achievement',
          body: '即使开了 repeat completion，游戏也不会再次提示这一项，所以插件永远看不到它。截图并手动提交。',
        },
        {
          term: '没有插件时的采集格',
          body: '物品数量 —— 若干条鱼、矿石、原木 —— 不在 hiscores 上，所以只有插件能记录。没有插件的话，请给每个背包截图；或者，如果该物品出现在 Loot Tracker 里，开始时截一张重置为 0 的图，结束时再截一张。',
        },
        {
          term: 'Implings、鱼、矿石及其他物品收益',
          body: '捕捉 implings 和采集物品（鱼、矿石，以及任何按进入背包的物品计数的东西）**即使有插件，有时也无法正确记录**。请一路保留截图，如果数量看起来偏少，请反馈并手动提交差额。',
        },
        {
          term: '鱼桶、木材篮和其他储物',
          body: '物品获取格子只计算**直接从来源**进入背包的物品——钓鱼点、矿石、树木。从储物中取出的（清空鱼桶、木材篮、煤袋或宝石袋、草药袋）、在商店购买的、从银行取出的或从地上捡起的**都不计算**。这样格子才公平：否则同一条鱼可以无限次装进鱼桶再倒出来。直接收进鱼桶或篮子里的收获不会被计算。',
        },
        {
          term: "重复的宠物和 Champion's scroll",
          body: '如果你已经拥有该宠物或卷轴,游戏只会说你有一种 **“funny feeling”**——从不说明是哪一个。插件会根据你刚击杀的怪物或刚练的技能推断出来,完成该格子,并**标记给工作人员审核**。如果无法确定——同一来源有两种宠物,或宠物与击杀或技能无关(大师线索的 Bloodhound、赌来的 Jad 或 Zuk 宠物、Chompy chick)——截图会保存到 **Saved proofs**,由你手动提交。',
        },
      ],
    },
    screen: {
      title: '游戏时屏幕上的内容',
      intro: '插件在你游戏时绘制和打印的内容，以及每项背后的设置。',
      rows: [
        {
          term: '固定的格子',
          body: '在侧边栏中打开一个格子，然后按 **Track on screen**（最多 3 个）。开启 **Pinned tiles in one panel** 后，它们共用一个小面板：每个格子的名称、你的队伍进度，以及像 _3/5 runs_ 这样的行，或组合技中哪些部分已经完成。关闭时，每个格子各有一个更大的小部件，显示你的队友和其他队伍。按住 Alt 拖动即可移动。右键可选择 **Unpin** 或 **Unpin all**。完成的格子会显示 **Done**，然后自动取消固定。',
        },
        {
          term: '起跑信号卡片',
          body: '当一场活动正在等待你的起跑信号时，屏幕顶部的 **Starting shot needed** 卡片会说明该去哪里，并以绿色或红色显示每项检查：重新登录、你的会话时长、你离出发点还有几格。提示箭头和世界地图标记（**Anvil starting shot**）会引导你过去。开启 **Auto starting shot** 后，一旦所有项都变绿，就会自动起跑；随后卡片会显示 **You’re tracked** 并消失。设置项：**Starting shot guide**。',
        },
        {
          term: '横幅',
          body: '你的队伍完成一个格子时显示 **Tile complete!**，你自己的掉落在某个格子上的进度，以及 **New mission!**。设置项：**Team completion popups** 和 **My tile popups**。',
        },
        {
          term: 'Vestige 掷骰',
          body: '在 Desert Treasure II 的首领处，每个 unique 都会打印一行，显示你在 vestige 轮换中所处的位置，例如 _Roll 2 of 4_ 或 _the next unique is the vestige_。在它见过你获得一次 vestige 之前，会显示 _(estimated)_。没有设置项；无论是否有活动都会运行。',
        },
        {
          term: 'Lookup 自动补全',
          body: '在 **Lookup** 框中输入时，会根据你最近的查询、好友、在线的氏族成员和附近的玩家帮你补全名字。按 **Enter** 确认。它只读取你自己客户端的数据，不会发送任何内容。',
        },
        {
          term: '聊天颜色',
          body: '**Chat messages** 下的 **[Anvil] tag colour** 和 **Message colour**。在你选择之前，它们会在不透明的聊天框上显示为深金色和黑色，以保证可读性。将鼠标悬停在聊天中某个 Supporter 的名字上，即可看到其档位，例如 _Anvil Patron_。',
        },
      ],
    },
    sync: {
      title: '资料同步，以及它还会发送什么',
      intro: '**Profile sync** 设置会填充你的 Anvil 资料。四项默认全部开启：',
      rows: [
        {
          term: '同步收藏册',
          body: '你打开的每一页收藏册都会发送到你的资料中。',
        },
        {
          term: '打开时同步整本收藏册',
          body: '打开收藏册会发送整本，而不只是你正在看的那一页。若要按需同步，请按收藏册标题栏上的 **Anvil** 按钮，或在收藏册打开时按侧边栏中的 **Sync profile**。聊天会确认：_Profile synced — N collection log slots._',
        },
        {
          term: '同步个人最佳',
          body: '首领和团本的时间会在你设定时发送。',
        },
        {
          term: '一次性导入已有的最佳',
          body: '每个角色一次，复制 RuneLite 已经保存在你电脑上的个人最佳：_Imported N personal best(s) from RuneLite._',
        },
        {
          term: '与氏族分享亮点',
          body: '你的宠物、大额掉落、死亡、战斗任务、等级里程碑、新的收藏册格子、日记和任务，会出现在你氏族网站的动态中，以及能看到它们的玩家的聊天动态中。新的收藏册格子、日记和任务也会出现在你所在的每个进行中看板的动态中。',
        },
      ],
      outro: '另外还有三项无需单独设置即会发送的内容。**Who killed you**：你最后 15 秒内被你锁定的怪物或玩家，会在动态中被列出。**Game counters**：某些击杀格子会计入游戏自己记录的数字，例如 Tithe Farm 积分、Giants’ Foundry 声望、Doom 深渊或 slayer 连胜；只计上升。**Leagues、Deadman 及其他模式**：在这些世界中，游戏自己关于遗物、区域和任务的消息会被发送，以便你的氏族在其模式频道中发布。',
    },
  },

  admin: {
    metaTitle: '如何办好你的第一场活动 — Anvil 管理指南',
    metaDescription:
      '在 Anvil 上把一个氏族配置好，并把一场宾果从头跑到尾：Discord、成员名单、棋盘、格子、队伍与选秀、开赛，以及活动结束后会发生什么。',
    eyebrow: 'Anvil · 面向氏族管理层',
    title: '如何办好你的第一场活动',
    dek: '完整的路径，按你实际会走的顺序排列：把 {clanName} 配置好、把成员名单导进来、搭一块棋盘、选秀分队、开赛，然后发奖。第一场宾果大约要花一个晚上 —— 第二场只要几分钟。',
    facts: [
      { strong: '5 个步骤', rest: '在设置清单里' },
      { strong: '7 种赛制', rest: '可用来搭棋盘' },
      { strong: '1 个按钮', rest: '就能同步成员名单' },
    ],
    footnote:
      '本指南以今天发布的版本为准。如果这里的某个界面和你眼前看到的对不上，那是应用没错、指南过时了 —— [告诉我们](/feedback)，我们会修。',

    access: {
      title: '谁能做什么',
      intro:
        '所有人都用 Discord 登录 —— 没有密码。第一位管理员就是所有者，也就是创建氏族的人；之后由管理员在 **People → Staff & roles** 中提升他人。角色是向下叠加的：管理员（moderator）能做的一切，司库和 admin 也都能做。',
      rows: [
        {
          term: 'Admin',
          body: '完全权限 —— 活动、格子、队伍、设置、人员、奖金。请把它交给氏族能容忍的最少人数。',
        },
        { term: 'Treasurer', body: 'moderator 能做的一切，外加报名费与奖金发放。' },
        {
          term: 'Moderator',
          body: '日常事务：成员名单、验证、待核查的凭证、每周竞赛、日程和氏族日历活动。不能创建或编辑活动。',
        },
        {
          term: 'Editor',
          body: '只能编写格子。可以全局授予，也可以限定到特定棋盘，这样一位受邀的外部棋盘搭建者就只能碰你交给他的那一场活动。',
        },
        { term: 'Member', body: '只参与游戏；完全看不到任何管理界面。' },
      ],
      seeAlso:
        '其中两个角色有自己的页面：[当班]({moderatorGuide}) 讲管理员一个晚上到底在做什么，[报名费与奖金发放]({feesGuide}) 是给司库看的。',
      ownerNote: {
        tag: '所有者',
        body: '有一个账号是所有者。其他任何人都无法降低它的权限，而且它是唯一能把所有权移交出去的角色 —— 所以和另一位 admin 吵输了，永远不会让你失去这个氏族。',
      },
    },

    setup: {
      title: '给氏族起名，接上 Discord',
      intro:
        '**Settings → Finish setup** 是一个简短的向导（在你完成之前它会一直留在菜单里），仪表盘也会把这五项当成清单保留到它们完成为止：给氏族起名、接上 Discord、载入成员、创建活动、添加格子。状态是按真实数据算出来的，因此某一步只有真正完成时才会被勾掉。',
      discord:
        'Discord 有两条路，而且可以叠加：给 Anvil 一个**机器人**，它就能创建 webhook、同步身份组和昵称、并为你搭建私密的队伍频道；只给它一个 **webhook 网址**，它就只能发公告、别的什么都做不了。想两分钟内跑起来就先用 webhook，等你需要自动化时再把机器人加上。',
      permsNote: {
        tag: '机器人权限',
        body: '机器人需要 _管理 Webhook_、_管理身份组_、_管理频道_ 和 _管理昵称_ 权限，而且它的身份组在你服务器的身份组列表里必须排在它所管理的那些身份组_之上_。否则 Discord 会悄无声息地拒绝。',
      },
      hosted:
        '在托管方案下你已经见过那个界面一次了：设置过程中添加机器人，正是 Anvil 得知哪个服务器是你们的方式，所以从来就不存在什么服务器 ID 需要复制。想把机器人搬到另一个服务器时，同一个链接就在这里。',
    },

    channels: {
      title: '把播报分散到多个频道',
      body: [
        '默认情况下所有内容都发到一个总频道。等它变吵了，打开 **Discord → What goes where**，给那些吵闹的类别各自安个家 —— 活动帖子、每周竞赛、稀有掉落、死亡、PvP 击杀、combat achievements。任何留空的类别都会回落到它的总频道，所以你可以一次只分出一个类别。',
        '连上机器人后你永远不用碰 webhook 网址：在那一行的下拉菜单里选一个频道，就会自动保存。活动很热闹时，你可以用 **Post without a bot** 下的 **Add another** 再加一个 webhook —— Anvil 会在它们之间轮换，免得 Discord 的速率限制吞掉帖子。',
      ],
      clipsNote: {
        tag: '片段频道不一样',
        body: '片段视频是从每位玩家自己的电脑直接上传到 Discord 的 —— 它们从不经过本站。因此你在这里设置的片段 webhook，是你要_发出去_的那一个：成员们自己把它粘进插件。本页其他所有内容都在服务端进行，成员永远看不到。',
      },
    },

    roster: {
      title: '把成员名单导进来',
      body: [
        '氏族成员资格只有一个来源：从游戏内同步一次成员名单。在一位_管理员_的账号上安装 [Anvil 的 RuneLite 插件]({pluginGuide})，在游戏里打开氏族窗口，然后按标题栏上的 **Anvil** 按钮。这会一键把你们真实的游戏内氏族名单推送到网站。',
        '登录、关联角色或带着插件游玩，都不会把任何人放进名单。如果插件看到有人在你们的游戏内氏族里游玩、而名单上还没有他，它会提交一份加入申请；其他人可以在你们的氏族页面上用 **Apply** 申请。管理团队在 **People → Roster** 顶部处理申请，而 **People → Who can join** 决定大家是等一个「同意」、直接拿到访客席位，还是根本不能申请。这是有意为之：没有人能靠输入氏族名就加入你们。完整说明见[你的成员]({peopleGuide})。',
        '你也可以在 **People → + Add Manually** 里手动添加某人；在他们无法访问网站时，还可以在活动的 **Sign-ups** 页面用 **Add member** 代为报名。',
      ],
    },

    board: {
      title: '创建你的第一块棋盘',
      intro:
        '**Events → All events → + New event**。先选赛制 —— 它决定棋盘如何计分，以及表单接下来会问你什么。',
      formats: {
        classic: {
          label: '经典宾果',
          blurb: '一块 N×N 的方形网格 —— 队伍可以按任意顺序完成格子，每格算 1 分。',
        },
        leagues: {
          label: 'Leagues 宾果',
          blurb: '一份任务清单，每个格子带有各自的分值 —— 格子数量不限。',
        },
        race: {
          label: '格子竞速',
          blurb: '一条有序赛道 —— 队伍按顺序抵达各格；走得最远的获胜。 主办方可以把它分成会分岔和汇合的路线 —— 完成哪一格就走哪条路。',
        },
        showdown: {
          label: 'Showdown',
          blurb:
            '格子在各自预定的时刻之前一直隐藏 —— 在 Tiles 标签页里设定每一格的开放时间。按分数计，DMM All Stars 风格。',
        },
        luckydraw: {
          label: '幸运抽取',
          blurb: '像宾果报号员：隐藏的格子按固定间隔随机抽取后开放。按分数计。',
        },
        bounty: {
          label: '悬赏',
          blurb:
            '同一时间只开放一个格子 —— 第一支完成的队伍拿走分数，随即抽出下一个悬赏。',
        },
        ladder: {
          label: '天梯',
          blurb:
            '一份按分数计的任务清单，以个人排行榜形式呈现（队伍可选）。任务会轮换 —— 渐进式、一次一个，或滑动窗口 —— 并且可能贬值。类似月度天梯的味道。',
        },
      },
      outro:
        '接着设定日期、报名窗口，以及报名是否收费。如果你不想从空网格开始，就从模板起步 —— 模板库里既有内置模板，也有你之前存过的任何一块棋盘。',
      seeAlso:
        '赛制只是决定的一半 —— 格子如何变得可玩是另一半，两者会叠加。两者的完整说明：[赛制，以及格子如何开放]({formatsGuide})。',
      utcNote: {
        tag: '日期一律用 UTC',
        body: 'Anvil 中的每个时间戳都以 UTC 存储和比较，并按每位访客的本地时间显示。设你真正想要的结束时间；同一个时刻，网站会给英国人和澳大利亚人显示两个不同的钟点。',
      },
    },

    tiles: {
      title: '把棋盘填满',
      body: [
        '活动的 **Board & tiles** 页面，就是一块棋盘变成宾果的地方。每个格子是一_种_任务，而这个种类决定了插件盯着什么：一次掉落、一个 boss 击杀数、技能经验、一次 NPC 击杀、限时通关、成就日记、Combat Achievement、收藏日志解锁、PvP 击杀、物品获取，或一次零死亡的通关。手动格子 —— 由人依据截图核验的那种 —— 也始终是可选项。',
        '要填满整块棋盘，请批量编写：导出表格，在表格软件里填好，再导回来。CSV 与 .xlsx 都能双向往返，而且行与位置一一对应，所以你可以一次粘贴就把整块 25 格的网格重写一遍。',
      ],
      rows: [
        {
          term: '难度档位',
          body: '分值会映射到有名字的档位（easy → elite）。如果你的氏族有不同的分级习惯，可以在 **Clan settings → Rules & scoring → Difficulty & balance** 里编辑这些档位。',
        },
        {
          term: '平衡审核器',
          body: '在玩家看到之前，先检查一块完成的棋盘有没有结构性问题和明显失衡的投入。',
        },
        {
          term: '公布前保持隐藏',
          body: '新棋盘一开始是隐藏的。管理层始终看得到；玩家在你公布之前什么都看不到 —— 所以棋盘完全可以在明面上搭建而不被剧透。',
        },
      ],
      seeAlso:
        '该用哪种格子、如何在表格里写出两百个，以及那些导入得干干净净却永远不会触发的错误：[做一块会自己记账的棋盘]({boardGuide})。',
    },

    teams: {
      title: '队伍与选秀',
      body: [
        '**Teams & draft** 页面会随你选的赛制变化：不使用队伍的赛制会直接跳过它。对于普通的团队宾果，你创建队伍、决定谁当队长，然后要么自己分配玩家，要么开一场实时选秀。',
        '队长们按你指定的顺序从报名池里挑人，并且每位队长都能看到大家在报名表里填的答案 —— 这些答案在提交那一刻就被冻结，所以没人能在被选中之后改自己的「每周时长」。',
      ],
      placementIntro:
        '你不一定要选秀。创建表单和 **Sign-ups** 标签页里的 **Team placement** 决定每个新报名的人进哪里：',
      placementRows: [
        {
          term: 'Auto-balance',
          body: '每个报名的人都会加入人数最少的队伍。你只需要决定有几支队伍。适合大型公开活动。',
        },
        {
          term: 'Players pick',
          body: '你先建好队伍，每位玩家在报名表上自己选一支。给每队设个上限，人数就能保持均衡。',
        },
        {
          term: 'Host drafts',
          body: '所有人都在池子里等，直到你或你的队长通过选秀挑走他们，或者手动分配。最适合你认识这些玩家的时候。',
        },
        {
          term: 'Solo',
          body: '完全没有队伍。每位玩家各自为战，以自己的角色名显示，排名也按玩家来排。',
        },
      ],
      lockNote: {
        tag: '选秀会锁死名单',
        body: '选秀一旦开始，队伍集合与挑选顺序都会被冻结。忘了加的那支队伍要在你按下开始_之前_加，而不是之后。',
      },
      seeAlso:
        '在选秀夜之前把[队长指南]({captainGuide})发给你的队长们 —— 作战室最有价值的时候是前几天，没人会在计时器跑着的时候读一块新界面。',
      visitingClans:
        '你们是在和另一个氏族对抗，而不是给自己人选秀？来访的一方通过一条链接自行组队，他们的管理员不用在这里拥有 admin 账号也能打理 —— 参见[接待一个来访氏族]({clanVsClanGuide})。',
    },

    launch: {
      title: '开赛并运行',
      body: [
        '先公布格子，再开始活动。Anvil 会拒绝启动尚未就绪的棋盘 —— 选秀还在进行中，或者有玩家没队伍 —— 并告诉你是哪一种。如果你确定自己有道理（一场友谊赛、一次重跑、一块你正在测试的棋盘），可以强制开始。',
        '之后它基本上会自己运转。插件会自动为它能看到的一切记账，并发出盖有队伍与 UTC 时间戳的凭证截图。落到你手上的是：',
      ],
      rows: [
        {
          term: '待核验的提交',
          body: '手动格子，以及插件标记出来的一切。凭证就在眼前，通过或拒绝。',
        },
        {
          term: '统计',
          body: '活动的 Stats 标签页会显示每位玩家的贡献 —— 当队内争论谁带了谁时很有用。',
        },
        {
          term: '公告',
          body: '**Post to Discord**（在菜单的 **Clan** 下）能在活动进行中以机器人身份往任意频道发一条消息，不用你自己手写 webhook。',
        },
      ],
      missionNote: {
        tag: '活动中途的惊喜',
        body: '你可以往进行中的宾果里丢一个**任务** —— 一个隐藏的加分格子，在你触发时才公布，还可以让它随时间贬值或过期。这是第五天把棋盘唤醒的最省事的办法。',
      },
      startProofNote: {
        tag: '阻止赛前囤积',
        body: [
          '打开 **Starting shot**（活动 → Home → **Extras**），每位玩家就必须提交一张在开赛之后拍摄的截图，地点由 Anvil 在开赛那一刻抽取 —— 这样就没人能在零点坐拥一周攒下的线索卷和宝箱。地点随开赛一同公布；每位玩家的口令都是个人专属、由抽取结果推导而来，并且在活动开始前根本不存在，因此任何人都无法提前布置。',
          '把这些地点钉在世界地图上（地点池编辑器自带一个），插件就会检查玩家是否真的站在那里，而不是仅仅被口头告知。你还可以要求**新开的会话** —— 默认 15 分钟：hiscores 只在玩家退出登录时保存，所以让所有人在拍照前重登一次，才能让每个经验与击杀数格子背后的起始数值是诚实的。',
          '用插件的人按一个按钮就好。其余的人在游戏里打出自己的口令，然后在 My Team 上传。至于没交的人所产生的记账怎么处理，由你决定：标记待审（默认），或者在他们交上来之前一律拒绝。活动 Home 上的同一个面板就是待审列表 —— 带有已验证口令的插件截图会以「已接受」的状态到达，所以实际上你只需要过一眼手机玩家。',
        ],
      },
    },

    after: {
      title: '最后一个格子之后',
      intro:
        '时间一到，棋盘冻结、活动上锁 —— 分数、贡献和谁做了什么都会按当时的样子冻结。如果事后需要修正，管理员可以有意地解锁。',
      rows: [
        {
          term: '奖金发放',
          body: '活动的 **Prizes** 页面会把奖池变成一份「谁拿多少」的名单，并在你发放的过程中逐条勾掉。',
        },
        {
          term: '总结',
          body: '一个公开的总结页面，包含最终排名和赛后奖项 —— 最大的掉落、最多的击杀，以及其他。',
        },
        {
          term: '问卷',
          body: '问问氏族大家怎么想。在 Survey 标签页里搭建；玩家在活动结束后作答，只有管理层能看到结果。',
        },
        {
          term: '存为模板',
          body: '在活动的 **Settings → More** 里，把你刚搭好的这块棋盘留下来。下一场宾果就从它开始，而不是从空网格开始。',
        },
      ],
      federation:
        '开启联合之后，成员还可以从插件里连接到其他 Anvil 氏族 —— 对跨氏族活动很方便，而且完全由每位成员自行选择。',
      outro: '之后把成员们指向[玩家设置指南]({pluginGuide})，然后开始筹备下一场。',
    },
    survey: {
      title: '询问玩家',
      intro: '在 **Features** 下开启 **Post-event survey**，然后打开活动的 **Survey** 页面。',
      body: [
        '在 **Build** 下添加问题：**Rating (1–5)**、**Free text**、**Choose one** 或 **Choose many**，每题可选是否设为 **Required**。也可以加载模板：**Bingo wrap-up**、**Quick pulse**、**PvM mass**、**Raid team** 或 **Skilling / social**。**Preview the participant view** 会按玩家看到的样子展示。',
        '问卷在活动结束时开放，仅对已通过的参与者开放，他们之后仍可修改答案。**Results** 可按 **By question** 或 **By person** 显示答案。它不是匿名的：工作人员能看到谁说了什么。',
      ],
    },
  },

  clanVsClan: {
    metaTitle: '接待一个来访氏族 — Anvil 主办方指南',
    metaDescription:
      '在 Anvil 上办氏族对抗赛：给每个来访氏族一条邀请链接，把他们的玩家安排进同一支队伍，再给一个席位让他们自己的管理员打理自己那一半。',
    eyebrow: 'Anvil · 面向主办方',
    title: '接待一个来访氏族',
    dek: '棋盘由你主办；人由他们出。这条路能免去在私信里收集十几个 RSN —— 每队一条链接，再加一个让他们自己的管理员打理他们那一半活动的席位。',
    facts: [
      { strong: '1 条链接', rest: '对应一支来访队伍' },
      { strong: '0 个管理席位', rest: '交到外部人手里' },
      { strong: '约 5 分钟', rest: '每邀请一个氏族' },
    ],
    footnote:
      '截图取自测试棋盘上的真实设置 —— 邀请令牌和 Discord 用户名都已打码。真正的链接值得看紧：只要它还有效，拿到它的任何人都能在那支队伍里占一个位置。',

    teamCompsLine: "想让 clan 改为在技能或 Boss 上竞争？请参阅 [团队竞赛]({teamCompsGuide})。",

    shape: {
      title: '你正在搭建的东西',
      body: [
        '氏族对抗赛就是一场普通活动，只有一点不同：一半的玩家不在你的氏族里，而且永远不会在。他们没法通过名单同步进来，你也不想提升他们，更不想手动给二十个人报名、再把每个人一个个拖进正确的队伍。',
        '有两块东西能解决这件事，而且它们相互独立 —— 用其中一个，或者两个都用。',
      ],
      rows: [
        {
          term: '一条邀请链接',
          body: '你为某一支队伍生成一次的网址。打开它的人照常登录、填写常规报名表，然后直接落进那支队伍且已通过审核 —— 不进选秀池，不排审批队列。',
        },
        {
          term: '一个队伍管理席位',
          body: '一位具名的人，可以只打理_那一支队伍_ —— 它的名单、它的提交与凭证、它的费用 —— 既不需要在这里有 admin 账号，也不会把队长席位从真正在打的人那里拿走。',
        },
      ],
      note: {
        tag: '邀请不是什么',
        body: '它不是登录，也不是绕过验证的捷径。打开它的人照样要用 Discord 登录，照样需要一个已验证的 RSN，和其他任何报名完全一样。链接唯一决定的，是这份报名归到_哪支队伍_，以及它不需要任何人批准。',
      },
    },

    team: {
      title: '先把队伍建起来',
      body: [
        '打开你的活动，进入 **Teams & draft** 页面。为每个受邀氏族各建一支队伍，并以他们的名字命名 —— 这个名字就是他们的玩家在报名表上看到的，所以「Ironforge」胜过「队伍 2」。',
        '你_不需要_跑选秀。邀请链接和选秀是两种替代方案：选秀是把一个共享的报名池分配出去，链接则是把人直接安排到位。在纯粹的氏族对抗赛里，大多数主办方会把队伍建好、每队发一条链接，然后压根不开选秀。',
        '接着打开队伍本身 —— **Teams & draft → 该队伍** —— 因为接下来两步都在那里进行。',
      ],
      captainNote: {
        tag: '先定队长',
        body: '在把链接发出去之前，先指定来访方的队长，这样队伍页面从一开始就有归属人。指定队长的同时也会把他安排进队伍；如果卡片提示他并不在名单上，就接受它给出的修正。',
      },
    },

    staff: {
      title: '给他们的管理员一个席位',
      body: [
        '队伍页面上的 **Team staff** 面板，就是来访氏族自己的管理员开始干活的方式 —— 而你不需要在自己的站点上授予他任何东西。按 **Add someone**，搜索到他，加一条像「Ironforge’s mod」这样的备注，好让下一位 admin 知道他为什么在这里，然后按 **Give a seat**。',
      ],
      figure: {
        caption: '活动 → Teams & draft → 该队伍 → Team staff',
        alt: 'Team staff 面板，已授予一个席位，添加成员的搜索框处于打开状态',
        legend: [
          {
            label: 'Add someone',
            body: '打开搜索。只有至少用 Discord 在这里登录过一次的人才会出现 —— 见下面的说明。',
          },
          {
            label: '那条备注',
            body: '自由文本，120 个字符。写清他们来自哪个氏族。席位在活动结束后仍会留在列表里，而「这人是谁」正是你三个月后会有的疑问。',
          },
          {
            label: 'Remove',
            body: '立刻收回席位。活动结束时就该这么做 —— 席位不会自己到期。',
          },
        ],
      },
      canDo: '一个席位能做什么，且只限于那支队伍：',
      canDoList: [
        '查看和管理该队伍的名单',
        '处理它的提交与凭证',
        '把它的玩家的费用标记为已付',
        '为它生成邀请链接，前提是你打开了这个开关（下下一步）',
      ],
      cantDo: '它永远做不到什么：',
      cantDoList: [
        '碰任何其他队伍',
        '编辑棋盘或它的格子',
        '进行选秀挑人',
        '在活动开始之后替换任何人',
      ],
      note: {
        tag: '他们必须先在这里登录一次',
        body: '搜索只列出已关联 Discord 的账号 —— 席位挂在一个真正能登录的人身上。所以把来访氏族的管理员请到本站，让他按一次 **Login**，_然后_再授予席位。如果他没出现在搜索结果里，说明那次登录还没发生。',
      },
    },

    link: {
      title: '生成邀请链接',
      body: [
        '仍在队伍页面上，**Invite links** 面板负责生成链接。两个字段决定这条链接承诺了什么，而且它们都把 `0` 理解为「什么都不承诺」。',
      ],
      figure: {
        caption: '活动 → Teams & draft → 该队伍 → Invite links',
        alt: 'Invite links 面板，含席位与过期字段、Make a link 按钮，以及列表中一条有效链接',
        legend: [
          {
            label: 'Seats 与 Expires in hours',
            body: '这条链接最多能安排多少人（上限 100），以及它保持有效多久（上限 30 天）。把席位数设成对方承诺的阵容规模，人到齐后链接就会自动关闭；当链接要发进公开的 Discord 时就设一个过期时间。任一字段填 `0` 表示不设限。',
          },
          {
            label: 'Make a link',
            body: '生成链接并立刻复制到你的剪贴板。先把它发给对方，再去做别的事。',
          },
          {
            label: '有效链接列表',
            body: '这支队伍在外的每一条链接，附带已加入人数和剩余席位。**Copy** 可以再复制一次；**Turn off** 会彻底作废它。',
          },
        ],
      },
      shape:
        '链接长这样：`{origin}/events/{eventId}/join/{token}` —— 一行，可以放心粘进 Discord 消息。',
      note: {
        tag: '合理的默认值',
        body: '如果这是一场氏族对抗赛，而且你已经和某位管理员谈好了阵容，那就把两个字段都留在 `0`，让他们自己安排。只有当链接要去一个你控制不了的地方时，才动用席位数和过期时间。',
      },
      revoke:
        '关闭一条链接是立即生效的，而且不会移除已经加入的人 —— 他们现在就是那支队伍里的普通玩家。想把某人拿掉，请用队伍名单。',
    },

    captains: {
      title: '让他们自己生成链接',
      body: [
        '默认只有主办方能生成链接，队长尝试时会被明确告知。这个默认值对普通的氏族活动是对的 —— 队长发席位等于在填一份没人批准过的名单 —— 但对氏族对抗赛就是错的，因为来访方比你更清楚自己的阵容。',
        '开关就在同一个 **Invite links** 面板上：**Let captains make their own links**。它作用于_本场活动里的每一支队伍_，而不只是你正在看的这一支 —— 当两边都是来访氏族时，这正是你想要的。',
        '打开之后，该队伍的队长以及任何持有管理席位的人，都能自己从 **My Team → Invite links** 生成链接。他们看到的面板和你的一样，只是少了那个开关。',
      ],
      figure: {
        caption: 'My Team → 该队伍 → Invite links',
        alt: '队伍中心里从队长视角看到的 Invite links 标签页，含席位与过期字段以及一条有效链接',
        legend: [
          {
            label: '同一个面板，队长视角',
            body: '生成、复制、关闭。若主办方没有打开那个开关，这里会写着 “Only a host can make links for this event”，字段也不会出现。',
          },
          {
            label: '有效链接列表',
            body: '即便无法生成链接，队长仍能看到自己队伍在外的那些 —— 这样他就能来找你再要一条，而不是以为一条都没有。',
          },
        ],
      },
    },

    player: {
      title: '他们的玩家看到什么',
      intro:
        '值得在发链接之前自己走一遍，这样别人问起时你答得上来。',
      steps: [
        '他们打开链接。如果尚未登录，会先用 Discord 登录再直接回到这里 —— 链接不会在半路丢掉。',
        '他们会来到那份再普通不过的报名表，上方有一条横幅写着 **You’re joining {teamExample} by invite**。问题一样、账号选择器一样、费用也和其他人一样。',
        '提交之后他们就在那支队伍里，并且已通过审核。主办方不需要做任何事，也不需要选秀。',
      ],
      figure: {
        caption: '通过邀请链接打开的报名表',
        alt: '活动报名表，横幅提示该玩家正通过邀请加入某支具名队伍',
        legend: [
          {
            label: '邀请横幅',
            body: '写明他们即将加入的队伍。如果写的是错的队伍，那就是链接拿错了 —— 提交前先停下来核对。',
          },
          {
            label: '表单的其余部分',
            body: '没有变化。仍然需要一个已验证的 RSN，报名问题照问，报名费也照收。',
          },
        ],
      },
      note: {
        tag: '已经报过名了？',
        body: '如果某人先按常规方式报了名、正待在池子里，那么打开链接会把他移进这支队伍，而不是再建一条报名记录。已经被批准进入另一支队伍的人则不会被动 —— 请改从名单里调整。',
      },
    },

    dead: {
      title: '链接失效的时候',
      intro:
        '被拒绝的链接会在页面上自己说明原因，而不是丢一个 404，所以拿着它的人能告诉你到底是哪一种。',
      rows: [
        {
          term: 'This invite has been turned off.',
          body: '有人按了 **Turn off**。生成一条新的 —— 旧链接不会回来。',
        },
        {
          term: 'This invite has expired.',
          body: '它到了你设定的小时数。再生成一条，如果过期时间没起到作用，这次就填 `0` 小时。',
        },
        {
          term: 'This invite is full.',
          body: '所有席位都占满了。生成一条席位更多的新链接来提高上限 —— 链接一旦存在，席位数就固定了。',
        },
        {
          term: 'Sign-ups for this event aren’t open.',
          body: '唯一一种可能自行恢复的情况。检查活动的报名窗口：是还没开、已过截止，还是活动已经开始了。',
        },
        {
          term: 'That invite belongs to a different event.',
          body: '有人把另一块棋盘的链接粘了过来。核对网址里的活动 id 是不是你想要的那一个。',
        },
      ],
      checklist: '活动开始前，针对每个来访氏族把这份清单过一遍：',
      checklistItems: [
        '他们的队伍已经存在，并且以他们的名字命名',
        '他们的队长已指定并已在队伍里就位',
        '他们的管理员已在这里登录过，并持有一个队伍管理席位',
        '链接已生成、已复制，并且真的送到了某个人手里',
        '报名窗口在他们需要的时间内保持开放',
      ],
      note: {
        tag: '一切结束之后',
        body: '把链接关掉，把队伍管理席位撤掉。这两样都不会自己失效，而已结束活动上仍然有效的链接，只是一根没收好的线头。',
      },
    },
    cohost: {
      title: '如果你是联办方',
      intro: '以上内容都是主办方那一侧的。来访氏族的工作人员会获得自己针对该活动的页面，标题为 **Co-hosted with <host>**。活动日期、草稿、队伍以及谁能看到它，都由主办方决定。',
      rows: [
        {
          term: '你氏族的报名',
          body: '**Approve**、**Reject** 或 **Withdraw** 你自己氏族的玩家。你永远看不到也不能操作主办方的报名。',
        },
        {
          term: '棋盘',
          body: '只有主办方给你的工作人员授权时才能编辑。否则你可以 **Suggest a tile**：提供格子、详情和分值，最多同时有 25 个等待中。每个都会显示为 **waiting**、**accepted ✓** 或 **turned down**，并附带主办方的理由。',
        },
        {
          term: '你的队伍',
          body: '**Manage** 你氏族的队伍。',
        },
        {
          term: 'Discord',
          body: '你的管理员可以选择哪些内容发到你自己的服务器：**Everything shared**、**Big moments** 或 **Nothing**，发到哪个频道，谁会被 @，以及你的玩家是否获得 **@Bingo player** 身份组。',
        },
      ],
    },
  },

  board: {
    metaTitle: '搭建棋盘 — Anvil 格子编写指南',
    metaDescription:
      '编写会自动记账的宾果格子：每种格子究竟能看到什么、用表格批量编写，以及那些会无声失败的错误。',
    eyebrow: 'Anvil · 面向棋盘搭建者',
    title: '做一块会自己记账的棋盘',
    dek: '一个格子，是「某件事会被注意到」的承诺。这里讲的是每种格子究竟能看到什么、怎样写出两百个而不搭上整个晚上，以及那少数几种会无声失败的错误 —— 格子干脆永远不触发，而没人会在第四天之前发现。',
    facts: [
      { strong: '15 种类型', rest: '每格一种，绝不混用' },
      { strong: '1000 个格子', rest: '每块棋盘，用表格编写' },
      { strong: '无声地', rest: '一个坏格子就是这样失败的' },
    ],
    footnote:
      '表格格式在 `docs/tile-authoring.md` 里有完整说明，那份文档是写给生成这些行的人（或程序）的。本页是属于人的那一半：该挑哪种类型，以及哪里会出岔子。',

    kinds: {
      title: '一个格子，一种类型',
      body: [
        '每个格子都恰好属于一_种_类型，而类型就是全部问题所在：它决定插件或 hiscores 扫描盯着什么，因而也决定这个格子究竟能不能自行完成。把两种类型的字段混在一起会在门口就被拒绝，而不是先收下再放着坏掉。',
        '这些类型分为三个家族，而家族比标签更重要：',
      ],
      families: [
        {
          term: '手动',
          body: '由人看一眼截图然后说通过。永远可用、永远有效、永远要搭上某个人的一个晚上。用它来处理软件看不见的东西。',
        },
        {
          term: '从 Hiscores 读取',
          body: '技能经验与 boss 击杀数，每 15 分钟从官方 Hiscores 扫描读取。不需要插件，对名单上的所有人都有效 —— 但它只能看到 Hiscores 统计的东西，而且要等玩家退出登录之后。',
        },
        {
          term: '由插件识别',
          body: '其余的一切：掉落、NPC 击杀、限时通关、日记、combat tasks、跑圈、战利品价值。几秒内记账，并把凭证截图合进去 —— 但只对真正在跑插件的玩家有效。',
        },
      ],
      kindsIntro: '完整列表，顺序与类型选择器一致：',
      kindLabels: {
        standard: { label: '标准', blurb: '手动格子 —— 由队长标记为完成。没有任何自动记录。' },
        skill: { label: '技能', blurb: '当某项技能达到经验目标时自动完成（从 hiscores 读取）。' },
        boss: { label: 'Boss 击杀数', blurb: '当某个 boss 达到击杀数目标时自动完成（从 hiscores 读取）。' },
        drop: { label: '掉落', blurb: '某件物品（或某个物品池中任意一件）掉落 N 次 —— 由插件识别，附带合成的截图。' },
        collection: { label: '物品套装', blurb: '多件物品，各有各自需要的数量 —— 每种一件即为完整套装。' },
        kill: { label: '击杀', blurb: '击杀任意 boss 或怪物 N 次。格子里的怪物都在 hiscores 上时从 hiscores 统计，否则在你游戏时由插件统计（鸡、牛、杀戮任务怪）。' },
        lap: { label: '敏捷跑圈', blurb: '在某条敏捷路线上跑 N 圈，或在 Hallowed Sepulchre 完成 N 层 / N 次完整通关 —— 依据游戏内计数器实时统计。只有活动期间跑的圈数才算。' },
        pvp: { label: 'PvP 击杀', blurb: '击杀玩家 —— 任何人、敌对队伍，或指定的悬赏目标 —— 在荒野或 PvP 世界里。安全的小游戏永远不算。' },
        gain: { label: '物品获取', blurb: '捕捉、烹饪或采集某物品 N 个 —— 依据进入背包的数量统计。由插件识别。' },
        timed: { label: '限时', blurb: '在时间上限内完成某项活动（Inferno、团本、Colosseum）。由插件计时。' },
        deathless: { label: '零死亡', blurb: '以队伍零死亡完成一次团本，共 N 次。插件会统计副本内的每一次死亡。' },
        lms: { label: 'LMS', blurb: '在 Last Man Standing 中进入前 N 名（1 = 获胜），共 M 次。由插件在对局结束时识别。' },
        value: { label: '战利品价值', blurb: '价值 X 金币的战利品 —— 单次收获，或多次收获累计达到目标。由插件估价。' },
        diary: { label: '日记', blurb: '在活动期间完成成就日记的层级。由插件依据完成提示识别。' },
        ca: { label: 'Combat task', blurb: '在活动期间完成 Combat Achievement 任务。由插件依据完成提示识别。' },
      },
      note: {
        tag: '关于插件的问题，只问一次',
        body: '由插件识别的格子，对不跑插件的玩家来说是不存在的。这不是能靠配置绕过去的缺陷 —— 根本没有任何东西在看。如果你氏族里有一部分人在手机或官方客户端上玩，那就要么让这些格子远离通往胜利的关键路径，要么给它们配一个手动的替代方案，并做好审核截图的准备。',
      },
    },

    pick: {
      title: '挑那个真的会触发的类型',
      intro:
        '大多数行为古怪的格子，都是把正确的想法用错了类型表达。最常绊倒人的四个：',
      rows: [
        {
          term: '一串 boss 再加一个不在 hiscores 上的怪物',
          body: '整个格子都会变成插件格子。击杀格子只有在上面每个怪物都在 hiscores 上时才从 hiscores 统计；给四个 GWD boss 加一只鸡，整个格子就需要插件。如果部分成员不用插件，把 hiscores 上的 boss 单独放一个格子。',
        },
        {
          term: '收藏日志的一个格位',
          body: '属于掉落格子。解锁日志条目即可记账，所以即便玩家早就有的重复品也能触发这个格子 —— 而这通常正是你想要的。',
        },
        {
          term: '「每样来一个」',
          body: '是一个带物品列表、且**不带** `requiredAmount` 的掉落格子。加上 `requiredAmount`，它就会悄悄变成「这些里面随便凑 N 个」—— 同一行，完全不同的格子。',
        },
        {
          term: '日记或 combat task',
          body: '只依据游戏内的完成提示记账，而那条提示只在层级或任务完成的那一刻出现。玩家已经拥有的东西无法再次触发 —— 但 combat task 例外，**Settings → Combat Achievements → Repeat completion** 能让他们重新触发一次。',
        },
      ],
      note: {
        tag: '组合式的 boss 格子',
        body: '一个 boss 格子所追踪的字段里可以放多个 hiscores 键，用逗号分隔，进度会跨键累加。`chambersOfXeric,chambersOfXericChallengeMode` 就是一个把 CoX 和 CM 一起计数的格子 —— 而这几乎总是团本格子想表达的意思。',
      },
    },

    bulk: {
      title: '批量编写，别在浏览器里点',
      body: [
        '手点一块 25 格的网格没问题。手点一块 200 项任务的 Leagues 棋盘就不行了，事后校对更不行。Tiles 标签页里有一条正为此而设的往返通道。',
      ],
      steps: [
        '在活动的 **Board & tiles** 页面点 **Download spreadsheet**。你会拿到一份反映棋盘当前状态的 .xlsx，下拉选项、物品清单和字段说明各占一个工作表。',
        '编辑它。一行一个格子；行的顺序就是格子的顺序。',
        '在同一个标签页点 **Upload CSV / Excel**。只有 **Tiles** 工作表会被读取。',
      ],
      rules: [
        {
          term: '这趟往返不丢任何东西',
          body: '下载后原封不动传回去，什么都不会发生 —— 完全一致的行会被报告为未变更，连时间戳都不会重打。这让导出成为大改之前一份可靠的备份。',
        },
        {
          term: '行对应位置',
          body: '第 1 行就是第 1 个格子。已有的格子会就地更新，而你省略掉的列会被原样保留、而不是被清空 —— 所以你可以只发一份两列的表来单独改分值。',
        },
        {
          term: '只有动态棋盘会变大',
          body: '多出来的行会在 Leagues 棋盘或格子竞速上创建新格子，前提是活动尚未开始，上限 1000。经典 N×N 网格形状固定，会直接忽略它们。要生成几百项任务，就把它做成 Leagues 活动。',
        },
        {
          term: '要么全成，要么全不成',
          body: '所有行会先被校验。哪怕只有一个物品名无法解析，整次导入都会失败、点名指出问题所在，并且什么都不改 —— 你永远不会得到半块棋盘。',
        },
        {
          term: '有些字段会在开赛时锁定',
          body: '名称、类型、所需数量和物品配置只在活动开始前生效。描述、分值、类别和「可选」标记则全程都能改，所以你可以在活动中途改掉一个错别字，而不必重开棋盘。',
        },
      ],
    },

    traps: {
      title: '那些会无声失败的错误',
      intro:
        '下面每一种都能干干净净地导入，摆在棋盘上看着也对，然后永远不会触发。它们值得在上传_之前_读一遍，而不是之后。',
      rows: [
        {
          term: '技能与 boss 格子写的是 `type=standard`',
          body: '并不存在 `type=skill`。类型来自一行在其他方面都很普通的 standard 行上的 `trackedStat` + `statType` + `statGoal`。写成 `type=boss` 会被拒绝；但写成 `type=standard` 却忘了填 stat 列不会被拒绝 —— 你会得到一个永远没人会去批准的手动格子。',
        },
        {
          term: '分隔符逐列不同',
          body: '`items` 用分号（逗号是 CSV 的分隔符）。`targetNpcs` 用竖线。在 combat task 行里，竖线是**唯一**选择，因为真实的任务名里含有逗号 —— `Nylocas, On the Rocks` 是一个任务。',
        },
        {
          term: '团本名称按字面匹配',
          body: '零死亡或限时格子所填的模式必须与游戏里的写法完全一致：`Chambers of Xeric: Challenge Mode`、`Theatre of Blood: Hard Mode`、`Tombs of Amascut: Expert Mode`。差一点的拼写，就是一个永远不会完成的格子。Entry Mode 的通关永远不会为基础团本格子记账；更高难度则会。',
        },
        {
          term: '物品名必须精确',
          body: '必须是游戏里的写法，否则导入会失败并列出无法解析的名字。名字有歧义时，就用 `Name#id` 把它钉死，别再猜。',
        },
        {
          term: '`timeThresholdSeconds` 有四种含义',
          body: '在限时格子上是时间上限，在 LMS 格子上是名次上限（1 = 获胜），在零死亡格子上是精确的队伍人数，在掉落格子上是精确的团本队伍人数。同一列，四种含义 —— 请确认你填的是你这个类型真正会读的那一种。',
        },
        {
          term: '把所需数量填到了错的类型上',
          body: '它属于掉落、击杀、获取、跑圈、PvP、零死亡和 LMS 这些行。填在 stat 行或限时行上什么也不会发生，而填在掉落行上会把一个物品套装变成「任意 N 个」的池子。',
        },
      ],
      note: {
        tag: '写两百个之前先试一个',
        body: '就你不确定的那种类型写一个格子，在一个用完就扔的活动里公布它，然后真的去把那件事做一遍。花在那里的五分钟，胜过在氏族宾果夜发现整整一个类别是死的。',
      },
    },

    points: {
      title: '分值、档位，以及公不公平',
      body: [
        '在按分数计的棋盘上，每个格子都带有自己的分值，而这些分值会映射到有名字的难度档位 —— easy 到 elite —— 如果你的氏族分级方式不同，可以在 **Rules & scoring** 里修改这些档位。玩家读的是档位；计分的是数字。',
        '把一个格子标记为 **optional**，它就不再计入棋盘总分 —— 你可以借此加入进阶目标，同时又不会让全盘通关变得不可能。',
        '棋盘填满之后，从 Tiles 标签页跑一次**平衡审核器**。它会检查结构和投入的分布，告诉你棋盘在哪里偏了 —— 某个没人做得完的类别、某个每小时收益远高于邻居的档位 —— 赶在玩家替你发现这些问题、并绕着走之前。',
      ],
    },

    reveal: {
      title: '在你发话之前没人看得见',
      body: [
        '新棋盘一开始是隐藏的。管理层始终看得到；玩家在你公布之前什么都看不到 —— 所以棋盘可以在明面上、花好几天、在成员看得到的频道里搭建，而不会剧透任何东西。',
        '那个总开关是其他一切的地基。在带有公布策略的棋盘上 —— 定时、间隔、悬赏、轮换 —— 引擎只有在棋盘本身被公布之后才会开始翻开单个格子，所以让一块棋盘「上膛」永远是一次刻意的动作。该选哪种策略有自己的页面：[赛制，以及格子如何开放]({formatsGuide})。',
        '任务是值得了解的例外：预先写好但压着不放的格子，在活动中途从它们自己的池子里公布，而棋盘的其余部分始终可见。',
      ],
    },

    check: {
      title: '公布之前',
      intro: '每块棋盘值得走一遍。大部分只要五分钟。',
      items: [
        '每个格子的类型都是你想要的那个，而不是那个刚好能干净导入的',
        '团本模式、物品名和任务名与游戏里的写法逐字一致',
        '如果你氏族里有一部分人不用插件，由插件识别的格子并不是通往胜利的唯一路径',
        '分值已设定且平衡审核器满意，或者你是有意与它意见相左',
        '可选格子已标记为可选',
        '你已经下载过一次表格，作为可以再传回去的备份',
      ],
      note: {
        tag: '谁能做这件事',
        body: '编写格子是唯一一个拥有专属角色的管理工作。**editor** 只能编写格子、别的什么都不能做，而且可以被限定到特定棋盘 —— 这样来自别的氏族的受邀搭建者，拿到的就恰好是你交给他的那一场活动，无法接触你运营的任何其他东西。',
      },
    },
    library: {
      title: '任务库与建议',
      body: [
        '格子编辑者的管理菜单中有 **Task library**：你氏族保存的任务，以及可供复制的 Anvil 自带库。**⬇ Export pack** 将你的任务保存为文件，**⬆ Import pack** 则加载一个文件，棋盘就是这样在氏族之间迁移的。',
        '发现 Anvil 库中有错误，或缺少某个任务？在该任务上按 **Suggest a fix**，或按 **Suggest a new task**。Anvil 会审核，结果显示在 **Your suggestions** 下：**Waiting for review**、**Approved** 或 **Not taken**，并附备注。你最多可以有 5 条等待中。获批的修正会送达每个仍然跟随库的氏族副本。',
      ],
    },
    stats: {
      title: '起始数据与迟到加入者',
      intro: '经验和击杀数格子会把每位玩家现在的数据与他们的**起始数据**进行比较，起始数据在活动开始时记录。活动的 **Stats** 页面是你检查和修正它们的地方：',
      rows: [
        {
          term: '记录起始数据',
          body: '开赛前它只是预热 hiscores；真正的起跑线在开赛时记录。开赛后，按钮会变为 **Capture late joiners**，用于记录之后加入的玩家。每 30 分钟可运行一次。',
        },
        {
          term: '立即更新',
          body: '根据最新数字刷新排名。排名也会每小时自动刷新一次。',
        },
        {
          term: '修正基准',
          body: '逐个玩家：手动修改某项技能或首领的起始数字。当活动开始前的一段练级因为玩家开赛前没有登出而被计入时使用。',
        },
        {
          term: '重置所有起始数据',
          body: '收在 **Danger zone** 下：根据每个人当前的数据重新记录其起跑线，清除迄今为止的所有增长。仅用于误开的活动。',
        },
      ],
      outro: '在此之下，**Member breakdown** 会显示每个队伍中谁做了什么，**Stat tile standings** 则会显示每位玩家在每个经验或击杀格子上的起始与当前数字。',
    },
    race: {
      title: 'Tile 竞速赛道',
      intro: '在 tile 竞速面板上，你要搭建赛道而不是网格。Tile 位于编号的步骤上，队伍沿着它们前进。',
      body: [
        '打开 **Tiles**，使用 **Route** 部分。选择一个模板（默认为 **Diamond**），将你的 tile 添加到各步骤上，然后按 **Save route**。你链接的每个 tile 都必须位于下一步上。',
        '道路可以分叉和合并，但终点只有一个。在分叉处，你可以选择完成一个 tile 是否决定道路，还是由队长选择并锁定。完整的选项列表，以及玩家看到的内容，见 [Formats, and how tiles open]({formatsGuide})。',
      ],
    },
  },

  captain: {
    metaTitle: '队长指南 — Anvil',
    metaDescription:
      '选秀当天以及之后的几周：在计时开始前读透候选名单、做出选择，并打理你队伍的名单、凭证与费用。',
    eyebrow: 'Anvil · 面向队长',
    title: '队长指南',
    dek: '有人塞给你一间作战室、一个计时器，以及二十五个陌生人的报名表。这里讲的就是这一切各自做什么，顺序与你实际遇到它们的顺序一致 —— 外加带队工作中真正在选秀结束之后才开始的那部分。',
    facts: [
      { strong: '蛇形顺序', rest: '让靠后的选择得到补偿' },
      { strong: '计时器', rest: '永远不会替你做选择' },
      { strong: '一个标签页', rest: '打理你的队伍一整场活动' },
    ],
    footnote:
      '这里写的全是队长看得到的东西。费用、其他队伍的名单，以及公布之前的棋盘都属于管理层并且会一直如此，所以本页上的任何内容都不会让你被指责看了不该看的东西。',

    before: {
      title: '你会拿到什么，以及什么时候',
      body: [
        '主办方任命你为队长，这会做两件事：把你作为玩家安排进队伍，并向你开放队伍的各个界面。如果队伍页面曾经警告你其实并不在名单上，就接受它提供的修正 —— 队长身在自己队伍之外，是一种会把后面每一块界面都搞糊涂的状态。',
        '从那以后你有两个地方要去。**My Team** 是你队伍的中枢，整场活动你都待在那里。**作战室**是选秀当天的界面，报名一开放它就开放 —— 远早于选秀之夜。',
      ],
      note: {
        tag: '早点去',
        body: '作战室最有用的时候是选秀_之前_那几天，那时你能把每一份报名表好好读完。到了当晚它就变成一个秒表，你不会有时间读任何东西。',
      },
    },

    warroom: {
      title: '在计时开始前把名单读透',
      body: [
        '作战室会显示所有可选之人，以及本站掌握的关于他们的一切：他们玩什么、在哪些 boss 上有真实的击杀数、过去有多少场活动他们真的到场，以及他们在报名表里填的答案。',
        '那些答案在**提交那一刻就被冻结**。没有人会在看到谁先被选中之后再去改自己的「每周时长」—— 而这正是它们值得一读的全部理由。',
        '边读边建一份**候选短名单**。它只有你能看到，会一直保留到选秀之夜，而那一晚它就是「从一份你早已信任的名单里挑」和「挑屏幕最上面那个」之间的差别。',
      ],
      rows: [
        {
          term: '评分与档位',
          body: '对某人实际做过什么的概括，源自他的账号历史，而不是他跟你说了什么。仅供参考 —— 它是一场对话的起点，不是判决。',
        },
        {
          term: '领域与标记',
          body: '他们有据可查在做的事：团本、PvM、技能、PvP。用来发现你阵容里的缺口，而不是把最高的那个数字挑四遍。',
        },
        {
          term: '出勤',
          body: '他们报名过的历届活动里，真正打完的比例。页面上最不起眼的数字，也常常是最有预测力的那个。',
        },
      ],
    },

    draft: {
      title: '选秀当天',
      body: [
        '选择按**蛇形顺序**进行：四支队伍时，第一轮是 A、B、C、D，第二轮是 D、C、B、A —— 所以某一轮最后选，就意味着下一轮最先选。抽到首选的人，一分钟之后就要为此付出代价。',
        '一个人算一次选择，而不是一个账号。选走某人，会把他登记过的所有账号一并拉进你的队伍 —— 你永远不会为谁的小号再花掉第二次选择。',
      ],
      rows: [
        {
          term: '选择计时器',
          body: '如果主办方设了一个，你每一轮就有那么多秒。计时结束时它**不会**替你选 —— 它只是解锁了主办方代你选择的权限，并且会在两边界面上明说。没有任何事情是悄悄发生的。',
        },
        {
          term: '被收窄的名单',
          body: '有些活动开启了平衡模式。视具体模式而定，最强的队伍可能会被禁止在对手一个顶级玩家都没有时再拿一个，或者被限制阵容超出平均值的幅度。如果你想要的人是灰的，原因就在这里，而且它对所有人一视同仁。',
        },
        {
          term: '如果你错过了',
          body: '提前告诉主办方。他们能从同一块界面替你选，而你留下的短名单就是他们会遵循的指示。',
        },
      ],
      note: {
        tag: '选秀会锁死名单',
        body: '选秀一旦开始，队伍和挑选顺序都会被冻结。如果少了一支队伍，或者顺序不对，必须在第一次选择之前修正，而不是之后。',
      },
    },

    roster: {
      title: '你队伍的中枢，贯穿整场活动',
      intro:
        '在 **My Team** 上，**Manage this team** 卡片里包含了你能为自己这一边做的所有事。它默认是折叠的；打开一次之后就会保持在你留下的状态。',
      rows: [
        {
          term: 'Roster',
          body: '队里有谁、各自贡献了什么。有人问「为什么我的掉落没算」时，第一个该看的地方 —— 没关联的账号会在这里露出来。',
        },
        {
          term: 'Requests',
          body: '在允许玩家自选队伍的活动里，请求加入的人。只有真的有人时才会出现。',
        },
        {
          term: 'Proof',
          body: '你队伍的提交及其截图。最终拍板的不是你 —— 是管理层 —— 但你能看到什么已经发出去了，也能去催还没发的。',
        },
        {
          term: 'Fees',
          body: '你队里还欠着报名费的人。你可以把某一笔标记为已付；确认它是管理层的活儿，这是刻意如此。',
        },
        {
          term: 'Invite links',
          body: '当主办方允许队长自行生成时才会出现。一条链接就能把打开它的人直接安排进你的队伍。这条链接到底做了什么，见[接待一个来访氏族]({clanVsClanGuide})。',
        },
      ],
    },

    during: {
      title: '开赛之后怎么带',
      body: [
        '活动的大部分会自己跑：插件为它看得到的东西记账，并存下一张盖了戳的截图。剩下的是人，而那才是这份工作。',
        '真正需要队长的事：确保你这边所有人在开赛前都已经连好插件并关联好账号，因为没关联的小号对任何事都没有贡献；在过半时留意有哪些格子还没人碰过；以及在最后一个小时（大家一窝蜂上）之前，就把手动格子的照片拍完。',
        '如果活动要求开赛照，那就是每位玩家必须在头几个小时里自己完成的唯一一件事。要早点催 —— 没交的玩家，他的每一次记账都会被标记待审，或者被直接拒绝，取决于主办方怎么设的。',
      ],
      note: {
        tag: '换人',
        body: '活动一旦开始，只有管理员能换人，这是有意的：贡献已经挂在具体的人身上了。去问主办方，而不是绕开这件事自己想办法。',
      },
    },
  },

  formats: {
    metaTitle: '赛制，以及格子如何开放 — Anvil',
    metaDescription:
      '七种活动赛制、格子可以开放的五种方式，以及分数修正项 —— 它们各自会如何改变一场活动玩起来的感觉。',
    eyebrow: 'Anvil · 面向氏族管理层',
    title: '赛制，以及格子如何开放',
    dek: '有两个决定，对一场活动的影响超过里面的任何一个格子：棋盘是什么形状，以及格子如何变得可玩。它们相互独立 —— 任何赛制都能搭配任何公布策略 —— 而两者合在一起，就是「熬一周」和「一晚上的竞速」之间的差别。',
    facts: [
      { strong: '7 种赛制', rest: '棋盘的形状' },
      { strong: '5 种策略', rest: '格子如何开放' },
      { strong: '3 个修正项', rest: '一次完成值多少' },
    ],
    footnote:
      '赛制在创建时确定，但之后可以在活动的 Settings → Event 标签页里更改；公布策略和分数修正项，只要它们影响的格子尚未公布，随时都能改。',

    shape: {
      title: '棋盘的形状',
      intro:
        '赛制决定棋盘如何计分，以及创建表单接下来会问你什么。本页其余的一切都建立在它之上。',
      note: {
        tag: '固定网格还是任务清单',
        body: '**经典**棋盘是真正的正方形，所以「N 为 5」就意味着恰好 25 个格子，而且这个数字永远不会变。其余全是任意长度的任务清单 —— 那也是表格导入唯一能让其变大的棋盘类型。如果你打算生成一百个任务，这个决定就是在这里做的。',
      },
    },

    reveal: {
      title: '格子如何开放',
      intro:
        '与赛制无关。活动层级的公布开关仍然是总闸 —— 只要棋盘还处于隐藏状态，什么都看不到，这些引擎也一个都不会跑，所以让棋盘上膛永远是一次有意的动作。',
      rows: [
        {
          term: '一次全开',
          body: '经典做法。你公布棋盘的那一刻，每个格子都可玩，队伍自己决定先做哪个。除非你有理由不这么做，否则就选它。',
        },
        {
          term: '定时',
          body: '每个格子都带有自己的公布时间，在 Tiles 标签页里设定，时间一到就开放。「整点一格」式的棋盘：它替你定好了节奏，但要求时间提前写好。',
        },
        {
          term: '间隔',
          body: '引擎按固定间隔抽取隐藏格子 —— 每 N 分钟一批，随机或按棋盘顺序。像宾果报号员。除了格子本身之外没有额外工作量，而且棋盘会在你睡觉时自己公布。',
        },
        {
          term: '悬赏',
          body: '同一时间恰好只有一个格子开放，第一支完成的队伍拿走它 —— 格子随即关闭，下一个立刻抽出。冷酷、非常好看，而且对时区毫不留情。',
        },
        {
          term: '轮换',
          body: '一个滑动窗口里放着少数几个开放的格子：每次抽取都会开放新的、并让最旧的过期。与悬赏不同的是，在格子消失之前所有人都来得及完成它。为个人天梯而设计。',
        },
      ],
      note: {
        tag: '时区这个问题',
        body: '悬赏和间隔棋盘奖励的是恰好醒着的人。在一个分布于全球的氏族里，那是一种由时钟而非由打法分配的实实在在的优势。轮换窗口能缓和这一点 —— 一个开放的格子会在整个窗口期内保持开放，所以正在睡觉的玩家依然有机会。',
      },
    },

    scoring: {
      title: '一次完成值多少',
      intro:
        '三个修正项，全都只在按分数计的模式下生效，也全都在完成发生的那一刻被冻结进该次完成里 —— 因此你之后做的任何改动都不会改写历史。',
      rows: [
        {
          term: '首完成队伍加成',
          body: '给第一支完成每个格子的队伍额外加分。让一块「全部可见」的棋盘产生竞速感的最省事办法，而且不必改动其他任何东西。',
        },
        {
          term: '衰减',
          body: '一个格子的分值会从公布时的满值线性变化到 N 小时后的目标百分比，然后保持不变。低于 100% 就是衰减，奖励抢先；高于 100% 则会**增长**，奖励去清理那些大家都跳过的老任务。会增长的这个方向，正是人们忘了它存在的那个。',
        },
        {
          term: '锁定',
          body: '第一次完成会对所有其他队伍关闭该格子。悬赏模式里默认包含。在队伍实力差距很大的棋盘上，这可能让比赛早早失去悬念 —— 它最适合的场景是队伍势均力敌。',
        },
      ],
    },

    missions: {
      title: '任务：活动中途的惊喜',
      body: [
        '任务是预先写好但压着不放的格子 —— 从它们自己的池子里公布，而棋盘的其余部分始终可见。它们与公布策略无关，所以哪怕是一块普普通通、全部可见的宾果棋盘也可以有任务。',
        '棋盘冷下来时手动丢一个，或者按固定间隔，或者按每个任务各自的计划表。每个任务都自带计分方式：自己的锁定、加成、衰减和过期时间，是按格子设定的，而不是整场活动统一设定。',
        '这是第五天把棋盘唤醒最省事的办法 —— 而第五天，正是每一场长活动都需要被唤醒的那一天。',
      ],
    },

    choose: {
      title: '一页之内做出选择',
      intro: '如果你已经知道自己想要的感觉，这是通往它最短的路。',
      rows: [
        { term: '一场普通的氏族宾果', body: '经典网格，全部格子可见。想要一点紧迫感就加上首完成队伍加成。' },
        { term: '几百个任务，按难度计分', body: 'Leagues，全部可见。它也是大规模表格导入唯一能长进去的形态。' },
        { term: '一周里层层推进的节奏', body: 'Leagues 搭配定时或间隔公布，让棋盘在一周里逐步展开，而不是一次摊开。' },
        { term: '一个大家会实时围观的夜晚', body: '悬赏。一个格子，第一支队伍拿走，下一个立刻上。' },
        { term: '个人赛，而不是团队赛', body: '天梯，配轮换窗口和衰减。任务来来去去，谁也囤不住。' },
        { term: '一场有终点线的比赛', body: '格子竞速 —— 一条有序赛道，走得最远的获胜。' },
      ],
      outro:
        '无论你选哪一种，格子本身都是同一份活：见[做一块会自己记账的棋盘]({boardGuide})。',
    },
    race: {
      title: 'Tile 竞速路线',
      intro: 'Tile 竞速是一条编号步骤的赛道。队伍逐步前进，走得最远的获胜。主办方可以将赛道变成带有分叉与汇合道路的地图。',
      body: ['每条路线都有一个起点、可以分叉和合并的道路，以及一个终点。每条道路长度相同。队伍的进度就是它已经走过的道路。'],
      rows: [
        {
          term: '按成就',
          body: '你当前 tile 之后的每个 tile 都是开放的。队伍第一个完成的 tile 会确定它的道路，其他的则对该队伍关闭。',
        },
        {
          term: '选择并锁定',
          body: '在任何内容计入之前，队长（或团队工作人员）使用 **Pick this road** 选择下一个 tile。只有选择是开放的。选择无法撤销，除非由管理员重置。',
        },
        {
          term: '保留提前完成',
          body: '默认关闭，因此只有队伍道路上已开放的 tile 才计入。开启后，对队伍尚未到达的 tile 的完成会被保留，并在道路到达该处时完成。它从不跳过领先的队伍，也不会提前开放任何内容。',
        },
      ],
      steps: [
        '打开活动的 **Tiles** 页面，找到 **Route**。',
        '选择 **Route template**，然后按 **Apply template**。**Diamond** 为默认：一个起点、两条道路、一个终点。**Two roads**、**Braid**、**Straight line** 和 **Free**（无链接）也可以选择。',
        '选择 **How a team’s road is set at a fork**：按成就，或选择并锁定。',
        '使用 **+ Step before**、**Move step earlier/later** 和 **Remove step** 添加或移动步骤，然后按 **Save route**。',
        '如果活动已经开始，Anvil 会询问如何处理新路线切断的完成记录：**Keep**（保留）或 **Roll back**（回滚）。',
      ],
      outro:
        '玩家会在活动页面看到 **Race track**，其所在队伍的 tile 上带有金色 **You** 标记。**Fullscreen board** 可将其放大，**Esc** 关闭。在插件中，侧边面板显示 **Your road** 和 **After that**。',
    },
  },

  fees: {
    metaTitle: '报名费与奖金发放 — Anvil 司库指南',
    metaDescription:
      '设定报名费、把钱收上来、结清它所需的第二个签名，以及把奖池变成已发放的名次。',
    eyebrow: 'Anvil · 面向司库',
    title: '报名费与奖金发放',
    dek: '钱是氏族活动出问题的地方，而且它出问题的时候悄无声息：某人发誓自己交过的一笔费用、谁也对不上的一个奖池、等赢家都下线之后才吵起来的奖金分配。这条路会在每一步都留下痕迹。',
    facts: [
      { strong: '2 个签名', rest: '默认即可结清一笔费用' },
      { strong: '奖池 = 追加', rest: '+ 费用 × 已通过的报名数' },
      { strong: '1 行', rest: '对应一位领钱的人' },
    ],
    footnote:
      '报名费与奖金发放是司库的地盘。司库能做管理员能做的一切，外加这些；普通管理员根本看不到报名费相关的页面。',

    set: {
      title: '设定费用',
      body: [
        '报名费挂在活动上，创建时设定，或者在它的 **Sign-ups** 标签页里修改。完全不收费也是个完全站得住脚的答案 —— 很多活动只靠主办方追加的奖池就跑起来了。',
        '有两个设置决定了这笔费用真正的含义，而它们很容易被略过：',
      ],
      rows: [
        {
          term: '按人还是按账号',
          body: '在允许一人报多个账号的活动里，它决定对方是交一次还是每个账号各交一次。设错了，你就得给人退钱。',
        },
        {
          term: '缴费截止时间',
          body: '一旦过了这个时间，未缴费的报名就不再是你追着跑的事，而变成一个需要拍板的决定。把它设得比你以为的更早 —— 活动前一天才发现，已经来不及找人顶替了。',
        },
        {
          term: '访客报名费',
          body: '不是主办这块板的氏族成员的玩家要交的金额。留空的话，访客交和成员一样的报名费。要让某一位玩家交不同的金额，在 **Sign-ups** 里他那一行按 **Change this player’s fee**。',
        },
      ],
      note: {
        tag: '奖池跟着报名走',
        body: '显示出来的奖池 = 你手动追加的部分 + 报名费 × **已通过**的报名数。它会随着报名被通过和被排除而变化，所以页面上的数字永远是你实际能发出去的那个。',
      },
    },

    collect: {
      title: '收款',
      body: [
        '费用怎么收，就按你们氏族本来收钱的方式来 —— 游戏里、Discord 里，你们怎么做都行。Anvil 的工作从钱到账那一刻开始：有管理权限的人把它标记为**已付**，这会记下是谁说自己收的、以及什么时候。',
        '玩家也有发言权。成员可以上报自己付给了谁，并附上一张截图 —— 正是这一点，把「我肯定交了」变成一条两头都有据可查的记录。当玩家的上报与收款人的说法指向不同的人时，这是一个网站能摆到你面前的分歧，而不是你在争吵中途才发现的分歧。',
        '催款只要一个按钮：管理 → **Fees** 里的 **Remind unpaid** 会给这场活动里所有还没交钱的人发一条 Discord 私信。',
      ],
      note: {
        tag: '凭证是刻意删除的',
        body: '付款截图只保留到该笔费用结清为止，然后就被移除。它存在的意义是解决一次分歧，而不是在归档里躺一年。',
      },
    },

    sign: {
      title: '第二个签名',
      body: [
        '一笔费用会停在**已收**状态，直到_另一位_管理层成员确认它确实到账。经手钱的人不能同时是签字确认钱已到的人 —— 这就是整套控制的全部，也正因如此，网站是直接拒绝收款人给自己确认，而不只是劝阻。',
        '一笔费用需要几个签名，是一项氏族设置（**Clan settings → Rules & scoring → Fee sign-off**），范围是零到五。零之所以存在，是有真实理由的：在司库_就是_所有者的氏族里，根本没有第二个人可以签，于是「34 笔费用等待第二个签名」会变成一条永远清不空的队列，并且永远是仪表盘上最刺眼的东西。设为零时，把费用标记为已付**本身就是**那个签名。',
        '你们有两个人就设为一 —— 也就是默认值。如果坦白讲并没有第二个人，就设为零；只有在你们既有人手也有理由时，才把它调得更高。',
      ],
    },

    pay: {
      title: '发放',
      body: [
        '活动结束时，活动的 **Prizes** 页面会把奖池变成一份人的名单。生成它，你得到的是每位受款人一行，而不是每支队伍一行：获胜队伍的奖金会在成员之间平分，好让「发钱」变成一份姓名与数字的清单，而不是半夜里的一道算术题。',
        '金额从一份建议分配开始 —— 向冠军倾斜，而你设的获奖名次越多它就越平缓 —— 并且每一行都可以改。这个建议是起点，不是政策。',
        '然后你一边发一边把行勾掉。要点在于：一周之后，任何人都能看着这份名单知道谁拿了多少，而不必从 Discord 的聊天记录里去还原。',
      ],
      note: {
        tag: '从这里公布一次就好',
        body: '奖金发放会从活动本身发到你们的 Discord 频道，因此公告和记录是同一件事。手动公布的奖金，就是日后会有人声称「从没收到」的那种奖金。',
      },
    },

    disputes: {
      title: '当数字对不上的时候',
      intro: '你真正会遇到的四种：',
      rows: [
        {
          term: '他说他付了，但没人标记',
          body: '请他带着截图上报这笔付款。这会在记录上留下一个具名的收款人和一个时间戳，而被点名的人可以确认或否认。',
        },
        {
          term: '两位管理层都以为是自己收的',
          body: '玩家自己的上报是决胜依据 —— 它写明了钱交给了谁。先把收款人改对，再结清。',
        },
        {
          term: '一笔费用卡在等签名',
          body: '要么它真的在等另一个人，要么你们氏族的管理层人数少于「所需确认数」这项设置的假设。请把设置调低，而不是给自己的收款做确认。',
        },
        {
          term: '你告诉大家之后奖池变了',
          body: '它跟着已通过的报名走，所以通过或排除一份报名都会让它变动。报数时，请以报名截止那一刻的奖池为准，而不是刚开放报名时的。',
        },
      ],
    },
  },

  coffer: {
    metaTitle: '氏族金库 — Anvil 财务指南',
    metaDescription:
      'Anvil 里的氏族金币池：登记捐款并记到捐款人名下、发放奖励的三条路径、谁能动这笔钱，以及金库不够时会怎样。',
    eyebrow: 'Anvil · 写给财务',
    title: '氏族金库',
    dek: '多数氏族把金币放在某个人的银行里，把账目放在某个人的记忆里。金库是一个池子，每一笔进出都有一行记录 — 谁给的、许给了什么、以及实际是谁发出去的。',
    facts: [
      { strong: '3 个数字', rest: '库存、已占用、可承诺' },
      { strong: '3 条出口', rest: '周赛、任务格、板子的奖池' },
      { strong: '财务', rest: '或管理员 — 光有职级不算' },
    ],
    footnote:
      '这里说的一切都在 Admin → **Coffer**，只有奖励阶梯例外，它跟着被支付的那样东西走。公开的一半是 `/coffer`：余额、捐款榜和最近的进出，给成员看。',

    what: {
      title: '它是什么',
      body: [
        '是一本账，不是钱包。Anvil 从不代管你们的金币 — 金币仍然放在氏族原本存放的地方 — 所以金库记录的是进来了多少、许出去多少、以及实际交付了多少。它的价值在于：承诺和支付是两行不同的记录。',
        '页面开头是三个数字，之所以是三个，是因为它们回答三个不同的问题：',
      ],
      rows: [
        {
          term: '库存',
          body: '已批准的捐款加调整。氏族收到的，减去已核销的。',
        },
        {
          term: '已占用',
          body: '被某个奖励认领的金币 — 已经赢下但尚未发出，加上为某块板子预留的奖池。即便还躺在某人的银行里，也已经名花有主。',
        },
        {
          term: '可承诺',
          body: '库存减去已占用。新奖励唯一会去核对的数字，因为另一种做法是趁财务睡觉时把同样的 5000 万许给两个赢家。',
        },
      ],
      note: {
        tag: '待处理的捐款哪个数字都不算',
        body: '有人打字说「我给了 1 亿」，那是关于过去的一句话，不是银行里的金币。在管理层认可之前，它不进任何一个数字，因此绝不会去支撑一笔后来发不出的奖励。',
      },
    },

    inbound: {
      title: '让金币进来',
      body: [
        '日常的那条路由 RuneLite 插件自动处理：在游戏里打开 Clan Coffer，Anvil 就会根据它真实的金币余额记录存入和取出。第一次看到的数额只是基准 — 它从不假装打开的人捐出了里面原有的全部金币。',
        '手动登记留给没人开着插件时发生的事。成员在 `/coffer` 自己上报捐款，等管理层相信它；财务登记一笔已经到账的，而他登记这个动作**本身**就是批准。',
        '无论哪条路，都要记到某个**人**头上。这比听起来重要：公开页上的捐款榜，是多数捐款人唯一会得到的谢意，而以「氏族」名义进来的金币不感谢任何人。',
      ],
      rows: [
        {
          term: '在游戏里打开金库',
          body: '启用 Anvil 并登录（Profile sync → **Sync Clan Coffer** 默认开启）。出现对应的游戏消息时，你自己的存入或取出会记在你名下；隔了一段时间才看到的变化会被对账补齐，但不会记在看到它的人名下。Admin → Coffer 会显示最后一次看到的实际金额及其时间。',
        },
        {
          term: '成员自己上报',
          body: '在公开的金库页面提交，有截图更好。它以待处理状态落地并出现在你的队列里。批准，才让它变成真钱。',
        },
        {
          term: '由你登记',
          body: 'Admin → Coffer → **Record a donation**。在名册里搜到是谁给的，在名字旁填上金额，完成。访客也能记名 — 不是正式成员的人一样可能往池子里掏过钱。',
        },
        {
          term: '几个人一起凑',
          body: '把他们都选上，输入总额并按 **Split … ways**，之后可以手动微调某一份。它为每个人各写一行，而不是一行里列一串名字，这样每个人都以自己的名字出现在捐款榜上。',
        },
      ],
      note: {
        tag: '调整是另一回事',
        body: '**Correct the pot** 是给那些在这套流程之外发生的金币变动用的 — 给金库起个底、拿它去付 Anvil 从没见过的东西、更正一个错误。它有意不属于任何人，也刻意不是登记一份馈赠的方式。',
      },
    },

    out: {
      title: '发钱的三条路',
      intro: 'Anvil 里的每一份奖励都出自这同一个池子，而每条路判定赢家的方式不同。阶梯要设在「被赢走的那样东西」上面 — 金库从不过问谁赢了什么。',
      rows: [
        {
          term: '周赛，在它自己的页面上',
          body: 'Skill 或 Boss of the Week 带一份名次阶梯：第一名拿这个，第二名拿那个。它在比赛结束时**一次性**结算，依据最终榜单 — 比赛进行中不会有任何转手。创建比赛时就能设，也可以之后在比赛自己的页面上设。',
        },
        {
          term: '板子上的任务格',
          body: '任务按完成先后付钱，所以它的阶梯是被认领而不是被结算：第一支完成的队伍拿走第一名的金币。在格子的 rewards 部分设置，任何允许任务的板子都行。',
        },
        {
          term: '板子的奖池',
          body: '宾果自己会把奖池分配到各个名次上，所以金库只递给它一个数字。Event → **Prizes** → *From the clan coffer*。它会加到报名费和你手工添的那部分上，名次之间怎么分则在同一页设置。你还可以选择金库是立刻**冻结**这笔金币，还是只记下这个承诺 —— 钱毕竟还没出去，而六周后才开的板子没必要把半个池子锁到那时候。',
        },
      ],
      note: {
        tag: '有人打平的时候',
        body: '周赛阶梯可以**平分并列名次**：所有并列的人把他们占据的名次合起来平分，于是三个各 40 kc 的人各拿第一、第二、第三名之和的三分之一，而不是其中排在最前面的一个人通吃。不开启，就由榜单自己的顺序决定。两种都站得住脚 — 出了成绩之后才来决定则不然。',
      },
    },

    who: {
      title: '谁能动它',
      intro: '钱是一项独立的权限，不是职级。版主可以审核提交却永远碰不到金库，这是有意为之，不是疏漏。',
      rows: [
        {
          term: '财务或管理员',
          body: '整本账：登记与批准捐款、调整金库、设置奖励阶梯、把奖励标记为已发。所有者在这里算作管理员。',
        },
        {
          term: '版主',
          body: '一样都不行。他们连金库页面都看不到 — 收钱是财务的活儿，光凭职级从来就不带来这项权利。',
        },
        {
          term: '板子财务',
          body: '单个活动的钱：它的报名费、它的发奖、它的奖池。按板子授予，客队氏族正是这样在氏族对抗赛里管好自己那一半，而不必接手你们的账本。氏族金库他们碰不到。',
        },
        {
          term: '任何成员',
          body: '可以上报一笔捐款、可以看公开页面。就这些。',
        },
      ],
      note: {
        tag: '在频道里告诉全氏族',
        body: '在 Admin → Discord → What goes where → **Staff only** 里把 **Coffer ledger** 指向一个 Discord 频道，每一笔进出都会连同它留下的余额一起发出来。这是唯一没有后备通道的推送：留空，关于钱的事哪里都不会发。参见 [Anvil 与 Discord]({discordGuide})。',
      },
    },

    short: {
      title: '金库不够时',
      body: [
        '比金库还大的奖励不会被拒绝。它会被记成**欠着且未覆盖** — 一条真实的、带着赢家名字的记录 — 因为另一种结果是赢家什么都没有，也没有任何痕迹证明曾经许诺过什么。',
        '所以补救办法很平常：先把金币弄进来，再发出去。不该做的是事后悄悄改阶梯；账上已经写着当初公布的是什么，两者互相打架比钱不够更糟。',
      ],
      note: {
        tag: 'Anvil 不会替你发钱',
        body: '每一份奖励最后都是一个人在游戏里把金币递过去，然后勾掉一行。账本的职责是确保那一行存在、写清是谁和多少，并且一周之后没人需要从 Discord 聊天记录里把它拼回来。',
      },
    },
  },
  moderator: {
    metaTitle: '当班 — Anvil 管理员指南',
    metaDescription:
      '在一个 Anvil 氏族站点上当管理员的一天：待办队列、审核提交与账号、让成员名单保持诚实，以及那些判断。',
    eyebrow: 'Anvil · 面向管理员',
    title: '当班',
    dek: '不论有没有活动在进行，管理员都要处理那些自己找上门的工作：要看的凭证、要验证的账号、会漂移的成员名单。这里讲的是这条队列由什么构成，以及怎样把它清空、而不至于让自己成为别人等待的原因。',
    facts: [
      { strong: '不碰活动', rest: '管理员既不能创建也不能编辑' },
      { strong: '一个页面', rest: '就能告诉你什么在等你' },
      { strong: '尽快通过', rest: '慢吞吞的队列会让人觉得站点坏了' },
    ],
    footnote:
      '管理员能看到成员看到的一切，外加各种审核界面。创建和编辑活动、设置、人员和奖金发放，是 admin 和司库的工作 —— 某个按钮不在，原因就是这个，而且是刻意的。',

    what: {
      title: '这个角色是什么',
      intro:
        '角色是向下叠加的：管理员能做的一切，司库和 admin 也都能做。而专属于管理员的是：',
      canList: [
        '成员名单：添加和移除成员，以及处理加入申请（[你的成员]({peopleGuide})）',
        '账号验证 —— 经验挑战和人工审核',
        '提交与凭证截图',
        '每周竞赛与日程',
        '氏族日历活动',
      ],
      cantIntro: '刻意不让他们做的：',
      cantList: [
        '创建或编辑活动，或它的格子',
        '更改氏族设置或 Discord 接线',
        '提升任何人，或改动管理层',
        '结清一笔费用或执行一次奖金发放',
      ],
    },

    queue: {
      title: '从正在等你的东西开始',
      body: [
        '管理仪表盘不是站点的概览 —— 它是一份「什么在等着」的清单，按重要程度排序，并且由真实数据算出，而不是靠会漂移的计数器。如果它说没有什么在等你，那就是真的没有。',
        '自上而下地做。能升到最上面的条目，都是另一端有个活人的：某人因为账号没验证而无法报名，或者某人的掉落因为还没人看过而没被计入。',
      ],
    },

    submissions: {
      title: '提交与凭证',
      body: [
        '大多数记账根本到不了你手上：插件看到掉落，存下一张盖有队伍和 UTC 时间戳的截图，格子就完成了。会落进队列的，是手动格子以及插件标记出来的一切。',
        '那个戳，正是让一份凭证难以被质疑的东西。插件截图把队伍和时刻都合进了画面里，而在开启两帧凭证之后，几秒钟后的第二帧还会显示战利品已经落在地上。什么都没有的截图就是一张手机截图，这也完全没问题 —— 只是意味着由你来核对。',
      ],
      rows: [
        {
          term: '只要说得通就通过',
          body: '你不是在审计银行。只要画面显示了那件事、账号在成员名单上、时间戳落在活动区间内，就通过，然后继续下一条。',
        },
        {
          term: '拒绝时给个理由',
          body: '不给解释的拒绝，一小时之内就会以私信的形式回到你这里。说清楚缺了什么，好让第二次提交是对的。',
        },
        {
          term: '被标记的提交是个问题，不是指控',
          body: '插件标记的是它无法完全确认的东西 —— 最常见的是某位玩家没交开赛照。请把它读作「看看这一条」，而不是「有人作弊了」。',
        },
      ],
    },

    verify: {
      title: '验证账号',
      intro:
        '没有至少一个已验证账号就无法报名任何活动，所以这条队列会直接把人挡在游戏之外。它值得每天清空。',
      rows: [
        {
          term: '通过插件验证',
          body: '首次所有权验证后，插件会自动识别该账号，稳定的账号指纹也会在改名后保留关联。名单中没有已知指纹的账号需要进行一次 XP 验证或管理员批准。',
        },
        {
          term: 'Verify by XP',
          body: '给没有插件的玩家用。网站随机挑一项技能，他们需要在三十分钟内在该技能上获得 1,000 经验。它会自我校验 —— 你只会看到没通过的那些。',
        },
        {
          term: '人工审核',
          body: '隐藏了 Hiscores，或者小号太新还没出现在上面。有人提交一个 RSN 并附上说明，由你来判断。说明不够时，就要一张登录界面的截图。',
        },
      ],
      note: {
        tag: '已验证不等于成员',
        body: '验证一个账号，说的是「这确实是他的」。它不会把人放进氏族。成员身份只来自游戏内名单同步或管理团队手动添加，访客席位只来自管理团队批准的加入申请（如果氏族允许任何人进入，则立刻获得）。这是有意为之，也正是它挡住了任何人靠输入名字就加入你们的氏族。',
      },
    },

    roster: {
      title: '让成员名单保持诚实',
      body: [
        '成员名单只有一个来源：由管理员从游戏内的氏族列表跑一次同步，入口是氏族窗口标题栏上的 **Anvil** 按钮（或插件侧边栏的 **Sync roster**）。其他一切 —— 验证、关联、报名 —— 都挂在它上面。',
        '所以维护工作量很小但是实打实的：每轮招新之后请 admin 同步一次（这会把在游戏里加入的访客变成成员），处理 **Roster** 标签页顶部的加入申请，并主动处理 **Needs review**，而不是等人来抱怨。见[你的成员]({peopleGuide})。',
      ],
      note: {
        tag: '最后一次看到 ≠ 最后一次在玩',
        body: '成员的「最后一次在氏族中看到」时间戳，记录的是最近一次找到他的同步，而不是他最后一次登录。要判断「他还在玩吗」，请改看他的实时数据时间 —— 那个才是会自己走的。',
      },
    },

    startshot: {
      title: '复核开赛照',
      body: [
        '在要求开赛照的活动里，每位玩家都必须提交一张在开赛之后拍摄的截图，地点在开赛那一刻抽取。带有已验证口令的插件截图会以「已接受」的状态到达，所以实际上你只需要看那些用手机手动上传的玩家。',
        '你要核对的东西很少：角色在画面里、口令在聊天框里，而且那正是那位玩家实际拿到的口令。上传会立刻生效、由你事后复核，所以没有人会因为等你而被挡在游戏之外。',
      ],
    },

    judgement: {
      title: '你必须做的那些判断',
      intro:
        '这些在软件里都没有正确答案 —— 而这正是它们最终落到人身上的原因。',
      rows: [
        {
          term: '凭证是真的，但迟了',
          body: '掉落发生在活动期间，截图却是在活动结束之后到的。一般来说通过 —— 看画面里的戳，而不是上传时间。',
        },
        {
          term: '账号还没关联',
          body: '掉落是真的，账号也确实是他的，只是他在开打之前没把它加进来。先让他关联，然后通过。别为了走流程让人重打一次团本。',
        },
        {
          term: '看起来像摆拍',
          body: '把它交给 admin，而不是自己拒绝。在一个小氏族里，一次拒绝就是一次公开指控，而这永远不该是某一个人匆忙之间做出的决定。',
        },
        {
          term: '你自己也在这场活动里',
          body: '你几乎肯定是。把任何牵涉到自己队伍的事交给另一位管理员 —— 不是因为你会不公正，而是因为你本就不该被迫去证明自己没有。',
        },
      ],
    },
  },

  commands: {
    metaTitle: 'Discord 斜杠命令 — Anvil',
    metaDescription:
      'Anvil 的全部斜杠命令 — /bingo、/sotw、/botw、/eff、/coffer、/stats 和 /guide — 逐一说明每个选项，附示例、谁能用什么，以及命令不出现时的解决办法。',
    eyebrow: 'Anvil · 在 Discord 里',
    title: '斜杠命令',
    dek: '在你氏族的 Discord 里输入 `/`，Anvil 就会用网站的实时数据回答：棋盘、排名、你自己的卡片、周赛、金库，以及任何人的数据。本页是完整列表，直接由机器人实际注册的命令生成，所以永远不会过时。',
    facts: [
      { strong: '私密', rest: '只有你能看到的回复，附带分享按钮' },
      { strong: '你的语言', rest: '跟随你的 Discord 语言设置' },
      { strong: '只读', rest: '/coffer add 和 remove 除外' },
    ],
    footnote:
      '机器人的初次设置见 [Discord 指南](/guide/discord)。本页讲的是怎么用它。',

    using: {
      title: '命令怎么用',
      body: [
        '在机器人能看到的任意频道输入 `/`，从列表中选一条 Anvil 命令。Discord 随后会把它的选项显示成一个个待填的框：按 Tab 或点击即可添加。下文中写在 `<angle brackets>`（尖括号）里的选项是必填的；写在 `[square brackets]`（方括号）里的选项是可选的，可以不填。',
        '每条回复都是**私密**的：只有你能看到，所以一天看十次棋盘也不会打扰任何人。如果值得让频道看看，就按回复下方的 **Share to channel**。分享出去的那份会在那一刻重新生成，所以晚些分享的排名就是那时的排名。',
      ],
      rows: [
        { term: '必填', body: '`<amount>` — 不填好，Discord 就不会发送这条命令。' },
        { term: '可选', body: '`[member]` — 不填的话，命令会回答关于你、你的队伍或整个氏族的情况。' },
        { term: '列表', body: '从 Discord 给出的值里选一个；不能自己输入。' },
        { term: '输入搜索', body: '开始输入，再从建议里选，比如首领名字或你自己的账号。' },
        { term: '成员', body: '从服务器里选一个人，和 @提及 一样。' },
      ],
      note: {
        tag: '命令只在你氏族的服务器里有效',
        body: '每条回复都是关于某一个氏族的，而私信里没有可以回答的氏族。所以私信里不会出现这些命令。',
      },
    },

    bingo: {
      title: '棋盘命令：/bingo',
      intro:
        '`/bingo` 针对的是一块棋盘。同时有多块棋盘进行时，**board** 和 **leaderboard** 会把它们全部列出；其余命令则依次针对正在进行的棋盘、下一块要开始的棋盘、刚刚结束的棋盘。',
    },

    clan: {
      title: '氏族命令',
      intro:
        '这些命令回答的是氏族而不是某块棋盘，所以不管有没有宾果在进行都能用：周赛、效率、金库、任何人的数据，以及设置指南。',
    },

    options: {
      title: '到处都会见到的选项',
      intro: '有几个选项，在任何带有它们的命令里意思都一样：',
      rows: [
        {
          term: '`member`',
          body: '服务器里的另一个人。不填就是问你自己。它通过对方在网站上使用的 Discord 登录找到其 Anvil 账号，所以只对至少登录过一次 Anvil 的成员有效。',
        },
        {
          term: '`account`',
          body: '对方的哪个 OSRS 账号，给有小号的人用。输入后选择；不填就是主号。',
        },
        {
          term: '`page`',
          body: '一个首领或活动，输入搜索：`Zulrah`、`Theatre of Blood`、`Tempoross`。不填则显示总览。',
        },
        {
          term: '`language`',
          body: '仅这一次用另一种语言回答。默认是你 Discord 所设的语言，或氏族选定的机器人语言。',
        },
        {
          term: '`amount`',
          body: '用顺手的方式写金币：`5m`、`2.5b`、`500k`，或者像 `2,500,000` 这样的普通数字。',
        },
      ],
    },

    who: {
      title: '谁能用什么',
      body: [
        '服务器里的任何人都能运行所有只读命令。你看到的就是成员会看到的：格子尚未揭晓的棋盘，在 Discord 里也照样隐藏，管理层也不例外。',
        '回答关于**你**的命令（`/bingo me`、不带 member 的 `/stats`）需要知道哪个 Anvil 账号是你的。它们通过你在网站上使用的 Discord 登录来找，所以用 Discord 登录一次 Anvil，之后就都能用了。',
      ],
      rows: [
        { term: '所有人', body: '除 `/coffer add` 和 `/coffer remove` 之外的所有命令。' },
        {
          term: '财务、管理员、所有者',
          body: '`/coffer add` 和 `/coffer remove`。核对的是你**在 Anvil 网站上**的角色，而不是 Discord 身份组，因为聊天服务器里的头衔从来不代表能动氏族的钱。',
        },
      ],
    },

    trouble: {
      title: '命令不起作用时',
      intro: '常见原因，大致按发生的先后排列：',
      rows: [
        {
          term: '列表里没有 Anvil 命令',
          body: '机器人被邀请时没带上它的命令 — 这是一项单独的权限，较早的邀请链接只申请了其中一项。由管理员在 Admin → Discord → **Connection** 重新运行 **Invite / re-invite the bot**。这不会踢出机器人，也不会重置任何东西。新加入的命令最多可能要一小时才会出现。',
        },
        {
          term: '“The application did not respond”',
          body: 'Anvil 暂时连不上，通常是在更新。几秒后再运行一次。',
        },
        {
          term: '关于自己显示「不在这块棋盘上」',
          body: '要么你没有参加这块棋盘，要么 Anvil 无法把你的 Discord 对应到你的账号。用这个 Discord 账号登录网站，并检查你的个人资料。',
        },
        {
          term: '某位成员的数据是空的',
          body: '对方还没用 Discord 登录过 Anvil，或者其账号的排行榜数据还没读取。加上 `account` 选项再试一次，或请对方登录一次。',
        },
        {
          term: '`/coffer add` 说你没权限',
          body: '你在 Anvil 网站上的角色不是财务、管理员或所有者，或者这个 Discord 不是你登录网站用的那个账号。',
        },
      ],
    },

    labels: {
      options: '选项',
      noOptions: '没有选项 — 直接运行即可。',
      example: '示例',
      examples: '示例',
      required: '必填',
      optional: '可选',
      choices: '可选值',
      range: '从 {min} 到 {max}',
      kinds: {
        text: '文本',
        number: '数字',
        member: '成员',
        choice: '从列表中选',
        search: '输入搜索',
        yesno: '是或否',
      },
    },

    examples: {
      'bingo board': {
        examples: ['/bingo board'],
        tip: '当前正在进行的棋盘。棋盘揭晓之前，这里的格子名称同样保持隐藏。',
      },
      'bingo leaderboard': {
        examples: ['/bingo leaderboard'],
        tip: '队伍排名，按棋盘的计分方式显示积分或格子数。',
      },
      'bingo rules': {
        examples: ['/bingo rules'],
        tip: '这块棋盘如何计分（直接读取活动本身，所以总是准确的），然后是你们氏族自己的规矩。',
      },
      'bingo apply': {
        examples: ['/bingo apply'],
        tip: '怎么参加：报名、报名费，以及你自己报名的进度。',
      },
      'bingo next': {
        examples: ['/bingo next'],
        tip: '接下来是什么：一次格子揭晓、一个任务，或一个截止时间。',
      },
      'bingo me': {
        examples: ['/bingo me'],
        tip: '你的队伍、你的名次，以及记在你名下的格子。',
      },
      'bingo help': {
        examples: ['/bingo help'],
        tip: '在 Discord 里列出机器人能回答什么的简短清单。',
      },
      'bingo team': {
        examples: ['/bingo team', '/bingo team name:Iron Wolves'],
        tip: '一支队伍的卡片：分数、成员和最近完成的格子。不填名字就是你自己的队伍。',
      },
      sotw: {
        examples: ['/sotw', '/sotw language:Deutsch'],
        tip: '所有进行中的 Skill of the Week、每项的前几名，以及你的排名。',
      },
      botw: {
        examples: ['/botw'],
        tip: '所有进行中的 Boss of the Week 及其实时排名。',
      },
      eff: {
        examples: ['/eff', '/eff metric:Hours bossed'],
        tip: '氏族的效率排行榜以及你在其中的名次。默认是 游戏时长；打首领就选 首领时长。',
      },
      'coffer balance': {
        examples: ['/coffer balance'],
        tip: '金库余额、捐款榜和最近的进出。',
      },
      'coffer add': {
        examples: ['/coffer add amount:5m', '/coffer add amount:250k note:Raffle proceeds'],
        tip: '仅限财务、管理员和所有者。登记进来的金币；同时会发到金库推送频道。',
      },
      'coffer remove': {
        examples: ['/coffer remove amount:20m note:SOTW prize'],
        tip: '仅限财务、管理员和所有者。拒绝让金库低于零；如果你确实要这么做，请在金库页面登记。',
      },
      'stats profile': {
        examples: ['/stats profile', '/stats profile player:Zezima'],
        tip: '一眼看清一个账号：战斗等级与总等级、游戏时长 与 首领时长、收藏日志数量和个人最佳。',
      },
      'stats levels': {
        examples: ['/stats levels', '/stats levels player:My Iron'],
        tip: '每项技能的等级和经验值。',
      },
      'stats efficiency': {
        examples: ['/stats efficiency'],
        tip: '游戏时长 和 首领时长，以及它们分别来自哪些技能和首领。',
      },
      'stats clog': {
        examples: ['/stats clog', '/stats clog page:Zulrah'],
        tip: '收藏日志的总体进度，或某个首领的那一页。',
      },
      'stats pbs': {
        examples: ['/stats pbs', '/stats pbs page:Theatre of Blood mode:Hard size:3'],
        tip: '个人最佳。团队副本按模式和队伍人数分别记录时间，所以用 `mode` 和 `size` 找到你要的那一场。',
      },
      'stats luck': {
        examples: ['/stats luck', '/stats luck player:Zezima'],
        tip: '在 Anvil 追踪的掉落中，这个账号的运气如何。',
      },
      'stats collectors': {
        examples: ['/stats collectors'],
        tip: '氏族里最大的收藏日志。',
      },
      'stats luckboard': {
        examples: ['/stats luckboard'],
        tip: '氏族里最非和最欧的成员。',
      },
      setup: {
        examples: ['/setup topic:Plugin setup', '/setup topic:Plugin setup step:5'],
        tip: 'Discord 里的设置指南：步骤列表，或者单独一步并附上直达网站上该步骤的链接。',
      },
      guide: {
        examples: ['/guide guide:ToB 4-man gear'],
        tip: '公会的一篇游戏指南（团队副本、首领、赚钱等）：开始输入它的名字，然后从列表中选择。',
      },
    },
  },

  tiles: {
    metaTitle: '格子规则与限制 — Anvil',
    metaDescription:
      '每种宾果格子需要你做什么（游戏设置、RuneLite 插件、已同步的收藏日志、高分榜排名），以及它能追踪的范围。',
    eyebrow: 'Anvil · 面向玩家',
    title: '格子规则与限制',
    dek: '每个格子都会列出它需要你做什么、以及它做不到什么。本页解释每一条；格子上的 **Why?** 链接会跳到这里。',
    needs: '需要',
    limit: '须知',
    checked: '格子会替你检查这一项',
    englishOnly: '以下规则暂时只有英文版，以确保始终与网站的实际行为一致。',
  },

  // /guide/creators — 主播的创作者空间指南（lib/creatorSpaces）。
  creators: {
    metaTitle: '为你的观众举办 OSRS 宾果 — Anvil',
    metaDescription:
      '不需要氏族，就能为你的直播举办 Old School RuneScape 宾果或格子竞速：建一个空间，分享一条链接，选择谁能加入（Twitch、Kick、YouTube 或 Discord），再用 OBS 把棋盘放到直播里。',
    eyebrow: '给主播和创作者',
    title: '为你的观众举办活动',
    dek: '创作者空间让你为直播举办宾果。你不需要游戏里的氏族。你建一场活动，分享一条链接，观众就能加入。',
    facts: [
      { strong: '不需要氏族', rest: '' },
      { strong: '免费', rest: '开始' },
      { strong: '一条链接', rest: '发到你的聊天' },
    ],

    what: {
      title: '什么是创作者空间',
      body: [
        '它是你在 Anvil 上的专属页面，地址是 `{apex}/c/your-name`。你在这里为观众举办活动。',
        '它不是氏族。没有氏族名单，没有职位，也没有每周比赛。谁加入你的活动，就只参加那一场活动，别的都没有。',
        '观众用 Discord 登录，添加他们的 RuneScape 角色，然后按 **Join**。之后 Anvil 的 RuneLite 插件会自动统计他们的掉落。',
      ],
    },

    create: {
      title: '建立你的空间',
      body: [
        '打开 [{apex}/host](/host)，用 Discord 登录。',
        '给你的空间起个名字。用你的频道名就很好。你的链接由名字生成。想换一个链接，就按 **change link**。',
        '按 **Create my space**。每个 Discord 账号只能有一个空间。',
      ],
    },

    first: {
      title: '建立你的第一场活动',
      body: [
        '建好空间后，你会直接进入 **Create your first event**。以后请用 **Your events** 顶部的 **+ New event**。',
        '**Name。** 观众会看到的名字。',
        '**What kind?** 选一张卡片。**Team bingo** 是 5×5 的棋盘，Anvil 会替你给玩家分队。**Solo bingo** 是同样的棋盘，但每个人各玩各的。**Team race** 是按顺序完成的任务：进度最靠前的队伍获胜。',
        '**Ready-made tiles** 会给你一组从易到难的任务，之后可以修改。**Blank, I’ll write my own** 则从空白开始。',
        '**Who can join?** 保持 **Anyone**，或者选择谁可以加入。见第 5 步。',
        '**When?** 选开始和结束日期。也可以留空，准备好时自己开始活动。',
        '按 **Create event**。然后按 **Copy invite link**。',
      ],
    },

    share: {
      title: '分享链接',
      body: [
        '把邀请链接贴到你的直播聊天、Discord 或社交账号里。观众只需要这条链接。',
        '你随时可以再次复制：**Your events** → 活动旁边的 **Copy invite link**。',
        '想让机器人在聊天里回复 `!join` 并附上链接？见第 9 步。',
      ],
    },

    who: {
      title: '选择谁能加入',
      body: [
        '每场活动一开始都对 **Anyone** 开放。想只留给你的社区，就打开活动的 **Settings** → **Viewers** → **Who can join?**，选一个或多个选项。第一场活动的页面上也有同样的选项。',
        '如果你选了不止一个，**满足其中任何一个就够了**。关注者或者服务器加成者都能进。',
      ],
      intro: '每个选项，以及观众要做什么：',
      rows: [
        {
          term: 'Anyone',
          body: '有链接的人都能直接加入。',
        },
        {
          term: 'Twitch followers',
          body: '观众在活动页面按 **Link Twitch**，用 Twitch 登录。Anvil 会检查他们是否关注了你。',
        },
        {
          term: 'Twitch subs',
          body: '和关注者一样，但他们必须是订阅者。选最低等级：**Tier 1 or higher**、**Tier 2 or higher** 或 **Tier 3**。Prime 订阅算 1 级。你的频道必须是 Twitch 合作伙伴或联盟成员。',
        },
        {
          term: 'Kick followers',
          body: 'Kick 不会告诉应用谁关注了你，所以 Anvil 只统计你连接 Kick _之后_ 才关注的人。在那之前就关注了？观众取消关注再重新关注就行。你的 Kick 聊天只允许关注者发言？在 **Kick channel** 框里打开 **My Kick chat is followers-only**。这样，在你聊天里输入 Anvil 代码的观众就会算作关注者。',
        },
        {
          term: 'Kick subs',
          body: '你连接 Kick 之后 Anvil 看到的订阅者会自动算数。其他人按 **Get Kick code**，在你的 Kick 聊天里输入验证码（长得像 `ANVIL-7F3K9Q`），Anvil 就能看到他们的订阅徽章。Kick 没有订阅等级。',
        },
        {
          term: 'YouTube subscribers',
          body: '观众按 **Check my YouTube subscription**，用 Google 登录。他们在 YouTube 上的订阅必须是公开的。',
        },
        {
          term: 'YouTube members',
          body: '观众在你的 YouTube 直播聊天里输入他们的 Anvil 验证码。所以会员只能在 **你正在直播时** 加入。',
        },
        {
          term: 'Discord role',
          body: '拥有你在自己的 Discord 服务器里指定的身份组的人（最多 5 个身份组）。请先连接你的服务器：菜单里的 **Discord (optional)**。',
        },
        {
          term: 'Server boosters',
          body: '给你的 Discord 服务器加成的人。同样需要先连接你的服务器。',
        },
      ],
      note: {
        tag: '先知道',
        body: '请先连接你的频道（第 7 步），否则 Twitch、Kick 和 YouTube 的选项会一直是灰色。一个 Twitch、Kick 或 YouTube 账号在每场活动里只能带一名玩家进来。你的工作人员，以及你按名字邀请的人，不用通过检查。',
      },
    },

    approve: {
      title: '逐个批准玩家（可选）',
      body: [
        '想自己挑谁来玩？打开活动的 **Settings** → **Viewers** → **Who can enter**，选 **Ask me about everyone**。按 **Save changes**。',
        '这样观众会看到 **Ask to join**，而不是 **Join**。他们仍然要先通过你的 **Who can join?** 选项。',
        '他们的申请会在 **Your events** 里显示为 **N waiting for you**。点它，或者打开活动的 **Sign-ups** 标签页。顶部的列表叫 **Waiting for your yes**。逐个接受或拒绝。',
      ],
    },

    channels: {
      title: '连接你的 Twitch、Kick 或 YouTube',
      body: [
        '在菜单里打开 **Settings**。在 **Twitch channel**、**YouTube channel** 或 **Kick channel** 框里，按 **Connect Twitch**、**Connect YouTube** 或 **Connect Kick**，并以你的频道登录。',
        '你连接的每个频道，都会在你的页面上显示为一个 **verified** 链接。你不能手动填链接：登录才是 Anvil 确认频道属于你的方式。',
        '一个频道只能连接到 Anvil 上的一个地方。如果它已经在你管理的另一个空间或氏族里，Anvil 会问你要不要把它移过来。',
      ],
    },

    overlay: {
      title: '把棋盘放到直播里（OBS）',
      body: [
        '在 **Your events** 里，按活动旁边的 **Stream overlay**，再按 **Make overlay links**。',
        '你会得到三条链接。**Standings**：排名靠前的队伍和他们的进度。**Feed**：最新的掉落和完成的格子。**Board**：棋盘，已完成的格子会标出来。',
        '复制之前先选一个 **Text size**（S、M、L 或 XL）。然后按你想要的那条旁边的 **Copy**。',
      ],
      stepsTitle: '把它加到 OBS',
      steps: [
        '在 OBS 的 **Sources** 下，按 **+**，选 **Browser**。',
        '把链接贴到 **URL**。',
        '设一个大小，比如 800 × 600。让 **Custom CSS** 保持为空。',
        '按 **OK**。它每隔几秒会自动更新。',
      ],
      tipsTag: '先知道',
      tips: [
        '在链接末尾加上 `&limit=10`、`&title=0` 或 `&align=right` 可以改变显示效果。',
        '浮层显示的内容和你的公开活动页面一致。被隐藏的排名和被隐藏的格子，在直播里也会保持隐藏。',
        '**Reset link** 会生成新链接，并让旧链接失效。链接泄露时用它。你需要把新链接重新贴到 OBS 里。',
        '角落里有一个小小的 “Anvil” 标记。在 Gold 方案里，你可以在 **Settings** → **Anvil mark on your overlay** 中隐藏它。',
      ],
    },

    chatjoin: {
      title: '聊天里的 !join',
      body: [
        '打开 **Settings** → **!join in Twitch chat**，把它打开。',
        '观众输入 `!join` 时，Anvil 机器人（Anvil_OSRS）会回复你当前开放活动的链接。不管多少人输入，它最多每 30 秒回复一次。',
        '它只在你于第 7 步连接过的频道里回复。Kick 的话，在 **Kick channel** 框里打开 **!join in Kick chat**。',
        '没有开放的活动？它会这么说：“No event is open to join right now — keep an eye on the stream!”',
      ],
      tips: [
        '如果你的聊天室屏蔽链接（Twitch 的 **Block hyperlinks** 或 AutoMod），机器人的回复会被拦下。在聊天里输入一次 `/vip anvil_osrs` 或 `/mod anvil_osrs`，链接就能发出来。',
        '正在处理某个活动？活动菜单里的 **Space settings** 能带你回到这些开关。**Who can join?** 下面的 **Switch it on in your settings** 也可以。',
      ],
    },

    page: {
      title: '打造你自己的页面',
      body: [
        '你的页面就是大家在 `{apex}/c/your-name` 看到的内容，连同你的活动。打开 **Settings** → **Your page**。每一部分都有自己的保存按钮。',
      ],
      items: [
        '**Bio.** 几行关于你和你直播的介绍。以 `https://` 开头的链接可以点击。',
        '**Logo and banner.** 按 **Upload a logo** 或 **Upload a banner**。横幅横跨页面顶部，所以要做得宽一些（3:1，比如 1500 × 500）。支持 PNG、JPEG、GIF 或 WebP。两者都可以是动图。',
        '**Panels.** 活动下方最多 8 张卡片，就像 Twitch 频道下面的面板。按 **+ Add a panel**，填上标题和文字。图片和链接可选。用箭头调整顺序。',
        '**Schedule.** 你通常开播的时间，用你自己的时区填写。访客看到的是换算成他们自己时钟的时间。',
        '**Featured.** 置顶在页面顶部的一个片段。从你的直播高光（下一步）里选一个，或者粘贴 Twitch、YouTube、Kick 或 Medal 的片段链接。',
        '按 **Preview your page**，用访客的视角看看它。',
      ],
      note: {
        tag: 'Jagex 的规则',
        body: '你页面上的一切都必须遵守 Jagex 的规则：不准卖金币或卖号，不准赌博，不准用机器人，不准私服。保存时 Anvil 会检查你的文字和链接。如果有人举报后 Anvil 工作人员隐藏了你的页面，你的设置里会写明。如果你觉得是误判，请到 Anvil 的 Discord 询问。',
      },
    },

    highlights: {
      title: '直播高光',
      body: [
        '连接了 Twitch 或 YouTube 频道后，你直播时 Anvil 会捕捉你活动里的精彩时刻。开关在 **Settings** → **Stream highlights**。',
        '**Auto-clip big moments on my stream** 在你连接后就是打开的。你在 Twitch 直播时，活动开始、某支队伍清空板子或获胜、以及你自己的角色出了稀有掉落或宠物时，Anvil 都会剪一个片段。在 YouTube 上，它会改为保存一个指向你直播那一秒的链接。Kick 暂时还没有高光。',
        '片段会显示在活动页面和你页面的 **Highlights** 下。你可以把其中一个置顶为 **Featured** 片段（第 10 步）。',
        '**Let Anvil feature clips from my events in its own promotion** 在你打开之前一直是关闭的。打开后，Anvil 可能会在自己的页面和社交媒体上分享片段，并且总会注明是你。',
        '你的玩家也可以剪自己的精彩时刻。他们在 **Settings** → **Connected accounts** 里自己的 Twitch 账号下打开 **Clip my stream when I hit a big moment**。',
      ],
    },

    listing: {
      title: '在 Anvil 上展示',
      body: [
        '你的空间建好时是不公开的。只有拿到你链接的人才能找到它。',
        '打开 **Settings** → **Advertise on Anvil** 并打开它。你的空间会出现在 Anvil 氏族目录里，你的新活动会显示在 `{apex}/events`。',
        '只想展示某一场活动，就打开它的 **Settings** → **Viewers** → **List on Anvil**。它会在活动即将开始或进行中时显示。',
        '没有日期的活动会显示在 **Open to join** 下，标着“Open now · starts when the host starts it”。',
      ],
    },

    plans: {
      title: '方案与限制',
      body: [
        '你的方案决定你的活动同一时间最多能有多少名玩家。日期重叠的活动共用这个数字；日期不同的活动各自都有这个数字。同时在两场重叠活动里的玩家算两次。其他一切在所有方案里都一样：棋盘、插件追踪、浮层和 Discord。',
        '你的方案卡片在 **Your events** 里。想比较方案，请看[价格](/pricing#creators)。想更改或取消付费，请去[你的账单页面](/portal)。',
      ],
      rows: [
        { term: 'Free', body: '所有活动加起来同时最多 50 名玩家。同一时间一场活动。Discord 身份组和加成者检查。' },
        { term: 'Bronze', body: '所有活动加起来同时最多 150 名玩家。Twitch、Kick 和 YouTube 检查。' },
        { term: 'Silver', body: '所有活动加起来同时最多 300 名玩家。可同时进行多场活动。聊天里的 `!join`。在列表中排在前面。' },
        { term: 'Gold', body: '所有活动加起来同时最多 1,000 名玩家。可隐藏浮层上的 Anvil 标记。' },
        { term: 'Partner', body: '玩家人数不设上限。直接与 Anvil 一起设置，请联系我们。' },
      ],
      note: {
        tag: '目前',
        body: 'Anvil 还在成长期，所以大家依然都能进，即使超过你方案的数字。限制会在之后开始，并会提前通知。你的方案卡片会显示你离上限还有多远。',
      },
    },

    faq: {
      title: '常见问题',
      intro: '主播问得最多的几个：',
      rows: [
        {
          term: '我的观众需要氏族吗？',
          body: '不需要。他们需要一个 Discord 账号和一个 OSRS 角色。把[观众指南]({joiningGuide})发给他们。',
        },
        {
          term: '他们需要 RuneLite 插件吗？',
          body: '掉落和击杀需要。插件会自动把它们发过来。少数格子改为读取高分榜。',
        },
        {
          term: '观众说 “The host’s Twitch connection isn’t working”。',
          body: 'Twitch 不再接受你的连接了。打开 **Settings**，按 **Reconnect Twitch**。Kick 和 YouTube 也一样。',
        },
        {
          term: '别人可以帮我一起管理吗？',
          body: '可以。打开 **Players** → **Staff & roles**，添加他们，并选择每个人能做什么。',
        },
        {
          term: '我也有游戏里的氏族。',
          body: '那你可能不需要空间。公开氏族可以改为打开 **Streaming**。见[氏族直播]({streamingGuide})。',
        },
        {
          term: '我可以建第二个空间吗？',
          body: '目前每个 Discord 账号一个空间。如果需要另一个，请联系我们。',
        },
        {
          term: '我空间的设置在哪里？',
          body: '在菜单里按 **Settings**。在活动里面时，按活动菜单里的 **Space settings**。',
        },
        {
          term: '我页面上的 **Report** 按钮是做什么的？',
          body: '任何已登录的人都可以向 Anvil 工作人员举报你的页面、面板、活动或高光。举报只会发给工作人员。如果工作人员隐藏了你的简介、面板、日程或置顶片段，你的设置里会写明。',
        },
      ],
    },
  },

  // /guide/joining-a-streamer-event — 点了主播链接的观众。按钮上的文字与网站完全一致。
  joiningStream: {
    metaTitle: '加入主播的 OSRS 宾果 — Anvil',
    metaDescription:
      '从主播那里拿到了链接？用 Discord 登录，添加你的 OSRS 角色，按 Join。Twitch、Kick 或 YouTube 上关注者或订阅者专属活动该怎么做，以及你的掉落如何计入。',
    eyebrow: '给观众',
    title: '加入主播的活动',
    dek: '主播分享了一条链接。下面是怎么上棋盘。你不需要氏族。',
    facts: [
      { strong: '约 2 分钟', rest: '加入' },
      { strong: '不需要氏族', rest: '' },
    ],

    join: {
      title: '四步加入',
      body: [
        '**打开链接**，就是主播分享的那条。或者在他们的聊天里输入 `!join`，机器人会贴出来。',
        '**用 Discord 登录。** 这就是你的 Anvil 账号。什么都不用填。',
        '**添加你的角色。** 按 **Add my character**，输入你的 RuneScape 名字。如果显示 **Prove it’s mine**，请按你个人资料页上的步骤做。[插件指南]({pluginGuide})会告诉你怎么做。',
        '**按 Join。** 如果你有多个角色，选一个。成功后你会看到 **You’re in!**。',
      ],
    },

    gated: {
      title: '关注者或订阅者专属活动',
      body: [
        '有些活动只给主播的社区。加入卡片会告诉你是谁，例如 “Open to followers of somename on Twitch”。',
        '照样按 **Join**。如果你还没被放行，卡片会列出该做什么。做完其中一项，再按一次 **Join**。',
      ],
      intro: '每种情况该怎么做：',
      rows: [
        {
          term: 'Twitch 关注或订阅',
          body: '按 **Link Twitch**，用 Twitch 登录。Anvil 不会要求任何权限。然后再按一次 **Join**。',
        },
        {
          term: 'Kick 关注或订阅',
          body: '按 **Get Kick code**。在 10 分钟内把验证码（像 `ANVIL-7F3K9Q`）输入主播的 Kick 聊天。每个验证码只能用一次。然后再按一次 **Join**。',
        },
        {
          term: 'YouTube 订阅者',
          body: '按 **Check my YouTube subscription**，用 Google 登录。选你平时观看用的账号。你的订阅必须在 YouTube 的隐私设置里设为公开。',
        },
        {
          term: 'YouTube 会员',
          body: '按 **Link my YouTube account**，然后在 YouTube 直播聊天里输入你的验证码，再按 **check the chat**。这只在主播正在直播时有效。',
        },
        {
          term: 'Discord 身份组或加成者',
          body: '加入主播的 Discord 服务器并获得身份组（或者给它加成）。Anvil 会用你登录时的 Discord 账号来检查。',
        },
      ],
      note: {
        tag: '审批',
        body: '有些主播会逐个批准玩家。这时按钮会显示 **Ask to join**，在他们回复之前你会看到 **Waiting for the host**。',
      },
    },

    plugin: {
      title: '安装 Anvil 插件',
      body: [
        '你的掉落和击杀通过 RuneLite 的 Anvil 插件来计入。从 Plugin Hub 安装它，并在它的侧边栏里用 Discord 登录。',
        '[插件指南]({pluginGuide})会带你走一遍，大约三分钟。',
      ],
    },

    play: {
      title: '开玩',
      body: [
        '就这些。照常游戏。当你获得棋盘需要的掉落或击杀时，插件会自动发送。',
        '随时打开活动链接，就能看到棋盘和排名。你只是在玩这一场活动：你并没有加入氏族。',
      ],
    },

    accounts: {
      title: '你已连接的账号',
      body: [
        '你关联的 Twitch、YouTube 和 Kick 账号都在 [Settings → Connected accounts](/settings/connections)。你也可以在加入之前先在那里关联。',
        '随时可以取消关联。你已经加入的活动会保留你。以后加入需要检查的活动时，会再要求你关联。',
        '你关联的 Twitch、YouTube 和 Kick 账号会带着已验证的勾显示在你的个人资料上：你证明了它们是你的。关掉 **Show on my profile** 就能隐藏其中一个。Medal 链接不一样。它是你自己粘贴的，所以没有勾。',
        '你自己也在 Twitch 直播？在你的 Twitch 账号下打开 **Clip my stream when I hit a big moment**。你在主播的活动里直播时，Anvil 会剪下你的稀有掉落、宠物和完成的格子。',
      ],
    },

    faq: {
      title: '常见问题',
      intro: '当提示说不行的时候：',
      rows: [
        {
          term: '“This event is full”',
          body: '没有位置容纳更多玩家了。只有主播能腾出位置，请告诉他们。',
        },
        {
          term: '我订阅了，但它不让我进。',
          body: '确认你关联的是你订阅时用的同一个账号。在 Twitch 上，看加入卡片上的 **Your Twitch**。在 Kick 上，在他们的聊天里重新输入一个新验证码：Anvil 会读取那条消息上的订阅徽章。在 YouTube 上，把你的订阅设为公开，然后再检查一次。',
        },
        {
          term: '我在 Kick 上关注了，但它说我没有。',
          body: 'Anvil 只能看到主播连接 Kick 之后产生的关注。取消关注再重新关注，然后按 **Join**。',
        },
        {
          term: '“That Twitch account was already used to join this event”',
          body: '一个 Twitch（或 Kick、YouTube）账号只能带一名玩家进来。已经有别人用它加入了。',
        },
        {
          term: '“Twitch didn’t answer just now”',
          body: 'Twitch、Kick、YouTube 或 Discord 出了点小问题。等一分钟，再按一次 **Join**。',
        },
        {
          term: '“The host’s … connection isn’t working”',
          body: '这个问题在主播那边。告诉他们在 Anvil 上重新连接他们的频道。',
        },
        {
          term: '我的掉落没有显示。',
          body: '确认插件已安装并已登录，而且你是用正在玩的那个角色加入的。见[插件指南]({pluginGuide})。',
        },
        {
          term: '哪里能找到更多这样的活动？',
          body: '[活动页面](/events)列出了任何人都能加入的活动，包括现在正开放的主播活动。',
        },
        {
          term: '主播页面上有违规内容。',
          body: '在页面、活动或高光上按 **Report**。选出问题所在，然后按 **Send**。它只会发给 Anvil 工作人员。主播永远不会知道是谁举报的。',
        },
      ],
    },
  },

  // /guide/streaming-for-clans — 打开 Streaming 的公开氏族（lib/streamingSwitch）。
  streamingClans: {
    metaTitle: '为你氏族的活动做直播 — Anvil',
    metaDescription:
      '让你直播间的观众不用加入氏族，也能参加你氏族的一场 OSRS 活动：打开 Streaming，向观众开放一场活动，并选择哪些观众可以进入。',
    eyebrow: '给做直播的氏族',
    title: '氏族直播',
    dek: '你的氏族会直播活动？让观众不用加入氏族，也能参加一场活动。',

    on: {
      title: '打开 Streaming',
      body: [
        '打开 Admin → **Clan settings** → **Profile**，把 **Streaming** 打开。',
        '只有公开氏族可以直播。观众必须能打开你的活动页面，而私密氏族会把它对他们隐藏。打开了 Streaming 的氏族，在你关掉它之前不能设为私密。',
        '打开之后，就在它下面连接你的 Twitch、YouTube 或 Kick 频道。',
      ],
    },

    event: {
      title: '向观众开放一场活动',
      body: [
        '每场活动在你另行设置之前都保持 **Members only**。和以前一样。',
        '打开活动的 **Settings** → **Entry & co-hosts** → **Who can join?**，选 **Members and viewers**。然后选择 **Which viewers?**：任何人，或者关注者、订阅者、某个 Discord 身份组等等。按 **Save**。',
        '这些检查只针对观众。你的氏族成员和以前一样，始终能进。',
      ],
    },

    viewers: {
      title: '观众是什么',
      body: [
        '加入的观众是**活动玩家**，只参加那一场活动。',
        '他们不是氏族成员，也不是访客。他们永远不会出现在你的氏族名单上，也不会获得任何等级。',
        '你可以在 **People** → **Past viewers** 下看到所有以这种方式加入的人。',
        '有想留住的常客？在他们那一行按 **Make guest**，即可把他们变为氏族访客，这样他们就能加入你所有对访客开放的活动，而不仅限于这一场。**Make a guest a viewer again** 则会把访客改回只属于某一场活动的观众。',
      ],
    },

    tools: {
      title: '你的直播工具',
      body: [
        '直播工具和创作者空间里一样：已验证的频道链接、**Who can join?** 检查、OBS 浮层和聊天里的 `!join`。',
        '氏族活动的浮层链接在活动的 **Settings** → **Stream** → **Stream overlay**。`!join` 和浮层标记在 **Clan settings** → **Profile** → **Streaming** 下。',
        '[创作者指南]({creatorsGuide})会一步一步讲每一项。',
        '直播高光在这里也能用：连接 Twitch 或 YouTube 后，Anvil 会剪下向观众开放的活动里的精彩时刻。Kick 聊天里的 `!join` 在 **Kick channel** 框里有自己的开关。',
      ],
    },

    faq: {
      title: '常见问题',
      intro: '简短的回答：',
      rows: [
        {
          term: '观众会占用我们的成员名额吗？',
          body: '不会。他们是活动玩家，不是成员。主播的人数限制是按你举办的所有活动里同时在场的玩家数来算的（见[创作者指南]({creatorsGuide})）。',
        },
        {
          term: '`!join` 会把人带到仅限成员的活动吗？',
          body: '不会。它只指向向观众开放的活动。',
        },
        {
          term: '我应该改建一个创作者空间吗？',
          body: '只有在你没有氏族时才需要。空间是给没有游戏内氏族的主播用的。',
        },
      ],
    },
  },
  people: {
    metaTitle: '你的成员：名单、访客与谁能加入 — Anvil',
    metaDescription:
      'Anvil 氏族的成员名单从哪里来，Members、Guests、Roster only、Departed 和 Quiet 各是什么意思，加入申请与 Needs review 怎样运作，Who can join 的三个设置，以及移除或封禁某人。',
    eyebrow: 'Anvil · 面向氏族管理团队',
    title: '你的成员：名单、访客与谁能加入',
    dek: 'Admin → **People** 下的每个人，都是从四条路之一进来的：游戏内氏族名单列出了他们、管理团队批准了他们、氏族允许任何人进入，或者有人手动添加了他们。这里讲每条路怎样运作、Roster 标签页在告诉你什么，以及有人出现在错误位置时该查什么。',
    facts: [
      { strong: '游戏内名单', rest: '是成为成员唯一的自动途径' },
      { strong: '登录', rest: '从不会把任何人放进名单' },
      { strong: '两条队列', rest: '分别在两个不同的标签页' },
    ],
    footnote:
      '这里的一切都在 Admin → **People** 下。Roster 和 Needs review 是管理员的工作。**Who can join** 和 **Staff & roles** 是仅限 admin 的标签页。整个管理区域里谁能做什么，见[管理团队角色：谁能做什么]({staffGuide})。',

    roster: {
      title: '名单从哪里来',
      body: [
        '成员名单就是你们的游戏内氏族名单，被复制到了站点上。由 admin 用 Anvil 插件从 RuneLite 发送：按氏族窗口标题栏里的 **Anvil** 按钮，或插件侧边栏里的 **Sync roster**。名单上的每个人都以**成员**身份进来，并带着各自的游戏内等级。只有在站点上拥有 Admin 角色的人才能发送，其他人会在游戏里收到提示。',
        '同步是唯一能单凭自身让某人成为成员的东西。在游戏里离开氏族的人，会在下一次同步时被标为已离开；重新加入的人，会在再下一次同步时回来。无论哪种情况，他们的历史记录都会保留。',
        '其他所有席位都是**访客**席位：在你们的活动里参赛、但不在你们游戏内氏族里的人。访客会被记录，也能参加活动。他们不是成员，也不计入你们的套餐。',
      ],
      note: {
        tag: '登录从不会把任何人放进名单',
        body: '用 Discord 登录、关联角色或带着插件游玩，都不会给任何人席位。如果插件看到某人的游戏内氏族是你们的、但他还不在名单上，它会替他提出申请（见步骤 3）。其他人只是拥有一个不属于任何氏族的 Anvil 账号。正是这一点挡住了陌生人靠输入你们的氏族名就加入。',
      },
    },

    filters: {
      title: '看懂 Roster 标签页',
      intro:
        '顶部的条把名单分成 **Members**、**Guests** 和 **Departed**。点击其中一段即可按它筛选。下面的标签还能进一步缩小列表：',
      rows: [
        {
          term: 'Active',
          body: '仍在名单上的成员。访客和已离开的人不在其中。',
        },
        {
          term: 'Quiet 7d+',
          body: '插件七天或更久没见到在玩的成员。从没用过插件的人不在这里，因为没有任何依据可以判断。他们的 **Last played** 会显示 **no plugin data**。',
        },
        {
          term: 'Guests',
          body: '当前的访客席位：在你们的活动里参赛、但不在你们游戏内氏族里的人。',
        },
        {
          term: 'Roster only',
          body: '背后还没有站点账号的当前成员和访客。从没用 Discord 登录过的人都是这样，这很正常。他们会留在名单上；等想报名什么时，再登录并关联角色即可。',
        },
        {
          term: 'Departed',
          body: '在游戏里离开的人，或被管理团队移除的人。他们的成绩和历史记录都会保留。',
        },
        {
          term: 'All',
          body: '以上所有人。',
        },
      ],
      outro:
        '**Source** 列说明每个席位是怎么来的：**Clan sync**、**Added manually** 或 **Applied or self-reported**。**Last played** 来自插件，而不是名单同步。',
      note: {
        tag: '等级和角色是两回事',
        body: '标签旁的两个下拉菜单，分别按游戏内等级和站点角色筛选。等级就是游戏报告的那个。站点角色是 admin 在 **Staff & roles** 里设定的。两者互不影响。',
      },
    },

    review: {
      title: '加入申请与 Needs review',
      intro: '有两类人在等一个「同意」，而且他们在不同的标签页里等。',
      rows: [
        {
          term: 'Asking to join',
          body: '在 **Roster** 标签页顶部，只在有人等待时出现。申请来自站点（他们在你们的氏族页面按了 **Apply**，或想参加你们的某场活动），或来自插件（它在名单收录他们之前，就看到他们在你们的游戏内氏族里游玩）。每一行都会写明来源，以及他们是否是其他氏族的成员。**Approve** 给他们一个访客席位。**Decline** 会通知他们，在你们的机器人能联系到时通过 Discord 私信。勾选多行即可一次处理。',
        },
        {
          term: 'Awaiting confirmation',
          body: '在 **Needs review** 里。这些人通过在你们名单上的某个角色身上获得经验、提出申请，或带着插件玩这个角色，关联了它。等待期间他们已经可以参赛。核对 Discord 名字和角色是否对得上，然后按 **Approve**。**Not our member** 会把这个角色从你们的列表中拿掉，留给它的主人。**Report to Anvil** 用于角色根本不是他们的情况。',
        },
        {
          term: 'Claim requests',
          body: '同样在 **Needs review** 里。有人玩了一个在这里早已是老成员的角色，所以 Anvil 不会自行把它关联给这个人。如果你知道就是他本人，按 **Yes, that’s them**；如果不是，按 **Not them**。只在你们氏族待过的角色会被立即关联；同时也在其他氏族里的角色则交由 Anvil 决定。',
        },
      ],
      note: {
        tag: '徽章不计入加入申请',
        body: '**Needs review** 上的数字，以及侧边栏 **People** 上的数字，统计的是 Awaiting confirmation 和 Claim requests。加入申请不在其中，所以也要看看 Roster 标签页的顶部。',
      },
    },

    policy: {
      title: '谁能加入',
      intro:
        'Admin → People → **Who can join** 里有三个设置，只有 admin 能看到这个标签页。决定外人如何进来的是 **Players from other clans**：',
      rows: [
        {
          term: 'Ask first',
          body: '默认值。申请的人，或插件从你们游戏内氏族里发现的人，会作为加入申请等待，直到管理团队批准。没有「同意」，谁也拿不到席位。',
        },
        {
          term: 'Let anyone in',
          body: '提出申请就够了。他们会立即得到访客席位，不会留下申请。适合公开活动，其他时候会很吵。',
        },
        {
          term: 'No guests',
          body: '只有你们自己的成员能参加。其他氏族的玩家无法参加你们的活动，也无法申请加入，插件也不会为他们提出任何申请。',
        },
      ],
      outro:
        '**Who can see this clan** 可选 **Anyone**（棋盘链接发给谁，谁就能打开）或 **Members only**（其他人只能看到氏族卡片和申请邀请）。**List in the Clan Hall** 会把氏族放进公开的氏族列表。关掉它并不会让氏族变成私密。',
      note: {
        tag: '这些都不影响你们的成员',
        body: '无论这些怎么设，名单同步都会给成员席位。你们自己的管理团队也从不会被当作访客：管理团队成员的角色无需申请就会得到成员席位。',
      },
    },

    manual: {
      title: '手动添加某人',
      body: [
        'Roster → **+ Add Manually** 会把一个角色放进名单。填写 **RSN**，可选填 **Discord ID** 和 **Rank**。不在你们游戏内氏族里的人，勾选 **Add as guest**。管理员和 admin 都能这样做。',
        '它用于同步还看不到的人，比如上次同步之后才加入的新人。这个席位会标为 **Added manually**，同步会把它当作你们的决定：如果你之后移除了一个手动添加的席位，下一次同步不会把它加回来。',
        '把某人加进名单，并不会替他报名活动。要报名，打开活动的 **Sign-ups** 标签页并使用 **Add member**。那一项仅限 admin。',
      ],
    },

    removing: {
      title: '移除与封禁',
      intro: '名单的每一行都有一个操作菜单。这些操作效果各不相同：',
      rows: [
        {
          term: 'Demote to guest',
          body: '他们留在列表上，仍可被加入活动，但不再算作成员。**Promote to member** 可以撤销。',
        },
        {
          term: 'Remove from roster',
          body: '把他们标为已离开。他们的历史记录和成绩会保留。如果他们仍在你们的游戏内氏族里，下一次名单同步可能会把他们加回来。',
        },
        {
          term: 'Not our member',
          body: '在 Needs review 里，用于某人关联的、不在你们氏族里的角色。它会从你们的列表中移除，留给它的主人。',
        },
        {
          term: 'Ban from this clan',
          body: '结束此人在这里的所有席位（包括小号），移除他在本氏族担任的所有管理团队角色和棋盘职务，并阻止他回来：在封禁解除之前，名单同步、插件和加入申请都会拒绝他。他的 Anvil 账号和其他氏族不受影响。仅限 admin，且只能针对有站点账号、角色低于 admin 的人；可从行菜单、**Staff & roles** 操作，也可以一次封禁多人。解除封禁不会让他回来；他需要在游戏里重新加入，或由你们添加。',
        },
      ],
      note: {
        tag: '封禁也会移除管理团队角色',
        body: '封禁某人会结束他的席位，并拿走他的管理团队角色，以及他在本氏族棋盘上的棋盘编辑或棋盘司库职务。解除封禁不会把这些还给他：如果他还该拥有角色，请在 Staff & roles 重新设置。',
      },
    },

    faq: {
      title: '常见问题',
      intro: '有人出现在错误位置时，通常是这些原因。',
      rows: [
        {
          term: '氏族里有人不见了',
          body: '先运行一次名单同步：名单只有在 admin 发送时才会变。然后查看 **Departed**，看他们是否被移除过，以及是否被封禁；同步会跳过在这里被封禁的人，并报告跳过了谁。如果氏族超出了套餐、且宽限期已过，同步会停止添加新成员，直到你们升级或精简名单。',
        },
        {
          term: '某人显示为访客，但他在氏族里',
          body: '通常是因为他仍是 Anvil 上另一个氏族的成员。一个角色同一时间只能是一个氏族的成员，所以同步会让他在这里先以访客身份入座，并在他离开另一个氏族后的第一次同步时让他成为成员。否则就是他通过加入申请进来，或有人把他降为访客、或以访客身份添加了他。运行一次同步，或使用 **Promote to member**。',
        },
        {
          term: '某人登录了，但不在名单上',
          body: '这在预料之中。登录创建的是 Anvil 账号，不是席位。当同步列出他、你们批准他的申请，或你们手动添加他时，他才会出现。',
        },
        {
          term: '像 #Player1234 这样的名字',
          body: '玩家登录时，RuneLite 会短暂显示这样的占位名；对它叫不出名字的氏族成员也是如此。Anvil 现在会忽略这类名字：同步会跳过它们，插件不会为它们提出申请，旧的这类申请也会被隐藏。如果你们的名单上还有一个，那是旧记录，用 **Remove from roster** 清掉即可。',
        },
        {
          term: '被移除的成员总是回来',
          body: '移除某人不会改变游戏内氏族，所以只要游戏里还列着他，下一次同步就会把他加回来。在游戏里把他移出，或在这里封禁他。',
        },
        {
          term: '管理员看不到 Who can join',
          body: '那是仅限 admin 的标签页，和 Staff & roles 一样。见[管理团队角色：谁能做什么]({staffGuide})。',
        },
      ],
    },
  },

  staffRoles: {
    metaTitle: '管理团队角色：谁能做什么 — Anvil',
    metaDescription:
      'Anvil 上的氏族角色（所有者、admin、司库、管理员、成员），各自能管到哪里，怎样让某人成为管理员，谁能授予哪个角色，以及只负责一场活动的职务。',
    eyebrow: 'Anvil · 面向所有者和 admin',
    title: '管理团队角色：谁能做什么',
    dek: '五个角色，按氏族在 Admin → People → **Staff & roles** 里设定。这里的角色在任何其他氏族里都不起作用，而且没人能授予与自己同级或更高的角色。本页是完整的地图：每个角色能管到哪里、怎样授予，以及只负责一场活动的职务。',
    facts: [
      { strong: '按氏族', rest: '这里的角色在别处毫无意义' },
      { strong: '低于你自己', rest: '的角色才能授予' },
      { strong: '所有者', rest: '只能通过转让易主' },
    ],
    footnote:
      '每次加载页面都会重新检查角色，所以改动在对方下一次点击时就会生效；他们不需要退出登录。名单本身见[你的成员]({peopleGuide})。管理员的日常见[当班]({moderatorGuide})。',

    roles: {
      title: '各个角色',
      intro: '每个用 Discord 登录的人，一开始都是普通的 **Member**。在它之上：',
      rows: [
        {
          term: 'Owner',
          body: '创建氏族的人，直到他把氏族交出去。admin 能做的一切，外加转让所有权和删除氏族。所有者有且只有一位，谁也不能将其降级、移除或封禁。',
        },
        {
          term: 'Admin',
          body: '除了交出氏族之外的一切：活动与棋盘、设置、Discord、管理团队，以及氏族的钱。',
        },
        {
          term: 'Treasurer',
          body: '报名费、金库和奖金，再加上管理员能做的一切：名单、凭证、竞赛、日程和 Needs review。',
        },
        {
          term: 'Moderator',
          body: '新人、名单、凭证、每周竞赛和氏族活动。不碰活动或棋盘，不碰设置、管理团队和钱。',
        },
        {
          term: 'Member',
          body: '没有管理职务。参赛、报名，并且可以向金库报告一笔捐款。',
        },
      ],
      outro:
        'Staff & roles 里角色下方有两个勾选框，适用于 admin 以下的任何人，包括普通成员。**Can build bingo boards** 会开放每块棋盘的 Tiles 标签页和 Task library。**Can write guides** 让他们能为氏族编写指南。admin 本就两者都有。',
    },

    assign: {
      title: '让某人成为管理员',
      intro:
        '对方需要已经用 Discord 登录，并关联了一个在你们名单上的游戏角色（成员或访客均可）。然后：',
      steps: [
        '打开 Admin → **People** → **Staff & roles**。',
        '列表默认显示 **Staff**。切换到 **Members** 或 **All accounts**，搜索他的名字。',
        '在 **Role** 列中选择 **Moderator: newcomers, roster, sign-ups, proofs**。一选就会保存。',
        '如果他也该搭建棋盘，勾选 **Can build bingo boards**。',
      ],
      outro:
        '还没登录？在 **Roster** 标签页找到他的游戏角色，打开菜单并选择 **Set role**。这样角色会先记在这个游戏角色上。他第一次登录并关联它时就会拿到；如果他正在 Needs review 里等待，则在管理员批准他时拿到。',
      note: {
        tag: '收回角色',
        body: '把角色改回 **Member**。更改某人的角色，也会移除他在本氏族棋盘上的所有棋盘职务（见步骤 5），所以如果他还该保留，之后再重新添加。',
      },
    },

    who: {
      title: '谁能授予什么',
      intro:
        'Staff & roles 是仅限 admin 的标签页，上面的每一次改动都要对照两条规则检查：你只能授予低于自己的角色，也只能更改角色低于自己的人。',
      rows: [
        {
          term: '所有者',
          body: '可以授予或收回 Admin、Treasurer 和 Moderator。',
        },
        {
          term: 'admin',
          body: '可以授予或收回 Treasurer 和 Moderator。admin 不能任命另一位 admin，不能更改另一位 admin，也不能更改自己的角色。',
        },
        {
          term: '司库和管理员',
          body: '不能更改任何人的角色。这个标签页对他们是隐藏的。',
        },
        {
          term: '没有人',
          body: '能更改所有者的角色、移除或封禁所有者。氏族也始终保留至少一位 admin：最后一位不能被降级。',
        },
      ],
      note: {
        tag: '交出氏族',
        body: '只有所有者可以，而且只能交给已经是 admin 的人：那位 admin 的那一行会出现 **Make owner** 操作。为了安全，转让需要 3 天，就像更改银行 PIN 一样：每个管理页面都会有横幅显示生效时间，在此之前你可以点 **Cancel** 取消，对方可以点 **Decline** 拒绝，Anvil 工作人员也会收到通知并可以阻止。3 天后对方成为所有者，你则成为普通 admin。只有新所有者才能再转让回来。',
      },
    },

    table: {
      title: '谁能做什么',
      intro:
        '每个角色在管理区域里能进入什么。「勾选时」指 Staff & roles 里的 **Can build bingo boards** 或 **Can write guides** 勾选框。',
      areaLabel: '区域',
      columns: ['所有者', 'Admin', '司库', '管理员', '成员'],
      rows: [
        { area: '仪表盘', cells: ['是', '是', '是', '是', '否'] },
        { area: '活动：创建、编辑、队伍、报名、开赛', cells: ['是', '是', '否', '否', '否'] },
        { area: '棋盘格子和 Task library', cells: ['是', '是', '勾选时', '勾选时', '勾选时'] },
        { area: '待核查的凭证', cells: ['是', '是', '是', '是', '否'] },
        { area: '每周竞赛', cells: ['是', '是', '是', '是', '否'] },
        { area: '氏族活动', cells: ['是', '是', '是', '是', '否'] },
        { area: '日程', cells: ['是', '是', '是', '是', '否'] },
        { area: '名单：查看、添加、移除', cells: ['是', '是', '是', '是', '否'] },
        { area: '加入申请和 Needs review', cells: ['是', '是', '是', '是', '否'] },
        { area: '在氏族中封禁某人', cells: ['是', '限 admin 以下', '否', '否', '否'] },
        { area: 'Staff & roles', cells: ['是', '限 admin 以下', '否', '否', '否'] },
        { area: 'Who can join', cells: ['是', '是', '否', '否', '否'] },
        { area: '金库和奖励阶梯', cells: ['是', '是', '是', '否', '否'] },
        { area: '报名费：标记为已收', cells: ['是', '是', '是', '否', '否'] },
        { area: '报名费：确认（第二个签名）', cells: ['是', '是', '否', '否', '否'] },
        { area: 'Discord 设置', cells: ['是', '是', '否', '否', '否'] },
        { area: '发布到 Discord', cells: ['是', '是', '否', '否', '否'] },
        { area: '氏族设置：Profile、Features、Rules & scoring、Boosts', cells: ['是', '是', '否', '否', '否'] },
        { area: '套餐与账单', cells: ['是', '是', '否', '否', '否'] },
        { area: '指南', cells: ['可写', '可写', '可读；勾选时可写', '可读；勾选时可写', '勾选时可写'] },
        { area: 'Activity log', cells: ['是', '是', '是', '是', '否'] },
        { area: '从 RuneLite 同步名单', cells: ['是', '是', '否', '否', '否'] },
        { area: '转让所有权、删除氏族', cells: ['是', '否', '否', '否', '否'] },
      ],
      note: {
        tag: '隐藏不等于禁止',
        body: '侧边栏只列出你的角色能用的东西，但真正算数的检查在服务器上进行。直接输入你的角色无法使用的页面地址，会把你送回仪表盘，背后的操作也会被拒绝。',
      },
    },

    event: {
      title: '单场活动的职务',
      intro:
        '有些职务只负责一场活动，而不是整个氏族。由 admin 在活动本身上授予，它们只触及那场活动，别的都碰不到，所以交给普通成员也很安全。',
      rows: [
        {
          term: '棋盘编辑',
          body: '搭建和编辑那块棋盘的格子。在活动的 **Settings** → **Staff** → **Board staff** 中授予，或在 Staff & roles 某人的操作里用 **Boards…** 授予。获得这一职务的成员，在管理区域里只能看到自己的棋盘。',
        },
        {
          term: '棋盘司库',
          body: '收取那块棋盘的报名费并执行它的奖金发放，但碰不到氏族金库。在管理区域里，他们只能看到自己的棋盘，而且每块棋盘只能看到 **Sign-ups** 和 **Prizes** 两个标签页。同样在 **Board staff** 下授予。',
        },
        {
          term: '队伍管理',
          body: '管理一支队伍：它的名单、提交与凭证，以及把队员的报名费标为已付。他们不能碰其他队伍、编辑棋盘、进行选秀，也不能在活动开始后换下任何人。在队伍页面的 **Team staff** 下添加。来访氏族的管理员就是这样打理他们那一半氏族对抗赛的。',
        },
        {
          term: '队长',
          body: '由主办方为一支队伍指定。队伍管理能做的一切，外加为队伍进行选秀。',
        },
      ],
      note: {
        tag: '氏族角色会取代棋盘职务',
        body: '授予某人氏族角色或更改它，都会移除他在本氏族棋盘上的棋盘编辑和棋盘司库职务。如果棋盘职务是他仅有的职务，Staff & roles 会先提醒你。如果他还该保留，之后再重新添加。',
      },
    },

    safety: {
      title: '保持安全',
      intro: '无论角色怎么设，这些都成立。',
      rows: [
        {
          term: '所有者受保护',
          body: '他在 Staff & roles 上的那一行显示 **Protected**。他的角色不能更改，他也不能被封禁。所有权只有在他转让时才会易手。',
        },
        {
          term: 'admin 之间不能互相移除',
          body: 'admin 既不能降级、也不能封禁另一位 admin，无论是一次一位还是一次多位。两位 admin 意见不合时，由所有者决定。封禁也会拿走此人在本氏族的管理团队角色和棋盘职务。',
        },
        {
          term: '钱要两个人经手',
          body: '当一笔报名费需要确认时，确认必须来自标记「已收」那个人以外的另一位 admin。一笔费用需要几次确认（零到五次），在 **Clan settings** → **Rules & scoring** → **Fee sign-off** 中设定。独自管钱的 admin 仍可以用一个单独的按钮强制结清费用。',
        },
        {
          term: '管理员不能做的事',
          body: '创建或编辑活动、更改设置或 Discord、授予任何人角色（包括他自己），或碰氏族的钱。',
        },
        {
          term: '一切都有记录',
          body: '角色变更、所有权转让、封禁和已处理的加入申请都会写入 **Activity log**，每位管理团队成员都能查看。',
        },
        {
          term: 'Discord 身份组是另一回事',
          body: 'Anvil 的身份组同步把 Discord 身份组对应到**游戏内等级**，而不是站点角色。在这里让某人成为管理员，并不会在你们的 Discord 服务器里给他任何东西；你们在 Discord 里手动发出的管理身份组也不会被动。唯一会改动东西的机器人命令 —— 用 `/coffer` 往金库里添加 —— 检查的是站点角色：司库、admin 或所有者。',
        },
      ],
    },
    log: {
      title: '活动日志',
      body: [
        '管理菜单中的 **Activity log** 列出最新的 200 条变更，每位工作人员都可以阅读：加入、离开、改名与验证、所有权转移、队长的任命与撤销、报名的批准或拒绝、费用的确认、功能的开关以及设置的更改。**Filter by event type** 可以缩小范围。',
        '重复记录也在这里被整理。**Merge two members** 会把重复的成员并入真正的那一位，**Suspected renames** 则列出 Anvil 为你发现的改名，供你确认或驳回。',
      ],
    },
  },
  supporter: {
    metaTitle: 'Anvil Supporter：档位与福利 — Anvil',
    metaDescription:
      'Anvil Supporter、Champion 和 Patron 各自得到什么：名字颜色和星标、金色 GZ、动态头像和横幅、展示柜、好友活动、一对一挑战、活动聊天和氏族助力。Gumroad 付费怎样运作，以及取消后会怎样。',
    eyebrow: 'Anvil · 面向玩家',
    title: 'Anvil Supporter：档位与福利',
    dek: 'Anvil Supporter 是一项个人订阅，用来支付 Anvil 的服务器费用。它分三个档位，每一档都包含下一档的全部内容。每项福利都只关乎外观或办活动的空间：记录、活动、计分和你自己的数据对所有人始终免费，这里的任何东西都不会改变一场活动的计分。',
    facts: [
      { strong: '每月 $1 起', rest: '或每年 $10' },
      { strong: '只关乎外观', rest: '绝不涉及分数、排名或物品' },
      { strong: '什么都不会删除', rest: '即使你停止付费' },
    ],
    footnote:
      '这里的一切都在网站的 **Settings** → **Supporter**、**Profile look** 和 **Clan boosts** 里设置。助力的详情见[为氏族助力]({boostsGuide})。你的颜色在 RuneLite 里出现在哪里，见[侧边面板逐个标签页讲解]({panelGuide})。',

    tiers: {
      title: '三个档位',
      intro: '价格在 **Anvil Supporter** 页面 `/supporter` 上。年付方案的价格等于十个月。',
      rows: [
        {
          term: 'Supporter',
          body: '每月 $1 或每年 $10。金色名字和星标、金色 GZ、4 格展示柜，并且可以举办一场好友活动。',
        },
        {
          term: 'Champion',
          body: '每月 $2 或每年 $20。从我们的预设渐变中选择名字颜色（或一种自选单色）、你自己的头像和横幅（可以是动态的）、8 格展示柜、更快的活动聊天，以及 1 次氏族助力。',
        },
        {
          term: 'Patron',
          body: '每月 $5 或每年 $50。最多 4 种颜色的自定义渐变，而且会流动、12 格展示柜、活动聊天无需等待、同时举办 2 场好友活动，以及 2 次氏族助力。',
        },
      ],
      note: {
        tag: '邀请换来的时长',
        body: '在 Settings → Supporter 下有你的邀请链接。你邀请的朋友付费后，你会获得免费月份；奖励在对方首次付款两周后到账。用这种方式获得的时长，享有该档位除氏族助力之外的全部福利。',
      },
    },

    compare: {
      title: '每个档位得到什么',
      intro: '和 Supporter 页面上的表格相同，另加了聊天福利。',
      table: {
        areaLabel: '福利',
        columns: ['免费', 'Supporter', 'Champion', 'Patron'],
        rows: [
          { area: '名字颜色', cells: ['—', '金色', '预设，或一种自选颜色', '预设，或最多四种颜色，会流动'] },
          { area: '名字旁的星标', cells: ['—', '有', '有', '有'] },
          { area: '金色 GZ', cells: ['—', '有', '有', '有'] },
          { area: '自己的头像和横幅，可动态', cells: ['—', '—', '有', '有'] },
          { area: '展示柜', cells: ['—', '4 格', '8 格', '12 格'] },
          { area: '好友活动（同时场数 · 人数）', cells: ['仅可加入', '1 · 10', '1 · 25', '2 · 50'] },
          { area: '一对一挑战', cells: ['同时 1 个', '同时 5 个', '不限', '不限'] },
          { area: '活动聊天：两句之间的等待', cells: ['5 秒', '3 秒', '1 秒', '无'] },
          { area: '氏族助力', cells: ['—', '—', '1', '2'] },
        ],
      },
      outro:
        '**Settings** → **In-game chat** 下还有三项：你自己的聊天动态颜色（Supporter）、选择登录简报包含哪些内容（Champion），以及在其他玩家的聊天动态里你名字旁的星标（Patron）。',
    },

    names: {
      title: '名字颜色',
      intro:
        '在 **Settings** → **Supporter** 的 **Your name’s look** 里设置。预览会显示你的名字在深色背景和浅色背景上的样子。',
      rows: [
        {
          term: 'Supporter',
          body: '纯金色。没有可选的。',
        },
        {
          term: 'Champion',
          body: '预设渐变之一（默认的 **Classic**、**Ember**、**Ocean**、**Aurora**、**Rose gold** 或 **Toxic**），或 **Your own**：一种静态颜色。在你所有的角色上，最多只能用两种不同的自选颜色。',
        },
        {
          term: 'Patron',
          body: '全部预设，外加 Patron 默认的 **Prism**；或者一到四种颜色的 **Your own**。一种颜色保持静止；两到四种颜色组成从左向右流动的渐变。',
        },
      ],
      outro:
        '**Your Anvil display name** 是你关联 Discord 的账号上的名字。在 **Your RuneScape characters** 下，选择 **Same for all** 或 **Customize each**，为每个角色设置各自的外观。按 **Save**（或 **Save for all characters**）；**Reset to default** 会恢复为你档位的颜色。',
      note: {
        tag: '深色和浅色背景',
        body: '网站、插件面板和 Discord 是深色的；游戏的不透明聊天框是浅色的。Anvil 会调整你的颜色，让它在两者上都清晰可读。如果你想在其中一种上用不同的外观，打开 **Set a separate look for dark backgrounds** 或 **for light backgrounds**。那个外观会完全按你选的显示，不做对比度修正；难以阅读时预览会提醒你。',
      },
    },

    where: {
      title: '你的装饰出现在哪里',
      intro: '你的颜色和星标会出现在你名字出现的每个地方：',
      rows: [
        {
          term: '网站上',
          body: '棋盘、名单、资料页、顶栏里你自己的名字，以及你的角色名。星标也用你的颜色。',
        },
        {
          term: '插件面板里',
          body: 'Feed、活动聊天、卡片和 **Tracking** 那一行。Patron 的渐变会流动；每位玩家都可以用 **Animated names** 让它停下。',
        },
        {
          term: '游戏里',
          body: '对其他使用 Anvil 插件的玩家可见：公共、氏族、好友和私聊，氏族广播，登录提示，好友和氏族列表，以及右键菜单（PvP 世界和荒野中绝不显示）。在游戏聊天里，星标是 Patron 专属的。',
        },
        {
          term: 'Discord 里',
          body: 'Anvil 发布的帖子里你名字旁的星标；如果你选了颜色，就用你的颜色绘制。',
        },
        {
          term: '金色 GZ',
          body: '在网站上氏族动态里氏族成员的掉落下，你的 GZ 可以是金色的。只有 Supporter 能给出。',
        },
      ],
      note: {
        tag: '只在被证实属于你的角色上',
        body: '无论在网站上还是游戏里，颜色只出现在插件已确认属于你的角色上。若不想在别人的游戏聊天里让你的名字带颜色，在 Settings → Supporter 下取消勾选 **Show my colours on my characters’ names in game chat**。',
      },
    },

    profile: {
      title: '头像、横幅和展示柜',
      intro: '三者都在 **Settings** → **Profile look** 下。',
      rows: [
        {
          term: '头像和横幅',
          body: 'Champion 和 Patron 可用。上传你自己的图片；GIF 或 WebP 会保持动态。它们会出现在你的卡片、你的资料页和你的每个角色上，网站和插件里都有。横幅最大 6 MB，至少 600×150；头像最大 2 MB。',
        },
        {
          term: '按角色设置',
          body: '给某个角色单独设置横幅或头像，或两者都设。它只在该角色的页面和插件卡片上替换你的默认设置。',
        },
        {
          term: '展示柜',
          body: '把你最好的掉落、击杀数和用时钉在资料页上：Supporter 4 格，Champion 8 格，Patron 12 格。来自你没有公开的角色的展示项保持私密。',
        },
      ],
    },

    hosting: {
      title: '好友活动、一对一挑战和聊天',
      intro: '这些福利给你更多玩的空间，而不是外观：',
      rows: [
        {
          term: '好友活动',
          body: '在 **Host an event for your friends** 里为朋友举办你自己的宾果、单人宾果或竞速，由插件像氏族活动一样记录。朋友通过你的邀请链接加入。Supporter：1 场进行中的活动，10 名玩家。Champion：1 场，25 名玩家。Patron：同时 2 场，合计 50 名玩家。任何人都能加入。',
        },
        {
          term: '一对一挑战',
          body: '在朋友的资料页向他发起挑战：谁先拿到某个掉落，或在 1 小时、24 小时或 7 天内谁的击杀数或经验更多。只为面子，不涉及其他。免费玩家同时可有 1 个，Supporter 5 个，Champion 和 Patron 想要多少都行。',
        },
        {
          term: '活动聊天',
          body: '两句之间要等多久：没有档位 5 秒，Supporter 3 秒，Champion 1 秒，Patron 无需等待。当某块棋盘的聊天变得繁忙时，所有人都要等 10 秒，Patron 也不例外。',
        },
        {
          term: '氏族助力',
          body: '付费期间，Champion 1 次，Patron 2 次。见[为氏族助力]({boostsGuide})。',
        },
      ],
    },

    billing: {
      title: '付费、变更和取消',
      intro: 'Anvil Supporter 通过 Gumroad 收费，按月或按年。',
      steps: [
        '在 Anvil 上登录，打开 `/supporter`。',
        '按 **Choose Supporter**、**Choose Champion** 或 **Choose Patron**。Gumroad 的结账页面会打开，可选按月或按年付费。',
        '付款。Gumroad 一通知 Anvil，你的福利就会开启，你的档位会以 **Your tier** 显示在 Supporter 页面上。',
      ],
      outro:
        '要更换档位，用 Settings → Supporter 下的 **Change tier**。要取消或更新银行卡，用同一处的 **Manage on Gumroad**。已取消的会员在已付费周期结束前保留全部福利。',
      note: {
        tag: '始终从 /supporter 开始',
        body: '**Choose** 按钮带着一个代码，告诉 Anvil 是哪个账号付的款。Anvil 从不按邮箱匹配付款，所以不经过那个按钮、直接在 Gumroad 上购买，付款就不会关联到任何账号。如果发生了这种情况，请到 Anvil Discord 里询问，工作人员可以手动把它关联到你的账号。',
      },
    },

    lapse: {
      title: '降档或停止',
      intro:
        '你设置的东西一样都不会删除。每项福利都按你当前的档位检查，所以它会自动关闭，并在你续费后立刻恢复。',
      rows: [
        {
          term: '名字颜色',
          body: '你保存的选择会一直保存着。在允许它的档位回来之前，你显示新档位的颜色，或者没有颜色。',
        },
        {
          term: '头像和横幅',
          body: '低于 Champion 时，它们显示静止的第一帧，而不是动起来。',
        },
        {
          term: '展示柜',
          body: '显示你的档位允许的前几个展示项，其余隐藏。没有档位时整个展示柜隐藏；展示项会等着你。',
        },
        {
          term: '氏族助力',
          body: '你最早的助力继续算数，其余的暂停，而不是被移除。',
        },
      ],
      note: {
        tag: 'Anvil 工作人员给的临时升级',
        body: '工作人员可以在一段时间内给某人更高的档位，比如作为感谢。它叠加在你付费的档位之上，从不改变你的订阅。Settings → Supporter 会显示 **A gift from Anvil** 以及它何时结束；之后你回到自己付费的档位。只有工作人员把氏族助力名额包含在内时，赠送才会带来助力名额。',
      },
    },
  },

  sidePanel: {
    metaTitle: 'Anvil 侧边面板逐个标签页讲解 — Anvil',
    metaDescription:
      'Anvil RuneLite 侧边面板的每个标签页（Clan、Feed、You、Lookup 和齿轮）显示什么，活动聊天和 Feed 反应怎样运作，以及关于游戏聊天中的动态、Supporter 颜色和动态名字的插件设置。',
    eyebrow: 'Anvil · 面向玩家',
    title: '侧边面板逐个标签页讲解',
    dek: 'RuneLite 侧边栏里的 Anvil 按钮会打开一个面板，有四个标签页和一个齿轮：**Clan**、**Feed**、**You**、**Lookup** 和 ⚙。它显示的大部分内容来自网站，所以不用更新插件也会保持最新。下面有几项标注为将在下一次插件更新中推出。',
    facts: [
      { strong: '四个标签页', rest: '外加一个用于同步和设置的齿轮' },
      { strong: '活动聊天', rest: '在 Feed 标签页里' },
      { strong: 'GZ、Sad、Sit', rest: '在 Feed 的每一行上' },
    ],
    footnote:
      '安装插件和登录见[RuneLite 插件设置]({pluginGuide})。Supporter 颜色、星标和聊天福利在[Anvil Supporter：档位与福利]({supporterGuide})里说明。',

    header: {
      title: '面板顶部',
      intro: '标签页上方是标题、**Refresh** 和账号那一行。',
      rows: [
        {
          term: 'Refresh',
          body: '重新加载面板，包括 Feed 标签页。加载时显示 **Refreshing…**。在下一次插件更新中，它也会重新加载 You 和 Lookup，所以新头像或横幅会立刻显示，而且不再清空 Feed 标签页。',
        },
        {
          term: 'Tracking',
          body: '标题下的那一行写着正在记录的角色名；如果它有 Supporter 颜色，就用那个颜色显示。**Not my account…** 会停止记录别人在这台电脑上玩的角色；**Track again** 可以撤销。',
        },
        {
          term: '账号菜单',
          body: '⋯ 链接会打开 **View my profile on Anvil**、**Not my account…** 和 **Sign out…**。在下一次插件更新中，它还会有 **Become a Supporter**，如果你已经是 Supporter，则是 **Your Supporter perks**。',
        },
        {
          term: '赛季进度',
          body: '在下一次插件更新中，在 Leagues、Deadman 和其他赛季世界里，会有一行 **Sharing season progress · Turn off**。它把你的遗物、区域和任务（附截图）发给你的氏族；发布哪些内容由你的氏族在网站上决定。**Turn on** 会重新开始分享。同一个开关也是插件设置里的 **Share seasonal activity**。',
        },
      ],
    },

    clan: {
      title: 'Clan',
      intro:
        '你的活动和你的氏族。在创作者空间里，这个标签页显示为 **Space**。',
      rows: [
        {
          term: '团队下拉菜单',
          body: '当你在多个团队或空间中游玩时显示。**All clans**（默认）显示你正在游玩的所有内容，实时活动排在最前。选择某个团队会将面板缩小到该团队，并将你的提交归入其中。',
        },
        {
          term: '接下来做什么',
          body: '顶部的金色卡片，指向现在最值得做的一件事，例如加入活动、回答问卷或开始你的起始射击。',
        },
        {
          term: '活动',
          body:
            '每个实时和即将开始的 board、Skill 或 Boss of the Week 以及团队活动，并显示你的位置。然后是 **Your other boards**、**Also live** 和 **Your clan**。',
        },
        {
          term: '一个 board',
          body:
            '打开它可查看排名（前三名和你自己的行，其余可点 **View all**）、队伍、任务、最近活动、最近的 tile 以及 **View all tiles**。其 **Feed** 和 **Chat** 按钮会在 Feed 标签页中打开该 board。',
        },
        {
          term: '排名变动',
          body: '名字旁边带数字的绿色 **▲** 或珊瑚色 **▼**，表示自当天开始以来的移动幅度。',
        },
        {
          term: '团队活动',
          body: '根据活动不同，显示 **I’m going**、**Sign me up** 或 **Answer the survey**。',
        },
      ],
    },

    feed: {
      title: 'Feed',
      intro:
        '你的氏族和棋盘上的大事，实时呈现：掉落、宠物、成就、任务、死亡和完成的格子。',
      rows: [
        {
          term: '谁的 feed',
          body: '顶部的下拉菜单列出你所属的每个团队 **Clan ·** 以及你参与的每个实时 board **Event ·**。若你有 board，则默认打开你的 board，否则打开你的团队。',
        },
        {
          term: '筛选',
          body:
            '**All**、**Tiles**（仅 boards）、**Drops**、**Pets**、**Achievements**、**Deaths**、**Milestones**（slayer、clues、击杀数等，玩家开启后）以及你在某个 board 中有队伍时的 **My team**。团队 feed 还有用于 Leagues 及其他模式的游戏模式活动按钮。',
        },
        {
          term: '新行',
          body: '会自动出现。如果你已经滚动离开，**↑ N new** 标签会带你回到它们。',
        },
      ],
      note: {
        tag: '和游戏内聊天动态不是一回事',
        body: '无论插件设置如何，Feed 标签页都能用。**Show feed in game chat**（步骤 8）是另一个设置，它会把动态也打印到你的聊天框里。',
      },
    },

    reactions: {
      title: '反应',
      intro: 'Feed 里的每一行下面都有它的反应：',
      rows: [
        {
          term: 'GZ',
          body: '用于掉落、宠物和成就。旁边会显示数量，例如 **GZ 3**。',
        },
        {
          term: 'Sad 和 Sit',
          body: '用于死亡，代替 GZ。Sit 是游戏里叫死掉的人「坐下」的调侃说法。',
        },
        {
          term: '谁能反应',
          body: '在氏族动态上，是氏族成员。在棋盘上，是该棋盘的玩家和主办方的管理团队；当一块棋盘隐藏排名时，玩家只能对自己队伍的行做出反应。',
        },
        {
          term: '谁做了反应',
          body: '把鼠标悬停在反应上即可看到名字，例如「GZ · Mossy and 3 others」。再点一次就撤回你的反应。',
        },
      ],
      note: {
        tag: '下一次插件更新中',
        body: '反应会变成胶囊按钮，你点过的会着色，其他人的反应会为所有正在看的人实时更新，包括你自己的其他客户端。目前，数量会在你做出反应或 Feed 重新加载时变化。金色 GZ 是 Supporter 的反应，在网站的动态里给出；Feed 标签页有 GZ、Sad 和 Sit。',
      },
    },

    chat: {
      title: '活动聊天',
      intro:
        '开启了聊天的棋盘，会在 Feed 标签页顶部有一个 **Feed / Chat** 切换，供该棋盘的玩家和主办方的管理团队使用。Clan 标签页里的棋盘页面也有一个 **Chat** 按钮。',
      rows: [
        {
          term: '所有人或你的队伍',
          body:
            '使用顶部的标签选择频道：**All teams** 为整个 board，**My team** 仅你的队伍，**Announcements** 仅主办方和版主可以发言。每个标签都显示你尚未阅读的行数。来自主办方和版主的行标记为 **HOST** 或 **MOD**。',
        },
        {
          term: '发送',
          body: '在输入框中输入后按 Enter。每行最多 200 个字符，只有主办方和版主可以发送链接。',
        },
        {
          term: '频率',
          body:
            '你两行之间的等待时间取决于你的 Supporter 等级：没有等级为 5 秒，Supporter 为 3 秒，Champion 为 1 秒，Patron 无等待。输入框下方的文字会说明你的等待时间。工作人员从不等待。',
        },
        {
          term: '慢速模式',
          body: '当 board 的聊天变得非常繁忙时，所有人（包括 Patron）每分钟至少要等待 10 秒。任何人 10 秒内发送的行数都不能超过 10 行。',
        },
        {
          term: '管理',
          body:
            '主办方和版主可以右键单击某行以 **Delete message** 或 **Mute** 某人，并用 **Pause chat** 暂停聊天。暂停会阻止除工作人员以外的所有人发言，**Announcements** 除外。面板中的 **Mute** 是一种禁言，持续到在管理页面解除为止。在那里你还可以给予 5 分钟、1 小时或 24 小时（或从 1 分钟到 30 天的任意时长）的禁言，这会关闭该人在所有频道的发言，并可按频道筛选聊天。',
        },
      ],
      outro:
        '同一个人连续发的多行共用一个名字和时间，直到出现 5 分钟的间隔。聊天记录在活动结束后保留 7 天。',
    },

    you: {
      title: 'You 和 Lookup',
      intro: '两个玩家卡片标签页：你自己的，和其他任何人的。',
      rows: [
        {
          term: '你',
          body:
            '你登录的角色的个人卡片：横幅和头像、**Display case**，以及 **Stats**、**Bosses** 和 **Log** 标签（collection log 可细化到每页的物品，另有 clues、时间和 combat achievements）。其下是等待你的 **Head-to-head** 挑战（**Accept** 或 **Decline**）和你的 **Goals**，可用 **+ Add goal** 添加。',
        },
        {
          term: '查找',
          body: '在 **Players** 和 **Clans** 之间切换，输入名字后按 Enter。**Recent** 会列出你最近的几项。在游戏中右键单击任何人并选择 **Anvil** 即可进入此处。',
        },
        {
          term: '比较',
          body: '在别人的卡片上，**Compare with me** 会将你们两人逐项对比技能、逐个 boss、逐页比较。团队的卡片上有 **Compare with my clan**。',
        },
      ],
    },

    gear: {
      title: '齿轮标签页',
      intro: '同步和设置，而不是用来看的东西：',
      rows: [
        {
          term: 'Sync profile',
          body: '把你的 collection log 和最佳用时发送到 Anvil。',
        },
        {
          term: 'Sync clan roster',
          body: '仅限氏族 admin：把游戏内氏族成员列表发送到网站。如果插件读不到你的氏族，会改为显示 **Join your clan channel to sync the roster**。',
        },
        {
          term: 'Banner sounds',
          body: '**Add clip** 设置横幅播放的声音，**Copy folder path** 用来管理这些声音，**Add mission clip** 用于任务。',
        },
        {
          term: 'Become a Supporter',
          body: '在下一次插件更新中，底部会有一个 ★ 链接，打开 Supporter 页面；如果你已经是 Supporter，则显示 **Your Supporter perks**。',
        },
      ],
    },

    settings: {
      title: '改变你所见内容的设置',
      intro:
        '在 RuneLite 的 Anvil 配置里，位于 **Chat messages** 下。一开始全部是开启的。',
      rows: [
        {
          term: 'Show feed in game chat',
          body: '把动态也实时打印到你的聊天框：主办方开启了此功能的棋盘以及你作为访客所在的氏族里的大掉落、宠物和成就，你队友的格子进度，以及其他队伍完成的格子。',
        },
        {
          term: 'Supporter names in chat',
          body: '在公共、氏族、好友和私聊中，以及你的好友列表和频道成员列表上，显示 Supporter 的颜色（和 Patron 的星标）。名字列表从 Anvil 下载；关于你看到了谁，不会发送任何信息。',
        },
        {
          term: 'Animated names',
          body: '让 Patron 的渐变在面板、Feed 和活动聊天里流动。关闭则保持静止。在下一次插件更新中，它还会涵盖获得助力的氏族名字和面板里的动态横幅。',
        },
        {
          term: 'Supporter names in menus',
          body: '你右键 Supporter 时，在他们的名字上显示他们的颜色；PvP 世界和荒野中绝不显示。',
        },
        {
          term: 'Over other plugins’ colours',
          body: '开启时，Supporter 的颜色会替换其他插件（例如 Player Indicators）设置的名字颜色。关闭则不动那些名字。',
        },
      ],
    },
  },

  clanBoosts: {
    metaTitle: '为氏族助力 — Anvil',
    metaDescription:
      'Anvil 氏族助力怎样运作：谁拥有助力，放置和移动助力，三个助力等级及各自解锁的内容，氏族的名字颜色，赠送的助力，以及助力者标记和徽章。',
    eyebrow: 'Anvil · 面向 Supporter 和氏族管理团队',
    title: '为氏族助力',
    dek: '正在付费的 Champion 或 Patron 可以为自己是成员的氏族放置一次助力。来自氏族成员的助力足够多时，氏族就会升一级，而每一级都会改变氏族的外观和它在列表中的位置。助力只关乎外观：它们从不改变等级、分数、席位或氏族的套餐。',
    facts: [
      { strong: 'Champion 1 次、Patron 2 次', rest: '付费期间的助力' },
      { strong: '3、8、15 次', rest: '算数的助力对应 1、2、3 级' },
      { strong: '每周一次', rest: '助力可以移动' },
    ],
    footnote:
      '成员在 **Settings** → **Clan boosts** 下放置助力。氏族管理团队在 管理 → **Clan settings** → **Boosts** 下查看等级及其选项。档位本身见[Anvil Supporter：档位与福利]({supporterGuide})。',

    what: {
      title: '谁拥有助力',
      intro: '助力随付费会员一起提供：',
      rows: [
        { term: 'Champion', body: '1 次助力。' },
        { term: 'Patron', body: '2 次助力。' },
        {
          term: 'Supporter',
          body: '没有。通过邀请获得的时长也没有。Anvil 工作人员给的临时升级，只有在工作人员把名额包含在内时才有。',
        },
      ],
      outro:
        '助力属于你，而不属于某个角色：三个角色在三个氏族里，仍然共用一套助力。**Settings** → **Clan boosts** 只在你是 Supporter、或者仍有已放置的助力时才会出现在你的设置里。',
    },

    place: {
      title: '放置和移动助力',
      intro: '助力由你自己放置；没有人能替你放。',
      steps: [
        '打开 **Settings** → **Clan boosts**。**Your boosts** 列出你已放置的助力和任何 **Free slot**。',
        '在 **Clans you can boost** 下，按氏族旁边的 **Boost**。你也可以在氏族自己页面的 Boosters 区域按 **Boost this clan**。',
        '要移动一个助力，在它那一行用 **Move to…** 选择另一个氏族。**Remove** 会把它撤下。',
      ],
      rows: [
        {
          term: '满 14 天的成员席位',
          body: '每次助力都依附在你的某个角色在游戏内氏族中持有的成员席位上。访客席位不能承载助力。席位的天数从以下两者中较早的那个算起：Anvil 第一次看到它的时间，或游戏显示该角色加入的时间。在那之前，氏族那一行会显示还剩几天。',
        },
        {
          term: '每个氏族一行',
          body: '列表中每个氏族只出现一次，助力依附在哪个角色上由 Anvil 选择：能用主号就用主号，否则用持有席位最久的那个。氏族只看到那个角色，绝不会看到你的其他角色。',
        },
        {
          term: '每周一次',
          body: '已放置的助力在放置 7 天后可以移动。撤下的助力名额也在同一天才重新开放，所以撤下再放并不是捷径。如果它依附的角色离开了氏族，你可以立刻移动它。',
        },
      ],
      note: {
        tag: '标签的含义',
        body: '**counting**：它计入氏族的等级。**paused**：你当前档位的名额少于你已放置的数量，所以你最早的助力继续算数，其余的等待。**seat gone**：它依附的角色已不再是那里的成员；请移动它。**over the 2-per-person cap**：该氏族已经计入了你的两次助力。',
      },
    },

    levels: {
      title: '等级',
      intro:
        '氏族的等级取决于它算数的助力。任何一个人对同一个氏族最多只有两次助力算数，所以一个等级总是意味着有好几位成员选择了它。',
      rows: [
        { term: '1 级', body: '3 次算数的助力。' },
        { term: '2 级', body: '8 次算数的助力。' },
        { term: '3 级', body: '15 次算数的助力。' },
      ],
      outro:
        '成员可以在氏族页面上看到进度，例如「5 of 8 to Level 2」。升级的氏族会立刻获得新等级。',
      note: {
        tag: '一周宽限期',
        body: '当助力数掉到某一级以下时，氏族会在 7 天内保留该级的福利。管理 → Clan settings → Boosts 会显示何时结束。如果成员们及时把助力补回来，就什么都不会变。',
      },
    },

    perks: {
      title: '每一级解锁什么',
      intro: '每一级都保留下一级的全部内容。',
      rows: [
        {
          term: '1 级',
          body: '在氏族页面、它的 Clan Hall 卡片和搜索结果上显示 **Boosted** 徽章；在 Clan Hall 及其搜索结果中排在未获助力的氏族之前；以及渐变色的氏族名字。',
        },
        {
          term: '2 级',
          body: 'Clan Hall **Featured** 一栏里的一个位置；氏族的动态横幅会播放（低于 2 级时显示静止帧）；一条面向访客的招募语；以及名字的渐变会流动。',
        },
        {
          term: '3 级',
          body: 'Clan Hall 最顶部的 **Spotlight**，以及每月一条由氏族撰写、发布在 Anvil Discord 里的招募帖。',
        },
      ],
      note: {
        tag: '氏族标志不是福利',
        body: '动态标志（GIF 或 WebP 的氏族图片）在任何等级都会播放。只有横幅要等到 2 级。',
      },
    },

    colours: {
      title: '氏族的名字颜色',
      intro:
        '从 1 级开始，氏族名字使用 Anvil 的渐变色。所有者和 admin 可以在 管理 → **Clan settings** → **Boosts** → **Clan name colours** 下自己选择：',
      rows: [
        {
          term: '一到四种颜色',
          body: '一种颜色是静态名字；两到四种颜色组成渐变。从 2 级开始，渐变会流动。',
        },
        {
          term: '深色和浅色背景',
          body: '和 Supporter 名字一样，Anvil 会调整颜色，让它在深色背景（网站、插件面板、Discord）和浅色背景（游戏的不透明聊天框）上都清晰可读。为其中任一种打开单独的外观，它就会完全按你选的显示。',
        },
        {
          term: 'Reset to Anvil',
          body: '恢复为 Anvil 的配色。',
        },
      ],
      outro:
        '如果氏族掉到 1 级以下，颜色仍会保存，等它回来时再恢复。插件会在下一次刷新时获取更改。',
    },

    staff: {
      title: '给氏族管理团队',
      intro:
        '管理 → **Clan settings** → **Boosts** 供所有者和 admin 使用。管理团队不能替成员放置助力；成员自己放置。',
      rows: [
        {
          term: '等级',
          body: '氏族的等级、有多少次助力正在算数、升到下一级还需要多少次，以及任何宽限周。',
        },
        {
          term: 'Recruiting line',
          body: '2 级。一句话，最多 140 个字符，在你的氏族页面和 Clan Hall 卡片上展示给不在氏族里的人。',
        },
        {
          term: 'Recruitment post in the Anvil Discord',
          body: '3 级。每个自然月一次，20 到 500 个字符，由你撰写，在你按 **Post it** 时发布，并附上你氏族页面的链接。提及会被移除，不会 @ 任何人。到下个月之前，你不能编辑它，也不能再发一条。',
        },
        {
          term: 'Boosters',
          body: '为氏族助力的角色列表。',
        },
      ],
      note: {
        tag: 'Anvil 赠送的助力',
        body: 'Anvil 工作人员可以赠送氏族一个等级，有固定期限或没有期限。赠送只补上氏族达到该等级还缺的助力，在氏族的 Boosters 列表上显示为 **Anvil gift**。成员每有一次真实的助力，就替换掉一次赠送的助力；已经高于赠送等级的氏族保持自己的等级。赠送结束后，氏族会回到成员助力所能达到的等级。',
      },
    },

    boosters: {
      title: '助力者标记和徽章',
      intro: '助力者在他所助力的氏族里得到：',
      rows: [
        {
          term: '助力者标记',
          body: '在该氏族的名单、动态和 Discord 帖子里，他的角色旁边的一颗小宝石。悬停可见「Boosts this clan」。',
        },
        {
          term: 'Boosters 墙',
          body: '在氏族页面上：每个角色一行，助力最多的排在前面，然后是坚持最久的。',
        },
        {
          term: '徽章',
          body: '给放下氏族史上第一次助力的人的 **First booster**；连续不间断助力的 **1 month**、**3 months**、**6 months** 和 **1 year**；以及给把氏族推上相应等级的那次助力的 **Level-up 1**、**2** 或 **3**。',
        },
      ],
      note: {
        tag: '移动会让计时重新开始',
        body: '时长徽章从该角色仍在算数的最早一次助力开始计算，所以移动或撤下助力会让它们从头开始。你的资料页会列出你助力的氏族，每个氏族一次。',
      },
    },
  },

  profile: {
    metaTitle: '你的资料、Wrapped 与对比 — Anvil',
    metaDescription: 'Anvil 为你保留的页面：你的资料、每个角色的公开页面、你的个人页面、月度与年度 Wrapped、活动 Wrapped 卡片，以及并排对比两个角色。',
    eyebrow: 'Anvil · 面向玩家',
    title: '你的资料、Wrapped 与对比',
    dek: 'Anvil 为**你**保留一个页面，为你游玩的**每个角色**各保留一个页面。这里说明了页面上有什么、谁可以打开它们，以及每个月和每场活动结束时推出的 Wrapped 卡片。',
    facts: [
      {
        strong: '默认公开',
        rest: '一个开关即可把任一角色设为私密',
      },
      {
        strong: '月度 Wrapped',
        rest: '在下个月 1 号推出',
      },
      {
        strong: '活动 Wrapped',
        rest: '活动结束时推出',
      },
    ],
    footnote: '这里提到的每个开关，都在 [设置，逐页讲解]({settingsGuide}) 中说明了其所在位置。',
    pages: {
      title: '你的页面',
      intro: '四个页面，各自回答一个不同的问题：',
      rows: [
        {
          term: '你的资料',
          body: '[/profile](/profile)，只有你自己能看到。从顶部的标签中选择一个角色，即可查看其等级、首领、收藏册和活动。队长在这里还会获得 **Captain’s deck**。',
        },
        {
          term: '角色页面',
          body: '`/p/<name>`：一个角色，只要它处于公开分享状态，拥有链接的任何人都可以阅读。它显示技能、首领、收藏册和个人最佳，并且刻意不显示你的氏族排名、活动记录和 Discord 名称。',
        },
        {
          term: '你的个人页面',
          body: '`/u/…`：你所有公开分享的角色汇集在一个页面上，包括你的展示柜以及你选择显示的直播账号。只有在你开启 **Show that my characters are one person** 时它才存在。',
        },
        {
          term: '氏族的成员页面',
          body: '`/c/<clan>/members/<name>`：某个氏族所看到的同一个角色，从该氏族的 **Members** 列表进入。私人氏族只会向其自己的成员显示其成员。',
        },
      ],
    },
    sharing: {
      title: '谁能看到什么',
      body: [
        '每个角色一开始都是**公开分享**的：其页面对拥有链接的任何人开放，并且可以出现在排行榜上，也可以向其他氏族展示。在设置的 **Who sees my characters** 下关闭某个角色后，其页面对除你以外的所有人都会返回 _not found_。你会看到 **Private — only you can see this page.** 以及一个 **Share it →** 链接。',
        '公开的页面在名字下方有 **Copy link**。登录的访客如果认为某个页面有不当内容，可以按 **Report this profile**。',
        '在设置中，你还可以针对每个角色隐藏其所在的游戏内氏族（**Show my in-game clan**），使其从该角色的页面和该氏族的 Anvil 页面中消失。',
      ],
    },
    wrapped: {
      title: '你的月度与年度 Wrapped',
      body: [
        '每个月，每个角色都会获得一张 Wrapped 卡片：**XP gained**、**Boss kills**、收藏册中的 **New slots**、**Efficient** 小时数、**PBs**，以及宠物和最大的一次掉落。它会在**次月 1 号**（UTC）推出。在此之前，只有你能以预览的形式打开它。',
        '每年也有一张，位于 `/p/<name>/wrapped/<year>`，从 **12 月 1 日**开始提供。`/p/<name>/wrapped` 总是带你前往现存的最新一张。',
        '按 **Copy link to your Wrapped** 即可分享。粘贴到 Discord 中时，它会展开为该卡片的图片。私人角色的 Wrapped 只对你开放，其链接会以普通的 Anvil 卡片形式预览。',
      ],
      note: {
        tag: '空的月份',
        body: '如果该月没有任何内容抵达 Anvil（没有经验、击杀、收藏册格子或个人最佳），卡片会直接说明，而不是显示零。用插件游玩，或者让 hiscores 追上你，下个月就会有内容了。',
      },
    },
    events: {
      title: '活动 Wrapped',
      body: [
        '棋盘结束时，每位玩家和每支队伍都会获得一张卡片。打开活动的 **Wrapped** 页面：**Your card** 位于顶部，然后是 **Teams**（排名、分数和玩家）以及 **Players**。按 **Open and share your card**，再按 **Copy share link**。',
        '在结束之前，你会看到 **Cards aren’t out yet**。工作人员可以提前打开预览，以便在玩家看到之前检查卡片。',
        '卡片图片仅对公开氏族中、非仅限邀请的活动显示。对于其他活动，链接仍然对能看到该活动的人有效，并会以普通的 Anvil 卡片形式预览。',
      ],
    },
    compare: {
      title: '对比两个角色',
      body: [
        '打开 [Compare](/compare)，输入两个名字。你会看到技能、首领和收藏册页面并排展示。每项数量领先的一方以金色显示。其下是分析、每项技能的经验、你们任一方击杀过的所有首领，以及逐项对比的收藏册：双方都有、都没有，或只有一方有。**Swap sides** 会互换两边。',
        '只有已公开分享的角色才能被对比。私人角色或 Anvil 不认识的名字，会返回 _not on Anvil, or not shared_。登录后，你永远可以对比你自己的私人角色。',
      ],
    },
    news: {
      title: '最新动态与更新日志',
      body: [
        '[What’s new](/whats-new) 按最新优先显示 Anvil 的变更。登录后，它先显示 **For you**（对你的等级和团队重要的新闻），然后是 **Everything new**。需要插件更新的内容会标注 **Coming in the next plugin update**。',
        '[更新日志](/changelog) 列出每个版本及其新闻、亮点，以及 **New**、**Improved** 和 **Fixed** 的内容。',
        '发布新版本时，其新闻会发布到 Anvil Discord 以及你团队的 Anvil 更新中，玩家登录时插件会显示一行提示。小修复会合并到下一篇帖子中。',
      ],
    },
  },
  settings: {
    metaTitle: '设置，逐页讲解 — Anvil',
    metaDescription: 'Anvil 设置下的每一页：Discord 发帖与截图隐私、游戏内聊天动态、插件连接与设备、你自己的 webhook、谁能看到你的角色、Supporter 与资料外观、直播账号、每个角色，以及归属认领。',
    eyebrow: 'Anvil · 面向玩家',
    title: '设置，逐页讲解',
    dek: '[Settings](/settings) 是你自己做选择的地方：你发布什么、游戏中看到什么、谁能看到你的角色。在这里做出的选择会跟随你使用的每一台电脑。',
    facts: [
      {
        strong: '搜索框',
        rest: '在第一页可找到任何设置',
      },
      {
        strong: '每个角色一页',
        rest: '位于 Characters 下',
      },
      {
        strong: '10 个 webhook',
        rest: '由你自己设置',
      },
    ],
    footnote: '你的资料页面在 [你的资料、Wrapped 与对比]({profileGuide}) 中说明；插件自己的设置在 [RuneLite 插件设置]({pluginGuide}) 中说明。',
    find: {
      title: '查找设置',
      body: [
        '第一页 **Overview & search** 有一个搜索框。用你自己的话输入你想要的内容，例如 _private messages_、_rare drop value_、_death message_、_name colour_ 或 _plugin token_，它就会带你到正确的开关。',
        '侧边的菜单分为两组。**Account** 下是以下各页。**Characters** 下每个你已关联的角色各有一页（你的主角色标记为 **main**），之后是 **Add character**。**Add character** 上的数字表示 Anvil 见过你游玩的、尚未关联的角色。',
      ],
    },
    posts: {
      title: 'Discord 发帖与截图',
      intro: '插件替你向你所在氏族的 Discord 频道发布哪些内容，以及它在截图中隐藏哪些内容。这些选择会由下一次插件更新读取。在你更新之前，插件自己设置中的相同开关决定一切。',
      rows: [
        {
          term: '插件会发布什么',
          body: '**Rare drops**、**Pets**、**Deaths**、**Collection log slots**、**Level milestones** 和 **Diary completions** 默认开启；**PvP kills** 默认关闭。',
        },
        {
          term: '数值',
          body: '**Min drop value**（默认 1m，至少 1m，0 则关闭）、**Min drop rarity (1 in N)**（默认 1/1,000）、**价值和稀有度组合**（默认满足其一，或同时要求）、**Loot key value**（1m）、一条最多 200 个字符的 **Death message**，其中 `{name}` 会变成你的名字，以及允许发布的最低 **Combat task tier** 和 **Quest tier**（默认 Master）。价值、稀有度以及满足其一或同时满足的选择，在你自行设定之前跟随氏族默认值；**重置为氏族默认值** 即可恢复跟随。',
        },
        {
          term: '你的发布去向',
          body: '**Keep my announcements out of clans I only guest in**，以及 **Level posts in clan channels**：**Clan rules**、**Only 99s & max** 或 **Off**。**Per character** 会列出每个角色，并附带 **Clans →** 链接，以便为某个氏族单独关闭发布。',
        },
        {
          term: '按类型设置截图',
          body: '为每种类型（**Rare drops**、**Pets**、**Deaths**、**Collection log**、**Combat tasks**、**Achievement diaries**、**Levels**、**Player kills**）选择其帖子是否附带截图。默认全部开启。你的氏族可以为成员设置默认值；在你更改之前，将跟随该默认值，**Reset** 可恢复为默认值。Bingo 证明无论如何选择都会截取，它们是你的证据。',
        },
        {
          term: '更多可公告的内容',
          body: '**Slayer**（每 N 次任务）、**Clue scrolls**（从你选择的等级起）、**Speedruns**（仅个人最佳，或每次都发）、**Kill count**（每 N 次击杀）、**BA gambles**（每 N 次赌博）以及 **Custom chat messages**（符合你自定义模式的游戏消息，其中 `*` 代表任意文本，`#` 代表任意数字；最多 10 条）。全部默认关闭。你的氏族可以将它们设为成员的默认值，你也可以为自己单独开启或关闭；**Reset to clan default** 可恢复为跟随氏族。它们会发布到你氏族的 **Milestones & more** 频道以及你自己接收这些内容的 webhook；你自定义的模式只会发布到你自己的 webhook。',
        },
        {
          term: '私密：Grand Exchange、交易、群组存储、其他插件',
          body: '**Grand Exchange**（已完成且价值不低于你设定金额的交易）、**Player trades**（你给出和获得的物品）、**Group storage**（你存入或取出的物品）以及 **Other plugins**（你指定的 RuneLite 插件可通过 Anvil 发布）。这些默认关闭，只有你自己能开启，你的氏族永远无法替你开启，并且它们只会发布到你自己的 webhook：在你希望它们出现的 webhook 上勾选该类型即可。',
        },
        {
          term: '消息模板',
          body: '更改任何消息的第一行：**Loot**、**Pet**、**Collection log**、**Combat tasks**、**Achievement diary**、**Quests**、**Levels**、**Death**、**Player kills**、**Slayer**、**Clue scrolls**、**Speedruns**、**Kill count**、**BA gambles**，以及仅对你自己可用的 **Grand Exchange**、**Player trades** 和 **Group storage**。点击 `{player}` 或 `{item}` 等占位符即可添加；预览会填入示例值。每种类型都有自己的占位符，花括号中的其他内容将保持你输入的样子。最多 200 个字符；提及和链接永远不会发布。保持不变时，消息与以往一样；你的战队可以设置自己的模板，**Reset to clan default** 会恢复为战队默认值。',
        },
        {
          term: '截图隐私',
          body: '勾选在插件拍摄的每张截图中（包括证明截图和 Discord 帖子）都会被遮掉的聊天：**Private messages**（默认勾选）、**Public chat**、**Clan chat: others’ messages**、**Clan chat: your own messages**、**Chat channel** 和 **Group chat**。游戏消息和 Anvil 自己的行始终保留。',
        },
      ],
      note: {
        tag: '棋盘格子永远不受影响',
        body: '关闭某项发布只会停止 Discord 帖子。掉落、击杀和成就在你正在参与的任何棋盘上仍然计入。',
      },
    },
    chat: {
      title: '游戏内聊天动态',
      intro: '当插件设置 **Show feed in game chat** 开启时，插件会在你的聊天框中打印的内容。',
      rows: [
        {
          term: '来源',
          body: '**Boards I play on**，以及 **Clans I’m guesting in, and my clan’s guests**。',
        },
        {
          term: '内容',
          body: '价值不低于你所选金额的掉落、**Pets**、**New collection log slots**、**Other teams’ completed tiles**、**My team’s progress on item tiles**、**Leagues, Deadman and other game-mode unlocks**，以及战斗成就、等级、任务和日记。',
        },
        {
          term: '登录时',
          body: '**A short brief in chat**：你离开期间发生的事。Champion 可以选择简报涵盖的内容。',
        },
        {
          term: '颜色',
          body: '**Anvil lines in chat**：**By type (Anvil colours)**、**One colour (the plugin’s own)**，或供 Supporter 使用的 **My own colours**。',
        },
      ],
    },
    login: {
      title: '插件连接、登录与设备',
      intro: '插件与网站在哪里已登录，以及如何将它们登出。',
      rows: [
        {
          term: '插件连接',
          body: '你的插件令牌，适用于你极少数需要手动粘贴的情况。通常侧边面板中的 **Sign in with Discord** 会替你完成此事。',
        },
        {
          term: '登录与设备',
          body: '插件已登录的每台电脑，显示为 **RuneLite sign-in 1**、**2**……并附上创建和最后使用的时间。**Revoke** 可将其中一台登出，例如你卖掉的电脑。**Enter a code** 可关联另一台电脑。**Sessions** 会将你从所有地方的网站上登出。',
        },
        {
          term: '氏族账单',
          body: '氏族所有者可以在此处按 **Open portal →** 查看氏族账单。',
        },
      ],
    },
    webhooks: {
      title: '你的 Discord webhook',
      body: [
        '你的帖子也可以发送到你自己的 Discord 服务器：私人频道、朋友的服务器，或任何你能创建 webhook 的地方。粘贴 webhook 链接，勾选它要接收的内容（**Rare drops**、**Pets**、**Deaths**、**Combat achievements**、**Levels & milestones**、**Quests**、**Achievement diaries**、**Collection log**、**PvP kills**），还可以仅为它设置最低掉落价值和稀有度，然后按 **Add webhook**。对于接收 **Rare drops** 的 webhook，你之后可以更改这些设置，并选择 **Value or rarity: my setting**、**either** 或 **both**。留空的项遵循你自己的设置，而且 webhook 可以比你团队的硬性下限更宽松。',
        '最多可以添加 10 个。只接受 Discord webhook 链接，已保存的链接会被遮盖显示，因此此页面的截图不会泄露它。**Level posts on my webhooks** 为它们设置你自己的等级规则，与团队的规则分开。',
      ],
    },
    privacy: {
      title: '谁能看到我的角色',
      intro: '你的角色一开始是公开分享的。以下三个开关可以改变这一点：',
      rows: [
        {
          term: '公开显示 <name>',
          body: '每个角色一个开关。开启（默认）时，其页面为**公开**。关闭后则为**仅其氏族可见**：其氏族仍能在名单和活动中看到它，其他人都看不到，并且它会退出排行榜。',
        },
        {
          term: '显示我的角色属于同一人',
          body: '拥有两个或更多角色时，此开关会生成你的个人页面，把你公开分享的角色汇集在一起。关闭时，没有人能看出它们都属于你。',
        },
        {
          term: '显示其他氏族的棋盘',
          body: '首页是否列出其他氏族公开的棋盘供你查看。',
        },
      ],
    },
    look: {
      title: 'Supporter、资料外观、直播与助力',
      intro: '你在 Anvil 上的形象，以及背后的账号与特权。',
      rows: [
        {
          term: 'Supporter 与名字颜色',
          body: '你的档位、特权和邀请链接：邀请朋友即可赚取免费月份。档位在 [Anvil Supporter]({supporterGuide}) 中说明。',
        },
        {
          term: '资料外观',
          body: '头像和横幅（Champion 起可动态显示），如果你愿意，还可以为每个角色使用不同的外观，以及 **Display case**：按档位显示 4、8 或 12 个徽章。',
        },
        {
          term: '直播账号',
          body: '**Twitch**、**YouTube**、**Kick** 和 **Medal**。每个都会显示是否已验证，并可开关是否在你的资料上显示。已验证的账号可以让你参加粉丝与订阅者活动。',
        },
        {
          term: '氏族助力',
          body: '只有当你可以助力时才会显示：你的名额、它们放在哪里，以及你可以助力的氏族。参见 [为氏族助力]({boostsGuide})。',
        },
      ],
    },
    characters: {
      title: '每个角色',
      intro: '在 **Characters** 下，每个角色都有自己的页面：它的类型、是否已验证，以及通往其公开页面和完整资料的链接。',
      rows: [
        {
          term: '可见性',
          body: '**Show to other clans and on leaderboards**，以及 **Show my in-game clan**。',
        },
        {
          term: '氏族',
          body: '该角色所在的每个氏族和空间，身份为 **member** 或 **guest**，并可按氏族设置 **Announce drops & achievements** 以及 **Leave**。如果 Anvil 把它放在了错误的氏族里，**Which clan is it really in?** 会通知工作人员。',
        },
        {
          term: '角色',
          body: '**Make main**、改名后要求更名，或从你的账号中 **Remove** 它。其过去的成绩仍会保留在原处。',
        },
        {
          term: '添加角色',
          body: '在插件已登录的情况下游玩一次该角色，它就会自动关联。在手机或官方客户端上，则按名字关联。**We noticed you playing** 列出 Anvil 见过的角色；**Not mine** 会忽略其中一个。',
        },
      ],
    },
    claims: {
      title: '归属认领',
      body: [
        '如果某个角色被关联到别人的 Anvil 账号，但其实是你的，请在插件侧边面板的 **You** 标签中按 **This is my account**。你需要通过一次快速的经验检查来证明你在玩这个角色，然后当前持有者会收到询问。你永远不会知道他们是谁，他们也永远不会知道你是谁。',
        '你提出的认领会显示 **XP check**、**open**，然后显示其结果：**moved to you**、**with Anvil staff**、**withdrawn**、**check timed out** 或 **closed**。**Withdraw** 可取消某一项认领。',
        '当有人认领你的某个角色时，它会显示在 **Claims on your characters** 下，附带 **Approve** 或 **Object — it’s mine**。未验证的角色在 7 天后会被转移，除非你提出异议。已验证的角色只有在你批准后才会转移。',
      ],
    },
  },
  weekly: {
    metaTitle: 'Skill 与 Boss of the Week — Anvil',
    metaDescription: '在 Anvil 上举办 Skill of the Week、Boss of the Week 或效率比赛：安排、重复与轮换、起跑线、增减参与者、奖品、提前结束，以及玩家看到的内容。',
    eyebrow: 'Anvil · 面向氏族工作人员与玩家',
    title: 'Skill 与 Boss of the Week',
    dek: '每周比赛是低投入的活动：无需撰写格子、无需队伍、无需报名。名单上的每个人在开赛时都会自动参加，获胜者是在结束前获得最多增长的人。',
    facts: [
      {
        strong: '没有格子，没有队伍',
        rest: '一个排行榜',
      },
      {
        strong: '开赛时自动参加',
        rest: '整个名单，自动完成',
      },
      {
        strong: '最多 10 个奖品名次',
        rest: '从氏族金库支付',
      },
    ],
    footnote: '棋盘（bingo）见 [举办你的第一场活动]({adminGuide})；奖品与金库见 [氏族金库]({cofferGuide})。',
    schedule: {
      title: '安排一场比赛',
      intro: '五个选择，多数氏族使用默认值即可：',
      steps: [
        '打开管理菜单中的 **Schedule**，按 **+ Schedule event**（管理员可以使用 **Schedule a competition**）。',
        '选择类型：**Skill of the Week**（获得的经验）、**Boss of the Week**（获得的击杀）或 **Efficiency race**（获得的 游戏时长 或 首领时长）。',
        '在 **What is measured** 下选择技能或首领。若要每周更换，请在 **Then rotate through** 下添加更多项。留空则重复同一项。',
        '选择 **Runs** 的时间：**This weekend**、**One week**，或你自己的日期。它总是需要一个结束时间，因为它要计算开始与结束之间的增长。',
        '保持 **Repeat every week** 开启，下一场会在这一场结束的那一刻开始，长度和奖品相同。如果你的氏族访客也应该参赛，请勾选 **Guests race too**。',
      ],
      outro: '没有其他需要设置的内容。起始数字在开始时从 hiscores 获取。',
    },
    counting: {
      title: '计分方式',
      body: [
        '每位玩家的增长 = 其当前数据减去比赛开始时的数据（即其**起跑线**）。增长最高者获胜；并列时会按名字列出，奖品可以在并列的名次之间分配。',
        '起跑线取自 hiscores。之后，插件的实时更新会在两次 hiscore 检查之间保持排行榜更新，因此使用插件的玩家在游戏中会在排行榜上前进。',
        '下降的数字会被忽略，而看起来不可能的增长会被**标记**，交由工作人员处理，既不计入也不删除。',
      ],
      note: {
        tag: '玩家：开赛前先登出',
        body: '只有在你登出时，hiscores 才会保存你的数据。如果你一直练到开赛前都没有登出，你的起跑线会取自那段练级之前，而这段练级会被算作增长。工作人员通常会发现并修正你的起跑线，但开赛前请先登出一次。',
      },
    },
    manage: {
      title: '管理比赛',
      intro: '从 **Schedule** 或仪表盘打开比赛。它有一个首页和三个标签页：',
      rows: [
        {
          term: '首页',
          body: '**Leaderboard**（前 25 名，并显示有多少人在计分）、**flagged** 的增长、已**离开氏族**的人，以及奖品。比赛结束时，会显示获胜者和 **Final leaderboard**。',
        },
        {
          term: '起跑线',
          body: '每位玩家的 **Started at**、**Now** 和 **Gained**。当比赛前的练级被计入时，手动修正起跑线，排行榜会随之更新。**Pull current stats** 会刷新所有人；**Reset baselines** 会根据现在的 hiscores 让所有人重新开始，并清除所有增长。',
        },
        {
          term: '参与者',
          body: '整个名单已经加入。**Add someone** 每行接受一个名字，适用于名单上还没有的访客或账号。移除玩家会移除其成绩；重新添加则会给他们一个新的起跑线。**Leave one each** 会清理在多个角色上报名的同一个人。你也可以一次性移除所有访客。',
        },
        {
          term: '设置',
          body: '名称、日期、**Repeat every week**，以及 **Status**（仅用于解除卡住的状态；它会自行推进）。管理员可以 **Delete** 它，连同其参与者和成绩一起删除。',
        },
      ],
    },
    prizes: {
      title: '奖品与结束',
      body: [
        '为最多 10 个名次设置奖品，由氏族金库支付。你可以选择没有增长的玩家是否可以获奖，以及并列名次是否共享奖品。资金如何流动见 [氏族金库]({cofferGuide})。',
        '它会在你设定的时间自动结束。**End now** 会提前停止：增长立即停止计分，结果会发布到 Discord，奖品会在 15 分钟内结算完毕。',
      ],
    },
    players: {
      title: '面向玩家',
      body: [
        '你无需报名。如果你在开赛时位于氏族名单上，你就已参加。可以在你氏族的 **Events** 页面、插件侧边面板的 **Clan** 标签（显示你的排名）中找到它，并在比赛开始和结束时在 Discord 中看到。',
        '每场比赛都有自己的页面，展示实时排行榜以及每天的比赛进程。私人氏族只会向其自己的成员显示它。',
        '使用插件游玩会让你的数字保持实时。不使用插件，你仍然会被计入，只是速度与 hiscores 同步。',
      ],
    },
    teamsLine: "想在技能或 Boss 上组队，或让 clan 相互竞争？安排时设置 **Format** 即可。请参阅 [团队竞赛]({teamCompsGuide})。",
  },
  teamComps: {
    "metaTitle": "团队竞赛 — Anvil",
    "metaDescription": "在 Anvil 上以团队或 clan 对 clan 形式举办技能或 Boss 周赛：如何把玩家分成团队、邀请其他 clan、总分与平均值如何计分、迟到加入的玩家，以及玩家能看到什么。",
    "eyebrow": "Anvil · 面向 clan 管理员与玩家",
    "title": "团队竞赛",
    "dek": "每个技能或 Boss 竞赛都有一个 Format。Solo 是默认选项，与以前一样运作。选择 Teams 可将你的 clan 分为几方，或选择 Clan vs clan，与其他 clan 在同一技能或 Boss 上比拼。",
    "facts": [
      {
        "strong": "三种格式",
        "rest": "Solo, Teams, Clan vs clan"
      },
      {
        "strong": "总分决定胜负",
        "rest": "并附每位玩家的平均值"
      },
      {
        "strong": "一位主办方编辑",
        "rest": "合作 clan 只能观看"
      }
    ],
    "footnote": "技能与 Boss 周赛的基础内容见 [技能与 Boss 周赛]({weeklyGuide})。想让 clan 改在 bingo 面板上竞争？请参阅 [接待来访 clan]({clanVsClanGuide})。",
    "teams": {
      "title": "设置团队",
      "intro": "Teams 会把你自己的 clan 分成几方。大约需要一分钟：",
      "steps": [
        "像平常一样安排竞赛。将 **Format** 设为 **Teams**。",
        "输入团队名称。所有报名者会按当前等级或击杀数平均分配，使各方起点公平。",
        "如果玩家可能在开始后加入，请保持 **Late joiners go into the smallest team** 开启。关闭则团队保持固定。",
        "之后如需更改，请打开竞赛，并在其管理侧栏中选择 **Teams**。在那里你可以："
      ],
      "rows": [
        {
          "term": "重命名和更换颜色",
          "body": "为每个团队设置名称和玩家能认出的颜色。"
        },
        {
          "term": "添加和删除团队",
          "body": "从两个开始，可添加第三个，或删除不再需要的团队。"
        },
        {
          "term": "移动玩家",
          "body": "把某人调到另一个团队。适合想一起玩的朋友。"
        },
        {
          "term": "Auto-balance",
          "body": "按 **Auto-balance by current level/KC** 重新平均分配所有人。"
        },
        {
          "term": "Late joiners",
          "body": "开启或关闭迟到加入选项。开启后，新玩家会加入人数最少的团队。"
        }
      ],
      "note": {
        "tag": "没有团队也没关系",
        "body": "没有团队的玩家仍计入个人排行榜，只是不计入任何团队总分。"
      },
      "outro": "周期性竞赛会把团队延续到下一周，并重新平衡。"
    },
    "clans": {
      "title": "设置 clan 对 clan",
      "intro": "Clan vs clan 允许其他 clan 加入你的竞赛，数量不限。你是主办方，其他 clan 是合作方。",
      "steps": [
        "在主办 clan 中，以管理员或更高权限将 **Format** 设为 **Clan vs clan**。",
        "通过地址邀请其他 clan。可以在创建表单中邀请，也可以之后在竞赛的 **Clans** 页面邀请。",
        "受邀 clan 的所有者或管理员在其 **People** 页面或 **Events** 列表中接受或拒绝。版主无权操作。在该 clan 接受之前，其成员都不会被加入。",
        "接受后，该 clan 选择参赛人员：其名单中的 **All members**，或由其挑选的 **Selected people**。之后可以在同一张卡片上修改。",
      ],
      "body": [
        "合作 clan 可以在自己的网站 `/c/<slug>/weekly/<id>` 上查看排名。该页面只读，只有主办方能编辑竞赛。",
        "要移除某个 clan，请在 **Clans** 页面将其删除。它的玩家会从面板上移除。",
        "定期竞赛每周都会发出新的邀请，因此每个 clan 都需要重新确认。",
        "收到不想要的邀请？在邀请上选择 **Decline & block this clan**。该 clan 之后的邀请会被悄悄拒绝，你可以之后在 **Settings → Blocked clans** 中解除屏蔽。",
      ],
      "note": {
        "tag": "分享地址",
        "body": "clan 的地址是其网址中的简短名称。邀请之前，请向对方 clan 的管理员索取。"
      }
    },
    "scoring": {
      "title": "计分方式",
      "body": [
        "团队或 clan 总分是其成员收益之和。收益的统计方式与个人排行榜相同。",
        "每个总分旁边还会显示 **average per player**，因此 8 人团队与 12 人团队仍可比较。",
        "若两个总分相同，先达到该分数的一方排名更高。"
      ]
    },
    "players": {
      "title": "玩家能看到什么",
      "body": [
        "竞赛页面会先显示团队或 clan 排名。点开任一项即可查看其玩家。你自己的团队或 clan 会被高亮显示。",
        "开始、中途和结束时的 Discord 消息会显示排名。在 clan vs clan 中，消息会发到每个 clan 的频道，你的频道会标注 **← you**。",
        "在插件侧边栏中，你可以看到你的团队排在第几位。",
        "无需报名。如果你的 clan 选择全部成员且你在名单上，你就已参赛。如果它挑选人员，被选中后你即参赛。",
        "不想参加？在竞赛页面、Events 列表或插件中，点击 **You’re in** 旁边的 **Opt out**。你只会退出该场竞赛，并且可以在比赛进行中重新加入。",
      ]
    },
    "faq": {
      "title": "常见问题",
      "intro": "氏族管理人员和玩家最常问的问题：",
      "rows": [
        { term: "我们的团队人数不同，这公平吗？", body: "本身不算不公平。排名以总分决定，但每个团队还会显示每位玩家的平均值，因此你可以看出人数较少的团队实际表现如何。" },
        { term: "迟到加入的人怎么办？", body: "开启迟到加入开关后，他们会加入人数最少的团队。关闭时，他们只计入个人排行榜。你随时可以在 **Teams** 页面手动调整他们。" },
        { term: "合作 clan 能编辑我们的竞赛吗？", body: "不能。合作 clan 只能只读地查看排名。只有主办 clan 能修改竞赛。" },
        { term: "我可以缺席某场竞赛吗？", body: "可以。在竞赛页面、Events 列表或插件中点击 **Opt out**。只影响该场竞赛，并且在比赛进行中可以重新加入。" },
        { term: "最多可以有多少个 clan 参赛？", body: "你邀请多少个都行，一场竞赛最多 50 个。每个 clan 都会在排名和 Discord 消息中看到属于自己的那一方被标注出来。" },
        { term: "另一个 clan 一直邀请我们，能阻止吗？", body: "可以。所有者或管理员在邀请上选择 **Decline & block this clan**。之后该 clan 的邀请会被拒绝，且不会通知对方。随时可以在 **Settings → Blocked clans** 中解除屏蔽。" },
        { term: "如果我们某次同意了，是否每周都自动报名？", body: "不是。定期竞赛每周都会发出新的邀请，每一次都需要所有者或管理员接受。" },
      ]
    }
  },

  clanEvents: {
    metaTitle: '氏族活动与日程 — Anvil',
    metaDescription: '在 Anvil 上安排氏族活动：集合、旅行与聚会，每周重复，“I’m going”与带名额、问题和费用的报名，Discord 帖子与提醒，奖金发放，问卷，以及显示空档的日程。',
    eyebrow: 'Anvil · 面向氏族工作人员',
    title: '氏族活动与日程',
    dek: '并非一切都是棋盘。氏族活动是集合、团本夜、掉落派对或聚会：一个时间和一个地点，发布到 Discord 并发送提醒，报名多少由你决定。',
    facts: [
      {
        strong: '一次或每周',
        rest: '可选结束日期',
      },
      {
        strong: '三种参与方式',
        rest: '信息、“I’m going”或报名',
      },
      {
        strong: '提醒',
        rest: '开始前 15 分钟，然后开始时',
      },
    ],
    footnote:
      '每周比赛见 [Skill and Boss of the Week]({weeklyGuide})；费用和奖金见 [Fees and payouts]({feesGuide})。提醒帖子使用你团队的消息模板，详见 [Settings, page by page]({settingsGuide})。',
    create: {
      title: '安排一场',
      intro: '在管理菜单中打开 **Clan events**，填写表单：',
      rows: [
        {
          term: '名称、时间、时长',
          body: '**Name**、**Starts (your time)**（按你自己的时区），以及 **Minutes**。',
        },
        {
          term: '重复',
          body: '**Just once** 或 **Every week**，可选 **Until** 日期。',
        },
        {
          term: '地点',
          body: '**Where**、**World** 和 **Host**，以及一张图片：选择首领或技能，或上传你自己的图片。',
        },
        {
          term: '详情',
          body: '装备、要求、需要带什么。',
        },
        {
          term: '谁会参加',
          body: '**Just information**（无按钮、无计数）、**“I’m going”**（一次点击，显示计数）或 **Sign-ups**（名额、问题和费用）。',
        },
        {
          term: 'Discord',
          body: '**Post to** 某个频道（或氏族默认频道），可选择链接 **Chat**、**Guide** 和 **Voice** 频道，并选择在公告、提醒和开始时是否 @ 成员身份组。',
        },
      ],
      outro: '按 **Schedule it**。之后可以在活动自己的页面上添加奖金和问卷。',
    },
    discord: {
      title: 'Discord 能看到什么',
      body: [
        '公告会在你安排活动时发布，并在你每次更改时原地编辑，因此永远不会有过时的副本。重复活动会标记为 **every week**。',
        '开始前 15 分钟，它会发布 **Starting in 15 minutes**，开始时发布 **Starting now**。如果你更改时间，提醒也会随之移动。取消（**Cancel**）会把帖子标记为 **Cancelled**，这样就没人会赶来。',
      ],
    },
    manage: {
      title: '报名、费用与奖金',
      intro: '打开活动以更改它使用的内容。所有内容默认都是关闭的：',
      rows: [
        {
          term: '报名',
          body: '包含 **Places**（留空即不限）、**Sign-ups close** 的时间，以及 **Sign-up questions**。**You approve each one** 会让每次报名都需要工作人员批准。',
        },
        {
          term: '“I’m going” 按钮',
          body: '关闭后它只作为信息显示：网站、插件或 Discord 中都没有按钮或计数。',
        },
        {
          term: '参赛费',
          body: '开启报名。在 **Added to the pot** 下添加你自己投入奖池的 gp。',
        },
        {
          term: '奖金',
          body: '奖池是费用加上你添加的部分。填写 **Who** 获得什么以及 **For** 什么，并将每一项标记为 **Paid**。如果你发放的金额超过奖池，Anvil 会发出警告。',
        },
        {
          term: '之后的问卷',
          body: '活动结束后开放。只有工作人员能看到答案。如果该活动有报名，则只会询问已报名的人。',
        },
        {
          term: '每周活动',
          body: '**Every week is…** **Its own**（每周各自的报名、奖池和问卷）或 **One run**（整个系列共用一次报名、奖池和问卷）。',
        },
      ],
    },
    players: {
      title: '成员会看到什么',
      body: [
        '活动页面会显示 **When**、**Where**、**Host**、**Discord**、**Entry** 和 **Prizes**，活动进行中会显示 **Live now**。成员按 **I’m going** 或 **Sign me up**，或在工作人员逐一批准时按 **Ask to sign up**。它也会出现在插件侧边面板的 **Clan** 标签中，按钮相同。',
        '只有氏族成员可以表示自己会参加或报名。',
      ],
    },
    calendar: {
      title: '日程',
      body: [
        '**Schedule** 将棋盘、每周比赛和氏族活动放在同一个日历上，并为每一类提供筛选。',
        '任何两天或更长、没有安排任何内容的时段都会被标记为空档，并附带 **Fill the gap** 以便在那里安排活动。用它在大型活动之间保持氏族的活跃，而不是任由安静的两周溜走。',
      ],
    },
  },
  challenges: {
    metaTitle: '挑战与好友活动 — Anvil',
    metaDescription: 'Anvil 上的一对一挑战（先获得掉落、1 小时、24 小时或 7 天内击杀最多或经验最多）以及 Supporter 好友活动：通过一个邀请链接为朋友建立私人棋盘。',
    eyebrow: 'Anvil · 面向玩家',
    title: '挑战与好友活动',
    dek: '在没有氏族活动的情况下与你认识的人对战的两种方式：**挑战**是一名玩家对一名玩家，**好友活动**则是一个通过邀请链接面向一群人的私人棋盘。',
    facts: [
      {
        strong: '1 小时到 7 天',
        rest: '每次挑战',
      },
      {
        strong: '荣誉而已',
        rest: '没有赌注，没有 gp',
      },
      {
        strong: '最多 50 位好友',
        rest: '每场好友活动，按档位',
      },
    ],
    footnote: '各档位及其可主办的内容见 [Anvil Supporter：档位与特权]({supporterGuide})。',
    start: {
      title: '向某人发起挑战',
      intro: '你需要一个已验证的角色，对方也需要。',
      steps: [
        '打开 [Challenges](/challenges)，或在玩家的资料上按 **Challenge <name>**。',
        '在 **Who** 下输入对方的名字，在 **Playing as** 下选择你自己的角色。该角色必须已验证。',
        '选择比赛方式：**First to a drop**（最多 5 件物品，均为怪物掉落）、**Most kills** 某个首领，或某项技能或总体的 **Most XP**。',
        '选择时限：**1 hour**、**24 hours** 或 **7 days**。如果你不介意结果被公开，请勾选 **OK to show the result publicly**；只有双方都勾选时才会公开。',
      ],
      outro: '对方会收到通知和一条 Discord 消息，并有 24 小时进行 **Accept**、**Decline** 或 **Decline and block**。计时在对方接受时开始。',
    },
    rules: {
      title: '如何判定',
      intro: 'Anvil 会在结束后一分钟内自动判定。',
      rows: [
        {
          term: '击杀与经验',
          body: '双方的起跑线都在接受时记录；到结束时增长更多的一方获胜，增长相同则为平局。Hiscores 和插件都会计入，以较高者为准。',
        },
        {
          term: '先获得掉落',
          body: '你们中第一个获得某件物品的人当场获胜。掉落只有插件能看到，因此双方都需要运行插件。如果没有人在时限内获得，则为平局。',
        },
        {
          term: '取消',
          body: '在对方回应之前，你可以撤回自己的挑战。一旦开始进行，只有双方都同意才会停止。',
        },
      ],
    },
    limits: {
      title: '限制与拒绝',
      body: [
        '未结束的挑战（等待中或进行中，发出或收到的）受档位限制：免费用户为 **1**，Supporter 为 **5**，Champion 和 Patron 不限。任何人每天最多可以发起 20 个，并且与同一人同时只能进行一个。',
        '不想接受任何挑战？**Turn away all new challenges**，或在拒绝时屏蔽某一个人。无论哪种方式，向你发起挑战的人看到的拒绝都是一样的，因此他们无法判断自己是否被屏蔽。',
        '页面会保留 **Your record**（胜、负和平局）、当前的 **Open now**，以及你的 **Your limit**。',
      ],
    },
    friends: {
      title: '举办好友活动',
      body: [
        '任何 Supporter、Champion 或 Patron 都可以从 [Host](/host) → **Host for friends** → **New friends event** 为朋友举办一个私人棋盘。它是完整的棋盘：bingo 或格子比赛，由插件追踪，设置与创作者活动相同。',
        '发送 **Invite link**；这是唯一的入口。朋友打开它，用 Discord 登录，然后按 **Open the event**。加入永远免费。如果链接泄露，请生成新的：旧链接会失效，而已经在里面的人仍然留在其中。',
        '好友活动永远不会在 Anvil 的任何地方列出，也不需要氏族。',
      ],
      table: {
        areaLabel: '档位',
        columns: [
          '玩家数',
          '同时进行数',
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
        tag: '如果你的档位结束',
        body: '已经在其中的好友仍然留在其中。新的好友无法加入超过你新的上限的人数，而且在你回到上限以下之前，你无法开始另一场。',
      },
    },
  },
  clanHall: {
    metaTitle: '查找氏族、活动与排行榜 — Anvil',
    metaDescription: '在 Anvil 的 Clan Hall 中查找 OSRS 氏族，对比两个氏族，查看每周玩家与氏族排行榜、公开活动列表，以及不在 Anvil 上的氏族的游戏内氏族页面。',
    eyebrow: 'Anvil · 面向玩家与氏族',
    title: '查找氏族、活动与排行榜',
    dek: 'Anvil 用于浏览的公开页面：**Clan Hall** 用于查找氏族，**Events** 列表用于找到可参加的活动，**Leaderboard** 用于查看谁的增长最多。',
    facts: [
      {
        strong: 'Clan Hall',
        rest: '仅限公开氏族',
      },
      {
        strong: '排行榜',
        rest: '本周、30 天、全部时间',
      },
      {
        strong: '活动',
        rest: '仅限主办方公开宣传的内容',
      },
    ],
    footnote: '要让你自己的氏族被列出，见 [创建氏族]({clanGuide})；获得助力的氏族会被推荐，见 [为氏族助力]({boostsGuide})。',
    hall: {
      title: 'Clan Hall',
      body: [
        '[Clan Hall](/clans) 列出所有公开的氏族。按名称或标语搜索，然后缩小到 **Taking members** 或 **Open to challenges**。**Most active**（打开时的默认排序）会把本周成员增长最多的氏族排在前面；**Biggest** 则按成员数排序。',
        '每张卡片会说明该氏族是否在 **Recruiting**，以及它如何接纳访客：**Guests welcome**、**Guests by approval** 或 **No guests**。获得助力的氏族会在顶部显示推荐行，创作者也有他们自己的一行。',
      ],
      note: {
        tag: '没有列出？',
        body: '只有设为公开的氏族才会出现，氏族也可以在其设置中关闭列出。私人氏族永远不会出现在 Clan Hall、排行榜或对比中。',
      },
    },
    compare: {
      title: '对比两个氏族',
      body: [
        '[Compare clans](/compare/clans) 可以将任意两个已列出的氏族并排展示。若要对比两个角色，请改用 [Compare](/compare)。',
      ],
    },
    board: {
      title: '排行榜',
      body: [
        '[Leaderboard](/leaderboard) 按经验、高效小时和首领击杀，在 **This week**、**30 days** 或 **All time** 中对玩家和氏族进行排名。玩家可以缩小到 **Regular**、**Ironman**、**Hardcore**、**Ultimate** 或 **Group** 账号。',
        '氏族按其成员获得的经验排名。只有在 Clan Hall 中列出的已验证氏族才会出现。访客的增长计入他们自己的氏族，而不是他们访问的氏族。',
      ],
    },
    events: {
      title: '寻找可以参加的活动',
      body: [
        '[Events](/events) 列出 Anvil 上正在进行和即将到来的活动。可按 **Live now**、**Open to join** 或 **Starting this week** 筛选，按形式或 **Solo** 筛选，按 **Anyone can join** 或 **Ask or meet a rule** 筛选，并按 **Clans** 或 **Creators** 筛选。**Join** 会带你前往报名。',
        '只有主办方开启 **Advertise on Anvil** 的活动才会出现。仅限成员和仅限邀请的活动永远不会出现。',
      ],
    },
    ghost: {
      title: '不在 Anvil 上的游戏内氏族',
      body: [
        '角色的页面会显示其所在的游戏内氏族。如果该氏族不在 Anvil 上，链接会打开一个普通页面，列出在 Anvil 上且选择显示的、属于该氏族的玩家。它并不是该氏族的名单，页面上的任何内容都不会使任何人成为成员。',
        '如果这是你的氏族，**Bring your clan to Anvil** 会为其设置一个。一旦它成为公开的 Anvil 氏族，链接就会直接指向它。',
      ],
    },
  },
  guideLibrary: {
    metaTitle: '游戏内攻略：阅读、提议与氏族副本 — Anvil',
    metaDescription: 'Anvil 攻略库：网站、游戏内和 Discord 中的团本、首领、技能和赚钱攻略。按等级阅读、提议新攻略或修改建议，以及氏族如何复制和编辑库中的攻略。',
    eyebrow: 'Anvil · 面向玩家与氏族工作人员',
    title: '游戏内攻略',
    dek: '除了这些操作指南页面，Anvil 还保存着一个游戏攻略库：团本、首领、技能与赚钱。任何人都可以阅读，任何登录的人都可以提出建议，而氏族也可以保留自己的副本。',
    facts: [
      {
        strong: '三个等级',
        rest: '入门、中级、高级',
      },
      {
        strong: '任何人都可以提议',
        rest: '工作人员审核每一份',
      },
      {
        strong: '/guide',
        rest: '在 Discord 中发布一份',
      },
    ],
    footnote: '斜杠命令见 [斜杠命令]({commandsGuide})。',
    read: {
      title: '阅读攻略',
      body: [
        '在攻略页面上打开 **In-game guides** 标签，或在你氏族的网站上打开 [/guides](/guides)。氏族的列表包含它自己的攻略，以及它尚未复制的库中攻略。',
        '许多攻略顶部有一个等级切换：**Beginner**、**Intermediate** 和 **Advanced**。其他等级的部分会折叠起来，因此新手和速通玩家读的是同一个页面。',
        '在 Discord 中，`/guide` 以及攻略名称的开头会发布一张攻略卡片，并附带通往完整页面的链接。',
      ],
    },
    propose: {
      title: '提议攻略或修改',
      body: [
        '登录后，打开 [Propose a guide](/guides/propose) 来撰写新攻略，或对现有的库中攻略提出修改建议。告诉审核者你改了什么以及为什么；发送前，你可以将你的更改与当前攻略进行对比。',
        '按 **Send for review**。[My guide proposals](/guides/proposals) 会显示每一份提议，状态为 **pending**、**approved**、**rejected** 或 **withdrawn**，并在审核后附上审核者的备注。在待审期间，你可以编辑它或 **Withdraw** 它。你最多可以同时有 5 份等待中。',
        '在 Anvil 的攻略编辑批准之前，任何内容都不会上线。获批的修改还会更新每一个未被更改过的氏族副本。',
      ],
    },
    clan: {
      title: '你氏族的攻略',
      intro: '管理员以及获准撰写攻略的管理员，在管理菜单的 **Guides** 下管理它们。',
      rows: [
        {
          term: '在我们的网站上显示库中攻略',
          body: '开启后：你尚未复制的库中攻略也会显示在你的 Guides 页面上，并且始终是最新的。',
        },
        {
          term: '复制到我们的攻略',
          body: '创建一个氏族副本。它会**跟随库**，直到你编辑它为止，因此会获得每一次库的更新。',
        },
        {
          term: '编辑副本',
          body: '使其变为**customised**，即氏族自己的版本。之后当库中的攻略发生变化时，它会显示 **update available**：你可以采用新版本，或保留你的版本。',
        },
        {
          term: '新攻略',
          body: '撰写一份只有你的氏族才有的攻略，例如你自己的团本规则或集合攻略。',
        },
      ],
      note: {
        tag: '发布它们',
        body: '攻略可以发布到 Discord 频道，攻略更改时，这些帖子会原地编辑。',
      },
    },
  },
  luckRecords: {
    metaTitle: '掉落概率、运气与记录 — Anvil',
    metaDescription: '说明掉落格上概率行的含义、Anvil 如何计算运气（spooned、dry 或 on rate）、什么是高效时长，以及你的最佳日、周、月、年保存在哪里。',
    eyebrow: 'Anvil · 面向玩家',
    title: '掉落概率、运气与记录',
    dek: 'Anvil 可以告诉你某个掉落有多稀有、通常需要多久，以及你有多幸运。它还能记住你的最佳日子。本页解释这些数字。',
    facts: [
      {
        strong: '概率',
        rest: '来自 OSRS Wiki',
      },
      {
        strong: '运气',
        rest: '预期击杀数与你的实际击杀数对比',
      },
      {
        strong: '记录',
        rest: '包含 Anvil 开始追踪你时起的历史',
      },
    ],
    footnote:
      '你自己的页面见 [Your profile, Wrapped and Compare]({profileGuide})。开关见 [Settings, page by page]({settingsGuide})。',
    odds: {
      title: '掉落格上的概率',
      intro: '打开一个掉落格，你会看到最多八行，每个已知概率的物品一行。一行看起来像这样：',
      body: [
        '`Item: 1 in 512 from Boss · ~512 kills ≈ 9.4 h at 55/h`',
        '如果该物品每次击杀可以掷出多次，还会显示 **(×2 rolls)**。如果 Anvil 不知道玩家击杀该 boss 的速度，则省略时长部分。',
      ],
      rows: [
        {
          term: '1 in N',
          body: '单次击杀获得该掉落的几率，取自获得它最快的来源。',
        },
        {
          term: '预期击杀数',
          body: '平均需要的击杀次数。根据概率和掷骰次数计算得出。',
        },
        {
          term: '时长',
          body: '预期击杀数除以玩家通常每小时能完成的击杀数。它只是一个参考，而非承诺。',
        },
      ],
      note: {
        tag: '平均值，而非上限',
        body: '一半的玩家会在预期击杀数之前拿到它，也有些人需要多得多。用它来判断一个格子有多大，而不是预测它何时出现。',
      },
    },
    luck: {
      title: '运气：spooned、dry 或 on rate',
      body: [
        '运气会将你已完成的击杀与它应该需要的击杀进行比较。如果你用比预期更少的击杀拿到了掉落，你就是 **spooned**。如果你击杀了很多次仍一无所获，你就是 **dry**。介于两者之间则是 **on rate**。',
        '只有当情况罕见（大约二十分之一或更低的几率）时，Anvil 才会标记你为 **dry** 或 **spooned**。它会显示你的击杀数与预期数的对比，以及你领先或落后多少。',
        'Members 页面上的 **Luck** 标签列出团队中最倒霉和最幸运的成员。插件发布的稀有掉落帖子也可以附带一行运气信息，例如前百分之几，或者到现在为止有多少玩家本该已经拿到。',
      ],
    },
    source: {
      title: '数据来源',
      body: [
        '掉落率来自 OSRS Wiki，每天更新。计算时长所用的击杀率来自 Wiki 的赚钱指南。如果某个概率只是谨慎的估计，Anvil 也会这样对待。',
        '如果某个概率看起来不对，应该去 Wiki 修正它，Anvil 会同步这一改动。',
      ],
    },
    records: {
      title: '记录与高效时长',
      body: [
        'Anvil 会保存你在技能经验、boss 击杀和高效时长方面的最佳 **day**、**week**、**month** 和 **year**。天按 UTC 计算，周从周一开始。',
        '记录可追溯到 Anvil 开始追踪你账号的时候：你第一次打开记录时，Anvil 会根据你的每日历史将其补全，之后保持更新。只有当你超过旧的最佳成绩时，记录才会改变。',
        '你可以在角色页面的 **Records** 下看到自己的记录。团队的记录保持者在 **Members → Records**。',
        '**Efficient hours played** 是你的收益按优良训练方式需要多长时间，以便比较快速技能与慢速技能。**Efficient hours bossed** 对击杀做同样的事情。比率来自 OSRS Wiki，ironman 账号使用各自的比率。',
      ],
    },
  },
};

export default zhHans;
